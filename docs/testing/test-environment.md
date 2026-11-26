# Môi trường test có PostgreSQL và grader cô lập

Task 3: dựng database riêng cho test và chạy lại 15 test item bị skip trong baseline.

| Mục | Giá trị |
|---|---|
| Ngày chạy | 27/11/2026 |
| Branch / commit mốc | `test/codora-testing`, code ứng dụng ở `90901d8` |
| File cấu hình | `docker-compose.test.yml` |

## 1. Thiết kế

`docker-compose.test.yml` tách hẳn khỏi môi trường dev:

| Thành phần | Dev (`docker-compose.yml`) | Test (`docker-compose.test.yml`) |
|---|---|---|
| Tên project Docker | `codora-website` | `codora-test` |
| PostgreSQL | cổng 5432, DB `codora`, có volume lưu dữ liệu | cổng **5433**, DB **`codora_test`**, dữ liệu trên **tmpfs** (tắt container là mất) |
| Grader `assessment_runner` | cổng 3002, token `codora-local-grader` | cổng **3012**, token **`codora-test-grader`** |

Vì vậy chạy test không bao giờ chạm được DB dev, và có thể chạy song song với môi trường dev. Mật khẩu và token trong file chỉ là giá trị cho test, không phải secret thật. Container grader giữ nguyên các giới hạn bảo mật của bản dev: `read_only`, `cap_drop: ALL`, `pids_limit`, `mem_limit`, `no-new-privileges`.

## 2. Cách chạy

```bash
# 1. Bật PostgreSQL test và grader (từ thư mục gốc repo)
docker compose -f docker-compose.test.yml up -d --build --wait

# 2. Đặt biến môi trường (từ thư mục backend/)
cd backend
export TEST_DATABASE_URL=postgresql://codora:codora-test-only@127.0.0.1:5433/codora_test
export DATABASE_URL=$TEST_DATABASE_URL
export JWT_SECRET=test-only-jwt-secret-with-32-characters
export ASSESSMENT_RUNNER_URL=http://127.0.0.1:3012
export ASSESSMENT_RUNNER_TOKEN=codora-test-grader

# 3. Tạo schema trong DB test
python -m app.migrate

# 4. Chạy toàn bộ test, bật cả nhóm test DB và grader
ASSESSMENT_DB_TEST=1 ASSESSMENT_RUNNER_TEST=1 python -m pytest -v -rs

# 5. Tắt (dữ liệu test bị xóa theo)
cd .. && docker compose -f docker-compose.test.yml down
```

Bước 3 là bắt buộc. Fixture `api` trong `test_assessments.py` tạo bảng bằng `CREATE TABLE ... (LIKE public.<bảng>)`, nên schema `public` phải có đủ bảng trước.

## 3. Kết quả

**38 passed, 5 failed, 0 skipped – 8,60 s** (43 test item).

So với baseline:

| | Baseline (không DB) | Có DB + grader |
|---|---:|---:|
| Passed | 25 | **38** |
| Failed | 3 | 5 |
| Skipped | 15 | **0** |

15 item trước đây bị skip giờ đều đã chạy: **13 pass, 2 fail**.

| Nhóm | Số item | Kết quả |
|---|---:|---|
| `test_assessments.py`, fixture `api` (`ASSESSMENT_DB_TEST=1`) | 5 | 5 pass |
| `test_assessments.py::test_isolated_grader` (`ASSESSMENT_RUNNER_TEST=1`) | 6 | 6 pass: trả đúng, trả sai, ném lỗi, vòng lặp vô hạn (timeout), chạy với uid 65534 (nobody), chặn `socket` |
| `test_postgres_integration.py` (`TEST_DATABASE_URL`) | 4 | 2 pass, **2 fail** |

### 3.1. Hai test fail mới

| Test | Lỗi |
|---|---|
| `test_api_auth_content_progress_chat_and_owner_isolation` | `psycopg.errors.UndefinedColumn: column "preknowledge" does not exist` khi gọi `GET /api/courses/{id}/lessons` |
| `test_curriculum_seed_is_idempotent` | `python -m app.seed` thoát với mã 1, cùng lỗi `column "preknowledge" does not exist` |

**Nguyên nhân: test lỗi thời (TST-03).** Fixture `db` trong `test_postgres_integration.py` xóa các bảng rồi chỉ chạy lại migration **001 → 006**: danh sách `MIGRATIONS` ở đầu file chưa được cập nhật. Cột `lessons.preknowledge` do migration 008 thêm vào nên không tồn tại. Quy trình của dự án yêu cầu mỗi migration mới phải được thêm vào danh sách này, nhưng 007–012 chưa được thêm.

Kiểm tra đối chứng để chắc lỗi nằm ở test chứ không ở code: trên DB test mới tinh, chạy `python -m app.migrate` rồi `python -m app.seed` **hai lần liên tiếp**. Cả hai lần đều thành công và số bản ghi không đổi giữa hai lần:

| Bảng | Số bản ghi |
|---|---:|
| `courses` | 1 |
| `lessons` | 9 |
| `exercises` | 10 |
| `learning_concepts` | 38 |
| `exercise_concepts` | 51 |

Như vậy migrate và seed của ứng dụng chạy đúng và idempotent. Chỉ có fixture của test là thiếu migration.

### 3.2. Ba test fail cũ

Vẫn là 3 test lỗi thời đã ghi trong baseline (TST-01, TST-02): 2 test personalization và 1 test tutor memory. Chúng không phụ thuộc DB nên kết quả giữ nguyên.

## 4. Vấn đề ghi nhận thêm

| Mã | Mức | Mô tả |
|---|---|---|
| TST-03 | Trung bình | `test_postgres_integration.py` chỉ áp dụng migration 001–006, thiếu 007–012, làm 2 test fail (mục 3.1). |
| OBS-01 | Thấp | `python -m app.seed` in ra "Seeded … **18** lessons", nhưng bảng `lessons` chỉ có **9** bản ghi. Số in ra là số bài học *nguồn*: hai bộ giáo trình trùng `order_index` được upsert đè lên nhau (đúng như ghi chú "known curriculum quirk" của dự án). Thông báo dễ gây hiểu nhầm, dữ liệu không sai. |

## 5. Lưu ý

- `test_postgres_integration.py` xóa 6 bảng chính khi chạy xong. Muốn chạy lại thì chạy `python -m app.migrate` trước, hoặc tắt rồi bật lại container (`down` rồi `up`).
- Grader chạy trong container Linux với Python 3.11, nên phần test grader đúng với môi trường triển khai thật.
