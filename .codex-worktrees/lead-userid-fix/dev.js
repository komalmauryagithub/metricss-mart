let currentUser = null;
let reportChart = null;
let devDashboardChart = null;
let devReportCounts = { assigned: 0, ongoing: 0, completed: 0 };
let devDashboardTodayAttendance = null;
let popupTimer = null;
let attendanceUpdating = false;
let attendanceCalendarVisible = false;
let selectedProjectId = null;
let selectedAssignmentId = null;
let phaseTrackerState = null;
let phaseTrackerSaving = false;
let phaseTrackerSyncing = false;
let phaseTrackerUploadingKeys = new Set();
let projectAssignmentIndex = new Map();
const DASHBOARD_CONFIG = window.DASHBOARD_CONFIG || {};
const DASHBOARD_REPORT_STORAGE_KEY =
  DASHBOARD_CONFIG.reportStorageKey || "devReportCounts";
const DASHBOARD_PROJECTS_ENDPOINT =
  DASHBOARD_CONFIG.projectsEndpoint || "/api/dev/projects";
const DASHBOARD_USER_LABEL = DASHBOARD_CONFIG.userLabel || "DEV";
const BASE_URL =
  window.location.protocol === "file:"
    ? "http://localhost:3000"
    : ["localhost", "127.0.0.1"].includes(window.location.hostname)
      ? "http://localhost:3000"
      : window.location.origin;
const PHASE_STATUSES = ["pending", "ongoing", "blocked", "completed"];
const PHASE_TRACKER_DRAFTS_KEY =
  DASHBOARD_CONFIG.phaseTrackerDraftsKey || "devPhaseTrackerDraftsV1";
const PHASE_TRACKER_LOCAL_NOTE =
  "Due to a server sync issue, these details were saved in a local backup. They will sync to the database as soon as the API is available.";

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

function getPhaseTrackerLocalNote(serviceValue = "") {
  return PHASE_TRACKER_LOCAL_NOTE;
}

function getPhaseTrackerSubtitleCopy(serviceValue = "", clientName = "") {
  const serviceLabel = formatServiceLabel(serviceValue);
  const subject = clientName || "this client";

  return `${serviceLabel} workflow for ${subject}. Keep the live status, notes, blockers, and handover links for every phase updated here.`;
}

function getPhaseTrackerSaveNoteCopy(serviceValue = "", summary = {}, apiUnavailable = false) {
  if (apiUnavailable) {
    return getPhaseTrackerLocalNote(serviceValue);
  }

  if (summary.status === "completed") {
    return "All phases are marked complete. Saving will keep the project in completed status.";
  }

  return "Saving here updates the project details in the database and reflects the same tracker across admin, TME, and ME panels.";
}

function getPhaseTrackerDraftLoadedMessage(serviceValue = "") {
  return "The latest unsynced local details were loaded. Saving will try to sync them to the database.";
}

function getPhaseTrackerHintFallback(serviceValue = "") {
  return "Update the live status, blockers, and handover details for this phase.";
}

function getPhaseAttachmentEmptyMessage(serviceValue = "") {
  return "No files have been uploaded yet.";
}

function getPhaseTrackerInvalidResponseMessage(serviceValue = "", type = "tracker") {
  if (type === "upload") return "The file upload response is invalid.";
  if (type === "sync") return "The tracker sync response is invalid.";
  return "The tracker API response is invalid.";
}

function getPhaseTrackerFilesUploadedMessage(serviceValue = "") {
  return "The files were added successfully. Click Save Details to persist them to the admin, TME, and ME trackers.";
}

function getPhaseTrackerBackupSavedMessage(serviceValue = "") {
  return "Server sync is not available right now. A local backup was saved and will sync to the database on the next retry.";
}

function getPhaseTrackerSyncPendingMessage(serviceValue = "") {
  return "Database sync failed, so a local backup was saved. It will be pushed to the server on the next retry.";
}

function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function clampPhaseProgress(value, fallback = 0) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(0, Math.min(Math.round(numeric), 100));
}

function normalizePhaseStatusValue(value, fallback = "pending") {
  const normalized = String(value || "")
    .toLowerCase()
    .trim();
  return PHASE_STATUSES.includes(normalized) ? normalized : fallback;
}

function formatServiceLabel(serviceValue = "") {
  const normalized = String(serviceValue || "")
    .toLowerCase()
    .trim();

  if (!normalized) return "Service";
  if (normalized.includes("erp") || normalized.includes("crm")) return "ERP / CRM";
  if (normalized.includes("web")) return "Web";
  if (normalized.includes("app")) return "App";
  if (normalized.includes("seo")) return "SEO";
  if (normalized.includes("smo")) return "SMO";
  if (normalized.includes("ads")) return "Ads";

  return normalized.replace(/[_-]+/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatPhaseStatusLabel(status) {
  const labels = {
    pending: "Pending",
    ongoing: "Ongoing",
    blocked: "Blocked",
    completed: "Completed",
  };

  return labels[normalizePhaseStatusValue(status)] || "Pending";
}

function formatDateFieldValue(value) {
  const text = String(value || "").trim();
  const match = text.match(/^\d{4}-\d{2}-\d{2}/);
  return match ? match[0] : "";
}

function formatDateDisplayValue(value) {
  const isoValue = formatDateFieldValue(value);
  const match = isoValue.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (!match) return "";

  const [, year, month, day] = match;
  return `${day}/${month}/${year}`;
}

function parsePhaseDateInputValue(value) {
  const text = String(value || "").trim();

  if (!text) return "";

  const isoMatch = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
  }

  const displayMatch = text.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})$/);
  if (!displayMatch) return "";

  const day = displayMatch[1].padStart(2, "0");
  const month = displayMatch[2].padStart(2, "0");
  const year = displayMatch[3];
  const isoValue = `${year}-${month}-${day}`;
  const parsedDate = new Date(`${isoValue}T00:00:00Z`);

  if (Number.isNaN(parsedDate.getTime())) {
    return "";
  }

  if (
    parsedDate.getUTCFullYear() !== Number(year) ||
    parsedDate.getUTCMonth() + 1 !== Number(month) ||
    parsedDate.getUTCDate() !== Number(day)
  ) {
    return "";
  }

  return isoValue;
}

function normalizePhaseAttachmentsValue(value) {
  let parsed = value;

  if (typeof parsed === "string") {
    const trimmed = parsed.trim();
    if (!trimmed) return [];

    try {
      parsed = JSON.parse(trimmed);
    } catch (err) {
      return [];
    }
  }

  const list = Array.isArray(parsed) ? parsed : [];

  return list
    .map((item) => {
      if (!item || typeof item !== "object") return null;

      const name = String(item.name || item.filename || "").trim();
      const url = String(item.url || item.path || "").trim().replace(/\\/g, "/");
      const type = String(item.type || item.mime || "").trim();
      const size = Number(item.size || 0);
      const uploadedAt = String(item.uploaded_at || item.uploadedAt || "").trim();

      if (!name || !url) return null;

      return {
        name: name.slice(0, 255),
        url: url.slice(0, 500),
        type: type.slice(0, 120),
        size: Number.isFinite(size) && size > 0 ? Math.round(size) : 0,
        uploaded_at: uploadedAt || null,
      };
    })
    .filter(Boolean)
    .slice(0, 12);
}

function formatAttachmentSize(bytes) {
  const size = Number(bytes || 0);
  if (!Number.isFinite(size) || size <= 0) return "";
  if (size >= 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  if (size >= 1024) return `${Math.round(size / 1024)} KB`;
  return `${size} B`;
}

function normalizeClientWhatsappPhone(value) {
  return String(value || "").replace(/[^\d]/g, "");
}

function toAbsoluteTrackerShareUrl(url) {
  const value = String(url || "").trim();
  if (!value) return "";

  if (/^https?:\/\//i.test(value)) return value;
  if (value.startsWith("//")) return `${window.location.protocol}${value}`;
  if (value.startsWith("/")) return `${BASE_URL}${value}`;

  return value;
}

function buildPhaseClientShareItems(phase = {}) {
  const items = [];
  const deliverableUrl = toAbsoluteTrackerShareUrl(phase?.deliverable_link);

  if (deliverableUrl) {
    items.push({
      label: "Deliverable Link",
      url: deliverableUrl,
    });
  }

  normalizePhaseAttachmentsValue(phase?.attachments).forEach((attachment) => {
    const attachmentUrl = toAbsoluteTrackerShareUrl(attachment?.url);
    if (!attachmentUrl) return;

    items.push({
      label: attachment?.name || "Attachment",
      url: attachmentUrl,
    });
  });

  return items;
}

function buildPhaseClientShareMessage(assignment = {}, phase = {}, serviceValue = "") {
  const items = buildPhaseClientShareItems(phase);
  if (!items.length) return "";

  const serviceLabel = formatServiceLabel(serviceValue);
  const phaseLabel =
    phase?.phase_label ||
    getStageDisplayLabel(serviceValue, phase?.phase_key, "Phase update");
  const lines = [
    "Project update",
    "",
    `Project: ${assignment?.projectName || "Project"}`,
    `Client: ${assignment?.client || "Client"}`,
    `Service: ${serviceLabel}`,
    `Phase: ${phaseLabel}`,
  ];

  if (assignment?.clientMapsLink) {
    lines.push(`Maps: ${assignment.clientMapsLink}`);
  }

  lines.push("", "Shared files / links:");
  items.forEach((item, index) => {
    lines.push(`${index + 1}. ${item.label}: ${item.url}`);
  });

  return lines.join("\n");
}

function buildPhaseClientShareSection(assignment = {}, phase = {}, serviceValue = "") {
  const items = buildPhaseClientShareItems(phase);
  if (!items.length) return "";

  const email = String(assignment?.clientEmail || "").trim();
  const phone = normalizeClientWhatsappPhone(
    assignment?.clientContact ||
      assignment?.clientTelephone ||
      assignment?.clientAlternateContact ||
      "",
  );
  const shareMessage = buildPhaseClientShareMessage(
    assignment,
    phase,
    serviceValue,
  );
  const phaseLabel =
    phase?.phase_label ||
    getStageDisplayLabel(serviceValue, phase?.phase_key, "Phase update");
  const shareSubject = `${assignment?.projectName || "Project"} - ${phaseLabel} update`;
  const actions = [];

  if (email) {
    actions.push(`
      <a
        class="phase-share-btn email"
        href="${escapeHtml(`mailto:${email}?subject=${encodeURIComponent(shareSubject)}&body=${encodeURIComponent(shareMessage)}`)}"
      >
        Email Client
      </a>
    `);
  }

  if (phone) {
    actions.push(`
      <a
        class="phase-share-btn whatsapp"
        href="${escapeHtml(`https://wa.me/${phone}?text=${encodeURIComponent(shareMessage)}`)}"
        target="_blank"
        rel="noreferrer"
      >
        WhatsApp Client
      </a>
    `);
  }

  if (!actions.length) return "";

  return `
    <div class="phase-share-actions full">
      <span class="phase-share-label">Share With Client</span>
      <div class="phase-share-buttons">
        ${actions.join("")}
      </div>
    </div>
  `;
}

function getPhaseAttachmentUploadKey(phaseKey, index = 0) {
  return `${selectedAssignmentId || "draft"}:${phaseKey || `phase-${index}`}`;
}

function isPhaseAttachmentUploading(phaseKey, index = 0) {
  return phaseTrackerUploadingKeys.has(getPhaseAttachmentUploadKey(phaseKey, index));
}

function getProjectAssignmentId(project) {
  return (
    project?.assignment_id ||
    project?.assignmentId ||
    project?.project_id ||
    project?._id ||
    project?.id ||
    ""
  );
}

function getProjectServiceValue(project = {}) {
  return (
    project.serviceType ||
    project.service ||
    project.service_type ||
    ""
  );
}

function loadPhaseTrackerDraftStore() {
  try {
    const parsed = JSON.parse(
      localStorage.getItem(PHASE_TRACKER_DRAFTS_KEY) || "{}",
    );
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch (err) {
    console.error("Phase draft load error:", err);
    return {};
  }
}

function savePhaseTrackerDraftStore(store) {
  localStorage.setItem(PHASE_TRACKER_DRAFTS_KEY, JSON.stringify(store || {}));
}

function getStoredPhaseTrackerDraft(assignmentId) {
  if (!assignmentId) return null;
  const store = loadPhaseTrackerDraftStore();
  return store[String(assignmentId)] || null;
}

function saveStoredPhaseTrackerDraft(assignmentId, snapshot) {
  if (!assignmentId) return;
  const store = loadPhaseTrackerDraftStore();
  store[String(assignmentId)] = snapshot;
  savePhaseTrackerDraftStore(store);
}

function removeStoredPhaseTrackerDraft(assignmentId) {
  if (!assignmentId) return;

  const key = String(assignmentId);
  const store = loadPhaseTrackerDraftStore();

  if (!Object.prototype.hasOwnProperty.call(store, key)) {
    return;
  }

  delete store[key];
  savePhaseTrackerDraftStore(store);
}

function buildPhaseTrackerApiPayload(phases = []) {
  return (Array.isArray(phases) ? phases : []).map((phase) => ({
    phase_key: phase.phase_key,
    status: normalizePhaseStatusValue(phase.status, "pending"),
    progress: clampPhaseProgress(phase.progress, 0),
    start_date: formatDateFieldValue(phase.start_date),
    due_date: formatDateFieldValue(phase.due_date),
    notes: String(phase.notes || "").trim(),
    blockers: String(phase.blockers || "").trim(),
    deliverable_link: String(phase.deliverable_link || "").trim(),
    attachments: normalizePhaseAttachmentsValue(phase.attachments),
  }));
}

function getPhaseTrackerUpdatedAtMs(value) {
  if (!value) return 0;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : 0;
}

function getLatestPhaseTrackerServerMs(phases = [], assignment = {}) {
  const timestamps = [];

  (Array.isArray(phases) ? phases : []).forEach((phase) => {
    const updatedAtMs = getPhaseTrackerUpdatedAtMs(phase?.updated_at);
    if (updatedAtMs > 0) {
      timestamps.push(updatedAtMs);
    }
  });

  const assignedAtMs = getPhaseTrackerUpdatedAtMs(assignment?.assigned_at);
  if (assignedAtMs > 0) {
    timestamps.push(assignedAtMs);
  }

  return timestamps.length ? Math.max(...timestamps) : 0;
}

function shouldPreferLocalPhaseDraft(draft, phases = [], assignment = {}) {
  const draftUpdatedAt = getPhaseTrackerUpdatedAtMs(draft?.updated_at);
  if (!draftUpdatedAt) return false;

  return draftUpdatedAt > getLatestPhaseTrackerServerMs(phases, assignment);
}

async function syncPhaseTrackerDraftToServer(assignmentId, snapshot) {
  if (!assignmentId || !snapshot || !Array.isArray(snapshot.phases)) {
    return { success: false, skipped: true };
  }

  const normalizedPhases = normalizePhaseTrackerPhases(
    snapshot.phases,
    snapshot.assignment || {},
  );

  const res = await fetch(
    `${BASE_URL}/api/project-assignments/${assignmentId}/phases`,
    {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        userId: currentUser?.id,
        phases: buildPhaseTrackerApiPayload(normalizedPhases),
      }),
    },
  );
  const apiResponse = await readApiJsonResponse(res);

  if (apiResponse.data?.success) {
    removeStoredPhaseTrackerDraft(assignmentId);
    return {
      success: true,
      data: apiResponse.data,
    };
  }

  throw new Error(
    apiResponse.data?.message ||
      (apiResponse.isHtml
        ? getPhaseTrackerInvalidResponseMessage(
            snapshot.assignment?.serviceType ||
              snapshot.assignment?.service_type ||
              "",
            "sync",
          )
        : "Failed to sync tracker details"),
  );
}

async function syncPendingPhaseTrackerDrafts() {
  if (phaseTrackerSyncing || !currentUser?.id) {
    return { synced: 0, failed: 0 };
  }

  const store = loadPhaseTrackerDraftStore();
  const draftEntries = Object.entries(store).filter(
    ([assignmentId, snapshot]) =>
      assignmentId &&
      snapshot &&
      Array.isArray(snapshot.phases) &&
      snapshot.phases.length > 0,
  );

  if (!draftEntries.length) {
    return { synced: 0, failed: 0 };
  }

  phaseTrackerSyncing = true;

  let synced = 0;
  let failed = 0;

  try {
    for (const [assignmentId, snapshot] of draftEntries) {
      try {
        await syncPhaseTrackerDraftToServer(assignmentId, snapshot);
        synced += 1;
      } catch (err) {
        failed += 1;
        console.error(`Phase tracker sync failed for assignment ${assignmentId}:`, err);
      }
    }
  } finally {
    phaseTrackerSyncing = false;
  }

  return { synced, failed };
}

function mergeProjectWithPhaseDraft(project) {
  const assignmentId = getProjectAssignmentId(project);
  const draft = getStoredPhaseTrackerDraft(assignmentId);

  if (!draft) return project;

  const draftPhases = normalizePhaseTrackerPhases(
    Array.isArray(draft.phases) ? draft.phases : [],
    draft.assignment || project || {},
  );

  const summary = summarizePhaseState(draftPhases);

  return {
    ...project,
    ...(draft.assignment || {}),
    status: summary.status || project.status,
    stage: summary.stage || project.stage,
    progress:
      typeof summary.progress === "number"
        ? summary.progress
        : Number(project.progress || 0),
    phaseSource: "local",
  };
}

async function readApiJsonResponse(res) {
  const text = await res.text();
  const normalizedText = String(text || "").trim();

  if (!normalizedText) {
    return {
      ok: res.ok,
      status: res.status,
      data: null,
      rawText: "",
      isHtml: false,
    };
  }

  try {
    return {
      ok: res.ok,
      status: res.status,
      data: JSON.parse(normalizedText),
      rawText: normalizedText,
      isHtml: false,
    };
  } catch (err) {
    return {
      ok: res.ok,
      status: res.status,
      data: null,
      rawText: normalizedText,
      isHtml: normalizedText.startsWith("<"),
      parseError: err,
    };
  }
}

function summarizePhaseState(phases = []) {
  if (!Array.isArray(phases) || phases.length === 0) {
    return {
      status: "assigned",
      progress: 0,
      stage: "",
      completedCount: 0,
      blockedCount: 0,
      totalPhases: 0,
    };
  }

  const normalized = phases.map((phase) => {
    const status = normalizePhaseStatusValue(phase.status, "pending");
    const progress = clampPhaseProgress(
      phase.progress,
      status === "completed" ? 100 : 0,
    );
    const hasContent = Boolean(
      formatDateFieldValue(phase.start_date) ||
        formatDateFieldValue(phase.due_date) ||
        String(phase.notes || "").trim() ||
        String(phase.blockers || "").trim() ||
        String(phase.deliverable_link || "").trim() ||
        normalizePhaseAttachmentsValue(phase.attachments).length ||
        progress > 0 ||
        status === "ongoing" ||
        status === "blocked" ||
        status === "completed",
    );

    return {
      ...phase,
      status,
      progress: status === "completed" ? 100 : progress,
      hasContent,
    };
  });

  const completedCount = normalized.filter((phase) => phase.status === "completed").length;
  const blockedCount = normalized.filter((phase) => phase.status === "blocked").length;
  const allCompleted = completedCount === normalized.length;
  const anyStarted = normalized.some((phase) => phase.hasContent);
  const activePhase =
    normalized.find((phase) => phase.status !== "completed") ||
    normalized[normalized.length - 1];
  const averageProgress = normalized.reduce(
    (sum, phase) => sum + Number(phase.progress || 0),
    0,
  ) / normalized.length;

  return {
    status: allCompleted ? "completed" : anyStarted ? "ongoing" : "assigned",
    progress: allCompleted ? 100 : clampPhaseProgress(averageProgress, 0),
    stage: activePhase?.phase_key || "",
    completedCount,
    blockedCount,
    totalPhases: normalized.length,
  };
}

function buildDefaultPhaseTrackerPhases(project = {}) {
  const serviceValue = getProjectServiceValue(project);
  const workflowKey = resolveWorkflowKey(serviceValue);
  const workflow = getWorkflowConfig(serviceValue);
  const stage = normalizeStageForWorkflow(
    workflowKey,
    project.stage || workflow.steps[0],
  );
  const stageIndex = workflow.steps.indexOf(stage);
  const normalizedStatus = String(project.status || "assigned").toLowerCase();
  const projectProgress = clampPhaseProgress(
    project.progress,
    normalizedStatus === "completed" ? 100 : 0,
  );

  return workflow.steps.map((stepKey, index) => {
    let status = "pending";
    let progress = 0;

    if (normalizedStatus === "completed") {
      status = "completed";
      progress = 100;
    } else if (normalizedStatus === "ongoing" && stageIndex > -1) {
      if (index < stageIndex) {
        status = "completed";
        progress = 100;
      } else if (index === stageIndex) {
        status = "ongoing";
        progress = projectProgress || 10;
      }
    }

    return {
      phase_key: stepKey,
      phase_label: workflow.labels[stepKey] || stepKey,
      status,
      progress,
      start_date: "",
      due_date: "",
      notes: "",
      blockers: "",
      deliverable_link: "",
      attachments: [],
    };
  });
}

function normalizePhaseKeyForWorkflow(workflowKey, phaseValue) {
  const workflow = serviceWorkflows[workflowKey] || serviceWorkflows.web;
  const phaseKey = String(phaseValue || "").toLowerCase().trim();
  const mappedPhaseKey = workflowStageAliases[workflowKey]?.[phaseKey] || phaseKey;

  return workflow.steps.includes(mappedPhaseKey) ? mappedPhaseKey : "";
}

function normalizePhaseTrackerPhases(phases = [], project = {}) {
  const serviceValue = getProjectServiceValue(project);
  const workflowKey = resolveWorkflowKey(serviceValue);
  const workflow = getWorkflowConfig(serviceValue);
  const basePhases = buildDefaultPhaseTrackerPhases(project);
  const phaseMap = new Map(basePhases.map((phase) => [phase.phase_key, { ...phase }]));

  (Array.isArray(phases) ? phases : []).forEach((phase) => {
    const phaseKey = normalizePhaseKeyForWorkflow(
      workflowKey,
      phase?.phase_key || phase?.phase_label || "",
    );

    if (!phaseKey) return;

    const fallbackPhase = phaseMap.get(phaseKey) || {
      phase_key: phaseKey,
      phase_label: workflow.labels[phaseKey] || phaseKey,
      status: "pending",
      progress: 0,
      start_date: "",
      due_date: "",
      notes: "",
      blockers: "",
      deliverable_link: "",
      attachments: [],
      updated_at: "",
    };
    const normalizedStatus = normalizePhaseStatusValue(
      phase?.status,
      fallbackPhase.status || "pending",
    );

    phaseMap.set(phaseKey, {
      ...fallbackPhase,
      phase_key: phaseKey,
      phase_label: workflow.labels[phaseKey] || fallbackPhase.phase_label || phaseKey,
      status: normalizedStatus,
      progress: clampPhaseProgress(
        phase?.progress,
        normalizedStatus === "completed" ? 100 : fallbackPhase.progress || 0,
      ),
      start_date: formatDateFieldValue(phase?.start_date),
      due_date: formatDateFieldValue(phase?.due_date),
      notes: String(phase?.notes || fallbackPhase.notes || ""),
      blockers: String(phase?.blockers || fallbackPhase.blockers || ""),
      deliverable_link: String(
        phase?.deliverable_link || fallbackPhase.deliverable_link || "",
      ),
      attachments: normalizePhaseAttachmentsValue(
        phase?.attachments || fallbackPhase.attachments,
      ),
      updated_at: phase?.updated_at || fallbackPhase.updated_at || "",
    });
  });

  return workflow.steps.map(
    (stepKey) =>
      phaseMap.get(stepKey) || {
        phase_key: stepKey,
        phase_label: workflow.labels[stepKey] || stepKey,
        status: "pending",
        progress: 0,
        start_date: "",
        due_date: "",
        notes: "",
        blockers: "",
        deliverable_link: "",
        attachments: [],
        updated_at: "",
      },
  );
}

function buildLocalPhaseTrackerState(project = {}, focusPhase = "") {
  const assignmentId = getProjectAssignmentId(project);
  const draft = getStoredPhaseTrackerDraft(assignmentId);
  const phases =
    Array.isArray(draft?.phases) && draft.phases.length > 0
      ? normalizePhaseTrackerPhases(
          draft.phases,
          draft?.assignment || project || {},
        )
      : buildDefaultPhaseTrackerPhases(project);
  const summary = summarizePhaseState(phases);

  return {
    assignment: {
      ...project,
      ...(draft?.assignment || {}),
      status: summary.status || project.status || "assigned",
      stage: summary.stage || project.stage || "",
      progress:
        typeof summary.progress === "number"
          ? summary.progress
          : clampPhaseProgress(project.progress, 0),
    },
    phases,
    focusPhase,
    mode: "local",
    apiUnavailable: true,
  };
}

async function persistPhaseTrackerLocally(options = {}) {
  if (!selectedAssignmentId || !phaseTrackerState) return null;

  const refreshProjects = options.refreshProjects !== false;
  const skipDraftSync = Boolean(options.skipDraftSync);

  const summary = summarizePhaseState(phaseTrackerState.phases);
  const snapshot = {
    assignment: {
      ...(phaseTrackerState.assignment || {}),
      status: summary.status,
      stage: summary.stage,
      progress: summary.progress,
    },
    phases: phaseTrackerState.phases,
    summary,
    updated_at: new Date().toISOString(),
  };

  saveStoredPhaseTrackerDraft(selectedAssignmentId, snapshot);
  phaseTrackerState = {
    ...phaseTrackerState,
    assignment: snapshot.assignment,
    phases: snapshot.phases,
    mode: "local",
    apiUnavailable: true,
  };

  projectAssignmentIndex.set(String(selectedAssignmentId), snapshot.assignment);
  renderPhaseTracker();
  if (refreshProjects) {
    await fetchDEVProjects({ skipDraftSync });
  }
  return snapshot;
}

function getPhaseTrackerElements() {
  return {
    modal: document.getElementById("phaseTrackerModal"),
    title: document.getElementById("phaseTrackerTitle"),
    subtitle: document.getElementById("phaseTrackerSubtitle"),
    overview: document.getElementById("phaseTrackerOverview"),
    body: document.getElementById("phaseTrackerBody"),
    saveBtn: document.getElementById("phaseTrackerSaveBtn"),
    saveNote: document.getElementById("phaseTrackerSaveNote"),
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

function filterCards(containerId, searchInputId) {
  const input = document.getElementById(searchInputId);
  const container = document.getElementById(containerId);
  if (!input || !container) return;

  const searchValue = input.value.toLowerCase();
  container.querySelectorAll(".project-card, .card").forEach((card) => {
    card.style.display = card.textContent.toLowerCase().includes(searchValue)
      ? ""
      : "none";
  });
}

window.onload = function () {
  loadUser();
};

function loadUser() {
  const user = localStorage.getItem("currentUser");

  if (!user) {
    showPopup("Session Expired", "Please login again", false);
    setTimeout(() => {
      window.location.href = "mp.html";
    }, 1500);
    return;
  }

  currentUser = JSON.parse(user);
  const normalizedUserId = getCurrentUserId();
  if (normalizedUserId) {
    currentUser.id = normalizedUserId;
  }
  document.getElementById("userName").textContent =
    currentUser.name || DASHBOARD_USER_LABEL;
  const roleLabel = String(
    currentUser.role || DASHBOARD_USER_LABEL || "Employee",
  )
    .trim()
    .toUpperCase();

  document.querySelectorAll(".role").forEach((element) => {
    element.textContent = roleLabel;
  });

  document.querySelectorAll(".brand-panel").forEach((element) => {
    element.textContent = roleLabel;
  });

  document.title = `${roleLabel} Dashboard`;

  if (currentUser.prof_img) {
    document.getElementById("userAvatar").src = currentUser.prof_img.startsWith(
      "http",
    )
      ? currentUser.prof_img
      : `${BASE_URL}/${currentUser.prof_img}`;
  }

  // User load hone ke baad hi data fetch karo
  loadDevDashboard();
}

// 🔥 Dummy (baad me DB se connect karenge)
function fetchDEVData() {
  document.getElementById("assignedContainer").innerHTML = `
        <div class="card">
            <h3>No Assigned Projects</h3>
        </div>
    `;

  document.getElementById("ongoingContainer").innerHTML = `
        <div class="card">
            <h3>No Ongoing Projects</h3>
        </div>
    `;

  document.getElementById("completedContainer").innerHTML = `
        <div class="card">
            <h3>No Completed Projects</h3>
        </div>
    `;

  document.getElementById("totalAssigned").textContent = 0;
  document.getElementById("totalOngoing").textContent = 0;
  document.getElementById("totalCompleted").textContent = 0;
}

// Section switch
function showSection(sectionId) {
  closePhaseTracker();
  closeModal();

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
    loadDevDashboard();
  }

  if (sectionId === "attendance") {
    fetchAttendance();
  }

  if (sectionId === "salary") {
    window.PayrollUI?.handleSectionShown("salary");
  }

  if (sectionId === "reports") {
    renderReportChart(
      devReportCounts.assigned,
      devReportCounts.ongoing,
      devReportCounts.completed,
    );
  }
}

function handleDashboardShortcutKey(event, sectionId) {
  if (!event) return;

  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    showSection(sectionId);
  }
}

function setDevDashboardText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function renderDevDashboardChart(assignedCount, ongoingCount, completedCount) {
  const canvas = document.getElementById("devDashboardChart");
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const data = [assignedCount, ongoingCount, completedCount];

  if (devDashboardChart) {
    devDashboardChart.data.datasets[0].data = data;
    devDashboardChart.update();
    return;
  }

  devDashboardChart = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: ["Assigned", "Ongoing", "Completed"],
      datasets: [
        {
          data,
          backgroundColor: ["#0f766e", "#f59e0b", "#10b981"],
          borderWidth: 2,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: "bottom" },
      },
    },
  });
}

function renderDevDashboard() {
  setDevDashboardText("dashboardAssignedCount", devReportCounts.assigned);
  setDevDashboardText("dashboardOngoingCount", devReportCounts.ongoing);
  setDevDashboardText("dashboardCompletedCount", devReportCounts.completed);
  const completionRate =
    devReportCounts.assigned > 0
      ? ((devReportCounts.completed / devReportCounts.assigned) * 100).toFixed(1)
      : "0.0";
  const checkedInCount = devDashboardTodayAttendance?.check_in ? 1 : 0;

  setDevDashboardText("workFunnelAssigned", devReportCounts.assigned);
  setDevDashboardText("workFunnelOngoing", devReportCounts.ongoing);
  setDevDashboardText("workFunnelCompleted", devReportCounts.completed);
  setDevDashboardText("workFunnelAttendance", checkedInCount);
  setDevDashboardText("devDashboardFunnelRate", `${completionRate}% completion`);
  setDevDashboardText("devFunnelConversionRate", `${completionRate}%`);
  renderDevDashboardChart(
    devReportCounts.assigned,
    devReportCounts.ongoing,
    devReportCounts.completed,
  );
}

async function fetchDevAttendanceSummary() {
  const statusEl = document.getElementById("dashboardAttendance");
  const timeEl = document.getElementById("dashboardAttendanceTime");
  if (!statusEl && !timeEl) return;
  const userId = getCurrentUserId();
  if (!userId) return;

  try {
    const res = await fetch(`${BASE_URL}/api/attendance/${userId}`, {
      cache: "no-store",
    });
    const result = await res.json();
    const rows = result?.success && Array.isArray(result.data) ? result.data : [];
    const today = formatDateKey(new Date());
    const todayRow = rows.find((row) => row.attendance_date === today) || null;
    devDashboardTodayAttendance = todayRow;

    const hasAttendanceCheckIn = Boolean(todayRow?.check_in);
    const isAttendanceAbsent = todayRow?.status === "absent";
    const statusMeta =
      hasAttendanceCheckIn || isAttendanceAbsent
        ? getAttendanceStatusMeta(todayRow?.status)
        : null;
    const status = statusMeta ? statusMeta.label : "Not marked";
    const time = isAttendanceAbsent
      ? hasAttendanceCheckIn
        ? `In ${todayRow.check_in} / Out ${getAttendanceCheckoutDisplay(todayRow)}`
        : "Check out missing"
      : hasAttendanceCheckIn
        ? `In ${todayRow.check_in} / Out ${getAttendanceCheckoutDisplay(todayRow)}`
        : "Check in pending";

    if (statusEl) statusEl.textContent = status;
    if (timeEl) timeEl.textContent = time;
    renderDevDashboard();
  } catch (err) {
    console.error("Dev Attendance Summary Error:", err);
    devDashboardTodayAttendance = null;
    renderDevDashboard();
  }
}

function loadDevDashboard() {
  fetchDEVProjects();
  fetchDevAttendanceSummary();
}

async function fetchAttendance() {
  const userId = getCurrentUserId();
  if (!userId) return;

  const tbody = document.getElementById("attendanceTableBody");
  const actions = document.getElementById("attendanceActions");
  if (!tbody) return;

  try {
    const res = await fetch(`${BASE_URL}/api/attendance/${userId}`);
    const result = await res.json();
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
      throw new Error("Face verification module load nahi hua. Page refresh karke retry karo.");
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
    return `<a href="${locationUrl}" target="_blank">View Location</a>`;
  }

  if (row.check_in_lat && row.check_in_lng) {
    const url = `https://www.google.com/maps?q=${row.check_in_lat},${row.check_in_lng}`;
    return `<a href="${url}" target="_blank">View Location</a>`;
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

function formatDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// Popup
function showPopup(title, message, isSuccess) {
  const popup = document.getElementById("popup");
  const icon = document.getElementById("popupIcon");
  const titleEl = document.getElementById("popupTitle");
  const msgEl = document.getElementById("popupMessage");

  titleEl.textContent = title;
  msgEl.textContent = message;

  // 🔥 ICON FIX
  if (isSuccess) {
    icon.className = "fas fa-check-circle";
    icon.style.color = "#0f766e";
  } else {
    icon.className = "fas fa-exclamation-circle";
    icon.style.color = "#ef4444";
  }

  popup.classList.remove("hidden");

  // 🔥 Auto close after 1.5 sec
  if (popupTimer) clearTimeout(popupTimer);

  popupTimer = setTimeout(() => {
    popup.classList.add("hidden");
  }, 1500);
}

// 🔥 UPDATED fetchDEVProjects() - dev.js mein yeh paste kar do

function updateDevReports(assigned, ongoing, completed) {
  // counts update
  devReportCounts.assigned = assigned.length;
  devReportCounts.ongoing = ongoing.length;
  devReportCounts.completed = completed.length;

  // UI numbers update
  document.getElementById("totalAssigned").textContent =
    devReportCounts.assigned;
  document.getElementById("totalOngoing").textContent = devReportCounts.ongoing;
  document.getElementById("totalCompleted").textContent =
    devReportCounts.completed;

  // chart render/update
  renderReportChart(
    devReportCounts.assigned,
    devReportCounts.ongoing,
    devReportCounts.completed,
  );
}

async function fetchDEVProjects() {
  if (!currentUser || !currentUser.id) {
    console.error("User ID not found in currentUser");
    showPopup("Error", "User session invalid", false);
    return;
  }

  console.log("Fetching projects for DEV ID:", currentUser.id);

  try {
    const res = await fetch(`${BASE_URL}/api/dev/projects/${currentUser.id}`);
    const result = await res.json();

    console.log("🔥 DEV Projects API Response:", result);

    const assignedContainer = document.getElementById("assignedContainer");
    const ongoingContainer = document.getElementById("ongoingContainer");
    const completedContainer = document.getElementById("completedContainer");

    // Clear previous content
    assignedContainer.innerHTML = "";
    ongoingContainer.innerHTML = "";
    completedContainer.innerHTML = "";

    let assignedCount = 0;
    let ongoingCount = 0;
    let completedCount = 0;

    // 🔥 NEW RESPONSE STRUCTURE HANDLE (assigned, ongoing, completed arrays)
    // 🔥 IMPROVED RESPONSE HANDLING
    if (result.success) {
      let allProjects = [];

      // Case 1: Agar backend assigned/ongoing/completed arrays bhej raha hai
      if (result.assigned || result.ongoing || result.completed) {
        allProjects = [
          ...(result.assigned || []),
          ...(result.ongoing || []),
          ...(result.completed || []),
        ];
      }
      // Case 2: Agar backend data array bhej raha hai (purana style)
      else if (result.data && Array.isArray(result.data)) {
        allProjects = result.data;
      }

      // Ab categorize karo
      const assigned = allProjects.filter(
        (p) => (p.status || "").toLowerCase() === "assigned",
      );
      const ongoing = allProjects.filter(
        (p) => (p.status || "").toLowerCase() === "ongoing",
      );
      const completed = allProjects.filter(
        (p) => (p.status || "").toLowerCase() === "completed",
      );

      // Assigned Section
      // Assigned Section FIXED
      if (assigned.length > 0) {
        let html = "";
        assigned.forEach((project) => {
          html += createProjectCard(project, "assigned");
        });
        assignedContainer.innerHTML = html;
      } else {
        assignedContainer.innerHTML = `<div class="empty">No Assigned Projects</div>`;
      }

      // Ongoing Section
      if (ongoing.length > 0) {
        ongoing.forEach((project) => {
          ongoingContainer.innerHTML += createProjectCard(project, "ongoing");
        });
      } else {
        ongoingContainer.innerHTML = `<div class="card"><h3>No Ongoing Projects</h3></div>`;
      }

      // Completed Section
      if (completed.length > 0) {
        completed.forEach((project) => {
          completedContainer.innerHTML += createProjectCard(
            project,
            "completed",
          );
        });
      } else {
        completedContainer.innerHTML = `<div class="card"><h3>No Completed Projects</h3></div>`;
      }

      // Update counts
      assignedCount = assigned.length;
      ongoingCount = ongoing.length;
      completedCount = completed.length;

      document.getElementById("totalAssigned").textContent = assignedCount;
      document.getElementById("totalOngoing").textContent = ongoingCount;
      document.getElementById("totalCompleted").textContent = completedCount;
      updateDevReports(assigned, ongoing, completed);
    } else {
      // Agar success false ho
      const errorHTML = `<div class="card"><h3>Error loading projects</h3></div>`;
      assignedContainer.innerHTML = errorHTML;
      ongoingContainer.innerHTML = errorHTML;
      completedContainer.innerHTML = errorHTML;
    }
  } catch (err) {
    console.error("DEV Projects Fetch Error:", err);
    showPopup("Error", "Failed to load projects. Check console.", false);
  }
}

// 🔥 Helper function to create card (reusable)
// function createProjectCard(project, status) {
//   return `
//         <div class="card">
//             <h3>${project.projectName || project.company_name || "Untitled Project"}</h3>
//             <p><b>Client:</b> ${project.client || project.client_name || "N/A"}</p>
//             <p><b>Services:</b> ${project.service_type || "N/A"}</p>
//             <p><b>Status:</b> <span class="status ${status}">${status.toUpperCase()}</span></p>
//         </div>
//     `;
// }

function renderReportChart(assignedCount, ongoingCount, completedCount) {
  const canvas = document.getElementById("reportChart");
  if (!canvas) return;

  const data = [assignedCount, ongoingCount, completedCount];

  // 🔥 Update existing chart (recreate nahi karna baar baar)
  if (reportChart) {
    reportChart.data.datasets[0].data = data;
    reportChart.update();
    return;
  }

  reportChart = new Chart(canvas, {
    type: "doughnut",
    data: {
      labels: ["Assigned", "Ongoing", "Completed"],
      datasets: [
        {
          data: data,
          backgroundColor: ["#0f766e", "#f59e0b", "#10b981"],
          borderWidth: 2,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: "bottom" },
      },
    },
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

function createProjectCard(project, status) {
  return `
    <div class="project-card ${status}">
        <div class="card-header">
            <h3>${project.projectName || project.company_name || "Untitled Project"}</h3>
            <span class="badge ${status}">${status}</span>
        </div>

        <div class="card-body">
            <p><i class="fas fa-user"></i> ${project.client || project.client_name || "N/A"}</p>

            <!-- 🔥 SERVICE FIX -->
            <p>
              <i class="fas fa-cogs"></i> 
              <span class="service-badge">
  ${project.serviceType || project.service || project.service_type || "unknown"}
</span>
             
            </p>
        </div>

        <div class="card-footer">
            <button class="view-btn">View</button>
        </div>  
    </div>
  `;
}

function saveDevCounts() {
  localStorage.setItem(
    DASHBOARD_REPORT_STORAGE_KEY,
    JSON.stringify(devReportCounts),
  );
}

function updateDevReports(assigned, ongoing, completed) {
  devReportCounts.assigned = assigned.length;
  devReportCounts.ongoing = ongoing.length;
  devReportCounts.completed = completed.length;

  saveDevCounts();

  document.getElementById("totalAssigned").textContent =
    devReportCounts.assigned;
  document.getElementById("totalOngoing").textContent = devReportCounts.ongoing;
  document.getElementById("totalCompleted").textContent =
    devReportCounts.completed;

  renderReportChart(
    devReportCounts.assigned,
    devReportCounts.ongoing,
    devReportCounts.completed,
  );

  renderDevDashboard();
}

function dedupeProjectsById(projects = []) {
  const uniqueProjectsMap = new Map();

  projects.forEach((project, index) => {
    const id =
      project.assignment_id ||
      project.assignmentId ||
      project.project_id ||
      project._id ||
      project.id;
    const key = id ? String(id) : `project-${index}`;

    if (!uniqueProjectsMap.has(key)) {
      uniqueProjectsMap.set(key, project);
    }
  });

  return Array.from(uniqueProjectsMap.values());
}

function getProjectsBySection(result) {
  const sourceProjects =
    result.assigned || result.ongoing || result.completed
      ? [
          ...(result.assigned || []),
          ...(result.ongoing || []),
          ...(result.completed || []),
        ]
      : result.data || [];

  const allProjects = dedupeProjectsById(sourceProjects)
    .map((project) => ({
      ...project,
      status: (project.status || "assigned").toLowerCase(),
    }))
    .map((project) => mergeProjectWithPhaseDraft(project));

  const assigned = allProjects.filter(
    (project) => String(project.status || "").toLowerCase() === "assigned",
  );
  const ongoing = allProjects.filter(
    (project) => String(project.status || "").toLowerCase() === "ongoing",
  );
  const completed = allProjects.filter(
    (project) => String(project.status || "").toLowerCase() === "completed",
  );
  const assignedView = allProjects.filter(
    (project) =>
      String(project.status || "").toLowerCase() !== "completed",
  );

  return { assigned, assignedView, ongoing, completed };
}

function hasProjectsInPayload(payload) {
  if (!payload || typeof payload !== "object") return false;

  return ["assigned", "ongoing", "completed", "data"].some((key) => {
    const value = payload[key];
    return Array.isArray(value) && value.length > 0;
  });
}

function getProjectsEndpointCandidates() {
  const configuredEndpoint = String(DASHBOARD_PROJECTS_ENDPOINT || "").trim();
  const normalizedEndpoint = configuredEndpoint.toLowerCase();
  const normalizedLabel = String(DASHBOARD_USER_LABEL || "").toLowerCase().trim();
  const normalizedRole = String(currentUser?.role || "").toLowerCase().trim();
  const candidates = [];

  if (configuredEndpoint) {
    candidates.push(configuredEndpoint);
  }

  if (
    normalizedLabel === "seo" ||
    normalizedRole === "seo" ||
    normalizedRole === "dm" ||
    normalizedEndpoint.includes("/seo/projects")
  ) {
    candidates.push("/api/dm/projects");
    candidates.push("/api/dev/projects");
  }

  return Array.from(new Set(candidates.filter(Boolean)));
}

async function fetchProjectsPayload() {
  const endpoints = getProjectsEndpointCandidates();
  let fallbackPayload = null;
  let lastError = null;

  for (const endpoint of endpoints) {
    try {
      const res = await fetch(`${BASE_URL}${endpoint}/${currentUser.id}`, {
        cache: "no-store",
      });
      const apiResponse = await readApiJsonResponse(res);
      const payload = apiResponse.data;

      if (apiResponse.ok && payload?.success) {
        if (hasProjectsInPayload(payload)) {
          return payload;
        }

        fallbackPayload = fallbackPayload || payload;
        continue;
      }

      lastError =
        new Error(
          payload?.message ||
            payload?.error ||
            `Projects request failed for ${endpoint}`,
        );
    } catch (err) {
      lastError = err;
    }
  }

  if (fallbackPayload) {
    return fallbackPayload;
  }

  throw lastError || new Error("Unable to load projects");
}

async function fetchDEVProjects(options = {}) {
  if (!currentUser || !currentUser.id) {
    console.error("User ID not found in currentUser");
    showPopup("Error", "User session invalid", false);
    return;
  }

  const skipDraftSync = Boolean(options.skipDraftSync);

  console.log("Fetching projects for DEV ID:", currentUser.id);

  try {
    if (!skipDraftSync) {
      const syncSummary = await syncPendingPhaseTrackerDrafts();
      if (syncSummary.synced > 0) {
        showPopup(
          "Tracker Sync",
          `${syncSummary.synced} project tracker detail${syncSummary.synced === 1 ? "" : "s"} synced to the database.`,
          true,
        );
      }
    }

    const result = await fetchProjectsPayload();

    console.log("DEV Projects API Response:", result);

    const assignedContainer = document.getElementById("assignedContainer");
    const ongoingContainer = document.getElementById("ongoingContainer");
    const completedContainer = document.getElementById("completedContainer");

    assignedContainer.innerHTML = "";
    ongoingContainer.innerHTML = "";
    completedContainer.innerHTML = "";

    if (result.success) {
      const { assigned, assignedView, ongoing, completed } = getProjectsBySection(result);
      projectAssignmentIndex = new Map();

      [...assignedView, ...ongoing, ...completed].forEach((project) => {
        const assignmentId = getProjectAssignmentId(project);
        if (assignmentId) {
          projectAssignmentIndex.set(String(assignmentId), project);
        }
      });

      if (assignedView.length > 0) {
        assignedContainer.innerHTML = assignedView
          .map((project) => createProjectCard(project, "assigned"))
          .join("");
      } else {
        assignedContainer.innerHTML = `<div class="empty">No Assigned Projects</div>`;
      }

      if (ongoing.length > 0) {
        ongoingContainer.innerHTML = ongoing
          .map((project) => createOngoingCard(project))
          .join("");
      } else {
        ongoingContainer.innerHTML = `<div class="card"><h3>No Ongoing Projects</h3></div>`;
      }

      if (completed.length > 0) {
        completedContainer.innerHTML = completed
          .map((project) => createProjectCard(project, "completed"))
          .join("");
      } else {
        completedContainer.innerHTML = `<div class="card"><h3>No Completed Projects</h3></div>`;
      }

      updateDevReports(assigned, ongoing, completed);
    } else {
      const errorHTML = `<div class="card"><h3>Error loading projects</h3></div>`;
      assignedContainer.innerHTML = errorHTML;
      ongoingContainer.innerHTML = errorHTML;
      completedContainer.innerHTML = errorHTML;
    }
  } catch (err) {
    console.error("DEV Projects Fetch Error:", err);
    showPopup("Error", "Failed to load projects. Check console.", false);
  }
}

function createProjectCard(project, sectionStatus) {
  const assignmentId = getProjectAssignmentId(project) || null;
  const cardStatus = (
    project.status ||
    sectionStatus ||
    "assigned"
  ).toLowerCase();
  const progress = clampPhaseProgress(project.progress, cardStatus === "completed" ? 100 : 0);
  const buttonLabel = cardStatus === "completed" ? "View Details" : "Manage Phases";

  return `
    <div class="project-card ${cardStatus}" data-assignment-id="${assignmentId || ""}">
        <div class="card-header">
            <h3>${escapeHtml(project.projectName || project.company_name || "Untitled Project")}</h3>
            <span class="badge ${cardStatus}">
              ${cardStatus.toUpperCase()}
            </span>
        </div>

        <div class="card-body">
            <p><i class="fas fa-user"></i> ${escapeHtml(project.client || project.client_name || "N/A")}</p>

            <p>
              <i class="fas fa-cogs"></i>
              <span class="service-badge">
                ${escapeHtml(formatServiceLabel(project.serviceType || project.service || project.service_type || "N/A"))}
              </span>
            </p>

            ${buildProjectInsights(project)}
        </div>

        <div class="card-footer">
            <span class="card-progress">${progress}% complete</span>
            <button class="view-btn" data-assignment-id="${assignmentId || ""}" data-status="${cardStatus}" ${assignmentId ? "" : "disabled"}>
              ${buttonLabel}
            </button>
        </div>
    </div>
  `;
}

const serviceWorkflows = {
  web: {
    steps: ["discovery", "design", "development", "testing", "launch"],
    labels: {
      discovery: "Discovery",
      design: "UI/UX",
      development: "Development",
      testing: "Testing",
      launch: "Launch",
    },
    hints: {
      discovery: "Capture the project scope, sitemap, access requirements, and milestone plan.",
      design: "Finalize the wireframes, UI approvals, and page flow decisions.",
      development: "Track the progress of core pages, forms, integrations, and modules.",
      testing: "Record responsiveness checks, QA updates, bug fixes, and client review status.",
      launch: "Save the live deployment, credentials handover, and post-launch notes here.",
    },
  },
  crm: {
    steps: ["discovery", "module_mapping", "development", "testing_training", "go_live"],
    labels: {
      discovery: "Discovery",
      module_mapping: "Module Map",
      development: "Development",
      testing_training: "Testing",
      go_live: "Go Live",
    },
    hints: {
      discovery: "Capture the business flow, gather requirements, and lock the project scope.",
      module_mapping: "Map the CRM or ERP modules, permissions, and workflow structure.",
      development: "Track custom fields, automations, reports, and integration setup.",
      testing_training: "Add UAT results, sample data validation, and team training notes.",
      go_live: "Complete the production handover, credentials sharing, and support checklist.",
    },
  },
  erp: {
    steps: ["discovery", "module_mapping", "development", "testing_training", "go_live"],
    labels: {
      discovery: "Discovery",
      module_mapping: "Module Map",
      development: "Development",
      testing_training: "Testing",
      go_live: "Go Live",
    },
    hints: {
      discovery: "Document the requirements and process understanding in detail.",
      module_mapping: "Align the departments, modules, masters, and reporting structure.",
      development: "Track customizations, imports, and system logic implementation.",
      testing_training: "Record UAT fixes, walkthroughs, and client training updates.",
      go_live: "Close deployment, handover, and support tasks for the launch.",
    },
  },
  app: {
    steps: ["planning", "ui_ux", "development", "qa", "release"],
    labels: {
      planning: "Planning",
      ui_ux: "UI/UX",
      development: "Development",
      qa: "QA",
      release: "Release",
    },
    hints: {
      planning: "Define the product flow, API scope, user stories, and milestones.",
      ui_ux: "Document the screens, navigation, and approval status.",
      development: "Record build progress, APIs, authentication, and device-specific work.",
      qa: "Capture test devices, bug status, and pending fixes.",
      release: "Attach the APK or IPA status, store submission, and handover details.",
    },
  },
  seo: {
    supportsPhaseUploads: true,
    steps: [
      "assignment",
      "keyword_research",
      "keyword_approval",
      "seo_calendar",
      "work_tracker",
      "reporting",
    ],
    labels: {
      assignment: "Assignment",
      keyword_research: "Keyword Research",
      keyword_approval: "Keyword Approval",
      seo_calendar: "SEO Calendar",
      work_tracker: "Work Tracker",
      reporting: "Reports",
    },
    hints: {
      assignment:
        "Confirm the client brief, website details, renewal date, and assigned SEO owner.",
      keyword_research:
        "Capture the keyword sheet, manual list, search volume, difficulty, and target location.",
      keyword_approval:
        "Maintain the admin/client approval status, feedback, and resubmission updates.",
      seo_calendar:
        "Define the content calendar, posting plan, on-page tasks, backlinks, and GMB roadmap.",
      work_tracker:
        "Update completed SEO work, content posting, backlinks, and live execution progress.",
      reporting:
        "Save work reports, rank reports, overview summaries, and proof links here.",
    },
    phaseContent: {
      assignment: {
        focusItems: [
          "Client + website brief",
          "Assigned SEO resource",
          "Start and renewal dates",
          "Scope and status lock",
        ],
        noteLabel: "Project Brief",
        noteHelp:
          "Add the client name, website, assigned SEO owner, scope, and onboarding summary here.",
        blockersLabel: "Access / Dependencies",
        blockersHelp:
          "Mention any pending Search Console, Analytics, CMS, hosting, GMB, or client approvals.",
        deliverableLabel: "Website / Brief Link",
        deliverablePlaceholder:
          "Website URL, audit doc, onboarding sheet, or drive link",
        deliverableHelp:
          "Add the link to the primary website, onboarding doc, audit file, or brief sheet.",
      },
      keyword_research: {
        focusItems: [
          "Keyword sheet upload",
          "Manual keyword list",
          "Volume + difficulty",
          "Target location",
        ],
        noteLabel: "Keyword Notes",
        noteHelp:
          "Save the primary and secondary keywords, intent, search volume, difficulty, and location summary here.",
        blockersLabel: "Research Gaps / Pending Inputs",
        blockersHelp:
          "Note any pending niche clarity, competitor references, target city details, or client confirmation.",
        deliverableLabel: "Keyword Sheet / File Link",
        deliverablePlaceholder:
          "Drive link, Google Sheet, Excel, CSV, or keyword document",
        deliverableHelp:
          "Add the link to the keyword research file, competitor sheet, or uploaded document.",
        attachmentLabel: "Keyword Files Upload",
        attachmentHelp:
          "Upload Excel, CSV, or keyword research documents here. After you save the details, everyone will be able to view them in the tracker.",
        attachmentAccept:
          ".xls,.xlsx,.csv,.tsv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv,text/tab-separated-values",
      },
      keyword_approval: {
        focusItems: [
          "Keyword submission status",
          "Admin/client approval",
          "Approved or rejected",
          "Feedback and resend notes",
        ],
        noteLabel: "Approval Update",
        noteHelp:
          "Clearly mention the submitted keyword set, approval date, approved list, and revision notes.",
        blockersLabel: "Pending Approval / Feedback",
        blockersHelp:
          "Keep pending client reviews, missing feedback, revision requests, or approval delays noted here.",
        deliverableLabel: "Approval Proof / Keyword Deck",
        deliverablePlaceholder:
          "Approval email proof, keyword presentation, or review sheet link",
        deliverableHelp:
          "Paste the link to the approved keyword document, review deck, or approval proof here.",
      },
      seo_calendar: {
        focusItems: [
          "Content calendar",
          "Posting schedule",
          "On-page task list",
          "Backlinks + GMB plan",
        ],
        noteLabel: "SEO Plan",
        noteHelp:
          "Add the monthly roadmap, daily tasks, content cadence, GMB optimization, and on-page priorities.",
        blockersLabel: "Planning Dependencies",
        blockersHelp:
          "List pending content inputs, approval delays, missing assets, or platform access issues here.",
        deliverableLabel: "Calendar / Plan Link",
        deliverablePlaceholder:
          "SEO calendar, task board, sheet, Notion, or drive folder link",
        deliverableHelp:
          "Add the link to the content calendar, posting schedule, backlink plan, or task tracker.",
      },
      work_tracker: {
        focusItems: [
          "On-page SEO updates",
          "Content posting status",
          "Backlinks created",
          "Completed work percentage",
        ],
        noteLabel: "Execution Update",
        noteHelp:
          "Save the pages optimized, blogs posted, backlinks completed, ranking movement, and work summary here.",
        blockersLabel: "Execution Blockers",
        blockersHelp:
          "Describe approvals, developer dependencies, content delays, indexing issues, or pending access in detail.",
        deliverableLabel: "Work Proof / Tracker Link",
        deliverablePlaceholder:
          "Live pages, tracker sheet, screenshots folder, or proof document link",
        deliverableHelp:
          "Add live work proof, tracker sheets, screenshot folders, or implementation links here.",
      },
      reporting: {
        focusItems: [
          "Work report",
          "Rank report",
          "Overview summary",
          "Client-ready uploads",
        ],
        noteLabel: "Report Summary",
        noteHelp:
          "Maintain traffic, clicks, impressions, ranking growth, GMB insights, and the monthly overview summary here.",
        blockersLabel: "Data Gaps / Pending Actions",
        blockersHelp:
          "Note any pending report inputs, analytics issues, approval waits, or next-month action items.",
        deliverableLabel: "Report / Drive Link",
        deliverablePlaceholder:
          "PDF report, ranking sheet, screenshots folder, or mail-ready drive link",
        deliverableHelp:
          "Attach the link to the work report, rank report, overview deck, or uploaded proof files.",
        attachmentLabel: "Reports & Images Upload",
        attachmentHelp:
          "Upload PDF reports, ranking sheets, screenshots, and client-ready proof files here.",
        attachmentAccept:
          ".pdf,.doc,.docx,.xls,.xlsx,.csv,.png,.jpg,.jpeg,.webp,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      },
    },
  },
  smo: {
    supportsPhaseUploads: true,
    steps: [
      "assignment",
      "strategy_research",
      "content_approval",
      "content_calendar",
      "publishing_growth",
      "reporting",
    ],
    labels: {
      assignment: "Assignment",
      strategy_research: "Strategy",
      content_approval: "Approvals",
      content_calendar: "Calendar",
      publishing_growth: "Publishing",
      reporting: "Reports",
    },
    hints: {
      assignment: "Confirm the brand handles, platform scope, assigned owner, and campaign basics.",
      strategy_research: "Maintain the audience research, competitor insights, hashtags, and content pillars.",
      content_approval: "Track creatives, captions, scripts, and the approval or revision flow.",
      content_calendar: "Save the monthly calendar, reels and stories schedule, and content plan here.",
      publishing_growth: "Update publishing, engagement, boosts, promotions, and community actions.",
      reporting: "Attach reach, engagement, lead updates, and the monthly summary with proof here.",
    },
    phaseContent: {
      assignment: {
        focusItems: [
          "Brand handles and platforms",
          "Assigned SMO resource",
          "Campaign scope",
          "Start timeline",
        ],
        noteLabel: "Campaign Brief",
        noteHelp:
          "Add the brand pages, active platforms, owner assignment, and campaign scope summary here.",
        blockersLabel: "Access / Dependencies",
        blockersHelp:
          "Note any pending page access, ad account access, media kit, brand guidelines, or client inputs.",
        deliverableLabel: "Brand / Brief Link",
        deliverablePlaceholder:
          "Instagram or Facebook page, brief doc, or drive folder link",
        deliverableHelp:
          "Add the link to the brand brief, handle links, content references, or drive folder here.",
      },
      strategy_research: {
        focusItems: [
          "Audience research",
          "Competitor references",
          "Content pillars",
          "Hashtag strategy",
        ],
        noteLabel: "Strategy Notes",
        noteHelp:
          "Document the target audience, competitor learnings, campaign angle, content buckets, and hashtag plan.",
        blockersLabel: "Research Gaps / Pending Inputs",
        blockersHelp:
          "Mention any pending client tone guidance, competitor samples, offer clarity, or location focus.",
        deliverableLabel: "Strategy Sheet / Research Link",
        deliverablePlaceholder:
          "Strategy deck, research sheet, moodboard, or competitor doc link",
        deliverableHelp:
          "Add the link to the audience research, reference deck, content strategy, or hashtag sheet.",
      },
      content_approval: {
        focusItems: [
          "Creatives and captions",
          "Approval flow",
          "Revision cycle",
          "Scripts and hooks",
        ],
        noteLabel: "Content Approval Update",
        noteHelp:
          "Maintain the creative concepts, caption direction, approval status, and feedback rounds here.",
        blockersLabel: "Pending Approval / Feedback",
        blockersHelp:
          "Document client revisions, design holds, pending scripts, or brand guideline issues here.",
        deliverableLabel: "Creative / Approval Link",
        deliverablePlaceholder:
          "Canva, drive folder, caption sheet, or approval proof link",
        deliverableHelp:
          "Add the link to the creatives folder, caption doc, approval screenshots, or review board.",
        attachmentLabel: "Creative Files Upload",
        attachmentHelp:
          "Upload creatives, caption docs, review screenshots, and approval files here.",
        attachmentAccept:
          ".pdf,.doc,.docx,.png,.jpg,.jpeg,.webp,.xls,.xlsx,.csv,application/pdf",
      },
      content_calendar: {
        focusItems: [
          "Monthly content calendar",
          "Posting schedule",
          "Reels and stories plan",
          "Campaign timeline",
        ],
        noteLabel: "Calendar Notes",
        noteHelp:
          "Clearly record the monthly plan, daily posting flow, story or reel split, and campaign timeline.",
        blockersLabel: "Planning Dependencies",
        blockersHelp:
          "Mention any pending creatives, offer details, festival campaign assets, or client approvals.",
        deliverableLabel: "Calendar / Planner Link",
        deliverablePlaceholder:
          "Content calendar sheet, planner board, Notion, or drive link",
        deliverableHelp:
          "Add the link to the monthly planner, posting schedule, content board, or reel tracker here.",
      },
      publishing_growth: {
        focusItems: [
          "Posted content status",
          "Engagement updates",
          "Boost and promotion",
          "Community response",
        ],
        noteLabel: "Publishing Update",
        noteHelp:
          "Save the published posts, engagement wins, promotion activity, follower movement, and daily execution here.",
        blockersLabel: "Execution Blockers",
        blockersHelp:
          "Describe low approvals, ad boost delays, response delays, account issues, or asset gaps in detail.",
        deliverableLabel: "Post Proof / Tracker Link",
        deliverablePlaceholder:
          "Published posts, screenshot folder, tracker sheet, or campaign link",
        deliverableHelp:
          "Add live post links, screenshot folders, engagement trackers, or promotion proof here.",
        attachmentLabel: "Post Proof Upload",
        attachmentHelp:
          "Upload published post screenshots, tracker sheets, and promotion proof files here.",
        attachmentAccept:
          ".pdf,.png,.jpg,.jpeg,.webp,.xls,.xlsx,.csv,application/pdf",
      },
      reporting: {
        focusItems: [
          "Reach and engagement",
          "Lead or inquiry summary",
          "Growth overview",
          "Monthly proof files",
        ],
        noteLabel: "Report Summary",
        noteHelp:
          "Maintain reach, impressions, engagement, follower growth, inquiries, and monthly learnings here.",
        blockersLabel: "Pending Data / Next Actions",
        blockersHelp:
          "Add missing insights, pending screenshots, reporting delays, or next-cycle recommendations.",
        deliverableLabel: "Report / Insights Link",
        deliverablePlaceholder:
          "Insight screenshots, PDF summary, sheet report, or drive folder link",
        deliverableHelp:
          "Attach the link to the monthly report, screenshots, reel analytics, or overview deck here.",
        attachmentLabel: "Reports & Insights Upload",
        attachmentHelp:
          "Upload insight screenshots, PDF reports, sheets, and monthly proof files here.",
        attachmentAccept:
          ".pdf,.doc,.docx,.xls,.xlsx,.csv,.png,.jpg,.jpeg,.webp,application/pdf",
      },
    },
  },
  ads: {
    steps: ["planning", "setup", "optimization", "reporting"],
    labels: {
      planning: "Planning",
      setup: "Setup",
      optimization: "Running",
      reporting: "Report",
    },
    hints: {
      planning: "Document the budget, audience, and campaign goals.",
      setup: "Add the campaign structure, tracking setup, and creatives.",
      optimization: "Maintain optimization updates, CPL or ROAS changes, and test notes.",
      reporting: "Share the performance summary and next action plan.",
    },
  },
};

function getWorkflowConfig(serviceValue = "") {
  return serviceWorkflows[resolveWorkflowKey(serviceValue)] || serviceWorkflows.web;
}

const DEFAULT_PHASE_FIELD_COPY = {
  noteLabel: "Work Notes",
  noteHelp: "Clearly describe what is completed, what is pending, and the current status of this phase.",
  blockersLabel: "Blockers / Dependencies",
  blockersHelp:
    "Note any client approvals, credentials, assets, API keys, feedback, or other dependencies.",
  deliverableLabel: "Deliverable Link",
  deliverablePlaceholder: "Figma, staging URL, repo, drive link, APK, sheet...",
  deliverableHelp: "Add the link for the relevant deliverable or proof whenever it is available.",
  attachmentLabel: "Files Upload",
  attachmentHelp:
    "Upload relevant documents, screenshots, or supporting files here and use Save Details to persist them.",
  attachmentAccept:
    ".pdf,.doc,.docx,.xls,.xlsx,.csv,.tsv,.png,.jpg,.jpeg,.webp,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  focusItems: [],
};

function getPhaseContentConfig(serviceValue = "", phaseKey = "") {
  const workflow = getWorkflowConfig(serviceValue);
  return {
    ...DEFAULT_PHASE_FIELD_COPY,
    ...(workflow.phaseContent?.[phaseKey] || {}),
  };
}

function getStageDisplayLabel(serviceValue, stageValue, fallback = "Phase pending") {
  const workflow = getWorkflowConfig(serviceValue);
  const stageKey = normalizeStageForWorkflow(
    resolveWorkflowKey(serviceValue),
    stageValue || workflow.steps[0],
  );

  return workflow.labels[stageKey] || fallback;
}

function buildProjectInsights(project) {
  const serviceValue =
    project.serviceType ||
    project.service ||
    project.service_type ||
    "";
  const status = String(project.status || "assigned").toLowerCase();
  const progress = clampPhaseProgress(project.progress, status === "completed" ? 100 : 0);
  const stageLabel =
    status === "assigned" && progress === 0
      ? "Phase setup pending"
      : getStageDisplayLabel(serviceValue, project.stage);
  const trackerText =
    status === "completed"
      ? "Delivery closed"
      : status === "ongoing"
        ? "Tracker active"
        : "Tracker ready";

  return `
    <div class="card-insights">
      <span class="insight-pill">
        <i class="fas fa-diagram-project"></i>
        ${escapeHtml(stageLabel)}
      </span>
      <span class="insight-pill">
        <i class="fas fa-clipboard-check"></i>
        ${escapeHtml(trackerText)}
      </span>
    </div>
  `;
}

function resolveWorkflowKey(serviceValue = "") {
  const service = String(serviceValue || "").toLowerCase();

  if (service.includes("seo")) return "seo";
  if (service.includes("smo")) return "smo";
  if (service.includes("ads") || service.includes("google ads")) return "ads";
  if (service.includes("crm")) return "crm";
  if (service.includes("erp")) return "erp";
  if (service.includes("web")) return "web";
  if (service.includes("app")) return "app";

  return "web";
}

const workflowStageAliases = {
  web: {
    deployment: "launch",
  },
  crm: {
    design: "module_mapping",
    testing: "testing_training",
    deployment: "go_live",
  },
  erp: {
    design: "module_mapping",
    testing: "testing_training",
    deployment: "go_live",
  },
  app: {
    design: "ui_ux",
    testing: "qa",
    deployment: "release",
  },
  seo: {
    planning: "keyword_research",
    research: "keyword_research",
    optimization: "keyword_approval",
    onpage_seo: "work_tracker",
    technical_seo: "work_tracker",
    content_creation: "seo_calendar",
    offpage_seo: "work_tracker",
    execution: "work_tracker",
    report: "reporting",
  },
  smo: {
    planning: "strategy_research",
    research_strategy: "strategy_research",
    profile_setup: "strategy_research",
    content: "content_approval",
    content_creation: "content_approval",
    posting: "publishing_growth",
    publishing: "publishing_growth",
    posting_engagement: "publishing_growth",
    growth_promotion: "publishing_growth",
    report: "reporting",
    analytics_optimization: "reporting",
  },
  ads: {
    setup: "setup",
    ad_creation: "setup",
    approval: "setup",
    running: "optimization",
    live: "optimization",
    report: "reporting",
  },
};

function normalizeStageForWorkflow(workflowKey, stageValue) {
  const stage = String(stageValue || "").toLowerCase().trim();
  const workflow = serviceWorkflows[workflowKey] || serviceWorkflows.web;
  const mappedStage = workflowStageAliases[workflowKey]?.[stage] || stage;

  return workflow.steps.includes(mappedStage) ? mappedStage : workflow.steps[0];
}

function createOngoingCard(project) {
  const service = (
    project.serviceType ||
    project.service ||
    project.service_type ||
    ""
  ).toLowerCase();
  const workflowKey = resolveWorkflowKey(service);
  const workflow = serviceWorkflows[workflowKey];
  const steps = workflow.steps;
  const stage = normalizeStageForWorkflow(workflowKey, project.stage || steps[0]);
  const progress = clampPhaseProgress(project.progress, 0);
  const assignmentId = getProjectAssignmentId(project) || "";

  function getStatus(step) {
    if (step === stage) return "ongoing";
    return steps.indexOf(step) < steps.indexOf(stage) ? "completed" : "pending";
  }

  const dynamicStepsHTML = steps
    .map((stepName) =>
      createStep(workflow.labels[stepName], stepName, getStatus(stepName), assignmentId),
    )
    .join("");

  return `
    <div class="project-card ongoing" data-assignment-id="${assignmentId}">
      <div class="card-header">
        <h3>${escapeHtml(project.projectName || project.company_name || "Untitled Project")}</h3>
        <span class="badge ongoing">Ongoing</span>
      </div>

      <div class="card-body">
        <p><i class="fas fa-user"></i> ${escapeHtml(project.client || project.client_name || "N/A")}</p>

        <p>
          <i class="fas fa-cogs"></i>
          <span class="service-badge">
            ${escapeHtml(formatServiceLabel(project.serviceType || project.service || project.service_type || "N/A"))}
          </span>
        </p>

        ${buildProjectInsights(project)}
      </div>

      <div class="progress-bar">
        <div class="progress-fill" style="width:${progress}%"></div>
      </div>

      <span class="progress-text">${progress}% completed</span>

      <div class="steps">
        ${dynamicStepsHTML}
      </div>

      <div class="card-footer">
        <span class="card-progress">${getStageDisplayLabel(service, stage)}</span>
        <button class="view-btn" data-assignment-id="${assignmentId}" data-status="ongoing">
          Manage Phases
        </button>
      </div>
    </div>
  `;
}

function buildPhaseTrackerOverviewHTML(assignment, summary) {
  const serviceValue = assignment?.serviceType || assignment?.service_type || "";
  const serviceLabel = formatServiceLabel(serviceValue);
  const stageLabel =
    summary.status === "assigned" && summary.progress === 0
      ? "Not started"
      : getStageDisplayLabel(serviceValue, summary.stage, "Phase pending");
  const statusLabel =
    summary.status === "assigned"
      ? "Assigned"
      : formatPhaseStatusLabel(summary.status);

  return `
    <div class="phase-overview-main">
      <span>${escapeHtml(serviceLabel)} Workflow</span>
      <strong>${escapeHtml(assignment?.projectName || "Project Phase Tracker")}</strong>
      <small>${escapeHtml(assignment?.client || "Client not available")} - ${escapeHtml(stageLabel)}</small>
    </div>
    <div class="phase-overview-stat">
      <span class="phase-overview-label">Overall Progress</span>
      <strong class="phase-overview-value">${summary.progress}%</strong>
      <small class="phase-overview-subtext">Average completion across all phases</small>
    </div>
    <div class="phase-overview-stat">
      <span class="phase-overview-label">Completed</span>
      <strong class="phase-overview-value">${summary.completedCount}/${summary.totalPhases}</strong>
      <small class="phase-overview-subtext">Phases fully delivered</small>
    </div>
    <div class="phase-overview-stat">
      <span class="phase-overview-label">Current Stage</span>
      <strong class="phase-overview-value">${escapeHtml(stageLabel)}</strong>
      <small class="phase-overview-subtext">${escapeHtml(statusLabel)} workflow status</small>
    </div>
    <div class="phase-overview-stat">
      <span class="phase-overview-label">Attention</span>
      <strong class="phase-overview-value">${summary.blockedCount}</strong>
      <small class="phase-overview-subtext">
        ${summary.blockedCount > 0 ? "Blocked phases need action" : "No blockers marked yet"}
      </small>
    </div>
  `;
}

function buildPhaseDateField(label, field, index, value) {
  const isoValue = formatDateFieldValue(value);
  const displayValue = formatDateDisplayValue(value);
  const nativeInputId = `phase-native-date-${field}-${index}`;

  return `
    <div class="phase-field">
      <label>${escapeHtml(label)}</label>
      <div class="phase-date-control">
        <input
          type="text"
          class="phase-date-display"
          inputmode="numeric"
          placeholder="DD/MM/YYYY"
          value="${escapeHtml(displayValue)}"
          data-phase-index="${index}"
          data-phase-field="${escapeHtml(field)}"
          data-phase-date-display="true"
        />
        <button
          type="button"
          class="phase-date-trigger"
          data-phase-date-button="${escapeHtml(field)}"
          data-phase-index="${index}"
          data-phase-native-target="${nativeInputId}"
          aria-label="Choose ${escapeHtml(label)}"
        >
          <i class="far fa-calendar-alt"></i>
        </button>
        <input
          type="date"
          class="phase-native-date"
          id="${nativeInputId}"
          tabindex="-1"
          aria-hidden="true"
          value="${escapeHtml(isoValue)}"
          data-phase-index="${index}"
          data-phase-native-field="${escapeHtml(field)}"
        />
      </div>
    </div>
  `;
}

function buildPhaseFocusSection(focusItems = []) {
  if (!Array.isArray(focusItems) || focusItems.length === 0) {
    return "";
  }

  return `
    <div class="phase-focus full">
      <span class="phase-focus-label">Track In This Phase</span>
      <div class="phase-focus-list">
        ${focusItems
          .map(
            (item) => `<span class="phase-focus-chip">${escapeHtml(item)}</span>`,
          )
          .join("")}
      </div>
    </div>
  `;
}

function buildPhaseAttachmentsSection(
  phase,
  index,
  workflow,
  phaseContent,
  serviceValue = "",
) {
  if (!workflow?.supportsPhaseUploads) {
    return "";
  }

  const attachments = normalizePhaseAttachmentsValue(phase?.attachments);
  const inputId = `phase-attachment-input-${phase?.phase_key || index}`;
  const uploading = isPhaseAttachmentUploading(phase?.phase_key, index);

  return `
    <div class="phase-field full phase-attachments-field">
      <div class="phase-attachments-head">
        <div>
          <label>${escapeHtml(phaseContent.attachmentLabel)}</label>
          <small>${escapeHtml(phaseContent.attachmentHelp)}</small>
        </div>
        <label class="phase-attachment-trigger ${uploading ? "is-uploading" : ""}" for="${inputId}">
          <i class="fas fa-cloud-upload-alt"></i>
          ${uploading ? "Uploading..." : "Upload Files"}
        </label>
      </div>
      <input
        id="${inputId}"
        type="file"
        class="phase-attachment-input"
        data-phase-attachment-input="true"
        data-phase-index="${index}"
        data-phase-key="${escapeHtml(phase?.phase_key || "")}"
        accept="${escapeHtml(phaseContent.attachmentAccept || "")}"
        multiple
        ${uploading ? "disabled" : ""}
      />
      ${
        attachments.length
          ? `
            <div class="phase-attachment-list">
              ${attachments
                .map(
                  (attachment, attachmentIndex) => `
                    <div class="phase-attachment-item">
                      <a
                        href="${escapeHtml(attachment.url)}"
                        target="_blank"
                        rel="noreferrer"
                        class="phase-attachment-link"
                      >
                        <i class="fas fa-paperclip"></i>
                        <span>${escapeHtml(attachment.name)}</span>
                      </a>
                      <div class="phase-attachment-meta">
                        <span>${escapeHtml(formatAttachmentSize(attachment.size) || "File")}</span>
                        <button
                          type="button"
                          class="phase-attachment-remove"
                          data-phase-attachment-remove="true"
                          data-phase-index="${index}"
                          data-phase-attachment-item="${attachmentIndex}"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  `,
                )
                .join("")}
            </div>
          `
          : `<div class="phase-attachment-empty">${escapeHtml(getPhaseAttachmentEmptyMessage(serviceValue))}</div>`
      }
    </div>
  `;
}

function buildPhaseTrackerCard(phase, index, serviceValue = "", assignment = {}) {
  const workflow = getWorkflowConfig(serviceValue);
  const hint =
    workflow.hints?.[phase.phase_key] || getPhaseTrackerHintFallback(serviceValue);
  const phaseContent = getPhaseContentConfig(serviceValue, phase.phase_key);
  const status = normalizePhaseStatusValue(phase.status, "pending");
  const progress = clampPhaseProgress(phase.progress, status === "completed" ? 100 : 0);
  const selectOptions = PHASE_STATUSES.map(
    (option) => `
      <option value="${option}" ${option === status ? "selected" : ""}>
        ${formatPhaseStatusLabel(option)}
      </option>
    `,
  ).join("");

  return `
    <article class="phase-card is-${status}" data-phase-card="${escapeHtml(phase.phase_key || `phase-${index}`)}">
      <div class="phase-card-head">
        <div class="phase-card-title">
          <span class="phase-card-index">${index + 1}</span>
          <div>
            <h3>${escapeHtml(phase.phase_label || phase.phase_key || `Phase ${index + 1}`)}</h3>
            <p>${escapeHtml(hint)}</p>
          </div>
        </div>
        <span class="phase-status-chip ${status}">${formatPhaseStatusLabel(status)}</span>
      </div>

      <div class="phase-card-grid">
        ${buildPhaseFocusSection(phaseContent.focusItems)}

        <div class="phase-field">
          <label>Status</label>
          <select data-phase-index="${index}" data-phase-field="status">
            ${selectOptions}
          </select>
        </div>

        <div class="phase-field">
          <label>Progress %</label>
          <input
            type="number"
            min="0"
            max="100"
            value="${progress}"
            data-phase-index="${index}"
            data-phase-field="progress"
          />
        </div>

        ${buildPhaseDateField("Start Date", "start_date", index, phase.start_date)}

        ${buildPhaseDateField("Due Date", "due_date", index, phase.due_date)}

        <div class="phase-field full">
          <label>${escapeHtml(phaseContent.noteLabel)}</label>
          <textarea data-phase-index="${index}" data-phase-field="notes">${escapeHtml(phase.notes || "")}</textarea>
          <small>${escapeHtml(phaseContent.noteHelp)}</small>
        </div>

        <div class="phase-field full">
          <label>${escapeHtml(phaseContent.blockersLabel)}</label>
          <textarea data-phase-index="${index}" data-phase-field="blockers">${escapeHtml(phase.blockers || "")}</textarea>
          <small>${escapeHtml(phaseContent.blockersHelp)}</small>
        </div>

        <div class="phase-field full">
          <label>${escapeHtml(phaseContent.deliverableLabel)}</label>
          <input
            type="text"
            placeholder="${escapeHtml(phaseContent.deliverablePlaceholder)}"
            value="${escapeHtml(phase.deliverable_link || "")}"
            data-phase-index="${index}"
            data-phase-field="deliverable_link"
          />
          <small>${escapeHtml(phaseContent.deliverableHelp)}</small>
        </div>

        ${buildPhaseAttachmentsSection(
          phase,
          index,
          workflow,
          phaseContent,
          serviceValue,
        )}

        ${buildPhaseClientShareSection(assignment, phase, serviceValue)}
      </div>
    </article>
  `;
}

function updatePhaseTrackerSummaryUI() {
  const { title, subtitle, overview, saveBtn, saveNote } = getPhaseTrackerElements();

  if (!phaseTrackerState) return;

  const assignment = phaseTrackerState.assignment || {};
  const serviceValue = assignment.serviceType || assignment.service_type || "";
  const summary = summarizePhaseState(phaseTrackerState.phases);

  if (title) {
    title.textContent = assignment.projectName || "Project Phase Tracker";
  }

  if (subtitle) {
    subtitle.textContent = getPhaseTrackerSubtitleCopy(
      serviceValue,
      assignment.client || "this client",
    );
  }

  if (overview) {
    overview.innerHTML = buildPhaseTrackerOverviewHTML(assignment, summary);
  }

  if (saveBtn) {
    saveBtn.disabled = phaseTrackerSaving || !selectedAssignmentId;
    saveBtn.textContent = phaseTrackerSaving ? "Saving..." : "Save Details";
  }

  if (saveNote) {
    saveNote.textContent = getPhaseTrackerSaveNoteCopy(
      serviceValue,
      summary,
      phaseTrackerState.apiUnavailable,
    );
  }
}

function renderPhaseTracker() {
  const { body } = getPhaseTrackerElements();

  if (!phaseTrackerState || !body) return;

  if (!Array.isArray(phaseTrackerState.phases) || phaseTrackerState.phases.length === 0) {
    body.innerHTML = `<div class="phase-tracker-empty">No phases configured for this project yet.</div>`;
    updatePhaseTrackerSummaryUI();
    return;
  }

  const serviceValue =
    phaseTrackerState.assignment?.serviceType ||
    phaseTrackerState.assignment?.service_type ||
    "";

  body.innerHTML = phaseTrackerState.phases
    .map((phase, index) =>
      buildPhaseTrackerCard(
        phase,
        index,
        serviceValue,
        phaseTrackerState.assignment || {},
      ),
    )
    .join("");

  updatePhaseTrackerSummaryUI();

  if (phaseTrackerState.focusPhase) {
    const focusKey = phaseTrackerState.focusPhase;
    phaseTrackerState.focusPhase = "";
    requestAnimationFrame(() => {
      document
        .querySelector(`[data-phase-card="${focusKey}"]`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }
}

function setPhaseTrackerLoading(message) {
  const { title, subtitle, overview, body, saveBtn } = getPhaseTrackerElements();
  const assignment = phaseTrackerState?.assignment || {};

  if (title) {
    title.textContent = assignment.projectName || "Loading project...";
  }

  if (subtitle) {
    subtitle.textContent = assignment.client
      ? `Preparing tracker for ${assignment.client}...`
      : "Loading phase details...";
  }

  if (overview) {
    overview.innerHTML = `<div class="phase-tracker-loading">${escapeHtml(message)}</div>`;
  }

  if (body) {
    body.innerHTML = `<div class="phase-tracker-loading">${escapeHtml(message)}</div>`;
  }

  if (saveBtn) {
    saveBtn.disabled = true;
  }
}

async function openPhaseTracker(assignmentId, focusPhase = "") {
  if (!assignmentId) {
    showPopup("Error", "Assignment details not found", false);
    return;
  }

  const { modal } = getPhaseTrackerElements();
  if (!modal) return;

  selectedAssignmentId = String(assignmentId);
  phaseTrackerState = {
    assignment: projectAssignmentIndex.get(String(assignmentId)) || {},
    phases: [],
    focusPhase,
  };

  modal.classList.remove("hidden");
  document.body.classList.add("modal-open");
  setPhaseTrackerLoading("Loading phase details...");

  try {
    const res = await fetch(
      `${BASE_URL}/api/project-assignments/${assignmentId}/phases?userId=${encodeURIComponent(currentUser?.id || "")}`,
      { cache: "no-store" },
    );
    const apiResponse = await readApiJsonResponse(res);

    if (apiResponse.data?.success) {
      const apiAssignment = apiResponse.data.assignment || phaseTrackerState.assignment || {};
      const apiPhases = normalizePhaseTrackerPhases(
        Array.isArray(apiResponse.data.phases) ? apiResponse.data.phases : [],
        apiAssignment,
      );
      const localDraft = getStoredPhaseTrackerDraft(assignmentId);

      if (localDraft && shouldPreferLocalPhaseDraft(localDraft, apiPhases, apiAssignment)) {
        const localDraftPhases = normalizePhaseTrackerPhases(
          Array.isArray(localDraft.phases) ? localDraft.phases : [],
          {
            ...apiAssignment,
            ...(localDraft.assignment || {}),
          },
        );
        phaseTrackerState = {
          assignment: {
            ...apiAssignment,
            ...(localDraft.assignment || {}),
          },
          phases: localDraftPhases.length ? localDraftPhases : apiPhases,
          focusPhase,
          mode: "local",
          apiUnavailable: true,
        };

        renderPhaseTracker();
        showPopup(
          "Tracker Draft",
          getPhaseTrackerDraftLoadedMessage(
            apiAssignment.serviceType || apiAssignment.service_type || "",
          ),
          true,
        );
        return;
      }

      if (localDraft) {
        removeStoredPhaseTrackerDraft(assignmentId);
      }

      phaseTrackerState = {
        assignment: apiAssignment,
        phases: apiPhases,
        focusPhase,
        mode: "api",
        apiUnavailable: false,
      };

      projectAssignmentIndex.set(String(assignmentId), {
        ...(projectAssignmentIndex.get(String(assignmentId)) || {}),
        ...(apiResponse.data.assignment || {}),
      });

      renderPhaseTracker();
      return;
    }

    const shouldUseLocalDraft =
      apiResponse.status === 404 &&
      (!apiResponse.data || apiResponse.isHtml || !apiResponse.rawText);

    if (shouldUseLocalDraft) {
      phaseTrackerState = buildLocalPhaseTrackerState(
        projectAssignmentIndex.get(String(assignmentId)) || phaseTrackerState.assignment || {},
        focusPhase,
      );
      renderPhaseTracker();
      showPopup(
        "Tracker",
        getPhaseTrackerLocalNote(
          phaseTrackerState?.assignment?.serviceType ||
            phaseTrackerState?.assignment?.service_type ||
            "",
        ),
        true,
      );
      return;
    }

    throw new Error(
      apiResponse.data?.message ||
        (apiResponse.isHtml
          ? getPhaseTrackerInvalidResponseMessage(
              phaseTrackerState?.assignment?.serviceType ||
                phaseTrackerState?.assignment?.service_type ||
                "",
            )
          : "Failed to load phase details"),
    );
  } catch (err) {
    console.error("Phase Tracker Load Error:", err);
    const fallbackProject =
      projectAssignmentIndex.get(String(assignmentId)) ||
      phaseTrackerState?.assignment ||
      {};

    if (getProjectAssignmentId(fallbackProject)) {
      phaseTrackerState = buildLocalPhaseTrackerState(fallbackProject, focusPhase);
      renderPhaseTracker();
      showPopup(
        "Tracker",
        getPhaseTrackerLocalNote(
          fallbackProject.serviceType || fallbackProject.service_type || "",
        ),
        true,
      );
      return;
    }

    setPhaseTrackerLoading(err.message || "Failed to load phase details");
    showPopup("Error", err.message || "Failed to load phase details", false);
  }
}

function closePhaseTracker() {
  const { modal, body, overview } = getPhaseTrackerElements();

  selectedAssignmentId = null;
  phaseTrackerState = null;
  phaseTrackerSaving = false;
  phaseTrackerUploadingKeys.clear();
  document.body.classList.remove("modal-open");
  modal?.classList.add("hidden");

  if (body) {
    body.innerHTML = `<div class="phase-tracker-loading">Loading phase details...</div>`;
  }

  if (overview) {
    overview.innerHTML = `<div class="phase-tracker-loading">Loading project overview...</div>`;
  }
}

function syncPhaseTrackerCard(index) {
  if (!phaseTrackerState?.phases?.[index]) return;

  const phase = phaseTrackerState.phases[index];
  const status = normalizePhaseStatusValue(phase.status, "pending");
  const card = document.querySelector(`[data-phase-card="${phase.phase_key}"]`);

  if (!card) {
    updatePhaseTrackerSummaryUI();
    return;
  }

  card.classList.toggle("is-ongoing", status === "ongoing");
  card.classList.toggle("is-completed", status === "completed");
  card.classList.toggle("is-blocked", status === "blocked");

  const chip = card.querySelector(".phase-status-chip");
  if (chip) {
    chip.className = `phase-status-chip ${status}`;
    chip.textContent = formatPhaseStatusLabel(status);
  }

  const progressInput = card.querySelector('[data-phase-field="progress"]');
  if (progressInput && document.activeElement !== progressInput) {
    progressInput.value = clampPhaseProgress(phase.progress, 0);
  }

  const statusSelect = card.querySelector('[data-phase-field="status"]');
  if (statusSelect && document.activeElement !== statusSelect) {
    statusSelect.value = status;
  }

  updatePhaseTrackerSummaryUI();
}

function syncPhaseTrackerDateInputs(index, field, value) {
  const displayInput = document.querySelector(
    `.phase-date-display[data-phase-index="${index}"][data-phase-field="${field}"]`,
  );
  const nativeInput = document.querySelector(
    `.phase-native-date[data-phase-index="${index}"][data-phase-native-field="${field}"]`,
  );
  const isoValue = formatDateFieldValue(value);
  const displayValue = formatDateDisplayValue(value);

  if (displayInput && document.activeElement !== displayInput) {
    displayInput.value = displayValue;
  }

  if (nativeInput && document.activeElement !== nativeInput) {
    nativeInput.value = isoValue;
  }
}

function updatePhaseTrackerField(index, field, value) {
  if (!phaseTrackerState?.phases?.[index]) return;

  const phase = phaseTrackerState.phases[index];

  if (field === "status") {
    phase.status = normalizePhaseStatusValue(value, "pending");
    if (phase.status === "completed") {
      phase.progress = 100;
    } else if (phase.status === "pending") {
      phase.progress = 0;
    } else if (clampPhaseProgress(phase.progress, 0) === 100) {
      phase.progress = 90;
    }

    syncPhaseTrackerCard(index);
    return;
  }

  if (field === "progress") {
    phase.progress = clampPhaseProgress(value, phase.progress);

    if (phase.progress === 100) {
      phase.status = "completed";
    } else if (phase.progress > 0 && phase.status === "pending") {
      phase.status = "ongoing";
    } else if (phase.progress === 0 && phase.status === "completed") {
      phase.status = "pending";
    }

    syncPhaseTrackerCard(index);
    return;
  }

  if (field === "start_date" || field === "due_date") {
    const normalizedDate = parsePhaseDateInputValue(value);

    if (!String(value || "").trim()) {
      phase[field] = "";
      syncPhaseTrackerDateInputs(index, field, "");
      return;
    }

    if (normalizedDate) {
      phase[field] = normalizedDate;
      syncPhaseTrackerDateInputs(index, field, normalizedDate);
    }
    return;
  }

  phase[field] = value;
}

function handlePhaseTrackerFieldInput(event) {
  const field = event.target?.dataset?.phaseField;
  const index = Number(event.target?.dataset?.phaseIndex);

  if (!field || !Number.isFinite(index)) return;

  updatePhaseTrackerField(index, field, event.target.value);
}

function handlePhaseTrackerNativeDateChange(event) {
  const field = event.target?.dataset?.phaseNativeField;
  const index = Number(event.target?.dataset?.phaseIndex);

  if (!field || !Number.isFinite(index)) return;

  const isoValue = formatDateFieldValue(event.target.value);
  updatePhaseTrackerField(index, field, isoValue);
  syncPhaseTrackerDateInputs(index, field, isoValue);
}

function handlePhaseDateTriggerClick(event) {
  const trigger = event.target.closest("[data-phase-date-button]");
  if (!trigger) return;

  const nativeTargetId = trigger.dataset.phaseNativeTarget;
  const nativeInput = nativeTargetId
    ? document.getElementById(nativeTargetId)
    : null;

  if (!nativeInput) return;

  event.preventDefault();
  event.stopPropagation();

  if (typeof nativeInput.showPicker === "function") {
    nativeInput.showPicker();
    return;
  }

  nativeInput.focus();
  nativeInput.click();
}

function removePhaseAttachmentItem(index, attachmentIndex) {
  if (!phaseTrackerState?.phases?.[index]) return;

  const attachments = normalizePhaseAttachmentsValue(
    phaseTrackerState.phases[index].attachments,
  );

  phaseTrackerState.phases[index].attachments = attachments.filter(
    (_, currentIndex) => currentIndex !== attachmentIndex,
  );

  renderPhaseTracker();
}

async function uploadPhaseTrackerFiles(index, files) {
  if (
    !selectedAssignmentId ||
    !phaseTrackerState?.phases?.[index] ||
    !Array.isArray(files) ||
    !files.length
  ) {
    return;
  }

  const phase = phaseTrackerState.phases[index];
  const uploadKey = getPhaseAttachmentUploadKey(phase.phase_key, index);
  const formData = new FormData();

  formData.append("userId", String(currentUser?.id || ""));
  files.forEach((file) => formData.append("files", file, file.name));

  phaseTrackerUploadingKeys.add(uploadKey);
  renderPhaseTracker();

  try {
    const res = await fetch(
      `${BASE_URL}/api/project-assignments/${selectedAssignmentId}/phases/${encodeURIComponent(phase.phase_key)}/attachments`,
      {
        method: "POST",
        body: formData,
      },
    );
    const apiResponse = await readApiJsonResponse(res);

    if (!apiResponse.data?.success) {
      throw new Error(
        apiResponse.data?.message ||
          (apiResponse.isHtml
            ? getPhaseTrackerInvalidResponseMessage(
                phaseTrackerState?.assignment?.serviceType ||
                  phaseTrackerState?.assignment?.service_type ||
                  "",
                "upload",
              )
            : "Failed to upload files"),
      );
    }

    const uploadedAttachments = normalizePhaseAttachmentsValue(
      apiResponse.data.attachments,
    );
    phase.attachments = [
      ...normalizePhaseAttachmentsValue(phase.attachments),
      ...uploadedAttachments,
    ].slice(0, 12);

    renderPhaseTracker();
    showPopup(
      "Files Uploaded",
      getPhaseTrackerFilesUploadedMessage(
        phaseTrackerState?.assignment?.serviceType ||
          phaseTrackerState?.assignment?.service_type ||
          "",
      ),
      true,
    );
  } catch (err) {
    console.error("Phase attachment upload error:", err);
    showPopup("Upload Error", err.message || "Failed to upload files", false);
  } finally {
    phaseTrackerUploadingKeys.delete(uploadKey);
    renderPhaseTracker();
  }
}

async function handlePhaseAttachmentInputChange(event) {
  const input = event.target?.closest?.("[data-phase-attachment-input]");
  if (!input) return;

  const index = Number(input.dataset.phaseIndex);
  if (!Number.isFinite(index)) return;

  const files = Array.from(input.files || []);
  input.value = "";

  if (!files.length) return;

  await uploadPhaseTrackerFiles(index, files);
}

function handlePhaseAttachmentRemoveClick(event) {
  const button = event.target.closest("[data-phase-attachment-remove]");
  if (!button) return;

  const index = Number(button.dataset.phaseIndex);
  const attachmentIndex = Number(button.dataset.phaseAttachmentItem);

  if (!Number.isFinite(index) || !Number.isFinite(attachmentIndex)) return;

  event.preventDefault();
  removePhaseAttachmentItem(index, attachmentIndex);
}

async function savePhaseTracker() {
  if (!selectedAssignmentId || !phaseTrackerState || phaseTrackerSaving) return;

  phaseTrackerSaving = true;
  updatePhaseTrackerSummaryUI();

  try {
    const payload = buildPhaseTrackerApiPayload(phaseTrackerState.phases);

    const res = await fetch(
      `${BASE_URL}/api/project-assignments/${selectedAssignmentId}/phases`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: currentUser?.id,
          phases: payload,
        }),
      },
    );
    const apiResponse = await readApiJsonResponse(res);

    if (apiResponse.data?.success) {
      removeStoredPhaseTrackerDraft(selectedAssignmentId);
      const nextAssignment =
        apiResponse.data.assignment || phaseTrackerState.assignment;
      phaseTrackerState = {
        assignment: nextAssignment,
        phases: normalizePhaseTrackerPhases(
          Array.isArray(apiResponse.data.phases)
            ? apiResponse.data.phases
            : phaseTrackerState.phases,
          nextAssignment,
        ),
        focusPhase: "",
        mode: "api",
        apiUnavailable: false,
      };

      projectAssignmentIndex.set(String(selectedAssignmentId), {
        ...(projectAssignmentIndex.get(String(selectedAssignmentId)) || {}),
        ...(apiResponse.data.assignment || {}),
      });

      renderPhaseTracker();
      await fetchDEVProjects();
      showPopup(
        "Saved",
        apiResponse.data.message || "Phase details updated",
        true,
      );
      closePhaseTracker();
      return;
    }

    const shouldUseLocalDraft =
      apiResponse.status === 404 &&
      (!apiResponse.data || apiResponse.isHtml || !apiResponse.rawText);

    if (shouldUseLocalDraft) {
      await persistPhaseTrackerLocally({ refreshProjects: false });
      await fetchDEVProjects({ skipDraftSync: true });
      showPopup(
        "Backup Saved",
        getPhaseTrackerBackupSavedMessage(
          phaseTrackerState?.assignment?.serviceType ||
            phaseTrackerState?.assignment?.service_type ||
            "",
        ),
        false,
      );
      closePhaseTracker();
      return;
    }

    throw new Error(
      apiResponse.data?.message ||
        (apiResponse.isHtml
          ? getPhaseTrackerInvalidResponseMessage(
              phaseTrackerState?.assignment?.serviceType ||
                phaseTrackerState?.assignment?.service_type ||
                "",
            )
          : "Failed to save phase details"),
    );
  } catch (err) {
    console.error("Phase Tracker Save Error:", err);
    if (phaseTrackerState) {
      await persistPhaseTrackerLocally({ refreshProjects: false });
      await fetchDEVProjects({ skipDraftSync: true });
      showPopup(
        "Sync Pending",
        getPhaseTrackerSyncPendingMessage(
          phaseTrackerState?.assignment?.serviceType ||
            phaseTrackerState?.assignment?.service_type ||
            "",
        ),
        false,
      );
      closePhaseTracker();
      return;
    }

    showPopup("Error", err.message || "Failed to save phase details", false);
  } finally {
    phaseTrackerSaving = false;
    updatePhaseTrackerSummaryUI();
  }
}

function openStatusModal(projectId, currentStatus = "") {
  if (!projectId) return;

  const modal = document.getElementById("statusModal");
  if (!modal) return;

  const normalizedStatus = String(currentStatus || "").toLowerCase();
  const isNotOngoing = normalizedStatus !== "ongoing";

  selectedProjectId = projectId;
  modal.classList.remove("hidden");

  const inProgressBtn = modal.querySelector(".in-progress");
  const completedBtn = modal.querySelector(".completed");

  if (inProgressBtn) {
    inProgressBtn.style.display =
      normalizedStatus === "ongoing" ? "none" : "inline-block";
  }

  if (completedBtn) {
    completedBtn.style.display = isNotOngoing ? "none" : "inline-block";
  }
}

function closeModal() {
  selectedProjectId = null;
  document.getElementById("statusModal")?.classList.add("hidden");
}

async function updateProjectStatus(status) {
  if (!selectedProjectId) return;

  try {
    const res = await fetch(`${BASE_URL}/api/project/update-status`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        assignment_id: selectedProjectId,
        status,
      }),
    });

    const data = await res.json();

    if (data.success) {
      showPopup("Updated!", "Project status updated", true);
      closeModal();
      fetchDEVProjects();
    } else {
      showPopup("Error", data.message, false);
    }
  } catch (err) {
    console.error(err);
    showPopup("Error", "Server error", false);
  }
}

function handleViewClick(e) {
  const btn = e.target.closest(".view-btn");
  if (
    !btn ||
    btn.classList.contains("attendance-btn") ||
    btn.classList.contains("attendance-calendar-btn")
  ) {
    return;
  }

  e.stopPropagation();

  const assignmentId = btn.dataset.assignmentId || btn.dataset.id;

  if (assignmentId) {
    openPhaseTracker(assignmentId);
  }
}

document.removeEventListener("click", handleViewClick);
document.addEventListener("click", handleViewClick);
document.removeEventListener("click", handlePhaseDateTriggerClick);
document.addEventListener("click", handlePhaseDateTriggerClick);
document.removeEventListener("click", handlePhaseAttachmentRemoveClick);
document.addEventListener("click", handlePhaseAttachmentRemoveClick);
document.removeEventListener("input", handlePhaseTrackerFieldInput);
document.addEventListener("input", handlePhaseTrackerFieldInput);
document.removeEventListener("change", handlePhaseTrackerFieldInput);
document.addEventListener("change", handlePhaseTrackerFieldInput);
document.removeEventListener("change", handlePhaseAttachmentInputChange);
document.addEventListener("change", handlePhaseAttachmentInputChange);
document.removeEventListener("change", handlePhaseTrackerNativeDateChange);
document.addEventListener("change", handlePhaseTrackerNativeDateChange);
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closePhaseTracker();
    closeModal();
  }
});
document.addEventListener("click", (event) => {
  if (event.target?.id === "phaseTrackerModal") {
    closePhaseTracker();
  }

  if (event.target?.id === "statusModal") {
    closeModal();
  }
});

function createStep(label, value, status, assignmentId) {
  return `
    <div class="step ${status}" data-assignment-id="${assignmentId}" data-stage="${value}">
      ${escapeHtml(label)}
    </div>
  `;
}

async function updateStage(projectId, stage, service) {
  const workflowKey = resolveWorkflowKey(service);
  const workflow = serviceWorkflows[workflowKey];
  const steps = workflow.steps;
  const progress = Math.floor(
    ((steps.indexOf(stage) + 1) / steps.length) * 100,
  );
  const status = stage === steps[steps.length - 1] ? "completed" : "ongoing";

  try {
    const res = await fetch(`${BASE_URL}/api/project/update-stage`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        project_id: projectId,
        stage,
        progress,
        status,
      }),
    });

    return await res.json();
  } catch (err) {
    console.error(err);
    return null;
  }
}

document.addEventListener("click", async function (e) {
  const step = e.target.closest(".step");
  if (!step) return;

  const assignmentId = step.dataset.assignmentId;
  const stage = step.dataset.stage;

  if (!assignmentId || !stage) return;

  e.stopPropagation();
  openPhaseTracker(assignmentId, stage);
});

function moveToCompleted(card) {
  const projectId = card.querySelector(".step")?.dataset.id;
  const assignedContainer = document.getElementById("assignedContainer");
  const completedContainer = document.getElementById("completedContainer");

  const emptyMsg = completedContainer.querySelector(".card");
  if (emptyMsg && emptyMsg.textContent.includes("No Completed Projects")) {
    emptyMsg.remove();
  }

  card.remove();
  card.classList.remove("ongoing");
  card.classList.add("completed");

  const badge = card.querySelector(".badge");
  if (badge) {
    badge.className = "badge completed";
    badge.textContent = "COMPLETED";
  }

  const viewBtn = card.querySelector(".view-btn");
  if (viewBtn) {
    viewBtn.dataset.status = "completed";
  }

  card.querySelector(".steps")?.remove();
  card.querySelector(".progress-bar")?.remove();
  card.querySelector(".progress-text")?.remove();
  completedContainer.prepend(card);

  if (projectId && assignedContainer) {
    const assignedMirrorCard = assignedContainer
      .querySelector(`.view-btn[data-id="${projectId}"]`)
      ?.closest(".project-card");

    if (assignedMirrorCard) {
      assignedMirrorCard.remove();
    }

    if (!assignedContainer.querySelector(".project-card")) {
      assignedContainer.innerHTML = `<div class="empty">No Assigned Projects</div>`;
    }
  }

  devReportCounts.assigned = Math.max(0, devReportCounts.assigned - 1);
  devReportCounts.ongoing = Math.max(0, devReportCounts.ongoing - 1);
  devReportCounts.completed += 1;

  document.getElementById("totalAssigned").textContent = devReportCounts.assigned;
  document.getElementById("totalOngoing").textContent = devReportCounts.ongoing;
  document.getElementById("totalCompleted").textContent =
    devReportCounts.completed;

  saveDevCounts();
  renderReportChart(
    devReportCounts.assigned,
    devReportCounts.ongoing,
    devReportCounts.completed,
  );

  renderDevDashboard();
}
