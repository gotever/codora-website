import type { CodingChallenge, CourseNavigation, LessonDetail, LessonSection, TestCase } from './lessons'

const beginnerTopics = [
  'Introduction to Python',
  'Input and Output',
  'Variables',
  'Operators',
  'Data Types',
  'Conditional Statements and Loops',
]
const intermediateTopics = ['Functions', 'Global and Local Variables', 'Recursion']
const topics = [...beginnerTopics, ...intermediateTopics]

function createChallenge(
  lesson: number,
  index: number,
  title: string,
  description: string,
  initialCode: string,
  testCases: Omit<TestCase, 'id'>[],
): CodingChallenge {
  return {
    id: `gfg-${String(lesson).padStart(2, '0')}-challenge-${index}`,
    title,
    description,
    practiceLabel: `CODE CHALLENGE ${index}`,
    filename: 'main.py',
    language: 'Python 3',
    initialCode,
    testCases: testCases.map((testCase, caseIndex) => ({
      ...testCase,
      id: `gfg-${String(lesson).padStart(2, '0')}-c${index}-tc${caseIndex + 1}`,
    })),
  }
}

function section(
  lesson: number,
  index: number,
  title: string,
  paragraphs: string[],
  code: string,
  caption: string,
  challenge: CodingChallenge,
): LessonSection {
  return {
    id: `lesson-${lesson}-section-${index}`,
    number: String(index).padStart(2, '0'),
    title,
    paragraphs,
    codeExample: { filename: 'example.py', language: 'Python', code, caption },
    challenge,
  }
}

function lesson(
  id: number,
  moduleNumber: '01' | '02',
  moduleName: string,
  duration: string,
  description: string,
  sections: LessonSection[],
): LessonDetail {
  const topic = topics[id - 1]
  return {
    id: String(id),
    lessonNumber: id,
    moduleNumber,
    moduleName,
    topic,
    title: topic,
    description,
    duration,
    exerciseCount: sections.filter((item) => item.challenge).length,
    language: 'Python',
    status: 'upcoming',
    sections,
    ...(id > 1 ? { prevLesson: { id: String(id - 1), title: topics[id - 2] } } : {}),
    ...(id < topics.length ? { nextLesson: { id: String(id + 1), title: topics[id] } } : {}),
  }
}

const lessonDetails: LessonDetail[] = [
  lesson(1, '01', 'BEGINNER', '10 min', 'Làm quen với Python, cách chạy chương trình và cấu trúc cơ bản của một tệp Python.', [
    section(1, 1, 'Python là gì và chương trình chạy ra sao?', [
      'Python là ngôn ngữ bậc cao có cú pháp dễ đọc. Chương trình thực thi các câu lệnh theo thứ tự từ trên xuống dưới.',
      'Dấu # mở đầu một comment. Comment giúp ghi chú cho người đọc và không được Python thực thi. Các khoảng thụt lề thể hiện khối lệnh.',
    ], 'name = "Codora"\nprint("Hello,", name)  # Hiển thị lời chào', 'Chương trình gán một giá trị rồi in lời chào.', createChallenge(
      1, 1, 'In lời chào đầu tiên', 'Hoàn thiện chương trình để in chính xác dòng Hello, Python!', '# Viết lệnh print() bên dưới\n', [
        { call: 'stdout', expected: 'Hello, Python!' },
      ],
    )),
    section(1, 2, 'Comment và thứ tự thực thi', [
      'Có thể dùng nhiều câu lệnh print() để tạo nhiều dòng kết quả. Dùng comment để giải thích mục đích của một đoạn code.',
    ], 'print("Bắt đầu")\n# Đây là ghi chú, không xuất hiện trong output\nprint("Tiếp tục")', 'Comment bị bỏ qua; hai lệnh print tạo hai dòng.', createChallenge(
      1, 2, 'In ba dòng theo thứ tự', 'Viết ba lệnh print() để hiển thị lần lượt: Start, Python, Done.', '# Thêm ba lệnh print()\n', [
        { call: 'stdout', expected: 'Start\nPython\nDone' },
      ],
    )),
  ]),

  lesson(2, '01', 'BEGINNER', '12 min', 'Nhận dữ liệu từ người dùng, chuyển đổi kiểu đầu vào và định dạng output.', [
    section(2, 1, 'Nhận input từ người dùng', [
      'input() đọc một dòng dữ liệu và trả về chuỗi. Khi cần tính toán, hãy chuyển chuỗi sang int hoặc float trước khi dùng.',
      'Trong Code challenge, mỗi test case cấp một input mẫu riêng để chương trình có thể được kiểm tra nhiều lần.',
    ], 'name = input("Tên của bạn: ")\nprint("Xin chào,", name)', 'input() trả về chuỗi; print() đưa kết quả ra màn hình.', createChallenge(
      2, 1, 'Chào người dùng', 'Đọc tên từ input và in lời chào theo mẫu: Hello, <name>!', 'name = input()\n# In lời chào tại đây\n', [
        { call: 'stdin', input: 'An\n', expected: 'Hello, An!' },
        { call: 'stdin', input: 'Minh\n', expected: 'Hello, Minh!' },
      ],
    )),
    section(2, 2, 'Chuyển đổi input và in kết quả', [
      'Dữ liệu nhận từ input() luôn là str. int() chuyển chuỗi số nguyên thành số nguyên; float() chuyển chuỗi số thập phân thành số thực.',
      'print() có thể in nhiều giá trị, còn f-string giúp tạo output theo mẫu dễ đọc.',
    ], 'first = int(input())\nsecond = int(input())\nprint(f"Tổng: {first + second}")', 'Đổi input thành số trước khi thực hiện phép cộng.', createChallenge(
      2, 2, 'Cộng hai số nhập vào', 'Đọc hai số nguyên trên hai dòng và in tổng của chúng.', 'first = int(input())\nsecond = int(input())\n# In tổng hai số\n', [
        { call: 'stdin', input: '4\n8\n', expected: '12' },
        { call: 'stdin', input: '-3\n10\n', expected: '7' },
      ],
    )),
  ]),

  lesson(3, '01', 'BEGINNER', '10 min', 'Khai báo, đặt tên, gán lại và sử dụng biến để biểu diễn dữ liệu.', [
    section(3, 1, 'Tạo và sử dụng biến', [
      'Phép gán dùng dấu = để gắn một tên với một giá trị. Python tự suy ra kiểu dữ liệu từ giá trị nên không cần khai báo kiểu trước.',
      'Tên biến nên mô tả dữ liệu, bắt đầu bằng chữ cái hoặc _, và không chứa dấu cách hay dấu gạch ngang.',
    ], 'student_name = "Linh"\nage = 18\nprint(student_name, age)', 'Biến có thể lưu các giá trị với kiểu dữ liệu khác nhau.', createChallenge(
      3, 1, 'Tạo thẻ thông tin', 'Tạo biến name và age, rồi in đúng dòng: Linh is 18.', 'name = "Linh"\nage = 18\n# In thông tin theo mẫu\n', [
        { call: 'stdout', expected: 'Linh is 18' },
      ],
    )),
    section(3, 2, 'Cập nhật và gán nhiều biến', [
      'Khi gán giá trị mới cho tên biến, giá trị hiện tại được thay thế. Python cũng cho phép gán nhiều biến trong một câu lệnh.',
    ], 'left, right = "tea", "coffee"\nleft, right = right, left\nprint(left, right)', 'Có thể hoán đổi hai giá trị bằng phép gán đồng thời.', createChallenge(
      3, 2, 'Hoán đổi hai giá trị', 'Hoán đổi hai biến first và second rồi in chúng trên cùng một dòng.', 'first = "red"\nsecond = "blue"\n# Hoán đổi hai giá trị\nprint(first, second)\n', [
        { call: 'stdout', expected: 'blue red' },
      ],
    )),
  ]),

  lesson(4, '01', 'BEGINNER', '12 min', 'Dùng toán tử số học, so sánh và logic để tạo biểu thức từ các giá trị.', [
    section(4, 1, 'Toán tử số học và gán', [
      'Các toán tử +, -, *, /, //, % và ** thực hiện cộng, trừ, nhân, chia, chia lấy phần nguyên, chia lấy dư và lũy thừa.',
      'Toán tử gán kết hợp như += cập nhật biến bằng một phép tính. Thứ tự ưu tiên giống quy tắc toán học; dùng ngoặc khi muốn làm rõ thứ tự.',
    ], 'price = 12\nquantity = 3\ntotal = price * quantity\nprint(total)', 'Biểu thức tính ra một giá trị có thể lưu vào biến.', createChallenge(
      4, 1, 'Tính tiền sau giảm giá', 'Tính tổng tiền của 3 món giá 120 mỗi món sau khi giảm 10%, rồi in kết quả.', 'price = 120\nquantity = 3\ndiscount = 10\n# Tính và in tổng tiền sau giảm giá\n', [
        { call: 'stdout', expected: '324.0' },
      ],
    )),
    section(4, 2, 'So sánh và logic', [
      'Toán tử so sánh như ==, !=, <, <=, >, >= trả về True hoặc False. and, or và not kết hợp hoặc đảo điều kiện để chương trình ra quyết định.',
      'Phân biệt = (gán giá trị) với == (so sánh hai giá trị).',
    ], 'age = 20\nhas_ticket = True\ncan_enter = age >= 18 and has_ticket\nprint(can_enter)', 'Kết quả so sánh có thể dùng trực tiếp trong biểu thức logic.', createChallenge(
      4, 2, 'Đổi giây sang phút và giây', 'Dùng // và % để đổi 367 giây thành phút và giây, in theo mẫu 6:7.', 'total_seconds = 367\n# Tính số phút và số giây còn lại\n', [
        { call: 'stdout', expected: '6:7' },
      ],
    )),
  ]),

  lesson(5, '01', 'BEGINNER', '14 min', 'Nhận biết các kiểu dữ liệu Python thông dụng và chọn thao tác phù hợp với từng kiểu.', [
    section(5, 1, 'Số, chuỗi và Boolean', [
      'int biểu diễn số nguyên, float biểu diễn số thập phân, str lưu văn bản và bool nhận True hoặc False. Dùng type() để xem kiểu của giá trị.',
      'Dữ liệu cùng kiểu thường hỗ trợ các phép toán tương ứng; ví dụ cộng số để tính tổng và nối chuỗi để tạo văn bản.',
    ], 'count = 3\nheight = 1.7\nname = "Mai"\nis_ready = True\nprint(type(count).__name__, type(height).__name__)', 'type(value).__name__ cho tên kiểu ngắn gọn.', createChallenge(
      5, 1, 'Chuyển đổi dữ liệu', 'Chuyển age_text thành int và price_text thành float, rồi in tên hai kiểu theo mẫu int float.', 'age_text = "21"\nprice_text = "19.5"\n# Chuyển kiểu và in tên hai kiểu\n', [
        { call: 'stdout', expected: 'int float' },
      ],
    )),
    section(5, 2, 'Kiểu dữ liệu tập hợp', [
      'list lưu nhiều phần tử theo thứ tự và có thể thay đổi; tuple có thứ tự nhưng không thể thay đổi; set giữ các phần tử duy nhất; dict lưu cặp khóa và giá trị.',
      'Chọn cấu trúc dữ liệu theo cách cần truy cập và cập nhật thông tin.',
    ], 'scores = [8, 9, 7]\npoint = (4, 6)\nprofile = {"name": "Mai"}\nunique_scores = {8, 8, 9}\nprint(scores[-1], point[0], profile["name"], len(unique_scores))', 'Mỗi kiểu tập hợp có cách tổ chức và truy cập khác nhau.', createChallenge(
      5, 2, 'Đọc dữ liệu từ các tập hợp', 'Lấy phần tử cuối của list, tọa độ đầu của tuple, tên trong dict và số phần tử duy nhất trong set. In các giá trị cách nhau bằng dấu cách.', 'scores = [8, 9, 7]\npoint = (4, 6)\nprofile = {"name": "Mai"}\nunique_scores = {8, 8, 9}\n# Truy cập và in bốn giá trị\n', [
        { call: 'stdout', expected: '7 4 Mai 2' },
      ],
    )),
  ]),

  lesson(6, '01', 'BEGINNER', '20 min', 'Điều khiển luồng chương trình bằng if/elif/else và lặp bằng for, while.', [
    section(6, 1, 'Chọn nhánh với if, elif và else', [
      'if chạy một khối khi điều kiện đúng. elif kiểm tra thêm điều kiện nếu các nhánh trước sai; else xử lý các trường hợp còn lại.',
      'Các điều kiện có thể kết hợp bằng and, or và not. Thụt lề xác định câu lệnh thuộc nhánh nào.',
    ], 'score = 76\nif score >= 80:\n    print("A")\nelif score >= 60:\n    print("B")\nelse:\n    print("C")', 'Chỉ nhánh đầu tiên có điều kiện đúng sẽ chạy.', createChallenge(
      6, 1, 'Phân loại điểm', 'Đọc một điểm. In Pass nếu điểm từ 60 trở lên, nếu không in Try again.', 'score = int(input())\n# Dùng if/else để in kết quả\n', [
        { call: 'stdin', input: '75\n', expected: 'Pass' },
        { call: 'stdin', input: '42\n', expected: 'Try again' },
      ],
    )),
    section(6, 2, 'Lặp với for và while', [
      'for duyệt lần lượt các giá trị, thường kết hợp với range(). while tiếp tục chạy chừng nào điều kiện còn đúng.',
      'Mỗi vòng while cần có bước làm thay đổi điều kiện để tránh lặp vô hạn. Có thể dùng break để dừng sớm và continue để chuyển sang lượt kế tiếp.',
    ], 'total = 0\nfor number in range(1, 6):\n    if number % 2 == 0:\n        total += number\nprint(total)', 'for kết hợp if để chọn giá trị cần cộng.', createChallenge(
      6, 2, 'Cộng các số chẵn', 'Dùng vòng lặp để tính tổng các số chẵn từ 1 đến 10 và in tổng.', 'total = 0\nfor number in range(1, 11):\n    # Cộng số chẵn vào total\n    pass\nprint(total)\n', [
        { call: 'stdout', expected: '30' },
      ],
    )),
    section(6, 3, 'Theo dõi vòng lặp while', [
      'Vòng while phù hợp khi số lượt lặp phụ thuộc vào một điều kiện. Cập nhật biến đếm trong thân vòng lặp để chương trình tiến tới lúc dừng.',
    ], 'count = 3\nwhile count > 0:\n    print(count)\n    count -= 1', 'Biến đếm giảm dần cho đến khi điều kiện sai.', createChallenge(
      6, 3, 'Đếm ngược', 'Dùng while để in các số từ 3 xuống 1, mỗi số trên một dòng.', 'count = 3\nwhile count > 0:\n    # In count rồi cập nhật biến\n    pass\n', [
        { call: 'stdout', expected: '3\n2\n1' },
      ],
    )),
  ]),

  lesson(7, '02', 'INTERMEDIATE', '16 min', 'Đóng gói logic thành hàm có thể gọi lại, truyền đối số và trả kết quả.', [
    section(7, 1, 'Định nghĩa và gọi hàm', [
      'def bắt đầu một định nghĩa hàm. Thân hàm được thụt lề; hàm chỉ chạy khi được gọi bằng tên và dấu ngoặc.',
      'Tham số là tên nhận dữ liệu bên trong hàm; đối số là giá trị truyền vào khi gọi.',
    ], 'def greet(name):\n    return f"Hello, {name}!"\n\nprint(greet("Linh"))', 'Hàm nhận một tham số và trả về một chuỗi.', createChallenge(
      7, 1, 'Viết hàm chào hỏi', 'Hoàn thiện greet(name) để trả về Hello, <name>!.', 'def greet(name):\n    # Trả về lời chào\n    pass\n', [
        { call: 'greet("An")', expected: 'Hello, An!' },
        { call: 'greet("Codora")', expected: 'Hello, Codora!' },
      ],
    )),
    section(7, 2, 'Đối số và giá trị trả về', [
      'return gửi kết quả về nơi gọi hàm và kết thúc lần chạy hàm hiện tại. Nếu cần, có thể đặt giá trị mặc định cho tham số.',
      'Tách một phép tính thành hàm giúp kiểm tra cùng một logic với nhiều bộ dữ liệu.',
    ], 'def rectangle_area(width, height):\n    return width * height\n\nprint(rectangle_area(4, 3))', 'Giá trị trả về có thể là số, chuỗi hoặc một cấu trúc dữ liệu.', createChallenge(
      7, 2, 'Tính trung bình', 'Hoàn thiện average(a, b, c) để trả về trung bình cộng của ba số.', 'def average(a, b, c):\n    # Tính và trả về trung bình\n    pass\n', [
        { call: 'average(3, 6, 9)', expected: '6.0' },
        { call: 'average(2, 4, 5)', expected: '3.6666666666666665' },
      ],
    )),
  ]),

  lesson(8, '02', 'INTERMEDIATE', '14 min', 'Phân biệt biến cục bộ và toàn cục, đọc biến ngoài hàm và cập nhật state có chủ đích.', [
    section(8, 1, 'Biến cục bộ và biến toàn cục', [
      'Tên được gán bên trong hàm thường là biến cục bộ và chỉ dùng trong hàm đó. Biến khai báo ở ngoài hàm là biến toàn cục, có thể được đọc trong hàm.',
      'Ưu tiên truyền dữ liệu qua tham số và return vì cách đó làm luồng dữ liệu rõ ràng hơn biến toàn cục.',
    ], 'tax_rate = 0.1\ndef total_with_tax(price):\n    return price * (1 + tax_rate)\n\nprint(total_with_tax(50))', 'Hàm có thể đọc biến toàn cục mà không cần khai báo global.', createChallenge(
      8, 1, 'Tính giá từ cấu hình toàn cục', 'Dùng biến toàn cục tax_rate trong hàm total_with_tax(price) và trả về giá sau thuế.', 'tax_rate = 0.1\ndef total_with_tax(price):\n    # Dùng tax_rate để tính và trả kết quả\n    pass\n', [
        { call: 'total_with_tax(100)', expected: '110.00000000000001' },
        { call: 'total_with_tax(50)', expected: '55.00000000000001' },
      ],
    )),
    section(8, 2, 'Cập nhật biến toàn cục', [
      'Muốn gán lại một tên toàn cục bên trong hàm, cần khai báo tên đó bằng global. Dùng global vừa đủ; với chương trình lớn, state truyền qua tham số thường dễ theo dõi hơn.',
    ], 'visits = 0\ndef record_visit():\n    global visits\n    visits += 1\n    return visits\n\nprint(record_visit())', 'global báo rằng phép gán trong hàm cập nhật tên ở phạm vi toàn cục.', createChallenge(
      8, 2, 'Tăng bộ đếm dùng chung', 'Hoàn thiện record_visit() để tăng biến toàn cục visits lên 1 và trả giá trị mới.', 'visits = 0\ndef record_visit():\n    # Khai báo và cập nhật visits\n    pass\n', [
        { call: 'record_visit()', expected: '1' },
        { call: 'record_visit() + record_visit()', expected: '3' },
      ],
    )),
  ]),

  lesson(9, '02', 'INTERMEDIATE', '18 min', 'Dùng đệ quy để chia bài toán thành trường hợp cơ sở và bài toán nhỏ hơn.', [
    section(9, 1, 'Trường hợp cơ sở và bước đệ quy', [
      'Đệ quy xảy ra khi hàm gọi lại chính nó với dữ liệu nhỏ hơn. Trường hợp cơ sở trả kết quả ngay để dừng; trường hợp đệ quy tiến dần về trường hợp cơ sở.',
      'Nếu thiếu điều kiện dừng hoặc tham số không tiến gần trường hợp cơ sở, hàm có thể gọi lặp đến giới hạn đệ quy.',
    ], 'def factorial(n):\n    if n <= 1:  # Trường hợp cơ sở\n        return 1\n    return n * factorial(n - 1)\n\nprint(factorial(5))', 'Mỗi lời gọi giảm n cho đến khi chạm trường hợp cơ sở.', createChallenge(
      9, 1, 'Tính giai thừa đệ quy', 'Hoàn thiện factorial(n). Với n từ 0 trở lên, trả về tích các số từ 1 đến n.', 'def factorial(n):\n    # Thêm base case và bước đệ quy\n    pass\n', [
        { call: 'factorial(0)', expected: '1' },
        { call: 'factorial(5)', expected: '120' },
      ],
    )),
    section(9, 2, 'Theo dõi các lời gọi', [
      'Có thể hình dung đệ quy như một chồng lời gọi: mỗi lần gọi chờ kết quả từ lời gọi nhỏ hơn, rồi trả kết quả khi lời gọi đó hoàn tất.',
      'Kiểm tra các đầu vào nhỏ trước giúp phát hiện base case thiếu hoặc công thức đệ quy sai.',
    ], 'def sum_to(n):\n    if n <= 0:\n        return 0\n    return n + sum_to(n - 1)\n\nprint(sum_to(4))', 'sum_to(4) rút gọn thành 4 + 3 + 2 + 1 + sum_to(0).', createChallenge(
      9, 2, 'Tính tổng chữ số đệ quy', 'Hoàn thiện digit_sum(n) để trả về tổng các chữ số của số nguyên không âm n.', 'def digit_sum(n):\n    # Dừng ở một chữ số; nếu không, cộng chữ số cuối với phần còn lại\n    pass\n', [
        { call: 'digit_sum(7)', expected: '7' },
        { call: 'digit_sum(5082)', expected: '15' },
      ],
    )),
  ]),
]

export const LESSON_DETAILS: Record<string, LessonDetail> = Object.fromEntries(
  lessonDetails.map((item) => [item.id, item]),
)

export const COURSE_NAV_DATA: CourseNavigation = {
  id: 'python-fundamentals',
  title: 'Python fundamentals',
  description: 'A beginner-to-intermediate Python path.',
  totalLessons: lessonDetails.length,
  completedLessons: 0,
  modules: [
    {
      id: 'module-01', number: '01', title: 'BEGINNER',
      lessons: lessonDetails.slice(0, 6).map((item) => ({
        id: item.id, number: String(item.lessonNumber).padStart(2, '0'), title: item.topic,
        duration: item.duration, status: 'upcoming',
      })),
    },
    {
      id: 'module-02', number: '02', title: 'INTERMEDIATE',
      lessons: lessonDetails.slice(6).map((item) => ({
        id: item.id, number: String(item.lessonNumber).padStart(2, '0'), title: item.topic,
        duration: item.duration, status: 'upcoming',
      })),
    },
  ],
}
