const fs = require('fs');
let server = fs.readFileSync('server.js', 'utf8');

// getProfileSetupUserById
server = server.replace(
    'SELECT \n        id, \n        name, \n        email, \n        role, \n        comp_name, \n        profile_setup_status,',
    'SELECT \n        id, \n        name, \n        email, \n        role, \n        comp_name, \n        profile_setup_status,\n        profile_type,'
);

// getProfileSetupUserByToken
server = server.replace(
    'SELECT \n          id,\n          name,\n          email,\n          profile_setup_status,',
    'SELECT \n          id,\n          name,\n          email,\n          profile_setup_status,\n          profile_type,'
);

// get users list
// SELECT id, employee_code, name, ... role, comp_name, is_team_lead
server = server.replace(
    'role,\n            comp_name,\n            is_team_lead,',
    'role,\n            comp_name,\n            is_team_lead,\n            profile_type,'
);

fs.writeFileSync('server.js', server);
console.log('Updated SELECT statements');
