import sqlite3
import hashlib
import datetime
import csv
import sqlite3_util as sq3util
from os import path

DB_PATH = path.normpath("./database/breakfast.db")
BREAKFASTS = sq3util.BREAKFASTS
USERS = sq3util.USERS
ADMINS = sq3util.ADMINS

def load_users(filepath):
    filepath = path.normpath(filepath)
    users = []
    columns = sq3util.USERS_COLUMNS[1::]
    with open(filepath, 'r') as f:
        reader = csv.reader(f)
        users = [{column: field for column, field in zip(columns, fields)} for fields in reader]

    return users

if __name__ == "__main__":
    conn = sqlite3.connect(DB_PATH)

    cursor = conn.cursor()
    cursor.execute("SELECT name FROM sqlite_master;")

    table_names = [el[0] for el in cursor.fetchall()]

    if BREAKFASTS in table_names:
        sq3util.drop_table(cursor, BREAKFASTS)

    if USERS in table_names:
        sq3util.drop_table(cursor, USERS)

    if ADMINS in table_names:
        sq3util.drop_table(cursor, ADMINS)

    sq3util.initialize_users_table(cursor)
    sq3util.initialize_breakfasts_table(cursor)
    sq3util.initialize_admins_table(cursor)
    print("initialized breakfasts, admins and users table")

    pre_loaded_users = load_users('./initial_users.csv')
    for user in pre_loaded_users:
        sq3util.add_user(cursor, sq3util.create_user(**user))

    print("added %d users" % len(pre_loaded_users))

    conn.commit()
    conn.close()
