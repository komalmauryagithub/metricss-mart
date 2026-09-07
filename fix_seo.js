const fs = require('fs');
let content = fs.readFileSync('seo.js', 'utf-8');

content = content.replace(/openSeoWork\('\$\{proj\.id\}'/g, "openSeoWork('${proj.assignment_id || proj.id}'");
content = content.replace(/openProjectSheetAccess\('\$\{proj\.id\}'/g, "openProjectSheetAccess('${proj.project_id || proj.id}'");
content = content.replace(/reactivateSeo\('\$\{proj\.id\}'\)/g, "reactivateSeo('${proj.assignment_id || proj.id}')");
content = content.replace(/submitGmbReportDirectly\('\$\{proj\.id\}'\)/g, "submitGmbReportDirectly('${proj.assignment_id || proj.id}')");
content = content.replace(/extendGmbPostScheduleFromCard\('\$\{proj\.id\}'/g, "extendGmbPostScheduleFromCard('${proj.assignment_id || proj.id}'");

fs.writeFileSync('seo.js', content, 'utf-8');
console.log("Replaced successfully!");
