const Razorpay = require("razorpay");
const crypto = require("crypto");
const express = require("express");
const cors = require("cors");
const mysql = require("mysql2");
const multer = require("multer");
const cloudinary = require("cloudinary").v2;
const streamifier = require("streamifier");
const { Resend } = require("resend");
const path = require("path");
const fs = require("fs");
const https = require("https");
const rawLeaveRoleLeaderEmails = require("./leave-leader-config.json");
const converter = require("number-to-words");
const PDFDocument = require("pdfkit");
const app = express();
app.set("trust proxy", 1);

function loadLocalEnv() {
  const envPath = path.join(__dirname, ".env");
  if (!fs.existsSync(envPath)) return;

  const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
  lines.forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return;

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) return;

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed
      .slice(separatorIndex + 1)
      .trim()
      .replace(/^['"]|['"]$/g, "");

    if (key && !process.env[key]) {
      process.env[key] = value;
    }
  });
}

loadLocalEnv();

const PORT = Number(process.env.PORT || 3000);
const APP_TIME_ZONE =
  process.env.APP_TIME_ZONE ||
  process.env.APP_TIMEZONE ||
  process.env.TZ ||
  "Asia/Kolkata";
const APP_DB_TIMEZONE = process.env.DB_TIMEZONE || "+05:30";
const LOCAL_BASE_URL = `http://localhost:${PORT}`;
const RENDER_EXTERNAL_HOSTNAME_URL = process.env.RENDER_EXTERNAL_HOSTNAME
  ? `https://${String(process.env.RENDER_EXTERNAL_HOSTNAME).trim().replace(/^https?:\/\//, "")}`
  : "";
const PUBLIC_APP_URL = resolveConfiguredPublicAppUrl([
  process.env.PUBLIC_APP_URL,
  process.env.RENDER_EXTERNAL_URL,
  RENDER_EXTERNAL_HOSTNAME_URL,
  process.env.CLIENT_ORIGIN,
  process.env.APP_URL,
  process.env.PUBLIC_URL,
]);

const configuredOrigins = String(process.env.ALLOWED_ORIGINS || process.env.CLIENT_ORIGIN || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const allowedOrigins = new Set([
  "null",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "https://metrics-mart.onrender.com",
  "https://metrics-mart-gf6l.onrender.com",
  ...(PUBLIC_APP_URL ? [PUBLIC_APP_URL] : []),
  ...configuredOrigins,
]);

app.use((req, res, next) => {
  const origin = req.headers.origin;

  if (!origin || allowedOrigins.has(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin || "*");
    res.setHeader("Vary", "Origin");
    res.setHeader(
      "Access-Control-Allow-Methods",
      "GET, POST, PUT, DELETE, OPTIONS",
    );
    res.setHeader(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization",
    );
  }

  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }

  next();
});

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.has(origin)) {
        return callback(null, true);
      }

      return callback(new Error("Not allowed by CORS"));
    },
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: false,
  }),
);

app.use(express.json({ limit: "8mb" }));
app.use(express.urlencoded({ extended: true, limit: "8mb" }));

const DEAL_PRODUCT_CATALOG = [
  { name: "GMB SEO", price: 15000, group: "SEO Services" },
  { name: "Website SEO", price: 15000, group: "SEO Services" },
  { name: "SEO Additional Keyword", price: 1500, group: "SEO Services" },
  { name: "Profile Creation", price: 10000, group: "SEO Services" },
  { name: "Google Ads Management", price: 10000, group: "Advertising Services" },
  { name: "Meta Organic Management", price: 10000, group: "Advertising Services" },
  { name: "Meta Ads + Management", price: 15000, group: "Advertising Services" },
  { name: "Landing Page", price: 5000, group: "Website Development Services" },
  { name: "Static Website", price: 10000, group: "Website Development Services" },
  { name: "Dynamic Website", price: 20000, group: "Website Development Services" },
];

const DEAL_PRODUCT_PRICES = new Map(
  DEAL_PRODUCT_CATALOG.map((product) => [product.name, product.price]),
);

async function validateDealProductsPayload(
  productsJson,
  dealAmount,
  leadId,
  downsaleApprovalId,
) {
  let parsedProducts = [];

  try {
    parsedProducts = JSON.parse(productsJson || "[]");
  } catch (err) {
    return { valid: false, message: "Invalid products data" };
  }

  if (!Array.isArray(parsedProducts) || parsedProducts.length === 0) {
    return { valid: false, message: "Please add at least one product" };
  }

  const sanitizedProducts = [];
  let standardTotal = 0;

  for (const product of parsedProducts) {
    const name = typeof product?.name === "string" ? product.name.trim() : "";
    const minimum = DEAL_PRODUCT_PRICES.get(name);

    if (!name || !minimum) {
      return { valid: false, message: "Invalid product selected" };
    }

    standardTotal += minimum;
    sanitizedProducts.push({ name, amount: minimum });
  }

  const numericDealAmount = Number(dealAmount);
  if (!Number.isFinite(numericDealAmount) || numericDealAmount <= 0) {
    return { valid: false, message: "Invalid deal amount" };
  }

  if (numericDealAmount < standardTotal) {
    const approvalId = Number(downsaleApprovalId || 0);

    if (!approvalId) {
      return { valid: false, message: "Downsale needs admin approval" };
    }

    const [approvals] = await dbPromise.query(
      `SELECT requested_amount, standard_amount
       FROM downsale_requests
       WHERE id = ?
         AND lead_id = ?
         AND status = 'approved'
       LIMIT 1`,
      [approvalId, leadId],
    );

    if (!approvals.length) {
      return { valid: false, message: "Downsale approval is not approved yet" };
    }

    const approvedDownsaleAmount = Number(approvals[0].requested_amount);
    const approvedStandard = Number(approvals[0].standard_amount);
    const approvedDealAmount = approvedStandard - approvedDownsaleAmount;

    if (Math.abs(approvedStandard - standardTotal) > 0.01) {
      return {
        valid: false,
        message: "Downsale approval does not match this deal total",
      };
    }

    if (
      numericDealAmount < approvedDealAmount &&
      Math.abs(approvedDealAmount - numericDealAmount) > 0.01
    ) {
      return {
        valid: false,
        message: "Deal amount is below approved downsale total",
      };
    }
  }

  const finalProducts = sanitizedProducts.map((product) => ({
    ...product,
    amount:
      standardTotal > 0
        ? Number(((product.amount / standardTotal) * numericDealAmount).toFixed(2))
        : product.amount,
  }));

  const roundedTotal = finalProducts.reduce((sum, product) => sum + product.amount, 0);
  const roundingDiff = Number((numericDealAmount - roundedTotal).toFixed(2));
  if (finalProducts.length && roundingDiff !== 0) {
    finalProducts[finalProducts.length - 1].amount += roundingDiff;
  }

  return { valid: true, products: finalProducts };
}

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

const BASE_URL = PUBLIC_APP_URL || LOCAL_BASE_URL;
const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;
const DEFAULT_EMAIL_FROM_NAME = String(
  process.env.EMAIL_FROM_NAME ||
    process.env.MAIL_FROM_NAME ||
    process.env.MAILER_FROM_NAME ||
    "Metrics Mart Admin",
).trim();
const DEFAULT_RESEND_EMAIL_FROM =
  process.env.DEFAULT_RESEND_EMAIL_FROM ||
  `${DEFAULT_EMAIL_FROM_NAME} <smtp@metricsmartinfoline.com>`;

function resolveExistingFilePath(paths) {
  const candidates = paths.map((filePath) => String(filePath || "").trim()).filter(Boolean);
  return candidates.find((filePath) => fs.existsSync(filePath)) || candidates[0] || "";
}

const PROPOSAL_LETTERHEAD_HEADER_PATH = resolveExistingFilePath([
  process.env.PROPOSAL_LETTERHEAD_HEADER,
  path.join(__dirname, "letterhead-header.jpeg"),
  path.join(__dirname, "assets", "proposal", "letterhead-header.jpeg"),
]);
const PROPOSAL_LETTERHEAD_FOOTER_PATH = resolveExistingFilePath([
  process.env.PROPOSAL_LETTERHEAD_FOOTER,
  path.join(__dirname, "letterhead-footer.jpeg"),
  path.join(__dirname, "assets", "proposal", "letterhead-footer.jpeg"),
]);
const RED_SEA_PROPOSAL_LETTERHEAD_HEADER_PATH = resolveExistingFilePath([
  process.env.RED_SEA_PROPOSAL_LETTERHEAD_HEADER,
  path.join(__dirname, "redsea-letterhead-header.jpeg"),
  path.join(__dirname, "assets", "proposal", "redsea-letterhead-header.jpeg"),
]);
const RED_SEA_PROPOSAL_LETTERHEAD_FOOTER_PATH = resolveExistingFilePath([
  process.env.RED_SEA_PROPOSAL_LETTERHEAD_FOOTER,
  path.join(__dirname, "redsea-letterhead-footer.jpeg"),
  path.join(__dirname, "assets", "proposal", "redsea-letterhead-footer.jpeg"),
]);
const EMPLOYEE_CODE_PREFIX = "EMP";
const EMPLOYEE_CODE_PAD_LENGTH = 4;

function isLoopbackHostValue(value = "") {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .split("/")[0]
    .split(":")[0];

  return ["localhost", "127.0.0.1", "::1", "[::1]"].includes(normalized);
}

const PROJECT_SERVICE_LABELS = {
  web: "Web",
  seo: "SEO",
  smo: "SMO",
  ads: "Ads",
  app: "App",
  erp: "ERP/CRM",
};
const PROFILE_SETUP_TOKEN_TTL_HOURS = Math.max(
  1,
  Number(process.env.PROFILE_SETUP_LINK_TTL_HOURS || 168),
);

const PROJECT_PHASE_WORKFLOWS = {
  web: [
    { key: "discovery", label: "Discovery & Scope" },
    { key: "design", label: "UI/UX & Design" },
    { key: "development", label: "Development" },
    { key: "testing", label: "Testing & Review" },
    { key: "launch", label: "Launch & Handover" },
  ],
  app: [
    { key: "planning", label: "Planning & Scope" },
    { key: "ui_ux", label: "UI/UX Flow" },
    { key: "development", label: "App Development" },
    { key: "qa", label: "QA & Device Testing" },
    { key: "release", label: "Release & Handover" },
  ],
  erp: [
    { key: "discovery", label: "Discovery & Requirement Mapping" },
    { key: "module_mapping", label: "Module Mapping" },
    { key: "development", label: "Customization & Development" },
    { key: "testing_training", label: "Testing & Training" },
    { key: "go_live", label: "Go Live & Support" },
  ],
  seo: [
    { key: "assignment", label: "Assignment" },
    { key: "keyword_research", label: "Keyword Research" },
    { key: "keyword_approval", label: "Keyword Approval" },
    { key: "seo_calendar", label: "SEO Calendar" },
    { key: "work_tracker", label: "Work Tracker" },
    { key: "reporting", label: "Reports" },
  ],
  smo: [
    { key: "assignment", label: "Assignment" },
    { key: "strategy_research", label: "Strategy" },
    { key: "content_approval", label: "Approvals" },
    { key: "content_calendar", label: "Calendar" },
    { key: "publishing_growth", label: "Publishing" },
    { key: "reporting", label: "Reports" },
  ],
  ads: [
    { key: "planning", label: "Planning" },
    { key: "setup", label: "Campaign Setup" },
    { key: "optimization", label: "Optimization" },
    { key: "reporting", label: "Reporting" },
  ],
};

const PROJECT_PHASE_STATUS_VALUES = new Set([
  "pending",
  "ongoing",
  "blocked",
  "completed",
]);

const DEFAULT_SALES_TARGET = normalizeSalesTarget(
  process.env.SALES_TARGET_DEFAULT,
  500000,
);

function normalizeSalesTarget(value, fallback = 0) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) && numericValue >= 0
    ? numericValue
    : fallback;
}

function getSalesTargetForRole(role) {
  const normalizedRole = String(role || "")
    .toLowerCase()
    .trim();

  if (normalizedRole === "admin") {
    return normalizeSalesTarget(
      process.env.ADMIN_SALES_TARGET,
      DEFAULT_SALES_TARGET,
    );
  }

  if (normalizedRole === "me") {
    return normalizeSalesTarget(
      process.env.ME_SALES_TARGET,
      200000,
    );
  }

  if (normalizedRole === "tme") {
    return normalizeSalesTarget(
      process.env.TME_SALES_TARGET,
      200000,
    );
  }

  return DEFAULT_SALES_TARGET;
}

const AUTO_TARGET_INCENTIVE_RATE = 0.07;
const SALARY_TARGET_MULTIPLIER = 7;
const AUTO_TARGET_INCENTIVE_ROLES = new Set(["me", "tme"]);
const SALES_COMMISSION_ROLES = new Set(["me", "tme"]);
const DEFAULT_SALES_COMMISSION_PERCENT = 10;
let userRegistrationColumnsReady = false;
let userRegistrationColumnsPromise = null;
let attendanceFaceColumnsReady = false;
let attendanceFaceColumnsPromise = null;
let userProfileSetupColumnsReady = false;
let userProfileSetupColumnsPromise = null;
let leadSalesTypeColumnReady = false;
let leadSalesTypeColumnPromise = null;
let leadRenewalSourceColumnReady = false;
let leadRenewalSourceColumnPromise = null;
let leadCompanyScopeColumnReady = false;
let leadCompanyScopeColumnPromise = null;

async function resolveSalesTargetRole(role, userId) {
  const normalizedRole = String(role || "")
    .toLowerCase()
    .trim();

  if (normalizedRole) {
    return normalizedRole;
  }

  const normalizedUserId = Number(userId);
  if (!normalizedUserId) {
    return "";
  }

  const [rows] = await dbPromise.query(
    "SELECT role FROM users WHERE id = ? LIMIT 1",
    [normalizedUserId],
  );

  return String(rows[0]?.role || "")
    .toLowerCase()
    .trim();
}

function normalizePositiveId(value) {
  const id = Number(value);
  return Number.isFinite(id) && id > 0 ? id : 0;
}

function resolveLeadListUserId(req) {
  return normalizePositiveId(
    req?.query?.userId ||
      req?.query?.user_id ||
      req?.query?.created_by ||
      req?.body?.userId ||
      req?.body?.user_id ||
      req?.body?.created_by,
  );
}

async function getDealOwnerScope(userId) {
  const normalizedUserId = normalizePositiveId(userId);

  if (!normalizedUserId) {
    const error = new Error("User ID required");
    error.statusCode = 400;
    throw error;
  }

  const [rows] = await dbPromise.query(
    "SELECT name FROM users WHERE id = ? LIMIT 1",
    [normalizedUserId],
  );

  return {
    userId: normalizedUserId,
    employeeName: String(rows[0]?.name || "").trim(),
  };
}

function buildDealOwnerFilter(scope, alias = "") {
  const prefix = alias ? `${alias}.` : "";
  const params = [scope.userId, scope.userId, scope.userId];
  let clause = `(${prefix}created_by = ? OR ${prefix}closed_by = ? OR ${prefix}assign_emp_id = ?`;

  if (scope.employeeName) {
    clause += ` OR ${prefix}assign_emp = ?`;
    params.push(scope.employeeName);
  }

  clause += ")";
  return { clause, params };
}

function getDealRenewalMatchCondition(dealAlias = "l", renewalAlias = "rl") {
  const identityClause = `
    (
      (
        NULLIF(TRIM(COALESCE(${dealAlias}.telephone, '')), '') IS NOT NULL
        AND TRIM(COALESCE(${renewalAlias}.telephone, '')) = TRIM(COALESCE(${dealAlias}.telephone, ''))
      )
      OR (
        NULLIF(TRIM(COALESCE(${dealAlias}.email, '')), '') IS NOT NULL
        AND LOWER(TRIM(COALESCE(${renewalAlias}.email, ''))) = LOWER(TRIM(COALESCE(${dealAlias}.email, '')))
      )
      OR (
        NULLIF(TRIM(COALESCE(${dealAlias}.company_name, '')), '') IS NOT NULL
        AND LOWER(TRIM(COALESCE(${renewalAlias}.company_name, ''))) = LOWER(TRIM(COALESCE(${dealAlias}.company_name, '')))
        AND LOWER(TRIM(COALESCE(${renewalAlias}.client_name, ''))) = LOWER(TRIM(COALESCE(${dealAlias}.client_name, '')))
      )
    )
  `;

  return `
    (
      ${renewalAlias}.renewal_source_lead_id = ${dealAlias}.id
      OR (
        ${renewalAlias}.id <> ${dealAlias}.id
        AND ${renewalAlias}.sales_type = 'renewal'
        AND COALESCE(${renewalAlias}.created_at, NOW()) >= COALESCE(${dealAlias}.closed_date, ${dealAlias}.created_at)
        AND ${identityClause}
      )
    )
  `;
}

function getDealRenewalSelectSql(dealAlias = "l", companyScope = "") {
  const matchCondition = getDealRenewalMatchCondition(dealAlias, "rl");
  const closedMatchCondition = getDealRenewalMatchCondition(dealAlias, "rcl");
  const renewalScopeSql = getCompanyLeadScopeSql(companyScope, "rl");
  const closedRenewalScopeSql = getCompanyLeadScopeSql(companyScope, "rcl");
  const renewalScopeClause = renewalScopeSql ? `AND ${renewalScopeSql}` : "";
  const closedRenewalScopeClause = closedRenewalScopeSql ? `AND ${closedRenewalScopeSql}` : "";

  return `
    CASE
      WHEN EXISTS (
        SELECT 1
        FROM leads rl
        WHERE ${matchCondition}
          ${renewalScopeClause}
        LIMIT 1
      ) THEN 1
      ELSE 0
    END AS has_renewal,
    (
      SELECT COUNT(*)
      FROM leads rl
      WHERE ${matchCondition}
        ${renewalScopeClause}
    ) AS renewal_count,
    (
      SELECT COUNT(*)
      FROM leads rcl
      WHERE ${closedMatchCondition}
        ${closedRenewalScopeClause}
        AND rcl.lead_status = 'deal_closed'
    ) AS renewal_closed_count
  `;
}

function normalizeRenewalLookaheadDays(value) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return 365;

  return Math.min(Math.max(Math.round(numericValue), 0), 3650);
}

function getAutoSalaryTargetForUser(user) {
  const role = normalizeRoleValue(user?.role);
  const compensationType = normalizeCompensationType(user?.compensation_type);

  if (!AUTO_TARGET_INCENTIVE_ROLES.has(role) || compensationType !== "salary") {
    return null;
  }

  const salary = normalizePayrollAmount(user?.salary);

  return {
    target: Number((salary * SALARY_TARGET_MULTIPLIER).toFixed(2)),
    salary,
    multiplier: SALARY_TARGET_MULTIPLIER,
    source: "salary_7x",
  };
}

async function getSalesTargetSummaryData({ role, userId, monthKey } = {}) {
  const normalizedUserId = Number(userId);
  const effectiveRole = await resolveSalesTargetRole(role, normalizedUserId);
  const normalizedMonthKey = normalizePayrollMonthKey(monthKey);
  const monthRange = getPayrollMonthRange(normalizedMonthKey);
  let sql = `
    SELECT
      COALESCE(SUM(COALESCE(deal_amount, 0)), 0) AS achieved,
      COUNT(*) AS dealsCount
    FROM leads
    WHERE lead_status = 'deal_closed'
      AND closed_date IS NOT NULL
      AND DATE(closed_date) BETWEEN ? AND ?
  `;
  const params = [monthRange.startDate, monthRange.endDate];

  if (effectiveRole === "me" || effectiveRole === "tme") {
    const ownerScope = await getDealOwnerScope(normalizedUserId);
    const ownerFilter = buildDealOwnerFilter(ownerScope);
    sql += ` AND ${ownerFilter.clause}`;
    params.push(...ownerFilter.params);
  } else if (effectiveRole !== "admin") {
    const ownerScope = await getDealOwnerScope(normalizedUserId);
    const ownerFilter = buildDealOwnerFilter(ownerScope);
    sql += ` AND ${ownerFilter.clause}`;
    params.push(...ownerFilter.params);
  }

  await ensureUserMonthlyTargetColumn();

  const [rows] = await dbPromise.query(sql, params);
  const achieved = Number(rows[0]?.achieved || 0);
  let target = getSalesTargetForRole(effectiveRole);
  let targetSource = "role_default";
  let targetBasis = null;
  let compensationType = "salary";

  if (normalizedUserId) {
    const [userRows] = await dbPromise.query(
      "SELECT role, salary, compensation_type, monthly_target, commission_percent FROM users WHERE id = ? LIMIT 1",
      [normalizedUserId],
    );
    const user = userRows[0] || {};
    const userRole = normalizeRoleValue(user.role || effectiveRole);
    compensationType = normalizeCompensationType(user.compensation_type);
    const salaryTarget = getAutoSalaryTargetForUser({
      ...user,
      role: userRole,
      compensation_type: compensationType,
    });

    if (salaryTarget) {
      target = salaryTarget.target;
      targetSource = salaryTarget.source;
      targetBasis = {
        salary: salaryTarget.salary,
        multiplier: salaryTarget.multiplier,
      };
    } else if (
      AUTO_TARGET_INCENTIVE_ROLES.has(userRole) &&
      compensationType === "commission"
    ) {
      target = 0;
      targetSource = "commission";
      targetBasis = {
        commissionPercent: getFixedSalesCommissionPercent(compensationType),
      };
    } else {
      const customTarget = Number(user.monthly_target);
      if (Number.isFinite(customTarget) && customTarget >= 0) {
        target = customTarget;
        targetSource = "manual";
      }
    }
  }

  return {
    role: effectiveRole,
    userId: normalizedUserId || null,
    monthKey: monthRange.monthKey,
    startDate: monthRange.startDate,
    endDate: monthRange.endDate,
    target,
    targetSource,
    targetBasis,
    compensationType,
    isCommissionProfile: compensationType === "commission",
    commissionPercent: getFixedSalesCommissionPercent(compensationType),
    commissionAmount: compensationType === "commission"
      ? Number(((achieved * DEFAULT_SALES_COMMISSION_PERCENT) / 100).toFixed(2))
      : 0,
    salaryTargetMultiplier: SALARY_TARGET_MULTIPLIER,
    incentiveRate: AUTO_TARGET_INCENTIVE_RATE,
    achieved,
    remaining: Math.max(target - achieved, 0),
    dealsCount: Number(rows[0]?.dealsCount || 0),
  };
}

async function getAdminTeamTargetSummary({ monthKey } = {}) {
  await ensureUserMonthlyTargetColumn();

  const normalizedMonthKey = normalizePayrollMonthKey(monthKey);
  const [users] = await dbPromise.query(
    `
      SELECT
        id,
        name,
        role,
        salary,
        compensation_type,
        commission_percent,
        monthly_target
      FROM users
      WHERE LOWER(TRIM(COALESCE(role, ''))) IN ('me', 'tme')
      ORDER BY
        FIELD(LOWER(TRIM(COALESCE(role, ''))), 'tme', 'me'),
        name ASC,
        id ASC
    `,
  );

  const data = await Promise.all(
    users.map(async (user) => {
      const summary = await getSalesTargetSummaryData({
        role: user.role,
        userId: user.id,
        monthKey: normalizedMonthKey,
      });

      const target = Number(summary.target || 0);
      const achieved = Number(summary.achieved || 0);

      return {
        userId: Number(user.id || 0),
        name: String(user.name || "Employee"),
        role: String(user.role || "")
          .toLowerCase()
          .trim(),
        roleLabel: String(user.role || "")
          .toUpperCase()
          .trim() || "EMPLOYEE",
        compensationType: summary.compensationType,
        salary: normalizePayrollAmount(user.salary),
        commissionPercent: summary.commissionPercent,
        commissionAmount: summary.commissionAmount,
        target,
        targetSource: summary.targetSource,
        targetBasis: summary.targetBasis,
        salaryTargetMultiplier: summary.salaryTargetMultiplier,
        incentiveRate: summary.incentiveRate,
        achieved,
        remaining: Math.max(target - achieved, 0),
        dealsCount: Number(summary.dealsCount || 0),
        isAchieved: target > 0 && achieved >= target,
      };
    }),
  );

  const summary = data.reduce(
    (accumulator, item) => {
      accumulator.totalMembers += 1;
      accumulator.totalTarget += Number(item.target || 0);
      accumulator.totalAchieved += Number(item.achieved || 0);
      if (item.isAchieved) {
        accumulator.achievedMembers += 1;
      }
      return accumulator;
    },
    {
      totalMembers: 0,
      totalTarget: 0,
      totalAchieved: 0,
      achievedMembers: 0,
    },
  );

  return {
    month: normalizedMonthKey,
    summary: {
      ...summary,
      totalRemaining: Math.max(summary.totalTarget - summary.totalAchieved, 0),
    },
    data,
  };
}

function sanitizeSalesTargetSummaryForEmployee(summary = {}) {
  const safeSummary = { ...summary };

  delete safeSummary.targetSource;
  delete safeSummary.targetBasis;

  return safeSummary;
}

async function getAutoTargetIncentiveForPayroll({ user, monthKey, basicSalary }) {
  const role = String(user?.role || "")
    .toLowerCase()
    .trim();

  if (!AUTO_TARGET_INCENTIVE_ROLES.has(role)) {
    return {
      applies: false,
      amount: 0,
      target: 0,
      achieved: 0,
      remaining: 0,
      rate: AUTO_TARGET_INCENTIVE_RATE,
      source: "none",
      basis: null,
    };
  }

  const targetSummary = await getSalesTargetSummaryData({
    role,
    userId: Number(user?.id || 0),
    monthKey,
  });
  const target = Number(targetSummary.target || 0);
  const achieved = Number(targetSummary.achieved || 0);
  const applies = target > 0 && achieved >= target;

  return {
    applies,
    amount: applies
      ? Number((normalizePayrollAmount(basicSalary) * AUTO_TARGET_INCENTIVE_RATE).toFixed(2))
      : 0,
    target,
    achieved,
    remaining: Math.max(target - achieved, 0),
    rate: AUTO_TARGET_INCENTIVE_RATE,
    source: targetSummary.targetSource,
    basis: targetSummary.targetBasis,
  };
}

async function getSalesCommissionForPayroll({ user, monthKey } = {}) {
  const compensationType = normalizeCompensationType(user?.compensation_type);
  const role = String(user?.role || "")
    .toLowerCase()
    .trim();
  const commissionPercent = getFixedSalesCommissionPercent(compensationType);

  if (
    compensationType !== "commission" ||
    !SALES_COMMISSION_ROLES.has(role) ||
    commissionPercent <= 0
  ) {
    return {
      applies: false,
      salesAmount: 0,
      dealsCount: 0,
      percent: 0,
      amount: 0,
    };
  }

  const summary = await getSalesTargetSummaryData({
    role,
    userId: Number(user?.id || 0),
    monthKey,
  });
  const salesAmount = normalizePayrollAmount(summary.achieved);

  return {
    applies: true,
    salesAmount,
    dealsCount: Number(summary.dealsCount || 0),
    percent: commissionPercent,
    amount: Number(((salesAmount * commissionPercent) / 100).toFixed(2)),
  };
}

// ====================== MIDDLEWARE ======================
app.use(express.urlencoded({ extended: true, limit: "8mb" }));
app.use(express.json({ limit: "8mb" }));
app.use(express.static(__dirname));

// ====================== MULTER SETUP ======================
const uploadsDir = path.join(__dirname, "uploads");
function ensureUploadDirectory(directoryPath) {
  if (!fs.existsSync(directoryPath)) {
    fs.mkdirSync(directoryPath, { recursive: true });
  }
}

ensureUploadDirectory(uploadsDir);

const registrationPrimaryUploadFolders = Object.freeze({
  prof_img: "profile-pics",
  aadhar_img: "aadhar-images",
  pan_img: "pan-images",
  cancelled_cheque: "cancelled-cheques",
  resume_file: "resumes",
  experience_file: "experience-documents",
  certification_file: "certifications",
  other_documents: "registration-documents",
});

const registrationUploadFieldAliases = Object.freeze({
  prof_img: ["prof_img", "profile_pic", "profile_img", "profile_image", "photo", "avatar"],
  aadhar_img: ["aadhar_img", "aadhar_image", "aadhar_file", "aadhar_card"],
  pan_img: ["pan_img", "pan_image", "pan_file", "pan_card"],
  cancelled_cheque: [
    "cancelled_cheque",
    "cancelled_cheque_file",
    "cancelled_cheque_img",
    "cheque_file",
  ],
  resume_file: ["resume_file", "resume", "resume_doc", "resume_document"],
  experience_file: [
    "experience_file",
    "experience_doc",
    "experience_document",
    "experience_letter",
  ],
  certification_file: [
    "certification_file",
    "certificate_file",
    "certification_doc",
    "certificate_doc",
  ],
  other_documents: [
    "other_documents",
    "documents",
    "document",
    "other_document",
    "other_docs",
  ],
});

const registrationUploadFolders = Object.freeze(
  Object.fromEntries(
    Object.entries(registrationUploadFieldAliases).flatMap(([primaryField, aliases]) =>
      aliases.map((alias) => [alias, registrationPrimaryUploadFolders[primaryField]]),
    ),
  ),
);

const uploadFolderNames = new Set([
  ...Object.values(registrationPrimaryUploadFolders),
  "registration-documents",
  "payments",
  "project-phases",
  "leaves",
]);

uploadFolderNames.forEach((folderName) => {
  ensureUploadDirectory(path.join(uploadsDir, folderName));
});

function getSafeUploadBaseName(originalName, fallback = "file") {
  return String(originalName || fallback)
    .replace(/\.[^/.]+$/, "")
    .replace(/[^a-z0-9_-]+/gi, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48) || fallback;
}

function getUploadFolderNameForField(fieldName) {
  return registrationUploadFolders[fieldName] || "registration-documents";
}

const cloudinaryUploadConfig = {
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
};

const isCloudinaryConfigured = Boolean(
  cloudinaryUploadConfig.cloud_name &&
    cloudinaryUploadConfig.api_key &&
    cloudinaryUploadConfig.api_secret,
);

if (isCloudinaryConfigured) {
  cloudinary.config(cloudinaryUploadConfig);
}

function normalizeCloudinaryFolderPath(value) {
  return String(value || "")
    .replace(/\\/g, "/")
    .split("/")
    .map((segment) =>
      segment
        .trim()
        .replace(/[^a-z0-9_-]+/gi, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, ""),
    )
    .filter(Boolean)
    .join("/");
}

function getCloudinaryUploadFolder(folderName) {
  const prefix = normalizeCloudinaryFolderPath(
    process.env.CLOUDINARY_FOLDER_PREFIX || "metrics-mart",
  );
  const folder = normalizeCloudinaryFolderPath(folderName || "uploads") || "uploads";

  return [prefix, folder].filter(Boolean).join("/");
}

function getUploadedFileAbsolutePath(uploadedFile) {
  if (!uploadedFile) return "";

  const candidatePath =
    uploadedFile.path ||
    (uploadedFile.destination && uploadedFile.filename
      ? path.join(uploadedFile.destination, uploadedFile.filename)
      : "");

  if (!candidatePath) return "";

  return path.isAbsolute(candidatePath)
    ? candidatePath
    : path.resolve(__dirname, candidatePath);
}

function uploadBufferToCloudinary(fileBuffer, folderName, originalName = "upload") {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: getCloudinaryUploadFolder(folderName),
        resource_type: "auto",
        filename_override: originalName,
        use_filename: true,
        unique_filename: true,
        overwrite: false,
      },
      (error, result) => {
        if (error) {
          reject(error);
          return;
        }

        resolve(result);
      },
    );

    streamifier.createReadStream(fileBuffer).pipe(uploadStream);
  });
}

async function uploadMulterFileToCloudinary(uploadedFile, folderName) {
  if (!isCloudinaryConfigured || !uploadedFile) return null;

  const targetFolder = folderName || getUploadFolderNameForField(uploadedFile.fieldname);

  if (uploadedFile.buffer) {
    return uploadBufferToCloudinary(
      uploadedFile.buffer,
      targetFolder,
      uploadedFile.originalname || uploadedFile.filename || "upload",
    );
  }

  const absolutePath = getUploadedFileAbsolutePath(uploadedFile);
  if (!absolutePath) return null;

  return cloudinary.uploader.upload(absolutePath, {
    folder: getCloudinaryUploadFolder(targetFolder),
    resource_type: "auto",
    use_filename: true,
    unique_filename: true,
    overwrite: false,
  });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const folderName =
      registrationUploadFolders[file.fieldname] || "registration-documents";
    const destinationPath = path.join(uploadsDir, folderName);
    ensureUploadDirectory(destinationPath);
    cb(null, destinationPath);
  },
  filename: (req, file, cb) => {
    const fieldPrefix = String(file.fieldname || "upload")
      .replace(/[^a-z0-9_-]+/gi, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 28) || "upload";
    const safeName = getSafeUploadBaseName(file.originalname, fieldPrefix);
    const uniqueName = `${fieldPrefix}-${Date.now()}-${Math.round(
      Math.random() * 1e9,
    )}-${safeName}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  },
});

const registrationAllowedExtensions = new Set([
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

const registrationAllowedMimeTypes = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

const registrationMaxFileSize = 15 * 1024 * 1024;

const upload = multer({
  storage: storage,
  limits: { fileSize: registrationMaxFileSize },
  fileFilter: (req, file, cb) => {
    const mimeType = String(file.mimetype || "").toLowerCase();
    const extension = path.extname(String(file.originalname || "")).toLowerCase();

    if (
      mimeType.startsWith("image/") ||
      registrationAllowedMimeTypes.has(mimeType) ||
      registrationAllowedExtensions.has(extension)
    ) {
      cb(null, true);
      return;
    }

    cb(new Error("Only image, PDF, DOC or DOCX files are allowed."), false);
  },
});

const registrationMultiUploadFields = new Set(
  registrationUploadFieldAliases.other_documents || [],
);

const userRegistrationUpload = upload.fields(
  Object.keys(registrationUploadFolders).map((fieldName) => ({
    name: fieldName,
    maxCount: registrationMultiUploadFields.has(fieldName) ? 10 : 1,
  })),
);

function normalizeUploadedFilePath(uploadedFile, folderName = "") {
  if (!uploadedFile) return null;

  const candidatePath =
    uploadedFile.path ||
    (uploadedFile.destination && uploadedFile.filename
      ? path.join(uploadedFile.destination, uploadedFile.filename)
      : "");

  if (candidatePath) {
    const absolutePath = path.isAbsolute(candidatePath)
      ? candidatePath
      : path.resolve(__dirname, candidatePath);
    const relativePath = path.relative(__dirname, absolutePath);

    if (relativePath && !relativePath.startsWith("..") && !path.isAbsolute(relativePath)) {
      return relativePath.split(path.sep).join("/");
    }
  }

  const resolvedFolderName =
    folderName || registrationUploadFolders[uploadedFile.fieldname] || "";
  return ["uploads", resolvedFolderName, uploadedFile.filename]
    .filter(Boolean)
    .join("/");
}

function formatPublicUploadUrl(filePath) {
  const value = String(filePath || "").trim();
  if (!value) return "";
  if (/^https?:\/\//i.test(value)) return value;

  return `/${value.replace(/\\/g, "/").replace(/^\/+/, "")}`;
}

async function resolveUploadedFilePath(uploadedFile, folderName = "") {
  if (!uploadedFile) return null;

  const targetFolder =
    folderName || getUploadFolderNameForField(uploadedFile.fieldname);
  const localPath = normalizeUploadedFilePath(uploadedFile, targetFolder);

  if (!isCloudinaryConfigured) return localPath;

  try {
    const result = await uploadMulterFileToCloudinary(uploadedFile, targetFolder);
    return result?.secure_url || result?.url || localPath;
  } catch (err) {
    console.error("Cloudinary upload failed:", err);
    return localPath;
  }
}

async function getUploadedFilePath(files, fieldName) {
  const fieldNames = registrationUploadFieldAliases[fieldName] || [fieldName];

  for (const candidateField of fieldNames) {
    const uploadedFile = Array.isArray(files?.[candidateField])
      ? files[candidateField][0]
      : null;

    if (uploadedFile) {
      return resolveUploadedFilePath(
        uploadedFile,
        getUploadFolderNameForField(candidateField),
      );
    }
  }

  return null;
}

async function getUploadedFilePaths(files, fieldName) {
  const fieldNames = registrationUploadFieldAliases[fieldName] || [fieldName];
  const uploadedFiles = [];

  for (const candidateField of fieldNames) {
    if (Array.isArray(files?.[candidateField])) {
      uploadedFiles.push(
        ...files[candidateField].map((file) => ({
          file,
          folderName: getUploadFolderNameForField(candidateField),
        })),
      );
    }
  }

  const paths = [];
  for (const item of uploadedFiles) {
    const uploadedPath = await resolveUploadedFilePath(item.file, item.folderName);
    if (uploadedPath) paths.push(uploadedPath);
  }

  return paths;
}

function parseStoredDocumentList(value) {
  let source = value;

  if (typeof source === "string") {
    const trimmed = source.trim();
    if (!trimmed) return [];

    try {
      source = JSON.parse(trimmed);
    } catch (_err) {
      source = trimmed;
    }
  }

  const list = Array.isArray(source) ? source : source ? [source] : [];

  return list
    .map((item) => {
      if (typeof item === "string") return item.trim();
      if (item && typeof item === "object") {
        return String(item.url || item.path || item.file || "").trim();
      }

      return "";
    })
    .filter(Boolean);
}

function serializeStoredDocumentList(documents) {
  const uniqueDocuments = [
    ...new Set(
      (Array.isArray(documents) ? documents : [])
        .map((documentPath) => String(documentPath || "").trim())
        .filter(Boolean),
    ),
  ];

  return uniqueDocuments.length ? JSON.stringify(uniqueDocuments) : null;
}

async function getMergedOtherDocuments(files, existingValue = null) {
  const uploadedDocuments = await getUploadedFilePaths(files, "other_documents");
  if (!uploadedDocuments.length) return existingValue || null;

  return serializeStoredDocumentList([
    ...parseStoredDocumentList(existingValue),
    ...uploadedDocuments,
  ]);
}

function getDatabaseErrorMessage(err, fallback = "Database error") {
  if (!err) return fallback;

  if (err.code === "ER_DATA_TOO_LONG" && err.sqlMessage) {
    return err.sqlMessage;
  }

  if (err.code === "ER_NO_SUCH_TABLE") {
    return "Required database table is missing. Please import mm_new.sql on the server.";
  }

  if (err.code === "ER_BAD_FIELD_ERROR" && err.sqlMessage) {
    return err.sqlMessage;
  }

  if (err.code === "ECONNREFUSED" || err.code === "ENOTFOUND") {
    return "Database connection failed. Please check live server DB environment variables.";
  }

  return fallback;
}

function hasBodyField(body, fieldName) {
  return Object.prototype.hasOwnProperty.call(body || {}, fieldName);
}

const ATTENDANCE_FACE_IMAGE_MAX_BYTES = 650 * 1024;
const ATTENDANCE_FACE_SIGNATURE_HASH_LENGTH = 64;
const ATTENDANCE_FACE_SIGNATURE_HISTOGRAM_LENGTH = 12;
const ATTENDANCE_FACE_MATCH_THRESHOLD = Math.min(
  0.95,
  Math.max(0.45, Number(process.env.ATTENDANCE_FACE_MATCH_THRESHOLD || 0.62)),
);

function createRequestError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function normalizeAttendanceFaceImage(value, { required = false } = {}) {
  const image = String(value || "").trim();

  if (!image) {
    if (required) {
      throw createRequestError("Live face photo is required for attendance.");
    }
    return "";
  }

  const match = image.match(/^data:image\/(jpeg|jpg|png|webp);base64,([a-z0-9+/=\s]+)$/i);
  if (!match) {
    throw createRequestError("Invalid face photo format. Please capture a live photo again.");
  }

  const base64 = match[2].replace(/\s/g, "");
  const sizeBytes = Buffer.byteLength(base64, "base64");
  if (!sizeBytes || sizeBytes > ATTENDANCE_FACE_IMAGE_MAX_BYTES) {
    throw createRequestError("Face photo is too large. Please capture it again.");
  }

  return `data:image/${match[1].toLowerCase().replace("jpg", "jpeg")};base64,${base64}`;
}

function normalizeAttendanceFaceSignature(value, { required = false } = {}) {
  let signature = value;

  if (typeof signature === "string") {
    const trimmed = signature.trim();
    if (!trimmed) {
      if (required) {
        throw createRequestError("Face verification data is required.");
      }
      return null;
    }

    try {
      signature = JSON.parse(trimmed);
    } catch (_err) {
      throw createRequestError("Invalid face verification data. Please capture your face again.");
    }
  }

  if (!signature || typeof signature !== "object") {
    if (required) {
      throw createRequestError("Face verification data is required.");
    }
    return null;
  }

  const hash = String(signature.hash || "").replace(/[^01]/g, "");
  const histogram = Array.isArray(signature.histogram)
    ? signature.histogram.map((value) => Number(value))
    : [];
  const brightness = Number(signature.brightness);

  if (
    hash.length !== ATTENDANCE_FACE_SIGNATURE_HASH_LENGTH ||
    histogram.length !== ATTENDANCE_FACE_SIGNATURE_HISTOGRAM_LENGTH ||
    histogram.some((value) => !Number.isFinite(value) || value < 0) ||
    !Number.isFinite(brightness)
  ) {
    throw createRequestError("Invalid face verification data. Please capture your face again.");
  }

  return {
    version: 1,
    hash,
    histogram: histogram.map((value) => Number(value.toFixed(6))),
    brightness: Number(Math.max(0, Math.min(255, brightness)).toFixed(2)),
    width: Number(signature.width || 0) || null,
    height: Number(signature.height || 0) || null,
    capturedAt: String(signature.capturedAt || new Date().toISOString()).slice(0, 40),
  };
}

function readAttendanceFaceSubmission(body, { required = false } = {}) {
  const faceImage = normalizeAttendanceFaceImage(
    body?.attendance_face_image || body?.faceImage,
    { required },
  );
  const faceSignature = normalizeAttendanceFaceSignature(
    body?.attendance_face_signature || body?.faceSignature,
    { required },
  );

  if (!faceImage && !faceSignature) return null;
  if (!faceImage || !faceSignature) {
    throw createRequestError("Face photo and verification data are both required.");
  }

  return {
    image: faceImage,
    signature: faceSignature,
    signatureJson: JSON.stringify(faceSignature),
  };
}

function compareAttendanceFaceSignatures(storedSignature, liveSignature) {
  const stored = normalizeAttendanceFaceSignature(storedSignature, { required: true });
  const live = normalizeAttendanceFaceSignature(liveSignature, { required: true });

  let matchingBits = 0;
  for (let index = 0; index < ATTENDANCE_FACE_SIGNATURE_HASH_LENGTH; index += 1) {
    if (stored.hash[index] === live.hash[index]) matchingBits += 1;
  }

  const hashScore = matchingBits / ATTENDANCE_FACE_SIGNATURE_HASH_LENGTH;
  let histogramIntersection = 0;
  let histogramUnion = 0;

  for (let index = 0; index < ATTENDANCE_FACE_SIGNATURE_HISTOGRAM_LENGTH; index += 1) {
    const storedValue = Number(stored.histogram[index] || 0);
    const liveValue = Number(live.histogram[index] || 0);
    histogramIntersection += Math.min(storedValue, liveValue);
    histogramUnion += Math.max(storedValue, liveValue);
  }

  const histogramScore = histogramUnion > 0 ? histogramIntersection / histogramUnion : 0;
  const brightnessScore = 1 - Math.min(Math.abs(stored.brightness - live.brightness) / 255, 1);
  const score = (hashScore * 0.6) + (histogramScore * 0.3) + (brightnessScore * 0.1);

  return Number(score.toFixed(4));
}

async function saveAttendanceFaceEnrollment(userId, submission) {
  if (!submission) return false;

  await ensureAttendanceFaceColumns();
  await dbPromise.query(
    `
      UPDATE users
      SET
        attendance_face_image = ?,
        attendance_face_signature = ?,
        attendance_face_enrolled_at = NOW()
      WHERE id = ?
      LIMIT 1
    `,
    [submission.image, submission.signatureJson, userId],
  );

  return true;
}

async function verifyAttendanceFaceForUser(userId, body) {
  const liveFace = readAttendanceFaceSubmission(body, { required: true });
  await ensureAttendanceFaceColumns();

  const [users] = await dbPromise.query(
    `
      SELECT
        id,
        attendance_face_signature,
        attendance_face_enrolled_at
      FROM users
      WHERE id = ?
      LIMIT 1
    `,
    [userId],
  );

  if (!users.length) {
    throw createRequestError("Invalid user id", 400);
  }

  const user = users[0];
  if (!user.attendance_face_signature || !user.attendance_face_enrolled_at) {
    throw createRequestError(
      "Face setup missing. Please complete live face setup before marking attendance.",
      400,
    );
  }

  const matchScore = compareAttendanceFaceSignatures(
    user.attendance_face_signature,
    liveFace.signature,
  );

  if (matchScore < ATTENDANCE_FACE_MATCH_THRESHOLD) {
    throw createRequestError(
      "Face verification failed. Please retry with your registered face.",
      403,
    );
  }

  return { score: matchScore };
}

function normalizeProfileSkillValue(value) {
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

function parseProfileSkillsInput(rawValue) {
  let skills = rawValue ?? [];
  if (!Array.isArray(skills)) {
    skills = [skills];
  }

  const uniqueSkills = [];
  const seen = new Set();

  skills.forEach((skill) => {
    const normalized = normalizeProfileSkillValue(skill);
    if (!normalized || seen.has(normalized)) return;
    seen.add(normalized);
    uniqueSkills.push(normalized);
  });

  return uniqueSkills;
}

function normalizeOptionalPayrollAmount(value) {
  if (value == null) return null;

  const trimmed = String(value).replace(/,/g, "").trim();
  if (!trimmed) return null;

  const numericValue = Number(trimmed);
  return Number.isFinite(numericValue) ? Number(numericValue.toFixed(2)) : null;
}

function normalizeCompensationType(value) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();
  return normalized === "commission" ? "commission" : "salary";
}

function normalizeCommissionPercent(value) {
  const percent = Number(String(value ?? "").replace(/,/g, "").trim());
  return Number.isFinite(percent) ? Number(percent.toFixed(2)) : 0;
}

function getFixedSalesCommissionPercent(compensationType) {
  return normalizeCompensationType(compensationType) === "commission"
    ? DEFAULT_SALES_COMMISSION_PERCENT
    : 0;
}

function normalizeAppBaseUrl(value) {
  return String(value || "")
    .trim()
    .replace(/\/+$/, "");
}

function getNonLoopbackUrlOrigin(value) {
  const rawValue = String(value || "").trim();
  if (!rawValue) return "";

  try {
    const parsedUrl = new URL(rawValue);
    if (!["http:", "https:"].includes(parsedUrl.protocol)) return "";
    if (isLoopbackHostValue(parsedUrl.hostname)) return "";
    return normalizeAppBaseUrl(parsedUrl.origin);
  } catch (err) {
    return "";
  }
}

function resolveConfiguredPublicAppUrl(candidates = []) {
  for (const candidate of candidates) {
    const normalizedCandidate = normalizeAppBaseUrl(candidate);
    const publicOrigin = getNonLoopbackUrlOrigin(normalizedCandidate);
    if (publicOrigin) return publicOrigin;
  }

  return "";
}

function resolveAppBaseUrl(req) {
  const forwardedProto = String(
    req.headers["x-forwarded-proto"] || req.protocol || "http",
  )
    .split(",")[0]
    .trim();
  const forwardedHost = String(
    req.headers["x-forwarded-host"] || req.get("host") || "localhost:3000",
  )
    .split(",")[0]
    .trim();
  const requestBaseUrl = normalizeAppBaseUrl(`${forwardedProto}://${forwardedHost}`);
  const requestHost = requestBaseUrl
    .replace(/^https?:\/\//, "")
    .split("/")[0]
    .split(":")[0];

  if (requestBaseUrl && !isLoopbackHostValue(requestHost)) {
    return requestBaseUrl;
  }

  const originBaseUrl =
    getNonLoopbackUrlOrigin(req.headers.origin) ||
    getNonLoopbackUrlOrigin(req.headers.referer);
  if (originBaseUrl) {
    return originBaseUrl;
  }

  return PUBLIC_APP_URL || requestBaseUrl || BASE_URL;
}

function normalizeProfileSetupTokenValue(token) {
  const tokenMatch = String(token || "").match(/[a-f0-9]{64}/i);
  return tokenMatch ? tokenMatch[0].toLowerCase() : "";
}

function hashProfileSetupToken(token) {
  return crypto
    .createHash("sha256")
    .update(normalizeProfileSetupTokenValue(token))
    .digest("hex");
}

function generateProfileSetupTokenData() {
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(
    Date.now() + PROFILE_SETUP_TOKEN_TTL_HOURS * 60 * 60 * 1000,
  );

  return {
    token,
    tokenHash: hashProfileSetupToken(token),
    expiresAt,
  };
}

function formatProfileSetupExpiryLabel(dateValue) {
  const date = dateValue instanceof Date ? dateValue : new Date(dateValue);
  if (Number.isNaN(date.getTime())) return "";

  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Calcutta",
  }).format(date);
}

function getProfileSetupStatusDetails(user) {
  const rawStatus = String(user?.profile_setup_status || "not_sent")
    .trim()
    .toLowerCase();
  const expiresAt = user?.profile_setup_expires_at
    ? new Date(user.profile_setup_expires_at)
    : null;
  const isExpired =
    rawStatus !== "completed" &&
    expiresAt instanceof Date &&
    !Number.isNaN(expiresAt.getTime()) &&
    expiresAt.getTime() < Date.now();

  return {
    status: rawStatus === "completed" ? "completed" : isExpired ? "expired" : rawStatus,
    isExpired,
    expiresAt,
  };
}

function normalizeInviteMailerFlag(value) {
  return ["1", "true", "yes", "on"].includes(
    String(value || "")
      .trim()
      .toLowerCase(),
  );
}

function getFirstEmailEnvValue(keys) {
  for (const key of keys) {
    const value = String(process.env[key] || "")
      .trim()
      .replace(/^['"]|['"]$/g, "");
    if (value) return value;
  }

  return "";
}

function getFirstEmailEnvRawValue(keys) {
  for (const key of keys) {
    if (process.env[key] == null) continue;

    const value = String(process.env[key])
      .trim()
      .replace(/^['"]|['"]$/g, "");
    if (value) return value;
  }

  return undefined;
}

function isLoopbackAppUrl(value = "") {
  const host = String(value || "")
    .trim()
    .replace(/^https?:\/\//, "")
    .split("/")[0]
    .split(":")[0]
    .toLowerCase();

  return isLoopbackHostValue(host);
}

function getPublicEmailBaseUrl() {
  const publicUrl = normalizeAppBaseUrl(process.env.PUBLIC_APP_URL || "");
  if (!publicUrl || isLoopbackAppUrl(publicUrl)) return "";
  return publicUrl;
}

function getResendEmailConfig() {
  const apiKey = getFirstEmailEnvValue(["RESEND_API_KEY"]);
  const from = getFirstEmailEnvValue([
    "EMAIL_FROM",
    "RESEND_EMAIL_FROM",
    "MAIL_FROM",
    "MAILER_FROM",
    "FROM_EMAIL",
  ]) || DEFAULT_RESEND_EMAIL_FROM;
  const publicAppUrl = getPublicEmailBaseUrl();
  const missingConfig = [
    !apiKey ? "RESEND_API_KEY" : "",
    !from ? "EMAIL_FROM" : "",
    !publicAppUrl ? "PUBLIC_APP_URL" : "",
  ].filter(Boolean);

  return {
    configured: missingConfig.length === 0,
    apiKey,
    from,
    publicAppUrl,
    missingConfig,
  };
}

function buildEmailMissingConfigMessage(missingConfig = []) {
  const suffix = missingConfig.length
    ? ` Missing server config: ${missingConfig.join(", ")}.`
    : "";

  return `Resend email service is not configured.${suffix}`;
}

function createResendConfigError(missingConfig = []) {
  const error = new Error(buildEmailMissingConfigMessage(missingConfig));
  error.code = "RESEND_NOT_CONFIGURED";
  error.missingConfig = missingConfig;
  return error;
}

function escapeProfileSetupEmailHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function normalizeProposalText(value) {
  return String(value || "").replace(/\r\n/g, "\n").trim();
}

function buildDefaultProposalContent({
  client_name,
  company_name,
  project_topic,
  requirement_details,
  budget,
  timeline,
  technology,
  notes,
}) {
  const projectTopic = String(project_topic || "Custom Software").trim();
  const clientName = String(client_name || "Client").trim();
  const companyName = String(company_name || clientName).trim();
  const selectedTechnology = String(technology || "Core PHP + MySQL").trim();
  const finalTimeline = String(timeline || "30 to 45 working days").trim();
  const budgetText = String(budget || "As per final discussion").trim();
  const requirementText = String(
    requirement_details || "As discussed with the client.",
  ).trim();
  const notesText = String(notes || "").trim();

  return normalizeProposalText(`
PROJECT PROPOSAL

Client Name: ${clientName}
Company Name: ${companyName}
Project Topic: ${projectTopic}

PROJECT OVERVIEW:
We propose to develop a customized ${projectTopic} system for ${companyName}. The solution will be planned around the client's daily workflow, reporting needs, user access levels, and future scalability.

CLIENT REQUIREMENT:
${requirementText}

MAIN MODULES:
1. Admin Panel
2. User Management
3. Client / Customer Management
4. Lead / Enquiry Management
5. Payment Management
6. Reports and Dashboard
7. Document Management
8. Settings and Access Control

ADMIN PANEL:
Admin will manage users, modules, clients, reports, payments, settings, and complete business visibility from one dashboard.

USER PANEL:
Team members will access only their assigned work, update records, view reminders, and maintain client communication history.

TECHNOLOGY STACK:
${selectedTechnology}

TIMELINE:
${finalTimeline}

PRICING:
${budgetText}

TERMS & CONDITIONS:
1. Final pricing and timeline will depend on confirmed requirements.
2. Any extra module or third-party integration will be estimated separately.
3. Project work will start after requirement confirmation and advance payment.
4. Content, branding assets, and required credentials will be provided by the client.
${notesText ? `\nNOTES:\n${notesText}` : ""}
`);
}

function applyProposalPlaceholders(content, data = {}) {
  let output = String(content || "");
  const replacements = {
    client_name: data.client_name,
    client_email: data.client_email,
    company_name: data.company_name,
    project_topic: data.project_topic,
    requirement_details: data.requirement_details,
    budget: data.budget,
    timeline: data.timeline,
    technology: data.technology,
    notes: data.notes,
  };

  Object.entries(replacements).forEach(([key, value]) => {
    output = output.split(`{{${key}}}`).join(String(value || ""));
  });

  return normalizeProposalText(output);
}

function isProposalContentHeading(text = "") {
  const trimmed = String(text || "").trim();
  return /^[A-Z0-9 &/.-]+:$/.test(trimmed) || /^PROJECT [A-Z0-9 &/.-]+$/.test(trimmed);
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
    proposal.created_by_name,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ");

  return (
    normalizeLoginCompanyKey(proposal.company_scope || proposal.created_by_company) === "redsea" ||
    /\bred\s*sea\b/.test(brandText) ||
    brandText.includes("redseadigitals")
  );
}

function getProposalLetterheadConfig(proposal = {}) {
  if (isRedSeaProposal(proposal)) {
    return {
      brandName: "Red Sea Digitals",
      headerPath: RED_SEA_PROPOSAL_LETTERHEAD_HEADER_PATH,
      footerPath: RED_SEA_PROPOSAL_LETTERHEAD_FOOTER_PATH,
      headerHeight: 105,
      footerHeight: 151,
      fallbackColor: "#b91c1c",
      headingColor: "#ff3045",
      footerFallbackLabel: "info@redseadigitals.com | +91 9310355211",
    };
  }

  return {
    brandName: "Metrics Mart",
    headerPath: PROPOSAL_LETTERHEAD_HEADER_PATH,
    footerPath: PROPOSAL_LETTERHEAD_FOOTER_PATH,
    headerHeight: 156,
    footerHeight: 156,
    fallbackColor: "#0f766e",
    headingColor: "#0f766e",
    footerFallbackLabel: "info@metricsmart.in | www.metricsmartinfoline.com",
  };
}

function renderProposalHtml(content, proposal = {}) {
  const letterhead = getProposalLetterheadConfig(proposal);

  return normalizeProposalText(content)
    .split(/\n{2,}/)
    .map((paragraph) => {
      const trimmedParagraph = paragraph.trim();
      const safeText = escapeProfileSetupEmailHtml(paragraph).replace(/\n/g, "<br>");
      if (isProposalContentHeading(trimmedParagraph)) {
        return `<p style="color:${letterhead.headingColor};font-weight:700;font-size:16px;letter-spacing:.02em;">${safeText}</p>`;
      }

      return `<p>${safeText}</p>`;
    })
    .join("\n");
}

function drawProposalLetterhead(doc, proposal = {}) {
  const letterhead = getProposalLetterheadConfig(proposal);
  const pageWidth = doc.page.width;
  const pageHeight = doc.page.height;
  const { headerHeight, footerHeight } = letterhead;
  const drawMissingStrip = (label, y, height, { showLabel = true } = {}) => {
    doc
      .save()
      .rect(0, y, pageWidth, height)
      .fill("#f8fafc")
      .restore();

    if (!showLabel) return;

    doc
      .save()
      .fillColor(letterhead.fallbackColor)
      .fontSize(10)
      .text(label, 52, y + 18, {
        width: pageWidth - 104,
        align: "center",
        lineBreak: false,
      })
      .restore();
  };

  try {
    if (fs.existsSync(letterhead.headerPath)) {
      const headerBuffer = fs.readFileSync(letterhead.headerPath);
      doc.image(headerBuffer, 0, 0, {
        width: pageWidth,
        height: headerHeight,
      });
    } else {
      console.error("Proposal header image missing:", letterhead.headerPath);
      drawMissingStrip(`${letterhead.brandName} Proposal Header`, 0, headerHeight);
    }
  } catch (err) {
    console.error(
      "Proposal header image failed:",
      err.message,
      letterhead.headerPath,
    );
    drawMissingStrip(`${letterhead.brandName} Proposal Header`, 0, headerHeight);
  }

  try {
    if (fs.existsSync(letterhead.footerPath)) {
      const footerBuffer = fs.readFileSync(letterhead.footerPath);
      doc.image(footerBuffer, 0, pageHeight - footerHeight, {
        width: pageWidth,
        height: footerHeight,
      });
    } else {
      console.error("Proposal footer image missing:", letterhead.footerPath);
      drawMissingStrip(
        letterhead.footerFallbackLabel,
        pageHeight - footerHeight,
        footerHeight,
        { showLabel: false },
      );
    }
  } catch (err) {
    console.error(
      "Proposal footer image failed:",
      err.message,
      letterhead.footerPath,
    );
    drawMissingStrip(
      letterhead.footerFallbackLabel,
      pageHeight - footerHeight,
      footerHeight,
      { showLabel: false },
    );
  }
}

function getProposalLetterheadDataUri(filePath) {
  try {
    if (!filePath || !fs.existsSync(filePath)) return "";
    const ext = path.extname(filePath).toLowerCase();
    const mimeType = ext === ".png" ? "image/png" : "image/jpeg";
    return `data:${mimeType};base64,${fs.readFileSync(filePath).toString("base64")}`;
  } catch (err) {
    console.error("Proposal letterhead data URI failed:", err.message, filePath);
    return "";
  }
}

function getProposalPdfContentWidth(doc) {
  return doc.page.width - doc.page.margins.left - doc.page.margins.right;
}

function getProposalPdfContentBottom(doc) {
  return doc.page.height - doc.page.margins.bottom;
}

function ensureProposalPdfSpace(doc, requiredHeight = 0) {
  const bottomY = getProposalPdfContentBottom(doc);
  if (doc.y + requiredHeight <= bottomY) return;

  doc.addPage();
}

function moveProposalPdfDown(doc, amount = 0.5) {
  const lineHeight = doc.currentLineHeight(true) * amount;
  ensureProposalPdfSpace(doc, lineHeight);
  doc.moveDown(amount);
}

function writeProposalPdfText(doc, text, style = {}) {
  const {
    fontSize = 10,
    color = "#111827",
    align = "left",
    lineGap = 3,
    gapAfter = 0,
    continued = false,
  } = style;
  const contentWidth = getProposalPdfContentWidth(doc);

  doc.fontSize(fontSize).fillColor(color);
  const textOptions = {
    width: contentWidth,
    align,
    lineGap,
    continued,
  };
  const estimatedHeight = doc.heightOfString(text, textOptions) + gapAfter;
  ensureProposalPdfSpace(doc, estimatedHeight);
  doc.fontSize(fontSize).fillColor(color);
  doc.text(text, doc.page.margins.left, doc.y, textOptions);

  if (gapAfter > 0) {
    ensureProposalPdfSpace(doc, gapAfter);
    doc.y += gapAfter;
  }
}

function createProposalPdfDocument() {
  return new PDFDocument({
    size: "A4",
    margins: {
      top: 178,
      bottom: 170,
      left: 52,
      right: 52,
    },
  });
}

function writeProposalPdfDocument(doc, proposal) {
  const letterhead = getProposalLetterheadConfig(proposal);

  drawProposalLetterhead(doc, proposal);
  doc.y = doc.page.margins.top;
  doc.on("pageAdded", () => {
    drawProposalLetterhead(doc, proposal);
    doc.y = doc.page.margins.top;
  });

  writeProposalPdfText(doc, proposal.project_topic || "Project Proposal", {
    fontSize: 18,
    color: "#0f172a",
    align: "center",
    lineGap: 4,
    gapAfter: 10,
  });
  writeProposalPdfText(doc, `Client: ${proposal.client_name || "-"}`, {
    fontSize: 10,
    color: "#475569",
    lineGap: 2,
  });
  writeProposalPdfText(doc, `Company: ${proposal.company_name || "-"}`, {
    fontSize: 10,
    color: "#475569",
    lineGap: 2,
  });
  writeProposalPdfText(doc, `Status: ${proposal.status || "draft"}`, {
    fontSize: 10,
    color: "#475569",
    lineGap: 2,
    gapAfter: 8,
  });

  normalizeProposalText(proposal.proposal_content)
    .split("\n")
    .forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed) {
        moveProposalPdfDown(doc, 0.5);
        return;
      }

      const isHeading = isProposalContentHeading(trimmed);
      writeProposalPdfText(doc, trimmed, {
        fontSize: isHeading ? 12 : 10,
        color: isHeading ? letterhead.headingColor : "#111827",
        lineGap: 3,
        gapAfter: isHeading ? 3 : 1,
      });
    });
}

function buildProposalPdfBuffer(proposal) {
  return new Promise((resolve, reject) => {
    const doc = createProposalPdfDocument();
    const chunks = [];

    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("error", reject);
    doc.on("end", () => resolve(Buffer.concat(chunks)));

    writeProposalPdfDocument(doc, proposal);
    doc.end();
  });
}

function getProfileSetupFormSections() {
  return [
    {
      title: "Identity & KYC",
      fields: ["Profile image", "Aadhar image", "Aadhar number", "PAN number", "PAN image"],
    },
    {
      title: "Bank Details",
      fields: ["Bank name", "Account number", "IFSC code", "Beneficiary name", "Cancelled cheque image"],
    },
    {
      title: "Joining & Documents",
      fields: ["Joining date", "Total experience", "Experience letter", "Resume", "Certification file"],
    },
    {
      title: "PF Details",
      fields: ["PF enabled", "PF number", "UAN number", "Employee PF amount", "Employer PF amount", "PF joining date"],
    },
    {
      title: "Skills",
      fields: ["Work skills"],
    },
    {
      title: "Attendance Face Setup",
      fields: ["Live face capture for attendance matching"],
    },
  ];
}

function buildProfileSetupFormSectionsHtml() {
  return getProfileSetupFormSections()
    .map(
      (section) => `
        <div style="border:1px solid #dbe8ec;border-radius:14px;padding:14px;background:#f8fbfc;">
          <h3 style="margin:0 0 10px;font-size:15px;color:#0f766e;">${escapeProfileSetupEmailHtml(section.title)}</h3>
          <ul style="margin:0;padding-left:18px;color:#475569;">
            ${section.fields
              .map((field) => `<li>${escapeProfileSetupEmailHtml(field)}</li>`)
              .join("")}
          </ul>
        </div>
      `,
    )
    .join("");
}

function buildProfileSetupFormSectionsText() {
  return getProfileSetupFormSections()
    .map((section) => `${section.title}: ${section.fields.join(", ")}`)
    .join("\n");
}

function buildProfileSetupInviteHtml(profileSetup, user) {
  const userName = String(user?.name || "Team Member").trim() || "Team Member";
  const invitationLink = String(profileSetup?.invitationLink || "").trim();
  const expiresOn = String(profileSetup?.expiresOn || "").trim();

  return `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111827;max-width:720px;margin:0 auto;padding:24px;background:#f1f8f8;">
      <div style="background:#ffffff;border:1px solid #dbe8ec;border-radius:18px;padding:24px;">
      <p style="margin:0 0 8px;font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#0f766e;">Metrics Mart</p>
      <h2 style="margin:0 0 16px;color:#0f172a;">Complete Your Employee Profile</h2>
      <p style="margin:0 0 12px;">Hi ${escapeProfileSetupEmailHtml(userName)},</p>
      <p style="margin:0 0 16px;">
        Please complete your remaining employee details using the link below. Keep the required documents ready before you start.
      </p>
      <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin:0 0 20px;">
        ${buildProfileSetupFormSectionsHtml()}
      </div>
      <p style="margin:0 0 20px;">
        <a
          href="${escapeProfileSetupEmailHtml(invitationLink)}"
          style="display:inline-block;background:#0f766e;color:#ffffff;text-decoration:none;padding:12px 18px;border-radius:8px;font-weight:600;"
        >
          Complete Profile
        </a>
      </p>
      <p style="margin:0 0 12px;word-break:break-all;">
        ${escapeProfileSetupEmailHtml(invitationLink)}
      </p>
      ${
        expiresOn
          ? `<p style="margin:0 0 16px;color:#475569;">This link expires on ${escapeProfileSetupEmailHtml(expiresOn)}.</p>`
          : ""
      }
      <p style="margin:0;">Regards,<br />Metrics Mart Admin</p>
      </div>
    </div>
  `;
}

function buildProfileSetupInvitePayload(req, user, token, expiresAt) {
  const invitationParams = new URLSearchParams({ token: String(token || "") });
  if (user?.id) {
    invitationParams.set("uid", String(user.id));
  }
  const invitationLink = `${getPublicEmailBaseUrl() || resolveAppBaseUrl(req)}/complete-profile.html?${invitationParams.toString()}`;
  const expiresOn = formatProfileSetupExpiryLabel(expiresAt);
  const subject = `Complete your Metrics Mart profile`;
  const bodyLines = [
    `Hi ${String(user?.name || "Team Member").trim() || "Team Member"},`,
    "",
    "Please complete your remaining employee details using the link below:",
    invitationLink,
    "",
    "Details required in the form:",
    buildProfileSetupFormSectionsText(),
    "",
    expiresOn ? `This link expires on ${expiresOn}.` : "",
    "",
    "Regards,",
    "Metrics Mart Admin",
  ].filter((line, index, allLines) => line || (index > 0 && allLines[index - 1]));
  const body = bodyLines.join("\n");

  return {
    invitationLink,
    expiresAt,
    expiresOn,
    email: user?.email || "",
    subject,
    body,
    mailtoUrl: `mailto:${encodeURIComponent(user?.email || "")}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`,
    gmailComposeUrl:
      `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(user?.email || "")}` +
      `&su=${encodeURIComponent(subject)}` +
      `&body=${encodeURIComponent(body)}`,
  };
}

async function sendProfileSetupInviteEmail(profileSetup, user) {
  const inviteEmail = String(profileSetup?.email || user?.email || "").trim();
  if (!inviteEmail) {
    return {
      sent: false,
      status: "skipped",
      message: "Employee email is missing. The profile form link is ready for manual sharing.",
    };
  }

  try {
    const result = await sendSecondFormLinkEmail(
      inviteEmail,
      profileSetup.invitationLink,
      {
        subject: profileSetup.subject,
        text: profileSetup.body,
        html: buildProfileSetupInviteHtml(profileSetup, user),
      },
    );

    return {
      sent: true,
      status: "sent",
      provider: "resend",
      messageId: result?.data?.id || result?.id || "",
      message: `Profile form email sent successfully to ${inviteEmail}.`,
    };
  } catch (error) {
    console.error("Second form link email send failed:", error);

    return {
      sent: false,
      status: error?.code === "RESEND_NOT_CONFIGURED" ? "not_configured" : "failed",
      provider: "resend",
      emailError: String(error?.name || error?.code || "RESEND_SEND_FAILED"),
      message:
        "Profile form email is ready to send. Please use the email button or open the email draft to send it.",
      missingConfig: Array.isArray(error?.missingConfig) ? error.missingConfig : [],
    };
  }
}

async function sendSecondFormLinkEmail(toEmail, formLink, options = {}) {
  const config = getResendEmailConfig();
  if (!config.configured) {
    throw createResendConfigError(config.missingConfig || []);
  }

  const recipients = normalizeResendRecipients(toEmail);
  if (!recipients.length) {
    const error = new Error("Recipient email is missing.");
    error.code = "RESEND_RECIPIENT_MISSING";
    throw error;
  }

  const normalizedFormLink = String(formLink || "").trim();
  const subject = String(options.subject || "Complete Your Second Form").trim();
  const html = String(options.html || `
      <h2>Complete Your Form</h2>
      <p>Please click the button below to complete your second form.</p>
      <a href="${escapeProfileSetupEmailHtml(normalizedFormLink)}" style="display:inline-block;padding:12px 20px;background:#2563eb;color:#ffffff;text-decoration:none;border-radius:6px;">
        Open Second Form
      </a>
      <p>If button does not work, copy this link:</p>
      <p>${escapeProfileSetupEmailHtml(normalizedFormLink)}</p>
    `);
  const text = String(options.text || `Complete your second form: ${normalizedFormLink}`);

  const result = await resend.emails.send({
    from: config.from,
    to: recipients,
    subject,
    html,
    text,
  });

  if (result?.error) {
    const error = new Error(getResendErrorMessage(result.error));
    error.name = result.error.name || "resend_error";
    error.code = result.error.statusCode || result.error.name || "RESEND_SEND_FAILED";
    throw error;
  }

  return result;
}

function normalizeProfileSetupEmailValue(value) {
  return String(value || "").trim().toLowerCase();
}

function formatProfileSetupEmailValue(value, fallback = "-") {
  if (value == null) return fallback;
  const normalized = String(value).trim();
  return normalized || fallback;
}

function formatProfileSetupAmount(value) {
  if (value == null || value === "") return "-";
  const amount = Number(value);
  if (!Number.isFinite(amount)) return formatProfileSetupEmailValue(value);
  return `Rs. ${amount.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatProfileSetupSkills(value) {
  const labels = {
    web: "Web",
    seo: "SEO",
    smo: "SMO",
    ads: "Ads",
    app: "App",
    erp_crm: "ERP/CRM",
  };
  let sourceValue = value;

  if (typeof sourceValue === "string") {
    const trimmed = sourceValue.trim();
    if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
      try {
        sourceValue = JSON.parse(trimmed);
      } catch (_err) {
        sourceValue = value;
      }
    }
  }

  const skills = parseProfileSkillsInput(sourceValue);
  return skills.length
    ? skills.map((skill) => labels[skill] || skill).join(", ")
    : "-";
}

function normalizeProfileSetupFilePath(filePath) {
  return String(filePath || "")
    .trim()
    .replace(/\\/g, "/")
    .replace(/^\/+/, "");
}

function buildProfileSetupFileUrl(req, filePath) {
  const normalizedPath = normalizeProfileSetupFilePath(filePath);
  if (!normalizedPath) return "";
  if (/^https?:\/\//i.test(normalizedPath)) return normalizedPath;
  return `${resolveAppBaseUrl(req)}/${normalizedPath}`;
}

function buildProfileSetupDetailRowsHtml(rows) {
  return rows
    .map(
      (row) => `
        <tr>
          <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;color:#64748b;font-size:13px;width:38%;">${escapeProfileSetupEmailHtml(row.label)}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;color:#0f172a;font-size:13px;font-weight:600;">${row.html || escapeProfileSetupEmailHtml(formatProfileSetupEmailValue(row.value))}</td>
        </tr>
      `,
    )
    .join("");
}

function buildProfileSetupSectionHtml(title, rows) {
  return `
    <h3 style="margin:22px 0 8px;color:#0f766e;font-size:16px;">${escapeProfileSetupEmailHtml(title)}</h3>
    <table style="width:100%;border-collapse:collapse;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;background:#ffffff;">
      <tbody>${buildProfileSetupDetailRowsHtml(rows)}</tbody>
    </table>
  `;
}

function buildProfileSetupDocumentRows(req, profile) {
  const primaryRows = [
    ["Profile image", profile.prof_img],
    ["Aadhar image", profile.aadhar_img],
    ["PAN image", profile.pan_img],
    ["Cancelled cheque image", profile.cancelled_cheque],
    ["Resume", profile.resume_file],
    ["Experience letter", profile.experience_file],
    ["Certification file", profile.certification_file],
  ];
  const otherRows = parseStoredDocumentList(profile.other_documents).map(
    (filePath, index) => [`Other document ${index + 1}`, filePath],
  );

  return [...primaryRows, ...otherRows].map(([label, filePath]) => {
    const fileUrl = buildProfileSetupFileUrl(req, filePath);
    return {
      label,
      value: filePath ? filePath : "-",
      url: fileUrl,
      html: fileUrl
        ? `<a href="${escapeProfileSetupEmailHtml(fileUrl)}" style="color:#0f766e;text-decoration:none;font-weight:700;">Open file</a><span style="color:#64748b;font-weight:400;"> - ${escapeProfileSetupEmailHtml(normalizeProfileSetupFilePath(filePath))}</span>`
        : "-",
    };
  });
}

function buildProfileSetupCompletionHtml(req, profile) {
  const userName = formatProfileSetupEmailValue(profile.name, "Employee");
  const completedAt = formatProfileSetupExpiryLabel(new Date());
  const pfEnabled = Number(profile.pf_enabled || 0) ? "Yes" : "No";

  return `
    <div style="font-family:Arial,sans-serif;line-height:1.55;color:#111827;max-width:760px;margin:0 auto;padding:24px;background:#f1f8f8;">
      <div style="background:#ffffff;border:1px solid #dbe8ec;border-radius:18px;padding:24px;">
        <p style="margin:0 0 8px;font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#0f766e;">Profile Submitted</p>
        <h2 style="margin:0 0 10px;color:#0f172a;">${escapeProfileSetupEmailHtml(userName)} completed the employee profile form</h2>
        <p style="margin:0 0 18px;color:#475569;">Submitted on ${escapeProfileSetupEmailHtml(completedAt)}. The details below are ready for admin and HR review.</p>

        ${buildProfileSetupSectionHtml("Employee", [
          { label: "Employee code", value: profile.employee_code },
          { label: "Name", value: profile.name },
          { label: "Email", value: profile.email },
          { label: "Contact", value: profile.contact },
          { label: "Role", value: String(profile.role || "").toUpperCase() },
          { label: "Company", value: profile.comp_name },
        ])}

        ${buildProfileSetupSectionHtml("Identity & KYC", [
          { label: "Aadhar number", value: profile.aadhar_no },
          { label: "PAN number", value: profile.pan_number || "-" },
        ])}

        ${buildProfileSetupSectionHtml("Bank Details", [
          { label: "Bank name", value: profile.bank_name },
          { label: "Account number", value: profile.account_no },
          { label: "IFSC code", value: profile.ifsc_code },
          { label: "Beneficiary name", value: profile.beneficiary_name },
        ])}

        ${buildProfileSetupSectionHtml("Joining & Experience", [
          { label: "Joining date", value: profile.joining_date },
          { label: "Total experience", value: profile.total_experience },
          { label: "Skills", value: formatProfileSetupSkills(profile.skills) },
        ])}

        ${buildProfileSetupSectionHtml("PF Details", [
          { label: "PF enabled", value: pfEnabled },
          { label: "PF number", value: Number(profile.pf_enabled || 0) ? profile.pf_number : "-" },
          { label: "UAN number", value: Number(profile.pf_enabled || 0) ? profile.uan_number : "-" },
          { label: "Employee PF amount", value: Number(profile.pf_enabled || 0) ? formatProfileSetupAmount(profile.employee_pf_amount) : "-" },
          { label: "Employer PF amount", value: Number(profile.pf_enabled || 0) ? formatProfileSetupAmount(profile.employer_pf_amount) : "-" },
          { label: "PF joining date", value: Number(profile.pf_enabled || 0) ? profile.pf_joining_date : "-" },
        ])}

        ${buildProfileSetupSectionHtml("Uploaded Documents", buildProfileSetupDocumentRows(req, profile))}
      </div>
    </div>
  `;
}

function buildProfileSetupCompletionText(req, profile) {
  const documentLines = buildProfileSetupDocumentRows(req, profile).map(
    (row) => `${row.label}: ${row.url || "-"}`,
  );

  return [
    `${formatProfileSetupEmailValue(profile.name, "Employee")} completed the employee profile form.`,
    "",
    `Employee code: ${formatProfileSetupEmailValue(profile.employee_code)}`,
    `Name: ${formatProfileSetupEmailValue(profile.name)}`,
    `Email: ${formatProfileSetupEmailValue(profile.email)}`,
    `Contact: ${formatProfileSetupEmailValue(profile.contact)}`,
    `Role: ${formatProfileSetupEmailValue(String(profile.role || "").toUpperCase())}`,
    `Company: ${formatProfileSetupEmailValue(profile.comp_name)}`,
    "",
    `Aadhar number: ${formatProfileSetupEmailValue(profile.aadhar_no)}`,
    `PAN number: ${formatProfileSetupEmailValue(profile.pan_number)}`,
    `Bank name: ${formatProfileSetupEmailValue(profile.bank_name)}`,
    `Account number: ${formatProfileSetupEmailValue(profile.account_no)}`,
    `IFSC code: ${formatProfileSetupEmailValue(profile.ifsc_code)}`,
    `Beneficiary name: ${formatProfileSetupEmailValue(profile.beneficiary_name)}`,
    `Joining date: ${formatProfileSetupEmailValue(profile.joining_date)}`,
    `Total experience: ${formatProfileSetupEmailValue(profile.total_experience)}`,
    `Skills: ${formatProfileSetupSkills(profile.skills)}`,
    `PF enabled: ${Number(profile.pf_enabled || 0) ? "Yes" : "No"}`,
    Number(profile.pf_enabled || 0)
      ? `PF number: ${formatProfileSetupEmailValue(profile.pf_number)}`
      : "",
    Number(profile.pf_enabled || 0)
      ? `UAN number: ${formatProfileSetupEmailValue(profile.uan_number)}`
      : "",
    Number(profile.pf_enabled || 0)
      ? `Employee PF amount: ${formatProfileSetupAmount(profile.employee_pf_amount)}`
      : "",
    Number(profile.pf_enabled || 0)
      ? `Employer PF amount: ${formatProfileSetupAmount(profile.employer_pf_amount)}`
      : "",
    Number(profile.pf_enabled || 0)
      ? `PF joining date: ${formatProfileSetupEmailValue(profile.pf_joining_date)}`
      : "",
    "",
    "Uploaded documents:",
    ...documentLines,
  ].filter((line) => line !== "").join("\n");
}

async function getProfileSetupCompletionRecipients(submittedUserId) {
  const configuredRecipients = String(
    process.env.PROFILE_SETUP_NOTIFY_EMAILS || process.env.HR_NOTIFY_EMAILS || "",
  )
    .split(",")
    .map(normalizeProfileSetupEmailValue)
    .filter(Boolean);

  const [rows] = await dbPromise.query(
    `
      SELECT email
      FROM users
      WHERE id <> ?
        AND LOWER(TRIM(COALESCE(role, ''))) IN ('admin', 'hr')
        AND TRIM(COALESCE(email, '')) <> ''
    `,
    [Number(submittedUserId || 0)],
  );

  return [
    ...new Set(
      rows
        .map((row) => normalizeProfileSetupEmailValue(row.email))
        .concat(configuredRecipients)
        .filter(Boolean),
    ),
  ];
}

async function sendProfileSetupCompletionEmail(req, profile) {
  const recipients = await getProfileSetupCompletionRecipients(profile?.id);
  if (!recipients.length) {
    return {
      sent: false,
      status: "skipped",
      message: "No admin or HR email recipient was found, but the profile details were saved.",
    };
  }

  const dispatch = await sendEmailViaApi({
    to: recipients,
    subject: `Employee profile submitted: ${formatProfileSetupEmailValue(profile?.name, "Employee")}`,
    text: buildProfileSetupCompletionText(req, profile),
    html: buildProfileSetupCompletionHtml(req, profile),
  });

  if (dispatch.sent) {
    return {
      sent: true,
      status: "sent",
      message: "Profile completion notification sent to Admin and HR.",
      provider: dispatch.provider || "resend",
      recipients,
    };
  }

  return {
    sent: false,
    status: dispatch.status || "failed",
    message: "Profile completion notification could not be sent, but the profile details were saved.",
    missingConfig: dispatch.missingConfig || [],
    emailError: dispatch.emailError || null,
  };
}

async function issueProfileSetupInvite(req, userId, email, name) {
  const { token, tokenHash, expiresAt } = generateProfileSetupTokenData();

  await dbPromise.query(
    `
      UPDATE users
      SET
        profile_setup_status = 'pending',
        profile_setup_token_hash = ?,
        profile_setup_expires_at = ?,
        profile_setup_sent_at = NOW()
      WHERE id = ?
      LIMIT 1
    `,
    [tokenHash, expiresAt, userId],
  );

  await rememberProfileSetupToken(userId, tokenHash, expiresAt);

  const payload = buildProfileSetupInvitePayload(
    req,
    {
      id: userId,
      email,
      name,
    },
    token,
    expiresAt,
  );

  const emailDispatch = await sendProfileSetupInviteEmail(payload, {
    id: userId,
    email,
    name,
  });

  return {
    ...payload,
    emailDispatch,
  };
}

function normalizeResendRecipients(value) {
  return (Array.isArray(value) ? value : [value])
    .map((email) => String(email || "").trim())
    .filter(Boolean);
}

function getResendErrorMessage(error) {
  const rawMessage =
    error?.message ||
    error?.response?.data?.message ||
    error?.response?.data?.error ||
    error?.error?.message ||
    "";
  return String(rawMessage || "Resend email request failed.").trim();
}

function getFirstEnvValue(keys = []) {
  for (const key of keys) {
    const value = String(process.env[key] || "").trim();
    if (value) return value;
  }

  return "";
}

function getWhatsappApiConfig() {
  const accessToken = getFirstEnvValue([
    "WHATSAPP_ACCESS_TOKEN",
    "WHATSAPP_API_TOKEN",
    "META_WHATSAPP_ACCESS_TOKEN",
    "META_WHATSAPP_API_TOKEN",
  ]);
  const phoneNumberId = getFirstEnvValue([
    "WHATSAPP_PHONE_NUMBER_ID",
    "META_WHATSAPP_PHONE_NUMBER_ID",
  ]);
  const apiVersion = getFirstEnvValue([
    "WHATSAPP_API_VERSION",
    "META_WHATSAPP_API_VERSION",
  ]) || "v20.0";

  return {
    configured: Boolean(accessToken && phoneNumberId),
    accessToken,
    phoneNumberId,
    apiVersion: apiVersion.replace(/^\/+|\/+$/g, ""),
    missingConfig: [
      !accessToken ? "WHATSAPP_ACCESS_TOKEN" : "",
      !phoneNumberId ? "WHATSAPP_PHONE_NUMBER_ID" : "",
    ].filter(Boolean),
  };
}

function normalizeWhatsappRecipientPhone(value) {
  let digits = String(value || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.length === 10) digits = `91${digits}`;
  if (digits.length === 11 && digits.startsWith("0")) digits = `91${digits.slice(1)}`;
  return digits;
}

async function sendProposalPdfViaWhatsapp(req, proposal, rawPhone) {
  const config = getWhatsappApiConfig();
  if (!config.configured) {
    const error = new Error(
      "Direct WhatsApp PDF send is not configured. Add WHATSAPP_ACCESS_TOKEN and WHATSAPP_PHONE_NUMBER_ID on the live server.",
    );
    error.statusCode = 503;
    error.missingConfig = config.missingConfig;
    throw error;
  }

  const to = normalizeWhatsappRecipientPhone(rawPhone);
  if (!to || to.length < 11 || to.length > 15) {
    const error = new Error("Valid WhatsApp number with country code is required.");
    error.statusCode = 400;
    throw error;
  }

  const companyLabel = String(
    proposal.company_name || proposal.client_name || `Proposal ${proposal.id}`,
  ).trim();
  const fileName = `proposal_${proposal.id}.pdf`;
  const pdfUrl = `${resolveAppBaseUrl(req)}/api/proposals/${proposal.id}/pdf`;
  const endpoint = `https://graph.facebook.com/${config.apiVersion}/${config.phoneNumberId}/messages`;

  await postJsonViaHttps(
    endpoint,
    {
      Authorization: `Bearer ${config.accessToken}`,
    },
    {
      messaging_product: "whatsapp",
      to,
      type: "document",
      document: {
        link: pdfUrl,
        filename: fileName,
        caption: `Project Proposal - ${companyLabel}`,
      },
    },
  );

  return {
    to,
    pdfUrl,
    fileName,
  };
}

function postJsonViaHttps(url, headers, payload, timeoutMs = 25000) {
  return new Promise((resolve, reject) => {
    let parsedUrl;
    try {
      parsedUrl = new URL(url);
    } catch (_err) {
      const error = new Error("Email API URL is invalid.");
      error.code = "EMAIL_API_BAD_URL";
      reject(error);
      return;
    }

    const body = JSON.stringify(payload);
    const request = https.request(
      {
        method: "POST",
        protocol: parsedUrl.protocol,
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || 443,
        path: `${parsedUrl.pathname}${parsedUrl.search}`,
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(body),
          ...headers,
        },
        timeout: timeoutMs,
      },
      (response) => {
        let responseBody = "";
        response.setEncoding("utf8");
        response.on("data", (chunk) => {
          responseBody += chunk;
        });
        response.on("end", () => {
          const statusCode = Number(response.statusCode || 0);
          let json = null;
          if (responseBody) {
            try {
              json = JSON.parse(responseBody);
            } catch (_err) {
              json = null;
            }
          }

          if (statusCode >= 200 && statusCode < 300) {
            resolve({ statusCode, body: responseBody, json });
            return;
          }

          const error = new Error(responseBody || `Email API request failed (${statusCode})`);
          error.statusCode = statusCode;
          error.responseBody = responseBody;
          error.responseJson = json;
          reject(error);
        });
      },
    );

    request.on("timeout", () => {
      request.destroy(Object.assign(new Error("Email API request timed out."), {
        code: "EMAIL_API_TIMEOUT",
      }));
    });
    request.on("error", reject);
    request.write(body);
    request.end();
  });
}

function normalizeEmailApiAttachments(value) {
  const source = Array.isArray(value) ? value : [];

  return source
    .map((attachment) => {
      const filename = String(attachment?.filename || attachment?.name || "").trim();
      const contentType =
        String(attachment?.contentType || attachment?.type || "").trim() ||
        "application/octet-stream";
      const content = attachment?.content ?? attachment?.buffer ?? "";
      let contentBase64 = "";

      if (Buffer.isBuffer(content)) {
        contentBase64 = content.toString("base64");
      } else if (content instanceof Uint8Array) {
        contentBase64 = Buffer.from(content).toString("base64");
      } else if (typeof content === "string") {
        const dataUriMatch = content.match(/^data:[^;]+;base64,(.+)$/);
        contentBase64 = dataUriMatch
          ? dataUriMatch[1]
          : Buffer.from(content).toString("base64");
      }

      if (!filename || !contentBase64) return null;

      return {
        filename,
        contentType,
        contentBase64,
      };
    })
    .filter(Boolean);
}

async function sendEmailViaApi(message) {
  const config = getResendEmailConfig();
  if (!config.configured) {
    console.error("Resend email config missing:", config.missingConfig);
    return {
      sent: false,
      status: "not_configured",
      missingConfig: config.missingConfig || [],
      message: buildEmailMissingConfigMessage(config.missingConfig || []),
    };
  }

  const recipients = normalizeResendRecipients(message?.to);
  if (!recipients.length) {
    return {
      sent: false,
      status: "skipped",
      provider: "resend",
      message: "Recipient email is missing.",
    };
  }

  try {
    const payload = {
      from: config.from,
      to: recipients,
      subject: String(message?.subject || "").trim(),
      text: String(message?.text || "").trim() || undefined,
      html: String(message?.html || "").trim() || undefined,
    };
    const attachments = normalizeEmailApiAttachments(message?.attachments);

    if (attachments.length) {
      payload.attachments = attachments.map((attachment) => ({
        filename: attachment.filename,
        content: attachment.contentBase64,
      }));
    }

    const result = await resend.emails.send(payload);
    if (result?.error) {
      const error = new Error(getResendErrorMessage(result.error));
      error.name = result.error.name || "resend_error";
      error.code = result.error.statusCode || result.error.name || "RESEND_SEND_FAILED";
      throw error;
    }

    return {
      sent: true,
      status: "sent",
      provider: "resend",
      messageId: result?.data?.id || result?.id || "",
      message: "Resend email sent successfully.",
    };
  } catch (error) {
    console.error("Resend email send failed:", error);
    return {
      sent: false,
      status: "failed",
      provider: "resend",
      emailError: String(error?.name || error?.code || "RESEND_SEND_FAILED"),
      message: getResendErrorMessage(error),
    };
  }
}

const paymentUploadsDir = path.join(__dirname, "uploads/payments");
if (!fs.existsSync(paymentUploadsDir)) {
  fs.mkdirSync(paymentUploadsDir, { recursive: true });
}

const paymentStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, paymentUploadsDir),
  filename: (req, file, cb) => {
    const uniqueName =
      "payment-" +
      Date.now() +
      "-" +
      Math.round(Math.random() * 1e9) +
      path.extname(file.originalname);
    cb(null, uniqueName);
  },
});

const uploadPayment = multer({
  storage: paymentStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed!"), false);
    }
  },
});

const projectPhaseUploadsDir = path.join(__dirname, "uploads/project-phases");
if (!fs.existsSync(projectPhaseUploadsDir)) {
  fs.mkdirSync(projectPhaseUploadsDir, { recursive: true });
}

const projectPhaseStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, projectPhaseUploadsDir),
  filename: (req, file, cb) => {
    const safeName = String(file.originalname || "file")
      .replace(/\.[^/.]+$/, "")
      .replace(/[^a-z0-9_-]+/gi, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 48) || "phase-file";
    const uniqueName = `phase-${Date.now()}-${Math.round(Math.random() * 1e9)}-${safeName}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  },
});

const projectPhaseFileExtensions = new Set([
  ".pdf",
  ".doc",
  ".docx",
  ".xls",
  ".xlsx",
  ".csv",
  ".tsv",
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
]);

const uploadProjectPhaseFiles = multer({
  storage: projectPhaseStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname || "").toLowerCase();
    if (projectPhaseFileExtensions.has(ext)) {
      cb(null, true);
    } else {
      cb(
        new Error(
          "Only PDF, DOC, DOCX, XLS, XLSX, CSV, TSV, PNG, JPG, JPEG and WEBP files are allowed.",
        ),
        false,
      );
    }
  },
});

const leaveUploadsDir = path.join(__dirname, "uploads/leaves");
if (!fs.existsSync(leaveUploadsDir)) {
  fs.mkdirSync(leaveUploadsDir, { recursive: true });
}

const leaveStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, leaveUploadsDir),
  filename: (req, file, cb) => {
    const safeName = String(file.originalname || "leave-file")
      .replace(/\.[^/.]+$/, "")
      .replace(/[^a-z0-9_-]+/gi, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 48) || "leave-file";
    const uniqueName = `leave-${Date.now()}-${Math.round(Math.random() * 1e9)}-${safeName}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  },
});

const leaveFileExtensions = new Set([
  ".pdf",
  ".doc",
  ".docx",
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
]);

const uploadLeave = multer({
  storage: leaveStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname || "").toLowerCase();
    if (leaveFileExtensions.has(ext)) {
      cb(null, true);
    } else {
      cb(
        new Error(
          "Only PDF, DOC, DOCX, PNG, JPG, JPEG and WEBP files are allowed.",
        ),
        false,
      );
    }
  },
});

const leaveAttachmentFieldNames = [
  "attachment",
  "leave_attachment",
  "leaveAttachment",
  "file",
  "document",
];

const uploadLeaveAttachment = uploadLeave.fields(
  leaveAttachmentFieldNames.map((fieldName) => ({
    name: fieldName,
    maxCount: 1,
  })),
);

// ====================== DATABASE CONNECTION ======================

function getDatabaseConfig() {
  const databaseUrl =
    process.env.DATABASE_URL ||
    process.env.MYSQL_PUBLIC_URL ||
    process.env.MYSQL_URL;

  if (databaseUrl) {
    return databaseUrl;
  }

  return {
    host:
      process.env.DB_HOST ||
      process.env.MYSQLHOST ||
      process.env.MYSQL_HOST ||
      process.env.MYSQL_ADDON_HOST ||
      "localhost",
    user:
      process.env.DB_USER ||
      process.env.MYSQLUSER ||
      process.env.MYSQL_USER ||
      process.env.MYSQL_ADDON_USER ||
      "root",
    password:
      process.env.DB_PASSWORD ||
      process.env.MYSQLPASSWORD ||
      process.env.MYSQL_PASSWORD ||
      process.env.MYSQL_ADDON_PASSWORD ||
      "root",
    database:
      process.env.DB_NAME ||
      process.env.MYSQLDATABASE ||
      process.env.MYSQL_DATABASE ||
      process.env.MYSQL_ADDON_DB ||
      "mm_new",
    port: Number(
      process.env.DB_PORT ||
        process.env.MYSQLPORT ||
        process.env.MYSQL_PORT ||
        process.env.MYSQL_ADDON_PORT ||
        3306,
    ),
    waitForConnections: true,
    connectionLimit: Number(process.env.DB_CONNECTION_LIMIT || 10),
    queueLimit: 0,
    timezone: APP_DB_TIMEZONE,
  };
}

const db = mysql.createPool(getDatabaseConfig());
const dbPromise = db.promise();

function parseNestedJson(value) {
  let parsed = value;

  while (typeof parsed === "string") {
    const trimmed = parsed.trim();
    if (!trimmed) return "";

    try {
      parsed = JSON.parse(trimmed);
    } catch (err) {
      return trimmed;
    }
  }

  return parsed;
}

function normalizeValueList(value) {
  const parsed = parseNestedJson(value);

  if (Array.isArray(parsed)) {
    return parsed
      .map((item) => String(item || "").trim())
      .filter(Boolean);
  }

  if (parsed == null) return [];

  const text = String(parsed).trim();
  return text ? [text] : [];
}

function formatHumanLabel(value) {
  return String(value || "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function normalizeProjectPhaseAttachments(value) {
  const parsed = parseNestedJson(value);
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

function serializeProjectPhaseAttachments(value) {
  const attachments = normalizeProjectPhaseAttachments(value);
  return attachments.length ? JSON.stringify(attachments) : null;
}

function pushWhatsappLine(lines, label, value) {
  const text = String(value || "").trim();
  if (!text) return;
  lines.push(`${label}: ${text}`);
}

function formatLeadAddress(lead) {
  return [
    lead.flat_no,
    lead.building_name,
    lead.locality,
    lead.city,
    lead.pincode,
    lead.state,
  ]
    .map((item) => String(item || "").trim())
    .filter(Boolean)
    .join(", ");
}

function getLeadServiceLines(lead) {
  const lines = [];
  const pushGroup = (label, values) => {
    const list = normalizeValueList(values);
    if (!list.length) return;
    lines.push(`${label}: ${list.map(formatHumanLabel).join(", ")}`);
  };

  pushGroup("Web", lead.web_type);
  pushGroup("SEO", lead.seo_type);
  pushGroup("SMO", lead.smo_type);
  pushGroup("App", lead.app_type);
  pushGroup("ERP/CRM", lead.erp_type);

  const otherServices = normalizeValueList(lead.services);
  const hasAds = otherServices.some((item) =>
    normalizeProjectServiceKey(item).includes("ads"),
  );

  if (hasAds) {
    lines.push("Ads: Google Ads");
  }

  const remainingServices = otherServices.filter(
    (item) => normalizeProjectServiceKey(item) !== "ads",
  );
  if (remainingServices.length) {
    lines.push(
      `Other Services: ${remainingServices.map(formatHumanLabel).join(", ")}`,
    );
  }

  return lines;
}

function normalizeWhatsappPhone(value) {
  const digits = String(value || "").replace(/\D/g, "");

  if (!digits) return "";
  if (digits.length === 10) return `91${digits}`;
  if (digits.length === 11 && digits.startsWith("0")) return `91${digits.slice(1)}`;
  return digits;
}

async function resolveAssignedEmployeeDetails({
  assignEmpId,
  assignEmpName,
  assignEmpContact,
}) {
  let employee = null;

  if (assignEmpId) {
    const [rows] = await dbPromise.query(
      `SELECT id, name, contact FROM users WHERE id = ? AND LOWER(role) = 'me' LIMIT 1`,
      [assignEmpId],
    );
    employee = rows[0] || null;
  }

  if (!employee && assignEmpName) {
    const [rows] = await dbPromise.query(
      `SELECT id, name, contact FROM users WHERE name = ? AND LOWER(role) = 'me' ORDER BY id DESC LIMIT 1`,
      [assignEmpName],
    );
    employee = rows[0] || null;
  }

  return {
    id: employee?.id || assignEmpId || null,
    name: employee?.name || assignEmpName || "",
    contact: employee?.contact || assignEmpContact || "",
  };
}

async function buildLeadWhatsappPayload(lead, mode = "create") {
  const employee = await resolveAssignedEmployeeDetails({
    assignEmpId: lead.assign_emp_id,
    assignEmpName: lead.assign_emp,
    assignEmpContact: lead.assign_emp_contact,
  });
  const phone = normalizeWhatsappPhone(employee.contact);

  if (!employee.name) return null;

  if (!phone) {
    return {
      employeeName: employee.name,
      warning:
        "Client save ho gaya, lekin assigned ME ka WhatsApp number available nahi mila.",
    };
  }

  const actionType = String(lead.action_type || lead.actionType || "")
    .toLowerCase()
    .trim();
  const headline =
    mode === "appointment"
      ? "Client appointment assigned"
      : mode === "update"
        ? "Client details updated"
        : "New client assigned";
  const address = formatLeadAddress(lead);
  const serviceLines = getLeadServiceLines(lead);
  const lines = [headline, ""];

  pushWhatsappLine(lines, "ME", employee.name);
  pushWhatsappLine(lines, "Company", lead.company || lead.company_name);
  pushWhatsappLine(lines, "Client", lead.client || lead.client_name);
  pushWhatsappLine(lines, "Primary Contact", lead.contact);
  pushWhatsappLine(lines, "Alternate Contact", lead.alt_contact || lead.alternate_contact);
  pushWhatsappLine(lines, "Telephone", lead.telephone);
  pushWhatsappLine(lines, "Email", lead.email);
  pushWhatsappLine(lines, "Sales Type", normalizeLeadSalesType(lead.sales_type));
  pushWhatsappLine(lines, "Source", lead.source_lead);
  pushWhatsappLine(lines, "Industry", lead.industry_type);
  pushWhatsappLine(lines, "Address", address);
  pushWhatsappLine(lines, "Maps", lead.maps_lnk);

  if (serviceLines.length) {
    lines.push("Services:");
    serviceLines.forEach((line) => lines.push(`- ${line}`));
  }

  pushWhatsappLine(lines, "Service Notes", lead.service_notes);

  if (actionType === "appointment") {
    pushWhatsappLine(lines, "Appointment Date", lead.app_date);
    pushWhatsappLine(lines, "Appointment Time", lead.app_time);
    pushWhatsappLine(lines, "Meeting Location", lead.location);
  }

  if (actionType === "followup") {
    pushWhatsappLine(lines, "Follow Up Date", lead.follow_date);
    pushWhatsappLine(lines, "Follow Up Time", lead.follow_time);
    pushWhatsappLine(lines, "Follow Up Reason", lead.reason);
  }

  pushWhatsappLine(lines, "Additional Notes", lead.additional_notes);
  pushWhatsappLine(lines, "Added By", lead.created_by_name);

  const messageText = lines.join("\n");

  return {
    employeeName: employee.name,
    phone,
    url: `https://wa.me/${phone}?text=${encodeURIComponent(messageText)}`,
    message: `${employee.name} ke WhatsApp brief draft khul gaya.`,
  };
}

function hasProjectServiceValue(value) {
  const parsed = parseNestedJson(value);

  if (Array.isArray(parsed)) return parsed.length > 0;
  if (typeof parsed === "string") return parsed.trim() !== "";

  return Boolean(parsed);
}

function getProjectServicesText(services) {
  const parsed = parseNestedJson(services);

  if (Array.isArray(parsed)) {
    return parsed.map((item) => String(item).toLowerCase()).join(", ");
  }

  return typeof parsed === "string" ? parsed.toLowerCase() : "";
}

function normalizeProjectServiceKey(serviceType) {
  const value = String(serviceType || "").toLowerCase().trim();

  if (!value) return "";
  if (value.includes("seo")) return "seo";
  if (value.includes("smo")) return "smo";
  if (value.includes("ads")) return "ads";
  if (value.includes("app")) return "app";
  if (value.includes("erp") || value.includes("crm")) return "erp";
  if (value.includes("web")) return "web";

  return value;
}

function getProjectServiceList(lead) {
  const services = [];
  const serviceKeys = new Set();
  const servicesText = [
    getProjectServicesText(lead.services),
    String(lead.service_notes || "").toLowerCase(),
  ]
    .filter(Boolean)
    .join(", ");

  const pushService = (key) => {
    if (!key || serviceKeys.has(key)) return;
    serviceKeys.add(key);
    services.push({
      key,
      label: PROJECT_SERVICE_LABELS[key] || key.toUpperCase(),
    });
  };

  if (hasProjectServiceValue(lead.web_type) || servicesText.includes("web")) {
    pushService("web");
  }

  if (hasProjectServiceValue(lead.seo_type) || servicesText.includes("seo")) {
    pushService("seo");
  }

  if (
    hasProjectServiceValue(lead.smo_type) ||
    servicesText.includes("smo") ||
    servicesText.includes("social media")
  ) {
    pushService("smo");
  }

  if (servicesText.includes("ads") || servicesText.includes("google ads")) {
    pushService("ads");
  }

  if (hasProjectServiceValue(lead.app_type) || servicesText.includes("app")) {
    pushService("app");
  }

  if (
    hasProjectServiceValue(lead.erp_type) ||
    servicesText.includes("erp") ||
    servicesText.includes("crm")
  ) {
    pushService("erp");
  }

  return services;
}

function getProjectPhaseWorkflow(serviceType) {
  const normalizedService = normalizeProjectServiceKey(serviceType);

  if (normalizedService === "crm") {
    return PROJECT_PHASE_WORKFLOWS.erp;
  }

  return (
    PROJECT_PHASE_WORKFLOWS[normalizedService] || PROJECT_PHASE_WORKFLOWS.web
  );
}

function normalizeProjectPhaseStatus(value, fallback = "pending") {
  const status = String(value || "")
    .toLowerCase()
    .trim();

  return PROJECT_PHASE_STATUS_VALUES.has(status) ? status : fallback;
}

function clampProjectProgress(value, fallback = 0) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(0, Math.min(Math.round(numeric), 100));
}

function cleanProjectPhaseText(value, maxLength = 4000) {
  const text = String(value || "").trim();
  if (!text) return null;
  return text.slice(0, maxLength);
}

function cleanProjectPhaseLink(value) {
  const text = String(value || "").trim();
  if (!text) return null;
  return text.slice(0, 500);
}

function cleanProjectPhaseDate(value) {
  const text = String(value || "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null;
}

function normalizeProjectAssignmentStatus(value, fallback = "assigned") {
  const status = String(value || "")
    .toLowerCase()
    .trim();

  return ["assigned", "ongoing", "completed"].includes(status)
    ? status
    : fallback;
}

function normalizeProjectPhaseKey(serviceType, phaseValue) {
  const workflow = getProjectPhaseWorkflow(serviceType);
  const phaseKey = String(phaseValue || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  const legacyPhaseMap = {
    web: {
      deployment: "launch",
    },
    app: {
      design: "ui_ux",
      testing: "qa",
      deployment: "release",
    },
    erp: {
      crm: "module_mapping",
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
      reporting: "reporting",
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
      reporting: "reporting",
    },
  };

  const workflowKey = normalizeProjectServiceKey(serviceType) || "web";
  const mappedKey = legacyPhaseMap[workflowKey]?.[phaseKey] || phaseKey;

  return workflow.some((phase) => phase.key === mappedKey)
    ? mappedKey
    : workflow[0]?.key || null;
}

function buildProjectPhaseRows(serviceType, phaseRows = [], assignmentSnapshot = null) {
  const workflow = getProjectPhaseWorkflow(serviceType);
  const rowMap = new Map(
    phaseRows
      .map((row) => [normalizeProjectPhaseKey(serviceType, row.phase_key), row])
      .filter(([phaseKey]) => Boolean(phaseKey)),
  );
  const hasStoredRows = rowMap.size > 0;
  const normalizedStage = normalizeProjectPhaseKey(
    serviceType,
    assignmentSnapshot?.stage,
  );
  const stageIndex = workflow.findIndex((phase) => phase.key === normalizedStage);
  const assignmentStatus = String(assignmentSnapshot?.status || "assigned")
    .toLowerCase()
    .trim();
  const assignmentProgress = clampProjectProgress(
    assignmentSnapshot?.progress,
    assignmentStatus === "completed" ? 100 : 0,
  );

  return workflow.map((phase, index) => {
    const stored = rowMap.get(phase.key) || {};
    const fallbackStatus = hasStoredRows
      ? "pending"
      : assignmentStatus === "completed"
        ? "completed"
        : assignmentStatus === "ongoing" && stageIndex > -1
          ? index < stageIndex
            ? "completed"
            : index === stageIndex
              ? "ongoing"
              : "pending"
          : "pending";
    const status = normalizeProjectPhaseStatus(
      stored.status,
      fallbackStatus,
    );
    const fallbackProgress = hasStoredRows
      ? status === "completed"
        ? 100
        : 0
      : status === "completed"
        ? 100
        : status === "ongoing" && index === stageIndex
          ? assignmentProgress
          : 0;
    const progress = clampProjectProgress(
      stored.progress,
      fallbackProgress,
    );

    return {
      phase_key: phase.key,
      phase_label: phase.label,
      status,
      progress: status === "completed" ? 100 : progress,
      start_date: stored.start_date || null,
      due_date: stored.due_date || null,
      notes: stored.notes || "",
      blockers: stored.blockers || "",
      deliverable_link: stored.deliverable_link || "",
      attachments: normalizeProjectPhaseAttachments(stored.attachments_json),
      updated_at: stored.updated_at || null,
    };
  });
}

function summarizeProjectPhaseRows(phases = []) {
  if (!Array.isArray(phases) || phases.length === 0) {
    return {
      stage: null,
      progress: 0,
      status: "assigned",
    };
  }

  const normalized = phases.map((phase, index) => {
    const status = normalizeProjectPhaseStatus(
      phase.status,
      index === 0 ? "pending" : "pending",
    );
    const progress = clampProjectProgress(
      phase.progress,
      status === "completed" ? 100 : status === "pending" ? 0 : 0,
    );
    const hasContent = Boolean(
      cleanProjectPhaseText(phase.notes) ||
        cleanProjectPhaseText(phase.blockers) ||
        cleanProjectPhaseLink(phase.deliverable_link) ||
        normalizeProjectPhaseAttachments(phase.attachments).length ||
        phase.start_date ||
        phase.due_date ||
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

  const totalProgress =
    normalized.reduce((sum, phase) => sum + Number(phase.progress || 0), 0) /
    normalized.length;
  const allCompleted = normalized.every(
    (phase) => normalizeProjectPhaseStatus(phase.status) === "completed",
  );
  const anyStarted = normalized.some((phase) => phase.hasContent);
  const firstPendingLike = normalized.find(
    (phase) => normalizeProjectPhaseStatus(phase.status) !== "completed",
  );
  const fallbackPhase = normalized[normalized.length - 1];

  return {
    stage: (firstPendingLike || fallbackPhase)?.phase_key || null,
    progress: allCompleted ? 100 : clampProjectProgress(totalProgress, 0),
    status: allCompleted ? "completed" : anyStarted ? "ongoing" : "assigned",
  };
}

function getProjectAssignmentStageLabel(serviceType, stageValue, phases = []) {
  const normalizedStage = normalizeProjectPhaseKey(serviceType, stageValue);
  const matchedPhase = phases.find(
    (phase) => phase.phase_key === normalizedStage,
  );

  if (matchedPhase?.phase_label) {
    return matchedPhase.phase_label;
  }

  return getProjectPhaseWorkflow(serviceType)[0]?.label || "Not started";
}

function summarizeProjectTrackerAssignments(assignments = []) {
  const counts = {
    assigned: 0,
    ongoing: 0,
    completed: 0,
    total: assignments.length,
  };

  assignments.forEach((assignment) => {
    const status = normalizeProjectAssignmentStatus(assignment.status);
    counts[status] = (counts[status] || 0) + 1;
  });

  let status = "unassigned";

  if (assignments.length) {
    if (assignments.every((assignment) => assignment.status === "completed")) {
      status = "completed";
    } else if (assignments.some((assignment) => assignment.status === "ongoing")) {
      status = "ongoing";
    } else if (assignments.some((assignment) => assignment.status === "assigned")) {
      status = "assigned";
    } else {
      status = "ongoing";
    }
  }

  const progress = assignments.length
    ? clampProjectProgress(
        assignments.reduce(
          (sum, assignment) => sum + Number(assignment.progress || 0),
          0,
        ) / assignments.length,
        0,
      )
    : 0;

  return {
    status,
    progress,
    counts,
  };
}

async function fetchProjectTrackerData(scope, userId = null, companyScope = "") {
  const normalizedScope = String(scope || "admin")
    .toLowerCase()
    .trim();
  const normalizedUserId = Number(userId);

  const whereParts = [
    "EXISTS (SELECT 1 FROM project_assignments pa_scope WHERE pa_scope.project_id = l.id)",
  ];
  const params = [];

  const companyScopeSql = getCompanyLeadScopeSql(companyScope, "l");
  if (companyScopeSql) {
    whereParts.push(companyScopeSql);
  }

  if (normalizedScope === "me") {
    whereParts.push("l.assign_emp_id = ?");
    params.push(normalizedUserId);
  } else if (normalizedScope === "tme") {
    whereParts.push("l.created_by = ?");
    params.push(normalizedUserId);
  } else if (normalizedScope !== "admin") {
    throw new Error("Invalid project tracker scope");
  }

  const [projectRows] = await dbPromise.query(
    `
      SELECT
        l.id AS project_id,
        l.company_name AS projectName,
        l.client_name AS client,
        l.telephone AS clientContact,
        l.alternate_contact AS clientAlternateContact,
        l.telephone AS clientTelephone,
        l.email AS clientEmail,
        l.maps_lnk AS clientMapsLink,
        l.services,
        l.web_type,
        l.seo_type,
        l.smo_type,
        l.app_type,
        l.erp_type,
        l.closed_date,
        l.created_at,
        l.created_by,
        l.assign_emp_id,
        creator.name AS createdByName,
        assigned_me.name AS assignedMeName
      FROM leads l
      LEFT JOIN users creator ON creator.id = l.created_by
      LEFT JOIN users assigned_me ON assigned_me.id = l.assign_emp_id
      WHERE ${whereParts.join(" AND ")}
      ORDER BY COALESCE(l.closed_date, l.created_at) DESC, l.id DESC
    `,
    params,
  );

  if (!projectRows.length) {
    return {
      counts: {
        total: 0,
        assigned: 0,
        ongoing: 0,
        completed: 0,
        unassigned: 0,
      },
      assignmentCounts: {
        total: 0,
        assigned: 0,
        ongoing: 0,
        completed: 0,
      },
      data: [],
    };
  }

  const projectIds = projectRows.map((row) => row.project_id);
  const [assignmentRows] = await dbPromise.query(
    `
      SELECT
        pa.id AS assignment_id,
        pa.project_id,
        pa.user_id,
        pa.service_type,
        pa.status,
        pa.stage,
        pa.progress,
        pa.assigned_at,
        assignee.name AS assigneeName,
        assignee.role AS assigneeRole
      FROM project_assignments pa
      LEFT JOIN users assignee ON assignee.id = pa.user_id
      WHERE pa.project_id IN (?)
      ORDER BY pa.project_id DESC, pa.assigned_at DESC, pa.id DESC
    `,
    [projectIds],
  );

  const assignmentIds = assignmentRows.map((row) => row.assignment_id);
  let phaseRows = [];

  if (assignmentIds.length > 0) {
    const [rows] = await dbPromise.query(
      `
        SELECT
          id,
          assignment_id,
          phase_key,
          status,
          progress,
          start_date,
          due_date,
          notes,
          blockers,
          deliverable_link,
          attachments_json,
          updated_at
        FROM project_phase_details
        WHERE assignment_id IN (?)
        ORDER BY assignment_id ASC, id ASC
      `,
      [assignmentIds],
    );
    phaseRows = rows;
  }

  const sharedStateIndex = buildProjectAssignmentSharedStateIndex(
    assignmentRows,
    phaseRows,
  );

  const assignmentsByProject = new Map();
  const assignmentCounts = {
    total: 0,
    assigned: 0,
    ongoing: 0,
    completed: 0,
  };

  assignmentRows.forEach((row) => {
    const sharedState = sharedStateIndex.get(Number(row.assignment_id || 0));
    const phases = sharedState?.phases || buildProjectPhaseRows(
      row.service_type,
      [],
      row,
    );
    const phaseSummary =
      sharedState?.summary || summarizeProjectPhaseRows(phases);
    const status = normalizeProjectAssignmentStatus(
      sharedState?.status,
      row.status || phaseSummary.status,
    );
    const progress = clampProjectProgress(
      sharedState?.progress,
      row.progress ?? phaseSummary.progress,
    );
    const stage = sharedState?.stage || row.stage || phaseSummary.stage;
    const blockedCount = phases.filter((phase) => phase.status === "blocked").length;
    const completedPhases = phases.filter(
      (phase) => phase.status === "completed",
    ).length;

    const assignment = {
      assignment_id: row.assignment_id,
      project_id: row.project_id,
      user_id: row.user_id,
      serviceType: row.service_type,
      serviceLabel:
        PROJECT_SERVICE_LABELS[normalizeProjectServiceKey(row.service_type)] ||
        String(row.service_type || "").toUpperCase(),
      assigneeName: row.assigneeName || "Unassigned",
      assigneeRole: row.assigneeRole || "",
      status,
      stage,
      stageLabel: getProjectAssignmentStageLabel(
        row.service_type,
        stage,
        phases,
      ),
      progress,
      assigned_at: row.assigned_at,
      phases,
      blockedCount,
      completedPhases,
      totalPhases: phases.length,
      lastUpdatedAt: sharedState?.lastUpdatedAt || row.assigned_at || null,
    };

    assignmentCounts.total += 1;
    assignmentCounts[status] = (assignmentCounts[status] || 0) + 1;

    if (!assignmentsByProject.has(row.project_id)) {
      assignmentsByProject.set(row.project_id, []);
    }
    assignmentsByProject.get(row.project_id).push(assignment);
  });

  const counts = {
    total: 0,
    assigned: 0,
    ongoing: 0,
    completed: 0,
    unassigned: 0,
  };

  const data = projectRows.map((project) => {
    const expectedServices = getProjectServiceList(project);
    const assignments = assignmentsByProject.get(project.project_id) || [];
    const projectSummary = summarizeProjectTrackerAssignments(assignments);
    const closedAt = project.closed_date || project.created_at || null;

    counts.total += 1;
    counts[projectSummary.status] = (counts[projectSummary.status] || 0) + 1;

    return {
      project_id: project.project_id,
      projectName: project.projectName,
      client: project.client,
      clientContact: project.clientContact || "",
      clientAlternateContact: project.clientAlternateContact || "",
      clientTelephone: project.clientTelephone || "",
      clientEmail: project.clientEmail || "",
      clientMapsLink: project.clientMapsLink || "",
      created_by: project.created_by,
      createdByName: project.createdByName || "",
      assign_emp_id: project.assign_emp_id,
      assignedMeName: project.assignedMeName || "",
      closed_date: closedAt,
      services: expectedServices,
      status: projectSummary.status,
      progress: projectSummary.progress,
      assignmentCounts: projectSummary.counts,
      assignments,
    };
  });

  return {
    counts,
    assignmentCounts,
    data,
  };
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function getAlterTableName(sql = "") {
  const match = String(sql).match(/ALTER\s+TABLE\s+`?([a-zA-Z0-9_]+)`?/i);
  return match ? match[1] : "";
}

function getAddColumnName(sql = "") {
  const match = String(sql).match(/ADD\s+COLUMN\s+`?([a-zA-Z0-9_]+)`?/i);
  return match ? match[1] : "";
}

async function schemaColumnExists(tableName, columnName, connection = dbPromise) {
  if (!tableName || !columnName) return false;

  const [rows] = await connection.query(
    `
      SELECT 1
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = ?
        AND COLUMN_NAME = ?
      LIMIT 1
    `,
    [tableName, columnName],
  );

  return rows.length > 0;
}

async function getSchemaColumnInfo(tableName, columnName, connection = dbPromise) {
  if (!tableName || !columnName) return null;

  const [rows] = await connection.query(
    `
      SELECT COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = ?
        AND COLUMN_NAME = ?
      LIMIT 1
    `,
    [tableName, columnName],
  );

  return rows[0] || null;
}

function quoteDbIdentifier(identifier) {
  return `\`${String(identifier || "").replace(/`/g, "``")}\``;
}

async function getFirstExistingColumn(tableName, candidates = []) {
  for (const candidate of candidates) {
    if (await schemaColumnExists(tableName, candidate)) {
      return candidate;
    }
  }

  return "";
}

async function getAttendanceTableDateColumn() {
  return (
    (await getFirstExistingColumn("attendance", [
      "attendance_date",
      "date",
      "attendanceDate",
      "attendance_day",
    ])) || "attendance_date"
  );
}

async function getAttendanceLocationRequestDateColumn() {
  return (
    (await getFirstExistingColumn("attendance_location_requests", [
      "attendance_date",
      "date",
      "attendanceDate",
      "request_date",
    ])) || "attendance_date"
  );
}

async function runSchemaChange(sql, duplicateCode) {
  const tableName = getAlterTableName(sql);
  const addColumnName = getAddColumnName(sql);
  const schemaLockKey = tableName
    ? `metrics_mart_schema_${tableName}`
    : `metrics_mart_schema_${crypto
        .createHash("sha1")
        .update(String(sql))
        .digest("hex")
        .slice(0, 24)}`;
  const maxAttempts = 8;
  let lastError = null;

  if (addColumnName) {
    try {
      if (await schemaColumnExists(tableName, addColumnName)) return;
    } catch (err) {
      console.error("Schema column pre-check failed:", err.message);
    }
  }

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    let connection = null;
    let hasSchemaLock = false;
    let shouldRetry = false;
    let retryDelay = 0;

    try {
      connection = await dbPromise.getConnection();

      const [lockRows] = await connection.query(
        "SELECT GET_LOCK(?, 20) AS lock_status",
        [schemaLockKey],
      );
      hasSchemaLock = Number(lockRows?.[0]?.lock_status || 0) === 1;
      if (!hasSchemaLock) {
        const lockError = new Error("Timed out waiting for schema migration lock");
        lockError.code = "ER_LOCK_WAIT_TIMEOUT";
        throw lockError;
      }

      if (addColumnName && (await schemaColumnExists(tableName, addColumnName, connection))) {
        return;
      }

      await connection.query(sql);
      return;
    } catch (err) {
      lastError = err;
      if (err.code === duplicateCode) return;

      if (
        attempt < maxAttempts &&
        [
          "ER_LOCK_DEADLOCK",
          "ER_LOCK_WAIT_TIMEOUT",
          "ER_LOCK_ABORTED",
          "PROTOCOL_CONNECTION_LOST",
        ].includes(err.code)
      ) {
        shouldRetry = true;
        retryDelay = 350 * attempt + Math.floor(Math.random() * 250);
      } else {
        throw err;
      }
    } finally {
      if (connection) {
        if (hasSchemaLock) {
          try {
            await connection.query("SELECT RELEASE_LOCK(?)", [schemaLockKey]);
          } catch (releaseErr) {
            console.error("Schema lock release failed:", releaseErr.message);
          }
        }
        connection.release();
      }
    }

    if (shouldRetry) {
      await sleep(retryDelay);
    }
  }

  throw lastError || new Error("Schema change failed");
}

async function ensureUserShiftColumns() {
  await runSchemaChange(
    "ALTER TABLE users ADD COLUMN logout_time time DEFAULT '18:00:00' AFTER comp_name",
    "ER_DUP_FIELDNAME",
  );
}

ensureUserShiftColumns().catch((err) => {
  console.error("User shift setup failed:", err);
});

async function ensureUserRegistrationColumns() {
  if (userRegistrationColumnsReady) return;
  if (userRegistrationColumnsPromise) return userRegistrationColumnsPromise;

  userRegistrationColumnsPromise = (async () => {
  const schemaChanges = [
    "ALTER TABLE users MODIFY COLUMN contact varchar(20) DEFAULT NULL",
    "ALTER TABLE users ADD COLUMN alt_contact varchar(20) DEFAULT NULL AFTER contact",
    "ALTER TABLE users ADD COLUMN aadhar_no varchar(32) DEFAULT NULL AFTER alt_contact",
    "ALTER TABLE users ADD COLUMN aadhar_img varchar(999) DEFAULT NULL AFTER aadhar_no",
    "ALTER TABLE users ADD COLUMN account_no varchar(64) DEFAULT NULL AFTER aadhar_img",
    "ALTER TABLE users ADD COLUMN bank_name varchar(150) DEFAULT NULL AFTER account_no",
    "ALTER TABLE users ADD COLUMN ifsc_code varchar(32) DEFAULT NULL AFTER bank_name",
    "ALTER TABLE users ADD COLUMN beneficiary_name varchar(150) DEFAULT NULL AFTER ifsc_code",
    "ALTER TABLE users ADD COLUMN login_time time DEFAULT NULL AFTER comp_name",
    "ALTER TABLE users ADD COLUMN employee_code varchar(50) DEFAULT NULL",
    "ALTER TABLE users ADD COLUMN date_of_birth date DEFAULT NULL",
    "ALTER TABLE users ADD COLUMN gender varchar(20) DEFAULT NULL",
    "ALTER TABLE users ADD COLUMN nationality varchar(100) DEFAULT NULL",
    "ALTER TABLE users ADD COLUMN address text",
    "ALTER TABLE users ADD COLUMN pan_number varchar(32) DEFAULT NULL",
    "ALTER TABLE users ADD COLUMN pan_img varchar(999) DEFAULT NULL",
    "ALTER TABLE users ADD COLUMN cancelled_cheque varchar(999) DEFAULT NULL",
    "ALTER TABLE users ADD COLUMN total_experience varchar(100) DEFAULT NULL",
    "ALTER TABLE users ADD COLUMN pf_enabled tinyint(1) NOT NULL DEFAULT 0",
    "ALTER TABLE users ADD COLUMN pf_number varchar(64) DEFAULT NULL",
    "ALTER TABLE users ADD COLUMN uan_number varchar(64) DEFAULT NULL",
    "ALTER TABLE users ADD COLUMN employee_pf_number varchar(64) DEFAULT NULL",
    "ALTER TABLE users ADD COLUMN employer_pf_number varchar(64) DEFAULT NULL",
    "ALTER TABLE users ADD COLUMN pf_joining_date date DEFAULT NULL",
    "ALTER TABLE users ADD COLUMN resume_file varchar(999) DEFAULT NULL",
    "ALTER TABLE users ADD COLUMN experience_file varchar(999) DEFAULT NULL",
    "ALTER TABLE users ADD COLUMN certification_file varchar(999) DEFAULT NULL",
    "ALTER TABLE users ADD COLUMN other_documents longtext DEFAULT NULL AFTER certification_file",
  ];

  for (const sql of schemaChanges) {
    await runSchemaChange(sql, "ER_DUP_FIELDNAME");
  }
    userRegistrationColumnsReady = true;
  })();

  try {
    await userRegistrationColumnsPromise;
  } finally {
    if (!userRegistrationColumnsReady) {
      userRegistrationColumnsPromise = null;
    }
  }
}

ensureUserRegistrationColumns().catch((err) => {
  console.error("User registration schema setup failed:", err);
});

async function ensureAttendanceFaceColumns() {
  await ensureUserRegistrationColumns();
  if (attendanceFaceColumnsReady) return;
  if (attendanceFaceColumnsPromise) return attendanceFaceColumnsPromise;

  attendanceFaceColumnsPromise = (async () => {
    const schemaChanges = [
      "ALTER TABLE users ADD COLUMN attendance_face_image longtext NULL AFTER certification_file",
      "ALTER TABLE users ADD COLUMN attendance_face_signature text NULL AFTER attendance_face_image",
      "ALTER TABLE users ADD COLUMN attendance_face_enrolled_at datetime DEFAULT NULL AFTER attendance_face_signature",
    ];

    for (const sql of schemaChanges) {
      await runSchemaChange(sql, "ER_DUP_FIELDNAME");
    }
    attendanceFaceColumnsReady = true;
  })();

  try {
    await attendanceFaceColumnsPromise;
  } finally {
    if (!attendanceFaceColumnsReady) {
      attendanceFaceColumnsPromise = null;
    }
  }
}

ensureAttendanceFaceColumns().catch((err) => {
  console.error("Attendance face schema setup failed:", err);
});

function formatEmployeeCode(sequenceNumber) {
  const normalizedSequence = Math.max(1, Number(sequenceNumber || 1));
  return `${EMPLOYEE_CODE_PREFIX}${String(normalizedSequence).padStart(EMPLOYEE_CODE_PAD_LENGTH, "0")}`;
}

function parseEmployeeCodeSequence(employeeCode) {
  const pattern = new RegExp(`^${EMPLOYEE_CODE_PREFIX}(\\d+)$`, "i");
  const match = String(employeeCode || "").trim().match(pattern);
  return match ? Number(match[1]) || 0 : 0;
}

async function getNextEmployeeCode(companyScope = "") {
  await ensureUserRegistrationColumns();
  const userScopeSql = getCompanyUserScopeSql(companyScope, "u");

  const [rows] = await dbPromise.query(
    `
      SELECT CAST(SUBSTRING(u.employee_code, ?) AS UNSIGNED) AS sequence_no
      FROM users u
      WHERE u.employee_code REGEXP ?
      ${userScopeSql ? `AND ${userScopeSql}` : ""}
      ORDER BY sequence_no ASC
    `,
    [EMPLOYEE_CODE_PREFIX.length + 1, `^${EMPLOYEE_CODE_PREFIX}[0-9]+$`],
  );

  let nextSequence = 1;
  rows.forEach((row) => {
    const sequenceNo = Number(row?.sequence_no || 0);
    if (sequenceNo === nextSequence) {
      nextSequence += 1;
    }
  });

  return formatEmployeeCode(nextSequence);
}

async function ensureUserProfileSetupColumns() {
  if (userProfileSetupColumnsReady) return;
  if (userProfileSetupColumnsPromise) return userProfileSetupColumnsPromise;

  userProfileSetupColumnsPromise = (async () => {
    await ensureUserRegistrationColumns();
    await ensureAttendanceFaceColumns();

    const schemaChanges = [
      "ALTER TABLE users ADD COLUMN employee_pf_amount decimal(10,2) DEFAULT NULL AFTER employee_pf_number",
      "ALTER TABLE users ADD COLUMN employer_pf_amount decimal(10,2) DEFAULT NULL AFTER employer_pf_number",
      "ALTER TABLE users ADD COLUMN profile_setup_status varchar(20) NOT NULL DEFAULT 'not_sent' AFTER certification_file",
      "ALTER TABLE users ADD COLUMN profile_setup_token_hash varchar(128) DEFAULT NULL AFTER profile_setup_status",
      "ALTER TABLE users ADD COLUMN profile_setup_expires_at datetime DEFAULT NULL AFTER profile_setup_token_hash",
      "ALTER TABLE users ADD COLUMN profile_setup_sent_at datetime DEFAULT NULL AFTER profile_setup_expires_at",
      "ALTER TABLE users ADD COLUMN profile_setup_completed_at datetime DEFAULT NULL AFTER profile_setup_sent_at",
    ];

    for (const sql of schemaChanges) {
      await runSchemaChange(sql, "ER_DUP_FIELDNAME");
    }
    userProfileSetupColumnsReady = true;
  })();

  try {
    await userProfileSetupColumnsPromise;
  } finally {
    if (!userProfileSetupColumnsReady) {
      userProfileSetupColumnsPromise = null;
    }
  }
}

ensureUserProfileSetupColumns().catch((err) => {
  console.error("User profile setup schema setup failed:", err);
});

let profileSetupTokensTableReady = false;

async function ensureProfileSetupTokensTable() {
  if (profileSetupTokensTableReady) return;

  await ensureUserProfileSetupColumns();
  await dbPromise.query(`
    CREATE TABLE IF NOT EXISTS profile_setup_tokens (
      id int NOT NULL AUTO_INCREMENT,
      user_id int NOT NULL,
      token_hash varchar(128) NOT NULL,
      expires_at datetime NOT NULL,
      used_at datetime DEFAULT NULL,
      created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY unique_profile_setup_token_hash (token_hash),
      KEY profile_setup_tokens_user_id_idx (user_id),
      KEY profile_setup_tokens_used_at_idx (used_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
  `);

  await dbPromise.query(`
    INSERT INTO profile_setup_tokens (user_id, token_hash, expires_at, created_at)
    SELECT
      id,
      profile_setup_token_hash,
      profile_setup_expires_at,
      COALESCE(profile_setup_sent_at, NOW())
    FROM users
    WHERE profile_setup_token_hash IS NOT NULL
      AND profile_setup_expires_at IS NOT NULL
      AND profile_setup_status <> 'completed'
    ON DUPLICATE KEY UPDATE
      expires_at = VALUES(expires_at),
      used_at = NULL
  `);

  profileSetupTokensTableReady = true;
}

async function rememberProfileSetupToken(userId, tokenHash, expiresAt) {
  try {
    await ensureProfileSetupTokensTable();
    await dbPromise.query(
      `
        INSERT INTO profile_setup_tokens (user_id, token_hash, expires_at)
        VALUES (?, ?, ?)
        ON DUPLICATE KEY UPDATE
          expires_at = VALUES(expires_at),
          used_at = NULL
      `,
      [userId, tokenHash, expiresAt],
    );
  } catch (err) {
    console.error("Profile setup token history save failed:", err);
  }
}

async function markProfileSetupTokensUsed(userId) {
  await ensureProfileSetupTokensTable();
  await dbPromise.query(
    `
      UPDATE profile_setup_tokens
      SET used_at = COALESCE(used_at, NOW())
      WHERE user_id = ?
    `,
    [userId],
  );
}

ensureProfileSetupTokensTable().catch((err) => {
  console.error("Profile setup token table setup failed:", err);
});

const APPOINTMENT_STATUS_VALUES = new Set([
  "generated",
  "confirmed",
  "not_confirmed",
]);

function normalizeAppointmentStatus(value, fallback = "generated") {
  const normalized = String(value || fallback)
    .toLowerCase()
    .trim()
    .replace(/[\s-]+/g, "_");

  if (APPOINTMENT_STATUS_VALUES.has(normalized)) {
    return normalized;
  }

  return fallback;
}

function normalizeLeadSalesType(value) {
  const normalized = String(value || "")
    .toLowerCase()
    .trim();
  return normalized === "renewal" ? "renewal" : "new";
}

function normalizeRequiredLeadText(value) {
  return String(value ?? "").trim();
}

function getAppointmentStageSql() {
  return `
    CASE
      WHEN lead_status = 'deal_closed' THEN 'deal_closed'
      WHEN COALESCE(NULLIF(appointment_status, ''), '') = 'not_confirmed'
        OR lead_status = 'not_interested' THEN 'not_confirmed'
      WHEN COALESCE(NULLIF(appointment_status, ''), '') = 'confirmed'
        OR lead_status = 'followup' THEN 'confirmed'
      ELSE 'generated'
    END
  `;
}

function getLegacyAppointmentStageSql() {
  return `
    CASE
      WHEN lead_status = 'deal_closed' THEN 'deal_closed'
      WHEN lead_status = 'not_interested' THEN 'not_confirmed'
      WHEN lead_status = 'followup' THEN 'confirmed'
      ELSE 'generated'
    END
  `;
}

async function ensureLeadAppointmentStatusColumn() {
  await runSchemaChange(
    "ALTER TABLE leads ADD COLUMN appointment_status varchar(30) DEFAULT NULL AFTER action_type",
    "ER_DUP_FIELDNAME",
  );

  await dbPromise.query(`
    UPDATE leads
    SET appointment_status = CASE
      WHEN app_date IS NULL THEN appointment_status
      WHEN lead_status = 'deal_closed' THEN 'confirmed'
      WHEN lead_status = 'followup' THEN 'confirmed'
      WHEN lead_status = 'not_interested' THEN 'not_confirmed'
      WHEN COALESCE(NULLIF(appointment_status, ''), '') = '' THEN 'generated'
      ELSE appointment_status
    END
    WHERE app_date IS NOT NULL
  `);
}

ensureLeadAppointmentStatusColumn().catch((err) => {
  console.error("Appointment status schema setup failed:", err);
});

async function ensureLeadSalesTypeColumn() {
  if (leadSalesTypeColumnReady) return;
  if (leadSalesTypeColumnPromise) return leadSalesTypeColumnPromise;

  leadSalesTypeColumnPromise = (async () => {
    await runSchemaChange(
      "ALTER TABLE leads ADD COLUMN sales_type varchar(20) NOT NULL DEFAULT 'new' AFTER source_lead",
      "ER_DUP_FIELDNAME",
    );

    await dbPromise.query(`
      UPDATE leads
      SET sales_type = 'new'
      WHERE sales_type IS NULL OR TRIM(sales_type) = ''
    `);
    leadSalesTypeColumnReady = true;
  })();

  try {
    return await leadSalesTypeColumnPromise;
  } finally {
    if (!leadSalesTypeColumnReady) {
      leadSalesTypeColumnPromise = null;
    }
  }
}

ensureLeadSalesTypeColumn().catch((err) => {
  console.error("Lead sales type schema setup failed:", err);
});

async function ensureLeadRenewalSourceColumn() {
  if (leadRenewalSourceColumnReady) return;
  if (leadRenewalSourceColumnPromise) return leadRenewalSourceColumnPromise;

  leadRenewalSourceColumnPromise = (async () => {
    await ensureLeadSalesTypeColumn();
    await runSchemaChange(
      "ALTER TABLE leads ADD COLUMN renewal_source_lead_id int DEFAULT NULL AFTER sales_type",
      "ER_DUP_FIELDNAME",
    );
    leadRenewalSourceColumnReady = true;
  })();

  try {
    return await leadRenewalSourceColumnPromise;
  } finally {
    if (!leadRenewalSourceColumnReady) {
      leadRenewalSourceColumnPromise = null;
    }
  }
}

ensureLeadRenewalSourceColumn().catch((err) => {
  console.error("Lead renewal source setup failed:", err);
});

async function ensureLeadCompanyScopeColumn() {
  if (leadCompanyScopeColumnReady) return;
  if (leadCompanyScopeColumnPromise) return leadCompanyScopeColumnPromise;

  leadCompanyScopeColumnPromise = (async () => {
    await runSchemaChange(
      "ALTER TABLE leads ADD COLUMN company_scope varchar(100) DEFAULT NULL AFTER created_by",
      "ER_DUP_FIELDNAME",
    );
    leadCompanyScopeColumnReady = true;
  })();

  try {
    return await leadCompanyScopeColumnPromise;
  } finally {
    if (!leadCompanyScopeColumnReady) {
      leadCompanyScopeColumnPromise = null;
    }
  }
}

ensureLeadCompanyScopeColumn().catch((err) => {
  console.error("Lead company scope setup failed:", err);
});

async function ensureUserMonthlyTargetColumn() {
  await runSchemaChange(
    "ALTER TABLE users ADD COLUMN monthly_target decimal(12,2) DEFAULT NULL",
    "ER_DUP_FIELDNAME",
  );
}

ensureUserMonthlyTargetColumn().catch((err) => {
  console.error("User monthly target setup failed:", err);
});

async function ensurePayrollUserColumns() {
  const schemaChanges = [
    "ALTER TABLE users ADD COLUMN department varchar(100) DEFAULT NULL AFTER role",
    "ALTER TABLE users ADD COLUMN salary decimal(12,2) NOT NULL DEFAULT 0 AFTER department",
    "ALTER TABLE users ADD COLUMN compensation_type varchar(20) NOT NULL DEFAULT 'salary' AFTER salary",
    "ALTER TABLE users ADD COLUMN commission_percent decimal(6,2) NOT NULL DEFAULT 0 AFTER compensation_type",
    "ALTER TABLE users ADD COLUMN joining_date date DEFAULT NULL AFTER salary",
    "ALTER TABLE users ADD COLUMN is_team_lead tinyint(1) NOT NULL DEFAULT 0 AFTER joining_date",
  ];

  for (const sql of schemaChanges) {
    await runSchemaChange(sql, "ER_DUP_FIELDNAME");
  }
}

ensurePayrollUserColumns().catch((err) => {
  console.error("Payroll user schema setup failed:", err);
});

async function ensureDealProductsTable() {
  const sql = `
    CREATE TABLE IF NOT EXISTS deal_products (
      id int NOT NULL AUTO_INCREMENT,
      deal_id int NOT NULL,
      product_name varchar(255) NOT NULL,
      product_amount decimal(12,2) NOT NULL,
      PRIMARY KEY (id),
      KEY deal_id (deal_id),
      CONSTRAINT deal_products_ibfk_1
        FOREIGN KEY (deal_id) REFERENCES deals (id)
        ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
  `;

  await dbPromise.query(sql);
}

ensureDealProductsTable().catch((err) => {
  console.error("Deal products table setup failed:", err);
});

let downsaleRequestsSchemaReady = false;

async function ensureDownsaleRequestsTable() {
  if (downsaleRequestsSchemaReady) return;

  const sql = `
    CREATE TABLE IF NOT EXISTS downsale_requests (
      id int NOT NULL AUTO_INCREMENT,
      lead_id int NOT NULL,
      requested_by int DEFAULT NULL,
      product_name varchar(255) NOT NULL,
      standard_amount decimal(12,2) NOT NULL,
      requested_amount decimal(12,2) NOT NULL,
      reason text NULL,
      status enum('pending','approved','rejected') NOT NULL DEFAULT 'pending',
      admin_note text NULL,
      reviewed_by int DEFAULT NULL,
      reviewed_at datetime DEFAULT NULL,
      created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY lead_id (lead_id),
      KEY status (status),
      CONSTRAINT downsale_requests_ibfk_1
        FOREIGN KEY (lead_id) REFERENCES leads (id)
        ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
  `;

  await dbPromise.query(sql);
  downsaleRequestsSchemaReady = true;
}

ensureDownsaleRequestsTable().catch((err) => {
  console.error("Downsale requests table setup failed:", err);
});

let proposalSchemaReady = false;

async function ensureProposalTables() {
  if (proposalSchemaReady) return;

  await dbPromise.query(`
    CREATE TABLE IF NOT EXISTS proposal_templates (
      id int NOT NULL AUTO_INCREMENT,
      template_name varchar(255) NOT NULL,
      category varchar(100) DEFAULT 'CRM',
      content longtext NOT NULL,
      status varchar(50) NOT NULL DEFAULT 'active',
      created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY proposal_templates_name_idx (template_name),
      KEY proposal_templates_status_idx (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
  `);

  await dbPromise.query(`
    CREATE TABLE IF NOT EXISTS proposals (
      id int NOT NULL AUTO_INCREMENT,
      client_name varchar(255) DEFAULT NULL,
      client_email varchar(255) DEFAULT NULL,
      company_name varchar(255) DEFAULT NULL,
      project_topic varchar(255) DEFAULT NULL,
      requirement_details text DEFAULT NULL,
      budget varchar(100) DEFAULT NULL,
      timeline varchar(100) DEFAULT NULL,
      technology varchar(255) DEFAULT NULL,
      notes text DEFAULT NULL,
      company_scope varchar(100) DEFAULT NULL,
      proposal_content longtext NOT NULL,
      created_by int DEFAULT NULL,
      status varchar(50) NOT NULL DEFAULT 'draft',
      created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY proposals_created_by_idx (created_by),
      KEY proposals_status_idx (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
  `);

  await runSchemaChange(
    "ALTER TABLE proposals ADD COLUMN client_email varchar(255) DEFAULT NULL AFTER client_name",
    "ER_DUP_FIELDNAME",
  );
  await runSchemaChange(
    "ALTER TABLE proposals ADD COLUMN company_scope varchar(100) DEFAULT NULL AFTER notes",
    "ER_DUP_FIELDNAME",
  );

  const templateContent = `PROJECT PROPOSAL

Client Name: {{client_name}}
Client Email: {{client_email}}
Company Name: {{company_name}}
Project Topic: {{project_topic}}

PROJECT OVERVIEW:
We propose to develop a customized {{project_topic}} solution for {{company_name}} with a clean dashboard, role based access, client records, reminders, payment tracking, and reporting.

CLIENT REQUIREMENT:
{{requirement_details}}

MAIN MODULES:
1. Admin Panel
2. User / Team Management
3. Client Management
4. Lead and Follow Up Management
5. Booking / Service Management
6. Payment Management
7. Reports and Analytics
8. Document Management
9. Settings

ADMIN PANEL:
Admin can manage all records, users, roles, reports, payments, modules, and business settings from one secure panel.

USER PANEL:
Users can update assigned records, follow ups, reminders, client notes, and daily work status as per their access.

TECHNOLOGY STACK:
{{technology}}

TIMELINE:
{{timeline}}

PRICING:
{{budget}}

TERMS & CONDITIONS:
1. Final pricing and timeline will depend on confirmed requirements.
2. Additional modules, APIs, payment gateways, or third-party integrations will be estimated separately.
3. Project starts after requirement confirmation and advance payment.
4. Client will provide content, logo, branding assets, and required credentials.

NOTES:
{{notes}}`;

  await dbPromise.query(
    `
      INSERT INTO proposal_templates (template_name, category, content, status)
      SELECT ?, ?, ?, 'active'
      WHERE NOT EXISTS (
        SELECT 1 FROM proposal_templates WHERE template_name = ? LIMIT 1
      )
    `,
    ["Default CRM Proposal", "CRM", templateContent, "Default CRM Proposal"],
  );

  proposalSchemaReady = true;
}

ensureProposalTables().catch((err) => {
  console.error("Proposal schema setup failed:", err);
});

async function ensureProjectAssignmentWorkflowColumns() {
  const columns = [
    "ADD COLUMN stage varchar(50) DEFAULT NULL AFTER status",
    "ADD COLUMN progress int DEFAULT 0 AFTER stage",
  ];

  for (const columnSql of columns) {
    await runSchemaChange(
      `ALTER TABLE project_assignments ${columnSql}`,
      "ER_DUP_FIELDNAME",
    );
  }
}

ensureProjectAssignmentWorkflowColumns().catch((err) => {
  console.error("Project assignment workflow setup failed:", err);
});

async function ensureProjectPhaseDetailsTable() {
  const sql = `
    CREATE TABLE IF NOT EXISTS project_phase_details (
      id int NOT NULL AUTO_INCREMENT,
      assignment_id int NOT NULL,
      phase_key varchar(100) NOT NULL,
      status varchar(30) DEFAULT 'pending',
      progress int DEFAULT 0,
      start_date date DEFAULT NULL,
      due_date date DEFAULT NULL,
      notes text DEFAULT NULL,
      blockers text DEFAULT NULL,
      deliverable_link varchar(500) DEFAULT NULL,
      attachments_json longtext DEFAULT NULL,
      created_at datetime DEFAULT CURRENT_TIMESTAMP,
      updated_at datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY unique_assignment_phase (assignment_id, phase_key),
      KEY assignment_id (assignment_id),
      CONSTRAINT project_phase_details_assignment_fk
        FOREIGN KEY (assignment_id) REFERENCES project_assignments (id)
        ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
  `;

  await dbPromise.query(sql);
  await runSchemaChange(
    "ALTER TABLE project_phase_details ADD COLUMN attachments_json longtext DEFAULT NULL AFTER deliverable_link",
    "ER_DUP_FIELDNAME",
  );
}

ensureProjectPhaseDetailsTable().catch((err) => {
  console.error("Project phase details table setup failed:", err);
});

let attendanceSchemaReady = false;

async function ensureAttendanceTable() {
  if (attendanceSchemaReady) return;

  const sql = `
    CREATE TABLE IF NOT EXISTS attendance (
      id int NOT NULL AUTO_INCREMENT,
      user_id int NOT NULL,
      attendance_date date NOT NULL,
      check_in datetime DEFAULT NULL,
      check_out datetime DEFAULT NULL,
      check_in_lat decimal(10,8) DEFAULT NULL,
      check_in_lng decimal(11,8) DEFAULT NULL,
      check_in_location varchar(500) DEFAULT NULL,
      status varchar(30) DEFAULT 'present',
      admin_override_status varchar(30) DEFAULT NULL,
      admin_override_at datetime DEFAULT NULL,
      admin_override_by int DEFAULT NULL,
      created_at datetime DEFAULT CURRENT_TIMESTAMP,
      updated_at datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY unique_user_attendance_date (user_id, attendance_date),
      KEY user_id (user_id),
      CONSTRAINT attendance_user_fk
        FOREIGN KEY (user_id) REFERENCES users (id)
        ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
  `;

  await dbPromise.query(sql);
  const columns = [
    "ADD COLUMN attendance_date date DEFAULT NULL AFTER user_id",
    "ADD COLUMN check_in_lat decimal(10,8) DEFAULT NULL AFTER check_out",
    "ADD COLUMN check_in_lng decimal(11,8) DEFAULT NULL AFTER check_in_lat",
    "ADD COLUMN check_in_location varchar(500) DEFAULT NULL AFTER check_in_lng",
    "ADD COLUMN admin_override_status varchar(30) DEFAULT NULL AFTER status",
    "ADD COLUMN admin_override_at datetime DEFAULT NULL AFTER admin_override_status",
    "ADD COLUMN admin_override_by int DEFAULT NULL AFTER admin_override_at",
  ];

  for (const columnSql of columns) {
    await runSchemaChange(`ALTER TABLE attendance ${columnSql}`, "ER_DUP_FIELDNAME");
  }

  const attendanceDateColumn = quoteDbIdentifier(await getAttendanceTableDateColumn());
  await dbPromise.query(`
    UPDATE attendance
    SET ${attendanceDateColumn} = COALESCE(${attendanceDateColumn}, DATE(check_in), CURDATE())
    WHERE ${attendanceDateColumn} IS NULL
  `);

  const statusColumn = await getSchemaColumnInfo("attendance", "status");
  if (
    statusColumn &&
    String(statusColumn.COLUMN_TYPE || "").toLowerCase() !== "varchar(30)"
  ) {
    await runSchemaChange(
      "ALTER TABLE attendance MODIFY COLUMN status varchar(30) DEFAULT 'present'",
      "ER_DUP_FIELDNAME",
    );
  }

  attendanceSchemaReady = true;
}

ensureAttendanceTable().catch((err) => {
  console.error("Attendance table setup failed:", err);
});

let attendanceLocationRequestsSchemaReady = false;

async function ensureAttendanceLocationRequestsTable() {
  if (attendanceLocationRequestsSchemaReady) return;

  const sql = `
    CREATE TABLE IF NOT EXISTS attendance_location_requests (
      id int NOT NULL AUTO_INCREMENT,
      user_id int NOT NULL,
      attendance_date date NOT NULL,
      purpose varchar(255) NOT NULL,
      meeting_with varchar(255) DEFAULT NULL,
      notes text DEFAULT NULL,
      requested_lat decimal(10,8) NOT NULL,
      requested_lng decimal(11,8) NOT NULL,
      requested_accuracy decimal(8,2) DEFAULT NULL,
      requested_location_url varchar(500) DEFAULT NULL,
      requested_address varchar(255) DEFAULT NULL,
      requested_radius_meters int NOT NULL DEFAULT 150,
      status varchar(30) NOT NULL DEFAULT 'pending',
      admin_remark varchar(500) DEFAULT NULL,
      reviewed_by int DEFAULT NULL,
      reviewed_by_name varchar(255) DEFAULT NULL,
      reviewed_at datetime DEFAULT NULL,
      approved_lat decimal(10,8) DEFAULT NULL,
      approved_lng decimal(11,8) DEFAULT NULL,
      approved_location_url varchar(500) DEFAULT NULL,
      approved_address varchar(255) DEFAULT NULL,
      approved_radius_meters int DEFAULT NULL,
      created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY attendance_location_requests_user_idx (user_id),
      KEY attendance_location_requests_date_idx (attendance_date),
      KEY attendance_location_requests_status_idx (status),
      KEY attendance_location_requests_user_date_idx (user_id, attendance_date),
      CONSTRAINT attendance_location_requests_user_fk
        FOREIGN KEY (user_id) REFERENCES users (id)
        ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
  `;

  await dbPromise.query(sql);

  const columns = [
    "ADD COLUMN attendance_date date DEFAULT NULL AFTER user_id",
    "ADD COLUMN requested_accuracy decimal(8,2) DEFAULT NULL AFTER requested_lng",
    "ADD COLUMN requested_location_url varchar(500) DEFAULT NULL AFTER requested_accuracy",
    "ADD COLUMN requested_address varchar(255) DEFAULT NULL AFTER requested_location_url",
    "ADD COLUMN requested_radius_meters int NOT NULL DEFAULT 150 AFTER requested_address",
    "ADD COLUMN admin_remark varchar(500) DEFAULT NULL AFTER status",
    "ADD COLUMN reviewed_by int DEFAULT NULL AFTER admin_remark",
    "ADD COLUMN reviewed_by_name varchar(255) DEFAULT NULL AFTER reviewed_by",
    "ADD COLUMN reviewed_at datetime DEFAULT NULL AFTER reviewed_by_name",
    "ADD COLUMN approved_lat decimal(10,8) DEFAULT NULL AFTER reviewed_at",
    "ADD COLUMN approved_lng decimal(11,8) DEFAULT NULL AFTER approved_lat",
    "ADD COLUMN approved_location_url varchar(500) DEFAULT NULL AFTER approved_lng",
    "ADD COLUMN approved_address varchar(255) DEFAULT NULL AFTER approved_location_url",
    "ADD COLUMN approved_radius_meters int DEFAULT NULL AFTER approved_address",
  ];

  for (const columnSql of columns) {
    await runSchemaChange(
      `ALTER TABLE attendance_location_requests ${columnSql}`,
      "ER_DUP_FIELDNAME",
    );
  }

  const requestDateColumn = quoteDbIdentifier(
    await getAttendanceLocationRequestDateColumn(),
  );
  await dbPromise.query(`
    UPDATE attendance_location_requests
    SET ${requestDateColumn} = COALESCE(${requestDateColumn}, DATE(created_at), CURDATE())
    WHERE ${requestDateColumn} IS NULL
  `);

  const statusColumn = await getSchemaColumnInfo("attendance_location_requests", "status");
  if (
    statusColumn &&
    String(statusColumn.COLUMN_TYPE || "").toLowerCase() !== "varchar(30)"
  ) {
    await runSchemaChange(
      "ALTER TABLE attendance_location_requests MODIFY COLUMN status varchar(30) NOT NULL DEFAULT 'pending'",
      "ER_DUP_FIELDNAME",
    );
  }

  attendanceLocationRequestsSchemaReady = true;
}

ensureAttendanceLocationRequestsTable().catch((err) => {
  console.error("Attendance location requests table setup failed:", err);
});

let leaveRequestsSchemaReady = false;

async function ensureLeaveRequestsTable() {
  if (leaveRequestsSchemaReady) return;

  const sql = `
    CREATE TABLE IF NOT EXISTS leave_requests (
      id int NOT NULL AUTO_INCREMENT,
      user_id int NOT NULL,
      employee_name varchar(255) NOT NULL,
      role varchar(50) NOT NULL,
      leave_type varchar(50) NOT NULL,
      from_date date NOT NULL,
      to_date date NOT NULL,
      total_days decimal(5,2) NOT NULL DEFAULT 0,
      is_paid tinyint(1) DEFAULT NULL,
      reason text DEFAULT NULL,
      attachment varchar(500) DEFAULT NULL,
      status varchar(30) DEFAULT 'pending',
      approval_route varchar(30) NOT NULL DEFAULT 'admin',
      approval_stage varchar(30) NOT NULL DEFAULT 'admin_review',
      leader_user_id int DEFAULT NULL,
      leader_name varchar(255) DEFAULT NULL,
      leader_email varchar(255) DEFAULT NULL,
      leader_status varchar(30) NOT NULL DEFAULT 'not_required',
      leader_remark text DEFAULT NULL,
      leader_reviewed_by int DEFAULT NULL,
      leader_reviewer_name varchar(255) DEFAULT NULL,
      leader_reviewed_at datetime DEFAULT NULL,
      admin_remark text DEFAULT NULL,
      admin_reviewed_by int DEFAULT NULL,
      admin_reviewer_name varchar(255) DEFAULT NULL,
      admin_reviewed_at datetime DEFAULT NULL,
      created_at datetime DEFAULT CURRENT_TIMESTAMP,
      updated_at datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY leave_requests_user_id_idx (user_id),
      KEY leave_requests_status_idx (status),
      KEY leave_requests_date_idx (from_date, to_date),
      CONSTRAINT leave_requests_user_fk
        FOREIGN KEY (user_id) REFERENCES users (id)
        ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
  `;

  await dbPromise.query(sql);
  const columns = [
    "ADD COLUMN employee_name varchar(255) NOT NULL DEFAULT '' AFTER user_id",
    "ADD COLUMN role varchar(50) NOT NULL DEFAULT 'employee' AFTER employee_name",
    "ADD COLUMN leave_type varchar(50) NOT NULL DEFAULT 'casual_leave' AFTER role",
    "ADD COLUMN from_date date NOT NULL AFTER leave_type",
    "ADD COLUMN to_date date NOT NULL AFTER from_date",
    "ADD COLUMN total_days decimal(5,2) NOT NULL DEFAULT 0 AFTER to_date",
    "ADD COLUMN is_paid tinyint(1) DEFAULT NULL AFTER total_days",
    "ADD COLUMN reason text DEFAULT NULL AFTER is_paid",
    "ADD COLUMN attachment varchar(500) DEFAULT NULL AFTER reason",
    "ADD COLUMN status varchar(30) DEFAULT 'pending' AFTER attachment",
    "ADD COLUMN approval_route varchar(30) NOT NULL DEFAULT 'admin' AFTER status",
    "ADD COLUMN approval_stage varchar(30) NOT NULL DEFAULT 'admin_review' AFTER approval_route",
    "ADD COLUMN leader_user_id int DEFAULT NULL AFTER approval_stage",
    "ADD COLUMN leader_name varchar(255) DEFAULT NULL AFTER leader_user_id",
    "ADD COLUMN leader_email varchar(255) DEFAULT NULL AFTER leader_name",
    "ADD COLUMN leader_status varchar(30) NOT NULL DEFAULT 'not_required' AFTER leader_email",
    "ADD COLUMN leader_remark text DEFAULT NULL AFTER leader_status",
    "ADD COLUMN leader_reviewed_by int DEFAULT NULL AFTER leader_remark",
    "ADD COLUMN leader_reviewer_name varchar(255) DEFAULT NULL AFTER leader_reviewed_by",
    "ADD COLUMN leader_reviewed_at datetime DEFAULT NULL AFTER leader_reviewer_name",
    "ADD COLUMN admin_remark text DEFAULT NULL AFTER leader_reviewed_at",
    "ADD COLUMN admin_reviewed_by int DEFAULT NULL AFTER admin_remark",
    "ADD COLUMN admin_reviewer_name varchar(255) DEFAULT NULL AFTER admin_reviewed_by",
    "ADD COLUMN admin_reviewed_at datetime DEFAULT NULL AFTER admin_reviewer_name",
    "ADD COLUMN updated_at datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER created_at",
  ];

  for (const columnSql of columns) {
    await runSchemaChange(
      `ALTER TABLE leave_requests ${columnSql}`,
      "ER_DUP_FIELDNAME",
    );
  }

  leaveRequestsSchemaReady = true;
}

ensureLeaveRequestsTable().catch((err) => {
  console.error("Leave requests table setup failed:", err);
});

const LEAVE_ROLE_LEADER_EMAILS = Object.freeze(
  Object.entries(rawLeaveRoleLeaderEmails || {}).reduce((config, [role, email]) => {
    const normalizedRole = String(role || "")
      .toLowerCase()
      .trim();
    const normalizedEmail = String(email || "")
      .toLowerCase()
      .trim();

    if (normalizedRole && normalizedEmail) {
      config[normalizedRole] = normalizedEmail;
    }

    return config;
  }, {}),
);

const LEAVE_DIRECT_ADMIN_ROLES = new Set([
  "admin",
  "seo",
  "smo",
  "hr",
  "accounts",
  "account",
]);

const LEAVE_MONTHLY_CREDIT = 1;
const LEAVE_BALANCE_ELIGIBLE_TYPES = new Set([
  "casual_leave",
  "sick_leave",
  "emergency_leave",
]);
const LEAVE_ALWAYS_PAID_TYPES = new Set([
  "work_from_home",
]);

function normalizeRoleValue(role) {
  return String(role || "")
    .toLowerCase()
    .trim();
}

function normalizeEmailValue(email) {
  return String(email || "")
    .trim()
    .toLowerCase();
}

function normalizeLeaveKey(value) {
  return String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[\s-]+/g, "_");
}

function normalizeLeaveType(value) {
  const normalized = normalizeLeaveKey(value);
  const allowedTypes = new Set([
    "casual_leave",
    "sick_leave",
    "emergency_leave",
    "half_day",
    "work_from_home",
  ]);

  return allowedTypes.has(normalized) ? normalized : "";
}

function normalizeLeaveStatus(value) {
  const normalized = normalizeLeaveKey(value);
  const allowedStatuses = new Set(["pending", "approved", "rejected"]);
  return allowedStatuses.has(normalized) ? normalized : "";
}

function normalizeLeaveApprovalRoute(value) {
  const normalized = normalizeLeaveKey(value);
  return normalized === "leader" ? "leader" : "admin";
}

function normalizeLeaveApprovalStage(value) {
  const normalized = normalizeLeaveKey(value);
  const allowedStages = new Set(["leader_review", "admin_review", "completed"]);
  return allowedStages.has(normalized) ? normalized : "";
}

function normalizeLeaderDecisionStatus(value) {
  const normalized = normalizeLeaveKey(value);
  const allowedStatuses = new Set(["not_required", "pending", "approved", "rejected"]);
  return allowedStatuses.has(normalized) ? normalized : "not_required";
}

function parseDateOnlyValue(dateValue) {
  const match = String(dateValue || "").trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  if (!year || !month || !day) return null;

  return { year, month, day };
}

function calculateLeaveTotalDays(fromDate, toDate, leaveType) {
  const start = parseDateOnlyValue(fromDate);
  const end = parseDateOnlyValue(toDate);
  if (!start || !end) return NaN;

  if (leaveType === "half_day") {
    if (fromDate !== toDate) return NaN;
    return 0.5;
  }

  const startTime = Date.UTC(start.year, start.month - 1, start.day);
  const endTime = Date.UTC(end.year, end.month - 1, end.day);
  const diffInDays = Math.round((endTime - startTime) / 86400000) + 1;

  return diffInDays > 0 ? diffInDays : NaN;
}

async function normalizeLeaveAttachment(file) {
  if (!file?.filename) return null;
  return resolveUploadedFilePath(file, "leaves");
}

function getFirstUploadedFileFromFields(files, fieldNames = []) {
  for (const fieldName of fieldNames) {
    const uploadedFile = Array.isArray(files?.[fieldName])
      ? files[fieldName][0]
      : null;

    if (uploadedFile) return uploadedFile;
  }

  return null;
}

async function getUserRecordById(userId) {
  const normalizedUserId = Number(userId);
  if (!Number.isFinite(normalizedUserId) || normalizedUserId <= 0) return null;

  const [rows] = await dbPromise.query(
    `
      SELECT id, name, role, email, joining_date
      FROM users
      WHERE id = ?
      LIMIT 1
    `,
    [normalizedUserId],
  );

  return rows[0] || null;
}

async function getUserRecordByEmail(email) {
  const normalizedEmail = normalizeEmailValue(email);
  if (!normalizedEmail) return null;

  const [rows] = await dbPromise.query(
    `
      SELECT id, name, role, email, joining_date
      FROM users
      WHERE LOWER(TRIM(COALESCE(email, ''))) = ?
      LIMIT 1
    `,
    [normalizedEmail],
  );

  return rows[0] || null;
}

function normalizeDateOnlyValue(dateValue) {
  const parsedDate = parseDateOnlyValue(String(dateValue || "").slice(0, 10));
  if (!parsedDate) return "";

  return [
    parsedDate.year,
    String(parsedDate.month).padStart(2, "0"),
    String(parsedDate.day).padStart(2, "0"),
  ].join("-");
}

function getMonthKeyFromDateValue(dateValue) {
  const normalizedDate = normalizeDateOnlyValue(dateValue);
  return normalizedDate ? normalizedDate.slice(0, 7) : "";
}

function getNextMonthKey(monthKey) {
  const [year, month] = String(monthKey || "").split("-").map(Number);
  if (!year || !month) return "";

  const nextMonthDate = new Date(Date.UTC(year, month, 1));
  return [
    nextMonthDate.getUTCFullYear(),
    String(nextMonthDate.getUTCMonth() + 1).padStart(2, "0"),
  ].join("-");
}

function getFirstDateOfNextMonth(monthKey) {
  const nextMonthKey = getNextMonthKey(monthKey);
  return nextMonthKey ? `${nextMonthKey}-01` : "";
}

function isLeaveBalanceEligibleType(leaveType) {
  return LEAVE_BALANCE_ELIGIBLE_TYPES.has(normalizeLeaveKey(leaveType));
}

function getLeaveCompensationMode(leaveRow) {
  const leaveType = normalizeLeaveKey(leaveRow?.leave_type);

  if (leaveType === "half_day") {
    return "half_day";
  }

  if (leaveRow?.is_paid === 0 || leaveRow?.is_paid === "0") {
    return "unpaid";
  }

  if (leaveRow?.is_paid === 1 || leaveRow?.is_paid === "1") {
    return "paid";
  }

  if (isLeaveBalanceEligibleType(leaveType)) {
    return "balance";
  }

  if (LEAVE_ALWAYS_PAID_TYPES.has(leaveType)) {
    return "paid";
  }

  if (leaveType.includes("unpaid")) {
    return "unpaid";
  }

  return "paid";
}

async function resolveLeaveAccrualStartMeta(user) {
  const joiningDate = normalizeDateOnlyValue(user?.joining_date);
  if (joiningDate) {
    return {
      accrualStartDate: joiningDate,
      accrualSource: "joining_date",
    };
  }

  const normalizedUserId = Number(user?.id || 0);
  if (normalizedUserId > 0) {
    const [[firstLeaveRow]] = await dbPromise.query(
      `
        SELECT MIN(from_date) AS first_leave_date
        FROM leave_requests
        WHERE user_id = ?
      `,
      [normalizedUserId],
    );

    const firstLeaveDate = normalizeDateOnlyValue(firstLeaveRow?.first_leave_date);
    if (firstLeaveDate) {
      return {
        accrualStartDate: firstLeaveDate,
        accrualSource: "first_leave_request",
      };
    }
  }

  return {
    accrualStartDate: `${getCurrentPayrollMonthKey()}-01`,
    accrualSource: "current_month_default",
  };
}

async function getApprovedLeaveRowsUpToDate(userId, referenceDate) {
  const normalizedUserId = Number(userId);
  const normalizedReferenceDate = normalizeDateOnlyValue(referenceDate);

  if (!normalizedUserId || !normalizedReferenceDate) return [];

  await ensureLeaveRequestsTable();
  const [rows] = await dbPromise.query(
    `
      SELECT
        id,
        leave_type,
        from_date,
        to_date,
        total_days,
        is_paid
      FROM leave_requests
      WHERE user_id = ?
        AND status = 'approved'
        AND from_date <= ?
      ORDER BY from_date ASC, id ASC
    `,
    [normalizedUserId, normalizedReferenceDate],
  );

  return rows;
}

function serializeLeaveBalanceSnapshot(snapshot) {
  if (!snapshot) return null;

  const formatBalanceValue = (value) => {
    const numericValue = Number(value || 0);
    if (!Number.isFinite(numericValue)) return 0;
    return Number.isInteger(numericValue)
      ? numericValue
      : Number(numericValue.toFixed(1));
  };

  return {
    userId: Number(snapshot.userId || 0),
    employeeName: snapshot.employeeName || "Employee",
    role: snapshot.role || "",
    joiningDate: snapshot.joiningDate || null,
    accrualStartDate: snapshot.accrualStartDate || null,
    accrualSource: snapshot.accrualSource || "current_month_default",
    asOfDate: snapshot.referenceDate || null,
    asOfMonthKey: snapshot.referenceMonthKey || "",
    monthlyCredit: formatBalanceValue(snapshot.monthlyCredit),
    totalAccruedLeaves: formatBalanceValue(snapshot.totalAccruedLeaves),
    paidLeaveDaysUsed: formatBalanceValue(snapshot.paidLeaveDaysUsed),
    unpaidEligibleDays: formatBalanceValue(snapshot.unpaidEligibleDays),
    availableBalance: formatBalanceValue(snapshot.availableBalance),
    currentMonthCredit: formatBalanceValue(snapshot.currentMonthCredit),
    currentMonthPaidLeavesUsed: formatBalanceValue(snapshot.currentMonthPaidLeavesUsed),
    currentMonthUnusedCredit: formatBalanceValue(snapshot.currentMonthUnusedCredit),
    nextCreditDate: snapshot.nextCreditDate || "",
  };
}

async function buildLeaveBalanceSnapshot(user, options = {}) {
  const normalizedUserId = Number(user?.id || 0);
  const referenceDate = normalizeDateOnlyValue(options.referenceDate) || formatPayrollDateOnly(new Date());

  if (!normalizedUserId || !referenceDate) {
    return {
      userId: normalizedUserId,
      employeeName: user?.name || "Employee",
      role: normalizeRoleValue(user?.role),
      joiningDate: normalizeDateOnlyValue(user?.joining_date) || null,
      accrualStartDate: referenceDate || null,
      accrualSource: "current_month_default",
      referenceDate,
      referenceMonthKey: getMonthKeyFromDateValue(referenceDate),
      monthlyCredit: LEAVE_MONTHLY_CREDIT,
      totalAccruedLeaves: 0,
      paidLeaveDaysUsed: 0,
      unpaidEligibleDays: 0,
      availableBalance: 0,
      currentMonthCredit: 0,
      currentMonthPaidLeavesUsed: 0,
      currentMonthUnusedCredit: 0,
      nextCreditDate: getFirstDateOfNextMonth(getMonthKeyFromDateValue(referenceDate)),
      approvedLeaveEntries: 0,
      dayStatusMap: new Map(),
      monthBreakdown: [],
    };
  }

  const { accrualStartDate, accrualSource } = await resolveLeaveAccrualStartMeta(user);
  const accrualStartMonthKey = getMonthKeyFromDateValue(accrualStartDate);
  const referenceMonthKey = getMonthKeyFromDateValue(referenceDate);
  const approvedLeaveRows = await getApprovedLeaveRowsUpToDate(normalizedUserId, referenceDate);
  const orderedLeaveRows = approvedLeaveRows.slice().sort((left, right) => {
    const leftDate = normalizeDateOnlyValue(left?.from_date);
    const rightDate = normalizeDateOnlyValue(right?.from_date);

    if (leftDate !== rightDate) {
      return leftDate.localeCompare(rightDate);
    }

    const leftIsHalfDay = normalizeLeaveKey(left?.leave_type) === "half_day" ? 1 : 0;
    const rightIsHalfDay = normalizeLeaveKey(right?.leave_type) === "half_day" ? 1 : 0;
    if (leftIsHalfDay !== rightIsHalfDay) {
      return leftIsHalfDay - rightIsHalfDay;
    }

    return Number(left?.id || 0) - Number(right?.id || 0);
  });

  const hasAccrualStarted = Boolean(
    accrualStartMonthKey &&
    referenceMonthKey &&
    accrualStartMonthKey.localeCompare(referenceMonthKey) <= 0,
  );
  const monthBreakdownMap = new Map();
  const dayStatusMap = new Map();
  let monthCursor = hasAccrualStarted ? accrualStartMonthKey : "";
  let availableBalance = 0;
  let totalAccruedLeaves = 0;
  let paidLeaveDaysUsed = 0;
  let unpaidEligibleDays = 0;

  function getMonthEntry(monthKey) {
    if (!monthBreakdownMap.has(monthKey)) {
      monthBreakdownMap.set(monthKey, {
        monthKey,
        monthlyCredit: 0,
        paidLeaveDaysUsed: 0,
        unpaidEligibleDays: 0,
        alwaysPaidDays: 0,
        availableBalance: 0,
      });
    }

    return monthBreakdownMap.get(monthKey);
  }

  function ensureCreditsThroughMonth(targetMonthKey) {
    if (!monthCursor || !targetMonthKey || monthCursor.localeCompare(targetMonthKey) > 0) {
      return;
    }

    while (monthCursor && monthCursor.localeCompare(targetMonthKey) <= 0) {
      const monthEntry = getMonthEntry(monthCursor);
      monthEntry.monthlyCredit += LEAVE_MONTHLY_CREDIT;

      availableBalance = Number(monthEntry.monthlyCredit || 0);
      totalAccruedLeaves += LEAVE_MONTHLY_CREDIT;
      monthEntry.availableBalance = availableBalance;

      monthCursor = getNextMonthKey(monthCursor);
    }
  }

  orderedLeaveRows.forEach((leaveRow) => {
    const leaveType = normalizeLeaveKey(leaveRow?.leave_type);
    const compensationMode = getLeaveCompensationMode(leaveRow);
    const startDate = normalizeDateOnlyValue(leaveRow?.from_date);
    const originalEndDate = normalizeDateOnlyValue(leaveRow?.to_date);
    const endDate = originalEndDate && originalEndDate.localeCompare(referenceDate) > 0
      ? referenceDate
      : originalEndDate;

    if (!startDate || !endDate || startDate.localeCompare(endDate) > 0) {
      return;
    }

    const dateKeys = leaveType === "half_day"
      ? [startDate]
      : getPayrollDateKeysInRange(startDate, endDate);

    dateKeys.forEach((dateKey) => {
      if (!dateKey || dateKey.localeCompare(referenceDate) > 0) return;

      const monthKey = getMonthKeyFromDateValue(dateKey);
      ensureCreditsThroughMonth(monthKey);

      const currentDecision = dayStatusMap.get(dateKey);
      if (leaveType === "half_day") {
        if (currentDecision?.unit === "full") return;

        dayStatusMap.set(dateKey, {
          unit: "half",
          paid: compensationMode === "paid",
          leaveType,
          leaveId: Number(leaveRow?.id || 0),
        });
        return;
      }

      if (currentDecision?.unit === "full") {
        return;
      }

      const monthEntry = getMonthEntry(monthKey);

      if (compensationMode === "balance") {
        if (availableBalance >= 1) {
          availableBalance -= 1;
          paidLeaveDaysUsed += 1;
          monthEntry.paidLeaveDaysUsed += 1;
          dayStatusMap.set(dateKey, {
            unit: "full",
            paid: true,
            leaveType,
            leaveId: Number(leaveRow?.id || 0),
            consumesMonthlyBalance: true,
          });
        } else {
          unpaidEligibleDays += 1;
          monthEntry.unpaidEligibleDays += 1;
          dayStatusMap.set(dateKey, {
            unit: "full",
            paid: false,
            leaveType,
            leaveId: Number(leaveRow?.id || 0),
            consumesMonthlyBalance: true,
          });
        }
      } else if (compensationMode === "paid") {
        monthEntry.alwaysPaidDays += 1;
        dayStatusMap.set(dateKey, {
          unit: "full",
          paid: true,
          leaveType,
          leaveId: Number(leaveRow?.id || 0),
          consumesMonthlyBalance: false,
        });
      } else {
        dayStatusMap.set(dateKey, {
          unit: "full",
          paid: false,
          leaveType,
          leaveId: Number(leaveRow?.id || 0),
          consumesMonthlyBalance: false,
        });
      }

      monthEntry.availableBalance = availableBalance;
    });
  });

  if (hasAccrualStarted) {
    ensureCreditsThroughMonth(referenceMonthKey);
  }

  const currentMonthEntry = monthBreakdownMap.get(referenceMonthKey) || {
    monthKey: referenceMonthKey,
    monthlyCredit: 0,
    paidLeaveDaysUsed: 0,
    unpaidEligibleDays: 0,
    alwaysPaidDays: 0,
    availableBalance,
  };
  const currentMonthCredit = Number(currentMonthEntry.monthlyCredit || 0);
  const currentMonthPaidLeavesUsed = Number(currentMonthEntry.paidLeaveDaysUsed || 0);
  const currentMonthUnusedCredit = Math.max(
    0,
    currentMonthCredit - currentMonthPaidLeavesUsed,
  );

  return {
    userId: normalizedUserId,
    employeeName: user?.name || "Employee",
    role: normalizeRoleValue(user?.role),
    joiningDate: normalizeDateOnlyValue(user?.joining_date) || null,
    accrualStartDate,
    accrualSource,
    referenceDate,
    referenceMonthKey,
    monthlyCredit: LEAVE_MONTHLY_CREDIT,
    totalAccruedLeaves,
    paidLeaveDaysUsed,
    unpaidEligibleDays,
    availableBalance,
    currentMonthCredit,
    currentMonthPaidLeavesUsed,
    currentMonthUnusedCredit,
    nextCreditDate: getFirstDateOfNextMonth(referenceMonthKey),
    approvedLeaveEntries: orderedLeaveRows.length,
    dayStatusMap,
    monthBreakdown: Array.from(monthBreakdownMap.values()).sort((left, right) =>
      String(left.monthKey || "").localeCompare(String(right.monthKey || "")),
    ),
  };
}

async function getLeaveBalanceUsersForAdmin(companyScope = "") {
  const whereClauses = [
    "LOWER(TRIM(COALESCE(role, ''))) <> 'admin'",
  ];
  const userScopeSql = getCompanyUserScopeSql(companyScope, "users");
  if (userScopeSql) {
    whereClauses.push(userScopeSql);
  }

  const [rows] = await dbPromise.query(
    `
      SELECT id, name, role, email, joining_date
      FROM users
      WHERE ${whereClauses.join(" AND ")}
      ORDER BY LOWER(TRIM(COALESCE(role, ''))) ASC, name ASC, id ASC
    `,
  );

  return rows;
}

function isDirectAdminLeaveRole(role) {
  return LEAVE_DIRECT_ADMIN_ROLES.has(normalizeRoleValue(role));
}

async function resolveLeaveApprovalChain(user) {
  const role = normalizeRoleValue(user?.role);
  const userEmail = normalizeEmailValue(user?.email);
  const leaderEmail = normalizeEmailValue(LEAVE_ROLE_LEADER_EMAILS[role]);

  if (!leaderEmail || isDirectAdminLeaveRole(role) || userEmail === leaderEmail) {
    return {
      approvalRoute: "admin",
      approvalStage: "admin_review",
      leaderStatus: "not_required",
      leaderUser: null,
      fallbackReason: "",
    };
  }

  const leaderUser = await getUserRecordByEmail(leaderEmail);

  if (!leaderUser) {
    return {
      approvalRoute: "admin",
      approvalStage: "admin_review",
      leaderStatus: "not_required",
      leaderUser: null,
      fallbackReason: `the configured ${role.toUpperCase()} leader profile is not available`,
    };
  }

  return {
    approvalRoute: "leader",
    approvalStage: "leader_review",
    leaderStatus: "pending",
    leaderUser,
    fallbackReason: "",
  };
}

function buildLeaveWorkflowMeta(row) {
  const status = normalizeLeaveStatus(row?.status) || "pending";
  const approvalRoute = normalizeLeaveApprovalRoute(row?.approval_route);
  let approvalStage = normalizeLeaveApprovalStage(row?.approval_stage);
  const leaderStatus = normalizeLeaderDecisionStatus(row?.leader_status);
  const leaderName = String(row?.leader_name || "").trim();
  const leaderReviewerName = String(row?.leader_reviewer_name || leaderName || "").trim();
  const adminReviewerName = String(row?.admin_reviewer_name || "").trim();

  if (!approvalStage) {
    if (status === "pending" && approvalRoute === "leader" && leaderStatus === "pending") {
      approvalStage = "leader_review";
    } else if (status === "pending") {
      approvalStage = "admin_review";
    } else {
      approvalStage = "completed";
    }
  }

  let approvalFlowLabel = "Pending with Admin";
  let currentReviewerLabel = "Admin";
  let decisionByLabel = "";
  let reviewRemark = "";
  let canAdminReview = 1;
  let canLeaderReview = 0;

  if (approvalRoute === "leader") {
    if (status === "pending" && leaderStatus === "pending") {
      approvalStage = "leader_review";
      approvalFlowLabel = leaderName
        ? `Pending with Leader: ${leaderName}`
        : "Pending with Leader";
      currentReviewerLabel = leaderName || "Group Leader";
      reviewRemark = String(row?.leader_remark || "").trim();
      canAdminReview = 0;
      canLeaderReview = 1;
    } else if (leaderStatus === "approved") {
      approvalStage = "completed";
      approvalFlowLabel = leaderReviewerName
        ? `Approved by Leader: ${leaderReviewerName}`
        : "Approved by Leader";
      currentReviewerLabel = "Completed";
      decisionByLabel = leaderReviewerName || "Leader";
      reviewRemark = String(row?.leader_remark || "").trim();
      canAdminReview = 0;
    } else if (leaderStatus === "rejected") {
      approvalStage = "completed";
      approvalFlowLabel = leaderReviewerName
        ? `Rejected by Leader: ${leaderReviewerName}`
        : "Rejected by Leader";
      currentReviewerLabel = "Completed";
      decisionByLabel = leaderReviewerName || "Leader";
      reviewRemark = String(row?.leader_remark || "").trim();
      canAdminReview = 0;
    }
  }

  if (canAdminReview) {
    if (status === "pending") {
      approvalStage = "admin_review";
      approvalFlowLabel = "Pending with Admin";
      currentReviewerLabel = "Admin";
      reviewRemark = String(row?.admin_remark || "").trim();
    } else if (status === "approved") {
      approvalStage = "completed";
      approvalFlowLabel = adminReviewerName
        ? `Approved by Admin: ${adminReviewerName}`
        : "Approved by Admin";
      currentReviewerLabel = "Completed";
      decisionByLabel = adminReviewerName || "Admin";
      reviewRemark = String(row?.admin_remark || "").trim();
    } else if (status === "rejected") {
      approvalStage = "completed";
      approvalFlowLabel = adminReviewerName
        ? `Rejected by Admin: ${adminReviewerName}`
        : "Rejected by Admin";
      currentReviewerLabel = "Completed";
      decisionByLabel = adminReviewerName || "Admin";
      reviewRemark = String(row?.admin_remark || "").trim();
    }
  }

  if (!reviewRemark) {
    if (status === "pending") {
      reviewRemark = canLeaderReview
        ? `Awaiting review from ${leaderName || "your group leader"}`
        : "Awaiting admin review";
    } else if (status === "approved") {
      reviewRemark = decisionByLabel ? `Approved by ${decisionByLabel}` : "Approved";
    } else if (status === "rejected") {
      reviewRemark = decisionByLabel ? `Rejected by ${decisionByLabel}` : "Rejected";
    }
  }

  return {
    status,
    approval_route: approvalRoute,
    approval_stage: approvalStage,
    leader_status: leaderStatus,
    approval_flow_label: approvalFlowLabel,
    current_reviewer_label: currentReviewerLabel,
    decision_by_label: decisionByLabel,
    review_remark: reviewRemark,
    can_admin_review: canAdminReview,
    can_leader_review: canLeaderReview,
  };
}

function serializeLeaveRequestRow(row) {
  if (!row) return null;
  return {
    ...row,
    ...buildLeaveWorkflowMeta(row),
  };
}

async function getLeaveRequestById(leaveId) {
  const normalizedLeaveId = Number(leaveId);
  if (!Number.isFinite(normalizedLeaveId) || normalizedLeaveId <= 0) return null;

  await ensureLeaveRequestsTable();
  const [rows] = await dbPromise.query(
    `
      SELECT
        id,
        user_id,
        employee_name,
        role,
        leave_type,
        from_date,
        to_date,
        total_days,
        is_paid,
        reason,
        attachment,
        status,
        approval_route,
        approval_stage,
        leader_user_id,
        leader_name,
        leader_email,
        leader_status,
        leader_remark,
        leader_reviewed_by,
        leader_reviewer_name,
        leader_reviewed_at,
        admin_remark,
        admin_reviewed_by,
        admin_reviewer_name,
        admin_reviewed_at,
        created_at,
        updated_at
      FROM leave_requests
      WHERE id = ?
      LIMIT 1
    `,
    [normalizedLeaveId],
  );

  return serializeLeaveRequestRow(rows[0] || null);
}

async function ensureAdminAccess(adminId) {
  const adminUser = await getUserRecordById(adminId);
  if (!adminUser || normalizeRoleValue(adminUser.role) !== "admin") {
    const error = new Error("Only admin can access this resource");
    error.statusCode = 403;
    throw error;
  }

  return adminUser;
}

async function ensureHrAccess(hrId) {
  const hrUser = await getUserRecordById(hrId);
  if (!hrUser || normalizeRoleValue(hrUser.role) !== "hr") {
    const error = new Error("Only HR can access this resource");
    error.statusCode = 403;
    throw error;
  }

  return hrUser;
}

async function ensureAdminOrHrAccess(userId) {
  const user = await getUserRecordById(userId);
  const role = normalizeRoleValue(user?.role);

  if (!user || (role !== "admin" && role !== "hr")) {
    const error = new Error("Only admin or HR can access this resource");
    error.statusCode = 403;
    throw error;
  }

  return user;
}

async function ensureLeaveLeaderAccess(leaderId) {
  const leaderUser = await getUserRecordById(leaderId);

  if (!leaderUser) {
    const error = new Error("Leader not found");
    error.statusCode = 404;
    throw error;
  }

  const expectedLeaderEmail = normalizeEmailValue(
    LEAVE_ROLE_LEADER_EMAILS[normalizeRoleValue(leaderUser.role)],
  );

  if (!expectedLeaderEmail || normalizeEmailValue(leaderUser.email) !== expectedLeaderEmail) {
    const error = new Error("Only configured team leaders can review these leave requests");
    error.statusCode = 403;
    throw error;
  }

  return leaderUser;
}

async function removeLeaveAttachment(attachmentPath) {
  const normalizedPath = String(attachmentPath || "").trim().replace(/^\/+/, "");
  if (!normalizedPath) return;

  const absolutePath = path.join(__dirname, normalizedPath);
  try {
    await fs.promises.unlink(absolutePath);
  } catch (err) {
    if (err.code !== "ENOENT") {
      console.error("Leave attachment cleanup failed:", err);
    }
  }
}

function getAttendanceMissingCheckoutSql(attAlias = "a", userAlias = "u") {
  return `(${attAlias}.check_in IS NOT NULL AND ${attAlias}.check_out IS NULL)`;
}

function getAttendanceRoleSql(userAlias = "u") {
  return `LOWER(TRIM(COALESCE(${userAlias}.role, '')))`;
}

function getAttendanceShiftStartSql(userAlias = "u") {
  const roleSql = getAttendanceRoleSql(userAlias);
  return `CASE
    WHEN ${roleSql} IN ('tme', 'me') THEN TIME('10:00:00')
    WHEN ${roleSql} IN ('dev', 'seo', 'smo') THEN TIME('08:00:00')
    ELSE TIME(SUBTIME(COALESCE(${userAlias}.logout_time, '18:00:00'), '08:00:00'))
  END`;
}

function getAttendanceShiftEndSql(userAlias = "u") {
  const roleSql = getAttendanceRoleSql(userAlias);
  return `CASE
    WHEN ${roleSql} IN ('tme', 'me') THEN TIME('19:00:00')
    WHEN ${roleSql} IN ('dev', 'seo', 'smo') THEN TIME('16:00:00')
    ELSE TIME(COALESCE(${userAlias}.logout_time, '18:00:00'))
  END`;
}

function getAttendanceGraceEndSql(userAlias = "u") {
  return `ADDTIME(${getAttendanceShiftStartSql(userAlias)}, '00:15:00')`;
}

function getAttendanceRequiredHoursSql(userAlias = "u") {
  const roleSql = getAttendanceRoleSql(userAlias);
  return `CASE
    WHEN ${roleSql} IN ('tme', 'me') THEN 9
    WHEN ${roleSql} IN ('dev', 'seo', 'smo') THEN 8
    ELSE 8
  END`;
}

function getAttendanceOverrideStatusSql(attAlias = "a") {
  return `NULLIF(TRIM(COALESCE(${attAlias}.admin_override_status, '')), '')`;
}

function getAttendanceStatusSql(attAlias = "a", userAlias = "u") {
  const missingCheckoutSql = getAttendanceMissingCheckoutSql(attAlias, userAlias);
  const overrideStatusSql = getAttendanceOverrideStatusSql(attAlias);
  const shiftStartSql = getAttendanceShiftStartSql(userAlias);
  const shiftEndSql = getAttendanceShiftEndSql(userAlias);
  const graceEndSql = getAttendanceGraceEndSql(userAlias);
  return `CASE
    WHEN ${overrideStatusSql} IS NOT NULL THEN ${overrideStatusSql}
    WHEN ${attAlias}.check_in IS NULL THEN 'absent'
    WHEN ${missingCheckoutSql} THEN 'checkout_pending'
    WHEN ${attAlias}.check_out IS NOT NULL AND TIME(${attAlias}.check_out) < ${shiftEndSql} THEN 'half_day'
    WHEN TIME(${attAlias}.check_in) > ${graceEndSql} THEN 'late'
    WHEN TIME(${attAlias}.check_in) > ${shiftStartSql} THEN 'grace'
    ELSE 'present'
  END`;
}

function getAttendanceStatusLabelSql(attAlias = "a", userAlias = "u") {
  const missingCheckoutSql = getAttendanceMissingCheckoutSql(attAlias, userAlias);
  const overrideStatusSql = getAttendanceOverrideStatusSql(attAlias);
  const shiftStartSql = getAttendanceShiftStartSql(userAlias);
  const shiftEndSql = getAttendanceShiftEndSql(userAlias);
  const graceEndSql = getAttendanceGraceEndSql(userAlias);
  return `CASE
    WHEN ${overrideStatusSql} = 'present' THEN 'Present'
    WHEN ${overrideStatusSql} = 'grace' THEN 'Grace'
    WHEN ${overrideStatusSql} = 'late' THEN 'Late'
    WHEN ${overrideStatusSql} = 'half_day' THEN 'Half Day'
    WHEN ${overrideStatusSql} = 'absent' THEN 'Absent'
    WHEN ${overrideStatusSql} = 'checkout_pending' THEN 'Checkout Pending'
    WHEN ${attAlias}.check_in IS NULL THEN 'Absent'
    WHEN ${missingCheckoutSql} THEN 'Checkout Pending'
    WHEN ${attAlias}.check_out IS NOT NULL AND TIME(${attAlias}.check_out) < ${shiftEndSql} THEN 'Half Day'
    WHEN TIME(${attAlias}.check_in) > ${graceEndSql} THEN 'Late'
    WHEN TIME(${attAlias}.check_in) > ${shiftStartSql} THEN 'Grace'
    ELSE 'Present'
  END`;
}

function getAttendanceWorkingHoursSql(attAlias = "a", userAlias = "u") {
  const missingCheckoutSql = getAttendanceMissingCheckoutSql(attAlias, userAlias);
  const currentDateTimeSql = `TIMESTAMP('${getAppDateTimeParts().dateTimeSql}')`;
  return `CASE
    WHEN ${attAlias}.check_in IS NULL THEN '00:00'
    WHEN ${missingCheckoutSql} THEN 'Pending'
    ELSE CONCAT(
      FLOOR(TIMESTAMPDIFF(SECOND, ${attAlias}.check_in, COALESCE(${attAlias}.check_out, ${currentDateTimeSql})) / 3600),
      ':',
      LPAD(FLOOR((TIMESTAMPDIFF(SECOND, ${attAlias}.check_in, COALESCE(${attAlias}.check_out, ${currentDateTimeSql})) % 3600) / 60), 2, '0')
    )
  END`;
}

const ATTENDANCE_TRACKING_START_DATE = "2026-05-01";
const ATTENDANCE_OFFICE_LOCATION = {
  latitude: Number(process.env.ATTENDANCE_OFFICE_LAT || 19.168507),
  longitude: Number(process.env.ATTENDANCE_OFFICE_LNG || 72.842137),
  radiusMeters: Number(process.env.ATTENDANCE_GEOFENCE_RADIUS_METERS || 50),
  address:
    process.env.ATTENDANCE_OFFICE_ADDRESS ||
    "Riddhi Siddhi Complex, E-107, Swami Vivekananda Rd, opposite Patkar College, Unnat Nagar, Goregaon West, Mumbai, Maharashtra 400104",
};
const ATTENDANCE_GPS_ACCURACY_BUFFER_METERS = Number(
  process.env.ATTENDANCE_GPS_ACCURACY_BUFFER_METERS || 100,
);
const ATTENDANCE_OFFSITE_DEFAULT_RADIUS_METERS = Number(
  process.env.ATTENDANCE_OFFSITE_DEFAULT_RADIUS_METERS || 50000,
);
const ATTENDANCE_OFFSITE_MAX_RADIUS_METERS = Number(
  process.env.ATTENDANCE_OFFSITE_MAX_RADIUS_METERS || 50000,
);

function normalizeAttendanceRole(role) {
  return String(role || "")
    .toLowerCase()
    .trim();
}

function padAttendanceTimeSegment(value) {
  return String(value).padStart(2, "0");
}

function normalizeAttendanceTimeString(value, fallback = "00:00:00") {
  const timeValue = String(value || fallback).trim();
  const [hours = "00", minutes = "00", seconds = "00"] = timeValue.split(":");
  return `${padAttendanceTimeSegment(hours)}:${padAttendanceTimeSegment(minutes)}:${padAttendanceTimeSegment(seconds)}`;
}

function timeStringToMinutes(value) {
  const normalized = normalizeAttendanceTimeString(value);
  const [hours, minutes] = normalized.split(":");
  return (Number(hours) * 60) + Number(minutes);
}

function minutesToTimeString(totalMinutes) {
  const normalizedMinutes = ((Number(totalMinutes) % 1440) + 1440) % 1440;
  const hours = Math.floor(normalizedMinutes / 60);
  const minutes = normalizedMinutes % 60;
  return `${padAttendanceTimeSegment(hours)}:${padAttendanceTimeSegment(minutes)}:00`;
}

function getAppDateTimeParts(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  const safeDate = Number.isNaN(date.getTime()) ? new Date() : date;
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: APP_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    hourCycle: "h23",
  });
  const parts = Object.fromEntries(
    formatter
      .formatToParts(safeDate)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );
  const hour = parts.hour === "24" ? "00" : parts.hour;
  const dateKey = `${parts.year}-${parts.month}-${parts.day}`;
  const timeKey = `${hour}:${parts.minute}:${parts.second}`;

  return {
    dateKey,
    timeKey,
    dateTimeSql: `${dateKey} ${timeKey}`,
  };
}

function addDaysToDateKey(dateKey, days) {
  const normalizedDate = String(dateKey || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalizedDate)) {
    return getAttendanceDateKey();
  }

  const [year, month, day] = normalizedDate.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + Number(days || 0)));
  return date.toISOString().slice(0, 10);
}

function toRadians(value) {
  return (Number(value) * Math.PI) / 180;
}

function calculateDistanceInMeters(lat1, lng1, lat2, lng2) {
  const earthRadiusMeters = 6371000;
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

function getAttendanceAccuracyBuffer(accuracyMeters = 0) {
  return Math.min(
    Math.max(Number(accuracyMeters) || 0, 0),
    Math.max(ATTENDANCE_GPS_ACCURACY_BUFFER_METERS, 0),
  );
}

function validateAttendanceGeofence(lat, lng, accuracyMeters = 0) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    const error = new Error(
      "Location is required for attendance. Please allow location permission.",
    );
    error.statusCode = 400;
    throw error;
  }

  const distanceMeters = calculateDistanceInMeters(
    lat,
    lng,
    ATTENDANCE_OFFICE_LOCATION.latitude,
    ATTENDANCE_OFFICE_LOCATION.longitude,
  );
  const gpsAccuracyBuffer = getAttendanceAccuracyBuffer(accuracyMeters);
  const effectiveRadiusMeters =
    Number(ATTENDANCE_OFFICE_LOCATION.radiusMeters || 0) + gpsAccuracyBuffer;

  if (distanceMeters > effectiveRadiusMeters) {
    const roundedDistanceMeters = Math.round(distanceMeters);
    const error = new Error(
      `Check-in / check-out only works within ${ATTENDANCE_OFFICE_LOCATION.radiusMeters}m of ${ATTENDANCE_OFFICE_LOCATION.address}. Current distance is about ${roundedDistanceMeters}m.`,
    );
    error.statusCode = 400;
    throw error;
  }

  return distanceMeters;
}

function getAttendanceOfficeZone() {
  return {
    type: "office",
    label: "Office",
    latitude: Number(ATTENDANCE_OFFICE_LOCATION.latitude),
    longitude: Number(ATTENDANCE_OFFICE_LOCATION.longitude),
    radiusMeters: Number(ATTENDANCE_OFFICE_LOCATION.radiusMeters || 0),
    address: ATTENDANCE_OFFICE_LOCATION.address,
    locationUrl: `https://www.google.com/maps?q=${ATTENDANCE_OFFICE_LOCATION.latitude},${ATTENDANCE_OFFICE_LOCATION.longitude}`,
  };
}

function buildAttendanceLocationUrl(lat, lng) {
  if (!Number.isFinite(Number(lat)) || !Number.isFinite(Number(lng))) {
    return null;
  }

  return `https://www.google.com/maps?q=${Number(lat)},${Number(lng)}`;
}

function normalizeAttendanceLocationRequestStatus(status, fallback = "pending") {
  const normalizedStatus = String(status || "")
    .trim()
    .toLowerCase();
  const allowedStatuses = new Set(["pending", "approved", "rejected", "cancelled"]);
  return allowedStatuses.has(normalizedStatus) ? normalizedStatus : fallback;
}

function normalizeAttendanceRadiusMeters(
  value,
  fallback = ATTENDANCE_OFFSITE_DEFAULT_RADIUS_METERS,
) {
  const numericValue = Math.round(Number(value));
  const baseValue = Number.isFinite(numericValue) && numericValue > 0
    ? numericValue
    : Math.round(Number(fallback) || ATTENDANCE_OFFSITE_DEFAULT_RADIUS_METERS);

  const minimumRadius = Math.min(
    ATTENDANCE_OFFSITE_DEFAULT_RADIUS_METERS,
    ATTENDANCE_OFFSITE_MAX_RADIUS_METERS,
  );

  return Math.max(
    minimumRadius,
    Math.min(ATTENDANCE_OFFSITE_MAX_RADIUS_METERS, baseValue),
  );
}

function getAttendanceDateKey(dateValue = new Date()) {
  if (typeof dateValue === "string") {
    const normalizedDate = dateValue.trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(normalizedDate)) {
      return normalizedDate.slice(0, 10);
    }
  }

  return getAppDateTimeParts(dateValue).dateKey;
}

function buildAttendanceLocationRequestPayload(row) {
  if (!row) return null;

  return {
    id: Number(row.id || 0),
    userId: Number(row.user_id || 0),
    attendanceDate: row.attendance_date || null,
    purpose: String(row.purpose || "").trim(),
    meetingWith: String(row.meeting_with || "").trim(),
    notes: String(row.notes || "").trim(),
    status: normalizeAttendanceLocationRequestStatus(row.status),
    adminRemark: String(row.admin_remark || "").trim(),
    reviewedBy: Number(row.reviewed_by || 0) || null,
    reviewedByName: String(row.reviewed_by_name || "").trim(),
    reviewedAt: row.reviewed_at || null,
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
    requestedLat: Number(row.requested_lat),
    requestedLng: Number(row.requested_lng),
    requestedAccuracy: Number(row.requested_accuracy || 0) || 0,
    requestedRadiusMeters: normalizeAttendanceRadiusMeters(
      row.requested_radius_meters,
      ATTENDANCE_OFFSITE_DEFAULT_RADIUS_METERS,
    ),
    requestedLocationUrl:
      String(row.requested_location_url || "").trim() ||
      buildAttendanceLocationUrl(row.requested_lat, row.requested_lng),
    requestedAddress: String(row.requested_address || "").trim(),
    approvedLat: Number.isFinite(Number(row.approved_lat))
      ? Number(row.approved_lat)
      : Number(row.requested_lat),
    approvedLng: Number.isFinite(Number(row.approved_lng))
      ? Number(row.approved_lng)
      : Number(row.requested_lng),
    approvedRadiusMeters: normalizeAttendanceRadiusMeters(
      row.approved_radius_meters,
      row.requested_radius_meters || ATTENDANCE_OFFSITE_DEFAULT_RADIUS_METERS,
    ),
    approvedLocationUrl:
      String(row.approved_location_url || "").trim() ||
      buildAttendanceLocationUrl(
        Number.isFinite(Number(row.approved_lat)) ? row.approved_lat : row.requested_lat,
        Number.isFinite(Number(row.approved_lng)) ? row.approved_lng : row.requested_lng,
      ),
    approvedAddress:
      String(row.approved_address || "").trim() ||
      String(row.requested_address || "").trim(),
  };
}

function getAttendanceApprovedZone(request) {
  if (!request) return null;

  return {
    type: "approved_offsite",
    label: "Approved Meeting Location",
    latitude: Number(request.approvedLat),
    longitude: Number(request.approvedLng),
    radiusMeters: normalizeAttendanceRadiusMeters(
      request.approvedRadiusMeters,
      ATTENDANCE_OFFSITE_DEFAULT_RADIUS_METERS,
    ),
    address: request.approvedAddress || request.requestedAddress || "Approved meeting location",
    locationUrl:
      request.approvedLocationUrl ||
      request.requestedLocationUrl ||
      buildAttendanceLocationUrl(request.approvedLat, request.approvedLng),
  };
}

function evaluateAttendanceZoneDistance(lat, lng, zone, accuracyMeters = 0) {
  const distanceMeters = calculateDistanceInMeters(
    lat,
    lng,
    Number(zone.latitude),
    Number(zone.longitude),
  );
  const effectiveRadiusMeters =
    Number(zone.radiusMeters || 0) + getAttendanceAccuracyBuffer(accuracyMeters);

  return {
    distanceMeters,
    effectiveRadiusMeters,
    withinRange: distanceMeters <= effectiveRadiusMeters,
  };
}

async function getLatestAttendanceLocationRequest(userId, attendanceDate = getAttendanceDateKey()) {
  const normalizedUserId = Number(userId);
  const normalizedDate = getAttendanceDateKey(attendanceDate);

  if (!normalizedUserId || !normalizedDate) return null;

  await ensureAttendanceLocationRequestsTable();
  const requestDateColumn = quoteDbIdentifier(
    await getAttendanceLocationRequestDateColumn(),
  );
  const [rows] = await dbPromise.query(
    `
      SELECT
        id,
        user_id,
        DATE_FORMAT(${requestDateColumn}, '%Y-%m-%d') AS attendance_date,
        purpose,
        meeting_with,
        notes,
        requested_lat,
        requested_lng,
        requested_accuracy,
        requested_location_url,
        requested_address,
        requested_radius_meters,
        status,
        admin_remark,
        reviewed_by,
        reviewed_by_name,
        DATE_FORMAT(reviewed_at, '%Y-%m-%d %H:%i:%s') AS reviewed_at,
        approved_lat,
        approved_lng,
        approved_location_url,
        approved_address,
        approved_radius_meters,
        DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') AS created_at,
        DATE_FORMAT(updated_at, '%Y-%m-%d %H:%i:%s') AS updated_at
      FROM attendance_location_requests
      WHERE user_id = ? AND ${requestDateColumn} = ?
      ORDER BY id DESC
      LIMIT 1
    `,
    [normalizedUserId, normalizedDate],
  );

  return rows.length ? buildAttendanceLocationRequestPayload(rows[0]) : null;
}

async function getAttendanceLocationRequestContext(
  userId,
  attendanceDate = getAttendanceDateKey(),
) {
  const officeZone = getAttendanceOfficeZone();
  const activeRequest = await getLatestAttendanceLocationRequest(userId, attendanceDate);
  const approvedZone =
    activeRequest?.status === "approved"
      ? getAttendanceApprovedZone(activeRequest)
      : null;

  return {
    officeZone,
    activeRequest,
    activeZone: approvedZone || officeZone,
    approvedZone,
  };
}

async function validateAttendanceAccessLocation({
  userId,
  lat,
  lng,
  accuracyMeters = 0,
  attendanceDate = getAttendanceDateKey(),
}) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    const error = new Error(
      "Location is required for attendance. Please allow location permission.",
    );
    error.statusCode = 400;
    throw error;
  }

  const [userRows] = await dbPromise.query(
    `
      SELECT role
      FROM users
      WHERE id = ?
      LIMIT 1
    `,
    [userId],
  );
  const userRole = normalizeAttendanceRole(userRows[0]?.role);

  if (userRole === "tme") {
    return {
      zone: {
        type: "live_location",
        label: "Live Location",
        latitude: lat,
        longitude: lng,
        radiusMeters: 0,
        address: "TME live attendance location",
        locationUrl: buildAttendanceLocationUrl(lat, lng),
      },
      zoneType: "live_location",
      distanceMeters: 0,
    };
  }

  const officeZone = getAttendanceOfficeZone();
  const officeMatch = evaluateAttendanceZoneDistance(
    lat,
    lng,
    officeZone,
    accuracyMeters,
  );

  if (officeMatch.withinRange) {
    return {
      zone: officeZone,
      zoneType: officeZone.type,
      distanceMeters: officeMatch.distanceMeters,
    };
  }

  const activeRequest = await getLatestAttendanceLocationRequest(userId, attendanceDate);
  const approvedZone =
    activeRequest?.status === "approved"
      ? getAttendanceApprovedZone(activeRequest)
      : null;

  if (approvedZone) {
    const approvedMatch = evaluateAttendanceZoneDistance(
      lat,
      lng,
      approvedZone,
      accuracyMeters,
    );

    if (approvedMatch.withinRange) {
      return {
        zone: approvedZone,
        zoneType: approvedZone.type,
        distanceMeters: approvedMatch.distanceMeters,
        requestId: activeRequest.id,
      };
    }

    const error = new Error(
      `Admin has approved attendance within ${approvedZone.radiusMeters}m of ${approvedZone.address}. Your current distance is about ${Math.round(approvedMatch.distanceMeters)}m.`,
    );
    error.statusCode = 400;
    throw error;
  }

  const approvalHint =
    activeRequest?.status === "pending"
      ? " Your offsite request is still pending admin approval."
      : activeRequest?.status === "rejected"
        ? activeRequest.adminRemark
          ? ` Admin note: ${activeRequest.adminRemark}`
          : " Your latest offsite request was rejected."
        : " Send an offsite location request to admin if you are at a meeting location.";

  const error = new Error(
    `Check-in / check-out only works within ${ATTENDANCE_OFFICE_LOCATION.radiusMeters}m of ${ATTENDANCE_OFFICE_LOCATION.address}.${approvalHint}`,
  );
  error.statusCode = 400;
  throw error;
}

function getAttendanceShiftConfigForRole(role, logoutTime = "18:00:00") {
  const normalizedRole = normalizeAttendanceRole(role);

  if (normalizedRole === "tme") {
    return {
      shiftStart: "10:00:00",
      shiftEnd: "19:00:00",
      graceEnd: "10:05:00",
      requiredHours: 9,
    };
  }

  if (normalizedRole === "me") {
    return {
      shiftStart: "10:00:00",
      shiftEnd: "19:00:00",
      graceEnd: "10:15:00",
      requiredHours: 9,
    };
  }

  if (normalizedRole === "dev") {
    return {
      shiftStart: "08:00:00",
      shiftEnd: "16:00:00",
      graceEnd: "08:05:00",
      requiredHours: 8,
    };
  }

  if (normalizedRole === "seo" || normalizedRole === "smo") {
    return {
      shiftStart: "08:00:00",
      shiftEnd: "16:00:00",
      graceEnd: "08:15:00",
      requiredHours: 8,
    };
  }

  const normalizedLogout = normalizeAttendanceTimeString(logoutTime, "18:00:00");
  const shiftEndMinutes = timeStringToMinutes(normalizedLogout);
  const shiftStartMinutes = shiftEndMinutes - (8 * 60);

  return {
    shiftStart: minutesToTimeString(shiftStartMinutes),
    shiftEnd: normalizedLogout,
    graceEnd: minutesToTimeString(shiftStartMinutes + 15),
    requiredHours: 8,
  };
}

function isAttendanceDateAutoAbsent(attendanceDate, shiftEnd, now = new Date()) {
  if (!attendanceDate) return false;

  const currentAppTime = getAppDateTimeParts(now);
  const todayKey = currentAppTime.dateKey;
  if (attendanceDate < todayKey) return true;
  if (attendanceDate > todayKey) return false;

  const currentTime = currentAppTime.timeKey;
  return currentTime > normalizeAttendanceTimeString(shiftEnd);
}

function computeAttendanceDerivedStatus({
  attendanceDate,
  checkIn,
  checkOut,
  overrideStatus,
  role,
  logoutTime,
  now = new Date(),
}) {
  const normalizedOverride = String(overrideStatus || "")
    .toLowerCase()
    .trim()
    .replace(/[\s-]+/g, "_");

  if (normalizedOverride) {
    return normalizedOverride;
  }

  const shiftConfig = getAttendanceShiftConfigForRole(role, logoutTime);

  if (!checkIn) {
    return isAttendanceDateAutoAbsent(attendanceDate, shiftConfig.shiftEnd, now)
      ? "absent"
      : "not_marked";
  }

  if (!checkOut) {
    return "checkout_pending";
  }

  const normalizedCheckIn = normalizeAttendanceTimeString(checkIn);
  const normalizedCheckOut = normalizeAttendanceTimeString(checkOut);

  if (normalizedCheckOut < shiftConfig.shiftEnd) {
    return "half_day";
  }

  if (normalizedCheckIn > shiftConfig.graceEnd) {
    return "late";
  }

  if (normalizedCheckIn > shiftConfig.shiftStart) {
    return "grace";
  }

  return "present";
}

function getAttendanceStatusLabel(status) {
  switch (String(status || "").toLowerCase().trim().replace(/[\s-]+/g, "_")) {
    case "present":
      return "Present";
    case "grace":
      return "Grace";
    case "late":
      return "Late";
    case "half_day":
      return "Half Day";
    case "checkout_pending":
      return "Checkout Pending";
    case "absent":
      return "Absent";
    default:
      return "Not Marked";
  }
}

function formatAttendanceWorkingHoursFromTimes(checkIn, checkOut) {
  if (!checkIn) return "00:00";
  if (!checkOut) return "Pending";

  const baseDate = "2000-01-01";
  const checkInDate = new Date(`${baseDate}T${normalizeAttendanceTimeString(checkIn)}`);
  let checkOutDate = new Date(`${baseDate}T${normalizeAttendanceTimeString(checkOut)}`);

  if (checkOutDate < checkInDate) {
    checkOutDate = new Date(checkOutDate.getTime() + (24 * 60 * 60 * 1000));
  }

  const diffMinutes = Math.max(0, Math.floor((checkOutDate - checkInDate) / 60000));
  const hours = Math.floor(diffMinutes / 60);
  const minutes = diffMinutes % 60;

  return `${hours}:${padAttendanceTimeSegment(minutes)}`;
}

const ATTENDANCE_AUTO_CHECKOUT_DELAY_MS = 15000;
const pendingAttendanceAutoCheckoutTimers = new Map();

function parseAttendanceCheckoutDate(value) {
  const parsedDate = value ? new Date(value) : new Date();
  return Number.isNaN(parsedDate.getTime()) ? new Date() : parsedDate;
}

function formatAttendanceDateTimeForSql(value) {
  return getAppDateTimeParts(parseAttendanceCheckoutDate(value)).dateTimeSql;
}

function getAttendanceAutoCheckoutKey(userId, sessionId) {
  return `${Number(userId) || 0}:${String(sessionId || "").trim()}`;
}

function clearPendingAttendanceAutoCheckout(userId, sessionId) {
  const timerKey = getAttendanceAutoCheckoutKey(userId, sessionId);
  const activeTimer = pendingAttendanceAutoCheckoutTimers.get(timerKey);

  if (activeTimer) {
    clearTimeout(activeTimer);
    pendingAttendanceAutoCheckoutTimers.delete(timerKey);
    return true;
  }

  return false;
}

async function finalizeAttendanceCheckout({
  userId,
  checkoutAt = new Date(),
  scope = "today",
}) {
  const normalizedUserId = Number(userId);
  if (!normalizedUserId) {
    const error = new Error("Invalid user id");
    error.statusCode = 400;
    throw error;
  }

  await ensureAttendanceTable();
  await ensureUserShiftColumns();

  const attendanceTodayKey = getAttendanceDateKey();
  const attendanceDateColumn = quoteDbIdentifier(await getAttendanceTableDateColumn());
  const targetSql = scope === "latest_open"
    ? `
      SELECT DATE_FORMAT(${attendanceDateColumn}, '%Y-%m-%d') AS attendance_date
      FROM attendance
      WHERE user_id = ? AND check_in IS NOT NULL AND check_out IS NULL
      ORDER BY ${attendanceDateColumn} DESC, check_in DESC
      LIMIT 1
    `
    : `
      SELECT DATE_FORMAT(${attendanceDateColumn}, '%Y-%m-%d') AS attendance_date
      FROM attendance
      WHERE user_id = ? AND ${attendanceDateColumn} = ? AND check_in IS NOT NULL
      LIMIT 1
    `;

  const targetParams = scope === "latest_open"
    ? [normalizedUserId]
    : [normalizedUserId, attendanceTodayKey];
  const [attendanceRows] = await dbPromise.query(targetSql, targetParams);
  const attendanceDate = attendanceRows[0]?.attendance_date || "";

  if (!attendanceDate) {
    return {
      success: true,
      noop: true,
      message: "No pending checkout found",
      status: null,
      logout_time: null,
      check_out: null,
      attendance_date: null,
    };
  }

  const checkoutValue = formatAttendanceDateTimeForSql(checkoutAt);
  const [updateResult] = await dbPromise.query(
    `
      UPDATE attendance
      SET check_out = ?
      WHERE user_id = ? AND ${attendanceDateColumn} = ? AND check_in IS NOT NULL AND check_out IS NULL
    `,
    [checkoutValue, normalizedUserId, attendanceDate],
  );

  if (updateResult.affectedRows === 0) {
    return {
      success: true,
      noop: true,
      message: "No pending checkout found",
      status: null,
      logout_time: null,
      check_out: null,
      attendance_date: attendanceDate,
    };
  }

  const attendanceStatusSql = getAttendanceStatusSql("a", "u");
  const shiftEndSql = getAttendanceShiftEndSql("u");
  const [statusRows] = await dbPromise.query(
    `
      SELECT
        ${attendanceStatusSql} AS status,
        TIME_FORMAT(${shiftEndSql}, '%H:%i') AS logout_time,
        DATE_FORMAT(a.check_out, '%H:%i:%s') AS check_out,
        DATE_FORMAT(a.${attendanceDateColumn}, '%Y-%m-%d') AS attendance_date
      FROM attendance a
      LEFT JOIN users u ON u.id = a.user_id
      WHERE a.user_id = ? AND a.${attendanceDateColumn} = ?
      LIMIT 1
    `,
    [normalizedUserId, attendanceDate],
  );

  const checkoutStatus = statusRows[0]?.status || "present";

  return {
    success: true,
    noop: false,
    message:
      checkoutStatus === "half_day"
        ? "Check-out saved as Half Day"
        : "Check-out saved",
    status: checkoutStatus,
    logout_time: statusRows[0]?.logout_time || null,
    check_out: statusRows[0]?.check_out || null,
    attendance_date: statusRows[0]?.attendance_date || attendanceDate,
  };
}

function isBeforeAttendanceTrackingStart(dateString) {
  const normalizedDate = String(dateString || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalizedDate)) return false;
  return normalizedDate < ATTENDANCE_TRACKING_START_DATE;
}

function clampAttendanceTrackingStart(dateString) {
  const normalizedDate = String(dateString || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalizedDate)) {
    return ATTENDANCE_TRACKING_START_DATE;
  }

  return normalizedDate < ATTENDANCE_TRACKING_START_DATE
    ? ATTENDANCE_TRACKING_START_DATE
    : normalizedDate;
}

function getAttendanceMonthStart(dateString) {
  const normalizedDate = String(dateString || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalizedDate)) {
    return ATTENDANCE_TRACKING_START_DATE;
  }

  return clampAttendanceTrackingStart(`${normalizedDate.slice(0, 7)}-01`);
}

function getAttendanceDateRange(startDate, endDate) {
  const range = [];
  const start = String(startDate || "").trim();
  const end = String(endDate || "").trim();

  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(start) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(end) ||
    start > end
  ) {
    return range;
  }

  for (let cursor = start; cursor <= end; cursor = addDaysToDateKey(cursor, 1)) {
    range.push(cursor);
  }

  return range;
}

function createAttendanceSummaryCounts() {
  return {
    present: 0,
    grace: 0,
    late: 0,
    halfDay: 0,
    checkoutPending: 0,
    absent: 0,
    lateLeaveEquivalent: 0,
    lateBalance: 0,
  };
}

function incrementAttendanceSummary(summary, status) {
  const normalizedStatus = String(status || "")
    .toLowerCase()
    .trim()
    .replace(/[\s-]+/g, "_");

  if (normalizedStatus === "present") summary.present += 1;
  if (normalizedStatus === "grace") summary.grace += 1;
  if (normalizedStatus === "late") summary.late += 1;
  if (normalizedStatus === "half_day") summary.halfDay += 1;
  if (normalizedStatus === "checkout_pending") summary.checkoutPending += 1;
  if (normalizedStatus === "absent") summary.absent += 1;
}

function buildAttendanceMonthlySummary({
  users = [],
  attendanceRows = [],
  startDate,
  endDate,
  now = new Date(),
}) {
  const summary = createAttendanceSummaryCounts();
  const dateRange = getAttendanceDateRange(startDate, endDate);
  const attendanceMap = new Map();

  attendanceRows.forEach((row) => {
    if (!row?.user_id || !row?.attendance_date) return;

    if (!attendanceMap.has(row.user_id)) {
      attendanceMap.set(row.user_id, new Map());
    }

    attendanceMap.get(row.user_id).set(row.attendance_date, row);
  });

  users.forEach((user) => {
    const userAttendance = attendanceMap.get(user.user_id) || new Map();

    dateRange.forEach((attendanceDate) => {
      const record = userAttendance.get(attendanceDate);
      const derivedStatus = computeAttendanceDerivedStatus({
        attendanceDate,
        checkIn: record?.check_in || null,
        checkOut: record?.check_out || null,
        overrideStatus: record?.admin_override_status || null,
        role: user.role,
        logoutTime: user.logout_time,
        now,
      });

      if (derivedStatus === "not_marked") {
        return;
      }

      incrementAttendanceSummary(summary, derivedStatus);
    });
  });

  summary.lateLeaveEquivalent = Math.floor(summary.late / 3);
  summary.lateBalance = summary.late % 3;

  return {
    ...summary,
    startDate,
    endDate,
    totalUsers: users.length,
    totalDays: dateRange.length,
  };
}

app.get("/test-users", async (req, res) => {
  try {
    const whereParts = [];
    addRequestedUserCompanyScope(req, whereParts, "users");
    const [rows] = await dbPromise.query(
      `SELECT * FROM users${whereParts.length ? ` WHERE ${whereParts.join(" AND ")}` : ""}`,
    );
    res.json(
      rows.map((row) => {
        const {
          attendance_face_image: _attendanceFaceImage,
          attendance_face_signature: _attendanceFaceSignature,
          ...safeRow
        } = row;

        return {
          ...safeRow,
          attendance_face_enrolled: Boolean(row.attendance_face_enrolled_at),
        };
      }),
    );
  } catch (err) {
    console.error("Test users error:", err);
    res.status(500).json({ success: false, message: "Database error" });
  }
});

// async function testDB() {
//   try {
//     const [rows] = await db.query("SELECT * FROM users");
//     console.log(rows);
//   } catch (err) {
//     console.error(err);
//   }
// }

// testDB();

// ====================== ROUTES ======================

// Home Route
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "mp.html"));
});

app.get("/favicon.ico", (req, res) => {
  res.sendFile(path.join(__dirname, "logo.png"));
});

// Health Check
app.get("/api/health", (req, res) => {
  res.json({ success: true, message: "Server is running" });
});

app.get("/api/users/next-employee-code", async (req, res) => {
  try {
    const companyScope = getRequestedCompanyScope(req);
    const employeeCode = await getNextEmployeeCode(companyScope);
    res.json({
      success: true,
      employeeCode,
      data: {
        employee_code: employeeCode,
        company_scope: companyScope || "metrics",
      },
    });
  } catch (err) {
    console.error("Next employee code error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to generate employee code",
    });
  }
});

app.post("/register", (req, res) => {
  userRegistrationUpload(req, res, async (uploadErr) => {
    if (uploadErr) {
      const message =
        uploadErr instanceof multer.MulterError
          ? uploadErr.code === "LIMIT_FILE_SIZE"
            ? "Each registration file must be 15 MB or smaller."
            : uploadErr.message
          : uploadErr.message || "Failed to upload registration files";

      return res.status(400).json({
        success: false,
        message,
      });
    }

    let employeeCode = null;
    const name = String(req.body.name || "").trim();
    const dateOfBirth = normalizeDateOnlyValue(req.body.date_of_birth) || null;
    const gender = String(req.body.gender || "").trim().toLowerCase() || null;
    const nationality = String(req.body.nationality || "").trim() || null;
    const email = String(req.body.email || "").trim();
    const contact = String(req.body.contact || "").trim();
    const altContact = String(req.body.alt_contact || "").trim() || null;
    const address = String(req.body.address || "").trim() || null;
    const aadharNo = String(req.body.aadhar_no || "").trim();
    const panNumber = String(req.body.pan_number || "").trim() || null;
    const accountNo = String(req.body.account_no || "").trim();
    const bankName = String(req.body.bank_name || "").trim();
    const ifscCode = String(req.body.ifsc_code || "").trim().toUpperCase();
    const beneficiaryName = String(req.body.beneficiary_name || "").trim();
    const spswd = String(req.body.spswd || "");
    const cpswd = String(req.body.cpswd || "");
    const role = String(req.body.role || "").trim().toLowerCase();
    const compName = String(req.body.comp_name || "").trim();
    const loginTime = String(req.body.login_time || "").trim();
    const logoutTime = String(req.body.logout_time || "").trim() || "18:00";
    const rawSalary = String(req.body.salary ?? "").trim();
    const salary = normalizePayrollAmount(rawSalary);
    const requestedCompensationType = normalizeCompensationType(req.body.compensation_type);
    const compensationType = SALES_COMMISSION_ROLES.has(role)
      ? requestedCompensationType
      : "salary";
    const commissionPercent = getFixedSalesCommissionPercent(compensationType);
    const storedSalary = compensationType === "commission" ? 0 : salary;
    const joiningDate = normalizeDateOnlyValue(req.body.joining_date) || null;
    const totalExperience = String(req.body.total_experience || "").trim() || null;
    const pfEnabled = normalizePayrollBoolean(req.body.pf_enabled) ? 1 : 0;
    const pfNumber = pfEnabled
      ? String(req.body.pf_number || "").trim() || null
      : null;
    const uanNumber = pfEnabled
      ? String(req.body.uan_number || "").trim() || null
      : null;
    const employeePfNumber = pfEnabled
      ? String(req.body.employee_pf_number || "").trim() || null
      : null;
    const employerPfNumber = pfEnabled
      ? String(req.body.employer_pf_number || "").trim() || null
      : null;
    const pfJoiningDate = pfEnabled
      ? normalizeDateOnlyValue(req.body.pf_joining_date) || null
      : null;
    const createdBy = Number(req.body.created_by || req.body.updated_by || 0) || null;
    const profImg = await getUploadedFilePath(req.files, "prof_img");
    const aadharImg = await getUploadedFilePath(req.files, "aadhar_img");
    const panImg = await getUploadedFilePath(req.files, "pan_img");
    const cancelledCheque = await getUploadedFilePath(req.files, "cancelled_cheque");
    const resumeFile = await getUploadedFilePath(req.files, "resume_file");
    const experienceFile = await getUploadedFilePath(req.files, "experience_file");
    const certificationFile = await getUploadedFilePath(
      req.files,
      "certification_file",
    );
    const otherDocuments = await getMergedOtherDocuments(req.files);

    if (!name || !email || !contact || !spswd || !cpswd || !role || !compName) {
      return res.status(400).json({
        success: false,
        message: "Please fill all required user details",
      });
    }

    if (storedSalary < 0) {
      return res.status(400).json({
        success: false,
        message: "Salary cannot be negative",
      });
    }

    if (compensationType === "commission") {
      if (!SALES_COMMISSION_ROLES.has(role)) {
        return res.status(400).json({
          success: false,
          message: "Commission payout is available only for ME/TME role",
        });
      }

      if (commissionPercent <= 0 || commissionPercent > 100) {
        return res.status(400).json({
          success: false,
          message: "Commission percent must be between 0 and 100",
        });
      }
    }

    if (spswd !== cpswd) {
      return res.status(400).json({
        success: false,
        message: "Passwords do not match",
      });
    }

    const skills = parseProfileSkillsInput(
      req.body.skills ?? req.body["skills[]"] ?? [],
    );

    const skillsJSON = JSON.stringify(skills);
    const sql = `
      INSERT INTO users
      (
        employee_code,
        name,
        date_of_birth,
        gender,
        nationality,
        prof_img,
        email,
        contact,
        alt_contact,
        address,
        aadhar_no,
        aadhar_img,
        pan_number,
        pan_img,
        account_no,
        bank_name,
        ifsc_code,
        beneficiary_name,
        cancelled_cheque,
        spswd,
        role,
        comp_name,
        login_time,
        logout_time,
        skills,
        salary,
        compensation_type,
        commission_percent,
        joining_date,
        total_experience,
        pf_enabled,
        pf_number,
        uan_number,
        employee_pf_number,
        employer_pf_number,
        pf_joining_date,
        resume_file,
        experience_file,
        certification_file,
        other_documents
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    try {
      await ensureUserShiftColumns();
      await ensureUserRegistrationColumns();
      await ensureAttendanceFaceColumns();
      await ensureUserProfileSetupColumns();
      await ensurePayrollUserColumns();
      const attendanceFace = readAttendanceFaceSubmission(req.body, {
        required: false,
      });
      employeeCode = await getNextEmployeeCode(compName);
      const [insertResult] = await dbPromise.query(sql, [
        employeeCode,
        name,
        dateOfBirth,
        gender,
        nationality,
        profImg,
        email,
        contact,
        altContact,
        address,
        aadharNo || null,
        aadharImg,
        panNumber,
        panImg,
        accountNo || null,
        bankName || null,
        ifscCode || null,
        beneficiaryName || null,
        cancelledCheque,
        spswd,
        role,
        compName,
        loginTime || null,
        logoutTime,
        skillsJSON,
        Number((rawSalary === "" ? 0 : storedSalary).toFixed(2)),
        compensationType,
        compensationType === "commission" ? commissionPercent : 0,
        joiningDate,
        totalExperience,
        pfEnabled,
        pfNumber,
        uanNumber,
        employeePfNumber,
        employerPfNumber,
        pfJoiningDate,
        resumeFile,
        experienceFile,
        certificationFile,
        otherDocuments,
      ]);

      const createdUserId = Number(insertResult.insertId || 0);
      let profileSetup = null;
      if (createdUserId) {
        await tryAutoSyncCurrentPayrollForUser(
          createdUserId,
          createdBy,
          "Registration payroll auto-sync",
        );
        if (attendanceFace) {
          await saveAttendanceFaceEnrollment(createdUserId, attendanceFace);
        }
        profileSetup = await issueProfileSetupInvite(
          req,
          createdUserId,
          email,
          name,
        );
      }

      res.json({
        success: true,
        message: "Registration successful!",
        userId: createdUserId || null,
        employeeCode,
        profileSetup,
      });
    } catch (err) {
      console.error("Registration DB Error:", err);
      res.status(err.statusCode || 500).json({
        success: false,
        message: err.statusCode
          ? err.message
          : getDatabaseErrorMessage(err, "Database error while creating user"),
      });
    }
  });
});

async function getProfileSetupUserByToken(token) {
  const normalizedToken = normalizeProfileSetupTokenValue(token);
  if (!normalizedToken) return null;

  const tokenHash = hashProfileSetupToken(normalizedToken);
  try {
    await ensureProfileSetupTokensTable();
    const [tokenUsers] = await dbPromise.query(
      `
        SELECT
          u.id,
          u.employee_code,
          u.name,
          u.email,
          u.contact,
          u.role,
          u.comp_name,
          u.prof_img,
          u.aadhar_no,
          u.aadhar_img,
          u.pan_number,
          u.pan_img,
          u.account_no,
          u.bank_name,
          u.ifsc_code,
          u.beneficiary_name,
          u.cancelled_cheque,
          DATE_FORMAT(u.joining_date, '%Y-%m-%d') AS joining_date,
          u.total_experience,
          u.pf_enabled,
          u.pf_number,
          u.uan_number,
          u.employee_pf_number,
          u.employee_pf_amount,
          u.employer_pf_number,
          u.employer_pf_amount,
          DATE_FORMAT(u.pf_joining_date, '%Y-%m-%d') AS pf_joining_date,
          u.resume_file,
          u.experience_file,
          u.certification_file,
          u.other_documents,
          u.attendance_face_enrolled_at,
          u.skills,
          u.profile_setup_status,
          pst.expires_at AS profile_setup_expires_at,
          u.profile_setup_sent_at,
          u.profile_setup_completed_at
        FROM profile_setup_tokens pst
        INNER JOIN users u ON u.id = pst.user_id
        WHERE pst.token_hash = ?
          AND pst.used_at IS NULL
        LIMIT 1
      `,
      [tokenHash],
    );

    if (tokenUsers[0]) return tokenUsers[0];
  } catch (err) {
    console.error("Profile setup token history lookup failed:", err);
  }

  const [users] = await dbPromise.query(
    `
      SELECT
        id,
        employee_code,
        name,
        email,
        contact,
        role,
        comp_name,
        prof_img,
        aadhar_no,
        aadhar_img,
        pan_number,
        pan_img,
        account_no,
        bank_name,
        ifsc_code,
        beneficiary_name,
        cancelled_cheque,
        DATE_FORMAT(joining_date, '%Y-%m-%d') AS joining_date,
        total_experience,
        pf_enabled,
        pf_number,
        uan_number,
        employee_pf_number,
        employee_pf_amount,
        employer_pf_number,
        employer_pf_amount,
        DATE_FORMAT(pf_joining_date, '%Y-%m-%d') AS pf_joining_date,
        resume_file,
        experience_file,
        certification_file,
        other_documents,
        attendance_face_enrolled_at,
        skills,
        profile_setup_status,
        profile_setup_expires_at,
        profile_setup_sent_at,
        profile_setup_completed_at
      FROM users
      WHERE profile_setup_token_hash = ?
      LIMIT 1
    `,
    [tokenHash],
  );

  return users[0] || null;
}

app.post("/api/admin/users/:id/profile-setup-link", async (req, res) => {
  const userId = Number(req.params.id);
  const requireEmail = normalizeInviteMailerFlag(req.body?.requireEmail);

  if (!userId) {
    return res.status(400).json({
      success: false,
      message: "Invalid user id",
    });
  }

  try {
    await ensureUserProfileSetupColumns();
    const [users] = await dbPromise.query(
      `
        SELECT
          id,
          name,
          email,
          profile_setup_status,
          profile_setup_expires_at,
          profile_setup_completed_at
        FROM users
        WHERE id = ?
        LIMIT 1
      `,
      [userId],
    );

    if (!users.length) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const user = users[0];
    if (!String(user.email || "").trim()) {
      return res.status(400).json({
        success: false,
        message: "User email is required before sending the profile link",
      });
    }

    if (String(user.profile_setup_status || "").toLowerCase() === "completed") {
      return res.status(400).json({
        success: false,
        message: "Profile details are already completed for this user",
      });
    }

    const profileSetup = await issueProfileSetupInvite(
      req,
      userId,
      user.email,
      user.name,
    );
    const inviteMessage = profileSetup?.emailDispatch?.sent
      ? profileSetup.emailDispatch.message
      : profileSetup?.emailDispatch?.message || "Profile form link generated";
    const emailSent = Boolean(profileSetup?.emailDispatch?.sent);
    const responsePayload = {
      success: !requireEmail || emailSent,
      message: inviteMessage,
      emailSent,
      emailDispatch: profileSetup?.emailDispatch || null,
      profileSetup,
    };

    if (requireEmail && !emailSent) {
      return res.status(503).json(responsePayload);
    }

    res.json(responsePayload);
  } catch (err) {
    console.error("Profile Setup Link Error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to generate profile completion link",
    });
  }
});

app.get("/api/profile-setup/:token", async (req, res) => {
  const token = normalizeProfileSetupTokenValue(req.params.token);

  if (!token) {
    return res.status(400).json({
      success: false,
      message: "Missing profile setup token",
    });
  }

  try {
    await ensureUserProfileSetupColumns();
    await ensureUserRegistrationColumns();
    await ensureAttendanceFaceColumns();
    const user = await getProfileSetupUserByToken(token);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "This profile form link is invalid",
      });
    }

    const statusDetails = getProfileSetupStatusDetails(user);
    if (statusDetails.status === "completed") {
      return res.status(409).json({
        success: false,
        message: "This profile form has already been submitted",
      });
    }

    if (statusDetails.isExpired) {
      return res.status(410).json({
        success: false,
        message: "This profile form link has expired. Please ask admin for a new link.",
      });
    }

    res.json({
      success: true,
      data: {
        ...user,
        attendance_face_enrolled: Boolean(user.attendance_face_enrolled_at),
        profile_setup_status: statusDetails.status,
        profile_setup_link_expired: statusDetails.isExpired,
      },
    });
  } catch (err) {
    console.error("Profile Setup Load Error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to load the profile form",
    });
  }
});

app.post("/api/profile-setup/:token", (req, res) => {
  userRegistrationUpload(req, res, async (uploadErr) => {
    if (uploadErr) {
      const message =
        uploadErr instanceof multer.MulterError
          ? uploadErr.code === "LIMIT_FILE_SIZE"
            ? "Each registration file must be 15 MB or smaller."
            : uploadErr.message
          : uploadErr.message || "Failed to upload profile files";

      return res.status(400).json({
        success: false,
        message,
      });
    }

    const token = normalizeProfileSetupTokenValue(req.params.token);
    if (!token) {
      return res.status(400).json({
        success: false,
        message: "Missing profile setup token",
      });
    }

    const aadharNo = String(req.body.aadhar_no || "").trim();
    const panNumber = String(req.body.pan_number || "").trim() || null;
    const accountNo = String(req.body.account_no || "").trim() || null;
    const bankName = String(req.body.bank_name || "").trim() || null;
    const ifscCode = String(req.body.ifsc_code || "").trim().toUpperCase() || null;
    const beneficiaryName =
      String(req.body.beneficiary_name || "").trim() || null;
    const joiningDate = normalizeDateOnlyValue(req.body.joining_date) || null;
    const totalExperience =
      String(req.body.total_experience || "").trim() || null;
    const pfEnabled = normalizePayrollBoolean(req.body.pf_enabled) ? 1 : 0;
    const pfNumber = String(req.body.pf_number || "").trim() || null;
    const uanNumber = String(req.body.uan_number || "").trim() || null;
    const employeePfAmount = normalizeOptionalPayrollAmount(
      req.body.employee_pf_amount,
    );
    const employerPfAmount = normalizeOptionalPayrollAmount(
      req.body.employer_pf_amount,
    );
    const pfJoiningDate = normalizeDateOnlyValue(req.body.pf_joining_date) || null;
    const skills = parseProfileSkillsInput(
      req.body.skills ?? req.body["skills[]"] ?? [],
    );

    try {
      await ensureUserProfileSetupColumns();
      await ensureUserRegistrationColumns();
      await ensureAttendanceFaceColumns();
      const user = await getProfileSetupUserByToken(token);

      if (!user) {
        return res.status(404).json({
          success: false,
          message: "This profile form link is invalid",
        });
      }

      const statusDetails = getProfileSetupStatusDetails(user);
      if (statusDetails.status === "completed") {
        return res.status(409).json({
          success: false,
          message: "This profile form has already been submitted",
        });
      }

      if (statusDetails.isExpired) {
        return res.status(410).json({
          success: false,
          message: "This profile form link has expired. Please ask admin for a new link.",
        });
      }

      const profImg =
        (await getUploadedFilePath(req.files, "prof_img")) || user.prof_img || null;
      const aadharImg =
        (await getUploadedFilePath(req.files, "aadhar_img")) ||
        user.aadhar_img ||
        null;
      const panImg =
        (await getUploadedFilePath(req.files, "pan_img")) || user.pan_img || null;
      const cancelledCheque =
        (await getUploadedFilePath(req.files, "cancelled_cheque")) ||
        user.cancelled_cheque ||
        null;
      const resumeFile =
        (await getUploadedFilePath(req.files, "resume_file")) ||
        user.resume_file ||
        null;
      const experienceFile =
        (await getUploadedFilePath(req.files, "experience_file")) ||
        user.experience_file ||
        null;
      const certificationFile =
        (await getUploadedFilePath(req.files, "certification_file")) ||
        user.certification_file ||
        null;
      const otherDocuments = await getMergedOtherDocuments(
        req.files,
        user.other_documents,
      );

      if (!aadharNo) {
        return res.status(400).json({
          success: false,
          message: "Aadhar number is required",
        });
      }

      if (
        pfEnabled &&
        (!pfNumber ||
          !uanNumber ||
          employeePfAmount == null ||
          employerPfAmount == null ||
          !pfJoiningDate)
      ) {
        return res.status(400).json({
          success: false,
          message:
            "PF number, UAN number, PF amounts and PF joining date are required when PF is enabled",
        });
      }

      if (
        (employeePfAmount != null && employeePfAmount < 0) ||
        (employerPfAmount != null && employerPfAmount < 0)
      ) {
        return res.status(400).json({
          success: false,
          message: "PF amount cannot be negative",
        });
      }

      const attendanceFace = readAttendanceFaceSubmission(req.body, {
        required: !user.attendance_face_enrolled_at,
      });

      await dbPromise.query(
        `
          UPDATE users
          SET
            prof_img = ?,
            aadhar_no = ?,
            aadhar_img = ?,
            pan_number = ?,
            pan_img = ?,
            account_no = ?,
            bank_name = ?,
            ifsc_code = ?,
            beneficiary_name = ?,
            cancelled_cheque = ?,
            joining_date = ?,
            total_experience = ?,
            pf_enabled = ?,
            pf_number = ?,
            uan_number = ?,
            employee_pf_amount = ?,
            employer_pf_amount = ?,
            pf_joining_date = ?,
            resume_file = ?,
            experience_file = ?,
            certification_file = ?,
            other_documents = ?,
            skills = ?,
            profile_setup_status = 'completed',
            profile_setup_token_hash = NULL,
            profile_setup_expires_at = NULL,
            profile_setup_completed_at = NOW()
          WHERE id = ?
          LIMIT 1
        `,
        [
          profImg,
          aadharNo,
          aadharImg,
          panNumber,
          panImg,
          accountNo,
          bankName,
          ifscCode,
          beneficiaryName,
          cancelledCheque,
          joiningDate,
          totalExperience,
          pfEnabled,
          pfEnabled ? pfNumber : null,
          pfEnabled ? uanNumber : null,
          pfEnabled ? employeePfAmount : null,
          pfEnabled ? employerPfAmount : null,
          pfEnabled ? pfJoiningDate : null,
          resumeFile,
          experienceFile,
          certificationFile,
          otherDocuments,
          JSON.stringify(skills),
          user.id,
        ],
      );

      await markProfileSetupTokensUsed(user.id).catch((tokenErr) => {
        console.error("Profile setup token used marker failed:", tokenErr);
      });

      if (attendanceFace) {
        await saveAttendanceFaceEnrollment(user.id, attendanceFace);
      }

      const submittedProfile = {
        ...user,
        prof_img: profImg,
        aadhar_no: aadharNo,
        aadhar_img: aadharImg,
        pan_number: panNumber,
        pan_img: panImg,
        account_no: accountNo,
        bank_name: bankName,
        ifsc_code: ifscCode,
        beneficiary_name: beneficiaryName,
        cancelled_cheque: cancelledCheque,
        joining_date: joiningDate,
        total_experience: totalExperience,
        pf_enabled: pfEnabled,
        pf_number: pfEnabled ? pfNumber : null,
        uan_number: pfEnabled ? uanNumber : null,
        employee_pf_amount: pfEnabled ? employeePfAmount : null,
        employer_pf_amount: pfEnabled ? employerPfAmount : null,
        pf_joining_date: pfEnabled ? pfJoiningDate : null,
        resume_file: resumeFile,
        experience_file: experienceFile,
        certification_file: certificationFile,
        other_documents: otherDocuments,
        skills: JSON.stringify(skills),
      };
      const notificationDispatch = await sendProfileSetupCompletionEmail(
        req,
        submittedProfile,
      ).catch((emailErr) => {
        console.error("Profile setup completion notification failed:", emailErr);
        return {
          sent: false,
          status: "failed",
          message: "Profile completion notification could not be sent, but the profile details were saved.",
        };
      });

      res.json({
        success: true,
        message: notificationDispatch?.sent
          ? "Your profile has been completed successfully. Admin and HR have been notified."
          : "Your profile has been completed successfully. Admin and HR can now view your details.",
        notificationDispatch,
      });
    } catch (err) {
      console.error("Profile Setup Submit Error:", err);
      res.status(err.statusCode || 500).json({
        success: false,
        message: err.statusCode ? err.message : "Failed to submit profile details",
      });
    }
  });
});

app.post("/submit-profile-form", (req, res) => {
  userRegistrationUpload(req, res, async (uploadErr) => {
    if (uploadErr) {
      const message =
        uploadErr instanceof multer.MulterError
          ? uploadErr.code === "LIMIT_FILE_SIZE"
            ? "Each profile file must be 15 MB or smaller."
            : uploadErr.message
          : uploadErr.message || "Failed to upload profile files";

      return res.status(400).json({
        success: false,
        message,
      });
    }

    const userId = Number(
      req.body.user_id ||
        req.body.userId ||
        req.body.id ||
        req.query.user_id ||
        req.query.userId ||
        req.query.id ||
        0,
    );
    const email = String(req.body.email || req.query.email || "").trim();

    if (!userId && !email) {
      return res.status(400).json({
        success: false,
        message: "User id or registered email is required",
      });
    }

    try {
      await ensureUserRegistrationColumns();

      const [users] = await dbPromise.query(
        `
          SELECT
            id,
            prof_img,
            aadhar_img,
            pan_img,
            cancelled_cheque,
            resume_file,
            experience_file,
            certification_file,
            other_documents
          FROM users
          WHERE ${userId ? "id = ?" : "LOWER(TRIM(email)) = LOWER(TRIM(?))"}
          LIMIT 1
        `,
        [userId || email],
      );

      if (!users.length) {
        return res.status(404).json({
          success: false,
          message: "User not found for this profile form",
        });
      }

      const existingUser = users[0];
      const profImg =
        (await getUploadedFilePath(req.files, "prof_img")) ||
        existingUser.prof_img ||
        null;
      const aadharImg =
        (await getUploadedFilePath(req.files, "aadhar_img")) ||
        existingUser.aadhar_img ||
        null;
      const panImg =
        (await getUploadedFilePath(req.files, "pan_img")) ||
        existingUser.pan_img ||
        null;
      const cancelledCheque =
        (await getUploadedFilePath(req.files, "cancelled_cheque")) ||
        existingUser.cancelled_cheque ||
        null;
      const resumeFile =
        (await getUploadedFilePath(req.files, "resume_file")) ||
        existingUser.resume_file ||
        null;
      const experienceFile =
        (await getUploadedFilePath(req.files, "experience_file")) ||
        existingUser.experience_file ||
        null;
      const certificationFile =
        (await getUploadedFilePath(req.files, "certification_file")) ||
        existingUser.certification_file ||
        null;
      const otherDocuments = await getMergedOtherDocuments(
        req.files,
        existingUser.other_documents,
      );

      await dbPromise.query(
        `
          UPDATE users
          SET
            prof_img = ?,
            aadhar_img = ?,
            pan_img = ?,
            cancelled_cheque = ?,
            resume_file = ?,
            experience_file = ?,
            certification_file = ?,
            other_documents = ?
          WHERE id = ?
        `,
        [
          profImg,
          aadharImg,
          panImg,
          cancelledCheque,
          resumeFile,
          experienceFile,
          certificationFile,
          otherDocuments,
          existingUser.id,
        ],
      );

      res.json({
        success: true,
        message: "Form submitted successfully",
        data: {
          prof_img: profImg,
          aadhar_img: aadharImg,
          pan_img: panImg,
          cancelled_cheque: cancelledCheque,
          resume_file: resumeFile,
          experience_file: experienceFile,
          certification_file: certificationFile,
          other_documents: parseStoredDocumentList(otherDocuments),
        },
      });
    } catch (error) {
      console.error("Profile Form Upload Error:", error);
      res.status(500).json({
        success: false,
        message: "File upload failed",
      });
    }
  });
});

// ====================== LOGIN ======================
function normalizeLoginCompanyKey(value) {
  const normalized = String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

  if (
    normalized === "redsea" ||
    normalized === "redseadigitals" ||
    normalized === "redseadigitalspvtltd"
  ) {
    return "redsea";
  }

  if (
    normalized === "metrics" ||
    normalized === "metricsmart" ||
    normalized === "metricsmartinfolinepvtltd"
  ) {
    return "metrics";
  }

  return "";
}

function getLoginCompanyName(companyKey) {
  return companyKey === "redsea"
    ? "Red Sea Digitals Pvt. Ltd"
    : "Metrics Mart Infoline Pvt Ltd";
}

function getLoginCompanyCondition(companyKey) {
  if (companyKey === "redsea") {
    return {
      sql: `
        AND LOWER(REPLACE(TRIM(COALESCE(comp_name, '')), ' ', '')) IN
          ('redsea', 'redseadigitals', 'redseadigitalspvtltd')
      `,
      params: [],
    };
  }

  return {
    sql: `
      AND (
        TRIM(COALESCE(comp_name, '')) = ''
        OR LOWER(REPLACE(TRIM(COALESCE(comp_name, '')), ' ', '')) IN
          ('metrics', 'metricsmart', 'metricsmartinfolinepvtltd')
      )
    `,
    params: [],
  };
}

function getRequestedCompanyScope(req) {
  return normalizeLoginCompanyKey(
    req?.query?.companyScope ||
      req?.query?.company_scope ||
      req?.query?.company ||
      req?.query?.company_key ||
      req?.body?.companyScope ||
      req?.body?.company_scope ||
      req?.body?.company ||
      req?.body?.company_key,
  );
}

function getRedSeaUserScopeSql(userAlias = "u") {
  return `
    LOWER(REPLACE(TRIM(COALESCE(${userAlias}.comp_name, '')), ' ', '')) IN
      ('redsea', 'redseadigitals', 'redseadigitalspvtltd')
  `;
}

function getMetricsUserScopeSql(userAlias = "u") {
  return `
    (
      TRIM(COALESCE(${userAlias}.comp_name, '')) = ''
      OR LOWER(REPLACE(TRIM(COALESCE(${userAlias}.comp_name, '')), ' ', '')) IN
        ('metrics', 'metricsmart', 'metricsmartinfolinepvtltd')
    )
  `;
}

function getCompanyUserScopeSql(companyScope, userAlias = "u") {
  const normalizedScope = normalizeLoginCompanyKey(companyScope);
  if (normalizedScope === "redsea") return getRedSeaUserScopeSql(userAlias);
  if (normalizedScope === "metrics") return getMetricsUserScopeSql(userAlias);
  return "";
}

function getRedSeaLeadScopeSql(leadAlias = "l") {
  return `
    (
      LOWER(REPLACE(TRIM(COALESCE(${leadAlias}.company_scope, '')), ' ', '')) IN
        ('redsea', 'redseadigitals', 'redseadigitalspvtltd')
      OR EXISTS (
        SELECT 1
        FROM users company_scope_user
        WHERE company_scope_user.id = ${leadAlias}.created_by
          AND TRIM(COALESCE(${leadAlias}.company_scope, '')) = ''
          AND ${getRedSeaUserScopeSql("company_scope_user")}
      )
    )
  `;
}

function getMetricsLeadScopeSql(leadAlias = "l") {
  return `
    (
      LOWER(REPLACE(TRIM(COALESCE(${leadAlias}.company_scope, '')), ' ', '')) IN
        ('metrics', 'metricsmart', 'metricsmartinfolinepvtltd')
      OR (
        TRIM(COALESCE(${leadAlias}.company_scope, '')) = ''
        AND (
          ${leadAlias}.created_by IS NULL
          OR EXISTS (
            SELECT 1
            FROM users company_scope_user
            WHERE company_scope_user.id = ${leadAlias}.created_by
              AND ${getMetricsUserScopeSql("company_scope_user")}
          )
        )
      )
    )
  `;
}

function getCompanyLeadScopeSql(companyScope, leadAlias = "l") {
  const normalizedScope = normalizeLoginCompanyKey(companyScope);
  if (normalizedScope === "redsea") return getRedSeaLeadScopeSql(leadAlias);
  if (normalizedScope === "metrics") return getMetricsLeadScopeSql(leadAlias);
  return "";
}

function getRedSeaProposalScopeSql(proposalAlias = "p") {
  return `
    (
      LOWER(REPLACE(TRIM(COALESCE(${proposalAlias}.company_scope, '')), ' ', '')) IN
        ('redsea', 'redseadigitals', 'redseadigitalspvtltd')
      OR EXISTS (
        SELECT 1
        FROM users proposal_scope_user
        WHERE proposal_scope_user.id = ${proposalAlias}.created_by
          AND TRIM(COALESCE(${proposalAlias}.company_scope, '')) = ''
          AND ${getRedSeaUserScopeSql("proposal_scope_user")}
      )
    )
  `;
}

function getMetricsProposalScopeSql(proposalAlias = "p") {
  return `
    (
      LOWER(REPLACE(TRIM(COALESCE(${proposalAlias}.company_scope, '')), ' ', '')) IN
        ('metrics', 'metricsmart', 'metricsmartinfolinepvtltd')
      OR (
        TRIM(COALESCE(${proposalAlias}.company_scope, '')) = ''
        AND (
          ${proposalAlias}.created_by IS NULL
          OR EXISTS (
            SELECT 1
            FROM users proposal_scope_user
            WHERE proposal_scope_user.id = ${proposalAlias}.created_by
              AND ${getMetricsUserScopeSql("proposal_scope_user")}
          )
        )
      )
    )
  `;
}

function getCompanyProposalScopeSql(companyScope, proposalAlias = "p") {
  const normalizedScope = normalizeLoginCompanyKey(companyScope);
  if (normalizedScope === "redsea") return getRedSeaProposalScopeSql(proposalAlias);
  if (normalizedScope === "metrics") return getMetricsProposalScopeSql(proposalAlias);
  return "";
}

function addRequestedUserCompanyScope(req, whereParts, userAlias = "u") {
  const scopeSql = getCompanyUserScopeSql(getRequestedCompanyScope(req), userAlias);
  if (scopeSql) {
    whereParts.push(scopeSql);
  }
}

function addRequestedLeadCompanyScope(req, whereParts, leadAlias = "l") {
  const scopeSql = getCompanyLeadScopeSql(getRequestedCompanyScope(req), leadAlias);
  if (scopeSql) {
    whereParts.push(scopeSql);
  }
}

function addRequestedLeaveCompanyScope(req, whereParts, leaveAlias = "lr") {
  const userScopeSql = getCompanyUserScopeSql(
    getRequestedCompanyScope(req),
    "leave_scope_user",
  );
  if (userScopeSql) {
    whereParts.push(`
      EXISTS (
        SELECT 1
        FROM users leave_scope_user
        WHERE leave_scope_user.id = ${leaveAlias}.user_id
          AND ${userScopeSql}
      )
    `);
  }
}

function normalizeLoginRoleForPanel(role) {
  const normalizedRole = String(role || "")
    .toLowerCase()
    .trim();

  return normalizedRole === "acc" ? "accounts" : normalizedRole;
}

async function getCompanyScopeForUser(userId) {
  const normalizedUserId = Number(userId);
  if (!normalizedUserId) return getLoginCompanyName("metrics");

  const [rows] = await dbPromise.query(
    `
      SELECT comp_name
      FROM users
      WHERE id = ?
      LIMIT 1
    `,
    [normalizedUserId],
  );

  const companyKey = normalizeLoginCompanyKey(rows[0]?.comp_name);
  return getLoginCompanyName(companyKey || "metrics");
}

async function handleLogin(req, res) {
  const { emailOrContact, email, password } = req.body || {};
  const loginId = (emailOrContact || email || "").trim();
  const companyKey = normalizeLoginCompanyKey(
    req.body?.company || req.body?.companyKey || req.body?.comp_name,
  );

  if (!loginId || !password || !companyKey) {
    return res.status(400).json({
      success: false,
      message: "Email/Contact, Company and Password are required",
    });
  }

  const companyCondition = getLoginCompanyCondition(companyKey);
  const loginParams = [
    loginId,
    loginId,
    password,
    ...companyCondition.params,
  ];
  const coreColumns = `
    id,
    name,
    email,
    contact,
    role,
    comp_name,
    prof_img
  `;
  const whereClause = `
    FROM users
    WHERE (email = ? OR contact = ?) AND spswd = ?
    ${companyCondition.sql}
  `;
  const sql = `
    SELECT
      ${coreColumns},
      profile_setup_status,
      profile_setup_expires_at,
      profile_setup_completed_at
    ${whereClause}
  `;

  try {
    let results;

    try {
      [results] = await dbPromise.query(sql, loginParams);
    } catch (err) {
      if (err.code !== "ER_BAD_FIELD_ERROR") throw err;

      console.warn(
        "Login profile columns are missing; using the core user schema.",
      );
      [results] = await dbPromise.query(
        `
          SELECT ${coreColumns}
          ${whereClause}
        `,
        loginParams,
      );
    }

    if (results.length > 0) {
      const user = results[0];
      const statusDetails = getProfileSetupStatusDetails(user);
      return res.json({
        success: true,
        message: "Login successful",
        user: {
          ...user,
          role: normalizeLoginRoleForPanel(user.role),
          company_key: companyKey,
          selected_company: getLoginCompanyName(companyKey),
          profile_setup_status: statusDetails.status,
          profile_setup_link_expired: statusDetails.isExpired,
        },
      });
    }

    res.status(401).json({
      success: false,
      message: "Invalid email, company or password",
    });
  } catch (err) {
    console.error("Login DB Error:", err);
    res.status(500).json({
      success: false,
      message: "Login database is unavailable. Please try again shortly.",
    });
  }
}

app.post("/login", handleLogin);
app.post("/api/login", handleLogin);

app.get("/api/admin/users/:id", async (req, res) => {
  const userId = Number(req.params.id);

  if (!userId) {
    return res.status(400).json({
      success: false,
      message: "Invalid user id",
    });
  }

  try {
    await ensureUserShiftColumns();
    await ensureUserRegistrationColumns();
    await ensureUserProfileSetupColumns();
    await ensureAttendanceFaceColumns();
    await ensurePayrollUserColumns();

    const [users] = await dbPromise.query(
      `
        SELECT
          id,
          employee_code,
          name,
          DATE_FORMAT(date_of_birth, '%Y-%m-%d') AS date_of_birth,
          gender,
          nationality,
          email,
          contact,
          alt_contact,
          address,
          aadhar_no,
          aadhar_img,
          pan_number,
          pan_img,
          account_no,
          bank_name,
          ifsc_code,
          beneficiary_name,
          cancelled_cheque,
          role,
          department,
          comp_name,
          TIME_FORMAT(login_time, '%H:%i') AS login_time,
          prof_img,
          TIME_FORMAT(logout_time, '%H:%i') AS logout_time,
          skills,
          salary,
          compensation_type,
          commission_percent,
          is_team_lead,
          DATE_FORMAT(joining_date, '%Y-%m-%d') AS joining_date,
          total_experience,
          pf_enabled,
          pf_number,
          uan_number,
          employee_pf_number,
          employee_pf_amount,
          employer_pf_number,
          employer_pf_amount,
          DATE_FORMAT(pf_joining_date, '%Y-%m-%d') AS pf_joining_date,
          resume_file,
          experience_file,
          certification_file,
          other_documents,
          attendance_face_enrolled_at,
          profile_setup_status,
          DATE_FORMAT(profile_setup_expires_at, '%Y-%m-%d %H:%i:%s') AS profile_setup_expires_at,
          DATE_FORMAT(profile_setup_sent_at, '%Y-%m-%d %H:%i:%s') AS profile_setup_sent_at,
          DATE_FORMAT(profile_setup_completed_at, '%Y-%m-%d %H:%i:%s') AS profile_setup_completed_at
        FROM users
        WHERE id = ?
        LIMIT 1
      `,
      [userId],
    );

    if (!users.length) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const statusDetails = getProfileSetupStatusDetails(users[0]);
    res.json({
      success: true,
      data: {
        ...users[0],
        attendance_face_enrolled: Boolean(users[0].attendance_face_enrolled_at),
        profile_setup_status: statusDetails.status,
        profile_setup_link_expired: statusDetails.isExpired,
      },
    });
  } catch (err) {
    console.error("Admin User Fetch Error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to load user details",
    });
  }
});

app.get("/api/hr/employees", async (req, res) => {
  const requesterId = Number(req.query.userId);

  if (!requesterId) {
    return res.status(400).json({
      success: false,
      message: "HR access is required",
    });
  }

  try {
    await ensureAdminOrHrAccess(requesterId);
    await ensureAttendanceTable();
    await ensureLeaveRequestsTable();
    await ensureUserShiftColumns();
    await ensureUserRegistrationColumns();
    await ensureUserProfileSetupColumns();
    await ensurePayrollUserColumns();

    const attendanceStatusSql = getAttendanceStatusSql("a", "u");
    const todayKey = getAttendanceDateKey();
    const userWhereParts = [
      "LOWER(TRIM(COALESCE(u.role, ''))) <> 'admin'",
    ];
    addRequestedUserCompanyScope(req, userWhereParts, "u");

    const [rows] = await dbPromise.query(
      `
        SELECT
          u.id,
          u.employee_code,
          u.name,
          u.email,
          u.contact,
          u.alt_contact,
          u.address,
          DATE_FORMAT(u.date_of_birth, '%Y-%m-%d') AS date_of_birth,
          u.gender,
          u.nationality,
          u.aadhar_no,
          u.pan_number,
          u.account_no,
          u.bank_name,
          u.ifsc_code,
          u.beneficiary_name,
          u.role,
          COALESCE(NULLIF(TRIM(u.department), ''), UPPER(TRIM(COALESCE(u.role, ''))), 'General') AS department,
          u.comp_name,
          TIME_FORMAT(u.login_time, '%H:%i') AS login_time,
          TIME_FORMAT(COALESCE(u.logout_time, '18:00:00'), '%H:%i') AS logout_time,
          DATE_FORMAT(u.joining_date, '%Y-%m-%d') AS joining_date,
          u.total_experience,
          u.salary,
          u.skills,
          u.prof_img,
          u.aadhar_img,
          u.pan_img,
          u.cancelled_cheque,
          u.resume_file,
          u.experience_file,
          u.certification_file,
          u.other_documents,
          u.pf_enabled,
          u.pf_number,
          u.uan_number,
          u.employee_pf_number,
          u.employee_pf_amount,
          u.employer_pf_number,
          u.employer_pf_amount,
          DATE_FORMAT(u.pf_joining_date, '%Y-%m-%d') AS pf_joining_date,
          u.is_team_lead,
          u.profile_setup_status,
          DATE_FORMAT(u.profile_setup_sent_at, '%Y-%m-%d %H:%i:%s') AS profile_setup_sent_at,
          DATE_FORMAT(u.profile_setup_expires_at, '%Y-%m-%d %H:%i:%s') AS profile_setup_expires_at,
          DATE_FORMAT(u.profile_setup_completed_at, '%Y-%m-%d %H:%i:%s') AS profile_setup_completed_at,
          DATE_FORMAT(a.check_in, '%H:%i:%s') AS check_in,
          DATE_FORMAT(a.check_out, '%H:%i:%s') AS check_out,
          ${attendanceStatusSql} AS attendance_status,
          CASE WHEN lt.user_id IS NOT NULL THEN 1 ELSE 0 END AS is_on_leave_today,
          lt.leave_type AS today_leave_type
        FROM users u
        LEFT JOIN attendance a
          ON a.user_id = u.id
          AND a.attendance_date = ?
        LEFT JOIN (
          SELECT
            lr.user_id,
            MAX(lr.leave_type) AS leave_type
          FROM leave_requests lr
          WHERE lr.status = 'approved'
            AND ? BETWEEN lr.from_date AND lr.to_date
          GROUP BY lr.user_id
        ) lt ON lt.user_id = u.id
        WHERE ${userWhereParts.join("\n          AND ")}
        ORDER BY
          FIELD(LOWER(TRIM(COALESCE(u.role, ''))), 'hr', 'tme', 'me', 'dev', 'seo', 'smo', 'accounts', 'dm'),
          u.name ASC,
          u.id ASC
      `,
      [todayKey, todayKey],
    );

    res.json({
      success: true,
      data: rows.map((row) => {
        const statusDetails = getProfileSetupStatusDetails(row);
        const requiredDocumentFields = [
          row.aadhar_img,
          row.pan_img,
          row.cancelled_cheque,
          row.resume_file,
          row.experience_file,
          row.certification_file,
        ];
        const requiredDocumentsPresent = requiredDocumentFields.filter(Boolean).length;
        const optionalDocumentsPresent =
          parseStoredDocumentList(row.other_documents).length;
        const documentsPresent = requiredDocumentsPresent + optionalDocumentsPresent;

        return {
          ...row,
          profile_setup_status: statusDetails.status,
          profile_setup_link_expired: statusDetails.isExpired,
          documents_present: documentsPresent,
          documents_required: requiredDocumentFields.length,
          documents_missing: Math.max(
            requiredDocumentFields.length - requiredDocumentsPresent,
            0,
          ),
        };
      }),
    });
  } catch (err) {
    console.error("HR employees fetch error:", err);
    res.status(err.statusCode || 500).json({
      success: false,
      message: err.message || "Failed to load HR employee directory",
    });
  }
});

app.put("/api/admin/users/:id", (req, res) => {
  userRegistrationUpload(req, res, async (uploadErr) => {
    if (uploadErr) {
      const message =
        uploadErr instanceof multer.MulterError
          ? uploadErr.code === "LIMIT_FILE_SIZE"
            ? "Each registration file must be 15 MB or smaller."
            : uploadErr.message
          : uploadErr.message || "Failed to upload registration files";

      return res.status(400).json({
        success: false,
        message,
      });
    }

    const userId = Number(req.params.id);

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "Invalid user id",
      });
    }

    const employeeCode = String(req.body.employee_code || "").trim() || null;
    const name = String(req.body.name || "").trim();
    const dateOfBirth = normalizeDateOnlyValue(req.body.date_of_birth) || null;
    const gender = String(req.body.gender || "").trim().toLowerCase() || null;
    const nationality = String(req.body.nationality || "").trim() || null;
    const email = String(req.body.email || "").trim();
    const contact = String(req.body.contact || "").trim();
    const altContact = String(req.body.alt_contact || "").trim() || null;
    const address = String(req.body.address || "").trim() || null;
    const aadharNo = String(req.body.aadhar_no || "").trim();
    const panNumber = String(req.body.pan_number || "").trim() || null;
    const accountNo = String(req.body.account_no || "").trim();
    const bankName = String(req.body.bank_name || "").trim();
    const ifscCode = String(req.body.ifsc_code || "").trim().toUpperCase();
    const beneficiaryName = String(req.body.beneficiary_name || "").trim();
    const nextPassword = String(req.body.spswd || "");
    const nextConfirmPassword = String(req.body.cpswd || "");
    const role = String(req.body.role || "").trim().toLowerCase();
    const compName = String(req.body.comp_name || "").trim();
    const loginTime = String(req.body.login_time || "").trim();
    const logoutTime = String(req.body.logout_time || "").trim() || "18:00";
    const rawSalary = String(req.body.salary ?? "").trim();
    const salary = normalizePayrollAmount(rawSalary);
    const requestedCompensationType = normalizeCompensationType(req.body.compensation_type);
    const joiningDate = normalizeDateOnlyValue(req.body.joining_date) || null;
    const totalExperience = String(req.body.total_experience || "").trim() || null;
    const pfEnabled =
      hasBodyField(req.body, "pf_enabled") &&
      normalizePayrollBoolean(req.body.pf_enabled)
        ? 1
        : 0;
    const pfNumber = String(req.body.pf_number || "").trim() || null;
    const uanNumber = String(req.body.uan_number || "").trim() || null;
    const employeePfNumber =
      String(req.body.employee_pf_number || "").trim() || null;
    const employerPfNumber =
      String(req.body.employer_pf_number || "").trim() || null;
    const employeePfAmount = normalizeOptionalPayrollAmount(
      req.body.employee_pf_amount,
    );
    const employerPfAmount = normalizeOptionalPayrollAmount(
      req.body.employer_pf_amount,
    );
    const pfJoiningDate = normalizeDateOnlyValue(req.body.pf_joining_date) || null;
    const updatedBy = Number(req.body.updated_by || req.body.created_by || 0) || null;

    if ((nextPassword || nextConfirmPassword) && nextPassword !== nextConfirmPassword) {
      return res.status(400).json({
        success: false,
        message: "Passwords do not match",
      });
    }

    const hasSkillsField =
      hasBodyField(req.body, "skills") || hasBodyField(req.body, "skills[]");
    const submittedSkills = parseProfileSkillsInput(
      req.body.skills ?? req.body["skills[]"] ?? [],
    );

    try {
      await ensureUserShiftColumns();
      await ensureUserRegistrationColumns();
      await ensureUserProfileSetupColumns();
      await ensureAttendanceFaceColumns();
      await ensurePayrollUserColumns();

      const [users] = await dbPromise.query(
        `
          SELECT
            id,
            employee_code,
            name,
            DATE_FORMAT(date_of_birth, '%Y-%m-%d') AS date_of_birth,
            gender,
            nationality,
            prof_img,
            email,
            contact,
            alt_contact,
            address,
            aadhar_img,
            aadhar_no,
            pan_img,
            pan_number,
            cancelled_cheque,
            resume_file,
            experience_file,
            certification_file,
            other_documents,
            attendance_face_enrolled_at,
            role,
            comp_name,
            account_no,
            bank_name,
            ifsc_code,
            beneficiary_name,
            TIME_FORMAT(login_time, '%H:%i') AS login_time,
            TIME_FORMAT(logout_time, '%H:%i') AS logout_time,
            skills,
            salary,
            compensation_type,
            commission_percent,
            DATE_FORMAT(joining_date, '%Y-%m-%d') AS joining_date,
            total_experience,
            pf_enabled,
            pf_number,
            uan_number,
            employee_pf_number,
            employee_pf_amount,
            employer_pf_number,
            employer_pf_amount,
            DATE_FORMAT(pf_joining_date, '%Y-%m-%d') AS pf_joining_date,
            spswd
          FROM users
          WHERE id = ?
          LIMIT 1
        `,
        [userId],
      );

      if (!users.length) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      const existingUser = users[0];
      const nextEmployeeCode = hasBodyField(req.body, "employee_code")
        ? employeeCode
        : existingUser.employee_code || null;
      const nextName = hasBodyField(req.body, "name")
        ? name
        : String(existingUser.name || "").trim();
      const nextDateOfBirth = hasBodyField(req.body, "date_of_birth")
        ? dateOfBirth
        : existingUser.date_of_birth || null;
      const nextGender = hasBodyField(req.body, "gender")
        ? gender
        : String(existingUser.gender || "").trim().toLowerCase() || null;
      const nextNationality = hasBodyField(req.body, "nationality")
        ? nationality
        : existingUser.nationality || null;
      const profImg =
        (await getUploadedFilePath(req.files, "prof_img")) ||
        existingUser.prof_img ||
        null;
      const nextEmail = hasBodyField(req.body, "email")
        ? email
        : String(existingUser.email || "").trim();
      const nextContact = hasBodyField(req.body, "contact")
        ? contact
        : String(existingUser.contact || "").trim();
      const nextAltContact = hasBodyField(req.body, "alt_contact")
        ? altContact
        : existingUser.alt_contact || null;
      const nextAddress = hasBodyField(req.body, "address")
        ? address
        : existingUser.address || null;
      const aadharImg =
        (await getUploadedFilePath(req.files, "aadhar_img")) ||
        existingUser.aadhar_img ||
        null;
      const panImg =
        (await getUploadedFilePath(req.files, "pan_img")) ||
        existingUser.pan_img ||
        null;
      const cancelledCheque =
        (await getUploadedFilePath(req.files, "cancelled_cheque")) ||
        existingUser.cancelled_cheque ||
        null;
      const resumeFile =
        (await getUploadedFilePath(req.files, "resume_file")) ||
        existingUser.resume_file ||
        null;
      const experienceFile =
        (await getUploadedFilePath(req.files, "experience_file")) ||
        existingUser.experience_file ||
        null;
      const certificationFile =
        (await getUploadedFilePath(req.files, "certification_file")) ||
        existingUser.certification_file ||
        null;
      const otherDocuments = await getMergedOtherDocuments(
        req.files,
        existingUser.other_documents,
      );
      const nextAadharNo = hasBodyField(req.body, "aadhar_no")
        ? aadharNo || null
        : existingUser.aadhar_no || null;
      const nextPanNumber = hasBodyField(req.body, "pan_number")
        ? panNumber
        : existingUser.pan_number || null;
      const nextAccountNo = hasBodyField(req.body, "account_no")
        ? accountNo || null
        : existingUser.account_no || null;
      const nextBankName = hasBodyField(req.body, "bank_name")
        ? bankName || null
        : existingUser.bank_name || null;
      const nextIfscCode = hasBodyField(req.body, "ifsc_code")
        ? ifscCode || null
        : existingUser.ifsc_code || null;
      const nextBeneficiaryName = hasBodyField(req.body, "beneficiary_name")
        ? beneficiaryName || null
        : existingUser.beneficiary_name || null;
      const nextRole = hasBodyField(req.body, "role")
        ? role
        : String(existingUser.role || "").trim().toLowerCase();
      const nextCompName = hasBodyField(req.body, "comp_name")
        ? compName
        : String(existingUser.comp_name || "").trim();
      const nextLoginTime = hasBodyField(req.body, "login_time")
        ? loginTime || null
        : existingUser.login_time || null;
      const nextLogoutTime = hasBodyField(req.body, "logout_time")
        ? logoutTime || "18:00"
        : existingUser.logout_time || "18:00";
      const nextSkills = hasSkillsField
        ? submittedSkills
        : parseProfileSkillsInput(existingUser.skills);
      const nextSalary =
        rawSalary !== ""
          ? salary
          : normalizePayrollAmount(existingUser.salary, 0);
      let nextCompensationType = hasBodyField(req.body, "compensation_type")
        ? requestedCompensationType
        : normalizeCompensationType(existingUser.compensation_type);
      if (!SALES_COMMISSION_ROLES.has(nextRole)) {
        nextCompensationType = "salary";
      }
      const nextCommissionPercent = getFixedSalesCommissionPercent(nextCompensationType);
      const nextStoredSalary = nextCompensationType === "commission" ? 0 : nextSalary;
      const nextJoiningDate = hasBodyField(req.body, "joining_date")
        ? joiningDate
        : existingUser.joining_date || null;
      const nextTotalExperience = hasBodyField(req.body, "total_experience")
        ? totalExperience
        : existingUser.total_experience || null;
      const nextPfEnabled = hasBodyField(req.body, "pf_enabled")
        ? pfEnabled
        : Number(existingUser.pf_enabled || 0)
          ? 1
          : 0;
      const nextPfNumber = nextPfEnabled
        ? hasBodyField(req.body, "pf_number")
          ? pfNumber
          : existingUser.pf_number || null
        : null;
      const nextUanNumber = nextPfEnabled
        ? hasBodyField(req.body, "uan_number")
          ? uanNumber
          : existingUser.uan_number || null
        : null;
      const nextEmployeePfNumber = nextPfEnabled
        ? hasBodyField(req.body, "employee_pf_number")
          ? employeePfNumber
          : existingUser.employee_pf_number || null
        : null;
      const nextEmployeePfAmount = nextPfEnabled
        ? hasBodyField(req.body, "employee_pf_amount")
          ? employeePfAmount
          : normalizeOptionalPayrollAmount(existingUser.employee_pf_amount)
        : null;
      const nextEmployerPfNumber = nextPfEnabled
        ? hasBodyField(req.body, "employer_pf_number")
          ? employerPfNumber
          : existingUser.employer_pf_number || null
        : null;
      const nextEmployerPfAmount = nextPfEnabled
        ? hasBodyField(req.body, "employer_pf_amount")
          ? employerPfAmount
          : normalizeOptionalPayrollAmount(existingUser.employer_pf_amount)
        : null;
      const nextPfJoiningDate = nextPfEnabled
        ? hasBodyField(req.body, "pf_joining_date")
          ? pfJoiningDate
          : existingUser.pf_joining_date || null
        : null;

      if (
        !nextName ||
        !nextEmail ||
        !nextContact ||
        !nextRole ||
        !nextCompName
      ) {
        return res.status(400).json({
          success: false,
          message: "Please fill all required user details",
        });
      }

      if (nextStoredSalary < 0) {
        return res.status(400).json({
          success: false,
          message: "Salary cannot be negative",
        });
      }

      if (nextCompensationType === "commission") {
        if (!SALES_COMMISSION_ROLES.has(nextRole)) {
          return res.status(400).json({
            success: false,
            message: "Commission payout is available only for ME/TME role",
          });
        }

        if (nextCommissionPercent <= 0 || nextCommissionPercent > 100) {
          return res.status(400).json({
            success: false,
            message: "Commission percent must be between 0 and 100",
          });
        }
      }

      if (
        (nextEmployeePfAmount != null && nextEmployeePfAmount < 0) ||
        (nextEmployerPfAmount != null && nextEmployerPfAmount < 0)
      ) {
        return res.status(400).json({
          success: false,
          message: "PF amount cannot be negative",
        });
      }

      const attendanceFace = readAttendanceFaceSubmission(req.body, {
        required: false,
      });

      let sql = `
        UPDATE users
        SET
          employee_code = ?,
          name = ?,
          date_of_birth = ?,
          gender = ?,
          nationality = ?,
          prof_img = ?,
          email = ?,
          contact = ?,
          alt_contact = ?,
          address = ?,
          aadhar_no = ?,
          aadhar_img = ?,
          pan_number = ?,
          pan_img = ?,
          account_no = ?,
          bank_name = ?,
          ifsc_code = ?,
          beneficiary_name = ?,
          cancelled_cheque = ?,
          role = ?,
          comp_name = ?,
          login_time = ?,
          logout_time = ?,
          skills = ?,
          salary = ?,
          compensation_type = ?,
          commission_percent = ?,
          joining_date = ?,
          total_experience = ?,
          pf_enabled = ?,
          pf_number = ?,
          uan_number = ?,
          employee_pf_number = ?,
          employee_pf_amount = ?,
          employer_pf_number = ?,
          employer_pf_amount = ?,
          pf_joining_date = ?,
          resume_file = ?,
          experience_file = ?,
          certification_file = ?,
          other_documents = ?
      `;
      const params = [
        nextEmployeeCode,
        nextName,
        nextDateOfBirth,
        nextGender,
        nextNationality,
        profImg,
        nextEmail,
        nextContact,
        nextAltContact,
        nextAddress,
        nextAadharNo,
        aadharImg,
        nextPanNumber,
        panImg,
        nextAccountNo,
        nextBankName,
        nextIfscCode,
        nextBeneficiaryName,
        cancelledCheque,
        nextRole,
        nextCompName,
        nextLoginTime,
        nextLogoutTime,
        JSON.stringify(nextSkills),
        Number(nextStoredSalary.toFixed(2)),
        nextCompensationType,
        nextCommissionPercent,
        nextJoiningDate,
        nextTotalExperience,
        nextPfEnabled,
        nextPfNumber,
        nextUanNumber,
        nextEmployeePfNumber,
        nextEmployeePfAmount,
        nextEmployerPfNumber,
        nextEmployerPfAmount,
        nextPfJoiningDate,
        resumeFile,
        experienceFile,
        certificationFile,
        otherDocuments,
      ];

      if (nextPassword) {
        sql += `,
          spswd = ?
        `;
        params.push(nextPassword);
      }

      sql += " WHERE id = ?";
      params.push(userId);

      const [result] = await dbPromise.query(sql, params);

      if (!result.affectedRows) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      await tryAutoSyncCurrentPayrollForUser(
        userId,
        updatedBy,
        "User update payroll auto-sync",
      );

      if (attendanceFace) {
        await saveAttendanceFaceEnrollment(userId, attendanceFace);
      }

      res.json({
        success: true,
        message: "User updated successfully",
      });
    } catch (err) {
      console.error("Admin User Update Error:", err);
      res.status(err.statusCode || 500).json({
        success: false,
        message: err.statusCode ? err.message : "Failed to update user",
      });
    }
  });
});

// ====================== GET USER ======================
app.get("/api/me/:id", async (req, res) => {
  const userId = Number(req.params.id);

  if (!userId) {
    return res.status(400).json({
      success: false,
      message: "Invalid user id",
    });
  }

  try {
    await ensureUserRegistrationColumns();
    await ensureUserProfileSetupColumns();
    const [result] = await dbPromise.query(
      `
        SELECT
          id,
          name,
          email,
          contact,
          alt_contact,
          role,
          comp_name,
          prof_img,
          date_of_birth,
          gender,
          nationality,
          address,
          aadhar_no,
          aadhar_img,
          pan_number,
          pan_img,
          account_no,
          bank_name,
          ifsc_code,
          beneficiary_name,
          cancelled_cheque,
          TIME_FORMAT(login_time, '%H:%i') AS login_time,
          TIME_FORMAT(logout_time, '%H:%i') AS logout_time,
          skills,
          salary,
          DATE_FORMAT(joining_date, '%Y-%m-%d') AS joining_date,
          total_experience,
          pf_enabled,
          pf_number,
          uan_number,
          employee_pf_number,
          employee_pf_amount,
          employer_pf_number,
          employer_pf_amount,
          DATE_FORMAT(pf_joining_date, '%Y-%m-%d') AS pf_joining_date,
          resume_file,
          experience_file,
          certification_file,
          other_documents,
          profile_setup_status,
          DATE_FORMAT(profile_setup_expires_at, '%Y-%m-%d %H:%i:%s') AS profile_setup_expires_at,
          DATE_FORMAT(profile_setup_sent_at, '%Y-%m-%d %H:%i:%s') AS profile_setup_sent_at,
          DATE_FORMAT(profile_setup_completed_at, '%Y-%m-%d %H:%i:%s') AS profile_setup_completed_at
        FROM users
        WHERE id = ?
        LIMIT 1
      `,
      [userId],
    );

    if (!result.length) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const statusDetails = getProfileSetupStatusDetails(result[0]);
    res.json({
      success: true,
      user: {
        ...result[0],
        profile_setup_status: statusDetails.status,
        profile_setup_link_expired: statusDetails.isExpired,
      },
    });
  } catch (err) {
    console.error("Get User Error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to load user details",
    });
  }
});

// ====================== ADD LEAD ======================
app.post("/api/leads", async (req, res) => {
  const data = req.body || {};
  const salesType = normalizeLeadSalesType(data.sales_type);
  const renewalSourceLeadId =
    salesType === "renewal"
      ? normalizePositiveId(data.renewal_source_lead_id || data.renewalSourceLeadId)
      : 0;
  const hasAppointmentDate = Boolean(data.app_date);
  const appointmentStatus = hasAppointmentDate
    ? normalizeAppointmentStatus(data.appointment_status, "generated")
    : null;
  const requestedCompanyScope = normalizeLoginCompanyKey(
    data.company_scope || data.companyScope,
  );
  const creatorCompanyScope = requestedCompanyScope
    ? ""
    : normalizeLoginCompanyKey(await getCompanyScopeForUser(data.created_by));
  const companyScope = requestedCompanyScope || creatorCompanyScope || "metrics";

  const sql = `
      INSERT INTO leads (
        company_name, client_name, telephone, alternate_contact,
        email, gst_no,
        flat_no, building_name, locality, city, pincode, state, maps_lnk,
        source_lead, sales_type, renewal_source_lead_id, industry_type,
        web_type, seo_type, smo_type, app_type, erp_type, services,
        service_notes,
        action_type, appointment_status,
        app_date, app_time, assign_emp, assign_emp_id, location,
        follow_date, follow_time, reason,
        additional_notes,
        created_by,
        company_scope
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

  const values = [
    normalizeRequiredLeadText(data.company),
    normalizeRequiredLeadText(data.client),
    normalizeRequiredLeadText(data.telephone || data.contact),
    data.alt_contact || null,
    data.email || null,
    data.gst_no || null,
    data.flat_no || null,
    data.building_name || null,
    normalizeRequiredLeadText(data.locality),
    normalizeRequiredLeadText(data.city),
    normalizeRequiredLeadText(data.pincode),
    normalizeRequiredLeadText(data.state),
    data.maps_lnk || null,
    normalizeRequiredLeadText(data.source_lead),
    salesType,
    renewalSourceLeadId || null,
    normalizeRequiredLeadText(data.industry_type),
    JSON.stringify(data.web_type || []),
    JSON.stringify(data.seo_type || []),
    JSON.stringify(data.smo_type || []),
    JSON.stringify(data.app_type || []),
    JSON.stringify(data.erp_type || []),
    JSON.stringify(data.services || []),
    data.service_notes || null,
    data.actionType || data.action_type || "appointment",
    appointmentStatus,
    data.app_date || null,
    data.app_time || null,
    data.assign_emp || null,
    data.assign_emp_id || null,
    data.location || null,
    data.follow_date || null,
    data.follow_time || null,
    data.reason || null,
    data.additional_notes || null,
    data.created_by || null,
    companyScope,
  ];

  try {
    await ensureLeadAppointmentStatusColumn();
    await ensureLeadRenewalSourceColumn();
    await ensureLeadCompanyScopeColumn();
    const [result] = await dbPromise.query(sql, values);
    const whatsapp = data.notify_whatsapp
      ? await buildLeadWhatsappPayload(data, "create")
      : null;

    res.json({
      success: true,
      id: result.insertId,
      whatsapp,
    });
  } catch (err) {
    console.error("Lead Create Error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to save client",
    });
  }
});

// ====================== GET ALL LEADS ======================
app.get("/api/leads", (req, res) => {
  let { role } = req.query;
  const userId = resolveLeadListUserId(req);
  const scope = String(req.query.scope || "")
    .toLowerCase()
    .trim();
  const companyScope = getRequestedCompanyScope(req);
  let leadScopeSql = getCompanyLeadScopeSql(companyScope, "leads");

  // 🔥 normalize role
  role = role ? role.toLowerCase().trim() : "";
  if (role === "admin" || role === "tme" || role === "me") {
    leadScopeSql = "";
  }

  let sql = "";
  let values = [];

  if (role === "admin") {
    sql = "SELECT * FROM leads ORDER BY id ASC";
  } else if (role === "tme") {
    if (!userId) {
      return res
        .status(400)
        .json({ success: false, message: "User ID required" });
    }

    const userSql = `
      SELECT id, name
      FROM users
      WHERE id = ? AND LOWER(TRIM(role)) = 'tme'
      LIMIT 1
    `;

    db.query(userSql, [userId], (userErr, users) => {
      if (userErr) {
        console.error("TME Lead User Fetch Error:", userErr);
        return res.status(500).json({ success: false });
      }

      if (!users.length) {
        return res.json({ success: true, data: [] });
      }

      const employeeName = String(users[0].name || "").trim();

      if (scope === "unassigned") {
        sql = `
          SELECT *
          FROM leads
          WHERE
            created_by = ?
            ${leadScopeSql ? `AND ${leadScopeSql}` : ""}
            AND
            (assign_emp IS NULL OR TRIM(assign_emp) = '')
            AND (assign_emp_id IS NULL OR assign_emp_id = 0)
          ORDER BY id DESC
        `;
        values = [userId];
      } else {
        sql = `
          SELECT *
          FROM leads
          WHERE (created_by = ? OR assign_emp = ? OR assign_emp_id = ?)
            ${leadScopeSql ? `AND ${leadScopeSql}` : ""}
          ORDER BY id DESC
        `;
        values = [userId, employeeName, userId];
      }

      db.query(sql, values, (err, result) => {
        if (err) {
          console.error("TME Leads Fetch Error:", err);
          return res.status(500).json({ success: false });
        }

        return res.json({ success: true, data: result });
      });
    });
    return;
  } else {
    // 🔥 force filter for non-admin
    if (!userId) {
      return res
        .status(400)
        .json({ success: false, message: "User ID required" });
    }

    sql = `
      SELECT *
      FROM leads
      WHERE created_by = ?
        ${leadScopeSql ? `AND ${leadScopeSql}` : ""}
      ORDER BY id DESC
    `;
    values = [userId];
  }

  db.query(sql, values, (err, result) => {
    if (err) {
      console.error("Leads Fetch Error:", err);
      return res.status(500).json({ success: false });
    }

    res.json({ success: true, data: result });
  });
});

// ====================== GET SINGLE LEAD ======================
app.get("/api/leads/:id", (req, res) => {
  const leadId = req.params.id;
  const sql = `SELECT * FROM leads WHERE id = ?`;

  db.query(sql, [leadId], (err, result) => {
    if (err) {
      console.error("Fetch Lead Error:", err);
      return res.status(500).json({ success: false });
    }
    if (result.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "Lead not found" });
    }
    res.json({ success: true, data: result[0] });
  });
});

// ====================== UPDATE LEAD (Convert Followup to Appointment) ======================
app.put("/api/leads/:id", async (req, res) => {
  const leadId = req.params.id;
  const data = req.body || {};
  const mode = String(data.mode || "")
    .toLowerCase()
    .trim();

  try {
    await ensureLeadAppointmentStatusColumn();
    await ensureLeadSalesTypeColumn();
    await ensureLeadCompanyScopeColumn();

    if (mode === "full") {
      const actionType = data.action_type || data.actionType || "appointment";
      const companyScope = String(data.company_scope || data.companyScope || "").trim() || null;
      const hasSalesTypeField = Object.prototype.hasOwnProperty.call(data, "sales_type");
      const salesType = hasSalesTypeField
        ? normalizeLeadSalesType(data.sales_type)
        : null;
      const isFollowup = actionType === "followup";
      const appointmentDate = isFollowup ? null : data.app_date || null;
      const appointmentTime = isFollowup ? null : data.app_time || null;
      const assignedEmployee = isFollowup ? null : data.assign_emp || null;
      const assignedEmployeeId = isFollowup ? null : data.assign_emp_id || null;
      const appointmentStatus = appointmentDate
        ? normalizeAppointmentStatus(data.appointment_status, "generated")
        : null;
      const followDate = isFollowup ? data.follow_date || null : null;
      const followTime = isFollowup ? data.follow_time || null : null;
      const followReason = isFollowup ? data.reason || null : null;
      const locationValue = data.location || data.maps_lnk || null;

      const sql = `
        UPDATE leads
        SET company_name = ?,
            client_name = ?,
            telephone = ?,
            alternate_contact = ?,
            email = ?,
            gst_no = ?,
            flat_no = ?,
            building_name = ?,
            locality = ?,
            city = ?,
            pincode = ?,
            state = ?,
            maps_lnk = ?,
            company_scope = COALESCE(?, company_scope),
            source_lead = ?,
            sales_type = COALESCE(?, sales_type),
            industry_type = ?,
            web_type = ?,
            seo_type = ?,
            smo_type = ?,
            app_type = ?,
            erp_type = ?,
            services = ?,
            service_notes = ?,
            action_type = ?,
            appointment_status = ?,
            app_date = ?,
            app_time = ?,
            assign_emp = ?,
            assign_emp_id = ?,
            location = ?,
            follow_date = ?,
            follow_time = ?,
            reason = ?,
            additional_notes = ?
        WHERE id = ?
      `;

      const values = [
        data.company || null,
        data.client || null,
        data.telephone || data.contact || null,
        data.alt_contact || null,
        data.email || null,
        data.gst_no || null,
        data.flat_no || null,
        data.building_name || null,
        data.locality || null,
        data.city || null,
        data.pincode || null,
        data.state || null,
        data.maps_lnk || null,
        companyScope,
        data.source_lead || null,
        salesType,
        data.industry_type || null,
        JSON.stringify(data.web_type || []),
        JSON.stringify(data.seo_type || []),
        JSON.stringify(data.smo_type || []),
        JSON.stringify(data.app_type || []),
        JSON.stringify(data.erp_type || []),
        JSON.stringify(data.services || []),
        data.service_notes || null,
        actionType,
        appointmentStatus,
        appointmentDate,
        appointmentTime,
        assignedEmployee,
        assignedEmployeeId,
        locationValue,
        followDate,
        followTime,
        followReason,
        data.additional_notes || null,
        leadId,
      ];

      const [result] = await dbPromise.query(sql, values);

      if (result.affectedRows === 0) {
        return res.status(404).json({
          success: false,
          message: "Lead not found",
        });
      }

      const whatsapp = data.notify_whatsapp
        ? await buildLeadWhatsappPayload(
            {
              ...data,
              action_type: actionType,
              ...(hasSalesTypeField ? { sales_type: salesType } : {}),
              app_date: appointmentDate,
              app_time: appointmentTime,
              assign_emp: assignedEmployee,
              location: locationValue,
              follow_date: followDate,
              follow_time: followTime,
              reason: followReason,
            },
            "update",
          )
        : null;

      return res.json({
        success: true,
        message: "Lead updated successfully",
        whatsapp,
      });
    }

    const { action_type, app_date, app_time, assign_emp, location } = data;
    const assignEmpId = data.assign_emp_id || null;
    const appointmentStatus = app_date
      ? normalizeAppointmentStatus(data.appointment_status, "generated")
      : null;

    const sql = `
        UPDATE leads
        SET action_type = ?,
            appointment_status = ?,
            app_date = ?,
            app_time = ?,
            assign_emp = ?,
            assign_emp_id = ?,
            location = ?
        WHERE id = ?
      `;

    const [result] = await dbPromise.query(sql, [
      action_type,
      appointmentStatus,
      app_date,
      app_time,
      assign_emp,
      assignEmpId,
      location,
      leadId,
    ]);

    if (result.affectedRows === 0) {
      return res
        .status(404)
        .json({ success: false, message: "Lead not found" });
    }

    const whatsapp = data.notify_whatsapp
      ? await buildLeadWhatsappPayload(
          {
            ...data,
            action_type,
            app_date,
            app_time,
            assign_emp,
            location,
          },
          "appointment",
        )
      : null;

    res.json({
      success: true,
      message: "Lead updated to Appointment",
      whatsapp,
    });
  } catch (err) {
    console.error("Lead Update Error:", err);
    res.status(500).json({
      success: false,
      message: mode === "full" ? "Lead update failed" : "Update failed",
    });
  }
});

app.get("/api/appointments", async (req, res) => {
  const role = String(req.query.role || "")
    .toLowerCase()
    .trim();
  const userId = Number(req.query.userId);
  const includeHistory = ["1", "true", "yes"].includes(
    String(req.query.includeHistory || "")
      .toLowerCase()
      .trim(),
  );
  const useLegacyLeadSchema = role === "admin" || role === "tme";
  const appointmentStageSql = useLegacyLeadSchema
    ? getLegacyAppointmentStageSql()
    : getAppointmentStageSql();

  let sql = "";
  let params = [];
  const scopedWhereParts = [];
  if (!useLegacyLeadSchema) {
    addRequestedLeadCompanyScope(req, scopedWhereParts, "leads");
  }

  if (includeHistory) {
    sql = `
      SELECT
        *,
        ${appointmentStageSql} AS appointment_stage
      FROM leads
      WHERE app_date IS NOT NULL
    `;
    if (scopedWhereParts.length) {
      sql += ` AND ${scopedWhereParts.join(" AND ")}`;
    }

    if (role !== "admin") {
      if (!userId) {
        return res.status(400).json({
          success: false,
          message: "User ID required",
        });
      }

      sql += " AND created_by = ?";
      params.push(userId);
    }

    sql += " ORDER BY app_date DESC, app_time DESC, id DESC";
  } else if (role === "admin") {
    sql = `
      SELECT
        *,
        ${appointmentStageSql} AS appointment_stage
      FROM leads
      WHERE action_type = 'appointment'
      ${scopedWhereParts.length ? `AND ${scopedWhereParts.join(" AND ")}` : ""}
      ORDER BY app_date ASC, app_time ASC
    `;
  } else {
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User ID required",
      });
    }

    sql = `
      SELECT
        *,
        ${appointmentStageSql} AS appointment_stage
      FROM leads
      WHERE action_type = 'appointment'
        AND created_by = ?
        ${scopedWhereParts.length ? `AND ${scopedWhereParts.join(" AND ")}` : ""}
      ORDER BY app_date ASC, app_time ASC
    `;
    params = [userId];
  }

  try {
    if (!useLegacyLeadSchema) {
      await ensureLeadAppointmentStatusColumn();
      await ensureLeadCompanyScopeColumn();
    }
    const [result] = await dbPromise.query(sql, params);
    res.json({ success: true, data: result });
  } catch (err) {
    console.error("Appointments Error:", err);
    res.status(500).json({ success: false, data: [] });
  }
});

app.put("/api/appointments/:id/status", async (req, res) => {
  const appointmentId = Number(req.params.id);
  const appointmentStatus = normalizeAppointmentStatus(
    req.body?.appointment_status,
    "",
  );

  if (!appointmentId || !appointmentStatus) {
    return res.status(400).json({
      success: false,
      message: "Appointment id and status are required",
    });
  }

  if (!APPOINTMENT_STATUS_VALUES.has(appointmentStatus)) {
    return res.status(400).json({
      success: false,
      message: "Invalid appointment status",
    });
  }

  try {
    await ensureLeadAppointmentStatusColumn();

    const [result] = await dbPromise.query(
      `
        UPDATE leads
        SET appointment_status = ?
        WHERE id = ?
          AND app_date IS NOT NULL
      `,
      [appointmentStatus, appointmentId],
    );

    if (!result.affectedRows) {
      return res.status(404).json({
        success: false,
        message: "Appointment not found",
      });
    }

    res.json({
      success: true,
      message: "Appointment status updated",
    });
  } catch (err) {
    console.error("Appointment Status Update Error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to update appointment status",
    });
  }
});

// ====================== GET APPOINTMENTS ======================
app.get("/api/appointments", (req, res) => {
  const { role, userId } = req.query;

  let sql = "";
  let params = [];

  if (role === "admin") {
    // ✅ ADMIN → SAB appointments (NO FILTER)
    sql = `
        SELECT * FROM leads
        WHERE action_type = 'appointment'
        ORDER BY app_date ASC, app_time ASC
      `;
  } else {
    // ✅ TME → sirf apne
    sql = `
        SELECT * FROM leads
        WHERE action_type = 'appointment'
        AND created_by = ?
        ORDER BY app_date ASC, app_time ASC
      `;
    params = [userId];
  }

  db.query(sql, params, (err, result) => {
    if (err) {
      console.error("Appointments Error:", err);
      return res.status(500).json({ success: false });
    }

    res.json({ success: true, data: result });
  });
});
// ====================== GET FOLLOWUPS ======================
app.get("/api/followups", (req, res) => {
  const { userId } = req.query;
  const role = String(req.query.role || "")
    .toLowerCase()
    .trim();
  const scopedWhereParts = [];
  addRequestedLeadCompanyScope(req, scopedWhereParts, "leads");

  let sql = "";
  let params = [];

  if (role === "admin") {
    sql = `
      SELECT * FROM leads
      WHERE action_type = 'followup'
      ${scopedWhereParts.length ? `AND ${scopedWhereParts.join(" AND ")}` : ""}
      ORDER BY follow_date DESC, follow_time DESC, id DESC
    `;
  } else {
    if (!userId) {
      return res
        .status(400)
        .json({ success: false, message: "User ID required" });
    }

    sql = `
      SELECT * FROM leads
      WHERE action_type = 'followup'
      AND created_by = ?
      ${scopedWhereParts.length ? `AND ${scopedWhereParts.join(" AND ")}` : ""}
      ORDER BY follow_date DESC, follow_time DESC, id DESC
    `;
    params = [userId];
  }

  db.query(sql, params, (err, result) => {
    if (err) {
      console.error("Followups Fetch Error:", err);
      return res.status(500).json({ success: false, data: [] });
    }

    res.json({ success: true, data: result });
  });
});

app.post("/api/followups", (req, res) => {
  const { leadId, follow_date, follow_time, reason } = req.body || {};

  if (!leadId || !follow_date || !follow_time) {
    return res.status(400).json({
      success: false,
      message: "leadId, follow_date and follow_time are required",
    });
  }

  db.query(
    "INSERT INTO followups (lead_id, follow_date, follow_time, reason) VALUES (?, ?, ?, ?)",
    [leadId, follow_date, follow_time, reason],
    (err) => {
      if (err) return res.status(500).json({ success: false });
      res.json({ success: true });
    },
  );
});

// ====================== UPDATE LEAD ACTION (Not Interested / Followup / Deal Closed) ======================
app.put(
  "/api/leads/:id/action",
  uploadPayment.single("paymentProof"),
  async (req, res) => {
    const leadId = req.params.id;

    const {
      action,
      follow_date,
      follow_time,
      reason,
      payment_method,
      deal_amount,
      payment_notes,
      transaction_id,
      cheque_number,
      cheque_date,
      bank_name,
      branch_name,
      received_by,
      payment_date,
      closed_by,
      products,
      downsale_approval_id,
    } = req.body;

    const payment_proof = req.file
      ? await resolveUploadedFilePath(req.file, "payments")
      : null;

    let validatedProducts = [];
    if (action === "deal_closed") {
      let productValidation;
      try {
        productValidation = await validateDealProductsPayload(
          products,
          deal_amount,
          leadId,
          downsale_approval_id,
        );
      } catch (err) {
        console.error("Product Validation Error:", err);
        return res.status(500).json({
          success: false,
          message: "Failed to validate product pricing",
        });
      }

      if (!productValidation.valid) {
        return res.status(400).json({
          success: false,
          message: productValidation.message,
        });
      }

      validatedProducts = productValidation.products;
    }

    await ensureLeadAppointmentStatusColumn();

    let sql = `UPDATE leads SET `;
    let values = [];

    if (action === "not_interested") {
      sql += `
        lead_status = 'not_interested',
        appointment_status = CASE
          WHEN app_date IS NOT NULL THEN 'not_confirmed'
          ELSE appointment_status
        END
        WHERE id = ?
      `;
      values = [leadId];
    } else if (action === "followup") {
      sql += `action_type = 'followup',
            follow_date = ?,
            follow_time = ?,
            reason = ?,
            lead_status = 'followup',
            appointment_status = CASE
              WHEN app_date IS NOT NULL THEN 'confirmed'
              ELSE appointment_status
            END,
            assign_emp_id = ?
            WHERE id = ?`;

      values = [
        follow_date,
        follow_time,
        reason || null,
        req.body.userId,
        leadId,
      ];
    } else if (action === "deal_closed") {
      sql += `lead_status = 'deal_closed',
              closed_date = NOW(),
              closed_by = ?,
              payment_method = ?,
              deal_amount = ?,
              payment_notes = ?,
              transaction_id = ?,
              cheque_number = ?,
              cheque_date = ?,
              bank_name = ?,
              branch_name = ?,
              received_by = ?,
              payment_proof = ?,
              payment_date = ?,
              action_type = NULL,
              appointment_status = CASE
                WHEN app_date IS NOT NULL THEN 'confirmed'
                ELSE appointment_status
              END
              WHERE id = ?`;

      values = [
        closed_by || null,
        payment_method || null,
        deal_amount || null,
        payment_notes || null,
        transaction_id || null,
        cheque_number || null,
        cheque_date || null,
        bank_name || null,
        branch_name || null,
        received_by || null,
        payment_proof,
        payment_date || null,
        leadId,
      ];
    } else {
      return res
        .status(400)
        .json({ success: false, message: "Invalid action" });
    }

    db.query(sql, values, (err, result) => {
      if (err) {
        console.error("Action Update Error:", err);
        return res.status(500).json({
          success: false,
          message: "Database update failed",
          error: err.sqlMessage,
        });
      }

      if (result.affectedRows === 0) {
        return res
          .status(404)
          .json({ success: false, message: "Lead not found" });
      }

      const sendActionSuccess = () => res.json({
        success: true,
        message: "Lead updated successfully",
        payment_proof: payment_proof,
      });

      if (action !== "deal_closed") {
        return sendActionSuccess();
      }

      const parsedProducts = validatedProducts;

      const dealSql = `INSERT INTO deals
          (lead_id, deal_amount, payment_method, payment_notes, closed_by)
          VALUES (?, ?, ?, ?, ?)`;
      db.query(dealSql, [
        leadId,
        deal_amount,
        payment_method,
        payment_notes || null,
        closed_by || null,
      ], (dealErr, dealResult) => {
        if (dealErr) {
          console.error("Deal Insert Error:", dealErr);
          return res.status(500).json({
            success: false,
            message: "Failed to create deal",
            error: dealErr.sqlMessage,
          });
        }

        const dealId = dealResult.insertId;

        if (!parsedProducts || parsedProducts.length === 0) {
          return sendActionSuccess();
        }

        ensureDealProductsTable()
          .then(() => {
            const productValues = parsedProducts.map(p => [dealId, p.name, p.amount]);
            const productSql = `INSERT INTO deal_products (deal_id, product_name, product_amount) VALUES ?`;

            db.query(productSql, [productValues], (prodErr) => {
              if (prodErr) {
                console.error("Product Insert Error:", prodErr);
                return res.status(500).json({
                  success: false,
                  message: "Failed to save deal products",
                  error: prodErr.sqlMessage,
                });
              }

              return sendActionSuccess();
            });
          })
          .catch((setupErr) => {
            console.error("Deal Products Table Setup Error:", setupErr);
            return res.status(500).json({
              success: false,
              message: "Failed to setup deal products table",
              error: setupErr.sqlMessage,
            });
          });
      });
    });
  },
);

app.get("/api/admin/renewals", async (req, res) => {
  try {
    await ensureLeadRenewalSourceColumn();

    const lookaheadDays = normalizeRenewalLookaheadDays(req.query.days);
    const companyScope = "";
    const renewalDueDateSql = "DATE_ADD(DATE(l.closed_date), INTERVAL 1 YEAR)";
    const closedRenewalMatchCondition = getDealRenewalMatchCondition("l", "rcl");
    const closedRenewalScopeSql = "";
    const whereParts = [
      "l.lead_status = 'deal_closed'",
      "l.closed_date IS NOT NULL",
      `${renewalDueDateSql} <= DATE_ADD(CURDATE(), INTERVAL ${lookaheadDays} DAY)`,
    ];

    const sql = `
      SELECT
        l.id,
        l.company_name,
        l.client_name,
        l.telephone AS contact,
        l.email,
        l.city,
        l.services,
        l.service_notes,
        l.web_type,
        l.seo_type,
        l.smo_type,
        l.app_type,
        l.erp_type,
        l.deal_amount,
        l.payment_method,
        l.pay_stat,
        l.sales_type,
        l.assign_emp,
        DATE_FORMAT(DATE(l.closed_date), '%Y-%m-%d') AS closed_date,
        DATE_FORMAT(${renewalDueDateSql}, '%Y-%m-%d') AS renewal_due_date,
        DATEDIFF(${renewalDueDateSql}, CURDATE()) AS days_left,
        COALESCE(NULLIF(l.assign_emp, ''), closer.name, creator.name, '') AS owner_name,
        ${getDealRenewalSelectSql("l", companyScope)}
      FROM leads l
      LEFT JOIN users closer ON closer.id = l.closed_by
      LEFT JOIN users creator ON creator.id = l.created_by
      WHERE ${whereParts.join("\n        AND ")}
        AND NOT EXISTS (
          SELECT 1
          FROM leads rcl
          WHERE ${closedRenewalMatchCondition}
            ${closedRenewalScopeSql ? `AND ${closedRenewalScopeSql}` : ""}
            AND rcl.lead_status = 'deal_closed'
          LIMIT 1
        )
      ORDER BY ${renewalDueDateSql} ASC, l.closed_date DESC, l.id DESC
    `;

    const [rows] = await dbPromise.query(sql);
    const summary = rows.reduce(
      (totals, row) => {
        const daysLeft = Number(row.days_left);
        const renewalCount = Number(row.renewal_count || 0);

        totals.total += 1;
        if (renewalCount > 0) {
          totals.started += 1;
        } else if (Number.isFinite(daysLeft) && daysLeft < 0) {
          totals.overdue += 1;
        } else if (Number.isFinite(daysLeft) && daysLeft <= 30) {
          totals.dueSoon += 1;
        } else {
          totals.upcoming += 1;
        }

        return totals;
      },
      {
        total: 0,
        overdue: 0,
        dueSoon: 0,
        upcoming: 0,
        started: 0,
      },
    );

    res.json({
      success: true,
      data: rows,
      summary,
      lookaheadDays,
    });
  } catch (err) {
    console.error("Admin Renewals Fetch Error:", err);
    res.status(500).json({
      success: false,
      data: [],
      summary: {
        total: 0,
        overdue: 0,
        dueSoon: 0,
        upcoming: 0,
        started: 0,
      },
      message: "Failed to load renewal details",
    });
  }
});

// ====================== GET DEALS FOR EMPLOYEE ======================
app.get("/api/deals/:id", async (req, res) => {
  try {
    await ensureLeadRenewalSourceColumn();
    await ensureLeadCompanyScopeColumn();

    const ownerScope = await getDealOwnerScope(req.params.id);
    const ownerFilter = buildDealOwnerFilter(ownerScope, "l");
    const companyScope = getRequestedCompanyScope(req);
    const whereParts = ["l.lead_status = 'deal_closed'", ownerFilter.clause];
    addRequestedLeadCompanyScope(req, whereParts, "l");
    const sql = `
        SELECT
          l.*,
          ${getDealRenewalSelectSql("l", companyScope)}
        FROM leads l
        WHERE ${whereParts.join(" AND ")}
        ORDER BY l.closed_date DESC
      `;

    const [result] = await dbPromise.query(sql, ownerFilter.params);
    res.json({ success: true, data: result });
  } catch (err) {
    console.error("Deals Fetch Error:", err);
    res.status(err.statusCode || 500).json({
      success: false,
      data: [],
      message: err.message || "Failed to load deals",
    });
  }
});

app.get("/api/deals", async (req, res) => {
  try {
    await ensureLeadRenewalSourceColumn();
    await ensureLeadCompanyScopeColumn();

    const role = String(req.query.role || "")
      .toLowerCase()
      .trim();
    const values = [];
    const companyScope = getRequestedCompanyScope(req);
    const whereParts = ["l.lead_status = 'deal_closed'"];
    addRequestedLeadCompanyScope(req, whereParts, "l");

    if (role !== "admin" && role !== "accounts") {
      const ownerScope = await getDealOwnerScope(req.query.userId);
      const ownerFilter = buildDealOwnerFilter(ownerScope, "l");
      whereParts.push(ownerFilter.clause);
      values.push(...ownerFilter.params);
    }

    const sql = `
        SELECT
          l.*,
          ${getDealRenewalSelectSql("l", companyScope)}
        FROM leads l
        WHERE ${whereParts.join(" AND ")}
        ORDER BY l.closed_date DESC
      `;

    const [result] = await dbPromise.query(sql, values);

    return res.json({
      success: true,
      data: result,
    });
  } catch (err) {
    console.error("Deals Fetch Error:", err);
    return res.status(err.statusCode || 500).json({
      success: false,
      data: [],
      message: err.message || "Failed to load deals",
    });
  }
});

app.get("/api/deal-products", (req, res) => {
  res.json({
    success: true,
    data: DEAL_PRODUCT_CATALOG.map((product) => ({ ...product })),
  });
});

app.post("/api/deal-products/quote", async (req, res) => {
  try {
    const { leadId, products = [], downsaleApprovalId } = req.body || {};

    if (!Array.isArray(products)) {
      return res.status(400).json({ success: false, message: "Invalid products" });
    }

    let total = 0;
    const items = [];

    for (const item of products) {
      const name = typeof item?.name === "string" ? item.name.trim() : "";
      const standardAmount = DEAL_PRODUCT_PRICES.get(name);

      if (!name || !standardAmount) {
        return res.status(400).json({
          success: false,
          message: "Invalid product selected",
        });
      }

      total += standardAmount;
      items.push({ name, amount: standardAmount, standardAmount });
    }

    let finalTotal = total;
    let approvalStatus = null;
    const approvalId = Number(downsaleApprovalId || 0);

    if (approvalId) {
      const [approvals] = await dbPromise.query(
        `SELECT requested_amount, standard_amount, status
         FROM downsale_requests
         WHERE id = ?
           AND lead_id = ?
         LIMIT 1`,
        [approvalId, leadId || 0],
      );

      if (approvals.length) {
        approvalStatus = approvals[0].status;
        if (
          approvals[0].status === "approved" &&
          Math.abs(Number(approvals[0].standard_amount) - total) <= 0.01
        ) {
          finalTotal = total - Number(approvals[0].requested_amount);
        }
      }
    }

    res.json({
      success: true,
      data: {
        items,
        standardTotal: total,
        total: finalTotal,
        downsaleApprovalId: approvalId || null,
        approvalStatus,
      },
    });
  } catch (err) {
    console.error("Deal Quote Error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to calculate product total",
    });
  }
});

app.get("/api/downsale-requests", async (req, res) => {
  try {
    await ensureDownsaleRequestsTable();
    await ensureLeadCompanyScopeColumn();

    const leadId = Number(req.query.leadId || 0);
    const status = String(req.query.status || "")
      .trim()
      .toLowerCase();
    const filters = [];
    const params = [];

    if (leadId > 0) {
      filters.push("dr.lead_id = ?");
      params.push(leadId);
    }

    if (["pending", "approved", "rejected"].includes(status)) {
      filters.push("dr.status = ?");
      params.push(status);
    }
    addRequestedLeadCompanyScope(req, filters, "l");

    const where = filters.length ? `WHERE ${filters.join(" AND ")}` : "";
    const sql = `
      SELECT
        dr.*,
        l.company_name,
        l.client_name,
        u.name AS requested_by_name,
        reviewer.name AS reviewed_by_name
      FROM downsale_requests dr
      LEFT JOIN leads l ON l.id = dr.lead_id
      LEFT JOIN users u ON u.id = dr.requested_by
      LEFT JOIN users reviewer ON reviewer.id = dr.reviewed_by
      ${where}
      ORDER BY dr.created_at DESC, dr.id DESC
    `;
    const [rows] = await dbPromise.query(sql, params);

    res.json({ success: true, data: rows });
  } catch (err) {
    console.error("Downsale Fetch Error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to fetch downsale requests",
      data: [],
    });
  }
});

app.post("/api/downsale-requests", async (req, res) => {
  try {
    await ensureDownsaleRequestsTable();

    const leadId = Number(req.body.leadId);
    const requestedBy = Number(req.body.requestedBy || 0) || null;
    const products = Array.isArray(req.body.products) ? req.body.products : [];
    const requestedAmount = Number(req.body.requestedAmount);
    const reason = String(req.body.reason || "").trim() || null;
    const productNames = products
      .map((product) => String(product?.name || "").trim())
      .filter(Boolean);
    const standardAmount = productNames.reduce((total, name) => {
      const price = DEAL_PRODUCT_PRICES.get(name);
      return price ? total + price : NaN;
    }, 0);

    if (
      !leadId ||
      productNames.length === 0 ||
      !Number.isFinite(standardAmount) ||
      standardAmount <= 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid downsale products",
      });
    }

    if (
      !Number.isFinite(requestedAmount) ||
      requestedAmount <= 0 ||
      requestedAmount >= standardAmount
    ) {
      return res.status(400).json({
        success: false,
        message: `Downsale amount must be below Rs. ${standardAmount.toLocaleString("en-IN")}`,
      });
    }

    const [existing] = await dbPromise.query(
      `SELECT id
       FROM downsale_requests
       WHERE lead_id = ?
         AND product_name = ?
         AND standard_amount = ?
         AND requested_amount = ?
         AND status = 'pending'
       LIMIT 1`,
      [leadId, "Overall Deal", standardAmount, requestedAmount],
    );

    if (existing.length) {
      return res.json({
        success: true,
        message: "Downsale request already pending",
        id: existing[0].id,
      });
    }

    const [result] = await dbPromise.query(
      `INSERT INTO downsale_requests
        (lead_id, requested_by, product_name, standard_amount, requested_amount, reason)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [leadId, requestedBy, "Overall Deal", standardAmount, requestedAmount, reason],
    );

    res.json({
      success: true,
      message: "Downsale request sent to admin",
      id: result.insertId,
    });
  } catch (err) {
    console.error("Downsale Create Error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to create downsale request",
    });
  }
});

app.put("/api/downsale-requests/:id", async (req, res) => {
  try {
    await ensureDownsaleRequestsTable();

    const id = Number(req.params.id);
    const status = String(req.body.status || "")
      .trim()
      .toLowerCase();
    const adminNote = String(req.body.adminNote || "").trim() || null;
    const reviewedBy = Number(req.body.reviewedBy || 0) || null;

    if (!id || !["approved", "rejected"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid approval action",
      });
    }

    if (!reviewedBy) {
      return res.status(400).json({
        success: false,
        message: "Admin user is required",
      });
    }

    await ensureAdminAccess(reviewedBy);

    const [result] = await dbPromise.query(
      `UPDATE downsale_requests
       SET status = ?,
           admin_note = ?,
           reviewed_by = ?,
           reviewed_at = NOW()
       WHERE id = ?
         AND status = 'pending'`,
      [status, adminNote, reviewedBy, id],
    );

    if (!result.affectedRows) {
      return res.status(404).json({
        success: false,
        message: "Pending downsale request not found",
      });
    }

    res.json({ success: true, message: `Downsale ${status}` });
  } catch (err) {
    console.error("Downsale Review Error:", err);
    const statusCode = err.statusCode || 500;
    res.status(statusCode).json({
      success: false,
      message:
        statusCode === 403
          ? err.message
          : "Failed to update downsale request",
    });
  }
});

app.get("/api/sales-target-summary", async (req, res) => {
  try {
    const requesterRole = normalizeRoleValue(req.query.role);
    const summary = await getSalesTargetSummaryData({
      role: req.query.role,
      userId: req.query.userId,
      monthKey: req.query.month,
    });

    res.json({
      success: true,
      data: requesterRole === "admin"
        ? summary
        : sanitizeSalesTargetSummaryForEmployee(summary),
    });
  } catch (err) {
    console.error("Sales Target Summary Error:", err);
    res.status(err.statusCode || 500).json({
      success: false,
      message: err.message || "Failed to load sales target summary",
    });
  }
});

app.get("/api/admin/team-targets-summary", async (req, res) => {
  const adminId = Number(req.query.adminId || req.query.userId || 0);

  if (!adminId) {
    return res.status(400).json({
      success: false,
      message: "Admin id is required",
    });
  }

  try {
    await ensureAdminAccess(adminId);
    const payload = await getAdminTeamTargetSummary({
      monthKey: req.query.month,
    });

    res.json({
      success: true,
      month: payload.month,
      summary: payload.summary,
      data: payload.data,
    });
  } catch (err) {
    console.error("Admin Team Target Summary Error:", err);
    res.status(err.statusCode || 500).json({
      success: false,
      message: err.message || "Failed to load team target summary",
    });
  }
});

app.put("/api/users/:id/monthly-target", async (req, res) => {
  const userId = Number(req.params.id);
  const monthlyTarget = Number(req.body?.monthlyTarget);
  const actorId = Number(req.body?.actorId || req.body?.adminId || 0);

  if (!userId) {
    return res.status(400).json({
      success: false,
      message: "Invalid user id",
    });
  }

  if (!Number.isFinite(monthlyTarget) || monthlyTarget < 0) {
    return res.status(400).json({
      success: false,
      message: "Please enter a valid target amount",
    });
  }

  try {
    await ensureUserMonthlyTargetColumn();
    if (actorId && actorId !== userId) {
      await ensureAdminAccess(actorId);
    }

    const [users] = await dbPromise.query(
      "SELECT compensation_type FROM users WHERE id = ? LIMIT 1",
      [userId],
    );

    if (!users.length) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (normalizeCompensationType(users[0].compensation_type) === "commission") {
      return res.status(400).json({
        success: false,
        message: "Commission profiles do not use monthly targets",
      });
    }

    const [result] = await dbPromise.query(
      "UPDATE users SET monthly_target = ? WHERE id = ?",
      [monthlyTarget, userId],
    );

    if (!result.affectedRows) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.json({
      success: true,
      message: "Monthly target updated successfully",
      data: {
        target: monthlyTarget,
      },
    });
  } catch (err) {
    console.error("Monthly Target Update Error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to update monthly target",
    });
  }
});
// ====================== GET ME EMPLOYEES ======================
app.get("/api/me-employees", (req, res) => {
  const whereParts = ["LOWER(TRIM(role)) = 'me'"];
  addRequestedUserCompanyScope(req, whereParts, "users");
  const sql = `
    SELECT id, name, contact
    FROM users
    WHERE ${whereParts.join(" AND ")}
    ORDER BY name
  `;

  db.query(sql, (err, result) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ success: false });
    }
    res.json({ success: true, data: result });
  });
});

// ====================== GET AVAILABLE EMPLOYEES ======================
app.get("/api/available-employees", (req, res) => {
  const { date, time } = req.query;
  const userScopeSql = getCompanyUserScopeSql(getRequestedCompanyScope(req), "u");

  if (!date || !time) {
    return res.status(400).json({
      success: false,
      message: "Date and time required",
    });
  }

  const sql = `
      SELECT u.id, u.name, u.contact
      FROM users u
      WHERE LOWER(TRIM(u.role)) = 'me'
      ${userScopeSql ? `AND ${userScopeSql}` : ""}
      AND u.name NOT IN (
        SELECT assign_emp
        FROM leads
        WHERE action_type = 'appointment'
        AND app_date = ?
        AND app_time = ?
        AND assign_emp IS NOT NULL
      )
      ORDER BY u.name ASC
    `;

  db.query(sql, [date, time], (err, result) => {
    if (err) {
      console.error("Available Employees Error:", err);
      return res.status(500).json({
        success: false,
        message: "Server error while fetching employees",
      });
    }
    res.json({
      success: true,
      data: result,
    });
  });
});

// ====================== GET APPOINTMENTS FOR SPECIFIC ME ======================
app.get("/api/appointments/:id", (req, res) => {
  const userId = req.params.id;

  const nameSql = `SELECT name FROM users WHERE id = ? AND LOWER(role) = 'me'`;
  db.query(nameSql, [userId], (err, userResult) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ success: false });
    }

    if (userResult.length === 0) {
      return res.json({ success: true, data: [] });
    }

    const employeeName = userResult[0].name;

    const sql = `
        SELECT * FROM leads
        WHERE action_type = 'appointment'
        AND assign_emp = ?
        ORDER BY app_date ASC, app_time ASC
      `;

    db.query(sql, [employeeName], (err, result) => {
      if (err) {
        console.error("Appointments Fetch Error:", err);
        return res.status(500).json({ success: false });
      }
      res.json({ success: true, data: result });
    });
  });
});

// ====================== GET FOLLOWUPS FOR SPECIFIC ME ======================
app.get("/api/followups/:id", (req, res) => {
  const userId = req.params.id;

  const sql = `
      SELECT l.*, u.name AS assign_emp_name
  FROM leads l
  LEFT JOIN users u ON l.assign_emp_id = u.id
  WHERE l.action_type = 'followup'
  AND l.assign_emp_id = ?
    `;

  db.query(sql, [userId], (err, result) => {
    if (err) {
      console.error("FollowUps Fetch Error:", err);
      return res.status(500).json({ success: false });
    }

    res.json({
      success: true,
      data: result,
    });
  });
});

// ====================== DEBUG ENDPOINT ======================
app.get("/api/debug/:id", (req, res) => {
  const userId = req.params.id;

  const nameSql = `SELECT id, name, email, role FROM users WHERE id = ?`;

  db.query(nameSql, [userId], (err, userResult) => {
    if (err) return res.json({ success: false, error: err.message });

    if (userResult.length === 0) {
      return res.json({ success: false, error: "User not found" });
    }

    const user = userResult[0];
    const employeeName = user.name;

    const countSql = `
        SELECT 
          (SELECT COUNT(*) FROM leads WHERE assign_emp = ?) AS appointments_count,
          (SELECT COUNT(*) FROM leads WHERE action_type = 'followup' AND assign_emp = ?) AS followups_count,
          (SELECT COUNT(*) FROM leads WHERE lead_status = 'deal_closed' AND closed_by = ?) AS deals_count
      `;

    db.query(
      countSql,
      [employeeName, employeeName, userId],
      (err, countResult) => {
        if (err) return res.json({ success: false, error: err.message });

        res.json({
          success: true,
          user,
          counts: countResult[0],
        });
      },
    );
  });
});

// ====================== ATTENDANCE ======================
app.get("/api/attendance/:userId", async (req, res) => {
  const userId = Number(req.params.userId);

  if (!userId) {
    return res.status(400).json({ success: false, message: "Invalid user id" });
  }

  try {
    await ensureAttendanceTable();
    await ensureUserShiftColumns();
    const attendanceWorkingHoursSql = getAttendanceWorkingHoursSql("a", "u");
    const attendanceStatusSql = getAttendanceStatusSql("a", "u");
    const shiftStartSql = getAttendanceShiftStartSql("u");
    const shiftEndSql = getAttendanceShiftEndSql("u");
    const graceEndSql = getAttendanceGraceEndSql("u");
    const requiredHoursSql = getAttendanceRequiredHoursSql("u");

    const [userRows] = await dbPromise.query(
      `
        SELECT
          role,
          TIME_FORMAT(COALESCE(logout_time, '18:00:00'), '%H:%i:%s') AS logout_time
        FROM users
        WHERE id = ?
        LIMIT 1
      `,
      [userId],
    );

    if (!userRows.length) {
      return res.status(400).json({ success: false, message: "Invalid user id" });
    }

    const now = new Date();
    const endDateKey = getAttendanceDateKey(now);
    const startDateKey = clampAttendanceTrackingStart(addDaysToDateKey(endDateKey, -30));
    const shiftConfig = getAttendanceShiftConfigForRole(
      userRows[0].role,
      userRows[0].logout_time,
    );

    const sql = `
      SELECT
        a.id,
        a.user_id,
        u.name AS user_name,
        DATE_FORMAT(a.attendance_date, '%Y-%m-%d') AS attendance_date,
        DATE_FORMAT(a.check_in, '%H:%i:%s') AS check_in,
        DATE_FORMAT(a.check_out, '%H:%i:%s') AS check_out,
        a.check_in_lat,
        a.check_in_lng,
        a.check_in_location,
        ${attendanceWorkingHoursSql} AS working_hours,
        ${attendanceStatusSql} AS status,
        TIME_FORMAT(${shiftStartSql}, '%H:%i') AS shift_start,
        TIME_FORMAT(${shiftEndSql}, '%H:%i') AS logout_time,
        TIME_FORMAT(${graceEndSql}, '%H:%i') AS late_after,
        ${requiredHoursSql} AS required_hours
      FROM attendance a
      LEFT JOIN users u ON u.id = a.user_id
      WHERE a.user_id = ? AND a.attendance_date BETWEEN ? AND ?
      ORDER BY a.attendance_date DESC, a.id DESC
    `;

    const [rows] = await dbPromise.query(sql, [userId, startDateKey, endDateKey]);
    const attendanceMap = new Map(rows.map((row) => [row.attendance_date, row]));
    const filledRows = [];

    for (
      let attendanceDate = endDateKey;
      attendanceDate >= startDateKey;
      attendanceDate = addDaysToDateKey(attendanceDate, -1)
    ) {
      const existingRow = attendanceMap.get(attendanceDate);

      if (existingRow) {
        filledRows.push(existingRow);
        continue;
      }

      const derivedStatus = computeAttendanceDerivedStatus({
        attendanceDate,
        checkIn: null,
        checkOut: null,
        overrideStatus: null,
        role: userRows[0].role,
        logoutTime: userRows[0].logout_time,
        now,
      });

      if (derivedStatus === "not_marked") {
        continue;
      }

      filledRows.push({
        id: null,
        user_id: userId,
        user_name: null,
        attendance_date: attendanceDate,
        check_in: null,
        check_out: null,
        check_in_lat: null,
        check_in_lng: null,
        check_in_location: null,
        working_hours: "00:00",
        status: derivedStatus,
        shift_start: shiftConfig.shiftStart.slice(0, 5),
        logout_time: shiftConfig.shiftEnd.slice(0, 5),
        late_after: shiftConfig.graceEnd.slice(0, 5),
        required_hours: shiftConfig.requiredHours,
      });
    }

    res.json({ success: true, data: filledRows });
  } catch (err) {
    console.error("Attendance Fetch Error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to fetch attendance",
      error: err.sqlMessage,
    });
  }
});

app.post("/api/attendance/check-in", async (req, res) => {
  const userId = Number(req.body.userId || req.body.user_id || req.body.created_by);
  const lat = Number(req.body.lat);
  const lng = Number(req.body.lng);
  const accuracyMeters = Number(req.body.accuracy);
  const hasLocation = Number.isFinite(lat) && Number.isFinite(lng);
  const locationUrl = hasLocation
    ? `https://www.google.com/maps?q=${lat},${lng}`
    : null;

  if (!userId) {
    return res.status(400).json({ success: false, message: "Invalid user id" });
  }

  if (!hasLocation) {
    return res.status(400).json({
      success: false,
      message: "Location is required for check-in. Please allow location permission.",
    });
  }

  try {
    const attendanceNow = getAppDateTimeParts();
    const locationAccess = await validateAttendanceAccessLocation({
      userId,
      lat,
      lng,
      accuracyMeters,
      attendanceDate: attendanceNow.dateKey,
    });
    const faceVerification = await verifyAttendanceFaceForUser(userId, req.body);
    await ensureAttendanceTable();
    await ensureUserShiftColumns();
    const shiftStartSql = getAttendanceShiftStartSql("u");
    const shiftEndSql = getAttendanceShiftEndSql("u");
    const graceEndSql = getAttendanceGraceEndSql("u");
    const requiredHoursSql = getAttendanceRequiredHoursSql("u");

    const [shiftRows] = await dbPromise.query(
      `
        SELECT
          TIME_FORMAT(${shiftStartSql}, '%H:%i') AS shift_start,
          TIME_FORMAT(${shiftEndSql}, '%H:%i') AS logout_time,
          TIME_FORMAT(${graceEndSql}, '%H:%i') AS late_after,
          ${requiredHoursSql} AS required_hours
        FROM users u
        WHERE id = ?
      `,
      [userId],
    );

    if (shiftRows.length === 0) {
      return res.status(400).json({ success: false, message: "Invalid user id" });
    }

    const currentTime = attendanceNow.timeKey;
    const isLate =
      currentTime > normalizeAttendanceTimeString(shiftRows[0].late_after);
    const isGrace =
      currentTime > normalizeAttendanceTimeString(shiftRows[0].shift_start) &&
      currentTime <= normalizeAttendanceTimeString(shiftRows[0].late_after);
    const attendanceStatus = isLate ? "late" : "present";
    const responseStatus = isLate
      ? "late"
      : isGrace
        ? "grace"
        : "present";
    const attendanceDateColumn = quoteDbIdentifier(await getAttendanceTableDateColumn());

    const sql = `
      INSERT INTO attendance (
        user_id,
        ${attendanceDateColumn},
        check_in,
        check_in_lat,
        check_in_lng,
        check_in_location,
        status
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        status = IF(check_in IS NULL, VALUES(status), status),
        check_in = IF(check_in IS NULL, VALUES(check_in), check_in),
        check_in_lat = IF(check_in_lat IS NULL, VALUES(check_in_lat), check_in_lat),
        check_in_lng = IF(check_in_lng IS NULL, VALUES(check_in_lng), check_in_lng),
        check_in_location = IF(check_in_location IS NULL, VALUES(check_in_location), check_in_location)
    `;

    await dbPromise.query(sql, [
      userId,
      attendanceNow.dateKey,
      attendanceNow.dateTimeSql,
      hasLocation ? lat : null,
      hasLocation ? lng : null,
      locationUrl,
      attendanceStatus,
    ]);
    res.json({
      success: true,
      message:
        responseStatus === "late"
          ? locationAccess.zoneType === "approved_offsite"
            ? "Late check-in saved from approved meeting location"
            : "Check-in saved as Late"
          : responseStatus === "grace"
            ? locationAccess.zoneType === "approved_offsite"
              ? "Check-in saved from approved meeting location within grace time"
              : "Check-in saved within grace time"
            : locationAccess.zoneType === "approved_offsite"
              ? "Check-in saved from approved meeting location"
              : "Check-in saved",
      status: responseStatus,
      shift_start: shiftRows[0].shift_start,
      logout_time: shiftRows[0].logout_time,
      late_after: shiftRows[0].late_after,
      required_hours: shiftRows[0].required_hours,
      attendance_date: attendanceNow.dateKey,
      check_in: attendanceNow.timeKey,
      face_verified: true,
      face_score: faceVerification.score,
    });
  } catch (err) {
    console.error("Attendance Check-in Error:", err);
    res.status(err.statusCode || 500).json({
      success: false,
      message: err.message || "Failed to save check-in",
      error: err.sqlMessage,
    });
  }
});

app.put("/api/attendance/check-out", async (req, res) => {
  const userId = Number(req.body.userId || req.body.user_id || req.body.created_by);
  const lat = Number(req.body.lat);
  const lng = Number(req.body.lng);
  const accuracyMeters = Number(req.body.accuracy);
  const hasLocation = Number.isFinite(lat) && Number.isFinite(lng);

  if (!userId) {
    return res.status(400).json({ success: false, message: "Invalid user id" });
  }

  if (!hasLocation) {
    return res.status(400).json({
      success: false,
      message: "Location is required for check-out. Please allow location permission.",
    });
  }

  try {
    const attendanceNow = getAppDateTimeParts();
    const locationAccess = await validateAttendanceAccessLocation({
      userId,
      lat,
      lng,
      accuracyMeters,
      attendanceDate: attendanceNow.dateKey,
    });
    const faceVerification = await verifyAttendanceFaceForUser(userId, req.body);
    const checkoutResult = await finalizeAttendanceCheckout({
      userId,
      checkoutAt: new Date(),
      scope: "today",
    });

    if (checkoutResult.noop) {
      return res.status(400).json({
        success: false,
        message: "Please check in before check out",
      });
    }

    res.json({
      success: true,
      message:
        locationAccess.zoneType === "approved_offsite"
          ? "Check-out saved from approved meeting location"
          : checkoutResult.message,
      status: checkoutResult.status,
      logout_time: checkoutResult.logout_time,
      check_out: checkoutResult.check_out,
      face_verified: true,
      face_score: faceVerification.score,
    });
  } catch (err) {
    console.error("Attendance Check-out Error:", err);
    res.status(err.statusCode || 500).json({
      success: false,
      message: err.message || "Failed to save check-out",
      error: err.sqlMessage,
    });
  }
});

app.post("/api/attendance/auto-check-out/schedule", (req, res) => {
  const userId = Number(req.body.userId);
  const sessionId = String(req.body.sessionId || "").trim();
  const closedAt = parseAttendanceCheckoutDate(req.body.closedAt);

  if (!userId || !sessionId) {
    return res.status(400).json({
      success: false,
      message: "Invalid auto checkout request",
    });
  }

  clearPendingAttendanceAutoCheckout(userId, sessionId);

  const timerKey = getAttendanceAutoCheckoutKey(userId, sessionId);
  const timerHandle = setTimeout(async () => {
    try {
      await finalizeAttendanceCheckout({
        userId,
        checkoutAt: closedAt,
        scope: "latest_open",
      });
    } catch (err) {
      console.error("Attendance Auto Check-out Error:", err);
    } finally {
      pendingAttendanceAutoCheckoutTimers.delete(timerKey);
    }
  }, ATTENDANCE_AUTO_CHECKOUT_DELAY_MS);

  pendingAttendanceAutoCheckoutTimers.set(timerKey, timerHandle);

  res.json({
    success: true,
    scheduled: true,
  });
});

app.post("/api/attendance/auto-check-out/cancel", (req, res) => {
  const userId = Number(req.body.userId);
  const sessionId = String(req.body.sessionId || "").trim();

  if (!userId || !sessionId) {
    return res.status(400).json({
      success: false,
      message: "Invalid auto checkout cancel request",
    });
  }

  const cancelled = clearPendingAttendanceAutoCheckout(userId, sessionId);
  res.json({
    success: true,
    cancelled,
  });
});

app.post("/api/attendance/auto-check-out/finalize", async (req, res) => {
  const userId = Number(req.body.userId);
  const sessionId = String(req.body.sessionId || "").trim();

  if (!userId) {
    return res.status(400).json({
      success: false,
      message: "Invalid auto checkout finalize request",
    });
  }

  if (sessionId) {
    clearPendingAttendanceAutoCheckout(userId, sessionId);
  }

  try {
    const checkoutResult = await finalizeAttendanceCheckout({
      userId,
      checkoutAt: parseAttendanceCheckoutDate(req.body.closedAt),
      scope: "latest_open",
    });

    res.json({
      success: true,
      message: checkoutResult.message,
      status: checkoutResult.status,
      logout_time: checkoutResult.logout_time,
      check_out: checkoutResult.check_out,
      attendance_date: checkoutResult.attendance_date,
      noop: checkoutResult.noop,
    });
  } catch (err) {
    console.error("Attendance Auto Finalize Error:", err);
    res.status(err.statusCode || 500).json({
      success: false,
      message: "Failed to finalize auto check-out",
      error: err.sqlMessage,
    });
  }
});

app.get("/api/attendance/history/:userId", async (req, res) => {
  const userId = Number(req.params.userId);
  const month = Number(req.query.month);
  const year = Number(req.query.year);
  const week = String(req.query.week || "all");

  if (!userId) {
    return res.status(400).json({ success: false, message: "Invalid user id" });
  }

  try {
    await ensureAttendanceTable();
    await ensureUserShiftColumns();
    const attendanceStatusLabelSql = getAttendanceStatusLabelSql("a", "u");

    const [userRows] = await dbPromise.query(
      `
        SELECT
          role,
          TIME_FORMAT(COALESCE(logout_time, '18:00:00'), '%H:%i:%s') AS logout_time
        FROM users
        WHERE id = ?
        LIMIT 1
      `,
      [userId],
    );

    if (!userRows.length) {
      return res.status(400).json({ success: false, message: "Invalid user id" });
    }

    let sql = `
      SELECT
        DATE_FORMAT(a.attendance_date, '%Y-%m-%d') AS date,
        DATE_FORMAT(a.check_in, '%H:%i:%s') AS in_time,
        DATE_FORMAT(a.check_out, '%H:%i:%s') AS out_time,
        ${attendanceStatusLabelSql} AS status
      FROM attendance a
      LEFT JOIN users u ON u.id = a.user_id
      WHERE a.user_id = ?
    `;
    const params = [userId];
    const now = new Date();
    const currentDateKey = getAttendanceDateKey(now);
    const currentMonth = Number(currentDateKey.slice(5, 7));
    const currentYear = Number(currentDateKey.slice(0, 4));
    const targetMonth = month && year ? month : currentMonth;
    const targetYear = month && year ? year : currentYear;
    const targetMonthStartKey = `${targetYear}-${String(targetMonth).padStart(2, "0")}-01`;

    if (isBeforeAttendanceTrackingStart(targetMonthStartKey)) {
      return res.json({ success: true, data: [] });
    }

    let rangeStartDay = 1;
    let rangeEndDay = new Date(Date.UTC(targetYear, targetMonth, 0)).getUTCDate();

    if (targetMonth && targetYear) {
      sql += ` AND MONTH(a.attendance_date) = ? AND YEAR(a.attendance_date) = ?`;
      params.push(targetMonth, targetYear);

      if (week && week !== "all") {
        const weekNum = Number.parseInt(week, 10);

        if (Number.isFinite(weekNum) && weekNum > 0) {
          const startDay = ((weekNum - 1) * 7) + 1;
          const lastDay = new Date(Date.UTC(targetYear, targetMonth, 0)).getUTCDate();
          const endDay = Math.min(startDay + 6, lastDay);
          rangeStartDay = startDay;
          rangeEndDay = endDay;

          sql += ` AND DAY(a.attendance_date) BETWEEN ? AND ?`;
          params.push(startDay, endDay);
        }
      }
    }

    sql += ` ORDER BY a.attendance_date DESC`;

    const [rows] = await dbPromise.query(sql, params);
    const attendanceMap = new Map(rows.map((row) => [row.date, row]));
    const shiftConfig = getAttendanceShiftConfigForRole(
      userRows[0].role,
      userRows[0].logout_time,
    );
    const filledRows = [];

    for (let day = rangeEndDay; day >= rangeStartDay; day -= 1) {
      const dateKey = `${targetYear}-${String(targetMonth).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

      if (isBeforeAttendanceTrackingStart(dateKey)) {
        continue;
      }

      const existingRow = attendanceMap.get(dateKey);

      if (existingRow) {
        filledRows.push(existingRow);
        continue;
      }

      const derivedStatus = computeAttendanceDerivedStatus({
        attendanceDate: dateKey,
        checkIn: null,
        checkOut: null,
        overrideStatus: null,
        role: userRows[0].role,
        logoutTime: userRows[0].logout_time,
        now,
      });

      if (derivedStatus === "not_marked") {
        continue;
      }

      filledRows.push({
        date: dateKey,
        in_time: null,
        out_time: null,
        status: getAttendanceStatusLabel(derivedStatus),
        shift_start: shiftConfig.shiftStart.slice(0, 5),
        logout_time: shiftConfig.shiftEnd.slice(0, 5),
        late_after: shiftConfig.graceEnd.slice(0, 5),
        required_hours: shiftConfig.requiredHours,
      });
    }

    res.json({ success: true, data: filledRows });
  } catch (err) {
    console.error("Attendance History Error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to fetch attendance history",
      error: err.sqlMessage,
    });
  }
});

app.get("/api/attendance/today/:userId", async (req, res) => {
  const userId = Number(req.params.userId);

  if (!userId) {
    return res.status(400).json({ success: false, message: "Invalid user id" });
  }

  try {
    await ensureAttendanceTable();
    await ensureUserShiftColumns();
    const attendanceStatusSql = getAttendanceStatusSql("a", "u");
    const shiftStartSql = getAttendanceShiftStartSql("u");
    const shiftEndSql = getAttendanceShiftEndSql("u");
    const graceEndSql = getAttendanceGraceEndSql("u");
    const requiredHoursSql = getAttendanceRequiredHoursSql("u");

    const [userRows] = await dbPromise.query(
      `
        SELECT
          role,
          TIME_FORMAT(COALESCE(logout_time, '18:00:00'), '%H:%i:%s') AS logout_time
        FROM users
        WHERE id = ?
        LIMIT 1
      `,
      [userId],
    );

    if (!userRows.length) {
      return res.status(400).json({ success: false, message: "Invalid user id" });
    }

    const [rows] = await dbPromise.query(
      `
        SELECT
          a.check_in_lat AS latitude,
          a.check_in_lng AS longitude,
          a.check_in_location AS location_url,
          DATE_FORMAT(a.check_in, '%H:%i:%s') AS check_in,
          DATE_FORMAT(a.check_out, '%H:%i:%s') AS check_out,
          ${attendanceStatusSql} AS status,
          TIME_FORMAT(${shiftStartSql}, '%H:%i') AS shift_start,
          TIME_FORMAT(${shiftEndSql}, '%H:%i') AS logout_time,
          TIME_FORMAT(${graceEndSql}, '%H:%i') AS late_after,
          ${requiredHoursSql} AS required_hours,
          DATE_FORMAT(a.updated_at, '%Y-%m-%d %H:%i:%s') AS updated_at
        FROM attendance a
        LEFT JOIN users u ON u.id = a.user_id
        WHERE a.user_id = ? AND a.attendance_date = ?
        LIMIT 1
      `,
      [userId, todayKey]
    );

    if (!rows.length) {
      const shiftConfig = getAttendanceShiftConfigForRole(
        userRows[0].role,
        userRows[0].logout_time,
      );
      const derivedStatus = computeAttendanceDerivedStatus({
        attendanceDate: todayKey,
        checkIn: null,
        checkOut: null,
        overrideStatus: null,
        role: userRows[0].role,
        logoutTime: userRows[0].logout_time,
      });

      if (derivedStatus === "absent") {
        return res.json({
          success: true,
          data: {
            latitude: null,
            longitude: null,
            location_url: null,
            check_in: null,
            check_out: null,
            status: "absent",
            shift_start: shiftConfig.shiftStart.slice(0, 5),
            logout_time: shiftConfig.shiftEnd.slice(0, 5),
            late_after: shiftConfig.graceEnd.slice(0, 5),
            required_hours: shiftConfig.requiredHours,
            updated_at: null,
          },
          latitude: null,
          longitude: null,
          status: "absent",
        });
      }

      return res.json({
        success: true,
        data: null,
        latitude: null,
        longitude: null,
      });
    }

    const todayAttendance = rows[0];
    res.json({
      success: true,
      data: todayAttendance,
      ...todayAttendance,
      latitude: todayAttendance.latitude ?? null,
      longitude: todayAttendance.longitude ?? null,
    });
  } catch (err) {
    console.error("Attendance Today Error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to fetch today's attendance",
      error: err.sqlMessage,
    });
  }
});

app.get("/api/attendance/location-request/:userId", async (req, res) => {
  const userId = Number(req.params.userId);
  const attendanceDate = getAttendanceDateKey(
    req.query.date || new Date(),
  );

  if (!userId) {
    return res.status(400).json({ success: false, message: "Invalid user id" });
  }

  try {
    const context = await getAttendanceLocationRequestContext(
      userId,
      attendanceDate,
    );

    res.json({
      success: true,
      data: {
        ...context,
        attendanceDate,
      },
    });
  } catch (err) {
    console.error("Attendance location request context error:", err);
    if (
      err.code === "ER_BAD_FIELD_ERROR" &&
      /attendance_date/i.test(String(err.sqlMessage || err.message || ""))
    ) {
      const officeZone = getAttendanceOfficeZone();
      return res.json({
        success: true,
        data: {
          officeZone,
          activeRequest: null,
          activeZone: officeZone,
          approvedZone: null,
          attendanceDate,
        },
      });
    }

    res.status(err.statusCode || 500).json({
      success: false,
      message: err.message || "Failed to fetch offsite attendance request",
    });
  }
});

app.post("/api/attendance/location-request", async (req, res) => {
  const userId = Number(req.body.userId || req.body.user_id || req.body.created_by);
  const lat = Number(req.body.lat);
  const lng = Number(req.body.lng);
  const accuracyMeters = Number(req.body.accuracy);
  const hasLocation = Number.isFinite(lat) && Number.isFinite(lng);
  const purpose = String(req.body.purpose || "").trim();
  const meetingWith = String(req.body.meetingWith || "").trim() || null;
  const notes = String(req.body.notes || "").trim() || null;
  const requestedAddress =
    String(req.body.locationLabel || req.body.requestedAddress || "").trim();
  const attendanceDate = getAttendanceDateKey(
    req.body.attendanceDate || new Date(),
  );
  const requestedRadiusMeters = normalizeAttendanceRadiusMeters(
    req.body.requestedRadiusMeters,
    ATTENDANCE_OFFSITE_DEFAULT_RADIUS_METERS,
  );

  if (!userId) {
    return res.status(400).json({ success: false, message: "Invalid user id" });
  }

  if (!hasLocation) {
    return res.status(400).json({
      success: false,
      message: "Current location is required to send the offsite attendance request.",
    });
  }

  if (!purpose || !requestedAddress) {
    return res.status(400).json({
      success: false,
      message: "Meeting purpose and location label are required.",
    });
  }

  try {
    await ensureAttendanceLocationRequestsTable();

    const user = await getUserRecordById(userId);
    if (!user) {
      return res.status(400).json({ success: false, message: "Invalid user id" });
    }

    const locationUrl = buildAttendanceLocationUrl(lat, lng);
    const latestRequest = await getLatestAttendanceLocationRequest(
      userId,
      attendanceDate,
    );

    if (
      latestRequest &&
      ["pending", "approved"].includes(
        normalizeAttendanceLocationRequestStatus(latestRequest.status),
      )
    ) {
      await dbPromise.query(
        `
          UPDATE attendance_location_requests
          SET
            purpose = ?,
            meeting_with = ?,
            notes = ?,
            requested_lat = ?,
            requested_lng = ?,
            requested_accuracy = ?,
            requested_location_url = ?,
            requested_address = ?,
            requested_radius_meters = ?,
            status = 'pending',
            admin_remark = NULL,
            reviewed_by = NULL,
            reviewed_by_name = NULL,
            reviewed_at = NULL,
            approved_lat = NULL,
            approved_lng = NULL,
            approved_location_url = NULL,
            approved_address = NULL,
            approved_radius_meters = NULL
          WHERE id = ?
        `,
        [
          purpose,
          meetingWith,
          notes,
          lat,
          lng,
          Number.isFinite(accuracyMeters) ? accuracyMeters : null,
          locationUrl,
          requestedAddress,
          requestedRadiusMeters,
          latestRequest.id,
        ],
      );
    } else {
      const requestDateColumn = quoteDbIdentifier(
        await getAttendanceLocationRequestDateColumn(),
      );
      await dbPromise.query(
        `
          INSERT INTO attendance_location_requests (
            user_id,
            ${requestDateColumn},
            purpose,
            meeting_with,
            notes,
            requested_lat,
            requested_lng,
            requested_accuracy,
            requested_location_url,
            requested_address,
            requested_radius_meters,
            status
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
        `,
        [
          userId,
          attendanceDate,
          purpose,
          meetingWith,
          notes,
          lat,
          lng,
          Number.isFinite(accuracyMeters) ? accuracyMeters : null,
          locationUrl,
          requestedAddress,
          requestedRadiusMeters,
        ],
      );
    }

    const context = await getAttendanceLocationRequestContext(
      userId,
      attendanceDate,
    );

    res.json({
      success: true,
      message: latestRequest
        ? "Offsite attendance request updated and sent to admin."
        : "Offsite attendance request sent to admin.",
      data: {
        ...context,
        attendanceDate,
      },
    });
  } catch (err) {
    console.error("Attendance location request submit error:", err);
    res.status(err.statusCode || 500).json({
      success: false,
      message: err.message || "Failed to submit offsite attendance request",
    });
  }
});

app.get("/api/admin/attendance", async (req, res) => {
  const selectedDate = getAttendanceDateKey(req.query.date || new Date());
  const roleFilter = String(req.query.role || "")
    .toLowerCase()
    .trim();
  const statusFilter = String(req.query.status || "")
    .toLowerCase()
    .trim()
    .replace(/[\s-]+/g, "_");

  try {
    if (isBeforeAttendanceTrackingStart(selectedDate)) {
      return res.json({
        success: true,
        data: [],
        summary: {
          ...createAttendanceSummaryCounts(),
          startDate: ATTENDANCE_TRACKING_START_DATE,
          endDate: selectedDate,
          totalUsers: 0,
          totalDays: 0,
        },
      });
    }

    await ensureAttendanceTable();
    await ensureUserShiftColumns();
    const monthStartDate = getAttendanceMonthStart(selectedDate);
    const userWhereParts = [
      "LOWER(TRIM(COALESCE(u.role, ''))) <> 'admin'",
    ];
    addRequestedUserCompanyScope(req, userWhereParts, "u");

    const [rows] = await dbPromise.query(
      `
        SELECT
          u.id AS user_id,
          u.name AS user_name,
          u.role,
          TIME_FORMAT(COALESCE(u.logout_time, '18:00:00'), '%H:%i:%s') AS logout_time,
          DATE_FORMAT(a.attendance_date, '%Y-%m-%d') AS attendance_date,
          DATE_FORMAT(a.check_in, '%H:%i:%s') AS check_in,
          DATE_FORMAT(a.check_out, '%H:%i:%s') AS check_out,
          a.check_in_lat,
          a.check_in_lng,
          a.check_in_location,
          a.admin_override_status
        FROM users u
        LEFT JOIN attendance a
          ON a.user_id = u.id
          AND a.attendance_date = ?
        WHERE ${userWhereParts.join("\n          AND ")}
        ORDER BY u.name ASC
      `,
      [selectedDate],
    );

    const [summaryRows] = await dbPromise.query(
      `
        SELECT
          u.id AS user_id,
          u.role,
          TIME_FORMAT(COALESCE(u.logout_time, '18:00:00'), '%H:%i:%s') AS logout_time,
          DATE_FORMAT(a.attendance_date, '%Y-%m-%d') AS attendance_date,
          DATE_FORMAT(a.check_in, '%H:%i:%s') AS check_in,
          DATE_FORMAT(a.check_out, '%H:%i:%s') AS check_out,
          a.admin_override_status
        FROM users u
        LEFT JOIN attendance a
          ON a.user_id = u.id
          AND a.attendance_date BETWEEN ? AND ?
        WHERE ${userWhereParts.join("\n          AND ")}
        ORDER BY u.name ASC, a.attendance_date ASC
      `,
      [monthStartDate, selectedDate],
    );

    const now = new Date();
    const dailyRows = rows.map((row) => {
        const shiftConfig = getAttendanceShiftConfigForRole(row.role, row.logout_time);
        const status = computeAttendanceDerivedStatus({
          attendanceDate: selectedDate,
          checkIn: row.check_in,
          checkOut: row.check_out,
          overrideStatus: row.admin_override_status,
          role: row.role,
          logoutTime: row.logout_time,
          now,
        });

        return {
          user_id: row.user_id,
          user_name: row.user_name,
          role: row.role,
          attendance_date: selectedDate,
          check_in: row.check_in,
          check_out: row.check_out,
          check_in_lat: row.check_in_lat,
          check_in_lng: row.check_in_lng,
          check_in_location: row.check_in_location,
          status,
          status_label: getAttendanceStatusLabel(status),
          working_hours: formatAttendanceWorkingHoursFromTimes(row.check_in, row.check_out),
          shift_start: shiftConfig.shiftStart.slice(0, 5),
          logout_time: shiftConfig.shiftEnd.slice(0, 5),
          late_after: shiftConfig.graceEnd.slice(0, 5),
          required_hours: shiftConfig.requiredHours,
          has_record: Boolean(row.attendance_date),
          has_pending_checkout: status === "checkout_pending",
          has_override: Boolean(row.admin_override_status),
        };
      });

    const summaryUsers = dailyRows
      .filter((row) => !roleFilter || normalizeAttendanceRole(row.role) === roleFilter)
      .map((row) => ({
        user_id: row.user_id,
        role: row.role,
        logout_time: row.logout_time,
      }));

    const formattedRows = dailyRows
      .filter((row) => !roleFilter || normalizeAttendanceRole(row.role) === roleFilter)
      .filter((row) => !statusFilter || row.status === statusFilter);

    const monthSummary = buildAttendanceMonthlySummary({
      users: summaryUsers,
      attendanceRows: summaryRows,
      startDate: monthStartDate,
      endDate: selectedDate,
      now,
    });

    res.json({
      success: true,
      data: formattedRows,
      summary: monthSummary,
    });
  } catch (err) {
    console.error("Admin Attendance Error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to fetch admin attendance",
      error: err.sqlMessage,
    });
  }
});

app.get("/api/admin/attendance/location-requests", async (req, res) => {
  const adminId = Number(req.query.adminId || 0);
  const attendanceDate = getAttendanceDateKey(req.query.date || new Date());
  const roleFilter = normalizeAttendanceRole(req.query.role);
  const rawStatusFilter = String(req.query.status || "")
    .trim()
    .toLowerCase();
  const statusFilter = ["pending", "approved", "rejected", "cancelled"].includes(
    rawStatusFilter,
  )
    ? rawStatusFilter
    : "";

  if (!adminId) {
    return res.status(400).json({ success: false, message: "Invalid admin id" });
  }

  try {
    await ensureAdminAccess(adminId);
    await ensureAttendanceLocationRequestsTable();

    const filters = ["r.attendance_date = ?", "LOWER(TRIM(COALESCE(u.role, ''))) <> 'admin'"];
    const params = [attendanceDate];
    addRequestedUserCompanyScope(req, filters, "u");

    if (roleFilter) {
      filters.push("LOWER(TRIM(COALESCE(u.role, ''))) = ?");
      params.push(roleFilter);
    }

    if (statusFilter) {
      filters.push("LOWER(TRIM(COALESCE(r.status, 'pending'))) = ?");
      params.push(statusFilter);
    }

    const [rows] = await dbPromise.query(
      `
        SELECT
          r.id,
          r.user_id,
          DATE_FORMAT(r.attendance_date, '%Y-%m-%d') AS attendance_date,
          r.purpose,
          r.meeting_with,
          r.notes,
          r.requested_lat,
          r.requested_lng,
          r.requested_accuracy,
          r.requested_location_url,
          r.requested_address,
          r.requested_radius_meters,
          r.status,
          r.admin_remark,
          r.reviewed_by,
          r.reviewed_by_name,
          DATE_FORMAT(r.reviewed_at, '%Y-%m-%d %H:%i:%s') AS reviewed_at,
          r.approved_lat,
          r.approved_lng,
          r.approved_location_url,
          r.approved_address,
          r.approved_radius_meters,
          DATE_FORMAT(r.created_at, '%Y-%m-%d %H:%i:%s') AS created_at,
          DATE_FORMAT(r.updated_at, '%Y-%m-%d %H:%i:%s') AS updated_at,
          u.name AS user_name,
          u.role
        FROM attendance_location_requests r
        INNER JOIN users u ON u.id = r.user_id
        WHERE ${filters.join(" AND ")}
        ORDER BY
          FIELD(LOWER(TRIM(COALESCE(r.status, 'pending'))), 'pending', 'approved', 'rejected', 'cancelled'),
          r.updated_at DESC,
          r.id DESC
      `,
      params,
    );

    const data = rows.map((row) => ({
      ...buildAttendanceLocationRequestPayload(row),
      userName: String(row.user_name || "").trim(),
      role: normalizeAttendanceRole(row.role),
    }));

    const summary = data.reduce(
      (accumulator, request) => {
        const normalizedStatus = normalizeAttendanceLocationRequestStatus(
          request.status,
        );
        if (normalizedStatus === "pending") accumulator.pending += 1;
        if (normalizedStatus === "approved") accumulator.approved += 1;
        if (normalizedStatus === "rejected") accumulator.rejected += 1;
        if (normalizedStatus === "cancelled") accumulator.cancelled += 1;
        return accumulator;
      },
      { pending: 0, approved: 0, rejected: 0, cancelled: 0 },
    );

    res.json({
      success: true,
      data,
      summary,
      date: attendanceDate,
    });
  } catch (err) {
    console.error("Admin attendance location requests error:", err);
    res.status(err.statusCode || 500).json({
      success: false,
      message: err.message || "Failed to fetch attendance location requests",
    });
  }
});

app.put("/api/admin/attendance/location-requests/:id", async (req, res) => {
  const requestId = Number(req.params.id || 0);
  const adminId = Number(req.body.adminId || 0);
  const requestedStatus = normalizeAttendanceLocationRequestStatus(
    req.body.status,
    "",
  );
  const adminRemark = String(req.body.adminRemark || "").trim() || null;
  const approvedRadiusMeters = normalizeAttendanceRadiusMeters(
    req.body.approvedRadiusMeters,
    ATTENDANCE_OFFSITE_DEFAULT_RADIUS_METERS,
  );

  if (!requestId || !adminId || !["approved", "rejected"].includes(requestedStatus)) {
    return res.status(400).json({
      success: false,
      message: "Invalid offsite attendance approval request",
    });
  }

  try {
    const adminUser = await ensureAdminAccess(adminId);
    await ensureAttendanceLocationRequestsTable();

    const [rows] = await dbPromise.query(
      `
        SELECT
          id,
          user_id,
          DATE_FORMAT(attendance_date, '%Y-%m-%d') AS attendance_date,
          purpose,
          meeting_with,
          notes,
          requested_lat,
          requested_lng,
          requested_accuracy,
          requested_location_url,
          requested_address,
          requested_radius_meters,
          status,
          admin_remark,
          reviewed_by,
          reviewed_by_name,
          DATE_FORMAT(reviewed_at, '%Y-%m-%d %H:%i:%s') AS reviewed_at,
          approved_lat,
          approved_lng,
          approved_location_url,
          approved_address,
          approved_radius_meters,
          DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') AS created_at,
          DATE_FORMAT(updated_at, '%Y-%m-%d %H:%i:%s') AS updated_at
        FROM attendance_location_requests
        WHERE id = ?
        LIMIT 1
      `,
      [requestId],
    );

    if (!rows.length) {
      return res.status(404).json({
        success: false,
        message: "Offsite attendance request not found",
      });
    }

    const requestRow = buildAttendanceLocationRequestPayload(rows[0]);
    const attendanceNow = getAppDateTimeParts();

    await dbPromise.query(
      `
        UPDATE attendance_location_requests
        SET
          status = ?,
          admin_remark = ?,
          reviewed_by = ?,
          reviewed_by_name = ?,
          reviewed_at = ?,
          approved_lat = ?,
          approved_lng = ?,
          approved_location_url = ?,
          approved_address = ?,
          approved_radius_meters = ?
        WHERE id = ?
      `,
      [
        requestedStatus,
        adminRemark,
        adminUser.id,
        adminUser.name || "Admin",
        attendanceNow.dateTimeSql,
        requestedStatus === "approved" ? requestRow.requestedLat : null,
        requestedStatus === "approved" ? requestRow.requestedLng : null,
        requestedStatus === "approved"
          ? requestRow.requestedLocationUrl
          : null,
        requestedStatus === "approved" ? requestRow.requestedAddress : null,
        requestedStatus === "approved" ? approvedRadiusMeters : null,
        requestId,
      ],
    );

    const latestRequest = await getLatestAttendanceLocationRequest(
      requestRow.userId,
      requestRow.attendanceDate,
    );

    res.json({
      success: true,
      message:
        requestedStatus === "approved"
          ? "Offsite attendance request approved successfully"
          : "Offsite attendance request rejected",
      data: latestRequest,
    });
  } catch (err) {
    console.error("Admin attendance location request review error:", err);
    res.status(err.statusCode || 500).json({
      success: false,
      message: err.message || "Failed to review offsite attendance request",
    });
  }
});

app.put("/api/admin/attendance/resolve", async (req, res) => {
  const userId = Number(req.body.userId);
  const adminId = Number(req.body.adminId);
  const attendanceDate = String(req.body.date || "").trim();

  if (!userId || !attendanceDate) {
    return res.status(400).json({ success: false, message: "Invalid attendance update request" });
  }

  try {
    await ensureAttendanceTable();
    await ensureUserShiftColumns();

    const [attendanceRows] = await dbPromise.query(
      `
        SELECT DATE_FORMAT(check_in, '%H:%i:%s') AS check_in_time
        FROM attendance
        WHERE user_id = ? AND attendance_date = ? AND check_in IS NOT NULL
        LIMIT 1
      `,
      [userId, attendanceDate],
    );

    if (!attendanceRows.length) {
      return res.status(400).json({
        success: false,
        message: "Attendance record not found or check-in missing",
      });
    }

    const attendanceNow = getAppDateTimeParts();
    const nowTime = attendanceNow.timeKey;
    const checkInTime = attendanceRows[0].check_in_time || nowTime;
    const resolvedTime = nowTime < checkInTime ? checkInTime : nowTime;
    const resolvedCheckout = `${attendanceDate} ${resolvedTime}`;

    const [result] = await dbPromise.query(
      `
        UPDATE attendance
        SET
          check_out = ?,
          admin_override_status = NULL,
          admin_override_at = ?,
          admin_override_by = ?
        WHERE user_id = ? AND attendance_date = ? AND check_in IS NOT NULL
      `,
      [resolvedCheckout, attendanceNow.dateTimeSql, adminId || null, userId, attendanceDate],
    );

    res.json({ success: true, message: "Checkout resolved using current admin time" });
  } catch (err) {
    console.error("Admin Attendance Resolve Error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to resolve checkout",
      error: err.sqlMessage,
    });
  }
});

app.put("/api/admin/attendance/override", async (req, res) => {
  const userId = Number(req.body.userId);
  const adminId = Number(req.body.adminId);
  const attendanceDate = String(req.body.date || "").trim();
  const requestedStatus = String(req.body.status || "")
    .toLowerCase()
    .trim()
    .replace(/[\s-]+/g, "_");
  const allowedStatuses = new Set(["present", "grace", "late", "half_day", "absent", "checkout_pending", "auto"]);

  if (!userId || !attendanceDate || !allowedStatuses.has(requestedStatus)) {
    return res.status(400).json({ success: false, message: "Invalid attendance override request" });
  }

  try {
    await ensureAttendanceTable();
    const overrideValue = requestedStatus === "auto" ? null : requestedStatus;
    const [attendanceRows] = await dbPromise.query(
      `
        SELECT
          DATE_FORMAT(check_in, '%H:%i:%s') AS check_in_time,
          check_out
        FROM attendance
        WHERE user_id = ? AND attendance_date = ?
        LIMIT 1
      `,
      [userId, attendanceDate],
    );

    if (!attendanceRows.length) {
      return res.status(400).json({
        success: false,
        message: "Attendance record not found for manual override",
      });
    }

    const needsResolvedCheckout = Boolean(attendanceRows[0].check_in_time)
      && !attendanceRows[0].check_out
      && ["present", "grace", "late", "half_day"].includes(overrideValue || "");
    const attendanceNow = getAppDateTimeParts();
    const currentTime = attendanceNow.timeKey;
    const resolvedTime = currentTime < (attendanceRows[0].check_in_time || currentTime)
      ? attendanceRows[0].check_in_time
      : currentTime;
    const overrideCheckout = needsResolvedCheckout
      ? `${attendanceDate} ${resolvedTime}`
      : null;

    const [result] = await dbPromise.query(
      `
        UPDATE attendance
        SET
          check_out = COALESCE(?, check_out),
          admin_override_status = ?,
          admin_override_at = ?,
          admin_override_by = ?
        WHERE user_id = ? AND attendance_date = ?
      `,
      [overrideCheckout, overrideValue, attendanceNow.dateTimeSql, adminId || null, userId, attendanceDate],
    );

    res.json({
      success: true,
      message: overrideValue ? "Attendance status updated" : "Attendance override cleared",
    });
  } catch (err) {
    console.error("Admin Attendance Override Error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to update attendance override",
      error: err.sqlMessage,
    });
  }
});

async function handleLeaveStatusUpdate(req, res, forcedStatus = "") {
  const leaveId = Number(req.params.id);
  const adminId = Number(req.body.adminId || req.query.adminId);
  const requestedStatus = normalizeLeaveStatus(forcedStatus || req.body.status);
  const adminRemark = String(req.body.adminRemark || "").trim();

  if (!leaveId || !adminId || !requestedStatus) {
    return res.status(400).json({
      success: false,
      message: "Invalid leave status update request",
    });
  }

  if (requestedStatus === "rejected" && !adminRemark) {
    return res.status(400).json({
      success: false,
      message: "Rejection reason is required",
    });
  }

  try {
    const adminUser = await ensureAdminAccess(adminId);
    const leaveRequest = await getLeaveRequestById(leaveId);

    if (!leaveRequest) {
      return res.status(404).json({
        success: false,
        message: "Leave request not found",
      });
    }

    if (normalizeLeaveApprovalRoute(leaveRequest.approval_route) === "leader") {
      return res.status(400).json({
        success: false,
        message: "This leave request is handled by the assigned group leader",
      });
    }

    await dbPromise.query(
      `
        UPDATE leave_requests
        SET
          status = ?,
          admin_remark = ?,
          admin_reviewed_by = ?,
          admin_reviewer_name = ?,
          admin_reviewed_at = ${requestedStatus === "pending" ? "NULL" : "NOW()"},
          approval_stage = ?,
          updated_at = NOW()
        WHERE id = ?
      `,
      [
        requestedStatus,
        adminRemark || null,
        requestedStatus === "pending" ? null : adminUser.id,
        requestedStatus === "pending" ? null : (adminUser.name || "Admin"),
        requestedStatus === "pending" ? "admin_review" : "completed",
        leaveId,
      ],
    );

    const updatedLeaveRequest = await getLeaveRequestById(leaveId);
    const statusMessages = {
      pending: "Leave status moved to pending",
      approved: "Leave approved successfully",
      rejected: "Leave rejected successfully",
    };

    res.json({
      success: true,
      message: statusMessages[requestedStatus] || "Leave status updated",
      data: updatedLeaveRequest,
    });
  } catch (err) {
    console.error("Leave status update error:", err);
    res.status(err.statusCode || 500).json({
      success: false,
      message: err.message || "Failed to update leave status",
    });
  }
}

app.post("/api/leaves/apply", (req, res) => {
  uploadLeaveAttachment(req, res, async (uploadErr) => {
    if (uploadErr) {
      return res.status(400).json({
        success: false,
        message: uploadErr.message || "Failed to upload leave attachment",
      });
    }

    const userId = Number(req.body.userId);
    const leaveType = normalizeLeaveType(req.body.leaveType);
    const fromDate = String(req.body.fromDate || "").trim();
    const toDate = String(req.body.toDate || "").trim();
    const reason = String(req.body.reason || "").trim();

    if (!userId || !leaveType || !fromDate || !toDate || !reason) {
      return res.status(400).json({
        success: false,
        message: "All leave details are required",
      });
    }

    try {
      await ensureLeaveRequestsTable();
      const user = await getUserRecordById(userId);

      if (!user) {
        return res.status(404).json({
          success: false,
          message: "Employee not found",
        });
      }

      const totalDays = calculateLeaveTotalDays(fromDate, toDate, leaveType);
      if (!Number.isFinite(totalDays) || totalDays <= 0) {
        return res.status(400).json({
          success: false,
          message: "Please select valid leave dates",
        });
      }

      const approvalChain = await resolveLeaveApprovalChain(user);
      const role = normalizeRoleValue(user.role || req.body.role || "employee");
      const leaveAttachmentFile = getFirstUploadedFileFromFields(
        req.files,
        leaveAttachmentFieldNames,
      );
      const attachment = leaveAttachmentFile
        ? await normalizeLeaveAttachment(leaveAttachmentFile)
        : null;

      const [result] = await dbPromise.query(
        `
        INSERT INTO leave_requests (
          user_id,
          employee_name,
          role,
          leave_type,
          from_date,
          to_date,
          total_days,
          reason,
          attachment,
          status,
          approval_route,
          approval_stage,
          leader_user_id,
          leader_name,
          leader_email,
          leader_status,
          leader_remark,
          leader_reviewed_by,
          leader_reviewer_name,
          leader_reviewed_at,
          admin_remark,
          admin_reviewed_by,
          admin_reviewer_name,
          admin_reviewed_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?, ?, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL)
      `,
        [
          user.id,
          user.name || "Employee",
          role,
          leaveType,
          fromDate,
          toDate,
          Number(totalDays.toFixed(2)),
          reason,
          attachment,
          approvalChain.approvalRoute,
          approvalChain.approvalStage,
          approvalChain.leaderUser?.id || null,
          approvalChain.leaderUser?.name || null,
          approvalChain.leaderUser?.email || null,
          approvalChain.leaderStatus,
        ],
      );

      const leaveRequest = await getLeaveRequestById(result.insertId);
      const successMessage = approvalChain.fallbackReason
        ? `Leave request sent to admin because ${approvalChain.fallbackReason}.`
        : approvalChain.approvalRoute === "leader"
          ? `Leave request sent to ${approvalChain.leaderUser?.name || "your group leader"} for approval`
          : "Leave request sent to admin for approval";

      res.json({
        success: true,
        message: successMessage,
        data: leaveRequest,
      });
    } catch (err) {
      console.error("Apply leave error:", err);
      res.status(500).json({
        success: false,
        message: "Failed to submit leave request",
      });
    }
  });
});

app.get("/api/leaves/my/:userId", async (req, res) => {
  const userId = Number(req.params.userId);
  const requestedStatus = normalizeLeaveStatus(req.query.status);

  if (!userId) {
    return res.status(400).json({
      success: false,
      message: "Invalid user",
    });
  }

  try {
    await ensureLeaveRequestsTable();
    const user = await getUserRecordById(userId);

    const whereClauses = ["user_id = ?"];
    const params = [userId];

    if (requestedStatus) {
      whereClauses.push("status = ?");
      params.push(requestedStatus);
    }

    const [rows] = await dbPromise.query(
      `
        SELECT
          id,
          user_id,
          employee_name,
          role,
          leave_type,
          from_date,
          to_date,
          total_days,
          reason,
          attachment,
          status,
          approval_route,
          approval_stage,
          leader_user_id,
          leader_name,
          leader_email,
          leader_status,
          leader_remark,
          leader_reviewed_by,
          leader_reviewer_name,
          leader_reviewed_at,
          admin_remark,
          admin_reviewed_by,
          admin_reviewer_name,
          admin_reviewed_at,
          created_at,
          updated_at
        FROM leave_requests
        WHERE ${whereClauses.join(" AND ")}
        ORDER BY created_at DESC, id DESC
      `,
      params,
    );

    const [[summaryRow]] = await dbPromise.query(
      `
        SELECT
          COUNT(*) AS totalRequests,
          SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pendingRequests,
          SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) AS approvedLeaves,
          SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) AS rejectedLeaves,
          COUNT(DISTINCT CASE
            WHEN status = 'approved' AND CURDATE() BETWEEN from_date AND to_date
            THEN user_id
            ELSE NULL
          END) AS onLeaveToday
        FROM leave_requests
        WHERE user_id = ?
      `,
      [userId],
    );

    const balanceSnapshot = user
      ? await buildLeaveBalanceSnapshot(user)
      : null;

    res.json({
      success: true,
      data: rows.map(serializeLeaveRequestRow),
      summary: summaryRow || {
        totalRequests: 0,
        pendingRequests: 0,
        approvedLeaves: 0,
        rejectedLeaves: 0,
        onLeaveToday: 0,
      },
      balance: serializeLeaveBalanceSnapshot(balanceSnapshot),
    });
  } catch (err) {
    console.error("Get my leaves error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to load leave history",
    });
  }
});

app.get("/api/admin/leaves", async (req, res) => {
  const adminId = Number(req.query.adminId);
  const roleFilter = normalizeRoleValue(req.query.role);
  const statusFilter = normalizeLeaveStatus(req.query.status);
  const selectedDate = String(req.query.date || "").trim();
  const employeeName = String(req.query.employeeName || "").trim().toLowerCase();

  if (!adminId) {
    return res.status(400).json({
      success: false,
      message: "Admin access is required",
    });
  }

  try {
    await ensureAdminAccess(adminId);
    await ensureLeaveRequestsTable();

    const whereClauses = [];
    const params = [];
    addRequestedLeaveCompanyScope(req, whereClauses, "leave_requests");

    if (roleFilter) {
      whereClauses.push("LOWER(TRIM(role)) = ?");
      params.push(roleFilter);
    }

    if (statusFilter) {
      whereClauses.push("status = ?");
      params.push(statusFilter);
    }

    if (selectedDate) {
      whereClauses.push("? BETWEEN from_date AND to_date");
      params.push(selectedDate);
    }

    if (employeeName) {
      whereClauses.push("LOWER(employee_name) LIKE ?");
      params.push(`%${employeeName}%`);
    }

    const whereSql = whereClauses.length ? `WHERE ${whereClauses.join(" AND ")}` : "";
    const summaryWhereClauses = [];
    addRequestedLeaveCompanyScope(req, summaryWhereClauses, "leave_requests");
    const summaryWhereSql = summaryWhereClauses.length
      ? `WHERE ${summaryWhereClauses.join(" AND ")}`
      : "";
    const [rows] = await dbPromise.query(
      `
        SELECT
          id,
          user_id,
          employee_name,
          role,
          leave_type,
          from_date,
          to_date,
          total_days,
          reason,
          attachment,
          status,
          approval_route,
          approval_stage,
          leader_user_id,
          leader_name,
          leader_email,
          leader_status,
          leader_remark,
          leader_reviewed_by,
          leader_reviewer_name,
          leader_reviewed_at,
          admin_remark,
          admin_reviewed_by,
          admin_reviewer_name,
          admin_reviewed_at,
          created_at,
          updated_at
        FROM leave_requests
        ${whereSql}
        ORDER BY
          FIELD(status, 'pending', 'approved', 'rejected'),
          from_date DESC,
          created_at DESC
      `,
      params,
    );

    const [[summaryRow]] = await dbPromise.query(
      `
        SELECT
          COUNT(*) AS totalRequests,
          SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pendingRequests,
          SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) AS approvedLeaves,
          SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) AS rejectedLeaves,
          COUNT(DISTINCT CASE
            WHEN status = 'approved' AND CURDATE() BETWEEN from_date AND to_date
            THEN user_id
            ELSE NULL
          END) AS employeesOnLeaveToday
        FROM leave_requests
        ${summaryWhereSql}
      `,
    );

    const balanceUsers = await getLeaveBalanceUsersForAdmin(getRequestedCompanyScope(req));
    const serializedBalances = await Promise.all(
      balanceUsers.map(async (user) =>
        serializeLeaveBalanceSnapshot(await buildLeaveBalanceSnapshot(user)),
      ),
    );
    const balanceMap = new Map(
      serializedBalances.map((balanceRow) => [Number(balanceRow?.userId || 0), balanceRow]),
    );
    const leaveRows = rows.map((row) => {
      const serializedRow = serializeLeaveRequestRow(row);
      const userBalance = balanceMap.get(Number(row.user_id || 0)) || null;

      return {
        ...serializedRow,
        leave_balance: Number(userBalance?.availableBalance || 0),
        leave_monthly_credit: Number(userBalance?.currentMonthCredit || 0),
      };
    });

    res.json({
      success: true,
      data: leaveRows,
      filteredCount: rows.length,
      summary: summaryRow || {
        totalRequests: 0,
        pendingRequests: 0,
        approvedLeaves: 0,
        rejectedLeaves: 0,
        employeesOnLeaveToday: 0,
      },
      balances: serializedBalances,
    });
  } catch (err) {
    console.error("Get all leaves error:", err);
    res.status(err.statusCode || 500).json({
      success: false,
      message: err.message || "Failed to load leave requests",
    });
  }
});

app.get("/api/hr/leaves", async (req, res) => {
  const requesterId = Number(req.query.userId);
  const roleFilter = normalizeRoleValue(req.query.role);
  const statusFilter = normalizeLeaveStatus(req.query.status);
  const selectedDate = String(req.query.date || "").trim();
  const employeeName = String(req.query.employeeName || "").trim().toLowerCase();

  if (!requesterId) {
    return res.status(400).json({
      success: false,
      message: "HR access is required",
    });
  }

  try {
    await ensureAdminOrHrAccess(requesterId);
    await ensureLeaveRequestsTable();

    const whereClauses = [];
    const params = [];
    addRequestedLeaveCompanyScope(req, whereClauses, "leave_requests");

    if (roleFilter) {
      whereClauses.push("LOWER(TRIM(role)) = ?");
      params.push(roleFilter);
    }

    if (statusFilter) {
      whereClauses.push("status = ?");
      params.push(statusFilter);
    }

    if (selectedDate) {
      whereClauses.push("? BETWEEN from_date AND to_date");
      params.push(selectedDate);
    }

    if (employeeName) {
      whereClauses.push("LOWER(employee_name) LIKE ?");
      params.push(`%${employeeName}%`);
    }

    const whereSql = whereClauses.length ? `WHERE ${whereClauses.join(" AND ")}` : "";
    const summaryWhereClauses = [];
    addRequestedLeaveCompanyScope(req, summaryWhereClauses, "leave_requests");
    const summaryWhereSql = summaryWhereClauses.length
      ? `WHERE ${summaryWhereClauses.join(" AND ")}`
      : "";
    const [rows] = await dbPromise.query(
      `
        SELECT
          id,
          user_id,
          employee_name,
          role,
          leave_type,
          from_date,
          to_date,
          total_days,
          reason,
          attachment,
          status,
          approval_route,
          approval_stage,
          leader_user_id,
          leader_name,
          leader_email,
          leader_status,
          leader_remark,
          leader_reviewed_by,
          leader_reviewer_name,
          leader_reviewed_at,
          admin_remark,
          admin_reviewed_by,
          admin_reviewer_name,
          admin_reviewed_at,
          created_at,
          updated_at
        FROM leave_requests
        ${whereSql}
        ORDER BY
          FIELD(status, 'pending', 'approved', 'rejected'),
          from_date DESC,
          created_at DESC
      `,
      params,
    );

    const [[summaryRow]] = await dbPromise.query(
      `
        SELECT
          COUNT(*) AS totalRequests,
          SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pendingRequests,
          SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) AS approvedLeaves,
          SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) AS rejectedLeaves,
          COUNT(DISTINCT CASE
            WHEN status = 'approved' AND CURDATE() BETWEEN from_date AND to_date
            THEN user_id
            ELSE NULL
          END) AS employeesOnLeaveToday
        FROM leave_requests
        ${summaryWhereSql}
      `,
    );

    const balanceUsers = await getLeaveBalanceUsersForAdmin(getRequestedCompanyScope(req));
    const serializedBalances = await Promise.all(
      balanceUsers.map(async (user) =>
        serializeLeaveBalanceSnapshot(await buildLeaveBalanceSnapshot(user)),
      ),
    );
    const balanceMap = new Map(
      serializedBalances.map((balanceRow) => [Number(balanceRow?.userId || 0), balanceRow]),
    );
    const leaveRows = rows.map((row) => {
      const serializedRow = serializeLeaveRequestRow(row);
      const userBalance = balanceMap.get(Number(row.user_id || 0)) || null;

      return {
        ...serializedRow,
        leave_balance: Number(userBalance?.availableBalance || 0),
        leave_monthly_credit: Number(userBalance?.currentMonthCredit || 0),
      };
    });

    res.json({
      success: true,
      data: leaveRows,
      filteredCount: rows.length,
      summary: summaryRow || {
        totalRequests: 0,
        pendingRequests: 0,
        approvedLeaves: 0,
        rejectedLeaves: 0,
        employeesOnLeaveToday: 0,
      },
      balances: serializedBalances,
    });
  } catch (err) {
    console.error("HR leave fetch error:", err);
    res.status(err.statusCode || 500).json({
      success: false,
      message: err.message || "Failed to load HR leave overview",
    });
  }
});

app.get("/api/leader/leaves", async (req, res) => {
  const leaderId = Number(req.query.leaderId);
  const statusFilter = normalizeLeaveStatus(req.query.status);
  const employeeName = String(req.query.employeeName || "").trim().toLowerCase();

  if (!leaderId) {
    return res.status(400).json({
      success: false,
      message: "Leader access is required",
    });
  }

  try {
    await ensureLeaveLeaderAccess(leaderId);
    await ensureLeaveRequestsTable();

    const whereClauses = ["leader_user_id = ?"];
    const params = [leaderId];

    if (statusFilter) {
      whereClauses.push("status = ?");
      params.push(statusFilter);
    }

    if (employeeName) {
      whereClauses.push("LOWER(employee_name) LIKE ?");
      params.push(`%${employeeName}%`);
    }

    const [rows] = await dbPromise.query(
      `
        SELECT
          id,
          user_id,
          employee_name,
          role,
          leave_type,
          from_date,
          to_date,
          total_days,
          reason,
          attachment,
          status,
          approval_route,
          approval_stage,
          leader_user_id,
          leader_name,
          leader_email,
          leader_status,
          leader_remark,
          leader_reviewed_by,
          leader_reviewer_name,
          leader_reviewed_at,
          admin_remark,
          admin_reviewed_by,
          admin_reviewer_name,
          admin_reviewed_at,
          created_at,
          updated_at
        FROM leave_requests
        WHERE ${whereClauses.join(" AND ")}
        ORDER BY
          FIELD(status, 'pending', 'approved', 'rejected'),
          from_date DESC,
          created_at DESC
      `,
      params,
    );

    const [[summaryRow]] = await dbPromise.query(
      `
        SELECT
          COUNT(*) AS totalRequests,
          SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pendingRequests,
          SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) AS approvedLeaves,
          SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) AS rejectedLeaves
        FROM leave_requests
        WHERE leader_user_id = ?
      `,
      [leaderId],
    );

    res.json({
      success: true,
      data: rows.map(serializeLeaveRequestRow),
      summary: summaryRow || {
        totalRequests: 0,
        pendingRequests: 0,
        approvedLeaves: 0,
        rejectedLeaves: 0,
      },
    });
  } catch (err) {
    console.error("Leader leave fetch error:", err);
    res.status(err.statusCode || 500).json({
      success: false,
      message: err.message || "Failed to load leader leave queue",
    });
  }
});

app.put("/api/leader/leaves/:id/status", async (req, res) => {
  const leaveId = Number(req.params.id);
  const leaderId = Number(req.body.leaderId || req.query.leaderId);
  const requestedStatus = normalizeLeaveStatus(req.body.status);
  const leaderRemark = String(req.body.leaderRemark || "").trim();

  if (!leaveId || !leaderId || !["approved", "rejected"].includes(requestedStatus)) {
    return res.status(400).json({
      success: false,
      message: "Invalid leader leave decision",
    });
  }

  if (requestedStatus === "rejected" && !leaderRemark) {
    return res.status(400).json({
      success: false,
      message: "Rejection reason is required",
    });
  }

  try {
    const leaderUser = await ensureLeaveLeaderAccess(leaderId);
    const leaveRequest = await getLeaveRequestById(leaveId);

    if (!leaveRequest) {
      return res.status(404).json({
        success: false,
        message: "Leave request not found",
      });
    }

    if (normalizeLeaveApprovalRoute(leaveRequest.approval_route) !== "leader") {
      return res.status(400).json({
        success: false,
        message: "This leave request goes directly to admin",
      });
    }

    if (Number(leaveRequest.leader_user_id || 0) !== leaderUser.id) {
      return res.status(403).json({
        success: false,
        message: "You are not allowed to review this leave request",
      });
    }

    if (
      normalizeLeaveStatus(leaveRequest.status) !== "pending" ||
      normalizeLeaderDecisionStatus(leaveRequest.leader_status) !== "pending"
    ) {
      return res.status(400).json({
        success: false,
        message: "This leave request has already been reviewed",
      });
    }

    await dbPromise.query(
      `
        UPDATE leave_requests
        SET
          status = ?,
          leader_status = ?,
          leader_remark = ?,
          leader_reviewed_by = ?,
          leader_reviewer_name = ?,
          leader_reviewed_at = NOW(),
          approval_stage = 'completed',
          updated_at = NOW()
        WHERE id = ?
      `,
      [
        requestedStatus,
        requestedStatus,
        leaderRemark || null,
        leaderUser.id,
        leaderUser.name || "Leader",
        leaveId,
      ],
    );

    const updatedLeaveRequest = await getLeaveRequestById(leaveId);

    res.json({
      success: true,
      message: requestedStatus === "approved"
        ? "Leave approved by leader successfully"
        : "Leave rejected by leader successfully",
      data: updatedLeaveRequest,
    });
  } catch (err) {
    console.error("Leader leave decision error:", err);
    res.status(err.statusCode || 500).json({
      success: false,
      message: err.message || "Failed to update leader leave decision",
    });
  }
});

app.put("/api/admin/leaves/:id/status", async (req, res) => {
  handleLeaveStatusUpdate(req, res);
});

app.put("/api/admin/leaves/:id/approve", async (req, res) => {
  handleLeaveStatusUpdate(req, res, "approved");
});

app.put("/api/admin/leaves/:id/reject", async (req, res) => {
  handleLeaveStatusUpdate(req, res, "rejected");
});

app.delete("/api/leaves/:id", async (req, res) => {
  const leaveId = Number(req.params.id);
  const requesterId = Number(req.body.userId || req.query.userId);

  if (!leaveId || !requesterId) {
    return res.status(400).json({
      success: false,
      message: "Invalid leave delete request",
    });
  }

  try {
    await ensureLeaveRequestsTable();
    const leaveRequest = await getLeaveRequestById(leaveId);
    if (!leaveRequest) {
      return res.status(404).json({
        success: false,
        message: "Leave request not found",
      });
    }

    const requester = await getUserRecordById(requesterId);
    if (!requester) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const isAdmin = normalizeRoleValue(requester.role) === "admin";
    const isOwner = Number(leaveRequest.user_id) === requester.id;

    if (!isAdmin && (!isOwner || normalizeLeaveStatus(leaveRequest.status) !== "pending")) {
      return res.status(403).json({
        success: false,
        message: "Only pending self leave requests can be deleted",
      });
    }

    await dbPromise.query("DELETE FROM leave_requests WHERE id = ?", [leaveId]);
    await removeLeaveAttachment(leaveRequest.attachment);

    res.json({
      success: true,
      message: "Leave request deleted successfully",
    });
  } catch (err) {
    console.error("Delete leave request error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to delete leave request",
    });
  }
});

const PAYROLL_SUPPORTED_ROLES = new Set([
  "admin",
  "hr",
  "tme",
  "me",
  "dev",
  "seo",
  "smo",
  "accounts",
  "dm",
]);

function isSupportedPayrollRole(role) {
  return PAYROLL_SUPPORTED_ROLES.has(normalizeRoleValue(role));
}

function getCurrentPayrollMonthKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function normalizePayrollMonthKey(value) {
  const normalizedValue = String(value || "").trim();
  return /^\d{4}-\d{2}$/.test(normalizedValue)
    ? normalizedValue
    : getCurrentPayrollMonthKey();
}

function formatPayrollDateOnly(date) {
  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, "0"),
    String(date.getUTCDate()).padStart(2, "0"),
  ].join("-");
}

function getPayrollMonthRange(monthKey) {
  const normalizedMonth = normalizePayrollMonthKey(monthKey);
  const [year, month] = normalizedMonth.split("-").map(Number);
  const startDate = new Date(Date.UTC(year, month - 1, 1));
  const endDate = new Date(Date.UTC(year, month, 0));
  const totalDays = endDate.getUTCDate();

  return {
    monthKey: normalizedMonth,
    startDate: formatPayrollDateOnly(startDate),
    endDate: formatPayrollDateOnly(endDate),
    totalDays,
  };
}

function countPayrollDaysInclusive(startDate, endDate) {
  const start = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);
  return Math.max(0, Math.round((end - start) / 86400000) + 1);
}

function getPayrollDateKeysInRange(startDate, endDate) {
  const keys = [];
  const cursor = new Date(`${startDate}T00:00:00Z`);
  const last = new Date(`${endDate}T00:00:00Z`);

  while (cursor <= last) {
    keys.push(formatPayrollDateOnly(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return keys;
}

function getPayrollOverlapDateKeys(fromDate, toDate, rangeStart, rangeEnd) {
  const overlapStart = fromDate > rangeStart ? fromDate : rangeStart;
  const overlapEnd = toDate < rangeEnd ? toDate : rangeEnd;

  if (overlapStart > overlapEnd) {
    return [];
  }

  return getPayrollDateKeysInRange(overlapStart, overlapEnd);
}

function normalizePayrollAmount(value, fallback = 0) {
  if (value === "" || value == null) return Number(fallback || 0);
  const numericValue = Number(String(value).replace(/,/g, "").trim());
  return Number.isFinite(numericValue) ? numericValue : Number(fallback || 0);
}

function normalizePayrollBoolean(value) {
  if (typeof value === "boolean") return value;
  const normalized = String(value || "")
    .toLowerCase()
    .trim();
  return ["1", "true", "yes", "on"].includes(normalized);
}

function derivePayrollDepartment(user) {
  const department = String(user?.department || "").trim();
  if (department) return department;

  const role = normalizeRoleValue(user?.role);
  return role ? role.toUpperCase() : "General";
}

function getPayrollRoleLabel(role) {
  const normalizedRole = normalizeRoleValue(role);
  if (!normalizedRole) return "Employee";
  return normalizedRole.toUpperCase();
}

function formatPayrollCurrency(amount) {
  return Number(amount || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatPayrollDateForDisplay(value) {
  if (!value) return "-";
  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) return String(value);
  return parsedDate.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

let payrollSchemaReady = false;

async function ensurePayrollTables() {
  if (payrollSchemaReady) return;

  await ensurePayrollUserColumns();
  await ensureAttendanceTable();
  await ensureLeaveRequestsTable();
  await runSchemaChange(
    "ALTER TABLE leave_requests ADD COLUMN is_paid tinyint(1) DEFAULT NULL AFTER total_days",
    "ER_DUP_FIELDNAME",
  );

  const payrollTableSql = `
    CREATE TABLE IF NOT EXISTS payrolls (
      id int NOT NULL AUTO_INCREMENT,
      employee_id int NOT NULL,
      month_key char(7) NOT NULL,
      month_start date NOT NULL,
      month_end date NOT NULL,
      employee_name_snapshot varchar(255) NOT NULL,
      role_snapshot varchar(50) NOT NULL,
      department_snapshot varchar(100) DEFAULT NULL,
      joining_date_snapshot date DEFAULT NULL,
      working_days int NOT NULL DEFAULT 0,
      basic_salary decimal(12,2) NOT NULL DEFAULT 0,
      daily_salary decimal(12,2) NOT NULL DEFAULT 0,
      paid_leave_days decimal(6,2) NOT NULL DEFAULT 0,
      unpaid_leave_days decimal(6,2) NOT NULL DEFAULT 0,
      half_days decimal(6,2) NOT NULL DEFAULT 0,
      leave_deduction decimal(12,2) NOT NULL DEFAULT 0,
      bonus_amount decimal(12,2) NOT NULL DEFAULT 0,
      incentive_amount decimal(12,2) NOT NULL DEFAULT 0,
      penalty_amount decimal(12,2) NOT NULL DEFAULT 0,
      final_salary decimal(12,2) NOT NULL DEFAULT 0,
      notes text DEFAULT NULL,
      status varchar(30) NOT NULL DEFAULT 'generated',
      generated_by int DEFAULT NULL,
      approved_by int DEFAULT NULL,
      generated_at datetime DEFAULT CURRENT_TIMESTAMP,
      approved_at datetime DEFAULT CURRENT_TIMESTAMP,
      created_at datetime DEFAULT CURRENT_TIMESTAMP,
      updated_at datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY payroll_employee_month_unique (employee_id, month_key),
      KEY payroll_month_idx (month_key),
      KEY payroll_status_idx (status),
      CONSTRAINT payroll_employee_fk
        FOREIGN KEY (employee_id) REFERENCES users (id)
        ON DELETE CASCADE,
      CONSTRAINT payroll_generated_by_fk
        FOREIGN KEY (generated_by) REFERENCES users (id)
        ON DELETE SET NULL,
      CONSTRAINT payroll_approved_by_fk
        FOREIGN KEY (approved_by) REFERENCES users (id)
        ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
  `;

  const salaryHistorySql = `
    CREATE TABLE IF NOT EXISTS salary_history (
      id int NOT NULL AUTO_INCREMENT,
      user_id int NOT NULL,
      previous_salary decimal(12,2) NOT NULL DEFAULT 0,
      new_salary decimal(12,2) NOT NULL DEFAULT 0,
      previous_department varchar(100) DEFAULT NULL,
      new_department varchar(100) DEFAULT NULL,
      previous_joining_date date DEFAULT NULL,
      new_joining_date date DEFAULT NULL,
      previous_is_team_lead tinyint(1) NOT NULL DEFAULT 0,
      new_is_team_lead tinyint(1) NOT NULL DEFAULT 0,
      changed_by int DEFAULT NULL,
      note text DEFAULT NULL,
      changed_at datetime DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY salary_history_user_idx (user_id),
      KEY salary_history_changed_by_idx (changed_by),
      CONSTRAINT salary_history_user_fk
        FOREIGN KEY (user_id) REFERENCES users (id)
        ON DELETE CASCADE,
      CONSTRAINT salary_history_changed_by_fk
        FOREIGN KEY (changed_by) REFERENCES users (id)
        ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
  `;

  const deductionsSql = `
    CREATE TABLE IF NOT EXISTS payroll_deductions (
      id int NOT NULL AUTO_INCREMENT,
      payroll_id int NOT NULL,
      deduction_type varchar(50) NOT NULL,
      label varchar(255) NOT NULL,
      units decimal(8,2) DEFAULT NULL,
      amount decimal(12,2) NOT NULL DEFAULT 0,
      notes text DEFAULT NULL,
      created_at datetime DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY payroll_deductions_payroll_idx (payroll_id),
      CONSTRAINT payroll_deductions_payroll_fk
        FOREIGN KEY (payroll_id) REFERENCES payrolls (id)
        ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
  `;

  const bonusesSql = `
    CREATE TABLE IF NOT EXISTS payroll_bonuses (
      id int NOT NULL AUTO_INCREMENT,
      payroll_id int NOT NULL,
      label varchar(255) NOT NULL,
      amount decimal(12,2) NOT NULL DEFAULT 0,
      notes text DEFAULT NULL,
      created_at datetime DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY payroll_bonuses_payroll_idx (payroll_id),
      CONSTRAINT payroll_bonuses_payroll_fk
        FOREIGN KEY (payroll_id) REFERENCES payrolls (id)
        ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
  `;

  const incentivesSql = `
    CREATE TABLE IF NOT EXISTS payroll_incentives (
      id int NOT NULL AUTO_INCREMENT,
      payroll_id int NOT NULL,
      label varchar(255) NOT NULL,
      amount decimal(12,2) NOT NULL DEFAULT 0,
      notes text DEFAULT NULL,
      created_at datetime DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY payroll_incentives_payroll_idx (payroll_id),
      CONSTRAINT payroll_incentives_payroll_fk
        FOREIGN KEY (payroll_id) REFERENCES payrolls (id)
        ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
  `;

  const auditSql = `
    CREATE TABLE IF NOT EXISTS payroll_audit_logs (
      id int NOT NULL AUTO_INCREMENT,
      payroll_id int DEFAULT NULL,
      actor_id int DEFAULT NULL,
      target_user_id int DEFAULT NULL,
      action_type varchar(80) NOT NULL,
      payload_json longtext DEFAULT NULL,
      created_at datetime DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY payroll_audit_payroll_idx (payroll_id),
      KEY payroll_audit_actor_idx (actor_id),
      KEY payroll_audit_target_idx (target_user_id),
      CONSTRAINT payroll_audit_payroll_fk
        FOREIGN KEY (payroll_id) REFERENCES payrolls (id)
        ON DELETE SET NULL,
      CONSTRAINT payroll_audit_actor_fk
        FOREIGN KEY (actor_id) REFERENCES users (id)
        ON DELETE SET NULL,
      CONSTRAINT payroll_audit_target_fk
        FOREIGN KEY (target_user_id) REFERENCES users (id)
        ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
  `;

  await dbPromise.query(payrollTableSql);
  await dbPromise.query(salaryHistorySql);
  await dbPromise.query(deductionsSql);
  await dbPromise.query(bonusesSql);
  await dbPromise.query(incentivesSql);
  await dbPromise.query(auditSql);

  payrollSchemaReady = true;
}

ensurePayrollTables().catch((err) => {
  console.error("Payroll schema setup failed:", err);
});

async function logPayrollAudit({
  payrollId = null,
  actorId = null,
  targetUserId = null,
  actionType,
  payload = null,
}) {
  if (!actionType) return;

  await ensurePayrollTables();
  await dbPromise.query(
    `
      INSERT INTO payroll_audit_logs (
        payroll_id,
        actor_id,
        target_user_id,
        action_type,
        payload_json
      )
      VALUES (?, ?, ?, ?, ?)
    `,
    [
      payrollId || null,
      actorId || null,
      targetUserId || null,
      actionType,
      payload ? JSON.stringify(payload) : null,
    ],
  );
}

async function getPayrollEmployeeProfile(userId) {
  const normalizedUserId = Number(userId);
  if (!Number.isFinite(normalizedUserId) || normalizedUserId <= 0) return null;

  await ensurePayrollTables();
  const [rows] = await dbPromise.query(
    `
      SELECT
        id,
        name,
        email,
        contact,
        role,
        department,
        salary,
        compensation_type,
        commission_percent,
        joining_date,
        is_team_lead
      FROM users
      WHERE id = ?
      LIMIT 1
    `,
    [normalizedUserId],
  );

  if (!rows.length) return null;

  const employee = rows[0];
  const compensationType = normalizeCompensationType(employee.compensation_type);
  return {
    ...employee,
    department: derivePayrollDepartment(employee),
    salary: normalizePayrollAmount(employee.salary),
    compensation_type: compensationType,
    commission_percent: getFixedSalesCommissionPercent(compensationType),
    is_team_lead: Number(employee.is_team_lead || 0),
  };
}

async function ensurePayrollViewerAccess(requesterId, employeeId) {
  const requester = await getPayrollEmployeeProfile(requesterId);
  if (!requester) {
    const error = new Error("User not found");
    error.statusCode = 404;
    throw error;
  }

  const employee = await getPayrollEmployeeProfile(employeeId);
  if (!employee) {
    const error = new Error("Employee not found");
    error.statusCode = 404;
    throw error;
  }

  const requesterRole = normalizeRoleValue(requester.role);
  const isAdmin = requesterRole === "admin";
  const isSelf = Number(requester.id) === Number(employee.id);

  if (!isAdmin && !isSelf) {
    const error = new Error("You can only access your own salary records");
    error.statusCode = 403;
    throw error;
  }

  return { requester, employee };
}

async function getPayrollUsers(filters = {}) {
  await ensurePayrollTables();

  const roleFilter = normalizeRoleValue(filters.roleFilter);
  const departmentFilter = String(filters.departmentFilter || "").trim().toLowerCase();
  const searchTerm = String(filters.searchTerm || "").trim().toLowerCase();
  const companyScope = normalizeLoginCompanyKey(filters.companyScope);

  const whereClauses = [
    `LOWER(TRIM(COALESCE(role, ''))) IN (${Array.from(PAYROLL_SUPPORTED_ROLES)
      .map(() => "?")
      .join(", ")})`,
  ];
  const params = Array.from(PAYROLL_SUPPORTED_ROLES);

  const userScopeSql = getCompanyUserScopeSql(companyScope, "users");
  if (userScopeSql) {
    whereClauses.push(userScopeSql);
  }

  if (roleFilter && PAYROLL_SUPPORTED_ROLES.has(roleFilter)) {
    whereClauses.push("LOWER(TRIM(COALESCE(role, ''))) = ?");
    params.push(roleFilter);
  }

  if (departmentFilter) {
    whereClauses.push(
      "LOWER(TRIM(COALESCE(NULLIF(department, ''), role, ''))) LIKE ?",
    );
    params.push(`%${departmentFilter}%`);
  }

  if (searchTerm) {
    whereClauses.push(
      "(LOWER(COALESCE(name, '')) LIKE ? OR LOWER(COALESCE(email, '')) LIKE ? OR COALESCE(contact, '') LIKE ?)",
    );
    params.push(`%${searchTerm}%`, `%${searchTerm}%`, `%${searchTerm}%`);
  }

  const [rows] = await dbPromise.query(
    `
      SELECT
        id,
        name,
        email,
        contact,
        role,
        department,
        salary,
        compensation_type,
        commission_percent,
        joining_date,
        is_team_lead
      FROM users
      WHERE ${whereClauses.join(" AND ")}
      ORDER BY
        FIELD(LOWER(TRIM(COALESCE(role, ''))), 'admin', 'hr', 'tme', 'me', 'dev', 'seo', 'smo', 'accounts', 'dm'),
        name ASC,
        id ASC
    `,
    params,
  );

  return rows.map((row) => {
    const compensationType = normalizeCompensationType(row.compensation_type);
    return {
      ...row,
      department: derivePayrollDepartment(row),
      salary: normalizePayrollAmount(row.salary),
      compensation_type: compensationType,
      commission_percent: getFixedSalesCommissionPercent(compensationType),
      is_team_lead: Number(row.is_team_lead || 0),
    };
  });
}

function normalizeStoredPayrollRow(row) {
  if (!row) return null;

  return {
    payrollId: Number(row.id || 0),
    employeeId: Number(row.employee_id || 0),
    monthKey: row.month_key,
    workingDays: Number(row.working_days || 0),
    basicSalary: normalizePayrollAmount(row.basic_salary),
    dailySalary: normalizePayrollAmount(row.daily_salary),
    paidLeaveDays: Number(row.paid_leave_days || 0),
    unpaidLeaveDays: Number(row.unpaid_leave_days || 0),
    halfDays: Number(row.half_days || 0),
    leaveDeduction: normalizePayrollAmount(row.leave_deduction),
    bonusAmount: normalizePayrollAmount(row.bonus_amount),
    incentiveAmount: normalizePayrollAmount(row.incentive_amount),
    penaltyAmount: normalizePayrollAmount(row.penalty_amount),
    finalSalary: normalizePayrollAmount(row.final_salary),
    status: row.status || "generated",
    notes: row.notes || "",
    generatedAt: row.generated_at || null,
    approvedAt: row.approved_at || null,
  };
}

async function getStoredPayrollRowsByMonth(monthKey, employeeIds = []) {
  await ensurePayrollTables();

  const normalizedMonth = normalizePayrollMonthKey(monthKey);
  const normalizedIds = (Array.isArray(employeeIds) ? employeeIds : [employeeIds])
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value) && value > 0);

  if (!normalizedIds.length) {
    return new Map();
  }

  const [rows] = await dbPromise.query(
    `
      SELECT *
      FROM payrolls
      WHERE month_key = ?
        AND employee_id IN (?)
    `,
    [normalizedMonth, normalizedIds],
  );

  return new Map(
    rows.map((row) => [Number(row.employee_id), normalizeStoredPayrollRow(row)]),
  );
}

async function getStoredPayrollDetailRows(payrollId) {
  const normalizedPayrollId = Number(payrollId);
  if (!normalizedPayrollId) {
    return { deductions: [], bonuses: [], incentives: [] };
  }

  await ensurePayrollTables();
  const [deductions, bonuses, incentives] = await Promise.all([
    dbPromise.query(
      `
        SELECT deduction_type, label, units, amount, notes
        FROM payroll_deductions
        WHERE payroll_id = ?
        ORDER BY id ASC
      `,
      [normalizedPayrollId],
    ),
    dbPromise.query(
      `
        SELECT label, amount, notes
        FROM payroll_bonuses
        WHERE payroll_id = ?
        ORDER BY id ASC
      `,
      [normalizedPayrollId],
    ),
    dbPromise.query(
      `
        SELECT label, amount, notes
        FROM payroll_incentives
        WHERE payroll_id = ?
        ORDER BY id ASC
      `,
      [normalizedPayrollId],
    ),
  ]);

  return {
    deductions: deductions[0].map((row) => ({
      ...row,
      units: row.units == null ? null : Number(row.units),
      amount: normalizePayrollAmount(row.amount),
    })),
    bonuses: bonuses[0].map((row) => ({
      ...row,
      amount: normalizePayrollAmount(row.amount),
    })),
    incentives: incentives[0].map((row) => ({
      ...row,
      amount: normalizePayrollAmount(row.amount),
    })),
  };
}

function shouldAutoSyncPayrollMonth(monthKey) {
  return normalizePayrollMonthKey(monthKey) === getCurrentPayrollMonthKey();
}

async function upsertPayrollForEmployee({
  employeeId,
  monthKey,
  actorId = null,
  overrides = {},
  touchApprovalTimestamps = true,
  auditActionType = "",
}) {
  const normalizedEmployeeId = Number(employeeId);
  if (!Number.isFinite(normalizedEmployeeId) || normalizedEmployeeId <= 0) {
    return null;
  }

  await ensurePayrollTables();

  const employee = await getPayrollEmployeeProfile(normalizedEmployeeId);
  if (!employee || !isSupportedPayrollRole(employee.role)) {
    return null;
  }

  const normalizedMonthKey = normalizePayrollMonthKey(monthKey);
  const actorValue =
    Number.isFinite(Number(actorId)) && Number(actorId) > 0 ? Number(actorId) : null;
  const storedRowsMap = await getStoredPayrollRowsByMonth(normalizedMonthKey, [
    normalizedEmployeeId,
  ]);
  const storedPayroll = storedRowsMap.get(normalizedEmployeeId) || null;
  const preview = await buildPayrollPreview(employee, normalizedMonthKey, {
    storedPayroll,
    preferStoredSnapshot: false,
    ...overrides,
  });

  const duplicateTimestampSql = touchApprovalTimestamps
    ? `
        generated_by = VALUES(generated_by),
        approved_by = VALUES(approved_by),
        generated_at = NOW(),
        approved_at = NOW()
      `
    : `
        generated_by = COALESCE(generated_by, VALUES(generated_by)),
        approved_by = COALESCE(approved_by, VALUES(approved_by)),
        generated_at = generated_at,
        approved_at = approved_at
      `;

  const [upsertResult] = await dbPromise.query(
    `
      INSERT INTO payrolls (
        employee_id,
        month_key,
        month_start,
        month_end,
        employee_name_snapshot,
        role_snapshot,
        department_snapshot,
        joining_date_snapshot,
        working_days,
        basic_salary,
        daily_salary,
        paid_leave_days,
        unpaid_leave_days,
        half_days,
        leave_deduction,
        bonus_amount,
        incentive_amount,
        penalty_amount,
        final_salary,
        notes,
        status,
        generated_by,
        approved_by,
        generated_at,
        approved_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'generated', ?, ?, NOW(), NOW())
      ON DUPLICATE KEY UPDATE
        id = LAST_INSERT_ID(id),
        month_start = VALUES(month_start),
        month_end = VALUES(month_end),
        employee_name_snapshot = VALUES(employee_name_snapshot),
        role_snapshot = VALUES(role_snapshot),
        department_snapshot = VALUES(department_snapshot),
        joining_date_snapshot = VALUES(joining_date_snapshot),
        working_days = VALUES(working_days),
        basic_salary = VALUES(basic_salary),
        daily_salary = VALUES(daily_salary),
        paid_leave_days = VALUES(paid_leave_days),
        unpaid_leave_days = VALUES(unpaid_leave_days),
        half_days = VALUES(half_days),
        leave_deduction = VALUES(leave_deduction),
        bonus_amount = VALUES(bonus_amount),
        incentive_amount = VALUES(incentive_amount),
        penalty_amount = VALUES(penalty_amount),
        final_salary = VALUES(final_salary),
        notes = VALUES(notes),
        status = 'generated',
        ${duplicateTimestampSql}
    `,
    [
      normalizedEmployeeId,
      preview.monthKey,
      preview.monthStart,
      preview.monthEnd,
      preview.name,
      preview.role,
      preview.department,
      preview.joiningDate,
      preview.workingDays,
      preview.basicSalary,
      preview.dailySalary,
      preview.paidLeaveDays,
      preview.unpaidLeaveDays,
      preview.halfDays,
      preview.leaveDeduction,
      preview.bonusAmount,
      preview.incentiveAmount,
      preview.penaltyAmount,
      preview.finalSalary,
      preview.notes || null,
      actorValue,
      actorValue,
    ],
  );

  const payrollId = Number(upsertResult.insertId || 0);
  await replacePayrollLineItems(payrollId, preview);

  if (auditActionType) {
    await logPayrollAudit({
      payrollId,
      actorId: actorValue,
      targetUserId: normalizedEmployeeId,
      actionType: auditActionType,
      payload: {
        monthKey: preview.monthKey,
        finalSalary: preview.finalSalary,
        leaveDeduction: preview.leaveDeduction,
        bonusAmount: preview.bonusAmount,
        incentiveAmount: preview.incentiveAmount,
        penaltyAmount: preview.penaltyAmount,
      },
    });
  }

  return {
    ...preview,
    payrollId,
    isGenerated: true,
    payrollStatus: "generated",
  };
}

async function autoSyncCurrentPayrollForUser(employeeId, actorId = null) {
  return upsertPayrollForEmployee({
    employeeId,
    monthKey: getCurrentPayrollMonthKey(),
    actorId,
    touchApprovalTimestamps: false,
  });
}

async function tryAutoSyncCurrentPayrollForUser(employeeId, actorId = null, label = "Payroll auto-sync") {
  try {
    await autoSyncCurrentPayrollForUser(employeeId, actorId);
  } catch (err) {
    console.error(`${label} failed:`, err);
  }
}

async function getApprovedLeaveRowsForPayroll(userId, startDate, endDate) {
  void startDate;
  await ensurePayrollTables();
  return getApprovedLeaveRowsUpToDate(userId, endDate);
}

async function getAttendanceHalfDayDateSetForPayroll(userId, startDate, endDate) {
  const normalizedUserId = Number(userId);
  if (!normalizedUserId) return new Set();

  await ensurePayrollTables();
  const attendanceStatusSql = getAttendanceStatusSql("a", "u");
  const [rows] = await dbPromise.query(
    `
      SELECT DATE_FORMAT(a.attendance_date, '%Y-%m-%d') AS attendance_date
      FROM attendance a
      INNER JOIN users u ON u.id = a.user_id
      WHERE a.user_id = ?
        AND a.attendance_date BETWEEN ? AND ?
        AND ${attendanceStatusSql} = 'half_day'
      GROUP BY a.attendance_date
      ORDER BY a.attendance_date ASC
    `,
    [normalizedUserId, startDate, endDate],
  );

  return new Set(rows.map((row) => row.attendance_date));
}

function inferPayrollLeavePaidStatus(leaveRow) {
  if (leaveRow?.is_paid === 0 || leaveRow?.is_paid === "0") return false;
  if (leaveRow?.is_paid === 1 || leaveRow?.is_paid === "1") return true;

  const leaveType = normalizeLeaveKey(leaveRow?.leave_type);
  if (leaveType === "half_day" || leaveType.includes("unpaid")) {
    return false;
  }

  return true;
}

async function buildPayrollPreview(user, monthKey, options = {}) {
  const monthRange = getPayrollMonthRange(monthKey);
  const role = normalizeRoleValue(user?.role);
  const requestedCompensationType =
    options.compensationType !== undefined
      ? normalizeCompensationType(options.compensationType)
      : normalizeCompensationType(user?.compensation_type);
  const compensationType = SALES_COMMISSION_ROLES.has(role)
    ? requestedCompensationType
    : "salary";
  const commissionPercent = getFixedSalesCommissionPercent(compensationType);
  const configuredSalary =
    compensationType === "commission"
      ? 0
      : options.salary !== undefined
      ? normalizePayrollAmount(options.salary)
      : normalizePayrollAmount(user?.salary);
  const storedPayroll = options.storedPayroll || null;
  const shouldUseStoredSnapshot =
    Boolean(storedPayroll) &&
    options.preferStoredSnapshot !== false &&
    options.salary === undefined &&
    options.compensationType === undefined &&
    options.commissionPercent === undefined &&
    options.bonusAmount === undefined &&
    options.incentiveAmount === undefined &&
    options.penaltyAmount === undefined &&
    options.notes === undefined;
  const basicSalary = shouldUseStoredSnapshot
    ? normalizePayrollAmount(storedPayroll.basicSalary)
    : configuredSalary;
  const workingDays = shouldUseStoredSnapshot
    ? Number(storedPayroll.workingDays || 0)
    : monthRange.totalDays;
  const dailySalary = shouldUseStoredSnapshot
    ? normalizePayrollAmount(storedPayroll.dailySalary)
    : workingDays > 0
      ? Number((basicSalary / workingDays).toFixed(2))
      : 0;
  const department =
    options.department !== undefined
      ? String(options.department || "").trim() || derivePayrollDepartment(user)
      : derivePayrollDepartment(user);
  const joiningDate =
    options.joiningDate !== undefined
      ? String(options.joiningDate || "").trim() || null
      : user?.joining_date || null;
  const isTeamLead =
    options.isTeamLead !== undefined
      ? Number(normalizePayrollBoolean(options.isTeamLead))
      : Number(user?.is_team_lead || 0);
  const bonusAmount =
    options.bonusAmount !== undefined
      ? normalizePayrollAmount(options.bonusAmount)
      : normalizePayrollAmount(storedPayroll?.bonusAmount);
  const penaltyAmount =
    options.penaltyAmount !== undefined
      ? normalizePayrollAmount(options.penaltyAmount)
      : normalizePayrollAmount(storedPayroll?.penaltyAmount);
  const notes =
    options.notes !== undefined
      ? String(options.notes || "").trim()
      : String(storedPayroll?.notes || "").trim();
  const liveSalesCommission = await getSalesCommissionForPayroll({
    user: {
      ...user,
      compensation_type: compensationType,
      commission_percent: commissionPercent,
    },
    monthKey: monthRange.monthKey,
  });
  const salesCommission = shouldUseStoredSnapshot
    ? {
        ...liveSalesCommission,
        applies: compensationType === "commission",
        amount: compensationType === "commission"
          ? normalizePayrollAmount(storedPayroll?.incentiveAmount)
          : 0,
      }
    : liveSalesCommission;
  const autoTargetIncentive =
    compensationType === "salary" && AUTO_TARGET_INCENTIVE_ROLES.has(role)
      ? await getAutoTargetIncentiveForPayroll({
          user: {
            ...user,
            salary: configuredSalary,
            compensation_type: compensationType,
          },
          monthKey: monthRange.monthKey,
          basicSalary,
        })
      : null;
  const incentiveAmount = shouldUseStoredSnapshot
    ? normalizePayrollAmount(storedPayroll?.incentiveAmount)
    : salesCommission.applies
      ? salesCommission.amount
      : autoTargetIncentive
      ? autoTargetIncentive.amount
      : options.incentiveAmount !== undefined
        ? normalizePayrollAmount(options.incentiveAmount)
        : normalizePayrollAmount(storedPayroll?.incentiveAmount);

  if (shouldUseStoredSnapshot) {
    return {
      employeeId: Number(user.id),
      name: user.name || "Employee",
      email: user.email || "",
      contact: user.contact || "",
      role: normalizeRoleValue(user.role),
      roleLabel: getPayrollRoleLabel(user.role),
      department,
      compensationType,
      commissionPercent,
      commissionSalesAmount: salesCommission.salesAmount,
      commissionDealsCount: salesCommission.dealsCount,
      commissionAmount: salesCommission.amount,
      target: autoTargetIncentive?.target || 0,
      targetAchieved: autoTargetIncentive?.achieved || 0,
      targetRemaining: autoTargetIncentive?.remaining || 0,
      targetIncentiveRate: autoTargetIncentive?.rate || AUTO_TARGET_INCENTIVE_RATE,
      targetIncentiveAmount: autoTargetIncentive?.amount || 0,
      targetIncentiveApplies: Boolean(autoTargetIncentive?.applies),
      targetSource: autoTargetIncentive?.source || "",
      targetBasis: autoTargetIncentive?.basis || null,
      salary: configuredSalary,
      joiningDate,
      isTeamLead,
      monthKey: monthRange.monthKey,
      monthStart: monthRange.startDate,
      monthEnd: monthRange.endDate,
      workingDays,
      dailySalary,
      basicSalary,
      paidLeaveDays: Number(storedPayroll.paidLeaveDays || 0),
      unpaidLeaveDays: Number(storedPayroll.unpaidLeaveDays || 0),
      halfDays: Number(storedPayroll.halfDays || 0),
      leaveHalfDays: Number(storedPayroll.halfDays || 0),
      paidHalfDays: 0,
      attendanceHalfDays: 0,
      approvedLeaveEntries: 0,
      leaveDeduction: normalizePayrollAmount(storedPayroll.leaveDeduction),
      bonusAmount,
      incentiveAmount,
      penaltyAmount,
      finalSalary: normalizePayrollAmount(storedPayroll.finalSalary),
      notes,
      payrollId: storedPayroll.payrollId || null,
      payrollStatus: storedPayroll.status || "generated",
      generatedAt: storedPayroll.generatedAt || null,
      approvedAt: storedPayroll.approvedAt || null,
      isGenerated: Boolean(storedPayroll.payrollId),
    };
  }

  const [leaveBalanceSnapshot, attendanceHalfDayDates] = await Promise.all([
    buildLeaveBalanceSnapshot(user, { referenceDate: monthRange.endDate }),
    getAttendanceHalfDayDateSetForPayroll(user.id, monthRange.startDate, monthRange.endDate),
  ]);

  const paidFullDayDates = new Set();
  const unpaidFullDayDates = new Set();
  const unpaidHalfDayDates = new Set();
  const paidHalfDayDates = new Set();
  const approvedLeaveEntryIds = new Set();
  (leaveBalanceSnapshot?.dayStatusMap || new Map()).forEach((decision, dateKey) => {
    if (!dateKey || dateKey < monthRange.startDate || dateKey > monthRange.endDate) {
      return;
    }

    if (Number(decision?.leaveId || 0) > 0) {
      approvedLeaveEntryIds.add(Number(decision.leaveId));
    }

    if (decision?.unit === "half") {
      if (paidFullDayDates.has(dateKey) || unpaidFullDayDates.has(dateKey)) return;

      if (decision.paid) {
        paidHalfDayDates.add(dateKey);
      } else {
        unpaidHalfDayDates.add(dateKey);
      }
      return;
    }

    paidHalfDayDates.delete(dateKey);
    unpaidHalfDayDates.delete(dateKey);

    if (decision?.paid) {
      if (!unpaidFullDayDates.has(dateKey)) {
        paidFullDayDates.add(dateKey);
      }
    } else {
      paidFullDayDates.delete(dateKey);
      unpaidFullDayDates.add(dateKey);
    }
  });

  attendanceHalfDayDates.forEach((dateKey) => {
    if (paidFullDayDates.has(dateKey) || unpaidFullDayDates.has(dateKey)) return;
    if (!paidHalfDayDates.has(dateKey)) {
      unpaidHalfDayDates.add(dateKey);
    }
  });

  const paidLeaveDays = paidFullDayDates.size;
  const unpaidLeaveDays = unpaidFullDayDates.size;
  const leaveHalfDays = unpaidHalfDayDates.size;
  const attendanceHalfDays = Array.from(attendanceHalfDayDates).filter(
    (dateKey) => !paidFullDayDates.has(dateKey) && !unpaidFullDayDates.has(dateKey),
  ).length;
  const leaveDeduction = Number(
    (
      (unpaidLeaveDays * dailySalary) +
      (leaveHalfDays * (dailySalary / 2))
    ).toFixed(2),
  );
  const finalSalary = Number(
    Math.max(
      0,
      basicSalary +
        bonusAmount +
        incentiveAmount -
        leaveDeduction -
        penaltyAmount,
    ).toFixed(2),
  );

  return {
    employeeId: Number(user.id),
    name: user.name || "Employee",
    email: user.email || "",
    contact: user.contact || "",
    role: normalizeRoleValue(user.role),
    roleLabel: getPayrollRoleLabel(user.role),
    department,
    compensationType,
    commissionPercent,
    commissionSalesAmount: salesCommission.salesAmount,
    commissionDealsCount: salesCommission.dealsCount,
    commissionAmount: salesCommission.amount,
    target: autoTargetIncentive?.target || 0,
    targetAchieved: autoTargetIncentive?.achieved || 0,
    targetRemaining: autoTargetIncentive?.remaining || 0,
    targetIncentiveRate: autoTargetIncentive?.rate || AUTO_TARGET_INCENTIVE_RATE,
    targetIncentiveAmount: autoTargetIncentive?.amount || 0,
    targetIncentiveApplies: Boolean(autoTargetIncentive?.applies),
    targetSource: autoTargetIncentive?.source || "",
    targetBasis: autoTargetIncentive?.basis || null,
    salary: basicSalary,
    joiningDate,
    isTeamLead,
    monthKey: monthRange.monthKey,
    monthStart: monthRange.startDate,
    monthEnd: monthRange.endDate,
    workingDays,
    dailySalary,
    basicSalary,
    paidLeaveDays,
    unpaidLeaveDays,
    halfDays: leaveHalfDays,
    leaveHalfDays,
    paidHalfDays: paidHalfDayDates.size,
    attendanceHalfDays,
      approvedLeaveEntries: approvedLeaveEntryIds.size,
    leaveDeduction,
    bonusAmount,
    incentiveAmount,
    penaltyAmount,
    finalSalary,
    notes,
    payrollId: storedPayroll?.payrollId || null,
    payrollStatus: storedPayroll?.status || "preview",
    generatedAt: storedPayroll?.generatedAt || null,
    approvedAt: storedPayroll?.approvedAt || null,
    isGenerated: Boolean(storedPayroll?.payrollId),
  };
}

function sanitizePayrollPreviewForEmployee(preview = {}) {
  const safePreview = { ...preview };

  return safePreview;
}

async function getPayrollTrendSeries(limit = 6) {
  await ensurePayrollTables();
  const safeLimit = Math.max(1, Number(limit) || 6);
  const [rows] = await dbPromise.query(
    `
      SELECT
        month_key,
        SUM(final_salary) AS total_payout,
        COUNT(*) AS employee_count
      FROM payrolls
      GROUP BY month_key
      ORDER BY month_key DESC
      LIMIT ?
    `,
    [safeLimit],
  );

  return rows
    .map((row) => ({
      monthKey: row.month_key,
      totalPayout: normalizePayrollAmount(row.total_payout),
      employeeCount: Number(row.employee_count || 0),
    }))
    .reverse();
}

async function replacePayrollLineItems(payrollId, preview) {
  const normalizedPayrollId = Number(payrollId);
  if (!normalizedPayrollId) return;

  await dbPromise.query("DELETE FROM payroll_deductions WHERE payroll_id = ?", [
    normalizedPayrollId,
  ]);
  await dbPromise.query("DELETE FROM payroll_bonuses WHERE payroll_id = ?", [
    normalizedPayrollId,
  ]);
  await dbPromise.query("DELETE FROM payroll_incentives WHERE payroll_id = ?", [
    normalizedPayrollId,
  ]);

  const deductionItems = [];
  if (preview.unpaidLeaveDays > 0) {
    deductionItems.push({
      deductionType: "unpaid_leave",
      label: `${preview.unpaidLeaveDays} unpaid leave day(s)`,
      units: preview.unpaidLeaveDays,
      amount: Number((preview.unpaidLeaveDays * preview.dailySalary).toFixed(2)),
      notes: "Approved unpaid leave deduction",
    });
  }
  if (preview.halfDays > 0) {
    deductionItems.push({
      deductionType: "half_day",
      label: `${preview.halfDays} half day(s)`,
      units: preview.halfDays,
      amount: Number((preview.halfDays * (preview.dailySalary / 2)).toFixed(2)),
      notes: "Half-day deduction from attendance/leave",
    });
  }
  if (preview.penaltyAmount > 0) {
    deductionItems.push({
      deductionType: "manual_penalty",
      label: "Manual penalty",
      units: null,
      amount: preview.penaltyAmount,
      notes: preview.notes || "Admin-adjusted penalty",
    });
  }

  for (const item of deductionItems) {
    await dbPromise.query(
      `
        INSERT INTO payroll_deductions (
          payroll_id,
          deduction_type,
          label,
          units,
          amount,
          notes
        )
        VALUES (?, ?, ?, ?, ?, ?)
      `,
      [
        normalizedPayrollId,
        item.deductionType,
        item.label,
        item.units,
        item.amount,
        item.notes,
      ],
    );
  }

  if (preview.bonusAmount > 0) {
    await dbPromise.query(
      `
        INSERT INTO payroll_bonuses (payroll_id, label, amount, notes)
        VALUES (?, 'Monthly bonus', ?, ?)
      `,
      [normalizedPayrollId, preview.bonusAmount, preview.notes || null],
    );
  }

  if (preview.incentiveAmount > 0) {
    const incentiveLabel = preview.compensationType === "commission"
      ? `Sales commission (${DEFAULT_SALES_COMMISSION_PERCENT}%)`
      : AUTO_TARGET_INCENTIVE_ROLES.has(
      String(preview.role || "")
        .toLowerCase()
        .trim(),
    )
      ? "Monthly target incentive (7%)"
      : "Monthly incentive";
    await dbPromise.query(
      `
        INSERT INTO payroll_incentives (payroll_id, label, amount, notes)
        VALUES (?, ?, ?, ?)
      `,
      [
        normalizedPayrollId,
        incentiveLabel,
        preview.incentiveAmount,
        preview.notes || null,
      ],
    );
  }
}

async function saveUserCompensation(adminId, userId, updates = {}) {
  const normalizedUserId = Number(userId);
  if (!normalizedUserId) {
    const error = new Error("Invalid employee id");
    error.statusCode = 400;
    throw error;
  }

  const adminUser = await ensureAdminAccess(adminId);
  const employee = await getPayrollEmployeeProfile(normalizedUserId);

  if (!employee) {
    const error = new Error("Employee not found");
    error.statusCode = 404;
    throw error;
  }

  if (!isSupportedPayrollRole(employee.role)) {
    const error = new Error("Payroll is not enabled for this role");
    error.statusCode = 400;
    throw error;
  }

  const nextSalary =
    updates.salary !== undefined
      ? normalizePayrollAmount(updates.salary)
      : employee.salary;
  const nextCompensationType =
    updates.compensationType !== undefined || updates.compensation_type !== undefined
      ? normalizeCompensationType(updates.compensationType ?? updates.compensation_type)
      : normalizeCompensationType(employee.compensation_type);
  const nextCommissionPercent = getFixedSalesCommissionPercent(nextCompensationType);
  const nextStoredSalary = nextCompensationType === "commission" ? 0 : nextSalary;

  if (nextStoredSalary < 0) {
    const error = new Error("Salary cannot be negative");
    error.statusCode = 400;
    throw error;
  }

  if (nextCompensationType === "commission") {
    const role = normalizeRoleValue(employee.role);
    if (!SALES_COMMISSION_ROLES.has(role)) {
      const error = new Error("Commission payout is available only for ME/TME role");
      error.statusCode = 400;
      throw error;
    }

    if (nextCommissionPercent <= 0 || nextCommissionPercent > 100) {
      const error = new Error("Commission percent must be between 0 and 100");
      error.statusCode = 400;
      throw error;
    }
  }

  const nextDepartment =
    updates.department !== undefined
      ? String(updates.department || "").trim()
      : employee.department;
  const nextJoiningDate =
    updates.joiningDate !== undefined
      ? String(updates.joiningDate || "").trim() || null
      : employee.joining_date || null;
  const nextIsTeamLead =
    updates.isTeamLead !== undefined
      ? Number(normalizePayrollBoolean(updates.isTeamLead))
      : Number(employee.is_team_lead || 0);

  if (nextJoiningDate && !parseDateOnlyValue(nextJoiningDate)) {
    const error = new Error("Joining date must be a valid date");
    error.statusCode = 400;
    throw error;
  }

  const departmentChanged = String(employee.department || "") !== nextDepartment;
  const salaryChanged = Number(employee.salary || 0) !== Number(nextStoredSalary || 0);
  const compensationChanged =
    normalizeCompensationType(employee.compensation_type) !== nextCompensationType ||
    normalizeCommissionPercent(employee.commission_percent) !== nextCommissionPercent;
  const joiningDateChanged =
    String(employee.joining_date || "") !== String(nextJoiningDate || "");
  const teamLeadChanged =
    Number(employee.is_team_lead || 0) !== Number(nextIsTeamLead || 0);

  if (!departmentChanged && !salaryChanged && !compensationChanged && !joiningDateChanged && !teamLeadChanged) {
    return employee;
  }

  await dbPromise.query(
    `
      UPDATE users
      SET
        department = ?,
        salary = ?,
        compensation_type = ?,
        commission_percent = ?,
        joining_date = ?,
        is_team_lead = ?
      WHERE id = ?
    `,
    [
      nextDepartment || null,
      Number(nextStoredSalary.toFixed(2)),
      nextCompensationType,
      nextCommissionPercent,
      nextJoiningDate,
      nextIsTeamLead,
      normalizedUserId,
    ],
  );

  await dbPromise.query(
    `
      INSERT INTO salary_history (
        user_id,
        previous_salary,
        new_salary,
        previous_department,
        new_department,
        previous_joining_date,
        new_joining_date,
        previous_is_team_lead,
        new_is_team_lead,
        changed_by,
        note
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      normalizedUserId,
      Number(employee.salary || 0),
      Number(nextStoredSalary.toFixed(2)),
      employee.department || null,
      nextDepartment || null,
      employee.joining_date || null,
      nextJoiningDate,
      Number(employee.is_team_lead || 0),
      nextIsTeamLead,
      adminUser.id,
      "Updated via payroll management",
    ],
  );

  await logPayrollAudit({
    actorId: adminUser.id,
    targetUserId: normalizedUserId,
    actionType: "compensation_updated",
    payload: {
      previous: {
        salary: employee.salary,
        compensationType: employee.compensation_type,
        commissionPercent: employee.commission_percent,
        department: employee.department,
        joiningDate: employee.joining_date,
        isTeamLead: employee.is_team_lead,
      },
      next: {
        salary: nextStoredSalary,
        compensationType: nextCompensationType,
        commissionPercent: nextCommissionPercent,
        department: nextDepartment,
        joiningDate: nextJoiningDate,
        isTeamLead: nextIsTeamLead,
      },
    },
  });

  return getPayrollEmployeeProfile(normalizedUserId);
}

async function buildPayrollOverviewCore({
  monthKey,
  roleFilter,
  departmentFilter,
  searchTerm,
  companyScope,
}) {
  const normalizedMonthKey = normalizePayrollMonthKey(monthKey);
  const users = await getPayrollUsers({
    roleFilter,
    departmentFilter,
    searchTerm,
    companyScope,
  });

  if (shouldAutoSyncPayrollMonth(normalizedMonthKey)) {
    for (const user of users) {
      await upsertPayrollForEmployee({
        employeeId: user.id,
        monthKey: normalizedMonthKey,
        touchApprovalTimestamps: false,
      });
    }
  }

  const storedRowsMap = await getStoredPayrollRowsByMonth(
    normalizedMonthKey,
    users.map((user) => user.id),
  );
  const data = await Promise.all(
    users.map((user) =>
      buildPayrollPreview(user, normalizedMonthKey, {
        storedPayroll: storedRowsMap.get(Number(user.id)) || null,
      }),
    ),
  );

  const departmentExpense = {};
  let totalMonthlyPayout = 0;
  let employeesWithDeductions = 0;
  let generatedEmployees = 0;
  let totalPaidLeaves = 0;
  let totalUnpaidLeaves = 0;
  let totalHalfDays = 0;

  data.forEach((row) => {
    totalMonthlyPayout += row.finalSalary;
    totalPaidLeaves += row.paidLeaveDays;
    totalUnpaidLeaves += row.unpaidLeaveDays;
    totalHalfDays += row.halfDays;

    if (row.leaveDeduction > 0 || row.penaltyAmount > 0) {
      employeesWithDeductions += 1;
    }

    if (row.isGenerated) {
      generatedEmployees += 1;
    }

    departmentExpense[row.department] =
      (departmentExpense[row.department] || 0) + row.finalSalary;
  });

  const summary = {
    totalEmployees: data.length,
    totalMonthlyPayout: Number(totalMonthlyPayout.toFixed(2)),
    employeesWithDeductions,
    generatedEmployees,
    departmentCount: Object.keys(departmentExpense).length,
    totalPaidLeaves,
    totalUnpaidLeaves,
    totalHalfDays,
  };

  const trend = await getPayrollTrendSeries();

  return {
    month: normalizedMonthKey,
    summary,
    data,
    trend,
    departmentExpense: Object.entries(departmentExpense)
      .map(([department, amount]) => ({
        department,
        amount: Number(amount.toFixed(2)),
      }))
      .sort((left, right) => right.amount - left.amount),
  };
}

async function buildPayrollOverview({
  adminId,
  monthKey,
  roleFilter,
  departmentFilter,
  searchTerm,
  companyScope,
}) {
  await ensureAdminAccess(adminId);
  return buildPayrollOverviewCore({
    monthKey,
    roleFilter,
    departmentFilter,
    searchTerm,
    companyScope,
  });
}

function buildPayrollCsv(rows = []) {
  const header = [
    "Employee",
    "Role",
    "Department",
    "Month",
    "Pay Type",
    "Commission %",
    "Commission Sales",
    "Commission Amount",
    "Basic Salary",
    "Paid Leaves",
    "Unpaid Leaves",
    "Half Days",
    "Leave Deduction",
    "Bonus",
    "Incentive",
    "Penalty",
    "Final Salary",
    "Generated",
  ];

  const escapeCsvValue = (value) =>
    `"${String(value ?? "").replace(/"/g, "\"\"")}"`;

  const csvLines = [header.map(escapeCsvValue).join(",")];
  rows.forEach((row) => {
    csvLines.push(
      [
        row.name,
        row.roleLabel,
        row.department,
        row.monthKey,
        row.compensationType || "salary",
        row.commissionPercent || 0,
        row.commissionSalesAmount || 0,
        row.commissionAmount || 0,
        row.basicSalary,
        row.paidLeaveDays,
        row.unpaidLeaveDays,
        row.halfDays,
        row.leaveDeduction,
        row.bonusAmount,
        row.incentiveAmount,
        row.penaltyAmount,
        row.finalSalary,
        row.isGenerated ? "Yes" : "No",
      ]
        .map(escapeCsvValue)
        .join(","),
    );
  });

  return csvLines.join("\n");
}

app.get("/api/payroll/admin/overview", async (req, res) => {
  const adminId = Number(req.query.adminId);

  if (!adminId) {
    return res.status(400).json({
      success: false,
      message: "Admin access is required",
    });
  }

  try {
    const payload = await buildPayrollOverview({
      adminId,
      monthKey: req.query.month,
      roleFilter: req.query.role,
      departmentFilter: req.query.department,
      searchTerm: req.query.search,
      companyScope: getRequestedCompanyScope(req),
    });

    res.json({
      success: true,
      ...payload,
    });
  } catch (err) {
    console.error("Payroll overview error:", err);
    res.status(err.statusCode || 500).json({
      success: false,
      message: err.message || "Failed to load payroll overview",
    });
  }
});

app.get("/api/hr/payroll/overview", async (req, res) => {
  const requesterId = Number(req.query.userId);

  if (!requesterId) {
    return res.status(400).json({
      success: false,
      message: "HR access is required",
    });
  }

  try {
    await ensureAdminOrHrAccess(requesterId);
    const payload = await buildPayrollOverviewCore({
      monthKey: req.query.month,
      roleFilter: req.query.role,
      departmentFilter: req.query.department,
      searchTerm: req.query.search,
      companyScope: getRequestedCompanyScope(req),
    });

    res.json({
      success: true,
      ...payload,
    });
  } catch (err) {
    console.error("HR payroll overview error:", err);
    res.status(err.statusCode || 500).json({
      success: false,
      message: err.message || "Failed to load HR payroll overview",
    });
  }
});

app.put("/api/payroll/admin/employee/:userId/compensation", async (req, res) => {
  const userId = Number(req.params.userId);
  const adminId = Number(req.body.adminId);

  if (!userId || !adminId) {
    return res.status(400).json({
      success: false,
      message: "Employee and admin details are required",
    });
  }

  try {
    const employee = await saveUserCompensation(adminId, userId, req.body || {});
    res.json({
      success: true,
      message: "Compensation updated successfully",
      data: employee,
    });
  } catch (err) {
    console.error("Payroll compensation update error:", err);
    res.status(err.statusCode || 500).json({
      success: false,
      message: err.message || "Failed to update compensation",
    });
  }
});

app.post("/api/payroll/admin/generate", async (req, res) => {
  const adminId = Number(req.body.adminId);
  const monthKey = normalizePayrollMonthKey(req.body.month);
  const employeesPayload = Array.isArray(req.body.employees) ? req.body.employees : [];

  if (!adminId) {
    return res.status(400).json({
      success: false,
      message: "Admin access is required",
    });
  }

  try {
    await ensureAdminAccess(adminId);
    const allUsers = await getPayrollUsers({
      companyScope: await getCompanyScopeForUser(adminId),
    });
    const userMap = new Map(allUsers.map((user) => [Number(user.id), user]));
    const targetPayloads = employeesPayload.length
      ? employeesPayload
      : allUsers.map((user) => ({ employeeId: user.id }));

    const generatedPayrolls = [];

    for (const payload of targetPayloads) {
      const employeeId = Number(payload.employeeId);
      const user = userMap.get(employeeId);

      if (!user) {
        continue;
      }

      await saveUserCompensation(adminId, employeeId, payload);
      const preview = await upsertPayrollForEmployee({
        employeeId,
        monthKey,
        actorId: adminId,
        overrides: {
          salary: payload.salary,
          compensationType: payload.compensationType ?? payload.compensation_type,
          commissionPercent: payload.commissionPercent ?? payload.commission_percent,
          department: payload.department,
          joiningDate: payload.joiningDate,
          isTeamLead: payload.isTeamLead,
          bonusAmount: payload.bonusAmount,
          incentiveAmount: payload.incentiveAmount,
          penaltyAmount: payload.penaltyAmount,
          notes: payload.notes,
        },
        touchApprovalTimestamps: true,
        auditActionType: "payroll_generated",
      });

      if (!preview) {
        continue;
      }

      generatedPayrolls.push(preview);
    }

    res.json({
      success: true,
      message: generatedPayrolls.length
        ? "Payroll generated successfully"
        : "No payroll records were generated",
      month: monthKey,
      data: generatedPayrolls,
    });
  } catch (err) {
    console.error("Payroll generation error:", err);
    res.status(err.statusCode || 500).json({
      success: false,
      message: err.message || "Failed to generate payroll",
    });
  }
});

app.get("/api/payroll/admin/export", async (req, res) => {
  const adminId = Number(req.query.adminId);

  if (!adminId) {
    return res.status(400).json({
      success: false,
      message: "Admin access is required",
    });
  }

  try {
    const payload = await buildPayrollOverview({
      adminId,
      monthKey: req.query.month,
      roleFilter: req.query.role,
      departmentFilter: req.query.department,
      searchTerm: req.query.search,
      companyScope: getRequestedCompanyScope(req),
    });

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=payroll_${payload.month}.csv`,
    );
    res.send(buildPayrollCsv(payload.data));
  } catch (err) {
    console.error("Payroll export error:", err);
    res.status(err.statusCode || 500).json({
      success: false,
      message: err.message || "Failed to export payroll report",
    });
  }
});

app.get("/api/payroll/my/:userId", async (req, res) => {
  const userId = Number(req.params.userId);
  const requesterId = Number(req.query.requesterId || req.params.userId);
  const monthKey = normalizePayrollMonthKey(req.query.month);

  if (!userId || !requesterId) {
    return res.status(400).json({
      success: false,
      message: "User details are required",
    });
  }

  try {
    const { employee } = await ensurePayrollViewerAccess(requesterId, userId);
    if (shouldAutoSyncPayrollMonth(monthKey)) {
      await upsertPayrollForEmployee({
        employeeId: userId,
        monthKey,
        touchApprovalTimestamps: false,
      });
    }
    const storedRowsMap = await getStoredPayrollRowsByMonth(monthKey, [userId]);
    const storedPayroll = storedRowsMap.get(userId) || null;
    const preview = await buildPayrollPreview(employee, monthKey, {
      storedPayroll,
    });

    const [historyRows] = await dbPromise.query(
      `
        SELECT *
        FROM payrolls
        WHERE employee_id = ?
        ORDER BY month_key DESC, generated_at DESC
        LIMIT 12
      `,
      [userId],
    );

    res.json({
      success: true,
      month: monthKey,
      employee: {
        id: employee.id,
        name: employee.name,
        role: normalizeRoleValue(employee.role),
        roleLabel: getPayrollRoleLabel(employee.role),
        department: employee.department,
        salary: employee.salary,
        joiningDate: employee.joining_date || null,
        isTeamLead: Number(employee.is_team_lead || 0),
      },
      preview: sanitizePayrollPreviewForEmployee(preview),
      history: historyRows.map(normalizeStoredPayrollRow),
    });
  } catch (err) {
    console.error("My payroll fetch error:", err);
    res.status(err.statusCode || 500).json({
      success: false,
      message: err.message || "Failed to load salary details",
    });
  }
});

app.get("/api/payroll/payslip/:payrollId", async (req, res) => {
  const payrollId = Number(req.params.payrollId);
  const requesterId = Number(req.query.requesterId);

  if (!payrollId || !requesterId) {
    return res.status(400).json({
      success: false,
      message: "Payroll and requester details are required",
    });
  }

  try {
    await ensurePayrollTables();
    const [rows] = await dbPromise.query(
      `
        SELECT
          p.*,
          u.name AS current_employee_name,
          u.email AS current_employee_email,
          u.contact AS current_employee_contact,
          u.role AS current_employee_role
        FROM payrolls p
        INNER JOIN users u ON u.id = p.employee_id
        WHERE p.id = ?
        LIMIT 1
      `,
      [payrollId],
    );

    if (!rows.length) {
      return res.status(404).json({
        success: false,
        message: "Payslip not found",
      });
    }

    const payroll = rows[0];
    await ensurePayrollViewerAccess(requesterId, payroll.employee_id);
    const breakdown = await getStoredPayrollDetailRows(payrollId);

    const doc = new PDFDocument({ size: "A4", margin: 40 });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=payslip_${payroll.employee_id}_${payroll.month_key}.pdf`,
    );
    doc.pipe(res);

    const logoPath = path.join(__dirname, "logo-transparent.png");
    try {
      doc.image(logoPath, 40, 28, { width: 140 });
    } catch {}

    doc
      .fillColor("#0f766e")
      .fontSize(22)
      .text("Payroll Payslip", 0, 36, { align: "right" });

    doc
      .fillColor("#0f172a")
      .fontSize(11)
      .text("Metrics Mart", 40, 110)
      .text(`Payslip Month: ${payroll.month_key}`, 40, 126)
      .text(`Generated: ${formatPayrollDateForDisplay(payroll.generated_at)}`, 40, 142);

    let y = 182;
    doc.roundedRect(40, y, 515, 92, 12).stroke("#d7e2ef");
    doc
      .fontSize(10)
      .fillColor("#64748b")
      .text("Employee", 56, y + 16)
      .text("Role", 56, y + 40)
      .text("Department", 290, y + 16)
      .text("Joining Date", 290, y + 40);
    doc
      .fontSize(14)
      .fillColor("#0f172a")
      .text(payroll.employee_name_snapshot || payroll.current_employee_name || "-", 56, y + 28)
      .text(getPayrollRoleLabel(payroll.role_snapshot || payroll.current_employee_role), 56, y + 52)
      .text(payroll.department_snapshot || "-", 290, y + 28)
      .text(formatPayrollDateForDisplay(payroll.joining_date_snapshot), 290, y + 52);

    y += 122;
    doc.roundedRect(40, y, 250, 124, 12).fillAndStroke("#f8fafc", "#d7e2ef");
    doc.roundedRect(305, y, 250, 124, 12).fillAndStroke("#f8fafc", "#d7e2ef");

    doc
      .fillColor("#0f172a")
      .fontSize(13)
      .text("Earnings", 56, y + 16)
      .fontSize(10)
      .fillColor("#475569")
      .text(`Basic Salary: Rs. ${formatPayrollCurrency(payroll.basic_salary)}`, 56, y + 44)
      .text(`Bonus: Rs. ${formatPayrollCurrency(payroll.bonus_amount)}`, 56, y + 64)
      .text(`Incentive: Rs. ${formatPayrollCurrency(payroll.incentive_amount)}`, 56, y + 84)
      .fillColor("#0f172a")
      .fontSize(15)
      .text(`Net Salary: Rs. ${formatPayrollCurrency(payroll.final_salary)}`, 56, y + 104);

    doc
      .fillColor("#0f172a")
      .fontSize(13)
      .text("Deductions", 321, y + 16)
      .fontSize(10)
      .fillColor("#475569")
      .text(`Unpaid Leaves: ${Number(payroll.unpaid_leave_days || 0)}`, 321, y + 44)
      .text(`Half Days: ${Number(payroll.half_days || 0)}`, 321, y + 64)
      .text(`Leave Deduction: Rs. ${formatPayrollCurrency(payroll.leave_deduction)}`, 321, y + 84)
      .text(`Penalty: Rs. ${formatPayrollCurrency(payroll.penalty_amount)}`, 321, y + 104);

    y += 156;
    doc
      .fillColor("#0f172a")
      .fontSize(14)
      .text("Breakdown", 40, y);

    y += 22;
    doc.rect(40, y, 515, 24).fill("#0f766e");
    doc
      .fillColor("#ffffff")
      .fontSize(10)
      .text("Type", 52, y + 7)
      .text("Label", 132, y + 7)
      .text("Amount", 470, y + 7, { width: 70, align: "right" });

    y += 24;
    const lineItems = [
      ...breakdown.bonuses.map((item) => ({ type: "Bonus", ...item })),
      ...breakdown.incentives.map((item) => ({ type: "Incentive", ...item })),
      ...breakdown.deductions.map((item) => ({ type: "Deduction", ...item })),
    ];

    if (!lineItems.length) {
      doc
        .fillColor("#334155")
        .fontSize(10)
        .text("No additional line items recorded for this month.", 52, y + 12);
      y += 34;
    } else {
      lineItems.forEach((item) => {
        doc.rect(40, y, 515, 24).stroke("#d7e2ef");
        doc
          .fillColor("#0f172a")
          .fontSize(9)
          .text(item.type, 52, y + 7)
          .text(item.label || "-", 132, y + 7, { width: 290 })
          .text(`Rs. ${formatPayrollCurrency(item.amount)}`, 450, y + 7, {
            width: 90,
            align: "right",
          });
        y += 24;
      });
    }

    y += 28;
    doc
      .fillColor("#475569")
      .fontSize(10)
      .text(
        `Amount in words: ${converter.toWords(Math.round(Number(payroll.final_salary || 0)))} rupees only.`,
        40,
        y,
      );

    if (payroll.notes) {
      y += 28;
      doc
        .fillColor("#0f172a")
        .fontSize(11)
        .text("Notes", 40, y)
        .fillColor("#475569")
        .fontSize(10)
        .text(payroll.notes, 40, y + 16, { width: 515 });
    }

    doc.end();
  } catch (err) {
    console.error("Payslip generation error:", err);
    res.status(err.statusCode || 500).json({
      success: false,
      message: err.message || "Failed to generate payslip",
    });
  }
});

// ====================== REPORTS COUNTS ======================
app.get("/api/reports/counts", (req, res) => {
  const { userId } = req.query;
  const role = String(req.query.role || "")
    .toLowerCase()
    .trim();

  let leadQuery = "";
  let appointmentQuery = "";
  let followQuery = "";

  if (role === "admin") {
    leadQuery = "SELECT COUNT(*) AS total FROM leads";
    appointmentQuery =
      "SELECT COUNT(*) AS total FROM leads WHERE action_type='appointment'";
    followQuery =
      "SELECT COUNT(*) AS total FROM leads WHERE action_type='followup'";

    db.query(leadQuery, (err, leads) => {
      db.query(appointmentQuery, (err2, appointments) => {
        db.query(followQuery, (err3, follows) => {
          res.json({
            success: true,
            data: {
              leads: leads[0].total,
              appointments: appointments[0].total,
              followups: follows[0].total,
            },
          });
        });
      });
    });
  } else if (role === "me" || role === "tme") {
    const normalizedRole = role;
    const userSql = `
      SELECT name
      FROM users
      WHERE id = ? AND LOWER(TRIM(role)) = ?
      LIMIT 1
    `;

    db.query(userSql, [userId, normalizedRole], (userErr, users) => {
      if (userErr) {
        console.error(`${normalizedRole.toUpperCase()} Report User Error:`, userErr);
        return res.status(500).json({ success: false });
      }

      if (!users.length) {
        return res.json({
          success: true,
          data: {
            appointments: 0,
            followups: 0,
            deals: 0,
          },
        });
      }

      const employeeName = users[0].name;
      const scopedWhereParts = [];
      addRequestedLeadCompanyScope(req, scopedWhereParts, "leads");
      const scopeAnd = scopedWhereParts.length
        ? ` AND ${scopedWhereParts.join(" AND ")}`
        : "";

      const leadsSql = `
        SELECT COUNT(*) AS total
        FROM leads
        WHERE (created_by = ? OR assign_emp = ? OR assign_emp_id = ?)
          ${scopeAnd}
      `;
      const appointmentSql = `
        SELECT COUNT(*) AS total
        FROM leads
        WHERE action_type='appointment'
          AND (created_by = ? OR assign_emp = ? OR assign_emp_id = ?)
          ${scopeAnd}
      `;
      const followSql = `
        SELECT COUNT(*) AS total
        FROM leads
        WHERE action_type='followup'
          AND (created_by = ? OR assign_emp = ? OR assign_emp_id = ?)
          ${scopeAnd}
      `;
      const dealsSql = `
        SELECT COUNT(*) AS total
        FROM leads
        WHERE lead_status='deal_closed'
          AND (created_by = ? OR closed_by = ? OR assign_emp = ? OR assign_emp_id = ?)
          ${scopeAnd}
      `;

      db.query(leadsSql, [userId, employeeName, userId], (err0, leads) => {
        if (err0) {
          console.error(`${normalizedRole.toUpperCase()} Leads Report Error:`, err0);
          return res.status(500).json({ success: false });
        }

        db.query(appointmentSql, [userId, employeeName, userId], (err1, appointments) => {
          if (err1) {
            console.error(`${normalizedRole.toUpperCase()} Appointments Report Error:`, err1);
            return res.status(500).json({ success: false });
          }

          db.query(followSql, [userId, employeeName, userId], (err2, follows) => {
            if (err2) {
              console.error(`${normalizedRole.toUpperCase()} Followups Report Error:`, err2);
              return res.status(500).json({ success: false });
            }

            db.query(dealsSql, [userId, userId, employeeName, userId], (err3, deals) => {
              if (err3) {
                console.error(`${normalizedRole.toUpperCase()} Deals Report Error:`, err3);
                return res.status(500).json({ success: false });
              }

              return res.json({
                success: true,
                data: {
                  leads: leads[0].total,
                  appointments: appointments[0].total,
                  followups: follows[0].total,
                  deals: deals[0].total,
                },
              });
            });
          });
        });
      });
    });
  } else {
    const scopedWhereParts = [];
    addRequestedLeadCompanyScope(req, scopedWhereParts, "leads");
    const scopeAnd = scopedWhereParts.length
      ? ` AND ${scopedWhereParts.join(" AND ")}`
      : "";
    leadQuery = `SELECT COUNT(*) AS total FROM leads WHERE created_by = ?${scopeAnd}`;
    appointmentQuery =
      `SELECT COUNT(*) AS total FROM leads WHERE action_type='appointment' AND created_by = ?${scopeAnd}`;
    followQuery =
      `SELECT COUNT(*) AS total FROM leads WHERE action_type='followup' AND created_by = ?${scopeAnd}`;

    db.query(leadQuery, [userId], (err, leads) => {
      db.query(appointmentQuery, [userId], (err2, appointments) => {
        db.query(followQuery, [userId], (err3, follows) => {
          res.json({
            success: true,
            data: {
              leads: leads[0].total,
              appointments: appointments[0].total,
              followups: follows[0].total,
            },
          });
        });
      });
    });
  }
});

app.get("/api/projects", (req, res) => {
  const scopedWhereParts = [
    "lead_status = 'deal_closed'",
    "pay_stat = 'received'",
  ];
  addRequestedLeadCompanyScope(req, scopedWhereParts, "leads");

  const sql = `
      SELECT 
        id,
        company_name AS projectName,
        client_name AS client,
        services,
        service_notes,
        web_type,
        seo_type,
        smo_type,
        app_type,
        erp_type,
        'Ongoing' AS status
      FROM leads 
      WHERE ${scopedWhereParts.join("\n      AND ")}
      ORDER BY closed_date DESC
    `;

  db.query(sql, (err, result) => {
    if (err) {
      console.error("Projects Fetch Error:", err);
      return res.status(500).json({ success: false, message: "Server error" });
    }

    const projects = result.map((project) => {
      let servicesList = Array.from(getProjectServiceList(project).map(
        (service) => service.label,
      ));

      const columns = [
        project.services,
        project.web_type,
        project.seo_type,
        project.smo_type,
        project.app_type,
        project.erp_type,
      ];

      columns.forEach((value) => {
        if (!value) return;

        try {
          let parsed = value;

          // 🔥 Step 1: agar string hai to parse karo
          if (typeof parsed === "string") {
            parsed = JSON.parse(parsed);
          }

          // 🔥 Step 2: double JSON (important fix)
          if (typeof parsed === "string") {
            parsed = JSON.parse(parsed);
          }

          // 🔥 Step 3: array ya string handle
          if (Array.isArray(parsed)) {
            servicesList = servicesList.concat(parsed);
          } else if (parsed && typeof parsed === "string") {
            servicesList.push(parsed);
          }
        } catch (e) {
          // 🔥 fallback (agar parse fail ho)
          if (typeof value === "string" && value.trim() !== "") {
            servicesList.push(value);
          }
        }
      });

      // 🔥 FINAL CLEANUP
      servicesList = [
        ...new Set(
          servicesList
            .map((s) => String(s).trim())
            .filter(
              (s) =>
                s !== "" && s !== "null" && s !== "undefined" && s !== "[]",
            ),
        ),
      ];

      const servicesText =
        servicesList.length > 0
          ? servicesList.join(", ")
          : "No services selected";

      return {
        id: project.id,
        projectName: project.projectName,
        client: project.client,
        services: servicesText,
        service_notes: project.service_notes,
        status: project.status,
        web_type: project.web_type,
        seo_type: project.seo_type,
        smo_type: project.smo_type,
        app_type: project.app_type,
        erp_type: project.erp_type,
      };
    });

    res.json({ success: true, data: projects });
  });
});

// ====================== AVAILABLE TEAM FOR PROJECT ASSIGNMENT ======================
app.get("/api/available-team", (req, res) => {
  const service = normalizeProjectServiceKey(
    String(req.query.services || req.query.service || ""),
  );
  const serviceRoleMap = {
    web: ["dev"],
    app: ["dev"],
    erp: ["dev"],
    seo: ["seo"],
    smo: ["smo"],
    ads: ["smo"],
  };
  const allowedRoles = new Set(serviceRoleMap[service] || []);

  if (!service) {
    return res.json({ success: true, data: [] });
  }

  const userWhereParts = [
    "LOWER(TRIM(u.role)) NOT IN ('me', 'tme', 'admin', 'hr', 'accounts')",
  ];
  addRequestedUserCompanyScope(req, userWhereParts, "u");

  const sql = `
    SELECT
      u.id,
      u.name,
      u.role,
      u.skills
    FROM users u
    WHERE ${userWhereParts.join("\n      AND ")}
    ORDER BY LOWER(TRIM(u.role)) ASC, u.name ASC
  `;

  db.query(sql, (err, result) => {
    if (err) {
      console.error("Available Team Error:", err);
      return res.status(500).json({ success: false, message: "DB Error" });
    }

    const filtered = (result || [])
      .filter((user) => {
        const normalizedRole = String(user.role || "")
          .toLowerCase()
          .trim();

        if (allowedRoles.has(normalizedRole)) {
          return true;
        }

        try {
          let skills = user.skills;

          if (typeof skills === "string") {
            skills = JSON.parse(skills);
          }

          if (typeof skills === "string") {
            skills = JSON.parse(skills);
          }

          if (!Array.isArray(skills)) {
            skills = skills ? [skills] : [];
          }

          const normalizedSkills = new Set(
            skills
              .map((skill) => String(skill).toLowerCase().trim())
              .filter(Boolean),
          );

          if (service === "erp") {
            return (
              normalizedSkills.has("erp") || normalizedSkills.has("erp_crm")
            );
          }

          return normalizedSkills.has(service);
        } catch (parseErr) {
          return false;
        }
      })
      .map((user) => ({
        id: user.id,
        name: user.name,
        role: user.role,
      }));

    res.json({
      success: true,
      data: filtered,
    });
  });
});


app.get("/api/admin/team-report", async (req, res) => {
  const userWhereParts = [
    "LOWER(TRIM(COALESCE(u.role, ''))) <> 'admin'",
  ];
  const leadJoinScopeParts = [];

  addRequestedUserCompanyScope(req, userWhereParts, "u");
  addRequestedLeadCompanyScope(req, leadJoinScopeParts, "l");

  const sql = `
      SELECT
        u.id,
        u.name,
        u.email,
        u.role,
        u.prof_img,
        u.profile_setup_status,
        DATE_FORMAT(u.profile_setup_expires_at, '%Y-%m-%d %H:%i:%s') AS profile_setup_expires_at,
        DATE_FORMAT(u.profile_setup_completed_at, '%Y-%m-%d %H:%i:%s') AS profile_setup_completed_at,
        COUNT(DISTINCT l.id) AS total_leads,
        SUM(CASE WHEN l.action_type = 'appointment' THEN 1 ELSE 0 END) AS total_appointments,
        SUM(CASE WHEN l.action_type = 'followup' THEN 1 ELSE 0 END) AS total_followups,
        CASE WHEN lt.user_id IS NOT NULL THEN 1 ELSE 0 END AS is_on_leave_today,
        lt.leave_type AS today_leave_type
      FROM users u
      LEFT JOIN leads l
        ON l.assign_emp_id = u.id
        ${leadJoinScopeParts.length ? `AND ${leadJoinScopeParts.join(" AND ")}` : ""}
      LEFT JOIN (
        SELECT
          lr.user_id,
          MAX(lr.leave_type) AS leave_type
        FROM leave_requests lr
        WHERE lr.status = 'approved'
          AND CURDATE() BETWEEN lr.from_date AND lr.to_date
        GROUP BY lr.user_id
      ) lt ON lt.user_id = u.id
      WHERE ${userWhereParts.join("\n        AND ")}
      GROUP BY
        u.id,
        u.name,
        u.email,
        u.role,
        u.prof_img,
        u.profile_setup_status,
        u.profile_setup_expires_at,
        u.profile_setup_completed_at,
        lt.user_id,
        lt.leave_type
      ORDER BY u.role ASC, u.name ASC
    `;

  try {
    await ensureLeaveRequestsTable();
    await ensureUserProfileSetupColumns();
    await ensureLeadCompanyScopeColumn();
    const [result] = await dbPromise.query(sql);
    res.json({
      success: true,
      data: result.map((user) => {
        const statusDetails = getProfileSetupStatusDetails(user);
        return {
          ...user,
          profile_setup_status: statusDetails.status,
          profile_setup_link_expired: statusDetails.isExpired,
        };
      }),
    });
  } catch (err) {
    console.error("Team Report Error:", err);
    res.status(500).json({ success: false, message: "Failed to load team report" });
  }
});

app.post("/api/assign-project", (req, res) => {
  let { projectId, userId, serviceType } = req.body;

  // normalize
  serviceType = (serviceType || "").toLowerCase().trim();

  if (!projectId || !userId || !serviceType) {
    return res.status(400).json({
      success: false,
      message: "projectId, userId and serviceType are required",
    });
  }

  const checkSql = `
    SELECT id 
    FROM project_assignments
    WHERE user_id = ?
      AND project_id = ?
      AND service_type = ?
      AND status = 'assigned'
  `;

  db.query(checkSql, [userId, projectId, serviceType], (err, result) => {
    if (err) {
      console.error("Check Assignment Error:", err);
      return res.status(500).json({ success: false });
    }

    if (result.length > 0) {
      return res.json({
        success: false,
        message: "Already assigned for this service in this project",
      });
    }

    const insertSql = `
      INSERT INTO project_assignments 
      (project_id, user_id, service_type, status)
      VALUES (?, ?, ?, 'assigned')
    `;

    db.query(insertSql, [projectId, userId, serviceType], (err) => {
      if (err) {
        console.error("Insert Error:", err);
        return res.status(500).json({ success: false });
      }

      res.json({
        success: true,
        message: "Assigned successfully",
      });
    });
  });
});

// ================= CHECK ASSIGNMENT =================
app.get("/api/check-assignment/:projectId", (req, res) => {
  const { serviceType } = req.query;
  const projectId = req.params.projectId;

let sql = `
  SELECT id 
  FROM project_assignments
  WHERE project_id = ?
`;

  const params = [projectId];

  if (serviceType) {
    sql += ` AND service_type = ?`;
    params.push(serviceType.toLowerCase());
  }

  db.query(sql, params, (err, result) => {
    if (err) {
      console.error("Check Assignment Error:", err);
      return res.status(500).json({ success: false });
    }

    res.json({
      success: true,
      assigned: result.length > 0,
    });
  });
});

async function sendProjectAssignmentsByUser(
  userId,
  res,
  logLabel = "Projects",
  req = null,
) {
  if (!userId) {
    return res.status(400).json({
      success: false,
      message: "Invalid userId",
    });
  }

  const scopedWhereParts = [];
  addRequestedLeadCompanyScope(req, scopedWhereParts, "l");
  const scopeAnd = scopedWhereParts.length
    ? ` AND ${scopedWhereParts.join(" AND ")}`
    : "";

  const sql = `
    SELECT
      pa.id AS assignment_id,
      l.id AS project_id,
      l.company_name AS projectName,
      l.client_name AS client,
      l.telephone AS clientContact,
      l.alternate_contact AS clientAlternateContact,
      l.telephone AS clientTelephone,
      l.email AS clientEmail,
      l.maps_lnk AS clientMapsLink,
      pa.service_type,
      pa.status,
      pa.stage,
      pa.progress,
      pa.assigned_at
    FROM project_assignments pa
    JOIN leads l ON pa.project_id = l.id
    WHERE pa.user_id = ?
      ${scopeAnd}
    ORDER BY pa.assigned_at DESC
  `;

  try {
    await ensureProjectAssignmentWorkflowColumns();
    await ensureProjectPhaseDetailsTable();
    await ensureLeadCompanyScopeColumn();

    const [rows] = await dbPromise.query(sql, [userId]);
    const projects = await mapRowsToSharedProjectAssignments(rows || []);

    return res.json({
      success: true,
      assigned: projects.filter((project) => project.status === "assigned"),
      ongoing: projects.filter((project) => project.status === "ongoing"),
      completed: projects.filter((project) => project.status === "completed"),
    });
  } catch (err) {
    console.error(`${logLabel} Fetch Error:`, err);
    return res.status(500).json({
      success: false,
      message: "Database error",
    });
  }
}

async function sendSeoProjectAssignments(
  userId,
  res,
  req = null,
  fallbackServiceType = "seo",
) {
  if (!userId) {
    return res.status(400).json({
      success: false,
      message: "Invalid userId",
    });
  }
  const normalizedFallbackServiceType =
    normalizeProjectServiceKey(fallbackServiceType) || "seo";

  const baseSelect = `
    SELECT
      pa.id AS assignment_id,
      l.id AS project_id,
      l.company_name AS projectName,
      l.client_name AS client,
      l.telephone AS clientContact,
      l.alternate_contact AS clientAlternateContact,
      l.telephone AS clientTelephone,
      l.email AS clientEmail,
      l.maps_lnk AS clientMapsLink,
      pa.service_type,
      pa.status,
      pa.stage,
      pa.progress,
      pa.assigned_at
    FROM project_assignments pa
    JOIN leads l ON pa.project_id = l.id
  `;
  const scopedWhereParts = [];
  addRequestedLeadCompanyScope(req, scopedWhereParts, "l");
  const scopeAnd = scopedWhereParts.length
    ? ` AND ${scopedWhereParts.join(" AND ")}`
    : "";

  try {
    await ensureProjectAssignmentWorkflowColumns();
    await ensureProjectPhaseDetailsTable();
    await ensureLeadCompanyScopeColumn();

    const [userRows] = await dbPromise.query(
      `
        ${baseSelect}
        WHERE pa.user_id = ?
          ${scopeAnd}
        ORDER BY pa.assigned_at DESC
      `,
      [userId],
    );

    const rowsToSend =
      Array.isArray(userRows) && userRows.length > 0
        ? userRows
        : (
            await dbPromise.query(
              `
                ${baseSelect}
                WHERE LOWER(TRIM(COALESCE(pa.service_type, ''))) = ?
                  ${scopeAnd}
                ORDER BY pa.assigned_at DESC
              `,
              [normalizedFallbackServiceType],
            )
          )[0] || [];
    const projects = await mapRowsToSharedProjectAssignments(rowsToSend);

    return res.json({
      success: true,
      assigned: projects.filter((project) => project.status === "assigned"),
      ongoing: projects.filter((project) => project.status === "ongoing"),
      completed: projects.filter((project) => project.status === "completed"),
    });
  } catch (err) {
    console.error(`${normalizedFallbackServiceType.toUpperCase()} Projects Fetch Error:`, err);
    return res.status(500).json({
      success: false,
      message: "Database error",
    });
  }
}

async function getProjectAssignmentRecord(assignmentId, userId = null) {
  const normalizedAssignmentId = Number(assignmentId);
  const normalizedUserId = Number(userId);

  if (!Number.isFinite(normalizedAssignmentId) || normalizedAssignmentId <= 0) {
    return null;
  }

  let sql = `
    SELECT
      pa.id AS assignment_id,
      pa.project_id,
      pa.user_id,
      pa.service_type,
      pa.status,
      pa.stage,
      pa.progress,
      pa.assigned_at,
      l.company_name AS projectName,
      l.client_name AS client,
      l.telephone AS clientContact,
      l.alternate_contact AS clientAlternateContact,
      l.telephone AS clientTelephone,
      l.email AS clientEmail,
      l.maps_lnk AS clientMapsLink
    FROM project_assignments pa
    JOIN leads l ON l.id = pa.project_id
    WHERE pa.id = ?
  `;
  const params = [normalizedAssignmentId];

  if (Number.isFinite(normalizedUserId) && normalizedUserId > 0) {
    sql += " AND pa.user_id = ?";
    params.push(normalizedUserId);
  }

  sql += " LIMIT 1";

  const [rows] = await dbPromise.query(sql, params);
  return rows[0] || null;
}

async function getProjectAssignmentSyncContext(assignment) {
  const normalizedProjectId = Number(assignment?.project_id || 0);
  const normalizedAssignmentId = Number(assignment?.assignment_id || 0);
  const normalizedServiceType = String(assignment?.service_type || "")
    .toLowerCase()
    .trim();

  if (
    !Number.isFinite(normalizedProjectId) ||
    normalizedProjectId <= 0 ||
    !normalizedServiceType
  ) {
    return {
      assignmentIds: normalizedAssignmentId > 0 ? [normalizedAssignmentId] : [],
      serviceType: normalizedServiceType,
    };
  }

  const [rows] = await dbPromise.query(
    `
      SELECT id
      FROM project_assignments
      WHERE project_id = ?
        AND LOWER(TRIM(COALESCE(service_type, ''))) = ?
      ORDER BY id ASC
    `,
    [normalizedProjectId, normalizedServiceType],
  );

  const assignmentIds = (rows || [])
    .map((row) => Number(row.id || 0))
    .filter((id) => Number.isFinite(id) && id > 0);

  if (!assignmentIds.length && normalizedAssignmentId > 0) {
    assignmentIds.push(normalizedAssignmentId);
  }

  return {
    assignmentIds,
    serviceType: normalizedServiceType,
  };
}

async function getSharedProjectPhaseRowsForAssignment(assignment) {
  const syncContext = await getProjectAssignmentSyncContext(assignment);
  const assignmentIds = Array.isArray(syncContext.assignmentIds)
    ? syncContext.assignmentIds
    : [];

  if (!assignmentIds.length) {
    return {
      assignmentIds: [],
      phaseRows: [],
    };
  }

  const [rows] = await dbPromise.query(
    `
      SELECT
        assignment_id,
        phase_key,
        status,
        progress,
        start_date,
        due_date,
        notes,
        blockers,
        deliverable_link,
        attachments_json,
        updated_at,
        id
      FROM project_phase_details
      WHERE assignment_id IN (?)
      ORDER BY updated_at DESC, id DESC
    `,
    [assignmentIds],
  );

  const phaseMap = new Map();

  (rows || []).forEach((row) => {
    const normalizedPhaseKey = normalizeProjectPhaseKey(
      assignment?.service_type,
      row?.phase_key,
    );

    if (!normalizedPhaseKey || phaseMap.has(normalizedPhaseKey)) {
      return;
    }

    phaseMap.set(normalizedPhaseKey, {
      ...row,
      phase_key: normalizedPhaseKey,
    });
  });

  return {
    assignmentIds,
    phaseRows: Array.from(phaseMap.values()),
  };
}

function getProjectAssignmentGroupKey(projectId, serviceType) {
  const normalizedProjectId = Number(projectId || 0);
  const normalizedServiceType = normalizeProjectServiceKey(serviceType);

  if (
    !Number.isFinite(normalizedProjectId) ||
    normalizedProjectId <= 0 ||
    !normalizedServiceType
  ) {
    return "";
  }

  return `${normalizedProjectId}::${normalizedServiceType}`;
}

function getProjectAssignmentStatusRank(status) {
  const normalizedStatus = normalizeProjectAssignmentStatus(status, "assigned");

  if (normalizedStatus === "completed") return 3;
  if (normalizedStatus === "ongoing") return 2;
  return 1;
}

function pickRepresentativeProjectAssignment(assignments = []) {
  if (!Array.isArray(assignments) || !assignments.length) {
    return null;
  }

  return [...assignments].sort((left, right) => {
    const statusDiff =
      getProjectAssignmentStatusRank(right?.status) -
      getProjectAssignmentStatusRank(left?.status);
    if (statusDiff !== 0) return statusDiff;

    const progressDiff =
      clampProjectProgress(right?.progress, 0) -
      clampProjectProgress(left?.progress, 0);
    if (progressDiff !== 0) return progressDiff;

    const rightUpdatedAt = new Date(
      right?.updated_at || right?.assigned_at || 0,
    ).getTime();
    const leftUpdatedAt = new Date(
      left?.updated_at || left?.assigned_at || 0,
    ).getTime();
    if (rightUpdatedAt !== leftUpdatedAt) {
      return rightUpdatedAt - leftUpdatedAt;
    }

    return Number(right?.assignment_id || right?.id || 0) -
      Number(left?.assignment_id || left?.id || 0);
  })[0];
}

function buildSharedProjectPhaseRows(serviceType, phaseRows = []) {
  const sortedRows = [...(Array.isArray(phaseRows) ? phaseRows : [])].sort(
    (left, right) => {
      const rightUpdatedAt = new Date(right?.updated_at || 0).getTime();
      const leftUpdatedAt = new Date(left?.updated_at || 0).getTime();
      if (rightUpdatedAt !== leftUpdatedAt) {
        return rightUpdatedAt - leftUpdatedAt;
      }

      return Number(right?.id || 0) - Number(left?.id || 0);
    },
  );
  const phaseMap = new Map();

  sortedRows.forEach((row) => {
    const normalizedPhaseKey = normalizeProjectPhaseKey(
      serviceType,
      row?.phase_key,
    );

    if (!normalizedPhaseKey || phaseMap.has(normalizedPhaseKey)) {
      return;
    }

    phaseMap.set(normalizedPhaseKey, {
      ...row,
      phase_key: normalizedPhaseKey,
    });
  });

  return Array.from(phaseMap.values());
}

function buildProjectAssignmentSharedStateIndex(
  assignmentRows = [],
  phaseRows = [],
) {
  const groupAssignments = new Map();
  const assignmentGroupKeys = new Map();

  (Array.isArray(assignmentRows) ? assignmentRows : []).forEach((row) => {
    const assignmentId = Number(row?.assignment_id || row?.id || 0);
    const groupKey = getProjectAssignmentGroupKey(
      row?.project_id,
      row?.service_type || row?.serviceType,
    );

    if (!assignmentId || !groupKey) {
      return;
    }

    assignmentGroupKeys.set(assignmentId, groupKey);

    if (!groupAssignments.has(groupKey)) {
      groupAssignments.set(groupKey, []);
    }

    groupAssignments.get(groupKey).push(row);
  });

  const phaseRowsByGroup = new Map();
  (Array.isArray(phaseRows) ? phaseRows : []).forEach((row) => {
    const assignmentId = Number(row?.assignment_id || 0);
    const groupKey = assignmentGroupKeys.get(assignmentId);

    if (!groupKey) {
      return;
    }

    if (!phaseRowsByGroup.has(groupKey)) {
      phaseRowsByGroup.set(groupKey, []);
    }

    phaseRowsByGroup.get(groupKey).push(row);
  });

  const sharedStateIndex = new Map();

  groupAssignments.forEach((groupRows, groupKey) => {
    const representative = pickRepresentativeProjectAssignment(groupRows);
    if (!representative) {
      return;
    }

    const sharedPhaseRows = buildSharedProjectPhaseRows(
      representative.service_type || representative.serviceType,
      phaseRowsByGroup.get(groupKey) || [],
    );
    const phases = buildProjectPhaseRows(
      representative.service_type || representative.serviceType,
      sharedPhaseRows,
      representative,
    );
    const phaseSummary = summarizeProjectPhaseRows(phases);
    const hasStoredRows = sharedPhaseRows.length > 0;
    const status = normalizeProjectAssignmentStatus(
      hasStoredRows ? phaseSummary.status : representative.status,
      phaseSummary.status,
    );
    const progress = clampProjectProgress(
      hasStoredRows ? phaseSummary.progress : representative.progress,
      phaseSummary.progress,
    );
    const stage = hasStoredRows
      ? phaseSummary.stage || representative.stage || null
      : representative.stage || phaseSummary.stage || null;
    const stageLabel = getProjectAssignmentStageLabel(
      representative.service_type || representative.serviceType,
      stage,
      phases,
    );
    const phaseUpdates = phases
      .map((phase) => phase.updated_at)
      .filter(Boolean)
      .map((value) => new Date(value).getTime())
      .filter((value) => Number.isFinite(value));
    const sharedState = {
      status,
      progress,
      stage,
      stageLabel,
      phases,
      summary: {
        ...phaseSummary,
        status,
        progress,
        stage,
      },
      lastUpdatedAt: phaseUpdates.length
        ? new Date(Math.max(...phaseUpdates)).toISOString()
        : representative.assigned_at || null,
    };

    groupRows.forEach((row) => {
      const assignmentId = Number(row?.assignment_id || row?.id || 0);
      if (!assignmentId) {
        return;
      }

      sharedStateIndex.set(assignmentId, sharedState);
    });
  });

  return sharedStateIndex;
}

async function mapRowsToSharedProjectAssignments(rows = []) {
  const sourceRows = Array.isArray(rows) ? rows : [];

  if (!sourceRows.length) {
    return [];
  }

  const projectIds = Array.from(
    new Set(
      sourceRows
        .map((row) => Number(row?.project_id || 0))
        .filter((projectId) => Number.isFinite(projectId) && projectId > 0),
    ),
  );

  if (!projectIds.length) {
    return sourceRows.map((row) => ({
      assignment_id: row.assignment_id,
      project_id: row.project_id,
      projectName: row.projectName,
      client: row.client,
      clientContact: row.clientContact || "",
      clientAlternateContact: row.clientAlternateContact || "",
      clientTelephone: row.clientTelephone || "",
      clientEmail: row.clientEmail || "",
      clientMapsLink: row.clientMapsLink || "",
      serviceType: row.service_type,
      status: normalizeProjectAssignmentStatus(row.status),
      stage: row.stage || null,
      progress: clampProjectProgress(row.progress, 0),
      assigned_at: row.assigned_at,
    }));
  }

  const [relatedAssignments] = await dbPromise.query(
    `
      SELECT
        pa.id AS assignment_id,
        pa.project_id,
        pa.user_id,
        pa.service_type,
        pa.status,
        pa.stage,
        pa.progress,
        pa.assigned_at
      FROM project_assignments pa
      WHERE pa.project_id IN (?)
    `,
    [projectIds],
  );

  const relatedAssignmentIds = (relatedAssignments || [])
    .map((row) => Number(row.assignment_id || 0))
    .filter((assignmentId) => Number.isFinite(assignmentId) && assignmentId > 0);
  let phaseRows = [];

  if (relatedAssignmentIds.length) {
    const [rows] = await dbPromise.query(
      `
        SELECT
          id,
          assignment_id,
          phase_key,
          status,
          progress,
          start_date,
          due_date,
          notes,
          blockers,
          deliverable_link,
          attachments_json,
          updated_at
        FROM project_phase_details
        WHERE assignment_id IN (?)
      `,
      [relatedAssignmentIds],
    );
    phaseRows = rows || [];
  }

  const sharedStateIndex = buildProjectAssignmentSharedStateIndex(
    relatedAssignments,
    phaseRows,
  );

  return sourceRows.map((row) => {
    const sharedState = sharedStateIndex.get(Number(row.assignment_id || 0));

    return {
      assignment_id: row.assignment_id,
      project_id: row.project_id,
      projectName: row.projectName,
      client: row.client,
      clientContact: row.clientContact || "",
      clientAlternateContact: row.clientAlternateContact || "",
      clientTelephone: row.clientTelephone || "",
      clientEmail: row.clientEmail || "",
      clientMapsLink: row.clientMapsLink || "",
      serviceType: row.service_type,
      status: normalizeProjectAssignmentStatus(
        sharedState?.status,
        row.status,
      ),
      stage: sharedState?.stage || row.stage || null,
      progress: clampProjectProgress(
        sharedState?.progress,
        row.progress || 0,
      ),
      assigned_at: row.assigned_at,
    };
  });
}

// ================= DEV PROJECTS =================
app.get("/api/dev/projects/:userId", (req, res) => {
  const userId = parseInt(req.params.userId, 10);
  sendProjectAssignmentsByUser(userId, res, "DEV Projects", req);
});

// ================= DM PROJECTS =================
app.get("/api/dm/projects/:userId", (req, res) => {
  const userId = parseInt(req.params.userId, 10);
  sendProjectAssignmentsByUser(userId, res, "DM Projects", req);
});

// ================= SEO PROJECTS =================
app.get("/api/seo/projects/:userId", (req, res) => {
  const userId = parseInt(req.params.userId, 10);
  sendSeoProjectAssignments(userId, res, req, "seo");
});

// ================= SMO PROJECTS =================
app.get("/api/smo/projects/:userId", (req, res) => {
  const userId = parseInt(req.params.userId, 10);
  sendSeoProjectAssignments(userId, res, req, "smo");
});

app.get("/api/project-tracker", async (req, res) => {
  const scope = String(req.query.scope || req.query.role || "admin")
    .toLowerCase()
    .trim();
  const userId = Number(req.query.userId || 0);

  if ((scope === "me" || scope === "tme") && (!Number.isFinite(userId) || userId <= 0)) {
    return res.status(400).json({
      success: false,
      message: "Valid userId is required for this tracker scope",
    });
  }
  const useLegacyLeadScope = ["admin", "me", "tme"].includes(scope);

  try {
    await ensureProjectAssignmentWorkflowColumns();
    await ensureProjectPhaseDetailsTable();
    if (!useLegacyLeadScope) {
      await ensureLeadCompanyScopeColumn();
    }

    const payload = await fetchProjectTrackerData(
      scope,
      userId,
      useLegacyLeadScope ? "" : getRequestedCompanyScope(req),
    );
    res.json({
      success: true,
      scope,
      ...payload,
    });
  } catch (err) {
    console.error("Project Tracker Error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to load project tracker data",
    });
  }
});

app.get("/api/project-assignments/:assignmentId/phases", async (req, res) => {
  const assignmentId = Number(req.params.assignmentId);
  const userId = Number(req.query.userId || 0);

  if (!Number.isFinite(assignmentId) || assignmentId <= 0) {
    return res.status(400).json({
      success: false,
      message: "Valid assignmentId is required",
    });
  }

  try {
    await ensureProjectAssignmentWorkflowColumns();
    await ensureProjectPhaseDetailsTable();

    const assignment = await getProjectAssignmentRecord(assignmentId, userId);

    if (!assignment) {
      return res.status(404).json({
        success: false,
        message: "Project assignment not found",
      });
    }

    const sharedPhaseSnapshot = await getSharedProjectPhaseRowsForAssignment(
      assignment,
    );

    const phases = buildProjectPhaseRows(
      assignment.service_type,
      sharedPhaseSnapshot.phaseRows,
      assignment,
    );
    const summary = summarizeProjectPhaseRows(phases);

    res.json({
      success: true,
      assignment: {
        assignment_id: assignment.assignment_id,
        project_id: assignment.project_id,
        user_id: assignment.user_id,
        projectName: assignment.projectName,
        client: assignment.client,
        clientContact: assignment.clientContact || "",
        clientAlternateContact: assignment.clientAlternateContact || "",
        clientTelephone: assignment.clientTelephone || "",
        clientEmail: assignment.clientEmail || "",
        clientMapsLink: assignment.clientMapsLink || "",
        serviceType: assignment.service_type,
        status: String(assignment.status || summary.status || "assigned")
          .toLowerCase()
          .trim(),
        stage: assignment.stage || summary.stage,
        progress: clampProjectProgress(
          assignment.progress,
          summary.progress || 0,
        ),
        assigned_at: assignment.assigned_at,
      },
      phases,
      summary,
    });
  } catch (err) {
    console.error("Project Phase Fetch Error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to fetch project phase details",
    });
  }
});

app.post(
  "/api/project-assignments/:assignmentId/phases/:phaseKey/attachments",
  (req, res) => {
    uploadProjectPhaseFiles.array("files", 8)(req, res, async (uploadErr) => {
      if (uploadErr) {
        return res.status(400).json({
          success: false,
          message: uploadErr.message || "Failed to upload project phase files",
        });
      }

      const assignmentId = Number(req.params.assignmentId);
      const userId = Number(req.body.userId || req.query.userId || 0);

      if (!Number.isFinite(assignmentId) || assignmentId <= 0) {
        return res.status(400).json({
          success: false,
          message: "Valid assignmentId is required",
        });
      }

      try {
        await ensureProjectAssignmentWorkflowColumns();
        await ensureProjectPhaseDetailsTable();

        const assignment = await getProjectAssignmentRecord(assignmentId, userId);

        if (!assignment) {
          return res.status(404).json({
            success: false,
            message: "Project assignment not found",
          });
        }

        const normalizedPhaseKey = normalizeProjectPhaseKey(
          assignment.service_type,
          req.params.phaseKey,
        );

        if (!normalizedPhaseKey) {
          return res.status(400).json({
            success: false,
            message: "Invalid phase key",
          });
        }

        const files = Array.isArray(req.files) ? req.files : [];
        if (!files.length) {
          return res.status(400).json({
            success: false,
            message: "At least one file is required",
          });
        }

        const attachments = await Promise.all(
          files.map(async (file) => {
            const uploadedUrl = await resolveUploadedFilePath(file, "project-phases");

            return {
              name: String(file.originalname || file.filename || "file").slice(0, 255),
              url: formatPublicUploadUrl(uploadedUrl),
              type: String(file.mimetype || "").slice(0, 120),
              size: Number(file.size || 0),
              uploaded_at: new Date().toISOString(),
            };
          }),
        );

        res.json({
          success: true,
          phase_key: normalizedPhaseKey,
          attachments,
          message: "Files uploaded successfully",
        });
      } catch (err) {
        console.error("Project Phase Attachment Upload Error:", err);
        res.status(500).json({
          success: false,
          message:
            err?.message ||
            "Failed to upload project phase files",
        });
      }
    });
  },
);

app.put("/api/project-assignments/:assignmentId/phases", async (req, res) => {
  const assignmentId = Number(req.params.assignmentId);
  const userId = Number(req.body.userId || req.query.userId || 0);
  const incomingPhases = Array.isArray(req.body.phases) ? req.body.phases : [];

  if (!Number.isFinite(assignmentId) || assignmentId <= 0) {
    return res.status(400).json({
      success: false,
      message: "Valid assignmentId is required",
    });
  }

  try {
    await ensureProjectAssignmentWorkflowColumns();
    await ensureProjectPhaseDetailsTable();

    const assignment = await getProjectAssignmentRecord(assignmentId, userId);

    if (!assignment) {
      return res.status(404).json({
        success: false,
        message: "Project assignment not found",
      });
    }

    const sharedPhaseSnapshot = await getSharedProjectPhaseRowsForAssignment(
      assignment,
    );

    const workflow = getProjectPhaseWorkflow(assignment.service_type);
    const phaseMap = new Map(
      incomingPhases.map((phase) => [
        normalizeProjectPhaseKey(assignment.service_type, phase?.phase_key),
        phase,
      ]),
    );

    const normalizedPhases = workflow.map((phase) => {
      const incoming = phaseMap.get(phase.key) || {};
      const status = normalizeProjectPhaseStatus(incoming.status, "pending");
      const progress = clampProjectProgress(
        incoming.progress,
        status === "completed" ? 100 : 0,
      );

      return {
        phase_key: phase.key,
        phase_label: phase.label,
        status,
        progress: status === "completed" ? 100 : progress,
        start_date: cleanProjectPhaseDate(incoming.start_date),
        due_date: cleanProjectPhaseDate(incoming.due_date),
        notes: cleanProjectPhaseText(incoming.notes),
        blockers: cleanProjectPhaseText(incoming.blockers),
        deliverable_link: cleanProjectPhaseLink(incoming.deliverable_link),
        attachments: normalizeProjectPhaseAttachments(incoming.attachments),
      };
    });

    const summary = summarizeProjectPhaseRows(normalizedPhases);
    const connection = await dbPromise.getConnection();

    try {
      await connection.beginTransaction();

      for (const relatedAssignmentId of sharedPhaseSnapshot.assignmentIds) {
        for (const phase of normalizedPhases) {
          await connection.query(
            `
              INSERT INTO project_phase_details (
                assignment_id,
                phase_key,
                status,
                progress,
                start_date,
                due_date,
                notes,
                blockers,
                deliverable_link,
                attachments_json
              )
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
              ON DUPLICATE KEY UPDATE
                status = VALUES(status),
                progress = VALUES(progress),
                start_date = VALUES(start_date),
                due_date = VALUES(due_date),
                notes = VALUES(notes),
                blockers = VALUES(blockers),
                deliverable_link = VALUES(deliverable_link),
                attachments_json = VALUES(attachments_json)
            `,
            [
              relatedAssignmentId,
              phase.phase_key,
              phase.status,
              phase.progress,
              phase.start_date,
              phase.due_date,
              phase.notes,
              phase.blockers,
              phase.deliverable_link,
              serializeProjectPhaseAttachments(phase.attachments),
            ],
          );
        }
      }

      await connection.query(
        `
          UPDATE project_assignments
          SET stage = ?, progress = ?, status = ?
          WHERE id IN (?)
        `,
        [
          summary.status === "assigned" ? null : summary.stage,
          summary.progress,
          summary.status,
          sharedPhaseSnapshot.assignmentIds,
        ],
      );

      await connection.commit();
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }

    const storedSnapshot = await getSharedProjectPhaseRowsForAssignment(
      assignment,
    );

    res.json({
      success: true,
      message: "Phase details updated successfully",
      assignment: {
        assignment_id: assignment.assignment_id,
        project_id: assignment.project_id,
        user_id: assignment.user_id,
        projectName: assignment.projectName,
        client: assignment.client,
        clientContact: assignment.clientContact || "",
        clientAlternateContact: assignment.clientAlternateContact || "",
        clientTelephone: assignment.clientTelephone || "",
        clientEmail: assignment.clientEmail || "",
        clientMapsLink: assignment.clientMapsLink || "",
        serviceType: assignment.service_type,
        status: summary.status,
        stage: summary.stage,
        progress: summary.progress,
        assigned_at: assignment.assigned_at,
      },
      phases: buildProjectPhaseRows(
        assignment.service_type,
        storedSnapshot.phaseRows,
        {
          ...assignment,
          stage: summary.stage,
          progress: summary.progress,
          status: summary.status,
        },
      ),
      summary,
    });
  } catch (err) {
    console.error("Project Phase Update Error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to update project phase details",
    });
  }
});

app.post("/api/project/update-status", async (req, res) => {
  const { assignment_id, project_id, status, service_type } = req.body;

  if ((!assignment_id && !project_id) || !status) {
    return res.status(400).json({
      success: false,
      message: "assignment_id or project_id and status are required",
    });
  }

  try {
    await ensureProjectAssignmentWorkflowColumns();
    let targetIds = [];

    if (assignment_id) {
      const assignment = await getProjectAssignmentRecord(assignment_id);
      if (!assignment) {
        return res.status(404).json({
          success: false,
          message: "Project assignment not found",
        });
      }

      const syncContext = await getProjectAssignmentSyncContext(assignment);
      targetIds = syncContext.assignmentIds || [];
    } else if (service_type) {
      const [rows] = await dbPromise.query(
        `
          SELECT id
          FROM project_assignments
          WHERE project_id = ?
            AND LOWER(TRIM(COALESCE(service_type, ''))) = ?
        `,
        [project_id, normalizeProjectServiceKey(service_type)],
      );
      targetIds = (rows || [])
        .map((row) => Number(row.id || 0))
        .filter((id) => Number.isFinite(id) && id > 0);
    } else {
      const [rows] = await dbPromise.query(
        `
          SELECT id
          FROM project_assignments
          WHERE project_id = ?
        `,
        [project_id],
      );
      targetIds = (rows || [])
        .map((row) => Number(row.id || 0))
        .filter((id) => Number.isFinite(id) && id > 0);
    }

    if (!targetIds.length) {
      return res.status(404).json({
        success: false,
        message: "Project assignment not found",
      });
    }

    const [result] = await dbPromise.query(
      `UPDATE project_assignments SET status = ? WHERE id IN (?)`,
      [status, targetIds],
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: "Project assignment not found",
      });
    }

    res.json({ success: true });
  } catch (err) {
    console.error("Project Status Update Error:", err);
    res.status(500).json({ success: false, message: "Database error" });
  }
});

app.post("/api/project/update-stage", async (req, res) => {
  const { assignment_id, project_id, stage, progress, status, service_type } = req.body;

  if ((!assignment_id && !project_id) || !stage) {
    return res.status(400).json({
      success: false,
      message: "assignment_id or project_id and stage are required",
    });
  }

  try {
    await ensureProjectAssignmentWorkflowColumns();
    let targetIds = [];

    if (assignment_id) {
      const assignment = await getProjectAssignmentRecord(assignment_id);
      if (!assignment) {
        return res.status(404).json({
          success: false,
          message: "Project assignment not found",
        });
      }

      const syncContext = await getProjectAssignmentSyncContext(assignment);
      targetIds = syncContext.assignmentIds || [];
    } else if (service_type) {
      const [rows] = await dbPromise.query(
        `
          SELECT id
          FROM project_assignments
          WHERE project_id = ?
            AND LOWER(TRIM(COALESCE(service_type, ''))) = ?
        `,
        [project_id, normalizeProjectServiceKey(service_type)],
      );
      targetIds = (rows || [])
        .map((row) => Number(row.id || 0))
        .filter((id) => Number.isFinite(id) && id > 0);
    } else {
      const [rows] = await dbPromise.query(
        `
          SELECT id
          FROM project_assignments
          WHERE project_id = ?
        `,
        [project_id],
      );
      targetIds = (rows || [])
        .map((row) => Number(row.id || 0))
        .filter((id) => Number.isFinite(id) && id > 0);
    }

    if (!targetIds.length) {
      return res.status(404).json({
        success: false,
        message: "Project assignment not found",
      });
    }

    const [result] = await dbPromise.query(
      `
        UPDATE project_assignments
        SET stage = ?, progress = ?, status = ?
        WHERE id IN (?)
      `,
      [
        stage,
        Number(progress || 0),
        status || "ongoing",
        targetIds,
      ],
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: "Project assignment not found",
      });
    }

    res.json({ success: true });
  } catch (err) {
    console.error("Project Stage Update Error:", err);
    res.status(500).json({ success: false, message: "Database error" });
  }
});

app.get("/api/projects-summary", async (req, res) => {
  try {
    await ensureLeadCompanyScopeColumn();
    const scopedWhereParts = [];
    addRequestedLeadCompanyScope(req, scopedWhereParts, "l");
    const scopeWhere = scopedWhereParts.length
      ? `WHERE ${scopedWhereParts.join(" AND ")}`
      : "";

    const [projects] = await dbPromise.query(`
      SELECT
        l.id AS project_id,
        l.company_name AS projectName,
        l.client_name AS client,
        l.services,
        l.service_notes,
        l.web_type,
        l.seo_type,
        l.smo_type,
        l.app_type,
        l.erp_type,
        pa_summary.status AS status,
        COALESCE(pa_summary.assigned_at, l.closed_date, l.created_at) AS assigned_at
      FROM leads l
      INNER JOIN (
        SELECT
          pa.project_id,
          CASE
            WHEN SUM(CASE WHEN pa.status = 'ongoing' THEN 1 ELSE 0 END) > 0 THEN 'ongoing'
            WHEN SUM(CASE WHEN pa.status = 'assigned' THEN 1 ELSE 0 END) > 0 THEN 'assigned'
            WHEN SUM(CASE WHEN pa.status = 'completed' THEN 1 ELSE 0 END) > 0 THEN 'completed'
            ELSE 'unassigned'
          END AS status,
          MAX(pa.assigned_at) AS assigned_at
        FROM project_assignments pa
        GROUP BY pa.project_id
      ) pa_summary ON pa_summary.project_id = l.id
      ${scopeWhere}
      ORDER BY COALESCE(pa_summary.assigned_at, l.closed_date, l.created_at) DESC
    `);

    const [assignmentRows] = await dbPromise.query(`
      SELECT
        pa.project_id,
        pa.user_id,
        pa.service_type,
        pa.status,
        pa.assigned_at,
        u.name AS assignee_name,
        u.role AS assignee_role
      FROM project_assignments pa
      LEFT JOIN users u ON u.id = pa.user_id
      ORDER BY pa.assigned_at DESC
    `);

    const assignmentsByProject = new Map();

    assignmentRows.forEach((row) => {
      const projectId = Number(row.project_id);
      const serviceKey = normalizeProjectServiceKey(row.service_type);

      if (!projectId || !serviceKey) return;

      if (!assignmentsByProject.has(projectId)) {
        assignmentsByProject.set(projectId, new Map());
      }

      const serviceMap = assignmentsByProject.get(projectId);

      if (!serviceMap.has(serviceKey)) {
        serviceMap.set(serviceKey, []);
      }

      const assignees = serviceMap.get(serviceKey);
      const userId = row.user_id == null ? null : Number(row.user_id);
      const alreadyExists = assignees.some(
        (assignee) =>
          (userId && assignee.user_id === userId) ||
          (!userId && assignee.name === (row.assignee_name || "Unassigned")),
      );

      if (!alreadyExists) {
        assignees.push({
          user_id: userId,
          name: row.assignee_name || "Unassigned",
          role: row.assignee_role || "",
          status: row.status || "",
          assigned_at: row.assigned_at || null,
        });
      }
    });

    const data = (projects || []).map((project) => {
      const projectId = Number(project.project_id);
      const serviceMap = assignmentsByProject.get(projectId) || new Map();
      const services = getProjectServiceList(project);
      const existingServiceKeys = new Set(services.map((item) => item.key));

      serviceMap.forEach((_, serviceKey) => {
        if (!existingServiceKeys.has(serviceKey)) {
          services.push({
            key: serviceKey,
            label: PROJECT_SERVICE_LABELS[serviceKey] || serviceKey.toUpperCase(),
          });
        }
      });

      return {
        project_id: projectId,
        projectName: project.projectName,
        client: project.client,
        status: project.status,
        assigned_at: project.assigned_at,
        services: services.map((service) => {
          const assignees = serviceMap.get(service.key) || [];

          return {
            key: service.key,
            label: service.label,
            assigned_count: assignees.length,
            assignees,
          };
        }),
      };
    });

    res.json({ success: true, data });
  } catch (err) {
    console.error("Project Summary Error:", err);
    return res.status(500).json({ success: false });
  }
});

app.get("/api/projects", (req, res) => {
  const scopedWhereParts = [
    "lead_status = 'deal_closed'",
    "pay_stat = 'received'",
  ];
  addRequestedLeadCompanyScope(req, scopedWhereParts, "leads");

  const sql = `
    SELECT
      id,
      company_name AS projectName,
      client_name AS client,
      services,
      service_notes,
      web_type,
      seo_type,
      smo_type,
      app_type,
      erp_type,
      'Ongoing' AS status
    FROM leads
    WHERE ${scopedWhereParts.join("\n    AND ")}
    ORDER BY closed_date DESC
  `;

  db.query(sql, (err, result) => {
    if (err) {
      console.error("Projects Fetch Error:", err);
      return res.status(500).json({ success: false, message: "Server error" });
    }

    const projects = result.map((project) => {
      const servicesList = getProjectServiceList(project).map(
        (service) => service.label,
      );
      const servicesText =
        servicesList.length > 0
          ? servicesList.join(", ")
          : "No services selected";

      return {
        id: project.id,
        projectName: project.projectName,
        client: project.client,
        services: servicesText,
        service_notes: project.service_notes,
        status: project.status,
        web_type: project.web_type,
        seo_type: project.seo_type,
        smo_type: project.smo_type,
        app_type: project.app_type,
        erp_type: project.erp_type,
      };
    });

    res.json({ success: true, data: projects });
  });
});


function getInvoiceItems(products) {
  if (Array.isArray(products) && products.length > 0) {
    return products.map((product) => ({
      name: product.product_name,
      description: "",
      amount: Number(product.product_amount || 0),
    }));
  }

  return [];
}

function formatMoney(amount) {
  return Number(amount || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function getInvoiceCompanyKey(invoiceData = {}) {
  return (
    normalizeLoginCompanyKey(
      invoiceData.company_scope ||
        invoiceData.created_by_company ||
        invoiceData.created_by_comp_name ||
        invoiceData.comp_name,
    ) || "metrics"
  );
}

async function getProformaInvoiceNumber(companyKey, leadId) {
  const normalizedCompanyKey = normalizeLoginCompanyKey(companyKey) || "metrics";
  const leadScopeSql = getCompanyLeadScopeSql(normalizedCompanyKey, "l");
  const [rows] = await dbPromise.query(
    `
      SELECT COUNT(*) AS sequence_no
      FROM leads l
      WHERE l.id <= ?
      ${leadScopeSql ? `AND ${leadScopeSql}` : ""}
    `,
    [Number(leadId) || 0],
  );
  const sequenceNo = Math.max(1, Number(rows[0]?.sequence_no || 0));
  return `${normalizedCompanyKey === "redsea" ? "RSD" : "MM"}-PFI-${sequenceNo}`;
}

function getDealProductsForInvoice(leadId) {
  return ensureDealProductsTable().then(() => {
  const sql = `
    SELECT dp.product_name, dp.product_amount
    FROM deals d
    INNER JOIN deal_products dp ON dp.deal_id = d.id
    WHERE d.lead_id = ?
      AND d.id = (
        SELECT id FROM deals
        WHERE lead_id = ?
        ORDER BY id DESC
        LIMIT 1
      )
    ORDER BY dp.id ASC
  `;

    return dbPromise.query(sql, [leadId, leadId]);
  });
}


app.get("/api/invoice/:id", (req, res) => {
  const leadId = req.params.id;

  const sql = `
    SELECT l.*, creator.comp_name AS created_by_company
    FROM leads l
    LEFT JOIN users creator ON creator.id = l.created_by
    WHERE l.id = ?
  `;

  db.query(sql, [leadId], async (err, result) => {
    if (err || result.length === 0) {
      return res.status(404).send("Lead not found");
    }

    const data = result[0];
    let invoiceItems = [];

    try {
      const [products] = await getDealProductsForInvoice(leadId);
      invoiceItems = getInvoiceItems(products);
    } catch (productErr) {
      console.error("Invoice Product Fetch Error:", productErr);
      return res.status(500).send("Failed to fetch invoice products");
    }

    const PDFDocument = require("pdfkit");
    const path = require("path");
    const converter = require("number-to-words");

    const doc = new PDFDocument({ size: "A4", margin: 40 });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=invoice_${leadId}.pdf`,
    );

    doc.pipe(res);

    const pageWidth = doc.page.width;
    const margin = doc.page.margins.left;
    const companyKey = getInvoiceCompanyKey(data);
    const isRedSeaInvoice = companyKey === "redsea";
    const proformaInvoiceNumber = await getProformaInvoiceNumber(companyKey, leadId);
    const invoiceAccentColor = isRedSeaInvoice ? "#ff3045" : "#0bb39c";

    const logoPath = path.join(__dirname, isRedSeaInvoice ? "logored.png" : "logo.png");
    const qrPath = path.join(__dirname, isRedSeaInvoice ? "qrred.jpeg" : "Qr.jpeg");
    const fontPath = path.join(__dirname, "fonts/NotoSans-Regular.ttf");
    doc.font(fontPath);
    const RS = "\u20B9";

    // ================= LOGO =================
    try {
      const logoWidth = isRedSeaInvoice
        ? pageWidth - margin * 2 - 18
        : pageWidth - margin * 2;
      doc.image(logoPath, margin, isRedSeaInvoice ? 10 : 20, {
        width: logoWidth,
      });
    } catch {}

    let y = isRedSeaInvoice ? 185 : 150;

    // ================= COMPANY =================
    doc.fontSize(9);
    if (isRedSeaInvoice) {
      doc.text("RED SEAS DIGITALS PRIVATE LIMITED", margin, y);
      doc.text("GSTIN: 09AAOCR6149Q1ZA", margin, y + 12);
      doc.text("Pincode: 201301", margin, y + 24);
    } else {
      doc.text("METRICSMART INFOLINE PRIVATE LIMITED", margin, y);
      doc.text("GSTIN: 27AANCM9265F1ZY", margin, y + 12);
      doc.text("Mumbai, Maharashtra - 400104", margin, y + 24);
    }

    // ================= INVOICE =================
    doc.text(`Invoice #: ${proformaInvoiceNumber}`, 350, y);
    doc.text(`Date: ${new Date().toLocaleDateString()}`, 350, y + 12);
    doc.text(`Due Date: ${new Date().toLocaleDateString()}`, 350, y + 24);

    y += 60;

    // ================= CUSTOMER =================
    const customerBoxHeight = isRedSeaInvoice ? 76 : 60;
    doc.rect(margin, y, pageWidth - margin * 2, customerBoxHeight).stroke();

    if (isRedSeaInvoice) {
      const customerLabelX = margin + 12;
      const customerValueX = margin + 108;
      const customerRightLabelX = margin + 300;
      const customerRightValueX = margin + 365;
      const customerTop = y + 10;
      const address = [data.locality, data.city].filter(Boolean).join(", ");

      doc
        .fontSize(9)
        .fillColor(invoiceAccentColor)
        .text("Customer Details", customerLabelX, customerTop);

      doc
        .fontSize(8)
        .fillColor("#555")
        .text("Company", customerLabelX, customerTop + 18, { width: 75 })
        .text("Client", customerRightLabelX, customerTop + 18, { width: 55 })
        .text("Phone", customerLabelX, customerTop + 36, { width: 75 })
        .text("Address", customerRightLabelX, customerTop + 36, { width: 55 });

      doc
        .fillColor("#000")
        .text(data.company_name || "-", customerValueX, customerTop + 18, { width: 180 })
        .text(data.client_name || "-", customerRightValueX, customerTop + 18, { width: 145 })
        .text(data.contact || "-", customerValueX, customerTop + 36, { width: 180 })
        .text(address || "-", customerRightValueX, customerTop + 36, { width: 145 });
    } else {
      doc.text("Customer Details:", margin + 5, y + 5);
      doc.text(data.company_name || "", margin + 5, y + 20);
      doc.text(data.client_name || "", 200, y + 20);
      doc.text(`Ph: ${data.contact || ""}`, 350, y + 20);
      doc.text(`${data.locality || ""}, ${data.city || ""}`, margin + 5, y + 35);
    }

    doc.fillColor("#000");
    y += customerBoxHeight + 20;

    // ================= TABLE =================
    const tableX = margin;
    const tableWidth = pageWidth - margin * 2;
    const itemX = tableX + 25;
    const rateX = tableX + 205;
    const qtyX = tableX + 285;
    const taxableX = tableX + 325;
    const taxX = tableX + 395;
    const amountX = tableX + 465;

    doc.rect(tableX, y, tableWidth, 20).fill(invoiceAccentColor);

    doc
      .fillColor("#fff")
      .fontSize(7)
      .text("#", tableX + 5, y + 5)
      .text("Item", itemX, y + 5)
      .text("Rate / Item", rateX, y + 5, { width: 70, align: "right" })
      .text("Qty", qtyX, y + 5, { width: 30, align: "right" })
      .text("Taxable Value", taxableX, y + 5, { width: 65, align: "right" })
      .text("Tax Amount", taxX, y + 5, { width: 65, align: "right" })
      .text("Amount", amountX, y + 5, { width: 50, align: "right" });

    doc.fillColor("#000");
    y += 20;

    const amount = invoiceItems.reduce((sum, item) => sum + item.amount, 0);

    invoiceItems.forEach((item, i) => {
      const text = item.description ? `${item.name}\n${item.description}` : item.name;
      const lineTax = item.amount * 0.18;
      const lineTotal = item.amount + lineTax;

      // 👇 calculate height for item + desc
      const textHeight = doc.heightOfString(text, {
        width: 150,
      });

      const rowHeight = Math.max(30, textHeight + 10); // dynamic

      doc.rect(tableX, y, tableWidth, rowHeight).stroke();

      doc
        .fontSize(8)
        .text(i + 1, tableX + 5, y + 5)
        .text(text, itemX, y + 5, {
          width: 170,
        })
        .text(formatMoney(item.amount), rateX, y + 5, { width: 70, align: "right" })
        .text("1", qtyX, y + 5, { width: 30, align: "right" })
        .text(formatMoney(item.amount), taxableX, y + 5, { width: 65, align: "right" })
        .text(`${formatMoney(lineTax)} (18%)`, taxX, y + 5, { width: 65, align: "right" })
        .text(formatMoney(lineTotal), amountX, y + 5, { width: 50, align: "right" });

      y += rowHeight;
    });

    // ================= TOTAL =================
    const taxable = amount;
    const cgst = taxable * 0.09;
    const sgst = taxable * 0.09;
    const totalWithTax = taxable + cgst + sgst;

    y += 20;

    doc.text("Taxable Amount", 330, y, { width: 90, align: "right" });
    doc.text(`${RS}${formatMoney(taxable)}`, 430, y, { width: 90, align: "right" });
    doc.text("CGST 9.0%", 330, y + 12, { width: 90, align: "right" });
    doc.text(`${RS}${formatMoney(cgst)}`, 430, y + 12, { width: 90, align: "right" });
    doc.text("SGST 9.0%", 330, y + 24, { width: 90, align: "right" });
    doc.text(`${RS}${formatMoney(sgst)}`, 430, y + 24, { width: 90, align: "right" });

    doc.fontSize(10).text("Total", 330, y + 42, { width: 90, align: "right" });
    doc.text(`${RS}${formatMoney(totalWithTax)}`, 430, y + 42, { width: 90, align: "right" });

    doc
      .fontSize(8)
      .text(
        `In Words: ${converter.toWords(totalWithTax)} Rupees Only`,
        margin,
        y + 20,
      );

    // ================= BANK + QR =================
    y += 80;

    doc.rect(margin, y, tableWidth, 120).stroke();

    try {
      const qrSize = isRedSeaInvoice ? 72 : 90;
      const qrBoxWidth = 120;
      const qrX = isRedSeaInvoice
        ? margin + (qrBoxWidth - qrSize) / 2
        : margin + 10;
      const qrY = isRedSeaInvoice ? y + 8 : y + (120 - qrSize) / 2;

      doc.image(qrPath, qrX, qrY, { width: qrSize });
    } catch {}

    doc
      .fontSize(8)
      .text(isRedSeaInvoice ? "Bank: HDFC Bank" : "Bank: Kotak Mahindra Bank", margin + 120, y + (isRedSeaInvoice ? 25 : 15))
      .text(isRedSeaInvoice ? "A/C: 50200109259621" : "A/C: 5145057933", margin + 120, y + 35)
      .text(isRedSeaInvoice ? "IFSC: HDFC0000975" : "IFSC: KKBK0001379", margin + 120, y + 55);

    doc.text("Authorized Signatory", 400, y + 90);

    // ================= NOTES =================
    y += 130;

    doc.fontSize(9).text("Notes:", margin, y);
    doc
      .fontSize(8)
      .text(
        "This pro forma invoice details the charges for products/services added at deal closure.",
        margin,
        y + 15,
      )
      .text(
        "Website balance payment is updated in the invoice.",
        margin,
        y + 30,
      );

    doc.end();
  });
});

app.get("/api/tax-invoice/:id", (req, res) => {
  const leadId = req.params.id;

  const sql = `SELECT * FROM leads WHERE id = ?`;

  db.query(sql, [leadId], async (err, result) => {
    if (err || result.length === 0) {
      return res.status(404).send("Lead not found");
    }

    const data = result[0];
    let invoiceItems = [];

    try {
      const [products] = await getDealProductsForInvoice(leadId);
      invoiceItems = getInvoiceItems(products);
    } catch (productErr) {
      console.error("Tax Invoice Product Fetch Error:", productErr);
      return res.status(500).send("Failed to fetch invoice products");
    }

    const PDFDocument = require("pdfkit");
    const path = require("path");
    const converter = require("number-to-words");

    const doc = new PDFDocument({ size: "A4", margin: 40 });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=invoice_${leadId}.pdf`,
    );

    doc.pipe(res);

    const pageWidth = doc.page.width;
    const margin = doc.page.margins.left;

    const logoPath = path.join(__dirname, "logo1.jpeg");
    const qrPath = path.join(__dirname, "Qr.jpeg");
    const fontPath = path.join(__dirname, "fonts/NotoSans-Regular.ttf");

    doc.font(fontPath);
    const RS = "\u20B9";

    // ================= LOGO (ONLY ONCE) =================
    let logoHeight = 140;

    try {
      doc.image(logoPath, margin - 22, 0, {
        width: pageWidth - (margin - 15),
        height: logoHeight,
      });
    } catch {}

    // 🔥 start content after logo
    let y = logoHeight + 10;

    // ================= COMPANY =================
    doc.fontSize(9).text("METRICSMART INFOLINE PRIVATE LIMITED", margin, y);
    doc.text("GSTIN: 27AANCM9265F1ZY", margin, y + 12);
    doc.text("Mumbai, Maharashtra - 400104", margin, y + 24);

    // ================= INVOICE INFO =================
    doc.text(`Invoice #: TI-${leadId}`, 350, y);
    doc.text(`Date: ${new Date().toLocaleDateString()}`, 350, y + 12);
    doc.text(`Due Date: ${new Date().toLocaleDateString()}`, 350, y + 24);

    y += 60;

    // ================= CUSTOMER =================
    doc.rect(margin, y, pageWidth - margin * 2, 60).stroke();

    doc.text("Customer Details:", margin + 5, y + 5);
    doc.text(data.company_name || "", margin + 5, y + 20);
    doc.text(data.client_name || "", 200, y + 20);
    doc.text(`Ph: ${data.contact || ""}`, 350, y + 20);
    doc.text(`${data.locality || ""}, ${data.city || ""}`, margin + 5, y + 35);

    y += 80;

    // ================= TABLE HEADER =================
    const tableX = margin;
    const tableWidth = pageWidth - margin * 2;
    const itemX = tableX + 25;
    const rateX = tableX + 205;
    const qtyX = tableX + 285;
    const taxableX = tableX + 325;
    const taxX = tableX + 395;
    const amountX = tableX + 465;

    doc.rect(tableX, y, tableWidth, 20).fill("#0bb39c");

    doc
      .fillColor("#fff")
      .fontSize(7)
      .text("#", tableX + 5, y + 5)
      .text("Item", itemX, y + 5)
      .text("Rate / Item", rateX, y + 5, { width: 70, align: "right" })
      .text("Qty", qtyX, y + 5, { width: 30, align: "right" })
      .text("Taxable Value", taxableX, y + 5, { width: 65, align: "right" })
      .text("Tax Amount", taxX, y + 5, { width: 65, align: "right" })
      .text("Amount", amountX, y + 5, { width: 50, align: "right" });

    doc.fillColor("#000");
    y += 20;

    // ================= SERVICES =================
    const amount = invoiceItems.reduce((sum, item) => sum + item.amount, 0);

    invoiceItems.forEach((item, i) => {
      const text = item.description ? `${item.name}\n${item.description}` : item.name;
      const lineTax = item.amount * 0.18;
      const lineTotal = item.amount + lineTax;

      const textHeight = doc.heightOfString(text, { width: 150 });
      const rowHeight = Math.max(30, textHeight + 10);

      doc.rect(tableX, y, tableWidth, rowHeight).stroke();

      doc
        .fontSize(8)
        .text(i + 1, tableX + 5, y + 5)
        .text(text, itemX, y + 5, { width: 170 })
        .text(formatMoney(item.amount), rateX, y + 5, { width: 70, align: "right" })
        .text("1", qtyX, y + 5, { width: 30, align: "right" })
        .text(formatMoney(item.amount), taxableX, y + 5, { width: 65, align: "right" })
        .text(`${formatMoney(lineTax)} (18%)`, taxX, y + 5, { width: 65, align: "right" })
        .text(formatMoney(lineTotal), amountX, y + 5, { width: 50, align: "right" });

      y += rowHeight;
    });

    // ================= TOTAL =================
    const taxable = amount;
    const cgst = taxable * 0.09;
    const sgst = taxable * 0.09;
    const totalWithTax = taxable + cgst + sgst;

    y += 20;

    doc.text("Taxable Amount", 330, y, { width: 90, align: "right" });
    doc.text(`${RS}${formatMoney(taxable)}`, 430, y, { width: 90, align: "right" });
    doc.text("CGST 9.0%", 330, y + 12, { width: 90, align: "right" });
    doc.text(`${RS}${formatMoney(cgst)}`, 430, y + 12, { width: 90, align: "right" });
    doc.text("SGST 9.0%", 330, y + 24, { width: 90, align: "right" });
    doc.text(`${RS}${formatMoney(sgst)}`, 430, y + 24, { width: 90, align: "right" });

    doc.fontSize(10).text("Total", 330, y + 42, { width: 90, align: "right" });
    doc.text(`${RS}${formatMoney(totalWithTax)}`, 430, y + 42, { width: 90, align: "right" });

    doc
      .fontSize(8)
      .text(
        `In Words: ${converter.toWords(totalWithTax)} Rupees Only`,
        margin,
        y + 20,
      );

    // ================= BANK + QR =================
    y += 80;

    doc.rect(margin, y, tableWidth, 120).stroke();

    try {
      doc.image(qrPath, margin + 10, y + 10, { width: 90 });
    } catch {}

    doc
      .fontSize(8)
      .text("Bank: Kotak Mahindra Bank", margin + 120, y + 15)
      .text("A/C: 5145057933", margin + 120, y + 35)
      .text("IFSC: KKBK0001379", margin + 120, y + 55);

    doc.text("Authorized Signatory", 400, y + 90);

    // ================= NOTES =================
    y += 130;

    doc.fontSize(9).text("Notes:", margin, y);
    doc
      .fontSize(8)
      .text(
        "This invoice details the charges for products/services added at deal closure.",
        margin,
        y + 15,
      )
      .text(
        "Website balance payment is updated in the invoice.",
        margin,
        y + 30,
      );

    doc.end();
  });
});

app.post("/api/invoices/send-email", async (req, res) => {
  const leadId = Number(req.body?.leadId || 0);
  const invoiceType = String(req.body?.invoiceType || "")
    .trim()
    .toLowerCase();
  const toEmail = String(req.body?.toEmail || "").trim();

  if (!leadId) {
    return res.status(400).json({
      success: false,
      message: "Lead ID is required",
    });
  }

  if (!["tax", "proforma"].includes(invoiceType)) {
    return res.status(400).json({
      success: false,
      message: "Invalid invoice type",
    });
  }

  if (!toEmail) {
    return res.status(400).json({
      success: false,
      message: "Recipient email is required",
    });
  }

  try {
    const [rows] = await dbPromise.query(
      `
        SELECT id, company_name, client_name
        FROM leads
        WHERE id = ?
        LIMIT 1
      `,
      [leadId],
    );

    if (!rows.length) {
      return res.status(404).json({
        success: false,
        message: "Lead not found",
      });
    }

    const lead = rows[0];
    const isTaxInvoice = invoiceType === "tax";
    const invoiceLabel = isTaxInvoice ? "Tax Invoice" : "Proforma Invoice";
    const invoicePath = isTaxInvoice ? "tax-invoice" : "invoice";
    const invoiceUrl = `${resolveAppBaseUrl(req)}/api/${invoicePath}/${leadId}`;
    const pdfResponse = await fetch(invoiceUrl, {
      headers: {
        Accept: "application/pdf",
      },
    });

    if (!pdfResponse.ok) {
      throw new Error("Failed to generate invoice PDF");
    }

    const pdfBuffer = Buffer.from(await pdfResponse.arrayBuffer());
    const invoiceFileName = isTaxInvoice
      ? `tax_invoice_${leadId}.pdf`
      : `proforma_invoice_${leadId}.pdf`;
    const companyLabel = String(lead.company_name || lead.client_name || `Lead ${leadId}`).trim();
    const subject = `${invoiceLabel} - ${companyLabel}`;
    const plainText = [
      `Hi,`,
      ``,
      `Please find the attached ${invoiceLabel.toLowerCase()} for ${companyLabel}.`,
      ``,
      `Regards,`,
      `Metrics Mart Accounts`,
    ].join("\n");
    const html = `
      <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111827;max-width:640px;margin:0 auto;padding:24px;">
        <h2 style="margin:0 0 16px;color:#0f172a;">${escapeProfileSetupEmailHtml(invoiceLabel)}</h2>
        <p style="margin:0 0 12px;">Hi,</p>
        <p style="margin:0 0 16px;">
          Please find the attached ${escapeProfileSetupEmailHtml(invoiceLabel.toLowerCase())}
          for <strong>${escapeProfileSetupEmailHtml(companyLabel)}</strong>.
        </p>
        <p style="margin:0;">Regards,<br />Metrics Mart Accounts</p>
      </div>
    `;

    const emailDispatch = await sendEmailViaApi({
      to: toEmail,
      subject,
      text: plainText,
      html,
      attachments: [
        {
          filename: invoiceFileName,
          content: pdfBuffer,
          contentType: "application/pdf",
        },
      ],
    });

    if (!emailDispatch.sent) {
      return res.status(503).json({
        success: false,
        message: emailDispatch.message || "Invoice email could not be sent.",
        missingConfig: emailDispatch.missingConfig || [],
        emailError: emailDispatch.emailError || null,
      });
    }

    return res.json({
      success: true,
      message: `${invoiceLabel} PDF emailed successfully to ${toEmail}.`,
      provider: "resend",
    });
  } catch (error) {
    console.error("Invoice email send failed:", error);
    return res.status(500).json({
      success: false,
      message:
        error?.message || "Failed to send invoice email attachment",
    });
  }
});

async function getProposalById(proposalId, companyScope = "") {
  try {
    await ensureProposalTables();
  } catch (schemaErr) {
    console.warn("Proposal fetch schema setup skipped:", schemaErr.message);
  }

  const numericProposalId = Number(proposalId);
  if (!Number.isFinite(numericProposalId) || numericProposalId <= 0) {
    return null;
  }

  const idColumn = await getFirstExistingColumn("proposals", ["id", "proposal_id"]);
  if (!idColumn) {
    return null;
  }
  const hasCreatedByColumn = await schemaColumnExists("proposals", "created_by");
  const hasCompanyScopeColumn = await schemaColumnExists("proposals", "company_scope");
  const hasUserNameColumn = await schemaColumnExists("users", "name");
  const hasUserCompanyColumn = await schemaColumnExists("users", "comp_name");
  const normalizedScope = normalizeLoginCompanyKey(companyScope);
  const whereParts = [`p.${quoteDbIdentifier(idColumn)} = ?`];
  const params = [numericProposalId];

  if (hasCompanyScopeColumn && normalizedScope) {
    const scopeValues =
      normalizedScope === "redsea"
        ? ["redsea", "redseainfolinepvtltd"]
        : normalizedScope === "metrics"
          ? ["metrics", "metricsmart", "metricsmartinfolinepvtltd"]
          : [normalizedScope];
    const scopePlaceholders = scopeValues.map(() => "?").join(", ");
    whereParts.push(`
      (
        LOWER(REPLACE(TRIM(COALESCE(p.company_scope, '')), ' ', '')) IN (${scopePlaceholders})
        OR TRIM(COALESCE(p.company_scope, '')) = ''
      )
    `);
    params.push(...scopeValues);
  }

  const userJoinSql =
    hasCreatedByColumn && hasUserNameColumn
      ? "LEFT JOIN users u ON u.id = p.created_by"
      : "";
  const createdByNameSql =
    hasCreatedByColumn && hasUserNameColumn
      ? "u.name AS created_by_name"
      : "NULL AS created_by_name";
  const createdByCompanySql =
    hasCreatedByColumn && hasUserNameColumn && hasUserCompanyColumn
      ? "u.comp_name AS created_by_company"
      : "NULL AS created_by_company";

  const [rows] = await dbPromise.query(
    `
      SELECT
        p.*,
        p.${quoteDbIdentifier(idColumn)} AS id,
        ${createdByNameSql},
        ${createdByCompanySql}
      FROM proposals p
      ${userJoinSql}
      WHERE ${whereParts.join(" AND ")}
      LIMIT 1
    `,
    params,
  );

  return rows[0] || null;
}

app.get("/api/proposal-templates", async (req, res) => {
  try {
    await ensureProposalTables();
    const [rows] = await dbPromise.query(
      `
        SELECT id, template_name, category, content, status, created_at, updated_at
        FROM proposal_templates
        ORDER BY created_at DESC, id DESC
      `,
    );

    return res.json({ success: true, data: rows });
  } catch (error) {
    console.error("Proposal templates fetch error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to load proposal templates",
    });
  }
});

app.post("/api/proposal-templates", async (req, res) => {
  try {
    await ensureProposalTables();
    const templateName = String(req.body?.template_name || "").trim();
    const category = String(req.body?.category || "CRM").trim() || "CRM";
    const content = normalizeProposalText(req.body?.content);
    const status = String(req.body?.status || "active").trim().toLowerCase();

    if (!templateName || !content) {
      return res.status(400).json({
        success: false,
        message: "Template name and content are required",
      });
    }

    const [result] = await dbPromise.query(
      `
        INSERT INTO proposal_templates (template_name, category, content, status)
        VALUES (?, ?, ?, ?)
      `,
      [templateName, category, content, status === "inactive" ? "inactive" : "active"],
    );

    return res.json({
      success: true,
      id: result.insertId,
      message: "Proposal template saved successfully",
    });
  } catch (error) {
    console.error("Proposal template save error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to save proposal template",
    });
  }
});

app.put("/api/proposal-templates/:id", async (req, res) => {
  try {
    await ensureProposalTables();
    const templateName = String(req.body?.template_name || "").trim();
    const category = String(req.body?.category || "CRM").trim() || "CRM";
    const content = normalizeProposalText(req.body?.content);
    const status = String(req.body?.status || "active").trim().toLowerCase();

    if (!templateName || !content) {
      return res.status(400).json({
        success: false,
        message: "Template name and content are required",
      });
    }

    const [result] = await dbPromise.query(
      `
        UPDATE proposal_templates
        SET template_name = ?, category = ?, content = ?, status = ?
        WHERE id = ?
      `,
      [
        templateName,
        category,
        content,
        status === "inactive" ? "inactive" : "active",
        req.params.id,
      ],
    );

    if (!result.affectedRows) {
      return res.status(404).json({
        success: false,
        message: "Proposal template not found",
      });
    }

    return res.json({
      success: true,
      message: "Proposal template updated successfully",
    });
  } catch (error) {
    console.error("Proposal template update error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update proposal template",
    });
  }
});

app.post("/api/generate-proposal", async (req, res) => {
  try {
    await ensureProposalTables();
    const payload = {
      client_name: String(req.body?.client_name || "").trim(),
      client_email: String(req.body?.client_email || req.body?.email || "").trim(),
      company_name: String(req.body?.company_name || "").trim(),
      project_topic: String(req.body?.project_topic || "").trim(),
      requirement_details: String(req.body?.requirement_details || "").trim(),
      budget: String(req.body?.budget || "").trim(),
      timeline: String(req.body?.timeline || "").trim(),
      technology: String(req.body?.technology || "Core PHP + MySQL").trim(),
      notes: String(req.body?.notes || "").trim(),
      company_scope:
        normalizeLoginCompanyKey(
          req.body?.company_scope ||
            req.body?.company_key ||
            req.body?.selected_company ||
            req.body?.comp_name,
        ) || "metrics",
    };
    const createdBy = Number(req.body?.created_by || 0) || null;

    if (!payload.client_name || !payload.company_name || !payload.project_topic) {
      return res.status(400).json({
        success: false,
        message: "Client name, company name, and project topic are required",
      });
    }

    const [exactTemplates] = await dbPromise.query(
      `
        SELECT content
        FROM proposal_templates
        WHERE template_name LIKE ? AND status = 'active'
        ORDER BY id DESC
        LIMIT 1
      `,
      [`%${payload.project_topic}%`],
    );

    let templateContent = exactTemplates[0]?.content || "";

    if (!templateContent) {
      const [defaultTemplates] = await dbPromise.query(
        `
          SELECT content
          FROM proposal_templates
          WHERE status = 'active' AND (
            template_name LIKE '%Default CRM%' OR category = 'CRM'
          )
          ORDER BY template_name LIKE '%Default CRM%' DESC, id DESC
          LIMIT 1
        `,
      );
      templateContent = defaultTemplates[0]?.content || "";
    }

    const proposalContent = templateContent
      ? applyProposalPlaceholders(templateContent, payload)
      : buildDefaultProposalContent(payload);

    const [result] = await dbPromise.query(
      `
        INSERT INTO proposals
          (client_name, client_email, company_name, project_topic, requirement_details, budget, timeline, technology, notes, company_scope, proposal_content, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        payload.client_name,
        payload.client_email,
        payload.company_name,
        payload.project_topic,
        payload.requirement_details,
        payload.budget,
        payload.timeline,
        payload.technology,
        payload.notes,
        payload.company_scope,
        proposalContent,
        createdBy,
      ],
    );

    return res.json({
      success: true,
      proposal_id: result.insertId,
      proposal_content: proposalContent,
      company_scope: payload.company_scope,
    });
  } catch (error) {
    console.error("Proposal generate error:", error);
    return res.status(500).json({
      success: false,
      message: "Proposal generate error",
    });
  }
});

app.get("/api/proposals", async (req, res) => {
  try {
    try {
      await ensureProposalTables();
    } catch (schemaErr) {
      console.warn("Proposal list schema setup skipped:", schemaErr.message);
    }

    const createdBy = Number(req.query?.created_by || 0);
    const params = [];
    const whereParts = [];
    const columnNames = [
      "id",
      "proposal_id",
      "client_name",
      "client_email",
      "company_name",
      "project_topic",
      "status",
      "created_at",
      "updated_at",
      "created_by",
    ];
    const existingColumns = new Set();

    for (const columnName of columnNames) {
      if (await schemaColumnExists("proposals", columnName)) {
        existingColumns.add(columnName);
      }
    }

    const selectProposalColumn = (columnName, alias = columnName, fallback = "NULL") =>
      existingColumns.has(columnName)
        ? `p.${quoteDbIdentifier(columnName)} AS ${quoteDbIdentifier(alias)}`
        : `${fallback} AS ${quoteDbIdentifier(alias)}`;
    const selectProposalId = () => {
      if (existingColumns.has("id")) return "p.id AS id";
      if (existingColumns.has("proposal_id")) return "p.proposal_id AS id";
      return "0 AS id";
    };
    const selectProposalRawId = () => {
      if (existingColumns.has("proposal_id")) return "p.proposal_id AS proposal_id";
      if (existingColumns.has("id")) return "p.id AS proposal_id";
      return "NULL AS proposal_id";
    };

    if (createdBy && existingColumns.has("created_by")) {
      whereParts.push("p.created_by = ?");
      params.push(createdBy);
    }

    const whereSql = whereParts.length ? `WHERE ${whereParts.join(" AND ")}` : "";
    const userJoinSql = existingColumns.has("created_by")
      ? "LEFT JOIN users u ON u.id = p.created_by"
      : "";
    const orderSql = [
      existingColumns.has("created_at") ? "p.created_at DESC" : "",
      existingColumns.has("id") ? "p.id DESC" : "",
      !existingColumns.has("id") && existingColumns.has("proposal_id") ? "p.proposal_id DESC" : "",
    ].filter(Boolean).join(", ");
    const selectSql = `
      SELECT
        ${selectProposalId()},
        ${selectProposalRawId()},
        ${selectProposalColumn("client_name")},
        ${selectProposalColumn("client_email")},
        ${selectProposalColumn("company_name")},
        ${selectProposalColumn("project_topic")},
        NULL AS company_scope,
        ${selectProposalColumn("status", "status", "'draft'")},
        ${selectProposalColumn("created_at")},
        ${selectProposalColumn("updated_at")},
        ${existingColumns.has("created_by") ? "u.name" : "NULL"} AS created_by_name,
        ${existingColumns.has("created_by") ? "u.comp_name" : "NULL"} AS created_by_company
      FROM proposals p
      ${userJoinSql}
      ${whereSql}
      ${orderSql ? `ORDER BY ${orderSql}` : ""}
    `;

    const [rows] = await dbPromise.query(selectSql, params);

    return res.json({ success: true, data: rows });
  } catch (error) {
    console.error("Proposal list error:", error);
    if (["ER_BAD_FIELD_ERROR", "ER_NO_SUCH_TABLE"].includes(error.code)) {
      return res.json({ success: true, data: [] });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to load proposals",
    });
  }
});

app.get("/api/proposals/:id", async (req, res) => {
  try {
    const proposal = await getProposalById(req.params.id, getRequestedCompanyScope(req));
    if (!proposal) {
      return res.status(404).json({
        success: false,
        message: "Proposal not found",
      });
    }

    return res.json({ success: true, data: proposal });
  } catch (error) {
    console.error("Proposal fetch error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to load proposal",
    });
  }
});

app.put("/api/proposals/:id", async (req, res) => {
  try {
    await ensureProposalTables();
    const proposalContent = normalizeProposalText(req.body?.proposal_content);
    const status = String(req.body?.status || "draft").trim().toLowerCase();
    const body = req.body || {};
    const proposalScopeSql = getCompanyProposalScopeSql(
      body.company_scope ||
        body.company_key ||
        body.selected_company ||
        body.comp_name ||
        getRequestedCompanyScope(req),
      "p",
    );
    const optionalProposalField = (fieldName) =>
      Object.prototype.hasOwnProperty.call(body, fieldName)
        ? String(body[fieldName] || "").trim()
        : null;

    if (!proposalContent) {
      return res.status(400).json({
        success: false,
        message: "Proposal content is required",
      });
    }

    const [result] = await dbPromise.query(
      `
        UPDATE proposals
        SET client_name = COALESCE(?, client_name),
            client_email = COALESCE(?, client_email),
            company_name = COALESCE(?, company_name),
            project_topic = COALESCE(?, project_topic),
            requirement_details = COALESCE(?, requirement_details),
            budget = COALESCE(?, budget),
            timeline = COALESCE(?, timeline),
            technology = COALESCE(?, technology),
            notes = COALESCE(?, notes),
            company_scope = COALESCE(?, company_scope),
            proposal_content = ?,
            status = ?
        WHERE id = ?
        ${proposalScopeSql ? `AND ${proposalScopeSql}` : ""}
      `,
      [
        optionalProposalField("client_name"),
        optionalProposalField("client_email"),
        optionalProposalField("company_name"),
        optionalProposalField("project_topic"),
        optionalProposalField("requirement_details"),
        optionalProposalField("budget"),
        optionalProposalField("timeline"),
        optionalProposalField("technology"),
        optionalProposalField("notes"),
        normalizeLoginCompanyKey(
          body.company_scope ||
            body.company_key ||
            body.selected_company ||
            body.comp_name,
        ) || null,
        proposalContent,
        status || "draft",
        req.params.id,
      ],
    );

    if (!result.affectedRows) {
      return res.status(404).json({
        success: false,
        message: "Proposal not found",
      });
    }

    return res.json({
      success: true,
      message: "Proposal updated successfully",
    });
  } catch (error) {
    console.error("Proposal update error:", error);
    return res.status(500).json({
      success: false,
      message: "Proposal update error",
    });
  }
});

app.get("/api/proposals/:id/pdf", async (req, res) => {
  try {
    const proposal = await getProposalById(req.params.id, getRequestedCompanyScope(req));
    if (!proposal) {
      return res.status(404).json({
        success: false,
        message: "Proposal not found",
      });
    }

    const fileName = `proposal_${proposal.id}.pdf`;
    const pdfBuffer = await buildProposalPdfBuffer(proposal);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    return res.send(pdfBuffer);
  } catch (error) {
    console.error("Proposal PDF error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to generate proposal PDF",
    });
  }
});

app.get("/api/proposals/:id/word", async (req, res) => {
  try {
    const proposal = await getProposalById(req.params.id, getRequestedCompanyScope(req));
    if (!proposal) {
      return res.status(404).json({
        success: false,
        message: "Proposal not found",
      });
    }

    const fileName = `proposal_${proposal.id}.doc`;
    const letterhead = getProposalLetterheadConfig(proposal);
    const headerDataUri = getProposalLetterheadDataUri(letterhead.headerPath);
    const footerDataUri = getProposalLetterheadDataUri(letterhead.footerPath);
    const headerHtml = headerDataUri
      ? `<img src="${headerDataUri}" alt="${escapeProfileSetupEmailHtml(letterhead.brandName)} header" style="display:block;width:100%;height:auto;">`
      : "";
    const footerHtml = footerDataUri
      ? `<img src="${footerDataUri}" alt="${escapeProfileSetupEmailHtml(letterhead.brandName)} footer" style="display:block;width:100%;height:auto;">`
      : "";
    const html = `
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>${escapeProfileSetupEmailHtml(proposal.project_topic || "Proposal")}</title>
          <style>
            @page { size: A4; margin: 0; }
            body { margin: 0; font-family: Arial, sans-serif; color: #111827; line-height: 1.55; background: #ffffff; }
            .proposal-letterhead { display: block; width: 100%; height: auto; }
            .proposal-content { padding: 24px 52px 28px; }
            .proposal-content h1, .proposal-content p { page-break-inside: avoid; }
          </style>
        </head>
        <body style="margin:0;font-family:Arial,sans-serif;color:#111827;line-height:1.55;background:#ffffff;">
          ${headerHtml.replace("style=\"display:block;width:100%;height:auto;\"", "class=\"proposal-letterhead\"")}
          <main class="proposal-content" style="padding:24px 52px 28px;">
            <h1 style="text-align:center;color:#0f172a;">${escapeProfileSetupEmailHtml(proposal.project_topic || "Project Proposal")}</h1>
            <p><strong>Client:</strong> ${escapeProfileSetupEmailHtml(proposal.client_name || "-")}</p>
            <p><strong>Company:</strong> ${escapeProfileSetupEmailHtml(proposal.company_name || "-")}</p>
            ${renderProposalHtml(proposal.proposal_content, proposal)}
          </main>
          ${footerHtml.replace("style=\"display:block;width:100%;height:auto;\"", "class=\"proposal-letterhead\"")}
        </body>
      </html>
    `;

    res.setHeader("Content-Type", "application/msword; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
    return res.send(html);
  } catch (error) {
    console.error("Proposal Word error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to generate proposal Word file",
    });
  }
});

app.post("/api/proposals/:id/send-email", async (req, res) => {
  const toEmail = String(req.body?.toEmail || req.body?.to_email || "").trim();

  if (!toEmail) {
    return res.status(400).json({
      success: false,
      message: "Recipient email is required",
    });
  }

  try {
    const proposal = await getProposalById(req.params.id, getRequestedCompanyScope(req));
    if (!proposal) {
      return res.status(404).json({
        success: false,
        message: "Proposal not found",
      });
    }

    const companyLabel = String(
      proposal.company_name || proposal.client_name || `Proposal ${proposal.id}`,
    ).trim();
    const subject = `Project Proposal - ${companyLabel}`;
    const text = [
      "Hi,",
      "",
      `Please find the attached project proposal PDF for ${companyLabel}.`,
      "",
      "Regards,",
      "Metrics Mart",
    ].join("\n");
    const html = `
      <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111827;max-width:760px;margin:0 auto;padding:24px;">
        <h2 style="margin:0 0 16px;color:#0f172a;">Project Proposal</h2>
        <p style="margin:0 0 12px;">Hi,</p>
        <p style="margin:0 0 16px;">
          Please find the attached project proposal PDF for
          <strong>${escapeProfileSetupEmailHtml(companyLabel)}</strong>.
        </p>
        <p style="margin:0;">Regards,<br />Metrics Mart</p>
      </div>
    `;
    const pdfBuffer = await buildProposalPdfBuffer(proposal);
    const pdfFileName = `proposal_${proposal.id}.pdf`;
    const attachments = [
      {
        filename: pdfFileName,
        content: pdfBuffer,
        contentType: "application/pdf",
      },
    ];

    const apiDispatch = await sendEmailViaApi({
      to: toEmail,
      subject,
      text,
      html,
      attachments,
    });

    if (apiDispatch.sent) {
      return res.json({
        success: true,
        message: `Proposal PDF emailed successfully to ${toEmail}.`,
        provider: apiDispatch.provider || "email-api",
      });
    }

    return res.status(503).json({
      success: false,
      message: apiDispatch.message || "Proposal email could not be sent.",
      emailError: apiDispatch.emailError || null,
      missingConfig: apiDispatch.missingConfig || [],
    });
  } catch (error) {
    console.error("Proposal email send failed:", error);
    return res.status(500).json({
      success: false,
      message: error?.message || "Failed to send proposal email",
    });
  }
});

app.post("/api/proposals/:id/send-whatsapp", async (req, res) => {
  const phone = String(req.body?.phone || req.body?.whatsapp || req.body?.contact || "").trim();

  if (!phone) {
    return res.status(400).json({
      success: false,
      message: "Client WhatsApp number is required",
    });
  }

  try {
    const proposal = await getProposalById(req.params.id, getRequestedCompanyScope(req));
    if (!proposal) {
      return res.status(404).json({
        success: false,
        message: "Proposal not found",
      });
    }

    const dispatch = await sendProposalPdfViaWhatsapp(req, proposal, phone);

    return res.json({
      success: true,
      message: `Proposal PDF sent on WhatsApp to ${dispatch.to}.`,
      provider: "whatsapp-cloud-api",
      data: dispatch,
    });
  } catch (error) {
    console.error("Proposal WhatsApp send failed:", error);
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error?.message || "Failed to send proposal PDF on WhatsApp",
      missingConfig: error.missingConfig || [],
    });
  }
});

// ====================== UPDATE PAYMENT STATUS ======================
app.put("/api/payment-status/:id", (req, res) => {
  const leadId = req.params.id;
  const { pay_stat } = req.body;

  if (!["pending", "received", "failed"].includes(pay_stat)) {
    return res.status(400).json({
      successes: false,
      message: "Invalid payment status",
    });
  }

  const sql = `UPDATE leads SET pay_stat = ? WHERE id = ?`;

  db.query(sql, [pay_stat, leadId], (err, result) => {
    if (err) {
      console.error("Payment Status Update Error:", err);
      return res.status(500).json({
        success: false,
        message: "Database error",
      });
    }

    res.json({
      success: true,
      message: "Payment status updated successfully",
    });
  });
});

function downloadTextInvoice(id) {
  window.location.href = `${BASE_URL}/api/tax-invoice/${id}`;
}
app.post("/api/razorpay/order", async (req, res) => {
  try {
    const { amount } = req.body;
    const numericAmount = Number(String(amount).replace(/,/g, ""));

    if (!numericAmount || numericAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Valid amount is required",
      });
    }

    const order = await razorpay.orders.create({
      amount: Math.round(numericAmount * 100),
      currency: "INR",
      receipt: `receipt_${Date.now()}`,
    });

    res.json({
      success: true,
      key_id: process.env.RAZORPAY_KEY_ID,
      order,
    });
  } catch (err) {
    console.error("Razorpay Order Error:", err);
    const razorpayMessage =
      err.error?.description ||
      err.error?.reason ||
      err.error?.field ||
      err.message ||
      "Failed to create Razorpay order";

    res.status(500).json({
      success: false,
      message: razorpayMessage,
      error: err.error || null,
    });
  }
});

app.post("/api/razorpay/verify", (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body || {};

  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return res.status(400).json({
      success: false,
      message: "Payment verification data is missing",
    });
  }

  const expectedSignature = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest("hex");

  if (expectedSignature !== razorpay_signature) {
    return res.status(400).json({
      success: false,
      message: "Invalid Razorpay signature",
    });
  }

  res.json({ success: true });
});

app.listen(PORT, () => {
  console.log(
    `Server running on port ${PORT}${PUBLIC_APP_URL ? ` (${PUBLIC_APP_URL})` : ""}`,
  );
});
