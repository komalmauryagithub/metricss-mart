let currentUser = null;
let accountsDeals = [];
let accountsStatusChart = null;
let accountsMethodChart = null;
let attendanceUpdating = false;
let attendanceCalendarVisible = false;
let popupTimer = null;
const BASE_URL =
  window.location.protocol === "file:"
    ? "http://localhost:3000"
    : ["localhost", "127.0.0.1"].includes(window.location.hostname)
      ? "http://localhost:3000"
      : window.location.origin;

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

function escapeHtml(value = "") {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatCurrency(value) {
  return `Rs. ${Number(value || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
}

function formatDateValue(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getStatusValue(value) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();
  if (["received", "pending", "failed"].includes(normalized)) return normalized;
  return "pending";
}

function getStatusLabel(value) {
  const status = getStatusValue(value);
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function getDealsFilters() {
  return {
    search: String(document.getElementById("collectionsSearch")?.value || "")
      .trim()
      .toLowerCase(),
    method: String(document.getElementById("collectionsMethodFilter")?.value || "")
      .trim()
      .toLowerCase(),
  };
}

function normalizePaymentMethod(method) {
  const value = String(method || "")
    .replace(/\s+/g, " ")
    .trim();
  return value || "Not specified";
}

function buildPaymentProofUrl(path) {
  const rawValue = String(path || "").trim();
  if (!rawValue) return "";
  if (/^https?:\/\//i.test(rawValue)) return rawValue;
  const cleaned = rawValue.replace(/^\/+/, "");
  return cleaned ? `${BASE_URL}/${cleaned}` : "";
}

function getFilteredDeals() {
  const filters = getDealsFilters();

  return accountsDeals.filter((deal) => {
    const status = getStatusValue(deal.pay_stat);
    if (status !== "received") return false;

    const method = normalizePaymentMethod(deal.payment_method).toLowerCase();
    const haystack = [
      deal.company_name,
      deal.client_name,
      deal.contact,
      deal.email,
      deal.payment_notes,
      method,
    ]
      .join(" ")
      .toLowerCase();

    if (filters.search && !haystack.includes(filters.search)) return false;
    if (filters.method && method !== filters.method) return false;

    return true;
  });
}

function handleDashboardShortcutKey(event, sectionId) {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    showSection(sectionId);
  }
}

function showSection(sectionId, navItem = null) {
  document.querySelectorAll(".section").forEach((section) => {
    section.classList.toggle("active", section.id === sectionId);
  });

  document.querySelectorAll(".sidebar li").forEach((link) => {
    link.classList.remove("active");
  });

  if (navItem) {
    navItem.classList.add("active");
  } else {
    document.querySelectorAll("[data-section-link]").forEach((link) => {
      link.classList.toggle("active", link.dataset.sectionLink === sectionId);
    });
  }

  if (sectionId === "attendance") {
    fetchAttendance();
  }

  if (sectionId === "salary" && window.PayrollUI?.handleSectionShown) {
    window.PayrollUI.handleSectionShown("salary");
  }

  if (sectionId === "leaveManagement" && window.LeaveManagementUI?.refresh) {
    window.LeaveManagementUI.refresh();
  }
}

function showPopup(title, message, isSuccess = true) {
  const popup = document.getElementById("popup");
  const icon = document.getElementById("popupIcon");
  const titleEl = document.getElementById("popupTitle");
  const messageEl = document.getElementById("popupMessage");

  if (!popup || !icon || !titleEl || !messageEl) {
    window.alert(`${title}: ${message}`);
    return;
  }

  titleEl.textContent = title;
  messageEl.textContent = message;
  icon.className = isSuccess ? "fas fa-check-circle" : "fas fa-circle-exclamation";
  popup.classList.remove("hidden");

  clearTimeout(popupTimer);
  popupTimer = setTimeout(() => popup.classList.add("hidden"), 2200);
}

function setHeaderUser(user) {
  document.getElementById("userName").textContent = user?.name || "Accounts";
  const avatar = document.getElementById("userAvatar");
  if (avatar) {
    const profile = String(user?.prof_img || "").trim();
    avatar.src = profile ? `${BASE_URL}/${profile.replace(/^\/+/, "")}` : "logo_.png";
  }
}

function updateMethodFilterOptions() {
  const select = document.getElementById("collectionsMethodFilter");
  if (!select) return;

  const selected = String(select.value || "").trim().toLowerCase();
  const methods = [...new Set(accountsDeals.map((deal) => normalizePaymentMethod(deal.payment_method)))];
  select.innerHTML = `<option value="">All Methods</option>`;

  methods
    .sort((left, right) => left.localeCompare(right))
    .forEach((method) => {
      const option = document.createElement("option");
      option.value = method.toLowerCase();
      option.textContent = method;
      if (method.toLowerCase() === selected) option.selected = true;
      select.appendChild(option);
    });
}

function renderDashboard() {
  const totalDeals = accountsDeals.length;
  const receivedDeals = accountsDeals.filter((deal) => getStatusValue(deal.pay_stat) === "received");
  const pendingDeals = accountsDeals.filter((deal) => getStatusValue(deal.pay_stat) === "pending");
  const failedDeals = accountsDeals.filter((deal) => getStatusValue(deal.pay_stat) === "failed");

  const receivedRevenue = receivedDeals.reduce(
    (sum, deal) => sum + Number(deal.deal_amount || 0),
    0
  );
  const pendingRevenue = pendingDeals.reduce(
    (sum, deal) => sum + Number(deal.deal_amount || 0),
    0
  );
  const collectionRate = totalDeals ? Math.round((receivedDeals.length / totalDeals) * 100) : 0;
  const realizedRevenueRate =
    receivedRevenue + pendingRevenue > 0
      ? Math.round((receivedRevenue / (receivedRevenue + pendingRevenue)) * 100)
      : 0;

  document.getElementById("receivedRevenueMetric").textContent = formatCurrency(receivedRevenue);
  document.getElementById("receivedRevenueHint").textContent = `${receivedDeals.length} deals received`;
  document.getElementById("pendingRevenueMetric").textContent = formatCurrency(pendingRevenue);
  document.getElementById("pendingRevenueHint").textContent = `${pendingDeals.length} deals need follow-up`;
  document.getElementById("invoiceReadyMetric").textContent = String(receivedDeals.length);
  document.getElementById("invoiceReadyHint").textContent = `${receivedDeals.length} tax invoices can go out`;
  document.getElementById("failedPaymentsMetric").textContent = String(failedDeals.length);
  document.getElementById("failedPaymentsHint").textContent = `${failedDeals.length} recovery cases open`;

  document.getElementById("closedDealsCount").textContent = String(totalDeals);
  document.getElementById("receivedDealsCount").textContent = String(receivedDeals.length);
  document.getElementById("pendingDealsCount").textContent = String(pendingDeals.length);
  document.getElementById("failedDealsCount").textContent = String(failedDeals.length);
  document.getElementById("collectionFunnelRate").textContent = `${realizedRevenueRate}% realized revenue`;
  document.getElementById("collectionRateValue").textContent = `${collectionRate}%`;

  renderPriorityCollections(pendingDeals, failedDeals);
  renderStatusChart(receivedDeals.length, pendingDeals.length, failedDeals.length);
  renderMethodChart();
}

function renderPriorityCollections(pendingDeals, failedDeals) {
  const container = document.getElementById("priorityCollectionsList");
  if (!container) return;

  const priorityRows = [...failedDeals, ...pendingDeals]
    .sort((left, right) => {
      const leftDate = new Date(left.payment_date || left.closed_date || left.created_at || 0).getTime();
      const rightDate = new Date(right.payment_date || right.closed_date || right.created_at || 0).getTime();
      return rightDate - leftDate;
    })
    .slice(0, 6);

  if (!priorityRows.length) {
    container.innerHTML = `<p class="empty-state">No pending or failed payments right now.</p>`;
    return;
  }

  container.innerHTML = priorityRows
    .map((deal) => {
      const status = getStatusValue(deal.pay_stat);
      return `
        <div class="insight-item">
          <div>
            <strong>${escapeHtml(deal.company_name || "Untitled Company")}</strong>
            <span>${escapeHtml(deal.client_name || "No client name")} | ${escapeHtml(normalizePaymentMethod(deal.payment_method))}</span>
            <small>${escapeHtml(deal.contact || deal.email || "No contact saved")} | ${formatDateValue(deal.payment_date || deal.closed_date || deal.created_at)}</small>
          </div>
          <div class="insight-amount">
            <b>${formatCurrency(deal.deal_amount || 0)}</b>
            <span class="status-pill ${status}">${getStatusLabel(status)}</span>
          </div>
        </div>
      `;
    })
    .join("");
}

function renderStatusChart(receivedCount, pendingCount, failedCount) {
  const canvas = document.getElementById("accountsStatusChart");
  if (!canvas) return;

  accountsStatusChart?.destroy();
  accountsStatusChart = new Chart(canvas, {
    type: "doughnut",
    data: {
      labels: ["Received", "Pending", "Failed"],
      datasets: [
        {
          data: [receivedCount, pendingCount, failedCount],
          backgroundColor: ["#0f766e", "#d97706", "#dc2626"],
          borderWidth: 0,
          hoverOffset: 10,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "bottom",
        },
      },
    },
  });
}

function renderMethodChart() {
  const canvas = document.getElementById("accountsMethodChart");
  if (!canvas) return;

  const counts = new Map();
  accountsDeals.forEach((deal) => {
    const method = normalizePaymentMethod(deal.payment_method);
    counts.set(method, (counts.get(method) || 0) + 1);
  });

  const labels = [...counts.keys()];
  const data = labels.map((label) => counts.get(label));
  const palette = ["#0369a1", "#0f766e", "#d97706", "#7c3aed", "#ef4444", "#64748b"];

  accountsMethodChart?.destroy();
  accountsMethodChart = new Chart(canvas, {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: "Deals",
          data,
          backgroundColor: labels.map((_, index) => palette[index % palette.length]),
          borderRadius: 10,
          maxBarThickness: 48,
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
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: { precision: 0 },
        },
      },
    },
  });
}

function renderCollectionsMiniKpis(rows) {
  const node = document.getElementById("collectionsMiniKpis");
  if (!node) return;

  const receivedCount = rows.length;
  const visibleAmount = rows.reduce((sum, deal) => sum + Number(deal.deal_amount || 0), 0);
  const proofCount = rows.filter((deal) => buildPaymentProofUrl(deal.payment_proof)).length;

  node.innerHTML = `
    <div class="mini-kpi-card">
      <span>Visible Invoices</span>
      <strong>${rows.length}</strong>
      <small>${formatCurrency(visibleAmount)} in current view</small>
    </div>
    <div class="mini-kpi-card">
      <span>Received</span>
      <strong>${receivedCount}</strong>
      <small>Ready for tax invoice download</small>
    </div>
    <div class="mini-kpi-card">
      <span>Proof Uploaded</span>
      <strong>${proofCount}</strong>
      <small>Payment proof available</small>
    </div>
    <div class="mini-kpi-card">
      <span>Download Ready</span>
      <strong>${rows.length}</strong>
      <small>Invoices ready to download</small>
    </div>
  `;
}

function renderCollectionsTable() {
  const tbody = document.getElementById("collectionsTableBody");
  if (!tbody) return;

  const rows = getFilteredDeals();
  renderCollectionsMiniKpis(rows);

  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="9">No collections match the selected filters</td></tr>`;
    return;
  }

  tbody.innerHTML = rows
    .map((deal) => {
      const status = getStatusValue(deal.pay_stat);
      const proofUrl = buildPaymentProofUrl(deal.payment_proof);
      return `
        <tr>
          <td>
            <div class="client-meta">
              <strong>${escapeHtml(deal.company_name || "-")}</strong>
              <span>Closed: ${formatDateValue(deal.closed_date)}</span>
            </div>
          </td>
          <td>
            <div class="client-meta">
              <strong>${escapeHtml(deal.client_name || "-")}</strong>
              <span>${escapeHtml(deal.contact || "-")}</span>
              <span>${escapeHtml(deal.email || "-")}</span>
            </div>
          </td>
          <td>${formatCurrency(deal.deal_amount || 0)}</td>
          <td>${escapeHtml(normalizePaymentMethod(deal.payment_method))}</td>
          <td class="payment-status-cell">
            <select
              class="status-select ${status}"
              onchange="updatePaymentStatus(${Number(deal.id)}, this.value, this)"
            >
              <option value="pending" ${status === "pending" ? "selected" : ""}>Pending</option>
              <option value="received" ${status === "received" ? "selected" : ""}>Received</option>
              <option value="failed" ${status === "failed" ? "selected" : ""}>Failed</option>
            </select>
          </td>
          <td>${formatDateValue(deal.payment_date)}</td>
          <td>
            ${
              proofUrl
                ? `<a class="proof-link" href="${proofUrl}" target="_blank" rel="noopener noreferrer"><i class="fas fa-paperclip"></i> View</a>`
                : `<span class="proof-link missing">No Proof</span>`
            }
          </td>
          <td>
            <div class="table-note">${escapeHtml(deal.payment_notes || "No payment notes added")}</div>
          </td>
          <td>
            <div class="doc-actions">
              <button type="button" class="doc-btn primary" onclick="downloadProformaInvoice(${Number(deal.id)})">
                <i class="fas fa-file-arrow-down"></i> Proforma
              </button>
              <button
                type="button"
                class="doc-btn secondary"
                onclick="downloadTaxInvoice(${Number(deal.id)})"
                ${status === "received" ? "" : "disabled"}
              >
                <i class="fas fa-file-invoice"></i> Tax
              </button>
            </div>
          </td>
        </tr>
      `;
    })
    .join("");
}

function renderInvoiceCenter() {
  const rows = getFilteredDeals();
  const invoiceTable = document.getElementById("invoiceTableBody");
  const summaryGrid = document.getElementById("invoiceSummaryGrid");
  if (!invoiceTable || !summaryGrid) return;

  renderCollectionsMiniKpis(rows);

  summaryGrid.innerHTML = `
    <div class="mini-kpi-card">
      <span>Tax Invoices Ready</span>
      <strong>${rows.length}</strong>
      <small>All visible rows are payment received</small>
    </div>
    <div class="mini-kpi-card">
      <span>Proforma Ready</span>
      <strong>${rows.length}</strong>
      <small>Can be downloaded anytime</small>
    </div>
    <div class="mini-kpi-card">
      <span>Proof Attached</span>
      <strong>${rows.filter((deal) => buildPaymentProofUrl(deal.payment_proof)).length}</strong>
      <small>Uploaded payment support available</small>
    </div>
    <div class="mini-kpi-card">
      <span>Total Received Amount</span>
      <strong>${formatCurrency(rows.reduce((sum, deal) => sum + Number(deal.deal_amount || 0), 0))}</strong>
      <small>Across the visible invoice list</small>
    </div>
  `;

  if (!rows.length) {
    invoiceTable.innerHTML = `<tr><td colspan="10">No received invoice records match the current filters</td></tr>`;
    return;
  }

  invoiceTable.innerHTML = rows
    .map((deal) => {
      const proofUrl = buildPaymentProofUrl(deal.payment_proof);
      const taxInvoiceActions = `
        <div class="doc-actions">
          <button type="button" class="doc-btn secondary" onclick="downloadTaxInvoice(${Number(deal.id)})">
            <i class="fas fa-file-invoice-dollar"></i> Download
          </button>
        </div>
      `;
      const proformaActions = `
        <div class="doc-actions">
          <button type="button" class="doc-btn primary" onclick="downloadProformaInvoice(${Number(deal.id)})">
            <i class="fas fa-file-arrow-down"></i> Download
          </button>
        </div>
      `;
      return `
        <tr>
          <td>
            <div class="client-meta">
              <strong>${escapeHtml(deal.company_name || "-")}</strong>
              <span>Closed: ${formatDateValue(deal.closed_date)}</span>
            </div>
          </td>
          <td>
            <div class="client-meta">
              <strong>${escapeHtml(deal.client_name || "-")}</strong>
              <span>${escapeHtml(deal.contact || "-")}</span>
              <span>${escapeHtml(deal.email || "-")}</span>
            </div>
          </td>
          <td>${formatCurrency(deal.deal_amount || 0)}</td>
          <td>${escapeHtml(normalizePaymentMethod(deal.payment_method))}</td>
          <td><span class="status-pill received">Received</span></td>
          <td>${formatDateValue(deal.payment_date)}</td>
          <td>${taxInvoiceActions}</td>
          <td>${proformaActions}</td>
          <td>
            ${
              proofUrl
                ? `<a class="proof-link" href="${proofUrl}" target="_blank" rel="noopener noreferrer"><i class="fas fa-paperclip"></i> View</a>`
                : `<span class="proof-link missing">No Proof</span>`
            }
          </td>
          <td>
            <div class="table-note">${escapeHtml(deal.payment_notes || "No payment notes added")}</div>
          </td>
        </tr>
      `;
    })
    .join("");
}

async function loadAccountsDealsData() {
  const response = await fetch(`${BASE_URL}/api/deals?role=admin`, {
    cache: "no-store",
  });
  const result = await response.json();

  if (!response.ok || result.success === false) {
    throw new Error(result.message || "Failed to load deals");
  }

  accountsDeals = Array.isArray(result.data) ? result.data : [];
  updateMethodFilterOptions();
  renderDashboard();
  renderInvoiceCenter();
}

async function refreshAccountsPanel() {
  try {
    await loadAccountsDealsData();
    if (document.getElementById("attendance")?.classList.contains("active")) {
      await fetchAttendance();
    }
    showPopup("Accounts", "ACC dashboard refreshed", true);
  } catch (error) {
    console.error("Accounts refresh error:", error);
    showPopup("Accounts", error.message || "Failed to refresh ACC dashboard", false);
  }
}

async function updatePaymentStatus(leadId, status, selectEl) {
  try {
    const response = await fetch(`${BASE_URL}/api/payment-status/${leadId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ pay_stat: status }),
    });
    const result = await response.json();

    if (!response.ok || result.success === false) {
      throw new Error(result.message || "Payment status update failed");
    }

    selectEl.classList.remove("pending", "received", "failed");
    selectEl.classList.add(status);
    await loadAccountsDealsData();
    showPopup("Payment Desk", "Payment status updated", true);
  } catch (error) {
    console.error("Payment status update error:", error);
    showPopup("Payment Desk", error.message || "Payment status update failed", false);
  }
}

function downloadTaxInvoice(id) {
  window.open(`${BASE_URL}/api/tax-invoice/${id}`, "_blank");
}

function downloadProformaInvoice(id) {
  window.open(`${BASE_URL}/api/invoice/${id}`, "_blank");
}

async function sharePdfFile(url, fileName, shareTitle) {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error("Failed to fetch invoice PDF");
  }

  const blob = await response.blob();
  const file = new File([blob], fileName, {
    type: "application/pdf",
  });

  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    await navigator.share({
      title: shareTitle,
      files: [file],
    });
    return;
  }

  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(objectUrl), 1500);

  throw new Error(
    "Is browser me direct PDF share support nahi hai. PDF download ho gaya hai, usi file ko WhatsApp se share karo."
  );
}

async function sendInvoiceEmailAttachment(invoiceType, leadId, email) {
  const response = await fetch(`${BASE_URL}/api/invoices/send-email`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      leadId,
      invoiceType,
      toEmail: email,
    }),
  });

  const result = await response.json().catch(() => ({}));

  if (!response.ok || result.success === false) {
    if (response.status === 503) {
      throw new Error(
        result.message ||
          "Server SMTP setup missing hai. PDF email direct bhejne ke liye mail settings configure karni hongi."
      );
    }
    throw new Error(result.message || "Invoice email send failed");
  }

  return result;
}

async function shareProformaInvoiceWhatsApp(id, phone) {
  if (!phone) {
    showPopup("Invoice Center", "Contact number not available", false);
    return;
  }

  try {
    await sharePdfFile(
      `${BASE_URL}/api/invoice/${id}`,
      `proforma_invoice_${id}.pdf`,
      "Proforma Invoice"
    );
    showPopup("Invoice Center", "Proforma invoice PDF ready to share", true);
  } catch (error) {
    console.error("Proforma WhatsApp share error:", error);
    showPopup("Invoice Center", error.message || "Failed to share proforma invoice PDF", false);
  }
}

async function shareTaxInvoiceWhatsApp(id, phone) {
  if (!phone) {
    showPopup("Invoice Center", "Contact number not available", false);
    return;
  }

  try {
    await sharePdfFile(
      `${BASE_URL}/api/tax-invoice/${id}`,
      `tax_invoice_${id}.pdf`,
      "Tax Invoice"
    );
    showPopup("Invoice Center", "Tax invoice PDF ready to share", true);
  } catch (error) {
    console.error("Tax WhatsApp share error:", error);
    showPopup("Invoice Center", error.message || "Failed to share tax invoice PDF", false);
  }
}

async function shareProformaInvoiceGmail(email, id) {
  if (!email) {
    showPopup("Invoice Center", "Email not available", false);
    return;
  }

  try {
    const result = await sendInvoiceEmailAttachment("proforma", id, email);
    showPopup("Invoice Center", result.message || "Proforma invoice emailed successfully", true);
  } catch (error) {
    console.error("Proforma email share error:", error);
    showPopup("Invoice Center", error.message || "Failed to email proforma invoice PDF", false);
  }
}

async function shareTaxInvoiceGmail(email, id) {
  if (!email) {
    showPopup("Invoice Center", "Email not available", false);
    return;
  }

  try {
    const result = await sendInvoiceEmailAttachment("tax", id, email);
    showPopup("Invoice Center", result.message || "Tax invoice emailed successfully", true);
  } catch (error) {
    console.error("Tax email share error:", error);
    showPopup("Invoice Center", error.message || "Failed to email tax invoice PDF", false);
  }
}

function bindCollectionFilters() {
  const rerender = () => {
    renderInvoiceCenter();
  };

  document.getElementById("collectionsSearch")?.addEventListener("input", rerender);
  document.getElementById("collectionsMethodFilter")?.addEventListener("change", rerender);
}

async function fetchAttendance() {
  if (!currentUser || !currentUser.id) return;

  const tbody = document.getElementById("attendanceTableBody");
  const actions = document.getElementById("attendanceActions");
  if (!tbody) return;

  try {
    const response = await fetch(`${BASE_URL}/api/attendance/${currentUser.id}`, {
      cache: "no-store",
    });
    const result = await response.json();
    const rows = result.success ? result.data || [] : [];
    const today = formatDateKey(new Date());
    const todayRow = rows.find((row) => row.attendance_date === today);
    const canCheckIn = !todayRow;
    const canCheckOut = todayRow && !todayRow.check_out;

    if (actions) {
      actions.innerHTML = `
        <button type="button" class="view-btn attendance-calendar-btn" onclick="toggleAttendanceCalendar()">Calendar</button>
        <button type="button" class="view-btn attendance-btn" onclick="markAttendance('check-in')" ${canCheckIn && !attendanceUpdating ? "" : "disabled"}>Check In</button>
        <button type="button" class="view-btn attendance-out-btn attendance-btn" onclick="markAttendance('check-out')" ${canCheckOut && !attendanceUpdating ? "" : "disabled"}>Check Out</button>
      `;
    }

    let calendar = document.getElementById("attendanceCalendar");
    if (!calendar && actions) {
      calendar = document.createElement("div");
      calendar.id = "attendanceCalendar";
      actions.insertAdjacentElement("afterend", calendar);
    }
    if (calendar) {
      calendar.className = attendanceCalendarVisible ? "" : "hidden";
      calendar.innerHTML = renderAttendanceCalendar(rows);
    }

    if (!rows.length) {
      tbody.innerHTML = `<tr><td colspan="6">No attendance records found</td></tr>`;
      renderAttendanceSummarySection(tbody, []);
      return;
    }

    tbody.innerHTML = rows
      .map((row) => {
        const checkInLocation = formatCheckInLocation(row);
        const attendanceStatus = formatAttendanceStatus(row);
        const displayedCheckOut = getAttendanceCheckoutDisplay(row);
        return `
          <tr>
            <td>${row.attendance_date || "-"}</td>
            <td>${row.check_in || "-"}</td>
            <td>${displayedCheckOut}</td>
            <td>${checkInLocation}</td>
            <td>${row.working_hours || "00:00"}</td>
            <td>${attendanceStatus}</td>
          </tr>
        `;
      })
      .join("");

    renderAttendanceSummarySection(tbody, rows);
    filterAttendanceTable();
  } catch (error) {
    console.error("Attendance load error:", error);
    tbody.innerHTML = `<tr><td colspan="6">Error loading attendance</td></tr>`;
    renderAttendanceSummarySection(tbody, []);
  }
}

async function markAttendance(type) {
  if (!currentUser?.id || attendanceUpdating) return;

  const url =
    type === "check-in"
      ? `${BASE_URL}/api/attendance/check-in`
      : `${BASE_URL}/api/attendance/check-out`;
  const method = type === "check-in" ? "POST" : "PUT";

  try {
    attendanceUpdating = true;
    setAttendanceButtonsDisabled(true);
    if (!window.AttendanceFace?.captureForAttendance) {
      throw new Error("Face verification module load nahi hua. Page refresh karke retry karo.");
    }
    const facePayload = await window.AttendanceFace.captureForAttendance({
      actionLabel: type === "check-in" ? "Verify Check In" : "Verify Check Out",
    });
    const location = await getCurrentLocation();
    const response = await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ userId: currentUser.id, ...location, ...facePayload }),
    });
    const result = await response.json();

    if (!response.ok || result.success === false) {
      throw new Error(result.error || result.message || "Attendance update failed");
    }

    showPopup("Attendance", result.message || "Attendance updated", true);
    attendanceUpdating = false;
    await fetchAttendance();
  } catch (error) {
    console.error("Attendance update error:", error);
    showPopup("Attendance", error.message || "Attendance update failed", false);
  } finally {
    if (attendanceUpdating) {
      attendanceUpdating = false;
      setAttendanceButtonsDisabled(false);
    }
  }
}

function setAttendanceButtonsDisabled(disabled) {
  document
    .querySelectorAll(".attendance-btn")
    .forEach((button) => (button.disabled = disabled));
}

function getCurrentLocation() {
  return new Promise((resolve, reject) => {
    if (!window.isSecureContext) {
      reject(new Error("Location ke liye page localhost ya HTTPS par open karo."));
      return;
    }

    if (!navigator.geolocation) {
      reject(new Error("Is browser me location support nahi hai."));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy,
        });
      },
      (error) => {
        const message =
          error.code === error.PERMISSION_DENIED
            ? "Location permission allow karo, tabhi attendance save hogi."
            : error.code === error.TIMEOUT
              ? "Location fetch timeout ho gaya. GPS/location on karke retry karo."
              : "Location fetch nahi ho paya. GPS/location on karke retry karo.";
        reject(new Error(message));
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  });
}

function getAttendanceCheckoutDisplay(row) {
  if (row?.check_out) return row.check_out;
  if (row?.check_in && row?.logout_time) return row.logout_time;
  return "-";
}

function formatCheckInLocation(row) {
  const locationUrl = row.check_in_location;

  if (locationUrl) {
    return `<a href="${locationUrl}" target="_blank" rel="noopener noreferrer">View Location</a>`;
  }

  if (row.check_in_lat && row.check_in_lng) {
    const url = `https://www.google.com/maps?q=${row.check_in_lat},${row.check_in_lng}`;
    return `<a href="${url}" target="_blank" rel="noopener noreferrer">View Location</a>`;
  }

  return "-";
}

function formatAttendanceStatus(row) {
  const statusMeta = getAttendanceStatusMeta(row.status);

  if (!row.check_in && statusMeta.className !== "absent") return "-";

  return `<span class="attendance-status ${statusMeta.className}">${statusMeta.label}</span>`;
}

function toggleAttendanceCalendar() {
  attendanceCalendarVisible = !attendanceCalendarVisible;
  const calendar = document.getElementById("attendanceCalendar");
  if (calendar) calendar.classList.toggle("hidden", !attendanceCalendarVisible);
}

function normalizeAttendanceStatus(status) {
  return String(status || "")
    .toLowerCase()
    .trim()
    .replace(/[\s-]+/g, "_");
}

function getAttendanceStatusMeta(status) {
  const normalizedStatus = normalizeAttendanceStatus(status);

  switch (normalizedStatus) {
    case "absent":
      return { label: "Absent", className: "absent" };
    case "late":
      return { label: "Late", className: "late" };
    case "grace":
      return { label: "Grace", className: "grace" };
    case "half_day":
      return { label: "Half Day", className: "half-day" };
    case "checkout_pending":
      return { label: "Pending Checkout", className: "checkout-pending" };
    default:
      return { label: "Present", className: "present" };
  }
}

function renderAttendanceCalendar(rows) {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  const firstDay = new Date(year, month, 1);
  const totalDays = new Date(year, month + 1, 0).getDate();
  const attendanceByDate = new Map(rows.map((row) => [row.attendance_date, row]));
  const monthName = today.toLocaleString("en-US", { month: "long", year: "numeric" });
  const dayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  let cells = "";

  for (let i = 0; i < firstDay.getDay(); i += 1) {
    cells += `<div class="attendance-day empty"></div>`;
  }

  for (let day = 1; day <= totalDays; day += 1) {
    const date = new Date(year, month, day);
    const dateKey = formatDateKey(date);
    const row = attendanceByDate.get(dateKey);
    const isPast = dateKey < formatDateKey(today);
    const isToday = dateKey === formatDateKey(today);
    let status = "pending";
    let label = isToday ? "Today" : "";

    if (row?.status === "absent") {
      status = "absent";
      label = "Absent";
    } else if (row?.check_in) {
      const statusMeta = getAttendanceStatusMeta(row.status);
      status = statusMeta.className;
      label = statusMeta.label;
    } else if (isPast) {
      status = "absent";
      label = "Absent";
    }

    cells += `
      <div class="attendance-day ${status}">
        <strong>${day}</strong>
        <span>${label}</span>
      </div>
    `;
  }

  return `
    <div class="attendance-calendar-card">
      <div class="attendance-calendar-title">${monthName}</div>
      <div class="attendance-calendar-weekdays">
        ${dayLabels.map((day) => `<span>${day}</span>`).join("")}
      </div>
      <div class="attendance-calendar-grid">${cells}</div>
      <div class="attendance-calendar-legend">
        <span><i class="present"></i> Present</span>
        <span><i class="grace"></i> Grace</span>
        <span><i class="late"></i> Late</span>
        <span><i class="half-day"></i> Half Day</span>
        <span><i class="checkout-pending"></i> Pending</span>
        <span><i class="absent"></i> Absent</span>
      </div>
    </div>
  `;
}

function buildAttendanceSummary(rows) {
  const summary = {
    present: 0,
    grace: 0,
    late: 0,
    halfDay: 0,
    absent: 0,
    checkoutPending: 0,
  };

  rows.forEach((row) => {
    const normalizedStatus = normalizeAttendanceStatus(row.status);

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
    } else if (row.check_in) {
      summary.present += 1;
    }
  });

  summary.lateLeaveEquivalent = Math.floor(summary.late / 3);
  summary.lateBalance = summary.late % 3;

  return summary;
}

function renderAttendanceSummary(rows) {
  const summary = buildAttendanceSummary(rows);

  return `
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

function renderAttendanceSummarySection(tbody, rows) {
  const table = tbody?.closest("table");
  if (!table) return;

  let summary = document.getElementById("attendanceSummary");
  if (!summary) {
    summary = document.createElement("div");
    summary.id = "attendanceSummary";
    table.insertAdjacentElement("afterend", summary);
  }

  summary.innerHTML = renderAttendanceSummary(rows);
}

function filterAttendanceTable() {
  const query = String(document.getElementById("attendanceSearch")?.value || "")
    .trim()
    .toLowerCase();

  document.querySelectorAll("#attendanceTableBody tr").forEach((row) => {
    row.style.display = row.textContent.toLowerCase().includes(query) ? "" : "none";
  });
}

function logout() {
  showPopup("Logout", "You have been logged out successfully.", true);

  Promise.resolve(window.AttendanceAutoCheckout?.finalizeOnLogout?.())
    .catch(() => null)
    .finally(() => {
      setTimeout(() => {
        localStorage.removeItem("currentUser");
        window.location.replace("mp.html");
      }, 800);
    });
}

async function initializeAccountsPanel() {
  currentUser = getCurrentUser();

  if (!currentUser) {
    window.location.replace("mp.html");
    return;
  }

  const role = normalizeRole(currentUser.role);
  if (!["accounts", "admin"].includes(role)) {
    window.location.replace(getRedirectPage(role));
    return;
  }

  setHeaderUser(currentUser);
  bindCollectionFilters();

  try {
    await loadAccountsDealsData();
  } catch (error) {
    console.error("Accounts init error:", error);
    showPopup("Accounts", error.message || "Failed to load ACC panel", false);
  }
}

document.addEventListener("DOMContentLoaded", initializeAccountsPanel);

window.showSection = showSection;
window.refreshAccountsPanel = refreshAccountsPanel;
window.loadAccountsDeals = async function loadAccountsDealsSafe() {
  try {
    await loadAccountsDealsData();
    showPopup("Invoice Center", "Payment data refreshed", true);
  } catch (error) {
    console.error("Invoice refresh error:", error);
    showPopup("Invoice Center", error.message || "Failed to refresh payment data", false);
  }
};
window.renderInvoiceCenter = renderInvoiceCenter;
window.updatePaymentStatus = updatePaymentStatus;
window.downloadTaxInvoice = downloadTaxInvoice;
window.downloadProformaInvoice = downloadProformaInvoice;
window.handleDashboardShortcutKey = handleDashboardShortcutKey;
window.toggleAttendanceCalendar = toggleAttendanceCalendar;
window.markAttendance = markAttendance;
window.filterAttendanceTable = filterAttendanceTable;
window.logout = logout;
