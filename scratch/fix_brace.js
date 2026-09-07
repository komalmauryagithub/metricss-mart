const fs = require('fs');
let lines = fs.readFileSync('server.js', 'utf8').split('\n');

// We have:
// 7389:         success: false,
// 7390:         message,
// 7391:       });
// 7392:       });
// 7393:     }

lines.splice(7391, 1); // delete the extra });

fs.writeFileSync('server.js', lines.join('\n'));
console.log('Fixed double brace');
