const fs = require('fs');
let js = fs.readFileSync('dev.js', 'utf8');

js = js.replace(/const res = await fetch\(`\$\{BASE_URL\}\/api\/dev-tasks\?userId=\$\{user\.id\}`\);\s*const data = await res\.json\(\);/g, 
  `const res = await fetch(\`\${BASE_URL}/api/dev-tasks?userId=\${user.id}\`);\n    if (!res.ok) return;\n    const data = await res.json();`);

fs.writeFileSync('dev.js', js);
console.log('Fixed JSON parsing error in dev.js');
