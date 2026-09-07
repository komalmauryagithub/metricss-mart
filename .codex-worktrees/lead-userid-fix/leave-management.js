(function leaveManagementBootstrap() {
  const SECTION_ID = "leaveManagement";
  const LOCAL_BACKEND_ORIGIN = "http://localhost:3000";
  const EMPLOYEE_FILTERS = ["all", "pending", "approved", "rejected"];
  const LEAVE_TYPE_LABELS = {
    casual_leave: "Casual Leave",
    sick_leave: "Sick Leave",
    emergency_leave: "Emergency Leave",
    half_day: "Half Day",
    work_from_home: "Work From Home",
  };
  const STATUS_META = {
    pending: { label: "Pending", className: "pending" },
    approved: { label: "Approved", className: "approved" },
    rejected: { label: "Rejected", className: "rejected" },
  };

  let currentUser = null;
  let currentMode = "employee";
  let leaveNavItem = null;
  let employeeLeaves = [];
  let employeeActiveFilter = "all";
  let leaderLeaves = [];
  let leaderPendingAction = { leaveId: 0, status: "approved" };
  let adminLeaves = [];
  let adminLeaveBalances = [];
  let adminPendingAction = { leaveId: 0, status: "pending" };
  let leaderSearchTimer = null;
  let adminSearchTimer = null;
  let leaveLeaderEmails = {};

  function getLocalDateKey(date = new Date()) {
    const safeDate = date instanceof Date ? date : new Date(date);
    if (Number.isNaN(safeDate.getTime())) return "";

    const year = safeDate.getFullYear();
    const month = String(safeDate.getMonth() + 1).padStart(2, "0");
    const day = String(safeDate.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  async function init() {
    if (ensurePanelOnBackendOrigin()) {
      return;
    }

    currentUser = getCurrentUser();
    const sidebarList = document.querySelector(".sidebar ul");
    const mainContent = document.querySelector(".main-content");

    if (!currentUser || !sidebarList || !mainContent || document.getElementById(SECTION_ID)) {
      return;
    }

    try {
      await loadLeaveLeaderConfig();
    } catch (error) {
      leaveLeaderEmails = {};
      console.error("Leave leader config load failed:", error);
    }

    currentMode = normalizeKey(currentUser.role) === "admin" ? "admin" : "employee";
    injectLeaveSection(mainContent);
    injectLeaveNav(sidebarList);
    bindStaticEvents();

    window.LeaveManagementUI = {
      activateSection,
      refresh: loadCurrentView,
    };
  }

  function getCurrentUser() {
    try {
      const rawUser = localStorage.getItem("currentUser");
      return rawUser ? JSON.parse(rawUser) : null;
    } catch (error) {
      return null;
    }
  }

  function getCurrentPageName() {
    const pathname = String(window.location.pathname || "");
    const segments = pathname.split("/").filter(Boolean);
    const pageName = segments[segments.length - 1] || "";
    return /\.html$/i.test(pageName) ? pageName : "";
  }

  function ensurePanelOnBackendOrigin() {
    const currentHost = String(window.location.hostname || "").toLowerCase();
    const currentPort = String(window.location.port || "").trim();
    const isFilePanel = window.location.protocol === "file:";
    const isLocalPanelOnWrongPort =
      ["localhost", "127.0.0.1"].includes(currentHost) &&
      currentPort &&
      currentPort !== "3000";

    if (!isFilePanel && !isLocalPanelOnWrongPort) {
      return false;
    }

    const pageName = getCurrentPageName();
    if (!pageName) {
      return false;
    }

    const targetUrl = `${LOCAL_BACKEND_ORIGIN}/${pageName}`;
    if (window.location.href === targetUrl) {
      return false;
    }

    window.location.replace(targetUrl);
    return true;
  }

  function getBaseUrl() {
    const { protocol, hostname, port, origin } = window.location;
    if (protocol === "file:") {
      return LOCAL_BACKEND_ORIGIN;
    }

    if (["localhost", "127.0.0.1"].includes(hostname) && port && port !== "3000") {
      return LOCAL_BACKEND_ORIGIN;
    }

    if (["localhost", "127.0.0.1"].includes(hostname) && !port) {
      return LOCAL_BACKEND_ORIGIN;
    }

    if (typeof BASE_URL !== "undefined" && typeof BASE_URL === "string" && BASE_URL.trim()) {
      return BASE_URL.trim().replace(/\/+$/, "");
    }

    return origin || "https://metrics-mart-gf6l.onrender.com";
  }

  async function requestJson(url, options = {}, fallbackMessage = "Request failed") {
    const response = await fetch(url, options);
    const rawText = await response.text();
    const contentType = String(response.headers.get("content-type") || "").toLowerCase();

    if (!rawText.trim()) {
      return { response, result: {} };
    }

    if (!contentType.includes("application/json")) {
      throw new Error(fallbackMessage);
    }

    try {
      return {
        response,
        result: JSON.parse(rawText),
      };
    } catch (error) {
      throw new Error(fallbackMessage);
    }
  }

  async function loadLeaveLeaderConfig() {
    const { response, result } = await requestJson(
      `${getBaseUrl()}/leave-leader-config.json`,
      { cache: "no-store" },
      "Failed to load leave settings",
    );

    if (!response.ok || !result || typeof result !== "object" || Array.isArray(result)) {
      throw new Error("Failed to load leave settings");
    }

    leaveLeaderEmails = Object.entries(result).reduce(function buildLeaderMap(config, entry) {
      const role = normalizeKey(entry[0]);
      const email = normalizeEmail(entry[1]);
      if (role && email) {
        config[role] = email;
      }
      return config;
    }, {});
  }

  function normalizeKey(value) {
    return String(value || "")
      .toLowerCase()
      .trim()
      .replace(/[\s-]+/g, "_");
  }

  function normalizeEmail(value) {
    return String(value || "")
      .trim()
      .toLowerCase();
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function formatLeaveTypeLabel(value) {
    const normalized = normalizeKey(value);
    return LEAVE_TYPE_LABELS[normalized] || prettifyLabel(normalized || value);
  }

  function formatStatusLabel(value) {
    const normalized = normalizeKey(value);
    return STATUS_META[normalized]?.label || prettifyLabel(normalized || value);
  }

  function prettifyLabel(value) {
    return String(value || "")
      .replace(/[_-]+/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .replace(/\b\w/g, function capitalize(letter) {
        return letter.toUpperCase();
      });
  }

  function formatDateDisplay(dateValue) {
    const match = String(dateValue || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!match) return "-";

    const year = Number(match[1]);
    const month = Number(match[2]) - 1;
    const day = Number(match[3]);
    const date = new Date(year, month, day);

    return new Intl.DateTimeFormat("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(date);
  }

  function formatDateTimeDisplay(dateValue) {
    if (!dateValue) return "-";

    const parsedDate = new Date(dateValue);
    if (Number.isNaN(parsedDate.getTime())) {
      return escapeHtml(dateValue);
    }

    return new Intl.DateTimeFormat("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(parsedDate);
  }

  function formatDays(totalDays) {
    const numericValue = Number(totalDays || 0);
    if (!Number.isFinite(numericValue) || numericValue <= 0) return "-";

    const printableValue = Number.isInteger(numericValue)
      ? String(numericValue)
      : numericValue.toFixed(1);

    return `${printableValue} ${numericValue === 1 ? "Day" : "Days"}`;
  }

  function formatBalanceValue(value) {
    const numericValue = Number(value || 0);
    if (!Number.isFinite(numericValue)) return "0";
    return Number.isInteger(numericValue)
      ? String(numericValue)
      : numericValue.toFixed(1);
  }

  function formatMonthKeyLabel(monthKey) {
    const match = String(monthKey || "").match(/^(\d{4})-(\d{2})$/);
    if (!match) return "Current Month";

    const formattedDate = new Date(Number(match[1]), Number(match[2]) - 1, 1);
    return new Intl.DateTimeFormat("en-IN", {
      month: "short",
      year: "numeric",
    }).format(formattedDate);
  }

  function computeLeaveDays(fromDate, toDate, leaveType) {
    if (!fromDate || !toDate) return { days: 0, valid: false };

    if (normalizeKey(leaveType) === "half_day") {
      if (fromDate !== toDate) {
        return { days: 0, valid: false, message: "Half Day leave only supports one date." };
      }

      return { days: 0.5, valid: true };
    }

    const start = new Date(`${fromDate}T00:00:00`);
    const end = new Date(`${toDate}T00:00:00`);

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) {
      return { days: 0, valid: false, message: "Please select a valid date range." };
    }

    const difference = Math.round((end.getTime() - start.getTime()) / 86400000) + 1;
    return { days: difference, valid: difference > 0 };
  }

  function notify(title, message, isSuccess) {
    if (typeof window.showPopup === "function") {
      window.showPopup(title, message, isSuccess);
      return;
    }

    window.alert(`${title}: ${message}`);
  }

  function renderStatusBadge(status) {
    const normalized = normalizeKey(status);
    const meta = STATUS_META[normalized] || STATUS_META.pending;
    return `<span class="leave-status-badge ${meta.className}">${meta.label}</span>`;
  }

  function renderLeaveTypeBadge(leaveType) {
    const normalized = normalizeKey(leaveType);
    return `<span class="leave-type-badge ${normalized}">${formatLeaveTypeLabel(leaveType)}</span>`;
  }

  function renderRoleBadge(role) {
    const normalized = normalizeKey(role);
    return `<span class="role-badge ${normalized || "default"}">${escapeHtml(String(role || "-").toUpperCase())}</span>`;
  }

  function getConfiguredLeaderEmail(role = currentUser?.role) {
    return normalizeEmail(leaveLeaderEmails[normalizeKey(role)]);
  }

  function isCurrentUserLeader() {
    return Boolean(getConfiguredLeaderEmail())
      && normalizeEmail(currentUser?.email) === getConfiguredLeaderEmail();
  }

  function shouldShowLeaderReviewPanel() {
    return currentMode !== "admin" && isCurrentUserLeader();
  }

  function renderApprovalSummary(row) {
    const flowLabel = escapeHtml(row?.approval_flow_label || formatStatusLabel(row?.status || "pending"));
    const remarkLabel = escapeHtml(row?.review_remark || "Awaiting review");
    return `
      <div class="leave-note-stack">
        <strong>${flowLabel}</strong>
        <span>${remarkLabel}</span>
      </div>
    `;
  }

  function createEmployeeSectionMarkup() {
    return `
      <div class="leave-shell employee-mode">
        <div class="leave-hero">
          <div>
            <span class="leave-eyebrow">Leave Management</span>
            <h2>Apply leave and track request status from one clean section</h2>
            <p>Use this section to submit leave requests and follow leader or admin approval updates without leaving your daily panel.</p>
          </div>
          <div class="leave-hero-actions">
            <div id="leaveTodayChip" class="leave-chip-note">
              <i class="fas fa-clock"></i>
              <span>Checking today's leave status...</span>
            </div>
            <button type="button" id="openLeaveRequestBtn" class="leave-primary-btn">
              <i class="fas fa-plus"></i> Apply for Leave
            </button>
          </div>
        </div>

        <div class="leave-summary-grid leave-summary-grid-employee">
          <div class="leave-summary-card balance">
            <div class="leave-summary-icon"><i class="fas fa-wallet"></i></div>
            <div class="leave-summary-copy">
              <span>Available Paid Leaves</span>
              <strong id="myLeaveAvailableBalance">0</strong>
              <small id="myLeaveAvailableBalanceHint">Current approved leave balance</small>
            </div>
          </div>
          <div class="leave-summary-card credit">
            <div class="leave-summary-icon"><i class="fas fa-calendar-plus"></i></div>
            <div class="leave-summary-copy">
              <span>Monthly Credit</span>
              <strong id="myLeaveMonthlyCredit">1</strong>
              <small id="myLeaveMonthlyCreditHint">1 paid leave gets added every month</small>
            </div>
          </div>
          <div class="leave-summary-card usage">
            <div class="leave-summary-icon"><i class="fas fa-check-double"></i></div>
            <div class="leave-summary-copy">
              <span>Paid Leaves Used</span>
              <strong id="myLeavePaidUsed">0</strong>
              <small id="myLeavePaidUsedHint">Approved leaves used from your balance</small>
            </div>
          </div>
        </div>

        ${shouldShowLeaderReviewPanel() ? createLeaderReviewCardMarkup() : ""}

        <div class="leave-table-card">
          <div class="leave-table-toolbar">
            <div>
              <h3>My Leave Requests</h3>
              <p>Pending, approved and rejected leave updates with full approval flow details.</p>
            </div>
            <div class="leave-status-tabs" id="employeeLeaveTabs">
              ${EMPLOYEE_FILTERS.map(function renderFilterButton(filterKey) {
                const label = filterKey === "all" ? "All History" : formatStatusLabel(filterKey);
                const activeClass = filterKey === employeeActiveFilter ? " active" : "";
                return `<button type="button" class="leave-status-tab${activeClass}" data-leave-filter="${filterKey}">${label}</button>`;
              }).join("")}
            </div>
          </div>

          <div class="leave-filter-grid">
            <div class="leave-input-wrap">
              <i class="fas fa-search"></i>
              <input type="search" id="myLeaveSearchInput" class="leave-search-input" placeholder="Search by leave type, status or reason..." />
            </div>
            <div id="myLeaveCountChip" class="leave-chip-note leave-chip-note-soft">
              <i class="fas fa-layer-group"></i>
              <span>0 leave requests on record</span>
            </div>
          </div>

          <div class="leave-table-wrapper">
            <table class="leave-table">
              <thead>
                <tr>
                  <th>Leave Type</th>
                  <th>From Date</th>
                  <th>To Date</th>
                  <th>Total Days</th>
                  <th>Reason</th>
                  <th>Request Date</th>
                  <th>Status</th>
                  <th>Approval Notes</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody id="myLeaveTableBody">
                <tr><td colspan="9" class="leave-empty-state">Loading leave history...</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  }

  function createLeaderReviewCardMarkup() {
    return `
      <div class="leave-table-card leave-leader-card">
        <div class="leave-table-toolbar">
          <div>
            <h3>Team Leave Requests</h3>
            <p>Review requests routed to you before the admin dashboard tracks the final outcome.</p>
          </div>
          <div id="leaderLeaveCountChip" class="leave-chip-note leave-chip-note-soft">
            <i class="fas fa-user-check"></i>
            <span>Loading your review queue...</span>
          </div>
        </div>

        <div class="leave-filter-grid leave-leader-filter-grid">
          <div class="leave-input-wrap">
            <i class="fas fa-search"></i>
            <input type="search" id="leaderLeaveSearchInput" class="leave-search-input" placeholder="Search team member name..." />
          </div>
          <select id="leaderLeaveStatusFilter" class="leave-select">
            <option value="">All Status</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
          <button type="button" id="refreshLeaderLeavesBtn" class="leave-secondary-btn">
            <i class="fas fa-rotate-right"></i> Refresh Queue
          </button>
        </div>

        <div class="leave-table-wrapper">
          <table class="leave-table">
            <thead>
              <tr>
                <th>Employee</th>
                <th>Role</th>
                <th>Leave Type</th>
                <th>Leave Dates</th>
                <th>Total Days</th>
                <th>Reason</th>
                <th>Status</th>
                <th>Approval Notes</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody id="leaderLeaveTableBody">
              <tr><td colspan="9" class="leave-empty-state">Loading leader leave queue...</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  function createAdminSectionMarkup() {
    return `
      <div class="leave-shell admin-mode">
        <div class="leave-hero">
          <div>
            <span class="leave-eyebrow">Leave Management</span>
            <h2>Control every leave request from one professional admin dashboard</h2>
            <p>Review requests across TME, ME, DEV, SEO and SMO teams, filter live records, and approve or reject requests without reloading the CRM.</p>
          </div>
          <div class="leave-hero-actions">
            <div class="leave-chip-note">
              <i class="fas fa-bell"></i>
              <span>Real-time dashboard updates</span>
            </div>
            <button type="button" id="refreshAdminLeavesBtn" class="leave-secondary-btn">
              <i class="fas fa-rotate-right"></i> Refresh Dashboard
            </button>
          </div>
        </div>

        <div class="leave-summary-grid">
          <div class="leave-summary-card total">
            <div class="leave-summary-icon"><i class="fas fa-layer-group"></i></div>
            <div class="leave-summary-copy">
              <span>Total Leave Requests</span>
              <strong id="adminLeaveTotalRequests">0</strong>
              <small>All leave applications submitted</small>
            </div>
          </div>
          <div class="leave-summary-card pending">
            <div class="leave-summary-icon"><i class="fas fa-hourglass-half"></i></div>
            <div class="leave-summary-copy">
              <span>Pending Requests</span>
              <strong id="adminLeavePendingRequests">0</strong>
              <small>Awaiting leader or admin decision</small>
            </div>
          </div>
          <div class="leave-summary-card approved">
            <div class="leave-summary-icon"><i class="fas fa-circle-check"></i></div>
            <div class="leave-summary-copy">
              <span>Approved Leaves</span>
              <strong id="adminLeaveApprovedRequests">0</strong>
              <small>Approved successfully</small>
            </div>
          </div>
          <div class="leave-summary-card rejected">
            <div class="leave-summary-icon"><i class="fas fa-ban"></i></div>
            <div class="leave-summary-copy">
              <span>Rejected Leaves</span>
              <strong id="adminLeaveRejectedRequests">0</strong>
              <small>Rejected after review remarks</small>
            </div>
          </div>
          <div class="leave-summary-card onleave">
            <div class="leave-summary-icon"><i class="fas fa-user-clock"></i></div>
            <div class="leave-summary-copy">
              <span>Employees On Leave Today</span>
              <strong id="adminLeaveOnToday">0</strong>
              <small>Approved leave coverage for today</small>
            </div>
          </div>
          <div class="leave-summary-card balance">
            <div class="leave-summary-icon"><i class="fas fa-wallet"></i></div>
            <div class="leave-summary-copy">
              <span>Team Available Leaves</span>
              <strong id="adminLeaveAvailableBalance">0</strong>
              <small id="adminLeaveAvailableBalanceHint">Current paid leave balance across team</small>
            </div>
          </div>
        </div>

        <div class="leave-table-card leave-balance-card">
          <div class="leave-table-toolbar">
            <div>
              <h3>Employee Leave Balances</h3>
              <p id="adminLeaveBalanceMeta">Track each employee's current paid leave balance.</p>
            </div>
            <div class="leave-chip-note leave-chip-note-soft">
              <i class="fas fa-calendar-plus"></i>
              <span>1 paid leave is available for the current month</span>
            </div>
          </div>

          <div class="leave-table-wrapper">
            <table class="leave-table leave-balance-table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Role</th>
                  <th>Available</th>
                  <th>Monthly Credit</th>
                  <th>Paid Leaves Used</th>
                  <th>As Of</th>
                </tr>
              </thead>
              <tbody id="adminLeaveBalanceBody">
                <tr><td colspan="6" class="leave-empty-state">Loading leave balances...</td></tr>
              </tbody>
            </table>
          </div>
        </div>

        <div class="leave-table-card">
          <div class="leave-table-toolbar">
            <div>
              <h3>All Leave Requests</h3>
              <p id="adminLeaveTableMeta">Live leave requests across the full team with leader visibility.</p>
            </div>
            <button type="button" id="clearAdminLeaveFiltersBtn" class="leave-ghost-btn">
              <i class="fas fa-filter-circle-xmark"></i> Clear Filters
            </button>
          </div>

          <div class="leave-filter-grid">
            <div class="leave-input-wrap">
              <i class="fas fa-search"></i>
              <input type="search" id="adminLeaveSearchInput" class="leave-search-input" placeholder="Filter by employee name..." />
            </div>
            <select id="adminLeaveRoleFilter" class="leave-select">
              <option value="">All Roles</option>
              <option value="tme">TME</option>
              <option value="me">ME</option>
              <option value="dev">DEV</option>
              <option value="seo">SEO</option>
              <option value="smo">SMO</option>
              <option value="accounts">Accounts</option>
            </select>
            <select id="adminLeaveStatusFilter" class="leave-select">
              <option value="">All Status</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
            <input type="date" id="adminLeaveDateFilter" class="leave-date-input" />
          </div>

          <div class="leave-table-wrapper">
            <table class="leave-table">
              <thead>
                <tr>
                  <th>Employee Name</th>
                  <th>Role</th>
                  <th>Leave Balance</th>
                  <th>Leave Type</th>
                  <th>Leave Dates</th>
                  <th>Total Days</th>
                  <th>Reason</th>
                  <th>Request Date</th>
                  <th>Status</th>
                  <th>Approval Flow</th>
                  <th>Notes</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody id="adminLeaveTableBody">
                <tr><td colspan="12" class="leave-empty-state">Loading leave dashboard...</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  }

  function createEmployeeModalMarkup() {
    return `
      <div id="leaveRequestModal" class="leave-modal leave-hidden" aria-hidden="true">
        <div class="leave-modal-panel">
          <div class="leave-modal-head">
            <div>
              <h3>Apply for Leave</h3>
              <p>Create a leave request with dates and reason for quick approval.</p>
            </div>
            <button type="button" id="closeLeaveRequestModalBtn" class="leave-icon-btn" aria-label="Close leave request modal">
              <i class="fas fa-xmark"></i>
            </button>
          </div>
          <form id="leaveRequestForm">
            <div class="leave-modal-body">
              <div class="leave-form-grid">
                <div class="leave-field">
                  <label for="leaveTypeSelect">Leave Type</label>
                  <select id="leaveTypeSelect" class="leave-select" required>
                    <option value="casual_leave">Casual Leave</option>
                    <option value="sick_leave">Sick Leave</option>
                    <option value="emergency_leave">Emergency Leave</option>
                    <option value="half_day">Half Day</option>
                    <option value="work_from_home">Work From Home</option>
                  </select>
                </div>
                <div class="leave-field">
                  <label for="leaveFromDate">From Date</label>
                  <input type="date" id="leaveFromDate" class="leave-date-input" required />
                </div>
                <div class="leave-field">
                  <label for="leaveToDate">To Date</label>
                  <input type="date" id="leaveToDate" class="leave-date-input" required />
                </div>
                <div class="leave-field full">
                  <label for="leaveReasonInput">Reason</label>
                  <textarea id="leaveReasonInput" class="leave-textarea" placeholder="Briefly explain why you need this leave..." required></textarea>
                </div>
              </div>
              <div class="leave-duration-strip">
                <strong id="leaveDurationValue">0 Days</strong>
                <span id="leaveDurationHint">Choose leave type and dates to auto-calculate total leave duration.</span>
              </div>
            </div>
            <div class="leave-modal-foot">
              <button type="button" id="cancelLeaveRequestBtn" class="leave-secondary-btn">Cancel</button>
              <button type="submit" id="submitLeaveRequestBtn" class="leave-primary-btn">
                <i class="fas fa-paper-plane"></i> Submit Leave Request
              </button>
            </div>
          </form>
        </div>
      </div>
    `;
  }

  function createLeaderActionModalMarkup() {
    return `
      <div id="leaveLeaderActionModal" class="leave-modal leave-hidden" aria-hidden="true">
        <div class="leave-modal-panel">
          <div class="leave-modal-head">
            <div>
              <h3 id="leaveLeaderActionTitle">Review Team Leave</h3>
              <p id="leaveLeaderActionSubtitle">Approve or reject the leave request routed to your queue.</p>
            </div>
            <button type="button" id="closeLeaveLeaderActionModalBtn" class="leave-icon-btn" aria-label="Close leader action modal">
              <i class="fas fa-xmark"></i>
            </button>
          </div>
          <div class="leave-modal-body">
            <div id="leaveLeaderActionSummary" class="leave-request-summary"></div>
            <div class="leave-field full">
              <label for="leaveLeaderRemarkInput">Leader Note</label>
              <textarea id="leaveLeaderRemarkInput" class="leave-textarea" placeholder="Optional for approval, required for rejection..."></textarea>
            </div>
            <p id="leaveLeaderRemarkNote" class="leave-admin-note">Add context for this team leave decision.</p>
          </div>
          <div class="leave-modal-foot">
            <button type="button" id="cancelLeaveLeaderActionBtn" class="leave-secondary-btn">Cancel</button>
            <button type="button" id="confirmLeaveLeaderActionBtn" class="leave-primary-btn">
              <i class="fas fa-floppy-disk"></i> Save Decision
            </button>
          </div>
        </div>
      </div>
    `;
  }

  function createAdminActionModalMarkup() {
    return `
      <div id="leaveAdminActionModal" class="leave-modal leave-hidden" aria-hidden="true">
        <div class="leave-modal-panel">
          <div class="leave-modal-head">
            <div>
              <h3 id="leaveAdminActionTitle">Update Leave Status</h3>
              <p id="leaveAdminActionSubtitle">Review this request and confirm the final leave decision.</p>
            </div>
            <button type="button" id="closeLeaveAdminActionModalBtn" class="leave-icon-btn" aria-label="Close leave status modal">
              <i class="fas fa-xmark"></i>
            </button>
          </div>
          <div class="leave-modal-body">
            <div id="leaveAdminActionSummary" class="leave-admin-summary-box">
              <strong>Loading leave request...</strong>
              <span>Preparing leave details for status update.</span>
            </div>
            <div class="leave-field full">
              <label for="leaveAdminRemarkInput">Admin Remark</label>
              <textarea id="leaveAdminRemarkInput" class="leave-textarea" placeholder="Add approval note or rejection reason here..."></textarea>
              <div id="leaveAdminRemarkNote" class="leave-admin-note"></div>
            </div>
          </div>
          <div class="leave-modal-foot">
            <button type="button" id="cancelLeaveAdminActionBtn" class="leave-secondary-btn">Cancel</button>
            <button type="button" id="confirmLeaveAdminActionBtn" class="leave-primary-btn">
              <i class="fas fa-floppy-disk"></i> Save Status
            </button>
          </div>
        </div>
      </div>
    `;
  }

  function injectLeaveSection(mainContent) {
    const section = document.createElement("div");
    section.id = SECTION_ID;
    section.className = "section";
    section.innerHTML = currentMode === "admin"
      ? createAdminSectionMarkup()
      : createEmployeeSectionMarkup();
    mainContent.appendChild(section);
    document.body.setAttribute("data-leave-panel", currentMode);

    const modalMarkup = currentMode === "admin"
      ? createAdminActionModalMarkup()
      : createEmployeeModalMarkup() + (shouldShowLeaderReviewPanel() ? createLeaderActionModalMarkup() : "");
    document.body.insertAdjacentHTML("beforeend", modalMarkup);
  }

  function injectLeaveNav(sidebarList) {
    leaveNavItem = document.createElement("li");
    leaveNavItem.className = "leave-management-nav";
    leaveNavItem.innerHTML = currentMode === "admin"
      ? `<i class="fas fa-calendar-minus"></i> Leave Management`
      : `<i class="fas fa-calendar-minus"></i> Leave`;
    leaveNavItem.addEventListener("click", function handleLeaveNavClick() {
      activateSection();
    });
    sidebarList.appendChild(leaveNavItem);
  }

  function bindStaticEvents() {
    document.addEventListener("click", handleDelegatedClick);

    if (currentMode === "admin") {
      document.getElementById("refreshAdminLeavesBtn")?.addEventListener("click", loadAdminLeaves);
      document.getElementById("clearAdminLeaveFiltersBtn")?.addEventListener("click", clearAdminFilters);
      document.getElementById("closeLeaveAdminActionModalBtn")?.addEventListener("click", closeAdminActionModal);
      document.getElementById("cancelLeaveAdminActionBtn")?.addEventListener("click", closeAdminActionModal);
      document.getElementById("confirmLeaveAdminActionBtn")?.addEventListener("click", submitAdminLeaveAction);

      ["adminLeaveSearchInput", "adminLeaveRoleFilter", "adminLeaveStatusFilter", "adminLeaveDateFilter"].forEach(function bindFilter(id) {
        const element = document.getElementById(id);
        if (!element) return;

        const eventName = id === "adminLeaveSearchInput" ? "input" : "change";
        element.addEventListener(eventName, scheduleAdminLeaveRefresh);
      });
    } else {
      document.getElementById("openLeaveRequestBtn")?.addEventListener("click", openLeaveRequestModal);
      document.getElementById("closeLeaveRequestModalBtn")?.addEventListener("click", closeLeaveRequestModal);
      document.getElementById("cancelLeaveRequestBtn")?.addEventListener("click", closeLeaveRequestModal);
      document.getElementById("leaveRequestForm")?.addEventListener("submit", submitLeaveRequest);
      document.getElementById("leaveTypeSelect")?.addEventListener("change", updateLeaveDurationPreview);
      document.getElementById("leaveFromDate")?.addEventListener("change", updateLeaveDurationPreview);
      document.getElementById("leaveToDate")?.addEventListener("change", updateLeaveDurationPreview);
      document.getElementById("myLeaveSearchInput")?.addEventListener("input", renderEmployeeLeaveTable);
      document.getElementById("employeeLeaveTabs")?.addEventListener("click", function handleLeaveTabClick(event) {
        const button = event.target.closest("[data-leave-filter]");
        if (!button) return;

        employeeActiveFilter = button.getAttribute("data-leave-filter") || "all";
        document.querySelectorAll("#employeeLeaveTabs .leave-status-tab").forEach(function toggleTab(tabButton) {
          tabButton.classList.toggle("active", tabButton === button);
        });
        renderEmployeeLeaveTable();
      });

      if (shouldShowLeaderReviewPanel()) {
        document.getElementById("refreshLeaderLeavesBtn")?.addEventListener("click", loadLeaderLeaves);
        document.getElementById("closeLeaveLeaderActionModalBtn")?.addEventListener("click", closeLeaderActionModal);
        document.getElementById("cancelLeaveLeaderActionBtn")?.addEventListener("click", closeLeaderActionModal);
        document.getElementById("confirmLeaveLeaderActionBtn")?.addEventListener("click", submitLeaderLeaveAction);

        ["leaderLeaveSearchInput", "leaderLeaveStatusFilter"].forEach(function bindLeaderFilter(id) {
          const element = document.getElementById(id);
          if (!element) return;

          const eventName = id === "leaderLeaveSearchInput" ? "input" : "change";
          element.addEventListener(eventName, scheduleLeaderLeaveRefresh);
        });
      }
    }
  }

  function handleDelegatedClick(event) {
    if (event.target?.id === "leaveRequestModal") {
      closeLeaveRequestModal();
      return;
    }

    if (event.target?.id === "leaveAdminActionModal") {
      closeAdminActionModal();
      return;
    }

    if (event.target?.id === "leaveLeaderActionModal") {
      closeLeaderActionModal();
      return;
    }

    const deleteButton = event.target.closest("[data-leave-delete]");
    if (deleteButton) {
      const leaveId = Number(deleteButton.getAttribute("data-leave-delete"));
      deleteLeaveRequest(leaveId);
      return;
    }

    const statusButton = event.target.closest("[data-admin-leave-action]");
    if (statusButton) {
      const leaveId = Number(statusButton.getAttribute("data-leave-id"));
      const targetStatus = statusButton.getAttribute("data-admin-leave-action") || "pending";
      openAdminActionModal(leaveId, targetStatus);
      return;
    }

    const leaderActionButton = event.target.closest("[data-leader-leave-action]");
    if (leaderActionButton) {
      const leaveId = Number(leaderActionButton.getAttribute("data-leave-id"));
      const targetStatus = leaderActionButton.getAttribute("data-leader-leave-action") || "approved";
      openLeaderActionModal(leaveId, targetStatus);
    }
  }

  function activateSection() {
    const section = document.getElementById(SECTION_ID);
    if (!section) return;

    if (typeof window.showSection === "function") {
      try {
        window.showSection(SECTION_ID, leaveNavItem);
      } catch (error) {
        document.querySelectorAll(".section").forEach(function hideSection(sectionNode) {
          sectionNode.classList.remove("active");
        });
        section.classList.add("active");
      }
    } else {
      document.querySelectorAll(".section").forEach(function hideSection(sectionNode) {
        sectionNode.classList.remove("active");
      });
      section.classList.add("active");
    }

    document.querySelectorAll(".sidebar li").forEach(function resetNav(navNode) {
      navNode.classList.remove("active");
    });
    leaveNavItem?.classList.add("active");
    loadCurrentView();
  }

  function loadCurrentView() {
    if (currentMode === "admin") {
      loadAdminLeaves();
    } else {
      loadEmployeeLeaves();
      if (shouldShowLeaderReviewPanel()) {
        loadLeaderLeaves();
      }
    }
  }

  async function loadEmployeeLeaves() {
    const tableBody = document.getElementById("myLeaveTableBody");
    if (!tableBody || !currentUser?.id) return;

    tableBody.innerHTML = `<tr><td colspan="9" class="leave-empty-state">Loading leave history...</td></tr>`;

    try {
      const { response, result } = await requestJson(
        `${getBaseUrl()}/api/leaves/my/${currentUser.id}`,
        { cache: "no-store" },
        "Failed to load leave history",
      );

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Failed to load leave history");
      }

      employeeLeaves = Array.isArray(result.data) ? result.data : [];
      renderEmployeeSummary(result.summary || {}, result.balance || null);
      renderEmployeeLeaveTable();
    } catch (error) {
      tableBody.innerHTML = `<tr><td colspan="9" class="leave-empty-state">${escapeHtml(error.message || "Failed to load leave history")}</td></tr>`;
    }
  }

  function renderEmployeeSummary(summary, balance) {
    const countChip = document.getElementById("myLeaveCountChip");
    const availableBalanceEl = document.getElementById("myLeaveAvailableBalance");
    const availableBalanceHintEl = document.getElementById("myLeaveAvailableBalanceHint");
    const monthlyCreditEl = document.getElementById("myLeaveMonthlyCredit");
    const monthlyCreditHintEl = document.getElementById("myLeaveMonthlyCreditHint");
    const paidUsedEl = document.getElementById("myLeavePaidUsed");
    const paidUsedHintEl = document.getElementById("myLeavePaidUsedHint");
    const safeBalance = balance || {};
    const monthLabel = formatMonthKeyLabel(safeBalance.asOfMonthKey);

    if (availableBalanceEl) {
      availableBalanceEl.textContent = formatBalanceValue(safeBalance.availableBalance);
    }

    if (availableBalanceHintEl) {
      availableBalanceHintEl.textContent = safeBalance.nextCreditDate
        ? `${monthLabel} balance | Next credit on ${formatDateDisplay(safeBalance.nextCreditDate)}`
        : `${monthLabel} balance available for approved paid leaves`;
    }

    if (monthlyCreditEl) {
      monthlyCreditEl.textContent = formatBalanceValue(safeBalance.currentMonthCredit || safeBalance.monthlyCredit || 1);
    }

    if (monthlyCreditHintEl) {
      monthlyCreditHintEl.textContent = `${formatBalanceValue(safeBalance.currentMonthUnusedCredit)} of this month's credit is still unused`;
    }

    if (paidUsedEl) {
      paidUsedEl.textContent = formatBalanceValue(safeBalance.paidLeaveDaysUsed);
    }

    if (paidUsedHintEl) {
      paidUsedHintEl.textContent = `${formatBalanceValue(safeBalance.paidLeaveDaysUsed)} approved leave${Number(safeBalance.paidLeaveDaysUsed || 0) === 1 ? "" : "s"} used from your paid balance`;
    }

    if (countChip) {
      countChip.innerHTML = `
        <i class="fas fa-layer-group"></i>
        <span>${Number(summary.totalRequests || 0)} request${Number(summary.totalRequests || 0) === 1 ? "" : "s"} | Pending ${Number(summary.pendingRequests || 0)} | Available ${formatBalanceValue(safeBalance.availableBalance)}</span>
      `;
    }

    const todayChip = document.getElementById("leaveTodayChip");
    if (!todayChip) return;

    if (Number(summary.onLeaveToday || 0) > 0) {
      todayChip.innerHTML = `<i class="fas fa-umbrella-beach"></i><span>You are on approved leave today</span>`;
    } else {
      todayChip.innerHTML = `<i class="fas fa-calendar-check"></i><span>No approved leave active today | ${formatBalanceValue(safeBalance.availableBalance)} paid leave available</span>`;
    }
  }

  function getFilteredEmployeeLeaves() {
    const searchValue = String(document.getElementById("myLeaveSearchInput")?.value || "")
      .toLowerCase()
      .trim();

    return employeeLeaves.filter(function filterLeave(row) {
      const statusMatches = employeeActiveFilter === "all"
        ? true
        : normalizeKey(row.status) === employeeActiveFilter;

      if (!statusMatches) return false;
      if (!searchValue) return true;

      const haystack = [
        row.leave_type,
        row.status,
        row.reason,
        row.admin_remark,
        row.review_remark,
        row.approval_flow_label,
        row.from_date,
        row.to_date,
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(searchValue);
    });
  }

  function renderEmployeeLeaveTable() {
    const tableBody = document.getElementById("myLeaveTableBody");
    if (!tableBody) return;

    const visibleLeaves = getFilteredEmployeeLeaves();
    if (!visibleLeaves.length) {
      tableBody.innerHTML = `<tr><td colspan="9" class="leave-empty-state">No leave requests match the current filter.</td></tr>`;
      return;
    }

    tableBody.innerHTML = visibleLeaves.map(function renderEmployeeRow(row) {
      const isPending = normalizeKey(row.status) === "pending";

      return `
        <tr>
          <td>${renderLeaveTypeBadge(row.leave_type)}</td>
          <td>${formatDateDisplay(row.from_date)}</td>
          <td>${formatDateDisplay(row.to_date)}</td>
          <td>${formatDays(row.total_days)}</td>
          <td><div class="leave-note-text">${escapeHtml(row.reason || "-")}</div></td>
          <td>${formatDateTimeDisplay(row.created_at)}</td>
          <td>${renderStatusBadge(row.status)}</td>
          <td>${renderApprovalSummary(row)}</td>
          <td>
            ${isPending ? `<button type="button" class="leave-action-btn delete" data-leave-delete="${row.id}"><i class="fas fa-trash"></i> Delete</button>` : "-"}
          </td>
        </tr>
      `;
    }).join("");
  }

  function openLeaveRequestModal() {
    const modal = document.getElementById("leaveRequestModal");
    const form = document.getElementById("leaveRequestForm");
    if (!modal || !form) return;

    form.reset();
    const today = getLocalDateKey();
    const fromDateInput = document.getElementById("leaveFromDate");
    const toDateInput = document.getElementById("leaveToDate");

    if (fromDateInput) fromDateInput.value = today;
    if (toDateInput) toDateInput.value = today;

    modal.classList.remove("leave-hidden");
    modal.setAttribute("aria-hidden", "false");
    document.body.classList.add("leave-overlay-open");
    updateLeaveDurationPreview();
  }

  function closeLeaveRequestModal() {
    const modal = document.getElementById("leaveRequestModal");
    if (!modal) return;

    modal.classList.add("leave-hidden");
    modal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("leave-overlay-open");
  }

  function updateLeaveDurationPreview() {
    const leaveType = document.getElementById("leaveTypeSelect")?.value || "casual_leave";
    const fromDateInput = document.getElementById("leaveFromDate");
    const toDateInput = document.getElementById("leaveToDate");
    const durationValue = document.getElementById("leaveDurationValue");
    const durationHint = document.getElementById("leaveDurationHint");
    if (!fromDateInput || !toDateInput || !durationValue || !durationHint) return;

    if (normalizeKey(leaveType) === "half_day") {
      toDateInput.value = fromDateInput.value;
      toDateInput.disabled = true;
    } else {
      toDateInput.disabled = false;
      if (fromDateInput.value && toDateInput.value && toDateInput.value < fromDateInput.value) {
        toDateInput.value = fromDateInput.value;
      }
    }

    const calculation = computeLeaveDays(fromDateInput.value, toDateInput.value, leaveType);
    if (!calculation.valid) {
      durationValue.textContent = "0 Days";
      durationHint.textContent = calculation.message || "Choose leave type and dates to auto-calculate total leave duration.";
      return;
    }

    durationValue.textContent = formatDays(calculation.days);
    durationHint.textContent = `${formatLeaveTypeLabel(leaveType)} selected for ${formatDateDisplay(fromDateInput.value)}${fromDateInput.value !== toDateInput.value ? ` to ${formatDateDisplay(toDateInput.value)}` : ""}.`;
  }

  async function submitLeaveRequest(event) {
    event.preventDefault();

    const submitButton = document.getElementById("submitLeaveRequestBtn");
    const leaveType = document.getElementById("leaveTypeSelect")?.value || "";
    const fromDate = document.getElementById("leaveFromDate")?.value || "";
    const toDate = document.getElementById("leaveToDate")?.value || "";
    const reason = document.getElementById("leaveReasonInput")?.value || "";
    const calculation = computeLeaveDays(fromDate, toDate, leaveType);

    if (!calculation.valid) {
      notify("Leave Request", calculation.message || "Please select valid leave dates.", false);
      return;
    }

    const payload = {
      userId: Number(currentUser.id || 0),
      employeeName: String(currentUser.name || ""),
      role: String(currentUser.role || ""),
      leaveType,
      fromDate,
      toDate,
      reason: reason.trim(),
    };

    if (submitButton) {
      submitButton.disabled = true;
      submitButton.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Submitting...`;
    }

    try {
      const { response, result } = await requestJson(
        `${getBaseUrl()}/api/leaves/apply`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        },
        "Failed to submit leave request",
      );

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Failed to submit leave request");
      }

      closeLeaveRequestModal();
      notify("Leave Request", result.message || "Leave request submitted successfully.", true);
      await loadEmployeeLeaves();
    } catch (error) {
      notify("Leave Request", error.message || "Failed to submit leave request.", false);
    } finally {
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.innerHTML = `<i class="fas fa-paper-plane"></i> Submit Leave Request`;
      }
    }
  }

  async function deleteLeaveRequest(leaveId) {
    if (!leaveId || !currentUser?.id) return;

    const confirmed = window.confirm("Delete this pending leave request?");
    if (!confirmed) return;

    try {
      const { response, result } = await requestJson(
        `${getBaseUrl()}/api/leaves/${leaveId}`,
        {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            userId: currentUser.id,
            role: currentUser.role,
          }),
        },
        "Failed to delete leave request",
      );

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Failed to delete leave request");
      }

      notify("Leave Request", result.message || "Leave request deleted successfully.", true);
      await loadEmployeeLeaves();
    } catch (error) {
      notify("Leave Request", error.message || "Failed to delete leave request.", false);
    }
  }

  function scheduleLeaderLeaveRefresh() {
    if (leaderSearchTimer) {
      clearTimeout(leaderSearchTimer);
    }

    leaderSearchTimer = window.setTimeout(function delayedLeaderRefresh() {
      loadLeaderLeaves();
    }, 180);
  }

  async function loadLeaderLeaves() {
    const tableBody = document.getElementById("leaderLeaveTableBody");
    if (!tableBody || !currentUser?.id || !shouldShowLeaderReviewPanel()) return;

    tableBody.innerHTML = `<tr><td colspan="9" class="leave-empty-state">Loading leader leave queue...</td></tr>`;

    try {
      const params = new URLSearchParams({
        leaderId: String(currentUser.id),
      });

      const employeeName = String(document.getElementById("leaderLeaveSearchInput")?.value || "").trim();
      const status = String(document.getElementById("leaderLeaveStatusFilter")?.value || "").trim();

      if (employeeName) params.set("employeeName", employeeName);
      if (status) params.set("status", status);

      const { response, result } = await requestJson(
        `${getBaseUrl()}/api/leader/leaves?${params.toString()}`,
        { cache: "no-store" },
        "Failed to load leader leave queue",
      );

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Failed to load leader leave queue");
      }

      leaderLeaves = Array.isArray(result.data) ? result.data : [];
      renderLeaderSummary(result.summary || {});
      renderLeaderLeaveTable();
    } catch (error) {
      tableBody.innerHTML = `<tr><td colspan="9" class="leave-empty-state">${escapeHtml(error.message || "Failed to load leader leave queue")}</td></tr>`;
    }
  }

  function renderLeaderSummary(summary) {
    const countChip = document.getElementById("leaderLeaveCountChip");
    if (!countChip) return;

    const totalRequests = Number(summary.totalRequests || 0);
    const pendingRequests = Number(summary.pendingRequests || 0);
    const approvedLeaves = Number(summary.approvedLeaves || 0);
    const rejectedLeaves = Number(summary.rejectedLeaves || 0);

    countChip.innerHTML = `
      <i class="fas fa-user-check"></i>
      <span>${totalRequests} request${totalRequests === 1 ? "" : "s"} | Pending ${pendingRequests} | Approved ${approvedLeaves} | Rejected ${rejectedLeaves}</span>
    `;
  }

  function renderLeaderLeaveTable() {
    const tableBody = document.getElementById("leaderLeaveTableBody");
    if (!tableBody) return;

    if (!leaderLeaves.length) {
      tableBody.innerHTML = `<tr><td colspan="9" class="leave-empty-state">No leave requests are currently routed to you.</td></tr>`;
      return;
    }

    tableBody.innerHTML = leaderLeaves.map(function renderLeaderRow(row) {
      const isPending = normalizeKey(row.status) === "pending" && Number(row.can_leader_review || 0) === 1;

      return `
        <tr>
          <td>
            <div class="employee-status-stack">
              <span class="team-employee-name">${escapeHtml(row.employee_name || "-")}</span>
            </div>
          </td>
          <td>${renderRoleBadge(row.role)}</td>
          <td>${renderLeaveTypeBadge(row.leave_type)}</td>
          <td>
            <div class="leave-note-text">
              <strong>${formatDateDisplay(row.from_date)}</strong><br />
              ${formatDateDisplay(row.to_date)}
            </div>
          </td>
          <td>${formatDays(row.total_days)}</td>
          <td><div class="leave-note-text">${escapeHtml(row.reason || "-")}</div></td>
          <td>${renderStatusBadge(row.status)}</td>
          <td>${renderApprovalSummary(row)}</td>
          <td>
            ${isPending
              ? `
                <div class="leave-action-group">
                  <button type="button" class="leave-action-btn approved" data-leader-leave-action="approved" data-leave-id="${row.id}">Approve</button>
                  <button type="button" class="leave-action-btn rejected" data-leader-leave-action="rejected" data-leave-id="${row.id}">Reject</button>
                </div>
              `
              : `<span class="leave-static-note">Decision saved</span>`}
          </td>
        </tr>
      `;
    }).join("");
  }

  function openLeaderActionModal(leaveId, targetStatus) {
    const leaveRequest = leaderLeaves.find(function matchLeave(row) {
      return Number(row.id) === Number(leaveId);
    });
    const modal = document.getElementById("leaveLeaderActionModal");
    const title = document.getElementById("leaveLeaderActionTitle");
    const subtitle = document.getElementById("leaveLeaderActionSubtitle");
    const summary = document.getElementById("leaveLeaderActionSummary");
    const remarkInput = document.getElementById("leaveLeaderRemarkInput");
    const remarkNote = document.getElementById("leaveLeaderRemarkNote");

    if (!leaveRequest || !modal || !title || !subtitle || !summary || !remarkInput || !remarkNote) {
      return;
    }

    leaderPendingAction = {
      leaveId: Number(leaveId),
      status: normalizeKey(targetStatus),
    };

    const nextLabel = formatStatusLabel(targetStatus);
    title.textContent = `${nextLabel} Team Leave`;
    subtitle.textContent = `You are updating ${(leaveRequest.employee_name || "this employee")}'s request to ${nextLabel.toLowerCase()}.`;
    summary.innerHTML = `
      <strong>${escapeHtml(leaveRequest.employee_name || "Employee")} | ${formatLeaveTypeLabel(leaveRequest.leave_type)}</strong>
      <span>${formatDateDisplay(leaveRequest.from_date)} to ${formatDateDisplay(leaveRequest.to_date)} | ${formatDays(leaveRequest.total_days)} | Current status: ${formatStatusLabel(leaveRequest.status)}</span>
    `;
    remarkInput.value = leaveRequest.leader_remark || "";
    remarkNote.textContent = leaderPendingAction.status === "rejected"
      ? "Rejection reason is required before saving this decision."
      : "Optional: add a note that admin can also see in the leave dashboard.";

    modal.classList.remove("leave-hidden");
    modal.setAttribute("aria-hidden", "false");
    document.body.classList.add("leave-overlay-open");
  }

  function closeLeaderActionModal() {
    const modal = document.getElementById("leaveLeaderActionModal");
    if (!modal) return;

    modal.classList.add("leave-hidden");
    modal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("leave-overlay-open");
  }

  async function submitLeaderLeaveAction() {
    const remarkInput = document.getElementById("leaveLeaderRemarkInput");
    const confirmButton = document.getElementById("confirmLeaveLeaderActionBtn");
    const targetStatus = normalizeKey(leaderPendingAction.status);
    const leaveId = Number(leaderPendingAction.leaveId);
    const leaderRemark = String(remarkInput?.value || "").trim();

    if (!leaveId || !targetStatus || !currentUser?.id) return;

    if (targetStatus === "rejected" && !leaderRemark) {
      notify("Leader Decision", "Rejection reason is required.", false);
      return;
    }

    if (confirmButton) {
      confirmButton.disabled = true;
      confirmButton.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Saving...`;
    }

    try {
      const { response, result } = await requestJson(
        `${getBaseUrl()}/api/leader/leaves/${leaveId}/status`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            leaderId: currentUser.id,
            status: targetStatus,
            leaderRemark,
          }),
        },
        "Failed to update leader leave decision",
      );

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Failed to update leader leave decision");
      }

      closeLeaderActionModal();
      notify("Leader Decision", result.message || "Leader leave decision saved successfully.", true);
      await Promise.all([loadLeaderLeaves(), loadEmployeeLeaves()]);
    } catch (error) {
      notify("Leader Decision", error.message || "Failed to update leader leave decision.", false);
    } finally {
      if (confirmButton) {
        confirmButton.disabled = false;
        confirmButton.innerHTML = `<i class="fas fa-floppy-disk"></i> Save Decision`;
      }
    }
  }

  function scheduleAdminLeaveRefresh() {
    if (adminSearchTimer) {
      clearTimeout(adminSearchTimer);
    }

    adminSearchTimer = window.setTimeout(function delayedAdminRefresh() {
      loadAdminLeaves();
    }, 180);
  }

  function clearAdminFilters() {
    const searchInput = document.getElementById("adminLeaveSearchInput");
    const roleFilter = document.getElementById("adminLeaveRoleFilter");
    const statusFilter = document.getElementById("adminLeaveStatusFilter");
    const dateFilter = document.getElementById("adminLeaveDateFilter");

    if (searchInput) searchInput.value = "";
    if (roleFilter) roleFilter.value = "";
    if (statusFilter) statusFilter.value = "";
    if (dateFilter) dateFilter.value = "";

    loadAdminLeaves();
  }

  async function loadAdminLeaves() {
    const tableBody = document.getElementById("adminLeaveTableBody");
    if (!tableBody || !currentUser?.id) return;

    tableBody.innerHTML = `<tr><td colspan="12" class="leave-empty-state">Loading leave dashboard...</td></tr>`;
    const balanceBody = document.getElementById("adminLeaveBalanceBody");
    if (balanceBody) {
      balanceBody.innerHTML = `<tr><td colspan="6" class="leave-empty-state">Loading leave balances...</td></tr>`;
    }

    try {
      const params = new URLSearchParams({
        adminId: String(currentUser.id),
      });

      const employeeName = String(document.getElementById("adminLeaveSearchInput")?.value || "").trim();
      const role = String(document.getElementById("adminLeaveRoleFilter")?.value || "").trim();
      const status = String(document.getElementById("adminLeaveStatusFilter")?.value || "").trim();
      const date = String(document.getElementById("adminLeaveDateFilter")?.value || "").trim();

      if (employeeName) params.set("employeeName", employeeName);
      if (role) params.set("role", role);
      if (status) params.set("status", status);
      if (date) params.set("date", date);

      const { response, result } = await requestJson(
        `${getBaseUrl()}/api/admin/leaves?${params.toString()}`,
        {
          cache: "no-store",
        },
        "Failed to load leave dashboard",
      );

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Failed to load leave dashboard");
      }

      adminLeaves = Array.isArray(result.data) ? result.data : [];
      adminLeaveBalances = Array.isArray(result.balances) ? result.balances : [];
      renderAdminSummary(result.summary || {}, Number(result.filteredCount || adminLeaves.length));
      renderAdminBalanceTable();
      renderAdminLeaveTable();
    } catch (error) {
      tableBody.innerHTML = `<tr><td colspan="12" class="leave-empty-state">${escapeHtml(error.message || "Failed to load leave dashboard")}</td></tr>`;
      if (balanceBody) {
        balanceBody.innerHTML = `<tr><td colspan="6" class="leave-empty-state">${escapeHtml(error.message || "Failed to load leave balances")}</td></tr>`;
      }
    }
  }

  function getFilteredAdminLeaveBalances() {
    const searchValue = String(document.getElementById("adminLeaveSearchInput")?.value || "")
      .toLowerCase()
      .trim();
    const roleValue = normalizeKey(document.getElementById("adminLeaveRoleFilter")?.value || "");

    return adminLeaveBalances.filter(function filterBalanceRow(row) {
      const roleMatches = roleValue
        ? normalizeKey(row.role) === roleValue
        : true;

      if (!roleMatches) return false;
      if (!searchValue) return true;

      return [row.employeeName, row.role]
        .join(" ")
        .toLowerCase()
        .includes(searchValue);
    });
  }

  function renderAdminSummary(summary, filteredCount) {
    document.getElementById("adminLeaveTotalRequests").textContent = Number(summary.totalRequests || 0);
    document.getElementById("adminLeavePendingRequests").textContent = Number(summary.pendingRequests || 0);
    document.getElementById("adminLeaveApprovedRequests").textContent = Number(summary.approvedLeaves || 0);
    document.getElementById("adminLeaveRejectedRequests").textContent = Number(summary.rejectedLeaves || 0);
    document.getElementById("adminLeaveOnToday").textContent = Number(summary.employeesOnLeaveToday || 0);
    const visibleBalances = getFilteredAdminLeaveBalances();
    const totalAvailableBalance = visibleBalances.reduce(function sumBalances(total, row) {
      return total + Number(row.availableBalance || 0);
    }, 0);
    const availableBalanceEl = document.getElementById("adminLeaveAvailableBalance");
    const availableBalanceHintEl = document.getElementById("adminLeaveAvailableBalanceHint");

    if (availableBalanceEl) {
      availableBalanceEl.textContent = formatBalanceValue(totalAvailableBalance);
    }

    if (availableBalanceHintEl) {
      availableBalanceHintEl.textContent = `${visibleBalances.length} employee${visibleBalances.length === 1 ? "" : "s"} currently visible in balance table`;
    }

    const meta = document.getElementById("adminLeaveTableMeta");
    if (meta) {
      meta.textContent = `Showing ${filteredCount} request${filteredCount === 1 ? "" : "s"} with leader and admin approval visibility.`;
    }
  }

  function renderAdminBalanceTable() {
    const tableBody = document.getElementById("adminLeaveBalanceBody");
    if (!tableBody) return;

    const visibleBalances = getFilteredAdminLeaveBalances();
    const meta = document.getElementById("adminLeaveBalanceMeta");

    if (meta) {
      meta.textContent = `Showing ${visibleBalances.length} employee${visibleBalances.length === 1 ? "" : "s"} with live paid leave balance.`;
    }

    if (!visibleBalances.length) {
      tableBody.innerHTML = `<tr><td colspan="6" class="leave-empty-state">No employee leave balances match the current search or role filter.</td></tr>`;
      return;
    }

    tableBody.innerHTML = visibleBalances.map(function renderBalanceRow(row) {
      const monthLabel = formatMonthKeyLabel(row.asOfMonthKey);

      return `
        <tr>
          <td>
            <div class="employee-status-stack">
              <span class="team-employee-name">${escapeHtml(row.employeeName || "-")}</span>
            </div>
          </td>
          <td>${renderRoleBadge(row.role)}</td>
          <td><strong>${formatBalanceValue(row.availableBalance)}</strong></td>
          <td>${formatBalanceValue(row.currentMonthCredit || row.monthlyCredit)}</td>
          <td>${formatBalanceValue(row.paidLeaveDaysUsed)}</td>
          <td>${escapeHtml(monthLabel)}${row.asOfDate ? `<br /><span class="leave-balance-date">${escapeHtml(formatDateDisplay(row.asOfDate))}</span>` : ""}</td>
        </tr>
      `;
    }).join("");
  }

  function renderAdminLeaveTable() {
    const tableBody = document.getElementById("adminLeaveTableBody");
    if (!tableBody) return;

    if (!adminLeaves.length) {
      tableBody.innerHTML = `<tr><td colspan="12" class="leave-empty-state">No leave requests found for the selected filters.</td></tr>`;
      return;
    }

    tableBody.innerHTML = adminLeaves.map(function renderAdminRow(row) {
      const currentStatus = normalizeKey(row.status);
      const canAdminReview = Number(row.can_admin_review || 0) === 1;
      const actionMarkup = canAdminReview
        ? `
          <div class="leave-action-group">
            <button type="button" class="leave-action-btn pending${currentStatus === "pending" ? " is-active" : ""}" data-admin-leave-action="pending" data-leave-id="${row.id}">Pending</button>
            <button type="button" class="leave-action-btn approved${currentStatus === "approved" ? " is-active" : ""}" data-admin-leave-action="approved" data-leave-id="${row.id}">Approve</button>
            <button type="button" class="leave-action-btn rejected${currentStatus === "rejected" ? " is-active" : ""}" data-admin-leave-action="rejected" data-leave-id="${row.id}">Reject</button>
          </div>
        `
        : `<span class="leave-static-note">Handled by leader</span>`;

      return `
        <tr>
          <td>
            <div class="employee-status-stack">
              <span class="team-employee-name">${escapeHtml(row.employee_name || "-")}</span>
            </div>
          </td>
          <td>${renderRoleBadge(row.role)}</td>
          <td>
            <div class="leave-note-stack">
              <strong>${formatBalanceValue(row.leave_balance)}</strong>
              <span>Monthly credit ${formatBalanceValue(row.leave_monthly_credit)}</span>
            </div>
          </td>
          <td>${renderLeaveTypeBadge(row.leave_type)}</td>
          <td>
            <div class="leave-note-text">
              <strong>${formatDateDisplay(row.from_date)}</strong><br />
              ${formatDateDisplay(row.to_date)}
            </div>
          </td>
          <td>${formatDays(row.total_days)}</td>
          <td><div class="leave-note-text">${escapeHtml(row.reason || "-")}</div></td>
          <td>${formatDateTimeDisplay(row.created_at)}</td>
          <td>${renderStatusBadge(row.status)}</td>
          <td><div class="leave-note-text">${escapeHtml(row.approval_flow_label || "-")}</div></td>
          <td>${renderApprovalSummary(row)}</td>
          <td>${actionMarkup}</td>
        </tr>
      `;
    }).join("");
  }

  function openAdminActionModal(leaveId, targetStatus) {
    const leaveRequest = adminLeaves.find(function matchLeave(row) {
      return Number(row.id) === Number(leaveId);
    });
    const modal = document.getElementById("leaveAdminActionModal");
    const title = document.getElementById("leaveAdminActionTitle");
    const subtitle = document.getElementById("leaveAdminActionSubtitle");
    const summary = document.getElementById("leaveAdminActionSummary");
    const remarkInput = document.getElementById("leaveAdminRemarkInput");
    const remarkNote = document.getElementById("leaveAdminRemarkNote");

    if (!leaveRequest || !modal || !title || !subtitle || !summary || !remarkInput || !remarkNote) {
      return;
    }

    adminPendingAction = {
      leaveId: Number(leaveId),
      status: normalizeKey(targetStatus),
    };

    const nextLabel = formatStatusLabel(targetStatus);
    title.textContent = `${nextLabel} Leave Request`;
    subtitle.textContent = `You are updating ${(leaveRequest.employee_name || "this employee")}'s request to ${nextLabel.toLowerCase()}.`;
    summary.innerHTML = `
      <strong>${escapeHtml(leaveRequest.employee_name || "Employee")} | ${formatLeaveTypeLabel(leaveRequest.leave_type)}</strong>
      <span>${formatDateDisplay(leaveRequest.from_date)} to ${formatDateDisplay(leaveRequest.to_date)} | ${formatDays(leaveRequest.total_days)} | Current status: ${formatStatusLabel(leaveRequest.status)}</span>
    `;
    remarkInput.value = leaveRequest.admin_remark || "";

    if (adminPendingAction.status === "rejected") {
      remarkNote.textContent = "Rejection reason is required before saving this decision.";
    } else if (adminPendingAction.status === "approved") {
      remarkNote.textContent = "Optional: add an approval note for the employee.";
    } else {
      remarkNote.textContent = "Optional: add context before moving the request back to pending.";
    }

    modal.classList.remove("leave-hidden");
    modal.setAttribute("aria-hidden", "false");
    document.body.classList.add("leave-overlay-open");
  }

  function closeAdminActionModal() {
    const modal = document.getElementById("leaveAdminActionModal");
    if (!modal) return;

    modal.classList.add("leave-hidden");
    modal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("leave-overlay-open");
  }

  async function submitAdminLeaveAction() {
    const remarkInput = document.getElementById("leaveAdminRemarkInput");
    const confirmButton = document.getElementById("confirmLeaveAdminActionBtn");
    const targetStatus = normalizeKey(adminPendingAction.status);
    const leaveId = Number(adminPendingAction.leaveId);
    const adminRemark = String(remarkInput?.value || "").trim();

    if (!leaveId || !targetStatus || !currentUser?.id) return;

    if (targetStatus === "rejected" && !adminRemark) {
      notify("Leave Decision", "Rejection reason is required.", false);
      return;
    }

    if (confirmButton) {
      confirmButton.disabled = true;
      confirmButton.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Saving...`;
    }

    try {
      const { response, result } = await requestJson(
        `${getBaseUrl()}/api/admin/leaves/${leaveId}/status`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            adminId: currentUser.id,
            status: targetStatus,
            adminRemark,
          }),
        },
        "Failed to update leave status",
      );

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Failed to update leave status");
      }

      closeAdminActionModal();
      notify("Leave Decision", result.message || "Leave status updated successfully.", true);
      await loadAdminLeaves();

      if (typeof window.loadTeam === "function") {
        window.loadTeam();
      }
    } catch (error) {
      notify("Leave Decision", error.message || "Failed to update leave status.", false);
    } finally {
      if (confirmButton) {
        confirmButton.disabled = false;
        confirmButton.innerHTML = `<i class="fas fa-floppy-disk"></i> Save Status`;
      }
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
