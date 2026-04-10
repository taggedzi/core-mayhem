import os

files = [
    'src/banter/index.ts',
    'src/banter/personalities.ts',
]

for fname in files:
    with open(fname, 'r', encoding='utf-8-sig') as f:
        content = f.read()
    content = content.replace('\u2018', "'").replace('\u2019', "'")
    content = content.replace('\u201c', '"').replace('\u201d', '"')
    with open(fname, 'w', encoding='utf-8', newline='\n') as f:
        f.write(content)
    print('Fixed: ' + fname)
