const fs = require('fs');
const lines = fs.readFileSync('server.js', 'utf8').split('\n');
for (let i = 7300; i <= 7334; i++) {
    console.log(`${i+1}: ${lines[i]}`);
}
