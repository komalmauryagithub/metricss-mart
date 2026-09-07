import re

with open('seo.js', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace the data assignment logic
old_projects = '''const projects = data.data || [];'''
new_projects = '''const projects = data.data || [
            ...(data.assigned || []),
            ...(data.ongoing || []),
            ...(data.completed || [])
        ];'''

content = content.replace(old_projects, new_projects)

with open('seo.js', 'w', encoding='utf-8') as f:
    f.write(content)
print("Updated seo.js to merge assigned, ongoing, and completed arrays!")
