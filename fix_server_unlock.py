import os

with open('server.js', 'r', encoding='utf-8') as f:
    content = f.read()

unlock_route = '''
app.post("/api/admin/users/:id/unlock-profile", async (req, res) => {
  const userId = Number(req.params.id);
  if (!userId) {
    return res.status(400).json({ success: false, message: "Invalid user id" });
  }
  try {
    const [result] = await dbPromise.query("UPDATE users SET profile_setup_status = 'pending' WHERE id = ?", [userId]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: "User not found" });
    }
    res.json({ success: true, message: "Profile unlocked successfully" });
  } catch (err) {
    console.error("Unlock Profile Error:", err);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
});
'''

content = content.replace(
    'app.post("/api/admin/users/:id/profile-setup-link", async (req, res) => {',
    unlock_route + '\napp.post("/api/admin/users/:id/profile-setup-link", async (req, res) => {'
)

with open('server.js', 'w', encoding='utf-8') as f:
    f.write(content)

print("Injected unlock-profile route")
