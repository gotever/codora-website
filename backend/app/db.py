from contextlib import contextmanager

from psycopg.rows import dict_row
from psycopg_pool import ConnectionPool

from .settings import settings

pool = ConnectionPool(settings.database_url, min_size=1, max_size=10, kwargs={"row_factory": dict_row}, open=False)


@contextmanager
def connection():
    with pool.connection() as conn:
        yield conn
