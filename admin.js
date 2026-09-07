window.handleAdminConnectedMonthFilterChange = function(month) {
    ["adminAppointmentsMonthFilter", "adminFollowupsMonthFilter", "adminDealsMonthFilter"].forEach(id => {
        const el = document.getElementById(id);
        if (el && el.value !== month) el.value = month;
    });
    // True because we don't need to skip fetch, fetching will ensure everything is in sync across all clients
    loadAppointments();
    loadFollowups();
    loadDeals();
};
let currentUser = null;
let allTeamData = [];
let adminTeamRoleFilter = "all";
let adminTeamEmploymentStatusFilter = "active";
let dealsLineChart = null;
let adminTargetProgressChart = null;
let adminDashboardChart = null;
let adminLeadsOverviewChart = null;
let adminLeadSourceChart = null;
let adminLeadSubmitting = false;
let adminAppointmentsRows = [];
let adminPopupTimer = null;
let adminAttendanceClockPromise = null;
let adminAttendanceEmployeeOptionsScope = "";
let userFormMode = "create";
let editingUserId = null;
let proposalTemplatesCache = [];
let adminDealProductsCache = [];
let adminLeadProductsCatalog = null;
const adminChartInstances = {};
const ADMIN_METRICS_THEME_COLORS = {
    accent: "#0f766e",
    accentDark: "#115e59",
    accentDeep: "#134e4a",
    accentLight: "#14b8a6",
    accentSky: "#22d3ee",
    accentBlue: "#0ea5e9",
    success: "#22c55e",
    warning: "#f59e0b",
    neutral: "#e2e8f0",
    white: "#ffffff",
    accentFill: "rgba(15, 118, 110, 0.12)",
    accentLightFill: "rgba(20, 184, 166, 0.10)",
    accentSkyFill: "rgba(34, 211, 238, 0.10)",
};
const ADMIN_REDSEA_THEME_COLORS = {
    accent: "#dc2626",
    accentDark: "#991b1b",
    accentDeep: "#7f1d1d",
    accentLight: "#ef4444",
    accentSky: "#fb7185",
    accentBlue: "#b91c1c",
    success: "#22c55e",
    warning: "#f59e0b",
    neutral: "#fee2e2",
    white: "#ffffff",
    accentFill: "rgba(220, 38, 38, 0.12)",
    accentLightFill: "rgba(239, 68, 68, 0.10)",
    accentSkyFill: "rgba(251, 113, 133, 0.10)",
};
const ADMIN_THEME_COLORS = { ...ADMIN_METRICS_THEME_COLORS };
const USER_REGISTRATION_MAX_FILE_SIZE = 25 * 1024 * 1024;
const USER_REGISTRATION_ALLOWED_EXTENSIONS = new Set([
    ".jpg",
    ".jpeg",
    ".png",
    ".gif",
    ".webp",
    ".heic",
    ".heif",
    ".pdf",
    ".doc",
    ".docx",
]);
const SALES_COMPENSATION_ROLES = new Set(["tme", "email_marketing", "me"]);
const FIXED_SALES_COMMISSION_PERCENT = 10;
const DOWNSALE_NOTIFICATION_BADGE_REFRESH_MS = 30000;
let downsaleNotificationBadgeTimer = null;

const adminDashboardState = {
    adminSalesTarget: {
        target: 0,
        achieved: 0,
        remaining: 0,
        dealsCount: 0,
    },
    salesTarget: {
        target: 0,
        achieved: 0,
        remaining: 0,
        dealsCount: 0,
    },
    teamTargets: [],
    teamTargetSummary: {},
    teamTargetRoleSummary: {},
    leads: [],
    appointments: [],
    followups: [],
    deals: [],
    projects: [],
    renewals: [],
};
let adminDashboardCache = {
    leads: [],
    appointments: [],
    followups: [],
    deals: [],
    notifications: [],
    team: [],
    projects: [],
    renewals: [],
};
const BASE_URL =
    window.location.protocol === "file:" || ["localhost", "127.0.0.1"].includes(window.location.hostname)
        ? "http://localhost:3000"
        : window.location.origin || "https://metrics-mart-gf6l.onrender.com";
const REDSEA_ADMIN_PROFILE_IMAGE = "uploads/redsea-admin-profile.jpeg";
const METRICS_ADMIN_PROFILE_IMAGE = "uploads/metrics-admin-profile.jpeg";
const ADMIN_PANEL_COMPANY_SCOPE_STORAGE_KEY = "adminPanelCompanyScope";

function getAdminUploadedFileUrl(filePath) {
    const normalized = String(filePath || "").trim().replace(/\\/g, "/").replace(/^\/+/, "");
    if (!normalized || normalized.toUpperCase() === "NULL") return "";
    if (/^https?:\/\//i.test(normalized)) return normalized;
    const pathWithFolder = normalized.includes("/") ? normalized : `uploads/${normalized}`;
    return `${BASE_URL}/${pathWithFolder}`;
}

function normalizeCurrentUserId(user = {}) {
    const candidates = [
        user.id,
        user.user_id,
        user.userId,
        user.employee_id,
        user.employeeId,
    ];

    for (const candidate of candidates) {
        const id = Number(candidate);
        if (Number.isFinite(id) && id > 0) return id;
    }

    return 0;
}

function hydrateCurrentUserIdentity() {
    if (!currentUser) return 0;
    const userId = normalizeCurrentUserId(currentUser);
    if (userId) currentUser.id = userId;
    if (!currentUser.role) currentUser.role = "admin";
    return userId;
}

function normalizeAdminPanelCompanyKey(value) {
    const normalized = String(value || "")
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "");

    // Red Sea Digitals aliases
    if (
        normalized === "redsea" ||
        normalized === "redseadigitals" ||
        normalized === "redseadigitalspvtltd" ||
        normalized === "redseadigitalspvt" ||
        normalized.startsWith("redseadigital") ||
        normalized.includes("redseadigital")
    ) {
        return "redsea";
    }

    // Metrics Mart aliases
    if (
        normalized === "metrics" ||
        normalized === "metricsmart" ||
        normalized === "metricsmartinfolinepvtltd" ||
        normalized === "metricsmartinfolinepvt" ||
        normalized.startsWith("metricsmart") ||
        normalized.includes("metricsmart") ||
        normalized.includes("metricsmartinfoline")
    ) {
        return "metrics";
    }

    return "";
}

function formatAdminCompanyScopeLabel(value) {
    const companyKey = normalizeAdminPanelCompanyKey(value);
    if (companyKey === "redsea") return "Red Sea Digitals";
    if (companyKey === "metrics") return "Metrics Mart";
    return "-";
}

function getAdminPanelCompanyScopeStorageKey() {
    return `${ADMIN_PANEL_COMPANY_SCOPE_STORAGE_KEY}:${normalizeCurrentUserId(currentUser) || "default"}`;
}

function getStoredAdminPanelCompanyScope() {
    try {
        return normalizeAdminPanelCompanyKey(
            localStorage.getItem(getAdminPanelCompanyScopeStorageKey()),
        );
    } catch (_err) {
        return "";
    }
}

function getAdminPanelCompanyScope() {
    return (
        normalizeAdminPanelCompanyKey(
            new URLSearchParams(window.location.search).get("company") ||
                getStoredAdminPanelCompanyScope() ||
                currentUser?.company_scope ||
                currentUser?.company_key ||
                currentUser?.selected_company ||
                currentUser?.comp_name,
        ) || "metrics"
    );
}

function setAdminPanelCompanyScope(value) {
    const companyScope = normalizeAdminPanelCompanyKey(value) || "metrics";
    const url = new URL(window.location.href);
    url.searchParams.set("company", companyScope);
    window.history.replaceState({}, "", url.toString());

    try {
        localStorage.setItem(getAdminPanelCompanyScopeStorageKey(), companyScope);
    } catch (_err) {
        // Local storage may be unavailable in a restricted browser context.
    }

    return companyScope;
}

function syncAdminGlobalCompanyFilter() {
    const select = document.getElementById("adminGlobalCompanyFilter");
    if (select) {
        select.value = getAdminPanelCompanyScope();
    }
}

function getActiveAdminSectionId() {
    return document.querySelector(".section.active")?.id || "dashboard";
}

function updateAdminPanelCompanyFilterVisibility(sectionId = getActiveAdminSectionId()) {
    const filterBar = document.getElementById("adminPanelCompanyFilterBar");
    if (!filterBar) return;

    const shouldShow = normalizeAdminRole(currentUser?.role) === "admin" || normalizeAdminRole(currentUser?.role) === "superadmin";
    filterBar.classList.toggle("hidden", !shouldShow);
    syncAdminGlobalCompanyFilter();
}

function handleAdminGlobalCompanyChange(value) {
    const companyScope = setAdminPanelCompanyScope(value);
    applyAdminThemeColors();
    syncAdminGlobalCompanyFilter();
    refreshDownsaleNotificationBadge();

    const activeSectionId = getActiveAdminSectionId();
    updateAdminPanelCompanyFilterVisibility(activeSectionId);

    if (activeSectionId === "dashboard") {
        loadAdminDashboard();
        return;
    }

    if (activeSectionId === "leaveManagement") {
        window.LeaveManagementUI?.refresh?.();
        return;
    }

    showSection(activeSectionId);
}

window.handleAdminGlobalCompanyChange = handleAdminGlobalCompanyChange;

function getPendingDownsaleRequestCount(requests = []) {
    return requests.reduce((count, request) => (
        String(request?.status || "pending").toLowerCase() === "pending"
            ? count + 1
            : count
    ), 0);
}

function updateDownsaleNotificationBadge(count = 0) {
    const badge = document.getElementById("adminNotificationsBadge");
    const navItem = document.getElementById("adminNotificationsNavItem");
    const pendingCount = Math.max(Number(count) || 0, 0);

    if (!badge) return;

    badge.textContent = pendingCount > 99 ? "99+" : String(pendingCount);
    badge.setAttribute(
        "aria-label",
        `${pendingCount} pending downsale request${pendingCount === 1 ? "" : "s"}`,
    );
    badge.classList.toggle("hidden", pendingCount === 0);
    navItem?.classList.toggle("has-notification-badge", pendingCount > 0);
}

async function refreshDownsaleNotificationBadge() {
    try {
        const params = new URLSearchParams({
            companyScope: getAdminPanelCompanyScope(),
            status: "pending",
        });
        const res = await fetch(`${BASE_URL}/api/downsale-requests?${params.toString()}`, {
            cache: "no-store",
        });
        const contentType = res.headers.get("content-type") || "";

        if (!contentType.includes("application/json")) return 0;

        const data = await res.json();
        const pendingRequests = filterAdminRowsByCompanyScope(
            data.success && Array.isArray(data.data) ? data.data : [],
        );
        updateDownsaleNotificationBadge(pendingRequests.length);
        return pendingRequests.length;
    } catch (err) {
        console.warn("Downsale notification badge refresh failed:", err);
        return 0;
    }
}

function startDownsaleNotificationBadgePolling() {
    refreshDownsaleNotificationBadge();

    if (downsaleNotificationBadgeTimer) return;

    downsaleNotificationBadgeTimer = setInterval(
        refreshDownsaleNotificationBadge,
        DOWNSALE_NOTIFICATION_BADGE_REFRESH_MS,
    );
}

function applyAdminThemeColors() {
    const companyScope = getAdminPanelCompanyScope();
    Object.assign(
        ADMIN_THEME_COLORS,
        companyScope === "redsea"
            ? ADMIN_REDSEA_THEME_COLORS
            : ADMIN_METRICS_THEME_COLORS,
    );
    const isRedSea = companyScope === "redsea";
    document.body.classList.toggle("redsea-company", isRedSea);
    document.documentElement.classList.toggle("redsea-company", isRedSea);

    const avatar = document.getElementById("userAvatar");
    if (avatar && currentUser) {
        const avatarUrl = getAdminHeaderAvatarUrl(currentUser);
        if (avatarUrl) {
            avatar.src = avatarUrl;
        } else {
            avatar.removeAttribute("src");
        }
    }
}

function getAdminHeaderAvatarUrl(user = {}) {
    const profileImage = String(user.prof_img || "").trim();

    if (profileImage && profileImage.toUpperCase() !== "NULL") return getAdminUploadedFileUrl(profileImage);

    const userCompanyKey = normalizeAdminPanelCompanyKey(
        user.company_scope ||
            user.company_key ||
            user.selected_company ||
            user.comp_name,
    );

    if (normalizeAdminRole(user.role) === "admin") {
        if (userCompanyKey === "redsea") return `${BASE_URL}/${REDSEA_ADMIN_PROFILE_IMAGE}`;
        return `${BASE_URL}/${METRICS_ADMIN_PROFILE_IMAGE}`;
    }

    return "";
}

function getAdminDateKey(value = new Date()) {
    if (typeof value === "string") {
        const normalized = value.trim();
        if (/^\d{4}-\d{2}-\d{2}/.test(normalized)) {
            return normalized.slice(0, 10);
        }
    }

    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return "";

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

function getAdminMonthKey(value = new Date()) {
    if (typeof value === "string") {
        const normalized = value.trim();
        if (/^\d{4}-\d{2}$/.test(normalized)) return normalized;
        if (/^\d{4}-\d{2}-\d{2}/.test(normalized)) return normalized.slice(0, 7);
    }

    const dateKey = getAdminDateKey(value);
    return dateKey ? dateKey.slice(0, 7) : "";
}

function setupAdminDashboardControls() {
    const defaultMonth = getAdminMonthKey();
    const monthInputs = [
        document.getElementById("adminDashboardMonthFilter"),
        document.getElementById("adminTeamTargetsMonthFilter"),
    ].filter(Boolean);

    monthInputs.forEach((monthInput) => {
        monthInput.min = "2026-05";
        if (!monthInput.value) {
            monthInput.value = defaultMonth;
        }
    });
}

function syncAdminDashboardMonthFilters(monthKey = getAdminMonthKey()) {
    const normalizedMonth = /^\d{4}-\d{2}$/.test(String(monthKey || "").trim())
        ? String(monthKey || "").trim()
        : getAdminMonthKey();

    [
        "adminDashboardMonthFilter",
        "adminTeamTargetsMonthFilter",
    ].forEach((id) => {
        const monthInput = document.getElementById(id);
        if (monthInput && monthInput.value !== normalizedMonth) {
            monthInput.value = normalizedMonth;
        }
    });

    return normalizedMonth;
}

function getAdminDashboardMonth() {
    setupAdminDashboardControls();
    const monthInput =
        document.getElementById("adminDashboardYearFilter")?.value ? document.getElementById("adminDashboardYearFilter") : 
        document.getElementById("adminDashboardMonthFilter") ||
        document.getElementById("adminTeamTargetsMonthFilter");
    const monthKey = String(monthInput?.value || "").trim();
    return /^\d{4}-\d{2}$/.test(monthKey)
        ? syncAdminDashboardMonthFilters(monthKey)
        : syncAdminDashboardMonthFilters();
}

function formatAdminDashboardMonthLabel(monthKey = getAdminDashboardMonth()) {
    const match = String(monthKey || "").match(/^(\d{4})-(\d{2})$/);
    if (!match) return "selected month";

    return new Date(Number(match[1]), Number(match[2]) - 1, 1).toLocaleDateString("en-IN", {
        month: "long",
        year: "numeric",
    });
}

function isAdminDateInMonth(value, monthKey) {
    if (!monthKey) return true;
    const dateKey = getAdminDateKey(value);
    return Boolean(dateKey && dateKey.startsWith(monthKey));
}

function getAdminAttendanceMonth() {
    const monthInput = document.getElementById("adminAttendanceMonth");
    const monthKey = String(monthInput?.value || "").trim();
    return /^\d{4}-\d{2}$/.test(monthKey) ? monthKey : "";
}

async function fetchAdminAttendanceClock() {
    if (!adminAttendanceClockPromise) {
        adminAttendanceClockPromise = fetch(`${BASE_URL}/api/attendance/current-time`, {
            cache: "no-store",
        })
            .then((response) => response.json())
            .then((result) => {
                if (!result?.success) return null;
                return result;
            })
            .catch((err) => {
                console.warn("Admin attendance clock fallback:", err.message || err);
                return null;
            });
    }

    return adminAttendanceClockPromise;
}

async function resolveAdminAttendanceDate() {
    const dateInput = document.getElementById("adminAttendanceDate");
    const currentValue = String(dateInput?.value || "").trim();
    const localFallback = getAdminDateKey();

    if (currentValue && currentValue !== localFallback) {
        return currentValue;
    }

    const clock = await fetchAdminAttendanceClock();
    const serverDate = getAdminDateKey(
        clock?.today || clock?.serverDate || clock?.currentTime?.date || "",
    );
    const resolvedDate = serverDate || currentValue || localFallback;

    if (dateInput && (!currentValue || currentValue === localFallback)) {
        dateInput.value = resolvedDate;
    }

    return resolvedDate;
}

async function parseAdminApiResponse(response, routeLabel = "Admin API") {
    const text = await response.text();
    let data = {};

    if (text) {
        try {
            data = JSON.parse(text);
        } catch (_err) {
            if (response.status === 404) {
                throw new Error(`${routeLabel} route is missing on the server (404). Redeploy or restart the live backend with latest server.js.`);
            }

            throw new Error(`${routeLabel} returned an HTML/non-JSON response (${response.status || "unknown"}).`);
        }
    }

    if (response.status === 404) {
        throw new Error(`${routeLabel} route is missing on the server (404). Redeploy or restart the live backend with latest server.js.`);
    }

    return data;
}

if (window.location.protocol === "file:") {
    window.location.replace(`${BASE_URL}/admin.html`);
}

function normalizeAdminRole(role) {
    return String(role || "").trim().toLowerCase();
}

function getAdminAccessRedirect(role) {
    switch (normalizeAdminRole(role)) {
        case "admin":
            return "admin.html";
        case "hr":
            return "hr.html";
        case "tme":
            return "tme.html";
        case "email_marketing":
        case "email marketing":
        case "email-marketing":
            return "email-marketing.html";
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

// 🔥 Live Search Filter Function
function filterTable(tableId, searchInputId) {
    const searchInput = document.getElementById(searchInputId).value.toLowerCase();
    const tableRows = document.querySelectorAll(`#${tableId} tr`);
    
    tableRows.forEach(row => {
        const rowText = row.textContent.toLowerCase();
        if (rowText.includes(searchInput)) {
            row.style.display = '';
        } else {
            row.style.display = 'none';
        }
    });
}

function getAdminCompanyFilterScope(filterId) {
    const field = document.getElementById(filterId);
    return normalizeAdminPanelCompanyKey(field?.value || "") || getAdminPanelCompanyScope();
}

function getAdminScopedApiUrl(endpoint, filterId) {
    const url = new URL(endpoint, BASE_URL);
    const companyScope = getAdminCompanyFilterScope(filterId);

    if (companyScope) {
        url.searchParams.set("companyScope", companyScope);
        url.searchParams.set("company_scope", companyScope);
        url.searchParams.set("company", companyScope);
    }

    return url.toString();
}

function getAdminPanelScopedApiUrl(endpoint) {
    const url = new URL(endpoint, BASE_URL);
    const companyScope = getAdminPanelCompanyScope();

    if (companyScope) {
        url.searchParams.set("companyScope", companyScope);
        url.searchParams.set("company_scope", companyScope);
        url.searchParams.set("company", companyScope);
    }

    return url.toString();
}

function getAdminCompanyFilterEmptyText(filterId, itemName) {
    const companyScope = getAdminCompanyFilterScope(filterId);
    if (companyScope === "metrics") return `No ${itemName} found for Metrics Mart`;
    if (companyScope === "redsea") return `No ${itemName} found for Red Sea Digitals`;
    return `No ${itemName} found`;
}

function resolveAdminRecordCompanyScope(record = {}) {
    const directScope = normalizeAdminPanelCompanyKey(
        record.company_scope_key ||
            record.company_scopeKey ||
            record.company_scope ||
            record.companyScope ||
            record.company_key ||
            record.companyKey ||
            record.lead_company_scope ||
            record.lead_company ||
            record.leadCompany ||
            record.comp_name,
    );

    if (directScope) return directScope;

    return "";
}

function adminRecordMatchesCompanyFilter(record = {}, companyScope = "") {
    const normalizedScope = normalizeAdminPanelCompanyKey(companyScope);
    if (!normalizedScope) return true;

    const recordScope = resolveAdminRecordCompanyScope(record);
    if (recordScope) return recordScope === normalizedScope;

    // Existing records without a company value are legacy Metrics Mart records.
    return normalizedScope === "metrics";
}

function filterAdminRowsByCompanyScope(rows = [], companyScope = getAdminPanelCompanyScope()) {
    return (Array.isArray(rows) ? rows : []).filter((row) =>
        adminRecordMatchesCompanyFilter(row, companyScope),
    );
}

function resolveAdminDealCompanyScope(deal = {}) {
    return resolveAdminRecordCompanyScope(deal);
}

function adminDealMatchesCompanyFilter(deal = {}, companyScope = "") {
    return adminRecordMatchesCompanyFilter(deal, companyScope);
}

window.onload = function () {
    if (!loadUser()) return;
    setupAdminAttendanceControls();
    setupUserRegistrationForm();
    setupAdminLeadForm();
    setupAdminLeadShiftModals();
    setupProposalTemplateForm();
    setupAdminProductForm();
    window.AdminProposals?.setup();
    loadAdminData();
};

function loadUser() {
    const user = localStorage.getItem("currentUser");

    if (!user) {
        showPopup("Session Expired", "Login again", false);
        setTimeout(() => window.location.href = "mp.html", 1500);
        return false;
    }

    try {
        currentUser = JSON.parse(user);
        hydrateCurrentUserIdentity();
        localStorage.setItem("currentUser", JSON.stringify(currentUser));
    } catch (err) {
        localStorage.removeItem("currentUser");
        showPopup("Session Expired", "Login again", false);
        setTimeout(() => window.location.href = "mp.html", 1500);
        return false;
    }

    if (normalizeAdminRole(currentUser?.role) !== "admin") {
        showPopup("Access Denied", "Please login with an admin account to open the admin panel.", false);
        setTimeout(() => {
            window.location.href = getAdminAccessRedirect(currentUser?.role);
        }, 1500);
        return false;
    }

    applyAdminThemeColors();
    setAdminPanelCompanyScope(getAdminPanelCompanyScope());
    syncAdminGlobalCompanyFilter();
    updateAdminPanelCompanyFilterVisibility(getActiveAdminSectionId());

    document.getElementById("userName").textContent = currentUser.name;

    const avatar = document.getElementById("userAvatar");
    const avatarUrl = getAdminHeaderAvatarUrl(currentUser);
    if (avatar && avatarUrl) {
        avatar.src = avatarUrl;
    } else if (avatar) {
        avatar.removeAttribute("src");
    }

    return true;
}

// Dummy data (baad me DB connect karenge)
function loadAdminData() {
    loadAdminDashboard();
    loadLeads();
    loadAppointments();
    loadFollowups();
    loadDeals();
    loadAdminRenewals();
    loadDownsaleNotifications();
    loadAdminAttendance();
    loadTeam();
    loadProjects();
    loadProjectSummary(); // 🔥 ADD THIS
    loadAdminProjectTracker();
    loadProposalTemplates();
    loadAdminDealProducts();
    startDownsaleNotificationBadgePolling();

}

function setupAdminAttendanceControls() {
    const dateInput = document.getElementById("adminAttendanceDate");
    if (!dateInput) return;

    dateInput.min = "2026-05-01";
    if (dateInput.value) {
        return;
    }

    dateInput.value = getAdminDateKey();
    resolveAdminAttendanceDate();
}

function getAdminAttendanceSelectedRole() {
    return String(document.getElementById("adminAttendanceRole")?.value || "")
        .trim()
        .toLowerCase();
}

function getAdminAttendanceSelectedEmployeeId() {
    const value = String(document.getElementById("adminAttendanceEmployee")?.value || "").trim();
    return /^\d+$/.test(value) ? value : "";
}

async function ensureAdminAttendanceEmployeeData() {
    const companyScope = getAdminPanelCompanyScope();
    const employeeScopeKey = `${companyScope}:active`;
    if (
        adminAttendanceEmployeeOptionsScope === employeeScopeKey &&
        allTeamData.length &&
        allTeamData.every(isAdminTeamUserActive)
    ) {
        return allTeamData;
    }

    const url = new URL(getAdminPanelScopedApiUrl("/api/admin/team-report"));
    url.searchParams.set("employmentStatus", "active");

    const res = await fetch(url.toString(), {
        cache: "no-store",
    });
    const result = await res.json();

    if (!res.ok || !result.success || !Array.isArray(result.data)) {
        throw new Error(result.message || "Failed to load employees");
    }

    const scopedTeam = filterAdminRowsByCompanyScope(result.data);
    allTeamData = scopedTeam;
    adminDashboardCache.team = scopedTeam;
    adminAttendanceEmployeeOptionsScope = employeeScopeKey;
    return scopedTeam;
}

function getAdminAttendanceEmployeeRows() {
    const selectedRole = normalizeAdminTeamRoleForFilter(
        getAdminAttendanceSelectedRole(),
    );

    return [...allTeamData]
        .filter((employee) => normalizeAdminTeamRoleForFilter(employee.role) !== "admin")
        .filter((employee) => (
            !selectedRole ||
            selectedRole === "all" ||
            normalizeAdminTeamRoleForFilter(employee.role) === selectedRole
        ))
        .sort((left, right) => String(left.name || "").localeCompare(String(right.name || "")));
}

function populateAdminAttendanceEmployeeFilter({ preserveValue = true } = {}) {
    const select = document.getElementById("adminAttendanceEmployee");
    if (!select) return;

    const previousValue = preserveValue ? String(select.value || "") : "";
    const employees = getAdminAttendanceEmployeeRows();
    select.innerHTML = "";

    const allOption = document.createElement("option");
    allOption.value = "";
    allOption.textContent = "All Employees";
    select.appendChild(allOption);

    employees.forEach((employee) => {
        const option = document.createElement("option");
        option.value = String(employee.id || "");
        option.textContent = employee.name
            ? `${employee.name} (${String(employee.role || "-").toUpperCase()})`
            : `Employee #${employee.id}`;
        select.appendChild(option);
    });

    if (!employees.length) {
        const emptyOption = document.createElement("option");
        emptyOption.value = "";
        emptyOption.disabled = true;
        emptyOption.textContent = "No employees found";
        select.appendChild(emptyOption);
    }

    const hasPreviousValue = previousValue && employees.some(
        (employee) => String(employee.id || "") === previousValue,
    );
    select.value = hasPreviousValue ? previousValue : "";
}

async function refreshAdminAttendanceEmployeeFilter(options = {}) {
    const select = document.getElementById("adminAttendanceEmployee");
    if (!select) return;

    try {
        select.disabled = true;
        await ensureAdminAttendanceEmployeeData();
        populateAdminAttendanceEmployeeFilter(options);
    } catch (err) {
        console.error("Admin attendance employees load error:", err);
        select.innerHTML = `<option value="">Unable to load employees</option>`;
    } finally {
        select.disabled = false;
    }
}

async function handleAdminAttendanceRoleChange() {
    await refreshAdminAttendanceEmployeeFilter({ preserveValue: false });
    await loadAdminAttendance();
}

function setSalesSummaryText(id, value) {
    const element = document.getElementById(id);
    if (element) element.textContent = value;
}

function escapeAdminHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function formatSalesSummaryMoney(value) {
    const amount = Number(value || 0);
    return `Rs. ${amount.toLocaleString("en-IN", {
        maximumFractionDigits: 0,
    })}`;
}
if (typeof setupAdminAttendanceControls === "function") {
    setupAdminAttendanceControls();
}
function applySalesSummary(prefix, data = {}) {
    const target = Number(data.target || 0);
    const achieved = Number(data.achieved || 0);
    const remaining = Math.max(Number(data.remaining || 0), 0);
    const targetText = formatSalesSummaryMoney(target);

    setSalesSummaryText(`${prefix}TargetSet`, formatSalesSummaryMoney(target));
    setSalesSummaryText(`${prefix}TargetSetHint`, "Current monthly goal");
    setSalesSummaryText(`${prefix}TargetAchieved`, formatSalesSummaryMoney(achieved));
    setSalesSummaryText(`${prefix}TargetRemaining`, formatSalesSummaryMoney(remaining));
    setSalesSummaryText(`${prefix}TargetAchievedHint`, `Target ${targetText}`);
    setSalesSummaryText(
        `${prefix}TargetRemainingHint`,
        remaining === 0 && achieved >= target
            ? "Monthly target achieved"
            : `Pending from ${targetText}`,
    );
}

function getEmptyAdminRoleTargetBucket(role) {
    const normalizedRole = normalizeAdminRole(role);
    return {
        role: normalizedRole,
        label: normalizedRole.toUpperCase(),
        totalMembers: 0,
        achievedMembers: 0,
        totalTarget: 0,
        totalContractValue: 0,
        totalAchieved: 0,
        totalPaidWithoutGst: 0,
        totalRemaining: 0,
        dealsCount: 0,
    };
}

function aggregateAdminRoleTargetSnapshot(items = [], roleSummary = {}) {
    const buckets = {
        tme: getEmptyAdminRoleTargetBucket("tme"),
        me: getEmptyAdminRoleTargetBucket("me"),
    };

    ["tme", "me"].forEach((role) => {
        const summary = roleSummary?.[role];
        if (!summary) return;

        buckets[role] = {
            ...buckets[role],
            ...summary,
            role,
            label: summary.label || role.toUpperCase(),
            totalMembers: Number(summary.totalMembers || 0),
            achievedMembers: Number(summary.achievedMembers || 0),
            totalTarget: Number(summary.totalTarget || 0),
            totalContractValue: Number(summary.totalContractValue || 0),
            totalAchieved: Number(summary.totalAchieved || 0),
            totalPaidWithoutGst: Number(summary.totalPaidWithoutGst || 0),
            dealsCount: Number(summary.dealsCount || 0),
        };
        buckets[role].totalRemaining = Math.max(
            Number(summary.totalRemaining ?? (buckets[role].totalTarget - buckets[role].totalPaidWithoutGst)),
            0,
        );
    });

    items.forEach((item) => {
        const role = normalizeAdminRole(item.role);
        if (!buckets[role]) return;
        const hasServerSummary = Boolean(roleSummary?.[role]);
        if (hasServerSummary) return;

        const bucket = buckets[role];
        const target = Number(item.target || 0);
        const totalContractValue = Number(item.totalContractValue || 0);
        const paidWithoutGst = Math.max(Number(item.paidWithoutGst || 0), 0);

        bucket.totalMembers += 1;
        bucket.totalTarget += target;
        bucket.totalContractValue += totalContractValue;
        bucket.totalAchieved += Number(item.receivedPayment ?? item.achieved ?? 0);
        bucket.totalPaidWithoutGst += paidWithoutGst;
        bucket.dealsCount += Number(item.dealsCount || 0);
        if (item.isAchieved) bucket.achievedMembers += 1;
        bucket.totalRemaining = Math.max(bucket.totalTarget - bucket.totalPaidWithoutGst, 0);
    });

    return buckets;
}

function renderAdminRoleTargetSnapshot(items = adminDashboardState.teamTargets, roleSummary = adminDashboardState.teamTargetRoleSummary) {
    const container = document.getElementById("adminRoleTargetSnapshot");
    if (!container) return;

    const buckets = aggregateAdminRoleTargetSnapshot(items, roleSummary);
    const roles = [
        {
            key: "tme",
            title: "TME Target Snapshot",
            icon: "fa-headset",
            className: "tme",
        },
        {
            key: "me",
            title: "ME Target Snapshot",
            icon: "fa-briefcase",
            className: "me",
        },
    ];

    container.innerHTML = roles
        .map(({ key, title, icon, className }) => {
            const bucket = buckets[key] || getEmptyAdminRoleTargetBucket(key);
            const target = Number(bucket.totalTarget || 0);
            const contractValue = Number(bucket.totalContractValue || 0);
            const achievedPayment = Math.max(Number(bucket.totalAchieved || 0), 0);
            const paidWithoutGst = Math.max(Number(bucket.totalPaidWithoutGst || 0), 0);
            const remaining = Math.max(Number(bucket.totalRemaining ?? (target - paidWithoutGst)), 0);
            const members = Number(bucket.totalMembers || 0);
            const achievedMembers = Number(bucket.achievedMembers || 0);

            return `
                <article class="sales-target-card role-target-card ${className}">
                    <div class="role-target-card-head">
                        <div class="sales-target-icon">
                            <i class="fas ${icon}"></i>
                        </div>
                        <div>
                            <span>${escapeAdminHtml(title)}</span>
                            <strong>${escapeAdminHtml(formatSalesSummaryMoney(target))}</strong>
                            <small>${members ? `${achievedMembers}/${members} members achieved` : "No active users found"}</small>
                        </div>
                    </div>
                    <div class="role-target-metrics">
                        <div class="role-target-metric">
                            <span>Total Target</span>
                            <strong>${escapeAdminHtml(formatSalesSummaryMoney(target))}</strong>
                        </div>
                        <div class="role-target-metric">
                            <span>Total Contract Value</span>
                            <strong>${escapeAdminHtml(formatSalesSummaryMoney(contractValue))}</strong>
                        </div>
                        <div class="role-target-metric">
                            <span>Total Achieved Payment</span>
                            <strong>${escapeAdminHtml(formatSalesSummaryMoney(achievedPayment))}</strong>
                        </div>
                        <div class="role-target-metric">
                            <span>Paid Without GST</span>
                            <strong>${escapeAdminHtml(formatSalesSummaryMoney(paidWithoutGst))}</strong>
                        </div>
                        <div class="role-target-metric remaining">
                            <span>Remaining Target Without GST</span>
                            <strong>${escapeAdminHtml(formatSalesSummaryMoney(remaining))}</strong>
                        </div>
                    </div>
                </article>
            `;
        })
        .join("");

    const combinedTarget = roles.reduce((sum, role) => sum + Number(buckets[role.key]?.totalTarget || 0), 0);
    const combinedAchievedWithoutGst = roles.reduce((sum, role) => sum + Number(buckets[role.key]?.totalPaidWithoutGst || 0), 0);

    adminDashboardState.salesTarget = {
        ...adminDashboardState.salesTarget,
        target: combinedTarget,
        achieved: combinedAchievedWithoutGst,
        remaining: Math.max(combinedTarget - combinedAchievedWithoutGst, 0),
    };
    renderAdminTargetProgress(adminDashboardState.salesTarget);
}

async function loadAdminSalesTargetSummary() {
    if (!currentUser?.role) return;

    try {
        const params = new URLSearchParams({
            role: currentUser.role,
        });
        const monthKey = getAdminDashboardMonth();

        if (currentUser.id) {
            params.set("userId", currentUser.id);
        }
        if (monthKey) {
            params.set("month", monthKey);
        }

        const res = await fetch(`${BASE_URL}/api/sales-target-summary?${params.toString()}`, {
            cache: "no-store",
        });
        const result = await res.json();

        if (!res.ok || !result.success) {
            throw new Error(result.message || "Failed to load sales target");
        }

        adminDashboardState.adminSalesTarget = {
            target: Number(result.data?.target || 0),
            achieved: Number(result.data?.achieved || 0),
            remaining: Math.max(Number(result.data?.remaining || 0), 0),
            dealsCount: Number(result.data?.dealsCount || 0),
        };

        if (!adminDashboardState.teamTargets.length) {
            adminDashboardState.salesTarget = { ...adminDashboardState.adminSalesTarget };
            applySalesSummary("admin", result.data);
            renderAdminTargetProgress(adminDashboardState.salesTarget);
        }
        renderAdminDashboard();
    } catch (err) {
        console.error("Admin Sales Target Error:", err);
    }
}

async function loadAdminTeamTargetsSummary(forceRefresh = false) {
    const list = document.getElementById("adminTeamTargetsList");
    if (!currentUser?.id || !list) return;

    list.innerHTML = '<div class="team-target-empty">Loading target board...</div>';

    try {
        const params = new URLSearchParams({
            adminId: currentUser.id,
        });
        const monthKey = getAdminDashboardMonth();
        if (monthKey) {
            params.set("month", monthKey);
        }
        const res = await fetch(`${BASE_URL}/api/admin/team-targets-summary?${params.toString()}`, {
            cache: forceRefresh ? "no-store" : "default",
        });
        const result = await res.json();

        if (!res.ok || !result.success) {
            throw new Error(result.message || "Failed to load team targets");
        }

        adminDashboardState.teamTargets = Array.isArray(result.data) ? result.data : [];
        adminDashboardState.teamTargetSummary = result.summary || {};
        adminDashboardState.teamTargetRoleSummary = result.roleSummary || {};
        renderAdminRoleTargetSnapshot(
            adminDashboardState.teamTargets,
            adminDashboardState.teamTargetRoleSummary,
        );
        renderAdminTeamTargets(adminDashboardState.teamTargets, adminDashboardState.teamTargetSummary);
    } catch (err) {
        console.error("Admin Team Targets Error:", err);
        adminDashboardState.teamTargets = [];
        adminDashboardState.teamTargetSummary = {};
        adminDashboardState.teamTargetRoleSummary = {};
        renderAdminRoleTargetSnapshot([], {});
        renderAdminTeamTargets([], {});
        list.innerHTML = `<div class="team-target-empty">${escapeAdminHtml(err.message || "Unable to load team target board")}</div>`;
    }
}

function renderAdminTeamTargets(items = [], summary = {}) {
    const list = document.getElementById("adminTeamTargetsList");
    const summaryText = document.getElementById("adminTeamTargetsSummary");
    if (!list) return;

    const monthLabel = formatAdminDashboardMonthLabel();

    if (summaryText) {
        const totalMembers = Number(summary.totalMembers || items.length || 0);
        const achievedMembers = Number(summary.achievedMembers || 0);
        const totalTarget = Number(summary.totalTarget || 0);
        const totalPaidWithoutGst = Number(summary.totalPaidWithoutGst || summary.totalAchieved || 0);

        summaryText.textContent = totalMembers
            ? `${achievedMembers}/${totalMembers} achieved in ${monthLabel} | ${formatSalesSummaryMoney(totalPaidWithoutGst)} without GST of ${formatSalesSummaryMoney(totalTarget)}`
            : `Auto salary targets for ${monthLabel}.`;
    }

    if (!items.length) {
        list.innerHTML = '<div class="team-target-empty">No ME/TME users found for target assignment.</div>';
        return;
    }

    list.innerHTML = items.map((item) => {
        const target = Number(item.target || 0);
        const achieved = Number(item.achieved || 0);
        const remaining = Math.max(Number(item.remaining || 0), 0);
        const dealsCount = Number(item.dealsCount || 0);
        const isAchieved = Boolean(item.isAchieved);
        const inputValue = Number.isFinite(target) ? Number(target.toFixed(0)) : 0;
        const targetSource = String(item.targetSource || "").toLowerCase();
        const compensationType = String(item.compensationType || "salary").toLowerCase();
        const isCommission = compensationType === "commission" || targetSource === "commission";
        const salaryBasis = Number(item.targetBasis?.salary ?? item.salary ?? 0);
        const incentiveRate = Number(item.incentiveRate || 0.07) * 100;
        const targetControlMarkup = isCommission
            ? `
                <div class="team-target-input-wrap">
                    <small class="team-target-meta">
                        Commission based profile. Monthly target and target incentive are not required.
                    </small>
                    <small class="team-target-meta">
                        Flat ${FIXED_SALES_COMMISSION_PERCENT}% commission is calculated on closed sales.
                    </small>
                </div>
            `
            : targetSource === "salary_7x"
                ? `
                    <div class="team-target-input-wrap">
                        <small class="team-target-meta">
                            Auto target: ${escapeAdminHtml(formatSalesSummaryMoney(salaryBasis))} monthly salary x 7.
                        </small>
                        <small class="team-target-meta">
                            Incentive: ${incentiveRate.toFixed(0)}% after monthly target completion.
                        </small>
                        <small class="team-target-meta">
                            ${dealsCount} closed deal${dealsCount === 1 ? "" : "s"} in ${escapeAdminHtml(monthLabel)}${isAchieved ? " | Target completed" : ""}
                        </small>
                    </div>
                `
                : `
                    <div class="team-target-input-wrap">
                        <label for="adminTeamTargetInput-${Number(item.userId || 0)}">Set Monthly Target</label>
                        <div class="team-target-input-row">
                            <input
                                type="number"
                                min="0"
                                step="1000"
                                id="adminTeamTargetInput-${Number(item.userId || 0)}"
                                value="${inputValue}"
                            />
                            <button
                                type="button"
                                class="team-target-save-btn"
                                onclick="saveAdminTeamTarget(${Number(item.userId || 0)}, this)"
                            >
                                Save
                            </button>
                        </div>
                        <small class="team-target-meta">
                            ${dealsCount} closed deal${dealsCount === 1 ? "" : "s"} in ${escapeAdminHtml(monthLabel)}${isAchieved ? " | Target completed" : ""}
                        </small>
                    </div>
                `;

        return `
            <article class="team-target-card${isAchieved ? " is-achieved" : ""}">
                <div class="team-target-card-head">
                    <div>
                        <strong>${escapeAdminHtml(item.name || "Employee")}</strong>
                        <span class="team-target-role">${escapeAdminHtml(item.roleLabel || "EMPLOYEE")}</span>
                    </div>
                    <span class="team-target-status ${isCommission || isAchieved ? "achieved" : "pending"}">
                        ${isCommission ? "Commission" : isAchieved ? "Achieved" : "In Progress"}
                    </span>
                </div>
                <div class="team-target-stats">
                    <div class="team-target-stat">
                        <span>${isCommission ? "Rate" : "Target"}</span>
                        <strong>${isCommission ? `${FIXED_SALES_COMMISSION_PERCENT}%` : escapeAdminHtml(formatSalesSummaryMoney(target))}</strong>
                    </div>
                    <div class="team-target-stat">
                        <span>${isCommission ? "Sales" : "Without GST"}</span>
                        <strong>${escapeAdminHtml(formatSalesSummaryMoney(achieved))}</strong>
                    </div>
                    <div class="team-target-stat">
                        <span>${isCommission ? "Commission" : "Remaining"}</span>
                        <strong>${escapeAdminHtml(formatSalesSummaryMoney(isCommission ? item.commissionAmount : remaining))}</strong>
                    </div>
                </div>
                ${targetControlMarkup}
            </article>
        `;
    }).join("");
}

async function saveAdminTeamTarget(userId, button) {
    const input = document.getElementById(`adminTeamTargetInput-${userId}`);
    const target = Number(input?.value);

    if (!currentUser?.id) return;
    if (!Number.isFinite(target) || target < 0) {
        showPopup("Target", "Please enter a valid target amount.", false);
        input?.focus();
        return;
    }

    const previousText = button?.textContent || "Save";
    if (button) {
        button.disabled = true;
        button.textContent = "Saving...";
    }

    try {
        const res = await fetch(`${BASE_URL}/api/users/${userId}/monthly-target`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                monthlyTarget: target,
                actorId: currentUser.id,
            }),
        });
        const result = await res.json();

        if (!res.ok || !result.success) {
            throw new Error(result.message || "Failed to update target");
        }

        showPopup("Target", "Monthly target updated successfully.", true);
        await Promise.all([
            loadAdminTeamTargetsSummary(true),
            loadAdminSalesTargetSummary(),
        ]);
    } catch (err) {
        console.error("Save team target error:", err);
        showPopup("Target", err.message || "Failed to update target", false);
    } finally {
        if (button) {
            button.disabled = false;
            button.textContent = previousText;
        }
    }
}

function handleDashboardShortcutKey(event, sectionId) {
    if (!event) return;

    const key = event.key;
    if (key === "Enter" || key === " ") {
        event.preventDefault();
        openAdminSection(sectionId);
    }
}

function loadAdminDashboard() {
    loadAdminSalesTargetSummary();
    loadAdminTeamTargetsSummary();
    loadLeads();
    loadAppointments();
    loadFollowups();
    loadDeals();
    loadProjects();
    loadAdminProjectTracker();
}

function setAdminDashboardText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
}

function formatCompactMoney(value) {
    const amount = Number(value || 0);
    return `Rs. ${amount.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

function getAdminDealIdentityKey(deal) {
    const parts = [
        deal?.email,
        deal?.contact,
        deal?.client_name,
        deal?.company_name,
    ]
        .map((value) => String(value || "").trim().toLowerCase())
        .filter(Boolean);

    return parts.join("|") || `deal-${deal?.id || Math.random()}`;
}

function summarizeAdminDealMix(deals = []) {
    const seenClients = new Set();
    const orderedDeals = [...deals].sort((left, right) => {
        const leftDate = new Date(left?.closed_date || 0).getTime();
        const rightDate = new Date(right?.closed_date || 0).getTime();

        if (leftDate !== rightDate) return leftDate - rightDate;
        return Number(left?.id || 0) - Number(right?.id || 0);
    });

    return orderedDeals.reduce(
        (summary, deal) => {
            const amount = getAdminDealReceivedAmount(deal);
            const key = getAdminDealIdentityKey(deal);
            const explicitSalesType = String(deal?.sales_type || deal?.salesType || "")
                .toLowerCase()
                .trim();
            const isClosedRenewalSale =
                explicitSalesType === "renewal" ||
                (!explicitSalesType && seenClients.has(key));
            const hasRenewalActivity =
                isClosedRenewalSale ||
                Number(deal?.has_renewal || 0) > 0 ||
                Number(deal?.renewal_count || 0) > 0;

            if (isClosedRenewalSale) {
                summary.renewalAmount += amount;
            } else {
                summary.newSaleCount += 1;
                summary.newSaleAmount += amount;
                seenClients.add(key);
            }

            if (hasRenewalActivity) {
                summary.renewalCount += 1;
            }

            return summary;
        },
        {
            newSaleCount: 0,
            renewalCount: 0,
            newSaleAmount: 0,
            renewalAmount: 0,
        },
    );
}

function renderAdminTargetProgress(data = {}) {
    const target = Number(data.target || 0);
    const achieved = Number(data.achieved || 0);
    const remainingBase = data.remaining ?? (target - achieved);
    const remaining = Math.max(Number(remainingBase) || 0, 0);

    const pct = target > 0 ? Math.min(Math.round((achieved / target) * 100), 100) : 0;
    setAdminDashboardText("adminTargetProgressLabel", `${pct}% achieved`);

    const canvas = document.getElementById("adminTargetProgressChart");
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    if (adminTargetProgressChart) adminTargetProgressChart.destroy();

    adminTargetProgressChart = new Chart(ctx, {
        type: "doughnut",
        data: {
            labels: ["Achieved", "Remaining"],
            datasets: [
                {
                    data: [achieved, remaining],
                    backgroundColor: [ADMIN_THEME_COLORS.accent, ADMIN_THEME_COLORS.neutral],
                    borderColor: [ADMIN_THEME_COLORS.white, ADMIN_THEME_COLORS.white],
                    borderWidth: 2,
                    hoverOffset: 6,
                },
            ],
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: "70%",
            plugins: {
                legend: {
                    position: "bottom",
                    labels: { boxWidth: 12 },
                },
                tooltip: {
                    callbacks: {
                        label(context) {
                            const value = Number(context?.raw || 0);
                            return `${context.label}: ${formatCompactMoney(value)}`;
                        },
                    },
                },
            },
        },
    });
}

function renderAdminDashboardChart(metrics) {
    const canvas = document.getElementById("adminDashboardChart");
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    if (adminDashboardChart) adminDashboardChart.destroy();

    adminDashboardChart = new Chart(ctx, {
        type: "bar",
        data: {
            labels: ["Leads", "Appointments", "Follow Ups", "Deals"],
            datasets: [
                {
                    label: "Total",
                    data: [
                        metrics?.leads || 0,
                        metrics?.appointments || 0,
                        metrics?.followups || 0,
                        metrics?.deals || 0,
                    ],
                    backgroundColor: [
                        ADMIN_THEME_COLORS.accentDark,
                        ADMIN_THEME_COLORS.accentLight,
                        ADMIN_THEME_COLORS.accentBlue,
                        ADMIN_THEME_COLORS.success,
                    ],
                    borderRadius: 10,
                    maxBarThickness: 64,
                },
            ],
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
            },
            scales: {
                x: {
                    grid: { display: false },
                },
                y: {
                    beginAtZero: true,
                    ticks: { precision: 0 },
                },
            },
        },
    });
}

function renderAdminRecentDeals(deals = []) {
    const tbody = document.getElementById("adminDashboardRecentDeals");
    if (!tbody) return;

    if (!deals.length) {
        tbody.innerHTML = `<tr><td colspan="5">No recent deals found</td></tr>`;
        return;
    }

    const recent = [...deals]
        .sort((left, right) => new Date(right?.closed_date || 0) - new Date(left?.closed_date || 0))
        .slice(0, 6);

    tbody.innerHTML = recent
        .map((deal) => {
            const amount = formatCompactMoney(getAdminDealReceivedAmount(deal));
            const clientName = deal?.client_name || "-";
            const companyName = deal?.company_name || "-";
            return `
                <tr data-admin-section-link="deals" role="button" tabindex="0">
                    <td>${escapeAdminHtml(companyName)}</td>
                    <td>
                        <strong>${escapeAdminHtml(clientName)}</strong>
                        <small>${escapeAdminHtml(companyName)}</small>
                    </td>
                    <td>${escapeAdminHtml(amount)}</td>
                    <td>${escapeAdminHtml(deal.payment_method || "-")}</td>
                    <td>${escapeAdminHtml(formatDate(deal.closed_date) || deal.closed_date || "-")}</td>
                </tr>
            `;
        })
        .join("");
}

function renderAdminDashboard() {
    const salesTarget = adminDashboardState.salesTarget || {};
    const leadsCount = Array.isArray(adminDashboardState.leads) ? adminDashboardState.leads.length : 0;
    const appointmentsCount = Array.isArray(adminDashboardState.appointments) ? adminDashboardState.appointments.length : 0;
    const followupsCount = Array.isArray(adminDashboardState.followups) ? adminDashboardState.followups.length : 0;
    const projectsCount = Array.isArray(adminDashboardState.projects) ? adminDashboardState.projects.length : 0;
    const achievedSales = Number(salesTarget.achieved || 0);

    const dealsCount = Number.isFinite(Number(salesTarget.dealsCount))
        ? Number(salesTarget.dealsCount || 0)
        : (Array.isArray(adminDashboardState.deals) ? adminDashboardState.deals.length : 0);

    setAdminDashboardText("adminDashboardSales", formatCompactMoney(achievedSales));
    setAdminDashboardText(
        "adminDashboardSalesHint",
        dealsCount ? `${dealsCount} deals closed` : "From closed deals",
    );
    setAdminDashboardText("adminDashboardLeads", String(leadsCount));
    setAdminDashboardText("adminDashboardAppointments", String(appointmentsCount));
    setAdminDashboardText("adminDashboardFollowups", String(followupsCount));
    setAdminDashboardText("adminDashboardDeals", String(dealsCount));
    setAdminDashboardText("adminDashboardProjects", String(projectsCount));

    setAdminDashboardText("adminFunnelLeads", String(leadsCount));
    setAdminDashboardText("adminFunnelAppointments", String(appointmentsCount));
    setAdminDashboardText("adminFunnelFollowups", String(followupsCount));
    setAdminDashboardText("adminFunnelDeals", String(dealsCount));

    const conversion = leadsCount ? Math.round((dealsCount / leadsCount) * 100) : 0;
    setAdminDashboardText("adminDashboardFunnelRate", `${conversion}% converted`);

    renderAdminDashboardChart({
        leads: leadsCount,
        appointments: appointmentsCount,
        followups: followupsCount,
        deals: dealsCount,
    });

    renderAdminRecentDeals(Array.isArray(adminDashboardState.deals) ? adminDashboardState.deals : []);
}

function formatWorkTime(inTime, outTime) {
    if (!inTime || !outTime) return "-";

    const todayStr = new Date().toISOString().split("T")[0];
    const inDateTime = new Date(`${todayStr}T${inTime}`);
    const outDateTime = new Date(`${todayStr}T${outTime}`);

    if (Number.isNaN(inDateTime.getTime()) || Number.isNaN(outDateTime.getTime())) {
        return "-";
    }

    if (outDateTime < inDateTime) {
        outDateTime.setDate(outDateTime.getDate() + 1);
    }

    const diffSeconds = Math.floor((outDateTime - inDateTime) / 1000);
    const hours = Math.floor(diffSeconds / 3600);
    const minutes = Math.floor((diffSeconds % 3600) / 60);
    const seconds = diffSeconds % 60;

    return `${hours}h ${minutes}m ${seconds}s`;
}

function formatAdminAttendanceTime(value) {
    const raw = String(value || "").trim();
    if (!raw) return "-";

    const match = raw.match(/(\d{1,2}):(\d{2})(?::\d{2})?/);
    if (!match) return raw;

    const hours24 = Number(match[1]);
    if (!Number.isFinite(hours24) || hours24 < 0 || hours24 > 23) {
        return raw;
    }

    const suffix = hours24 >= 12 ? "PM" : "AM";
    const hours12 = hours24 % 12 || 12;
    return `${hours12}:${match[2]} ${suffix}`;
}

function formatAdminAttendanceWorkingHours(value) {
    const raw = String(value || "").trim();
    if (!raw) return "00:00";
    if (raw.startsWith("-")) return "Pending";
    return raw;
}

function formatAdminAttendanceTimeInput(value) {
    const raw = String(value || "").trim();
    if (!raw) return "";

    const match = raw.match(/(\d{1,2}):(\d{2})(?::\d{2})?/);
    if (!match) return "";

    const hours24 = Number(match[1]);
    if (!Number.isFinite(hours24) || hours24 < 0 || hours24 > 23) {
        return "";
    }

    return `${String(hours24).padStart(2, "0")}:${match[2]}`;
}

function formatDate(dateStr) {
    if (!dateStr) return "-";

    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return "-";

    return d.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric"
    });
}

function getAdminDateKey(value) {
    if (!value) return "";
    if (value instanceof Date && !Number.isNaN(value.getTime())) {
        const year = value.getFullYear();
        const month = String(value.getMonth() + 1).padStart(2, "0");
        const day = String(value.getDate()).padStart(2, "0");
        return `${year}-${month}-${day}`;
    }

    const raw = String(value || "").trim();
    const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) return `${match[1]}-${match[2]}-${match[3]}`;

    const parsed = new Date(raw);
    return Number.isNaN(parsed.getTime()) ? "" : getAdminDateKey(parsed);
}

function addAdminDays(dateValue, days) {
    const dateKey = getAdminDateKey(dateValue);
    if (!dateKey) return "";
    const [year, month, day] = dateKey.split("-").map(Number);
    const date = new Date(year, month - 1, day);
    date.setDate(date.getDate() + Number(days || 0));
    return getAdminDateKey(date);
}

function isAdminDateReady(dateValue) {
    const dateKey = getAdminDateKey(dateValue);
    return Boolean(dateKey && dateKey <= getAdminDateKey(new Date()));
}

function setupProposalTemplateForm() {
    const form = document.getElementById("proposalTemplateForm");
    if (!form || form.dataset.bound) return;

    form.addEventListener("submit", saveProposalTemplate);
    form.dataset.bound = "true";
}

function getProposalTemplateFormPayload() {
    return {
        id: document.getElementById("proposalTemplateId")?.value || "",
        template_name: document.getElementById("proposalTemplateName")?.value.trim() || "",
        category: document.getElementById("proposalTemplateCategory")?.value.trim() || "CRM",
        status: document.getElementById("proposalTemplateStatus")?.value || "active",
        content: document.getElementById("proposalTemplateContent")?.value.trim() || "",
    };
}

async function loadProposalTemplates() {
    const tbody = document.getElementById("proposalTemplatesTableBody");
    if (!tbody) return;

    tbody.innerHTML = `<tr><td colspan="5">Loading templates...</td></tr>`;

    try {
        const res = await fetch(`${BASE_URL}/api/proposal-templates`, { cache: "no-store" });
        const data = await parseAdminApiResponse(res, "Proposal templates API");

        if (!res.ok || !data.success) {
            throw new Error(data.message || "Failed to load proposal templates");
        }

        proposalTemplatesCache = Array.isArray(data.data) ? data.data : [];

        if (!proposalTemplatesCache.length) {
            tbody.innerHTML = `<tr><td colspan="5">No proposal templates found</td></tr>`;
            return;
        }

        tbody.innerHTML = proposalTemplatesCache.map((template) => `
            <tr>
                <td>${escapeAdminHtml(template.template_name || "-")}</td>
                <td>${escapeAdminHtml(template.category || "-")}</td>
                <td><span class="role-badge ${template.status === "active" ? "me" : "default"}">${escapeAdminHtml(template.status || "-")}</span></td>
                <td>${escapeAdminHtml(formatDate(template.created_at))}</td>
                <td>
                    <div class="proposal-template-action-buttons">
                        <button type="button" class="tab-btn active" onclick="editProposalTemplate(${template.id})">Edit</button>
                    </div>
                </td>
            </tr>
        `).join("");
    } catch (err) {
        console.error("Proposal Templates Error:", err);
        tbody.innerHTML = `<tr><td colspan="5">Unable to load proposal templates</td></tr>`;
    }
}

async function saveProposalTemplate(event) {
    event.preventDefault();

    const payload = getProposalTemplateFormPayload();
    if (!payload.template_name || !payload.content) {
        showPopup("Missing Details", "Template name and content are required.", false);
        return;
    }

    const isEdit = Boolean(payload.id);
    const url = isEdit
        ? `${BASE_URL}/api/proposal-templates/${payload.id}`
        : `${BASE_URL}/api/proposal-templates`;

    try {
        const res = await fetch(url, {
            method: isEdit ? "PUT" : "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });
        const data = await parseAdminApiResponse(res, "Save proposal template API");

        if (!res.ok || !data.success) {
            throw new Error(data.message || "Failed to save template");
        }

        showPopup("Saved", data.message || "Proposal template saved successfully.", true);
        resetProposalTemplateForm();
        loadProposalTemplates();
    } catch (err) {
        console.error("Save Proposal Template Error:", err);
        showPopup("Error", err.message || "Failed to save proposal template", false);
    }
}

function editProposalTemplate(templateId) {
    const template = proposalTemplatesCache.find((item) => Number(item.id) === Number(templateId));
    if (!template) return;

    document.getElementById("proposalTemplateId").value = template.id || "";
    document.getElementById("proposalTemplateName").value = template.template_name || "";
    document.getElementById("proposalTemplateCategory").value = template.category || "CRM";
    document.getElementById("proposalTemplateStatus").value = template.status || "active";
    document.getElementById("proposalTemplateContent").value = template.content || "";
}

function resetProposalTemplateForm() {
    const form = document.getElementById("proposalTemplateForm");
    form?.reset();
    const id = document.getElementById("proposalTemplateId");
    const category = document.getElementById("proposalTemplateCategory");
    const status = document.getElementById("proposalTemplateStatus");
    if (id) id.value = "";
    if (category) category.value = "CRM";
    if (status) status.value = "active";
}

const ADMIN_DEAL_PRODUCT_API_BASES = [
    "/api/admin/deal-products",
    "/api/admin/products",
    "/api/deal-products",
    "/api/products",
];

function getAdminDealProductApiUrls(productId = "", suffix = "", includeScope = false) {
    return ADMIN_DEAL_PRODUCT_API_BASES.map((basePath) => {
        const encodedId = productId ? `/${encodeURIComponent(productId)}` : "";
        const endpoint = `${basePath}${encodedId}${suffix || ""}`;
        return includeScope
            ? getAdminPanelScopedApiUrl(endpoint)
            : new URL(endpoint, BASE_URL).toString();
    });
}

function getAdminDealProductListUrls() {
    return ADMIN_DEAL_PRODUCT_API_BASES.map((basePath) =>
        getAdminPanelScopedApiUrl(`${basePath}?includeInactive=1`),
    );
}

function setupAdminProductForm() {
    const form = document.getElementById("adminProductForm");
    setupAdminProductActions();
    if (!form || form.dataset.bound) return;

    form.addEventListener("submit", saveAdminDealProduct);
    form.dataset.bound = "true";
}

function setupAdminProductActions() {
    const containers = [
        document.getElementById("adminProductsCardGrid"),
        document.getElementById("adminProductsTableBody"),
    ];

    containers.forEach((container) => {
        if (!container || container.dataset.productActionsBound) return;

        container.addEventListener("click", handleAdminProductActionClick);
        container.dataset.productActionsBound = "true";
    });
}

function handleAdminProductActionClick(event) {
    const button = event.target.closest("[data-admin-product-action]");
    if (!button) return;

    event.preventDefault();
    event.stopPropagation();

    const productId = Number(button.dataset.productId || 0);
    const productIndex = Number(button.dataset.productIndex || -1);
    const targetStatus = button.dataset.targetStatus || "";
    const action = button.dataset.adminProductAction;

    if (action === "edit") {
        editAdminDealProduct(productId, productIndex);
        return;
    }

    if (action === "delete") {
        deleteAdminDealProduct(productId, productIndex);
        return;
    }

    if (["status", "active", "inactive"].includes(action)) {
        const resolvedStatus =
            targetStatus || (action === "active" ? "active" : "inactive");
        updateAdminDealProductStatus(productId, productIndex, resolvedStatus);
    }
}

function setAdminProductGroupValue(groupValue) {
    const groupSelect = document.getElementById("adminProductGroup");
    if (!groupSelect) return;

    const normalizedGroup = String(groupValue || "Other Services").trim() || "Other Services";
    const hasOption = Array.from(groupSelect.options).some((option) => option.value === normalizedGroup);

    groupSelect.value = hasOption ? normalizedGroup : "Other Services";
}

function getAdminProductFormPayload() {
    return {
        id: document.getElementById("adminProductId")?.value || "",
        name: document.getElementById("adminProductName")?.value.trim() || "",
        group: document.getElementById("adminProductGroup")?.value.trim() || "Other Services",
        price: Number(document.getElementById("adminProductPrice")?.value || 0),
        sort_order: Number(document.getElementById("adminProductSortOrder")?.value || 0),
        status: document.getElementById("adminProductStatus")?.value || "active",
    };
}

function resetAdminProductForm() {
    const form = document.getElementById("adminProductForm");
    form?.reset();
    const id = document.getElementById("adminProductId");
    const group = document.getElementById("adminProductGroup");
    const status = document.getElementById("adminProductStatus");

    if (id) id.value = "";
    if (group) group.value = "SEO Services";
    if (status) status.value = "active";
}

async function loadAdminDealProducts() {
    const tbody = document.getElementById("adminProductsTableBody");
    const cardGrid = document.getElementById("adminProductsCardGrid");
    const count = document.getElementById("adminProductsCount");
    if (!tbody && !cardGrid) return;

    if (tbody) {
        tbody.innerHTML = `<tr><td colspan="6">Loading products...</td></tr>`;
    }
    if (cardGrid) {
        cardGrid.innerHTML = `<div class="admin-product-empty-card">Loading products...</div>`;
    }
    if (count) count.textContent = "Loading...";

    try {
        let data = null;
        let lastError = null;
        const productUrls = getAdminDealProductListUrls();

        for (const url of productUrls) {
            try {
                const res = await fetch(url, {
                    cache: "no-store",
                });
                const result = await parseAdminApiResponse(res, "Admin products API");

                if (!res.ok || !result.success) {
                    throw new Error(result.message || "Failed to load products");
                }

                data = result;
                break;
            } catch (err) {
                lastError = err;
                if (!String(err.message || "").includes("404")) {
                    throw err;
                }
            }
        }

        if (!data) {
            throw lastError || new Error("Failed to load products");
        }

        adminDealProductsCache = Array.isArray(data.data) ? data.data : [];
        if (count) {
            const activeCount = adminDealProductsCache.filter((product) => product.status !== "inactive").length;
            count.textContent = `${activeCount} active / ${adminDealProductsCache.length} total`;
        }

        if (!adminDealProductsCache.length) {
            if (tbody) {
                tbody.innerHTML = `<tr><td colspan="6">No products found</td></tr>`;
            }
            if (cardGrid) {
                cardGrid.innerHTML = `<div class="admin-product-empty-card">No products found</div>`;
            }
            return;
        }

        if (cardGrid) {
            cardGrid.innerHTML = adminDealProductsCache.map((product, productIndex) => {
                const productId = Number(product.id || 0);
                const status = String(product.status || "active").toLowerCase() === "inactive" ? "inactive" : "active";
                const nextStatus = status === "inactive" ? "active" : "inactive";
                const nextStatusLabel = status === "inactive" ? "Active" : "Inactive";

                return `
                    <article class="admin-product-card ${status}">
                        <div class="admin-product-card-head">
                            <div>
                                <h4>${escapeAdminHtml(product.name || "-")}</h4>
                                <p>${escapeAdminHtml(product.group || "Products")}</p>
                            </div>
                            <span class="admin-product-status ${status}">${escapeAdminHtml(status)}</span>
                        </div>
                        <strong class="admin-product-card-price">${escapeAdminHtml(formatCurrency(product.price || 0))}</strong>
                        <div class="admin-product-row-actions">
                            <button type="button" class="tab-btn active" data-admin-product-action="edit" data-product-id="${productId || ""}" data-product-index="${productIndex}">Edit</button>
                            <button type="button" class="tab-btn" data-admin-product-action="status" data-target-status="${nextStatus}" data-product-id="${productId || ""}" data-product-index="${productIndex}">${nextStatusLabel}</button>
                            <button type="button" class="tab-btn danger" data-admin-product-action="delete" data-product-id="${productId || ""}" data-product-index="${productIndex}">Delete</button>
                        </div>
                    </article>
                `;
            }).join("");
        }

        if (tbody) {
            tbody.innerHTML = adminDealProductsCache.map((product, productIndex) => {
                const productId = Number(product.id || 0);
                const status = String(product.status || "active").toLowerCase() === "inactive" ? "inactive" : "active";
                const nextStatus = status === "inactive" ? "active" : "inactive";
                const nextStatusLabel = status === "inactive" ? "Active" : "Inactive";

                return `
                    <tr>
                        <td>${escapeAdminHtml(product.name || "-")}</td>
                        <td>${escapeAdminHtml(product.group || "Products")}</td>
                        <td>${escapeAdminHtml(formatCurrency(product.price || 0))}</td>
                        <td><span class="admin-product-status ${status}">${escapeAdminHtml(status)}</span></td>
                        <td>${escapeAdminHtml(product.sort_order ?? 0)}</td>
                        <td>
                            <div class="admin-product-row-actions">
                                <button type="button" class="tab-btn active" data-admin-product-action="edit" data-product-id="${productId || ""}" data-product-index="${productIndex}">Edit</button>
                                <button type="button" class="tab-btn" data-admin-product-action="status" data-target-status="${nextStatus}" data-product-id="${productId || ""}" data-product-index="${productIndex}">${nextStatusLabel}</button>
                                <button type="button" class="tab-btn danger" data-admin-product-action="delete" data-product-id="${productId || ""}" data-product-index="${productIndex}">Delete</button>
                            </div>
                        </td>
                    </tr>
                `;
            }).join("");
        }
    } catch (err) {
        console.error("Admin Products Error:", err);
        if (tbody) {
            tbody.innerHTML = `<tr><td colspan="6">${escapeAdminHtml(err.message || "Unable to load products")}</td></tr>`;
        }
        if (cardGrid) {
            cardGrid.innerHTML = `<div class="admin-product-empty-card">${escapeAdminHtml(err.message || "Unable to load products")}</div>`;
        }
        if (count) count.textContent = "Unable to load";
    }
}

async function saveAdminDealProduct(event) {
    event.preventDefault();

    const payload = getAdminProductFormPayload();
    if (!payload.name) {
        showPopup("Missing Product", "Product name is required.", false);
        return;
    }

    if (!Number.isFinite(payload.price) || payload.price <= 0) {
        showPopup("Invalid Price", "Product price must be greater than 0.", false);
        return;
    }

    const isEdit = Boolean(payload.id);
    const urls = getAdminDealProductApiUrls(payload.id || "");

    try {
        let data = null;
        let lastError = null;

        for (const url of urls) {
            try {
                const res = await fetch(url, {
                    method: isEdit ? "PUT" : "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload),
                });
                const result = await parseAdminApiResponse(res, "Save product API");

                if (!res.ok || !result.success) {
                    throw new Error(result.message || "Failed to save product");
                }

                data = result;
                break;
            } catch (err) {
                lastError = err;
                if (!String(err.message || "").includes("404")) {
                    throw err;
                }
            }
        }

        if (!data) {
            throw lastError || new Error("Failed to save product");
        }

        showPopup("Saved", data.message || "Product saved successfully.", true);
        resetAdminProductForm();
        loadAdminDealProducts();
    } catch (err) {
        console.error("Save Product Error:", err);
        showPopup("Error", err.message || "Failed to save product", false);
    }
}

function getAdminDealProductByRef(productId, productIndex) {
    const numericId = Number(productId || 0);
    if (numericId) {
        const product = adminDealProductsCache.find((item) => Number(item.id) === numericId);
        if (product) return product;
    }

    const numericIndex = Number(productIndex);
    if (Number.isInteger(numericIndex) && numericIndex >= 0) {
        return adminDealProductsCache[numericIndex] || null;
    }

    return null;
}

function editAdminDealProduct(productId, productIndex = -1) {
    const product = getAdminDealProductByRef(productId, productIndex);
    if (!product) return;

    document.getElementById("adminProductId").value = product.id || "";
    document.getElementById("adminProductName").value = product.name || "";
    setAdminProductGroupValue(product.group);
    document.getElementById("adminProductPrice").value = Number(product.price || 0);
    document.getElementById("adminProductSortOrder").value = Number(product.sort_order || 0);
    document.getElementById("adminProductStatus").value =
        String(product.status || "active").toLowerCase() === "inactive" ? "inactive" : "active";

    document.getElementById("adminProductForm")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
    });
}

async function updateAdminDealProductStatus(productId, productIndex = -1, targetStatus = "inactive") {
    const product = getAdminDealProductByRef(productId, productIndex);
    if (!product) return;

    const numericId = Number(product.id || productId || 0);
    const status = String(targetStatus || "").toLowerCase() === "active" ? "active" : "inactive";
    const label = product.name || "this product";

    if (!numericId) {
        showPopup("Error", "Product id is missing.", false);
        return;
    }

    if (status === "inactive" && !window.confirm(`Mark ${label} as inactive?`)) {
        return;
    }

    const statusPayload = { status };
    const fullPayload = {
        name: product.name || "",
        group: product.group || "Other Services",
        price: Number(product.price || 0),
        sort_order: Number(product.sort_order || 0),
        status,
    };
    const requests = [
        ...getAdminDealProductApiUrls(numericId, "/status").map((url) => ({
            url,
            method: "PATCH",
            payload: statusPayload,
        })),
        ...getAdminDealProductApiUrls(numericId).map((url) => ({
            url,
            method: "PUT",
            payload: fullPayload,
        })),
    ];

    try {
        let data = null;
        let lastError = null;

        for (const request of requests) {
            try {
                const res = await fetch(request.url, {
                    method: request.method,
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(request.payload),
                });
                const result = await parseAdminApiResponse(res, "Product status API");

                if (!res.ok || !result.success) {
                    throw new Error(result.message || "Failed to update product status");
                }

                data = result;
                break;
            } catch (err) {
                lastError = err;
                if (!String(err.message || "").includes("404")) {
                    throw err;
                }
            }
        }

        if (!data) {
            throw lastError || new Error("Failed to update product status");
        }

        showPopup(
            "Updated",
            data.message || `Product marked ${status}.`,
            true,
        );
        loadAdminDealProducts();
    } catch (err) {
        console.error("Product Status Error:", err);
        showPopup("Error", err.message || "Failed to update product status", false);
    }
}

async function deleteAdminDealProduct(productId, productIndex = -1) {
    const product = getAdminDealProductByRef(productId, productIndex);
    if (!product) return;

    const numericId = Number(product.id || productId || 0);
    const label = product.name || "this product";

    if (!numericId) {
        showPopup("Error", "Product id is missing.", false);
        return;
    }

    if (!window.confirm(`Are you sure you want to permanently delete "${label}"?`)) {
        return;
    }

    const urls = getAdminDealProductApiUrls(numericId);

    try {
        let data = null;
        let lastError = null;

        for (const url of urls) {
            try {
                const res = await fetch(url, {
                    method: "DELETE",
                });
                const result = await parseAdminApiResponse(res, "Delete product API");

                if (!res.ok || !result.success) {
                    throw new Error(result.message || "Failed to delete product");
                }

                data = result;
                break;
            } catch (err) {
                lastError = err;
                if (!String(err.message || "").includes("404")) {
                    throw err;
                }
            }
        }

        if (!data) {
            throw lastError || new Error("Failed to delete product");
        }

        showPopup("Deleted", data.message || "Product deleted successfully.", true);
        loadAdminDealProducts();
    } catch (err) {
        console.error("Delete Product Error:", err);
        showPopup("Error", err.message || "Failed to delete product", false);
    }
}

Object.assign(window, {
    loadAdminDealProducts,
    resetAdminProductForm,
    editAdminDealProduct,
    deleteAdminDealProduct,
    updateAdminDealProductStatus,
});

function getAdminEmptyTrackerCounts() {
    return {
        total: 0,
        assigned: 0,
        ongoing: 0,
        completed: 0,
        unassigned: 0,
    };
}

async function loadAdminProjectTracker() {
    if (!window.ProjectTrackerUI) return;

    ProjectTrackerUI.renderMessage(
        "adminProjectTrackerContainer",
        "Loading project updates...",
        "Fetching assignment and phase progress for all assigned projects.",
    );

    try {
        const res = await fetch(getAdminPanelScopedApiUrl("/api/project-tracker?scope=admin"), {
            cache: "no-store",
        });
        const text = await res.text();

        let result = {};
        try {
            result = text ? JSON.parse(text) : {};
        } catch (parseError) {
            throw new Error("Project tracker returned an invalid response");
        }

        if (!res.ok || !result.success) {
            throw new Error(result.message || "Failed to load project tracker");
        }

        const scopedProjects = filterAdminRowsByCompanyScope(result.data);
        const scopedCounts = scopedProjects.reduce(
            (counts, project) => {
                const status = String(project.status || "unassigned").toLowerCase().trim();
                counts.total += 1;
                counts[status] = (counts[status] || 0) + 1;
                return counts;
            },
            getAdminEmptyTrackerCounts(),
        );
        const scopedAssignmentCounts = scopedProjects.reduce(
            (counts, project) => {
                const projectCounts = project.assignmentCounts || {};
                ["total", "assigned", "ongoing", "completed"].forEach((key) => {
                    counts[key] += Number(projectCounts[key] || 0);
                });
                return counts;
            },
            { total: 0, assigned: 0, ongoing: 0, completed: 0 },
        );
        const scopedResult = {
            ...result,
            data: scopedProjects,
            counts: scopedCounts,
            assignmentCounts: scopedAssignmentCounts,
        };

        ProjectTrackerUI.renderStats("adminProjectTrackerStats", scopedCounts, {
            assignmentCounts: scopedAssignmentCounts,
        });
        ProjectTrackerUI.renderProjects("adminProjectTrackerContainer", scopedResult);
    } catch (err) {
        console.error("Admin Project Tracker Error:", err);
        ProjectTrackerUI.renderStats("adminProjectTrackerStats", getAdminEmptyTrackerCounts(), {
            assignmentCounts: { total: 0 },
        });
        ProjectTrackerUI.renderMessage(
            "adminProjectTrackerContainer",
            "Project tracker unavailable",
            "Live phase details will show here after the latest server update is active.",
        );
    }
}

// Section switch
function showSection(id) {
    if (id !== "team") {
        closeUserForm();
    }
    if (id !== "leads") {
        closeAdminLeadForm();
    }
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    const employeeDetails = document.getElementById("employeeDetails");
    if (employeeDetails && id !== "employeeDetails") {
        employeeDetails.style.display = "none";
    }
    const section = document.getElementById(id);
    if (section) section.classList.add('active');
    updateAdminPanelCompanyFilterVisibility(id);
    document.querySelectorAll('.sidebar li').forEach(li => li.classList.remove('active'));
    const activeLi = Array.from(document.querySelectorAll('.sidebar li'))
        .find(li => li.getAttribute('onclick') && li.getAttribute('onclick').includes(`('${id}')`));
    if (activeLi) activeLi.classList.add('active');
    if (id === 'dashboard') loadAdminDashboard();
    if (id === 'leads') loadLeads();
    if (id === 'appointments') loadAppointments();
    if (id === 'followups') loadFollowups();
    if (id === 'deals') loadDeals();
      if (id === 'app-location') loadAppLocationInit();
    if (id === 'renewals') loadAdminRenewals();
    if (id === 'notifications') loadDownsaleNotifications();
    if (id === 'attendance') loadAdminAttendance();
    if (id === 'team') loadTeam();
    if (id === 'projects') {
        loadProjects();
        loadProjectSummary();
        loadAdminProjectTracker();
    }
    if (id === 'salary') {
        window.PayrollUI?.handleSectionShown('salary');
    }
    if (id === 'daily-work' && typeof loadAdminDailyWork === 'function') {
        loadAdminDailyWork();
    }
    if (id === 'logTable' && typeof loadLogTable === 'function') {
        loadLogTable();
    }
    if (id === 'proposals') {
        window.AdminProposals?.setup();
        window.AdminProposals?.load();
    }
    if (id === 'products') loadAdminDealProducts();
    if (id === 'proposalTemplates') loadProposalTemplates();
}

function scrollAdminViewportToTop() {
    const mainContent = document.querySelector(".main-content");

    if (mainContent && typeof mainContent.scrollTo === "function") {
        mainContent.scrollTo({ top: 0, behavior: "smooth" });
    }

    if (typeof window.scrollTo === "function") {
        window.scrollTo({ top: 0, behavior: "smooth" });
    }
}

function openAdminSection(sectionId) {
    showSection(sectionId);
    scrollAdminViewportToTop();
}

function isDashboardPanelActionBlocked(event) {
    return Boolean(
        event.target.closest("a, button, input, select, textarea, .funnel-row, .summary-service-btn, .summary-service-dropdown"),
    );
}

document.addEventListener("click", (event) => {
    const sectionLink = event.target.closest("[data-admin-section-link]");
    if (sectionLink) {
        const sectionId = sectionLink.dataset.adminSectionLink;
        if (sectionId) {
            event.preventDefault();
            openAdminSection(sectionId);
        }
        return;
    }

    const panel = event.target.closest("[data-dashboard-section]");
    if (!panel || isDashboardPanelActionBlocked(event)) return;

    openAdminSection(panel.dataset.dashboardSection);
});

document.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;

    const sectionLink = event.target.closest("[data-admin-section-link]");
    if (sectionLink) {
        const sectionId = sectionLink.dataset.adminSectionLink;
        if (sectionId) {
            event.preventDefault();
            openAdminSection(sectionId);
        }
        return;
    }

    const panel = event.target.closest("[data-dashboard-section]");
    if (!panel || event.target !== panel) return;

    event.preventDefault();
    openAdminSection(panel.dataset.dashboardSection);
});

function openAdminTeamRegistration() {
    openAdminSection("team");
    requestAnimationFrame(() => openUserForm());
}

function refreshAdminDashboardView() {
    openAdminSection("dashboard");
}

function handleAdminDashboardMonthChange() {
    const monthKey = document.getElementById("adminDashboardMonthFilter")?.value;
    setupAdminDashboardControls();
    syncAdminDashboardMonthFilters(monthKey);
    renderAdminDashboard();
    loadAdminSalesTargetSummary();
    loadAdminTeamTargetsSummary(true);
}

function handleAdminTeamTargetsMonthChange() {
    const monthKey = document.getElementById("adminTeamTargetsMonthFilter")?.value;
    setupAdminDashboardControls();
    syncAdminDashboardMonthFilters(monthKey);
    renderAdminDashboard();
    loadAdminSalesTargetSummary();
    loadAdminTeamTargetsSummary(true);
}

// Popup
function showPopup(title, message, isSuccess, options = {}) {
    const popup = document.getElementById('popup');
    const icon = document.getElementById('popupIcon');
    const titleEl = document.getElementById('popupTitle');
    const msgEl = document.getElementById('popupMessage');
    const actionsEl = document.getElementById("popupActions");

    titleEl.textContent = title;
    msgEl.textContent = message;
    if (adminPopupTimer) {
        clearTimeout(adminPopupTimer);
        adminPopupTimer = null;
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

    // 🔥 ICON FIX
    if (isSuccess) {
        icon.className = 'fas fa-check-circle';
        icon.style.color = ADMIN_THEME_COLORS.accent;
    } else {
        icon.className = 'fas fa-exclamation-circle';
        icon.style.color = '#ef4444';
    }

    popup.classList.remove('hidden');

    // 🔥 Auto close after 1.5 sec
    if (options.autoClose !== false) {
        adminPopupTimer = setTimeout(() => {
            popup.classList.add('hidden');
        }, options.autoCloseMs || 1500);
    }
}

function hidePopup() {
    const popup = document.getElementById("popup");
    if (adminPopupTimer) {
        clearTimeout(adminPopupTimer);
        adminPopupTimer = null;
    }
    popup?.classList.add("hidden");
}

async function copyTextToClipboard(text) {
    const value = String(text || "").trim();
    if (!value) return false;

    if (navigator.clipboard?.writeText) {
        try {
            await navigator.clipboard.writeText(value);
            return true;
        } catch (err) {
            console.warn("Clipboard copy failed:", err);
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
    } catch (err) {
        console.warn("Legacy clipboard copy failed:", err);
    }

    document.body.removeChild(tempInput);
    return copied;
}

async function handleProfileSetupInvite(profileSetup) {
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

function openProfileSetupDraft(profileSetup) {
    const gmailComposeUrl = String(profileSetup?.gmailComposeUrl || "").trim();
    const mailtoUrl = String(profileSetup?.mailtoUrl || "").trim();
    const url = gmailComposeUrl || mailtoUrl;
    if (!url) return false;
    window.open(url, "_blank", "noopener,noreferrer");
    return true;
}

async function resendProfileSetupEmail(userId, profileSetup, button = null) {
    const normalizedUserId = Number(userId || 0);
    if (!normalizedUserId) {
        showPopup("Profile Form", "User was created, but user id is missing for email resend.", false, { autoClose: false });
        return;
    }

    const originalLabel = button?.textContent || "";
    if (button) {
        button.disabled = true;
        button.textContent = "Sending...";
    }

    try {
        const response = await fetch(`${BASE_URL}/api/admin/users/${normalizedUserId}/profile-setup-link`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ requireEmail: true }),
        });
        const result = await response.json().catch(() => ({}));
        const nextProfileSetup = result.profileSetup || profileSetup || {};
        const emailDispatch = result.emailDispatch || nextProfileSetup.emailDispatch || {};

        if (!response.ok || !result.success || !emailDispatch.sent) {
            throw new Error(
                result.message ||
                emailDispatch.message ||
                "Profile form email could not be sent. Please share the link manually.",
            );
        }

        showPopup(
            "Mail Sent Successfully",
            "Profile form email sent successfully.",
            true,
        );
    } catch (error) {
        const fallbackActions = [];
        if (profileSetup?.gmailComposeUrl || profileSetup?.mailtoUrl) {
            fallbackActions.push({
                label: "Open Email Draft",
                variant: "primary",
                onClick: () => openProfileSetupDraft(profileSetup),
            });
        }
        fallbackActions.push({
            label: "Close",
            variant: "secondary",
            onClick: hidePopup,
        });
        showPopup(
            "Email Not Sent",
            error.message || "Profile form email could not be sent. Please share the link manually.",
            false,
            { autoClose: false, actions: fallbackActions },
        );
    } finally {
        if (button) {
            button.disabled = false;
            button.textContent = originalLabel || "Send Profile Link by Email";
        }
    }
}

function showProfileSetupEmailPrompt(userId, profileSetup, inviteResult = {}) {
    const message = inviteResult.emailMessage ||
        "Profile form email is ready to send. Click Send Profile Link by Email to deliver it.";
    const canTryAutomaticEmail =
        !Array.isArray(inviteResult.requiredConfig) || inviteResult.requiredConfig.length === 0;
    const actions = [];

    if (canTryAutomaticEmail) {
        actions.push({
            label: "Send Profile Link by Email",
            variant: "primary",
            onClick: (button) => resendProfileSetupEmail(userId, profileSetup, button),
        });
    }

    if (profileSetup?.gmailComposeUrl || profileSetup?.mailtoUrl) {
        actions.push({
            label: "Open Email Draft",
            variant: "primary",
            onClick: () => openProfileSetupDraft(profileSetup),
        });
    }

    actions.push(
        {
            label: "Copy Link",
            variant: "secondary",
            onClick: async () => {
                const copied = await copyTextToClipboard(profileSetup?.invitationLink || "");
                showPopup(
                    copied ? "Link Copied" : "Profile Link",
                    copied ? "Profile form link copied." : profileSetup?.invitationLink || "Profile link unavailable.",
                    copied,
                    { autoClose: copied ? undefined : false },
                );
            },
        },
        {
            label: "Close",
            variant: "secondary",
            onClick: hidePopup,
        },
    );

    showPopup(
        "Profile Form Ready To Send",
        message,
        true,
        {
            autoClose: false,
            actions,
        },
    );
}

async function loadLeads() {
    const table = document.getElementById('leadsTable');
    if (!table) return;
    table.innerHTML = '';

    try {
        const res = await fetch(
            getAdminPanelScopedApiUrl("/api/leads?role=admin"),
            { cache: "no-store" },
        );
        const data = await res.json();

        const leads = filterAdminRowsByCompanyScope(
            data.success && Array.isArray(data.data) ? data.data : [],
        );
        adminDashboardCache.leads = leads;
        adminDashboardState.leads = leads;
        renderAdminDashboard();

        const monthFilter = document.getElementById("adminLeadsMonthFilter")?.value || "";
        let filteredLeads = leads;
        if (monthFilter) {
            filteredLeads = leads.filter(item => isAdminDateInMonth(item.created_at || item.created_date, monthFilter));
        }

        if (!filteredLeads.length) {
            table.innerHTML = `<tr><td colspan="7">No leads found</td></tr>`;
            return;
        }

        table.innerHTML = filteredLeads
            .map((lead) => {
                const stage = getAdminLeadRowStage(lead);
                const createdDate = formatDate(lead.created_at || lead.created_date);
                const leadId = Number(lead.id || 0);

                return `
                    <tr
                        class="admin-clickable-info-row admin-clickable-lead-row"
                        onclick="openAdminLeadDetailsFromRow(event, ${leadId})"
                        title="Click to view full lead details"
                    >
                        <td>${escapeAdminHtml(leadId || "-")}</td>
                        <td>${escapeAdminHtml(lead.company_name || "-")}</td>
                        <td>${escapeAdminHtml(lead.client_name || "-")}</td>
                        <td>${escapeAdminHtml(lead.contact || "-")}</td>
                        <td>${escapeAdminHtml(lead.email || "-")}</td>
                        <td>
                            <span class="admin-lead-stage ${escapeAdminHtml(stage.className)}">
                                ${escapeAdminHtml(stage.label)}
                            </span>
                            <small class="admin-lead-stage-date">${escapeAdminHtml(createdDate)}</small>
                        </td>
                        <td>
                            <div class="admin-lead-row-actions">
                                ${renderAdminLeadShiftActions(lead, stage.key)}
                            </div>
                        </td>
                    </tr>
                `;
            })
            .join("");

        filterTable('leadsTable', 'leadsSearch');
    } catch (err) {
        console.error("Leads Error:", err);
        table.innerHTML = `<tr><td colspan="7">Unable to load leads</td></tr>`;
    }
}

function getAdminLeadRowStage(lead = {}) {
    const leadStatus = String(lead.lead_status || "").toLowerCase().trim();
    const actionType = String(lead.action_type || "").toLowerCase().trim();

    if (leadStatus === "deal_closed") {
        return { key: "deal_closed", className: "deal", label: "Deal Closed" };
    }

    if (leadStatus === "not_interested") {
        return { key: "not_interested", className: "not-interested", label: "Not Interested" };
    }

    if (actionType === "appointment") {
        return { key: "appointment", className: "appointment", label: "Appointment" };
    }

    if (actionType === "followup") {
        return { key: "followup", className: "followup", label: "Follow Up" };
    }

    return { key: "lead", className: "lead", label: "Lead" };
}

function renderAdminLeadShiftActions(lead = {}, stageKey = "") {
    const leadId = Number(lead.id || 0);
    const canMoveLead = leadId && !["deal_closed", "not_interested"].includes(stageKey);
    if (!canMoveLead) return `<span class="admin-lead-no-action">-</span>`;

    const appointmentButton =
        stageKey !== "appointment"
            ? `
                <button type="button" class="admin-lead-action-btn appointment" onclick="openAdminLeadAppointmentModal(${leadId})" title="Set Appointment">
                    <i class="fas fa-calendar-plus"></i><span>Appointment</span>
                </button>
            `
            : "";
    const followupButton =
        stageKey !== "followup"
            ? `
                <button type="button" class="admin-lead-action-btn followup" onclick="openAdminLeadFollowupModal(${leadId})" title="Set Follow Up">
                    <i class="fas fa-clock"></i><span>Follow Up</span>
                </button>
            `
            : "";

    return appointmentButton + followupButton || `<span class="admin-lead-no-action">-</span>`;
}

function setupAdminLeadShiftModals() {
    const appointmentForm = document.getElementById("adminLeadAppointmentForm");
    if (appointmentForm && !appointmentForm.dataset.bound) {
        appointmentForm.addEventListener("submit", handleAdminLeadAppointmentSubmit);
        appointmentForm.dataset.bound = "true";
    }

    ["adminLeadAppointmentDate", "adminLeadAppointmentTime"].forEach((id) => {
        const field = document.getElementById(id);
        if (!field || field.dataset.bound) return;
        field.addEventListener("change", () => loadAdminLeadAppointmentEmployees());
        field.dataset.bound = "true";
    });

    const followupForm = document.getElementById("adminLeadFollowupForm");
    if (followupForm && !followupForm.dataset.bound) {
        followupForm.addEventListener("submit", handleAdminLeadFollowupSubmit);
        followupForm.dataset.bound = "true";
    }
}

function openAdminLeadShiftModal(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) return;
    modal.classList.remove("hidden");
    modal.classList.add("show");
    document.body.classList.add("modal-open");
}

function closeAdminLeadShiftModal(modalId, formId) {
    const modal = document.getElementById(modalId);
    const form = document.getElementById(formId);
    if (modal) {
        modal.classList.remove("show");
        modal.classList.add("hidden");
    }
    form?.reset();
    document.body.classList.remove("modal-open");
}

async function openAdminLeadAppointmentModal(leadId) {
    const normalizedLeadId = Number(leadId || 0);
    if (!normalizedLeadId) return;

    const info = document.getElementById("adminLeadAppointmentInfo");
    const idField = document.getElementById("adminLeadAppointmentId");
    const dateField = document.getElementById("adminLeadAppointmentDate");
    const timeField = document.getElementById("adminLeadAppointmentTime");
    const locationField = document.getElementById("adminLeadAppointmentLocation");

    if (idField) idField.value = String(normalizedLeadId);
    if (info) info.textContent = "Loading lead details...";
    openAdminLeadShiftModal("adminLeadAppointmentModal");

    try {
        const res = await fetch(`${BASE_URL}/api/leads/${normalizedLeadId}`, { cache: "no-store" });
        const result = await res.json();
        const lead = result.success ? result.data || {} : {};

        if (info) {
            info.innerHTML = `<strong>${escapeAdminHtml(lead.company_name || "Lead")}</strong> - ${escapeAdminHtml(lead.client_name || "-")}`;
        }
        if (dateField) dateField.value = lead.app_date ? String(lead.app_date).slice(0, 10) : "";
        if (timeField) timeField.value = lead.app_time ? String(lead.app_time).slice(0, 5) : "";
        if (locationField) locationField.value = lead.location || lead.maps_lnk || "";
        await loadAdminLeadAppointmentEmployees();
        selectAdminLeadAppointmentEmployee(lead.assign_emp, lead.assign_emp_id);
    } catch (err) {
        console.error("Admin appointment lead load error:", err);
        if (info) info.textContent = "Lead details unavailable";
        await loadAdminLeadAppointmentEmployees();
    }
}

function closeAdminLeadAppointmentModal() {
    document.activeElement?.blur();
    closeAdminLeadShiftModal("adminLeadAppointmentModal", "adminLeadAppointmentForm");
}

async function loadAdminLeadAppointmentEmployees() {
    const select = document.getElementById("adminLeadAppointmentAssignEmp");
    if (!select) return;

    const date = document.getElementById("adminLeadAppointmentDate")?.value || "";
    const time = document.getElementById("adminLeadAppointmentTime")?.value || "";

    try {
        const result = await fetchAdminLeadEmployeeList(date, time);
        if (!result.success) throw new Error(result.message || "Failed to load employees");
        populateAdminLeadEmployeeSelect(
            select,
            result.data || [],
            date && time ? "No employee available at this time" : "No employees found",
        );
    } catch (err) {
        console.error("Admin appointment employee load error:", err);
        populateAdminLeadEmployeeSelect(select, [], "Unable to load employees");
    }
}

function selectAdminLeadAppointmentEmployee(name, id) {
    const select = document.getElementById("adminLeadAppointmentAssignEmp");
    if (!select) return;

    const normalizedId = String(id || "");
    const normalizedName = String(name || "");
    const option = Array.from(select.options).find((item) =>
        (normalizedId && item.dataset.employeeId === normalizedId) ||
        (normalizedName && item.value === normalizedName),
    );

    if (option) select.value = option.value;
}

async function handleAdminLeadAppointmentSubmit(event) {
    event.preventDefault();

    const leadId = Number(document.getElementById("adminLeadAppointmentId")?.value || 0);
    const selectedEmployee = getSelectedAdminLeadEmployeeMeta(
        document.getElementById("adminLeadAppointmentAssignEmp"),
    );
    const payload = {
        action_type: "appointment",
        app_date: document.getElementById("adminLeadAppointmentDate")?.value || "",
        app_time: document.getElementById("adminLeadAppointmentTime")?.value || "",
        assign_emp: selectedEmployee.name,
        assign_emp_id: selectedEmployee.id,
        assign_emp_contact: selectedEmployee.contact,
        location: document.getElementById("adminLeadAppointmentLocation")?.value || "",
        notify_whatsapp: false,
    };

    try {
        const res = await fetch(`${BASE_URL}/api/leads/${leadId}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });
        const result = await res.json();
        if (!res.ok || !result.success) {
            throw new Error(result.message || "Failed to set appointment");
        }

        closeAdminLeadAppointmentModal();
        showPopup("Appointment Saved", "Lead moved to appointments successfully.", true);
        loadLeads();
        loadAppointments();
        loadAdminDashboard();
    } catch (err) {
        console.error("Admin appointment save error:", err);
        showPopup("Appointment Error", err.message || "Failed to set appointment", false);
    }
}

async function openAdminLeadFollowupModal(leadId) {
    const normalizedLeadId = Number(leadId || 0);
    if (!normalizedLeadId) return;

    const info = document.getElementById("adminLeadFollowupInfo");
    const idField = document.getElementById("adminLeadFollowupId");
    const dateField = document.getElementById("adminLeadFollowupDate");
    const timeField = document.getElementById("adminLeadFollowupTime");
    const reasonField = document.getElementById("adminLeadFollowupReason");

    if (idField) idField.value = String(normalizedLeadId);
    if (info) info.textContent = "Loading lead details...";
    openAdminLeadShiftModal("adminLeadFollowupModal");

    try {
        const res = await fetch(`${BASE_URL}/api/leads/${normalizedLeadId}`, { cache: "no-store" });
        const result = await res.json();
        const lead = result.success ? result.data || {} : {};

        if (info) {
            info.innerHTML = `<strong>${escapeAdminHtml(lead.company_name || "Lead")}</strong> - ${escapeAdminHtml(lead.client_name || "-")}`;
        }
        if (dateField) dateField.value = lead.follow_date ? String(lead.follow_date).slice(0, 10) : "";
        if (timeField) timeField.value = lead.follow_time ? String(lead.follow_time).slice(0, 5) : "";
        if (reasonField) reasonField.value = lead.reason || "";
    } catch (err) {
        console.error("Admin followup lead load error:", err);
        if (info) info.textContent = "Lead details unavailable";
    }
}

function closeAdminLeadFollowupModal() {
    document.activeElement?.blur();
    closeAdminLeadShiftModal("adminLeadFollowupModal", "adminLeadFollowupForm");
}

async function handleAdminLeadFollowupSubmit(event) {
    event.preventDefault();

    const leadId = Number(document.getElementById("adminLeadFollowupId")?.value || 0);
    const payload = {
        action_type: "followup",
        follow_date: document.getElementById("adminLeadFollowupDate")?.value || "",
        follow_time: document.getElementById("adminLeadFollowupTime")?.value || "",
        reason: document.getElementById("adminLeadFollowupReason")?.value || "",
        created_by_name: currentUser?.name || "",
    };

    try {
        const res = await fetch(`${BASE_URL}/api/leads/${leadId}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });
        const result = await res.json();
        if (!res.ok || !result.success) {
            throw new Error(result.message || "Failed to set follow up");
        }

        closeAdminLeadFollowupModal();
        showPopup("Follow Up Saved", "Lead moved to follow ups successfully.", true);
        loadLeads();
        loadFollowups();
        loadAdminDashboard();
    } catch (err) {
        console.error("Admin followup save error:", err);
        showPopup("Follow Up Error", err.message || "Failed to set follow up", false);
    }
}

function formatAdminAppointmentTime(value) {
    const raw = String(value || "").trim();
    return formatAdminAttendanceTime(raw);
}

function getAdminAppointmentStatus(item = {}) {
    const stage = String(item.appointment_stage || "").toLowerCase().trim();
    const leadStatus = String(item.lead_status || "").toLowerCase().trim();
    const appointmentStatus = String(item.appointment_status || "").toLowerCase().trim();

    if (stage === "not_confirmed" || appointmentStatus === "not_confirmed") {
        return { className: "not-confirmed", label: "Not Confirmed" };
    }

    if (leadStatus === "followup" || stage === "confirmed" || appointmentStatus === "confirmed") {
        return { className: "confirmed", label: "Confirmed" };
    }

    return { className: "active", label: "Active" };
}

function parseAdminStoredArray(value) {
    if (Array.isArray(value)) return value;
    if (value == null || value === "") return [];

    try {
        const parsed = JSON.parse(value);
        if (Array.isArray(parsed)) return parsed;
    } catch (err) {
        // Older rows may contain comma-separated values.
    }

    return String(value)
        .split(",")
        .map(item => item.trim())
        .filter(Boolean);
}

function formatAdminLeadHumanLabel(value) {
    return String(value || "")
        .replace(/[_-]+/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .replace(/\b\w/g, char => char.toUpperCase()) || "-";
}

function formatAdminLeadDetailsValue(value) {
    const text = String(value ?? "").trim();
    return text || "-";
}

function formatAdminLeadDetailsList(value) {
    const labels = parseAdminStoredArray(value).map(item => {
        const normalized = String(item || "").trim();
        if (normalized === "ads") return "Google Ads";
        if (normalized === "google_profile") return "Google Profile";
        return formatAdminLeadHumanLabel(normalized);
    });

    return labels.length ? labels.join(", ") : "-";
}

function buildAdminLeadDetailsMapValue(lead = {}) {
    const raw = String(lead.maps_lnk || lead.location || "").trim();
    if (!raw) return "-";

    const url = /^https?:\/\//i.test(raw)
        ? raw
        : `https://www.google.com/maps?q=${encodeURIComponent(raw)}`;

    return `
        <a href="${escapeAdminHtml(url)}" target="_blank" rel="noopener noreferrer" class="admin-location-link">
            View Location
        </a>
    `;
}

function renderAdminLeadDetailsSection(title, rows = []) {
    const rowHtml = rows
        .map(([label, value, isHtml = false]) => {
            const content = isHtml
                ? value || "-"
                : escapeAdminHtml(formatAdminLeadDetailsValue(value));

            return `
                <div class="admin-lead-detail-item">
                    <span>${escapeAdminHtml(label)}</span>
                    <strong>${content}</strong>
                </div>
            `;
        })
        .join("");

    return `
        <section class="admin-lead-detail-section">
            <h3>${escapeAdminHtml(title)}</h3>
            <div class="admin-lead-detail-grid">${rowHtml}</div>
        </section>
    `;
}

function renderAdminLeadDetails(lead = {}) {
    const hasDealDetails =
        String(lead.lead_status || "").toLowerCase().trim() === "deal_closed" ||
        [
            lead.deal_amount,
            lead.received_amount,
            lead.remaining_amount,
            lead.gst_amount,
            lead.payment_method,
            lead.payment_date,
            lead.closed_date,
            lead.pay_stat,
        ].some(value => String(value ?? "").trim());

    const sections = [
        renderAdminLeadDetailsSection("Client", [
            ["Company", lead.company_name],
            ["Client", lead.client_name],
            ["Contact", lead.contact],
            ["Alternate Contact", lead.alternate_contact],
            ["Telephone", lead.telephone],
            ["Email", lead.email],
            ["GST Number", lead.gst_no],
        ]),
        renderAdminLeadDetailsSection("Address", [
            ["Flat / Office", lead.flat_no],
            ["Building", lead.building_name],
            ["Locality", lead.locality],
            ["City", lead.city],
            ["Pincode", lead.pincode],
            ["State", lead.state],
            ["Map", buildAdminLeadDetailsMapValue(lead), true],
        ]),
        renderAdminLeadDetailsSection("Services", [
            ["Web", formatAdminLeadDetailsList(lead.web_type)],
            ["SEO", formatAdminLeadDetailsList(lead.seo_type)],
            ["SMO", formatAdminLeadDetailsList(lead.smo_type)],
            ["App", formatAdminLeadDetailsList(lead.app_type)],
            ["ERP/CRM", formatAdminLeadDetailsList(lead.erp_type)],
            ["Other Services", formatAdminLeadDetailsList(lead.services)],
            ["Service Notes", lead.service_notes],
        ]),
        renderAdminLeadDetailsSection("Appointment", [
            ["Date", formatDate(lead.app_date)],
            ["Time", formatAdminAppointmentTime(lead.app_time)],
            ["Assigned ME", lead.assign_emp],
            ["Status", getAdminAppointmentStatus(lead).label],
            ["Source", formatAdminLeadHumanLabel(lead.source_lead)],
            ["Industry", formatAdminLeadHumanLabel(lead.industry_type)],
            ["Sales Type", formatAdminLeadHumanLabel(lead.sales_type || "new")],
            ["Additional Notes", lead.additional_notes],
        ]),
    ];

    if (hasDealDetails) {
        const dealAmount = getAdminDealAmount(lead);
        const receivedAmount = getAdminDealReceivedAmount(lead);
        const remainingAmount = getAdminDealRemainingAmount(lead);
        const gstAmount = hasAdminStoredAmount(lead.gst_amount)
            ? Number(lead.gst_amount || 0)
            : getAdminInclusiveGstAmount(dealAmount);

        sections.push(
            renderAdminLeadDetailsSection("Deal", [
                ["Deal Amount", formatCompactMoney(dealAmount)],
                ["Down Payment", formatCompactMoney(receivedAmount)],
                ["Remaining Amount", formatCompactMoney(remainingAmount)],
                ["GST Amount", formatCompactMoney(gstAmount)],
                ["Payment Method", lead.payment_method],
                ["Payment Status", formatAdminLeadHumanLabel(lead.pay_stat || "pending")],
                ["Payment Date", formatDate(lead.payment_date)],
                ["Closed Date", formatDate(lead.closed_date)],
                ["Assigned ME", lead.assigned_me_name || lead.me_name || lead.assign_emp],
                ["Original TME", lead.tme_name || "-"],
                ["Closed By", lead.closed_by_name || lead.received_by || lead.closed_by],
                ["Closed TME", lead.closed_tme_name || ""],
            ]),
        );
    }

    return sections.join("");
}

function getCachedAdminLeadById(leadId) {
    const normalizedLeadId = Number(leadId || 0);
    if (!normalizedLeadId) return null;

    const caches = [
        adminDashboardCache.leads,
        adminDashboardCache.appointments,
        adminDashboardCache.followups,
        adminDashboardCache.deals,
        adminAppointmentsRows,
    ];

    for (const cache of caches) {
        if (!Array.isArray(cache)) continue;
        const match = cache.find((item) =>
            Number(item.id || 0) === normalizedLeadId ||
            Number(item.lead_id || 0) === normalizedLeadId,
        );
        if (match) return match;
    }

    return null;
}

function isAdminTableInteractiveTarget(event) {
    return Boolean(event?.target?.closest?.(
        "button, a, select, input, textarea, label, option",
    ));
}

function openAdminLeadDetailsFromRow(event, leadId) {
    if (isAdminTableInteractiveTarget(event)) return;
    openAdminLeadDetailsModal(event, leadId);
}

async function openAdminLeadDetailsModal(event, leadId) {
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }

    const modal = document.getElementById("adminLeadDetailsModal");
    const content = document.getElementById("adminLeadDetailsContent");
    const normalizedLeadId = Number(leadId || 0);

    if (!modal || !content || !normalizedLeadId) return;

    const cachedLead = getCachedAdminLeadById(normalizedLeadId);

    modal.classList.remove("hidden");
    modal.setAttribute("aria-hidden", "false");
    document.body.classList.add("modal-open");
    content.innerHTML = `<p class="no-data">Loading lead details...</p>`;

    try {
        const res = await fetch(`${BASE_URL}/api/leads/${normalizedLeadId}`, {
            cache: "no-store",
        });
        const result = await res.json();

        if (!res.ok || !result.success || !result.data) {
            throw new Error(result.message || "Unable to load lead details");
        }

        content.innerHTML = renderAdminLeadDetails(result.data);
    } catch (err) {
        console.error("Admin lead details load error:", err);
        if (cachedLead) {
            content.innerHTML = renderAdminLeadDetails(cachedLead);
            return;
        }

        content.innerHTML = `
            <p class="no-data">${escapeAdminHtml(err.message || "Unable to load lead details")}</p>
        `;
    }
}

function closeAdminLeadDetailsModal() {
    document.activeElement?.blur();
    const modal = document.getElementById("adminLeadDetailsModal");
    if (!modal) return;

    modal.classList.add("hidden");
    modal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("modal-open");
}

function handleAdminLeadDetailsBackdrop(event) {
    if (event.target?.id === "adminLeadDetailsModal") {
        closeAdminLeadDetailsModal();
    }
}

async function loadAppointments() {
    try {
        const res = await fetch(
            getAdminPanelScopedApiUrl("/api/appointments?role=admin"),
            { cache: "no-store" },
        );
        const data = await res.json();

        const table = document.getElementById('appointmentsTable');
        if (!table) return;
        table.innerHTML = '';

        const appointments = filterAdminRowsByCompanyScope(
            data.success && Array.isArray(data.data) ? data.data : [],
        );
        adminAppointmentsRows = appointments;
        adminDashboardCache.appointments = appointments;
        adminDashboardState.appointments = appointments;
        // renderAdminDashboard();

        const monthFilter = document.getElementById("adminAppointmentsMonthFilter")?.value || "";
        let filteredAppointments = appointments;
        if (monthFilter) {
            filteredAppointments = appointments.filter(item => isAdminDateInMonth(item.app_date || item.created_at || item.created_date, monthFilter));
        }

        if (!filteredAppointments.length) {
            table.innerHTML = `<tr><td colspan="6">No appointments found</td></tr>`;
            return;
        }

        appointments.forEach(item => {
            const status = getAdminAppointmentStatus(item);
            const leadId = Number(item.id || 0);
            table.innerHTML += `
                <tr
                    class="admin-clickable-info-row admin-clickable-appointment-row"
                    onclick="openAdminLeadDetailsFromRow(event, ${leadId})"
                    title="Click to view full appointment details"
                >
                    <td>${escapeAdminHtml(item.company_name || '-')}</td>
                    <td>${escapeAdminHtml(item.client_name || '-')}</td>
                    <td>${escapeAdminHtml(formatDate(item.app_date))}</td>
                    <td>${escapeAdminHtml(formatAdminAppointmentTime(item.app_time))}</td>
                    <td>${escapeAdminHtml(item.assign_emp || '-')}</td>
                    <td>
                        <span class="admin-appointment-status ${status.className}">
                            ${escapeAdminHtml(status.label)}
                        </span>
                    </td>
                </tr>
            `;
        });

        filterTable('appointmentsTable', 'appointmentsSearch');
    } catch (err) {
        console.error("Appointments Error:", err);
        adminAppointmentsRows = [];
    }
}

async function loadFollowups() {
    try {
        const res = await fetch(
            getAdminPanelScopedApiUrl("/api/followups?role=admin"),
            { cache: "no-store" },
        );
        const data = await res.json();

        const table = document.getElementById('followupsTable');
        if (!table) return;
        table.innerHTML = '';

        const followups = filterAdminRowsByCompanyScope(
            data.success && Array.isArray(data.data) ? data.data : [],
        );
        adminDashboardCache.followups = followups;
        adminDashboardState.followups = followups;
        renderAdminDashboard();

        const monthFilter = document.getElementById("adminFollowupsMonthFilter")?.value || "";
        let filteredFollowups = followups;
        if (monthFilter) {
            filteredFollowups = followups.filter(item => isAdminDateInMonth(item.follow_date || item.created_at || item.created_date, monthFilter));
        }

        if (!filteredFollowups.length) {
            table.innerHTML = `<tr><td colspan="6">No followups found</td></tr>`;
            return;
        }

        filteredFollowups.forEach(item => {
            const leadId = Number(item.id || 0);
            table.innerHTML += `
                <tr
                    class="admin-clickable-info-row admin-clickable-followup-row"
                    onclick="openAdminLeadDetailsFromRow(event, ${leadId})"
                    title="Click to view full follow up details"
                >
                    <td>${escapeAdminHtml(item.company_name || '-')}</td>
                    <td>${escapeAdminHtml(item.client_name || '-')}</td>
                    <td>${escapeAdminHtml(formatDate(item.follow_date))}</td>
                    <td>${escapeAdminHtml(formatAdminAppointmentTime(item.follow_time))}</td>
                    <td>${item.assign_emp || '-'}</td>  <!-- 🔥 EMPLOYEE NAME -->
                    <td>${escapeAdminHtml(item.reason || '-')}</td>
                </tr>
            `;
        });

        filterTable('followupsTable', 'followupsSearch');

    } catch (err) {
        console.error("Followups Error:", err);
    }
}

function normalizeAdminDealPayStatus(value) {
    const status = String(value || "")
        .toLowerCase()
        .trim();
    return ["pending", "received", "failed"].includes(status) ? status : "pending";
}

function getAdminDealAmount(item = {}) {
    const dealAmount = Number(item.deal_amount || 0);
    if (Number.isFinite(dealAmount) && dealAmount > 0) return dealAmount;

    const productsTotal = Number(item.deal_products_total || 0);
    return Number.isFinite(productsTotal) && productsTotal > 0 ? productsTotal : 0;
}

function hasAdminStoredAmount(value) {
    return value !== undefined && value !== null && String(value).trim() !== "";
}

function getAdminDealReceivedAmount(item = {}) {
    const explicitValues = [
        item.received_amount,
        item.amount_received,
        item.payment_amount,
        item.received_total,
    ];
    const explicitValue = explicitValues.find(hasAdminStoredAmount);
    const explicitAmount = Number(explicitValue || 0);

    if (explicitValue !== undefined && Number.isFinite(explicitAmount)) {
        return explicitAmount;
    }

    return normalizeAdminDealPayStatus(item.pay_stat) === "received"
        ? getAdminDealAmount(item)
        : 0;
}

function getAdminDealRemainingAmount(item = {}) {
    if (hasAdminStoredAmount(item.remaining_amount)) {
        return Number(item.remaining_amount || 0);
    }

    return Math.max(getAdminDealAmount(item) - getAdminDealReceivedAmount(item), 0);
}

function getAdminInclusiveGstAmount(amount) {
    const numericAmount = Number(amount || 0);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) return 0;
    return (numericAmount * 18) / 118;
}

function roundAdminPaymentAmount(value) {
    const amount = Number(String(value ?? "").replace(/,/g, ""));
    if (!Number.isFinite(amount)) return 0;
    return Math.round((amount + Number.EPSILON) * 100) / 100;
}

function getAdminPaymentGstBreakup(amount) {
    const grossAmount = roundAdminPaymentAmount(amount);
    if (grossAmount <= 0) {
        return {
            amountWithoutGst: 0,
            gstAmount: 0,
        };
    }

    const amountWithoutGst = roundAdminPaymentAmount(grossAmount / 1.18);
    return {
        amountWithoutGst,
        gstAmount: roundAdminPaymentAmount(Math.max(grossAmount - amountWithoutGst, 0)),
    };
}

function formatAdminPaymentMoney(value) {
    const amount = roundAdminPaymentAmount(value);
    return `Rs. ${amount.toLocaleString("en-IN", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })}`;
}

function formatAdminDealServices(item = {}) {
    const products = String(item.deal_services || "")
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean);

    if (products.length) return products.join(", ");

    const serviceList = formatAdminLeadDetailsList(item.services);
    return serviceList === "-" ? "-" : serviceList;
}

function formatAdminDealMode(item = {}) {
    const directMode =
        item.billing_mode ||
        item.deal_mode ||
        item.service_mode ||
        item.mode;
    if (directMode) return formatAdminLeadHumanLabel(directMode);

    return item.sales_type ? formatAdminLeadHumanLabel(item.sales_type) : "-";
}

function getAdminDealSalesTypeValue(item = {}) {
    const raw = String(item.sales_type || item.salesType || "")
        .toLowerCase()
        .trim();

    return raw === "renewal" ? "renewal" : "fresh";
}

function adminDealMatchesTypeFilter(item = {}, selectedType = "all") {
    if (!selectedType || selectedType === "all") return true;
    return getAdminDealSalesTypeValue(item) === selectedType;
}

function escapeAdminInlineJsString(value) {
    return String(value ?? "")
        .replace(/\\/g, "\\\\")
        .replace(/'/g, "\\'")
        .replace(/\r?\n/g, " ");
}

function openAdminDealDetailsFromRow(event, leadId) {
    if (isAdminTableInteractiveTarget(event)) return;

    openAdminLeadDetailsModal(event, leadId);
}


async function loadDeals() {
    const url = new URL(
        getAdminPanelScopedApiUrl("/api/deals?role=admin"),
    );
    url.searchParams.set("_", Date.now().toString());
    const res = await fetch(url.toString(), { cache: "no-store" });
    const data = await res.json();

    const table = document.getElementById('dealsTable');
    if (!table) return;
    table.innerHTML = '';

    const rawDeals = data.success && Array.isArray(data.data) ? data.data : [];
    const selectedCompanyScope = getAdminCompanyFilterScope("adminDealsCompanyFilter");
    const selectedDealType = document.getElementById("adminDealsTypeFilter")?.value || "all";
    const selectedMonth = document.getElementById("adminDealsMonthFilter")?.value;

    let deals = rawDeals.filter((deal) =>
        adminDealMatchesCompanyFilter(deal, selectedCompanyScope) &&
        adminDealMatchesTypeFilter(deal, selectedDealType),
    );

    if (selectedMonth) {
        deals = deals.filter((deal) => {
            const dStr = deal.payment_date || deal.closed_date || deal.created_at;
            if (!dStr) return false;
            const date = new Date(dStr);
            if (isNaN(date.getTime())) return false;
            const yyyy = date.getFullYear();
            const mm = String(date.getMonth() + 1).padStart(2, '0');
            return `${yyyy}-${mm}` === selectedMonth;
        });
    }

    adminDashboardCache.deals = deals;
    adminDashboardState.deals = deals;
        renderAdminDashboard();

        const monthFilter = document.getElementById("adminDealsMonthFilter")?.value || "";
        let filteredDeals = deals;
        if (monthFilter) {
            filteredDeals = deals.filter(item => isAdminDateInMonth(item.closed_date || item.created_at || item.created_date, monthFilter));
        }

        if (!filteredDeals.length) {
        table.innerHTML = `<tr><td colspan="17">${escapeAdminHtml(getAdminCompanyFilterEmptyText('adminDealsCompanyFilter', 'deals'))}</td></tr>`;
        return;
    }

    // Calculate counts
    let pendingCount = 0, receivedCount = 0, failedCount = 0;

    filteredDeals.forEach(item => {
        const payStatus = normalizeAdminDealPayStatus(item.pay_stat);
        if (payStatus === 'pending') pendingCount++;
        else if (payStatus === 'received') receivedCount++;
        else if (payStatus === 'failed') failedCount++;

        const dealAmount = getAdminDealAmount(item);
        const dealGst = hasAdminStoredAmount(item.gst_amount)
            ? Number(item.gst_amount || 0)
            : getAdminInclusiveGstAmount(dealAmount);
        const receivedTotal = getAdminDealReceivedAmount(item);
        const receivedGst = getAdminInclusiveGstAmount(receivedTotal);
        const receivedBase = Math.max(receivedTotal - receivedGst, 0);
        const balanceAmount = getAdminDealRemainingAmount(item);
        const dealId = Number(item.id || 0);
        const contactArg = escapeAdminHtml(escapeAdminInlineJsString(item.contact || ''));
        const emailArg = escapeAdminHtml(escapeAdminInlineJsString(item.email || ''));
        const paymentAction = `
              <button
                  type="button"
                  class="admin-deal-payment-btn"
                  onclick="openAdminDealPaymentsModal(event, ${dealId})"
                  title="View and add installment payments"
              >
                  <i class="fas fa-receipt"></i> Payments
              </button>
          `;

        table.innerHTML += `
            <tr
                class="admin-clickable-deal-row"
                style="cursor: pointer;"
                onclick="openAdminDealDetailsFromRow(event, ${dealId})"
                title="Click to view full lead details"
            >
                <td><strong>${escapeAdminHtml(item.company_name || '-')}</strong></td>
                <td>${escapeAdminHtml(item.client_name || '-')}</td>
                <td class="admin-deal-money-cell">${escapeAdminHtml(formatCompactMoney(dealAmount))}</td>
                <td class="admin-deal-money-cell">${escapeAdminHtml(formatCompactMoney(dealGst))}</td>
                <td class="admin-deal-money-cell">${escapeAdminHtml(formatCompactMoney(receivedBase))}</td>
                <td class="admin-deal-money-cell">${escapeAdminHtml(formatCompactMoney(receivedGst))}</td>
                <td class="admin-deal-service-cell">${escapeAdminHtml(formatAdminDealServices(item))}</td>
                <td>${escapeAdminHtml(formatAdminDealMode(item))}</td>
                <td class="admin-deal-money-cell">${escapeAdminHtml(formatCompactMoney(receivedTotal))}</td>
                <td>${escapeAdminHtml(item.payment_method || '-')}</td>
                <td>${escapeAdminHtml(formatDate(item.payment_date || item.closed_date))}</td>
                <td>${escapeAdminHtml(item.me_name || item.assign_emp || '-')}</td>
                <td>${escapeAdminHtml(item.tme_name || '-')}</td>
                <td class="admin-deal-money-cell">${escapeAdminHtml(formatCompactMoney(balanceAmount))}</td>
                <td>${paymentAction}</td>
                  <td>
                      <button
                          type="button"
                          class="admin-deal-payment-btn"
                          onclick="event.stopPropagation(); openAdminDealAckViewModal(${dealId})"
                          title="View Acknowledgment Proforma"
                      >
                          <i class="fas fa-file-invoice"></i> Ack
                      </button>
                  </td>
                  <td>${escapeAdminHtml(item.closed_by_name || item.received_by || '-')}</td>
                <td>
                    <button
                        type="button"
                        class="admin-edit-deal-btn"
                        onclick="openAdminEditDealModal(event, ${dealId})"
                        title="Edit this deal"
                    >
                        <i class="fas fa-edit"></i> Edit
                    </button>
                </td>
            </tr>
        `;
    });

    const total = pendingCount + receivedCount + failedCount;

    const pendingPercent = total ? (pendingCount / total) * 100 : 0;
    const receivedPercent = total ? (receivedCount / total) * 100 : 0;
    const failedPercent = total ? (failedCount / total) * 100 : 0;

    // document.getElementById('pendingBar').style.width = pendingPercent + '%';
    // document.getElementById('receivedBar').style.width = receivedPercent + '%';
    // document.getElementById('failedBar').style.width = failedPercent + '%';

    // document.getElementById('pendingLabel').textContent = `Pending: ${pendingCount}`;
    // document.getElementById('receivedLabel').textContent = `Received: ${receivedCount}`;
    // document.getElementById('failedLabel').textContent = `Failed: ${failedCount}`;

    filterTable('dealsTable', 'dealsSearch');

}

function formatAdminRenewalDate(value) {
    const rawValue = String(value || "").trim();
    if (!rawValue) return "-";

    const datePart = rawValue.slice(0, 10);
    const match = datePart.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return rawValue;

    const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    return Number.isNaN(date.getTime())
        ? rawValue
        : date.toLocaleDateString("en-IN", {
            day: "2-digit",
            month: "short",
            year: "numeric",
        });
}

function formatAdminRenewalDays(value) {
    const days = Number(value);
    if (!Number.isFinite(days)) return "-";
    if (days < 0) return `${Math.abs(days)} overdue`;
    if (days === 0) return "Today";
    if (days === 1) return "1 day";
    return `${days} days`;
}

function getAdminRenewalStatusMeta(item = {}) {
    const isConfigured = Number(item.is_configured || item.renewal_id || item.id || 0) > 0;
    const daysLeft = Number(item.days_left);
    const status = String(item.status || "").toLowerCase();

    if (!isConfigured) {
        return { className: "upcoming", label: "Not Set" };
    }

    if (status === "stopped") {
        return { className: "stopped", label: "Stopped" };
    }

    if (Number.isFinite(daysLeft) && daysLeft === 0) {
        return { className: "due-today", label: "Due Today" };
    }

    if (Number.isFinite(daysLeft) && daysLeft > 0 && daysLeft <= 2) {
        return { className: "due-soon", label: "Due Soon" };
    }

    return { className: "started", label: "Active" };
}

function renderAdminRenewalSummary(summary = {}) {
    setAdminDashboardText("adminRenewalTotal", String(Number(summary.total || 0)));
    setAdminDashboardText("adminRenewalOverdue", String(Number(summary.stopped || 0)));
    setAdminDashboardText("adminRenewalDueSoon", String(Number(summary.notifySoon || summary.dueSoon || 0)));
    setAdminDashboardText("adminRenewalStarted", String(Number(summary.active || 0)));
    updateAdminRenewalBadge(summary.notifySoon || summary.dueSoon || 0);
}

function updateAdminRenewalBadge(count = 0) {
    const badge = document.getElementById("adminRenewalsBadge");
    const navItem = document.getElementById("adminRenewalsNavItem");
    const dueCount = Math.max(Number(count) || 0, 0);
    if (!badge) return;
    badge.textContent = dueCount > 99 ? "99+" : String(dueCount);
    badge.classList.toggle("hidden", dueCount === 0);
    navItem?.classList.toggle("has-notification-badge", dueCount > 0);
}

function renderAdminRenewalBasisOptions(item = {}) {
    const basis = String(item.renewal_basis || "monthly");
    const websiteOnly = Number(item.website_yearly_only || 0) > 0;
    const options = websiteOnly
        ? [["yearly", "Yearly"]]
        : [
            ["monthly", "Monthly"],
            ["quarterly", "Quarterly"],
            ["half_yearly", "Half Yearly"],
            ["yearly", "Full Yearly"],
        ];

    return options
        .map(([value, label]) => `<option value="${value}" ${basis === value ? "selected" : ""}>${label}</option>`)
        .join("");
}

function getAdminRenewalRowKey(item = {}) {
    return `${Number(item.lead_id || 0)}-${String(item.service_name || "").replace(/[^a-z0-9]+/gi, "_")}`;
}

function renderAdminRenewalRows(renewals = []) {
    const table = document.getElementById("renewalsTable");
    if (!table) return;

    if (!renewals.length) {
        table.innerHTML = `<tr><td colspan="14">No renewal records found</td></tr>`;
        return;
    }

    table.innerHTML = renewals
        .map((item) => {
            const status = getAdminRenewalStatusMeta(item);
            const contact = item.contact || "-";
            const email = item.client_email || item.email || "-";
            const owner = item.owner_name || item.assign_emp || "-";
            const rowKey = getAdminRenewalRowKey(item);
            const isConfigured = Number(item.is_configured || item.renewal_id || 0) > 0;
            const renewalId = Number(item.renewal_id || item.id || 0);
            const isStopped = String(item.status || "").toLowerCase() === "stopped";
            const startValue = item.first_start_date || item.history_start_date || item.renewal_due_date || "";
            const stopButton = isConfigured && !isStopped
                ? `<button type="button" class="renewal-stop-btn" onclick="stopAdminRenewal(${renewalId})">Stop</button>`
                : "";

            return `
                <tr>
                    <td>${escapeAdminHtml(item.company_name || "-")}</td>
                    <td>${escapeAdminHtml(item.client_name || "-")}</td>
                    <td>${escapeAdminHtml(item.service_name || "-")}</td>
                    <td>${escapeAdminHtml(contact)}</td>
                    <td>${escapeAdminHtml(email)}</td>
                    <td>${escapeAdminHtml(formatCompactMoney(item.deal_amount || 0))}</td>
                    <td>${escapeAdminHtml(formatAdminRenewalDate(item.closed_date))}</td>
                    <td>
                        <select id="adminRenewalBasis_${rowKey}" class="renewal-inline-control" ${Number(item.website_yearly_only || 0) > 0 ? "disabled" : ""}>
                            ${renderAdminRenewalBasisOptions(item)}
                        </select>
                    </td>
                    <td>
                        <input id="adminRenewalStart_${rowKey}" class="renewal-inline-control" type="date" value="${escapeAdminHtml(startValue)}" />
                    </td>
                    <td>${escapeAdminHtml(formatAdminRenewalDate(item.renewal_due_date))}</td>
                    <td>${escapeAdminHtml(formatAdminRenewalDays(item.days_left))}</td>
                    <td><span class="renewal-status ${status.className}">${escapeAdminHtml(status.label)}</span></td>
                    <td>${escapeAdminHtml(owner)}</td>
                    <td>
                        <div class="renewal-action-stack">
                            <button type="button" class="renewal-save-btn" onclick="saveAdminRenewal(${Number(item.lead_id || 0)}, '${escapeAdminHtml(escapeAdminInlineJsString(item.service_name || ""))}', '${rowKey}')">Save</button>
                            ${stopButton}
                        </div>
                    </td>
                </tr>
            `;
        })
        .join("");
}

async function loadAdminRenewals(forceRefresh = false) {
    const table = document.getElementById("renewalsTable");
    if (!table) return;

    if (forceRefresh || !adminDashboardCache.renewals.length) {
        table.innerHTML = `<tr><td colspan="14">Loading renewals...</td></tr>`;
    }

    try {
        const params = new URLSearchParams({
            status: document.getElementById("adminRenewalsStatus")?.value || "all",
        });
        const selectedMonth = document.getElementById("adminRenewalsMonth")?.value || "";
        if (selectedMonth) params.set("month", selectedMonth);
        params.set("companyScope", getAdminPanelCompanyScope());

        if (currentUser?.id) {
            params.set("adminId", currentUser.id);
        }

        const response = await fetch(`${BASE_URL}/api/admin/renewals?${params.toString()}`, {
            cache: "no-store",
        });
        const result = await parseAdminApiResponse(response, "Renewals");

        if (!response.ok || !result.success) {
            throw new Error(result.message || "Failed to load renewal details");
        }

        const renewals = filterAdminRowsByCompanyScope(result.data);
        adminDashboardCache.renewals = renewals;
        adminDashboardState.renewals = renewals;
        renderAdminRenewalSummary(result.summary || {});
        renderAdminRenewalRows(renewals);
    } catch (err) {
        console.error("Admin renewals error:", err);
        renderAdminRenewalSummary({});
        table.innerHTML = `<tr><td colspan="14">${escapeAdminHtml(err.message || "Unable to load renewals")}</td></tr>`;
    }
}

async function saveAdminRenewal(leadId, serviceName, rowKey) {
    const startDate = document.getElementById(`adminRenewalStart_${rowKey}`)?.value || "";
    const basisSelect = document.getElementById(`adminRenewalBasis_${rowKey}`);
    const basis = basisSelect?.value || "yearly";

    if (!leadId || !serviceName || !startDate) {
        showPopup("Renewal", "Please select renewal start date.", false);
        return;
    }

    try {
        const response = await fetch(`${BASE_URL}/api/service-renewals`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                leadId,
                serviceName,
                startDate,
                basis,
                userId: currentUser?.id || null,
            }),
        });
        const result = await parseAdminApiResponse(response, "Save renewal");
        if (!response.ok || !result.success) throw new Error(result.message || "Failed to save renewal");
        showPopup("Renewal", "Renewal schedule saved.", true);
        await loadAdminRenewals(true);
    } catch (err) {
        showPopup("Renewal", err.message || "Unable to save renewal.", false);
    }
}

async function stopAdminRenewal(renewalId) {
    if (!renewalId) return;
    try {
        const response = await fetch(`${BASE_URL}/api/service-renewals/${renewalId}/stop`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userId: currentUser?.id || null }),
        });
        const result = await parseAdminApiResponse(response, "Stop renewal");
        if (!response.ok || !result.success) throw new Error(result.message || "Failed to stop renewal");
        showPopup("Renewal", "Renewal stopped.", true);
        await loadAdminRenewals(true);
    } catch (err) {
        showPopup("Renewal", err.message || "Unable to stop renewal.", false);
    }
}

async function loadDownsaleNotifications() {
    const table = document.getElementById("downsaleRequestsTable");
    if (!table) return;

    try {
        table.innerHTML = `<tr><td colspan="9">Loading notifications...</td></tr>`;
        const params = new URLSearchParams({
            companyScope: getAdminPanelCompanyScope(),
        });
        const res = await fetch(`${BASE_URL}/api/downsale-requests?${params.toString()}`, {
            cache: "no-store",
        });
        const contentType = res.headers.get("content-type") || "";

        if (!contentType.includes("application/json")) {
            table.innerHTML = `<tr><td colspan="9">Server restart required for downsale notifications</td></tr>`;
            return;
        }

        const data = await res.json();
        const requests = filterAdminRowsByCompanyScope(
            data.success && Array.isArray(data.data) ? data.data : [],
        );
        adminDashboardCache.notifications = requests;
        updateDownsaleNotificationBadge(getPendingDownsaleRequestCount(requests));

        if (!requests.length) {
            table.innerHTML = `<tr><td colspan="9">No downsale requests found</td></tr>`;
            return;
        }

        table.innerHTML = requests.map((request) => {
            const normalizedStatus = String(request.status || "pending").toLowerCase();
            const isPending = normalizedStatus === "pending";
            const statusClass = `downsale-status ${normalizedStatus}`;
            const actions = isPending
                ? `
                    <div class="downsale-actions">
                        <button type="button" class="approval-btn approve" onclick="reviewDownsaleRequest(${request.id}, 'approved')">Accept</button>
                        <button type="button" class="approval-btn reject" onclick="reviewDownsaleRequest(${request.id}, 'rejected')">Reject</button>
                    </div>
                `
                : `<span>${request.reviewed_by_name || "-"}</span>`;

            return `
                <tr>
                    <td>${request.company_name || "-"}</td>
                    <td>${request.client_name || "-"}</td>
                    <td>${request.product_name || "-"}</td>
                    <td>${formatCurrency(request.standard_amount || 0)}</td>
                    <td>${formatCurrency(request.requested_amount || 0)}</td>
                    <td>${request.requested_by_name || "-"}</td>
                    <td>${request.reason || "-"}</td>
                    <td><span class="${statusClass}">${normalizedStatus}</span></td>
                    <td>${actions}</td>
                </tr>
            `;
        }).join("");
    } catch (err) {
        console.error("Downsale notifications error:", err);
        table.innerHTML = `<tr><td colspan="9">Error loading downsale requests</td></tr>`;
        refreshDownsaleNotificationBadge();
    }
}

async function reviewDownsaleRequest(id, status) {
    try {
        const res = await fetch(`${BASE_URL}/api/downsale-requests/${id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                status,
                reviewedBy: currentUser?.id,
            }),
        });
        const contentType = res.headers.get("content-type") || "";

        if (!contentType.includes("application/json")) {
            throw new Error("Server restart required for downsale approval");
        }

        const data = await res.json();

        if (!res.ok || !data.success) {
            throw new Error(data.message || "Failed to update downsale request");
        }

        showPopup("Updated", data.message || "Downsale request updated", true);
        await loadDownsaleNotifications();
    } catch (err) {
        console.error("Review downsale error:", err);
        showPopup("Error", err.message || "Failed to update downsale request", false);
    }
}

function getAdminInvoiceUrl(path, id, paymentId = 0, instAmt = 0) {
    const url = new URL(`${BASE_URL}/api/${path}/${id}`);
    if (paymentId) url.searchParams.set("paymentId", String(paymentId));
    if (instAmt) url.searchParams.set("instAmt", String(instAmt));
    return url.toString();
}

function downloadTaxInvoice(id, paymentId = 0, instAmt = 0) {
    window.open(getAdminInvoiceUrl("tax-invoice", id, paymentId, instAmt), '_blank');
}

function downloadProformaInvoice(id, paymentId = 0, instAmt = 0) {
    window.open(getAdminInvoiceUrl("invoice", id, paymentId, instAmt), '_blank');
}

let currentAdminDealPaymentsLeadId = null;
let currentAdminDealPaymentsData = null;

function handleAdminDealPaymentsBackdrop(event) {
    if (event.target?.id === "adminDealPaymentsModal") {
        closeAdminDealPaymentsModal();
    }
}

function closeAdminDealPaymentsModal() {
    document.activeElement?.blur();
    document.getElementById("adminDealPaymentsModal")?.classList.add("hidden");
    currentAdminDealPaymentsLeadId = null;
    currentAdminDealPaymentsData = null;
}

function setAdminDealPaymentDefaultDate() {
    const dateInput = document.getElementById("adminDealPaymentDate");
    if (dateInput && !dateInput.value) {
        dateInput.value = new Date().toISOString().slice(0, 10);
    }
    updateAdminDealPaymentBreakupPreview();
}

function updateAdminDealPaymentBreakupPreview() {
    const amountInput = document.getElementById("adminDealPaymentAmount");
    const withoutGstInput = document.getElementById("adminDealPaymentWithoutGst");
    const gstInput = document.getElementById("adminDealPaymentGstAmount");
    if (!withoutGstInput && !gstInput) return;

    const rawAmount = String(amountInput?.value || "").trim();
    const breakup = getAdminPaymentGstBreakup(rawAmount);
    const hasAmount = rawAmount !== "" && roundAdminPaymentAmount(rawAmount) > 0;

    if (withoutGstInput) {
        withoutGstInput.value = hasAmount ? formatAdminPaymentMoney(breakup.amountWithoutGst) : "";
    }

    if (gstInput) {
        gstInput.value = hasAmount ? formatAdminPaymentMoney(breakup.gstAmount) : "";
    }
}

function getAdminDealPaymentRenewalOptions() {
    const rawOptions =
        currentAdminDealPaymentsData?.renewalOptions ||
        currentAdminDealPaymentsData?.renewal_options ||
        [];
    return Array.isArray(rawOptions)
        ? rawOptions.filter((option) => Number(option.renewal_id || option.id || 0) > 0)
        : [];
}

function findAdminDealPaymentRenewalOption(renewalId) {
    const normalizedId = Number(renewalId || 0);
    return getAdminDealPaymentRenewalOptions().find(
        (option) => Number(option.renewal_id || option.id || 0) === normalizedId,
    ) || null;
}

function renderAdminDealPaymentRenewalOptions() {
    const select = document.getElementById("adminDealRenewalPaymentService");
    if (!select) return;

    const previousValue = select.value;
    const options = getAdminDealPaymentRenewalOptions();
    select.innerHTML = "";

    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = options.length
        ? "Select renewal service"
        : "No renewal services configured";
    select.appendChild(placeholder);

    options.forEach((option) => {
        const renewalId = Number(option.renewal_id || option.id || 0);
        const amount = roundAdminPaymentAmount(option.service_amount || option.amount || 0);
        const dueDate = option.renewal_due_date
            ? ` | Due ${formatDate(option.renewal_due_date)}`
            : "";
        const optionEl = document.createElement("option");
        optionEl.value = String(renewalId);
        optionEl.textContent = `${option.service_name || "Service"} | ${formatCompactMoney(amount)}${dueDate}`;
        select.appendChild(optionEl);
    });

    if (
        previousValue &&
        options.some((option) => String(option.renewal_id || option.id || 0) === previousValue)
    ) {
        select.value = previousValue;
    } else if (options.length) {
        select.value = String(options[0].renewal_id || options[0].id || "");
    }
}

function handleAdminDealRenewalPaymentServiceChange() {
    const select = document.getElementById("adminDealRenewalPaymentService");
    const amountInput = document.getElementById("adminDealPaymentAmount");
    const cycleInput = document.getElementById("adminDealRenewalCycleDate");
    const amountPreview = document.getElementById("adminDealRenewalAmountPreview");
    const selectedOption = findAdminDealPaymentRenewalOption(select?.value);

    if (!selectedOption) {
        if (amountInput) amountInput.value = "";
        if (cycleInput) cycleInput.value = "";
        if (amountPreview) amountPreview.value = "";
        updateAdminDealPaymentBreakupPreview();
        return;
    }

    const renewalAmount = roundAdminPaymentAmount(
        selectedOption.service_amount || selectedOption.amount || 0,
    );
    if (amountInput) {
        amountInput.value = renewalAmount > 0 ? renewalAmount.toFixed(2) : "";
        amountInput.readOnly = true;
        amountInput.removeAttribute("max");
        amountInput.placeholder = "Auto from renewal service";
    }
    if (cycleInput) {
        cycleInput.value = selectedOption.renewal_due_date || cycleInput.value || new Date().toISOString().slice(0, 10);
    }
    if (amountPreview) {
        amountPreview.value = renewalAmount > 0
            ? formatCompactMoney(renewalAmount)
            : "Amount missing";
    }
    updateAdminDealPaymentBreakupPreview();
}

function handleAdminDealPaymentTypeChange() {
    const typeSelect = document.getElementById("adminDealPaymentType");
    const renewalRow = document.getElementById("adminDealRenewalPaymentRow");
    const renewalSelect = document.getElementById("adminDealRenewalPaymentService");
    const cycleInput = document.getElementById("adminDealRenewalCycleDate");
    const amountInput = document.getElementById("adminDealPaymentAmount");
    const amountPreview = document.getElementById("adminDealRenewalAmountPreview");
    const summary = currentAdminDealPaymentsData?.summary || {};
    const isRenewal = typeSelect?.value === "renewal";

    renewalRow?.classList.toggle("hidden", !isRenewal);
    if (renewalSelect) renewalSelect.required = isRenewal;
    if (cycleInput) cycleInput.required = isRenewal;

    if (isRenewal) {
        renderAdminDealPaymentRenewalOptions();
        if (amountInput) {
            amountInput.readOnly = true;
            amountInput.removeAttribute("max");
            amountInput.placeholder = "Auto from renewal service";
        }
        handleAdminDealRenewalPaymentServiceChange();
        return;
    }

    if (amountInput) {
        amountInput.readOnly = false;
        amountInput.value = "";
        amountInput.max = String(Math.max(Number(summary.remainingAmount || 0), 0));
        amountInput.placeholder = summary.remainingAmount
            ? `Max ${formatCompactMoney(summary.remainingAmount)}`
            : "Fully paid";
    }
    if (amountPreview) amountPreview.value = "";
    if (renewalSelect) renewalSelect.value = "";
    if (cycleInput) cycleInput.value = "";
    updateAdminDealPaymentBreakupPreview();
}

async function openAdminDealPaymentsModal(event, leadId) {
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }

    currentAdminDealPaymentsLeadId = Number(leadId || 0);
    const modal = document.getElementById("adminDealPaymentsModal");
    if (!modal || !currentAdminDealPaymentsLeadId) return;

    modal.classList.remove("hidden");
    document.getElementById("adminDealPaymentLeadId").value = String(currentAdminDealPaymentsLeadId);
    document.getElementById("adminDealPaymentForm")?.reset();
    setAdminDealPaymentDefaultDate();
    handleAdminDealPaymentTypeChange();
    await loadAdminDealPayments(currentAdminDealPaymentsLeadId);
}

function renderAdminDealPaymentsSummary(result = {}) {
    const container = document.getElementById("adminDealPaymentsSummary");
    if (!container) return;

    const lead = result.lead || {};
    const summary = result.summary || {};
    document.getElementById("adminDealPaymentsModalTitle").textContent =
        `${lead.company_name || lead.client_name || "Deal"} Payments`;
    document.getElementById("adminDealPaymentsModalSubtitle").textContent =
        lead.part_payment_option
            ? `Schedule: ${lead.part_payment_option}`
            : "Manage installments and invoices.";

    container.innerHTML = `
        <div><span>Deal Amount</span><strong>${escapeAdminHtml(formatCompactMoney(summary.dealAmount || lead.deal_amount || 0))}</strong></div>
        <div><span>Received</span><strong>${escapeAdminHtml(formatCompactMoney(summary.receivedAmount || 0))}</strong></div>
        <div><span>Balance</span><strong>${escapeAdminHtml(formatCompactMoney(summary.remainingAmount || 0))}</strong></div>
    `;

    // Render Agreed Installment Schedule if present
    const scheduleContainer = document.getElementById("adminAgreedInstallmentScheduleContainer");
    const scheduleList = document.getElementById("adminAgreedInstallmentScheduleList");
    if (scheduleContainer && scheduleList) {
        let scheduleData = [];
        try {
            if (lead.part_payment_schedule) {
                scheduleData = typeof lead.part_payment_schedule === 'string'
                    ? JSON.parse(lead.part_payment_schedule)
                    : lead.part_payment_schedule;
            }
        } catch (e) {
            console.error("Error parsing part_payment_schedule:", e);
        }

        if (Array.isArray(scheduleData) && scheduleData.length > 0) {
            scheduleContainer.classList.remove("hidden");
            scheduleList.innerHTML = scheduleData.map((inst, index) => {
                const amt = inst.amount;
                const formattedAmt = formatCompactMoney(amt);
                const dateStr = formatDate(inst.dueDate);
                
                return `
                    <div style="background: #ffffff; padding: 8px 12px; border: 1px solid #e2e8f0; border-radius: 6px; display: flex; flex-direction: column; gap: 4px; box-shadow: 0 1px 2px rgba(0,0,0,0.05);">
                        <span style="font-size: 11px; font-weight: 600; color: #64748b; text-transform: uppercase;">Installment #${inst.installmentNo || (index + 1)}</span>
                        <strong style="font-size: 14px; color: #0f172a;">${escapeAdminHtml(formattedAmt)}</strong>
                        <span style="font-size: 12px; color: #475569; display: flex; align-items: center; gap: 4px;">
                            <i class="far fa-calendar-alt"></i> Due: ${escapeAdminHtml(dateStr)}
                        </span>
                    </div>
                `;
            }).join("");
        } else {
            scheduleContainer.classList.add("hidden");
            scheduleList.innerHTML = "";
        }
    }

    const amountInput = document.getElementById("adminDealPaymentAmount");
    const currentPaymentType = document.getElementById("adminDealPaymentType")?.value || "installment";
    if (amountInput && currentPaymentType !== "renewal") {
        amountInput.max = String(Math.max(Number(summary.remainingAmount || 0), 0));
        amountInput.placeholder = summary.remainingAmount
            ? `Max ${formatCompactMoney(summary.remainingAmount)}`
            : "Fully paid";
    }
    updateAdminDealPaymentBreakupPreview();
}

function renderAdminInvoiceRowPaymentStatusSelect(leadId, paymentId, payStatus) {
    const normalizedStatus = normalizeAdminDealPayStatus(payStatus);
    const normalizedLeadId = Number(leadId || 0);
    const normalizedPaymentId = Number(paymentId || 0);
    return `
        <select
            class="payment-status invoice-row-status ${normalizedStatus}"
            data-current-status="${normalizedStatus}"
            onchange="updateAdminInvoiceRowPaymentStatus(${normalizedLeadId}, ${normalizedPaymentId}, this.value, this)"
        >
            <option value="pending" ${normalizedStatus === "pending" ? "selected" : ""}>Pending</option>
            <option value="received" ${normalizedStatus === "received" ? "selected" : ""}>Received</option>
            <option value="failed" ${normalizedStatus === "failed" ? "selected" : ""}>Failed</option>
        </select>
    `;
}

function renderAdminScheduledInvoicesTable(payments = [], leadId = currentAdminDealPaymentsLeadId) {
    const container = document.getElementById("adminScheduledInvoicesContainer");
    if (!container) return;

    const deal = currentAdminDealPaymentsData?.deal || {};
    const lead = currentAdminDealPaymentsData?.lead || {};
    const contactArg = escapeAdminInlineJsString(lead.contact || deal.contact || "");
    const emailArg = escapeAdminInlineJsString(lead.email || deal.email || "");

    const summary = currentAdminDealPaymentsData?.summary || {};
    const leadPayStatus = normalizeAdminDealPayStatus(summary.payStatus || lead.pay_stat);
    const receivedPayments = payments.filter(
        (p) =>
            normalizeAdminDealPayStatus(p.payment_status) === "received" &&
            String(p.payment_type || "").toLowerCase() !== "renewal",
    );
    const receivedPartPaymentTotal = receivedPayments.reduce(
        (sum, p) => sum + Number(p.amount || 0),
        0,
    );

    // First/down payment comes from the original deal close payment, then added part payments follow it.
    const leadPaymentDate = lead.payment_date || lead.closed_date || "";
    const downPaymentAmount = Number(summary.downPaymentAmount || lead.down_payment_amount || 0) ||
        Math.max(Number(lead.received_amount || 0) - receivedPartPaymentTotal, 0);

    // Build combined list: down payment first, then part payments
    let invoiceRows = [];

    // Add the down payment from lead data if payment exists.
    if (downPaymentAmount > 0 && leadPaymentDate) {
        invoiceRows.push({
            label: "Down Payment",
            amount: downPaymentAmount,
            paymentDate: leadPaymentDate,
            paymentId: 0,
            instAmt: 0,
            isDownPayment: true,
            status: leadPayStatus
        });
    }

    // Add all part payments so each row can be marked pending/received/failed.
    payments.forEach((p, idx) => {
        const isRenewalPayment = String(p.payment_type || "").toLowerCase() === "renewal";
        invoiceRows.push({
            label: p.payment_label || (
                isRenewalPayment
                    ? `Renewal - ${p.renewal_service_name || "Service"}`
                    : ("Installment " + (p.sequence_no || (idx + 1)))
            ),
            amount: Number(p.amount || 0),
            paymentDate: p.payment_date || "",
            paymentId: Number(p.id || 0),
            instAmt: Number(p.amount || 0),
            isDownPayment: false,
            status: normalizeAdminDealPayStatus(p.payment_status)
        });
    });

    if (!invoiceRows.length) {
        container.innerHTML = '<div style="text-align: center; color: #94a3b8; padding: 16px 0; font-size: 13px;">' +
            '<i class="fas fa-file-invoice" style="font-size: 20px; margin-bottom: 6px; display: block;"></i>' +
            'Invoices will appear here after payments are recorded.' +
            '</div>';
        return;
    }

    var tableRows = invoiceRows.map(function(row) {
        var payDateFormatted = formatDate(row.paymentDate);
        var proformaDate = payDateFormatted;
        var taxInvoiceDate = payDateFormatted;

        var pId = row.paymentId;
        var iAmt = row.isDownPayment ? 0 : row.instAmt;
        var rowStatus = normalizeAdminDealPayStatus(row.status);
        var statusSelect = renderAdminInvoiceRowPaymentStatusSelect(leadId, pId, rowStatus);

        var proformaActions = '<div class="invoice-actions">' +
            '<button onclick="downloadProformaInvoice(' + leadId + ', ' + pId + ', ' + iAmt + ')" class="invoice-btn invoice-download" title="Download Proforma Invoice"><i class="fas fa-download"></i></button>' +
            '<button onclick="shareProformaInvoiceWhatsApp(' + leadId + ', \'' + contactArg + '\', ' + pId + ', ' + iAmt + ')" class="invoice-btn invoice-whatsapp" title="Share on WhatsApp"><i class="fab fa-whatsapp"></i></button>' +
            '<button onclick="shareProformaInvoiceGmail(\'' + emailArg + '\', ' + leadId + ', ' + pId + ', ' + iAmt + ')" class="invoice-btn invoice-gmail" title="Share via Gmail"><i class="fas fa-envelope"></i></button>' +
            
            '</div>';

        var taxActions = rowStatus === "received"
            ? '<div class="invoice-actions">' +
                '<button onclick="downloadTaxInvoice(' + leadId + ', ' + pId + ', ' + iAmt + ')" class="invoice-btn invoice-download" title="Download Tax Invoice"><i class="fas fa-download"></i></button>' +
                '<button onclick="shareTaxInvoiceWhatsApp(' + leadId + ', \'' + contactArg + '\', ' + pId + ', ' + iAmt + ')" class="invoice-btn invoice-whatsapp" title="Share on WhatsApp"><i class="fab fa-whatsapp"></i></button>' +
                '<button onclick="shareTaxInvoiceGmail(\'' + emailArg + '\', ' + leadId + ', ' + pId + ', ' + iAmt + ')" class="invoice-btn invoice-gmail" title="Share via Gmail"><i class="fas fa-envelope"></i></button>' +
                '</div>'
            : '<span class="invoice-pending">Mark Received to unlock</span>';

        return '<tr>' +
            '<td>' + escapeAdminHtml(row.label) + '</td>' +
            '<td>' + escapeAdminHtml(formatCompactMoney(row.amount)) + '</td>' +
            '<td>' + escapeAdminHtml(payDateFormatted) + '</td>' +
            '<td>' + escapeAdminHtml(proformaDate) + '</td>' +
            '<td>' + proformaActions + '</td>' +
            '<td>' + statusSelect + '</td>' +
            '<td>' + escapeAdminHtml(taxInvoiceDate) + '</td>' +
            '<td>' + taxActions + '</td>' +
            '</tr>';
    }).join("");

    container.innerHTML = '<h3 style="font-size: 14px; color: #1e293b; margin-bottom: 10px; font-weight: 600;">' +
        '<i class="fas fa-file-invoice" style="margin-right: 6px;"></i> Invoices for Payments</h3>' +
        '<div class="deal-payments-table-wrap"><table class="deal-payments-table"><thead><tr>' +
        '<th>Payment</th><th>Amount</th><th>Payment Date</th><th>Proforma Date</th><th>Proforma Invoice</th><th>Payment Status</th><th>Tax Invoice Date</th><th>Tax Invoice</th>' +
        '</tr></thead><tbody>' + tableRows + '</tbody></table></div>';
}

function renderAdminDealPaymentsTable(payments = [], leadId = currentAdminDealPaymentsLeadId) {
    const tbody = document.getElementById("adminDealPaymentsTableBody");
    if (!tbody) return;

    if (!payments.length) {
        tbody.innerHTML = `<tr><td colspan="10">No payment entries yet</td></tr>`;
        return;
    }

    const deal = currentAdminDealPaymentsData?.deal || {};
    const summary = currentAdminDealPaymentsData?.summary || {};
    const leadPayStatus = normalizeAdminDealPayStatus(summary.payStatus || deal.pay_stat);
    const contactArg = escapeAdminHtml(escapeAdminInlineJsString(deal.contact || ""));
    const emailArg = escapeAdminHtml(escapeAdminInlineJsString(deal.email || ""));

    tbody.innerHTML = payments.map((payment) => {
        const paymentId = Number(payment.id || 0);
        const status = normalizeAdminDealPayStatus(payment.payment_status);
        const isRenewalPayment = String(payment.payment_type || "").toLowerCase() === "renewal";
        const paymentLabel = payment.payment_label || (
            isRenewalPayment
                ? `Renewal - ${payment.renewal_service_name || "Service"}`
                : `Payment ${payment.sequence_no || ""}`
        );
        const fallbackBreakup = getAdminPaymentGstBreakup(payment.amount);
        const amountWithoutGst = hasAdminStoredAmount(payment.amount_without_gst)
            ? Number(payment.amount_without_gst || 0)
            : fallbackBreakup.amountWithoutGst;
        const gstAmount = hasAdminStoredAmount(payment.gst_amount)
            ? Number(payment.gst_amount || 0)
            : fallbackBreakup.gstAmount;
        const taxInvoice = status === "received" && (leadPayStatus === "received" || isRenewalPayment)
            ? `
                <div class="invoice-actions">
                    <button onclick="downloadTaxInvoice(${leadId}, ${paymentId})" class="invoice-btn invoice-download" title="Download Tax Invoice">
                        <i class="fas fa-download"></i>
                    </button>
                    <button onclick="shareTaxInvoiceWhatsApp(${leadId}, '${contactArg}', ${paymentId})" class="invoice-btn invoice-whatsapp" title="Share on WhatsApp">
                        <i class="fab fa-whatsapp"></i>
                    </button>
                    <button onclick="shareTaxInvoiceGmail('${emailArg}', ${leadId}, ${paymentId})" class="invoice-btn invoice-gmail" title="Share via Gmail">
                        <i class="fas fa-envelope"></i>
                    </button>
                </div>
            `
            : status === "received"
                ? `<span class="invoice-pending">Mark payment status Received</span>`
                : `<span class="invoice-pending">Pending</span>`;
        
        const proformaInvoice = status !== "failed"
            ? `
                <div class="invoice-actions">
                    <button onclick="downloadProformaInvoice(${leadId}, ${paymentId})" class="invoice-btn invoice-download" title="Download Proforma Invoice">
                        <i class="fas fa-download"></i>
                    </button>
                    <button onclick="shareProformaInvoiceWhatsApp(${leadId}, '${contactArg}', ${paymentId})" class="invoice-btn invoice-whatsapp" title="Share on WhatsApp">
                        <i class="fab fa-whatsapp"></i>
                    </button>
                    <button onclick="shareProformaInvoiceGmail('${emailArg}', ${leadId}, ${paymentId})" class="invoice-btn invoice-gmail" title="Share via Gmail">
                        <i class="fas fa-envelope"></i>
                    </button>
                </div>
            `
            : `<span class="invoice-pending">Pending</span>`;

        return `
            <tr>
                <td>
                    <div class="deal-payment-label">
                        <span>${escapeAdminHtml(paymentLabel)}</span>
                        ${isRenewalPayment ? `<small class="deal-payment-type renewal">Renewal</small>` : ""}
                    </div>
                </td>
                <td>${escapeAdminHtml(formatDate(payment.payment_date))}</td>
                <td>${escapeAdminHtml(formatCompactMoney(payment.amount))}</td>
                <td>${escapeAdminHtml(formatAdminPaymentMoney(amountWithoutGst))}</td>
                <td>${escapeAdminHtml(formatAdminPaymentMoney(gstAmount))}</td>
                <td>${escapeAdminHtml(payment.payment_method || "-")}</td>
                <td><span class="payment-status ${status}">${escapeAdminHtml(formatAdminLeadHumanLabel(status))}</span></td>
                <td>${escapeAdminHtml(payment.notes || "-")}</td>
                <td>${taxInvoice}</td>
                <td>${proformaInvoice}</td>
            </tr>
        `;
    }).join("");
}

async function loadAdminDealPayments(leadId = currentAdminDealPaymentsLeadId) {
    if (!leadId) return;
    const tbody = document.getElementById("adminDealPaymentsTableBody");
    if (tbody) tbody.innerHTML = `<tr><td colspan="10">Loading payments...</td></tr>`;

    try {
        const res = await fetch(`${BASE_URL}/api/deal-payments/${leadId}`, { cache: "no-store" });
        const result = await res.json();
        if (!res.ok || !result.success) {
            throw new Error(result.message || "Failed to load payments");
        }

        currentAdminDealPaymentsData = result;
        renderAdminDealPaymentsSummary(result);
        renderAdminDealPaymentRenewalOptions();
        handleAdminDealPaymentTypeChange();
        renderAdminDealPaymentsTable(result.data || [], leadId);
        renderAdminScheduledInvoicesTable(result.data || [], leadId);
    } catch (err) {
        console.error("Deal payments load error:", err);
        if (tbody) tbody.innerHTML = `<tr><td colspan="10">${escapeAdminHtml(err.message || "Failed to load payments")}</td></tr>`;
    }
}

async function handleAdminDealPaymentSubmit(event) {
    event.preventDefault();
    const leadId = Number(document.getElementById("adminDealPaymentLeadId")?.value || currentAdminDealPaymentsLeadId || 0);
    if (!leadId) return;

    const paymentType = document.getElementById("adminDealPaymentType")?.value === "renewal"
        ? "renewal"
        : "installment";
    let amountValue = document.getElementById("adminDealPaymentAmount")?.value || "";
    let renewalOption = null;

    if (paymentType === "renewal") {
        renewalOption = findAdminDealPaymentRenewalOption(
            document.getElementById("adminDealRenewalPaymentService")?.value,
        );
        if (!renewalOption) {
            showPopup("Renewal Required", "Select a renewal service first.", false);
            return;
        }

        const renewalAmount = roundAdminPaymentAmount(
            renewalOption.service_amount || renewalOption.amount || 0,
        );
        if (renewalAmount <= 0) {
            showPopup("Renewal Amount Missing", "Selected renewal service has no amount.", false);
            return;
        }

        amountValue = renewalAmount.toFixed(2);
        const amountInput = document.getElementById("adminDealPaymentAmount");
        if (amountInput) amountInput.value = amountValue;
    }

    const paymentBreakup = getAdminPaymentGstBreakup(amountValue);
    const formData = new FormData();
    formData.append("payment_type", paymentType);
    formData.append("amount", amountValue);
    formData.append("amount_without_gst", paymentBreakup.amountWithoutGst.toFixed(2));
    formData.append("gst_amount", paymentBreakup.gstAmount.toFixed(2));
    formData.append("payment_date", document.getElementById("adminDealPaymentDate")?.value || "");
    formData.append("payment_method", document.getElementById("adminDealPaymentMethod")?.value || "");
    formData.append("transaction_id", document.getElementById("adminDealPaymentTransactionId")?.value || "");
    formData.append("bank_name", document.getElementById("adminDealPaymentBankName")?.value || "");
    formData.append("notes", document.getElementById("adminDealPaymentNotes")?.value || "");
    formData.append("payment_status", "received");
    formData.append("created_by", currentUser?.id || "");
    formData.append("created_by_name", currentUser?.name || "");

    if (paymentType === "renewal" && renewalOption) {
        const serviceName = renewalOption.service_name || renewalOption.serviceName || "Service";
        const cycleDate =
            document.getElementById("adminDealRenewalCycleDate")?.value ||
            renewalOption.renewal_due_date ||
            "";
        formData.append("renewal_id", renewalOption.renewal_id || renewalOption.id || "");
        formData.append("renewal_service_name", serviceName);
        formData.append("renewal_cycle_start_date", cycleDate);
        formData.append("payment_label", `Renewal - ${serviceName}${cycleDate ? ` (${cycleDate})` : ""}`);
    }

    try {
        const res = await fetch(`${BASE_URL}/api/deal-payments/${leadId}`, {
            method: "POST",
            body: formData,
        });
        const result = await res.json();
        if (!res.ok || !result.success) {
            throw new Error(result.message || "Failed to save payment");
        }

        showPopup("Payment Saved", result.message || "Payment entry saved", true);
        document.getElementById("adminDealPaymentForm")?.reset();
        setAdminDealPaymentDefaultDate();
        await loadAdminDealPayments(leadId);
        await loadDeals();
    } catch (err) {
        console.error("Deal payment save error:", err);
        showPopup("Payment Error", err.message || "Failed to save payment", false);
    }
}

async function updateAdminInvoiceRowPaymentStatus(leadId, paymentId, status, el) {
    const normalizedLeadId = Number(leadId || 0);
    const normalizedPaymentId = Number(paymentId || 0);
    if (!normalizedLeadId) return;

    if (!normalizedPaymentId) {
        await updatePaymentStatus(normalizedLeadId, status, el);
        return;
    }

    const previousValue = el?.getAttribute("data-current-status") || "";
    if (el) el.disabled = true;

    try {
        const res = await fetch(`${BASE_URL}/api/deal-payments/${normalizedLeadId}/${normalizedPaymentId}/status`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ payment_status: status }),
        });
        const result = await res.json();
        if (!res.ok || !result.success) {
            throw new Error(result.message || "Payment status update failed");
        }

        if (el) {
            el.classList.remove("pending", "received", "failed");
            el.classList.add(status);
            el.setAttribute("data-current-status", status);
        }

        showPopup("Updated", "Payment status updated", true);
        await loadAdminDealPayments(normalizedLeadId);
        await loadDeals();
    } catch (err) {
        console.error("Invoice payment status update error:", err);
        if (el && previousValue) {
            el.value = previousValue;
            el.classList.remove("pending", "received", "failed");
            el.classList.add(previousValue);
        }
        showPopup("Error", err.message || "Payment status update failed", false);
    } finally {
        if (el) el.disabled = false;
    }
}

async function shareProformaInvoiceWhatsApp(id, phone, paymentId = 0, instAmt = 0) {
    try {
        const apiUrl = getAdminInvoiceUrl("invoice", id, paymentId, instAmt);
        const res = await fetch(apiUrl);
        const blob = await res.blob();

        let filename = `proforma_invoice_${id}`;
        if (paymentId) filename += `_${paymentId}`;
        if (instAmt) filename += `_inst`;
        filename += '.pdf';

        const file = new File([blob], filename, {
            type: 'application/pdf',
        });

        if (navigator.canShare && navigator.canShare({ files: [file] })) {
            await navigator.share({
                title: 'Proforma Invoice',
                text: 'Proforma Invoice shared from Metrics',
                files: [file],
            });
            return;
        }

        const url = getAdminInvoiceUrl("invoice", id, paymentId, instAmt);
        const waUrl = `https://wa.me/${phone}?text=${encodeURIComponent(`Proforma Invoice: ${url}`)}`;
        window.open(waUrl, '_blank');
    } catch (err) {
        console.error('Proforma WhatsApp Error:', err);
        showPopup('Error', 'Failed to share proforma invoice', false);
    }
}

async function shareTaxInvoiceWhatsApp(id, phone, paymentId = 0, instAmt = 0) {
    try {
        const apiUrl = getAdminInvoiceUrl("tax-invoice", id, paymentId, instAmt);
        const res = await fetch(apiUrl);
        const blob = await res.blob();

        let filename = `tax_invoice_${id}`;
        if (paymentId) filename += `_${paymentId}`;
        if (instAmt) filename += `_inst`;
        filename += '.pdf';

        const file = new File([blob], filename, {
            type: 'application/pdf',
        });

        if (navigator.canShare && navigator.canShare({ files: [file] })) {
            await navigator.share({
                title: 'Tax Invoice',
                text: 'Tax Invoice shared from Metrics',
                files: [file],
            });
            return;
        }

        const url = getAdminInvoiceUrl("tax-invoice", id, paymentId, instAmt);
        const waUrl = `https://wa.me/${phone}?text=${encodeURIComponent(`Tax Invoice: ${url}`)}`;
        window.open(waUrl, '_blank');
    } catch (err) {
        console.error("WhatsApp Share Error:", err);
        showPopup('Error', 'Could not share via WhatsApp', false);
    }
}

async function shareTaxInvoiceGmail(email, id, paymentId = 0, instAmt = 0) {
    if (!email) {
        showPopup('Error', 'Email not available', false);
        return;
    }

    try {
        const pdfUrl = getAdminInvoiceUrl("tax-invoice", id, paymentId, instAmt);
        const a = document.createElement('a');
        a.href = pdfUrl;
        
        let filename = `tax_invoice_${id}`;
        if (paymentId) filename += `_${paymentId}`;
        if (instAmt) filename += `_inst`;
        filename += '.pdf';
        
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();

        setTimeout(() => {
            const gmailUrl =
                `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(email)}` +
                `&su=${encodeURIComponent('Tax Invoice')}` +
                `&body=${encodeURIComponent('Hi,\n\nPlease find the attached Tax Invoice.\n\nRegards')}`;
            window.open(gmailUrl, '_blank');
        }, 500);
    } catch (err) {
        console.error("Gmail Share Error:", err);
        showPopup('Error', 'Could not share via Gmail', false);
    }
}

async function shareProformaInvoiceGmail(email, id, paymentId = 0, instAmt = 0) {
    if (!email) {
        showPopup('Error', 'Email not available', false);
        return;
    }

    try {
        const pdfUrl = getAdminInvoiceUrl("invoice", id, paymentId, instAmt);
        const a = document.createElement('a');
        a.href = pdfUrl;
        
        let filename = `proforma_invoice_${id}`;
        if (paymentId) filename += `_${paymentId}`;
        if (instAmt) filename += `_inst`;
        filename += '.pdf';
        
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();

        setTimeout(() => {
            const gmailUrl =
                `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(email)}` +
                `&su=${encodeURIComponent('Proforma Invoice')}` +
                `&body=${encodeURIComponent('Hi,\n\nPlease find the attached Proforma Invoice.\n\nRegards')}`;
            window.open(gmailUrl, '_blank');
        }, 900);
    } catch (err) {
        console.error('Proforma Gmail Error:', err);
        showPopup('Error', 'Failed to share proforma invoice', false);
    }
}

function normalizeAdminAttendanceStatus(status) {
    const normalized = String(status || "")
        .toLowerCase()
        .trim()
        .replace(/\+/g, " ")
        .replace(/[\s-]+/g, "_")
        .replace(/_+/g, "_")
        .replace(/^_|_$/g, "");

    if (["present_late", "present_and_late"].includes(normalized)) return "late";
    if (
        normalized === "half_day_late" ||
        (normalized.includes("half_day") && normalized.includes("late"))
    ) {
        return "half_day_late";
    }

    return normalized;
}

function getAdminAttendanceStatusMeta(status) {
    const normalizedStatus = normalizeAdminAttendanceStatus(status);

    switch (normalizedStatus) {
        case "present":
            return { label: "Present", className: "present" };
        case "grace":
            return { label: "Grace", className: "grace" };
        case "late":
            return { label: "Present + Late", className: "late" };
        case "half_day_late":
            return { label: "Half Day + Late", className: "half-day" };
        case "half_day":
            return { label: "Half Day", className: "half-day" };
        case "checkout_pending":
            return { label: "Pending Checkout", className: "checkout-pending" };
        case "absent":
            return { label: "Absent", className: "absent" };
        case "sunday":
            return { label: "Sunday", className: "sunday" };
        default:
            return { label: "Not Marked", className: "not-marked" };
    }
}

function buildAdminAttendanceSummary(rows = []) {
    const summary = {
        present: 0,
        grace: 0,
        late: 0,
        halfDay: 0,
        absent: 0,
        checkoutPending: 0,
    };

    rows.forEach((row) => {
        const normalizedStatus = normalizeAdminAttendanceStatus(row.status);

        if (normalizedStatus === "present") summary.present += 1;
        if (normalizedStatus === "grace") summary.grace += 1;
        if (normalizedStatus === "late" || normalizedStatus === "half_day_late") summary.late += 1;
        if (normalizedStatus === "half_day" || normalizedStatus === "half_day_late") summary.halfDay += 1;
        if (normalizedStatus === "absent") summary.absent += 1;
        if (normalizedStatus === "checkout_pending") summary.checkoutPending += 1;
    });

    summary.lateLeaveEquivalent = Math.floor(summary.late / 3);
    summary.lateBalance = summary.late % 3;

    return summary;
}

function formatAdminAttendanceSummaryPeriod(startDate, endDate) {
    const formatValue = (value) => {
        if (!value) return "-";
        const date = new Date(`${value}T00:00:00`);
        if (Number.isNaN(date.getTime())) return value;
        return date.toLocaleDateString("en-GB", {
            day: "2-digit",
            month: "short",
            year: "numeric",
        });
    };

    if (!startDate && !endDate) return "current month";
    if (startDate && endDate && startDate === endDate) return formatValue(startDate);
    return `${formatValue(startDate)} to ${formatValue(endDate)}`;
}

function renderAdminAttendanceSummaryCard({
    status,
    className,
    label,
    value,
    description,
}) {
    const activeStatus = String(
        document.getElementById("adminAttendanceStatusFilter")?.value || "",
    );
    const activeClass = activeStatus === status ? " active" : "";

    return `
        <button
            type="button"
            class="attendance-summary-card ${className}${activeClass}"
            onclick="applyAdminAttendanceSummaryFilter('${status}')"
            title="Show ${label} attendance details"
        >
            <span>${label}</span>
            <strong>${value}</strong>
            <small>${description}</small>
        </button>
    `;
}

function renderAdminAttendanceSummary(rows = [], summaryPayload = null) {
    const summary = summaryPayload
        ? {
            present: Number(summaryPayload.present || 0),
            grace: Number(summaryPayload.grace || 0),
            late: Number(summaryPayload.late || 0),
            halfDay: Number(summaryPayload.halfDay || 0),
            absent: Number(summaryPayload.absent || 0),
            checkoutPending: Number(summaryPayload.checkoutPending || 0),
            lateLeaveEquivalent: Number(summaryPayload.lateLeaveEquivalent || 0),
            lateBalance: Number(summaryPayload.lateBalance || 0),
          }
        : buildAdminAttendanceSummary(rows);
    const container = document.getElementById("adminAttendanceSummary");
    if (!container) return;
    const selectedDate = document.getElementById("adminAttendanceDate")?.value || "";
    const periodText = summaryPayload
        ? formatAdminAttendanceSummaryPeriod(summaryPayload.startDate, summaryPayload.endDate)
        : formatAdminAttendanceSummaryPeriod(selectedDate, selectedDate);

    container.innerHTML = `
        <div class="attendance-summary-strip">
            ${renderAdminAttendanceSummaryCard({
                status: "present",
                className: "present",
                label: "Present",
                value: summary.present,
                description: "Completed full shift",
            })}
            ${renderAdminAttendanceSummaryCard({
                status: "grace",
                className: "grace",
                label: "Grace",
                value: summary.grace,
                description: "Checked in within grace time",
            })}
            ${renderAdminAttendanceSummaryCard({
                status: "late",
                className: "late",
                label: "Late",
                value: summary.late,
                description: "After grace limit",
            })}
            ${renderAdminAttendanceSummaryCard({
                status: "half_day",
                className: "half-day",
                label: "Half Day",
                value: summary.halfDay,
                description: "Early check-out or manual half day",
            })}
            ${renderAdminAttendanceSummaryCard({
                status: "checkout_pending",
                className: "checkout-pending",
                label: "Pending",
                value: summary.checkoutPending,
                description: "Check-out still missing",
            })}
            ${renderAdminAttendanceSummaryCard({
                status: "absent",
                className: "absent",
                label: "Absent",
                value: summary.absent,
                description: "No check-in after day closes",
            })}
            ${renderAdminAttendanceSummaryCard({
                status: "late",
                className: "leave",
                label: "Late = Leave",
                value: summary.lateLeaveEquivalent,
                description: `${summary.lateBalance} late pending, every 3 late = 1 leave`,
            })}
        </div>
        <p class="attendance-summary-note">
            Summary count is for ${periodText}. Click any card to view matching attendance details for the current filters.
        </p>
    `;
}

function applyAdminAttendanceSummaryFilter(status) {
    const select = document.getElementById("adminAttendanceStatusFilter");
    if (!select) return;

    const nextStatus = select.value === status ? "" : status;
    select.value = nextStatus;
    loadAdminAttendance();
}

function escapeAdminAttendanceText(value) {
    return String(value || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function formatAdminAttendanceDateTime(value) {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
    });
}

function getAdminAttendanceLocationRequestStatusMeta(status) {
    const normalizedStatus = String(status || "pending").toLowerCase();

    switch (normalizedStatus) {
        case "approved":
            return { label: "Approved", className: "approved" };
        case "rejected":
            return { label: "Rejected", className: "rejected" };
        case "cancelled":
            return { label: "Cancelled", className: "cancelled" };
        default:
            return { label: "Pending", className: "pending" };
    }
}

function renderAdminAttendanceLocationRequestSummary(summary = {}) {
    const container = document.getElementById("adminAttendanceRequestSummary");
    if (!container) return;

    const pending = Number(summary.pending || 0);
    const approved = Number(summary.approved || 0);
    const rejected = Number(summary.rejected || 0);
    const cancelled = Number(summary.cancelled || 0);

    container.innerHTML = `
        <span class="attendance-request-badge pending">Pending <strong>${pending}</strong></span>
        <span class="attendance-request-badge approved">Approved <strong>${approved}</strong></span>
        <span class="attendance-request-badge rejected">Rejected <strong>${rejected}</strong></span>
        <span class="attendance-request-badge cancelled">Cancelled <strong>${cancelled}</strong></span>
    `;
}

function renderAdminAttendanceLocationRequestReview(row) {
    const reviewerName = row.reviewedByName || "Pending Admin Review";
    const reviewTime = row.reviewedAt
        ? formatAdminAttendanceDateTime(row.reviewedAt)
        : "Awaiting decision";
    const note = row.adminRemark
        ? escapeAdminAttendanceText(row.adminRemark)
        : row.status === "approved"
            ? "Location approved for attendance"
            : row.status === "rejected"
                ? "Request rejected"
                : "No admin note yet";

    return `
        <div class="attendance-request-review">
            <strong>${escapeAdminAttendanceText(reviewerName)}</strong>
            <small>${escapeAdminAttendanceText(reviewTime)}</small>
            <small>${note}</small>
        </div>
    `;
}

function renderAdminAttendanceLocationRequestActions(row) {
    const normalizedStatus = String(row.status || "pending").toLowerCase();

    if (normalizedStatus !== "pending") {
        return `
            <div class="attendance-request-actions-readonly">
                ${normalizedStatus === "approved"
                    ? `Approved pincode radius: ${Number(row.approvedRadiusMeters || row.requestedRadiusMeters || 50000)}m`
                    : "No further action pending"}
            </div>
        `;
    }

    const radiusInputId = `adminAttendanceRequestRadius-${row.id}`;
    const remarkInputId = `adminAttendanceRequestRemark-${row.id}`;
    const defaultRadius = Number(row.approvedRadiusMeters || row.requestedRadiusMeters || 50000);

    return `
        <div class="attendance-request-actions">
            <input
                type="number"
                id="${radiusInputId}"
                min="1000"
                max="50000"
                step="1000"
                value="${defaultRadius}"
                placeholder="Approved pincode radius (m)"
            />
            <textarea
                id="${remarkInputId}"
                rows="2"
                placeholder="Optional admin note for the employee"
            ></textarea>
            <div class="attendance-request-buttons">
                <button type="button" class="approval-btn approve" onclick="reviewAdminAttendanceLocationRequest(${row.id}, 'approved')">Approve</button>
                <button type="button" class="approval-btn reject" onclick="reviewAdminAttendanceLocationRequest(${row.id}, 'rejected')">Reject</button>
            </div>
        </div>
    `;
}

function formatAdminAttendanceLocation(row) {
    if (row.check_in_location) {
        return `<a href="${row.check_in_location}" target="_blank" rel="noopener noreferrer" class="location-btn table-location-link">View Location</a>`;
    }

    if (row.check_in_lat && row.check_in_lng) {
        return `<a href="https://www.google.com/maps?q=${row.check_in_lat},${row.check_in_lng}" target="_blank" rel="noopener noreferrer" class="location-btn table-location-link">View Location</a>`;
    }

    return "-";
}

function renderAdminRoleBadge(role) {
    const label = String(role || "").trim();
    if (!label) return "-";

    const normalizedRole = normalizeAdminTeamRoleForFilter(label);
    const roleClassKey = normalizedRole === "acc" || normalizedRole === "account"
        ? "accounts"
        : normalizedRole;
    const supportedRoles = ["admin", "tme", "email_marketing", "me", "dev", "seo", "smo", "accounts"];
    const roleClass = supportedRoles.includes(roleClassKey)
        ? roleClassKey
        : "default";
    const displayLabel = roleClassKey === "email_marketing"
        ? "EMAIL MARKETING"
        : label.toUpperCase();

    return `<span class="role-badge ${roleClass}">${displayLabel}</span>`;
}

function renderTeamPresenceBadge(user = {}) {
    const isOnLeave = Number(user.is_on_leave_today || 0) > 0;
    if (isOnLeave) {
        const leaveTypeLabel = String(user.today_leave_type || "")
            .replace(/[_-]+/g, " ")
            .replace(/\b\w/g, char => char.toUpperCase())
            .trim() || "Approved Leave";

        return `<span class="team-presence-badge on-leave"><i class="fas fa-calendar-minus"></i> On Leave | ${leaveTypeLabel}</span>`;
    }

    return `<span class="team-presence-badge available"><i class="fas fa-circle-check"></i> Available</span>`;
}

function formatAdminProfileValue(value, fallback = "-") {
    if (value === null || value === undefined) return fallback;
    const normalized = String(value).trim();
    return normalized || fallback;
}

function formatAdminProfileLabel(value, fallback = "-") {
    const normalized = formatAdminProfileValue(value, "");
    if (!normalized) return fallback;

    return normalized
        .replace(/[_-]+/g, " ")
        .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatAdminProfileDateValue(value) {
    if (!value) return "-";
    return formatDate(value);
}

function formatAdminProfileDateTimeValue(value) {
    if (!value) return "-";
    const date = new Date(String(value).replace(" ", "T"));
    if (Number.isNaN(date.getTime())) return formatAdminProfileValue(value);

    return date.toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
}

function formatAdminProfileAmount(value) {
    if (value === null || value === undefined || value === "") return "-";
    const amount = Number(value);
    if (!Number.isFinite(amount)) return formatAdminProfileValue(value);

    return `Rs. ${amount.toLocaleString("en-IN", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })}`;
}

function getAdminProfileFileUrl(filePath) {
    return getAdminUploadedFileUrl(filePath);
}

function isAdminProfileImageFile(filePath) {
    return /\.(jpg|jpeg|png|gif|webp)$/i.test(String(filePath || "").split("?")[0]);
}

function parseAdminProfileSkills(value) {
    const skillLabels = {
        web: "Web",
        seo: "SEO",
        smo: "SMO",
        ads: "Ads",
        app: "App",
        erp: "ERP",
        erp_crm: "ERP/CRM",
    };
    const parsed = parseMaybeJson(value);
    const rawSkills = Array.isArray(parsed)
        ? parsed
        : String(parsed || "")
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean);

    return rawSkills
        .map((skill) => skillLabels[String(skill || "").toLowerCase().trim()] || formatAdminProfileLabel(skill, ""))
        .filter(Boolean)
        .join(", ") || "-";
}

function renderAdminProfileFields(rows) {
    return rows
        .map((row) => `
            <div class="profile-field">
                <span>${escapeAdminHtml(row.label)}</span>
                <strong>${row.html || escapeAdminHtml(formatAdminProfileValue(row.value))}</strong>
            </div>
        `)
        .join("");
}

function renderAdminProfileSection(title, rows) {
    return `
        <section class="profile-detail-section">
            <h3>${escapeAdminHtml(title)}</h3>
            <div class="profile-field-grid">
                ${renderAdminProfileFields(rows)}
            </div>
        </section>
    `;
}

function renderAdminProfileFileCard(label, filePath) {
    const fileUrl = getAdminProfileFileUrl(filePath);
    if (!fileUrl) {
        return `
            <div class="profile-file-card missing">
                <span>${escapeAdminHtml(label)}</span>
                <strong>Not uploaded</strong>
            </div>
        `;
    }

    const normalizedPath = String(filePath || "").replace(/\\/g, "/");
    const preview = isAdminProfileImageFile(normalizedPath)
        ? `<img src="${escapeAdminHtml(fileUrl)}" alt="${escapeAdminHtml(label)}" loading="lazy" />`
        : `<div class="profile-file-icon"><i class="fas fa-file-lines"></i></div>`;

    return `
        <div class="profile-file-card">
            ${preview}
            <div>
                <span>${escapeAdminHtml(label)}</span>
                <strong>${escapeAdminHtml(normalizedPath.split("/").pop() || "Uploaded file")}</strong>
                <a href="${escapeAdminHtml(fileUrl)}" target="_blank" rel="noopener">Open file</a>
            </div>
        </div>
    `;
}

function parseAdminProfileDocumentList(value) {
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

function renderAdminOtherDocumentCards(value) {
    return parseAdminProfileDocumentList(value)
        .map((filePath, index) => renderAdminProfileFileCard(`Other document ${index + 1}`, filePath))
        .join("");
}

function renderAdminEmployeeProfileRecord(user = {}) {
    const container = document.getElementById("employeeProfileRecord");
    if (!container) return;

    const profileStatus = formatAdminProfileLabel(user.profile_setup_status || "pending");
    const pfEnabled = Number(user.pf_enabled || 0) ? "Yes" : "No";
    const compensationType = String(user.compensation_type || "salary").toLowerCase();
    const profileRole = String(user.role || "").toLowerCase().trim();
    const monthlySalary = Number(user.salary || 0);
    const autoTarget = monthlySalary * 7;
    const avatarUrl = getAdminProfileFileUrl(user.prof_img);
    const avatarMarkup = avatarUrl && isAdminProfileImageFile(user.prof_img)
        ? `<img src="${escapeAdminHtml(avatarUrl)}" alt="${escapeAdminHtml(user.name || "Employee")}" />`
        : `<span>${escapeAdminHtml(String(user.name || "U").trim().slice(0, 1).toUpperCase() || "U")}</span>`;

    container.innerHTML = `
        <div class="profile-record-head">
            <div class="profile-record-avatar">${avatarMarkup}</div>
            <div>
                <span class="section-kicker">Employee Record</span>
                <h2>${escapeAdminHtml(user.name || "Employee")}</h2>
                <p>${escapeAdminHtml(formatAdminProfileLabel(user.role))} | ${escapeAdminHtml(user.comp_name || "Metrics Mart")}</p>
            </div>
            <div class="profile-record-status">
                <span>${escapeAdminHtml(profileStatus)}</span>
                <small>Submitted: ${escapeAdminHtml(formatAdminProfileDateTimeValue(user.profile_setup_completed_at))}</small>
            </div>
        </div>

        <div class="profile-detail-grid">
            ${renderAdminProfileSection("Admin Entered Account Details", [
                { label: "Employee code", value: user.employee_code },
                { label: "Full name", value: user.name },
                { label: "Email", value: user.email },
                { label: "Contact", value: user.contact },
                { label: "Family number", value: user.alt_contact },
                { label: "Role", value: formatAdminProfileLabel(user.role) },
                { label: "Department", value: user.department || formatAdminProfileLabel(user.role) },
                { label: "Company", value: user.comp_name },
                { label: "Pay type", value: compensationType.toUpperCase() },
                ...(compensationType === "commission"
                    ? [
                        { label: "Commission percent", value: `${FIXED_SALES_COMMISSION_PERCENT}% fixed` },
                    ]
                    : [
                        { label: "Monthly salary", value: formatAdminProfileAmount(user.salary) },
                        ...(SALES_COMPENSATION_ROLES.has(profileRole)
                            ? [
                                { label: "Auto target", value: `${formatAdminProfileAmount(autoTarget)} (salary x 7)` },
                                { label: "Target incentive", value: "7% after monthly target completion" },
                            ]
                            : []),
                    ]),
                { label: "Login time", value: user.login_time },
                { label: "Logout time", value: user.logout_time },
                { label: "Address", value: user.address },
            ])}

            ${renderAdminProfileSection("Personal & Identity Details", [
                { label: "Date of birth", value: formatAdminProfileDateValue(user.date_of_birth) },
                { label: "Gender", value: formatAdminProfileLabel(user.gender) },
                { label: "Nationality", value: user.nationality },
                { label: "Aadhar number", value: user.aadhar_no },
                { label: "PAN number", value: user.pan_number },
            ])}

            ${renderAdminProfileSection("Bank Details", [
                { label: "Bank name", value: user.bank_name },
                { label: "Account number", value: user.account_no },
                { label: "IFSC code", value: user.ifsc_code },
                { label: "Beneficiary name", value: user.beneficiary_name },
            ])}

            ${renderAdminProfileSection("Joining, Experience & Skills", [
                { label: "Joining date", value: formatAdminProfileDateValue(user.joining_date) },
                { label: "Total experience", value: user.total_experience },
                { label: "Skills", value: parseAdminProfileSkills(user.skills) },
            ])}

            ${renderAdminProfileSection("PF Details", [
                { label: "PF enabled", value: pfEnabled },
                { label: "PF number", value: Number(user.pf_enabled || 0) ? user.pf_number : "-" },
                { label: "UAN number", value: Number(user.pf_enabled || 0) ? user.uan_number : "-" },
                { label: "Employee PF amount", value: Number(user.pf_enabled || 0) ? formatAdminProfileAmount(user.employee_pf_amount) : "-" },
                { label: "Employer PF amount", value: Number(user.pf_enabled || 0) ? formatAdminProfileAmount(user.employer_pf_amount) : "-" },
                { label: "PF joining date", value: Number(user.pf_enabled || 0) ? formatAdminProfileDateValue(user.pf_joining_date) : "-" },
            ])}
        </div>

        <section class="profile-detail-section profile-documents-section">
            <h3>Uploaded Files</h3>
            <div class="profile-file-grid">
                ${renderAdminProfileFileCard("Profile image", user.prof_img)}
                ${renderAdminProfileFileCard("Aadhar image", user.aadhar_img)}
                ${renderAdminProfileFileCard("PAN image", user.pan_img)}
                ${renderAdminProfileFileCard("Cancelled cheque", user.cancelled_cheque)}
                ${renderAdminProfileFileCard("Resume", user.resume_file)}
                ${renderAdminProfileFileCard("Experience letter", user.experience_file)}
                ${renderAdminProfileFileCard("Certification file", user.certification_file)}
                ${renderAdminOtherDocumentCards(user.other_documents)}
            </div>
        </section>
    `;
}

async function loadAdminEmployeeProfileRecord(userId, fallbackUser = {}) {
    const container = document.getElementById("employeeProfileRecord");
    if (container) {
        container.innerHTML = '<div class="profile-record-empty">Loading employee profile record...</div>';
    }

    try {
        const res = await fetch(`${BASE_URL}/api/admin/users/${Number(userId)}`, {
            cache: "no-store",
        });
        const result = await res.json();

        if (!res.ok || !result.success || !result.data) {
            throw new Error(result.message || "Unable to load employee profile record");
        }

        renderAdminEmployeeProfileRecord({ ...fallbackUser, ...result.data });
    } catch (err) {
        console.error("Employee profile record load failed:", err);
        renderAdminEmployeeProfileRecord(fallbackUser);
        if (container) {
            container.insertAdjacentHTML(
                "beforeend",
                `<div class="profile-record-warning">${escapeAdminHtml(err.message || "Full profile details could not be loaded.")}</div>`,
            );
        }
    }
}

function renderAdminAttendanceStatus(row) {
    const statusMeta = getAdminAttendanceStatusMeta(row.status);
    return `<span class="attendance-status ${statusMeta.className}">${statusMeta.label}</span>`;
}

function getAdminAttendanceActionKey(userId, attendanceDate) {
    return `${Number(userId) || 0}-${String(attendanceDate || "")
        .replace(/[^a-zA-Z0-9_-]/g, "")}`;
}

function getAdminAttendanceOverrideSelectId(userId, attendanceDate) {
    return `adminAttendanceStatus-${getAdminAttendanceActionKey(userId, attendanceDate)}`;
}

function getAdminAttendanceTimeInputId(userId, attendanceDate, field) {
    return `adminAttendanceTime-${field}-${getAdminAttendanceActionKey(userId, attendanceDate)}`;
}

function renderAdminAttendanceActions(row) {
    const selectedValue = row.has_override ? normalizeAdminAttendanceStatus(row.status) : "auto";
    const rowDate = String(row.attendance_date || document.getElementById("adminAttendanceDate")?.value || "");
    const selectId = getAdminAttendanceOverrideSelectId(row.user_id, rowDate);
    const checkInInputId = getAdminAttendanceTimeInputId(row.user_id, rowDate, "in");
    const checkOutInputId = getAdminAttendanceTimeInputId(row.user_id, rowDate, "out");
    const disableResolve = row.has_pending_checkout ? "" : "disabled";
    const clearOverrideButton = row.has_override
        ? `<button type="button" class="attendance-action-btn subtle" onclick="clearAdminAttendanceOverride(${row.user_id}, '${rowDate}')">Clear</button>`
        : "";
    const checkInValue = formatAdminAttendanceTimeInput(row.check_in);
    const checkOutValue = formatAdminAttendanceTimeInput(row.check_out);

    return `
        <div class="admin-attendance-actions">
            <select id="${selectId}" class="attendance-override-select">
                <option value="auto" ${selectedValue === "auto" ? "selected" : ""}>Auto</option>
                <option value="present" ${selectedValue === "present" ? "selected" : ""}>Present</option>
                <option value="grace" ${selectedValue === "grace" ? "selected" : ""}>Grace</option>
                <option value="late" ${selectedValue === "late" ? "selected" : ""}>Late</option>
                <option value="half_day" ${selectedValue === "half_day" ? "selected" : ""}>Half Day</option>
                <option value="half_day_late" ${selectedValue === "half_day_late" ? "selected" : ""}>Half Day + Late</option>
                <option value="absent" ${selectedValue === "absent" ? "selected" : ""}>Absent</option>
                <option value="checkout_pending" ${selectedValue === "checkout_pending" ? "selected" : ""}>Pending Checkout</option>
            </select>
            <div class="admin-attendance-time-editor">
                <div class="admin-attendance-time-editor-title">Edit Time</div>
                <label title="Admin check-in time">
                    <span>In</span>
                    <input type="time" id="${checkInInputId}" value="${checkInValue}">
                </label>
                <label title="Admin check-out time">
                    <span>Out</span>
                    <input type="time" id="${checkOutInputId}" value="${checkOutValue}">
                </label>
            </div>
            <div class="admin-attendance-action-buttons">
                <button type="button" class="attendance-action-btn primary" onclick="saveAdminAttendanceOverride(${row.user_id}, '${rowDate}')">Save</button>
                <button type="button" class="attendance-action-btn warning" onclick="resolveAdminAttendanceNow(${row.user_id}, '${rowDate}')" ${disableResolve}>Resolve Now</button>
                ${clearOverrideButton}
            </div>
        </div>
    `;
}

async function loadAdminAttendance() {
    setupAdminAttendanceControls();
    await refreshAdminAttendanceEmployeeFilter({ preserveValue: true });

    const tbody = document.getElementById("adminAttendanceTableBody");
    if (!tbody) return;

    const date = await resolveAdminAttendanceDate();
    const role = document.getElementById("adminAttendanceRole")?.value || "";
    const employeeId = getAdminAttendanceSelectedEmployeeId();
    const status = document.getElementById("adminAttendanceStatusFilter")?.value || "";
    const params = new URLSearchParams({ date });
    params.set("companyScope", getAdminPanelCompanyScope());
    if (role) params.set("role", role);
    if (employeeId) {
        params.set("employeeId", employeeId);
        params.set("month", date.slice(0, 7));
    }
    if (status) params.set("status", status);

    tbody.innerHTML = `<tr><td colspan="10">Loading attendance...</td></tr>`;
    loadAdminAttendanceLocationRequests(date);

    try {
        const res = await fetch(`${BASE_URL}/api/admin/attendance?${params.toString()}`);
        const contentType = res.headers.get("content-type") || "";
        if (!contentType.includes("application/json")) {
            throw new Error("Attendance API unavailable. Restart the server to load the latest admin attendance routes.");
        }

        const result = await res.json();
        if (!res.ok || !result.success) {
            throw new Error(result.message || "Failed to load attendance");
        }
        const rows = filterAdminRowsByCompanyScope(
            result.success ? result.data || [] : [],
        );
        const monthSummary = employeeId && result.mode === "month"
            ? result.summary || null
            : null;
        const summaryRows = monthSummary
            ? rows
            : rows.filter((row) => String(row.attendance_date || "") === date);
        const shouldHighlightSelectedDate = Boolean(
            employeeId &&
            (result.mode === "month" || rows.some((row) => String(row.attendance_date || "") !== date)),
        );

        renderAdminAttendanceSummary(summaryRows, monthSummary);

        if (!rows.length) {
            tbody.innerHTML = `<tr><td colspan="10">No attendance records found</td></tr>`;
            return;
        }

        tbody.innerHTML = rows.map((row) => {
            const rowDate = String(row.attendance_date || "");
            const selectedDateClass = shouldHighlightSelectedDate && rowDate === date
                ? " admin-attendance-selected-date-row"
                : "";

            return `
            <tr class="${selectedDateClass}">
                <td>${formatDate(row.attendance_date)}</td>
                <td>
                    <button type="button" class="attendance-name-btn" onclick="openEmployeeDetails(${row.user_id}, 'attendance')">
                        ${row.user_name || "-"}
                    </button>
                </td>
                <td>${renderAdminRoleBadge(row.role)}</td>
                <td>${formatAdminAttendanceTime(row.shift_start)} - ${formatAdminAttendanceTime(row.logout_time)}</td>
                <td>${formatAdminAttendanceTime(row.check_in)}</td>
                <td>${formatAdminAttendanceTime(row.check_out)}</td>
                <td>${formatAdminAttendanceWorkingHours(row.working_hours)}</td>
                <td>${renderAdminAttendanceStatus(row)}</td>
                <td>${formatAdminAttendanceLocation(row)}</td>
                <td>${renderAdminAttendanceActions(row)}</td>
            </tr>
        `;
        }).join("");

        const searchInput = document.getElementById("adminAttendanceSearch");
        if (searchInput?.value) {
            filterTable("adminAttendanceTableBody", "adminAttendanceSearch");
        }
    } catch (err) {
        console.error("Admin Attendance Load Error:", err);
        renderAdminAttendanceSummary([]);
        tbody.innerHTML = `<tr><td colspan="10">${err.message || "Error loading attendance"}</td></tr>`;
    }
}

async function loadAdminAttendanceLocationRequests(selectedDate = "") {
    const tbody = document.getElementById("adminAttendanceRequestTableBody");
    if (!tbody || !currentUser?.id) return;

    const date = selectedDate || await resolveAdminAttendanceDate();
    const role = document.getElementById("adminAttendanceRole")?.value || "";
    const status = document.getElementById("adminAttendanceRequestStatus")?.value || "";
    const params = new URLSearchParams({
        adminId: String(currentUser.id),
        date,
    });
    params.set("companyScope", getAdminPanelCompanyScope());

    if (role) params.set("role", role);
    if (status) params.set("status", status);

    tbody.innerHTML = `<tr><td colspan="8">Loading offsite attendance requests...</td></tr>`;

    try {
        const res = await fetch(`${BASE_URL}/api/admin/attendance/location-requests?${params.toString()}`);
        const result = await res.json();

        if (!res.ok || !result.success) {
            throw new Error(result.message || "Failed to load offsite attendance requests");
        }

        const rows = filterAdminRowsByCompanyScope(result.data);
        renderAdminAttendanceLocationRequestSummary(result.summary || {});

        if (!rows.length) {
            tbody.innerHTML = `<tr><td colspan="8">No offsite attendance requests found for this date</td></tr>`;
            return;
        }

        tbody.innerHTML = rows.map((row) => {
            const statusMeta = getAdminAttendanceLocationRequestStatusMeta(row.status);
            const locationUrl = row.requestedLocationUrl || (row.requestedLat && row.requestedLng
                ? `https://www.google.com/maps?q=${row.requestedLat},${row.requestedLng}`
                : "");

            return `
                <tr>
                    <td>
                        <div class="attendance-request-review">
                            <strong>${escapeAdminAttendanceText(formatDate(row.attendanceDate))}</strong>
                            <small>${escapeAdminAttendanceText(formatAdminAttendanceDateTime(row.createdAt))}</small>
                        </div>
                    </td>
                    <td>
                        <div class="attendance-request-person">
                            <strong>${escapeAdminAttendanceText(row.userName || "-")}</strong>
                            <small>${escapeAdminAttendanceText(row.meetingWith || "No meeting contact added")}</small>
                        </div>
                    </td>
                    <td>${renderAdminRoleBadge(row.role)}</td>
                    <td>
                        <div class="attendance-request-purpose">
                            <strong>${escapeAdminAttendanceText(row.purpose || "Meeting request")}</strong>
                            <small>${escapeAdminAttendanceText(row.notes || "No extra notes shared")}</small>
                        </div>
                    </td>
                    <td>
                        <div class="attendance-request-purpose">
                            <strong>${escapeAdminAttendanceText(row.requestedPincode ? `Pincode ${row.requestedPincode}` : row.requestedAddress || "Requested meeting location")}</strong>
                            <small>${escapeAdminAttendanceText(row.requestedAddress || "Meeting area not added")}</small>
                            <small>${locationUrl ? `<a href="${locationUrl}" target="_blank" rel="noopener noreferrer" class="location-btn table-location-link">Open Map</a>` : "Map unavailable"} | Requested ${Number(row.requestedRadiusMeters || 50000)}m</small>
                        </div>
                    </td>
                    <td><span class="attendance-request-status ${statusMeta.className}">${statusMeta.label}</span></td>
                    <td>${renderAdminAttendanceLocationRequestReview(row)}</td>
                    <td>${renderAdminAttendanceLocationRequestActions(row)}</td>
                </tr>
            `;
        }).join("");
    } catch (err) {
        console.error("Admin attendance location requests load error:", err);
        renderAdminAttendanceLocationRequestSummary({});
        tbody.innerHTML = `<tr><td colspan="8">${err.message || "Error loading offsite attendance requests"}</td></tr>`;
    }
}

async function reviewAdminAttendanceLocationRequest(requestId, status) {
    const radiusInput = document.getElementById(`adminAttendanceRequestRadius-${requestId}`);
    const remarkInput = document.getElementById(`adminAttendanceRequestRemark-${requestId}`);

    try {
        const res = await fetch(`${BASE_URL}/api/admin/attendance/location-requests/${requestId}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                adminId: currentUser?.id || null,
                status,
                approvedRadiusMeters: radiusInput ? Number(radiusInput.value || 0) : null,
                adminRemark: remarkInput?.value || "",
            }),
        });
        const result = await res.json();

        if (!res.ok || !result.success) {
            throw new Error(result.message || "Failed to update offsite attendance request");
        }

        showPopup("Attendance", result.message, true);
        await loadAdminAttendanceLocationRequests();
    } catch (err) {
        console.error("Admin attendance location request review error:", err);
        showPopup("Attendance", err.message || "Failed to update offsite attendance request", false);
    }
}

async function saveAdminAttendanceOverride(userId, attendanceDate = "") {
    const date = attendanceDate || document.getElementById("adminAttendanceDate")?.value;
    const select = document.getElementById(getAdminAttendanceOverrideSelectId(userId, date)) ||
        document.getElementById(`adminAttendanceStatus-${userId}`);
    const checkInInput = document.getElementById(getAdminAttendanceTimeInputId(userId, date, "in"));
    const checkOutInput = document.getElementById(getAdminAttendanceTimeInputId(userId, date, "out"));
    if (!date || !select) return;

    try {
        const res = await fetch(`${BASE_URL}/api/admin/attendance/override`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                userId,
                date,
                status: select.value,
                checkInTime: checkInInput?.value || "",
                checkOutTime: checkOutInput?.value || "",
                adminId: currentUser?.id || null,
            }),
        });
        const result = await res.json();

        if (!res.ok || !result.success) {
            throw new Error(result.message || "Failed to update attendance");
        }

        showPopup("Attendance", result.message, true);
        await loadAdminAttendance();
    } catch (err) {
        console.error("Admin attendance override error:", err);
        showPopup("Attendance", err.message || "Failed to update attendance", false);
    }
}

function clearAdminAttendanceOverride(userId, attendanceDate = "") {
    const date = attendanceDate || document.getElementById("adminAttendanceDate")?.value;
    const select = document.getElementById(getAdminAttendanceOverrideSelectId(userId, date)) ||
        document.getElementById(`adminAttendanceStatus-${userId}`);
    if (select) {
        select.value = "auto";
    }
    saveAdminAttendanceOverride(userId, date);
}

async function resolveAdminAttendanceNow(userId, attendanceDate = "") {
    const date = attendanceDate || document.getElementById("adminAttendanceDate")?.value;
    const checkOutInput = document.getElementById(getAdminAttendanceTimeInputId(userId, date, "out"));
    if (!date) return;

    try {
        const res = await fetch(`${BASE_URL}/api/admin/attendance/resolve`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                userId,
                date,
                checkOutTime: checkOutInput?.value || "",
                adminId: currentUser?.id || null,
            }),
        });
        const result = await res.json();

        if (!res.ok || !result.success) {
            throw new Error(result.message || "Failed to resolve checkout");
        }

        showPopup("Attendance", result.message, true);
        await loadAdminAttendance();
    } catch (err) {
        console.error("Admin attendance resolve error:", err);
        showPopup("Attendance", err.message || "Failed to resolve checkout", false);
    }
}

async function loadTeam() {
    try {
        const teamStatus = normalizeAdminTeamEmploymentStatusFilter(
            adminTeamEmploymentStatusFilter,
        );
        const url = new URL(getAdminPanelScopedApiUrl("/api/admin/team-report"));
        url.searchParams.set("employmentStatus", teamStatus);

        const res = await fetch(url.toString(), { cache: "no-store" });
        const result = await res.json();

        if (!result.success || !result.data) {
            throw new Error("No team data");
        }

        const scopedTeam = filterAdminRowsByCompanyScope(result.data);
        allTeamData = scopedTeam;
        adminDashboardCache.team = scopedTeam;
        adminAttendanceEmployeeOptionsScope = getAdminPanelCompanyScope();
        filterTeamByRole('all');

    } catch (err) {
        console.error("Team Load Error:", err);

        const teamTable = document.getElementById('teamTable');
        if (!teamTable) return;
        teamTable.innerHTML = `
            <tr>
                <td colspan="6" style="color:red;padding:20px;">
                    Error loading team data
                </td>
            </tr>
        `;
    }
}
function filterTeamByRole(role) {
    document.querySelectorAll('.tab-btn').forEach(btn => {
        if (btn.getAttribute('data-role') === role) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
    const table = document.getElementById('teamTable');
    if (!table) return;
    table.innerHTML = '';
    let filtered = allTeamData;
    if (role !== 'all') {
        filtered = allTeamData.filter(user => 
            user.role && user.role.toLowerCase().trim() === role.toLowerCase().trim()
        );
    }
    if (filtered.length === 0) {
        table.innerHTML = `<tr><td colspan="6" style="padding:30px;color:#64748b;text-align:center;">No users found for this role.</td></tr>`;
        return;
    }
    filtered.forEach(user => {
        table.innerHTML += `
            <tr>
                <td>${user.name}</td>
                <td>${user.email}</td>
                <td>${user.role}</td>
                <td>${user.total_leads}</td>
                <td>${user.total_appointments}</td>
                <td>${user.total_followups}</td>
            </tr>
        `;
    });
}

async function loadTeam() {
    try {
        const teamStatus = normalizeAdminTeamEmploymentStatusFilter(
            adminTeamEmploymentStatusFilter,
        );
        const url = new URL(getAdminPanelScopedApiUrl("/api/admin/team-report"));
        url.searchParams.set("employmentStatus", teamStatus);

        const res = await fetch(url.toString(), { cache: "no-store" });
        const result = await res.json();

        if (!result.success || !result.data) {
            throw new Error("No team data");
        }

        const scopedTeam = filterAdminRowsByCompanyScope(result.data);
        allTeamData = scopedTeam;
        adminDashboardCache.team = scopedTeam;
        adminAttendanceEmployeeOptionsScope = `${getAdminPanelCompanyScope()}:${teamStatus}`;
        syncAdminTeamEmploymentStatusTabs();
        filterTeamByRole(adminTeamRoleFilter);
    } catch (err) {
        console.error("Team Load Error:", err);
        document.getElementById('teamTable').innerHTML = `
            <tr>
                <td colspan="9" style="color:red;padding:20px;">Error loading team data</td>
            </tr>
        `;
    }
}

function normalizeAdminTeamRoleForFilter(value) {
    const normalized = String(value || "")
        .toLowerCase()
        .trim()
        .replace(/[_-]+/g, " ")
        .replace(/\s+/g, " ");
    const compact = normalized.replace(/\s+/g, "");
    const aliases = {
        all: "all",
        admin: "admin",
        hr: "hr",
        humanresource: "hr",
        humanresources: "hr",
        tme: "tme",
        emailmarketing: "email_marketing",
        email_marketing: "email_marketing",
        "email marketing": "email_marketing",
        me: "me",
        dev: "dev",
        developer: "dev",
        seo: "seo",
        smo: "smo",
        socialmedia: "smo",
        socialmediamarketing: "smo",
        socialmediaoptimization: "smo",
        acc: "accounts",
        account: "accounts",
        accounts: "accounts",
    };

    return aliases[normalized] || aliases[compact] || normalized;
}

function normalizeAdminTeamEmploymentStatusFilter(value, fallback = "active") {
    const normalized = String(value || "")
        .toLowerCase()
        .trim()
        .replace(/[\s-]+/g, "_");

    if (["all", "any"].includes(normalized)) return "all";
    if (["inactive", "deactive", "deactivated", "disabled", "blocked"].includes(normalized)) {
        return "inactive";
    }
    if (["active", "activate", "activated", "enabled"].includes(normalized)) {
        return "active";
    }
    return fallback;
}

function isAdminTeamUserActive(user = {}) {
    return normalizeAdminTeamEmploymentStatusFilter(
        user.employment_status || user.employmentStatus,
    ) === "active";
}

function syncAdminTeamEmploymentStatusTabs() {
    const select = document.getElementById("teamEmploymentStatusFilter");
    if (select) {
        select.value = adminTeamEmploymentStatusFilter;
    }

    document.querySelectorAll("[data-team-status]").forEach((btn) => {
        const btnStatus = normalizeAdminTeamEmploymentStatusFilter(btn.dataset.teamStatus, "all");
        btn.classList.toggle("active", btnStatus === adminTeamEmploymentStatusFilter);
    });
}

async function filterTeamByEmploymentStatus(status) {
    adminTeamEmploymentStatusFilter = normalizeAdminTeamEmploymentStatusFilter(status);
    adminTeamRoleFilter = "all";

    const searchInput = document.getElementById("teamSearch");
    if (searchInput) {
        searchInput.value = "";
    }

    syncAdminTeamEmploymentStatusTabs();
    await loadTeam();
}

function renderAdminTeamEmploymentBadge(user = {}) {
    const isActive = isAdminTeamUserActive(user);
    const statusText = isActive ? "Active" : "Deactive";
    const detailText = isActive
        ? "Login allowed"
        : user.deactivated_at
            ? `Blocked ${formatDate(user.deactivated_at)}`
            : "Login blocked";

    return `
        <div class="employee-access-stack">
            <span class="employee-access-badge ${isActive ? "active" : "inactive"}">
                ${escapeAdminHtml(statusText)}
            </span>
            <small>${escapeAdminHtml(detailText)}</small>
        </div>
    `;
}

function renderAdminTeamAccessAction(user = {}) {
    const userId = Number(user.id || 0);
    const isActive = isAdminTeamUserActive(user);
    const isSelf = userId && Number(currentUser?.id || 0) === userId;
    const nextStatus = isActive ? "inactive" : "active";
    const label = isActive ? "Deactivate" : "Activate";
    const icon = isActive ? "fa-user-slash" : "fa-user-check";

    return `
        <button
            type="button"
            class="attBtn ${isActive ? "danger" : "success"}"
            onclick="toggleAdminEmployeeStatus(event, ${userId}, '${nextStatus}')"
            ${isSelf && isActive ? "disabled" : ""}
            title="${isSelf && isActive ? "You cannot deactivate your own account" : label}"
        >
            <i class="fas ${icon}"></i> ${label}
        </button>
    `;
}

function filterTeamByRole(role) {
    const selectedRole = normalizeAdminTeamRoleForFilter(role);
    adminTeamRoleFilter = selectedRole;

    // Active button toggle
    document.querySelectorAll('.role-tabs .tab-btn[data-role]').forEach(btn => {
        const btnRole = normalizeAdminTeamRoleForFilter(btn.dataset.role);

        if (btnRole === selectedRole) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });

    const table = document.getElementById('teamTable');
    if (!table) return;
    table.innerHTML = '';

    // Filter logic
    let filtered = allTeamData;

    if (selectedRole !== 'all') {
        filtered = allTeamData.filter(user => {

            // DB role
            const userRole = normalizeAdminTeamRoleForFilter(user.role);

            return userRole === selectedRole;
        });
    }

    // No data
    if (filtered.length === 0) {
        table.innerHTML = `
            <tr>
                <td colspan="9" style="padding:30px;color:#64748b;text-align:center;">
                    No users found for this filter.
                </td>
            </tr>
        `;
        return;
    }

    // Render rows
    filtered.forEach(user => {

        table.innerHTML += `
            <tr>
                <td>
                    <div class="employee-status-stack">
                        <span class="team-employee-name">
                            ${escapeAdminHtml(user.name || "-")}
                        </span>

                        ${renderTeamPresenceBadge(user)}
                    </div>
                </td>

                <td>${escapeAdminHtml(user.email || "-")}</td>

                <td>${renderAdminRoleBadge(user.role)}</td>

                <td>${escapeAdminHtml(user.total_leads || 0)}</td>

                <td>${escapeAdminHtml(user.total_appointments || 0)}</td>

                <td>${escapeAdminHtml(user.total_followups || 0)}</td>

                <td>${renderAdminTeamEmploymentBadge(user)}</td>

                <td>
                    <button
                        class="attBtn"
                        onclick="openEmployeeDetails(${user.id})"
                    >
                        View
                    </button>
                </td>

                <td>
                    <button
                        class="attBtn secondary"
                        onclick="openUserEditForm(${user.id})"
                    >
                        Update
                    </button>
                    ${renderAdminTeamAccessAction(user)}
                </td>
            </tr>
        `;
    });

    const searchInput = document.getElementById("teamSearch");
    if (searchInput?.value) {
        filterTable("teamTable", "teamSearch");
    }
}

async function toggleAdminEmployeeStatus(event, userId, nextStatus) {
    event?.stopPropagation?.();

    const employee = allTeamData.find((user) => String(user.id) === String(userId));
    const normalizedStatus = normalizeAdminTeamEmploymentStatusFilter(nextStatus, "");
    if (!employee || !["active", "inactive"].includes(normalizedStatus)) {
        showPopup("Employee Status", "Invalid employee status request.", false);
        return;
    }

    const employeeName = employee.name || "this employee";
    if (
        normalizedStatus === "inactive" &&
        !window.confirm(`Deactivate ${employeeName}? The employee will no longer be able to login.`)
    ) {
        return;
    }

    try {
        const res = await fetch(`${BASE_URL}/api/admin/users/${Number(userId)}/employment-status`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                status: normalizedStatus,
                actorId: currentUser?.id || null,
            }),
        });
        const result = await res.json().catch(() => ({}));

        if (!res.ok || !result.success) {
            throw new Error(result.message || "Failed to update employee status");
        }

        showPopup("Employee Status", result.message || "Employee status updated.", true);
        await loadTeam();
        refreshAdminAttendanceEmployeeFilter({ preserveValue: false });
        loadAdminTeamTargetsSummary(true);
    } catch (err) {
        console.error("Admin employee status update error:", err);
        showPopup("Employee Status", err.message || "Failed to update employee status", false);
    }
}

let selectedEmployeeId = null;
let employeeDetailsReturnSection = "team";

async function openEmployeeDetails(userId, returnSection = "team") {
    selectedEmployeeId = userId;
    employeeDetailsReturnSection = returnSection;

    if (!allTeamData.length) {
        await loadTeam();
    }

    const user = allTeamData.find(u => String(u.id) === String(userId));
    if (!user) {
        showPopup("Error", "Employee not found!", false);
        return;
    }

    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    const backButton = document.getElementById("employeeDetailsBackBtn");
    if (backButton) {
        backButton.innerHTML = returnSection === "attendance"
            ? `<i class="fas fa-arrow-left"></i> Back to Attendance`
            : `<i class="fas fa-arrow-left"></i> Back to Team`;
    }

    document.getElementById("empName").textContent = user.name || "-";
    document.getElementById("empEmail").textContent = user.email || "-";
    document.getElementById("empRole").textContent = formatAdminProfileLabel(user.role);
    document.getElementById("empRole").className = `role-badge ${normalizeAdminTeamRoleForFilter(user.role) || "default"}`;

    const empPhoto = document.getElementById("empPhoto");
    const role = normalizeAdminTeamRoleForFilter(user.role);
    let defaultImage = "https://dummyimage.com/150x150/0f172a/ffffff&text=USER";

    if (role === "tme") defaultImage = "https://dummyimage.com/150x150/0f172a/ffffff&text=TME";
    if (role === "email_marketing" || role === "email marketing") defaultImage = "https://dummyimage.com/150x150/0f172a/ffffff&text=EM";
    if (role === "me") defaultImage = "https://dummyimage.com/150x150/0f172a/ffffff&text=ME";
    if (role === "dev") defaultImage = "https://dummyimage.com/150x150/0f172a/ffffff&text=DEV";
    if (role === "seo") defaultImage = "https://dummyimage.com/150x150/0f172a/ffffff&text=SEO";
    if (role === "smo") defaultImage = "https://dummyimage.com/150x150/0f172a/ffffff&text=SMO";

    if (user.prof_img && String(user.prof_img).toUpperCase() !== "NULL") {
        empPhoto.src = getAdminUploadedFileUrl(user.prof_img);
        empPhoto.onerror = () => {
            empPhoto.src = defaultImage;
        };
    } else {
        empPhoto.src = defaultImage;
    }

    empPhoto.alt = `${user.name || "Employee"} profile`;

    await loadAdminEmployeeProfileRecord(userId, user);

    if (role === "dev") {
        document.getElementById("devPerformance").style.display = "block";
        document.getElementById("meStats").style.display = "none";
        await loadDevPerformance(userId);
    } else {
        document.getElementById("devPerformance").style.display = "none";
        document.getElementById("meStats").style.display = "flex";
        document.getElementById("statLeads").textContent = user.total_leads || 0;
        document.getElementById("statAppointments").textContent = user.total_appointments || 0;
        document.getElementById("statFollowups").textContent = user.total_followups || 0;
    }

    const currentDate = new Date();
    const currentMonth = currentDate.getMonth() + 1;
    const currentYear = currentDate.getFullYear();
    const yearSelect = document.getElementById("attendanceYear");

    document.getElementById("attendanceMonth").value = currentMonth;
    yearSelect.innerHTML = "";

    for (let y = currentYear; y >= 2023; y--) {
        yearSelect.innerHTML += `<option value="${y}">${y}</option>`;
    }

    yearSelect.value = currentYear;
    generateWeeks(currentMonth, currentYear);

    await loadEmployeeAttendance(userId, currentMonth, currentYear);
    await loadEmployeeLocation(userId);

    const employeeDetails = document.getElementById("employeeDetails");
    employeeDetails.style.display = "block";
    employeeDetails.classList.add("active");
}

async function loadEmployeeAttendance(userId, month, year, week = "all") {
    const tbody = document.getElementById("attendanceBody");
    tbody.innerHTML = `<tr><td colspan="5" style="padding:20px;text-align:center;">Loading...</td></tr>`;

    try {
        const res = await fetch(`/api/attendance/history/${userId}?month=${month}&year=${year}&week=${week}`);
        const data = await res.json();

        tbody.innerHTML = "";

        if (!data.success || !data.data || data.data.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="5" style="padding:30px;color:#ef4444;text-align:center;">No attendance records found</td>
                </tr>
            `;
            renderEmployeeAttendanceSummary(tbody, []);
            return;
        }

        data.data.forEach(row => {
            const normalizedStatus = normalizeAttendanceSummaryStatus(row.status);
            const hours = normalizedStatus === "checkout_pending"
                ? "Pending"
                : formatWorkTime(row.in_time, row.out_time);
            const statusClass = (normalizedStatus || "present").replace(/_/g, "-");

            tbody.innerHTML += `
                <tr>
                    <td>${formatDate(row.date)}</td>
                    <td>${formatAdminAttendanceTime(row.in_time)}</td>
                    <td>${formatAdminAttendanceTime(row.out_time)}</td>
                    <td class="status-${statusClass}">${row.status || "Present"}</td>
                    <td>${hours}</td>
                </tr>
            `;
        });

        renderEmployeeAttendanceSummary(tbody, data.data);
    } catch (err) {
        console.error("Attendance Error:", err);
        tbody.innerHTML = `
            <tr>
                <td colspan="5" style="color:red;padding:30px;text-align:center;">Error loading attendance</td>
            </tr>
        `;
        renderEmployeeAttendanceSummary(tbody, []);
    }
}

function normalizeAttendanceSummaryStatus(status) {
    const normalized = String(status || "")
        .toLowerCase()
        .trim()
        .replace(/\+/g, " ")
        .replace(/[\s-]+/g, "_")
        .replace(/_+/g, "_")
        .replace(/^_|_$/g, "");

    if (["present_late", "present_and_late"].includes(normalized)) return "late";
    if (
        normalized === "half_day_late" ||
        (normalized.includes("half_day") && normalized.includes("late"))
    ) {
        return "half_day_late";
    }

    return normalized;
}

function buildEmployeeAttendanceSummary(rows = []) {
    const summary = {
        present: 0,
        grace: 0,
        late: 0,
        halfDay: 0,
        absent: 0,
        checkoutPending: 0,
    };

    rows.forEach((row) => {
        const normalizedStatus = normalizeAttendanceSummaryStatus(row.status);

        if (normalizedStatus === "grace") {
            summary.grace += 1;
        } else if (normalizedStatus === "late") {
            summary.late += 1;
        } else if (normalizedStatus === "half_day_late") {
            summary.late += 1;
            summary.halfDay += 1;
        } else if (normalizedStatus === "half_day") {
            summary.halfDay += 1;
        } else if (normalizedStatus === "absent") {
            summary.absent += 1;
        } else if (normalizedStatus === "checkout_pending") {
            summary.checkoutPending += 1;
        } else if (row.in_time) {
            summary.present += 1;
        }
    });

    summary.lateLeaveEquivalent = Math.floor(summary.late / 3);
    summary.lateBalance = summary.late % 3;

    return summary;
}

function renderEmployeeAttendanceSummary(tbody, rows) {
    const table = tbody?.closest("table");
    if (!table) return;

    let summaryEl = document.getElementById("employeeAttendanceSummary");
    if (!summaryEl) {
        summaryEl = document.createElement("div");
        summaryEl.id = "employeeAttendanceSummary";
        table.insertAdjacentElement("afterend", summaryEl);
    }

    const summary = buildEmployeeAttendanceSummary(rows);

    summaryEl.innerHTML = `
        <div class="attendance-summary-strip">
            <div class="attendance-summary-card present">
                <span>Present</span>
                <strong>${summary.present}</strong>
                <small>Completed full shift</small>
            </div>
            <div class="attendance-summary-card grace">
                <span>Grace</span>
                <strong>${summary.grace}</strong>
                <small>Checked in within grace time</small>
            </div>
            <div class="attendance-summary-card late">
                <span>Late</span>
                <strong>${summary.late}</strong>
                <small>After grace limit</small>
            </div>
            <div class="attendance-summary-card half-day">
                <span>Half Day</span>
                <strong>${summary.halfDay}</strong>
                <small>Early check-out overrides late</small>
            </div>
            <div class="attendance-summary-card checkout-pending">
                <span>Pending</span>
                <strong>${summary.checkoutPending}</strong>
                <small>Check-out still missing</small>
            </div>
            <div class="attendance-summary-card absent">
                <span>Absent</span>
                <strong>${summary.absent}</strong>
                <small>Missing check-out or absent day</small>
            </div>
            <div class="attendance-summary-card leave">
                <span>Late = Leave</span>
                <strong>${summary.lateLeaveEquivalent}</strong>
                <small>${summary.lateBalance} late pending, every 3 late = 1 leave</small>
            </div>
        </div>
        <p class="attendance-summary-note">
            If someone checks in late and also checks out early on the same day, the final status is counted as Half Day and shown in both the table and summary.
        </p>
    `;
}

function filterAttendance() {
    if (!selectedEmployeeId) return;

    const month = document.getElementById("attendanceMonth").value;
    const year = document.getElementById("attendanceYear").value;
    const week = document.getElementById("attendanceWeek").value || "all";

    loadEmployeeAttendance(selectedEmployeeId, month, year, week);
}

function generateWeeks(month, year) {
    const weekSelect = document.getElementById("attendanceWeek");
    weekSelect.innerHTML = `<option value="all">All Weeks</option>`;

    const lastDay = new Date(year, month, 0).getDate();
    let startDate = 1;
    let weekNumber = 1;

    while (startDate <= lastDay) {
        const endDate = Math.min(startDate + 6, lastDay);
        const option = document.createElement("option");
        option.value = weekNumber;
        option.textContent = `Week ${weekNumber} (${startDate} - ${endDate})`;
        weekSelect.appendChild(option);

        startDate = endDate + 1;
        weekNumber++;
    }
}

function updateWeeksAndAttendance() {
    const month = document.getElementById("attendanceMonth").value;
    const year = document.getElementById("attendanceYear").value;

    generateWeeks(month, year);
    filterAttendance();
}

async function loadEmployeeLocation(userId) {
    const empLoc = document.getElementById("empLocation");
    const mapLink = document.getElementById("mapLink");

    try {
        const locRes = await fetch(`/api/attendance/today/${userId}`);
        const locData = await locRes.json();

        if (locData.success && locData.latitude && locData.longitude) {
            const lat = parseFloat(locData.latitude).toFixed(6);
            const lng = parseFloat(locData.longitude).toFixed(6);
            const updatedTime = formatAdminAttendanceTime(
                locData.serverTime || locData.currentTime?.time,
            );

            empLoc.innerHTML = `
                <strong>Live Location:</strong><br>
                Lat: ${lat} | Lng: ${lng}<br>
                <small>Last updated: ${updatedTime} IST</small>
            `;

            mapLink.href = `https://www.google.com/maps?q=${lat},${lng}`;
            mapLink.style.display = "inline-block";
        } else {
            empLoc.innerHTML = `
                <strong>Location:</strong> Not available<br>
                <small>Employee has not checked in today</small>
            `;
            mapLink.style.display = "none";
        }
    } catch (err) {
        console.error("Location Error:", err);
        empLoc.innerHTML = "Location unavailable";
        mapLink.style.display = "none";
    }
}

async function loadDevPerformance(userId) {
    try {
        const res = await fetch(`/api/dev/projects/${userId}`);
        const data = await res.json();

        if (!data.success) throw new Error("Failed to load dev projects");

        document.getElementById("assignedProjects").textContent = data.assigned?.length || 0;
        document.getElementById("ongoingProjects").textContent = data.ongoing?.length || 0;
        document.getElementById("completedProjects").textContent = data.completed?.length || 0;
        updateDevMeterChart(data);
    } catch (err) {
        console.error("Dev Performance Error:", err);
        document.getElementById("assignedProjects").textContent = 0;
        document.getElementById("ongoingProjects").textContent = 0;
        document.getElementById("completedProjects").textContent = 0;
        updateDevMeterChart({ assigned: [], ongoing: [], completed: [] });
    }
}

function updateDevMeterChart(data) {
    const completed = data.completed?.length || 0;
    const ongoing = data.ongoing?.length || 0;
    const assigned = data.assigned?.length || 0;
    const total = completed + ongoing + assigned || 1;

    const completedPct = Math.round((completed / total) * 100);
    const ongoingPct = Math.round((ongoing / total) * 100);
    const assignedPct = Math.round((assigned / total) * 100);

    document.getElementById("devMeter").innerHTML = `
        <div class="meter-segment completed" style="width: ${completedPct}%"><span>${completed} (${completedPct}%)</span></div>
        <div class="meter-segment ongoing" style="width: ${ongoingPct}%"><span>${ongoing} (${ongoingPct}%)</span></div>
        <div class="meter-segment assigned" style="width: ${assignedPct}%"><span>${assigned} (${assignedPct}%)</span></div>
    `;

    document.getElementById("completedLegend").textContent = `${completed} Completed (${completedPct}%)`;
    document.getElementById("ongoingLegend").textContent = `${ongoing} Ongoing (${ongoingPct}%)`;
    document.getElementById("assignedLegend").textContent = `${assigned} Assigned (${assignedPct}%)`;
}

function backToTeam() {
    selectedEmployeeId = null;

    const employeeDetails = document.getElementById("employeeDetails");
    employeeDetails.style.display = "none";
    employeeDetails.classList.remove("active");

    showSection(employeeDetailsReturnSection || "team");
    employeeDetailsReturnSection = "team";
}

let reportChart = null;

async function loadReports() {
    try {
        const [leadsRes, appsRes, dealsRes] = await Promise.all([
            fetch(getAdminPanelScopedApiUrl('/api/leads?role=admin')),
            fetch(getAdminPanelScopedApiUrl('/api/appointments?role=admin')),
            fetch(getAdminPanelScopedApiUrl('/api/deals?role=admin'))
        ]);

        const [leadsData, appsData, dealsData] = await Promise.all([
            leadsRes.json(),
            appsRes.json(),
            dealsRes.json()
        ]);

        const totalLeads = leadsData.success && leadsData.data ? leadsData.data.length : 0;
        const totalAppointments = appsData.success && appsData.data ? appsData.data.length : 0;
        const totalDeals = dealsData.success && dealsData.data ? dealsData.data.length : 0;

        document.getElementById('reportTotalLeads').textContent = totalLeads;
        document.getElementById('reportTotalAppointments').textContent = totalAppointments;
        document.getElementById('reportTotalDeals').textContent = totalDeals;

        const ctx = document.getElementById('reportChart').getContext('2d');
        if (reportChart) reportChart.destroy();
        reportChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Leads', 'Appointments', 'Deals'],
                datasets: [{
                    data: [totalLeads, totalAppointments, totalDeals],
                    backgroundColor: [
                        ADMIN_THEME_COLORS.accent,
                        ADMIN_THEME_COLORS.warning,
                        ADMIN_THEME_COLORS.success,
                    ],
                    borderColor: [
                        ADMIN_THEME_COLORS.white,
                        ADMIN_THEME_COLORS.white,
                        ADMIN_THEME_COLORS.white,
                    ],
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom'
                    }
                }
            }
        });
    } catch (err) {
        console.error('Error loading reports:', err);
    }
}

let teamCache = {};

async function loadProjects() {
    const table = document.getElementById('projectsTable');

    table.innerHTML = `
        <tr>
            <td colspan="10" style="padding:20px;text-align:center;color:#64748b;">
                Loading projects...
            </td>
        </tr>
    `;

    try {
        const res = await fetch(getAdminPanelScopedApiUrl("/api/projects"));
        const result = await res.json();

        if (!result.success || !result.data) {
            throw new Error("Failed to load projects");
        }

        table.innerHTML = '';

        // 🔥 Check if service type has data
        const hasServiceType = (serviceTypeValue) => {
            if (!serviceTypeValue) return false;
            try {
                let parsed = serviceTypeValue;
                if (typeof parsed === 'string') {
                    parsed = JSON.parse(parsed);
                }
                if (typeof parsed === 'string') {
                    parsed = JSON.parse(parsed);
                }
                if (Array.isArray(parsed) && parsed.length > 0) {
                    return true;
                }
                if (parsed && typeof parsed === 'string' && parsed.trim() !== '') {
                    return true;
                }
            } catch (e) {
                return typeof serviceTypeValue === 'string' && serviceTypeValue.trim() !== '';
            }
            return false;
        };

        // 🔥 dropdown function (only for services that exist)
        const getDropdown = async (serviceName, projectId) => {
            try {
                if (!teamCache[serviceName]) {
                    const res = await fetch(`/api/available-team?services=${serviceName}`);
                    const data = await res.json();
                    teamCache[serviceName] = data;
                }

                const data = teamCache[serviceName];

                let options = '<option value="">Select</option>';

                if (data && data.success && data.data && data.data.length > 0) {
                    data.data.forEach(user => {
                        options += `<option value="${user.id}">${user.name}</option>`;
                    });
                } else {
                    options += `<option value="">No match</option>`;
                }

                return `<select onchange="assignProject(${projectId}, this.value, '${serviceName}')">${options}</select>`;
            } catch (err) {
                console.error("Dropdown error:", err);
                return `<select><option>Error</option></select>`;
            }
            console.log("Sending:", { projectId, userId, serviceType });
        };

        for (const project of result.data) {

            // 🔥 ONLY SHOW DROPDOWNS IF SERVICE TYPE EXISTS
            const webDropdown = hasServiceType(project.web_type) ? await getDropdown('web', project.id) : '-';
            const seoDropdown = hasServiceType(project.seo_type) ? await getDropdown('seo', project.id) : '-';
            const smoDropdown = hasServiceType(project.smo_type) ? await getDropdown('smo', project.id) : '-';
            const adsDropdown = project.services && project.services.toLowerCase().includes('ads') ? await getDropdown('ads', project.id) : '-';
            const appDropdown = hasServiceType(project.app_type) ? await getDropdown('app', project.id) : '-';
            const erpDropdown = hasServiceType(project.erp_type) ? await getDropdown('erp', project.id) : '-';

            table.innerHTML += `
                <tr>
                    <td>${project.projectName || '-'}</td>
                    <td>${project.client || '-'}</td>
                    <td>${project.services || 'No services'}</td>
                    <td>${project.status || 'Ongoing'}</td>
                    <td>${webDropdown}</td>
                    <td>${seoDropdown}</td>
                    <td>${smoDropdown}</td>
                    <td>${adsDropdown}</td>
                    <td>${appDropdown}</td>
                    <td>${erpDropdown}</td>
                </tr>
            `;
        }

        if (result.data.length === 0) {
            table.innerHTML = `
                <tr>
                    <td colspan="10" style="padding:40px;text-align:center;color:#64748b;">
                        No projects found.
                    </td>
                </tr>
            `;
        }

    } catch (err) {
        console.error("Load Projects Error:", err);

        table.innerHTML = `
            <tr>
                <td colspan="10" style="color:red; padding:30px;text-align:center;">
                    Error loading projects.
                </td>
            </tr>
        `;
    }
}

async function assignProject(projectId, userId, serviceType) {
    if (!userId) return;

    const res = await fetch('/api/assign-project', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            projectId, 
            userId,
            serviceType   // 🔥 NEW
        })
    });

    const data = await res.json();

    if (data.success) {
        alert(`${serviceType.toUpperCase()} assigned successfully`);
        loadProjects();
    } else {
        alert(data.message);
    }
}

async function updatePaymentStatus(leadId, status, el) {
    try {
        const res = await fetch(`/api/payment-status/${leadId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ pay_stat: status })
        });

        const data = await res.json();

        if (data.success) {
            // 🔥 color update instantly
            if (el) {
                el.classList.remove('pending', 'received', 'failed');
                el.classList.add(status);
            }

            showPopup("Updated", "Payment status updated", true);
            
            // Reload deals to update heatmap counts
            await loadDeals();
            if (Number(currentAdminDealPaymentsLeadId || 0) === Number(leadId || 0)) {
                await loadAdminDealPayments(leadId);
            }
        } else {
            showPopup("Error", data.message, false);
        }

    } catch (err) {
        console.error(err);
        showPopup("Error", "Server error", false);
    }
}

// Logout
function logout() {
    showPopup('Logout', 'You have been logged out successfully.', true);

    setTimeout(() => {
        localStorage.removeItem('currentUser');
        window.location.replace("mp.html");
    }, 1500);
}

async function loadProjectSummary() {
    try {
        const res = await fetch(`${BASE_URL}/api/projects-summary`);
        const result = await res.json();

        const container = document.getElementById('projectSummaryContainer');
        container.innerHTML = '';

        if (!result.success || !result.data || result.data.length === 0) {
            container.innerHTML = `<p>No project assignments found</p>`;
            return;
        }

        result.data.forEach(item => {
            container.innerHTML += `
                <div class="card">
                    <h4>${item.projectName || '-'}</h4>
                    <p><b>Client:</b> ${item.client || '-'}</p>
                    <p><b>Service:</b> ${item.services || '-'}</p>
                    <p><b>Dev:</b> ${item.assigned_dev || '-'}</p>
                    <p><b>Status:</b> ${item.status || '-'}</p>
                    <p><b>Date:</b> ${item.assigned_at || '-'}</p>
                </div>
            `;
        });

    } catch (err) {
        console.error("Project Summary Error:", err);
    }
}







// let dashboardChart = null;

// async function loadDashboard() {
//     try {
//         const [leadsRes, appsRes] = await Promise.all([
//             fetch('/api/leads'),
//             fetch('/api/appointments')
//         ]);

//         const [leadsData, appsData] = await Promise.all([
//             leadsRes.json(),
//             appsRes.json()
//         ]);

//         // Count total leads
//         const totalLeads = leadsData.data ? leadsData.data.length : 0;

//         // Count total appointments
//         const totalAppointments = appsData.data ? appsData.data.length : 0;

//         // Count total deals (lead_status = deal_closed)
//         const totalDeals = leadsData.data
//             ? leadsData.data.filter(l => l.lead_status === "deal_closed").length
//             : 0;

//         // Update dashboard numbers
//         document.getElementById("dashTotalLeads").textContent = totalLeads;
//         document.getElementById("dashTotalAppointments").textContent = totalAppointments;
//         document.getElementById("dashTotalDeals").textContent = totalDeals;

//         // Load chart
//         const ctx = document.getElementById('dashboardChart').getContext('2d');

//         if (dashboardChart) dashboardChart.destroy(); // Prevent duplicates

//         dashboardChart = new Chart(ctx, {
//             type: 'doughnut',
//             data: {
//                 labels: ['Leads', 'Appointments', 'Deals'],
//                 datasets: [{
//                     data: [totalLeads, totalAppointments, totalDeals],
//                     backgroundColor: ['#0f766e', '#eab308', '#22c55e'],
//                     borderColor: ['#ffffff', '#ffffff', '#ffffff'],
//                     borderWidth: 2
//                 }]
//             },
//             options: {
//                 responsive: true,
//                 maintainAspectRatio: false,
//                 plugins: {
//                     legend: { position: 'bottom' }
//                 }
//             }
//         });

//     } catch (e) {
//         console.error("Dashboard Load Error:", e);
//         showPopup("Error", "Failed to load dashboard", false);
//     }
// }





function openUserForm() {
    const modal = document.getElementById("userRegistrationModal");
    const formBox = document.getElementById("userFormBox");

    if (!modal || !formBox) return;

    modal.classList.remove("hidden");
    modal.setAttribute("aria-hidden", "false");
    document.body.classList.add("modal-open");
    formBox.scrollTop = 0;

    const firstField = formBox.querySelector("input, select, textarea, button");
    if (firstField) {
        setTimeout(() => firstField.focus(), 0);
    }
    formBox.style.height = "100vh"; // 👈 only reduced height
    formBox.style.background = "#f8fafc";
    formBox.style.zIndex = "9999";
    formBox.style.overflowY = "auto";

    formBox.style.borderRadius = "16px";
    formBox.style.boxShadow = "-8px 8px 25px rgba(0,0,0,0.15)";
    formBox.style.height = "";
    formBox.style.background = "";
    formBox.style.zIndex = "";
    formBox.style.overflowY = "";
    formBox.style.borderRadius = "";
    formBox.style.boxShadow = "";
}

function getUserFormElement() {
    return document.getElementById("adminRegisterForm");
}

function getUserRegistrationFileLabel(fieldName) {
    const input = getUserFormElement()?.elements?.[fieldName];
    const label = input?.closest(".input-group")?.querySelector("label")?.textContent || fieldName;
    return String(label).replace(/\*/g, "").trim();
}

function getFileExtension(fileName) {
    const normalized = String(fileName || "").trim().toLowerCase();
    const lastDotIndex = normalized.lastIndexOf(".");
    return lastDotIndex >= 0 ? normalized.slice(lastDotIndex) : "";
}

function validateUserRegistrationFiles(form) {
    const fileFields = [
        "prof_img",
        "aadhar_img",
        "pan_img",
        "cancelled_cheque",
        "resume_file",
        "experience_file",
        "certification_file",
    ];

    for (const fieldName of fileFields) {
        const input = form?.elements?.[fieldName];
        const file = input?.files?.[0];
        if (!file) continue;

        if (file.size > USER_REGISTRATION_MAX_FILE_SIZE) {
            return `${getUserRegistrationFileLabel(fieldName)} must be 25 MB or smaller.`;
        }

        const extension = getFileExtension(file.name);
        if (extension && !USER_REGISTRATION_ALLOWED_EXTENSIONS.has(extension)) {
            return `${getUserRegistrationFileLabel(fieldName)} must be JPG, PNG, WEBP, HEIC, PDF, DOC or DOCX.`;
        }
    }

    return "";
}

function setUserHelperText(id, text = "") {
    const helper = document.getElementById(id);
    if (!helper) return;

    helper.textContent = text;
    helper.classList.toggle("hidden", !text);
}

// function setAdminAttendanceFaceStatus(message, type = "neutral") {
//     const status = document.getElementById("adminAttendanceFaceStatus");
//     if (!status) return;

//     status.textContent = message || "";
//     status.dataset.type = type;
// }

// function clearAdminAttendanceFaceCapture(message, type = "neutral") {
//     const form = getUserFormElement();
//     if (form?.elements?.attendance_face_image) {
//         form.elements.attendance_face_image.value = "";
//     }
//     if (form?.elements?.attendance_face_signature) {
//         form.elements.attendance_face_signature.value = "";
//     }

//     setAdminAttendanceFaceStatus(
//         message || "Employee can also complete this from profile setup link.",
//         type,
//     );
// }

// async function captureAdminAttendanceFaceEnrollment() {
//     const button = document.getElementById("adminAttendanceFaceCaptureBtn");
//     const form = getUserFormElement();

//     if (!window.AttendanceFace?.captureEnrollment) {
//         setAdminAttendanceFaceStatus("Camera module is not loaded.", "error");
//         return;
//     }

//     try {
//         if (button) button.disabled = true;
//         setAdminAttendanceFaceStatus("Opening camera...", "neutral");
//         const payload = await window.AttendanceFace.captureEnrollment({
//             title: "Private Attendance Face Setup",
//             actionLabel: "Save Face",
//         });

//         if (!payload?.faceImage || !payload?.faceSignature) {
//             throw new Error("Face capture failed. Please retry.");
//         }

//         if (form?.elements?.attendance_face_image) {
//             form.elements.attendance_face_image.value = payload.faceImage;
//         }
//         if (form?.elements?.attendance_face_signature) {
//             form.elements.attendance_face_signature.value = JSON.stringify(payload.faceSignature);
//         }

//         setAdminAttendanceFaceStatus("Live face photo captured privately.", "success");
//     } catch (err) {
//         setAdminAttendanceFaceStatus(err.message || "Face capture failed. Please retry.", "error");
//     } finally {
//         if (button) button.disabled = false;
//     }
// }

function normalizeUserSkills(value) {
    const parsed = parseMaybeJson(value);

    if (Array.isArray(parsed)) {
        return parsed
            .map((skill) => String(skill || "").toLowerCase().trim())
            .filter(Boolean);
    }

    if (typeof parsed === "string" && parsed.trim()) {
        return [parsed.toLowerCase().trim()];
    }

    return [];
}

function formatUserDateInput(value) {
    if (!value) return "";

    const rawValue = String(value);
    if (/^\d{4}-\d{2}-\d{2}$/.test(rawValue)) {
        return rawValue;
    }

    const date = new Date(rawValue);
    return getAdminDateKey(date);
}

function setUserFieldValue(form, fieldName, value = "") {
    if (!form?.elements?.[fieldName]) return;
    form.elements[fieldName].value = value ?? "";
}

async function populateNextEmployeeCode(form = getUserFormElement()) {
    const employeeCodeField = form?.elements?.employee_code;
    if (!employeeCodeField) return "";

    const companyScope =
        normalizeAdminPanelCompanyKey(form?.elements?.comp_name?.value) ||
        getAdminPanelCompanyScope();
    const query = new URLSearchParams({
        company: companyScope,
        company_scope: companyScope,
    });

    employeeCodeField.value = "Generating...";
    employeeCodeField.placeholder = "";

    try {
        let response = await fetch(`${BASE_URL}/api/users/next-employee-code?${query.toString()}`, {
            cache: "no-store",
        });
        let result = await response.json().catch(() => ({}));

        if (!response.ok || !result.success) {
            response = await fetch(`${BASE_URL}/api/admin/users/next-employee-code?${query.toString()}`, {
                cache: "no-store",
            });
            result = await response.json().catch(() => ({}));
        }

        if (!response.ok || !result.success) {
            throw new Error(result.message || "Failed to generate employee code");
        }

        const employeeCode =
            result.employeeCode ||
            result.data?.employee_code ||
            "";
        employeeCodeField.value = employeeCode;
        employeeCodeField.placeholder = "";
        return employeeCode;
    } catch (error) {
        console.warn("Next employee code load failed:", error);
        employeeCodeField.value = "";
        employeeCodeField.placeholder = "Will generate on save";
        return "";
    }
}

function toggleUserPfFields() {
    const pfEnabled = document.getElementById("userPfEnabled");
    const pfDetails = document.getElementById("userPfDetails");

    if (!pfEnabled || !pfDetails) return;

    pfDetails.classList.toggle("hidden", pfEnabled.value !== "1");
}

function toggleUserCompensationFields() {
    const form = getUserFormElement();
    const role = String(form?.elements?.role?.value || "").toLowerCase().trim();
    const typeField = form?.elements?.compensation_type;
    const typeGroup = document.getElementById("userCompensationTypeGroup");
    const salaryGroup = document.getElementById("userSalaryGroup");
    const commissionGroup = document.getElementById("userCommissionGroup");
    const salaryField = form?.elements?.salary;
    const commissionField = form?.elements?.commission_percent;
    const canUseCommission = SALES_COMPENSATION_ROLES.has(role);
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

function setupUserRegistrationForm() {
    const pfEnabled = document.getElementById("userPfEnabled");
    if (pfEnabled && !pfEnabled.dataset.bound) {
        pfEnabled.addEventListener("change", toggleUserPfFields);
        pfEnabled.dataset.bound = "true";
    }

    const ifscField = getUserFormElement()?.elements?.ifsc_code;
    if (ifscField && !ifscField.dataset.bound) {
        ifscField.addEventListener("input", () => {
            ifscField.value = String(ifscField.value || "").toUpperCase();
        });
        ifscField.dataset.bound = "true";
    }

    const compensationType = getUserFormElement()?.elements?.compensation_type;
    if (compensationType && !compensationType.dataset.bound) {
        compensationType.addEventListener("change", toggleUserCompensationFields);
        compensationType.dataset.bound = "true";
    }

    const roleField = getUserFormElement()?.elements?.role;
    if (roleField && !roleField.dataset.compensationBound) {
        roleField.addEventListener("change", toggleUserCompensationFields);
        roleField.dataset.compensationBound = "true";
    }

    const companyField = getUserFormElement()?.elements?.comp_name;
    if (companyField && !companyField.dataset.employeeCodeBound) {
        companyField.addEventListener("change", () => {
            if (userFormMode === "create") {
                populateNextEmployeeCode();
            }
        });
        companyField.dataset.employeeCodeBound = "true";
    }

    toggleUserPfFields();
    toggleUserCompensationFields();
}

function setUserFormRequiredState(isEditMode, hasExistingAadharImage = false) {
    const form = getUserFormElement();
    const passwordField = form?.elements?.spswd;
    const confirmPasswordField = form?.elements?.cpswd;
    const aadharImageField = form?.elements?.aadhar_img;
    const passwordLabel = document.getElementById("userFormPasswordLabel");
    const confirmPasswordLabel = document.getElementById("userFormConfirmPasswordLabel");

    if (passwordField) passwordField.required = !isEditMode;
    if (confirmPasswordField) confirmPasswordField.required = !isEditMode;
    if (aadharImageField) {
        aadharImageField.required = false;
    }

    if (passwordLabel) {
        passwordLabel.textContent = isEditMode ? "Password" : "Password *";
    }

    if (confirmPasswordLabel) {
        confirmPasswordLabel.textContent = isEditMode
            ? "Confirm Password"
            : "Confirm Password *";
    }

    setUserHelperText(
        "userPasswordHint",
        isEditMode ? "Leave password blank to keep the current password." : "",
    );

    toggleUserPfFields();
}

function applyUserFormMode() {
    const isEditMode = userFormMode === "edit";
    const title = document.getElementById("userRegistrationTitle");
    const subtitle = document.getElementById("userRegistrationSubtitle");
    const submitBtn = document.getElementById("registerBtn");

    if (title) {
        title.textContent = isEditMode ? "Update Team Member" : "User Registration";
    const unlockBtn = document.getElementById("unlockProfileBtn");
    if (unlockBtn) unlockBtn.style.display = isEditMode ? "flex" : "none";
    if (unlockBtn) { unlockBtn.style.alignItems = "center"; unlockBtn.style.justifyContent = "center"; }
    }

    if (subtitle) {
        subtitle.textContent = isEditMode
            ? "Update employee profile, contact and access details"
            : "Create new team members (Admin only)";
    }

    if (submitBtn) {
        submitBtn.innerHTML = isEditMode
            ? '<i class="fas fa-pen-to-square"></i> Update User'
            : '<i class="fas fa-user-plus"></i> Create User';
    }
}

function resetUserFormState() {
    const form = getUserFormElement();
    if (form) {
        form.reset();
        form.dataset.userId = "";
    }

    userFormMode = "create";
    editingUserId = null;
    applyUserFormMode();
    setUserFormRequiredState(false);
    setUserHelperText("userFormProfileHint", "");
    setUserHelperText("userFormAadharHint", "");
    setUserHelperText("userFormPanHint", "");
    setUserHelperText("userFormChequeHint", "");
    setUserHelperText("userFormResumeHint", "");
    setUserHelperText("userFormExperienceHint", "");
    setUserHelperText("userFormCertificationHint", "");
    // clearAdminAttendanceFaceCapture();

    document
        .querySelectorAll('#adminRegisterForm input[name="skills[]"]')
        .forEach((checkbox) => {
            checkbox.checked = false;
        });

    if (form?.elements?.pf_enabled) {
        form.elements.pf_enabled.value = "0";
    }
    if (form?.elements?.compensation_type) {
        form.elements.compensation_type.value = "salary";
    }
    if (form?.elements?.comp_name) {
        form.elements.comp_name.value =
            getAdminPanelCompanyScope() === "redsea"
                ? "RedSea"
                : "Metrics Mart Infoline Pvt Ltd";
    }
    if (form?.elements?.commission_percent) {
        form.elements.commission_percent.value = "";
    }

    toggleUserPfFields();
    toggleUserCompensationFields();
}

function showUserFormModal() {
    const modal = document.getElementById("userRegistrationModal");
    const formBox = document.getElementById("userFormBox");

    if (!modal || !formBox) return;

    modal.classList.remove("hidden");
    modal.setAttribute("aria-hidden", "false");
    document.body.classList.add("modal-open");
    formBox.scrollTop = 0;

    const firstField = formBox.querySelector("input, select, textarea, button");
    if (firstField) {
        setTimeout(() => firstField.focus(), 0);
    }
}

async function openUserForm() {
    resetUserFormState();
    await populateNextEmployeeCode();
    showUserFormModal();
}

async function openUserEditForm(userId) {
    resetUserFormState();
    userFormMode = "edit";
    editingUserId = userId;
    applyUserFormMode();
    showUserFormModal();

    const form = getUserFormElement();
    const submitBtn = document.getElementById("registerBtn");
    const originalText = submitBtn ? submitBtn.innerHTML : "";

    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Loading...';
    }

    try {
        const res = await fetch(`${BASE_URL}/api/admin/users/${userId}`, {
            cache: "no-store",
        });
        const result = await res.json();

        if (!res.ok || !result.success || !result.data) {
            throw new Error(result.message || "Failed to load user details");
        }

        const user = result.data;
        form.dataset.userId = String(userId);
        setUserFieldValue(form, "employee_code", user.employee_code || "");
        setUserFieldValue(form, "name", user.name || "");
        setUserFieldValue(form, "date_of_birth", formatUserDateInput(user.date_of_birth));
        setUserFieldValue(form, "gender", String(user.gender || "").toLowerCase());
        setUserFieldValue(form, "nationality", user.nationality || "Indian");
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
        setUserFieldValue(
            form,
            "salary",
            user.salary != null ? Number(user.salary || 0).toFixed(2) : "",
        );
        setUserFieldValue(form, "compensation_type", user.compensation_type || "salary");
        setUserFieldValue(
            form,
            "commission_percent",
            user.commission_percent != null ? Number(user.commission_percent || 0).toFixed(2) : "",
        );
        setUserFieldValue(form, "joining_date", formatUserDateInput(user.joining_date));
        setUserFieldValue(form, "total_experience", user.total_experience || "");
        setUserFieldValue(form, "pf_enabled", Number(user.pf_enabled || 0) ? "1" : "0");
        setUserFieldValue(form, "pf_number", user.pf_number || "");
        setUserFieldValue(form, "uan_number", user.uan_number || "");
        setUserFieldValue(form, "employee_pf_number", user.employee_pf_number || "");
        setUserFieldValue(form, "employer_pf_number", user.employer_pf_number || "");
        setUserFieldValue(form, "pf_joining_date", formatUserDateInput(user.pf_joining_date));
        setUserFieldValue(form, "comp_name", user.comp_name || "");
        setUserFieldValue(form, "profile_type", user.profile_type || "fresher");
        setUserFieldValue(form, "login_time", user.login_time || "10:00");
        setUserFieldValue(form, "logout_time", user.logout_time || "18:00");
        setUserFieldValue(form, "spswd", "");
        setUserFieldValue(form, "cpswd", "");

        const selectedSkills = new Set(normalizeUserSkills(user.skills));
        document
            .querySelectorAll('#adminRegisterForm input[name="skills[]"]')
            .forEach((checkbox) => {
                checkbox.checked = selectedSkills.has(
                    String(checkbox.value || "").toLowerCase().trim(),
                );
            });

        setUserFormRequiredState(true, Boolean(user.aadhar_img));
        setUserHelperText(
            "userFormProfileHint",
            user.prof_img ? "Upload a new profile image only if you want to replace the current one." : "",
        );
        setUserHelperText(
            "userFormAadharHint",
            user.aadhar_img ? "Existing Aadhar image is saved. Upload a new file only to replace it." : "",
        );
        setUserHelperText(
            "userFormPanHint",
            user.pan_img ? "Existing PAN file is saved. Upload a new file only to replace it." : "",
        );
        setUserHelperText(
            "userFormChequeHint",
            user.cancelled_cheque ? "Existing cancelled cheque is saved. Upload a new file only to replace it." : "",
        );
        setUserHelperText(
            "userFormResumeHint",
            user.resume_file ? "Existing resume is saved. Upload a new file only to replace it." : "",
        );
        setUserHelperText(
            "userFormExperienceHint",
            user.experience_file ? "Existing experience letter is saved. Upload a new file only to replace it." : "",
        );
        setUserHelperText(
            "userFormCertificationHint",
            user.certification_file ? "Existing certification file is saved. Upload a new file only to replace it." : "",
        );
        // clearAdminAttendanceFaceCapture(
        //     user.attendance_face_enrolled
        //         ? "Face setup already saved. Capture again only to replace it."
        //         : "No face setup saved yet. Employee can also complete it from profile setup link.",
        //     user.attendance_face_enrolled ? "success" : "neutral",
        // );
        toggleUserPfFields();
        toggleUserCompensationFields();
    } catch (err) {
        console.error("Edit user load error:", err);
        showPopup("Error", err.message || "Unable to load user details", false);
        closeUserForm();
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalText || '<i class="fas fa-pen-to-square"></i> Update User';
        }
    }
}

function setupAdminLeadForm() {
    const addLeadBtn = document.getElementById("adminAddLeadBtn");
    const form = document.getElementById("adminLeadForm");
    const actionType = document.getElementById("adminLeadActionType");
    const appDate = document.getElementById("adminLeadAppDate");
    const appTime = document.getElementById("adminLeadAppTime");
    const employeeSelect = document.getElementById("adminLeadAssignEmp");

    if (addLeadBtn && !addLeadBtn.dataset.bound) {
        addLeadBtn.addEventListener("click", openAdminLeadForm);
        addLeadBtn.dataset.bound = "true";
    }

    if (form && !form.dataset.bound) {
        form.addEventListener("submit", handleAdminLeadFormSubmit);
        form.dataset.bound = "true";
    }

    if (actionType && !actionType.dataset.bound) {
        actionType.addEventListener("change", toggleAdminLeadActionSections);
        actionType.dataset.bound = "true";
    }

    [appDate, appTime].forEach((field) => {
        if (!field || field.dataset.bound) return;
        field.addEventListener("change", () => loadAdminLeadEmployees());
        field.dataset.bound = "true";
    });

    if (employeeSelect && !employeeSelect.dataset.companyScopeBound) {
        employeeSelect.addEventListener("change", () => {
            setAdminLeadCompanyScopeFromSelectedEmployee(employeeSelect);
        });
        employeeSelect.dataset.companyScopeBound = "true";
    }

    bindAdminLeadOtherInputs();
    toggleAdminLeadActionSections();
}

function normalizeAdminLeadCompanyScope(value) {
    const normalized = String(value || "")
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "");

    if (
        normalized === "redsea" ||
        normalized === "redseadigitals" ||
        normalized === "redseadigitalspvtltd"
    ) return "redsea";
    if (
        normalized === "metrics" ||
        normalized === "metricsmart" ||
        normalized === "metricsmartinfolinepvtltd"
    ) {
        return "metrics";
    }

    return "";
}

function getDefaultAdminLeadCompanyScope() {
    return (
        normalizeAdminLeadCompanyScope(
            currentUser?.company_key ||
                currentUser?.selected_company ||
                currentUser?.comp_name,
        ) || "metrics"
    );
}

function setAdminLeadCompanyScope(value = "") {
    const field = document.querySelector('#adminLeadForm [name="company_scope"]');
    if (field) {
        field.value = normalizeAdminLeadCompanyScope(value) || getDefaultAdminLeadCompanyScope();
    }
}

function getAdminLeadOtherInput(name) {
    return document.querySelector(`#adminLeadForm [name="${name}_other"]`);
}

function updateAdminLeadOtherInput(name) {
    const select = document.querySelector(`#adminLeadForm [name="${name}"]`);
    const input = getAdminLeadOtherInput(name);
    if (!select || !input) return;

    const shouldShow = select.value === "other";
    input.classList.toggle("hidden", !shouldShow);
    input.required = shouldShow;
    input.disabled = !shouldShow;
    if (!shouldShow) input.value = "";
}

function bindAdminLeadOtherInputs() {
    ["source_lead", "industry_type"].forEach((name) => {
        const select = document.querySelector(`#adminLeadForm [name="${name}"]`);
        if (!select || select.dataset.otherBound) return;
        select.addEventListener("change", () => updateAdminLeadOtherInput(name));
        select.dataset.otherBound = "true";
        updateAdminLeadOtherInput(name);
    });
}

function getAdminLeadOtherAwareFormValue(formData, name) {
    const selected = String(formData.get(name) || "").trim();
    if (selected !== "other") return selected;

    return String(formData.get(`${name}_other`) || "").trim() || selected;
}

function getAdminLeadEmployeeCompanyScope(employee = {}) {
    return normalizeAdminLeadCompanyScope(
        employee.company_scope ||
            employee.companyScope ||
            employee.company_key ||
            employee.companyKey ||
            employee.selected_company ||
            employee.comp_name ||
            employee.compName,
    );
}

function normalizeAdminLeadProductMatchValue(value) {
    return String(value || "")
        .toLowerCase()
        .trim()
        .replace(/&/g, "and")
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "");
}

function getAdminLeadProductFieldName(groupName = "") {
    const group = normalizeAdminLeadProductMatchValue(groupName);

    // New dropdown values / standard groups
    if (group === "design_and_development" || group === "web_design_and_development" || group === "website_development_services") return "web_type[]";
    if (group === "seo_services" || group === "seo") return "seo_type[]";
    if (group === "smo_services" || group === "smo" || group === "advertising_services") return "smo_type[]";
    if (group === "application" || group === "app_development") return "app_type[]";
    if (group === "erp_crm_software" || group === "erp_software") return "erp_type[]";

    return "services[]";
}

function getAdminLeadProductAliases(product = {}) {
    const name = String(product.name || "").trim();
    const group = normalizeAdminLeadProductMatchValue(product.group);
    const normalizedName = normalizeAdminLeadProductMatchValue(name);
    const aliases = new Set([name, normalizedName].filter(Boolean));

    const addAlias = (value) => {
        const normalized = normalizeAdminLeadProductMatchValue(value);
        if (normalized) aliases.add(normalized);
    };

    if (group === "web_design_and_development") {
        if (normalizedName.includes("landing")) addAlias("landing");
        if (normalizedName.includes("static")) addAlias("static");
        if (normalizedName.includes("dynamic")) addAlias("dynamic");
        if (
            normalizedName.includes("ecommerce") ||
            normalizedName.includes("e_commerce")
        ) {
            addAlias("ecommerce");
        }
    }

    if (group === "seo") {
        if (normalizedName.includes("gmb")) addAlias("gmb");
        if (normalizedName.includes("website") || normalizedName.includes("web")) {
            addAlias("web");
        }
    }

    if (group === "smo") {
        if (normalizedName.includes("facebook") || normalizedName.includes("meta")) {
            addAlias("facebook");
        }
        if (normalizedName.includes("instagram") || normalizedName.includes("meta")) {
            addAlias("instagram");
        }
        if (normalizedName.includes("linkedin")) addAlias("linkedin");
        if (normalizedName.includes("twitter") || normalizedName.includes("x_")) {
            addAlias("twitter");
        }
    }

    if (group === "google_ads" || normalizedName.includes("google_ads")) {
        addAlias("ads");
        addAlias("google_ads");
        if (normalizedName.includes("profile")) addAlias("google_profile");
    }

    if (group === "application") {
        if (normalizedName.includes("android")) addAlias("android");
        if (normalizedName.includes("ios")) addAlias("ios");
    }

    if (group === "erp_crm_software") {
        ["react", "next", "php", "node"].forEach((keyword) => {
            if (normalizedName.includes(keyword)) addAlias(keyword);
        });
    }

    return Array.from(aliases)
        .map((alias) => normalizeAdminLeadProductMatchValue(alias))
        .filter(Boolean);
}

async function fetchAdminLeadProductCatalog(forceRefresh = false) {
    if (Array.isArray(adminLeadProductsCatalog) && !forceRefresh) {
        return adminLeadProductsCatalog;
    }

    const res = await fetch(`${BASE_URL}/api/deal-products`, {
        cache: "no-store",
    });
    const result = await res.json();

    if (!res.ok || !result.success) {
        throw new Error(result.message || "Unable to load active products");
    }

    adminLeadProductsCatalog = Array.isArray(result.data) ? result.data : [];
    return adminLeadProductsCatalog;
}

async function renderAdminLeadProductCatalog(forceRefresh = false) {
    const container = document.getElementById("adminLeadProductCatalog");
    if (!container) return;

    container.innerHTML = `<div class="lead-products-empty">Loading active products...</div>`;

    try {
        const catalog = await fetchAdminLeadProductCatalog(forceRefresh);
        const groups = catalog.reduce((accumulator, product) => {
            const groupName = product.group || "Other Services";
            if (!accumulator[groupName]) accumulator[groupName] = [];
            accumulator[groupName].push(product);
            return accumulator;
        }, {});

        if (!Object.keys(groups).length) {
            container.innerHTML = `
                <div class="lead-products-empty">
                    No active products found. Please add active products from Admin panel.
                </div>
            `;
            return;
        }

        container.innerHTML = Object.entries(groups)
            .map(
                ([groupName, products]) => `
                    <div class="lead-product-group">
                        <h4>${escapeAdminHtml(groupName)}</h4>
                        <div class="checkbox-group">
                            ${products
                                .map((product) => {
                                    const fieldName = getAdminLeadProductFieldName(groupName);
                                    const aliases = getAdminLeadProductAliases(product).join("|");
                                    return `
                                        <label>
                                            <input
                                                type="checkbox"
                                                name="${fieldName}"
                                                value="${escapeAdminHtml(product.name)}"
                                                data-product-aliases="${escapeAdminHtml(aliases)}"
                                            >
                                            ${escapeAdminHtml(product.name)}
                                        </label>
                                    `;
                                })
                                .join("")}
                        </div>
                    </div>
                `,
            )
            .join("");
    } catch (err) {
        console.error("Admin lead products load error:", err);
        container.innerHTML = `
            <div class="lead-products-empty error">
                ${escapeAdminHtml(err.message || "Unable to load active products.")}
            </div>
        `;
    }
}

async function openAdminLeadForm() {
    const modal = document.getElementById("adminLeadModal");
    const form = document.getElementById("adminLeadForm");

    if (!modal || !form) return;

    resetAdminLeadFormState();
    setAdminLeadCompanyScope();
    modal.classList.remove("hidden");
    modal.setAttribute("aria-hidden", "false");
    document.body.classList.add("modal-open");
    form.scrollTop = 0;
    generateAdminLeadMapLink();
    await renderAdminLeadProductCatalog(true);
    loadAdminLeadEmployees();

    const firstField = form.querySelector("input, select, textarea, button");
    if (firstField) {
        setTimeout(() => firstField.focus(), 0);
    }
}

function closeAdminLeadForm() {
    const modal = document.getElementById("adminLeadModal");
    if (!modal) return;

    if (modal.contains(document.activeElement)) {
        document.activeElement.blur();
        document.getElementById("adminAddLeadBtn")?.focus({ preventScroll: true });
    }
    modal.classList.add("hidden");
    modal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("modal-open");
    resetAdminLeadFormState();
}

function handleAdminLeadModalBackdrop(event) {
    if (event.target?.id === "adminLeadModal") {
        closeAdminLeadForm();
    }
}

function setAdminLeadSectionVisibility(section, shouldShow) {
    if (!section) return;
    section.classList.toggle("hidden", !shouldShow);
    section.setAttribute("aria-hidden", shouldShow ? "false" : "true");
}

function toggleAdminLeadActionSections() {
    const actionType =
        document.getElementById("adminLeadActionType")?.value || "lead";
    const appointmentSection = document.getElementById("adminLeadAppointmentSection");
    const followupSection = document.getElementById("adminLeadFollowupSection");
    const appointmentFields = [
        document.getElementById("adminLeadAppDate"),
        document.getElementById("adminLeadAppTime"),
        document.getElementById("adminLeadAssignEmp"),
    ];
    const followupFields = [
        document.getElementById("adminLeadFollowDate"),
        document.getElementById("adminLeadFollowTime"),
        document.getElementById("adminLeadReason"),
    ];

    const isAppointment = actionType === "appointment";
    const isFollowup = actionType === "followup";

    setAdminLeadSectionVisibility(appointmentSection, isAppointment);
    setAdminLeadSectionVisibility(followupSection, isFollowup);

    appointmentFields.forEach((field) => {
        if (field) field.required = isAppointment;
    });

    followupFields.forEach((field) => {
        if (field) field.required = isFollowup;
    });

    if (isAppointment) {
        const locationField = document.getElementById("adminLeadLocation");
        const mapsField = document.getElementById("adminLeadMapsLink");
        if (locationField && mapsField && !locationField.value) {
            locationField.value = mapsField.value || "";
        }
        loadAdminLeadEmployees();
    }
}

function resetAdminLeadFormState() {
    const form = document.getElementById("adminLeadForm");
    const actionType = document.getElementById("adminLeadActionType");
    const employeeSelect = document.getElementById("adminLeadAssignEmp");
    const submitBtn = document.getElementById("adminLeadSubmitBtn");

    adminLeadSubmitting = false;

    if (form) {
        form.reset();
        setAdminLeadCompanyScope();
    }

    bindAdminLeadOtherInputs();

    if (employeeSelect) {
        employeeSelect.innerHTML = '<option value="">Select Employee</option>';
    }

    if (actionType) {
        actionType.value = "lead";
    }

    if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = "Add Client";
    }

    toggleAdminLeadActionSections();
}

function populateAdminLeadEmployeeSelect(select, employees, emptyLabel) {
    if (!select) return;

    select.innerHTML = '<option value="">Select Employee</option>';

    if (!employees.length) {
        const option = document.createElement("option");
        option.value = "";
        option.textContent = emptyLabel;
        select.appendChild(option);
        return;
    }

    employees.forEach((employee) => {
        const employeeName = employee.name || "Unnamed Employee";
        const employeeCompanyScope = getAdminLeadEmployeeCompanyScope(employee);
        const isUnavailable =
            employee.is_available === false ||
            employee.isAvailable === false ||
            employee.availability_status === "unavailable";
        const companyLabel =
            employeeCompanyScope === "redsea"
                ? "Red Sea"
                : employeeCompanyScope === "metrics"
                    ? "Metrics"
                    : "";
        const labelParts = [employeeName];
        if (companyLabel) labelParts.push(`(${companyLabel})`);
        if (isUnavailable) labelParts.push("- Unavailable");
        const option = document.createElement("option");
        option.value = employee.name || "";
        option.textContent = labelParts.join(" ");
        option.disabled = isUnavailable;
        option.dataset.employeeId =
            employee.id != null ? String(employee.id) : "";
        option.dataset.employeeContact = employee.contact
            ? String(employee.contact)
            : "";
        option.dataset.employeeCompanyScope = employeeCompanyScope;
        select.appendChild(option);
    });
}

function getSelectedAdminLeadEmployeeMeta(selectOrId) {
    const select =
        typeof selectOrId === "string"
            ? document.getElementById(selectOrId)
            : selectOrId;

    if (!select) {
        return {
            name: "",
            id: "",
            contact: "",
            companyScope: "",
        };
    }

    const option = select.options[select.selectedIndex];

    return {
        name: select.value || "",
        id: option?.dataset?.employeeId || "",
        contact: option?.dataset?.employeeContact || "",
        companyScope: option?.dataset?.employeeCompanyScope || "",
    };
}

function setAdminLeadCompanyScopeFromSelectedEmployee(selectOrId) {
    const selectedEmployee = getSelectedAdminLeadEmployeeMeta(selectOrId);
    if (selectedEmployee.companyScope) {
        setAdminLeadCompanyScope(selectedEmployee.companyScope);
    }
}

async function fetchAdminLeadEmployeeList(date, time) {
    const endpoint =
        date && time
            ? `${BASE_URL}/api/available-employees?date=${encodeURIComponent(date)}&time=${encodeURIComponent(time)}`
            : `${BASE_URL}/api/me-employees`;

    const res = await fetch(endpoint, {
        cache: "no-store",
    });
    return await res.json();
}

async function loadAdminLeadEmployees() {
    const select = document.getElementById("adminLeadAssignEmp");
    const date = document.getElementById("adminLeadAppDate")?.value || "";
    const time = document.getElementById("adminLeadAppTime")?.value || "";

    if (!select) return;

    try {
        const result = await fetchAdminLeadEmployeeList(date, time);

        if (!result.success) {
            throw new Error(result.message || "Failed to load employees");
        }

        populateAdminLeadEmployeeSelect(
            select,
            result.data || [],
            date && time
                ? "No employee available at this time"
                : "No employees found",
        );
    } catch (err) {
        console.error("Admin employee load error:", err);
        populateAdminLeadEmployeeSelect(select, [], "Unable to load employees");
    }
}

function generateAdminLeadMapLink() {
    const form = document.getElementById("adminLeadForm");
    const mapsField = document.getElementById("adminLeadMapsLink");
    const locationField = document.getElementById("adminLeadLocation");

    if (!form || !mapsField) return;

    const addressParts = [
        form.elements.flat_no?.value || "",
        form.elements.building_name?.value || "",
        form.elements.locality?.value || "",
        form.elements.city?.value || "",
        form.elements.pincode?.value || "",
        form.elements.state?.value || "",
    ]
        .map((part) => String(part).trim())
        .filter(Boolean);

    const fullAddress = addressParts.join(", ");
    const previousGeneratedLink = mapsField.dataset.generatedLink || "";
    const nextLink = fullAddress
        ? `https://www.google.com/maps?q=${encodeURIComponent(fullAddress)}`
        : "";

    mapsField.value = nextLink;
    mapsField.dataset.generatedLink = nextLink;

    if (
        locationField &&
        (!locationField.value || locationField.value === previousGeneratedLink)
    ) {
        locationField.value = nextLink;
    }
}

async function handleAdminLeadFormSubmit(event) {
    event.preventDefault();

    if (adminLeadSubmitting) return;

    const formElement = event.currentTarget;
    const formData = new FormData(formElement);
    const actionTypeValue =
        document.getElementById("adminLeadActionType")?.value || "lead";
    const selectedEmployee = getSelectedAdminLeadEmployeeMeta("adminLeadAssignEmp");
    const submitBtn =
        document.getElementById("adminLeadSubmitBtn") ||
        formElement.querySelector(".submit-btn");
    const originalText = submitBtn ? submitBtn.innerHTML : "";
    const mapsLink = document.getElementById("adminLeadMapsLink")?.value || "";
    const locationValue = formData.get("location") || mapsLink || "";
    const currentUserId = hydrateCurrentUserIdentity();

    const data = {
        company: formData.get("company"),
        client: formData.get("client"),
        contact: formData.get("contact"),
        alt_contact: formData.get("alt_contact"),
        telephone: formData.get("telephone"),
        email: formData.get("email"),
        gst_no: formData.get("gst_no"),
        flat_no: formData.get("flat_no"),
        building_name: formData.get("building_name"),
        locality: formData.get("locality"),
        city: formData.get("city"),
        pincode: formData.get("pincode"),
        state: formData.get("state"),
        maps_lnk: mapsLink,
        sales_type: formData.get("sales_type") || "new",
        source_lead: getAdminLeadOtherAwareFormValue(formData, "source_lead"),
        industry_type: getAdminLeadOtherAwareFormValue(formData, "industry_type"),
        web_type: formData.getAll("web_type[]"),
        seo_type: formData.getAll("seo_type[]"),
        smo_type: formData.getAll("smo_type[]"),
        app_type: formData.getAll("app_type[]"),
        erp_type: formData.getAll("erp_type[]"),
        services: formData.getAll("services[]"),
        service_notes: formData.get("service_notes"),
        actionType: actionTypeValue,
        app_date: actionTypeValue === "appointment" ? formData.get("app_date") : null,
        app_time: actionTypeValue === "appointment" ? formData.get("app_time") : null,
        assign_emp: actionTypeValue === "appointment" ? selectedEmployee.name : null,
        assign_emp_id: actionTypeValue === "appointment" ? selectedEmployee.id : null,
        assign_emp_contact:
            actionTypeValue === "appointment" ? selectedEmployee.contact : null,
        location: actionTypeValue === "appointment" ? locationValue : null,
        follow_date:
            actionTypeValue === "followup" ? formData.get("follow_date") : null,
        follow_time:
            actionTypeValue === "followup" ? formData.get("follow_time") : null,
        reason: actionTypeValue === "followup" ? formData.get("reason") : null,
        additional_notes: formData.get("additional_notes"),
        created_by: currentUserId || null,
        user_id: currentUserId || null,
        created_by_name: currentUser?.name || "",
        company_scope: getDefaultAdminLeadCompanyScope(),
        notify_whatsapp: false,
    };

    adminLeadSubmitting = true;

    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = "Saving...";
    }

    try {
        const res = await fetch(`${BASE_URL}/api/leads`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(data),
        });
        const result = await res.json();

        if (!res.ok || !result.success) {
            const errorDetails = result.error ? ` (${result.error})` : "";
            throw new Error(`${result.message || "Failed to save client"}${errorDetails}`);
        }

        closeAdminLeadForm();
        showPopup("Success", "Client added successfully", true);
        loadLeads();
        loadAppointments();
        loadFollowups();
    } catch (err) {
        console.error("Admin lead save error:", err);
        showPopup("Error", err.message || "Failed to save client", false);
    } finally {
        adminLeadSubmitting = false;

        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalText || "Add Client";
        }
    }
}


function closeUserForm() {
    const modal = document.getElementById("userRegistrationModal");
    if (!modal) return;

    modal.classList.add("hidden");
    modal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("modal-open");
    resetUserFormState();
}

function handleUserModalBackdrop(event) {
    if (event.target?.id === "userRegistrationModal") {
        closeUserForm();
    }
}



// function openUserForm() {
//     document.getElementById("userBtnBox").style.display = "none";
//     document.getElementById("userFormBox").style.display = "block";
// }

// function closeUserForm() {
//     document.getElementById("userBtnBox").style.display = "block";
//     document.getElementById("userFormBox").style.display = "none";
// }

function parseMaybeJson(value) {
    let parsed = value;

    while (typeof parsed === "string") {
        const trimmed = parsed.trim();

        if (!trimmed) return "";

        try {
            parsed = JSON.parse(trimmed);
        } catch {
            return trimmed.toLowerCase();
        }
    }

    return parsed;
}

function hasStructuredValue(value) {
    const parsed = parseMaybeJson(value);

    if (Array.isArray(parsed)) return parsed.length > 0;
    if (typeof parsed === "string") return parsed.trim() !== "";

    return Boolean(parsed);
}

function getServicesText(project) {
    const parsed = parseMaybeJson(project.services);
    const notesText = String(project.service_notes || "").toLowerCase();

    if (Array.isArray(parsed)) {
        return [parsed.map(item => String(item).toLowerCase()).join(", "), notesText]
            .filter(Boolean)
            .join(", ");
    }

    return [
        typeof parsed === "string" ? parsed.toLowerCase() : "",
        notesText,
    ]
        .filter(Boolean)
        .join(", ");
}

function projectHasService(project, serviceName) {
    const fieldMap = {
        web: "web_type",
        seo: "seo_type",
        smo: "smo_type",
        app: "app_type",
        erp: "erp_type",
    };

    const aliases = {
        web: ["web", "website"],
        seo: ["seo", "google_profile", "google profile", "profile creation"],
        smo: ["smo", "social media"],
        ads: ["ads", "google ads"],
        app: ["app"],
        erp: ["erp", "crm"],
    };

    const fieldName = fieldMap[serviceName];

    if (fieldName && hasStructuredValue(project[fieldName])) {
        return true;
    }

    const servicesText = getServicesText(project);
    return (aliases[serviceName] || []).some(alias => servicesText.includes(alias));
}

async function loadProjects() {
    const table = document.getElementById("projectsTable");
    if (!table) return;
    teamCache = {};

    table.innerHTML = `
        <tr>
            <td colspan="10" style="padding:20px;text-align:center;color:#64748b;">
                Loading projects...
            </td>
        </tr>
    `;

    try {
        const res = await fetch(getAdminPanelScopedApiUrl("/api/projects"));
        const result = await res.json();

        if (!result.success || !result.data) {
            throw new Error("Failed to load projects");
        }

        table.innerHTML = "";

        const getDropdown = async (serviceName, projectId) => {
            try {
                if (!teamCache[serviceName]) {
                    const serviceQuery = encodeURIComponent(serviceName);
                    const res = await fetch(
                        getAdminPanelScopedApiUrl(`/api/available-team?service=${serviceQuery}&services=${serviceQuery}`)
                    );
                    teamCache[serviceName] = await res.json();
                }

                const data = teamCache[serviceName];
                let options = `<option value="">Select</option>`;

                if (data && data.success && data.data && data.data.length > 0) {
                    data.data.forEach(user => {
                        options += `<option value="${user.id}">${user.name}</option>`;
                    });
                } else {
                    options += `<option value="">No Team Found</option>`;
                }

                return `
                    <select onchange="assignProject(${projectId}, this.value, '${serviceName}')">
                        ${options}
                    </select>
                `;
            } catch (err) {
                console.error("Dropdown Error:", err);
                return `<select><option>Error</option></select>`;
            }
        };

        const scopedProjects = filterAdminRowsByCompanyScope(result.data);
        const uniqueProjects = Array.from(
            new Map(scopedProjects.map(project => [project.id, project])).values()
        );

        adminDashboardCache.projects = uniqueProjects;
        adminDashboardState.projects = uniqueProjects;
        renderAdminDashboard();

        for (const project of uniqueProjects) {
            const webDropdown = projectHasService(project, "web") ? await getDropdown("web", project.id) : "-";
            const seoDropdown = projectHasService(project, "seo") ? await getDropdown("seo", project.id) : "-";
            const smoDropdown = projectHasService(project, "smo") ? await getDropdown("smo", project.id) : "-";
            const adsDropdown = projectHasService(project, "ads") ? await getDropdown("ads", project.id) : "-";
            const appDropdown = projectHasService(project, "app") ? await getDropdown("app", project.id) : "-";
            const erpDropdown = projectHasService(project, "erp") ? await getDropdown("erp", project.id) : "-";
            const parsedServices = parseMaybeJson(project.services);

            table.innerHTML += `
                <tr>
                    <td>${project.projectName || "-"}</td>
                    <td>${project.client || "-"}</td>
                    <td>${
                        Array.isArray(parsedServices)
                            ? parsedServices.join(", ")
                            : project.services || "No services"
                    }</td>
                    <td>${project.status || "Ongoing"}</td>
                    <td>${webDropdown}</td>
                    <td>${seoDropdown}</td>
                    <td>${smoDropdown}</td>
                    <td>${adsDropdown}</td>
                    <td>${appDropdown}</td>
                    <td>${erpDropdown}</td>
                </tr>
            `;
        }

        if (uniqueProjects.length === 0) {
            table.innerHTML = `
                <tr>
                    <td colspan="10" style="padding:40px;text-align:center;color:#64748b;">
                        No projects found.
                    </td>
                </tr>
            `;
        }
    } catch (err) {
        console.error("Load Projects Error:", err);

        table.innerHTML = `
            <tr>
                <td colspan="10" style="color:red; padding:30px;text-align:center;">
                    Error loading projects.
                </td>
            </tr>
        `;
    }
}

async function assignProject(projectId, userId, serviceType) {
    if (!userId) return;

    const res = await fetch(`${BASE_URL}/api/assign-project`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            projectId,
            userId,
            serviceType,
        }),
    });

    const data = await res.json();

    if (data.success) {
        alert(`${serviceType.toUpperCase()} assigned successfully`);
        await Promise.all([loadProjects(), loadProjectSummary(), loadAdminProjectTracker()]);
    } else {
        alert(data.message);
    }
}

async function loadProjectSummary() {
    try {
        const res = await fetch(getAdminPanelScopedApiUrl("/api/projects-summary"), {
            cache: "no-store",
        });
        const result = await res.json();

        const container = document.getElementById("projectSummaryContainer");
        if (!container) return;
        container.innerHTML = "";

        const scopedProjects = filterAdminRowsByCompanyScope(result.data);

        if (!result.success || scopedProjects.length === 0) {
            container.innerHTML = `<div class="summary-empty-state">No project assignments found</div>`;
            return;
        }

        scopedProjects.forEach(item => {
            container.innerHTML += `
                <div class="summary-project-card">
                    <div class="summary-project-meta">
                        <div class="summary-card-top">
                            <div>
                                <h4>${item.projectName || "-"}</h4>
                                <p class="summary-client">Client: ${item.client || "-"}</p>
                            </div>
                            <span class="summary-status-badge ${String(item.status || "unassigned").toLowerCase()}">
                                ${formatProjectSummaryStatus(item.status)}
                            </span>
                        </div>

                        <p class="summary-date">
                            <i class="fas fa-calendar-alt"></i>
                            ${formatProjectSummaryDate(item.assigned_at)}
                        </p>
                    </div>

                    <div class="summary-services-block">
                        <p class="summary-label">Services</p>
                        ${renderProjectSummaryServices(item.services)}
                    </div>
                </div>
            `;
        });
    } catch (err) {
        console.error("Project Summary Error:", err);
    }
}

function formatProjectSummaryStatus(status) {
    const normalized = String(status || "unassigned").trim().toLowerCase();

    if (!normalized) return "Unassigned";

    return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function formatProjectSummaryDate(value) {
    if (!value) return "-";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return value;
    }

    return date.toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
}

function renderProjectSummaryServices(services = []) {
    if (!Array.isArray(services) || services.length === 0) {
        return `<div class="summary-service-empty">No services available</div>`;
    }

    return `
        <div class="summary-service-grid">
            ${services
                .map(service => {
                    const count = Number(service.assigned_count || 0);
                    const assignees = Array.isArray(service.assignees)
                        ? service.assignees
                        : [];

                    return `
                        <div class="summary-service-item" data-service-key="${service.key || ""}">
                            <button
                                type="button"
                                class="summary-service-btn"
                                data-service-key="${service.key || ""}"
                                aria-expanded="false"
                            >
                                <span>${service.label || "-"}</span>
                                <span class="summary-service-count">${count}</span>
                            </button>

                            <div class="summary-service-dropdown">
                                <div class="summary-dropdown-title">
                                    ${service.label || "-"} Assigned Team
                                </div>
                                ${
                                    assignees.length
                                        ? `<ul class="summary-assignee-list">
                                            ${assignees
                                                .map(
                                                    assignee => `
                                                        <li class="summary-assignee-item">
                                                            <span class="summary-assignee-name">${assignee.name || "Unassigned"}</span>
                                                            <span class="summary-assignee-role">${String(assignee.role || "").toUpperCase() || "TEAM"}</span>
                                                        </li>
                                                    `
                                                )
                                                .join("")}
                                        </ul>`
                                        : `<div class="summary-service-empty">No one assigned yet</div>`
                                }
                            </div>
                        </div>
                    `;
                })
                .join("")}
        </div>
    `;
}

function closeProjectSummaryDropdowns(exceptItem = null) {
    document.querySelectorAll(".summary-service-item.is-open").forEach(item => {
        if (exceptItem && item === exceptItem) return;

        item.classList.remove("is-open");
        const btn = item.querySelector(".summary-service-btn");
        if (btn) {
            btn.setAttribute("aria-expanded", "false");
        }
    });

    document.querySelectorAll(".summary-project-card").forEach(card => {
        const hasOpenDropdown = card.querySelector(".summary-service-item.is-open");
        card.classList.toggle("has-open-dropdown", Boolean(hasOpenDropdown));
    });
}

document.addEventListener("click", event => {
    const serviceButton = event.target.closest(".summary-service-btn");

    if (serviceButton) {
        const serviceItem = serviceButton.closest(".summary-service-item");
        if (!serviceItem) return;

        const shouldOpen = !serviceItem.classList.contains("is-open");
        closeProjectSummaryDropdowns(serviceItem);
        serviceItem.classList.toggle("is-open", shouldOpen);
        serviceButton.setAttribute("aria-expanded", shouldOpen ? "true" : "false");

        const projectCard = serviceItem.closest(".summary-project-card");
        if (projectCard) {
            projectCard.classList.toggle("has-open-dropdown", shouldOpen);
        }
        return;
    }

    if (event.target.closest(".summary-service-dropdown")) {
        return;
    }

    closeProjectSummaryDropdowns();
});

document.addEventListener("keydown", event => {
    if (event.key !== "Escape") return;

    const adminLeadDetailsModal = document.getElementById("adminLeadDetailsModal");
    if (adminLeadDetailsModal && !adminLeadDetailsModal.classList.contains("hidden")) {
        closeAdminLeadDetailsModal();
        return;
    }

    const adminLeadModal = document.getElementById("adminLeadModal");
    if (adminLeadModal && !adminLeadModal.classList.contains("hidden")) {
        closeAdminLeadForm();
        return;
    }

    const modal = document.getElementById("userRegistrationModal");
    if (modal && !modal.classList.contains("hidden")) {
        closeUserForm();
    }
});

const adminRegisterForm = document.getElementById("adminRegisterForm");
// const adminAttendanceFaceCaptureBtn = document.getElementById("adminAttendanceFaceCaptureBtn");

// if (adminAttendanceFaceCaptureBtn) {
//     adminAttendanceFaceCaptureBtn.addEventListener("click", captureAdminAttendanceFaceEnrollment);
// }

if (adminRegisterForm) {
    adminRegisterForm.addEventListener("submit", async function (e) {
        e.preventDefault();

        const isEditMode = userFormMode === "edit" && Boolean(editingUserId);
        const btn = document.getElementById("registerBtn") || this.querySelector(".submit-btn");
        const originalText = btn ? btn.innerHTML : "";
        const employeeCodeField = this.elements?.employee_code;

        if (!isEditMode) {
            const currentEmployeeCode = String(employeeCodeField?.value || "").trim();

            if (!/^EMP\d+$/i.test(currentEmployeeCode)) {
                if (btn) {
                    btn.innerHTML = "Generating Code...";
                    btn.disabled = true;
                }

                const generatedEmployeeCode = await populateNextEmployeeCode(this);

                if (!/^EMP\d+$/i.test(String(generatedEmployeeCode || "").trim())) {
                    if (btn) {
                        btn.innerHTML = originalText;
                        btn.disabled = false;
                    }
                    showPopup("Error", "Employee code generate nahi ho paaya. Please retry.", false);
                    return;
                }
            }
        }

        const formData = new FormData(this);
        if (currentUser?.id) {
            formData.set("updated_by", String(currentUser.id));
            formData.set("created_by", String(currentUser.id));
        }

        const password = String(formData.get("spswd") || "");
        const confirmPassword = String(formData.get("cpswd") || "");

        if (password || confirmPassword) {
            if (password !== confirmPassword) {
                showPopup("Error", "Passwords do not match", false);
                return;
            }
        }

        const fileValidationMessage = validateUserRegistrationFiles(this);
        if (fileValidationMessage) {
            showPopup("Error", fileValidationMessage, false);
            return;
        }

        const role = String(formData.get("role") || "").toLowerCase();
        const canUseSalesCompensation = SALES_COMPENSATION_ROLES.has(role);
        const compensationType = canUseSalesCompensation
            ? String(formData.get("compensation_type") || "salary").toLowerCase()
            : "salary";
        formData.set("compensation_type", compensationType);

        if (compensationType === "commission") {
            if (!canUseSalesCompensation) {
                showPopup("Commission", "Commission payout sirf ME/TME/Email Marketing role ke liye hai.", false);
                return;
            }
            formData.set("salary", "0");
            formData.set("commission_percent", String(FIXED_SALES_COMMISSION_PERCENT));
        } else {
            formData.set("commission_percent", "0");
        }

        if (btn) {
            btn.innerHTML = isEditMode ? "Updating..." : "Creating...";
            btn.disabled = true;
        }

        try {
            const endpoint = isEditMode
                ? `${BASE_URL}/api/admin/users/${editingUserId}`
                : `${BASE_URL}/register`;
            const method = isEditMode ? "PUT" : "POST";

            const res = await fetch(endpoint, {
                method,
                body: formData,
            });

            const text = await res.text();
            let data;

            try {
                data = JSON.parse(text);
            } catch (err) {
                console.error("Not JSON:", text);
                showPopup("Server Error", "Invalid response from server", false);
                return;
            }

            if (data.success) {
                const inviteResult = !isEditMode && data.profileSetup
                    ? await handleProfileSetupInvite(data.profileSetup)
                    : null;
                const popupTitle = isEditMode
                    ? "Success"
                    : inviteResult && !inviteResult.emailSent
                        ? "User Created"
                        : "Mail Sent Successfully";
                const successMessage = isEditMode
                    ? "User updated successfully"
                    : inviteResult?.emailSent
                        ? "User created successfully. Profile form email sent successfully."
                        : inviteResult?.copied
                            ? "User created successfully. Profile form link copied for manual sharing."
                            : "User created successfully. Profile form link is ready for manual sharing.";
                this.reset();
                closeUserForm();
                loadTeam();
                if (!isEditMode && inviteResult && !inviteResult.emailSent) {
                    showProfileSetupEmailPrompt(data.userId, data.profileSetup, inviteResult);
                } else {
                    showPopup(
                        popupTitle,
                        isEditMode ? (data.message || successMessage) : successMessage,
                        true,
                    );
                }
            } else {
                console.error("User save failed:", res.status, data);
                showPopup("Error", data.message || `Request failed (${res.status})`, false);
            }
        } catch (err) {
            console.error(err);
            showPopup("Error", "Server error", false);
        } finally {
            if (btn) {
                btn.innerHTML = originalText;
                btn.disabled = false;
            }
        }
    });
}



// function showService(service) {

//     const serviceBox = document.getElementById("serviceDetailsBox");

//     const serviceData = {
//         web: "Website Development Service Selected",
//         seo: "SEO Optimization Service Selected",
//         smo: "Social Media Optimization Service Selected",
//         ads: "Ads Management Service Selected",
//         app: "Mobile App Development Service Selected",
//         erp: "ERP / CRM Development Service Selected"
//     };

//     serviceBox.innerHTML = `
//         <h3>${service.toUpperCase()}</h3>
//         <p>${serviceData[service]}</p>
//     `;
// }

function scrollToService(button, serviceClass){

    const card = button.closest(".project-tracker-card");

    if(!card) return;

    const target = card.querySelector(`.${serviceClass}`);

    if(target){

        target.scrollIntoView({
            behavior: "smooth",
            block: "center"
        });

        target.classList.add("service-highlight");

        setTimeout(()=>{
            target.classList.remove("service-highlight");
        },1500);
    }
}

// Dashboard (extracted update)
function formatCurrency(value) {
    const amount = Number(value) || 0;
    return `Rs. ${amount.toLocaleString("en-IN")}`;
}

function getLeadDateValue(item = {}) {
    return item.created_at || item.created_date || item.closed_date || item.app_date || item.follow_date || null;
}

function getAdminDashboardItemDateValue(item = {}, type = "leads") {
    if (type === "appointments") {
        return item.appointment_date || item.app_date || item.date || item.created_at || getLeadDateValue(item);
    }

    if (type === "followups") {
        return item.follow_date || item.created_at || item.created_date || getLeadDateValue(item);
    }

    if (type === "deals") {
        return item.payment_date || item.closed_date || item.created_at || getLeadDateValue(item);
    }

    if (type === "projects") {
        return item.created_at || item.createdAt || item.start_date || item.startDate || item.assigned_at || item.updated_at || item.deadline || null;
    }

    return getLeadDateValue(item);
}

function filterAdminDashboardRowsByMonth(rows = [], monthKey = "", type = "leads") {
    if (!monthKey) return Array.isArray(rows) ? rows : [];

    return (Array.isArray(rows) ? rows : []).filter((row) =>
        isAdminDateInMonth(getAdminDashboardItemDateValue(row, type), monthKey),
    );
}

function getAdminDashboardDisplayData(data = adminDashboardCache) {
    const monthKey = getAdminDashboardMonth();

    return {
        ...data,
        leads: filterAdminDashboardRowsByMonth(data?.leads, monthKey, "leads"),
        appointments: filterAdminDashboardRowsByMonth(data?.appointments, monthKey, "appointments"),
        followups: filterAdminDashboardRowsByMonth(data?.followups, monthKey, "followups"),
        deals: filterAdminDashboardRowsByMonth(data?.deals, monthKey, "deals"),
        projects: filterAdminDashboardRowsByMonth(data?.projects, monthKey, "projects"),
    };
}

function toDateKey(value) {
    if (!value) return "";
    const date = new Date(value);
    return getAdminDateKey(date);
}

function getDashboardStatus(item = {}) {
    if (item.lead_status === "deal_closed") return "Won";
    if (item.action_type === "followup") return "Follow Up";
    if (item.lead_status === "followup" || item.follow_date || item.follow_time) return "Follow Up";
    if (item.action_type === "appointment") return "Appointment";
    if (item.lead_status) return String(item.lead_status).replace(/_/g, " ");
    return "New";
}

function getAdminDashboardSectionForStatus(item = {}, fallbackSection = "leads") {
    const leadStatus = String(item.lead_status || item.status || "")
        .toLowerCase()
        .replace(/[\s-]+/g, "_")
        .trim();
    const actionType = String(item.action_type || item.actionType || "")
        .toLowerCase()
        .replace(/[\s-]+/g, "_")
        .trim();
    const appointmentStatus = String(item.appointment_status || "")
        .toLowerCase()
        .replace(/[\s-]+/g, "_")
        .trim();

    if (
        leadStatus === "deal_closed" ||
        leadStatus === "won" ||
        actionType === "deal_closed" ||
        Number(item.deal_amount || 0) > 0 ||
        item.closed_date
    ) {
        return "deals";
    }

    if (
        actionType === "followup" ||
        actionType === "follow_up" ||
        leadStatus === "followup" ||
        leadStatus === "follow_up" ||
        item.follow_date ||
        item.follow_time
    ) {
        return "followups";
    }

    if (
        actionType === "appointment" ||
        leadStatus === "appointment" ||
        leadStatus === "appointments" ||
        appointmentStatus ||
        item.appointment_date ||
        item.app_date ||
        item.appointment_time
    ) {
        return "appointments";
    }

    return fallbackSection;
}

function normalizeSource(source) {
    const value = (source || "Other").toString().trim();
    return value || "Other";
}

function renderAdminChart(canvasId, chartRefName, config) {
    if (typeof Chart === "undefined") return;
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    if (adminChartInstances[chartRefName]) {
        adminChartInstances[chartRefName].destroy();
    }

    adminChartInstances[chartRefName] = new Chart(canvas.getContext("2d"), config);
}

function getWeekLabels(monthKey = getAdminDashboardMonth()) {
    const labels = [];
    const today = new Date();
    let endDate = new Date(today);

    if (monthKey && monthKey !== getAdminMonthKey(today)) {
        const [year, month] = monthKey.split("-").map(Number);
        if (year && month) {
            endDate = new Date(year, month, 0);
        }
    }

    for (let index = 6; index >= 0; index--) {
        const date = new Date(endDate);
        date.setDate(endDate.getDate() - index);
        labels.push({
            key: getAdminDateKey(date),
            label: date.toLocaleDateString("en-GB", { day: "2-digit", month: "short" }),
        });
    }

    return labels;
}

async function loadAdminDashboard() {
    setupAdminDashboardControls();

    try {
        const [leadsRes, appsRes, followupsRes, dealsRes, teamRes] = await Promise.all([
            fetch(getAdminPanelScopedApiUrl("/api/leads?role=admin")),
            fetch(getAdminPanelScopedApiUrl("/api/appointments?role=admin")),
            fetch(getAdminPanelScopedApiUrl("/api/followups?role=admin")),
            fetch(getAdminPanelScopedApiUrl("/api/deals?role=admin")),
            fetch(getAdminPanelScopedApiUrl("/api/admin/team-report")),
        ]);

        const [leadsData, appsData, followupsData, dealsData, teamData] = await Promise.all([
            leadsRes.json(),
            appsRes.json(),
            followupsRes.json(),
            dealsRes.json(),
            teamRes.json(),
        ]);

        const leads = filterAdminRowsByCompanyScope(
            leadsData.success && Array.isArray(leadsData.data) ? leadsData.data : [],
        );
        const appointments = filterAdminRowsByCompanyScope(
            appsData.success && Array.isArray(appsData.data) ? appsData.data : [],
        );
        const followups = filterAdminRowsByCompanyScope(
            followupsData.success && Array.isArray(followupsData.data) ? followupsData.data : [],
        );
        const deals = filterAdminRowsByCompanyScope(
            dealsData.success && Array.isArray(dealsData.data) ? dealsData.data : [],
        );
        const team = filterAdminRowsByCompanyScope(
            teamData.success && Array.isArray(teamData.data) ? teamData.data : [],
        );

        adminDashboardCache = { ...adminDashboardCache, leads, appointments, followups, deals, team };
        renderAdminDashboard(adminDashboardCache);
        await Promise.all([
            loadAdminSalesTargetSummary(),
            loadAdminTeamTargetsSummary(),
        ]);
    } catch (err) {
        console.error("Admin Dashboard Error:", err);
    }
}

function renderAdminDashboard(data = adminDashboardCache) {
    const displayData = getAdminDashboardDisplayData(data);
    const leads = Array.isArray(displayData?.leads) ? displayData.leads : [];
    const appointments = Array.isArray(displayData?.appointments) ? displayData.appointments : [];
    const followups = Array.isArray(displayData?.followups) ? displayData.followups : [];
    const deals = Array.isArray(displayData?.deals) ? displayData.deals : [];
    const team = Array.isArray(data?.team) ? data.team : [];
    const projects = Array.isArray(displayData?.projects)
        ? displayData.projects
        : filterAdminDashboardRowsByMonth(adminDashboardCache.projects, getAdminDashboardMonth(), "projects");

    const receivedDeals = deals.filter(item => getAdminDealReceivedAmount(item) > 0);
    const pendingDeals = deals.filter(item => item.pay_stat === "pending" || !item.pay_stat);
    const revenue = receivedDeals.reduce((sum, item) => sum + getAdminDealReceivedAmount(item), 0);
    const conversionRate = leads.length ? ((deals.length / leads.length) * 100).toFixed(1) : "0.0";

    const totalLeadsEl = document.getElementById("adminTotalLeads");
    if (!totalLeadsEl) return;

    document.getElementById("adminTotalLeads").textContent = leads.length;
    document.getElementById("adminTotalTeam").textContent = team.length;
    document.getElementById("adminOpenDeals").textContent = deals.length;
    document.getElementById("adminTotalRevenue").textContent = formatCurrency(revenue);
    document.getElementById("adminConversionRate").textContent = `${conversionRate}%`;
    document.getElementById("adminPendingTasks").textContent = followups.length;
    document.getElementById("adminLeadTrend").textContent = `${appointments.length} appointments in pipeline`;
    document.getElementById("adminDealTrend").textContent = `${pendingDeals.length} payment pending`;

    updateSalesFunnel(
        {
            leads: leads.length,
            appointments: appointments.length,
            followups: followups.length,
            deals: deals.length,
        },
        conversionRate,
    );

    renderAdminOverviewChart(leads, appointments, followups, deals);
    renderAdminSourceChart(leads);
    renderAdminRecentLeads(leads);
    renderAdminUpcomingFollowups(followups);
    renderAdminActivityFeed(leads, appointments, deals, followups);
    renderAdminTaskOverview(followups, deals);
    renderAdminExtraWidgets({
        leads,
        appointments,
        followups,
        deals,
        projects,
        receivedRevenue: revenue,
    });
}

function renderAdminExtraWidgets(data = {}) {
    const leads = Array.isArray(data?.leads) ? data.leads : [];
    const appointments = Array.isArray(data?.appointments) ? data.appointments : [];
    const followups = Array.isArray(data?.followups) ? data.followups : [];
    const deals = Array.isArray(data?.deals) ? data.deals : [];
    const projects = Array.isArray(data?.projects) ? data.projects : [];
    const salesTarget = adminDashboardState.salesTarget || {};
    const dealsCount = Number.isFinite(Number(salesTarget.dealsCount))
        ? Number(salesTarget.dealsCount || 0)
        : deals.length;
    const achievedSales = Number(salesTarget.achieved || data?.receivedRevenue || 0);
    const conversion = leads.length ? Math.round((dealsCount / leads.length) * 100) : 0;
    const salesMix = summarizeAdminDealMix(deals);

    setAdminDashboardText("adminDashboardSales", formatCompactMoney(achievedSales));
    setAdminDashboardText(
        "adminDashboardSalesHint",
        dealsCount ? `${dealsCount} deals closed` : "From closed deals",
    );
    setAdminDashboardText("adminDashboardNewSale", String(salesMix.newSaleCount));
    setAdminDashboardText(
        "adminDashboardNewSaleHint",
        salesMix.newSaleCount
            ? `${formatCompactMoney(salesMix.newSaleAmount)} from new sales`
            : "Fresh client wins",
    );
    setAdminDashboardText("adminDashboardRenewal", String(salesMix.renewalCount));
    setAdminDashboardText(
        "adminDashboardRenewalHint",
        salesMix.renewalCount
            ? salesMix.renewalAmount
                ? `${formatCompactMoney(salesMix.renewalAmount)} closed renewal value`
                : "Renewal activity started"
            : "Repeat client wins",
    );
    setAdminDashboardText("adminDashboardLeads", String(leads.length));
    setAdminDashboardText("adminDashboardAppointments", String(appointments.length));
    setAdminDashboardText("adminDashboardFollowups", String(followups.length));
    setAdminDashboardText("adminDashboardDeals", String(dealsCount));
    setAdminDashboardText("adminDashboardProjects", String(projects.length));

    setAdminDashboardText("adminFunnelLeads", String(leads.length));
    setAdminDashboardText("adminFunnelAppointments", String(appointments.length));
    setAdminDashboardText("adminFunnelFollowups", String(followups.length));
    setAdminDashboardText("adminFunnelDeals", String(dealsCount));
    setAdminDashboardText("adminDashboardFunnelRate", `${conversion}% converted`);
    setFunnelRowState("adminFunnelLeadsRow", 100, leads.length);
    setFunnelRowState("adminFunnelAppointmentsRow", 84, appointments.length);
    setFunnelRowState("adminFunnelFollowupsRow", 68, followups.length);
    setFunnelRowState("adminFunnelDealsRow", 52, dealsCount);

    applySalesSummary("admin", salesTarget);
    renderAdminTargetProgress(salesTarget);
    renderAdminDashboardChart({
        leads: leads.length,
        appointments: appointments.length,
        followups: followups.length,
        deals: dealsCount,
    });
    renderAdminRecentDeals(deals);
}

function updateSalesFunnel(counts, conversionRate) {
    const rows = [
        ["funnelTotalLeads", "adminMainFunnelLeadsRow", counts.leads, 92],
        ["funnelAppointments", "adminMainFunnelAppointmentsRow", counts.appointments, 74],
        ["funnelFollowups", "adminMainFunnelFollowupsRow", counts.followups, 58],
        ["funnelDeals", "adminMainFunnelDealsRow", counts.deals, 42],
    ];

    rows.forEach(([countId, rowId, value, width]) => {
        const countEl = document.getElementById(countId);
        const rowEl = document.getElementById(rowId);

        if (countEl) countEl.textContent = value;
        setFunnelRowState(rowId, width, value, rowEl);
    });

    const conversionEl = document.getElementById("funnelConversionRate");
    if (conversionEl) conversionEl.textContent = `${conversionRate}%`;
}

function setFunnelRowState(rowId, width, value, rowElement = null) {
    const rowEl = rowElement || document.getElementById(rowId);
    if (!rowEl) return;

    rowEl.style.width = `${width}%`;
    rowEl.title = `${value} record${value === 1 ? "" : "s"}`;
}

function renderAdminOverviewChart(leads, appointments, followups, deals) {
    const week = getWeekLabels();
    const countByDay = (items = []) =>
        week.map(day => items.filter(item => toDateKey(getLeadDateValue(item)) === day.key).length);

    renderAdminChart("adminLeadsOverviewChart", "adminLeadsOverviewChart", {
        type: "line",
        data: {
            labels: week.map(day => day.label),
            datasets: [
                {
                    label: "New Leads",
                    data: countByDay(leads),
                    borderColor: ADMIN_THEME_COLORS.accent,
                    backgroundColor: ADMIN_THEME_COLORS.accentFill,
                    tension: 0.38,
                    fill: true,
                },
                {
                    label: "Contacted",
                    data: countByDay(appointments.concat(followups)),
                    borderColor: ADMIN_THEME_COLORS.accentLight,
                    backgroundColor: ADMIN_THEME_COLORS.accentLightFill,
                    tension: 0.38,
                },
                {
                    label: "Converted",
                    data: countByDay(deals),
                    borderColor: ADMIN_THEME_COLORS.success,
                    backgroundColor: ADMIN_THEME_COLORS.accentSkyFill,
                    tension: 0.38,
                },
            ],
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { position: "top", align: "start" } },
            scales: {
                y: { beginAtZero: true, ticks: { precision: 0 } },
                x: { grid: { display: false } },
            },
        },
    });
}

function renderAdminSourceChart(leads) {
    const sourceCounts = leads.reduce((acc, lead) => {
        const source = normalizeSource(lead.source_lead || lead.source);
        acc[source] = (acc[source] || 0) + 1;
        return acc;
    }, {});

    const labels = Object.keys(sourceCounts).length ? Object.keys(sourceCounts) : ["No Data"];
    const values = Object.keys(sourceCounts).length ? Object.values(sourceCounts) : [1];
    const colors = [
        ADMIN_THEME_COLORS.accent,
        ADMIN_THEME_COLORS.accentLight,
        ADMIN_THEME_COLORS.accentBlue,
        ADMIN_THEME_COLORS.success,
        ADMIN_THEME_COLORS.accentSky,
        ADMIN_THEME_COLORS.accentDark,
    ];

    renderAdminChart("adminLeadSourceChart", "adminLeadSourceChart", {
        type: "doughnut",
        data: {
            labels,
            datasets: [{ data: values, backgroundColor: colors, borderColor: ADMIN_THEME_COLORS.white, borderWidth: 4 }],
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: "62%",
            plugins: { legend: { display: false } },
        },
    });

    const legend = document.getElementById("adminSourceLegend");
    if (!legend) return;

    legend.innerHTML = labels
        .map((label, index) => {
            const count = values[index] || 0;
            const percent = leads.length ? ((count / leads.length) * 100).toFixed(1) : "0.0";
            return `<div><span style="background:${colors[index % colors.length]}"></span><b>${label}</b><em>${count} (${percent}%)</em></div>`;
        })
        .join("");
}

function renderAdminRecentLeads(leads) {
    const tbody = document.getElementById("adminRecentLeads");
    if (!tbody) return;

    const rows = [...leads]
        .sort((a, b) => new Date(getLeadDateValue(b) || 0) - new Date(getLeadDateValue(a) || 0))
        .slice(0, 5);

    tbody.innerHTML = rows.length
        ? rows
              .map(
                  lead => {
                      const targetSection = getAdminDashboardSectionForStatus(lead, "leads");
                      const statusLabel = getDashboardStatus(lead);
                      const statusClass = statusLabel.toLowerCase().replace(/\s+/g, "-");
                      return `
        <tr data-admin-section-link="${escapeAdminHtml(targetSection)}" role="button" tabindex="0">
            <td>${escapeAdminHtml(lead.company_name || "-")}</td>
            <td>${escapeAdminHtml(lead.client_name || "-")}</td>
            <td>${escapeAdminHtml(normalizeSource(lead.source_lead || lead.source))}</td>
            <td>${escapeAdminHtml(lead.contact || "-")}</td>
            <td><span class="mini-status ${escapeAdminHtml(statusClass)}">${escapeAdminHtml(statusLabel)}</span></td>
            <td>${escapeAdminHtml(lead.assign_emp || "-")}</td>
            <td>${escapeAdminHtml(formatDate(getLeadDateValue(lead)))}</td>
        </tr>
    `;
                  },
              )
              .join("")
        : `<tr><td colspan="7">No leads found</td></tr>`;
}

function renderAdminUpcomingFollowups(followups) {
    const tbody = document.getElementById("adminUpcomingFollowups");
    if (!tbody) return;

    const rows = [...followups]
        .sort((a, b) => new Date(a.follow_date || 0) - new Date(b.follow_date || 0))
        .slice(0, 5);

    tbody.innerHTML = rows.length
        ? rows
              .map(
                  (item, index) => `
        <tr data-admin-section-link="followups" role="button" tabindex="0">
            <td><strong>${escapeAdminHtml(item.client_name || item.company_name || "-")}</strong><small>${escapeAdminHtml(item.contact || "")}</small></td>
            <td><i class="fas fa-phone"></i> Call</td>
            <td>${escapeAdminHtml(item.assign_emp || "-")}</td>
            <td>${escapeAdminHtml(formatDate(item.follow_date))}${item.follow_time ? `, ${escapeAdminHtml(formatAdminAppointmentTime(item.follow_time))}` : ""}</td>
            <td><span class="priority ${index === 0 ? "high" : index < 3 ? "medium" : "low"}">${index === 0 ? "High" : index < 3 ? "Medium" : "Low"}</span></td>
        </tr>
    `,
              )
              .join("")
        : `<tr><td colspan="5">No follow ups found</td></tr>`;
}

function renderAdminActivityFeed(leads, appointments, deals, followups) {
    const feed = document.getElementById("adminActivityFeed");
    if (!feed) return;

    const activities = [
        ...leads
            .slice(-3)
            .map(item => ({
                section: getAdminDashboardSectionForStatus(item, "leads"),
                icon: "fa-user-plus",
                color: "green",
                title: `${getDashboardStatus(item)} ${item.company_name || item.client_name || "lead"}`,
                meta: item.assign_emp || "CRM",
                date: getLeadDateValue(item),
            })),
        ...appointments
            .slice(-2)
            .map(item => ({
                section: "appointments",
                icon: "fa-calendar-check",
                color: "blue",
                title: `Appointment with ${item.company_name || item.client_name || "client"}`,
                meta: item.assign_emp || item.me_name || "Team",
                date: item.appointment_date || item.date || getLeadDateValue(item),
            })),
        ...deals
            .slice(-2)
            .map(item => ({
                section: "deals",
                icon: "fa-indian-rupee-sign",
                color: "amber",
                title: `Deal closed ${item.company_name || item.client_name || ""}`,
                meta: formatCurrency(item.deal_amount),
                date: item.closed_date || getLeadDateValue(item),
            })),
        ...followups
            .slice(-2)
            .map(item => ({
                section: "followups",
                icon: "fa-phone",
                color: "violet",
                title: `Follow up with ${item.company_name || item.client_name || "lead"}`,
                meta: item.assign_emp || "Team",
                date: item.follow_date,
            })),
    ]
        .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0))
        .slice(0, 6);

    feed.innerHTML = activities.length
        ? activities
              .map(
                  item => `
        <div class="activity-item" data-admin-section-link="${escapeAdminHtml(item.section)}" role="button" tabindex="0">
            <span class="activity-icon ${item.color}"><i class="fas ${item.icon}"></i></span>
            <div>
                <strong>${escapeAdminHtml(item.title)}</strong>
                <p>${escapeAdminHtml(item.meta)}</p>
            </div>
            <small>${escapeAdminHtml(formatDate(item.date))}</small>
        </div>
    `,
              )
              .join("")
        : `<div class="activity-empty">No activity yet</div>`;
}

function renderAdminTaskOverview(followups, deals) {
    const todayKey = getAdminDateKey();
    const weekAhead = new Date();
    weekAhead.setDate(weekAhead.getDate() + 7);

    const dueToday = followups.filter(item => toDateKey(item.follow_date) === todayKey).length;
    const dueWeek = followups.filter(item => {
        if (!item.follow_date) return false;
        const date = new Date(item.follow_date);
        return date >= new Date(todayKey) && date <= weekAhead;
    }).length;

    const dueTodayEl = document.getElementById("taskDueToday");
    if (!dueTodayEl) return;

    document.getElementById("taskDueToday").textContent = dueToday;
    document.getElementById("taskDueWeek").textContent = dueWeek;
    document.getElementById("taskCompletedWeek").textContent = deals.length;
    document.getElementById("taskOverdue").textContent = deals.filter(item => item.pay_stat === "pending" || !item.pay_stat).length;
}

function filterAdminDashboardLists() {
    const query = (document.getElementById("adminDashboardSearch")?.value || "").toLowerCase();
    const filterRows = (tbodyId) => {
        document.querySelectorAll(`#${tbodyId} tr`).forEach(row => {
            row.style.display = row.textContent.toLowerCase().includes(query) ? "" : "none";
        });
    };
    filterRows("adminRecentLeads");
    filterRows("adminUpcomingFollowups");
}

// ============== ADMIN EDIT DEAL FUNCTIONS ==============

let currentEditingDealId = null;
let currentEditingDealData = null;

async function openAdminEditDealModal(event, dealId) {
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }

    currentEditingDealId = Number(dealId || 0);
    if (!currentEditingDealId) return;

    const modal = document.getElementById("adminEditDealModal");
    if (!modal) return;

    try {
        // Fetch single deal by lead ID
            const res = await fetch(`${BASE_URL}/api/leads/${currentEditingDealId}`, {
            cache: "no-store",
        });

        if (!res.ok) {
            throw new Error("Failed to load deal details");
        }

        const result = await res.json();
        if (!result.success || !result.data) {
            throw new Error(result.message || "Deal not found");
        }

        currentEditingDealData = result.data;
        populateAdminEditDealForm(result.data);

        modal.classList.remove("hidden");
        modal.setAttribute("aria-hidden", "false");
        document.body.classList.add("modal-open");
    } catch (err) {
        console.error("Error opening edit modal:", err);
        showPopup("Error", err.message || "Unable to open deal editor", false);
    }
}

function populateAdminEditDealForm(deal) {
    const dealAmount = getAdminDealAmount(deal);
    const receivedTotal = getAdminDealReceivedAmount(deal);

    document.getElementById("editDealAmount").value = dealAmount || 0;
    document.getElementById("editReceivedAmount").value = receivedTotal || 0;
    document.getElementById("editPaymentMethod").value = deal.payment_method || "";
    document.getElementById("editPaymentStatus").value = normalizeAdminDealPayStatus(deal.pay_stat) || "pending";
    document.getElementById("editPaymentDate").value = formatDateForInput(deal.payment_date) || "";
    document.getElementById("editClosedDate").value = formatDateForInput(deal.closed_date) || "";
    document.getElementById("editMeName").value = deal.me_name || deal.assign_emp || "";
    document.getElementById("editTmeName").value = deal.closed_tme_name || deal.tme_name || "";
}

function formatDateForInput(dateString) {
    if (!dateString) return "";
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return "";
    return date.toISOString().split("T")[0];
}

function closeAdminEditDealModal() {
    document.activeElement?.blur();
    const modal = document.getElementById("adminEditDealModal");
    if (!modal) return;

    modal.classList.add("hidden");
    modal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("modal-open");
    currentEditingDealId = null;
    currentEditingDealData = null;
    document.getElementById("adminEditDealForm").reset();
}

function handleAdminEditDealBackdrop(event) {
    if (event.target?.id === "adminEditDealModal") {
        closeAdminEditDealModal();
    }
}

async function handleAdminEditDealSubmit(event) {
    event.preventDefault();

    if (!currentEditingDealId || !currentEditingDealData) {
        showPopup("Error", "Invalid deal", false);
        return;
    }

    const dealAmount = Number(document.getElementById("editDealAmount").value || 0);
    const receivedAmount = Number(document.getElementById("editReceivedAmount").value || 0);
    const paymentMethod = document.getElementById("editPaymentMethod").value.trim();
    const paymentStatus = document.getElementById("editPaymentStatus").value;
    const paymentDate = document.getElementById("editPaymentDate").value;
    const closedDate = document.getElementById("editClosedDate").value;

    if (dealAmount <= 0) {
        showPopup("Error", "Deal amount must be greater than 0", false);
        return;
    }

    if (receivedAmount < 0) {
        showPopup("Error", "Received amount cannot be negative", false);
        return;
    }

    if (receivedAmount > dealAmount) {
        showPopup("Error", "Received amount cannot be greater than deal amount", false);
        return;
    }

    if (paymentStatus === "received" && receivedAmount <= 0) {
        showPopup("Error", "Received amount must be greater than 0", false);
        return;
    }

    try {
        const updateData = {
            deal_amount: dealAmount,
            received_amount: receivedAmount,
            payment_method: paymentMethod,
            pay_stat: paymentStatus,
            payment_date: paymentDate || null,
            closed_date: closedDate || null,
        };

        const res = await fetch(`${BASE_URL}/api/deals/${currentEditingDealId}`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(updateData),
        });

        const result = await res.json();

        if (!res.ok || !result.success) {
            throw new Error(result.message || "Failed to update deal");
        }

        closeAdminEditDealModal();
        showPopup("Success", "Deal updated successfully", true);
        loadDeals();
    } catch (err) {
        console.error("Error updating deal:", err);
        showPopup("Error", err.message || "Failed to update deal", false);
    }
}

// Attach form submit handler
document.addEventListener("DOMContentLoaded", function() {
    const form = document.getElementById("adminEditDealForm");
    if (form) {
        form.addEventListener("submit", handleAdminEditDealSubmit);
    }

    const paymentForm = document.getElementById("adminDealPaymentForm");
    if (paymentForm) {
        paymentForm.addEventListener("submit", handleAdminDealPaymentSubmit);
    }

    const paymentAmountInput = document.getElementById("adminDealPaymentAmount");
    if (paymentAmountInput) {
        paymentAmountInput.addEventListener("input", updateAdminDealPaymentBreakupPreview);
        updateAdminDealPaymentBreakupPreview();
    }
});
function closeAdminDealAckView() {
  const overlay = document.getElementById("adminDealAckOverlay");
  if (overlay) {
    overlay.classList.add("hidden");
    overlay.removeAttribute("data-view-only");
  }
}

const ADMIN_DC_SERVICE_DESCRIPTIONS = {
  'GMB SEO': 'Optimizes Google Business Profile for better visibility on Search and Maps. Helps improve local calls, direction requests and enquiries.',
  'Website SEO': 'Improves website visibility on Google with keyword, on-page and technical optimization. Helps bring quality organic traffic and leads.',
  'SEO Additional Keyword': 'Adds extra keywords to the SEO scope for wider ranking coverage. Each keyword is tracked and optimized with the active SEO plan.',
  'ERP/CRM/Software': 'Custom software to manage workflows, leads, customers and reports in one system. Helps reduce manual work and improve tracking.',
  'E-commerce Website': 'Online store with product catalogue, cart, checkout/payment and admin management. Suitable for selling products online with order tracking.',
  'Landing Page': 'Single-page campaign website focused on enquiries or lead capture. Includes clear sections, CTA and mobile-friendly layout.',
  'Static Website': 'Fast informational website for company profile, services and contact details. Best for a clean online presence with fixed content.',
  'Dynamic Website': 'Editable and interactive website with flexible pages and better user experience. Suitable for businesses that need regular content updates.',
  'SMO Service': 'Manages social media presence with planned content, captions and page optimization. Helps improve engagement, reach and brand consistency.',
  'Profile Creation': 'Creates and optimizes business profiles on relevant online platforms. Helps improve brand presence, trust and discoverability.',
  'Google Ads Management': 'Setup and management of Google Ads campaigns with targeting, budget and performance optimization. Helps generate paid leads with trackable results.',
  'Meta Organic Management': 'Plans and manages organic Facebook/Instagram content for regular brand visibility. Helps improve engagement and audience trust.',
  'Meta Ads + Management': 'Runs paid Meta campaigns with audience targeting, creatives and performance monitoring. Helps generate enquiries through Facebook/Instagram ads.',
};


function normalizeLeadCompanyScope(value) {
  const normalized = String(value || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  if (normalized.includes("redsea") || normalized.includes("redseadigitals")) return "redsea";
  return "metrics";
}

function getAdminDealCloseCompanyScope() {
  return normalizeLeadCompanyScope(
    currentUser?.company_key || currentUser?.selected_company || currentUser?.comp_name
  ) || "metrics";
}

function updateAdminDealAcknowledgementHeaderImage(container, companyScope) {
  if (!container) return;
  const image = container.querySelector(".deal-ack-logo img");
  if (!image) return;
  const isRedsea = normalizeLeadCompanyScope(companyScope) === "redsea";
  image.src = isRedsea ? "acknowledge_redsea_img.png" : "acknowledge_img.png";
  image.alt = isRedsea ? "RED SEA DIGITALS" : "METRICS MART";
}

async function openAdminDealAckViewModal(dealId) {
  const overlay = document.getElementById("adminDealAckOverlay");
  if (!overlay) return;

  try {
    const response = await fetch('/api/leads/' + dealId + '/acknowledgment-data');
    const result = await response.json();
    
    if (!result.success || !result.lead) {
      alert("Failed to load acknowledgment data.");
      return;
    }

    const lead = result.lead;
    const deal = result.deal || {};
    const products = result.products || [];
    const installments = result.installments || [];
    const renewals = result.renewals || [];

    const companyScope = normalizeLeadCompanyScope(lead.company_scope || lead.companyScope || currentUser?.company_scope || currentUser?.company_key) || getAdminDealCloseCompanyScope();
    updateAdminDealAcknowledgementHeaderImage(overlay, companyScope);

    const address = [
      lead.flat_no, lead.building_name, lead.locality,
      lead.city, lead.pincode, lead.state,
    ].map((v) => String(v || "").trim()).filter(Boolean).join(", ");

    const setText = (id, value) => {
      const el = document.getElementById(id);
      if (el) el.textContent = value;
    };

    setText("adminAckCompany", lead.company_name || "N/A");
    setText("adminAckClient", lead.client_name || "N/A");
    setText("adminAckPhone", lead.telephone || lead.contact || "N/A");
    setText("adminAckEmail", lead.email || "N/A");
    setText("adminAckAddress", address || "N/A");
    
    const closeDate = new Date(lead.closed_date || lead.updated_at);
    setText("adminAckDate", isNaN(closeDate) ? (lead.closed_date || "N/A") : closeDate.toLocaleString());
    
    setText("adminAckTotal", `Rs. ${Number(deal.deal_amount || lead.deal_amount || 0).toLocaleString("en-IN")}`);
    setText("adminAckPaid", `Rs. ${Number(deal.received_amount || lead.received_amount || 0).toLocaleString("en-IN")}`);
    setText("adminAckMethod", deal.payment_method || lead.payment_method || "N/A");
    
    const dealAmount = Number(deal.deal_amount || lead.deal_amount || 0);
    const receivedAmount = Number(deal.received_amount || lead.received_amount || 0);
    const totalGst = dealAmount - (dealAmount / 1.18);
    const paidGst = receivedAmount - (receivedAmount / 1.18);
    const remainingGst = totalGst - paidGst;

    setText("adminAckGst", `Rs. ${totalGst.toLocaleString("en-IN", {maximumFractionDigits: 2})}`);
    setText("adminAckPaidGst", `Rs. ${paidGst.toLocaleString("en-IN", {maximumFractionDigits: 2})}`);
    setText("adminAckRemainingGst", `Rs. ${Math.max(0, remainingGst).toLocaleString("en-IN", {maximumFractionDigits: 2})}`);

    const productsTbody = document.getElementById("adminAckProductsList");
    if (productsTbody) {
      productsTbody.innerHTML = "";
      if (products.length === 0) {
        productsTbody.innerHTML = `<tr><td colspan="2" style="text-align: center; color: #64748b;">No products found</td></tr>`;
      } else {
        products.forEach((product) => {
          const tr = document.createElement("tr");
          const name = product.product_name || product.name || "-";
          const desc = ADMIN_DC_SERVICE_DESCRIPTIONS[name] || "";
          const price = Number(product.product_amount ?? product.price ?? product.amount ?? 0);
          tr.innerHTML = `
            <td>
              <span style="font-weight:600;">${escapeAdminHtml(name)}</span>
              ${desc ? `<br><span style="font-size:11px; color:#64748b; font-style:italic;">${escapeAdminHtml(desc)}</span>` : ""}
            </td>
            <td style="text-align:right; font-weight:600;">Rs. ${price.toLocaleString("en-IN")}</td>
          `;
          productsTbody.appendChild(tr);
        });
      }
    }

    const scheduleSection = document.getElementById("adminAckScheduleSection");
    const scheduleTbody = document.getElementById("adminAckScheduleList");
    if (scheduleSection && scheduleTbody) {
      if (installments && installments.length > 0 && (deal.part_payment_option || lead.part_payment_option)) {
        scheduleSection.style.display = "block";
        setText("adminAckOptionLabel", deal.part_payment_option || lead.part_payment_option);
        scheduleTbody.innerHTML = "";
        installments.forEach((inst) => {
          const tr = document.createElement("tr");
          tr.innerHTML = `
            <td>Installment #${Number(inst.installmentNo || 0)}</td>
            <td>${inst.dueDate ? new Date(inst.dueDate).toLocaleDateString() : "-"}</td>
            <td style="text-align:right; font-weight:600;">Rs. ${Number(inst.amount || 0).toLocaleString("en-IN")}</td>
          `;
          scheduleTbody.appendChild(tr);
        });
      } else {
        scheduleSection.style.display = "none";
      }
    }

    const renewalSection = document.getElementById("adminAckRenewalSection");
    const renewalTbody = document.getElementById("adminAckRenewalList");
    if (renewalSection && renewalTbody) {
      if (renewals && renewals.length > 0) {
        renewalSection.style.display = "block";
        setText("adminAckRenewalBasis", renewals[0].basis || "Custom");
        renewalTbody.innerHTML = "";
        renewals.forEach((renewal) => {
          const tr = document.createElement("tr");
          tr.innerHTML = `
            <td>${escapeAdminHtml(renewal.service || "-")}</td>
            <td>${renewal.firstRenewalDate ? new Date(renewal.firstRenewalDate).toLocaleDateString() : "-"}</td>
            <td style="text-align:right; font-weight:600;">Rs. ${Number(renewal.amount || 0).toLocaleString("en-IN")}</td>
          `;
          renewalTbody.appendChild(tr);
        });
      } else {
        renewalSection.style.display = "none";
      }
    }

    overlay.setAttribute("data-view-only", "true");
    overlay.classList.remove("hidden");
  } catch (err) {
    console.error("Error loading acknowledgment data:", err);
    alert("Error loading data.");
  }
}


let locationMap = null;
let locationPolyline = null;
let locationMarkers = [];

async function loadAppLocationInit() {
    const dateInput = document.getElementById('appLocationDate');
    if (!dateInput.value) {
       // set today
       const today = new Date();
       dateInput.value = today.toISOString().split('T')[0];
    }
    
    // Load employees dropdown if empty
    const empSelect = document.getElementById('appLocationEmployee');
    if (empSelect.options.length <= 1) {
       await populateAppLocationEmployees();
    }

    if (empSelect.value) {
       loadAppLocation();
    } else {
       initEmptyMap();
    }
}

async function populateAppLocationEmployees() {
    const empSelect = document.getElementById('appLocationEmployee');
    try {
        empSelect.innerHTML = '<option value="">Select Employee...</option>';
        
        const url = new URL(getAdminPanelScopedApiUrl("/api/admin/team-report"));
        url.searchParams.set("employmentStatus", "active");

        const res = await fetch(url.toString(), { cache: "no-store" });
        const result = await res.json();
        
        if (result.success && result.data) {
           const scopedTeam = filterAdminRowsByCompanyScope(result.data);
           scopedTeam.forEach(user => {
               const opt = document.createElement('option');
               opt.value = user.id;
               opt.textContent = `${user.name} (${user.role})`;
               empSelect.appendChild(opt);
           });
        }
    } catch (e) {
        console.error("Failed to load employees for app location", e);
    }
}

function initEmptyMap() {
    if (!locationMap) {
        locationMap = L.map('appLocationMap').setView([20.5937, 78.9629], 5); // Center of India
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors'
        }).addTo(locationMap);
    }
}

async function loadAppLocation() {
    const adminId = currentUser ? currentUser.id : 0;
    const empId = document.getElementById('appLocationEmployee').value;
    const date = document.getElementById('appLocationDate').value;
    
    if (!empId) {
        alert("Please select an employee first.");
        return;
    }
    
    document.getElementById('appLocationTableBody').innerHTML = '<tr><td colspan="4" style="text-align:center;">Loading data...</td></tr>';
    
    initEmptyMap();

    try {
        const res = await fetch(`${BASE_URL}/api/admin/location-history?adminId=${adminId}&employeeId=${empId}&date=${date}`);
        const data = await res.json();
        
        if (data.success) {
            window.currentAppLocationHistory = data.data;
            window.appLocationShowingRoute = false;
            renderAppLocationMap(data.data);
            renderAppLocationTable(data.data);
            updateAppLocationSummary(data.data);
        } else {
            alert(data.message || "Failed to load location history.");
        }
    } catch(err) {
        console.error(err);
        alert("Error loading location data.");
        document.getElementById('appLocationTableBody').innerHTML = '<tr><td colspan="4" style="text-align:center; color:red;">Error loading data.</td></tr>';
    }
}


window.currentAppLocationHistory = [];
window.appLocationShowingRoute = false;

function showFullRoute() {
    if (!window.currentAppLocationHistory || window.currentAppLocationHistory.length === 0) {
        alert("No location data available to show route.");
        return;
    }
    window.appLocationShowingRoute = true;
    renderAppLocationMap(window.currentAppLocationHistory);
}

function renderAppLocationMap(locations) {
    // clear existing markers
    locationMarkers.forEach(m => locationMap.removeLayer(m));
    locationMarkers = [];
    if (locationPolyline) locationMap.removeLayer(locationPolyline);
    
    if (!locations || locations.length === 0) {
        return;
    }
    
    let locationsToRender = locations;
    
    if (!window.appLocationShowingRoute) {
        // Only show the last location
        locationsToRender = [locations[locations.length - 1]];
    }

    const latlngs = locationsToRender.map(loc => [parseFloat(loc.latitude), parseFloat(loc.longitude)]);
    
    locationsToRender.forEach((loc, index) => {
        let color = '#3b82f6'; // default blue
        if (window.appLocationShowingRoute) {
            if (index === 0) color = '#10b981'; // start green
            if (index === locationsToRender.length - 1) color = '#ef4444'; // end red
        } else {
            color = '#ef4444'; // current location red
        }
        
        const customIcon = L.divIcon({
            className: 'custom-div-icon',
            html: `<div style="background-color: ${color}; width: 14px; height: 14px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 4px rgba(0,0,0,0.4);"></div>`,
            iconSize: [14, 14],
            iconAnchor: [7, 7]
        });

        const marker = L.marker([loc.latitude, loc.longitude], {icon: customIcon}).addTo(locationMap);
        marker.bindPopup(`
            <div style="font-family:sans-serif; min-width:180px;">
                <strong style="display:block; margin-bottom:5px; border-bottom:1px solid #ccc; padding-bottom:5px;">${new Date(loc.recorded_at).toLocaleTimeString()}</strong>
                <div style="font-size:12px; margin-bottom:4px;"><strong>Address:</strong> ${loc.address || 'N/A'}</div>
                <div style="font-size:11px; color:#666;">Lat: ${loc.latitude}</div>
                <div style="font-size:11px; color:#666;">Lng: ${loc.longitude}</div>
            </div>
        `);
        marker.on('click', () => { locationMap.setView([loc.latitude, loc.longitude], 16); });
        locationMarkers.push(marker);
        
        // bind to DOM element for table click
        loc._marker = marker; 
    });
    
    if (window.appLocationShowingRoute && latlngs.length > 1) {
        locationPolyline = L.polyline(latlngs, {color: 'rgba(15, 118, 110, 0.7)', weight: 3, dashArray: '5, 5'}).addTo(locationMap);
    }
    
    fitLocationMapBounds();
}

function fitLocationMapBounds() {
    if (locationMarkers.length > 0) {
        const group = new L.featureGroup(locationMarkers);
        locationMap.fitBounds(group.getBounds(), {padding: [30, 30]});
    }
}

function focusMapOnLocation(lat, lng, markerIndex) {
    locationMap.setView([lat, lng], 16);
    if (locationMarkers[markerIndex]) {
        locationMarkers[markerIndex].openPopup();
    }
}

function renderAppLocationTable(locations) {
    const tbody = document.getElementById('appLocationTableBody');
    tbody.innerHTML = '';
    
    if (!locations || locations.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">No location records found for this date.</td></tr>';
        return;
    }
    
    // Reverse array to show newest first in the table
    [...locations].reverse().forEach((loc, index) => {
        const originalIndex = locations.length - 1 - index;
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${new Date(loc.recorded_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', second:'2-digit'})}</td>
            <td>${loc.address || '<span style="color:#94a3b8; font-style:italic;">No address resolved</span>'}</td>
            <td style="font-size:11px; color:#64748b;">${parseFloat(loc.latitude).toFixed(5)}, ${parseFloat(loc.longitude).toFixed(5)}</td>
            <td><button onclick="focusMapOnLocation(${loc.latitude}, ${loc.longitude}, ${originalIndex})" style="background:none; border:none; color:var(--admin-accent); cursor:pointer; font-size:12px; font-weight:600;"><i class="fas fa-crosshairs"></i> View</button></td>
        `;
        tbody.appendChild(tr);
    });
}

function updateAppLocationSummary(locations) {
    if (!locations || locations.length === 0) {
        document.getElementById('locTotalPoints').textContent = '0';
        document.getElementById('locFirstTime').textContent = '-';
        document.getElementById('locLastTime').textContent = '-';
        document.getElementById('locStatus').textContent = 'Offline';
        document.getElementById('locStatus').style.color = '#64748b';
        return;
    }
    
    document.getElementById('locTotalPoints').textContent = locations.length;
    
    const firstLoc = locations[0];
    const lastLoc = locations[locations.length - 1];
    
    document.getElementById('locFirstTime').textContent = new Date(firstLoc.recorded_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    document.getElementById('locLastTime').textContent = new Date(lastLoc.recorded_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    
    // Check if tracking is active (if last location was within last 30 minutes)
    const now = new Date();
    const lastDate = new Date(lastLoc.recorded_at);
    const diffMins = (now - lastDate) / (1000 * 60);
    
    const dateInput = document.getElementById('appLocationDate').value;
    const isToday = dateInput === now.toISOString().split('T')[0];
    
    if (isToday && diffMins <= 30) {
        document.getElementById('locStatus').innerHTML = '<i class="fas fa-circle" style="color:#10b981; font-size:10px; margin-right:4px;"></i> Active';
        document.getElementById('locStatus').style.color = '#10b981';
    } else {
        document.getElementById('locStatus').innerHTML = '<i class="fas fa-circle" style="color:#94a3b8; font-size:10px; margin-right:4px;"></i> Offline';
        document.getElementById('locStatus').style.color = '#64748b';
    }
}

async function unlockUserProfile() {
  if (!editingUserId) return;
  if (!confirm("Are you sure you want to unlock this user's profile setup form? All their currently uploaded files and data will remain intact, but they will be allowed to re-submit the form.")) return;

  try {
    const response = await fetch(`/api/admin/users/${editingUserId}/unlock-profile`, {
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

// Global helper for renewal card filtering
window.applyRenewalFilter = function(filterText, searchInputId, tableId) {
    const searchInput = document.getElementById(searchInputId);
    if (searchInput) {
        searchInput.value = filterText;
        const event = new Event('keyup');
        searchInput.dispatchEvent(event);
    }
};

