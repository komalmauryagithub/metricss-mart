import re

with open('me.js', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace('% by without GST', '% with GST')
content = content.replace('Pending after without GST from', 'Pending from')

with open('me.js', 'w', encoding='utf-8') as f:
    f.write(content)
print("Updated me.js")
