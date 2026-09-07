const fs = require('fs');
const lines = fs.readFileSync('server.js', 'utf8').split('\n');

const getLeads = lines.findIndex(l => l.includes('app.get("/api/leads",'));
const getLeadId = lines.findIndex(l => l.includes('app.get("/api/leads/:id"'));
const postLeads = lines.findIndex(l => l.includes('app.post("/api/leads"'));

console.log('GET /api/leads', getLeads);
console.log('GET /api/leads/:id', getLeadId);
console.log('POST /api/leads', postLeads);
