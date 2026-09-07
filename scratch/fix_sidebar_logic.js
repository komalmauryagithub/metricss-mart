const fs = require('fs');

let js = fs.readFileSync('profile-sidebar.js', 'utf8');

js = js.replace(
    'const isCompleted = user.profile_setup_status === "completed" || percent === 100;',
    'const isCompleted = user.profile_setup_status === "completed";'
);

js = js.replace(
    'if (!isCompleted && missingItems.length > 0) {',
    'if (!isCompleted) {'
);

// If percent is 100 but status is pending, missingItems is empty!
// So if (!isCompleted), missingHtml might be empty if missingItems.length == 0.
js = js.replace(
    /if \(\!isCompleted\) \{\s*missingHtml = `\s*<div class="ps-missing-list">/m,
    `if (!isCompleted) {
    if (missingItems.length === 0) {
      missingHtml = \`
        <div class="ps-missing-list">
          <div class="ps-missing-item" style="color: #f59e0b;"><i class="fas fa-unlock"></i> Form is unlocked. You can update your details.</div>
        </div>
      \`;
    } else {
      missingHtml = \`
        <div class="ps-missing-list">`
);

// Wait, the regex might be tricky. Let me just rewrite the missingHtml logic completely.
