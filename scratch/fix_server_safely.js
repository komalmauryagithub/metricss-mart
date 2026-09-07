const fs = require('fs');

const lines = fs.readFileSync('server.js', 'utf8').split('\n');

const fnIndex = lines.findIndex(l => l.includes('async function handleLeaveStatusUpdate(req, res, forcedStatus = "") {'));

if (fnIndex === -1) {
  console.log("Could not find handleLeaveStatusUpdate");
  process.exit(1);
}

// Find the line with `const adminUser = await ensureAdminAccess(adminId);` inside this function
let targetIdx = -1;
for (let i = fnIndex; i < fnIndex + 50; i++) {
  if (lines[i].includes('const adminUser = await ensureAdminAccess(adminId);')) {
    targetIdx = i;
    break;
  }
}

if (targetIdx !== -1) {
  lines[targetIdx] = `      const adminUser = await getUserRecordById(adminId);
      const role = normalizeRoleValue(adminUser?.role);
      if (!adminUser || (role !== "admin" && role !== "hr")) {
        return res.status(403).json({ success: false, message: "Only admin or HR can approve leaves" });
      }
      const reviewerNameStr = adminUser.name ? \`\${adminUser.name} (\${role.toUpperCase()})\` : (role === "hr" ? "HR" : "Admin");`;
}

// Now replace adminUser.name || "Admin" with reviewerNameStr
let queryIdx = -1;
for (let i = targetIdx; i < targetIdx + 50; i++) {
  if (lines[i].includes('requestedStatus === "pending" ? null : adminUser.name || "Admin",')) {
    lines[i] = lines[i].replace('adminUser.name || "Admin"', 'reviewerNameStr');
    break;
  }
}

// Now find the admin leaves query and add admin_reviewer_name
const adminLeavesIdx = lines.findIndex(l => l.includes('app.get("/api/admin/leaves", async (req, res) => {'));
if (adminLeavesIdx !== -1) {
  for (let i = adminLeavesIdx; i < adminLeavesIdx + 200; i++) {
    if (lines[i].includes('lr.leader_user_id,') && lines[i+1].includes('lr.leader_name,')) {
      lines[i+1] = '          lr.leader_name,\n          lr.admin_reviewer_name,';
      break;
    }
  }
}

// Same for HR leaves just in case
const hrLeavesIdx = lines.findIndex(l => l.includes('app.get("/api/hr/leaves", async (req, res) => {'));
if (hrLeavesIdx !== -1) {
  for (let i = hrLeavesIdx; i < hrLeavesIdx + 200; i++) {
    if (lines[i].includes('lr.leader_user_id,') && lines[i+1].includes('lr.leader_name,')) {
      lines[i+1] = '          lr.leader_name,\n          lr.admin_reviewer_name,';
      break;
    }
  }
}

fs.writeFileSync('server.js', lines.join('\n'));
console.log('Fixed server.js safely without regex!');
