(() => {
  const ADMIN_PROPOSAL_BASE_URL =
    window.location.protocol === "file:" ||
    ["localhost", "127.0.0.1"].includes(window.location.hostname)
      ? "http://localhost:3000"
      : window.location.origin || "https://metrics-mart-gf6l.onrender.com";
  const ADMIN_PROPOSAL_HEADER_URL = `${ADMIN_PROPOSAL_BASE_URL}/letterhead-header.jpeg`;
  const ADMIN_PROPOSAL_FOOTER_URL = `${ADMIN_PROPOSAL_BASE_URL}/letterhead-footer.jpeg`;
  const ADMIN_PROPOSAL_REDSEA_HEADER_URL = `${ADMIN_PROPOSAL_BASE_URL}/redsea-letterhead-header.jpeg`;
  const ADMIN_PROPOSAL_REDSEA_FOOTER_URL = `${ADMIN_PROPOSAL_BASE_URL}/redsea-letterhead-footer.jpeg`;
  const ADMIN_PROPOSAL_REQUEST_TIMEOUT_MS = 15000;

  let currentProposalId = null;
  let proposalSubmitting = false;
  let currentProposalMeta = {};
  const proposalSummaryCache = new Map();

  function getCurrentAdmin() {
    try {
      return JSON.parse(localStorage.getItem("currentUser") || "{}");
    } catch (_err) {
      return {};
    }
  }

  function notify(title, message, success) {
    if (typeof window.showPopup === "function") {
      window.showPopup(title, message, success);
      return;
    }

    alert(message || title);
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function formatDateTime(value) {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  async function fetchProposalRequest(url, options = {}, routeLabel = "Proposal API") {
    const controller = new AbortController();
    const timeout = window.setTimeout(
      () => controller.abort(),
      ADMIN_PROPOSAL_REQUEST_TIMEOUT_MS,
    );

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
            `${routeLabel} route is missing on the server (404). Redeploy or restart the live backend with latest server.js.`,
          );
        }

        throw new Error(
          `${routeLabel} returned an HTML/non-JSON response (${response.status || "unknown"}).`,
        );
      }
    }

    return data;
  }

  function setup() {
    const form = document.getElementById("adminProposalForm");
    if (!form || form.dataset.bound) return;

    form.addEventListener("submit", generate);
    form.dataset.bound = "true";
  }

  function getEditorText() {
    const editor = document.getElementById("adminProposalEditor");
    return String(editor?.innerText || "").trim();
  }

  function setEditorText(text) {
    const editor = document.getElementById("adminProposalEditor");
    if (editor) editor.innerText = text || "";
  }

  function setStatusText(text) {
    const status = document.getElementById("adminProposalEditorStatus");
    if (status) status.textContent = text;
  }

  function getCurrentCompanyScope() {
    const admin = getCurrentAdmin();
    return (
      normalizeProposalCompanyKey(
        admin.company_key ||
          admin.selected_company ||
          admin.company_scope ||
          admin.comp_name,
      ) || "metrics"
    );
  }

  function withCompanyScope(url) {
    const companyScope = getCurrentCompanyScope();
    if (!companyScope) return url;

    const separator = url.includes("?") ? "&" : "?";
    return `${url}${separator}company=${encodeURIComponent(companyScope)}&company_scope=${encodeURIComponent(companyScope)}`;
  }

  function getPayload() {
    const admin = getCurrentAdmin();
    const companyScope = getCurrentCompanyScope();

    return {
      client_name: document.getElementById("adminProposalClientName")?.value.trim() || "",
      client_email: document.getElementById("adminProposalClientEmail")?.value.trim() || "",
      company_name: document.getElementById("adminProposalCompanyName")?.value.trim() || "",
      project_topic: document.getElementById("adminProposalProjectTopic")?.value.trim() || "",
      requirement_details:
        document.getElementById("adminProposalRequirementDetails")?.value.trim() || "",
      budget: document.getElementById("adminProposalBudget")?.value.trim() || "",
      timeline: document.getElementById("adminProposalTimeline")?.value.trim() || "",
      technology:
        document.getElementById("adminProposalTechnology")?.value.trim() || "Core PHP + MySQL",
      notes: document.getElementById("adminProposalNotes")?.value.trim() || "",
      company_scope: companyScope,
      company_key: companyScope,
      comp_name: admin.comp_name || admin.selected_company || "",
      created_by: admin.id || null,
    };
  }

  function setFormValues(proposal = {}) {
    const fields = {
      adminProposalClientName: proposal.client_name || "",
      adminProposalClientEmail: proposal.client_email || "",
      adminProposalCompanyName: proposal.company_name || "",
      adminProposalProjectTopic: proposal.project_topic || "",
      adminProposalRequirementDetails: proposal.requirement_details || "",
      adminProposalBudget: proposal.budget || "",
      adminProposalTimeline: proposal.timeline || "",
      adminProposalTechnology: proposal.technology || "Core PHP + MySQL",
      adminProposalNotes: proposal.notes || "",
    };

    Object.entries(fields).forEach(([id, value]) => {
      const input = document.getElementById(id);
      if (input) input.value = value;
    });
  }

  function rememberSummary(proposal = {}) {
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
      created_by_name: proposal.created_by_name || "",
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

  function getActionMeta(proposalId = currentProposalId) {
    const id = Number(proposalId || 0);
    const cached = proposalSummaryCache.get(id) || {};

    if (id && Number(currentProposalId) === id) {
      return {
        ...cached,
        ...currentProposalMeta,
        ...getPayload(),
        id,
      };
    }

    return {
      ...cached,
      id,
    };
  }

  function openActionWindow(fallbackUrl = "") {
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

  function getFileBaseName(proposal = {}) {
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

  function downloadBlob(blob, fileName) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function downloadFromUrl(pdfUrl, fileName) {
    const link = document.createElement("a");
    link.href = pdfUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  async function getSnapshot(proposalId = currentProposalId, { saveCurrent = false } = {}) {
    const id = Number(proposalId || 0);
    if (!id) {
      throw new Error("Please generate or open a proposal first.");
    }

    if (Number(currentProposalId) === id) {
      if (saveCurrent) {
        await persist("draft", { silent: true });
      }

      return {
        ...getActionMeta(id),
        proposal_content: getEditorText(),
      };
    }

    const res = await fetchProposalRequest(
      withCompanyScope(`${ADMIN_PROPOSAL_BASE_URL}/api/proposals/${id}`),
      { cache: "no-store" },
      "Open proposal API",
    );
    const data = await parseProposalApiResponse(res, "Open proposal API");

    if (!res.ok || !data.success) {
      throw new Error(data.message || "Failed to open proposal");
    }

    rememberSummary(data.data || {});
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

  function setCanvasFont(ctx, style = {}) {
    const weight = style.weight || "400";
    const size = style.size || 26;
    ctx.font = `${weight} ${size}px Arial, sans-serif`;
  }

  function normalizeEditorContent(value) {
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
    const admin = getCurrentAdmin();
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
      admin.company_key,
      admin.selected_company,
      admin.company_scope,
      admin.comp_name,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ");

    return (
      normalizeProposalCompanyKey(
        proposal.company_scope ||
          proposal.created_by_company ||
          admin.company_key ||
          admin.selected_company ||
          admin.comp_name,
      ) === "redsea" ||
      /\bred\s*sea\b/.test(brandText) ||
      brandText.includes("redseadigitals")
    );
  }

  function getProposalLetterheadUrls(proposal = {}) {
    if (isRedSeaProposal(proposal)) {
      return {
        header: ADMIN_PROPOSAL_REDSEA_HEADER_URL,
        footer: ADMIN_PROPOSAL_REDSEA_FOOTER_URL,
        brandName: "RED SEA DIGITALS",
        accentColor: "#ef4444",
        headingColor: "#ff3045",
        footerText: "info@redseadigitals.com | +91 9310355211",
      };
    }

    return {
      header: ADMIN_PROPOSAL_HEADER_URL,
      footer: ADMIN_PROPOSAL_FOOTER_URL,
      brandName: "METRICS MART",
      accentColor: "#35b8ae",
      headingColor: "#0f766e",
      footerText: "info@metricsmart.in | www.metricsmartinfoline.com",
    };
  }

  function buildCanvasLines(ctx, proposal = {}, contentWidth) {
    const letterhead = getProposalLetterheadUrls(proposal);
    const lines = [];
    const pushWrapped = (text, style = {}) => {
      setCanvasFont(ctx, style);
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

    normalizeEditorContent(proposal.proposal_content)
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

  function loadLetterheadImage(src) {
    return new Promise((resolve) => {
      const image = new Image();
      image.crossOrigin = "anonymous";
      image.onload = () => resolve(image);
      image.onerror = () => resolve(null);
      image.src = `${src}?t=${Date.now()}`;
    });
  }

  function getScaledImageHeight(image, pageWidth, fallbackHeight) {
    if (!image?.naturalWidth || !image?.naturalHeight) return fallbackHeight;
    return Math.round(pageWidth * (image.naturalHeight / image.naturalWidth));
  }

  function drawFallbackHeader(ctx, pageWidth, height, margin, letterhead = {}) {
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

  function drawFallbackFooter(ctx, pageWidth, pageHeight, height, margin, letterhead = {}) {
    const footerTop = pageHeight - height;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, footerTop, pageWidth, height);
    ctx.fillStyle = letterhead.accentColor || "#35b8ae";
    ctx.fillRect(0, footerTop + height - 76, pageWidth, 76);
    ctx.fillStyle = "#0f172a";
    ctx.font = "400 20px Arial, sans-serif";
    ctx.fillText(letterhead.footerText || "info@metricsmart.in | www.metricsmartinfoline.com", margin, footerTop + height - 38);
  }

  function getCanvasLineHeight(line) {
    if (line.spacer) return line.height;
    return Math.round((line.size || 22) * 1.42) + (line.gapAfter || 0);
  }

  function paginateCanvasLines(lines, contentTop, contentBottom) {
    const pages = [[]];
    let y = contentTop;

    lines.forEach((line) => {
      const lineHeight = getCanvasLineHeight(line);
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

  async function createPngBlob(proposal = {}) {
    const pageWidth = 1240;
    const pageHeight = 1754;
    const margin = 86;
    const letterheadUrls = getProposalLetterheadUrls(proposal);
    const [headerImage, footerImage] = await Promise.all([
      loadLetterheadImage(letterheadUrls.header),
      loadLetterheadImage(letterheadUrls.footer),
    ]);
    const headerHeight = getScaledImageHeight(headerImage, pageWidth, 325);
    const footerHeight = getScaledImageHeight(footerImage, pageWidth, 329);
    const contentWidth = pageWidth - margin * 2;
    const contentTop = headerHeight + 46;
    const contentBottomGap = 58;
    const contentBottom = pageHeight - footerHeight - contentBottomGap;
    const measureCanvas = document.createElement("canvas");
    const measureCtx = measureCanvas.getContext("2d");
    const lines = buildCanvasLines(measureCtx, proposal, contentWidth);
    const pages = paginateCanvasLines(lines, contentTop, contentBottom);
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
        drawFallbackHeader(ctx, canvas.width, headerHeight, margin, letterheadUrls);
        ctx.restore();
      }

      let y = pageTop + contentTop;
      pageLines.forEach((line) => {
        if (line.spacer) {
          y += line.height;
          return;
        }

        setCanvasFont(ctx, line);
        ctx.fillStyle = line.color || "#111827";
        ctx.textBaseline = "top";
        const x =
          line.align === "center"
            ? margin + (contentWidth - ctx.measureText(line.text).width) / 2
            : margin;
        ctx.fillText(line.text, x, y);
        y += getCanvasLineHeight(line);
      });

      if (footerImage) {
        ctx.drawImage(footerImage, 0, pageTop + pageHeight - footerHeight, canvas.width, footerHeight);
      } else {
        ctx.save();
        ctx.translate(0, pageTop);
        drawFallbackFooter(ctx, canvas.width, pageHeight, footerHeight, margin, letterheadUrls);
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

  async function fetchPdfBlob(proposalId) {
    const res = await fetchProposalRequest(
      withCompanyScope(`${ADMIN_PROPOSAL_BASE_URL}/api/proposals/${proposalId}/pdf?t=${Date.now()}`),
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

  function getPdfShareUrl(proposalId) {
    return withCompanyScope(`${ADMIN_PROPOSAL_BASE_URL}/api/proposals/${proposalId}/pdf`);
  }

  function getEmailDetails(proposal = {}) {
    const company = proposal.company_name || proposal.client_name || "client";
    const topic = proposal.project_topic || "Project Proposal";
    return {
      subject: `Project Proposal - ${company}`,
      body: `Hi,\n\nPlease find the attached ${topic} proposal PDF for ${company}.\n\nRegards,\nMetrics Mart`,
    };
  }

  function openEmailDraftWindow(popup, email, proposal = {}) {
    const details = getEmailDetails(proposal);
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

  async function persist(status = "draft", { silent = false } = {}) {
    if (!currentProposalId) {
      throw new Error("Please generate or open a proposal first.");
    }

    const proposalContent = getEditorText();
    if (!proposalContent) {
      throw new Error("Proposal content is required.");
    }

    const res = await fetchProposalRequest(
      withCompanyScope(`${ADMIN_PROPOSAL_BASE_URL}/api/proposals/${currentProposalId}`),
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...getPayload(),
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
      ...getPayload(),
      id: Number(currentProposalId),
      status,
    };
    rememberSummary(currentProposalMeta);

    if (!silent) {
      setStatusText(`Proposal #${currentProposalId} saved as ${status}.`);
      notify("Saved", "Proposal saved successfully.", true);
      load();
    }

    return data;
  }

  async function generate(event) {
    event?.preventDefault();
    if (proposalSubmitting) return;

    const payload = getPayload();
    if (!payload.client_name || !payload.company_name || !payload.project_topic) {
      notify("Missing Details", "Client name, company name, and project topic are required.", false);
      return;
    }

    const btn = document.getElementById("adminGenerateProposalBtn");
    proposalSubmitting = true;
    if (btn) btn.disabled = true;
    setStatusText("Generating proposal...");

    try {
      const res = await fetchProposalRequest(
        `${ADMIN_PROPOSAL_BASE_URL}/api/generate-proposal`,
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
      rememberSummary(currentProposalMeta);
      setEditorText(data.proposal_content || "");
      setStatusText(`Draft proposal #${currentProposalId} generated. You can edit it now.`);
      notify("Proposal Ready", "Proposal generated successfully.", true);
      load();
    } catch (err) {
      console.error("Generate Proposal Error:", err);
      setStatusText("Proposal generation failed.");
      notify("Error", err.message || "Failed to generate proposal", false);
    } finally {
      proposalSubmitting = false;
      if (btn) btn.disabled = false;
    }
  }

  async function save(status = "draft") {
    try {
      await persist(status);
    } catch (err) {
      console.error("Save Proposal Error:", err);
      notify("Error", err.message || "Failed to save proposal", false);
    }
  }

  async function load() {
    const container = document.getElementById("adminProposalListContainer");
    if (!container) return;

    container.innerHTML = `<p class="no-data">Loading proposals...</p>`;

    try {
      const res = await fetchProposalRequest(
        withCompanyScope(`${ADMIN_PROPOSAL_BASE_URL}/api/proposals`),
        { cache: "no-store" },
        "Load proposals API",
      );
      const data = await parseProposalApiResponse(res, "Load proposals API");

      if (!res.ok || !data.success) {
        throw new Error(data.message || "Failed to load proposals");
      }

      const proposals = Array.isArray(data.data) ? data.data : [];
      proposalSummaryCache.clear();
      proposals.forEach(rememberSummary);

      const count = document.getElementById("adminProposalListCount");
      if (count) count.textContent = `${proposals.length} proposals`;

      if (!proposals.length) {
        container.innerHTML = `<p class="no-data">No proposals created yet</p>`;
        return;
      }

      const rows = proposals
        .map((item) => {
          const proposalId = Number(item.id || item.proposal_id || 0);
          const hasProposalId = Number.isFinite(proposalId) && proposalId > 0;
          const status = String(item.status || "draft").toLowerCase();
          const statusClass = status.replace(/[^a-z0-9_-]+/g, "-");
          const disabledAttr = hasProposalId ? "" : "disabled";
          const disabledTitle = hasProposalId ? "" : "Proposal id missing";

          return `
            <tr>
              <td>${escapeHtml(item.company_name || "-")}</td>
              <td>${escapeHtml(item.client_name || "-")}</td>
              <td>${escapeHtml(item.project_topic || "-")}</td>
              <td>${escapeHtml(item.created_by_name || "-")}</td>
              <td><span class="status ${escapeHtml(statusClass)}">${escapeHtml(status)}</span></td>
              <td>${escapeHtml(formatDateTime(item.created_at))}</td>
              <td>
                <div class="admin-proposal-table-actions">
                  <button type="button" class="tab-btn active" ${disabledAttr} onclick="${hasProposalId ? `AdminProposals.open(${proposalId})` : ""}" title="${disabledTitle || "Open proposal"}"><i class="fas fa-pen"></i></button>
                  <button type="button" class="btn btn-proposal-png" ${disabledAttr} onclick="${hasProposalId ? `AdminProposals.download('png', ${proposalId})` : ""}" title="${disabledTitle || "Download PNG"}"><i class="fas fa-file-image"></i></button>
                  <button type="button" class="btn btn-proposal-pdf" ${disabledAttr} onclick="${hasProposalId ? `AdminProposals.download('pdf', ${proposalId})` : ""}" title="${disabledTitle || "Download PDF"}"><i class="fas fa-file-pdf"></i></button>
                  <button type="button" class="btn btn-whatsapp" ${disabledAttr} onclick="${hasProposalId ? `AdminProposals.shareWhatsApp(${proposalId})` : ""}" title="${disabledTitle || "Share WhatsApp"}"><i class="fab fa-whatsapp"></i></button>
                  <button type="button" class="btn btn-gmail" ${disabledAttr} onclick="${hasProposalId ? `AdminProposals.sendEmail(${proposalId})` : ""}" title="${disabledTitle || "Email PDF"}"><i class="fas fa-envelope"></i></button>
                </div>
              </td>
            </tr>
          `;
        })
        .join("");

      container.innerHTML = `
        <div class="table-wrapper">
          <table class="data-table">
            <thead>
              <tr>
                <th>Company</th>
                <th>Client</th>
                <th>Topic</th>
                <th>Created By</th>
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

  async function open(proposalId) {
    const id = Number(proposalId || 0);
    if (!Number.isFinite(id) || id <= 0) {
      notify("Error", "Proposal id missing. Please refresh proposals list.", false);
      return;
    }

    try {
      const res = await fetchProposalRequest(
        withCompanyScope(`${ADMIN_PROPOSAL_BASE_URL}/api/proposals/${id}`),
        { cache: "no-store" },
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
      rememberSummary(currentProposalMeta);
      setFormValues(proposal);
      setEditorText(proposal.proposal_content || "");
      setStatusText(`Editing proposal #${proposal.id} for ${proposal.company_name || "client"}.`);
    } catch (err) {
      console.error("Open Proposal Error:", err);
      notify("Error", err.message || "Failed to open proposal", false);
    }
  }

  async function download(type, proposalId = currentProposalId) {
    if (!proposalId) {
      notify("No Proposal", "Please generate or open a proposal first.", false);
      return;
    }

    const normalizedType = String(type || "").toLowerCase();
    if (!["pdf", "word", "png"].includes(normalizedType)) {
      notify("Error", "Invalid proposal download type.", false);
      return;
    }

    if (normalizedType === "png") {
      try {
        setStatusText("Preparing proposal PNG...");
        const proposal = await getSnapshot(proposalId);
        const blob = await createPngBlob(proposal);
        downloadBlob(blob, `${getFileBaseName(proposal)}.png`);
        setStatusText(`Proposal #${proposalId} PNG is ready.`);
        notify("Downloaded", "Proposal PNG downloaded successfully.", true);
      } catch (err) {
        console.error("Download Proposal PNG Error:", err);
        notify("Download Error", err.message || "Failed to download proposal PNG", false);
      }
      return;
    }

  const downloadUrl = withCompanyScope(`${ADMIN_PROPOSAL_BASE_URL}/api/proposals/${proposalId}/${normalizedType}?t=${Date.now()}`);
    const popup = openActionWindow(downloadUrl);

    try {
      if (Number(proposalId) === Number(currentProposalId)) {
        await persist("draft", { silent: true });
      }

      if (popup) {
        popup.location.href = downloadUrl;
      } else {
        window.location.href = downloadUrl;
      }
    } catch (err) {
      if (popup) popup.close();
      console.error("Download Proposal Error:", err);
      notify("Download Error", err.message || "Failed to download proposal", false);
    }
  }

  async function shareWhatsApp(proposalId = currentProposalId) {
    if (!proposalId) {
      notify("No Proposal", "Please generate or open a proposal first.", false);
      return;
    }

    const popup = null;
    let pdfBlob = null;
    let fileName = "";

    try {
      if (Number(proposalId) === Number(currentProposalId)) {
        await persist("draft", { silent: true });
      }

      const proposal = await getSnapshot(proposalId);
      const topic = proposal.project_topic || "Project Proposal";
      const company = proposal.company_name || "your company";
      const message = `Project Proposal - ${company}`;
      setStatusText("Preparing proposal PDF for WhatsApp...");
      pdfBlob = await fetchPdfBlob(proposalId);
      fileName = `${getFileBaseName(proposal)}.pdf`;
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
          setStatusText(`Proposal #${proposalId} PDF is ready for WhatsApp.`);
          notify("Shared", "Proposal PDF shared successfully.", true);
          return;
        } catch (shareErr) {
          if (shareErr?.name === "AbortError") {
            return;
          }
          console.warn("Native proposal PDF share failed, downloading PDF for manual WhatsApp attach.", shareErr);
        }
      }

      downloadBlob(pdfBlob, fileName);
      setStatusText(`Proposal #${proposalId} PDF downloaded for WhatsApp.`);
      notify("PDF Ready", "PDF download ho gaya. WhatsApp me file attach karke send karo.", true);
    } catch (err) {
      if (err?.name === "AbortError") return;
      if (pdfBlob && fileName) {
        downloadBlob(pdfBlob, fileName);
      }
      console.error("Proposal WhatsApp Error:", err);
      notify("WhatsApp Error", err.message || "Failed to share proposal", false);
    }
  }

  async function sendEmail(proposalId = currentProposalId) {
    if (!proposalId) {
      notify("No Proposal", "Please generate or open a proposal first.", false);
      return;
    }

    setStatusText("Preparing proposal PDF email...");

    try {
      if (Number(proposalId) === Number(currentProposalId)) {
        await persist("draft", { silent: true });
      }

      const proposal = await getSnapshot(proposalId);
      const autoEmail = String(proposal.client_email || "").trim();
      const toEmail = autoEmail || prompt("Client email address");
      if (!toEmail) return;

      const cleanedEmail = toEmail.trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanedEmail)) {
        notify("Invalid Email", "Please enter a valid client email address.", false);
        return;
      }

      downloadFromUrl(`${getPdfShareUrl(proposalId)}?t=${Date.now()}`, `${getFileBaseName(proposal)}.pdf`);
      window.setTimeout(() => {
        openEmailDraftWindow(null, cleanedEmail, proposal);
      }, 800);
      setStatusText(`Proposal #${proposalId} PDF downloaded for email.`);
      notify("Email Draft", "PDF download ho gaya aur Gmail open ho raha hai. PDF drag-drop karke send karo.", true);
    } catch (err) {
      console.error("Proposal Email Error:", err);
      notify("Email Error", err.message || "Failed to open proposal email draft", false);
    }
  }

  function reset() {
    const form = document.getElementById("adminProposalForm");
    form?.reset();
    const technology = document.getElementById("adminProposalTechnology");
    if (technology) technology.value = "Core PHP + MySQL";
    currentProposalId = null;
    currentProposalMeta = {};
    setEditorText("");
    setStatusText("Generate a proposal to start editing.");
  }

  window.AdminProposals = {
    setup,
    load,
    open,
    download,
    save,
    shareWhatsApp,
    sendEmail,
    reset,
  };
})();
