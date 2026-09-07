import re

with open('server.js', 'r', encoding='utf-8') as f:
    content = f.read()

new_endpoint = '''app.get("/api/employee-gmb-reports/:id", (req, res) => {
  res.json({ success: true, data: [] });
});
'''

# Find a place to insert it
content = content.replace('app.get("/api/gmb-photo-alerts/:id",', new_endpoint + '\napp.get("/api/gmb-photo-alerts/:id",')

with open('server.js', 'w', encoding='utf-8') as f:
    f.write(content)
print("Added employee-gmb-reports dummy endpoint")
