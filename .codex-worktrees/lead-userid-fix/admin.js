let currentUser = null;
let allTeamData = [];
let dealsLineChart = null;
let adminTargetProgressChart = null;
let adminDashboardChart = null;
let adminLeadsOverviewChart = null;
let adminLeadSourceChart = null;
let adminLeadSubmitting = false;
let adminPopupTimer = null;
let userFormMode = "create";
let editingUserId = null;
let proposalTemplatesCache = [];
const adminChartInstances = {};
const ADMIN_THEME_COLORS = {
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
const USER_REGISTRATION_MAX_FILE_SIZE = 15 * 1024 * 1024;
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
const SALES_COMPENSATION_ROLES = new Set(["tme", "me"]);
const FIXED_SALES_COMMISSION_PERCENT = 10;

const adminDashboardState = {
    salesTarget: {
        target: 0,
        achieved: 0,
        remaining: 0,
        dealsCount: 0,
    },
    teamTargets: [],
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

function normalizeAdminPanelCompanyKey(value) {
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

function getAdminPanelCompanyScope() {
    return (
        normalizeAdminPanelCompanyKey(
            currentUser?.company_key ||
                currentUser?.selected_company ||
                currentUser?.comp_name ||
                new URLSearchParams(window.location.search).get("company"),
        ) || "metrics"
    );
}

function getAdminHeaderAvatarUrl(user = {}) {
    const companyKey = normalizeAdminPanelCompanyKey(
        user.company_key ||
            user.selected_company ||
            user.comp_name ||
            new URLSearchParams(window.location.search).get("company"),
    );

    if (normalizeAdminRole(user.role) === "admin") {
        if (companyKey === "redsea") {
            return `${BASE_URL}/${REDSEA_ADMIN_PROFILE_IMAGE}`;
        }

        if (companyKey === "metrics") {
            return `${BASE_URL}/${METRICS_ADMIN_PROFILE_IMAGE}`;
        }
    }

    const profileImage = String(user.prof_img || "").trim();

    if (profileImage && profileImage.toUpperCase() !== "NULL") {
        return profileImage.startsWith("http")
            ? profileImage
            : `${BASE_URL}/${profileImage}`;
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

window.onload = function () {
    if (!loadUser()) return;
    setupAdminAttendanceControls();
    setupUserRegistrationForm();
    setupAdminLeadForm();
    setupProposalTemplateForm();
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

}

function setupAdminAttendanceControls() {
    const dateInput = document.getElementById("adminAttendanceDate");
    if (!dateInput) return;

    dateInput.min = "2026-05-01";
    if (dateInput.value) return;

    dateInput.value = getAdminDateKey();
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

async function loadAdminSalesTargetSummary() {
    if (!currentUser?.role) return;

    try {
        const params = new URLSearchParams({
            role: currentUser.role,
        });

        if (currentUser.id) {
            params.set("userId", currentUser.id);
        }

        const res = await fetch(`${BASE_URL}/api/sales-target-summary?${params.toString()}`, {
            cache: "no-store",
        });
        const result = await res.json();

        if (!res.ok || !result.success) {
            throw new Error(result.message || "Failed to load sales target");
        }

        adminDashboardState.salesTarget = {
            target: Number(result.data?.target || 0),
            achieved: Number(result.data?.achieved || 0),
            remaining: Math.max(Number(result.data?.remaining || 0), 0),
            dealsCount: Number(result.data?.dealsCount || 0),
        };

        applySalesSummary("admin", result.data);
        renderAdminTargetProgress(adminDashboardState.salesTarget);
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
        const res = await fetch(`${BASE_URL}/api/admin/team-targets-summary?${params.toString()}`, {
            cache: forceRefresh ? "no-store" : "default",
        });
        const result = await res.json();

        if (!res.ok || !result.success) {
            throw new Error(result.message || "Failed to load team targets");
        }

        adminDashboardState.teamTargets = Array.isArray(result.data) ? result.data : [];
        renderAdminTeamTargets(adminDashboardState.teamTargets, result.summary || {});
    } catch (err) {
        console.error("Admin Team Targets Error:", err);
        renderAdminTeamTargets([], {});
        list.innerHTML = `<div class="team-target-empty">${escapeAdminHtml(err.message || "Unable to load team target board")}</div>`;
    }
}

function renderAdminTeamTargets(items = [], summary = {}) {
    const list = document.getElementById("adminTeamTargetsList");
    const summaryText = document.getElementById("adminTeamTargetsSummary");
    if (!list) return;

    if (summaryText) {
        const totalMembers = Number(summary.totalMembers || items.length || 0);
        const achievedMembers = Number(summary.achievedMembers || 0);
        const totalTarget = Number(summary.totalTarget || 0);
        const totalAchieved = Number(summary.totalAchieved || 0);

        summaryText.textContent = totalMembers
            ? `${achievedMembers}/${totalMembers} achieved | ${formatSalesSummaryMoney(totalAchieved)} of ${formatSalesSummaryMoney(totalTarget)}`
            : "Auto salary targets and monitor live achievement.";
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
                            ${dealsCount} closed deal${dealsCount === 1 ? "" : "s"} this month${isAchieved ? " | Target completed" : ""}
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
                            ${dealsCount} closed deal${dealsCount === 1 ? "" : "s"} this month${isAchieved ? " | Target completed" : ""}
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
                        <span>${isCommission ? "Sales" : "Achieved"}</span>
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
            const amount = Number(deal?.deal_amount || 0);
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
            const amount = formatCompactMoney(deal?.deal_amount || 0);
            return `
                <tr>
                    <td>${deal.company_name || "-"}</td>
                    <td>${deal.client_name || "-"}</td>
                    <td>${amount}</td>
                    <td>${deal.payment_method || "-"}</td>
                    <td>${deal.closed_date || "-"}</td>
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
        const res = await fetch(`${BASE_URL}/api/project-tracker?scope=admin`, {
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

        ProjectTrackerUI.renderStats("adminProjectTrackerStats", result.counts, {
            assignmentCounts: result.assignmentCounts,
        });
        ProjectTrackerUI.renderProjects("adminProjectTrackerContainer", result);
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
    document.querySelectorAll('.sidebar li').forEach(li => li.classList.remove('active'));
    const activeLi = Array.from(document.querySelectorAll('.sidebar li'))
        .find(li => li.getAttribute('onclick') && li.getAttribute('onclick').includes(`('${id}')`));
    if (activeLi) activeLi.classList.add('active');
    if (id === 'dashboard') loadAdminDashboard();
    if (id === 'leads') loadLeads();
    if (id === 'appointments') loadAppointments();
    if (id === 'followups') loadFollowups();
    if (id === 'deals') loadDeals();
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
    if (id === 'proposals') {
        window.AdminProposals?.setup();
        window.AdminProposals?.load();
    }
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
    const panel = event.target.closest("[data-dashboard-section]");
    if (!panel || isDashboardPanelActionBlocked(event)) return;

    openAdminSection(panel.dataset.dashboardSection);
});

document.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
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
    const res = await fetch('/api/leads?role=admin'); // ✅ FIX
    const data = await res.json();

    const table = document.getElementById('leadsTable');
    if (!table) return;
    table.innerHTML = '';

    const leads = data.success && Array.isArray(data.data) ? data.data : [];
    adminDashboardCache.leads = leads;
    adminDashboardState.leads = leads;
    renderAdminDashboard();

    if (!leads.length) {
        table.innerHTML = `<tr><td colspan="6">No leads found</td></tr>`;
        return;
    }

    leads.forEach(lead => {
        table.innerHTML += `
            <tr>
                <td>${lead.id}</td>
                <td>${lead.company_name || '-'}</td>
                <td>${lead.client_name || '-'}</td>
                <td>${lead.contact || lead.telephone || '-'}</td>
                <td>${lead.email || '-'}</td>
                <td>${lead.action_type || '-'}</td>
            </tr>
        `;
    });
}   

async function loadAppointments() {
    try {
        const res = await fetch(`/api/appointments?role=admin`);
        const data = await res.json();

        const table = document.getElementById('appointmentsTable');
        if (!table) return;
        table.innerHTML = '';

        const appointments = data.success && Array.isArray(data.data) ? data.data : [];
        adminDashboardCache.appointments = appointments;
        adminDashboardState.appointments = appointments;
        // renderAdminDashboard();

        if (!appointments.length) {
            table.innerHTML = `<tr><td colspan="5">No appointments found</td></tr>`;
            return;
        }

        appointments.forEach(item => {
            table.innerHTML += `
                <tr>
                    <td>${item.company_name || '-'}</td>
                    <td>${item.client_name || '-'}</td>
                    <td>${item.app_date || '-'}</td>
                    <td>${item.app_time || '-'}</td>
                    <td>${item.assign_emp || '-'}</td>
                </tr>
            `;
        });

    } catch (err) {
        console.error("Appointments Error:", err);
    }
}

async function loadFollowups() {
    try {
        const res = await fetch(`/api/followups?role=admin`);
        const data = await res.json();

        const table = document.getElementById('followupsTable');
        if (!table) return;
        table.innerHTML = '';

        const followups = data.success && Array.isArray(data.data) ? data.data : [];
        adminDashboardCache.followups = followups;
        adminDashboardState.followups = followups;
        renderAdminDashboard();

        if (!followups.length) {
            table.innerHTML = `<tr><td colspan="6">No followups found</td></tr>`;
            return;
        }

        followups.forEach(item => {
            table.innerHTML += `
                <tr>
                    <td>${item.company_name || '-'}</td>
                    <td>${item.client_name || '-'}</td>
                    <td>${item.follow_date || '-'}</td>
                    <td>${item.follow_time || '-'}</td>
                    <td>${item.assign_emp || '-'}</td>  <!-- 🔥 EMPLOYEE NAME -->
                    <td>${item.reason || '-'}</td>
                </tr>
            `;
        });

    } catch (err) {
        console.error("Followups Error:", err);
    }
}

async function loadDeals() {
    const res = await fetch('/api/deals?role=admin');
    const data = await res.json();

    const table = document.getElementById('dealsTable');
    if (!table) return;
    table.innerHTML = '';

    const deals = data.success && Array.isArray(data.data) ? data.data : [];
    adminDashboardCache.deals = deals;
    adminDashboardState.deals = deals;
    renderAdminDashboard();
    
    // Calculate counts
    let pendingCount = 0, receivedCount = 0, failedCount = 0;
    
    deals.forEach(item => {
        if (item.pay_stat === 'pending') pendingCount++;
        else if (item.pay_stat === 'received') receivedCount++;
        else if (item.pay_stat === 'failed') failedCount++;

        const invoiceActions = item.pay_stat === 'received'
            ? `
                <div class="invoice-actions">
                    <button onclick="downloadTaxInvoice(${item.id})" class="invoice-btn invoice-download" title="Download Tax Invoice">
                        <i class="fas fa-download"></i>
                    </button>
                    <button onclick="shareTaxInvoiceWhatsApp(${item.id}, '${item.contact || ''}')" class="invoice-btn invoice-whatsapp" title="Share on WhatsApp">
                        <i class="fab fa-whatsapp"></i>
                    </button>
                    <button onclick="shareTaxInvoiceGmail('${item.email || ''}', ${item.id})" class="invoice-btn invoice-gmail" title="Share via Gmail">
                        <i class="fas fa-envelope"></i>
                    </button>
                </div>
            `
            : `<span class="invoice-pending">Available after payment received</span>`;

        const proformaActions = `
                <div class="invoice-actions">
                    <button onclick="downloadProformaInvoice(${item.id})" class="invoice-btn invoice-download" title="Download Proforma Invoice">
                        <i class="fas fa-download"></i>
                    </button>
                    <button onclick="shareProformaInvoiceWhatsApp(${item.id}, '${item.contact || ''}')" class="invoice-btn invoice-whatsapp" title="Share on WhatsApp">
                        <i class="fab fa-whatsapp"></i>
                    </button>
                    <button onclick="shareProformaInvoiceGmail('${item.email || ''}', ${item.id})" class="invoice-btn invoice-gmail" title="Share via Gmail">
                        <i class="fas fa-envelope"></i>
                    </button>
                </div>
            `;
        
        table.innerHTML += `
            <tr>
                <td>${item.company_name}</td>
                <td>${item.client_name}</td>
                <td>${item.deal_amount}</td>
                <td>${item.payment_method}</td>
                <td>
                    <select 
                        class="payment-status ${item.pay_stat || 'pending'}"
                        onchange="updatePaymentStatus(${item.id}, this.value, this)">       
                        
                        <option value="pending" ${item.pay_stat === 'pending' ? 'selected' : ''}>Pending</option>
                        <option value="received" ${item.pay_stat === 'received' ? 'selected' : ''}>Received</option>
                        <option value="failed" ${item.pay_stat === 'failed' ? 'selected' : ''}>Failed</option>
                        
                    </select>
                </td>
                <td>${invoiceActions}</td>
                <td>${proformaActions}</td>
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
    const renewalCount = Number(item.renewal_count || item.has_renewal || 0);
    const closedRenewalCount = Number(item.renewal_closed_count || 0);
    const daysLeft = Number(item.days_left);

    if (closedRenewalCount > 0) {
        return { className: "upcoming", label: "Renewed" };
    }

    if (renewalCount > 0) {
        return { className: "started", label: "Started" };
    }

    if (Number.isFinite(daysLeft) && daysLeft < 0) {
        return { className: "overdue", label: "Overdue" };
    }

    if (daysLeft === 0) {
        return { className: "due-today", label: "Due Today" };
    }

    if (Number.isFinite(daysLeft) && daysLeft <= 30) {
        return { className: "due-soon", label: "Due Soon" };
    }

    return { className: "upcoming", label: "Upcoming" };
}

function renderAdminRenewalSummary(summary = {}) {
    setAdminDashboardText("adminRenewalTotal", String(Number(summary.total || 0)));
    setAdminDashboardText("adminRenewalOverdue", String(Number(summary.overdue || 0)));
    setAdminDashboardText("adminRenewalDueSoon", String(Number(summary.dueSoon || 0)));
    setAdminDashboardText("adminRenewalStarted", String(Number(summary.started || 0)));
}

function renderAdminRenewalRows(renewals = []) {
    const table = document.getElementById("renewalsTable");
    if (!table) return;

    if (!renewals.length) {
        table.innerHTML = `<tr><td colspan="10">No renewal records found</td></tr>`;
        return;
    }

    table.innerHTML = renewals
        .map((item) => {
            const status = getAdminRenewalStatusMeta(item);
            const contact = item.contact || "-";
            const email = item.email || "-";
            const owner = item.owner_name || item.assign_emp || "-";

            return `
                <tr>
                    <td>${escapeAdminHtml(item.company_name || "-")}</td>
                    <td>${escapeAdminHtml(item.client_name || "-")}</td>
                    <td>${escapeAdminHtml(contact)}</td>
                    <td>${escapeAdminHtml(email)}</td>
                    <td>${escapeAdminHtml(formatCompactMoney(item.deal_amount || 0))}</td>
                    <td>${escapeAdminHtml(formatAdminRenewalDate(item.closed_date))}</td>
                    <td>${escapeAdminHtml(formatAdminRenewalDate(item.renewal_due_date))}</td>
                    <td>${escapeAdminHtml(formatAdminRenewalDays(item.days_left))}</td>
                    <td><span class="renewal-status ${status.className}">${escapeAdminHtml(status.label)}</span></td>
                    <td>${escapeAdminHtml(owner)}</td>
                </tr>
            `;
        })
        .join("");
}

async function loadAdminRenewals(forceRefresh = false) {
    const table = document.getElementById("renewalsTable");
    if (!table) return;

    if (forceRefresh || !adminDashboardCache.renewals.length) {
        table.innerHTML = `<tr><td colspan="10">Loading renewals...</td></tr>`;
    }

    try {
        const params = new URLSearchParams({
            days: "365",
        });
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

        const renewals = Array.isArray(result.data) ? result.data : [];
        adminDashboardCache.renewals = renewals;
        adminDashboardState.renewals = renewals;
        renderAdminRenewalSummary(result.summary || {});
        renderAdminRenewalRows(renewals);
    } catch (err) {
        console.error("Admin renewals error:", err);
        renderAdminRenewalSummary({});
        table.innerHTML = `<tr><td colspan="10">${escapeAdminHtml(err.message || "Unable to load renewals")}</td></tr>`;
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
        const requests = data.success && Array.isArray(data.data) ? data.data : [];
        adminDashboardCache.notifications = requests;

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

function downloadTaxInvoice(id) {
    window.open(`${BASE_URL}/api/tax-invoice/${id}`, '_blank');
}

function downloadProformaInvoice(id) {
    window.open(`${BASE_URL}/api/invoice/${id}`, '_blank');
}

async function shareProformaInvoiceWhatsApp(id, phone) {
    try {
        const res = await fetch(`${BASE_URL}/api/invoice/${id}`);
        const blob = await res.blob();

        const file = new File([blob], `proforma_invoice_${id}.pdf`, {
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

        const url = `${BASE_URL}/api/invoice/${id}`;
        const waUrl = `https://wa.me/${phone}?text=${encodeURIComponent(`Proforma Invoice: ${url}`)}`;
        window.open(waUrl, '_blank');
    } catch (err) {
        console.error('Proforma WhatsApp Error:', err);
        showPopup('Error', 'Failed to share proforma invoice', false);
    }
}

async function shareTaxInvoiceWhatsApp(id, phone) {
    try {
        const res = await fetch(`${BASE_URL}/api/tax-invoice/${id}`);
        const blob = await res.blob();

        const file = new File([blob], `tax_invoice_${id}.pdf`, {
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

        const url = `${BASE_URL}/api/tax-invoice/${id}`;
        const waUrl = `https://wa.me/${phone}?text=${encodeURIComponent(`Tax Invoice: ${url}`)}`;
        window.open(waUrl, '_blank');
    } catch (err) {
        console.error('Tax WhatsApp Error:', err);
        showPopup('Error', 'Failed to share tax invoice', false);
    }
}

async function shareTaxInvoiceGmail(email, id) {
    if (!email) {
        showPopup('Error', 'Email not available', false);
        return;
    }

    try {
        const pdfUrl = `${BASE_URL}/api/tax-invoice/${id}`;
        const a = document.createElement('a');
        a.href = pdfUrl;
        a.download = `tax_invoice_${id}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        setTimeout(() => {
            const gmailUrl =
                `https://mail.google.com/mail/?view=cm&fs=1` +
                `&to=${encodeURIComponent(email)}` +
                `&su=${encodeURIComponent('Tax Invoice')}` +
                `&body=${encodeURIComponent('Hi,\n\nPlease find the attached Tax Invoice.\n\nRegards')}`;

            window.open(gmailUrl, '_blank');
        }, 800);
    } catch (err) {
        console.error('Tax Gmail Error:', err);
        showPopup('Error', 'Failed to open Gmail', false);
    }
}

async function shareProformaInvoiceGmail(email, id) {
    if (!email) {
        showPopup('Error', 'Email not available', false);
        return;
    }

    try {
        const pdfUrl = `${BASE_URL}/api/invoice/${id}`;
        const a = document.createElement('a');
        a.href = pdfUrl;
        a.download = `proforma_invoice_${id}.pdf`;
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
    return String(status || "")
        .toLowerCase()
        .trim()
        .replace(/[\s-]+/g, "_");
}

function getAdminAttendanceStatusMeta(status) {
    const normalizedStatus = normalizeAdminAttendanceStatus(status);

    switch (normalizedStatus) {
        case "present":
            return { label: "Present", className: "present" };
        case "grace":
            return { label: "Grace", className: "grace" };
        case "late":
            return { label: "Late", className: "late" };
        case "half_day":
            return { label: "Half Day", className: "half-day" };
        case "checkout_pending":
            return { label: "Pending Checkout", className: "checkout-pending" };
        case "absent":
            return { label: "Absent", className: "absent" };
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
        if (normalizedStatus === "late") summary.late += 1;
        if (normalizedStatus === "half_day") summary.halfDay += 1;
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
    return `${formatValue(startDate)} to ${formatValue(endDate)}`;
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
    const periodText = summaryPayload
        ? formatAdminAttendanceSummaryPeriod(summaryPayload.startDate, summaryPayload.endDate)
        : "selected records";

    container.innerHTML = `
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
                <small>Early check-out or manual half day</small>
            </div>
            <div class="attendance-summary-card checkout-pending">
                <span>Pending</span>
                <strong>${summary.checkoutPending}</strong>
                <small>Check-out still missing</small>
            </div>
            <div class="attendance-summary-card absent">
                <span>Absent</span>
                <strong>${summary.absent}</strong>
                <small>No check-in after day closes</small>
            </div>
            <div class="attendance-summary-card leave">
                <span>Late = Leave</span>
                <strong>${summary.lateLeaveEquivalent}</strong>
                <small>${summary.lateBalance} late pending, every 3 late = 1 leave</small>
            </div>
        </div>
        <p class="attendance-summary-note">
            Summary count is running from ${periodText}. Pending checkout stays editable here, and admin can still resolve or override any selected-day record from the table above.
        </p>
    `;
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
                    ? `Approved radius: ${Number(row.approvedRadiusMeters || row.requestedRadiusMeters || 50000)}m`
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

    const normalizedRole = label.toLowerCase();
    const supportedRoles = ["admin", "tme", "me", "dev", "seo", "smo", "accounts"];
    const roleClass = supportedRoles.includes(normalizedRole)
        ? normalizedRole
        : "default";

    return `<span class="role-badge ${roleClass}">${label.toUpperCase()}</span>`;
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
    const normalized = String(filePath || "").trim().replace(/\\/g, "/").replace(/^\/+/, "");
    if (!normalized) return "";
    if (/^https?:\/\//i.test(normalized)) return normalized;
    return `${BASE_URL}/${normalized}`;
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

function renderAdminAttendanceActions(row) {
    if (!row.has_record) {
        return `<span class="attendance-action-note">${normalizeAdminAttendanceStatus(row.status) === "absent" ? "Auto absent" : "Check-in pending"}</span>`;
    }

    const selectedValue = row.has_override ? normalizeAdminAttendanceStatus(row.status) : "auto";
    const selectId = `adminAttendanceStatus-${row.user_id}`;
    const disableResolve = row.has_pending_checkout ? "" : "disabled";
    const clearOverrideButton = row.has_override
        ? `<button type="button" class="attendance-action-btn subtle" onclick="clearAdminAttendanceOverride(${row.user_id})">Clear</button>`
        : "";

    return `
        <div class="admin-attendance-actions">
            <select id="${selectId}" class="attendance-override-select">
                <option value="auto" ${selectedValue === "auto" ? "selected" : ""}>Auto</option>
                <option value="present" ${selectedValue === "present" ? "selected" : ""}>Present</option>
                <option value="grace" ${selectedValue === "grace" ? "selected" : ""}>Grace</option>
                <option value="late" ${selectedValue === "late" ? "selected" : ""}>Late</option>
                <option value="half_day" ${selectedValue === "half_day" ? "selected" : ""}>Half Day</option>
                <option value="absent" ${selectedValue === "absent" ? "selected" : ""}>Absent</option>
                <option value="checkout_pending" ${selectedValue === "checkout_pending" ? "selected" : ""}>Pending Checkout</option>
            </select>
            <div class="admin-attendance-action-buttons">
                <button type="button" class="attendance-action-btn primary" onclick="saveAdminAttendanceOverride(${row.user_id})">Save</button>
                <button type="button" class="attendance-action-btn warning" onclick="resolveAdminAttendanceNow(${row.user_id})" ${disableResolve}>Resolve Now</button>
                ${clearOverrideButton}
            </div>
        </div>
    `;
}

async function loadAdminAttendance() {
    setupAdminAttendanceControls();

    const tbody = document.getElementById("adminAttendanceTableBody");
    if (!tbody) return;

    const date = document.getElementById("adminAttendanceDate")?.value || getAdminDateKey();
    const role = document.getElementById("adminAttendanceRole")?.value || "";
    const status = document.getElementById("adminAttendanceStatusFilter")?.value || "";
    const params = new URLSearchParams({ date });
    if (role) params.set("role", role);
    if (status) params.set("status", status);

    tbody.innerHTML = `<tr><td colspan="10">Loading attendance...</td></tr>`;
    loadAdminAttendanceLocationRequests();

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
        const rows = result.success ? result.data || [] : [];
        const monthSummary = result.summary || null;

        renderAdminAttendanceSummary(rows, monthSummary);

        if (!rows.length) {
            tbody.innerHTML = `<tr><td colspan="10">No attendance records found</td></tr>`;
            return;
        }

        tbody.innerHTML = rows.map((row) => `
            <tr>
                <td>${formatDate(row.attendance_date)}</td>
                <td>
                    <button type="button" class="attendance-name-btn" onclick="openEmployeeDetails(${row.user_id}, 'attendance')">
                        ${row.user_name || "-"}
                    </button>
                </td>
                <td>${renderAdminRoleBadge(row.role)}</td>
                <td>${row.shift_start || "-"} - ${row.logout_time || "-"}</td>
                <td>${row.check_in || "-"}</td>
                <td>${row.check_out || "-"}</td>
                <td>${row.working_hours || "00:00"}</td>
                <td>${renderAdminAttendanceStatus(row)}</td>
                <td>${formatAdminAttendanceLocation(row)}</td>
                <td>${renderAdminAttendanceActions(row)}</td>
            </tr>
        `).join("");

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

async function loadAdminAttendanceLocationRequests() {
    const tbody = document.getElementById("adminAttendanceRequestTableBody");
    if (!tbody || !currentUser?.id) return;

    const date = document.getElementById("adminAttendanceDate")?.value || getAdminDateKey();
    const role = document.getElementById("adminAttendanceRole")?.value || "";
    const status = document.getElementById("adminAttendanceRequestStatus")?.value || "";
    const params = new URLSearchParams({
        adminId: String(currentUser.id),
        date,
    });

    if (role) params.set("role", role);
    if (status) params.set("status", status);

    tbody.innerHTML = `<tr><td colspan="8">Loading offsite attendance requests...</td></tr>`;

    try {
        const res = await fetch(`${BASE_URL}/api/admin/attendance/location-requests?${params.toString()}`);
        const result = await res.json();

        if (!res.ok || !result.success) {
            throw new Error(result.message || "Failed to load offsite attendance requests");
        }

        const rows = Array.isArray(result.data) ? result.data : [];
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
                            <strong>${escapeAdminAttendanceText(row.requestedAddress || "Requested meeting location")}</strong>
                            <small>${locationUrl ? `<a href="${locationUrl}" target="_blank" rel="noopener noreferrer" class="location-btn table-location-link">Open Map</a>` : "Map unavailable"} | Requested ${Number(row.requestedRadiusMeters || 150)}m</small>
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

async function saveAdminAttendanceOverride(userId) {
    const date = document.getElementById("adminAttendanceDate")?.value;
    const select = document.getElementById(`adminAttendanceStatus-${userId}`);
    if (!date || !select) return;

    try {
        const res = await fetch(`${BASE_URL}/api/admin/attendance/override`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                userId,
                date,
                status: select.value,
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

function clearAdminAttendanceOverride(userId) {
    const select = document.getElementById(`adminAttendanceStatus-${userId}`);
    if (select) {
        select.value = "auto";
    }
    saveAdminAttendanceOverride(userId);
}

async function resolveAdminAttendanceNow(userId) {
    const date = document.getElementById("adminAttendanceDate")?.value;
    if (!date) return;

    try {
        const res = await fetch(`${BASE_URL}/api/admin/attendance/resolve`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                userId,
                date,
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
        const res = await fetch(`${BASE_URL}/api/admin/team-report`);
        const result = await res.json();

        if (!result.success || !result.data) {
            throw new Error("No team data");
        }

        allTeamData = result.data;
        adminDashboardCache.team = result.data;
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
        const res = await fetch(`${BASE_URL}/api/admin/team-report`);
        const result = await res.json();

        if (!result.success || !result.data) {
            throw new Error("No team data");
        }

        allTeamData = result.data;
        adminDashboardCache.team = result.data;
        filterTeamByRole('all');
    } catch (err) {
        console.error("Team Load Error:", err);
        document.getElementById('teamTable').innerHTML = `
            <tr>
                <td colspan="8" style="color:red;padding:20px;">Error loading team data</td>
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

function filterTeamByRole(role) {
    const selectedRole = normalizeAdminTeamRoleForFilter(role);

    // Active button toggle
    document.querySelectorAll('.tab-btn').forEach(btn => {
        const btnRole = normalizeAdminTeamRoleForFilter(btn.dataset.role);

        if (btnRole === selectedRole) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });

    const table = document.getElementById('teamTable');
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
                <td colspan="8" style="padding:30px;color:#64748b;text-align:center;">
                    No users found for this role.
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
                            ${user.name || "-"}
                        </span>

                        ${renderTeamPresenceBadge(user)}
                    </div>
                </td>

                <td>${user.email || "-"}</td>

                <td>${renderAdminRoleBadge(user.role)}</td>

                <td>${user.total_leads || 0}</td>

                <td>${user.total_appointments || 0}</td>

                <td>${user.total_followups || 0}</td>

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
                </td>
            </tr>
        `;
    });

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
    document.getElementById("empRole").textContent = user.role || "-";
    document.getElementById("empRole").className = `role-badge ${(user.role || "").toLowerCase()}`;

    const empPhoto = document.getElementById("empPhoto");
    const role = (user.role || "").toLowerCase();
    let defaultImage = "https://dummyimage.com/150x150/0f172a/ffffff&text=USER";

    if (role === "tme") defaultImage = "https://dummyimage.com/150x150/0f172a/ffffff&text=TME";
    if (role === "me") defaultImage = "https://dummyimage.com/150x150/0f172a/ffffff&text=ME";
    if (role === "dev") defaultImage = "https://dummyimage.com/150x150/0f172a/ffffff&text=DEV";
    if (role === "seo") defaultImage = "https://dummyimage.com/150x150/0f172a/ffffff&text=SEO";
    if (role === "smo") defaultImage = "https://dummyimage.com/150x150/0f172a/ffffff&text=SMO";

    if (user.prof_img && String(user.prof_img).toUpperCase() !== "NULL") {
        empPhoto.src = String(user.prof_img).startsWith("http")
            ? user.prof_img
            : `${BASE_URL}/${user.prof_img}`;
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
            const statusClass = (row.status || "present").toLowerCase().replace(/[\s_]+/g, "-");

            tbody.innerHTML += `
                <tr>
                    <td>${formatDate(row.date)}</td>
                    <td>${row.in_time || "-"}</td>
                    <td>${row.out_time || "-"}</td>
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
    return String(status || "")
        .toLowerCase()
        .trim()
        .replace(/[\s-]+/g, "_");
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

            empLoc.innerHTML = `
                <strong>Live Location:</strong><br>
                Lat: ${lat} | Lng: ${lng}<br>
                <small>Last updated: ${new Date().toLocaleTimeString()}</small>
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
            fetch('/api/leads?role=admin'),
            fetch('/api/appointments?role=admin'),
            fetch('/api/deals?role=admin')
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
        const res = await fetch(`${BASE_URL}/api/projects`);
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
            el.classList.remove('pending', 'received', 'failed');
            el.classList.add(status);

            showPopup("Updated", "Payment status updated", true);
            
            // Reload deals to update heatmap counts
            loadDeals();
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
            return `${getUserRegistrationFileLabel(fieldName)} must be 15 MB or smaller.`;
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

function setAdminAttendanceFaceStatus(message, type = "neutral") {
    const status = document.getElementById("adminAttendanceFaceStatus");
    if (!status) return;

    status.textContent = message || "";
    status.dataset.type = type;
}

function clearAdminAttendanceFaceCapture(message, type = "neutral") {
    const form = getUserFormElement();
    if (form?.elements?.attendance_face_image) {
        form.elements.attendance_face_image.value = "";
    }
    if (form?.elements?.attendance_face_signature) {
        form.elements.attendance_face_signature.value = "";
    }

    setAdminAttendanceFaceStatus(
        message || "Employee can also complete this from profile setup link.",
        type,
    );
}

async function captureAdminAttendanceFaceEnrollment() {
    const button = document.getElementById("adminAttendanceFaceCaptureBtn");
    const form = getUserFormElement();

    if (!window.AttendanceFace?.captureEnrollment) {
        setAdminAttendanceFaceStatus("Camera module is not loaded.", "error");
        return;
    }

    try {
        if (button) button.disabled = true;
        setAdminAttendanceFaceStatus("Opening camera...", "neutral");
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

        setAdminAttendanceFaceStatus("Live face photo captured privately.", "success");
    } catch (err) {
        setAdminAttendanceFaceStatus(err.message || "Face capture failed. Please retry.", "error");
    } finally {
        if (button) button.disabled = false;
    }
}

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
    if (!employeeCodeField) return;

    const companyScope =
        normalizeAdminPanelCompanyKey(form?.elements?.comp_name?.value) ||
        getAdminPanelCompanyScope();
    const query = new URLSearchParams({
        company: companyScope,
        company_scope: companyScope,
    });

    employeeCodeField.value = "Generating...";

    try {
        const response = await fetch(`${BASE_URL}/api/users/next-employee-code?${query.toString()}`, {
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
        console.warn("Next employee code load failed:", error);
        employeeCodeField.value = "Auto-generated";
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
    clearAdminAttendanceFaceCapture();

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

function openUserForm() {
    resetUserFormState();
    showUserFormModal();
    window.requestAnimationFrame(() => {
        populateNextEmployeeCode();
    });
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
        clearAdminAttendanceFaceCapture(
            user.attendance_face_enrolled
                ? "Face setup already saved. Capture again only to replace it."
                : "No face setup saved yet. Employee can also complete it from profile setup link.",
            user.attendance_face_enrolled ? "success" : "neutral",
        );
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

function openAdminLeadForm() {
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
    loadAdminLeadEmployees();

    const firstField = form.querySelector("input, select, textarea, button");
    if (firstField) {
        setTimeout(() => firstField.focus(), 0);
    }
}

function closeAdminLeadForm() {
    const modal = document.getElementById("adminLeadModal");
    if (!modal) return;

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
}

function toggleAdminLeadActionSections() {
    const actionType =
        document.getElementById("adminLeadActionType")?.value || "appointment";
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

    setAdminLeadSectionVisibility(appointmentSection, isAppointment);
    setAdminLeadSectionVisibility(followupSection, !isAppointment);

    appointmentFields.forEach((field) => {
        if (field) field.required = isAppointment;
    });

    followupFields.forEach((field) => {
        if (field) field.required = !isAppointment;
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

    if (employeeSelect) {
        employeeSelect.innerHTML = '<option value="">Select Employee</option>';
    }

    if (actionType) {
        actionType.value = "appointment";
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
        const option = document.createElement("option");
        option.value = employee.name || "";
        option.textContent = employee.name || "Unnamed Employee";
        option.dataset.employeeId =
            employee.id != null ? String(employee.id) : "";
        option.dataset.employeeContact = employee.contact
            ? String(employee.contact)
            : "";
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
        };
    }

    const option = select.options[select.selectedIndex];

    return {
        name: select.value || "",
        id: option?.dataset?.employeeId || "",
        contact: option?.dataset?.employeeContact || "",
    };
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
        document.getElementById("adminLeadActionType")?.value || "appointment";
    const selectedEmployee = getSelectedAdminLeadEmployeeMeta("adminLeadAssignEmp");
    const submitBtn =
        document.getElementById("adminLeadSubmitBtn") ||
        formElement.querySelector(".submit-btn");
    const originalText = submitBtn ? submitBtn.innerHTML : "";
    const mapsLink = document.getElementById("adminLeadMapsLink")?.value || "";
    const locationValue = formData.get("location") || mapsLink || "";

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
        company_scope: formData.get("company_scope") || getDefaultAdminLeadCompanyScope(),
        source_lead: formData.get("source_lead"),
        industry_type: formData.get("industry_type"),
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
        location: actionTypeValue === "appointment" ? locationValue : null,
        follow_date:
            actionTypeValue === "followup" ? formData.get("follow_date") : null,
        follow_time:
            actionTypeValue === "followup" ? formData.get("follow_time") : null,
        reason: actionTypeValue === "followup" ? formData.get("reason") : null,
        additional_notes: formData.get("additional_notes"),
        created_by: currentUser?.id || null,
        created_by_name: currentUser?.name || "",
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
            throw new Error(result.message || "Failed to save client");
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
        seo: ["seo"],
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
        const res = await fetch(`${BASE_URL}/api/projects`);
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
                        `${BASE_URL}/api/available-team?service=${serviceQuery}&services=${serviceQuery}`
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

        const uniqueProjects = Array.from(
            new Map((result.data || []).map(project => [project.id, project])).values()
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
        const res = await fetch(`${BASE_URL}/api/projects-summary`, {
            cache: "no-store",
        });
        const result = await res.json();

        const container = document.getElementById("projectSummaryContainer");
        if (!container) return;
        container.innerHTML = "";

        if (!result.success || !result.data || result.data.length === 0) {
            container.innerHTML = `<div class="summary-empty-state">No project assignments found</div>`;
            return;
        }

        result.data.forEach(item => {
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
const adminAttendanceFaceCaptureBtn = document.getElementById("adminAttendanceFaceCaptureBtn");

if (adminAttendanceFaceCaptureBtn) {
    adminAttendanceFaceCaptureBtn.addEventListener("click", captureAdminAttendanceFaceEnrollment);
}

if (adminRegisterForm) {
    adminRegisterForm.addEventListener("submit", async function (e) {
        e.preventDefault();

        const formData = new FormData(this);
        if (currentUser?.id) {
            formData.set("updated_by", String(currentUser.id));
            formData.set("created_by", String(currentUser.id));
        }
        const isEditMode = userFormMode === "edit" && Boolean(editingUserId);
        const btn = document.getElementById("registerBtn") || this.querySelector(".submit-btn");
        const originalText = btn ? btn.innerHTML : "";

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
                showPopup("Commission", "Commission payout sirf ME/TME role ke liye hai.", false);
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

function toDateKey(value) {
    if (!value) return "";
    const date = new Date(value);
    return getAdminDateKey(date);
}

function getDashboardStatus(item = {}) {
    if (item.lead_status === "deal_closed") return "Won";
    if (item.action_type === "appointment") return "Appointment";
    if (item.action_type === "followup") return "Follow Up";
    if (item.lead_status) return String(item.lead_status).replace(/_/g, " ");
    return "New";
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

function getWeekLabels() {
    const labels = [];
    const today = new Date();

    for (let index = 6; index >= 0; index--) {
        const date = new Date(today);
        date.setDate(today.getDate() - index);
        labels.push({
            key: getAdminDateKey(date),
            label: date.toLocaleDateString("en-GB", { day: "2-digit", month: "short" }),
        });
    }

    return labels;
}

async function loadAdminDashboard() {
    try {
        const [leadsRes, appsRes, followupsRes, dealsRes, teamRes] = await Promise.all([
            fetch(`${BASE_URL}/api/leads?role=admin`),
            fetch(`${BASE_URL}/api/appointments?role=admin`),
            fetch(`${BASE_URL}/api/followups?role=admin`),
            fetch(`${BASE_URL}/api/deals?role=admin`),
            fetch(`${BASE_URL}/api/admin/team-report`),
        ]);

        const [leadsData, appsData, followupsData, dealsData, teamData] = await Promise.all([
            leadsRes.json(),
            appsRes.json(),
            followupsRes.json(),
            dealsRes.json(),
            teamRes.json(),
        ]);

        const leads = leadsData.success && Array.isArray(leadsData.data) ? leadsData.data : [];
        const appointments = appsData.success && Array.isArray(appsData.data) ? appsData.data : [];
        const followups = followupsData.success && Array.isArray(followupsData.data) ? followupsData.data : [];
        const deals = dealsData.success && Array.isArray(dealsData.data) ? dealsData.data : [];
        const team = teamData.success && Array.isArray(teamData.data) ? teamData.data : [];

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
    const leads = Array.isArray(data?.leads) ? data.leads : [];
    const appointments = Array.isArray(data?.appointments) ? data.appointments : [];
    const followups = Array.isArray(data?.followups) ? data.followups : [];
    const deals = Array.isArray(data?.deals) ? data.deals : [];
    const team = Array.isArray(data?.team) ? data.team : [];
    const projects = Array.isArray(data?.projects)
        ? data.projects
        : (Array.isArray(adminDashboardCache.projects) ? adminDashboardCache.projects : []);

    const receivedDeals = deals.filter(item => item.pay_stat === "received");
    const pendingDeals = deals.filter(item => item.pay_stat === "pending" || !item.pay_stat);
    const revenue = receivedDeals.reduce((sum, item) => sum + (Number(item.deal_amount) || 0), 0);
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
    renderAdminActivityFeed(leads, deals, followups);
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
                  lead => `
        <tr>
            <td>${lead.client_name || lead.company_name || "-"}</td>
            <td>${normalizeSource(lead.source_lead || lead.source)}</td>
            <td>${lead.contact || "-"}</td>
            <td><span class="mini-status ${getDashboardStatus(lead).toLowerCase().replace(/\s+/g, "-")}">${getDashboardStatus(lead)}</span></td>
            <td>${lead.assign_emp || "-"}</td>
            <td>${formatDate(getLeadDateValue(lead))}</td>
        </tr>
    `,
              )
              .join("")
        : `<tr><td colspan="6">No leads found</td></tr>`;
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
        <tr>
            <td><strong>${item.client_name || item.company_name || "-"}</strong><small>${item.contact || ""}</small></td>
            <td><i class="fas fa-phone"></i> Call</td>
            <td>${item.assign_emp || "-"}</td>
            <td>${formatDate(item.follow_date)}${item.follow_time ? `, ${item.follow_time}` : ""}</td>
            <td><span class="priority ${index === 0 ? "high" : index < 3 ? "medium" : "low"}">${index === 0 ? "High" : index < 3 ? "Medium" : "Low"}</span></td>
        </tr>
    `,
              )
              .join("")
        : `<tr><td colspan="5">No follow ups found</td></tr>`;
}

function renderAdminActivityFeed(leads, deals, followups) {
    const feed = document.getElementById("adminActivityFeed");
    if (!feed) return;

    const activities = [
        ...leads
            .slice(-3)
            .map(item => ({
                icon: "fa-user-plus",
                color: "green",
                title: `New lead ${item.client_name || item.company_name || "created"}`,
                meta: item.assign_emp || "CRM",
                date: getLeadDateValue(item),
            })),
        ...deals
            .slice(-2)
            .map(item => ({
                icon: "fa-indian-rupee-sign",
                color: "amber",
                title: `Deal updated ${item.company_name || ""}`,
                meta: formatCurrency(item.deal_amount),
                date: item.closed_date || getLeadDateValue(item),
            })),
        ...followups
            .slice(-2)
            .map(item => ({
                icon: "fa-phone",
                color: "violet",
                title: `Follow up with ${item.client_name || item.company_name || "lead"}`,
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
        <div class="activity-item">
            <span class="activity-icon ${item.color}"><i class="fas ${item.icon}"></i></span>
            <div>
                <strong>${item.title}</strong>
                <p>${item.meta}</p>
            </div>
            <small>${formatDate(item.date)}</small>
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
