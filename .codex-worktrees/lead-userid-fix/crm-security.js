(function () {
  "use strict";

  const SHIELD_MESSAGE = "Screen protected";
  const SHORTCUT_SHIELD_DURATION_MS = 2400;
  const SCREENSHOT_SHIELD_DURATION_MS = 6000;
  const SHIFT_SCREENSHOT_DELAY_MS = 120;
  const WATERMARK_COUNT = 36;
  let pendingShiftShieldTimer = null;

  function getCurrentUser() {
    try {
      return JSON.parse(localStorage.getItem("currentUser") || "null") || {};
    } catch (error) {
      return {};
    }
  }

  function getCompanyKey(user = getCurrentUser()) {
    const normalized = String(
      user.company_key || user.selected_company || user.comp_name || "",
    )
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "");

    if (
      normalized === "redsea" ||
      normalized === "redseadigitals" ||
      normalized === "redseadigitalspvtltd"
    ) {
      return "redsea";
    }

    return "metrics";
  }

  function applyCompanyTheme() {
    const user = getCurrentUser();
    const isRedSea = getCompanyKey(user) === "redsea";

    document.body.classList.toggle("redsea-company", isRedSea);
    document.documentElement.classList.toggle("redsea-company", isRedSea);

    if (isRedSea) {
      document.title = document.title.replace(/^Metrics/i, "Red Sea Digitals");
      document.querySelectorAll(".brand-panel").forEach((element) => {
        const roleLabel = String(user.role || element.textContent || "")
          .toUpperCase()
          .trim();
        element.textContent = roleLabel
          ? `RED SEA DIGITALS ${roleLabel}`
          : "RED SEA DIGITALS";
      });
    }
  }

  function patchCompanyScopedFetch() {
    if (window.fetch?.__companyScopePatched) return;

    const originalFetch = window.fetch.bind(window);

    window.fetch = function companyScopedFetch(input, init = {}) {
      const user = getCurrentUser();
      const companyKey = getCompanyKey(user);
      const method = String(init?.method || "GET").toUpperCase();

      if (!companyKey || !["GET", "HEAD"].includes(method)) {
        return originalFetch(input, init);
      }

      const rawUrl = typeof input === "string" || input instanceof URL ? String(input) : "";
      if (!rawUrl) {
        return originalFetch(input, init);
      }

      const url = new URL(rawUrl, window.location.origin);
      const isSameOrigin = url.origin === window.location.origin;
      const shouldScope =
        isSameOrigin &&
        (url.pathname.startsWith("/api/") || url.pathname === "/test-users");

      if (!shouldScope || url.searchParams.has("companyScope")) {
        return originalFetch(input, init);
      }

      url.searchParams.set("companyScope", companyKey);
      const nextInput = rawUrl.startsWith("http")
        ? url.toString()
        : `${url.pathname}${url.search}${url.hash}`;

      return originalFetch(nextInput, init);
    };

    window.fetch.__companyScopePatched = true;
  }

  function scrollPanelToTop() {
    const scrollTargets = [
      document.querySelector(".main-content"),
      document.querySelector(".section.active"),
      document.querySelector(".hr-section.active"),
    ].filter(Boolean);

    scrollTargets.forEach((target) => {
      if (typeof target.scrollTo === "function") {
        target.scrollTo({ top: 0, left: 0, behavior: "auto" });
      } else {
        target.scrollTop = 0;
        target.scrollLeft = 0;
      }
    });

    if (typeof window.scrollTo === "function") {
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    }
  }

  function queueSectionScrollReset() {
    const nextFrame =
      window.requestAnimationFrame || ((callback) => window.setTimeout(callback, 0));

    nextFrame(() => {
      nextFrame(scrollPanelToTop);
    });
  }

  function patchSectionNavigation() {
    ["showSection", "openAdminSection"].forEach((name) => {
      const original = window[name];

      if (typeof original !== "function" || original.__crmScrollTopPatched) {
        return;
      }

      const wrapped = function crmScrollTopWrappedSectionNav(...args) {
        const result = original.apply(this, args);
        queueSectionScrollReset();
        return result;
      };

      wrapped.__crmScrollTopPatched = true;
      wrapped.__original = original;
      window[name] = wrapped;
    });

    if (document.__crmSectionScrollClickPatched) return;

    document.addEventListener(
      "click",
      (event) => {
        const target = event.target instanceof Element ? event.target : null;
        const sectionTrigger = target?.closest(
          ".sidebar li, [data-dashboard-section], [data-dashboard-target], .dashboard-link-card",
        );

        if (sectionTrigger) {
          queueSectionScrollReset();
        }
      },
      true,
    );

    document.__crmSectionScrollClickPatched = true;
  }

  function formatStampDate(date) {
    return date.toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function getWatermarkText() {
    const user = getCurrentUser();
    const identity = [user.name, user.email || user.contact, user.role]
      .filter(Boolean)
      .join(" | ");

    return `${identity || "Metrics Mart CRM"}\n${formatStampDate(new Date())}`;
  }

  function ensureShield() {
    let shield = document.querySelector(".crm-security-shield");
    if (!shield) {
      shield = document.createElement("div");
      shield.className = "crm-security-shield";
      shield.setAttribute("aria-live", "polite");
      shield.textContent = SHIELD_MESSAGE;
      document.body.appendChild(shield);
    }
    return shield;
  }

  function canHideShield() {
    return !document.hidden && (!document.hasFocus || document.hasFocus());
  }

  function clearPendingShiftShield() {
    window.clearTimeout(pendingShiftShieldTimer);
    pendingShiftShieldTimer = null;
  }

  function armShiftScreenshotShield() {
    clearPendingShiftShield();
    pendingShiftShieldTimer = window.setTimeout(() => {
      pendingShiftShieldTimer = null;
      showShield(SCREENSHOT_SHIELD_DURATION_MS);
    }, SHIFT_SCREENSHOT_DELAY_MS);
  }

  function showShield(duration = 1600) {
    const shield = ensureShield();
    document.documentElement.classList.add("crm-blackout");
    shield.classList.add("is-visible");

    window.clearTimeout(showShield.hideTimer);
    showShield.hideTimer = window.setTimeout(() => {
      if (canHideShield()) {
        document.documentElement.classList.remove("crm-blackout");
        shield.classList.remove("is-visible");
      }
    }, duration);
  }

  function hideShield() {
    if (!canHideShield()) return;

    const shield = ensureShield();
    document.documentElement.classList.remove("crm-blackout");
    shield.classList.remove("is-visible");
  }

  function isShiftTypingInput(event, hasWindowsModifier) {
    const key = String(event.key || "");
    return (
      event.type === "keydown" &&
      event.shiftKey &&
      !event.ctrlKey &&
      !event.altKey &&
      !event.metaKey &&
      !hasWindowsModifier &&
      key.length === 1
    );
  }

  function buildWatermark() {
    document.querySelectorAll(".crm-watermark-layer").forEach((layer) => {
      layer.remove();
    });
  }

  function updateWatermark() {
    const text = getWatermarkText();
    document.querySelectorAll(".crm-watermark-item").forEach((item) => {
      item.textContent = text;
    });
  }

  function blockPrint(event) {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    showShield(2400);
    return false;
  }

  function handleKeydown(event) {
    const key = String(event.key || "").toLowerCase();
    const isPrint = event.ctrlKey && key === "p";
    const isSave = event.ctrlKey && key === "s";
    const isViewSource = event.ctrlKey && key === "u";
    const hasWindowsModifier =
      event.metaKey ||
      event.getModifierState?.("Meta") ||
      event.getModifierState?.("OS");
    const isWindowsSnip = hasWindowsModifier && event.shiftKey && key === "s";
    const isDevtools =
      event.key === "F12" ||
      (event.ctrlKey && event.shiftKey && ["i", "j", "c"].includes(key));
    const isPrintScreen = event.key === "PrintScreen";
    const isScreenshotShortcut = isPrintScreen || isWindowsSnip;

    if (event.type === "keyup" && event.key === "Shift") {
      clearPendingShiftShield();
      return;
    }

    if (isShiftTypingInput(event, hasWindowsModifier)) {
      clearPendingShiftShield();
      hideShield();
      return;
    }

    if (event.type === "keydown" && event.key === "Shift") {
      armShiftScreenshotShield();
      return;
    }

    if (
      isPrint ||
      isSave ||
      isViewSource ||
      isDevtools ||
      isScreenshotShortcut
    ) {
      event.preventDefault();
      clearPendingShiftShield();
      showShield(
        isScreenshotShortcut
          ? SCREENSHOT_SHIELD_DURATION_MS
          : SHORTCUT_SHIELD_DURATION_MS,
      );

      if (isPrintScreen && navigator.clipboard?.writeText) {
        navigator.clipboard.writeText("").catch(() => {});
      }
    }
  }

  function handleVisibilityChange() {
    if (document.hidden) {
      clearPendingShiftShield();
    }
    document.documentElement.classList.toggle("crm-screen-hidden", document.hidden);
  }

  function handleWindowBlur() {
    clearPendingShiftShield();
    showShield(SCREENSHOT_SHIELD_DURATION_MS);
  }

  function handleWindowFocus() {
    clearPendingShiftShield();
    window.clearTimeout(handleWindowFocus.timer);
    handleWindowFocus.timer = window.setTimeout(hideShield, 1200);
  }

  function initCrmSecurity() {
    patchCompanyScopedFetch();
    patchSectionNavigation();
    applyCompanyTheme();
    ensureShield();
    buildWatermark();

    document.addEventListener("keydown", handleKeydown, true);
    document.addEventListener("keyup", handleKeydown, true);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    document.addEventListener("contextmenu", (event) => event.preventDefault());
    window.addEventListener("blur", handleWindowBlur);
    window.addEventListener("focus", handleWindowFocus);
    window.addEventListener("beforeprint", blockPrint);
  }

  if (document.readyState === "loading") {
    patchCompanyScopedFetch();
    document.addEventListener("DOMContentLoaded", initCrmSecurity);
  } else {
    initCrmSecurity();
  }
})();
