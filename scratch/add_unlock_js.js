const fs = require('fs');

for (const file of ['admin.js', 'hr.js']) {
    let js = fs.readFileSync(file, 'utf8');

    // Add function
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
    if (!js.includes('unlockUserProfile')) {
        js += unlockFn;
    }

    // Toggle button in openUserEditForm
    js = js.replace(
        'document.getElementById("adminRegisterModalTitle").textContent = "Edit Employee";',
        'document.getElementById("adminRegisterModalTitle").textContent = "Edit Employee";\n    const unlockBtn = document.getElementById("unlockProfileBtn");\n    if (unlockBtn) unlockBtn.style.display = "inline-flex";'
    );

    // Toggle button in openUserForm (create mode)
    js = js.replace(
        'document.getElementById("adminRegisterModalTitle").textContent = "Add New Employee";',
        'document.getElementById("adminRegisterModalTitle").textContent = "Add New Employee";\n  const unlockBtn = document.getElementById("unlockProfileBtn");\n  if (unlockBtn) unlockBtn.style.display = "none";'
    );

    fs.writeFileSync(file, js);
    console.log(`Updated ${file}`);
}
