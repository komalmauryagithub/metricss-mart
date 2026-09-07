(function () {
  const BASE_URL =
    window.location.protocol === "file:" ||
    ["localhost", "127.0.0.1"].includes(window.location.hostname)
      ? "http://localhost:3000"
      : window.location.origin;

  const state = {
    adminRows: [],
    adminChart: null,
    employeeChart: null,
    adminSearchTimer: null,
  };
  const FIXED_SALES_COMMISSION_PERCENT = 10;

  function getCurrentUser() {
    try {
      return JSON.parse(localStorage.getItem("currentUser") || "null");
    } catch (error) {
      return null;
    }
  }

  function normalizeRole(role) {
    return String(role || "").trim().toLowerCase();
  }

  function canUseSalesCompensation(role) {
    return ["me", "tme"].includes(normalizeRole(role));
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function formatCurrency(value) {
    return `Rs. ${Number(value || 0).toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }

  function formatMonthLabel(monthKey) {
    if (!monthKey) return "Current Month";
    const [year, month] = String(monthKey).split("-").map(Number);
    const date = new Date(year, (month || 1) - 1, 1);
    return date.toLocaleDateString("en-IN", {
      month: "long",
      year: "numeric",
    });
  }

  function getCurrentMonthKey() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  }

  function showMessage(title, message, isSuccess = true) {
    if (typeof window.showPopup === "function") {
      window.showPopup(title, message, isSuccess);
      return;
    }

    window.alert(`${title}: ${message}`);
  }

  async function fetchJson(url, options = {}) {
    const response = await fetch(url, {
      cache: "no-store",
      ...options,
    });
    const text = await response.text();

    let payload = {};
    try {
      payload = text ? JSON.parse(text) : {};
    } catch (error) {
      throw new Error("Server returned an invalid response");
    }

    if (!response.ok || payload.success === false) {
      throw new Error(payload.message || "Request failed");
    }

    return payload;
  }

  function getSalaryShell() {
    return document.querySelector("#salary [data-payroll-scope]");
  }

  function bootstrap() {
    const shell = getSalaryShell();
    if (!shell) return;

    renderShell(shell);

    if (document.getElementById("salary")?.classList.contains("active")) {
      handleSectionShown("salary");
    }
  }

  function renderShell(shell) {
    const scope = shell.dataset.payrollScope;
    const user = getCurrentUser();

    if (scope === "admin") {
      renderAdminShell(shell, user);
      attachAdminEvents();
      return;
    }

    renderEmployeeShell(shell, user);
    attachEmployeeEvents();
  }

  function renderAdminShell(shell, user) {
    shell.innerHTML = `
      <div class="payroll-shell">
        <section class="payroll-hero">
          <h2>Salary Management</h2>
          <p>Generate monthly payroll, track leave-linked deductions, manage employee salary profiles, and export finance-ready reports from one place.</p>
          <div class="payroll-hero-meta">
            <span class="payroll-hero-chip">Admin Control Center</span>
            <span class="payroll-hero-chip">${escapeHtml(formatMonthLabel(getCurrentMonthKey()))}</span>
            <span class="payroll-hero-chip">${escapeHtml(user?.name || "Payroll Admin")}</span>
          </div>
        </section>

        <section class="payroll-toolbar">
          <div class="payroll-filter-grid">
            <div class="payroll-field">
              <label for="payrollAdminMonth">Payroll Month</label>
              <input type="month" id="payrollAdminMonth" value="${escapeHtml(getCurrentMonthKey())}" />
            </div>
            <div class="payroll-field">
              <label for="payrollAdminRole">Role</label>
              <select id="payrollAdminRole">
                <option value="">All Roles</option>
                <option value="admin">Admin</option>
                <option value="hr">HR</option>
                <option value="tme">TME</option>
                <option value="me">ME</option>
                <option value="dev">DEV</option>
                <option value="seo">SEO</option>
                <option value="smo">SMO</option>
                <option value="accounts">Accounts</option>
                <option value="dm">DM</option>
              </select>
            </div>
            <div class="payroll-field">
              <label for="payrollAdminDepartment">Department</label>
              <input type="text" id="payrollAdminDepartment" placeholder="Filter by department" />
            </div>
            <div class="payroll-field">
              <label for="payrollAdminSearch">Search</label>
              <input type="text" id="payrollAdminSearch" placeholder="Name, email, contact" />
            </div>
          </div>
          <div class="payroll-toolbar-actions">
            <button type="button" class="payroll-btn secondary" id="payrollAdminRefreshBtn">Refresh</button>
            <button type="button" class="payroll-btn warning" id="payrollAdminExportBtn">Export Excel</button>
          </div>
        </section>

        <section class="payroll-kpis" id="payrollAdminSummary"></section>

        <section class="payroll-layout">
          <div class="payroll-panel">
            <h3>Salary Trend</h3>
            <p>Saved payroll runs across recent months.</p>
            <div class="payroll-chart-wrap">
              <canvas id="payrollAdminChart"></canvas>
            </div>
          </div>
          <div class="payroll-panel">
            <h3>Department Expense</h3>
            <p>Current month payout split by department.</p>
            <div id="payrollAdminDepartmentBreakdown" class="payroll-breakdown-list"></div>
          </div>
        </section>

        <section class="payroll-panel payroll-table-panel">
          <div class="payroll-table-header">
            <h3>Employee Payroll Grid</h3>
            <p>Salary, leave deduction, incentives, bonus and payslip actions for each visible employee.</p>
          </div>
          <div class="payroll-table-wrap">
            <table class="payroll-table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Role</th>
                  <th>Profile</th>
                  <th>Pay Structure</th>
                  <th>Leave Summary</th>
                  <th>Adjustments</th>
                  <th>Final Salary</th>
                  <th>Notes</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody id="payrollAdminTableBody">
                <tr>
                  <td colspan="9">
                    <div class="payroll-empty">Loading salary data...</div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </div>
    `;
  }

  function renderEmployeeShell(shell, user) {
    const roleLabel = String(user?.role || shell.dataset.payrollRoleLabel || "Employee")
      .trim()
      .toUpperCase();

    shell.innerHTML = `
      <div class="payroll-shell">
        <section class="payroll-hero">
          <h2>Salary & Payslip</h2>
          <p>Your monthly salary snapshot, leave-based deductions, payout history, and downloadable payslips are available here.</p>
          <div class="payroll-hero-meta">
            <span class="payroll-hero-chip">${escapeHtml(roleLabel)}</span>
            <span class="payroll-hero-chip">${escapeHtml(user?.name || "Employee")}</span>
          </div>
        </section>

        <section class="payroll-toolbar">
          <div class="payroll-filter-grid">
            <div class="payroll-field">
              <label for="payrollMyMonth">Payroll Month</label>
              <input type="month" id="payrollMyMonth" value="${escapeHtml(getCurrentMonthKey())}" />
            </div>
          </div>
          <div class="payroll-toolbar-actions">
            <button type="button" class="payroll-btn secondary" id="payrollMyRefreshBtn">Refresh</button>
            <button type="button" class="payroll-btn primary" id="payrollMyPayslipBtn" disabled>Download Current Payslip</button>
          </div>
        </section>

        <div id="payrollMyLeadNote" class="hidden"></div>
        <section class="payroll-summary-grid" id="payrollMySummary"></section>

        <section class="payroll-layout">
          <div class="payroll-panel">
            <h3>Salary Composition</h3>
            <p>Net salary vs leave deduction and manual penalty.</p>
            <div class="payroll-chart-wrap">
              <canvas id="payrollMyChart"></canvas>
            </div>
          </div>
          <div class="payroll-panel">
            <h3>Deduction Breakdown</h3>
            <p>Attendance and leave integration summary for the selected month.</p>
            <div id="payrollMyBreakdown"></div>
          </div>
        </section>

        <section class="payroll-panel">
          <h3>Payslip History</h3>
          <p>Stored payroll runs available for download.</p>
          <div class="payroll-table-wrap">
            <table class="payroll-history-table">
              <thead>
                <tr>
                  <th>Month</th>
                  <th>Basic Salary</th>
                  <th>Deduction</th>
                  <th>Bonus + Incentive</th>
                  <th>Final Salary</th>
                  <th>Status</th>
                  <th>Payslip</th>
                </tr>
              </thead>
              <tbody id="payrollMyHistoryBody">
                <tr>
                  <td colspan="7">
                    <div class="payroll-empty">Loading salary history...</div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </div>
    `;
  }

  function attachAdminEvents() {
    const monthInput = document.getElementById("payrollAdminMonth");
    const roleSelect = document.getElementById("payrollAdminRole");
    const departmentInput = document.getElementById("payrollAdminDepartment");
    const searchInput = document.getElementById("payrollAdminSearch");
    const refreshBtn = document.getElementById("payrollAdminRefreshBtn");
    const exportBtn = document.getElementById("payrollAdminExportBtn");
    const tableBody = document.getElementById("payrollAdminTableBody");

    if (monthInput) {
      monthInput.addEventListener("change", () => loadAdminPayrollSection(true));
    }

    if (roleSelect) {
      roleSelect.addEventListener("change", () => loadAdminPayrollSection(true));
    }

    if (departmentInput) {
      departmentInput.addEventListener("input", () => {
        clearTimeout(state.adminSearchTimer);
        state.adminSearchTimer = setTimeout(() => loadAdminPayrollSection(true), 350);
      });
    }

    if (searchInput) {
      searchInput.addEventListener("input", () => {
        clearTimeout(state.adminSearchTimer);
        state.adminSearchTimer = setTimeout(() => loadAdminPayrollSection(true), 350);
      });
      searchInput.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          loadAdminPayrollSection(true);
        }
      });
    }

    refreshBtn?.addEventListener("click", () => loadAdminPayrollSection(true));
    exportBtn?.addEventListener("click", exportAdminPayroll);

    tableBody?.addEventListener("click", async (event) => {
      const button = event.target.closest("button[data-action]");
      if (!button) return;

      const row = button.closest("tr[data-employee-id]");
      const employeeId = Number(row?.dataset.employeeId);
      if (!employeeId) return;

      const action = button.dataset.action;
      if (action === "save") {
        await saveAdminRow(employeeId, button);
      } else if (action === "payslip") {
        const payrollId = Number(button.dataset.payrollId);
        if (payrollId) {
          downloadPayslip(payrollId);
        }
      }
    });

    tableBody?.addEventListener("change", (event) => {
      const field = event.target.closest('[data-field="compensation-type"]');
      if (!field) return;

      const row = field.closest("tr[data-employee-id]");
      if (row) updateAdminCompensationRow(row);
    });
  }

  function attachEmployeeEvents() {
    document
      .getElementById("payrollMyMonth")
      ?.addEventListener("change", () => loadEmployeePayrollSection(true));
    document
      .getElementById("payrollMyRefreshBtn")
      ?.addEventListener("click", () => loadEmployeePayrollSection(true));
    document
      .getElementById("payrollMyPayslipBtn")
      ?.addEventListener("click", () => {
        const payrollId = Number(
          document.getElementById("payrollMyPayslipBtn")?.dataset.payrollId || 0,
        );
        if (payrollId) {
          downloadPayslip(payrollId);
        }
      });

    document
      .getElementById("payrollMyHistoryBody")
      ?.addEventListener("click", (event) => {
        const button = event.target.closest("button[data-payroll-id]");
        if (!button) return;

        const payrollId = Number(button.dataset.payrollId || 0);
        if (payrollId) {
          downloadPayslip(payrollId);
        }
      });
  }

  function updateAdminCompensationRow(row) {
    const canUseCommission = canUseSalesCompensation(row?.dataset?.role);
    const compensationType = String(
      row?.querySelector('[data-field="compensation-type"]')?.value || "salary",
    ).toLowerCase();
    const isCommission = canUseCommission && compensationType === "commission";
    const salaryInput = row?.querySelector('[data-field="salary"]');
    const commissionInput = row?.querySelector('[data-field="commission-percent"]');
    const incentiveInput = row?.querySelector('[data-field="incentive"]');

    row?.querySelectorAll('[data-comp-section="salary"]').forEach((element) => {
      element.classList.toggle("hidden", isCommission);
    });
    row?.querySelectorAll('[data-comp-section="commission"]').forEach((element) => {
      element.classList.toggle("hidden", !isCommission);
    });

    if (salaryInput) {
      salaryInput.disabled = isCommission;
      if (isCommission) {
        salaryInput.value = "0.00";
      }
    }

    if (commissionInput) {
      commissionInput.disabled = !isCommission;
      commissionInput.readOnly = isCommission;
      if (isCommission) {
        commissionInput.value = FIXED_SALES_COMMISSION_PERCENT.toFixed(2);
      }
      if (!isCommission) {
        commissionInput.value = "0.00";
        commissionInput.readOnly = false;
      }
    }

    if (incentiveInput) {
      incentiveInput.readOnly = canUseCommission;
    }
  }

  function buildAdminOverviewUrl() {
    const user = getCurrentUser();
    const params = new URLSearchParams({
      adminId: String(user?.id || ""),
      month: document.getElementById("payrollAdminMonth")?.value || getCurrentMonthKey(),
      role: document.getElementById("payrollAdminRole")?.value || "",
      department: document.getElementById("payrollAdminDepartment")?.value || "",
      search: document.getElementById("payrollAdminSearch")?.value || "",
    });

    return `${BASE_URL}/api/payroll/admin/overview?${params.toString()}`;
  }

  async function loadAdminPayrollSection(forceRefresh) {
    const user = getCurrentUser();
    const tbody = document.getElementById("payrollAdminTableBody");
    const summary = document.getElementById("payrollAdminSummary");
    const breakdown = document.getElementById("payrollAdminDepartmentBreakdown");

    if (!user?.id) return;
    if (!tbody || !summary || !breakdown) return;

    if (normalizeRole(user.role) !== "admin") {
      summary.innerHTML = "";
      breakdown.innerHTML = "";
      destroyChart("adminChart");
      tbody.innerHTML = `
        <tr>
          <td colspan="9">
            <div class="payroll-empty">Please login with an admin account to view salary management.</div>
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = `
      <tr>
        <td colspan="9">
          <div class="payroll-empty">Loading payroll summary...</div>
        </td>
      </tr>
    `;

    try {
      const payload = await fetchJson(buildAdminOverviewUrl(), {
        cache: forceRefresh ? "no-store" : "default",
      });

      state.adminRows = Array.isArray(payload.data) ? payload.data : [];
      renderAdminSummary(payload.summary || {}, payload.month);
      renderAdminBreakdown(payload.departmentExpense || []);
      renderAdminTrendChart(payload.trend || []);
      renderAdminTable(state.adminRows);
    } catch (error) {
      summary.innerHTML = "";
      breakdown.innerHTML = "";
      destroyChart("adminChart");
      tbody.innerHTML = `
        <tr>
          <td colspan="9">
            <div class="payroll-empty">${escapeHtml(error.message || "Unable to load payroll data")}</div>
          </td>
        </tr>
      `;
    }
  }

  function renderAdminSummary(summary, monthKey) {
    const container = document.getElementById("payrollAdminSummary");
    if (!container) return;

    container.innerHTML = `
      <article class="payroll-kpi-card">
        <span>Total Employees</span>
        <strong>${Number(summary.totalEmployees || 0)}</strong>
        <small>${escapeHtml(formatMonthLabel(monthKey))}</small>
      </article>
      <article class="payroll-kpi-card">
        <span>Projected Payout</span>
        <strong>${escapeHtml(formatCurrency(summary.totalMonthlyPayout || 0))}</strong>
        <small>Net payout after deductions</small>
      </article>
      <article class="payroll-kpi-card">
        <span>Employees With Deductions</span>
        <strong>${Number(summary.employeesWithDeductions || 0)}</strong>
        <small>Leave or penalty impacted</small>
      </article>
      <article class="payroll-kpi-card">
        <span>Departments</span>
        <strong>${Number(summary.departmentCount || 0)}</strong>
        <small>Department-wise expense tracking</small>
      </article>
      <article class="payroll-kpi-card">
        <span>Approved Leave Load</span>
        <strong>${Number(summary.totalPaidLeaves || 0) + Number(summary.totalUnpaidLeaves || 0)}</strong>
        <small>${Number(summary.totalUnpaidLeaves || 0)} unpaid and ${Number(summary.totalHalfDays || 0)} half day</small>
      </article>
    `;
  }

  function renderAdminBreakdown(items) {
    const container = document.getElementById("payrollAdminDepartmentBreakdown");
    if (!container) return;

    if (!items.length) {
      container.innerHTML = '<div class="payroll-empty">No department payout available yet.</div>';
      return;
    }

    container.innerHTML = items
      .map(
        (item) => `
          <div class="payroll-breakdown-item">
            <div>
              <strong>${escapeHtml(item.department || "General")}</strong>
              <small>Payout bucket</small>
            </div>
            <span>${escapeHtml(formatCurrency(item.amount || 0))}</span>
          </div>
        `,
      )
      .join("");
  }

  function destroyChart(key) {
    if (key === "adminChart" && state.adminChart) {
      state.adminChart.destroy();
      state.adminChart = null;
    }
    if (key === "employeeChart" && state.employeeChart) {
      state.employeeChart.destroy();
      state.employeeChart = null;
    }
  }

  function renderAdminTrendChart(trend) {
    const canvas = document.getElementById("payrollAdminChart");
    if (!canvas || typeof window.Chart === "undefined") return;

    destroyChart("adminChart");

    state.adminChart = new window.Chart(canvas.getContext("2d"), {
      type: "line",
      data: {
        labels: trend.map((item) => formatMonthLabel(item.monthKey)),
        datasets: [
          {
            label: "Total Payout",
            data: trend.map((item) => Number(item.totalPayout || 0)),
            borderColor: "#0f766e",
            backgroundColor: "rgba(20, 184, 166, 0.18)",
            fill: true,
            tension: 0.32,
            borderWidth: 3,
            pointRadius: 4,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false,
          },
          tooltip: {
            callbacks: {
              label(context) {
                return formatCurrency(context.parsed.y || 0);
              },
            },
          },
        },
        scales: {
          y: {
            ticks: {
              callback(value) {
                return `Rs. ${Number(value).toLocaleString("en-IN")}`;
              },
            },
          },
        },
      },
    });
  }

  function renderAdminTable(rows) {
    const tbody = document.getElementById("payrollAdminTableBody");
    if (!tbody) return;

    if (!rows.length) {
      tbody.innerHTML = `
        <tr>
          <td colspan="9">
            <div class="payroll-empty">No salary records matched the current filters.</div>
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = rows
      .map((row) => {
        const normalizedRole = String(row.role || "").toLowerCase();
        const canUseCommission = canUseSalesCompensation(normalizedRole);
        const isCommission =
          canUseCommission &&
          String(row.compensationType || row.compensation_type || "salary").toLowerCase() === "commission";
        const hasAutoTargetIncentive =
          !isCommission && (normalizedRole === "me" || normalizedRole === "tme");
        const hasLockedIncentive = hasAutoTargetIncentive || isCommission;
        const salaryTarget = Number(row.target || 0);
        const targetAchieved = Number(row.targetAchieved || 0);
        const targetRemaining = Number(
          row.targetRemaining ?? Math.max(salaryTarget - targetAchieved, 0),
        );
        const targetRate = Number(row.targetIncentiveRate || 0.07) * 100;
        const commissionPercent = isCommission ? FIXED_SALES_COMMISSION_PERCENT : 0;
        const statusClass = row.isGenerated
          ? "payroll-pill"
          : row.leaveDeduction > 0
            ? "payroll-pill warning"
            : "payroll-pill";

        return `
          <tr data-employee-id="${Number(row.employeeId)}" data-role="${escapeHtml(normalizedRole)}">
            <td>
              <div class="payroll-name-block">
                <strong>${escapeHtml(row.name || "Employee")}</strong>
                <small>${escapeHtml(row.email || row.contact || "No contact")}</small>
              </div>
            </td>
            <td>
              <span class="${statusClass}">
                ${escapeHtml(row.roleLabel || String(row.role || "").toUpperCase())}
              </span>
            </td>
            <td>
              <div class="payroll-cell-stack">
                <label>
                  <span>Department</span>
                  <input class="payroll-inline-input" data-field="department" value="${escapeHtml(row.department || "")}" />
                </label>
                <label>
                  <span>Joining Date</span>
                  <input type="date" class="payroll-inline-input" data-field="joining-date" value="${escapeHtml((row.joiningDate || "").slice(0, 10))}" />
                </label>
                <label class="payroll-inline-check">
                  <input type="checkbox" class="payroll-checkbox" data-field="team-lead" ${row.isTeamLead ? "checked" : ""} />
                  <span>Team Lead</span>
                </label>
              </div>
            </td>
            <td>
              <div class="payroll-cell-stack">
                <label>
                  <span>Pay Type</span>
                  <select class="payroll-inline-input" data-field="compensation-type" ${canUseCommission ? "" : "disabled"}>
                    <option value="salary" ${isCommission ? "" : "selected"}>Salary</option>
                    ${canUseCommission ? `<option value="commission" ${isCommission ? "selected" : ""}>Commission</option>` : ""}
                  </select>
                </label>
                <label data-comp-section="salary" class="${isCommission ? "hidden" : ""}">
                  <span>Monthly Salary</span>
                  <input class="payroll-inline-input" data-field="salary" type="number" min="0" step="0.01" value="${escapeHtml(Number(row.salary || 0).toFixed(2))}" ${isCommission ? "disabled" : ""} />
                </label>
                ${canUseCommission ? `
                <label data-comp-section="commission" class="${isCommission ? "" : "hidden"}">
                  <span>Commission % (Fixed)</span>
                  <input class="payroll-inline-input" data-field="commission-percent" type="number" min="0" max="100" step="0.01" value="${escapeHtml(commissionPercent.toFixed(2))}" ${isCommission ? "readonly" : "disabled"} />
                </label>
                ` : ""}
                ${isCommission
                  ? `<small data-comp-section="commission">Sales ${escapeHtml(formatCurrency(row.commissionSalesAmount || 0))} | ${Number(row.commissionDealsCount || 0)} deal(s)</small>`
                  : hasAutoTargetIncentive
                    ? `<small data-comp-section="salary">Target ${escapeHtml(formatCurrency(salaryTarget))} (${escapeHtml(formatCurrency(row.salary || 0))} x 7)</small>
                       <small data-comp-section="salary">Achieved ${escapeHtml(formatCurrency(targetAchieved))} | Remaining ${escapeHtml(formatCurrency(targetRemaining))}</small>`
                    : `<small data-comp-section="salary">${escapeHtml(formatCurrency(row.dailySalary || 0))} / day</small>`}
              </div>
            </td>
            <td>
              <div class="payroll-cell-stack">
                <small>Paid Leave: <strong>${Number(row.paidLeaveDays || 0)}</strong></small>
                <small>Unpaid Leave: <strong>${Number(row.unpaidLeaveDays || 0)}</strong></small>
                <small>Half Day: <strong>${Number(row.halfDays || 0)}</strong></small>
                <small>Deduction: <strong>${escapeHtml(formatCurrency(row.leaveDeduction || 0))}</strong></small>
              </div>
            </td>
            <td>
              <div class="payroll-cell-stack">
                <label>
                  <span>Bonus</span>
                  <input class="payroll-inline-input" data-field="bonus" type="number" min="0" step="0.01" value="${escapeHtml(Number(row.bonusAmount || 0).toFixed(2))}" />
                </label>
                <label>
                  <span>${isCommission ? "Commission" : "Incentive"}</span>
                  <input class="payroll-inline-input" data-field="incentive" type="number" min="0" step="0.01" value="${escapeHtml(Number(row.incentiveAmount || 0).toFixed(2))}" ${hasLockedIncentive ? "readonly" : ""} />
                </label>
                ${isCommission
                  ? `<small>Sales commission fixed at ${commissionPercent}% of closed sales.</small>`
                  : hasAutoTargetIncentive
                  ? `<small>${row.incentiveAmount > 0
                    ? `Auto ${targetRate.toFixed(0)}% target incentive applied.`
                    : `Auto ${targetRate.toFixed(0)}% incentive unlocks after monthly target completion.`}</small>`
                  : ""}
                <label>
                  <span>Penalty</span>
                  <input class="payroll-inline-input" data-field="penalty" type="number" min="0" step="0.01" value="${escapeHtml(Number(row.penaltyAmount || 0).toFixed(2))}" />
                </label>
              </div>
            </td>
            <td>
              <div class="payroll-cell-stack">
                <strong>${escapeHtml(formatCurrency(row.finalSalary || 0))}</strong>
                <span class="${row.isGenerated ? "payroll-pill" : "payroll-pill warning"}">
                  ${row.isGenerated ? "Generated" : "Preview"}
                </span>
                <small>${row.generatedAt ? `Saved ${escapeHtml(formatMonthLabel(row.monthKey))}` : "Generate to lock payslip"}</small>
              </div>
            </td>
            <td>
              <textarea class="payroll-inline-input" data-field="notes" placeholder="Optional notes">${escapeHtml(row.notes || "")}</textarea>
            </td>
            <td>
              <div class="payroll-row-actions">
                <button type="button" class="payroll-btn secondary" data-action="save">Save Profile</button>
                <button
                  type="button"
                  class="payroll-btn ghost"
                  data-action="payslip"
                  data-payroll-id="${Number(row.payrollId || 0)}"
                  ${row.payrollId ? "" : "disabled"}
                >
                  Payslip
                </button>
              </div>
            </td>
          </tr>
        `;
      })
      .join("");
  }

  function collectRowPayload(employeeId) {
    const row = document.querySelector(`#payrollAdminTableBody tr[data-employee-id="${employeeId}"]`);
    if (!row) return null;

    return {
      employeeId,
      department: row.querySelector('[data-field="department"]')?.value || "",
      joiningDate: row.querySelector('[data-field="joining-date"]')?.value || "",
      isTeamLead: row.querySelector('[data-field="team-lead"]')?.checked || false,
      salary: row.querySelector('[data-field="salary"]')?.value || "0",
      compensationType:
        canUseSalesCompensation(row.dataset.role)
          ? row.querySelector('[data-field="compensation-type"]')?.value || "salary"
          : "salary",
      commissionPercent:
        canUseSalesCompensation(row.dataset.role) &&
        row.querySelector('[data-field="compensation-type"]')?.value === "commission"
          ? String(FIXED_SALES_COMMISSION_PERCENT)
          : "0",
      bonusAmount: row.querySelector('[data-field="bonus"]')?.value || "0",
      incentiveAmount: row.querySelector('[data-field="incentive"]')?.value || "0",
      penaltyAmount: row.querySelector('[data-field="penalty"]')?.value || "0",
      notes: row.querySelector('[data-field="notes"]')?.value || "",
    };
  }

  async function saveAdminRow(employeeId, button) {
    const user = getCurrentUser();
    if (!user?.id) return;
    if (normalizeRole(user.role) !== "admin") {
      showMessage("Access Denied", "Please login with an admin account to update salary profiles.", false);
      return;
    }

    const payload = collectRowPayload(employeeId);
    if (!payload) return;

    const previousLabel = button.textContent;
    button.disabled = true;
    button.textContent = "Saving...";

    try {
      await fetchJson(
        `${BASE_URL}/api/payroll/admin/employee/${employeeId}/compensation`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            adminId: user.id,
            salary: payload.salary,
            compensationType: payload.compensationType,
            commissionPercent: payload.commissionPercent,
            department: payload.department,
            joiningDate: payload.joiningDate,
            isTeamLead: payload.isTeamLead,
          }),
        },
      );
      showMessage("Salary", "Compensation updated successfully.", true);
      await loadAdminPayrollSection(true);
    } catch (error) {
      showMessage("Salary", error.message || "Failed to update compensation.", false);
    } finally {
      button.disabled = false;
      button.textContent = previousLabel;
    }
  }

  async function generateAdminPayroll(mode, employeeId, button) {
    const user = getCurrentUser();
    if (!user?.id) return;
    if (normalizeRole(user.role) !== "admin") {
      showMessage("Access Denied", "Please login with an admin account to generate payroll.", false);
      return;
    }

    const month = document.getElementById("payrollAdminMonth")?.value || getCurrentMonthKey();
    const previousLabel = button?.textContent || "";

    let employees = [];
    if (mode === "single" && employeeId) {
      const rowPayload = collectRowPayload(employeeId);
      if (rowPayload) {
        employees = [rowPayload];
      }
    } else {
      employees = Array.from(
        document.querySelectorAll("#payrollAdminTableBody tr[data-employee-id]"),
      )
        .map((row) => collectRowPayload(Number(row.dataset.employeeId)))
        .filter(Boolean);
    }

    if (!employees.length) {
      showMessage("Payroll", "No employees available to generate payroll.", false);
      return;
    }

    if (button) {
      button.disabled = true;
      button.textContent = "Generating...";
    }

    try {
      await fetchJson(`${BASE_URL}/api/payroll/admin/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          adminId: user.id,
          month,
          employees,
        }),
      });
      showMessage("Payroll", "Payroll generated successfully.", true);
      await loadAdminPayrollSection(true);
    } catch (error) {
      showMessage("Payroll", error.message || "Failed to generate payroll.", false);
    } finally {
      if (button) {
        button.disabled = false;
        button.textContent = previousLabel;
      }
    }
  }

  function exportAdminPayroll() {
    const user = getCurrentUser();
    if (!user?.id) return;
    if (normalizeRole(user.role) !== "admin") {
      showMessage("Access Denied", "Please login with an admin account to export payroll.", false);
      return;
    }

    const params = new URLSearchParams({
      adminId: String(user.id),
      month: document.getElementById("payrollAdminMonth")?.value || getCurrentMonthKey(),
      role: document.getElementById("payrollAdminRole")?.value || "",
      department: document.getElementById("payrollAdminDepartment")?.value || "",
      search: document.getElementById("payrollAdminSearch")?.value || "",
    });

    window.location.href = `${BASE_URL}/api/payroll/admin/export?${params.toString()}`;
  }

  async function loadEmployeePayrollSection(forceRefresh) {
    const user = getCurrentUser();
    if (!user?.id) return;

    const summary = document.getElementById("payrollMySummary");
    const breakdown = document.getElementById("payrollMyBreakdown");
    const historyBody = document.getElementById("payrollMyHistoryBody");
    const payslipBtn = document.getElementById("payrollMyPayslipBtn");
    const month = document.getElementById("payrollMyMonth")?.value || getCurrentMonthKey();

    if (!summary || !breakdown || !historyBody || !payslipBtn) return;

    historyBody.innerHTML = `
      <tr>
        <td colspan="7">
          <div class="payroll-empty">Loading salary history...</div>
        </td>
      </tr>
    `;

    try {
      const payload = await fetchJson(
        `${BASE_URL}/api/payroll/my/${user.id}?requesterId=${user.id}&month=${encodeURIComponent(month)}`,
        {
          cache: forceRefresh ? "no-store" : "default",
        },
      );

      renderEmployeeLeadNote(payload.employee);
      renderEmployeeSummary(payload.preview, payload.employee);
      renderEmployeeBreakdown(payload.preview);
      renderEmployeeHistory(payload.history || []);
      renderEmployeeChart(payload.preview);

      if (payload.preview?.payrollId) {
        payslipBtn.disabled = false;
        payslipBtn.dataset.payrollId = String(payload.preview.payrollId);
      } else {
        payslipBtn.disabled = true;
        payslipBtn.dataset.payrollId = "";
      }
    } catch (error) {
      summary.innerHTML = `<div class="payroll-empty">${escapeHtml(error.message || "Unable to load salary details")}</div>`;
      breakdown.innerHTML = "";
      historyBody.innerHTML = `
        <tr>
          <td colspan="7">
            <div class="payroll-empty">${escapeHtml(error.message || "Unable to load salary history")}</div>
          </td>
        </tr>
      `;
      payslipBtn.disabled = true;
      payslipBtn.dataset.payrollId = "";
      destroyChart("employeeChart");
    }
  }

  function renderEmployeeLeadNote(employee) {
    const note = document.getElementById("payrollMyLeadNote");
    if (!note) return;

    if (String(employee?.role || "").toLowerCase() === "tme" && Number(employee?.isTeamLead || 0)) {
      note.className = "payroll-note";
      note.textContent =
        "Team Lead access remains limited to team attendance and leave approvals. Team salary data stays hidden here by design.";
      return;
    }

    note.className = "hidden";
    note.textContent = "";
  }

  function renderEmployeeSummary(preview, employee) {
    const container = document.getElementById("payrollMySummary");
    if (!container) return;

    const isCommission =
      String(preview.compensationType || "salary").toLowerCase() === "commission";
    const commissionPercent = Number(
      preview.commissionPercent || FIXED_SALES_COMMISSION_PERCENT,
    );
    const historyBonusHeader = document.querySelector(
      ".payroll-history-table thead th:nth-child(4)",
    );
    if (historyBonusHeader) {
      historyBonusHeader.textContent = isCommission ? "Bonus + Commission" : "Bonus + Incentive";
    }

    container.innerHTML = `
      <article class="payroll-summary-tile">
        <span>${isCommission ? "Commission Rate" : "Basic Salary"}</span>
        <strong>${isCommission ? `${commissionPercent.toFixed(0)}%` : escapeHtml(formatCurrency(preview.basicSalary || employee.salary || 0))}</strong>
      </article>
      <article class="payroll-summary-tile">
        <span>Net Salary</span>
        <strong>${escapeHtml(formatCurrency(preview.finalSalary || 0))}</strong>
      </article>
      <article class="payroll-summary-tile">
        <span>Leave Deduction</span>
        <strong>${escapeHtml(formatCurrency(preview.leaveDeduction || 0))}</strong>
      </article>
      <article class="payroll-summary-tile">
        <span>Half Days</span>
        <strong>${Number(preview.halfDays || 0)}</strong>
      </article>
      <article class="payroll-summary-tile">
        <span>${isCommission ? "Sales Commission" : "Bonus + Incentive"}</span>
        <strong>${escapeHtml(formatCurrency(isCommission ? (preview.commissionAmount || preview.incentiveAmount || 0) : ((preview.bonusAmount || 0) + (preview.incentiveAmount || 0))))}</strong>
      </article>
      <article class="payroll-summary-tile">
        <span>Status</span>
        <strong>${preview.isGenerated ? "Generated" : "Preview"}</strong>
      </article>
    `;
  }

  function renderEmployeeBreakdown(preview) {
    const container = document.getElementById("payrollMyBreakdown");
    if (!container) return;

    const isCommission =
      String(preview.compensationType || "salary").toLowerCase() === "commission";
    const incentiveLabel = isCommission ? "Sales Commission" : "Incentive";

    container.innerHTML = `
      <ul class="payroll-inline-list">
        <li><span>Paid Leave Days</span><strong>${Number(preview.paidLeaveDays || 0)}</strong></li>
        <li><span>Unpaid Leave Days</span><strong>${Number(preview.unpaidLeaveDays || 0)}</strong></li>
        <li><span>Half Days</span><strong>${Number(preview.halfDays || 0)}</strong></li>
        <li><span>Bonus</span><strong>${escapeHtml(formatCurrency(preview.bonusAmount || 0))}</strong></li>
        <li><span>${incentiveLabel}</span><strong>${escapeHtml(formatCurrency(isCommission ? (preview.commissionAmount || preview.incentiveAmount || 0) : (preview.incentiveAmount || 0)))}</strong></li>
        <li><span>Penalty</span><strong>${escapeHtml(formatCurrency(preview.penaltyAmount || 0))}</strong></li>
        <li><span>Daily Salary</span><strong>${escapeHtml(formatCurrency(preview.dailySalary || 0))}</strong></li>
      </ul>
    `;
  }

  function renderEmployeeHistory(history) {
    const tbody = document.getElementById("payrollMyHistoryBody");
    if (!tbody) return;

    if (!history.length) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7">
            <div class="payroll-empty">Payslip history will appear after payroll is generated by admin.</div>
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = history
      .map(
        (row) => `
          <tr>
            <td>${escapeHtml(formatMonthLabel(row.monthKey))}</td>
            <td>${escapeHtml(formatCurrency(row.basicSalary || 0))}</td>
            <td>${escapeHtml(formatCurrency((row.leaveDeduction || 0) + (row.penaltyAmount || 0)))}</td>
            <td>${escapeHtml(formatCurrency((row.bonusAmount || 0) + (row.incentiveAmount || 0)))}</td>
            <td>${escapeHtml(formatCurrency(row.finalSalary || 0))}</td>
            <td>${escapeHtml(String(row.status || "generated").toUpperCase())}</td>
            <td>
              <button type="button" class="payroll-btn ghost" data-payroll-id="${Number(row.payrollId || 0)}">Download</button>
            </td>
          </tr>
        `,
      )
      .join("");
  }

  function renderEmployeeChart(preview) {
    const canvas = document.getElementById("payrollMyChart");
    if (!canvas || typeof window.Chart === "undefined") return;

    destroyChart("employeeChart");

    state.employeeChart = new window.Chart(canvas.getContext("2d"), {
      type: "doughnut",
      data: {
        labels: ["Net Salary", "Leave Deduction", "Penalty"],
        datasets: [
          {
            data: [
              Number(preview.finalSalary || 0),
              Number(preview.leaveDeduction || 0),
              Number(preview.penaltyAmount || 0),
            ],
            backgroundColor: ["#0f766e", "#f59e0b", "#dc2626"],
            borderWidth: 0,
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
          },
          tooltip: {
            callbacks: {
              label(context) {
                return `${context.label}: ${formatCurrency(context.parsed || 0)}`;
              },
            },
          },
        },
      },
    });
  }

  function downloadPayslip(payrollId) {
    const user = getCurrentUser();
    if (!user?.id || !payrollId) return;

    window.open(
      `${BASE_URL}/api/payroll/payslip/${payrollId}?requesterId=${user.id}`,
      "_blank",
      "noopener,noreferrer",
    );
  }

  function handleSectionShown(sectionId) {
    if (sectionId !== "salary") return;

    const shell = getSalaryShell();
    if (!shell) return;

    if (shell.dataset.payrollScope === "admin") {
      loadAdminPayrollSection(true);
      return;
    }

    loadEmployeePayrollSection(true);
  }

  window.PayrollUI = {
    bootstrap,
    handleSectionShown,
  };

  document.addEventListener("DOMContentLoaded", bootstrap);
})();
