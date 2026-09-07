const fs = require('fs');
let server = fs.readFileSync('server.js', 'utf8');

const regex = /if \(!user\) \{[\s\r\n]*return res\.status\(404\)\.json\(\{[\s\r\n]*success: false,[\s\r\n]*message: "This profile form link is invalid",[\s\r\n]*\}\);[\s\r\n]*\}/g;

server = server.replace(regex, match => {
    return `${match}

      if (user.profile_setup_status === "completed") {
        return res.status(409).json({
          success: false,
          message: "You have already submitted this profile form",
        });
      }`;
});

fs.writeFileSync('server.js', server);
console.log('Fixed backend completed check!');
