const fs = require('fs');
let server = fs.readFileSync('server.js', 'utf8');

const newEndpoint = `
// ====================== UNLOCK PROFILE SETUP ======================
app.post("/api/admin/users/:userId/unlock-profile", async (req, res) => {
  const userId = Number(req.params.userId);
  if (!userId) {
    return res.status(400).json({ success: false, message: "Missing user ID" });
  }

  try {
    const [result] = await dbPromise.query(
      "UPDATE users SET profile_setup_status = 'pending' WHERE id = ?",
      [userId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    res.json({ success: true, message: "Profile form has been unlocked for this user" });
  } catch (err) {
    console.error("Unlock Profile Error:", err);
    res.status(500).json({ success: false, message: "Failed to unlock profile form" });
  }
});
`;

const insertPoint = server.indexOf('// ====================== FETCH TEAMS ======================');
if (insertPoint !== -1) {
    server = server.substring(0, insertPoint) + newEndpoint + '\n' + server.substring(insertPoint);
    fs.writeFileSync('server.js', server);
    console.log('Added unlock-profile endpoint!');
} else {
    console.log('Could not find insert point.');
}
