const fs = require('fs');

const files = ['me.html', 'tme.html', 'hr.html', 'dev.html', 'seo.html', 'accounts.html'];

for (const file of files) {
  if (!fs.existsSync(file)) continue;
  let html = fs.readFileSync(file, 'utf8');
  
  // 1. Inject CSS
  if (!html.includes('profile-sidebar.css')) {
    html = html.replace('</head>', '  <link rel="stylesheet" href="profile-sidebar.css" />\n  </head>');
  }
  
  // 2. Inject JS
  if (!html.includes('profile-sidebar.js')) {
    html = html.replace('</body>', '  <script src="profile-sidebar.js"></script>\n</body>');
  }
  
  // 3. Make userAvatar clickable
  html = html.replace(/<img id="userAvatar" class="avatar" alt="User Avatar" \/>/g, 
    '<img id="userAvatar" class="avatar" alt="User Avatar" onclick="toggleProfileSidebar()" style="cursor: pointer;" title="View Profile Progress" />');
  
  // 4. Remove complete-profile-btn block
  const btnRegex = /<button onclick="window\.location\.href='employee-profile\.html'" class="complete-profile-btn"[\s\S]*?<\/button>/g;
  html = html.replace(btnRegex, '');

  fs.writeFileSync(file, html);
  console.log(`Updated ${file}`);
}
