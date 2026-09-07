const fs = require('fs');
let js = fs.readFileSync('server.js', 'utf8');

js = js.replace(/lr\.leader_user_id,\s*lr\.leader_name,/g, 'lr.leader_user_id,\n          lr.leader_name,\n          lr.admin_reviewer_name,');

fs.writeFileSync('server.js', js);
console.log('Added admin_reviewer_name to SQL select');
