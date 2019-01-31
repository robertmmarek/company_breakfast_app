import sqlite3
import hashlib
import datetime
import re
from os import path

BREAKFASTS = 'breakfasts'
USERS = 'users'
ADMINS = 'admins'
USERS_COLUMNS = ['hash', 'name', 'surname', 'queue_count']
BREAKFAST_COLUMNS = ['hash', 'done_by', 'date']
ADMINS_COLUMNS = ['login', 'password_hash']
BREAKFAST_DAY = 4 #friday
N_BREAKFASTS = 48 #breakfasts to store in database


"""
Sanitize string to not contain any strange values that could lead to SQL Injection
@str string
@return string
"""
def sanitize_sql_string(string):
    allowFilter = lambda x: False if re.match('[A-Za-z\-0-9]', x)==None else True
    iterable = string.split()
    iterable = list(filter(allowFilter, iterable))
    return "".join(iterable)

def drop_table(cursor, table_name):
    cursor.execute("DROP TABLE "+sanitize_sql_string(table_name)+";")

def initialize_admins_table(cursor, table_name=ADMINS):
    cursor.execute("CREATE TABLE "+sanitize_sql_string(table_name) \
                  +("(%s VARCHAR(255), %s VARCHAR(255));" % tuple([sanitize_sql_string(el) for el in ADMINS_COLUMNS])))

def initialize_users_table(cursor, table_name=USERS):
    cursor.execute("CREATE TABLE "+sanitize_sql_string(table_name) \
                  +("(%s VARCHAR(255), %s VARCHAR(255), %s VARCHAR(255), %s INTEGER);" % tuple([sanitize_sql_string(el) for el in USERS_COLUMNS])))
    add_user(cursor, create_user('NULL', 'NULL'))

def initialize_breakfasts_table(cursor, table_name=BREAKFASTS):
    cursor.execute("CREATE TABLE "+sanitize_sql_string(table_name) \
                +("(%s VARCHAR(255), %s VARCHAR(255), %s DATE);" % tuple([sanitize_sql_string(el) for el in BREAKFAST_COLUMNS])))

    null_user = get_user_by_key(cursor)
    breakfast_dates = _generate_n_breakfast_dates(datetime.date.today(), n=N_BREAKFASTS, breakfast_weekday=BREAKFAST_DAY)

    for date in breakfast_dates:
        add_breakfast(cursor, create_breakfast(date, done_by=null_user['hash']))

"""
add user to USERS table
@cursor - sqlite3 cursor object
@user - dictionary containing user data
@return None
"""
def add_user(cursor, user):
    cursor.execute("INSERT INTO users ("+", ".join([sanitize_sql_string(el) for el in USERS_COLUMNS])+") \
                    VALUES ("+", ".join(["?" for key in USERS_COLUMNS])+");", tuple([user[key] for key in USERS_COLUMNS]))

"""
Select user from table USERS based on specific key and value. 
@cursor sqlite3 cursor object
@key string, column by which object should be searched for - default rowid
@value string, value to look for
@return None if nothing found, dictionary of first element meeting key and value conditions
"""
def get_user_by_key(cursor, key='rowid', value='1'):
    ret = None
    cursor.execute("SELECT * FROM "+sanitize_sql_string(USERS)+" WHERE "+sanitize_sql_string(key)+"=?", (value,))
    found = cursor.fetchone()

    if found != None:
        ret = {key: value for key, value in  zip(USERS_COLUMNS, list(found))}

    return ret

"""
Update user specified by search_dict by values in update_dict
@cursor sqlite3 cursor object
@update_dict values to be updated example: {'name': 'new_name'}
@search_dict keys and values pairs that specify users to update. For example {'surname': 'Kowalsky'}. All requirements must be met to update user
@return None
"""
def update_user(cursor, update_dict, search_dict):
    update_table(cursor, USERS, update_dict, search_dict)

"""
Generate user dictionary object based on passed parameters
@name string
@surname string
@queue_count integer
@return dictionary of user
"""
def create_user(name, surname, queue_count=0):
    ret_dict = {}
    ret_dict['name'] = name
    ret_dict['surname'] = surname
    ret_dict['queue_count'] = int(queue_count)
    ret_dict['hash'] = _hash_user(ret_dict)
    return ret_dict

"""
hash dictionary containing user
@user dictionary containing user data
@return string containing hash
"""
def _hash_user(user):
    hasher = hashlib.md5()
    iterable_keys = sorted([key for key in user.keys()])
    values_string = "".join([str(user[key]) for key in iterable_keys])
    hasher.update(values_string.encode())
    hasher.update(datetime.datetime.now().isoformat().encode())
    return hasher.hexdigest()
"""
create breakfast appointment dictionary
@done_by hash of user who made breakfast. '' or hash of NULL user if not done at all
@date date object
@return dictionary for breakfast
"""
def create_breakfast(date, done_by=''):
    ret_dict = {}
    ret_dict['date'] = date.isoformat()
    ret_dict['done_by'] = done_by
    ret_dict['hash'] = _hash_breakfast(ret_dict)
    return ret_dict

"""
Update breakfast specified by date
@cursor sqlite3 cursor object
@update_dict values to be updated example: {'name': 'new_name'}
@date date object, date of breakfast to be updated
@return None
"""
def update_breakfast(cursor, update_dict, date):
    if isinstance(date, str):
        date = datetime.date.fromisoformat(date)
    update_table(cursor, BREAKFASTS, update_dict, {'date': sanitize_sql_string(date.isoformat())})

"""
add user to USERS table
@cursor - sqlite3 cursor object
@breakfast - dictionary containing breakfast data
@return None
"""
def add_breakfast(cursor, breakfast):
    cursor.execute("INSERT INTO "+sanitize_sql_string(BREAKFASTS)+" ("+", ".join([sanitize_sql_string(el) for el in BREAKFAST_COLUMNS])+") \
                    VALUES ("+", ".join(["?" for key in BREAKFAST_COLUMNS])+");", tuple([breakfast[key] for key in BREAKFAST_COLUMNS]))

"""
delete specified breakfast
@cursor - sqlite3 cursor object
@date - date object
@return None
"""
def _delete_breakfast(cursor, value, key='date'):
    if isinstance(value, datetime.date):
        value = value.isoformat()
    cursor.execute("DELETE FROM "+sanitize_sql_string(BREAKFASTS)+" WHERE "+sanitize_sql_string(key)+"=?;", (value,))

"""
Select user from table BREAKFASTS based on specific key and value. 
@cursor sqlite3 cursor object
@date date object, date of breakfast
@return None if nothing found, dictionary of first element meeting date
"""
def get_breakfast(cursor, date):
    ret = None
    date_string = date.isoformat()
    cursor.execute("SELECT * FROM "+sanitize_sql_string(BREAKFASTS)+" WHERE "+sanitize_sql_string('date')+"=?;", (date_string,))
    found = cursor.fetchone()

    if found != None:
        ret = {key: value for key, value in  zip(BREAKFAST_COLUMNS, list(found))}

    return ret

"""
Update BREAKFASTS table by removing too old breakfasts and preparing new ones
@cursor - sqlite3 cursor object
@total_max - int, total number of rows that should be present in database
@buffer - int, number of weeks, counting from today to end of database that is minimal
@return - None
"""
def cleanup_breakfasts(cursor, buffer=4):
    cursor.execute("SELECT rowid, date FROM "+sanitize_sql_string(BREAKFASTS)+";")
    found = cursor.fetchall()
    found_sorted = sorted(found, key=lambda x: x[0])
    highest_index = int(found_sorted[-1][0])
    highest_breakfast_date = datetime.date.fromisoformat(str(found_sorted[-1][1]))
    breakfast = get_nearest_breakfast(cursor, datetime.date.today())

    cursor.execute("SELECT rowid FROM "+sanitize_sql_string(BREAKFASTS)+" WHERE hash=?;", (breakfast['hash'],))
    newest_index = cursor.fetchone()[0]

    to_delete_from_beginning = max(newest_index-(highest_index-buffer), 0)

    for i in range(0, to_delete_from_beginning):
        _delete_breakfast(cursor, str(i+1), key='rowid')

    to_add = max(0, (N_BREAKFASTS-newest_index)+to_delete_from_beginning)
    new_dates = _generate_n_breakfast_dates(highest_breakfast_date, n=to_add, breakfast_weekday=BREAKFAST_DAY)

    null_user = get_null_user(cursor)

    for d in new_dates:
        add_breakfast(cursor, create_breakfast(d, done_by=null_user['hash']))



"""
hash dictionary containing breakfast
@breakfast dictionary containing breakfast data
@return string, hash for breakfast
"""
def _hash_breakfast(breakfast):
    hasher = hashlib.md5()
    iterable_keys = sorted([key for key in breakfast.keys()])
    values_string = "".join([str(breakfast[key]) for key in iterable_keys])
    hasher.update(values_string.encode())
    hasher.update(datetime.datetime.now().isoformat().encode())
    return hasher.hexdigest()


"""
Update element specified by search_dict by values in update_dict
@cursor sqlite3 cursor object
@table string, table name
@update_dict values to be updated example: {'name': 'new_name'}
@search_dict keys and values pairs that specify users to update. For example {'surname': 'Kowalsky'}. All requirements must be met to update user
@return None
"""
def update_table(cursor, table, update_dict, search_dict):
    condition_keys = [str(key) for key in search_dict.keys()]
    condition_string = "WHERE "+" AND ".join([("%s=?") % sanitize_sql_string(key) for key in condition_keys])

    update_keys = [str(key) for key in update_dict.keys()]
    update_string = ("UPDATE %s SET " % sanitize_sql_string(table))+", ".join([("%s=?" % sanitize_sql_string(key)) for key in update_keys])

    cursor.execute(update_string+" "+condition_string+";", tuple([update_dict[key] for key in update_keys]+[search_dict[key] for key in condition_keys]))


"""
Get breakfast that is the closest one to currently available
@cursor sqlite3 cursor object
@date date object
@return breakfast dictionary
"""
def get_nearest_breakfast(cursor, date):
    date_diff = BREAKFAST_DAY - date.weekday()
    date_diff = 6 - date.weekday() + BREAKFAST_DAY if date_diff < 0 else date_diff
    timedelta = datetime.timedelta(days=date_diff) 
    nearest_breakfast_date = date + timedelta
    next_breakfast = get_breakfast(cursor, nearest_breakfast_date)
    return next_breakfast

"""
Get next user with the lowest number of already made breakfasts
@cursor sqlite3 cursor object
@omit skip X users
"""
def get_next_maker(cursor, omit=0):
    cursor.execute("SELECT * FROM "+sanitize_sql_string(USERS)+" WHERE rowid>1")
    users = [_fetch_to_user(fetch) for fetch in cursor.fetchall()]
    users.sort(key=lambda x: x['queue_count'])
    return users[(0+omit)%len(users)] if len(users) > 0 else None

"""
Confirm that specified user made specific breakfast
@cursor - sqlite3 cursor object
@user - user dictionary
@breakfast - breakfast dictionary
"""
def confirm_user_breakfast(cursor, user, breakfast):
    update_breakfast(cursor, {'done_by': user['hash']}, breakfast['date'])

    if breakfast['done_by'] == get_null_user(cursor)['hash']:
        update_user(cursor, {'queue_count': user['queue_count']+1}, {'hash': user['hash']})
    else:
        previous_maker = get_user_by_key(cursor, key='hash', value=breakfast['done_by'])
        update_user(cursor, {'queue_count': previous_maker['queue_count']-1}, {'hash': previous_maker['hash']})
        update_user(cursor, {'queue_count': user['queue_count']+1}, {'hash': user['hash']})

"""
@cursor - sqlite3 cursor
@return - null user
"""
def get_null_user(cursor):
    return get_user_by_key(cursor)

"""
Add admin to database
@cursor - sqlite3 cursor object
@admin - admin dict compatible with create_admin
@return - None
"""
def add_admin(cursor, admin):
    cursor.execute("SELECT * FROM "+sanitize_sql_string(ADMINS)+" WHERE login=?;", (admin['login'],))
    if len(cursor.fetchall()) > 0:
        raise Exception('This login already exists!')

    cursor.execute("INSERT INTO "+sanitize_sql_string(ADMINS)+" ("+", ".join([sanitize_sql_string(el) for el in ADMINS_COLUMNS])+") \
                    VALUES ("+", ".join(["?" for key in ADMINS_COLUMNS])+");", tuple([admin[key] for key in ADMINS_COLUMNS]))

"""
create dictionary containing admin dict
@cursor - sqlite3 cursor object
@login - string
@plain_password - string
@return dict
"""
def create_admin(login, plain_password):
    hasher = hashlib.md5()
    hasher.update(plain_password.encode())
    return {'login': login, 'password_hash': hasher.hexdigest()}

"""
Check if admin is correct
@cursor - sqlite3 cursor object
@admin - admin dict compatible with create_admin dict
"""
def verify_admin(cursor, admin):
    cursor.execute("SELECT * FROM "+sanitize_sql_string(ADMINS)+" WHERE login=? AND password_hash=?", tuple([admin['login'], admin['password_hash']]))
    return len(cursor.fetchall()) > 0


def _convert_date_to_string(date):
    return date.isoformat()

def _fetch_to_user(user_fetch):
    return {column: value for column, value in zip(USERS_COLUMNS, list(user_fetch))}

def _fetch_to_breakfast(breakfast_fetch):
    return {column: value for column, value in zip(BREAKFAST_COLUMNS, list(breakfast_fetch))}

"""
generate n closest breakfast dates from start_date
@start_date date object
@breakfast_weekday - int
@n int
@return list of date object
"""
def _generate_n_breakfast_dates(start_date, n=48, breakfast_weekday=4):
    date_weekday = start_date.weekday()
    days_difference = datetime.timedelta(days=(breakfast_weekday-date_weekday))
    first_breakfast = start_date + days_difference
    interval_between_breakfasts = datetime.timedelta(days=7)

    breakfast_dates = [first_breakfast+i*interval_between_breakfasts for i in range(0, n)]

    return breakfast_dates
