import os

with open('profile-sidebar.js', 'r', encoding='utf-8') as f:
    content = f.read()

old_avatar_logic = '''      const fallbackAvatar = 'https://ui-avatars.com/api/?name=' + encodeURIComponent(updated.name || 'User') + '&background=e2e8f0&color=475569';
      const avatarSrc = updated.prof_img ? '/' + updated.prof_img : fallbackAvatar;
      
      const navAvatar = document.getElementById('userAvatar') || document.querySelector('.profile-pic');
      if (navAvatar) {
        navAvatar.src = avatarSrc;
        navAvatar.onerror = function() { this.src = fallbackAvatar; };
      }'''

new_avatar_logic = '''      if (String(updated.role || '').toLowerCase() !== 'admin') {
        const fallbackAvatar = 'https://ui-avatars.com/api/?name=' + encodeURIComponent(updated.name || 'User') + '&background=e2e8f0&color=475569';
        const avatarSrc = updated.prof_img ? '/' + updated.prof_img : fallbackAvatar;
        
        const navAvatar = document.getElementById('userAvatar') || document.querySelector('.profile-pic');
        if (navAvatar) {
          navAvatar.src = avatarSrc;
          navAvatar.onerror = function() { this.src = fallbackAvatar; };
        }
      }'''

content = content.replace(old_avatar_logic, new_avatar_logic)

with open('profile-sidebar.js', 'w', encoding='utf-8') as f:
    f.write(content)

print("Fixed admin avatar logic")
