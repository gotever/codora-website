# Báo cáo kết quả kiểm thử – Codora

| Mục | Giá trị |
|---|---|
| Dự án | Codora – website học lập trình Python (nhóm 3, INT3401 12) |
| Người kiểm thử | Đinh Quang Huy (24020157) |
| Thời gian | 27/11/2026 – 28/11/2026 |
| Code được kiểm thử | `feat/postgresql-integration` @ `90901d8` (không sửa code ứng dụng) |
| Branch kiểm thử | `test/codora-testing` |
| Tài liệu liên quan | `test-plan.md`, `baseline-report.md`, `test-environment.md`, `metrics-report.md` |

## 1. Tóm tắt

- Viết thêm **5 file test với 360 test case** cho backend. Cùng 43 test có sẵn, tổng cộng **403 test case**.
- Dựng môi trường test cô lập: PostgreSQL `codora_test` và container chấm bài riêng. Nhờ đó **15 test trước đây luôn bị skip giờ đã chạy được**.
- Kết quả cuối: **378 pass, 20 xfail (lỗi đã biết), 5 fail** (test cũ đã lỗi thời), 0 skip, chạy trong 16 giây.
- Coverage dòng lệnh của `backend/app` tăng từ **51 % lên 66 %**.
- Phát hiện **15 lỗi** (4 mức Cao, 7 Trung bình, 4 Thấp), **3 test lỗi thời** và **6 ghi nhận**. Lỗi nghiêm trọng nhất nằm ở bộ chấm bài `runner.py`: code của người học chạy được lệnh shell trên server, đọc được secret, và giả được kết quả Accepted.
- Đã đo 5 chỉ số đánh giá. Chi tiết trong `metrics-report.md`.

## 2. Phạm vi và phương pháp

Phạm vi là backend: API, xác thực, chấm bài, AI tutor, tiến độ học và dữ liệu. Không kiểm thử frontend vì máy kiểm thử chưa có Node.js. Theo phân công, người kiểm thử **chỉ ghi nhận lỗi, không sửa code ứng dụng**. Mỗi lỗi đã biết được giữ lại dưới dạng test `xfail(strict=True)` có ghi mã lỗi. Khi lỗi được sửa, test đó sẽ tự báo `XPASS`, nhắc bỏ đánh dấu.

| Cấp độ | Cách làm |
|---|---|
| Unit test | pytest, `monkeypatch`, không cần DB và không gọi OpenAI |
| Test API | FastAPI `TestClient` trên DB `codora_test`. File test tự migrate và seed. Người dùng test có prefix riêng và được xóa sau khi chạy |
| Test bảo mật | Chỉ dùng phép thử vô hại: lệnh `echo`, biến môi trường giả, file tạm |
| Đo chỉ số | Script `backend/scripts/measure_metrics.py` với bộ dữ liệu có gán nhãn |

Môi trường: Linux, Python 3.14.4, pytest 8.4.2, PostgreSQL 16 (Docker, tmpfs), grader `assessment_runner` (Docker, Python 3.11). Cách dựng và chạy xem `test-environment.md`.

## 3. Kết quả

### 3.1. Theo file test

| File | Loại | Case | Pass | Xfail | Fail |
|---|---|---:|---:|---:|---:|
| `test_tutor_helpers.py` | **mới** – unit | 82 | 78 | 4 | 0 |
| `test_auth_schemas_extra.py` | **mới** – unit + route | 159 | 157 | 2 | 0 |
| `test_runner_edge_cases.py` | **mới** – unit + bảo mật | 38 | 28 | 10 | 0 |
| `test_api_exercises.py` | **mới** – API + DB | 41 | 40 | 1 | 0 |
| `test_api_auth_workspace.py` | **mới** – API + DB | 40 | 37 | 3 | 0 |
| `test_assessments.py` | có sẵn | 19 | 19 | 0 | 0 |
| `test_auth_and_schema.py` | có sẵn | 7 | 7 | 0 | 0 |
| `test_learning_profile.py` | có sẵn | 2 | 2 | 0 | 0 |
| `test_runner.py` | có sẵn | 6 | 6 | 0 | 0 |
| `test_personalization_challenge.py` | có sẵn | 4 | 2 | 0 | 2 |
| `test_postgres_integration.py` | có sẵn | 4 | 2 | 0 | 2 |
| `test_tutor_memory.py` | có sẵn | 1 | 0 | 0 | 1 |
| **Tổng** | | **403** | **378** | **20** | **5** |

5 test fail đều là **test có sẵn đã lỗi thời so với code** (TST-01..03, mục 4.2), không phải lỗi ứng dụng. Theo phạm vi công việc, chúng được giữ nguyên.

### 3.2. So với baseline

| | Baseline, máy sạch | Baseline + biến giả | Có DB + grader | **Sau kiểm thử** |
|---|---:|---:|---:|---:|
| Test case | 43 (không chạy được) | 43 | 43 | **403** |
| Pass | 0 | 25 | 38 | **378** |
| Fail | lỗi collect | 3 | 5 | 5 |
| Xfail (lỗi đã biết) | – | – | – | 20 |
| Skip | – | 15 | 0 | 0 |

### 3.3. Coverage (dòng lệnh, `pytest-cov`, chạy có DB và grader)

| Module | Trước | Sau |
|---|---:|---:|
| `auth.py` | 74 % | **100 %** |
| `main.py` (toàn bộ endpoint) | 30 % | **82 %** |
| `tutor.py` | 20 % | **50 %** |
| `runner.py` | 92 % | 94 % |
| `learning_profile.py` | 71 % | 78 % |
| `assessments.py` | 89 % | 89 % |
| `personalization.py` | 61 % | 61 % |
| `schemas.py`, `settings.py`, `db.py` | 100 % | 100 % |
| `interaction_trace.py` / `llm_trace.py` | 89 % / 38 % | 89 % / 38 % |
| `migrate.py`, `seed.py` | 0 % | 0 % * |
| **Tổng `app/`** | **51 %** | **66 %** |

\* `migrate.py` và `seed.py` thực ra vẫn được chạy (test gọi chúng qua `python -m` để dựng DB, và test seed idempotent có kiểm tra). Coverage báo 0 % chỉ vì `pytest-cov` không đo trong tiến trình con.

## 4. Danh sách lỗi

### 4.1. Lỗi trong code ứng dụng

| Mã | Mức | Vị trí | Mô tả | Test |
|---|---|---|---|---|
| BUG-06 | **Cao** | `runner.py` | Danh sách chặn chỉ so chuỗi con nên dễ vượt qua (`os.popen`, `__import__('subpro'+'cess')`). Code người học chạy được lệnh shell và đọc được file trên máy chủ backend. | `test_runner_edge_cases.py` |
| BUG-07 | **Cao** | `runner.py` | Tiến trình chấm bài kế thừa biến môi trường của server. Code người học đọc được `JWT_SECRET`, `DATABASE_URL`, `OPENAI_API_KEY` và trả chúng về qua trường `actual`. | `test_runner_edge_cases.py` |
| BUG-08 | **Cao** | `runner.py` | In chuỗi đánh dấu kết quả kèm JSON giả rồi `sys.exit(0)` là được chấm Accepted mà không cần giải. | `test_runner_edge_cases.py`, `metrics-report.md` |
| BUG-03 | **Cao** | `tests/test_assessments.py` | Đặt `ASSESSMENT_DB_TEST=1` mà thiếu `TEST_DATABASE_URL` thì test tạo schema trên DB thật trong `.env`. | `baseline-report.md` |
| BUG-12 | Trung bình | `main.py` – submit | Người dùng đã đăng nhập nộp bài qua slug thì bị **HTTP 500** (slug bị ghi vào cột BIGINT). Tiến độ và lịch sử của lần nộp đó không được lưu. | `test_api_exercises.py` |
| BUG-13 | Trung bình | `main.py` – auth | Level do client quyết định: đăng ký thẳng là `advanced` được. Người dùng không phải beginner tự đổi được level bất kỳ. Cả hai cách đều bỏ qua bài kiểm tra lên level. | `test_api_auth_workspace.py` |
| BUG-14 | Trung bình | `main.py` – progress | `PUT /api/progress` tin điểm do client gửi: tự ghi được bài tập `completed` 10/10 mà không cần chấm. | `test_api_auth_workspace.py` |
| BUG-09 | Trung bình | `runner.py` | Code người học đọc được biến `test_cases`, gồm cả đáp án của test ẩn. | `test_runner_edge_cases.py` |
| BUG-10 | Trung bình | `runner.py` | Thông báo lỗi của test ẩn được trả về nguyên văn, nên có thể làm lộ input qua `raise`. | `test_runner_edge_cases.py` |
| BUG-02 | Trung bình | `tutor.py` | Chữ "đ" bị lỗi mã hóa (`"Ä‘"`), nên các câu như "vừa đủ", "đi thẳng vào cách làm" không được nhận diện là sở thích học. | `test_tutor_helpers.py` |
| BUG-01 | Trung bình | `settings.py`, `conftest.py` | Thiếu `DATABASE_URL`/`JWT_SECRET` thì pytest lỗi ngay lúc collect, không test nào chạy được. | `baseline-report.md` |
| BUG-15 | Thấp | `runner.py` | Kết quả trả về sai kiểu vẫn được Accepted (chuỗi `"15"` được coi bằng số `15`). | `metrics-report.md` |
| BUG-11 | Thấp | `runner.py` | `IndentationError` bị báo là "Runtime Error". Số dòng trong thông báo lỗi bị lệch 6 dòng. | `test_runner_edge_cases.py` |
| BUG-04 | Thấp | `tutor.py` | `_lesson_challenges` bị crash khi metadata bài học sai dạng, trong khi `_lesson_summary` xử lý được cùng input đó. | `test_tutor_helpers.py` |
| BUG-05 | Thấp | `auth.py` | `verify_password` ném `InvalidHashError` (dẫn tới lỗi 500 khi đăng nhập) thay vì trả về `False` khi hash trong DB rỗng hoặc sai định dạng. | `test_auth_schemas_extra.py` |

### 4.2. Test lỗi thời (test có sẵn không còn khớp với code)

| Mã | Test | Nguyên nhân |
|---|---|---|
| TST-01 | 2 test trong `test_personalization_challenge.py` | Bài học giả chỉ có 1 challenge, trong khi code giờ bắt buộc mỗi bài có 2–3 challenge. |
| TST-02 | `test_tutor_memory.py` | Fake DB nhận diện câu SQL bằng chuỗi cứng. Câu SQL đã đổi nên fake trả `None`, dẫn tới lỗi 401. |
| TST-03 | 2 test trong `test_postgres_integration.py` | Fixture chỉ chạy migration 001–006, thiếu 007–012, nên không có cột `preknowledge`. |

### 4.3. Ghi nhận

| Mã | Mô tả |
|---|---|
| OBS-01 | Seed in ra "18 lessons", nhưng DB chỉ có 9 bài (hai bộ giáo trình trùng thứ tự nên ghi đè lên nhau). |
| OBS-02 | Tài liệu quy định chỉ 6 bảng, nhưng schema hiện có 11 bảng. |
| OBS-03 | Khi người học sai test ẩn, response vẫn trả `label` (ví dụ "Edge: Empty string"), tức là gợi ý input của test đó. |
| OBS-04 | Nộp lại sai một bài đã hoàn thành thì điểm bị ghi đè (ví dụ từ 10 xuống 7,5). |
| OBS-05 | Dữ liệu nguồn có chuỗi `"caf? au lait"`, chữ "é" bị lỗi mã hóa. |
| OBS-06 | Đăng xuất chỉ xóa cookie ở trình duyệt. Token cũ vẫn dùng được tới khi hết hạn 7 ngày. |

## 5. Chỉ số đánh giá

| Chỉ số | Kết quả |
|---|---|
| Task success rate (luồng học hoàn chỉnh) | 50 %: qua id 100 %, qua slug 0 % (do BUG-12). Phần AI chưa đo vì không có API key |
| Precision / recall *(thay cho tool-call)* | Bộ nhận diện sở thích học: 0,80 / 0,83. Bộ chấm bài: 0,87 / 1,00 |
| Tỉ lệ sai dữ liệu khi tra DB *(thay cho "lỗi giá")* | 0 % (0/201 trường) |
| Độ trễ trung vị | API 3,5–7 ms, nộp bài 23 ms, đăng nhập 48 ms (không tính mạng) |

Định nghĩa, bộ dữ liệu và chi tiết xem `metrics-report.md`.

## 6. Đánh giá và đề xuất

**Điểm tốt:**
- Phần chấm bài cho bài kiểm tra lên level (container `assessment_runner`) cô lập tốt: chạy với user `nobody`, chặn socket, có timeout. Cả 6 test bảo mật đều pass.
- Xác thực chắc chắn: Argon2id, cookie HttpOnly, từ chối mọi kiểu token giả mạo, không lộ mật khẩu khi validate lỗi, không lộ email nào đã tồn tại khi đăng nhập sai.
- Dữ liệu tra từ DB khớp 100 % với nguồn. Test ẩn không bị lộ qua API đọc bài. Dữ liệu của từng người dùng được tách riêng đúng.

**Đề xuất cho nhóm, theo thứ tự ưu tiên:**
1. **BUG-06/07/08:** cho nút Submit bài tập chấm qua container `assessment_runner` (đã có sẵn và an toàn) thay cho `runner.py`. Nếu vẫn giữ `runner.py`, ít nhất phải xóa biến môi trường của tiến trình con và tách đáp án ra khỏi tiến trình chạy code người học.
2. **BUG-13/14:** không nhận `level` khi đăng ký. Chỉ đổi level sau khi pass bài kiểm tra. Ghi điểm bài tập từ kết quả chấm của server, không lấy điểm do client gửi.
3. **BUG-12:** dùng `row["id"]` thay cho chuỗi trong URL khi ghi vào `ai_chats`.
4. Cập nhật 3 test lỗi thời (TST-01..03) để bộ test về lại trạng thái "xanh".
5. Sửa các lỗi nhỏ: BUG-02 (một ký tự), BUG-04, BUG-05, BUG-11, BUG-15.

## 7. Giới hạn

- Chưa kiểm thử frontend và E2E vì máy kiểm thử chưa có Node.js.
- Chưa đo phần AI thật (tutor, cá nhân hóa bài học, sinh đề) vì không có OpenAI API key.
- Bộ dữ liệu đo chỉ số nhỏ và do người kiểm thử tự gán nhãn. Độ trễ đo trên máy cá nhân, không có tải đồng thời.
- Python local (3.14) khác Python trong Docker của dự án (3.11).

## 8. Sản phẩm bàn giao

| Task | Sản phẩm | Commit |
|---:|---|---|
| 1 | `docs/testing/test-plan.md` | `c2cc4c1` |
| 2 | `docs/testing/baseline-report.md` | `c2cc4c1` |
| 3 | `docker-compose.test.yml`, `docs/testing/test-environment.md` | `e88b14d` |
| 4 | `backend/tests/test_tutor_helpers.py` | `1ef9176` |
| 5 | `backend/tests/test_auth_schemas_extra.py` | `009d1b9` |
| 6 | `backend/tests/test_runner_edge_cases.py` | `f34dc25` |
| 7 | `backend/tests/test_api_exercises.py` | `7a57269` |
| 8 | `backend/tests/test_api_auth_workspace.py` | `c8b9af6` |
| 9 | `backend/scripts/measure_metrics.py`, `docs/testing/metrics-report.md`, `docs/testing/metrics-results.json` | `21455c5` |
| 10 | `docs/testing/test-report.md` (báo cáo này) | commit cuối của branch |
