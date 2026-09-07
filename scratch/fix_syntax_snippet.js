const fs = require('fs');

const lines = fs.readFileSync('server.js', 'utf8').split('\n');

const startIdx = lines.findIndex(l => l.includes('WHERE l.id = ?'));
const endIdx = lines.findIndex((l, i) => i > startIdx && l.includes('// ====================== GET ALL LEADS ======================'));

console.log(`Replacing from ${startIdx} to ${endIdx}`);

const before = lines.slice(0, startIdx + 2).join('\n'); // Up to `  \`;`
const after = lines.slice(endIdx).join('\n');

const missingLogic = `
  db.query(sql, [leadId], (err, result) => {
    if (err) {
      console.error("Single Lead Fetch Error:", err);
      return res.status(500).json({ success: false });
    }
    if (result.length === 0) {
      return res.status(404).json({ success: false, message: "Lead not found" });
    }
    res.json({ success: true, data: result[0] });
  });
});
`;

fs.writeFileSync('server.js', before + '\n' + missingLogic + '\n' + after);
console.log('Fixed syntax error in server.js');
