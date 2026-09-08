
require("dotenv").config({ override: true });
process.env.TZ = "Asia/Kolkata";
const Razorpay = require("razorpay");
const crypto = require("crypto");
const express = require("express");
const cors = require("cors");
const mysql = require("mysql2");
const multer = require("multer");
let nodemailer = null;
try {
  nodemailer = require("nodemailer");
} catch (err) {
  if (err.code !== "MODULE_NOT_FOUND") throw err;
}
const path = require("path");
const fs = require("fs");
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

    if (key) {
      process.env[key] = value;
    }
  });
}

loadLocalEnv();

const PORT = Number(process.env.PORT || 3000);

const configuredOrigins = String(
  process.env.ALLOWED_ORIGINS || process.env.CLIENT_ORIGIN || "",
)
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const allowedOrigins = new Set([
  "null",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "https://metrics-mart.onrender.com",
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

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const DEAL_PRODUCT_CATALOG = [
  { name: "GMB SEO", price: 15000, group: "SEO Services" },
  { name: "Website SEO", price: 15000, group: "SEO Services" },
  { name: "SEO Additional Keyword", price: 1500, group: "SEO Services" },
  { name: "Profile Creation", price: 10000, group: "SEO Services" },
  {
    name: "Google Ads Management",
    price: 10000,
    group: "Advertising Services",
  },
  {
    name: "Meta Organic Management",
    price: 10000,
    group: "Advertising Services",
  },
  {
    name: "Meta Ads + Management",
    price: 15000,
    group: "Advertising Services",
  },
  { name: "Landing Page", price: 5000, group: "Website Development Services" },
  {
    name: "Static Website",
    price: 10000,
    group: "Website Development Services",
  },
  {
    name: "Dynamic Website",
    price: 20000,
    group: "Website Development Services",
  },
];

const DEAL_PRODUCT_PRICES = new Map(
  DEAL_PRODUCT_CATALOG.map((product) => [product.name, product.price]),
);

const DEAL_INVOICE_SERVICE_DESCRIPTIONS = {
  "GMB SEO":
    "Optimizes Google Business Profile for better visibility on Search and Maps.",
  "Website SEO":
    "Improves website visibility on Google with keyword, on-page and technical optimization.",
  "SEO Additional Keyword":
    "Adds extra keywords to the SEO scope for wider ranking coverage.",
  "Profile Creation":
    "Creates and optimizes business profiles on relevant online platforms.",
  "Google Ads Management":
    "Setup and management of Google Ads campaigns with targeting and performance optimization.",
  "Meta Organic Management":
    "Plans and manages organic Facebook/Instagram content for regular brand visibility.",
  "Meta Ads + Management":
    "Runs paid Meta campaigns with audience targeting, creatives and performance monitoring.",
  "Landing Page":
    "Single-page campaign website focused on enquiries or lead capture.",
  "Static Website":
    "Fast informational website for company profile, services and contact details.",
  "Dynamic Website":
    "Editable and interactive website with flexible pages and better user experience.",
  "ERP/CRM/Software":
    "Custom software to manage workflows, leads, customers and reports in one system.",
  "E-commerce Website":
    "Online store with product catalogue, cart, checkout/payment and admin management.",
  "SMO Service":
    "Manages social media presence with planned content, captions and page optimization.",
  "Software Development":
    "Custom software development for business workflows, dashboards and automation.",
};

const GMB_SEO_BASE_KEYWORDS = 10;
const GMB_SEO_KEYWORD_RATE = 1500;

const VARIABLE_DEAL_PRODUCT_CONFIG = new Map([
  ["erp/crm/software", { amountField: "erp_amount" }],
  ["erp/crm", { amountField: "erp_amount" }],
  ["e-commerce website", { amountField: "ecom_amount" }],
  ["e-commerce", { amountField: "ecom_amount" }],
  ["ecommerce website", { amountField: "ecom_amount" }],
  ["ecommerce", { amountField: "ecom_amount" }],
]);

function getDealProductKey(name) {
  return String(name || "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function getDealProductMatchKey(name) {
  return String(name || "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "")
    .trim();
}

const DEAL_PRODUCT_ALIAS_KEYS = new Map([
  ["gmb", "GMB SEO"],
  ["gmbseo", "GMB SEO"],
  ["googlebusinessprofile", "GMB SEO"],
  ["googlebusinessprofileseo", "GMB SEO"],
  ["googlemybusiness", "GMB SEO"],
  ["googlemybusinessseo", "GMB SEO"],
  ["websiteseo", "Website SEO"],
  ["webseo", "Website SEO"],
  ["seowebsite", "Website SEO"],
  ["website", "Static Website"],
  ["staticwebsite", "Static Website"],
  ["staticweb", "Static Website"],
  ["dynamicwebsite", "Dynamic Website"],
  ["dynamicweb", "Dynamic Website"],
  ["landingpage", "Landing Page"],
  ["additionalkeyword", "SEO Additional Keyword"],
  ["seoadditionalkeyword", "SEO Additional Keyword"],
  ["extrakeyword", "SEO Additional Keyword"],
  ["profilecreation", "Profile Creation"],
  ["businessprofilecreation", "Profile Creation"],
  ["googleprofile", "Profile Creation"],
  ["googleprofilecreation", "Profile Creation"],
  ["googleads", "Google Ads Management"],
  ["googleadsmanagement", "Google Ads Management"],
  ["ppc", "Google Ads Management"],
  ["metaorganic", "Meta Organic Management"],
  ["metaorganicmanagement", "Meta Organic Management"],
  ["smo", "SMO Service"],
  ["smoservice", "SMO Service"],
  ["socialmediaoptimization", "SMO Service"],
  ["socialmediaoptimisation", "SMO Service"],
  ["metaads", "Meta Ads + Management"],
  ["metaadsmanagement", "Meta Ads + Management"],
  ["metaadsandmanagement", "Meta Ads + Management"],
  ["facebookads", "Meta Ads + Management"],
  ["instagramads", "Meta Ads + Management"],
  ["erpcrmsoftware", "ERP/CRM/Software"],
  ["erpcrm", "ERP/CRM/Software"],
  ["software", "ERP/CRM/Software"],
  ["crmsoftware", "ERP/CRM/Software"],
  ["ecommerce", "E-commerce Website"],
  ["ecommercewebsite", "E-commerce Website"],
  ["ecommerceweb", "E-commerce Website"],
]);

function getVariableDealProductConfig(name) {
  const key = getDealProductKey(name);
  const aliasedName = DEAL_PRODUCT_ALIAS_KEYS.get(getDealProductMatchKey(name));
  return (
    VARIABLE_DEAL_PRODUCT_CONFIG.get(key) ||
    VARIABLE_DEAL_PRODUCT_CONFIG.get(getDealProductKey(aliasedName || "")) ||
    null
  );
}

function resolveDealProductCatalogName(name, productPrices = new Map()) {
  const rawName = String(name || "")
    .trim()
    .replace(/\s+/g, " ");
  if (!rawName) return "";
  if (productPrices.has(rawName)) return rawName;

  const matchKey = getDealProductMatchKey(rawName);
  const aliasedName = DEAL_PRODUCT_ALIAS_KEYS.get(matchKey);
  if (aliasedName) return aliasedName;

  for (const productName of productPrices.keys()) {
    if (getDealProductMatchKey(productName) === matchKey) return productName;
  }

  return aliasedName || rawName;
}

function getDealProductInputName(item) {
  if (typeof item === "string") return item;
  return String(
    item?.name ||
      item?.product_name ||
      item?.productName ||
      item?.service_name ||
      item?.serviceName ||
      item?.value ||
      item?.label ||
      item?.title ||
      "",
  ).trim();
}

function getDealProductNumberValue(...values) {
  for (const value of values) {
    if (value === null || value === undefined || value === "") continue;
    const numericValue = Number(value);
    if (Number.isFinite(numericValue)) return numericValue;
  }
  return NaN;
}

function getGmbSeoKeywordCount(item = {}, source = {}) {
  const keywordCount = getDealProductNumberValue(
    item?.keywordCount,
    item?.keyword_count,
    item?.keywords,
    item?.gmb_keyword_count,
    item?.gmbKeywordCount,
    source?.gmb_keyword_count,
    source?.gmbKeywordCount,
    source?.keywordCount,
    source?.keyword_count,
    source?.keywords,
  );

  return Math.max(
    GMB_SEO_BASE_KEYWORDS,
    Math.floor(
      Number.isFinite(keywordCount) ? keywordCount : GMB_SEO_BASE_KEYWORDS,
    ),
  );
}

function normalizeDealProductsInput(value) {
  if (Array.isArray(value)) return value;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return [];
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) return parsed;
    } catch (_err) {
      return trimmed
        .split(",")
        .map((name) => name.trim())
        .filter(Boolean);
    }
  }
  return [];
}

function resolveDealProductPricing(item, productPrices, source = {}) {
  const inputName = getDealProductInputName(item);
  const name = resolveDealProductCatalogName(inputName, productPrices);
  if (!name) {
    return { valid: false, message: "Invalid product selected" };
  }

  if (name === "GMB SEO") {
    const keywordCount = getGmbSeoKeywordCount(item, source);
    const amount = roundServerAmount(keywordCount * GMB_SEO_KEYWORD_RATE);

    return {
      valid: true,
      name,
      amount,
      standardAmount: amount,
      isVariableAmount: false,
      keywordCount,
      keywordRate: GMB_SEO_KEYWORD_RATE,
    };
  }

  const variableConfig = getVariableDealProductConfig(name);
  if (variableConfig) {
    const customAmount = roundServerAmount(
      source[variableConfig.amountField] ??
        item.amount ??
        item.price ??
        item.standardAmount,
    );

    if (!Number.isFinite(customAmount) || customAmount <= 0) {
      return {
        valid: false,
        message: `Please enter amount for ${name}`,
      };
    }

    return {
      valid: true,
      name,
      amount: customAmount,
      standardAmount: customAmount,
      isVariableAmount: true,
    };
  }

  const standardAmount = Number(
    productPrices.get(name) ?? item.amount ?? item.price ?? item.standardAmount,
  );
  if (!Number.isFinite(standardAmount) || standardAmount <= 0) {
    return { valid: false, message: "Invalid product selected" };
  }

  return {
    valid: true,
    name,
    amount: roundServerAmount(standardAmount),
    standardAmount: roundServerAmount(standardAmount),
    isVariableAmount: false,
  };
}

function calculateDealProductsQuote(products, productPrices, source = {}) {
  const items = [];
  let total = 0;

  if (!Array.isArray(products) || products.length === 0) {
    return {
      valid: false,
      message: "Select at least one product first",
    };
  }

  for (const item of products) {
    const resolved = resolveDealProductPricing(item, productPrices, source);

    if (!resolved.valid) {
      return {
        valid: false,
        message: resolved.message,
      };
    }

    total += resolved.standardAmount;
    items.push({
      name: resolved.name,
      amount: resolved.amount,
      standardAmount: resolved.standardAmount,
      isVariableAmount: resolved.isVariableAmount,
      ...(resolved.keywordCount
        ? {
            keywordCount: resolved.keywordCount,
            keywordRate: resolved.keywordRate,
          }
        : {}),
    });
  }

  return {
    valid: true,
    items,
    total: roundServerAmount(total),
  };
}

async function getDealProductPriceMap() {
  try {
    const products = await getDealProductCatalog({ includeInactive: false });
    if (products.length) {
      return new Map(products.map((product) => [product.name, product.price]));
    }
  } catch (err) {
    console.warn("Deal product catalog fallback:", err.message || err);
  }

  return DEAL_PRODUCT_PRICES;
}

async function validateDealProductsPayload(
  productsJson,
  dealAmount,
  leadId,
  downsaleApprovalId,
  customPricing = {},
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
  const productPrices = await getDealProductPriceMap();

  for (const product of parsedProducts) {
    const resolved = resolveDealProductPricing(
      product,
      productPrices,
      customPricing,
    );

    if (!resolved.valid) {
      return { valid: false, message: resolved.message };
    }

    standardTotal += resolved.standardAmount;
    sanitizedProducts.push({
      name: resolved.name,
      amount: resolved.amount,
      ...(resolved.keywordCount
        ? {
            keywordCount: resolved.keywordCount,
            keywordRate: resolved.keywordRate,
          }
        : {}),
    });
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
        ? Number(
            ((product.amount / standardTotal) * numericDealAmount).toFixed(2),
          )
        : product.amount,
  }));

  const roundedTotal = finalProducts.reduce(
    (sum, product) => sum + product.amount,
    0,
  );
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

const PUBLIC_APP_URL = String(
  process.env.PUBLIC_APP_URL || process.env.CLIENT_ORIGIN || "",
)
  .trim()
  .replace(/\/+$/, "");
const BASE_URL = PUBLIC_APP_URL || "http://localhost:3000";
const LOCAL_PASSWORD_RESET_COOKIE = "mm_local_password_reset";
const DEFAULT_EMAIL_FROM_NAME = String(
  process.env.SMTP_FROM_NAME ||
    process.env.EMAIL_FROM_NAME ||
    "Metrics Mart Admin",
).trim();

function isLoopbackHostValue(value = "") {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .split("/")[0]
    .split(":")[0];

  return ["localhost", "127.0.0.1", "::1", "[::1]"].includes(normalized);
}

function parseRequestCookies(req) {
  const cookieHeader = String(req?.headers?.cookie || "").trim();
  if (!cookieHeader) return {};

  return cookieHeader.split(";").reduce((cookies, chunk) => {
    const [rawKey, ...rawValueParts] = chunk.split("=");
    const key = String(rawKey || "").trim();
    if (!key) return cookies;

    const value = rawValueParts.join("=").trim();
    cookies[key] = decodeURIComponent(value || "");
    return cookies;
  }, {});
}

function getLocalPasswordResetCookieOptions(req, expiresAt = null) {
  const isSecureRequest =
    Boolean(req?.secure) ||
    String(req?.headers?.["x-forwarded-proto"] || "")
      .toLowerCase()
      .includes("https");
  const options = {
    httpOnly: true,
    sameSite: "lax",
    secure: isSecureRequest,
    path: "/",
  };

  if (expiresAt instanceof Date && !Number.isNaN(expiresAt.getTime())) {
    options.expires = expiresAt;
  }

  return options;
}

function setLocalPasswordResetCookie(res, req, token, expiresAt) {
  if (!res?.cookie) return;

  const normalizedToken = String(token || "").trim();
  if (!normalizedToken) return;

  res.cookie(
    LOCAL_PASSWORD_RESET_COOKIE,
    encodeURIComponent(normalizedToken),
    getLocalPasswordResetCookieOptions(req, expiresAt),
  );
}

function clearLocalPasswordResetCookie(res, req) {
  if (!res?.cookie) return;

  res.cookie(LOCAL_PASSWORD_RESET_COOKIE, "", {
    ...getLocalPasswordResetCookieOptions(req),
    expires: new Date(0),
  });
}

function resolvePasswordResetRequestToken(req, tokenFromParam = "") {
  const directToken = String(tokenFromParam || "").trim();
  if (directToken && directToken !== "__local__") {
    return directToken;
  }

  const cookies = parseRequestCookies(req);
  return String(cookies[LOCAL_PASSWORD_RESET_COOKIE] || "").trim();
}

function isLocalPasswordResetFallbackAllowed(req) {
  const hostsToCheck = [req?.hostname, req?.headers?.host];

  try {
    hostsToCheck.push(new URL(resolveAppBaseUrl(req)).hostname);
  } catch (err) {
    // Ignore invalid runtime base url values and fall back to host checks.
  }

  try {
    hostsToCheck.push(new URL(BASE_URL).hostname);
  } catch (err) {
    // Ignore invalid configured base url values and fall back to host checks.
  }

  return hostsToCheck.some((host) => isLoopbackHostValue(host));
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
const PASSWORD_RESET_TOKEN_TTL_HOURS = Math.max(
  1,
  Number(process.env.PASSWORD_RESET_LINK_TTL_HOURS || 2),
);
const PASSWORD_RESET_OTP_TTL_MINUTES = Math.max(
  1,
  Number(process.env.PASSWORD_RESET_OTP_TTL_MINUTES || 10),
);
const PASSWORD_RESET_OTP_MAX_ATTEMPTS = Math.max(
  3,
  Number(process.env.PASSWORD_RESET_OTP_MAX_ATTEMPTS || 5),
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
    return normalizeSalesTarget(process.env.ME_SALES_TARGET, 200000);
  }

  if (normalizedRole === "tme") {
    return normalizeSalesTarget(process.env.TME_SALES_TARGET, 200000);
  }

  return DEFAULT_SALES_TARGET;
}

const AUTO_TARGET_INCENTIVE_RATE = 0.07;
const AUTO_TARGET_INCENTIVE_ROLES = new Set(["me", "tme"]);
const SALARY_TARGET_MULTIPLIER = normalizeSalesTarget(
  process.env.SALES_TARGET_SALARY_MULTIPLIER,
  7,
);
let cachedProfileInviteTransport = null;
let cachedProfileInviteTransportSignature = "";
const DEAL_OTP_TTL_MS = 10 * 60 * 1000;
const dealOtpStore = new Map();

function normalizeDealOtp(value) {
  return String(value || "")
    .replace(/\D/g, "")
    .slice(0, 6);
}

function cleanupExpiredDealOtps() {
  const now = Date.now();
  for (const [leadId, record] of dealOtpStore.entries()) {
    if (!record?.expiresAt || record.expiresAt <= now) {
      dealOtpStore.delete(leadId);
    }
  }
}

function maskDealOtpPhone(value) {
  const digits = String(value || "").replace(/\D/g, "");
  if (!digits) return "N/A";
  const lastFour = digits.slice(-4);
  return `${"X".repeat(Math.max(digits.length - 4, 2))}${lastFour}`;
}

function createDealOtp(leadId) {
  cleanupExpiredDealOtps();
  const otp = String(crypto.randomInt(0, 1000000)).padStart(6, "0");
  dealOtpStore.set(String(leadId), {
    otp,
    expiresAt: Date.now() + DEAL_OTP_TTL_MS,
  });
  return otp;
}

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

async function getSalesTargetSummaryData({ role, userId, monthKey } = {}) {
  const normalizedUserId = Number(userId);
  const effectiveRole = await resolveSalesTargetRole(role, normalizedUserId);
  const normalizedMonthKey = normalizePayrollMonthKey(monthKey);
  const monthRange = getPayrollMonthRange(normalizedMonthKey);
  const receivedAmountSql = `
    CASE
      WHEN COALESCE(received_amount, 0) > 0 THEN COALESCE(received_amount, 0)
      WHEN LOWER(TRIM(COALESCE(pay_stat, ''))) = 'received' THEN COALESCE(deal_amount, 0)
      ELSE 0
    END
  `;
  const paidGstSql = `
    CASE
      WHEN (${receivedAmountSql}) <= 0 THEN 0
      ELSE ROUND((${receivedAmountSql}) - ((${receivedAmountSql}) / 1.18), 2)
    END
  `;
  const paidWithoutGstSql = `
    CASE
      WHEN (${receivedAmountSql}) <= 0 THEN 0
      ELSE ROUND((${receivedAmountSql}) / 1.18, 2)
    END
  `;
  let sql = `
    SELECT
      COALESCE(SUM(COALESCE(deal_amount, 0)), 0) AS totalContractValue,
      COALESCE(SUM(${receivedAmountSql}), 0) AS achieved,
      COALESCE(SUM(${paidWithoutGstSql}), 0) AS paidWithoutGst,
      COALESCE(SUM(${paidGstSql}), 0) AS receivedGstAmount,
      COUNT(*) AS dealsCount
    FROM leads
    WHERE lead_status = 'deal_closed'
      AND closed_date IS NOT NULL
      AND DATE(closed_date) BETWEEN ? AND ?
  `;
  const params = [monthRange.startDate, monthRange.endDate];

  if (effectiveRole === "me") {
    if (!normalizedUserId) {
      const error = new Error("User ID required");
      error.statusCode = 400;
      throw error;
    }

    sql += " AND closed_by = ?";
    params.push(normalizedUserId);
  } else if (effectiveRole !== "admin") {
    if (!normalizedUserId) {
      const error = new Error("User ID required");
      error.statusCode = 400;
      throw error;
    }

    sql += " AND (created_by = ? OR closed_by = ?)";
    params.push(normalizedUserId, normalizedUserId);
  }

  await ensureUserMonthlyTargetColumn();
  await ensurePayrollUserColumns();

  const [rows] = await dbPromise.query(sql, params);
  const totalContractValue = roundServerAmount(
    rows[0]?.totalContractValue || 0,
  );
  const achieved = roundServerAmount(rows[0]?.achieved || 0);
  const paidWithoutGst = roundServerAmount(rows[0]?.paidWithoutGst || 0);
  const receivedGstAmount = roundServerAmount(rows[0]?.receivedGstAmount || 0);
  let target = getSalesTargetForRole(effectiveRole);
  let targetSource = "role_default";
  let salary = 0;
  let monthlyTarget = null;

  if (normalizedUserId) {
    const [userRows] = await dbPromise.query(
      "SELECT salary, monthly_target FROM users WHERE id = ? LIMIT 1",
      [normalizedUserId],
    );
    salary = roundServerAmount(userRows[0]?.salary || 0);
    const customTarget = Number(userRows[0]?.monthly_target);
    monthlyTarget = Number.isFinite(customTarget)
      ? roundServerAmount(customTarget)
      : null;
    const shouldUseSalaryTarget =
      AUTO_TARGET_INCENTIVE_ROLES.has(effectiveRole);

    if (shouldUseSalaryTarget && salary > 0) {
      target = roundServerAmount(salary * SALARY_TARGET_MULTIPLIER);
      targetSource = "salary_7x";
    } else if (monthlyTarget != null && monthlyTarget > 0) {
      target = monthlyTarget;
      targetSource = "monthly_target";
    }
  }

  const targetAchieved = paidWithoutGst;
  const remaining = roundServerAmount(Math.max(target - targetAchieved, 0));

  return {
    role: effectiveRole,
    userId: normalizedUserId || null,
    monthKey: monthRange.monthKey,
    startDate: monthRange.startDate,
    endDate: monthRange.endDate,
    target,
    targetSource,
    targetBasis: {
      salary,
      multiplier: SALARY_TARGET_MULTIPLIER,
      monthlyTarget,
    },
    achieved,
    targetAchieved,
    totalContractValue,
    paidWithoutGst,
    receivedGstAmount,
    remaining,
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
      const receivedPayment = Number(summary.achieved || 0);
      const paidWithoutGst = Number(
        summary.targetAchieved ?? summary.paidWithoutGst ?? 0,
      );

      return {
        userId: Number(user.id || 0),
        name: String(user.name || "Employee"),
        role: String(user.role || "")
          .toLowerCase()
          .trim(),
        roleLabel:
          String(user.role || "")
            .toUpperCase()
            .trim() || "EMPLOYEE",
        target,
        targetSource: summary.targetSource || "role_default",
        targetBasis: summary.targetBasis || {
          salary: Number(user.salary || 0),
          multiplier: SALARY_TARGET_MULTIPLIER,
          monthlyTarget: Number(user.monthly_target || 0),
        },
        salary: Number(summary.targetBasis?.salary ?? user.salary ?? 0),
        monthlyTarget: Number(
          summary.targetBasis?.monthlyTarget ?? user.monthly_target ?? 0,
        ),
        achieved: paidWithoutGst,
        receivedPayment,
        totalContractValue: Number(summary.totalContractValue || 0),
        paidWithoutGst,
        remaining: Math.max(target - paidWithoutGst, 0),
        dealsCount: Number(summary.dealsCount || 0),
        isAchieved: target > 0 && paidWithoutGst >= target,
      };
    }),
  );

  const summary = data.reduce(
    (accumulator, item) => {
      accumulator.totalMembers += 1;
      accumulator.totalTarget += Number(item.target || 0);
      accumulator.totalAchieved += Number(item.receivedPayment || 0);
      accumulator.totalPaidWithoutGst += Number(item.paidWithoutGst || 0);
      accumulator.totalContractValue += Number(item.totalContractValue || 0);
      accumulator.dealsCount += Number(item.dealsCount || 0);
      if (item.isAchieved) {
        accumulator.achievedMembers += 1;
      }
      return accumulator;
    },
    {
      totalMembers: 0,
      totalTarget: 0,
      totalAchieved: 0,
      totalPaidWithoutGst: 0,
      totalContractValue: 0,
      dealsCount: 0,
      achievedMembers: 0,
    },
  );

  const roleSummary = data.reduce((accumulator, item) => {
    const roleKey = String(item.role || "")
      .toLowerCase()
      .trim();
    if (!roleKey) return accumulator;

    if (!accumulator[roleKey]) {
      accumulator[roleKey] = {
        role: roleKey,
        label: roleKey.toUpperCase(),
        totalMembers: 0,
        achievedMembers: 0,
        totalTarget: 0,
        totalContractValue: 0,
        totalAchieved: 0,
        totalPaidWithoutGst: 0,
        totalRemaining: 0,
        dealsCount: 0,
      };
    }

    const bucket = accumulator[roleKey];
    bucket.totalMembers += 1;
    bucket.totalTarget += Number(item.target || 0);
    bucket.totalContractValue += Number(item.totalContractValue || 0);
    bucket.totalAchieved += Number(item.receivedPayment || 0);
    bucket.totalPaidWithoutGst += Number(item.paidWithoutGst || 0);
    bucket.totalRemaining = Math.max(
      bucket.totalTarget - bucket.totalPaidWithoutGst,
      0,
    );
    bucket.dealsCount += Number(item.dealsCount || 0);
    if (item.isAchieved) bucket.achievedMembers += 1;

    return accumulator;
  }, {});

  return {
    month: normalizedMonthKey,
    summary: {
      ...summary,
      totalRemaining: Math.max(
        summary.totalTarget - summary.totalPaidWithoutGst,
        0,
      ),
    },
    roleSummary,
    data,
  };
}

async function getAutoTargetIncentiveForPayroll({
  user,
  monthKey,
  basicSalary,
}) {
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
    };
  }

  const targetSummary = await getSalesTargetSummaryData({
    role,
    userId: Number(user?.id || 0),
    monthKey,
  });
  const target = Number(targetSummary.target || 0);
  const achieved = Number(
    targetSummary.targetAchieved ?? targetSummary.paidWithoutGst ?? 0,
  );
  const applies = target > 0 && achieved >= target;

  return {
    applies,
    amount: applies
      ? Number(
          (
            normalizePayrollAmount(basicSalary) * AUTO_TARGET_INCENTIVE_RATE
          ).toFixed(2),
        )
      : 0,
    target,
    achieved,
    remaining: Math.max(target - achieved, 0),
    rate: AUTO_TARGET_INCENTIVE_RATE,
  };
}

// ====================== MIDDLEWARE ======================
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(__dirname));

// ====================== MULTER SETUP ======================
const uploadsDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/"),
  filename: (req, file, cb) => {
    const uniqueName =
      Date.now() +
      "-" +
      Math.round(Math.random() * 1e9) +
      path.extname(file.originalname);
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
    const extension = path
      .extname(String(file.originalname || ""))
      .toLowerCase();

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

const userRegistrationUpload = upload.fields([
  { name: "prof_img", maxCount: 1 },
  { name: "aadhar_img", maxCount: 1 },
  { name: "pan_img", maxCount: 1 },
  { name: "cancelled_cheque", maxCount: 1 },
  { name: "resume_file", maxCount: 1 },
  { name: "experience_file", maxCount: 1 },
  { name: "certification_file", maxCount: 1 },
]);

function getUploadedFilePath(files, fieldName) {
  const uploadedFile = Array.isArray(files?.[fieldName])
    ? files[fieldName][0]
    : null;
  return uploadedFile ? `uploads/${uploadedFile.filename}` : null;
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

function normalizeAppBaseUrl(value) {
  return String(value || "")
    .trim()
    .replace(/\/+$/, "");
}

function resolveAppBaseUrl(req) {
  if (PUBLIC_APP_URL) {
    return PUBLIC_APP_URL;
  }

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

  return normalizeAppBaseUrl(`${forwardedProto}://${forwardedHost}`);
}

function hashProfileSetupToken(token) {
  return crypto
    .createHash("sha256")
    .update(String(token || ""))
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

function hashPasswordResetToken(token) {
  return crypto
    .createHash("sha256")
    .update(String(token || ""))
    .digest("hex");
}

function generatePasswordResetTokenData() {
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(
    Date.now() + PASSWORD_RESET_TOKEN_TTL_HOURS * 60 * 60 * 1000,
  );

  return {
    token,
    tokenHash: hashPasswordResetToken(token),
    expiresAt,
  };
}

function normalizePasswordResetOtp(value) {
  return String(value || "")
    .replace(/\D/g, "")
    .slice(0, 6);
}

function hashPasswordResetOtp(token, otp) {
  return crypto
    .createHash("sha256")
    .update(`${String(token || "")}:${normalizePasswordResetOtp(otp)}`)
    .digest("hex");
}

function generatePasswordResetOtpData(token) {
  const otpCode = String(crypto.randomInt(0, 1000000)).padStart(6, "0");
  const expiresAt = new Date(
    Date.now() + PASSWORD_RESET_OTP_TTL_MINUTES * 60 * 1000,
  );

  return {
    otpCode,
    otpHash: hashPasswordResetOtp(token, otpCode),
    expiresAt,
  };
}

function formatProfileSetupExpiryLabel(dateValue) {
  const date = dateValue instanceof Date ? dateValue : new Date(dateValue);
  if (Number.isNaN(date.getTime())) return "";

  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "medium",
    timeZone: "Asia/Kolkata",
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
    status:
      rawStatus === "completed"
        ? "completed"
        : isExpired
          ? "expired"
          : rawStatus,
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

function inferProfileInviteMailerPreset(emailAddress) {
  const normalizedEmail = String(emailAddress || "")
    .trim()
    .toLowerCase();
  const domain = normalizedEmail.split("@")[1] || "";

  if (!domain) {
    return null;
  }

  if (["gmail.com", "googlemail.com"].includes(domain)) {
    return {
      host: "smtp.gmail.com",
      port: 587,
      secure: false,
    };
  }

  if (
    [
      "outlook.com",
      "hotmail.com",
      "live.com",
      "office365.com",
      "outlook.in",
    ].includes(domain) ||
    domain.endsWith(".outlook.com")
  ) {
    return {
      host: "smtp.office365.com",
      port: 587,
      secure: false,
    };
  }

  if (["zoho.com", "zoho.in"].includes(domain)) {
    return {
      host: domain === "zoho.in" ? "smtp.zoho.in" : "smtp.zoho.com",
      port: 587,
      secure: false,
    };
  }

  return null;
}

function buildProfileInviteMailerSetupMessage(prefix, missingKeys) {
  const keys = Array.isArray(missingKeys)
    ? missingKeys.filter((key) => String(key || "").trim())
    : [];

  if (!keys.length) {
    return prefix;
  }

  return `${prefix} Add ${keys.join(", ")} in the server .env file. See .env.example for the ready format.`;
}

function buildProfileInviteMailerMissingBaseConfigMessage(
  missingKeys,
  hasAuthCredentials,
) {
  const baseMessage = buildProfileInviteMailerSetupMessage(
    "Automatic email is not configured on the server yet.",
    missingKeys,
  );

  if (hasAuthCredentials) {
    return baseMessage;
  }

  return `${baseMessage} Or add SMTP_USER and SMTP_PASS for Gmail, Outlook, or Zoho auto-detection.`;
}

function getProfileInviteMailerConfig() {
  const envHost = String(
    process.env.SMTP_HOST || process.env.EMAIL_HOST || "",
  ).trim();
  const envPort = Number(process.env.SMTP_PORT || process.env.EMAIL_PORT || 0);
  const secureEnv = process.env.SMTP_SECURE ?? process.env.EMAIL_SECURE;
  const user = String(
    process.env.SMTP_USER || process.env.EMAIL_USER || "",
  ).trim();
  const pass = String(
    process.env.SMTP_PASS || process.env.EMAIL_PASS || "",
  ).trim();
  const inferredPreset = inferProfileInviteMailerPreset(user);
  const host = String(envHost || inferredPreset?.host || "").trim();
  const port = Number(envPort || inferredPreset?.port || 0);
  const fromAddress = String(
    process.env.SMTP_FROM || process.env.EMAIL_FROM || user,
  ).trim();
  const fromName = DEFAULT_EMAIL_FROM_NAME || "Metrics Mart Admin";
  const secure =
    secureEnv != null
      ? normalizeInviteMailerFlag(secureEnv)
      : (inferredPreset?.secure ?? port === 465);
  const missingConfig = [];

  if (!host) missingConfig.push("SMTP_HOST");
  if (!port) missingConfig.push("SMTP_PORT");
  if (!fromAddress) missingConfig.push("SMTP_FROM");

  if (missingConfig.length) {
    return {
      configured: false,
      reason: buildProfileInviteMailerMissingBaseConfigMessage(
        missingConfig,
        Boolean(user || pass),
      ),
      missingConfig,
    };
  }

  if ((user && !pass) || (!user && pass)) {
    const missingAuthConfig = [];
    if (!user) missingAuthConfig.push("SMTP_USER");
    if (!pass) missingAuthConfig.push("SMTP_PASS");

    return {
      configured: false,
      reason: buildProfileInviteMailerSetupMessage(
        "SMTP username/password is incomplete.",
        missingAuthConfig,
      ),
      missingConfig: missingAuthConfig,
    };
  }

  return {
    configured: true,
    signature: JSON.stringify([
      host,
      port,
      secure,
      user,
      fromAddress,
      fromName,
    ]),
    transportOptions: {
      host,
      port,
      secure,
      ...(user
        ? {
            auth: {
              user,
              pass,
            },
          }
        : {}),
    },
    from: {
      name: fromName,
      address: fromAddress,
    },
  };
}

function getProfileInviteMailerTransport() {
  const config = getProfileInviteMailerConfig();
  if (!config.configured) {
    return {
      ...config,
      transport: null,
    };
  }

  if (!nodemailer) {
    return {
      ...config,
      configured: false,
      reason:
        "Email transport is unavailable because nodemailer is not installed.",
      transport: null,
    };
  }

  if (
    !cachedProfileInviteTransport ||
    cachedProfileInviteTransportSignature !== config.signature
  ) {
    cachedProfileInviteTransport = nodemailer.createTransport(
      config.transportOptions,
    );
    cachedProfileInviteTransportSignature = config.signature;
  }

  return {
    ...config,
    transport: cachedProfileInviteTransport,
  };
}

function escapeProfileSetupEmailHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildProfileSetupInviteHtml(profileSetup, user) {
  const userName = String(user?.name || "Team Member").trim() || "Team Member";
  const invitationLink = String(profileSetup?.invitationLink || "").trim();
  const expiresOn = String(profileSetup?.expiresOn || "").trim();

  return `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111827;max-width:640px;margin:0 auto;padding:24px;">
      <h2 style="margin:0 0 16px;color:#0f172a;">Complete Your Metrics Mart Profile</h2>
      <p style="margin:0 0 12px;">Hi ${escapeProfileSetupEmailHtml(userName)},</p>
      <p style="margin:0 0 16px;">
        Please complete your remaining employee details using the link below.
      </p>
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
  `;
}

function buildProfileSetupInvitePayload(req, user, token, expiresAt) {
  const invitationLink = `${resolveAppBaseUrl(req)}/complete-profile.html?token=${encodeURIComponent(token)}`;
  const expiresOn = formatProfileSetupExpiryLabel(expiresAt);
  const subject = `Complete your Metrics Mart profile`;
  const bodyLines = [
    `Hi ${String(user?.name || "Team Member").trim() || "Team Member"},`,
    "",
    "Please complete your remaining employee details using the link below:",
    invitationLink,
    "",
    expiresOn ? `This link expires on ${expiresOn}.` : "",
    "",
    "Regards,",
    "Metrics Mart Admin",
  ].filter(
    (line, index, allLines) => line || (index > 0 && allLines[index - 1]),
  );
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
      message:
        "User email is missing, so the profile setup email was not sent.",
    };
  }

  const mailer = getProfileInviteMailerTransport();
  if (!mailer.configured || !mailer.transport) {
    return {
      sent: false,
      status: "skipped",
      message:
        mailer.reason || "Automatic email is not configured on the server yet.",
      missingConfig: Array.isArray(mailer.missingConfig)
        ? mailer.missingConfig
        : [],
    };
  }

  try {
    await mailer.transport.sendMail({
      from: mailer.from,
      to: inviteEmail,
      subject: profileSetup.subject,
      text: profileSetup.body,
      html: buildProfileSetupInviteHtml(profileSetup, user),
    });

    return {
      sent: true,
      status: "sent",
      message: `Profile setup email sent automatically to ${inviteEmail}.`,
    };
  } catch (err) {
    console.error("Profile setup email send failed:", err);
    return {
      sent: false,
      status: "failed",
      message:
        "Automatic profile setup email failed. Please check SMTP settings.",
    };
  }
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

function buildPasswordResetEmailHtml(resetRequest, user) {
  const userName = String(user?.name || "Team Member").trim() || "Team Member";
  const resetLink = String(resetRequest?.resetLink || "").trim();
  const expiresOn = String(resetRequest?.expiresOn || "").trim();
  const otpCode = String(resetRequest?.otpCode || "").trim();
  const otpExpiresOn = String(resetRequest?.otpExpiresOn || "").trim();

  return `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111827;max-width:640px;margin:0 auto;padding:24px;">
      <h2 style="margin:0 0 16px;color:#0f172a;">Verify OTP To Reset Your Metrics Mart Password</h2>
      <p style="margin:0 0 12px;">Hi ${escapeProfileSetupEmailHtml(userName)},</p>
      <p style="margin:0 0 16px;">
        We received a request to reset your Metrics Mart password. Enter the OTP below on the reset screen, then choose your new password.
      </p>
      <div style="margin:0 0 18px;padding:16px 18px;border:1px solid #cbd5e1;border-radius:14px;background:#f8fafc;text-align:center;">
        <div style="margin:0 0 8px;font-size:13px;letter-spacing:0.08em;text-transform:uppercase;color:#475569;font-weight:700;">Your Verification OTP</div>
        <div style="font-size:32px;letter-spacing:0.32em;font-weight:800;color:#0f172a;">${escapeProfileSetupEmailHtml(otpCode || "------")}</div>
        ${
          otpExpiresOn
            ? `<div style="margin-top:8px;font-size:13px;color:#475569;">OTP expires on ${escapeProfileSetupEmailHtml(otpExpiresOn)}.</div>`
            : ""
        }
      </div>
      <p style="margin:0 0 16px;">
        Open the secure reset page below and enter this OTP:
      </p>
      <p style="margin:0 0 20px;">
        <a
          href="${escapeProfileSetupEmailHtml(resetLink)}"
          style="display:inline-block;background:#0f766e;color:#ffffff;text-decoration:none;padding:12px 18px;border-radius:8px;font-weight:600;"
        >
          Open Reset Page
        </a>
      </p>
      <p style="margin:0 0 12px;word-break:break-all;">
        ${escapeProfileSetupEmailHtml(resetLink)}
      </p>
      ${
        expiresOn
          ? `<p style="margin:0 0 16px;color:#475569;">This link expires on ${escapeProfileSetupEmailHtml(expiresOn)}.</p>`
          : ""
      }
      <p style="margin:0 0 12px;color:#475569;">
        If you did not request this password reset, you can safely ignore this email.
      </p>
      <p style="margin:0;">Regards,<br />Metrics Mart Admin</p>
    </div>
  `;
}

function buildPasswordResetPayload(
  req,
  user,
  token,
  expiresAt,
  otpCode,
  otpExpiresAt,
) {
  const resetLink = `${resolveAppBaseUrl(req)}/reset-password.html?token=${encodeURIComponent(token)}`;
  const expiresOn = formatProfileSetupExpiryLabel(expiresAt);
  const otpExpiresOn = formatProfileSetupExpiryLabel(otpExpiresAt);
  const subject = "Your Metrics Mart password reset OTP";
  const bodyLines = [
    `Hi ${String(user?.name || "Team Member").trim() || "Team Member"},`,
    "",
    "We received a request to reset your Metrics Mart password.",
    `Your verification OTP is: ${String(otpCode || "").trim() || "------"}`,
    otpExpiresOn ? `OTP expires on ${otpExpiresOn}.` : "",
    "",
    "Open the secure reset page below and enter this OTP:",
    resetLink,
    "",
    expiresOn ? `This link expires on ${expiresOn}.` : "",
    "",
    "If you did not request this password reset, you can safely ignore this email.",
    "",
    "Regards,",
    "Metrics Mart Admin",
  ].filter(
    (line, index, allLines) => line || (index > 0 && allLines[index - 1]),
  );

  return {
    resetLink,
    expiresAt,
    expiresOn,
    otpCode,
    otpExpiresAt,
    otpExpiresOn,
    email: user?.email || "",
    subject,
    body: bodyLines.join("\n"),
  };
}

async function sendPasswordResetEmail(resetRequest, user) {
  const inviteEmail = String(resetRequest?.email || user?.email || "").trim();
  if (!inviteEmail) {
    return {
      sent: false,
      status: "skipped",
      message:
        "User email is missing, so the password reset email was not sent.",
    };
  }

  const mailer = getProfileInviteMailerTransport();
  if (!mailer.configured || !mailer.transport) {
    return {
      sent: false,
      status: "skipped",
      message:
        mailer.reason || "Automatic email is not configured on the server yet.",
      missingConfig: Array.isArray(mailer.missingConfig)
        ? mailer.missingConfig
        : [],
    };
  }

  try {
    await mailer.transport.sendMail({
      from: mailer.from,
      to: inviteEmail,
      subject: resetRequest.subject,
      text: resetRequest.body,
      html: buildPasswordResetEmailHtml(resetRequest, user),
    });

    return {
      sent: true,
      status: "sent",
      message: `Password reset email sent automatically to ${inviteEmail}.`,
    };
  } catch (err) {
    console.error("Password reset email send failed:", err);
    return {
      sent: false,
      status: "failed",
      message:
        "Automatic password reset email failed. Please check SMTP settings.",
    };
  }
}

async function issuePasswordResetRequest(req, user) {
  const { token, tokenHash, expiresAt } = generatePasswordResetTokenData();
  const {
    otpCode,
    otpHash,
    expiresAt: otpExpiresAt,
  } = generatePasswordResetOtpData(token);

  await dbPromise.query(
    `
      UPDATE users
      SET
        password_reset_token_hash = ?,
        password_reset_expires_at = ?,
        password_reset_sent_at = NOW(),
        password_reset_used_at = NULL,
        password_reset_otp_hash = ?,
        password_reset_otp_expires_at = ?,
        password_reset_otp_verified_at = NULL,
        password_reset_otp_attempts = 0
      WHERE id = ?
      LIMIT 1
    `,
    [tokenHash, expiresAt, otpHash, otpExpiresAt, Number(user.id)],
  );

  const payload = buildPasswordResetPayload(
    req,
    user,
    token,
    expiresAt,
    otpCode,
    otpExpiresAt,
  );
  const emailDispatch = await sendPasswordResetEmail(payload, user);

  return {
    token,
    otpCode,
    ...payload,
    emailDispatch,
  };
}

async function getPasswordResetUserByToken(token) {
  const tokenHash = hashPasswordResetToken(token);
  const [users] = await dbPromise.query(
    `
      SELECT
        id,
        name,
        email,
        password_reset_otp_hash,
        password_reset_otp_expires_at,
        password_reset_otp_verified_at,
        password_reset_otp_attempts,
        password_reset_expires_at,
        password_reset_sent_at,
        password_reset_used_at
      FROM users
      WHERE password_reset_token_hash = ?
      LIMIT 1
    `,
    [tokenHash],
  );

  return users[0] || null;
}

function getPasswordResetStatusDetails(user) {
  const expiresAt = user?.password_reset_expires_at
    ? new Date(user.password_reset_expires_at)
    : null;
  const otpExpiresAt = user?.password_reset_otp_expires_at
    ? new Date(user.password_reset_otp_expires_at)
    : null;
  const otpVerifiedAt = user?.password_reset_otp_verified_at
    ? new Date(user.password_reset_otp_verified_at)
    : null;
  const usedAt = user?.password_reset_used_at
    ? new Date(user.password_reset_used_at)
    : null;
  const isExpired =
    expiresAt instanceof Date &&
    !Number.isNaN(expiresAt.getTime()) &&
    expiresAt.getTime() < Date.now();
  const isOtpExpired =
    otpExpiresAt instanceof Date &&
    !Number.isNaN(otpExpiresAt.getTime()) &&
    otpExpiresAt.getTime() < Date.now();
  const isOtpVerified =
    otpVerifiedAt instanceof Date && !Number.isNaN(otpVerifiedAt.getTime());
  const isUsed = usedAt instanceof Date && !Number.isNaN(usedAt.getTime());
  const otpAttempts = Math.max(
    0,
    Number(user?.password_reset_otp_attempts || 0),
  );

  return {
    status: isUsed ? "used" : isExpired ? "expired" : "active",
    expiresAt,
    otpExpiresAt,
    otpVerifiedAt,
    usedAt,
    isExpired,
    isOtpExpired,
    isOtpVerified,
    isUsed,
    otpAttempts,
  };
}

const paymentUploadsDir = path.join(__dirname, "uploads/payments");
if (!fs.existsSync(paymentUploadsDir)) {
  fs.mkdirSync(paymentUploadsDir, { recursive: true });
}

const paymentStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/payments/"),
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
  destination: (req, file, cb) => cb(null, "uploads/project-phases/"),
  filename: (req, file, cb) => {
    const safeName =
      String(file.originalname || "file")
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
  destination: (req, file, cb) => cb(null, "uploads/leaves/"),
  filename: (req, file, cb) => {
    const safeName =
      String(file.originalname || "leave-file")
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

// ====================== DATABASE CONNECTION ======================

function getDatabaseConfig() {
  const configuredHost =
    process.env.DB_HOST ||
    process.env.MYSQLHOST ||
    process.env.MYSQL_HOST ||
    process.env.MYSQL_ADDON_HOST;
  const databaseUrl =
    process.env.DATABASE_URL ||
    process.env.MYSQL_PUBLIC_URL ||
    process.env.MYSQL_URL;

  if (databaseUrl && !configuredHost) {
    return databaseUrl;
  }

  return {
    host: configuredHost || "localhost",
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
  };
}

const databaseConfig = getDatabaseConfig();
const db = mysql.createPool(
  typeof databaseConfig === "string"
    ? databaseConfig
    : {
        ...databaseConfig,
        timezone: "+05:30",
        dateStrings: true,
        enableKeepAlive: true,
        keepAliveInitialDelay: 0,
      },
);

db.on("connection", (connection) => {
  connection.query("SET time_zone = '+05:30'", (err) => {
    if (err) {
      console.error("Failed to set MySQL India timezone:", err.message || err);
    }
  });
});

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
    return parsed.map((item) => String(item || "").trim()).filter(Boolean);
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
      const url = String(item.url || item.path || "")
        .trim()
        .replace(/\\/g, "/");
      const type = String(item.type || item.mime || "").trim();
      const size = Number(item.size || 0);
      const uploadedAt = String(
        item.uploaded_at || item.uploadedAt || "",
      ).trim();

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
  if (digits.length === 11 && digits.startsWith("0"))
    return `91${digits.slice(1)}`;
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
  pushWhatsappLine(
    lines,
    "Alternate Contact",
    lead.alt_contact || lead.alternate_contact,
  );
  pushWhatsappLine(lines, "Telephone", lead.telephone);
  pushWhatsappLine(lines, "Email", lead.email);
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
  const value = String(serviceType || "")
    .toLowerCase()
    .trim();

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

function buildProjectPhaseRows(
  serviceType,
  phaseRows = [],
  assignmentSnapshot = null,
) {
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
  const stageIndex = workflow.findIndex(
    (phase) => phase.key === normalizedStage,
  );
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
    const status = normalizeProjectPhaseStatus(stored.status, fallbackStatus);
    const fallbackProgress = hasStoredRows
      ? status === "completed"
        ? 100
        : 0
      : status === "completed"
        ? 100
        : status === "ongoing" && index === stageIndex
          ? assignmentProgress
          : 0;
    const progress = clampProjectProgress(stored.progress, fallbackProgress);

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
    } else if (
      assignments.some((assignment) => assignment.status === "ongoing")
    ) {
      status = "ongoing";
    } else if (
      assignments.some((assignment) => assignment.status === "assigned")
    ) {
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

async function fetchProjectTrackerData(scope, userId = null) {
  await ensureUserEmploymentStatusColumns();

  const normalizedScope = String(scope || "admin")
    .toLowerCase()
    .trim();
  const normalizedUserId = Number(userId);

  const whereParts = [
    `EXISTS (
      SELECT 1
      FROM project_assignments pa_scope
      INNER JOIN users assignee_scope ON assignee_scope.id = pa_scope.user_id
      WHERE pa_scope.project_id = l.id
        AND ${getActiveUserEmploymentStatusSql("assignee_scope")}
    )`,
  ];
  const params = [];

  if (normalizedScope === "me") {
    whereParts.push("l.assign_emp_id = ?");
    params.push(normalizedUserId);
  } else if (normalizedScope === "tme") {
    whereParts.push("l.created_by = ?");
    params.push(normalizedUserId);
  } else if (normalizedScope !== "admin") {
    throw new Error("Invalid project tracker scope");
  }

  const leadProjectSql = await getLeadProjectSelectSql("l");
  const [projectRows] = await dbPromise.query(
    `
      SELECT
        l.id AS project_id,
        ${leadProjectSql.selectSql},
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
      INNER JOIN users assignee ON assignee.id = pa.user_id
      WHERE pa.project_id IN (?)
        AND ${getActiveUserEmploymentStatusSql("assignee")}
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
    const phases =
      sharedState?.phases || buildProjectPhaseRows(row.service_type, [], row);
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
    const blockedCount = phases.filter(
      (phase) => phase.status === "blocked",
    ).length;
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

let schemaQueryQueue = Promise.resolve();

function isTransientDatabaseError(err) {
  return (
    [
      "PROTOCOL_CONNECTION_LOST",
      "ECONNRESET",
      "ETIMEDOUT",
      "ER_CON_COUNT_ERROR",
      "ER_LOCK_DEADLOCK",
      "ER_LOCK_WAIT_TIMEOUT",
    ].includes(err?.code) || Boolean(err?.fatal)
  );
}

async function runSchemaQuery(sql, params = []) {
  const execute = async () => {
    let lastError = null;

    for (let attempt = 1; attempt <= 5; attempt += 1) {
      try {
        return await dbPromise.query(sql, params);
      } catch (err) {
        lastError = err;

        if (!isTransientDatabaseError(err) || attempt >= 5) {
          throw err;
        }

        await sleep(500 * attempt);
      }
    }

    throw lastError;
  };

  const queuedQuery = schemaQueryQueue.then(execute, execute);
  schemaQueryQueue = queuedQuery.catch(() => {});
  return queuedQuery;
}

async function runSchemaChange(sql, duplicateCode) {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      await runSchemaQuery(sql);
      return;
    } catch (err) {
      if (err.code === duplicateCode) return;

      if (
        attempt < 3 &&
        (err.code === "ER_LOCK_DEADLOCK" || err.code === "ER_LOCK_WAIT_TIMEOUT")
      ) {
        await sleep(250 * attempt);
        continue;
      }

      throw err;
    }
  }
}

const startupSchemaTasks = [];

function scheduleSchemaSetup(label, task) {
  startupSchemaTasks.push({ label, task });
}

async function runStartupSchemaTasks() {
  if (!startupSchemaTasks.length) return;

  try {
    await runSchemaQuery("SELECT 1 AS db_ready");
  } catch (err) {
    console.error(
      `Database connection failed; skipped startup schema setup (${err.code || "DB_ERROR"}). ` +
        "Check local MySQL service and DB_HOST/DB_PORT/DB_USER/DB_PASSWORD/DB_NAME in .env.",
    );
    return;
  }

  for (const { label, task } of startupSchemaTasks) {
    try {
      await task();
    } catch (err) {
      console.error(`${label} failed:`, err);
    }
  }
}

async function ensureUserShiftColumns() {
  await runSchemaChange(
    "ALTER TABLE users ADD COLUMN logout_time time DEFAULT '18:00:00' AFTER comp_name",
    "ER_DUP_FIELDNAME",
  );
}

scheduleSchemaSetup("User shift setup", ensureUserShiftColumns);

let userRegistrationSchemaReady = false;
let userRegistrationSchemaPromise = null;

async function ensureUserRegistrationColumns() {
  if (userRegistrationSchemaReady) return;
  if (userRegistrationSchemaPromise) return userRegistrationSchemaPromise;

  userRegistrationSchemaPromise = (async () => {
    const schemaChanges = [
      "ALTER TABLE users MODIFY COLUMN contact varchar(20) DEFAULT NULL",
      "ALTER TABLE users ADD COLUMN cpswd varchar(255) DEFAULT NULL AFTER spswd",
      "ALTER TABLE users MODIFY COLUMN spswd varchar(255) DEFAULT NULL",
      "ALTER TABLE users MODIFY COLUMN cpswd varchar(255) DEFAULT NULL",
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
    ];

    for (const sql of schemaChanges) {
      await runSchemaChange(sql, "ER_DUP_FIELDNAME");
    }

    userRegistrationSchemaReady = true;
  })().finally(() => {
    userRegistrationSchemaPromise = null;
  });

  return userRegistrationSchemaPromise;
}

scheduleSchemaSetup(
  "User registration schema setup",
  ensureUserRegistrationColumns,
);

let userProfileSetupSchemaReady = false;
let userProfileSetupSchemaPromise = null;

async function ensureUserProfileSetupColumns() {
  if (userProfileSetupSchemaReady) return;
  if (userProfileSetupSchemaPromise) return userProfileSetupSchemaPromise;

  userProfileSetupSchemaPromise = (async () => {
    await ensureUserRegistrationColumns();

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

    userProfileSetupSchemaReady = true;
  })().finally(() => {
    userProfileSetupSchemaPromise = null;
  });

  return userProfileSetupSchemaPromise;
}

scheduleSchemaSetup(
  "User profile setup schema setup",
  ensureUserProfileSetupColumns,
);

function normalizeUserEmploymentStatus(value, fallback = "active") {
  const normalized = String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[\s-]+/g, "_");

  if (["all", "any"].includes(normalized)) return "all";
  if (
    ["inactive", "deactive", "deactivated", "disabled", "blocked"].includes(
      normalized,
    )
  ) {
    return "inactive";
  }
  if (["active", "activate", "activated", "enabled"].includes(normalized)) {
    return "active";
  }

  return fallback;
}

function getActiveUserEmploymentStatusSql(alias = "") {
  const prefix = alias ? `${alias}.` : "";
  return `COALESCE(NULLIF(LOWER(TRIM(${prefix}employment_status)), ''), 'active') = 'active'`;
}

let userEmploymentStatusSchemaReady = false;
let userEmploymentStatusSchemaPromise = null;

async function ensureUserEmploymentStatusColumns() {
  if (userEmploymentStatusSchemaReady) return;
  if (userEmploymentStatusSchemaPromise)
    return userEmploymentStatusSchemaPromise;

  userEmploymentStatusSchemaPromise = (async () => {
    const schemaChanges = [
      "ALTER TABLE users ADD COLUMN employment_status varchar(20) NOT NULL DEFAULT 'active'",
      "ALTER TABLE users ADD COLUMN deactivated_at datetime DEFAULT NULL AFTER employment_status",
      "ALTER TABLE users ADD COLUMN deactivated_by int DEFAULT NULL AFTER deactivated_at",
      "ALTER TABLE users ADD COLUMN reactivated_at datetime DEFAULT NULL AFTER deactivated_by",
      "ALTER TABLE users ADD COLUMN reactivated_by int DEFAULT NULL AFTER reactivated_at",
    ];

    for (const sql of schemaChanges) {
      await runSchemaChange(sql, "ER_DUP_FIELDNAME");
    }

    await runSchemaQuery(`
      UPDATE users
      SET employment_status = 'active'
      WHERE COALESCE(NULLIF(TRIM(employment_status), ''), '') = ''
    `);

    userEmploymentStatusSchemaReady = true;
  })().finally(() => {
    userEmploymentStatusSchemaPromise = null;
  });

  return userEmploymentStatusSchemaPromise;
}

scheduleSchemaSetup(
  "User employment status schema setup",
  ensureUserEmploymentStatusColumns,
);

async function ensureUserPasswordResetColumns() {
  const schemaChanges = [
    "ALTER TABLE users ADD COLUMN password_reset_token_hash varchar(128) DEFAULT NULL AFTER profile_setup_completed_at",
    "ALTER TABLE users ADD COLUMN password_reset_expires_at datetime DEFAULT NULL AFTER password_reset_token_hash",
    "ALTER TABLE users ADD COLUMN password_reset_sent_at datetime DEFAULT NULL AFTER password_reset_expires_at",
    "ALTER TABLE users ADD COLUMN password_reset_used_at datetime DEFAULT NULL AFTER password_reset_sent_at",
    "ALTER TABLE users ADD COLUMN password_reset_otp_hash varchar(128) DEFAULT NULL AFTER password_reset_used_at",
    "ALTER TABLE users ADD COLUMN password_reset_otp_expires_at datetime DEFAULT NULL AFTER password_reset_otp_hash",
    "ALTER TABLE users ADD COLUMN password_reset_otp_verified_at datetime DEFAULT NULL AFTER password_reset_otp_expires_at",
    "ALTER TABLE users ADD COLUMN password_reset_otp_attempts int NOT NULL DEFAULT 0 AFTER password_reset_otp_verified_at",
  ];

  for (const sql of schemaChanges) {
    await runSchemaChange(sql, "ER_DUP_FIELDNAME");
  }
}

scheduleSchemaSetup(
  "User password reset schema setup",
  ensureUserPasswordResetColumns,
);

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

function normalizeLeadMeetingType(value, fallback = "appointment") {
  const normalized = String(value || fallback)
    .toLowerCase()
    .trim()
    .replace(/[\s-]+/g, "_");

  return normalized === "google_meet" ? "google_meet" : "appointment";
}

function hasLeadGoogleMeetInput(data = {}) {
  const value = String(
    data.google_meet_link ||
      data.googleMeetLink ||
      data.location ||
      data.maps_lnk ||
      "",
  )
    .toLowerCase()
    .trim();

  return value.includes("meet.google") || value.includes("google meet");
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

async function ensureLeadAppointmentStatusColumn() {
  await runSchemaChange(
    "ALTER TABLE leads ADD COLUMN action_type enum('appointment','followup','not_interested','deal_closed') DEFAULT NULL",
    "ER_DUP_FIELDNAME",
  );
  await runSchemaChange(
    "ALTER TABLE leads ADD COLUMN app_date date DEFAULT NULL",
    "ER_DUP_FIELDNAME",
  );
  await runSchemaChange(
    "ALTER TABLE leads ADD COLUMN lead_status varchar(30) DEFAULT 'active'",
    "ER_DUP_FIELDNAME",
  );
  await runSchemaChange(
    "ALTER TABLE leads ADD COLUMN appointment_status varchar(30) DEFAULT NULL",
    "ER_DUP_FIELDNAME",
  );
  await runSchemaChange(
    "ALTER TABLE leads ADD COLUMN meeting_type varchar(40) DEFAULT 'appointment' AFTER appointment_status",
    "ER_DUP_FIELDNAME",
  );
  await runSchemaChange(
    "ALTER TABLE leads ADD COLUMN google_meet_link varchar(500) DEFAULT NULL AFTER meeting_type",
    "ER_DUP_FIELDNAME",
  );

  await runSchemaQuery(`
    UPDATE leads
    SET meeting_type = 'appointment'
    WHERE COALESCE(NULLIF(TRIM(meeting_type), ''), '') = ''
  `);
  await runSchemaQuery(
    "ALTER TABLE leads MODIFY COLUMN meeting_type varchar(40) NOT NULL DEFAULT 'appointment'",
  );

  await runSchemaQuery(`
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

scheduleSchemaSetup(
  "Appointment status schema setup",
  ensureLeadAppointmentStatusColumn,
);

async function ensureLeadCompanyScopeColumn() {
  await runSchemaChange(
    "ALTER TABLE leads ADD COLUMN created_by int DEFAULT NULL",
    "ER_DUP_FIELDNAME",
  );
  await runSchemaChange(
    "ALTER TABLE leads ADD COLUMN company_scope varchar(30) DEFAULT NULL",
    "ER_DUP_FIELDNAME",
  );
}

scheduleSchemaSetup("Lead company scope setup", ensureLeadCompanyScopeColumn);

async function ensureLeadInputColumnWidths() {
  const schemaChanges = [
    "ALTER TABLE leads ADD COLUMN contact varchar(80) NOT NULL DEFAULT '' AFTER client_name",
    "ALTER TABLE leads ADD COLUMN alternate_contact varchar(80) DEFAULT NULL AFTER contact",
    "ALTER TABLE leads ADD COLUMN telephone varchar(80) DEFAULT NULL AFTER alternate_contact",
    "ALTER TABLE leads ADD COLUMN email varchar(255) DEFAULT NULL AFTER telephone",
    "ALTER TABLE leads ADD COLUMN gst_no varchar(80) DEFAULT NULL AFTER email",
    "ALTER TABLE leads ADD COLUMN flat_no varchar(50) DEFAULT NULL AFTER gst_no",
    "ALTER TABLE leads ADD COLUMN building_name varchar(255) DEFAULT NULL AFTER flat_no",
    "ALTER TABLE leads ADD COLUMN locality varchar(255) NOT NULL DEFAULT '' AFTER building_name",
    "ALTER TABLE leads ADD COLUMN city varchar(160) NOT NULL DEFAULT '' AFTER locality",
    "ALTER TABLE leads ADD COLUMN pincode varchar(32) NOT NULL DEFAULT '' AFTER city",
    "ALTER TABLE leads ADD COLUMN state varchar(160) NOT NULL DEFAULT '' AFTER pincode",
    "ALTER TABLE leads ADD COLUMN maps_lnk text AFTER state",
    "ALTER TABLE leads ADD COLUMN source_lead varchar(160) NOT NULL DEFAULT '' AFTER maps_lnk",
    "ALTER TABLE leads ADD COLUMN industry_type varchar(160) NOT NULL DEFAULT '' AFTER source_lead",
    "ALTER TABLE leads ADD COLUMN web_type json DEFAULT NULL AFTER industry_type",
    "ALTER TABLE leads ADD COLUMN seo_type json DEFAULT NULL AFTER web_type",
    "ALTER TABLE leads ADD COLUMN smo_type json DEFAULT NULL AFTER seo_type",
    "ALTER TABLE leads ADD COLUMN app_type json DEFAULT NULL AFTER smo_type",
    "ALTER TABLE leads ADD COLUMN erp_type json DEFAULT NULL AFTER app_type",
    "ALTER TABLE leads ADD COLUMN services json DEFAULT NULL AFTER erp_type",
    "ALTER TABLE leads ADD COLUMN service_notes text AFTER services",
    "ALTER TABLE leads ADD COLUMN action_type enum('appointment','followup','not_interested','deal_closed') DEFAULT NULL AFTER service_notes",
    "ALTER TABLE leads ADD COLUMN appointment_status varchar(30) DEFAULT NULL AFTER action_type",
    "ALTER TABLE leads ADD COLUMN meeting_type varchar(40) DEFAULT 'appointment' AFTER appointment_status",
    "ALTER TABLE leads ADD COLUMN google_meet_link varchar(500) DEFAULT NULL AFTER meeting_type",
    "ALTER TABLE leads ADD COLUMN app_date date DEFAULT NULL AFTER google_meet_link",
    "ALTER TABLE leads ADD COLUMN app_time time DEFAULT NULL AFTER app_date",
    "ALTER TABLE leads ADD COLUMN assign_emp varchar(255) DEFAULT NULL AFTER app_time",
    "ALTER TABLE leads ADD COLUMN assign_emp_id int DEFAULT NULL AFTER assign_emp",
    "ALTER TABLE leads ADD COLUMN location varchar(255) DEFAULT NULL AFTER assign_emp_id",
    "ALTER TABLE leads ADD COLUMN follow_date date DEFAULT NULL AFTER location",
    "ALTER TABLE leads ADD COLUMN follow_time time DEFAULT NULL AFTER follow_date",
    "ALTER TABLE leads ADD COLUMN reason text AFTER follow_time",
    "ALTER TABLE leads ADD COLUMN additional_notes text AFTER reason",
    "ALTER TABLE leads ADD COLUMN created_at timestamp NULL DEFAULT CURRENT_TIMESTAMP AFTER additional_notes",
    "ALTER TABLE leads ADD COLUMN lead_status varchar(30) DEFAULT 'active' AFTER maps_lnk",
    "ALTER TABLE leads ADD COLUMN created_by int DEFAULT NULL AFTER created_at",
    "ALTER TABLE leads ADD COLUMN company_scope varchar(30) DEFAULT NULL AFTER created_by",
  ];

  for (const sql of schemaChanges) {
    await runSchemaChange(sql, "ER_DUP_FIELDNAME");
  }

  const [columns] = await dbPromise.query("SHOW COLUMNS FROM leads");
  const columnMap = new Map(columns.map((column) => [column.Field, column]));
  const getVarcharLength = (field) => {
    const match = String(columnMap.get(field)?.Type || "").match(
      /^varchar\((\d+)\)/i,
    );
    return match ? Number(match[1]) : 0;
  };
  const widthChanges = [];

  const ensureVarchar = (field, length, nullable) => {
    const column = columnMap.get(field);
    if (!column || getVarcharLength(field) >= length) return;
    widthChanges.push(
      `ALTER TABLE leads MODIFY COLUMN ${field} varchar(${length}) ${nullable ? "DEFAULT NULL" : "NOT NULL"}`,
    );
  };

  ensureVarchar("contact", 80, false);
  ensureVarchar("alternate_contact", 80, true);
  ensureVarchar("telephone", 80, true);
  ensureVarchar("gst_no", 80, true);
  ensureVarchar("city", 160, false);
  ensureVarchar("pincode", 32, false);
  ensureVarchar("state", 160, false);
  ensureVarchar("source_lead", 160, false);
  ensureVarchar("industry_type", 160, false);
  ensureVarchar("google_meet_link", 500, true);

  for (const sql of widthChanges) {
    await runSchemaQuery(sql);
  }

  cachedLeadColumnSet = null;
}

scheduleSchemaSetup(
  "Lead input column width setup",
  ensureLeadInputColumnWidths,
);

async function ensureLeadFollowupUpdateColumns() {
  const schemaChanges = [
    "ALTER TABLE leads ADD COLUMN action_type enum('appointment','followup','not_interested','deal_closed') DEFAULT NULL",
    "ALTER TABLE leads ADD COLUMN follow_date date DEFAULT NULL",
    "ALTER TABLE leads ADD COLUMN follow_time time DEFAULT NULL",
    "ALTER TABLE leads ADD COLUMN reason text",
  ];

  for (const sql of schemaChanges) {
    await runSchemaChange(sql, "ER_DUP_FIELDNAME");
  }

  cachedLeadColumnSet = null;
}

function cleanLeadText(value, fallback = null) {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function cleanLeadDate(value) {
  const text = cleanLeadText(value);
  return text && /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null;
}

function cleanLeadTime(value) {
  const text = cleanLeadText(value);
  return text && /^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(text)
    ? text
    : null;
}

function normalizeLeadActionType(value) {
  const normalized = String(value || "lead")
    .toLowerCase()
    .trim()
    .replace(/[\s-]+/g, "_");

  return [
    "appointment",
    "followup",
    "not_interested",
    "deal_closed",
    "lead",
  ].includes(normalized)
    ? normalized
    : "lead";
}

function getDbLeadActionType(value) {
  const normalized = normalizeLeadActionType(value);
  return normalized === "lead" ? null : normalized;
}

function stringifyLeadList(value) {
  if (Array.isArray(value)) return JSON.stringify(value);
  const text = cleanLeadText(value);
  return JSON.stringify(text ? [text] : []);
}

function normalizeLeadUserId(value) {
  const id = Number(value);
  return Number.isFinite(id) && id > 0 ? id : null;
}

function getLeadCreateErrorDetails(err) {
  if (!err) return null;

  if (
    err.code === "ER_DATA_TOO_LONG" ||
    err.code === "ER_BAD_NULL_ERROR" ||
    err.code === "ER_BAD_FIELD_ERROR" ||
    err.code === "ER_TRUNCATED_WRONG_VALUE" ||
    err.code === "ER_TRUNCATED_WRONG_VALUE_FOR_FIELD" ||
    err.code === "WARN_DATA_TRUNCATED"
  ) {
    return err.sqlMessage || err.message;
  }

  return err.code || null;
}

const LEAD_COLUMN_CANDIDATES = {
  companyName: ["company_name", "company", "business_name"],
  clientName: ["client_name", "client", "customer_name"],
  contact: [
    "contact",
    "client_contact",
    "phone",
    "phone_no",
    "phone_number",
    "mobile",
    "mobile_no",
    "mobile_number",
  ],
  alternateContact: [
    "alternate_contact",
    "alt_contact",
    "client_alternate_contact",
    "alternate_phone",
    "alt_phone",
    "alternate_mobile",
  ],
  telephone: ["telephone", "telephone_no", "landline", "tel"],
  email: ["email", "client_email", "email_id"],
  mapsLink: ["maps_lnk", "maps_link", "map_link", "location"],
};
let cachedLeadColumnSet = null;

async function getLeadColumnSet() {
  if (cachedLeadColumnSet) return cachedLeadColumnSet;

  const [columns] = await dbPromise.query("SHOW COLUMNS FROM leads");
  cachedLeadColumnSet = new Set(columns.map((column) => column.Field));
  return cachedLeadColumnSet;
}

async function getLeadColumnSql(alias, candidates, fallbackSql = "''") {
  const columnSet = await getLeadColumnSet();
  const columnName = candidates.find((candidate) => columnSet.has(candidate));
  return columnName ? `${alias}.${columnName}` : fallbackSql;
}

async function getLeadProjectSelectSql(alias = "l") {
  const companyNameSql = await getLeadColumnSql(
    alias,
    LEAD_COLUMN_CANDIDATES.companyName,
  );
  const clientNameSql = await getLeadColumnSql(
    alias,
    LEAD_COLUMN_CANDIDATES.clientName,
  );
  const contactSql = await getLeadColumnSql(
    alias,
    LEAD_COLUMN_CANDIDATES.contact,
  );
  const alternateContactSql = await getLeadColumnSql(
    alias,
    LEAD_COLUMN_CANDIDATES.alternateContact,
  );
  const telephoneSql = await getLeadColumnSql(
    alias,
    LEAD_COLUMN_CANDIDATES.telephone,
  );
  const emailSql = await getLeadColumnSql(alias, LEAD_COLUMN_CANDIDATES.email);
  const mapsLinkSql = await getLeadColumnSql(
    alias,
    LEAD_COLUMN_CANDIDATES.mapsLink,
  );

  return {
    companyNameSql,
    clientNameSql,
    contactSql,
    alternateContactSql,
    telephoneSql,
    emailSql,
    mapsLinkSql,
    selectSql: `
      ${companyNameSql} AS projectName,
      ${clientNameSql} AS client,
      ${contactSql} AS clientContact,
      ${alternateContactSql} AS clientAlternateContact,
      ${telephoneSql} AS clientTelephone,
      ${emailSql} AS clientEmail,
      ${mapsLinkSql} AS clientMapsLink
    `,
  };
}

async function ensureUserMonthlyTargetColumn() {
  await runSchemaChange(
    "ALTER TABLE users ADD COLUMN monthly_target decimal(12,2) DEFAULT NULL",
    "ER_DUP_FIELDNAME",
  );
}

scheduleSchemaSetup("User monthly target setup", ensureUserMonthlyTargetColumn);

async function ensurePayrollUserColumns() {
  const schemaChanges = [
    "ALTER TABLE users ADD COLUMN department varchar(100) DEFAULT NULL AFTER role",
    "ALTER TABLE users ADD COLUMN salary decimal(12,2) NOT NULL DEFAULT 0 AFTER department",
    "ALTER TABLE users ADD COLUMN joining_date date DEFAULT NULL AFTER salary",
    "ALTER TABLE users ADD COLUMN is_team_lead tinyint(1) NOT NULL DEFAULT 0 AFTER joining_date",
  ];

  for (const sql of schemaChanges) {
    await runSchemaChange(sql, "ER_DUP_FIELDNAME");
  }
}

scheduleSchemaSetup("Payroll user schema setup", ensurePayrollUserColumns);

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

  await runSchemaQuery(sql);

  const [columns] = await runSchemaQuery("SHOW COLUMNS FROM deal_products");
  let columnNames = new Set(columns.map((column) => column.Field));

  if (!columnNames.has("product_name")) {
    if (columnNames.has("name")) {
      await runSchemaQuery(
        "ALTER TABLE deal_products CHANGE COLUMN name product_name varchar(255) NOT NULL",
      );
    } else if (columnNames.has("service_name")) {
      await runSchemaQuery(
        "ALTER TABLE deal_products CHANGE COLUMN service_name product_name varchar(255) NOT NULL",
      );
    } else {
      await runSchemaChange(
        "ALTER TABLE deal_products ADD COLUMN product_name varchar(255) NOT NULL DEFAULT 'Overall Deal' AFTER deal_id",
        "ER_DUP_FIELDNAME",
      );
    }

    const [refreshedColumns] = await runSchemaQuery(
      "SHOW COLUMNS FROM deal_products",
    );
    columnNames = new Set(refreshedColumns.map((column) => column.Field));
  }

  if (!columnNames.has("product_amount") && columnNames.has("product_price")) {
    await runSchemaQuery(
      "ALTER TABLE deal_products CHANGE COLUMN product_price product_amount decimal(12,2) NOT NULL",
    );
    return;
  }

  if (!columnNames.has("product_amount") && columnNames.has("amount")) {
    await runSchemaQuery(
      "ALTER TABLE deal_products CHANGE COLUMN amount product_amount decimal(12,2) NOT NULL",
    );
    return;
  }

  if (!columnNames.has("product_amount") && columnNames.has("price")) {
    await runSchemaQuery(
      "ALTER TABLE deal_products CHANGE COLUMN price product_amount decimal(12,2) NOT NULL",
    );
    return;
  }

  if (!columnNames.has("product_amount")) {
    await runSchemaChange(
      "ALTER TABLE deal_products ADD COLUMN product_amount decimal(12,2) NOT NULL DEFAULT 0 AFTER product_name",
      "ER_DUP_FIELDNAME",
    );
  }
}

scheduleSchemaSetup("Deal products table setup", ensureDealProductsTable);

let dealProductCatalogSchemaReady = false;

function normalizeDealProductStatus(value, fallback = "active") {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();

  if (normalized === "inactive") return "inactive";
  if (normalized === "active") return "active";
  return fallback;
}

function normalizeDealProductCatalogPayload(payload = {}) {
  const name = String(payload.name || payload.product_name || "")
    .trim()
    .replace(/\s+/g, " ");
  const group =
    String(payload.group || payload.product_group || "Other Services")
      .trim()
      .replace(/\s+/g, " ") || "Other Services";
  const price = normalizeServerAmount(
    payload.price ?? payload.product_amount ?? payload.amount,
    NaN,
  );
  const sortOrder = Number.parseInt(
    payload.sort_order ?? payload.sortOrder ?? 0,
    10,
  );

  return {
    name,
    group,
    price,
    sortOrder: Number.isFinite(sortOrder) ? sortOrder : 0,
    status: normalizeDealProductStatus(payload.status, "active"),
  };
}

function mapDealProductCatalogRow(row = {}) {
  return {
    id: Number(row.id || 0),
    name: row.product_name || row.name || "",
    group: row.product_group || row.group || "Other Services",
    price: Number(row.price || 0),
    sort_order: Number(row.sort_order || 0),
    status: normalizeDealProductStatus(row.status, "active"),
  };
}

async function ensureDealProductCatalogTable() {
  if (dealProductCatalogSchemaReady) return;

  await runSchemaQuery(`
    CREATE TABLE IF NOT EXISTS deal_product_catalog (
      id int NOT NULL AUTO_INCREMENT,
      product_name varchar(255) NOT NULL,
      product_group varchar(255) NOT NULL DEFAULT 'Other Services',
      price decimal(12,2) NOT NULL,
      sort_order int NOT NULL DEFAULT 0,
      status varchar(20) NOT NULL DEFAULT 'active',
      created_at datetime DEFAULT CURRENT_TIMESTAMP,
      updated_at datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY unique_deal_product_catalog_name (product_name)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
  `);

  const [columns] = await runSchemaQuery(
    "SHOW COLUMNS FROM deal_product_catalog",
  );
  const columnNames = new Set(columns.map((column) => column.Field));

  if (!columnNames.has("price") && columnNames.has("product_price")) {
    await runSchemaQuery(
      "ALTER TABLE deal_product_catalog CHANGE COLUMN product_price price decimal(12,2) NOT NULL",
    );
    columnNames.delete("product_price");
    columnNames.add("price");
  }

  const schemaChanges = [
    [
      "product_group",
      "ALTER TABLE deal_product_catalog ADD COLUMN product_group varchar(255) NOT NULL DEFAULT 'Other Services' AFTER product_name",
    ],
    [
      "price",
      "ALTER TABLE deal_product_catalog ADD COLUMN price decimal(12,2) NOT NULL DEFAULT 0 AFTER product_group",
    ],
    [
      "sort_order",
      "ALTER TABLE deal_product_catalog ADD COLUMN sort_order int NOT NULL DEFAULT 0 AFTER price",
    ],
    [
      "status",
      "ALTER TABLE deal_product_catalog ADD COLUMN status varchar(20) NOT NULL DEFAULT 'active' AFTER sort_order",
    ],
    [
      "created_at",
      "ALTER TABLE deal_product_catalog ADD COLUMN created_at datetime DEFAULT CURRENT_TIMESTAMP AFTER status",
    ],
    [
      "updated_at",
      "ALTER TABLE deal_product_catalog ADD COLUMN updated_at datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER created_at",
    ],
  ];

  for (const [columnName, sql] of schemaChanges) {
    if (!columnNames.has(columnName)) {
      await runSchemaChange(sql, "ER_DUP_FIELDNAME");
      columnNames.add(columnName);
    }
  }

  const seedValues = DEAL_PRODUCT_CATALOG.map((product, index) => [
    product.name,
    product.group || "Other Services",
    product.price,
    index + 1,
    "active",
  ]);

  if (seedValues.length) {
    await runSchemaQuery(
      `INSERT IGNORE INTO deal_product_catalog
        (product_name, product_group, price, sort_order, status)
       VALUES ?`,
      [seedValues],
    );
  }

  dealProductCatalogSchemaReady = true;
}

scheduleSchemaSetup(
  "Deal product catalog setup",
  ensureDealProductCatalogTable,
);

async function getDealProductCatalog({ includeInactive = false } = {}) {
  await ensureDealProductCatalogTable();

  const where = includeInactive ? "" : "WHERE status <> 'inactive'";
  const [rows] = await dbPromise.query(
    `
      SELECT id, product_name, product_group, price, sort_order, status
      FROM deal_product_catalog
      ${where}
      ORDER BY sort_order ASC, product_group ASC, product_name ASC, id ASC
    `,
  );

  return rows.map(mapDealProductCatalogRow);
}

let dealPaymentSchemaReady = false;

function normalizeServerAmount(value, fallback = 0) {
  const amount = Number(String(value ?? "").replace(/,/g, ""));
  return Number.isFinite(amount) ? amount : fallback;
}

function roundServerAmount(value) {
  return Number(normalizeServerAmount(value, 0).toFixed(2));
}

function normalizeServerPaymentStatus(value, fallback = "pending") {
  const status = String(value || "")
    .toLowerCase()
    .trim();
  return ["pending", "received", "failed"].includes(status) ? status : fallback;
}

function getServerDateKey(value) {
  if (!value) return "";
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, "0");
    const day = String(value.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  const raw = String(value || "").trim();
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) return `${match[1]}-${match[2]}-${match[3]}`;

  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? "" : getServerDateKey(parsed);
}

function addServerDays(dateKey, days) {
  const normalizedDate = getServerDateKey(dateKey);
  if (!normalizedDate) return "";

  const [year, month, day] = normalizedDate.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + Number(days || 0));
  return getServerDateKey(date);
}

function addServerMonths(dateKey, months) {
  const normalizedDate = getServerDateKey(dateKey);
  const monthOffset = Number(months || 0);
  if (!normalizedDate || !Number.isFinite(monthOffset)) return "";

  const [year, month, day] = normalizedDate.split("-").map(Number);
  const targetMonthIndex = month - 1 + Math.trunc(monthOffset);
  const targetMonthStart = new Date(year, targetMonthIndex, 1);
  const targetYear = targetMonthStart.getFullYear();
  const targetMonth = targetMonthStart.getMonth();
  const targetLastDay = new Date(targetYear, targetMonth + 1, 0).getDate();
  const targetDay = Math.min(day, targetLastDay);

  return getServerDateKey(new Date(targetYear, targetMonth, targetDay));
}

function formatServerInvoiceDate(dateKey) {
  const normalizedDate = getServerDateKey(dateKey);
  if (!normalizedDate) return "-";

  const [year, month, day] = normalizedDate.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function getServerTodayKey() {
  return getServerDateKey(new Date());
}

function isServerDateReady(dateKey) {
  const normalizedDate = getServerDateKey(dateKey);
  return Boolean(normalizedDate && normalizedDate <= getServerTodayKey());
}

function calculateServerGstAmount(amount) {
  const numericAmount = normalizeServerAmount(amount, 0);
  if (numericAmount <= 0) return 0;
  return roundServerAmount(numericAmount - numericAmount / 1.18);
}

function hasServerStoredAmount(value) {
  if (value === undefined || value === null) return false;
  const rawValue = String(value).trim();
  if (!rawValue) return false;
  return Number.isFinite(Number(rawValue.replace(/,/g, "")));
}

function calculateServerInclusiveGstBreakup(amount) {
  const grossAmount = roundServerAmount(amount);
  if (grossAmount <= 0) {
    return {
      amountWithoutGst: 0,
      gstAmount: 0,
    };
  }

  const amountWithoutGst = roundServerAmount(grossAmount / 1.18);
  return {
    amountWithoutGst,
    gstAmount: roundServerAmount(Math.max(grossAmount - amountWithoutGst, 0)),
  };
}

function parseServerPartPaymentSchedule(scheduleValue) {
  if (!scheduleValue) return [];
  if (Array.isArray(scheduleValue)) return scheduleValue;

  try {
    const parsed = JSON.parse(String(scheduleValue || "[]"));
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    return [];
  }
}

function normalizeServerDealPaymentType(value) {
  return String(value || "")
    .toLowerCase()
    .trim() === "renewal"
    ? "renewal"
    : "installment";
}

function getServerLeadDownPaymentAmount(lead = {}, payments = []) {
  const storedDownPayment = normalizeServerAmount(
    lead.down_payment_amount,
    NaN,
  );
  if (Number.isFinite(storedDownPayment) && storedDownPayment > 0) {
    return roundServerAmount(storedDownPayment);
  }

  const receivedAmount = normalizeServerAmount(lead.received_amount, 0);
  const receivedPartPayments = payments
    .filter(
      (payment) =>
        normalizeServerPaymentStatus(payment.payment_status) === "received" &&
        normalizeServerDealPaymentType(payment.payment_type) !== "renewal",
    )
    .reduce(
      (sum, payment) => sum + normalizeServerAmount(payment.amount, 0),
      0,
    );
  const inferredDownPayment = Math.max(
    receivedAmount - receivedPartPayments,
    0,
  );

  if (inferredDownPayment > 0) return roundServerAmount(inferredDownPayment);

  if (
    receivedAmount <= 0 &&
    receivedPartPayments <= 0 &&
    normalizeServerPaymentStatus(lead.pay_stat) === "received"
  ) {
    return roundServerAmount(normalizeServerAmount(lead.deal_amount, 0));
  }

  return 0;
}

async function ensureDealPaymentSchema() {
  if (dealPaymentSchemaReady) return;

  const leadColumnChanges = [
    "ALTER TABLE leads ADD COLUMN pay_stat enum('pending','received','failed') NOT NULL DEFAULT 'pending'",
    "ALTER TABLE leads ADD COLUMN received_amount decimal(12,2) DEFAULT NULL",
    "ALTER TABLE leads ADD COLUMN down_payment_amount decimal(12,2) DEFAULT NULL",
    "ALTER TABLE leads ADD COLUMN remaining_amount decimal(12,2) DEFAULT NULL",
    "ALTER TABLE leads ADD COLUMN gst_amount decimal(12,2) DEFAULT NULL",
    "ALTER TABLE leads ADD COLUMN total_gst_amount decimal(12,2) DEFAULT NULL",
    "ALTER TABLE leads ADD COLUMN remaining_gst_amount decimal(12,2) DEFAULT NULL",
    "ALTER TABLE leads ADD COLUMN sales_type varchar(40) DEFAULT NULL",
    "ALTER TABLE leads ADD COLUMN part_payment_option varchar(80) DEFAULT NULL",
    "ALTER TABLE leads ADD COLUMN part_payment_schedule text",
  ];

  for (const sql of leadColumnChanges) {
    await runSchemaChange(sql, "ER_DUP_FIELDNAME");
  }

  await runSchemaQuery(`
    CREATE TABLE IF NOT EXISTS deal_payments (
      id int NOT NULL AUTO_INCREMENT,
      lead_id int NOT NULL,
      sequence_no int NOT NULL DEFAULT 1,
      payment_label varchar(120) DEFAULT NULL,
      payment_type varchar(30) NOT NULL DEFAULT 'installment',
      renewal_id int DEFAULT NULL,
      renewal_service_name varchar(255) DEFAULT NULL,
      renewal_cycle_start_date date DEFAULT NULL,
      amount decimal(12,2) NOT NULL,
      amount_without_gst decimal(12,2) DEFAULT NULL,
      gst_amount decimal(12,2) DEFAULT NULL,
      payment_date date NOT NULL,
      payment_method varchar(120) DEFAULT NULL,
      transaction_id varchar(160) DEFAULT NULL,
      bank_name varchar(160) DEFAULT NULL,
      notes text,
      payment_status enum('pending','received','failed') NOT NULL DEFAULT 'received',
      created_by int DEFAULT NULL,
      created_by_name varchar(160) DEFAULT NULL,
      created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY lead_id (lead_id),
      KEY payment_status (payment_status),
      CONSTRAINT deal_payments_ibfk_1
        FOREIGN KEY (lead_id) REFERENCES leads (id)
        ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
  `);

  const paymentColumnChanges = [
    "ALTER TABLE deal_payments ADD COLUMN sequence_no int NOT NULL DEFAULT 1",
    "ALTER TABLE deal_payments ADD COLUMN payment_label varchar(120) DEFAULT NULL",
    "ALTER TABLE deal_payments ADD COLUMN amount_without_gst decimal(12,2) DEFAULT NULL",
    "ALTER TABLE deal_payments ADD COLUMN gst_amount decimal(12,2) DEFAULT NULL",
    "ALTER TABLE deal_payments ADD COLUMN transaction_id varchar(160) DEFAULT NULL",
    "ALTER TABLE deal_payments ADD COLUMN bank_name varchar(160) DEFAULT NULL",
    "ALTER TABLE deal_payments ADD COLUMN notes text",
    "ALTER TABLE deal_payments ADD COLUMN created_by int DEFAULT NULL",
    "ALTER TABLE deal_payments ADD COLUMN created_by_name varchar(160) DEFAULT NULL",
    "ALTER TABLE deal_payments ADD COLUMN payment_type varchar(30) NOT NULL DEFAULT 'installment'",
    "ALTER TABLE deal_payments ADD COLUMN renewal_id int DEFAULT NULL",
    "ALTER TABLE deal_payments ADD COLUMN renewal_service_name varchar(255) DEFAULT NULL",
    "ALTER TABLE deal_payments ADD COLUMN renewal_cycle_start_date date DEFAULT NULL",
  ];

  for (const sql of paymentColumnChanges) {
    await runSchemaChange(sql, "ER_DUP_FIELDNAME");
  }

  dealPaymentSchemaReady = true;
}

scheduleSchemaSetup("Deal payment schema setup", ensureDealPaymentSchema);

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
      company_scope varchar(30) DEFAULT NULL,
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

  await runSchemaQuery(sql);

  const schemaChanges = [
    "ADD COLUMN requested_by int DEFAULT NULL AFTER lead_id",
    "ADD COLUMN product_name varchar(255) NOT NULL DEFAULT 'Overall Deal' AFTER requested_by",
    "ADD COLUMN standard_amount decimal(12,2) NOT NULL DEFAULT 0 AFTER product_name",
    "ADD COLUMN requested_amount decimal(12,2) NOT NULL DEFAULT 0 AFTER standard_amount",
    "ADD COLUMN company_scope varchar(30) DEFAULT NULL AFTER requested_amount",
    "ADD COLUMN reason text NULL AFTER requested_amount",
    "ADD COLUMN status enum('pending','approved','rejected') NOT NULL DEFAULT 'pending' AFTER reason",
    "ADD COLUMN admin_note text NULL AFTER status",
    "ADD COLUMN reviewed_by int DEFAULT NULL AFTER admin_note",
    "ADD COLUMN reviewed_at datetime DEFAULT NULL AFTER reviewed_by",
    "ADD COLUMN created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP AFTER reviewed_at",
  ];

  for (const change of schemaChanges) {
    await runSchemaChange(
      `ALTER TABLE downsale_requests ${change}`,
      "ER_DUP_FIELDNAME",
    );
  }

  await runSchemaChange(
    "ALTER TABLE downsale_requests ADD KEY status (status)",
    "ER_DUP_KEYNAME",
  );
  await runSchemaChange(
    "ALTER TABLE downsale_requests ADD KEY downsale_requests_company_scope_idx (company_scope)",
    "ER_DUP_KEYNAME",
  );
  downsaleRequestsSchemaReady = true;
}

scheduleSchemaSetup(
  "Downsale requests table setup",
  ensureDownsaleRequestsTable,
);

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

scheduleSchemaSetup(
  "Project assignment workflow setup",
  ensureProjectAssignmentWorkflowColumns,
);

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

  await runSchemaQuery(sql);
  await runSchemaChange(
    "ALTER TABLE project_phase_details ADD COLUMN attachments_json longtext DEFAULT NULL AFTER deliverable_link",
    "ER_DUP_FIELDNAME",
  );
}

scheduleSchemaSetup(
  "Project phase details table setup",
  ensureProjectPhaseDetailsTable,
);

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

  await runSchemaQuery(sql);
  const columns = [
    "ADD COLUMN check_in_lat decimal(10,8) DEFAULT NULL AFTER check_out",
    "ADD COLUMN check_in_lng decimal(11,8) DEFAULT NULL AFTER check_in_lat",
    "ADD COLUMN check_in_location varchar(500) DEFAULT NULL AFTER check_in_lng",
    "ADD COLUMN admin_override_status varchar(30) DEFAULT NULL AFTER status",
    "ADD COLUMN admin_override_at datetime DEFAULT NULL AFTER admin_override_status",
    "ADD COLUMN admin_override_by int DEFAULT NULL AFTER admin_override_at",
    "MODIFY COLUMN status varchar(30) DEFAULT 'present'",
  ];

  for (const columnSql of columns) {
    await runSchemaChange(
      `ALTER TABLE attendance ${columnSql}`,
      "ER_DUP_FIELDNAME",
    );
  }

  attendanceSchemaReady = true;
}

scheduleSchemaSetup("Attendance table setup", ensureAttendanceTable);

let attendanceLocationRequestsSchemaReady = false;
let attendanceLocationRequestsSchemaPromise = null;

async function ensureAttendanceLocationRequestsTable() {
  if (attendanceLocationRequestsSchemaReady) return;
  if (attendanceLocationRequestsSchemaPromise) {
    return attendanceLocationRequestsSchemaPromise;
  }

  attendanceLocationRequestsSchemaPromise = (async () => {
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
        requested_radius_meters int NOT NULL DEFAULT 50000,
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
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `;

    await runSchemaQuery(sql);

    const requiredColumns = [
      [
        "requested_accuracy",
        "ADD COLUMN requested_accuracy decimal(8,2) DEFAULT NULL AFTER requested_lng",
      ],
      [
        "requested_location_url",
        "ADD COLUMN requested_location_url varchar(500) DEFAULT NULL AFTER requested_accuracy",
      ],
      [
        "requested_address",
        "ADD COLUMN requested_address varchar(255) DEFAULT NULL AFTER requested_location_url",
      ],
      [
        "requested_radius_meters",
        "ADD COLUMN requested_radius_meters int NOT NULL DEFAULT 50000 AFTER requested_address",
      ],
      [
        "admin_remark",
        "ADD COLUMN admin_remark varchar(500) DEFAULT NULL AFTER status",
      ],
      [
        "reviewed_by",
        "ADD COLUMN reviewed_by int DEFAULT NULL AFTER admin_remark",
      ],
      [
        "reviewed_by_name",
        "ADD COLUMN reviewed_by_name varchar(255) DEFAULT NULL AFTER reviewed_by",
      ],
      [
        "reviewed_at",
        "ADD COLUMN reviewed_at datetime DEFAULT NULL AFTER reviewed_by_name",
      ],
      [
        "approved_lat",
        "ADD COLUMN approved_lat decimal(10,8) DEFAULT NULL AFTER reviewed_at",
      ],
      [
        "approved_lng",
        "ADD COLUMN approved_lng decimal(11,8) DEFAULT NULL AFTER approved_lat",
      ],
      [
        "approved_location_url",
        "ADD COLUMN approved_location_url varchar(500) DEFAULT NULL AFTER approved_lng",
      ],
      [
        "approved_address",
        "ADD COLUMN approved_address varchar(255) DEFAULT NULL AFTER approved_location_url",
      ],
      [
        "approved_radius_meters",
        "ADD COLUMN approved_radius_meters int DEFAULT NULL AFTER approved_address",
      ],
      [
        "created_at",
        "ADD COLUMN created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP",
      ],
      [
        "updated_at",
        "ADD COLUMN updated_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP",
      ],
    ];

    const [columns] = await runSchemaQuery(
      "SHOW COLUMNS FROM attendance_location_requests",
    );
    const columnNames = new Set(
      columns.map((column) => String(column.Field || "").toLowerCase()),
    );

    for (const [columnName, columnSql] of requiredColumns) {
      if (columnNames.has(columnName)) continue;
      await runSchemaChange(
        `ALTER TABLE attendance_location_requests ${columnSql}`,
        "ER_DUP_FIELDNAME",
      );
      columnNames.add(columnName);
    }

    await runSchemaChange(
      "ALTER TABLE attendance_location_requests MODIFY COLUMN status varchar(30) NOT NULL DEFAULT 'pending'",
      "",
    );

    attendanceLocationRequestsSchemaReady = true;
  })().finally(() => {
    attendanceLocationRequestsSchemaPromise = null;
  });

  return attendanceLocationRequestsSchemaPromise;
}

scheduleSchemaSetup(
  "Attendance location requests table setup",
  ensureAttendanceLocationRequestsTable,
);

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

  await runSchemaQuery(sql);
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

scheduleSchemaSetup("Leave requests table setup", ensureLeaveRequestsTable);

const LEAVE_ROLE_LEADER_EMAILS = Object.freeze(
  Object.entries(rawLeaveRoleLeaderEmails || {}).reduce(
    (config, [role, email]) => {
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
    },
    {},
  ),
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
const LEAVE_ALWAYS_PAID_TYPES = new Set(["work_from_home"]);

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
  const allowedStatuses = new Set([
    "not_required",
    "pending",
    "approved",
    "rejected",
  ]);
  return allowedStatuses.has(normalized) ? normalized : "not_required";
}

function parseDateOnlyValue(dateValue) {
  const match = String(dateValue || "")
    .trim()
    .match(/^(\d{4})-(\d{2})-(\d{2})$/);
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

function normalizeLeaveAttachment(file) {
  if (!file?.filename) return null;
  return `uploads/leaves/${file.filename}`.replace(/\\/g, "/");
}

async function getUserRecordById(userId) {
  const normalizedUserId = Number(userId);
  if (!Number.isFinite(normalizedUserId) || normalizedUserId <= 0) return null;

  const [rows] = await dbPromise.query(
    `
      SELECT id, name, role, email, joining_date, comp_name
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
  const [year, month] = String(monthKey || "")
    .split("-")
    .map(Number);
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

    const firstLeaveDate = normalizeDateOnlyValue(
      firstLeaveRow?.first_leave_date,
    );
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
    comp_name: snapshot.compName || "",
    company_scope:
      normalizeCompanyScopeKey(snapshot.companyScope || snapshot.compName) ||
      "metrics",
    companyScope:
      normalizeCompanyScopeKey(snapshot.companyScope || snapshot.compName) ||
      "metrics",
    company_scope_key:
      normalizeCompanyScopeKey(snapshot.companyScope || snapshot.compName) ||
      "metrics",
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
    carryForwardBalance: formatBalanceValue(snapshot.carryForwardBalance),
    currentMonthCredit: formatBalanceValue(snapshot.currentMonthCredit),
    currentMonthPaidLeavesUsed: formatBalanceValue(
      snapshot.currentMonthPaidLeavesUsed,
    ),
    currentMonthUnusedCredit: formatBalanceValue(
      snapshot.currentMonthUnusedCredit,
    ),
    nextCreditDate: snapshot.nextCreditDate || "",
  };
}

async function buildLeaveBalanceSnapshot(user, options = {}) {
  const normalizedUserId = Number(user?.id || 0);
  const referenceDate =
    normalizeDateOnlyValue(options.referenceDate) ||
    formatPayrollDateOnly(new Date());

  if (!normalizedUserId || !referenceDate) {
    return {
      userId: normalizedUserId,
      employeeName: user?.name || "Employee",
      role: normalizeRoleValue(user?.role),
      compName: user?.comp_name || "",
      companyScope:
        normalizeCompanyScopeKey(user?.company_scope_key || user?.comp_name) ||
        "metrics",
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
      carryForwardBalance: 0,
      currentMonthCredit: 0,
      currentMonthPaidLeavesUsed: 0,
      currentMonthUnusedCredit: 0,
      nextCreditDate: getFirstDateOfNextMonth(
        getMonthKeyFromDateValue(referenceDate),
      ),
      approvedLeaveEntries: 0,
      dayStatusMap: new Map(),
      monthBreakdown: [],
    };
  }

  const { accrualStartDate, accrualSource } =
    await resolveLeaveAccrualStartMeta(user);
  const accrualStartMonthKey = getMonthKeyFromDateValue(accrualStartDate);
  const referenceMonthKey = getMonthKeyFromDateValue(referenceDate);
  const approvedLeaveRows = await getApprovedLeaveRowsUpToDate(
    normalizedUserId,
    referenceDate,
  );
  const orderedLeaveRows = approvedLeaveRows.slice().sort((left, right) => {
    const leftDate = normalizeDateOnlyValue(left?.from_date);
    const rightDate = normalizeDateOnlyValue(right?.from_date);

    if (leftDate !== rightDate) {
      return leftDate.localeCompare(rightDate);
    }

    const leftIsHalfDay =
      normalizeLeaveKey(left?.leave_type) === "half_day" ? 1 : 0;
    const rightIsHalfDay =
      normalizeLeaveKey(right?.leave_type) === "half_day" ? 1 : 0;
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
        carryForwardAtStart: availableBalance,
        monthlyCredit: 0,
        paidLeaveDaysUsed: 0,
        unpaidEligibleDays: 0,
        alwaysPaidDays: 0,
        availableBalance,
      });
    }

    return monthBreakdownMap.get(monthKey);
  }

  function ensureCreditsThroughMonth(targetMonthKey) {
    if (
      !monthCursor ||
      !targetMonthKey ||
      monthCursor.localeCompare(targetMonthKey) > 0
    ) {
      return;
    }

    while (monthCursor && monthCursor.localeCompare(targetMonthKey) <= 0) {
      const monthEntry = getMonthEntry(monthCursor);
      monthEntry.carryForwardAtStart = availableBalance;
      monthEntry.monthlyCredit += LEAVE_MONTHLY_CREDIT;

      availableBalance += LEAVE_MONTHLY_CREDIT;
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
    const endDate =
      originalEndDate && originalEndDate.localeCompare(referenceDate) > 0
        ? referenceDate
        : originalEndDate;

    if (!startDate || !endDate || startDate.localeCompare(endDate) > 0) {
      return;
    }

    const dateKeys =
      leaveType === "half_day"
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
    carryForwardAtStart: 0,
    monthlyCredit: 0,
    paidLeaveDaysUsed: 0,
    unpaidEligibleDays: 0,
    alwaysPaidDays: 0,
    availableBalance,
  };
  const currentMonthCredit = Number(currentMonthEntry.monthlyCredit || 0);
  const currentMonthPaidLeavesUsed = Number(
    currentMonthEntry.paidLeaveDaysUsed || 0,
  );
  const currentMonthUnusedCredit = Math.max(
    0,
    currentMonthCredit - currentMonthPaidLeavesUsed,
  );
  const carryForwardBalance = Math.max(
    0,
    Number(currentMonthEntry.carryForwardAtStart || 0) -
      Math.max(0, currentMonthPaidLeavesUsed - currentMonthCredit),
  );

  return {
    userId: normalizedUserId,
    employeeName: user?.name || "Employee",
    role: normalizeRoleValue(user?.role),
    compName: user?.comp_name || "",
    companyScope:
      normalizeCompanyScopeKey(user?.company_scope_key || user?.comp_name) ||
      "metrics",
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
    carryForwardBalance,
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

async function getLeaveBalanceUsersForAdmin(companyScopeFilter = "") {
  const normalizedCompanyScope = normalizeCompanyScopeKey(companyScopeFilter);
  const whereClauses = [
    "LOWER(TRIM(COALESCE(u.role, ''))) <> 'admin'",
  ];
  const params = [];

  if (normalizedCompanyScope) {
    whereClauses.push(`${getUserCompanyScopeSql("u")} = ?`);
    params.push(normalizedCompanyScope);
  }

  const [rows] = await dbPromise.query(
    `
      SELECT
        u.id,
        u.name,
        u.role,
        u.email,
        u.joining_date,
        u.comp_name,
        ${getUserCompanyScopeSql("u")} AS company_scope_key
      FROM users u
      WHERE ${whereClauses.join(" AND ")}
      ORDER BY LOWER(TRIM(COALESCE(u.role, ''))) ASC, u.name ASC, u.id ASC
    `,
    params,
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

  if (
    !leaderEmail ||
    isDirectAdminLeaveRole(role) ||
    userEmail === leaderEmail
  ) {
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
  const leaderReviewerName = String(
    row?.leader_reviewer_name || leaderName || "",
  ).trim();
  const adminReviewerName = String(row?.admin_reviewer_name || "").trim();

  if (!approvalStage) {
    if (
      status === "pending" &&
      approvalRoute === "leader" &&
      leaderStatus === "pending"
    ) {
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
      reviewRemark = decisionByLabel
        ? `Approved by ${decisionByLabel}`
        : "Approved";
    } else if (status === "rejected") {
      reviewRemark = decisionByLabel
        ? `Rejected by ${decisionByLabel}`
        : "Rejected";
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
  if (!Number.isFinite(normalizedLeaveId) || normalizedLeaveId <= 0)
    return null;

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

  if (
    !expectedLeaderEmail ||
    normalizeEmailValue(leaderUser.email) !== expectedLeaderEmail
  ) {
    const error = new Error(
      "Only configured team leaders can review these leave requests",
    );
    error.statusCode = 403;
    throw error;
  }

  return leaderUser;
}

async function removeLeaveAttachment(attachmentPath) {
  const normalizedPath = String(attachmentPath || "")
    .trim()
    .replace(/^\/+/, "");
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
  return `(
    ${attAlias}.check_in IS NOT NULL
    AND (
      ${attAlias}.check_out IS NULL
      OR TIME(${attAlias}.check_out) = TIME('00:00:00')
    )
  )`;
}

function getAttendanceInvalidCheckoutSql(attAlias = "a") {
  const resolvedCheckoutSql = getAttendanceResolvedCheckoutSql(attAlias);
  return `(
    ${attAlias}.check_in IS NOT NULL
    AND ${attAlias}.check_out IS NOT NULL
    AND TIMESTAMPDIFF(SECOND, ${attAlias}.check_in, ${resolvedCheckoutSql}) < 0
  )`;
}

function getAttendanceLocalDateTimeSql(valueSql) {
  return valueSql;
}

function getAttendanceLocalTimeSql(valueSql) {
  return `TIME(${getAttendanceLocalDateTimeSql(valueSql)})`;
}

function getAttendanceResolvedCheckoutSql(attAlias = "a") {
  return `CASE
    WHEN ${attAlias}.check_in IS NOT NULL
      AND ${attAlias}.check_out IS NOT NULL
      AND TIME(${attAlias}.check_out) <> TIME('00:00:00')
      AND (
        (
          TIME(${attAlias}.check_out) < TIME(${attAlias}.check_in)
          AND TIME(DATE_ADD(${attAlias}.check_out, INTERVAL 330 MINUTE)) >= TIME(${attAlias}.check_in)
        )
        OR TIMESTAMPDIFF(MINUTE, ${attAlias}.check_out, ${attAlias}.updated_at) BETWEEN 300 AND 360
      )
    THEN DATE_ADD(${attAlias}.check_out, INTERVAL 330 MINUTE)
    ELSE ${attAlias}.check_out
  END`;
}

function getAttendanceTodaySql() {
  return `DATE(${getAttendanceNowSql()})`;
}

function getAttendanceNowSql() {
  return `DATE_ADD(UTC_TIMESTAMP(), INTERVAL 330 MINUTE)`;
}

const ATTENDANCE_GRACE_MINUTES = 10;
const ATTENDANCE_HALF_DAY_CHECKIN_AFTER_MINUTES = 60;
const ATTENDANCE_HALF_DAY_MIN_WORK_MINUTES = 4 * 60;

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
function getAttendanceTimeAfterMinutesSql(timeSql, minutes) {
  return `ADDTIME(${timeSql}, SEC_TO_TIME(${Number(minutes || 0) * 60}))`;
}
function getAttendanceGraceEndSql(userAlias = "u") {
  return getAttendanceTimeAfterMinutesSql(
    getAttendanceShiftStartSql(userAlias),
    ATTENDANCE_GRACE_MINUTES,
  );
}

function getAttendanceHalfDayCheckInAfterSql(userAlias = "u") {
  return getAttendanceTimeAfterMinutesSql(
    getAttendanceShiftStartSql(userAlias),
    ATTENDANCE_HALF_DAY_CHECKIN_AFTER_MINUTES,
  );
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
  const missingCheckoutSql = getAttendanceMissingCheckoutSql(
    attAlias,
    userAlias,
  );
  const invalidCheckoutSql = getAttendanceInvalidCheckoutSql(attAlias);
  const resolvedCheckoutSql = getAttendanceResolvedCheckoutSql(attAlias);
  const overrideStatusSql = getAttendanceOverrideStatusSql(attAlias);
  const shiftStartSql = getAttendanceShiftStartSql(userAlias);
  const graceEndSql = getAttendanceGraceEndSql(userAlias);
  const halfDayCheckInAfterSql = getAttendanceHalfDayCheckInAfterSql(userAlias);
  const checkInTimeSql = getAttendanceLocalTimeSql(`${attAlias}.check_in`);
  const workedMinutesSql = `TIMESTAMPDIFF(MINUTE, ${attAlias}.check_in, ${resolvedCheckoutSql})`;
  return `CASE
    WHEN ${overrideStatusSql} IS NOT NULL THEN ${overrideStatusSql}
    WHEN DAYOFWEEK(${attAlias}.attendance_date) = 1 THEN 'sunday'
    WHEN ${attAlias}.check_in IS NULL THEN 'absent'
    WHEN ${missingCheckoutSql} THEN 'checkout_pending'
    WHEN ${invalidCheckoutSql} THEN 'checkout_pending'
    WHEN ${checkInTimeSql} >= ${halfDayCheckInAfterSql} THEN 'half_day'
    WHEN ${attAlias}.check_out IS NOT NULL
      AND ${workedMinutesSql} < ${ATTENDANCE_HALF_DAY_MIN_WORK_MINUTES}
    THEN 'half_day'
    WHEN ${checkInTimeSql} > ${graceEndSql} THEN 'late'
    WHEN ${checkInTimeSql} > ${shiftStartSql} THEN 'grace'
    ELSE 'present'
  END`;
}

function getAttendanceStatusLabelSql(attAlias = "a", userAlias = "u") {
  const missingCheckoutSql = getAttendanceMissingCheckoutSql(
    attAlias,
    userAlias,
  );
  const invalidCheckoutSql = getAttendanceInvalidCheckoutSql(attAlias);
  const resolvedCheckoutSql = getAttendanceResolvedCheckoutSql(attAlias);
  const overrideStatusSql = getAttendanceOverrideStatusSql(attAlias);
  const shiftStartSql = getAttendanceShiftStartSql(userAlias);
  const graceEndSql = getAttendanceGraceEndSql(userAlias);
  const halfDayCheckInAfterSql = getAttendanceHalfDayCheckInAfterSql(userAlias);
  const checkInTimeSql = getAttendanceLocalTimeSql(`${attAlias}.check_in`);
  const workedMinutesSql = `TIMESTAMPDIFF(MINUTE, ${attAlias}.check_in, ${resolvedCheckoutSql})`;
  return `CASE
    WHEN ${overrideStatusSql} = 'present' THEN 'Present'
    WHEN ${overrideStatusSql} = 'grace' THEN 'Grace'
    WHEN ${overrideStatusSql} = 'late' THEN 'Late'
    WHEN ${overrideStatusSql} = 'half_day' THEN 'Half Day'
    WHEN ${overrideStatusSql} = 'half_day_late' THEN 'Half Day + Late'
    WHEN ${overrideStatusSql} = 'absent' THEN 'Absent'
    WHEN ${overrideStatusSql} = 'checkout_pending' THEN 'Checkout Pending'
    WHEN DAYOFWEEK(${attAlias}.attendance_date) = 1 THEN 'Sunday'
    WHEN ${attAlias}.check_in IS NULL THEN 'Absent'
    WHEN ${missingCheckoutSql} THEN 'Checkout Pending'
    WHEN ${invalidCheckoutSql} THEN 'Checkout Pending'
    WHEN ${checkInTimeSql} >= ${halfDayCheckInAfterSql} THEN 'Half Day'
    WHEN ${attAlias}.check_out IS NOT NULL
      AND ${workedMinutesSql} < ${ATTENDANCE_HALF_DAY_MIN_WORK_MINUTES}
    THEN 'Half Day'
    WHEN ${checkInTimeSql} > ${graceEndSql} THEN 'Late'
    WHEN ${checkInTimeSql} > ${shiftStartSql} THEN 'Grace'
    ELSE 'Present'
  END`;
}

function getAttendanceWorkingHoursSql(attAlias = "a", userAlias = "u") {
  const missingCheckoutSql = getAttendanceMissingCheckoutSql(
    attAlias,
    userAlias,
  );
  const invalidCheckoutSql = getAttendanceInvalidCheckoutSql(attAlias);
  const resolvedCheckoutSql = getAttendanceResolvedCheckoutSql(attAlias);
  const durationSecondsSql = `TIMESTAMPDIFF(SECOND, ${attAlias}.check_in, ${resolvedCheckoutSql})`;
  return `CASE
    WHEN ${attAlias}.check_in IS NULL THEN '00:00'
    WHEN ${missingCheckoutSql} THEN 'Pending'
    WHEN ${invalidCheckoutSql} THEN 'Pending'
    ELSE CONCAT(
      FLOOR(${durationSecondsSql} / 3600),
      ':',
      LPAD(FLOOR((${durationSecondsSql} % 3600) / 60), 2, '0')
    )
  END`;
}

const ATTENDANCE_TRACKING_START_DATE = "2026-05-01";
const ATTENDANCE_OFFICE_LOCATIONS = [
  {
    type: "office",
    companyKey: "metrics",
    label: "Metrics Office",
    latitude: 19.168462596195486,
    longitude: 72.84219765234043,
    radiusMeters: Number(process.env.ATTENDANCE_GEOFENCE_RADIUS_METERS || 50),
    address:
      "Riddhi Siddhi Complex, E-107, Swami Vivekananda Rd, opposite Patkar College, Unnat Nagar, Goregaon West, Mumbai, Maharashtra 400104",
  },
  {
    type: "office",
    companyKey: "redsea",
    label: "Redsea Office",
    latitude: 28.6260020948207,
    longitude: 77.37907033383912,
    radiusMeters: Number(process.env.ATTENDANCE_GEOFENCE_RADIUS_METERS || 50),
    address: "Redsea Office, Delhi/NCR",
  },
].map((loc) => ({
  ...loc,
  locationUrl: `https://www.google.com/maps?q=${loc.latitude},${loc.longitude}`,
}));
const ATTENDANCE_GPS_ACCURACY_BUFFER_METERS = Number(
  process.env.ATTENDANCE_GPS_ACCURACY_BUFFER_METERS || 25,
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

function parseAttendanceTimeInput(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";

  const match = raw.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!match) return null;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  const seconds = Number(match[3] || 0);

  if (
    !Number.isInteger(hours) ||
    !Number.isInteger(minutes) ||
    !Number.isInteger(seconds) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59 ||
    seconds < 0 ||
    seconds > 59
  ) {
    return null;
  }

  return `${padAttendanceTimeSegment(hours)}:${padAttendanceTimeSegment(minutes)}:${padAttendanceTimeSegment(seconds)}`;
}

function timeStringToMinutes(value) {
  const normalized = normalizeAttendanceTimeString(value);
  const [hours, minutes] = normalized.split(":");
  return Number(hours) * 60 + Number(minutes);
}

function minutesToTimeString(totalMinutes) {
  const normalizedMinutes = ((Number(totalMinutes) % 1440) + 1440) % 1440;
  const hours = Math.floor(normalizedMinutes / 60);
  const minutes = normalizedMinutes % 60;
  return `${padAttendanceTimeSegment(hours)}:${padAttendanceTimeSegment(minutes)}:00`;
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

  const gpsAccuracyBuffer = getAttendanceAccuracyBuffer(accuracyMeters);
  let minDistance = Infinity;
  let closestOffice = null;

  for (const office of ATTENDANCE_OFFICE_LOCATIONS) {
    const distanceMeters = calculateDistanceInMeters(
      lat,
      lng,
      office.latitude,
      office.longitude,
    );
    const effectiveRadiusMeters =
      Number(office.radiusMeters || 0) + gpsAccuracyBuffer;

    if (distanceMeters <= effectiveRadiusMeters) {
      return distanceMeters;
    }

    if (distanceMeters < minDistance) {
      minDistance = distanceMeters;
      closestOffice = office;
    }
  }

  const roundedDistanceMeters = Math.round(minDistance);
  const error = new Error(
    `Check-in / check-out only works within ${closestOffice.radiusMeters}m of ${closestOffice.address}. Current distance is about ${roundedDistanceMeters}m.`,
  );
  error.statusCode = 400;
  throw error;
}

function getAttendanceOfficeZone() {
  return ATTENDANCE_OFFICE_LOCATIONS[0];
}

function getAttendanceOfficeZones() {
  return ATTENDANCE_OFFICE_LOCATIONS;
}

function buildAttendanceLocationUrl(lat, lng) {
  if (!Number.isFinite(Number(lat)) || !Number.isFinite(Number(lng))) {
    return null;
  }

  return `https://www.google.com/maps?q=${Number(lat)},${Number(lng)}`;
}

function normalizeAttendanceLocationRequestStatus(
  status,
  fallback = "pending",
) {
  const normalizedStatus = String(status || "")
    .trim()
    .toLowerCase();
  const allowedStatuses = new Set([
    "pending",
    "approved",
    "rejected",
    "cancelled",
  ]);
  return allowedStatuses.has(normalizedStatus) ? normalizedStatus : fallback;
}

function normalizeAttendanceRadiusMeters(
  value,
  fallback = ATTENDANCE_OFFSITE_DEFAULT_RADIUS_METERS,
) {
  const numericValue = Math.round(Number(value));
  const baseValue =
    Number.isFinite(numericValue) && numericValue > 0
      ? numericValue
      : Math.round(
          Number(fallback) || ATTENDANCE_OFFSITE_DEFAULT_RADIUS_METERS,
        );

  return Math.max(
    30,
    Math.min(ATTENDANCE_OFFSITE_MAX_RADIUS_METERS, baseValue),
  );
}

function getAttendanceDateKey(dateValue = new Date()) {
  if (dateValue instanceof Date) {
    return getIndiaDateTimeParts(dateValue).date;
  }

  return String(dateValue || "").slice(0, 10);
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
        Number.isFinite(Number(row.approved_lat))
          ? row.approved_lat
          : row.requested_lat,
        Number.isFinite(Number(row.approved_lng))
          ? row.approved_lng
          : row.requested_lng,
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
    address:
      request.approvedAddress ||
      request.requestedAddress ||
      "Approved meeting location",
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
    Number(zone.radiusMeters || 0) +
    getAttendanceAccuracyBuffer(accuracyMeters);

  return {
    distanceMeters,
    effectiveRadiusMeters,
    withinRange: distanceMeters <= effectiveRadiusMeters,
  };
}

async function getLatestAttendanceLocationRequest(
  userId,
  attendanceDate = getAttendanceDateKey(),
) {
  const normalizedUserId = Number(userId);
  const normalizedDate = getAttendanceDateKey(attendanceDate);

  if (!normalizedUserId || !normalizedDate) return null;

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
      WHERE user_id = ? AND attendance_date = ?
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
  const [userRows] = await dbPromise.query(
    "SELECT role, comp_name FROM users WHERE id = ? LIMIT 1",
    [Number(userId)],
  );
  const user = userRows[0] || {};
  const userRole = normalizeAttendanceRole(user.role);
  const userCompanyKey = normalizeCompanyScopeKey(user.comp_name) || "metrics";
  const officeZones = getAttendanceOfficeZones();
  const officeZone =
    officeZones.find((zone) => zone.companyKey === userCompanyKey) ||
    getAttendanceOfficeZone();
  const activeRequest =
    userRole === "me"
      ? await getLatestAttendanceLocationRequest(userId, attendanceDate)
      : null;
  const approvedZone =
    activeRequest?.status === "approved"
      ? getAttendanceApprovedZone(activeRequest)
      : null;

  return {
    officeZone,
    officeZones,
    activeRequest,
    activeZone: approvedZone || officeZone,
    approvedZone,
    canRequestOffsite: userRole === "me",
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
    "SELECT role, comp_name FROM users WHERE id = ? LIMIT 1",
    [userId],
  );
  const userRole = normalizeAttendanceRole(userRows[0]?.role);
  const userCompanyKey =
    userRows.length > 0
      ? normalizeCompanyScopeKey(userRows[0].comp_name)
      : "metrics";

  let officeZones = getAttendanceOfficeZones();
  const companyOfficeZones = officeZones.filter(
    (z) => !z.companyKey || z.companyKey === userCompanyKey,
  );
  if (companyOfficeZones.length > 0) {
    officeZones = companyOfficeZones;
  }

  let minOfficeDistance = Infinity;
  let closestOfficeZone = null;

  for (const officeZone of officeZones) {
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

    if (officeMatch.distanceMeters < minOfficeDistance) {
      minOfficeDistance = officeMatch.distanceMeters;
      closestOfficeZone = officeZone;
    }
  }

  if (userRole !== "me") {
    const error = new Error(
      `Check-in / check-out only works within ${closestOfficeZone.radiusMeters}m of ${closestOfficeZone.address}. Your current distance is about ${Math.round(minOfficeDistance)}m.`,
    );
    error.statusCode = 400;
    throw error;
  }

  const activeRequest = await getLatestAttendanceLocationRequest(
    userId,
    attendanceDate,
  );
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
      `Admin approved attendance within ${approvedZone.radiusMeters}m of ${approvedZone.address}. Your current distance is about ${Math.round(approvedMatch.distanceMeters)}m.`,
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
        : " If you are at a client meeting or field location, submit an optional offsite request and wait for admin approval before marking attendance there.";

  const error = new Error(
    `Check-in / check-out only works within ${closestOfficeZone.radiusMeters}m of ${closestOfficeZone.address}.${approvalHint}`,
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
      graceEnd: "10:10:00",
      requiredHours: 9,
    };
  }

  if (normalizedRole === "me") {
    return {
      shiftStart: "10:00:00",
      shiftEnd: "19:00:00",
      graceEnd: "10:10:00",
      requiredHours: 9,
    };
  }

  if (normalizedRole === "dev") {
    return {
      shiftStart: "08:00:00",
      shiftEnd: "16:00:00",
      graceEnd: "08:10:00",
      requiredHours: 8,
    };
  }

  if (normalizedRole === "seo" || normalizedRole === "smo") {
    return {
      shiftStart: "08:00:00",
      shiftEnd: "16:00:00",
      graceEnd: "08:10:00",
      requiredHours: 8,
    };
  }

  const normalizedLogout = normalizeAttendanceTimeString(
    logoutTime,
    "18:00:00",
  );
  const shiftEndMinutes = timeStringToMinutes(normalizedLogout);
  const shiftStartMinutes = shiftEndMinutes - 8 * 60;

  return {
    shiftStart: minutesToTimeString(shiftStartMinutes),
    shiftEnd: normalizedLogout,
    graceEnd: minutesToTimeString(shiftStartMinutes + ATTENDANCE_GRACE_MINUTES),
    requiredHours: 8,
  };
}

function isAttendanceDateAutoAbsent(
  attendanceDate,
  shiftEnd,
  now = new Date(),
) {
  if (!attendanceDate) return false;

  const currentParts = getIndiaDateTimeParts(now);
  const todayKey = currentParts.date;
  if (attendanceDate < todayKey) return true;
  if (attendanceDate > todayKey) return false;

  return currentParts.time > normalizeAttendanceTimeString(shiftEnd);
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

  if (isSundayDateKey(attendanceDate)) {
    return "sunday";
  }

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

  if (normalizedCheckOut < normalizedCheckIn) {
    return "checkout_pending";
  }

  const checkInMinutes = timeStringToMinutes(normalizedCheckIn);
  const checkOutMinutes = timeStringToMinutes(normalizedCheckOut);
  const halfDayCheckInAfterMinutes =
    timeStringToMinutes(shiftConfig.shiftStart) +
    ATTENDANCE_HALF_DAY_CHECKIN_AFTER_MINUTES;
  const workedMinutes = checkOutMinutes - checkInMinutes;

  if (
    checkInMinutes >= halfDayCheckInAfterMinutes ||
    workedMinutes < ATTENDANCE_HALF_DAY_MIN_WORK_MINUTES
  ) {
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
  switch (
    String(status || "")
      .toLowerCase()
      .trim()
      .replace(/[\s-]+/g, "_")
  ) {
    case "present":
      return "Present";
    case "grace":
      return "Grace";
    case "late":
      return "Late";
    case "half_day":
      return "Half Day";
    case "half_day_late":
      return "Half Day + Late";
    case "checkout_pending":
      return "Checkout Pending";
    case "sunday":
      return "Sunday";
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
  const checkInDate = new Date(
    `${baseDate}T${normalizeAttendanceTimeString(checkIn)}`,
  );
  const checkOutDate = new Date(
    `${baseDate}T${normalizeAttendanceTimeString(checkOut)}`,
  );

  if (checkOutDate < checkInDate) {
    return "Pending";
  }

  const diffMinutes = Math.max(
    0,
    Math.floor((checkOutDate - checkInDate) / 60000),
  );
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
  const dateParts = getIndiaDateTimeParts(parseAttendanceCheckoutDate(value));
  return `${dateParts.date} ${dateParts.time}`;
}

function formatAttendanceLocalDateTimeForSql(dateKey, timeValue) {
  const dateMatch = String(dateKey || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const timeString = normalizeAttendanceTimeString(timeValue);
  const timeMatch = timeString.match(/^(\d{2}):(\d{2}):(\d{2})$/);

  if (!dateMatch || !timeMatch) {
    return formatAttendanceDateTimeForSql(new Date());
  }

  return `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]} ${timeMatch[1]}:${timeMatch[2]}:${timeMatch[3]}`;
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

  const parsedCheckoutAt = parseAttendanceCheckoutDate(checkoutAt);

  const checkoutDate =
    getIndiaDateTimeParts(parsedCheckoutAt).date;

  const checkoutValue =
    formatAttendanceDateTimeForSql(parsedCheckoutAt);

  const targetSql =
    scope === "latest_open"
      ? `
        SELECT
          DATE_FORMAT(attendance_date, '%Y-%m-%d') AS attendance_date
        FROM attendance
        WHERE user_id = ?
          AND check_in IS NOT NULL
          AND (
            check_out IS NULL
            OR TIME(check_out) = '00:00:00'
            OR TIMESTAMPDIFF(SECOND, check_in, check_out) < 0
          )
        ORDER BY attendance_date DESC, check_in DESC
        LIMIT 1
      `
      : `
        SELECT
          DATE_FORMAT(attendance_date, '%Y-%m-%d') AS attendance_date
        FROM attendance
        WHERE user_id = ?
          AND attendance_date = ?
          AND check_in IS NOT NULL
        LIMIT 1
      `;

  const targetParams =
    scope === "latest_open"
      ? [normalizedUserId]
      : [normalizedUserId, checkoutDate];

  const [attendanceRows] = await dbPromise.query(
    targetSql,
    targetParams,
  );

  const attendanceDate =
    attendanceRows[0]?.attendance_date || "";

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

  const [updateResult] = await dbPromise.query(
    `
      UPDATE attendance
      SET
        check_out = ?,
        total_worked_minutes = GREATEST(
          0,
          TIMESTAMPDIFF(MINUTE, check_in, ?)
        )
      WHERE user_id = ?
        AND attendance_date = ?
        AND check_in IS NOT NULL
        AND (
          check_out IS NULL
          OR TIME(check_out) = '00:00:00'
          OR TIMESTAMPDIFF(SECOND, check_in, check_out) < 0
        )
    `,
    [
      checkoutValue,
      checkoutValue,
      normalizedUserId,
      attendanceDate,
    ],
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

  const attendanceStatusSql =
    getAttendanceStatusSql("a", "u");

  const shiftEndSql =
    getAttendanceShiftEndSql("u");

  const [statusRows] = await dbPromise.query(
    `
      SELECT
        ${attendanceStatusSql} AS status,
        TIME_FORMAT(
          ${shiftEndSql},
          '%H:%i'
        ) AS logout_time,
        DATE_FORMAT(
          a.check_out,
          '%H:%i:%s'
        ) AS check_out,
        DATE_FORMAT(
          a.attendance_date,
          '%Y-%m-%d'
        ) AS attendance_date
      FROM attendance a
      LEFT JOIN users u
        ON u.id = a.user_id
      WHERE a.user_id = ?
        AND a.attendance_date = ?
      LIMIT 1
    `,
    [normalizedUserId, attendanceDate],
  );

  const checkoutStatus =
    statusRows[0]?.status || "present";

  return {
    success: true,
    noop: false,
    message:
      checkoutStatus === "half_day"
        ? "Check-out saved as Half Day"
        : "Check-out saved",
    status: checkoutStatus,
    logout_time:
      statusRows[0]?.logout_time || null,
    check_out:
      statusRows[0]?.check_out || null,
    attendance_date:
      statusRows[0]?.attendance_date ||
      attendanceDate,
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

function isSundayDateKey(dateKey) {
  const match = String(dateKey || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return false;

  const date = new Date(
    Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])),
  );
  return date.getUTCDay() === 0;
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

  let cursor = start;
  while (cursor <= end) {
    range.push(cursor);
    cursor = shiftAttendanceDateKey(cursor, 1);
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
    const [rows] = await dbPromise.query("SELECT * FROM users");
    res.json(rows);
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

    const employeeCode = String(req.body.employee_code || "").trim() || null;
    const name = String(req.body.name || "").trim();
    const dateOfBirth = normalizeDateOnlyValue(req.body.date_of_birth) || null;
    const gender =
      String(req.body.gender || "")
        .trim()
        .toLowerCase() || null;
    const nationality = String(req.body.nationality || "").trim() || null;
    const email = String(req.body.email || "").trim();
    const contact = String(req.body.contact || "").trim();
    const altContact = String(req.body.alt_contact || "").trim() || null;
    const address = String(req.body.address || "").trim() || null;
    const aadharNo = String(req.body.aadhar_no || "").trim();
    const panNumber = String(req.body.pan_number || "").trim() || null;
    const accountNo = String(req.body.account_no || "").trim();
    const bankName = String(req.body.bank_name || "").trim();
    const ifscCode = String(req.body.ifsc_code || "")
      .trim()
      .toUpperCase();
    const beneficiaryName = String(req.body.beneficiary_name || "").trim();
    const spswd = String(req.body.spswd || "");
    const cpswd = String(req.body.cpswd || "");
    const role = String(req.body.role || "")
      .trim()
      .toLowerCase();
    const compName = String(req.body.comp_name || "").trim();
    const loginTime = String(req.body.login_time || "").trim();
    const logoutTime = String(req.body.logout_time || "").trim() || "18:00";
    const rawSalary = String(req.body.salary ?? "").trim();
    const salary = normalizePayrollAmount(rawSalary);
    const joiningDate = normalizeDateOnlyValue(req.body.joining_date) || null;
    const totalExperience =
      String(req.body.total_experience || "").trim() || null;
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
    const createdBy =
      Number(req.body.created_by || req.body.updated_by || 0) || null;
    const profImg = getUploadedFilePath(req.files, "prof_img");
    const aadharImg = getUploadedFilePath(req.files, "aadhar_img");
    const panImg = getUploadedFilePath(req.files, "pan_img");
    const cancelledCheque = getUploadedFilePath(req.files, "cancelled_cheque");
    const resumeFile = getUploadedFilePath(req.files, "resume_file");
    const experienceFile = getUploadedFilePath(req.files, "experience_file");
    const certificationFile = getUploadedFilePath(
      req.files,
      "certification_file",
    );

    if (!name || !email || !contact || !spswd || !cpswd || !role || !compName) {
      return res.status(400).json({
        success: false,
        message: "Please fill all required user details",
      });
    }

    if (salary < 0) {
      return res.status(400).json({
        success: false,
        message: "Salary cannot be negative",
      });
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
        cpswd,
        role,
        comp_name,
        login_time,
        logout_time,
        skills,
        salary,
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
        certification_file
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    try {
      await ensureUserShiftColumns();
      await ensureUserRegistrationColumns();
      await ensureUserProfileSetupColumns();
      await ensurePayrollUserColumns();
      await ensureUserEmploymentStatusColumns();
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
        cpswd,
        role,
        compName,
        loginTime || null,
        logoutTime,
        skillsJSON,
        Number((rawSalary === "" ? 0 : salary).toFixed(2)),
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
      ]);

      const createdUserId = Number(insertResult.insertId || 0);
      let profileSetup = null;
      if (createdUserId) {
        await tryAutoSyncCurrentPayrollForUser(
          createdUserId,
          createdBy,
          "Registration payroll auto-sync",
        );
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
        profileSetup,
      });
    } catch (err) {
      console.error("Registration DB Error:", err);
      res.status(500).json({
        success: false,
        message: getDatabaseErrorMessage(
          err,
          "Database error while creating user",
        ),
      });
    }
  });
});

async function getProfileSetupUserByToken(token) {
  const tokenHash = hashProfileSetupToken(token);
  const [users] = await dbPromise.query(
    `
      SELECT
        id,
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
      : profileSetup?.emailDispatch?.message ||
        "Profile completion link generated";

    res.json({
      success: true,
      message: inviteMessage,
      profileSetup,
    });
  } catch (err) {
    console.error("Profile Setup Link Error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to generate profile completion link",
    });
  }
});

app.get("/api/profile-setup/:token", async (req, res) => {
  const token = String(req.params.token || "").trim();

  if (!token) {
    return res.status(400).json({
      success: false,
      message: "Missing profile setup token",
    });
  }

  try {
    await ensureUserProfileSetupColumns();
    await ensureUserRegistrationColumns();
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
        message:
          "This profile form link has expired. Please ask admin for a new link.",
      });
    }

    res.json({
      success: true,
      data: {
        ...user,
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

    const token = String(req.params.token || "").trim();
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
    const ifscCode =
      String(req.body.ifsc_code || "")
        .trim()
        .toUpperCase() || null;
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
    const pfJoiningDate =
      normalizeDateOnlyValue(req.body.pf_joining_date) || null;
    const skills = parseProfileSkillsInput(
      req.body.skills ?? req.body["skills[]"] ?? [],
    );

    try {
      await ensureUserProfileSetupColumns();
      await ensureUserRegistrationColumns();
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
          message:
            "This profile form link has expired. Please ask admin for a new link.",
        });
      }

      const profImg =
        getUploadedFilePath(req.files, "prof_img") || user.prof_img || null;
      const aadharImg =
        getUploadedFilePath(req.files, "aadhar_img") || user.aadhar_img || null;
      const panImg =
        getUploadedFilePath(req.files, "pan_img") || user.pan_img || null;
      const cancelledCheque =
        getUploadedFilePath(req.files, "cancelled_cheque") ||
        user.cancelled_cheque ||
        null;
      const resumeFile =
        getUploadedFilePath(req.files, "resume_file") ||
        user.resume_file ||
        null;
      const experienceFile =
        getUploadedFilePath(req.files, "experience_file") ||
        user.experience_file ||
        null;
      const certificationFile =
        getUploadedFilePath(req.files, "certification_file") ||
        user.certification_file ||
        null;

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
          JSON.stringify(skills),
          user.id,
        ],
      );

      res.json({
        success: true,
        message: "Profile details submitted successfully",
      });
    } catch (err) {
      console.error("Profile Setup Submit Error:", err);
      res.status(500).json({
        success: false,
        message: "Failed to submit profile details",
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

function normalizeCompanyScopeKey(value) {
  const normalized = String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

  if (
    normalized === "redsea" ||
    normalized === "redseadigitals" ||
    normalized === "redseadigitalspvtltd" ||
    normalized.startsWith("redsea") ||
    normalized.includes("redseadigitals")
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

function getUserCompanyScopeSql(userAlias = "") {
  const prefix = userAlias ? `${userAlias}.` : "";
  const compactCompanySql = `LOWER(REPLACE(REPLACE(REPLACE(COALESCE(${prefix}comp_name, ''), ' ', ''), '.', ''), ',', ''))`;

  return `CASE
    WHEN ${compactCompanySql} LIKE '%redsea%' THEN 'redsea'
    WHEN ${compactCompanySql} LIKE '%metrics%' THEN 'metrics'
    ELSE 'metrics'
  END`;
}
async function queryLoginUsers(loginId, password) {
  const params = [loginId, loginId, password];
  const coreColumns = `
    id,
    name,
    email,
    contact,
    role,
    comp_name,
    prof_img,
    is_team_lead
  `;
  const whereClause = `
    FROM users
    WHERE (email = ? OR contact = ?) AND spswd = ?
  `;

  try {
    const [results] = await dbPromise.query(
      `
        SELECT
          ${coreColumns},
          profile_setup_status,
          profile_setup_expires_at,
          profile_setup_completed_at,
          employment_status,
          deactivated_at
        ${whereClause}
      `,
      params,
    );
    return results;
  } catch (err) {
    if (err.code !== "ER_BAD_FIELD_ERROR") throw err;

    console.warn(
      "Login profile columns are missing; using the core user schema.",
    );
    const [results] = await dbPromise.query(
      `
        SELECT ${coreColumns}
        ${whereClause}
      `,
      params,
    );
    return results;
  }
}

async function handleLogin(req, res) {
  const { emailOrContact, email, password, company } = req.body || {};
  const loginId = String(emailOrContact || email || "").trim();
  const selectedCompanyKey = normalizeLoginCompanyKey(company);

  if (!loginId || !password) {
    return res.status(400).json({
      success: false,
      message: "Email/Contact and Password are required",
    });
  }

  try {
    await ensureUserEmploymentStatusColumns();
    const results = await queryLoginUsers(loginId, password);
    const user = results.find((candidate) => {
      if (!selectedCompanyKey) return true;
      const candidateCompanyKey = normalizeLoginCompanyKey(candidate.comp_name);
      return !candidateCompanyKey || candidateCompanyKey === selectedCompanyKey;
    });

    if (user) {
      const employmentStatus = normalizeUserEmploymentStatus(
        user.employment_status,
      );
      if (employmentStatus === "inactive") {
        return res.status(403).json({
          success: false,
          message: "Your account is deactivated. Please contact admin.",
        });
      }

      const statusDetails = getProfileSetupStatusDetails(user);
      const companyKey =
        normalizeLoginCompanyKey(user.comp_name) || selectedCompanyKey;
      return res.json({
        success: true,
        message: "Login successful",
        user: {
          ...user,
          company_key: companyKey,
          profile_setup_status: statusDetails.status,
          profile_setup_link_expired: statusDetails.isExpired,
        },
      });
    }

    res.status(401).json({
      success: false,
      message: selectedCompanyKey
        ? "Invalid email, company or password"
        : "Invalid email or password",
    });
  } catch (err) {
    console.error("Login DB Error:", err.code || err.message, err);
    res.status(500).json({
      success: false,
      message: "Login database is unavailable. Please try again shortly.",
    });
  }
}

app.post("/login", handleLogin);
app.post("/api/login", handleLogin);

app.post("/api/auth/forgot-password", async (req, res) => {
  const loginId = String(
    req.body?.email || req.body?.emailOrContact || "",
  ).trim();

  if (!loginId) {
    return res.status(400).json({
      success: false,
      message: "Registered email is required",
    });
  }

  try {
    await ensureUserRegistrationColumns();
    await ensureUserPasswordResetColumns();

    const [users] = await dbPromise.query(
      `
        SELECT id, name, email, contact
        FROM users
        WHERE LOWER(TRIM(email)) = LOWER(TRIM(?))
           OR contact = ?
        LIMIT 1
      `,
      [loginId, loginId],
    );

    if (!users.length || !String(users[0].email || "").trim()) {
      return res.json({
        success: true,
        message:
          "If an account exists for that email, a password reset OTP has been sent.",
      });
    }

    const resetRequest = await issuePasswordResetRequest(req, users[0]);
    const emailDispatch = resetRequest?.emailDispatch || {};
    setLocalPasswordResetCookie(
      res,
      req,
      resetRequest.token,
      resetRequest.expiresAt instanceof Date ? resetRequest.expiresAt : null,
    );

    if (
      !emailDispatch.sent &&
      isLocalPasswordResetFallbackAllowed(req) &&
      String(resetRequest?.token || "").trim()
    ) {
      return res.json({
        success: true,
        requiresOtp: true,
        deliveryMode: "local_otp",
        debugOtp: resetRequest.otpCode,
        redirectUrl: `${resolveAppBaseUrl(req)}/reset-password.html?mode=otp`,
        message:
          "Email service is not configured on this local system yet. Opening a secure OTP reset screen directly.",
      });
    }

    if (!emailDispatch.sent) {
      return res.status(emailDispatch.status === "failed" ? 502 : 503).json({
        success: false,
        message:
          emailDispatch.message ||
          "Unable to send password reset email right now.",
        missingConfig: Array.isArray(emailDispatch.missingConfig)
          ? emailDispatch.missingConfig
          : [],
      });
    }

    res.json({
      success: true,
      requiresOtp: true,
      redirectUrl: `${resolveAppBaseUrl(req)}/reset-password.html?mode=otp`,
      message:
        "If an account exists for that email, a password reset OTP has been sent.",
    });
  } catch (err) {
    console.error("Forgot Password Error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to send password reset email",
    });
  }
});

app.get("/api/auth/reset-password/:token", async (req, res) => {
  const token = resolvePasswordResetRequestToken(req, req.params.token);

  if (!token) {
    clearLocalPasswordResetCookie(res, req);
    return res.status(400).json({
      success: false,
      message: "Missing reset token",
    });
  }

  try {
    await ensureUserPasswordResetColumns();
    const user = await getPasswordResetUserByToken(token);

    if (!user) {
      clearLocalPasswordResetCookie(res, req);
      return res.status(404).json({
        success: false,
        message: "This password reset link is invalid or has already expired.",
      });
    }

    const statusDetails = getPasswordResetStatusDetails(user);
    if (statusDetails.isUsed) {
      clearLocalPasswordResetCookie(res, req);
      return res.status(410).json({
        success: false,
        message: "This password reset link has already been used.",
      });
    }

    if (statusDetails.isExpired) {
      clearLocalPasswordResetCookie(res, req);
      return res.status(410).json({
        success: false,
        message:
          "This password reset link has expired. Please request a new one.",
      });
    }

    if (!statusDetails.isOtpVerified && statusDetails.isOtpExpired) {
      return res.status(410).json({
        success: false,
        message:
          "This password reset OTP has expired. Please request a new one.",
      });
    }

    res.json({
      success: true,
      data: {
        name: user.name || "Team Member",
        email: user.email || "",
        expiresOn: formatProfileSetupExpiryLabel(statusDetails.expiresAt),
        status: statusDetails.status,
        otpRequired: true,
        otpVerified: statusDetails.isOtpVerified,
        otpExpiresOn: formatProfileSetupExpiryLabel(statusDetails.otpExpiresAt),
        otpAttemptsRemaining: Math.max(
          PASSWORD_RESET_OTP_MAX_ATTEMPTS - statusDetails.otpAttempts,
          0,
        ),
      },
    });
  } catch (err) {
    console.error("Password Reset Token Lookup Error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to verify password reset link",
    });
  }
});

app.post("/api/auth/reset-password/:token/verify-otp", async (req, res) => {
  const token = resolvePasswordResetRequestToken(req, req.params.token);
  const otp = normalizePasswordResetOtp(req.body?.otp);

  if (!token) {
    clearLocalPasswordResetCookie(res, req);
    return res.status(400).json({
      success: false,
      message: "Missing reset token",
    });
  }

  if (otp.length !== 6) {
    return res.status(400).json({
      success: false,
      message: "Please enter the 6-digit OTP sent to your email.",
    });
  }

  try {
    await ensureUserPasswordResetColumns();
    const user = await getPasswordResetUserByToken(token);

    if (!user) {
      clearLocalPasswordResetCookie(res, req);
      return res.status(404).json({
        success: false,
        message: "This password reset session is invalid or has expired.",
      });
    }

    const statusDetails = getPasswordResetStatusDetails(user);
    if (statusDetails.isUsed) {
      clearLocalPasswordResetCookie(res, req);
      return res.status(410).json({
        success: false,
        message: "This password reset request has already been used.",
      });
    }

    if (statusDetails.isExpired) {
      clearLocalPasswordResetCookie(res, req);
      return res.status(410).json({
        success: false,
        message:
          "This password reset link has expired. Please request a new one.",
      });
    }

    if (statusDetails.isOtpVerified) {
      return res.json({
        success: true,
        message: "OTP already verified. You can now set your new password.",
        data: {
          otpVerified: true,
        },
      });
    }

    if (statusDetails.isOtpExpired) {
      return res.status(410).json({
        success: false,
        message: "This OTP has expired. Please request a new one.",
      });
    }

    if (statusDetails.otpAttempts >= PASSWORD_RESET_OTP_MAX_ATTEMPTS) {
      return res.status(429).json({
        success: false,
        message: "Too many incorrect OTP attempts. Please request a new OTP.",
      });
    }

    const expectedOtpHash = hashPasswordResetOtp(token, otp);
    if (String(user.password_reset_otp_hash || "") !== expectedOtpHash) {
      const nextAttempts = statusDetails.otpAttempts + 1;
      await dbPromise.query(
        `
          UPDATE users
          SET password_reset_otp_attempts = ?
          WHERE id = ?
          LIMIT 1
        `,
        [nextAttempts, Number(user.id)],
      );

      const attemptsRemaining = Math.max(
        PASSWORD_RESET_OTP_MAX_ATTEMPTS - nextAttempts,
        0,
      );

      return res.status(attemptsRemaining === 0 ? 429 : 400).json({
        success: false,
        message:
          attemptsRemaining === 0
            ? "Too many incorrect OTP attempts. Please request a new OTP."
            : "Incorrect OTP. Please try again.",
        attemptsRemaining,
      });
    }

    await dbPromise.query(
      `
        UPDATE users
        SET
          password_reset_otp_verified_at = NOW(),
          password_reset_otp_attempts = 0
        WHERE id = ?
        LIMIT 1
      `,
      [Number(user.id)],
    );

    return res.json({
      success: true,
      message: "OTP verified successfully. You can now set your new password.",
      data: {
        otpVerified: true,
      },
    });
  } catch (err) {
    console.error("Password Reset OTP Verify Error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to verify OTP",
    });
  }
});

app.post("/api/auth/reset-password/:token", async (req, res) => {
  const token = resolvePasswordResetRequestToken(req, req.params.token);
  const newPassword = String(req.body?.newPassword || "");
  const confirmPassword = String(req.body?.confirmPassword || "");

  if (!token) {
    clearLocalPasswordResetCookie(res, req);
    return res.status(400).json({
      success: false,
      message: "Missing reset token",
    });
  }

  if (!newPassword || !confirmPassword) {
    return res.status(400).json({
      success: false,
      message: "Please enter and confirm your new password",
    });
  }

  if (newPassword !== confirmPassword) {
    return res.status(400).json({
      success: false,
      message: "Passwords do not match",
    });
  }

  if (String(newPassword).length < 6) {
    return res.status(400).json({
      success: false,
      message: "Password must be at least 6 characters long",
    });
  }

  try {
    await ensureUserRegistrationColumns();
    await ensureUserPasswordResetColumns();
    const user = await getPasswordResetUserByToken(token);

    if (!user) {
      clearLocalPasswordResetCookie(res, req);
      return res.status(404).json({
        success: false,
        message: "This password reset link is invalid or has already expired.",
      });
    }

    const statusDetails = getPasswordResetStatusDetails(user);
    if (statusDetails.isUsed) {
      clearLocalPasswordResetCookie(res, req);
      return res.status(410).json({
        success: false,
        message: "This password reset link has already been used.",
      });
    }

    if (statusDetails.isExpired) {
      clearLocalPasswordResetCookie(res, req);
      return res.status(410).json({
        success: false,
        message:
          "This password reset link has expired. Please request a new one.",
      });
    }

    if (!statusDetails.isOtpVerified) {
      return res.status(403).json({
        success: false,
        message: "Please verify the OTP before setting a new password.",
      });
    }

    await dbPromise.query(
      `
        UPDATE users
        SET
          spswd = ?,
          password_reset_token_hash = NULL,
          password_reset_expires_at = NULL,
          password_reset_used_at = NOW(),
          password_reset_otp_hash = NULL,
          password_reset_otp_expires_at = NULL,
          password_reset_otp_verified_at = NULL,
          password_reset_otp_attempts = 0
        WHERE id = ?
        LIMIT 1
      `,
      [newPassword, Number(user.id)],
    );

    clearLocalPasswordResetCookie(res, req);

    res.json({
      success: true,
      message:
        "Password updated successfully. You can now log in with your new password.",
    });
  } catch (err) {
    console.error("Password Reset Completion Error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to update password",
    });
  }
});

// ── Next Employee Code (must be BEFORE the /:id wildcard route) ──
async function handleNextEmployeeCode(req, res) {
  try {
    const companyParam = String(
      req.query.company ||
        req.query.company_scope ||
        req.query.companyScope ||
        "",
    ).trim();
    const companyKey = normalizeCompanyScopeKey(companyParam) || "metrics";

    // Build a LIKE clause to match comp_name values for the resolved company key
    let companyLike;
    if (companyKey === "redsea") {
      companyLike = "%redsea%";
    } else {
      companyLike = "%metrics%";
    }

    const [rows] = await dbPromise.query(
      `SELECT employee_code FROM users
       WHERE employee_code IS NOT NULL
         AND employee_code <> ''
         AND LOWER(REPLACE(comp_name, ' ', '')) LIKE ?
       ORDER BY employee_code DESC`,
      [companyLike],
    );

    let maxNum = 0;
    for (const row of rows) {
      const match = String(row.employee_code || "").match(/^EMP(\d+)$/i);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxNum) maxNum = num;
      }
    }

    const nextNum = maxNum + 1;
    const employeeCode = `EMP${String(nextNum).padStart(3, "0")}`;

    res.json({
      success: true,
      employeeCode,
      data: { employee_code: employeeCode },
    });
  } catch (err) {
    console.error("Next employee code error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to generate next employee code",
    });
  }
}

app.get("/api/users/next-employee-code", handleNextEmployeeCode);
app.get("/api/admin/users/next-employee-code", handleNextEmployeeCode);

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
          comp_name,
          TIME_FORMAT(login_time, '%H:%i') AS login_time,
          prof_img,
          TIME_FORMAT(logout_time, '%H:%i') AS logout_time,
          skills,
          salary,
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
    const requester = await ensureAdminOrHrAccess(requesterId);
    await ensureAttendanceTable();
    await ensureLeaveRequestsTable();
    await ensureUserShiftColumns();
    await ensureUserRegistrationColumns();
    await ensureUserProfileSetupColumns();
    await ensurePayrollUserColumns();
    await ensureUserEmploymentStatusColumns();

    const attendanceStatusSql = getAttendanceStatusSql("a", "u");
    const userCompanyScopeSql = getUserCompanyScopeSql("u");
    const requesterCompanyScope =
      normalizeCompanyScopeKey(requester.comp_name) ||
      normalizeCompanyScopeKey(
        req.query.companyScope || req.query.company_scope || req.query.company,
      ) ||
      "metrics";
    const employmentStatusFilter = normalizeUserEmploymentStatus(
      req.query.employmentStatus || req.query.employment_status,
      "all",
    );
    const employmentStatusWhereSql =
      employmentStatusFilter === "all"
        ? ""
        : "AND COALESCE(NULLIF(LOWER(TRIM(u.employment_status)), ''), 'active') = ?";
    const queryParams = [requesterCompanyScope];
    if (employmentStatusFilter !== "all") queryParams.push(employmentStatusFilter);
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
          u.role,
          COALESCE(NULLIF(TRIM(u.department), ''), UPPER(TRIM(COALESCE(u.role, ''))), 'General') AS department,
          u.comp_name,
          ${userCompanyScopeSql} AS company_scope_key,
          COALESCE(NULLIF(LOWER(TRIM(u.employment_status)), ''), 'active') AS employment_status,
          DATE_FORMAT(u.deactivated_at, '%Y-%m-%d %H:%i:%s') AS deactivated_at,
          DATE_FORMAT(u.reactivated_at, '%Y-%m-%d %H:%i:%s') AS reactivated_at,
          deactivator.name AS deactivated_by_name,
          reactivator.name AS reactivated_by_name,
          TIME_FORMAT(u.login_time, '%H:%i') AS login_time,
          TIME_FORMAT(COALESCE(u.logout_time, '18:00:00'), '%H:%i') AS logout_time,
          DATE_FORMAT(u.joining_date, '%Y-%m-%d') AS joining_date,
          DATE_FORMAT(u.date_of_birth, '%Y-%m-%d') AS date_of_birth,
          u.salary,
          u.skills,
          u.prof_img,
          u.aadhar_img,
          u.pan_img,
          u.cancelled_cheque,
          u.resume_file,
          u.experience_file,
          u.certification_file,
          u.is_team_lead,
          u.profile_setup_status,
          DATE_FORMAT(u.profile_setup_expires_at, '%Y-%m-%d %H:%i:%s') AS profile_setup_expires_at,
          DATE_FORMAT(u.profile_setup_completed_at, '%Y-%m-%d %H:%i:%s') AS profile_setup_completed_at,
          DATE_FORMAT(${getAttendanceLocalDateTimeSql("a.check_in")}, '%H:%i:%s') AS check_in,
          DATE_FORMAT(${getAttendanceResolvedCheckoutSql("a")}, '%H:%i:%s') AS check_out,
          ${attendanceStatusSql} AS attendance_status,
          CASE WHEN lt.user_id IS NOT NULL THEN 1 ELSE 0 END AS is_on_leave_today,
          lt.leave_type AS today_leave_type
        FROM users u
        LEFT JOIN attendance a
          ON a.user_id = u.id
          AND a.attendance_date = ${getAttendanceTodaySql()}
        LEFT JOIN users deactivator
          ON deactivator.id = u.deactivated_by
        LEFT JOIN users reactivator
          ON reactivator.id = u.reactivated_by
        LEFT JOIN (
          SELECT
            lr.user_id,
            MAX(lr.leave_type) AS leave_type
          FROM leave_requests lr
          WHERE lr.status = 'approved'
            AND ${getAttendanceTodaySql()} BETWEEN lr.from_date AND lr.to_date
          GROUP BY lr.user_id
        ) lt ON lt.user_id = u.id
        WHERE LOWER(TRIM(COALESCE(u.role, ''))) <> 'admin'
          AND ${userCompanyScopeSql} = ?
          ${employmentStatusWhereSql}
        ORDER BY
          FIELD(LOWER(TRIM(COALESCE(u.role, ''))), 'hr', 'tme', 'me', 'dev', 'seo', 'smo', 'accounts', 'dm'),
          u.name ASC,
          u.id ASC
      `,
      queryParams,
    );

    res.json({
      success: true,
      data: rows.map((row) => {
        const statusDetails = getProfileSetupStatusDetails(row);
        const documentFields = [
          row.aadhar_img,
          row.pan_img,
          row.cancelled_cheque,
          row.resume_file,
          row.experience_file,
          row.certification_file,
        ];
        const documentsPresent = documentFields.filter(Boolean).length;

        return {
          ...row,
          company_scope:
            normalizeCompanyScopeKey(row.company_scope_key || row.comp_name) ||
            requesterCompanyScope,
          companyScope:
            normalizeCompanyScopeKey(row.company_scope_key || row.comp_name) ||
            requesterCompanyScope,
          profile_setup_status: statusDetails.status,
          profile_setup_link_expired: statusDetails.isExpired,
          documents_present: documentsPresent,
          documents_required: documentFields.length,
          documents_missing: documentFields.length - documentsPresent,
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

app.put("/api/admin/users/:id/employment-status", async (req, res) => {
  const userId = Number(req.params.id);
  const actorId = Number(req.body?.actorId || req.body?.adminId || 0);
  const nextStatus = normalizeUserEmploymentStatus(req.body?.status, "");

  if (!userId || !actorId || !["active", "inactive"].includes(nextStatus)) {
    return res.status(400).json({
      success: false,
      message: "Invalid employee status request",
    });
  }

  try {
    await ensureUserEmploymentStatusColumns();
    const adminUser = await ensureAdminAccess(actorId);

    if (Number(adminUser.id) === userId && nextStatus === "inactive") {
      return res.status(400).json({
        success: false,
        message: "You cannot deactivate your own account",
      });
    }

    const [users] = await dbPromise.query(
      `
        SELECT
          id,
          name,
          role,
          comp_name,
          COALESCE(NULLIF(LOWER(TRIM(employment_status)), ''), 'active') AS employment_status
        FROM users
        WHERE id = ?
        LIMIT 1
      `,
      [userId],
    );

    if (!users.length) {
      return res.status(404).json({
        success: false,
        message: "Employee not found",
      });
    }

    const employee = users[0];
    if (
      normalizeRoleValue(employee.role) === "admin" &&
      nextStatus === "inactive"
    ) {
      return res.status(400).json({
        success: false,
        message: "Admin accounts cannot be deactivated from team panel",
      });
    }

    const adminCompanyScope =
      normalizeCompanyScopeKey(adminUser.comp_name) || "metrics";
    const employeeCompanyScope =
      normalizeCompanyScopeKey(employee.comp_name) || "metrics";

    if (adminCompanyScope !== employeeCompanyScope) {
      return res.status(403).json({
        success: false,
        message: "You can only update employees from your own company",
      });
    }

    if (nextStatus === "inactive") {
      await dbPromise.query(
        `
          UPDATE users
          SET
            employment_status = 'inactive',
            deactivated_at = NOW(),
            deactivated_by = ?,
            reactivated_at = NULL,
            reactivated_by = NULL
          WHERE id = ?
          LIMIT 1
        `,
        [adminUser.id, userId],
      );
    } else {
      await dbPromise.query(
        `
          UPDATE users
          SET
            employment_status = 'active',
            reactivated_at = NOW(),
            reactivated_by = ?,
            deactivated_at = NULL,
            deactivated_by = NULL
          WHERE id = ?
          LIMIT 1
        `,
        [adminUser.id, userId],
      );
    }

    res.json({
      success: true,
      message:
        nextStatus === "inactive"
          ? "Employee deactivated successfully"
          : "Employee activated successfully",
      data: {
        id: userId,
        employment_status: nextStatus,
        employmentStatus: nextStatus,
      },
    });
  } catch (err) {
    console.error("Admin employee status update error:", err);
    res.status(err.statusCode || 500).json({
      success: false,
      message: err.message || "Failed to update employee status",
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
    const gender =
      String(req.body.gender || "")
        .trim()
        .toLowerCase() || null;
    const nationality = String(req.body.nationality || "").trim() || null;
    const email = String(req.body.email || "").trim();
    const contact = String(req.body.contact || "").trim();
    const altContact = String(req.body.alt_contact || "").trim() || null;
    const address = String(req.body.address || "").trim() || null;
    const aadharNo = String(req.body.aadhar_no || "").trim();
    const panNumber = String(req.body.pan_number || "").trim() || null;
    const accountNo = String(req.body.account_no || "").trim();
    const bankName = String(req.body.bank_name || "").trim();
    const ifscCode = String(req.body.ifsc_code || "")
      .trim()
      .toUpperCase();
    const beneficiaryName = String(req.body.beneficiary_name || "").trim();
    const nextPassword = String(req.body.spswd || "");
    const nextConfirmPassword = String(req.body.cpswd || "");
    const role = String(req.body.role || "")
      .trim()
      .toLowerCase();
    const compName = String(req.body.comp_name || "").trim();
    const loginTime = String(req.body.login_time || "").trim();
    const logoutTime = String(req.body.logout_time || "").trim() || "18:00";
    const rawSalary = String(req.body.salary ?? "").trim();
    const salary = normalizePayrollAmount(rawSalary);
    const joiningDate = normalizeDateOnlyValue(req.body.joining_date) || null;
    const totalExperience =
      String(req.body.total_experience || "").trim() || null;
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
    const pfJoiningDate =
      normalizeDateOnlyValue(req.body.pf_joining_date) || null;
    const updatedBy =
      Number(req.body.updated_by || req.body.created_by || 0) || null;

    if (
      (nextPassword || nextConfirmPassword) &&
      nextPassword !== nextConfirmPassword
    ) {
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
        : String(existingUser.gender || "")
            .trim()
            .toLowerCase() || null;
      const nextNationality = hasBodyField(req.body, "nationality")
        ? nationality
        : existingUser.nationality || null;
      const profImg =
        getUploadedFilePath(req.files, "prof_img") ||
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
        getUploadedFilePath(req.files, "aadhar_img") ||
        existingUser.aadhar_img ||
        null;
      const panImg =
        getUploadedFilePath(req.files, "pan_img") ||
        existingUser.pan_img ||
        null;
      const cancelledCheque =
        getUploadedFilePath(req.files, "cancelled_cheque") ||
        existingUser.cancelled_cheque ||
        null;
      const resumeFile =
        getUploadedFilePath(req.files, "resume_file") ||
        existingUser.resume_file ||
        null;
      const experienceFile =
        getUploadedFilePath(req.files, "experience_file") ||
        existingUser.experience_file ||
        null;
      const certificationFile =
        getUploadedFilePath(req.files, "certification_file") ||
        existingUser.certification_file ||
        null;
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
        : String(existingUser.role || "")
            .trim()
            .toLowerCase();
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

      if (nextSalary < 0) {
        return res.status(400).json({
          success: false,
          message: "Salary cannot be negative",
        });
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
          certification_file = ?
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
        Number(nextSalary.toFixed(2)),
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

      res.json({
        success: true,
        message: "User updated successfully",
      });
    } catch (err) {
      console.error("Admin User Update Error:", err);
      res.status(500).json({
        success: false,
        message: "Failed to update user",
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
  const normalizedActionType = normalizeLeadActionType(
    data.actionType || data.action_type,
  );
  const dbActionType = getDbLeadActionType(normalizedActionType);
  const hasAppointmentDate =
    dbActionType === "appointment" && Boolean(cleanLeadDate(data.app_date));
  const appointmentStatus = hasAppointmentDate
    ? normalizeAppointmentStatus(data.appointment_status, "generated")
    : null;
  const meetingType =
    dbActionType === "appointment"
      ? normalizeLeadMeetingType(
          data.meeting_type || data.meetingType,
          hasLeadGoogleMeetInput(data) ? "google_meet" : "appointment",
        )
      : "appointment";
  const googleMeetLink =
    meetingType === "google_meet"
      ? cleanLeadText(data.google_meet_link || data.googleMeetLink)
      : null;
  const appointmentLocation =
    dbActionType === "appointment"
      ? meetingType === "google_meet"
        ? googleMeetLink || "Google Meet"
        : cleanLeadText(data.location || data.maps_lnk)
      : null;
  const companyScope =
    normalizeCompanyScopeKey(
      data.company_scope ||
        data.companyScope ||
        data.company_key ||
        data.selected_company ||
        data.comp_name,
    ) || null;

  if (
    !cleanLeadText(data.company) ||
    !cleanLeadText(data.client) ||
    !cleanLeadText(data.contact)
  ) {
    return res.status(400).json({
      success: false,
      message: "Company name, client name and contact are required",
    });
  }

  const sql = `
      INSERT INTO leads (
        company_name, client_name, contact, alternate_contact,
        telephone, email, gst_no,
        flat_no, building_name, locality, city, pincode, state, maps_lnk,
        source_lead, industry_type,
        web_type, seo_type, smo_type, app_type, erp_type, services,
        service_notes,
        action_type, appointment_status, meeting_type, google_meet_link,
        app_date, app_time, assign_emp, assign_emp_id, location,
        follow_date, follow_time, reason,
        additional_notes,
        created_by,
        company_scope
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

  const values = [
    cleanLeadText(data.company),
    cleanLeadText(data.client),
    cleanLeadText(data.contact),
    cleanLeadText(data.alt_contact),
    cleanLeadText(data.telephone),
    cleanLeadText(data.email),
    cleanLeadText(data.gst_no),
    cleanLeadText(data.flat_no),
    cleanLeadText(data.building_name),
    cleanLeadText(data.locality, ""),
    cleanLeadText(data.city, ""),
    cleanLeadText(data.pincode, ""),
    cleanLeadText(data.state, ""),
    cleanLeadText(data.maps_lnk),
    cleanLeadText(data.source_lead, ""),
    cleanLeadText(data.industry_type, ""),
    stringifyLeadList(data.web_type),
    stringifyLeadList(data.seo_type),
    stringifyLeadList(data.smo_type),
    stringifyLeadList(data.app_type),
    stringifyLeadList(data.erp_type),
    stringifyLeadList(data.services),
    cleanLeadText(data.service_notes),
    dbActionType,
    appointmentStatus,
    meetingType,
    googleMeetLink,
    dbActionType === "appointment" ? cleanLeadDate(data.app_date) : null,
    dbActionType === "appointment" ? cleanLeadTime(data.app_time) : null,
    dbActionType === "appointment" ? cleanLeadText(data.assign_emp) : null,
    dbActionType === "appointment"
      ? normalizeLeadUserId(data.assign_emp_id)
      : null,
    appointmentLocation,
    dbActionType === "followup" ? cleanLeadDate(data.follow_date) : null,
    dbActionType === "followup" ? cleanLeadTime(data.follow_time) : null,
    dbActionType === "followup" ? cleanLeadText(data.reason) : null,
    cleanLeadText(data.additional_notes),
    normalizeLeadUserId(data.created_by || data.user_id),
    companyScope,
  ];

  try {
    await ensureLeadInputColumnWidths();
    await ensureLeadAppointmentStatusColumn();
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
    const errorDetails = getLeadCreateErrorDetails(err);
    res.status(500).json({
      success: false,
      message: "Failed to save client",
      ...(errorDetails ? { error: errorDetails } : {}),
    });
  }
});

// ====================== GET ALL LEADS ======================
app.get("/api/leads", (req, res) => {
  let { userId, role } = req.query;
  const scope = String(req.query.scope || "")
    .toLowerCase()
    .trim();

  // 🔥 normalize role
  role = role ? role.toLowerCase().trim() : "";

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

      if (scope === "deal-close") {
        sql = `
          SELECT
            l.*,
            COALESCE(assigned_user.name, l.assign_emp) AS assigned_me_name,
            COALESCE(assigned_user.name, l.assign_emp) AS me_name
          FROM leads l
          LEFT JOIN users assigned_user ON assigned_user.id = l.assign_emp_id
          WHERE
            (l.lead_status IS NULL OR LOWER(TRIM(l.lead_status)) NOT IN ('deal_closed', 'not_interested'))
          ORDER BY l.id DESC
        `;
        values = [];
      } else if (scope === "unassigned") {
        sql = `
          SELECT *
          FROM leads
          WHERE
            created_by = ?
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
          WHERE created_by = ? OR assign_emp = ? OR assign_emp_id = ?
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

    sql = "SELECT * FROM leads WHERE created_by = ? ORDER BY id DESC";
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
  const sql = `
    SELECT
      l.*,
      COALESCE(assigned_user.name, l.assign_emp) AS assigned_me_name,
      COALESCE(assigned_user.name, l.assign_emp) AS me_name,
      creator_user.name AS tme_name,
      closer_user.name AS closed_by_name,
      CASE
        WHEN LOWER(TRIM(COALESCE(closer_user.role, ''))) = 'tme' THEN closer_user.name
        ELSE NULL
      END AS closed_tme_name
    FROM leads l
    LEFT JOIN users assigned_user ON assigned_user.id = l.assign_emp_id
    LEFT JOIN users creator_user ON creator_user.id = l.created_by
    LEFT JOIN users closer_user ON closer_user.id = l.closed_by
    WHERE l.id = ?
  `;

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

// ====================== GET ACKNOWLEDGMENT DATA ======================
app.get("/api/leads/:id/acknowledgment-data", async (req, res) => {
  const leadId = req.params.id;
  try {
    const [[lead]] = await dbPromise.query(`
      SELECT l.*,
             COALESCE(assigned_user.name, l.assign_emp) AS me_name,
             creator_user.name AS tme_name,
             closer_user.name AS closed_by_name
      FROM leads l
      LEFT JOIN users assigned_user ON assigned_user.id = l.assign_emp_id
      LEFT JOIN users creator_user ON creator_user.id = l.created_by
      LEFT JOIN users closer_user ON closer_user.id = l.closed_by
      WHERE l.id = ?
    `, [leadId]);
    
    if (!lead) return res.status(404).json({ success: false, message: "Lead not found" });

    const [products] = await getDealProductsForInvoice(leadId);

    const [installments] = await dbPromise.query(`
      SELECT sequence_no AS installmentNo, amount, payment_date AS dueDate, payment_status AS status
      FROM deal_payments
      WHERE lead_id = ? AND payment_type = 'part_payment'
      ORDER BY sequence_no ASC
    `, [leadId]);

    const [renewals] = await dbPromise.query(`
      SELECT service_name AS service, renewal_basis AS basis, first_start_date AS firstRenewalDate, 0 AS amount
      FROM deal_service_renewals
      WHERE lead_id = ?
    `, [leadId]);

    const [[deal]] = await dbPromise.query(`
      SELECT * FROM deals WHERE lead_id = ? ORDER BY id DESC LIMIT 1
    `, [leadId]);

    res.json({
      success: true,
      lead,
      deal: deal || {},
      products,
      installments,
      renewals
    });
  } catch (err) {
    console.error("Acknowledgment Data Error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ====================== UPDATE LEAD (Convert Followup to Appointment) ======================
app.put("/api/leads/:id", async (req, res) => {
  const leadId = req.params.id;
  const data = req.body || {};
  const mode = String(data.mode || "")
    .toLowerCase()
    .trim();
  const requestActionType = normalizeLeadActionType(
    data.action_type || data.actionType,
  );

  try {
    if (mode !== "full" && requestActionType === "followup") {
      await ensureLeadFollowupUpdateColumns();

      const followDate = cleanLeadDate(data.follow_date);
      const followTime = cleanLeadTime(data.follow_time);
      const followReason = cleanLeadText(data.reason);
      const [result] = await dbPromise.query(
        `
          UPDATE leads
          SET action_type = ?,
              follow_date = ?,
              follow_time = ?,
              reason = ?
          WHERE id = ?
        `,
        ["followup", followDate, followTime, followReason, leadId],
      );

      if (result.affectedRows === 0) {
        return res
          .status(404)
          .json({ success: false, message: "Lead not found" });
      }

      return res.json({
        success: true,
        message: "Lead updated to Follow Up",
      });
    }

    await ensureLeadInputColumnWidths();
    await ensureLeadAppointmentStatusColumn();
    await ensureLeadCompanyScopeColumn();

    if (mode === "full") {
      if (
        !cleanLeadText(data.company) ||
        !cleanLeadText(data.client) ||
        !cleanLeadText(data.contact)
      ) {
        return res.status(400).json({
          success: false,
          message: "Company name, client name and contact are required",
        });
      }

      const normalizedActionType = normalizeLeadActionType(
        data.action_type || data.actionType,
      );
      const actionType = getDbLeadActionType(normalizedActionType);
      const isAppointment = normalizedActionType === "appointment";
      const isFollowup = normalizedActionType === "followup";
      const appointmentDate = isAppointment
        ? cleanLeadDate(data.app_date)
        : null;
      const appointmentTime = isAppointment
        ? cleanLeadTime(data.app_time)
        : null;
      const assignedEmployee = isAppointment
        ? cleanLeadText(data.assign_emp)
        : null;
      const assignedEmployeeId = isAppointment
        ? normalizeLeadUserId(data.assign_emp_id)
        : null;
      const appointmentStatus = appointmentDate
        ? normalizeAppointmentStatus(data.appointment_status, "generated")
        : null;
      const meetingType = isAppointment
        ? normalizeLeadMeetingType(
            data.meeting_type || data.meetingType,
            hasLeadGoogleMeetInput(data) ? "google_meet" : "appointment",
          )
        : "appointment";
      const googleMeetLink =
        meetingType === "google_meet"
          ? cleanLeadText(data.google_meet_link || data.googleMeetLink)
          : null;
      const followDate = isFollowup ? cleanLeadDate(data.follow_date) : null;
      const followTime = isFollowup ? cleanLeadTime(data.follow_time) : null;
      const followReason = isFollowup ? cleanLeadText(data.reason) : null;
      const locationValue = isAppointment
        ? meetingType === "google_meet"
          ? googleMeetLink || "Google Meet"
          : cleanLeadText(data.location || data.maps_lnk)
        : null;
      const companyScope =
        normalizeCompanyScopeKey(
          data.company_scope ||
            data.companyScope ||
            data.company_key ||
            data.selected_company ||
            data.comp_name,
        ) || null;

      const sql = `
        UPDATE leads
        SET company_name = ?,
            client_name = ?,
            contact = ?,
            alternate_contact = ?,
            telephone = ?,
            email = ?,
            gst_no = ?,
            flat_no = ?,
            building_name = ?,
            locality = ?,
            city = ?,
            pincode = ?,
            state = ?,
            maps_lnk = ?,
            source_lead = ?,
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
            meeting_type = ?,
            google_meet_link = ?,
            app_date = ?,
            app_time = ?,
            assign_emp = ?,
            assign_emp_id = ?,
            location = ?,
            follow_date = ?,
            follow_time = ?,
            reason = ?,
            additional_notes = ?,
            company_scope = COALESCE(?, company_scope)
        WHERE id = ?
      `;

      const values = [
        cleanLeadText(data.company),
        cleanLeadText(data.client),
        cleanLeadText(data.contact),
        cleanLeadText(data.alt_contact),
        cleanLeadText(data.telephone),
        cleanLeadText(data.email),
        cleanLeadText(data.gst_no),
        cleanLeadText(data.flat_no),
        cleanLeadText(data.building_name),
        cleanLeadText(data.locality, ""),
        cleanLeadText(data.city, ""),
        cleanLeadText(data.pincode, ""),
        cleanLeadText(data.state, ""),
        cleanLeadText(data.maps_lnk),
        cleanLeadText(data.source_lead, ""),
        cleanLeadText(data.industry_type, ""),
        stringifyLeadList(data.web_type),
        stringifyLeadList(data.seo_type),
        stringifyLeadList(data.smo_type),
        stringifyLeadList(data.app_type),
        stringifyLeadList(data.erp_type),
        stringifyLeadList(data.services),
        cleanLeadText(data.service_notes),
        actionType,
        appointmentStatus,
        meetingType,
        googleMeetLink,
        appointmentDate,
        appointmentTime,
        assignedEmployee,
        assignedEmployeeId,
        locationValue,
        followDate,
        followTime,
        followReason,
        cleanLeadText(data.additional_notes),
        companyScope,
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
              app_date: appointmentDate,
              app_time: appointmentTime,
              assign_emp: assignedEmployee,
              meeting_type: meetingType,
              google_meet_link: googleMeetLink,
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
    const normalizedActionType = normalizeLeadActionType(action_type);
    const dbActionType = getDbLeadActionType(normalizedActionType);
    const isAppointmentUpdate = normalizedActionType === "appointment";
    const isFollowupUpdate = normalizedActionType === "followup";
    const appointmentDate = isAppointmentUpdate ? cleanLeadDate(app_date) : null;
    const appointmentTime = isAppointmentUpdate ? cleanLeadTime(app_time) : null;
    const assignedEmployee = isAppointmentUpdate ? cleanLeadText(assign_emp) : null;
    const assignEmpId = isAppointmentUpdate
      ? normalizeLeadUserId(data.assign_emp_id)
      : null;
    const appointmentStatus = appointmentDate
      ? normalizeAppointmentStatus(data.appointment_status, "generated")
      : null;
    const meetingType = isAppointmentUpdate
      ? normalizeLeadMeetingType(
          data.meeting_type || data.meetingType,
          hasLeadGoogleMeetInput(data) ? "google_meet" : "appointment",
        )
      : null;
    const googleMeetLink =
      meetingType === "google_meet"
        ? cleanLeadText(data.google_meet_link || data.googleMeetLink)
        : null;
    const appointmentLocation = isAppointmentUpdate
      ? meetingType === "google_meet"
        ? googleMeetLink || "Google Meet"
        : cleanLeadText(location)
      : null;
    const followDate = isFollowupUpdate ? cleanLeadDate(data.follow_date) : null;
    const followTime = isFollowupUpdate ? cleanLeadTime(data.follow_time) : null;
    const followReason = isFollowupUpdate ? cleanLeadText(data.reason) : null;

    const sql = `
        UPDATE leads
        SET action_type = ?,
            appointment_status = ?,
            meeting_type = ?,
            google_meet_link = ?,
            app_date = ?,
            app_time = ?,
            assign_emp = ?,
            assign_emp_id = ?,
            location = ?,
            follow_date = ?,
            follow_time = ?,
            reason = ?
        WHERE id = ?
      `;

    const [result] = await dbPromise.query(sql, [
      dbActionType,
      appointmentStatus,
      meetingType,
      googleMeetLink,
      appointmentDate,
      appointmentTime,
      assignedEmployee,
      assignEmpId,
      appointmentLocation,
      followDate,
      followTime,
      followReason,
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
            app_date: appointmentDate,
            app_time: appointmentTime,
            assign_emp: assignedEmployee,
            meeting_type: meetingType,
            google_meet_link: googleMeetLink,
            location: appointmentLocation,
            follow_date: followDate,
            follow_time: followTime,
            reason: followReason,
          },
          isFollowupUpdate ? "followup" : "appointment",
        )
      : null;

    res.json({
      success: true,
      message: isFollowupUpdate
        ? "Lead updated to Follow Up"
        : "Lead updated to Appointment",
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

  let sql = "";
  let params = [];

  if (includeHistory) {
    sql = `
      SELECT
        *,
        ${getAppointmentStageSql()} AS appointment_stage
      FROM leads
      WHERE app_date IS NOT NULL
    `;

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
        ${getAppointmentStageSql()} AS appointment_stage
      FROM leads
      WHERE action_type = 'appointment'
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
        ${getAppointmentStageSql()} AS appointment_stage
      FROM leads
      WHERE action_type = 'appointment'
        AND created_by = ?
      ORDER BY app_date ASC, app_time ASC
    `;
    params = [userId];
  }

  try {
    await ensureLeadAppointmentStatusColumn();
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

  let sql = "";
  let params = [];

  if (role === "admin") {
    sql = `
      SELECT * FROM leads
      WHERE action_type = 'followup'
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
      received_amount,
      remaining_amount,
      gst_amount,
      total_gst_amount,
      remaining_gst_amount,
      sales_type,
      part_payment_option,
      part_payment_schedule,
      service_renewal_enabled,
      service_renewal_basis,
      service_renewal_start_date,
    } = req.body;

    const payment_proof = req.file
      ? "uploads/payments/" + req.file.filename
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
          req.body,
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
    if (action === "deal_closed") {
      await ensureDealPaymentSchema();
    }

    let sql = `UPDATE leads SET `;
    let values = [];
    let dealCloseServiceRenewalConfig = null;

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
      const dealAmountValue = roundServerAmount(deal_amount);
      const submittedReceivedAmount = normalizeServerAmount(
        received_amount,
        NaN,
      );
      const downPaymentAmount =
        Number.isFinite(submittedReceivedAmount) && submittedReceivedAmount > 0
          ? roundServerAmount(submittedReceivedAmount)
          : dealAmountValue;
      const submittedRemainingAmount = normalizeServerAmount(
        remaining_amount,
        NaN,
      );
      const remainingAmountValue =
        Number.isFinite(submittedRemainingAmount) &&
        submittedRemainingAmount >= 0
          ? roundServerAmount(submittedRemainingAmount)
          : roundServerAmount(Math.max(dealAmountValue - downPaymentAmount, 0));
      const totalGstAmount = calculateServerGstAmount(dealAmountValue);
      const paidGstAmount = calculateServerGstAmount(downPaymentAmount);
      const remainingGstAmount = calculateServerGstAmount(remainingAmountValue);
      const paymentStatus = "pending";
      const renewalRequested = isDealCloseServiceRenewalEnabled(
        service_renewal_enabled || req.body.renewal_enabled,
      );
      const renewalStartDate = getServerDateKey(
        service_renewal_start_date || req.body.renewal_start_date,
      );
      const renewalBasis =
        service_renewal_basis || req.body.renewal_basis || "monthly";

      if (renewalRequested && !renewalStartDate) {
        return res.status(400).json({
          success: false,
          message: "First renewal date is required",
        });
      }

      dealCloseServiceRenewalConfig = renewalRequested
        ? {
            basis: renewalBasis,
            startDate: renewalStartDate,
            actorId: Number(closed_by || req.body.userId || 0) || null,
          }
        : null;

      sql += `lead_status = 'deal_closed',
              closed_date = NOW(),
              closed_by = ?,
              payment_method = ?,
              deal_amount = ?,
              received_amount = ?,
              down_payment_amount = ?,
              remaining_amount = ?,
              gst_amount = ?,
              total_gst_amount = ?,
              remaining_gst_amount = ?,
              sales_type = ?,
              part_payment_option = ?,
              part_payment_schedule = ?,
              pay_stat = ?,
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
        dealAmountValue || null,
        downPaymentAmount || null,
        downPaymentAmount || null,
        remainingAmountValue,
        paidGstAmount || null,
        totalGstAmount || null,
        remainingGstAmount || null,
        sales_type || null,
        part_payment_option || null,
        part_payment_schedule || null,
        paymentStatus,
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

      const sendActionSuccess = () =>
        res.json({
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
      db.query(
        dealSql,
        [
          leadId,
          deal_amount,
          payment_method,
          payment_notes || null,
          closed_by || null,
        ],
        (dealErr, dealResult) => {
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
              const productValues = parsedProducts.map((p) => [
                dealId,
                p.name,
                p.amount,
              ]);
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

                return Promise.resolve()
                  .then(() =>
                    dealCloseServiceRenewalConfig
                      ? saveDealCloseServiceRenewals({
                          leadId,
                          dealId,
                          products: parsedProducts,
                          basis: dealCloseServiceRenewalConfig.basis,
                          startDate: dealCloseServiceRenewalConfig.startDate,
                          actorId: dealCloseServiceRenewalConfig.actorId,
                        })
                      : null,
                  )
                  .then(() => sendActionSuccess())
                  .catch((renewalErr) => {
                    console.error(
                      "Deal Close Renewal Setup Error:",
                      renewalErr,
                    );
                    return res.status(500).json({
                      success: false,
                      message:
                        "Deal saved, but renewal schedule could not be created",
                      error: renewalErr.sqlMessage || renewalErr.message,
                    });
                  });
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
        },
      );
    });
  },
);

const DEAL_LIST_SELECT_SQL = `
  l.*,
  COALESCE(assigned_user.name, l.assign_emp) AS assigned_me_name,
  COALESCE(assigned_user.name, l.assign_emp) AS me_name,
  creator_user.name AS tme_name,
  closer_user.name AS closed_by_name,
  CASE
    WHEN LOWER(TRIM(COALESCE(closer_user.role, ''))) = 'tme' THEN closer_user.name
    ELSE NULL
  END AS closed_tme_name
`;

const DEAL_LIST_JOINS_SQL = `
  FROM leads l
  LEFT JOIN users assigned_user ON assigned_user.id = l.assign_emp_id
  LEFT JOIN users creator_user ON creator_user.id = l.created_by
  LEFT JOIN users closer_user ON closer_user.id = l.closed_by
`;

// ====================== GET DEALS FOR EMPLOYEE ======================
app.get("/api/deals/:id", (req, res) => {
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
        SELECT ${DEAL_LIST_SELECT_SQL}
        ${DEAL_LIST_JOINS_SQL}
        WHERE l.lead_status = 'deal_closed'
        AND (l.closed_by = ? OR l.assign_emp_id = ? OR l.assign_emp = ?)
        ORDER BY l.closed_date DESC
      `;

    db.query(sql, [userId, userId, employeeName], (err, result) => {
      if (err) {
        console.error("Deals Fetch Error:", err);
        return res.status(500).json({ success: false });
      }
      res.json({ success: true, data: result });
    });
  });
});

app.get("/api/deals", (req, res) => {
  const { userId, role, userName } = req.query;
  const normalizedRole = String(role || "")
    .toLowerCase()
    .trim();

  let sql;
  let values = [];

  if (normalizedRole === "admin" || normalizedRole === "accounts") {
    sql = `
        SELECT ${DEAL_LIST_SELECT_SQL}
        ${DEAL_LIST_JOINS_SQL}
        WHERE l.lead_status = 'deal_closed'
        ORDER BY l.closed_date DESC
      `;
  } else if (normalizedRole === "me") {
    sql = `
        SELECT ${DEAL_LIST_SELECT_SQL}
        ${DEAL_LIST_JOINS_SQL}
        WHERE l.lead_status = 'deal_closed'
        AND (l.closed_by = ? OR l.assign_emp_id = ? OR l.assign_emp = ?)
        ORDER BY l.closed_date DESC
      `;
    values = [userId, userId, String(userName || "").trim()];
  } else {
    sql = `
        SELECT ${DEAL_LIST_SELECT_SQL}
        ${DEAL_LIST_JOINS_SQL}
        WHERE l.lead_status = 'deal_closed'
        AND (l.created_by = ? OR l.closed_by = ?)
        ORDER BY l.closed_date DESC
      `;
    values = [userId, userId];
  }

  db.query(sql, values, (err, result) => {
    if (err) {
      console.error(err);
      return res.json({ success: false, data: [] });
    }

    return res.json({
      success: true,
      data: result,
    });
  });
});

async function buildDealPaymentsPayload(leadId) {
  await ensureDealPaymentSchema();

  const [leadRows] = await dbPromise.query(
    `
      SELECT
        l.*,
        DATE_FORMAT(l.payment_date, '%Y-%m-%d') AS payment_date,
        DATE_FORMAT(l.closed_date, '%Y-%m-%d') AS closed_date
      FROM leads l
      WHERE l.id = ?
      LIMIT 1
    `,
    [leadId],
  );

  if (!leadRows.length) return null;

  const lead = leadRows[0];
  const [payments] = await dbPromise.query(
    `
      SELECT
        id,
        lead_id,
        sequence_no,
        payment_label,
        payment_type,
        renewal_id,
        renewal_service_name,
        DATE_FORMAT(renewal_cycle_start_date, '%Y-%m-%d') AS renewal_cycle_start_date,
        amount,
        amount_without_gst,
        gst_amount,
        DATE_FORMAT(payment_date, '%Y-%m-%d') AS payment_date,
        payment_method,
        transaction_id,
        bank_name,
        notes,
        payment_status,
        created_by,
        created_by_name,
        DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') AS created_at
      FROM deal_payments
      WHERE lead_id = ?
      ORDER BY payment_date ASC, id ASC
    `,
    [leadId],
  );

  const normalizedPayments = payments.map((payment) => {
    const amount = roundServerAmount(payment.amount);
    const fallbackBreakup = calculateServerInclusiveGstBreakup(amount);
    const amountWithoutGst = hasServerStoredAmount(payment.amount_without_gst)
      ? roundServerAmount(payment.amount_without_gst)
      : fallbackBreakup.amountWithoutGst;
    const gstAmount = hasServerStoredAmount(payment.gst_amount)
      ? roundServerAmount(payment.gst_amount)
      : fallbackBreakup.gstAmount;

    return {
      ...payment,
      payment_type: normalizeServerDealPaymentType(payment.payment_type),
      renewal_id: Number(payment.renewal_id || 0),
      amount,
      amount_without_gst: amountWithoutGst,
      gst_amount: gstAmount,
    };
  });

  const dealAmount = roundServerAmount(lead.deal_amount);
  const receivedPartPayments = normalizedPayments
    .filter(
      (payment) =>
        normalizeServerPaymentStatus(payment.payment_status) === "received" &&
        normalizeServerDealPaymentType(payment.payment_type) !== "renewal",
    )
    .reduce(
      (sum, payment) => sum + normalizeServerAmount(payment.amount, 0),
      0,
    );
  const receivedRenewalPayments = normalizedPayments
    .filter(
      (payment) =>
        normalizeServerPaymentStatus(payment.payment_status) === "received" &&
        normalizeServerDealPaymentType(payment.payment_type) === "renewal",
    )
    .reduce(
      (sum, payment) => sum + normalizeServerAmount(payment.amount, 0),
      0,
    );
  const downPaymentAmount = getServerLeadDownPaymentAmount(
    lead,
    normalizedPayments,
  );
  const receivedAmount = roundServerAmount(
    Math.max(
      normalizeServerAmount(lead.received_amount, 0),
      downPaymentAmount + receivedPartPayments,
    ),
  );
  const remainingAmount = roundServerAmount(
    Math.max(dealAmount - receivedAmount, 0),
  );
  const receivedBreakup = calculateServerInclusiveGstBreakup(receivedAmount);
  const payStatus = normalizeServerPaymentStatus(lead.pay_stat, "pending");

  const normalizedLead = {
    ...lead,
    pay_stat: payStatus,
    down_payment_amount: downPaymentAmount,
    received_amount: receivedAmount,
    remaining_amount: remainingAmount,
  };

  let renewalOptions = [];
  try {
    await ensureDealServiceRenewalTables();
    const [renewalRows] = await dbPromise.query(
      `
        SELECT
          r.id AS renewal_id,
          r.service_name,
          r.renewal_basis,
          r.status,
          DATE_FORMAT(
            CASE
              WHEN r.current_start_date >= CURDATE() THEN r.current_start_date
              ELSE r.next_start_date
            END,
            '%Y-%m-%d'
          ) AS renewal_due_date,
          COALESCE(dp.product_amount, p.service_amount, 0) AS service_amount
        FROM deal_service_renewals r
        LEFT JOIN deal_products dp ON dp.id = r.deal_product_id
        LEFT JOIN (
          SELECT d.lead_id, dp2.product_name, SUM(dp2.product_amount) AS service_amount
          FROM deals d
          INNER JOIN deal_products dp2 ON dp2.deal_id = d.id
          WHERE d.lead_id = ?
          GROUP BY d.lead_id, dp2.product_name
        ) p ON p.lead_id = r.lead_id AND p.product_name = r.service_name
        WHERE r.lead_id = ?
          AND r.status = 'active'
        ORDER BY r.next_start_date ASC, r.service_name ASC
      `,
      [leadId, leadId],
    );

    renewalOptions = renewalRows.map((row) => ({
      renewal_id: Number(row.renewal_id || 0),
      id: Number(row.renewal_id || 0),
      service_name: row.service_name || "",
      serviceName: row.service_name || "",
      renewal_basis: normalizeServiceRenewalBasis(
        row.renewal_basis,
        row.service_name,
      ),
      renewal_due_date: row.renewal_due_date || "",
      service_amount: roundServerAmount(row.service_amount),
      amount: roundServerAmount(row.service_amount),
      status: getServiceRenewalStatus(row.status),
    }));
  } catch (err) {
    console.warn("Deal payment renewal options unavailable:", err.message || err);
    renewalOptions = [];
  }

  let dealProducts = [];
  try {
    const [prodRows] = await getDealProductsForInvoice(leadId);
    dealProducts = prodRows || [];
  } catch (err) {
    console.warn("Deal payment products unavailable:", err.message || err);
  }

  return {
    success: true,
    lead: normalizedLead,
    deal: normalizedLead,
    data: normalizedPayments,
    renewalOptions,
    renewal_options: renewalOptions,
    products: dealProducts,
    summary: {
      dealAmount,
      downPaymentAmount,
      receivedPartPayments: roundServerAmount(receivedPartPayments),
      receivedRenewalPayments: roundServerAmount(receivedRenewalPayments),
      receivedAmount,
      receivedAmountWithoutGst: receivedBreakup.amountWithoutGst,
      receivedGstAmount: receivedBreakup.gstAmount,
      remainingAmount,
      payStatus,
    },
  };
}

async function syncServerLeadPaymentTotals(leadId) {
  const [leadRows] = await dbPromise.query(
    `
      SELECT *
      FROM leads
      WHERE id = ?
      LIMIT 1
    `,
    [leadId],
  );

  if (!leadRows.length) return null;

  const lead = leadRows[0];
  const [payments] = await dbPromise.query(
    `
      SELECT amount, payment_status, payment_type
      FROM deal_payments
      WHERE lead_id = ?
    `,
    [leadId],
  );

  const dealAmount = roundServerAmount(lead.deal_amount);
  const downPaymentAmount = getServerLeadDownPaymentAmount(lead, payments);
  const receivedPartPayments = payments
    .filter(
      (payment) =>
        normalizeServerPaymentStatus(payment.payment_status) === "received" &&
        normalizeServerDealPaymentType(payment.payment_type) !== "renewal",
    )
    .reduce(
      (sum, payment) => sum + normalizeServerAmount(payment.amount, 0),
      0,
    );
  const receivedAmount = roundServerAmount(
    Math.min(dealAmount, downPaymentAmount + receivedPartPayments),
  );
  const remainingAmount = roundServerAmount(
    Math.max(dealAmount - receivedAmount, 0),
  );
  const totalGstAmount = roundServerAmount(
    normalizeServerAmount(lead.total_gst_amount, 0) ||
      calculateServerGstAmount(dealAmount),
  );
  const paidGstAmount = calculateServerGstAmount(receivedAmount);
  const remainingGstAmount = calculateServerGstAmount(remainingAmount);

  await dbPromise.query(
    `
      UPDATE leads
      SET received_amount = ?,
          remaining_amount = ?,
          gst_amount = ?,
          total_gst_amount = ?,
          remaining_gst_amount = ?
      WHERE id = ?
    `,
    [
      receivedAmount,
      remainingAmount,
      paidGstAmount,
      totalGstAmount,
      remainingGstAmount,
      leadId,
    ],
  );

  return {
    dealAmount,
    downPaymentAmount,
    receivedPartPayments: roundServerAmount(receivedPartPayments),
    receivedAmount,
    remainingAmount,
  };
}

async function getServerDealPaymentRenewalOption(leadId, renewalId) {
  await ensureDealServiceRenewalTables();

  const [rows] = await dbPromise.query(
    `
      SELECT
        r.id AS renewal_id,
        r.service_name,
        r.renewal_basis,
        r.status,
        DATE_FORMAT(
          CASE
            WHEN r.current_start_date >= CURDATE() THEN r.current_start_date
            ELSE r.next_start_date
          END,
          '%Y-%m-%d'
        ) AS renewal_due_date,
        COALESCE(dp.product_amount, p.service_amount, 0) AS service_amount
      FROM deal_service_renewals r
      LEFT JOIN deal_products dp ON dp.id = r.deal_product_id
      LEFT JOIN (
        SELECT d.lead_id, dp2.product_name, SUM(dp2.product_amount) AS service_amount
        FROM deals d
        INNER JOIN deal_products dp2 ON dp2.deal_id = d.id
        WHERE d.lead_id = ?
        GROUP BY d.lead_id, dp2.product_name
      ) p ON p.lead_id = r.lead_id AND p.product_name = r.service_name
      WHERE r.lead_id = ?
        AND r.id = ?
        AND r.status = 'active'
      LIMIT 1
    `,
    [leadId, leadId, renewalId],
  );

  if (!rows.length) return null;

  const row = rows[0];
  return {
    renewal_id: Number(row.renewal_id || 0),
    service_name: row.service_name || "",
    renewal_basis: normalizeServiceRenewalBasis(
      row.renewal_basis,
      row.service_name,
    ),
    renewal_due_date: row.renewal_due_date || "",
    service_amount: roundServerAmount(row.service_amount),
    status: getServiceRenewalStatus(row.status),
  };
}

app.get("/api/deal-payments/:leadId", async (req, res) => {
  const leadId = Number(req.params.leadId || 0);
  if (!leadId) {
    return res.status(400).json({
      success: false,
      message: "Invalid lead id",
    });
  }

  try {
    const payload = await buildDealPaymentsPayload(leadId);
    if (!payload) {
      return res.status(404).json({
        success: false,
        message: "Lead not found",
      });
    }

    return res.json(payload);
  } catch (err) {
    console.error("Deal Payments Fetch Error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to load deal payments",
    });
  }
});

app.post(
  "/api/deal-payments/:leadId",
  uploadPayment.none(),
  async (req, res) => {
    const leadId = Number(req.params.leadId || 0);
    let amount = roundServerAmount(req.body?.amount);
    const paymentType = normalizeServerDealPaymentType(req.body?.payment_type);
    const paymentDate = getServerDateKey(req.body?.payment_date);
    const paymentMethod = String(req.body?.payment_method || "").trim();
    const paymentStatus = normalizeServerPaymentStatus(
      req.body?.payment_status,
      "received",
    );

    if (!leadId) {
      return res.status(400).json({
        success: false,
        message: "Invalid lead id",
      });
    }

    if (paymentType !== "renewal" && amount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Payment amount must be greater than 0",
      });
    }

    if (!paymentDate) {
      return res.status(400).json({
        success: false,
        message: "Payment date is required",
      });
    }

    if (!paymentMethod) {
      return res.status(400).json({
        success: false,
        message: "Payment method is required",
      });
    }

    try {
      const currentPayload = await buildDealPaymentsPayload(leadId);
      if (!currentPayload) {
        return res.status(404).json({
          success: false,
          message: "Lead not found",
        });
      }

      const { lead, summary } = currentPayload;
      let renewalId = null;
      let renewalServiceName = null;
      let renewalCycleStartDate = null;
      let paymentLabel = "";

      if (paymentType === "renewal") {
        const requestedRenewalId = Number(req.body?.renewal_id || 0);
        if (!requestedRenewalId) {
          return res.status(400).json({
            success: false,
            message: "Select a renewal service",
          });
        }

        const renewalOption = await getServerDealPaymentRenewalOption(
          leadId,
          requestedRenewalId,
        );

        if (!renewalOption) {
          return res.status(404).json({
            success: false,
            message: "Renewal service not found for this deal",
          });
        }

        amount = roundServerAmount(renewalOption.service_amount);
        if (amount <= 0) {
          return res.status(400).json({
            success: false,
            message: "Renewal service amount is missing",
          });
        }

        renewalId = renewalOption.renewal_id;
        renewalServiceName = renewalOption.service_name;
        renewalCycleStartDate =
          getServerDateKey(req.body?.renewal_cycle_start_date) ||
          renewalOption.renewal_due_date ||
          paymentDate;
        paymentLabel = (
          String(req.body?.payment_label || "").trim() ||
          `Renewal - ${renewalServiceName}${
            renewalCycleStartDate ? ` (${renewalCycleStartDate})` : ""
          }`
        ).slice(0, 120);
      }

      if (
        paymentType !== "renewal" &&
        paymentStatus === "received" &&
        amount > summary.remainingAmount + 0.01
      ) {
        return res.status(400).json({
          success: false,
          message: "Payment amount cannot be greater than remaining balance",
        });
      }

      const [[sequenceRow]] = await dbPromise.query(
        "SELECT COALESCE(MAX(sequence_no), 0) + 1 AS nextSequence FROM deal_payments WHERE lead_id = ?",
        [leadId],
      );
      const sequenceNo = Number(sequenceRow?.nextSequence || 1);

      if (paymentType !== "renewal") {
        const [[installmentRow]] = await dbPromise.query(
          `
            SELECT COUNT(*) + 1 AS nextInstallment
            FROM deal_payments
            WHERE lead_id = ?
              AND COALESCE(payment_type, 'installment') <> 'renewal'
          `,
          [leadId],
        );
        const installmentNo = Number(
          installmentRow?.nextInstallment || sequenceNo,
        );
        const schedule = parseServerPartPaymentSchedule(
          lead.part_payment_schedule,
        );
        const scheduleItem = schedule[installmentNo - 1] || {};
        paymentLabel = (
          String(req.body?.payment_label || "").trim() ||
          `Installment #${scheduleItem.installmentNo || installmentNo}`
        ).slice(0, 120);
      }

      const paymentBreakup = calculateServerInclusiveGstBreakup(amount);

      await dbPromise.query(
        `
        INSERT INTO deal_payments
          (lead_id, sequence_no, payment_label, payment_type, renewal_id,
           renewal_service_name, renewal_cycle_start_date, amount, amount_without_gst, gst_amount,
           payment_date, payment_method,
           transaction_id, bank_name, notes, payment_status, created_by, created_by_name)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
        [
          leadId,
          sequenceNo,
          paymentLabel,
          paymentType,
          renewalId,
          renewalServiceName,
          renewalCycleStartDate,
          amount,
          paymentBreakup.amountWithoutGst,
          paymentBreakup.gstAmount,
          paymentDate,
          paymentMethod,
          String(req.body?.transaction_id || "").trim() || null,
          String(req.body?.bank_name || "").trim() || null,
          String(req.body?.notes || "").trim() || null,
          paymentStatus,
          Number(req.body?.created_by || 0) || null,
          String(req.body?.created_by_name || "").trim() || null,
        ],
      );

      if (paymentStatus === "received" && paymentType !== "renewal") {
        const dealAmount = summary.dealAmount;
        const receivedAmount = roundServerAmount(
          Math.min(dealAmount, summary.receivedAmount + amount),
        );
        const remainingAmount = roundServerAmount(
          Math.max(dealAmount - receivedAmount, 0),
        );
        const totalGstAmount = roundServerAmount(
          normalizeServerAmount(lead.total_gst_amount, 0) ||
            calculateServerGstAmount(dealAmount),
        );
        const paidGstAmount = calculateServerGstAmount(receivedAmount);
        const remainingGstAmount = calculateServerGstAmount(remainingAmount);

        await dbPromise.query(
          `
          UPDATE leads
          SET received_amount = ?,
              remaining_amount = ?,
              gst_amount = ?,
              total_gst_amount = ?,
              remaining_gst_amount = ?,
              payment_date = COALESCE(payment_date, ?)
          WHERE id = ?
        `,
          [
            receivedAmount,
            remainingAmount,
            paidGstAmount,
            totalGstAmount,
            remainingGstAmount,
            paymentDate,
            leadId,
          ],
        );
      }

      const nextPayload = await buildDealPaymentsPayload(leadId);
      return res.json({
        ...nextPayload,
        message:
          paymentType === "renewal"
            ? "Renewal payment entry saved"
            : "Payment entry saved",
      });
    } catch (err) {
      console.error("Deal Payment Save Error:", err);
      return res.status(500).json({
        success: false,
        message: "Failed to save payment",
      });
    }
  },
);

app.put("/api/deal-payments/:leadId/:paymentId/status", async (req, res) => {
  const leadId = Number(req.params.leadId || 0);
  const paymentId = Number(req.params.paymentId || 0);
  const paymentStatus = normalizeServerPaymentStatus(
    req.body?.payment_status,
    "",
  );

  if (!leadId || !paymentId) {
    return res.status(400).json({
      success: false,
      message: "Invalid payment id",
    });
  }

  if (!["pending", "received", "failed"].includes(paymentStatus)) {
    return res.status(400).json({
      success: false,
      message: "Invalid payment status",
    });
  }

  try {
    const [result] = await dbPromise.query(
      `
        UPDATE deal_payments
        SET payment_status = ?
        WHERE id = ?
          AND lead_id = ?
      `,
      [paymentStatus, paymentId, leadId],
    );

    if (!result.affectedRows) {
      return res.status(404).json({
        success: false,
        message: "Payment not found",
      });
    }

    await syncServerLeadPaymentTotals(leadId);
    const nextPayload = await buildDealPaymentsPayload(leadId);

    return res.json({
      ...nextPayload,
      message: "Payment status updated",
    });
  } catch (err) {
    console.error("Deal Payment Status Update Error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to update payment status",
    });
  }
});

app.put("/api/deals/:id", async (req, res) => {
  const leadId = Number(req.params.id || 0);
  const dealAmount = roundServerAmount(req.body?.deal_amount);
  const receivedAmount = roundServerAmount(req.body?.received_amount);
  const paymentStatus = normalizeServerPaymentStatus(
    req.body?.pay_stat,
    "pending",
  );

  if (
    !leadId ||
    dealAmount <= 0 ||
    receivedAmount < 0 ||
    receivedAmount > dealAmount
  ) {
    return res.status(400).json({
      success: false,
      message: "Invalid deal amount details",
    });
  }

  try {
    await ensureDealPaymentSchema();

    const remainingAmount = roundServerAmount(
      Math.max(dealAmount - receivedAmount, 0),
    );
    const totalGstAmount = calculateServerGstAmount(dealAmount);
    const paidGstAmount = calculateServerGstAmount(receivedAmount);
    const remainingGstAmount = calculateServerGstAmount(remainingAmount);

    const [result] = await dbPromise.query(
      `
        UPDATE leads
        SET deal_amount = ?,
            received_amount = ?,
            down_payment_amount = COALESCE(down_payment_amount, ?),
            remaining_amount = ?,
            gst_amount = ?,
            total_gst_amount = ?,
            remaining_gst_amount = ?,
            payment_method = ?,
            pay_stat = ?,
            payment_date = ?,
            closed_date = COALESCE(?, closed_date)
        WHERE id = ?
      `,
      [
        dealAmount,
        receivedAmount,
        receivedAmount,
        remainingAmount,
        paidGstAmount,
        totalGstAmount,
        remainingGstAmount,
        String(req.body?.payment_method || "").trim() || null,
        paymentStatus,
        getServerDateKey(req.body?.payment_date) || null,
        getServerDateKey(req.body?.closed_date) || null,
        leadId,
      ],
    );

    if (!result.affectedRows) {
      return res.status(404).json({
        success: false,
        message: "Deal not found",
      });
    }

    return res.json({
      success: true,
      message: "Deal updated successfully",
    });
  } catch (err) {
    console.error("Deal Update Error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to update deal",
    });
  }
});

const DEAL_PRODUCT_CATALOG_ROUTES = [
  "/api/deal-products",
  "/api/products",
  "/api/admin/deal-products",
  "/api/admin/products",
];

app.get(DEAL_PRODUCT_CATALOG_ROUTES, async (req, res) => {
  try {
    const includeInactive =
      String(req.query.includeInactive || req.query.include_inactive || "")
        .trim()
        .toLowerCase() === "1" ||
      String(req.query.includeInactive || req.query.include_inactive || "")
        .trim()
        .toLowerCase() === "true";

    const data = await getDealProductCatalog({ includeInactive });
    res.json({ success: true, data });
  } catch (err) {
    console.error("Deal Product Catalog Fetch Error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to load products",
      data: [],
    });
  }
});

app.post(DEAL_PRODUCT_CATALOG_ROUTES, async (req, res) => {
  try {
    const product = normalizeDealProductCatalogPayload(req.body);

    if (!product.name) {
      return res.status(400).json({
        success: false,
        message: "Product name is required",
      });
    }

    if (!Number.isFinite(product.price) || product.price <= 0) {
      return res.status(400).json({
        success: false,
        message: "Product price must be greater than 0",
      });
    }

    await ensureDealProductCatalogTable();
    const [result] = await dbPromise.query(
      `
        INSERT INTO deal_product_catalog
          (product_name, product_group, price, sort_order, status)
        VALUES (?, ?, ?, ?, ?)
      `,
      [
        product.name,
        product.group,
        product.price,
        product.sortOrder,
        product.status,
      ],
    );

    res.status(201).json({
      success: true,
      message: "Product saved successfully",
      data: {
        id: result.insertId,
        name: product.name,
        group: product.group,
        price: product.price,
        sort_order: product.sortOrder,
        status: product.status,
      },
    });
  } catch (err) {
    console.error("Deal Product Catalog Create Error:", err);
    res.status(err.code === "ER_DUP_ENTRY" ? 409 : 500).json({
      success: false,
      message:
        err.code === "ER_DUP_ENTRY"
          ? "A product with this name already exists"
          : "Failed to save product",
    });
  }
});

const DEAL_PRODUCT_CATALOG_ITEM_ROUTES = DEAL_PRODUCT_CATALOG_ROUTES.map(
  (route) => `${route}/:id`,
);
const DEAL_PRODUCT_CATALOG_STATUS_ROUTES = DEAL_PRODUCT_CATALOG_ROUTES.map(
  (route) => `${route}/:id/status`,
);

app.put(DEAL_PRODUCT_CATALOG_ITEM_ROUTES, async (req, res) => {
  const productId = Number(req.params.id);

  if (!productId) {
    return res.status(400).json({
      success: false,
      message: "Invalid product id",
    });
  }

  try {
    const product = normalizeDealProductCatalogPayload(req.body);

    if (!product.name) {
      return res.status(400).json({
        success: false,
        message: "Product name is required",
      });
    }

    if (!Number.isFinite(product.price) || product.price <= 0) {
      return res.status(400).json({
        success: false,
        message: "Product price must be greater than 0",
      });
    }

    await ensureDealProductCatalogTable();
    const [result] = await dbPromise.query(
      `
        UPDATE deal_product_catalog
        SET product_name = ?,
            product_group = ?,
            price = ?,
            sort_order = ?,
            status = ?
        WHERE id = ?
      `,
      [
        product.name,
        product.group,
        product.price,
        product.sortOrder,
        product.status,
        productId,
      ],
    );

    if (!result.affectedRows) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    res.json({
      success: true,
      message: "Product updated successfully",
    });
  } catch (err) {
    console.error("Deal Product Catalog Update Error:", err);
    res.status(err.code === "ER_DUP_ENTRY" ? 409 : 500).json({
      success: false,
      message:
        err.code === "ER_DUP_ENTRY"
          ? "A product with this name already exists"
          : "Failed to update product",
    });
  }
});

app.patch(DEAL_PRODUCT_CATALOG_STATUS_ROUTES, async (req, res) => {
  const productId = Number(req.params.id);
  const status = normalizeDealProductStatus(req.body?.status, "");

  if (!productId) {
    return res.status(400).json({
      success: false,
      message: "Invalid product id",
    });
  }

  if (!status) {
    return res.status(400).json({
      success: false,
      message: "Invalid product status",
    });
  }

  try {
    await ensureDealProductCatalogTable();
    const [result] = await dbPromise.query(
      "UPDATE deal_product_catalog SET status = ? WHERE id = ?",
      [status, productId],
    );

    if (!result.affectedRows) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    res.json({
      success: true,
      message: `Product marked ${status}`,
    });
  } catch (err) {
    console.error("Deal Product Catalog Status Error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to update product status",
    });
  }
});

app.delete(DEAL_PRODUCT_CATALOG_ITEM_ROUTES, async (req, res) => {
  const productId = Number(req.params.id);

  if (!productId) {
    return res.status(400).json({
      success: false,
      message: "Invalid product id",
    });
  }

  try {
    await ensureDealProductCatalogTable();
    const [result] = await dbPromise.query(
      "DELETE FROM deal_product_catalog WHERE id = ?",
      [productId],
    );

    if (!result.affectedRows) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    res.json({
      success: true,
      message: "Product deleted successfully",
    });
  } catch (err) {
    console.error("Deal Product Catalog Delete Error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to delete product",
    });
  }
});

app.post("/api/deal-otp/send", async (req, res) => {
  try {
    const leadId = Number(req.body?.leadId || req.query?.leadId || 0);

    if (!leadId) {
      return res.status(400).json({
        success: false,
        message: "Invalid lead id",
      });
    }

    const [rows] = await dbPromise.query(
      `
        SELECT id, telephone, client_name, company_name
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
    const phone = lead.telephone || "";
    const otp = createDealOtp(leadId);

    res.json({
      success: true,
      message: "OTP generated",
      otp,
      maskedPhone: maskDealOtpPhone(phone),
      expiresInSeconds: Math.floor(DEAL_OTP_TTL_MS / 1000),
    });
  } catch (err) {
    console.error("Deal OTP Send Error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to send deal OTP",
    });
  }
});

app.post("/api/deal-otp/verify", async (req, res) => {
  try {
    cleanupExpiredDealOtps();

    const leadId = Number(req.body?.leadId || 0);
    const otp = normalizeDealOtp(req.body?.otp);

    if (!leadId || otp.length !== 6) {
      return res.status(400).json({
        success: false,
        message: "Invalid OTP",
      });
    }

    const record = dealOtpStore.get(String(leadId));
    if (!record) {
      return res.status(400).json({
        success: false,
        message: "OTP expired. Please resend OTP.",
      });
    }

    if (record.otp !== otp) {
      return res.status(400).json({
        success: false,
        message: "Incorrect OTP",
      });
    }

    dealOtpStore.delete(String(leadId));
    res.json({
      success: true,
      message: "OTP verified",
    });
  } catch (err) {
    console.error("Deal OTP Verify Error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to verify deal OTP",
    });
  }
});

app.post("/api/deal-products/quote", async (req, res) => {
  try {
    const { leadId, downsaleApprovalId } = req.body || {};
    const products = normalizeDealProductsInput(req.body?.products);

    const productPrices = await getDealProductPriceMap();
    const quote = calculateDealProductsQuote(
      products,
      productPrices,
      req.body || {},
    );

    if (!quote.valid) {
      return res.status(400).json({
        success: false,
        message: quote.message,
      });
    }

    const total = quote.total;
    const items = quote.items;
    const upsaleAmount = Math.max(
      0,
      roundServerAmount(req.body?.upsaleAmount || 0),
    );
    let finalTotal = total;
    let approvalStatus = null;
    let hasApprovedDownsale = false;
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
          hasApprovedDownsale = true;
        }
      }
    }

    finalTotal = roundServerAmount(Math.max(0, finalTotal + upsaleAmount));

    res.json({
      success: true,
      data: {
        items,
        standardTotal: total,
        total: finalTotal,
        upsaleAmount,
        hasApprovedDownsale,
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
    const requestedCompanyScope = normalizeCompanyScopeKey(
      req.query.companyScope || req.query.company_scope || req.query.company,
    );
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

    const where = filters.length ? `WHERE ${filters.join(" AND ")}` : "";
    const sql = `
      SELECT
        dr.*,
        l.company_name,
        l.client_name,
        COALESCE(
          NULLIF(TRIM(dr.company_scope), ''),
          NULLIF(TRIM(u.comp_name), ''),
          NULLIF(TRIM(l.company_scope), ''),
          NULLIF(TRIM(lead_creator.comp_name), ''),
          'metrics'
        ) AS company_scope,
        u.name AS requested_by_name,
        reviewer.name AS reviewed_by_name
      FROM downsale_requests dr
      LEFT JOIN leads l ON l.id = dr.lead_id
      LEFT JOIN users u ON u.id = dr.requested_by
      LEFT JOIN users lead_creator ON lead_creator.id = l.created_by
      LEFT JOIN users reviewer ON reviewer.id = dr.reviewed_by
      ${where}
      ORDER BY dr.created_at DESC, dr.id DESC
    `;
    const [rows] = await dbPromise.query(sql, params);
    const data = rows
      .map((row) => {
        const companyScope =
          normalizeCompanyScopeKey(row.company_scope) || "metrics";
        return {
          ...row,
          company_scope: companyScope,
          companyScope,
          company_scope_key: companyScope,
        };
      })
      .filter((row) =>
        requestedCompanyScope
          ? row.company_scope === requestedCompanyScope
          : true,
      );

    res.json({ success: true, data });
  } catch (err) {
    console.error("Downsale Fetch Error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to fetch downsale requests",
      data: [],
    });
  }
});

async function resolveDownsaleRequestCompanyScope({
  leadId,
  requestedBy,
  requestedScope,
}) {
  const bodyScope = normalizeCompanyScopeKey(requestedScope);
  if (bodyScope) return bodyScope;

  const [rows] = await dbPromise.query(
    `
      SELECT
        COALESCE(
          NULLIF(TRIM(requester.comp_name), ''),
          NULLIF(TRIM(l.company_scope), ''),
          NULLIF(TRIM(lead_creator.comp_name), ''),
          'metrics'
        ) AS company_scope
      FROM leads l
      LEFT JOIN users requester ON requester.id = ?
      LEFT JOIN users lead_creator ON lead_creator.id = l.created_by
      WHERE l.id = ?
      LIMIT 1
    `,
    [requestedBy || 0, leadId || 0],
  );

  return normalizeCompanyScopeKey(rows[0]?.company_scope) || "metrics";
}

app.post("/api/downsale-requests", async (req, res) => {
  try {
    await ensureDownsaleRequestsTable();
    await ensureLeadCompanyScopeColumn();

    const leadId = Number(req.body.leadId);
    const requestedBy = Number(req.body.requestedBy || 0) || null;
    const products = normalizeDealProductsInput(req.body.products);
    const requestedAmount = Number(req.body.requestedAmount);
    const reason = String(req.body.reason || "").trim() || null;
    const productPrices = await getDealProductPriceMap();
    const productNames = products
      .map((product) => getDealProductInputName(product))
      .filter(Boolean);
    const productQuote = calculateDealProductsQuote(
      products,
      productPrices,
      req.body || {},
    );
    const standardAmount = productQuote.valid ? productQuote.total : NaN;

    if (
      !leadId ||
      productNames.length === 0 ||
      !productQuote.valid ||
      !Number.isFinite(standardAmount) ||
      standardAmount <= 0
    ) {
      return res.status(400).json({
        success: false,
        message: productQuote.message || "Invalid downsale products",
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

    const companyScope = await resolveDownsaleRequestCompanyScope({
      leadId,
      requestedBy,
      requestedScope:
        req.body.companyScope ||
        req.body.company_scope ||
        req.body.company ||
        req.body.comp_name,
    });

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
      if (companyScope) {
        await dbPromise.query(
          `UPDATE downsale_requests
           SET company_scope = COALESCE(NULLIF(TRIM(company_scope), ''), ?)
           WHERE id = ?`,
          [companyScope, existing[0].id],
        );
      }

      return res.json({
        success: true,
        message: "Downsale request already pending",
        id: existing[0].id,
      });
    }

    const [result] = await dbPromise.query(
      `INSERT INTO downsale_requests
        (lead_id, requested_by, product_name, standard_amount, requested_amount, company_scope, reason)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        leadId,
        requestedBy,
        "Overall Deal",
        standardAmount,
        requestedAmount,
        companyScope,
        reason,
      ],
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
        statusCode === 403 ? err.message : "Failed to update downsale request",
    });
  }
});

const SERVICE_RENEWAL_BASIS_MONTHS = {
  monthly: 1,
  quarterly: 3,
  half_yearly: 6,
  yearly: 12,
};

const SERVICE_RENEWAL_BASIS_LABELS = {
  monthly: "Monthly",
  quarterly: "Quarterly",
  half_yearly: "Half Yearly",
  yearly: "Yearly",
};

let dealServiceRenewalSchemaReady = false;

function isNonRenewableService(serviceName = "") {
  return getDealProductMatchKey(serviceName).includes("profilecreation");
}

function isWebsiteRenewalService(serviceName = "") {
  const normalized = getDealProductMatchKey(serviceName);
  if (
    normalized.includes("seo") ||
    normalized.includes("gmb") ||
    normalized.includes("keyword") ||
    normalized.includes("profilecreation")
  ) {
    return false;
  }

  return (
    normalized.includes("website") ||
    normalized.includes("web") ||
    normalized.includes("landingpage") ||
    normalized.includes("ecommerce")
  );
}

function isBusinessSoftwareRenewalService(serviceName = "") {
  const normalized = getDealProductMatchKey(serviceName);
  return (
    normalized.includes("erp") ||
    normalized.includes("crm") ||
    normalized.includes("hrms") ||
    normalized.includes("hrm") ||
    normalized.includes("humanresource") ||
    normalized === "software"
  );
}

function isYearlyOnlyRenewalService(serviceName = "") {
  return (
    isWebsiteRenewalService(serviceName) ||
    isBusinessSoftwareRenewalService(serviceName)
  );
}

function normalizeServiceRenewalBasis(value, serviceName = "") {
  if (isYearlyOnlyRenewalService(serviceName)) return "yearly";

  const normalized = String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[\s-]+/g, "_");
  const aliases = {
    quarter: "quarterly",
    quaterly: "quarterly",
    quarterly: "quarterly",
    halfly: "half_yearly",
    half_yearly: "half_yearly",
    halfyearly: "half_yearly",
    full_yearly: "yearly",
    fullyearly: "yearly",
    annual: "yearly",
    annually: "yearly",
  };
  const basis = aliases[normalized] || normalized;
  return SERVICE_RENEWAL_BASIS_MONTHS[basis] ? basis : "monthly";
}

function getServiceRenewalBasisMonths(basis) {
  return SERVICE_RENEWAL_BASIS_MONTHS[basis] || 1;
}


function getServiceRenewalCycleEndDate(startDate, basis) {
  const nextDate = addServerMonths(
    startDate,
    getServiceRenewalBasisMonths(basis),
  );
  return nextDate ? addServerDays(nextDate, -1) : "";
}

function isDealCloseServiceRenewalEnabled(value) {
  const normalized = String(value ?? "")
    .toLowerCase()
    .trim();
  return ["1", "true", "yes", "on", "enabled", "renewal"].includes(
    normalized,
  );
}

function getDealCloseRenewableProducts(products = []) {
  const seen = new Set();
  return (Array.isArray(products) ? products : [])
    .map((product = {}) => ({
      name: String(
        product.name || product.product_name || product.service_name || "",
      ).trim(),
    }))
    .filter((product) => product.name && !isNonRenewableService(product.name))
    .filter((product) => {
      const key = getDealProductMatchKey(product.name);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

async function saveDealCloseServiceRenewals({
  leadId,
  dealId,
  products,
  basis,
  startDate,
  actorId,
}) {
  const normalizedLeadId = Number(leadId || 0);
  const normalizedDealId = Number(dealId || 0);
  const normalizedStartDate = getServerDateKey(startDate);
  const renewableProducts = getDealCloseRenewableProducts(products);

  if (
    !normalizedLeadId ||
    !normalizedDealId ||
    !normalizedStartDate ||
    !renewableProducts.length
  ) {
    return { created: 0 };
  }

  await ensureDealServiceRenewalTables();

  let created = 0;
  for (const product of renewableProducts) {
    const serviceBasis = normalizeServiceRenewalBasis(basis, product.name);
    const nextStartDate = addServerMonths(
      normalizedStartDate,
      getServiceRenewalBasisMonths(serviceBasis),
    );
    const [dealProductRows] = await dbPromise.query(
      `
        SELECT id, product_name
        FROM deal_products
        WHERE deal_id = ?
          AND product_name = ?
        ORDER BY id DESC
        LIMIT 1
      `,
      [normalizedDealId, product.name],
    );
    const dealProduct = dealProductRows[0] || {};
    const serviceName = dealProduct.product_name || product.name;
    const [result] = await dbPromise.query(
      `
        INSERT INTO deal_service_renewals (
          lead_id,
          deal_id,
          deal_product_id,
          service_name,
          renewal_basis,
          first_start_date,
          current_start_date,
          next_start_date,
          status,
          created_by,
          updated_by,
          stopped_by,
          stopped_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, NULL, NULL)
        ON DUPLICATE KEY UPDATE
          id = LAST_INSERT_ID(id),
          deal_id = VALUES(deal_id),
          deal_product_id = VALUES(deal_product_id),
          renewal_basis = VALUES(renewal_basis),
          first_start_date = VALUES(first_start_date),
          current_start_date = VALUES(current_start_date),
          next_start_date = VALUES(next_start_date),
          status = 'active',
          updated_by = VALUES(updated_by),
          stopped_by = NULL,
          stopped_at = NULL
      `,
      [
        normalizedLeadId,
        normalizedDealId,
        dealProduct.id || null,
        serviceName,
        serviceBasis,
        normalizedStartDate,
        normalizedStartDate,
        nextStartDate,
        Number(actorId || 0) || null,
        Number(actorId || 0) || null,
      ],
    );
    const renewalId = Number(result.insertId || 0);
    if (!renewalId) continue;

    await insertServiceRenewalHistory({
      renewalId,
      leadId: normalizedLeadId,
      serviceName,
      basis: serviceBasis,
      startDate: normalizedStartDate,
      reason: "deal_close_start",
    });
    created += 1;
  }

  if (created > 0) {
    await syncDueServiceRenewals();
  }

  return { created };
}

function getServiceRenewalStatus(value) {
  const normalized = String(value || "")
    .toLowerCase()
    .trim();
  return normalized === "stopped" ? "stopped" : "active";
}

async function ensureDealServiceRenewalTables() {
  if (dealServiceRenewalSchemaReady) return;

  await ensureDealProductsTable();
  await ensureLeadCompanyScopeColumn();
  await runSchemaQuery(`
    CREATE TABLE IF NOT EXISTS deal_service_renewals (
      id int NOT NULL AUTO_INCREMENT,
      lead_id int NOT NULL,
      deal_id int DEFAULT NULL,
      deal_product_id int DEFAULT NULL,
      service_name varchar(255) NOT NULL,
      renewal_basis varchar(30) NOT NULL DEFAULT 'monthly',
      first_start_date date NOT NULL,
      current_start_date date NOT NULL,
      next_start_date date NOT NULL,
      status varchar(30) NOT NULL DEFAULT 'active',
      created_by int DEFAULT NULL,
      updated_by int DEFAULT NULL,
      stopped_by int DEFAULT NULL,
      stopped_at datetime DEFAULT NULL,
      created_at datetime DEFAULT CURRENT_TIMESTAMP,
      updated_at datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY deal_service_renewal_unique (lead_id, service_name),
      KEY deal_service_renewal_lead_idx (lead_id),
      KEY deal_service_renewal_next_idx (next_start_date),
      KEY deal_service_renewal_status_idx (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
  `);

  await runSchemaQuery(`
    CREATE TABLE IF NOT EXISTS deal_service_renewal_history (
      id int NOT NULL AUTO_INCREMENT,
      renewal_id int NOT NULL,
      lead_id int NOT NULL,
      service_name varchar(255) NOT NULL,
      renewal_basis varchar(30) NOT NULL,
      cycle_start_date date NOT NULL,
      cycle_end_date date NOT NULL,
      created_reason varchar(50) NOT NULL DEFAULT 'scheduled',
      created_at datetime DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY deal_service_renewal_history_unique (renewal_id, cycle_start_date),
      KEY deal_service_renewal_history_lead_idx (lead_id),
      KEY deal_service_renewal_history_month_idx (cycle_start_date)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
  `);

  dealServiceRenewalSchemaReady = true;
}

async function insertServiceRenewalHistory({
  renewalId,
  leadId,
  serviceName,
  basis,
  startDate,
  reason = "scheduled",
}) {
  const normalizedStart = getServerDateKey(startDate);
  if (!renewalId || !leadId || !serviceName || !normalizedStart) return;

  const normalizedBasis = normalizeServiceRenewalBasis(basis, serviceName);
  const cycleEndDate = getServiceRenewalCycleEndDate(
    normalizedStart,
    normalizedBasis,
  );

  await dbPromise.query(
    `
      INSERT IGNORE INTO deal_service_renewal_history (
        renewal_id,
        lead_id,
        service_name,
        renewal_basis,
        cycle_start_date,
        cycle_end_date,
        created_reason
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `,
    [
      renewalId,
      leadId,
      serviceName,
      normalizedBasis,
      normalizedStart,
      cycleEndDate,
      reason,
    ],
  );
}

async function syncDueServiceRenewals() {
  await ensureDealServiceRenewalTables();

  const todayKey = getServerDateKey(new Date());
  const [rows] = await dbPromise.query(
    `
      SELECT id, lead_id, service_name, renewal_basis, next_start_date
      FROM deal_service_renewals
      WHERE status = 'active'
        AND next_start_date IS NOT NULL
        AND next_start_date <= CURDATE()
    `,
  );

  for (const row of rows) {
    let currentStartDate = "";
    let nextStartDate = getServerDateKey(row.next_start_date);
    const basis = normalizeServiceRenewalBasis(
      row.renewal_basis,
      row.service_name,
    );
    let guard = 0;

    while (nextStartDate && nextStartDate <= todayKey && guard < 60) {
      currentStartDate = nextStartDate;
      await insertServiceRenewalHistory({
        renewalId: row.id,
        leadId: row.lead_id,
        serviceName: row.service_name,
        basis,
        startDate: currentStartDate,
        reason: "auto_roll",
      });
      nextStartDate = addServerMonths(
        currentStartDate,
        getServiceRenewalBasisMonths(basis),
      );
      guard += 1;
    }

    if (currentStartDate && nextStartDate) {
      await dbPromise.query(
        `
          UPDATE deal_service_renewals
          SET current_start_date = ?,
              next_start_date = ?,
              renewal_basis = ?
          WHERE id = ?
        `,
        [currentStartDate, nextStartDate, basis, row.id],
      );
    }
  }
}

function getServiceRenewalScopeWhere({ role, userId, userName }) {
  const normalizedRole = String(role || "")
    .toLowerCase()
    .trim();
  const normalizedUserId = Number(userId || 0);
  const normalizedUserName = String(userName || "").trim();

  if (normalizedRole === "admin" || normalizedRole === "accounts") {
    return { sql: "", params: [] };
  }

  if (normalizedRole === "me") {
    return {
      sql: " AND (l.closed_by = ? OR l.assign_emp_id = ? OR l.assign_emp = ?)",
      params: [normalizedUserId, normalizedUserId, normalizedUserName],
    };
  }

  return {
    sql: " AND (l.created_by = ? OR l.closed_by = ?)",
    params: [normalizedUserId, normalizedUserId],
  };
}

function normalizeServiceRenewalRow(row = {}) {
  const status = getServiceRenewalStatus(row.status);
  const serviceName = row.service_name || row.product_name || "";
  const basis = normalizeServiceRenewalBasis(row.renewal_basis, serviceName);
  const daysLeft = Number(row.days_left);
  const clientEmail = String(row.client_email || row.email || "").trim();
  const ownerEmails = [
    row.assigned_user_email,
    row.closer_user_email,
    row.creator_user_email,
  ]
    .map((email) => String(email || "").trim().toLowerCase())
    .filter(Boolean);
  const emailBelongsToInternalUser = Number(row.client_email_is_internal || 0) > 0;
  const safeClientEmail =
    clientEmail &&
    !emailBelongsToInternalUser &&
    !ownerEmails.includes(clientEmail.toLowerCase())
      ? clientEmail
      : "";

  return {
    ...row,
    id: Number(row.renewal_id || row.id || 0),
    renewal_id: Number(row.renewal_id || row.id || 0),
    lead_id: Number(row.lead_id || 0),
    deal_id: Number(row.deal_id || 0),
    deal_product_id: Number(row.deal_product_id || 0),
    service_name: serviceName,
    serviceName,
    renewal_basis: basis,
    renewalBasis: basis,
    renewal_basis_label: SERVICE_RENEWAL_BASIS_LABELS[basis] || basis,
    website_yearly_only: isYearlyOnlyRenewalService(serviceName) ? 1 : 0,
    status,
    is_configured: Number(row.renewal_id || row.id || 0) > 0 ? 1 : 0,
    renewal_due_date: row.renewal_due_date || row.next_start_date || "",
    days_left: Number.isFinite(daysLeft) ? daysLeft : null,
    company_scope: normalizeCompanyScopeKey(row.company_scope) || "metrics",
    contact: row.telephone || row.contact || row.alternate_contact || "",
    email: safeClientEmail,
    client_email: safeClientEmail,
    renewal_count: Number(row.renewal_id || row.id || 0) > 0 ? 1 : 0,
    renewal_closed_count: 0,
  };
}



function buildServiceRenewalSummary(rows = []) {
  return rows.reduce(
    (summary, row) => {
      summary.total += 1;
      if (!row.is_configured) {
        summary.unconfigured += 1;
        return summary;
      }
      summary.configured += 1;
      summary.started += 1;
      if (row.status === "stopped") {
        summary.stopped += 1;
        return summary;
      }
      summary.active += 1;
      if (
        Number.isFinite(Number(row.days_left)) &&
        Number(row.days_left) >= 0 &&
        Number(row.days_left) <= 2
      ) {
        summary.dueSoon += 1;
        summary.notifySoon += 1;
      }
      return summary;
    },
    {
      total: 0,
      configured: 0,
      active: 0,
      stopped: 0,
      unconfigured: 0,
      overdue: 0,
      dueSoon: 0,
      notifySoon: 0,
      started: 0,
    },
  );
}


async function buildDealServiceRenewalsPayload({
  role,
  userId,
  userName,
  month,
  status,
  companyScope,
}) {
  await syncDueServiceRenewals();

  const requestedCompanyScope = normalizeCompanyScopeKey(companyScope);
  const normalizedMonth = String(month || "").match(/^\d{4}-\d{2}$/)
    ? String(month)
    : "";
  const normalizedStatus = String(status || "all")
    .toLowerCase()
    .trim();
  const scope = getServiceRenewalScopeWhere({ role, userId, userName });
  const serviceProductsSql = `
    SELECT
      d.lead_id,
      MIN(d.id) AS deal_id,
      MIN(dp.id) AS deal_product_id,
      dp.product_name AS service_name,
      SUM(dp.product_amount) AS service_amount
    FROM deals d
    INNER JOIN deal_products dp ON dp.deal_id = d.id
    GROUP BY d.lead_id, dp.product_name
  `;
  const companyScopeSql = `
    COALESCE(
      NULLIF(TRIM(l.company_scope), ''),
      NULLIF(TRIM(closer_user.comp_name), ''),
      NULLIF(TRIM(creator_user.comp_name), ''),
      'metrics'
    )
  `;
  const baseParams = [...scope.params];
  let sql;
  let params;

  if (normalizedMonth) {
    sql = `
      SELECT
        r.id AS renewal_id,
        r.lead_id,
        r.deal_id,
        r.deal_product_id,
        r.service_name,
        p.service_amount,
        r.renewal_basis,
        r.status,
        DATE_FORMAT(r.first_start_date, '%Y-%m-%d') AS first_start_date,
        DATE_FORMAT(r.current_start_date, '%Y-%m-%d') AS current_start_date,
        DATE_FORMAT(r.next_start_date, '%Y-%m-%d') AS next_start_date,
        DATE_FORMAT(h.cycle_start_date, '%Y-%m-%d') AS history_start_date,
        DATE_FORMAT(h.cycle_end_date, '%Y-%m-%d') AS history_end_date,
        DATE_FORMAT(h.cycle_start_date, '%Y-%m-%d') AS renewal_due_date,
        DATEDIFF(h.cycle_start_date, CURDATE()) AS days_left,
        l.company_name,
        l.client_name,
        l.contact,
        l.alternate_contact,
        l.telephone,
        l.email,
        NULLIF(TRIM(l.email), '') AS client_email,
        CASE
          WHEN NULLIF(TRIM(l.email), '') IS NOT NULL
            AND EXISTS (
              SELECT 1
              FROM users email_guard
              WHERE LOWER(TRIM(COALESCE(email_guard.email, ''))) = LOWER(TRIM(l.email))
              LIMIT 1
            )
          THEN 1
          ELSE 0
        END AS client_email_is_internal,
        l.deal_amount,
        DATE_FORMAT(l.closed_date, '%Y-%m-%d') AS closed_date,
        COALESCE(assigned_user.name, l.assign_emp, closer_user.name, creator_user.name) AS owner_name,
        assigned_user.email AS assigned_user_email,
        closer_user.email AS closer_user_email,
        creator_user.email AS creator_user_email,
        ${companyScopeSql} AS company_scope
      FROM deal_service_renewal_history h
      INNER JOIN deal_service_renewals r ON r.id = h.renewal_id
      INNER JOIN leads l ON l.id = r.lead_id
      LEFT JOIN (${serviceProductsSql}) p
        ON p.lead_id = r.lead_id AND p.service_name = r.service_name
      LEFT JOIN users assigned_user ON assigned_user.id = l.assign_emp_id
      LEFT JOIN users creator_user ON creator_user.id = l.created_by
      LEFT JOIN users closer_user ON closer_user.id = l.closed_by
      WHERE l.lead_status = 'deal_closed'
        AND DATE_FORMAT(h.cycle_start_date, '%Y-%m') = ?
        ${scope.sql}
      ORDER BY h.cycle_start_date ASC, l.closed_date DESC, r.id DESC
    `;
    params = [normalizedMonth, ...baseParams];
  } else {
    sql = `
      SELECT
        r.id AS renewal_id,
        l.id AS lead_id,
        p.deal_id,
        p.deal_product_id,
        p.service_name,
        p.service_amount,
        r.renewal_basis,
        r.status,
        DATE_FORMAT(r.first_start_date, '%Y-%m-%d') AS first_start_date,
        DATE_FORMAT(r.current_start_date, '%Y-%m-%d') AS current_start_date,
        DATE_FORMAT(r.next_start_date, '%Y-%m-%d') AS next_start_date,
        DATE_FORMAT(
          CASE
            WHEN r.id IS NULL THEN NULL
            WHEN r.current_start_date >= CURDATE() THEN r.current_start_date
            ELSE r.next_start_date
          END,
          '%Y-%m-%d'
        ) AS renewal_due_date,
        DATEDIFF(
          CASE
            WHEN r.id IS NULL THEN NULL
            WHEN r.current_start_date >= CURDATE() THEN r.current_start_date
            ELSE r.next_start_date
          END,
          CURDATE()
        ) AS days_left,
        l.company_name,
        l.client_name,
        l.contact,
        l.alternate_contact,
        l.telephone,
        l.email,
        NULLIF(TRIM(l.email), '') AS client_email,
        CASE
          WHEN NULLIF(TRIM(l.email), '') IS NOT NULL
            AND EXISTS (
              SELECT 1
              FROM users email_guard
              WHERE LOWER(TRIM(COALESCE(email_guard.email, ''))) = LOWER(TRIM(l.email))
              LIMIT 1
            )
          THEN 1
          ELSE 0
        END AS client_email_is_internal,
        l.deal_amount,
        DATE_FORMAT(l.closed_date, '%Y-%m-%d') AS closed_date,
        COALESCE(assigned_user.name, l.assign_emp, closer_user.name, creator_user.name) AS owner_name,
        assigned_user.email AS assigned_user_email,
        closer_user.email AS closer_user_email,
        creator_user.email AS creator_user_email,
        ${companyScopeSql} AS company_scope
      FROM leads l
      INNER JOIN (${serviceProductsSql}) p ON p.lead_id = l.id
      LEFT JOIN deal_service_renewals r
        ON r.lead_id = l.id AND r.service_name = p.service_name
      LEFT JOIN users assigned_user ON assigned_user.id = l.assign_emp_id
      LEFT JOIN users creator_user ON creator_user.id = l.created_by
      LEFT JOIN users closer_user ON closer_user.id = l.closed_by
      WHERE l.lead_status = 'deal_closed'
        AND l.closed_date IS NOT NULL
        ${scope.sql}
      ORDER BY l.closed_date DESC, l.id DESC, p.service_name ASC
    `;
    params = baseParams;
  }

  const [rows] = await dbPromise.query(sql, params);
  const data = rows
    .map(normalizeServiceRenewalRow)
    .filter((row) => !isNonRenewableService(row.service_name))
    .filter((row) =>
      requestedCompanyScope ? row.company_scope === requestedCompanyScope : true,
    )
    .filter((row) => {
      if (normalizedStatus === "active") return row.status === "active" && row.is_configured;
      if (normalizedStatus === "stopped") return row.status === "stopped";
      if (normalizedStatus === "unconfigured") return !row.is_configured;
      if (normalizedStatus === "due_soon") {
        return (
          row.status === "active" &&
          row.is_configured &&
          Number(row.days_left) >= 0 &&
          Number(row.days_left) <= 2
        );
      }
      return true;
    });

  return {
    success: true,
    data,
    summary: buildServiceRenewalSummary(data),
  };
}

app.get("/api/service-renewals", async (req, res) => {
  try {
    const payload = await buildDealServiceRenewalsPayload({
      role: req.query.role,
      userId: req.query.userId,
      userName: req.query.userName,
      month: req.query.month,
      status: req.query.status,
      companyScope:
        req.query.companyScope || req.query.company_scope || req.query.company,
    });

    res.json(payload);
  } catch (err) {
    console.error("Service Renewals Fetch Error:", err);
    res.status(500).json({
      success: false,
      message: err.message || "Failed to load service renewals",
      data: [],
      summary: buildServiceRenewalSummary([]),
    });
  }
});


app.post("/api/service-renewals", async (req, res) => {
  const leadId = Number(req.body.leadId || req.body.lead_id || 0);
  const serviceName = String(
    req.body.serviceName || req.body.service_name || "",
  ).trim();
  const startDate = getServerDateKey(
    req.body.startDate || req.body.start_date,
  );
  const actorId = Number(req.body.userId || req.body.actorId || 0) || null;

  if (!leadId || !serviceName || !startDate) {
    return res.status(400).json({
      success: false,
      message: "Lead, service and renewal start date are required",
    });
  }

  if (isNonRenewableService(serviceName)) {
    return res.status(400).json({
      success: false,
      message: "Profile Creation does not need renewal",
    });
  }

  try {
    await ensureDealServiceRenewalTables();
    const basis = normalizeServiceRenewalBasis(
      req.body.basis || req.body.renewalBasis || req.body.renewal_basis,
      serviceName,
    );
    const nextStartDate = addServerMonths(
      startDate,
      getServiceRenewalBasisMonths(basis),
    );
    const [serviceRows] = await dbPromise.query(
      `
        SELECT
          l.id AS lead_id,
          d.id AS deal_id,
          dp.id AS deal_product_id,
          dp.product_name AS service_name
        FROM leads l
        INNER JOIN deals d ON d.lead_id = l.id
        INNER JOIN deal_products dp ON dp.deal_id = d.id
        WHERE l.id = ?
          AND l.lead_status = 'deal_closed'
          AND dp.product_name = ?
        ORDER BY d.id DESC, dp.id DESC
        LIMIT 1
      `,
      [leadId, serviceName],
    );

    if (!serviceRows.length) {
      return res.status(404).json({
        success: false,
        message: "Closed deal service not found",
      });
    }

    const service = serviceRows[0];
    const [result] = await dbPromise.query(
      `
        INSERT INTO deal_service_renewals (
          lead_id,
          deal_id,
          deal_product_id,
          service_name,
          renewal_basis,
          first_start_date,
          current_start_date,
          next_start_date,
          status,
          created_by,
          updated_by,
          stopped_by,
          stopped_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, NULL, NULL)
        ON DUPLICATE KEY UPDATE
          id = LAST_INSERT_ID(id),
          deal_id = VALUES(deal_id),
          deal_product_id = VALUES(deal_product_id),
          renewal_basis = VALUES(renewal_basis),
          first_start_date = VALUES(first_start_date),
          current_start_date = VALUES(current_start_date),
          next_start_date = VALUES(next_start_date),
          status = 'active',
          updated_by = VALUES(updated_by),
          stopped_by = NULL,
          stopped_at = NULL
      `,
      [
        leadId,
        service.deal_id || null,
        service.deal_product_id || null,
        serviceName,
        basis,
        startDate,
        startDate,
        nextStartDate,
        actorId,
        actorId,
      ],
    );

    const renewalId = Number(result.insertId || 0);
    await insertServiceRenewalHistory({
      renewalId,
      leadId,
      serviceName,
      basis,
      startDate,
      reason: "manual_start",
    });
    await syncDueServiceRenewals();

    res.json({
      success: true,
      message: "Renewal schedule saved",
      id: renewalId,
    });
  } catch (err) {
    console.error("Service Renewal Save Error:", err);
    res.status(500).json({
      success: false,
      message: err.message || "Failed to save renewal schedule",
    });
  }
});


app.patch("/api/service-renewals/:id/stop", async (req, res) => {
  const renewalId = Number(req.params.id || 0);
  const actorId = Number(req.body.userId || req.body.actorId || 0) || null;

  if (!renewalId) {
    return res.status(400).json({
      success: false,
      message: "Invalid renewal id",
    });
  }

  try {
    await ensureDealServiceRenewalTables();
    const [result] = await dbPromise.query(
      `
        UPDATE deal_service_renewals
        SET status = 'stopped',
            stopped_by = ?,
            stopped_at = NOW(),
            updated_by = ?
        WHERE id = ?
      `,
      [actorId, actorId, renewalId],
    );

    if (!result.affectedRows) {
      return res.status(404).json({
        success: false,
        message: "Renewal schedule not found",
      });
    }

    res.json({
      success: true,
      message: "Renewal stopped",
    });
  } catch (err) {
    console.error("Service Renewal Stop Error:", err);
    res.status(500).json({
      success: false,
      message: err.message || "Failed to stop renewal",
    });
  }
});





app.get("/api/admin/renewals", async (req, res) => {
  const adminId = Number(req.query.adminId || req.query.userId || 0);

  try {
    if (adminId) {
      await ensureAdminAccess(adminId);
    }

    const payload = await buildDealServiceRenewalsPayload({
      role: "admin",
      userId: adminId,
      userName: req.query.userName,
      month: req.query.month,
      status: req.query.status,
      companyScope:
        req.query.companyScope || req.query.company_scope || req.query.company,
    });

    res.json(payload);
  } catch (err) {
    console.error("Admin Renewals Error:", err);
    res.status(err.statusCode || 500).json({
      success: false,
      message: err.message || "Failed to load renewal details",
      data: [],
      summary: buildServiceRenewalSummary([]),
    });
  }
});

app.get("/api/sales-target-summary", async (req, res) => {
  try {
    const summary = await getSalesTargetSummaryData({
      role: req.query.role,
      userId: req.query.userId,
      monthKey: req.query.month,
    });

    res.json({
      success: true,
      data: summary,
    });
  } catch (err) {
    console.error("Sales Target Summary Error:", err);
    res.status(err.statusCode || 500).json({
      success: false,
      message: err.message || "Failed to load sales target summary",
    });
  }
});

app.get("/api/sales-target-history", async (req, res) => {
  try {
    const monthCount = Math.min(Math.max(Number(req.query.months || 6), 1), 12);
    const anchorMonth = normalizePayrollMonthKey(req.query.month);
    const [anchorYear, anchorMonthNumber] = anchorMonth.split("-").map(Number);
    const monthKeys = [];

    for (let offset = monthCount - 1; offset >= 0; offset -= 1) {
      const monthDate = new Date(
        Date.UTC(anchorYear, anchorMonthNumber - 1 - offset, 1),
      );
      monthKeys.push(getCurrentPayrollMonthKey(monthDate));
    }

    const data = [];
    for (const monthKey of monthKeys) {
      data.push(
        await getSalesTargetSummaryData({
          role: req.query.role,
          userId: req.query.userId,
          monthKey,
        }),
      );
    }

    res.json({
      success: true,
      data,
    });
  } catch (err) {
    console.error("Sales Target History Error:", err);
    res.status(err.statusCode || 500).json({
      success: false,
      message: err.message || "Failed to load sales target history",
      data: [],
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
      roleSummary: payload.roleSummary,
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
  const sql = `SELECT id, name, contact FROM users WHERE role = 'me' ORDER BY name`;

  db.query(sql, (err, result) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ success: false });
    }
    res.json({ success: true, data: result });
  });
});

// ====================== GET AVAILABLE EMPLOYEES ======================
app.get("/api/available-employees", async (req, res) => {
  const { date, time } = req.query;

  if (!date || !time) {
    return res.status(400).json({
      success: false,
      message: "Date and time required",
    });
  }

  const sql = `
      SELECT u.id, u.name, u.contact
      FROM users u
      WHERE u.role = 'me'
      AND ${getActiveUserEmploymentStatusSql("u")}
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

  try {
    await ensureUserEmploymentStatusColumns();
  } catch (err) {
    console.error("Available Employees Schema Error:", err);
    return res.status(500).json({
      success: false,
      message: "Server error while fetching employees",
    });
  }

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
function getIndiaDateTimeParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Calcutta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  })
    .formatToParts(date)
    .reduce((acc, part) => {
      if (part.type !== "literal") acc[part.type] = part.value;
      return acc;
    }, {});

  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    time: `${parts.hour}:${parts.minute}:${parts.second}`,
  };
}

function shiftAttendanceDateKey(dateKey, dayOffset) {
  const match = String(dateKey || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return getIndiaDateTimeParts(new Date()).date;

  const date = new Date(
    Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])),
  );
  date.setUTCDate(date.getUTCDate() + Number(dayOffset || 0));
  return date.toISOString().slice(0, 10);
}

function getAttendanceMonthEndDateKey(monthKey) {
  const match = String(monthKey || "").match(/^(\d{4})-(\d{2})$/);
  if (!match) return getIndiaDateTimeParts(new Date()).date;

  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]), 0));
  return date.toISOString().slice(0, 10);
}

function normalizeAttendanceDateInput(
  value,
  fallback = getIndiaDateTimeParts(new Date()).date,
) {
  const normalized = String(value || "")
    .trim()
    .slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(normalized) ? normalized : fallback;
}

function normalizeAttendanceMonthInput(
  value,
  fallbackDate = getIndiaDateTimeParts(new Date()).date,
) {
  const normalized = String(value || "").trim();
  if (/^\d{4}-\d{2}$/.test(normalized)) return normalized;

  const fallback = normalizeAttendanceDateInput(fallbackDate);
  return fallback.slice(0, 7);
}

function getAttendanceCompanyScopeSql(userAlias = "u") {
  const compactCompanySql = `LOWER(REPLACE(REPLACE(REPLACE(COALESCE(${userAlias}.comp_name, ''), ' ', ''), '.', ''), ',', ''))`;

  return `CASE
    WHEN ${compactCompanySql} LIKE '%redsea%' THEN 'redsea'
    WHEN ${compactCompanySql} LIKE '%metrics%' THEN 'metrics'
    ELSE 'metrics'
  END`;
}

app.get("/api/attendance/current-time", (req, res) => {
  const now = new Date();
  const currentTime = getIndiaDateTimeParts(now);

  res.json({
    success: true,
    today: currentTime.date,
    serverDate: currentTime.date,
    serverTime: currentTime.time,
    timezone: "Asia/Calcutta",
    offset: "+05:30",
    timestamp: now.toISOString(),
    currentTime: {
      ...currentTime,
      iso: now.toISOString(),
      timezone: "Asia/Calcutta",
    },
  });
});

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
      return res
        .status(400)
        .json({ success: false, message: "Invalid user id" });
    }

    const now = new Date();
    const currentTime = getIndiaDateTimeParts(now);
    const selectedMonth = String(req.query.month || "").trim();
    const hasMonthFilter = /^\d{4}-\d{2}$/.test(selectedMonth);
    const endDateKey = hasMonthFilter
      ? selectedMonth === currentTime.date.slice(0, 7)
        ? currentTime.date
        : getAttendanceMonthEndDateKey(selectedMonth)
      : currentTime.date;
    const startDateKey = clampAttendanceTrackingStart(
      hasMonthFilter
        ? `${selectedMonth}-01`
        : shiftAttendanceDateKey(currentTime.date, -30),
    );

    const sql = `
      SELECT
        a.id,
        a.user_id,
        u.name AS user_name,
        DATE_FORMAT(a.attendance_date, '%Y-%m-%d') AS attendance_date,
        DATE_FORMAT(${getAttendanceLocalDateTimeSql("a.check_in")}, '%H:%i:%s') AS check_in,
        DATE_FORMAT(${getAttendanceResolvedCheckoutSql("a")}, '%H:%i:%s') AS check_out,
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

    const [rows] = await dbPromise.query(sql, [
      userId,
      startDateKey,
      endDateKey,
    ]);
    res.json({
      success: true,
      data: rows,
      today: currentTime.date,
      serverDate: currentTime.date,
      serverTime: currentTime.time,
      currentTime: {
        ...currentTime,
        iso: now.toISOString(),
        timezone: "Asia/Calcutta",
      },
    });
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
  const userId = Number(req.body.userId);
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
      message:
        "Location is required for check-in. Please allow location permission.",
    });
  }

  try {
    const locationAccess = await validateAttendanceAccessLocation({
      userId,
      lat,
      lng,
      accuracyMeters,
    });
    await ensureAttendanceTable();
    await ensureUserShiftColumns();
    const shiftStartSql = getAttendanceShiftStartSql("u");
    const shiftEndSql = getAttendanceShiftEndSql("u");
    const graceEndSql = getAttendanceGraceEndSql("u");
    const halfDayCheckInAfterSql = getAttendanceHalfDayCheckInAfterSql("u");
    const requiredHoursSql = getAttendanceRequiredHoursSql("u");
    const currentLocalTimeSql = getAttendanceLocalTimeSql(
      getAttendanceNowSql(),
    );

    const [shiftRows] = await dbPromise.query(
      `
        SELECT
          TIME_FORMAT(${shiftStartSql}, '%H:%i') AS shift_start,
          TIME_FORMAT(${shiftEndSql}, '%H:%i') AS logout_time,
          TIME_FORMAT(${graceEndSql}, '%H:%i') AS late_after,
          ${requiredHoursSql} AS required_hours,
          ${currentLocalTimeSql} >= ${halfDayCheckInAfterSql} AS is_half_day_checkin,
          (
            ${currentLocalTimeSql} > ${graceEndSql}
            AND ${currentLocalTimeSql} < ${halfDayCheckInAfterSql}
          ) AS is_late,
          (
            ${currentLocalTimeSql} > ${shiftStartSql}
            AND ${currentLocalTimeSql} <= ${graceEndSql}
          ) AS is_grace
        FROM users u
        WHERE id = ?
      `,
      [userId],
    );

    if (shiftRows.length === 0) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid user id" });
    }

    const responseStatus = Number(shiftRows[0].is_half_day_checkin)
      ? "half_day"
      : Number(shiftRows[0].is_late)
        ? "late"
        : Number(shiftRows[0].is_grace)
          ? "grace"
          : "present";
    const attendanceStatus =
      responseStatus === "grace" ? "present" : responseStatus;

    const sql = `
  INSERT INTO attendance (
    user_id,
    attendance_date,
    check_in,
    check_in_lat,
    check_in_lng,
    check_in_location,
    status
  )
  VALUES (
    ?,
    CURDATE(),
    ${getAttendanceNowSql()},
    ?,
    ?,
    ?,
    ?
  )
  ON DUPLICATE KEY UPDATE
    status = IF(check_in IS NULL, VALUES(status), status),
    check_in = IF(
      check_in IS NULL,
      ${getAttendanceNowSql()},
      check_in
    ),
    check_in_lat = IF(
      check_in_lat IS NULL,
      VALUES(check_in_lat),
      check_in_lat
    ),
    check_in_lng = IF(
      check_in_lng IS NULL,
      VALUES(check_in_lng),
      check_in_lng
    ),
    check_in_location = IF(
      check_in_location IS NULL,
      VALUES(check_in_location),
      check_in_location
    )
`;

    await dbPromise.query(sql, [
      userId,
      lat,
      lng,
      locationUrl,
      attendanceStatus,
    ]);
    res.json({
      success: true,
      message:
        responseStatus === "half_day"
          ? locationAccess.zoneType === "approved_offsite"
            ? "Half day check-in saved from approved meeting location"
            : "Check-in saved as Half Day"
          : responseStatus === "late"
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
  const userId = Number(req.body.userId);
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
      message:
        "Location is required for check-out. Please allow location permission.",
    });
  }

  try {
    const locationAccess = await validateAttendanceAccessLocation({
      userId,
      lat,
      lng,
      accuracyMeters,
    });
    const checkoutResult = await finalizeAttendanceCheckout({
      userId,
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
      return res
        .status(400)
        .json({ success: false, message: "Invalid user id" });
    }

    let sql = `
      SELECT
        DATE_FORMAT(a.attendance_date, '%Y-%m-%d') AS date,
        DATE_FORMAT(${getAttendanceLocalDateTimeSql("a.check_in")}, '%H:%i:%s') AS in_time,
        DATE_FORMAT(${getAttendanceResolvedCheckoutSql("a")}, '%H:%i:%s') AS out_time,
        ${attendanceStatusLabelSql} AS status
      FROM attendance a
      LEFT JOIN users u ON u.id = a.user_id
      WHERE a.user_id = ?
    `;
    const params = [userId];
    const now = new Date();
    const currentParts = getIndiaDateTimeParts(now);
    const targetMonth =
      month && year ? month : Number(currentParts.date.slice(5, 7));
    const targetYear =
      month && year ? year : Number(currentParts.date.slice(0, 4));
    const targetMonthStartKey = `${targetYear}-${String(targetMonth).padStart(2, "0")}-01`;

    if (isBeforeAttendanceTrackingStart(targetMonthStartKey)) {
      return res.json({ success: true, data: [] });
    }

    let rangeStartDay = 1;
    let rangeEndDay = new Date(targetYear, targetMonth, 0).getDate();

    if (targetMonth && targetYear) {
      sql += ` AND MONTH(a.attendance_date) = ? AND YEAR(a.attendance_date) = ?`;
      params.push(targetMonth, targetYear);

      if (week && week !== "all") {
        const weekNum = Number.parseInt(week, 10);

        if (Number.isFinite(weekNum) && weekNum > 0) {
          const startDay = (weekNum - 1) * 7 + 1;
          const lastDay = new Date(targetYear, targetMonth, 0).getDate();
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
      return res
        .status(400)
        .json({ success: false, message: "Invalid user id" });
    }

    const currentTime = getIndiaDateTimeParts(new Date());
    const [rows] = await dbPromise.query(
      `
        SELECT
          a.check_in_lat AS latitude,
          a.check_in_lng AS longitude,
          a.check_in_location AS location_url,
          DATE_FORMAT(${getAttendanceLocalDateTimeSql("a.check_in")}, '%H:%i:%s') AS check_in,
          DATE_FORMAT(${getAttendanceResolvedCheckoutSql("a")}, '%H:%i:%s') AS check_out,
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
      [userId, currentTime.date],
    );

    if (!rows.length) {
      const shiftConfig = getAttendanceShiftConfigForRole(
        userRows[0].role,
        userRows[0].logout_time,
      );
      const derivedStatus = computeAttendanceDerivedStatus({
        attendanceDate: currentTime.date,
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
  const attendanceDate = getAttendanceDateKey(req.query.date || new Date());

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
    res.status(err.statusCode || 500).json({
      success: false,
      message: err.message || "Failed to fetch offsite attendance request",
    });
  }
});

app.post("/api/attendance/location-request", async (req, res) => {
  const userId = Number(req.body.userId);
  const lat = Number(req.body.lat);
  const lng = Number(req.body.lng);
  const accuracyMeters = Number(req.body.accuracy);
  const hasLocation = Number.isFinite(lat) && Number.isFinite(lng);
  const purpose = String(req.body.purpose || "").trim();
  const meetingWith = String(req.body.meetingWith || "").trim() || null;
  const notes = String(req.body.notes || "").trim() || null;
  const requestedAddress = String(
    req.body.locationLabel || req.body.requestedAddress || "",
  ).trim();
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
      message:
        "Current location is required to send the offsite attendance request.",
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
      return res
        .status(400)
        .json({ success: false, message: "Invalid user id" });
    }
    if (normalizeAttendanceRole(user.role) !== "me") {
      return res.status(403).json({
        success: false,
        message: "Offsite attendance requests are available only for ME users.",
      });
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
      await dbPromise.query(
        `
          INSERT INTO attendance_location_requests (
            user_id,
            attendance_date,
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
  const now = new Date();
  const todayKey = getIndiaDateTimeParts(now).date;
  const selectedDate = normalizeAttendanceDateInput(req.query.date, todayKey);
  const selectedMonth = normalizeAttendanceMonthInput(
    req.query.month,
    selectedDate,
  );
  const roleFilter = normalizeAttendanceRole(req.query.role);
  const statusFilter = String(req.query.status || "")
    .toLowerCase()
    .trim()
    .replace(/[\s-]+/g, "_");
  const employeeId = Number(req.query.employeeId || req.query.userId || 0);
  const companyScopeFilter = normalizeCompanyScopeKey(
    req.query.companyScope || req.query.company_scope || req.query.company,
  );
  const isEmployeeMonthMode = Boolean(
    employeeId && /^\d{4}-\d{2}$/.test(String(req.query.month || "")),
  );
  const currentMonth = todayKey.slice(0, 7);
  const rangeStartDate = isEmployeeMonthMode
    ? clampAttendanceTrackingStart(`${selectedMonth}-01`)
    : selectedDate;
  const monthEndDate =
    selectedMonth >= currentMonth
      ? todayKey
      : getAttendanceMonthEndDateKey(selectedMonth);
  const rangeEndDate = isEmployeeMonthMode ? monthEndDate : selectedDate;
  const summaryStartDate = isEmployeeMonthMode
    ? rangeStartDate
    : getAttendanceMonthStart(selectedDate);
  const summaryEndDate = isEmployeeMonthMode ? rangeEndDate : selectedDate;

  try {
    if (
      rangeEndDate < ATTENDANCE_TRACKING_START_DATE ||
      rangeStartDate > rangeEndDate
    ) {
      return res.json({
        success: true,
        data: [],
        mode: isEmployeeMonthMode ? "month" : "day",
        date: selectedDate,
        month: selectedMonth,
        summary: {
          ...createAttendanceSummaryCounts(),
          startDate: rangeStartDate,
          endDate: rangeEndDate,
          totalUsers: 0,
          totalDays: 0,
        },
      });
    }

    await ensureAttendanceTable();
    await ensureUserShiftColumns();
    await ensureUserEmploymentStatusColumns();
    const companyScopeSql = getAttendanceCompanyScopeSql("u");
    const userWhereParts = [
      "LOWER(TRIM(COALESCE(u.role, ''))) <> 'admin'",
      getActiveUserEmploymentStatusSql("u"),
    ];
    const userParams = [];

    if (roleFilter) {
      userWhereParts.push("LOWER(TRIM(COALESCE(u.role, ''))) = ?");
      userParams.push(roleFilter);
    }

    if (employeeId) {
      userWhereParts.push("u.id = ?");
      userParams.push(employeeId);
    }

    if (companyScopeFilter) {
      userWhereParts.push(`${companyScopeSql} = ?`);
      userParams.push(companyScopeFilter);
    }

    const [userRows] = await dbPromise.query(
      `
        SELECT
          u.id AS user_id,
          u.name AS user_name,
          u.role,
          u.comp_name,
          ${companyScopeSql} AS company_scope_key,
          ${companyScopeSql} AS company_scope,
          TIME_FORMAT(COALESCE(u.logout_time, '18:00:00'), '%H:%i:%s') AS logout_time
        FROM users u
        WHERE ${userWhereParts.join(" AND ")}
        ORDER BY u.name ASC
      `,
      userParams,
    );

    if (!userRows.length) {
      return res.json({
        success: true,
        data: [],
        mode: isEmployeeMonthMode ? "month" : "day",
        date: selectedDate,
        month: selectedMonth,
        summary: {
          ...createAttendanceSummaryCounts(),
          startDate: summaryStartDate,
          endDate: summaryEndDate,
          totalUsers: 0,
          totalDays: getAttendanceDateRange(summaryStartDate, summaryEndDate)
            .length,
        },
      });
    }

    const userIds = userRows.map((user) => Number(user.user_id));
    const [attendanceRows] = await dbPromise.query(
      `
        SELECT
          a.user_id,
          DATE_FORMAT(a.attendance_date, '%Y-%m-%d') AS attendance_date,
          DATE_FORMAT(${getAttendanceLocalDateTimeSql("a.check_in")}, '%H:%i:%s') AS check_in,
          DATE_FORMAT(a.check_out, '%H:%i:%s') AS check_out,
          a.check_in_lat,
          a.check_in_lng,
          a.check_in_location,
          a.admin_override_status
        FROM attendance a
        WHERE a.user_id IN (?)
          AND a.attendance_date BETWEEN ? AND ?
        ORDER BY a.attendance_date DESC, a.id DESC
      `,
      [userIds, summaryStartDate, summaryEndDate],
    );

    const attendanceMap = new Map();
    attendanceRows.forEach((row) => {
      const userKey = Number(row.user_id || 0);
      const dateKey = String(row.attendance_date || "");
      if (!userKey || !dateKey) return;

      if (!attendanceMap.has(userKey)) {
        attendanceMap.set(userKey, new Map());
      }

      attendanceMap.get(userKey).set(dateKey, row);
    });

    const buildAdminAttendanceRow = (user, attendanceDate) => {
      const record =
        attendanceMap.get(Number(user.user_id || 0))?.get(attendanceDate) || {};
      const shiftConfig = getAttendanceShiftConfigForRole(
        user.role,
        user.logout_time,
      );
      const status = computeAttendanceDerivedStatus({
        attendanceDate,
        checkIn: record.check_in,
        checkOut: record.check_out,
        overrideStatus: record.admin_override_status,
        role: user.role,
        logoutTime: user.logout_time,
        now,
      });
      const companyScope =
        normalizeCompanyScopeKey(
          user.company_scope_key || user.company_scope || user.comp_name,
        ) || "metrics";

      return {
        user_id: user.user_id,
        user_name: user.user_name,
        role: user.role,
        comp_name: user.comp_name,
        company_scope: companyScope,
        companyScope,
        company_scope_key: companyScope,
        attendance_date: attendanceDate,
        check_in: record.check_in || null,
        check_out: record.check_out || null,
        check_in_lat: record.check_in_lat || null,
        check_in_lng: record.check_in_lng || null,
        check_in_location: record.check_in_location || null,
        status,
        status_label: getAttendanceStatusLabel(status),
        working_hours: formatAttendanceWorkingHoursFromTimes(
          record.check_in,
          record.check_out,
        ),
        shift_start: shiftConfig.shiftStart.slice(0, 5),
        logout_time: shiftConfig.shiftEnd.slice(0, 5),
        late_after: shiftConfig.graceEnd.slice(0, 5),
        required_hours: shiftConfig.requiredHours,
        has_record: Boolean(record.attendance_date),
        has_pending_checkout: status === "checkout_pending",
        has_override: Boolean(record.admin_override_status),
      };
    };

    const formattedRows = isEmployeeMonthMode
      ? getAttendanceDateRange(rangeStartDate, rangeEndDate)
          .reverse()
          .flatMap((attendanceDate) =>
            userRows.map((user) =>
              buildAdminAttendanceRow(user, attendanceDate),
            ),
          )
      : userRows.map((user) => buildAdminAttendanceRow(user, selectedDate));

    const filteredRows = formattedRows.filter(
      (row) => !statusFilter || row.status === statusFilter,
    );

    const monthSummary = buildAttendanceMonthlySummary({
      users: userRows,
      attendanceRows,
      startDate: summaryStartDate,
      endDate: summaryEndDate,
      now,
    });

    res.json({
      success: true,
      data: filteredRows,
      summary: monthSummary,
      mode: isEmployeeMonthMode ? "month" : "day",
      date: selectedDate,
      month: selectedMonth,
      startDate: rangeStartDate,
      endDate: rangeEndDate,
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
  const employeeId = Number(req.query.employeeId || req.query.userId || 0);
  const companyScopeFilter = normalizeCompanyScopeKey(
    req.query.companyScope || req.query.company_scope || req.query.company,
  );
  const rawStatusFilter = String(req.query.status || "")
    .trim()
    .toLowerCase();
  const statusFilter = [
    "pending",
    "approved",
    "rejected",
    "cancelled",
  ].includes(rawStatusFilter)
    ? rawStatusFilter
    : "";

  if (!adminId) {
    return res
      .status(400)
      .json({ success: false, message: "Invalid admin id" });
  }

  try {
    await ensureAdminAccess(adminId);
    await ensureAttendanceLocationRequestsTable();
    await ensureUserEmploymentStatusColumns();

    const companyScopeSql = getAttendanceCompanyScopeSql("u");
    const filters = [
      "r.attendance_date = ?",
      "LOWER(TRIM(COALESCE(u.role, ''))) <> 'admin'",
      getActiveUserEmploymentStatusSql("u"),
    ];
    const params = [attendanceDate];

    if (roleFilter) {
      filters.push("LOWER(TRIM(COALESCE(u.role, ''))) = ?");
      params.push(roleFilter);
    }

    if (employeeId) {
      filters.push("r.user_id = ?");
      params.push(employeeId);
    }

    if (companyScopeFilter) {
      filters.push(`${companyScopeSql} = ?`);
      params.push(companyScopeFilter);
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
          u.role,
          u.comp_name,
          ${companyScopeSql} AS company_scope_key
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
      comp_name: row.comp_name,
      company_scope:
        normalizeCompanyScopeKey(row.company_scope_key || row.comp_name) ||
        "metrics",
      companyScope:
        normalizeCompanyScopeKey(row.company_scope_key || row.comp_name) ||
        "metrics",
      company_scope_key:
        normalizeCompanyScopeKey(row.company_scope_key || row.comp_name) ||
        "metrics",
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

  if (
    !requestId ||
    !adminId ||
    !["approved", "rejected"].includes(requestedStatus)
  ) {
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
          requester.comp_name AS requester_comp_name,
          ${getAttendanceCompanyScopeSql("requester")} AS requester_company_scope
        FROM attendance_location_requests r
        INNER JOIN users requester ON requester.id = r.user_id
        WHERE r.id = ?
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
    const adminCompanyScope =
      normalizeCompanyScopeKey(adminUser.comp_name) || "metrics";
    const requestCompanyScope =
      normalizeCompanyScopeKey(
        rows[0].requester_company_scope || rows[0].requester_comp_name,
      ) || "metrics";

    if (adminCompanyScope !== requestCompanyScope) {
      return res.status(403).json({
        success: false,
        message:
          "You can only review offsite attendance requests for your own company.",
      });
    }

    await dbPromise.query(
      `
        UPDATE attendance_location_requests
        SET
          status = ?,
          admin_remark = ?,
          reviewed_by = ?,
          reviewed_by_name = ?,
          reviewed_at = NOW(),
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
        requestedStatus === "approved" ? requestRow.requestedLat : null,
        requestedStatus === "approved" ? requestRow.requestedLng : null,
        requestedStatus === "approved" ? requestRow.requestedLocationUrl : null,
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
  const requestedCheckOutTime = String(req.body.checkOutTime || "").trim();

  if (!userId || !attendanceDate) {
    return res
      .status(400)
      .json({ success: false, message: "Invalid attendance update request" });
  }

  const parsedCheckOutTime = parseAttendanceTimeInput(requestedCheckOutTime);
  if (requestedCheckOutTime && parsedCheckOutTime === null) {
    return res
      .status(400)
      .json({ success: false, message: "Invalid check-out time" });
  }

  try {
    await ensureAttendanceTable();
    await ensureUserShiftColumns();

    const [attendanceRows] = await dbPromise.query(
      `
        SELECT DATE_FORMAT(${getAttendanceLocalDateTimeSql("check_in")}, '%H:%i:%s') AS check_in_time
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

    const nowTime =
      parsedCheckOutTime || getIndiaDateTimeParts(new Date()).time;
    const checkInTime = attendanceRows[0].check_in_time || nowTime;
    const resolvedTime = nowTime < checkInTime ? checkInTime : nowTime;
    const resolvedCheckout = formatAttendanceLocalDateTimeForSql(
      attendanceDate,
      resolvedTime,
    );

    const [result] = await dbPromise.query(
      `
        UPDATE attendance
        SET
          check_out = ?,
          admin_override_status = NULL,
          admin_override_at = NOW(),
          admin_override_by = ?
        WHERE user_id = ? AND attendance_date = ? AND check_in IS NOT NULL
      `,
      [resolvedCheckout, adminId || null, userId, attendanceDate],
    );

    res.json({
      success: true,
      message: requestedCheckOutTime
        ? "Checkout updated"
        : "Checkout resolved using current admin time",
    });
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

  const requestedCheckInTime = String(
    req.body.checkInTime || "",
  ).trim();

  const requestedCheckOutTime = String(
    req.body.checkOutTime || "",
  ).trim();

  const allowedStatuses = new Set([
    "present",
    "grace",
    "late",
    "half_day",
    "half_day_late",
    "absent",
    "checkout_pending",
    "auto",
  ]);

  if (
    !userId ||
    !attendanceDate ||
    !allowedStatuses.has(requestedStatus)
  ) {
    return res.status(400).json({
      success: false,
      message: "Invalid attendance override request",
    });
  }

  const parsedCheckInTime = parseAttendanceTimeInput(
    requestedCheckInTime,
  );

  if (requestedCheckInTime && parsedCheckInTime === null) {
    return res.status(400).json({
      success: false,
      message: "Invalid check-in time",
    });
  }

  const parsedCheckOutTime = parseAttendanceTimeInput(
    requestedCheckOutTime,
  );

  if (requestedCheckOutTime && parsedCheckOutTime === null) {
    return res.status(400).json({
      success: false,
      message: "Invalid check-out time",
    });
  }

  try {
    await ensureAttendanceTable();
    await ensureUserShiftColumns();

    const overrideValue =
      requestedStatus === "auto" ? null : requestedStatus;

    const adminCheckIn = parsedCheckInTime
      ? formatAttendanceLocalDateTimeForSql(
          attendanceDate,
          parsedCheckInTime,
        )
      : null;

    const adminCheckOut = parsedCheckOutTime
      ? formatAttendanceLocalDateTimeForSql(
          attendanceDate,
          parsedCheckOutTime,
        )
      : null;

    /*
     * User ki scheduled shift timings.
     * Is block ko attendance SELECT/INSERT se pehle rehna chahiye.
     */
    const [shiftRows] = await dbPromise.query(
      `
        SELECT
          TIME_FORMAT(
            login_time,
            '%H:%i:%s'
          ) AS scheduled_login_time,

          TIME_FORMAT(
            logout_time,
            '%H:%i:%s'
          ) AS scheduled_logout_time
        FROM users
        WHERE id = ?
        LIMIT 1
      `,
      [userId],
    );

    if (!shiftRows.length) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const scheduledLoginTime =
      shiftRows[0]?.scheduled_login_time || null;

    const scheduledLogoutTime =
      shiftRows[0]?.scheduled_logout_time || null;

    const [attendanceRows] = await dbPromise.query(
      `
        SELECT
          DATE_FORMAT(
            check_in,
            '%H:%i:%s'
          ) AS check_in_time,

          check_out,

          TIME_FORMAT(
            check_out,
            '%H:%i:%s'
          ) AS check_out_time

        FROM attendance
        WHERE user_id = ?
          AND attendance_date = ?
        LIMIT 1
      `,
      [userId, attendanceDate],
    );

    /*
     * Attendance row exist nahi karti to new row insert karo.
     */
    if (!attendanceRows.length) {
      if (adminCheckOut && !adminCheckIn) {
        return res.status(400).json({
          success: false,
          message:
            "Enter check-in time before saving check-out time",
        });
      }

      if (!adminCheckIn && !overrideValue) {
        return res.json({
          success: true,
          message: "Attendance override cleared",
        });
      }

      const initialStatus = overrideValue || "present";

      const [insertResult] = await dbPromise.query(
        `
          INSERT INTO attendance (
            user_id,
            attendance_date,
            check_in,
            check_out,
            scheduled_login_time,
            scheduled_logout_time,
            total_worked_minutes,
            status,
            admin_override_status,
            admin_override_at,
            admin_override_by
          )
          VALUES (
            ?,
            ?,
            ?,
            ?,
            ?,
            ?,
            CASE
              WHEN ? IS NOT NULL
               AND ? IS NOT NULL
              THEN GREATEST(
                0,
                TIMESTAMPDIFF(
                  MINUTE,
                  ?,
                  ?
                )
              )
              ELSE NULL
            END,
            ?,
            ?,
            NOW(),
            ?
          )
        `,
        [
          userId,
          attendanceDate,
          adminCheckIn,
          adminCheckOut,
          scheduledLoginTime,
          scheduledLogoutTime,

          adminCheckIn,
          adminCheckOut,
          adminCheckIn,
          adminCheckOut,

          initialStatus,
          overrideValue,
          adminId || null,
        ],
      );

      if (!insertResult.affectedRows) {
        return res.status(500).json({
          success: false,
          message: "Attendance record was not created",
        });
      }

      return res.json({
        success: true,
        message:
          adminCheckIn || adminCheckOut
            ? "Attendance time updated"
            : "Attendance status updated",
      });
    }

    /*
     * Existing attendance row update.
     */
    const effectiveCheckInTime =
      parsedCheckInTime ||
      attendanceRows[0].check_in_time ||
      "";

    if (adminCheckOut && !effectiveCheckInTime) {
      return res.status(400).json({
        success: false,
        message:
          "Enter check-in time before saving check-out time",
      });
    }

    const needsResolvedCheckout =
      Boolean(effectiveCheckInTime) &&
      (!attendanceRows[0].check_out ||
        attendanceRows[0].check_out_time === "00:00:00") &&
      [
        "present",
        "grace",
        "late",
        "half_day",
        "half_day_late",
      ].includes(overrideValue || "");

    const currentTime =
      getIndiaDateTimeParts(new Date()).time;

    const resolvedTime =
      currentTime < (effectiveCheckInTime || currentTime)
        ? effectiveCheckInTime
        : currentTime;

    const autoResolvedCheckout = needsResolvedCheckout
      ? formatAttendanceLocalDateTimeForSql(
          attendanceDate,
          resolvedTime,
        )
      : null;

    const overrideCheckout =
      adminCheckOut || autoResolvedCheckout;

    const [result] = await dbPromise.query(
      `
        UPDATE attendance
        SET
          check_in = COALESCE(?, check_in),

          check_out = COALESCE(?, check_out),

          scheduled_login_time = COALESCE(
            scheduled_login_time,
            ?
          ),

          scheduled_logout_time = COALESCE(
            scheduled_logout_time,
            ?
          ),

          total_worked_minutes = CASE
            WHEN COALESCE(?, check_in) IS NOT NULL
             AND COALESCE(?, check_out) IS NOT NULL
            THEN GREATEST(
              0,
              TIMESTAMPDIFF(
                MINUTE,
                COALESCE(?, check_in),
                COALESCE(?, check_out)
              )
            )
            ELSE NULL
          END,

          admin_override_status = ?,
          admin_override_at = NOW(),
          admin_override_by = ?

        WHERE user_id = ?
          AND attendance_date = ?
      `,
      [
        adminCheckIn,
        overrideCheckout,

        scheduledLoginTime,
        scheduledLogoutTime,

        adminCheckIn,
        overrideCheckout,
        adminCheckIn,
        overrideCheckout,

        overrideValue,
        adminId || null,
        userId,
        attendanceDate,
      ],
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: "Attendance record not found",
      });
    }

    return res.json({
      success: true,
      message:
        adminCheckIn || adminCheckOut
          ? "Attendance time updated"
          : overrideValue
            ? "Attendance status updated"
            : "Attendance override cleared",
    });
  } catch (err) {
    console.error("Admin Attendance Override Error:", err);

    return res.status(500).json({
      success: false,
      message: "Failed to update attendance override",
      error: err.sqlMessage || err.message,
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
        requestedStatus === "pending" ? null : adminUser.name || "Admin",
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

app.post("/api/leaves/apply", async (req, res) => {
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
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, 'pending', ?, ?, ?, ?, ?, ?, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL)
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

    const balanceSnapshot = user ? await buildLeaveBalanceSnapshot(user) : null;

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
  const employeeName = String(req.query.employeeName || "")
    .trim()
    .toLowerCase();
  const companyScopeFilter = normalizeCompanyScopeKey(
    req.query.companyScope || req.query.company_scope || req.query.company,
  );

  if (!adminId) {
    return res.status(400).json({
      success: false,
      message: "Admin access is required",
    });
  }

  try {
    await ensureAdminAccess(adminId);
    await ensureLeaveRequestsTable();

    const employeeCompanyScopeSql = getUserCompanyScopeSql("u");
    const whereClauses = [];
    const params = [];
    const summaryWhereClauses = [];
    const summaryParams = [];

    if (companyScopeFilter) {
      whereClauses.push(`${employeeCompanyScopeSql} = ?`);
      params.push(companyScopeFilter);
      summaryWhereClauses.push(`${employeeCompanyScopeSql} = ?`);
      summaryParams.push(companyScopeFilter);
    }

    if (roleFilter) {
      whereClauses.push("LOWER(TRIM(lr.role)) = ?");
      params.push(roleFilter);
    }

    if (statusFilter) {
      whereClauses.push("lr.status = ?");
      params.push(statusFilter);
    }

    if (selectedDate) {
      whereClauses.push("? BETWEEN lr.from_date AND lr.to_date");
      params.push(selectedDate);
    }

    if (employeeName) {
      whereClauses.push("LOWER(lr.employee_name) LIKE ?");
      params.push(`%${employeeName}%`);
    }

    const whereSql = whereClauses.length
      ? `WHERE ${whereClauses.join(" AND ")}`
      : "";
    const summaryWhereSql = summaryWhereClauses.length
      ? `WHERE ${summaryWhereClauses.join(" AND ")}`
      : "";
    const [rows] = await dbPromise.query(
      `
        SELECT
          lr.id,
          lr.user_id,
          lr.employee_name,
          lr.role,
          lr.leave_type,
          lr.from_date,
          lr.to_date,
          lr.total_days,
          lr.reason,
          lr.attachment,
          lr.status,
          lr.approval_route,
          lr.approval_stage,
          lr.leader_user_id,
          lr.leader_name,
          lr.leader_email,
          lr.leader_status,
          lr.leader_remark,
          lr.leader_reviewed_by,
          lr.leader_reviewer_name,
          lr.leader_reviewed_at,
          lr.admin_remark,
          lr.admin_reviewed_by,
          lr.admin_reviewer_name,
          lr.admin_reviewed_at,
          lr.created_at,
          lr.updated_at,
          u.comp_name,
          ${employeeCompanyScopeSql} AS company_scope_key
        FROM leave_requests lr
        INNER JOIN users u ON u.id = lr.user_id
        ${whereSql}
        ORDER BY
          FIELD(lr.status, 'pending', 'approved', 'rejected'),
          lr.from_date DESC,
          lr.created_at DESC
      `,
      params,
    );

    const [[summaryRow]] = await dbPromise.query(
      `
        SELECT
          COUNT(*) AS totalRequests,
          SUM(CASE WHEN lr.status = 'pending' THEN 1 ELSE 0 END) AS pendingRequests,
          SUM(CASE WHEN lr.status = 'approved' THEN 1 ELSE 0 END) AS approvedLeaves,
          SUM(CASE WHEN lr.status = 'rejected' THEN 1 ELSE 0 END) AS rejectedLeaves,
          COUNT(DISTINCT CASE
            WHEN lr.status = 'approved' AND CURDATE() BETWEEN lr.from_date AND lr.to_date
            THEN lr.user_id
            ELSE NULL
          END) AS employeesOnLeaveToday
        FROM leave_requests lr
        INNER JOIN users u ON u.id = lr.user_id
        ${summaryWhereSql}
      `,
      summaryParams,
    );

    const balanceUsers = await getLeaveBalanceUsersForAdmin(companyScopeFilter);
    const serializedBalances = await Promise.all(
      balanceUsers.map(async (user) =>
        serializeLeaveBalanceSnapshot(await buildLeaveBalanceSnapshot(user)),
      ),
    );
    const balanceMap = new Map(
      serializedBalances.map((balanceRow) => [
        Number(balanceRow?.userId || 0),
        balanceRow,
      ]),
    );
    const leaveRows = rows.map((row) => {
      const serializedRow = serializeLeaveRequestRow(row);
      const userBalance = balanceMap.get(Number(row.user_id || 0)) || null;

      return {
        ...serializedRow,
        company_scope:
          normalizeCompanyScopeKey(row.company_scope_key || row.comp_name) ||
          companyScopeFilter ||
          "metrics",
        companyScope:
          normalizeCompanyScopeKey(row.company_scope_key || row.comp_name) ||
          companyScopeFilter ||
          "metrics",
        leave_balance: Number(userBalance?.availableBalance || 0),
        leave_carry_forward: Number(userBalance?.carryForwardBalance || 0),
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
  const employeeName = String(req.query.employeeName || "")
    .trim()
    .toLowerCase();

  if (!requesterId) {
    return res.status(400).json({
      success: false,
      message: "HR access is required",
    });
  }

  try {
    const requester = await ensureAdminOrHrAccess(requesterId);
    await ensureLeaveRequestsTable();

    const requesterCompanyScope =
      normalizeCompanyScopeKey(requester.comp_name) ||
      normalizeCompanyScopeKey(
        req.query.companyScope || req.query.company_scope || req.query.company,
      ) ||
      "metrics";
    const employeeCompanyScopeSql = getUserCompanyScopeSql("u");
    const whereClauses = [`${employeeCompanyScopeSql} = ?`];
    const params = [requesterCompanyScope];

    if (roleFilter) {
      whereClauses.push("LOWER(TRIM(lr.role)) = ?");
      params.push(roleFilter);
    }

    if (statusFilter) {
      whereClauses.push("lr.status = ?");
      params.push(statusFilter);
    }

    if (selectedDate) {
      whereClauses.push("? BETWEEN lr.from_date AND lr.to_date");
      params.push(selectedDate);
    }

    if (employeeName) {
      whereClauses.push("LOWER(lr.employee_name) LIKE ?");
      params.push(`%${employeeName}%`);
    }

    const whereSql = `WHERE ${whereClauses.join(" AND ")}`;
    const [rows] = await dbPromise.query(
      `
        SELECT
          lr.id,
          lr.user_id,
          lr.employee_name,
          lr.role,
          lr.leave_type,
          lr.from_date,
          lr.to_date,
          lr.total_days,
          lr.reason,
          lr.attachment,
          lr.status,
          lr.approval_route,
          lr.approval_stage,
          lr.leader_user_id,
          lr.leader_name,
          lr.leader_email,
          lr.leader_status,
          lr.leader_remark,
          lr.leader_reviewed_by,
          lr.leader_reviewer_name,
          lr.leader_reviewed_at,
          lr.admin_remark,
          lr.admin_reviewed_by,
          lr.admin_reviewer_name,
          lr.admin_reviewed_at,
          lr.created_at,
          lr.updated_at,
          u.comp_name,
          ${employeeCompanyScopeSql} AS company_scope_key
        FROM leave_requests lr
        INNER JOIN users u ON u.id = lr.user_id
        ${whereSql}
        ORDER BY
          FIELD(lr.status, 'pending', 'approved', 'rejected'),
          lr.from_date DESC,
          lr.created_at DESC
      `,
      params,
    );

    const [[summaryRow]] = await dbPromise.query(
      `
        SELECT
          COUNT(*) AS totalRequests,
          SUM(CASE WHEN lr.status = 'pending' THEN 1 ELSE 0 END) AS pendingRequests,
          SUM(CASE WHEN lr.status = 'approved' THEN 1 ELSE 0 END) AS approvedLeaves,
          SUM(CASE WHEN lr.status = 'rejected' THEN 1 ELSE 0 END) AS rejectedLeaves,
          COUNT(DISTINCT CASE
            WHEN lr.status = 'approved' AND CURDATE() BETWEEN lr.from_date AND lr.to_date
            THEN lr.user_id
            ELSE NULL
          END) AS employeesOnLeaveToday
        FROM leave_requests lr
        INNER JOIN users u ON u.id = lr.user_id
        WHERE ${employeeCompanyScopeSql} = ?
      `,
      [requesterCompanyScope],
    );

    const balanceUsers = await getLeaveBalanceUsersForAdmin(requesterCompanyScope);
    const serializedBalances = await Promise.all(
      balanceUsers.map(async (user) =>
        serializeLeaveBalanceSnapshot(await buildLeaveBalanceSnapshot(user)),
      ),
    );
    const balanceMap = new Map(
      serializedBalances.map((balanceRow) => [
        Number(balanceRow?.userId || 0),
        balanceRow,
      ]),
    );
    const leaveRows = rows.map((row) => {
      const serializedRow = serializeLeaveRequestRow(row);
      const userBalance = balanceMap.get(Number(row.user_id || 0)) || null;

      return {
        ...serializedRow,
        leave_balance: Number(userBalance?.availableBalance || 0),
        leave_carry_forward: Number(userBalance?.carryForwardBalance || 0),
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
  const employeeName = String(req.query.employeeName || "")
    .trim()
    .toLowerCase();

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

  if (
    !leaveId ||
    !leaderId ||
    !["approved", "rejected"].includes(requestedStatus)
  ) {
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
      message:
        requestedStatus === "approved"
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

    if (
      !isAdmin &&
      (!isOwner || normalizeLeaveStatus(leaveRequest.status) !== "pending")
    ) {
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

const PAYROLL_BASIC_PERCENT = 0.55;
const PAYROLL_HRA_PERCENT = 0.27;
const PAYROLL_ALLOWANCE_PERCENT = 0.18;
const PAYROLL_PROFESSIONAL_TAX = 200;

function getFixedPayrollOtherTax() {
  return PAYROLL_PROFESSIONAL_TAX;
}

function roundPayrollAmount(value) {
  return Number(normalizePayrollAmount(value).toFixed(2));
}

function formatPayrollCompactDays(value) {
  const days = normalizePayrollAmount(value);
  if (Number.isInteger(days)) return String(days);
  return days.toFixed(2).replace(/\.?0+$/, "");
}


function buildPayrollLeaveDeductionBreakdown(source = {}) {
  const dailySalary = normalizePayrollAmount(source.dailySalary);
  const unpaidLeaveDays = normalizePayrollAmount(source.unpaidLeaveDays);
  const halfDays = normalizePayrollAmount(source.halfDays);
  const halfDayLeaveDays = normalizePayrollAmount(
    source.halfDayLeaveDays,
    Number((halfDays / 2).toFixed(2)),
  );
  const lateMarks = Number(source.lateMarks || 0);
  const lateLeaveDays = normalizePayrollAmount(source.lateLeaveDays);
  const calculatedLeaveEquivalentDays = Number(
    (unpaidLeaveDays + halfDayLeaveDays + lateLeaveDays).toFixed(2),
  );
  const totalLeaveDays = normalizePayrollAmount(
    source.leaveEquivalentDays ?? source.totalLeaveDays,
    calculatedLeaveEquivalentDays,
  );
  const unpaidLeaveDeduction = roundPayrollAmount(
    unpaidLeaveDays * dailySalary,
  );
  const halfDayDeduction = roundPayrollAmount(halfDayLeaveDays * dailySalary);
  const lateMarkDeduction = roundPayrollAmount(lateLeaveDays * dailySalary);
  const calculatedLeaveDeduction = roundPayrollAmount(
    unpaidLeaveDeduction + halfDayDeduction + lateMarkDeduction,
  );
  const storedLeaveDeduction = normalizePayrollAmount(source.leaveDeduction);
  const totalLeaveDeduction =
    storedLeaveDeduction > 0 ? storedLeaveDeduction : calculatedLeaveDeduction;
  const leaveAdjustmentDeduction = roundPayrollAmount(
    totalLeaveDeduction - calculatedLeaveDeduction,
  );

  return {
    unpaidLeaveDays,
    unpaidLeaveDeduction,
    halfDays,
    halfDayLeaveDays,
    halfDayDeduction,
    lateMarks,
    lateLeaveDays,
    lateMarkDeduction,
    totalLeaveDays,
    totalLeaveDeduction,
    leaveAdjustmentDeduction:
      Math.abs(leaveAdjustmentDeduction) > 0.01
        ? leaveAdjustmentDeduction
        : 0,
  };
}

function splitPayrollGrossSalary(grossSalary) {
  const gross = normalizePayrollAmount(grossSalary);
  const basicSalary = Number((gross * PAYROLL_BASIC_PERCENT).toFixed(2));
  const hraAmount = Number((gross * PAYROLL_HRA_PERCENT).toFixed(2));
  const allowanceAmount = Number((gross - basicSalary - hraAmount).toFixed(2));

  return {
    grossSalary: gross,
    basicSalary,
    hraAmount,
    allowanceAmount,
  };
}

function resolveStoredPayrollSalaryBreakup(row = {}) {
  const storedGross = normalizePayrollAmount(
    row.gross_salary ?? row.grossSalary,
  );
  const storedBasic = normalizePayrollAmount(
    row.basic_salary ?? row.basicSalary,
  );
  const storedHra = normalizePayrollAmount(row.hra_amount ?? row.hraAmount);
  const storedAllowance = normalizePayrollAmount(
    row.allowance_amount ?? row.allowanceAmount,
  );
  const storedTotal = Number(
    (storedBasic + storedHra + storedAllowance).toFixed(2),
  );
  const grossSalary =
    storedGross > 0 ? storedGross : storedTotal > 0 ? storedTotal : storedBasic;
  const hasValidStoredSplit =
    grossSalary > 0 &&
    storedBasic > 0 &&
    (storedHra > 0 || storedAllowance > 0) &&
    Math.abs(storedTotal - grossSalary) <= 1;

  if (hasValidStoredSplit) {
    return {
      grossSalary,
      basicSalary: storedBasic,
      hraAmount: storedHra,
      allowanceAmount: storedAllowance,
    };
  }

  return splitPayrollGrossSalary(grossSalary);
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
    const dateKey = formatPayrollDateOnly(cursor);
    if (!isSundayDateKey(dateKey)) {
      keys.push(dateKey);
    }
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

function getPayrollDesignationLabel(role, department) {
  const roleLabel = getPayrollRoleLabel(role);
  const departmentLabel = String(department || "").trim().replace(/\s+/g, " ");
  const normalizePart = (value) =>
    String(value || "")
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "");

  if (!departmentLabel) return roleLabel;
  if (normalizePart(roleLabel) === normalizePart(departmentLabel)) {
    return roleLabel;
  }

  return [roleLabel, departmentLabel].filter(Boolean).join(" & ");
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

function formatPayrollMonthForPayslip(monthKey) {
  const match = String(monthKey || "").match(/^(\d{4})-(\d{2})$/);
  if (!match) return String(monthKey || "-");

  return new Date(Number(match[1]), Number(match[2]) - 1, 1)
    .toLocaleDateString("en-IN", {
      month: "short",
      year: "numeric",
    })
    .replace(" ", "-");
}

function titleCaseWords(value) {
  return String(value || "")
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}


let payrollSchemaReady = false;

async function ensurePayrollTables() {
  if (payrollSchemaReady) return;

  await ensurePayrollUserColumns();
  await ensureUserProfileSetupColumns();
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
      gross_salary decimal(12,2) NOT NULL DEFAULT 0,
      basic_salary decimal(12,2) NOT NULL DEFAULT 0,
      hra_amount decimal(12,2) NOT NULL DEFAULT 0,
      allowance_amount decimal(12,2) NOT NULL DEFAULT 0,
      daily_salary decimal(12,2) NOT NULL DEFAULT 0,
      paid_leave_days decimal(6,2) NOT NULL DEFAULT 0,
      unpaid_leave_days decimal(6,2) NOT NULL DEFAULT 0,
      half_days decimal(6,2) NOT NULL DEFAULT 0,
      late_marks decimal(6,2) NOT NULL DEFAULT 0,
      late_leave_days decimal(6,2) NOT NULL DEFAULT 0,
      leave_equivalent_days decimal(6,2) NOT NULL DEFAULT 0,
      leave_deduction decimal(12,2) NOT NULL DEFAULT 0,
      bonus_amount decimal(12,2) NOT NULL DEFAULT 0,
      incentive_amount decimal(12,2) NOT NULL DEFAULT 0,
      penalty_amount decimal(12,2) NOT NULL DEFAULT 0,
      professional_tax decimal(12,2) NOT NULL DEFAULT 0,
      pf_deduction decimal(12,2) NOT NULL DEFAULT 0,
      tds_deduction decimal(12,2) NOT NULL DEFAULT 0,
      total_deductions decimal(12,2) NOT NULL DEFAULT 0,
      total_reimbursements decimal(12,2) NOT NULL DEFAULT 0,
      net_payable decimal(12,2) NOT NULL DEFAULT 0,
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

  await runSchemaQuery(payrollTableSql);
  await runSchemaQuery(salaryHistorySql);
  await runSchemaQuery(deductionsSql);
  await runSchemaQuery(bonusesSql);
  await runSchemaQuery(incentivesSql);
  await runSchemaQuery(auditSql);

  const payrollSchemaChanges = [
    "ALTER TABLE payrolls ADD COLUMN gross_salary decimal(12,2) NOT NULL DEFAULT 0 AFTER working_days",
    "ALTER TABLE payrolls ADD COLUMN hra_amount decimal(12,2) NOT NULL DEFAULT 0 AFTER basic_salary",
    "ALTER TABLE payrolls ADD COLUMN allowance_amount decimal(12,2) NOT NULL DEFAULT 0 AFTER hra_amount",
    "ALTER TABLE payrolls ADD COLUMN late_marks decimal(6,2) NOT NULL DEFAULT 0 AFTER half_days",
    "ALTER TABLE payrolls ADD COLUMN late_leave_days decimal(6,2) NOT NULL DEFAULT 0 AFTER late_marks",
    "ALTER TABLE payrolls ADD COLUMN leave_equivalent_days decimal(6,2) NOT NULL DEFAULT 0 AFTER late_leave_days",
    "ALTER TABLE payrolls ADD COLUMN professional_tax decimal(12,2) NOT NULL DEFAULT 0 AFTER penalty_amount",
    "ALTER TABLE payrolls ADD COLUMN pf_deduction decimal(12,2) NOT NULL DEFAULT 0 AFTER professional_tax",
    "ALTER TABLE payrolls ADD COLUMN tds_deduction decimal(12,2) NOT NULL DEFAULT 0 AFTER pf_deduction",
    "ALTER TABLE payrolls ADD COLUMN total_deductions decimal(12,2) NOT NULL DEFAULT 0 AFTER tds_deduction",
    "ALTER TABLE payrolls ADD COLUMN total_reimbursements decimal(12,2) NOT NULL DEFAULT 0 AFTER total_deductions",
    "ALTER TABLE payrolls ADD COLUMN net_payable decimal(12,2) NOT NULL DEFAULT 0 AFTER total_reimbursements",
  ];

  for (const sql of payrollSchemaChanges) {
    await runSchemaChange(sql, "ER_DUP_FIELDNAME");
  }

  payrollSchemaReady = true;
}

scheduleSchemaSetup("Payroll schema setup", ensurePayrollTables);

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
        comp_name,
        ${getUserCompanyScopeSql()} AS company_scope_key,
        department,
        salary,
        joining_date,
        is_team_lead,
        CASE
          WHEN COALESCE(pf_enabled, 0) = 1 THEN COALESCE(employee_pf_amount, 0)
          ELSE 0
        END AS payroll_pf_deduction,
        0 AS payroll_tds_deduction
      FROM users
      WHERE id = ?
      LIMIT 1
    `,
    [normalizedUserId],
  );

  if (!rows.length) return null;

  const employee = rows[0];
  return {
    ...employee,
    company_scope_key:
      normalizeCompanyScopeKey(employee.company_scope_key || employee.comp_name) ||
      "metrics",
    department: derivePayrollDepartment(employee),
    salary: normalizePayrollAmount(employee.salary),
    is_team_lead: Number(employee.is_team_lead || 0),
    payroll_pf_deduction: normalizePayrollAmount(
      employee.payroll_pf_deduction,
    ),
    payroll_tds_deduction: normalizePayrollAmount(
      employee.payroll_tds_deduction,
    ),
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
  await ensureUserEmploymentStatusColumns();

  const roleFilter = normalizeRoleValue(filters.roleFilter);
  const departmentFilter = String(filters.departmentFilter || "")
    .trim()
    .toLowerCase();
  const searchTerm = String(filters.searchTerm || "")
    .trim()
    .toLowerCase();
  const companyScopeFilter = normalizeCompanyScopeKey(
    filters.companyScopeFilter ||
      filters.companyScope ||
      filters.company_scope ||
      filters.company,
  );

  const whereClauses = [
    getActiveUserEmploymentStatusSql(),
    `LOWER(TRIM(COALESCE(role, ''))) IN (${Array.from(PAYROLL_SUPPORTED_ROLES)
      .map(() => "?")
      .join(", ")})`,
  ];
  const params = Array.from(PAYROLL_SUPPORTED_ROLES);

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

  if (companyScopeFilter) {
    whereClauses.push(`${getUserCompanyScopeSql()} = ?`);
    params.push(companyScopeFilter);
  }

  const [rows] = await dbPromise.query(
    `
      SELECT
        id,
        name,
        email,
        contact,
        role,
        comp_name,
        ${getUserCompanyScopeSql()} AS company_scope_key,
        department,
        salary,
        joining_date,
        is_team_lead,
        CASE
          WHEN COALESCE(pf_enabled, 0) = 1 THEN COALESCE(employee_pf_amount, 0)
          ELSE 0
        END AS payroll_pf_deduction,
        0 AS payroll_tds_deduction
      FROM users
      WHERE ${whereClauses.join(" AND ")}
      ORDER BY
        FIELD(LOWER(TRIM(COALESCE(role, ''))), 'admin', 'hr', 'tme', 'me', 'dev', 'seo', 'smo', 'accounts', 'dm'),
        name ASC,
        id ASC
    `,
    params,
  );

  return rows.map((row) => ({
    ...row,
    company_scope_key:
      normalizeCompanyScopeKey(row.company_scope_key || row.comp_name) ||
      "metrics",
    department: derivePayrollDepartment(row),
    salary: normalizePayrollAmount(row.salary),
    is_team_lead: Number(row.is_team_lead || 0),
    payroll_pf_deduction: normalizePayrollAmount(row.payroll_pf_deduction),
    payroll_tds_deduction: normalizePayrollAmount(row.payroll_tds_deduction),
  }));
}

function normalizeStoredPayrollRow(row) {
  if (!row) return null;

  const salaryBreakup = resolveStoredPayrollSalaryBreakup(row);
  const basicSalary = salaryBreakup.basicSalary;
  const hraAmount = salaryBreakup.hraAmount;
  const allowanceAmount = salaryBreakup.allowanceAmount;
  const manualReimbursements =
    normalizePayrollAmount(row.bonus_amount) +
    normalizePayrollAmount(row.incentive_amount);
  const storedTotalReimbursements = normalizePayrollAmount(
    row.total_reimbursements,
  );
  const totalReimbursements =
    storedTotalReimbursements > 0
      ? storedTotalReimbursements
      : manualReimbursements;
  const professionalTax = getFixedPayrollOtherTax();
  const pfDeduction = normalizePayrollAmount(row.pf_deduction);
  const tdsDeduction = normalizePayrollAmount(row.tds_deduction);
  /*
   * Other tax is fixed for every employee. Recalculate stored payroll rows so
   * old rows that were generated with 0 tax still show the correct salary cut.
   */
  const totalDeductions = Number(
    (
      normalizePayrollAmount(row.leave_deduction) +
      normalizePayrollAmount(row.penalty_amount) +
      professionalTax +
      pfDeduction +
      tdsDeduction
    ).toFixed(2),
  );
  const finalSalary = Number(
    Math.max(
      0,
      salaryBreakup.grossSalary - totalDeductions + totalReimbursements,
    ).toFixed(2),
  );
  const netPayable = finalSalary;

  return {
    payrollId: Number(row.id || 0),
    employeeId: Number(row.employee_id || 0),
    monthKey: row.month_key,
    workingDays: Number(row.working_days || 0),
    grossSalary: salaryBreakup.grossSalary,
    basicSalary,
    hraAmount,
    allowanceAmount,
    dailySalary: normalizePayrollAmount(
      row.daily_salary,
      Number(row.working_days || 0) > 0
        ? Number(
            (salaryBreakup.grossSalary / Number(row.working_days || 1)).toFixed(
              2,
            ),
          )
        : 0,
    ),
    paidLeaveDays: Number(row.paid_leave_days || 0),
    unpaidLeaveDays: Number(row.unpaid_leave_days || 0),
    halfDays: Number(row.half_days || 0),
    lateMarks: Number(row.late_marks || 0),
    lateLeaveDays: Number(row.late_leave_days || 0),
    leaveEquivalentDays: Number(row.leave_equivalent_days || 0),
    totalLeaveDays: Number(
      row.leave_equivalent_days || row.unpaid_leave_days || 0,
    ),
    leaveDeduction: normalizePayrollAmount(row.leave_deduction),
    bonusAmount: normalizePayrollAmount(row.bonus_amount),
    incentiveAmount: normalizePayrollAmount(row.incentive_amount),
    penaltyAmount: normalizePayrollAmount(row.penalty_amount),
    professionalTax,
    pfDeduction,
    tdsDeduction,
    totalDeductions,
    totalReimbursements,
    finalSalary,
    netPayable,
    status: row.status || "generated",
    notes: row.notes || "",
    generatedAt: row.generated_at || null,
    approvedAt: row.approved_at || null,
  };
}


async function getStoredPayrollRowsByMonth(monthKey, employeeIds = []) {
  await ensurePayrollTables();

  const normalizedMonth = normalizePayrollMonthKey(monthKey);
  const normalizedIds = (
    Array.isArray(employeeIds) ? employeeIds : [employeeIds]
  )
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
    rows.map((row) => [
      Number(row.employee_id),
      normalizeStoredPayrollRow(row),
    ]),
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
    Number.isFinite(Number(actorId)) && Number(actorId) > 0
      ? Number(actorId)
      : null;
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
        gross_salary,
        basic_salary,
        hra_amount,
        allowance_amount,
        daily_salary,
        paid_leave_days,
        unpaid_leave_days,
        half_days,
        late_marks,
        late_leave_days,
        leave_equivalent_days,
        leave_deduction,
        bonus_amount,
        incentive_amount,
        penalty_amount,
        professional_tax,
        pf_deduction,
        tds_deduction,
        total_deductions,
        total_reimbursements,
        net_payable,
        final_salary,
        notes,
        status,
        generated_by,
        approved_by,
        generated_at,
        approved_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'generated', ?, ?, NOW(), NOW())
      ON DUPLICATE KEY UPDATE
        id = LAST_INSERT_ID(id),
        month_start = VALUES(month_start),
        month_end = VALUES(month_end),
        employee_name_snapshot = VALUES(employee_name_snapshot),
        role_snapshot = VALUES(role_snapshot),
        department_snapshot = VALUES(department_snapshot),
        joining_date_snapshot = VALUES(joining_date_snapshot),
        working_days = VALUES(working_days),
        gross_salary = VALUES(gross_salary),
        basic_salary = VALUES(basic_salary),
        hra_amount = VALUES(hra_amount),
        allowance_amount = VALUES(allowance_amount),
        daily_salary = VALUES(daily_salary),
        paid_leave_days = VALUES(paid_leave_days),
        unpaid_leave_days = VALUES(unpaid_leave_days),
        half_days = VALUES(half_days),
        late_marks = VALUES(late_marks),
        late_leave_days = VALUES(late_leave_days),
        leave_equivalent_days = VALUES(leave_equivalent_days),
        leave_deduction = VALUES(leave_deduction),
        bonus_amount = VALUES(bonus_amount),
        incentive_amount = VALUES(incentive_amount),
        penalty_amount = VALUES(penalty_amount),
        professional_tax = VALUES(professional_tax),
        pf_deduction = VALUES(pf_deduction),
        tds_deduction = VALUES(tds_deduction),
        total_deductions = VALUES(total_deductions),
        total_reimbursements = VALUES(total_reimbursements),
        net_payable = VALUES(net_payable),
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
      preview.grossSalary,
      preview.basicSalary,
      preview.hraAmount,
      preview.allowanceAmount,
      preview.dailySalary,
      preview.paidLeaveDays,
      preview.unpaidLeaveDays,
      preview.halfDays,
      preview.lateMarks,
      preview.lateLeaveDays,
      preview.leaveEquivalentDays,
      preview.leaveDeduction,
      preview.bonusAmount,
      preview.incentiveAmount,
      preview.penaltyAmount,
      preview.professionalTax,
      preview.pfDeduction,
      preview.tdsDeduction,
      preview.totalDeductions,
      preview.totalReimbursements,
      preview.netPayable,
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
        professionalTax: preview.professionalTax,
        pfDeduction: preview.pfDeduction,
        tdsDeduction: preview.tdsDeduction,
        totalDeductions: preview.totalDeductions,
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

async function tryAutoSyncCurrentPayrollForUser(
  employeeId,
  actorId = null,
  label = "Payroll auto-sync",
) {
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

async function getAttendanceHalfDayDateSetForPayroll(
  userId,
  startDate,
  endDate,
) {
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
        AND DAYOFWEEK(a.attendance_date) <> 1
        AND ${attendanceStatusSql} IN ('half_day', 'half_day_late')
      GROUP BY a.attendance_date
      ORDER BY a.attendance_date ASC
    `,
    [normalizedUserId, startDate, endDate],
  );

  return new Set(rows.map((row) => row.attendance_date));
}

async function getAttendanceLateMarkCountForPayroll(
  userId,
  startDate,
  endDate,
) {
  const normalizedUserId = Number(userId);
  if (!normalizedUserId) return 0;

  await ensurePayrollTables();
  const attendanceStatusSql = getAttendanceStatusSql("a", "u");
  const [rows] = await dbPromise.query(
    `
      SELECT COUNT(DISTINCT a.attendance_date) AS late_marks
      FROM attendance a
      INNER JOIN users u ON u.id = a.user_id
      WHERE a.user_id = ?
        AND a.attendance_date BETWEEN ? AND ?
        AND DAYOFWEEK(a.attendance_date) <> 1
        AND ${attendanceStatusSql} IN ('late', 'half_day_late')
    `,
    [normalizedUserId, startDate, endDate],
  );

  return Number(rows[0]?.late_marks || 0);
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
  const configuredSalary =
    options.salary !== undefined
      ? normalizePayrollAmount(options.salary)
      : normalizePayrollAmount(user?.salary);
  const storedPayroll = options.storedPayroll || null;
  const shouldUseStoredSnapshot =
    Boolean(storedPayroll) &&
    options.preferStoredSnapshot !== false &&
    options.salary === undefined &&
    options.bonusAmount === undefined &&
    options.incentiveAmount === undefined &&
    options.penaltyAmount === undefined &&
    options.professionalTax === undefined &&
    options.pfDeduction === undefined &&
    options.tdsDeduction === undefined &&
    options.notes === undefined;
  const salaryBreakup = shouldUseStoredSnapshot
    ? resolveStoredPayrollSalaryBreakup(storedPayroll)
    : splitPayrollGrossSalary(configuredSalary);
  const grossSalary = salaryBreakup.grossSalary;
  const basicSalary = salaryBreakup.basicSalary;
  const hraAmount = salaryBreakup.hraAmount;
  const allowanceAmount = salaryBreakup.allowanceAmount;
  const workingDays = shouldUseStoredSnapshot
    ? Number(storedPayroll.workingDays || monthRange.totalDays)
    : monthRange.totalDays;
  const dailySalary = shouldUseStoredSnapshot
    ? normalizePayrollAmount(
        storedPayroll.dailySalary,
        workingDays > 0 ? Number((grossSalary / workingDays).toFixed(2)) : 0,
      )
    : workingDays > 0
      ? Number((grossSalary / workingDays).toFixed(2))
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
  const professionalTax = getFixedPayrollOtherTax();
  const pfDeduction =
    options.pfDeduction !== undefined
      ? normalizePayrollAmount(options.pfDeduction)
      : shouldUseStoredSnapshot
        ? normalizePayrollAmount(storedPayroll?.pfDeduction)
        : normalizePayrollAmount(user?.payroll_pf_deduction);
  const tdsDeduction =
    options.tdsDeduction !== undefined
      ? normalizePayrollAmount(options.tdsDeduction)
      : shouldUseStoredSnapshot
        ? normalizePayrollAmount(storedPayroll?.tdsDeduction)
        : normalizePayrollAmount(user?.payroll_tds_deduction);
  const notes =
    options.notes !== undefined
      ? String(options.notes || "").trim()
      : String(storedPayroll?.notes || "").trim();
  const autoTargetIncentive = shouldUseStoredSnapshot
    ? null
    : AUTO_TARGET_INCENTIVE_ROLES.has(
          String(user?.role || "")
            .toLowerCase()
            .trim(),
        )
      ? await getAutoTargetIncentiveForPayroll({
          user,
          monthKey: monthRange.monthKey,
          basicSalary: grossSalary,
        })
      : null;
  const incentiveAmount = shouldUseStoredSnapshot
    ? normalizePayrollAmount(storedPayroll?.incentiveAmount)
    : autoTargetIncentive
      ? autoTargetIncentive.amount
      : options.incentiveAmount !== undefined
        ? normalizePayrollAmount(options.incentiveAmount)
        : normalizePayrollAmount(storedPayroll?.incentiveAmount);

  if (shouldUseStoredSnapshot) {
    const storedLeaveDeduction = normalizePayrollAmount(
      storedPayroll.leaveDeduction,
    );
    const leaveDeductionBreakdown = buildPayrollLeaveDeductionBreakdown({
      dailySalary,
      unpaidLeaveDays: storedPayroll.unpaidLeaveDays,
      halfDays: storedPayroll.halfDays,
      halfDayLeaveDays: storedPayroll.halfDayLeaveDays,
      lateMarks: storedPayroll.lateMarks,
      lateLeaveDays: storedPayroll.lateLeaveDays,
      leaveEquivalentDays: storedPayroll.leaveEquivalentDays,
      totalLeaveDays: storedPayroll.totalLeaveDays,
      leaveDeduction: storedLeaveDeduction,
    });
    const leaveDeduction = leaveDeductionBreakdown.totalLeaveDeduction;
    const totalReimbursements = Number(
      (bonusAmount + incentiveAmount).toFixed(2),
    );
    const totalDeductions = Number(
      (
        leaveDeduction +
        penaltyAmount +
        professionalTax +
        pfDeduction +
        tdsDeduction
      ).toFixed(2),
    );
    const finalSalary = Number(
      Math.max(0, grossSalary - totalDeductions + totalReimbursements).toFixed(
        2,
      ),
    );

    return {
      employeeId: Number(user.id),
      name: user.name || "Employee",
      email: user.email || "",
      contact: user.contact || "",
      role: normalizeRoleValue(user.role),
      roleLabel: getPayrollRoleLabel(user.role),
      department,
      salary: grossSalary,
      joiningDate,
      isTeamLead,
      monthKey: monthRange.monthKey,
      monthStart: monthRange.startDate,
      monthEnd: monthRange.endDate,
      workingDays,
      dailySalary,
      grossSalary,
      basicSalary,
      hraAmount,
      allowanceAmount,
      paidLeaveDays: Number(storedPayroll.paidLeaveDays || 0),
      unpaidLeaveDays: Number(storedPayroll.unpaidLeaveDays || 0),
      halfDays: Number(storedPayroll.halfDays || 0),
      leaveHalfDays: Number(storedPayroll.halfDays || 0),
      paidHalfDays: 0,
      attendanceHalfDays: 0,
      lateMarks: Number(storedPayroll.lateMarks || 0),
      lateLeaveDays: Number(storedPayroll.lateLeaveDays || 0),
      leaveEquivalentDays: Number(storedPayroll.leaveEquivalentDays || 0),
      totalLeaveDays: Number(
        storedPayroll.totalLeaveDays || storedPayroll.leaveEquivalentDays || 0,
      ),
      approvedLeaveEntries: 0,
      leaveDeduction,
      unpaidLeaveDeduction: leaveDeductionBreakdown.unpaidLeaveDeduction,
      halfDayDeduction: leaveDeductionBreakdown.halfDayDeduction,
      lateMarkDeduction: leaveDeductionBreakdown.lateMarkDeduction,
      leaveAdjustmentDeduction:
        leaveDeductionBreakdown.leaveAdjustmentDeduction,
      bonusAmount,
      incentiveAmount,
      penaltyAmount,
      professionalTax,
      pfDeduction,
      tdsDeduction,
      totalSalaryEarnings: grossSalary,
      totalEarnings: Number(
        (grossSalary + bonusAmount + incentiveAmount).toFixed(2),
      ),
      totalDeductions,
      totalReimbursements,
      finalSalary,
      netPayable: finalSalary,
      notes,
      payrollId: storedPayroll.payrollId || null,
      payrollStatus: storedPayroll.status || "generated",
      generatedAt: storedPayroll.generatedAt || null,
      approvedAt: storedPayroll.approvedAt || null,
      isGenerated: Boolean(storedPayroll.payrollId),
    };
  }

  const [leaveBalanceSnapshot, attendanceHalfDayDates, lateMarks] =
    await Promise.all([
      buildLeaveBalanceSnapshot(user, { referenceDate: monthRange.endDate }),
      getAttendanceHalfDayDateSetForPayroll(
        user.id,
        monthRange.startDate,
        monthRange.endDate,
      ),
      getAttendanceLateMarkCountForPayroll(
        user.id,
        monthRange.startDate,
        monthRange.endDate,
      ),
    ]);

  const paidFullDayDates = new Set();
  const unpaidFullDayDates = new Set();
  const unpaidHalfDayDates = new Set();
  const paidHalfDayDates = new Set();
  const approvedLeaveEntryIds = new Set();
  (leaveBalanceSnapshot?.dayStatusMap || new Map()).forEach(
    (decision, dateKey) => {
      if (
        !dateKey ||
        dateKey < monthRange.startDate ||
        dateKey > monthRange.endDate
      ) {
        return;
      }

      if (Number(decision?.leaveId || 0) > 0) {
        approvedLeaveEntryIds.add(Number(decision.leaveId));
      }

      if (decision?.unit === "half") {
        if (paidFullDayDates.has(dateKey) || unpaidFullDayDates.has(dateKey))
          return;

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
    },
  );

  attendanceHalfDayDates.forEach((dateKey) => {
    if (paidFullDayDates.has(dateKey) || unpaidFullDayDates.has(dateKey))
      return;
    if (!paidHalfDayDates.has(dateKey)) {
      unpaidHalfDayDates.add(dateKey);
    }
  });

  const paidLeaveDays = paidFullDayDates.size;
  const unpaidLeaveDays = unpaidFullDayDates.size;
  const leaveHalfDays = unpaidHalfDayDates.size;
  const attendanceHalfDays = Array.from(attendanceHalfDayDates).filter(
    (dateKey) =>
      !paidFullDayDates.has(dateKey) && !unpaidFullDayDates.has(dateKey),
  ).length;
  const lateLeaveDays = Math.floor(Number(lateMarks || 0) / 3);
  const halfDayLeaveDays = Number((leaveHalfDays / 2).toFixed(2));
  const leaveEquivalentDays = Number(
    (unpaidLeaveDays + halfDayLeaveDays + lateLeaveDays).toFixed(2),
  );
  const leaveDeduction = Number((leaveEquivalentDays * dailySalary).toFixed(2));
  const leaveDeductionBreakdown = buildPayrollLeaveDeductionBreakdown({
    dailySalary,
    unpaidLeaveDays,
    halfDays: leaveHalfDays,
    halfDayLeaveDays,
    lateMarks,
    lateLeaveDays,
    leaveEquivalentDays,
    leaveDeduction,
  });
  const totalSalaryEarnings = grossSalary;
  const totalReimbursements = Number(
    (bonusAmount + incentiveAmount).toFixed(2),
  );
  const totalDeductions = Number(
    (
      leaveDeduction +
      penaltyAmount +
      professionalTax +
      pfDeduction +
      tdsDeduction
    ).toFixed(2),
  );
  const finalSalary = Number(
    Math.max(
      0,
      totalSalaryEarnings - totalDeductions + totalReimbursements,
    ).toFixed(2),
  );

  return {
    employeeId: Number(user.id),
    name: user.name || "Employee",
    email: user.email || "",
    contact: user.contact || "",
    role: normalizeRoleValue(user.role),
    roleLabel: getPayrollRoleLabel(user.role),
    comp_name: user.comp_name || "",
    company_scope:
      normalizeCompanyScopeKey(user.company_scope_key || user.comp_name) ||
      "metrics",
    companyScope:
      normalizeCompanyScopeKey(user.company_scope_key || user.comp_name) ||
      "metrics",
    company_scope_key:
      normalizeCompanyScopeKey(user.company_scope_key || user.comp_name) ||
      "metrics",
    department,
    salary: grossSalary,
    joiningDate,
    isTeamLead,
    monthKey: monthRange.monthKey,
    monthStart: monthRange.startDate,
    monthEnd: monthRange.endDate,
    workingDays,
    dailySalary,
    grossSalary,
    basicSalary,
    hraAmount,
    allowanceAmount,
    paidLeaveDays,
    unpaidLeaveDays,
    halfDays: leaveHalfDays,
    leaveHalfDays,
    halfDayLeaveDays,
    paidHalfDays: paidHalfDayDates.size,
    attendanceHalfDays,
    lateMarks,
    lateLeaveDays,
    leaveEquivalentDays,
    totalLeaveDays: leaveEquivalentDays,
    approvedLeaveEntries: approvedLeaveEntryIds.size,
    leaveDeduction,
    unpaidLeaveDeduction: leaveDeductionBreakdown.unpaidLeaveDeduction,
    halfDayDeduction: leaveDeductionBreakdown.halfDayDeduction,
    lateMarkDeduction: leaveDeductionBreakdown.lateMarkDeduction,
    leaveAdjustmentDeduction: leaveDeductionBreakdown.leaveAdjustmentDeduction,
    bonusAmount,
    incentiveAmount,
    penaltyAmount,
    professionalTax,
    pfDeduction,
    tdsDeduction,
    totalSalaryEarnings,
    totalEarnings: Number(
      (totalSalaryEarnings + totalReimbursements).toFixed(2),
    ),
    totalDeductions,
    totalReimbursements,
    finalSalary,
    netPayable: finalSalary,
    notes,
    payrollId: storedPayroll?.payrollId || null,
    payrollStatus: storedPayroll?.status || "preview",
    generatedAt: storedPayroll?.generatedAt || null,
    approvedAt: storedPayroll?.approvedAt || null,
    isGenerated: Boolean(storedPayroll?.payrollId),
  };
}


async function getPayrollTrendSeries(limit = 6, companyScopeFilter = "") {
  await ensurePayrollTables();
  const safeLimit = Math.max(1, Number(limit) || 6);
  const normalizedCompanyScope = normalizeCompanyScopeKey(companyScopeFilter);
  const params = [];
  const whereClauses = [];

  if (normalizedCompanyScope) {
    whereClauses.push(`${getUserCompanyScopeSql("u")} = ?`);
    params.push(normalizedCompanyScope);
  }

  const whereSql = whereClauses.length
    ? `WHERE ${whereClauses.join(" AND ")}`
    : "";

  const [rows] = await dbPromise.query(
    `
      SELECT
        p.month_key,
        SUM(p.final_salary) AS total_payout,
        COUNT(*) AS employee_count
      FROM payrolls p
      INNER JOIN users u ON u.id = p.employee_id
      ${whereSql}
      GROUP BY p.month_key
      ORDER BY p.month_key DESC
      LIMIT ?
    `,
    [...params, safeLimit],
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

  const leaveDeductionBreakdown = buildPayrollLeaveDeductionBreakdown(preview);
  const deductionItems = [];
  if (leaveDeductionBreakdown.unpaidLeaveDeduction > 0) {
    deductionItems.push({
      deductionType: "unpaid_leave",
      label: `Unpaid leave (${formatPayrollCompactDays(leaveDeductionBreakdown.unpaidLeaveDays)} day)`,
      units: leaveDeductionBreakdown.unpaidLeaveDays,
      amount: leaveDeductionBreakdown.unpaidLeaveDeduction,
      notes: "Full-day unpaid leave deduction",
    });
  }
  if (leaveDeductionBreakdown.halfDayDeduction > 0) {
    deductionItems.push({
      deductionType: "half_day",
      label: `Half day (${formatPayrollCompactDays(leaveDeductionBreakdown.halfDays)} x 0.5)`,
      units: leaveDeductionBreakdown.halfDayLeaveDays,
      amount: leaveDeductionBreakdown.halfDayDeduction,
      notes: "Half-day salary deduction",
    });
  }
  if (leaveDeductionBreakdown.lateMarkDeduction > 0) {
    deductionItems.push({
      deductionType: "late_mark",
      label: `Late marks (${leaveDeductionBreakdown.lateMarks} = ${formatPayrollCompactDays(leaveDeductionBreakdown.lateLeaveDays)} day)`,
      units: leaveDeductionBreakdown.lateLeaveDays,
      amount: leaveDeductionBreakdown.lateMarkDeduction,
      notes: "Every 3 late marks count as 1 leave deduction",
    });
  }
  if (leaveDeductionBreakdown.leaveAdjustmentDeduction > 0) {
    deductionItems.push({
      deductionType: "leave_adjustment",
      label: "Leave adjustment",
      units: null,
      amount: leaveDeductionBreakdown.leaveAdjustmentDeduction,
      notes: "Stored leave deduction balance",
    });
  }
  if (preview.professionalTax > 0) {
    deductionItems.push({
      deductionType: "professional_tax",
      label: "Other Tax",
      units: null,
      amount: preview.professionalTax,
      notes: "Fixed monthly other tax",
    });
  }
  if (preview.pfDeduction > 0) {
    deductionItems.push({
      deductionType: "pf",
      label: "PF",
      units: null,
      amount: preview.pfDeduction,
      notes: "Admin-entered PF deduction",
    });
  }
  if (preview.tdsDeduction > 0) {
    deductionItems.push({
      deductionType: "tds",
      label: "TDS",
      units: null,
      amount: preview.tdsDeduction,
      notes: "Admin-entered TDS deduction",
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
    const incentiveLabel = AUTO_TARGET_INCENTIVE_ROLES.has(
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
  if (nextSalary < 0) {
    const error = new Error("Salary cannot be negative");
    error.statusCode = 400;
    throw error;
  }

  const nextDepartment =
    updates.department !== undefined
      ? String(updates.department || "").trim()
      : employee.department;
  const nextJoiningDate =
    updates.joiningDate !== undefined
      ? String(updates.joiningDate || "").trim() || null
      : employee.joining_date || null;

  if (nextJoiningDate && !parseDateOnlyValue(nextJoiningDate)) {
    const error = new Error("Joining date must be a valid date");
    error.statusCode = 400;
    throw error;
  }

  const departmentChanged =
    String(employee.department || "") !== nextDepartment;
  const salaryChanged =
    Number(employee.salary || 0) !== Number(nextSalary || 0);
  const joiningDateChanged =
    String(employee.joining_date || "") !== String(nextJoiningDate || "");

  if (
    !departmentChanged &&
    !salaryChanged &&
    !joiningDateChanged
  ) {
    return employee;
  }

  await dbPromise.query(
    `
      UPDATE users
      SET
        department = ?,
        salary = ?,
        joining_date = ?
      WHERE id = ?
    `,
    [
      nextDepartment || null,
      Number(nextSalary.toFixed(2)),
      nextJoiningDate,
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
        changed_by,
        note
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      normalizedUserId,
      Number(employee.salary || 0),
      Number(nextSalary.toFixed(2)),
      employee.department || null,
      nextDepartment || null,
      employee.joining_date || null,
      nextJoiningDate,
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
        department: employee.department,
        joiningDate: employee.joining_date,
        isTeamLead: employee.is_team_lead,
      },
      next: {
        salary: nextSalary,
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
  companyScopeFilter,
}) {
  const normalizedMonthKey = normalizePayrollMonthKey(monthKey);
  const normalizedCompanyScope = normalizeCompanyScopeKey(companyScopeFilter);
  const users = await getPayrollUsers({
    roleFilter,
    departmentFilter,
    searchTerm,
    companyScopeFilter: normalizedCompanyScope,
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

    if (row.totalDeductions > 0) {
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

  const trend = await getPayrollTrendSeries(6, normalizedCompanyScope);

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
  companyScopeFilter,
}) {
  await ensureAdminAccess(adminId);
  return buildPayrollOverviewCore({
    monthKey,
    roleFilter,
    departmentFilter,
    searchTerm,
    companyScopeFilter,
  });
}


function buildPayrollCsv(rows = []) {
  const header = [
    "Employee",
    "Role",
    "Department",
    "Month",
    "Gross Salary",
    "Basic Salary",
    "HRA",
    "Allowance",
    "Paid Leaves",
    "Unpaid Leaves",
    "Half Days",
    "Late Marks",
    "Leave Equivalent Days",
    "Leave Deduction",
    "Other Tax",
    "PF",
    "TDS",
    "Bonus",
    "Incentive",
    "Penalty",
    "Total Deductions",
    "Total Reimbursements",
    "Final Salary",
    "Generated",
  ];

  const escapeCsvValue = (value) =>
    `"${String(value ?? "").replace(/"/g, '""')}"`;

  const csvLines = [header.map(escapeCsvValue).join(",")];
  rows.forEach((row) => {
    csvLines.push(
      [
        row.name,
        row.roleLabel,
        row.department,
        row.monthKey,
        row.grossSalary,
        row.basicSalary,
        row.hraAmount,
        row.allowanceAmount,
        row.paidLeaveDays,
        row.unpaidLeaveDays,
        row.halfDays,
        row.lateMarks,
        row.leaveEquivalentDays,
        row.leaveDeduction,
        row.professionalTax,
        row.pfDeduction,
        row.tdsDeduction,
        row.bonusAmount,
        row.incentiveAmount,
        row.penaltyAmount,
        row.totalDeductions,
        row.totalReimbursements,
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
      companyScopeFilter:
        req.query.companyScope || req.query.company_scope || req.query.company,
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
    const requester = await ensureAdminOrHrAccess(requesterId);
    const requesterCompanyScope =
      normalizeCompanyScopeKey(requester.comp_name) ||
      normalizeCompanyScopeKey(
        req.query.companyScope || req.query.company_scope || req.query.company,
      ) ||
      "metrics";
    const payload = await buildPayrollOverviewCore({
      monthKey: req.query.month,
      roleFilter: req.query.role,
      departmentFilter: req.query.department,
      searchTerm: req.query.search,
      companyScopeFilter: requesterCompanyScope,
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

app.put(
  "/api/payroll/admin/employee/:userId/compensation",
  async (req, res) => {
    const userId = Number(req.params.userId);
    const adminId = Number(req.body.adminId);

    if (!userId || !adminId) {
      return res.status(400).json({
        success: false,
        message: "Employee and admin details are required",
      });
    }

    try {
      const companyScopeFilter = normalizeCompanyScopeKey(
        req.body.companyScope || req.body.company_scope || req.body.company,
      );

      if (companyScopeFilter) {
        const scopedUsers = await getPayrollUsers({ companyScopeFilter });
        const isEmployeeInScope = scopedUsers.some(
          (user) => Number(user.id) === userId,
        );

        if (!isEmployeeInScope) {
          return res.status(403).json({
            success: false,
            message: "Employee does not belong to the selected company",
          });
        }
      }

      const employee = await saveUserCompensation(
        adminId,
        userId,
        req.body || {},
      );
      const monthKey = normalizePayrollMonthKey(req.body.month);
      const payrollPreview = await upsertPayrollForEmployee({
        employeeId: userId,
        monthKey,
        actorId: adminId,
        overrides: {
          salary: req.body.salary,
          department: req.body.department,
          joiningDate: req.body.joiningDate,
          isTeamLead: req.body.isTeamLead,
          bonusAmount: req.body.bonusAmount,
          incentiveAmount: req.body.incentiveAmount,
          penaltyAmount: req.body.penaltyAmount,
          professionalTax: req.body.professionalTax,
          pfDeduction: req.body.pfDeduction,
          tdsDeduction: req.body.tdsDeduction,
          notes: req.body.notes,
        },
        touchApprovalTimestamps: false,
        auditActionType: "payroll_profile_saved",
      });

      res.json({
        success: true,
        message: "Compensation updated successfully",
        data: employee,
        payroll: payrollPreview,
      });
    } catch (err) {
      console.error("Payroll compensation update error:", err);
      res.status(err.statusCode || 500).json({
        success: false,
        message: err.message || "Failed to update compensation",
      });
    }
  },
);

app.post("/api/payroll/admin/generate", async (req, res) => {
  const adminId = Number(req.body.adminId);
  const monthKey = normalizePayrollMonthKey(req.body.month);
  const employeesPayload = Array.isArray(req.body.employees)
    ? req.body.employees
    : [];

  if (!adminId) {
    return res.status(400).json({
      success: false,
      message: "Admin access is required",
    });
  }

  try {
    await ensureAdminAccess(adminId);
    const companyScopeFilter = normalizeCompanyScopeKey(
      req.body.companyScope || req.body.company_scope || req.body.company,
    );
    const allUsers = await getPayrollUsers({ companyScopeFilter });
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
          department: payload.department,
          joiningDate: payload.joiningDate,
          isTeamLead: payload.isTeamLead,
          bonusAmount: payload.bonusAmount,
          incentiveAmount: payload.incentiveAmount,
          penaltyAmount: payload.penaltyAmount,
          professionalTax: payload.professionalTax,
          pfDeduction: payload.pfDeduction,
          tdsDeduction: payload.tdsDeduction,
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
      companyScopeFilter:
        req.query.companyScope || req.query.company_scope || req.query.company,
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
      preview,
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
          u.role AS current_employee_role,
          u.comp_name AS current_employee_company,
          ${getUserCompanyScopeSql("u")} AS current_company_scope_key,
          u.pan_number,
          u.uan_number
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

    const doc = new PDFDocument({ size: "A4", margin: 0 });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=payslip_${payroll.employee_id}_${payroll.month_key}.pdf`,
    );
    res.setHeader(
      "Cache-Control",
      "no-store, no-cache, must-revalidate, private",
    );
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    doc.pipe(res);

    const payrollBreakup = resolveStoredPayrollSalaryBreakup(payroll);
    const grossSalary = payrollBreakup.grossSalary;
    const basicSalary = payrollBreakup.basicSalary;
    const hraAmount = payrollBreakup.hraAmount;
    const allowanceAmount = payrollBreakup.allowanceAmount;
    const professionalTax = getFixedPayrollOtherTax();
    const pfDeduction = normalizePayrollAmount(payroll.pf_deduction);
    const tdsDeduction = normalizePayrollAmount(payroll.tds_deduction);
    const penaltyDeduction = normalizePayrollAmount(payroll.penalty_amount);
    const leaveDeduction = normalizePayrollAmount(payroll.leave_deduction);
    const leaveDeductionBreakdown = buildPayrollLeaveDeductionBreakdown({
      dailySalary: payroll.daily_salary,
      unpaidLeaveDays: payroll.unpaid_leave_days,
      halfDays: payroll.half_days,
      lateMarks: payroll.late_marks,
      lateLeaveDays: payroll.late_leave_days,
      leaveEquivalentDays: payroll.leave_equivalent_days,
      leaveDeduction,
    });
    const calculatedDeductions = Number(
      (
        professionalTax +
        pfDeduction +
        tdsDeduction +
        leaveDeductionBreakdown.totalLeaveDeduction +
        penaltyDeduction
      ).toFixed(2),
    );
    const totalDeductions = calculatedDeductions;
    const calculatedReimbursements = Number(
      (
        normalizePayrollAmount(payroll.bonus_amount) +
        normalizePayrollAmount(payroll.incentive_amount)
      ).toFixed(2),
    );
    const storedTotalReimbursements = normalizePayrollAmount(
      payroll.total_reimbursements,
    );
    const totalReimbursements =
      storedTotalReimbursements > 0
        ? storedTotalReimbursements
        : calculatedReimbursements;
    const netPayable = Number(
      Math.max(0, grossSalary - totalDeductions + totalReimbursements).toFixed(
        2,
      ),
    );
    const paidDays = Math.max(
      0,
      Number(payroll.working_days || 0) -
        normalizePayrollAmount(payroll.leave_equivalent_days),
    );
    const lopDays = normalizePayrollAmount(payroll.leave_equivalent_days);
    const monthLabel = formatPayrollMonthForPayslip(payroll.month_key);
    const monthTitleLabel = monthLabel.includes("-")
      ? monthLabel.replace("-", ", ")
      : monthLabel;
    const employeeName =
      payroll.employee_name_snapshot || payroll.current_employee_name || "-";
    const designation = getPayrollDesignationLabel(
      payroll.role_snapshot || payroll.current_employee_role,
      payroll.department_snapshot,
    );
    const amountInWords = `${titleCaseWords(converter.toWords(Math.round(netPayable)).replace(/-/g, " "))} Only`;
    const payslipCompanyScope =
      normalizeCompanyScopeKey(
        payroll.current_company_scope_key || payroll.current_employee_company,
      ) || "metrics";
    const payslipHeader =
      payslipCompanyScope === "redsea"
        ? {
            logoPath: path.join(__dirname, "logo_.png"),
            logoFallback: "RED SEA",
            logoMode: "redsea-transparent-crop",
            addressLine1: "Add:- B006, H-140, Sector 63,",
            addressLine2: "Noida, Uttar Pradesh 201301",
            email: "info@redseadigitals.com",
            linkLabel: "Contact:",
            linkValue: "+91 9310355211",
            accentColor: "#e11d48",
          }
        : {
            logoPath: path.join(__dirname, "logo-transparent.png"),
            logoFallback: "METRIC",
            logoMode: "standard",
            addressLine1: "Add:- E 107, Riddhi Siddhi Complex, Unnat",
            addressLine2: "Nagar-2, Goregaon West Mumbai - 400104",
            email: "info@metricsmart.in",
            linkLabel: "Website:",
            linkValue: "www.metricsmartinfoline.com",
            accentColor: "#009999",
          };

    doc.rect(0, 0, 595.28, 841.89).fill("#d9ead3");
    let amountFont = "Times-Roman";
    try {
      doc.registerFont(
        "PayslipAmount",
        path.join(__dirname, "fonts", "NotoSans-Regular.ttf"),
      );
      amountFont = "PayslipAmount";
    } catch {
      amountFont = "Times-Roman";
    }

    const tableX = 22;
    let y = 8;
    const tableW = 551;
    const leftW = 334;
    const rightW = tableW - leftW;
    const detailLabelW = 105;
    const detailValueW = leftW - detailLabelW;
    const earnLabelW = 152;
    const earnAmountW = 170;
    const deductLabelW = 115;
    const deductAmountW = tableW - earnLabelW - earnAmountW - deductLabelW;

    const INR = "\u20B9";
    const money = (value) => `${INR}${formatPayrollCurrency(value)}`;
    const headlineMoney = (value) =>
      `Rs. ${Math.round(Number(value || 0)).toLocaleString("en-IN", {
        maximumFractionDigits: 0,
      })}`;
    const writeCell = (x, cellY, w, h, text = "", options = {}) => {
      const {
        bold = false,
        align = "left",
        size = 7,
        fill = null,
        color = "#000000",
        padding = 3,
      } = options;
      if (fill) {
        doc.rect(x, cellY, w, h).fillAndStroke(fill, "#000000");
      } else {
        doc.rect(x, cellY, w, h).stroke("#000000");
      }
      doc
        .font(
          options.font ||
            (String(text).includes(INR)
              ? amountFont
              : bold
                ? "Times-Bold"
                : "Times-Roman"),
        )
        .fontSize(size)
        .fillColor(color)
        .text(String(text ?? ""), x + padding, cellY + 3, {
          width: Math.max(1, w - padding * 2),
          align,
          lineBreak: false,
        });
    };
    const writeFree = (x, textY, text, options = {}) => {
      doc
        .font(
          options.font ||
            (String(text).includes(INR)
              ? amountFont
              : options.bold
                ? "Times-Bold"
                : "Times-Roman"),
        )
        .fontSize(options.size || 7)
        .fillColor(options.color || "#000000")
        .text(String(text ?? ""), x, textY, {
          width: options.width,
          align: options.align || "left",
          lineBreak: false,
        });
    };

    doc.lineWidth(0.8);

    writeCell(tableX, y, leftW, 74, "", {});
    try {
      if (payslipHeader.logoMode === "redsea-transparent-crop") {
        doc.save();
        doc.rect(tableX + 58, y + 5, 198, 64).clip();
        doc.image(payslipHeader.logoPath, tableX + 58, y - 14, { width: 455 });
        doc.restore();
      } else {
        doc.image(payslipHeader.logoPath, tableX + 96, y + 6, { width: 150 });
      }
    } catch {
      writeFree(tableX + 112, y + 26, payslipHeader.logoFallback, {
        bold: true,
        size: 18,
        width: 120,
      });
    }
    writeCell(tableX + leftW, y, rightW, 74, "", {});
    writeFree(
      tableX + leftW + 5,
      y + 12,
      payslipHeader.addressLine1,
      { bold: true, size: 6.8, width: rightW - 10 },
    );
    writeFree(
      tableX + leftW + 5,
      y + 24,
      payslipHeader.addressLine2,
      { bold: true, size: 6.8, width: rightW - 10 },
    );
    writeFree(tableX + leftW + 5, y + 38, "Email ID:", {
      bold: true,
      size: 6.8,
      width: 42,
    });
    writeFree(tableX + leftW + 47, y + 38, payslipHeader.email, {
      bold: true,
      size: 6.8,
      color: payslipHeader.accentColor,
      width: rightW - 52,
    });
    writeFree(
      tableX + leftW + 5,
      y + 52,
      payslipHeader.linkLabel,
      { bold: true, size: 6.8, width: 42 },
    );
    writeFree(
      tableX + leftW + 47,
      y + 52,
      payslipHeader.linkValue,
      { bold: true, size: 6.8, color: payslipHeader.accentColor, width: rightW - 52 },
    );
    y += 74;

    writeCell(tableX, y, tableW, 16, `Payslip for the Month of ${monthTitleLabel}`, {
      align: "center",
      bold: true,
      size: 7,
    });
    y += 16;

    writeCell(tableX, y, leftW, 13, "Employee Pay Summary", {
      bold: true,
      size: 7,
    });
    writeCell(tableX + leftW, y, rightW, 13, "", {});
    y += 13;

    const summaryStartY = y;
    const summaryRows = [
      ["Employee Name", employeeName],
      ["Designation", designation || "-"],
      [
        "Date of Joining",
        formatPayrollDateForDisplay(payroll.joining_date_snapshot),
      ],
      ["Pay Period", monthLabel],
      [
        "Pay Date",
        formatPayrollDateForDisplay(
          payroll.approved_at || payroll.generated_at,
        ),
      ],
      ["PAN Number", payroll.pan_number || "NA"],
      ["UAN Number", payroll.uan_number || "NA"],
    ];
    summaryRows.forEach(([label, value]) => {
      writeCell(tableX, y, detailLabelW, 13, label, { bold: true, size: 6.8 });
      writeCell(tableX + detailLabelW, y, detailValueW, 13, `: ${value}`, {
        bold: true,
        size: 6.8,
      });
      y += 13;
    });
    writeCell(tableX + leftW, summaryStartY, rightW, 39, "", {});
    writeFree(tableX + leftW, summaryStartY + 14, "Employee Net Pay", {
      size: 11,
      width: rightW,
      align: "center",
    });
    writeCell(tableX + leftW, summaryStartY + 39, rightW, 13, headlineMoney(netPayable), {
      align: "center",
      bold: true,
      size: 7,
    });
    writeCell(
      tableX + leftW,
      summaryStartY + 52,
      rightW,
      13,
      `Paid Days: ${paidDays} | LOP Days: ${lopDays}`,
      {
        bold: true,
        size: 6.8,
        align: "center",
      },
    );
    writeCell(tableX + leftW, summaryStartY + 65, rightW, 26, "", {});

    const deductionRows = [
      ["PF", pfDeduction],
      ["TDS", tdsDeduction],
      ["Other Tax", professionalTax],
    ];

    if (leaveDeductionBreakdown.unpaidLeaveDeduction > 0) {
      deductionRows.push([
        `Unpaid Leave (${formatPayrollCompactDays(leaveDeductionBreakdown.unpaidLeaveDays)}d)`,
        leaveDeductionBreakdown.unpaidLeaveDeduction,
      ]);
    }
    if (leaveDeductionBreakdown.halfDayDeduction > 0) {
      deductionRows.push([
        `Half Day (${formatPayrollCompactDays(leaveDeductionBreakdown.halfDays)}x0.5)`,
        leaveDeductionBreakdown.halfDayDeduction,
      ]);
    }
    if (leaveDeductionBreakdown.lateMarkDeduction > 0) {
      deductionRows.push([
        `Late Marks (${leaveDeductionBreakdown.lateMarks}/3=${formatPayrollCompactDays(leaveDeductionBreakdown.lateLeaveDays)}d)`,
        leaveDeductionBreakdown.lateMarkDeduction,
      ]);
    }
    if (leaveDeductionBreakdown.leaveAdjustmentDeduction > 0) {
      deductionRows.push([
        "Leave Adjustment",
        leaveDeductionBreakdown.leaveAdjustmentDeduction,
      ]);
    }
    if (penaltyDeduction > 0) {
      deductionRows.push(["Penalty", penaltyDeduction]);
    }

    deductionRows.push(["Total Deductions", totalDeductions]);

    const earningRows = [
      ["Basic Salary", basicSalary],
      ["HRA", hraAmount],
      ["Allowances", allowanceAmount],
    ];
    while (earningRows.length < deductionRows.length - 1) {
      earningRows.push(["", ""]);
    }
    earningRows.push(["Gross Earnings", grossSalary]);
    const salaryRows = Array.from(
      { length: Math.max(earningRows.length, deductionRows.length) },
      (_, index) => [
        ...(earningRows[index] || ["", ""]),
        ...(deductionRows[index] || ["", ""]),
      ],
    );

    writeCell(tableX, y, earnLabelW, 13, "EARNINGS", { bold: true, size: 7 });
    writeCell(tableX + earnLabelW, y, earnAmountW, 13, "AMOUNT", {
      bold: true,
      align: "center",
      size: 7,
    });
    writeCell(
      tableX + earnLabelW + earnAmountW,
      y,
      deductLabelW,
      13,
      "DEDUCTIONS",
      { bold: true, size: 7 },
    );
    writeCell(
      tableX + earnLabelW + earnAmountW + deductLabelW,
      y,
      deductAmountW,
      13,
      "AMOUNT",
      { bold: true, align: "center", size: 7 },
    );
    y += 13;

    salaryRows.forEach(
      ([earningLabel, earningAmount, deductionLabel, deductionAmount]) => {
        writeCell(tableX, y, earnLabelW, 13, earningLabel, {
          bold: earningLabel === "Gross Earnings",
          size: 6.8,
        });
        writeCell(
          tableX + earnLabelW,
          y,
          earnAmountW,
          13,
          earningAmount === "" ? "" : money(earningAmount),
          {
            align: "center",
            bold: earningLabel === "Gross Earnings",
            size: 6.8,
          },
        );
        writeCell(
          tableX + earnLabelW + earnAmountW,
          y,
          deductLabelW,
          13,
          deductionLabel,
          {
            bold: deductionLabel === "Total Deductions",
            size: 6.8,
          },
        );
        writeCell(
          tableX + earnLabelW + earnAmountW + deductLabelW,
          y,
          deductAmountW,
          13,
          money(deductionAmount),
          {
            align: "center",
            bold: deductionLabel === "Total Deductions",
            size: 6.8,
          },
        );
        y += 13;
      },
    );

    writeCell(tableX, y, earnLabelW, 13, "REIMBURSEMENTS", {
      bold: true,
      size: 7,
    });
    writeCell(tableX + earnLabelW, y, earnAmountW, 13, "", {});
    writeCell(tableX + earnLabelW + earnAmountW, y, deductLabelW, 13, "", {});
    writeCell(
      tableX + earnLabelW + earnAmountW + deductLabelW,
      y,
      deductAmountW,
      13,
      "",
      {},
    );
    y += 13;
    [
      ["Reimbursement 1", normalizePayrollAmount(payroll.bonus_amount)],
      ["Reimbursement 2", normalizePayrollAmount(payroll.incentive_amount)],
      ["Total Reimbursements", totalReimbursements],
    ].forEach(([label, amount]) => {
      writeCell(tableX, y, earnLabelW, 13, label, {
        bold: label === "Total Reimbursements",
        size: 6.8,
      });
      writeCell(tableX + earnLabelW, y, earnAmountW, 13, money(amount), {
        align: "center",
        bold: label === "Total Reimbursements",
        size: 6.8,
      });
      writeCell(tableX + earnLabelW + earnAmountW, y, deductLabelW, 13, "", {});
      writeCell(
        tableX + earnLabelW + earnAmountW + deductLabelW,
        y,
        deductAmountW,
        13,
        "",
        {},
      );
      y += 13;
    });

    writeCell(tableX, y, tableW - deductAmountW, 13, "NETPAY", {
      bold: true,
      size: 7,
    });
    writeCell(tableX + tableW - deductAmountW, y, deductAmountW, 13, "AMOUNT", {
      bold: true,
      align: "center",
      size: 7,
    });
    y += 13;
    [
      ["Gross Earnings", grossSalary],
      ["Total Deductions", totalDeductions],
      ["Total Reimbursements", totalReimbursements],
    ].forEach(([label, amount]) => {
      writeCell(tableX, y, tableW - deductAmountW, 13, label, { size: 6.8 });
      writeCell(
        tableX + tableW - deductAmountW,
        y,
        deductAmountW,
        13,
        money(amount),
        {
          align: "center",
          size: 6.8,
        },
      );
      y += 13;
    });

    writeCell(tableX, y, tableW - 164, 13, "Total Net Payable", {
      align: "right",
      size: 6.8,
    });
    writeCell(tableX + tableW - 164, y, 164, 13, money(netPayable), {
      align: "right",
      bold: true,
      size: 6.8,
    });
    y += 13;
    writeCell(
      tableX,
      y,
      tableW,
      13,
      `Total Net Payable ${money(netPayable)} (${amountInWords})`,
      {
        align: "center",
        bold: true,
        size: 6.8,
      },
    );
    y += 13;
    writeCell(
      tableX,
      y,
      tableW,
      13,
      "**Total Net Payable = Gross Earnings - Total Deductions + Total Reimbursements",
      {
        align: "center",
        bold: true,
        size: 6.8,
      },
    );
    y += 13;
    writeFree(
      tableX,
      y + 2,
      "It is system generated payslip does not required signature",
      {
        align: "center",
        bold: true,
        size: 6.8,
        width: tableW,
      },
    );

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
        console.error(
          `${normalizedRole.toUpperCase()} Report User Error:`,
          userErr,
        );
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

      const leadsSql = `
        SELECT COUNT(*) AS total
        FROM leads
        WHERE created_by = ? OR assign_emp = ? OR assign_emp_id = ?
      `;
      const appointmentSql = `
        SELECT COUNT(*) AS total
        FROM leads
        WHERE action_type='appointment'
          AND (created_by = ? OR assign_emp = ? OR assign_emp_id = ?)
      `;
      const followSql = `
        SELECT COUNT(*) AS total
        FROM leads
        WHERE action_type='followup'
          AND (created_by = ? OR assign_emp = ? OR assign_emp_id = ?)
      `;
      const dealsSql =
        normalizedRole === "me"
          ? `
        SELECT COUNT(*) AS total
        FROM leads
        WHERE lead_status='deal_closed'
          AND (closed_by = ? OR assign_emp = ? OR assign_emp_id = ?)
      `
          : `
        SELECT COUNT(*) AS total
        FROM leads
        WHERE lead_status='deal_closed' AND closed_by = ?
      `;
      const dealsValues =
        normalizedRole === "me" ? [userId, employeeName, userId] : [userId];

      db.query(leadsSql, [userId, employeeName, userId], (err0, leads) => {
        if (err0) {
          console.error(
            `${normalizedRole.toUpperCase()} Leads Report Error:`,
            err0,
          );
          return res.status(500).json({ success: false });
        }

        db.query(
          appointmentSql,
          [userId, employeeName, userId],
          (err1, appointments) => {
            if (err1) {
              console.error(
                `${normalizedRole.toUpperCase()} Appointments Report Error:`,
                err1,
              );
              return res.status(500).json({ success: false });
            }

            db.query(
              followSql,
              [userId, employeeName, userId],
              (err2, follows) => {
                if (err2) {
                  console.error(
                    `${normalizedRole.toUpperCase()} Followups Report Error:`,
                    err2,
                  );
                  return res.status(500).json({ success: false });
                }

                db.query(dealsSql, dealsValues, (err3, deals) => {
                  if (err3) {
                    console.error(
                      `${normalizedRole.toUpperCase()} Deals Report Error:`,
                      err3,
                    );
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
              },
            );
          },
        );
      });
    });
  } else {
    leadQuery = "SELECT COUNT(*) AS total FROM leads WHERE created_by = ?";
    appointmentQuery =
      "SELECT COUNT(*) AS total FROM leads WHERE action_type='appointment' AND created_by = ?";
    followQuery =
      "SELECT COUNT(*) AS total FROM leads WHERE action_type='followup' AND created_by = ?";

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
      WHERE lead_status = 'deal_closed'
      AND pay_stat = 'received'
      ORDER BY closed_date DESC
    `;

  db.query(sql, (err, result) => {
    if (err) {
      console.error("Projects Fetch Error:", err);
      return res.status(500).json({ success: false, message: "Server error" });
    }

    const projects = result.map((project) => {
      let servicesList = Array.from(
        getProjectServiceList(project).map((service) => service.label),
      );

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
app.get("/api/available-team", async (req, res) => {
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

  try {
    await ensureUserEmploymentStatusColumns();
  } catch (err) {
    console.error("Available Team Schema Error:", err);
    return res.status(500).json({ success: false, message: "DB Error" });
  }

  const sql = `
    SELECT
      u.id,
      u.name,
      u.role,
      u.skills
    FROM users u
    WHERE LOWER(TRIM(u.role)) NOT IN ('me', 'tme', 'admin', 'hr', 'accounts')
      AND ${getActiveUserEmploymentStatusSql("u")}
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
  const employmentStatusFilter = normalizeUserEmploymentStatus(
    req.query.employmentStatus || req.query.employment_status,
    "active",
  );
  const companyScopeFilter = normalizeCompanyScopeKey(
    req.query.companyScope || req.query.company_scope || req.query.company,
  );
  const companyScopeSql = getUserCompanyScopeSql("u");
  const employmentStatusWhereSql =
    employmentStatusFilter === "all"
      ? ""
      : "AND COALESCE(NULLIF(LOWER(TRIM(u.employment_status)), ''), 'active') = ?";
  const companyScopeWhereSql = companyScopeFilter
    ? `AND ${companyScopeSql} = ?`
    : "";
  const params = [];
  if (employmentStatusFilter !== "all") params.push(employmentStatusFilter);
  if (companyScopeFilter) params.push(companyScopeFilter);
  const sql = `
      SELECT
        u.id,
        u.name,
        u.email,
        u.role,
        u.prof_img,
        u.comp_name,
        COALESCE(NULLIF(LOWER(TRIM(u.employment_status)), ''), 'active') AS employment_status,
        DATE_FORMAT(u.deactivated_at, '%Y-%m-%d %H:%i:%s') AS deactivated_at,
        DATE_FORMAT(u.reactivated_at, '%Y-%m-%d %H:%i:%s') AS reactivated_at,
        u.profile_setup_status,
        DATE_FORMAT(u.profile_setup_expires_at, '%Y-%m-%d %H:%i:%s') AS profile_setup_expires_at,
        DATE_FORMAT(u.profile_setup_completed_at, '%Y-%m-%d %H:%i:%s') AS profile_setup_completed_at,
        COUNT(DISTINCT l.id) AS total_leads,
        SUM(CASE WHEN l.action_type = 'appointment' THEN 1 ELSE 0 END) AS total_appointments,
        SUM(CASE WHEN l.action_type = 'followup' THEN 1 ELSE 0 END) AS total_followups,
        CASE WHEN lt.user_id IS NOT NULL THEN 1 ELSE 0 END AS is_on_leave_today,
        lt.leave_type AS today_leave_type
      FROM users u
      LEFT JOIN leads l ON l.assign_emp_id = u.id
      LEFT JOIN (
        SELECT
          lr.user_id,
          MAX(lr.leave_type) AS leave_type
        FROM leave_requests lr
        WHERE lr.status = 'approved'
          AND CURDATE() BETWEEN lr.from_date AND lr.to_date
        GROUP BY lr.user_id
      ) lt ON lt.user_id = u.id
      WHERE u.role != 'admin'
        ${employmentStatusWhereSql}
        ${companyScopeWhereSql}
      GROUP BY
        u.id,
        u.name,
        u.email,
        u.role,
        u.prof_img,
        u.comp_name,
        u.employment_status,
        u.deactivated_at,
        u.reactivated_at,
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
    await ensureUserEmploymentStatusColumns();
    const [result] = await dbPromise.query(sql, params);
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
    res
      .status(500)
      .json({ success: false, message: "Failed to load team report" });
  }
});

app.post("/api/assign-project", async (req, res) => {
  let { projectId, userId, serviceType } = req.body;

  // normalize
  serviceType = (serviceType || "").toLowerCase().trim();

  if (!projectId || !userId || !serviceType) {
    return res.status(400).json({
      success: false,
      message: "projectId, userId and serviceType are required",
    });
  }

  try {
    await ensureUserEmploymentStatusColumns();
    const [activeUsers] = await dbPromise.query(
      `
        SELECT id
        FROM users
        WHERE id = ?
          AND ${getActiveUserEmploymentStatusSql()}
        LIMIT 1
      `,
      [userId],
    );

    if (!activeUsers.length) {
      return res.status(400).json({
        success: false,
        message: "Selected employee is inactive",
      });
    }
  } catch (err) {
    console.error("Project Assignment User Status Error:", err);
    return res.status(500).json({ success: false, message: "DB Error" });
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
) {
  if (!userId) {
    return res.status(400).json({
      success: false,
      message: "Invalid userId",
    });
  }

  try {
    await ensureProjectAssignmentWorkflowColumns();
    await ensureProjectPhaseDetailsTable();
    const leadProjectSql = await getLeadProjectSelectSql("l");
    const sql = `
      SELECT
        pa.id AS assignment_id,
        l.id AS project_id,
        ${leadProjectSql.selectSql},
        pa.service_type,
        pa.status,
        pa.stage,
        pa.progress,
        pa.assigned_at
      FROM project_assignments pa
      JOIN leads l ON pa.project_id = l.id
      WHERE pa.user_id = ?
      ORDER BY pa.assigned_at DESC
    `;

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

async function sendSeoProjectAssignments(userId, res) {
  if (!userId) {
    return res.status(400).json({
      success: false,
      message: "Invalid userId",
    });
  }

  try {
    await ensureProjectAssignmentWorkflowColumns();
    await ensureProjectPhaseDetailsTable();
    const leadProjectSql = await getLeadProjectSelectSql("l");
    const baseSelect = `
      SELECT
        pa.id AS assignment_id,
        l.id AS project_id,
        ${leadProjectSql.selectSql},
        pa.service_type,
        pa.status,
        pa.stage,
        pa.progress,
        pa.assigned_at
      FROM project_assignments pa
      JOIN leads l ON pa.project_id = l.id
    `;

    const [userRows] = await dbPromise.query(
      `
        ${baseSelect}
        WHERE pa.user_id = ?
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
                WHERE LOWER(TRIM(COALESCE(pa.service_type, ''))) = 'seo'
                ORDER BY pa.assigned_at DESC
              `,
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
    console.error("SEO Projects Fetch Error:", err);
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

  const leadProjectSql = await getLeadProjectSelectSql("l");
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
      ${leadProjectSql.selectSql}
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

    return (
      Number(right?.assignment_id || right?.id || 0) -
      Number(left?.assignment_id || left?.id || 0)
    );
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
    .filter(
      (assignmentId) => Number.isFinite(assignmentId) && assignmentId > 0,
    );
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
      status: normalizeProjectAssignmentStatus(sharedState?.status, row.status),
      stage: sharedState?.stage || row.stage || null,
      progress: clampProjectProgress(sharedState?.progress, row.progress || 0),
      assigned_at: row.assigned_at,
    };
  });
}

// ================= DEV PROJECTS =================
app.get("/api/dev/projects/:userId", async (req, res) => {
  const userId = parseInt(req.params.userId, 10);

  try {
    // Check if this user is a team lead
    const [userRows] = await dbPromise.query('SELECT is_team_lead, comp_name FROM users WHERE id = ?', [userId]);
    if (!userRows.length) return res.status(404).json({ success: false, message: 'User not found' });

    const { is_team_lead, comp_name } = userRows[0];

    if (!is_team_lead) {
      // Normal DEV — show only their own projects
      return sendProjectAssignmentsByUser(userId, res, "DEV Projects");
    }

    // Team Lead — show all DEVs' projects in same company
    await ensureProjectAssignmentWorkflowColumns();
    await ensureProjectPhaseDetailsTable();
    const leadProjectSql = await getLeadProjectSelectSql("l");

    const sql = `
      SELECT
        pa.id AS assignment_id,
        l.id AS project_id,
        ${leadProjectSql.selectSql},
        pa.service_type,
        pa.status,
        pa.stage,
        pa.progress,
        pa.assigned_at,
        pa.user_id AS assignee_id,
        u.name AS assignee_name
      FROM project_assignments pa
      JOIN leads l ON pa.project_id = l.id
      JOIN users u ON pa.user_id = u.id
      WHERE LOWER(TRIM(u.role)) = 'dev'
        AND u.comp_name = ?
      ORDER BY pa.assigned_at DESC
    `;

    const [rows] = await dbPromise.query(sql, [comp_name]);
    const projects = await mapRowsToSharedProjectAssignments(rows || []);

    return res.json({
      success: true,
      isTeamLead: true,
      assigned: projects.filter(p => p.status === "assigned"),
      ongoing: projects.filter(p => p.status === "ongoing"),
      completed: projects.filter(p => p.status === "completed"),
    });

  } catch (err) {
    console.error("DEV Projects Fetch Error:", err);
    return res.status(500).json({ success: false, message: "Database error" });
  }
});

// ================= DM PROJECTS =================
app.get("/api/dm/projects/:userId", (req, res) => {
  const userId = parseInt(req.params.userId, 10);
  sendProjectAssignmentsByUser(userId, res, "DM Projects");
});

// ================= SEO PROJECTS =================
app.get("/api/seo/projects/:userId", (req, res) => {
  const userId = parseInt(req.params.userId, 10);
  sendSeoProjectAssignments(userId, res);
});

app.get("/api/project-tracker", async (req, res) => {
  const scope = String(req.query.scope || req.query.role || "admin")
    .toLowerCase()
    .trim();
  const userId = Number(req.query.userId || 0);

  if (
    (scope === "me" || scope === "tme") &&
    (!Number.isFinite(userId) || userId <= 0)
  ) {
    return res.status(400).json({
      success: false,
      message: "Valid userId is required for this tracker scope",
    });
  }

  try {
    await ensureProjectAssignmentWorkflowColumns();
    await ensureProjectPhaseDetailsTable();

    const payload = await fetchProjectTrackerData(scope, userId);
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

    const sharedPhaseSnapshot =
      await getSharedProjectPhaseRowsForAssignment(assignment);

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

        const assignment = await getProjectAssignmentRecord(
          assignmentId,
          userId,
        );

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

        const attachments = files.map((file) => ({
          name: String(file.originalname || file.filename || "file").slice(
            0,
            255,
          ),
          url: `/uploads/project-phases/${file.filename}`.replace(/\\/g, "/"),
          type: String(file.mimetype || "").slice(0, 120),
          size: Number(file.size || 0),
          uploaded_at: new Date().toISOString(),
        }));

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
          message: err?.message || "Failed to upload project phase files",
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

    const sharedPhaseSnapshot =
      await getSharedProjectPhaseRowsForAssignment(assignment);

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

    const storedSnapshot =
      await getSharedProjectPhaseRowsForAssignment(assignment);

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
  const { assignment_id, project_id, stage, progress, status, service_type } =
    req.body;

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
      [stage, Number(progress || 0), status || "ongoing", targetIds],
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
    await ensureUserEmploymentStatusColumns();

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
        INNER JOIN users u ON u.id = pa.user_id
        WHERE ${getActiveUserEmploymentStatusSql("u")}
        GROUP BY pa.project_id
      ) pa_summary ON pa_summary.project_id = l.id
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
      INNER JOIN users u ON u.id = pa.user_id
      WHERE ${getActiveUserEmploymentStatusSql("u")}
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
            label:
              PROJECT_SERVICE_LABELS[serviceKey] || serviceKey.toUpperCase(),
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
    WHERE lead_status = 'deal_closed'
    AND pay_stat = 'received'
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

function getDealInvoiceTheme(lead = {}) {
  const companyScope =
    normalizeCompanyScopeKey(
      lead.company_scope ||
        lead.companyScope ||
        lead.company_scope_key ||
        lead.companyScopeKey ||
        lead.comp_name ||
        lead.compName,
    ) || "metrics";

  if (companyScope === "redsea") {
    return {
      companyScope,
      isRedsea: true,
      primaryColor: "#dc2626",
      proformaLogoFile: "logo_redsea_proforma.png",
      taxLogoFile: "logo1_redsea_tax.png",
      qrFile: "qr_redsea.png",
      bankLines: [
        "Account Holder: RED SEAS DIGITALS PRIVATE LIMITED",
        "Account Number: 50200109259621",
        "IFSC: HDFC0000975",
        "Branch: NOIDA SECTOR 63",
        "Account Type: Current Account",
      ],
    };
  }

  return {
    companyScope,
    isRedsea: false,
    primaryColor: "#0bb39c",
    proformaLogoFile: "logo.png",
    taxLogoFile: "logo1.jpeg",
    qrFile: "Qr.jpeg",
    bankLines: [
      "Bank: Kotak Mahindra Bank",
      "A/C: 5145057933",
      "IFSC: KKBK0001379",
    ],
  };
}

function drawDealInvoiceBankDetails(
  doc,
  invoiceTheme,
  margin,
  y,
  tableWidth,
) {
  const bankLines = Array.isArray(invoiceTheme.bankLines)
    ? invoiceTheme.bankLines
    : [];
  const textX = margin + 120;
  const textWidth = tableWidth - 140;

  doc.fontSize(8);
  bankLines.forEach((line, index) => {
    doc.text(line, textX, y + 15 + index * 16, { width: textWidth });
  });
}

function drawDealInvoiceCustomerDetails(doc, data = {}, margin, y, width) {
  const address = [
    data.flat_no,
    data.building_name,
    data.locality,
    data.city,
    data.pincode,
    data.state,
  ]
    .map((value) => String(value || "").trim())
    .filter(Boolean)
    .join(", ");
  const contentX = margin + 7;
  const contentWidth = width - 14;
  const details = [
    `Company: ${data.company_name || "N/A"}`,
    `Client Name: ${data.client_name || "N/A"}`,
    `Phone: ${data.telephone || data.contact || "N/A"}`,
    `Address: ${address || "N/A"}`,
  ];

  doc.fontSize(8);
  const lineGap = 3;
  const detailHeights = details.map((line) =>
    doc.heightOfString(line, { width: contentWidth }),
  );
  const boxHeight = Math.max(
    82,
    28 + detailHeights.reduce((sum, height) => sum + height + lineGap, 0),
  );

  doc.rect(margin, y, width, boxHeight).stroke();
  doc.fontSize(8).text("Customer Details:", contentX, y + 7);

  let cursorY = y + 22;
  details.forEach((line, index) => {
    doc.text(line, contentX, cursorY, { width: contentWidth });
    cursorY += detailHeights[index] + lineGap;
  });

  return boxHeight;
}

function getDealInvoiceServiceDescription(productName) {
  const canonicalName = resolveDealProductCatalogName(
    productName,
    DEAL_PRODUCT_PRICES,
  );

  return (
    DEAL_INVOICE_SERVICE_DESCRIPTIONS[canonicalName] ||
    DEAL_INVOICE_SERVICE_DESCRIPTIONS[String(productName || "").trim()] ||
    ""
  );
}

function formatDealInvoiceServiceLine(product = {}) {
  const name = String(
    product.product_name || product.name || product.service_name || "",
  )
    .trim()
    .replace(/\s+/g, " ");

  if (!name) return "";

  const description = getDealInvoiceServiceDescription(name);

  return description ? `- ${name}: ${description}` : `- ${name}`;
}

function buildDealInvoiceServiceDescription(products = []) {
  const serviceLines = (Array.isArray(products) ? products : [])
    .map(formatDealInvoiceServiceLine)
    .filter(Boolean);

  return [serviceLines.length ? "Selected Services:" : "", ...serviceLines]
    .filter(Boolean)
    .join("\n");
}

function getDealInvoiceItemCellParts(item = {}) {
  return {
    serviceText: String(item.description || "").trim(),
    paymentLabel: String(item.name || "").trim(),
    paymentDescription: String(item.paymentDescription || "").trim(),
  };
}

function getDealInvoiceItemCellHeight(doc, item, width, regularFont) {
  const { serviceText, paymentLabel, paymentDescription } =
    getDealInvoiceItemCellParts(item);
  let height = 0;

  if (serviceText) {
    doc.font(regularFont).fontSize(7);
    height += doc.heightOfString(serviceText, { width, lineGap: 1 });
  }

  if ((paymentLabel || paymentDescription) && height > 0) {
    height += 6;
  }

  if (paymentLabel) {
    doc.font("Helvetica-BoldOblique").fontSize(7);
    height += doc.heightOfString(paymentLabel, { width, lineGap: 1 });
  }

  if (paymentDescription) {
    doc.font("Helvetica-Oblique").fontSize(6.8);
    height += doc.heightOfString(paymentDescription, { width, lineGap: 1 });
  }

  doc.font(regularFont).fillColor("#000");
  return Math.ceil(height) + 12;
}

function drawDealInvoiceItemCell(doc, item, x, y, width, regularFont) {
  const { serviceText, paymentLabel, paymentDescription } =
    getDealInvoiceItemCellParts(item);
  let cursorY = y;

  if (serviceText) {
    doc.font(regularFont).fontSize(7).fillColor("#111827");
    doc.text(serviceText, x, cursorY, { width, lineGap: 1 });
    cursorY += doc.heightOfString(serviceText, { width, lineGap: 1 }) + 6;
  }

  if (paymentLabel) {
    doc.font("Helvetica-BoldOblique").fontSize(7).fillColor("#334155");
    doc.text(paymentLabel, x, cursorY, { width, lineGap: 1 });
    cursorY += doc.heightOfString(paymentLabel, { width, lineGap: 1 });
  }

  if (paymentDescription) {
    doc.font("Helvetica-Oblique").fontSize(6.8).fillColor("#64748b");
    doc.text(paymentDescription, x, cursorY, { width, lineGap: 1 });
  }

  doc.font(regularFont).fontSize(8).fillColor("#000");
}

async function getInvoicePaymentContext(
  leadId,
  query = {},
  invoiceType = "proforma",
) {
  await ensureDealPaymentSchema();

  const [leadRows] = await dbPromise.query(
    `
      SELECT
        l.*,
        DATE_FORMAT(l.payment_date, '%Y-%m-%d') AS payment_date,
        DATE_FORMAT(l.closed_date, '%Y-%m-%d') AS closed_date
      FROM leads l
      WHERE l.id = ?
      LIMIT 1
    `,
    [leadId],
  );

  if (!leadRows.length) {
    const error = new Error("Lead not found");
    error.statusCode = 404;
    throw error;
  }

  const lead = leadRows[0];
  const paymentId = Number(query.paymentId || 0);
  let grossAmount = 0;
  let paymentDate = "";
  let label = "Down Payment";
  let description = "First payment received at deal closure";
  let invoiceNumberSuffix = String(leadId);

  if (paymentId > 0) {
    const [paymentRows] = await dbPromise.query(
      `
        SELECT
          id,
          payment_label,
          payment_type,
          renewal_service_name,
          DATE_FORMAT(renewal_cycle_start_date, '%Y-%m-%d') AS renewal_cycle_start_date,
          amount,
          DATE_FORMAT(payment_date, '%Y-%m-%d') AS payment_date,
          payment_status
        FROM deal_payments
        WHERE id = ?
          AND lead_id = ?
        LIMIT 1
      `,
      [paymentId, leadId],
    );

    if (!paymentRows.length) {
      const error = new Error("Payment not found");
      error.statusCode = 404;
      throw error;
    }

    const payment = paymentRows[0];
    if (
      invoiceType === "tax" &&
      normalizeServerPaymentStatus(payment.payment_status) !== "received"
    ) {
      const error = new Error(
        "Invoice is available only after payment is received",
      );
      error.statusCode = 400;
      throw error;
    }

    grossAmount = roundServerAmount(payment.amount);
    paymentDate = getServerDateKey(payment.payment_date);
    label = payment.payment_label || `Installment #${paymentId}`;
    if (normalizeServerDealPaymentType(payment.payment_type) === "renewal") {
      const renewalServiceName =
        payment.renewal_service_name ||
        String(payment.payment_label || "").replace(/^Renewal\s*-\s*/i, "");
      const cycleDate = getServerDateKey(payment.renewal_cycle_start_date);
      description = `Renewal payment for ${renewalServiceName || "service"}${
        cycleDate ? ` cycle ${cycleDate}` : ""
      }`;
    } else {
      description = "Installment payment as per agreed schedule";
    }
    invoiceNumberSuffix = `${leadId}-${paymentId}`;
  } else {
    const [payments] = await dbPromise.query(
      "SELECT amount, payment_status, payment_type FROM deal_payments WHERE lead_id = ?",
      [leadId],
    );
    grossAmount = getServerLeadDownPaymentAmount(lead, payments);
    paymentDate = getServerDateKey(lead.payment_date || lead.closed_date);
  }

  if (grossAmount <= 0 || !paymentDate) {
    const error = new Error(
      "Invoice is available only after a received payment with date",
    );
    error.statusCode = 400;
    throw error;
  }

  const proformaDate = paymentDate;
  const taxInvoiceDate = paymentDate;
  const [dealProducts] = await getDealProductsForInvoice(leadId);
  const invoiceDescription = buildDealInvoiceServiceDescription(dealProducts);

  if (
    invoiceType === "tax" &&
    paymentId <= 0 &&
    normalizeServerPaymentStatus(lead.pay_stat, "pending") !== "received"
  ) {
    const error = new Error(
      "Tax invoice is available only after payment status is marked received",
    );
    error.statusCode = 403;
    throw error;
  }

  return {
    lead,
    grossAmount,
    taxableAmount: roundServerAmount(grossAmount / 1.18),
    paymentDate,
    proformaDate,
    taxInvoiceDate,
    label,
    description: invoiceDescription,
    paymentDescription: description,
    dealProducts,
    invoiceNumberSuffix,
    fileSuffix: invoiceNumberSuffix.replace(/[^a-zA-Z0-9_-]/g, "_"),
  };
}
   
async function getServiceRenewalInvoiceContext(renewalId, query = {}) {
  await ensureDealServiceRenewalTables();
  await syncDueServiceRenewals();

  const [rows] = await dbPromise.query(
    `
      SELECT
        r.id AS renewal_id,
        r.lead_id,
        r.service_name,
        r.renewal_basis,
        r.status,
        DATE_FORMAT(r.first_start_date, '%Y-%m-%d') AS first_start_date,
        DATE_FORMAT(r.current_start_date, '%Y-%m-%d') AS current_start_date,
        DATE_FORMAT(r.next_start_date, '%Y-%m-%d') AS next_start_date,
        l.company_name,
        l.client_name,
        l.contact,
        l.locality,
        l.city,
        l.deal_amount,
        COALESCE(p.service_amount, 0) AS service_amount
      FROM deal_service_renewals r
      INNER JOIN leads l ON l.id = r.lead_id
      LEFT JOIN (
        SELECT
          d.lead_id,
          dp.product_name AS service_name,
          SUM(dp.product_amount) AS service_amount
        FROM deals d
        INNER JOIN deal_products dp ON dp.deal_id = d.id
        GROUP BY d.lead_id, dp.product_name
      ) p ON p.lead_id = r.lead_id AND p.service_name = r.service_name
      WHERE r.id = ?
        AND l.lead_status = 'deal_closed'
      LIMIT 1
    `,
    [renewalId],
  );

  if (!rows.length) {
    const error = new Error("Renewal schedule not found");
    error.statusCode = 404;
    throw error;
  }

  const renewal = rows[0];
  if (isNonRenewableService(renewal.service_name)) {
    const error = new Error("Profile Creation does not need renewal invoice");
    error.statusCode = 400;
    throw error;
  }

  const basis = normalizeServiceRenewalBasis(
    renewal.renewal_basis,
    renewal.service_name,
  );
  const cycleStartDate =
    getServerDateKey(query.cycleStart || query.startDate) ||
    getServerDateKey(renewal.current_start_date) ||
    getServerDateKey(renewal.first_start_date) ||
    getServerDateKey(renewal.next_start_date);
  const cycleEndDate = getServiceRenewalCycleEndDate(cycleStartDate, basis);
  const grossAmount = roundServerAmount(renewal.service_amount);

  if (!cycleStartDate || !cycleEndDate) {
    const error = new Error("Renewal cycle date is not available");
    error.statusCode = 400;
    throw error;
  }

  if (grossAmount <= 0) {
    const error = new Error("Renewal invoice amount is not available");
    error.statusCode = 400;
    throw error;
  }

  const basisLabel = SERVICE_RENEWAL_BASIS_LABELS[basis] || basis;
  const invoiceNumberSuffix = `${renewal.lead_id}-R${renewal.renewal_id}-${cycleStartDate.replace(/-/g, "")}`;

  return {
    lead: renewal,
    renewalId: Number(renewal.renewal_id || 0),
    serviceName: renewal.service_name,
    basis,
    basisLabel,
    cycleStartDate,
    cycleEndDate,
    grossAmount,
    taxableAmount: roundServerAmount(grossAmount / 1.18),
    label: `${basisLabel} Renewal - ${renewal.service_name}`,
    description: `${renewal.service_name} renewal from ${formatServerInvoiceDate(cycleStartDate)} to ${formatServerInvoiceDate(cycleEndDate)}`,
    invoiceNumberSuffix,
    fileSuffix: invoiceNumberSuffix.replace(/[^a-zA-Z0-9_-]/g, "_"),
  };
}
      
      
function renderServiceRenewalInvoicePdf(res, invoiceContext, invoiceType) {
  const isTaxInvoice = invoiceType === "tax";
  const PDFDocument = require("pdfkit");
  const path = require("path");
  const converter = require("number-to-words");

  const doc = new PDFDocument({ size: "A4", margin: 40 });
  const invoicePrefix = isTaxInvoice ? "RTI" : "RPFI";
  const filePrefix = isTaxInvoice ? "renewal_tax_invoice" : "renewal_proforma_invoice";

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename=${filePrefix}_${invoiceContext.fileSuffix}.pdf`,
  );

  doc.pipe(res);

  const data = invoiceContext.lead;
  const pageWidth = doc.page.width;
  const margin = doc.page.margins.left;
  const tableWidth = pageWidth - margin * 2;
  const logoPath = path.join(__dirname, isTaxInvoice ? "logo1.jpeg" : "logo.png");
  const qrPath = path.join(__dirname, "Qr.jpeg");
  const fontPath = path.join(__dirname, "fonts/NotoSans-Regular.ttf");
  doc.font(fontPath);
  const RS = "\u20B9";

  let y = 150;
  if (isTaxInvoice) {
    const logoHeight = 140;
    try {
      doc.image(logoPath, margin - 22, 0, {
        width: pageWidth - (margin - 15),
        height: logoHeight,
      });
    } catch {}
    y = logoHeight + 10;
  } else {
    try {
      doc.image(logoPath, margin, 20, {
        width: tableWidth,
      });
    } catch {}
  }

  doc.fontSize(9).text("METRICSMART INFOLINE PRIVATE LIMITED", margin, y);
  doc.text("GSTIN: 27AANCM9265F1ZY", margin, y + 12);
  doc.text("Mumbai, Maharashtra - 400104", margin, y + 24);

  doc.text(`Invoice #: ${invoicePrefix}-${invoiceContext.invoiceNumberSuffix}`, 350, y);
  doc.text(
    `Date: ${formatServerInvoiceDate(invoiceContext.cycleStartDate)}`,
    350,
    y + 12,
  );
  doc.text(
    `Due Date: ${formatServerInvoiceDate(invoiceContext.cycleStartDate)}`,
    350,
    y + 24,
  );

  y += 60;

  doc.rect(margin, y, tableWidth, 60).stroke();
  doc.text("Customer Details:", margin + 5, y + 5);
  doc.text(data.company_name || "", margin + 5, y + 20);
  doc.text(data.client_name || "", 200, y + 20);
  doc.text(`Ph: ${data.contact || ""}`, 350, y + 20);
  doc.text(`${data.locality || ""}, ${data.city || ""}`, margin + 5, y + 35);

  y += 80;

  const tableX = margin;
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

  const invoiceItems = [
    {
      name: invoiceContext.label,
      description: invoiceContext.description,
      amount: invoiceContext.taxableAmount,
    },
  ];
  const amount = invoiceItems.reduce((sum, item) => sum + item.amount, 0);

  invoiceItems.forEach((item, i) => {
    const text = item.description
      ? `${item.name}\n${item.description}`
      : item.name;
    const lineTax = item.amount * 0.18;
    const lineTotal = item.amount + lineTax;
    const textHeight = doc.heightOfString(text, { width: 150 });
    const rowHeight = Math.max(34, textHeight + 10);

    doc.rect(tableX, y, tableWidth, rowHeight).stroke();
    doc
      .fontSize(8)
      .text(i + 1, tableX + 5, y + 5)
      .text(text, itemX, y + 5, { width: 170 })
      .text(formatMoney(item.amount), rateX, y + 5, {
        width: 70,
        align: "right",
      })
      .text("1", qtyX, y + 5, { width: 30, align: "right" })
      .text(formatMoney(item.amount), taxableX, y + 5, {
        width: 65,
        align: "right",
      })
      .text(`${formatMoney(lineTax)} (18%)`, taxX, y + 5, {
        width: 65,
        align: "right",
      })
      .text(formatMoney(lineTotal), amountX, y + 5, {
        width: 50,
        align: "right",
      });

    y += rowHeight;
  });

  const taxable = amount;
  const cgst = taxable * 0.09;
  const sgst = taxable * 0.09;
  const totalWithTax = taxable + cgst + sgst;

  y += 20;

  doc.text("Taxable Amount", 330, y, { width: 90, align: "right" });
  doc.text(`${RS}${formatMoney(taxable)}`, 430, y, {
    width: 90,
    align: "right",
  });
  doc.text("CGST 9.0%", 330, y + 12, { width: 90, align: "right" });
  doc.text(`${RS}${formatMoney(cgst)}`, 430, y + 12, {
    width: 90,
    align: "right",
  });
  doc.text("SGST 9.0%", 330, y + 24, { width: 90, align: "right" });
  doc.text(`${RS}${formatMoney(sgst)}`, 430, y + 24, {
    width: 90,
    align: "right",
  });
  doc.fontSize(10).text("Total", 330, y + 42, { width: 90, align: "right" });
  doc.text(`${RS}${formatMoney(totalWithTax)}`, 430, y + 42, {
    width: 90,
    align: "right",
  });

  doc
    .fontSize(8)
    .text(
      `In Words: ${converter.toWords(totalWithTax)} Rupees Only`,
      margin,
      y + 20,
    );

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

  y += 130;
  doc.fontSize(9).text("Notes:", margin, y);
  doc
    .fontSize(8)
    .text(
      `${invoiceContext.basisLabel} renewal invoice for ${invoiceContext.serviceName}.`,
      margin,
      y + 15,
    )
    .text(
      `Renewal period: ${formatServerInvoiceDate(invoiceContext.cycleStartDate)} to ${formatServerInvoiceDate(invoiceContext.cycleEndDate)}.`,
      margin,
      y + 30,
    );

  doc.end();
}
      
      

app.get("/api/invoice/:id", (req, res) => {
  const leadId = req.params.id;

  const sql = `SELECT * FROM leads WHERE id = ?`;

  db.query(sql, [leadId], async (err, result) => {
    if (err || result.length === 0) {
      return res.status(404).send("Lead not found");
    }

    let invoiceContext;
    try {
      invoiceContext = await getInvoicePaymentContext(
        leadId,
        req.query,
        "proforma",
      );
    } catch (invoiceErr) {
      return res
        .status(invoiceErr.statusCode || 500)
        .send(invoiceErr.message || "Failed to prepare invoice");
    }

    const data = invoiceContext.lead;
    const invoiceTheme = getDealInvoiceTheme(data);
    const invoiceItems = [
      {
        name: invoiceContext.label,
        description: invoiceContext.description,
        paymentDescription: invoiceContext.paymentDescription,
        amount: invoiceContext.taxableAmount,
      },
    ];

    const PDFDocument = require("pdfkit");
    const path = require("path");
    const converter = require("number-to-words");

    const doc = new PDFDocument({ size: "A4", margin: 40 });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=proforma_invoice_${invoiceContext.fileSuffix}.pdf`,
    );

    doc.pipe(res);

    const pageWidth = doc.page.width;
    const margin = doc.page.margins.left;

    const logoPath = path.join(__dirname, invoiceTheme.proformaLogoFile);
    const qrPath = path.join(__dirname, invoiceTheme.qrFile);
    const fontPath = path.join(__dirname, "fonts/NotoSans-Regular.ttf");
    doc.font(fontPath);
    const RS = "\u20B9";

    // ================= LOGO =================
    try {
      doc.image(logoPath, margin, 20, {
        width: pageWidth - margin * 2,
      });
    } catch {}

    let y = 150;

    // ================= COMPANY + INVOICE =================
    if (invoiceTheme.isRedsea) {
      doc.fontSize(8).text(
        `Invoice #: PFI-${invoiceContext.invoiceNumberSuffix} | Date: ${formatServerInvoiceDate(invoiceContext.proformaDate)} | Due Date: ${formatServerInvoiceDate(invoiceContext.proformaDate)}`,
        margin,
        y,
        { width: pageWidth - margin * 2, align: "right" },
      );
      y += 28;
    } else {
      doc.fontSize(9).text("METRICSMART INFOLINE PRIVATE LIMITED", margin, y);
      doc.text("GSTIN: 27AANCM9265F1ZY", margin, y + 12);
      doc.text("Mumbai, Maharashtra - 400104", margin, y + 24);

      doc.text(`Invoice #: PFI-${invoiceContext.invoiceNumberSuffix}`, 350, y);
      doc.text(
        `Date: ${formatServerInvoiceDate(invoiceContext.proformaDate)}`,
        350,
        y + 12,
      );
      doc.text(
        `Due Date: ${formatServerInvoiceDate(invoiceContext.proformaDate)}`,
        350,
        y + 24,
      );

      y += 60;
    }

    // ================= CUSTOMER =================
    const customerBoxHeight = drawDealInvoiceCustomerDetails(
      doc,
      data,
      margin,
      y,
      pageWidth - margin * 2,
    );

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
    const itemWidth = 170;

    doc.rect(tableX, y, tableWidth, 20).fill(invoiceTheme.primaryColor);

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
      const lineTax = item.amount * 0.18;
      const lineTotal = item.amount + lineTax;

      // 👇 calculate height for item + desc
      const rowHeight = Math.max(
        30,
        getDealInvoiceItemCellHeight(doc, item, itemWidth, fontPath),
      );

      doc.rect(tableX, y, tableWidth, rowHeight).stroke();

      doc
        .fontSize(8)
        .text(i + 1, tableX + 5, y + 5);

      drawDealInvoiceItemCell(doc, item, itemX, y + 5, itemWidth, fontPath);

      doc
        .fontSize(8)
        .text(formatMoney(item.amount), rateX, y + 5, {
          width: 70,
          align: "right",
        })
        .text("1", qtyX, y + 5, { width: 30, align: "right" })
        .text(formatMoney(item.amount), taxableX, y + 5, {
          width: 65,
          align: "right",
        })
        .text(`${formatMoney(lineTax)} (18%)`, taxX, y + 5, {
          width: 65,
          align: "right",
        })
        .text(formatMoney(lineTotal), amountX, y + 5, {
          width: 50,
          align: "right",
        });

      y += rowHeight;
    });

    // ================= TOTAL =================
    const taxable = amount;
    const cgst = taxable * 0.09;
    const sgst = taxable * 0.09;
    const totalWithTax = taxable + cgst + sgst;

    y += 20;

    doc.text("Taxable Amount", 330, y, { width: 90, align: "right" });
    doc.text(`${RS}${formatMoney(taxable)}`, 430, y, {
      width: 90,
      align: "right",
    });
    doc.text("CGST 9.0%", 330, y + 12, { width: 90, align: "right" });
    doc.text(`${RS}${formatMoney(cgst)}`, 430, y + 12, {
      width: 90,
      align: "right",
    });
    doc.text("SGST 9.0%", 330, y + 24, { width: 90, align: "right" });
    doc.text(`${RS}${formatMoney(sgst)}`, 430, y + 24, {
      width: 90,
      align: "right",
    });

    doc.fontSize(10).text("Total", 330, y + 42, { width: 90, align: "right" });
    doc.text(`${RS}${formatMoney(totalWithTax)}`, 430, y + 42, {
      width: 90,
      align: "right",
    });

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
      doc.image(qrPath, margin + 10, y + 10, {
        width: 90,
      });
    } catch {}

    drawDealInvoiceBankDetails(doc, invoiceTheme, margin, y, tableWidth);

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

    let invoiceContext;
    try {
      invoiceContext = await getInvoicePaymentContext(leadId, req.query, "tax");
    } catch (invoiceErr) {
      return res
        .status(invoiceErr.statusCode || 500)
        .send(invoiceErr.message || "Failed to prepare tax invoice");
    }

    const data = invoiceContext.lead;
    const invoiceTheme = getDealInvoiceTheme(data);
    const invoiceItems = [
      {
        name: invoiceContext.label,
        description: invoiceContext.description,
        paymentDescription: invoiceContext.paymentDescription,
        amount: invoiceContext.taxableAmount,
      },
    ];

    const PDFDocument = require("pdfkit");
    const path = require("path");
    const converter = require("number-to-words");

    const doc = new PDFDocument({ size: "A4", margin: 40 });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=tax_invoice_${invoiceContext.fileSuffix}.pdf`,
    );

    doc.pipe(res);

    const pageWidth = doc.page.width;
    const margin = doc.page.margins.left;

    const logoPath = path.join(__dirname, invoiceTheme.taxLogoFile);
    const qrPath = path.join(__dirname, invoiceTheme.qrFile);
    const fontPath = path.join(__dirname, "fonts/NotoSans-Regular.ttf");

    doc.font(fontPath);
    const RS = "\u20B9";

    // ================= LOGO (ONLY ONCE) =================
    let logoHeight = 140;

    try {
      if (invoiceTheme.isRedsea) {
        doc.image(logoPath, margin, 20, {
          width: pageWidth - margin * 2,
        });
      } else {
        doc.image(logoPath, margin - 22, 0, {
          width: pageWidth - (margin - 15),
          height: logoHeight,
        });
      }
    } catch {}

    // 🔥 start content after logo
    let y = invoiceTheme.isRedsea ? 150 : logoHeight + 10;

    // ================= COMPANY + INVOICE INFO =================
    if (invoiceTheme.isRedsea) {
      doc.fontSize(8).text(
        `Invoice #: TI-${invoiceContext.invoiceNumberSuffix} | Date: ${formatServerInvoiceDate(invoiceContext.taxInvoiceDate)} | Due Date: ${formatServerInvoiceDate(invoiceContext.taxInvoiceDate)}`,
        margin,
        y,
        { width: pageWidth - margin * 2, align: "right" },
      );
      y += 28;
    } else {
      doc.fontSize(9).text("METRICSMART INFOLINE PRIVATE LIMITED", margin, y);
      doc.text("GSTIN: 27AANCM9265F1ZY", margin, y + 12);
      doc.text("Mumbai, Maharashtra - 400104", margin, y + 24);

      doc.text(`Invoice #: TI-${invoiceContext.invoiceNumberSuffix}`, 350, y);
      doc.text(
        `Date: ${formatServerInvoiceDate(invoiceContext.taxInvoiceDate)}`,
        350,
        y + 12,
      );
      doc.text(
        `Due Date: ${formatServerInvoiceDate(invoiceContext.taxInvoiceDate)}`,
        350,
        y + 24,
      );

      y += 60;
    }

    // ================= CUSTOMER =================
    const customerBoxHeight = drawDealInvoiceCustomerDetails(
      doc,
      data,
      margin,
      y,
      pageWidth - margin * 2,
    );

    y += customerBoxHeight + 20;

    // ================= TABLE HEADER =================
    const tableX = margin;
    const tableWidth = pageWidth - margin * 2;
    const itemX = tableX + 25;
    const rateX = tableX + 205;
    const qtyX = tableX + 285;
    const taxableX = tableX + 325;
    const taxX = tableX + 395;
    const amountX = tableX + 465;
    const itemWidth = 170;

    doc.rect(tableX, y, tableWidth, 20).fill(invoiceTheme.primaryColor);

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
      const lineTax = item.amount * 0.18;
      const lineTotal = item.amount + lineTax;

      const rowHeight = Math.max(
        30,
        getDealInvoiceItemCellHeight(doc, item, itemWidth, fontPath),
      );

      doc.rect(tableX, y, tableWidth, rowHeight).stroke();

      doc
        .fontSize(8)
        .text(i + 1, tableX + 5, y + 5);

      drawDealInvoiceItemCell(doc, item, itemX, y + 5, itemWidth, fontPath);

      doc
        .fontSize(8)
        .text(formatMoney(item.amount), rateX, y + 5, {
          width: 70,
          align: "right",
        })
        .text("1", qtyX, y + 5, { width: 30, align: "right" })
        .text(formatMoney(item.amount), taxableX, y + 5, {
          width: 65,
          align: "right",
        })
        .text(`${formatMoney(lineTax)} (18%)`, taxX, y + 5, {
          width: 65,
          align: "right",
        })
        .text(formatMoney(lineTotal), amountX, y + 5, {
          width: 50,
          align: "right",
        });

      y += rowHeight;
    });

    // ================= TOTAL =================
    const taxable = amount;
    const cgst = taxable * 0.09;
    const sgst = taxable * 0.09;
    const totalWithTax = taxable + cgst + sgst;

    y += 20;

    doc.text("Taxable Amount", 330, y, { width: 90, align: "right" });
    doc.text(`${RS}${formatMoney(taxable)}`, 430, y, {
      width: 90,
      align: "right",
    });
    doc.text("CGST 9.0%", 330, y + 12, { width: 90, align: "right" });
    doc.text(`${RS}${formatMoney(cgst)}`, 430, y + 12, {
      width: 90,
      align: "right",
    });
    doc.text("SGST 9.0%", 330, y + 24, { width: 90, align: "right" });
    doc.text(`${RS}${formatMoney(sgst)}`, 430, y + 24, {
      width: 90,
      align: "right",
    });

    doc.fontSize(10).text("Total", 330, y + 42, { width: 90, align: "right" });
    doc.text(`${RS}${formatMoney(totalWithTax)}`, 430, y + 42, {
      width: 90,
      align: "right",
    });

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

    drawDealInvoiceBankDetails(doc, invoiceTheme, margin, y, tableWidth);

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

  const mailer = getProfileInviteMailerTransport();
  if (!mailer.configured || !mailer.transport) {
    return res.status(503).json({
      success: false,
      message:
        mailer.reason ||
        "Automatic email is not configured on the server yet. Please add SMTP settings first.",
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
    const companyLabel = String(
      lead.company_name || lead.client_name || `Lead ${leadId}`,
    ).trim();
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

    await mailer.transport.sendMail({
      from: mailer.from,
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

    return res.json({
      success: true,
      message: `${invoiceLabel} PDF emailed successfully to ${toEmail}.`,
    });
  } catch (error) {
    console.error("Invoice email send failed:", error);
    return res.status(500).json({
      success: false,
      message: error?.message || "Failed to send invoice email attachment",
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
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } =
    req.body || {};

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

  // Ensure ads_daily_work table
async function ensureAdsDailyWorkTable() {
  await dbPromise.query(`
    CREATE TABLE IF NOT EXISTS seo_logins (
      id INT AUTO_INCREMENT PRIMARY KEY,
      assignment_id INT NOT NULL,
      project_id INT,
      platform_name VARCHAR(255),
      login_url VARCHAR(255),
      username VARCHAR(255),
      password VARCHAR(255),
      notes TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (assignment_id) REFERENCES project_assignments(id) ON DELETE CASCADE
    )
  `);
  await dbPromise.query(`
    CREATE TABLE IF NOT EXISTS seo_keywords (
      id INT AUTO_INCREMENT PRIMARY KEY,
      assignment_id INT NOT NULL,
      project_id INT,
      keyword VARCHAR(255),
      target_url VARCHAR(255),
      search_volume VARCHAR(100),
      target_rank VARCHAR(100),
      current_rank VARCHAR(100),
      status VARCHAR(100),
      notes TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (assignment_id) REFERENCES project_assignments(id) ON DELETE CASCADE
    )
  `);
  await dbPromise.query(`
    CREATE TABLE IF NOT EXISTS seo_reports (
      id INT AUTO_INCREMENT PRIMARY KEY,
      assignment_id INT NOT NULL,
      project_id INT,
      title VARCHAR(255),
      report_date DATE,
      file_url VARCHAR(500),
      remarks TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (assignment_id) REFERENCES project_assignments(id) ON DELETE CASCADE
    )
  `);
  await dbPromise.query(`
    CREATE TABLE IF NOT EXISTS seo_daily_work (
      id INT AUTO_INCREMENT PRIMARY KEY,
      assignment_id INT NOT NULL,
      employee_id INT,
      work_date DATE NOT NULL,
      seo_type VARCHAR(100),
      work_category VARCHAR(100),
      task VARCHAR(255),
      page_url VARCHAR(255),
      description TEXT,
      result VARCHAR(255),
      status VARCHAR(50) DEFAULT 'In Progress',
      remarks TEXT,
      time_spent VARCHAR(50),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (assignment_id) REFERENCES project_assignments(id) ON DELETE CASCADE
    )
  `);
  await dbPromise.query(`
    CREATE TABLE IF NOT EXISTS ads_daily_work (
      id INT AUTO_INCREMENT PRIMARY KEY,
      employee_id INT,
      role_snapshot VARCHAR(50),
      work_date DATE,
      client_or_project VARCHAR(255),
      status VARCHAR(50) DEFAULT 'pending',
      remarks TEXT,
      description TEXT,
      work_details JSON,
      assignment_id INT,
      platform VARCHAR(100),
      campaign_name VARCHAR(255),
      work_type VARCHAR(100),
      urls TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (employee_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // Add columns that may be missing on older tables
  const addCols = [
    ["work_details", "JSON"],
    ["role_snapshot", "VARCHAR(50)"],
    ["client_or_project", "VARCHAR(255)"],
  ];
  for (const [col, type] of addCols) {
    try {
      await dbPromise.query(`ALTER TABLE ads_daily_work ADD COLUMN ${col} ${type}`);
    } catch (e) {
      // Column already exists - ignore
    }
  }
}

  app.get("/api/seo-assignments/:assignmentId/logins", async (req, res) => {
    try {
      const [rows] = await dbPromise.query("SELECT * FROM seo_logins WHERE assignment_id = ?", [req.params.assignmentId]);
      res.json({ success: true, data: rows });
    } catch (err) {
      res.status(500).json({ success: false, message: "Database error" });
    }
  });
  
  app.post("/api/seo-assignments/:assignmentId/logins", async (req, res) => {
    try {
      const { platform_name, login_url, username, password, notes, project_id } = req.body;
      await dbPromise.query(
        "INSERT INTO seo_logins (assignment_id, project_id, platform_name, login_url, username, password, notes) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [req.params.assignmentId, project_id, platform_name, login_url, username, password, notes]
      );
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ success: false, message: "Database error" });
    }
  });
  
  app.delete("/api/seo-logins/:id", async (req, res) => {
    try {
      await dbPromise.query("DELETE FROM seo_logins WHERE id = ?", [req.params.id]);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ success: false, message: "Database error" });
    }
  });
  
  app.get("/api/seo-assignments/:assignmentId/keywords", async (req, res) => {
    try {
      const [rows] = await dbPromise.query("SELECT * FROM seo_keywords WHERE assignment_id = ?", [req.params.assignmentId]);
      res.json({ success: true, data: rows });
    } catch (err) {
      res.status(500).json({ success: false, message: "Database error" });
    }
  });
  
  app.post("/api/seo-assignments/:assignmentId/keywords", async (req, res) => {
    try {
      const { keyword, target_url, search_volume, target_rank, current_rank, status, notes, project_id } = req.body;
      await dbPromise.query(
        "INSERT INTO seo_keywords (assignment_id, project_id, keyword, target_url, search_volume, target_rank, current_rank, status, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [req.params.assignmentId, project_id, keyword, target_url, search_volume, target_rank, current_rank, status, notes]
      );
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ success: false, message: "Database error" });
    }
  });
  
  app.delete("/api/seo-keywords/:id", async (req, res) => {
    try {
      await dbPromise.query("DELETE FROM seo_keywords WHERE id = ?", [req.params.id]);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ success: false, message: "Database error" });
    }
  });
  
  app.get("/api/seo-assignments/:assignmentId/reports", async (req, res) => {
    try {
      const [rows] = await dbPromise.query("SELECT * FROM seo_reports WHERE assignment_id = ?", [req.params.assignmentId]);
      res.json({ success: true, data: rows });
    } catch (err) {
      res.status(500).json({ success: false, message: "Database error" });
    }
  });
  
  app.post("/api/seo-assignments/:assignmentId/reports", async (req, res) => {
    try {
      const { title, report_date, file_url, remarks, project_id } = req.body;
      await dbPromise.query(
        "INSERT INTO seo_reports (assignment_id, project_id, title, report_date, file_url, remarks) VALUES (?, ?, ?, ?, ?, ?)",
        [req.params.assignmentId, project_id, title, report_date, file_url, remarks]
      );
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ success: false, message: "Database error" });
    }
  });
  
  app.delete("/api/seo-reports/:id", async (req, res) => {
    try {
      await dbPromise.query("DELETE FROM seo_reports WHERE id = ?", [req.params.id]);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ success: false, message: "Database error" });
    }
  });
  
  app.get("/api/seo-daily-work/:assignmentId", async (req, res) => {
    try {
      const [rows] = await dbPromise.query("SELECT * FROM seo_daily_work WHERE seo_assignment_id = ? ORDER BY work_date DESC", [req.params.assignmentId]);
      res.json({ success: true, data: rows });
    } catch (err) {
      res.status(500).json({ success: false, message: "Database error" });
    }
  });
  
  app.post("/api/seo-daily-work", async (req, res) => {
    try {
      const { seo_assignment_id, employee_id, work_date, seo_type, work_category, task, page_url, description, result, status, remarks, time_spent } = req.body;
      const [insert] = await dbPromise.query(
        "INSERT INTO seo_daily_work (seo_assignment_id, employee_id, work_date, seo_type, work_category, task, page_url, description, result, status, remarks, time_spent) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [seo_assignment_id || req.body.assignment_id, employee_id, work_date, seo_type, work_category, task, page_url, description, result, status || 'In Progress', remarks, time_spent]
      );
      res.json({ success: true, id: insert.insertId });
    } catch (err) {
      console.error("POST /api/seo-daily-work error:", err);
      res.status(500).json({ success: false, message: "Database error" });
    }
  });
  
  app.delete("/api/seo-daily-work/:id", async (req, res) => {
    try {
      await dbPromise.query("DELETE FROM seo_daily_work WHERE id = ?", [req.params.id]);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ success: false, message: "Database error" });
    }
  });
  
  startupSchemaTasks.push({ label: "Ads Daily Work Table", task: ensureAdsDailyWorkTable });

  app.get("/api/employee-seo-assignments/:userId", async (req, res) => {
    try {
      const sql = `
        SELECT pa.id as assignment_id, pa.project_id as id, pa.status, pa.service_type, 
               l.client_name, l.company_name as project_name, 
               '' as sheet_url 
        FROM project_assignments pa 
        LEFT JOIN leads l ON pa.project_id = l.id 
        WHERE pa.user_id = ? AND pa.service_type = 'seo'
      `;
      const [rows] = await dbPromise.query(sql, [req.params.userId]);
      res.json({ success: true, data: rows, assigned: rows, ongoing: rows, completed: rows });
    } catch (err) {
      console.error('SEO Assignments API Error:', err);
      res.status(500).json({ success: false, message: "Database error: " + err.message });
    }
  });

  app.get("/api/employee-ads-assignments/:userId", async (req, res) => {
    try {
      const sql = `
        SELECT pa.id as assignment_id, pa.project_id as id, pa.status, pa.service_type, 
               l.client_name, l.company_name as project_name, 
               '' as sheet_url 
        FROM project_assignments pa 
        LEFT JOIN leads l ON pa.project_id = l.id 
        WHERE pa.user_id = ? AND pa.service_type = 'ads'
      `;
      const [rows] = await dbPromise.query(sql, [req.params.userId]);
      res.json({ success: true, data: rows, assigned: rows, ongoing: rows, completed: rows });
    } catch (err) {
      console.error('Ads Assignments API Error:', err);
      res.status(500).json({ success: false, message: "Database error: " + err.message });
    }
  });

  app.get("/api/gmb-photo-alerts/:userId", (req, res) => {
    res.json({ success: true, alerts: [] });
  });

  app.get("/api/seo-notifications/:userId", (req, res) => {
    res.json({ success: true, data: [] });
  });

  app.get("/api/ads-assignments", async (req, res) => {
    try {
      const sql = `
        SELECT pa.id as assignment_id, pa.project_id as id, pa.status, pa.service_type, 
               l.client_name, l.company_name as project_name, 
               '' as sheet_url 
        FROM project_assignments pa 
        LEFT JOIN leads l ON pa.project_id = l.id 
        WHERE pa.service_type = 'ads'
      `;
      const [rows] = await dbPromise.query(sql);
      res.json({ success: true, data: rows });
    } catch (err) {
      console.error(err);
      res.status(500).json({ success: false, message: "Database error" });
    }
  });

  app.put("/api/ads-assignments/:id", async (req, res) => {
    try {
      // Assuming it updates status
      const { status } = req.body;
      if (status) {
        await dbPromise.query("UPDATE project_assignments SET status = ? WHERE id = ?", [status, req.params.id]);
      }
      res.json({ success: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ success: false, message: "Database error" });
    }
  });

  app.get("/api/ads-daily-work/:assignmentId", async (req, res) => {
    try {
      const [rows] = await dbPromise.query("SELECT * FROM ads_daily_work WHERE assignment_id = ? ORDER BY work_date DESC", [req.params.assignmentId]);
      res.json({ success: true, data: rows });
    } catch (err) {
      console.error(err);
      res.status(500).json({ success: false, message: "Database error" });
    }
  });

  app.post("/api/ads-daily-work", async (req, res) => {
    try {
      const { ads_assignment_id, employee_id, work_date, work_type, platform, campaign_name, description, status, remarks, time_spent } = req.body;
      const [insert] = await dbPromise.query(
        "INSERT INTO ads_daily_work (assignment_id, employee_id, work_date, work_type, platform, campaign_name, description, status, remarks) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [ads_assignment_id || req.body.assignment_id, employee_id, work_date, work_type, platform, campaign_name, description, status || 'pending', remarks]
      );
      res.json({ success: true, id: insert.insertId });
    } catch (err) {
      console.error(err);
      res.status(500).json({ success: false, message: "Database error" });
    }
  });

// ─── Admin Daily Work (aggregated view for admin panel) ───
app.get("/api/admin/daily-work", async (req, res) => {
  try {
    const { companyScope, role, employeeId, dateFrom, dateTo } = req.query;
    let whereClauses = ["1=1"];
    let params = [];

    if (employeeId) {
      whereClauses.push("dw.user_id = ?");
      params.push(employeeId);
    }
    if (role) {
      whereClauses.push("dw.role_snapshot = ?");
      params.push(role);
    }
    if (dateFrom) {
      whereClauses.push("dw.work_date >= ?");
      params.push(dateFrom);
    }
    if (dateTo) {
      whereClauses.push("dw.work_date <= ?");
      params.push(dateTo);
    }

    const where = whereClauses.join(" AND ");
    const sql = `
      SELECT dw.*, u.name as employee_name, u.role as employee_role
      FROM daily_work dw
      LEFT JOIN users u ON dw.user_id = u.id
      WHERE ${where}
      ORDER BY dw.work_date DESC, dw.created_at DESC
      LIMIT 500
    `;
    const [rows] = await dbPromise.query(sql, params);
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error("Admin daily-work error:", err);
    res.status(500).json({ success: false, message: "Database error: " + err.message });
  }
});

app.get("/api/admin/daily-work/export", async (req, res) => {
  try {
    const { companyScope, role, employeeId, dateFrom, dateTo } = req.query;
    let whereClauses = ["1=1"];
    let params = [];

    if (employeeId) { whereClauses.push("dw.user_id = ?"); params.push(employeeId); }
    if (role) { whereClauses.push("dw.role_snapshot = ?"); params.push(role); }
    if (dateFrom) { whereClauses.push("dw.work_date >= ?"); params.push(dateFrom); }
    if (dateTo) { whereClauses.push("dw.work_date <= ?"); params.push(dateTo); }

    const where = whereClauses.join(" AND ");
    const sql = `
      SELECT dw.work_date, u.name as employee_name, u.role as employee_role,
             dw.client_or_project, dw.status, dw.remarks, dw.work_details
      FROM daily_work dw
      LEFT JOIN users u ON dw.user_id = u.id
      WHERE ${where}
      ORDER BY dw.work_date DESC
      LIMIT 2000
    `;
    const [rows] = await dbPromise.query(sql, params);

    let csv = "Date,Employee,Role,Client/Project,Status,Remarks\n";
    rows.forEach(r => {
      const date = r.work_date ? new Date(r.work_date).toLocaleDateString('en-IN') : '';
      csv += `"${date}","${(r.employee_name||'').replace(/"/g,'""')}","${r.employee_role||''}","${(r.client_or_project||'').replace(/"/g,'""')}","${r.status||''}","${(r.remarks||'').replace(/"/g,'""')}"\n`;
    });
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=daily-work-export.csv');
    res.send(csv);
  } catch (err) {
    console.error("Admin daily-work export error:", err);
    res.status(500).json({ success: false, message: "Database error" });
  }
});

// ─── Admin Daily Log (summary report per employee) ───
app.get("/api/admin/daily-log", async (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    const sd = start_date || new Date().toISOString().slice(0, 10);
    const ed = end_date || sd;

    const sql = `
      SELECT
        u.id as user_id,
        u.name,
        u.role,
        u.comp_name,
        COALESCE(leads_t.cnt, 0) as leads_added,
        COALESCE(followups_t.cnt, 0) as followups,
        COALESCE(appt_t.cnt, 0) as appointments,
        COALESCE(deals_t.cnt, 0) as deals_closed,
        COALESCE(proj_t.cnt, 0) as project_tasks,
        COALESCE(hr_t.cnt, 0) as hr_tasks,
        COALESCE(acc_t.cnt, 0) as accounts_tasks
      FROM users u
      LEFT JOIN (
        SELECT created_by as uid, COUNT(*) as cnt FROM leads
        WHERE DATE(created_at) BETWEEN ? AND ?
        GROUP BY created_by
      ) leads_t ON leads_t.uid = u.id
      LEFT JOIN (
        SELECT assign_emp_id as uid, COUNT(*) as cnt FROM leads
        WHERE follow_date BETWEEN ? AND ?
        GROUP BY assign_emp_id
      ) followups_t ON followups_t.uid = u.id
      LEFT JOIN (
        SELECT assign_emp_id as uid, COUNT(*) as cnt FROM leads
        WHERE app_date BETWEEN ? AND ? AND appointment_status IS NOT NULL
        GROUP BY assign_emp_id
      ) appt_t ON appt_t.uid = u.id
      LEFT JOIN (
        SELECT closed_by as uid, COUNT(*) as cnt FROM leads
        WHERE closed_date BETWEEN ? AND ? AND lead_status = 'won'
        GROUP BY closed_by
      ) deals_t ON deals_t.uid = u.id
      LEFT JOIN (
        SELECT user_id as uid, COUNT(*) as cnt FROM daily_work
        WHERE work_date BETWEEN ? AND ?
        GROUP BY user_id
      ) proj_t ON proj_t.uid = u.id
      LEFT JOIN (
        SELECT user_id as uid, COUNT(*) as cnt FROM daily_work
        WHERE work_date BETWEEN ? AND ? AND role_snapshot = 'hr'
        GROUP BY user_id
      ) hr_t ON hr_t.uid = u.id
      LEFT JOIN (
        SELECT user_id as uid, COUNT(*) as cnt FROM daily_work
        WHERE work_date BETWEEN ? AND ? AND role_snapshot = 'accounts'
        GROUP BY user_id
      ) acc_t ON acc_t.uid = u.id
      WHERE u.employment_status != 'deactivated'
      HAVING leads_added > 0 OR followups > 0 OR appointments > 0 OR deals_closed > 0
             OR project_tasks > 0 OR hr_tasks > 0 OR accounts_tasks > 0
      ORDER BY u.name
    `;

    const dateParams = [sd, ed, sd, ed, sd, ed, sd, ed, sd, ed, sd, ed, sd, ed];
    const [rows] = await dbPromise.query(sql, dateParams);

    // Collect distinct roles
    const rolesSet = new Set();
    rows.forEach(r => { if (r.role) rolesSet.add(r.role.toLowerCase()); });

    res.json({ success: true, data: rows, roles: [...rolesSet] });
  } catch (err) {
    console.error("Admin daily-log error:", err);
    res.status(500).json({ success: false, message: "Database error: " + err.message });
  }
});

app.get("/api/admin/daily-log/details", async (req, res) => {
  try {
    const { user_id, start_date, end_date } = req.query;
    if (!user_id) return res.status(400).json({ success: false, message: "user_id required" });
    const sd = start_date || new Date().toISOString().slice(0, 10);
    const ed = end_date || sd;

    // Leads
    const [leads] = await dbPromise.query(
      `SELECT company_name as comp_name, client_name as name, contact as mobile, lead_status, created_at
       FROM leads WHERE created_by = ? AND DATE(created_at) BETWEEN ? AND ?
       ORDER BY created_at DESC`,
      [user_id, sd, ed]
    );

    // Follow-ups
    const [followups] = await dbPromise.query(
      `SELECT company_name as comp_name, client_name as name, contact as mobile, lead_status, follow_time
       FROM leads WHERE assign_emp_id = ? AND follow_date BETWEEN ? AND ?
       ORDER BY follow_time DESC`,
      [user_id, sd, ed]
    );

    // Appointments
    const [appointments] = await dbPromise.query(
      `SELECT company_name as comp_name, client_name as name, contact as mobile, lead_status, app_time
       FROM leads WHERE assign_emp_id = ? AND app_date BETWEEN ? AND ? AND appointment_status IS NOT NULL
       ORDER BY app_time DESC`,
      [user_id, sd, ed]
    );

    // Deals
    const [deals] = await dbPromise.query(
      `SELECT company_name as comp_name, client_name as name, contact as mobile, lead_status
       FROM leads WHERE closed_by = ? AND closed_date BETWEEN ? AND ? AND lead_status = 'won'`,
      [user_id, sd, ed]
    );

    // Project tasks (daily_work)
    const [projects] = await dbPromise.query(
      `SELECT client_or_project as comp_name, role_snapshot as phase_key, status, 0 as progress, updated_at
       FROM daily_work WHERE user_id = ? AND work_date BETWEEN ? AND ?
       ORDER BY updated_at DESC`,
      [user_id, sd, ed]
    );

    // HR (payrolls)
    const [hr] = await dbPromise.query(
      `SELECT p.employee_name_snapshot, p.role_snapshot, p.month_key, p.net_payable
       FROM payrolls p WHERE p.generated_by = ? AND DATE(p.created_at) BETWEEN ? AND ?`,
      [user_id, sd, ed]
    ).catch(() => [[]]);

    // Accounts (deal_payments)
    const [accounts] = await dbPromise.query(
      `SELECT l.company_name as comp_name, l.payment_method, l.pay_stat as payment_status, l.received_amount as amount
       FROM leads l WHERE l.received_by = ? AND l.payment_date BETWEEN ? AND ?`,
      [user_id, sd, ed]
    ).catch(() => [[]]);

    res.json({
      success: true,
      details: { leads, followups, appointments, deals, projects, hr, accounts }
    });
  } catch (err) {
    console.error("Admin daily-log details error:", err);
    res.status(500).json({ success: false, message: "Database error: " + err.message });
  }
});

// --- Dev Users ---
// --- Dev Users ---
app.get('/api/dev-users', async (req, res) => {
  try {
    let sql = 'SELECT id, name, comp_name, employment_status FROM users WHERE LOWER(TRIM(role)) = "dev"';
    const [rows] = await dbPromise.query(sql);
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('GET /api/dev-users error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// --- Generic Upload API ---
app.post('/api/upload-file', (req, res) => {
  upload.single('file')(req, res, function (err) {
    if (err) {
      console.error('Multer error:', err);
      return res.status(400).json({ success: false, message: err.message || 'File upload failed' });
    }
    try {
      if (!req.file) {
        return res.status(400).json({ success: false, message: 'No file uploaded' });
      }
      res.json({ success: true, url: req.file.filename });
    } catch (err) {
      console.error('File upload error:', err);
      res.status(500).json({ success: false, message: 'Upload failed' });
    }
  });
});

// --- Dev Tasks (DEV Panel) ---
app.get('/api/dev-tasks', async (req, res) => {
  try {
    const { userId, role } = req.query;
    let sql = `
      SELECT t.*, 
             u1.name AS assigned_by_name, 
             u2.name AS assigned_to_name
      FROM dev_tasks t
      LEFT JOIN users u1 ON t.assigned_by = u1.id
      LEFT JOIN users u2 ON t.assigned_to = u2.id
    `;
    let params = [];
    if (userId) {
      if (role === 'lead') {
        // Team lead: show tasks they assigned OR tasks assigned to them
        sql += ' WHERE (t.assigned_by = ? OR t.assigned_to = ?)';
        params.push(userId, userId);
      } else {
        // Normal DEV: only tasks assigned to them
        sql += ' WHERE t.assigned_to = ?';
        params.push(userId);
      }
    }
    sql += ' ORDER BY t.created_at DESC';
    const [rows] = await dbPromise.query(sql, params);

    // Also fetch progress for each task
    const [progressRows] = await dbPromise.query('SELECT * FROM dev_task_progress ORDER BY created_at ASC');
    const tasks = rows.map(t => {
      t.progress_logs = progressRows.filter(p => p.task_id === t.id);
      return t;
    });

    res.json({ success: true, tasks });
  } catch (err) {
    console.error('GET /api/dev-tasks error:', err);
    res.status(500).json({ success: false, message: 'Database error' });
  }
});

app.post('/api/dev-tasks', async (req, res) => {
  try {
    const { title, description, assigned_by, assigned_to, task_url, task_image } = req.body;
    const sql = 'INSERT INTO dev_tasks (title, description, assigned_by, assigned_to, task_url, task_image, status) VALUES (?, ?, ?, ?, ?, ?, ?)';
    const [result] = await dbPromise.query(sql, [title, description, assigned_by, assigned_to, task_url, task_image, 'Pending']);
    res.json({ success: true, id: result.insertId });
  } catch (err) {
    console.error('POST /api/dev-tasks error:', err);
    res.status(500).json({ success: false, message: 'Database error' });
  }
});

app.put('/api/dev-tasks/:id', async (req, res) => {
  try {
    const { status, leader_remark, leader_remark_by } = req.body;
    let sql = 'UPDATE dev_tasks SET status = ?';
    let params = [status];
    
    if (leader_remark) {
      sql += ', leader_remark = ?, leader_remark_by = ?, leader_remark_at = NOW()';
      params.push(leader_remark, leader_remark_by);
    }
    
    sql += ' WHERE id = ?';
    params.push(req.params.id);
    
    await dbPromise.query(sql, params);
    res.json({ success: true });
  } catch (err) {
    console.error('PUT /api/dev-tasks error:', err);
    res.status(500).json({ success: false, message: 'Database error' });
  }
});

app.post('/api/dev-tasks/:id/progress', async (req, res) => {
  try {
    const { userId, note, urls, images } = req.body;
    const sql = 'INSERT INTO dev_task_progress (task_id, user_id, note, urls, images) VALUES (?, ?, ?, ?, ?)';
    await dbPromise.query(sql, [req.params.id, userId, note, JSON.stringify(urls || []), JSON.stringify(images || [])]);
    
    // Also update task status if passed
    if (req.body.status) {
      await dbPromise.query('UPDATE dev_tasks SET status = ? WHERE id = ?', [req.body.status, req.params.id]);
    }
    
    res.json({ success: true });
  } catch (err) {
    console.error('POST /api/dev-tasks/:id/progress error:', err);
    res.status(500).json({ success: false, message: 'Database error' });
  }
});

// --- Daily Work (Employee Panel) ---
app.get('/api/daily-work/my', async (req, res) => {
  try {
    const { userId, month } = req.query;
    let sql = 'SELECT * FROM daily_work WHERE user_id = ?';
    let params = [userId];
    if (month) {
      sql += ' AND work_date LIKE ?';
      params.push(month + '%');
    }
    sql += ' ORDER BY work_date DESC, created_at DESC';
    const [rows] = await dbPromise.query(sql, params);
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('GET /api/daily-work/my error:', err);
    res.status(500).json({ success: false, message: 'Database error' });
  }
});

app.post('/api/daily-work', async (req, res) => {
  try {
    const { userId, role_snapshot, work_date, client_or_project, status, remarks, work_details } = req.body;
    const sql = 'INSERT INTO daily_work (user_id, role_snapshot, work_date, client_or_project, status, remarks, work_details) VALUES (?, ?, ?, ?, ?, ?, ?)';
    const [result] = await dbPromise.query(sql, [userId, role_snapshot, work_date, client_or_project, status, remarks, JSON.stringify(work_details || {})]);
    res.json({ success: true, id: result.insertId });
  } catch (err) {
    console.error('POST /api/daily-work error:', err);
    res.status(500).json({ success: false, message: 'Database error' });
  }
});

app.put('/api/daily-work/:id', async (req, res) => {
  try {
    const { client_or_project, status, remarks, work_details } = req.body;
    const sql = 'UPDATE daily_work SET client_or_project = ?, status = ?, remarks = ?, work_details = ? WHERE id = ?';
    await dbPromise.query(sql, [client_or_project, status, remarks, JSON.stringify(work_details || {}), req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error('PUT /api/daily-work/:id error:', err);
    res.status(500).json({ success: false, message: 'Database error' });
  }
});


app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
  runStartupSchemaTasks().catch((err) => {
    console.error("Startup schema setup failed:", err);
  });
});
    
    
    app.get("/api/service-renewals/:id/invoice", async (req, res) => {
  const renewalId = Number(req.params.id || 0);
  const invoiceType = String(req.query.type || req.query.invoiceType || "proforma")
    .toLowerCase()
    .trim();

  if (!renewalId) {
    return res.status(400).send("Invalid renewal id");
  }

  if (!["proforma", "tax"].includes(invoiceType)) {
    return res.status(400).send("Invalid invoice type");
  }

  try {
    const invoiceContext = await getServiceRenewalInvoiceContext(
      renewalId,
      req.query,
    );
    renderServiceRenewalInvoicePdf(res, invoiceContext, invoiceType);
  } catch (err) {
    console.error("Service Renewal Invoice Error:", err);
    res
      .status(err.statusCode || 500)
      .send(err.message || "Failed to prepare renewal invoice");
  }
});
    
    

