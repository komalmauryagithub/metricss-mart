const fs = require('fs');
let js = fs.readFileSync('admin.js', 'utf8');

js = js.replace(
    'document.getElementById("userRegistrationTitle").textContent = "Edit Employee";',
    'document.getElementById("userRegistrationTitle").textContent = "Edit Employee";\n  const unlockBtn = document.getElementById("unlockProfileBtn");\n  if (unlockBtn) unlockBtn.style.display = "inline-flex";'
);

js = js.replace(
    'document.getElementById("userRegistrationTitle").textContent = "Add New Employee";',
    'document.getElementById("userRegistrationTitle").textContent = "Add New Employee";\n  const unlockBtn = document.getElementById("unlockProfileBtn");\n  if (unlockBtn) unlockBtn.style.display = "none";'
);

// We need the unlockUserProfile function in admin.js too! (I think my previous script added it, let's verify)
if (!js.includes('async function unlockUserProfile')) {
    const unlockFn = `
async function unlockUserProfile() {
  if (!currentEditUserId) return;
  if (!confirm("Are you sure you want to unlock this user's profile setup form? All their currently uploaded files and data will remain intact, but they will be allowed to re-submit the form.")) return;

  try {
    const response = await fetch(\`/api/admin/users/\${currentEditUserId}/unlock-profile\`, {
      method: "POST"
    });
    const result = await response.json();
    if (result.success) {
      alert("Profile unlocked successfully!");
      closeUserForm();
      if (typeof loadAdminUsers === "function") loadAdminUsers();
      if (typeof loadHrUsers === "function") loadHrUsers();
    } else {
      alert(result.message || "Failed to unlock profile");
    }
  } catch (err) {
    console.error("Unlock error:", err);
    alert("An error occurred while unlocking");
  }
}
`;
    js += unlockFn;
}

fs.writeFileSync('admin.js', js);
console.log('Fixed admin.js unlock toggle!');
