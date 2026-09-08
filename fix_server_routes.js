// --- Dev Tasks (DEV Panel) ---
app.get('/api/dev-tasks', async (req, res) => {
  try {
    const { userId } = req.query;
    let sql = 'SELECT * FROM dev_tasks';
    let params = [];
    if (userId) {
      sql += ' WHERE assigned_to = ?';
      params.push(userId);
    }
    sql += ' ORDER BY created_at DESC';
    const [rows] = await dbPromise.query(sql, params);

    // Also fetch progress for each task
    const [progressRows] = await dbPromise.query('SELECT * FROM dev_task_progress ORDER BY created_at ASC');
    const tasks = rows.map(t => {
      t.progress_logs = progressRows.filter(p => p.task_id === t.id);
      return t;
    });

    res.json({ success: true, tasks });
  } catch (err) {
    console.error('GET /api/dev-tasks error:', err);
    res.status(500).json({ success: false, message: 'Database error' });
  }
});

app.post('/api/dev-tasks', async (req, res) => {
  try {
    const { title, description, assigned_by, assigned_to, task_url, task_image } = req.body;
    const sql = 'INSERT INTO dev_tasks (title, description, assigned_by, assigned_to, task_url, task_image, status) VALUES (?, ?, ?, ?, ?, ?, ?)';
    const [result] = await dbPromise.query(sql, [title, description, assigned_by, assigned_to, task_url, task_image, 'Pending']);
    res.json({ success: true, id: result.insertId });
  } catch (err) {
    console.error('POST /api/dev-tasks error:', err);
    res.status(500).json({ success: false, message: 'Database error' });
  }
});

app.put('/api/dev-tasks/:id', async (req, res) => {
  try {
    const { status, leader_remark, leader_remark_by } = req.body;
    let sql = 'UPDATE dev_tasks SET status = ?';
    let params = [status];
    
    if (leader_remark) {
      sql += ', leader_remark = ?, leader_remark_by = ?, leader_remark_at = NOW()';
      params.push(leader_remark, leader_remark_by);
    }
    
    sql += ' WHERE id = ?';
    params.push(req.params.id);
    
    await dbPromise.query(sql, params);
    res.json({ success: true });
  } catch (err) {
    console.error('PUT /api/dev-tasks error:', err);
    res.status(500).json({ success: false, message: 'Database error' });
  }
});

app.post('/api/dev-tasks/:id/progress', async (req, res) => {
  try {
    const { userId, note, urls, images } = req.body;
    const sql = 'INSERT INTO dev_task_progress (task_id, user_id, note, urls, images) VALUES (?, ?, ?, ?, ?)';
    await dbPromise.query(sql, [req.params.id, userId, note, JSON.stringify(urls || []), JSON.stringify(images || [])]);
    
    // Also update task status if passed
    if (req.body.status) {
      await dbPromise.query('UPDATE dev_tasks SET status = ? WHERE id = ?', [req.body.status, req.params.id]);
    }
    
    res.json({ success: true });
  } catch (err) {
    console.error('POST /api/dev-tasks/:id/progress error:', err);
    res.status(500).json({ success: false, message: 'Database error' });
  }
});

// --- Daily Work (Employee Panel) ---
app.get('/api/daily-work/my', async (req, res) => {
  try {
    const { userId, month } = req.query;
    let sql = 'SELECT * FROM daily_work WHERE user_id = ?';
    let params = [userId];
    if (month) {
      sql += ' AND work_date LIKE ?';
      params.push(month + '%');
    }
    sql += ' ORDER BY work_date DESC, created_at DESC';
    const [rows] = await dbPromise.query(sql, params);
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('GET /api/daily-work/my error:', err);
    res.status(500).json({ success: false, message: 'Database error' });
  }
});

app.post('/api/daily-work', async (req, res) => {
  try {
    const { userId, role_snapshot, work_date, client_or_project, status, remarks, work_details } = req.body;
    const sql = 'INSERT INTO daily_work (user_id, role_snapshot, work_date, client_or_project, status, remarks, work_details) VALUES (?, ?, ?, ?, ?, ?, ?)';
    const [result] = await dbPromise.query(sql, [userId, role_snapshot, work_date, client_or_project, status, remarks, JSON.stringify(work_details || {})]);
    res.json({ success: true, id: result.insertId });
  } catch (err) {
    console.error('POST /api/daily-work error:', err);
    res.status(500).json({ success: false, message: 'Database error' });
  }
});

app.put('/api/daily-work/:id', async (req, res) => {
  try {
    const { client_or_project, status, remarks, work_details } = req.body;
    const sql = 'UPDATE daily_work SET client_or_project = ?, status = ?, remarks = ?, work_details = ? WHERE id = ?';
    await dbPromise.query(sql, [client_or_project, status, remarks, JSON.stringify(work_details || {}), req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error('PUT /api/daily-work/:id error:', err);
    res.status(500).json({ success: false, message: 'Database error' });
  }
});
