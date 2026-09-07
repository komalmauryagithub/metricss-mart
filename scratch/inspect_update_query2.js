const fs = require('fs');
const lines = fs.readFileSync('server.js', 'utf8').split('\n');
const start = lines.findIndex(l => l.includes('app.put("/api/admin/users/:id"'));
let updateLine = -1;
for(let i = start; i < start+500; i++) {
   if (lines[i].includes('UPDATE users SET')) {
       updateLine = i;
       break;
   }
}
console.log(lines.slice(updateLine, updateLine+60).join('\n'));
