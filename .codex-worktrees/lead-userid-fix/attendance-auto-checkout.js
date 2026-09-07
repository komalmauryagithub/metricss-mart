(function attendanceAutoCheckoutBootstrap() {
  const LOCAL_BACKEND_ORIGIN = "http://localhost:3000";
  const SESSION_STORAGE_KEY = "attendanceAutoCheckoutSessionId";
  const STORAGE_KEY_PREFIX = "attendanceAutoCheckoutSessions:";
  const HEARTBEAT_INTERVAL_MS = 30000;
  const STALE_SESSION_MS = 120000;

  let heartbeatTimer = 0;
  let unloadHandled = false;

  function getBaseUrl() {
    if (typeof BASE_URL !== "undefined" && typeof BASE_URL === "string" && BASE_URL.trim()) {
      return BASE_URL.trim().replace(/\/+$/, "");
    }

    if (window.location.protocol === "file:") {
      return LOCAL_BACKEND_ORIGIN;
    }

    if (["localhost", "127.0.0.1"].includes(window.location.hostname) && window.location.port !== "3000") {
      return LOCAL_BACKEND_ORIGIN;
    }

    return window.location.origin || LOCAL_BACKEND_ORIGIN;
  }

  function getStoredCurrentUser() {
    try {
      const rawUser = localStorage.getItem("currentUser");
      return rawUser ? JSON.parse(rawUser) : null;
    } catch (error) {
      return null;
    }
  }

  function getCurrentUserRecord() {
    if (typeof currentUser !== "undefined" && currentUser && currentUser.id) {
      return currentUser;
    }

    return getStoredCurrentUser();
  }

  function getCurrentUserId() {
    const userId = Number(getCurrentUserRecord()?.id);
    return Number.isFinite(userId) && userId > 0 ? userId : 0;
  }

  function createSessionId() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
      return window.crypto.randomUUID();
    }

    return `session-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
  }

  function ensureSessionId() {
    let sessionId = sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (!sessionId) {
      sessionId = createSessionId();
      sessionStorage.setItem(SESSION_STORAGE_KEY, sessionId);
    }

    return sessionId;
  }

  function getRegistryKey(userId) {
    return `${STORAGE_KEY_PREFIX}${userId}`;
  }

  function readSessions(userId) {
    if (!userId) return {};

    try {
      const rawSessions = localStorage.getItem(getRegistryKey(userId));
      const parsedSessions = rawSessions ? JSON.parse(rawSessions) : {};
      const now = Date.now();
      const filteredSessions = {};

      Object.entries(parsedSessions || {}).forEach(function keepFreshSession(entry) {
        const sessionId = entry[0];
        const timestamp = Number(entry[1]);

        if (sessionId && Number.isFinite(timestamp) && now - timestamp <= STALE_SESSION_MS) {
          filteredSessions[sessionId] = timestamp;
        }
      });

      return filteredSessions;
    } catch (error) {
      return {};
    }
  }

  function writeSessions(userId, sessions) {
    if (!userId) return;

    const sessionIds = Object.keys(sessions || {});
    if (!sessionIds.length) {
      localStorage.removeItem(getRegistryKey(userId));
      return;
    }

    localStorage.setItem(getRegistryKey(userId), JSON.stringify(sessions));
  }

  function touchSession() {
    const userId = getCurrentUserId();
    if (!userId) {
      return { userId: 0, sessionId: "", count: 0 };
    }

    const sessionId = ensureSessionId();
    const sessions = readSessions(userId);
    sessions[sessionId] = Date.now();
    writeSessions(userId, sessions);

    return {
      userId,
      sessionId,
      count: Object.keys(sessions).length,
    };
  }

  function removeSession() {
    const userId = getCurrentUserId();
    if (!userId) {
      return { userId: 0, sessionId: "", count: 0 };
    }

    const sessionId = ensureSessionId();
    const sessions = readSessions(userId);
    delete sessions[sessionId];
    writeSessions(userId, sessions);

    return {
      userId,
      sessionId,
      count: Object.keys(sessions).length,
    };
  }

  function sendJson(url, payload, keepalive) {
    return fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      keepalive: Boolean(keepalive),
      cache: "no-store",
    });
  }

  function sendBeaconJson(url, payload) {
    const body = JSON.stringify(payload);

    if (navigator.sendBeacon) {
      try {
        return navigator.sendBeacon(
          url,
          new Blob([body], { type: "application/json" }),
        );
      } catch (error) {
        // Fall back to keepalive fetch below.
      }
    }

    sendJson(url, payload, true).catch(function ignoreSendError() {});
    return false;
  }

  async function cancelPendingAutoCheckout() {
    const { userId, sessionId } = touchSession();
    if (!userId || !sessionId) return;

    try {
      await sendJson(`${getBaseUrl()}/api/attendance/auto-check-out/cancel`, {
        userId,
        sessionId,
      }, false);
    } catch (error) {
      // Keep the local session active even if the cancel ping fails.
    }
  }

  function scheduleAutoCheckout(reason) {
    if (unloadHandled) return;
    unloadHandled = true;

    const { userId, sessionId, count } = removeSession();
    if (!userId || !sessionId || count > 0) return;

    sendBeaconJson(`${getBaseUrl()}/api/attendance/auto-check-out/schedule`, {
      userId,
      sessionId,
      closedAt: new Date().toISOString(),
      reason: reason || "pagehide",
    });
  }

  async function finalizeOnLogout() {
    unloadHandled = true;

    const { userId, sessionId } = removeSession();
    if (!userId || !sessionId) {
      sessionStorage.removeItem(SESSION_STORAGE_KEY);
      return;
    }

    try {
      await sendJson(`${getBaseUrl()}/api/attendance/auto-check-out/finalize`, {
        userId,
        sessionId,
        closedAt: new Date().toISOString(),
        reason: "logout",
      }, true);
    } catch (error) {
      // Logout should continue even if checkout sync fails.
    } finally {
      sessionStorage.removeItem(SESSION_STORAGE_KEY);
    }
  }

  function startHeartbeat() {
    if (heartbeatTimer) return;

    touchSession();
    heartbeatTimer = window.setInterval(function refreshAttendanceSession() {
      touchSession();
    }, HEARTBEAT_INTERVAL_MS);
  }

  function handlePageActivated() {
    unloadHandled = false;
    touchSession();
    cancelPendingAutoCheckout();
    startHeartbeat();
  }

  function init() {
    handlePageActivated();

    window.addEventListener("pageshow", handlePageActivated);
    window.addEventListener("focus", handlePageActivated);
    window.addEventListener("pagehide", function handlePageHide() {
      scheduleAutoCheckout("pagehide");
    });
    window.addEventListener("beforeunload", function handleBeforeUnload() {
      scheduleAutoCheckout("beforeunload");
    });

    document.addEventListener("visibilitychange", function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        handlePageActivated();
      }
    });

    window.AttendanceAutoCheckout = {
      finalizeOnLogout,
    };
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
