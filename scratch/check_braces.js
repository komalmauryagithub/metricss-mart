const fs = require('fs');
const code = fs.readFileSync('server.js', 'utf8');

// We can check if it's inside a function by counting braces before it.
let braceCount = 0;
let listenLine = 0;
const lines = code.split('\n');

for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // basic brace counting (ignores strings/comments, but good enough for a rough check)
    const openBraces = (line.match(/\{/g) || []).length;
    const closeBraces = (line.match(/\}/g) || []).length;
    braceCount += openBraces - closeBraces;
    
    if (line.includes('app.listen(PORT')) {
        listenLine = i;
        break;
    }
}
console.log(`At app.listen, brace count is: ${braceCount}`);
