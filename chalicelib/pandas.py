import pandas as pd
from io import StringIO

def pivot_data(cfg, s3, csvfile, contents):
    df = pd.read_csv(StringIO(contents), index_col=0, parse_dates=True)
    dp = pd.pivot_table(df, values=df.columns[1], columns=df.columns[0], index=df.index)
    dp = dp.fillna(0)
    dp = dp.astype(int)
    out = dp.to_csv()
    s3.put_object(Bucket=cfg.bucket, Key=csvfile.replace('.csv', 'Pivot.csv'), Body=str(out).encode('utf-8'), ACL='public-read')
    return out

def normalize_data(cfg, s3, csvfile, contents):
    normal = ''
    data = contents.split('\n')
    for line in data:
        if len(line) > 0:
            if line == data[0]:
                new = line
            else:
                fields = line.split(',')
                types = [ int(l) for l in fields[1:] ]
                new = fields[0] + ',' + ','.join([ str(format(100*t/sum(types),'.2f')) for t in types ])
            normal += new + '\n'
    if normal != '':
        s3.put_object(Bucket=cfg.bucket, Key=csvfile.replace('.csv', 'Normal.csv'), Body=str(normal).encode('utf-8'), ACL='public-read')
        return normal
