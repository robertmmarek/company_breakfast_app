import sqlite3
import os
import datetime
import json
import sqlite3_util as sq3ut

from flask import Flask, request, session, make_response
from flask_cors import CORS, cross_origin

DATABASE = os.path.normpath("./database/breakfast.db")
print(os.path.abspath(DATABASE))

def connect_to_db():
    conn = sqlite3.connect(DATABASE)
    return conn, conn.cursor()

def close_connection_to_db(conn):
    conn.commit()
    conn.close()

def login_update():
    is_logged = False if not session.get('logged_in') else session['logged_in']
    if is_logged:
        session.modified = True

def make_accessible_from_javascript(text_response):
    response = make_response(text_response)
    response.headers['Access-Control-Allow-Credentials'] = 'true'
    return response


cursor = sqlite3.connect(DATABASE)

app = Flask(__name__)
app.secret_key = os.urandom(16)
app.permanent_session_lifetime = datetime.timedelta(minutes=15)
CORS(app, support_credentials=True)

@app.route('/current_breakfast', methods=['GET'])
@cross_origin()
def current_breakfast():
    if request.method == "GET":
        conn, cursor = connect_to_db()

        null_user = sq3ut.get_null_user(cursor)
        nearest_breakfast = sq3ut.get_nearest_breakfast(cursor, datetime.date.today()) 

        user_that_makes = sq3ut.get_user_by_key(cursor, key='hash', value=nearest_breakfast['done_by'])
        nearest_breakfast['done_by'] = "%s %s" % (user_that_makes['name'], user_that_makes ['surname']) if nearest_breakfast['done_by'] != null_user['hash'] else ''

        close_connection_to_db(conn)
        nearest_breakfast.pop('hash')

        return make_accessible_from_javascript(json.dumps(nearest_breakfast))

@app.route('/<int:to_omit>_in_making_queue', methods=['GET'])
@cross_origin()
def next_maker(to_omit):
    if request.method == "GET":
        conn, cursor = connect_to_db()
        next_maker = sq3ut.get_next_maker(cursor, omit=to_omit)
        close_connection_to_db(conn)

        return make_accessible_from_javascript(json.dumps(next_maker))

@app.route('/get_first_<int:how_many>_in_making_queue', methods=['GET'])
@cross_origin()
def get_first_x_in_making_queue(how_many):
    if request.method == "GET":
        conn, cursor = connect_to_db()

        makers = []
        for i in range(how_many):
            makers.append(sq3ut.get_next_maker(cursor, omit=i))
        
        close_connection_to_db(conn)

        return make_accessible_from_javascript(json.dumps({'queue': makers}))

@app.route('/attach_person_from_queue_to_brakfast/<int:which_one>', methods=['GET'])
@cross_origin()
def confirm_breakfast(which_one):
    login_update()
    success = False

    is_logged = False if 'logged_in' not in session else session['logged_in']

    if is_logged:
        try:
            conn, cursor = connect_to_db()

            breakfast = sq3ut.get_nearest_breakfast(cursor, datetime.date.today())
            user = sq3ut.get_next_maker(cursor, omit=which_one)
            
            sq3ut.confirm_user_breakfast(cursor, user, breakfast)
            sq3ut.cleanup_breakfasts(cursor, buffer=12)

            close_connection_to_db(conn)
        except Exception as e:
            success = False
        else:
            success = True

    return make_accessible_from_javascript(json.dumps({'success': True}) if success else json.dumps({'success': False}))

@app.route('/admin_login', methods=['POST'])
@cross_origin()
def admin_login():
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

    if correct_logon:
        session['logged_in'] = True
        session.pernament = True

    close_connection_to_db(conn)

    return make_accessible_from_javascript(json.dumps({'correct_logon': True}) if correct_logon else json.dumps({'correct_logon': False}))

@app.route('/is_admin_logged', methods=['GET'])
@cross_origin()
def is_admin_logged():
    is_logged = False if 'logged_in' not in session else session['logged_in']
    return make_accessible_from_javascript(json.dumps({'correct_logon': is_logged}))

@app.route('/admin_logout', methods=['GET'])
@cross_origin()
def admin_logout():
    session['logged_in'] = False
    return make_accessible_from_javascript(json.dumps({'correct_logon': False}))
    


@app.route('/add_user', methods=['GET'])
@cross_origin()
def add_user():
    login_update()
    success = False
    
    if session.get('logged_in') and all([key in request.args for key in ['name', 'surname', 'breakfasts_done']]):
        name = request.args['name']
        surname = request.args['surname']
        breakfasts_done = int(request.args['breakfasts_done']) if request.args['breakfasts_done'].isdigit() else 0

        conn, cursor = connect_to_db()
        try:
            sq3ut.add_user(cursor, sq3ut.create_user(name, surname, breakfasts_done))
        except Exception as e:
            success = False
        else:
            success = True     

        close_connection_to_db(conn) 

    return make_accessible_from_javascript(json.dumps({'success': success}))   

@app.route('/delete_user', methods=['GET'])
@cross_origin()
def delete_user():
    login_update()
    success = False
    
    if session.get('logged_in') and all([key in request.args for key in ['hash']]):
        hash = request.args['hash']

        conn, cursor = connect_to_db()
        try:
            sq3ut.delete_user(cursor, hash)
        except Exception as e:
            print(e)
            success = False
        else:
            success = True     

        close_connection_to_db(conn) 

    return make_accessible_from_javascript(json.dumps({'success': success}))  


@app.route('/add_admin', methods=['POST'])
@cross_origin()
def add_admin():
    login_update()
    success = False
    
    if session.get('logged_in') and all([key in request.form for key in ['login', 'password']]):
        login = request.form['login']
        password = request.form['password']

        conn, cursor = connect_to_db()
        try:
            sq3ut.add_admin(cursor, sq3ut.create_admin(login, password))
        except Exception as e:
            success = False
        else:
            success = True     

        close_connection_to_db(conn) 

    return make_accessible_from_javascript(json.dumps({'success': success}))



