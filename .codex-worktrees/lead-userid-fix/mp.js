// mp.js

const BASE_URL =
  window.location.protocol === "file:"
    ? "http://localhost:3000"
    : window.location.origin;

if (window.location.protocol === "file:") {
  window.location.replace(`${BASE_URL}/mp.html`);
}

function showLoginForm() {
  document.getElementById('registerForm').classList.add('hidden');
  document.getElementById('loginForm').classList.remove('hidden');
}

function showRegisterForm() {
  document.getElementById('loginForm').classList.add('hidden');
  document.getElementById('registerForm').classList.remove('hidden');
}

function normalizeCompanyKey(value) {
  const normalized = String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

  if (
    normalized === "redsea" ||
    normalized === "redseadigitals" ||
    normalized === "redseadigitalspvtltd"
  ) {
    return "redsea";
  }

  if (
    normalized === "metrics" ||
    normalized === "metricsmart" ||
    normalized === "metricsmartinfolinepvtltd"
  ) {
    return "metrics";
  }

  return "";
}

function applyLoginCompanyTheme(companyKey) {
  const isRedSea = normalizeCompanyKey(companyKey) === "redsea";
  document.body.classList.toggle("redsea-login", isRedSea);
}

async function parseApiResponse(response) {
  const text = await response.text();
  if (!text) return {};

  try {
    return JSON.parse(text);
  } catch (_error) {
    const normalized = text.trim();
    return {
      success: false,
      message: normalized.startsWith("<")
        ? "Server returned an error page instead of JSON. Please check the live server deployment and logs."
        : normalized.slice(0, 240) || "Invalid response from server",
    };
  }
}

// Popup Functions
function showPopup(title, message, isSuccess) {
  const popup = document.getElementById('popup');
  const icon = document.getElementById('popupIcon');
  const titleEl = document.getElementById('popupTitle');
  const msgEl = document.getElementById('popupMessage');

  titleEl.textContent = title;
  msgEl.textContent = message;

  if (isSuccess) {
    icon.className = 'fas fa-check-circle';
    icon.style.color = document.body.classList.contains("redsea-login")
      ? '#ef4444'
      : '#0f766e';
  } else {
    icon.className = 'fas fa-exclamation-circle';
    icon.style.color = '#ef4444';
  }

  popup.classList.remove('hidden');
}

function closePopup() {
  document.getElementById('popup').classList.add('hidden');
}

function getRedirectPage(role, companyKey = "") {
  const suffix =
    normalizeCompanyKey(companyKey) === "redsea" ? "?company=redsea" : "";

  switch ((role || '').toLowerCase().trim()) {
    case 'admin':
      return `admin.html${suffix}`;
    case 'hr':
      return `hr.html${suffix}`;
    case 'tme':
      return `tme.html${suffix}`;
    case 'me':
      return `me.html${suffix}`;
    case 'dev':
      return `dev.html${suffix}`;
    case 'seo':
      return `seo.html${suffix}`;
    case 'smo':
      return `seo.html${suffix}`;
    case 'acc':
    case 'accounts':
      return `accounts.html${suffix}`;
    // case 'dm':
    //   return 'seo.html';
    default:
      return null;
  }
}

// Register Form (same as before)
document.getElementById('registerFormElement').addEventListener('submit', async function(e) {
  e.preventDefault();
  const formData = new FormData(this);
  const btn = document.getElementById('registerBtn');
  const originalText = btn.innerHTML;

  btn.innerHTML = 'Creating Account...';
  btn.disabled = true;

  try {
    const response = await fetch(`${BASE_URL}/register`, { method: 'POST', body: formData });
    const result = await parseApiResponse(response);

    if (response.ok && result.success) {
      showPopup('Success!', result.message || 'Registration successful!', true);
      this.reset();
    } else {
      showPopup('Error', result.message || 'Something went wrong', false);
    }
  } catch (error) {
    showPopup('Error', 'Server error. Please try again.', false);
  } finally {
    btn.innerHTML = originalText;
    btn.disabled = false;
  }
});

document.getElementById("loginFormElement").addEventListener("submit", async function (e) {
  e.preventDefault();

  const emailOrContact = this.emailOrContact.value.trim();
  const company = this.company.value;
  const password = this.password.value;
  const btn = document.getElementById("loginBtn");
  const originalText = btn.innerHTML;

  btn.innerHTML = 'Logging in...';
  btn.disabled = true;

  try {
    const body = new URLSearchParams();
    body.append("emailOrContact", emailOrContact);
    body.append("company", company);
    body.append("password", password);

    const res = await fetch(`${BASE_URL}/login`, {
      method: "POST",
      body
    });

    const data = await parseApiResponse(res);

    if (res.ok && data.success) {
      applyLoginCompanyTheme(data.user?.company_key || company);
      localStorage.setItem("currentUser", JSON.stringify(data.user));

      const redirectPage = getRedirectPage(
        data.user?.role,
        data.user?.company_key || company,
      );

      if (!redirectPage) {
        showPopup("Login Failed", "This role does not have a dashboard assigned yet.", false);
        return;
      }

      showPopup("Welcome!", `Login successful as ${data.user.role}`, true);

      setTimeout(() => {
        window.location.href = redirectPage;
      }, 1200);
    } else {
      showPopup("Login Failed", data.message || "Invalid credentials", false);
    }

  } catch (error) {
    showPopup("Error", "Server error. Please try again.", false);
  } finally {
    btn.innerHTML = originalText;
    btn.disabled = false;
  }
});

const loginCompanySelect = document.getElementById("loginCompanySelect");
if (loginCompanySelect) {
  loginCompanySelect.addEventListener("change", () => {
    applyLoginCompanyTheme(loginCompanySelect.value);
  });
  applyLoginCompanyTheme(loginCompanySelect.value);
}


// const loginForm = document.getElementById('loginFormElement');

// if (loginForm) {
//   loginForm.addEventListener('submit', async function(e) {
//     e.preventDefault();

//     const emailOrContact = this.emailOrContact.value;
//     const password = this.password.value;

//     try {
//       const response = await fetch('/login', {
//         method: 'POST',
//         headers: { 'Content-Type': 'application/json' },
//         body: JSON.stringify({ emailOrContact, password })
//       });

//       const result = await response.json();

//       if (result.success) {
//         const userRole = result.user.role.toLowerCase();

//         localStorage.setItem('currentUser', JSON.stringify(result.user));

//         let redirectPage = '';

//         switch(userRole) {
//           case 'admin': redirectPage = 'admin.html'; break;
//           case 'tme': redirectPage = 'tme.html'; break;
//           case 'me': redirectPage = 'me.html'; break;
//           case 'dev': redirectPage = 'dev.html'; break;
//           default: redirectPage = 'index.html';
//         }

//         showPopup('Welcome!', `Login successful as ${userRole.toUpperCase()}`, true);

//         setTimeout(() => {
//           window.location.href = redirectPage;
//         }, 1500);

//       } else {
//         showPopup('Login Failed', result.message, false);
//       }

//     } catch (error) {
//       showPopup('Error', 'Server error', false);
//     }
//   });
// }
