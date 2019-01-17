import sqlite3
import hashlib
import sqlite3_util as sq3util
from os import path

DB_PATH = path.normpath("./database/breakfast.db")
BREAKFASTS = sq3util.BREAKFASTS
USERS = sq3util.USERS


if __name__ == "__main__":
    conn = sqlite3.connect(DB_PATH)

    cursor = conn.cursor()
    cursor.execute("SELECT name FROM sqlite_master;")

    table_names = [el[0] for el in cursor.fetchall()]

    if BREAKFASTS in table_names:
        sq3util.drop_table(cursor, BREAKFASTS)

    if USERS in table_names:
        sq3util.drop_table(cursor, USERS)

    sq3util.initialize_users_table(cursor, USERS)
    sq3util.initialize_breakfasts_table(cursor, BREAKFASTS)

    conn.commit()
    conn.close()
