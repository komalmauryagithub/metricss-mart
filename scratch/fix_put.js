const fs = require('fs');
let text = fs.readFileSync('server.js', 'utf8');

// Inside app.put("/api/admin/users/:id")

// Find the declarations
const declRegex = /const compName = String\(req\.body\.comp_name \|\| ""\)\.trim\(\);/;
text = text.replace(declRegex, 
`const compName = String(req.body.comp_name || "").trim();
    const isTeamLead = hasBodyField(req.body, "is_team_lead") ? (normalizePayrollBoolean(req.body.is_team_lead) ? 1 : 0) : null;`);

// Find the next declarations
const nextDeclRegex = /const nextCompName = hasBodyField\(req\.body, "comp_name"\)\n\s*\? compName\n\s*: String\(existingUser\.comp_name \|\| ""\)\.trim\(\);/;
text = text.replace(nextDeclRegex, 
`const nextCompName = hasBodyField(req.body, "comp_name")
        ? compName
        : String(existingUser.comp_name || "").trim();
      const nextIsTeamLead = hasBodyField(req.body, "is_team_lead")
        ? isTeamLead
        : Number(existingUser.is_team_lead || 0);`);

// Find the UPDATE query
const updateRegex = /skills = \?,\n\s*salary = \?,\n\s*joining_date = \?,/;
text = text.replace(updateRegex, 
`skills = ?,
            salary = ?,
            joining_date = ?,
            is_team_lead = ?,`);

// Find the parameters for UPDATE query
const paramsRegex = /JSON\.stringify\(nextSkills\),\n\s*Number\(\(nextSalary \|\| 0\)\.toFixed\(2\)\),\n\s*nextJoiningDate,/;
text = text.replace(paramsRegex, 
`JSON.stringify(nextSkills),
            Number((nextSalary || 0).toFixed(2)),
            nextJoiningDate,
            nextIsTeamLead,`);

fs.writeFileSync('server.js', text);
console.log('Fixed PUT /api/admin/users/:id logic!');
