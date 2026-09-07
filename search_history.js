const fs = require('fs');
const path = require('path');
const historyPath = path.join(process.env.APPDATA, 'Code', 'User', 'History');

function search(dir) {
    const files = fs.readdirSync(dir);
    let results = [];
    for (let file of files) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
            results = results.concat(search(fullPath));
        } else {
            const content = fs.readFileSync(fullPath, 'utf8');
            if (content.includes('ensureAdsDailyWorkTable')) {
                results.push({path: fullPath, mtime: stat.mtimeMs, size: stat.size});
            }
        }
    }
    return results;
}

try {
    let results = search(historyPath);
    results.sort((a, b) => b.mtime - a.mtime);
    console.log('Top results:');
    for (let i = 0; i < Math.min(10, results.length); i++) {
        console.log(results[i]);
    }
} catch (e) {
    console.log(e);
}
