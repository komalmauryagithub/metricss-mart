const BASE_URL =
  window.location.protocol === "file:"
    ? "http://localhost:3000"
    : window.location.origin;
const LOCAL_PASSWORD_RESET_OTP_HINT_KEY = "mm_local_password_reset_otp_hint";

if (window.location.protocol === "file:") {
  const query = window.location.search || "";
  const hash = window.location.hash || "";
  window.location.replace(`${BASE_URL}/reset-password.html${query}${hash}`);
}

const resetParams = new URLSearchParams(window.location.search);
const resetToken =
  resetParams.get("token") ||
  (["local", "otp"].includes(resetParams.get("mode") || "") ? "__local__" : "");

function getLocalOtpHint() {
  return sessionStorage.getItem(LOCAL_PASSWORD_RESET_OTP_HINT_KEY) || "";
}

function clearLocalOtpHint() {
  sessionStorage.removeItem(LOCAL_PASSWORD_RESET_OTP_HINT_KEY);
}

function showPopup(title, message, isSuccess) {
  const popup = document.getElementById("popup");
  const icon = document.getElementById("popupIcon");
  const titleEl = document.getElementById("popupTitle");
  const msgEl = document.getElementById("popupMessage");

  if (!popup || !icon || !titleEl || !msgEl) return;

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
}

function closePopup() {
  const popup = document.getElementById("popup");
  if (popup) {
    popup.classList.add("hidden");
  }
}

function setBanner(message, tone) {
  const banner = document.getElementById("resetBanner");
  if (!banner) return;

  banner.className = `reset-status-banner ${tone || "info"}`;
  banner.textContent = message;
}

function setOtpHint(message = "") {
  const banner = document.getElementById("resetOtpHint");
  if (!banner) return;

  banner.textContent = message;
  banner.classList.toggle("hidden", !message);
}

function maskEmailAddress(email) {
  const normalized = String(email || "").trim();
  const [localPart, domain] = normalized.split("@");

  if (!localPart || !domain) {
    return normalized || "-";
  }

  const visibleLocal =
    localPart.length <= 2
      ? `${localPart[0] || ""}*`
      : `${localPart.slice(0, 2)}${"*".repeat(Math.max(localPart.length - 2, 1))}`;

  return `${visibleLocal}@${domain}`;
}

function setText(id, value) {
  const node = document.getElementById(id);
  if (node) {
    node.textContent = value;
  }
}

function setResetUiState({
  message,
  tone,
  showOtpForm,
  showPasswordForm,
  showIdentity,
  allowNewLink,
  introCopy,
}) {
  const otpForm = document.getElementById("verifyOtpForm");
  const passwordForm = document.getElementById("resetPasswordForm");
  const identityCard = document.getElementById("resetIdentityCard");
  const requestNewLinkBtn = document.getElementById("requestNewLinkBtn");

  setBanner(message, tone);

  if (otpForm) {
    otpForm.classList.toggle("hidden", !showOtpForm);
  }

  if (passwordForm) {
    passwordForm.classList.toggle("hidden", !showPasswordForm);
  }

  if (identityCard) {
    identityCard.classList.toggle("hidden", !showIdentity);
  }

  if (requestNewLinkBtn) {
    requestNewLinkBtn.classList.toggle("hidden", !allowNewLink);
  }

  if (introCopy) {
    setText("resetIntroCopy", introCopy);
  }
}

async function fetchResetTokenDetails() {
  const response = await fetch(
    `${BASE_URL}/api/auth/reset-password/${encodeURIComponent(resetToken)}`,
    { cache: "no-store" },
  );
  const data = await response.json().catch(() => ({}));

  if (!response.ok || data.success === false) {
    throw new Error(data.message || `Request failed (${response.status})`);
  }

  return data.data || {};
}

async function loadResetPage() {
  if (!resetToken) {
    setResetUiState({
      message: "This password reset link is missing or invalid. Please request a new link.",
      tone: "error",
      showOtpForm: false,
      showPasswordForm: false,
      showIdentity: false,
      allowNewLink: true,
      introCopy: "The reset link could not be verified.",
    });
    return;
  }

  try {
    const payload = await fetchResetTokenDetails();
    setText("resetUserEmail", maskEmailAddress(payload.email));
    setText("resetUserName", payload.name || "-");
    setText("resetExpiryText", payload.expiresOn || "-");
    setText("resetOtpExpiryText", payload.otpExpiresOn || "-");
    const localOtpHint = getLocalOtpHint();
    setOtpHint(
      localOtpHint
        ? `Local testing OTP: ${localOtpHint}. Use this on the screen below.`
        : "",
    );

    if (payload.otpVerified) {
      clearLocalOtpHint();
      setResetUiState({
        message: "OTP verified successfully. Enter your new password below.",
        tone: "success",
        showOtpForm: false,
        showPasswordForm: true,
        showIdentity: true,
        allowNewLink: false,
        introCopy: "Create a new password for your Metrics Mart account.",
      });
      return;
    }

    setResetUiState({
      message: "Enter the 6-digit OTP sent to your email to continue.",
      tone: "info",
      showOtpForm: true,
      showPasswordForm: false,
      showIdentity: true,
      allowNewLink: false,
      introCopy: "Verify the OTP from your email before setting a new password.",
    });
  } catch (error) {
    clearLocalOtpHint();
    setOtpHint("");
    setResetUiState({
      message: error.message || "This password reset link is invalid or expired.",
      tone: "error",
      showOtpForm: false,
      showPasswordForm: false,
      showIdentity: false,
      allowNewLink: true,
      introCopy: "This reset link can no longer be used.",
    });
  }
}

const verifyOtpForm = document.getElementById("verifyOtpForm");

if (verifyOtpForm) {
  verifyOtpForm.addEventListener("submit", async function (event) {
    event.preventDefault();

    const formData = new FormData(this);
    const payload = {
      otp: String(formData.get("otp") || "").replace(/\D/g, "").slice(0, 6),
    };
    const submitBtn = document.getElementById("verifyOtpBtn");
    const originalText = submitBtn?.innerHTML || "";

    if (payload.otp.length !== 6) {
      showPopup("Error", "Please enter the 6-digit OTP sent to your email.", false);
      return;
    }

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = "Verifying OTP...";
    }

    try {
      const response = await fetch(
        `${BASE_URL}/api/auth/reset-password/${encodeURIComponent(resetToken)}/verify-otp`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        },
      );
      const result = await response.json().catch(() => ({}));

      if (!response.ok || result.success === false) {
        throw new Error(result.message || `Request failed (${response.status})`);
      }

      clearLocalOtpHint();
      setOtpHint("");
      this.reset();
      setResetUiState({
        message: "OTP verified successfully. Enter your new password below.",
        tone: "success",
        showOtpForm: false,
        showPasswordForm: true,
        showIdentity: true,
        allowNewLink: false,
        introCopy: "Create a new password for your Metrics Mart account.",
      });
      showPopup("Success", result.message || "OTP verified successfully.", true);
    } catch (error) {
      showPopup("Error", error.message || "Unable to verify OTP.", false);
      if (
        String(error.message || "").toLowerCase().includes("expired") ||
        String(error.message || "").toLowerCase().includes("too many")
      ) {
        clearLocalOtpHint();
        setOtpHint("");
        setResetUiState({
          message: error.message,
          tone: "error",
          showOtpForm: false,
          showPasswordForm: false,
          showIdentity: false,
          allowNewLink: true,
          introCopy: "Please request a fresh OTP to continue.",
        });
      }
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalText;
      }
    }
  });
}

const resetPasswordForm = document.getElementById("resetPasswordForm");

if (resetPasswordForm) {
  resetPasswordForm.addEventListener("submit", async function (event) {
    event.preventDefault();

    const formData = new FormData(this);
    const payload = {
      newPassword: String(formData.get("newPassword") || ""),
      confirmPassword: String(formData.get("confirmPassword") || ""),
    };
    const submitBtn = document.getElementById("resetPasswordBtn");
    const originalText = submitBtn?.innerHTML || "";

    if (!payload.newPassword || !payload.confirmPassword) {
      showPopup("Error", "Please enter and confirm your new password.", false);
      return;
    }

    if (payload.newPassword !== payload.confirmPassword) {
      showPopup("Error", "Passwords do not match.", false);
      return;
    }

    if (payload.newPassword.length < 6) {
      showPopup("Error", "Password must be at least 6 characters long.", false);
      return;
    }

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = "Updating Password...";
    }

    try {
      const response = await fetch(
        `${BASE_URL}/api/auth/reset-password/${encodeURIComponent(resetToken)}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        },
      );
      const result = await response.json().catch(() => ({}));

      if (!response.ok || result.success === false) {
        throw new Error(result.message || `Request failed (${response.status})`);
      }

      this.reset();
      setResetUiState({
        message: "Password updated successfully. Redirecting you back to login...",
        tone: "success",
        showOtpForm: false,
        showPasswordForm: false,
        showIdentity: true,
        allowNewLink: false,
        introCopy: "Your password has been updated.",
      });
      clearLocalOtpHint();
      setOtpHint("");
      showPopup("Success", result.message || "Password updated successfully.", true);

      window.setTimeout(() => {
        window.location.href = "mp.html";
      }, 1800);
    } catch (error) {
      showPopup("Error", error.message || "Unable to update password.", false);
      if (String(error.message || "").toLowerCase().includes("expired")) {
        setResetUiState({
          message: error.message,
          tone: "error",
          showOtpForm: false,
          showPasswordForm: false,
          showIdentity: false,
          allowNewLink: true,
          introCopy: "This reset link can no longer be used.",
        });
      } else if (String(error.message || "").toLowerCase().includes("verify the otp")) {
        setResetUiState({
          message: error.message,
          tone: "error",
          showOtpForm: true,
          showPasswordForm: false,
          showIdentity: true,
          allowNewLink: false,
          introCopy: "Verify the OTP from your email before setting a new password.",
        });
      }
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalText;
      }
    }
  });
}

loadResetPage();
