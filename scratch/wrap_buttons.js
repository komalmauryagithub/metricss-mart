const fs = require('fs');

for (const file of ['admin.html', 'hr.html']) {
    let html = fs.readFileSync(file, 'utf8');

    // Find the submit button and the unlock button
    const target = /<button type="submit" class="submit-btn" id="registerBtn">[\s\S]*?<\/button>\s*<button type="button".*?id="unlockProfileBtn".*?>[\s\S]*?<\/button>/;
    
    html = html.replace(target, match => {
        // Strip out the original width/margin styles
        let cleanMatch = match.replace(/margin-left: 10px;/g, '').replace('id="registerBtn"', 'id="registerBtn" style="flex: 1; margin-top: 0;"').replace('id="unlockProfileBtn"', 'id="unlockProfileBtn" style="display: none; flex: 1; background: #f59e0b; color: white; border: none; padding: 18px 20px; border-radius: 12px; cursor: pointer; font-weight: 600; font-size: 16px; text-transform: uppercase; transition: all 0.3s; text-align: center; justify-content: center; align-items: center; gap: 8px; margin-top: 0;"');
        
        return `<div style="display: flex; gap: 12px; width: 100%; margin-top: 18px;">\n${cleanMatch}\n</div>`;
    });
    
    fs.writeFileSync(file, html);
    console.log(`Wrapped buttons in flex container in ${file}`);
}
