const fs = require('fs');

let js = fs.readFileSync('profile-sidebar.js', 'utf8');

const regex = /let percent = Math\.round\([\s\S]*?const avatarSrc = user\.prof_img \? `\/\$\{user\.prof_img\}` : 'avatar\.png';/m;

const replacement = `
  let percent = Math.round((completedCount / requiredFields.length) * 100);
  if (user.profile_setup_status === "completed") {
    percent = 100;
  }
  
  const isCompleted = user.profile_setup_status === "completed";
  
  let missingHtml = "";
  if (!isCompleted) {
    if (missingItems.length > 0) {
      missingHtml = \\\`
        <div class="ps-missing-list">
          <h5>Pending Details</h5>
          \\\${missingItems.slice(0, 4).map(item => \\\`<div class="ps-missing-item"><i class="fas fa-circle-xmark"></i> \\\${item}</div>\\\`).join('')}
          \\\${missingItems.length > 4 ? \\\`<div class="ps-missing-item" style="color:#64748b;"><i class="fas fa-ellipsis"></i> And \\\${missingItems.length - 4} more</div>\\\` : ''}
        </div>
      \\\`;
    } else {
      missingHtml = \\\`
        <div class="ps-missing-list">
          <div class="ps-missing-item" style="color: #f59e0b;"><i class="fas fa-unlock"></i> Form unlocked for update</div>
        </div>
      \\\`;
    }
  } else {
    missingHtml = \\\`
      <div class="ps-missing-list">
        <div class="ps-missing-item ps-completed-item"><i class="fas fa-circle-check"></i> All required details submitted</div>
      </div>
    \\\`;
  }
  
  const avatarSrc = user.prof_img ? \\\`/\\\${user.prof_img}\\\` : 'avatar.png';
`.replace(/\\`/g, '`').replace(/\\\$/g, '$');

js = js.replace(regex, replacement);

fs.writeFileSync('profile-sidebar.js', js);
console.log('Fixed profile-sidebar.js logic');
