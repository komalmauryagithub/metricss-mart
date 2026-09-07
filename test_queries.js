const mysql = require('mysql2');
const db = mysql.createPool({ host: 'localhost', user: 'root', password: '', database: 'mm_new' });
const dbPromise = db.promise();

async function test() {
  try {
    const [rows] = await dbPromise.query(
      `SELECT w.id, w.work_date, w.status, w.remarks, w.description,
              JSON_OBJECT('platform', w.platform,
                          'campaign', w.campaign_name,
                          'work_type', w.work_type,
                          'urls', w.urls) AS work_details,
              u.id AS employee_id,
              COALESCE(u.name, 'Employee') AS employee_name,
              u.role AS employee_role, u.comp_name,
              p.project_name AS client_or_project,
              'ads' AS role_snapshot
       FROM ads_daily_work w
       LEFT JOIN ads_project_assignments p ON w.assignment_id = p.id
       LEFT JOIN users u ON w.employee_id = u.id
       LIMIT 10`
    );
    console.log("ADS WORK SUCCESS");
  } catch(e) { console.error("ADS WORK ERROR", e.message); }

  try {
    const [rows] = await dbPromise.query(
      `SELECT ppd.id, ppd.updated_at AS work_date,
              ppd.status, ppd.notes AS remarks, ppd.notes AS description,
              JSON_OBJECT('work_title', ppd.phase_key,
                          'progress', ppd.progress) AS work_details,
              u.id AS employee_id,
              COALESCE(u.name, 'Employee') AS employee_name,
              u.role AS employee_role, u.comp_name,
              l.company_name AS client_or_project,
              'dev' AS role_snapshot
       FROM project_phase_details ppd
       LEFT JOIN project_assignments pa ON ppd.assignment_id = pa.id
       LEFT JOIN leads l ON pa.project_id = l.id
       LEFT JOIN users u ON pa.user_id = u.id
       LIMIT 10`
    );
    console.log("DEV WORK SUCCESS");
  } catch(e) { console.error("DEV WORK ERROR", e.message); }
  
  process.exit(0);
}
test();
