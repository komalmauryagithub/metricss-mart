const fs = require('fs');

let server = fs.readFileSync('server.js', 'utf8');

const regStart = server.indexOf('app.post("/register"');
const regEnd = server.indexOf('// ====================== FETCH TEAMS ======================', regStart);
if (regStart !== -1 && regEnd !== -1) {
    let route = server.substring(regStart, regEnd);

    // Add profile_type and is_team_lead to INSERT query
    if (!route.includes('is_team_lead,\n        profile_type')) {
        route = route.replace(
            'certification_file\n      )\n      VALUES',
            'certification_file,\n        is_team_lead,\n        profile_type\n      )\n      VALUES'
        );
        route = route.replace(
            '?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            '?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
        );
    }
    
    // Add to params
    if (!route.includes('isTeamLead,\n      profileType')) {
        route = route.replace(
            'resumeFile,\n      experienceFile,\n      certificationFile,\n    ];',
            'resumeFile,\n      experienceFile,\n      certificationFile,\n      isTeamLead,\n      profileType,\n    ];'
        );
    }
    
    server = server.substring(0, regStart) + route + server.substring(regEnd);
    fs.writeFileSync('server.js', server);
    console.log('Fixed /register insert route!');
} else {
    console.log('Could not find /register bounds.');
}
