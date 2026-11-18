# AI tutor: thay đổi và luồng hoạt động

Tài liệu này mô tả tutor AI trong trang bài học và khu vực làm bài tập: thông tin nào được gửi cho mô hình, cách lưu hội thoại, và cách duy trì ngữ cảnh qua nhiều lượt.

## Thay đổi chính

- Tutor không còn tạo phản hồi giả ở trình duyệt. Frontend gửi câu hỏi tới `POST /api/tutor/chat`; FastAPI gọi OpenAI bằng `OPENAI_API_KEY` cấu hình ở backend.
- Tutor nhận trình độ do người học chọn, tiến độ hiện tại, bằng chứng theo concept từ kết quả bài tập và điểm trung bình năm bài tập gần nhất để điều chỉnh độ sâu giải thích.
- Ngữ cảnh bài học gồm tiêu đề và phần tóm tắt ngắn từ nội dung bài. Ngữ cảnh bài tập gồm tiêu đề, mô tả, tên hàm và tóm tắt bài học liên quan.
- Ở workspace bài tập, tutor nhận thêm mã trong editor và trạng thái/chạy thử hoặc kết quả submit gần nhất để phản hồi đúng tình huống.
- Hội thoại được phân vùng theo từng người học và từng bài (`lesson:<id>` hoặc `exercise:<id>`). Các cuộc trò chuyện ở bài khác không trộn vào nhau.
- Bài submit đã xác thực được lưu như sự kiện nội bộ trong lịch sử tutor để mô hình tham khảo; sự kiện này không hiện như một tin nhắn trong khung chat.

## Luồng chat

1. Người học đăng nhập. Frontend tải các tin nhắn chat đã lưu cho bài hiện tại qua `GET /api/chats?context_key=...`.
2. Khi gửi câu hỏi, frontend gửi `context_type`, `context_id`, `message`, cùng `activity`; workspace bài tập gửi thêm `code_snapshot`.
3. Backend kiểm tra session, tải hồ sơ/trình độ, tiến độ, ngữ cảnh bài học hoặc bài tập, memory riêng của context và lịch sử từ PostgreSQL.
4. Backend dựng input cho mô hình gồm memory, tối đa 8 sự kiện/tin nhắn gần nhất, tóm tắt cũ và các tin nhắn mới vừa rời khỏi cửa sổ gần nhất. Mô hình được yêu cầu trả JSON gồm câu trả lời, summary mới và structured memory mới.
5. Backend giới hạn summary còn tối đa 500 ký tự, kiểm tra/giới hạn kích thước structured memory, sau đó lưu memory và cặp tin nhắn user/assistant vào PostgreSQL.
6. Frontend hiển thị câu trả lời. Khi mở lại cùng bài, frontend tải lại các tin nhắn chat đã lưu.

## Các lớp memory và mục đích

Ở đây “ngắn hạn” và “dài hạn” mô tả vai trò của dữ liệu khi dựng ngữ cảnh cho model, không phải hai kho lưu trữ riêng. Transcript và memory đều được lưu trong PostgreSQL; mỗi lượt chat chỉ gửi một phần lịch sử cùng các memory đã chọn.

| Lớp | Dữ liệu / nơi lưu | Mục đích và cách dùng |
| --- | --- | --- |
| Ngữ cảnh ngắn hạn (recent / verbatim) | Tối đa 8 mục cuối sau khi ghép lịch sử `ai_chats` với câu hỏi hiện tại; câu hỏi hiện tại chưa được ghi DB tại thời điểm dựng request | Giữ chính xác nội dung gần đây để xử lý tham chiếu như “đoạn code trên”, lỗi vừa gặp hoặc bước đang làm. Mục gồm tin chat hoặc sự kiện submit. |
| Transcript dài hạn | Tin nhắn chat và sự kiện submit trong `ai_chats`, theo user và `context_key` | Lưu lịch sử để tải lại khung chat và làm nguồn cho cửa sổ gần/summary ở những lượt sau. Mỗi request hiện đọc toàn bộ lịch sử của context rồi chọn phần cần gửi model. |
| Summary hội thoại | `users.ai_tutor_memory[context_key].summary`, tối đa 500 ký tự | Nén các mục đã rời cửa sổ gần, giữ mạch trao đổi và những chi tiết có thể còn hữu ích. Summary được cập nhật theo kiểu rolling: ghép summary trước với các mục mới vừa cũ đi, cho model bỏ chi tiết lỗi thời. |
| Structured memory | `users.ai_tutor_memory[context_key].structured` (JSON) | Giữ các sự kiện học tập ổn định, có thể truy xuất theo trường để cá nhân hóa tutor qua các lượt chat trong cùng bài học/bài tập. Đây không phải transcript. |
| Hồ sơ và trạng thái học tập | `users.level`, `users.learning_preferences`, `user_progress` và các truy vấn tiến độ | Dữ liệu có cấu trúc được cập nhật qua luồng ứng dụng riêng; đưa vào prompt như hồ sơ/tiến độ, không phải bản tóm tắt hội thoại. |

### Hồ sơ người học và concept trong prompt

Hồ sơ bền vững được lưu trong PostgreSQL: trình độ và lựa chọn cách học nằm trong `users`; trạng thái hoàn thành/điểm nằm trong `user_progress`. Backend chỉ lấy phần liên quan đến bài đang mở để dựng `learner_profile` cho từng request. Không lưu một bản sao đầy đủ hồ sơ trong mỗi prompt hay trong `ai_tutor_memory`.

Concept được chuẩn hóa thành ID như `python.variables`. `lessons.preknowledge` và `lessons.new_concepts` giữ danh sách ID của kiến thức nền và mục tiêu mới. Bảng `exercise_concepts` nối từng bài tập với các concept mà bài đó đánh giá. Khi mở tutor ở bài học, backend đưa metadata bài học và bằng chứng tiến độ cho các concept liên quan vào prompt. Ở bài tập, backend chỉ lấy concept gắn trực tiếp với bài tập, không suy ra từ liên kết bài học tạm thời.

`concepts` được suy ra từ `exercise_concepts` kết hợp tiến độ/điểm mới nhất trong `user_progress`: `mastered` cần ít nhất hai bài tập khác nhau có trạng thái completed và điểm từ 8/10; `demonstrated` là ít nhất một bài completed; `practicing` là đã thử nhưng chưa completed; `not_assessed` là chưa có bài tập mapped nào được thử. Đây là ước lượng dựa trên bài tập, không phải kết luận tuyệt đối. Concept chưa được bài tập nào map tới sẽ là `not_assessed`. Danh sách `completed_lessons` đọc các lesson có trạng thái completed trong `user_progress`; người học ghi nhận hoàn thành bằng nút “Mark lesson complete” ở cuối bài. Hoàn thành bài không chứng minh đã thành thạo tất cả concept trong bài. `structured_memory` và summary vẫn hữu ích cho mục tiêu, bước kế tiếp và ngữ cảnh hội thoại, nhưng là suy luận từ chat và không được ghi đè tiến độ thực tế.

Ví dụ: `python.variables` hiện được đánh giá qua `count-vowels` và `find-maximum`, hai bài yêu cầu giữ biến tích lũy/cực đại. Hoàn thành một bài cho trạng thái `demonstrated`; hoàn thành cả hai với điểm ít nhất 8/10 cho trạng thái `mastered`. `GET /api/progress` trả thêm `completed_lessons` và danh sách `concepts` để client đọc cùng tiến độ từng item. Các trạng thái concept được tính từ dữ liệu progress hiện có; không thêm bản sao progress riêng làm lệch `user_progress`.

### Verbatim, summary và cửa sổ gần

“Verbatim” ở đây có nghĩa là giữ nguyên nội dung gần đây thay vì diễn đạt lại bằng summary; không có nghĩa là không giới hạn. Khi dựng prompt, nội dung message được cắt tối đa 5.000 ký tự/mục và `code_snapshot` tối đa 10.000 ký tự. Tin nhắn chat đã ghi trong DB vẫn được lưu đầy đủ; giới hạn trên áp dụng cho bản đưa vào model. Câu hỏi mới hiện tại cũng bị giới hạn 5.000 ký tự khi dựng prompt.

Tối đa 8 mục cuối sau khi ghép lịch sử với câu hỏi hiện tại được gửi như ngữ cảnh gần. Mục mới nhất có thể bị lặp giữa danh sách `recent_messages` và phần thông tin `current_activity`/mã hiện tại, tùy request. Phần lịch sử đã rời cửa sổ được chuyển vào summary; sự kiện submit có thể chiếm một vị trí trong 8 mục. Vì vậy đây là giới hạn theo mục lịch sử, không phải theo lượt hỏi đáp.

Summary không phải bản sao đầy đủ hay bản lưu có thể khôi phục transcript: giới hạn 500 ký tự khiến chi tiết có thể mất. Transcript trong `ai_chats` mới là nguồn để xem lại lịch sử chat. Cơ chế dùng `summarized_count` để chỉ gửi thêm các mục mới đi khỏi cửa sổ, tránh tóm tắt lại cùng một đoạn ở mỗi lượt. Khi cập nhật, model nhận summary cũ và các mục mới cần hấp thụ; backend chặn summary ở 500 ký tự trước khi lưu.

## Structured memory

Structured memory lưu trong `users.ai_tutor_memory` (JSONB), được chia theo user và context (`lesson:<id>` hoặc `exercise:<id>`). Các trường hiện tại:

| Trường | Mục đích |
| --- | --- |
| `concepts_understood` | Khái niệm người học đã thể hiện là hiểu |
| `concepts_to_practice` | Khái niệm cần luyện thêm |
| `recurring_errors` | Lỗi lặp lại có ích cho việc hướng dẫn |
| `current_goal` | Mục tiêu học tập hiện tại |
| `next_step` | Bước học hoặc thử tiếp theo |

Backend giới hạn số mục/độ dài từng trường: tối đa 6 mục mỗi danh sách; nội dung mục tối đa 120 ký tự, hoặc 160 ký tự cho `recurring_errors`; `current_goal` và `next_step` tối đa 240 ký tự. `ai_tutor_memory` giữ tối đa 30 context gần nhất cho mỗi user. Prompt hướng dẫn model chỉ lưu thông tin học tập hữu ích, không lưu secret hay dữ liệu cá nhân không cần thiết. Summary và structured memory do model đề xuất, backend giới hạn kích thước trước khi lưu.

## Phần nào trùng lặp, phần nào nên giữ riêng?

Có một ít trùng lặp có chủ đích giữa summary và structured memory: cả hai có thể nhắc đến khái niệm đang học, mục tiêu hoặc bước tiếp theo. Chúng phục vụ hai cách dùng khác nhau:

- Summary giữ mạch hội thoại gần đây theo dạng văn bản tự do; phù hợp cho thông tin tạm thời như câu hỏi đã trao đổi, giải thích vừa thử hoặc chi tiết cần nối tiếp.
- Structured memory giữ một số kết luận học tập ổn định theo trường; phù hợp để tutor tra cứu nhanh mà không phải suy luận lại từ transcript.
- Transcript lưu nguyên lịch sử để hiển thị và làm nguồn dữ liệu; không thay thế summary vì gửi toàn bộ transcript vào prompt sẽ tốn ngữ cảnh.
- `learning_preferences`, trình độ và tiến độ đã có trường/nguồn riêng. Không nên lưu bản sao của chúng trong structured memory hoặc summary trừ khi cần ghi một diễn biến hội thoại cụ thể.

Vì summary có giới hạn 500 ký tự và structured memory cũng nhỏ, mức trùng hiện tại không phải lưu trữ dư thừa lớn. Tuy nhiên, `current_goal`/`next_step` có thể lặp ý với summary. Nên giữ cả hai nếu sản phẩm cần phân biệt “mạch trao đổi gần” với “trạng thái học tập cần nhớ”; nếu muốn tối giản hơn, có thể bỏ hai trường này khỏi structured memory và chỉ giữ chúng trong summary, đổi lại việc truy xuất mục tiêu/bước tiếp theo sẽ kém ổn định hơn. Đây là nhận xét về thiết kế, chưa phải thay đổi schema hay hành vi.

## Dữ liệu submit bài tập

Khi người học submit, backend chạy mã qua runner hiện có, cập nhật `user_progress` và nếu có session thì ghi sự kiện `submission` vào `ai_chats`, gồm snapshot mã cùng trạng thái, số test đạt/tổng, thời gian chạy và thông tin lỗi liên quan. Tutor đọc sự kiện đó ở lượt hỏi tiếp theo. Danh sách chat hiển thị chỉ truy vấn `event_type='chat'`, do đó submission không xuất hiện như một bong bóng chat.

Nếu submit khi chưa đăng nhập, runner vẫn trả kết quả như trước nhưng không lưu progress hoặc sự kiện cho memory. Nếu backend runner không khả dụng, frontend có fallback chạy trong trình duyệt; kết quả fallback này không được endpoint submit ghi vào memory backend.

## API và cấu hình

- Endpoint tutor: `POST /api/tutor/chat` (yêu cầu đăng nhập).
- Request: `context_type` (`lesson` hoặc `exercise`), `context_id`, `message`, tùy chọn `code_snapshot` và `activity`.
- Response: `answer`, `memory_summary`, `structured_memory`.
- API key chỉ được đọc ở server từ `OPENAI_API_KEY` trong `backend/.env`; không gửi key xuống frontend. Có thể đặt model bằng `OPENAI_MODEL`.
- Migration `backend/migrations/006_ai_tutor_memory.sql` bổ sung `users.ai_tutor_memory`, `ai_chats.context_key`, `ai_chats.event_type` và index lịch sử. Chạy `python -m app.migrate` trong thư mục `backend/` trước khi dùng phiên bản API này.
- Thiếu key hợp lệ: endpoint trả `503`. Lỗi từ OpenAI hoặc output JSON không hợp lệ: backend trả `502`. Endpoint cần session hợp lệ; frontend hiển thị hướng dẫn đăng nhập khi nhận `401`.

## Thành phần liên quan

- `backend/app/tutor.py`: tải ngữ cảnh, dựng prompt, gọi Responses API, cập nhật summary và structured memory.
- `backend/app/main.py`: route tutor, lịch sử chat và ghi nhận submit.
- `backend/app/schemas.py`: schema kiểm tra request tutor.
- `backend/migrations/006_ai_tutor_memory.sql`: schema lưu memory và phân vùng sự kiện.
- `frontend/src/lib/api.ts`: client API tutor và tải lịch sử theo context.
- `frontend/src/pages/LessonDetail/components/LessonAssistant/LessonAssistant.tsx`: chat trong bài học.
- `frontend/src/pages/ExerciseWorkspace/components/AITutorPanel/AITutorPanel.tsx`: chat trong workspace bài tập.

## Kiểm chứng

Các kiểm tra đã chạy cho implementation: `pytest tests/test_tutor_memory.py tests/test_auth_and_schema.py tests/test_personalization_challenge.py` (11 passed), frontend build thành công; lint thành công với 3 cảnh báo đã tồn tại. Migration đã được xác nhận cập nhật trên database local. Chưa gửi request thật tới OpenAI trong kiểm tra này.
