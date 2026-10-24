"""Line-oriented bridge for testing production TypeScript repositories against SQLite."""
import json
import sqlite3
import sys

db = sqlite3.connect(':memory:', isolation_level=None)
db.row_factory = sqlite3.Row
for raw in sys.stdin:
    request = json.loads(raw)
    try:
        sql = request.get('sql', '')
        params = request.get('params', [])
        if request['kind'] == 'exec':
            statement = ''
            for char in sql:
                statement += char
                if char == ';' and sqlite3.complete_statement(statement):
                    db.execute(statement)
                    statement = ''
            if statement.strip():
                db.execute(statement)
            result = None
        else:
            cursor = db.execute(sql, params)
            result = [dict(row) for row in cursor.fetchall()] if request['kind'] == 'all' else {'changes': cursor.rowcount, 'lastInsertRowId': cursor.lastrowid}
        print(json.dumps({'id': request['id'], 'result': result}), flush=True)
    except Exception as error:
        print(json.dumps({'id': request['id'], 'error': str(error)}), flush=True)
