const fs = require('fs');

let js = fs.readFileSync('leave-management.js', 'utf8');

js = js.replace(
    /<td>\$\{renderStatusBadge\(row\.status\)\}<\/td>/g,
    '<td>${renderStatusBadge(row.status)}${row.status !== "pending" && row.admin_reviewer_name ? `<div class="leave-note-text" style="font-size: 11px; margin-top: 4px; color: #64748b; font-weight: 500;">By ${escapeHtml(row.admin_reviewer_name)}</div>` : ""}</td>'
);

fs.writeFileSync('leave-management.js', js);
console.log('Fixed leave-management.js to show reviewer name');
