# Báo cáo chỉ số đánh giá – Codora

| Mục | Giá trị |
|---|---|
| Thời điểm đo | 27/11/2026, 01:06 (UTC+7) |
| Commit | `c8b9af6` (branch `test/codora-testing`; code ứng dụng giữ nguyên như `90901d8`) |
| Môi trường | Linux, Python 3.14.4, PostgreSQL 16 test (`docker-compose.test.yml`), gọi API trong cùng tiến trình qua FastAPI TestClient |
| Script | `backend/scripts/measure_metrics.py` |
| Số liệu gốc | `docs/testing/metrics-results.json` |

Chạy lại:

```bash
docker compose -f docker-compose.test.yml up -d --build --wait
cd backend
TEST_DATABASE_URL=postgresql://codora:codora-test-only@127.0.0.1:5433/codora_test \
JWT_SECRET=test-only-jwt-secret-with-32-characters \
python scripts/measure_metrics.py --out ../docs/testing/metrics-results.json
```

## 1. Tổng hợp

| Chỉ số trong bảng | Cách đo ở Codora | Kết quả |
|---|---|---|
| Task success rate | Tỉ lệ luồng học hoàn thành trọn vẹn (mở bài → lưu nháp → nộp lời giải đúng → bài được đánh dấu hoàn thành → có trong lịch sử nộp bài) | **50 %** (10/20). Qua id: 100 % (10/10). Qua slug: **0 %** (0/10) |
| Task success rate (AI) | Tỉ lệ AI tutor trả lời hợp lệ khi gọi OpenAI thật | **Chưa đo**: không có `OPENAI_API_KEY` |
| Tool-call precision *(thay thế)* | Precision của bộ nhận diện sở thích học / của bộ chấm bài | **0,80** / **0,87** |
| Tool-call recall *(thay thế)* | Recall của bộ nhận diện sở thích học / của bộ chấm bài | **0,83** / **1,00** |
| Lỗi giá khi tra DB *(thay thế)* | Tỉ lệ trường dữ liệu API/DB trả về sai so với file nguồn | **0 %** (0/201 trường) |
| Độ trễ trung vị | Median thời gian xử lý phía backend, 30 lần mỗi endpoint | 3,5–7 ms cho API đọc/ghi; 23 ms cho nộp bài (20 test); 48 ms cho đăng nhập |

**Vì sao có chỉ số thay thế:** Codora không dùng tool calling. Cả 3 chỗ gọi OpenAI (`tutor.py`, `personalization.py`, `assessments.py`) chỉ yêu cầu model trả JSON, không khai báo tool nào. Codora cũng không có dữ liệu giá. Vì vậy 3 dòng này được đo bằng chỉ số có cùng ý nghĩa: hệ thống nhận diện hoặc quyết định đúng đến đâu, và dữ liệu tra từ DB có đúng không.

## 2. Task success rate

**Định nghĩa.** Một task là một luồng học hoàn chỉnh trên một bài tập, gồm 5 bước. Task chỉ được tính thành công khi cả 5 bước đều đúng:

1. Mở bài tập (`GET /api/exercises/{slug}`).
2. Lưu bản nháp (`PUT /api/exercises/{id}/workspace`).
3. Nộp lời giải đúng (`POST /api/exercises/{id|slug}/submit`) và nhận kết quả Accepted.
4. Bài xuất hiện với trạng thái `completed` trong `GET /api/progress`.
5. Lần nộp có trong lịch sử (`GET /api/exercises/{id}/submissions`).

Đo trên cả 10 bài tập, mỗi bài 2 lần: một lần nộp qua id số, một lần qua slug. Cả hai cách đều được API hỗ trợ.

| Cách nộp | Thành công | Tỉ lệ |
|---|---:|---:|
| Qua id | 10/10 | 100 % |
| Qua slug | 0/10 | 0 % |
| **Tổng** | **10/20** | **50 %** |

Cả 10 lần nộp qua slug đều nhận **HTTP 500** và hỏng ở 3 bước cuối. Nguyên nhân là **BUG-12**: endpoint ghi slug vào cột `ai_chats.exercise_id` kiểu BIGINT. Nếu sửa BUG-12, tỉ lệ dự kiến lên 100 %.

**Phần AI.** Script có sẵn tùy chọn `--openai-samples N` để gửi N câu hỏi thật tới `/api/tutor/chat` và đếm số câu trả lời hợp lệ. Lần đo này chưa chạy được vì máy kiểm thử không có API key. Chạy cần key của nhóm và có tốn phí.

## 3. Precision / recall (thay cho tool-call precision/recall)

### 3.1. Bộ nhận diện sở thích học (`_explicit_learning_preference_updates` trong `tutor.py`)

Bộ này đọc tin nhắn của người học để tự lưu sở thích: cách giải thích, độ chi tiết, kiểu gợi ý. Bộ dữ liệu gồm **35 câu** do người kiểm thử tự gán nhãn: 20 câu có nêu sở thích, 15 câu hỏi bình thường. Mỗi cặp (trường, giá trị) được tính là một dự đoán.

| TP | FP | FN | Precision | Recall | Đúng hoàn toàn cả câu |
|---:|---:|---:|---:|---:|---:|
| 20 | 5 | 4 | **0,80** | **0,83** | 77,1 % (27/35) |

8 câu bị nhận diện sai:

| Tin nhắn | Mong đợi | Hệ thống nhận | Nguyên nhân |
|---|---|---|---|
| Đi thẳng vào cách làm đi | `direct` | (không có) | BUG-02: chữ "đ" |
| Giải thích vừa đủ thôi | `balanced` | (không có) | BUG-02 |
| Ngắn gọn và đi thẳng vào cách làm | `concise` + `direct` | chỉ `concise` | BUG-02 |
| Không cần chi tiết đâu | `concise` | `detailed` | Không xử lý câu phủ định |
| Đừng giải thích từng bước nữa | (không có) | `step_by_step` | Không xử lý câu phủ định |
| Bài này có chi tiết gì cần chú ý không? | (không có) | `detailed` | Khớp chuỗi con "chi tiết" |
| How do I return directly from a loop? | (không có) | `direct` | "directly" chứa "direct" |
| My turtle moves in the wrong direction | (không có) | `direct` | "direction" chứa "direct" |

3 lỗi recall đều do BUG-02. Còn 5 lỗi precision là do bộ nhận diện khớp theo chuỗi con và không hiểu phủ định.

### 3.2. Bộ chấm bài (`runner.py`)

"Dương tính" nghĩa là bài nộp được chấm Accepted. Bộ dữ liệu có **39 bài nộp** cho 10 bài tập, chấm trên đủ 20 test mỗi bài (3 test hiện, 17 test ẩn):

- 20 bài đúng: 10 lời giải mẫu và 10 cách giải khác.
- 19 bài sai: 16 lỗi điển hình của người học (sai điều kiện, quên trường hợp âm, không loại phần tử trùng…) và 3 bài trả về **sai kiểu** (chuỗi `"15"` thay cho số `15`).

| Tập dữ liệu | TP | FP | FN | TN | Precision | Recall | Accuracy |
|---|---:|---:|---:|---:|---:|---:|---:|
| Bài nộp thông thường (39) | 20 | 3 | 0 | 16 | **0,87** | **1,00** | 92,3 % |
| Thêm 2 bài gian lận (41) | 20 | 5 | 0 | 16 | 0,80 | 1,00 | 87,8 % |

- Recall bằng 1,00: không có lời giải đúng nào bị chấm sai.
- 3 FP trong tập thông thường là 3 bài trả về chuỗi thay cho số/bool. Runner so sánh sau khi bỏ dấu nháy, nên `'15'` và `15` bị coi là bằng nhau (**BUG-15**).
- 2 FP trong tập gian lận: một bài in kết quả giả (BUG-08), một bài đọc đáp án test ẩn từ biến `test_cases` (BUG-09). Cả hai đều được Accepted 20/20.

## 4. Tỉ lệ sai dữ liệu khi tra DB (thay cho "lỗi giá khi tra DB")

Mỗi trường dữ liệu mà API hoặc DB trả về được so với file nguồn `backend/data/curriculum.json` và `backend/data/hidden_test_cases.json`:

| Nhóm kiểm tra | Số trường |
|---|---:|
| 10 bài tập × 18 trường: tiêu đề, độ khó, mô tả, tên hàm, code khởi đầu, gợi ý, tag, slug, test hiện, ví dụ, ràng buộc, chữ ký hàm, số thứ tự, tổng số, tên file, HTTP 200, không lộ test ẩn qua API, test ẩn lưu đúng trong DB | 180 |
| Khóa học: tiêu đề, số bài học | 2 |
| 9 bài học có khối metadata `codora-lesson:v1` | 9 |
| Điểm lưu trong `user_progress` sau khi nộp bài = passed/total × 10 (10 bài đúng, 2 bài đúng một phần) | 10 |
| **Tổng** | **201** |

**Kết quả: 0/201 trường sai (0 %).** Dữ liệu tra từ DB khớp hoàn toàn với nguồn. Chuỗi `"caf? au lait"` (OBS-05) đã sai sẵn từ file nguồn, không phải do lưu hay đọc DB.

## 5. Độ trễ trung vị

Mỗi endpoint chạy 30 lần sau 1 lần khởi động, gọi trong cùng tiến trình nên **không tính độ trễ mạng**.

| Endpoint | Median (ms) | P90 (ms) |
|---|---:|---:|
| `GET /api/exercises/{id}` | 3,48 | 4,72 |
| `GET /api/courses/{id}/lessons` | 3,93 | 5,06 |
| `PUT /api/exercises/{id}/workspace` | 4,21 | 4,65 |
| `GET /api/exercises` | 5,35 | 5,96 |
| `GET /api/progress` | 6,96 | 9,93 |
| `POST /api/tutor/chat` (OpenAI giả lập, chỉ phần backend) | 10,85 | 13,17 |
| `POST /api/exercises/{id}/submit` (Accepted, 20 test) | 23,34 | 25,57 |
| `POST /api/auth/login` | 48,08 | 50,96 |

- Nộp bài mất khoảng 23 ms, phần lớn là thời gian khởi động tiến trình Python con để chạy code.
- Đăng nhập chậm nhất vì băm mật khẩu Argon2id. Việc này có chủ đích, để chống dò mật khẩu.
- Dòng tutor chỉ đo phần xử lý của backend: đọc DB, dựng prompt, lưu bộ nhớ. Thời gian gọi OpenAI thật chưa đo được (cần API key) và thường lớn hơn nhiều.

## 6. Giới hạn

- Hai bộ dữ liệu ở mục 3 (35 câu, 41 bài nộp) do người kiểm thử tự gán nhãn. Bộ dữ liệu nhỏ nên con số mang tính tham khảo.
- Độ trễ đo trên máy cá nhân, không có độ trễ mạng và không có tải đồng thời.
- Phần AI thật (tutor, cá nhân hóa bài học, sinh đề kiểm tra) chưa đo được vì không có OpenAI API key.
