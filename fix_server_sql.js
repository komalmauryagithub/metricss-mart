const fs = require('fs');

let content = fs.readFileSync('server.js', 'utf-8');

// Find the ensureAdsDailyWorkTable function and rewrite it
const targetRegex = /async function ensureAdsDailyWorkTable\(\) \{\s*await dbPromise\.query\(([\s\S]*?)\);\s*\}/m;

const match = content.match(targetRegex);
if (match) {
    const sql = match[1];
    // Split by semicolons and create individual queries
    const queries = sql.split(';').map(q => q.trim()).filter(q => q.length > 0);
    
    let replacement = 'async function ensureAdsDailyWorkTable() {\n';
    for (const q of queries) {
        replacement += '    await dbPromise.query(' + q + ');\n';
    }
    replacement += '}';
    
    content = content.replace(match[0], replacement);
    fs.writeFileSync('server.js', content, 'utf-8');
    console.log('Fixed ensureAdsDailyWorkTable to use separate queries!');
} else {
    console.log('Could not find ensureAdsDailyWorkTable matching the pattern.');
}
