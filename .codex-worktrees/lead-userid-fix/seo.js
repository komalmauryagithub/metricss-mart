function getDeliveryRoleKey() {
  try {
    const user = JSON.parse(localStorage.getItem("currentUser") || "null") || {};
    const role = String(user.role || "").toLowerCase().trim();
    return role === "smo" ? "smo" : "seo";
  } catch (_error) {
    return "seo";
  }
}

const deliveryRoleKey = getDeliveryRoleKey();
const deliveryRoleLabel = deliveryRoleKey.toUpperCase();

window.DASHBOARD_CONFIG = Object.assign({}, window.DASHBOARD_CONFIG || {}, {
  userLabel: deliveryRoleLabel,
  reportStorageKey: `${deliveryRoleKey}ReportCounts`,
  phaseTrackerDraftsKey: `${deliveryRoleKey}PhaseTrackerDraftsV1`,
  projectsEndpoint: `/api/${deliveryRoleKey}/projects`,
});

function getSeoTodayDate() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseSeoWorkDetails(notes = "") {
  const details = {};
  const text = String(notes || "").trim();

  if (!text) return details;

  text.split(/\r?\n/).forEach((line) => {
    const separatorIndex = line.indexOf(":");
    if (separatorIndex < 0) return;

    const key = line.slice(0, separatorIndex).trim().toLowerCase();
    const value = line.slice(separatorIndex + 1).trim();
    if (key) details[key] = value;
  });

  if (!details["work description"] && !text.includes(":")) {
    details["work description"] = text;
  }

  return details;
}

function getSeoFieldValue(fieldName, fallback = "") {
  return String(
    document.querySelector(`[data-seo-basic-field="${fieldName}"]`)?.value ??
      fallback,
  ).trim();
}

function buildSeoWorkNotes(fields = {}) {
  const lines = [
    ["Client Name", fields.clientName],
    ["Website URL", fields.websiteUrl],
    ["Project Name", fields.projectName],
    ["Task Date", fields.taskDate],
    ["Work Type", fields.workType],
    ["Task Title", fields.taskTitle],
    ["Work Description", fields.workDescription],
    ["Keywords Worked On", fields.keywordsWorkedOn],
    ["Number of Backlinks Created", fields.backlinksCreated],
    ["Blogs Uploaded", fields.blogsUploaded],
    ["Pages Optimized", fields.pagesOptimized],
    ["Work Status", fields.statusLabel],
    ["Completion Percentage", `${fields.progress}%`],
  ];

  return lines
    .filter(([, value]) => String(value || "").trim())
    .map(([label, value]) => `${label}: ${value}`)
    .join("\n");
}

function getSeoProofFiles() {
  if (!phaseTrackerState || !Array.isArray(phaseTrackerState.phases)) return [];

  return phaseTrackerState.phases.flatMap((phase) =>
    normalizePhaseAttachmentsValue(phase.attachments),
  );
}

function getSeoProofUrl(file = {}) {
  const rawUrl = String(file.url || file.path || "").trim();
  if (!rawUrl) return "";
  if (typeof toAbsoluteTrackerShareUrl === "function") {
    return toAbsoluteTrackerShareUrl(rawUrl);
  }
  if (/^https?:\/\//i.test(rawUrl)) return rawUrl;
  return `${window.location.origin}${rawUrl.startsWith("/") ? "" : "/"}${rawUrl}`;
}

function getSeoClientPhone(assignment = {}) {
  return String(
    assignment.clientContact ||
      assignment.clientTelephone ||
      assignment.clientAlternateContact ||
      "",
  ).replace(/\D/g, "");
}

function buildSeoClientShareMessage() {
  window.syncSeoBasicTrackerFields?.();

  const fields = {
    clientName: getSeoFieldValue("clientName"),
    websiteUrl: getSeoFieldValue("websiteUrl"),
    projectName: getSeoFieldValue("projectName"),
    taskDate: getSeoFieldValue("taskDate"),
    workType: getSeoFieldValue("workType"),
    taskTitle: getSeoFieldValue("taskTitle"),
    workDescription: getSeoFieldValue("workDescription"),
    keywordsWorkedOn: getSeoFieldValue("keywordsWorkedOn"),
    backlinksCreated: getSeoFieldValue("backlinksCreated"),
    blogsUploaded: getSeoFieldValue("blogsUploaded"),
    pagesOptimized: getSeoFieldValue("pagesOptimized"),
    progress: clampPhaseProgress(getSeoFieldValue("progress"), 0),
  };
  const statusValue = getSeoFieldValue("status", "pending");
  fields.statusLabel =
    statusValue === "completed"
      ? "Completed"
      : statusValue === "ongoing"
        ? "In Progress"
        : "Pending";

  const proofLinks = getSeoProofFiles()
    .map((file) => getSeoProofUrl(file))
    .filter(Boolean);

  return [
    "SEO Work Update",
    "",
    buildSeoWorkNotes(fields),
    proofLinks.length
      ? `\nProof:\n${proofLinks.map((url, index) => `${index + 1}. ${url}`).join("\n")}`
      : "",
  ]
    .filter(Boolean)
    .join("\n");
}

function shareSeoWorkWithClient(channel) {
  const assignment = phaseTrackerState?.assignment || {};
  const message = buildSeoClientShareMessage();

  if (channel === "email") {
    const email = String(assignment.clientEmail || "").trim();
    if (!email) {
      showPopup("Client Email Missing", "Client email available nahi hai.", false);
      return;
    }

    const subject = `SEO Work Update - ${getSeoFieldValue("projectName", assignment.projectName || "Project")}`;
    window.location.href = `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(message)}`;
    return;
  }

  const phone = getSeoClientPhone(assignment);
  if (!phone) {
    showPopup("Client Number Missing", "Client WhatsApp number available nahi hai.", false);
    return;
  }

  window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, "_blank", "noopener");
}

function installSeoBasicTracker() {
  if (
    typeof getPhaseTrackerElements !== "function" ||
    typeof summarizePhaseState !== "function" ||
    typeof savePhaseTracker !== "function"
  ) {
    setTimeout(installSeoBasicTracker, 0);
    return;
  }

  const originalSavePhaseTracker = savePhaseTracker;

  window.renderPhaseTracker = function renderSeoBasicTracker() {
    const elements = getPhaseTrackerElements();
    const { title, subtitle, overview, body, saveBtn, saveNote } = elements;

    if (!phaseTrackerState) return;

    const assignment = phaseTrackerState.assignment || {};
    const phases = Array.isArray(phaseTrackerState.phases)
      ? phaseTrackerState.phases
      : [];
    const summary = summarizePhaseState(phases);
    const projectName = assignment.projectName || "SEO Project";
    const clientName = assignment.client || "Client";
    const progress = clampPhaseProgress(summary.progress, 0);
    const activePhaseIndex = Math.max(
      0,
      phases.findIndex(
        (phase) => normalizePhaseStatusValue(phase.status) !== "completed",
      ),
    );
    const proofPhaseIndex = phases.length ? phases.length - 1 : 0;
    const proofPhase = phases[proofPhaseIndex] || {};
    const proofFiles = normalizePhaseAttachmentsValue(proofPhase.attachments);
    const currentPhase = phases[activePhaseIndex] || {};
    const details = parseSeoWorkDetails(currentPhase.notes || "");
    const statusValue =
      summary.status === "completed"
        ? "completed"
        : summary.status === "ongoing"
          ? "ongoing"
          : "pending";
    const taskDate = details["task date"] || getSeoTodayDate();
    const workType = details["work type"] || "On-Page";

    if (title) title.textContent = projectName;
    if (subtitle) subtitle.textContent = "Update Work -> Upload Proof -> Submit";

    if (overview) {
      overview.innerHTML = `
        <div class="seo-basic-summary">
          <div>
            <span>Total Work</span>
            <strong>${progress}%</strong>
          </div>
          <div>
            <span>Completed</span>
            <strong>${summary.completedCount || 0}</strong>
          </div>
          <div>
            <span>Pending</span>
            <strong>${Math.max(0, (summary.totalPhases || 0) - (summary.completedCount || 0))}</strong>
          </div>
        </div>
      `;
    }

    if (body) {
      body.innerHTML = `
        <div class="seo-basic-tracker">
          <div class="seo-basic-row two">
            <div class="seo-basic-field">
              <label>Client Name</label>
              <input type="text" value="${escapeHtml(details["client name"] || clientName)}" data-seo-basic-field="clientName" />
            </div>

            <div class="seo-basic-field">
              <label>Website URL</label>
              <input type="url" value="${escapeHtml(details["website url"] || "")}" data-seo-basic-field="websiteUrl" placeholder="https://example.com" />
            </div>
          </div>

          <div class="seo-basic-row two">
            <div class="seo-basic-field">
              <label>Project Name</label>
              <input type="text" value="${escapeHtml(details["project name"] || projectName)}" data-seo-basic-field="projectName" />
            </div>

            <div class="seo-basic-field">
              <label>Task Date</label>
              <input type="date" value="${escapeHtml(taskDate)}" data-seo-basic-field="taskDate" />
            </div>
          </div>

          <div class="seo-basic-row two">
            <div class="seo-basic-field">
              <label>Work Type</label>
              <select data-seo-basic-field="workType">
                <option value="On-Page" ${workType === "On-Page" ? "selected" : ""}>On-Page</option>
                <option value="Off-Page" ${workType === "Off-Page" ? "selected" : ""}>Off-Page</option>
                <option value="Technical SEO" ${workType === "Technical SEO" ? "selected" : ""}>Technical SEO</option>
                <option value="Content" ${workType === "Content" ? "selected" : ""}>Content</option>
              </select>
            </div>

            <div class="seo-basic-field">
              <label>Task Title</label>
              <input type="text" value="${escapeHtml(details["task title"] || "")}" data-seo-basic-field="taskTitle" placeholder="Meta Tags Update" />
            </div>
          </div>

          <div class="seo-basic-field">
            <label>Work Description</label>
            <textarea data-seo-basic-field="workDescription" placeholder="Short work update">${escapeHtml(details["work description"] || "")}</textarea>
          </div>

          <div class="seo-basic-field">
            <label>Keywords Worked On</label>
            <textarea data-seo-basic-field="keywordsWorkedOn" placeholder="keyword 1, keyword 2">${escapeHtml(details["keywords worked on"] || "")}</textarea>
          </div>

          <div class="seo-basic-row three">
            <div class="seo-basic-field">
              <label>Number of Backlinks Created</label>
              <input type="number" min="0" value="${escapeHtml(details["number of backlinks created"] || "0")}" data-seo-basic-field="backlinksCreated" />
            </div>

            <div class="seo-basic-field">
              <label>Blogs Uploaded</label>
              <input type="number" min="0" value="${escapeHtml(details["blogs uploaded"] || "0")}" data-seo-basic-field="blogsUploaded" />
            </div>

            <div class="seo-basic-field">
              <label>Pages Optimized</label>
              <input type="number" min="0" value="${escapeHtml(details["pages optimized"] || "0")}" data-seo-basic-field="pagesOptimized" />
            </div>
          </div>

          <div class="seo-basic-row two">
            <div class="seo-basic-field">
              <label>Work Status</label>
              <select data-seo-basic-field="status">
                <option value="pending" ${statusValue === "pending" ? "selected" : ""}>Pending</option>
                <option value="ongoing" ${statusValue === "ongoing" ? "selected" : ""}>In Progress</option>
                <option value="completed" ${statusValue === "completed" ? "selected" : ""}>Completed</option>
              </select>
            </div>

            <div class="seo-basic-field">
              <label>Completion Percentage</label>
              <input type="number" min="0" max="100" value="${progress}" data-seo-basic-field="progress" />
            </div>
          </div>

          <div class="seo-basic-field">
            <label>Upload Proof</label>
            <label class="seo-proof-upload" for="seoBasicProofInput">
              <i class="fas fa-upload"></i>
              Upload file
            </label>
            <input
              id="seoBasicProofInput"
              class="phase-attachment-input"
              type="file"
              multiple
              data-phase-attachment-input="true"
              data-phase-index="${proofPhaseIndex}"
              data-phase-key="${escapeHtml(proofPhase.phase_key || "")}"
              accept=".pdf,.png,.jpg,.jpeg,.webp,.xlsx,.xls,.csv,.doc,.docx"
            />
            <div class="seo-proof-list">
              ${
                proofFiles.length
                  ? proofFiles
                      .map(
                        (file) => `
                          <a href="${escapeHtml(file.url || "#")}" target="_blank" rel="noopener">
                            ${escapeHtml(file.name || "Proof file")}
                          </a>
                        `,
                      )
                      .join("")
                  : "<span>No proof uploaded</span>"
              }
            </div>
          </div>

          <div class="seo-basic-field">
            <label>Send To Client</label>
            <div class="seo-client-share">
              <button type="button" data-seo-share-client="whatsapp">
                <i class="fab fa-whatsapp"></i>
                WhatsApp
              </button>
              <button type="button" data-seo-share-client="email">
                <i class="fas fa-envelope"></i>
                Email
              </button>
            </div>
          </div>
        </div>
      `;
    }

    if (saveNote) saveNote.textContent = "Submit karne ke baad project progress update ho jayega.";
    if (saveBtn) {
      saveBtn.disabled = phaseTrackerSaving || !selectedAssignmentId;
      saveBtn.textContent = phaseTrackerSaving ? "Submitting..." : "Submit";
    }
  };

  window.syncSeoBasicTrackerFields = function syncSeoBasicTrackerFields() {
    if (!phaseTrackerState || !Array.isArray(phaseTrackerState.phases)) return;

    const statusValue = getSeoFieldValue("status", "pending");
    const progressValue = clampPhaseProgress(getSeoFieldValue("progress"), 0);
    const normalizedStatus =
      statusValue === "completed" || progressValue === 100
        ? "completed"
        : progressValue > 0 || statusValue === "ongoing"
          ? "ongoing"
          : "pending";
    const statusLabel =
      normalizedStatus === "completed"
        ? "Completed"
        : normalizedStatus === "ongoing"
          ? "In Progress"
          : "Pending";
    const notesValue = buildSeoWorkNotes({
      clientName: getSeoFieldValue("clientName"),
      websiteUrl: getSeoFieldValue("websiteUrl"),
      projectName: getSeoFieldValue("projectName"),
      taskDate: getSeoFieldValue("taskDate"),
      workType: getSeoFieldValue("workType"),
      taskTitle: getSeoFieldValue("taskTitle"),
      workDescription: getSeoFieldValue("workDescription"),
      keywordsWorkedOn: getSeoFieldValue("keywordsWorkedOn"),
      backlinksCreated: getSeoFieldValue("backlinksCreated"),
      blogsUploaded: getSeoFieldValue("blogsUploaded"),
      pagesOptimized: getSeoFieldValue("pagesOptimized"),
      statusLabel,
      progress: progressValue,
    });

    phaseTrackerState.phases = phaseTrackerState.phases.map((phase, index) => ({
      ...phase,
      status: normalizedStatus,
      progress: normalizedStatus === "completed" ? 100 : progressValue,
      notes: index === 0 ? notesValue : phase.notes || "",
    }));
  };

  window.savePhaseTracker = async function saveSeoBasicTracker() {
    window.syncSeoBasicTrackerFields();
    return originalSavePhaseTracker();
  };

  renderPhaseTracker = window.renderPhaseTracker;
  savePhaseTracker = window.savePhaseTracker;

  document.addEventListener("input", (event) => {
    if (!event.target?.matches?.("[data-seo-basic-field]")) return;
    window.syncSeoBasicTrackerFields();
  });

  document.addEventListener("change", (event) => {
    if (!event.target?.matches?.("[data-seo-basic-field]")) return;
    window.syncSeoBasicTrackerFields();
    window.renderPhaseTracker();
  });

  document.addEventListener("click", (event) => {
    const button = event.target?.closest?.("[data-seo-share-client]");
    if (!button) return;

    event.preventDefault();
    shareSeoWorkWithClient(button.dataset.seoShareClient);
  });
}

setTimeout(installSeoBasicTracker, 0);
