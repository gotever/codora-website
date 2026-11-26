# Kế hoạch kiểm thử – Codora

| Mục | Giá trị |
|---|---|
| Dự án | Codora – website học lập trình Python (nhóm 3, INT3401 12) |
| Người phụ trách kiểm thử | Đinh Quang Huy (24020157) |
| Nhánh | `test/codora-testing`, tách từ `feat/postgresql-integration` (mốc: commit `90901d8`) |
| Phiên bản tài liệu | 1.0 – 27/11/2026 |
| Tài liệu liên quan | `docs/testing/baseline-report.md`, `docs/ai-assessment-capability.md`, `docs/ai-tutor-memory.md` |

## 1. Mục tiêu

1. Kiểm chứng các chức năng chính của backend (API, chấm bài, AI tutor, cá nhân hóa, bài kiểm tra lên level) và các hàm xử lý quan trọng ở frontend.
2. Đo các chỉ số đánh giá của nhóm (mục 7) bằng số liệu có thể tái lập.
3. Phát hiện và ghi nhận lỗi kèm cách tái hiện. Người kiểm thử **không sửa code ứng dụng**. Lỗi được ghi vào danh sách lỗi và chuyển cho thành viên phụ trách.

## 2. Phạm vi

### 2.1. Trong phạm vi

| Thành phần | File chính |
|---|---|
| API backend | `backend/app/main.py`, `backend/app/assessments.py` |
| Xác thực | `backend/app/auth.py` |
| Chấm bài | `backend/app/runner.py`, `backend/assessment_runner/server.py` |
| AI tutor | `backend/app/tutor.py` |
| Cá nhân hóa bài học | `backend/app/personalization.py`, `backend/app/learning_profile.py` |
| Migration, seed | `backend/app/migrate.py`, `backend/app/seed.py`, `backend/migrations/001`–`012` |
| Trace | `backend/app/llm_trace.py`, `backend/app/interaction_trace.py` |
| Hàm xử lý frontend | `frontend/src/lib/sanitizeHtml.ts`, `frontend/src/lib/lessonContent.ts`, `frontend/src/lib/api.ts` |

### 2.2. Ngoài phạm vi

- Sửa lỗi trong code ứng dụng (chỉ ghi nhận).
- Kiểm thử tải/stress, kiểm thử giao diện về mặt thẩm mỹ, kiểm thử trên nhiều trình duyệt.
- Database production hoặc database phát triển dùng chung.
- Đánh giá chất lượng nội dung sư phạm của bài học.

## 3. Cấp độ và phương pháp kiểm thử

| Cấp độ | Công cụ | Cần DB | Cần OpenAI | Ghi chú |
|---|---|:---:|:---:|---|
| Unit test backend | pytest, `monkeypatch` | Không | Không (mock) | Hàm thuần, validate schema, xử lý lỗi |
| Test API | `fastapi.testclient.TestClient` | Có (DB `_test`) | Không (mock) | Mã trạng thái, nội dung trả về, phân quyền owner |
| Test tích hợp DB | pytest + psycopg | Có (DB `_test`) | Không | Migration, seed, ràng buộc khóa |
| Test sandbox chấm bài | pytest + container `assessment_runner` | Không | Không | Timeout, chặn network, sai token |
| Unit test frontend | Vitest + jsdom | Không | Không | Sanitize HTML (XSS), parser nội dung bài học |
| Đo chỉ số | Script Python riêng | Tùy chỉ số | Tùy chỉ số | Xem mục 7 |

Kỹ thuật thiết kế test case: phân vùng tương đương, giá trị biên (giới hạn độ dài memory, số challenge, timeout), case lỗi (input sai kiểu, token giả/hết hạn, thiếu API key), và kiểm thử bảo mật (lộ hidden test case, XSS, truy cập dữ liệu của người khác).

## 4. Môi trường kiểm thử

| Thành phần | Phiên bản |
|---|---|
| Python | 3.14 (local); 3.11 trong Docker |
| PostgreSQL | 16 (`postgres:16-alpine`) |
| pytest | 8.4 |
| Node.js | Cần cài cho các task frontend |

### 4.1. Biến môi trường

| Biến | Dùng cho | Quy tắc |
|---|---|---|
| `DATABASE_URL`, `JWT_SECRET` | Bắt buộc để import `app` | Khi test không cần DB, dùng giá trị giả trỏ tới DB `_test` không tồn tại |
| `TEST_DATABASE_URL` | Test tích hợp DB | Tên database **bắt buộc kết thúc bằng `_test`** (`conftest.py` kiểm tra điều này) |
| `ASSESSMENT_DB_TEST=1` | Test API bài kiểm tra | Chỉ bật khi **đồng thời** có `TEST_DATABASE_URL` (xem BUG-03 trong baseline) |
| `ASSESSMENT_RUNNER_TEST=1` | Test grader cô lập | Cần container `assessment_runner` chạy ở cổng 3002 |
| `OPENAI_API_KEY` | Chỉ dùng khi đo chỉ số AI | Không ghi vào code hay commit; test thường luôn mock OpenAI |

### 4.2. Nguyên tắc an toàn

- Không chạy test trên database không có hậu tố `_test`.
- Không đưa secret thật (OpenAI key, JWT secret) vào code, file test hay commit.
- Test thường không gọi OpenAI thật. Chỉ lúc đo chỉ số mới gọi thật, và phải ghi lại số lần gọi.

## 5. Cách chạy

```bash
# Backend: test không cần DB
cd backend
DATABASE_URL=postgresql://codora:codora@127.0.0.1:5432/codora_unused_test \
JWT_SECRET=test-only-jwt-secret-with-32-characters \
python -m pytest -q

# Backend: bật thêm test DB
TEST_DATABASE_URL=postgresql://codora:<mật khẩu>@127.0.0.1:5432/codora_test \
JWT_SECRET=test-only-jwt-secret-with-32-characters \
python -m pytest -q

# Một test cụ thể
python -m pytest tests/test_runner.py::test_sandbox_accepted
```

Chạy đầy đủ với PostgreSQL test và grader cô lập: xem `docs/testing/test-environment.md` (dùng `docker-compose.test.yml`).

## 6. Tiêu chí

### 6.1. Tiêu chí bắt đầu

- Đã có baseline (`docs/testing/baseline-report.md`).
- Môi trường cài được từ `backend/requirements.txt`.

### 6.2. Tiêu chí hoàn thành một task

- Có sản phẩm kiểm chứng được: file test, script đo, hoặc báo cáo markdown.
- Test mới chạy pass. Riêng test chạm vào lỗi đã biết thì đánh dấu `xfail` và ghi mã lỗi (`reason="BUG-xx: ..."`).
- Không làm hỏng test đang pass trong baseline.

### 6.3. Tiêu chí kết thúc đợt kiểm thử

- Hoàn thành các task trong mục 9, hoặc ghi rõ lý do task nào chưa làm.
- Có báo cáo kết quả kiểm thử tổng hợp, gồm số liệu chỉ số và danh sách lỗi.

## 7. Chỉ số đánh giá

Bảng chỉ số của nhóm gồm 5 mục. Codora **không dùng tool calling**: cả 3 chỗ gọi OpenAI (`tutor.py`, `personalization.py`, `assessments.py`) chỉ yêu cầu model trả về JSON. Codora cũng **không có dữ liệu giá**. Vì vậy 3 mục được đo bằng chỉ số tương đương, có ghi rõ lý do:

| Chỉ số trong bảng | Cách đo ở Codora | Công thức | Cần OpenAI thật |
|---|---|---|:---:|
| Task success rate | Tỉ lệ lần gọi AI trả về output hợp lệ: bài học cá nhân hóa, đề kiểm tra (qua validate Pydantic), câu trả lời tutor (JSON đúng dạng) | số lần hợp lệ / tổng số lần gọi | Có |
| Tool-call precision | **Thay thế:** precision của bộ nhận diện sở thích học (`_explicit_learning_preference_updates`) trên bộ câu có gán nhãn, và precision của runner (bài chấm Accepted đúng là lời giải đúng) | TP / (TP + FP) | Không |
| Tool-call recall | **Thay thế:** recall của hai bộ trên | TP / (TP + FN) | Không |
| Lỗi giá khi tra DB | **Thay thế:** tỉ lệ sai dữ liệu khi tra DB. So sánh dữ liệu API trả về với DB/seed (`backend/data/curriculum.json`): nội dung bài học/bài tập, không lộ `hidden` test case, điểm = passed/total × 10 | số bản ghi sai / số bản ghi kiểm tra | Không |
| Độ trễ trung vị | Median thời gian phản hồi của submit (runner), các API chính, và `/api/tutor/chat` | median của N lần đo | Riêng tutor thì có |

Mỗi chỉ số ghi kèm: số mẫu N, thời điểm đo, commit, cấu hình máy.

## 8. Quản lý lỗi

- Mã lỗi: `BUG-xx` cho lỗi trong code ứng dụng, `TST-xx` cho test lỗi thời hoặc test sai.
- Mỗi lỗi ghi: mô tả, mức độ (Cao/Trung bình/Thấp), cách tái hiện, kết quả mong đợi và kết quả thực tế, file/dòng liên quan.
- Lỗi đã biết: BUG-01, BUG-02, BUG-03, TST-01, TST-02 (`baseline-report.md`); TST-03, OBS-01 (`test-environment.md`); BUG-04: `_lesson_challenges` trong `tutor.py` ném `AttributeError`/`TypeError` khi metadata bài học sai dạng (ví dụ JSON là mảng, hoặc `sections` là `null`), trong khi `_lesson_summary` xử lý được (`tests/test_tutor_helpers.py`). BUG-05: `verify_password` trong `auth.py` ném `InvalidHashError` thay vì trả `False` khi hash lưu trong DB rỗng hoặc sai định dạng (`tests/test_auth_schemas_extra.py`).

Lỗi tìm thấy ở `app/runner.py` (bộ chấm của `POST /api/exercises/{id}/submit`, chạy code người học trực tiếp trên máy chủ backend), chi tiết trong `tests/test_runner_edge_cases.py`:

| Mã | Mức | Mô tả |
|---|---|---|
| BUG-06 | Cao | Danh sách chặn theo chuỗi con dễ bị vượt qua (`os.popen`, `__import__('subpro' + 'cess')`). Code người học chạy được lệnh shell và đọc được file trên máy chủ. |
| BUG-07 | Cao | Tiến trình chấm kế thừa biến môi trường của server. Code người học đọc được `JWT_SECRET`, `DATABASE_URL`, `OPENAI_API_KEY` và trả chúng về qua trường `actual`. |
| BUG-08 | Cao | Code người học có thể in chuỗi đánh dấu kết quả kèm JSON giả rồi `sys.exit(0)`, khiến bài được chấm Accepted mà không giải. |
| BUG-09 | Trung bình | Code người học đọc được biến toàn cục `test_cases`, gồm cả đáp án của test ẩn. |
| BUG-10 | Trung bình | Thông báo lỗi của test ẩn được trả về nguyên văn, nên có thể làm lộ input của test ẩn qua `raise`. |
| BUG-11 | Thấp | `IndentationError`/`TabError` bị báo là "Runtime Error" thay vì "Syntax Error"; số dòng trong thông báo lỗi bị lệch 6 dòng do phần khung của runner. |

Lỗi và ghi nhận từ test API exercises/submit (`tests/test_api_exercises.py`):

| Mã | Mức | Mô tả |
|---|---|---|
| BUG-12 | Trung bình | Người dùng đã đăng nhập nộp bài qua slug (ví dụ `POST /api/exercises/is-palindrome/submit`) bị lỗi 500: endpoint ghi slug vào cột `ai_chats.exercise_id` kiểu BIGINT (`invalid input syntax for type bigint`). Tiến độ và lịch sử nộp bài không được lưu. Nộp qua id số thì bình thường. |
| OBS-02 | Thấp | Tài liệu dự án đặt quy tắc chỉ dùng 6 bảng, nhưng sau migration 012 schema có 11 bảng (thêm `learning_concepts`, `exercise_concepts`, `exercise_workspace_state`, `lesson_challenge_progress`, `assessments`). |
| OBS-03 | Thấp | Khi sai test ẩn, response vẫn trả `label` của test đó (ví dụ "Hidden 13: Edge: Empty string"), tức là gợi ý input của test ẩn. |
| OBS-04 | Thấp | Bài đã `completed` vẫn giữ trạng thái completed khi nộp lại sai, nhưng `score` bị ghi đè bằng điểm lần nộp mới nhất (ví dụ từ 10 xuống 7,5). |
| OBS-05 | Thấp | Dữ liệu test ẩn của `count-words` có chuỗi `"caf? au lait"`, dấu hiệu chữ "é" bị lỗi mã hóa khi xuất dữ liệu. |

Lỗi từ test API auth/level/progress/workspace (`tests/test_api_auth_workspace.py`):

| Mã | Mức | Mô tả |
|---|---|---|
| BUG-13 | Trung bình | Level do client quyết định: `POST /api/auth/register` nhận trường `level`, nên đăng ký thẳng là `advanced` được mà không qua bài kiểm tra. Người dùng không phải beginner cũng tự đổi được sang level bất kỳ qua `PUT /api/auth/level` (ví dụ intermediate → advanced). |
| BUG-14 | Trung bình | `PUT /api/progress` tin trạng thái và điểm do client gửi: đánh dấu bài tập `completed` với điểm 10 được mà không cần nộp bài để chấm. Điểm này lại được dùng để tính concept đã thành thạo và điều kiện mở bài kiểm tra. |
| OBS-06 | Thấp | Đăng xuất chỉ xóa cookie ở trình duyệt. Token JWT cũ vẫn dùng được tới khi hết hạn (7 ngày), vì server không có cơ chế thu hồi token. |

Lỗi từ phần đo chỉ số (`docs/testing/metrics-report.md`):

| Mã | Mức | Mô tả |
|---|---|---|
| BUG-15 | Thấp | `runner.py` bỏ dấu nháy trước khi so sánh, nên trả về sai kiểu vẫn được Accepted (ví dụ trả chuỗi `"15"` khi đáp án là số `15`, hoặc `"True"` khi đáp án là `True`). |

## 9. Danh sách task

Toàn bộ công việc kiểm thử nằm trên branch `test/codora-testing`.

| # | Task | Sản phẩm | Trạng thái |
|---:|---|---|---|
| 1 | Viết kế hoạch kiểm thử | `docs/testing/test-plan.md` | Xong |
| 2 | Lập baseline bộ test hiện có | `docs/testing/baseline-report.md` | Xong |
| 3 | Dựng PostgreSQL riêng cho test và chạy lại các test bị skip | `docker-compose.test.yml`, `docs/testing/test-environment.md` | Xong |
| 4 | Unit test hàm thuần trong `tutor.py` | `backend/tests/test_tutor_helpers.py` | Xong |
| 5 | Unit test `auth.py` và validate `schemas.py` | `backend/tests/test_auth_schemas_extra.py`  Xong |
| 6 | Test case biên cho `runner.py` | `backend/tests/test_runner_edge_cases.py`  Xong |
| 7 | Test API exercises và submit: tra theo id/slug, không lộ hidden test, công thức điểm | `backend/tests/test_api_exercises.py`  Xong |
| 8 | Test API auth, workspace, progress và phân quyền owner | `backend/tests/test_api_auth_workspace.py`  Xong |
| 9 | Đo chỉ số đánh giá | `backend/scripts/measure_metrics.py`, `docs/testing/metrics-report.md`, `docs/testing/metrics-results.json` | Xong |
| 10 | Danh sách lỗi và báo cáo kết quả kiểm thử (kèm coverage) | `docs/testing/test-report.md` | |

Ngoài phạm vi đợt này: test frontend (máy kiểm thử chưa có Node.js), E2E, CI.

## 10. Rủi ro

| Rủi ro | Ảnh hưởng | Cách xử lý |
|---|---|---|
| Code ứng dụng còn thay đổi trong lúc viết test | Test vỡ vì lỗi thời (như TST-01, TST-02) | Ghi commit mốc vào mỗi báo cáo; chạy lại baseline trước khi báo cáo cuối |
| Đo chỉ số AI cần OpenAI key và tốn chi phí | Không đo được hoặc số mẫu nhỏ | Giới hạn N, ghi rõ N; dùng key của nhóm nếu được cấp |
| Python local (3.14) khác Docker (3.11) | Kết quả lệch | Chạy lại các test chính trong container nếu có thời gian |
| Không có PostgreSQL test | 15/43 item bị skip | Task 3 |
