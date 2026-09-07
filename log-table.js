// ====================== REPORT (LOG TABLE) ======================
(function () {
  "use strict";

  let logTableData = [];
  let logTableRoles = [];
  let logTableCurrentDate = "";
  window.activeSummaryFilter = null;
  
  window.setSummaryFilter = function(filterType) {
    if (window.activeSummaryFilter === filterType) {
      window.activeSummaryFilter = null;
    } else {
      window.activeSummaryFilter = filterType;
    }
    applyLogFilters();
  };

  window.toggleReportDateInputs = function() {
    const type = document.getElementById("reportDateType")?.value;
    const monthInput = document.getElementById("reportMonthFilter");
    const customDiv = document.getElementById("reportCustomFilter");

    
    if (monthInput) monthInput.style.display = type === 'month' ? 'inline-block' : 'none';
    if (customDiv) customDiv.style.display = type === 'custom' ? 'flex' : 'none';
  };

  function getLogTableTodayStr() {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const dd = String(now.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }

  function getReportDateRange() {
    const type = document.getElementById("reportDateType")?.value || "today";
    const today = getLogTableTodayStr();
    
    if (type === "today") {
      return { start_date: today, end_date: today, label: today };
    }
    if (type === "month") {
      const monthVal = document.getElementById("reportMonthFilter")?.value;
      if (!monthVal) {
         const now = new Date();
         const yyyy = now.getFullYear();
         const mm = String(now.getMonth() + 1).padStart(2, "0");
         const lastDay = new Date(yyyy, now.getMonth() + 1, 0);
         return { start_date: `${yyyy}-${mm}-01`, end_date: `${yyyy}-${mm}-${String(lastDay.getDate()).padStart(2, "0")}`, label: `${yyyy}-${mm}` };
      }
      const [yyyy, mm] = monthVal.split("-");
      const lastDay = new Date(yyyy, parseInt(mm, 10), 0);
      return { start_date: `${yyyy}-${mm}-01`, end_date: `${yyyy}-${mm}-${String(lastDay.getDate()).padStart(2, "0")}`, label: monthVal };
    }
    if (type === "custom") {
      const start = document.getElementById("reportStartDate")?.value || today;
      const end = document.getElementById("reportEndDate")?.value || today;
      return { start_date: start, end_date: end, label: `${start} to ${end}` };
    }
    return { start_date: today, end_date: today, label: today };
  }

  function getLogTableRoleFilter() {
    return document.getElementById("logTableRoleFilter");
  }

  function getLogTableEmployeeFilter() {
    return document.getElementById("logTableEmployeeFilter");
  }

  function getLogTableSearchInput() {
    return document.getElementById("logTableSearch");
  }

  function escapeLogHtml(str) {
    const div = document.createElement("div");
    div.textContent = String(str || "");
    return div.innerHTML;
  }

  function getLogRoleClass(role) {
    const r = String(role || "").toLowerCase().trim();
    if (["tme", "me", "hr", "dev", "seo", "accounts"].includes(r)) return r;
    return "default";
  }

  function getLogRoleLabel(role) {
    return String(role || "-").toUpperCase().trim();
  }

  function getLogCompanyLabel(compName) {
    const n = String(compName || "").toLowerCase().replace(/[^a-z0-9]/g, "");
    if (n.includes("redsea")) return "Red Sea";
    if (n.includes("metrics")) return "Metrics Mart";
    return String(compName || "-");
  }

  function getFilteredLogRows(ignoreSummaryFilter = false) {
    let rows = Array.isArray(logTableData) ? [...logTableData] : [];

    // Company scope filter
    if (typeof filterAdminRowsByCompanyScope === "function") {
      rows = filterAdminRowsByCompanyScope(rows);
    }

    // Role filter
    const roleFilter = getLogTableRoleFilter()?.value || "";
    if (roleFilter) {
      rows = rows.filter(
        (r) => String(r.role || "").toLowerCase().trim() === roleFilter
      );
    }

    // Employee filter
    const employeeFilter = getLogTableEmployeeFilter()?.value || "";
    if (employeeFilter) {
      rows = rows.filter((r) => String(r.user_id) === employeeFilter);
    }

    // Search filter
    const search = (getLogTableSearchInput()?.value || "").toLowerCase().trim();
    if (search) {
      rows = rows.filter(
        (r) =>
          String(r.name || "").toLowerCase().includes(search) ||
          String(r.role || "").toLowerCase().includes(search) ||
          String(r.comp_name || "").toLowerCase().includes(search)
      );
    }

    // Summary Card Filter
    if (!ignoreSummaryFilter && window.activeSummaryFilter) {
      const f = window.activeSummaryFilter;
      if (f === 'leads') rows = rows.filter(r => Number(r.leads_added || 0) > 0);
      else if (f === 'followups') rows = rows.filter(r => Number(r.followups || 0) > 0);
      else if (f === 'appointments') rows = rows.filter(r => Number(r.appointments || 0) > 0);
      else if (f === 'deals') rows = rows.filter(r => Number(r.deals_closed || 0) > 0);
      else if (f === 'projects') rows = rows.filter(r => Number(r.project_tasks || 0) > 0);
      else if (f === 'hr') rows = rows.filter(r => Number(r.hr_tasks || 0) > 0);
      else if (f === 'accounts') rows = rows.filter(r => Number(r.accounts_tasks || 0) > 0);
    }

    return rows;
  }

  function renderLogSummary(rows) {
    const container = document.getElementById("logTableSummary");
    if (!container) return;

    const roleFilter = getLogTableRoleFilter()?.value || "";
    const total = rows.length;

    const isActive = (f) => window.activeSummaryFilter === f ? ' active' : '';
    const clickAttr = (f) => `onclick="setSummaryFilter('${f}')" style="cursor:pointer;" title="Click to filter"`;

    let html = `
      <div class="log-summary-card${isActive('total')}" ${clickAttr('total')}>
        <div class="log-summary-value">${total}</div>
        <div class="log-summary-label">Total Employees</div>
      </div>
    `;

    // Sales metrics (TME / ME / General)
    if (!roleFilter || ["tme", "me"].includes(roleFilter)) {
      const totalLeads = rows.reduce((s, r) => s + Number(r.leads_added || 0), 0);
      const totalFollowups = rows.reduce((s, r) => s + Number(r.followups || 0), 0);
      const totalAppointments = rows.reduce((s, r) => s + Number(r.appointments || 0), 0);
      const totalDeals = rows.reduce((s, r) => s + Number(r.deals_closed || 0), 0);
      
      if (!roleFilter || roleFilter === "tme") {
        html += `
          <div class="log-summary-card leads${isActive('leads')}" ${clickAttr('leads')}>
            <div class="log-summary-value">${totalLeads}</div>
            <div class="log-summary-label">Leads Added</div>
          </div>
          <div class="log-summary-card followups${isActive('followups')}" ${clickAttr('followups')}>
            <div class="log-summary-value">${totalFollowups}</div>
            <div class="log-summary-label">Follow-ups</div>
          </div>`;
      }
      if (!roleFilter || roleFilter === "me") {
        html += `
          <div class="log-summary-card appointments${isActive('appointments')}" ${clickAttr('appointments')}>
            <div class="log-summary-value">${totalAppointments}</div>
            <div class="log-summary-label">Appointments</div>
          </div>
          <div class="log-summary-card deals${isActive('deals')}" ${clickAttr('deals')}>
            <div class="log-summary-value">${totalDeals}</div>
            <div class="log-summary-label">Deals Closed</div>
          </div>`;
      }
    }

    // Dev/SEO metrics
    if (!roleFilter || ["dev", "seo"].includes(roleFilter)) {
      const totalProjectTasks = rows.reduce((s, r) => s + Number(r.project_tasks || 0), 0);
      html += `
        <div class="log-summary-card projects${isActive('projects')}" ${clickAttr('projects')}>
          <div class="log-summary-value">${totalProjectTasks}</div>
          <div class="log-summary-label">Project Tasks</div>
        </div>
      `;
    }

    // HR metrics
    if (!roleFilter || roleFilter === "hr") {
      const totalHrTasks = rows.reduce((s, r) => s + Number(r.hr_tasks || 0), 0);
      html += `
        <div class="log-summary-card hr${isActive('hr')}" ${clickAttr('hr')}>
          <div class="log-summary-value">${totalHrTasks}</div>
          <div class="log-summary-label">HR Tasks</div>
        </div>
      `;
    }

    // Accounts metrics
    if (!roleFilter || roleFilter === "accounts") {
      const totalAccountsTasks = rows.reduce((s, r) => s + Number(r.accounts_tasks || 0), 0);
      html += `
        <div class="log-summary-card accounts${isActive('accounts')}" ${clickAttr('accounts')}>
          <div class="log-summary-value">${totalAccountsTasks}</div>
          <div class="log-summary-label">Accounts Tasks</div>
        </div>
      `;
    }

    container.innerHTML = html;
  }

  function renderLogTable(rows) {
    const wrapper = document.getElementById("logTableBody");
    if (!wrapper) return;

    if (!rows.length) {
      wrapper.innerHTML = `
        <div class="log-table-empty">
          <i class="fas fa-clipboard-list"></i>
          No report data found for this date range.
        </div>
      `;
      return;
    }

    const roleFilter = getLogTableRoleFilter()?.value || "";
    
    const showSales = !roleFilter || ["tme", "me"].includes(roleFilter);
    const showDev = !roleFilter || ["dev", "seo"].includes(roleFilter);
    const showHr = !roleFilter || roleFilter === "hr";
    const showAccounts = !roleFilter || roleFilter === "accounts";

    let html = `
      <div class="log-table-wrapper">
        <table class="log-table">
          <thead>
            <tr>
              <th>Employee</th>
              <th>Role</th>
              <th>Company</th>
    `;
    
    if (showSales) {
      if (!roleFilter || roleFilter === "tme") html += `<th>Leads</th><th>Follow-ups</th>`;
      if (!roleFilter || roleFilter === "me") html += `<th>Appointments</th><th>Deals</th>`;
    }
    if (showDev) html += `<th>Project Tasks</th>`;
    if (showHr) html += `<th>HR Tasks</th>`;
    if (showAccounts) html += `<th>Accounts Tasks</th>`;
    
    html += `
            </tr>
          </thead>
          <tbody>
    `;

    rows.forEach((r) => {
      const roleClass = getLogRoleClass(r.role);
      const roleLabel = getLogRoleLabel(r.role);
      const companyLabel = getLogCompanyLabel(r.comp_name);
      
      const leads = Number(r.leads_added || 0);
      const followups = Number(r.followups || 0);
      const appointments = Number(r.appointments || 0);
      const deals = Number(r.deals_closed || 0);
      const projectTasks = Number(r.project_tasks || 0);
      const hrTasks = Number(r.hr_tasks || 0);
      const accountsTasks = Number(r.accounts_tasks || 0);

      html += `
        <tr class="clickable-row" onclick="openLogDetails(${r.user_id}, '${escapeLogHtml(r.name || "-")}')">
          <td>${escapeLogHtml(r.name || "-")}</td>
          <td><span class="log-role-badge ${roleClass}">${escapeLogHtml(roleLabel)}</span></td>
          <td>${escapeLogHtml(companyLabel)}</td>
      `;
      
      if (showSales) {
        if (!roleFilter || roleFilter === "tme") {
          html += `<td><span class="log-count-cell ${leads ? "has-value" : "zero"}">${leads}</span></td>`;
          html += `<td><span class="log-count-cell ${followups ? "has-value" : "zero"}">${followups}</span></td>`;
        }
        if (!roleFilter || roleFilter === "me") {
          html += `<td><span class="log-count-cell ${appointments ? "has-value" : "zero"}">${appointments}</span></td>`;
          html += `<td><span class="log-count-cell ${deals ? "has-value" : "zero"}">${deals}</span></td>`;
        }
      }
      if (showDev) {
        html += `<td><span class="log-count-cell ${projectTasks ? "has-value" : "zero"}">${projectTasks}</span></td>`;
      }
      if (showHr) {
        html += `<td><span class="log-count-cell ${hrTasks ? "has-value" : "zero"}">${hrTasks}</span></td>`;
      }
      if (showAccounts) {
        html += `<td><span class="log-count-cell ${accountsTasks ? "has-value" : "zero"}">${accountsTasks}</span></td>`;
      }

      html += `</tr>`;
    });

    html += `</tbody></table></div>`;
    wrapper.innerHTML = html;
  }

  function populateLogRoleFilter(roles) {
    const select = getLogTableRoleFilter();
    if (!select) return;
    const current = select.value;
    let options = '<option value="">All Roles</option>';
    (roles || []).forEach((role) => {
      const label = String(role || "").toUpperCase();
      const val = String(role || "").toLowerCase();
      options += `<option value="${escapeLogHtml(val)}">${escapeLogHtml(label)}</option>`;
    });
    select.innerHTML = options;
    if (current) select.value = current;
  }

  function populateLogEmployeeFilter(rows) {
    const select = getLogTableEmployeeFilter();
    if (!select) return;
    const current = select.value;
    let options = '<option value="">All Employees</option>';
    const sorted = [...rows].sort((a, b) =>
      String(a.name || "").localeCompare(String(b.name || ""))
    );
    sorted.forEach((r) => {
      options += `<option value="${r.user_id}">${escapeLogHtml(r.name)} (${escapeLogHtml(String(r.role || "").toUpperCase())})</option>`;
    });
    select.innerHTML = options;
    
    // Check if the current value is still a valid option
    if (current && [...select.options].some(opt => opt.value === current)) {
      select.value = current;
    } else {
      select.value = "";
    }
  }

  function updateEmployeeDropdown() {
    const roleFilter = getLogTableRoleFilter()?.value || "";
    let employeesForRole = logTableData;
    if (roleFilter) {
      employeesForRole = logTableData.filter(
        (r) => String(r.role || "").toLowerCase().trim() === roleFilter
      );
    }
    populateLogEmployeeFilter(employeesForRole);
  }

  function applyLogFilters() {
    const rowsForSummary = getFilteredLogRows(true);
    const rowsForTable = getFilteredLogRows(false);
    renderLogSummary(rowsForSummary);
    renderLogTable(rowsForTable);

    const empFilterVal = getLogTableEmployeeFilter()?.value;
    const bottomContainer = document.getElementById("logTableBottomDetails");
    const bottomTitle = document.getElementById("logTableBottomDetailsTitle");
    const bottomBody = document.getElementById("logTableBottomDetailsBody");

    if (empFilterVal && bottomContainer && bottomTitle && bottomBody) {
      const emp = logTableData.find(r => String(r.user_id) === empFilterVal);
      if (emp) {
        const range = getReportDateRange();
        bottomTitle.textContent = `Activity Details: ${emp.name} (${range.label})`;
        bottomBody.innerHTML = `<div style="text-align: center; padding: 40px; color: #94a3b8;"><i class="fas fa-spinner fa-spin"></i> Loading...</div>`;
        bottomContainer.style.display = "block";
        
        fetchAndBuildLogDetailsHtml(emp.user_id, range.start_date, range.end_date).then(html => {
          bottomBody.innerHTML = html;
        });
      } else {
        bottomContainer.style.display = "none";
      }
    } else if (bottomContainer) {
      bottomContainer.style.display = "none";
    }
  }

  function exportLogTableCsv() {
    const rows = getFilteredLogRows();
    if (!rows.length) return;

    const headers = [
      "Employee",
      "Role",
      "Company",
      "Leads Added",
      "Follow-ups",
      "Appointments",
      "Deals Closed",
    ];

    const csvRows = [headers.join(",")];
    rows.forEach((r) => {
      csvRows.push(
        [
          `"${String(r.name || "").replace(/"/g, '""')}"`,
          String(r.role || "").toUpperCase(),
          `"${getLogCompanyLabel(r.comp_name).replace(/"/g, '""')}"`,
          Number(r.leads_added || 0),
          Number(r.followups || 0),
          Number(r.appointments || 0),
          Number(r.deals_closed || 0),
        ].join(",")
      );
    });

    const blob = new Blob([csvRows.join("\n")], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `report-${logTableCurrentDate || getLogTableTodayStr()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function loadLogTable() {
    const container = document.getElementById("logTableBody");
    const summaryContainer = document.getElementById("logTableSummary");
    if (!container) return;

    const range = getReportDateRange();
    logTableCurrentDate = range.label;

    container.innerHTML = `
      <div class="log-table-loading">
        <i class="fas fa-spinner"></i>
        Loading report data...
      </div>
    `;
    if (summaryContainer) summaryContainer.innerHTML = "";

    try {
      const url = `${BASE_URL}/api/admin/daily-log?start_date=${encodeURIComponent(range.start_date)}&end_date=${encodeURIComponent(range.end_date)}`;
      const res = await fetch(url, { cache: "no-store" });
      const result = await res.json();

      if (!result.success) {
        throw new Error(result.message || "Failed to load report data");
      }

      logTableData = Array.isArray(result.data) ? result.data : [];
      logTableRoles = Array.isArray(result.roles) ? result.roles : [];

      populateLogRoleFilter(logTableRoles);
      updateEmployeeDropdown();
      applyLogFilters();

      const roleSelect = getLogTableRoleFilter();
      if (roleSelect) {
        roleSelect.onchange = function() {
          updateEmployeeDropdown();
          applyLogFilters();
        };
      }
    } catch (err) {
      console.error("Report Load Error:", err);
      container.innerHTML = `
        <div class="log-table-empty">
          <i class="fas fa-exclamation-triangle"></i>
          ${escapeLogHtml(err.message || "Failed to load report.")}
        </div>
      `;
    }
  }

  async function fetchAndBuildLogDetailsHtml(userId, startDate, endDate) {
    try {
      const url = `${BASE_URL}/api/admin/daily-log/details?user_id=${userId}&start_date=${encodeURIComponent(startDate)}&end_date=${encodeURIComponent(endDate)}`;
      const res = await fetch(url, { cache: "no-store" });
      const result = await res.json();

      if (!result.success) throw new Error(result.message);

      const d = result.details;
      let html = "";

      // Leads Added
      if (d.leads && d.leads.length > 0) {
        html += `<div class="log-details-section"><h3>Leads Added (${d.leads.length})</h3>
          <table class="log-details-mini-table">
            <tr><th>Company</th><th>Contact</th><th>Status</th><th>Time</th></tr>`;
        d.leads.forEach(l => {
          const time = l.created_at ? new Date(l.created_at).toLocaleTimeString("en-IN", {hour:'2-digit', minute:'2-digit'}) : "-";
          html += `<tr><td>${escapeLogHtml(l.comp_name)}</td><td>${escapeLogHtml(l.name)} <br><small>${escapeLogHtml(l.mobile)}</small></td><td>${escapeLogHtml(l.lead_status)}</td><td>${time}</td></tr>`;
        });
        html += `</table></div>`;
      }

      // Followups
      if (d.followups && d.followups.length > 0) {
        html += `<div class="log-details-section"><h3>Follow-ups (${d.followups.length})</h3>
          <table class="log-details-mini-table">
            <tr><th>Company</th><th>Contact</th><th>Status</th><th>Time</th></tr>`;
        d.followups.forEach(l => {
          html += `<tr><td>${escapeLogHtml(l.comp_name)}</td><td>${escapeLogHtml(l.name)} <br><small>${escapeLogHtml(l.mobile)}</small></td><td>${escapeLogHtml(l.lead_status)}</td><td>${escapeLogHtml(l.follow_time)}</td></tr>`;
        });
        html += `</table></div>`;
      }

      // Appointments
      if (d.appointments && d.appointments.length > 0) {
        html += `<div class="log-details-section"><h3>Appointments (${d.appointments.length})</h3>
          <table class="log-details-mini-table">
            <tr><th>Company</th><th>Contact</th><th>Status</th><th>Time</th></tr>`;
        d.appointments.forEach(l => {
          html += `<tr><td>${escapeLogHtml(l.comp_name)}</td><td>${escapeLogHtml(l.name)} <br><small>${escapeLogHtml(l.mobile)}</small></td><td>${escapeLogHtml(l.lead_status)}</td><td>${escapeLogHtml(l.app_time)}</td></tr>`;
        });
        html += `</table></div>`;
      }

      // Deals
      if (d.deals && d.deals.length > 0) {
        html += `<div class="log-details-section"><h3>Deals Closed (${d.deals.length})</h3>
          <table class="log-details-mini-table">
            <tr><th>Company</th><th>Contact</th><th>Status</th></tr>`;
        d.deals.forEach(l => {
          html += `<tr><td>${escapeLogHtml(l.comp_name)}</td><td>${escapeLogHtml(l.name)} <br><small>${escapeLogHtml(l.mobile)}</small></td><td>${escapeLogHtml(l.lead_status)}</td></tr>`;
        });
        html += `</table></div>`;
      }

      // Projects
      if (d.projects && d.projects.length > 0) {
        html += `<div class="log-details-section"><h3>Project Tasks (${d.projects.length})</h3>
          <table class="log-details-mini-table">
            <tr><th>Project</th><th>Phase</th><th>Status</th><th>Progress</th><th>Time</th></tr>`;
        d.projects.forEach(p => {
          const time = p.updated_at ? new Date(p.updated_at).toLocaleTimeString("en-IN", {hour:'2-digit', minute:'2-digit'}) : "-";
          html += `<tr><td>${escapeLogHtml(p.comp_name)}</td><td>${escapeLogHtml(p.phase_key)}</td><td>${escapeLogHtml(p.status)}</td><td>${p.progress}%</td><td>${time}</td></tr>`;
        });
        html += `</table></div>`;
      }

      // HR
      if (d.hr && d.hr.length > 0) {
        html += `<div class="log-details-section"><h3>HR Payrolls (${d.hr.length})</h3>
          <table class="log-details-mini-table">
            <tr><th>Employee</th><th>Role</th><th>Month</th><th>Amount</th></tr>`;
        d.hr.forEach(h => {
          html += `<tr><td>${escapeLogHtml(h.employee_name_snapshot)}</td><td>${escapeLogHtml(h.role_snapshot)}</td><td>${escapeLogHtml(h.month_key)}</td><td>₹${h.net_payable}</td></tr>`;
        });
        html += `</table></div>`;
      }

      // Accounts
      if (d.accounts && d.accounts.length > 0) {
        html += `<div class="log-details-section"><h3>Account Payments (${d.accounts.length})</h3>
          <table class="log-details-mini-table">
            <tr><th>Project/Company</th><th>Method</th><th>Status</th><th>Amount</th></tr>`;
        d.accounts.forEach(a => {
          html += `<tr><td>${escapeLogHtml(a.comp_name)}</td><td>${escapeLogHtml(a.payment_method)}</td><td>${escapeLogHtml(a.payment_status)}</td><td>₹${a.amount}</td></tr>`;
        });
        html += `</table></div>`;
      }

      if (!html) {
        html = `<div class="log-details-empty">No detailed activities recorded for this date range.</div>`;
      }

      return html;

    } catch (err) {
      return `<div class="log-details-empty" style="color: #ef4444;">Failed to load details: ${escapeLogHtml(err.message)}</div>`;
    }
  }

  async function openLogDetails(userId, userName) {
    const modal = document.getElementById("logDetailsModal");
    const title = document.getElementById("logDetailsTitle");
    const body = document.getElementById("logDetailsBody");
    const range = getReportDateRange();

    if (!modal || !title || !body) return;

    title.textContent = `Activity Details: ${userName} (${range.label})`;
    body.innerHTML = `<div style="text-align: center; padding: 40px; color: #94a3b8;"><i class="fas fa-spinner fa-spin"></i> Loading...</div>`;
    modal.classList.remove('hidden');
    modal.style.display = 'flex';

    body.innerHTML = await fetchAndBuildLogDetailsHtml(userId, range.start_date, range.end_date);
  }

  function closeLogDetailsModal() {
    const modal = document.getElementById("logDetailsModal");
    if (modal) modal.classList.add('hidden');
      modal.style.display = 'none';
  }

  // Close modal when clicking outside
  window.addEventListener('click', function(event) {
    const modal = document.getElementById("logDetailsModal");
    if (event.target == modal) {
      modal.classList.add('hidden');
      modal.style.display = 'none';
    }
  });

  // Expose globally
  window.loadLogTable = loadLogTable;
  window.applyLogFilters = applyLogFilters;
  window.exportLogTableCsv = exportLogTableCsv;
  window.openLogDetails = openLogDetails;
  window.closeLogDetailsModal = closeLogDetailsModal;

})();
