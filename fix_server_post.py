import os

with open('server.js', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Change the route definition
content = content.replace(
    'app.post("/api/profile-setup/:token", (req, res) => {',
    'app.post(["/api/profile-setup/:token", "/api/employee/profile-setup/:id"], (req, res) => {'
)

# 2. Change the token check
old_token_check = '''    const token = String(req.params.token || "").trim();
    if (!token) {
      return res.status(400).json({
        success: false,
        message: "Missing profile setup token",
      });
    }'''

new_token_check = '''    const token = req.params.token ? String(req.params.token).trim() : null;
    const userId = req.params.id ? parseInt(req.params.id, 10) : null;
    if (!token && !userId) {
      return res.status(400).json({
        success: false,
        message: "Missing profile setup identifier",
      });
    }'''

content = content.replace(old_token_check, new_token_check)

# 3. Change the user fetching
old_user_fetch = '''      await ensureUserProfileSetupColumns();
      await ensureUserRegistrationColumns();
      const user = await getProfileSetupUserByToken(token);'''

new_user_fetch = '''      await ensureUserProfileSetupColumns();
      await ensureUserRegistrationColumns();
      let user = null;
      if (token) {
        user = await getProfileSetupUserByToken(token);
      } else {
        const [rows] = await dbPromise.query("SELECT * FROM users WHERE id = ? LIMIT 1", [userId]);
        user = rows.length ? rows[0] : null;
      }'''

content = content.replace(old_user_fetch, new_user_fetch)

with open('server.js', 'w', encoding='utf-8') as f:
    f.write(content)

print("Updated server.js POST profile-setup route")
