import boto3
import datetime
import os
import json
import psycopg2
import re
import sys

from chalice import Chalice
app = Chalice(app_name=os.path.basename(os.getcwd()))

from chalicelib.pandas import *

class Struct:
    # simple non-recursive dict2obj class
    def __init__(self, **entries):
        self.__dict__.update(entries)

s3 = boto3.client('s3')
settings = json.load(open('chalicelib/settings.json'))
cfg = Struct(**settings)

today = datetime.datetime.now().strftime('%Y/%m/%d')

def test_database_info():
    try:
        data = s3.get_object(Bucket=cfg.bucket, Key=cfg.prefix+cfg.database)
        return json.loads(data['Body'].read().decode('utf-8'))
    except:
        return { 'Error': 'Failed to get database settings'}

def get_database_info():
    try:
        data = s3.get_object(Bucket=cfg.bucket, Key=cfg.prefix+cfg.database)
        conf = json.loads(data['Body'].read().decode('utf-8'))
        db = Struct(**conf)
        con = psycopg2.connect(host=db.host, port=db.port,
                               user=db.user, password=db.password,
                               dbname=db.base)
        return con.cursor()
    except:
        return False

def get_queries():
    queries = []
    listing = s3.list_objects(Bucket=cfg.bucket, Prefix=cfg.prefix)
    for s in listing['Contents']:
        if s['Key'].endswith('.sql'):
            queries.append(s['Key'])
    return queries

def read_query(key):
    try:
        data = s3.get_object(Bucket=cfg.bucket, Key=key)
        return data['Body'].read().decode('utf-8')
    except:
        return None

def get_handles(target):
    key = target.replace('/handle', '/Total.Handles.json')
    try:
        data = s3.get_object(Bucket=cfg.bucket, Key=key)
        return json.loads(data['Body'].read().decode('utf-8'))
    except:
        return [{'id': None}]

def put_handles(csvfile, contents):
    handles = []
    lines = contents.split('\n')
    header = lines[0].split(',')
    for line in lines[1:]:
        if line == '':
            continue
        handle = {}
        row = line.split(',')
        for i in range(len(header)):
            handle[header[i]] = row[i]
        handles.append(handle)
    s3.put_object(Bucket=cfg.bucket, Key=csvfile.replace('.csv', '.json'),
        Body=json.dumps(handles, indent=4).encode('utf-8'))

def run_queries(sqldate = ''):
    cur = get_database_info()
    if not cur:
        return { 'Error': 'Failed to connect to database'}
    previous = get_completed()
    queries = get_queries()
    handler = {}
    for q in queries:
        if q in previous:
            print('Previously completed %s, skipping' % q)
            continue

        print('Processing', q)
        target = q.replace('queries/', '')
        target_dir = os.path.dirname(target)
        target_file = '.'.join(os.path.basename(target).split('.')[:2])
        csvfile = '%s/%s.csv' % (target_dir, target_file)

        handles = [None]
        if os.path.dirname(q).endswith('/handle'):
            if target_dir in handler.keys():
                handles = handler[target_dir]
            else:
                handles = get_handles(target_dir)
                handler[target_dir] = handles
        #print(handles)

        for handle in handles:
            sqlquery = read_query(q)
            if sqlquery:
                if sqldate and sqldate.replace('-', '/') != today:
                    sqlquery = sqlquery.replace('CURRENT_DATE', "DATE('%s')" % sqldate)
                if handle and 'id' in handle.keys():
                    csvfile = '%s/%s.csv' % (target_dir.replace('handle', handle['handle']), target_file)
                    sqlquery = sqlquery.replace('HANDLE_ID', handle['id'])
                cur.execute(sqlquery)
                data = cur.fetchall()

                # use default separator unless conflict, then use alternate
                sep = cfg.separator['default']
                for alt in cfg.separator['pattern']:
                    if alt in q:
                        sep = cfg.separator['alternate']

                contents = ''
                contents += sep.join([d.name for d in cur.description]) + '\n'
                for results in data:
                    contents += sep.join([str(r).replace('\n', '<br>') for r in results]) + '\n'
                if contents.split('\n')[1] == '':
                    print('%s (%s) returned no values' % (target_file, handle['handle']))
                    continue

                if os.path.basename(csvfile).startswith('Total.'):
                    # Redshift does not support psql pivot/crosstab, so using python pandas
                    if '.Pivot.' in q:
                        altered = pivot_data(cfg, s3, csvfile, contents)
                        # C3.js does not handle normalized tables, so normalize the csv data
                        if '.Normal.' in q:
                            normalize_data(cfg, s3, csvfile, altered)
                    if '.Handles.' in q:
                        put_handles(csvfile, contents)
                else:
                    datedir = sqldate.replace('-', '/') if sqldate else today
                    csvfile = '%s/%s/%s' % (os.path.dirname(csvfile), datedir, os.path.basename(csvfile))
                    if '.Pivot.' in q:
                        altered = pivot_data(cfg, s3, csvfile, contents)
                        if '.Normal.' in q:
                            normalize_data(cfg, s3, csvfile, altered)
                s3.put_object(Bucket=cfg.bucket, Key=csvfile, Body=str(contents).encode('utf-8'), ACL='public-read')

        previous.append(q)
        put_completed(previous)
    put_completed([])
    cur.close()

def get_completed():
    try:
        data = s3.get_object(Bucket=cfg.bucket, Key=cfg.prefix+cfg.tracker)
        return json.loads(data['Body'].read().decode('utf-8'))
    except:
        return []

def put_completed(tables):
    s3.put_object(Bucket=cfg.bucket, Key=cfg.prefix+cfg.tracker, Body=json.dumps(tables).encode('utf-8'))

# cron(M H D M DoW Y)
@app.schedule('cron(0 6,16 * * ? *)')
def crontab(event):
    run_queries()

# AWS Lambda function
'''
    lambda_client.invoke(FunctionName='kulapyres3-dev-queue',
                         Payload=json.dumps({'dateserial': yymmdd}),
                         InvocationType='Event', LogType='None')
'''
@app.lambda_function(name='process')
def process_handler(event, context):
    run_queries(event['dateserial'])

# API Gateway routes:
@app.route('/')
def index():
    return {'Lambda': 'Chalice'}

@app.route('/process')
def process():
    run_queries()

@app.route('/process/{yyyymmdd}')
def process_date(dateserial):
    run_queries(dateserial)

if __name__ == '__main__':
    #print(test_database_info())
    if len(sys.argv) > 1:
        run_queries(sys.argv[1])
    else:
        run_queries()
