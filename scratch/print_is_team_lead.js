const fs = require('fs');
const lines = fs.readFileSync('admin.html', 'utf8').split('\n');
const idx = lines.findIndex(l => l.includes('name="is_team_lead"'));

console.log(lines.slice(idx - 5, idx + 15).join('\n'));
