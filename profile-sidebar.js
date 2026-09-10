// profile-sidebar.js

document.addEventListener("DOMContentLoaded", () => {
  injectProfileSidebarHtml();
});

function injectProfileSidebarHtml() {
  if (document.getElementById("profileSidebarContainer")) return;

  const html = `
    <div class="profile-sidebar-backdrop" id="psBackdrop" onclick="toggleProfileSidebar()"></div>
    <div class="profile-sidebar-container" id="profileSidebarContainer">
      <div class="ps-header">
        <h3>Profile Overview</h3>
        <button class="ps-close-btn" onclick="toggleProfileSidebar()"><i class="fas fa-xmark"></i></button>
      </div>
      <div class="ps-body" id="psBody">
        <div style="text-align:center; padding: 40px; color: #64748b;">
          <i class="fas fa-spinner fa-spin fa-2x"></i>
          <p style="margin-top:10px;">Loading profile...</p>
        </div>
      </div>
    </div>
  `;
  document.body.insertAdjacentHTML("beforeend", html);
}

async function toggleProfileSidebar() {
  const container = document.getElementById("profileSidebarContainer");
  const backdrop = document.getElementById("psBackdrop");
  
  if (!container || !backdrop) return;

  const isOpen = container.classList.contains("open");
  
  if (isOpen) {
    container.classList.remove("open");
    backdrop.classList.remove("active");
  } else {
    backdrop.classList.add("active");
    container.classList.add("open");
    await fetchAndRenderProfileCompleteness();
  }
}

async function fetchAndRenderProfileCompleteness() {
  const psBody = document.getElementById("psBody");
  const currentUser = JSON.parse(localStorage.getItem("currentUser") || "{}");
  
  if (!currentUser.id) {
    psBody.innerHTML = '<div style="color:red; text-align:center;">User not found</div>';
    return;
  }

  try {
    const res = await fetch(`/api/me/${currentUser.id}`);
    const result = await res.json();
    
    if (!result.success) {
      psBody.innerHTML = '<div style="color:red; text-align:center;">Failed to load data</div>';
      return;
    }
    
    const user = result.user || result.data;
    renderSidebarContent(user);
    
  } catch (err) {
    console.error(err);
    psBody.innerHTML = '<div style="color:red; text-align:center;">Error loading profile</div>';
  }
}

function renderSidebarContent(user) {
  const psBody = document.getElementById("psBody");
  
  // Calculate missing fields
  const requiredFields = [
    { key: "aadhar_no", label: "Aadhar Number" },
    { key: "aadhar_img", label: "Aadhar Card Image" },
    { key: "pan_number", label: "PAN Number" },
    { key: "account_no", label: "Bank Account No." },
    { key: "ifsc_code", label: "Bank IFSC Code" },
    { key: "resume_file", label: "Resume/CV" }
  ];
  
  if (user.profile_type === "experience" || user.total_experience) {
    requiredFields.push({ key: "experience_file", label: "Experience Letter" });
  }
  
  let completedCount = 0;
  const missingItems = [];
  
  requiredFields.forEach(field => {
    if (user[field.key] && String(user[field.key]).trim() !== "") {
      completedCount++;
    } else {
      missingItems.push(field.label);
    }
  });
  
  if (Number(user.pf_enabled) === 1) {
    const pfFields = [
      { key: "pf_number", label: "PF Number" },
      { key: "uan_number", label: "UAN Number" },
      { key: "pf_joining_date", label: "PF Joining Date" }
    ];
    pfFields.forEach(field => {
      requiredFields.push(field);
      if (user[field.key] && String(user[field.key]).trim() !== "") {
        completedCount++;
      } else {
        missingItems.push(field.label);
      }
    });
  }

  let percent = Math.round((completedCount / requiredFields.length) * 100);
  if (user.profile_setup_status === "completed") {
    percent = 100;
  }

  // Inject modal container for full-size profile picture (CIRCLE style)
  if (!document.getElementById('profilePicModal')) {
    const modalHtml = `
      <div id="profilePicModal" style="
        display:none; position:fixed; inset:0; z-index:100000;
        background:rgba(0,0,0,0.75); backdrop-filter:blur(6px);
        align-items:center; justify-content:center;
        opacity:0; transition:opacity 0.3s ease;
      ">
        <div style="position:relative; display:flex; flex-direction:column; align-items:center; gap:16px;">
          <div id="modalImgWrapper" style="
            width:280px; height:280px; border-radius:50%; overflow:hidden;
            border:4px solid rgba(255,255,255,0.3);
            box-shadow:0 0 40px rgba(59,130,246,0.3), 0 8px 32px rgba(0,0,0,0.4);
            transform:scale(0.8); transition:transform 0.3s cubic-bezier(0.34,1.56,0.64,1);
          ">
            <img id="modalImg" src="" alt="Profile Picture" style="
              width:100%; height:100%; object-fit:cover;
            " />
          </div>
          <span id="modalUserName" style="
            color:#fff; font-size:18px; font-weight:600;
            text-shadow:0 2px 8px rgba(0,0,0,0.5);
          "></span>
          <button id="closeModalBtn" style="
            position:absolute; top:-12px; right:-12px;
            background:rgba(255,255,255,0.95); border:none; border-radius:50%;
            width:36px; height:36px; cursor:pointer; font-size:16px; font-weight:bold;
            color:#334155; box-shadow:0 2px 8px rgba(0,0,0,0.2);
            display:flex; align-items:center; justify-content:center;
            transition:transform 0.2s, background 0.2s;
          " onmouseover="this.style.transform='scale(1.1)';this.style.background='#fff'" onmouseout="this.style.transform='scale(1)';this.style.background='rgba(255,255,255,0.95)'">✕</button>
        </div>
      </div>`;
    document.body.insertAdjacentHTML('beforeend', modalHtml);

    // Close handlers
    document.getElementById('closeModalBtn').addEventListener('click', () => {
      closeProfileImageModal();
    });
    document.getElementById('profilePicModal').addEventListener('click', (e) => {
      if (e.target.id === 'profilePicModal') closeProfileImageModal();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeProfileImageModal();
    });

    // Open modal helper
    window.openProfileImageModal = function(src, name) {
      const modal = document.getElementById('profilePicModal');
      const img = document.getElementById('modalImg');
      const wrapper = document.getElementById('modalImgWrapper');
      const nameEl = document.getElementById('modalUserName');
      img.src = src;
      nameEl.textContent = name || '';
      modal.style.display = 'flex';
      requestAnimationFrame(() => {
        modal.style.opacity = '1';
        wrapper.style.transform = 'scale(1)';
      });
    };

    // Close modal helper
    window.closeProfileImageModal = function() {
      const modal = document.getElementById('profilePicModal');
      const wrapper = document.getElementById('modalImgWrapper');
      if (!modal) return;
      modal.style.opacity = '0';
      wrapper.style.transform = 'scale(0.8)';
      setTimeout(() => { modal.style.display = 'none'; }, 300);
    };

    // Global click handler — catches header avatars + sidebar avatar
    document.addEventListener('click', function(e) {
      const target = e.target;
      if (target && (target.matches('img.avatar') || target.matches('img.ps-avatar-lg') || target.matches('#userAvatar') || target.classList.contains('avatar')) && target.src) {
        e.stopPropagation();
        const userNameEl = document.querySelector('.ps-user-details h4') || document.querySelector('#userName') || document.querySelector('.welcome span');
        const name = userNameEl ? userNameEl.textContent.replace(/^Welcome,?\s*/i, '').trim() : '';
        openProfileImageModal(target.src, name);
      }
    });
  }

  const isCompleted = user.profile_setup_status === "completed";
  
  let missingHtml = "";
  if (!isCompleted) {
    if (missingItems.length > 0) {
      missingHtml = `
        <div class="ps-missing-list">
          <h5 style="margin: 0 0 10px 0; font-size: 14px; text-align: left;">Pending Details</h5>
          ${missingItems.slice(0, 4).map(item => `<div class="ps-missing-item" style="text-align: left; margin-bottom: 5px; font-size: 13px;"><i class="fas fa-circle-xmark" style="color: #f43f5e; margin-right: 5px;"></i> ${item}</div>`).join('')}
          ${missingItems.length > 4 ? `<div class="ps-missing-item" style="color:#64748b; text-align: left; font-size: 13px;"><i class="fas fa-ellipsis"></i> And ${missingItems.length - 4} more</div>` : ''}
        </div>
      `;
    } else {
      missingHtml = `
        <div class="ps-missing-list">
          <div class="ps-missing-item" style="color: #f59e0b;"><i class="fas fa-unlock"></i> Form unlocked for update</div>
        </div>
      `;
    }
  } else {
    missingHtml = `
      <div class="ps-missing-list">
        <div class="ps-missing-item ps-completed-item" style="color: #10b981; font-weight: 500;"><i class="fas fa-circle-check"></i> All required details submitted</div>
      </div>
    `;
  }
  
  const fallbackAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name || 'User')}&background=e2e8f0&color=475569`;
  const avatarSrc = user.prof_img ? `/${user.prof_img}` : fallbackAvatar;

  psBody.innerHTML = `
    <div class="ps-user-info" style="margin-bottom: 20px;">
      <img src="${avatarSrc}" class="ps-avatar-lg" onerror="this.src='https://ui-avatars.com/api/?name=User&background=e2e8f0&color=475569'" alt="User" style="cursor:pointer;" title="Click to view profile picture">
      <div class="ps-user-details">
        <h4>${user.name || "Employee"}</h4>
        <p>${user.role ? user.role.toUpperCase() : "STAFF"} &bull; ${user.profile_type === 'experience' ? 'Experienced' : 'Fresher'}</p>
        <span style="display:inline-block; margin-top:5px; padding: 2px 8px; font-size:11px; background:${isCompleted ? '#dcfce7' : '#fef08a'}; color:${isCompleted ? '#166534' : '#854d0e'}; border-radius:10px;">
          ${isCompleted ? 'Profile 100% Complete' : `Profile ${percent}% Complete`}
        </span>
      </div>
    </div>
    
    <!-- OVERVIEW SECTION (Default) -->
    <div id="psOverview" style="display: flex; flex-direction: column; flex: 1;">
      <div class="ps-progress-section">
        <div class="ps-progress-circle" style="background: conic-gradient(#10b981 ${percent}%, #e2e8f0 0%);">
          <div class="ps-progress-inner">
            <span class="ps-percent-text">${percent}%</span>
            <span class="ps-status-text">Completed</span>
          </div>
        </div>
        ${missingHtml}
      </div>
      
      <div style="margin-top: auto; display: flex; flex-direction: column; gap: 10px;">
        <!-- Redirect to Form directly to view details in form format -->
        <a href="employee-profile.html" class="ps-action-btn" style="display:block; text-align:center; background: #3b82f6; color: white; padding: 10px; border-radius: 6px; text-decoration:none;"><i class="fas fa-eye"></i> View Profile Details in Form</a>
        
        ${!isCompleted 
          ? `<a href="employee-profile.html" class="ps-action-btn" style="display:block; text-align:center; background:#f1f5f9; color:#475569; padding:10px; border-radius:6px; text-decoration:none;"><i class="fas fa-arrow-right"></i> Complete Profile Now</a>`
          : ''
        }
      </div>
    </div>
  `;
}

document.addEventListener('DOMContentLoaded', async () => {
  try {
    const userStr = localStorage.getItem('currentUser');
    if (!userStr) return;
    const current = JSON.parse(userStr);
    if (!current.id) return;
    
    const res = await fetch('/api/me/' + current.id);
    const result = await res.json();
    
    if (result.success && result.user) {
      const updated = { ...current, ...result.user };
      localStorage.setItem('currentUser', JSON.stringify(updated));
      
      if (String(updated.role || '').toLowerCase() !== 'admin') {
        const fallbackAvatar = 'https://ui-avatars.com/api/?name=' + encodeURIComponent(updated.name || 'User') + '&background=e2e8f0&color=475569';
        const avatarSrc = updated.prof_img ? '/' + updated.prof_img : fallbackAvatar;
        
        const navAvatar = document.getElementById('userAvatar') || document.querySelector('.profile-pic');
        if (navAvatar) {
          navAvatar.src = avatarSrc;
          navAvatar.onerror = function() { this.src = fallbackAvatar; };
        }
      }
      
      const userNameEl = document.getElementById('userName');
      if (userNameEl) userNameEl.textContent = updated.name || 'Employee';
    }
  } catch(e) {
    console.error('Failed to sync global profile', e);
  }
});
