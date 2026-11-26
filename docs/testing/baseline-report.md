# Báo cáo baseline kiểm thử – Codora

Ghi lại trạng thái bộ test **trước khi** bổ sung test mới, làm mốc để so sánh về sau.

| Mục | Giá trị |
|---|---|
| Ngày chạy | 27/11/2026 |
| Nhánh / commit | `feat/postgresql-integration` @ `90901d8` |
| Người thực hiện | Đinh Quang Huy (24020157) |
| Hệ điều hành | Linux 7.0 |
| Python | 3.14.4 (Docker image của dự án dùng 3.11, xem mục 6) |
| Thư viện chính | pytest 8.4.2, fastapi 0.165.0, starlette 1.10.0, pydantic 2.14.4, psycopg 3.3.9, openai 2.54.0, httpx 0.29.0 |
| Cài đặt | venv mới, `pip install -r backend/requirements.txt` |

## 1. Tổng quan bộ test hiện có

7 file trong `backend/tests/`, **38 hàm test**. Tính cả tham số hóa (`test_isolated_grader` có 6 bộ tham số) thì pytest thu được **43 test item**.

| File | Hàm test | Item | Nội dung |
|---|---:|---:|---|
| `test_assessments.py` | 14 | 19 | Contract bài kiểm tra, validate đáp án, điều kiện mở khóa/lên level, grader |
| `test_auth_and_schema.py` | 7 | 7 | Argon2id, validate đăng ký, route cần đăng nhập, schema 6 bảng, token |
| `test_learning_profile.py` | 2 | 2 | Trạng thái concept |
| `test_personalization_challenge.py` | 4 | 4 | Personalization thêm/giữ challenge, từ chối output sai |
| `test_postgres_integration.py` | 4 | 4 | Bảng/khóa, upsert, phân quyền owner, seed idempotent |
| `test_runner.py` | 6 | 6 | Sandbox chấm bài: accepted, wrong answer, timeout, lỗi cú pháp/runtime, chặn vi phạm bảo mật |
| `test_tutor_memory.py` | 1 | 1 | Tutor dùng cửa sổ lịch sử, lưu memory có giới hạn |
| **Tổng** | **38** | **43** | |

Frontend (`frontend/`) **chưa có framework test**. Chỉ có các script `dev`, `build`, `lint`.

## 2. Lần chạy A: máy sạch, không có `.env`

```bash
cd backend
env -u DATABASE_URL -u JWT_SECRET python -m pytest -q
```

**Kết quả: lỗi ngay lúc collect, 0 test được chạy.**

```
ERROR tests/test_assessments.py - pydantic_core._pydantic_core.ValidationError
  database_url  Field required
  jwt_secret    Field required
Interrupted: 1 error during collection
```

Nguyên nhân: `app/settings.py` khởi tạo `Settings()` ngay khi import module, mà `database_url` và `jwt_secret` là trường bắt buộc. Theo thứ tự chữ cái, `test_assessments.py` được collect đầu tiên, nó import `app`, và lỗi làm dừng cả phiên. Chỉ `test_auth_and_schema.py` tự đặt giá trị mặc định cho 2 biến này. Vì vậy khi chạy riêng từng file:

| File chạy riêng | Kết quả |
|---|---|
| `test_assessments.py` | lỗi collect |
| `test_personalization_challenge.py` | lỗi collect |
| `test_tutor_memory.py` | lỗi collect |
| `test_auth_and_schema.py` | 7 passed |
| `test_learning_profile.py` | 2 passed |
| `test_runner.py` | 6 passed |
| `test_postgres_integration.py` | 4 skipped |

## 3. Lần chạy B: truyền biến giả qua dòng lệnh

Hai biến được đặt giá trị giả ngay trên dòng lệnh, không ghi vào file nào. `DATABASE_URL` trỏ tới một database `_test` không tồn tại nên không thể chạm vào dữ liệu thật.

```bash
cd backend
DATABASE_URL=postgresql://codora:codora@127.0.0.1:5432/codora_unused_test \
JWT_SECRET=test-only-jwt-secret-with-32-characters \
python -m pytest -v -rs --durations=5
```

**Kết quả: 25 passed, 3 failed, 15 skipped, thời gian 4,99 s.**

| File | Passed | Failed | Skipped |
|---|---:|---:|---:|
| `test_assessments.py` | 8 | 0 | 11 |
| `test_auth_and_schema.py` | 7 | 0 | 0 |
| `test_learning_profile.py` | 2 | 0 | 0 |
| `test_personalization_challenge.py` | 2 | 2 | 0 |
| `test_postgres_integration.py` | 0 | 0 | 4 |
| `test_runner.py` | 6 | 0 | 0 |
| `test_tutor_memory.py` | 0 | 1 | 0 |
| **Tổng** | **25** | **3** | **15** |

Tỉ lệ pass trên số test thực sự chạy: 25/28 = **89,3 %**. Trên tổng số item: 25/43 = **58,1 %**.

### 3.1. Test fail

| Test | Lỗi | Nguyên nhân |
|---|---|---|
| `test_personalization_adds_level_matched_challenge_when_lesson_has_none` | `HTTPException 502: The lesson model did not preserve the required 2–3 Code challenges` | **Test lỗi thời.** `personalization.py` hiện bắt buộc mỗi bài học có 2–3 challenge, nhưng bài học giả trong test chỉ có 1 section và sinh ra 1 challenge. |
| `test_personalization_preserves_existing_challenge` | Như trên | Như trên: bài học giả chỉ có 1 challenge có sẵn. |
| `test_tutor_uses_recent_window_and_submission_events_and_persists_bounded_memory` | `HTTPException 401: Authentication required` | **Test lỗi thời.** `FakeConnection` nhận diện câu SQL bằng chuỗi `"SELECT id,level,ai_tutor_memory"`, nhưng `tutor.py` hiện truy vấn `SELECT id,level,learning_preferences,ai_tutor_memory`. Fake trả về `None`, nên code hiểu là không có user. |

Cả 3 test fail vì test chưa được cập nhật theo code mới, không phải vì code sai.

### 3.2. Test bị skip

| Số item | Điều kiện để bật | Ghi chú |
|---:|---|---|
| 5 | `ASSESSMENT_DB_TEST=1` | Fixture `api` trong `test_assessments.py`. Tạo schema tạm trên `settings.database_url` rồi rollback. |
| 6 | `ASSESSMENT_RUNNER_TEST=1` | `test_isolated_grader`, cần container `assessment_runner` (cổng 3002) đang chạy. |
| 4 | `TEST_DATABASE_URL` trỏ tới DB có tên kết thúc `_test` | `test_postgres_integration.py`, cần PostgreSQL 16. |

### 3.3. Test chậm nhất

| Thời gian | Test |
|---:|---|
| 3,10 s | `test_assessments.py::test_grade_coding_local_behavior` |
| 1,00 s | `test_runner.py::test_sandbox_time_limit_exceeded` |
| 0,13 s | `test_auth_and_schema.py::test_password_hash_is_argon2id_and_verifies` |

## 4. Frontend

Chưa chạy `npm run lint` và `npm run build` vì máy kiểm thử chưa cài Node.js. Sẽ chạy bổ sung khi làm các task frontend.

## 5. Vấn đề phát hiện trong lúc lập baseline

Ghi nhận để đưa vào danh sách lỗi. Theo phạm vi công việc, người kiểm thử **không sửa code ứng dụng**.

| Mã | Mức | Mô tả |
|---|---|---|
| BUG-01 | Trung bình | Thiếu `DATABASE_URL`/`JWT_SECRET` thì `pytest` lỗi lúc collect, kể cả với test không cần DB (mục 2). |
| BUG-02 | Trung bình | Dòng 94 của `app/tutor.py` dùng `.replace("Ä‘", "d")`, chữ "đ" bị lỗi mã hóa. Vì vậy câu có chữ "đ" không được nhận diện là sở thích học. Ví dụ "Giải thích vừa đủ thôi" lẽ ra cho `detail_level=balanced`, "Đi thẳng vào cách làm" lẽ ra cho `explanation_style=direct`, nhưng cả hai đều trả về `{}`. |
| BUG-03 | Cao (an toàn dữ liệu) | Với `ASSESSMENT_DB_TEST=1`, fixture `api` kết nối vào `settings.database_url` mà không kiểm tra `TEST_DATABASE_URL`. Nếu quên đặt `TEST_DATABASE_URL`, test sẽ chạy `CREATE SCHEMA` trên DB thật trong `.env`. Cuối test có rollback, nhưng vẫn vi phạm quy tắc chỉ test trên DB `_test`. |
| TST-01 | Thấp | 2 test personalization lỗi thời so với yêu cầu 2–3 challenge (mục 3.1). |
| TST-02 | Thấp | Test tutor memory nhận diện SQL bằng chuỗi cứng, nên vỡ khi câu truy vấn thay đổi (mục 3.1). |

## 6. Giới hạn của baseline

- Python local là 3.14, còn `backend/Dockerfile` và `assessment_runner/Dockerfile` dùng `python:3.11-slim`. Kết quả có thể khác đôi chút khi chạy trong container.
- Chưa có PostgreSQL test và container grader, nên 15/43 item chưa được chạy.
- Chưa đo coverage. Việc này thuộc task riêng.
