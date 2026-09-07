const fs = require('fs');

let server = fs.readFileSync('server.js', 'utf8');

const getStart = server.indexOf('app.get("/api/profile-setup/:token", async (req, res) => {');
const postStart = server.indexOf('app.post("/api/profile-setup/:token", (req, res) => {');

const correctGet = `app.get("/api/profile-setup/:token", async (req, res) => {
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
`;

server = server.substring(0, getStart) + correctGet + '\n' + server.substring(postStart);

fs.writeFileSync('server.js', server);
console.log('Fixed GET /api/profile-setup/:token');
