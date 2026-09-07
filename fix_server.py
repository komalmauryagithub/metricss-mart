import sys

with open('server.js', 'r', encoding='utf-8') as f:
    content = f.read()

table_sql = '''
    CREATE TABLE IF NOT EXISTS seo_daily_work (
      id INT AUTO_INCREMENT PRIMARY KEY,
      assignment_id INT NOT NULL,
      work_date DATE NOT NULL,
      seo_type VARCHAR(100),
      work_category VARCHAR(100),
      task VARCHAR(255),
      page_url VARCHAR(255),
      description TEXT,
      result VARCHAR(255),
      status VARCHAR(50) DEFAULT 'In Progress',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (assignment_id) REFERENCES project_assignments(id) ON DELETE CASCADE
    );
'''

# Find a good place to insert the table creation, maybe near ads_daily_work
idx = content.find("CREATE TABLE IF NOT EXISTS ads_daily_work")
if idx == -1:
    print("Could not find ads_daily_work table creation")
    sys.exit(1)

content = content[:idx] + table_sql + content[idx:]

endpoints = '''
// ================= SEO DAILY WORK API =================
app.get("/api/seo-daily-work/:assignmentId", async (req, res) => {
  try {
    const assignmentId = parseInt(req.params.assignmentId, 10);
    const [rows] = await dbPromise.query("SELECT * FROM seo_daily_work WHERE assignment_id = ? ORDER BY work_date DESC, created_at DESC", [assignmentId]);
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error("GET /api/seo-daily-work error:", err);
    res.status(500).json({ success: false, message: "Database error" });
  }
});

app.post("/api/seo-daily-work", async (req, res) => {
  try {
    const { assignment_id, work_date, seo_type, work_category, task, page_url, description, result, status } = req.body;
    const [insert] = await dbPromise.query(
      "INSERT INTO seo_daily_work (assignment_id, work_date, seo_type, work_category, task, page_url, description, result, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [assignment_id, work_date, seo_type, work_category, task, page_url, description, result, status || 'In Progress']
    );
    res.json({ success: true, id: insert.insertId });
  } catch (err) {
    console.error("POST /api/seo-daily-work error:", err);
    res.status(500).json({ success: false, message: "Database error" });
  }
});

app.put("/api/seo-daily-work/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { work_date, seo_type, work_category, task, page_url, description, result, status } = req.body;
    await dbPromise.query(
      "UPDATE seo_daily_work SET work_date=?, seo_type=?, work_category=?, task=?, page_url=?, description=?, result=?, status=? WHERE id=?",
      [work_date, seo_type, work_category, task, page_url, description, result, status, id]
    );
    res.json({ success: true });
  } catch (err) {
    console.error("PUT /api/seo-daily-work error:", err);
    res.status(500).json({ success: false, message: "Database error" });
  }
});

app.delete("/api/seo-daily-work/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    await dbPromise.query("DELETE FROM seo_daily_work WHERE id=?", [id]);
    res.json({ success: true });
  } catch (err) {
    console.error("DELETE /api/seo-daily-work error:", err);
    res.status(500).json({ success: false, message: "Database error" });
  }
});
'''

# Find a place to insert the endpoints
api_idx = content.find('app.get("/api/employee-seo-assignments/:id"')
if api_idx == -1:
    print("Could not find api endpoint to insert near")
    sys.exit(1)

content = content[:api_idx] + endpoints + "\n\n" + content[api_idx:]

with open('server.js', 'w', encoding='utf-8') as f:
    f.write(content)

print("Updated server.js with seo_daily_work table and endpoints!")
