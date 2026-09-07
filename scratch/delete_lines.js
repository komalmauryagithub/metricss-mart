const fs = require('fs');
let lines = fs.readFileSync('server.js', 'utf8').split('\n');

// Verify what we are deleting
for(let i = 7392-1; i <= 7405-1; i++){
    console.log(`Deleting: ${lines[i]}`);
}

// Delete lines 7392 to 7405 (which are index 7391 to 7404)
lines.splice(7391, 14);

fs.writeFileSync('server.js', lines.join('\n'));
console.log('Deleted garbled injection!');
