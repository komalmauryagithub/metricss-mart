const fs = require('fs');
let server = fs.readFileSync('server.js', 'utf8');

// Fix GET /api/admin/users/:id
const getAdminUserRegex = /app\.get\("\/api\/admin\/users\/:id"[\s\S]*?SELECT[\s\S]*?role,/g;
server = server.replace(getAdminUserRegex, match => {
    if (match.includes('profile_type,')) return match;
    return match.replace('role,', 'role,\n          profile_type,');
});

// Fix GET /api/me/:id
const getMeRegex = /app\.get\("\/api\/me\/:id"[\s\S]*?SELECT[\s\S]*?role,/g;
server = server.replace(getMeRegex, match => {
    if (match.includes('profile_type,')) return match;
    return match.replace('role,', 'role,\n          profile_type,');
});

// Also there might be a GET /api/admin/users listing route. Let's just fix it generally anywhere we fetch user details that might need it.
const getUsersRegex = /app\.get\("\/api\/admin\/users"[\s\S]*?SELECT[\s\S]*?role,/g;
server = server.replace(getUsersRegex, match => {
    if (match.includes('profile_type,')) return match;
    return match.replace('role,', 'role,\n            profile_type,');
});

fs.writeFileSync('server.js', server);
console.log('Fixed GET endpoints to return profile_type!');
