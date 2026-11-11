import os

test_database_url = os.getenv("TEST_DATABASE_URL")
if test_database_url:
    database_name = test_database_url.rsplit("/", 1)[-1].split("?", 1)[0]
    if not database_name.endswith("_test"):
        raise RuntimeError("TEST_DATABASE_URL must point to a database ending in _test")
    os.environ["DATABASE_URL"] = test_database_url
