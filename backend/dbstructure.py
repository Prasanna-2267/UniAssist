from sqlalchemy import create_engine, inspect

DATABASE_URL = "postgresql://postgres:abc-123@localhost:5432/college_portal"
engine = create_engine(DATABASE_URL)

inspector = inspect(engine)

for table in inspector.get_table_names():
    print(f"\n📌 Table: {table}")
    for column in inspector.get_columns(table):
        print(f"   - {column['name']} ({column['type']})")
