import re
import os

html_files = [f for f in os.listdir('.') if f.endswith('.html')]

for file in html_files:
    with open(file, 'r', encoding='utf-8') as f:
        content = f.read()
        
    modified = False

    # 1. Check if profile-sidebar.css is included
    if 'profile-sidebar.css' not in content:
        # Add before </head>
        content = content.replace('</head>', '    <link rel="stylesheet" href="profile-sidebar.css" />\n  </head>')
        modified = True

    # 2. Check if profile-sidebar.js is included
    if 'profile-sidebar.js' not in content:
        # Add before </body>
        content = content.replace('</body>', '    <script src="profile-sidebar.js"></script>\n  </body>')
        modified = True

    # 3. Add onclick to avatars if not present
    # Usually avatars are: <img id="userAvatar" class="avatar" alt="User Avatar" />
    # Or <img id="hrUserAvatar" ... />
    avatar_pattern = re.compile(r'(<img\s+(?:id="[^"]*userAvatar|id="userAvatar"[^>]*?)class="avatar"[^>]*?)(/?>)', re.IGNORECASE)
    
    def add_attrs(match):
        tag_start = match.group(1)
        tag_end = match.group(2)
        
        new_attrs = ""
        if 'onclick=' not in tag_start:
            new_attrs += ' onclick="toggleProfileSidebar()"'
        if 'style=' not in tag_start:
            new_attrs += ' style="cursor: pointer;"'
        if 'title=' not in tag_start:
            new_attrs += ' title="View Profile"'
            
        return tag_start + new_attrs + tag_end

    new_content = avatar_pattern.sub(add_attrs, content)
    
    if new_content != content:
        content = new_content
        modified = True
        
    # Also check specific admin case which might not match exact string if it has different id
    # Wait, let's just use generic regex for header right side avatar
    admin_avatar = re.compile(r'(<img[^>]*class="avatar"[^>]*>)(?!.*?onclick)', re.IGNORECASE)
    # Actually, the above might be too broad. Let's specifically target the known ones.

    if modified:
        with open(file, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Updated {file}")

print("Done processing HTML files.")
