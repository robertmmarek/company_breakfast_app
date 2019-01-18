import argparse
import sqlite3
import sqlite3_util as sq3util
import sys
import os

ADMIN_ACTIONS = {'add': lambda login, password: add_admin(login, password)}

def add_admin(login, password):
    conn = sqlite3.connect(os.path.normpath('./database/breakfast.db'))
    cursor = conn.cursor()
    try:
        sq3util.add_admin(cursor, sq3util.create_admin(cursor, login, password))
    except Exception as e:
        print(e)

    conn.commit()
    conn.close()

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("-login", nargs=1, help="admin login", required=True)
    parser.add_argument("-password", nargs=1, help="password for admin user", required=True)
    parser.add_argument("-action", nargs=1, help="action to make, available",  choices=ADMIN_ACTIONS.keys(), required=True)

    args = parser.parse_args()

    login = args.login[0]
    password = args.password[0]
    
    ADMIN_ACTIONS[args.action[0]](login, password)
