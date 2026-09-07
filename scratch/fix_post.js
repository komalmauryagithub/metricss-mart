const fs = require('fs');
let text = fs.readFileSync('server.js', 'utf8');

// Inside app.post("/register")

// Find the declarations
const declRegex = /const compName = String\(req\.body\.comp_name \|\| ""\)\.trim\(\);/g;
text = text.replace(declRegex, 
`const compName = String(req.body.comp_name || "").trim();
    const isTeamLead = hasBodyField(req.body, "is_team_lead") ? (normalizePayrollBoolean(req.body.is_team_lead) ? 1 : 0) : 0;`);

// Find the INSERT query
const insertRegex = /joining_date,\n\s*total_experience,/;
text = text.replace(insertRegex, 
`joining_date,
          is_team_lead,
          total_experience,`);

// Find the INSERT query values placeholders
const placeholdersRegex = /\?, \?, \?, \?, \?, \?, \?, \?, \?, \?, \?, \?, \?, \?, \?, \?, \?, \?, \?, \?, \?, \?, \?, \?, \?, \?, \?, \?, \?/;
// Wait, this is error prone. Let's find the values list
const valuesRegex = /Number\(\(salary \|\| 0\)\.toFixed\(2\)\),\n\s*joiningDate,/;
text = text.replace(valuesRegex, 
`Number((salary || 0).toFixed(2)),
            joiningDate,
            isTeamLead,`);

// But wait, the placeholders in INSERT query must match! 
// "VALUES (?, ?, ?, ...)" Let's just find the exact string.
const insertSqlRegex = /VALUES \(\?, \?, \?, \?, \?, \?, \?, \?, \?, \?, \?, \?, \?, \?, \?, \?, \?, \?, \?, \?, \?, \?, \?, \?, \?, \?, \?, \?, \?, \?, \?, \?, \?, \?, \?, \?, \?\)/;
text = text.replace(insertSqlRegex, 'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');


fs.writeFileSync('server.js', text);
console.log('Fixed POST /register logic!');
