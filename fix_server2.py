import re

with open('server.js', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace schema definition
old_schema = '''    CREATE TABLE IF NOT EXISTS seo_daily_work (
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
    );'''

new_schema = '''    CREATE TABLE IF NOT EXISTS seo_daily_work (
      id INT AUTO_INCREMENT PRIMARY KEY,
      assignment_id INT NOT NULL,
      employee_id INT,
      work_date DATE NOT NULL,
      seo_type VARCHAR(100),
      work_category VARCHAR(100),
      task VARCHAR(255),
      page_url VARCHAR(255),
      description TEXT,
      result VARCHAR(255),
      status VARCHAR(50) DEFAULT 'In Progress',
      remarks TEXT,
      time_spent VARCHAR(50),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (assignment_id) REFERENCES project_assignments(id) ON DELETE CASCADE
    );'''

content = content.replace(old_schema, new_schema)

# Replace endpoints
old_post = '''app.post("/api/seo-daily-work", async (req, res) => {
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
});'''

new_post = '''app.post("/api/seo-daily-work", async (req, res) => {
  try {
    const { seo_assignment_id, employee_id, work_date, seo_type, work_category, task, page_url, description, result, status, remarks, time_spent } = req.body;
    const [insert] = await dbPromise.query(
      "INSERT INTO seo_daily_work (assignment_id, employee_id, work_date, seo_type, work_category, task, page_url, description, result, status, remarks, time_spent) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [seo_assignment_id || req.body.assignment_id, employee_id, work_date, seo_type, work_category, task, page_url, description, result, status || 'In Progress', remarks, time_spent]
    );
    res.json({ success: true, id: insert.insertId });
  } catch (err) {
    console.error("POST /api/seo-daily-work error:", err);
    res.status(500).json({ success: false, message: "Database error" });
  }
});'''

content = content.replace(old_post, new_post)

old_put = '''app.put("/api/seo-daily-work/:id", async (req, res) => {
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
});'''

new_put = '''app.put("/api/seo-daily-work/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { work_date, seo_type, work_category, task, page_url, description, result, status, remarks, time_spent } = req.body;
    await dbPromise.query(
      "UPDATE seo_daily_work SET work_date=?, seo_type=?, work_category=?, task=?, page_url=?, description=?, result=?, status=?, remarks=?, time_spent=? WHERE id=?",
      [work_date, seo_type, work_category, task, page_url, description, result, status, remarks, time_spent, id]
    );
    res.json({ success: true });
  } catch (err) {
    console.error("PUT /api/seo-daily-work error:", err);
    res.status(500).json({ success: false, message: "Database error" });
  }
});'''

content = content.replace(old_put, new_put)

with open('server.js', 'w', encoding='utf-8') as f:
    f.write(content)
print("Updated server.js schema and endpoints!")
