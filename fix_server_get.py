import os

with open('server.js', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace(
    'app.get("/api/me/:id", async (req, res) => {',
    'app.get(["/api/me/:id", "/api/employee/profile-setup/:id"], async (req, res) => {'
)

with open('server.js', 'w', encoding='utf-8') as f:
    f.write(content)

print("Updated server.js GET alias")
