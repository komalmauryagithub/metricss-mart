const fs = require('fs');
let html = fs.readFileSync('hr.html', 'utf8');

// First, remove the old injected profile button
const oldBtnRegex = /<button onclick="window\.location\.href='employee-profile\.html'" class="complete-profile-btn"[\s\S]*?<\/button>/;
html = html.replace(oldBtnRegex, '');

// Now wrap the logout button and add the new sleek profile button below it
const logoutRegex = /<button type="button" class="logout-btn" onclick="logout\(\)">[\s\S]*?<\/button>/;
const logoutMatch = html.match(logoutRegex);

if (logoutMatch) {
    const newHtml = `
        <div class="header-action-btns" style="display: flex; flex-direction: column; gap: 8px;">
          ${logoutMatch[0]}
          <button onclick="window.location.href='employee-profile.html'" class="complete-profile-btn" style="background: linear-gradient(135deg, #10b981, #059669); color: white; border: none; padding: 6px 14px; border-radius: 6px; cursor: pointer; font-size: 11px; font-weight: 700; display: flex; align-items: center; justify-content: center; gap: 6px; text-transform: uppercase; letter-spacing: 0.5px; box-shadow: 0 2px 4px rgba(16, 185, 129, 0.25); transition: all 0.3s ease;" onmouseover="this.style.transform='translateY(-1px)'; this.style.boxShadow='0 4px 6px rgba(16, 185, 129, 0.4)';" onmouseout="this.style.transform='none'; this.style.boxShadow='0 2px 4px rgba(16, 185, 129, 0.25)';">
            <i class="fas fa-user-edit"></i> Profile Setup
          </button>
        </div>`;
    
    html = html.replace(logoutMatch[0], newHtml);
    fs.writeFileSync('hr.html', html);
    console.log(`Updated button layout in hr.html`);
} else {
    console.log(`Could not find logout button in hr.html`);
}
