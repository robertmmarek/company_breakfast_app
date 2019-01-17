import sqlite3
import hashlib
import datetime
import re
from os import path

BREAKFASTS = 'breakfasts'
USERS = 'users'
USERS_COLUMNS = ['hash', 'name', 'surname', 'queue_count']
BREAKFAST_COLUMNS = ['hash', 'done_by', 'date']


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

def initialize_users_table(cursor, table_name):
    cursor.execute("CREATE TABLE "+sanitize_sql_string(table_name) \
                  +("(%s VARCHAR(255), %s VARCHAR(255), %s VARCHAR(255), %s INTEGER);" % tuple([sanitize_sql_string(el) for el in USERS_COLUMNS])))
    add_user(cursor, create_user('NULL', 'NULL'))

def initialize_breakfasts_table(cursor, table_name, breakfast_weekday=4):
    cursor.execute("CREATE TABLE "+sanitize_sql_string(table_name) \
                +("(%s VARCHAR(255), %s VARCHAR(255), %s DATE);" % tuple([sanitize_sql_string(el) for el in BREAKFAST_COLUMNS])))

    null_user = get_user_by_key(cursor)

    today = datetime.date.today()
    today_weekday = today.weekday()
    days_difference = datetime.timedelta(days=breakfast_weekday-today_weekday)
    first_breakfast = today + days_difference
    interval_between_breakfasts = datetime.timedelta(days=7)

    breakfast_dates = [first_breakfast+i*interval_between_breakfasts for i in range(0, 48)]

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
    cursor.execute("SELECT * FROM "+sanitize_sql_string(USERS)+" WHERE "+sanitize_sql_string(key)+"=?", value)
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
    update_table(cursor, 'user', update_dict, search_dict)

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
    ret_dict['hash'] = hash_user(ret_dict)
    return ret_dict

"""
hash dictionary containing user
@user dictionary containing user data
@return string containing hash
"""
def hash_user(user):
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
    ret_dict['hash'] = hash_breakfast(ret_dict)
    return ret_dict

"""
Update breakfast specified by date
@cursor sqlite3 cursor object
@update_dict values to be updated example: {'name': 'new_name'}
@date date object, date of breakfast to be updated
@return None
"""
def update_breakfast(cursor, update_dict, date):
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
Select user from table BREAKFASTS based on specific key and value. 
@cursor sqlite3 cursor object
@date date object, date of breakfast
@return None if nothing found, dictionary of first element meeting date
"""
def get_breakfast(cursor, date):
    ret = None
    date_string = date.isoformat()
    cursor.execute("SELECT * FROM "+sanitize_sql_string(BREAKFASTS)+" WHERE "+sanitize_sql_string('date')+"=?", date_string)
    found = cursor.fetchone()

    if found != None:
        ret = {key: value for key, value in  zip(BREAKFAST_COLUMNS, list(found))}

    return ret

"""
hash dictionary containing breakfast
@breakfast dictionary containing breakfast data
@return string, hash for breakfast
"""
def hash_breakfast(breakfast):
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

