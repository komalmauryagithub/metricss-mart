const fs = require('fs');
let server = fs.readFileSync('server.js', 'utf8');

const schemaRegex = /"ALTER TABLE users ADD COLUMN profile_setup_completed_at datetime DEFAULT NULL AFTER profile_setup_sent_at",\n\s*\];/;
server = server.replace(schemaRegex, `"ALTER TABLE users ADD COLUMN profile_setup_completed_at datetime DEFAULT NULL AFTER profile_setup_sent_at",
        "ALTER TABLE users ADD COLUMN profile_type varchar(20) DEFAULT 'fresher' AFTER profile_setup_completed_at",
      ];`);

fs.writeFileSync('server.js', server);
console.log('Added profile_type to schemaChanges');
