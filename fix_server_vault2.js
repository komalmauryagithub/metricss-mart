const fs = require('fs');

let content = fs.readFileSync('server.js', 'utf-8');

const tablesSql = `
    CREATE TABLE IF NOT EXISTS seo_logins (
      id INT AUTO_INCREMENT PRIMARY KEY,
      assignment_id INT NOT NULL,
      project_id INT,
      platform_name VARCHAR(255),
      login_url VARCHAR(255),
      username VARCHAR(255),
      password VARCHAR(255),
      notes TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (assignment_id) REFERENCES project_assignments(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS seo_keywords (
      id INT AUTO_INCREMENT PRIMARY KEY,
      assignment_id INT NOT NULL,
      project_id INT,
      keyword VARCHAR(255),
      target_url VARCHAR(255),
      search_volume VARCHAR(100),
      target_rank VARCHAR(100),
      current_rank VARCHAR(100),
      status VARCHAR(100),
      notes TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (assignment_id) REFERENCES project_assignments(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS seo_reports (
      id INT AUTO_INCREMENT PRIMARY KEY,
      assignment_id INT NOT NULL,
      project_id INT,
      title VARCHAR(255),
      report_date DATE,
      file_url VARCHAR(500),
      remarks TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (assignment_id) REFERENCES project_assignments(id) ON DELETE CASCADE
    );
`;

const insertIndex = content.indexOf('CREATE TABLE IF NOT EXISTS seo_daily_work');
content = content.slice(0, insertIndex) + tablesSql + content.slice(insertIndex);

const apiEndpoints = `
// ================= SEO VAULT API =================

app.get("/api/seo-assignments/:assignmentId/logins", async (req, res) => {
  try {
    const [rows] = await dbPromise.query("SELECT * FROM seo_logins WHERE assignment_id = ?", [req.params.assignmentId]);
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: "Database error" });
  }
});

app.post("/api/seo-assignments/:assignmentId/logins", async (req, res) => {
  try {
    const { platform_name, login_url, username, password, notes, project_id } = req.body;
    await dbPromise.query(
      "INSERT INTO seo_logins (assignment_id, project_id, platform_name, login_url, username, password, notes) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [req.params.assignmentId, project_id, platform_name, login_url, username, password, notes]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: "Database error" });
  }
});

app.delete("/api/seo-logins/:id", async (req, res) => {
  try {
    await dbPromise.query("DELETE FROM seo_logins WHERE id = ?", [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: "Database error" });
  }
});

app.get("/api/seo-assignments/:assignmentId/keywords", async (req, res) => {
  try {
    const [rows] = await dbPromise.query("SELECT * FROM seo_keywords WHERE assignment_id = ?", [req.params.assignmentId]);
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: "Database error" });
  }
});

app.post("/api/seo-assignments/:assignmentId/keywords", async (req, res) => {
  try {
    const { keyword, target_url, search_volume, target_rank, current_rank, status, notes, project_id } = req.body;
    await dbPromise.query(
      "INSERT INTO seo_keywords (assignment_id, project_id, keyword, target_url, search_volume, target_rank, current_rank, status, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [req.params.assignmentId, project_id, keyword, target_url, search_volume, target_rank, current_rank, status, notes]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: "Database error" });
  }
});

app.delete("/api/seo-keywords/:id", async (req, res) => {
  try {
    await dbPromise.query("DELETE FROM seo_keywords WHERE id = ?", [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: "Database error" });
  }
});

app.get("/api/seo-assignments/:assignmentId/reports", async (req, res) => {
  try {
    const [rows] = await dbPromise.query("SELECT * FROM seo_reports WHERE assignment_id = ? ORDER BY report_date DESC", [req.params.assignmentId]);
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: "Database error" });
  }
});

app.post("/api/seo-assignments/:assignmentId/reports", async (req, res) => {
  try {
    const { title, report_date, file_url, remarks, project_id } = req.body;
    await dbPromise.query(
      "INSERT INTO seo_reports (assignment_id, project_id, title, report_date, file_url, remarks) VALUES (?, ?, ?, ?, ?, ?)",
      [req.params.assignmentId, project_id, title, report_date || null, file_url, remarks]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: "Database error" });
  }
});

app.delete("/api/seo-reports/:id", async (req, res) => {
  try {
    await dbPromise.query("DELETE FROM seo_reports WHERE id = ?", [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: "Database error" });
  }
});

app.put("/api/seo-assignments/:assignmentId/sheet-url", async (req, res) => {
  try {
    const { sheet_url } = req.body;
    await dbPromise.query("UPDATE project_assignments SET sheet_url = ? WHERE id = ?", [sheet_url, req.params.assignmentId]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: "Database error" });
  }
});

`;

const apiInsertIndex = content.indexOf('// ================= SEO DAILY WORK API =================');
content = content.slice(0, apiInsertIndex) + apiEndpoints + content.slice(apiInsertIndex);

fs.writeFileSync('server.js', content, 'utf-8');
console.log('Added seo vault tables and APIs successfully!');
