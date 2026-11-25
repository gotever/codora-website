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


def test_unlock_cache_drafts_and_owner(api):
    conn,client,user,lessons=api
    complete(conn,user,lessons[1:])
    assert client.post('/api/assessments').status_code==403
    complete(conn,user,lessons[:1])
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
