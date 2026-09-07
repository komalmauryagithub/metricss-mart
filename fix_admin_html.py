import os

with open('admin.html', 'r', encoding='utf-8') as f:
    content = f.read()

# Remove onclick from avatar
content = content.replace(
    '<img id="userAvatar" class="avatar" alt="User Avatar"  onclick="toggleProfileSidebar()" style="cursor: pointer;" title="View Profile"/>',
    '<img id="userAvatar" class="avatar" alt="User Avatar" />'
)
content = content.replace(
    '<img id="userAvatar" class="avatar" alt="User Avatar" onclick="toggleProfileSidebar()" style="cursor: pointer;" title="View Profile" />',
    '<img id="userAvatar" class="avatar" alt="User Avatar" />'
)

# Remove profile sidebar includes
content = content.replace('<script src="profile-sidebar.js"></script>', '')
content = content.replace('<link rel="stylesheet" href="profile-sidebar.css" />', '')

with open('admin.html', 'w', encoding='utf-8') as f:
    f.write(content)

print("Removed profile sidebar from admin.html")
