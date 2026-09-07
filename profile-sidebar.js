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
      <img src="${avatarSrc}" class="ps-avatar-lg" onerror="this.src='https://ui-avatars.com/api/?name=User&background=e2e8f0&color=475569'" alt="User">
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
