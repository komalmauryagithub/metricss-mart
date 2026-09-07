const fs = require('fs');
const adminJs = fs.readFileSync('admin.js', 'utf8');
let hrJs = fs.readFileSync('hr.js', 'utf8');

// We need to extract the openUserEditForm and its dependencies from admin.js
// Actually, it's easier to just inject a robust equivalent into hr.js
const hrEditFunctions = `
// ==================== HR USER EDIT LOGIC ====================
let hrCurrentEditUserId = null;

function setUserFieldValue(form, fieldName, value) {
  const element = form.elements[fieldName];
  if (!element) return;
  if (element.type === "checkbox") {
    element.checked = Boolean(value) && value !== "0" && value !== "false";
  } else if (element.tagName === "SELECT") {
    element.value = value;
  } else {
    element.value = value;
  }
}

async function openUserEditForm(userId) {
  hrCurrentEditUserId = userId;
  document.getElementById("userRegistrationTitle").textContent = "Edit Employee";
  
  const unlockBtn = document.getElementById("unlockProfileBtn");
  if (unlockBtn) unlockBtn.style.display = "inline-flex";

  const modal = document.getElementById("userRegistrationModal");
  modal.classList.remove("hidden");
  modal.setAttribute("aria-hidden", "false");
  document.body.classList.add("modal-open");

  const form = document.getElementById("adminRegisterForm");
  form.reset();
  document.getElementById("registerBtn").innerHTML = '<i class="fas fa-floppy-disk"></i> Update Employee';

  try {
    const res = await fetch(\`/api/admin/users/\${userId}\`);
    const result = await res.json();
    
    if (result.success) {
      const user = result.data;
      setUserFieldValue(form, "employee_code", user.employee_code || "");
      setUserFieldValue(form, "name", user.name || "");
      setUserFieldValue(form, "date_of_birth", user.date_of_birth || "");
      setUserFieldValue(form, "gender", user.gender || "");
      setUserFieldValue(form, "nationality", user.nationality || "");
      setUserFieldValue(form, "email", user.email || "");
      setUserFieldValue(form, "contact", user.contact || "");
      setUserFieldValue(form, "alt_contact", user.alt_contact || "");
      setUserFieldValue(form, "address", user.address || "");
      setUserFieldValue(form, "aadhar_no", user.aadhar_no || "");
      setUserFieldValue(form, "pan_number", user.pan_number || "");
      setUserFieldValue(form, "account_no", user.account_no || "");
      setUserFieldValue(form, "bank_name", user.bank_name || "");
      setUserFieldValue(form, "ifsc_code", user.ifsc_code || "");
      setUserFieldValue(form, "beneficiary_name", user.beneficiary_name || "");
      setUserFieldValue(form, "role", String(user.role || "").toLowerCase());
      
      const isTeamLeadCheckbox = document.getElementById("adminRegisterIsTeamLead");
      if (isTeamLeadCheckbox) {
          isTeamLeadCheckbox.checked = Number(user.is_team_lead || 0) === 1;
      }
      
      setUserFieldValue(form, "salary", user.salary != null ? Number(user.salary || 0).toFixed(2) : "");
      setUserFieldValue(form, "compensation_type", user.compensation_type || "salary");
      setUserFieldValue(form, "commission_percent", user.commission_percent != null ? Number(user.commission_percent || 0).toFixed(2) : "");
      setUserFieldValue(form, "joining_date", user.joining_date || "");
      setUserFieldValue(form, "total_experience", user.total_experience || "");
      setUserFieldValue(form, "pf_enabled", Number(user.pf_enabled || 0) ? "1" : "0");
      setUserFieldValue(form, "pf_number", user.pf_number || "");
      setUserFieldValue(form, "uan_number", user.uan_number || "");
      setUserFieldValue(form, "employee_pf_number", user.employee_pf_number || "");
      setUserFieldValue(form, "employer_pf_number", user.employer_pf_number || "");
      setUserFieldValue(form, "pf_joining_date", user.pf_joining_date || "");
      setUserFieldValue(form, "comp_name", user.comp_name || "");
      setUserFieldValue(form, "profile_type", user.profile_type || "fresher");
      setUserFieldValue(form, "login_time", user.login_time || "10:00");
      setUserFieldValue(form, "logout_time", user.logout_time || "18:00");
      setUserFieldValue(form, "spswd", "");
      setUserFieldValue(form, "cpswd", "");
    }
  } catch (err) {
    console.error("Failed to load user data:", err);
  }
}

function closeUserForm() {
  hrCurrentEditUserId = null;
  const modal = document.getElementById("userRegistrationModal");
  modal.classList.add("hidden");
  modal.setAttribute("aria-hidden", "true");
  document.body.classList.remove("modal-open");
  document.getElementById("adminRegisterForm").reset();
}

document.getElementById("adminRegisterForm")?.addEventListener("submit", async function(e) {
  e.preventDefault();
  
  if (!hrCurrentEditUserId) {
    alert("Only editing existing users is supported here.");
    return;
  }
  
  const formData = new FormData(this);
  const registerBtn = document.getElementById("registerBtn");
  const originalText = registerBtn.innerHTML;
  registerBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Updating...';
  registerBtn.disabled = true;

  try {
    const res = await fetch(\`/api/admin/users/\${hrCurrentEditUserId}\`, {
      method: "PUT",
      body: formData
    });
    
    const result = await res.json();
    if (result.success) {
      alert("Employee updated successfully!");
      closeUserForm();
      if (typeof loadHrUsers === "function") loadHrUsers();
      else window.location.reload();
    } else {
      alert(result.message || "Failed to update employee");
    }
  } catch (err) {
    console.error(err);
    alert("An error occurred during update.");
  } finally {
    registerBtn.innerHTML = originalText;
    registerBtn.disabled = false;
  }
});
`;

hrJs += hrEditFunctions;

// Now change the "Edit" button in renderEmployeeDirectory to use openUserEditForm instead of openHrEmployeeProfile, or add a second button
hrJs = hrJs.replace(
  '<button type="button" class="profile-action-btn" onclick="openHrEmployeeProfile(${Number(employee.id)})">\n              View Profile\n            </button>',
  '<button type="button" class="profile-action-btn" onclick="openHrEmployeeProfile(${Number(employee.id)})">\n              View Profile\n            </button>\n            <button type="button" class="profile-action-btn edit-btn" style="background:#f59e0b; margin-left:5px;" onclick="openUserEditForm(${Number(employee.id)})">\n              <i class="fas fa-edit"></i> Edit\n            </button>'
);

fs.writeFileSync('hr.js', hrJs);
console.log('Added HR user edit logic!');
