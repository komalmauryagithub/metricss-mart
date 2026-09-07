const BASE_URL =
  window.location.protocol === "file:" ||
  ["localhost", "127.0.0.1"].includes(window.location.hostname)
    ? "http://localhost:3000"
    : window.location.origin || "https://metrics-mart-gf6l.onrender.com";

if (window.location.protocol === "file:") {
  window.location.replace(`${BASE_URL}/hr.html`);
}

const HR_THEME = {
  accent: "#0f766e",
  accentDark: "#115e59",
  accentLight: "#14b8a6",
  accentSoft: "rgba(15, 118, 110, 0.14)",
  accentSoftLight: "rgba(20, 184, 166, 0.16)",
  success: "#22c55e",
  warning: "#f59e0b",
  danger: "#ef4444",
  info: "#0ea5e9",
  slate: "#64748b",
  border: "#cbd5e1",
};

const HR_ROLE_LABELS = {
  hr: "HR",
  tme: "TME",
  me: "ME",
  dev: "Developer",
  seo: "SEO",
  smo: "SMO",
  accounts: "Accounts",
  dm: "DM",
};
const HR_SALES_COMPENSATION_ROLES = new Set(["tme", "me"]);
const FIXED_SALES_COMMISSION_PERCENT = 10;

const HR_ROLE_TARGETS = [
  { role: "hr", label: "HR Executive", target: 2, department: "People Ops" },
  { role: "tme", label: "TME", target: 4, department: "Sales" },
  { role: "me", label: "ME", target: 4, department: "Sales" },
  { role: "dev", label: "Developer", target: 3, department: "Technology" },
  { role: "seo", label: "SEO", target: 3, department: "Marketing" },
  { role: "smo", label: "SMO", target: 2, department: "Marketing" },
  { role: "accounts", label: "Accounts", target: 2, department: "Finance" },
  { role: "dm", label: "DM", target: 1, department: "Operations" },
];

const REPORTING_MANAGER_MAP = {
  hr: "Admin",
  tme: "Admin",
  me: "TME Lead / Admin",
  dev: "Project Lead / Admin",
  seo: "SEO Lead / Admin",
  smo: "SEO Lead / Admin",
  accounts: "Finance Lead / Admin",
  dm: "Operations Lead / Admin",
};

const POLICY_LIBRARY = [
  {
    title: "Offer Letters",
    detail: "Role, company, and joining details are documented before onboarding.",
  },
  {
    title: "Contracts",
    detail: "Employment terms, salary structure, and probation clauses are tracked here.",
  },
  {
    title: "Certificates",
    detail: "Experience, certification, and training proof archive for every employee.",
  },
  {
    title: "ID Proofs",
    detail: "Aadhaar, PAN, and banking verification coverage snapshot for compliance.",
  },
  {
    title: "HR Policies",
    detail: "Attendance, leave, conduct, and payroll policy communication zone.",
  },
  {
    title: "NDA Agreements",
    detail: "Confidentiality and company data protection acknowledgement tracker.",
  },
];

const HR_NOTICES = [
  {
    title: "HR Update",
    detail: "Complete missing employee documents before monthly payroll finalization.",
    tone: "info",
  },
  {
    title: "Meeting Alert",
    detail: "Schedule the weekly people-ops review with department leads.",
    tone: "warn",
  },
  {
    title: "Holiday Notice",
    detail: "Publish upcoming holiday communication in advance for attendance planning.",
    tone: "good",
  },
];

let currentUser = null;
let toastTimer = null;
let hrPopupTimer = null;
let chartInstances = {};
let hrFallbackAdminIdPromise = null;
let hrState = {
  employees: [],
  filteredEmployees: [],
  attendance: { data: [], summary: {} },
  leaves: { data: [], summary: {}, balances: [] },
  payroll: { data: [], summary: {}, trend: [], departmentExpense: [], month: "" },
  teamReport: [],
  projectTracker: { data: [], counts: {}, assignmentCounts: {} },
  crm: { counts: {}, deals: [] },
};

document.addEventListener("DOMContentLoaded", () => {
  setupMonthPicker();
  setupSidebarNavigation();
  setupToolbar();
  setupUserRegistration();
  setupHrEmployeeProfileModal();
  setupDashboardQuickLinks();
  togglePayrollToolbar("dashboard");

  if (!loadUser()) return;
  refreshHrPanel();
});

function setupMonthPicker() {
  const picker = document.getElementById("hrMonthPicker");
  if (!picker) return;
  picker.value = getCurrentMonthKey();
}

function setupSidebarNavigation() {
  document.querySelectorAll(".sidebar li[data-section]").forEach((item) => {
    item.addEventListener("click", () => showSection(item.dataset.section));
  });
}

function setupToolbar() {
  const refreshBtn = document.getElementById("hrRefreshBtn");
  const searchInput = document.getElementById("hrEmployeeSearch");
  const monthPicker = document.getElementById("hrMonthPicker");

  refreshBtn?.addEventListener("click", () => refreshHrPanel());
  monthPicker?.addEventListener("change", () => refreshHrPanel());
  searchInput?.addEventListener("input", applyEmployeeSearchFilter);
}

function setupUserRegistration() {
  const createUserBtn = document.getElementById("hrCreateUserBtn");
  const closeModalBtn = document.getElementById("hrUserModalCloseBtn");
  const modal = document.getElementById("hrUserRegistrationModal");
  const form = document.getElementById("hrRegisterForm");
  const captureFaceBtn = document.getElementById("hrAttendanceFaceCaptureBtn");
  const roleField = form?.elements?.role;
  const compensationType = form?.elements?.compensation_type;

  createUserBtn?.addEventListener("click", openHrUserForm);
  closeModalBtn?.addEventListener("click", closeHrUserForm);
  form?.addEventListener("submit", submitHrUserRegistration);
  captureFaceBtn?.addEventListener("click", captureHrAttendanceFaceEnrollment);
  roleField?.addEventListener("change", toggleHrUserCompensationFields);
  compensationType?.addEventListener("change", toggleHrUserCompensationFields);
  toggleHrUserCompensationFields();

  modal?.addEventListener("click", (event) => {
    if (event.target === modal) {
      closeHrUserForm();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;

    if (!modal?.classList.contains("hidden")) {
      closeHrUserForm();
    }
  });
}

function toggleHrUserCompensationFields() {
  const form = document.getElementById("hrRegisterForm");
  const role = String(form?.elements?.role?.value || "").toLowerCase().trim();
  const typeField = form?.elements?.compensation_type;
  const typeGroup = document.getElementById("hrUserCompensationTypeGroup");
  const salaryGroup = document.getElementById("hrUserSalaryGroup");
  const commissionGroup = document.getElementById("hrUserCommissionGroup");
  const salaryField = form?.elements?.salary;
  const commissionField = form?.elements?.commission_percent;
  const canUseCommission = HR_SALES_COMPENSATION_ROLES.has(role);
  const isCommission =
    canUseCommission &&
    String(typeField?.value || "salary").toLowerCase() === "commission";

  typeGroup?.classList.toggle("hidden", !canUseCommission);
  if (typeField) {
    typeField.disabled = !canUseCommission;
    typeField.required = canUseCommission;
    if (!canUseCommission) typeField.value = "salary";
  }

  salaryGroup?.classList.toggle("hidden", isCommission);
  commissionGroup?.classList.toggle("hidden", !isCommission);

  if (salaryField) {
    salaryField.required = !isCommission;
    if (isCommission) salaryField.value = "0";
  }
  if (commissionField) {
    commissionField.required = isCommission;
    commissionField.readOnly = isCommission;
    if (isCommission) {
      commissionField.value = String(FIXED_SALES_COMMISSION_PERCENT);
    }
    if (!isCommission) {
      commissionField.value = "";
      commissionField.readOnly = false;
    }
  }
}

function setupHrEmployeeProfileModal() {
  const modal = document.getElementById("hrEmployeeProfileModal");
  const closeBtn = document.getElementById("hrEmployeeProfileCloseBtn");

  closeBtn?.addEventListener("click", closeHrEmployeeProfileModal);
  modal?.addEventListener("click", (event) => {
    if (event.target === modal) {
      closeHrEmployeeProfileModal();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !modal?.classList.contains("hidden")) {
      closeHrEmployeeProfileModal();
    }
  });
}

function setupDashboardQuickLinks() {
  document.querySelectorAll("[data-dashboard-target]").forEach((card) => {
    card.setAttribute("role", "button");
    card.setAttribute("tabindex", "0");

    card.addEventListener("click", (event) => {
      if (event.target.closest("a, button, input, select, textarea")) return;
      openDashboardTarget(card.dataset.dashboardTarget);
    });

    card.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      openDashboardTarget(card.dataset.dashboardTarget);
    });
  });
}

function normalizeRole(role) {
  return String(role || "").trim().toLowerCase();
}

function getRedirectPage(role) {
  switch (normalizeRole(role)) {
    case "admin":
      return "admin.html";
    case "hr":
      return "hr.html";
    case "tme":
      return "tme.html";
    case "me":
      return "me.html";
    case "dev":
      return "dev.html";
    case "seo":
    case "smo":
    case "dm":
      return "seo.html";
    case "accounts":
      return "accounts.html";
    default:
      return "mp.html";
  }
}

function loadUser() {
  const rawUser = localStorage.getItem("currentUser");
  if (!rawUser) {
    showToast("Session expired. Please login again.", true);
    setTimeout(() => {
      window.location.href = "mp.html";
    }, 1200);
    return false;
  }

  try {
    currentUser = JSON.parse(rawUser);
  } catch (error) {
    localStorage.removeItem("currentUser");
    showToast("Session expired. Please login again.", true);
    setTimeout(() => {
      window.location.href = "mp.html";
    }, 1200);
    return false;
  }

  const role = normalizeRole(currentUser?.role);
  if (!["hr", "admin"].includes(role)) {
    showToast("Access denied for HR panel.", true);
    setTimeout(() => {
      window.location.href = getRedirectPage(role);
    }, 1200);
    return false;
  }

  const userName = document.getElementById("hrUserName");
  if (userName) {
    userName.textContent = currentUser.name || "User";
  }

  const todayLabel = document.getElementById("hrTodayLabel");
  if (todayLabel) {
    todayLabel.textContent = formatLongDate(new Date());
  }

  const badge = document.querySelector(".role, .role-badge");
  if (badge) {
    badge.textContent = role === "admin" ? "ADMIN" : "HR";
  }

  const avatar = document.getElementById("hrUserAvatar");
  if (avatar) {
    avatar.src = currentUser.prof_img
      ? currentUser.prof_img.startsWith("http")
        ? currentUser.prof_img
        : `${BASE_URL}/${currentUser.prof_img}`
      : "https://dummyimage.com/96x96/0f766e/ffffff&text=HR";
  }

  return true;
}

async function refreshHrPanel(options = {}) {
  const showSuccessToast = options.showSuccessToast !== false;
  const refreshBtn = document.getElementById("hrRefreshBtn");
  const originalLabel = refreshBtn?.innerHTML || "";
  const payrollMonth = normalizeMonthInput(
    document.getElementById("hrMonthPicker")?.value || "",
  );

  if (refreshBtn) {
    refreshBtn.disabled = true;
    refreshBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Refreshing';
  }

  try {
    const [employeesResult, attendanceResult, leavesResult, payrollResult] =
      await Promise.all([
        fetchHrEmployeesData(currentUser.id),
        fetchJson(
          `${BASE_URL}/api/admin/attendance?date=${encodeURIComponent(getTodayKey())}`,
        ),
        fetchHrLeavesData(currentUser.id),
        fetchHrPayrollOverview(currentUser.id, payrollMonth),
      ]);

    const [
      teamReportResult,
      projectTrackerResult,
      crmCountsResult,
      dealsResult,
    ] = await Promise.all([
      fetchOptionalJson(`${BASE_URL}/api/admin/team-report`, { data: [] }),
      fetchOptionalJson(`${BASE_URL}/api/project-tracker?scope=admin`, {
        data: [],
        counts: {},
        assignmentCounts: {},
      }),
      fetchOptionalJson(
        `${BASE_URL}/api/reports/counts?role=admin&userId=${encodeURIComponent(currentUser.id)}`,
        { data: {} },
      ),
      fetchOptionalJson(`${BASE_URL}/api/deals?role=admin`, { data: [] }),
    ]);

    const teamReportRows = Array.isArray(teamReportResult.data)
      ? teamReportResult.data
      : [];
    const projectTrackerRows = Array.isArray(projectTrackerResult.data)
      ? projectTrackerResult.data
      : [];
    const employees = enrichEmployeesWithLiveData(
      hydrateEmployeesWithOperationalData(
        Array.isArray(employeesResult.data) ? employeesResult.data : [],
        Array.isArray(attendanceResult.data) ? attendanceResult.data : [],
        Array.isArray(leavesResult.data) ? leavesResult.data : [],
      ),
      teamReportRows,
      projectTrackerRows,
    );

    hrState = {
      employees,
      filteredEmployees: [],
      attendance: {
        data: Array.isArray(attendanceResult.data) ? attendanceResult.data : [],
        summary: attendanceResult.summary || {},
      },
      leaves: {
        data: Array.isArray(leavesResult.data) ? leavesResult.data : [],
        summary: leavesResult.summary || {},
        balances: Array.isArray(leavesResult.balances) ? leavesResult.balances : [],
      },
      payroll: {
        data: Array.isArray(payrollResult.data) ? payrollResult.data : [],
        summary: payrollResult.summary || {},
        trend: Array.isArray(payrollResult.trend) ? payrollResult.trend : [],
        departmentExpense: Array.isArray(payrollResult.departmentExpense)
          ? payrollResult.departmentExpense
          : [],
        month: payrollResult.month || payrollMonth,
      },
      teamReport: teamReportRows,
      projectTracker: {
        data: projectTrackerRows,
        counts: projectTrackerResult.counts || {},
        assignmentCounts: projectTrackerResult.assignmentCounts || {},
      },
      crm: {
        counts: crmCountsResult.data || {},
        deals: Array.isArray(dealsResult.data) ? dealsResult.data : [],
      },
    };

    applyEmployeeSearchFilter();
    renderHrPanel();
    if (showSuccessToast) {
      showToast("HR panel refreshed successfully.");
    }
  } catch (error) {
    console.error("HR panel refresh failed:", error);
    showToast(error.message || "Failed to load HR panel data.", true);
  } finally {
    if (refreshBtn) {
      refreshBtn.disabled = false;
      refreshBtn.innerHTML = originalLabel;
    }
  }
}

function renderHrPanel() {
  renderDashboard();
  renderEmployees();
  renderRecruitment();
  renderAttendanceSection();
  renderPayrollSection();
  renderPerformanceSection();
  renderTasksSection();
  renderDocumentsSection();
  renderReportsSection();
  renderAnnouncementsSection();
}

function applyEmployeeSearchFilter() {
  const query = String(document.getElementById("hrEmployeeSearch")?.value || "")
    .trim()
    .toLowerCase();

  hrState.filteredEmployees = hrState.employees.filter((employee) => {
    if (!query) return true;
    const haystack = [
      employee.name,
      employee.email,
      employee.contact,
      employee.role,
      employee.department,
      employee.comp_name,
    ]
      .map((item) => String(item || "").toLowerCase())
      .join(" ");

    return haystack.includes(query);
  });

  if (hrState.employees.length) {
    renderEmployees();
    renderDocumentsSection();
    renderPerformanceSection();
  }
}

function showSection(sectionId) {
  document.querySelectorAll(".sidebar li[data-section]").forEach((item) => {
    item.classList.toggle("active", item.dataset.section === sectionId);
  });

  document.querySelectorAll(".hr-section").forEach((section) => {
    section.classList.toggle("active", section.id === sectionId);
  });

  togglePayrollToolbar(sectionId);
}

function openDashboardTarget(sectionId) {
  if (!sectionId) return;
  showSection(sectionId);
  document.getElementById(sectionId)?.scrollIntoView({
    behavior: "smooth",
    block: "start",
  });
}

function togglePayrollToolbar(sectionId) {
  const toolbar = document.getElementById("hrPayrollToolbar");
  if (!toolbar) return;

  toolbar.classList.toggle("hidden", sectionId !== "payroll");
}

function getCurrentMonthKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function normalizeMonthInput(value) {
  return /^\d{4}-\d{2}$/.test(String(value || "").trim())
    ? String(value).trim()
    : getCurrentMonthKey();
}

function getTodayKey() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatCurrency(value) {
  return `Rs. ${Number(value || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}

function formatCompactNumber(value) {
  return Number(value || 0).toLocaleString("en-IN");
}

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatLongDate(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("en-IN", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatRole(role) {
  return HR_ROLE_LABELS[normalizeRole(role)] || String(role || "Employee").toUpperCase();
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function parseSkills(value) {
  try {
    const parsed = JSON.parse(value || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function formatHrProfileValue(value, fallback = "-") {
  if (value === null || value === undefined) return fallback;
  const normalized = String(value).trim();
  return normalized || fallback;
}

function formatHrProfileLabel(value, fallback = "-") {
  const normalized = formatHrProfileValue(value, "");
  if (!normalized) return fallback;

  return normalized
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatHrProfileDateTime(value) {
  if (!value) return "-";
  const date = new Date(String(value).replace(" ", "T"));
  if (Number.isNaN(date.getTime())) return formatHrProfileValue(value);

  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatHrProfileAmount(value) {
  if (value === null || value === undefined || value === "") return "-";
  const amount = Number(value);
  if (!Number.isFinite(amount)) return formatHrProfileValue(value);

  return `Rs. ${amount.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function getHrProfileFileUrl(filePath) {
  const normalized = String(filePath || "").trim().replace(/\\/g, "/").replace(/^\/+/, "");
  if (!normalized) return "";
  if (/^https?:\/\//i.test(normalized)) return normalized;
  return `${BASE_URL}/${normalized}`;
}

function isHrProfileImageFile(filePath) {
  return /\.(jpg|jpeg|png|gif|webp)$/i.test(String(filePath || "").split("?")[0]);
}

function parseHrProfileSkills(value) {
  const labels = {
    web: "Web",
    seo: "SEO",
    smo: "SMO",
    ads: "Ads",
    app: "App",
    erp: "ERP",
    erp_crm: "ERP/CRM",
  };
  let source = value;

  if (typeof source === "string") {
    const trimmed = source.trim();
    if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
      try {
        source = JSON.parse(trimmed);
      } catch {
        source = value;
      }
    }
  }

  const skills = Array.isArray(source)
    ? source
    : String(source || "")
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);

  return skills
    .map((skill) => labels[String(skill || "").toLowerCase().trim()] || formatHrProfileLabel(skill, ""))
    .filter(Boolean)
    .join(", ") || "-";
}

function renderHrProfileFields(rows) {
  return rows
    .map(
      (row) => `
        <div class="profile-field">
          <span>${escapeHtml(row.label)}</span>
          <strong>${row.html || escapeHtml(formatHrProfileValue(row.value))}</strong>
        </div>
      `,
    )
    .join("");
}

function renderHrProfileSection(title, rows) {
  return `
    <section class="profile-detail-section">
      <h3>${escapeHtml(title)}</h3>
      <div class="profile-field-grid">
        ${renderHrProfileFields(rows)}
      </div>
    </section>
  `;
}

function renderHrProfileFileCard(label, filePath) {
  const fileUrl = getHrProfileFileUrl(filePath);
  if (!fileUrl) {
    return `
      <div class="profile-file-card missing">
        <span>${escapeHtml(label)}</span>
        <strong>Not uploaded</strong>
      </div>
    `;
  }

  const normalizedPath = String(filePath || "").replace(/\\/g, "/");
  const preview = isHrProfileImageFile(normalizedPath)
    ? `<img src="${escapeHtml(fileUrl)}" alt="${escapeHtml(label)}" loading="lazy" />`
    : `<div class="profile-file-icon"><i class="fas fa-file-lines"></i></div>`;

  return `
    <div class="profile-file-card">
      ${preview}
      <div>
        <span>${escapeHtml(label)}</span>
        <strong>${escapeHtml(normalizedPath.split("/").pop() || "Uploaded file")}</strong>
        <a href="${escapeHtml(fileUrl)}" target="_blank" rel="noopener">Open file</a>
      </div>
    </div>
  `;
}

function parseHrProfileDocumentList(value) {
  let source = value;

  if (typeof source === "string") {
    const trimmed = source.trim();
    if (!trimmed) return [];

    try {
      source = JSON.parse(trimmed);
    } catch {
      source = trimmed;
    }
  }

  const list = Array.isArray(source) ? source : source ? [source] : [];

  return list
    .map((item) => {
      if (typeof item === "string") return item.trim();
      if (item && typeof item === "object") {
        return String(item.url || item.path || item.file || "").trim();
      }

      return "";
    })
    .filter(Boolean);
}

function renderHrOtherDocumentCards(value) {
  return parseHrProfileDocumentList(value)
    .map((filePath, index) => renderHrProfileFileCard(`Other document ${index + 1}`, filePath))
    .join("");
}

function renderHrEmployeeProfileDetails(employee = {}) {
  const body = document.getElementById("hrEmployeeProfileBody");
  const title = document.getElementById("hrEmployeeProfileTitle");
  if (!body) return;

  if (title) {
    title.textContent = employee.name || "Employee Profile";
  }

  const avatarUrl = getHrProfileFileUrl(employee.prof_img);
  const avatarMarkup = avatarUrl && isHrProfileImageFile(employee.prof_img)
    ? `<img src="${escapeHtml(avatarUrl)}" alt="${escapeHtml(employee.name || "Employee")}" />`
    : `<span>${escapeHtml(String(employee.name || "E").trim().slice(0, 1).toUpperCase() || "E")}</span>`;
  const profileStatus = formatHrProfileLabel(employee.profile_setup_status || "pending");

  body.innerHTML = `
    <div class="profile-record-head">
      <div class="profile-record-avatar">${avatarMarkup}</div>
      <div>
        <span class="section-kicker">Employee Record</span>
        <h2>${escapeHtml(employee.name || "Employee")}</h2>
        <p>${escapeHtml(formatRole(employee.role))} | ${escapeHtml(employee.comp_name || "Metrics Mart")}</p>
      </div>
      <div class="profile-record-status">
        <span>${escapeHtml(profileStatus)}</span>
        <small>Submitted: ${escapeHtml(formatHrProfileDateTime(employee.profile_setup_completed_at))}</small>
      </div>
    </div>

    <div class="profile-detail-grid">
      ${renderHrProfileSection("Admin Entered Account Details", [
        { label: "Employee code", value: employee.employee_code },
        { label: "Full name", value: employee.name },
        { label: "Email", value: employee.email },
        { label: "Contact", value: employee.contact },
        { label: "Family number", value: employee.alt_contact },
        { label: "Role", value: formatRole(employee.role) },
        { label: "Department", value: employee.department || formatRole(employee.role) },
        { label: "Company", value: employee.comp_name },
        { label: "Monthly salary", value: formatHrProfileAmount(employee.salary) },
        { label: "Login time", value: employee.login_time },
        { label: "Logout time", value: employee.logout_time },
        { label: "Address", value: employee.address },
      ])}

      ${renderHrProfileSection("Personal & Identity Details", [
        { label: "Date of birth", value: formatDate(employee.date_of_birth) },
        { label: "Gender", value: formatHrProfileLabel(employee.gender) },
        { label: "Nationality", value: employee.nationality },
        { label: "Aadhar number", value: employee.aadhar_no },
        { label: "PAN number", value: employee.pan_number },
      ])}

      ${renderHrProfileSection("Bank Details", [
        { label: "Bank name", value: employee.bank_name },
        { label: "Account number", value: employee.account_no },
        { label: "IFSC code", value: employee.ifsc_code },
        { label: "Beneficiary name", value: employee.beneficiary_name },
      ])}

      ${renderHrProfileSection("Joining, Experience & Skills", [
        { label: "Joining date", value: formatDate(employee.joining_date) },
        { label: "Total experience", value: employee.total_experience },
        { label: "Skills", value: parseHrProfileSkills(employee.skills) },
      ])}

      ${renderHrProfileSection("PF Details", [
        { label: "PF enabled", value: Number(employee.pf_enabled || 0) ? "Yes" : "No" },
        { label: "PF number", value: Number(employee.pf_enabled || 0) ? employee.pf_number : "-" },
        { label: "UAN number", value: Number(employee.pf_enabled || 0) ? employee.uan_number : "-" },
        { label: "Employee PF amount", value: Number(employee.pf_enabled || 0) ? formatHrProfileAmount(employee.employee_pf_amount) : "-" },
        { label: "Employer PF amount", value: Number(employee.pf_enabled || 0) ? formatHrProfileAmount(employee.employer_pf_amount) : "-" },
        { label: "PF joining date", value: Number(employee.pf_enabled || 0) ? formatDate(employee.pf_joining_date) : "-" },
      ])}
    </div>

    <section class="profile-detail-section profile-documents-section">
      <h3>Uploaded Files</h3>
      <div class="profile-file-grid">
        ${renderHrProfileFileCard("Profile image", employee.prof_img)}
        ${renderHrProfileFileCard("Aadhar image", employee.aadhar_img)}
        ${renderHrProfileFileCard("PAN image", employee.pan_img)}
        ${renderHrProfileFileCard("Cancelled cheque", employee.cancelled_cheque)}
        ${renderHrProfileFileCard("Resume", employee.resume_file)}
        ${renderHrProfileFileCard("Experience letter", employee.experience_file)}
        ${renderHrProfileFileCard("Certification file", employee.certification_file)}
        ${renderHrOtherDocumentCards(employee.other_documents)}
      </div>
    </section>
  `;
}

function openHrEmployeeProfile(employeeId) {
  const employee = hrState.employees.find((item) => String(item.id) === String(employeeId));
  if (!employee) {
    showToast("Employee profile record not found.", true);
    return;
  }

  renderHrEmployeeProfileDetails(employee);
  const modal = document.getElementById("hrEmployeeProfileModal");
  modal?.classList.remove("hidden");
  modal?.setAttribute("aria-hidden", "false");
  document.body.classList.add("modal-open");
}

function closeHrEmployeeProfileModal() {
  const modal = document.getElementById("hrEmployeeProfileModal");
  modal?.classList.add("hidden");
  modal?.setAttribute("aria-hidden", "true");
  document.body.classList.remove("modal-open");
}

function getManagerLabel(employee) {
  if (Number(employee?.is_team_lead || 0)) {
    return "Admin";
  }
  return REPORTING_MANAGER_MAP[normalizeRole(employee?.role)] || "Admin";
}

function getDocumentCompletion(employee) {
  const present = Number(employee?.documents_present || 0);
  const required = Number(employee?.documents_required || 0) || 1;
  return {
    present,
    required,
    missing: Math.max(required - present, 0),
    percent: Math.round((present / required) * 100),
  };
}

function getEmployeeLifecycleStatus(employee) {
  if (Number(employee?.is_on_leave_today || 0)) {
    return { label: "On Leave", tone: "warn" };
  }

  const profileStatus = String(employee?.profile_setup_status || "").toLowerCase();
  if (profileStatus && profileStatus !== "completed") {
    return { label: "Onboarding", tone: "info" };
  }

  const attendanceStatus = String(employee?.attendance_status || "").toLowerCase();
  if (["present", "grace", "late", "checkout_pending"].includes(attendanceStatus)) {
    return { label: "Active", tone: "good" };
  }

  if (attendanceStatus === "half_day") {
    return { label: "Half Day", tone: "warn" };
  }

  return { label: "Monitoring", tone: "bad" };
}

function getAttendanceStatusLabel(status) {
  switch (String(status || "").toLowerCase()) {
    case "present":
      return "Present";
    case "grace":
      return "Grace";
    case "late":
      return "Late";
    case "checkout_pending":
      return "Checkout Pending";
    case "half_day":
      return "Half Day";
    case "absent":
      return "Absent";
    default:
      return "Not Marked";
  }
}

function getStatusTone(status) {
  const normalized = String(status || "").toLowerCase();
  if (["present", "grace", "approved", "active", "ready"].includes(normalized)) return "good";
  if (["late", "half_day", "pending", "scheduled", "warning"].includes(normalized)) return "warn";
  if (["absent", "rejected", "missing", "critical"].includes(normalized)) return "bad";
  return "info";
}

function statusPill(label, tone) {
  return `<span class="status-pill ${tone || "info"}">${escapeHtml(label)}</span>`;
}

function buildEmptyState(text) {
  return `<div class="empty-state">${escapeHtml(text)}</div>`;
}

function setText(id, value) {
  const node = document.getElementById(id);
  if (node) node.textContent = value;
}

function fetchJson(url) {
  return fetch(url, { cache: "no-store" }).then(async (response) => {
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.success === false) {
      const error = new Error(data.message || `Request failed (${response.status})`);
      error.status = response.status;
      error.payload = data;
      throw error;
    }
    return data;
  });
}

async function fetchArrayJson(url) {
  const response = await fetch(url, { cache: "no-store" });
  const data = await response.json().catch(() => []);

  if (!response.ok) {
    const error = new Error(`Request failed (${response.status})`);
    error.status = response.status;
    error.payload = data;
    throw error;
  }

  if (!Array.isArray(data)) {
    const error = new Error("Legacy user feed returned an invalid response");
    error.status = response.status;
    error.payload = data;
    throw error;
  }

  return data;
}

function fetchOptionalJson(url, fallbackValue) {
  return fetchJson(url).catch((error) => {
    console.warn("Optional HR feed unavailable:", url, error);
    return fallbackValue;
  });
}

function isNotFoundError(error) {
  return Number(error?.status || 0) === 404;
}

async function fetchLegacyUsersArray() {
  return fetchArrayJson(`${BASE_URL}/test-users`);
}

async function resolveHrFallbackAdminId() {
  if (!hrFallbackAdminIdPromise) {
    hrFallbackAdminIdPromise = fetchLegacyUsersArray()
      .then((users) => {
        const adminUser = users.find((user) => normalizeRole(user.role) === "admin");
        if (!adminUser?.id) {
          throw new Error("Admin user not found for HR fallback");
        }
        return Number(adminUser.id);
      })
      .catch((error) => {
        hrFallbackAdminIdPromise = null;
        throw error;
      });
  }

  return hrFallbackAdminIdPromise;
}

function mapLegacyUserToHrEmployee(user) {
  const requiredDocumentFields = [
    user?.aadhar_img,
    user?.pan_img,
    user?.cancelled_cheque,
    user?.resume_file,
    user?.experience_file,
    user?.certification_file,
  ];
  const requiredDocumentsPresent = requiredDocumentFields.filter(Boolean).length;
  const documentsPresent =
    requiredDocumentsPresent + parseHrProfileDocumentList(user?.other_documents).length;

  return {
    ...user,
    department:
      String(user?.department || "").trim() ||
      String(user?.role || "").trim().toUpperCase() ||
      "General",
    profile_setup_status: user?.profile_setup_status || "pending",
    documents_present: documentsPresent,
    documents_required: requiredDocumentFields.length,
    documents_missing: Math.max(
      requiredDocumentFields.length - requiredDocumentsPresent,
      0,
    ),
    is_on_leave_today: 0,
    today_leave_type: null,
    attendance_status: "not_marked",
    check_in: null,
    check_out: null,
  };
}

async function fetchHrEmployeesData(userId) {
  try {
    return await fetchJson(
      `${BASE_URL}/api/hr/employees?userId=${encodeURIComponent(userId)}`,
    );
  } catch (error) {
    if (!isNotFoundError(error)) {
      throw error;
    }

    const users = await fetchLegacyUsersArray();
    return {
      success: true,
      data: users
        .filter((user) => normalizeRole(user.role) !== "admin")
        .map(mapLegacyUserToHrEmployee),
    };
  }
}

async function fetchHrLeavesData(userId) {
  try {
    return await fetchJson(
      `${BASE_URL}/api/hr/leaves?userId=${encodeURIComponent(userId)}`,
    );
  } catch (error) {
    if (!isNotFoundError(error)) {
      throw error;
    }

    const adminId = await resolveHrFallbackAdminId();
    return fetchJson(
      `${BASE_URL}/api/admin/leaves?adminId=${encodeURIComponent(adminId)}`,
    );
  }
}

async function fetchHrPayrollOverview(userId, monthKey) {
  try {
    return await fetchJson(
      `${BASE_URL}/api/hr/payroll/overview?userId=${encodeURIComponent(userId)}&month=${encodeURIComponent(monthKey)}`,
    );
  } catch (error) {
    if (!isNotFoundError(error)) {
      throw error;
    }

    const adminId = await resolveHrFallbackAdminId();
    return fetchJson(
      `${BASE_URL}/api/payroll/admin/overview?adminId=${encodeURIComponent(adminId)}&month=${encodeURIComponent(monthKey)}`,
    );
  }
}

function isSameMonth(dateValue, monthKey) {
  if (!dateValue) return false;
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return false;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}` === monthKey;
}

function isRecentJoiner(employee) {
  return isSameMonth(employee?.joining_date, getCurrentMonthKey());
}

function getRecentJoiners(limit = 5) {
  return [...hrState.employees]
    .filter((employee) => employee.joining_date)
    .sort((left, right) => new Date(right.joining_date) - new Date(left.joining_date))
    .slice(0, limit);
}

function getEmployeesOnLeaveToday() {
  return hrState.employees.filter((employee) => Number(employee.is_on_leave_today || 0));
}

function getDepartmentStats() {
  const map = new Map();
  hrState.employees.forEach((employee) => {
    const key = String(employee.department || formatRole(employee.role)).trim() || "General";
    if (!map.has(key)) {
      map.set(key, {
        name: key,
        count: 0,
        active: 0,
        onLeave: 0,
        newJoiners: 0,
      });
    }
    const entry = map.get(key);
    entry.count += 1;
    if (!Number(employee.is_on_leave_today || 0)) {
      entry.active += 1;
    }
    if (Number(employee.is_on_leave_today || 0)) {
      entry.onLeave += 1;
    }
    if (isRecentJoiner(employee)) {
      entry.newJoiners += 1;
    }
  });

  return Array.from(map.values()).sort((left, right) => right.count - left.count);
}

function getRoleCounts() {
  const counts = {};
  hrState.employees.forEach((employee) => {
    const role = normalizeRole(employee.role);
    counts[role] = (counts[role] || 0) + 1;
  });
  return counts;
}

function buildOpenPositions() {
  const roleCounts = getRoleCounts();
  return HR_ROLE_TARGETS.map((target) => {
    const filled = Number(roleCounts[target.role] || 0);
    const openCount = Math.max(target.target - filled, 0);

    return {
      ...target,
      filled,
      openCount,
      priority:
        openCount >= 2 ? "Critical" : openCount === 1 ? "Open" : "Covered",
    };
  }).sort((left, right) => right.openCount - left.openCount);
}

function buildRecruitmentPipeline(openings) {
  const recentJoiners = getRecentJoiners(12);
  const screening = openings.filter((opening) => opening.openCount > 0).length;
  const resumeReview = hrState.employees.filter((employee) => employee.resume_file).length;
  const scheduled = openings.filter((opening) => opening.openCount > 0).reduce(
    (sum, opening) => sum + Math.min(opening.openCount, 1),
    0,
  );
  const offer = recentJoiners.filter(
    (employee) => String(employee.profile_setup_status || "").toLowerCase() !== "completed",
  ).length;
  const hired = recentJoiners.filter(
    (employee) => String(employee.profile_setup_status || "").toLowerCase() === "completed",
  ).length;

  return [
    { stage: "Screening", count: screening, notes: "Active role gaps ready for sourcing." },
    {
      stage: "Resume Review",
      count: resumeReview,
      notes: "Resume files already available in employee records.",
    },
    {
      stage: "Interview Scheduled",
      count: scheduled,
      notes: "Recommended interview slots to close open headcount.",
    },
    {
      stage: "Offer Letter",
      count: offer,
      notes: "Onboarding paperwork still needs closure.",
    },
    {
      stage: "Hired / Onboarded",
      count: hired,
      notes: "Recent joiners with completed profile setup.",
    },
  ];
}

function buildInterviewSchedule(openings) {
  return openings
    .filter((opening) => opening.openCount > 0)
    .slice(0, 5)
    .map((opening, index) => ({
      title: `${opening.label} interview block`,
      detail: `${opening.openCount} open position(s) in ${opening.department}. Align HR with department lead for shortlist review.`,
      tag: index === 0 ? "Urgent" : "Planned",
      tone: index === 0 ? "bad" : "warn",
    }));
}

function buildResumeArchive() {
  return [...hrState.employees]
    .filter((employee) => employee.resume_file)
    .slice(0, 6)
    .map((employee) => ({
      title: employee.name || "Employee",
      detail: `${formatRole(employee.role)} | Resume available | ${employee.comp_name || "Metrics Mart"}`,
      tag: "Resume On File",
      tone: "good",
    }));
}

function buildOfferTracker() {
  return getRecentJoiners(8).map((employee) => {
    const profileStatus = String(employee.profile_setup_status || "").toLowerCase();
    const statusLabel =
      profileStatus === "completed" ? "Joined" : "Documentation Pending";
    return {
      title: employee.name || "Employee",
      detail: `${formatRole(employee.role)} | ${employee.comp_name || "Metrics Mart"} | Joined ${formatDate(employee.joining_date)}`,
      tag: statusLabel,
      tone: profileStatus === "completed" ? "good" : "warn",
    };
  });
}

function getPayrollMap() {
  return new Map(
    (hrState.payroll.data || []).map((row) => [Number(row.employeeId || 0), row]),
  );
}

function getProjectTrackerAssignments() {
  return (hrState.projectTracker.data || []).flatMap((project) =>
    (Array.isArray(project.assignments) ? project.assignments : []).map((assignment) => ({
      ...assignment,
      project_id: project.project_id,
      projectName: project.projectName || "Project",
      client: project.client || "",
      projectStatus: project.status || "",
      projectProgress: Number(project.progress || 0),
    })),
  );
}

function hydrateEmployeesWithOperationalData(employees, attendanceRows, leaveRows) {
  const attendanceMap = new Map(
    attendanceRows.map((row) => [Number(row.user_id || 0), row]),
  );
  const todayKey = getTodayKey();
  const leaveMap = new Map();

  leaveRows.forEach((row) => {
    const userId = Number(row.user_id || 0);
    const status = String(row.status || "").toLowerCase();
    if (!userId || status !== "approved") return;

    const fromDate = String(row.from_date || "").slice(0, 10);
    const toDate = String(row.to_date || "").slice(0, 10);
    if (!fromDate || !toDate) return;

    if (todayKey >= fromDate && todayKey <= toDate && !leaveMap.has(userId)) {
      leaveMap.set(userId, row);
    }
  });

  return employees.map((employee) => {
    const attendanceRow = attendanceMap.get(Number(employee.id || 0)) || {};
    const leaveRow = leaveMap.get(Number(employee.id || 0)) || null;
    const requiredDocumentFields = [
      employee?.aadhar_img,
      employee?.pan_img,
      employee?.cancelled_cheque,
      employee?.resume_file,
      employee?.experience_file,
      employee?.certification_file,
    ];
    const requiredDocumentsPresent = requiredDocumentFields.filter(Boolean).length;
    const computedDocumentsPresent =
      requiredDocumentsPresent +
      parseHrProfileDocumentList(employee?.other_documents).length;
    const documentsRequired =
      Number(employee?.documents_required || 0) || requiredDocumentFields.length || 1;
    const documentsPresent =
      Number(employee?.documents_present || 0) || computedDocumentsPresent;

    return {
      ...employee,
      department:
        String(employee?.department || "").trim() ||
        String(employee?.role || "").trim().toUpperCase() ||
        "General",
      check_in: employee?.check_in ?? attendanceRow.check_in ?? null,
      check_out: employee?.check_out ?? attendanceRow.check_out ?? null,
      attendance_status:
        employee?.attendance_status ||
        attendanceRow.status ||
        attendanceRow.attendance_status ||
        "not_marked",
      is_on_leave_today: Number(employee?.is_on_leave_today || (leaveRow ? 1 : 0)),
      today_leave_type: employee?.today_leave_type || leaveRow?.leave_type || null,
      documents_present: documentsPresent,
      documents_required: documentsRequired,
      documents_missing: Math.max(documentsRequired - requiredDocumentsPresent, 0),
      profile_setup_status: employee?.profile_setup_status || "pending",
    };
  });
}

function buildProjectAssignmentSummaryMap(projectRows) {
  const summaryMap = new Map();

  projectRows.forEach((project) => {
    const assignments = Array.isArray(project.assignments) ? project.assignments : [];
    assignments.forEach((assignment) => {
      const userId = Number(assignment.user_id || 0);
      if (!userId) return;

      if (!summaryMap.has(userId)) {
        summaryMap.set(userId, {
          total: 0,
          assigned: 0,
          ongoing: 0,
          completed: 0,
          blocked: 0,
          progressTotal: 0,
          projects: new Set(),
        });
      }

      const entry = summaryMap.get(userId);
      const status = String(assignment.status || "").toLowerCase().trim();

      entry.total += 1;
      entry.progressTotal += Number(assignment.progress || 0);

      if (status) {
        entry[status] = (entry[status] || 0) + 1;
      }

      if (status === "blocked" || Number(assignment.blockedCount || 0) > 0) {
        entry.blocked += 1;
      }

      if (project.projectName) {
        entry.projects.add(project.projectName);
      }
    });
  });

  return summaryMap;
}

function enrichEmployeesWithLiveData(employees, teamRows, projectRows) {
  const teamMap = new Map(
    teamRows.map((row) => [Number(row.id || 0), row]),
  );
  const projectMap = buildProjectAssignmentSummaryMap(projectRows);

  return employees.map((employee) => {
    const teamRow = teamMap.get(Number(employee.id || 0)) || {};
    const projectSummary = projectMap.get(Number(employee.id || 0));

    return {
      ...employee,
      total_leads: Number(teamRow.total_leads || 0),
      total_appointments: Number(teamRow.total_appointments || 0),
      total_followups: Number(teamRow.total_followups || 0),
      project_assignments: Number(projectSummary?.total || 0),
      assigned_projects: Number(projectSummary?.assigned || 0),
      ongoing_projects: Number(projectSummary?.ongoing || 0),
      completed_projects: Number(projectSummary?.completed || 0),
      blocked_projects: Number(projectSummary?.blocked || 0),
      avg_project_progress:
        Number(projectSummary?.total || 0) > 0
          ? Math.round(Number(projectSummary.progressTotal || 0) / Number(projectSummary.total || 1))
          : 0,
      project_names: projectSummary ? Array.from(projectSummary.projects) : [],
    };
  });
}

function getCrmSummary() {
  const counts = hrState.crm.counts || {};
  const deals = Array.isArray(hrState.crm.deals) ? hrState.crm.deals : [];
  const receivedRevenue = deals
    .filter((deal) => String(deal.pay_stat || "").toLowerCase() === "received")
    .reduce((sum, deal) => sum + Number(deal.deal_amount || 0), 0);

  return {
    leads: Number(counts.leads || 0),
    appointments: Number(counts.appointments || 0),
    followups: Number(counts.followups || 0),
    deals: deals.length,
    receivedRevenue,
  };
}

function getProjectTrackerSummary() {
  const counts = hrState.projectTracker.counts || {};
  const assignmentCounts = hrState.projectTracker.assignmentCounts || {};
  const blockedAssignments = getProjectTrackerAssignments().filter(
    (assignment) =>
      String(assignment.status || "").toLowerCase() === "blocked" ||
      Number(assignment.blockedCount || 0) > 0,
  ).length;

  return {
    totalProjects: Number(counts.total || 0),
    assignedProjects: Number(counts.assigned || 0),
    ongoingProjects: Number(counts.ongoing || 0),
    completedProjects: Number(counts.completed || 0),
    unassignedProjects: Number(counts.unassigned || 0),
    totalAssignments: Number(assignmentCounts.total || 0),
    ongoingAssignments: Number(assignmentCounts.ongoing || 0),
    completedAssignments: Number(assignmentCounts.completed || 0),
    blockedAssignments,
  };
}

function calculateEmployeeScore(employee) {
  const payrollRow = getPayrollMap().get(Number(employee.id || 0));
  const docCompletion = getDocumentCompletion(employee);
  const totalLeads = Number(employee.total_leads || 0);
  const totalAppointments = Number(employee.total_appointments || 0);
  const totalFollowups = Number(employee.total_followups || 0);
  const projectAssignments = Number(employee.project_assignments || 0);
  const blockedProjects = Number(employee.blocked_projects || 0);
  const avgProjectProgress = Number(employee.avg_project_progress || 0);
  let score = 40;

  switch (String(employee.attendance_status || "").toLowerCase()) {
    case "present":
      score += 24;
      break;
    case "grace":
      score += 20;
      break;
    case "late":
      score += 14;
      break;
    case "checkout_pending":
      score += 12;
      break;
    case "half_day":
      score += 8;
      break;
    default:
      score += 4;
      break;
  }

  score += Math.round((docCompletion.percent / 100) * 18);

  if (String(employee.profile_setup_status || "").toLowerCase() === "completed") {
    score += 8;
  }

  if (Number(employee.is_team_lead || 0)) {
    score += 6;
  }

  if (payrollRow?.incentiveAmount > 0) {
    score += 8;
  }

  score += Math.min(totalLeads, 6);
  score += Math.min(totalAppointments * 2, 8);
  score += Math.min(totalFollowups, 5);
  score += Math.min(projectAssignments * 3, 9);
  score += Math.min(Math.round(avgProjectProgress / 12), 8);
  score -= Math.min(blockedProjects * 5, 10);

  score += Math.min(parseSkills(employee.skills).length * 2, 8);

  if (Number(employee.is_on_leave_today || 0)) {
    score -= 4;
  }

  return Math.max(0, Math.min(100, Math.round(score)));
}

function buildPerformanceRows(sourceEmployees = hrState.filteredEmployees) {
  return sourceEmployees.map((employee) => {
    const score = calculateEmployeeScore(employee);
    const rating =
      score >= 90 ? "5 / 5" : score >= 80 ? "4.5 / 5" : score >= 70 ? "4 / 5" : "3.5 / 5";
    const recommendation =
      score >= 85
        ? "Promotion Ready"
        : score >= 75
          ? "High Potential"
          : score >= 65
            ? "Stable Performer"
            : "Monitor & Coach";
    const activityBits = [];

    if (
      Number(employee.total_leads || 0) > 0 ||
      Number(employee.total_appointments || 0) > 0 ||
      Number(employee.total_followups || 0) > 0
    ) {
      activityBits.push(
        `${Number(employee.total_leads || 0)} leads | ${Number(employee.total_appointments || 0)} appointments | ${Number(employee.total_followups || 0)} follow-ups`,
      );
    }

    if (Number(employee.project_assignments || 0) > 0) {
      activityBits.push(
        `${Number(employee.ongoing_projects || 0)} ongoing | ${Number(employee.completed_projects || 0)} completed project assignments`,
      );
    }

    return {
      employee,
      score,
      rating,
      recommendation,
      note:
        Number(employee.is_on_leave_today || 0)
          ? "Leave impact on daily productivity."
          : [
              `${getAttendanceStatusLabel(employee.attendance_status)} attendance`,
              `${getDocumentCompletion(employee).percent}% compliance`,
              activityBits.join(" | "),
            ]
              .filter(Boolean)
              .join(" | "),
    };
  }).sort((left, right) => right.score - left.score);
}

function buildTasksBoard(openings, performanceRows) {
  const urgent = [];
  const week = [];
  const planned = [];

  const pendingLeaves = hrState.leaves.data.filter(
    (item) => String(item.status || "").toLowerCase() === "pending",
  );
  const incompleteProfiles = hrState.employees.filter(
    (employee) => String(employee.profile_setup_status || "").toLowerCase() !== "completed",
  );
  const missingDocs = hrState.employees
    .filter((employee) => getDocumentCompletion(employee).missing > 0)
    .sort(
      (left, right) =>
        getDocumentCompletion(right).missing - getDocumentCompletion(left).missing,
    );
  const payrollSummary = hrState.payroll.summary || {};
  const crmSummary = getCrmSummary();
  const projectSummary = getProjectTrackerSummary();
  const blockedAssignments = getProjectTrackerAssignments().filter(
    (assignment) =>
      String(assignment.status || "").toLowerCase() === "blocked" ||
      Number(assignment.blockedCount || 0) > 0,
  );
  const lowActivityRows = performanceRows.filter((row) => {
    const employee = row.employee;
    const liveActivity =
      Number(employee.total_leads || 0) +
      Number(employee.total_appointments || 0) +
      Number(employee.total_followups || 0) +
      Number(employee.project_assignments || 0);

    return liveActivity === 0 && !Number(employee.is_on_leave_today || 0);
  });

  if (pendingLeaves.length) {
    urgent.push({
      title: `Approve ${pendingLeaves.length} pending leave request${pendingLeaves.length > 1 ? "s" : ""}`,
      detail: "Review leave approvals so attendance and payroll stay aligned.",
      tone: "bad",
      tag: "Leave Queue",
    });
  }

  if (Number(payrollSummary.generatedEmployees || 0) < Number(payrollSummary.totalEmployees || 0)) {
    urgent.push({
      title: "Finish payroll generation",
      detail: `${Number(payrollSummary.totalEmployees || 0) - Number(payrollSummary.generatedEmployees || 0)} employee payroll snapshots are still pending.`,
      tone: "warn",
      tag: "Payroll",
    });
  }

  if (blockedAssignments.length) {
    urgent.push({
      title: `Resolve ${blockedAssignments.length} blocked project assignment${blockedAssignments.length > 1 ? "s" : ""}`,
      detail: "Project tracker shows delivery blockers that need HR coordination with team leads.",
      tone: "bad",
      tag: "Projects",
    });
  }

  if (projectSummary.unassignedProjects > 0) {
    urgent.push({
      title: `Assign owners for ${projectSummary.unassignedProjects} live project${projectSummary.unassignedProjects > 1 ? "s" : ""}`,
      detail: "Some active projects are still unassigned in the tracker and need workforce allocation.",
      tone: "warn",
      tag: "Allocation",
    });
  }

  openings
    .filter((opening) => opening.openCount > 0)
    .slice(0, 3)
    .forEach((opening) => {
      week.push({
        title: `Open ${opening.label} requisition`,
        detail: `${opening.openCount} position(s) still open in ${opening.department}.`,
        tone: opening.openCount > 1 ? "bad" : "warn",
        tag: "Recruitment",
      });
    });

  incompleteProfiles.slice(0, 4).forEach((employee) => {
    week.push({
      title: `Close onboarding for ${employee.name}`,
      detail: `${formatRole(employee.role)} profile setup is ${employee.profile_setup_status || "pending"}.`,
      tone: "info",
      tag: "Onboarding",
    });
  });

  if (crmSummary.followups > 0) {
    week.push({
      title: `Review ${crmSummary.followups} CRM follow-up item${crmSummary.followups > 1 ? "s" : ""}`,
      detail: "Sales follow-up volume is live in the CRM and may need staffing or coaching review.",
      tone: "info",
      tag: "CRM",
    });
  }

  lowActivityRows.slice(0, 3).forEach((row) => {
    week.push({
      title: `Check workload for ${row.employee.name}`,
      detail: `${formatRole(row.employee.role)} has no visible live CRM or project activity in the current snapshot.`,
      tone: "info",
      tag: "Productivity",
    });
  });

  missingDocs.slice(0, 4).forEach((employee) => {
    planned.push({
      title: `Collect missing documents from ${employee.name}`,
      detail: `${getDocumentCompletion(employee).missing} document item(s) still missing.`,
      tone: "warn",
      tag: "Documents",
    });
  });

  performanceRows
    .filter((row) => Number(row.employee.project_assignments || 0) > 0)
    .slice(0, 3)
    .forEach((row) => {
      planned.push({
        title: `Project review with ${row.employee.name}`,
        detail: `${Number(row.employee.project_assignments || 0)} live assignment(s) | ${Number(row.employee.ongoing_projects || 0)} ongoing | ${Number(row.employee.completed_projects || 0)} completed.`,
        tone: row.score >= 85 ? "good" : "info",
        tag: "Projects",
      });
    });

  performanceRows.slice(0, 3).forEach((row) => {
    planned.push({
      title: `Performance check-in: ${row.employee.name}`,
      detail: `${row.score}/100 readiness score with recommendation "${row.recommendation}".`,
      tone: row.score >= 85 ? "good" : "info",
      tag: "Performance",
    });
  });

  return { urgent, week, planned };
}

function buildAnnouncements(openings, performanceRows) {
  const recentJoiners = getRecentJoiners(4);
  const pendingLeaves = Number(hrState.leaves.summary?.pendingRequests || 0);
  const crmSummary = getCrmSummary();
  const projectSummary = getProjectTrackerSummary();

  const list = [];

  recentJoiners.forEach((employee) => {
    list.push({
      title: `Welcome ${employee.name}`,
      detail: `${formatRole(employee.role)} joined on ${formatDate(employee.joining_date)}. Share onboarding checklist and policy pack.`,
      tone: "good",
      tag: "New Joiner",
    });
  });

  if (pendingLeaves > 0) {
    list.push({
      title: "Leave approvals pending",
      detail: `${pendingLeaves} leave request(s) need review to keep workforce planning accurate.`,
      tone: "warn",
      tag: "HR Update",
    });
  }

  const criticalOpenings = openings.filter((opening) => opening.openCount > 0);
  if (criticalOpenings.length) {
    list.push({
      title: "Hiring demand alert",
      detail: `${criticalOpenings.length} department role bucket(s) still require hiring attention.`,
      tone: "info",
      tag: "Recruitment",
    });
  }

  if (performanceRows.length) {
    list.push({
      title: "Performance spotlight",
      detail: `${performanceRows[0].employee.name} leads the productivity board with a ${performanceRows[0].score}/100 score.`,
      tone: "good",
      tag: "Recognition",
    });
  }

  if (crmSummary.followups > 0 || crmSummary.appointments > 0) {
    list.push({
      title: "CRM workload update",
      detail: `${crmSummary.appointments} appointments and ${crmSummary.followups} follow-up item(s) are active in the live CRM view.`,
      tone: "info",
      tag: "CRM",
    });
  }

  if (projectSummary.blockedAssignments > 0 || projectSummary.unassignedProjects > 0) {
    list.push({
      title: "Project allocation alert",
      detail: `${projectSummary.blockedAssignments} blocked assignment(s) and ${projectSummary.unassignedProjects} unassigned project(s) need coordination.`,
      tone:
        projectSummary.blockedAssignments > 0 ? "warn" : "info",
      tag: "Projects",
    });
  }

  return list.concat(HR_NOTICES);
}

function renderDashboard() {
  const employees = hrState.employees;
  const attendanceSummary = hrState.attendance.summary || {};
  const recentJoiners = getRecentJoiners();
  const onLeaveToday = getEmployeesOnLeaveToday();
  const openings = buildOpenPositions();
  const pipeline = buildRecruitmentPipeline(openings);
  const pendingInterviews = pipeline.find(
    (item) => item.stage === "Interview Scheduled",
  )?.count || 0;

  const activeAttendanceCount =
    Number(attendanceSummary.present || 0) +
    Number(attendanceSummary.grace || 0) +
    Number(attendanceSummary.late || 0) +
    Number(attendanceSummary.checkoutPending || 0);
  const activeEmployees = employees.filter((employee) => {
    const attendanceStatus = String(employee.attendance_status || "").toLowerCase();
    return (
      ["present", "grace", "late", "checkout_pending", "half_day"].includes(attendanceStatus) ||
      Number(employee.total_leads || 0) > 0 ||
      Number(employee.total_appointments || 0) > 0 ||
      Number(employee.total_followups || 0) > 0 ||
      Number(employee.project_assignments || 0) > 0
    );
  }).length;
  const attendanceCoverage = employees.length
    ? `${Math.round((activeAttendanceCount / employees.length) * 100)}%`
    : "0%";

  setText("metricTotalEmployees", formatCompactNumber(employees.length));
  setText(
    "metricActiveEmployees",
    formatCompactNumber(activeEmployees),
  );
  setText(
    "metricNewJoiners",
    formatCompactNumber(employees.filter(isRecentJoiner).length),
  );
  setText("metricEmployeesOnLeave", formatCompactNumber(onLeaveToday.length));
  setText(
    "metricOpenPositions",
    formatCompactNumber(
      openings.reduce((sum, opening) => sum + Number(opening.openCount || 0), 0),
    ),
  );
  setText("metricAttendanceStatus", attendanceCoverage);
  setText("metricPendingInterviews", formatCompactNumber(pendingInterviews));
  setText("metricMonthlyResignations", "0");

  renderStackList(
    "recentJoinersList",
    recentJoiners.map((employee) => ({
      title: employee.name || "Employee",
      detail: `${formatRole(employee.role)} | ${employee.comp_name || "Metrics Mart"} | Joined ${formatDate(employee.joining_date)}`,
      tag: employee.profile_setup_status === "completed" ? "Ready" : "Onboarding",
      tone: employee.profile_setup_status === "completed" ? "good" : "warn",
    })),
    "No recent joiners this month.",
  );

  renderStackList(
    "employeesOnLeaveList",
    onLeaveToday.map((employee) => ({
      title: employee.name || "Employee",
      detail: `${formatRole(employee.role)} | ${String(employee.today_leave_type || "Leave").replace(/_/g, " ")}`,
      tag: "Approved Leave",
      tone: "warn",
    })),
    "No employees are on approved leave today.",
  );

  const performanceRows = buildPerformanceRows(hrState.employees);
  const tasks = buildTasksBoard(openings, performanceRows);

  renderStackList(
    "dashboardTasksList",
    tasks.urgent.concat(tasks.week).slice(0, 6),
    "No urgent HR actions right now.",
  );

  renderDepartmentChart();
  renderAttendanceChart();
}

function renderEmployees() {
  const employees = hrState.filteredEmployees;
  renderEmployeeStatusCards(employees);
  renderEmployeeDirectory(employees);
  renderDepartmentManagement();
  renderReportingManagers(employees);
  renderEmployeeProfiles(employees);
  renderDocumentDirectory(employees);
}

function renderRecruitment() {
  const openings = buildOpenPositions();
  const pipeline = buildRecruitmentPipeline(openings);

  renderMetricCardGrid("recruitmentMetricGrid", [
    {
      label: "Job Openings",
      value: openings.reduce((sum, opening) => sum + opening.openCount, 0),
      note: "Derived from headcount targets",
    },
    {
      label: "Candidate Database",
      value: hrState.employees.filter((employee) => employee.resume_file).length,
      note: "Resume files available in talent archive",
    },
    {
      label: "Pending Interviews",
      value: pipeline.find((item) => item.stage === "Interview Scheduled")?.count || 0,
      note: "Recommended slots for active gaps",
    },
    {
      label: "Hiring Updates",
      value: getRecentJoiners(8).length,
      note: "Current onboarding-driven hiring follow-up",
    },
  ]);

  renderCardGrid(
    "jobOpeningsGrid",
    openings.map((opening) => ({
      title: opening.label,
      detail: `${opening.department} | Filled ${opening.filled}/${opening.target} | ${opening.openCount} open`,
      tag: opening.priority,
      tone:
        opening.priority === "Critical"
          ? "bad"
          : opening.priority === "Open"
            ? "warn"
            : "good",
    })),
    "Headcount targets are currently covered for all tracked roles.",
  );

  renderTableBody(
    "candidatePipelineBody",
    pipeline.map(
      (item) => `
        <tr>
          <td><strong>${escapeHtml(item.stage)}</strong></td>
          <td>${escapeHtml(formatCompactNumber(item.count))}</td>
          <td>${escapeHtml(item.notes)}</td>
        </tr>
      `,
    ),
    3,
    "No pipeline activity available.",
  );

  renderStackList(
    "interviewScheduleList",
    buildInterviewSchedule(openings),
    "No interview schedule is pending. Create requisitions to start hiring flow.",
  );

  renderStackList(
    "resumeManagementList",
    buildResumeArchive(),
    "No resume files are uploaded in employee records yet.",
  );

  renderCardGrid(
    "offerLetterGrid",
    buildOfferTracker(),
    "No onboarding offer actions are active right now.",
  );
}

function renderAttendanceSection() {
  const summary = hrState.attendance.summary || {};

  renderMetricCardGrid("attendanceMetricGrid", [
    {
      label: "Daily Attendance",
      value: Number(summary.totalUsers || hrState.employees.length || 0),
      note: "Employees tracked for today's attendance",
    },
    {
      label: "Present / Grace",
      value: Number(summary.present || 0) + Number(summary.grace || 0),
      note: "Checked in on time or within grace",
    },
    {
      label: "Late / Half Day",
      value: Number(summary.late || 0) + Number(summary.halfDay || 0),
      note: "Attendance exceptions needing review",
    },
    {
      label: "Pending Leaves",
      value: Number(hrState.leaves.summary?.pendingRequests || 0),
      note: "Leave approvals waiting for action",
    },
  ]);

  renderTableBody(
    "attendanceTableBody",
    hrState.attendance.data.map(
      (row) => `
        <tr>
          <td>
            <strong>${escapeHtml(row.user_name || "Employee")}</strong>
            <small>${escapeHtml(row.attendance_date || getTodayKey())}</small>
          </td>
          <td>${escapeHtml(formatRole(row.role))}</td>
          <td>${escapeHtml(row.check_in || "-")}</td>
          <td>${escapeHtml(row.check_out || "-")}</td>
          <td>${statusPill(getAttendanceStatusLabel(row.status || row.attendance_status), getStatusTone(row.status || row.attendance_status))}</td>
        </tr>
      `,
    ),
    5,
    "No attendance records found for today.",
  );

  const departmentStats = getDepartmentStats();
  renderCardGrid(
    "shiftManagementGrid",
    departmentStats.map((item) => ({
      title: item.name,
      detail: `${item.count} employee(s) | ${item.active} active today | ${item.onLeave} on leave`,
      tag: item.newJoiners > 0 ? `${item.newJoiners} new` : "Stable",
      tone: item.newJoiners > 0 ? "info" : "good",
    })),
    "No shift management data available.",
  );

  renderTableBody(
    "leaveQueueBody",
    hrState.leaves.data.slice(0, 12).map(
      (row) => `
        <tr>
          <td>
            <strong>${escapeHtml(row.employee_name || "Employee")}</strong>
            <small>${escapeHtml(formatDate(row.created_at))}</small>
          </td>
          <td>${escapeHtml(formatRole(row.role))}</td>
          <td>${escapeHtml(String(row.leave_type || "").replace(/_/g, " "))}</td>
          <td>${escapeHtml(formatDate(row.from_date))} - ${escapeHtml(formatDate(row.to_date))}</td>
          <td>${statusPill(row.status || "pending", getStatusTone(row.status))}</td>
          <td>${escapeHtml(String(Number(row.leave_balance || 0).toFixed(1)))}</td>
        </tr>
      `,
    ),
    6,
    "No leave applications available.",
  );

  renderCardGrid(
    "leaveBalanceGrid",
    hrState.leaves.balances.slice(0, 8).map((row) => ({
      title: row.userName || "Employee",
      detail: `Available ${Number(row.availableBalance || 0).toFixed(1)} | Carry ${Number(row.carryForwardBalance || 0).toFixed(1)} | Credit ${Number(row.currentMonthCredit || 0).toFixed(1)}`,
      tag: `${Number(row.paidLeaveDaysUsed || 0).toFixed(1)} used`,
      tone: Number(row.availableBalance || 0) > 1 ? "good" : "warn",
    })),
    "Leave balance snapshots are not available yet.",
  );
}

function renderPayrollSection() {
  const payrollRows = hrState.payroll.data || [];
  const summary = hrState.payroll.summary || {};
  const totalBonus = payrollRows.reduce(
    (sum, row) => sum + Number(row.bonusAmount || 0) + Number(row.incentiveAmount || 0),
    0,
  );
  const totalDeductions = payrollRows.reduce(
    (sum, row) => sum + Number(row.leaveDeduction || 0) + Number(row.penaltyAmount || 0),
    0,
  );
  const avgSalary = payrollRows.length
    ? payrollRows.reduce((sum, row) => sum + Number(row.finalSalary || 0), 0) / payrollRows.length
    : 0;

  renderMetricCardGrid("payrollMetricGrid", [
    {
      label: "Payroll Processing",
      value: summary.generatedEmployees || 0,
      note: `Generated out of ${summary.totalEmployees || payrollRows.length} employees`,
    },
    {
      label: "Total Monthly Payout",
      value: formatCurrency(summary.totalMonthlyPayout || 0),
      note: `For ${hrState.payroll.month || getCurrentMonthKey()}`,
    },
    {
      label: "Bonuses & Incentives",
      value: formatCurrency(totalBonus),
      note: "Combined bonus and incentive movement",
    },
    {
      label: "Deductions & Taxes",
      value: formatCurrency(totalDeductions),
      note: "Leave + penalty linked deductions",
    },
  ]);

  renderTableBody(
    "payrollTableBody",
    payrollRows.map(
      (row) => `
        <tr>
          <td>
            <strong>${escapeHtml(row.name || "Employee")}</strong>
            <small>${escapeHtml(row.department || "-")}</small>
          </td>
          <td>${escapeHtml(row.roleLabel || formatRole(row.role))}</td>
          <td>${escapeHtml(formatCurrency(row.basicSalary || 0))}</td>
          <td>${escapeHtml(formatCurrency((row.bonusAmount || 0) + (row.incentiveAmount || 0)))}</td>
          <td>${escapeHtml(formatCurrency((row.leaveDeduction || 0) + (row.penaltyAmount || 0)))}</td>
          <td>${escapeHtml(formatCurrency(row.finalSalary || 0))}</td>
        </tr>
      `,
    ),
    6,
    "No payroll rows available for the selected month.",
  );

  const extras = payrollRows
    .filter(
      (row) =>
        Number(row.bonusAmount || 0) > 0 ||
        Number(row.incentiveAmount || 0) > 0 ||
        Number(row.penaltyAmount || 0) > 0,
    )
    .slice(0, 8)
    .map((row) => ({
      title: row.name || "Employee",
      detail: `Bonus ${formatCurrency(row.bonusAmount || 0)} | Incentive ${formatCurrency(row.incentiveAmount || 0)} | Penalty ${formatCurrency(row.penaltyAmount || 0)}`,
      tag: Number(row.incentiveAmount || 0) > 0 ? "Incentive" : "Adjustment",
      tone: Number(row.incentiveAmount || 0) > 0 ? "good" : "warn",
    }));

  renderStackList(
    "payrollExtrasList",
    extras,
    "No bonus, incentive, or reimbursement-style movements recorded yet.",
  );

  renderCardGrid(
    "payrollDeductionGrid",
    [
      {
        title: "Employees With Deductions",
        detail: `${summary.employeesWithDeductions || 0} employee(s) impacted by leave or penalty deductions.`,
        tag: "Deduction View",
        tone: Number(summary.employeesWithDeductions || 0) > 0 ? "warn" : "good",
      },
      {
        title: "Average Final Salary",
        detail: formatCurrency(avgSalary),
        tag: "Average",
        tone: "info",
      },
      {
        title: "Department Expense Buckets",
        detail: `${(hrState.payroll.departmentExpense || []).length} department payout group(s) active.`,
        tag: "Expense",
        tone: "info",
      },
      {
        title: "Incentive Ready Workforce",
        detail: `${payrollRows.filter((row) => Number(row.incentiveAmount || 0) > 0).length} employee(s) earned incentives this month.`,
        tag: "Reward",
        tone: "good",
      },
    ],
    "No deduction analysis available.",
  );
}

function renderPerformanceSection() {
  const performanceRows = buildPerformanceRows(hrState.filteredEmployees);
  const readyCount = performanceRows.filter((row) => row.score >= 85).length;
  const avgScore = performanceRows.length
    ? Math.round(
        performanceRows.reduce((sum, row) => sum + row.score, 0) / performanceRows.length,
      )
    : 0;
  const taskMonitoring = hrState.filteredEmployees.filter(
    (employee) => Number(employee.project_assignments || 0) > 0,
  ).length;
  const salesContributors = hrState.filteredEmployees.filter(
    (employee) =>
      Number(employee.total_leads || 0) > 0 ||
      Number(employee.total_appointments || 0) > 0 ||
      Number(employee.total_followups || 0) > 0,
  ).length;

  renderMetricCardGrid("performanceMetricGrid", [
    {
      label: "KPI Tracking",
      value: avgScore,
      note: "Average productivity readiness score",
    },
    {
      label: "Performance Reviews",
      value: performanceRows.length,
      note: "Employees included in the current review lens",
    },
    {
      label: "Employee Ratings",
      value: readyCount,
      note: "Promotion-ready or high-potential performers",
    },
    {
      label: "Task Monitoring",
      value: taskMonitoring,
      note: `${salesContributors} employee(s) also show live CRM activity`,
    },
  ]);

  renderCardGrid(
    "productivityHighlights",
    performanceRows.slice(0, 4).map((row) => ({
      title: row.employee.name || "Employee",
      detail: `${formatRole(row.employee.role)} | Score ${row.score}/100 | ${row.rating} | ${Number(row.employee.project_assignments || 0)} projects | ${Number(row.employee.total_appointments || 0)} appointments`,
      tag: row.recommendation,
      tone: row.score >= 85 ? "good" : row.score >= 75 ? "info" : "warn",
    })),
    "No productivity highlights available.",
  );

  renderStackList(
    "promotionRecommendations",
    performanceRows
      .filter((row) => row.score >= 75)
      .slice(0, 6)
      .map((row) => ({
        title: row.employee.name || "Employee",
        detail: `${row.score}/100 score | ${row.note}`,
        tag: row.recommendation,
        tone: row.score >= 85 ? "good" : "info",
      })),
    "No promotion recommendations yet.",
  );

  renderTableBody(
    "performanceTableBody",
    performanceRows.map(
      (row) => `
        <tr>
          <td>
            <strong>${escapeHtml(row.employee.name || "Employee")}</strong>
            <small>${escapeHtml(row.employee.department || "-")}</small>
          </td>
          <td>${escapeHtml(formatRole(row.employee.role))}</td>
          <td>${escapeHtml(String(row.score))}/100</td>
          <td>${escapeHtml(row.rating)}</td>
          <td>${escapeHtml(row.note)}</td>
          <td>${statusPill(row.recommendation, row.score >= 85 ? "good" : row.score >= 75 ? "info" : "warn")}</td>
        </tr>
      `,
    ),
    6,
    "No performance review rows available.",
  );
}

function renderTasksSection() {
  const tasks = buildTasksBoard(
    buildOpenPositions(),
    buildPerformanceRows(hrState.employees),
  );

  renderTaskList("taskTodayList", tasks.urgent, "No urgent HR tasks for today.");
  renderTaskList("taskWeekList", tasks.week, "No weekly follow-ups pending.");
  renderTaskList("taskPlannedList", tasks.planned, "No planned HR tasks queued.");

  setText("taskTodayCount", formatCompactNumber(tasks.urgent.length));
  setText("taskWeekCount", formatCompactNumber(tasks.week.length));
  setText("taskPlannedCount", formatCompactNumber(tasks.planned.length));
}

function renderDocumentsSection() {
  const employees = hrState.filteredEmployees;
  const withFullDocs = employees.filter(
    (employee) => getDocumentCompletion(employee).missing === 0,
  ).length;
  const idProofReady = employees.filter(
    (employee) => employee.aadhar_img && employee.pan_img,
  ).length;
  const certificatesReady = employees.filter((employee) => employee.certification_file).length;

  renderMetricCardGrid("complianceMetricGrid", [
    {
      label: "Offer / Contract Readiness",
      value: withFullDocs,
      note: "Employees with complete tracked documents",
    },
    {
      label: "ID Proofs",
      value: idProofReady,
      note: "Employees with Aadhaar and PAN uploaded",
    },
    {
      label: "Certificates",
      value: certificatesReady,
      note: "Certification archive currently available",
    },
    {
      label: "NDA / Policy Follow-up",
      value: employees.length - withFullDocs,
      note: "Employees needing more compliance closure",
    },
  ]);

  renderTableBody(
    "complianceTableBody",
    employees.map((employee) => {
      const docCompletion = getDocumentCompletion(employee);
      return `
        <tr>
          <td>
            <strong>${escapeHtml(employee.name || "Employee")}</strong>
            <small>${escapeHtml(formatRole(employee.role))}</small>
          </td>
          <td>${employee.resume_file ? statusPill("Offer Docs", "good") : statusPill("Pending", "warn")}</td>
          <td>${employee.aadhar_img && employee.pan_img ? statusPill("Verified", "good") : statusPill("Missing", "bad")}</td>
          <td>${employee.cancelled_cheque ? statusPill("Available", "good") : statusPill("Required", "warn")}</td>
          <td>${employee.certification_file || employee.experience_file ? statusPill("Uploaded", "good") : statusPill("Pending", "info")}</td>
          <td>${escapeHtml(`${docCompletion.percent}% complete`)}</td>
        </tr>
      `;
    }),
    6,
    "No compliance data available.",
  );

  renderCardGrid(
    "policyLibraryGrid",
    POLICY_LIBRARY.map((item) => ({
      title: item.title,
      detail: item.detail,
      tag: "Policy",
      tone: "info",
    })),
    "Policy library is not available.",
  );
}

function renderReportsSection() {
  const attendanceSummary = hrState.attendance.summary || {};
  const payrollSummary = hrState.payroll.summary || {};
  const leaveSummary = hrState.leaves.summary || {};
  const employees = hrState.employees.length;
  const crmSummary = getCrmSummary();
  const projectSummary = getProjectTrackerSummary();
  const presentEquivalent =
    Number(attendanceSummary.present || 0) +
    Number(attendanceSummary.grace || 0) +
    Number(attendanceSummary.late || 0);
  const attendanceRate = employees ? Math.round((presentEquivalent / employees) * 100) : 0;
  const complianceRate = hrState.employees.length
    ? Math.round(
        (hrState.employees.filter((employee) => getDocumentCompletion(employee).missing === 0)
          .length /
          hrState.employees.length) *
          100,
      )
    : 0;

  renderMetricCardGrid("reportsMetricGrid", [
    {
      label: "Headcount Report",
      value: employees,
      note: "Current workforce size",
    },
    {
      label: "Attendance Report",
      value: `${attendanceRate}%`,
      note: "Present/grace/late coverage",
    },
    {
      label: "Leave Report",
      value: Number(leaveSummary.pendingRequests || 0),
      note: "Pending leave approvals",
    },
    {
      label: "CRM Activity",
      value: formatCompactNumber(crmSummary.leads),
      note: `${crmSummary.appointments} appointments | ${crmSummary.followups} follow-ups | ${crmSummary.deals} deals`,
    },
    {
      label: "Project Delivery",
      value: formatCompactNumber(projectSummary.totalProjects),
      note: `${projectSummary.ongoingProjects} ongoing | ${projectSummary.blockedAssignments} blocked assignments`,
    },
    {
      label: "Payroll Report",
      value: formatCurrency(payrollSummary.totalMonthlyPayout || 0),
      note: "Monthly payroll outflow",
    },
  ]);

  renderRoleMixChart();
  renderComplianceChart(complianceRate);

  const highlights = [
    {
      title: "Headcount overview",
      detail: `${employees} employee(s) are currently tracked across HR, sales, marketing, technology, finance, and operations roles.`,
      tag: "Headcount",
      tone: "info",
    },
    {
      title: "Attendance report",
      detail: `${attendanceRate}% of the workforce is marked present/grace/late for today's working cycle.`,
      tag: "Attendance",
      tone: attendanceRate >= 75 ? "good" : "warn",
    },
    {
      title: "Leave pressure",
      detail: `${Number(leaveSummary.pendingRequests || 0)} leave request(s) are pending and ${Number(leaveSummary.employeesOnLeaveToday || 0)} employee(s) are on leave today.`,
      tag: "Leave",
      tone: Number(leaveSummary.pendingRequests || 0) > 0 ? "warn" : "good",
    },
    {
      title: "Compliance coverage",
      detail: `${complianceRate}% of employees have complete tracked documents in the HR compliance view.`,
      tag: "Compliance",
      tone: complianceRate >= 70 ? "good" : "warn",
    },
    {
      title: "CRM pipeline snapshot",
      detail: `${crmSummary.leads} leads, ${crmSummary.appointments} appointments, ${crmSummary.followups} follow-up item(s), and ${crmSummary.deals} deal(s) are active across the website.`,
      tag: "CRM",
      tone: crmSummary.followups > 0 ? "info" : "good",
    },
    {
      title: "Project tracker summary",
      detail: `${projectSummary.totalProjects} tracked project(s) with ${projectSummary.ongoingProjects} ongoing, ${projectSummary.completedProjects} completed, and ${projectSummary.blockedAssignments} blocked assignment(s).`,
      tag: "Projects",
      tone: projectSummary.blockedAssignments > 0 ? "warn" : "good",
    },
  ];

  renderStackList(
    "reportHighlightsList",
    highlights,
    "No report highlights available.",
  );
}

function renderAnnouncementsSection() {
  const announcements = buildAnnouncements(
    buildOpenPositions(),
    buildPerformanceRows(hrState.employees),
  );
  const birthdayItems = hrState.employees
    .filter((employee) => {
      if (!employee.date_of_birth) return false;
      const date = new Date(employee.date_of_birth);
      return !Number.isNaN(date.getTime()) && date.getMonth() === new Date().getMonth();
    })
    .map((employee) => ({
      title: employee.name || "Employee",
      detail: `Birthday month celebration | ${formatRole(employee.role)} | ${formatDate(employee.date_of_birth)}`,
      tag: "Birthday",
      tone: "good",
    }));

  renderStackList(
    "announcementsGrid",
    announcements,
    "No announcements are ready right now.",
  );

  renderStackList(
    "birthdayNoticesList",
    birthdayItems.concat(HR_NOTICES),
    "No birthdays or notices available.",
  );
}

function renderEmployeeStatusCards(employees) {
  const onboarding = employees.filter(
    (employee) => String(employee.profile_setup_status || "").toLowerCase() !== "completed",
  ).length;
  const onLeave = employees.filter((employee) => Number(employee.is_on_leave_today || 0)).length;
  const docsMissing = employees.filter(
    (employee) => getDocumentCompletion(employee).missing > 0,
  ).length;
  const teamLeads = employees.filter((employee) => Number(employee.is_team_lead || 0)).length;

  renderMetricCardGrid("employeeStatusGrid", [
    { label: "Employee Directory", value: employees.length, note: "Visible in current filter" },
    { label: "Status Tracking", value: onLeave, note: "Employees currently on leave" },
    { label: "Profile Completion", value: onboarding, note: "Profiles still pending completion" },
    { label: "Document Gaps", value: docsMissing, note: "Employees missing tracked documents" },
    { label: "Reporting Managers", value: teamLeads, note: "Team leads available in current team" },
  ]);
}

function renderEmployeeDirectory(employees) {
  renderTableBody(
    "employeeDirectoryBody",
    employees.map((employee) => {
      const lifecycle = getEmployeeLifecycleStatus(employee);
      const docCompletion = getDocumentCompletion(employee);
      return `
        <tr>
          <td>
            <strong>${escapeHtml(employee.name || "Employee")}</strong>
            <small>${escapeHtml(employee.email || employee.contact || "-")}</small>
          </td>
          <td><span class="employee-directory-role">${escapeHtml(formatRole(employee.role))}</span></td>
          <td><span class="employee-directory-department">${escapeHtml(employee.department || "-")}</span></td>
          <td>${statusPill(lifecycle.label, lifecycle.tone)}</td>
          <td>${escapeHtml(getManagerLabel(employee))}</td>
          <td>${escapeHtml(`${docCompletion.present}/${docCompletion.required}`)}</td>
          <td>
            <button type="button" class="profile-action-btn" onclick="openHrEmployeeProfile(${Number(employee.id)})">
              View Profile
            </button>
          </td>
        </tr>
      `;
    }),
    7,
    "No employees match the current search.",
  );
}

function renderDepartmentManagement() {
  renderCardGrid(
    "departmentManagementGrid",
    getDepartmentStats().map((item) => ({
      title: item.name,
      detail: `${item.count} employee(s) | ${item.active} active | ${item.onLeave} on leave`,
      tag: item.newJoiners > 0 ? `${item.newJoiners} new` : "Stable",
      tone: item.newJoiners > 0 ? "info" : "good",
    })),
    "No department statistics available.",
  );
}

function renderReportingManagers(employees) {
  const grouped = new Map();
  employees.forEach((employee) => {
    const manager = getManagerLabel(employee);
    if (!grouped.has(manager)) {
      grouped.set(manager, []);
    }
    grouped.get(manager).push(employee);
  });

  renderStackList(
    "reportingManagersGrid",
    Array.from(grouped.entries()).map(([manager, team]) => ({
      title: manager,
      detail: `${team.length} reportee(s) | ${team
        .slice(0, 3)
        .map((employee) => employee.name)
        .join(", ")}${team.length > 3 ? "..." : ""}`,
      tag: "Manager",
      tone: "info",
    })),
    "No reporting manager data available.",
  );
}

function renderEmployeeProfiles(employees) {
  renderCardGrid(
    "employeeProfilesGrid",
    employees.slice(0, 8).map((employee) => ({
      title: employee.name || "Employee",
      detail: `${formatRole(employee.role)} | Joined ${formatDate(employee.joining_date)} | Skills ${parseSkills(employee.skills).join(", ") || "Not added"}`,
      tag:
        String(employee.profile_setup_status || "").toLowerCase() === "completed"
          ? "Profile Ready"
          : "Setup Pending",
      tone:
        String(employee.profile_setup_status || "").toLowerCase() === "completed"
          ? "good"
          : "warn",
    })),
    "No employee profiles available.",
  );
}

function renderDocumentDirectory(employees) {
  renderTableBody(
    "documentDirectoryBody",
    employees.map((employee) => {
      const docCompletion = getDocumentCompletion(employee);
      const idStatus = employee.aadhar_img && employee.pan_img ? "Verified" : "Pending";
      const banking = employee.cancelled_cheque ? "Cheque Uploaded" : "Cheque Missing";
      const careerDocs =
        employee.resume_file || employee.experience_file || employee.certification_file
          ? "Available"
          : "Pending";
      return `
        <tr>
          <td>
            <strong>${escapeHtml(employee.name || "Employee")}</strong>
            <small>${escapeHtml(formatRole(employee.role))}</small>
          </td>
          <td>${statusPill(String(employee.profile_setup_status || "pending").replace(/_/g, " "), getStatusTone(employee.profile_setup_status))}</td>
          <td>${statusPill(idStatus, idStatus === "Verified" ? "good" : "warn")}</td>
          <td>${statusPill(banking, employee.cancelled_cheque ? "good" : "warn")}</td>
          <td>${statusPill(careerDocs, careerDocs === "Available" ? "good" : "info")}</td>
          <td>${escapeHtml(`${docCompletion.percent}% complete`)}</td>
        </tr>
      `;
    }),
    6,
    "No document records available.",
  );
}

function renderMetricCardGrid(containerId, items) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = items
    .map(
      (item) => `
        <article class="metric-card">
          <span>${escapeHtml(item.label)}</span>
          <strong>${escapeHtml(String(item.value))}</strong>
          <small>${escapeHtml(item.note || "")}</small>
        </article>
      `,
    )
    .join("");
}

function renderCardGrid(containerId, items, emptyText) {
  const container = document.getElementById(containerId);
  if (!container) return;
  if (!items.length) {
    container.innerHTML = buildEmptyState(emptyText);
    return;
  }
  container.innerHTML = items
    .map(
      (item) => `
        <article class="mini-card">
          <h4>${escapeHtml(item.title)}</h4>
          <p>${escapeHtml(item.detail)}</p>
          <div class="meta-row">${statusPill(item.tag || "Info", item.tone || "info")}</div>
        </article>
      `,
    )
    .join("");
}

function renderStackList(containerId, items, emptyText) {
  const container = document.getElementById(containerId);
  if (!container) return;
  if (!items.length) {
    container.innerHTML = buildEmptyState(emptyText);
    return;
  }

  container.innerHTML = items
    .map(
      (item) => `
        <article class="stack-item">
          <h4>${escapeHtml(item.title)}</h4>
          <p>${escapeHtml(item.detail)}</p>
          <div class="meta-row">${statusPill(item.tag || "Info", item.tone || "info")}</div>
        </article>
      `,
    )
    .join("");
}

function renderTaskList(containerId, items, emptyText) {
  const container = document.getElementById(containerId);
  if (!container) return;
  if (!items.length) {
    container.innerHTML = buildEmptyState(emptyText);
    return;
  }

  container.innerHTML = items
    .map(
      (item) => `
        <article class="task-item">
          <h4>${escapeHtml(item.title)}</h4>
          <p>${escapeHtml(item.detail)}</p>
          <div class="meta-row">${statusPill(item.tag || "Task", item.tone || "info")}</div>
        </article>
      `,
    )
    .join("");
}

function renderTableBody(containerId, rows, colspan, emptyText) {
  const body = document.getElementById(containerId);
  if (!body) return;
  if (!rows.length) {
    body.innerHTML = `<tr><td colspan="${colspan}">${buildEmptyState(emptyText)}</td></tr>`;
    return;
  }
  body.innerHTML = rows.join("");
}

function renderChart(key, canvasId, config) {
  const canvas = document.getElementById(canvasId);
  if (!canvas?.getContext) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  if (chartInstances[key]) {
    chartInstances[key].destroy();
  }

  chartInstances[key] = new Chart(ctx, config);
}

function renderDepartmentChart() {
  const stats = getDepartmentStats();
  renderChart("department", "hrDepartmentChart", {
    type: "bar",
    data: {
      labels: stats.map((item) => item.name),
      datasets: [
        {
          label: "Employees",
          data: stats.map((item) => item.count),
          backgroundColor: HR_THEME.accentSoftLight,
          borderColor: HR_THEME.accent,
          borderWidth: 1.5,
          borderRadius: 12,
        },
      ],
    },
    options: chartOptions(false),
  });
}

function renderAttendanceChart() {
  const summary = hrState.attendance.summary || {};
  renderChart("attendance", "hrAttendanceChart", {
    type: "doughnut",
    data: {
      labels: ["Present", "Grace", "Late", "Half Day", "Absent"],
      datasets: [
        {
          data: [
            Number(summary.present || 0),
            Number(summary.grace || 0),
            Number(summary.late || 0),
            Number(summary.halfDay || 0),
            Number(summary.absent || 0),
          ],
          backgroundColor: [
            HR_THEME.accent,
            HR_THEME.accentLight,
            HR_THEME.warning,
            "#fb923c",
            HR_THEME.danger,
          ],
          borderWidth: 0,
        },
      ],
    },
    options: chartOptions(true),
  });
}

function renderRoleMixChart() {
  const counts = getRoleCounts();
  const labels = Object.keys(counts).map((role) => formatRole(role));
  renderChart("roleMix", "hrRoleMixChart", {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: "Headcount",
          data: Object.values(counts),
          backgroundColor: [
            HR_THEME.accent,
            HR_THEME.accentLight,
            HR_THEME.info,
            HR_THEME.success,
            "#8b5cf6",
            "#f97316",
            "#eab308",
            "#14b8a6",
          ],
          borderRadius: 12,
        },
      ],
    },
    options: chartOptions(false),
  });
}

function renderComplianceChart(complianceRate) {
  renderChart("compliance", "hrComplianceChart", {
    type: "doughnut",
    data: {
      labels: ["Complete", "Pending"],
      datasets: [
        {
          data: [complianceRate, Math.max(0, 100 - complianceRate)],
          backgroundColor: [HR_THEME.success, HR_THEME.border],
          borderWidth: 0,
        },
      ],
    },
    options: chartOptions(true),
  });
}

function chartOptions(isDoughnut) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: isDoughnut,
        position: isDoughnut ? "bottom" : "top",
        labels: {
          color: HR_THEME.slate,
          usePointStyle: true,
          boxWidth: 10,
        },
      },
    },
    scales: isDoughnut
      ? {}
      : {
          y: {
            beginAtZero: true,
            ticks: {
              color: HR_THEME.slate,
              precision: 0,
            },
            grid: {
              color: "rgba(203, 213, 225, 0.45)",
            },
          },
          x: {
            ticks: {
              color: HR_THEME.slate,
            },
            grid: {
              display: false,
            },
          },
        },
  };
}

function showToast(message, isError = false) {
  const toast = document.getElementById("hrToast");
  if (!toast) return;
  toast.textContent = message;
  toast.classList.remove("hidden");
  toast.style.background = isError ? "#991b1b" : "#0f172a";

  if (toastTimer) {
    clearTimeout(toastTimer);
  }

  toastTimer = setTimeout(() => {
    toast.classList.add("hidden");
  }, 2600);
}

function hideHrActionPopup() {
  const popup = document.getElementById("hrProfileSetupPopup");
  if (hrPopupTimer) {
    clearTimeout(hrPopupTimer);
    hrPopupTimer = null;
  }
  popup?.classList.add("hidden");
}

function showHrActionPopup(title, message, isSuccess, options = {}) {
  const popup = document.getElementById("hrProfileSetupPopup");
  const icon = document.getElementById("hrProfileSetupPopupIcon");
  const titleEl = document.getElementById("hrProfileSetupPopupTitle");
  const messageEl = document.getElementById("hrProfileSetupPopupMessage");
  const actionsEl = document.getElementById("hrProfileSetupPopupActions");

  if (!popup || !titleEl || !messageEl) {
    showToast(message || title, !isSuccess);
    return;
  }

  titleEl.textContent = title || "Profile Form";
  messageEl.textContent = message || "";

  if (icon) {
    icon.className = isSuccess ? "fas fa-check-circle" : "fas fa-exclamation-circle";
    icon.style.color = isSuccess ? HR_THEME.accent : HR_THEME.danger;
  }

  if (hrPopupTimer) {
    clearTimeout(hrPopupTimer);
    hrPopupTimer = null;
  }

  if (actionsEl) {
    actionsEl.innerHTML = "";
    const actions = Array.isArray(options.actions) ? options.actions : [];
    actionsEl.classList.toggle("hidden", actions.length === 0);

    actions.forEach((action) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `popup-action-btn ${action.variant || "secondary"}`;
      button.textContent = action.label || "Action";
      button.addEventListener("click", () => action.onClick?.(button));
      actionsEl.appendChild(button);
    });
  }

  popup.classList.remove("hidden");

  if (options.autoClose !== false) {
    hrPopupTimer = setTimeout(() => {
      popup.classList.add("hidden");
    }, options.autoCloseMs || 1800);
  }
}

function logout() {
  localStorage.removeItem("currentUser");
  window.location.href = "mp.html";
}

function setHrAttendanceFaceStatus(message, type = "neutral") {
  const status = document.getElementById("hrAttendanceFaceStatus");
  if (!status) return;

  status.textContent = message || "";
  status.dataset.type = type;
}

function clearHrAttendanceFaceCapture(message, type = "neutral") {
  const form = document.getElementById("hrRegisterForm");
  if (form?.elements?.attendance_face_image) {
    form.elements.attendance_face_image.value = "";
  }
  if (form?.elements?.attendance_face_signature) {
    form.elements.attendance_face_signature.value = "";
  }

  setHrAttendanceFaceStatus(
    message || "Employee can also complete this from profile setup link.",
    type,
  );
}

async function captureHrAttendanceFaceEnrollment() {
  const button = document.getElementById("hrAttendanceFaceCaptureBtn");
  const form = document.getElementById("hrRegisterForm");

  if (!window.AttendanceFace?.captureEnrollment) {
    setHrAttendanceFaceStatus("Camera module is not loaded.", "error");
    return;
  }

  try {
    if (button) button.disabled = true;
    setHrAttendanceFaceStatus("Opening camera...", "neutral");
    const payload = await window.AttendanceFace.captureEnrollment({
      title: "Private Attendance Face Setup",
      actionLabel: "Save Face",
    });

    if (!payload?.faceImage || !payload?.faceSignature) {
      throw new Error("Face capture failed. Please retry.");
    }

    if (form?.elements?.attendance_face_image) {
      form.elements.attendance_face_image.value = payload.faceImage;
    }
    if (form?.elements?.attendance_face_signature) {
      form.elements.attendance_face_signature.value = JSON.stringify(payload.faceSignature);
    }

    setHrAttendanceFaceStatus("Live face photo captured privately.", "success");
  } catch (error) {
    setHrAttendanceFaceStatus(
      error.message || "Face capture failed. Please retry.",
      "error",
    );
  } finally {
    if (button) button.disabled = false;
  }
}

function openHrUserForm() {
  const modal = document.getElementById("hrUserRegistrationModal");
  if (!modal) return;

  resetHrUserForm();
  modal.classList.remove("hidden");
  modal.setAttribute("aria-hidden", "false");

  const firstInput = modal.querySelector('input[name="name"]');
  firstInput?.focus();
  window.requestAnimationFrame(() => {
    populateHrNextEmployeeCode();
  });
}

function closeHrUserForm() {
  const modal = document.getElementById("hrUserRegistrationModal");
  if (!modal) return;

  modal.classList.add("hidden");
  modal.setAttribute("aria-hidden", "true");
  resetHrUserForm();
}

function resetHrUserForm() {
  const form = document.getElementById("hrRegisterForm");
  if (!form) return;

  form.reset();

  const companyField = form.querySelector('select[name="comp_name"]');
  const loginField = form.querySelector('input[name="login_time"]');
  const logoutField = form.querySelector('input[name="logout_time"]');
  const joiningField = form.querySelector('input[name="joining_date"]');

  if (companyField) {
    companyField.value = "Metrics Mart Infoline Pvt Ltd";
  }
  if (loginField) {
    loginField.value = "10:00";
  }
  if (logoutField) {
    logoutField.value = "18:00";
  }
  if (joiningField) {
    joiningField.value = getTodayKey();
  }

  toggleHrUserCompensationFields();
  clearHrAttendanceFaceCapture();
}

async function populateHrNextEmployeeCode() {
  const form = document.getElementById("hrRegisterForm");
  const employeeCodeField = form?.elements?.employee_code;
  if (!employeeCodeField) return;

  employeeCodeField.value = "Generating...";

  try {
    const response = await fetch(`${BASE_URL}/api/users/next-employee-code`, {
      cache: "no-store",
    });
    const result = await response.json().catch(() => ({}));

    if (!response.ok || !result.success) {
      throw new Error(result.message || "Failed to generate employee code");
    }

    employeeCodeField.value =
      result.employeeCode ||
      result.data?.employee_code ||
      "";
  } catch (error) {
    console.warn("HR next employee code load failed:", error);
    employeeCodeField.value = "Auto-generated";
  }
}

async function submitHrUserRegistration(event) {
  event.preventDefault();

  const form = event.currentTarget;
  const submitBtn =
    document.getElementById("hrRegisterBtn") ||
    form.querySelector('button[type="submit"]');
  const originalLabel = submitBtn?.innerHTML || "";
  const formData = new FormData(form);
  const password = String(formData.get("spswd") || "");
  const confirmPassword = String(formData.get("cpswd") || "");
  const role = String(formData.get("role") || "").toLowerCase().trim();
  const canUseSalesCompensation = HR_SALES_COMPENSATION_ROLES.has(role);
  const compensationType = canUseSalesCompensation
    ? String(formData.get("compensation_type") || "salary").toLowerCase()
    : "salary";

  if (password !== confirmPassword) {
    showToast("Password and confirm password must match.", true);
    return;
  }

  formData.set("compensation_type", compensationType);

  if (compensationType === "commission") {
    if (!canUseSalesCompensation) {
      showToast("Commission payout sirf ME/TME role ke liye hai.", true);
      return;
    }
    formData.set("salary", "0");
    formData.set("commission_percent", String(FIXED_SALES_COMMISSION_PERCENT));
  } else {
    formData.set("commission_percent", "0");
  }

  if (currentUser?.id) {
    formData.set("created_by", String(currentUser.id));
    formData.set("updated_by", String(currentUser.id));
  }

  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating';
  }

  try {
    const response = await fetch(`${BASE_URL}/register`, {
      method: "POST",
      body: formData,
    });
    const data = await response.json().catch(() => ({}));

    if (!response.ok || data.success === false) {
      throw new Error(data.message || `Request failed (${response.status})`);
    }

    const inviteResult = data.profileSetup
      ? await handleHrProfileSetupInvite(data.profileSetup)
      : null;
    const successMessage = inviteResult?.emailSent
      ? "User created successfully. Profile form email sent successfully."
      : inviteResult?.copied
        ? "User created successfully. Profile form link copied."
        : "User created successfully. Profile form link is ready for manual sharing.";

    closeHrUserForm();
    await refreshHrPanel({ showSuccessToast: false });
    showToast(successMessage);
    if (!inviteResult?.emailSent && data.userId) {
      showHrProfileSetupEmailPrompt(data.userId, data.profileSetup, inviteResult);
    }
  } catch (error) {
    console.error("HR user registration failed:", error);
    showToast(error.message || "Failed to create user.", true);
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalLabel;
    }
  }
}

async function copyTextToClipboard(text) {
  const value = String(text || "").trim();
  if (!value) return false;

  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(value);
      return true;
    } catch (error) {
      console.warn("Clipboard copy failed:", error);
    }
  }

  const tempInput = document.createElement("textarea");
  tempInput.value = value;
  tempInput.setAttribute("readonly", "true");
  tempInput.style.position = "fixed";
  tempInput.style.opacity = "0";
  document.body.appendChild(tempInput);
  tempInput.select();

  let copied = false;
  try {
    copied = document.execCommand("copy");
  } catch (error) {
    console.warn("Legacy clipboard copy failed:", error);
  }

  document.body.removeChild(tempInput);
  return copied;
}

async function handleHrProfileSetupInvite(profileSetup) {
  const invitationLink = String(profileSetup?.invitationLink || "").trim();
  const emailDispatch = profileSetup?.emailDispatch || {};
  const emailSent = Boolean(emailDispatch.sent);
  const requiredConfig = Array.isArray(emailDispatch.missingConfig)
    ? emailDispatch.missingConfig.filter((value) => String(value || "").trim())
    : [];
  const emailMessage = emailSent
    ? "Profile form email sent successfully."
    : requiredConfig.length
      ? "Profile form link is ready. Open the email draft to review and send it."
      : "Profile form email is ready to send. Click Send Profile Link by Email to deliver it.";

  return {
    copied: false,
    emailSent,
    emailMessage,
    invitationLink,
    requiredConfig,
  };
}

function openHrProfileSetupDraft(profileSetup) {
  const gmailComposeUrl = String(profileSetup?.gmailComposeUrl || "").trim();
  const mailtoUrl = String(profileSetup?.mailtoUrl || "").trim();
  const draftUrl = gmailComposeUrl || mailtoUrl;
  if (!draftUrl) return false;
  window.open(draftUrl, "_blank", "noopener,noreferrer");
  return true;
}

function getHrProfileSetupFallbackActions(profileSetup = {}) {
  const actions = [];
  if (profileSetup.gmailComposeUrl || profileSetup.mailtoUrl) {
    actions.push({
      label: "Open Email Draft",
      variant: "primary",
      onClick: () => openHrProfileSetupDraft(profileSetup),
    });
  }

  actions.push({
    label: "Copy Link",
    variant: "secondary",
    onClick: async () => {
      const copied = await copyTextToClipboard(profileSetup.invitationLink || "");
      showHrActionPopup(
        copied ? "Link Copied" : "Profile Link",
        copied ? "Profile form link copied." : profileSetup.invitationLink || "Profile form link unavailable.",
        copied,
        { autoClose: copied ? undefined : false },
      );
    },
  });

  actions.push({
    label: "Close",
    variant: "secondary",
    onClick: hideHrActionPopup,
  });

  return actions;
}

function showHrProfileSetupEmailPrompt(userId, profileSetup, inviteResult = {}) {
  const message = inviteResult.emailMessage ||
    "Profile form email is ready to send. Click Send Profile Link by Email to deliver it.";
  const canTryAutomaticEmail =
    !Array.isArray(inviteResult.requiredConfig) || inviteResult.requiredConfig.length === 0;
  const actions = [
    ...(canTryAutomaticEmail
      ? [
          {
            label: "Send Profile Link by Email",
            variant: "primary",
            onClick: (button) => resendHrProfileSetupEmail(userId, profileSetup, button),
          },
        ]
      : []),
    ...getHrProfileSetupFallbackActions(profileSetup),
  ];

  showHrActionPopup(
    "Profile Form Ready To Send",
    message,
    true,
    {
      autoClose: false,
      actions,
    },
  );
}

async function resendHrProfileSetupEmail(userId, profileSetup = {}, button = null) {
  const normalizedUserId = Number(userId || 0);
  let latestProfileSetup = profileSetup || {};
  if (!normalizedUserId) {
    showHrActionPopup(
      "Profile Form",
      "User was created, but user id is missing for email resend.",
      false,
      { autoClose: false, actions: [{ label: "Close", variant: "secondary", onClick: hideHrActionPopup }] },
    );
    return;
  }

  const originalLabel = button?.textContent || "";
  if (button) {
    button.disabled = true;
    button.textContent = "Sending...";
  }

  try {
    showToast("Sending profile form email...");
    const response = await fetch(`${BASE_URL}/api/admin/users/${normalizedUserId}/profile-setup-link`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requireEmail: false }),
    });
    const result = await response.json().catch(() => ({}));
    const nextProfileSetup = result.profileSetup || profileSetup || {};
    latestProfileSetup = nextProfileSetup;
    const emailDispatch = result.emailDispatch || nextProfileSetup.emailDispatch || {};

    if (!response.ok || !result.success) {
      throw new Error(
        result.message ||
        "Profile form email could not be sent. Please share the link manually.",
      );
    }

    if (!emailDispatch.sent) {
      throw new Error(
        emailDispatch.message ||
        "Profile form email could not be sent. Please share the link manually.",
      );
    }

    showHrActionPopup(
      "Profile Form Email Sent",
      emailDispatch.message || "Profile form email sent successfully.",
      true,
    );
  } catch (error) {
    const expectedConfigMessage = /not configured|smtp/i.test(String(error?.message || ""));
    if (!expectedConfigMessage) {
      console.warn("HR profile setup email resend failed:", error);
    }
    showToast(error.message || "Profile form email could not be sent.", true);
    showHrActionPopup(
      "Email Not Sent",
      error.message || "Profile form email could not be sent. Please share the link manually.",
      false,
      {
        autoClose: false,
        actions: getHrProfileSetupFallbackActions(latestProfileSetup),
      },
    );
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = originalLabel || "Send Profile Link by Email";
    }
  }
}

window.logout = logout;
