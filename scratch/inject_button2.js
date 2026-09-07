const fs = require('fs');

const files = ['me.html', 'tme.html', 'hr.html', 'dev.html', 'seo.html', 'accounts.html'];

const buttonHtml = `
        <button onclick="window.location.href='employee-profile.html'" class="complete-profile-btn" style="background:#0d6efd; color:#fff; border:none; padding:8px 15px; border-radius:6px; cursor:pointer; margin-right:15px; font-weight: 500; font-size: 14px; transition: background 0.3s; display: flex; align-items: center; gap: 8px;" onmouseover="this.style.background='#0b5ed7'" onmouseout="this.style.background='#0d6efd'"><i class="fas fa-user-check"></i> Complete Profile</button>
`;

for (const file of files) {
    if (!fs.existsSync(file)) continue;
    
    let html = fs.readFileSync(file, 'utf8');
    
    if (!html.includes('employee-profile.html')) {
        html = html.replace(
            '<button onclick="logout()" class="logout-btn">',
            buttonHtml + '        <button onclick="logout()" class="logout-btn">'
        );
        fs.writeFileSync(file, html);
        console.log(`Added button to ${file}`);
    } else {
        console.log(`Button already exists in ${file}`);
    }
}
