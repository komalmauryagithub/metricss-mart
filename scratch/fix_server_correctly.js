const fs = require('fs');
let js = fs.readFileSync('server.js', 'utf8');

// 1. Fix handleLeaveStatusUpdate
js = js.replace(
  '      const adminUser = await ensureAdminAccess(adminId);\n      const leaveRequest = await getLeaveRequestById(leaveId);',
  `      const adminUser = await getUserRecordById(adminId);
      const role = normalizeRoleValue(adminUser?.role);
      if (!adminUser || (role !== "admin" && role !== "hr")) {
        return res.status(403).json({ success: false, message: "Only admin or HR can approve leaves" });
      }
      const reviewerNameStr = adminUser.name ? \`\${adminUser.name} (\${role.toUpperCase()})\` : (role === "hr" ? "HR" : "Admin");
      const leaveRequest = await getLeaveRequestById(leaveId);`
);

js = js.replace(/requestedStatus === "pending" \? null : adminUser\.name \|\| "Admin"/g, 'requestedStatus === "pending" ? null : reviewerNameStr');

// 2. Add admin_reviewer_name to SQL select in /api/admin/leaves
js = js.replace(/lr\.leader_user_id,\s*lr\.leader_name,/g, 'lr.leader_user_id,\n          lr.leader_name,\n          lr.admin_reviewer_name,');

fs.writeFileSync('server.js', js);
console.log('Fixed server.js correctly');
