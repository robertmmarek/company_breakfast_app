import sqlite3
import os
import datetime
import json
import sqlite3_util as sq3ut

from flask import Flask, request

DATABASE = os.path.normpath("./database/breakfast.db")
print(os.path.abspath(DATABASE))

def connect_to_db():
    conn = sqlite3.connect(DATABASE)
    return conn, conn.cursor()

def close_connection_to_db(conn):
    conn.commit()
    conn.close()


cursor = sqlite3.connect(DATABASE)

app = Flask(__name__)

@app.route('/current_breakfast', methods=['GET'])
def current_breakfast():
    if request.method == "GET":
        conn, cursor = connect_to_db()

        null_user = sq3ut.get_null_user(cursor)
        nearest_breakfast = sq3ut.get_nearest_breakfast(cursor, datetime.date.today()) 

        user_that_makes = sq3ut.get_user_by_key(cursor, key='hash', value=nearest_breakfast['done_by'])
        nearest_breakfast['done_by'] = "%s %s" % (user_that_makes['name'], user_that_makes ['surname']) if nearest_breakfast['done_by'] != null_user['hash'] else ''

        close_connection_to_db(conn)
        nearest_breakfast.pop('hash')

        return json.dumps(nearest_breakfast)

@app.route('/<int:to_omit>_in_making_queue', methods=['GET'])
def next_maker(to_omit):
    if request.method == "GET":
        conn, cursor = connect_to_db()
        next_maker = sq3ut.get_next_maker(cursor, omit=to_omit)
        close_connection_to_db(conn)
        return json.dumps(next_maker)

@app.route('/attach_person_from_queue_to_brakfast/<int:which_one>', methods=['POST'])
def confirm_breakfast(which_one):
    login = ''
    password = ''
    try:
        login = request.form['login']
        password = request.form['password']
    except Exception as e:
        print(e)

    correct_logon = False
    
    conn, cursor = connect_to_db()
    correct_logon = sq3ut.verify_admin(cursor, sq3ut.create_admin(login, password))

    breakfast = sq3ut.get_nearest_breakfast(cursor, datetime.date.today())
    user = sq3ut.get_next_maker(cursor, omit=which_one)
    if correct_logon:
        sq3ut.confirm_user_breakfast(cursor, user, breakfast)

    close_connection_to_db(conn)

    return "Correct logon" if correct_logon else "Incorrect logon"
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                



