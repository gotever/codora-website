# Bài kiểm tra cá nhân hóa sau sáu bài đầu

## Luồng đã triển khai

- Mở khóa khi **vừa** hoàn thành đủ sáu lesson đầu của Python fundamentals (xác định bằng order_index và id; sáu lesson bất kỳ không đủ) **vừa** đạt trạng thái `mastered` ở ít nhất 4 concept (mỗi concept cần hoàn thành tối thiểu 2 bài Exercises khác nhau với điểm >= 8/10).
- Mỗi đề có 7 câu trắc nghiệm (knowledge, code_tracing, debugging, conceptual_reasoning, mỗi câu 4 lựa chọn) và 3 câu coding Python.
- Tạo đề bằng AI theo concept evidence trong learning_profile, learning_preferences và hai trường concepts_to_practice / recurring_errors từ các context liên quan. Các context lesson có suffix phiên bản cũng được đọc. Tần suất submission fail gần đây theo concept là tín hiệu bổ sung; không đưa code/chat cá nhân vào prompt.
- Chỉ sinh đề khi chưa có đề chưa nộp. Một partial unique index và advisory transaction lock bảo đảm một đề đang làm cho mỗi user, kể cả khi mở nhiều tab.
- Đề, đáp án chuẩn, reference solution và test cases lưu ở backend. Frontend nhận các trường công khai; chấm điểm tại backend qua runner riêng.
- Lưu nháp tự động trong DB; sessionStorage giữ các thay đổi chưa kịp đồng bộ khi rời trang. Đề cũ được xem trong Tests → Test history, có phân trang và phân quyền theo session.
- Mỗi câu đúng được 1 điểm; câu coding cần pass toàn bộ test. Ngưỡng hiện tại 8/10. Giữ điều kiện bốn concept mastered hiện có và bổ sung yêu cầu test đạt khi chuyển Beginner lên Intermediate. Luồng cập nhật progress và endpoint đổi level cũng áp dụng yêu cầu này.

## Dữ liệu

Migration 012_assessments.sql tạo bảng assessments. Mỗi row là một đề và một lượt làm; tạo lại sau submit là row mới. Các trường quan hệ gồm user_id, course_id, status, score, pass_score, model_name, prompt_version, created_at, updated_at, submitted_at.

questions là JSONB chứa đề với answer key và coding tests; answers lưu câu trả lời/draft; results lưu kết quả chấm từng câu. profile_snapshot lưu các concept, preferences và tín hiệu lỗi đã đưa vào model ở thời điểm tạo đề. Dạng câu hỏi đã được Pydantic kiểm tra trước khi lưu; không cần nhân bản taxonomy concept hoặc bảng lỗi gốc. Bản cập nhật này thay đề xuất ba bảng trước đó để phù hợp bộ câu hỏi bất biến và cấu trúc khác nhau giữa MCQ/coding.

API: GET/POST /api/assessments; GET /api/assessments/{id}; PUT /api/assessments/{id}/draft; POST /api/assessments/{id}/submit. History hỗ trợ offset. Submit khóa row, chấm và ghi kết quả trong transaction; submit lại trả kết quả cũ, không chấm lại hoặc sửa điểm.

## Chạy và kiểm chứng

Chạy migration từ backend: `.venv/Scripts/python.exe -m app.migrate` (Windows), rồi khởi động lại backend nếu không dùng reload.

Runner coding dùng service riêng: `docker compose up -d --build assessment-runner`. Backend chạy native mặc định gọi http://127.0.0.1:3002; backend trong Compose dùng http://assessment-runner:3002. ASSESSMENT_RUNNER_TOKEN phải khớp giữa backend và runner; OPENAI_API_KEY / OPENAI_MODEL dùng cấu hình hiện có. Khi chạy dev cục bộ trên Windows qua `run.bat` mà không bật Docker, script tự đặt `ASSESSMENT_RUNNER_LOCAL_FALLBACK=true` để backend tự động fallback sang subprocess Python cục bộ nếu cổng `3002` không kết nối được (mặc định biến này là `false` để Docker/production luôn fail-closed).

Runner không mount DB/source/secrets ứng dụng. Code chạy dưới UID không đặc quyền, seccomp chặn network/spawn/ptrace/signals, giới hạn CPU, RAM, output và timeout; filesystem container chỉ đọc, /tmp có giới hạn. Reference solutions được kiểm tra trong runner trước khi lưu đề. Runner lỗi khi chấm không đánh trượt người học: transaction không ghi kết quả và đề vẫn chưa nộp.

Test mới: `python -m pytest tests/test_assessments.py -q`. Đặt ASSESSMENT_DB_TEST=1 để kiểm chứng DB trong schema tạm, clone cấu trúc các bảng nền, rồi rollback toàn bộ fixture; không sửa dữ liệu public. Integration kiểm tra mở khóa, cache, draft, phân quyền, nộp lại, grader lỗi, lịch sử và kết quả fail.
