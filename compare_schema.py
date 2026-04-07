import re
from pathlib import Path

def tables_from(path):
    txt = Path(path).read_text()
    return [m.group(1).strip() for m in re.finditer(r'create table if not exists\s+([\w\.]+)', txt, re.IGNORECASE)]

curr = tables_from('sql/schema.sql')
old = tables_from('sql/schema.sql.bak')
print('CURRENT TABLES:')
print('\n'.join(curr))
print('\nOLD TABLES:')
print('\n'.join(old))
print('\nONLY IN OLD:')
print('\n'.join(sorted(set(old) - set(curr))))
print('\nONLY IN CURRENT:')
print('\n'.join(sorted(set(curr) - set(old))))
