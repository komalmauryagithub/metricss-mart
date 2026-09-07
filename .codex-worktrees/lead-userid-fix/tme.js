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
let renewalLeadAttribution = null;
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
    dealClosed: 0,
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

async function loadDeals() {
  const tbody = document.getElementById("dealsTableBody");
  const noData = document.getElementById("noDeals");

  try {
    if (!currentUser?.id) return;

    const url = `${BASE_URL}/api/deals?userId=${currentUser.id}&userName=${encodeURIComponent(currentUser.name)}&role=${currentUser.role}`;

    const res = await fetch(url);
    const result = await res.json();

    if (!result.success || !result.data || result.data.length === 0) {
      tbody.innerHTML = "";
      noData.classList.remove("hidden");
      return;
    }

    noData.classList.add("hidden");
    tbody.innerHTML = "";

    result.data.forEach((d) => {
      const renewalMeta = getRenewalButtonMeta(d);
      const row = `
        <tr>
          <td>${escapeTmeHtml(d.company_name || "-")}</td>
          <td>${escapeTmeHtml(d.client_name || "-")}</td>
          <td>${escapeTmeHtml(d.deal_amount || 0)}</td>
          <td>${escapeTmeHtml(d.payment_method || "-")}</td>
          <td>${escapeTmeHtml(d.closed_date || "-")}</td>
          <td><span class="status-badge deal_closed">Deal Closed</span></td>
          <td>
            <button
              type="button"
              class="btn-renewal ${renewalMeta.className}"
              onclick="openRenewalFromDeal(${Number(d.id || 0)})"
              title="${escapeTmeHtml(renewalMeta.title)}"
            >
              <i class="${renewalMeta.iconClass}"></i> ${escapeTmeHtml(renewalMeta.label)}
            </button>
          </td>
        </tr>
      `;
      tbody.innerHTML += row;
    });

  } catch (err) {
    console.error("Deals load error:", err);
  }
}

function isLeadEligibleForDealClose(lead = {}) {
  const assignedEmployeeName = String(lead.assign_emp || "").trim();
  const assignedEmployeeId = String(lead.assign_emp_id || "").trim();
  const leadStatus = String(lead.lead_status || "")
    .toLowerCase()
    .trim();

  return (
    !assignedEmployeeName &&
    !assignedEmployeeId &&
    leadStatus !== "deal_closed" &&
    leadStatus !== "not_interested"
  );
}

function getDealCloseLeadById(leadId) {
  return tmeUnassignedLeads.find(
    (lead) => Number(lead.id) === Number(leadId),
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
      : "No unassigned active leads are available right now.";
    return;
  }

  const summary = [
    lead.company_name || "Untitled company",
    lead.client_name ? `Client: ${lead.client_name}` : "",
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

function resetDealCloseSelection() {
  dealCloseLeadId = null;

  const leadSelect = document.getElementById("dealCloseLeadSelect");
  const paymentMethod = document.getElementById("dealClosePaymentMethod");
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

  if (notes) {
    notes.value = "";
  }

  if (amountInput) {
    amountInput.value = "";
  }

  if (paymentFields) {
    paymentFields.innerHTML = "";
  }

  if (totalBox) {
    totalBox.textContent = "Select products to calculate total amount.";
  }

  const downsaleInput = document.getElementById("dealCloseDownsaleAmount");
  const downsaleReason = document.getElementById("dealCloseDownsaleReason");
  const upsaleInput = document.getElementById("dealCloseUpsaleAmount");

  if (downsaleInput) downsaleInput.value = "";
  if (downsaleReason) downsaleReason.value = "";
  if (upsaleInput) upsaleInput.value = "";

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
      : `${BASE_URL}/api/leads?userId=${currentUser.id}&role=${currentUser.role}&scope=unassigned`;

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

async function loadDealCloseLeadOptions() {
  const select = document.getElementById("dealCloseLeadSelect");
  if (!select) return;

  select.innerHTML = `<option value="">Loading unassigned leads...</option>`;

  try {
    const leads = await fetchTmeUnassignedLeads();

    if (!leads.length) {
      select.innerHTML = `<option value="">No unassigned leads found</option>`;
      setDealCloseLeadMeta(null);
      return;
    }

    select.innerHTML = `<option value="">Select unassigned lead</option>`;
    leads.forEach((lead) => {
      const option = document.createElement("option");
      option.value = String(lead.id);
      option.textContent = `${lead.company_name || "Untitled"} - ${lead.client_name || "No client"}${lead.contact ? ` (${lead.contact})` : ""}`;
      select.appendChild(option);
    });

    setDealCloseLeadMeta(null);
  } catch (err) {
    console.error("Deal close leads error:", err);
    select.innerHTML = `<option value="">Unable to load leads</option>`;
    setDealCloseLeadMeta(null);
    showPopup("Load Error", err.message || "Unable to load unassigned leads", false);
  }
}

function handleDealCloseLeadChange() {
  const select = document.getElementById("dealCloseLeadSelect");
  const selectedId = Number(select?.value || 0);

  dealCloseLeadId = selectedId || null;
  setDealCloseLeadMeta(getDealCloseLeadById(selectedId));

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

async function fetchDealCloseProductCatalog() {
  if (Array.isArray(tmeDealProductsCatalog) && tmeDealProductsCatalog.length) {
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

async function renderDealCloseProducts() {
  const container = document.getElementById("dealCloseProductRows");
  if (!container) return;

  try {
    const [catalog] = await Promise.all([
      fetchDealCloseProductCatalog(),
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

    container.innerHTML = Object.entries(groups)
      .map(
        ([groupName, products]) => `
          <div class="deal-close-product-group">
            <h4>${groupName}</h4>
            ${products
              .map(
                (product) => `
                  <label class="deal-close-product-option">
                    <input
                      type="checkbox"
                      class="deal-close-product-checkbox"
                      value="${product.name}"
                      onchange="updateDealCloseAmount()"
                    >
                    <span class="deal-close-product-name">${product.name}</span>
                  </label>
                `,
              )
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
  ).map((input) => ({
    name: input.value,
  }));
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
    statusEl.textContent = `Upsale applied: Rs. ${Number(upsaleAmount).toLocaleString("en-IN")}`;
    statusEl.style.color = "#15803d";
  } else {
    statusEl.textContent =
      "Add extra amount above standard total. No approval required.";
    statusEl.style.color = "#64748b";
  }
}

function updateDealCloseDownsaleStatus(standardTotal, finalTotal) {
  const statusEl = document.getElementById("dealCloseDownsaleStatus");
  const toggle = document.getElementById("dealCloseDownsaleToggle");
  const selectedProductsCount = getSelectedDealCloseProducts().length;
  const latestRequest = dealCloseDownsaleRequests[0] || null;

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
    statusEl.textContent =
      "Server restart required for downsale approval.";
    statusEl.style.color = "#b91c1c";
  } else if (
    dealCloseApprovedDownsaleRequest &&
    finalTotal < standardTotal
  ) {
    const discountAmount = Number(
      dealCloseApprovedDownsaleRequest.requested_amount || 0,
    );
    statusEl.textContent = `Approved downsale: Rs. ${discountAmount.toLocaleString("en-IN")}`;
    statusEl.style.color = "#15803d";
  } else if (latestRequest?.status === "pending") {
    statusEl.textContent = `Downsale pending: Rs. ${Number(
      latestRequest.requested_amount || 0,
    ).toLocaleString("en-IN")}`;
    statusEl.style.color = "#92400e";
  } else if (latestRequest?.status === "rejected") {
    statusEl.textContent = "Last downsale request was rejected.";
    statusEl.style.color = "#b91c1c";
  } else if (selectedProductsCount === 0) {
    statusEl.textContent =
      "Select products to request discount on total amount.";
    statusEl.style.color = "#64748b";
  } else {
    statusEl.textContent = `Standard backend total: Rs. ${Number(
      standardTotal || 0,
    ).toLocaleString("en-IN")}`;
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
        products: selectedProducts,
        requestedAmount,
        reason,
      }),
    });

    const contentType = res.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
      throw new Error(
        "Server restart required for downsale approval.",
      );
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

function updateDealCloseAmount() {
  const amountInput = document.getElementById("dealCloseAmount");
  const totalBox = document.getElementById("dealCloseTotal");
  const selectedProducts = getSelectedDealCloseProducts();
  const priceMap = new Map(
    (tmeDealProductsCatalog || []).map((product) => [
      product.name,
      Number(product.price || 0),
    ]),
  );

  if (!amountInput || !totalBox) return;

  if (!selectedProducts.length) {
    amountInput.value = "";
    totalBox.textContent = "Select products to calculate total amount.";
    dealCloseAppliedUpsaleAmount = 0;
    updateDealCloseUpsaleStatus(0);
    updateDealCloseDownsaleStatus(0, 0);
    return;
  }

  const standardTotal = selectedProducts.reduce(
    (sum, product) => sum + (priceMap.get(product.name) || 0),
    0,
  );

  const approvedDownsaleAmount = dealCloseApprovedDownsaleRequest
    ? Number(dealCloseApprovedDownsaleRequest.requested_amount || 0)
    : 0;
  const approvedStandardTotal = dealCloseApprovedDownsaleRequest
    ? Number(dealCloseApprovedDownsaleRequest.standard_amount || 0)
    : 0;
  const hasApprovedDownsale =
    approvedDownsaleAmount > 0 &&
    approvedDownsaleAmount < standardTotal &&
    Math.abs(approvedStandardTotal - standardTotal) <= 0.01;
  const baseTotal = hasApprovedDownsale
    ? standardTotal - approvedDownsaleAmount
    : standardTotal;
  const upsaleAmount = Number(dealCloseAppliedUpsaleAmount || 0);
  const finalTotal = baseTotal + upsaleAmount;

  amountInput.value = finalTotal ? finalTotal.toFixed(2) : "";

  const breakdownParts = [
    `Selected ${selectedProducts.length} product${selectedProducts.length > 1 ? "s" : ""}`,
    `Standard total: ${formatDashboardMoney(standardTotal)}`,
  ];

  if (hasApprovedDownsale) {
    breakdownParts.push(
      `Approved downsale: ${formatDashboardMoney(approvedDownsaleAmount)}`,
    );
  }

  if (upsaleAmount > 0) {
    breakdownParts.push(`Upsale: ${formatDashboardMoney(upsaleAmount)}`);
  }

  breakdownParts.push(`Final total: ${formatDashboardMoney(finalTotal)}`);
  totalBox.textContent = breakdownParts.join(" | ");

  updateDealCloseDownsaleStatus(standardTotal, baseTotal);
  updateDealCloseUpsaleStatus(upsaleAmount);
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

function openDealCloseModal() {
  const modal = document.getElementById("dealCloseModal");
  if (!modal) return;

  resetDealCloseSelection();
  modal.classList.remove("hidden");
  modal.classList.add("show");
  modal.setAttribute("aria-hidden", "false");

  loadDealCloseLeadOptions();
  renderDealCloseProducts();
}

function closeDealCloseModal() {
  const modal = document.getElementById("dealCloseModal");
  if (!modal) return;

  stopDealCloseDownsalePolling();
  modal.classList.remove("show");
  modal.classList.add("hidden");
  modal.setAttribute("aria-hidden", "true");
  resetDealCloseSelection();
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

async function saveDealClose() {
  if (dealCloseSubmitting) return;

  const selectedLead = getDealCloseLeadById(dealCloseLeadId);
  const selectedProducts = getSelectedDealCloseProducts();
  const amountValue = Number(
    document.getElementById("dealCloseAmount")?.value || 0,
  );
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
    showPopup("Lead Missing", "Please select an unassigned lead first.", false);
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

  if (!paymentMethod) {
    showPopup("Payment Missing", "Please select a payment method.", false);
    return;
  }

  if (paymentMethod === "Cheque" && (!chequeNumber || !chequeDate || !bankName)) {
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

  setDealCloseSavingState(true);

  try {
    const formData = new FormData();
    formData.append("action", "deal_closed");
    formData.append("deal_amount", amountValue.toFixed(2));
    formData.append("payment_method", paymentMethod);
    formData.append("payment_notes", paymentNotes);
    formData.append("closed_by", currentUser?.id || "");
    formData.append("received_by", currentUser?.name || "");
    formData.append("payment_date", getTodayForInput());
    formData.append("products", JSON.stringify(selectedProducts));
    if (dealCloseApprovedDownsaleRequest?.id) {
      formData.append(
        "downsale_approval_id",
        dealCloseApprovedDownsaleRequest.id,
      );
    }

    if (chequeNumber) formData.append("cheque_number", chequeNumber);
    if (chequeDate) formData.append("cheque_date", chequeDate);
    if (transactionId) formData.append("transaction_id", transactionId);
    if (bankName) formData.append("bank_name", bankName);
    if (branchName) formData.append("branch_name", branchName);

    const res = await fetch(
      `${BASE_URL}/api/leads/${dealCloseLeadId}/action`,
      {
        method: "PUT",
        body: formData,
      },
    );
    const result = await res.json();

    if (!res.ok || !result.success) {
      throw new Error(result.error || result.message || "Unable to close deal");
    }

    closeDealCloseModal();
    showPopup(
      "Deal Closed",
      `${selectedLead.company_name || "Lead"} closed successfully.`,
      true,
    );
    loadDeals();
    loadLeads();
    loadAppointments();
    loadFollowedUp();
    loadTmeDashboard();
  } catch (err) {
    console.error("Deal close save error:", err);
    showPopup("Save Error", err.message || "Unable to close deal", false);
  } finally {
    setDealCloseSavingState(false);
  }
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
  switch (String(stage || "").toLowerCase().trim()) {
    case "confirmed":
      return { label: "Confirmed", className: "confirmed" };
    case "not_confirmed":
      return { label: "Not Confirmed", className: "not_confirmed" };
    case "deal_closed":
      return { label: "Deal Closed", className: "deal_closed" };
    default:
      return { label: "Generated", className: "generated" };
  }
}

function getAppointmentLifecycleStage(lead) {
  const apiStage = String(lead?.appointment_stage || "")
    .toLowerCase()
    .trim();
  if (apiStage) return apiStage;

  const leadStatus = String(lead?.lead_status || "")
    .toLowerCase()
    .trim();
  const appointmentStatus = String(lead?.appointment_status || "")
    .toLowerCase()
    .trim()
    .replace(/[\s-]+/g, "_");

  if (leadStatus === "deal_closed") return "deal_closed";
  if (appointmentStatus === "confirmed" || leadStatus === "followup") {
    return "confirmed";
  }
  if (appointmentStatus === "not_confirmed" || leadStatus === "not_interested") {
    return "not_confirmed";
  }
  return "generated";
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
      } else if (stage === "deal_closed") {
        summary.dealClosed += 1;
      }

      return summary;
    },
    {
      totalGenerated: 0,
      confirmed: 0,
      notConfirmed: 0,
      dealClosed: 0,
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
    .map((value) => String(value || "").trim().toLowerCase())
    .filter(Boolean);

  return parts.join("|") || `deal-${deal?.id || Math.random()}`;
}

function summarizeDealMix(deals = []) {
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
      const amount = normalizeDashboardNumber(deal?.deal_amount);
      const key = getDealIdentityKey(deal);
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

function renderAppointmentStatusSummary(summary = {}) {
  const totalGenerated = normalizeDashboardNumber(summary.totalGenerated);
  const confirmed = normalizeDashboardNumber(summary.confirmed);
  const notConfirmed = normalizeDashboardNumber(summary.notConfirmed);
  const dealClosed = normalizeDashboardNumber(summary.dealClosed);

  setDashboardText("tmeAppointmentsGenerated", totalGenerated);
  setDashboardText("tmeAppointmentsConfirmed", confirmed);
  setDashboardText("tmeAppointmentsNotConfirmed", notConfirmed);
  setDashboardText("tmeAppointmentsClosed", dealClosed);
  setDashboardText(
    "tmeAppointmentStatusHint",
    totalGenerated
      ? `${totalGenerated} tracked meetings in appointment pipeline`
      : "No appointment history yet",
  );
  setDashboardText(
    "tmeAppointmentsGeneratedHint",
    totalGenerated
      ? formatDashboardCount(totalGenerated, "meeting generated", "meetings generated")
      : "All appointment requests",
  );
  setDashboardText(
    "tmeAppointmentsConfirmedHint",
    confirmed
      ? formatDashboardCount(confirmed, "meeting confirmed", "meetings confirmed")
      : "Client confirmed meetings",
  );
  setDashboardText(
    "tmeAppointmentsNotConfirmedHint",
    notConfirmed
      ? formatDashboardCount(notConfirmed, "meeting pending", "meetings pending")
      : "Needs another push",
  );
  setDashboardText(
    "tmeAppointmentsClosedHint",
    dealClosed
      ? formatDashboardCount(dealClosed, "deal closed", "deals closed")
      : "Meetings turned into deals",
  );
}

function renderAppointmentStatusChart(summary = {}) {
  const canvas = document.getElementById("tmeAppointmentStatusChart");
  if (!canvas?.getContext) return;

  const values = [
    normalizeDashboardNumber(summary.totalGenerated),
    normalizeDashboardNumber(summary.confirmed),
    normalizeDashboardNumber(summary.notConfirmed),
    normalizeDashboardNumber(summary.dealClosed),
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
        "Deal Closed",
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
    `${formatDashboardMoney(achieved)} achieved`,
  );

  let heroText = "Start closing deals to build momentum for your monthly target.";
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
  setDashboardText("tmeTargetInsightAchievedHint", `${achievedPercent}% completed`);
  setDashboardText("tmeTargetInsightRemaining", formatDashboardMoney(remaining));
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
    data.commissionAmount ?? ((achieved * commissionPercent) / 100),
  );

  currentMonthlyTarget = 0;
  const headerTitle = document.querySelector("#dashboard .sales-target-header h3");
  const headerNote = document.querySelector("#dashboard .sales-target-header p");
  const targetButton = document.querySelector("#dashboard .sales-target-header .target-set-btn");
  if (headerTitle) headerTitle.textContent = "Sales Commission";
  if (headerNote) headerNote.textContent = "Flat commission on closed sales. No monthly target or target incentive.";
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
  setDashboardText(`${prefix}TargetRemaining`, formatDashboardMoney(commissionAmount));
  setDashboardText(`${prefix}TargetAchievedHint`, "No monthly target");
  setDashboardText(`${prefix}TargetRemainingHint`, "Auto-calculated commission");

  if (prefix === "tme") {
    setDashboardText("tmeTargetProgressLabel", `${commissionPercent.toFixed(0)}% commission`);
    setDashboardMetricLabel("tmeTargetInsightAchieved", "Sales Closed");
    setDashboardMetricLabel("tmeTargetInsightRemaining", "Commission");
    updateTmeTargetProgressInsights(0, achieved, 0);
    setDashboardText("tmeTargetHeroValue", `${formatDashboardMoney(commissionAmount)} commission`);
    setDashboardText(
      "tmeTargetHeroText",
      achieved > 0
        ? `${formatDashboardMoney(achieved)} closed sales par ${commissionPercent.toFixed(0)}% commission.`
        : "Commission profile par monthly target nahi hai. Closed sales par flat 10% commission milega.",
    );
    setDashboardText("tmeTargetInsightAchieved", formatDashboardMoney(achieved));
    setDashboardText("tmeTargetInsightAchievedHint", "Commissionable sales");
    setDashboardText("tmeTargetInsightRemaining", formatDashboardMoney(commissionAmount));
    setDashboardText("tmeTargetInsightRemainingHint", "Estimated payout");
    renderTargetProgressChart(achieved || 1, commissionAmount, {
      centerValueText: `${commissionPercent.toFixed(0)}%`,
      centerSubtext: "commission",
      labels: ["Commission", "Sales Balance"],
      data: achieved > 0
        ? [Math.max(commissionAmount, 0), Math.max(achieved - commissionAmount, 0)]
        : [0, 1],
    });
  }
}

function applySalesTargetSummary(prefix, data = {}) {
  if (isCommissionSalesSummary(data)) {
    applyTmeCommissionSummary(prefix, data);
    return;
  }

  const targetValue = Number(data.target ?? MONTHLY_TARGET);
  const target = Number.isFinite(targetValue) ? targetValue : MONTHLY_TARGET;
  const achieved = Number(data.achieved || 0);
  const remaining = Math.max(Number(data.remaining || 0), 0);
  const targetText = formatDashboardMoney(target);
  currentMonthlyTarget = target;
  const achievedPercent =
    target > 0 ? Math.min((achieved / target) * 100, 100).toFixed(1) : "0.0";

  setDashboardMetricLabel(`${prefix}TargetSet`, "Target Set");
  setDashboardMetricLabel(`${prefix}TargetAchieved`, "Target Achieved");
  setDashboardMetricLabel(`${prefix}TargetRemaining`, "Remaining Target");
  setDashboardMetricLabel("tmeTargetInsightAchieved", "Achieved");
  setDashboardMetricLabel("tmeTargetInsightRemaining", "Remaining");
  const headerTitle = document.querySelector("#dashboard .sales-target-header h3");
  const headerNote = document.querySelector("#dashboard .sales-target-header p");
  const targetButton = document.querySelector("#dashboard .sales-target-header .target-set-btn");
  if (headerTitle) headerTitle.textContent = "Monthly Sales Target";
  if (headerNote) headerNote.textContent = "Admin-assigned goal with live achieved vs remaining sales.";
  if (targetButton) {
    targetButton.title = "Monthly target is assigned by admin";
    targetButton.innerHTML = '<i class="fas fa-shield-halved"></i> Assigned by Admin';
  }
  setDashboardText(`${prefix}TargetSet`, formatDashboardMoney(target));
  setDashboardText(`${prefix}TargetSetHint`, "Current monthly goal");

  setDashboardText(`${prefix}TargetAchieved`, formatDashboardMoney(achieved));
  setDashboardText(`${prefix}TargetRemaining`, formatDashboardMoney(remaining));
  setDashboardText(`${prefix}TargetAchievedHint`, `${achievedPercent}% of ${targetText}`);
  setDashboardText(
    `${prefix}TargetRemainingHint`,
    remaining === 0 && achieved >= target
      ? "Monthly target achieved"
      : `Pending from ${targetText}`,
  );

  if (prefix === "tme") {
    setDashboardText("tmeTargetProgressLabel", `${achievedPercent}% achieved`);
    updateTmeTargetProgressInsights(target, achieved, remaining);
    renderTargetProgressChart(target, achieved);
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

async function fetchMonthlyTargetSummary() {
  if (!currentUser?.id) {
    return { target: currentMonthlyTarget || MONTHLY_TARGET };
  }

  try {
    const res = await fetch(
      `${BASE_URL}/api/sales-target-summary?userId=${currentUser.id}&role=${currentUser.role}`,
      { cache: "no-store" },
    );
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

async function loadTmeDashboard() {
  if (!currentUser?.id) return;

  try {
    const reportsUrl = `${BASE_URL}/api/reports/counts?userId=${currentUser.id}&role=${currentUser.role}`;
    const dealsUrl = `${BASE_URL}/api/deals?userId=${currentUser.id}&userName=${encodeURIComponent(currentUser.name || "")}&role=${currentUser.role}`;
    const attendanceUrl = `${BASE_URL}/api/attendance/today/${currentUser.id}`;
    const appointmentsUrl = `${BASE_URL}/api/appointments?role=${currentUser.role}&userId=${currentUser.id}&includeHistory=1`;

    const [reportsRes, dealsRes, attendanceRes, appointmentsRes, targetResult] = await Promise.all([
      fetch(reportsUrl, { cache: "no-store" }),
      fetch(dealsUrl, { cache: "no-store" }),
      fetch(attendanceUrl, { cache: "no-store" }),
      fetch(appointmentsUrl, { cache: "no-store" }),
      fetchMonthlyTargetSummary(),
    ]);

    const reports = await reportsRes.json();
    const deals = await dealsRes.json();
    const attendance = await attendanceRes.json();
    const appointmentsResult = await appointmentsRes.json();

    const reportData = reports?.data || {};
    const totalLeads = normalizeDashboardNumber(
      reportData.totalLeads ?? reportData.leads,
    );
    const appointments = normalizeDashboardNumber(
      reportData.totalAppointments ?? reportData.appointments,
    );
    const followups = normalizeDashboardNumber(
      reportData.totalFollowed ??
        reportData.total_followed ??
        reportData.followups ??
        reportData.totalFollowups,
    );
    const dealRows = Array.isArray(deals?.data) ? deals.data : [];
    const appointmentRows = Array.isArray(appointmentsResult?.data)
      ? appointmentsResult.data
      : [];
    const appointmentSummary = summarizeAppointmentHistory(appointmentRows);
    const salesMix = summarizeDealMix(dealRows);
    const dealsCount = normalizeDashboardNumber(
      reportData.totalDeals ?? reportData.deals ?? dealRows.length,
    );
    const totalSales = dealRows.reduce(
      (sum, deal) => sum + normalizeDashboardNumber(deal.deal_amount),
      0,
    );
    const conversionRate =
      totalLeads > 0 ? ((dealsCount / totalLeads) * 100).toFixed(1) : "0.0";
    const todayAttendance =
      attendance && typeof attendance === "object"
        ? attendance.data ??
          (attendance.check_in || attendance.check_out || attendance.status
            ? attendance
            : null)
        : null;
    const hasAttendanceCheckIn = Boolean(todayAttendance?.check_in);
    const isAttendanceAbsent = todayAttendance?.status === "absent";
    const attendanceMeta =
      hasAttendanceCheckIn || isAttendanceAbsent
        ? getAttendanceStatusMeta(todayAttendance?.status)
        : null;
    const attendanceStatus = attendanceMeta ? attendanceMeta.label : "Not marked";
    const attendanceTime = isAttendanceAbsent
      ? hasAttendanceCheckIn
        ? `In ${todayAttendance.check_in} / Out ${getAttendanceCheckoutDisplay(todayAttendance)}`
        : "Check out missing"
      : hasAttendanceCheckIn
        ? `In ${todayAttendance.check_in} / Out ${getAttendanceCheckoutDisplay(todayAttendance)}`
        : "Check in pending";

    tmeDashboardState.counts = {
      deals: dealsCount,
    };
    tmeDashboardState.deals = dealRows;
    tmeDashboardState.appointmentsHistory = appointmentRows;
    tmeDashboardState.appointmentSummary = appointmentSummary;
    tmeDashboardState.salesMix = salesMix;

    setDashboardText("dashboardTotalSales", formatDashboardMoney(totalSales));
    setDashboardText("dashboardSalesHint", `${dealsCount} closed deal${dealsCount === 1 ? "" : "s"}`);
    setDashboardText("dashboardDeals", dealsCount);
    setDashboardText("dashboardLeads", totalLeads);
    setDashboardText("dashboardAppointments", appointments);
    setDashboardText("dashboardFollowups", followups);
    setDashboardText("dashboardConversionRate", `${conversionRate}% conversion`);
    setDashboardText("dashboardAttendance", attendanceStatus);
    setDashboardText("dashboardAttendanceTime", attendanceTime);
    setDashboardText("dashboardFunnelRate", `${conversionRate}% converted`);
    setDashboardText("tmeFunnelConversionRate", `${conversionRate}%`);
    setDashboardText("funnelLeads", totalLeads);
    setDashboardText("funnelAppointments", appointments);
    setDashboardText("funnelFollowups", followups);
    setDashboardText("funnelDeals", dealsCount);
    const targetData = targetResult?.data || targetResult || {};
    currentMonthlyTarget = normalizeDashboardNumber(
      targetData.target ?? currentMonthlyTarget ?? MONTHLY_TARGET,
    );
    const isCommissionProfile = isCommissionSalesSummary(targetData);
    applySalesTargetSummary("tme", {
      ...targetData,
      target: currentMonthlyTarget,
      achieved: totalSales,
      remaining: isCommissionProfile ? 0 : Math.max(currentMonthlyTarget - totalSales, 0),
    });

    renderAppointmentStatusSummary(appointmentSummary);
    renderAppointmentStatusChart(appointmentSummary);
    if (document.getElementById("appointments")?.classList.contains("active")) {
      applyAppointmentsFilters();
    }
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
      chartCtx.fillText(options.centerValueText || `${progressValue.toFixed(1)}%`, arc.x, arc.y - 6);

      chartCtx.fillStyle = "#64748b";
      chartCtx.font = "600 12px 'Segoe UI', Arial, sans-serif";
      chartCtx.fillText(options.centerSubtext || "achieved", arc.x, arc.y + 18);
      chartCtx.restore();
    },
  };

  const achievedGradient = ctx.createLinearGradient(0, 0, 0, canvas.height || 280);
  achievedGradient.addColorStop(0, "#22c55e");
  achievedGradient.addColorStop(1, "#16a34a");

  const remainingGradient = ctx.createLinearGradient(0, 0, 0, canvas.height || 280);
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
          <td>${deal.closed_date || "-"}</td>
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

  if (currentUser) {
    fetchUserDataFromDB();
    loadTmeDashboard();
    loadLeads();
    loadReportsCounts();
    loadDeals(); // 🔥 MUST ADD THIS
  }
});

function showSection(sectionId) {
  document.querySelectorAll(".section").forEach(sec => sec.classList.remove("active"));
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
    document.getElementById("userAvatar").src =
      currentUser.prof_img.startsWith("http")
        ? currentUser.prof_img
        : `${BASE_URL}/${currentUser.prof_img}`;
  }
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
    const res = await fetch(`${BASE_URL}/api/project-tracker?${params.toString()}`, {
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

    ProjectTrackerUI.renderStats("tmeProjectTrackerStats", result.counts, {
      assignmentCounts: result.assignmentCounts,
    });
    ProjectTrackerUI.renderProjects("tmeProjectsContainer", result);
  } catch (err) {
    console.error("TME Project Tracker Error:", err);
    ProjectTrackerUI.renderStats("tmeProjectTrackerStats", getEmptyTrackerCounts(), {
      assignmentCounts: { total: 0 },
    });
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
    const attendanceRes = await fetch(`${BASE_URL}/api/attendance/${currentUser.id}`);
    const result = await attendanceRes.json();
    const rows = result.success ? result.data || [] : [];

    const today = formatDateKey(new Date());
    const todayRow = rows.find((row) => row.attendance_date === today);
    const canCheckIn = !todayRow;
    const canCheckOut = todayRow && !todayRow.check_out;

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
      calendar.innerHTML = renderAttendanceCalendar(rows);
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
            <td>${row.attendance_date || "-"}</td>
            <td>${row.check_in || "-"}</td>
            <td>${displayedCheckOut}</td>
            <td>${checkInLocation}</td>
            <td>${row.working_hours || "00:00"}</td>
            <td>${attendanceStatus}</td>
          </tr>
        `;
      });
    }

    tbody.innerHTML = html;
    renderAttendanceSummarySection(tbody, rows);
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
    if (!window.AttendanceFace?.captureForAttendance) {
      throw new Error("Face verification module is not loaded. Refresh and try again.");
    }
    const location = await getCurrentLocation();
    const facePayload = await window.AttendanceFace.captureForAttendance({
      actionLabel: type === "check-in" ? "Verify Check In" : "Verify Check Out",
    });
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: currentUser.id, ...location, ...facePayload }),
    });
    const result = await res.json();

    if (!res.ok || !result.success) {
      throw new Error(result.error || result.message || "Attendance update failed");
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
      reject(new Error("Open this page on localhost or HTTPS to use location access."));
      return;
    }

    if (!navigator.geolocation) {
      reject(new Error("Location is not supported in this browser."));
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
            ? "Please allow location permission to save attendance."
            : error.code === error.TIMEOUT
              ? "Location fetch timed out. Turn on GPS/location and try again."
              : "Unable to fetch location. Turn on GPS/location and try again.";
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
    const option = document.createElement("option");
    option.value = emp.name;
    option.textContent = emp.name;
    option.dataset.employeeId = emp.id != null ? String(emp.id) : "";
    option.dataset.employeeContact = emp.contact ? String(emp.contact) : "";
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
    };
  }

  const option = select.options[select.selectedIndex];

  return {
    name: select.value || "",
    id: option?.dataset?.employeeId || "",
    contact: option?.dataset?.employeeContact || "",
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

    return whatsapp.message || "The assigned ME WhatsApp brief is ready to send.";
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
  const locationUrl = getLeadLocationUrl(lead);
  if (!locationUrl) return "-";

  return `<a href="${locationUrl}" target="_blank" rel="noopener noreferrer" class="location-link">View Location</a>`;
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

function formatDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
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

    const rows = Array.isArray(result.data) ? result.data : [];
    const summary = summarizeAppointmentHistory(rows);
    tmeDashboardState.appointmentsHistory = rows;
    tmeDashboardState.appointmentSummary = summary;
    renderAppointmentStatusSummary(summary);
    renderAppointmentStatusChart(summary);
    applyAppointmentsFilters();
  } catch (err) {
    console.error(err);
    const tbody = document.getElementById("appointmentsTableBody");
    if (tbody) {
      tbody.innerHTML = `<tr><td colspan="10" style="text-align:center;color:red;">Error loading appointments</td></tr>`;
    }
  }
}

function renderAppointmentsTableRows(rows = []) {
  const tbody = document.getElementById("appointmentsTableBody");
  const noData = document.getElementById("noAppointments");
  if (!tbody || !noData) return;

  if (!rows.length) {
    tbody.innerHTML = "";
    noData.classList.remove("hidden");
    return;
  }

  noData.classList.add("hidden");
  tbody.innerHTML = rows
    .map((lead, index) => {
      const locationCell = formatAppointmentLocation(lead);
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
              </select>
            `;

      return `
        <tr>
          <td>${index + 1}</td>
          <td><strong>${lead.company_name || "-"}</strong></td>
          <td>${lead.client_name || "-"}</td>
          <td>${lead.contact || "-"}</td>
          <td>${lead.app_date || "-"}</td>
          <td>${lead.app_time || "-"}</td>
          <td>${lead.assign_emp || "-"}</td>
          <td>${locationCell}</td>
          <td>${stagePill}</td>
          <td>${updateCell}</td>
        </tr>
      `;
    })
    .join("");
}

function applyAppointmentsFilters() {
  const statusFilter = document.getElementById("appointmentsStatusFilterTME")?.value || "all";
  const searchValue = String(
    document.getElementById("appointmentsSearchTME")?.value || "",
  )
    .toLowerCase()
    .trim();

  const filteredRows = (tmeDashboardState.appointmentsHistory || []).filter((lead) => {
    const stage = getAppointmentLifecycleStage(lead);
    const stageMeta = getAppointmentStageMeta(stage);
    const matchesStatus = statusFilter === "all" || stage === statusFilter;
    const searchableText = [
      lead.company_name,
      lead.client_name,
      lead.contact,
      lead.assign_emp,
      lead.app_date,
      lead.app_time,
      stageMeta.label,
    ]
      .map((value) => String(value || "").toLowerCase())
      .join(" ");
    const matchesSearch = !searchValue || searchableText.includes(searchValue);

    return matchesStatus && matchesSearch;
  });

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
    const res = await fetch(`${BASE_URL}/api/appointments/${appointmentId}/status`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        appointment_status: nextValue,
      }),
    });
    const result = await res.json();

    if (!res.ok || !result.success) {
      throw new Error(result.message || "Failed to update appointment status");
    }

    selectElement.dataset.previousValue = nextValue;
    showPopup("Appointment Updated", "Meeting status saved successfully.", true);
    await loadAppointments();
    loadTmeDashboard();
  } catch (err) {
    console.error("Appointment status update error:", err);
    selectElement.value = previousValue;
    showPopup("Update Failed", err.message || "Unable to update appointment status", false);
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

    if (!result.success || result.data.length === 0) {
      tbody.innerHTML = "";
      noData.classList.remove("hidden");
      return;
    }

    noData.classList.add("hidden");
    tbody.innerHTML = "";

    result.data.forEach((lead, index) => {
      const row = `
<tr>
  <td>${index + 1}</td>
  <td><strong>${lead.company_name}</strong></td>
  <td>${lead.client_name}</td>
  <td>${lead.contact}</td>
  <td>${lead.city || "-"}</td>

  <td>${lead.follow_date || "-"}</td>   <!-- ✅ Follow Date -->
  <td>${lead.follow_time || "-"}</td>   <!-- ✅ Follow Time -->

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

function setLeadFormCheckboxGroup(name, values) {
  const selectedValues = new Set(
    parseStoredArray(values).map((item) => String(item)),
  );

  document
    .querySelectorAll(`#leadForm [name="${name}"]`)
    .forEach((input) => {
      input.checked = selectedValues.has(input.value);
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

function resetLeadFormState() {
  editingLeadId = null;
  renewalLeadAttribution = null;

  const form = document.getElementById("leadForm");
  if (form) {
    form.reset();
    setLeadCompanyScope();
  }

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
    actionType.value = "appointment";
  }

  setLeadFormValue("sales_type", "new");
  setLeadCompanyScope();

  handleActionChange();
}

async function populateLeadForm(lead) {
  const actionTypeValue =
    lead.action_type === "followup" ? "followup" : "appointment";

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

  setLeadFormValue("source_lead", lead.source_lead);
  setLeadFormValue("industry_type", lead.industry_type);
  setLeadFormValue("sales_type", lead.sales_type || "new");

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

function openLeadForm() {
  resetLeadFormState();
  showLeadModal();
}

function closeLeadForm() {
  const modal = document.getElementById("leadModal");
  if (modal) {
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
  const action = document.getElementById("actionType").value;
  const appointmentSection = document.getElementById("appointmentSection");
  const followupSection = document.getElementById("followupSection");

  if (action === "appointment") {
    setSectionVisibility(appointmentSection, true);
    setSectionVisibility(followupSection, false);
    await loadLeadEmployees(selectedEmployee);
  } else if (action === "followup") {
    setSectionVisibility(appointmentSection, false);
    setSectionVisibility(followupSection, true);
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

document
  .getElementById("leadForm")
  .addEventListener("submit", async function (e) {
    e.preventDefault();

    const form = new FormData(this);
    const isEditMode = Boolean(editingLeadId);
    const actionTypeValue = document.getElementById("actionType").value;
    const salesTypeValue = form.get("sales_type") || "new";
    const renewalCreator =
      !isEditMode && salesTypeValue === "renewal" ? renewalLeadAttribution : null;
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
      company_scope: form.get("company_scope") || getDefaultLeadCompanyScope(),

      source_lead: form.get("source_lead"),
      industry_type: form.get("industry_type"),
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
      created_by: renewalCreator?.createdBy || currentUser.id,
      created_by_name: renewalCreator?.createdByName || currentUser.name || "",
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

      if (result.success) {
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
        closePendingWhatsAppWindow(pendingWhatsAppWindow);
        showPopup(
          "Save Error",
          result.message || "Error saving client",
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

  try {
    const currentUserId = hydrateCurrentUserIdentity();
    const url =
      currentUser.role === "admin"
        ? `${BASE_URL}/api/leads?role=admin`
        : `${BASE_URL}/api/leads?userId=${currentUserId || currentUser.id}&role=${currentUser.role}&scope=assigned`;

    // ✅ Sirf ye use kar
    const res = await fetch(url);

    const result = await res.json();

    if (!result.success || !result.data || result.data.length === 0) {
      tbody.innerHTML = "";
      noData.classList.remove("hidden");
      return;
    }

    noData.classList.add("hidden");
    tbody.innerHTML = "";

    result.data.forEach((lead, index) => {
      const createdDate = lead.created_at
        ? new Date(lead.created_at).toLocaleDateString("en-IN")
        : "N/A";
      const actionTypeLabel = lead.action_type
        ? String(lead.action_type).toUpperCase()
        : "APPOINTMENT";
      const statusClass =
        lead.action_type === "appointment" ? "appointment" : "followup";

      const row = `
        <tr>
            <td>${index + 1}</td>
            <td><strong>${escapeTmeHtml(lead.company_name || "-")}</strong></td>
            <td>${escapeTmeHtml(lead.client_name || "-")}</td>
            <td>${escapeTmeHtml(lead.contact || lead.telephone || "-")}</td>
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
                  lead.action_type === "followup"
                    ? `
                <button type="button" onclick="convertToAppointment(${Number(lead.id)})" class="btn-appointment" title="Set Appointment">
                    <i class="fas fa-calendar-plus"></i>Set
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
      showPopup("Renewal", result.message || "Unable to load deal details", false);
      return;
    }

    const lead = result.data;
    resetLeadFormState();
    await populateLeadForm(lead);
    editingLeadId = null;
    renewalLeadAttribution = {
      sourceLeadId: Number(lead.id || id || 0) || null,
      createdBy: Number(lead.created_by || currentUser?.id || 0) || null,
      createdByName:
        lead.created_by_name ||
        lead.createdByName ||
        (Number(lead.created_by || 0) === Number(currentUser?.id || 0)
          ? currentUser?.name || ""
          : ""),
    };
    setLeadFormValue("sales_type", "renewal");
    setLeadFormMode("renewal");
    showLeadModal();
  } catch (err) {
    console.error("Renewal lead load error:", err);
    showPopup("Renewal", "Server error while loading renewal form", false);
  }
}

async function convertToAppointment(leadId) {
  try {
    const res = await fetch(`/api/leads/${leadId}`);
    const result = await res.json();
    if (result.success) {
      const lead = result.data;
      const locationValue = lead.maps_lnk || lead.location || "";
      document.getElementById("location").value = locationValue;
      document.getElementById("leadInfo").innerHTML = `
                <strong>${lead.company_name}</strong> - ${lead.client_name}
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

// Close Modal
function closeAppointmentModal() {
  const modal = document.getElementById("appointmentModal");
  modal.classList.remove("show");
  modal.classList.add("hidden");
  document.getElementById("appointmentForm").reset();
}

// Form Submit - Update Lead to Appointment
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
  const renewalCreator =
    !isEditMode && salesTypeValue === "renewal" ? renewalLeadAttribution : null;
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
    company_scope: form.get("company_scope") || getDefaultLeadCompanyScope(),
    source_lead: form.get("source_lead"),
    industry_type: form.get("industry_type"),
    sales_type: salesTypeValue,
    renewal_source_lead_id: renewalCreator?.sourceLeadId || null,
    web_type: form.getAll("web_type[]"),
    seo_type: form.getAll("seo_type[]"),
    smo_type: form.getAll("smo_type[]"),
    app_type: form.getAll("app_type[]"),
    erp_type: form.getAll("erp_type[]"),
    services: form.getAll("services[]"),
    service_notes: form.get("service_notes"),
    actionType: document.getElementById("actionType").value,
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
    created_by: renewalCreator?.createdBy || currentUser.id,
    created_by_name: renewalCreator?.createdByName || currentUser.name || "",
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

    if (result.success) {
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

    closePendingWhatsAppWindow(pendingWhatsAppWindow);
    showPopup("Save Error", result.message || "Error saving client", false);
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

async function handleAppointmentFormSubmit(event) {
  event.preventDefault();
  event.stopImmediatePropagation();

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
      const feedbackMessage = completeWhatsAppDraft(
        pendingWhatsAppWindow,
        result.whatsapp,
        "Appointment set successfully.",
      );

      closeAppointmentModal();
      showPopup("Appointment Saved", feedbackMessage, true);
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
});

const appointmentFormElement = document.getElementById("appointmentForm");
if (appointmentFormElement) {
  appointmentFormElement.addEventListener(
    "submit",
    handleAppointmentFormSubmit,
    true,
  );
}

// Load Available ME Employees (avoid double booking)
async function loadAvailableEmployees() {
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
  } catch (err) {
    console.error("Error loading employees:", err);
    populateEmployeeSelect(select, [], "Unable to load employees");
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
};
