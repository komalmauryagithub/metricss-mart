const PROFILE_FORM_MAX_FILE_SIZE = 15 * 1024 * 1024;
const PROFILE_FORM_ALLOWED_EXTENSIONS = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".gif",
  ".webp",
  ".heic",
  ".heif",
  ".pdf",
  ".doc",
  ".docx",
]);
const PROFILE_BASE_URL =
  window.location.protocol === "file:" ||
  ["localhost", "127.0.0.1"].includes(window.location.hostname)
    ? "http://localhost:3000"
    : window.location.origin || "https://metrics-mart-gf6l.onrender.com";
const profileSearchParams = new URLSearchParams(window.location.search);
function normalizeProfileToken(value) {
  const tokenMatch = String(value || "").match(/[a-f0-9]{64}/i);
  return tokenMatch ? tokenMatch[0] : "";
}
const profileToken = normalizeProfileToken(profileSearchParams.get("token"));
const profileUserId = String(profileSearchParams.get("uid") || "").replace(/\D/g, "");
const profileForm = document.getElementById("completeProfileForm");
const pfEnabledField = document.getElementById("pf_enabled");
const pfDetails = document.getElementById("pfDetails");
const submitBtn = document.getElementById("submitBtn");
const formMessage = document.getElementById("formMessage");
const statusBanner = document.getElementById("statusBanner");
const statusBadge = document.getElementById("statusBadge");
const attendanceFaceImageInput = document.getElementById("attendance_face_image");
const attendanceFaceSignatureInput = document.getElementById("attendance_face_signature");
const attendanceFaceCaptureBtn = document.getElementById("captureAttendanceFaceBtn");
const attendanceFaceStatus = document.getElementById("attendanceFaceEnrollmentStatus");
const policyAcceptanceInput = document.getElementById("policy_acceptance");
let attendanceFaceAlreadyEnrolled = false;

if (window.location.protocol === "file:") {
  const nextParams = new URLSearchParams();
  if (profileToken) nextParams.set("token", profileToken);
  if (profileUserId) nextParams.set("uid", profileUserId);
  const nextUrl = `${PROFILE_BASE_URL}/complete-profile.html${nextParams.toString() ? `?${nextParams.toString()}` : ""}`;
  window.location.replace(nextUrl);
}

function setStatusBadge(status) {
  const normalized = String(status || "pending").toLowerCase();
  const labelMap = {
    pending: "Link Active",
    completed: "Completed",
    expired: "Expired",
    invalid: "Invalid Link",
    not_sent: "Pending",
  };

  statusBadge.textContent = labelMap[normalized] || "Pending";
}

function setBanner(message, type = "error") {
  if (!message) {
    statusBanner.textContent = "";
    statusBanner.className = "status-banner hidden";
    return;
  }

  statusBanner.textContent = message;
  statusBanner.className = `status-banner ${type}`;
}

function setFormMessage(message, type = "error") {
  if (!message) {
    formMessage.textContent = "";
    formMessage.className = "form-message hidden";
    return;
  }

  formMessage.textContent = message;
  formMessage.className = `form-message ${type}`;
}

function setSubmittingState(isSubmitting) {
  submitBtn.disabled = isSubmitting;
  submitBtn.textContent = isSubmitting ? "Submitting..." : "Submit Details";
}

function setSummaryValue(id, value) {
  const element = document.getElementById(id);
  if (element) {
    element.textContent = String(value || "-");
  }
}

function setFieldValue(fieldName, value = "") {
  if (!profileForm?.elements?.[fieldName]) return;
  profileForm.elements[fieldName].value = value ?? "";
}

function setFieldHint(id, text = "") {
  const element = document.getElementById(id);
  if (element) {
    element.textContent = text;
  }
}

function setAttendanceFaceStatus(message, type = "neutral") {
  if (!attendanceFaceStatus) return;
  attendanceFaceStatus.textContent = message || "";
  attendanceFaceStatus.dataset.type = type;
}

function hasCapturedAttendanceFace() {
  return Boolean(
    String(attendanceFaceImageInput?.value || "").trim() &&
      String(attendanceFaceSignatureInput?.value || "").trim(),
  );
}

async function captureAttendanceFaceEnrollment() {
  if (!window.AttendanceFace?.captureEnrollment) {
    setAttendanceFaceStatus("Camera module is not loaded.", "error");
    return;
  }

  try {
    attendanceFaceCaptureBtn.disabled = true;
    setAttendanceFaceStatus("Opening camera...", "neutral");
    const payload = await window.AttendanceFace.captureEnrollment({
      title: "Private Attendance Face Setup",
      actionLabel: "Save Face",
    });

    if (!payload?.faceImage || !payload?.faceSignature) {
      throw new Error("Face capture failed. Please retry.");
    }

    attendanceFaceImageInput.value = payload.faceImage;
    attendanceFaceSignatureInput.value = JSON.stringify(payload.faceSignature);
    setAttendanceFaceStatus("Live face photo captured privately.", "success");
  } catch (err) {
    setAttendanceFaceStatus(err.message || "Face capture failed. Please retry.", "error");
  } finally {
    attendanceFaceCaptureBtn.disabled = false;
  }
}

function getFileExtension(fileName) {
  const normalized = String(fileName || "").trim().toLowerCase();
  const lastDotIndex = normalized.lastIndexOf(".");
  return lastDotIndex >= 0 ? normalized.slice(lastDotIndex) : "";
}

function getFileInputLabel(input) {
  return (
    input?.closest(".input-group")?.querySelector("label")?.textContent?.replace(/\*/g, "").trim() ||
    input?.name ||
    "File"
  );
}

function validateProfileFormFiles(form) {
  const fileFields = [
    "prof_img",
    "aadhar_img",
    "pan_img",
    "cancelled_cheque",
    "resume_file",
    "experience_file",
    "certification_file",
    "documents",
  ];

  for (const fieldName of fileFields) {
    const input = form?.elements?.[fieldName];
    const files = Array.from(input?.files || []);
    if (!files.length) continue;

    if (fieldName === "documents" && files.length > 10) {
      return "Other Documents can include up to 10 files.";
    }

    for (const file of files) {
      if (file.size > PROFILE_FORM_MAX_FILE_SIZE) {
        return `${getFileInputLabel(input)} must be 15 MB or smaller.`;
      }

      const extension = getFileExtension(file.name);
      if (extension && !PROFILE_FORM_ALLOWED_EXTENSIONS.has(extension)) {
        return `${getFileInputLabel(input)} must be JPG, PNG, WEBP, HEIC, PDF, DOC or DOCX.`;
      }
    }
  }

  return "";
}

function normalizeSkillValue(value) {
  const normalizedKey = String(value || "")
    .toLowerCase()
    .replace(/[^a-z]/g, "");

  switch (normalizedKey) {
    case "web":
      return "web";
    case "seo":
      return "seo";
    case "smo":
      return "smo";
    case "ads":
      return "ads";
    case "app":
      return "app";
    case "erp":
    case "crm":
    case "erpcrm":
      return "erp_crm";
    default:
      return "";
  }
}

function parseProfileSkills(value) {
  let parsed = value;

  while (typeof parsed === "string") {
    const trimmed = parsed.trim();
    if (!trimmed) return [];

    try {
      parsed = JSON.parse(trimmed);
    } catch (_err) {
      parsed = trimmed;
      break;
    }
  }

  const sourceValues = Array.isArray(parsed) ? parsed : parsed ? [parsed] : [];
  return [...new Set(sourceValues.map(normalizeSkillValue).filter(Boolean))];
}

function togglePfFields() {
  const isEnabled = profileForm?.elements?.pf_enabled?.value === "1";
  pfDetails.classList.toggle("hidden", !isEnabled);

  ["pf_number", "uan_number", "employee_pf_amount", "employer_pf_amount", "pf_joining_date"].forEach(
    (fieldName) => {
      if (!profileForm?.elements?.[fieldName]) return;
      profileForm.elements[fieldName].required = isEnabled;
    },
  );
}

function populateSummary(user) {
  setSummaryValue("summaryName", user.name);
  setSummaryValue("summaryEmail", user.email);
  setSummaryValue("summaryContact", user.contact);
  setSummaryValue("summaryRole", user.role ? String(user.role).toUpperCase() : "-");
  setSummaryValue("summaryCompany", user.comp_name);
  setStatusBadge(user.profile_setup_status);
}

function populateForm(user) {
  attendanceFaceAlreadyEnrolled = Boolean(user.attendance_face_enrolled);
  if (attendanceFaceImageInput) attendanceFaceImageInput.value = "";
  if (attendanceFaceSignatureInput) attendanceFaceSignatureInput.value = "";
  setAttendanceFaceStatus(
    attendanceFaceAlreadyEnrolled
      ? "Face setup already saved. Capture again only to replace it."
      : "Face setup pending.",
    attendanceFaceAlreadyEnrolled ? "success" : "neutral",
  );

  setFieldValue("aadhar_no", user.aadhar_no || "");
  setFieldValue("pan_number", user.pan_number || "");
  setFieldValue("bank_name", user.bank_name || "");
  setFieldValue("account_no", user.account_no || "");
  setFieldValue("ifsc_code", user.ifsc_code || "");
  setFieldValue("beneficiary_name", user.beneficiary_name || "");
  setFieldValue("joining_date", user.joining_date || "");
  setFieldValue("total_experience", user.total_experience || "");
  setFieldValue("pf_enabled", Number(user.pf_enabled || 0) ? "1" : "0");
  setFieldValue("pf_number", user.pf_number || "");
  setFieldValue("uan_number", user.uan_number || "");
  setFieldValue("employee_pf_amount", user.employee_pf_amount ?? "");
  setFieldValue("employer_pf_amount", user.employer_pf_amount ?? "");
  setFieldValue("pf_joining_date", user.pf_joining_date || "");

  const selectedSkills = new Set(parseProfileSkills(user.skills));
  document
    .querySelectorAll('input[name="skills[]"]')
    .forEach((checkbox) => {
      checkbox.checked = selectedSkills.has(String(checkbox.value || ""));
    });

  setFieldHint(
    "profImgHint",
    user.prof_img ? "Profile image already saved. Upload only if you want to replace it." : "",
  );
  setFieldHint(
    "aadharImgHint",
    user.aadhar_img ? "Aadhar image already saved. Upload only if you want to replace it." : "",
  );
  setFieldHint(
    "panImgHint",
    user.pan_img ? "PAN image already saved. Upload only if you want to replace it." : "",
  );
  setFieldHint(
    "cancelledChequeHint",
    user.cancelled_cheque ? "Cancelled check already saved. Upload only if you want to replace it." : "",
  );
  setFieldHint(
    "resumeFileHint",
    user.resume_file ? "Resume already saved. Upload only if you want to replace it." : "",
  );
  setFieldHint(
    "experienceFileHint",
    user.experience_file ? "Experience letter already saved. Upload only if you want to replace it." : "",
  );
  setFieldHint(
    "certificationFileHint",
    user.certification_file ? "Certification file already saved. Upload only if you want to replace it." : "",
  );
  setFieldHint(
    "documentsHint",
    user.other_documents ? "Other documents already saved. Upload more only if required." : "",
  );

  togglePfFields();
}

function disableForm(message, type = "error") {
  profileForm.classList.add("hidden");
  setBanner(message, type);
}

async function parseJsonResponse(response) {
  const text = await response.text();

  try {
    return JSON.parse(text);
  } catch (_err) {
    return {
      success: false,
      message: "Invalid response from server",
    };
  }
}

async function loadProfileForm() {
  if (!profileToken) {
    setStatusBadge("expired");
    disableForm("This profile form link is missing. Please ask admin for a fresh link.");
    return;
  }

  try {
    const profileUrl = new URL(window.location.href);
    if (profileUrl.searchParams.get("token") !== profileToken) {
      profileUrl.searchParams.set("token", profileToken);
      if (profileUserId) profileUrl.searchParams.set("uid", profileUserId);
      window.history.replaceState(null, "", profileUrl.toString());
    }

    const response = await fetch(
      `${PROFILE_BASE_URL}/api/profile-setup/${encodeURIComponent(profileToken)}`,
      {
        cache: "no-store",
      },
    );
    const result = await parseJsonResponse(response);

    if (!response.ok || !result.success || !result.data) {
      setStatusBadge(response.status === 410 ? "expired" : "invalid");
      disableForm(
        result.message || "Unable to load your profile form right now.",
        response.status === 410 ? "error" : "error",
      );
      return;
    }

    populateSummary(result.data);
    populateForm(result.data);
    setBanner("Fill the remaining details below and submit once you are done.", "success");
  } catch (err) {
    console.error("Profile form load failed:", err);
    setStatusBadge("invalid");
    disableForm("Unable to load your profile form right now. Please try again later.");
  }
}

async function handleProfileSubmit(event) {
  event.preventDefault();
  setFormMessage("");

  const fileValidationMessage = validateProfileFormFiles(profileForm);
  if (fileValidationMessage) {
    setFormMessage(fileValidationMessage, "error");
    return;
  }

  const formData = new FormData(profileForm);
  if (!String(formData.get("aadhar_no") || "").trim()) {
    setFormMessage("Aadhar number is required.", "error");
    return;
  }

  if (!policyAcceptanceInput?.checked) {
    setFormMessage("Please accept the HR Policy and Employment Terms & Conditions before submitting.", "error");
    policyAcceptanceInput?.focus();
    return;
  }

  if (!attendanceFaceAlreadyEnrolled && !hasCapturedAttendanceFace()) {
    setFormMessage("Live face photo capture is required for attendance verification.", "error");
    setAttendanceFaceStatus("Capture live face before submitting.", "error");
    return;
  }

  setSubmittingState(true);

  try {
    const response = await fetch(
      `${PROFILE_BASE_URL}/api/profile-setup/${encodeURIComponent(profileToken)}`,
      {
        method: "POST",
        body: formData,
      },
    );
    const result = await parseJsonResponse(response);

    if (!response.ok || !result.success) {
      setFormMessage(
        result.message || `Request failed (${response.status})`,
        "error",
      );
      return;
    }

    setStatusBadge("completed");
    setBanner(
      result.message || "Profile details submitted successfully.",
      "success",
    );
    setFormMessage("");
    profileForm.classList.add("hidden");
  } catch (err) {
    console.error("Profile form submit failed:", err);
    setFormMessage("Server error while submitting your profile.", "error");
  } finally {
    setSubmittingState(false);
  }
}

if (pfEnabledField) {
  pfEnabledField.addEventListener("change", togglePfFields);
}

if (profileForm?.elements?.ifsc_code) {
  profileForm.elements.ifsc_code.addEventListener("input", (event) => {
    event.target.value = String(event.target.value || "").toUpperCase();
  });
}

if (attendanceFaceCaptureBtn) {
  attendanceFaceCaptureBtn.addEventListener("click", captureAttendanceFaceEnrollment);
}

if (profileForm) {
  profileForm.addEventListener("submit", handleProfileSubmit);
}

loadProfileForm();
