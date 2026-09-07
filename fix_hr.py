import os

with open('hr.html', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace('<img id="hrUserAvatar" class="avatar" alt="User Avatar" />', '<img id="hrUserAvatar" class="avatar" alt="User Avatar" onclick="toggleProfileSidebar()" style="cursor: pointer;" title="View Profile Progress" />')

with open('hr.html', 'w', encoding='utf-8') as f:
    f.write(content)
print("Updated hr.html")
