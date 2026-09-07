let currentUser = null;
let currentLeadId = null;
let popupTimer = null;
let attendanceUpdating = false;
let attendanceCalendarVisible = false;
let attendanceLocationRequestSubmitting = false;
let meLeadSubmitting = false;
let meTargetProgressChart = null;
let meDashboardChart = null;
const MONTHLY_TARGET = 200000;
const FIXED_SALES_COMMISSION_PERCENT = 10;
let currentMonthlyTarget = MONTHLY_TARGET;
let dealProductsCatalog = null;
let leadDownsaleRequests = [];
let approvedDownsaleRequest = null;
let appliedUpsaleAmount = 0;
let downsaleApiAvailable = true;
let downsalePollingTimer = null;
let meRenewalAttribution = null;
let currentProposalId = null;
let proposalSubmitting = false;
let currentProposalMeta = {};
const proposalSummaryCache = new Map();
const PROPOSAL_REQUEST_TIMEOUT_MS = 15000;

const meDashboardState = {
  counts: {
    appointments: 0,
    followups: 0,
    deals: 0,
  },
  deals: [],
  salesMix: {
    newSaleCount: 0,
    renewalCount: 0,
    newSaleAmount: 0,
    renewalAmount: 0,
  },
  attendanceToday: null,
};

const BASE_URL =
  window.location.protocol === "file:"
    ? "http://localhost:3000"
    : ["localhost", "127.0.0.1"].includes(window.location.hostname)
      ? "http://localhost:3000"
      : window.location.origin;
const PROPOSAL_LETTERHEAD_HEADER_URL = `${BASE_URL}/letterhead-header.jpeg`;
const PROPOSAL_LETTERHEAD_FOOTER_URL = `${BASE_URL}/letterhead-footer.jpeg`;
const PROPOSAL_REDSEA_LETTERHEAD_HEADER_URL = `${BASE_URL}/redsea-letterhead-header.jpeg`;
const PROPOSAL_REDSEA_LETTERHEAD_FOOTER_URL = `${BASE_URL}/redsea-letterhead-footer.jpeg`;

function getCurrentUserId() {
  return Number(
    currentUser?.id ||
      currentUser?.userId ||
      currentUser?.user_id ||
      currentUser?.employeeId ||
      currentUser?.employee_id ||
      0,
  );
}

async function fetchProposalRequest(url, options = {}, routeLabel = "Proposal API") {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), PROPOSAL_REQUEST_TIMEOUT_MS);

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    });
  } catch (err) {
    if (err?.name === "AbortError") {
      throw new Error(`${routeLabel} timed out. Please restart the backend and try again.`);
    }

    throw err;
  } finally {
    window.clearTimeout(timeout);
  }
}

async function parseProposalApiResponse(response, routeLabel = "Proposal API") {
  const text = await response.text();
  let data = {};

  if (text) {
    try {
      data = JSON.parse(text);
    } catch (_err) {
      if (response.status === 404) {
        throw new Error(
          `${routeLabel} route is missing on the server (404). Redeploy or restart the live backend with the latest server.js proposal routes.`,
        );
      }

      throw new Error(
        `${routeLabel} returned an HTML/non-JSON response (${response.status || "unknown"}). Check if the backend is down or serving an error page.`,
      );
    }
  }

  return data;
}

const ATTENDANCE_GEOFENCE = {
  latitude: 19.168507,
  longitude: 72.842137,
  radiusMeters: 50,
  address:
    "Riddhi Siddhi Complex, E-107, Swami Vivekananda Rd, opposite Patkar College, Unnat Nagar, Goregaon West, Mumbai, Maharashtra 400104",
};
let attendanceLocationRequestState = {
  officeZone: { ...ATTENDANCE_GEOFENCE, type: "office", label: "Office" },
  activeRequest: null,
  activeZone: { ...ATTENDANCE_GEOFENCE, type: "office", label: "Office" },
};

function getEmptyProjectTrackerCounts() {
  return {
    total: 0,
    assigned: 0,
    ongoing: 0,
    completed: 0,
    unassigned: 0,
  };
}

async function loadMeProjectTracker() {
  if (!window.ProjectTrackerUI || !currentUser?.id) return;

  ProjectTrackerUI.renderMessage(
    "meProjectsContainer",
    "Loading project updates...",
    "Fetching the latest phase details for your assigned projects.",
  );

  try {
    const params = new URLSearchParams({
      scope: "me",
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

    ProjectTrackerUI.renderStats("meProjectTrackerStats", result.counts, {
      assignmentCounts: result.assignmentCounts,
    });
    ProjectTrackerUI.renderProjects("meProjectsContainer", result);
  } catch (err) {
    console.error("ME Project Tracker Error:", err);
    ProjectTrackerUI.renderStats("meProjectTrackerStats", getEmptyProjectTrackerCounts(), {
      assignmentCounts: { total: 0 },
    });
    ProjectTrackerUI.renderMessage(
      "meProjectsContainer",
      "Project tracker unavailable",
      "Live phase details will show here after the latest server update is active.",
    );
  }
}

window.onload = () => {
  loadUser();
  setupMeLeadForm();
  setupAttendanceLocationRequestModal();
  setupProposalForm();

  if (currentUser?.id) {
    loadMeDashboard();
  }
};

// ================= USER =================
function loadUser() {
  const user = localStorage.getItem("currentUser");

  if (!user) {
    showPopup("Session Expired", "Login again", false);
    setTimeout(() => (window.location.href = "mp.html"), 1500);
    return;
  }

  currentUser = JSON.parse(user);
  const normalizedUserId = getCurrentUserId();
  if (normalizedUserId) {
    currentUser.id = normalizedUserId;
  }

  document.getElementById("userName").textContent = currentUser.name;

  // ✅ FIX
  if (currentUser.prof_img) {
    document.getElementById("userAvatar").src =
      BASE_URL + "/" + currentUser.prof_img;
  }
}

// ================= TAB SWITCH =================
function showSection(sectionId, el) {
  document
    .querySelectorAll(".section")
    .forEach((sec) => sec.classList.remove("active"));

  const section = document.getElementById(sectionId);
  if (section) section.classList.add("active");

  document
    .querySelectorAll(".sidebar li")
    .forEach((li) => li.classList.remove("active"));

  let activeLi = el;

  if (!activeLi) {
    activeLi = Array.from(document.querySelectorAll(".sidebar li")).find(
      (li) =>
        li.getAttribute("onclick") &&
        li.getAttribute("onclick").includes(`'${sectionId}'`),
    );
  }

  if (activeLi) activeLi.classList.add("active");

  if (sectionId === "dashboard") loadMeDashboard();
  if (sectionId === "appointments") fetchMEData();
  if (sectionId === "followups") fetchFollowups();
  if (sectionId === "deals") fetchDeals();
  if (sectionId === "createProposal") loadMyProposals();
  if (sectionId === "projects") loadMeProjectTracker();
  if (sectionId === "attendance") fetchAttendance();
  if (sectionId === "salary") window.PayrollUI?.handleSectionShown("salary");
  if (sectionId === "reports") {
    fetchReports();
    loadReportsCounts();
  }
  if (sectionId === "taxInvoice") fetchTaxInvoices();
}
// ================= APPOINTMENTS =================
async function fetchMEData() {
  if (!currentUser || !currentUser.id) return;

  try {
    const res = await fetch(`${BASE_URL}/api/appointments/${currentUser.id}`);
    const data = await res.json();

    const container = document.getElementById("appointmentsContainer");

    if (!data.success || !data.data || data.data.length === 0) {
      container.innerHTML = `<p class="no-data">No Appointments Found</p>`;
      return;
    }

    let table = `
            <table class="data-table">
                <thead>
                    <tr>
                        <th>Company</th>
                        <th>Client</th>
                        <th>Contact</th>
                        <th>Date</th>
                        <th>Time</th>
                        <th>Location</th>
                        <th>Status</th>
                    </tr>
                </thead>
                <tbody>
        `;

    data.data.forEach((item) => {
      const isNotInterested = item.lead_status === "not_interested";
      const statusText =
        item.lead_status === "not_interested"
          ? "Not Interested"
          : item.lead_status === "deal_closed"
            ? "Deal Closed"
            : "Active";

      table += `
<tr 
  data-id="${item.id}"
  data-company="${item.company_name || ""}"
  data-client="${item.client_name || ""}"
  class="${isNotInterested ? "grayed-out" : ""}"
>
    <td>${item.company_name || "-"}</td>
    <td>${item.client_name || "-"}</td>
    <td>${item.contact || "-"}</td>
    <td>${item.app_date || "-"}</td>
    <td>${item.app_time || "-"}</td>
    <td>
        <a href="${item.location || "-"}" target="_blank" rel="noopener noreferrer" class="location-link">
            View Location
        </a>
    </td>
    <td>
        <span class="status ${item.lead_status || "active"}">
            ${statusText}
        </span>
    </td>
</tr>
`;
    });

    table += `</tbody></table>`;
    container.innerHTML = `<div class="table-wrapper">${table}</div>`;
  } catch (err) {
    console.error("Appointments Error:", err);
  }
}

function closeActionModal() {
  const modal = document.getElementById("actionModal");

  modal.classList.remove("show");
  modal.classList.add("hidden");
  resetActionForms();
}

function setupMeLeadForm() {
  const addClientBtn = document.getElementById("meAddClientBtn");
  const form = document.getElementById("meLeadForm");
  const actionType = document.getElementById("meLeadActionType");
  const appDate = document.getElementById("meLeadAppDate");
  const appTime = document.getElementById("meLeadAppTime");
  const companyScope = document.querySelector('#meLeadForm [name="company_scope"]');

  if (addClientBtn && !addClientBtn.dataset.bound) {
    addClientBtn.addEventListener("click", openMeLeadForm);
    addClientBtn.dataset.bound = "true";
  }

  if (form && !form.dataset.bound) {
    form.addEventListener("submit", handleMeLeadFormSubmit);
    form.dataset.bound = "true";
  }

  if (actionType && !actionType.dataset.bound) {
    actionType.addEventListener("change", toggleMeLeadActionSections);
    actionType.dataset.bound = "true";
  }

  [appDate, appTime].forEach((field) => {
    if (!field || field.dataset.bound) return;
    field.addEventListener("change", () => loadMeLeadEmployees());
    field.dataset.bound = "true";
  });

  if (companyScope && !companyScope.dataset.bound) {
    companyScope.addEventListener("change", () => loadMeLeadEmployees());
    companyScope.dataset.bound = "true";
  }

  toggleMeLeadActionSections();
}

function normalizeMeLeadCompanyScope(value) {
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

function getDefaultMeLeadCompanyScope() {
  return (
    normalizeMeLeadCompanyScope(
      currentUser?.company_key ||
        currentUser?.selected_company ||
        currentUser?.comp_name,
    ) || "metrics"
  );
}

function setMeLeadCompanyScope(value = "") {
  const field = document.querySelector('#meLeadForm [name="company_scope"]');
  if (field) {
    field.value = normalizeMeLeadCompanyScope(value) || getDefaultMeLeadCompanyScope();
  }
}

function openMeLeadForm() {
  const modal = document.getElementById("meLeadModal");
  const form = document.getElementById("meLeadForm");

  if (!modal || !form) return;

  resetMeLeadFormState();
  setMeLeadCompanyScope();
  modal.classList.remove("hidden");
  modal.classList.add("show");
  document.body.classList.add("modal-open");
  form.scrollTop = 0;
  generateMeLeadMapLink();
  loadMeLeadEmployees();

  const firstField = form.querySelector("input, select, textarea, button");
  if (firstField) {
    setTimeout(() => firstField.focus(), 0);
  }
}

function closeMeLeadForm() {
  const modal = document.getElementById("meLeadModal");
  if (!modal) return;

  modal.classList.remove("show");
  modal.classList.add("hidden");
  document.body.classList.remove("modal-open");
  resetMeLeadFormState();
}

function handleMeLeadModalBackdrop(event) {
  if (event.target?.id === "meLeadModal") {
    closeMeLeadForm();
  }
}

function setMeLeadSectionVisibility(section, shouldShow) {
  if (!section) return;
  section.classList.toggle("hidden", !shouldShow);
}

function toggleMeLeadActionSections() {
  const actionType =
    document.getElementById("meLeadActionType")?.value || "appointment";
  const appointmentSection = document.getElementById("meLeadAppointmentSection");
  const followupSection = document.getElementById("meLeadFollowupSection");
  const appointmentFields = [
    document.getElementById("meLeadAppDate"),
    document.getElementById("meLeadAppTime"),
    document.getElementById("meLeadAssignEmp"),
  ];
  const followupFields = [
    document.getElementById("meLeadFollowDate"),
    document.getElementById("meLeadFollowTime"),
    document.getElementById("meLeadReason"),
  ];
  const isAppointment = actionType === "appointment";

  setMeLeadSectionVisibility(appointmentSection, isAppointment);
  setMeLeadSectionVisibility(followupSection, !isAppointment);

  appointmentFields.forEach((field) => {
    if (field) field.required = isAppointment;
  });

  followupFields.forEach((field) => {
    if (field) field.required = !isAppointment;
  });

  if (isAppointment) {
    const locationField = document.getElementById("meLeadLocation");
    const mapsField = document.getElementById("meLeadMapsLink");
    if (locationField && mapsField && !locationField.value) {
      locationField.value = mapsField.value || "";
    }
    loadMeLeadEmployees();
  }
}

function resetMeLeadFormState() {
  const form = document.getElementById("meLeadForm");
  const actionType = document.getElementById("meLeadActionType");
  const employeeSelect = document.getElementById("meLeadAssignEmp");
  const submitBtn = document.getElementById("meLeadSubmitBtn");
  const modalTitle = document.getElementById("meLeadModalTitle");

  meLeadSubmitting = false;
  meRenewalAttribution = null;

  if (form) {
    form.reset();
    setMeLeadCompanyScope();
  }

  if (form?.elements?.sales_type) {
    form.elements.sales_type.value = "new";
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

  if (modalTitle) {
    modalTitle.textContent = "Add Client";
  }

  toggleMeLeadActionSections();
}

function setMeLeadFormMode(mode) {
  const modalTitle = document.getElementById("meLeadModalTitle");
  const submitBtn = document.getElementById("meLeadSubmitBtn");
  const isRenewalMode = mode === "renewal";

  if (modalTitle) {
    modalTitle.textContent = isRenewalMode ? "Create Renewal" : "Add Client";
  }

  if (submitBtn) {
    submitBtn.disabled = false;
    submitBtn.textContent = isRenewalMode ? "Create Renewal" : "Add Client";
  }
}

function populateMeLeadEmployeeSelect(select, employees, emptyLabel) {
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

function getSelectedMeLeadEmployeeMeta(selectOrId) {
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

function getMeLeadEmployeeRows(employees = []) {
  if (employees.length) return employees;

  if (
    String(currentUser?.role || "").toLowerCase().trim() === "me" &&
    currentUser?.name
  ) {
    return [
      {
        id: currentUser.id || "",
        name: currentUser.name,
        contact: currentUser.contact || "",
      },
    ];
  }

  return [];
}

function parseMeStoredArray(value) {
  if (Array.isArray(value)) return value;
  if (value == null || value === "") return [];

  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) return parsed;
  } catch (err) {
    // Fall back to comma separated values from older rows.
  }

  return String(value)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function setMeLeadFormValue(name, value) {
  const field = document.querySelector(`#meLeadForm [name="${name}"]`);
  if (field) field.value = value ?? "";
}

function setMeLeadCheckboxGroup(name, values) {
  const selectedValues = new Set(
    parseMeStoredArray(values).map((item) => String(item)),
  );

  document.querySelectorAll(`#meLeadForm [name="${name}"]`).forEach((input) => {
    input.checked = selectedValues.has(input.value);
  });
}

function selectMeLeadEmployee(name, id) {
  const select = document.getElementById("meLeadAssignEmp");
  if (!select) return;

  const normalizedId = String(id || "");
  const normalizedName = String(name || "");
  const match = Array.from(select.options).find((option) => {
    return (
      (normalizedId && option.dataset.employeeId === normalizedId) ||
      (normalizedName && option.value === normalizedName)
    );
  });

  if (match) {
    select.value = match.value;
  }
}

async function fetchMeLeadEmployeeList(date, time) {
  const companyScope =
    document.querySelector('#meLeadForm [name="company_scope"]')?.value ||
    getDefaultMeLeadCompanyScope();
  const params = new URLSearchParams({
    company_scope: companyScope,
    company: companyScope,
  });

  if (date && time) {
    params.set("date", date);
    params.set("time", time);
  }

  const endpoint =
    date && time
      ? `${BASE_URL}/api/available-employees?${params.toString()}`
      : `${BASE_URL}/api/me-employees?${params.toString()}`;

  const res = await fetch(endpoint, {
    cache: "no-store",
  });
  return await res.json();
}

async function loadMeLeadEmployees() {
  const select = document.getElementById("meLeadAssignEmp");
  const date = document.getElementById("meLeadAppDate")?.value || "";
  const time = document.getElementById("meLeadAppTime")?.value || "";

  if (!select) return;

  const previousEmployee = getSelectedMeLeadEmployeeMeta(select);

  try {
    const result = await fetchMeLeadEmployeeList(date, time);

    if (!result.success) {
      throw new Error(result.message || "Failed to load employees");
    }

    const employees = getMeLeadEmployeeRows(result.data || []);
    populateMeLeadEmployeeSelect(
      select,
      employees,
      date && time
        ? "No employee available at this time"
        : "No employees found",
    );

    if (previousEmployee.name || previousEmployee.id) {
      selectMeLeadEmployee(previousEmployee.name, previousEmployee.id);
    }

    if (!select.value) {
      selectMeLeadEmployee(currentUser?.name, currentUser?.id);
    }
  } catch (err) {
    console.error("ME lead employee load error:", err);
    populateMeLeadEmployeeSelect(select, [], "Unable to load employees");
  }
}

function generateMeLeadMapLink() {
  const form = document.getElementById("meLeadForm");
  const mapsField = document.getElementById("meLeadMapsLink");
  const locationField = document.getElementById("meLeadLocation");

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

async function populateMeLeadFormFromDeal(lead) {
  const actionTypeValue =
    lead.action_type === "followup" ? "followup" : "appointment";

  setMeLeadFormValue("company", lead.company_name);
  setMeLeadFormValue("client", lead.client_name);
  setMeLeadFormValue("contact", lead.contact);
  setMeLeadFormValue("alt_contact", lead.alternate_contact);
  setMeLeadFormValue("telephone", lead.telephone);
  setMeLeadFormValue("email", lead.email);
  setMeLeadFormValue("gst_no", lead.gst_no);
  setMeLeadFormValue("flat_no", lead.flat_no);
  setMeLeadFormValue("building_name", lead.building_name);
  setMeLeadFormValue("locality", lead.locality);
  setMeLeadFormValue("city", lead.city);
  setMeLeadFormValue("pincode", lead.pincode);
  setMeLeadFormValue("state", lead.state);
  setMeLeadFormValue("maps_lnk", lead.maps_lnk);
  setMeLeadCompanyScope(lead.company_scope);
  setMeLeadFormValue("sales_type", "renewal");
  setMeLeadFormValue("source_lead", lead.source_lead);
  setMeLeadFormValue("industry_type", lead.industry_type);
  setMeLeadFormValue("service_notes", lead.service_notes);
  setMeLeadCheckboxGroup("web_type[]", lead.web_type);
  setMeLeadCheckboxGroup("seo_type[]", lead.seo_type);
  setMeLeadCheckboxGroup("smo_type[]", lead.smo_type);
  setMeLeadCheckboxGroup("app_type[]", lead.app_type);
  setMeLeadCheckboxGroup("erp_type[]", lead.erp_type);
  setMeLeadCheckboxGroup("services[]", lead.services);
  setMeLeadFormValue("actionType", actionTypeValue);
  setMeLeadFormValue("app_date", lead.app_date ? String(lead.app_date).slice(0, 10) : "");
  setMeLeadFormValue("app_time", lead.app_time ? String(lead.app_time).slice(0, 5) : "");
  setMeLeadFormValue("location", lead.location || lead.maps_lnk);
  setMeLeadFormValue("follow_date", lead.follow_date ? String(lead.follow_date).slice(0, 10) : "");
  setMeLeadFormValue("follow_time", lead.follow_time ? String(lead.follow_time).slice(0, 5) : "");
  setMeLeadFormValue("reason", lead.reason);
  setMeLeadFormValue("additional_notes", lead.additional_notes);

  toggleMeLeadActionSections();
  if (actionTypeValue === "appointment") {
    await loadMeLeadEmployees();
    selectMeLeadEmployee(lead.assign_emp, lead.assign_emp_id);
  }

  if (!lead.maps_lnk) {
    generateMeLeadMapLink();
  }
}

async function openMeRenewalFromDeal(leadId) {
  try {
    const res = await fetch(`${BASE_URL}/api/leads/${leadId}`, {
      cache: "no-store",
    });
    const result = await res.json();

    if (!res.ok || !result.success || !result.data) {
      throw new Error(result.message || "Unable to load deal details");
    }

    const modal = document.getElementById("meLeadModal");
    const form = document.getElementById("meLeadForm");
    if (!modal || !form) return;

    const lead = result.data;
    resetMeLeadFormState();
    meRenewalAttribution = {
      sourceLeadId: Number(lead.id || leadId || 0) || null,
      createdBy: Number(lead.created_by || currentUser?.id || 0) || null,
      createdByName:
        lead.created_by_name ||
        lead.createdByName ||
        (Number(lead.created_by || 0) === Number(currentUser?.id || 0)
          ? currentUser?.name || ""
          : ""),
    };
    await populateMeLeadFormFromDeal(lead);
    setMeLeadFormMode("renewal");
    modal.classList.remove("hidden");
    modal.classList.add("show");
    document.body.classList.add("modal-open");
    form.scrollTop = 0;
  } catch (err) {
    console.error("ME renewal lead load error:", err);
    showPopup("Renewal", err.message || "Server error while loading renewal form", false);
  }
}

async function handleMeLeadFormSubmit(event) {
  event.preventDefault();

  if (meLeadSubmitting) return;

  const formElement = event.currentTarget;
  const formData = new FormData(formElement);
  const actionTypeValue =
    document.getElementById("meLeadActionType")?.value || "appointment";
  const selectedEmployee = getSelectedMeLeadEmployeeMeta("meLeadAssignEmp");
  const submitBtn = document.getElementById("meLeadSubmitBtn");
  const originalText = submitBtn ? submitBtn.innerHTML : "";
  const mapsLink = document.getElementById("meLeadMapsLink")?.value || "";
  const locationValue = formData.get("location") || mapsLink || "";
  const salesTypeValue = formData.get("sales_type") || "new";
  const renewalCreator =
    salesTypeValue === "renewal" ? meRenewalAttribution : null;

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
    company_scope: formData.get("company_scope") || getDefaultMeLeadCompanyScope(),
    source_lead: formData.get("source_lead"),
    industry_type: formData.get("industry_type"),
    sales_type: salesTypeValue,
    renewal_source_lead_id: renewalCreator?.sourceLeadId || null,
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
    created_by: renewalCreator?.createdBy || currentUser?.id || null,
    created_by_name: renewalCreator?.createdByName || currentUser?.name || "",
    notify_whatsapp: false,
  };

  meLeadSubmitting = true;

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

    closeMeLeadForm();
    showPopup("Success", "Client added successfully", true);
    loadMeDashboard();
  } catch (err) {
    console.error("ME lead save error:", err);
    showPopup("Error", err.message || "Failed to save client", false);
  } finally {
    meLeadSubmitting = false;

    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalText || "Add Client";
    }
  }
}

function setSalesTargetText(id, value) {
  const element = document.getElementById(id);
  if (element) element.textContent = value;
}

function setSalesTargetMetricLabel(valueId, label) {
  const valueElement = document.getElementById(valueId);
  const labelElement = valueElement?.parentElement?.querySelector("span");
  if (labelElement) labelElement.textContent = label;
}

function formatSalesTargetMoney(value) {
  const amount = Number(value || 0);
  return `Rs. ${amount.toLocaleString("en-IN", {
    maximumFractionDigits: 0,
  })}`;
}

function formatSalesTargetCount(value, singularLabel, pluralLabel) {
  const count = normalizeMeDashboardNumber(value);
  const label = count === 1 ? singularLabel : pluralLabel;
  return `${count} ${label}`;
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

function escapeMeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function summarizeDealMix(deals = []) {
  const seenClients = new Set();
  const orderedDeals = [...deals].sort((left, right) => {
    const leftDate = new Date(left?.closed_date || 0).getTime();
    const rightDate = new Date(right?.closed_date || 0).getTime();

    if (leftDate !== rightDate) return leftDate - rightDate;
    return Number(left?.id || 0) - Number(right?.id || 0);
  });

  return orderedDeals.reduce(
    (summary, deal) => {
      const amount = normalizeMeDashboardNumber(deal?.deal_amount);
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

function updateMeTargetProgressInsights(target, achieved, remaining) {
  const dealsCount = normalizeMeDashboardNumber(
    meDashboardState.counts?.deals ?? meDashboardState.deals?.length,
  );
  const salesMix = meDashboardState.salesMix || {};
  const achievedPercent =
    target > 0 ? Math.min((achieved / target) * 100, 100).toFixed(1) : "0.0";

  setSalesTargetText(
    "meTargetHeroValue",
    `${formatSalesTargetMoney(achieved)} achieved`,
  );

  let heroText = "Start closing deals to build momentum for your monthly target.";
  if (target > 0 && achieved > 0) {
    heroText =
      remaining === 0 && achieved >= target
        ? `Target completed. You are now ahead by ${formatSalesTargetMoney(Math.max(achieved - target, 0))}.`
        : `${formatSalesTargetMoney(remaining)} left to reach ${formatSalesTargetMoney(target)} this month.`;
  } else if (target > 0) {
    heroText = `Your current monthly goal is ${formatSalesTargetMoney(target)}. Close the first deal to get this ring moving.`;
  }

  setSalesTargetText("meTargetHeroText", heroText);
  setSalesTargetText("meTargetInsightAchieved", formatSalesTargetMoney(achieved));
  setSalesTargetText("meTargetInsightAchievedHint", `${achievedPercent}% completed`);
  setSalesTargetText("meTargetInsightRemaining", formatSalesTargetMoney(remaining));
  setSalesTargetText(
    "meTargetInsightRemainingHint",
    remaining === 0 && achieved >= target
      ? "Monthly target completed"
      : "Still left to hit target",
  );
  setSalesTargetText("meTargetInsightDeals", String(dealsCount));
  setSalesTargetText(
    "meTargetInsightDealsHint",
    dealsCount
      ? formatSalesTargetCount(dealsCount, "closed deal", "closed deals")
      : "No closed deals yet",
  );
  setSalesTargetText(
    "meTargetInsightNewSale",
    String(normalizeMeDashboardNumber(salesMix.newSaleCount)),
  );
  setSalesTargetText(
    "meTargetInsightNewSaleHint",
    salesMix.newSaleCount
      ? `${formatSalesTargetMoney(salesMix.newSaleAmount)} from new sales`
      : "Fresh client wins",
  );
  setSalesTargetText(
    "meTargetInsightRenewal",
    String(normalizeMeDashboardNumber(salesMix.renewalCount)),
  );
  setSalesTargetText(
    "meTargetInsightRenewalHint",
    salesMix.renewalCount
      ? salesMix.renewalAmount
        ? `${formatSalesTargetMoney(salesMix.renewalAmount)} closed renewal value`
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

function applyMeCommissionSummary(prefix, data = {}) {
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
  setSalesTargetMetricLabel(`${prefix}TargetSet`, "Commission Rate");
  setSalesTargetMetricLabel(`${prefix}TargetAchieved`, "Sales Closed");
  setSalesTargetMetricLabel(`${prefix}TargetRemaining`, "Commission");
  setSalesTargetText(`${prefix}TargetSet`, `${commissionPercent.toFixed(0)}%`);
  setSalesTargetText(`${prefix}TargetSetHint`, "Flat on closed sales");
  setSalesTargetText(`${prefix}TargetAchieved`, formatSalesTargetMoney(achieved));
  setSalesTargetText(`${prefix}TargetRemaining`, formatSalesTargetMoney(commissionAmount));
  setSalesTargetText(`${prefix}TargetAchievedHint`, "No monthly target");
  setSalesTargetText(`${prefix}TargetRemainingHint`, "Auto-calculated commission");

  if (prefix === "me") {
    setSalesTargetText("meTargetProgressLabel", `${commissionPercent.toFixed(0)}% commission`);
    setSalesTargetMetricLabel("meTargetInsightAchieved", "Sales Closed");
    setSalesTargetMetricLabel("meTargetInsightRemaining", "Commission");
    updateMeTargetProgressInsights(0, achieved, 0);
    setSalesTargetText("meTargetHeroValue", `${formatSalesTargetMoney(commissionAmount)} commission`);
    setSalesTargetText(
      "meTargetHeroText",
      achieved > 0
        ? `${formatSalesTargetMoney(achieved)} closed sales par ${commissionPercent.toFixed(0)}% commission.`
        : "Commission profile par monthly target nahi hai. Closed sales par flat 10% commission milega.",
    );
    setSalesTargetText("meTargetInsightAchieved", formatSalesTargetMoney(achieved));
    setSalesTargetText("meTargetInsightAchievedHint", "Commissionable sales");
    setSalesTargetText("meTargetInsightRemaining", formatSalesTargetMoney(commissionAmount));
    setSalesTargetText("meTargetInsightRemainingHint", "Estimated payout");
    renderMeTargetProgressChart(achieved || 1, commissionAmount, {
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
    applyMeCommissionSummary(prefix, data);
    return;
  }

  const targetValue = Number(data.target ?? MONTHLY_TARGET);
  const target = Number.isFinite(targetValue) ? targetValue : MONTHLY_TARGET;
  const achieved = Number(data.achieved || 0);
  const remaining = Math.max(Number(data.remaining || 0), 0);
  const targetText = formatSalesTargetMoney(target);
  currentMonthlyTarget = target;
  const achievedPercent =
    target > 0 ? Math.min((achieved / target) * 100, 100).toFixed(1) : "0.0";

  setSalesTargetMetricLabel(`${prefix}TargetSet`, "Target Set");
  setSalesTargetMetricLabel(`${prefix}TargetAchieved`, "Target Achieved");
  setSalesTargetMetricLabel(`${prefix}TargetRemaining`, "Remaining Target");
  setSalesTargetMetricLabel("meTargetInsightAchieved", "Achieved");
  setSalesTargetMetricLabel("meTargetInsightRemaining", "Remaining");
  const headerTitle = document.querySelector("#dashboard .sales-target-header h3");
  const headerNote = document.querySelector("#dashboard .sales-target-header p");
  const targetButton = document.querySelector("#dashboard .sales-target-header .target-set-btn");
  if (headerTitle) headerTitle.textContent = "Monthly Sales Target";
  if (headerNote) headerNote.textContent = "Admin-assigned goal with live achieved vs remaining sales.";
  if (targetButton) {
    targetButton.title = "Monthly target is assigned by admin";
    targetButton.innerHTML = '<i class="fas fa-shield-halved"></i> Assigned by Admin';
  }
  setSalesTargetText(`${prefix}TargetSet`, formatSalesTargetMoney(target));
  setSalesTargetText(`${prefix}TargetSetHint`, "Current monthly goal");

  setSalesTargetText(`${prefix}TargetAchieved`, formatSalesTargetMoney(achieved));
  setSalesTargetText(`${prefix}TargetRemaining`, formatSalesTargetMoney(remaining));
  setSalesTargetText(`${prefix}TargetAchievedHint`, `${achievedPercent}% of ${targetText}`);
  setSalesTargetText(
    `${prefix}TargetRemainingHint`,
    remaining === 0 && achieved >= target
      ? "Monthly target achieved"
      : `Pending from ${targetText}`,
  );

  if (prefix === "me") {
    setSalesTargetText("meTargetProgressLabel", `${achievedPercent}% achieved`);
    updateMeTargetProgressInsights(
      target,
      achieved,
      remaining,
    );
    renderMeTargetProgressChart(target, achieved);
  }
}

function handleDashboardShortcutKey(event, sectionId) {
  if (!event) return;

  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    showSection(sectionId);
  }
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

function setMeDashboardText(id, value) {
  const element = document.getElementById(id);
  if (element) element.textContent = value;
}

function formatMeDashboardMoney(value) {
  const amount = Number(value || 0);
  return `Rs. ${amount.toLocaleString("en-IN", {
    maximumFractionDigits: 0,
  })}`;
}

function normalizeMeDashboardNumber(value) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number : 0;
}

function renderMeTargetProgressChart(target, achieved, options = {}) {
  const remaining = Math.max(Number(target) - Number(achieved || 0), 0);
  const progressValue =
    Number(target) > 0
      ? Math.min((Number(achieved || 0) / Number(target)) * 100, 100)
      : 0;
  const chartLabels = options.labels || ["Achieved", "Remaining"];
  const chartData = options.data || [Number(achieved || 0), remaining];

  const canvas = document.getElementById("meTargetProgressChart");
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const centerTextPlugin = {
    id: "meTargetCenterText",
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

  if (meTargetProgressChart) meTargetProgressChart.destroy();

  meTargetProgressChart = new Chart(ctx, {
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
              return `${context.label}: ${formatMeDashboardMoney(value)}`;
            },
          },
        },
      },
    },
  });
}

function renderMeDashboardChart(metrics) {
  const canvas = document.getElementById("meDashboardChart");
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  if (meDashboardChart) meDashboardChart.destroy();

  meDashboardChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: ["Appointments", "Follow Ups", "Deals"],
      datasets: [
        {
          label: "Total",
          data: [
            metrics?.appointments || 0,
            metrics?.followups || 0,
            metrics?.deals || 0,
          ],
          backgroundColor: ["#7c3aed", "#f59e0b", "#22c55e"],
          borderRadius: 10,
          maxBarThickness: 72,
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
        x: { grid: { display: false } },
        y: { beginAtZero: true, ticks: { precision: 0 } },
      },
    },
  });
}

function renderMeRecentDeals(deals = []) {
  const tbody = document.getElementById("meDashboardRecentDeals");
  if (!tbody) return;

  if (!deals.length) {
    tbody.innerHTML = `<tr><td colspan="5">No recent deals found</td></tr>`;
    return;
  }

  const recent = deals.slice(0, 6);
  tbody.innerHTML = recent
    .map((deal) => {
      const amount = formatMeDashboardMoney(deal?.deal_amount || 0);
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

function renderMeDashboard() {
  const counts = meDashboardState.counts || {};
  const dealRows = Array.isArray(meDashboardState.deals)
    ? meDashboardState.deals
    : [];

  const leadsCount = normalizeMeDashboardNumber(counts.leads);
  const appointments = normalizeMeDashboardNumber(counts.appointments);
  const followups = normalizeMeDashboardNumber(counts.followups);
  const dealsCount = normalizeMeDashboardNumber(counts.deals ?? dealRows.length);
  const totalSales = dealRows.reduce(
    (sum, deal) => sum + normalizeMeDashboardNumber(deal?.deal_amount),
    0,
  );
  const funnelLeads = Math.max(leadsCount, appointments, followups, dealsCount);
  const conversionRate =
    funnelLeads > 0 ? ((dealsCount / funnelLeads) * 100).toFixed(1) : "0.0";

  setMeDashboardText("meDashboardSales", formatMeDashboardMoney(totalSales));
  setMeDashboardText(
    "meDashboardSalesHint",
    dealsCount ? `${dealsCount} closed deal${dealsCount === 1 ? "" : "s"}` : "From closed deals",
  );
  setMeDashboardText("meDashboardAppointments", String(appointments));
  setMeDashboardText("meDashboardFollowups", String(followups));
  setMeDashboardText("meDashboardDeals", String(dealsCount));
  setMeDashboardText("meDashboardFunnelRate", `${conversionRate}% converted`);
  setMeDashboardText("meFunnelLeads", String(funnelLeads));
  setMeDashboardText("meFunnelAppointments", String(appointments));
  setMeDashboardText("meFunnelFollowups", String(followups));
  setMeDashboardText("meFunnelDeals", String(dealsCount));
  setMeDashboardText("meFunnelConversionRate", `${conversionRate}%`);

  const todayRow = meDashboardState.attendanceToday;
  const hasAttendanceCheckIn = Boolean(todayRow?.check_in);
  const isAttendanceAbsent = todayRow?.status === "absent";
  const attendanceMeta =
    hasAttendanceCheckIn || isAttendanceAbsent
      ? getAttendanceStatusMeta(todayRow?.status)
      : null;
  const attendanceStatus = attendanceMeta ? attendanceMeta.label : "Not marked";
  const attendanceTime = isAttendanceAbsent
    ? hasAttendanceCheckIn
      ? `In ${todayRow.check_in} / Out ${getAttendanceCheckoutDisplay(todayRow)}`
      : "Check out missing"
    : hasAttendanceCheckIn
      ? `In ${todayRow.check_in} / Out ${getAttendanceCheckoutDisplay(todayRow)}`
      : "Check in pending";

  setMeDashboardText("meDashboardAttendance", attendanceStatus);
  setMeDashboardText("meDashboardAttendanceTime", attendanceTime);

  renderMeDashboardChart({ appointments, followups, deals: dealsCount });
  renderMeRecentDeals(dealRows);
}

async function loadMeDashboard() {
  if (!currentUser?.id) return;

  try {
    const reportsUrl = `${BASE_URL}/api/reports/counts?userId=${currentUser.id}&role=${encodeURIComponent(currentUser.role || "me")}`;
    const dealsUrl = `${BASE_URL}/api/deals/${currentUser.id}`;
    const attendanceUrl = `${BASE_URL}/api/attendance/${currentUser.id}`;

    const [reportsRes, dealsRes, attendanceRes] = await Promise.all([
      fetch(reportsUrl, { cache: "no-store" }),
      fetch(dealsUrl, { cache: "no-store" }),
      fetch(attendanceUrl, { cache: "no-store" }),
    ]);

    const reports = await reportsRes.json();
    const deals = await dealsRes.json();
    const attendance = await attendanceRes.json();

    const reportData = reports?.data || {};
    meDashboardState.counts = {
      leads: normalizeMeDashboardNumber(reportData.leads),
      appointments: normalizeMeDashboardNumber(reportData.appointments),
      followups: normalizeMeDashboardNumber(reportData.followups),
      deals: normalizeMeDashboardNumber(reportData.deals),
    };

    const dealRows = deals?.success && Array.isArray(deals.data) ? deals.data : [];
    meDashboardState.deals = dealRows;
    meDashboardState.salesMix = summarizeDealMix(dealRows);

    const attendanceRows =
      attendance?.success && Array.isArray(attendance.data) ? attendance.data : [];
    const today = formatDateKey(new Date());
    meDashboardState.attendanceToday =
      attendanceRows.find((row) => row.attendance_date === today) || null;

    await loadMeSalesTargetSummary(dealRows);
    renderMeDashboard();
  } catch (err) {
    console.error("ME Dashboard Load Error:", err);
  }
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
    const params = new URLSearchParams({
      userId: currentUser.id,
      role: currentUser.role || "me",
    });
    const res = await fetch(
      `${BASE_URL}/api/sales-target-summary?${params.toString()}`,
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
    console.warn("Using default target fallback for ME:", err.message || err);
  }

  return { target: currentMonthlyTarget || MONTHLY_TARGET };
}

async function loadMeSalesTargetSummary(deals = []) {
  const dealRows = Array.isArray(deals) ? deals : [];
  const achieved = dealRows.reduce(
    (sum, deal) => sum + Number(deal?.deal_amount || 0),
    0,
  );

  const targetSummary = await fetchMonthlyTargetSummary();
  const target = Number(targetSummary?.target ?? currentMonthlyTarget ?? MONTHLY_TARGET);
  const isCommissionProfile = isCommissionSalesSummary(targetSummary);

  applySalesTargetSummary("me", {
    ...targetSummary,
    target,
    achieved,
    remaining: isCommissionProfile ? 0 : Math.max(target - achieved, 0),
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

// ================= DEALS =================
function getMeRenewalButtonMeta(deal = {}) {
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

async function fetchDeals() {
  if (!currentUser || !currentUser.id) return;

  try {
    const res = await fetch(`${BASE_URL}/api/deals/${currentUser.id}`);
    const data = await res.json();

    const container = document.getElementById("dealsContainer");
    const dealRows = data.success && Array.isArray(data.data) ? data.data : [];

    meDashboardState.deals = dealRows;
    meDashboardState.salesMix = summarizeDealMix(dealRows);
    await loadMeSalesTargetSummary(dealRows);

    if (!data.success || !data.data || data.data.length === 0) {
      container.innerHTML = `<p class="no-data">No Deals Found</p>`;
      return;
    }

    let table = `
      <table class="data-table">
        <thead>
          <tr>
            <th>Company</th>
            <th>Client</th>
            <th>Amount</th>
            <th>Payment Method</th>
            <th>Closed Date</th>
            <th>PFI</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
    `;

    data.data.forEach((item) => {
      const safeContact = String(item.contact || "").replace(/'/g, "\\'");
      const safeEmail = String(item.email || "").replace(/'/g, "\\'");
      const renewalMeta = getMeRenewalButtonMeta(item);
      table += `
        <tr>
          <td>${escapeMeHtml(item.company_name || "-")}</td>
          <td>${escapeMeHtml(item.client_name || "-")}</td>
          <td>Rs. ${escapeMeHtml(item.deal_amount || "0")}</td>
          <td>${escapeMeHtml(item.payment_method || "-")}</td>
          <td>${escapeMeHtml(item.closed_date || "-")}</td>
          <td class="invoice-actions">
            <button onclick="downloadInvoice(${Number(item.id || 0)})" class="btn btn-invoice">
              <i class="fas fa-download"></i>
            </button>
            <button onclick="shareProformaWhatsApp(${Number(item.id || 0)}, '${safeContact}')" class="btn btn-whatsapp">
              <i class="fab fa-whatsapp"></i>
            </button>
            <button onclick="shareProformaGmail('${safeEmail}', ${Number(item.id || 0)})" class="btn btn-gmail">
              <i class="fas fa-envelope"></i>
            </button>
          </td>
          <td>
            <button
              type="button"
              class="btn-renewal ${renewalMeta.className}"
              onclick="openMeRenewalFromDeal(${Number(item.id || 0)})"
              title="${escapeMeHtml(renewalMeta.title)}"
            >
              <i class="${renewalMeta.iconClass}"></i> ${escapeMeHtml(renewalMeta.label)}
            </button>
          </td>
        </tr>
      `;
    });

    table += `</tbody></table>`;
    container.innerHTML = `<div class="table-wrapper">${table}</div>`;
  } catch (err) {
    console.error("Deals fetch error:", err);
  }
}
function downloadTaxInvoice(id) {
  window.open(`${BASE_URL}/api/tax-invoice/${id}`, "_blank");
}

// ================= INVOICE =================

// ✅ FIXED FOR SERVER
function downloadInvoice(id) {
  window.open(`${BASE_URL}/api/invoice/${id}`, "_blank");
}

async function getInvoiceFile(id) {
  const res = await fetch(`${BASE_URL}/api/invoice/${id}`);
  const blob = await res.blob();

  return new File([blob], `invoice_${id}.pdf`, {
    type: "application/pdf",
  });
}

async function shareProformaWhatsApp(id, phone) {
  try {
    const res = await fetch(`${BASE_URL}/api/invoice/${id}`);
    const blob = await res.blob();

    const file = new File([blob], `proforma_invoice_${id}.pdf`, {
      type: "application/pdf",
    });

    const message = "Proforma Invoice shared from Metrics";

    // ✅ Mobile native share (file attach)
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({
        title: "Proforma Invoice",
        text: message,
        files: [file],
      });
    } else {
      // fallback (desktop / unsupported)
      const url = `${BASE_URL}/api/invoice/${id}`;
      const waUrl = `https://wa.me/${phone}?text=${encodeURIComponent("Proforma Invoice: " + url)}`;
      window.open(waUrl, "_blank");
    }
  } catch (err) {
    console.error("Proforma WhatsApp Error:", err);
    alert("Failed to share proforma invoice");
  }
}

async function shareTaxInvoiceWhatsApp(id, phone) {
  try {
    const res = await fetch(`${BASE_URL}/api/tax-invoice/${id}`);
    const blob = await res.blob();

    const file = new File([blob], `tax_invoice_${id}.pdf`, {
      type: "application/pdf",
    });

    const message = "Tax Invoice shared from Metrics";

    // ✅ Mobile native file share
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({
        title: "Tax Invoice",
        text: message,
        files: [file],
      });
    } else {
      // fallback WhatsApp link
      const url = `${BASE_URL}/api/tax-invoice/${id}`;
      const waUrl = `https://wa.me/${phone}?text=${encodeURIComponent("Tax Invoice: " + url)}`;
      window.open(waUrl, "_blank");
    }
  } catch (err) {
    console.error("Tax WhatsApp Error:", err);
    alert("Failed to share tax invoice");
  }
}

// function shareGmail(email, id) {
//     if (!email) {
//         alert("Email not available");
//         return;
//     }

//     const url = `${BASE_URL}/api/invoice/${id}`;

//     const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${email}&su=Invoice&body=${encodeURIComponent(url)}`;

//     window.open(gmailUrl, "_blank");
// }

async function shareProformaGmail(email, id) {
  if (!email) {
    alert("Email not available");
    return;
  }

  try {
    // 1️⃣ First trigger PDF download
    const pdfUrl = `${BASE_URL}/api/invoice/${id}`;
    const a = document.createElement("a");
    a.href = pdfUrl;
    a.download = `proforma_invoice_${id}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    // 2️⃣ Small delay so download starts
    setTimeout(() => {
      // 3️⃣ Open Gmail clean compose (NO LINK IN BODY)
      const gmailUrl =
        `https://mail.google.com/mail/?view=cm&fs=1` +
        `&to=${encodeURIComponent(email)}` +
        `&su=${encodeURIComponent("Proforma Invoice")}` +
        `&body=${encodeURIComponent(
          "Hi,\n\nPlease find the attached Proforma Invoice.\n\nRegards",
        )}`;

      window.open(gmailUrl, "_blank");
    }, 800);
  } catch (err) {
    console.error(err);
    alert("Failed to open Gmail");
  }
}

async function shareTaxInvoiceGmail(email, id) {
  if (!email) {
    alert("Email not available");
    return;
  }

  try {
    // 1️⃣ Auto download tax invoice PDF
    const pdfUrl = `${BASE_URL}/api/tax-invoice/${id}`;

    const a = document.createElement("a");
    a.href = pdfUrl;
    a.download = `tax_invoice_${id}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    // 2️⃣ Open Gmail after short delay
    setTimeout(() => {
      const gmailUrl =
        `https://mail.google.com/mail/?view=cm&fs=1` +
        `&to=${encodeURIComponent(email)}` +
        `&su=${encodeURIComponent("Tax Invoice")}` +
        `&body=${encodeURIComponent(
          "Hi,\n\nPlease find the attached Tax Invoice.\n\nRegards",
        )}`;

      window.open(gmailUrl, "_blank");
    }, 800);
  } catch (err) {
    console.error("Tax Gmail Error:", err);
    alert("Failed to open Gmail");
  }
}

// ================= TAX INVOICES =================
async function fetchTaxInvoices() {
  if (!currentUser || !currentUser.id) return;
  const container = document.getElementById("taxInvoiceContainer");
  if (!container) return;

  try {
    const res = await fetch(`${BASE_URL}/api/deals/${currentUser.id}`);
    const data = await res.json();

    if (!data.success || !data.data || data.data.length === 0) {
      container.innerHTML = `<p class="no-data">No Invoices Found</p>`;
      return;
    }

    // ✅ FILTER: ONLY RECEIVED PAYMENTS
    const receivedDeals = data.data.filter((item) => {
      const status = (item.pay_stat || "").toLowerCase();
      return status === "received";
    });

    if (receivedDeals.length === 0) {
      container.innerHTML = `<p class="no-data">No Received Payments</p>`;
      return;
    }

    let table = `
            <table class="data-table">
                <thead>
                    <tr>
                        <th>Company</th>
                        <th>Client</th>
                        <th>Amount</th>
                        <th>Payment Method</th>
                        <th>Closed Date</th>
                        <th>Invoice</th>
                    </tr>
                </thead>
                <tbody>
        `;

    receivedDeals.forEach((item) => {
      table += `
                <tr>
                    <td>${item.company_name || "-"}</td>
                    <td>${item.client_name || "-"}</td>
                    <td>₹${item.deal_amount || "0"}</td>
                    <td>${item.payment_method || "-"}</td>
                    <td>${item.closed_date || "-"}</td>

                    <td class="invoice-actions">

                        <!-- ✅ DOWNLOAD TAX INVOICE -->
                        <button onclick="downloadTaxInvoice(${item.id})" class="btn btn-invoice">
                            <i class="fas fa-download"></i>
                        </button>

                        <!-- ✅ FIXED: TAX INVOICE WHATSAPP -->
                        <button onclick="shareTaxInvoiceWhatsApp(${item.id}, '${item.contact || ""}')" class="btn btn-whatsapp">
    <i class="fab fa-whatsapp"></i>
</button>

                        <!-- ✅ FIXED: TAX INVOICE GMAIL -->
                       <button onclick="shareTaxInvoiceGmail('${item.email || ""}', ${item.id})" class="btn btn-gmail">
    <i class="fas fa-envelope"></i>
</button>

                    </td>
                </tr>
            `;
    });

    table += `</tbody></table>`;
    container.innerHTML = `<div class="table-wrapper">${table}</div>`;
  } catch (err) {
    console.error("Tax Invoice Error:", err);
    container.innerHTML = `<p class="error">Error loading invoices</p>`;
  }
}

function filterTable(containerId, searchInputId) {
  const input = document.getElementById(searchInputId);
  const container = document.getElementById(containerId);

  if (!input || !container) return;

  const searchValue = input.value.toLowerCase();
  const rows = container.querySelectorAll("table tbody tr");

  rows.forEach((row) => {
    row.style.display = row.textContent.toLowerCase().includes(searchValue)
      ? ""
      : "none";
  });
}

function setupProposalForm() {
  const form = document.getElementById("proposalForm");
  if (!form) return;

  form.addEventListener("submit", generateProposal);
}

function getProposalEditorText() {
  const editor = document.getElementById("proposalEditor");
  return String(editor?.innerText || "").trim();
}

function setProposalEditorText(text) {
  const editor = document.getElementById("proposalEditor");
  if (editor) editor.innerText = text || "";
}

function setProposalStatusText(text) {
  const status = document.getElementById("proposalEditorStatus");
  if (status) status.textContent = text;
}

function getCurrentProposalCompanyScope() {
  return (
    normalizeProposalCompanyKey(
      currentUser?.company_key ||
        currentUser?.selected_company ||
        currentUser?.company_scope ||
        currentUser?.comp_name,
    ) || "metrics"
  );
}

function withProposalCompanyScope(url) {
  const companyScope = getCurrentProposalCompanyScope();
  if (!companyScope) return url;

  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}company=${encodeURIComponent(companyScope)}&company_scope=${encodeURIComponent(companyScope)}`;
}

function getProposalPayload() {
  const companyScope = getCurrentProposalCompanyScope();

  return {
    client_name: document.getElementById("proposalClientName")?.value.trim() || "",
    client_email: document.getElementById("proposalClientEmail")?.value.trim() || "",
    company_name: document.getElementById("proposalCompanyName")?.value.trim() || "",
    project_topic: document.getElementById("proposalProjectTopic")?.value.trim() || "",
    requirement_details:
      document.getElementById("proposalRequirementDetails")?.value.trim() || "",
    budget: document.getElementById("proposalBudget")?.value.trim() || "",
    timeline: document.getElementById("proposalTimeline")?.value.trim() || "",
    technology:
      document.getElementById("proposalTechnology")?.value.trim() || "Core PHP + MySQL",
    notes: document.getElementById("proposalNotes")?.value.trim() || "",
    company_scope: companyScope,
    company_key: companyScope,
    comp_name: currentUser?.comp_name || currentUser?.selected_company || "",
    created_by: currentUser?.id || null,
  };
}

function setProposalFormValues(proposal = {}) {
  const fields = {
    proposalClientName: proposal.client_name || "",
    proposalClientEmail: proposal.client_email || "",
    proposalCompanyName: proposal.company_name || "",
    proposalProjectTopic: proposal.project_topic || "",
    proposalRequirementDetails: proposal.requirement_details || "",
    proposalBudget: proposal.budget || "",
    proposalTimeline: proposal.timeline || "",
    proposalTechnology: proposal.technology || "Core PHP + MySQL",
    proposalNotes: proposal.notes || "",
  };

  Object.entries(fields).forEach(([id, value]) => {
    const input = document.getElementById(id);
    if (input) input.value = value;
  });
}

function rememberProposalSummary(proposal = {}) {
  const id = Number(proposal.id || proposal.proposal_id || 0);
  if (!id) return;

  const summary = {
    id,
    client_name: proposal.client_name || "",
    client_email: proposal.client_email || "",
    company_name: proposal.company_name || "",
    project_topic: proposal.project_topic || "",
    company_scope: proposal.company_scope || "",
    status: proposal.status || "draft",
    created_by_company: proposal.created_by_company || "",
  };

  proposalSummaryCache.set(id, summary);
  if (Number(currentProposalId) === id) {
    currentProposalMeta = {
      ...currentProposalMeta,
      ...summary,
    };
  }
}

function getProposalActionMeta(proposalId = currentProposalId) {
  const id = Number(proposalId || 0);
  const cached = proposalSummaryCache.get(id) || {};

  if (id && Number(currentProposalId) === id) {
    return {
      ...cached,
      ...currentProposalMeta,
      ...getProposalPayload(),
      id,
    };
  }

  return {
    ...cached,
    id,
  };
}

function openProposalActionWindow(fallbackUrl = "") {
  const popup = window.open("", "_blank");
  if (popup) {
    popup.document.write("<p style='font-family:Arial,sans-serif;padding:18px;'>Preparing proposal...</p>");
    popup.document.close();
    return popup;
  }

  if (fallbackUrl) window.location.href = fallbackUrl;
  return null;
}

function getProposalFileBaseName(proposal = {}) {
  const rawName = [
    proposal.company_name,
    proposal.project_topic,
    proposal.id ? `proposal-${proposal.id}` : "proposal",
  ]
    .filter(Boolean)
    .join("-");

  return (
    rawName
      .replace(/[^a-z0-9]+/gi, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 90) || "proposal"
  ).toLowerCase();
}

function downloadProposalBlob(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function downloadProposalFromUrl(pdfUrl, fileName) {
  const link = document.createElement("a");
  link.href = pdfUrl;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
}

async function getProposalSnapshot(proposalId = currentProposalId, { saveCurrent = false } = {}) {
  const id = Number(proposalId || 0);
  if (!id) {
    throw new Error("Please generate or open a proposal first.");
  }

  if (Number(currentProposalId) === id) {
    if (saveCurrent) {
      await persistCurrentProposal("draft", { silent: true });
    }

    return {
      ...getProposalActionMeta(id),
      proposal_content: getProposalEditorText(),
    };
  }

  const res = await fetchProposalRequest(
    withProposalCompanyScope(`${BASE_URL}/api/proposals/${id}`),
    { cache: "no-store" },
    "Open proposal API",
  );
  const data = await parseProposalApiResponse(res, "Open proposal API");

  if (!res.ok || !data.success) {
    throw new Error(data.message || "Failed to open proposal");
  }

  rememberProposalSummary(data.data || {});
  return data.data || {};
}

function splitLongCanvasWord(ctx, word, maxWidth) {
  const pieces = [];
  let piece = "";

  String(word || "")
    .split("")
    .forEach((char) => {
      const testPiece = piece + char;
      if (piece && ctx.measureText(testPiece).width > maxWidth) {
        pieces.push(piece);
        piece = char;
        return;
      }

      piece = testPiece;
    });

  if (piece) pieces.push(piece);
  return pieces;
}

function wrapCanvasText(ctx, text, maxWidth) {
  const words = String(text || "").trim().split(/\s+/).filter(Boolean);
  if (!words.length) return [""];

  const lines = [];
  let line = "";

  words.forEach((word) => {
    const nextLine = line ? `${line} ${word}` : word;

    if (ctx.measureText(nextLine).width <= maxWidth) {
      line = nextLine;
      return;
    }

    if (line) {
      lines.push(line);
      line = "";
    }

    if (ctx.measureText(word).width > maxWidth) {
      const pieces = splitLongCanvasWord(ctx, word, maxWidth);
      lines.push(...pieces.slice(0, -1));
      line = pieces[pieces.length - 1] || "";
      return;
    }

    line = word;
  });

  if (line) lines.push(line);
  return lines;
}

function setProposalCanvasFont(ctx, style = {}) {
  const weight = style.weight || "400";
  const size = style.size || 26;
  ctx.font = `${weight} ${size}px Arial, sans-serif`;
}

function buildProposalCanvasLines(ctx, proposal = {}, contentWidth) {
  const letterhead = getProposalLetterheadUrls(proposal);
  const lines = [];
  const pushWrapped = (text, style = {}) => {
    setProposalCanvasFont(ctx, style);
    wrapCanvasText(ctx, text, contentWidth).forEach((line) => {
      lines.push({ text: line, ...style });
    });
  };

  pushWrapped(proposal.project_topic || "Project Proposal", {
    align: "center",
    color: "#0f172a",
    size: 40,
    weight: "700",
    gapAfter: 24,
  });
  pushWrapped(`Client: ${proposal.client_name || "-"}`, {
    color: "#475569",
    size: 22,
    weight: "700",
  });
  pushWrapped(`Company: ${proposal.company_name || "-"}`, {
    color: "#475569",
    size: 22,
    weight: "700",
    gapAfter: 26,
  });

  normalizeProposalEditorContent(proposal.proposal_content)
    .split("\n")
    .forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed) {
        lines.push({ spacer: true, height: 18 });
        return;
      }

      const isHeading = /^[A-Z0-9 &/.-]+:$/.test(trimmed) || /^PROJECT [A-Z0-9 &/.-]+$/.test(trimmed);
      pushWrapped(trimmed, {
        color: isHeading ? letterhead.headingColor : "#111827",
        size: isHeading ? 24 : 22,
        weight: isHeading ? "700" : "400",
        gapAfter: isHeading ? 10 : 6,
      });
    });

  return lines;
}

function normalizeProposalEditorContent(value) {
  return String(value || "").replace(/\r\n/g, "\n").trim();
}

function normalizeProposalCompanyKey(value = "") {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");

  if (
    normalized === "redsea" ||
    normalized === "redseadigitals" ||
    normalized === "redseadigitalspvtltd"
  ) {
    return "redsea";
  }

  return "";
}

function isRedSeaProposal(proposal = {}) {
  const brandText = [
    proposal.client_name,
    proposal.company_name,
    proposal.project_topic,
    proposal.requirement_details,
    proposal.notes,
    proposal.proposal_content,
    proposal.company_scope,
    proposal.created_by_company,
    proposal.created_by_comp_name,
    currentUser?.company_key,
    currentUser?.selected_company,
    currentUser?.company_scope,
    currentUser?.comp_name,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ");

  return (
    normalizeProposalCompanyKey(
      proposal.company_scope ||
        proposal.created_by_company ||
        currentUser?.company_key ||
        currentUser?.selected_company ||
        currentUser?.comp_name,
    ) === "redsea" ||
    /\bred\s*sea\b/.test(brandText) ||
    brandText.includes("redseadigitals")
  );
}

function getProposalLetterheadUrls(proposal = {}) {
  if (isRedSeaProposal(proposal)) {
    return {
      header: PROPOSAL_REDSEA_LETTERHEAD_HEADER_URL,
      footer: PROPOSAL_REDSEA_LETTERHEAD_FOOTER_URL,
      brandName: "RED SEA DIGITALS",
      accentColor: "#ef4444",
      headingColor: "#ff3045",
      footerText: "info@redseadigitals.com | +91 9310355211",
    };
  }

  return {
    header: PROPOSAL_LETTERHEAD_HEADER_URL,
    footer: PROPOSAL_LETTERHEAD_FOOTER_URL,
    brandName: "METRICS MART",
    accentColor: "#35b8ae",
    headingColor: "#0f766e",
    footerText: "info@metricsmart.in | www.metricsmartinfoline.com",
  };
}

function loadProposalLetterheadImage(src) {
  return new Promise((resolve) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = `${src}?t=${Date.now()}`;
  });
}

function getScaledProposalImageHeight(image, pageWidth, fallbackHeight) {
  if (!image?.naturalWidth || !image?.naturalHeight) return fallbackHeight;
  return Math.round(pageWidth * (image.naturalHeight / image.naturalWidth));
}

function drawProposalCanvasFallbackHeader(ctx, pageWidth, height, margin, letterhead = {}) {
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, pageWidth, height);
  ctx.fillStyle = letterhead.accentColor || "#35b8ae";
  ctx.fillRect(0, 0, pageWidth, 120);
  ctx.fillStyle = "#0f172a";
  ctx.font = "700 34px Arial, sans-serif";
  ctx.fillText(letterhead.brandName || "METRICS MART", margin, 72);
  ctx.font = "400 18px Arial, sans-serif";
  ctx.fillStyle = "#475569";
  ctx.fillText("Project Proposal", margin, 103);
}

function drawProposalCanvasFallbackFooter(ctx, pageWidth, pageHeight, height, margin, letterhead = {}) {
  const footerTop = pageHeight - height;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, footerTop, pageWidth, height);
  ctx.fillStyle = letterhead.accentColor || "#35b8ae";
  ctx.fillRect(0, footerTop + height - 76, pageWidth, 76);
  ctx.fillStyle = "#0f172a";
  ctx.font = "400 20px Arial, sans-serif";
  ctx.fillText(letterhead.footerText || "info@metricsmart.in | www.metricsmartinfoline.com", margin, footerTop + height - 38);
}

function getProposalCanvasLineHeight(line) {
  if (line.spacer) return line.height;
  return Math.round((line.size || 22) * 1.42) + (line.gapAfter || 0);
}

function paginateProposalCanvasLines(lines, contentTop, contentBottom) {
  const pages = [[]];
  let y = contentTop;

  lines.forEach((line) => {
    const lineHeight = getProposalCanvasLineHeight(line);
    const currentPage = pages[pages.length - 1];

    if (currentPage.length && y + lineHeight > contentBottom) {
      pages.push([]);
      y = contentTop;
    }

    if (!pages[pages.length - 1].length && line.spacer) {
      return;
    }

    pages[pages.length - 1].push(line);
    y += lineHeight;
  });

  return pages.filter((page) => page.length);
}

async function createProposalPngBlob(proposal = {}) {
  const pageWidth = 1240;
  const pageHeight = 1754;
  const margin = 86;
  const letterheadUrls = getProposalLetterheadUrls(proposal);
  const [headerImage, footerImage] = await Promise.all([
    loadProposalLetterheadImage(letterheadUrls.header),
    loadProposalLetterheadImage(letterheadUrls.footer),
  ]);
  const headerHeight = getScaledProposalImageHeight(headerImage, pageWidth, 325);
  const footerHeight = getScaledProposalImageHeight(footerImage, pageWidth, 329);
  const contentWidth = pageWidth - margin * 2;
  const contentTop = headerHeight + 46;
  const contentBottomGap = 58;
  const contentBottom = pageHeight - footerHeight - contentBottomGap;
  const measureCanvas = document.createElement("canvas");
  const measureCtx = measureCanvas.getContext("2d");
  const lines = buildProposalCanvasLines(measureCtx, proposal, contentWidth);
  const pages = paginateProposalCanvasLines(lines, contentTop, contentBottom);
  const pageCount = Math.max(1, pages.length);
  const canvas = document.createElement("canvas");
  canvas.width = pageWidth;
  canvas.height = pageHeight * pageCount;
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  pages.forEach((pageLines, pageIndex) => {
    const pageTop = pageIndex * pageHeight;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, pageTop, canvas.width, pageHeight);

    if (headerImage) {
      ctx.drawImage(headerImage, 0, pageTop, canvas.width, headerHeight);
    } else {
      ctx.save();
      ctx.translate(0, pageTop);
      drawProposalCanvasFallbackHeader(ctx, canvas.width, headerHeight, margin, letterheadUrls);
      ctx.restore();
    }

    let y = pageTop + contentTop;
    pageLines.forEach((line) => {
      if (line.spacer) {
        y += line.height;
        return;
      }

      setProposalCanvasFont(ctx, line);
      ctx.fillStyle = line.color || "#111827";
      ctx.textBaseline = "top";
      const x =
        line.align === "center"
          ? margin + (contentWidth - ctx.measureText(line.text).width) / 2
          : margin;
      ctx.fillText(line.text, x, y);
      y += getProposalCanvasLineHeight(line);
    });

    if (footerImage) {
      ctx.drawImage(footerImage, 0, pageTop + pageHeight - footerHeight, canvas.width, footerHeight);
    } else {
      ctx.save();
      ctx.translate(0, pageTop);
      drawProposalCanvasFallbackFooter(ctx, canvas.width, pageHeight, footerHeight, margin, letterheadUrls);
      ctx.restore();
    }
  });

  return await new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
        return;
      }

      reject(new Error("Failed to prepare proposal PNG."));
    }, "image/png");
  });
}

async function fetchProposalPdfBlob(proposalId) {
  const res = await fetchProposalRequest(
    withProposalCompanyScope(`${BASE_URL}/api/proposals/${proposalId}/pdf?t=${Date.now()}`),
    { cache: "no-store" },
    "Proposal PDF API",
  );

  if (!res.ok) {
    throw new Error(`Failed to prepare proposal PDF (${res.status}).`);
  }

  const contentType = String(res.headers.get("content-type") || "").toLowerCase();
  if (!contentType.includes("application/pdf")) {
    throw new Error("Proposal PDF API did not return a PDF file.");
  }

  return res.blob();
}

function getProposalPdfShareUrl(proposalId) {
  return withProposalCompanyScope(`${BASE_URL}/api/proposals/${proposalId}/pdf`);
}

function getProposalEmailDetails(proposal = {}) {
  const company = proposal.company_name || proposal.client_name || "client";
  const topic = proposal.project_topic || "Project Proposal";
  return {
    subject: `Project Proposal - ${company}`,
    body: `Hi,\n\nPlease find the attached ${topic} proposal PDF for ${company}.\n\nRegards,\nMetrics Mart`,
  };
}

function openProposalEmailDraftWindow(popup, email, proposal = {}) {
  const details = getProposalEmailDetails(proposal);
  const gmailUrl =
    `https://mail.google.com/mail/?view=cm&fs=1` +
    `&to=${encodeURIComponent(email)}` +
    `&su=${encodeURIComponent(details.subject)}` +
    `&body=${encodeURIComponent(details.body)}`;

  if (popup && !popup.closed) {
    popup.location.href = gmailUrl;
    return;
  }

  window.open(gmailUrl, "_blank");
}

async function persistCurrentProposal(status = "draft", { silent = false } = {}) {
  if (!currentProposalId) {
    throw new Error("Please generate or open a proposal first.");
  }

  const proposalContent = getProposalEditorText();
  if (!proposalContent) {
    throw new Error("Proposal content is required.");
  }

  const res = await fetchProposalRequest(
    withProposalCompanyScope(`${BASE_URL}/api/proposals/${currentProposalId}`),
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...getProposalPayload(),
        proposal_content: proposalContent,
        status,
      }),
    },
    "Save proposal API",
  );
  const data = await parseProposalApiResponse(res, "Save proposal API");

  if (!res.ok || !data.success) {
    throw new Error(data.message || "Failed to save proposal");
  }

  currentProposalMeta = {
    ...currentProposalMeta,
    ...getProposalPayload(),
    id: Number(currentProposalId),
    status,
  };
  rememberProposalSummary(currentProposalMeta);

  if (!silent) {
    setProposalStatusText(`Proposal #${currentProposalId} saved as ${status}.`);
    showPopup("Saved", "Proposal saved successfully.", true);
    loadMyProposals();
  }

  return data;
}

async function generateProposal(event) {
  event?.preventDefault();
  if (proposalSubmitting) return;

  const payload = getProposalPayload();
  if (!payload.client_name || !payload.company_name || !payload.project_topic) {
    showPopup(
      "Missing Details",
      "Client name, company name, and project topic are required.",
      false,
    );
    return;
  }

  const btn = document.getElementById("generateProposalBtn");
  proposalSubmitting = true;
  if (btn) btn.disabled = true;
  setProposalStatusText("Generating proposal...");

  try {
    const res = await fetchProposalRequest(
      `${BASE_URL}/api/generate-proposal`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
      "Generate proposal API",
    );
    const data = await parseProposalApiResponse(res, "Generate proposal API");

    if (!res.ok || !data.success) {
      throw new Error(data.message || "Failed to generate proposal");
    }

    currentProposalId = data.proposal_id;
    currentProposalMeta = {
      ...payload,
      id: Number(currentProposalId),
      status: "draft",
    };
    rememberProposalSummary(currentProposalMeta);
    setProposalEditorText(data.proposal_content || "");
    setProposalStatusText(
      `Draft proposal #${currentProposalId} generated. You can edit it now.`,
    );
    showPopup("Proposal Ready", "Proposal generated successfully.", true);
    loadMyProposals();
  } catch (err) {
    console.error("Generate Proposal Error:", err);
    setProposalStatusText("Proposal generation failed.");
    showPopup("Error", err.message || "Failed to generate proposal", false);
  } finally {
    proposalSubmitting = false;
    if (btn) btn.disabled = false;
  }
}

async function saveProposal(status = "draft") {
  try {
    await persistCurrentProposal(status);
  } catch (err) {
    console.error("Save Proposal Error:", err);
    showPopup("Error", err.message || "Failed to save proposal", false);
  }
}

async function loadMyProposals() {
  if (!currentUser?.id) return;

  const container = document.getElementById("proposalListContainer");
  if (!container) return;

  container.innerHTML = `<p class="no-data">Loading proposals...</p>`;

  try {
    const res = await fetchProposalRequest(
      withProposalCompanyScope(`${BASE_URL}/api/proposals?created_by=${encodeURIComponent(currentUser.id)}`),
      { cache: "no-store" },
      "Load proposals API",
    );
    const data = await parseProposalApiResponse(res, "Load proposals API");

    if (!res.ok || !data.success) {
      throw new Error(data.message || "Failed to load proposals");
    }

    const proposals = Array.isArray(data.data) ? data.data : [];
    proposalSummaryCache.clear();
    proposals.forEach(rememberProposalSummary);

    const count = document.getElementById("proposalListCount");
    if (count) count.textContent = `${proposals.length} proposals`;

    if (!proposals.length) {
      container.innerHTML = `<p class="no-data">No proposals created yet</p>`;
      return;
    }

    const rows = proposals
      .map(
        (item) => `
        <tr>
          <td>${escapeAttendanceHtml(item.company_name || "-")}</td>
          <td>${escapeAttendanceHtml(item.client_name || "-")}</td>
          <td>${escapeAttendanceHtml(item.project_topic || "-")}</td>
          <td><span class="status ${escapeAttendanceHtml(item.status || "draft")}">${escapeAttendanceHtml(item.status || "draft")}</span></td>
          <td>${escapeAttendanceHtml(formatAttendanceRequestDateTime(item.created_at))}</td>
          <td>
            <div class="proposal-table-actions">
              <button type="button" class="btn btn-save" onclick="openProposal(${item.id})" title="Open proposal"><i class="fas fa-pen"></i></button>
              <button type="button" class="btn btn-proposal-png" onclick="downloadProposal('png', ${item.id})" title="Download PNG"><i class="fas fa-file-image"></i></button>
              <button type="button" class="btn btn-proposal-pdf" onclick="downloadProposal('pdf', ${item.id})" title="Download PDF"><i class="fas fa-file-pdf"></i></button>
              <button type="button" class="btn btn-whatsapp" onclick="shareProposalWhatsApp(${item.id})" title="Share WhatsApp"><i class="fab fa-whatsapp"></i></button>
              <button type="button" class="btn btn-gmail" onclick="sendProposalEmail(${item.id})" title="Email PDF"><i class="fas fa-envelope"></i></button>
            </div>
          </td>
        </tr>
      `,
      )
      .join("");

    container.innerHTML = `
      <div class="table-wrapper">
        <table class="data-table">
          <thead>
            <tr>
              <th>Company</th>
              <th>Client</th>
              <th>Topic</th>
              <th>Status</th>
              <th>Created</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;
  } catch (err) {
    console.error("Load Proposals Error:", err);
    container.innerHTML = `<p class="error">Unable to load proposals</p>`;
  }
}

async function openProposal(proposalId) {
  try {
    const res = await fetchProposalRequest(
      withProposalCompanyScope(`${BASE_URL}/api/proposals/${proposalId}`),
      {
        cache: "no-store",
      },
      "Open proposal API",
    );
    const data = await parseProposalApiResponse(res, "Open proposal API");

    if (!res.ok || !data.success) {
      throw new Error(data.message || "Failed to open proposal");
    }

    const proposal = data.data || {};
    currentProposalId = proposal.id;
    currentProposalMeta = {
      ...proposal,
      id: Number(proposal.id || 0),
    };
    rememberProposalSummary(currentProposalMeta);
    setProposalFormValues(proposal);
    setProposalEditorText(proposal.proposal_content || "");
    setProposalStatusText(
      `Editing proposal #${proposal.id} for ${proposal.company_name || "client"}.`,
    );
  } catch (err) {
    console.error("Open Proposal Error:", err);
    showPopup("Error", err.message || "Failed to open proposal", false);
  }
}

async function downloadProposal(type, proposalId = currentProposalId) {
  if (!proposalId) {
    showPopup("No Proposal", "Please generate or open a proposal first.", false);
    return;
  }

  const normalizedType = String(type || "").toLowerCase();
  if (!["pdf", "word", "png"].includes(normalizedType)) {
    showPopup("Error", "Invalid proposal download type.", false);
    return;
  }

  if (normalizedType === "png") {
    try {
      setProposalStatusText("Preparing proposal PNG...");
      const proposal = await getProposalSnapshot(proposalId);
      const blob = await createProposalPngBlob(proposal);
      downloadProposalBlob(blob, `${getProposalFileBaseName(proposal)}.png`);
      setProposalStatusText(`Proposal #${proposalId} PNG is ready.`);
      showPopup("Downloaded", "Proposal PNG downloaded successfully.", true);
    } catch (err) {
      console.error("Download Proposal PNG Error:", err);
      showPopup("Download Error", err.message || "Failed to download proposal PNG", false);
    }
    return;
  }

  const downloadUrl = withProposalCompanyScope(`${BASE_URL}/api/proposals/${proposalId}/${normalizedType}?t=${Date.now()}`);
  const popup = openProposalActionWindow(downloadUrl);

  try {
    if (Number(proposalId) === Number(currentProposalId)) {
      await persistCurrentProposal("draft", { silent: true });
    }

    if (popup) {
      popup.location.href = downloadUrl;
    } else {
      window.location.href = downloadUrl;
    }
  } catch (err) {
    if (popup) popup.close();
    console.error("Download Proposal Error:", err);
    showPopup("Download Error", err.message || "Failed to download proposal", false);
  }
}

async function shareProposalWhatsApp(proposalId = currentProposalId) {
  if (!proposalId) {
    showPopup("No Proposal", "Please generate or open a proposal first.", false);
    return;
  }

  const popup = null;
  let pdfBlob = null;
  let fileName = "";

  try {
    if (Number(proposalId) === Number(currentProposalId)) {
      try {
        await persistCurrentProposal("draft", { silent: true });
      } catch (err) {
        console.warn("Proposal save before WhatsApp PDF share failed.", err);
        throw err;
      }
    }

    const proposal = await getProposalSnapshot(proposalId);
    const topic = proposal.project_topic || "Project Proposal";
    const company = proposal.company_name || "your company";
    const message = `Project Proposal - ${company}`;
    setProposalStatusText("Preparing proposal PDF for WhatsApp...");
    pdfBlob = await fetchProposalPdfBlob(proposalId);
    fileName = `${getProposalFileBaseName(proposal)}.pdf`;
    const file =
      typeof File === "function"
        ? new File([pdfBlob], fileName, {
            type: "application/pdf",
          })
        : null;

    if (
      file &&
      navigator.share &&
      (!navigator.canShare || navigator.canShare({ files: [file] }))
    ) {
      try {
        await navigator.share({
          title: topic,
          text: message,
          files: [file],
        });
        setProposalStatusText(`Proposal #${proposalId} PDF is ready for WhatsApp.`);
        showPopup("Shared", "Proposal PDF shared successfully.", true);
        return;
      } catch (shareErr) {
        if (shareErr?.name === "AbortError") {
          return;
        }
        console.warn("Native proposal PDF share failed, downloading PDF for manual WhatsApp attach.", shareErr);
      }
    }

    downloadProposalBlob(pdfBlob, fileName);
    setProposalStatusText(`Proposal #${proposalId} PDF downloaded for WhatsApp.`);
    showPopup("PDF Ready", "PDF download ho gaya. WhatsApp me file attach karke send karo.", true);
  } catch (err) {
    if (err?.name === "AbortError") return;
    if (pdfBlob && fileName) {
      downloadProposalBlob(pdfBlob, fileName);
    }
    console.error("Proposal WhatsApp Error:", err);
    showPopup("WhatsApp Error", err.message || "Failed to share proposal", false);
  }
}

async function sendProposalEmail(proposalId = currentProposalId) {
  if (!proposalId) {
    showPopup("No Proposal", "Please generate or open a proposal first.", false);
    return;
  }

  setProposalStatusText("Preparing proposal PDF email...");

  try {
    if (Number(proposalId) === Number(currentProposalId)) {
      await persistCurrentProposal("draft", { silent: true });
    }

    const proposal = await getProposalSnapshot(proposalId);
    const autoEmail = String(proposal.client_email || "").trim();
    const toEmail = autoEmail || prompt("Client email address");
    if (!toEmail) return;

    const cleanedEmail = toEmail.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanedEmail)) {
      showPopup("Invalid Email", "Please enter a valid client email address.", false);
      return;
    }

    downloadProposalFromUrl(
      `${getProposalPdfShareUrl(proposalId)}?t=${Date.now()}`,
      `${getProposalFileBaseName(proposal)}.pdf`,
    );
    window.setTimeout(() => {
      openProposalEmailDraftWindow(null, cleanedEmail, proposal);
    }, 800);
    setProposalStatusText(`Proposal #${proposalId} PDF downloaded for email.`);
    showPopup("Email Draft", "PDF download ho gaya aur Gmail open ho raha hai. PDF drag-drop karke send karo.", true);
  } catch (err) {
    console.error("Proposal Email Error:", err);
    showPopup("Email Error", err.message || "Failed to open proposal email draft", false);
  }
}

function resetProposalForm() {
  const form = document.getElementById("proposalForm");
  form?.reset();
  const technology = document.getElementById("proposalTechnology");
  if (technology) technology.value = "Core PHP + MySQL";
  currentProposalId = null;
  currentProposalMeta = {};
  setProposalEditorText("");
  setProposalStatusText("Generate a proposal to start editing.");
}

Object.assign(window, {
  downloadProposal,
  loadMyProposals,
  openProposal,
  resetProposalForm,
  saveProposal,
  sendProposalEmail,
  shareProposalWhatsApp,
});

function getAttendanceCheckoutDisplay(row) {
  if (row?.check_out) return row.check_out;
  if (row?.check_in && row?.logout_time) return row.logout_time;
  return "-";
}

// ================= ATTENDANCE =================
function escapeAttendanceHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatAttendanceRequestDateTime(value) {
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

function calculateAttendanceDistanceInMeters(lat1, lng1, lat2, lng2) {
  const earthRadiusMeters = 6371000;
  const toRadians = (value) => (Number(value) * Math.PI) / 180;
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  const startLat = toRadians(lat1);
  const endLat = toRadians(lat2);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(startLat) *
      Math.cos(endLat) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusMeters * c;
}

function getAttendanceRequestStatusMeta(status) {
  const normalizedStatus = String(status || "pending").toLowerCase();

  switch (normalizedStatus) {
    case "approved":
      return { label: "Approved by Admin", className: "approved" };
    case "rejected":
      return { label: "Rejected", className: "rejected" };
    case "cancelled":
      return { label: "Cancelled", className: "cancelled" };
    default:
      return { label: "Pending Approval", className: "pending" };
  }
}

function setupAttendanceLocationRequestModal() {
  const modal = document.getElementById("attendanceLocationRequestModal");
  const form = document.getElementById("attendanceLocationRequestForm");
  if (!modal || !form) return;

  modal.addEventListener("click", (event) => {
    if (event.target === modal) {
      closeAttendanceLocationRequestModal();
    }
  });

  form.addEventListener("submit", submitAttendanceLocationRequest);

  document.addEventListener("keydown", (event) => {
    if (
      event.key === "Escape" &&
      modal &&
      !modal.classList.contains("hidden")
    ) {
      closeAttendanceLocationRequestModal();
    }
  });
}

function openAttendanceLocationRequestModal() {
  const modal = document.getElementById("attendanceLocationRequestModal");
  const form = document.getElementById("attendanceLocationRequestForm");
  const submitBtn = document.getElementById("attendanceLocationRequestSubmitBtn");
  if (!modal || !form) return;

  form.reset();

  const activeRequest = attendanceLocationRequestState.activeRequest;
  if (activeRequest) {
    form.elements.locationLabel.value = activeRequest.requestedAddress || "";
    form.elements.meetingWith.value = activeRequest.meetingWith || "";
    form.elements.purpose.value = activeRequest.purpose || "";
    form.elements.notes.value = activeRequest.notes || "";
  }

  if (submitBtn) {
    submitBtn.textContent =
      activeRequest && activeRequest.status === "pending"
        ? "Update Request"
        : "Send Request";
  }

  modal.classList.remove("hidden");
}

function closeAttendanceLocationRequestModal() {
  const modal = document.getElementById("attendanceLocationRequestModal");
  if (!modal) return;
  modal.classList.add("hidden");
}

function getClientAttendanceZone() {
  const activeRequest = attendanceLocationRequestState.activeRequest;
  if (activeRequest?.status === "approved" && attendanceLocationRequestState.activeZone) {
    return attendanceLocationRequestState.activeZone;
  }

  return attendanceLocationRequestState.officeZone || ATTENDANCE_GEOFENCE;
}

function validateAttendanceLocationForClient(location) {
  const zone = getClientAttendanceZone();
  const distanceMeters = calculateAttendanceDistanceInMeters(
    Number(location?.lat),
    Number(location?.lng),
    Number(zone.latitude),
    Number(zone.longitude),
  );
  const gpsAccuracyBuffer = Math.min(
    Math.max(Number(location?.accuracy) || 0, 0),
    25,
  );
  const effectiveRadius = Number(zone.radiusMeters || 0) + gpsAccuracyBuffer;

  if (distanceMeters <= effectiveRadius) {
    return distanceMeters;
  }

  const activeRequest = attendanceLocationRequestState.activeRequest;
  if (activeRequest?.status === "approved") {
    throw new Error(
      `Attendance is allowed within ${zone.radiusMeters}m of the approved meeting location. Your current distance is about ${Math.round(distanceMeters)}m.`,
    );
  }

  const pendingNote =
    activeRequest?.status === "pending"
      ? " Your offsite request is still pending admin approval."
      : activeRequest?.status === "rejected"
        ? activeRequest.adminRemark
          ? ` Admin note: ${activeRequest.adminRemark}`
          : " Your latest offsite request was rejected."
        : " Send an offsite request to admin if you are at a meeting location.";

  throw new Error(
    `Attendance is allowed within ${ATTENDANCE_GEOFENCE.radiusMeters}m of the office. Your current distance is about ${Math.round(distanceMeters)}m.${pendingNote}`,
  );
}

function renderAttendanceSupportCards() {
  const officeZone = attendanceLocationRequestState.officeZone || ATTENDANCE_GEOFENCE;
  const activeRequest = attendanceLocationRequestState.activeRequest;
  const statusMeta = getAttendanceRequestStatusMeta(activeRequest?.status);
  const actionLabel =
    activeRequest && activeRequest.status === "pending"
      ? "Update Offsite Request"
      : activeRequest && activeRequest.status === "approved"
        ? "Change Approved Location"
        : "Request Offsite Approval";

  const requestCard = activeRequest
    ? `
      <div class="attendance-support-card ${statusMeta.className}">
        <div class="attendance-support-status ${statusMeta.className}">
          <i class="fas fa-location-dot"></i>
          <span>${statusMeta.label}</span>
        </div>
        <h4>Offsite Attendance</h4>
        <p>${escapeAttendanceHtml(activeRequest.purpose || "Meeting-based offsite request")}</p>
        <div class="attendance-support-meta">
          <span>${escapeAttendanceHtml(activeRequest.requestedAddress || "Requested location")}
            <small>${activeRequest.requestedLocationUrl ? `<a class="attendance-zone-link" href="${activeRequest.requestedLocationUrl}" target="_blank" rel="noopener noreferrer">Open map</a>` : "Map link unavailable"}</small>
          </span>
          <span>${escapeAttendanceHtml(activeRequest.meetingWith || "No meeting contact added")}
            <small>${activeRequest.reviewedAt ? `Reviewed ${escapeAttendanceHtml(formatAttendanceRequestDateTime(activeRequest.reviewedAt))}` : `Requested ${escapeAttendanceHtml(formatAttendanceRequestDateTime(activeRequest.createdAt))}`}</small>
          </span>
          <span>${activeRequest.status === "approved" ? `${activeRequest.approvedRadiusMeters}m approved radius` : `${activeRequest.requestedRadiusMeters}m requested radius`}
            <small>${escapeAttendanceHtml(activeRequest.adminRemark || (activeRequest.status === "approved" ? "Admin approval active for this location." : "Waiting for admin review."))}</small>
          </span>
        </div>
        <div class="attendance-support-actions">
          <button type="button" class="btn btn-save" onclick="openAttendanceLocationRequestModal()">${actionLabel}</button>
          <button type="button" class="btn attendance-calendar-btn" onclick="fetchAttendance()">Refresh Status</button>
        </div>
      </div>
    `
    : `
      <div class="attendance-support-card">
        <h4>Need Offsite Check-in?</h4>
        <p>Send your current GPS location to admin for a client meeting, field visit, or external discussion. Once approved, you can mark attendance from that location.</p>
        <div class="attendance-support-actions">
          <button type="button" class="btn btn-save" onclick="openAttendanceLocationRequestModal()">Request Offsite Approval</button>
        </div>
      </div>
    `;

  return `
    <div class="attendance-support-grid">
      <div class="attendance-support-card office">
        <h4>Office Geofence</h4>
        <p>Regular attendance is allowed within ${officeZone.radiusMeters}m of the office location.</p>
        <div class="attendance-support-meta">
          <span>${escapeAttendanceHtml(officeZone.address || ATTENDANCE_GEOFENCE.address)}
            <small><a class="attendance-zone-link" href="https://www.google.com/maps?q=${officeZone.latitude},${officeZone.longitude}" target="_blank" rel="noopener noreferrer">Open office map</a></small>
          </span>
        </div>
      </div>
      ${requestCard}
    </div>
  `;
}

async function fetchAttendance() {
  if (!currentUser || !currentUser.id) return;

  const container = document.getElementById("attendanceContainer");
  if (!container) return;

  try {
    const [attendanceRes, requestRes] = await Promise.all([
      fetch(`${BASE_URL}/api/attendance/${currentUser.id}`),
      fetch(`${BASE_URL}/api/attendance/location-request/${currentUser.id}`),
    ]);
    const result = await attendanceRes.json();
    const requestResult = await requestRes.json().catch(() => ({ success: false }));
    const rows = result.success ? result.data || [] : [];
    const requestData = requestResult.success ? requestResult.data || {} : {};

    attendanceLocationRequestState = {
      officeZone:
        requestData.officeZone || { ...ATTENDANCE_GEOFENCE, type: "office", label: "Office" },
      activeRequest: requestData.activeRequest || null,
      activeZone:
        requestData.activeZone || requestData.officeZone || { ...ATTENDANCE_GEOFENCE, type: "office", label: "Office" },
    };

    const today = formatDateKey(new Date());
    const todayRow = rows.find((row) => row.attendance_date === today);
    const canCheckIn = !todayRow;
    const canCheckOut = todayRow && !todayRow.check_out;

    let table = `
      ${renderAttendanceSupportCards()}
      <div class="attendance-actions">
        <button type="button" class="btn attendance-calendar-btn" onclick="toggleAttendanceCalendar()">
          Calendar
        </button>
        <button type="button" class="btn btn-save attendance-btn" onclick="markAttendance('check-in')" ${canCheckIn && !attendanceUpdating ? "" : "disabled"}>
          Check In
        </button>
        <button type="button" class="btn btn-deal attendance-btn" onclick="markAttendance('check-out')" ${canCheckOut && !attendanceUpdating ? "" : "disabled"}>
          Check Out
        </button>
      </div>
      <div id="attendanceCalendar" class="${attendanceCalendarVisible ? "" : "hidden"}">
        ${renderAttendanceCalendar(rows)}
      </div>
      <div class="table-wrapper">
        <table class="data-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Check In</th>
              <th>Check Out</th>
              <th>Check-in Location</th>
              <th>Working Hours</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
    `;

    if (rows.length === 0) {
      table += `<tr><td colspan="6">No attendance records found</td></tr>`;
    } else {
      rows.forEach((row) => {
        const checkInLocation = formatCheckInLocation(row);
        const attendanceStatus = formatAttendanceStatus(row);
        const displayedCheckOut = getAttendanceCheckoutDisplay(row);
        table += `
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

    table += `</tbody></table></div>${renderAttendanceSummary(rows)}`;
    container.innerHTML = table;
  } catch (err) {
    console.error("Attendance Error:", err);
    container.innerHTML = `<p class="error">Error loading attendance</p>`;
  }
}

async function submitAttendanceLocationRequest(event) {
  event.preventDefault();

  const userId = getCurrentUserId();
  if (!userId || attendanceLocationRequestSubmitting) return;

  const form = event.currentTarget;
  const submitBtn = document.getElementById("attendanceLocationRequestSubmitBtn");
  const formData = new FormData(form);
  const payload = {
    userId,
    user_id: userId,
    locationLabel: formData.get("locationLabel"),
    meetingWith: formData.get("meetingWith"),
    purpose: formData.get("purpose"),
    notes: formData.get("notes"),
  };

  try {
    attendanceLocationRequestSubmitting = true;
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = "Sending...";
    }

    const location = await getCurrentLocation();
    const res = await fetch(`${BASE_URL}/api/attendance/location-request`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...payload, ...location }),
    });
    const result = await res.json();

    if (!res.ok || !result.success) {
      throw new Error(result.message || "Failed to send offsite attendance request");
    }

    closeAttendanceLocationRequestModal();
    showPopup("Attendance", result.message || "Offsite attendance request sent to admin.", true);
    await fetchAttendance();
  } catch (err) {
    console.error("Attendance location request error:", err);
    showPopup("Attendance", err.message || "Failed to send offsite attendance request", false);
  } finally {
    attendanceLocationRequestSubmitting = false;
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = "Send Request";
    }
  }
}

async function markAttendance(type) {
  const userId = getCurrentUserId();
  if (!userId) {
    showPopup("Attendance", "User ID missing. Please login again.", false);
    return;
  }
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
    const facePayload = await window.AttendanceFace.captureForAttendance({
      actionLabel: type === "check-in" ? "Verify Check In" : "Verify Check Out",
    });
    const location = await getCurrentLocation();
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, user_id: userId, ...location, ...facePayload }),
    });
    const result = await res.json();

    if (!res.ok || !result.success) {
      throw new Error(result.error || result.message || "Attendance update failed");
    }

    showPopup("Attendance", result.message, true);
    attendanceUpdating = false;
    await fetchAttendance();
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

function formatDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
// ================= FOLLOWUPS =================
async function fetchFollowups() {
  if (!currentUser || !currentUser.id) return;

  try {
    const res = await fetch(`${BASE_URL}/api/followups/${currentUser.id}`);
    const data = await res.json();

    const container = document.getElementById("followupsContainer");

    if (!data.success || !data.data || data.data.length === 0) {
      container.innerHTML = `<p class="no-data">No Followups Found</p>`;
      return;
    }

    let table = `
            <table class="data-table">
                <thead>
                    <tr>
                        <th>Company</th>
                        <th>Client</th>
                        <th>Contact</th>
                        <th>Follow Date</th>
                        <th>Time</th>
                        <th>Reason</th>
                    </tr>
                </thead>
                <tbody>
        `;

    data.data.forEach((item) => {
      table += `
    <tr 
      data-id="${item.lead_id || item.id}"
      data-company="${item.company_name || ""}"
      data-client="${item.client_name || ""}"
    >
        <td>${item.company_name || "-"}</td>
        <td>${item.client_name || "-"}</td>
        <td>${item.contact || "-"}</td>
        <td>${formatDate(item.follow_date)}</td>
        <td>${item.follow_time || "-"}</td>
        <td>${item.reason || "-"}</td>
    </tr>
  `;
    });
    table += `</tbody></table>`;
    container.innerHTML = `<div class="table-wrapper">${table}</div>`;
  } catch (err) {
    console.error("Followups error:", err);
  }
}

function formatDate(dateStr) {
  if (!dateStr) return "-";

  const d = new Date(dateStr);
  return d.toLocaleDateString("en-IN"); // ✅ IST format
}

// ================= REPORTS =================
async function fetchReports() {
  if (!currentUser || !currentUser.id) return;

  try {
    const resDeals = await fetch(`${BASE_URL}/api/deals/${currentUser.id}`);
    const dataDeals = await resDeals.json();

    document.getElementById("totalDeals").textContent = dataDeals.success
      ? dataDeals.data.length
      : 0;
  } catch (err) {
    console.error("Reports Error:", err);
  }
}

let reportChart = null;

async function loadReportsCounts() {
  try {
    if (!currentUser?.id) return;

    // 🔥 USER-SPECIFIC DATA (IMPORTANT)
    const url = `${BASE_URL}/api/reports/counts?userId=${currentUser.id}&role=${currentUser.role}`;

    const res = await fetch(url, { cache: "no-store" });
    const result = await res.json();

    console.log("FILTERED REPORT:", result);

    const data = result?.data || {};

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
    const totalDeals = Number(data.totalDeals ?? data.deals ?? 0);

    const appEl = document.getElementById("totalAppointments");
    const followEl = document.getElementById("totalFollowups");
    const dealsEl = document.getElementById("totalDeals");

    if (appEl) appEl.textContent = totalAppointments;
    if (followEl) followEl.textContent = totalFollowed;
    if (dealsEl) dealsEl.textContent = totalDeals;

    // ✅ Chart
    const canvas = document.getElementById("reportChart");
    if (!canvas?.getContext) return;

    if (reportChart) reportChart.destroy();

    reportChart = new Chart(canvas.getContext("2d"), {
      type: "doughnut",
      data: {
        labels: ["Appointments", "Followed Up", "Deals"],
        datasets: [
          {
            data: [totalAppointments, totalFollowed, totalDeals],
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

// ====================== INIT ======================

function openActionModal(id, company, client) {
  const modal = document.getElementById("actionModal");

  currentLeadId = id;

  document.getElementById("modalLeadTitle").innerText = company;
  document.getElementById("modalLeadInfo").innerText = client;

  modal.classList.remove("hidden");
  modal.classList.add("show");

  resetActionForms();
}

document.addEventListener("click", function (e) {
  if (e.target.closest("#actionModal")) return;
  if (e.target.tagName === "A") return;

  const row = e.target.closest("tr");
  if (!row) return;

  const id = row.getAttribute("data-id");
  if (!id) return;

  openActionModal(
    id,
    row.getAttribute("data-company"),
    row.getAttribute("data-client"),
  );
});

function resetActionForms() {
  stopDownsaleApprovalPolling();
  document.querySelector("#actionModal .modal-content")?.classList.remove("deal-landscape");
  document.getElementById("actionButtons").style.display = "flex";
  document.getElementById("followupForm").classList.add("hidden");
  document.getElementById("dealClosedForm").classList.add("hidden");

  const followDate = document.getElementById("followDate");
  const followTime = document.getElementById("followTime");
  const followReason = document.getElementById("followReason");
  const dealAmount = document.getElementById("dealAmount");
  const paymentMethod = document.getElementById("paymentMethod");
  const paymentNotes = document.getElementById("paymentNotes");
  const dynamicPaymentFields = document.getElementById("dynamicPaymentFields");
  const productRows = document.getElementById("productRows");
  const totalBreakdown = document.getElementById("totalBreakdown");

  if (followDate) followDate.value = "";
  if (followTime) followTime.value = "";
  if (followReason) followReason.value = "";
  if (dealAmount) dealAmount.value = "";
  if (paymentMethod) paymentMethod.value = "";
  if (paymentNotes) paymentNotes.value = "";
  if (dynamicPaymentFields) dynamicPaymentFields.innerHTML = "";
  if (productRows) {
    productRows.innerHTML = "";
    productRows.dataset.rendered = "false";
    productRows.classList.remove("product-landscape-grid");
  }

  leadDownsaleRequests = [];
  approvedDownsaleRequest = null;
  appliedUpsaleAmount = 0;
  if (totalBreakdown) totalBreakdown.innerHTML = "";
}

function showPopup(title, message, isSuccess = true) {
  const popup = document.getElementById("popup");
  const icon = document.getElementById("popupIcon");
  const titleEl = document.getElementById("popupTitle");
  const msgEl = document.getElementById("popupMessage");

  if (!popup || !icon || !titleEl || !msgEl) {
    alert(message || title || "");
    return;
  }

  if (popupTimer) clearTimeout(popupTimer);

  titleEl.textContent = title || "";
  msgEl.textContent = message || "";
  icon.className = isSuccess ? "fas fa-check-circle" : "fas fa-exclamation-circle";
  icon.style.color = isSuccess ? "#22d3ee" : "#ef4444";

  popup.classList.remove("hidden");
  popupTimer = setTimeout(() => {
    popup.classList.add("hidden");
  }, 1800);
}

function addProductRow() {
  renderDealProductCheckboxes();
}

async function fetchDealProductCatalog() {
  if (dealProductsCatalog) return dealProductsCatalog;

  const res = await fetch(`${BASE_URL}/api/deal-products`);
  if (!res.ok) {
    throw new Error("Product API not found. Please restart the server.");
  }

  const data = await res.json();

  if (!data.success || !Array.isArray(data.data)) {
    throw new Error(data.message || "Unable to load product prices");
  }

  dealProductsCatalog = data.data;
  return dealProductsCatalog;
}

async function fetchLeadDownsaleRequests() {
  if (!currentLeadId) return [];

  try {
    const res = await fetch(`${BASE_URL}/api/downsale-requests?leadId=${currentLeadId}`);
    if (!res.ok) {
      downsaleApiAvailable = false;
      leadDownsaleRequests = [];
      approvedDownsaleRequest = null;
      return [];
    }

    downsaleApiAvailable = true;
    const data = await res.json();
    const requests = data.success && Array.isArray(data.data) ? data.data : [];

    leadDownsaleRequests = requests;
    approvedDownsaleRequest =
      requests.find((request) => request.status === "approved") || null;

    return requests;
  } catch (err) {
    leadDownsaleRequests = [];
    approvedDownsaleRequest = null;
    return [];
  }
}

function startDownsaleApprovalPolling() {
  stopDownsaleApprovalPolling();
  downsalePollingTimer = setInterval(async () => {
    const dealForm = document.getElementById("dealClosedForm");
    if (!dealForm || dealForm.classList.contains("hidden") || !currentLeadId) {
      stopDownsaleApprovalPolling();
      return;
    }

    const previousApprovedId = approvedDownsaleRequest?.id || null;
    await fetchLeadDownsaleRequests();
    const currentApprovedId = approvedDownsaleRequest?.id || null;

    if (currentApprovedId !== previousApprovedId || leadDownsaleRequests.length > 0) {
      calculateTotal();
    }
  }, 3000);
}

function stopDownsaleApprovalPolling() {
  if (downsalePollingTimer) {
    clearInterval(downsalePollingTimer);
    downsalePollingTimer = null;
  }
}

async function renderDealProductCheckboxes() {
  const productRows = document.getElementById("productRows");
  if (!productRows || productRows.dataset.rendered === "true") return;

  productRows.innerHTML = `<div style="color: #64748b; padding: 10px;">Loading products...</div>`;

  let productsCatalog = [];
  try {
    [productsCatalog] = await Promise.all([
      fetchDealProductCatalog(),
      fetchLeadDownsaleRequests(),
    ]);
  } catch (err) {
    console.error(err);
    productRows.innerHTML = `<div style="color: #ef4444; padding: 10px;">${err.message || "Unable to load products. Please try again."}</div>`;
    return;
  }

  const groups = productsCatalog.reduce((acc, product) => {
    if (!acc[product.group]) acc[product.group] = [];
    acc[product.group].push(product);
    return acc;
  }, {});

  productRows.innerHTML =
    Object.entries(groups)
      .map(
        ([group, products]) => `
      <div class="product-group">
        <div style="font-size: 13px; font-weight: 700; color: #334155; margin-bottom: 8px;">${group}</div>
        ${products
          .map(
            (product) => `
          <label class="product-row deal-product-option" data-product-name="${product.name}">
            <input type="checkbox" class="product-name deal-product-checkbox" value="${product.name}" onchange="handleProductToggle(this)" />
            <span class="deal-product-name">${product.name}</span>
          </label>
        `,
          )
          .join("")}
      </div>
    `,
      )
      .join("") +
    `
      <div class="overall-downsale-card">
        <div>
          <strong>Overall Downsale</strong>
          <small id="overallDownsaleStatus">Select products to request discount on total amount.</small>
        </div>
        <button type="button" class="downsale-btn" id="overallDownsaleToggle" onclick="openDownsaleRequest()" disabled>Downsale</button>
        <div id="overallDownsalePanel" class="downsale-panel hidden">
          <input type="number" id="overallDownsaleAmount" placeholder="Downsale amount" min="1" step="1" />
          <textarea id="overallDownsaleReason" placeholder="Reason for discount"></textarea>
          <button type="button" class="btn btn-save" onclick="submitDownsaleRequest(this)">Send Approval</button>
        </div>
      </div>
      <div class="overall-downsale-card upsale-card">
        <div>
          <strong>Overall Upsale</strong>
          <small id="overallUpsaleStatus">Add extra amount above standard total. No approval required.</small>
        </div>
        <button type="button" class="downsale-btn upsale-btn" id="overallUpsaleToggle" onclick="openUpsalePanel()" disabled>Upsale</button>
        <div id="overallUpsalePanel" class="downsale-panel hidden">
          <input type="number" id="overallUpsaleAmount" placeholder="Extra upsale amount" min="1" step="1" />
          <button type="button" class="btn btn-save" onclick="applyUpsaleAmount()">Apply Upsale</button>
          <button type="button" class="btn btn-cancel" onclick="clearUpsaleAmount()">Clear</button>
        </div>
      </div>
    `;

  productRows.classList.add("product-landscape-grid");
  productRows.dataset.rendered = "true";
  calculateTotal();
  startDownsaleApprovalPolling();
}

function handleProductToggle() {
  calculateTotal();
}

function removeProductRow(button) {
  button.parentElement.remove();
  calculateTotal();
}

function getSelectedDealProducts() {
  const rows = document.querySelectorAll(".product-row");
  const products = [];

  rows.forEach((row) => {
    const productInput = row.querySelector(".product-name");
    if (productInput?.type === "checkbox" && !productInput.checked) return;

    const name = productInput?.value || "";
    if (name) {
      products.push({ name });
    }
  });

  return products;
}

async function calculateTotal() {
  const products = getSelectedDealProducts();
  const totalBreakdown = document.getElementById("totalBreakdown");
  const dealAmount = document.getElementById("dealAmount");
  const upsaleToggle = document.getElementById("overallUpsaleToggle");

  if (products.length === 0) {
    totalBreakdown.innerHTML = "No products added yet";
    totalBreakdown.style.color = "#64748b";
    dealAmount.value = "";
    const toggle = document.getElementById("overallDownsaleToggle");
    const statusEl = document.getElementById("overallDownsaleStatus");
    if (toggle) toggle.disabled = true;
    if (upsaleToggle) upsaleToggle.disabled = true;
    appliedUpsaleAmount = 0;
    updateUpsaleStatus(0);
    if (statusEl) {
      statusEl.textContent = downsaleApiAvailable
        ? "Select products to request discount on total amount."
        : "Server restart required for downsale approval.";
      statusEl.style.color = downsaleApiAvailable ? "#64748b" : "#b91c1c";
    }
    return;
  }

  try {
    const priceMap = new Map(
      (dealProductsCatalog || []).map((product) => [product.name, Number(product.price || 0)]),
    );
    const standardTotal = products.reduce(
      (sum, product) => sum + (priceMap.get(product.name) || 0),
      0,
    );
    const approvedDownsaleAmount = approvedDownsaleRequest
      ? Number(approvedDownsaleRequest.requested_amount || 0)
      : 0;
    const approvedStandardTotal = approvedDownsaleRequest
      ? Number(approvedDownsaleRequest.standard_amount || 0)
      : 0;
    const hasApprovedDownsale =
      approvedDownsaleAmount > 0 &&
      approvedDownsaleAmount < standardTotal &&
      Math.abs(approvedStandardTotal - standardTotal) <= 0.01;
    const baseTotal = hasApprovedDownsale
      ? standardTotal - approvedDownsaleAmount
      : standardTotal;
    const upsaleAmount = Number(appliedUpsaleAmount || 0);
    const total = baseTotal + upsaleAmount;

    if (!standardTotal) {
      throw new Error("Unable to calculate product total");
    }

    totalBreakdown.innerHTML = hasApprovedDownsale
      ? `Total after downsale: &#8377;${baseTotal.toFixed(2)}`
      : `Standard backend total: &#8377;${baseTotal.toFixed(2)}`;
    totalBreakdown.style.color = "green";
    dealAmount.value = total.toFixed(2);

    updateDownsaleStatus(standardTotal, baseTotal);
    updateUpsaleStatus(upsaleAmount);
  } catch (err) {
    console.error("Quote error:", err);
    totalBreakdown.innerHTML = err.message || "Unable to calculate total";
    totalBreakdown.style.color = "#ef4444";
    dealAmount.value = "";
  }
}

function openUpsalePanel() {
  const panel = document.getElementById("overallUpsalePanel");
  if (panel) panel.classList.toggle("hidden");
}

function applyUpsaleAmount() {
  const input = document.getElementById("overallUpsaleAmount");
  const amount = Number(input?.value || 0);

  if (getSelectedDealProducts().length === 0) {
    alert("Select at least one product first");
    return;
  }

  if (!Number.isFinite(amount) || amount <= 0) {
    alert("Enter valid upsale amount");
    return;
  }

  appliedUpsaleAmount = amount;
  calculateTotal();
}

function clearUpsaleAmount() {
  appliedUpsaleAmount = 0;
  const input = document.getElementById("overallUpsaleAmount");
  if (input) input.value = "";
  calculateTotal();
}

function updateUpsaleStatus(upsaleAmount) {
  const statusEl = document.getElementById("overallUpsaleStatus");
  const toggle = document.getElementById("overallUpsaleToggle");

  if (toggle) toggle.disabled = getSelectedDealProducts().length === 0;
  if (!statusEl) return;

  if (upsaleAmount > 0) {
    statusEl.textContent = "Upsale applied";
    statusEl.style.color = "#15803d";
  } else {
    statusEl.textContent = "Add extra amount above standard total. No approval required.";
    statusEl.style.color = "#64748b";
  }
}

function updateDownsaleStatus(standardTotal, finalTotal) {
  const statusEl = document.getElementById("overallDownsaleStatus");
  const toggle = document.getElementById("overallDownsaleToggle");
  const latestRequest = leadDownsaleRequests[0] || null;

  if (toggle) toggle.disabled = getSelectedDealProducts().length === 0 || !downsaleApiAvailable;
  if (!statusEl) return;

  if (!downsaleApiAvailable) {
    statusEl.textContent = "Server restart required for downsale approval.";
    statusEl.style.color = "#b91c1c";
  } else if (approvedDownsaleRequest && finalTotal < standardTotal) {
    const discountAmount = Number(approvedDownsaleRequest.requested_amount || 0);
    statusEl.textContent = `Approved downsale: Rs. ${discountAmount.toLocaleString("en-IN")}`;
    statusEl.style.color = "#15803d";
  } else if (latestRequest?.status === "pending") {
    statusEl.textContent = `Downsale pending: Rs. ${Number(latestRequest.requested_amount).toLocaleString("en-IN")}`;
    statusEl.style.color = "#92400e";
  } else if (latestRequest?.status === "rejected") {
    statusEl.textContent = "Last overall downsale request rejected";
    statusEl.style.color = "#b91c1c";
  } else {
    statusEl.textContent = `Standard backend total: Rs. ${Number(standardTotal).toLocaleString("en-IN")}`;
    statusEl.style.color = "#64748b";
  }
}

function openDownsaleRequest() {
  const panel = document.getElementById("overallDownsalePanel");
  if (panel) panel.classList.toggle("hidden");
}

async function submitDownsaleRequest(button) {
  const products = getSelectedDealProducts();
  const requestedAmount = Number(document.getElementById("overallDownsaleAmount")?.value);
  const reason = document.getElementById("overallDownsaleReason")?.value || "";

  if (products.length === 0) {
    alert("Select at least one product first");
    return;
  }

  if (!downsaleApiAvailable) {
    alert("Server restart karo, downsale API abhi load nahi hui hai.");
    return;
  }

  if (!Number.isFinite(requestedAmount) || requestedAmount <= 0) {
    alert("Enter valid downsale amount");
    return;
  }

  try {
    button.disabled = true;
    const res = await fetch(`${BASE_URL}/api/downsale-requests`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        leadId: currentLeadId,
        requestedBy: currentUser?.id,
        products,
        requestedAmount,
        reason,
      }),
    });
    const contentType = res.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
      throw new Error("Server restart karo, downsale API abhi load nahi hui hai.");
    }
    const data = await res.json();

    if (!res.ok || !data.success) {
      throw new Error(data.message || "Failed to send downsale request");
    }

    showPopup("Sent", data.message || "Downsale request sent to admin");
    await fetchLeadDownsaleRequests();
    calculateTotal();
  } catch (err) {
    console.error("Downsale request error:", err);
    alert(err.message || "Failed to send downsale request");
  } finally {
    button.disabled = false;
  }
}

async function submitLeadAction(formData) {
  if (!currentLeadId) {
    throw new Error("Lead ID missing");
  }

  const res = await fetch(`${BASE_URL}/api/leads/${currentLeadId}/action`, {
    method: "PUT",
    body: formData,
  });

  const data = await res.json();

  if (!res.ok || !data.success) {
    throw new Error(data.error || data.message || "Action update failed");
  }

  return data;
}

function refreshMEAfterAction() {
  loadMeDashboard();
  fetchMEData();
  fetchDeals();
  fetchFollowups();
  fetchTaxInvoices();
}

function takeAction(type) {
  document.getElementById("actionButtons").style.display = "none";
  document.querySelector("#actionModal .modal-content")?.classList.remove("deal-landscape");
  document.getElementById("followupForm").classList.add("hidden");
  document.getElementById("dealClosedForm").classList.add("hidden");

  if (type === "followup") {
    document.getElementById("followupForm").classList.remove("hidden");
  } else if (type === "deal_closed") {
    document.querySelector("#actionModal .modal-content")?.classList.add("deal-landscape");
    document.getElementById("dealClosedForm").classList.remove("hidden");
    renderDealProductCheckboxes();
  } else if (type === "not_interested") {
    updateLeadStatus("not_interested");
  }
}

async function updateLeadStatus(status) {
  try {
    const formData = new FormData();
    formData.append("action", status);

    await submitLeadAction(formData);

    showPopup("Updated", "Status updated successfully");
    closeActionModal();
    refreshMEAfterAction();
  } catch (err) {
    console.error(err);
    alert(err.message || "Error updating status");
  }
}

async function saveFollowUp() {
  const date = document.getElementById("followDate").value;
  const time = document.getElementById("followTime").value;
  const reason = document.getElementById("followReason").value;

  if (!date || !time || !reason) {
    alert("Please fill all fields");
    return;
  }

  try {
    const formData = new FormData();
    formData.append("action", "followup");
    formData.append("follow_date", date);
    formData.append("follow_time", time);
    formData.append("reason", reason);
    formData.append("userId", currentUser.id);

    await submitLeadAction(formData);

    showPopup("Saved", "Follow-up saved successfully");
    closeActionModal();
    refreshMEAfterAction();
  } catch (err) {
    console.error(err);
    alert(err.message || "Error saving follow-up");
  }
}

function logout() {
  showPopup("Logout", "You have been logged out successfully.", true);

  Promise.resolve(window.AttendanceAutoCheckout?.finalizeOnLogout?.())
    .catch(() => null)
    .finally(() => {
      setTimeout(() => {
        localStorage.removeItem("currentUser");
        window.location.href = "mp.html";
      }, 800);
    });
}

function showPaymentFields() {
  const method = document.getElementById("paymentMethod").value;
  const container = document.getElementById("dynamicPaymentFields");

  container.innerHTML = "";

  if (method === "Cheque") {
    container.innerHTML = `
      <input type="text" placeholder="Cheque Number" id="chequeNo" />
      <input type="date" id="chequeDate" />
      <input type="text" placeholder="Bank Name" id="bankName" />
      <input type="text" placeholder="Branch Name" id="branchName" />
    `;
  } else if (method === "UPI / Net Banking") {
    container.innerHTML = `
      <input type="text" placeholder="Transaction ID" id="txnId" />
      <input type="text" placeholder="Bank Name" id="bankName" />
    `;
  } else if (method === "Debit/Credit Card") {
    container.innerHTML = `
      <div class="payment-hint">
        Razorpay checkout will open when you save this deal.
      </div>
    `;
  }
}

function shouldUseRazorpay(method) {
  return method === "Debit/Credit Card";
}

async function startRazorpayPayment(amount, products) {
  if (!window.Razorpay) {
    throw new Error("Razorpay checkout script not loaded");
  }

  const numericAmount = Number(String(amount).replace(/,/g, ""));
  if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
    throw new Error("Invalid Razorpay amount");
  }

  const orderRes = await fetch(`${BASE_URL}/api/razorpay/order`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ amount: numericAmount }),
  });

  const orderData = await orderRes.json();

  if (!orderRes.ok || !orderData.success || !orderData.order) {
    throw new Error(orderData.message || orderData.error || "Unable to create Razorpay order");
  }

  const key = orderData.key_id || orderData.key || orderData.order.key_id;
  if (!key) {
    throw new Error("Razorpay key id missing from backend response");
  }

  return new Promise((resolve, reject) => {
    const options = {
      key,
      amount: orderData.order.amount,
      currency: orderData.order.currency || "INR",
      name: "Metricsmart Infoline Private Limited",
      description: products.map((p) => p.name).join(", ") || "Deal payment",
      order_id: orderData.order.id,
      prefill: {
        name: currentUser?.name || "",
        email: currentUser?.email || "",
        contact: currentUser?.contact || "",
      },
      notes: {
        lead_id: currentLeadId,
        closed_by: currentUser?.id || "",
      },
      theme: {
        color: "#22d3ee",
      },
      handler: async function (response) {
        try {
          const verifyRes = await fetch(`${BASE_URL}/api/razorpay/verify`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(response),
          });

          const verifyData = await verifyRes.json();
          if (!verifyRes.ok || !verifyData.success) {
            reject(new Error(verifyData.message || "Payment verification failed"));
            return;
          }

          resolve(response);
        } catch (err) {
          reject(err);
        }
      },
      modal: {
        ondismiss: function () {
          const err = new Error("Payment cancelled");
          err.code = "PAYMENT_CANCELLED";
          reject(err);
        },
      },
    };

    const rzp = new Razorpay(options);
    rzp.on("payment.failed", function (response) {
      reject(new Error(response.error?.description || "Payment failed"));
    });
    rzp.open();
  });
}

async function saveDealClosed() {
  const saveButton = document.querySelector('#dealClosedForm button[onclick="saveDealClosed()"]');
  const amount = document.getElementById("dealAmount").value;
  const method = document.getElementById("paymentMethod").value;
  const notes = document.getElementById("paymentNotes").value;
  const chequeNo = document.getElementById("chequeNo")?.value || "";
  const chequeDate = document.getElementById("chequeDate")?.value || "";
  const txnId = document.getElementById("txnId")?.value || "";
  const bankName = document.getElementById("bankName")?.value || "";
  const branchName = document.getElementById("branchName")?.value || "";
  const products = getSelectedDealProducts();

  if (products.length === 0) {
    alert("Please add at least one product with amount");
    return;
  }

  if (!amount || parseFloat(amount) <= 0) {
    alert("Total amount must be greater than 0");
    return;
  }

  if (!method) {
    alert("Please select payment method");
    return;
  }

  if (method === "Cheque" && (!chequeNo || !chequeDate || !bankName)) {
    alert("Please fill cheque number, cheque date and bank name");
    return;
  }

  if (method === "UPI / Net Banking" && (!txnId || !bankName)) {
    alert("Please fill transaction ID and bank name");
    return;
  }

  try {
    if (saveButton) {
      saveButton.disabled = true;
      saveButton.dataset.originalText = saveButton.dataset.originalText || saveButton.innerHTML;
      saveButton.innerHTML = "Saving...";
    }

    let razorpayPayment = null;

    if (shouldUseRazorpay(method)) {
      if (saveButton) saveButton.innerHTML = "Opening payment...";
      razorpayPayment = await startRazorpayPayment(amount, products);
      if (saveButton) saveButton.innerHTML = "Saving...";
    }

    const formData = new FormData();
    formData.append("action", "deal_closed");
    formData.append("deal_amount", amount);
    formData.append("payment_method", method);
    formData.append("payment_notes", notes || "");
    formData.append("closed_by", currentUser.id);
    formData.append("received_by", currentUser.name || "");
    formData.append("payment_date", formatDateKey(new Date()));
    formData.append("products", JSON.stringify(products));
    if (approvedDownsaleRequest?.id) {
      formData.append("downsale_approval_id", approvedDownsaleRequest.id);
    }

    if (chequeNo) formData.append("cheque_number", chequeNo);
    if (chequeDate) formData.append("cheque_date", chequeDate);
    if (txnId) formData.append("transaction_id", txnId);
    if (bankName) formData.append("bank_name", bankName);
    if (branchName) formData.append("branch_name", branchName);
    if (razorpayPayment?.razorpay_payment_id) {
      formData.set("transaction_id", razorpayPayment.razorpay_payment_id);
      formData.set(
        "payment_notes",
        `${notes || ""}\nRazorpay Order: ${razorpayPayment.razorpay_order_id}`.trim(),
      );
    }

    await submitLeadAction(formData);

    showPopup("Success", "Deal closed successfully");
    closeActionModal();
    refreshMEAfterAction();
  } catch (err) {
    if (err.code === "PAYMENT_CANCELLED") {
      showPopup("Cancelled", "Payment was cancelled", false);
      return;
    }

    console.error(err);
    showPopup("Error", err.message || "Error closing deal", false);
  } finally {
    if (saveButton) {
      saveButton.disabled = false;
      saveButton.innerHTML = saveButton.dataset.originalText || "Save Deal";
    }
  }
}

window.takeAction = takeAction;

function safeParse(val) {
  try {
    let parsed = val;
    if (typeof parsed === "string") parsed = JSON.parse(parsed);
    if (typeof parsed === "string") parsed = JSON.parse(parsed);
    return parsed;
  } catch {
    return val;
  }
}
