import re

with open('tme.html', 'r', encoding='utf-8') as f:
    content = f.read()

start_idx = content.find('gst-summary-ribbon')
snippet = content[start_idx-200:start_idx+1500]
print(snippet)
