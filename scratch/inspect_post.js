const fs = require('fs');
const text = fs.readFileSync('server.js', 'utf8');
const idx = text.indexOf('app.post("/register"');
const block = text.substring(idx, idx+8000);
console.log('is_team_lead found in POST?', block.includes('is_team_lead'));
