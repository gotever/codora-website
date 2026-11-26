import json
import os
from contextlib import contextmanager
from pathlib import Path
from uuid import uuid4

import psycopg
import pytest
from psycopg import sql
from psycopg.rows import dict_row
from fastapi import HTTPException
from fastapi.testclient import TestClient
from app import assessments as service
from app.main import app
from app.auth import current_user_id
from app.settings import settings


def questions():
    qs = []
    for i in range(1,11):
        coding = i > 7
        q = dict(id=f'q{i}', kind='coding' if coding else sorted(service.KINDS)[(i-1)%4], concept_id='python.test',
                 prompt='Return the supplied number unchanged.', explanation='The value is returned unchanged.',
                 options=[] if coding else [dict(id=str(n),text=str(n)) for n in range(4)])
        if coding:
            q.update(function_name='identity',starter_code='def identity(x):\n    pass',reference_solution='def identity(x):\n    return x',tests=[dict(args=[n],expected=n) for n in range(3)])
        else:
            q['correct_option_id']='1'
        qs.append(service.Question.model_validate(q).model_dump())
    return qs


def test_contract_and_redaction():
    qs=questions()
    service.GeneratedAssessment.model_validate(dict(questions=qs))
    row=dict(id=uuid4(),status='in_progress',score=None,pass_score=8,created_at=None,submitted_at=None,answers={},results=None,questions=qs)
    public=json.dumps(service.public_assessment(row),default=str)
    assert all(secret not in public for secret in ('correct_option_id','reference_solution','"tests"','explanation'))
    with_extra = [{**q, 'type': 'coding' if q['kind'] == 'coding' else 'mcq'} for q in qs]
    validated = service.GeneratedAssessment.model_validate(dict(questions=with_extra))
    assert all('type' not in q for q in validated.model_dump()['questions'])
    qs[0]['kind']='coding'
    with pytest.raises(ValueError): service.GeneratedAssessment.model_validate(dict(questions=qs))


def test_answer_validation():
    for answer in ({'q1':'bad'},{'q11':'1'},{'q8':''}):
        with pytest.raises(HTTPException): service.validate_answers(questions(),answer)
    with pytest.raises(HTTPException): service.validate_answers(questions(),{'q1':'1'},complete=True)


@pytest.fixture
def api(monkeypatch):
    if os.getenv('ASSESSMENT_DB_TEST') != '1': pytest.skip('Set ASSESSMENT_DB_TEST=1 to test in a temporary rollback-only schema')
    with psycopg.connect(settings.database_url,row_factory=dict_row,connect_timeout=3) as conn:
        schema='assessment_'+uuid4().hex+'_test'
        conn.execute(sql.SQL('CREATE SCHEMA {}').format(sql.Identifier(schema)))
        conn.execute(sql.SQL('SET LOCAL search_path TO {},public').format(sql.Identifier(schema)))
        for table in ('users','courses','lessons','learning_concepts','exercises','user_progress','exercise_concepts','ai_chats'):
            conn.execute(sql.SQL('CREATE TABLE {} (LIKE public.{} INCLUDING ALL)').format(sql.Identifier(table),sql.Identifier(table)))
        migration=(Path(__file__).parents[1]/'migrations'/'012_assessments.sql').read_text(encoding='utf-8-sig')
        conn.execute(migration); conn.execute(migration)
        course=conn.execute("INSERT INTO courses(title,order_index) VALUES('Python fundamentals',1) RETURNING id").fetchone()['id']
        lessons=[conn.execute("INSERT INTO lessons(title,course_id,order_index,new_concepts) VALUES(%s,%s,%s,'[\"python.test\"]') RETURNING id",(f'Lesson {n}',course,n)).fetchone()['id'] for n in range(1,8)]
        conn.execute("INSERT INTO learning_concepts(id,name) VALUES('python.test','Test concept')")
        user=str(conn.execute("INSERT INTO users(email,username,password_hash,full_name) VALUES('assessment@example.com','assessment-test','hash','Assessment') RETURNING id").fetchone()['id'])
        @contextmanager
        def connection():
            with conn.transaction(): yield conn
        monkeypatch.setattr(service,'connection',connection)
        monkeypatch.setattr(service,'generate',lambda _:questions())
        monkeypatch.setattr(service,'coding_grade',lambda code,q:dict(passed=3 if 'return x' in code else 0,total=3))
        app.dependency_overrides[current_user_id]=lambda:user
        try: yield conn,TestClient(app),user,lessons
        finally:
            app.dependency_overrides.clear()
            conn.rollback()  # Removes only the schema and fixtures created by this test.


def complete(conn,user,lessons):
    for lesson in lessons:
        conn.execute("INSERT INTO user_progress(user_id,item_type,item_id,status,completed_at) VALUES(%s,'lesson',%s,'completed',now()) ON CONFLICT DO NOTHING",(user,lesson))


def master_concepts(conn, user, lesson_id, count=4, prefix='python.unlock'):
    exercises = [conn.execute(
        "INSERT INTO exercises(lesson_id,title,difficulty,function_name) VALUES(%s,%s,'Easy','f') RETURNING id",
        (lesson_id, f'{prefix}-ex-{n}'),
    ).fetchone()['id'] for n in range(2)]
    for n in range(count):
        concept = f'{prefix}.{n}'
        conn.execute('INSERT INTO learning_concepts(id,name) VALUES(%s,%s) ON CONFLICT DO NOTHING', (concept, concept))
        for exercise in exercises:
            conn.execute('INSERT INTO exercise_concepts(exercise_id,concept_id) VALUES(%s,%s) ON CONFLICT DO NOTHING', (exercise, concept))
    for exercise in exercises:
        conn.execute(
            "INSERT INTO user_progress(user_id,item_type,item_id,status,score,completed_at) VALUES(%s,'exercise',%s,'completed',10,now()) ON CONFLICT DO NOTHING",
            (user, exercise),
        )


def test_eligibility_requires_six_lessons_and_four_mastered_concepts(monkeypatch):
    lessons = [{'id': i, 'course_id': 1, 'title': f'L{i}', 'new_concepts': [], 'preknowledge': [], 'completed': True} for i in range(6)]
    fake_conn = type('FakeConn', (), {
        'execute': lambda self, *_args, **_kwargs: type('Res', (), {'fetchall': lambda self: lessons})(),
    })()

    monkeypatch.setattr(service, 'count_mastered_concepts', lambda *_args: 3)
    _, unlocked = service.eligibility(fake_conn, 'user-1')
    assert unlocked is False

    monkeypatch.setattr(service, 'count_mastered_concepts', lambda *_args: 4)
    _, unlocked = service.eligibility(fake_conn, 'user-1')
    assert unlocked is True


def test_unlock_cache_drafts_and_owner(api):
    conn,client,user,lessons=api
    complete(conn,user,lessons[1:])
    assert client.post('/api/assessments').status_code==403
    complete(conn,user,lessons[:1])
    # All 6 lessons done, but 0 mastered concepts: still locked.
    assert client.post('/api/assessments').status_code==403
    hist = client.get('/api/assessments').json()
    assert hist['unlocked'] is False and hist['completed_count'] == 6 and hist['mastered_count'] == 0
    # 3 mastered concepts: still locked.
    master_concepts(conn, user, lessons[0], count=3, prefix='python.unlock3')
    assert client.post('/api/assessments').status_code==403
    assert client.get('/api/assessments').json()['mastered_count'] == 3
    # Master a 4th concept: unlocked.
    master_concepts(conn, user, lessons[0], count=1, prefix='python.unlock4')
    hist = client.get('/api/assessments').json()
    assert hist['unlocked'] is True and hist['mastered_count'] == 4
    response=client.post('/api/assessments')
    assert response.status_code==200,response.text
    a=response.json(); path='/api/assessments/'+a['id']
    assert len(a['questions'])==10
    assert client.post('/api/assessments').json()['id']==a['id']
    assert client.put(path+'/draft',json={'answers':{'q1':'1'}}).status_code==200
    assert client.get(path).json()['answers']=={'q1':'1'}
    app.dependency_overrides[current_user_id]=lambda:str(uuid4())
    assert client.get(path).status_code==404
    assert client.post(path+'/submit',json={'answers':{}}).status_code==404


def test_submission_retry_history_and_immutable_result(api,monkeypatch):
    conn,client,user,lessons=api
    complete(conn,user,lessons[:6])
    master_concepts(conn, user, lessons[0], count=4, prefix='python.retry')
    a=client.post('/api/assessments').json(); path='/api/assessments/'+a['id']
    answers={q['id']:'def identity(x):\n    return x' if q['kind']=='coding' else '1' for q in questions()}
    def unavailable(*_): raise HTTPException(503,'Unavailable')
    monkeypatch.setattr(service,'coding_grade',unavailable)
    assert client.post(path+'/submit',json={'answers':answers}).status_code==503
    assert client.get(path).json()['status']=='in_progress'
    monkeypatch.setattr(service,'coding_grade',lambda *_:dict(passed=3,total=3))
    result=client.post(path+'/submit',json={'answers':answers})
    assert result.status_code==200,result.text
    assert float(result.json()['score'])==10 and result.json()['status']=='passed'
    assert 'correct_option_id' in result.json()['questions'][0]
    assert 'reference_solution' not in result.text and '"tests"' not in result.text
    assert client.post(path+'/submit',json={'answers':{}}).json()['score']==result.json()['score']
    assert client.put(path+'/draft',json={'answers':{}}).status_code==409
    assert client.post('/api/assessments').json()['id']!=a['id']
    assert len(client.get('/api/assessments').json()['assessments'])==2


def test_failed_test_keeps_beginner(api):
    conn,client,user,lessons=api
    complete(conn,user,lessons[:6])
    master_concepts(conn, user, lessons[0], count=4, prefix='python.fail')
    a=client.post('/api/assessments').json()
    answers={q['id']:'def identity(x):\n    return 99' if q['kind']=='coding' else '0' for q in questions()}
    result=client.post('/api/assessments/'+a['id']+'/submit',json={'answers':answers})
    assert result.status_code==200,result.text
    assert result.json()['status']=='failed' and float(result.json()['score'])==0
    assert conn.execute('SELECT level FROM users WHERE id=%s',(user,)).fetchone()['level']=='beginner'

def test_promotion_requires_pass_and_four_mastered_concepts(api):
    conn,client,user,lessons=api
    complete(conn,user,lessons[:6])
    exercises=[conn.execute("INSERT INTO exercises(lesson_id,title,difficulty,function_name) VALUES(%s,%s,'Easy','f') RETURNING id",(lessons[0],f'Exercise {n}')).fetchone()['id'] for n in range(2)]
    for n in range(4):
        concept=f'python.mastery{n}'
        conn.execute('INSERT INTO learning_concepts(id,name) VALUES(%s,%s)',(concept,concept))
        for exercise in exercises:
            conn.execute('INSERT INTO exercise_concepts(exercise_id,concept_id) VALUES(%s,%s)',(exercise,concept))
    for exercise in exercises:
        conn.execute("INSERT INTO user_progress(user_id,item_type,item_id,status,score,completed_at) VALUES(%s,'exercise',%s,'completed',10,now())",(user,exercise))
    assert service.promote_beginner_after_six_lessons_and_four_mastered_concepts(conn,user) is None
    a=client.post('/api/assessments').json()
    answers={q['id']:'def identity(x):\n    return x' if q['kind']=='coding' else '1' for q in questions()}
    r=client.post('/api/assessments/'+a['id']+'/submit',json={'answers':answers})
    assert r.status_code==200,r.text
    assert conn.execute('SELECT level FROM users WHERE id=%s',(user,)).fetchone()['level']=='intermediate'


def test_generator_json_contract_and_reference_validation(monkeypatch):
    from types import SimpleNamespace
    captured={}
    def create(**kwargs):
        captured.update(kwargs)
        return SimpleNamespace(output_text=json.dumps({'questions':questions()}))
    monkeypatch.setattr(service,'OpenAI',lambda **_:SimpleNamespace(responses=SimpleNamespace(create=create)))
    monkeypatch.setattr(service.settings,'openai_api_key','test-key')
    monkeypatch.setattr(service,'coding_grade',lambda *_:dict(passed=3,total=3))
    assert len(service.generate({'concepts':[{'id':'python.test'}]}))==10
    assert 'JSON' in captured['input']  # Provider requires this in input as well as instructions.
    monkeypatch.setattr(service,'coding_grade',lambda *_:dict(passed=0,total=3))
    with pytest.raises(HTTPException) as error:
        service.generate({'concepts':[{'id':'python.test'}]})
    assert error.value.status_code==502


def test_versioned_lesson_memory_is_in_personalization(api):
    conn,_client,user,lessons=api
    from psycopg.types.json import Jsonb
    memory={f'lesson:{lessons[0]}:python-fundamentals-v2':{'structured':{'concepts_to_practice':['variable types'],'recurring_errors':['confuses strings and numbers']}}}
    conn.execute('UPDATE users SET ai_tutor_memory=%s WHERE id=%s',(Jsonb(memory),user))
    scope,_=service.eligibility(conn,user)
    context=service.build_context(conn,user,scope)
    assert {s['type'] for s in context['error_memory']}=={'concepts_to_practice','recurring_errors'}


@pytest.mark.skipif(os.getenv('ASSESSMENT_RUNNER_TEST')!='1',reason='Run the isolated container grader to enable')
@pytest.mark.parametrize('code,expected,passed',[
 ('def f(x):\n return x',1,1),
 ('def f(x):\n return 99',1,0),
 ('def f(x):\n raise ValueError()',1,0),
 ('def f(x):\n while True: pass',1,0),
 ('import os\ndef f(x):\n return os.getuid()',65534,1),
 ('import socket\ndef f(x):\n try: socket.socket()\n except PermissionError: return True\n return False',True,1),
])
def test_isolated_grader(code,expected,passed):
    result=service.coding_grade(code,{'function_name':'f','tests':[{'args':[1],'expected':expected}]})
    assert result=={'passed':passed,'total':1}


def test_grade_coding_local_behavior():
    q_int = {'function_name': 'f', 'tests': [{'args': [1], 'expected': 1}, {'args': [2], 'expected': 2}]}
    assert service.grade_coding_local('def f(x):\n    return x', q_int) == {'passed': 2, 'total': 2}
    assert service.grade_coding_local('def f(x):\n    return 99', q_int) == {'passed': 0, 'total': 2}
    assert service.grade_coding_local('def f(x):\n    return True', {'function_name': 'f', 'tests': [{'args': [1], 'expected': 1}]}) == {'passed': 0, 'total': 1}
    assert service.grade_coding_local('def f(x):\n    return True', {'function_name': 'f', 'tests': [{'args': [1], 'expected': True}]}) == {'passed': 1, 'total': 1}
    assert service.grade_coding_local('import os\ndef f(x):\n    return x', q_int) == {'passed': 0, 'total': 2}
    assert service.grade_coding_local('def f(x):\n    open("x")\n    return x', q_int) == {'passed': 0, 'total': 2}
    assert service.grade_coding_local('def f(x):\n    while True:\n        pass', {'function_name': 'f', 'tests': [{'args': [1], 'expected': 1}]}) == {'passed': 0, 'total': 1}


def test_coding_grade_local_fallback_flag(monkeypatch):
    import httpx
    q = {'function_name': 'f', 'tests': [{'args': [3], 'expected': 3}]}
    def connect_error(*_args, **_kwargs):
        raise httpx.ConnectError('Connection refused')
    monkeypatch.setattr(service.httpx, 'post', connect_error)

    monkeypatch.setattr(service.settings, 'assessment_runner_local_fallback', False)
    with pytest.raises(HTTPException) as err:
        service.coding_grade('def f(x):\n    return x', q)
    assert err.value.status_code == 503

    monkeypatch.setattr(service.settings, 'assessment_runner_local_fallback', True)
    assert service.coding_grade('def f(x):\n    return x', q) == {'passed': 1, 'total': 1}

    req = httpx.Request('POST', 'http://127.0.0.1:3002/grade')
    resp = httpx.Response(401, request=req)
    def status_error(*_args, **_kwargs):
        return resp
    monkeypatch.setattr(service.httpx, 'post', status_error)
    with pytest.raises(HTTPException) as auth_err:
        service.coding_grade('def f(x):\n    return x', q)
    assert auth_err.value.status_code == 503


def test_question_normalization_accepts_harmless_llm_quirks():
    qs = questions()
    # Normalize MCQ quirks: tests=None, empty coding strings, uppercase Q id, scalar option text, case-insensitive key
    qs[0]['id'] = 'Q1'
    qs[0]['tests'] = None
    qs[0]['function_name'] = ''
    qs[0]['starter_code'] = '   '
    qs[0]['reference_solution'] = ''
    qs[0]['options'] = [{'id': 'A', 'text': 42}, {'id': 'B', 'text': 43}, {'id': 'C', 'text': 44}, {'id': 'D', 'text': 45}]
    qs[0]['correct_option_id'] = 'a'
    # Normalize coding quirks: options=None, empty correct_option_id, integer id
    qs[7]['id'] = 8
    qs[7]['options'] = None
    qs[7]['correct_option_id'] = ''

    validated = service.GeneratedAssessment.model_validate({'questions': qs})
    dumped = validated.model_dump()['questions']
    assert dumped[0]['id'] == 'q1'
    assert dumped[0]['correct_option_id'] == 'A'
    assert dumped[0]['options'][0]['text'] == '42'
    assert dumped[7]['id'] == 'q8'
    assert dumped[7]['options'] == []


def test_generate_retries_once_on_validation_error(monkeypatch):
    from types import SimpleNamespace
    calls = []
    bad = questions()
    bad[0]['concept_id'] = 'python.not_in_context'
    good = questions()

    def create(**kwargs):
        calls.append(kwargs)
        payload = bad if len(calls) == 1 else good
        return SimpleNamespace(output_text=json.dumps({'questions': payload}))

    monkeypatch.setattr(service, 'OpenAI', lambda **_: SimpleNamespace(responses=SimpleNamespace(create=create)))
    monkeypatch.setattr(service.settings, 'openai_api_key', 'test-key')
    monkeypatch.setattr(service, 'coding_grade', lambda *_: {'passed': 3, 'total': 3})

    result = service.generate({'concepts': [{'id': 'python.test'}]})
    assert len(result) == 10
    assert len(calls) == 2
    assert 'previous_attempt_error' in calls[1]['input']
