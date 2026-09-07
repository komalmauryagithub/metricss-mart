
  // ====== DEAL CLOSE CUSTOM UI BLOCK (me.js) ======

  // Service descriptions shown in the bottom summary
  const DC_SERVICE_DESCRIPTIONS = {
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

  function getDealCloseCustomUI(productName) {
    if (productName === 'GMB SEO') {
      return `
        <div class="dc-custom-ui-inner">
          <p class="dc-service-desc">${DC_SERVICE_DESCRIPTIONS['GMB SEO']}</p>
          <div class="dc-field-row">
            <label class="dc-field-label">Keyword Count <small>(min 10, &#8377;1,500/keyword)</small>:</label>
            <div class="dc-counter-wrap">
              <button type="button" class="dc-counter-btn" onclick="
                var inp = document.getElementById('dc_gmb_keyword_count');
                inp.value = Math.max(10, parseInt(inp.value||10) - 1);
                calculateTotal();
              ">&#8722;</button>
              <input type="number" id="dc_gmb_keyword_count" value="10" min="10"
                class="dc-counter-input"
                oninput="if ((parseInt(this.value,10)||0) >= 10) calculateTotal();"
                onchange="this.value=Math.max(10,parseInt(this.value)||10); calculateTotal();">
              <button type="button" class="dc-counter-btn" onclick="
                var inp = document.getElementById('dc_gmb_keyword_count');
                inp.value = parseInt(inp.value||10) + 1;
                calculateTotal();
              ">&#43;</button>
            </div>
          </div>
        </div>`;
    }
    if (productName === 'Website SEO') {
      return `
        <div class="dc-custom-ui-inner">
          <p class="dc-service-desc">${DC_SERVICE_DESCRIPTIONS['Website SEO']}</p>
          <div class="dc-field-row">
            <label class="dc-field-label">Coverage Level:</label>
            <select id="dc_web_seo_level" class="dc-select" onchange="calculateTotal()">
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
          <p class="dc-service-desc">${DC_SERVICE_DESCRIPTIONS['ERP/CRM/Software']}</p>
          <div class="dc-field-row">
            <label class="dc-field-label">Project Amount (&#8377;):</label>
            <input type="number" id="dc_erp_amount" value="0" min="0" placeholder="Enter project amount"
              class="dc-amount-input" oninput="calculateTotal()">
          </div>
        </div>`;
    }
    if (productName === 'E-commerce Website') {
      return `
        <div class="dc-custom-ui-inner">
          <p class="dc-service-desc">${DC_SERVICE_DESCRIPTIONS['E-commerce Website']}</p>
          <div class="dc-field-row">
            <label class="dc-field-label">Platform / Type:</label>
            <input type="text" id="dc_ecom_type" placeholder="e.g. Shopify, WooCommerce, Custom" class="dc-text-input" oninput="updateDealCloseSelectedDescriptions()">
          </div>
          <div class="dc-field-row" style="margin-top:8px;">
            <label class="dc-field-label">Project Amount (&#8377;):</label>
            <input type="number" id="dc_ecom_amount" value="0" min="0" placeholder="Enter project amount"
              class="dc-amount-input" oninput="calculateTotal()">
          </div>
        </div>`;
    }
    if (productName === 'Landing Page') {
      return `
        <div class="dc-custom-ui-inner">
          <p class="dc-service-desc">${DC_SERVICE_DESCRIPTIONS['Landing Page']}</p>
          <div class="dc-info-badge">&#128161; Amount is fetched automatically from the product catalogue set in Admin panel.</div>
        </div>`;
    }
    if (productName === 'Static Website') {
      return `
        <div class="dc-custom-ui-inner">
          <p class="dc-service-desc">${DC_SERVICE_DESCRIPTIONS['Static Website']}</p>
          <div class="dc-info-badge">&#128161; Amount is fetched automatically from the product catalogue set in Admin panel.</div>
        </div>`;
    }
    if (productName === 'Dynamic Website') {
      return `
        <div class="dc-custom-ui-inner">
          <p class="dc-service-desc">${DC_SERVICE_DESCRIPTIONS['Dynamic Website']}</p>
          <div class="dc-field-row">
            <label class="dc-field-label">Website Type:</label>
            <div class="dc-radio-group">
              <label class="dc-radio-label">
                <input type="radio" name="dc_dynamic_web_type" value="templated" checked
                  onchange="calculateTotal()"> Templated
              </label>
              <label class="dc-radio-label">
                <input type="radio" name="dc_dynamic_web_type" value="custom"
                  onchange="calculateTotal()"> Custom
              </label>
            </div>
          </div>
          <div class="dc-info-badge">&#128161; Amount is fetched automatically from the product catalogue set in Admin panel.</div>
        </div>`;
    }
    if (productName === 'SMO Service' || productName === 'Meta Ads + Management' || productName === 'Meta Ads Management' || productName === 'SMO Services') {
      return `
        <div class="dc-custom-ui-inner">
          <p class="dc-service-desc">${DC_SERVICE_DESCRIPTIONS['SMO Service']}</p>
          <div class="dc-smo-section">
            <div class="dc-smo-group">
              <strong class="dc-smo-title">&#127807; Organic Platforms</strong>
              <small class="dc-smo-note">1 platform = &#8377;10,000 | 2 platforms = &#8377;15,000 | 3 platforms = &#8377;20,000</small>
              <div class="dc-check-group">
                <label class="dc-check-label"><input type="checkbox" name="dc_smo_platforms" value="facebook" onchange="calculateTotal()"> Facebook</label>
                <label class="dc-check-label"><input type="checkbox" name="dc_smo_platforms" value="instagram" onchange="calculateTotal()"> Instagram</label>
                <label class="dc-check-label"><input type="checkbox" name="dc_smo_platforms" value="linkedin" onchange="calculateTotal()"> LinkedIn</label>
              </div>
            </div>
            <div class="dc-smo-group" style="margin-top:10px;">
              <strong class="dc-smo-title">&#128226; Sponsored / Paid Ads <small>(added on top of organic price)</small></strong>
              <small class="dc-smo-note">FB/IG Ads = +&#8377;8,000 | LinkedIn Ads = +&#8377;10,000</small>
              <div class="dc-check-group">
                <label class="dc-check-label"><input type="checkbox" name="dc_smo_sponsored" value="fb_ig" onchange="handleSmoSponsoredChange(this); calculateTotal()"> FB / IG Ads (+&#8377;8,000)</label>
                <label class="dc-check-label"><input type="checkbox" name="dc_smo_sponsored" value="linkedin" onchange="handleSmoSponsoredChange(this); calculateTotal()"> LinkedIn Ads (+&#8377;10,000)</label>
              </div>
            </div>
          </div>
        </div>`;
    }
    // For standard products — show description only
    if (DC_SERVICE_DESCRIPTIONS[productName]) {
      return `<div class="dc-custom-ui-inner"><p class="dc-service-desc">${DC_SERVICE_DESCRIPTIONS[productName]}</p></div>`;
    }
    return '';
  }

  function handleSmoSponsoredChange(checkbox) {
    if (checkbox.checked) {
      if (checkbox.value === 'fb_ig') {
        const fb = document.querySelector('input[name="dc_smo_platforms"][value="facebook"]');
        const ig = document.querySelector('input[name="dc_smo_platforms"][value="instagram"]');
        if (fb && !fb.checked) fb.checked = true;
        if (ig && !ig.checked) ig.checked = true;
      } else if (checkbox.value === 'linkedin') {
        const ln = document.querySelector('input[name="dc_smo_platforms"][value="linkedin"]');
        if (ln && !ln.checked) ln.checked = true;
      }
    } else {
      if (checkbox.value === 'fb_ig') {
        const fb = document.querySelector('input[name="dc_smo_platforms"][value="facebook"]');
        const ig = document.querySelector('input[name="dc_smo_platforms"][value="instagram"]');
        if (fb) fb.checked = false;
        if (ig) ig.checked = false;
      } else if (checkbox.value === 'linkedin') {
        const ln = document.querySelector('input[name="dc_smo_platforms"][value="linkedin"]');
        if (ln) ln.checked = false;
      }
    }
  }

  function updateDealCloseCustomUI(checkbox) {
    const safeId = checkbox.value.replace(/[^a-zA-Z0-9]/g, '_');
    const container = document.getElementById('customUI_' + safeId);
    if (container) {
      container.style.display = checkbox.checked ? 'block' : 'none';
    }
    updateDealCloseSelectedDescriptions();
  }

  function getDealCloseGmbKeywordCount() {
    const gmbKw = document.getElementById('dc_gmb_keyword_count');
    const keywordCount = Math.max(10, Math.floor(Number(gmbKw?.value || 10)) || 10);
    if (gmbKw) gmbKw.value = String(keywordCount);
    return keywordCount;
  }

  function getDealCloseCustomParams() {
    const params = {};

    const gmbKw = document.getElementById('dc_gmb_keyword_count');
    if (gmbKw) params.gmb_keyword_count = getDealCloseGmbKeywordCount();

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

    const smoPlat = Array.from(document.querySelectorAll('input[name="dc_smo_platforms"]:checked')).map(el => el.value);
    if (smoPlat.length) params.smo_platforms = smoPlat;

    const smoSpon = Array.from(document.querySelectorAll('input[name="dc_smo_sponsored"]:checked')).map(el => el.value);
    if (smoSpon.length) params.smo_sponsored = smoSpon;

    return params;
  }

  function updateDealCloseSelectedDescriptions() {
    const descContainer = document.getElementById('meSelectedDescriptions');
    if (!descContainer) return;
    const products = getSelectedDealProducts();
    const params = getDealCloseCustomParams();
    if (!products.length) { descContainer.innerHTML = ''; return; }

    let html = '<div class="dc-desc-box"><strong class="dc-desc-title">&#128203; Selected Services Summary</strong><ul class="dc-desc-list">';
    products.forEach(p => {
      const baseDesc = DC_SERVICE_DESCRIPTIONS[p.name] || '';
      let extra = '';
      if (p.name === 'GMB SEO') {
        const kw = parseInt(params.gmb_keyword_count) || 10;
        const gmbAmount = Math.max(10, kw) * 1500;
        extra = `<br><span class="dc-desc-detail">&#8594; ${Math.max(10, kw)} keywords &#215; &#8377;1,500 = &#8377;${gmbAmount.toLocaleString('en-IN')}</span>`;
      }
      if (p.name === 'Website SEO') {
        const lvlMap = { local: 'Local/City &#8211; &#8377;1,500/month', state: 'State &#8211; &#8377;3,500/month', india: 'India (National) &#8211; &#8377;7,000/month' };
        extra = `<br><span class="dc-desc-detail">&#8594; Coverage Level: ${lvlMap[params.web_seo_level] || 'Local/City &#8211; &#8377;1,500/month'}</span>`;
      }
      if (p.name === 'ERP/CRM/Software') {
        extra = `<br><span class="dc-desc-detail">&#8594; Project Amount: &#8377;${Number(params.erp_amount||0).toLocaleString('en-IN')}</span>`;
      }
      if (p.name === 'E-commerce Website') {
        const type = params.ecom_type || '(type not set)';
        extra = `<br><span class="dc-desc-detail">&#8594; Platform / Type: ${type}</span><br><span class="dc-desc-detail">&#8594; Project Amount: &#8377;${Number(params.ecom_amount||0).toLocaleString('en-IN')}</span>`;
      }
      if (p.name === 'Dynamic Website') {
        const dynType = params.dynamic_web_type === 'custom' ? 'Custom' : 'Templated';
        extra = `<br><span class="dc-desc-detail">&#8594; Website Type: ${dynType}</span><br><span class="dc-desc-detail">&#8594; Amount fetched from product catalogue</span>`;
      }
      if (p.name === 'Landing Page') {
        extra = `<br><span class="dc-desc-detail">&#8594; Single-page conversion-focused website for campaigns or lead capture</span><br><span class="dc-desc-detail">&#8594; Amount fetched from product catalogue</span>`;
      }
      if (p.name === 'Static Website') {
        extra = `<br><span class="dc-desc-detail">&#8594; Multi-page informational website with fixed content</span><br><span class="dc-desc-detail">&#8594; Amount fetched from product catalogue</span>`;
      }
      if (p.name === 'SMO Service' || p.name === 'Meta Ads + Management' || p.name === 'Meta Ads Management' || p.name === 'SMO Services') {
        const orgPlatforms = params.smo_platforms && params.smo_platforms.length ? params.smo_platforms.map(s => s.charAt(0).toUpperCase()+s.slice(1)).join(', ') : 'None selected';
        const sponPlatforms = params.smo_sponsored && params.smo_sponsored.length ? params.smo_sponsored.map(s => s === 'fb_ig' ? 'FB/IG Ads (+&#8377;8,000)' : 'LinkedIn Ads (+&#8377;10,000)').join(', ') : 'None';
        const orgCount = params.smo_platforms ? params.smo_platforms.length : 0;
        const orgPrice = orgCount === 1 ? 10000 : orgCount === 2 ? 15000 : orgCount >= 3 ? 20000 : 0;
        extra = `<br><span class="dc-desc-detail">&#8594; Organic: ${orgPlatforms}${orgCount > 0 ? ` (&#8377;${orgPrice.toLocaleString('en-IN')})` : ''}</span><br><span class="dc-desc-detail">&#8594; Sponsored: ${sponPlatforms}</span>`;
      }
      html += `<li class="dc-desc-item"><strong>${p.name}</strong>${extra ? extra : (baseDesc ? `<br><span class="dc-desc-detail">${baseDesc}</span>` : '')}</li>`;
    });
    html += '</ul></div>';
    descContainer.innerHTML = html;
  }

  // ====== END DEAL CLOSE CUSTOM UI BLOCK ======

  let currentUser = null;
  let currentLeadId = null;
  let currentMeDealClosePayload = null;
  let currentMeDealCloseProducts = null;
  let meDealInstallmentsSchedule = [];
  let meDealPartPaymentRemaining = 0;
  let currentMeDealPaymentsLeadId = null;
  let currentMeDealPaymentsData = null;
  let popupTimer = null;
  let attendanceUpdating = false;
  let attendanceCalendarVisible = false;
  let attendanceLocationRequestSubmitting = false;
  let meLeadSubmitting = false;
  let editingMeLeadId = null;
  let currentMeEditingLeadData = null;
  let meTargetProgressChart = null;
  let meDashboardChart = null;
  let meMonthlyHistoryChart = null;
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
  const ME_TODAY_APPOINTMENTS_REFRESH_MS = 60000;
  let meAppointmentsRows = [];
  let meAppointmentsRenderedDateKey = "";
  let meTodayAppointmentRefreshTimer = null;
  let meLeadAppointmentMode = "appointment";
  let meLeadAppointmentPurpose = "appointment";

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

  function getMeUploadedFileUrl(filePath) {
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
    if (!currentUser.role) currentUser.role = "me";
    return userId;
  }
  const PROPOSAL_LETTERHEAD_HEADER_URL = `${BASE_URL}/letterhead-header.jpeg`;
  const PROPOSAL_LETTERHEAD_FOOTER_URL = `${BASE_URL}/letterhead-footer.jpeg`;
  const PROPOSAL_REDSEA_LETTERHEAD_HEADER_URL = `${BASE_URL}/redsea-letterhead-header.jpeg`;
  const PROPOSAL_REDSEA_LETTERHEAD_FOOTER_URL = `${BASE_URL}/redsea-letterhead-footer.jpeg`;

  async function fetchProposalRequest(
    url,
    options = {},
    routeLabel = "Proposal API",
  ) {
    const controller = new AbortController();
    const timeout = window.setTimeout(
      () => controller.abort(),
      PROPOSAL_REQUEST_TIMEOUT_MS,
    );

    try {
      return await fetch(url, {
        ...options,
        signal: controller.signal,
      });
    } catch (err) {
      if (err?.name === "AbortError") {
        throw new Error(
          `${routeLabel} timed out. Please restart the backend and try again.`,
        );
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

  const ATTENDANCE_METRICS_GEOFENCE = {
    companyKey: "metrics",
    label: "Metrics Mart Office",
    latitude: 19.168462596195486,
    longitude: 72.84219765234043,
    radiusMeters: 50,
    address:
      "Riddhi Siddhi Complex, E-107, Swami Vivekananda Rd, opposite Patkar College, Unnat Nagar, Goregaon West, Mumbai, Maharashtra 400104",
  };
  const ATTENDANCE_REDSEA_GEOFENCE = {
    companyKey: "redsea",
    label: "RedSea Office",
    latitude: 28.6260020948207,
    longitude: 77.37907033383912,
    radiusMeters: 50,
    address:
      "B006, H-140, Sector 63, Noida, Uttar Pradesh 201301",
  };
  const ATTENDANCE_GEOFENCE = ATTENDANCE_METRICS_GEOFENCE;
  let attendanceLocationRequestState = {
    officeZone: { ...ATTENDANCE_GEOFENCE, type: "office", label: "Office" },
    activeRequest: null,
    activeZone: { ...ATTENDANCE_GEOFENCE, type: "office", label: "Office" },
    attendanceDate: "",
    canRequestOffsite: true,
    showOffsiteRequestOption: true,
  };

  function normalizeMeAttendanceCompanyKey(value) {
    const raw =
      value && typeof value === "object"
        ? value.company_key ||
          value.companyKey ||
          value.selected_company ||
          value.selectedCompany ||
          value.company_scope ||
          value.companyScope ||
          value.comp_name ||
          value.compName ||
          value.company ||
          ""
        : value;
    const normalized = String(raw || "")
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "");

    if (
      normalized === "redsea" ||
      normalized === "redseadigitals" ||
      normalized === "redseadigitalspvtltd" ||
      normalized.startsWith("redseadigital")
    ) {
      return "redsea";
    }

    if (
      normalized === "metrics" ||
      normalized === "metricsmart" ||
      normalized === "metricsmartinfolinepvtltd" ||
      normalized.startsWith("metricsmart") ||
      normalized.includes("metricsmartinfoline")
    ) {
      return "metrics";
    }

    return "";
  }

  function getMeAttendanceDefaultOfficeZone() {
    const zone =
      normalizeMeAttendanceCompanyKey(currentUser) === "redsea"
        ? ATTENDANCE_REDSEA_GEOFENCE
        : ATTENDANCE_METRICS_GEOFENCE;

    return { ...zone, type: "office" };
  }

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

      ProjectTrackerUI.renderStats("meProjectTrackerStats", result.counts, {
        assignmentCounts: result.assignmentCounts,
      });
      ProjectTrackerUI.renderProjects("meProjectsContainer", result);
    } catch (err) {
      console.error("ME Project Tracker Error:", err);
      ProjectTrackerUI.renderStats(
        "meProjectTrackerStats",
        getEmptyProjectTrackerCounts(),
        {
          assignmentCounts: { total: 0 },
        },
      );
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
    setupMeLeadShiftModals();
    setupAttendanceLocationRequestModal();
    setupProposalForm();
    setupMeTodayAppointmentsAutoRefresh();

    if (currentUser?.id) {
      loadMeDashboard();
    }

    const paymentForm = document.getElementById("meDealPaymentForm");
    if (paymentForm) {
      paymentForm.addEventListener("submit", handleMeDealPaymentSubmit);
    }

    const paymentAmountInput = document.getElementById("meDealPaymentAmount");
    if (paymentAmountInput) {
      paymentAmountInput.addEventListener("input", updateMeDealPaymentBreakupPreview);
      updateMeDealPaymentBreakupPreview();
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
    hydrateCurrentUserIdentity();
    localStorage.setItem("currentUser", JSON.stringify(currentUser));
    const officeZone = getMeAttendanceDefaultOfficeZone();
    attendanceLocationRequestState = {
      officeZone,
      activeRequest: null,
      activeZone: officeZone,
      attendanceDate: "",
      canRequestOffsite: true,
      showOffsiteRequestOption: true,
    };
    applyMeCompanyTheme();

    document.getElementById("userName").textContent = currentUser.name;

    // ✅ FIX
    if (currentUser.prof_img) {
      const avatarUrl = getMeUploadedFileUrl(currentUser.prof_img);
      if (avatarUrl) document.getElementById("userAvatar").src = avatarUrl;
    }

    refreshMeRenewalBadge();
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
    if (sectionId === "leads") loadMeLeads();
    if (sectionId === "appointments") fetchMEData();
    if (sectionId === "followups") fetchFollowups();
    if (sectionId === "deals") fetchDeals();
    if (sectionId === "renewals") loadMeRenewals();
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

  function getMeRenewalCompanyScope() {
    return (
      currentUser?.company_key ||
      currentUser?.selected_company ||
      currentUser?.company_scope ||
      currentUser?.comp_name ||
      ""
    );
  }

  function updateMeRenewalBadge(count = 0) {
    const badge = document.getElementById("meRenewalsBadge");
    const navItem = document.getElementById("meRenewalsNavItem");
    const dueCount = Math.max(Number(count) || 0, 0);
    if (!badge) return;
    badge.textContent = dueCount > 99 ? "99+" : String(dueCount);
    badge.classList.toggle("hidden", dueCount === 0);
    navItem?.classList.toggle("has-notification-badge", dueCount > 0);
  }

  function formatMeRenewalDate(value) {
    const raw = String(value || "").slice(0, 10);
    const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return raw || "-";
    return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
      .toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  }

  function formatMeRenewalDays(value) {
    const days = Number(value);
    if (!Number.isFinite(days)) return "-";
    if (days === 0) return "Today";
    if (days === 1) return "1 day";
    if (days > 1) return `${days} days`;
    return `${Math.abs(days)} overdue`;
  }

  function getMeRenewalStatusMeta(item = {}) {
    const configured = Number(item.is_configured || item.renewal_id || item.id || 0) > 0;
    const status = String(item.status || "").toLowerCase();
    const days = Number(item.days_left);
    if (!configured) return { className: "upcoming", label: "Not Set" };
    if (status === "stopped") return { className: "stopped", label: "Stopped" };
    if (Number.isFinite(days) && days === 0) return { className: "due-today", label: "Due Today" };
    if (Number.isFinite(days) && days > 0 && days <= 2) return { className: "due-soon", label: "Due Soon" };
    return { className: "started", label: "Active" };
  }

  function getMeRenewalRowKey(item = {}) {
    return `${Number(item.lead_id || 0)}-${String(item.service_name || "").replace(/[^a-z0-9]+/gi, "_")}`;
  }

  function renderMeRenewalBasisOptions(item = {}) {
    const basis = String(item.renewal_basis || "monthly");
    const options = Number(item.website_yearly_only || 0) > 0
      ? [["yearly", "Yearly"]]
      : [["monthly", "Monthly"], ["quarterly", "Quarterly"], ["half_yearly", "Half Yearly"], ["yearly", "Full Yearly"]];
    return options
      .map(([value, label]) => `<option value="${value}" ${basis === value ? "selected" : ""}>${label}</option>`)
      .join("");
  }

  function setMeRenewalSummary(summary = {}) {
    const setText = (id, value) => {
      const el = document.getElementById(id);
      if (el) el.textContent = String(Number(value || 0));
    };
    setText("meRenewalTotal", summary.total);
    setText("meRenewalDueSoon", summary.notifySoon || summary.dueSoon);
    setText("meRenewalActive", summary.active);
    setText("meRenewalStopped", summary.stopped);
    updateMeRenewalBadge(summary.notifySoon || summary.dueSoon || 0);
  }

  function renderMeRenewalRows(rows = []) {
    const tbody = document.getElementById("meRenewalsTableBody");
    if (!tbody) return;
    if (!rows.length) {
      tbody.innerHTML = `<tr><td colspan="9">No renewal records found</td></tr>`;
      return;
    }

    tbody.innerHTML = rows.map((item) => {
      const status = getMeRenewalStatusMeta(item);
      const rowKey = getMeRenewalRowKey(item);
      const configured = Number(item.is_configured || item.renewal_id || item.id || 0) > 0;
      const renewalId = Number(item.renewal_id || item.id || 0);
      const stopped = String(item.status || "").toLowerCase() === "stopped";
      const startValue = item.first_start_date || item.history_start_date || item.renewal_due_date || "";
      const invoiceStart = item.history_start_date || item.renewal_due_date || item.current_start_date || item.first_start_date || "";
      const invoiceStartArg = escapeMeHtml(String(invoiceStart).replace(/\\/g, "\\\\").replace(/'/g, "\\'"));
      const serviceArg = escapeMeHtml(String(item.service_name || "").replace(/\\/g, "\\\\").replace(/'/g, "\\'"));
      const stopButton = configured && !stopped
        ? `<button type="button" class="renewal-stop-btn" onclick="stopMeRenewal(${renewalId})">Stop</button>`
        : "";
      return `
        <tr>
          <td>${escapeMeHtml(item.company_name || "-")}</td>
          <td>${escapeMeHtml(item.client_name || "-")}</td>
          <td>${escapeMeHtml(item.service_name || "-")}</td>
          <td><select id="meRenewalBasis_${rowKey}" class="renewal-inline-control" ${Number(item.website_yearly_only || 0) > 0 ? "disabled" : ""}>${renderMeRenewalBasisOptions(item)}</select></td>
          <td><input id="meRenewalStart_${rowKey}" class="renewal-inline-control" type="date" value="${escapeMeHtml(startValue)}" /></td>
          <td>${escapeMeHtml(formatMeRenewalDate(item.renewal_due_date))}</td>
          <td>${escapeMeHtml(formatMeRenewalDays(item.days_left))}</td>
          <td><span class="renewal-status ${status.className}">${escapeMeHtml(status.label)}</span></td>
          <td><div class="renewal-action-stack"><button type="button" class="renewal-save-btn" onclick="saveMeRenewal(${Number(item.lead_id || 0)}, '${serviceArg}', '${rowKey}')">Save</button>${stopButton}</div></td>
        </tr>
      `;
    }).join("");
  }

  async function loadMeRenewals(forceRefresh = false) {
    if (!currentUser?.id) return;
    const tbody = document.getElementById("meRenewalsTableBody");
    if (tbody && forceRefresh) tbody.innerHTML = `<tr><td colspan="9">Loading renewals...</td></tr>`;
    try {
      const params = new URLSearchParams({
        role: currentUser.role || "me",
        userId: currentUser.id,
        userName: currentUser.name || "",
        status: document.getElementById("meRenewalsStatus")?.value || "all",
      });
      const month = document.getElementById("meRenewalsMonth")?.value || "";
      const companyScope = getMeRenewalCompanyScope();
      if (month) params.set("month", month);
      if (companyScope) params.set("companyScope", companyScope);
      const res = await fetch(`${BASE_URL}/api/service-renewals?${params.toString()}`, { cache: "no-store" });
      const result = await res.json();
      if (!res.ok || !result.success) throw new Error(result.message || "Failed to load renewals");
      setMeRenewalSummary(result.summary || {});
      renderMeRenewalRows(Array.isArray(result.data) ? result.data : []);
    } catch (err) {
      console.error("ME renewals error:", err);
      setMeRenewalSummary({});
      if (tbody) tbody.innerHTML = `<tr><td colspan="9">${escapeMeHtml(err.message || "Unable to load renewals")}</td></tr>`;
    }
  }

  async function refreshMeRenewalBadge() {
    if (!currentUser?.id) return;
    try {
      const params = new URLSearchParams({
        role: currentUser.role || "me",
        userId: currentUser.id,
        userName: currentUser.name || "",
        status: "due_soon",
      });
      const companyScope = getMeRenewalCompanyScope();
      if (companyScope) params.set("companyScope", companyScope);
      const res = await fetch(`${BASE_URL}/api/service-renewals?${params.toString()}`, { cache: "no-store" });
      const result = await res.json();
      updateMeRenewalBadge(result?.summary?.notifySoon || result?.summary?.dueSoon || 0);
    } catch (_err) {
      updateMeRenewalBadge(0);
    }
  }

  async function saveMeRenewal(leadId, serviceName, rowKey) {
    const startDate = document.getElementById(`meRenewalStart_${rowKey}`)?.value || "";
    const basis = document.getElementById(`meRenewalBasis_${rowKey}`)?.value || "yearly";
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
      await loadMeRenewals(true);
    } catch (err) {
      showPopup("Renewal", err.message || "Unable to save renewal.", false);
    }
  }

  async function stopMeRenewal(renewalId) {
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
      await loadMeRenewals(true);
    } catch (err) {
      showPopup("Renewal", err.message || "Unable to stop renewal.", false);
    }
  }

  function openMeRenewalInvoice(renewalId, type = "tax", cycleStart = "") {
    if (!renewalId) return;
    const params = new URLSearchParams({ type });
    if (cycleStart) params.set("cycleStart", cycleStart);
    if (currentUser?.id) params.set("requesterId", currentUser.id);
    window.open(`${BASE_URL}/api/service-renewals/${renewalId}/invoice?${params.toString()}`, "_blank", "noopener,noreferrer");
  }

  window.loadMeRenewals = loadMeRenewals;
  window.saveMeRenewal = saveMeRenewal;
  window.stopMeRenewal = stopMeRenewal;
  window.openMeRenewalInvoice = openMeRenewalInvoice;
  // ================= APPOINTMENTS =================
    async function loadMeLeads() {
    if (!currentUser || !currentUser.id) return;

    const container = document.getElementById("meLeadsContainer");
    if (!container) return;

    try {
      const params = new URLSearchParams({
        userId: currentUser.id,
        role: currentUser.role || "me",
      });
      const companyScope = getCurrentMePanelCompanyScope();
      if (companyScope) {
        params.set("company", companyScope);
        params.set("company_scope", companyScope);
      }

      const res = await fetch(`${BASE_URL}/api/leads?${params.toString()}`, {
        cache: "no-store",
      });
      const data = await res.json();
      let rows = data.success && Array.isArray(data.data) ? data.data : [];

      const uniqueMap = new Map();
      rows.forEach(lead => {
        const comp = lead.comp_name ? String(lead.comp_name).trim().toLowerCase() : '';
        const contact = lead.contact ? String(lead.contact).trim() : '';
        const key = contact ? `${comp}_${contact}` : `id_${lead.id}`;
        
        if (!uniqueMap.has(key)) {
          uniqueMap.set(key, lead);
        }
      });
      rows = Array.from(uniqueMap.values());

      const selectedMonth = document.getElementById("meLeadsMonthFilter")?.value || "";
      if (selectedMonth) {
        rows = rows.filter(item => {
          const dateVal = item.created_at || item.created_date || item.date;
          if (!dateVal) return false;
          const d = new Date(dateVal);
          if (isNaN(d)) return false;
          const yyyy = d.getFullYear();
          const mm = String(d.getMonth() + 1).padStart(2, '0');
          return `${yyyy}-${mm}` === selectedMonth;
        });
      }

      container.innerHTML = buildMeLeadsTable(rows);
      filterTable("meLeadsContainer", "meLeadsSearch");
    } catch (err) {
      console.error("ME leads load error:", err);
      container.innerHTML = `<p class="no-data">Unable to load leads</p>`;
    }
  }

  function getMeLeadRowStage(lead = {}) {
    const leadStatus = String(lead.lead_status || "")
      .toLowerCase()
      .trim();
    const actionType = String(lead.action_type || "")
      .toLowerCase()
      .trim();

    if (leadStatus === "deal_closed") {
      return {
        key: "deal_closed",
        className: "deal_closed",
        label: "Deal Closed",
      };
    }

    if (leadStatus === "not_interested") {
      return {
        key: "not_interested",
        className: "not_interested",
        label: "Not Interested",
      };
    }

    if (actionType === "appointment") {
      const isGoogleMeet = getMeMeetingTypeValue(lead) === "google_meet";
      return {
        key: "appointment",
        className: "appointment",
        label: isGoogleMeet ? "Google Meet" : "Appointment",
      };
    }

    if (actionType === "followup") {
      return { key: "followup", className: "followup", label: "Follow Up" };
    }

    return { key: "lead", className: "lead", label: "Lead" };
  }

  function renderMeLeadShiftActions(lead = {}, stageKey = "") {
    const leadId = Number(lead.id || 0);
    if (!leadId) return `<span class="me-lead-no-action">-</span>`;

    const updateButton = `
      <button type="button" class="me-lead-action-btn update" onclick="openMeLeadEditForm(${leadId})" title="Update Lead">
        <i class="fas fa-edit"></i><span>Update</span>
      </button>
    `;
    const canMoveLead =
      !["deal_closed", "not_interested"].includes(stageKey);
    if (!canMoveLead) return updateButton;

    const appointmentButton =
      stageKey !== "appointment"
        ? `
          <button type="button" class="me-lead-action-btn appointment" onclick="openMeLeadAppointmentModal(${leadId}, 'appointment')" title="Set Appointment">
            <i class="fas fa-calendar-plus"></i><span>Appointment</span>
          </button>
        `
        : "";
    const isGoogleMeet = getMeMeetingTypeValue(lead) === "google_meet";
    const googleMeetButton = !isGoogleMeet
      ? `
        <button type="button" class="me-lead-action-btn google-meet" onclick="openMeLeadAppointmentModal(${leadId}, 'google_meet')" title="Schedule Google Meet">
          <i class="fas fa-video"></i><span>Google Meet</span>
        </button>
      `
      : "";
    const followupButton =
      stageKey !== "followup"
        ? `
          <button type="button" class="me-lead-action-btn followup" onclick="openMeLeadFollowupModal(${leadId})" title="Set Follow Up">
            <i class="fas fa-clock"></i><span>Follow Up</span>
          </button>
        `
        : "";

    return (
      appointmentButton + googleMeetButton + followupButton + updateButton ||
      `<span class="me-lead-no-action">-</span>`
    );
  }

function isDealMatchingMonth(deal, monthKey) {
  if (!monthKey) return true;
  if (!deal) return false;
  return Boolean(getMeDealSalesTypeValue(deal, monthKey));
}

  function buildMeLeadsTable(rows = []) {
    const bodyHtml = rows.length
      ? rows
          .map((lead) => {
            const stage = getMeLeadRowStage(lead);
            return `
              <tr>
                <td>${escapeMeHtml(lead.company_name || "-")}</td>
                <td>${escapeMeHtml(lead.client_name || "-")}</td>
                <td>${escapeMeHtml(lead.contact || "-")}</td>
                <td>${escapeMeHtml(lead.email || "-")}</td>
                <td>
                  <span class="me-lead-stage ${escapeMeHtml(stage.className)}">
                    ${escapeMeHtml(stage.label)}
                  </span>
                  <small class="me-lead-stage-date">${escapeMeHtml(formatDate(lead.created_at || lead.created_date))}</small>
                </td>
                <td>
                  <div class="me-lead-row-actions">
                    ${renderMeLeadShiftActions(lead, stage.key)}
                  </div>
                </td>
              </tr>
            `;
          })
          .join("")
      : `<tr><td colspan="6">No leads found</td></tr>`;

    return `
      <div class="table-wrapper">
        <table class="data-table">
          <thead>
            <tr>
              <th>Company</th>
              <th>Client</th>
              <th>Contact</th>
              <th>Email</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>${bodyHtml}</tbody>
        </table>
      </div>
    `;
  }

  function setupMeLeadShiftModals() {
    const appointmentForm = document.getElementById("meLeadAppointmentForm");
    if (appointmentForm && !appointmentForm.dataset.bound) {
      appointmentForm.addEventListener("submit", handleMeLeadAppointmentSubmit);
      appointmentForm.dataset.bound = "true";
    }

    ["meLeadAppointmentDate", "meLeadAppointmentTime"].forEach((id) => {
      const field = document.getElementById(id);
      if (!field || field.dataset.bound) return;
      field.addEventListener("change", () => loadMeLeadAppointmentEmployees());
      field.dataset.bound = "true";
    });

    const followupForm = document.getElementById("meLeadFollowupForm");
    if (followupForm && !followupForm.dataset.bound) {
      followupForm.addEventListener("submit", handleMeLeadFollowupSubmit);
      followupForm.dataset.bound = "true";
    }
  }

  function openMeLeadShiftModal(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) return;
    modal.classList.remove("hidden");
    modal.classList.add("show");
    document.body.classList.add("modal-open");
  }

  function closeMeLeadShiftModal(modalId, formId) {
    const modal = document.getElementById(modalId);
    const form = document.getElementById(formId);
    if (modal) {
      modal.classList.remove("show");
      modal.classList.add("hidden");
    }
    form?.reset();
    document.body.classList.remove("modal-open");
  }

  function openMePendingWhatsAppWindow(shouldOpen) {
    if (!shouldOpen) return null;

    try {
      return window.open("about:blank", "_blank", "noopener,noreferrer");
    } catch (_err) {
      return null;
    }
  }

  function closeMePendingWhatsAppWindow(targetWindow) {
    try {
      if (targetWindow && !targetWindow.closed) targetWindow.close();
    } catch (_err) {
      // Popup may already be closed by the browser.
    }
  }

  function completeMeWhatsAppDraft(targetWindow, whatsapp, fallbackMessage) {
    if (whatsapp?.url) {
      if (targetWindow && !targetWindow.closed) {
        targetWindow.location.replace(whatsapp.url);
      } else {
        window.open(whatsapp.url, "_blank", "noopener,noreferrer");
      }
      return whatsapp.message || fallbackMessage;
    }

    closeMePendingWhatsAppWindow(targetWindow);
    return whatsapp?.warning || fallbackMessage;
  }

  function setMeLeadAppointmentModalMode(mode = "appointment") {
    const isReschedule = mode === "reschedule";
    meLeadAppointmentMode = mode === "google_meet" ? "google_meet" : "appointment";
    meLeadAppointmentPurpose = isReschedule ? "reschedule" : meLeadAppointmentMode;
    const isGoogleMeet = meLeadAppointmentMode === "google_meet";
    const title = document.getElementById("meLeadAppointmentModalTitle");
    const dateLabel = document.getElementById("meLeadAppointmentDateLabel");
    const timeLabel = document.getElementById("meLeadAppointmentTimeLabel");
    const locationLabel = document.getElementById("meLeadAppointmentLocationLabel");
    const locationField = document.getElementById("meLeadAppointmentLocation");
    const saveBtn = document.getElementById("meLeadAppointmentSaveBtn");

    if (title) {
      title.textContent = isReschedule
        ? "Reschedule Meeting"
        : isGoogleMeet
        ? "Schedule Google Meet for Lead"
        : "Set Appointment for Lead";
    }
    if (dateLabel) {
      dateLabel.innerHTML = isReschedule
        ? 'Meeting Date <span style="color: red">*</span>'
        : isGoogleMeet
        ? 'Meeting Date <span style="color: red">*</span>'
        : 'Appointment Date <span style="color: red">*</span>';
    }
    if (timeLabel) {
      timeLabel.innerHTML = isReschedule
        ? 'Meeting Time <span style="color: red">*</span>'
        : isGoogleMeet
        ? 'Meeting Time <span style="color: red">*</span>'
        : 'Appointment Time <span style="color: red">*</span>';
    }
    if (saveBtn) {
      saveBtn.textContent = isReschedule
        ? "Save Reschedule"
        : isGoogleMeet
          ? "Save Google Meet"
          : "Save Appointment";
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

  async function openMeLeadAppointmentModal(leadId, mode = "appointment") {
    const normalizedLeadId = Number(leadId || 0);
    if (!normalizedLeadId) return;
    setMeLeadAppointmentModalMode(mode);

    const info = document.getElementById("meLeadAppointmentInfo");
    const idField = document.getElementById("meLeadAppointmentId");
    const dateField = document.getElementById("meLeadAppointmentDate");
    const timeField = document.getElementById("meLeadAppointmentTime");
    const locationField = document.getElementById("meLeadAppointmentLocation");

    if (idField) idField.value = String(normalizedLeadId);
    if (info) info.textContent = "Loading lead details...";
    openMeLeadShiftModal("meLeadAppointmentModal");

    try {
      const res = await fetch(`${BASE_URL}/api/leads/${normalizedLeadId}`, {
        cache: "no-store",
      });
      const result = await res.json();
      const lead = result.success ? result.data || {} : {};

      if (info) {
        info.innerHTML = `<strong>${escapeMeHtml(lead.company_name || "Lead")}</strong> - ${escapeMeHtml(lead.client_name || "-")}`;
      }
      if (dateField)
        dateField.value = lead.app_date ? String(lead.app_date).slice(0, 10) : "";
      if (timeField)
        timeField.value = lead.app_time ? String(lead.app_time).slice(0, 5) : "";
      if (locationField && meLeadAppointmentMode !== "google_meet")
        locationField.value = lead.location || lead.maps_lnk || "";
      if (info && meLeadAppointmentMode === "google_meet") {
        info.innerHTML += `<br><small>Google Meet link will be generated automatically.</small>`;
      }
      await loadMeLeadAppointmentEmployees();
      selectMeLeadAppointmentEmployee(lead.assign_emp, lead.assign_emp_id);
    } catch (err) {
      console.error("ME appointment lead load error:", err);
      if (info) info.textContent = "Lead details unavailable";
      await loadMeLeadAppointmentEmployees();
    }
  }

  function closeMeLeadAppointmentModal() {
    closeMeLeadShiftModal("meLeadAppointmentModal", "meLeadAppointmentForm");
    setMeLeadAppointmentModalMode("appointment");
  }

  async function fetchMeLeadAppointmentEmployeeList(date, time) {
    const hasDateTime = Boolean(date && time);
    const endpoint = hasDateTime
      ? `${BASE_URL}/api/available-employees?date=${encodeURIComponent(date)}&time=${encodeURIComponent(time)}`
      : `${BASE_URL}/api/me-employees`;

    const res = await fetch(endpoint, { cache: "no-store" });
    return await res.json();
  }

  async function loadMeLeadAppointmentEmployees() {
    const select = document.getElementById("meLeadAppointmentAssignEmp");
    if (!select) return;

    const date = document.getElementById("meLeadAppointmentDate")?.value || "";
    const time = document.getElementById("meLeadAppointmentTime")?.value || "";
    const previousEmployee = getSelectedMeLeadEmployeeMeta(select);

    try {
      const result = await fetchMeLeadAppointmentEmployeeList(date, time);
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
        selectMeLeadAppointmentEmployee(
          previousEmployee.name,
          previousEmployee.id,
        );
      }

      if (!select.value) {
        selectMeLeadAppointmentEmployee(currentUser?.name, currentUser?.id);
      }
    } catch (err) {
      console.error("ME appointment employee load error:", err);
      populateMeLeadEmployeeSelect(select, [], "Unable to load employees");
    }
  }

  function selectMeLeadAppointmentEmployee(name, id) {
    const select = document.getElementById("meLeadAppointmentAssignEmp");
    if (!select) return;

    const normalizedId = String(id || "");
    const normalizedName = String(name || "");
    const option = Array.from(select.options).find(
      (item) =>
        (normalizedId && item.dataset.employeeId === normalizedId) ||
        (normalizedName && item.value === normalizedName),
    );

    if (option) select.value = option.value;
  }

  async function getMeAppointmentLeadWhatsappDetails(leadId) {
    try {
      const res = await fetch(`${BASE_URL}/api/leads/${leadId}`, {
        cache: "no-store",
      });
      const result = await res.json();
      const lead = result.success ? result.data || {} : {};

      return {
        company: lead.company_name || "",
        company_name: lead.company_name || "",
        client: lead.client_name || "",
        client_name: lead.client_name || "",
        contact: lead.contact || "",
        alternate_contact: lead.alternate_contact || "",
        telephone: lead.telephone || "",
        email: lead.email || "",
        source_lead: lead.source_lead || "",
        industry_type: lead.industry_type || "",
        maps_lnk: lead.maps_lnk || "",
        created_by_name: currentUser?.name || "",
      };
    } catch (err) {
      console.warn("ME appointment WhatsApp lead details fallback:", err);
      return { created_by_name: currentUser?.name || "" };
    }
  }

  async function handleMeLeadAppointmentSubmit(event) {
    event.preventDefault();

    const leadId = Number(
      document.getElementById("meLeadAppointmentId")?.value || 0,
    );
    const selectedEmployee = getSelectedMeLeadEmployeeMeta(
      document.getElementById("meLeadAppointmentAssignEmp"),
    );
    const meetingType =
      meLeadAppointmentMode === "google_meet" ? "google_meet" : "appointment";
    const shouldNotifyWhatsApp = Boolean(selectedEmployee.name);
    const pendingWhatsAppWindow = openMePendingWhatsAppWindow(shouldNotifyWhatsApp);
    const leadWhatsappDetails = shouldNotifyWhatsApp
      ? await getMeAppointmentLeadWhatsappDetails(leadId)
      : {};
    const payload = {
      ...leadWhatsappDetails,
      action_type: "appointment",
      meeting_type: meetingType,
      app_date: document.getElementById("meLeadAppointmentDate")?.value || "",
      app_time: document.getElementById("meLeadAppointmentTime")?.value || "",
      assign_emp: selectedEmployee.name,
      assign_emp_id: selectedEmployee.id,
      assign_emp_contact: selectedEmployee.contact,
      location:
        meetingType === "google_meet"
          ? null
          : document.getElementById("meLeadAppointmentLocation")?.value || "",
      notify_whatsapp: shouldNotifyWhatsApp,
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

      const isRescheduleSave = meLeadAppointmentPurpose === "reschedule";
      const feedbackMessage = completeMeWhatsAppDraft(
        pendingWhatsAppWindow,
        result.whatsapp,
        isRescheduleSave
          ? "Meeting rescheduled successfully."
          : meetingType === "google_meet"
          ? "Google Meet scheduled successfully."
          : "Lead moved to appointments successfully.",
      );

      closeMeLeadAppointmentModal();
      showPopup(
        isRescheduleSave
          ? "Meeting Rescheduled"
          : meetingType === "google_meet"
            ? "Google Meet Saved"
            : "Appointment Saved",
        feedbackMessage,
        true,
      );
      loadMeLeads();
      fetchMEData();
      loadMeDashboard();
    } catch (err) {
      console.error("ME appointment save error:", err);
      closeMePendingWhatsAppWindow(pendingWhatsAppWindow);
      showPopup(
        "Appointment Error",
        err.message || "Failed to set appointment",
        false,
      );
    }
  }

  async function openMeLeadFollowupModal(leadId) {
    const normalizedLeadId = Number(leadId || 0);
    if (!normalizedLeadId) return;

    const info = document.getElementById("meLeadFollowupInfo");
    const idField = document.getElementById("meLeadFollowupId");
    const dateField = document.getElementById("meLeadFollowupDate");
    const timeField = document.getElementById("meLeadFollowupTime");
    const reasonField = document.getElementById("meLeadFollowupReason");

    if (idField) idField.value = String(normalizedLeadId);
    if (info) info.textContent = "Loading lead details...";
    openMeLeadShiftModal("meLeadFollowupModal");

    try {
      const res = await fetch(`${BASE_URL}/api/leads/${normalizedLeadId}`, {
        cache: "no-store",
      });
      const result = await res.json();
      const lead = result.success ? result.data || {} : {};

      if (info) {
        info.innerHTML = `<strong>${escapeMeHtml(lead.company_name || "Lead")}</strong> - ${escapeMeHtml(lead.client_name || "-")}`;
      }
      if (dateField)
        dateField.value = lead.follow_date
          ? String(lead.follow_date).slice(0, 10)
          : "";
      if (timeField)
        timeField.value = lead.follow_time
          ? String(lead.follow_time).slice(0, 5)
          : "";
      if (reasonField) reasonField.value = lead.reason || "";
    } catch (err) {
      console.error("ME followup lead load error:", err);
      if (info) info.textContent = "Lead details unavailable";
    }
  }

  function closeMeLeadFollowupModal() {
    closeMeLeadShiftModal("meLeadFollowupModal", "meLeadFollowupForm");
  }

  async function handleMeLeadFollowupSubmit(event) {
    event.preventDefault();

    const leadId = Number(
      document.getElementById("meLeadFollowupId")?.value || 0,
    );
    const payload = {
      action_type: "followup",
      follow_date: document.getElementById("meLeadFollowupDate")?.value || "",
      follow_time: document.getElementById("meLeadFollowupTime")?.value || "",
      reason: document.getElementById("meLeadFollowupReason")?.value || "",
      assign_emp: currentUser?.name || "",
      assign_emp_id: currentUser?.id || null,
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

      closeMeLeadFollowupModal();
      showPopup(
        "Follow Up Saved",
        "Lead moved to follow ups successfully.",
        true,
      );
      loadMeLeads();
      fetchFollowups();
      loadMeDashboard();
    } catch (err) {
      console.error("ME followup save error:", err);
      showPopup(
        "Follow Up Error",
        err.message || "Failed to set follow up",
        false,
      );
    }
  }

  async function fetchMEData() {
    if (!currentUser || !currentUser.id) return;

    try {
      const res = await fetch(`${BASE_URL}/api/appointments/${currentUser.id}`);
      const data = await res.json();

      const container = document.getElementById("appointmentsContainer");
      const rows = data.success && Array.isArray(data.data) ? data.data : [];
      const sortedRows = sortMeAppointmentsForDisplay(rows);
      meAppointmentsRows = sortedRows;

      renderTodayAppointments(sortedRows);

      let filteredRows = sortedRows;
      const selectedMonth = document.getElementById("appointmentsMonthFilterME")?.value;
      if (selectedMonth) {
        filteredRows = sortedRows.filter((row) => {
          const dStr = row.app_date || row.created_at;
          if (!dStr) return false;
          const date = new Date(dStr);
          if (isNaN(date)) return false;
          const yyyy = date.getFullYear();
          const mm = String(date.getMonth() + 1).padStart(2, '0');
          return `${yyyy}-${mm}` === selectedMonth;
        });
      }

      if (!filteredRows.length) {
        container.innerHTML = `<p class="no-data">No Appointments Found</p>`;
        return;
      }

      container.innerHTML = buildMeAppointmentsTable(
        filteredRows,
        "No appointments found",
      );
    } catch (err) {
      console.error("Appointments Error:", err);
      meAppointmentsRows = [];
      renderTodayAppointments([]);
    }
  }

  function getCurrentMePanelCompanyScope() {
    return (
      normalizeMeLeadCompanyScope(
        currentUser?.company_key ||
          currentUser?.selected_company ||
          currentUser?.company_scope ||
          currentUser?.comp_name ||
          new URLSearchParams(window.location.search).get("company"),
      ) || "metrics"
    );
  }

  function applyMeCompanyTheme() {
    const companyScope = getCurrentMePanelCompanyScope();
    document.body.classList.toggle(
      "me-company-redsea",
      companyScope === "redsea",
    );
    document.body.classList.toggle(
      "me-company-metrics",
      companyScope !== "redsea",
    );
  }

  function getMeAppointmentDateKey(value) {
    if (value instanceof Date && !Number.isNaN(value.getTime())) {
      return formatDateKey(value);
    }

    const raw = String(value || "").trim();
    if (!raw) return "";

    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;

    if (raw.includes("T")) {
      const date = new Date(raw);
      if (!Number.isNaN(date.getTime())) return formatDateKey(date);
    }

    const localDateText = raw.match(/^(\d{4}-\d{2}-\d{2})[ T]/);
    if (localDateText) return localDateText[1];

    const date = new Date(raw);
    if (Number.isNaN(date.getTime())) return "";
    return formatDateKey(date);
  }

  function formatMeAppointmentDate(value) {
    const dateKey = getMeAppointmentDateKey(value);
    if (!dateKey) return "-";

    const [year, month, day] = dateKey.split("-").map(Number);
    return new Date(year, month - 1, day).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  }

  function formatMeAppointmentTime(value) {
    const raw = String(value || "").trim();
    return formatAttendanceTime(raw);
  }

  function getMeAppointmentStatus(item = {}) {
    const leadStatus = String(item.lead_status || "")
      .toLowerCase()
      .trim();
    const appointmentStatus = String(item.appointment_status || "")
      .toLowerCase()
      .trim();

    if (leadStatus === "deal_closed") {
      return { className: "deal_closed", label: "Deal Closed" };
    }

    if (leadStatus === "not_interested") {
      return { className: "not_interested", label: "Not Interested" };
    }

    if (appointmentStatus === "confirmed") {
      return { className: "confirmed", label: "Confirmed" };
    }

    if (appointmentStatus === "not_confirmed") {
      return { className: "not_confirmed", label: "Not Confirmed" };
    }

    return { className: "active", label: "Active" };
  }

  function getMeMeetingTypeValue(item = {}) {
    const raw = String(item.meeting_type || item.meetingType || "")
      .toLowerCase()
      .trim();
    return raw === "google_meet" || item.google_meet_link
      ? "google_meet"
      : "appointment";
  }

  function getMeMeetingTypeLabel(item = {}) {
    return getMeMeetingTypeValue(item) === "google_meet"
      ? "Google Meet"
      : "Appointment";
  }

  function buildMeMeetingTypeCell(item = {}) {
    const isGoogleMeet = getMeMeetingTypeValue(item) === "google_meet";
    return `
      <span class="status ${isGoogleMeet ? "google_meet" : "active"}">
        ${isGoogleMeet ? '<i class="fas fa-video"></i> ' : ""}${escapeMeHtml(getMeMeetingTypeLabel(item))}
      </span>
    `;
  }

  function buildMeGoogleMeetLinkValue(item = {}) {
    const meetLink = String(item.google_meet_link || "").trim();
    if (!meetLink) return "-";

    return `
      <a href="${escapeMeHtml(meetLink)}" target="_blank" rel="noopener noreferrer" class="location-link">
        ${escapeMeHtml(meetLink)}
      </a>
    `;
  }

  function buildMeAppointmentLocationCell(item = {}) {
    if (getMeMeetingTypeValue(item) === "google_meet") {
      const meetLink = String(item.google_meet_link || "").trim();
      if (!meetLink) return "Google Meet link pending";

      return `
        <a href="${escapeMeHtml(meetLink)}" target="_blank" rel="noopener noreferrer" class="location-link">
          Join Meet
        </a>
      `;
    }

    const location = String(item.location || item.maps_lnk || "").trim();
    if (!location || location === "-") return "-";

    if (!/^https?:\/\//i.test(location)) {
      return escapeMeHtml(location);
    }

    return `
      <a href="${escapeMeHtml(location)}" target="_blank" rel="noopener noreferrer" class="location-link">
        View Location
      </a>
    `;
  }

  function buildMeAppointmentsTable(
    rows = [],
    emptyText = "No appointments found",
  ) {
    const bodyHtml = rows.length
      ? rows
          .map((item) => {
            const status = getMeAppointmentStatus(item);
            const isMuted = status.className === "not_interested";

            return `
              <tr
                data-id="${escapeMeHtml(item.id || "")}"
                data-company="${escapeMeHtml(item.company_name || "")}"
                data-client="${escapeMeHtml(item.client_name || "")}"
                class="${isMuted ? "grayed-out" : ""}"
              >
                <td>${escapeMeHtml(item.company_name || "-")}</td>
                <td>${escapeMeHtml(item.client_name || "-")}</td>
                <td>${escapeMeHtml(item.contact || "-")}</td>
                <td>${escapeMeHtml(formatMeAppointmentDate(item.app_date))}</td>
                <td>${escapeMeHtml(formatMeAppointmentTime(item.app_time))}</td>
                <td>${buildMeMeetingTypeCell(item)}</td>
                <td>${buildMeAppointmentLocationCell(item)}</td>
                <td>
                  <span class="status ${status.className}">
                    ${escapeMeHtml(status.label)}
                  </span>
                </td>
                <td>
                  <button
                    type="button"
                    class="btn-view-details"
                    onclick="openMeLeadDetailsModal(event, ${Number(item.id || 0)})"
                    title="View lead details"
                  >
                    <i class="fas fa-eye"></i> View
                  </button>
                </td>
              </tr>
            `;
          })
          .join("")
      : `<tr><td colspan="9" class="appointments-empty-row">${escapeMeHtml(emptyText)}</td></tr>`;

    return `
      <div class="table-wrapper">
        <table class="data-table">
          <thead>
            <tr>
              <th>Company</th>
              <th>Client</th>
              <th>Contact</th>
              <th>Date</th>
              <th>Time</th>
              <th>Meeting Type</th>
              <th>Location</th>
              <th>Status</th>
              <th>Details</th>
            </tr>
          </thead>
          <tbody>${bodyHtml}</tbody>
        </table>
      </div>
    `;
  }

  function formatMeLeadHumanLabel(value) {
    return String(value || "")
      .replace(/[_-]+/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .replace(/\b\w/g, (char) => char.toUpperCase());
  }

  function formatMeLeadCompanyScopeLabel(value) {
    const scope = normalizeMeLeadCompanyScope(value);
    if (scope === "redsea") return "Red Sea Digitals Pvt. Ltd";
    if (scope === "metrics") return "Metrics Mart Infoline Pvt Ltd";
    return value || "-";
  }

  function formatMeLeadDetailsValue(value) {
    const text = String(value ?? "").trim();
    return text || "-";
  }

  function formatMeLeadDetailsList(value) {
    const labels = parseMeStoredArray(value).map((item) => {
      const normalized = String(item || "").trim();
      if (normalized === "ads") return "Google Ads";
      if (normalized === "google_profile") return "Google Profile";
      return formatMeLeadHumanLabel(normalized);
    });

    return labels.length ? labels.join(", ") : "-";
  }
      
       function getMeLeadDealProducts(lead = {}) {
    return Array.isArray(lead.deal_products)
      ? lead.deal_products
      : Array.isArray(lead.dealProducts)
      ? lead.dealProducts
      : [];
  }

  function formatMeLeadDealProducts(lead = {}) {
    const products = getMeLeadDealProducts(lead);
    if (!products.length) {
      return escapeMeHtml(
        formatMeLeadDetailsList(lead.deal_services || lead.services),
      );
    }

    return products
      .map((product) => {
        const name = String(product.product_name || product.name || "").trim();
        const amount = Number(product.product_amount || product.amount || 0);
        const amountText =
          Number.isFinite(amount) && amount > 0
            ? ` - ${formatMeDashboardMoney(amount)}`
            : "";
        return escapeMeHtml(`${name || "Service"}${amountText}`);
      })
      .join("<br>");
  }

  function getMeLeadRenewalDetails(lead = {}) {
    return Array.isArray(lead.renewal_details)
      ? lead.renewal_details
      : Array.isArray(lead.renewalDetails)
      ? lead.renewalDetails
      : [];
  }

  function getMeLeadSourceRenewalDetails(lead = {}) {
    return Array.isArray(lead.source_renewal_details)
      ? lead.source_renewal_details
      : Array.isArray(lead.sourceRenewalDetails)
      ? lead.sourceRenewalDetails
      : [];
  }

  function getMeLeadRenewalLeads(lead = {}) {
    return Array.isArray(lead.renewal_leads)
      ? lead.renewal_leads
      : Array.isArray(lead.renewalLeads)
      ? lead.renewalLeads
      : [];
  }

  function formatMeLeadRenewalRows(rows = []) {
    if (!Array.isArray(rows) || !rows.length) return "-";

    return rows
      .map((item) => {
        const serviceName = String(item.service_name || item.serviceName || "Service").trim();
        const amount = Number(item.service_amount || item.amount || 0);
        const basis =
          item.renewal_basis_label ||
          formatMeLeadHumanLabel(item.renewal_basis || item.renewalBasis);
        const status = item.status_label || formatMeLeadHumanLabel(item.status || "active");
        const dueDate = item.renewal_due_date || item.next_start_date || "";
        const lastPaid = item.last_payment_date || "";
        const parts = [
          `${serviceName}${Number.isFinite(amount) && amount > 0 ? ` - ${formatMeDashboardMoney(amount)}` : ""}`,
          basis,
          status,
          dueDate ? `Due: ${formatDate(dueDate)}` : "",
          lastPaid ? `Last Paid: ${formatDate(lastPaid)}` : "",
        ].filter(Boolean);
        return escapeMeHtml(parts.join(" | "));
      })
      .join("<br>");
  }

  function formatMeLeadRenewalLeadRows(rows = []) {
    if (!Array.isArray(rows) || !rows.length) return "-";

    return rows
      .map((item) => {
        const status = formatMeLeadHumanLabel(item.lead_status || "active");
        const amount = Number(item.deal_amount || 0);
        const date = item.closed_date || item.created_date || "";
        const parts = [
          `#${Number(item.id || 0) || "-"}`,
          status,
          Number.isFinite(amount) && amount > 0 ? formatMeDashboardMoney(amount) : "",
          date ? formatDate(date) : "",
          item.closed_by_name ? `Closed By: ${item.closed_by_name}` : "",
        ].filter(Boolean);
        return escapeMeHtml(parts.join(" | "));
      })
      .join("<br>");
  }

  function hasMeLeadRenewalDetails(lead = {}) {
    return (
      String(lead.sales_type || "").toLowerCase().trim() === "renewal" ||
      Number(lead.renewal_source_lead_id || 0) > 0 ||
      Number(lead.renewal_count || 0) > 0 ||
      Number(lead.active_renewal_count || 0) > 0 ||
      Number(lead.renewal_closed_count || 0) > 0 ||
      getMeLeadRenewalDetails(lead).length > 0 ||
      getMeLeadSourceRenewalDetails(lead).length > 0 ||
      getMeLeadRenewalLeads(lead).length > 0
    );
  }
      
      

  function buildMeLeadDetailsMapValue(lead = {}) {
    const raw = String(lead.maps_lnk || lead.location || "").trim();
    if (!raw) return "-";

    const url = /^https?:\/\//i.test(raw)
      ? raw
      : `https://www.google.com/maps?q=${encodeURIComponent(raw)}`;

    return `
      <a href="${escapeMeHtml(url)}" target="_blank" rel="noopener noreferrer" class="location-link">
        View Location
      </a>
    `;
  }

  function renderMeLeadDetailsSection(title, rows = []) {
    const rowHtml = rows
      .map(([label, value, isHtml = false]) => {
        const content = isHtml
          ? value || "-"
          : escapeMeHtml(formatMeLeadDetailsValue(value));

        return `
          <div class="me-lead-detail-item">
            <span>${escapeMeHtml(label)}</span>
            <strong>${content}</strong>
          </div>
        `;
      })
      .join("");

    return `
      <section class="me-lead-detail-section">
        <h3>${escapeMeHtml(title)}</h3>
        <div class="me-lead-detail-grid">${rowHtml}</div>
      </section>
    `;
  }

  
  function renderMeLeadDetails(lead = {}) {
    const hasDealDetails =
      String(lead.lead_status || "")
        .toLowerCase()
        .trim() === "deal_closed" ||
      [
        lead.deal_amount,
        lead.deal_products_total,
        lead.payment_method,
        lead.payment_date,
        lead.closed_date,
        lead.pay_stat,
      ].some((value) => String(value ?? "").trim()) ||
      getMeLeadDealProducts(lead).length > 0;
    const sections = [
      renderMeLeadDetailsSection("Client", [
        ["Company", lead.company_name],
        ["Client", lead.client_name],
        ["Contact", lead.contact],
        ["Alternate Contact", lead.alternate_contact],
        ["Telephone", lead.telephone],
        ["Email", lead.email],
        ["GST Number", lead.gst_no],
      ]),
      renderMeLeadDetailsSection("Address", [
        ["Flat / Office", lead.flat_no],
        ["Building", lead.building_name],
        ["Locality", lead.locality],
        ["City", lead.city],
        ["Pincode", lead.pincode],
        ["State", lead.state],
        ["Map", buildMeLeadDetailsMapValue(lead), true],
      ]),
      renderMeLeadDetailsSection("Services", [
        ["Web", formatMeLeadDetailsList(lead.web_type)],
        ["SEO", formatMeLeadDetailsList(lead.seo_type)],
        ["SMO", formatMeLeadDetailsList(lead.smo_type)],
        ["App", formatMeLeadDetailsList(lead.app_type)],
        ["ERP/CRM", formatMeLeadDetailsList(lead.erp_type)],
        ["Other Services", formatMeLeadDetailsList(lead.services)],
        ["Service Notes", lead.service_notes],
      ]),
      renderMeLeadDetailsSection("Appointment", [
        ["Meeting Type", getMeMeetingTypeLabel(lead)],
        ["Google Meet Link", buildMeGoogleMeetLinkValue(lead), true],
        ["Date", formatMeAppointmentDate(lead.app_date)],
        ["Time", formatMeAppointmentTime(lead.app_time)],
        ["Assigned ME", lead.assigned_me_name || lead.me_name || lead.assign_emp],
        ["Status", getMeAppointmentStatus(lead).label],
        ["Source", formatMeLeadHumanLabel(lead.source_lead)],
        ["Industry", formatMeLeadHumanLabel(lead.industry_type)],
        ["Sales Type", formatMeLeadHumanLabel(lead.sales_type || "new")],
        ["Additional Notes", lead.additional_notes],
      ]),
    ];

    if (hasDealDetails) {
      const dealAmount = Number(lead.deal_amount || lead.deal_products_total || 0);
      const receivedAmount = getMeDealAchievedAmount(lead);
      const remainingAmount = getMeDealRemainingAmount(lead);
      const gstAmount = hasMeStoredAmount(lead.gst_amount)
        ? Number(lead.gst_amount || 0)
        : getMeInclusiveGstAmount(dealAmount);

      sections.push(
        renderMeLeadDetailsSection("Deal", [
          ["Deal Amount", formatMeDashboardMoney(dealAmount)],
          ["Down Payment", formatMeDashboardMoney(receivedAmount)],
          ["Remaining Amount", formatMeDashboardMoney(remainingAmount)],
          ["GST Amount", formatMeDashboardMoney(gstAmount)],
          [
            "Services",
            formatMeLeadDealProducts(lead),
            true,
          ],
          ["Payment Method", lead.payment_method],
          ["Payment Status", formatMeLeadHumanLabel(lead.pay_stat || "pending")],
          ["Payment Date", formatDate(lead.payment_date)],
          ["Closed Date", formatDate(lead.closed_date)],
          [
            "Closed By",
            lead.closed_by_name || lead.received_by || lead.closed_by,
          ],
          ["Created By", lead.created_by_name || lead.tme_name],
          ["Closed TME", lead.closed_tme_name || ""],
        ]),
      );
    }

    if (hasMeLeadRenewalDetails(lead)) {
      const renewalRows = [];
      const isRenewalLead =
        String(lead.sales_type || "").toLowerCase().trim() === "renewal" ||
        Number(lead.renewal_source_lead_id || 0) > 0;
      const configuredRenewals = getMeLeadRenewalDetails(lead);
      const sourceRenewals = getMeLeadSourceRenewalDetails(lead);
      const renewalLeads = getMeLeadRenewalLeads(lead);

      if (isRenewalLead) {
        renewalRows.push(["Type", "Renewal"]);
        if (Number(lead.renewal_source_lead_id || 0) > 0) {
          renewalRows.push(["Original Lead ID", lead.renewal_source_lead_id]);
        }
      }

      if (configuredRenewals.length) {
        renewalRows.push([
          "Services",
          formatMeLeadRenewalRows(configuredRenewals),
          true,
        ]);
      }

      if (sourceRenewals.length) {
        renewalRows.push([
          "Original Deal Services",
          formatMeLeadRenewalRows(sourceRenewals),
          true,
        ]);
      }

      if (renewalLeads.length) {
        renewalRows.push([
          "Renewal Leads",
          formatMeLeadRenewalLeadRows(renewalLeads),
          true,
        ]);
      }

      if (renewalRows.length) {
        sections.push(renderMeLeadDetailsSection("Renewal", renewalRows));
      }
    }

    return sections.join("");
  }
      
  async function openMeLeadDetailsModal(event, leadId) {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }

    const modal = document.getElementById("meLeadDetailsModal");
    const content = document.getElementById("meLeadDetailsContent");
    const normalizedLeadId = Number(leadId || 0);

    if (!modal || !content || !normalizedLeadId) return;

    const cachedLead = [
      ...meAppointmentsRows,
      ...(Array.isArray(meDashboardState?.deals) ? meDashboardState.deals : []),
      ...(Array.isArray(meDashboardState?.leads) ? meDashboardState.leads : []),
    ].find((item) => Number(item.id || 0) === normalizedLeadId);

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

      content.innerHTML = renderMeLeadDetails(result.data);
    } catch (err) {
      console.error("ME lead details load error:", err);
      if (cachedLead) {
        content.innerHTML = renderMeLeadDetails(cachedLead);
        return;
      }

      content.innerHTML = `
        <p class="no-data">${escapeMeHtml(err.message || "Unable to load lead details")}</p>
      `;
    }
  }

  function closeMeLeadDetailsModal() {
    const modal = document.getElementById("meLeadDetailsModal");
    if (!modal) return;

    modal.classList.remove("show");
    modal.classList.add("hidden");
    document.body.classList.remove("modal-open");
  }

  function handleMeLeadDetailsBackdrop(event) {
    if (event.target?.id === "meLeadDetailsModal") {
      closeMeLeadDetailsModal();
    }
  }

  function sortMeAppointmentsForDisplay(rows = []) {
    const todayKey = formatDateKey(new Date());

    return [...rows].sort((left, right) => {
      const leftDateKey = getMeAppointmentDateKey(left?.app_date);
      const rightDateKey = getMeAppointmentDateKey(right?.app_date);
      const leftRank = leftDateKey === todayKey ? 0 : 1;
      const rightRank = rightDateKey === todayKey ? 0 : 1;

      if (leftRank !== rightRank) return leftRank - rightRank;
      if (leftDateKey !== rightDateKey) {
        if (!leftDateKey) return 1;
        if (!rightDateKey) return -1;
        return leftDateKey.localeCompare(rightDateKey);
      }

      const timeCompare = String(left?.app_time || "").localeCompare(
        String(right?.app_time || ""),
      );
      return timeCompare || Number(left?.id || 0) - Number(right?.id || 0);
    });
  }

  function renderTodayAppointments(rows = []) {
    const container = document.getElementById("todayAppointmentsContainer");
    const summary = document.getElementById("todayAppointmentsSummary");
    const dateLabel = document.getElementById("todayAppointmentsDate");
    if (!container) return;

    const todayKey = formatDateKey(new Date());
    meAppointmentsRenderedDateKey = todayKey;
    const todayRows = rows
      .filter((item) => getMeAppointmentDateKey(item.app_date) === todayKey)
      .sort((left, right) => {
        const timeCompare = String(left.app_time || "").localeCompare(
          String(right.app_time || ""),
        );
        return timeCompare || Number(left.id || 0) - Number(right.id || 0);
      });

    container.innerHTML = buildMeAppointmentsTable(
      todayRows,
      "No appointments scheduled for today",
    );

    if (summary) {
      summary.textContent = `${todayRows.length} appointment${todayRows.length === 1 ? "" : "s"} today`;
    }

    if (dateLabel) {
      dateLabel.textContent = formatMeAppointmentDate(todayKey);
    }
  }

  function setupMeTodayAppointmentsAutoRefresh() {
    if (meTodayAppointmentRefreshTimer) {
      clearInterval(meTodayAppointmentRefreshTimer);
    }

    meAppointmentsRenderedDateKey = formatDateKey(new Date());
    meTodayAppointmentRefreshTimer = setInterval(() => {
      const currentDateKey = formatDateKey(new Date());
      if (currentDateKey === meAppointmentsRenderedDateKey) return;

      if (document.getElementById("appointments")?.classList.contains("active")) {
        fetchMEData();
        return;
      }

      renderTodayAppointments(meAppointmentsRows);
    }, ME_TODAY_APPOINTMENTS_REFRESH_MS);
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
    const employeeSelect = document.getElementById("meLeadAssignEmp");
    const companyScope = document.querySelector(
      '#meLeadForm [name="company_scope"]',
    );

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

    if (employeeSelect && !employeeSelect.dataset.companyScopeBound) {
      employeeSelect.addEventListener("change", () => {
        setMeLeadCompanyScopeFromSelectedEmployee(employeeSelect);
      });
      employeeSelect.dataset.companyScopeBound = "true";
    }

    if (companyScope && !companyScope.dataset.bound) {
      companyScope.addEventListener("change", () => loadMeLeadEmployees());
      companyScope.dataset.bound = "true";
    }

    bindMeLeadOtherInputs();
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
      field.value =
        normalizeMeLeadCompanyScope(value) || getDefaultMeLeadCompanyScope();
    }
  }

  function getMeLeadEmployeeCompanyScope(employee = {}) {
    return normalizeMeLeadCompanyScope(
      employee.company_scope ||
        employee.companyScope ||
        employee.company_key ||
        employee.companyKey ||
        employee.selected_company ||
        employee.comp_name ||
        employee.compName,
    );
  }

  function setMeLeadCompanyScopeFromSelectedEmployee(selectOrId) {
    const selectedEmployee = getSelectedMeLeadEmployeeMeta(selectOrId);
    if (selectedEmployee.companyScope) {
      setMeLeadCompanyScope(selectedEmployee.companyScope);
    }
  }

   async function openMeLeadForm() {
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
    await renderMeLeadProductCatalog(true);
    loadMeLeadEmployees();

    const firstField = form.querySelector("input, select, textarea, button");
    if (firstField) {
      setTimeout(() => firstField.focus(), 0);
    }

    // ── Duplicate contact check on blur ──
    const contactInput = document.getElementById("meLeadContactInput");
    const dupWarn = document.getElementById("meLeadContactDupWarn");
    const dupName = document.getElementById("meLeadContactDupName");
    if (contactInput && dupWarn && dupName) {
      contactInput.removeEventListener("blur", contactInput._meDupCheckFn);
      contactInput._meDupCheckFn = async function () {
        const val = contactInput.value.trim();
        dupWarn.style.display = "none";
        dupName.textContent = "";
        if (!val || val.replace(/\D/g, "").length < 7) return;
        try {
          const excludeParam = editingMeLeadId ? `&excludeId=${editingMeLeadId}` : "";
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
      contactInput.addEventListener("blur", contactInput._meDupCheckFn);
    }

    // ── Duplicate alt-contact check on blur ──
    const altContactInput = document.getElementById("meLeadAltContactInput");
    const altDupWarn = document.getElementById("meLeadAltContactDupWarn");
    const altDupName = document.getElementById("meLeadAltContactDupName");
    if (altContactInput && altDupWarn && altDupName) {
      altContactInput.removeEventListener("blur", altContactInput._meAltDupCheckFn);
      altContactInput._meAltDupCheckFn = async function () {
        const val = altContactInput.value.trim();
        altDupWarn.style.display = "none";
        altDupName.textContent = "";
        if (!val || val.replace(/\D/g, "").length < 7) return;
        try {
          const excludeParam = editingMeLeadId ? `&excludeId=${editingMeLeadId}` : "";
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
      altContactInput.addEventListener("blur", altContactInput._meAltDupCheckFn);
    }
  }

  async function openMeLeadEditForm(leadId) {
    const normalizedLeadId = Number(leadId || 0);
    if (!normalizedLeadId) return;

    try {
      const res = await fetch(`${BASE_URL}/api/leads/${normalizedLeadId}`, {
        cache: "no-store",
      });
      const result = await res.json();

      if (!res.ok || !result.success || !result.data) {
        throw new Error(result.message || "Unable to load lead details");
      }

      const modal = document.getElementById("meLeadModal");
      const form = document.getElementById("meLeadForm");
      if (!modal || !form) return;

      resetMeLeadFormState();
      editingMeLeadId = result.data.id || normalizedLeadId;
      currentMeEditingLeadData = result.data;
      setMeLeadFormMode("edit");
      await populateMeLeadFormFromDeal(result.data);

      modal.classList.remove("hidden");
      modal.classList.add("show");
      document.body.classList.add("modal-open");
      form.scrollTop = 0;

      const firstField = form.querySelector("input, select, textarea, button");
      if (firstField) {
        setTimeout(() => firstField.focus(), 0);
      }
    } catch (err) {
      console.error("ME lead edit load error:", err);
      showPopup("Error", err.message || "Unable to open lead editor", false);
    }
  }

  function closeMeLeadForm() {
    const modal = document.getElementById("meLeadModal");
    if (!modal) return;

    if (modal.contains(document.activeElement)) {
      document.activeElement.blur();
      document.getElementById("meAddClientBtn")?.focus({ preventScroll: true });
    }
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
    section.setAttribute("aria-hidden", shouldShow ? "false" : "true");
  }

  function toggleMeLeadActionSections() {
    const actionType =
      document.getElementById("meLeadActionType")?.value || "lead";
    const appointmentSection = document.getElementById(
      "meLeadAppointmentSection",
    );
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
    const isFollowup = actionType === "followup";

    setMeLeadSectionVisibility(appointmentSection, isAppointment);
    setMeLeadSectionVisibility(followupSection, isFollowup);

    appointmentFields.forEach((field) => {
      if (field) field.required = isAppointment;
    });

    followupFields.forEach((field) => {
      if (field) field.required = isFollowup;
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
    editingMeLeadId = null;
    currentMeEditingLeadData = null;
    meRenewalAttribution = null;

    if (form) {
      form.reset();
      setMeLeadCompanyScope();
    }

    bindMeLeadOtherInputs();
    ["source_lead", "industry_type"].forEach(updateMeLeadOtherInput);

    if (form?.elements?.sales_type) {
      form.elements.sales_type.value = "new";
    }

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

    if (modalTitle) {
      modalTitle.textContent = "Add Client";
    }

    toggleMeLeadActionSections();
  }

  function setMeLeadFormMode(mode) {
    const modalTitle = document.getElementById("meLeadModalTitle");
    const submitBtn = document.getElementById("meLeadSubmitBtn");
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
      submitBtn.disabled = false;
      submitBtn.textContent = isEditMode
        ? "Update Client"
        : isRenewalMode
          ? "Create Renewal"
          : "Add Client";
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
      const employeeName = employee.name || "Unnamed Employee";
      const employeeCompanyScope = getMeLeadEmployeeCompanyScope(employee);
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
      option.dataset.employeeId = employee.id != null ? String(employee.id) : "";
      option.dataset.employeeContact = employee.contact
        ? String(employee.contact)
        : "";
      option.dataset.employeeCompanyScope = employeeCompanyScope;
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

  function getMeLeadEmployeeRows(employees = []) {
    if (employees.length) return employees;

    if (
      String(currentUser?.role || "")
        .toLowerCase()
        .trim() === "me" &&
      currentUser?.name
    ) {
      return [
        {
          id: currentUser.id || "",
          name: currentUser.name,
          contact: currentUser.contact || "",
          comp_name:
            currentUser.comp_name ||
            currentUser.company_scope ||
            currentUser.selected_company ||
            "",
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

  function formatMeLeadInputDate(value) {
    return value ? String(value).slice(0, 10) : "";
  }

  function formatMeLeadInputTime(value) {
    return value ? String(value).slice(0, 5) : "";
  }

  function normalizeMeLeadFormSalesType(value) {
    const normalized = String(value || "")
      .toLowerCase()
      .trim();
    return normalized === "renewal" ? "renewal" : "new";
  }

  function getMeLeadOtherInput(name) {
    return document.querySelector(`#meLeadForm [name="${name}_other"]`);
  }

  function updateMeLeadOtherInput(name) {
    const select = document.querySelector(`#meLeadForm [name="${name}"]`);
    const input = getMeLeadOtherInput(name);
    if (!select || !input) return;

    const shouldShow = select.value === "other";
    input.classList.toggle("hidden", !shouldShow);
    input.required = shouldShow;
    input.disabled = !shouldShow;
    if (!shouldShow) input.value = "";
  }

  function bindMeLeadOtherInputs() {
    ["source_lead", "industry_type"].forEach((name) => {
      const select = document.querySelector(`#meLeadForm [name="${name}"]`);
      if (!select || select.dataset.otherBound) return;
      select.addEventListener("change", () => updateMeLeadOtherInput(name));
      select.dataset.otherBound = "true";
      updateMeLeadOtherInput(name);
    });
  }

  function setMeLeadOtherAwareSelectValue(name, value) {
    const select = document.querySelector(`#meLeadForm [name="${name}"]`);
    const input = getMeLeadOtherInput(name);
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

    updateMeLeadOtherInput(name);
  }

  function getMeLeadOtherAwareFormValue(formData, name) {
    const selected = String(formData.get(name) || "").trim();
    if (selected !== "other") return selected;

    return String(formData.get(`${name}_other`) || "").trim() || selected;
  }

  function getMeEditingLeadFallback(fieldName, fallback = null) {
    if (!currentMeEditingLeadData) return fallback;
    return currentMeEditingLeadData[fieldName] ?? fallback;
  }

  function setMeLeadCheckboxGroup(name, values) {
    const selectedItems = parseMeStoredArray(values).map((item) => String(item));
    const selectedValues = new Set(selectedItems);
    const normalizedSelectedValues = new Set(
      selectedItems.map(normalizeMeLeadProductMatchValue).filter(Boolean),
    );

    document.querySelectorAll(`#meLeadForm [name="${name}"]`).forEach((input) => {
      const aliases = [
        input.value,
        ...(input.dataset.productAliases || "").split("|"),
      ].filter(Boolean);

      input.checked = aliases.some(
        (alias) =>
          selectedValues.has(alias) ||
          normalizedSelectedValues.has(normalizeMeLeadProductMatchValue(alias)),
      );
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
      setMeLeadCompanyScopeFromSelectedEmployee(select);
    }
  }

  async function fetchMeLeadEmployeeList(date, time) {
    const params = new URLSearchParams();

    if (date && time) {
      params.set("date", date);
      params.set("time", time);
    }

    const endpoint =
      date && time
        ? `${BASE_URL}/api/available-employees?${params.toString()}`
        : `${BASE_URL}/api/me-employees`;

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
    const normalizedActionType = String(lead.action_type || "")
      .toLowerCase()
      .trim();
    const actionTypeValue = ["appointment", "followup"].includes(
      normalizedActionType,
    )
      ? normalizedActionType
      : "lead";

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
    setMeLeadFormValue("sales_type", normalizeMeLeadFormSalesType(lead.sales_type));
    bindMeLeadOtherInputs();
    setMeLeadOtherAwareSelectValue("source_lead", lead.source_lead);
    setMeLeadOtherAwareSelectValue("industry_type", lead.industry_type);
    setMeLeadFormValue("service_notes", lead.service_notes);
    await renderMeLeadProductCatalog(true);
    setMeLeadCheckboxGroup("web_type[]", lead.web_type);
    setMeLeadCheckboxGroup("seo_type[]", lead.seo_type);
    setMeLeadCheckboxGroup("smo_type[]", lead.smo_type);
    setMeLeadCheckboxGroup("app_type[]", lead.app_type);
    setMeLeadCheckboxGroup("erp_type[]", lead.erp_type);
    setMeLeadCheckboxGroup("services[]", lead.services);
    setMeLeadFormValue("actionType", actionTypeValue);
    const actionType = document.getElementById("meLeadActionType");
    if (actionType) actionType.value = actionTypeValue;
    setMeLeadFormValue("app_date", formatMeLeadInputDate(lead.app_date));
    setMeLeadFormValue("app_time", formatMeLeadInputTime(lead.app_time));
    setMeLeadFormValue("location", lead.location || lead.maps_lnk);
    setMeLeadFormValue("follow_date", formatMeLeadInputDate(lead.follow_date));
    setMeLeadFormValue("follow_time", formatMeLeadInputTime(lead.follow_time));
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
        throw new Error(result.message || "Failed to load lead details");
      }

      const lead = result.data;
      const currentUserId = hydrateCurrentUserIdentity();

      // Check if renewal is already started or closed
      if (Number(lead.renewal_count || 0) > 0 || Number(lead.renewal_closed_count || 0) > 0) {
        showPopup("Renewal", "Renewal is already started or completed for this deal.", false);
        return;
      }

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
        company_scope: lead.company_scope || "unassigned",
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

      showPopup("Success", "Renewal started successfully! Client lead created.", true);
      fetchDeals(); // Refresh the deals table to reflect changes
    } catch (err) {
      console.error("ME renewal lead start error:", err);
      showPopup(
        "Renewal Error",
        err.message || "Server error while starting renewal",
        false,
      );
    }
  }

  async function handleMeLeadFormSubmit(event) {
    event.preventDefault();

    if (meLeadSubmitting) return;

    const formElement = event.currentTarget;
    const formData = new FormData(formElement);
    const isEditMode = Boolean(editingMeLeadId);
    const storedActionType = String(
      getMeEditingLeadFallback("action_type", "lead") || "lead",
    )
      .toLowerCase()
      .trim();
    const actionTypeValue =
      document.getElementById("meLeadActionType")?.value ||
      (isEditMode && ["appointment", "followup"].includes(storedActionType)
        ? storedActionType
        : "lead");
    const selectedEmployee = getSelectedMeLeadEmployeeMeta("meLeadAssignEmp");
    const currentUserId = hydrateCurrentUserIdentity();
    const submitBtn = document.getElementById("meLeadSubmitBtn");
    const originalText = submitBtn ? submitBtn.innerHTML : "";
    const mapsLink =
      document.getElementById("meLeadMapsLink")?.value ||
      getMeEditingLeadFallback("maps_lnk", "") ||
      "";
    const locationValue =
      formData.get("location") ||
      getMeEditingLeadFallback("location", "") ||
      mapsLink ||
      "";
    const salesTypeValue = formData.get("sales_type") || "new";
    const renewalCreator =
      !isEditMode && salesTypeValue === "renewal" ? meRenewalAttribution : null;
    const appointmentDateValue =
      actionTypeValue === "appointment"
        ? formData.get("app_date") || getMeEditingLeadFallback("app_date", null)
        : null;
    const appointmentTimeValue =
      actionTypeValue === "appointment"
        ? formData.get("app_time") || getMeEditingLeadFallback("app_time", null)
        : null;
    const appointmentEmployeeName =
      actionTypeValue === "appointment"
        ? selectedEmployee.name || getMeEditingLeadFallback("assign_emp", null)
        : null;
    const appointmentEmployeeId =
      actionTypeValue === "appointment"
        ? selectedEmployee.id || getMeEditingLeadFallback("assign_emp_id", null)
        : null;
    const appointmentEmployeeContact =
      actionTypeValue === "appointment"
        ? selectedEmployee.contact ||
          getMeEditingLeadFallback("assign_emp_contact", null)
        : null;

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
      source_lead: getMeLeadOtherAwareFormValue(formData, "source_lead"),
      industry_type: getMeLeadOtherAwareFormValue(formData, "industry_type"),
      sales_type: salesTypeValue,
      renewal_source_lead_id: isEditMode
        ? getMeEditingLeadFallback("renewal_source_lead_id", null)
        : renewalCreator?.sourceLeadId || null,
      web_type: formData.getAll("web_type[]"),
      seo_type: formData.getAll("seo_type[]"),
      smo_type: formData.getAll("smo_type[]"),
      app_type: formData.getAll("app_type[]"),
      erp_type: formData.getAll("erp_type[]"),
      services: formData.getAll("services[]"),
      service_notes: formData.get("service_notes"),
      actionType: actionTypeValue,
      app_date: appointmentDateValue,
      app_time: appointmentTimeValue,
      assign_emp: appointmentEmployeeName,
      assign_emp_id: appointmentEmployeeId,
      assign_emp_contact: appointmentEmployeeContact,
      location: actionTypeValue === "appointment" ? locationValue : null,
      meeting_type: isEditMode
        ? getMeEditingLeadFallback("meeting_type", null)
        : null,
      google_meet_link: isEditMode
        ? getMeEditingLeadFallback("google_meet_link", null)
        : null,
      appointment_status: isEditMode
        ? getMeEditingLeadFallback("appointment_status", null)
        : null,
      follow_date:
        actionTypeValue === "followup" ? formData.get("follow_date") : null,
      follow_time:
        actionTypeValue === "followup" ? formData.get("follow_time") : null,
      reason: actionTypeValue === "followup" ? formData.get("reason") : null,
      additional_notes: formData.get("additional_notes"),
      created_by: isEditMode
        ? getMeEditingLeadFallback("created_by", currentUserId || null)
        : renewalCreator?.createdBy || currentUserId || null,
      user_id: isEditMode
        ? getMeEditingLeadFallback("created_by", currentUserId || null)
        : renewalCreator?.createdBy || currentUserId || null,
      created_by_name: isEditMode
        ? getMeEditingLeadFallback("created_by_name", currentUser?.name || "")
        : renewalCreator?.createdByName || currentUser?.name || "",
      company_scope:
        formData.get("company_scope") ||
        getMeEditingLeadFallback("company_scope", "") ||
        getDefaultMeLeadCompanyScope(),
      notify_whatsapp: false,
    };

    meLeadSubmitting = true;

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = isEditMode ? "Updating..." : "Saving...";
    }

    try {
      const res = await fetch(
        isEditMode
          ? `${BASE_URL}/api/leads/${editingMeLeadId}`
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

      if (!res.ok || !result.success) {
        const errorDetails = result.error ? ` (${result.error})` : "";
        throw new Error(
          `${result.message || "Failed to save client"}${errorDetails}`,
        );
      }

      closeMeLeadForm();
      showPopup(
        "Success",
        isEditMode ? "Client updated successfully" : "Client added successfully",
        true,
      );
      loadMeLeads();
      loadMeDashboard();
      if (
        actionTypeValue === "appointment" &&
        document.getElementById("appointments")?.classList.contains("active")
      ) {
        fetchMEData();
      }
      if (
        actionTypeValue === "followup" &&
        document.getElementById("followups")?.classList.contains("active")
      ) {
        fetchFollowups();
      }
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
      .map((value) =>
        String(value || "")
          .trim()
          .toLowerCase(),
      )
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

  function normalizeMeLeadProductMatchValue(value) {
    return String(value || "")
      .toLowerCase()
      .trim()
      .replace(/&/g, "and")
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");
  }

  function getMeLeadProductFieldName(groupName = "") {
    const group = normalizeMeLeadProductMatchValue(groupName);

    if (group === "web_design_and_development") return "web_type[]";
    if (group === "seo") return "seo_type[]";
    if (group === "smo") return "smo_type[]";
    if (group === "application") return "app_type[]";
    if (group === "erp_crm_software") return "erp_type[]";

    return "services[]";
  }

  function getMeLeadProductAliases(product = {}) {
    const name = String(product.name || "").trim();
    const group = normalizeMeLeadProductMatchValue(product.group);
    const normalizedName = normalizeMeLeadProductMatchValue(name);
    const aliases = new Set([name, normalizedName].filter(Boolean));

    const addAlias = (value) => {
      const normalized = normalizeMeLeadProductMatchValue(value);
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

    return Array.from(aliases)
      .map((alias) => normalizeMeLeadProductMatchValue(alias))
      .filter(Boolean);
  }

  async function renderMeLeadProductCatalog(forceRefresh = false) {
    const container = document.getElementById("meLeadProductCatalog");
    if (!container) return;

    container.innerHTML = `<div class="lead-products-empty">Loading active products...</div>`;

    try {
      const catalog = await fetchDealProductCatalog(forceRefresh);
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
              <h4>${escapeMeHtml(groupName)}</h4>
              <div class="checkbox-group">
                ${products
                  .map((product) => {
                    const fieldName = getMeLeadProductFieldName(groupName);
                    const aliases = getMeLeadProductAliases(product).join("|");
                    return `
                      <label>
                        <input
                          type="checkbox"
                          name="${fieldName}"
                          value="${escapeMeHtml(product.name)}"
                          data-product-aliases="${escapeMeHtml(aliases)}"
                        >
                        ${escapeMeHtml(product.name)}
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
      console.error("ME lead products load error:", err);
      container.innerHTML = `
        <div class="lead-products-empty error">
          ${escapeMeHtml(err.message || "Unable to load active products.")}
        </div>
      `;
    }
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
        const amount = normalizeMeDashboardNumber(getMeDealAchievedAmount(deal));
        const key = getDealIdentityKey(deal);
        const explicitSalesType = String(
          deal?.sales_type || deal?.salesType || "",
        )
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

  function updateMeTargetProgressInsights(target, achieved, remaining, options = {}) {
    const monthlyDealsCount = Number(options.dealsCount);
    const dealsCount = normalizeMeDashboardNumber(
      Number.isFinite(monthlyDealsCount)
        ? monthlyDealsCount
        : (meDashboardState.counts?.deals ?? meDashboardState.deals?.length),
    );
    const salesMix = meDashboardState.salesMix || {};
    const achievedPercent =
      target > 0 ? Math.min((achieved / target) * 100, 100).toFixed(1) : "0.0";

    setSalesTargetText(
      "meTargetHeroValue",
      `${formatSalesTargetMoney(achieved)} without GST achieved`,
    );

    let heroText =
      "Start closing deals to build momentum for your monthly target.";
    if (target > 0 && achieved > 0) {
      heroText =
        remaining === 0 && achieved >= target
          ? `Target completed. You are now ahead by ${formatSalesTargetMoney(Math.max(achieved - target, 0))}.`
          : `${formatSalesTargetMoney(remaining)} left to reach ${formatSalesTargetMoney(target)} this month.`;
    } else if (target > 0) {
      heroText = `Your current monthly goal is ${formatSalesTargetMoney(target)}. Close the first deal to get this ring moving.`;
    }

    setSalesTargetText("meTargetHeroText", heroText);
    setSalesTargetText(
      "meTargetInsightAchieved",
      formatSalesTargetMoney(achieved),
    );
    setSalesTargetText(
      "meTargetInsightAchievedHint",
      `${achievedPercent}% completed without GST`,
    );
    setSalesTargetText(
      "meTargetInsightRemaining",
      formatSalesTargetMoney(remaining),
    );
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
    setSalesTargetMetricLabel(`${prefix}TargetSet`, "Commission Rate");
    setSalesTargetMetricLabel(`${prefix}TargetAchieved`, "Sales Closed");
    setSalesTargetMetricLabel(`${prefix}TargetRemaining`, "Commission");
    setSalesTargetText(`${prefix}TargetSet`, `${commissionPercent.toFixed(0)}%`);
    setSalesTargetText(`${prefix}TargetSetHint`, "Flat on closed sales");
    setSalesTargetText(
      `${prefix}TargetAchieved`,
      formatSalesTargetMoney(achieved),
    );
    setSalesTargetText(
      `${prefix}TargetRemaining`,
      formatSalesTargetMoney(commissionAmount),
    );
    setSalesTargetText(`${prefix}TargetAchievedHint`, "No monthly target");
    setSalesTargetText(
      `${prefix}TargetRemainingHint`,
      "Auto-calculated commission",
    );

    if (prefix === "me") {
      const totalContract = Number(data.totalContractValue || 0);
      const paidWithoutGst = Number(data.paidWithoutGst || 0);
      setSalesTargetText(`${prefix}TargetContract`, formatSalesTargetMoney(totalContract));
      setSalesTargetText(`${prefix}TargetContractHint`, "Total value of closed deals");
      setSalesTargetText(`${prefix}TargetWithoutGst`, formatSalesTargetMoney(paidWithoutGst));
      setSalesTargetText(`${prefix}TargetWithoutGstHint`, "Paid amount excluding GST");

      setSalesTargetText(
        "meTargetProgressLabel",
        `${commissionPercent.toFixed(0)}% commission`,
      );
      setSalesTargetMetricLabel("meTargetInsightAchieved", "Sales Closed");
      setSalesTargetMetricLabel("meTargetInsightRemaining", "Commission");
      updateMeTargetProgressInsights(0, achieved, 0);
      setSalesTargetText(
        "meTargetHeroValue",
        `${formatSalesTargetMoney(commissionAmount)} commission`,
      );
      setSalesTargetText(
        "meTargetHeroText",
        achieved > 0
          ? `${formatSalesTargetMoney(achieved)} closed sales par ${commissionPercent.toFixed(0)}% commission.`
          : "Commission profile par monthly target nahi hai. Closed sales par flat 10% commission milega.",
      );
      setSalesTargetText(
        "meTargetInsightAchieved",
        formatSalesTargetMoney(achieved),
      );
      setSalesTargetText("meTargetInsightAchievedHint", "Commissionable sales");
      setSalesTargetText(
        "meTargetInsightRemaining",
        formatSalesTargetMoney(commissionAmount),
      );
      setSalesTargetText("meTargetInsightRemainingHint", "Estimated payout");
      renderMeTargetProgressChart(achieved || 1, commissionAmount, {
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
    const targetText = formatSalesTargetMoney(target);
    currentMonthlyTarget = target;
    const achievedPercent =
      target > 0
        ? Math.min((targetAchieved / target) * 100, 100).toFixed(1)
        : "0.0";
    const targetSource = String(data.targetSource || "").toLowerCase();
    const salaryBasis = Number(data.targetBasis?.salary ?? data.salary ?? 0);
    const targetMultiplier = Number(data.targetBasis?.multiplier || 7);
    const isSalaryTarget = targetSource === "salary_7x" && salaryBasis > 0;

    setSalesTargetMetricLabel(`${prefix}TargetSet`, "Target Set");
    setSalesTargetMetricLabel(`${prefix}TargetAchieved`, "Total Received Payment");
    setSalesTargetMetricLabel(`${prefix}TargetRemaining`, "Remaining Target");
    setSalesTargetMetricLabel("meTargetInsightAchieved", "Without GST Achieved");
    setSalesTargetMetricLabel("meTargetInsightRemaining", "Remaining");
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
    setSalesTargetText(`${prefix}TargetSet`, formatSalesTargetMoney(target));
    setSalesTargetText(
      `${prefix}TargetSetHint`,
      isSalaryTarget
        ? `${formatSalesTargetMoney(salaryBasis)} salary x ${targetMultiplier}`
        : "Current monthly goal",
    );

    setSalesTargetText(
      `${prefix}TargetAchieved`,
      formatSalesTargetMoney(achieved),
    );
    setSalesTargetText(
      `${prefix}TargetRemaining`,
      formatSalesTargetMoney(remaining),
    );
    setSalesTargetText(
      `${prefix}TargetAchievedHint`,
      `${achievedPercent}% with GST`,
    );
    setSalesTargetText(
      `${prefix}TargetRemainingHint`,
      remaining === 0 && targetAchieved >= target
        ? "Monthly target achieved"
        : `Pending from ${targetText}`,
    );

    if (prefix === "me") {
      const totalContract = Number(data.totalContractValue || 0);
      setSalesTargetText(`${prefix}TargetContract`, formatSalesTargetMoney(totalContract));
      setSalesTargetText(`${prefix}TargetContractHint`, "Total value of closed deals");
      setSalesTargetText(`${prefix}TargetWithoutGst`, formatSalesTargetMoney(paidWithoutGst));
      setSalesTargetText(`${prefix}TargetWithoutGstHint`, "Target basis amount");

      setSalesTargetText("meTargetProgressLabel", `${achievedPercent}% achieved`);
      updateMeTargetProgressInsights(target, targetAchieved, remaining, {
        dealsCount: data.dealsCount,
      });
      renderMeTargetProgressChart(target, targetAchieved);
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
    if (
      event.key === "Escape" &&
      !document.getElementById("meLeadDetailsModal")?.classList.contains("hidden")
    ) {
      closeMeLeadDetailsModal();
      return;
    }

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
        const amount = formatMeDashboardMoney(getMeDealAchievedAmount(deal));
        return `
          <tr>
            <td>${escapeMeHtml(deal.company_name || "-")}</td>
            <td>${escapeMeHtml(deal.client_name || "-")}</td>
            <td>${escapeMeHtml(amount)}</td>
            <td>${escapeMeHtml(deal.payment_method || "-")}</td>
            <td>${escapeMeHtml(formatDate(deal.closed_date))}</td>
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
    const dealsCount = normalizeMeDashboardNumber(
      counts.deals ?? dealRows.length,
    );
    const totalSales = dealRows.reduce(
      (sum, deal) => sum + normalizeMeDashboardNumber(getMeDealAchievedAmount(deal)),
      0,
    );
    const funnelLeads = Math.max(leadsCount, appointments, followups, dealsCount);
    const conversionRate =
      funnelLeads > 0 ? ((dealsCount / funnelLeads) * 100).toFixed(1) : "0.0";

    setMeDashboardText("meDashboardSales", formatMeDashboardMoney(totalSales));
    setMeDashboardText(
      "meDashboardSalesHint",
      dealsCount
        ? `${dealsCount} closed deal${dealsCount === 1 ? "" : "s"}`
        : "From closed deals",
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
        ? `In ${formatAttendanceTime(todayRow.check_in)} / Out ${getAttendanceCheckoutDisplay(todayRow)}`
        : "Check out missing"
      : hasAttendanceCheckIn
        ? `In ${formatAttendanceTime(todayRow.check_in)} / Out ${getAttendanceCheckoutDisplay(todayRow)}`
        : "Check in pending";

    setMeDashboardText("meDashboardAttendance", attendanceStatus);
    setMeDashboardText("meDashboardAttendanceTime", attendanceTime);

    renderMeDashboardChart({ appointments, followups, deals: dealsCount });
    renderMeRecentDeals(dealRows);
  }

  async function loadMeDashboard(selectedMonth) {
    if (!currentUser?.id) return;

    const activeMonth =
      selectedMonth ||
      document.getElementById("dashboardMonthFilterME")?.value ||
      getCurrentMonthKey();

    // Set the month input value
    const monthInput = document.getElementById("dashboardMonthFilterME");
    if (monthInput) {
      monthInput.value = activeMonth;
    }

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

      const dealRows =
        deals?.success && Array.isArray(deals.data) ? deals.data : [];

      // Filter dealRows to match the selected month
      const filteredDealRows = dealRows.filter(deal => {
        const dealMonth = deal.closed_date ? deal.closed_date.substring(0, 7) : "";
        return dealMonth === activeMonth;
      });

      meDashboardState.deals = filteredDealRows;
      meDashboardState.salesMix = summarizeDealMix(filteredDealRows);

      const attendanceRows =
        attendance?.success && Array.isArray(attendance.data)
          ? attendance.data
          : [];
      const today = getAttendanceServerToday(attendance);
      meDashboardState.attendanceToday =
        attendanceRows.find((row) => row.attendance_date === today) || null;

      await loadMeSalesTargetSummary(filteredDealRows, activeMonth);
      renderMeDashboard();
      await loadMeMonthlyHistoryChart();
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

  async function fetchMonthlyTargetSummary(month) {
    if (!currentUser?.id) {
      return { target: currentMonthlyTarget || MONTHLY_TARGET };
    }

    try {
      const params = new URLSearchParams({
        userId: currentUser.id,
        role: currentUser.role || "me",
      });
      if (month) {
        params.append("month", month);
      }
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

  async function loadMeSalesTargetSummary(deals = [], activeMonth) {
    const dealRows = Array.isArray(deals) ? deals : [];
    const targetSummary = await fetchMonthlyTargetSummary(activeMonth);
    const localContractValue = dealRows.reduce(
      (sum, deal) => sum + getMeDealContractAmount(deal),
      0,
    );
    const localReceivedPayment = dealRows.reduce(
      (sum, deal) => sum + getMeDealAchievedAmount(deal),
      0,
    );
    const localPaidWithoutGst = dealRows.reduce(
      (sum, deal) => sum + getMeDealPaidWithoutGst(deal),
      0,
    );
    const targetValue = Number(targetSummary?.target);
    const target =
      Number.isFinite(targetValue) && targetValue > 0
        ? targetValue
        : currentMonthlyTarget || MONTHLY_TARGET;
    const achieved = Number(
      targetSummary?.achieved ?? localReceivedPayment,
    );
    const totalContractValue = Number(
      targetSummary?.totalContractValue ?? localContractValue,
    );
    const paidWithoutGst = Number(
      targetSummary?.paidWithoutGst ?? localPaidWithoutGst,
    );
    const targetAchieved = Number(
      targetSummary?.targetAchieved ??
        targetSummary?.targetBasisAmount ??
        paidWithoutGst,
    );
    const hasServerTarget = Number(targetSummary?.target || 0) > 0;
    const remaining = Number(
      hasServerTarget && targetSummary?.remaining !== undefined
        ? targetSummary.remaining
        : Math.max(target - targetAchieved, 0),
    );

    applySalesTargetSummary("me", {
      ...targetSummary,
      target,
      achieved,
      targetAchieved,
      totalContractValue,
      paidWithoutGst,
      remaining,
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

  function openMeDealDetailsFromRow(event, leadId) {
    const interactiveTarget = event?.target?.closest?.(
      "button, a, select, input, textarea, label, option",
    );
    if (interactiveTarget) return;

    openMeLeadDetailsModal(event, leadId);
  }

     function getMeDealSalesTypeValue(deal = {}, monthKey = "") {
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

 function formatMeDealClosedAndRenewalCell(deal = {}, monthKey = "") {
    const closedDateStr = deal.closed_date || deal.payment_date || deal.created_at;
    const closedFormatted = closedDateStr ? formatDate(closedDateStr) : "-";

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
      const renewalFormatted = formatDate(renewalDateStr);
      return `<div>${escapeMeHtml(closedFormatted)}</div><div style="font-size: 11px; color: #059669; font-weight: 600; white-space: nowrap; margin-top: 2px;">Renewal: ${escapeMeHtml(renewalFormatted)}</div>`;
    }

    return escapeMeHtml(closedFormatted);
  }


  function formatMeDealSalesTypeLabel(deal = {}) {
    return getMeDealSalesTypeValue(deal) === "renewal" ? "Renewal" : "Fresh";
  }

  function meDealMatchesSelectedType(deal = {}, selectedType = "all") {
    if (!selectedType || selectedType === "all") return true;
    return getMeDealSalesTypeValue(deal) === selectedType;
  }

  function getMeDealReceivedAmount(deal = {}) {
    const explicitValues = [
      deal.received_amount,
      deal.amount_received,
      deal.payment_amount,
      deal.received_total,
    ];
    const explicitValue = explicitValues.find(hasMeStoredAmount);
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

  function hasMeStoredAmount(value) {
    return value !== undefined && value !== null && String(value).trim() !== "";
  }

  function getMeDealAchievedAmount(deal = {}) {
    if (
      hasMeStoredAmount(deal.received_amount) &&
      (Number(deal.received_amount || 0) > 0 ||
        String(deal.pay_stat || "").toLowerCase().trim() !== "received")
    ) {
      return Number(deal.received_amount || 0);
    }

    return getMeDealReceivedAmount(deal);
  }

  function getMeDealContractAmount(deal = {}) {
    return Number(deal.deal_amount || 0);
  }

  function getMeDealPaidWithoutGst(deal = {}) {
    const received = getMeDealReceivedAmount(deal);
    return received > 0 ? Math.round((received / 1.18) * 100) / 100 : 0;
  }

  function getMeDealRemainingAmount(deal = {}) {
    if (hasMeStoredAmount(deal.remaining_amount)) {
      return Number(deal.remaining_amount || 0);
    }

    return Math.max(
      Number(deal.deal_amount || 0) - getMeDealAchievedAmount(deal),
      0,
    );
  }

  function getMeInclusiveGstAmount(amount) {
    const numericAmount = Number(amount || 0);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) return 0;
    return numericAmount - (numericAmount / 1.18);
  }

        async function fetchDeals() {
    if (!currentUser || !currentUser.id) return;

    try {
      const res = await fetch(`${BASE_URL}/api/deals/${currentUser.id}`);
      const data = await res.json();

      const container = document.getElementById("dealsContainer");
      const rawDealRows =
        data.success && Array.isArray(data.data) ? data.data : [];
      const selectedType =
        document.getElementById("dealsTypeFilterME")?.value || "all";
      const selectedMonth =
        document.getElementById("dealsMonthFilterME")?.value;

      let dealRows = rawDealRows;
      
      if (selectedMonth) {
        dealRows = dealRows.filter((deal) => isDealMatchingMonth(deal, selectedMonth));
      }

      dealRows = dealRows.filter((deal) =>
        meDealMatchesSelectedType(deal, selectedType, selectedMonth)
      );

      meDashboardState.deals = rawDealRows;
      meDashboardState.salesMix = summarizeDealMix(rawDealRows);
      await loadMeSalesTargetSummary(rawDealRows);

      if (!data.success || rawDealRows.length === 0) {
        container.innerHTML = `<p class="no-data">No Deals Found</p>`;
        return;
      }

      if (!dealRows.length) {
        const filterLabel = selectedType === "renewal" ? "Renewal" : selectedType === "fresh" ? "Fresh" : "";
        container.innerHTML = `<p class="no-data">No ${filterLabel} Deals Found</p>`;
        return;
      }

      let table = `
        <table class="data-table">
          <thead>
            <tr>
              <th>Company</th>
              <th>Client</th>
              <th>Total Amount</th>
              <th>Down Payment</th>
              <th>Remaining</th>
              <th>GST</th>
              <th>Type</th>
              <th>Payment Method</th>
              <th>Closed Date</th>
              <th>Closed By</th>
              <th>Payments</th>
              <th>Ack</th>
              <th>Last Edit</th>
            </tr>
          </thead>
          <tbody>
      `;

      dealRows.forEach((item) => {
        const safeContact = String(item.contact || "").replace(/'/g, "\\'");
        const safeEmail = String(item.email || "").replace(/'/g, "\\'");
        const dealId = Number(item.id || 0);
        const dealAmount = Number(item.deal_amount || 0);
        const receivedAmount = getMeDealAchievedAmount(item);
        const remainingAmount = getMeDealRemainingAmount(item);
        const gstAmount = hasMeStoredAmount(item.gst_amount)
          ? Number(item.gst_amount || 0)
          : getMeInclusiveGstAmount(dealAmount);
        
        const paymentAction = `
          <button
            type="button"
            class="me-deal-payment-btn"
            onclick="openMeDealPaymentsModal(event, ${dealId})"
            title="View and add installment payments"
          >
            <i class="fas fa-receipt"></i> Payments
          </button>
        `;

        const hasAck = item.ack_snapshot && item.ack_snapshot !== 'null';
        const ackSnapshotArg = hasAck ? escapeMeHtml(JSON.stringify(item.ack_snapshot)) : '';
        const ackAction = `<button type="button" class="me-deal-payment-btn" onclick="event.stopPropagation(); window.openMeDealAckViewModal(${dealId})" title="View acknowledgement proforma"><i class="fas fa-file-alt"></i> View Ack</button>`;

        table += `
          <tr
            class="me-clickable-deal-row"
            onclick="openMeDealDetailsFromRow(event, ${dealId})"
            title="Click to view full lead details"
          >
            <td><strong>${escapeMeHtml(item.company_name || "-")}</strong></td>
            <td>${escapeMeHtml(item.client_name || "-")}</td>
            <td>${escapeMeHtml(formatMeDashboardMoney(dealAmount))}</td>
            <td>${escapeMeHtml(formatMeDashboardMoney(receivedAmount))}</td>
            <td>${escapeMeHtml(formatMeDashboardMoney(remainingAmount))}</td>
            <td>${escapeMeHtml(formatMeDashboardMoney(gstAmount))}</td>
            <td>${escapeMeHtml(formatMeDealSalesTypeLabel(item, selectedMonth))}</td>
            <td>${escapeMeHtml(item.payment_method || "-")}</td>
            <td>${formatMeDealClosedAndRenewalCell(item, selectedMonth)}</td>
            <td>${escapeMeHtml(item.closed_tme_name || item.closed_by_name || item.received_by || "-")}</td>
            <td>${paymentAction}</td>
            <td>${ackAction}</td>
            <td>
              <button
                type="button"
                class="me-edit-deal-btn"
                onclick="openMeEditDealModal(event, ${dealId})"
                title="Edit this deal"
              >
                <i class="fas fa-edit"></i> Edit
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
                      <td>${escapeMeHtml(formatDate(item.closed_date))}</td>

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
    return String(editor?.innerHTML || "").trim();
  }

  function setProposalEditorText(text) {
    const editor = document.getElementById("proposalEditor");
    if (editor) editor.innerHTML = text || "";
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
      client_name:
        document.getElementById("proposalClientName")?.value.trim() || "",
      client_email:
        document.getElementById("proposalClientEmail")?.value.trim() || "",
      company_name:
        document.getElementById("proposalCompanyName")?.value.trim() || "",
      project_topic:
        document.getElementById("proposalProjectTopic")?.value.trim() || "",
      requirement_details:
        document.getElementById("proposalRequirementDetails")?.value.trim() || "",
      budget: document.getElementById("proposalBudget")?.value.trim() || "",
      timeline: document.getElementById("proposalTimeline")?.value.trim() || "",
      technology:
        document.getElementById("proposalTechnology")?.value.trim() ||
        "Core PHP + MySQL",
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
      popup.document.write(
        "<p style='font-family:Arial,sans-serif;padding:18px;'>Preparing proposal...</p>",
      );
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

  async function getProposalSnapshot(
    proposalId = currentProposalId,
    { saveCurrent = false } = {},
  ) {
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
    const words = String(text || "")
      .trim()
      .split(/\s+/)
      .filter(Boolean);
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

  function htmlToProposalPlainText(html) {
    return String(html || "")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>/gi, "\n")
      .replace(/<\/h[1-6]>/gi, "\n")
      .replace(/<hr\s*\/?>/gi, "\n" + "-".repeat(40) + "\n")
      .replace(/<[^>]+>/g, "")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, " ")
      .trim();
  }

  function buildProposalCanvasLines(ctx, proposal = {}, contentWidth) {
    const letterhead = getProposalLetterheadUrls(proposal);
    const lines = [];
    const pushWrapped = (text, style = {}) => {
      if (!text.trim()) return;
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

    // Parse HTML content into styled canvas segments
    const rawHtml = String(proposal.proposal_content || "");
    // Split by block-level tags to process each element
    const segments = rawHtml
      .replace(/<hr\s*\/?>/gi, "||HR||")
      .replace(/<h2([^>]*)>([\s\S]*?)<\/h2>/gi, (_, _a, content) => `||H2||${htmlToProposalPlainText(content)}||END||`)
      .replace(/<h3([^>]*)>([\s\S]*?)<\/h3>/gi, (_, _a, content) => `||H3||${htmlToProposalPlainText(content)}||END||`)
      .replace(/<p([^>]*)>([\s\S]*?)<\/p>/gi, (_, _a, content) => `||P||${htmlToProposalPlainText(content)}||END||`)
      .replace(/<strong([^>]*)>([\s\S]*?)<\/strong>/gi, (_, _a, content) => htmlToProposalPlainText(content))
      .replace(/<[^>]+>/g, " ")
      .split("||");

    for (let i = 0; i < segments.length; i++) {
      const tag = segments[i].trim();
      if (!tag || tag === "END") continue;
      if (tag === "HR") {
        lines.push({ spacer: true, height: 10 });
        lines.push({ text: "─".repeat(48), color: "#cbd5e1", size: 18, weight: "400", gapAfter: 10 });
        lines.push({ spacer: true, height: 10 });
        continue;
      }
      if (tag === "H2") {
        const content = segments[i + 1] || "";
        if (content.trim() && content.trim() !== "END") {
          pushWrapped(content.trim(), { align: "center", color: "#0f172a", size: 32, weight: "700", gapAfter: 16 });
        }
        i++;
        continue;
      }
      if (tag === "H3") {
        const content = segments[i + 1] || "";
        if (content.trim() && content.trim() !== "END") {
          pushWrapped(content.trim(), { color: letterhead.headingColor, size: 24, weight: "700", gapAfter: 10 });
        }
        i++;
        continue;
      }
      if (tag === "P") {
        const content = segments[i + 1] || "";
        if (content.trim() && content.trim() !== "END") {
          pushWrapped(content.trim(), { color: "#111827", size: 22, weight: "400", gapAfter: 6 });
        }
        i++;
        continue;
      }
      // Fallback: plain text line
      const plain = htmlToProposalPlainText(tag);
      if (plain && plain !== "END") {
        plain.split("\n").forEach((line) => {
          const trimmed = line.trim();
          if (!trimmed) { lines.push({ spacer: true, height: 14 }); return; }
          pushWrapped(trimmed, { color: "#111827", size: 22, weight: "400", gapAfter: 6 });
        });
      }
    }

    return lines;
  }

  function normalizeProposalEditorContent(value) {
    return String(value || "")
      .replace(/\r\n/g, "\n")
      .trim();
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

  function drawProposalCanvasFallbackHeader(
    ctx,
    pageWidth,
    height,
    margin,
    letterhead = {},
  ) {
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

  function drawProposalCanvasFallbackFooter(
    ctx,
    pageWidth,
    pageHeight,
    height,
    margin,
    letterhead = {},
  ) {
    const footerTop = pageHeight - height;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, footerTop, pageWidth, height);
    ctx.fillStyle = letterhead.accentColor || "#35b8ae";
    ctx.fillRect(0, footerTop + height - 76, pageWidth, 76);
    ctx.fillStyle = "#0f172a";
    ctx.font = "400 20px Arial, sans-serif";
    ctx.fillText(
      letterhead.footerText ||
        "info@metricsmart.in | www.metricsmartinfoline.com",
      margin,
      footerTop + height - 38,
    );
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
    const headerHeight = getScaledProposalImageHeight(
      headerImage,
      pageWidth,
      325,
    );
    const footerHeight = getScaledProposalImageHeight(
      footerImage,
      pageWidth,
      329,
    );
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
        drawProposalCanvasFallbackHeader(
          ctx,
          canvas.width,
          headerHeight,
          margin,
          letterheadUrls,
        );
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
        ctx.drawImage(
          footerImage,
          0,
          pageTop + pageHeight - footerHeight,
          canvas.width,
          footerHeight,
        );
      } else {
        ctx.save();
        ctx.translate(0, pageTop);
        drawProposalCanvasFallbackFooter(
          ctx,
          canvas.width,
          pageHeight,
          footerHeight,
          margin,
          letterheadUrls,
        );
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
      withProposalCompanyScope(
        `${BASE_URL}/api/proposals/${proposalId}/pdf?t=${Date.now()}`,
      ),
      { cache: "no-store" },
      "Proposal PDF API",
    );

    if (!res.ok) {
      throw new Error(`Failed to prepare proposal PDF (${res.status}).`);
    }

    const blob = await res.blob();
    const contentType = String(
      res.headers.get("content-type") || "",
    ).toLowerCase();
    
    let isValidPdf = contentType.includes("application/pdf");
    if (!isValidPdf && blob) {
      try {
        const signature = await blob.slice(0, 4).text();
        if (signature === "%PDF") {
          isValidPdf = true;
        }
      } catch (e) {
        console.warn("Failed to check PDF blob signature", e);
      }
    }

    if (!isValidPdf) {
      throw new Error(`Proposal PDF API did not return a PDF file. Received content-type: ${contentType}`);
    }

    return blob;
  }

  function getProposalPdfShareUrl(proposalId) {
    return withProposalCompanyScope(
      `${BASE_URL}/api/proposals/${proposalId}/pdf`,
    );
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

  async function persistCurrentProposal(
    status = "draft",
    { silent = false } = {},
  ) {
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
        withProposalCompanyScope(
          `${BASE_URL}/api/proposals?created_by=${encodeURIComponent(currentUser.id)}`,
        ),
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
      showPopup(
        "No Proposal",
        "Please generate or open a proposal first.",
        false,
      );
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
        showPopup(
          "Download Error",
          err.message || "Failed to download proposal PNG",
          false,
        );
      }
      return;
    }

    const downloadUrl = withProposalCompanyScope(
      `${BASE_URL}/api/proposals/${proposalId}/${normalizedType}?t=${Date.now()}`,
    );
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
      showPopup(
        "Download Error",
        err.message || "Failed to download proposal",
        false,
      );
    }
  }

  async function shareProposalWhatsApp(proposalId = currentProposalId) {
    if (!proposalId) {
      showPopup(
        "No Proposal",
        "Please generate or open a proposal first.",
        false,
      );
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
          setProposalStatusText(
            `Proposal #${proposalId} PDF is ready for WhatsApp.`,
          );
          showPopup("Shared", "Proposal PDF shared successfully.", true);
          return;
        } catch (shareErr) {
          if (shareErr?.name === "AbortError") {
            return;
          }
          console.warn(
            "Native proposal PDF share failed, downloading PDF for manual WhatsApp attach.",
            shareErr,
          );
        }
      }

      downloadProposalBlob(pdfBlob, fileName);
      setProposalStatusText(
        `Proposal #${proposalId} PDF downloaded for WhatsApp.`,
      );
      showPopup(
        "PDF Ready",
        "PDF download ho gaya. WhatsApp me file attach karke send karo.",
        true,
      );
    } catch (err) {
      if (err?.name === "AbortError") return;
      if (pdfBlob && fileName) {
        downloadProposalBlob(pdfBlob, fileName);
      }
      console.error("Proposal WhatsApp Error:", err);
      showPopup(
        "WhatsApp Error",
        err.message || "Failed to share proposal",
        false,
      );
    }
  }

  async function sendProposalEmail(proposalId = currentProposalId) {
    if (!proposalId) {
      showPopup(
        "No Proposal",
        "Please generate or open a proposal first.",
        false,
      );
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
        showPopup(
          "Invalid Email",
          "Please enter a valid client email address.",
          false,
        );
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
      showPopup(
        "Email Draft",
        "PDF download ho gaya aur Gmail open ho raha hai. PDF drag-drop karke send karo.",
        true,
      );
    } catch (err) {
      console.error("Proposal Email Error:", err);
      showPopup(
        "Email Error",
        err.message || "Failed to open proposal email draft",
        false,
      );
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
    if (!row?.check_out) return "-";

    return formatAttendanceTime(row.check_out);
  }

  function hasValidAttendanceCheckout(row) {
    return Boolean(row?.check_out) && !isInvalidAttendanceCheckout(row);
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

  function formatAttendanceRadiusLabel(radiusMeters) {
    const meters = Math.round(Number(radiusMeters) || 0);
    if (meters >= 1000 && meters % 1000 === 0) return `${meters / 1000}km`;
    if (meters >= 1000) return `${Number((meters / 1000).toFixed(1))}km`;
    return `${meters}m`;
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
    const submitBtn = document.getElementById(
      "attendanceLocationRequestSubmitBtn",
    );
    if (!modal || !form) return;

    form.reset();

    const activeRequest = attendanceLocationRequestState.activeRequest;
    if (activeRequest) {
      if (form.elements.pincode) {
        form.elements.pincode.value = activeRequest.requestedPincode || "";
      }
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
    if (
      activeRequest?.status === "approved" &&
      attendanceLocationRequestState.activeZone
    ) {
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
    const zoneType = String(zone.type || "").toLowerCase();
    const effectiveRadius =
      Number(zone.radiusMeters || 0) +
      (zoneType === "office" ? 0 : gpsAccuracyBuffer);

    if (distanceMeters <= effectiveRadius) {
      return distanceMeters;
    }

    const activeRequest = attendanceLocationRequestState.activeRequest;
    if (activeRequest?.status === "approved") {
      throw new Error(
        `Attendance is allowed within ${formatAttendanceRadiusLabel(zone.radiusMeters)} of the approved meeting location. Your current distance is about ${formatAttendanceRadiusLabel(distanceMeters)}.`,
      );
    }

    const pendingNote =
      activeRequest?.status === "pending"
        ? " Your offsite request is still pending admin approval."
        : activeRequest?.status === "rejected"
          ? activeRequest.adminRemark
            ? ` Admin note: ${activeRequest.adminRemark}`
            : " Your latest offsite request was rejected."
          : " If you are at a client meeting or field location, you can submit an optional offsite request and wait for admin approval.";

    throw new Error(
      `Attendance is allowed within ${formatAttendanceRadiusLabel(getMeAttendanceDefaultOfficeZone().radiusMeters)} of the office. Your current distance is about ${formatAttendanceRadiusLabel(distanceMeters)}.${pendingNote}`,
    );
  }

  function renderAttendanceSupportCards() {
    const officeZone =
      attendanceLocationRequestState.officeZone || getMeAttendanceDefaultOfficeZone();
    const activeRequest = attendanceLocationRequestState.activeRequest;
    const canRequestOffsite = attendanceLocationRequestState.canRequestOffsite !== false;
    const showOffsiteRequestOption = canRequestOffsite;
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
            <span>${escapeAttendanceHtml(activeRequest.requestedPincode ? `Pincode ${activeRequest.requestedPincode}` : "Requested pincode")}
              <small>${activeRequest.requestedLocationUrl ? `<a class="attendance-zone-link" href="${activeRequest.requestedLocationUrl}" target="_blank" rel="noopener noreferrer">Open map</a>` : "Map link unavailable"}</small>
            </span>
            <span>${escapeAttendanceHtml(activeRequest.requestedAddress || "Meeting area not added")}
              <small>Attendance opens after admin approves this pincode area.</small>
            </span>
            <span>${escapeAttendanceHtml(activeRequest.meetingWith || "No meeting contact added")}
              <small>${activeRequest.reviewedAt ? `Reviewed ${escapeAttendanceHtml(formatAttendanceRequestDateTime(activeRequest.reviewedAt))}` : `Requested ${escapeAttendanceHtml(formatAttendanceRequestDateTime(activeRequest.createdAt))}`}</small>
            </span>
            <span>${activeRequest.status === "approved" ? `${formatAttendanceRadiusLabel(activeRequest.approvedRadiusMeters)} approved radius` : `${formatAttendanceRadiusLabel(activeRequest.requestedRadiusMeters)} requested radius`}
              <small>${escapeAttendanceHtml(activeRequest.adminRemark || (activeRequest.status === "approved" ? "Admin approval active for this location." : "Waiting for admin review."))}</small>
            </span>
          </div>
          <div class="attendance-support-actions">
            <button type="button" class="btn btn-save" onclick="openAttendanceLocationRequestModal()">${actionLabel}</button>
            <button type="button" class="btn attendance-calendar-btn" onclick="fetchAttendance()">Refresh Status</button>
          </div>
        </div>
      `
      : showOffsiteRequestOption
        ? `
        <div class="attendance-support-card">
          <h4>Need Offsite Check-in?</h4>
          <p>Optional for client meetings or field visits. Send your meeting pincode to admin, then mark attendance only after approval.</p>
          <div class="attendance-support-actions">
            <button type="button" class="btn btn-save" onclick="openAttendanceLocationRequestModal()">Request Offsite Approval</button>
          </div>
        </div>
      `
        : "";

    return `
      <div class="attendance-support-grid">
        <div class="attendance-support-card office">
          <h4>Office Geofence</h4>
          <p>Regular attendance is allowed within ${formatAttendanceRadiusLabel(officeZone.radiusMeters)} of the office location.</p>
          <div class="attendance-support-meta">
            <span>${escapeAttendanceHtml(officeZone.address || getMeAttendanceDefaultOfficeZone().address)}
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
      const selectedMonth = getSelectedAttendanceMonth();
      const attendanceUrl = new URL(`${BASE_URL}/api/attendance/${currentUser.id}`);
      if (selectedMonth) {
        attendanceUrl.searchParams.set("month", selectedMonth);
      }

      const [attendanceRes, requestRes] = await Promise.all([
        fetch(attendanceUrl.toString(), { cache: "no-store" }),
        fetch(`${BASE_URL}/api/attendance/location-request/${currentUser.id}`),
      ]);
      const result = await attendanceRes.json();
      const requestResult = await requestRes
        .json()
        .catch(() => ({ success: false }));
      const rows = result.success ? result.data || [] : [];
      const requestData = requestResult.success ? requestResult.data || {} : {};
      const showOffsiteRequestOption = Boolean(
        attendanceLocationRequestState.showOffsiteRequestOption &&
          !requestData.activeRequest,
      );

      attendanceLocationRequestState = {
        officeZone: requestData.officeZone || {
          ...getMeAttendanceDefaultOfficeZone(),
          type: "office",
          label: "Office",
        },
        activeRequest: requestData.activeRequest || null,
        activeZone: requestData.activeZone ||
          requestData.officeZone || {
            ...getMeAttendanceDefaultOfficeZone(),
            type: "office",
            label: "Office",
          },
        attendanceDate: requestData.attendanceDate || getAttendanceServerToday(result),
        canRequestOffsite: requestData.canRequestOffsite !== false,
        showOffsiteRequestOption,
      };

      const today = getAttendanceServerToday(result);
      const isCurrentMonthView = !selectedMonth || today.slice(0, 7) === selectedMonth;
      const todayRow = isCurrentMonthView
        ? rows.find((row) => row.attendance_date === today)
        : null;
      const hasCheckInToday = Boolean(todayRow?.check_in);
      const hasCheckOutToday = hasValidAttendanceCheckout(todayRow);
      const canCheckIn = isCurrentMonthView && !hasCheckInToday;
      const canCheckOut = isCurrentMonthView && hasCheckInToday && !hasCheckOutToday;

      renderMeAttendanceSummarySection(rows);

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
          ${renderAttendanceCalendar(rows, selectedMonth ? `${selectedMonth}-01` : today)}
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
              <td>${formatAttendanceTime(row.check_in)}</td>
              <td>${displayedCheckOut}</td>
              <td>${checkInLocation}</td>
              <td>${formatAttendanceWorkingHoursDisplay(row.working_hours)}</td>
              <td>${attendanceStatus}</td>
            </tr>
          `;
        });
      }

      table += `</tbody></table></div>`;
      container.innerHTML = table;
      if (document.getElementById("attendanceSearch")?.value) {
        filterTable("attendanceContainer", "attendanceSearch");
      }
    } catch (err) {
      console.error("Attendance Error:", err);
      container.innerHTML = `<p class="error">Error loading attendance</p>`;
    }
  }

  async function submitAttendanceLocationRequest(event) {
    event.preventDefault();

    const userId = normalizeCurrentUserId(currentUser);
    if (!userId || attendanceLocationRequestSubmitting) return;

    const form = event.currentTarget;
    const submitBtn = document.getElementById(
      "attendanceLocationRequestSubmitBtn",
    );
    const formData = new FormData(form);
    const payload = {
      userId,
      user_id: userId,
      attendanceDate: normalizeAttendanceDateKey(
        attendanceLocationRequestState.attendanceDate,
        new Date(),
      ),
      pincode: formData.get("pincode"),
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
        throw new Error(
          result.message || "Failed to send offsite attendance request",
        );
      }

      closeAttendanceLocationRequestModal();
      showPopup(
        "Attendance",
        result.message || "Offsite attendance request sent to admin.",
        true,
      );
      await fetchAttendance();
    } catch (err) {
      console.error("Attendance location request error:", err);
      showPopup(
        "Attendance",
        err.message || "Failed to send offsite attendance request",
        false,
      );
    } finally {
      attendanceLocationRequestSubmitting = false;
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = "Send Request";
      }
    }
  }

  async function markAttendance(type) {
    const userId = normalizeCurrentUserId(currentUser);
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
      const location = await getCurrentLocation();
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, user_id: userId, ...location }),
      });
      const result = await res.json();

      if (!res.ok || !result.success) {
        throw new Error(
          result.error || result.message || "Attendance update failed",
        );
      }

      showPopup("Attendance", result.message, true);
      attendanceUpdating = false;
      await fetchAttendance();
      return;
    } catch (err) {
      console.error("Attendance update error:", err);
      showPopup("Attendance", err.message || "Attendance update failed", false);
      if (
        String(currentUser?.role || "me").toLowerCase().trim() === "me" &&
        /office|offsite|approved meeting location|check-in \/ check-out/i.test(
          err.message || "",
        )
      ) {
        attendanceLocationRequestState.showOffsiteRequestOption = true;
        await fetchAttendance();
      }
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

  function getAttendanceStatusMeta(status) {
    const normalizedStatus = normalizeAttendanceStatus(status);

    switch (normalizedStatus) {
      case "absent":
        return { label: "Absent", className: "absent" };
      case "sunday":
        return { label: "Sunday", className: "sunday" };
      case "late":
        return { label: "Present + Late", className: "late" };
      case "grace":
        return { label: "Grace", className: "grace" };
      case "half_day_late":
        return { label: "Half Day + Late", className: "half-day" };
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

      if (date.getDay() === 0 && !row?.check_in) { // Sunday
        status = "sunday";
        label = "Sunday";
      } else if (row?.status === "absent") {
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
      } else if (normalizedStatus === "half_day_late") {
        summary.late += 1;
        summary.halfDay += 1;
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

  function renderMeAttendanceSummarySection(rows = []) {
    const attendanceSection = document.getElementById("attendance");
    if (!attendanceSection) return;

    let summary = document.getElementById("attendanceSummary");
    if (!summary) {
      summary = document.createElement("div");
      summary.id = "attendanceSummary";
      const filterBar = attendanceSection.querySelector(".attendance-filter-bar");
      const sectionTitle = attendanceSection.querySelector("h2");
      if (filterBar) {
        filterBar.insertAdjacentElement("afterend", summary);
      } else if (sectionTitle) {
        sectionTitle.insertAdjacentElement("afterend", summary);
      } else {
        attendanceSection.insertBefore(summary, attendanceSection.firstChild);
      }
    }

    summary.innerHTML = renderAttendanceSummary(rows);
  }

  function formatDateKey(date) {
    const safeDate = date instanceof Date && !Number.isNaN(date.getTime())
      ? date
      : new Date();
    const year = safeDate.getFullYear();
    const month = String(safeDate.getMonth() + 1).padStart(2, "0");
    const day = String(safeDate.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function normalizeAttendanceDateKey(value, fallback = new Date()) {
    const rawValue = String(value || "").trim();
    const dateKey = /^\d{4}-\d{2}-\d{2}$/.test(rawValue)
      ? rawValue
      : rawValue.match(/^\d{4}-\d{2}-\d{2}/)?.[0] || "";

    if (dateKey) {
      const [year, month, day] = dateKey.split("-").map(Number);
      const parsedDate = new Date(year, month - 1, day);
      if (
        year >= 1000 &&
        year <= 9999 &&
        Number.isFinite(parsedDate.getTime()) &&
        parsedDate.getFullYear() === year &&
        parsedDate.getMonth() === month - 1 &&
        parsedDate.getDate() === day
      ) {
        return dateKey;
      }
    }

    const fallbackDate = fallback instanceof Date ? fallback : new Date(fallback);
    return formatDateKey(fallbackDate);
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
  // ================= FOLLOWUPS =================
  async function fetchFollowups() {
    if (!currentUser || !currentUser.id) return;

    try {
      const res = await fetch(`${BASE_URL}/api/followups/${currentUser.id}`);
      const data = await res.json();

      const container = document.getElementById("followupsContainer");

      const selectedMonth = document.getElementById("followupsMonthFilterME")?.value;
      let items = Array.isArray(data.data) ? data.data : [];
      if (selectedMonth) {
        items = items.filter((item) => {
          const dStr = item.follow_date || item.created_at;
          if (!dStr) return false;
          const date = new Date(dStr);
          if (isNaN(date)) return false;
          const yyyy = date.getFullYear();
          const mm = String(date.getMonth() + 1).padStart(2, '0');
          return `${yyyy}-${mm}` === selectedMonth;
        });
      }

      if (items.length === 0) {
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

      items.forEach((item) => {
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
          <td>${formatMeDisplayTime(item.follow_time)}</td>
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
    if (Number.isNaN(d.getTime())) return String(dateStr).slice(0, 10) || "-";

    return d.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  }

  function formatMeDisplayTime(value) {
    const raw = String(value || "").trim();
    return formatAttendanceTime(raw);
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

  function openActionModal(id, company, client, salesType = "", renewalSourceLeadId = "") {
    const modal = document.getElementById("actionModal");

    currentLeadId = id;

    document.getElementById("modalLeadTitle").innerText = company;
    document.getElementById("modalLeadInfo").innerText = client;

    modal.classList.remove("hidden");
    modal.classList.add("show");

    resetActionForms();

    const dealSalesType = document.getElementById("dealSalesType");
    if (dealSalesType) {
      const normalizedSalesType = String(salesType || "")
        .toLowerCase()
        .trim();
      dealSalesType.value =
        normalizedSalesType === "renewal" || Number(renewalSourceLeadId || 0) > 0
          ? "renewal"
          : "fresh";
    }
  }

  function resetDealPaymentSummary() {
    ["dealReceivedAmount", "dealRemainingAmount", "dealTotalGst", "dealPaidGst", "dealRemainingGst"].forEach((id) => {
      const field = document.getElementById(id);
      if (field) field.value = "";
    });

    const received = document.getElementById("dealReceivedAmount");
    if (received) received.dataset.autoFill = "0";
  }

  function getDealWholeAmount(value) {
    const amount = Number(String(value ?? "").replace(/,/g, ""));
    if (!Number.isFinite(amount)) return 0;
    return Math.max(Math.round(amount), 0);
  }

  function formatDealWholeAmount(value) {
    return String(getDealWholeAmount(value));
  }

  function syncDealPaymentSummary(forceDefault = false) {
    const totalField = document.getElementById("dealAmount");
    const receivedField = document.getElementById("dealReceivedAmount");
    const remainingField = document.getElementById("dealRemainingAmount");
    const totalGstField = document.getElementById("dealTotalGst");
    const paidGstField = document.getElementById("dealPaidGst");
    const remainingGstField = document.getElementById("dealRemainingGst");

    if (!totalField || !receivedField || !remainingField) {
      return {
        total: Number(totalField?.value || 0),
        received: 0,
        remaining: 0,
        totalGst: 0,
        paidGst: 0,
        remainingGst: 0,
      };
    }

    const total = getDealWholeAmount(totalField.value);
    if (!Number.isFinite(total) || total <= 0) {
      resetDealPaymentSummary();
      return { total: 0, received: 0, remaining: 0, totalGst: 0, paidGst: 0, remainingGst: 0 };
    }

    const rawReceivedValue = String(receivedField.value || "").trim();
    const shouldAutoFill = forceDefault || receivedField.dataset.autoFill === "1";

    let received = shouldAutoFill
      ? total
      : rawReceivedValue
        ? getDealWholeAmount(rawReceivedValue)
        : 0;
    if (!Number.isFinite(received) || received < 0) received = 0;
    if (received > total) received = total;

    receivedField.value = rawReceivedValue || shouldAutoFill
      ? formatDealWholeAmount(received)
      : "";

    const remaining = Math.max(total - received, 0);
    const totalGst = getDealWholeAmount(getMeInclusiveGstAmount(total));
    const paidGst = getDealWholeAmount(getMeInclusiveGstAmount(received));
    const remainingGst = getDealWholeAmount(getMeInclusiveGstAmount(remaining));

    remainingField.value = formatDealWholeAmount(remaining);
    if (totalGstField) totalGstField.value = formatDealWholeAmount(totalGst);
    if (paidGstField) paidGstField.value = formatDealWholeAmount(paidGst);
    if (remainingGstField) remainingGstField.value = formatDealWholeAmount(remainingGst);

    return { total, received, remaining, totalGst, paidGst, remainingGst };
  }

  function handleDealPaymentInput() {
    const receivedField = document.getElementById("dealReceivedAmount");
    if (receivedField) receivedField.dataset.autoFill = "0";
    syncDealPaymentSummary(false);
  }

  const ME_DEAL_RENEWAL_BASIS_MONTHS = {
    monthly: 1,
    quarterly: 3,
    half_yearly: 6,
    yearly: 12,
  };

  const ME_DEAL_RENEWAL_BASIS_LABELS = {
    monthly: "Monthly",
    quarterly: "Quarterly",
    half_yearly: "Half Yearly",
    yearly: "Yearly",
  };

  function getMeDealRenewalBasis() {
    const basis = document.getElementById("meDealRenewalBasis")?.value || "monthly";
    return ME_DEAL_RENEWAL_BASIS_MONTHS[basis] ? basis : "monthly";
  }

  function getMeDealRenewalDefaultStartDate(basis = getMeDealRenewalBasis()) {
    const date = new Date();
    date.setMonth(date.getMonth() + (ME_DEAL_RENEWAL_BASIS_MONTHS[basis] || 1));
    return date.toISOString().split("T")[0];
  }

  function isMeDealRenewableProduct(product = {}) {
    const normalized = normalizeMeLeadProductMatchValue(product.name || "").replace(/_/g, "");
    return Boolean(product.name) && !normalized.includes("profilecreation");
  }

  function getMeDealRenewalProducts(products = currentMeDealCloseProducts) {
    const sourceProducts = Array.isArray(products) && products.length
      ? products
      : getSelectedDealProducts();
    const seen = new Set();
    return sourceProducts.filter((product) => {
      if (!isMeDealRenewableProduct(product)) return false;
      const key = normalizeMeLeadProductMatchValue(product.name || "");
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function updateMeDealRenewalPreview(products = currentMeDealCloseProducts) {
    const preview = document.getElementById("meDealRenewalPreview");
    if (!preview) return;

    const enabled = document.getElementById("meDealRenewalEnabled")?.checked;
    const renewalProducts = getMeDealRenewalProducts(products);
    if (!enabled) {
      preview.textContent = "Enable renewal after selecting services.";
      return;
    }

    if (!renewalProducts.length) {
      preview.textContent = "No renewable service selected for this deal.";
      return;
    }

    const basis = getMeDealRenewalBasis();
    const startDate = document.getElementById("meDealRenewalStartDate")?.value || "";
    const rows = renewalProducts
      .map((product) => {
        const amount = Number(product.amount ?? product.price ?? product.standardAmount ?? 0);
        return `${escapeMeHtml(product.name)} (${formatSalesTargetMoney(amount)})`;
      })
      .join(", ");

    preview.innerHTML =
      `<strong>${escapeMeHtml(ME_DEAL_RENEWAL_BASIS_LABELS[basis] || "Monthly")} renewal:</strong> ` +
      `${rows}${startDate ? ` from ${escapeMeHtml(startDate)}` : ""}.`;
  }

  function toggleMeDealRenewalFields() {
    const enabled = document.getElementById("meDealRenewalEnabled")?.checked;
    const fields = document.getElementById("meDealRenewalFields");
    const startInput = document.getElementById("meDealRenewalStartDate");
    if (fields) fields.classList.toggle("hidden", !enabled);
    if (enabled && startInput && !startInput.value) {
      startInput.value = getMeDealRenewalDefaultStartDate();
    }
    updateMeDealRenewalPreview();
  }

  function handleMeDealRenewalBasisChange() {
    const startInput = document.getElementById("meDealRenewalStartDate");
    if (document.getElementById("meDealRenewalEnabled")?.checked && startInput) {
      startInput.value = getMeDealRenewalDefaultStartDate();
    }
    updateMeDealRenewalPreview();
  }

  function resetMeDealRenewalFields() {
    const enabled = document.getElementById("meDealRenewalEnabled");
    const fields = document.getElementById("meDealRenewalFields");
    const basis = document.getElementById("meDealRenewalBasis");
    const startInput = document.getElementById("meDealRenewalStartDate");
    const preview = document.getElementById("meDealRenewalPreview");

    if (enabled) enabled.checked = false;
    if (fields) fields.classList.add("hidden");
    if (basis) basis.value = "monthly";
    if (startInput) startInput.value = "";
    if (preview) preview.textContent = "Enable renewal after selecting services.";
  }

  function getMeDealRenewalConfig(products = currentMeDealCloseProducts) {
    const enabled = document.getElementById("meDealRenewalEnabled")?.checked;
    if (!enabled) return { enabled: false };

    return {
      enabled: true,
      basis: getMeDealRenewalBasis(),
      startDate: document.getElementById("meDealRenewalStartDate")?.value || "",
      services: getMeDealRenewalProducts(products),
    };
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
    document
      .querySelector("#actionModal .modal-content")
      ?.classList.remove("deal-landscape");
    document.getElementById("actionButtons").style.display = "flex";
    document.getElementById("followupForm").classList.add("hidden");
    document.getElementById("dealClosedForm").classList.add("hidden");

    const followDate = document.getElementById("followDate");
    const followTime = document.getElementById("followTime");
    const followReason = document.getElementById("followReason");
    const dealAmount = document.getElementById("dealAmount");
    const dealSalesType = document.getElementById("dealSalesType");
    const paymentMethod = document.getElementById("paymentMethod");
    const paymentNotes = document.getElementById("paymentNotes");
    const dynamicPaymentFields = document.getElementById("dynamicPaymentFields");
    const productRows = document.getElementById("productRows");
    const totalBreakdown = document.getElementById("totalBreakdown");

    if (followDate) followDate.value = "";
    if (followTime) followTime.value = "";
    if (followReason) followReason.value = "";
    if (dealAmount) dealAmount.value = "";
    resetDealPaymentSummary();
    if (dealSalesType) dealSalesType.value = "fresh";
    if (paymentMethod) paymentMethod.value = "";
    if (paymentNotes) paymentNotes.value = "";
    if (dynamicPaymentFields) dynamicPaymentFields.innerHTML = "";
    resetMeDealRenewalFields();
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
    icon.className = isSuccess
      ? "fas fa-check-circle"
      : "fas fa-exclamation-circle";
    icon.style.color = isSuccess ? "#22d3ee" : "#ef4444";

    popup.classList.remove("hidden");
    popupTimer = setTimeout(() => {
      popup.classList.add("hidden");
    }, 1800);
  }

  function addProductRow() {
    renderDealProductCheckboxes();
  }

  async function fetchDealProductCatalog(forceRefresh = false) {
    if (dealProductsCatalog && !forceRefresh) return dealProductsCatalog;

    const res = await fetch(`${BASE_URL}/api/deal-products`, {
      cache: "no-store",
    });
    if (!res.ok) {
      throw new Error("Product API not found. Please restart the server.");
    }

    const data = await res.json();

    if (!data.success || !Array.isArray(data.data)) {
      throw new Error(data.message || "Unable to load products");
    }

    dealProductsCatalog = data.data;
    return dealProductsCatalog;
  }

  async function fetchLeadDownsaleRequests() {
    if (!currentLeadId) return [];

    try {
      const res = await fetch(
        `${BASE_URL}/api/downsale-requests?leadId=${currentLeadId}`,
      );
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

      if (
        currentApprovedId !== previousApprovedId ||
        leadDownsaleRequests.length > 0
      ) {
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
        fetchDealProductCatalog(true),
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

    if (!Object.keys(groups).length) {
      productRows.innerHTML = `<div style="color: #ef4444; padding: 10px;">No active products found. Please add active products from Admin panel.</div>`;
      return;
    }

    productRows.innerHTML =
      Object.entries(groups)
        .map(
          ([group, products]) => `
        <div class="product-group">
          <div style="font-size: 13px; font-weight: 700; color: #334155; margin-bottom: 8px;">${escapeMeHtml(group)}</div>
          ${products
            .map(
              (product) => `
            <label class="product-row deal-product-option" data-product-name="${escapeMeHtml(product.name)}">
              <input type="checkbox" class="product-name deal-product-checkbox" value="${escapeMeHtml(product.name)}" onchange="handleProductToggle(this); updateDealCloseCustomUI(this);" />
              <span class="deal-product-name">
                ${escapeMeHtml(product.name)}
              </span>
            </label>
            <div class="custom-product-ui" id="customUI_${escapeMeHtml(product.name).replace(/[^a-zA-Z0-9]/g, '_')}" style="display:none; margin-left: 25px; margin-bottom: 10px; padding: 10px; background: #f8fafc; border-radius: 4px;">
              ${getDealCloseCustomUI(product.name)}
            </div>
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
        const catalogItem = getMeDealProductCatalogItem(name);
        const price = Number(catalogItem?.price || 0);
        const product = {
          name,
          ...(Number.isFinite(price) && price > 0 ? { price, amount: price } : {}),
        };

        if (normalizeMeLeadProductMatchValue(name) === "gmb_seo") {
          const keywordCount = getDealCloseGmbKeywordCount();
          const keywordAmount = keywordCount * 1500;
          product.price = keywordAmount;
          product.amount = keywordAmount;
          product.keywordCount = keywordCount;
          product.keywords = keywordCount;
          product.gmb_keyword_count = keywordCount;
        }

        products.push(product);
      }
    });

    return products;
  }

  function getMeDealCloseGmbQuoteAdjustment(selectedProducts = [], quoteItems = []) {
    const selectedGmb = selectedProducts.find(
      (product) => normalizeMeLeadProductMatchValue(product.name) === "gmb_seo",
    );
    if (!selectedGmb || !Array.isArray(quoteItems)) return 0;

    const quotedGmb = quoteItems.find(
      (item) => normalizeMeLeadProductMatchValue(item.name) === "gmb_seo",
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
              getDealCloseGmbKeywordCount(),
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


  function syncMeDealCloseGmbQuoteItem(item = {}, selectedProducts = []) {
    if (normalizeMeLeadProductMatchValue(item.name) !== "gmb_seo") return item;
    if (item.isRenewalSourceAmount) return item;

    const selectedGmb = selectedProducts.find(
      (product) => normalizeMeLeadProductMatchValue(product.name) === "gmb_seo",
    );
    if (!selectedGmb) return item;

    const keywordCount = Math.max(
      10,
      Math.floor(
        Number(
          selectedGmb.keywordCount ||
            selectedGmb.keywords ||
            selectedGmb.gmb_keyword_count ||
            getDealCloseGmbKeywordCount(),
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


  function getMeDealProductCatalogItem(productName) {
    const normalizedName = normalizeMeLeadProductMatchValue(productName);
    return (Array.isArray(dealProductsCatalog) ? dealProductsCatalog : []).find(
      (product) => normalizeMeLeadProductMatchValue(product.name) === normalizedName,
    );
  }

  async function calculateTotal() {
    const products = getSelectedDealProducts();
    const totalBreakdown = document.getElementById("totalBreakdown");
    const dealAmount = document.getElementById("dealAmount");
    const upsaleToggle = document.getElementById("overallUpsaleToggle");

    updateDealCloseSelectedDescriptions();

    if (products.length === 0) {
      totalBreakdown.innerHTML = "Select products to calculate final total.";
      totalBreakdown.style.color = "#64748b";
      dealAmount.value = "";
      resetDealPaymentSummary();
      updateMeDealRenewalPreview([]);
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

    // Guard: variable-price products need a custom amount before we can quote
    const customParams = getDealCloseCustomParams();
    const needsErpAmount = products.some(p => p.name === "ERP/CRM/Software");
    const needsEcomAmount = products.some(p => p.name === "E-commerce Website");
    const missingAmounts = [];
    if (needsErpAmount && !(Number(customParams.erp_amount) > 0)) {
      missingAmounts.push("ERP/CRM/Software (enter project amount)");
    }
    if (needsEcomAmount && !(Number(customParams.ecom_amount) > 0)) {
      missingAmounts.push("E-commerce Website (enter project amount)");
    }
    if (missingAmounts.length) {
      totalBreakdown.innerHTML = `Please enter amount for: ${missingAmounts.join(", ")}`;
      totalBreakdown.style.color = "#b45309";
      dealAmount.value = "";
      resetDealPaymentSummary();
      updateMeDealRenewalPreview(products);
      updateDealCloseSelectedDescriptions();
      return;
    }

    try {
      const upsaleAmount = Number(appliedUpsaleAmount || 0);
      totalBreakdown.innerHTML = "Calculating final total...";
      totalBreakdown.style.color = "#64748b";

      const quoteRes = await fetch(`${BASE_URL}/api/deal-products/quote`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          leadId: currentLeadId,
          products,
          downsaleApprovalId: approvedDownsaleRequest?.id || null,
          upsaleAmount,
          ...customParams
        }),
      });
      const quoteData = await quoteRes.json();

      if (!quoteRes.ok || !quoteData.success) {
        throw new Error(quoteData.message || "Unable to calculate product total");
      }

      const quoteItems = Array.isArray(quoteData.data?.items)
        ? quoteData.data.items
        : [];
      const gmbQuoteAdjustment = getMeDealCloseGmbQuoteAdjustment(products, quoteItems);
      const total = Number(quoteData.data?.total || 0) + gmbQuoteAdjustment;
      if (quoteData.data?.items) {
        currentMeDealCloseProducts = quoteData.data.items.map((item) =>
          syncMeDealCloseGmbQuoteItem(item, products),
        );
      }
      totalBreakdown.innerHTML = `Final total: &#8377;${formatDealWholeAmount(total)}`;
      totalBreakdown.style.color = "green";
      dealAmount.value = formatDealWholeAmount(total);
      syncDealPaymentSummary(false);
      updateMeDealRenewalPreview(currentMeDealCloseProducts);

      updateDownsaleStatus(0, total, {
        ...(quoteData.data || {}),
        total,
        standardTotal: Number(quoteData.data?.standardTotal || 0) + gmbQuoteAdjustment,
      });
      updateUpsaleStatus(upsaleAmount);
      return total;
    } catch (err) {
      console.error("Quote error:", err);
      totalBreakdown.innerHTML = err.message || "Unable to calculate total";
      totalBreakdown.style.color = "#ef4444";
      dealAmount.value = "";
      resetDealPaymentSummary();
      updateMeDealRenewalPreview(products);
      return 0;
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
      statusEl.textContent = "Upsale applied.";
      statusEl.style.color = "#15803d";
    } else {
      statusEl.textContent =
        "Add extra amount above standard total. No approval required.";
      statusEl.style.color = "#64748b";
    }
  }

  function updateDownsaleStatus(standardTotal, finalTotal, quote = {}) {
    const statusEl = document.getElementById("overallDownsaleStatus");
    const toggle = document.getElementById("overallDownsaleToggle");
    const latestRequest = leadDownsaleRequests[0] || null;
    const hasApprovedDownsale =
      quote.hasApprovedDownsale ||
      (approvedDownsaleRequest && finalTotal < standardTotal);

    if (toggle)
      toggle.disabled =
        getSelectedDealProducts().length === 0 || !downsaleApiAvailable;
    if (!statusEl) return;

    if (!downsaleApiAvailable) {
      statusEl.textContent = "Server restart required for downsale approval.";
      statusEl.style.color = "#b91c1c";
    } else if (hasApprovedDownsale) {
      statusEl.textContent = "Approved downsale applied.";
      statusEl.style.color = "#15803d";
    } else if (latestRequest?.status === "pending") {
      statusEl.textContent = "Downsale approval pending.";
      statusEl.style.color = "#92400e";
    } else if (latestRequest?.status === "rejected") {
      statusEl.textContent = "Last overall downsale request rejected";
      statusEl.style.color = "#b91c1c";
    } else {
      statusEl.textContent =
        "Products selected. Downsale can be requested if needed.";
      statusEl.style.color = "#64748b";
    }
  }

  function openDownsaleRequest() {
    const panel = document.getElementById("overallDownsalePanel");
    if (panel) panel.classList.toggle("hidden");
  }

  async function submitDownsaleRequest(button) {
    const products = getSelectedDealProducts();
    const requestedAmount = Number(
      document.getElementById("overallDownsaleAmount")?.value,
    );
    const reason = document.getElementById("overallDownsaleReason")?.value || "";

    if (products.length === 0) {
      alert("Select at least one product first");
      return;
    }

    if (!downsaleApiAvailable) {
      alert("Please restart the server, downsale API is not loaded yet.");
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
          companyScope: getCurrentMePanelCompanyScope(),
          products,
          requestedAmount,
          reason,
          ...getDealCloseCustomParams(),
        }),
      });
      const contentType = res.headers.get("content-type") || "";
      if (!contentType.includes("application/json")) {
        throw new Error(
          "Server restart karo, downsale API abhi load nahi hui hai.",
        );
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
    document
      .querySelector("#actionModal .modal-content")
      ?.classList.remove("deal-landscape");
    document.getElementById("followupForm").classList.add("hidden");
    document.getElementById("dealClosedForm").classList.add("hidden");

    if (type === "followup") {
      document.getElementById("followupForm").classList.remove("hidden");
    } else if (type === "deal_closed") {
      document
        .querySelector("#actionModal .modal-content")
        ?.classList.add("deal-landscape");
      document.getElementById("dealClosedForm").classList.remove("hidden");
      renderDealProductCheckboxes();
    } else if (type === "reschedule_meeting") {
      const leadId = currentLeadId;
      closeActionModal();
      openMeLeadAppointmentModal(leadId, "reschedule");
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
        <input type="date" id="paymentDate" value="${formatDateKey(new Date())}" />
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
      throw new Error(
        orderData.message || orderData.error || "Unable to create Razorpay order",
      );
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
              reject(
                new Error(verifyData.message || "Payment verification failed"),
              );
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
    const saveButton = document.querySelector(
      '#dealClosedForm button[onclick="saveDealClosed()"]',
    );
    const products = getSelectedDealProducts();
    const latestTotal = products.length ? await calculateTotal() : 0;
    const amount = String(
      latestTotal || document.getElementById("dealAmount").value || "",
    );
    const numericAmount = Number(amount || 0);
    const paymentSummary = syncDealPaymentSummary(false);
    const salesType = document.getElementById("dealSalesType")?.value || "fresh";
    const method = document.getElementById("paymentMethod").value;
    const notes = document.getElementById("paymentNotes").value;
    const chequeNo = document.getElementById("chequeNo")?.value || "";
    const chequeDate = document.getElementById("chequeDate")?.value || "";
    const txnId = document.getElementById("txnId")?.value || "";
    const paymentDate = document.getElementById("paymentDate")?.value || "";
    const bankName = document.getElementById("bankName")?.value || "";
    const branchName = document.getElementById("branchName")?.value || "";

    if (products.length === 0) {
      alert("Please select at least one product");
      return;
    }

    if (!amount || numericAmount <= 0) {
      alert("Total amount must be greater than 0");
      return;
    }

    if (
      paymentSummary.received < 0 ||
      paymentSummary.received > numericAmount
    ) {
      alert("Down payment must be between 0 and total amount");
      return;
    }

    if (paymentSummary.received <= 0) {
      alert("Please enter down payment amount");
      return;
    }

    if (!method) {
      alert("Please select payment method");
      return;
    }

    if (shouldUseRazorpay(method) && paymentSummary.received <= 0) {
      alert("Down payment must be greater than 0 for card payment");
      return;
    }

    if (method === "Cheque" && (!chequeNo || !chequeDate || !bankName)) {
      alert("Please fill cheque number, cheque date and bank name");
      return;
    }

    if (method === "UPI / Net Banking" && (!txnId || !paymentDate)) {
      alert("Please fill transaction ID and payment date");
      return;
    }

    const dealProductsForRenewal = currentMeDealCloseProducts?.length
      ? currentMeDealCloseProducts
      : products;
    const renewalConfig = getMeDealRenewalConfig(dealProductsForRenewal);
    if (renewalConfig.enabled && !renewalConfig.services.length) {
      alert("Please select at least one renewable service for renewal.");
      return;
    }
    if (renewalConfig.enabled && !renewalConfig.startDate) {
      alert("Please select first renewal date.");
      return;
    }

    try {
      if (saveButton) {
        saveButton.disabled = true;
        saveButton.dataset.originalText =
          saveButton.dataset.originalText || saveButton.innerHTML;
        saveButton.innerHTML = "Saving...";
      }

      let razorpayPayment = null;

      if (shouldUseRazorpay(method)) {
        if (saveButton) saveButton.innerHTML = "Opening payment...";
        razorpayPayment = await startRazorpayPayment(
          formatDealWholeAmount(paymentSummary.received),
          products,
        );
        if (saveButton) saveButton.innerHTML = "Saving...";
      }

      currentMeDealClosePayload = {
        action: "deal_closed",
        deal_amount: formatDealWholeAmount(numericAmount),
        received_amount: formatDealWholeAmount(paymentSummary.received),
        remaining_amount: formatDealWholeAmount(paymentSummary.remaining),
        gst_amount: formatDealWholeAmount(paymentSummary.paidGst),
        total_gst_amount: formatDealWholeAmount(paymentSummary.totalGst),
        remaining_gst_amount: formatDealWholeAmount(paymentSummary.remainingGst),
        sales_type: salesType,
        payment_method: method,
        payment_notes: notes || "",
        closed_by: currentUser.id,
        received_by: currentUser.name || "",
        payment_date: paymentDate || formatDateKey(new Date()),
        products: JSON.stringify(products),
        upsale_amount: String(appliedUpsaleAmount || 0),
      };

      if (renewalConfig.enabled) {
        currentMeDealClosePayload.service_renewal_enabled = "1";
        currentMeDealClosePayload.service_renewal_basis =
          renewalConfig.basis || "monthly";
        currentMeDealClosePayload.service_renewal_start_date =
          renewalConfig.startDate || "";
      }

      const customP = getDealCloseCustomParams();
      Object.keys(customP).forEach(k => {
        if (Array.isArray(customP[k])) {
          currentMeDealClosePayload[k] = customP[k].join(",");
        } else {
          currentMeDealClosePayload[k] = customP[k];
        }
      });

      if (approvedDownsaleRequest?.id) {
        currentMeDealClosePayload["downsale_approval_id"] = approvedDownsaleRequest.id;
      }

      if (chequeNo) currentMeDealClosePayload["cheque_number"] = chequeNo;
      if (chequeDate) currentMeDealClosePayload["cheque_date"] = chequeDate;
      if (txnId) currentMeDealClosePayload["transaction_id"] = txnId;
      if (bankName) currentMeDealClosePayload["bank_name"] = bankName;
      if (branchName) currentMeDealClosePayload["branch_name"] = branchName;

      if (razorpayPayment?.razorpay_payment_id) {
        currentMeDealClosePayload["transaction_id"] = razorpayPayment.razorpay_payment_id;
        currentMeDealClosePayload["payment_notes"] = `${notes || ""}\nRazorpay Order: ${razorpayPayment.razorpay_order_id}`.trim();
      }

      if (!currentMeDealCloseProducts || currentMeDealCloseProducts.length === 0 || currentMeDealCloseProducts[0].price === undefined) {
        currentMeDealCloseProducts = products;
      }

      if (paymentSummary.remaining > 0) {
        openMePartPaymentModal(numericAmount, paymentSummary.received, paymentSummary.remaining);
      } else {
        currentMeDealClosePayload.part_payment_option = null;
        currentMeDealClosePayload.part_payment_schedule = null;
        closeActionModal();
        await sendMeDealOtpFlow();
      }

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

  function calculateMeInstallmentSchedule() {
    const remaining = meDealPartPaymentRemaining > 0 ? meDealPartPaymentRemaining : Number(document.getElementById("dealRemainingAmount")?.value || 0);
    const term = document.getElementById("meDealPartPaymentTerm").value;
    const startDateVal = document.getElementById("meDealPartPaymentStartDate").value;
    
    if (!term || remaining <= 0) {
      document.getElementById("meDealInstallmentSchedulePreview").style.display = "none";
      document.getElementById("meDealPartPaymentInstallments").value = "";
      document.getElementById("meDealPartPaymentPerAmount").value = "";
      return;
    }

    let numInstallments = 1;
    if (term === "1 Month") numInstallments = 1;
    else if (term === "2 Months") numInstallments = 2;
    else if (term === "Quarterly") numInstallments = 4;
    else if (term === "Half Year") numInstallments = 6;
    else if (term === "Year") numInstallments = 12;

    document.getElementById("meDealPartPaymentInstallments").value = numInstallments;
    const perAmount = Math.floor(remaining / numInstallments);
    document.getElementById("meDealPartPaymentPerAmount").value = perAmount;

    const schedulePreview = document.getElementById("meDealInstallmentSchedulePreview");
    const installmentList = document.getElementById("meInstallmentList");
    installmentList.innerHTML = "";

    if (startDateVal) {
      schedulePreview.style.display = "block";
      meDealInstallmentsSchedule = [];
      let currentDate = new Date(startDateVal);

      for (let i = 1; i <= numInstallments; i++) {
        const dateStr = currentDate.toISOString().split("T")[0];
        const amount =
          i === numInstallments
            ? Math.max(remaining - perAmount * (numInstallments - 1), 0)
            : perAmount;
        meDealInstallmentsSchedule.push({
          installmentNo: i,
          dueDate: dateStr,
          amount
        });

        const row = document.createElement("div");
        row.dataset.meInstallmentRow = String(i);
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
          <input type="date" value="${dateStr}" data-me-installment-date onchange="syncMeInstallmentScheduleFromInputs()" style="height:32px; border:1px solid #cbd5e1; border-radius:6px; padding:4px 8px;" />
          <input type="number" min="1" step="1" value="${amount}" data-me-installment-amount oninput="syncMeInstallmentScheduleFromInputs(this)" style="height:32px; border:1px solid #cbd5e1; border-radius:6px; padding:4px 8px; text-align:right;" />
        `;
        installmentList.appendChild(row);

        currentDate.setMonth(currentDate.getMonth() + 1);
      }
      const hint = document.createElement("div");
      hint.id = "meInstallmentTotalHint";
      hint.style.marginTop = "8px";
      hint.style.fontSize = "12px";
      hint.style.fontWeight = "600";
      installmentList.appendChild(hint);
      syncMeInstallmentScheduleFromInputs();
    } else {
      schedulePreview.style.display = "none";
    }
  }

  function rebalanceMeInstallmentAmounts(changedInput) {
    if (!changedInput) return;

    const rows = Array.from(document.querySelectorAll("#meInstallmentList [data-me-installment-row]"));
    const changedRow = changedInput.closest("[data-me-installment-row]");
    const changedIndex = rows.indexOf(changedRow);
    if (changedIndex < 0) return;

    const remaining = getDealWholeAmount(
      meDealPartPaymentRemaining > 0
        ? meDealPartPaymentRemaining
        : document.getElementById("dealRemainingAmount")?.value || 0,
    );
    const getAmountInput = (row) => row.querySelector("[data-me-installment-amount]");
    const usedBefore = rows
      .slice(0, changedIndex)
      .reduce((sum, row) => sum + getDealWholeAmount(getAmountInput(row)?.value || 0), 0);
    const maxChangedAmount = Math.max(remaining - usedBefore, 0);
    const changedAmount = Math.min(
      getDealWholeAmount(changedInput.value || 0),
      maxChangedAmount,
    );

    changedInput.value = formatDealWholeAmount(changedAmount);

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
      amountInput.value = formatDealWholeAmount(amount);
    });
  }

  function syncMeInstallmentScheduleFromInputs(changedInput = null) {
    rebalanceMeInstallmentAmounts(changedInput);

    const rows = Array.from(document.querySelectorAll("#meInstallmentList [data-me-installment-row]"));
    meDealInstallmentsSchedule = rows.map((row, index) => ({
      installmentNo: index + 1,
      dueDate: row.querySelector("[data-me-installment-date]")?.value || "",
      amount: getDealWholeAmount(row.querySelector("[data-me-installment-amount]")?.value || 0),
    }));

    const remaining = meDealPartPaymentRemaining > 0 ? meDealPartPaymentRemaining : Number(document.getElementById("dealRemainingAmount")?.value || 0);
    const scheduledTotal = meDealInstallmentsSchedule.reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const hint = document.getElementById("meInstallmentTotalHint");
    if (hint) {
      hint.textContent = `Scheduled: Rs. ${scheduledTotal.toLocaleString("en-IN")} / Remaining: Rs. ${Number(remaining || 0).toLocaleString("en-IN")}`;
      hint.style.color = scheduledTotal === Number(remaining || 0) ? "#15803d" : "#b45309";
    }

    return meDealInstallmentsSchedule;
  }

  function openMePartPaymentModal(total, paid, remaining) {
    closeActionModal();

    const ppModal = document.getElementById("meDealPartPaymentModal");
    if (!ppModal) return;

    meDealPartPaymentRemaining = Number(remaining || 0);
    document.getElementById("mePpTotalAmount").textContent = "Rs. " + Number(total || 0).toLocaleString("en-IN");
    document.getElementById("mePpPaidAmount").textContent = "Rs. " + Number(paid || 0).toLocaleString("en-IN");
    document.getElementById("mePpRemainingAmount").textContent = "Rs. " + meDealPartPaymentRemaining.toLocaleString("en-IN");

    document.getElementById("meDealPartPaymentTerm").value = "";
    document.getElementById("meDealPartPaymentInstallments").value = "";
    document.getElementById("meDealPartPaymentPerAmount").value = "";
    
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 30);
    document.getElementById("meDealPartPaymentStartDate").value = futureDate.toISOString().split("T")[0];

    document.getElementById("meDealInstallmentSchedulePreview").style.display = "none";
    meDealInstallmentsSchedule = [];

    ppModal.classList.remove("hidden");
    ppModal.classList.add("show");
  }

  function closeMePartPaymentModal() {
    const ppModal = document.getElementById("meDealPartPaymentModal");
    if (ppModal) {
      ppModal.classList.add("hidden");
      ppModal.classList.remove("show");
    }
  }

  function handleMePartPaymentModalBackdrop(event) {
    if (event?.target?.id === "meDealPartPaymentModal") {
      closeMePartPaymentModal();
    }
  }

  function submitMePartPayment() {
    const term = document.getElementById("meDealPartPaymentTerm").value;
    const startDate = document.getElementById("meDealPartPaymentStartDate").value;
    const remaining = meDealPartPaymentRemaining > 0 ? meDealPartPaymentRemaining : 0;
    const schedule = syncMeInstallmentScheduleFromInputs();

    if (remaining > 0 && (!term || !startDate)) {
      alert("Please select a part payment option and a start date.");
      return;
    }

    const scheduledTotal = schedule.reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const hasInvalidInstallment = schedule.some((item) => !item.dueDate || Number(item.amount || 0) <= 0);
    if (remaining > 0 && (hasInvalidInstallment || scheduledTotal !== remaining)) {
      alert(`Installment dates are required and amounts must total Rs. ${Number(remaining).toLocaleString("en-IN")}.`);
      return;
    }

    currentMeDealClosePayload.part_payment_option = term || null;
    currentMeDealClosePayload.part_payment_schedule = JSON.stringify(schedule);

    closeMePartPaymentModal();
    sendMeDealOtpFlow();
  }

  async function sendMeDealOtpFlow() {
    const otpModal = document.getElementById("meDealOtpModal");
    if (!otpModal) return;

    document.getElementById("meDealOtpInput").value = "";
    document.getElementById("meSimulatedSmsText").textContent = "Sending OTP to client...";

    await renderMeDealOtpReviewContent();

    otpModal.classList.remove("hidden");
    otpModal.classList.add("show");

    await triggerMeSendOtp();
  }

  async function triggerMeSendOtp() {
    try {
      const res = await fetch(`${BASE_URL}/api/deal-otp/send`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ leadId: currentLeadId })
      });
      const result = await parseMeJsonResponse(
        res,
        "Deal OTP API is not available. Please restart the server."
      );
      if (res.ok && result.success) {
        document.getElementById("meSimulatedSmsText").textContent = 
          `📱 SMS to client (+91 ${result.maskedPhone}): "A transaction for Rs. ${Number(currentMeDealClosePayload.deal_amount).toLocaleString("en-IN")} at Metrics Mart is initiated. Your OTP for confirmation is ${result.otp}."`;
      } else {
        document.getElementById("meSimulatedSmsText").textContent = "Failed to send OTP: " + (result.message || "Unknown error");
      }
    } catch (err) {
      console.error("Error triggering OTP:", err);
      document.getElementById("meSimulatedSmsText").textContent =
        err.message || "Error sending OTP. Please click resend.";
    }
  }

  function resendMeDealOtp() {
    triggerMeSendOtp();
  }

  function closeMeDealOtpModal() {
    const otpModal = document.getElementById("meDealOtpModal");
    if (otpModal) {
      otpModal.classList.remove("show");
      otpModal.classList.add("hidden");
    }
  }

  function handleMeOtpModalBackdrop(event) {
    if (event?.target?.id === "meDealOtpModal") {
      closeMeDealOtpModal();
    }
  }

  async function renderMeDealOtpReviewContent() {
    const container = document.getElementById("meDealOtpReviewContent");
    if (!container) return;

    const leadRes = await fetch(`${BASE_URL}/api/leads/${currentLeadId}`);
    const leadResult = await leadRes.json();
    const lead = leadResult.success ? leadResult.data || {} : {};

    const products = currentMeDealCloseProducts || [];
    
    let productsHtml = "";
    products.forEach(p => {
      productsHtml += `<div style="display:flex; justify-content:space-between; margin-bottom:5px;">
        <span>• ${p.name}</span>
        <span style="font-weight:600;">Rs. ${Number(p.price || 0).toLocaleString("en-IN")}</span>
      </div>`;
    });

    let scheduleHtml = "";
    if (currentMeDealClosePayload.part_payment_option && meDealInstallmentsSchedule.length > 0) {
      scheduleHtml += `<div style="margin-top:15px; border-top:1px dashed #e2e8f0; padding-top:10px;">
        <strong style="color:#0f766e; font-size:12px; display:block; margin-bottom:5px; text-transform:uppercase;">Installment Schedule (${currentMeDealClosePayload.part_payment_option})</strong>`;
      meDealInstallmentsSchedule.forEach(inst => {
        scheduleHtml += `<div style="display:flex; justify-content:space-between; font-size:12px; color:#475569; margin-bottom:3px;">
          <span>Installment #${inst.installmentNo} (${inst.dueDate}):</span>
          <span>Rs. ${Number(inst.amount).toLocaleString("en-IN")}</span>
        </div>`;
      });
      scheduleHtml += `</div>`;
    }

    let renewalHtml = "";
    if (currentMeDealClosePayload.service_renewal_enabled) {
      const renewalProducts = getMeDealRenewalProducts(products);
      const basis = currentMeDealClosePayload.service_renewal_basis || "monthly";
      const startDate = currentMeDealClosePayload.service_renewal_start_date || "";
      if (renewalProducts.length) {
        renewalHtml += `<div style="margin-top:15px; border-top:1px dashed #e2e8f0; padding-top:10px;">
          <strong style="color:#1d4ed8; font-size:12px; display:block; margin-bottom:5px; text-transform:uppercase;">Service Renewal (${escapeMeHtml(ME_DEAL_RENEWAL_BASIS_LABELS[basis] || basis)})</strong>`;
        renewalProducts.forEach(product => {
          const amount = Number(product.amount ?? product.price ?? product.standardAmount ?? 0);
          renewalHtml += `<div style="display:flex; justify-content:space-between; font-size:12px; color:#475569; margin-bottom:3px;">
            <span>${escapeMeHtml(product.name || "-")} (${escapeMeHtml(startDate || "-")}):</span>
            <span>Rs. ${amount.toLocaleString("en-IN")}</span>
          </div>`;
        });
        renewalHtml += `</div>`;
      }
    }

    container.innerHTML = `
      <div style="margin-bottom:12px; border-bottom:1px solid #e2e8f0; padding-bottom:8px;">
        <h3 style="margin:0 0 4px 0; color:#0f172a; font-size:16px;">${lead?.company_name || "Company"}</h3>
        <p style="margin:0; color:#64748b; font-size:12px;">Client: ${lead?.client_name || "N/A"} | Phone: ${lead?.telephone || "N/A"}</p>
      </div>
      <div style="margin-bottom:12px;">
        <strong style="font-size:12px; color:#64748b; display:block; margin-bottom:5px; text-transform:uppercase;">Selected Services</strong>
        ${productsHtml}
      </div>
      <div style="border-top:1px dashed #e2e8f0; padding-top:10px; display:grid; grid-template-columns:1fr 1fr; gap:10px; font-size:13px;">
      <div>Total Deal Value: <strong>Rs. ${Number(currentMeDealClosePayload.deal_amount).toLocaleString("en-IN")}</strong></div>
      <div>Down Payment: <strong style="color:#16a34a;">Rs. ${Number(currentMeDealClosePayload.received_amount).toLocaleString("en-IN")}</strong></div>
        <div>Remaining Balance: <strong style="color:#dc2626;">Rs. ${Number(currentMeDealClosePayload.remaining_amount).toLocaleString("en-IN")}</strong></div>
        <div>Total GST (18%): <strong>Rs. ${Number(currentMeDealClosePayload.total_gst_amount).toLocaleString("en-IN")}</strong></div>
        <div>Paid GST (on Down Payment): <strong style="color:#0369a1;">Rs. ${Number(currentMeDealClosePayload.gst_amount).toLocaleString("en-IN")}</strong></div>
        <div>Remaining GST: <strong style="color:#b45309;">Rs. ${Number(currentMeDealClosePayload.remaining_gst_amount).toLocaleString("en-IN")}</strong></div>
      </div>
      ${scheduleHtml}
      ${renewalHtml}
    `;
  }

  async function verifyMeDealOtp() {
    const otpInput = document.getElementById("meDealOtpInput").value.trim();
    if (otpInput.length !== 6 || isNaN(otpInput)) {
      alert("Please enter a valid 6-digit OTP.");
      return;
    }

    try {
      const res = await fetch(`${BASE_URL}/api/deal-otp/verify`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ leadId: currentLeadId, otp: otpInput })
      });
      const result = await parseMeJsonResponse(
        res,
        "Deal OTP API is not available. Please restart the server."
      );
      if (res.ok && result.success) {
        closeMeDealOtpModal();
        await submitMeDealCloseDataToBackend();
      } else {
        alert(result.message || "OTP verification failed. Please try again.");
      }
    } catch (err) {
      console.error("Error verifying OTP:", err);
      alert(err.message || "Error verifying OTP. Please try again.");
    }
  }

  async function submitMeDealCloseDataToBackend() {
    try {
      const formData = new FormData();
      Object.keys(currentMeDealClosePayload).forEach(key => {
        if (currentMeDealClosePayload[key] !== null && currentMeDealClosePayload[key] !== undefined) {
          formData.append(key, currentMeDealClosePayload[key]);
        }
      });

      const result = await submitLeadAction(formData);
      showMeDealAckOverlay(result);
    } catch (err) {
      console.error("Error saving deal to backend:", err);
      alert("Deal Close Saved in API failed: " + err.message);
    }
  }

  async function showMeDealAckOverlay(apiResponse) {
    const overlay = document.getElementById("meDealAckOverlay");
    if (!overlay) return;

    const leadRes = await fetch(`${BASE_URL}/api/leads/${currentLeadId}`);
    const leadResult = await leadRes.json();
    const lead = leadResult.success ? leadResult.data || {} : {};

    const acknowledgementCompanyScope =
      normalizeMeLeadCompanyScope(
        lead?.company_scope ||
          lead?.companyScope ||
          currentMeDealClosePayload?.company_scope ||
          currentMeDealClosePayload?.companyScope ||
          currentUser?.company_scope ||
          currentUser?.company_key ||
          currentUser?.selected_company ||
          currentUser?.comp_name,
      ) || getDefaultMeLeadCompanyScope();
    updateMeDealAcknowledgementHeaderImage(
      overlay,
      acknowledgementCompanyScope,
    );

    const products = currentMeDealCloseProducts || [];

    document.getElementById("meAckCompany").textContent = lead?.company_name || "N/A";
    document.getElementById("meAckClient").textContent = lead?.client_name || "N/A";
    document.getElementById("meAckPhone").textContent = lead?.telephone || "N/A";
    document.getElementById("meAckEmail").textContent = lead?.email || "N/A";
    const meAckAddrParts = [lead?.flat_no, lead?.building_name, lead?.locality, lead?.city, lead?.pincode, lead?.state]
      .map(v => String(v || "").trim()).filter(Boolean);
    document.getElementById("meAckAddress").textContent = meAckAddrParts.length ? meAckAddrParts.join(", ") : "N/A";
    document.getElementById("meAckDate").textContent = new Date().toLocaleString();

    const productsTbody = document.getElementById("meAckProductsList");
    productsTbody.innerHTML = "";
    products.forEach(p => {
      const tr = document.createElement("tr");
      const desc = DC_SERVICE_DESCRIPTIONS[p.name] || '';
      tr.innerHTML = `
        <td>
          <span style="font-weight:600;">${p.name}</span>
          ${desc ? `<br><span style="font-size:11px; color:#64748b; font-style:italic;">${desc}</span>` : ''}
        </td>
        <td style="text-align: right; font-weight: 600;">Rs. ${Number(p.price || 0).toLocaleString("en-IN")}</td>
      `;
      productsTbody.appendChild(tr);
    });

    document.getElementById("meAckTotal").textContent = "Rs. " + Number(currentMeDealClosePayload.deal_amount).toLocaleString("en-IN");
    document.getElementById("meAckGst").textContent = "Rs. " + Number(currentMeDealClosePayload.total_gst_amount).toLocaleString("en-IN");
    const meAckPaidGstEl = document.getElementById("meAckPaidGst");
    if (meAckPaidGstEl) meAckPaidGstEl.textContent = "Rs. " + Number(currentMeDealClosePayload.gst_amount).toLocaleString("en-IN");
    const meAckRemainingGstEl = document.getElementById("meAckRemainingGst");
    if (meAckRemainingGstEl) meAckRemainingGstEl.textContent = "Rs. " + Number(currentMeDealClosePayload.remaining_gst_amount).toLocaleString("en-IN");
    document.getElementById("meAckPaid").textContent = "Rs. " + Number(currentMeDealClosePayload.received_amount).toLocaleString("en-IN");
    document.getElementById("meAckMethod").textContent = currentMeDealClosePayload.payment_method || "N/A";

    const scheduleSection = document.getElementById("meAckScheduleSection");
    if (currentMeDealClosePayload.part_payment_option && meDealInstallmentsSchedule.length > 0) {
      scheduleSection.style.display = "block";
      document.getElementById("meAckOptionLabel").textContent = currentMeDealClosePayload.part_payment_option;
      const scheduleTbody = document.getElementById("meAckScheduleList");
      scheduleTbody.innerHTML = "";
      meDealInstallmentsSchedule.forEach(inst => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>Installment #${inst.installmentNo}</td>
          <td>${inst.dueDate}</td>
          <td style="text-align: right; font-weight: 600;">Rs. ${Number(inst.amount).toLocaleString("en-IN")}</td>
        `;
        scheduleTbody.appendChild(tr);
      });
    } else {
      scheduleSection.style.display = "none";
    }

    const renewalSection = document.getElementById("meAckRenewalSection");
    const renewalTbody = document.getElementById("meAckRenewalList");
    const renewalProducts = currentMeDealClosePayload.service_renewal_enabled
      ? getMeDealRenewalProducts(products)
      : [];
    if (renewalSection && renewalTbody && renewalProducts.length) {
      const basis = currentMeDealClosePayload.service_renewal_basis || "monthly";
      const startDate = currentMeDealClosePayload.service_renewal_start_date || "";
      renewalSection.style.display = "block";
      document.getElementById("meAckRenewalBasis").textContent =
        ME_DEAL_RENEWAL_BASIS_LABELS[basis] || basis;
      renewalTbody.innerHTML = "";
      renewalProducts.forEach(product => {
        const amount = Number(product.amount ?? product.price ?? product.standardAmount ?? 0);
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>${escapeMeHtml(product.name || "-")}</td>
          <td>${escapeMeHtml(startDate || "-")}</td>
          <td style="text-align: right; font-weight: 600;">Rs. ${amount.toLocaleString("en-IN")}</td>
        `;
        renewalTbody.appendChild(tr);
      });
    } else if (renewalSection) {
      renewalSection.style.display = "none";
    }

    overlay.classList.remove("hidden");
  }

  function updateMeDealAcknowledgementHeaderImage(overlay, companyScope = "") {
    const image = overlay?.querySelector(".deal-ack-logo img");
    if (!image) return;

    const isRedsea = normalizeMeLeadCompanyScope(companyScope) === "redsea";
    image.src = isRedsea ? "acknowledge_redsea_img.png" : "acknowledge_img.png";
    image.alt = isRedsea ? "RED SEA DIGITALS" : "METRICS MART";
  }

  function finalizeMeDealClose() {
    const overlay = document.getElementById("meDealAckOverlay");
    if (overlay) {
      overlay.classList.add("hidden");
      overlay.removeAttribute("data-view-only");
    }

    showPopup("Success", "Deal closed successfully");
    refreshMEAfterAction();
  }

  window.closeMeDealAckView = function closeMeDealAckView() {
    const overlay = document.getElementById("meDealAckOverlay");
    if (overlay) {
      overlay.classList.add("hidden");
      overlay.removeAttribute("data-view-only");
    }
  };


window.openMeDealAckViewModal = async function openMeDealAckViewModal(dealId) {
    const overlay = document.getElementById("meDealAckOverlay");
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
  
      const companyScope = normalizeMeLeadCompanyScope(lead.company_scope || lead.companyScope || currentUser?.company_scope || currentUser?.company_key) || getDefaultMeLeadCompanyScope();
      updateMeDealAcknowledgementHeaderImage(overlay, companyScope);
  
      const address = [
        lead.flat_no, lead.building_name, lead.locality,
        lead.city, lead.pincode, lead.state,
      ].map((v) => String(v || "").trim()).filter(Boolean).join(", ");
  
      const setEl = (id, value) => {
        const el = document.getElementById(id);
        if (el) el.textContent = value;
      };
  
      setEl("meAckCompany", lead.company_name || "N/A");
      setEl("meAckClient", lead.client_name || "N/A");
      setEl("meAckPhone", lead.telephone || lead.contact || "N/A");
      setEl("meAckEmail", lead.email || "N/A");
      setEl("meAckAddress", address || "N/A");
      
      const closeDate = new Date(lead.closed_date || lead.updated_at);
      setEl("meAckDate", isNaN(closeDate) ? (lead.closed_date || "N/A") : closeDate.toLocaleString());
      
      setEl("meAckTotal", `Rs. ${Number(deal.deal_amount || lead.deal_amount || 0).toLocaleString("en-IN")}`);
      setEl("meAckPaid", `Rs. ${Number(deal.received_amount || lead.received_amount || 0).toLocaleString("en-IN")}`);
      setEl("meAckMethod", deal.payment_method || lead.payment_method || "N/A");
      
      const dealAmount = Number(deal.deal_amount || lead.deal_amount || 0);
      const receivedAmount = Number(deal.received_amount || lead.received_amount || 0);
      const totalGst = dealAmount - (dealAmount / 1.18);
      const paidGst = receivedAmount - (receivedAmount / 1.18);
      const remainingGst = totalGst - paidGst;
  
      setEl("meAckGst", `Rs. ${totalGst.toLocaleString("en-IN", {maximumFractionDigits: 2})}`);
      
      const paidGstEl = document.getElementById("meAckPaidGst");
      if (paidGstEl) paidGstEl.textContent = `Rs. ${paidGst.toLocaleString("en-IN", {maximumFractionDigits: 2})}`;
      
      const remainingGstEl = document.getElementById("meAckRemainingGst");
      if (remainingGstEl) remainingGstEl.textContent = `Rs. ${Math.max(0, remainingGst).toLocaleString("en-IN", {maximumFractionDigits: 2})}`;
  
      const productsTbody = document.getElementById("meAckProductsList");
      if (productsTbody) {
        productsTbody.innerHTML = "";
        if (products.length === 0) {
          productsTbody.innerHTML = `<tr><td colspan="2" style="text-align: center; color: #64748b;">No products found</td></tr>`;
        } else {
          products.forEach((product) => {
            const tr = document.createElement("tr");
            const name = product.product_name || product.name || "-";
            const desc = (typeof DC_SERVICE_DESCRIPTIONS !== "undefined" && DC_SERVICE_DESCRIPTIONS[name]) ? DC_SERVICE_DESCRIPTIONS[name] : "";
            const price = Number(product.product_amount ?? product.price ?? product.amount ?? 0);
            tr.innerHTML = `
              <td>
                <span style="font-weight:600;">${escapeMeHtml(name)}</span>
                ${desc ? `<br><span style="font-size:11px; color:#64748b; font-style:italic;">${escapeMeHtml(desc)}</span>` : ""}
              </td>
              <td style="text-align:right; font-weight:600;">Rs. ${price.toLocaleString("en-IN")}</td>
            `;
            productsTbody.appendChild(tr);
          });
        }
      }
  
      const scheduleSection = document.getElementById("meAckScheduleSection");
      const scheduleTbody = document.getElementById("meAckScheduleList");
      if (scheduleSection && scheduleTbody) {
        if (installments && installments.length > 0 && (deal.part_payment_option || lead.part_payment_option)) {
          scheduleSection.style.display = "block";
          setEl("meAckOptionLabel", deal.part_payment_option || lead.part_payment_option);
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
  
      const renewalSection = document.getElementById("meAckRenewalSection");
      const renewalTbody = document.getElementById("meAckRenewalList");
      if (renewalSection && renewalTbody) {
        if (renewals && renewals.length > 0) {
          renewalSection.style.display = "block";
          setEl("meAckRenewalBasis", renewals[0].basis || "Custom");
          renewalTbody.innerHTML = "";
          renewals.forEach((renewal) => {
            const tr = document.createElement("tr");
            tr.innerHTML = `
              <td>${escapeMeHtml(renewal.service || "-")}</td>
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
  };



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

  // ============== ME EDIT DEAL FUNCTIONS ==============

  let currentMeEditingDealId = null;
  let currentMeEditingDealData = null;

  async function openMeEditDealModal(event, dealId) {
      if (event) {
          event.preventDefault();
          event.stopPropagation();
      }

      currentMeEditingDealId = Number(dealId || 0);
      if (!currentMeEditingDealId) return;

      const modal = document.getElementById("meEditDealModal");
      if (!modal) return;

      try {
          const res = await fetch(`${BASE_URL}/api/leads/${currentMeEditingDealId}`, {
              cache: "no-store",
          });

          if (!res.ok) {
              throw new Error("Failed to load deal details");
          }

          const result = await res.json();
          if (!result.success || !result.data) {
              throw new Error(result.message || "Deal not found");
          }

          currentMeEditingDealData = result.data;
          populateMeEditDealForm(result.data);

          modal.classList.remove("hidden");
          document.body.classList.add("modal-open");
      } catch (err) {
          console.error("Error opening edit modal:", err);
          showPopup("Error", err.message || "Unable to open deal editor", false);
      }
  }

  function populateMeEditDealForm(deal) {
      const dealAmount = Number(deal.deal_amount || 0);
      const receivedAmount = getMeDealReceivedAmount(deal);

      document.getElementById("meEditDealAmount").value = dealAmount || 0;
      const recvEl = document.getElementById("meEditReceivedAmount");
      if (recvEl) recvEl.value = receivedAmount || 0;
      document.getElementById("meEditPaymentMethod").value = deal.payment_method || "";
      const payStatVal = deal.pay_stat || "pending";
      document.getElementById("meEditPaymentStatus").value = ["pending","received","failed"].includes(payStatVal) ? payStatVal : "pending";
      document.getElementById("meEditPaymentDate").value = formatDateForMeInput(deal.payment_date) || "";
      document.getElementById("meEditClosedDate").value = formatDateForMeInput(deal.closed_date) || "";
  }

  function formatDateForMeInput(dateString) {
      if (!dateString) return "";
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return "";
      return date.toISOString().split("T")[0];
  }

  function closeMeEditDealModal() {
      const modal = document.getElementById("meEditDealModal");
      if (!modal) return;

      modal.classList.add("hidden");
      document.body.classList.remove("modal-open");
      currentMeEditingDealId = null;
      currentMeEditingDealData = null;
      document.getElementById("meEditDealForm").reset();
  }

  function handleMeEditDealBackdrop(event) {
      if (event.target?.id === "meEditDealModal") {
          closeMeEditDealModal();
      }
  }

  async function handleMeEditDealSubmit(event) {
      event.preventDefault();

      if (!currentMeEditingDealId || !currentMeEditingDealData) {
          showPopup("Error", "Invalid deal", false);
          return;
      }

      const dealAmount = Number(document.getElementById("meEditDealAmount").value || 0);
      const receivedAmount = Number(document.getElementById("meEditReceivedAmount").value || 0);
      const paymentMethod = document.getElementById("meEditPaymentMethod").value.trim();
      const paymentStatus = document.getElementById("meEditPaymentStatus").value;
      const paymentDate = document.getElementById("meEditPaymentDate").value;
      const closedDate = document.getElementById("meEditClosedDate").value;

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

          const res = await fetch(`${BASE_URL}/api/deals/${currentMeEditingDealId}`, {
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

          closeMeEditDealModal();
          showPopup("Success", "Deal updated successfully", true);
          fetchDeals();
      } catch (err) {
          console.error("Error updating deal:", err);
          showPopup("Error", err.message || "Failed to update deal", false);
      }
  }

  document.addEventListener("DOMContentLoaded", function() {
      const form = document.getElementById("meEditDealForm");
      if (form) {
          form.addEventListener("submit", handleMeEditDealSubmit);
      }
  });

  // ====== ME Dashboard Month Filter & History Chart Helpers ======
  function getCurrentMonthKey() {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    return `${yyyy}-${mm}`;
  }

  function formatMonthKeyLabel(monthKey) {
    if (!monthKey || !monthKey.includes('-')) return monthKey;
    const [yyyy, mm] = monthKey.split('-');
    const date = new Date(Number(yyyy), Number(mm) - 1, 1);
    return date.toLocaleDateString("en-US", { month: "short", year: "numeric" });
  }

  async function parseMeJsonResponse(res, fallbackMessage) {
    const contentType = res.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
      throw new Error(fallbackMessage || "Server returned a non-JSON response.");
    }
    return res.json();
  }

  function handleMeDashboardMonthChange() {
    const monthInput = document.getElementById("dashboardMonthFilterME");
    handleMeMonthFilterChange(monthInput?.value || "");
  }

  async function loadMeMonthlyHistoryChart() {
    if (!currentUser?.id) return;
    try {
      const res = await fetch(
        `${BASE_URL}/api/sales-target-history?userId=${currentUser.id}&role=${currentUser.role}`,
        { cache: "no-store" }
      );
      const result = await parseMeJsonResponse(
        res,
        "Sales target history API is not available. Please restart the server."
      );
      if (!res.ok) {
        throw new Error(result.message || "Failed to load sales target history");
      }
      if (result && result.success && Array.isArray(result.data)) {
        renderMeMonthlyHistoryChart(result.data);
      }
    } catch (err) {
      console.error("Failed to load ME monthly history chart:", err);
    }
  }

  function renderMeMonthlyHistoryChart(historyData) {
    const canvas = document.getElementById("meMonthlyHistoryChart");
    if (!canvas?.getContext) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const labels = historyData.map(h => formatMonthKeyLabel(h.monthKey));
    const targets = historyData.map(h => h.target);
    const achievements = historyData.map(h =>
      Number(h.targetAchieved ?? h.paidWithoutGst ?? h.achieved ?? 0)
    );

    // Green (#22c55e) if without-GST achieved >= target, else orange (#f97316)
    const achievementColors = historyData.map(h => {
      const achieved = Number(h.targetAchieved ?? h.paidWithoutGst ?? h.achieved ?? 0);
      return achieved >= h.target ? "#22c55e" : "#f97316";
    });

    if (meMonthlyHistoryChart) {
      meMonthlyHistoryChart.destroy();
    }

    meMonthlyHistoryChart = new Chart(ctx, {
      type: "bar",
      data: {
        labels: labels,
        datasets: [
          {
            label: "Target Set",
            data: targets,
            backgroundColor: "#94a3b8", // slate grey
            borderRadius: 4,
            maxBarThickness: 32,
          },
          {
            label: "Without GST Achieved",
            data: achievements,
            backgroundColor: achievementColors,
            borderRadius: 4,
            maxBarThickness: 32,
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              callback: function(value) {
                return formatSalesTargetMoney(value);
              },
              font: {
                family: "'Segoe UI', sans-serif",
                size: 11
              },
              color: "#64748b"
            },
            grid: {
              color: "#f1f5f9"
            }
          },
          x: {
            grid: {
              display: false
            },
            ticks: {
              font: {
                family: "'Segoe UI', sans-serif",
                size: 11
              },
              color: "#64748b"
            }
          }
        },
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            backgroundColor: "#0f172a",
            titleFont: {
              family: "'Segoe UI', sans-serif",
              size: 12,
              weight: "bold"
            },
            bodyFont: {
              family: "'Segoe UI', sans-serif",
              size: 12
            },
            callbacks: {
              label: function(context) {
                let label = context.dataset.label || '';
                if (label) {
                  label += ': ';
                }
                if (context.parsed.y !== null) {
                  label += formatSalesTargetMoney(context.parsed.y);
                }
                return label;
              }
            }
          }
        }
      }
    });
  }

  // ====================== SYNC MONTH FILTERS ======================
  window.syncMonthFiltersME = function (selectedMonth) {
    const filters = [
      "dashboardMonthFilterME",
      "dealsMonthFilterME",
      "appointmentsMonthFilterME",
      "followupsMonthFilterME",
    ];
    filters.forEach((id) => {
      const el = document.getElementById(id);
      if (el && el.value !== selectedMonth) el.value = selectedMonth;
    });
  };

   window.handleMeMonthFilterChange = function (selectedMonth) {
    const monthValue = selectedMonth || "";
    syncMonthFiltersME(monthValue);
    const leadsFilter = document.getElementById("meLeadsMonthFilter");
    if (leadsFilter) leadsFilter.value = monthValue;
    if (typeof loadMeLeads === "function") loadMeLeads();
    loadMeDashboard(monthValue);
    if (typeof fetchDeals === "function") fetchDeals();
    if (typeof fetchMEData === "function") fetchMEData();
    if (typeof fetchFollowups === "function") fetchFollowups();
  };
  // ====================== ME DEALS PAYMENTS FLOW ======================
  function getTodayForInput() {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function roundMePaymentAmount(value) {
    const amount = Number(String(value ?? "").replace(/,/g, ""));
    if (!Number.isFinite(amount)) return 0;
    return Math.round((amount + Number.EPSILON) * 100) / 100;
  }

  function getMePaymentGstBreakup(amount) {
    const grossAmount = roundMePaymentAmount(amount);
    if (grossAmount <= 0) {
      return {
        amountWithoutGst: 0,
        gstAmount: 0,
      };
    }

    const amountWithoutGst = roundMePaymentAmount(grossAmount / 1.18);
    return {
      amountWithoutGst,
      gstAmount: roundMePaymentAmount(Math.max(grossAmount - amountWithoutGst, 0)),
    };
  }

  function formatMePaymentMoney(value) {
    return `Rs. ${roundMePaymentAmount(value).toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }

  function escapeMeInlineJsString(value) {
    return String(value ?? "")
      .replace(/\\/g, "\\\\")
      .replace(/'/g, "\\'")
      .replace(/\r?\n/g, " ");
  }

  function getMeInvoiceUrl(path, id, paymentId = 0, instAmt = 0) {
    const url = new URL(`${BASE_URL}/api/${path}/${id}`);
    if (paymentId) url.searchParams.set("paymentId", String(paymentId));
    if (instAmt) url.searchParams.set("instAmt", String(instAmt));
    return url.toString();
  }

  function downloadMeTaxInvoice(id, paymentId = 0, instAmt = 0) {
    window.open(getMeInvoiceUrl("tax-invoice", id, paymentId, instAmt), "_blank");
  }

  function downloadMeProformaInvoice(id, paymentId = 0, instAmt = 0) {
    window.open(getMeInvoiceUrl("invoice", id, paymentId, instAmt), "_blank");
  }

  function normalizeMeDealPayStatus(value) {
    const status = String(value || "")
      .toLowerCase()
      .trim();
    return ["pending", "received", "failed"].includes(status) ? status : "pending";
  }

  function formatMeLeadHumanLabel(value) {
    return String(value || "")
        .replace(/_/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .replace(/\b\w/g, char => char.toUpperCase()) || "-";
  }

  function updateMeDealPaymentBreakupPreview() {
    const amountInput = document.getElementById("meDealPaymentAmount");
    const withoutGstInput = document.getElementById("meDealPaymentWithoutGst");
    const gstInput = document.getElementById("meDealPaymentGstAmount");
    const rawAmount = amountInput ? amountInput.value : "";
    const breakup = getMePaymentGstBreakup(rawAmount);
    const hasAmount = rawAmount !== "" && roundMePaymentAmount(rawAmount) > 0;

    if (withoutGstInput) {
      withoutGstInput.value = hasAmount ? formatMePaymentMoney(breakup.amountWithoutGst) : "";
    }

    if (gstInput) {
      gstInput.value = hasAmount ? formatMePaymentMoney(breakup.gstAmount) : "";
    }
  }

  function getMeDealPaymentRenewalOptions() {
    const rawOptions =
      currentMeDealPaymentsData?.renewalOptions ||
      currentMeDealPaymentsData?.renewal_options ||
      [];
    return Array.isArray(rawOptions)
      ? rawOptions.filter((option) => Number(option.renewal_id || option.id || 0) > 0)
      : [];
  }

  function findMeDealPaymentRenewalOption(renewalId) {
    const normalizedId = Number(renewalId || 0);
    return getMeDealPaymentRenewalOptions().find(
      (option) => Number(option.renewal_id || option.id || 0) === normalizedId,
    ) || null;
  }

  function renderMeDealPaymentRenewalOptions() {
    const select = document.getElementById("meDealRenewalPaymentService");
    if (!select) return;

    const previousValue = select.value;
    const options = getMeDealPaymentRenewalOptions();
    select.innerHTML = "";

    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = options.length
      ? "Select renewal service"
      : "No renewal services configured";
    select.appendChild(placeholder);

    options.forEach((option) => {
      const renewalId = Number(option.renewal_id || option.id || 0);
      const amount = roundMePaymentAmount(option.service_amount || option.amount || 0);
      const dueDate = option.renewal_due_date
        ? ` | Due ${formatDate(option.renewal_due_date)}`
        : "";
      const optionEl = document.createElement("option");
      optionEl.value = String(renewalId);
      optionEl.textContent = `${option.service_name || "Service"} | ${formatMeDashboardMoney(amount)}${dueDate}`;
      select.appendChild(optionEl);
    });

    if (previousValue && options.some((option) => String(option.renewal_id || option.id || 0) === previousValue)) {
      select.value = previousValue;
    } else if (options.length) {
      select.value = String(options[0].renewal_id || options[0].id || "");
    }
  }

  function handleMeDealRenewalPaymentServiceChange() {
    const select = document.getElementById("meDealRenewalPaymentService");
    const amountInput = document.getElementById("meDealPaymentAmount");
    const cycleInput = document.getElementById("meDealRenewalCycleDate");
    const amountPreview = document.getElementById("meDealRenewalAmountPreview");
    const selectedOption = findMeDealPaymentRenewalOption(select?.value);

    if (!selectedOption) {
      if (amountInput) amountInput.value = "";
      if (cycleInput) cycleInput.value = "";
      if (amountPreview) amountPreview.value = "";
      updateMeDealPaymentBreakupPreview();
      return;
    }

    const renewalAmount = roundMePaymentAmount(
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
        ? formatMeDashboardMoney(renewalAmount)
        : "Amount missing";
    }
    updateMeDealPaymentBreakupPreview();
  }

  function handleMeDealPaymentTypeChange() {
    const typeSelect = document.getElementById("meDealPaymentType");
    const renewalRow = document.getElementById("meDealRenewalPaymentRow");
    const renewalSelect = document.getElementById("meDealRenewalPaymentService");
    const cycleInput = document.getElementById("meDealRenewalCycleDate");
    const amountInput = document.getElementById("meDealPaymentAmount");
    const amountPreview = document.getElementById("meDealRenewalAmountPreview");
    const summary = currentMeDealPaymentsData?.summary || {};
    const isRenewal = typeSelect?.value === "renewal";

    renewalRow?.classList.toggle("hidden", !isRenewal);
    if (renewalSelect) renewalSelect.required = isRenewal;
    if (cycleInput) cycleInput.required = isRenewal;

    if (isRenewal) {
      renderMeDealPaymentRenewalOptions();
      if (amountInput) {
        amountInput.readOnly = true;
        amountInput.removeAttribute("max");
        amountInput.placeholder = "Auto from renewal service";
      }
      handleMeDealRenewalPaymentServiceChange();
      return;
    }

    if (amountInput) {
      amountInput.readOnly = false;
      amountInput.value = "";
      amountInput.max = String(Math.max(Number(summary.remainingAmount || 0), 0));
      amountInput.placeholder = summary.remainingAmount
        ? `Max ${formatMeDashboardMoney(summary.remainingAmount)}`
        : "Fully paid";
    }
    if (amountPreview) amountPreview.value = "";
    if (renewalSelect) renewalSelect.value = "";
    if (cycleInput) cycleInput.value = "";
    updateMeDealPaymentBreakupPreview();
  }

  async function openMeDealPaymentsModal(event, leadId) {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }

    currentMeDealPaymentsLeadId = Number(leadId || 0);
    const modal = document.getElementById("meDealPaymentsModal");
    if (!modal || !currentMeDealPaymentsLeadId) return;

    modal.classList.remove("hidden");
    document.getElementById("meDealPaymentLeadId").value = String(currentMeDealPaymentsLeadId);
    document.getElementById("meDealPaymentForm")?.reset();
    setMeDealPaymentDefaultDate();
    handleMeDealPaymentTypeChange();
    await loadMeDealPayments(currentMeDealPaymentsLeadId);
  }

  function setMeDealPaymentDefaultDate() {
    const dateInput = document.getElementById("meDealPaymentDate");
    if (dateInput) {
      dateInput.value = getTodayForInput();
    }
    updateMeDealPaymentBreakupPreview();
  }

  function handleMeDealPaymentsBackdrop(event) {
    if (event.target?.id === "meDealPaymentsModal") {
      closeMeDealPaymentsModal();
    }
  }

  function closeMeDealPaymentsModal() {
    document.getElementById("meDealPaymentsModal")?.classList.add("hidden");
    currentMeDealPaymentsLeadId = null;
    currentMeDealPaymentsData = null;
  }

  function renderMeDealPaymentsSummary(result = {}) {
    const container = document.getElementById("meDealPaymentsSummary");
    if (!container) return;

    const lead = result.lead || {};
    const summary = result.summary || {};
    const titleEl = document.getElementById("meDealPaymentsModalTitle");
    const subtitleEl = document.getElementById("meDealPaymentsModalSubtitle");

    if (titleEl) {
      titleEl.textContent = `${lead.company_name || lead.client_name || "Deal"} Payments`;
    }
    if (subtitleEl) {
      subtitleEl.textContent = lead.part_payment_option
        ? `Schedule: ${lead.part_payment_option}`
        : "Manage installments and invoices.";
    }

    container.innerHTML = `
      <div><span>Deal Amount</span><strong>${escapeMeHtml(formatMeDashboardMoney(summary.dealAmount || lead.deal_amount || 0))}</strong></div>
      <div><span>Received</span><strong>${escapeMeHtml(formatMeDashboardMoney(summary.receivedAmount || 0))}</strong></div>
      <div><span>Balance</span><strong>${escapeMeHtml(formatMeDashboardMoney(summary.remainingAmount || 0))}</strong></div>
    `;

    const scheduleContainer = document.getElementById("meAgreedInstallmentScheduleContainer");
    const scheduleList = document.getElementById("meAgreedInstallmentScheduleList");
    if (scheduleContainer && scheduleList) {
      let scheduleData = [];
      try {
        if (lead.part_payment_schedule) {
          scheduleData = typeof lead.part_payment_schedule === "string"
            ? JSON.parse(lead.part_payment_schedule)
            : lead.part_payment_schedule;
        }
      } catch (err) {
        console.error("ME installment schedule parse error:", err);
      }

      if (Array.isArray(scheduleData) && scheduleData.length) {
        scheduleContainer.classList.remove("hidden");
        scheduleList.innerHTML = scheduleData.map((installment, index) => `
          <div class="agreed-schedule-card">
            <span>Installment #${escapeMeHtml(installment.installmentNo || index + 1)}</span>
            <strong>${escapeMeHtml(formatMeDashboardMoney(installment.amount || 0))}</strong>
            <small><i class="far fa-calendar-alt"></i> Due: ${escapeMeHtml(formatDate(installment.dueDate))}</small>
          </div>
        `).join("");
      } else {
        scheduleContainer.classList.add("hidden");
        scheduleList.innerHTML = "";
      }
    }

    const amountInput = document.getElementById("meDealPaymentAmount");
    const currentPaymentType = document.getElementById("meDealPaymentType")?.value || "installment";
    if (amountInput && currentPaymentType !== "renewal") {
      amountInput.max = String(Math.max(Number(summary.remainingAmount || 0), 0));
      amountInput.placeholder = summary.remainingAmount
        ? `Max ${formatMeDashboardMoney(summary.remainingAmount)}`
        : "Fully paid";
    }
    updateMeDealPaymentBreakupPreview();
  }

  function renderMeInvoiceRowPaymentStatusSelect(leadId, paymentId, payStatus) {
    const normalizedStatus = normalizeMeDealPayStatus(payStatus);
    const normalizedLeadId = Number(leadId || 0);
    const normalizedPaymentId = Number(paymentId || 0);
    return `
      <select
        class="payment-status invoice-row-status ${normalizedStatus}"
        data-current-status="${normalizedStatus}"
        onchange="updateMeInvoiceRowPaymentStatus(${normalizedLeadId}, ${normalizedPaymentId}, this.value, this)"
      >
        <option value="pending" ${normalizedStatus === "pending" ? "selected" : ""}>Pending</option>
        <option value="received" ${normalizedStatus === "received" ? "selected" : ""}>Received</option>
        <option value="failed" ${normalizedStatus === "failed" ? "selected" : ""}>Failed</option>
      </select>
    `;
  }

  function renderMeScheduledInvoicesTable(payments = [], leadId = currentMeDealPaymentsLeadId) {
    const container = document.getElementById("meScheduledInvoicesContainer");
    if (!container) return;

    const deal = currentMeDealPaymentsData?.deal || {};
    const lead = currentMeDealPaymentsData?.lead || {};
    const summary = currentMeDealPaymentsData?.summary || {};
    const contactArg = escapeMeInlineJsString(lead.contact || deal.contact || "");
    const emailArg = escapeMeInlineJsString(lead.email || deal.email || "");
    const leadPayStatus = normalizeMeDealPayStatus(summary.payStatus || lead.pay_stat);
    const receivedPayments = payments.filter(
      (payment) =>
        normalizeMeDealPayStatus(payment.payment_status) === "received" &&
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
        status: normalizeMeDealPayStatus(payment.payment_status),
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
      const payDateFormatted = formatDate(row.paymentDate);
      const paymentId = row.paymentId;
      const instAmt = row.isDownPayment ? 0 : row.instAmt;
      const rowStatus = normalizeMeDealPayStatus(row.status);
      const statusSelect = renderMeInvoiceRowPaymentStatusSelect(leadId, paymentId, rowStatus);
      const proformaActions = `
        <div class="invoice-actions">
          <button onclick="downloadMeProformaInvoice(${leadId}, ${paymentId}, ${instAmt})" class="invoice-btn invoice-download" title="Download Proforma Invoice"><i class="fas fa-download"></i></button>
          <button onclick="shareMeProformaInvoiceWhatsApp(${leadId}, '${contactArg}', ${paymentId}, ${instAmt})" class="invoice-btn invoice-whatsapp" title="Share on WhatsApp"><i class="fab fa-whatsapp"></i></button>
          <button onclick="shareMeProformaInvoiceGmail('${emailArg}', ${leadId}, ${paymentId}, ${instAmt})" class="invoice-btn invoice-gmail" title="Share via Gmail"><i class="fas fa-envelope"></i></button>
        </div>
      `;
      const taxActions = rowStatus === "received"
        ? `
          <div class="invoice-actions">
            <button onclick="downloadMeTaxInvoice(${leadId}, ${paymentId}, ${instAmt})" class="invoice-btn invoice-download" title="Download Tax Invoice"><i class="fas fa-download"></i></button>
            <button onclick="shareMeTaxInvoiceWhatsApp(${leadId}, '${contactArg}', ${paymentId}, ${instAmt})" class="invoice-btn invoice-whatsapp" title="Share on WhatsApp"><i class="fab fa-whatsapp"></i></button>
            <button onclick="shareMeTaxInvoiceGmail('${emailArg}', ${leadId}, ${paymentId}, ${instAmt})" class="invoice-btn invoice-gmail" title="Share via Gmail"><i class="fas fa-envelope"></i></button>
          </div>
        `
        : `<span class="invoice-pending">Mark Received to unlock</span>`;

      return `
        <tr>
          <td>${escapeMeHtml(row.label)}</td>
          <td>${escapeMeHtml(formatMeDashboardMoney(row.amount))}</td>
          <td>${escapeMeHtml(payDateFormatted)}</td>
          <td>${escapeMeHtml(payDateFormatted)}</td>
          <td>${proformaActions}</td>
          <td>${statusSelect}</td>
          <td>${escapeMeHtml(payDateFormatted)}</td>
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

  function renderMeDealPaymentsTable(payments = [], leadId = currentMeDealPaymentsLeadId) {
    const tbody = document.getElementById("meDealPaymentsTableBody");
    if (!tbody) return;

    if (!payments.length) {
      tbody.innerHTML = `<tr><td colspan="10">No payment entries yet</td></tr>`;
      return;
    }

    const deal = currentMeDealPaymentsData?.deal || {};
    const summary = currentMeDealPaymentsData?.summary || {};
    const leadPayStatus = normalizeMeDealPayStatus(summary.payStatus || deal.pay_stat);
    const contactArg = escapeMeHtml(escapeMeInlineJsString(deal.contact || ""));
    const emailArg = escapeMeHtml(escapeMeInlineJsString(deal.email || ""));

    tbody.innerHTML = payments.map((payment) => {
      const paymentId = Number(payment.id || 0);
      const status = normalizeMeDealPayStatus(payment.payment_status);
      const isRenewalPayment = String(payment.payment_type || "").toLowerCase() === "renewal";
      const paymentLabel = payment.payment_label || (
        isRenewalPayment
          ? `Renewal - ${payment.renewal_service_name || "Service"}`
          : `Payment ${payment.sequence_no || ""}`
      );
      const fallbackBreakup = getMePaymentGstBreakup(payment.amount);
      const amountWithoutGst = hasMeStoredAmount(payment.amount_without_gst)
        ? Number(payment.amount_without_gst || 0)
        : fallbackBreakup.amountWithoutGst;
      const gstAmount = hasMeStoredAmount(payment.gst_amount)
        ? Number(payment.gst_amount || 0)
        : fallbackBreakup.gstAmount;
      const taxInvoice = status === "received" && (leadPayStatus === "received" || isRenewalPayment)
        ? `
          <div class="invoice-actions">
            <button onclick="downloadMeTaxInvoice(${leadId}, ${paymentId})" class="invoice-btn invoice-download" title="Download Tax Invoice"><i class="fas fa-download"></i></button>
            <button onclick="shareMeTaxInvoiceWhatsApp(${leadId}, '${contactArg}', ${paymentId})" class="invoice-btn invoice-whatsapp" title="Share on WhatsApp"><i class="fab fa-whatsapp"></i></button>
            <button onclick="shareMeTaxInvoiceGmail('${emailArg}', ${leadId}, ${paymentId})" class="invoice-btn invoice-gmail" title="Share via Gmail"><i class="fas fa-envelope"></i></button>
          </div>
        `
        : status === "received"
          ? `<span class="invoice-pending">Mark payment status Received</span>`
          : `<span class="invoice-pending">Pending</span>`;
      const proformaInvoice = status !== "failed"
        ? `
          <div class="invoice-actions">
            <button onclick="downloadMeProformaInvoice(${leadId}, ${paymentId})" class="invoice-btn invoice-download" title="Download Proforma Invoice"><i class="fas fa-download"></i></button>
            <button onclick="shareMeProformaInvoiceWhatsApp(${leadId}, '${contactArg}', ${paymentId})" class="invoice-btn invoice-whatsapp" title="Share on WhatsApp"><i class="fab fa-whatsapp"></i></button>
            <button onclick="shareMeProformaInvoiceGmail('${emailArg}', ${leadId}, ${paymentId})" class="invoice-btn invoice-gmail" title="Share via Gmail"><i class="fas fa-envelope"></i></button>
          </div>
        `
        : `<span class="invoice-pending">Pending</span>`;

      return `
        <tr>
          <td>
            <div class="deal-payment-label">
              <span>${escapeMeHtml(paymentLabel)}</span>
              ${isRenewalPayment ? `<small class="deal-payment-type renewal">Renewal</small>` : ""}
            </div>
          </td>
          <td>${escapeMeHtml(formatDate(payment.payment_date))}</td>
          <td>${escapeMeHtml(formatMeDashboardMoney(payment.amount))}</td>
          <td>${escapeMeHtml(formatMePaymentMoney(amountWithoutGst))}</td>
          <td>${escapeMeHtml(formatMePaymentMoney(gstAmount))}</td>
          <td>${escapeMeHtml(payment.payment_method || "-")}</td>
          <td><span class="payment-status ${status}">${escapeMeHtml(formatMeLeadHumanLabel(status))}</span></td>
          <td>${escapeMeHtml(payment.notes || "-")}</td>
          <td>${taxInvoice}</td>
          <td>${proformaInvoice}</td>
        </tr>
      `;
    }).join("");
  }

  async function loadMeDealPayments(leadId = currentMeDealPaymentsLeadId) {
    if (!leadId) return;

    const tbody = document.getElementById("meDealPaymentsTableBody");
    if (tbody) tbody.innerHTML = `<tr><td colspan="10">Loading payments...</td></tr>`;

    try {
      const res = await fetch(`${BASE_URL}/api/deal-payments/${leadId}`, { cache: "no-store" });
      const result = await res.json();
      if (!res.ok || !result.success) {
        throw new Error(result.message || "Failed to load payments");
      }

      currentMeDealPaymentsData = result;
      renderMeDealPaymentsSummary(result);
      renderMeDealPaymentRenewalOptions();
      handleMeDealPaymentTypeChange();
      renderMeDealPaymentsTable(result.data || [], leadId);
      renderMeScheduledInvoicesTable(result.data || [], leadId);
    } catch (err) {
      console.error("ME deal payments load error:", err);
      if (tbody) {
        tbody.innerHTML = `<tr><td colspan="10">${escapeMeHtml(err.message || "Failed to load payments")}</td></tr>`;
      }
    }
  }

  async function handleMeDealPaymentSubmit(event) {
    event.preventDefault();

    const leadId = Number(
      document.getElementById("meDealPaymentLeadId")?.value ||
      currentMeDealPaymentsLeadId ||
      0,
    );
    if (!leadId) return;

    const paymentType = document.getElementById("meDealPaymentType")?.value === "renewal"
      ? "renewal"
      : "installment";
    let amountValue = document.getElementById("meDealPaymentAmount")?.value || "";
    let renewalOption = null;

    if (paymentType === "renewal") {
      renewalOption = findMeDealPaymentRenewalOption(
        document.getElementById("meDealRenewalPaymentService")?.value,
      );
      if (!renewalOption) {
        showPopup("Renewal Required", "Select a renewal service first.", false);
        return;
      }

      const renewalAmount = roundMePaymentAmount(
        renewalOption.service_amount || renewalOption.amount || 0,
      );
      if (renewalAmount <= 0) {
        showPopup("Renewal Amount Missing", "Selected renewal service has no amount.", false);
        return;
      }

      amountValue = renewalAmount.toFixed(2);
      const amountInput = document.getElementById("meDealPaymentAmount");
      if (amountInput) amountInput.value = amountValue;
    }

    const paymentBreakup = getMePaymentGstBreakup(amountValue);
    const formData = new FormData();
    formData.append("payment_type", paymentType);
    formData.append("amount", amountValue);
    formData.append("amount_without_gst", paymentBreakup.amountWithoutGst.toFixed(2));
    formData.append("gst_amount", paymentBreakup.gstAmount.toFixed(2));
    formData.append("payment_date", document.getElementById("meDealPaymentDate")?.value || "");
    formData.append("payment_method", document.getElementById("meDealPaymentMethod")?.value || "");
    formData.append("transaction_id", document.getElementById("meDealPaymentTransactionId")?.value || "");
    formData.append("bank_name", document.getElementById("meDealPaymentBankName")?.value || "");
    formData.append("notes", document.getElementById("meDealPaymentNotes")?.value || "");
    formData.append("payment_status", "received");
    formData.append("created_by", currentUser?.id || "");
    formData.append("created_by_name", currentUser?.name || "");

    if (paymentType === "renewal" && renewalOption) {
      const serviceName = renewalOption.service_name || renewalOption.serviceName || "Service";
      const cycleDate =
        document.getElementById("meDealRenewalCycleDate")?.value ||
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
      document.getElementById("meDealPaymentForm")?.reset();
      setMeDealPaymentDefaultDate();
      await loadMeDealPayments(leadId);
      await fetchDeals();
    } catch (err) {
      console.error("ME deal payment save error:", err);
      showPopup("Payment Error", err.message || "Failed to save payment", false);
    }
  }

  async function updateMePaymentStatus(leadId, status, el) {
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
      await fetchDeals();
      if (Number(currentMeDealPaymentsLeadId || 0) === Number(leadId || 0)) {
        await loadMeDealPayments(leadId);
      }
    } catch (err) {
      console.error("ME payment status update error:", err);
      showPopup("Error", err.message || "Payment status update failed", false);
    }
  }

  async function updateMeInvoiceRowPaymentStatus(leadId, paymentId, status, el) {
    const normalizedLeadId = Number(leadId || 0);
    const normalizedPaymentId = Number(paymentId || 0);
    if (!normalizedLeadId) return;

    if (!normalizedPaymentId) {
      await updateMePaymentStatus(normalizedLeadId, status, el);
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
      await loadMeDealPayments(normalizedLeadId);
      await fetchDeals();
    } catch (err) {
      console.error("ME invoice payment status update error:", err);
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

  async function shareMeProformaInvoiceWhatsApp(id, phone, paymentId = 0, instAmt = 0) {
    try {
      const apiUrl = getMeInvoiceUrl("invoice", id, paymentId, instAmt);
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

      const url = getMeInvoiceUrl("invoice", id, paymentId, instAmt);
      const waUrl = `https://wa.me/${phone}?text=${encodeURIComponent(`Proforma Invoice: ${url}`)}`;
      window.open(waUrl, "_blank");
    } catch (err) {
      console.error("ME proforma WhatsApp error:", err);
      showPopup("Error", "Failed to share proforma invoice", false);
    }
  }

  async function shareMeTaxInvoiceWhatsApp(id, phone, paymentId = 0, instAmt = 0) {
    try {
      const apiUrl = getMeInvoiceUrl("tax-invoice", id, paymentId, instAmt);
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

      const url = getMeInvoiceUrl("tax-invoice", id, paymentId, instAmt);
      const waUrl = `https://wa.me/${phone}?text=${encodeURIComponent(`Tax Invoice: ${url}`)}`;
      window.open(waUrl, "_blank");
    } catch (err) {
      console.error("ME tax WhatsApp error:", err);
      showPopup("Error", "Could not share via WhatsApp", false);
    }
  }

  async function shareMeTaxInvoiceGmail(email, id, paymentId = 0, instAmt = 0) {
    if (!email) {
      showPopup("Error", "Email not available", false);
      return;
    }

    try {
      const pdfUrl = getMeInvoiceUrl("tax-invoice", id, paymentId, instAmt);
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
      console.error("ME tax Gmail error:", err);
      showPopup("Error", "Could not share via Gmail", false);
    }
  }

  async function shareMeProformaInvoiceGmail(email, id, paymentId = 0, instAmt = 0) {
    if (!email) {
      showPopup("Error", "Email not available", false);
      return;
    }

    try {
      const pdfUrl = getMeInvoiceUrl("invoice", id, paymentId, instAmt);
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
      console.error("ME proforma Gmail error:", err);
      showPopup("Error", "Failed to share proforma invoice", false);
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

