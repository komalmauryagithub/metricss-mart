const fs = require('fs');
let text = fs.readFileSync('server.js', 'utf8');

text = text.replace(
    'const isTeamLead = hasBodyField(req.body, "is_team_lead") ? (normalizePayrollBoolean(req.body.is_team_lead) ? 1 : 0) : 0;\n    const isTeamLead = hasBodyField(req.body, "is_team_lead") ? (normalizePayrollBoolean(req.body.is_team_lead) ? 1 : 0) : null;',
    'const isTeamLead = hasBodyField(req.body, "is_team_lead") ? (normalizePayrollBoolean(req.body.is_team_lead) ? 1 : 0) : 0;'
);

text = text.replace(
    'const isTeamLead = hasBodyField(req.body, "is_team_lead") ? (normalizePayrollBoolean(req.body.is_team_lead) ? 1 : 0) : null;\n    const isTeamLead = hasBodyField(req.body, "is_team_lead") ? (normalizePayrollBoolean(req.body.is_team_lead) ? 1 : 0) : 0;',
    'const isTeamLead = hasBodyField(req.body, "is_team_lead") ? (normalizePayrollBoolean(req.body.is_team_lead) ? 1 : 0) : 0;'
);

fs.writeFileSync('server.js', text);
console.log('Fixed duplicate isTeamLead error!');
