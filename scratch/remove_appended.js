const fs = require('fs');
let server = fs.readFileSync('server.js', 'utf8');

const bannerIdx = server.indexOf('// ==================== IN-APP PROFILE SETUP ====================');
if (bannerIdx !== -1) {
    server = server.substring(0, bannerIdx);
    fs.writeFileSync('server.js', server);
    console.log('Removed all appended routes.');
} else {
    console.log('Banner not found.');
}
