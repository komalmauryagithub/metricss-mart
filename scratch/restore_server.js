const fs = require('fs');
const text = fs.readFileSync('server.js', 'utf8');

const bMarker = 'rue });\r\nprocess.env.TZ = "Asia/Kolkata";';
const parts = text.split(bMarker);

// text is A + BMarker + BRest1 + BMarker + BRest2 + BMarker + BRest3 + D
// parts[0] is A (should be "require('dotenv').config({ override: t")
// parts[1] is BRest1
// parts[2] is BRest2
// parts[3] is BRest3 + D

console.log("Length of A:", parts[0].length);
console.log("Length of BRest1:", parts[1].length);
console.log("Length of BRest2:", parts[2].length);
console.log("Length of BRest3+D:", parts[3].length);

if (parts[1] === parts[2] && parts[3].startsWith(parts[1])) {
    console.log("Structure verified! A + B + B + B + D");
    
    // Original file is A + BMarker + BRest1 + D
    const original = parts[0] + bMarker + parts[1] + parts[3].substring(parts[1].length);
    fs.writeFileSync('server.js', original);
    console.log("Restored original server.js!");
} else {
    console.log("Structure doesn't match perfectly. Let's check differences.");
    console.log(parts[1].substring(0, 100));
    console.log(parts[2].substring(0, 100));
    console.log(parts[3].substring(0, 100));
}
