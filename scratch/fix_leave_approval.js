const fs = require('fs');

let js = fs.readFileSync('server.js', 'utf8');

const targetFunction = /const adminUser = await ensureAdminAccess\(adminId\);[\s\S]*?const leaveRequest = await getLeaveRequestById\(leaveId\);/;

const replacement = `const adminUser = await getUserRecordById(adminId);
      const role = normalizeRoleValue(adminUser?.role);
      if (!adminUser || (role !== "admin" && role !== "hr")) {
        return res.status(403).json({
          success: false,
          message: "Only admin or HR can approve leaves",
        });
      }
      
      const reviewerNameStr = adminUser.name ? \`\${adminUser.name} (\${role.toUpperCase()})\` : (role === "hr" ? "HR" : "Admin");
      const leaveRequest = await getLeaveRequestById(leaveId);`;

js = js.replace(targetFunction, replacement);

js = js.replace(/requestedStatus === "pending" \? null : adminUser\.name \|\| "Admin"/g, 'requestedStatus === "pending" ? null : reviewerNameStr');

fs.writeFileSync('server.js', js);
console.log('Fixed handleLeaveStatusUpdate to support HR and custom reviewer name');
