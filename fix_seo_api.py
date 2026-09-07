import re

with open('server.js', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace the dummy seo endpoint with a call to sendSeoProjectAssignments
old_seo_dummy = '''app.get("/api/employee-seo-assignments/:id", (req, res) => {
  res.json({ success: true, projects: [] });
});'''

new_seo_route = '''app.get("/api/employee-seo-assignments/:id", (req, res) => {
  const userId = parseInt(req.params.id, 10);
  sendSeoProjectAssignments(userId, res);
});'''

content = content.replace(old_seo_dummy, new_seo_route)

with open('server.js', 'w', encoding='utf-8') as f:
    f.write(content)
print("Updated seo endpoint alias!")
