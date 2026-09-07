(function attachProjectTrackerUI() {
  const TRACKER_BASE_URL =
    window.location.protocol === "file:"
      ? "http://localhost:3000"
      : window.location.origin;
  const STATUS_LABELS = {
    assigned: "Assigned",
    ongoing: "Ongoing",
    completed: "Completed",
    unassigned: "Unassigned",
    blocked: "Blocked",
    pending: "Pending",
  };
  const SERVICE_LABELS = {
    web: "Web",
    seo: "SEO",
    smo: "SMO",
    ads: "Ads",
    app: "App",
    erp: "ERP/CRM",
  };
  const SERVICE_ALIASES = {
    web: "web",
    website: "web",
    seo: "seo",
    smo: "smo",
    socialmediaoptimization: "smo",
    ads: "ads",
    advertising: "ads",
    ad: "ads",
    app: "app",
    apps: "app",
    application: "app",
    mobileapp: "app",
    erp: "erp",
    crm: "erp",
    erpcrm: "erp",
    erp_crm: "erp",
  };
  const WORKFLOW_LABELS = {
    web: {
      discovery: "Discovery",
      design: "UI/UX",
      development: "Development",
      testing: "Testing",
      launch: "Launch",
    },
    app: {
      planning: "Planning",
      ui_ux: "UI/UX",
      development: "Development",
      qa: "QA",
      release: "Release",
    },
    crm: {
      discovery: "Discovery",
      module_mapping: "Module Map",
      development: "Development",
      testing_training: "Testing",
      go_live: "Go Live",
    },
    erp: {
      discovery: "Discovery",
      module_mapping: "Module Map",
      development: "Development",
      testing_training: "Testing",
      go_live: "Go Live",
    },
    seo: {
      assignment: "Assignment",
      keyword_research: "Keyword Research",
      keyword_approval: "Keyword Approval",
      seo_calendar: "SEO Calendar",
      work_tracker: "Work Tracker",
      reporting: "Reports",
    },
    smo: {
      assignment: "Assignment",
      strategy_research: "Strategy",
      content_approval: "Approvals",
      content_calendar: "Calendar",
      publishing_growth: "Publishing",
      reporting: "Reports",
    },
    ads: {
      planning: "Planning",
      setup: "Setup",
      optimization: "Running",
      reporting: "Report",
    },
  };
  const PHASE_ALIASES = {
    web: {
      deployment: "launch",
    },
    app: {
      design: "ui_ux",
      testing: "qa",
      deployment: "release",
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
      ad_creation: "setup",
      approval: "setup",
      live: "optimization",
      running: "optimization",
      report: "reporting",
    },
  };
  const ACTIVE_SERVICE_CARD_CLASS = "project-tracker-assignment-highlight";
  let activeServiceCard = null;
  let activeServiceCardTimeoutId = 0;

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function normalizeCount(value) {
    const number = Number(value || 0);
    return Number.isFinite(number) ? number : 0;
  }

  function formatProgress(value) {
    return Math.max(0, Math.min(100, normalizeCount(value)));
  }

  function normalizeStatus(value, fallback) {
    const status = String(value || fallback || "assigned")
      .toLowerCase()
      .trim();
    return STATUS_LABELS[status] ? status : fallback || "assigned";
  }

  function getStatusLabel(value, fallback) {
    const normalized = normalizeStatus(value, fallback);
    return STATUS_LABELS[normalized] || "Assigned";
  }

  function formatRole(role) {
    const value = String(role || "").trim();
    return value ? value.toUpperCase() : "-";
  }

  function formatDate(value, withTime) {
    if (!value) return "-";

    const plainDateMatch = String(value).trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (plainDateMatch) {
      const [, year, month, day] = plainDateMatch;
      const baseDate = `${Number(day)}/${Number(month)}/${String(year).slice(-2)}`;
      return baseDate;
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return escapeHtml(value);
    }

    const baseDate = `${date.getDate()}/${date.getMonth() + 1}/${String(date.getFullYear()).slice(-2)}`;

    if (!withTime) return baseDate;

    const hours24 = date.getHours();
    const minutes = String(date.getMinutes()).padStart(2, "0");
    const meridiem = hours24 >= 12 ? "pm" : "am";
    const hours12 = hours24 % 12 || 12;

    return `${baseDate}, ${hours12}:${minutes} ${meridiem}`;
  }

  function normalizeWhatsappPhone(value) {
    return String(value || "").replace(/[^\d]/g, "");
  }

  function toAbsoluteShareUrl(url) {
    const value = String(url || "").trim();
    if (!value) return "";

    if (/^https?:\/\//i.test(value)) return value;
    if (value.startsWith("//")) return `${window.location.protocol}${value}`;
    if (value.startsWith("/")) return `${TRACKER_BASE_URL}${value}`;

    return value;
  }

  function normalizeServiceKey(value) {
    const normalized = String(value || "")
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "");

    return SERVICE_ALIASES[normalized] || normalized;
  }

  function getServiceLabel(value) {
    const serviceKey = normalizeServiceKey(value);
    return SERVICE_LABELS[serviceKey] || value || "-";
  }

  function getPhaseDisplayLabel(serviceValue, phaseValue, fallback) {
    const serviceKey = normalizeServiceKey(serviceValue);
    const rawValue = String(phaseValue || "").trim();
    if (!rawValue) return fallback || "-";

    const normalizedValue = rawValue
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");
    const mappedValue =
      PHASE_ALIASES[serviceKey]?.[normalizedValue] || normalizedValue;
    const label = WORKFLOW_LABELS[serviceKey]?.[mappedValue];

    return label || fallback || rawValue;
  }

  function normalizeAttachments(value) {
    if (Array.isArray(value)) return value.filter(Boolean);

    if (typeof value === "string") {
      try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
      } catch (err) {
        return [];
      }
    }

    return [];
  }

  function renderBadge(status, label) {
    const normalized = normalizeStatus(status, "assigned");
    return `
      <span class="project-tracker-badge ${normalized}">
        ${escapeHtml(label || getStatusLabel(normalized))}
      </span>
    `;
  }

  function renderChip(icon, label, value) {
    return `
      <span class="project-tracker-chip">
        <i class="${escapeHtml(icon)}"></i>
        ${escapeHtml(label)}: ${escapeHtml(value || "-")}
      </span>
    `;
  }

  function renderStats(containerId, counts, options) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const safeCounts = counts || {};
    const assignmentCounts = options?.assignmentCounts || {};
    const cards = [
      { label: "Projects", value: normalizeCount(safeCounts.total) },
      { label: "Assigned", value: normalizeCount(safeCounts.assigned) },
      { label: "Ongoing", value: normalizeCount(safeCounts.ongoing) },
      { label: "Completed", value: normalizeCount(safeCounts.completed) },
      { label: "Unassigned", value: normalizeCount(safeCounts.unassigned) },
      { label: "Assignments", value: normalizeCount(assignmentCounts.total) },
    ];

    container.innerHTML = cards
      .map(
        (card) => `
          <div class="project-tracker-stat">
            <span>${escapeHtml(card.label)}</span>
            <strong>${escapeHtml(String(card.value))}</strong>
          </div>
        `,
      )
      .join("");
  }

  function renderMessage(containerId, title, body) {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = `
      <div class="project-tracker-empty">
        <strong>${escapeHtml(title)}</strong>
        <p>${escapeHtml(body)}</p>
      </div>
    `;
  }

  function renderServiceList(services) {
    const rows = Array.isArray(services) ? services : [];
    if (!rows.length) {
      return `<div class="project-tracker-chip">No services mapped</div>`;
    }

    return rows
      .map(
        (service) => {
          const serviceValue =
            typeof service === "string" ? service : service?.label || service?.key || "-";
          const serviceKey = normalizeServiceKey(
            typeof service === "string" ? service : service?.key || service?.label,
          );
          const serviceLabel = getServiceLabel(serviceValue);

          return `
          <button
            type="button"
            class="project-tracker-chip project-tracker-service-button"
            data-project-service="${escapeHtml(serviceKey)}"
            aria-label="Jump to ${escapeHtml(serviceLabel)} service tracker"
          >
            <i class="fas fa-layer-group"></i>
            ${escapeHtml(serviceLabel)}
          </button>
        `;
        },
      )
      .join("");
  }

  function renderProjectMeta(project) {
    return [
      renderChip("fas fa-user-tie", "TME", project?.createdByName || "-"),
      renderChip("fas fa-user", "ME", project?.assignedMeName || "-"),
      renderChip("fas fa-calendar-check", "Closed", formatDate(project?.closed_date)),
    ].join("");
  }

  function renderProjectCounts(project) {
    const counts = project?.assignmentCounts || {};

    return `
      <div class="project-tracker-count-grid">
        <div class="project-tracker-count-card">
          <span>Assigned</span>
          <strong>${escapeHtml(String(normalizeCount(counts.assigned)))}</strong>
        </div>
        <div class="project-tracker-count-card">
          <span>Ongoing</span>
          <strong>${escapeHtml(String(normalizeCount(counts.ongoing)))}</strong>
        </div>
        <div class="project-tracker-count-card">
          <span>Completed</span>
          <strong>${escapeHtml(String(normalizeCount(counts.completed)))}</strong>
        </div>
      </div>
    `;
  }

  function renderDeliverableLink(url, label = "Open Link") {
    const value = String(url || "").trim();
    if (!value) return "";

    if (/^(https?:)?\/\//i.test(value) || value.startsWith("/")) {
      const href = toAbsoluteShareUrl(value);
      return `
        <a class="project-tracker-link" href="${escapeHtml(href)}" target="_blank" rel="noreferrer">
          ${escapeHtml(label)}
        </a>
      `;
    }

    return `<span>${escapeHtml(value)}</span>`;
  }

  function buildPhaseShareItems(phase) {
    const items = [];
    const deliverableUrl = toAbsoluteShareUrl(phase?.deliverable_link);

    if (deliverableUrl) {
      items.push({
        label: "Deliverable Link",
        url: deliverableUrl,
      });
    }

    normalizeAttachments(phase?.attachments).forEach((attachment) => {
      const attachmentUrl = toAbsoluteShareUrl(attachment?.url);
      if (!attachmentUrl) return;

      items.push({
        label: attachment?.name || "Attachment",
        url: attachmentUrl,
      });
    });

    return items;
  }

  function buildPhaseShareMessage(project, assignment, phase, items = []) {
    const serviceValue = assignment?.serviceType || assignment?.serviceLabel || "";
    const serviceLabel = getServiceLabel(serviceValue);
    const phaseLabel = getPhaseDisplayLabel(
      serviceValue,
      phase?.phase_key || phase?.phase_label,
      phase?.phase_label || "Phase update",
    );
    const lines = [
      "Project update",
      "",
      `Project: ${project?.projectName || "Untitled Project"}`,
      `Client: ${project?.client || "Client"}`,
      `Service: ${serviceLabel}`,
      `Phase: ${phaseLabel}`,
    ];

    if (project?.clientMapsLink) {
      lines.push(`Maps: ${project.clientMapsLink}`);
    }

    lines.push("", "Shared files / links:");
    items.forEach((item, index) => {
      lines.push(`${index + 1}. ${item.label}: ${item.url}`);
    });

    return lines.join("\n");
  }

  function renderPhaseShareActions(project, assignment, phase) {
    const items = buildPhaseShareItems(phase);
    if (!items.length) return "";

    const email = String(
      project?.clientEmail || assignment?.clientEmail || "",
    ).trim();
    const phone = normalizeWhatsappPhone(
      project?.clientContact ||
        project?.clientTelephone ||
        project?.clientAlternateContact ||
        assignment?.clientContact ||
        assignment?.clientTelephone ||
        assignment?.clientAlternateContact ||
        "",
    );
    const shareMessage = buildPhaseShareMessage(project, assignment, phase, items);
    const shareSubject = `${project?.projectName || "Project"} - ${getPhaseDisplayLabel(
      assignment?.serviceType || assignment?.serviceLabel || "",
      phase?.phase_key || phase?.phase_label,
      phase?.phase_label || "Phase update",
    )} update`;
    const actions = [];

    if (email) {
      actions.push(`
        <a
          class="project-tracker-share-btn email"
          href="${escapeHtml(`mailto:${email}?subject=${encodeURIComponent(shareSubject)}&body=${encodeURIComponent(shareMessage)}`)}"
        >
          Email Client
        </a>
      `);
    }

    if (phone) {
      actions.push(`
        <a
          class="project-tracker-share-btn whatsapp"
          href="${escapeHtml(`https://wa.me/${phone}?text=${encodeURIComponent(shareMessage)}`)}"
          target="_blank"
          rel="noreferrer"
        >
          WhatsApp Client
        </a>
      `);
    }

    return actions.length
      ? `<div class="project-tracker-share-actions">${actions.join("")}</div>`
      : "";
  }

  function renderPhaseDeliverables(project, assignment, phase) {
    const parts = [];
    const deliverableLink = renderDeliverableLink(phase?.deliverable_link);
    const attachments = normalizeAttachments(phase?.attachments);

    if (deliverableLink) {
      parts.push(`<div class="project-tracker-deliverable-item">${deliverableLink}</div>`);
    }

    attachments.forEach((attachment) => {
      parts.push(
        `<div class="project-tracker-deliverable-item">${renderDeliverableLink(
          attachment?.url,
          attachment?.name || "Attachment",
        )}</div>`,
      );
    });

    const deliverables = parts.length
      ? `<div class="project-tracker-deliverable-list">${parts.join("")}</div>`
      : "";
    const shareActions = renderPhaseShareActions(project, assignment, phase);

    return deliverables || shareActions
      ? `${deliverables}${shareActions}`
      : "-";
  }

  function renderPhaseTimeline(phase) {
    const startDate = phase?.start_date ? formatDate(phase.start_date) : "-";
    const dueDate = phase?.due_date ? formatDate(phase.due_date) : "-";

    return `
      <div class="project-tracker-phase-dates">
        <span><strong>Start:</strong> ${startDate}</span>
        <span><strong>Due:</strong> ${dueDate}</span>
      </div>
    `;
  }

  function renderPhaseMeta(phase) {
    const blocks = [];

    if (phase?.notes) {
      blocks.push(
        `<div class="project-tracker-note"><strong>Notes:</strong> ${escapeHtml(phase.notes)}</div>`,
      );
    }

    if (phase?.blockers) {
      blocks.push(
        `<div class="project-tracker-note"><strong>Blockers:</strong> ${escapeHtml(phase.blockers)}</div>`,
      );
    }

    if (!blocks.length) {
      return "-";
    }

    return `<div class="project-tracker-phase-meta">${blocks.join("")}</div>`;
  }

  function renderPhaseTable(assignment, project) {
    const rows = Array.isArray(assignment?.phases) ? assignment.phases : [];
    const serviceValue = assignment?.serviceType || assignment?.serviceLabel || "";

    if (!rows.length) {
      return `<div class="project-tracker-empty">No phase updates added yet.</div>`;
    }

    return `
      <div class="project-tracker-phase-table-wrap">
        <table class="project-tracker-phase-table">
          <thead>
            <tr>
              <th>Phase</th>
              <th>Status</th>
              <th>Progress</th>
              <th>Timeline</th>
              <th>Notes / Blockers</th>
              <th>Links / Files</th>
            </tr>
          </thead>
          <tbody>
            ${rows
              .map(
                (phase) => `
                  <tr>
                    <td>${escapeHtml(
                      getPhaseDisplayLabel(
                        serviceValue,
                        phase?.phase_key || phase?.phase_label,
                        phase?.phase_label || "-",
                      ),
                    )}</td>
                    <td>${renderBadge(phase?.status, getStatusLabel(phase?.status, "pending"))}</td>
                    <td class="project-tracker-phase-progress">${escapeHtml(String(formatProgress(phase?.progress)))}%</td>
                    <td>${renderPhaseTimeline(phase)}</td>
                    <td>${renderPhaseMeta(phase)}</td>
                    <td>${renderPhaseDeliverables(project, assignment, phase)}</td>
                  </tr>
                `,
              )
              .join("")}
          </tbody>
        </table>
      </div>
    `;
  }

  function renderAssignmentCard(assignment, project) {
    const status = normalizeStatus(assignment?.status, "assigned");
    const progress = formatProgress(assignment?.progress);
    const totalPhases = normalizeCount(assignment?.totalPhases);
    const completedPhases = normalizeCount(assignment?.completedPhases);
    const blockedCount = normalizeCount(assignment?.blockedCount);
    const serviceKey = normalizeServiceKey(
      assignment?.serviceType || assignment?.serviceLabel || "service",
    );
    const serviceLabel = getServiceLabel(
      assignment?.serviceLabel || assignment?.serviceType || "Service",
    );
    const currentStageLabel = getPhaseDisplayLabel(
      assignment?.serviceType || assignment?.serviceLabel || "",
      assignment?.stage || assignment?.stageLabel,
      assignment?.stageLabel || "Not started",
    );

    return `
      <article
        class="project-tracker-assignment"
        data-service-card
        data-service-key="${escapeHtml(serviceKey)}"
        tabindex="-1"
      >
        <div class="project-tracker-assignment-header">
          <div>
            <h4>${escapeHtml(serviceLabel)}</h4>
            <div class="project-tracker-assignment-meta">
              ${renderChip("fas fa-user-gear", "Assignee", assignment?.assigneeName || "Unassigned")}
              ${renderChip("fas fa-id-badge", "Role", formatRole(assignment?.assigneeRole))}
            </div>
          </div>
          <div class="project-tracker-badges">
            ${renderBadge(status)}
            ${blockedCount ? renderBadge("blocked", `${blockedCount} blocked`) : ""}
          </div>
        </div>

        <div class="project-tracker-overview">
          <div class="project-tracker-progress-line">
            <span>Service progress</span>
            <strong>${escapeHtml(String(progress))}%</strong>
          </div>
          <div class="project-tracker-progress-bar">
            <span style="width: ${progress}%;"></span>
          </div>
        </div>

        <div class="project-tracker-assignment-summary">
          <div>
            <span>Current stage</span>
            <strong>${escapeHtml(currentStageLabel)}</strong>
          </div>
          <div>
            <span>Completed phases</span>
            <strong>${escapeHtml(String(completedPhases))}/${escapeHtml(String(totalPhases || 0))}</strong>
          </div>
          <div>
            <span>Assigned on</span>
            <strong>${formatDate(assignment?.assigned_at, true)}</strong>
          </div>
          <div>
            <span>Last update</span>
            <strong>${formatDate(assignment?.lastUpdatedAt, true)}</strong>
          </div>
        </div>

        <details class="project-tracker-details">
          <summary>Phase-by-phase tracker</summary>
          ${renderPhaseTable(assignment, project)}
        </details>
      </article>
    `;
  }

  function compareProjects(a, b) {
    const order = {
      ongoing: 0,
      assigned: 1,
      completed: 2,
      unassigned: 3,
    };
    const aRank = order[normalizeStatus(a?.status, "assigned")] ?? 9;
    const bRank = order[normalizeStatus(b?.status, "assigned")] ?? 9;

    if (aRank !== bRank) return aRank - bRank;

    const aTime = new Date(a?.closed_date || 0).getTime();
    const bTime = new Date(b?.closed_date || 0).getTime();
    return bTime - aTime;
  }

  function renderProjectCard(project) {
    const assignments = Array.isArray(project?.assignments) ? project.assignments : [];
    const progress = formatProgress(project?.progress);
    const summaryStatus = normalizeStatus(project?.status, assignments.length ? "assigned" : "unassigned");

    return `
      <article class="project-tracker-card" data-project-card>
        <div class="project-tracker-card-header">
          <div>
            <h3>${escapeHtml(project?.projectName || "Untitled Project")}</h3>
            <p class="project-tracker-client">${escapeHtml(project?.client || "Client details unavailable")}</p>
          </div>
          <div class="project-tracker-badges">
            ${renderBadge(summaryStatus)}
            ${renderBadge("unassigned", `${assignments.length} assignment${assignments.length === 1 ? "" : "s"}`)}
          </div>
        </div>

        <div class="project-tracker-top-grid">
          <div class="project-tracker-panel">
            <div class="project-tracker-panel-title">Included services</div>
            <div class="project-tracker-service-list">
              ${renderServiceList(project?.services)}
            </div>
          </div>
          <div class="project-tracker-panel">
            <div class="project-tracker-panel-title">Lead ownership</div>
            <div class="project-tracker-meta-list">
              ${renderProjectMeta(project)}
            </div>
          </div>
        </div>

        <div class="project-tracker-overview">
          <div class="project-tracker-progress-line">
            <span>Overall project progress</span>
            <strong>${escapeHtml(String(progress))}%</strong>
          </div>
          <div class="project-tracker-progress-bar">
            <span style="width: ${progress}%;"></span>
          </div>
          ${renderProjectCounts(project)}
        </div>

        ${
          assignments.length
            ? `<div class="project-tracker-assignment-list">${assignments
                .map((assignment) => renderAssignmentCard(assignment, project))
                .join("")}</div>`
            : `<div class="project-tracker-unassigned">No service assignment is available for this project yet.</div>`
        }
      </article>
    `;
  }

  function renderProjects(containerId, payload) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const projects = Array.isArray(payload?.data) ? payload.data.slice() : [];

    if (!projects.length) {
      renderMessage(
        containerId,
        "No projects available",
        "Project assignment and phase details will appear here as soon as work is mapped.",
      );
      return;
    }

    container.innerHTML = projects.sort(compareProjects).map(renderProjectCard).join("");
  }

  function highlightServiceCard(card) {
    if (!card) return;

    if (activeServiceCard && activeServiceCard !== card) {
      activeServiceCard.classList.remove(ACTIVE_SERVICE_CARD_CLASS);
    }

    window.clearTimeout(activeServiceCardTimeoutId);
    card.classList.add(ACTIVE_SERVICE_CARD_CLASS);
    activeServiceCard = card;
    activeServiceCard.focus({ preventScroll: true });
    activeServiceCardTimeoutId = window.setTimeout(() => {
      card.classList.remove(ACTIVE_SERVICE_CARD_CLASS);
      if (activeServiceCard === card) {
        activeServiceCard = null;
      }
    }, 2200);
  }

  function scrollToServiceCard(serviceButton) {
    const serviceKey = normalizeServiceKey(serviceButton?.dataset?.projectService);
    const projectCard = serviceButton?.closest?.("[data-project-card]");
    if (!serviceKey || !projectCard) return;

    const serviceCards = Array.from(
      projectCard.querySelectorAll("[data-service-card][data-service-key]"),
    );
    const targetCard = serviceCards.find(
      (card) => normalizeServiceKey(card.dataset.serviceKey) === serviceKey,
    );

    if (!targetCard) {
      const unassignedBlock = projectCard.querySelector(".project-tracker-unassigned");
      if (unassignedBlock) {
        unassignedBlock.scrollIntoView({
          behavior: "smooth",
          block: "center",
          inline: "nearest",
        });
      }
      return;
    }

    const details = targetCard.querySelector(".project-tracker-details");
    if (details) {
      details.open = true;
    }

    targetCard.scrollIntoView({
      behavior: "smooth",
      block: "center",
      inline: "nearest",
    });
    highlightServiceCard(targetCard);
  }

  function handleProjectTrackerClick(event) {
    if (!(event.target instanceof Element)) return;

    const serviceButton = event.target.closest?.("[data-project-service]");
    if (!serviceButton) return;

    event.preventDefault();
    scrollToServiceCard(serviceButton);
  }

  function filterCards(containerId, searchInputId) {
    const container = document.getElementById(containerId);
    const input = document.getElementById(searchInputId);
    if (!container || !input) return;

    const query = String(input.value || "").toLowerCase().trim();
    const cards = container.querySelectorAll("[data-project-card]");

    cards.forEach((card) => {
      const text = card.textContent.toLowerCase();
      card.style.display = !query || text.includes(query) ? "" : "none";
    });
  }

  window.ProjectTrackerUI = {
    renderStats,
    renderMessage,
    renderProjects,
    filterCards,
  };

  document.addEventListener("click", handleProjectTrackerClick);
})();
