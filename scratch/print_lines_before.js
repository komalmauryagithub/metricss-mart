const fs = require('fs');
const lines = fs.readFileSync('server.js', 'utf8').split('\n');
for (let i = 7335; i <= 7350; i++) {
    console.log(`${i+1}: ${lines[i]}`);
}
