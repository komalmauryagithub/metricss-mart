const fs = require('fs');

const routeStr = `
// ==================== IN-APP PROFILE SETUP ====================
async function getProfileSetupUserById(userId) {
  const [rows] = await dbPromise.query(
    \`
      SELECT 
        id, 
        name, 
        email, 
        role, 
        comp_name, 
        profile_setup_status,
        profile_setup_token,
        profile_setup_expires,
        prof_img,
        aadhar_img,
        pan_img,
        cancelled_cheque,
        resume_file,
        experience_file,
        certification_file,
        aadhar_no,
        pan_number,
        account_no,
        bank_name,
        ifsc_code,
        beneficiary_name,
        DATE_FORMAT(joining_date, '%Y-%m-%d') AS joining_date,
        total_experience,
        pf_enabled,
        pf_number,
        uan_number,
        employee_pf_amount,
        employer_pf_amount,
        DATE_FORMAT(pf_joining_date, '%Y-%m-%d') AS pf_joining_date,
        skills
      FROM users 
      WHERE id = ?
    \`,
    [userId]
  );
  return rows[0];
}

app.get("/api/employee/profile-setup/:userId", async (req, res) => {
  const userId = Number(req.params.userId);

  if (!userId) {
    return res.status(400).json({
      success: false,
      message: "Missing user ID",
    });
  }

  try {
    await ensureUserProfileSetupColumns();
    const user = await getProfileSetupUserById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.json({
      success: true,
      data: user,
    });
  } catch (err) {
    console.error("Profile Setup Link Error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to load profile form",
    });
  }
});

app.post("/api/employee/profile-setup/:userId", (req, res) => {
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

    const userId = Number(req.params.userId);
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "Missing user ID",
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
      const user = await getProfileSetupUserById(userId);

      if (!user) {
        return res.status(404).json({
          success: false,
          message: "This profile form link is invalid",
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
          employeePfAmount === null ||
          employerPfAmount === null ||
          !pfJoiningDate)
      ) {
        return res.status(400).json({
          success: false,
          message: "All PF details are required when PF is enabled",
        });
      }

      await dbPromise.query(
        \`
          UPDATE users 
          SET 
            prof_img = ?,
            aadhar_no = ?,
            aadhar_img = ?,
            pan_number = ?,
            pan_img = ?,
            cancelled_cheque = ?,
            resume_file = ?,
            experience_file = ?,
            certification_file = ?,
            account_no = ?,
            bank_name = ?,
            ifsc_code = ?,
            beneficiary_name = ?,
            joining_date = ?,
            total_experience = ?,
            pf_enabled = ?,
            pf_number = ?,
            uan_number = ?,
            employee_pf_amount = ?,
            employer_pf_amount = ?,
            pf_joining_date = ?,
            skills = ?,
            profile_setup_status = "completed"
          WHERE id = ?
        \`,
        [
          profImg,
          aadharNo,
          aadharImg,
          panNumber,
          panImg,
          cancelledCheque,
          resumeFile,
          experienceFile,
          certificationFile,
          accountNo,
          bankName,
          ifscCode,
          beneficiaryName,
          joiningDate,
          totalExperience,
          pfEnabled,
          pfNumber,
          uanNumber,
          employeePfAmount,
          employerPfAmount,
          pfJoiningDate,
          JSON.stringify(skills),
          userId,
        ],
      );

      res.json({
        success: true,
        message: "Profile updated successfully!",
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
`;

let server = fs.readFileSync('server.js', 'utf8');

// Insert the new route string just before the last line or before app.listen if it exists.
// A safe place is just appending it.
server += '\n' + routeStr;

fs.writeFileSync('server.js', server);
console.log('Appended in-app profile setup routes to server.js');
