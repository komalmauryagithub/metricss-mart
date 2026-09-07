import re

with open('tme.html', 'r', encoding='utf-8') as f:
    content = f.read()

start_idx = content.find('tmeTargetGstAmount')
snippet = content[start_idx-200:start_idx+600]
print(snippet)
