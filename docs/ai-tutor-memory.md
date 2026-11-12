# AI tutor: thay đổi và luồng hoạt động

Tài liệu này mô tả tutor AI trong trang bài học và khu vực làm bài tập: thông tin nào được gửi cho mô hình, cách lưu hội thoại, và cách duy trì ngữ cảnh qua nhiều lượt.

## Thay đổi chính

- Tutor không còn tạo phản hồi giả ở trình duyệt. Frontend gửi câu hỏi tới `POST /api/tutor/chat`; FastAPI gọi OpenAI bằng `OPENAI_API_KEY` cấu hình ở backend.
- Tutor nhận trình độ do người học chọn, tiến độ hiện tại, các chủ đề đã hoàn thành và điểm trung bình năm bài tập gần nhất để điều chỉnh độ sâu giải thích.
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

### Cửa sổ và tóm tắt hội thoại

Tối đa 8 sự kiện/tin nhắn mới nhất được gửi nguyên văn làm ngữ cảnh gần. Phần cũ hơn được gộp dần vào summary, giới hạn 500 ký tự; mô hình có thể bỏ thông tin đã lỗi thời. Khi có bài submit, sự kiện submit cũng tham gia thứ tự lịch sử và có thể chiếm một vị trí trong 8 mục gần nhất. Vì vậy đây là 8 mục lịch sử, không nhất thiết là 8 lượt hỏi đáp hoàn chỉnh.

## Structured memory

Memory lưu ở `users.ai_tutor_memory` (JSONB), theo từng user và context. Các trường hiện tại:

| Trường | Mục đích |
| --- | --- |
| `concepts_understood` | Khái niệm người học đã thể hiện là hiểu |
| `concepts_to_practice` | Khái niệm cần luyện thêm |
| `recurring_errors` | Lỗi lặp lại có ích cho việc hướng dẫn |
| `explanation_preference` | Cách giải thích phù hợp với người học |
| `current_goal` | Mục tiêu học tập hiện tại |
| `next_step` | Bước học hoặc thử tiếp theo |

Backend giới hạn số mục/độ dài từng trường và giữ tối đa 30 context gần đây cho mỗi user. Prompt hướng dẫn mô hình chỉ lưu thông tin học tập hữu ích, không lưu secret hay dữ liệu cá nhân không cần thiết. Summary và structured memory do mô hình đề xuất rồi được backend giới hạn kích thước trước khi lưu.

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
