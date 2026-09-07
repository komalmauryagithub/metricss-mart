const fs = require('fs');
const lines = fs.readFileSync('server.js', 'utf8').split('\n');
lines.forEach((l, i) => { if (l.includes('is_team_lead')) console.log(i+1, l); })
