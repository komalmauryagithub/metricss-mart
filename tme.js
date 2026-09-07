let currentUser = null;
let reportChart = null;
let dashboardChart = null;
let targetProgressChart = null;
let appointmentStatusChart = null;
let editingLeadId = null;
let popupTimer = null;
let attendanceUpdating = false;
let attendanceCalendarVisible = false;
const MONTHLY_TARGET = 200000;
const FIXED_SALES_COMMISSION_PERCENT = 10;
let currentMonthlyTarget = MONTHLY_TARGET;
let dealCloseLeadId = null;
let dealCloseSubmitting = false;
let tmeUnassignedLeads = [];
let tmeDealProductsCatalog = null;
let dealCloseDownsaleRequests = [];
let dealCloseApprovedDownsaleRequest = null;
let dealCloseAppliedUpsaleAmount = 0;
let dealCloseDownsaleApiAvailable = true;
let dealCloseDownsalePollingTimer = null;
let tmeDealClosePartPaymentData = null;
let tmeDealInstallmentsSchedule = [];
let tmeDealPartPaymentRemaining = 0;
let currentTmeDealClosePayload = null;
let currentTmeDealCloseProducts = [];
let currentTmeDealPaymentsLeadId = null;
let currentTmeDealPaymentsData = null;
let renewalLeadAttribution = null;
let activeTmeAppointmentActionLeadId = null;
let tmeAppointmentMode = "appointment";
const tmeDashboardState = {
  counts: {
    deals: 0,
  },
  deals: [],
  appointmentsHistory: [],
  appointmentSummary: {
    totalGenerated: 0,
    confirmed: 0,
    notConfirmed: 0,
    notInterested: 0,
  },
  salesMix: {
    newSaleCount: 0,
    renewalCount: 0,
    newSaleAmount: 0,
    renewalAmount: 0,
  },
};

const BASE_URL =
  window.location.protocol === "file:"
    ? "http://localhost:3000"
    : ["localhost", "127.0.0.1"].includes(window.location.hostname)
      ? "http://localhost:3000"
      : window.location.origin;

function getTmeUploadedFileUrl(filePath) {
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
  if (!currentUser.role) currentUser.role = "tme";
  return userId;
}

function getEmptyTrackerCounts() {
  return {
    total: 0,
    assigned: 0,
    ongoing: 0,
    completed: 0,
    unassigned: 0,
  };
}

// 🔥 Live Search Filter Function
function filterTable(tableId, searchInputId) {
  const searchInput = document
    .getElementById(searchInputId)
    .value.toLowerCase();
  const tableRows = document.querySelectorAll(`#${tableId} tr`);
  tableRows.forEach((row) => {
    const rowText = row.textContent.toLowerCase();
    if (rowText.includes(searchInput)) {
      row.style.display = "";
    } else {
      row.style.display = "none";
    }
  });
}

window.onload = function () {
  loadUserFromLocalStorage();
  fetchUserDataFromDB();
  loadTmeDashboard();
  loadLeads();
  loadReportsCounts();
};

// controllers/tmeDealsController.js

function getRenewalButtonMeta(deal = {}) {
  const renewalCount = Number(deal.renewal_count || deal.has_renewal || 0);
  const closedRenewalCount = Number(deal.renewal_closed_count || 0);

  if (closedRenewalCount > 0) {
    return {
      className: "is-renewed",
      iconClass: "fas fa-check-circle",
      label: "Renewed",
      title: "Renewal deal closed for this client",
    };
  }

  if (renewalCount > 0) {
    return {
      className: "is-started",
      iconClass: "fas fa-clock",
      label: "Renewal Started",
      title: "Renewal lead already created",
    };
  }

  return {
    className: "",
    iconClass: "fas fa-rotate",
    label: "Renewal",
    title: "Create renewal from this deal",
  };
}

function getDealSalesTypeValue(deal = {}, monthKey = "") {
  const raw = String(deal.sales_type || deal.salesType || "")
    .toLowerCase()
    .trim();

  if (monthKey) {
    const dStr = deal.closed_date || deal.payment_date || deal.created_at;
    let closedMonth = "";
    if (dStr) {
      const dStrTrim = String(dStr).trim();
      if (/^\d{4}-\d{2}/.test(dStrTrim)) {
        closedMonth = dStrTrim.slice(0, 7);
      } else {
        const date = new Date(dStr);
        if (!isNaN(date.getTime())) {
          const yyyy = date.getFullYear();
          const mm = String(date.getMonth() + 1).padStart(2, '0');
          closedMonth = `${yyyy}-${mm}`;
        }
      }
    }

    if (Array.isArray(deal.payments)) {
      const hasRenewalInMonth = deal.payments.some((p) => {
        const isRenewal = String(p.payment_type || "").toLowerCase() === "renewal";
        if (!isRenewal) return false;
        const pDate = p.payment_date || p.renewal_cycle_start_date || p.created_at;
        if (!pDate) return false;
        const pStr = String(pDate).trim();
        let pMonth = "";
        if (/^\d{4}-\d{2}/.test(pStr)) {
          pMonth = pStr.slice(0, 7);
        } else {
          const date = new Date(pStr);
          if (!isNaN(date.getTime())) {
            const yyyy = date.getFullYear();
            const mm = String(date.getMonth() + 1).padStart(2, '0');
            pMonth = `${yyyy}-${mm}`;
          }
        }
        return pMonth === monthKey;
      });

      if (hasRenewalInMonth) {
        return "renewal";
      }
    }

    if (closedMonth && monthKey === closedMonth) {
      return "fresh";
    }

    return "";
  }

  if (raw === "renewal" || deal.renewal_source_lead_id) {
    return "renewal";
  }
  return "fresh";
}

function formatTmeDealClosedAndRenewalCell(deal = {}, monthKey = "") {
  const closedDateStr = deal.closed_date || deal.payment_date || deal.created_at;
  const closedFormatted = closedDateStr ? formatTmeDisplayDate(closedDateStr) : "-";

  let renewalDateStr = "";
  if (Array.isArray(deal.payments)) {
    const renewalPayment = deal.payments.find((p) => {
      const isRenewal = String(p.payment_type || "").toLowerCase() === "renewal";
      if (!isRenewal) return false;
      const pDate = p.payment_date || p.renewal_cycle_start_date || p.created_at;
      if (!pDate) return false;
      if (!monthKey) return true;
      const pStr = String(pDate).trim();
      let pMonth = "";
      if (/^\d{4}-\d{2}/.test(pStr)) {
        pMonth = pStr.slice(0, 7);
      } else {
        const date = new Date(pStr);
        if (!isNaN(date.getTime())) {
          const yyyy = date.getFullYear();
          const mm = String(date.getMonth() + 1).padStart(2, '0');
          pMonth = `${yyyy}-${mm}`;
        }
      }
      return pMonth === monthKey;
    });

    if (renewalPayment) {
      renewalDateStr = renewalPayment.payment_date || renewalPayment.renewal_cycle_start_date || renewalPayment.created_at || "";
    }
  }

  if (renewalDateStr) {
    const renewalFormatted = formatTmeDisplayDate(renewalDateStr);
    return `<div>${escapeTmeHtml(closedFormatted)}</div><div style="font-size: 11px; color: #059669; font-weight: 600; white-space: nowrap; margin-top: 2px;">Renewal: ${escapeTmeHtml(renewalFormatted)}</div>`;
  }

  return escapeTmeHtml(closedFormatted);
}


function formatDealSalesTypeLabel(deal = {}, monthKey = "") {
  return getDealSalesTypeValue(deal, monthKey) === "renewal" ? "Renewal" : "Fresh";
}

function dealMatchesSelectedType(deal = {}, selectedType = "all", monthKey = "") {
  if (!selectedType || selectedType === "all") return true;
  return getDealSalesTypeValue(deal, monthKey) === selectedType;
}

function getTmeMonthKeyFromDate(value) {
  if (!value) return "";
  const raw = String(value).trim();
  if (/^\d{4}-\d{2}/.test(raw)) return raw.slice(0, 7);
  const date = new Date(raw);
  if (isNaN(date.getTime())) return "";
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  return `${yyyy}-${mm}`;
}

function getTmePaymentActivityMonth(payment = {}) {
  return getTmeMonthKeyFromDate(
    payment.payment_date ||
      payment.renewal_cycle_start_date ||
      payment.created_at,
  );
}

function getTmeReceivedRenewalPayments(deal = {}, monthKey = "") {
  if (!Array.isArray(deal.payments)) return [];
  return deal.payments.filter((payment) => {
    const isRenewal =
      String(payment.payment_type || "").toLowerCase().trim() === "renewal";
    if (!isRenewal) return false;

    const status = String(payment.payment_status || "received")
      .toLowerCase()
      .trim();
    if (status && status !== "received") return false;

    if (!monthKey) return true;
    return getTmePaymentActivityMonth(payment) === monthKey;
  });
}

function getDealClosedMonthKey(deal = {}) {
  return getTmeMonthKeyFromDate(
    deal.closed_date || deal.payment_date || deal.created_at,
  );
}

function getDealDashboardReceivedAmount(deal = {}, monthKey = "") {
  const baseAmount =
    !monthKey || getDealClosedMonthKey(deal) === monthKey
      ? getDealReceivedAmount(deal)
      : 0;
  const renewalAmount = getTmeReceivedRenewalPayments(deal, monthKey).reduce(
    (sum, payment) => sum + normalizeDashboardNumber(payment.amount),
    0,
  );
  return baseAmount + renewalAmount;
}

function getDealDashboardContractAmount(deal = {}, monthKey = "") {
  return !monthKey || getDealClosedMonthKey(deal) === monthKey
    ? getDealContractAmount(deal)
    : 0;
}

function getDealDashboardPaidWithoutGst(deal = {}, monthKey = "") {
  const received = getDealDashboardReceivedAmount(deal, monthKey);
  return received > 0 ? Math.round((received / 1.18) * 100) / 100 : 0;
}

function getDealReceivedAmount(deal = {}) {
  const explicitValues = [
    deal.received_amount,
    deal.down_payment,
    deal.amount_received,
    deal.payment_amount,
    deal.received_total,
  ];
  const explicitValue = explicitValues.find(hasTmeStoredAmount);
  const explicitAmount = Number(explicitValue || 0);

  const isMarkedReceived =
    String(deal.pay_stat || "").toLowerCase().trim() === "received";

  if (
    explicitValue !== undefined &&
    Number.isFinite(explicitAmount) &&
    (explicitAmount > 0 || !isMarkedReceived)
  ) {
    return explicitAmount;
  }

  return isMarkedReceived ? Number(deal.deal_amount || 0) : 0;
}

function getDealRemainingAmount(deal = {}) {
  const storedRemaining = Number(deal.remaining_amount);
  if (Number.isFinite(storedRemaining) && storedRemaining >= 0) {
    return storedRemaining;
  }

  return Math.max(Number(deal.deal_amount || 0) - getDealReceivedAmount(deal), 0);
}

function getDealContractAmount(deal = {}) {
  return Number(deal.deal_amount || 0);
}

function getDealPaidWithoutGst(deal = {}) {
  const received = getDealReceivedAmount(deal);
  return received > 0 ? Math.round((received / 1.18) * 100) / 100 : 0;
}

function normalizeTmeDealPayStatus(value) {
  const status = String(value || "")
    .toLowerCase()
    .trim();
  return ["pending", "received", "failed"].includes(status) ? status : "pending";
}

function hasTmeStoredAmount(value) {
  return value !== undefined && value !== null && String(value).trim() !== "";
}

function roundTmePaymentAmount(value) {
  const amount = Number(String(value ?? "").replace(/,/g, ""));
  if (!Number.isFinite(amount)) return 0;
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}

function getTmePaymentGstBreakup(amount) {
  const grossAmount = roundTmePaymentAmount(amount);
  if (grossAmount <= 0) {
    return {
      amountWithoutGst: 0,
      gstAmount: 0,
    };
  }

  const amountWithoutGst = roundTmePaymentAmount(grossAmount / 1.18);
  return {
    amountWithoutGst,
    gstAmount: roundTmePaymentAmount(Math.max(grossAmount - amountWithoutGst, 0)),
  };
}

function formatTmePaymentMoney(value) {
  return `Rs. ${roundTmePaymentAmount(value).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function escapeTmeInlineJsString(value) {
  return String(value ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\\'")
    .replace(/\r?\n/g, " ");
}

function getTmeInvoiceUrl(path, id, paymentId = 0, instAmt = 0) {
  const url = new URL(`${BASE_URL}/api/${path}/${id}`);
  if (paymentId) url.searchParams.set("paymentId", String(paymentId));
  if (instAmt) url.searchParams.set("instAmt", String(instAmt));
  return url.toString();
}

function downloadTmeTaxInvoice(id, paymentId = 0, instAmt = 0) {
  window.open(getTmeInvoiceUrl("tax-invoice", id, paymentId, instAmt), "_blank");
}

function downloadTmeProformaInvoice(id, paymentId = 0, instAmt = 0) {
  window.open(getTmeInvoiceUrl("invoice", id, paymentId, instAmt), "_blank");
}

function formatTmeLastEdit(value) {
  return value ? formatTmeDisplayDate(value) : "-";
}

function isDealMatchingMonth(deal, monthKey) {
  if (!monthKey) return true;
  if (!deal) return false;
  return Boolean(getDealSalesTypeValue(deal, monthKey));
}
async function loadDeals() {
  const tbody = document.getElementById("dealsTableBody");
  const noData = document.getElementById("noDeals");

  try {
    if (!currentUser?.id) return;

    const url = `${BASE_URL}/api/deals?userId=${currentUser.id}&userName=${encodeURIComponent(currentUser.name)}&role=${currentUser.role}`;

    const res = await fetch(url);
    const result = await res.json();

    const selectedType =
      document.getElementById("dealsTypeFilterTME")?.value || "all";
    const selectedMonth =
      document.getElementById("dealsMonthFilterTME")?.value;
    const allDeals = Array.isArray(result.data) ? result.data : [];
    let deals = allDeals.filter(
      (deal) => dealMatchesSelectedType(deal, selectedType, selectedMonth),
    );

    if (selectedMonth) {
      deals = deals.filter(deal => isDealMatchingMonth(deal, selectedMonth));
    }

    // No deals at all
    if (!result.success || allDeals.length === 0) {
      tbody.innerHTML = "";
      noData.classList.remove("hidden");
      noData.textContent = "No Deals Found";
      return;
    }

    // Deals exist but none match the active filter
    if (deals.length === 0) {
      tbody.innerHTML = "";
      noData.classList.remove("hidden");
      const filterLabel = selectedType === "renewal" ? "Renewal" : selectedType === "fresh" ? "Fresh" : "";
      noData.textContent = `No ${filterLabel} Deals Found`;
      return;
    }

    noData.classList.add("hidden");
    tbody.innerHTML = "";


    deals.forEach((d) => {
      const lastEdit = d.updated_at || d.updatedAt || d.last_edit_at || d.lastEditAt || d.closed_date;
      const dealId = Number(d.id || 0);
      const paymentAction = `
        <button
          type="button"
          class="tme-deal-payment-btn"
          onclick="openTmeDealPaymentsModal(event, ${dealId})"
          title="View and add installment payments"
        >
          <i class="fas fa-receipt"></i> Payments
        </button>
      `;
      const ackAction = `<button type="button" class="tme-deal-payment-btn"
            onclick="event.stopPropagation(); openTmeDealAckViewModal(${dealId})"
            title="View acknowledgement proforma"
          ><i class="fas fa-file-alt"></i> View Ack</button>`;
      const row = `
        <tr
          class="tme-clickable-deal-row"
          style="cursor: pointer;"
          onclick="openTmeDealDetailsFromRow(event, ${dealId})"
          title="Click to view full lead details"
        >
          <td><strong>${escapeTmeHtml(d.company_name || "-")}</strong></td>
          <td>${escapeTmeHtml(d.client_name || "-")}</td>
          <td>${escapeTmeHtml(formatDashboardMoney(d.deal_amount))}</td>
          <td>${escapeTmeHtml(formatDashboardMoney(getDealReceivedAmount(d)))}</td>
          <td>${escapeTmeHtml(formatDashboardMoney(getDealRemainingAmount(d)))}</td>
          <td>${escapeTmeHtml(formatDashboardMoney(d.gst_amount))}</td>
          <td>${escapeTmeHtml(formatDealSalesTypeLabel(d, selectedMonth))}</td>
          <td>${escapeTmeHtml(d.payment_method || "-")}</td>
          <td>${formatTmeDealClosedAndRenewalCell(d, selectedMonth)}</td>
          <td><span class="status-badge deal">Deal Closed</span></td>
          <td>${paymentAction}</td>
          <td>${ackAction}</td>
          <td>${escapeTmeHtml(formatTmeLastEdit(lastEdit))}</td>
        </tr>
      `;
      tbody.innerHTML += row;
    });
  } catch (err) {
    console.error("Deals load error:", err);
  }
}

function handleTmeDealPaymentsBackdrop(event) {
  if (event.target?.id === "tmeDealPaymentsModal") {
    closeTmeDealPaymentsModal();
  }
}

function closeTmeDealPaymentsModal() {
  document.activeElement?.blur();
  document.getElementById("tmeDealPaymentsModal")?.classList.add("hidden");
  currentTmeDealPaymentsLeadId = null;
  currentTmeDealPaymentsData = null;
}

function setTmeDealPaymentDefaultDate() {
  const dateInput = document.getElementById("tmeDealPaymentDate");
  if (dateInput && !dateInput.value) {
    dateInput.value = getTodayForInput();
  }
  updateTmeDealPaymentBreakupPreview();
}

function updateTmeDealPaymentBreakupPreview() {
  const amountInput = document.getElementById("tmeDealPaymentAmount");
  const withoutGstInput = document.getElementById("tmeDealPaymentWithoutGst");
  const gstInput = document.getElementById("tmeDealPaymentGstAmount");
  if (!withoutGstInput && !gstInput) return;

  const rawAmount = String(amountInput?.value || "").trim();
  const breakup = getTmePaymentGstBreakup(rawAmount);
  const hasAmount = rawAmount !== "" && roundTmePaymentAmount(rawAmount) > 0;

  if (withoutGstInput) {
    withoutGstInput.value = hasAmount ? formatTmePaymentMoney(breakup.amountWithoutGst) : "";
  }

  if (gstInput) {
    gstInput.value = hasAmount ? formatTmePaymentMoney(breakup.gstAmount) : "";
  }
}

function getTmeDealPaymentRenewalOptions() {
  const rawOptions =
    currentTmeDealPaymentsData?.renewalOptions ||
    currentTmeDealPaymentsData?.renewal_options ||
    [];
  return Array.isArray(rawOptions)
    ? rawOptions.filter((option) => Number(option.renewal_id || option.id || 0) > 0)
    : [];
}

function findTmeDealPaymentRenewalOption(renewalId) {
  const normalizedId = Number(renewalId || 0);
  return getTmeDealPaymentRenewalOptions().find(
    (option) => Number(option.renewal_id || option.id || 0) === normalizedId,
  ) || null;
}

function renderTmeDealPaymentRenewalOptions() {
  const select = document.getElementById("tmeDealRenewalPaymentService");
  if (!select) return;

  const previousValue = select.value;
  const options = getTmeDealPaymentRenewalOptions();
  select.innerHTML = "";

  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = options.length
    ? "Select renewal service"
    : "No renewal services configured";
  select.appendChild(placeholder);

  options.forEach((option) => {
    const renewalId = Number(option.renewal_id || option.id || 0);
    const amount = roundTmePaymentAmount(option.service_amount || option.amount || 0);
    const dueDate = option.renewal_due_date
      ? ` | Due ${formatTmeDisplayDate(option.renewal_due_date)}`
      : "";
    const optionEl = document.createElement("option");
    optionEl.value = String(renewalId);
    optionEl.textContent = `${option.service_name || "Service"} | ${formatDashboardMoney(amount)}${dueDate}`;
    select.appendChild(optionEl);
  });

  if (previousValue && options.some((option) => String(option.renewal_id || option.id || 0) === previousValue)) {
    select.value = previousValue;
  } else if (options.length) {
    select.value = String(options[0].renewal_id || options[0].id || "");
  }
}

function handleTmeDealRenewalPaymentServiceChange() {
  const select = document.getElementById("tmeDealRenewalPaymentService");
  const amountInput = document.getElementById("tmeDealPaymentAmount");
  const cycleInput = document.getElementById("tmeDealRenewalCycleDate");
  const amountPreview = document.getElementById("tmeDealRenewalAmountPreview");
  const selectedOption = findTmeDealPaymentRenewalOption(select?.value);

  if (!selectedOption) {
    if (amountInput) amountInput.value = "";
    if (cycleInput) cycleInput.value = "";
    if (amountPreview) amountPreview.value = "";
    updateTmeDealPaymentBreakupPreview();
    return;
  }

  const renewalAmount = roundTmePaymentAmount(
    selectedOption.service_amount || selectedOption.amount || 0,
  );
  if (amountInput) {
    amountInput.value = renewalAmount > 0 ? renewalAmount.toFixed(2) : "";
    amountInput.readOnly = true;
    amountInput.removeAttribute("max");
    amountInput.placeholder = "Auto from renewal service";
  }
  if (cycleInput) {
    cycleInput.value = selectedOption.renewal_due_date || cycleInput.value || getTodayForInput();
  }
  if (amountPreview) {
    amountPreview.value = renewalAmount > 0
      ? formatDashboardMoney(renewalAmount)
      : "Amount missing";
  }
  updateTmeDealPaymentBreakupPreview();
}

function handleTmeDealPaymentTypeChange() {
  const typeSelect = document.getElementById("tmeDealPaymentType");
  const renewalRow = document.getElementById("tmeDealRenewalPaymentRow");
  const renewalSelect = document.getElementById("tmeDealRenewalPaymentService");
  const cycleInput = document.getElementById("tmeDealRenewalCycleDate");
  const amountInput = document.getElementById("tmeDealPaymentAmount");
  const amountPreview = document.getElementById("tmeDealRenewalAmountPreview");
  const summary = currentTmeDealPaymentsData?.summary || {};
  const isRenewal = typeSelect?.value === "renewal";

  renewalRow?.classList.toggle("hidden", !isRenewal);
  if (renewalSelect) renewalSelect.required = isRenewal;
  if (cycleInput) cycleInput.required = isRenewal;

  if (isRenewal) {
    renderTmeDealPaymentRenewalOptions();
    if (amountInput) {
      amountInput.readOnly = true;
      amountInput.removeAttribute("max");
      amountInput.placeholder = "Auto from renewal service";
    }
    handleTmeDealRenewalPaymentServiceChange();
    return;
  }

  if (amountInput) {
    amountInput.readOnly = false;
    amountInput.value = "";
    amountInput.max = String(Math.max(Number(summary.remainingAmount || 0), 0));
    amountInput.placeholder = summary.remainingAmount
      ? `Max ${formatDashboardMoney(summary.remainingAmount)}`
      : "Fully paid";
  }
  if (amountPreview) amountPreview.value = "";
  if (renewalSelect) renewalSelect.value = "";
  if (cycleInput) cycleInput.value = "";
  updateTmeDealPaymentBreakupPreview();
}

async function openTmeDealPaymentsModal(event, leadId) {
  if (event) {
    event.preventDefault();
    event.stopPropagation();
  }

  currentTmeDealPaymentsLeadId = Number(leadId || 0);
  const modal = document.getElementById("tmeDealPaymentsModal");
  if (!modal || !currentTmeDealPaymentsLeadId) return;

  modal.classList.remove("hidden");
  document.getElementById("tmeDealPaymentLeadId").value = String(currentTmeDealPaymentsLeadId);
  document.getElementById("tmeDealPaymentForm")?.reset();
  setTmeDealPaymentDefaultDate();
  handleTmeDealPaymentTypeChange();
  await loadTmeDealPayments(currentTmeDealPaymentsLeadId);
}

function renderTmeDealPaymentsSummary(result = {}) {
  const container = document.getElementById("tmeDealPaymentsSummary");
  if (!container) return;

  const lead = result.lead || {};
  const summary = result.summary || {};
  const titleEl = document.getElementById("tmeDealPaymentsModalTitle");
  const subtitleEl = document.getElementById("tmeDealPaymentsModalSubtitle");

  if (titleEl) {
    titleEl.textContent = `${lead.company_name || lead.client_name || "Deal"} Payments`;
  }
  if (subtitleEl) {
    subtitleEl.textContent = lead.part_payment_option
      ? `Schedule: ${lead.part_payment_option}`
      : "Manage installments and invoices.";
  }

  container.innerHTML = `
    <div><span>Deal Amount</span><strong>${escapeTmeHtml(formatDashboardMoney(summary.dealAmount || lead.deal_amount || 0))}</strong></div>
    <div><span>Received</span><strong>${escapeTmeHtml(formatDashboardMoney(summary.receivedAmount || 0))}</strong></div>
    <div><span>Balance</span><strong>${escapeTmeHtml(formatDashboardMoney(summary.remainingAmount || 0))}</strong></div>
  `;

  const scheduleContainer = document.getElementById("tmeAgreedInstallmentScheduleContainer");
  const scheduleList = document.getElementById("tmeAgreedInstallmentScheduleList");
  if (scheduleContainer && scheduleList) {
    let scheduleData = [];
    try {
      if (lead.part_payment_schedule) {
        scheduleData = typeof lead.part_payment_schedule === "string"
          ? JSON.parse(lead.part_payment_schedule)
          : lead.part_payment_schedule;
      }
    } catch (err) {
      console.error("TME installment schedule parse error:", err);
    }

    if (Array.isArray(scheduleData) && scheduleData.length) {
      scheduleContainer.classList.remove("hidden");
      scheduleList.innerHTML = scheduleData.map((installment, index) => `
        <div class="agreed-schedule-card">
          <span>Installment #${escapeTmeHtml(installment.installmentNo || index + 1)}</span>
          <strong>${escapeTmeHtml(formatDashboardMoney(installment.amount || 0))}</strong>
          <small><i class="far fa-calendar-alt"></i> Due: ${escapeTmeHtml(formatTmeDisplayDate(installment.dueDate))}</small>
        </div>
      `).join("");
    } else {
      scheduleContainer.classList.add("hidden");
      scheduleList.innerHTML = "";
    }
  }

  const amountInput = document.getElementById("tmeDealPaymentAmount");
  const currentPaymentType = document.getElementById("tmeDealPaymentType")?.value || "installment";
  if (amountInput && currentPaymentType !== "renewal") {
    amountInput.max = String(Math.max(Number(summary.remainingAmount || 0), 0));
    amountInput.placeholder = summary.remainingAmount
      ? `Max ${formatDashboardMoney(summary.remainingAmount)}`
      : "Fully paid";
  }
  updateTmeDealPaymentBreakupPreview();
}

function renderTmeInvoiceRowPaymentStatusSelect(leadId, paymentId, payStatus) {
  const normalizedStatus = normalizeTmeDealPayStatus(payStatus);
  const normalizedLeadId = Number(leadId || 0);
  const normalizedPaymentId = Number(paymentId || 0);
  return `
    <select
      class="payment-status invoice-row-status ${normalizedStatus}"
      data-current-status="${normalizedStatus}"
      onchange="updateTmeInvoiceRowPaymentStatus(${normalizedLeadId}, ${normalizedPaymentId}, this.value, this)"
    >
      <option value="pending" ${normalizedStatus === "pending" ? "selected" : ""}>Pending</option>
      <option value="received" ${normalizedStatus === "received" ? "selected" : ""}>Received</option>
      <option value="failed" ${normalizedStatus === "failed" ? "selected" : ""}>Failed</option>
    </select>
  `;
}

function renderTmeScheduledInvoicesTable(payments = [], leadId = currentTmeDealPaymentsLeadId) {
  const container = document.getElementById("tmeScheduledInvoicesContainer");
  if (!container) return;

  const deal = currentTmeDealPaymentsData?.deal || {};
  const lead = currentTmeDealPaymentsData?.lead || {};
  const summary = currentTmeDealPaymentsData?.summary || {};
  const contactArg = escapeTmeInlineJsString(lead.contact || deal.contact || "");
  const emailArg = escapeTmeInlineJsString(lead.email || deal.email || "");
  const leadPayStatus = normalizeTmeDealPayStatus(summary.payStatus || lead.pay_stat);
  const receivedPayments = payments.filter(
    (payment) =>
      normalizeTmeDealPayStatus(payment.payment_status) === "received" &&
      String(payment.payment_type || "").toLowerCase() !== "renewal",
  );
  const receivedPartPaymentTotal = receivedPayments.reduce(
    (sum, payment) => sum + Number(payment.amount || 0),
    0,
  );
  const leadPaymentDate = lead.payment_date || lead.closed_date || "";
  const downPaymentAmount =
    Number(summary.downPaymentAmount || lead.down_payment_amount || 0) ||
    Math.max(Number(lead.received_amount || 0) - receivedPartPaymentTotal, 0);

  const invoiceRows = [];
  if (downPaymentAmount > 0 && leadPaymentDate) {
    invoiceRows.push({
      label: "Down Payment",
      amount: downPaymentAmount,
      paymentDate: leadPaymentDate,
      paymentId: 0,
      instAmt: 0,
      isDownPayment: true,
      status: leadPayStatus,
    });
  }

  payments.forEach((payment, index) => {
    const isRenewalPayment = String(payment.payment_type || "").toLowerCase() === "renewal";
    invoiceRows.push({
      label: payment.payment_label || (
        isRenewalPayment
          ? `Renewal - ${payment.renewal_service_name || "Service"}`
          : `Installment ${payment.sequence_no || index + 1}`
      ),
      amount: Number(payment.amount || 0),
      paymentDate: payment.payment_date || "",
      paymentId: Number(payment.id || 0),
      instAmt: Number(payment.amount || 0),
      isDownPayment: false,
      status: normalizeTmeDealPayStatus(payment.payment_status),
    });
  });

  if (!invoiceRows.length) {
    container.innerHTML = `
      <div class="scheduled-invoices-empty">
        <i class="fas fa-file-invoice"></i>
        Invoices will appear here after payments are recorded.
      </div>
    `;
    return;
  }

  const tableRows = invoiceRows.map((row) => {
    const payDateFormatted = formatTmeDisplayDate(row.paymentDate);
    const paymentId = row.paymentId;
    const instAmt = row.isDownPayment ? 0 : row.instAmt;
    const rowStatus = normalizeTmeDealPayStatus(row.status);
    const statusSelect = renderTmeInvoiceRowPaymentStatusSelect(leadId, paymentId, rowStatus);
    const proformaActions = `
      <div class="invoice-actions">
        <button onclick="downloadTmeProformaInvoice(${leadId}, ${paymentId}, ${instAmt})" class="invoice-btn invoice-download" title="Download Proforma Invoice"><i class="fas fa-download"></i></button>
        <button onclick="shareTmeProformaInvoiceWhatsApp(${leadId}, '${contactArg}', ${paymentId}, ${instAmt})" class="invoice-btn invoice-whatsapp" title="Share on WhatsApp"><i class="fab fa-whatsapp"></i></button>
        <button onclick="shareTmeProformaInvoiceGmail('${emailArg}', ${leadId}, ${paymentId}, ${instAmt})" class="invoice-btn invoice-gmail" title="Share via Gmail"><i class="fas fa-envelope"></i></button>
      </div>
    `;
    const taxActions = rowStatus === "received"
      ? `
        <div class="invoice-actions">
          <button onclick="downloadTmeTaxInvoice(${leadId}, ${paymentId}, ${instAmt})" class="invoice-btn invoice-download" title="Download Tax Invoice"><i class="fas fa-download"></i></button>
          <button onclick="shareTmeTaxInvoiceWhatsApp(${leadId}, '${contactArg}', ${paymentId}, ${instAmt})" class="invoice-btn invoice-whatsapp" title="Share on WhatsApp"><i class="fab fa-whatsapp"></i></button>
          <button onclick="shareTmeTaxInvoiceGmail('${emailArg}', ${leadId}, ${paymentId}, ${instAmt})" class="invoice-btn invoice-gmail" title="Share via Gmail"><i class="fas fa-envelope"></i></button>
        </div>
      `
      : `<span class="invoice-pending">Mark Received to unlock</span>`;

    return `
      <tr>
        <td>${escapeTmeHtml(row.label)}</td>
        <td>${escapeTmeHtml(formatDashboardMoney(row.amount))}</td>
        <td>${escapeTmeHtml(payDateFormatted)}</td>
        <td>${escapeTmeHtml(payDateFormatted)}</td>
        <td>${proformaActions}</td>
        <td>${statusSelect}</td>
        <td>${escapeTmeHtml(payDateFormatted)}</td>
        <td>${taxActions}</td>
      </tr>
    `;
  }).join("");

  container.innerHTML = `
    <h3><i class="fas fa-file-invoice"></i> Invoices for Payments</h3>
    <div class="deal-payments-table-wrap">
      <table class="deal-payments-table">
        <thead>
          <tr>
            <th>Payment</th>
            <th>Amount</th>
            <th>Payment Date</th>
            <th>Proforma Date</th>
            <th>Proforma Invoice</th>
            <th>Payment Status</th>
            <th>Tax Invoice Date</th>
            <th>Tax Invoice</th>
          </tr>
        </thead>
        <tbody>${tableRows}</tbody>
      </table>
    </div>
  `;
}

function renderTmeDealPaymentsTable(payments = [], leadId = currentTmeDealPaymentsLeadId) {
  const tbody = document.getElementById("tmeDealPaymentsTableBody");
  if (!tbody) return;

  if (!payments.length) {
    tbody.innerHTML = `<tr><td colspan="10">No payment entries yet</td></tr>`;
    return;
  }

  const deal = currentTmeDealPaymentsData?.deal || {};
  const summary = currentTmeDealPaymentsData?.summary || {};
  const leadPayStatus = normalizeTmeDealPayStatus(summary.payStatus || deal.pay_stat);
  const contactArg = escapeTmeHtml(escapeTmeInlineJsString(deal.contact || ""));
  const emailArg = escapeTmeHtml(escapeTmeInlineJsString(deal.email || ""));

  tbody.innerHTML = payments.map((payment) => {
    const paymentId = Number(payment.id || 0);
    const status = normalizeTmeDealPayStatus(payment.payment_status);
    const isRenewalPayment = String(payment.payment_type || "").toLowerCase() === "renewal";
    const paymentLabel = payment.payment_label || (
      isRenewalPayment
        ? `Renewal - ${payment.renewal_service_name || "Service"}`
        : `Payment ${payment.sequence_no || ""}`
    );
    const fallbackBreakup = getTmePaymentGstBreakup(payment.amount);
    const amountWithoutGst = hasTmeStoredAmount(payment.amount_without_gst)
      ? Number(payment.amount_without_gst || 0)
      : fallbackBreakup.amountWithoutGst;
    const gstAmount = hasTmeStoredAmount(payment.gst_amount)
      ? Number(payment.gst_amount || 0)
      : fallbackBreakup.gstAmount;
    const taxInvoice = status === "received" && (leadPayStatus === "received" || isRenewalPayment)
      ? `
        <div class="invoice-actions">
          <button onclick="downloadTmeTaxInvoice(${leadId}, ${paymentId})" class="invoice-btn invoice-download" title="Download Tax Invoice"><i class="fas fa-download"></i></button>
          <button onclick="shareTmeTaxInvoiceWhatsApp(${leadId}, '${contactArg}', ${paymentId})" class="invoice-btn invoice-whatsapp" title="Share on WhatsApp"><i class="fab fa-whatsapp"></i></button>
          <button onclick="shareTmeTaxInvoiceGmail('${emailArg}', ${leadId}, ${paymentId})" class="invoice-btn invoice-gmail" title="Share via Gmail"><i class="fas fa-envelope"></i></button>
        </div>
      `
      : status === "received"
        ? `<span class="invoice-pending">Mark payment status Received</span>`
        : `<span class="invoice-pending">Pending</span>`;
    const proformaInvoice = status !== "failed"
      ? `
        <div class="invoice-actions">
          <button onclick="downloadTmeProformaInvoice(${leadId}, ${paymentId})" class="invoice-btn invoice-download" title="Download Proforma Invoice"><i class="fas fa-download"></i></button>
          <button onclick="shareTmeProformaInvoiceWhatsApp(${leadId}, '${contactArg}', ${paymentId})" class="invoice-btn invoice-whatsapp" title="Share on WhatsApp"><i class="fab fa-whatsapp"></i></button>
          <button onclick="shareTmeProformaInvoiceGmail('${emailArg}', ${leadId}, ${paymentId})" class="invoice-btn invoice-gmail" title="Share via Gmail"><i class="fas fa-envelope"></i></button>
        </div>
      `
      : `<span class="invoice-pending">Pending</span>`;

    return `
      <tr>
        <td>
          <div class="deal-payment-label">
            <span>${escapeTmeHtml(paymentLabel)}</span>
            ${isRenewalPayment ? `<small class="deal-payment-type renewal">Renewal</small>` : ""}
          </div>
        </td>
        <td>${escapeTmeHtml(formatTmeDisplayDate(payment.payment_date))}</td>
        <td>${escapeTmeHtml(formatDashboardMoney(payment.amount))}</td>
        <td>${escapeTmeHtml(formatTmePaymentMoney(amountWithoutGst))}</td>
        <td>${escapeTmeHtml(formatTmePaymentMoney(gstAmount))}</td>
        <td>${escapeTmeHtml(payment.payment_method || "-")}</td>
        <td><span class="payment-status ${status}">${escapeTmeHtml(formatTmeLeadHumanLabel(status))}</span></td>
        <td>${escapeTmeHtml(payment.notes || "-")}</td>
        <td>${taxInvoice}</td>
        <td>${proformaInvoice}</td>
      </tr>
    `;
  }).join("");
}

async function loadTmeDealPayments(leadId = currentTmeDealPaymentsLeadId) {
  if (!leadId) return;

  const tbody = document.getElementById("tmeDealPaymentsTableBody");
  if (tbody) tbody.innerHTML = `<tr><td colspan="10">Loading payments...</td></tr>`;

  try {
    const res = await fetch(`${BASE_URL}/api/deal-payments/${leadId}`, { cache: "no-store" });
    const result = await res.json();
    if (!res.ok || !result.success) {
      throw new Error(result.message || "Failed to load payments");
    }

    currentTmeDealPaymentsData = result;
    renderTmeDealPaymentsSummary(result);
    renderTmeDealPaymentRenewalOptions();
    handleTmeDealPaymentTypeChange();
    renderTmeDealPaymentsTable(result.data || [], leadId);
    renderTmeScheduledInvoicesTable(result.data || [], leadId);
  } catch (err) {
    console.error("TME deal payments load error:", err);
    if (tbody) {
      tbody.innerHTML = `<tr><td colspan="10">${escapeTmeHtml(err.message || "Failed to load payments")}</td></tr>`;
    }
  }
}

async function handleTmeDealPaymentSubmit(event) {
  event.preventDefault();

  const leadId = Number(
    document.getElementById("tmeDealPaymentLeadId")?.value ||
    currentTmeDealPaymentsLeadId ||
    0,
  );
  if (!leadId) return;

  const paymentType = document.getElementById("tmeDealPaymentType")?.value === "renewal"
    ? "renewal"
    : "installment";
  let amountValue = document.getElementById("tmeDealPaymentAmount")?.value || "";
  let renewalOption = null;

  if (paymentType === "renewal") {
    renewalOption = findTmeDealPaymentRenewalOption(
      document.getElementById("tmeDealRenewalPaymentService")?.value,
    );
    if (!renewalOption) {
      showPopup("Renewal Required", "Select a renewal service first.", false);
      return;
    }

    const renewalAmount = roundTmePaymentAmount(
      renewalOption.service_amount || renewalOption.amount || 0,
    );
    if (renewalAmount <= 0) {
      showPopup("Renewal Amount Missing", "Selected renewal service has no amount.", false);
      return;
    }

    amountValue = renewalAmount.toFixed(2);
    const amountInput = document.getElementById("tmeDealPaymentAmount");
    if (amountInput) amountInput.value = amountValue;
  }

  const paymentBreakup = getTmePaymentGstBreakup(amountValue);
  const formData = new FormData();
  formData.append("payment_type", paymentType);
  formData.append("amount", amountValue);
  formData.append("amount_without_gst", paymentBreakup.amountWithoutGst.toFixed(2));
  formData.append("gst_amount", paymentBreakup.gstAmount.toFixed(2));
  formData.append("payment_date", document.getElementById("tmeDealPaymentDate")?.value || "");
  formData.append("payment_method", document.getElementById("tmeDealPaymentMethod")?.value || "");
  formData.append("transaction_id", document.getElementById("tmeDealPaymentTransactionId")?.value || "");
  formData.append("bank_name", document.getElementById("tmeDealPaymentBankName")?.value || "");
  formData.append("notes", document.getElementById("tmeDealPaymentNotes")?.value || "");
  formData.append("payment_status", "received");
  formData.append("created_by", currentUser?.id || "");
  formData.append("created_by_name", currentUser?.name || "");

  if (paymentType === "renewal" && renewalOption) {
    const serviceName = renewalOption.service_name || renewalOption.serviceName || "Service";
    const cycleDate =
      document.getElementById("tmeDealRenewalCycleDate")?.value ||
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
    document.getElementById("tmeDealPaymentForm")?.reset();
    setTmeDealPaymentDefaultDate();
    await loadTmeDealPayments(leadId);
    await loadDeals();
  } catch (err) {
    console.error("TME deal payment save error:", err);
    showPopup("Payment Error", err.message || "Failed to save payment", false);
  }
}

async function updateTmePaymentStatus(leadId, status, el) {
  try {
    const res = await fetch(`${BASE_URL}/api/payment-status/${leadId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ pay_stat: status }),
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
    await loadDeals();
    if (Number(currentTmeDealPaymentsLeadId || 0) === Number(leadId || 0)) {
      await loadTmeDealPayments(leadId);
    }
  } catch (err) {
    console.error("TME payment status update error:", err);
    showPopup("Error", err.message || "Payment status update failed", false);
  }
}

async function updateTmeInvoiceRowPaymentStatus(leadId, paymentId, status, el) {
  const normalizedLeadId = Number(leadId || 0);
  const normalizedPaymentId = Number(paymentId || 0);
  if (!normalizedLeadId) return;

  if (!normalizedPaymentId) {
    await updateTmePaymentStatus(normalizedLeadId, status, el);
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
    await loadTmeDealPayments(normalizedLeadId);
    await loadDeals();
  } catch (err) {
    console.error("TME invoice payment status update error:", err);
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

async function shareTmeProformaInvoiceWhatsApp(id, phone, paymentId = 0, instAmt = 0) {
  try {
    const apiUrl = getTmeInvoiceUrl("invoice", id, paymentId, instAmt);
    const res = await fetch(apiUrl);
    const blob = await res.blob();
    let filename = `proforma_invoice_${id}`;
    if (paymentId) filename += `_${paymentId}`;
    if (instAmt) filename += "_inst";
    filename += ".pdf";

    const file = new File([blob], filename, { type: "application/pdf" });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({
        title: "Proforma Invoice",
        text: "Proforma Invoice shared from Metrics Mart",
        files: [file],
      });
      return;
    }

    const url = getTmeInvoiceUrl("invoice", id, paymentId, instAmt);
    const waUrl = `https://wa.me/${phone}?text=${encodeURIComponent(`Proforma Invoice: ${url}`)}`;
    window.open(waUrl, "_blank");
  } catch (err) {
    console.error("TME proforma WhatsApp error:", err);
    showPopup("Error", "Failed to share proforma invoice", false);
  }
}

async function shareTmeTaxInvoiceWhatsApp(id, phone, paymentId = 0, instAmt = 0) {
  try {
    const apiUrl = getTmeInvoiceUrl("tax-invoice", id, paymentId, instAmt);
    const res = await fetch(apiUrl);
    const blob = await res.blob();
    let filename = `tax_invoice_${id}`;
    if (paymentId) filename += `_${paymentId}`;
    if (instAmt) filename += "_inst";
    filename += ".pdf";

    const file = new File([blob], filename, { type: "application/pdf" });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({
        title: "Tax Invoice",
        text: "Tax Invoice shared from Metrics Mart",
        files: [file],
      });
      return;
    }

    const url = getTmeInvoiceUrl("tax-invoice", id, paymentId, instAmt);
    const waUrl = `https://wa.me/${phone}?text=${encodeURIComponent(`Tax Invoice: ${url}`)}`;
    window.open(waUrl, "_blank");
  } catch (err) {
    console.error("TME tax WhatsApp error:", err);
    showPopup("Error", "Could not share via WhatsApp", false);
  }
}

async function shareTmeTaxInvoiceGmail(email, id, paymentId = 0, instAmt = 0) {
  if (!email) {
    showPopup("Error", "Email not available", false);
    return;
  }

  try {
    const pdfUrl = getTmeInvoiceUrl("tax-invoice", id, paymentId, instAmt);
    const anchor = document.createElement("a");
    anchor.href = pdfUrl;
    let filename = `tax_invoice_${id}`;
    if (paymentId) filename += `_${paymentId}`;
    if (instAmt) filename += "_inst";
    filename += ".pdf";
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();

    setTimeout(() => {
      const gmailUrl =
        `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(email)}` +
        `&su=${encodeURIComponent("Tax Invoice")}` +
        `&body=${encodeURIComponent("Hi,\n\nPlease find the attached Tax Invoice.\n\nRegards")}`;
      window.open(gmailUrl, "_blank");
    }, 500);
  } catch (err) {
    console.error("TME tax Gmail error:", err);
    showPopup("Error", "Could not share via Gmail", false);
  }
}

async function shareTmeProformaInvoiceGmail(email, id, paymentId = 0, instAmt = 0) {
  if (!email) {
    showPopup("Error", "Email not available", false);
    return;
  }

  try {
    const pdfUrl = getTmeInvoiceUrl("invoice", id, paymentId, instAmt);
    const anchor = document.createElement("a");
    anchor.href = pdfUrl;
    let filename = `proforma_invoice_${id}`;
    if (paymentId) filename += `_${paymentId}`;
    if (instAmt) filename += "_inst";
    filename += ".pdf";
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();

    setTimeout(() => {
      const gmailUrl =
        `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(email)}` +
        `&su=${encodeURIComponent("Proforma Invoice")}` +
        `&body=${encodeURIComponent("Hi,\n\nPlease find the attached Proforma Invoice.\n\nRegards")}`;
      window.open(gmailUrl, "_blank");
    }, 900);
  } catch (err) {
    console.error("TME proforma Gmail error:", err);
    showPopup("Error", "Failed to share proforma invoice", false);
  }
}

function isLeadEligibleForDealClose(lead = {}) {
  const leadStatus = String(lead.lead_status || "")
    .toLowerCase()
    .trim();

  return (
    leadStatus !== "deal_closed" &&
    leadStatus !== "not_interested"
  );
}

function getDealCloseLeadById(leadId) {
  const normalizedLeadId = Number(leadId);
  return (
    tmeUnassignedLeads.find(
      (lead) => Number(lead.id) === normalizedLeadId,
    ) ||
    getTmeAppointmentById(normalizedLeadId) ||
    null
  );
}

function getTodayForInput() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function setDealCloseLeadMeta(lead) {
  const meta = document.getElementById("dealCloseLeadMeta");
  if (!meta) return;

  if (!lead) {
    meta.textContent = tmeUnassignedLeads.length
      ? "Select a lead from the dropdown to close it."
      : "No active leads are available right now.";
    return;
  }

  const assignedMe = lead.assign_emp || lead.assigned_me_name || lead.me_name || "";
  const summary = [
    lead.company_name || "Untitled company",
    lead.client_name ? `Client: ${lead.client_name}` : "",
    assignedMe ? `Assigned ME: ${assignedMe}` : "Assigned ME: Unassigned",
    lead.contact ? `Contact: ${lead.contact}` : "",
    lead.city ? `City: ${lead.city}` : "",
    lead.action_type ? `Stage: ${lead.action_type}` : "Stage: new lead",
  ].filter(Boolean);

  meta.textContent = summary.join(" | ");
}

function clearDealCloseProductSelection() {
  document
    .querySelectorAll("#dealCloseProductRows .deal-close-product-checkbox")
    .forEach((input) => {
      input.checked = false;
    });
}

function resetDealClosePricingState() {
  dealCloseDownsaleRequests = [];
  dealCloseApprovedDownsaleRequest = null;
  dealCloseAppliedUpsaleAmount = 0;
  dealCloseDownsaleApiAvailable = true;

  stopDealCloseDownsalePolling();
}

function resetDealClosePaymentSummary() {
  [
    "dealCloseReceivedAmount",
    "dealCloseRemainingAmount",
    "dealCloseTotalGst",
    "dealClosePaidGst",
    "dealCloseRemainingGst",
  ].forEach((id) => {
    const field = document.getElementById(id);
    if (field) field.value = "";
  });
}

function getDealCloseWholeAmount(value) {
  const amount = Number(String(value ?? "").replace(/,/g, ""));
  if (!Number.isFinite(amount)) return 0;
  return Math.max(Math.round(amount), 0);
}

function formatDealCloseWholeAmount(value) {
  return String(getDealCloseWholeAmount(value));
}

function getTmeInclusiveGstAmount(amount) {
  const numericAmount = Number(amount || 0);
  if (!Number.isFinite(numericAmount) || numericAmount <= 0) return 0;
  return numericAmount - (numericAmount / 1.18);
}

function syncDealClosePaymentSummary() {
  const totalField = document.getElementById("dealCloseAmount");
  const receivedField = document.getElementById("dealCloseReceivedAmount");
  const remainingField = document.getElementById("dealCloseRemainingAmount");
  const totalGstField = document.getElementById("dealCloseTotalGst");
  const paidGstField = document.getElementById("dealClosePaidGst");
  const remainingGstField = document.getElementById("dealCloseRemainingGst");

  if (!totalField || !receivedField || !remainingField) {
    return {
      total: getDealCloseWholeAmount(totalField?.value || 0),
      received: 0,
      remaining: 0,
      totalGst: 0,
      paidGst: 0,
      remainingGst: 0,
    };
  }

  const total = getDealCloseWholeAmount(totalField.value);
  if (!total) {
    resetDealClosePaymentSummary();
    return { total: 0, received: 0, remaining: 0, totalGst: 0, paidGst: 0, remainingGst: 0 };
  }

  const rawReceivedValue = String(receivedField.value || "").trim();
  let received = rawReceivedValue ? getDealCloseWholeAmount(rawReceivedValue) : 0;
  if (received > total) received = total;

  receivedField.value = rawReceivedValue ? formatDealCloseWholeAmount(received) : "";

  const remaining = Math.max(total - received, 0);
  const totalGst = getDealCloseWholeAmount(getTmeInclusiveGstAmount(total));
  const paidGst = getDealCloseWholeAmount(getTmeInclusiveGstAmount(received));
  const remainingGst = getDealCloseWholeAmount(getTmeInclusiveGstAmount(remaining));

  remainingField.value = formatDealCloseWholeAmount(remaining);
  if (totalGstField) totalGstField.value = formatDealCloseWholeAmount(totalGst);
  if (paidGstField) paidGstField.value = formatDealCloseWholeAmount(paidGst);
  if (remainingGstField) remainingGstField.value = formatDealCloseWholeAmount(remainingGst);

  return { total, received, remaining, totalGst, paidGst, remainingGst };
}

function handleDealCloseReceivedInput() {
  syncDealClosePaymentSummary();
}

const TME_DEAL_RENEWAL_BASIS_MONTHS = {
  monthly: 1,
  quarterly: 3,
  half_yearly: 6,
  yearly: 12,
};

const TME_DEAL_RENEWAL_BASIS_LABELS = {
  monthly: "Monthly",
  quarterly: "Quarterly",
  half_yearly: "Half Yearly",
  yearly: "Yearly",
};

function getTmeDealRenewalBasis() {
  const basis = document.getElementById("dealCloseRenewalBasis")?.value || "monthly";
  return TME_DEAL_RENEWAL_BASIS_MONTHS[basis] ? basis : "monthly";
}

function getTmeDealRenewalDefaultStartDate(basis = getTmeDealRenewalBasis()) {
  const date = new Date();
  date.setMonth(date.getMonth() + (TME_DEAL_RENEWAL_BASIS_MONTHS[basis] || 1));
  return date.toISOString().split("T")[0];
}

function isTmeDealCloseRenewableProduct(product = {}) {
  const normalized = normalizeLeadProductMatchValue(product.name || "").replace(/_/g, "");
  return Boolean(product.name) && !normalized.includes("profilecreation");
}

function getTmeDealCloseRenewalProducts(products = currentTmeDealCloseProducts) {
  const sourceProducts = Array.isArray(products) && products.length
    ? products
    : getSelectedDealCloseProducts();
  const seen = new Set();
  return sourceProducts.filter((product) => {
    if (!isTmeDealCloseRenewableProduct(product)) return false;
    const key = normalizeLeadProductMatchValue(product.name || "");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function updateTmeDealCloseRenewalPreview(products = currentTmeDealCloseProducts) {
  const preview = document.getElementById("dealCloseRenewalPreview");
  if (!preview) return;

  const enabled = document.getElementById("dealCloseRenewalEnabled")?.checked;
  const renewalProducts = getTmeDealCloseRenewalProducts(products);
  if (!enabled) {
    preview.textContent = "Enable renewal after selecting services.";
    return;
  }

  if (!renewalProducts.length) {
    preview.textContent = "No renewable service selected for this deal.";
    return;
  }

  const basis = getTmeDealRenewalBasis();
  const startDate = document.getElementById("dealCloseRenewalStartDate")?.value || "";
  const rows = renewalProducts
    .map((product) => {
      const amount = Number(product.amount ?? product.price ?? product.standardAmount ?? 0);
      return `${escapeTmeHtml(product.name)} (${formatDashboardMoney(amount)})`;
    })
    .join(", ");

  preview.innerHTML =
    `<strong>${escapeTmeHtml(TME_DEAL_RENEWAL_BASIS_LABELS[basis] || "Monthly")} renewal:</strong> ` +
    `${rows}${startDate ? ` from ${escapeTmeHtml(startDate)}` : ""}.`;
}

function toggleDealCloseRenewalFields() {
  const enabled = document.getElementById("dealCloseRenewalEnabled")?.checked;
  const fields = document.getElementById("dealCloseRenewalFields");
  const startInput = document.getElementById("dealCloseRenewalStartDate");
  if (fields) fields.classList.toggle("hidden", !enabled);
  if (enabled && startInput && !startInput.value) {
    startInput.value = getTmeDealRenewalDefaultStartDate();
  }
  updateTmeDealCloseRenewalPreview();
}

function handleDealCloseRenewalBasisChange() {
  const startInput = document.getElementById("dealCloseRenewalStartDate");
  if (document.getElementById("dealCloseRenewalEnabled")?.checked && startInput) {
    startInput.value = getTmeDealRenewalDefaultStartDate();
  }
  updateTmeDealCloseRenewalPreview();
}

function resetTmeDealCloseRenewalFields() {
  const enabled = document.getElementById("dealCloseRenewalEnabled");
  const fields = document.getElementById("dealCloseRenewalFields");
  const basis = document.getElementById("dealCloseRenewalBasis");
  const startInput = document.getElementById("dealCloseRenewalStartDate");
  const preview = document.getElementById("dealCloseRenewalPreview");

  if (enabled) enabled.checked = false;
  if (fields) fields.classList.add("hidden");
  if (basis) basis.value = "monthly";
  if (startInput) startInput.value = "";
  if (preview) preview.textContent = "Enable renewal after selecting services.";
}

function getTmeDealCloseRenewalConfig(products = currentTmeDealCloseProducts) {
  const enabled = document.getElementById("dealCloseRenewalEnabled")?.checked;
  if (!enabled) return { enabled: false };

  return {
    enabled: true,
    basis: getTmeDealRenewalBasis(),
    startDate: document.getElementById("dealCloseRenewalStartDate")?.value || "",
    services: getTmeDealCloseRenewalProducts(products),
  };
}

function resetDealCloseSelection() {
  dealCloseLeadId = null;

  const leadSelect = document.getElementById("dealCloseLeadSelect");
  const paymentMethod = document.getElementById("dealClosePaymentMethod");
  const salesType = document.getElementById("dealCloseSalesType");
  const notes = document.getElementById("dealCloseNotes");
  const amountInput = document.getElementById("dealCloseAmount");
  const totalBox = document.getElementById("dealCloseTotal");
  const paymentFields = document.getElementById("dealClosePaymentFields");

  if (leadSelect) {
    leadSelect.value = "";
  }

  if (paymentMethod) {
    paymentMethod.value = "";
  }

  if (salesType) {
    salesType.value = "fresh";
  }

  if (notes) {
    notes.value = "";
  }

  if (amountInput) {
    amountInput.value = "";
  }

  resetDealClosePaymentSummary();

  if (paymentFields) {
    paymentFields.innerHTML = "";
  }

  resetTmeDealCloseRenewalFields();

  if (totalBox) {
    totalBox.textContent = "Select products to calculate final total.";
  }

  const downsaleInput = document.getElementById("dealCloseDownsaleAmount");
  const downsaleReason = document.getElementById("dealCloseDownsaleReason");
  const upsaleInput = document.getElementById("dealCloseUpsaleAmount");

  if (downsaleInput) downsaleInput.value = "";
  if (downsaleReason) downsaleReason.value = "";
  if (upsaleInput) upsaleInput.value = "";
  tmeDealClosePartPaymentData = null;
  tmeDealInstallmentsSchedule = [];
  tmeDealPartPaymentRemaining = 0;
  currentTmeDealClosePayload = null;
  currentTmeDealCloseProducts = [];

  resetDealClosePricingState();
  clearDealCloseProductSelection();
  updateDealCloseDownsaleStatus(0, 0);
  updateDealCloseUpsaleStatus(0);
  setDealCloseLeadMeta(null);
}

async function fetchTmeUnassignedLeads() {
  if (!currentUser?.id) return [];

  const url =
    currentUser.role === "admin"
      ? `${BASE_URL}/api/leads?role=admin`
      : `${BASE_URL}/api/leads?userId=${currentUser.id}&role=${currentUser.role}&scope=deal-close`;

  const res = await fetch(url, { cache: "no-store" });
  const result = await res.json();

  if (!res.ok || !result.success || !Array.isArray(result.data)) {
    throw new Error(result.message || "Unable to load leads");
  }

  tmeUnassignedLeads = result.data
    .filter(isLeadEligibleForDealClose)
    .sort((left, right) => Number(right.id || 0) - Number(left.id || 0));

  return tmeUnassignedLeads;
}

async function ensureTmeDealCloseLeadInList(leadId) {
  const normalizedLeadId = Number(leadId || 0);
  if (
    !normalizedLeadId ||
    tmeUnassignedLeads.some((lead) => Number(lead.id) === normalizedLeadId)
  ) {
    return;
  }

  let lead = getTmeAppointmentById(normalizedLeadId);

  if (!lead) {
    try {
      const res = await fetch(`${BASE_URL}/api/leads/${normalizedLeadId}`, {
        cache: "no-store",
      });
      const result = await res.json();
      if (res.ok && result.success && result.data) {
        lead = result.data;
      }
    } catch (err) {
      console.warn("Deal close appointment lead load failed:", err);
    }
  }

  if (!lead) return;

  tmeUnassignedLeads.unshift({
    ...lead,
    id: normalizedLeadId,
    action_type: lead.action_type || "appointment",
  });
}

async function selectTmeDealCloseLead(leadId) {
  const select = document.getElementById("dealCloseLeadSelect");
  const normalizedLeadId = Number(leadId || 0);
  if (!select || !normalizedLeadId) return;

  await ensureTmeDealCloseLeadInList(normalizedLeadId);

  if (!Array.from(select.options).some((option) => Number(option.value) === normalizedLeadId)) {
    const lead = getDealCloseLeadById(normalizedLeadId);
    if (lead) {
      const option = document.createElement("option");
      const assignedMe = lead.assign_emp || lead.assigned_me_name || lead.me_name || "Unassigned ME";
      option.value = String(normalizedLeadId);
      option.textContent = `${lead.company_name || "Untitled"} - ${lead.client_name || "No client"} | ${assignedMe}${lead.contact ? ` (${lead.contact})` : ""}`;
      select.appendChild(option);
    }
  }

  select.value = String(normalizedLeadId);
  handleDealCloseLeadChange();
}

async function loadDealCloseLeadOptions(selectedLeadId = null) {
  const select = document.getElementById("dealCloseLeadSelect");
  if (!select) return;

  select.innerHTML = `<option value="">Loading active leads...</option>`;

  try {
    await fetchTmeUnassignedLeads();
    await ensureTmeDealCloseLeadInList(selectedLeadId);
    const displayLeads = tmeUnassignedLeads;

    if (!displayLeads.length) {
      select.innerHTML = `<option value="">No active leads found</option>`;
      setDealCloseLeadMeta(null);
      return;
    }

    select.innerHTML = `<option value="">Select lead</option>`;
    displayLeads.forEach((lead) => {
      const option = document.createElement("option");
      const assignedMe = lead.assign_emp || lead.assigned_me_name || lead.me_name || "Unassigned ME";
      option.value = String(lead.id);
      option.textContent = `${lead.company_name || "Untitled"} - ${lead.client_name || "No client"} | ${assignedMe}${lead.contact ? ` (${lead.contact})` : ""}`;
      select.appendChild(option);
    });

    if (selectedLeadId) {
      await selectTmeDealCloseLead(selectedLeadId);
    } else {
      setDealCloseLeadMeta(null);
    }
  } catch (err) {
    console.error("Deal close leads error:", err);
    select.innerHTML = `<option value="">Unable to load leads</option>`;
    setDealCloseLeadMeta(null);
    showPopup(
      "Load Error",
      err.message || "Unable to load active leads",
      false,
    );
  }
}

function handleDealCloseLeadChange() {
  const select = document.getElementById("dealCloseLeadSelect");
  const selectedId = Number(select?.value || 0);
  const selectedLead = getDealCloseLeadById(selectedId);

  dealCloseLeadId = selectedId || null;
  setDealCloseLeadMeta(selectedLead);

  const salesType = document.getElementById("dealCloseSalesType");
  if (salesType) {
    const selectedSalesType = String(selectedLead?.sales_type || "")
      .toLowerCase()
      .trim();
    salesType.value =
      selectedSalesType === "renewal" || selectedLead?.renewal_source_lead_id
        ? "renewal"
        : "fresh";
  }

  fetchDealCloseDownsaleRequests()
    .then(() => {
      updateDealCloseAmount();
      startDealCloseDownsalePolling();
    })
    .catch((err) => {
      console.error("Deal close downsale load error:", err);
      updateDealCloseAmount();
    });
}
async function fetchDealCloseProductCatalog(forceRefresh = false) {
  if (
    Array.isArray(tmeDealProductsCatalog) &&
    tmeDealProductsCatalog.length &&
    !forceRefresh
  ) {
    return tmeDealProductsCatalog;
  }

  const res = await fetch(`${BASE_URL}/api/deal-products`, {
    cache: "no-store",
  });
  const result = await res.json();

  if (!res.ok || !result.success || !Array.isArray(result.data)) {
    throw new Error(result.message || "Unable to load deal products");
  }

  tmeDealProductsCatalog = result.data;
  return tmeDealProductsCatalog;
}

async function fetchDealCloseDownsaleRequests() {
  if (!dealCloseLeadId) {
    dealCloseDownsaleRequests = [];
    dealCloseApprovedDownsaleRequest = null;
    dealCloseDownsaleApiAvailable = true;
    return [];
  }

  try {
    const res = await fetch(
      `${BASE_URL}/api/downsale-requests?leadId=${dealCloseLeadId}`,
      { cache: "no-store" },
    );

    if (!res.ok) {
      dealCloseDownsaleApiAvailable = false;
      dealCloseDownsaleRequests = [];
      dealCloseApprovedDownsaleRequest = null;
      return [];
    }

    dealCloseDownsaleApiAvailable = true;
    const result = await res.json();
    const requests =
      result.success && Array.isArray(result.data) ? result.data : [];

    dealCloseDownsaleRequests = requests;
    dealCloseApprovedDownsaleRequest =
      requests.find((request) => request.status === "approved") || null;

    return requests;
  } catch (err) {
    dealCloseDownsaleRequests = [];
    dealCloseApprovedDownsaleRequest = null;
    return [];
  }
}

function startDealCloseDownsalePolling() {
  stopDealCloseDownsalePolling();

  if (!dealCloseLeadId) return;

  dealCloseDownsalePollingTimer = setInterval(async () => {
    const modal = document.getElementById("dealCloseModal");
    if (!modal || modal.classList.contains("hidden") || !dealCloseLeadId) {
      stopDealCloseDownsalePolling();
      return;
    }

    const previousApprovedId = dealCloseApprovedDownsaleRequest?.id || null;
    await fetchDealCloseDownsaleRequests();
    const nextApprovedId = dealCloseApprovedDownsaleRequest?.id || null;

    if (
      previousApprovedId !== nextApprovedId ||
      dealCloseDownsaleRequests.length > 0
    ) {
      updateDealCloseAmount();
    }
  }, 3000);
}

function stopDealCloseDownsalePolling() {
  if (dealCloseDownsalePollingTimer) {
    clearInterval(dealCloseDownsalePollingTimer);
    dealCloseDownsalePollingTimer = null;
  }
}

// ── Service descriptions for Deal-Close modal ───────────────────────────────
const TME_DC_SERVICE_DESCRIPTIONS = {
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

function updateDealCloseSelectedDescriptions() {
  const container = document.getElementById('dealCloseSelectedDescriptions');
  if (!container) return;

  const selected = getSelectedDealCloseProducts();
  const params = getTmeDealCloseCustomParams();
  if (!selected.length) {
    container.innerHTML = '';
    return;
  }

  let html = '<div class="dc-desc-box"><strong class="dc-desc-title">&#128203; Selected Services Summary</strong><ul class="dc-desc-list">';
  selected.forEach(({ name }) => {
    const desc = TME_DC_SERVICE_DESCRIPTIONS[name];
    let detail = desc ? `<br><span class="dc-desc-detail">${escapeTmeHtml(desc)}</span>` : '';
    if (name === 'GMB SEO') {
      const kw = Math.max(10, parseInt(params.gmb_keyword_count, 10) || 10);
      const gmbAmount = kw * 1500;
      detail += `<br><span class="dc-desc-detail">&#8594; ${kw} keywords &#215; &#8377;1,500 = &#8377;${gmbAmount.toLocaleString('en-IN')}</span>`;
    }
    if (name === 'ERP/CRM/Software') {
      detail += `<br><span class="dc-desc-detail">&#8594; Project Amount: &#8377;${Number(params.erp_amount || 0).toLocaleString('en-IN')}</span>`;
    }
    if (name === 'E-commerce Website') {
      const type = params.ecom_type ? escapeTmeHtml(params.ecom_type) : '(type not set)';
      detail += `<br><span class="dc-desc-detail">&#8594; Platform / Type: ${type}</span>`;
      detail += `<br><span class="dc-desc-detail">&#8594; Project Amount: &#8377;${Number(params.ecom_amount || 0).toLocaleString('en-IN')}</span>`;
    }
    html += `<li class="dc-desc-item"><strong>${escapeTmeHtml(name)}</strong>${detail}</li>`;
  });
  html += '</ul></div>';
  container.innerHTML = html;
}
// ─────────────────────────────────────────────────────────────────────────────

// Returns the per-service custom options HTML (keyword counter, dropdowns, etc.)
function getTmeDealCloseCustomUI(productName) {
  const desc = TME_DC_SERVICE_DESCRIPTIONS[productName];
  const descHtml = desc ? `<p class="dc-service-desc">${escapeTmeHtml(desc)}</p>` : '';

  if (productName === 'GMB SEO') {
    return `
      <div class="dc-custom-ui-inner">
        ${descHtml}
        <div class="dc-field-row">
          <label class="dc-field-label">Keyword Count <small>(min 10, &#8377;1,500/keyword)</small>:</label>
          <div class="dc-counter-wrap">
            <button type="button" class="dc-counter-btn" onclick="
              var inp = document.getElementById('dc_gmb_keyword_count');
              inp.value = Math.max(10, parseInt(inp.value||10) - 1);
              updateDealCloseAmount();
            ">&#8722;</button>
            <input type="number" id="dc_gmb_keyword_count" value="10" min="10"
              class="dc-counter-input"
              oninput="if ((parseInt(this.value,10)||0) >= 10) updateDealCloseAmount();"
              onchange="this.value=Math.max(10,parseInt(this.value)||10); updateDealCloseAmount();">
            <button type="button" class="dc-counter-btn" onclick="
              var inp = document.getElementById('dc_gmb_keyword_count');
              inp.value = parseInt(inp.value||10) + 1;
              updateDealCloseAmount();
            ">&#43;</button>
          </div>
        </div>
      </div>`;
  }
  if (productName === 'Website SEO') {
    return `
      <div class="dc-custom-ui-inner">
        ${descHtml}
        <div class="dc-field-row">
          <label class="dc-field-label">Coverage Level:</label>
          <select id="dc_web_seo_level" class="dc-select" onchange="updateDealCloseAmount()">
            <option value="local">Local / City &#8211; &#8377;1,500/month</option>
            <option value="state">State &#8211; &#8377;3,500/month</option>
            <option value="india">India (National) &#8211; &#8377;7,000/month</option>
          </select>
        </div>
      </div>`;
  }
  if (productName === 'ERP/CRM/Software') {
    return `
      <div class="dc-custom-ui-inner">
        ${descHtml}
        <div class="dc-field-row">
          <label class="dc-field-label">Project Amount (&#8377;):</label>
          <input type="number" id="dc_erp_amount" value="0" min="0" placeholder="Enter project amount"
            class="dc-amount-input" oninput="updateDealCloseAmount()">
        </div>
      </div>`;
  }
  if (productName === 'E-commerce Website') {
    return `
      <div class="dc-custom-ui-inner">
        ${descHtml}
        <div class="dc-field-row">
          <label class="dc-field-label">Platform / Type:</label>
          <input type="text" id="dc_ecom_type" placeholder="e.g. Shopify, WooCommerce, Custom" class="dc-text-input" oninput="updateDealCloseSelectedDescriptions()">
        </div>
        <div class="dc-field-row" style="margin-top:8px;">
          <label class="dc-field-label">Project Amount (&#8377;):</label>
          <input type="number" id="dc_ecom_amount" value="0" min="0" placeholder="Enter project amount"
            class="dc-amount-input" oninput="updateDealCloseAmount()">
        </div>
      </div>`;
  }
  if (productName === 'Landing Page') {
    return `
      <div class="dc-custom-ui-inner">
        ${descHtml}
        <div class="dc-info-badge">&#128161; Amount is fetched automatically from the product catalogue set in Admin panel.</div>
      </div>`;
  }
  if (productName === 'Static Website') {
    return `
      <div class="dc-custom-ui-inner">
        ${descHtml}
        <div class="dc-info-badge">&#128161; Amount is fetched automatically from the product catalogue set in Admin panel.</div>
      </div>`;
  }
  if (productName === 'Dynamic Website') {
    return `
      <div class="dc-custom-ui-inner">
        ${descHtml}
        <div class="dc-field-row">
          <label class="dc-field-label">Website Type:</label>
          <div class="dc-radio-group">
            <label class="dc-radio-label"><input type="radio" name="dc_dynamic_web_type" value="templated" checked onchange="updateDealCloseAmount()"> Templated</label>
            <label class="dc-radio-label"><input type="radio" name="dc_dynamic_web_type" value="custom" onchange="updateDealCloseAmount()"> Custom</label>
          </div>
        </div>
        <div class="dc-info-badge">&#128161; Amount is fetched automatically from the product catalogue set in Admin panel.</div>
      </div>`;
  }
  if (productName === 'SMO Service' || productName === 'Meta Ads + Management' || productName === 'Meta Ads Management' || productName === 'SMO Services') {
    return `
      <div class="dc-custom-ui-inner">
        ${descHtml}
        <div class="dc-smo-section">
          <div class="dc-smo-group">
            <strong class="dc-smo-title">&#127807; Organic Platforms</strong>
            <small class="dc-smo-note">1 platform = &#8377;10,000 | 2 platforms = &#8377;15,000 | 3 platforms = &#8377;20,000</small>
            <div class="dc-check-group">
              <label class="dc-check-label"><input type="checkbox" name="dc_smo_platforms" value="facebook" onchange="updateDealCloseAmount()"> Facebook</label>
              <label class="dc-check-label"><input type="checkbox" name="dc_smo_platforms" value="instagram" onchange="updateDealCloseAmount()"> Instagram</label>
              <label class="dc-check-label"><input type="checkbox" name="dc_smo_platforms" value="linkedin" onchange="updateDealCloseAmount()"> LinkedIn</label>
            </div>
          </div>
          <div class="dc-smo-group" style="margin-top:10px;">
            <strong class="dc-smo-title">&#128226; Sponsored / Paid Ads <small>(added on top of organic price)</small></strong>
            <small class="dc-smo-note">FB/IG Ads = +&#8377;8,000 | LinkedIn Ads = +&#8377;10,000</small>
            <div class="dc-check-group">
              <label class="dc-check-label"><input type="checkbox" name="dc_smo_sponsored" value="fb_ig" onchange="tmeSmoSponsoredChange(this); updateDealCloseAmount()"> FB / IG Ads (+&#8377;8,000)</label>
              <label class="dc-check-label"><input type="checkbox" name="dc_smo_sponsored" value="linkedin" onchange="tmeSmoSponsoredChange(this); updateDealCloseAmount()"> LinkedIn Ads (+&#8377;10,000)</label>
            </div>
          </div>
        </div>
      </div>`;
  }
  // Generic — show description only
  if (desc) {
    return `<div class="dc-custom-ui-inner">${descHtml}</div>`;
  }
  return '';
}

function getTmeDealCloseCustomParams() {
  const params = {};

  const gmbKw = document.getElementById('dc_gmb_keyword_count');
  if (gmbKw) params.gmb_keyword_count = getTmeDealCloseGmbKeywordCount();

  const webSeo = document.getElementById('dc_web_seo_level');
  if (webSeo) params.web_seo_level = webSeo.value;

  const erpAmt = document.getElementById('dc_erp_amount');
  if (erpAmt) params.erp_amount = erpAmt.value;

  const ecomType = document.getElementById('dc_ecom_type');
  if (ecomType) params.ecom_type = ecomType.value;

  const ecomAmt = document.getElementById('dc_ecom_amount');
  if (ecomAmt) params.ecom_amount = ecomAmt.value;

  const dynChecked = document.querySelector('input[name="dc_dynamic_web_type"]:checked');
  if (dynChecked) params.dynamic_web_type = dynChecked.value;

  const smoPlatforms = Array.from(document.querySelectorAll('input[name="dc_smo_platforms"]:checked')).map(el => el.value);
  if (smoPlatforms.length) params.smo_platforms = smoPlatforms;

  const smoSponsored = Array.from(document.querySelectorAll('input[name="dc_smo_sponsored"]:checked')).map(el => el.value);
  if (smoSponsored.length) params.smo_sponsored = smoSponsored;

  return params;
}

function getTmeDealCloseGmbKeywordCount() {
  const gmbKw = document.getElementById('dc_gmb_keyword_count');
  const keywordCount = Math.max(10, Math.floor(Number(gmbKw?.value || 10)) || 10);
  if (gmbKw) gmbKw.value = String(keywordCount);
  return keywordCount;
}

// Show / hide the custom-options panel when a service checkbox is toggled
function updateTmeDealCloseCustomUI(checkbox) {
  const safeId = checkbox.value.replace(/[^a-zA-Z0-9]/g, '_');
  const panel = document.getElementById('tmeCustomUI_' + safeId);
  if (panel) {
    panel.style.display = checkbox.checked ? 'block' : 'none';
  }
  updateDealCloseSelectedDescriptions();
}

// SMO sponsored helper (auto-check organic platforms)
function tmeSmoSponsoredChange(checkbox) {
  if (!checkbox.checked) return;
  if (checkbox.value === 'fb_ig') {
    const fb = document.querySelector('input[name="dc_smo_platforms"][value="facebook"]');
    const ig = document.querySelector('input[name="dc_smo_platforms"][value="instagram"]');
    if (fb && !fb.checked) fb.checked = true;
    if (ig && !ig.checked) ig.checked = true;
  } else if (checkbox.value === 'linkedin') {
    const ln = document.querySelector('input[name="dc_smo_platforms"][value="linkedin"]');
    if (ln && !ln.checked) ln.checked = true;
  }
}

async function renderDealCloseProducts() {
  const container = document.getElementById("dealCloseProductRows");
  if (!container) return;

  try {
    const [catalog] = await Promise.all([
      fetchDealCloseProductCatalog(true),
      fetchDealCloseDownsaleRequests(),
    ]);
    const groups = catalog.reduce((accumulator, product) => {
      const groupName = product.group || "Products";
      if (!accumulator[groupName]) {
        accumulator[groupName] = [];
      }
      accumulator[groupName].push(product);
      return accumulator;
    }, {});

    if (!Object.keys(groups).length) {
      container.innerHTML = `
        <div class="deal-close-empty">
          No active products found. Please add active products from Admin panel.
        </div>
      `;
      return;
    }

    container.innerHTML = Object.entries(groups)
      .map(
        ([groupName, products]) => `
          <div class="deal-close-product-group">
            <h4>${escapeTmeHtml(groupName)}</h4>
            ${products
              .map((product) => {
                const safeId = product.name.replace(/[^a-zA-Z0-9]/g, '_');
                const customUI = getTmeDealCloseCustomUI(product.name);
                return `
                  <label class="deal-close-product-option">
                    <input
                      type="checkbox"
                      class="deal-close-product-checkbox"
                      value="${escapeTmeHtml(product.name)}"
                      onchange="updateDealCloseAmount(); updateTmeDealCloseCustomUI(this);"
                    >
                    <span class="deal-close-product-name">
                      ${escapeTmeHtml(product.name)}
                    </span>
                  </label>
                  ${customUI ? `<div
                    class="tme-custom-product-ui"
                    id="tmeCustomUI_${safeId}"
                    style="display:none; margin-left:24px; margin-bottom:10px; padding:10px 12px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px;"
                  >${customUI}</div>` : ''}
                `;
              })
              .join("")}
          </div>
        `,
      )
      .join("");

    container.innerHTML += `
      <div class="deal-close-action-card">
        <div>
          <strong>Overall Downsale</strong>
          <small id="dealCloseDownsaleStatus">
            Select a lead and products to request discount on total amount.
          </small>
        </div>
        <button
          type="button"
          class="deal-close-toggle-btn"
          id="dealCloseDownsaleToggle"
          onclick="toggleDealCloseDownsalePanel()"
          disabled
        >
          Downsale
        </button>
        <div id="dealCloseDownsalePanel" class="deal-close-action-panel hidden">
          <input
            type="number"
            id="dealCloseDownsaleAmount"
            placeholder="Downsale amount"
            min="1"
            step="1"
          >
          <textarea
            id="dealCloseDownsaleReason"
            placeholder="Reason for discount"
            rows="3"
          ></textarea>
          <button
            type="button"
            class="save-btn deal-close-panel-btn"
            onclick="submitDealCloseDownsaleRequest(this)"
          >
            Send Approval
          </button>
        </div>
      </div>
      <div class="deal-close-action-card">
        <div>
          <strong>Overall Upsale</strong>
          <small id="dealCloseUpsaleStatus">
            Add extra amount above standard total. No approval required.
          </small>
        </div>
        <button
          type="button"
          class="deal-close-toggle-btn deal-close-toggle-btn-upsale"
          id="dealCloseUpsaleToggle"
          onclick="toggleDealCloseUpsalePanel()"
          disabled
        >
          Upsale
        </button>
        <div id="dealCloseUpsalePanel" class="deal-close-action-panel hidden">
          <input
            type="number"
            id="dealCloseUpsaleAmount"
            placeholder="Extra upsale amount"
            min="1"
            step="1"
          >
          <div class="deal-close-panel-actions">
            <button
              type="button"
              class="save-btn deal-close-panel-btn"
              onclick="applyDealCloseUpsaleAmount()"
            >
              Apply Upsale
            </button>
            <button
              type="button"
              class="cancel-btn deal-close-panel-btn"
              onclick="clearDealCloseUpsaleAmount()"
            >
              Clear
            </button>
          </div>
        </div>
      </div>
    `;

    updateDealCloseAmount();
    startDealCloseDownsalePolling();
  } catch (err) {
    console.error("Deal close products error:", err);
    container.innerHTML = `
      <div class="deal-close-empty">
        ${err.message || "Unable to load products right now."}
      </div>
    `;
  }
}

function getSelectedDealCloseProducts() {
  return Array.from(
    document.querySelectorAll(
      "#dealCloseProductRows .deal-close-product-checkbox:checked",
    ),
  ).map((input) => {
    const name = input.value;
    const catalogItem = getTmeDealCloseCatalogItem(name);
    const price = Number(catalogItem?.price || 0);
    const product = {
      name,
      ...(Number.isFinite(price) && price > 0 ? { price, amount: price } : {}),
    };

    if (normalizeLeadProductMatchValue(name) === "gmb_seo") {
      const keywordCount = getTmeDealCloseGmbKeywordCount();
      const keywordAmount = keywordCount * 1500;
      product.price = keywordAmount;
      product.amount = keywordAmount;
      product.keywordCount = keywordCount;
      product.keywords = keywordCount;
      product.gmb_keyword_count = keywordCount;
    }

    return product;
  });
}

function getTmeDealCloseGmbQuoteAdjustment(selectedProducts = [], quoteItems = []) {
  const selectedGmb = selectedProducts.find(
    (product) => normalizeLeadProductMatchValue(product.name) === "gmb_seo",
  );
  if (!selectedGmb || !Array.isArray(quoteItems)) return 0;

  const quotedGmb = quoteItems.find(
    (item) => normalizeLeadProductMatchValue(item.name) === "gmb_seo",
  );
  if (!quotedGmb) return 0;
  if (quotedGmb.isRenewalSourceAmount) return 0;

  const expectedAmount =
    Math.max(
      10,
      Math.floor(
        Number(
          selectedGmb.keywordCount ||
            selectedGmb.keywords ||
            selectedGmb.gmb_keyword_count ||
            getTmeDealCloseGmbKeywordCount(),
        ) || 10,
      ),
    ) * 1500;
  const quotedAmount = Number(
    quotedGmb.amount ?? quotedGmb.standardAmount ?? quotedGmb.price ?? 0,
  );

  if (!Number.isFinite(expectedAmount) || !Number.isFinite(quotedAmount)) {
    return 0;
  }

  return expectedAmount - quotedAmount;
}

function syncTmeDealCloseGmbQuoteItem(item = {}, selectedProducts = []) {
  if (normalizeLeadProductMatchValue(item.name) !== "gmb_seo") return item;
  if (item.isRenewalSourceAmount) return item;

  const selectedGmb = selectedProducts.find(
    (product) => normalizeLeadProductMatchValue(product.name) === "gmb_seo",
  );
  if (!selectedGmb) return item;

  const keywordCount = Math.max(
    10,
    Math.floor(
      Number(
        selectedGmb.keywordCount ||
          selectedGmb.keywords ||
          selectedGmb.gmb_keyword_count ||
          getTmeDealCloseGmbKeywordCount(),
      ) || 10,
    ),
  );
  const amount = keywordCount * 1500;

  return {
    ...item,
    amount,
    standardAmount: amount,
    keywordCount,
    keywordRate: 1500,
  };
}

function getTmeDealCloseCatalogItem(productName) {
  const normalizedName = normalizeLeadProductMatchValue(productName);
  return (Array.isArray(tmeDealProductsCatalog) ? tmeDealProductsCatalog : []).find(
    (product) => normalizeLeadProductMatchValue(product.name) === normalizedName,
  );
}

function toggleDealCloseDownsalePanel() {
  const panel = document.getElementById("dealCloseDownsalePanel");
  if (panel) panel.classList.toggle("hidden");
}

function toggleDealCloseUpsalePanel() {
  const panel = document.getElementById("dealCloseUpsalePanel");
  if (panel) panel.classList.toggle("hidden");
}

function updateDealCloseUpsaleStatus(upsaleAmount) {
  const statusEl = document.getElementById("dealCloseUpsaleStatus");
  const toggle = document.getElementById("dealCloseUpsaleToggle");

  if (toggle) {
    toggle.disabled = getSelectedDealCloseProducts().length === 0;
  }

  if (!statusEl) return;

  if (upsaleAmount > 0) {
    statusEl.textContent = "Upsale applied.";
    statusEl.style.color = "#15803d";
  } else {
    statusEl.textContent =
      "Add extra amount above standard total. No approval required.";
    statusEl.style.color = "#64748b";
  }
}

function updateDealCloseDownsaleStatus(standardTotal, finalTotal, quote = {}) {
  const statusEl = document.getElementById("dealCloseDownsaleStatus");
  const toggle = document.getElementById("dealCloseDownsaleToggle");
  const selectedProductsCount = getSelectedDealCloseProducts().length;
  const latestRequest = dealCloseDownsaleRequests[0] || null;
  const hasApprovedDownsale =
    quote.hasApprovedDownsale ||
    (dealCloseApprovedDownsaleRequest && finalTotal < standardTotal);

  if (toggle) {
    toggle.disabled =
      !dealCloseLeadId ||
      selectedProductsCount === 0 ||
      !dealCloseDownsaleApiAvailable;
  }

  if (!statusEl) return;

  if (!dealCloseLeadId) {
    statusEl.textContent =
      "Select a lead first, then you can request downsale approval.";
    statusEl.style.color = "#64748b";
    return;
  }

  if (!dealCloseDownsaleApiAvailable) {
    statusEl.textContent = "Server restart required for downsale approval.";
    statusEl.style.color = "#b91c1c";
  } else if (hasApprovedDownsale) {
    statusEl.textContent = "Approved downsale applied.";
    statusEl.style.color = "#15803d";
  } else if (latestRequest?.status === "pending") {
    statusEl.textContent = "Downsale approval pending.";
    statusEl.style.color = "#92400e";
  } else if (latestRequest?.status === "rejected") {
    statusEl.textContent = "Last downsale request was rejected.";
    statusEl.style.color = "#b91c1c";
  } else if (selectedProductsCount === 0) {
    statusEl.textContent =
      "Select products to request discount on total amount.";
    statusEl.style.color = "#64748b";
  } else {
    statusEl.textContent =
      "Products selected. Downsale can be requested if needed.";
    statusEl.style.color = "#64748b";
  }
}

function applyDealCloseUpsaleAmount() {
  const selectedProducts = getSelectedDealCloseProducts();
  const amount = Number(
    document.getElementById("dealCloseUpsaleAmount")?.value || 0,
  );

  if (!selectedProducts.length) {
    showPopup("Products Missing", "Select at least one product first.", false);
    return;
  }

  if (!Number.isFinite(amount) || amount <= 0) {
    showPopup("Upsale Amount", "Enter a valid upsale amount.", false);
    return;
  }

  dealCloseAppliedUpsaleAmount = amount;
  updateDealCloseAmount();
}

function clearDealCloseUpsaleAmount() {
  dealCloseAppliedUpsaleAmount = 0;
  const input = document.getElementById("dealCloseUpsaleAmount");
  if (input) input.value = "";
  updateDealCloseAmount();
}

async function submitDealCloseDownsaleRequest(button) {
  const selectedProducts = getSelectedDealCloseProducts();
  const requestedAmount = Number(
    document.getElementById("dealCloseDownsaleAmount")?.value || 0,
  );
  const reason =
    document.getElementById("dealCloseDownsaleReason")?.value?.trim() || "";

  if (!dealCloseLeadId) {
    showPopup("Lead Missing", "Please select a lead first.", false);
    return;
  }

  if (!selectedProducts.length) {
    showPopup("Products Missing", "Select at least one product first.", false);
    return;
  }

  if (!dealCloseDownsaleApiAvailable) {
    showPopup(
      "Downsale Unavailable",
      "Server restart required for downsale approval.",
      false,
    );
    return;
  }

  if (!Number.isFinite(requestedAmount) || requestedAmount <= 0) {
    showPopup("Downsale Amount", "Enter a valid downsale amount.", false);
    return;
  }

  try {
    if (button) button.disabled = true;

    const res = await fetch(`${BASE_URL}/api/downsale-requests`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        leadId: dealCloseLeadId,
        requestedBy: currentUser?.id,
        companyScope: getTmeDealCloseCompanyScope(),
        products: selectedProducts,
        requestedAmount,
        reason,
        ...getTmeDealCloseCustomParams(),
      }),
    });

    const contentType = res.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
      throw new Error("Server restart required for downsale approval.");
    }

    const result = await res.json();
    if (!res.ok || !result.success) {
      throw new Error(result.message || "Failed to send downsale request");
    }

    showPopup(
      "Approval Sent",
      result.message || "Downsale request sent to admin.",
      true,
    );

    await fetchDealCloseDownsaleRequests();
    updateDealCloseAmount();
  } catch (err) {
    console.error("Deal close downsale request error:", err);
    showPopup(
      "Request Failed",
      err.message || "Failed to send downsale request.",
      false,
    );
  } finally {
    if (button) button.disabled = false;
  }
}

async function updateDealCloseAmount() {
  const amountInput = document.getElementById("dealCloseAmount");
  const totalBox = document.getElementById("dealCloseTotal");
  const selectedProducts = getSelectedDealCloseProducts();

  updateDealCloseSelectedDescriptions();

  if (!amountInput || !totalBox) return;

  if (!selectedProducts.length) {
    amountInput.value = "";
    totalBox.textContent = "Select products to calculate final total.";
    dealCloseAppliedUpsaleAmount = 0;
    resetDealClosePaymentSummary();
    updateTmeDealCloseRenewalPreview([]);
    updateDealCloseUpsaleStatus(0);
    updateDealCloseDownsaleStatus(0, 0);
    return;
  }

  const upsaleAmount = Number(dealCloseAppliedUpsaleAmount || 0);
  const customParams = getTmeDealCloseCustomParams();
  const missingAmounts = [];

  if (
    selectedProducts.some((product) => product.name === "ERP/CRM/Software") &&
    !(Number(customParams.erp_amount) > 0)
  ) {
    missingAmounts.push("ERP/CRM/Software");
  }

  if (
    selectedProducts.some((product) => product.name === "E-commerce Website") &&
    !(Number(customParams.ecom_amount) > 0)
  ) {
    missingAmounts.push("E-commerce Website");
  }

  if (missingAmounts.length) {
    amountInput.value = "";
    totalBox.textContent = `Please enter amount for: ${missingAmounts.join(", ")}.`;
    resetDealClosePaymentSummary();
    updateTmeDealCloseRenewalPreview(selectedProducts);
    updateDealCloseDownsaleStatus(0, 0);
    updateDealCloseUpsaleStatus(upsaleAmount);
    return 0;
  }

  totalBox.textContent = "Calculating final total...";

  try {
    const res = await fetch(`${BASE_URL}/api/deal-products/quote`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        leadId: dealCloseLeadId,
        products: selectedProducts,
        downsaleApprovalId: dealCloseApprovedDownsaleRequest?.id || null,
        upsaleAmount,
        ...customParams,
      }),
    });
    const result = await res.json();

    if (!res.ok || !result.success) {
      throw new Error(result.message || "Unable to calculate total");
    }

    const quoteItems = Array.isArray(result.data?.items) ? result.data.items : [];
    const gmbQuoteAdjustment = getTmeDealCloseGmbQuoteAdjustment(
      selectedProducts,
      quoteItems,
    );
    const finalTotal = Number(result.data?.total || 0) + gmbQuoteAdjustment;
    currentTmeDealCloseProducts = quoteItems.length
      ? quoteItems.map((item) => {
          const syncedItem = syncTmeDealCloseGmbQuoteItem(item, selectedProducts);
          return {
            name: syncedItem.name,
            price: Number(syncedItem.amount ?? syncedItem.price ?? syncedItem.standardAmount ?? 0),
            amount: Number(syncedItem.amount ?? syncedItem.price ?? syncedItem.standardAmount ?? 0),
            ...(syncedItem.keywordCount
              ? {
                  keywordCount: syncedItem.keywordCount,
                  keywordRate: syncedItem.keywordRate,
                }
              : {}),
          };
        })
      : selectedProducts;
    amountInput.value = finalTotal ? finalTotal.toFixed(2) : "";
    totalBox.textContent = `Final total: ${formatDashboardMoney(finalTotal)}`;
    syncDealClosePaymentSummary();
    updateTmeDealCloseRenewalPreview(currentTmeDealCloseProducts);

    updateDealCloseDownsaleStatus(0, finalTotal, {
      ...(result.data || {}),
      total: finalTotal,
      standardTotal: Number(result.data?.standardTotal || 0) + gmbQuoteAdjustment,
    });
    updateDealCloseUpsaleStatus(upsaleAmount);
    return finalTotal;
  } catch (err) {
    console.error("Deal close quote error:", err);
    amountInput.value = "";
    totalBox.textContent = err.message || "Unable to calculate final total.";
    resetDealClosePaymentSummary();
    updateTmeDealCloseRenewalPreview(selectedProducts);
    updateDealCloseDownsaleStatus(0, 0);
    updateDealCloseUpsaleStatus(upsaleAmount);
    return 0;
  }
}

function renderDealClosePaymentFields() {
  const method = document.getElementById("dealClosePaymentMethod")?.value || "";
  const container = document.getElementById("dealClosePaymentFields");
  if (!container) return;

  container.innerHTML = "";

  if (method === "Cheque") {
    container.innerHTML = `
      <input type="text" id="dealCloseChequeNo" placeholder="Cheque Number">
      <input type="date" id="dealCloseChequeDate">
      <input type="text" id="dealCloseBankName" placeholder="Bank Name">
      <input type="text" id="dealCloseBranchName" placeholder="Branch Name">
    `;
  } else if (method === "UPI / Net Banking") {
    container.innerHTML = `
      <input type="text" id="dealCloseTxnId" placeholder="Transaction ID">
      <input type="text" id="dealCloseBankName" placeholder="Bank Name">
    `;
  } else if (method === "Debit/Credit Card") {
    container.innerHTML = `
      <div class="deal-close-empty">
        Add the card transaction reference in notes before saving the deal.
      </div>
    `;
  }
}

function getTmeInstallmentCountForTerm(term) {
  if (term === "2 Months") return 2;
  if (term === "Quarterly") return 4;
  if (term === "Half Year") return 6;
  if (term === "Year") return 12;
  return term ? 1 : 0;
}

function calculateInstallmentSchedule() {
  const remaining = tmeDealPartPaymentRemaining > 0 ? tmeDealPartPaymentRemaining : Number(document.getElementById("dealCloseRemainingAmount")?.value || 0);
  const term = document.getElementById("dealPartPaymentTerm")?.value || "";
  const startDateVal = document.getElementById("dealPartPaymentStartDate")?.value || "";
  const schedulePreview = document.getElementById("dealInstallmentSchedulePreview");
  const installmentList = document.getElementById("installmentList");
  const installmentsInput = document.getElementById("dealPartPaymentInstallments");
  const perAmountInput = document.getElementById("dealPartPaymentPerAmount");

  if (!schedulePreview || !installmentList || !installmentsInput || !perAmountInput) return;

  const numInstallments = getTmeInstallmentCountForTerm(term);
  if (!numInstallments || remaining <= 0) {
    schedulePreview.style.display = "none";
    installmentsInput.value = "";
    perAmountInput.value = "";
    tmeDealInstallmentsSchedule = [];
    return;
  }

  installmentsInput.value = String(numInstallments);
  const perAmount = Math.floor(remaining / numInstallments);
  perAmountInput.value = String(perAmount);
  installmentList.innerHTML = "";

  if (!startDateVal) {
    schedulePreview.style.display = "none";
    tmeDealInstallmentsSchedule = [];
    return;
  }

  schedulePreview.style.display = "block";
  tmeDealInstallmentsSchedule = [];
  const currentDate = new Date(startDateVal);

  for (let i = 1; i <= numInstallments; i += 1) {
    const dateStr = currentDate.toISOString().split("T")[0];
    const amount =
      i === numInstallments
        ? Math.max(remaining - perAmount * (numInstallments - 1), 0)
        : perAmount;

    tmeDealInstallmentsSchedule.push({
      installmentNo: i,
      dueDate: dateStr,
      amount,
    });

    const row = document.createElement("div");
    row.dataset.tmeInstallmentRow = String(i);
    row.style.display = "grid";
    row.style.gridTemplateColumns = "1fr 145px 130px";
    row.style.gap = "8px";
    row.style.alignItems = "center";
    row.style.padding = "5px 0";
    row.style.fontSize = "13px";
    row.style.color = "#475569";
    row.style.borderBottom = "1px solid #f1f5f9";
    row.innerHTML = `
      <span>Installment #${i}</span>
      <input type="date" value="${dateStr}" data-tme-installment-date onchange="syncTmeInstallmentScheduleFromInputs()" style="height:32px; border:1px solid #cbd5e1; border-radius:6px; padding:4px 8px;" />
      <input type="number" min="1" step="1" value="${amount}" data-tme-installment-amount oninput="syncTmeInstallmentScheduleFromInputs(this)" style="height:32px; border:1px solid #cbd5e1; border-radius:6px; padding:4px 8px; text-align:right;" />
    `;
    installmentList.appendChild(row);

    currentDate.setMonth(currentDate.getMonth() + 1);
  }

  const hint = document.createElement("div");
  hint.id = "installmentTotalHint";
  hint.style.marginTop = "8px";
  hint.style.fontSize = "12px";
  hint.style.fontWeight = "600";
  installmentList.appendChild(hint);
  syncTmeInstallmentScheduleFromInputs();
}

function rebalanceTmeInstallmentAmounts(changedInput) {
  if (!changedInput) return;

  const rows = Array.from(document.querySelectorAll("#installmentList [data-tme-installment-row]"));
  const changedRow = changedInput.closest("[data-tme-installment-row]");
  const changedIndex = rows.indexOf(changedRow);
  if (changedIndex < 0) return;

  const remaining = getDealCloseWholeAmount(
    tmeDealPartPaymentRemaining > 0
      ? tmeDealPartPaymentRemaining
      : document.getElementById("dealCloseRemainingAmount")?.value || 0,
  );
  const getAmountInput = (row) => row.querySelector("[data-tme-installment-amount]");
  const usedBefore = rows
    .slice(0, changedIndex)
    .reduce((sum, row) => sum + getDealCloseWholeAmount(getAmountInput(row)?.value || 0), 0);
  const maxChangedAmount = Math.max(remaining - usedBefore, 0);
  const changedAmount = Math.min(
    getDealCloseWholeAmount(changedInput.value || 0),
    maxChangedAmount,
  );

  changedInput.value = formatDealCloseWholeAmount(changedAmount);

  const laterRows = rows.slice(changedIndex + 1);
  if (!laterRows.length) return;

  const balance = Math.max(remaining - usedBefore - changedAmount, 0);
  const perAmount = Math.floor(balance / laterRows.length);
  laterRows.forEach((row, index) => {
    const amountInput = getAmountInput(row);
    if (!amountInput) return;
    const amount =
      index === laterRows.length - 1
        ? Math.max(balance - perAmount * (laterRows.length - 1), 0)
        : perAmount;
    amountInput.value = formatDealCloseWholeAmount(amount);
  });
}

function syncTmeInstallmentScheduleFromInputs(changedInput = null) {
  rebalanceTmeInstallmentAmounts(changedInput);

  const rows = Array.from(document.querySelectorAll("#installmentList [data-tme-installment-row]"));
  tmeDealInstallmentsSchedule = rows.map((row, index) => ({
    installmentNo: index + 1,
    dueDate: row.querySelector("[data-tme-installment-date]")?.value || "",
    amount: getDealCloseWholeAmount(row.querySelector("[data-tme-installment-amount]")?.value || 0),
  }));

  const remaining = tmeDealPartPaymentRemaining > 0 ? tmeDealPartPaymentRemaining : Number(document.getElementById("dealCloseRemainingAmount")?.value || 0);
  const scheduledTotal = tmeDealInstallmentsSchedule.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const hint = document.getElementById("installmentTotalHint");
  if (hint) {
    hint.textContent = `Scheduled: Rs. ${scheduledTotal.toLocaleString("en-IN")} / Remaining: Rs. ${Number(remaining || 0).toLocaleString("en-IN")}`;
    hint.style.color = scheduledTotal === Number(remaining || 0) ? "#15803d" : "#b45309";
  }

  return tmeDealInstallmentsSchedule;
}

function openPartPaymentModal(total, paid, remaining) {
  const ppModal = document.getElementById("dealPartPaymentModal");
  if (!ppModal) return;

  tmeDealPartPaymentRemaining = Number(remaining || 0);
  document.getElementById("ppTotalAmount").textContent = `Rs. ${Number(total || 0).toLocaleString("en-IN")}`;
  document.getElementById("ppPaidAmount").textContent = `Rs. ${Number(paid || 0).toLocaleString("en-IN")}`;
  document.getElementById("ppRemainingAmount").textContent = `Rs. ${tmeDealPartPaymentRemaining.toLocaleString("en-IN")}`;

  document.getElementById("dealPartPaymentTerm").value = "";
  document.getElementById("dealPartPaymentInstallments").value = "";
  document.getElementById("dealPartPaymentPerAmount").value = "";

  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + 30);
  document.getElementById("dealPartPaymentStartDate").value = futureDate.toISOString().split("T")[0];
  document.getElementById("dealInstallmentSchedulePreview").style.display = "none";
  document.getElementById("installmentList").innerHTML = "";
  tmeDealInstallmentsSchedule = [];

  ppModal.classList.remove("hidden");
  ppModal.classList.add("show");
}

function closePartPaymentModal() {
  const ppModal = document.getElementById("dealPartPaymentModal");
  if (!ppModal) return;
  ppModal.classList.add("hidden");
  ppModal.classList.remove("show");
}

function handleDealPartPaymentModalBackdrop(event) {
  if (event?.target?.id === "dealPartPaymentModal") {
    closePartPaymentModal();
  }
}

function submitPartPayment() {
  const term = document.getElementById("dealPartPaymentTerm")?.value || "";
  const startDate = document.getElementById("dealPartPaymentStartDate")?.value || "";
  const remaining = tmeDealPartPaymentRemaining > 0 ? tmeDealPartPaymentRemaining : 0;
  const schedule = syncTmeInstallmentScheduleFromInputs();

  if (remaining > 0 && (!term || !startDate)) {
    showPopup("Part Payment", "Please select a part payment option and start date.", false);
    return;
  }

  const scheduledTotal = schedule.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const hasInvalidInstallment = schedule.some((item) => !item.dueDate || Number(item.amount || 0) <= 0);
  if (remaining > 0 && (hasInvalidInstallment || scheduledTotal !== remaining)) {
    showPopup(
      "Part Payment",
      `Installment dates are required and amounts must total Rs. ${Number(remaining).toLocaleString("en-IN")}.`,
      false,
    );
    return;
  }

  tmeDealClosePartPaymentData = {
    option: term || null,
    schedule: JSON.stringify(schedule),
  };
  closePartPaymentModal();
  saveDealClose();
}

async function openDealCloseModal(selectedLeadId = null) {
  const modal = document.getElementById("dealCloseModal");
  if (!modal) return;

  resetDealCloseSelection();
  modal.classList.remove("hidden");
  modal.classList.add("show");
  modal.setAttribute("aria-hidden", "false");

  await Promise.all([
    loadDealCloseLeadOptions(selectedLeadId),
    renderDealCloseProducts(),
  ]);

  if (selectedLeadId) {
    await selectTmeDealCloseLead(selectedLeadId);
  }
}

function closeDealCloseModal(options = {}) {
  const modal = document.getElementById("dealCloseModal");
  if (!modal) return;

  stopDealCloseDownsalePolling();
  modal.classList.remove("show");
  modal.classList.add("hidden");
  modal.setAttribute("aria-hidden", "true");
  if (!options.preservePendingDeal) {
    resetDealCloseSelection();
  }
  setDealCloseSavingState(false);
}

function handleDealCloseModalBackdrop(event) {
  if (event?.target?.id === "dealCloseModal") {
    closeDealCloseModal();
  }
}

function setDealCloseSavingState(isSaving) {
  dealCloseSubmitting = isSaving;

  const saveButton = document.getElementById("dealCloseSaveBtn");
  if (!saveButton) return;

  saveButton.disabled = isSaving;
  saveButton.textContent = isSaving ? "Saving..." : "Save Deal";
}

function getTmeDealCloseLeadSnapshot() {
  return getDealCloseLeadById(dealCloseLeadId) || {};
}

function getTmeDealCloseCompanyScope() {
  const selectedLead = getTmeDealCloseLeadSnapshot();
  return (
    normalizeLeadCompanyScope(
      selectedLead.company_scope ||
        selectedLead.companyScope ||
        currentUser?.company_scope ||
        currentUser?.company_key ||
        currentUser?.selected_company ||
        currentUser?.comp_name,
    ) || getDefaultLeadCompanyScope()
  );
}

function appendTmeDealPayloadValue(formData, key, value) {
  if (value !== null && value !== undefined) {
    formData.append(key, value);
  }
}

function buildTmeDealClosePayload({
  amountValue,
  paymentSummary,
  selectedProducts,
  salesType,
  paymentMethod,
  paymentNotes,
  chequeNumber,
  chequeDate,
  transactionId,
  bankName,
  branchName,
  renewalConfig,
}) {
  const payload = {
    action: "deal_closed",
    deal_amount: formatDealCloseWholeAmount(amountValue),
    received_amount: formatDealCloseWholeAmount(paymentSummary.received),
    remaining_amount: formatDealCloseWholeAmount(paymentSummary.remaining),
    gst_amount: formatDealCloseWholeAmount(paymentSummary.paidGst),
    total_gst_amount: formatDealCloseWholeAmount(paymentSummary.totalGst),
    remaining_gst_amount: formatDealCloseWholeAmount(paymentSummary.remainingGst),
    sales_type: salesType,
    payment_method: paymentMethod,
    payment_notes: paymentNotes,
    closed_by: currentUser?.id || "",
    received_by: currentUser?.name || "",
    payment_date: getTodayForInput(),
    products: JSON.stringify(selectedProducts),
    upsale_amount: String(dealCloseAppliedUpsaleAmount || 0),
  };

  const customParams = getTmeDealCloseCustomParams();
  Object.entries(customParams).forEach(([key, value]) => {
    payload[key] = Array.isArray(value) ? value.join(",") : value;
  });

  if (dealCloseApprovedDownsaleRequest?.id) {
    payload.downsale_approval_id = dealCloseApprovedDownsaleRequest.id;
  }
  if (chequeNumber) payload.cheque_number = chequeNumber;
  if (chequeDate) payload.cheque_date = chequeDate;
  if (transactionId) payload.transaction_id = transactionId;
  if (bankName) payload.bank_name = bankName;
  if (branchName) payload.branch_name = branchName;
  if (renewalConfig?.enabled) {
    payload.service_renewal_enabled = "1";
    payload.service_renewal_basis = renewalConfig.basis || "monthly";
    payload.service_renewal_start_date = renewalConfig.startDate || "";
  }

  return payload;
}

async function parseTmeJsonResponse(res, fallbackMessage) {
  const contentType = res.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    throw new Error(fallbackMessage || "Server returned a non-JSON response. Please restart the server.");
  }
  return res.json();
}

async function sendTmeDealOtpFlow() {
  const otpModal = document.getElementById("dealOtpModal");
  if (!otpModal) {
    await submitTmeDealCloseDataToBackend();
    return;
  }

  const otpInput = document.getElementById("dealOtpInput");
  const smsText = document.getElementById("tmeSimulatedSmsText");
  if (otpInput) otpInput.value = "";
  if (smsText) smsText.textContent = "Sending OTP to client...";

  await renderTmeDealOtpReviewContent();

  otpModal.classList.remove("hidden");
  otpModal.classList.add("show");
  otpModal.setAttribute("aria-hidden", "false");

  await triggerTmeSendOtp();
}

async function triggerTmeSendOtp() {
  const smsText = document.getElementById("tmeSimulatedSmsText");
  try {
    const res = await fetch(`${BASE_URL}/api/deal-otp/send`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ leadId: dealCloseLeadId }),
    });
    const result = await parseTmeJsonResponse(
      res,
      "Deal OTP API is not available. Please restart the server.",
    );

    if (!res.ok || !result.success) {
      throw new Error(result.message || "Failed to send OTP");
    }

    if (smsText) {
      smsText.textContent =
        `SMS to client (+91 ${result.maskedPhone}): "A transaction for Rs. ${Number(currentTmeDealClosePayload?.deal_amount || 0).toLocaleString("en-IN")} at Metrics Mart is initiated. Your OTP for confirmation is ${result.otp}."`;
    }
  } catch (err) {
    console.error("TME deal OTP send error:", err);
    if (smsText) {
      smsText.textContent = err.message || "Error sending OTP. Please click resend.";
    }
  }
}

function resendDealOtp() {
  triggerTmeSendOtp();
}

function closeDealOtpModal() {
  const otpModal = document.getElementById("dealOtpModal");
  if (!otpModal) return;
  otpModal.classList.remove("show");
  otpModal.classList.add("hidden");
  otpModal.setAttribute("aria-hidden", "true");
}

function handleDealOtpModalBackdrop(event) {
  if (event?.target?.id === "dealOtpModal") {
    closeDealOtpModal();
  }
}

function renderTmeDealProductsReview(products = []) {
  if (!products.length) {
    return `<div style="color:#64748b;">No services selected.</div>`;
  }

  return products
    .map((product) => {
      const name = product.product_name || product.name || "-";
      const price = Number(product.product_amount ?? product.price ?? product.amount ?? 0);
      return `
        <div style="display:flex; justify-content:space-between; gap:12px; margin-bottom:5px;">
          <span>${escapeTmeHtml(name)}</span>
          <span style="font-weight:600;">Rs. ${price.toLocaleString("en-IN")}</span>
        </div>
      `;
    })
    .join("");
}

function renderTmeDealScheduleReview() {
  const schedule = Array.isArray(tmeDealInstallmentsSchedule)
    ? tmeDealInstallmentsSchedule
    : [];
  if (!currentTmeDealClosePayload?.part_payment_option || !schedule.length) {
    return "";
  }

  const rows = schedule
    .map(
      (inst) => `
        <div style="display:flex; justify-content:space-between; gap:12px; font-size:12px; color:#475569; margin-bottom:3px;">
          <span>Installment #${Number(inst.installmentNo || 0)} (${escapeTmeHtml(inst.dueDate || "-")}):</span>
          <span>Rs. ${Number(inst.amount || 0).toLocaleString("en-IN")}</span>
        </div>
      `,
    )
    .join("");

  return `
    <div style="margin-top:15px; border-top:1px dashed #e2e8f0; padding-top:10px;">
      <strong style="color:#0f766e; font-size:12px; display:block; margin-bottom:5px; text-transform:uppercase;">
        Installment Schedule (${escapeTmeHtml(currentTmeDealClosePayload.part_payment_option)})
      </strong>
      ${rows}
    </div>
  `;
}

function renderTmeDealRenewalReview() {
  if (!currentTmeDealClosePayload?.service_renewal_enabled) return "";

  const renewalProducts = getTmeDealCloseRenewalProducts(currentTmeDealCloseProducts);
  if (!renewalProducts.length) return "";

  const basis = currentTmeDealClosePayload.service_renewal_basis || "monthly";
  const startDate = currentTmeDealClosePayload.service_renewal_start_date || "";
  const rows = renewalProducts
    .map((product) => {
      const amount = Number(product.amount ?? product.price ?? product.standardAmount ?? 0);
      return `
        <div style="display:flex; justify-content:space-between; gap:12px; font-size:12px; color:#475569; margin-bottom:3px;">
          <span>${escapeTmeHtml(product.name || "-")} (${escapeTmeHtml(startDate || "-")}):</span>
          <span>Rs. ${amount.toLocaleString("en-IN")}</span>
        </div>
      `;
    })
    .join("");

  return `
    <div style="margin-top:15px; border-top:1px dashed #e2e8f0; padding-top:10px;">
      <strong style="color:#1d4ed8; font-size:12px; display:block; margin-bottom:5px; text-transform:uppercase;">
        Service Renewal (${escapeTmeHtml(TME_DEAL_RENEWAL_BASIS_LABELS[basis] || basis)})
      </strong>
      ${rows}
    </div>
  `;
}

async function renderTmeDealOtpReviewContent() {
  const container = document.getElementById("dealOtpReviewContent");
  if (!container || !currentTmeDealClosePayload) return;

  let lead = getTmeDealCloseLeadSnapshot();
  if (!lead?.id && dealCloseLeadId) {
    try {
      const leadRes = await fetch(`${BASE_URL}/api/leads/${dealCloseLeadId}`, {
        cache: "no-store",
      });
      const leadResult = await parseTmeJsonResponse(leadRes, "Unable to load lead details.");
      lead = leadResult.success ? leadResult.data || {} : {};
    } catch (err) {
      console.warn("TME deal OTP lead details fallback:", err);
    }
  }

  container.innerHTML = `
    <div style="margin-bottom:12px; border-bottom:1px solid #e2e8f0; padding-bottom:8px;">
      <h3 style="margin:0 0 4px 0; color:#0f172a; font-size:16px;">${escapeTmeHtml(lead?.company_name || "Company")}</h3>
      <p style="margin:0; color:#64748b; font-size:12px;">
        Client: ${escapeTmeHtml(lead?.client_name || "N/A")} | Phone: ${escapeTmeHtml(lead?.telephone || lead?.contact || "N/A")}
      </p>
    </div>
    <div style="margin-bottom:12px;">
      <strong style="font-size:12px; color:#64748b; display:block; margin-bottom:5px; text-transform:uppercase;">Selected Services</strong>
      ${renderTmeDealProductsReview(currentTmeDealCloseProducts)}
    </div>
    <div style="border-top:1px dashed #e2e8f0; padding-top:10px; display:grid; grid-template-columns:1fr 1fr; gap:10px; font-size:13px;">
      <div>Total Deal Value: <strong>Rs. ${Number(currentTmeDealClosePayload.deal_amount || 0).toLocaleString("en-IN")}</strong></div>
      <div>Down Payment: <strong style="color:#16a34a;">Rs. ${Number(currentTmeDealClosePayload.received_amount || 0).toLocaleString("en-IN")}</strong></div>
      <div>Remaining Balance: <strong style="color:#dc2626;">Rs. ${Number(currentTmeDealClosePayload.remaining_amount || 0).toLocaleString("en-IN")}</strong></div>
      <div>Total GST (18%): <strong>Rs. ${Number(currentTmeDealClosePayload.total_gst_amount || 0).toLocaleString("en-IN")}</strong></div>
      <div>Paid GST (on Down Payment): <strong style="color:#0369a1;">Rs. ${Number(currentTmeDealClosePayload.gst_amount || 0).toLocaleString("en-IN")}</strong></div>
      <div>Remaining GST: <strong style="color:#b45309;">Rs. ${Number(currentTmeDealClosePayload.remaining_gst_amount || 0).toLocaleString("en-IN")}</strong></div>
    </div>
    ${renderTmeDealScheduleReview()}
    ${renderTmeDealRenewalReview()}
  `;
}

async function verifyDealOtp() {
  const otpInput = document.getElementById("dealOtpInput")?.value?.trim() || "";
  if (otpInput.length !== 6 || Number.isNaN(Number(otpInput))) {
    showPopup("OTP", "Please enter a valid 6-digit OTP.", false);
    return;
  }

  try {
    const res = await fetch(`${BASE_URL}/api/deal-otp/verify`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ leadId: dealCloseLeadId, otp: otpInput }),
    });
    const result = await parseTmeJsonResponse(
      res,
      "Deal OTP API is not available. Please restart the server.",
    );

    if (!res.ok || !result.success) {
      throw new Error(result.message || "OTP verification failed.");
    }

    closeDealOtpModal();
    await submitTmeDealCloseDataToBackend();
  } catch (err) {
    console.error("TME deal OTP verify error:", err);
    showPopup("OTP Error", err.message || "Error verifying OTP.", false);
  }
}

async function submitTmeDealCloseDataToBackend() {
  if (!dealCloseLeadId || !currentTmeDealClosePayload) {
    showPopup("Deal Missing", "Deal details are missing. Please reopen deal close.", false);
    return;
  }

  setDealCloseSavingState(true);

  try {
    const formData = new FormData();
    Object.entries(currentTmeDealClosePayload).forEach(([key, value]) => {
      appendTmeDealPayloadValue(formData, key, value);
    });

    const res = await fetch(`${BASE_URL}/api/leads/${dealCloseLeadId}/action`, {
      method: "PUT",
      body: formData,
    });
    const result = await parseTmeJsonResponse(res, "Unable to save deal.");

    if (!res.ok || !result.success) {
      throw new Error(result.error || result.message || "Unable to close deal");
    }

    await showTmeDealAckOverlay();
  } catch (err) {
    console.error("TME deal close save error:", err);
    showPopup("Save Error", err.message || "Unable to close deal", false);
  } finally {
    setDealCloseSavingState(false);
  }
}

async function showTmeDealAckOverlay() {
  const overlay = document.getElementById("dealAckOverlay");
  if (!overlay || !currentTmeDealClosePayload) return;

  let lead = getTmeDealCloseLeadSnapshot();
  try {
    const leadRes = await fetch(`${BASE_URL}/api/leads/${dealCloseLeadId}`, {
      cache: "no-store",
    });
    const leadResult = await parseTmeJsonResponse(leadRes, "Unable to refresh lead details.");
    if (leadResult.success && leadResult.data) {
      lead = leadResult.data;
    }
  } catch (err) {
    console.warn("TME deal acknowledgement lead fallback:", err);
  }

  const acknowledgementCompanyScope =
    normalizeLeadCompanyScope(
      lead?.company_scope ||
        lead?.companyScope ||
        currentTmeDealClosePayload.company_scope ||
        currentTmeDealClosePayload.companyScope ||
        currentUser?.company_scope ||
        currentUser?.company_key ||
        currentUser?.selected_company ||
        currentUser?.comp_name,
    ) || getTmeDealCloseCompanyScope();
  updateTmeDealAcknowledgementHeaderImage(
    overlay,
    acknowledgementCompanyScope,
  );

  const address = [
    lead?.flat_no,
    lead?.building_name,
    lead?.locality,
    lead?.city,
    lead?.pincode,
    lead?.state,
  ]
    .map((value) => String(value || "").trim())
    .filter(Boolean)
    .join(", ");

  const setText = (id, value) => {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  };

  setText("ackCompany", lead?.company_name || "N/A");
  setText("ackClient", lead?.client_name || "N/A");
  setText("ackPhone", lead?.telephone || lead?.contact || "N/A");
  setText("ackEmail", lead?.email || "N/A");
  setText("ackAddress", address || "N/A");
  setText("ackDate", new Date().toLocaleString());
  setText("ackTotal", `Rs. ${Number(currentTmeDealClosePayload.deal_amount || 0).toLocaleString("en-IN")}`);
  setText("ackPaid", `Rs. ${Number(currentTmeDealClosePayload.received_amount || 0).toLocaleString("en-IN")}`);
  setText("ackMethod", currentTmeDealClosePayload.payment_method || "N/A");
  setText("ackGst", `Rs. ${Number(currentTmeDealClosePayload.total_gst_amount || 0).toLocaleString("en-IN")}`);
  setText("ackPaidGst", `Rs. ${Number(currentTmeDealClosePayload.gst_amount || 0).toLocaleString("en-IN")}`);
  setText("ackRemainingGst", `Rs. ${Number(currentTmeDealClosePayload.remaining_gst_amount || 0).toLocaleString("en-IN")}`);

  const productsTbody = document.getElementById("ackProductsList");
  if (productsTbody) {
    productsTbody.innerHTML = "";
    currentTmeDealCloseProducts.forEach((product) => {
      const tr = document.createElement("tr");
      const name = product.product_name || product.name || "-";
      const desc = TME_DC_SERVICE_DESCRIPTIONS[name] || "";
      const price = Number(product.product_amount ?? product.price ?? product.amount ?? 0);
      tr.innerHTML = `
        <td>
          <span style="font-weight:600;">${escapeTmeHtml(name)}</span>
          ${desc ? `<br><span style="font-size:11px; color:#64748b; font-style:italic;">${escapeTmeHtml(desc)}</span>` : ""}
        </td>
        <td style="text-align:right; font-weight:600;">Rs. ${price.toLocaleString("en-IN")}</td>
      `;
      productsTbody.appendChild(tr);
    });
  }

  const scheduleSection = document.getElementById("ackScheduleSection");
  const scheduleTbody = document.getElementById("ackScheduleList");
  if (
    scheduleSection &&
    scheduleTbody &&
    currentTmeDealClosePayload.part_payment_option &&
    tmeDealInstallmentsSchedule.length
  ) {
    scheduleSection.style.display = "block";
    setText("ackOptionLabel", currentTmeDealClosePayload.part_payment_option);
    scheduleTbody.innerHTML = "";
    tmeDealInstallmentsSchedule.forEach((inst) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>Installment #${Number(inst.installmentNo || 0)}</td>
        <td>${escapeTmeHtml(inst.dueDate || "-")}</td>
        <td style="text-align:right; font-weight:600;">Rs. ${Number(inst.amount || 0).toLocaleString("en-IN")}</td>
      `;
      scheduleTbody.appendChild(tr);
    });
  } else if (scheduleSection) {
    scheduleSection.style.display = "none";
  }

  const renewalSection = document.getElementById("ackRenewalSection");
  const renewalTbody = document.getElementById("ackRenewalList");
  const renewalProducts = currentTmeDealClosePayload.service_renewal_enabled
    ? getTmeDealCloseRenewalProducts(currentTmeDealCloseProducts)
    : [];
  if (renewalSection && renewalTbody && renewalProducts.length) {
    const basis = currentTmeDealClosePayload.service_renewal_basis || "monthly";
    const startDate = currentTmeDealClosePayload.service_renewal_start_date || "";
    renewalSection.style.display = "block";
    setText(
      "ackRenewalBasis",
      TME_DEAL_RENEWAL_BASIS_LABELS[basis] || basis,
    );
    renewalTbody.innerHTML = "";
    renewalProducts.forEach((product) => {
      const amount = Number(product.amount ?? product.price ?? product.standardAmount ?? 0);
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${escapeTmeHtml(product.name || "-")}</td>
        <td>${escapeTmeHtml(startDate || "-")}</td>
        <td style="text-align:right; font-weight:600;">Rs. ${amount.toLocaleString("en-IN")}</td>
      `;
      renewalTbody.appendChild(tr);
    });
  } else if (renewalSection) {
    renewalSection.style.display = "none";
  }

  overlay.classList.remove("hidden");
}

function updateTmeDealAcknowledgementHeaderImage(overlay, companyScope = "") {
  const image = overlay?.querySelector(".deal-ack-logo img");
  if (!image) return;

  const isRedsea = normalizeLeadCompanyScope(companyScope) === "redsea";
  image.src = isRedsea ? "acknowledge_redsea_img.png" : "acknowledge_img.png";
  image.alt = isRedsea ? "RED SEA DIGITALS" : "METRICS MART";
}

function finalizeTmeDealClose() {
  const overlay = document.getElementById("dealAckOverlay");
  if (overlay) {
    overlay.classList.add("hidden");
    overlay.removeAttribute("data-view-only");
  }

  showPopup("Deal Closed", "Deal closed successfully.", true);
  loadDeals();
  loadLeads();
  loadAppointments();
  loadFollowedUp();
  loadTmeDashboard();
  resetDealCloseSelection();
}

function closeTmeDealAckView() {
  const overlay = document.getElementById("dealAckOverlay");
  if (overlay) {
    overlay.classList.add("hidden");
    overlay.removeAttribute("data-view-only");
  }
}

async function openTmeDealAckViewModal(dealId) {
  const overlay = document.getElementById("dealAckOverlay");
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

    const companyScope = normalizeLeadCompanyScope(lead.company_scope || lead.companyScope || currentUser?.company_scope || currentUser?.company_key) || getTmeDealCloseCompanyScope();
    updateTmeDealAcknowledgementHeaderImage(overlay, companyScope);

    const address = [
      lead.flat_no, lead.building_name, lead.locality,
      lead.city, lead.pincode, lead.state,
    ].map((v) => String(v || "").trim()).filter(Boolean).join(", ");

    const setText = (id, value) => {
      const el = document.getElementById(id);
      if (el) el.textContent = value;
    };

    setText("ackCompany", lead.company_name || "N/A");
    setText("ackClient", lead.client_name || "N/A");
    setText("ackPhone", lead.telephone || lead.contact || "N/A");
    setText("ackEmail", lead.email || "N/A");
    setText("ackAddress", address || "N/A");
    
    const closeDate = new Date(lead.closed_date || lead.updated_at);
    setText("ackDate", isNaN(closeDate) ? (lead.closed_date || "N/A") : closeDate.toLocaleString());
    
    setText("ackTotal", `Rs. ${Number(deal.deal_amount || lead.deal_amount || 0).toLocaleString("en-IN")}`);
    setText("ackPaid", `Rs. ${Number(deal.received_amount || lead.received_amount || 0).toLocaleString("en-IN")}`);
    setText("ackMethod", deal.payment_method || lead.payment_method || "N/A");
    
    const dealAmount = Number(deal.deal_amount || lead.deal_amount || 0);
    const receivedAmount = Number(deal.received_amount || lead.received_amount || 0);
    const totalGst = dealAmount - (dealAmount / 1.18);
    const paidGst = receivedAmount - (receivedAmount / 1.18);
    const remainingGst = totalGst - paidGst;

    setText("ackGst", `Rs. ${totalGst.toLocaleString("en-IN", {maximumFractionDigits: 2})}`);
    setText("ackPaidGst", `Rs. ${paidGst.toLocaleString("en-IN", {maximumFractionDigits: 2})}`);
    setText("ackRemainingGst", `Rs. ${Math.max(0, remainingGst).toLocaleString("en-IN", {maximumFractionDigits: 2})}`);

    const productsTbody = document.getElementById("ackProductsList");
    if (productsTbody) {
      productsTbody.innerHTML = "";
      if (products.length === 0) {
        productsTbody.innerHTML = `<tr><td colspan="2" style="text-align: center; color: #64748b;">No products found</td></tr>`;
      } else {
        products.forEach((product) => {
          const tr = document.createElement("tr");
          const name = product.product_name || product.name || "-";
          const desc = TME_DC_SERVICE_DESCRIPTIONS[name] || "";
          const price = Number(product.product_amount ?? product.price ?? product.amount ?? 0);
          tr.innerHTML = `
            <td>
              <span style="font-weight:600;">${escapeTmeHtml(name)}</span>
              ${desc ? `<br><span style="font-size:11px; color:#64748b; font-style:italic;">${escapeTmeHtml(desc)}</span>` : ""}
            </td>
            <td style="text-align:right; font-weight:600;">Rs. ${price.toLocaleString("en-IN")}</td>
          `;
          productsTbody.appendChild(tr);
        });
      }
    }

    const scheduleSection = document.getElementById("ackScheduleSection");
    const scheduleTbody = document.getElementById("ackScheduleList");
    if (scheduleSection && scheduleTbody) {
      if (installments && installments.length > 0 && (deal.part_payment_option || lead.part_payment_option)) {
        scheduleSection.style.display = "block";
        setText("ackOptionLabel", deal.part_payment_option || lead.part_payment_option);
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

    const renewalSection = document.getElementById("ackRenewalSection");
    const renewalTbody = document.getElementById("ackRenewalList");
    if (renewalSection && renewalTbody) {
      if (renewals && renewals.length > 0) {
        renewalSection.style.display = "block";
        setText("ackRenewalBasis", renewals[0].basis || "Custom");
        renewalTbody.innerHTML = "";
        renewals.forEach((renewal) => {
          const tr = document.createElement("tr");
          tr.innerHTML = `
            <td>${escapeTmeHtml(renewal.service || "-")}</td>
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

async function saveDealClose() {
  if (dealCloseSubmitting) return;

  const selectedLead = getDealCloseLeadById(dealCloseLeadId);
  const selectedProducts = getSelectedDealCloseProducts();
  const latestTotal = selectedProducts.length ? await updateDealCloseAmount() : 0;
  const amountValue = Number(
    latestTotal || document.getElementById("dealCloseAmount")?.value || 0,
  );
  const paymentSummary = syncDealClosePaymentSummary();
  const salesType =
    document.getElementById("dealCloseSalesType")?.value || "fresh";
  const paymentMethod =
    document.getElementById("dealClosePaymentMethod")?.value || "";
  const paymentNotes =
    document.getElementById("dealCloseNotes")?.value?.trim() || "";
  const chequeNumber =
    document.getElementById("dealCloseChequeNo")?.value?.trim() || "";
  const chequeDate =
    document.getElementById("dealCloseChequeDate")?.value || "";
  const transactionId =
    document.getElementById("dealCloseTxnId")?.value?.trim() || "";
  const bankName =
    document.getElementById("dealCloseBankName")?.value?.trim() || "";
  const branchName =
    document.getElementById("dealCloseBranchName")?.value?.trim() || "";

  if (!selectedLead) {
    showPopup("Lead Missing", "Please select a lead first.", false);
    return;
  }

  if (!selectedProducts.length) {
    showPopup("Products Missing", "Please select at least one product.", false);
    return;
  }

  if (!amountValue || amountValue <= 0) {
    showPopup("Amount Missing", "Total amount must be greater than 0.", false);
    return;
  }

  if (
    paymentSummary.received < 0 ||
    paymentSummary.received > amountValue
  ) {
    showPopup(
      "Down Payment",
      "Down payment must be between 0 and total amount.",
      false,
    );
    return;
  }

  if (paymentSummary.received <= 0) {
    showPopup("Down Payment", "Please enter down payment amount.", false);
    return;
  }

  if (!paymentMethod) {
    showPopup("Payment Missing", "Please select a payment method.", false);
    return;
  }

  if (
    paymentMethod === "Cheque" &&
    (!chequeNumber || !chequeDate || !bankName)
  ) {
    showPopup(
      "Cheque Details",
      "Cheque number, cheque date, and bank name are required.",
      false,
    );
    return;
  }

  if (paymentMethod === "UPI / Net Banking" && (!transactionId || !bankName)) {
    showPopup(
      "Transaction Details",
      "Transaction ID and bank name are required.",
      false,
    );
    return;
  }

  const dealProductsForPayload = currentTmeDealCloseProducts.length
    ? currentTmeDealCloseProducts
    : selectedProducts;
  const renewalConfig = getTmeDealCloseRenewalConfig(dealProductsForPayload);
  if (renewalConfig.enabled && !renewalConfig.services.length) {
    showPopup(
      "Service Renewal",
      "Please select at least one renewable service for renewal.",
      false,
    );
    return;
  }
  if (renewalConfig.enabled && !renewalConfig.startDate) {
    showPopup("Service Renewal", "Please select first renewal date.", false);
    return;
  }

  currentTmeDealClosePayload = buildTmeDealClosePayload({
    amountValue,
    paymentSummary,
    selectedProducts,
    salesType,
    paymentMethod,
    paymentNotes,
    chequeNumber,
    chequeDate,
    transactionId,
    bankName,
    branchName,
    renewalConfig,
  });
  currentTmeDealCloseProducts = dealProductsForPayload;

  if (paymentSummary.remaining > 0 && !tmeDealClosePartPaymentData) {
    openPartPaymentModal(
      amountValue,
      paymentSummary.received,
      paymentSummary.remaining,
    );
    return;
  }

  if (paymentSummary.remaining <= 0) {
    tmeDealClosePartPaymentData = null;
    currentTmeDealClosePayload.part_payment_option = null;
    currentTmeDealClosePayload.part_payment_schedule = null;
  } else if (tmeDealClosePartPaymentData) {
    currentTmeDealClosePayload.part_payment_option =
      tmeDealClosePartPaymentData.option || null;
    currentTmeDealClosePayload.part_payment_schedule =
      tmeDealClosePartPaymentData.schedule || null;
  }

  closeDealCloseModal({ preservePendingDeal: true });
  await sendTmeDealOtpFlow();
}

function setDashboardText(id, value) {
  const element = document.getElementById(id);
  if (element) element.textContent = value;
}

function setDashboardMetricLabel(valueId, label) {
  const valueElement = document.getElementById(valueId);
  const labelElement = valueElement?.parentElement?.querySelector("span");
  if (labelElement) labelElement.textContent = label;
}

function formatDashboardMoney(value) {
  const amount = Number(value || 0);
  return `Rs. ${amount.toLocaleString("en-IN", {
    maximumFractionDigits: 0,
  })}`;
}

function formatDashboardCount(value, singularLabel, pluralLabel) {
  const count = normalizeDashboardNumber(value);
  const label = count === 1 ? singularLabel : pluralLabel;
  return `${count} ${label}`;
}

function getAppointmentStageMeta(stage) {
  switch (
    String(stage || "")
      .toLowerCase()
      .trim()
  ) {
    case "confirmed":
      return { label: "Confirmed", className: "confirmed" };
    case "not_confirmed":
      return { label: "Not Confirmed", className: "not_confirmed" };
    case "not_interested":
      return { label: "Not Interested", className: "not_interested" };
    case "deal_closed":
      return { label: "Deal Closed", className: "deal_closed" };
    default:
      return { label: "Generated", className: "generated" };
  }
}

function getAppointmentLifecycleStage(lead) {
  const leadStatus = String(lead?.lead_status || "")
    .toLowerCase()
    .trim();
  const appointmentStatus = String(lead?.appointment_status || "")
    .toLowerCase()
    .trim()
    .replace(/[\s-]+/g, "_");

  if (leadStatus === "deal_closed") return "deal_closed";
  if (leadStatus === "not_interested" || appointmentStatus === "not_interested") {
    return "not_interested";
  }

  const apiStage = String(lead?.appointment_stage || "")
    .toLowerCase()
    .trim();
  if (apiStage) return apiStage;

  if (appointmentStatus === "confirmed" || leadStatus === "followup") {
    return "confirmed";
  }
  if (
    appointmentStatus === "not_confirmed" ||
    leadStatus === "not_interested"
  ) {
    return "not_confirmed";
  }
  return "generated";
}

function isTmeAppointmentPipelineRow(lead) {
  return getAppointmentLifecycleStage(lead) !== "deal_closed";
}

function summarizeAppointmentHistory(rows = []) {
  return rows.reduce(
    (summary, lead) => {
      const stage = getAppointmentLifecycleStage(lead);
      summary.totalGenerated += 1;

      if (stage === "confirmed") {
        summary.confirmed += 1;
      } else if (stage === "not_confirmed") {
        summary.notConfirmed += 1;
      } else if (stage === "not_interested") {
        summary.notInterested += 1;
      }

      return summary;
    },
    {
      totalGenerated: 0,
      confirmed: 0,
      notConfirmed: 0,
      notInterested: 0,
    },
  );
}

function getDealIdentityKey(deal) {
  const parts = [
    deal?.email,
    deal?.contact,
    deal?.client_name,
    deal?.company_name,
  ]
    .map((value) =>
      String(value || "")
        .trim()
        .toLowerCase(),
    )
    .filter(Boolean);

  return parts.join("|") || `deal-${deal?.id || Math.random()}`;
}

function summarizeDealMix(deals = [], monthKey = "") {
  const seenClients = new Set();
  const orderedDeals = [...deals].sort((left, right) => {
    const leftDate = new Date(left?.closed_date || 0).getTime();
    const rightDate = new Date(right?.closed_date || 0).getTime();

    if (leftDate !== rightDate) {
      return leftDate - rightDate;
    }

    return Number(left?.id || 0) - Number(right?.id || 0);
  });

  return orderedDeals.reduce(
    (summary, deal) => {
      const amount = getDealDashboardReceivedAmount(deal, monthKey);
      const key = getDealIdentityKey(deal);
      const salesTypeForMonth = monthKey
        ? getDealSalesTypeValue(deal, monthKey)
        : "";
      const explicitSalesType = String(
        deal?.sales_type || deal?.salesType || "",
      )
        .toLowerCase()
        .trim();
      const renewalPayments = getTmeReceivedRenewalPayments(deal, monthKey);
      const isClosedRenewalSale =
        salesTypeForMonth === "renewal" ||
        explicitSalesType === "renewal" ||
        (!explicitSalesType && seenClients.has(key));
      const renewalActivityCount =
        renewalPayments.length || (isClosedRenewalSale ? 1 : 0);

      if (isClosedRenewalSale) {
        summary.renewalAmount += amount;
      } else {
        summary.newSaleCount += 1;
        summary.newSaleAmount += amount;
        seenClients.add(key);
      }

      summary.renewalCount += renewalActivityCount;

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

function renderAppointmentStatusSummary(summary = {}) {
  const totalGenerated = normalizeDashboardNumber(summary.totalGenerated);
  const confirmed = normalizeDashboardNumber(summary.confirmed);
  const notConfirmed = normalizeDashboardNumber(summary.notConfirmed);
  const notInterested = normalizeDashboardNumber(summary.notInterested);

  setDashboardText("tmeAppointmentsGenerated", totalGenerated);
  setDashboardText("tmeAppointmentsConfirmed", confirmed);
  setDashboardText("tmeAppointmentsNotConfirmed", notConfirmed);
  setDashboardText("tmeAppointmentsNotInterested", notInterested);
  setDashboardText(
    "tmeAppointmentStatusHint",
    totalGenerated
      ? `${totalGenerated} tracked meetings in appointment pipeline`
      : "No appointment history yet",
  );
  setDashboardText(
    "tmeAppointmentsGeneratedHint",
    totalGenerated
      ? formatDashboardCount(
          totalGenerated,
          "meeting generated",
          "meetings generated",
        )
      : "All appointment requests",
  );
  setDashboardText(
    "tmeAppointmentsConfirmedHint",
    confirmed
      ? formatDashboardCount(
          confirmed,
          "meeting confirmed",
          "meetings confirmed",
        )
      : "Client confirmed meetings",
  );
  setDashboardText(
    "tmeAppointmentsNotConfirmedHint",
    notConfirmed
      ? formatDashboardCount(
          notConfirmed,
          "meeting pending",
          "meetings pending",
        )
      : "Needs another push",
  );
  setDashboardText(
    "tmeAppointmentsNotInterestedHint",
    notInterested
      ? formatDashboardCount(notInterested, "client declined", "clients declined")
      : "Client declined meetings",
  );
}

function renderAppointmentStatusChart(summary = {}) {
  const canvas = document.getElementById("tmeAppointmentStatusChart");
  if (!canvas?.getContext) return;

  const values = [
    normalizeDashboardNumber(summary.totalGenerated),
    normalizeDashboardNumber(summary.confirmed),
    normalizeDashboardNumber(summary.notConfirmed),
    normalizeDashboardNumber(summary.notInterested),
  ];

  if (appointmentStatusChart) {
    appointmentStatusChart.destroy();
  }

  appointmentStatusChart = new Chart(canvas.getContext("2d"), {
    type: "doughnut",
    data: {
      labels: [
        "Total Generated Meetings",
        "Confirmed Meetings",
        "Not Confirmed",
        "Not Interested",
      ],
      datasets: [
        {
          data: values,
          backgroundColor: ["#0f766e", "#22c55e", "#f59e0b", "#3b82f6"],
          borderColor: "#ffffff",
          borderWidth: 4,
          hoverOffset: 6,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: "66%",
      plugins: {
        legend: {
          position: "bottom",
          labels: {
            usePointStyle: true,
            pointStyle: "circle",
            padding: 16,
          },
        },
      },
    },
  });
}

function updateTmeTargetProgressInsights(target, achieved, remaining) {
  const dealsCount = normalizeDashboardNumber(
    tmeDashboardState.counts?.deals ?? tmeDashboardState.deals?.length,
  );
  const salesMix = tmeDashboardState.salesMix || {};
  const achievedPercent =
    target > 0 ? Math.min((achieved / target) * 100, 100).toFixed(1) : "0.0";

  setDashboardText(
    "tmeTargetHeroValue",
    `${formatDashboardMoney(achieved)} without GST achieved`,
  );

  let heroText =
    "Start closing deals to build momentum for your monthly target.";
  if (target > 0 && achieved > 0) {
    heroText =
      remaining === 0 && achieved >= target
        ? `Target completed. You are now ahead by ${formatDashboardMoney(Math.max(achieved - target, 0))}.`
        : `${formatDashboardMoney(remaining)} left to reach ${formatDashboardMoney(target)} this month.`;
  } else if (target > 0) {
    heroText = `Your current monthly goal is ${formatDashboardMoney(target)}. Close the first deal to get this ring moving.`;
  }

  setDashboardText("tmeTargetHeroText", heroText);
  setDashboardText("tmeTargetInsightAchieved", formatDashboardMoney(achieved));
  setDashboardText(
    "tmeTargetInsightAchievedHint",
    `${achievedPercent}% completed without GST`,
  );
  setDashboardText(
    "tmeTargetInsightRemaining",
    formatDashboardMoney(remaining),
  );
  setDashboardText(
    "tmeTargetInsightRemainingHint",
    remaining === 0 && achieved >= target
      ? "Monthly target completed"
      : "Still left to hit target",
  );
  setDashboardText("tmeTargetInsightDeals", String(dealsCount));
  setDashboardText(
    "tmeTargetInsightDealsHint",
    dealsCount
      ? formatDashboardCount(dealsCount, "closed deal", "closed deals")
      : "No closed deals yet",
  );
  setDashboardText(
    "tmeTargetInsightNewSale",
    String(normalizeDashboardNumber(salesMix.newSaleCount)),
  );
  setDashboardText(
    "tmeTargetInsightNewSaleHint",
    salesMix.newSaleCount
      ? `${formatDashboardMoney(salesMix.newSaleAmount)} from new sales`
      : "Fresh client wins",
  );
  setDashboardText(
    "tmeTargetInsightRenewal",
    String(normalizeDashboardNumber(salesMix.renewalCount)),
  );
  setDashboardText(
    "tmeTargetInsightRenewalHint",
    salesMix.renewalCount
      ? salesMix.renewalAmount
        ? `${formatDashboardMoney(salesMix.renewalAmount)} closed renewal value`
        : "Renewal activity started"
      : "Repeat client wins",
  );
}

function isCommissionSalesSummary(data = {}) {
  return (
    data.isCommissionProfile === true ||
    String(data.compensationType || "").toLowerCase() === "commission"
  );
}

function applyTmeCommissionSummary(prefix, data = {}) {
  const achieved = Number(data.achieved || 0);
  const commissionPercent = Number(
    data.commissionPercent || FIXED_SALES_COMMISSION_PERCENT,
  );
  const commissionAmount = Number(
    data.commissionAmount ?? (achieved * commissionPercent) / 100,
  );

  currentMonthlyTarget = 0;
  const headerTitle = document.querySelector(
    "#dashboard .sales-target-header h3",
  );
  const headerNote = document.querySelector(
    "#dashboard .sales-target-header p",
  );
  const targetButton = document.querySelector(
    "#dashboard .sales-target-header .target-set-btn",
  );
  if (headerTitle) headerTitle.textContent = "Sales Commission";
  if (headerNote)
    headerNote.textContent =
      "Flat commission on closed sales. No monthly target or target incentive.";
  if (targetButton) {
    targetButton.title = "Commission is fixed at 10%";
    targetButton.innerHTML = '<i class="fas fa-percent"></i> Fixed 10%';
  }
  setDashboardMetricLabel(`${prefix}TargetSet`, "Commission Rate");
  setDashboardMetricLabel(`${prefix}TargetAchieved`, "Sales Closed");
  setDashboardMetricLabel(`${prefix}TargetRemaining`, "Commission");
  setDashboardText(`${prefix}TargetSet`, `${commissionPercent.toFixed(0)}%`);
  setDashboardText(`${prefix}TargetSetHint`, "Flat on closed sales");
  setDashboardText(`${prefix}TargetAchieved`, formatDashboardMoney(achieved));
  setDashboardText(
    `${prefix}TargetRemaining`,
    formatDashboardMoney(commissionAmount),
  );
  setDashboardText(`${prefix}TargetAchievedHint`, "No monthly target");
  setDashboardText(
    `${prefix}TargetRemainingHint`,
    "Auto-calculated commission",
  );

  if (prefix === "tme") {
    setDashboardText(
      "tmeTargetProgressLabel",
      `${commissionPercent.toFixed(0)}% commission`,
    );
    setDashboardMetricLabel("tmeTargetInsightAchieved", "Sales Closed");
    setDashboardMetricLabel("tmeTargetInsightRemaining", "Commission");
    updateTmeTargetProgressInsights(0, achieved, 0);
    setDashboardText(
      "tmeTargetHeroValue",
      `${formatDashboardMoney(commissionAmount)} commission`,
    );
    setDashboardText(
      "tmeTargetHeroText",
      achieved > 0
        ? `${formatDashboardMoney(achieved)} closed sales par ${commissionPercent.toFixed(0)}% commission.`
        : "Commission profile par monthly target nahi hai. Closed sales par flat 10% commission milega.",
    );
    setDashboardText(
      "tmeTargetInsightAchieved",
      formatDashboardMoney(achieved),
    );
    setDashboardText("tmeTargetInsightAchievedHint", "Commissionable sales");
    setDashboardText(
      "tmeTargetInsightRemaining",
      formatDashboardMoney(commissionAmount),
    );
    setDashboardText("tmeTargetInsightRemainingHint", "Estimated payout");
    renderTargetProgressChart(achieved || 1, commissionAmount, {
      centerValueText: `${commissionPercent.toFixed(0)}%`,
      centerSubtext: "commission",
      labels: ["Commission", "Sales Balance"],
      data:
        achieved > 0
          ? [
              Math.max(commissionAmount, 0),
              Math.max(achieved - commissionAmount, 0),
            ]
          : [0, 1],
    });
  }
}

function applySalesTargetSummary(prefix, data = {}) {
  const targetValue = Number(data.target ?? MONTHLY_TARGET);
  const hasValidTarget = Number.isFinite(targetValue) && targetValue > 0;
  const target = hasValidTarget ? targetValue : MONTHLY_TARGET;
  const achieved = Number(data.achieved || 0);
  const paidWithoutGst = Number(data.paidWithoutGst || 0);
  const targetAchieved = Number(
    data.targetAchieved ?? data.targetBasisAmount ?? paidWithoutGst,
  );
  const serverRemaining = Number(data.remaining);
  const remaining =
    hasValidTarget && Number.isFinite(serverRemaining)
      ? Math.max(serverRemaining, 0)
      : Math.max(target - targetAchieved, 0);
  const targetText = formatDashboardMoney(target);
  currentMonthlyTarget = target;
  const achievedPercent =
    target > 0
      ? Math.min((targetAchieved / target) * 100, 100).toFixed(1)
      : "0.0";
  const targetSource = String(data.targetSource || "").toLowerCase();
  const salaryBasis = Number(data.targetBasis?.salary ?? data.salary ?? 0);
  const targetMultiplier = Number(data.targetBasis?.multiplier || 7);
  const isSalaryTarget = targetSource === "salary_7x" && salaryBasis > 0;

  setDashboardMetricLabel(`${prefix}TargetSet`, "Target Set");
  setDashboardMetricLabel(`${prefix}TargetAchieved`, "Total Received Payment");
  setDashboardMetricLabel(`${prefix}TargetRemaining`, "Remaining Target");
  setDashboardMetricLabel("tmeTargetInsightAchieved", "Without GST Achieved");
  setDashboardMetricLabel("tmeTargetInsightRemaining", "Remaining");
  const headerTitle = document.querySelector(
    "#dashboard .sales-target-header h3",
  );
  const headerNote = document.querySelector(
    "#dashboard .sales-target-header p",
  );
  const targetButton = document.querySelector(
    "#dashboard .sales-target-header .target-set-btn",
  );
  if (headerTitle) headerTitle.textContent = "Monthly Sales Target";
  if (headerNote)
    headerNote.textContent =
      "Salary-based monthly goal with live without-GST progress.";
  if (targetButton) {
    targetButton.title = isSalaryTarget
      ? "Target is salary multiplied by 7"
      : "Monthly target is calculated automatically";
    targetButton.innerHTML =
      '<i class="fas fa-calculator"></i> Salary x 7';
  }
  setDashboardText(`${prefix}TargetSet`, formatDashboardMoney(target));
  setDashboardText(
    `${prefix}TargetSetHint`,
    isSalaryTarget
      ? `${formatDashboardMoney(salaryBasis)} salary x ${targetMultiplier}`
      : "Current monthly goal",
  );

  setDashboardText(`${prefix}TargetAchieved`, formatDashboardMoney(achieved));
  setDashboardText(`${prefix}TargetRemaining`, formatDashboardMoney(remaining));
  setDashboardText(
    `${prefix}TargetAchievedHint`,
    `${achievedPercent}% with GST`,
  );
  setDashboardText(
    `${prefix}TargetRemainingHint`,
    remaining === 0 && targetAchieved >= target
      ? "Monthly target achieved"
      : `Pending from ${targetText}`,
  );

  if (prefix === "tme") {
    const totalContract = Number(data.totalContractValue || 0);
    setDashboardText(`${prefix}TargetContract`, formatDashboardMoney(totalContract));
    setDashboardText(`${prefix}TargetContractHint`, "Total value of closed deals");
    const gstAmount = Math.max(0, achieved - paidWithoutGst);
    setDashboardText(`${prefix}TargetWithoutGst`, formatDashboardMoney(paidWithoutGst));
    setDashboardText(`${prefix}TargetWithoutGstHint`, "Paid amount excluding GST");
    setDashboardText(`${prefix}TargetTotalSaleSummary`, formatDashboardMoney(achieved));
    setDashboardText(`${prefix}TargetWithoutGstSummary`, formatDashboardMoney(paidWithoutGst));
    setDashboardText(`${prefix}TargetGstAmount`, formatDashboardMoney(gstAmount));
    setDashboardText("tmeTargetProgressLabel", `${achievedPercent}% achieved`);
    updateTmeTargetProgressInsights(target, targetAchieved, remaining);
    renderTargetProgressChart(target, targetAchieved);
  }
}

function normalizeDashboardNumber(value) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number : 0;
}

function getTargetStorageKey() {
  return currentUser?.id
    ? `monthlyTarget:${currentUser.id}`
    : "monthlyTarget:default";
}

function readLocalMonthlyTarget() {
  const storedTarget = Number(localStorage.getItem(getTargetStorageKey()));
  return Number.isFinite(storedTarget) && storedTarget >= 0
    ? storedTarget
    : MONTHLY_TARGET;
}

function writeLocalMonthlyTarget(target) {
  localStorage.setItem(getTargetStorageKey(), String(target));
  currentMonthlyTarget = target;
}

async function fetchMonthlyTargetSummary(month) {
  if (!currentUser?.id) {
    return { target: currentMonthlyTarget || MONTHLY_TARGET };
  }

  try {
    let url = `${BASE_URL}/api/sales-target-summary?userId=${currentUser.id}&role=${currentUser.role}`;
    if (month) url += `&month=${encodeURIComponent(month)}`;
    const res = await fetch(url, { cache: "no-store" });
    const text = await res.text();
    const result = text ? JSON.parse(text) : {};

    if (!res.ok || !result.success) {
      throw new Error(result.message || "Failed to fetch target");
    }

    const serverTarget = Number(result.data?.target);
    if (Number.isFinite(serverTarget) && serverTarget >= 0) {
      return result.data;
    }
  } catch (err) {
    console.warn("Using default target fallback for TME:", err.message || err);
  }

  return { target: currentMonthlyTarget || MONTHLY_TARGET };
}

function getCurrentMonthKey() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  return `${yyyy}-${mm}`;
}

function filterRowsByMonth(rows, monthKey) {
  if (!monthKey) return rows;
  return rows.filter((row) => {
    const dStr = row.closed_date || row.payment_date || row.app_date || row.created_at;
    if (!dStr) return false;
    const d = new Date(dStr);
    if (isNaN(d)) return false;
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    return `${yyyy}-${mm}` === monthKey;
  });
}

window.syncMonthFiltersTME = function (monthValue) {
  const ids = [
    "dashboardMonthFilterTME",
    "appointmentsMonthFilterTME",
    "followedMonthFilterTME",
    "dealsMonthFilterTME",
  ];
  ids.forEach((id) => {
    const el = document.getElementById(id);
    if (el && el.value !== monthValue) el.value = monthValue;
  });
};

window.handleTmeMonthFilterChange = function (monthValue) {
  syncMonthFiltersTME(monthValue || "");
  const leadsFilter = document.getElementById("tmeLeadsMonthFilter");
  if (leadsFilter) leadsFilter.value = monthValue || "";
  loadLeads();
  loadTmeDashboard(monthValue || "");
  applyAppointmentsFilters();
  loadFollowedUp();
  loadDeals();
};


window.handleDashboardMonthChange = function () {
  const monthInput = document.getElementById("dashboardMonthFilterTME");
  const monthValue = monthInput?.value || "";
  handleTmeMonthFilterChange(monthValue);
};

window.filterAndGoToAppointments = function (status) {
  if (status === "deal_closed") {
    showSection("deals");
    loadDeals();
    return;
  }

  const statusSelect = document.getElementById("appointmentsStatusFilterTME");
  if (statusSelect) statusSelect.value = status || "all";
  showSection("appointments");
  applyAppointmentsFilters();
};

async function loadTmeDashboard(selectedMonth) {
  if (!currentUser?.id) return;

  try {
    const activeMonth =
      selectedMonth ||
      document.getElementById("dashboardMonthFilterTME")?.value ||
      getCurrentMonthKey();

    // Keep all month pickers in sync
    syncMonthFiltersTME(activeMonth);

    const reportsUrl = `${BASE_URL}/api/reports/counts?userId=${currentUser.id}&role=${currentUser.role}`;
    const dealsUrl = `${BASE_URL}/api/deals?userId=${currentUser.id}&userName=${encodeURIComponent(currentUser.name || "")}&role=${currentUser.role}`;
    const attendanceUrl = `${BASE_URL}/api/attendance/today/${currentUser.id}`;
    const appointmentsUrl = `${BASE_URL}/api/appointments?role=${currentUser.role}&userId=${currentUser.id}&includeHistory=1`;

    const [reportsRes, dealsRes, attendanceRes, appointmentsRes, targetResult] =
      await Promise.all([
        fetch(reportsUrl, { cache: "no-store" }),
        fetch(dealsUrl, { cache: "no-store" }),
        fetch(attendanceUrl, { cache: "no-store" }),
        fetch(appointmentsUrl, { cache: "no-store" }),
        fetchMonthlyTargetSummary(activeMonth),
      ]);

    const reports = await reportsRes.json();
    const deals = await dealsRes.json();
    const attendance = await attendanceRes.json();
    const appointmentsResult = await appointmentsRes.json();

    const reportData = reports?.data || {};
    const totalLeads = normalizeDashboardNumber(
      reportData.totalLeads ?? reportData.leads,
    );
    const followups = normalizeDashboardNumber(
      reportData.totalFollowed ??
        reportData.total_followed ??
        reportData.followups ??
        reportData.totalFollowups,
    );
    const allDealRows = Array.isArray(deals?.data) ? deals.data : [];
    const allAppointmentRows = Array.isArray(appointmentsResult?.data)
      ? appointmentsResult.data
      : [];

    // Filter by selected month when one is active
    const closedDealRows = filterRowsByMonth(allDealRows, activeMonth);
    const dealRows = activeMonth
      ? allDealRows.filter((deal) => isDealMatchingMonth(deal, activeMonth))
      : allDealRows;
    const appointmentRows = filterRowsByMonth(
      allAppointmentRows.filter(isTmeAppointmentPipelineRow),
      activeMonth,
    );
    const appointments = appointmentRows.length;

    const appointmentSummary = summarizeAppointmentHistory(appointmentRows);
    const salesMix = summarizeDealMix(dealRows, activeMonth);
    const dealsCount = normalizeDashboardNumber(
      activeMonth ? closedDealRows.length : (reportData.totalDeals ?? reportData.deals ?? dealRows.length),
    );
    const localContractValue = dealRows.reduce(
      (sum, deal) => sum + normalizeDashboardNumber(getDealDashboardContractAmount(deal, activeMonth)),
      0,
    );
    const localReceivedPayment = dealRows.reduce(
      (sum, deal) => sum + normalizeDashboardNumber(getDealDashboardReceivedAmount(deal, activeMonth)),
      0,
    );
    const localPaidWithoutGst = dealRows.reduce(
      (sum, deal) => sum + normalizeDashboardNumber(getDealDashboardPaidWithoutGst(deal, activeMonth)),
      0,
    );
    const conversionRate =
      totalLeads > 0 ? ((dealsCount / totalLeads) * 100).toFixed(1) : "0.0";
    const todayAttendance =
      attendance && typeof attendance === "object"
        ? (attendance.data ??
          (attendance.check_in || attendance.check_out || attendance.status
            ? attendance
            : null))
        : null;
    const hasAttendanceCheckIn = Boolean(todayAttendance?.check_in);
    const isAttendanceAbsent = todayAttendance?.status === "absent";
    const attendanceMeta =
      hasAttendanceCheckIn || isAttendanceAbsent
        ? getAttendanceStatusMeta(todayAttendance?.status)
        : null;
    const attendanceStatus = attendanceMeta
      ? attendanceMeta.label
      : "Not marked";
    const attendanceTime = isAttendanceAbsent
      ? hasAttendanceCheckIn
        ? `In ${formatAttendanceTime(todayAttendance.check_in)} / Out ${getAttendanceCheckoutDisplay(todayAttendance)}`
        : "Check out missing"
      : hasAttendanceCheckIn
        ? `In ${formatAttendanceTime(todayAttendance.check_in)} / Out ${getAttendanceCheckoutDisplay(todayAttendance)}`
        : "Check in pending";

    tmeDashboardState.counts = {
      deals: dealsCount,
    };
    tmeDashboardState.deals = dealRows;
    tmeDashboardState.appointmentsHistory = appointmentRows;
    tmeDashboardState.appointmentSummary = appointmentSummary;
    tmeDashboardState.salesMix = salesMix;

    const targetData = targetResult?.data || targetResult || {};
    const totalContractValue = normalizeDashboardNumber(
      targetData.totalContractValue ?? localContractValue,
    );
    const totalReceivedPayment = normalizeDashboardNumber(
      targetData.achieved ?? localReceivedPayment,
    );
    const paidWithoutGst = normalizeDashboardNumber(
      targetData.paidWithoutGst ?? localPaidWithoutGst,
    );
    const targetAchieved = normalizeDashboardNumber(
      targetData.targetAchieved ?? targetData.targetBasisAmount ?? paidWithoutGst,
    );

    setDashboardText("dashboardTotalSales", formatDashboardMoney(totalReceivedPayment));
    setDashboardText(
      "dashboardSalesHint",
      `${dealsCount} closed deal${dealsCount === 1 ? "" : "s"} received`,
    );
    setDashboardText("dashboardTotalContractValue", formatDashboardMoney(totalContractValue));
    setDashboardText("dashboardPaidWithoutGst", formatDashboardMoney(paidWithoutGst));
    setDashboardText("dashboardDeals", dealsCount);
    setDashboardText("dashboardLeads", totalLeads);
    setDashboardText("dashboardAppointments", appointments);
    setDashboardText("dashboardFollowups", followups);
    setDashboardText(
      "dashboardConversionRate",
      `${conversionRate}% conversion`,
    );
    setDashboardText("dashboardAttendance", attendanceStatus);
    setDashboardText("dashboardAttendanceTime", attendanceTime);
    setDashboardText("dashboardFunnelRate", `${conversionRate}% converted`);
    setDashboardText("tmeFunnelConversionRate", `${conversionRate}%`);
    setDashboardText("funnelLeads", totalLeads);
    setDashboardText("funnelAppointments", appointments);
    setDashboardText("funnelFollowups", followups);
    setDashboardText("funnelDeals", dealsCount);
    currentMonthlyTarget = normalizeDashboardNumber(
      targetData.target && Number(targetData.target) > 0
        ? targetData.target
        : currentMonthlyTarget || MONTHLY_TARGET,
    );
    const hasServerTarget = Number(targetData.target || 0) > 0;
    const remainingTarget = normalizeDashboardNumber(
      hasServerTarget && targetData.remaining !== undefined
        ? targetData.remaining
        : Math.max(currentMonthlyTarget - targetAchieved, 0),
    );
    applySalesTargetSummary("tme", {
      ...targetData,
      target: currentMonthlyTarget,
      achieved: totalReceivedPayment,
      targetAchieved,
      totalContractValue,
      paidWithoutGst,
      remaining: remainingTarget,
    });

    renderAppointmentStatusSummary(appointmentSummary);
    renderAppointmentStatusChart(appointmentSummary);
    if (document.getElementById("appointments")?.classList.contains("active")) {
      applyAppointmentsFilters();
    }
    renderTargetProgressChart(currentMonthlyTarget, totalReceivedPayment);
    renderFreshVsRenewalChart(salesMix.newSaleAmount, salesMix.renewalAmount);
    renderDashboardRecentDeals(dealRows);
    renderTmeDashboardChart([totalLeads, appointments, followups, dealsCount]);
  } catch (err) {
    console.error("Dashboard Load Error:", err);
  }
}

function renderTargetProgressChart(target, achieved, options = {}) {
  const canvas = document.getElementById("tmeTargetProgressChart");
  if (!canvas?.getContext) return;

  const safeTarget = Number(target || 0);
  const safeAchieved = Number(achieved || 0);
  const remaining = Math.max(safeTarget - safeAchieved, 0);
  
  const achievedText = document.getElementById("tmeProgressAchievedText");
  const remainingText = document.getElementById("tmeProgressRemainingText");
  if (achievedText) achievedText.textContent = `Rs. ${safeAchieved.toLocaleString()}`;
  if (remainingText) remainingText.textContent = `Rs. ${remaining.toLocaleString()}`;
  const progressValue =
    safeTarget > 0 ? Math.min((safeAchieved / safeTarget) * 100, 100) : 0;
  const chartLabels = options.labels || ["Achieved", "Remaining"];
  const chartData = options.data || [Math.max(safeAchieved, 0), remaining];
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const centerTextPlugin = {
    id: "tmeTargetCenterText",
    afterDatasetsDraw(chart) {
      const arc = chart.getDatasetMeta(0)?.data?.[0];
      if (!arc) return;

      const { ctx: chartCtx } = chart;
      chartCtx.save();
      chartCtx.textAlign = "center";
      chartCtx.textBaseline = "middle";

      chartCtx.fillStyle = "#0f172a";
      chartCtx.font = "700 28px 'Segoe UI', Arial, sans-serif";
      chartCtx.fillText(
        options.centerValueText || `${progressValue.toFixed(1)}%`,
        arc.x,
        arc.y - 6,
      );

      chartCtx.fillStyle = "#64748b";
      chartCtx.font = "600 12px 'Segoe UI', Arial, sans-serif";
      chartCtx.fillText(options.centerSubtext || "achieved", arc.x, arc.y + 18);
      chartCtx.restore();
    },
  };

  const achievedGradient = ctx.createLinearGradient(
    0,
    0,
    0,
    canvas.height || 280,
  );
  achievedGradient.addColorStop(0, "#22c55e");
  achievedGradient.addColorStop(1, "#16a34a");

  const remainingGradient = ctx.createLinearGradient(
    0,
    0,
    0,
    canvas.height || 280,
  );
  remainingGradient.addColorStop(0, "#dbe7f3");
  remainingGradient.addColorStop(1, "#bfcddd");

  if (targetProgressChart) {
    targetProgressChart.destroy();
  }

  targetProgressChart = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: chartLabels,
      datasets: [
        {
          data: chartData,
          backgroundColor: [achievedGradient, remainingGradient],
          borderColor: ["#ffffff", "#ffffff"],
          borderWidth: 4,
          hoverOffset: 6,
        },
      ],
    },
    plugins: [centerTextPlugin],
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: "72%",
      layout: {
        padding: {
          top: 8,
          bottom: 8,
        },
      },
      plugins: {
        legend: {
          position: "bottom",
          labels: {
            boxWidth: 12,
            usePointStyle: true,
            pointStyle: "circle",
            padding: 18,
          },
        },
        tooltip: {
          callbacks: {
            label(context) {
              const value = Number(context?.raw || 0);
              return `${context.label}: ${formatDashboardMoney(value)}`;
            },
          },
        },
      },
    },
  });
}

function openTargetModal() {
  showPopup(
    "Monthly Target",
    "Monthly target admin assign karega. Update ke liye admin se bolo.",
    false,
  );
}

function closeTargetModal() {
  const modal = document.getElementById("targetModal");
  if (!modal) return;

  modal.classList.remove("show");
  modal.classList.add("hidden");
}

async function saveMonthlyTarget() {
  closeTargetModal();
  showPopup(
    "Monthly Target",
    "Monthly target admin assign karega. Update ke liye admin se bolo.",
    false,
  );
}

function renderDashboardRecentDeals(deals) {
  const tbody = document.getElementById("dashboardRecentDeals");
  if (!tbody) return;

  if (!deals.length) {
    tbody.innerHTML = `<tr><td colspan="5">No closed deals yet</td></tr>`;
    return;
  }

  tbody.innerHTML = deals
    .slice(0, 5)
    .map(
      (deal) => `
        <tr>
          <td>${deal.company_name || "-"}</td>
          <td>${deal.client_name || "-"}</td>
          <td>${formatDashboardMoney(deal.deal_amount)}</td>
          <td>${deal.payment_method || "-"}</td>
          <td>${formatTmeDisplayDate(deal.closed_date)}</td>
        </tr>
      `,
    )
    .join("");
}

function renderTmeDashboardChart(values) {
  const canvas = document.getElementById("tmeDashboardChart");
  if (!canvas?.getContext) return;

  if (dashboardChart) dashboardChart.destroy();

  dashboardChart = new Chart(canvas.getContext("2d"), {
    type: "bar",
    data: {
      labels: ["Leads", "Appointments", "Follow Ups", "Deals"],
      datasets: [
        {
          data: values,
          backgroundColor: ["#0f766e", "#8b5cf6", "#f59e0b", "#22c55e"],
          borderRadius: 8,
          barThickness: 34,
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
        y: {
          beginAtZero: true,
          ticks: { precision: 0 },
          grid: { color: "#e2e8f0" },
        },
        x: {
          grid: { display: false },
        },
      },
    },
  });
}

function handleDashboardShortcutKey(event, sectionId) {
  if (event.key !== "Enter" && event.key !== " ") return;
  event.preventDefault();
  showSection(sectionId);
}

function isDashboardPanelActionBlocked(event) {
  return Boolean(
    event.target.closest("a, button, input, select, textarea, .funnel-row"),
  );
}

document.addEventListener("click", (event) => {
  const panel = event.target.closest("[data-dashboard-section]");
  if (!panel || isDashboardPanelActionBlocked(event)) return;

  showSection(panel.dataset.dashboardSection);
});

document.addEventListener("keydown", (event) => {
  if (event.key !== "Enter" && event.key !== " ") return;
  const panel = event.target.closest("[data-dashboard-section]");
  if (!panel || event.target !== panel) return;

  event.preventDefault();
  showSection(panel.dataset.dashboardSection);
});

document.addEventListener("DOMContentLoaded", () => {
  loadUserFromLocalStorage();
  bindLeadOtherInputs();

  if (currentUser) {
    fetchUserDataFromDB();
    loadTmeDashboard();
    loadLeads();
    loadReportsCounts();
    loadDeals(); // 🔥 MUST ADD THIS
  }
});

function showSection(sectionId) {
  document
    .querySelectorAll(".section")
    .forEach((sec) => sec.classList.remove("active"));
  document.getElementById(sectionId).classList.add("active");

  if (sectionId === "deals") {
    loadDeals(); // 🔥 MUST
  }
}

function loadUserFromLocalStorage() {
  const userStr = localStorage.getItem("currentUser");
  if (!userStr) {
    showPopup("Session Expired", "Please login again.", false);
    setTimeout(() => (window.location.href = "mp.html"), 1500);
    return;
  }

  currentUser = JSON.parse(userStr);
  hydrateCurrentUserIdentity();
  localStorage.setItem("currentUser", JSON.stringify(currentUser));

  document.getElementById("userName").textContent =
    currentUser.name || "TME User";
  document.getElementById("userRole").textContent = (
    currentUser.role || "TME"
  ).toUpperCase();

  if (currentUser.prof_img) {
    const avatarUrl = getTmeUploadedFileUrl(currentUser.prof_img);
    if (avatarUrl) document.getElementById("userAvatar").src = avatarUrl;
  }

  refreshTmeRenewalBadge();
}

async function loadTmeProjectTracker() {
  if (!window.ProjectTrackerUI || !currentUser?.id) return;

  ProjectTrackerUI.renderMessage(
    "tmeProjectsContainer",
    "Loading project updates...",
    "Fetching the latest phase-by-phase delivery details for your leads.",
  );

  try {
    const params = new URLSearchParams({
      scope: "tme",
      userId: String(currentUser.id),
    });
    const res = await fetch(
      `${BASE_URL}/api/project-tracker?${params.toString()}`,
      {
        cache: "no-store",
      },
    );
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

    ProjectTrackerUI.renderStats("tmeProjectTrackerStats", result.counts, {
      assignmentCounts: result.assignmentCounts,
    });
    ProjectTrackerUI.renderProjects("tmeProjectsContainer", result);
  } catch (err) {
    console.error("TME Project Tracker Error:", err);
    ProjectTrackerUI.renderStats(
      "tmeProjectTrackerStats",
      getEmptyTrackerCounts(),
      {
        assignmentCounts: { total: 0 },
      },
    );
    ProjectTrackerUI.renderMessage(
      "tmeProjectsContainer",
      "Project tracker unavailable",
      "Live phase details will show here after the latest server update is active.",
    );
  }
}

async function fetchUserDataFromDB() {
  if (!currentUser || !currentUser.id) return;

  try {
    const leadsContainer = document.getElementById("leadsContainer");
    if (leadsContainer) {
      leadsContainer.innerHTML = `
    <div class="report-card">
        <h3>No Leads Found</h3>
        <p>Currently no leads assigned to you.</p>
    </div>
  `;
    }

    document.getElementById("totalLeads").textContent = "12";
    document.getElementById("totalAppointments").textContent = "5";
    document.getElementById("totalFollowed").textContent = "8";
  } catch (error) {
    console.error("Error fetching data:", error);
  }
}

function showSection(sectionId) {
  document
    .querySelectorAll(".section")
    .forEach((sec) => sec.classList.remove("active"));
  document.getElementById(sectionId).classList.add("active");

  document
    .querySelectorAll(".sidebar li")
    .forEach((li) => li.classList.remove("active"));
  const activeLi = Array.from(document.querySelectorAll(".sidebar li")).find(
    (li) => li.getAttribute("onclick").includes(sectionId),
  );
  if (activeLi) activeLi.classList.add("active");

  if (sectionId === "dashboard") {
    loadTmeDashboard();
  } else if (sectionId === "leads") {
    loadLeads();
  } else if (sectionId === "appointments") {
    loadAppointments();
  } else if (sectionId === "followed") {
    loadFollowedUp();
  } else if (sectionId === "reports") {
    loadReportsCounts(); // ← Naya function call
  } else if (sectionId === "deals") {
    loadDeals();
  } else if (sectionId === "renewals") {
    loadTmeRenewals();
  } else if (sectionId === "projects") {
    loadTmeProjectTracker();
  } else if (sectionId === "attendance") {
    loadAttendance();
  } else if (sectionId === "salary") {
    window.PayrollUI?.handleSectionShown("salary");
  }
}

async function loadAttendance() {
  if (!currentUser || !currentUser.id) return;

  const tbody = document.getElementById("attendanceTableBody");
  const actions = document.getElementById("attendanceActions");
  if (!tbody) return;

  try {
    const selectedMonth = getSelectedAttendanceMonth();
    const attendanceUrl = new URL(`${BASE_URL}/api/attendance/${currentUser.id}`);
    if (selectedMonth) {
      attendanceUrl.searchParams.set("month", selectedMonth);
    }
    const attendanceRes = await fetch(
      attendanceUrl.toString(),
      { cache: "no-store" },
    );
    const result = await attendanceRes.json();
    const rows = result.success ? result.data || [] : [];

    const today = getAttendanceServerToday(result);
    const isCurrentMonthView = !selectedMonth || today.slice(0, 7) === selectedMonth;
    const todayRow = isCurrentMonthView
      ? rows.find((row) => row.attendance_date === today)
      : null;
    const hasCheckInToday = Boolean(todayRow?.check_in);
    const hasCheckOutToday = hasValidAttendanceCheckout(todayRow);
    const canCheckIn = isCurrentMonthView && !hasCheckInToday;
    const canCheckOut = isCurrentMonthView && hasCheckInToday && !hasCheckOutToday;

    if (actions) {
      actions.innerHTML = `
        <button type="button" class="save-btn attendance-calendar-btn" onclick="toggleAttendanceCalendar()">Calendar</button>
        <button type="button" class="save-btn attendance-btn" onclick="markAttendance('check-in')" ${canCheckIn && !attendanceUpdating ? "" : "disabled"}>Check In</button>
        <button type="button" class="cancel-btn attendance-btn" onclick="markAttendance('check-out')" ${canCheckOut && !attendanceUpdating ? "" : "disabled"}>Check Out</button>
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
      calendar.innerHTML = renderAttendanceCalendar(
        rows,
        selectedMonth ? `${selectedMonth}-01` : today,
      );
    }

    let html = "";

    if (rows.length === 0) {
      html += `<tr><td colspan="6">No attendance records found</td></tr>`;
    } else {
      rows.forEach((row) => {
        const checkInLocation = formatCheckInLocation(row);
        const attendanceStatus = formatAttendanceStatus(row);
        const displayedCheckOut = getAttendanceCheckoutDisplay(row);
        html += `
          <tr>
            <td>${formatTmeDisplayDate(row.attendance_date)}</td>
            <td>${formatAttendanceTime(row.check_in)}</td>
            <td>${displayedCheckOut}</td>
            <td>${checkInLocation}</td>
            <td>${formatAttendanceWorkingHoursDisplay(row.working_hours)}</td>
            <td>${attendanceStatus}</td>
          </tr>
        `;
      });
    }

    tbody.innerHTML = html;
    renderAttendanceSummarySection(tbody, rows);
    if (document.getElementById("attendanceSearchTME")?.value) {
      filterTable("attendanceTableBody", "attendanceSearchTME");
    }
  } catch (err) {
    console.error("Attendance Error:", err);
    tbody.innerHTML = `<tr><td colspan="6">Error loading attendance</td></tr>`;
    renderAttendanceSummarySection(tbody, []);
  }
}

async function markAttendance(type) {
  if (!currentUser || !currentUser.id) return;
  if (attendanceUpdating) return;

  const url =
    type === "check-in"
      ? `${BASE_URL}/api/attendance/check-in`
      : `${BASE_URL}/api/attendance/check-out`;
  const method = type === "check-in" ? "POST" : "PUT";

  try {
    attendanceUpdating = true;
    setAttendanceButtonsDisabled(true);
    const location = await getCurrentLocation();
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: currentUser.id, ...location }),
    });
    const result = await res.json();

    if (!res.ok || !result.success) {
      throw new Error(
        result.error || result.message || "Attendance update failed",
      );
    }

    showPopup("Attendance", result.message, true);
    attendanceUpdating = false;
    await loadAttendance();
    return;
  } catch (err) {
    console.error("Attendance update error:", err);
    showPopup("Attendance", err.message || "Attendance update failed", false);
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
      reject(
        new Error(
          "Open this page on localhost or HTTPS to use location access.",
        ),
      );
      return;
    }

    if (!navigator.geolocation) {
      reject(new Error("Location is not supported in this browser."));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        resolve({
          lat,
          lng,
          latitude: lat,
          longitude: lng,
          accuracy: position.coords.accuracy,
        });
      },
      (error) => {
        const message =
          error.code === error.PERMISSION_DENIED
            ? "Please allow location permission to save attendance."
            : error.code === error.TIMEOUT
              ? "Location fetch timed out. Turn on GPS/location and try again."
              : "Unable to fetch location. Turn on GPS/location and try again.";
        reject(new Error(message));
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
    );
  });
}

function getAttendanceCheckoutDisplay(row) {
  if (!row?.check_out) return "-";

  return formatAttendanceTime(row.check_out);
}

function hasValidAttendanceCheckout(row) {
  return Boolean(row?.check_out) && !isInvalidAttendanceCheckout(row);
}

function getAttendanceTimeSeconds(value) {
  const match = String(value || "").trim().match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (!match) return null;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  const seconds = Number(match[3] || 0);

  if (
    !Number.isFinite(hours) ||
    !Number.isFinite(minutes) ||
    !Number.isFinite(seconds) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59 ||
    seconds < 0 ||
    seconds > 59
  ) {
    return null;
  }

  return (hours * 3600) + (minutes * 60) + seconds;
}

function isInvalidAttendanceCheckout(row) {
  const checkOutRaw = String(row?.check_out || "").trim();
  if (/^00:00(?::00)?$/.test(checkOutRaw)) return true;

  const checkInSeconds = getAttendanceTimeSeconds(row?.check_in);
  const checkOutSeconds = getAttendanceTimeSeconds(checkOutRaw);
  return checkInSeconds !== null &&
    checkOutSeconds !== null &&
    checkOutSeconds < checkInSeconds;
}

function formatAttendanceWorkingHoursDisplay(value) {
  const raw = String(value || "").trim();
  if (!raw) return "00:00";
  if (raw.startsWith("-")) return "Pending";
  return raw;
}

function resetSectionFields(section) {
  if (!section) return;

  section.querySelectorAll("input, select, textarea").forEach((field) => {
    if (field.tagName === "SELECT") {
      field.selectedIndex = 0;
    } else {
      field.value = "";
    }
  });
}

function setSectionVisibility(section, isVisible) {
  if (!section) return;

  section.classList.toggle("hidden", !isVisible);
  section.setAttribute("aria-hidden", isVisible ? "false" : "true");
  section.querySelectorAll("input, select, textarea").forEach((field) => {
    field.disabled = !isVisible;
  });

  if (!isVisible) {
    resetSectionFields(section);
  }
}

function populateEmployeeSelect(select, employees, emptyLabel) {
  if (!select) return;

  select.innerHTML = '<option value="">Select Employee</option>';

  if (!employees.length) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = emptyLabel;
    select.appendChild(option);
    return;
  }

  employees.forEach((emp) => {
    const employeeName = emp.name || "Unnamed Employee";
    const employeeCompanyScope = getLeadEmployeeCompanyScope(emp);
    const isUnavailable =
      emp.is_available === false ||
      emp.isAvailable === false ||
      emp.availability_status === "unavailable";
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
    option.value = emp.name;
    option.textContent = labelParts.join(" ");
    option.disabled = isUnavailable;
    option.dataset.employeeId = emp.id != null ? String(emp.id) : "";
    option.dataset.employeeContact = emp.contact ? String(emp.contact) : "";
    option.dataset.employeeCompanyScope = employeeCompanyScope;
    select.appendChild(option);
  });
}

function ensureSelectValue(select, value) {
  if (!select || !value) return;

  const normalizedValue = String(value);
  const existingOption = Array.from(select.options).find(
    (option) => option.value === normalizedValue,
  );

  if (!existingOption) {
    const option = document.createElement("option");
    option.value = normalizedValue;
    option.textContent = normalizedValue;
    select.appendChild(option);
  }

  select.value = normalizedValue;
}

function getSelectedEmployeeMeta(selectOrId) {
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

function openPendingWhatsAppWindow(shouldOpen) {
  if (!shouldOpen) return null;

  const pendingWindow = window.open("", "_blank");
  if (!pendingWindow) return null;

  try {
    pendingWindow.document.write(`
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="utf-8" />
          <title>Preparing WhatsApp Draft</title>
          <style>
            body {
              margin: 0;
              min-height: 100vh;
              display: grid;
              place-items: center;
              background: #f8fafc;
              color: #0f172a;
              font-family: Arial, sans-serif;
            }
            .whatsapp-loading-card {
              width: min(420px, calc(100vw - 40px));
              padding: 28px 24px;
              border-radius: 20px;
              background: #ffffff;
              border: 1px solid #d1d5db;
              box-shadow: 0 18px 38px rgba(15, 23, 42, 0.12);
              text-align: center;
            }
            .whatsapp-loading-card strong {
              display: block;
              margin-bottom: 10px;
              color: #0f766e;
              font-size: 18px;
            }
            .whatsapp-loading-card p {
              margin: 0;
              color: #475569;
              line-height: 1.5;
            }
          </style>
        </head>
        <body>
          <div class="whatsapp-loading-card">
            <strong>Preparing WhatsApp draft</strong>
            <p>The client has been saved. Your ME briefing message is opening now.</p>
          </div>
        </body>
      </html>
    `);
    pendingWindow.document.close();
  } catch (err) {
    console.warn("Unable to render WhatsApp loading state:", err);
  }

  return pendingWindow;
}

function closePendingWhatsAppWindow(targetWindow) {
  if (!targetWindow || targetWindow.closed) return;

  try {
    targetWindow.close();
  } catch (err) {
    console.warn("Unable to close pending WhatsApp window:", err);
  }
}

function completeWhatsAppDraft(targetWindow, whatsapp, fallbackMessage) {
  if (whatsapp?.url) {
    if (targetWindow && !targetWindow.closed) {
      targetWindow.location.replace(whatsapp.url);
    } else {
      const popup = window.open(whatsapp.url, "_blank", "noopener,noreferrer");
      if (!popup) {
        return "The client was saved, but the browser blocked the WhatsApp draft popup.";
      }
    }

    return (
      whatsapp.message || "The assigned ME WhatsApp brief is ready to send."
    );
  }

  closePendingWhatsAppWindow(targetWindow);
  return whatsapp?.warning || fallbackMessage;
}

function formatDateForInput(value) {
  return value ? String(value).slice(0, 10) : "";
}

function formatTimeForInput(value) {
  return value ? String(value).slice(0, 5) : "";
}

function formatTmeDisplayDate(value) {
  const raw = String(value || "").trim();
  if (!raw) return "-";

  const dateOnlyMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (dateOnlyMatch) {
    const [, year, month, day] = dateOnlyMatch;
    const localDate = new Date(Number(year), Number(month) - 1, Number(day));
    return localDate.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  }

  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw.slice(0, 10) || "-";

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatTmeDisplayTime(value) {
  const raw = String(value || "").trim();
  return formatAttendanceTime(raw);
}

function formatAttendanceTime(value) {
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

function parseStoredArray(value) {
  if (Array.isArray(value)) return value;
  if (value == null || value === "") return [];

  if (typeof value !== "string") {
    return [value];
  }

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : parsed ? [parsed] : [];
  } catch (err) {
    return [value];
  }
}

function escapeTmeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function normalizeLeadProductMatchValue(value) {
  return String(value || "")
    .toLowerCase()
    .trim()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function getLeadProductFieldName(groupName = "") {
  const group = normalizeLeadProductMatchValue(groupName);

  if (group === "web_design_and_development") return "web_type[]";
  if (group === "seo") return "seo_type[]";
  if (group === "smo") return "smo_type[]";
  if (group === "application") return "app_type[]";
  if (group === "erp_crm_software") return "erp_type[]";

  return "services[]";
}

function getLeadProductAliases(product = {}) {
  const name = String(product.name || "").trim();
  const group = normalizeLeadProductMatchValue(product.group);
  const normalizedName = normalizeLeadProductMatchValue(name);
  const aliases = new Set([name, normalizedName].filter(Boolean));

  const addAlias = (value) => {
    const normalized = normalizeLeadProductMatchValue(value);
    if (normalized) aliases.add(normalized);
  };

  if (group === "web_design_and_development") {
    if (normalizedName.includes("landing")) addAlias("landing");
    if (normalizedName.includes("static")) addAlias("static");
    if (normalizedName.includes("dynamic")) addAlias("dynamic");
    if (normalizedName.includes("ecommerce") || normalizedName.includes("e_commerce")) {
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

  return Array.from(aliases).map((alias) => normalizeLeadProductMatchValue(alias)).filter(Boolean);
}

async function renderLeadProductCatalog(forceRefresh = false) {
  const container = document.getElementById("leadProductCatalog");
  if (!container) return;

  container.innerHTML = `<div class="lead-products-empty">Loading active products...</div>`;

  try {
    const catalog = await fetchDealCloseProductCatalog(forceRefresh);
    const activeProducts = Array.isArray(catalog) ? catalog : [];
    const groups = activeProducts.reduce((accumulator, product) => {
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
            <h4>${escapeTmeHtml(groupName)}</h4>
            <div class="checkbox-group">
              ${products
                .map((product) => {
                  const fieldName = getLeadProductFieldName(groupName);
                  const aliases = getLeadProductAliases(product).join("|");
                  return `
                    <label>
                      <input
                        type="checkbox"
                        name="${fieldName}"
                        value="${escapeTmeHtml(product.name)}"
                        data-product-aliases="${escapeTmeHtml(aliases)}"
                      >
                      ${escapeTmeHtml(product.name)}
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
    console.error("Lead products load error:", err);
    container.innerHTML = `
      <div class="lead-products-empty error">
        ${escapeTmeHtml(err.message || "Unable to load active products.")}
      </div>
    `;
  }
}

async function fetchEmployeeList(date, time) {
  const hasDateTime = Boolean(date && time);
  const endpoint = hasDateTime
    ? `${BASE_URL}/api/available-employees?date=${encodeURIComponent(date)}&time=${encodeURIComponent(time)}`
    : `${BASE_URL}/api/me-employees`;

  const res = await fetch(endpoint);
  return await res.json();
}

function formatCheckInLocation(row) {
  const locationUrl = row.check_in_location;

  if (locationUrl) {
    return `<a href="${locationUrl}" target="_blank" rel="noopener noreferrer" class="location-link">View Location</a>`;
  }

  if (row.check_in_lat && row.check_in_lng) {
    const url = `https://www.google.com/maps?q=${row.check_in_lat},${row.check_in_lng}`;
    return `<a href="${url}" target="_blank" rel="noopener noreferrer" class="location-link">View Location</a>`;
  }

  return "-";
}

function getLeadLocationUrl(lead) {
  if (lead?.maps_lnk) return lead.maps_lnk;

  const rawLocation = (lead?.location || "").trim();
  if (!rawLocation) return "";
  if (/^https?:\/\//i.test(rawLocation)) return rawLocation;

  return `https://www.google.com/maps?q=${encodeURIComponent(rawLocation)}`;
}

function formatAppointmentLocation(lead) {
  if (isTmeGoogleMeetLead(lead)) {
    const meetLink = String(lead?.google_meet_link || "").trim();
    if (!meetLink) return "Google Meet link pending";

    return `<a href="${escapeTmeHtml(meetLink)}" target="_blank" rel="noopener noreferrer" class="location-link">Join Meet</a>`;
  }

  const locationUrl = getLeadLocationUrl(lead);
  if (!locationUrl) return "-";

  return `<a href="${locationUrl}" target="_blank" rel="noopener noreferrer" class="location-link">View Location</a>`;
}

function isTmeGoogleMeetLead(lead = {}) {
  const explicitType = String(
    lead.meeting_type ||
      lead.meetingType ||
      lead.appointment_type ||
      lead.appointmentType ||
      "",
  )
    .toLowerCase()
    .trim()
    .replace(/[\s-]+/g, "_");

  if (explicitType === "google_meet") return true;
  if (String(lead.google_meet_link || "").trim()) return true;

  const locationValue = String(lead.location || lead.maps_lnk || "").toLowerCase();
  return (
    locationValue.includes("meet.google") ||
    locationValue.includes("google meet")
  );
}

function getAppointmentMeetingType(lead = {}) {
  const explicitType = String(
    lead.meeting_type ||
      lead.meetingType ||
      lead.appointment_type ||
      lead.appointmentType ||
      "",
  ).trim();

  if (explicitType) {
    const normalizedExplicit = explicitType.toLowerCase().replace(/[\s-]+/g, "_");
    if (normalizedExplicit === "google_meet") return "Google Meet";
    return explicitType.replace(/[_-]+/g, " ");
  }

  const locationValue = String(lead.location || lead.maps_lnk || "").toLowerCase();
  if (locationValue.includes("meet.google") || locationValue.includes("google meet")) {
    return "Google Meet";
  }
  if (locationValue.includes("zoom")) return "Zoom";
  if (locationValue.includes("teams.microsoft") || locationValue.includes("microsoft teams")) {
    return "Teams";
  }
  if (locationValue.startsWith("http")) return "Online";
  return locationValue ? "In Person" : "-";
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

function renderAttendanceCalendar(rows, todayKey = formatDateKey(new Date())) {
  const today = parseAttendanceDateKey(todayKey);
  const year = today.getFullYear();
  const month = today.getMonth();
  const firstDay = new Date(year, month, 1);
  const totalDays = new Date(year, month + 1, 0).getDate();
  const attendanceByDate = new Map(
    rows.map((row) => [row.attendance_date, row]),
  );
  const monthName = today.toLocaleString("en-US", {
    month: "long",
    year: "numeric",
  });
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
    const attendanceSection = table.closest("#attendance");
    const filterBar = attendanceSection?.querySelector(".attendance-filter-bar");
    const sectionTitle = attendanceSection?.querySelector("h2");
    const actions = attendanceSection?.querySelector("#attendanceActions");
    const tableWrapper = table.closest(".table-responsive") || table;
    if (filterBar) {
      filterBar.insertAdjacentElement("afterend", summary);
    } else if (sectionTitle) {
      sectionTitle.insertAdjacentElement("afterend", summary);
    } else {
      const anchor = actions || tableWrapper;
      anchor.insertAdjacentElement("beforebegin", summary);
    }
  }

  summary.innerHTML = renderAttendanceSummary(rows);
}

function formatDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getAttendanceMonthKey(value = new Date()) {
  if (typeof value === "string") {
    const normalized = value.trim();
    if (/^\d{4}-\d{2}$/.test(normalized)) return normalized;
    if (/^\d{4}-\d{2}-\d{2}/.test(normalized)) return normalized.slice(0, 7);
  }

  return formatDateKey(value instanceof Date ? value : new Date()).slice(0, 7);
}

function getSelectedAttendanceMonth() {
  const monthInput = document.getElementById("attendanceMonthFilter");
  if (!monthInput) return "";

  monthInput.min = "2026-05";
  if (!monthInput.value) {
    monthInput.value = getAttendanceMonthKey();
  }

  const monthKey = String(monthInput.value || "").trim();
  return /^\d{4}-\d{2}$/.test(monthKey) ? monthKey : "";
}

function getAttendanceServerToday(result) {
  const value = String(
    result?.today ||
      result?.serverDate ||
      result?.currentTime?.date ||
      "",
  ).trim();

  return /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? value
    : formatDateKey(new Date());
}

function parseAttendanceDateKey(dateKey) {
  const match = String(dateKey || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return new Date();

  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

// Load Real Reports Counts
async function loadReportsCounts() {
  try {
    if (!currentUser?.id) return;

    // 🔥 USER-SPECIFIC DATA (IMPORTANT)
    const url = `${BASE_URL}/api/reports/counts?userId=${currentUser.id}&role=${currentUser.role}`;
    const res = await fetch(url, { cache: "no-store" });
    const result = await res.json();

    const data = result?.data || {};

    const totalLeads = Number(data.totalLeads ?? data.leads ?? 0);
    const totalAppointments = Number(
      data.totalAppointments ?? data.appointments ?? 0,
    );

    const totalFollowed = Number(
      data.totalFollowed ??
        data.total_followed ??
        data.followups ??
        data.totalFollowups ??
        0,
    );

    // ✅ UI update
    document.getElementById("totalLeads").textContent = totalLeads;
    document.getElementById("totalAppointments").textContent =
      totalAppointments;
    document.getElementById("totalFollowed").textContent = totalFollowed;

    // ✅ Chart
    const canvas = document.getElementById("reportChart");
    if (!canvas?.getContext) return;

    if (reportChart) reportChart.destroy();

    reportChart = new Chart(canvas.getContext("2d"), {
      type: "doughnut",
      data: {
        labels: ["Leads", "Appointments", "Followed Up"],
        datasets: [
          {
            data: [totalLeads, totalAppointments, totalFollowed],
            backgroundColor: ["#0f766e", "#eab308", "#22c55e"],
          },
        ],
      },
      options: {
        responsive: true,
        plugins: {
          legend: { position: "bottom" },
        },
      },
    });
  } catch (err) {
    console.error("Report Error:", err);
  }
}
// Load Appointments
async function loadAppointments() {
  try {
    const res = await fetch(
      `${BASE_URL}/api/appointments?role=${currentUser.role}&userId=${currentUser.id}&includeHistory=1`,
      { cache: "no-store" },
    );
    const result = await res.json();

    if (!result.success) {
      throw new Error(result.message || "Failed to load appointments");
    }

    const allRows = Array.isArray(result.data) ? result.data : [];
    const appointmentRows = allRows.filter(isTmeAppointmentPipelineRow);

    // Store all rows; applyAppointmentsFilters will apply month + status filter
    tmeDashboardState.appointmentsHistory = appointmentRows;

    // Summarise using active month filter
    const activeMonth =
      document.getElementById("appointmentsMonthFilterTME")?.value || "";
    const filteredForSummary = filterRowsByMonth(appointmentRows, activeMonth);
    const summary = summarizeAppointmentHistory(filteredForSummary);
    tmeDashboardState.appointmentSummary = summary;
    renderAppointmentStatusSummary(summary);
    renderAppointmentStatusChart(summary);
    applyAppointmentsFilters();
  } catch (err) {
    console.error(err);
    const tbody = document.getElementById("appointmentsTableBody");
    if (tbody) {
      ensureTmeAppointmentActionColumn();
      tbody.innerHTML = `<tr><td colspan="13" style="text-align:center;color:red;">Error loading appointments</td></tr>`;
    }
  }
}

function getTmeRenewalCompanyScope() {
  return (
    currentUser?.company_key ||
    currentUser?.selected_company ||
    currentUser?.company_scope ||
    currentUser?.comp_name ||
    ""
  );
}

function updateTmeRenewalBadge(count = 0) {
  const badge = document.getElementById("tmeRenewalsBadge");
  const navItem = document.getElementById("tmeRenewalsNavItem");
  const dueCount = Math.max(Number(count) || 0, 0);
  if (!badge) return;
  badge.textContent = dueCount > 99 ? "99+" : String(dueCount);
  badge.classList.toggle("hidden", dueCount === 0);
  navItem?.classList.toggle("has-notification-badge", dueCount > 0);
}

function formatTmeRenewalDate(value) {
  const raw = String(value || "").slice(0, 10);
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return raw || "-";
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
    .toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function formatTmeRenewalDays(value) {
  const days = Number(value);
  if (!Number.isFinite(days)) return "-";
  if (days === 0) return "Today";
  if (days === 1) return "1 day";
  if (days > 1) return `${days} days`;
  return `${Math.abs(days)} overdue`;
}

function getTmeRenewalStatusMeta(item = {}) {
  const configured = Number(item.is_configured || item.renewal_id || item.id || 0) > 0;
  const status = String(item.status || "").toLowerCase();
  const days = Number(item.days_left);
  if (!configured) return { className: "upcoming", label: "Not Set" };
  if (status === "stopped") return { className: "stopped", label: "Stopped" };
  if (Number.isFinite(days) && days === 0) return { className: "due-today", label: "Due Today" };
  if (Number.isFinite(days) && days > 0 && days <= 2) return { className: "due-soon", label: "Due Soon" };
  return { className: "started", label: "Active" };
}

function getTmeRenewalRowKey(item = {}) {
  return `${Number(item.lead_id || 0)}-${String(item.service_name || "").replace(/[^a-z0-9]+/gi, "_")}`;
}

function renderTmeRenewalBasisOptions(item = {}) {
  const basis = String(item.renewal_basis || "monthly");
  const options = Number(item.website_yearly_only || 0) > 0
    ? [["yearly", "Yearly"]]
    : [["monthly", "Monthly"], ["quarterly", "Quarterly"], ["half_yearly", "Half Yearly"], ["yearly", "Full Yearly"]];
  return options
    .map(([value, label]) => `<option value="${value}" ${basis === value ? "selected" : ""}>${label}</option>`)
    .join("");
}

function setTmeRenewalSummary(summary = {}) {
  const setText = (id, value) => {
    const el = document.getElementById(id);
    if (el) el.textContent = String(Number(value || 0));
  };
  setText("tmeRenewalTotal", summary.total);
  setText("tmeRenewalDueSoon", summary.notifySoon || summary.dueSoon);
  setText("tmeRenewalActive", summary.active);
  setText("tmeRenewalStopped", summary.stopped);
  updateTmeRenewalBadge(summary.notifySoon || summary.dueSoon || 0);
}

function renderTmeRenewalRows(rows = []) {
  const tbody = document.getElementById("tmeRenewalsTableBody");
  if (!tbody) return;
  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="9">No renewal records found</td></tr>`;
    return;
  }

  tbody.innerHTML = rows.map((item) => {
    const status = getTmeRenewalStatusMeta(item);
    const rowKey = getTmeRenewalRowKey(item);
    const configured = Number(item.is_configured || item.renewal_id || item.id || 0) > 0;
    const renewalId = Number(item.renewal_id || item.id || 0);
    const stopped = String(item.status || "").toLowerCase() === "stopped";
    const startValue = item.first_start_date || item.history_start_date || item.renewal_due_date || "";
    const invoiceStart = item.history_start_date || item.renewal_due_date || item.current_start_date || item.first_start_date || "";
    const invoiceStartArg = escapeTmeHtml(String(invoiceStart).replace(/\\/g, "\\\\").replace(/'/g, "\\'"));
    const serviceArg = escapeTmeHtml(String(item.service_name || "").replace(/\\/g, "\\\\").replace(/'/g, "\\'"));
    const stopButton = configured && !stopped
      ? `<button type="button" class="renewal-stop-btn" onclick="stopTmeRenewal(${renewalId})">Stop</button>`
      : "";
    return `
      <tr>
        <td>${escapeTmeHtml(item.company_name || "-")}</td>
        <td>${escapeTmeHtml(item.client_name || "-")}</td>
        <td>${escapeTmeHtml(item.service_name || "-")}</td>
        <td><select id="tmeRenewalBasis_${rowKey}" class="renewal-inline-control" ${Number(item.website_yearly_only || 0) > 0 ? "disabled" : ""}>${renderTmeRenewalBasisOptions(item)}</select></td>
        <td><input id="tmeRenewalStart_${rowKey}" class="renewal-inline-control" type="date" value="${escapeTmeHtml(startValue)}" /></td>
        <td>${escapeTmeHtml(formatTmeRenewalDate(item.renewal_due_date))}</td>
        <td>${escapeTmeHtml(formatTmeRenewalDays(item.days_left))}</td>
        <td><span class="renewal-status ${status.className}">${escapeTmeHtml(status.label)}</span></td>
        <td><div class="renewal-action-stack"><button type="button" class="renewal-save-btn" onclick="saveTmeRenewal(${Number(item.lead_id || 0)}, '${serviceArg}', '${rowKey}')">Save</button>${stopButton}</div></td>
      </tr>
    `;
  }).join("");
}

async function loadTmeRenewals(forceRefresh = false) {
  if (!currentUser?.id) return;
  const tbody = document.getElementById("tmeRenewalsTableBody");
  if (tbody && forceRefresh) tbody.innerHTML = `<tr><td colspan="9">Loading renewals...</td></tr>`;
  try {
    const params = new URLSearchParams({
      role: currentUser.role || "tme",
      userId: currentUser.id,
      userName: currentUser.name || "",
      status: document.getElementById("tmeRenewalsStatus")?.value || "all",
    });
    const month = document.getElementById("tmeRenewalsMonth")?.value || "";
    const companyScope = getTmeRenewalCompanyScope();
    if (month) params.set("month", month);
    if (companyScope) params.set("companyScope", companyScope);
    const res = await fetch(`${BASE_URL}/api/service-renewals?${params.toString()}`, { cache: "no-store" });
    const result = await res.json();
    if (!res.ok || !result.success) throw new Error(result.message || "Failed to load renewals");
    setTmeRenewalSummary(result.summary || {});
    renderTmeRenewalRows(Array.isArray(result.data) ? result.data : []);
  } catch (err) {
    console.error("TME renewals error:", err);
    setTmeRenewalSummary({});
    if (tbody) tbody.innerHTML = `<tr><td colspan="9">${escapeTmeHtml(err.message || "Unable to load renewals")}</td></tr>`;
  }
}

async function refreshTmeRenewalBadge() {
  if (!currentUser?.id) return;
  try {
    const params = new URLSearchParams({
      role: currentUser.role || "tme",
      userId: currentUser.id,
      userName: currentUser.name || "",
      status: "due_soon",
    });
    const companyScope = getTmeRenewalCompanyScope();
    if (companyScope) params.set("companyScope", companyScope);
    const res = await fetch(`${BASE_URL}/api/service-renewals?${params.toString()}`, { cache: "no-store" });
    const result = await res.json();
    updateTmeRenewalBadge(result?.summary?.notifySoon || result?.summary?.dueSoon || 0);
  } catch (_err) {
    updateTmeRenewalBadge(0);
  }
}

async function saveTmeRenewal(leadId, serviceName, rowKey) {
  const startDate = document.getElementById(`tmeRenewalStart_${rowKey}`)?.value || "";
  const basis = document.getElementById(`tmeRenewalBasis_${rowKey}`)?.value || "yearly";
  if (!leadId || !serviceName || !startDate) {
    showPopup("Renewal", "Please select renewal start date.", false);
    return;
  }
  try {
    const res = await fetch(`${BASE_URL}/api/service-renewals`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ leadId, serviceName, startDate, basis, userId: currentUser?.id || null }),
    });
    const result = await res.json();
    if (!res.ok || !result.success) throw new Error(result.message || "Failed to save renewal");
    showPopup("Renewal", "Renewal schedule saved.", true);
    await loadTmeRenewals(true);
  } catch (err) {
    showPopup("Renewal", err.message || "Unable to save renewal.", false);
  }
}

async function stopTmeRenewal(renewalId) {
  if (!renewalId) return;
  try {
    const res = await fetch(`${BASE_URL}/api/service-renewals/${renewalId}/stop`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: currentUser?.id || null }),
    });
    const result = await res.json();
    if (!res.ok || !result.success) throw new Error(result.message || "Failed to stop renewal");
    showPopup("Renewal", "Renewal stopped.", true);
    await loadTmeRenewals(true);
  } catch (err) {
    showPopup("Renewal", err.message || "Unable to stop renewal.", false);
  }
}

function openTmeRenewalInvoice(renewalId, type = "tax", cycleStart = "") {
  if (!renewalId) return;
  const params = new URLSearchParams({ type });
  if (cycleStart) params.set("cycleStart", cycleStart);
  if (currentUser?.id) params.set("requesterId", currentUser.id);
  window.open(`${BASE_URL}/api/service-renewals/${renewalId}/invoice?${params.toString()}`, "_blank", "noopener,noreferrer");
}

function renderAppointmentsTableRows(rows = []) {
  const tbody = document.getElementById("appointmentsTableBody");
  const noData = document.getElementById("noAppointments");
  if (!tbody || !noData) return;

  ensureTmeAppointmentActionColumn();
  ensureTmeAppointmentActionModal();

  if (!rows.length) {
    tbody.innerHTML = "";
    noData.classList.remove("hidden");
    return;
  }

  noData.classList.add("hidden");
  tbody.innerHTML = rows
    .map((lead, index) => {
      const locationCell = formatAppointmentLocation(lead);
      const meetingType = getAppointmentMeetingType(lead);
      const stage = getAppointmentLifecycleStage(lead);
      const stageMeta = getAppointmentStageMeta(stage);
      const stagePill = `<span class="appointment-stage-pill ${stageMeta.className}">${stageMeta.label}</span>`;
      const updateCell =
        stage === "deal_closed"
          ? `<span class="appointment-stage-pill deal_closed">Closed</span>`
          : `
              <select
                class="appointment-status-select"
                data-appointment-id="${lead.id}"
                data-previous-value="${stage === "generated" ? "generated" : stage}"
                onchange="updateAppointmentStatus(this)"
              >
                <option value="generated" ${stage === "generated" ? "selected" : ""}>Generated</option>
                <option value="confirmed" ${stage === "confirmed" ? "selected" : ""}>Confirmed</option>
                <option value="not_confirmed" ${stage === "not_confirmed" ? "selected" : ""}>Not Confirmed</option>
                <option value="not_interested" ${stage === "not_interested" ? "selected" : ""}>Not Interested</option>
              </select>
            `;
      const rescheduleCell =
        stage === "deal_closed"
          ? `<span class="appointment-stage-pill deal_closed">Closed</span>`
          : `
              <button
                type="button"
                class="appointment-reschedule-btn btn-reschedule"
                onclick="openAppointmentReschedule(${Number(lead.id || 0)})"
                title="Reschedule appointment"
              >
                Reschedule
              </button>
            `;
      const actionCell =
        stage === "deal_closed"
          ? `<span class="appointment-stage-pill deal_closed">Closed</span>`
          : `
              <button
                type="button"
                class="appointment-reschedule-btn btn-reschedule"
                onclick="openTmeAppointmentActionModal(event, ${Number(lead.id || 0)})"
                title="Open appointment actions"
              >
                Action
              </button>
            `;

      return `
        <tr>
          <td>${index + 1}</td>
          <td><strong>${lead.company_name || "-"}</strong></td>
          <td>${lead.client_name || "-"}</td>
          <td>${lead.contact || "-"}</td>
          <td>${formatTmeDisplayDate(lead.app_date)}</td>
          <td>${formatTmeDisplayTime(lead.app_time)}</td>
          <td>${lead.assign_emp || "-"}</td>
          <td>${escapeTmeHtml(meetingType)}</td>
          <td>${locationCell}</td>
          <td>${stagePill}</td>
          <td>${updateCell}</td>
          <td>${rescheduleCell}</td>
          <td>${actionCell}</td>
        </tr>
      `;
    })
    .join("");
}

function ensureTmeAppointmentActionColumn() {
  const headerRow = document.querySelector("#appointmentsTable thead tr");
  if (!headerRow) return;

  if (headerRow.querySelector("[data-tme-appointment-action-heading]")) return;

  const actionHeading = document.createElement("th");
  actionHeading.textContent = "Action";
  actionHeading.dataset.tmeAppointmentActionHeading = "true";
  headerRow.appendChild(actionHeading);
}

function ensureTmeAppointmentActionModal() {
  if (document.getElementById("tmeAppointmentActionModal")) return;
  if (!document.body) return;

  const modal = document.createElement("div");
  modal.id = "tmeAppointmentActionModal";
  modal.className = "modal hidden";
  modal.setAttribute("aria-hidden", "true");
  modal.onclick = handleTmeAppointmentActionBackdrop;
  modal.innerHTML = `
    <div
      class="modal-content"
      style="max-width:430px;border-radius:14px;padding:32px 22px 28px;position:relative;"
    >
      <button
        type="button"
        onclick="closeTmeAppointmentActionModal()"
        aria-label="Close appointment actions"
        title="Close"
        style="position:absolute;top:18px;right:18px;border:0;background:transparent;color:#64748b;font-size:24px;cursor:pointer;"
      >
        <i class="fas fa-xmark" aria-hidden="true"></i>
      </button>
      <h2
        id="tmeAppointmentActionTitle"
        style="margin:0 42px 14px 0;color:#111827;font-size:22px;line-height:1.25;"
      >
        Appointment
      </h2>
      <p
        id="tmeAppointmentActionSubtitle"
        style="margin:0 0 26px;color:#0f766e;font-weight:700;"
      ></p>
      <div style="display:grid;gap:12px;">
        <button
          type="button"
          onclick="handleTmeAppointmentNotInterested()"
          style="width:100%;border:0;border-radius:8px;padding:14px 16px;background:#ef4444;color:#ffffff;font-weight:800;font-size:16px;cursor:pointer;"
        >
          Not Interested
        </button>
        <button
          type="button"
          onclick="handleTmeAppointmentFollowUp()"
          style="width:100%;border:0;border-radius:8px;padding:14px 16px;background:#f4b400;color:#000000;font-weight:800;font-size:16px;cursor:pointer;"
        >
          Follow Up
        </button>
        <button
          type="button"
          onclick="handleTmeAppointmentReschedule()"
          style="width:100%;border:0;border-radius:8px;padding:14px 16px;background:#0f766e;color:#ffffff;font-weight:800;font-size:16px;cursor:pointer;"
        >
          Reschedule Meeting
        </button>
        <button
          type="button"
          onclick="handleTmeAppointmentDealClosed()"
          style="width:100%;border:0;border-radius:8px;padding:14px 16px;background:#22c55e;color:#ffffff;font-weight:800;font-size:16px;cursor:pointer;"
        >
          Deal Closed
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
}

function getTmeAppointmentById(leadId) {
  const normalizedLeadId = Number(leadId || 0);
  return (tmeDashboardState.appointmentsHistory || []).find(
    (lead) => Number(lead.id || 0) === normalizedLeadId,
  );
}

function openTmeAppointmentActionModal(event, leadId) {
  event?.preventDefault?.();
  event?.stopPropagation?.();
  ensureTmeAppointmentActionModal();

  const modal = document.getElementById("tmeAppointmentActionModal");
  const title = document.getElementById("tmeAppointmentActionTitle");
  const subtitle = document.getElementById("tmeAppointmentActionSubtitle");
  const normalizedLeadId = Number(leadId || 0);
  const appointment = getTmeAppointmentById(normalizedLeadId) || {};

  if (!modal || !normalizedLeadId) return;

  activeTmeAppointmentActionLeadId = normalizedLeadId;

  if (title) {
    title.textContent = appointment.company_name || "Appointment";
  }
  if (subtitle) {
    subtitle.textContent = appointment.client_name || appointment.contact || "";
  }

  modal.classList.remove("hidden");
  modal.classList.add("show");
  modal.setAttribute("aria-hidden", "false");
  document.body.classList.add("modal-open");
}

function closeTmeAppointmentActionModal() {
  const modal = document.getElementById("tmeAppointmentActionModal");
  if (!modal) return;

  if (modal.contains(document.activeElement)) {
    document.activeElement.blur();
  }

  modal.classList.remove("show");
  modal.classList.add("hidden");
  modal.setAttribute("aria-hidden", "true");
  document.body.classList.remove("modal-open");
  activeTmeAppointmentActionLeadId = null;
}

function handleTmeAppointmentActionBackdrop(event) {
  if (event.target?.id === "tmeAppointmentActionModal") {
    closeTmeAppointmentActionModal();
  }
}

async function setTmeAppointmentStatus(leadId, nextValue) {
  const normalizedLeadId = Number(leadId || 0);
  const normalizedStatus = String(nextValue || "").trim();
  if (!normalizedLeadId || !normalizedStatus) return null;

  if (normalizedStatus === "not_interested") {
    const actionRes = await fetch(`${BASE_URL}/api/leads/${normalizedLeadId}/action`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ action: "not_interested" }),
    });
    const actionResult = await parseTmeJsonResponse(
      actionRes,
      "Failed to update appointment status",
    );

    if (!actionRes.ok || !actionResult.success) {
      throw new Error(actionResult.message || "Failed to update appointment status");
    }

    return actionResult;
  }

  const statusUrl = `${BASE_URL}/api/appointments/${normalizedLeadId}/status`;
  const payload = {
    appointment_status: normalizedStatus,
    status: normalizedStatus,
    appointmentStatus: normalizedStatus,
  };
  const assertStatusUpdated = async (res) => {
    const result = await parseTmeJsonResponse(
      res,
      "Failed to update appointment status",
    );

    if (!res.ok || !result.success) {
      throw new Error(result.message || "Failed to update appointment status");
    }

    return result;
  };

  try {
    const res = await fetch(statusUrl, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    return await assertStatusUpdated(res);
  } catch (err) {
    if (!/appointment id and status are required/i.test(err.message || "")) {
      throw err;
    }
  }

  const formBody = new URLSearchParams();
  formBody.set("appointment_status", normalizedStatus);
  formBody.set("status", normalizedStatus);
  formBody.set("appointmentStatus", normalizedStatus);

  const fallbackRes = await fetch(statusUrl, {
    method: "PUT",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
    },
    body: formBody.toString(),
  });
  return await assertStatusUpdated(fallbackRes);
}

async function handleTmeAppointmentNotInterested() {
  const leadId = activeTmeAppointmentActionLeadId;
  if (!leadId) return;

  try {
    closeTmeAppointmentActionModal();
    await setTmeAppointmentStatus(leadId, "not_interested");
    showPopup("Appointment Updated", "Marked as not interested.", true);
    await loadAppointments();
    loadTmeDashboard();
  } catch (err) {
    console.error("Appointment not interested error:", err);
    showPopup("Update Failed", err.message || "Unable to update appointment", false);
  }
}

function handleTmeAppointmentFollowUp() {
  const leadId = activeTmeAppointmentActionLeadId;
  if (!leadId) return;

  closeTmeAppointmentActionModal();
  openFollowupModal(leadId);
}

function handleTmeAppointmentReschedule() {
  const leadId = activeTmeAppointmentActionLeadId;
  if (!leadId) return;

  closeTmeAppointmentActionModal();
  openAppointmentReschedule(leadId);
}

function handleTmeAppointmentDealClosed() {
  const leadId = activeTmeAppointmentActionLeadId;
  if (!leadId) return;

  closeTmeAppointmentActionModal();
  openDealCloseModal(leadId);
}

function applyAppointmentsFilters() {
  const selectedStatusFilter =
    document.getElementById("appointmentsStatusFilterTME")?.value || "all";
  const statusFilter = selectedStatusFilter === "deal_closed" ? "all" : selectedStatusFilter;
  const monthFilter =
    document.getElementById("appointmentsMonthFilterTME")?.value || "";
  const searchValue = String(
    document.getElementById("appointmentsSearchTME")?.value || "",
  )
    .toLowerCase()
    .trim();

  const filteredRows = (tmeDashboardState.appointmentsHistory || []).filter(
    (lead) => {
      // Month filter
      if (monthFilter) {
        const dStr = lead.app_date || lead.created_at;
        if (!dStr) return false;
        const d = new Date(dStr);
        if (isNaN(d)) return false;
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, "0");
        if (`${yyyy}-${mm}` !== monthFilter) return false;
      }

      const stage = getAppointmentLifecycleStage(lead);
      const stageMeta = getAppointmentStageMeta(stage);
      const matchesStatus = statusFilter === "all" || stage === statusFilter;
      const searchableText = [
        lead.company_name,
        lead.client_name,
        lead.contact,
        lead.assign_emp,
        getAppointmentMeetingType(lead),
        lead.location,
        lead.maps_lnk,
        lead.app_date,
        lead.app_time,
        stageMeta.label,
      ]
        .map((value) => String(value || "").toLowerCase())
        .join(" ");
      const matchesSearch =
        !searchValue || searchableText.includes(searchValue);

      return matchesStatus && matchesSearch;
    },
  );

  renderAppointmentsTableRows(filteredRows);
}

async function updateAppointmentStatus(selectElement) {
  if (!selectElement) return;

  const appointmentId = selectElement.dataset.appointmentId;
  const previousValue = selectElement.dataset.previousValue || "generated";
  const nextValue = selectElement.value;

  if (!appointmentId || !nextValue || nextValue === previousValue) {
    return;
  }

  selectElement.disabled = true;

  try {
    await setTmeAppointmentStatus(appointmentId, nextValue);
    selectElement.dataset.previousValue = nextValue;
    showPopup(
      "Appointment Updated",
      "Meeting status saved successfully.",
      true,
    );
    await loadAppointments();
    loadTmeDashboard();
  } catch (err) {
    console.error("Appointment status update error:", err);
    selectElement.value = previousValue;
    showPopup(
      "Update Failed",
      err.message || "Unable to update appointment status",
      false,
    );
  } finally {
    selectElement.disabled = false;
  }
}

// Load Followed Up
async function loadFollowedUp() {
  const tbody = document.getElementById("followedTableBody");
  const noData = document.getElementById("noFollowed");

  try {
    const res = await fetch(
      `${BASE_URL}/api/followups?userId=${currentUser.id}&role=${currentUser.role}`,
    );

    const result = await res.json();

    const selectedMonth =
      document.getElementById("followedMonthFilterTME")?.value || "";
    let followedRows = Array.isArray(result.data) ? result.data : [];

    if (selectedMonth) {
      followedRows = followedRows.filter((lead) => {
        const dStr = lead.follow_date || lead.created_at;
        if (!dStr) return false;
        const date = new Date(dStr);
        if (Number.isNaN(date.getTime())) return false;
        const yyyy = date.getFullYear();
        const mm = String(date.getMonth() + 1).padStart(2, "0");
        return `${yyyy}-${mm}` === selectedMonth;
      });
    }

    if (!result.success || followedRows.length === 0) {
      tbody.innerHTML = "";
      noData.classList.remove("hidden");
      return;
    }

    noData.classList.add("hidden");
    tbody.innerHTML = "";

    followedRows.forEach((lead, index) => {
      const row = `
<tr>
  <td>${index + 1}</td>
  <td><strong>${lead.company_name}</strong></td>
  <td>${lead.client_name}</td>
  <td>${lead.contact}</td>
  <td>${lead.city || "-"}</td>

  <td>${formatTmeDisplayDate(lead.follow_date)}</td>   <!-- ✅ Follow Date -->
  <td>${formatTmeDisplayTime(lead.follow_time)}</td>   <!-- ✅ Follow Time -->

  <td>${lead.assign_emp || "-"}</td>    <!-- ✅ Employee (shifted here) -->

  <td>${lead.reason || "-"}</td>

  <td class="actions">
    <button onclick="convertToAppointment(${lead.id})" class="btn-appointment">
      <i class="fas fa-calendar-plus"></i>
    </button>
  </td>
</tr>
`;
      tbody.innerHTML += row;
    });
  } catch (err) {
    console.error(err);
    tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;color:red;">Error loading followed up leads</td></tr>`;
  }
}

function showPopup(title, message, isSuccess) {
  const popup = document.getElementById("popup");
  const icon = document.getElementById("popupIcon");
  const titleEl = document.getElementById("popupTitle");
  const msgEl = document.getElementById("popupMessage");

  titleEl.textContent = title;
  msgEl.textContent = message;

  if (isSuccess) {
    icon.className = "fas fa-check-circle";
    icon.style.color = "#0f766e";
  } else {
    icon.className = "fas fa-exclamation-circle";
    icon.style.color = "#ef4444";
  }

  popup.classList.remove("hidden");

  if (popupTimer) clearTimeout(popupTimer);

  popupTimer = setTimeout(() => {
    popup.classList.add("hidden");
  }, 1500);
}

function showLeadModal() {
  const modal = document.getElementById("leadModal");
  if (!modal) return;

  modal.classList.remove("hidden");
  modal.classList.add("show");
  modal.setAttribute("aria-hidden", "false");
}

function setLeadFormMode(mode) {
  const modalTitle = document.getElementById("leadModalTitle");
  const submitBtn = document.getElementById("leadSubmitBtn");
  const isEditMode = mode === "edit";
  const isRenewalMode = mode === "renewal";

  if (modalTitle) {
    modalTitle.textContent = isEditMode
      ? "Update Client"
      : isRenewalMode
        ? "Create Renewal"
        : "Add Client";
  }

  if (submitBtn) {
    submitBtn.textContent = isEditMode
      ? "Update Client"
      : isRenewalMode
        ? "Create Renewal"
        : "Add Client";
    submitBtn.dataset.defaultText = submitBtn.textContent;
    submitBtn.disabled = false;
  }
}

function setLeadFormValue(name, value) {
  const field = document.querySelector(`#leadForm [name="${name}"]`);
  if (field) {
    field.value = value ?? "";
  }
}

function getLeadOtherInput(name) {
  return document.querySelector(`#leadForm [name="${name}_other"]`);
}

function updateLeadOtherInput(name) {
  const select = document.querySelector(`#leadForm [name="${name}"]`);
  const input = getLeadOtherInput(name);
  if (!select || !input) return;

  const shouldShow = select.value === "other";
  input.classList.toggle("hidden", !shouldShow);
  input.required = shouldShow;
  input.disabled = !shouldShow;
  if (!shouldShow) input.value = "";
}

function bindLeadOtherInputs() {
  ["source_lead", "industry_type"].forEach((name) => {
    const select = document.querySelector(`#leadForm [name="${name}"]`);
    if (!select || select.dataset.otherBound) return;
    select.addEventListener("change", () => updateLeadOtherInput(name));
    select.dataset.otherBound = "true";
    updateLeadOtherInput(name);
  });
}

function setLeadOtherAwareSelectValue(name, value) {
  const select = document.querySelector(`#leadForm [name="${name}"]`);
  const input = getLeadOtherInput(name);
  if (!select) return;

  const text = String(value ?? "").trim();
  const hasOption = Array.from(select.options).some(
    (option) => option.value === text,
  );

  if (!text) {
    select.value = "";
    if (input) input.value = "";
  } else if (hasOption) {
    select.value = text;
    if (input) input.value = "";
  } else {
    select.value = "other";
    if (input) input.value = text;
  }

  updateLeadOtherInput(name);
}

function getLeadOtherAwareFormValue(formData, name) {
  const selected = String(formData.get(name) || "").trim();
  if (selected !== "other") return selected;

  return String(formData.get(`${name}_other`) || "").trim() || selected;
}

function setLeadFormCheckboxGroup(name, values) {
  const selectedItems = parseStoredArray(values).map((item) => String(item));
  const selectedValues = new Set(selectedItems);
  const normalizedSelectedValues = new Set(
    selectedItems.map(normalizeLeadProductMatchValue).filter(Boolean),
  );

  document.querySelectorAll(`#leadForm [name="${name}"]`).forEach((input) => {
    const aliases = [
      input.value,
      ...(input.dataset.productAliases || "").split("|"),
    ].filter(Boolean);

    input.checked = aliases.some(
      (alias) =>
        selectedValues.has(alias) ||
        normalizedSelectedValues.has(normalizeLeadProductMatchValue(alias)),
    );
  });
}

function normalizeLeadCompanyScope(value) {
  const normalized = String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

  if (
    normalized === "redsea" ||
    normalized === "redseadigitals" ||
    normalized === "redseadigitalspvtltd"
  )
    return "redsea";
  if (
    normalized === "metrics" ||
    normalized === "metricsmart" ||
    normalized === "metricsmartinfolinepvtltd"
  ) {
    return "metrics";
  }

  return "";
}

function getDefaultLeadCompanyScope() {
  return (
    normalizeLeadCompanyScope(
      currentUser?.company_key ||
        currentUser?.selected_company ||
        currentUser?.comp_name,
    ) || "metrics"
  );
}

function setLeadCompanyScope(value = "") {
  setLeadFormValue(
    "company_scope",
    normalizeLeadCompanyScope(value) || getDefaultLeadCompanyScope(),
  );
}

function getLeadEmployeeCompanyScope(employee = {}) {
  return normalizeLeadCompanyScope(
    employee.company_scope ||
      employee.companyScope ||
      employee.company_key ||
      employee.companyKey ||
      employee.selected_company ||
      employee.comp_name ||
      employee.compName,
  );
}

function setLeadCompanyScopeFromSelectedEmployee(selectOrId) {
  const selectedEmployee = getSelectedEmployeeMeta(selectOrId);
  if (selectedEmployee.companyScope) {
    setLeadCompanyScope(selectedEmployee.companyScope);
  }
}

function resetLeadFormState() {
  editingLeadId = null;
  renewalLeadAttribution = null;

  const form = document.getElementById("leadForm");
  if (form) {
    form.reset();
    setLeadCompanyScope();
  }

  bindLeadOtherInputs();

  const employeeSelect = document.getElementById("lead_assign_emp");
  if (employeeSelect) {
    employeeSelect.innerHTML = '<option value="">Select Employee</option>';
  }

  const mapsLink = document.getElementById("maps_lnk");
  if (mapsLink) {
    mapsLink.value = "";
  }

  const leadLocation = document.getElementById("lead_location");
  if (leadLocation) {
    leadLocation.value = "";
  }

  setLeadFormMode("add");

  const actionType = document.getElementById("actionType");
  if (actionType) {
    actionType.value = "lead";
  }

  setLeadFormValue("sales_type", "new");
  setLeadCompanyScope();

  handleActionChange();
}

async function populateLeadForm(lead) {
  const normalizedActionType = String(lead.action_type || "")
    .toLowerCase()
    .trim();
  const actionTypeValue = ["appointment", "followup"].includes(
    normalizedActionType,
  )
    ? normalizedActionType
    : "lead";

  setLeadFormValue("company", lead.company_name);
  setLeadFormValue("client", lead.client_name);
  setLeadFormValue("contact", lead.contact);
  setLeadFormValue("alt_contact", lead.alternate_contact);
  setLeadFormValue("telephone", lead.telephone);
  setLeadFormValue("email", lead.email);
  setLeadFormValue("gst_no", lead.gst_no);

  setLeadFormValue("flat_no", lead.flat_no);
  setLeadFormValue("building_name", lead.building_name);
  setLeadFormValue("locality", lead.locality);
  setLeadFormValue("city", lead.city);
  setLeadFormValue("pincode", lead.pincode);
  setLeadFormValue("state", lead.state);
  setLeadFormValue("maps_lnk", lead.maps_lnk);
  setLeadCompanyScope(lead.company_scope);

  bindLeadOtherInputs();
  setLeadOtherAwareSelectValue("source_lead", lead.source_lead);
  setLeadOtherAwareSelectValue("industry_type", lead.industry_type);
  setLeadFormValue("sales_type", lead.sales_type || "new");

  await renderLeadProductCatalog(true);
  setLeadFormCheckboxGroup("web_type[]", lead.web_type);
  setLeadFormCheckboxGroup("seo_type[]", lead.seo_type);
  setLeadFormCheckboxGroup("smo_type[]", lead.smo_type);
  setLeadFormCheckboxGroup("app_type[]", lead.app_type);
  setLeadFormCheckboxGroup("erp_type[]", lead.erp_type);
  setLeadFormCheckboxGroup("services[]", lead.services);

  setLeadFormValue("service_notes", lead.service_notes);

  setLeadFormValue("app_date", formatDateForInput(lead.app_date));
  setLeadFormValue("app_time", formatTimeForInput(lead.app_time));
  setLeadFormValue("location", lead.location || lead.maps_lnk);

  setLeadFormValue("follow_date", formatDateForInput(lead.follow_date));
  setLeadFormValue("follow_time", formatTimeForInput(lead.follow_time));
  setLeadFormValue("reason", lead.reason);
  setLeadFormValue("additional_notes", lead.additional_notes);

  const leadLocation = document.getElementById("lead_location");
  if (leadLocation) {
    leadLocation.value = lead.location || lead.maps_lnk || "";
  }

  if (!lead.maps_lnk) {
    generateMapLink();
  }

  const actionType = document.getElementById("actionType");
  if (actionType) {
    actionType.value = actionTypeValue;
    await handleActionChange(lead.assign_emp || "");
  }
}

async function openLeadForm() {
  resetLeadFormState();
  bindLeadOtherInputs();
  showLeadModal();
  await renderLeadProductCatalog(true);

  // ── Duplicate contact check on blur ──
  const contactInput = document.getElementById("tmeLeadContactInput");
  const dupWarn = document.getElementById("tmeLeadContactDupWarn");
  const dupName = document.getElementById("tmeLeadContactDupName");
  if (contactInput && dupWarn && dupName) {
    contactInput.removeEventListener("blur", contactInput._tmeDupCheckFn);
    contactInput._tmeDupCheckFn = async function () {
      const val = contactInput.value.trim();
      dupWarn.style.display = "none";
      dupName.textContent = "";
      if (!val || val.replace(/\D/g, "").length < 7) return;
      try {
        const excludeParam = editingLeadId ? `&excludeId=${editingLeadId}` : "";
        const res = await fetch(
          `${BASE_URL}/api/leads/check-duplicate-contact?contact=${encodeURIComponent(val)}${excludeParam}`,
        );
        const data = await res.json();
        if (data.duplicate) {
          dupName.textContent =
            data.existingLead.company || data.existingLead.client || "";
          dupWarn.style.display = "block";
        }
      } catch (e) {}
    };
    contactInput.addEventListener("blur", contactInput._tmeDupCheckFn);
  }

  // ── Duplicate alt-contact check on blur ──
  const altContactInput = document.getElementById("tmeLeadAltContactInput");
  const altDupWarn = document.getElementById("tmeLeadAltContactDupWarn");
  const altDupName = document.getElementById("tmeLeadAltContactDupName");
  if (altContactInput && altDupWarn && altDupName) {
    altContactInput.removeEventListener("blur", altContactInput._tmeAltDupCheckFn);
    altContactInput._tmeAltDupCheckFn = async function () {
      const val = altContactInput.value.trim();
      altDupWarn.style.display = "none";
      altDupName.textContent = "";
      if (!val || val.replace(/\D/g, "").length < 7) return;
      try {
        const excludeParam = editingLeadId ? `&excludeId=${editingLeadId}` : "";
        const res = await fetch(
          `${BASE_URL}/api/leads/check-duplicate-contact?contact=${encodeURIComponent(val)}${excludeParam}`,
        );
        const data = await res.json();
        if (data.duplicate) {
          altDupName.textContent =
            data.existingLead.company || data.existingLead.client || "";
          altDupWarn.style.display = "block";
        }
      } catch (e) {}
    };
    altContactInput.addEventListener("blur", altContactInput._tmeAltDupCheckFn);
  }
}

function closeLeadForm() {
  const modal = document.getElementById("leadModal");
  if (modal) {
    if (modal.contains(document.activeElement)) {
      document.activeElement.blur();
      document.getElementById("addLeadBtn")?.focus({ preventScroll: true });
    }
    modal.classList.remove("show");
    modal.classList.add("hidden");
    modal.setAttribute("aria-hidden", "true");
  }
  resetLeadFormState();
}

function handleLeadModalBackdrop(event) {
  if (event?.target?.id === "leadModal") {
    closeLeadForm();
  }
}

async function handleActionChange(selectedEmployee = "") {
  const action = document.getElementById("actionType")?.value || "lead";
  const appointmentSection = document.getElementById("appointmentSection");
  const followupSection = document.getElementById("followupSection");

  if (action === "appointment") {
    setSectionVisibility(appointmentSection, true);
    setSectionVisibility(followupSection, false);
    await loadLeadEmployees(selectedEmployee);
  } else if (action === "followup") {
    setSectionVisibility(appointmentSection, false);
    setSectionVisibility(followupSection, true);
  } else {
    setSectionVisibility(appointmentSection, false);
    setSectionVisibility(followupSection, false);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  loadUserFromLocalStorage();

  if (currentUser) {
    fetchUserDataFromDB();
    loadTmeDashboard();
    loadLeads();
    loadReportsCounts();
  }

  const addBtn = document.getElementById("addLeadBtn");
  if (addBtn) addBtn.addEventListener("click", openLeadForm);

  const leadsTableBody = document.getElementById("leadsTableBody");
  if (leadsTableBody) {
    leadsTableBody.addEventListener("click", (event) => {
      const editButton = event.target.closest(".js-edit-lead");
      if (!editButton) return;

      event.preventDefault();
      const leadId = Number(editButton.dataset.leadId || 0);
      if (leadId) {
        void editLead(leadId);
      }
    });
  }

  const actionType = document.getElementById("actionType");
  if (actionType) {
    actionType.addEventListener("change", () => {
      void handleActionChange();
    });
    void handleActionChange();
  }

  const leadEmployeeSelect = document.getElementById("lead_assign_emp");
  if (leadEmployeeSelect && !leadEmployeeSelect.dataset.companyScopeBound) {
    leadEmployeeSelect.addEventListener("change", () => {
      setLeadCompanyScopeFromSelectedEmployee(leadEmployeeSelect);
    });
    leadEmployeeSelect.dataset.companyScopeBound = "true";
  }
});

async function apiFetch(url, options = {}) {
  const res = await fetch(url);

  if (!res.ok) {
    const text = await res.text();
    console.error("Server Error:", text);
    return;
  }

  const result = await res.json();
}

false &&
  document
    .getElementById("leadForm")
    .addEventListener("submit", async function (e) {
      e.preventDefault();

      const form = new FormData(this);
      const isEditMode = Boolean(editingLeadId);
      const actionTypeValue = document.getElementById("actionType").value;
      const salesTypeValue = form.get("sales_type") || "new";
      const renewalCreator =
        !isEditMode && salesTypeValue === "renewal"
          ? renewalLeadAttribution
          : null;
      const currentUserId = hydrateCurrentUserIdentity();
      const companyScope = getDefaultLeadCompanyScope();
      const selectedEmployee = getSelectedEmployeeMeta("lead_assign_emp");
      const shouldNotifyWhatsApp =
        !isEditMode && Boolean(selectedEmployee.name);
      const pendingWhatsAppWindow =
        openPendingWhatsAppWindow(shouldNotifyWhatsApp);

      const data = {
        company: form.get("company"),
        client: form.get("client"),
        contact: form.get("contact"),
        alt_contact: form.get("alt_contact"),
        telephone: form.get("telephone"),
        email: form.get("email"),
        gst_no: form.get("gst_no"),

        flat_no: form.get("flat_no"),
        building_name: form.get("building_name"),
        locality: form.get("locality"),
        city: form.get("city"),
        pincode: form.get("pincode"),
        state: form.get("state"),
        maps_lnk: form.get("maps_lnk"),
        source_lead: getLeadOtherAwareFormValue(form, "source_lead"),
        industry_type: getLeadOtherAwareFormValue(form, "industry_type"),
        sales_type: salesTypeValue,
        renewal_source_lead_id: renewalCreator?.sourceLeadId || null,

        web_type: form.getAll("web_type[]"),
        seo_type: form.getAll("seo_type[]"),
        smo_type: form.getAll("smo_type[]"),
        app_type: form.getAll("app_type[]"),
        erp_type: form.getAll("erp_type[]"),
        services: form.getAll("services[]"),

        service_notes: form.get("service_notes"),

        actionType: actionTypeValue,

        app_date: form.get("app_date"),
        app_time: form.get("app_time"),
        assign_emp: selectedEmployee.name,
        assign_emp_id: selectedEmployee.id,
        assign_emp_contact: selectedEmployee.contact,
        location: form.get("location"),

        follow_date: form.get("follow_date"),
        follow_time: form.get("follow_time"),
        reason: form.get("reason"),

        additional_notes: form.get("additional_notes"),
        created_by: renewalCreator?.createdBy || currentUserId || null,
        user_id: renewalCreator?.createdBy || currentUserId || null,
        created_by_name:
          renewalCreator?.createdByName || currentUser.name || "",
        company_scope: companyScope,
        notify_whatsapp: shouldNotifyWhatsApp,
      };

      try {
        const res = await fetch(
          isEditMode
            ? `${BASE_URL}/api/leads/${editingLeadId}`
            : `${BASE_URL}/api/leads`,
          {
            method: isEditMode ? "PUT" : "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(
              isEditMode
                ? {
                    ...data,
                    action_type: data.actionType,
                    mode: "full",
                  }
                : data,
            ),
          },
        );

        const result = await res.json();

        if (res.ok && result.success) {
          const feedbackMessage = completeWhatsAppDraft(
            pendingWhatsAppWindow,
            result.whatsapp,
            isEditMode
              ? "Client updated successfully."
              : "Client saved successfully.",
          );

          closeLeadForm();
          showPopup(
            isEditMode ? "Client Updated" : "Client Added",
            feedbackMessage,
            true,
          );
          loadLeads();
          loadAppointments();
          loadFollowedUp();
        } else {
          const errorDetails = result.error ? ` (${result.error})` : "";
          closePendingWhatsAppWindow(pendingWhatsAppWindow);
          showPopup(
            "Save Error",
            `${result.message || "Error saving client"}${errorDetails}`,
            false,
          );
        }
      } catch (err) {
        console.error(err);
        closePendingWhatsAppWindow(pendingWhatsAppWindow);
        showPopup("Server Error", "Server error", false);
      }
    });

async function loadLeads() {
  const tbody = document.getElementById("leadsTableBody");
  const noData = document.getElementById("noDataMessage");

  if (!tbody) return;
  const userId = hydrateCurrentUserIdentity();

  try {
    if (currentUser.role !== "admin" && !userId) {
      tbody.innerHTML = "";
      noData?.classList.remove("hidden");
      return;
    }

    const url =
      currentUser.role === "admin"
        ? `${BASE_URL}/api/leads?role=admin`
        : `${BASE_URL}/api/leads?userId=${userId}&role=${currentUser.role || "tme"}&scope=assigned`;

    // ✅ Sirf ye use kar
    const res = await fetch(url);

    const result = await res.json();

    let leadsData = result.data || [];
    const uniqueMap = new Map();
    leadsData.forEach(lead => {
      // Create a unique key using company name and contact to prevent over-deduplication
      const comp = lead.comp_name ? String(lead.comp_name).trim().toLowerCase() : '';
      const contact = lead.contact ? String(lead.contact).trim() : '';
      const key = contact ? `${comp}_${contact}` : `id_${lead.id}`;
      
      if (!uniqueMap.has(key)) {
        uniqueMap.set(key, lead);
      }
    });
    leadsData = Array.from(uniqueMap.values());

    const selectedMonth = document.getElementById("tmeLeadsMonthFilter")?.value || "";
    if (selectedMonth) {
      leadsData = leadsData.filter(item => {
        const dateVal = item.created_at || item.created_date || item.date;
        if (!dateVal) return false;
        const d = new Date(dateVal);
        if (isNaN(d)) return false;
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        return `${yyyy}-${mm}` === selectedMonth;
      });
    }

    if (!result.success || leadsData.length === 0) {
      tbody.innerHTML = "";
      noData.classList.remove("hidden");
      return;
    }

    noData.classList.add("hidden");
    tbody.innerHTML = "";

    leadsData.forEach((lead, index) => {
      const createdDate = formatTmeDisplayDate(lead.created_at);
      const normalizedStage = String(lead.action_type || "")
        .toLowerCase()
        .trim();
      const isGoogleMeet = isTmeGoogleMeetLead(lead);
      const isClosedDeal =
        String(lead.lead_status || "")
          .toLowerCase()
          .trim() === "deal_closed";
      const actionTypeLabel = isClosedDeal
        ? "DEAL CLOSED"
        : normalizedStage === "appointment"
          ? isGoogleMeet
            ? "GOOGLE MEET"
            : "APPOINTMENT"
          : normalizedStage === "followup"
            ? "FOLLOW UP"
            : "LEAD";
      const statusClass = isClosedDeal
        ? "deal"
        : normalizedStage === "appointment"
      ? "appointment"
      : normalizedStage === "followup"
            ? "followup"
            : "lead";
      const canMoveLead = !isClosedDeal;

      const row = `
        <tr>
            <td>${index + 1}</td>
            <td><strong>${escapeTmeHtml(lead.company_name || "-")}</strong></td>
            <td>${escapeTmeHtml(lead.client_name || "-")}</td>
            <td>${escapeTmeHtml(lead.contact || "-")}</td>
            <td>${escapeTmeHtml(lead.city || "-")}</td>
            <td>${escapeTmeHtml(lead.source_lead || "-")}</td>

            <td>
                <span class="status-badge ${statusClass}">
                    ${escapeTmeHtml(actionTypeLabel)}
                </span>
            </td>

            <td>${escapeTmeHtml(createdDate)}</td>

            <td class="actions">
                ${
                  canMoveLead && normalizedStage !== "appointment"
                    ? `
                <button type="button" onclick="convertToAppointment(${Number(lead.id)})" class="btn-appointment" title="Set Appointment">
                    <i class="fas fa-calendar-plus"></i><span>Appointment</span>
                </button>`
                    : ""
                }

                ${
                  canMoveLead && !isGoogleMeet
                    ? `
                <button type="button" onclick="convertToAppointment(${Number(lead.id)}, 'google_meet')" class="btn-appointment" title="Schedule Google Meet">
                    <i class="fas fa-video"></i><span>Google Meet</span>
                </button>`
                    : ""
                }

                ${
                  canMoveLead && normalizedStage !== "followup"
                    ? `
                <button type="button" onclick="openFollowupModal(${Number(lead.id)})" class="btn-followup" title="Set Follow Up">
                    <i class="fas fa-clock"></i><span>Follow Up</span>
                </button>`
                    : ""
                }

                <button
                  type="button"
                  class="btn-edit js-edit-lead"
                  data-lead-id="${Number(lead.id)}"
                  title="Update lead data"
                  aria-label="Update ${escapeTmeHtml(lead.company_name || "lead")}"
                >
                    <i class="fas fa-edit"></i>
                    <span>Update</span>
                </button>

            </td>
        </tr>
      `;

      tbody.innerHTML += row;
    });
  } catch (err) {
    console.error("Error loading leads:", err);
    tbody.innerHTML = `
      <tr>
        <td colspan="9" style="text-align:center; color:red;">
          Server error while loading leads
        </td>
      </tr>`;
  }
}

function viewLead(id) {
  return editLead(id);
}

async function editLead(id) {
  try {
    const res = await fetch(`${BASE_URL}/api/leads/${id}`, {
      cache: "no-store",
    });
    const result = await res.json();

    if (!result.success || !result.data) {
      alert(result.message || "Unable to load lead details");
      return;
    }

    resetLeadFormState();
    editingLeadId = result.data.id || id;
    setLeadFormMode("edit");
    await populateLeadForm(result.data);
    showLeadModal();
  } catch (err) {
    console.error("Error fetching lead for edit:", err);
    alert("Server error");
  }
}

async function openRenewalFromDeal(id) {
  try {
    const res = await fetch(`${BASE_URL}/api/leads/${id}`, {
      cache: "no-store",
    });
    const result = await res.json();

    if (!result.success || !result.data) {
      showPopup(
        "Renewal",
        result.message || "Unable to load deal details",
        false,
      );
      return;
    }

    const lead = result.data;

    // Check if renewal is already started or closed
    if (Number(lead.renewal_count || 0) > 0 || Number(lead.renewal_closed_count || 0) > 0) {
      showPopup("Renewal", "Renewal is already started or completed for this deal.", false);
      return;
    }

    const currentUserId = hydrateCurrentUserIdentity();
    const companyScope = getDefaultLeadCompanyScope();

    const renewalData = {
      company: lead.company_name,
      client: lead.client_name,
      contact: lead.contact,
      alt_contact: lead.alternate_contact || "",
      telephone: lead.telephone || "",
      email: lead.email || "",
      gst_no: lead.gst_no || "",
      flat_no: lead.flat_no || "",
      building_name: lead.building_name || "",
      locality: lead.locality,
      city: lead.city,
      pincode: lead.pincode,
      state: lead.state,
      maps_lnk: lead.maps_lnk || "",
      source_lead: lead.source_lead || "other",
      industry_type: lead.industry_type || "other",
      sales_type: "renewal",
      renewal_source_lead_id: lead.id,
      web_type: Array.isArray(lead.web_type) ? lead.web_type : JSON.parse(lead.web_type || "[]"),
      seo_type: Array.isArray(lead.seo_type) ? lead.seo_type : JSON.parse(lead.seo_type || "[]"),
      smo_type: Array.isArray(lead.smo_type) ? lead.smo_type : JSON.parse(lead.smo_type || "[]"),
      app_type: Array.isArray(lead.app_type) ? lead.app_type : JSON.parse(lead.app_type || "[]"),
      erp_type: Array.isArray(lead.erp_type) ? lead.erp_type : JSON.parse(lead.erp_type || "[]"),
      services: Array.isArray(lead.services) ? lead.services : JSON.parse(lead.services || "[]"),
      service_notes: lead.service_notes || "",
      actionType: "lead",
      created_by: currentUserId || lead.created_by,
      user_id: currentUserId || lead.created_by,
      company_scope: companyScope || "unassigned",
      notify_whatsapp: false
    };

    showPopup("Renewal", "Starting renewal... Please wait.", true);

    const postRes = await fetch(`${BASE_URL}/api/leads`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(renewalData),
    });
    const postResult = await postRes.json();

    if (!postRes.ok || !postResult.success) {
      throw new Error(postResult.message || "Failed to start renewal lead");
    }

    showPopup("Success", "Renewal started successfully! Lead created.", true);
    loadDeals(); // Refresh TME deals table
  } catch (err) {
    console.error("Renewal lead start error:", err);
    showPopup("Renewal Error", err.message || "Server error while starting renewal", false);
  }
}

function setTmeAppointmentModalMode(mode = "appointment") {
  const isGoogleMeet = mode === "google_meet";
  tmeAppointmentMode = isGoogleMeet ? "google_meet" : "appointment";

  const modalTitle = document.getElementById("appointmentModalTitle");
  const dateLabel = document.getElementById("appointmentDateLabel");
  const timeLabel = document.getElementById("appointmentTimeLabel");
  const locationLabel = document.getElementById("appointmentLocationLabel");
  const locationField = document.getElementById("location");
  const saveButton = document.getElementById("appointmentSaveBtn");

  if (modalTitle) {
    modalTitle.textContent = isGoogleMeet
      ? "Schedule Google Meet for Lead"
      : "Set Appointment for Lead";
  }
  if (dateLabel) {
    dateLabel.innerHTML = isGoogleMeet
      ? 'Meeting Date <span style="color: red">*</span>'
      : 'Appointment Date <span style="color: red">*</span>';
  }
  if (timeLabel) {
    timeLabel.innerHTML = isGoogleMeet
      ? 'Meeting Time <span style="color: red">*</span>'
      : 'Appointment Time <span style="color: red">*</span>';
  }
  if (saveButton) {
    saveButton.textContent = isGoogleMeet ? "Save Google Meet" : "Save Appointment";
  }
  if (locationLabel) {
    locationLabel.classList.toggle("hidden", isGoogleMeet);
  }
  if (locationField) {
    locationField.classList.toggle("hidden", isGoogleMeet);
    locationField.disabled = isGoogleMeet;
    if (isGoogleMeet) locationField.value = "";
  }
}

async function convertToAppointment(leadId, mode = "appointment") {
  setTmeAppointmentModalMode(mode);

  try {
    const res = await fetch(`/api/leads/${leadId}`);
    const result = await res.json();
    if (result.success) {
      const lead = result.data;
      const locationValue = lead.maps_lnk || lead.location || "";
      const locationField = document.getElementById("location");
      if (locationField && tmeAppointmentMode !== "google_meet") {
        locationField.value = locationValue;
      }
      document.getElementById("leadInfo").innerHTML = `
                <strong>${lead.company_name}</strong> - ${lead.client_name}
                ${
                  tmeAppointmentMode === "google_meet"
                    ? "<br><small>Google Meet appointment type will be saved.</small>"
                    : ""
                }
            `;
    }
  } catch (e) {
    console.error("Error fetching lead:", e);
  }
  document.getElementById("leadIdToUpdate").value = leadId;
  const modal = document.getElementById("appointmentModal");
  modal.classList.remove("hidden");
  modal.classList.add("show");
  document.getElementById("app_date").value = "";
  document.getElementById("app_time").value = "";
  loadAvailableEmployees();
}

async function openAppointmentReschedule(leadId) {
  try {
    setTmeAppointmentModalMode("appointment");
    const res = await fetch(`/api/leads/${leadId}`, { cache: "no-store" });
    const result = await res.json();

    if (!result.success || !result.data) {
      throw new Error(result.message || "Unable to load appointment");
    }

    const lead = result.data;
    const modalTitle = document.getElementById("appointmentModalTitle");
    const saveButton = document.getElementById("appointmentSaveBtn");
    const modal = document.getElementById("appointmentModal");
    const locationValue = lead.maps_lnk || lead.location || "";

    if (modalTitle) modalTitle.textContent = "Reschedule Appointment";
    if (saveButton) saveButton.textContent = "Save Reschedule";

    document.getElementById("leadIdToUpdate").value = leadId;
    document.getElementById("leadInfo").innerHTML = `
      <strong>${escapeTmeHtml(lead.company_name || "-")}</strong> - ${escapeTmeHtml(lead.client_name || "-")}
    `;
    document.getElementById("app_date").value = formatDateForInput(lead.app_date);
    document.getElementById("app_time").value = formatTimeForInput(lead.app_time);
    document.getElementById("location").value = locationValue;

    if (modal) {
      modal.classList.remove("hidden");
      modal.classList.add("show");
    }

    await loadAvailableEmployees(lead.assign_emp || "", {
      id: lead.assign_emp_id,
      contact: lead.assign_emp_contact,
      companyScope: lead.company_scope,
    });
  } catch (err) {
    console.error("Appointment reschedule open error:", err);
    showPopup("Reschedule", err.message || "Unable to open reschedule form", false);
  }
}

window.openAppointmentReschedule = openAppointmentReschedule;

// Close Modal
function closeAppointmentModal() {
  const modal = document.getElementById("appointmentModal");
  modal.classList.remove("show");
  modal.classList.add("hidden");
  document.getElementById("appointmentForm").reset();
  setTmeAppointmentModalMode("appointment");
}

async function openFollowupModal(leadId) {
  try {
    const res = await fetch(`/api/leads/${leadId}`);
    const result = await res.json();

    if (result.success) {
      const lead = result.data;
      document.getElementById("followupLeadInfo").innerHTML = `
        <strong>${escapeTmeHtml(lead.company_name || "Lead")}</strong> - ${escapeTmeHtml(lead.client_name || "-")}
      `;
      document.getElementById("leadFollowReason").value = lead.reason || "";
      document.getElementById("leadFollowDate").value = formatDateForInput(
        lead.follow_date,
      );
      document.getElementById("leadFollowTime").value = formatTimeForInput(
        lead.follow_time,
      );
    }
  } catch (err) {
    console.error("Error fetching lead:", err);
    document.getElementById("followupLeadInfo").textContent =
      "Lead details unavailable";
  }

  document.getElementById("followupLeadIdToUpdate").value = leadId;
  const modal = document.getElementById("followupModal");
  modal.classList.remove("hidden");
  modal.classList.add("show");
}

function closeFollowupModal() {
  const modal = document.getElementById("followupModal");
  modal.classList.remove("show");
  modal.classList.add("hidden");
  document.getElementById("leadFollowupForm").reset();
}

async function handleFollowupFormSubmit(event) {
  event.preventDefault();
  event.stopImmediatePropagation();

  const leadId = document.getElementById("followupLeadIdToUpdate").value;
  const updateData = {
    action_type: "followup",
    follow_date: document.getElementById("leadFollowDate").value,
    follow_time: document.getElementById("leadFollowTime").value,
    reason: document.getElementById("leadFollowReason").value,
    created_by_name: currentUser?.name || "",
  };

  try {
    const res = await fetch(`/api/leads/${leadId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updateData),
    });
    const result = await res.json();

    if (!res.ok || !result.success) {
      throw new Error(result.message || "Failed to update follow up");
    }

    closeFollowupModal();
    showPopup("Follow Up Saved", "Lead moved to follow up successfully.", true);
    loadLeads();
    loadFollowedUp();
    loadTmeDashboard();
  } catch (err) {
    console.error("Follow up update error:", err);
    showPopup(
      "Follow Up Error",
      err.message || "Failed to update follow up",
      false,
    );
  }
}

// Form Submit - Update Lead to Appointment
false &&
  document
    .getElementById("appointmentForm")
    .addEventListener("submit", async function (e) {
      e.preventDefault();

      const leadId = document.getElementById("leadIdToUpdate").value;
      const selectedEmployee = getSelectedEmployeeMeta("assign_emp");
      const shouldNotifyWhatsApp = Boolean(selectedEmployee.name);
      const pendingWhatsAppWindow =
        openPendingWhatsAppWindow(shouldNotifyWhatsApp);

      const updateData = {
        action_type: "appointment",
        app_date: document.getElementById("app_date").value,
        app_time: document.getElementById("app_time").value,
        assign_emp: selectedEmployee.name,
        assign_emp_id: selectedEmployee.id,
        assign_emp_contact: selectedEmployee.contact,
        location: document.getElementById("location").value,
        notify_whatsapp: shouldNotifyWhatsApp,
        created_by_name: currentUser?.name || "",
      };

      try {
        const res = await fetch(`/api/leads/${leadId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updateData),
        });

        const result = await res.json();

        if (result.success) {
          alert("Appointment Set Successfully! ✅");
          closeAppointmentModal();
          loadLeads(); // Table refresh
        } else {
          closePendingWhatsAppWindow(pendingWhatsAppWindow);
          showPopup(
            "Appointment Error",
            result.message || "Failed to update appointment",
            false,
          );
          return;
          alert("Failed to update: " + (result.message || ""));
        }
      } catch (err) {
        console.error(err);
        closePendingWhatsAppWindow(pendingWhatsAppWindow);
        showPopup("Server Error", "Server error", false);
        return;
        alert("Server error");
      }
    });

async function handleLeadFormSubmit(event) {
  event.preventDefault();
  event.stopImmediatePropagation();

  const submitBtn = document.getElementById("leadSubmitBtn");
  const originalSubmitText =
    submitBtn?.dataset.defaultText || submitBtn?.textContent || "Save";
  const form = new FormData(event.currentTarget);
  const isEditMode = Boolean(editingLeadId);
  const salesTypeValue = form.get("sales_type") || "new";
  const actionTypeValue = document.getElementById("actionType").value;
  const currentUserId = hydrateCurrentUserIdentity();
  const companyScope = getDefaultLeadCompanyScope();
  const renewalCreator =
    !isEditMode && salesTypeValue === "renewal" ? renewalLeadAttribution : null;
  const selectedEmployee = getSelectedEmployeeMeta("lead_assign_emp");
  const shouldNotifyWhatsApp = !isEditMode && Boolean(selectedEmployee.name);
  const pendingWhatsAppWindow = openPendingWhatsAppWindow(shouldNotifyWhatsApp);

  const data = {
    company: form.get("company"),
    client: form.get("client"),
    contact: form.get("contact"),
    alt_contact: form.get("alt_contact"),
    telephone: form.get("telephone"),
    email: form.get("email"),
    gst_no: form.get("gst_no"),
    flat_no: form.get("flat_no"),
    building_name: form.get("building_name"),
    locality: form.get("locality"),
    city: form.get("city"),
    pincode: form.get("pincode"),
    state: form.get("state"),
    maps_lnk: form.get("maps_lnk"),
    source_lead: getLeadOtherAwareFormValue(form, "source_lead"),
    industry_type: getLeadOtherAwareFormValue(form, "industry_type"),
    sales_type: salesTypeValue,
    renewal_source_lead_id: renewalCreator?.sourceLeadId || null,
    web_type: form.getAll("web_type[]"),
    seo_type: form.getAll("seo_type[]"),
    smo_type: form.getAll("smo_type[]"),
    app_type: form.getAll("app_type[]"),
    erp_type: form.getAll("erp_type[]"),
    services: form.getAll("services[]"),
    service_notes: form.get("service_notes"),
    actionType: actionTypeValue,
    app_date: form.get("app_date"),
    app_time: form.get("app_time"),
    assign_emp: selectedEmployee.name,
    assign_emp_id: selectedEmployee.id,
    assign_emp_contact: selectedEmployee.contact,
    location: form.get("location"),
    follow_date: form.get("follow_date"),
    follow_time: form.get("follow_time"),
    reason: form.get("reason"),
    additional_notes: form.get("additional_notes"),
    created_by: renewalCreator?.createdBy || currentUserId || null,
    user_id: renewalCreator?.createdBy || currentUserId || null,
    created_by_name: renewalCreator?.createdByName || currentUser.name || "",
    company_scope: companyScope,
    notify_whatsapp: shouldNotifyWhatsApp,
  };

  try {
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = isEditMode ? "Updating..." : "Saving...";
    }

    const res = await fetch(
      isEditMode
        ? `${BASE_URL}/api/leads/${editingLeadId}`
        : `${BASE_URL}/api/leads`,
      {
        method: isEditMode ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(
          isEditMode
            ? {
                ...data,
                action_type: data.actionType,
                mode: "full",
              }
            : data,
        ),
      },
    );

    const result = await res.json();

    if (res.ok && result.success) {
      const feedbackMessage = completeWhatsAppDraft(
        pendingWhatsAppWindow,
        result.whatsapp,
        isEditMode
          ? "Client updated successfully."
          : "Client saved successfully.",
      );

      closeLeadForm();
      showPopup(
        isEditMode ? "Client Updated" : "Client Added",
        feedbackMessage,
        true,
      );
      loadLeads();
      loadAppointments();
      loadFollowedUp();
      return;
    }

    const errorDetails = result.error ? ` (${result.error})` : "";
    closePendingWhatsAppWindow(pendingWhatsAppWindow);
    showPopup(
      "Save Error",
      `${result.message || "Error saving client"}${errorDetails}`,
      false,
    );
  } catch (err) {
    console.error(err);
    closePendingWhatsAppWindow(pendingWhatsAppWindow);
    showPopup("Server Error", "Server error", false);
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = originalSubmitText;
    }
  }
}

async function getAppointmentLeadWhatsappDetails(leadId) {
  try {
    const response = await fetch(`/api/leads/${leadId}`, { cache: "no-store" });
    const result = await response.json();

    if (!response.ok || !result.success || !result.data) {
      throw new Error(result.message || "Lead details unavailable");
    }

    const lead = result.data;
    return {
      company: lead.company_name || "",
      company_name: lead.company_name || "",
      client: lead.client_name || "",
      client_name: lead.client_name || "",
      contact: lead.contact || "",
      alt_contact: lead.alternate_contact || "",
      alternate_contact: lead.alternate_contact || "",
      telephone: lead.telephone || "",
      email: lead.email || "",
      gst_no: lead.gst_no || "",
      flat_no: lead.flat_no || "",
      building_name: lead.building_name || "",
      locality: lead.locality || "",
      city: lead.city || "",
      pincode: lead.pincode || "",
      state: lead.state || "",
      maps_lnk: lead.maps_lnk || "",
      source_lead: lead.source_lead || "",
      industry_type: lead.industry_type || "",
      sales_type: lead.sales_type || "new",
      web_type: lead.web_type || [],
      seo_type: lead.seo_type || [],
      smo_type: lead.smo_type || [],
      app_type: lead.app_type || [],
      erp_type: lead.erp_type || [],
      services: lead.services || [],
      service_notes: lead.service_notes || "",
      additional_notes: lead.additional_notes || "",
    };
  } catch (err) {
    console.warn(
      "Appointment WhatsApp lead details fallback:",
      err.message || err,
    );
    return {};
  }
}

async function handleAppointmentFormSubmit(event) {
  event.preventDefault();
  event.stopImmediatePropagation();

  const leadId = document.getElementById("leadIdToUpdate").value;
  const selectedEmployee = getSelectedEmployeeMeta("assign_emp");
  const shouldNotifyWhatsApp = Boolean(selectedEmployee.name);
  const pendingWhatsAppWindow = openPendingWhatsAppWindow(shouldNotifyWhatsApp);
  const leadWhatsappDetails = shouldNotifyWhatsApp
    ? await getAppointmentLeadWhatsappDetails(leadId)
    : {};
  const meetingType =
    tmeAppointmentMode === "google_meet" ? "google_meet" : "appointment";

  const updateData = {
    ...leadWhatsappDetails,
    action_type: "appointment",
    meeting_type: meetingType,
    app_date: document.getElementById("app_date").value,
    app_time: document.getElementById("app_time").value,
    assign_emp: selectedEmployee.name,
    assign_emp_id: selectedEmployee.id,
    assign_emp_contact: selectedEmployee.contact,
    location:
      meetingType === "google_meet"
        ? null
        : document.getElementById("location").value,
    notify_whatsapp: shouldNotifyWhatsApp,
    created_by_name: currentUser?.name || "",
  };

  try {
    const res = await fetch(`/api/leads/${leadId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updateData),
    });

    const result = await res.json();

    if (result.success) {
      const feedbackMessage = completeWhatsAppDraft(
        pendingWhatsAppWindow,
        result.whatsapp,
        meetingType === "google_meet"
          ? "Google Meet scheduled successfully."
          : "Appointment set successfully.",
      );

      closeAppointmentModal();
      showPopup(
        meetingType === "google_meet" ? "Google Meet Saved" : "Appointment Saved",
        feedbackMessage,
        true,
      );
      loadLeads();
      loadAppointments();
      loadFollowedUp();
      return;
    }

    closePendingWhatsAppWindow(pendingWhatsAppWindow);
    showPopup(
      "Appointment Error",
      result.message || "Failed to update appointment",
      false,
    );
  } catch (err) {
    console.error(err);
    closePendingWhatsAppWindow(pendingWhatsAppWindow);
    showPopup("Server Error", "Server error", false);
  }
}

const leadFormElement = document.getElementById("leadForm");
if (leadFormElement) {
  leadFormElement.addEventListener("submit", handleLeadFormSubmit, true);
}

document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;

  const leadModal = document.getElementById("leadModal");
  if (leadModal && !leadModal.classList.contains("hidden")) {
    closeLeadForm();
  }

  const followupModal = document.getElementById("followupModal");
  if (followupModal && !followupModal.classList.contains("hidden")) {
    closeFollowupModal();
  }
});

const appointmentFormElement = document.getElementById("appointmentForm");
if (appointmentFormElement) {
  appointmentFormElement.addEventListener(
    "submit",
    handleAppointmentFormSubmit,
    true,
  );
}

const followupFormElement = document.getElementById("leadFollowupForm");
if (followupFormElement) {
  followupFormElement.addEventListener(
    "submit",
    handleFollowupFormSubmit,
    true,
  );
}

// Load Available ME Employees (avoid double booking)
async function loadAvailableEmployees(selectedEmployee = "", selectedMeta = {}) {
  const date = document.getElementById("app_date").value;
  const time = document.getElementById("app_time").value;
  const select = document.getElementById("assign_emp");

  try {
    const result = await fetchEmployeeList(date, time);
    if (!result.success) throw new Error("Failed to load employees");

    populateEmployeeSelect(
      select,
      result.data || [],
      date && time
        ? "No employee available at this time"
        : "No employees found",
    );
    ensureSelectValue(select, selectedEmployee);

    const selectedOption = Array.from(select.options).find(
      (option) => option.value === String(selectedEmployee || ""),
    );
    if (selectedOption) {
      if (selectedMeta.id != null && selectedMeta.id !== "") {
        selectedOption.dataset.employeeId = String(selectedMeta.id);
      }
      if (selectedMeta.contact) {
        selectedOption.dataset.employeeContact = String(selectedMeta.contact);
      }
      if (selectedMeta.companyScope) {
        selectedOption.dataset.employeeCompanyScope = String(selectedMeta.companyScope);
      }
    }
  } catch (err) {
    console.error("Error loading employees:", err);
    populateEmployeeSelect(select, [], "Unable to load employees");
    ensureSelectValue(select, selectedEmployee);
  }
}

async function loadLeadEmployees(selectedEmployee = "") {
  const date = document.getElementById("lead_app_date").value;
  const time = document.getElementById("lead_app_time").value;
  const select = document.getElementById("lead_assign_emp");

  try {
    const result = await fetchEmployeeList(date, time);
    if (!result.success) throw new Error("Failed to load employees");

    populateEmployeeSelect(
      select,
      result.data || [],
      date && time ? "No employee available" : "No employees found",
    );
    ensureSelectValue(select, selectedEmployee);
    setLeadCompanyScopeFromSelectedEmployee(select);
  } catch (err) {
    console.error("Error loading employees:", err);
    populateEmployeeSelect(select, [], "Unable to load employees");
  }
}

function generateMapLink() {
  const flat = document.querySelector('[name="flat_no"]').value || "";
  const building = document.querySelector('[name="building_name"]').value || "";
  const locality = document.querySelector('[name="locality"]').value || "";
  const city = document.querySelector('[name="city"]').value || "";
  const pincode = document.querySelector('[name="pincode"]').value || "";
  const state = document.querySelector('[name="state"]').value || "";
  const fullAddress = `${flat}, ${building}, ${locality}, ${city}, ${pincode}, ${state}`;
  const encodedAddress = encodeURIComponent(fullAddress);
  const mapLink = `https://www.google.com/maps?q=${encodedAddress}`;
  document.getElementById("maps_lnk").value = mapLink;
  document.getElementById("lead_location").value = mapLink;
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

window.onload = function () {
  loadUserFromLocalStorage();
  fetchUserDataFromDB();
  loadTmeDashboard();
  loadLeads();
  loadReportsCounts();
  loadDeals(); // 🔥 ADD THIS LINE

  const paymentForm = document.getElementById("tmeDealPaymentForm");
  if (paymentForm) {
    paymentForm.addEventListener("submit", handleTmeDealPaymentSubmit);
  }

  const paymentAmountInput = document.getElementById("tmeDealPaymentAmount");
  if (paymentAmountInput) {
    paymentAmountInput.addEventListener("input", updateTmeDealPaymentBreakupPreview);
    updateTmeDealPaymentBreakupPreview();
  }
};

// --- TME Lead Details Modal ---
function formatTmeLeadDetailsValue(value) {
  const text = String(value ?? "").trim();
  return text || "-";
}

function formatTmeLeadHumanLabel(value) {
  return String(value || "")
      .replace(/_/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .replace(/\b\w/g, char => char.toUpperCase()) || "-";
}

function formatTmeLeadDetailsList(value) {
  let arr = [];
  if (Array.isArray(value)) arr = value;
  else if (typeof value === "string") {
      try { arr = JSON.parse(value); } catch (e) { arr = value.split(","); }
  }
  const labels = arr.map(item => {
      const normalized = String(item || "").trim();
      if (normalized === "ads") return "Google Ads";
      if (normalized === "google_profile") return "Google Profile";
      return formatTmeLeadHumanLabel(normalized);
  });
  return labels.length ? labels.join(", ") : "-";
}


function getTmeLeadDealProducts(lead = {}) {
  return Array.isArray(lead.deal_products)
    ? lead.deal_products
    : Array.isArray(lead.dealProducts)
    ? lead.dealProducts
    : [];
}

function formatTmeLeadDealProducts(lead = {}) {
  const products = getTmeLeadDealProducts(lead);
  if (!products.length) {
    return escapeTmeHtml(
      formatTmeLeadDetailsList(lead.deal_services || lead.services),
    );
  }

  return products
    .map((product) => {
      const name = String(product.product_name || product.name || "").trim();
      const amount = Number(product.product_amount || product.amount || 0);
      const amountText =
        Number.isFinite(amount) && amount > 0
          ? ` - ${formatDashboardMoney(amount)}`
          : "";
      return escapeTmeHtml(`${name || "Service"}${amountText}`);
    })
    .join("<br>");
}

function getTmeLeadRenewalDetails(lead = {}) {
  return Array.isArray(lead.renewal_details)
    ? lead.renewal_details
    : Array.isArray(lead.renewalDetails)
    ? lead.renewalDetails
    : [];
}

function getTmeLeadSourceRenewalDetails(lead = {}) {
  return Array.isArray(lead.source_renewal_details)
    ? lead.source_renewal_details
    : Array.isArray(lead.sourceRenewalDetails)
    ? lead.sourceRenewalDetails
    : [];
}

function getTmeLeadRenewalLeads(lead = {}) {
  return Array.isArray(lead.renewal_leads)
    ? lead.renewal_leads
    : Array.isArray(lead.renewalLeads)
    ? lead.renewalLeads
    : [];
}

function formatTmeLeadRenewalRows(rows = []) {
  if (!Array.isArray(rows) || !rows.length) return "-";

  return rows
    .map((item) => {
      const serviceName = String(item.service_name || item.serviceName || "Service").trim();
      const amount = Number(item.service_amount || item.amount || 0);
      const basis =
        item.renewal_basis_label ||
        formatTmeLeadHumanLabel(item.renewal_basis || item.renewalBasis);
      const status = item.status_label || formatTmeLeadHumanLabel(item.status || "active");
      const dueDate = item.renewal_due_date || item.next_start_date || "";
      const lastPaid = item.last_payment_date || "";
      const parts = [
        `${serviceName}${Number.isFinite(amount) && amount > 0 ? ` - ${formatDashboardMoney(amount)}` : ""}`,
        basis,
        status,
        dueDate ? `Due: ${formatTmeDisplayDate(dueDate)}` : "",
        lastPaid ? `Last Paid: ${formatTmeDisplayDate(lastPaid)}` : "",
      ].filter(Boolean);
      return escapeTmeHtml(parts.join(" | "));
    })
    .join("<br>");
}

function formatTmeLeadRenewalLeadRows(rows = []) {
  if (!Array.isArray(rows) || !rows.length) return "-";

  return rows
    .map((item) => {
      const status = formatTmeLeadHumanLabel(item.lead_status || "active");
      const amount = Number(item.deal_amount || 0);
      const date = item.closed_date || item.created_date || "";
      const parts = [
        `#${Number(item.id || 0) || "-"}`,
        status,
        Number.isFinite(amount) && amount > 0 ? formatDashboardMoney(amount) : "",
        date ? formatTmeDisplayDate(date) : "",
        item.closed_by_name ? `Closed By: ${item.closed_by_name}` : "",
      ].filter(Boolean);
      return escapeTmeHtml(parts.join(" | "));
    })
    .join("<br>");
}

function hasTmeLeadRenewalDetails(lead = {}) {
  return (
    String(lead.sales_type || "").toLowerCase().trim() === "renewal" ||
    Number(lead.renewal_source_lead_id || 0) > 0 ||
    Number(lead.renewal_count || 0) > 0 ||
    Number(lead.active_renewal_count || 0) > 0 ||
    Number(lead.renewal_closed_count || 0) > 0 ||
    getTmeLeadRenewalDetails(lead).length > 0 ||
    getTmeLeadSourceRenewalDetails(lead).length > 0 ||
    getTmeLeadRenewalLeads(lead).length > 0
  );
}


function buildTmeLeadDetailsMapValue(lead = {}) {
  const raw = String(lead.maps_lnk || lead.location || "").trim();
  if (!raw) return "-";
  const url = /^https?:\/\//i.test(raw)
      ? raw
      : `https://www.google.com/maps?q=${encodeURIComponent(raw)}`;
  return `
      <a href="${escapeTmeHtml(url)}" target="_blank" rel="noopener noreferrer" class="admin-location-link" style="color: #2563eb; text-decoration: underline;">
          View Location
      </a>
  `;
}

function renderTmeLeadDetailsSection(title, rows = []) {
  const rowHtml = rows
      .map(([label, value, isHtml = false]) => {
          const content = isHtml
              ? value || "-"
              : escapeTmeHtml(formatTmeLeadDetailsValue(value));
          return `
              <div class="admin-lead-detail-item">
                  <span>${escapeTmeHtml(label)}</span>
                  <strong>${content}</strong>
              </div>
          `;
      })
      .join("");
  return `
      <section class="admin-lead-detail-section">
          <h3>${escapeTmeHtml(title)}</h3>
          <div class="admin-lead-detail-grid">${rowHtml}</div>
      </section>
  `;
}

function renderTmeLeadDetails(lead = {}) {
  const hasDealDetails =
    String(lead.lead_status || "").toLowerCase().trim() === "deal_closed" ||
    [
      lead.deal_amount,
      lead.deal_products_total,
      lead.received_amount,
      lead.remaining_amount,
      lead.gst_amount,
      lead.payment_method,
      lead.payment_date,
      lead.closed_date,
      lead.pay_stat,
    ].some((value) => String(value ?? "").trim()) ||
    getTmeLeadDealProducts(lead).length > 0;

  const sections = [
    renderTmeLeadDetailsSection("Client", [
      ["Company", lead.company_name],
      ["Client", lead.client_name],
      ["Contact", lead.contact],
      ["Alternate Contact", lead.alternate_contact],
      ["Telephone", lead.telephone],
      ["Email", lead.email],
      ["GST Number", lead.gst_no],
    ]),
    renderTmeLeadDetailsSection("Address", [
      ["Flat / Office", lead.flat_no],
      ["Building", lead.building_name],
      ["Locality", lead.locality],
      ["City", lead.city],
      ["Pincode", lead.pincode],
      ["State", lead.state],
      ["Map", buildTmeLeadDetailsMapValue(lead), true],
    ]),
    renderTmeLeadDetailsSection("Services", [
      ["Web", formatTmeLeadDetailsList(lead.web_type)],
      ["SEO", formatTmeLeadDetailsList(lead.seo_type)],
      ["SMO", formatTmeLeadDetailsList(lead.smo_type)],
      ["App", formatTmeLeadDetailsList(lead.app_type)],
      ["ERP/CRM", formatTmeLeadDetailsList(lead.erp_type)],
      ["Other Services", formatTmeLeadDetailsList(lead.services)],
      ["Service Notes", lead.service_notes],
    ]),
    renderTmeLeadDetailsSection("Appointment", [
      ["Date", lead.app_date ? lead.app_date.substring(0, 10) : "-"],
      ["Time", lead.app_time],
      ["Assigned ME", lead.assigned_me_name || lead.me_name || lead.assign_emp],
      ["Source", formatTmeLeadHumanLabel(lead.source_lead)],
      ["Industry", formatTmeLeadHumanLabel(lead.industry_type)],
      ["Sales Type", formatTmeLeadHumanLabel(lead.sales_type || "new")],
      ["Additional Notes", lead.additional_notes],
    ]),
  ];

  if (hasDealDetails) {
    const dealAmount = Number(lead.deal_amount || lead.deal_products_total || 0);
    const dealForAmounts = { ...lead, deal_amount: dealAmount };
    const receivedAmount = getDealReceivedAmount(dealForAmounts);
    const remainingAmount = getDealRemainingAmount(dealForAmounts);
    const gstAmount = hasTmeStoredAmount(lead.gst_amount)
      ? Number(lead.gst_amount || 0)
      : getTmeInclusiveGstAmount(dealAmount);

    sections.push(
      renderTmeLeadDetailsSection("Deal", [
        ["Deal Amount", formatDashboardMoney(dealAmount)],
        ["Down Payment", formatDashboardMoney(receivedAmount)],
        ["Remaining Amount", formatDashboardMoney(remainingAmount)],
        ["GST Amount", formatDashboardMoney(gstAmount)],
        ["Services", formatTmeLeadDealProducts(lead), true],
        ["Payment Method", lead.payment_method],
        ["Payment Status", formatTmeLeadHumanLabel(lead.pay_stat || "pending")],
        ["Payment Date", formatTmeDisplayDate(lead.payment_date)],
        ["Closed Date", formatTmeDisplayDate(lead.closed_date)],
        ["Assigned ME", lead.assigned_me_name || lead.me_name || lead.assign_emp],
        ["Created By", lead.created_by_name || lead.tme_name],
        ["Closed By", lead.closed_by_name || lead.received_by || lead.closed_by],
        ["Closed TME", lead.closed_tme_name || ""],
      ]),
    );
  }

  if (hasTmeLeadRenewalDetails(lead)) {
    const renewalRows = [];
    const isRenewalLead =
      String(lead.sales_type || "").toLowerCase().trim() === "renewal" ||
      Number(lead.renewal_source_lead_id || 0) > 0;
    const configuredRenewals = getTmeLeadRenewalDetails(lead);
    const sourceRenewals = getTmeLeadSourceRenewalDetails(lead);
    const renewalLeads = getTmeLeadRenewalLeads(lead);

    if (isRenewalLead) {
      renewalRows.push(["Type", "Renewal"]);
      if (Number(lead.renewal_source_lead_id || 0) > 0) {
        renewalRows.push(["Original Lead ID", lead.renewal_source_lead_id]);
      }
    }

    if (configuredRenewals.length) {
      renewalRows.push([
        "Services",
        formatTmeLeadRenewalRows(configuredRenewals),
        true,
      ]);
    }

    if (sourceRenewals.length) {
      renewalRows.push([
        "Original Deal Services",
        formatTmeLeadRenewalRows(sourceRenewals),
        true,
      ]);
    }

    if (renewalLeads.length) {
      renewalRows.push([
        "Renewal Leads",
        formatTmeLeadRenewalLeadRows(renewalLeads),
        true,
      ]);
    }

    if (renewalRows.length) {
      sections.push(renderTmeLeadDetailsSection("Renewal", renewalRows));
    }
  }

  return sections.join("");
}


async function openTmeLeadDetailsModal(event, leadId) {
  if (event) {
      event.preventDefault();
      event.stopPropagation();
  }

  const modal = document.getElementById("tmeLeadDetailsModal");
  const content = document.getElementById("tmeLeadDetailsContent");
  const normalizedLeadId = Number(leadId || 0);

  if (!modal || !content || !normalizedLeadId) return;

  modal.classList.remove("hidden");
  modal.classList.add("show");
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

      content.innerHTML = renderTmeLeadDetails(result.data);
  } catch (err) {
      console.error("TME lead details load error:", err);
      content.innerHTML = `
          <p class="no-data">${escapeTmeHtml(err.message || "Unable to load lead details")}</p>
      `;
  }
}

function closeTmeLeadDetailsModal() {
  const modal = document.getElementById("tmeLeadDetailsModal");
  if (!modal) return;
  modal.classList.remove("show");
  modal.classList.add("hidden");
  document.body.classList.remove("modal-open");
}

function handleTmeLeadDetailsBackdrop(event) {
  if (event.target?.id === "tmeLeadDetailsModal") {
      closeTmeLeadDetailsModal();
  }
}

function openTmeDealDetailsFromRow(event, leadId) {
  const interactiveTarget = event?.target?.closest?.(
      "button, a, select, input, textarea, label, option",
  );
  if (interactiveTarget) return;

  openTmeLeadDetailsModal(event, leadId);
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


let tmeFreshRenewalChartInstance = null;
function renderFreshVsRenewalChart(freshAmount, renewalAmount) {
  const canvas = document.getElementById("tmeFreshRenewalChart");
  if (!canvas?.getContext) return;
  
  const freshText = document.getElementById("tmeFreshAmountText");
  const renewalText = document.getElementById("tmeRenewalAmountText");
  if (freshText) freshText.textContent = `Rs. ${Number(freshAmount || 0).toLocaleString()}`;
  if (renewalText) renewalText.textContent = `Rs. ${Number(renewalAmount || 0).toLocaleString()}`;

  const ctx = canvas.getContext("2d");
  if (tmeFreshRenewalChartInstance) {
    tmeFreshRenewalChartInstance.destroy();
  }

  tmeFreshRenewalChartInstance = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: ["Fresh", "Renewal"],
      datasets: [
        {
          data: [Number(freshAmount || 0), Number(renewalAmount || 0)],
          backgroundColor: ["#3b82f6", "#eab308"],
          borderWidth: 0,
          hoverOffset: 4,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: "75%",
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: "#1e293b",
          padding: 12,
          titleFont: { size: 13, family: "'Segoe UI', sans-serif" },
          bodyFont: { size: 14, weight: "bold", family: "'Segoe UI', sans-serif" },
          callbacks: {
            label: (ctx) => ` Rs. ${ctx.parsed.toLocaleString()}`,
          },
        },
      },
    },
  });
}
