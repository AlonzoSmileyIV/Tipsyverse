import mongoose from "mongoose";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  PositionModel as Position,
  UserModel as User,
  CourseModel as Course,
  CourseProgressModel as CourseProgress,
  PaymentMethodModel as PaymentMethod,
  DrinkLikeModel as DrinkLike,
  DrinkSaveModel as DrinkSave,
  EventModel as Event,
  AssignmentModel as Assignment,
  ReviewModel as Review,
  RewardClaimModel as RewardClaim
} from "../../models/index.js";

import {
  clearRefreshCookie,
  getAccountAccessBlock,
  getRefreshCookieOptions,
  reactivateExpiredSuspension,
} from "../../utils/libs/accountAccess.js";

import {
  toLocalDateOnly,
  makeBulkActivityLogger,
  validateEmail,
  validatePassword,
  validateDate,
  createRefreshToken,
  createAccessToken,
  sendEmail,
  sendNotification,
  cloudinary,
  handleImageUpload,
  ageHelper,
  deleteUserHandler,
  startOfUTCDay,
  addMonthsUTC,
  formatUTC,
  withTxnRetry,
  shallowDiff,
  canManage,
  allocateUniqueUsername,
  findAvailableUsernames,
  baseUsernameSeeds,
  normalizeUsername,
  validateOwnerReportTo,
  rowHasStatusChange,
  idxOf,
  snapshotEmployeeForAudit,
  setDiff,
  makeIdToEmailMap,
  startOfToday,
  formatLicenseForResponse,
  buildRewardProgress,
  getCompletedBartenderEventsCount,
} from "../../utils/index.js";
import XLSX from "xlsx";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BARTENDER_ONBOARDING_DOCUMENTS = [
  {
    key: "w9",
    title: "W-9",
    summary: "Tax identity and taxpayer information.",
  },
  {
    key: "independent_contractor",
    title: "Independent Contractor Agreement",
    summary: "Contractor status, event expectations, payment, and confidentiality.",
  },
  {
    key: "service_standards",
    title: "Service Standards Acknowledgement",
    summary: "Attendance, conduct, alcohol safety, and incident reporting.",
  },
];

const ONBOARDING_DOCUMENT_FILE_NAMES = {
  w9: "W-9.pdf",
  independent_contractor: "Independent-Contractor-Agreement.pdf",
  service_standards: "Service-Standards-Acknowledgement.pdf",
};

const BARTENDER_DOCUMENT_STATUSES = new Set([
  "not_sent",
  "sent",
  "received",
  "rejected",
  "expired",
]);

const normalizeOnboardingDocuments = (documents = []) => {
  const byKey = new Map();
  (Array.isArray(documents) ? documents : []).forEach((doc) => {
    const key = doc?.key || doc?.documentKey;
    if (key) byKey.set(key, doc);
  });

  return BARTENDER_ONBOARDING_DOCUMENTS.map((doc) => {
    const existing = byKey.get(doc.key) || {};
    return {
      key: doc.key,
      title: doc.title,
      summary: doc.summary,
      status: BARTENDER_DOCUMENT_STATUSES.has(existing.status)
        ? existing.status
        : "not_sent",
      sentAt: existing.sentAt || null,
      receivedAt: existing.receivedAt || null,
      lastStatusChangeAt: existing.lastStatusChangeAt || null,
      lastStatusChangedBy: existing.lastStatusChangedBy || null,
      notes: existing.notes || "",
    };
  });
};

const allOnboardingDocumentsReceived = (documents = []) =>
  normalizeOnboardingDocuments(documents).every(
    (doc) => doc.status === "received"
  );

const hasBartenderContactInfo = (bartenderProfile = {}) => {
  const contactInfo = bartenderProfile?.contactInfo || {};
  const emergencyContact = contactInfo.emergencyContact || {};
  return Boolean(
    String(contactInfo.phone || "").trim() &&
      String(emergencyContact.fullName || "").trim() &&
      String(emergencyContact.relationship || "").trim() &&
      String(emergencyContact.phone || "").trim()
  );
};

const getOnboardingDocumentDir = () =>
  process.env.ONBOARDING_DOCUMENTS_DIR ||
  path.resolve(__dirname, "../../../docs/onboarding");

const buildOnboardingDocumentAttachments = (documentKeys = []) => {
  const dir = getOnboardingDocumentDir();
  return documentKeys
    .map((key) => {
      const filename = ONBOARDING_DOCUMENT_FILE_NAMES[key];
      if (!filename) return null;
      const filePath = path.join(dir, filename);
      if (!fs.existsSync(filePath)) return null;
      return {
        filename,
        content: fs.readFileSync(filePath).toString("base64"),
      };
    })
    .filter(Boolean);
};

const upsertOnboardingDocuments = (profile, updates = [], actorId = null) => {
  const current = normalizeOnboardingDocuments(profile.onboardingDocuments);
  const updateByKey = new Map(updates.map((update) => [update.key, update]));
  const changedAt = new Date();

  profile.onboardingDocuments = current.map((doc) => {
    const update = updateByKey.get(doc.key);
    if (!update) return doc;
    return {
      ...doc,
      ...update,
      title: doc.title,
      summary: doc.summary,
      lastStatusChangeAt: changedAt,
      lastStatusChangedBy: actorId,
    };
  });

  return profile.onboardingDocuments;
};

const calculateScore = (
  drink,
  userInteractionHistory,
  userProfilePreferences = {}
) => {
  let score = 0;

  const {
    likedDrinks,
    savedDrinks,
    sharedDrinks,
    commentedDrinks,
    viewedDrinks,
    favoriteIngredients = [],
    favoriteColors = [],
    favoriteTastes = [],
  } = userInteractionHistory;

  const drinkId = drink._id.toString();

  // Direct interactions
  if (likedDrinks.includes(drinkId)) score += 5;
  if (savedDrinks.includes(drinkId)) score += 4;
  if (sharedDrinks.includes(drinkId)) score += 2;
  if (commentedDrinks.includes(drinkId)) score += 3;
  if (viewedDrinks.includes(drinkId)) score += 2;

  // Content similarity
  drink.ingredients?.forEach((ing) => {
    if (favoriteIngredients.includes(ing.name.toLowerCase())) {
      score += 1;
    }
  });

  if (
    drink.colors?.some((color) => favoriteColors.includes(color.toLowerCase()))
  ) {
    score += 1;
  }

  if (
    drink.taste?.some((taste) => favoriteTastes.includes(taste.toLowerCase()))
  ) {
    score += 1;
  }

  return score;
};

const withDrinkActivity = async (userDocOrObject) => {
  if (!userDocOrObject) return userDocOrObject;
  const user =
    typeof userDocOrObject.toObject === "function"
      ? userDocOrObject.toObject()
      : { ...userDocOrObject };
  const userId = user._id || user.id;
  if (!userId) return user;

  const [likeDocs, saveDocs] = await Promise.all([
    DrinkLike.find({ user: userId })
      .sort({ createdAt: -1 })
      .populate("drink", "name slug photo")
      .lean(),
    DrinkSave.find({ user: userId })
      .sort({ createdAt: -1 })
      .populate("drink", "name slug photo")
      .lean(),
  ]);

  user.likedDrinks = likeDocs.map((doc) => doc.drink).filter(Boolean);
  user.savedDrinks = saveDocs.map((doc) => doc.drink).filter(Boolean);

  return user;
};

// Normalize helpers
async function ensureDirectReportsArray(userId) {
  await User.updateOne({ _id: userId }, [
    {
      $set: {
        "employeeDetails.directReports": {
          $cond: [
            { $isArray: "$employeeDetails.directReports" },
            "$employeeDetails.directReports",
            {
              $cond: [
                {
                  $ne: [{ $type: "$employeeDetails.directReports" }, "missing"],
                },
                [{ $ifNull: ["$employeeDetails.directReports", null] }],
                [],
              ],
            },
          ],
        },
      },
    },
  ]);
}

function formatBartenderProfileForResponse(user) {
  const bp = user.bartenderProfile || {};
  const fullName = [user.firstName, user.lastName].filter(Boolean).join(" ");

  return {
    userId: user._id,
    fullName,
    email: user.email,
    status: bp.status,
    lastStatusChangeAt: bp.lastStatusChangeAt,
    lastStatusChangedBy: bp.lastStatusChangedBy,
    dateBartendingStarted: bp.dateBartendingStarted || null,
    statusNote: bp.statusNote || null,
    stats: bp.stats || {},
    // you can expose other bits if needed:
    // licenses: bp.licenses,
    // serviceAddresses: bp.serviceAddresses,
  };
}

// Helper: coerce many date input shapes to a LOCAL date-only (midnight)

const userCtrl = {
  //
  bulkEmployeeBulker: async (req, res) => {
    try {
      const { type } = req.query; // 'add', 'edit', or 'delete'
      const file = req.file;

      const reqUser = await User.findById(req.user.id).populate({
        path: "employeeDetails.position",
        populate: { path: "hierarchy", select: "name" },
      });

      const { logRow, logBatch } = makeBulkActivityLogger({
        req,
        reqUser,
        type,
        entityModel: "User",
      });

      if (!reqUser) {
        return res.status(400).json({
          success: false,
          message: "Authorized user not found.",
        });
      }

      if (!file)
        return res.status(400).json({
          success: false,
          message: "No file uploaded.",
        });

      const validMimeTypes = [
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "application/vnd.ms-excel",
        "application/vnd.ms-excel.sheet.macroEnabled.12",
        "application/vnd.ms-excel.sheet.binary.macroEnabled.12",
        "application/vnd.smartsheet",
      ];

      if (!validMimeTypes.includes(file.mimetype)) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid file type. Only Excel or SmartSheet formats are supported.",
        });
      }

      const workbook = XLSX.read(file.buffer, { type: "buffer" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet, {
        defval: "",
        raw: false,
      });

      if (
        !rows.length ||
        rows.every((row) => Object.values(row).every((cell) => cell === ""))
      ) {
        return res.status(400).json({
          success: false,
          message:
            "The uploaded sheet is empty or contains no valid data rows.",
        });
      }

      const validHeaders = [
        "Full Name",
        "Email",
        "Password",
        "Birthday",
        "Bio",
        "Position",
        "Date Started",
        "Status",
        "Is Absent",
        "Termination Reason",
        "Report To Email",
        "Direct Reports Emails",
      ];

      const headers = Object.keys(rows[0] || {});
      const extraHeaders = headers.filter((h) => !validHeaders.includes(h));

      if (extraHeaders.length > 0) {
        return res.status(400).json({
          success: false,
          message: `Invalid headers: ${extraHeaders.join(", ")}`,
        });
      }

      const errors = [];
      const successCount = { add: 0, edit: 0, delete: 0 };
      const blankFullNames = [];
      const blankEmails = [];
      const takenEmails = [];
      const blankPasswords = [];
      const blankPositions = [];
      const blankDatesStarted = [];

      const allEmployees = await User.find({ role: "employee" }).populate({
        path: "employeeDetails.position",
        populate: { path: "hierarchy", select: "name" },
      });

      const allPositions = await Position.find().populate("hierarchy", "name");

      for (let i = 0; i < rows.length; i++) {
        const rowNum = i + 2;
        const row = rows[i];
        const fullName = row["Full Name"]?.trim();
        const email = row["Email"]?.trim();
        const password = row["Password"]?.trim();
        const birthday = row["Birthday"]?.trim() || "";
        const bio = row["Bio"]?.trim() || "";
        const position = row["Position"]?.trim();
        const dateStarted = row["Date Started"]?.trim();
        const status = row["Status"]?.trim();

        const validAbsentInputs = ["true", "t", "yes", "y"];
        const isAbsent = validAbsentInputs.includes(
          row["Is Absent"]?.trim().toLowerCase()
        );

        const reasonForTermination = row["Termination Reason"]?.trim();
        const reportToEmail = row["Report To Email"]?.trim();
        const rawDirectReportsEmails = row["Direct Reports Emails"]?.trim();

        const parseDirectReports = () => {
          const directReports = [];
          const drEmails = new Set(
            rawDirectReportsEmails.split(",").map((e) => e.trim())
          );
          for (const drEmail of drEmails) {
            const email = drEmail.trim();
            if (!validateEmail(email)) {
              throw new Error(`Invalid ingredient format: '${email}'`);
            }
            const foundDirectReport = allEmployees.find(
              (i) => i.email.toLowerCase() === email.toLowerCase()
            );

            if (!foundDirectReport) {
              throw new Error(`Employee with email ${email} not found.`);
            }

            directReports.push(foundDirectReport);
          }
          return directReports;
        };

        if (type === "add") {
          // Owner check on incoming data
          if (position && position.toLowerCase() === "owner") {
            errors.push(
              `Row ${rowNum} is invalid: Cannot bulk add an Owner position.`
            );
            continue;
          }

          if (!fullName) {
            errors.push(`Row ${rowNum} is invalid: Full Name is blank.`);
            blankFullNames.push(rowNum);
            continue;
          }

          if (!email) {
            errors.push(`Row ${rowNum} is invalid: Email is blank.`);
            blankFullNames.push(rowNum);
            continue;
          }

          if (!validateEmail(email)) {
            errors.push(`Row ${rowNum} is invalid: Email is not valid.`);
            continue;
          }

          const existingEmail = await User.findOne({ email });
          if (existingEmail) {
            errors.push(`Row ${rowNum} is invalid: Email is already taken.`);
            takenEmails.push(rowNum);
            continue;
          }

          if (!password) {
            errors.push(`Row ${rowNum} is invalid: Password is blank.`);
            blankPasswords.push(rowNum);
            continue;
          }

          if (
            !validatePassword.checkLength(password) ||
            !validatePassword.checkUppercase(password) ||
            !validatePassword.checkNumber(password) ||
            !validatePassword.checkSpecial(password)
          ) {
            errors.push(
              `Row ${rowNum} is invalid: Password must be at least 6 characters long and include an uppercase letter, number, and special character.`
            );
            continue;
          }

          if (birthday && !validateDate(birthday)) {
            errors.push(
              `Row ${rowNum} is invalid: Birthday is an invalid date input.`
            );
            continue;
          }

          if (!position) {
            errors.push(`Row ${rowNum} is invalid: Position is blank.`);
            blankPositions.push(rowNum);
            continue;
          }

          const existingPosition = await Position.findOne({ name: position });

          if (!existingPosition) {
            errors.push(`Row ${rowNum} is invalid: Position is not found.`);
            continue;
          }

          if (!dateStarted) {
            errors.push(`Row ${rowNum} is invalid: Date started is blank.`);
            blankDatesStarted.push(rowNum);
            continue;
          }

          if (!validateDate(dateStarted)) {
            errors.push(
              `Row ${rowNum} is invalid: Date Started is an invalid date input.`
            );
            continue;
          }

          if (position.toLowerCase() !== "owner") {
            if (!reportToEmail) {
              errors.push(
                `Row ${rowNum} is invalid: Report To Email is blank.`
              );
              continue;
            }

            if (!validateEmail(reportToEmail)) {
              errors.push(
                `Row ${rowNum} is invalid: Report To Email is an invalid email.`
              );
              continue;
            }

            if (reportToEmail.toLowerCase() === email.toLowerCase()) {
              errors.push(
                `Row ${rowNum} is invalid: The Report To email is the same as Email being inserted. A user cannot report themselves.`
              );
              continue;
            }

            const exisitingReportTo = await User.findOne({
              email: reportToEmail,
            });

            if (!exisitingReportTo) {
              errors.push(
                `Row ${rowNum} is invalid: The Report To Email does not exist.`
              );
              continue;
            }

            let directReports;
            if (rawDirectReportsEmails) {
              try {
                directReports = parseDirectReports();
              } catch (err) {
                errors.push(`Row ${rowNum} error: ${err.message}`);
                continue;
              }
            }

            const ownerGuard = validateOwnerReportTo({
              targetPositionName: existingPosition?.name,
              reportToEmail,
            });
            if (!ownerGuard.ok) {
              errors.push(`Row ${rowNum} is invalid: ${ownerGuard.reason}`);
              continue;
            }

            const perm = canManage({
              actor: reqUser,
              action: "add",
              targetHierarchyName: existingPosition?.hierarchy?.name,
              reportToEmail, // used for 1-level-below rule
              actorEmail: reqUser.email,
            });
            if (!perm.ok) {
              errors.push(`Row ${rowNum} not allowed: ${perm.reason}`);
              continue;
            }

            const usernameToUse = await allocateUniqueUsername(null, {
              fullName,
              email,
              birthday,
            });

            // Create user
            const newUser = await User.create({
              role: "employee",
              fullName,
              username: usernameToUse,
              email,
              passwordHash: bcrypt.hashSync(
                password,
                parseInt(process.env.SALT_ROUNDS)
              ),
              accountStatus: {
                state: "Active",
                isOnline: false,
                dateUsernameLastChanged: null,
              },
              profile: {
                birthday: birthday || null,
                bio: bio || "",
              },
              employeeDetails: {
                position: existingPosition,
                dates: {
                  dateStarted: dateStarted,
                  dateStatusLastChanged: new Date(),
                },
                reportTo: exisitingReportTo || null,
                directReports: directReports || null,
              },
            });

            await logRow({
              targetId: newUser._id.toString(),
              rowNum,
              label: `${newUser.fullName} (${newUser.email})`,
              extraMeta: {
                position: newUser?.employeeDetails?.position?.name,
                dateStarted: newUser?.employeeDetails?.dates?.dateStarted,
                reportToEmail,
              },
            });

            const emailContent = `
        <p>Dear ${fullName},</p>
        <p>Welcome to the Tipsyverse Team! You're now officially our new <strong>${existingPosition.name}</strong>.</p>
        <p><strong>Email:</strong> ${email}<br/><strong>Username:</strong> ${usernameToUse}<br/><strong>Current Password:</strong> ${password}</p>
        <p>Please log in and update your password as soon as possible.</p>
        <a href="${process.env.ADMIN_PORTAL_URL}/login"class="button">Login Now</a>
        <p>We're excited to have you aboard! 🚀</p>
      `;
            try {
              await sendEmail({
                to: email,
                title: "Your Tipsyverse Account 🎉",
                subject: "Welcome to Tipsyverse 🎉",
                html: emailContent,
              });
            } catch (emailErr) {
              console.warn(
                `Failed to send welcome email to ${email}:`,
                emailErr.message
              );
            }
          }

          successCount.add++;
        } else if (type === "edit") {
          if (!email) {
            errors.push(
              `Row ${rowNum} is invalid: Email is required for edit.`
            );
            blankEmails.push(rowNum);
            continue;
          }

          const employee = await User.findOne({ email }).populate({
            path: "employeeDetails.position",
            populate: { path: "hierarchy", select: "name" },
          });
          if (!employee) {
            errors.push(
              `Row ${rowNum} is invalid: No user found with this email.`
            );
            continue;
          }

          const beforeSnap = snapshotEmployeeForAudit(employee);

          // Optional: keep your old "cannot edit Owner" rule OR allow owner to edit
          // (If you want to keep blocking, leave your existing check. If not, drop it.)

          const isStatusChange = rowHasStatusChange(row);
          const perm = canManage({
            actor: reqUser,
            action: "edit",
            targetHierarchyName:
              employee?.employeeDetails?.position?.hierarchy?.name,
            targetId: employee?._id,
            isStatusChange,
          });
          if (!perm.ok) {
            errors.push(`Row ${rowNum} not allowed: ${perm.reason}`);
            continue;
          }

          // Owner check on existing employee
          if (
            employee.employeeDetails?.position?.name?.toLowerCase() ===
              "owner" &&
            reportToEmail
          ) {
            errors.push(
              `Row ${rowNum} is invalid: Owner cannot have a manager (reportTo must be empty).`
            );
            continue;
          }

          // Ensure structure
          if (!employee.employeeDetails) employee.employeeDetails = {};
          if (!employee.employeeDetails.dates)
            employee.employeeDetails.dates = {};
          if (!employee.employeeDetails.employmentStatus)
            employee.employeeDetails.employmentStatus = {};

          if (fullName) employee.fullName = fullName;
          if (birthday && validateDate(birthday))
            employee.profile.birthday = birthday;
          if (bio) employee.profile.bio = bio;
          if (dateStarted && validateDate(dateStarted)) {
            employee.employeeDetails.dates.dateStarted = dateStarted;
          }

          if (isAbsent) {
            employee.employeeDetails.employmentStatus.isAbsent = isAbsent;
          }

          if (position) {
            const foundPosition = allPositions.find((p) => p.name === position);
            if (!foundPosition) {
              errors.push(
                `Row ${rowNum} is invalid: Position "${position}" not found.`
              );
              continue;
            }
            employee.employeeDetails.position = foundPosition;
          }

          if (status) {
            const today = new Date();
            employee.employeeDetails.employmentStatus.state = status;
            employee.employeeDetails.dates.dateStatusLastChanged = today;

            if (status.toLowerCase() === "terminated") {
              if (!reasonForTermination) {
                errors.push(
                  `Row ${rowNum} is invalid: Must include reason for termination.`
                );
                continue;
              }

              employee.employeeDetails.employmentStatus.reasonForTermination =
                reasonForTermination;
              employee.employeeDetails.dates.datesTerminated = [
                ...(employee.employeeDetails.dates.datesTerminated || []),
                today,
              ];

              // Remove from current manager
              if (employee.employeeDetails.reportTo) {
                await User.findByIdAndUpdate(
                  employee.employeeDetails.reportTo,
                  {
                    $pull: { "employeeDetails.directReports": employee._id },
                  }
                );
              }

              // Reassign or clear directReports
              if (employee.employeeDetails.directReports?.length > 0) {
                if (employee.employeeDetails.reportTo) {
                  await User.updateMany(
                    { _id: { $in: employee.employeeDetails.directReports } },
                    {
                      $set: {
                        "employeeDetails.reportTo":
                          employee.employeeDetails.reportTo,
                      },
                    }
                  );

                  await User.findByIdAndUpdate(
                    employee.employeeDetails.reportTo,
                    {
                      $addToSet: {
                        "employeeDetails.directReports": {
                          $each: employee.employeeDetails.directReports,
                        },
                      },
                    }
                  );
                } else {
                  await User.updateMany(
                    { _id: { $in: employee.employeeDetails.directReports } },
                    { $set: { "employeeDetails.reportTo": null } }
                  );
                }
              }

              // Clear anyone else reporting to this employee
              await User.updateMany(
                { "employeeDetails.reportTo": employee._id },
                { $set: { "employeeDetails.reportTo": null } }
              );
            } else {
              employee.employeeDetails.employmentStatus.reasonForTermination =
                "";
            }
          }

          if (reportToEmail) {
            const manager = allEmployees.find(
              (u) => u.email.toLowerCase() === reportToEmail.toLowerCase()
            );
            if (!manager) {
              errors.push(
                `Row ${rowNum} is invalid: Report To Email not found.`
              );
              continue;
            }
            employee.employeeDetails.reportTo = manager._id;
          }

          if (rawDirectReportsEmails) {
            try {
              const directReports = parseDirectReports();
              employee.employeeDetails.directReports = directReports.map(
                (d) => d._id
              );
            } catch (err) {
              errors.push(`Row ${rowNum} error: ${err.message}`);
              continue;
            }
          }

          // Build after snapshot from the in-memory mutated doc
          const afterSnap = snapshotEmployeeForAudit(employee);

          // Compute changes
          const changes = [];
          const pushChange = (path, from, to) => {
            if (from !== to && !(from == null && to == null)) {
              changes.push({ path, from, to });
            }
          };

          // Scalar fields
          pushChange("fullName", beforeSnap.fullName, afterSnap.fullName);
          pushChange(
            "profile.birthday",
            beforeSnap.birthday,
            afterSnap.birthday
          );
          pushChange("profile.bio", beforeSnap.bio, afterSnap.bio);
          pushChange(
            "employeeDetails.dates.dateStarted",
            beforeSnap.dateStarted,
            afterSnap.dateStarted
          );
          pushChange(
            "employeeDetails.employmentStatus.isAbsent",
            beforeSnap.isAbsent,
            afterSnap.isAbsent
          );
          pushChange(
            "employeeDetails.employmentStatus.state",
            beforeSnap.status,
            afterSnap.status
          );

          // Position (store both id and name for readability)
          if (
            beforeSnap.positionId !== afterSnap.positionId ||
            beforeSnap.positionName !== afterSnap.positionName
          ) {
            changes.push({
              path: "employeeDetails.position",
              from: {
                id: beforeSnap.positionId,
                name: beforeSnap.positionName,
              },
              to: { id: afterSnap.positionId, name: afterSnap.positionName },
            });
          }

          // Manager
          pushChange(
            "employeeDetails.reportTo",
            beforeSnap.reportToId,
            afterSnap.reportToId
          );

          // Direct reports (show added/removed)
          const { added, removed } = setDiff(
            beforeSnap.directReports,
            afterSnap.directReports
          );
          if (added.length || removed.length) {
            const idToEmail = makeIdToEmailMap(allEmployees);
            changes.push({
              path: "employeeDetails.directReports",
              from: {
                count: beforeSnap.directReports.length,
                ids: beforeSnap.directReports,
                emails: beforeSnap.directReports
                  .map((id) => idToEmail.get(id))
                  .filter(Boolean),
              },
              to: {
                count: afterSnap.directReports.length,
                ids: afterSnap.directReports,
                emails: afterSnap.directReports
                  .map((id) => idToEmail.get(id))
                  .filter(Boolean),
              },
              delta: {
                added: {
                  ids: added,
                  emails: added.map((id) => idToEmail.get(id)).filter(Boolean),
                },
                removed: {
                  ids: removed,
                  emails: removed
                    .map((id) => idToEmail.get(id))
                    .filter(Boolean),
                },
              },
            });
          }

          // If status = "Terminated", also include reason in changes
          if (afterSnap.status?.toLowerCase() === "terminated") {
            pushChange(
              "employeeDetails.employmentStatus.reasonForTermination",
              employee.employeeDetails?.employmentStatus
                ?.reasonForTermination ?? "", // after you've set it
              reasonForTermination ?? ""
            );
          }

          await employee.save();

          await logRow({
            targetId: employee._id.toString(),
            rowNum,
            label: `${employee.fullName} (${employee.email})`,
            changes, // 👈 diffs here
            extraMeta: {
              newStatus: employee.employeeDetails?.employmentStatus?.state,
              newPosition: employee.employeeDetails?.position?.name,
              reportToEmail,
            },
          });

          successCount.edit++;
        } else if (type === "delete") {
          const deletionEmail = email;
          if (!deletionEmail) {
            errors.push(
              `Row ${rowNum} is invalid: Email required for deletion.`
            );
            blankEmails.push(rowNum);
            continue;
          }

          const user = await User.findOne({ email: deletionEmail }).populate({
            path: "employeeDetails.position",
            populate: { path: "hierarchy", select: "name" },
          });
          if (!user) {
            errors.push(
              `Row ${rowNum} is invalid: No user found with this email.`
            );
            continue;
          }

          // Global: no one can delete themselves (also handled in canManage, but explicit is fine)
          if (user._id.toString() === reqUser._id.toString()) {
            errors.push(
              `Row ${rowNum} not allowed: You cannot delete yourself.`
            );
            continue;
          }

          const perm = canManage({
            actor: reqUser,
            action: "delete",
            targetHierarchyName:
              user?.employeeDetails?.position?.hierarchy?.name,
            targetId: user?._id,
          });
          if (!perm.ok) {
            errors.push(`Row ${rowNum} not allowed: ${perm.reason}`);
            continue;
          }

          // Owner check before deletion
          if (user.employeeDetails?.position?.name?.toLowerCase() === "owner") {
            errors.push(
              `Row ${rowNum} is invalid: Cannot bulk delete an Owner position.`
            );
            continue;
          }

          if (user.role === "employee") {
            const currentState = user.employeeDetails?.employmentStatus?.state;
            if (currentState !== "Terminated") {
              errors.push(
                `Row ${rowNum} is invalid: Employee must be 'Terminated' before deletion.`
              );
              continue;
            }
          } else if (user.role === "regular") {
            const currentState = user.accountStatus.state;
            if (!["Inactive", "Suspended"].includes(currentState)) {
              errors.push(
                `Row ${rowNum} is invalid: Customer must be 'Inactive' or 'Suspended' before deletion.`
              );
              continue;
            }
          }

          await User.deleteOne({ _id: user._id });

          await logRow({
            targetId: user._id,
            rowNum,
            label: `${user.fullName} (${user.email})`,
            extraMeta: {
              previousStatus: user.employeeDetails?.employmentStatus?.state,
              previousPosition: user.employeeDetails?.position?.name,
            },
          });

          successCount.delete++;
        }
      }
      const suggestions = [];
      if (blankFullNames.length === rows.length)
        suggestions.push(`All of the full names are blank.`);
      else if (blankFullNames.length > rows.length / 2)
        suggestions.push(
          `You might want to take a look at the full names because most of them are blank as shown in rows {${blankFullNames.join(
            ", "
          )}}.`
        );

      if (blankEmails.length === rows.length)
        suggestions.push(`All of the emails are blank.`);
      else if (blankEmails.length > rows.length / 2)
        suggestions.push(
          `You might want to take a look at the emails because most of them are blank as shown in rows {${blankEmails.join(
            ", "
          )}}.`
        );

      if (takenEmails.length === rows.length)
        suggestions.push(
          `All of the emails listed in the Excel sheet have already been added to our system.`
        );
      else if (takenEmails.length > rows.length / 2)
        suggestions.push(
          `You might want to take a look at the emails because most of them are already added as shown in rows {${takenEmails.join(
            ", "
          )}}.`
        );

      if (blankPasswords.length === rows.length)
        suggestions.push(
          `All of the passwords listed in the Excel sheet have already been added to our system.`
        );
      else if (blankPasswords.length > rows.length / 2)
        suggestions.push(
          `You might want to take a look at the passswords because most of them are blank as shown in rows {${blankPasswords.join(
            ", "
          )}}.`
        );

      if (blankPositions.length === rows.length)
        suggestions.push(
          `All of the positions listed in the Excel sheet have already been added to our system.`
        );
      else if (blankPositions.length > rows.length / 2)
        suggestions.push(
          `You might want to take a look at the positions because most of them are blank as shown in rows {${blankPositions.join(
            ", "
          )}}.`
        );

      if (blankDatesStarted.length === rows.length)
        suggestions.push(
          `All of the dates started listed in the Excel sheet have already been added to our system.`
        );
      else if (blankDatesStarted.length > rows.length / 2)
        suggestions.push(
          `You might want to take a look at the DateStarted column because most of them are blank as shown in rows {${blankDatesStarted.join(
            ", "
          )}}.`
        );

      const pastTense = type === "delete" ? "deleted" : type + "ed";
      const message =
        errors.length === 0
          ? `Successfully ${pastTense} ${successCount[type]} employees!`
          : `${
              successCount[type]
            } employees successfully ${pastTense}.<br><br>${suggestions.join(
              "<br>"
            )}<br>- ${errors.join("<br>- ")}`;

      // Final batch log (same shape as your current code)
      await logBatch({
        counts: successCount,
        errorsCount: errors.length,
        suggestions,
        // errorsList: errors, // optionally include the lines you returned to the client
      });

      res.status(200).json({
        success: true,
        message,
        successPresent: successCount > 0,
        errorsPresent: errors.length > 0,
      });
    } catch (error) {
      console.error("Bulk employees upload failed:", error);
      res
        .status(500)
        .json({ success: false, message: "Failed to process bulk upload." });
    }
  },
  // CREATE REGULAR, EMPLOYEE
  registerUser: async (req, res) => {
    try {
      const {
        fullName,
        email,
        username,
        password,
        role = "regular",
        bio,
        birthday,
        photo,
        photoPublicId,
        employeeDetails: ed = {},
      } = req.body;

      const {
        position,
        reportTo,
        directReports = [],
        dates = {},
        employmentStatus = {},
      } = ed;

      const { dateStarted } = dates;

      // Basic validation
      if (!["regular", "employee"].includes(role)) {
        return res
          .status(400)
          .json({ success: false, message: "Invalid user role." });
      }

      if (!fullName || !email || !username || !password) {
        return res.status(400).json({
          success: false,
          message: "Full name, email, username, and password are required.",
        });
      }

      if (!validateEmail(email)) {
        return res
          .status(400)
          .json({ success: false, message: "Invalid email." });
      }

      const desiredUsername = normalizeUsername(username || "");
      if (!desiredUsername) {
        return res.status(400).json({
          success: false,
          message: "Invalid username.",
        });
      }
      const exists = await User.findOne({ username: desiredUsername });
      if (exists) {
        const seeds = baseUsernameSeeds({ fullName, email, birthday });
        const recs = await findAvailableUsernames(
          [desiredUsername, ...seeds],
          3
        );
        return res.status(400).json({
          success: false,
          message: "Username is already taken.",
          recommended: recs.map((u) => u.toLowerCase()),
        });
      }
      const usernameToUse = desiredUsername;

      if (
        !validatePassword.checkLength(password) ||
        !validatePassword.checkUppercase(password) ||
        !validatePassword.checkNumber(password) ||
        !validatePassword.checkSpecial(password)
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Password must be at least 6 characters long and include an uppercase letter, number, and special character.",
        });
      }

      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: "A user with that email already exists.",
        });
      }

      // 🎯 Additional validation for "regular" users
      if (role === "regular") {
        if (!birthday) {
          return res.status(400).json({
            success: false,
            message: "Birthday is required for regular users.",
          });
        }

        if (!validateDate(birthday)) {
          return res
            .status(400)
            .json({ success: false, message: "Not a valid birthday." });
        }

        const age = ageHelper.calculateAge(birthday);
        if (!ageHelper.isLegalAge(age)) {
          return res.status(400).json({
            success: false,
            message: `You must be 21 or older, you are ${age}.`,
          });
        }
      }

      // Employee-only validation
      let employeeDetails = null;
      if (role === "employee") {
        if (!position || !dateStarted) {
          return res.status(400).json({
            success: false,
            message: "Employee must have a position and start date.",
          });
        }

        if (!validateDate(dateStarted)) {
          return res
            .status(400)
            .json({ success: false, message: "Invalid start date." });
        }

        const existingPosition = await Position.findById(position).populate(
          "hierarchy",
          "name"
        );
        if (!existingPosition) {
          return res.status(400).json({
            success: false,
            message: "Position ID not found.",
          });
        }

        // 🔐 PERMISSIONS: only authenticated users can create employees
        if (!req.user?.id) {
          return res.status(401).json({
            success: false,
            message: "You must be signed in to create an employee.",
          });
        }

        // Load the actor with their hierarchy
        const actor = await User.findById(req.user.id).populate({
          path: "employeeDetails.position",
          populate: { path: "hierarchy", select: "name" },
        });

        if (!actor?.employeeDetails?.position?.hierarchy?.name) {
          return res.status(403).json({
            success: false,
            message: "Your account is missing a hierarchy assignment.",
          });
        }

        const actorLevelName = actor.employeeDetails.position.hierarchy.name;
        const targetLevelName = existingPosition.hierarchy?.name;

        const actorIdx = idxOf(actorLevelName);
        const targetIdx = idxOf(targetLevelName);
        const teamLeaderIdx = idxOf("Team Leader");

        if (actorIdx === -1 || targetIdx === -1) {
          return res.status(403).json({
            success: false,
            message: "Invalid hierarchy configuration.",
          });
        }

        // 🚫 Team Leader and below cannot add anyone
        if (actorIdx >= teamLeaderIdx) {
          return res.status(403).json({
            success: false,
            message: "Insufficient permission to add employees.",
          });
        }

        // Owner special rules
        if (actorLevelName === "Owner") {
          // Only Owner can create another Owner — and Owners cannot have a manager
          if (
            String(existingPosition.name).toLowerCase() === "owner" &&
            reportTo
          ) {
            return res.status(400).json({
              success: false,
              message: "Owner cannot have a manager (reportTo must be empty).",
            });
          }

          // ✅ Owner can create any other employee (no further checks)
        } else {
          // Non-owner: target must be below actor
          const diff = targetIdx - actorIdx;

          if (diff < 1) {
            return res.status(403).json({
              success: false,
              message: "You can only create users below your hierarchy level.",
            });
          }

          if (diff === 1) {
            // exactly one level below → must report to the actor
            if (!reportTo || String(reportTo) !== String(actor._id)) {
              return res.status(403).json({
                success: false,
                message:
                  "New hires one level below must have you as their manager (reportTo must be your user ID).",
              });
            }
          }
          // diff >= 2 → allowed
        }

        let manager = null;

        manager = await User.findById(reportTo);
        if (!manager) {
          return res.status(404).json({
            success: false,
            message: "Report To user not found.",
          });
        }

        employeeDetails = {
          position,
          reportTo: reportTo || null,
          directReports: directReports || [],
          dates: {
            dateStarted,
            dateStatusLastChanged: new Date(),
          },
          employmentStatus: {
            state: "Active",
          },
        };
      }

      // Create user
      const newUser = await User.create({
        role,
        fullName,
        email,
        username: usernameToUse,
        passwordHash: bcrypt.hashSync(
          password,
          parseInt(process.env.SALT_ROUNDS)
        ),
        accountStatus: {
          state: "Active",
          isOnline: false,
          dateUsernameLastChanged: null,
        },
        profile: {
          birthday: birthday || null,
          photo: photo || "",
          photoPublicId: photoPublicId || "",
          bio: bio || "",
        },
        employeeDetails,
      });

      await newUser.save();

      await Event.updateMany(
        {
          organizer: { $exists: false },
          "contact.email": newUser.email,
        },
        {
          $set: {
            organizer: newUser._id,
          },
        }
      );

      // Send email
      const emailContent =
        role === "employee"
          ? `
        <p>Hey ${fullName},</p>
        <p>Welcome to the Tipsyverse Team! 🎉 We're thrilled to have you join us as our new 
        <strong>${(await Position.findById(position)).name}</strong>.  
        Your journey begins now — and we're excited to see the impact you'll make.</p>

        <p>Here are your account details:</p>  
        <p>
          <strong>Email:</strong> ${email}<br/>
          <strong>Username:</strong> ${username}<br/>
          <strong>Temporary Password:</strong> ${password}
        </p>

         <p>For security, please log in and change your password immediately.</p>

        <a href="${process.env.ADMIN_PORTAL_URL}/login" class="button">Log In to Your Account</a><br/>
        <br/> 
        <p>Once you're in, you’ll be able to:</p>
        <ul>
          <li>Access your dashboard and tools</li>
          <li>Manage your profile and credentials</li>
          <li>View team resources and updates</li>
          <li>Start contributing right away</li>
        </ul>

        <p>If you run into any issues or have questions, don’t hesitate to reach out.  
        We're here to support you every step of the way.</p>

        <p>Welcome aboard — we’re excited to build something amazing together! 🚀</p>
      `
          : `
        <p>Hey ${fullName},</p>
        <p>Welcome to the Tipsyverse family! 🎉 We’re so excited to have you join our community of cocktail lovers and creators. Whether you're here to explore, share, or shake things up, you're in the right place.</p>
        <p>At Tipsyverse, we celebrate great drinks, good vibes, and the people who bring them to life. Whether you're here to explore new recipes or connect with a community that shares your passion, you’re in the right place.</p>
        <p>Please log in whenever you are ready!</p>
        <a href="${process.env.FRONTEND_URL}/login" class="button">Log in Now</a><br/>
        <br/>
        <p>Thank you for being part of our journey — we can't wait to see what you’ll discover and share. Cheers to flavorful moments ahead! 🍹</p>
        <p>We're here to support you. If you have any questions, feel free to reach out.</p>
        <p>Welcome to Tipsyverse! 🚀</p>
      `;

      await sendEmail({
        to: newUser.email,
        title: "Your Tipsyverse Account",
        subject:
          role === "employee"
            ? "Welcome to the Tipsyverse Team 🎉"
            : "Welcome to Tipsyverse 🎉",
        html: emailContent,
      });

      const actor = req.user
        ? { type: "User", id: req.user.id }
        : { type: "User", id: newUser._id };

      await req.logActivity({
        action: "create",
        target: { model: "User", id: newUser._id, name: newUser.fullName },
        actor: actor,
        summary: `Created ${newUser.role} user`,
        nextSnapshot: {
          fullName: newUser.fullName,
          email: newUser.email,
          role: newUser.role,
        },
      });

      return res.status(200).json({
        success: true,
        message: `${role === "employee" ? "This" : "Congratulations 🎊 Your"} account has been created and an email has been sent to ${newUser.email}.`,
      });
    } catch (err) {
      console.error("Registration Error:", err);
      return res.status(500).json({ success: false, message: err.message });
    }
  },

  refreshToken: async (req, res) => {
    const token = req.cookies?.refreshToken || req.body?.refreshToken;
    if (!token) {
      return res.status(401).json({
        success: false,
        code: "REFRESH_TOKEN_MISSING",
        message: "Your session expired. Please sign in again.",
      });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.REFRESH_TOKEN_SECRET);
    } catch (err) {
      console.error("Invalid refresh token:", err.message);
      clearRefreshCookie(res);
      return res.status(403).json({
        success: false,
        code: "REFRESH_TOKEN_INVALID",
        message: "Your session expired. Please sign in again.",
      });
    }

    const sessionStartedAt = Number(
      decoded.sessionStartedAt || Number(decoded.iat) * 1000
    );
    const absoluteSessionLimitMs = 8 * 60 * 60 * 1000;
    if (
      !Number.isFinite(sessionStartedAt) ||
      Date.now() - sessionStartedAt >= absoluteSessionLimitMs
    ) {
      clearRefreshCookie(res);
      return res.status(401).json({
        success: false,
        code: "SESSION_ABSOLUTE_EXPIRED",
        forceLogout: true,
        message: "Your 8-hour session ended. Please sign in again.",
      });
    }

    try {
      const user = await User.findById(decoded.id).populate({
        path: "employeeDetails.position",
        populate: [
          { path: "hierarchy", select: "name description" },
          { path: "department", select: "name description" },
        ],
      });

      if (!user) {
        clearRefreshCookie(res);
        return res.status(401).json({
          success: false,
          code: "ACCOUNT_NOT_FOUND",
          forceLogout: true,
          message: "Your session is no longer valid. Please sign in again.",
        });
      }

      await reactivateExpiredSuspension(user);
      const block = getAccountAccessBlock(user);

      if (block) {
        user.accountStatus.isOnline = false;
        await user.save().catch(() => {});
        clearRefreshCookie(res);
        return res.status(block.status).json({
          success: false,
          ...block,
        });
      }

      let positionName = null;
      let positionHierarchy = null;
      let positionDepartment = null;

      if (user.role === "employee" && user.employeeDetails?.position) {
        positionName = user.employeeDetails.position.name || null;
        positionHierarchy =
          user.employeeDetails.position.hierarchy?.name || null;
        positionDepartment =
          user.employeeDetails.position.department?.name || null;
      }

      const accessToken = createAccessToken({
        id: user._id,
        email: user.email,
        username: user.username,
        fullName: user.fullName,
        role: user.role,
        positionName,
        positionHierarchy,
        positionDepartment,
        sessionStartedAt,
      });

      // If the browser dropped the cookie but local storage still had a valid
      // refresh token, restore the cookie so future refreshes use the safer path.
      if (!req.cookies?.refreshToken && req.body?.refreshToken) {
        res.cookie("refreshToken", token, {
          ...getRefreshCookieOptions(),
          maxAge: 7 * 24 * 60 * 60 * 1000,
        });
      }

      // Don't let logging break refresh
      try {
        await req.logActivity?.({
          action: "other",
          target: { model: "User", id: decoded.id },
          summary: "Issued access token via refresh token",
        });
      } catch (logErr) {
        console.error("Failed to log activity in refreshToken:", logErr);
      }

      return res.status(200).json({ accessToken, sessionStartedAt });
    } catch (err) {
      console.error("Error in refreshToken:", err);
      return res.status(500).json({
        success: false,
        code: "REFRESH_TEMPORARILY_UNAVAILABLE",
        message: "We could not refresh your session right now. Please try again.",
      });
    }
  },

  // LOGIN AND LOGOUT
  login: async (req, res) => {
    try {
      const {
        emailOrUsername,
        email, // legacy support
        username, // legacy support
        password,
      } = req.body;

      const identifier = (emailOrUsername ?? email ?? username ?? "").trim();

      if (!identifier || !password) {
        return res.status(400).json({
          success: false,
          message: "Please provide your email/username and password.",
        });
      }
      // detect email vs username
      const identTrimmed = String(identifier).trim();
      const isEmail = validateEmail(identTrimmed);
      const query = isEmail
        ? { email: identTrimmed.toLowerCase() }
        : { username: normalizeUsername(identTrimmed) };

      const user = await User.findOne(query).populate({
          path: "employeeDetails.position",
          populate: [
            { path: "hierarchy", select: "name description" },
            { path: "department", select: "name description" },
          ],
        });

      const invalid = { success: false, message: "Invalid credentials." };
      if (!user) return res.status(400).json(invalid);

      const isMatch = await bcrypt.compare(password, user.passwordHash);

      if (!isMatch) return res.status(400).json(invalid);

      // 🔒 Account state checks (unchanged)
      const s = user.accountStatus || {};
      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);

      if (s.state === "Suspended") {
        if (s.suspensionIndefinite) {
          return res.status(403).json({
            success: false,
            message: `Your account is suspended until further notice.`,
          });
        }

        if (!s.suspensionIndefinite && s.suspensionDateEnds) {
          const endTs = new Date(s.suspensionDateEnds);
          const dayOnlyUTC = new Date(
            Date.UTC(
              endTs.getUTCFullYear(),
              endTs.getUTCMonth(),
              endTs.getUTCDate()
            )
          );
          const untilStr = new Intl.DateTimeFormat("en-US", {
            timeZone: "UTC",
          }).format(dayOnlyUTC);

          const endDayLocal = new Date(endTs);
          endDayLocal.setHours(0, 0, 0, 0);

          if (endDayLocal < startOfToday) {
            user.accountStatus.state = "Active";
            user.accountStatus.reasonForSuspension = "";
            user.accountStatus.suspensionIndefinite = false;
            user.accountStatus.suspensionDateEnds = null;
          } else {
            return res.status(403).json({
              success: false,
              message: `Your account is suspended until ${untilStr}.`,
              suspendedUntil: untilStr,
            });
          }
        }
      }

      if (s.state === "Deactivated") {
        const startedUTC = s.deactivationDateStarted
          ? startOfUTCDay(new Date(s.deactivationDateStarted))
          : null;

        if (!startedUTC) {
          user.accountStatus.state = "Active";
          user.accountStatus.deactivationDateStarted = null;
          user.accountStatus.deactivationReason = null;
        } else {
          const deadlineUTC = addMonthsUTC(startedUTC, 6);
          const todayUTC = startOfUTCDay(new Date());

          if (todayUTC > deadlineUTC) {
            return res.status(410).json({
              success: false,
              message: `This account was deactivated and has been permanently deleted after 6 months (deadline was ${formatUTC(deadlineUTC)} UTC).`,
            });
          }

          user.accountStatus.state = "Active";
          user.accountStatus.deactivationDateStarted = null;
          user.accountStatus.deactivationReason = null;
        }
      }

      if (s.state === "Terminated") {
        return res
          .status(403)
          .json({ success: false, message: "Your account is not active." });
      }

      // mark online
      user.accountStatus.isOnline = true;
      await user.save();

      let positionName = null;
      let positionHierarchy = null;
      let positionDepartment = null;

      if (user.role === "employee" && user.employeeDetails?.position) {
        positionName = user.employeeDetails.position.name || null;
        positionHierarchy =
          user.employeeDetails.position.hierarchy?.name || null;
        positionDepartment =
          user.employeeDetails.position.department?.name || null;
      }

      const sessionStartedAt = Date.now();

      // JWT payload now includes username and the absolute session start.
      const payload = {
        id: user._id,
        email: user.email,
        username: user.username,
        fullName: user.fullName,
        role: user.role,
        positionName,
        positionHierarchy,
        positionDepartment,
        sessionStartedAt,
      };

      const accessToken = createAccessToken(payload);
      const refreshToken = createRefreshToken(payload);

      await req.logActivity({
        action: "login",
        target: { model: "User", id: user._id, name: user.fullName },
        summary: "User logged in",
      });

      res.cookie("refreshToken", refreshToken, {
        ...getRefreshCookieOptions(),
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      });

      const userWithActivity = await withDrinkActivity(user);

      return res.json({
        success: true,
        message: "Login successful.",
        accessToken,
        refreshToken,
        sessionStartedAt,
        user: { ...userWithActivity, passwordHash: undefined },
      });
    } catch (err) {
      console.error("Login error:", err);
      return res
        .status(500)
        .json({ success: false, message: "Internal server error." });
    }
  },

  logout: async (req, res) => {
    try {
      const ALLOWED = new Set([
        "manual",
        "inactivity",
        "session-expired",
        "security",
        "admin-force",
      ]);
      const reason = ALLOWED.has((req.body?.reason || "manual").toLowerCase())
        ? req.body.reason.toLowerCase()
        : "manual";

      const userId = req.user?.id || req.user?._id || null;

      if (userId) {
        await User.findByIdAndUpdate(userId, {
          "accountStatus.isOnline": false,
        }).catch(() => {});
        await req
          .logActivity({
            action: "logout",
            target: { model: "User", id: userId },
            actor: { type: "User", id: userId },
            summary: `User logged out (${reason})`,
          })
          .catch((err) =>
            console.error("ActivityLog (logout) failed:", err?.message)
          );
      } else {
        // No valid access token — still log for auditing if you like
        await req
          .logActivity({
            action: "logout",
            target: { model: "User", id: null },
            actor: { type: "System", id: null },
            summary: `Anonymous logout (${reason})`,
          })
          .catch(() => {});
      }

      clearRefreshCookie(res);

      return res
        .status(200)
        .json({ success: true, message: "Logged out successfully." });
    } catch (err) {
      console.error("[logout] handler error:", err);
      return res.status(500).json({ success: false, message: err.message });
    }
  },

  getMyInfo: async (req, res) => {
    try {
      const user = await User.findById(req.user.id)
        .select("+bartenderProfile.shareLiveLocation")
        .populate({
          path: "employeeDetails.position",
          populate: {
            path: "hierarchy", // hierarchy inside position
            select: "name description", // optional
          },
        });
      if (!user) {
        return res
          .status(404)
          .json({ success: false, message: "User not found" });
      }

      const userWithActivity = await withDrinkActivity(user);
      return res.status(200).json(userWithActivity);
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  },

  getMyBartendingInfo: async (req, res) => {
    try {
      const currentUser = await User.findById(req.user.id);
      if (!currentUser) {
        return res.status(404).json({ success: false, message: "User not found." });
      }

      const isEmployee = currentUser.role === "employee";
      if (!currentUser.bartenderProfile && ["employee", "bartender"].includes(currentUser.role)) {
        currentUser.bartenderProfile = {
          status: isEmployee ? "approved" : "applicant",
          licenses: [],
        };
        await currentUser.save();
      }

      // 1) Required courses for bartenders
      const required = isEmployee
        ? []
        : await Course.find(
            { status: "published", requiredForRoles: "bartender" },
            { _id: 1, title: 1, slug: 1 }
          ).lean();

      const requiredIds = required.map((c) => c._id);

      // 2) User’s progress on those courses
      const progress = await CourseProgress.find(
        { userId: req.user.id, courseId: { $in: requiredIds } },
        { courseId: 1, status: 1, modulesCompleted: 1, totalModules: 1 }
      ).lean();

      const progressByCourse = new Map(
        progress.map((p) => [String(p.courseId), p])
      );

      const completedIds = new Set(
        progress
          .filter((p) => p.status === "completed")
          .map((p) => String(p.courseId))
      );

      // 3) Checklist for required courses (+ percent)
      const courseChecklist = required.map((c) => {
        const p = progressByCourse.get(String(c._id));
        const done = Number(p?.modulesCompleted ?? 0);
        const total = Number(p?.totalModules ?? 0);
        const percent = total > 0 ? Math.round((done / total) * 100) : 0;

        return {
          key: String(c._id),
          type: "course",
          label: c.title,
          link: `/learn/${c.slug}`,
          done: completedIds.has(String(c._id)),
          percent,
        };
      });

      const coursesComplete =
        requiredIds.length === 0 ||
        requiredIds.every((id) => completedIds.has(String(id)));

      // 4) Pull minimal user bartender profile info
      const me = currentUser.toObject();

      const now = new Date();
      const licenses = me?.bartenderProfile?.licenses || [];
      const licenseVerified = licenses.some(
        (l) => l.verified === true && l.expiresAt && new Date(l.expiresAt) > now
      );
      const profileApproved = me?.bartenderProfile?.status === "approved";

      // 5) Check payout links
      const payoutLinks = me?.bartenderProfile?.payoutLinks || {};
      const hasPayoutLink = ["cashApp", "zelle", "paypal", "venmo"].some(
        (key) => String(payoutLinks[key] || "").trim().length > 0
      );
      const onboardingDocuments = normalizeOnboardingDocuments(
        me?.bartenderProfile?.onboardingDocuments
      );
      const documentsReceived = allOnboardingDocumentsReceived(onboardingDocuments);
      const contactInfoComplete = hasBartenderContactInfo(me?.bartenderProfile);

      // console.log("coursesComplete: ", coursesComplete);
      // console.log("licenseVerified: ", licenseVerified);
      // console.log("profileApproved: ", profileApproved);
      const paymentStep = {
        key: "payout",
        type: "payout",
        label: "Add payout link",
        link: "/bartend/earnings",
        done: hasPayoutLink,
      };

      const contactStep = {
        key: "contact_info",
        type: "contact",
        label: "Add phone and emergency contact",
        link: "/bartend/preferences",
        done: contactInfoComplete,
      };

      // 6) Non-course steps
      const licenseStep = {
        key: "license",
        type: "license",
        label: "Valid, verified bartending license",
        link: "/bartend/licenses", // or wherever your license flow is
        done: licenseVerified,
      };

      const profileStep = {
        key: "profile",
        type: "profile",
        label: "Bartender profile approved",
        link: "/bartend",
        done: profileApproved,
      };

      const documentsStep = {
        key: "sign_documents",
        type: "documents",
        label: "Sign all documents",
        link: "/bartend",
        done: documentsReceived,
      };

      // 7) Combined steps (courses first, then account items)
      const steps = [
        ...courseChecklist,
        licenseStep,
        contactStep,
        paymentStep,
        documentsStep,
        profileStep,
      ];

      // 8) Overall eligibility
      const eligible =
        coursesComplete &&
        licenseVerified &&
        documentsReceived &&
        profileApproved &&
        contactInfoComplete &&
        hasPayoutLink;

      // Completing every bartender requirement promotes a regular account
      // immediately. Employees retain their employee access.
      if (eligible && currentUser.role === "regular") {
        currentUser.role = "bartender";
        await currentUser.save();
      }

      // Optional high-level summary
      const requiredCount = requiredIds.length;
      const progressCount = progress.length;
      const overallPercent = (() => {
        if (requiredCount === 0) return 0;
        const passed = courseChecklist.filter((s) => s.done).length;
        return Math.round((passed / requiredCount) * 100);
      })();

      return res.json({
        eligible,
        steps,
        onboardingDocuments,
        summary: {
          requiredCourses: requiredCount,
          requiredCoursesCompleted: courseChecklist.filter((s) => s.done)
            .length,
          overallPercent,
          progressDocsFound: progressCount,
          hasPayoutLink,
          documentsReceived,
          contactInfoComplete,
          coursesRequired: !isEmployee,
        },
      });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  },

  // "/me/bartender/location",
  updateCurrentLocation: async (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated." });
      }

      const { lat, lng, enabled } = req.body;

      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found." });
      }

      if (!user.bartenderProfile && ["employee", "bartender"].includes(user.role)) {
        user.bartenderProfile = {
          status: user.role === "employee" ? "approved" : "applicant",
          licenses: [],
        };
      }

      if (!user.bartenderProfile) {
        return res
          .status(400)
          .json({ message: "Bartender profile not found for this user." });
      }

      const shareLive = user.bartenderProfile.shareLiveLocation || {};

      // 🔹 Case 1: explicitly turning OFF sharing (no lat/lng required)
      if (enabled === false) {
        shareLive.enabled = false;
        shareLive.updatedAt = new Date();
        // optional: clear lastPoint if you want to fully “forget” last location
        // shareLive.lastPoint = undefined;

        user.bartenderProfile.shareLiveLocation = shareLive;
        await user.save();

        if (req.logActivity) {
          await req.logActivity({
            action: "update",
            target: { model: "User", id: user._id },
            title: "Updated Live Location",
            description: "Live location disabled.",
            metadata: {
              enabled: shareLive.enabled,
            },
          });
        }

        return res.json({
          message: "Live location disabled.",
          shareLiveLocation: shareLive,
        });
      }

      // 🔹 Case 2: updating / enabling with lat+lng
      const latNum = Number(lat);
      const lngNum = Number(lng);

      if (
        !Number.isFinite(latNum) ||
        !Number.isFinite(lngNum) ||
        latNum < -90 ||
        latNum > 90 ||
        lngNum < -180 ||
        lngNum > 180
      ) {
        return res.status(400).json({ message: "Invalid lat/lng." });
      }

      const now = new Date();

      user.bartenderProfile.shareLiveLocation = {
        enabled: typeof enabled === "boolean" ? enabled : true,
        lastPoint: {
          type: "Point",
          coordinates: [lngNum, latNum], // GeoJSON: [lng, lat]
        },
        updatedAt: now,
      };

      await user.save();

      if (req.logActivity) {
        await req.logActivity({
          action: "update",
          target: { model: "User", id: user._id },
          title: "Updated Live Location",
          description: `Updated current location to (${latNum}, ${lngNum})`,
          metadata: {
            lat: latNum,
            lng: lngNum,
            enabled: user.bartenderProfile.shareLiveLocation.enabled,
          },
        });
      }

      return res.status(200).json({
        message: "Location updated.",
        shareLiveLocation: user.bartenderProfile.shareLiveLocation,
      });
    } catch (err) {
      console.error("Error in updateCurrentLocation:", err);

      if (req.logActivity) {
        await req.logActivity({
          action: "other",
          target: { model: "User", id: req.user?.id || req.user?._id },
          summary: `Failed to update live location: ${err.message}`,
        }).catch((logErr) =>
          console.error("ActivityLog (live location error) failed:", logErr?.message)
        );
      }

      return res.status(500).json({ message: "Failed to update location." });
    }
  },

  updateMyPayoutLinks: async (req, res) => {
    try {
      const userId = req.user?.id || req.user?._id;
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated." });
      }

      const user = await User.findById(userId).select("role bartenderProfile").lean();
      if (!user) return res.status(404).json({ message: "User not found." });

      const allowed = ["preferredProvider", "cashApp", "zelle", "paypal", "venmo", "notes"];
      const nextLinks = {
        ...(user.bartenderProfile?.payoutLinks || {}),
      };

      allowed.forEach((key) => {
        if (Object.prototype.hasOwnProperty.call(req.body || {}, key)) {
          nextLinks[key] = String(req.body[key] || "").trim();
        }
      });
      if (!["", "cashApp", "zelle", "paypal", "venmo"].includes(nextLinks.preferredProvider)) {
        nextLinks.preferredProvider = "";
      }
      nextLinks.updatedAt = new Date();

      const setPatch = !user.bartenderProfile
        ? {
            bartenderProfile: {
              status: user.role === "employee" ? "approved" : "applicant",
              licenses: [],
              payoutLinks: nextLinks,
            },
          }
        : {
            "bartenderProfile.payoutLinks": nextLinks,
          };

      const updated = await User.findByIdAndUpdate(
        userId,
        { $set: setPatch },
        { new: true, runValidators: false }
      ).select("bartenderProfile.payoutLinks");

      await req.logActivity?.({
        action: "update",
        target: { model: "User", id: userId },
        summary: "Updated bartender payout links",
      });

      return res.json({
        success: true,
        data: updated?.bartenderProfile?.payoutLinks || nextLinks,
      });
    } catch (err) {
      console.error("updateMyPayoutLinks error:", err);
      return res.status(500).json({
        message:
          process.env.NODE_ENV === "production"
            ? "Failed to update payout links."
            : err.message || "Failed to update payout links.",
      });
    }
  },

  updateMyBartenderContactInfo: async (req, res) => {
    try {
      const userId = req.user?.id || req.user?._id;
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated." });
      }

      const user = await User.findById(userId).select("role bartenderProfile").lean();
      if (!user) return res.status(404).json({ message: "User not found." });

      const body = req.body || {};
      const emergency = body.emergencyContact || {};
      const nextContactInfo = {
        ...(user.bartenderProfile?.contactInfo || {}),
        phone: String(body.phone || "").trim(),
        emergencyContact: {
          ...(user.bartenderProfile?.contactInfo?.emergencyContact || {}),
          fullName: String(emergency.fullName || "").trim(),
          relationship: String(emergency.relationship || "").trim(),
          phone: String(emergency.phone || "").trim(),
          email: String(emergency.email || "").trim(),
        },
        updatedAt: new Date(),
      };

      const setPatch = !user.bartenderProfile
        ? {
            bartenderProfile: {
              status: user.role === "employee" ? "approved" : "applicant",
              licenses: [],
              contactInfo: nextContactInfo,
            },
          }
        : {
            "bartenderProfile.contactInfo": nextContactInfo,
          };

      const updated = await User.findByIdAndUpdate(
        userId,
        { $set: setPatch },
        { new: true, runValidators: false }
      ).select("bartenderProfile.contactInfo");

      await req.logActivity?.({
        action: "update",
        target: { model: "User", id: userId },
        summary: "Updated bartender contact information",
      });

      return res.json({
        success: true,
        data: updated?.bartenderProfile?.contactInfo || nextContactInfo,
      });
    } catch (err) {
      console.error("updateMyBartenderContactInfo error:", err);
      return res.status(500).json({
        message:
          process.env.NODE_ENV === "production"
            ? "Failed to update bartender contact information."
            : err.message || "Failed to update bartender contact information.",
      });
    }
  },

  /* ────────────────────────────────────────────────────────────── */
  /* Bartender: add license                                        */
  /* POST /bartenders/me/licenses                                  */
  /* body: { state, permitNumber, expiresAt }                      */
  /* ────────────────────────────────────────────────────────────── */

  createMyLicense: async (req, res) => {
    try {
      const { state, permitNumber, expiresAt } = req.body || {};

      if (!state || !permitNumber || !expiresAt) {
        return res.status(400).json({
          success: false,
          message: "State, license number, and expiration date are required.",
        });
      }

      const expDate = new Date(expiresAt);
      const today = startOfToday();

      if (!(expDate instanceof Date) || isNaN(expDate.getTime())) {
        return res
          .status(400)
          .json({ success: false, message: "Invalid expiration date." });
      }

      if (expDate < today) {
        return res.status(400).json({
          success: false,
          message: "Expiration date cannot be in the past.",
        });
      }

      const user = await User.findById(req.user.id);
      if (!user) {
        return res
          .status(404)
          .json({ success: false, message: "User not found." });
      }

      // 🔹 Ensure bartenderProfile exists with all the nested defaults
      if (!user.bartenderProfile) {
        user.bartenderProfile = {
          status: "applicant",
          licenses: [],
          serviceAddresses: [],
          shareLiveLocation: {
            enabled: false,
            lastPoint: undefined,
            updatedAt: undefined,
          },
          availabilityRules: [],
          scheduleBlocks: [],
          stats: {
            yearsWithTipsyverse: 0,
            totalExperienceYears: 0,
            jobsAcceptedLast30d: 0,
            upcomingAssignments: 0,
            ratingAvg: 0,
            ratingCount: 0,
          },
        };
      } else if (!Array.isArray(user.bartenderProfile.licenses)) {
        user.bartenderProfile.licenses = [];
      }

      const normalizedState = String(state).toUpperCase().trim();
      const normalizedPermit = String(permitNumber).trim().toLowerCase();

      // 🔹 Prevent duplicate (state + permitNumber)
      const hasDuplicate = (user.bartenderProfile.licenses || []).some(
        (lic) => {
          const s = (lic.state || "").toUpperCase().trim();
          const p = (lic.permitNumber || "").trim().toLowerCase();
          return s === normalizedState && p === normalizedPermit;
        }
      );

      if (hasDuplicate) {
        return res.status(400).json({
          success: false,
          message:
            "You already have a license with this state and license number.",
        });
      }

      // 🔹 Push new license
      user.bartenderProfile.licenses.push({
        state: normalizedState,
        permitNumber,
        expiresAt: expDate,
        verified: false,
        status: "pending",
        decisionNote: "",
      });

      // Make sure Mongoose knows bartenderProfile changed
      user.markModified("bartenderProfile");

      await user.save();

      const latest =
        user.bartenderProfile.licenses[
          user.bartenderProfile.licenses.length - 1
        ];

      if (req.logActivity) {
        await req
          .logActivity({
            action: "create",
            target: { model: "User", id: latest._id },
            actor: { type: "User", id: req.user.id },
            summary: `Bartender added a new license (${latest.state} – #${latest.permitNumber})`,
            meta: {
              bartenderId: user._id,
              state: latest.state,
              permitNumber: latest.permitNumber,
              expiresAt: latest.expiresAt,
            },
          })
          .catch((err) =>
            console.error("ActivityLog (create license) failed:", err?.message)
          );
      }

      return res.status(201).json({
        success: true,
        data: formatLicenseForResponse(user, latest),
      });
    } catch (err) {
      console.error("createMyLicense error", err);
      return res
        .status(500)
        .json({ success: false, message: "Failed to create license." });
    }
  },

  /* ────────────────────────────────────────────────────────────── */
  /* Bartender: view license                                        */
  /* POST /bartenders/me/:licenseId                                  */
  /* ────────────────────────────────────────────────────────────── */
  getLicenseById: async (req, res) => {
    try {
      const { licenseId } = req.params;
      const isEmployee = req.user.role === "employee";

      // Employees can view *any* bartender's license.
      // Bartenders can only view their own license.
      const baseQuery = isEmployee
        ? { "bartenderProfile.licenses._id": licenseId }
        : { _id: req.user.id, "bartenderProfile.licenses._id": licenseId };

      const user = await User.findOne(baseQuery, {
        "bartenderProfile.licenses.$": 1, // only matching license
        fullName: 1,
        email: 1,
        role: 1,
      }).lean();

      if (
        !user ||
        !user.bartenderProfile ||
        !user.bartenderProfile.licenses?.length
      ) {
        return res
          .status(404)
          .json({ success: false, message: "License not found." });
      }

      const lic = user.bartenderProfile.licenses[0];

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const status =
        lic.status ||
        (lic.verified
          ? new Date(lic.expiresAt) < today
            ? "expired"
            : "active"
          : "pending");

      return res.json({
        success: true,
        data: {
          id: lic._id,
          _id: lic._id,
          state: lic.state,
          permitNumber: lic.permitNumber,
          expiresAt: lic.expiresAt,
          verified: lic.verified,
          status,
          userId: user._id,
          fullName: user.fullName,
          email: user.email,
          userRole: user.role,
        },
      });
    } catch (err) {
      console.error("getLicenseById error", err);
      return res
        .status(500)
        .json({ success: false, message: "Failed to load license." });
    }
  },

  listBartenderLicensesForAdmin: async (req, res) => {
    try {
      // Query params for filtering/pagination
      const {
        page = 1,
        limit = 20,
        status,
        state,
        search,
        sortBy = "createdAt",
        sortOrder = "desc", // or "asc"
      } = req.query;

      const pageNum = Math.max(parseInt(page, 10) || 1, 1);
      const pageSize = Math.max(parseInt(limit, 10) || 20, 1);

      // Base match: users who have at least one license
      const baseMatch = {
        "bartenderProfile.licenses": { $exists: true, $ne: [] },
      };

      // We’ll add license-level filters in a second
      const licenseMatch = {};

      if (status) {
        // allow "pending,active" for multiple
        const statuses = String(status)
          .split(",")
          .map((s) => s.trim().toLowerCase())
          .filter(Boolean);

        if (statuses.length) {
          licenseMatch["bartenderProfile.licenses.status"] = {
            $in: statuses,
          };
        }
      }

      if (state) {
        const states = String(state)
          .split(",")
          .map((s) => s.trim().toUpperCase())
          .filter(Boolean);

        if (states.length) {
          licenseMatch["bartenderProfile.licenses.state"] = { $in: states };
        }
      }

      if (search) {
        const s = String(search).trim();
        if (s) {
          // Search bartender's name/email OR permitNumber
          licenseMatch.$or = [
            { fullName: { $regex: s, $options: "i" } },
            { email: { $regex: s, $options: "i" } },
            {
              "bartenderProfile.licenses.permitNumber": {
                $regex: s,
                $options: "i",
              },
            },
          ];
        }
      }

      // Build sort on license fields (e.g., expiresAt, status) or user fields
      const sortFieldMap = {
        createdAt: "bartenderProfile.licenses._id",
        expiresAt: "bartenderProfile.licenses.expiresAt",
        state: "bartenderProfile.licenses.state",
        status: "bartenderProfile.licenses.status",
        name: "fullName",
      };

      const sortField = sortFieldMap[sortBy] || "bartenderProfile.licenses._id";
      const sortDir = sortOrder === "asc" ? 1 : -1;

      const pipeline = [
        { $match: baseMatch },
        { $unwind: "$bartenderProfile.licenses" },
        { $match: licenseMatch },
        {
          $sort: {
            [sortField]: sortDir,
          },
        },
        {
          $facet: {
            items: [
              { $skip: (pageNum - 1) * pageSize },
              { $limit: pageSize },
              {
                $project: {
                  _id: 0,
                  bartenderId: "$_id",
                  bartenderName: "$fullName",
                  bartenderEmail: "$email",
                  bartenderStatus: "$bartenderProfile.status",
                  bartenderPhoto: "$profile.photo",

                  licenseId: "$bartenderProfile.licenses._id",
                  state: "$bartenderProfile.licenses.state",
                  permitNumber: "$bartenderProfile.licenses.permitNumber",
                  expiresAt: "$bartenderProfile.licenses.expiresAt",
                  verified: "$bartenderProfile.licenses.verified",
                  status: "$bartenderProfile.licenses.status",
                  decisionNote: "$bartenderProfile.licenses.decisionNote",
                },
              },
            ],
            totalCount: [{ $count: "count" }],
          },
        },
      ];

      const result = await User.aggregate(pipeline);

      const items = result[0]?.items || [];
      const totalCount = result[0]?.totalCount?.[0]?.count || 0;

      return res.status(200).json({
        success: true,
        data: items,
        pagination: {
          page: pageNum,
          limit: pageSize,
          total: totalCount,
          totalPages: Math.ceil(totalCount / pageSize) || 1,
        },
      });
    } catch (err) {
      console.error("listBartenderLicensesForAdmin error:", err);
      return res.status(500).json({
        success: false,
        message: "Failed to load licenses.",
      });
    }
  },
  /* ────────────────────────────────────────────────────────────── */
  /* Bartender: edit license                                       */
  /* PATCH /bartenders/me/licenses/:licenseId                      */
  /* body: { state?, permitNumber?, expiresAt? }                   */
  /* On any edit, go back to pending (verified=false).             */
  /* ────────────────────────────────────────────────────────────── */

  updateMyLicense: async (req, res) => {
    try {
      const { licenseId } = req.params;
      const { state, permitNumber, expiresAt } = req.body || {};

      const user = await User.findById(req.user.id);
      if (!user || !user.bartenderProfile) {
        return res.status(404).json({
          success: false,
          message: "Bartender profile not found.",
        });
      }

      const license =
        user.bartenderProfile.licenses.id(licenseId) ||
        user.bartenderProfile.licenses.find(
          (l) => String(l._id) === String(licenseId)
        );

      if (!license) {
        return res
          .status(404)
          .json({ success: false, message: "License not found." });
      }

      if (state !== undefined) license.state = state;
      if (permitNumber !== undefined) license.permitNumber = permitNumber;

      if (expiresAt !== undefined) {
        const expDate = new Date(expiresAt);
        const today = startOfToday();
        if (expDate < today) {
          return res.status(400).json({
            success: false,
            message: "Expiration date cannot be in the past.",
          });
        }
        license.expiresAt = expDate;
      }

      // Any edit from bartender → back to pending for employees to review
      license.verified = false;
      license.status = "pending";
      license.decisionNote = "";

      await user.save();

      await req
        .logActivity({
          action: "update",
          target: { model: "License", id: license._id },
          actor: { type: "User", id: req.user.id },
          summary: `Bartender updated license (${license.state} – #${license.permitNumber})`,
          meta: {
            state: license.state,
            permitNumber: license.permitNumber,
            expiresAt: license.expiresAt,
            verified: license.verified,
          },
        })
        .catch((err) =>
          console.error("ActivityLog (update license) failed:", err?.message)
        );

      return res.json({
        success: true,
        data: formatLicenseForResponse(user, license),
      });
    } catch (err) {
      console.error("updateMyLicense error", err);
      return res
        .status(500)
        .json({ success: false, message: "Failed to update license." });
    }
  },

  /* ────────────────────────────────────────────────────────────── */
  /* Bartender: delete license                                     */
  /* DELETE /bartenders/me/licenses/:licenseId                     */
  /* ────────────────────────────────────────────────────────────── */

  deleteMyLicense: async (req, res) => {
    try {
      const { licenseId } = req.params;

      const user = await User.findById(req.user.id);
      if (!user || !user.bartenderProfile) {
        return res.status(404).json({
          success: false,
          message: "Bartender profile not found.",
        });
      }

      const licenses = user.bartenderProfile.licenses || [];

      // Try to find index in the array
      const idx = licenses.findIndex(
        (l) => String(l._id) === String(licenseId)
      );

      if (idx === -1) {
        return res
          .status(404)
          .json({ success: false, message: "License not found." });
      }

      const license = licenses[idx];

      // Capture fields for logging BEFORE removing
      const state = license.state;
      const permitNumber = license.permitNumber;

      // Remove from the array
      licenses.splice(idx, 1);

      await user.save();

      // Activity log (best-effort, don't fail request if log fails)
      await req
        .logActivity({
          action: "delete",
          target: { model: "License", id: licenseId },
          actor: { type: "User", id: req.user.id },
          summary: `Bartender deleted a license (${state} – #${permitNumber})`,
          meta: { state, permitNumber },
        })
        .catch((err) =>
          console.error("ActivityLog (delete license) failed:", err?.message)
        );

      return res.json({ success: true, message: "License deleted." });
    } catch (err) {
      console.error("deleteMyLicense error", err);
      return res
        .status(500)
        .json({ success: false, message: "Failed to delete license." });
    }
  },

  /* ────────────────────────────────────────────────────────────── */
  /* Employee: approve / deny license                              */
  /* PATCH /users/:userId/licenses/:licenseId/decision  */
  /* body: { action: "approve" | "deny", note? }                   */
  /* ────────────────────────────────────────────────────────────── */

  reviewLicenseForAdmin: async (req, res) => {
    try {
      if (req.user.role !== "employee") {
        return res.status(403).json({
          success: false,
          message: "Only employees can approve/deny licenses.",
        });
      }

      const { userId, licenseId } = req.params;
      const { action, note } = req.body || {};

      if (!["approve", "deny"].includes(action)) {
        return res.status(400).json({
          success: false,
          message: "Action must be 'approve' or 'deny'.",
        });
      }

      const user = await User.findById(userId);
      if (!user || !user.bartenderProfile) {
        return res.status(404).json({
          success: false,
          message: "Bartender profile not found.",
        });
      }

      const license =
        user.bartenderProfile.licenses.id(licenseId) ||
        user.bartenderProfile.licenses.find(
          (l) => String(l._id) === String(licenseId)
        );

      if (!license) {
        return res
          .status(404)
          .json({ success: false, message: "License not found." });
      }

      const today = startOfToday();

      if (action === "approve") {
        license.verified = true;
        license.status =
          license.expiresAt && new Date(license.expiresAt) < today
            ? "expired"
            : "active";
        license.decisionNote = null;
      } else if (action === "deny") {
        license.verified = false;
        license.status = "denied";
        if (note !== undefined) {
          license.decisionNote = note;
        }
      }

      license.lastStatusChangeAt = new Date();
      license.lastStatusChangedBy = req.user.id;

      license.reminders = {
        d90SentOn: null,
        d14SentOn: null,
        d1SentOn: null,
        expiredNotifiedOn: null,
      };

      await user.save();

      // TODO (optional): write to ActivityLog model here
      // Log it
      await req
        .logActivity({
          action, // <-- directly from req.body
          target: { model: "User", id: userId },
          actor: { type: "User", id: req.user.id },
          summary: `Employee ${action}d bartender license`,
          meta: {
            bartenderId: user._id,
            state: license.state,
            permitNumber: license.permitNumber,
            ...(action === "deny" ? { reason: note } : {}),
          },
        })
        .catch((err) =>
          console.error(`ActivityLog (${action} license) failed:`, err?.message)
        );

      return res.json({
        success: true,
        data: formatLicenseForResponse(user, license),
      });
    } catch (err) {
      console.error("reviewLicenseForAdmin error", err);
      return res.status(500).json({
        success: false,
        message: "Failed to review license.",
      });
    }
  },

  reviewBartenderProfileForAdmin: async (req, res) => {
    try {
      if (req.user.role !== "employee") {
        return res.status(403).json({
          success: false,
          message: "Only employees can approve/deny bartender profiles.",
        });
      }

      const { userId } = req.params;
      const { action, note } = req.body || {};

      if (!["approve", "deny"].includes(action)) {
        return res.status(400).json({
          success: false,
          message: "Action must be 'approve' or 'deny'.",
        });
      }

      const user = await User.findById(userId);
      if (!user || !user.bartenderProfile) {
        return res.status(404).json({
          success: false,
          message: "Bartender profile not found.",
        });
      }

      const profile = user.bartenderProfile;

      // Update status based on action
      if (action === "approve") {
        profile.status = "approved";
        profile.dateBartendingStarted = profile.dateBartendingStarted || new Date();
      } else if (action === "deny") {
        profile.status = "denied";
      }

      // Optional: store a note on the profile
      // Make sure your schema has something like:
      //   statusNote: { type: String }
      if (note !== undefined) {
        profile.statusNote = note;
      }

      // Your new tracking fields
      const today = new Date();
      profile.lastStatusChangeAt = today;
      profile.lastStatusChangedBy = req.user.id;
      if (action === "approve" && user.role !== "employee") {
        user.role = "bartender";
      }

      await user.save();

      if (action === "approve") {
        await sendNotification?.({
          type: "bartender_profile_approved",
          entity: user._id,
          entityId: user._id,
          entityModel: "User",
          actor: { id: req.user.id },
          recipients: [{ id: user._id }],
          slug: "bartend",
          messageBase:
            "Congratulations! You’re approved to bartend with Tipsyverse.",
        }).catch((err) =>
          console.error("Bartender approval notification failed:", err?.message)
        );

        if (user.email) {
          await sendEmail?.({
            to: user.email,
            subject: "Congratulations — you’re approved to bartend with Tipsyverse!",
            title: "Welcome to the Tipsyverse Bartender Team",
            html: `
              <p>Congratulations ${user.fullName || user.firstName || "there"}!</p>
              <p>You’ve met the requirements and have been approved to bartend with Tipsyverse.</p>
              <p>Your bartender start date has been recorded as ${new Date(
                profile.dateBartendingStarted
              ).toLocaleDateString()}.</p>
              <div class="button-wrapper">
                <a href="${process.env.FRONTEND_URL || process.env.ADMIN_PORTAL_URL || "http://localhost:3000"}/bartend" class="button">Open Bartender Portal</a>
              </div>
              <p>We’re glad to have you with us.</p>
            `,
          });
        }
      }

      // Activity log (optional, same pattern as licenses)
      await req
        .logActivity({
          action, // "approve" or "deny"
          target: { model: "User", id: user._id },
          actor: { type: "User", id: req.user.id },
          summary: `Employee ${action}d bartender profile`,
          meta: {
            bartenderId: user._id,
            newStatus: profile.status,
            ...(note ? { reason: note } : {}),
          },
        })
        .catch((err) =>
          console.error(
            `ActivityLog (${action} bartender profile) failed:`,
            err?.message
          )
        );

      return res.json({
        success: true,
        data: formatBartenderProfileForResponse(user),
      });
    } catch (err) {
      console.error("reviewBartenderProfileForAdmin error", err);
      return res.status(500).json({
        success: false,
        message: "Failed to review bartender profile.",
      });
    }
  },

  updateBartenderCompensationForAdmin: async (req, res) => {
    try {
      const { userId } = req.params;
      const actor = await User.findById(req.user.id)
        .populate("employeeDetails.position", "name")
        .select("role employeeDetails.position")
        .lean();
      const positionName = String(
        actor?.employeeDetails?.position?.name || ""
      ).toLowerCase();
      const isOwnerPosition =
        positionName === "owner" || positionName === "owners";

      if (!isOwnerPosition) {
        return res.status(403).json({
          success: false,
          message: "Only Owner position users can update bartender rates.",
        });
      }

      const hourlyRate = Number(req.body?.hourlyRate);
      const maxHourlyRate = Number(req.body?.maxHourlyRate);
      const annualIncrease = Number(req.body?.annualIncrease);

      if (!Number.isFinite(hourlyRate) || hourlyRate < 40) {
        return res.status(400).json({
          success: false,
          message: "Hourly rate must be at least $40.00.",
        });
      }
      if (!Number.isFinite(maxHourlyRate) || maxHourlyRate < hourlyRate) {
        return res.status(400).json({
          success: false,
          message: "Maximum hourly rate must be greater than or equal to the hourly rate.",
        });
      }
      if (!Number.isFinite(annualIncrease) || annualIncrease < 0) {
        return res.status(400).json({
          success: false,
          message: "Annual increase must be zero or greater.",
        });
      }

      const user = await User.findById(userId);
      if (!user || !user.bartenderProfile) {
        return res.status(404).json({
          success: false,
          message: "Bartender profile not found.",
        });
      }

      user.bartenderProfile.compensation = {
        ...(user.bartenderProfile.compensation || {}),
        hourlyRate,
        maxHourlyRate,
        annualIncrease,
        updatedAt: new Date(),
        updatedBy: req.user.id,
      };
      user.markModified("bartenderProfile");
      await user.save();

      await req
        .logActivity({
          action: "update",
          target: { model: "User", id: user._id },
          actor: { type: "User", id: req.user.id },
          summary: "Updated bartender compensation settings",
          meta: {
            bartenderId: user._id,
            hourlyRate,
            maxHourlyRate,
            annualIncrease,
          },
        })
        .catch((err) =>
          console.error("ActivityLog (bartender compensation) failed:", err?.message)
        );

      return res.json({
        success: true,
        data: user.bartenderProfile.compensation,
      });
    } catch (err) {
      console.error("updateBartenderCompensationForAdmin error:", err);
      return res.status(500).json({
        success: false,
        message: "Failed to update bartender compensation.",
      });
    }
  },

  updateBartenderOnboardingDocumentForAdmin: async (req, res) => {
    try {
      const { userId, documentKey } = req.params;
      const { status, sentAt, receivedAt, notes } = req.body || {};

      if (!BARTENDER_ONBOARDING_DOCUMENTS.some((doc) => doc.key === documentKey)) {
        return res.status(400).json({
          success: false,
          message: "Unknown onboarding document.",
        });
      }

      if (status && !BARTENDER_DOCUMENT_STATUSES.has(status)) {
        return res.status(400).json({
          success: false,
          message: "Invalid document status.",
        });
      }

      const user = await User.findById(userId);
      if (!user || !user.bartenderProfile) {
        return res.status(404).json({
          success: false,
          message: "Bartender profile not found.",
        });
      }

      const existing = normalizeOnboardingDocuments(
        user.bartenderProfile.onboardingDocuments
      ).find((doc) => doc.key === documentKey);

      const update = {
        key: documentKey,
        status: status || existing?.status || "not_sent",
        sentAt: sentAt ? new Date(sentAt) : sentAt === null ? null : existing?.sentAt || null,
        receivedAt: receivedAt
          ? new Date(receivedAt)
          : receivedAt === null
          ? null
          : existing?.receivedAt || null,
        notes: notes ?? existing?.notes ?? "",
      };

      upsertOnboardingDocuments(
        user.bartenderProfile,
        [update],
        req.user.id
      );
      user.markModified("bartenderProfile");
      await user.save();

      await req
        .logActivity({
          action: "update",
          target: { model: "User", id: user._id },
          actor: { type: "User", id: req.user.id },
          summary: "Updated bartender onboarding document status",
          meta: {
            bartenderId: user._id,
            documentKey,
            status: update.status,
          },
        })
        .catch((err) =>
          console.error("ActivityLog (document status) failed:", err?.message)
        );

      return res.json({
        success: true,
        data: normalizeOnboardingDocuments(
          user.bartenderProfile.onboardingDocuments
        ),
      });
    } catch (err) {
      console.error("updateBartenderOnboardingDocumentForAdmin error:", err);
      return res.status(500).json({
        success: false,
        message: "Failed to update onboarding document.",
      });
    }
  },

  sendBartenderOnboardingDocumentsForAdmin: async (req, res) => {
    try {
      const { userId } = req.params;
      const user = await User.findById(userId);

      if (!user || !user.bartenderProfile) {
        return res.status(404).json({
          success: false,
          message: "Bartender profile not found.",
        });
      }

      if (!user.email) {
        return res.status(400).json({
          success: false,
          message: "This bartender does not have an email address.",
        });
      }

      const documents = normalizeOnboardingDocuments(
        user.bartenderProfile.onboardingDocuments
      );
      const requestedDocuments = documents.filter(
        (doc) => doc.status !== "received"
      );

      if (!requestedDocuments.length) {
        return res.status(400).json({
          success: false,
          message: "All onboarding documents are already marked received.",
        });
      }

      const attachments = buildOnboardingDocumentAttachments(
        requestedDocuments.map((doc) => doc.key)
      );
      const documentListHtml = requestedDocuments
        .map((doc) => `<li><strong>${doc.title}</strong> - ${doc.summary}</li>`)
        .join("");

      const emailResult = await sendEmail({
        to: user.email,
        subject: "Tipsyverse onboarding documents required",
        title: "Tipsyverse Onboarding Documents",
        attachments,
        html: `
          <p>Hi ${user.fullName || "there"},</p>
          <p>Please complete the onboarding documents listed below. Sign and date each document, then reply to this email with the completed copies attached.</p>
          <ul>${documentListHtml}</ul>
          <p>Once we receive and review your signed documents, Tipsyverse admin will mark them as received in your bartender checklist.</p>
          <p>If anything needs to be corrected, we will let you know.</p>
        `,
      });

      if (!emailResult?.success) {
        return res.status(500).json({
          success: false,
          message: emailResult?.message || "Failed to send onboarding documents.",
        });
      }

      const sentAt = new Date();
      upsertOnboardingDocuments(
        user.bartenderProfile,
        requestedDocuments.map((doc) => ({
          key: doc.key,
          status: doc.status === "not_sent" ? "sent" : doc.status,
          sentAt,
          receivedAt: doc.receivedAt || null,
          notes: doc.notes || "",
        })),
        req.user.id
      );
      user.markModified("bartenderProfile");
      await user.save();

      await req
        .logActivity({
          action: "other",
          target: { model: "User", id: user._id },
          actor: { type: "User", id: req.user.id },
          summary: "Sent bartender onboarding document request",
          meta: {
            bartenderId: user._id,
            documents: requestedDocuments.map((doc) => doc.key),
            attachmentCount: attachments.length,
          },
        })
        .catch((err) =>
          console.error("ActivityLog (document email) failed:", err?.message)
        );

      return res.json({
        success: true,
        message: `Onboarding document request sent to ${user.email}.`,
        data: normalizeOnboardingDocuments(
          user.bartenderProfile.onboardingDocuments
        ),
        attachmentsSent: attachments.length,
      });
    } catch (err) {
      console.error("sendBartenderOnboardingDocumentsForAdmin error:", err);
      return res.status(500).json({
        success: false,
        message: "Failed to send onboarding document request.",
      });
    }
  },

  // usage: GET /api/users/me/requirements?role=bartender
  getMyRoleRequirements: async (req, res) => {
    try {
      const role = String(req.query.role || "")
        .trim()
        .toLowerCase();
      if (!role)
        return res
          .status(400)
          .json({ success: false, message: "role is required" });

      if (role === "bartender" && req.user?.role === "employee") {
        return res.json({
          role,
          eligible: true,
          checklist: [],
          progressCount: 0,
          requiredCount: 0,
          coursesRequired: false,
        });
      }

      const required = await Course.find(
        { status: "published", requiredForRoles: role },
        { _id: 1, title: 1, slug: 1 }
      ).lean();

      const ids = required.map((c) => c._id);
      const progress = await CourseProgress.find(
        { userId: req.user.id, courseId: { $in: ids } },
        { courseId: 1, status: 1 }
      ).lean();

      const completedIds = new Set(
        progress
          .filter((p) => p.status === "completed")
          .map((p) => String(p.courseId))
      );
      const checklist = required.map((c) => ({
        key: String(c._id),
        label: c.title,
        done: completedIds.has(String(c._id)),
        link: `/learn/${c.slug}`,
      }));

      const eligible = ids.every((id) => completedIds.has(String(id)));
      return res.json({
        role,
        eligible,
        checklist,
        progressCount: progress.length,
        requiredCount: ids.length,
      });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  },

  // pseudo-code

  // FORGOT PASSWORD AND RESET PASSWORD
  forgotPassword: async (req, res) => {
    try {
      const { email } = req.body;

      if (!email)
        return res
          .status(400)
          .json({ success: false, message: "Email is required." });
      if (!validateEmail(email))
        return res
          .status(400)
          .json({ success: false, message: "Invalid email." });

      const user = await User.findOne({ email });
      if (!user)
        return res
          .status(404)
          .json({ success: false, message: "No user found with this email." });

      const raw = crypto.randomBytes(32).toString("hex");
      const hash = crypto.createHash("sha256").update(raw).digest("hex");

      const resetTokenExpires = new Date(Date.now() + 3600000);

      user.resetPasswordToken = hash;
      user.resetPasswordExpires = resetTokenExpires;
      await user.save();

      const resetUrl = `${process.env.ADMIN_PORTAL_URL}/reset-password/${raw}`;

      // console.log("resetUrl: ", resetUrl);
      // console.log("resetToken: ", raw);
      const emailContent = `
        <p>You requested a password reset. Click the link below to reset your password:</p>
        <p><a href="${resetUrl}" class="button">Reset Password</a></p>
        <p>If the link doesn’t work, copy and paste this URL:</p>
        <p><a href="${resetUrl}">${resetUrl}</a></p>
        <p>This link will expire in 1 hour.</p>
      `;

      await sendEmail({
        to: user.email,
        title: "Tipsyverse - Password Reset Request",
        subject: "Tipsyverse - Password Reset Request",
        html: emailContent,
      });

      await req.logActivity({
        action: "other",
        target: { model: "User", id: user._id },
        summary: "Requested password reset email",
      });

      return res.status(200).json({
        success: true,
        message: "Password reset email sent successfully.",
        raw,
        resetTokenExpires,
        data: user,
      });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  },

  resetPassword: async (req, res) => {
    try {
      const { resetToken, newPassword } = req.body;
      // console.log("resetToken: ", resetToken);
      const raw = (req.body.resetToken || req.params.token || "").trim();
      const hash = crypto.createHash("sha256").update(raw).digest("hex");

      if (!resetToken || !newPassword) {
        return res.status(400).json({
          success: false,
          message: "Invalid request. Missing required fields.",
        });
      }

      const user = await User.findOne({
        resetPasswordToken: hash,
        resetPasswordExpires: { $gt: Date.now() },
      });

      if (!user)
        return res
          .status(400)
          .json({ success: false, message: "Invalid or expired token." });

      if (
        !validatePassword.checkLength(newPassword) ||
        !validatePassword.checkUppercase(newPassword) ||
        !validatePassword.checkNumber(newPassword) ||
        !validatePassword.checkSpecial(newPassword)
      ) {
        return res.status(400).json({
          success: false,
          message: "Password must meet complexity requirements.",
        });
      }

      const hashedPassword = bcrypt.hashSync(
        newPassword,
        parseInt(process.env.SALT_ROUNDS)
      );

      user.passwordHash = hashedPassword;
      user.resetPasswordToken = null;
      user.resetPasswordExpires = null;
      await user.save();

      await req.logActivity({
        action: "update",
        target: { model: "User", id: user._id },
        actor: {
          type: "User",
          id: user._id,
          label: {
            fullName: user.fullName,
            email: user.email,
            role: user.role,
            position: user.position,
          },
        },
        summary: "Password reset via token",
        changes: [
          { path: "passwordHash", from: "[redacted]", to: "[redacted]" },
        ],
      });

      const emailContent = `
        <p>Your password has been successfully reset.</p>
        <p>If you didn’t request this change, please contact support immediately.</p>
      `;

      await sendEmail({
        to: user.email,
        title: "Tipsyverse - Password Reset Successfully",
        subject: "Tipsyverse - Password Reset Successfully",
        html: emailContent,
      });

      return res.status(200).json({
        success: true,
        message:
          "Password reset successful. You can now log in with your new password.",
      });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  },

  //UPDATE PASSWORD THROUGH SECURITY FORM
  updatePassword: async (req, res) => {
    try {
      const { newPassword } = req.body;
      const reqUser = await User.findById(req.user.id);
      if (!reqUser)
        return res
          .status(404)
          .json({ success: false, message: "Authorized user not found." });

      if (!newPassword) {
        return res.status(400).json({
          success: false,
          message: "Password is required.",
        });
      }

      // ✅ Get user ID from authenticated request
      const user = await User.findById(req.user.id);
      if (!user)
        return res
          .status(404)
          .json({ success: false, message: "User not found." });

      // ✅ Validate password
      if (
        !validatePassword.checkLength(newPassword) ||
        !validatePassword.checkUppercase(newPassword) ||
        !validatePassword.checkNumber(newPassword) ||
        !validatePassword.checkSpecial(newPassword)
      ) {
        return res.status(400).json({
          success: false,
          message: "Password must meet complexity requirements.",
        });
      }

      // ✅ Hash and update
      const hashedPassword = bcrypt.hashSync(
        newPassword,
        parseInt(process.env.SALT_ROUNDS)
      );
      user.passwordHash = hashedPassword;
      await user.save();

      await req.logActivity({
        action: "update",
        target: { model: "User", id: user._id },
        actor: {
          type: "User",
          id: user._id,
          label: {
            fullName: user.fullName,
            email: user.email,
            role: user.role,
            position: user.position,
          },
        },
        summary: "Password updated via security form",
        changes: [
          { path: "passwordHash", from: "[redacted]", to: "[redacted]" },
        ],
      });

      return res.status(200).json({
        success: true,
        message: "Password updated successfully.",
      });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  },

  adminResetPassword: async (req, res) => {
    try {
      const { id } = req.params;
      const { resetPassword } = req.body;

      if (!resetPassword) {
        return res.status(400).json({
          success: false,
          message: "Please provide a reset password.",
        });
      }

      if (
        !validatePassword.checkLength(resetPassword) ||
        !validatePassword.checkUppercase(resetPassword) ||
        !validatePassword.checkNumber(resetPassword) ||
        !validatePassword.checkSpecial(resetPassword)
      ) {
        return res.status(400).json({
          success: false,
          message: "Password must meet complexity requirements.",
        });
      }

      const user = await User.findById(id);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found.",
        });
      }

      const hashedPassword = bcrypt.hashSync(
        resetPassword,
        parseInt(process.env.SALT_ROUNDS)
      );

      user.passwordHash = hashedPassword;
      await user.save();

      const emailContent = `
        <p>Dear ${user.fullName},</p>
        <p>Your password has been reset by an administrator.</p>
        <p>Here are your new login details:</p>
        <ul>
            <li><strong>Email:</strong> ${user.email}</li>
            <li><strong>Temporary Password:</strong> ${resetPassword}</li>
        </ul>
        <p>Please log in and update your password as soon as possible.</p>
        <a href="${process.env.ADMIN_PORTAL_URL}/login" class="button">Log in Now</a>
        <p>We're here to support you. If you have any questions, feel free to reach out.</p>
      `;

      await sendEmail({
        to: user.email,
        subject: "Password Reset Successful",
        html: emailContent,
      });

      await req.logActivity({
        action: "update",
        target: { model: "User", id: user._id, name: user.fullName },
        actor: {
          type: "User",
          id: reqUser._id,
          label: {
            fullName: reqUser.fullName,
            email: reqUser.email,
            role: reqUser.role,
            position: reqUser.position,
          },
        },
        summary: "Admin reset password for user",
        reason: "Admin initiated reset",
        changes: [
          { path: "passwordHash", from: "[redacted]", to: "[redacted]" },
        ],
      });

      return res.status(200).json({
        success: true,
        message: `Password was reset successfully. The user can now log in with the new password sent to their email.`,
      });
    } catch (error) {
      return res.status(500).json({ success: false, message: error.message });
    }
  },

  // VIEWS
  viewAllUsers: async (req, res) => {
    try {
      const users = await User.find()
        .populate({
          path: "employeeDetails.position",
          populate: ["hierarchy", "department"],
        })
        .lean();
      return res.status(200).json({ success: true, data: users });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  },
  viewAllEmployees: async (req, res) => {
    try {
      const employees = await User.find({ role: "employee" })
        .populate({
          path: "employeeDetails.position",
          populate: ["hierarchy", "department"],
        })
        .populate({
          path: "employeeDetails.reportTo",
          select: "fullName email profile.photo", // You can customize fields returned
        })
        .lean();
      return res.status(200).json({ success: true, data: employees });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  },

  viewAllRegulars: async (req, res) => {
    try {
      const customers = await User.find({ role: "regular" }).lean();
      return res.status(200).json({ success: true, data: customers });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  },

  checkBookingEligibility: async (req, res) => {
    try {
      const email = String(req.query.email || "").trim().toLowerCase();
      if (!email || !validateEmail(email)) {
        return res.status(200).json({
          success: true,
          data: {
            eligible: true,
            reason: "",
          },
        });
      }

      const user = await User.findOne({ email })
        .select("accountStatus email fullName")
        .lean();

      if (!user) {
        return res.status(200).json({
          success: true,
          data: {
            eligible: true,
            reason: "",
          },
        });
      }

      const status = user.accountStatus || {};
      if (status.state === "Suspended") {
        return res.status(200).json({
          success: true,
          data: {
            eligible: false,
            reason:
              status.suspensionExplanation ||
              status.reasonForSuspension ||
              "This account is currently suspended.",
          },
        });
      }

      if (status.allowedToBookEvent === false) {
        return res.status(200).json({
          success: true,
          data: {
            eligible: false,
            reason:
              status.bookingRestrictionReason ||
              "This account is not currently allowed to book events.",
          },
        });
      }

      return res.status(200).json({
        success: true,
        data: {
          eligible: true,
          reason: "",
        },
      });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  },

  viewAllBartenders: async (req, res) => {
    try {
      // Find users with a bartenderProfile
      const users = await User.find(
        { bartenderProfile: { $exists: true, $ne: null } },
        {
          fullName: 1,
          email: 1,
          "profile.photo": 1,
          "bartenderProfile.status": 1,
          "bartenderProfile.onboardingDocuments": 1,
        }
      ).lean();

      const userIds = users.map((u) => u._id);
      const [assignments, rewardClaims] = await Promise.all([
        Assignment.find({
          bartenderUser: { $in: userIds },
          status: "active",
        })
          .populate("event", "status")
          .lean(),
        RewardClaim.find({
          bartenderUser: { $in: userIds },
        }).lean(),
      ]);

      const assignmentsByUser = new Map();
      assignments.forEach((assignment) => {
        const key = String(assignment.bartenderUser);
        const list = assignmentsByUser.get(key) || [];
        list.push(assignment);
        assignmentsByUser.set(key, list);
      });

      const claimsByUser = new Map();
      rewardClaims.forEach((claim) => {
        const key = String(claim.bartenderUser);
        const list = claimsByUser.get(key) || [];
        list.push(claim);
        claimsByUser.set(key, list);
      });

      const rows = users.map((u) => {
        const userId = String(u._id);
        const completedEvents = getCompletedBartenderEventsCount(
          assignmentsByUser.get(userId) || []
        );
        const rewardProgress = buildRewardProgress(
          completedEvents,
          claimsByUser.get(userId) || []
        );
        const pendingRewards = rewardProgress.filter(
          (reward) =>
            reward.unlocked &&
            reward.requiresClaim &&
            reward.claim &&
            ["pending", "approved"].includes(reward.claim.status)
        );

        return {
          id: u._id,
          fullName: u.fullName,
          email: u.email,
          photo: u.profile?.photo || null,
          bartenderStatus: u.bartenderProfile?.status || "applicant",
          onboardingDocuments: normalizeOnboardingDocuments(
            u.bartenderProfile?.onboardingDocuments
          ),
          completedEvents,
          needsReward: pendingRewards.length > 0,
          pendingRewardCount: pendingRewards.length,
        };
      });

      return res.json({
        total: rows.length,
        data: rows,
      });
    } catch (err) {
      console.error("viewAllBartenders error:", err);
      return res.status(500).json({
        success: false,
        message: err.message || "Server error",
      });
    }
  },

  viewBartenderById: async (req, res) => {
    try {
      const { bartenderId } = req.params;

      if (!mongoose.Types.ObjectId.isValid(bartenderId)) {
        return res
          .status(400)
          .json({ success: false, message: "Invalid bartender ID" });
      }

      // 0) Load the user + bartenderProfile + profile.photo
      const user = await User.findById(bartenderId, {
        fullName: 1,
        email: 1,
        username: 1,
        role: 1,
        "profile.photo": 1,
        bartenderProfile: 1, // full bartenderProfile subtree
      }).lean();

      if (!user || !user.bartenderProfile) {
        return res.status(404).json({
          success: false,
          message: "Bartender profile not found for this user",
        });
      }

      const userId = user._id;
      const isEmployee = user.role === "employee";

      // 1) Required courses for bartenders
      const required = isEmployee
        ? []
        : await Course.find(
            { status: "published", requiredForRoles: "bartender" },
            { _id: 1, title: 1, slug: 1 }
          ).lean();

      const requiredIds = required.map((c) => c._id);

      // 2) User’s progress on those courses
      const progress = await CourseProgress.find(
        { userId, courseId: { $in: requiredIds } },
        { courseId: 1, status: 1, modulesCompleted: 1, totalModules: 1 }
      ).lean();

      const progressByCourse = new Map(
        progress.map((p) => [String(p.courseId), p])
      );

      const completedIds = new Set(
        progress
          .filter((p) => p.status === "completed")
          .map((p) => String(p.courseId))
      );

      // 3) Checklist for required courses (+ percent)
      const courseChecklist = required.map((c) => {
        const p = progressByCourse.get(String(c._id));
        const done = Number(p?.modulesCompleted ?? 0);
        const total = Number(p?.totalModules ?? 0);
        const percent = total > 0 ? Math.round((done / total) * 100) : 0;

        return {
          key: String(c._id),
          type: "course",
          label: c.title,
          link: `/learn/${c.slug}`,
          done: completedIds.has(String(c._id)),
          percent,
        };
      });

      const coursesComplete =
        requiredIds.length === 0 ||
        requiredIds.every((id) => completedIds.has(String(id)));

      // 4) Bartender profile info (licenses, status, stats...)
      const bartenderProfile = user.bartenderProfile || {};
      const now = new Date();
      const licenses = bartenderProfile.licenses || [];

      const licenseVerified = licenses.some(
        (l) => l.verified === true && l.expiresAt && new Date(l.expiresAt) > now
      );

      // NOTE: your schema has "approved", not "active"
      const profileApproved = bartenderProfile.status === "approved";

      // 5) Check payout links for this user
      const payoutLinks = bartenderProfile.payoutLinks || {};
      const hasPayoutLink = ["cashApp", "zelle", "paypal", "venmo"].some(
        (key) => String(payoutLinks[key] || "").trim().length > 0
      );
      const onboardingDocuments = normalizeOnboardingDocuments(
        bartenderProfile.onboardingDocuments
      );
      const documentsReceived = allOnboardingDocumentsReceived(onboardingDocuments);
      const contactInfoComplete = hasBartenderContactInfo(bartenderProfile);

      // 6) Non-course steps
      const licenseStep = {
        key: "license",
        type: "license",
        label: "Valid, verified bartending license",
        link: "/bartend/licenses",
        done: licenseVerified,
      };

      const paymentStep = {
        key: "payout",
        type: "payout",
        label: "Add payout link",
        link: "/bartend/earnings",
        done: hasPayoutLink,
      };

      const contactStep = {
        key: "contact_info",
        type: "contact",
        label: "Add phone and emergency contact",
        link: "/bartend/preferences",
        done: contactInfoComplete,
      };

      const profileStep = {
        key: "profile",
        type: "profile",
        label: "Bartender profile approved",
        link: "/bartend",
        done: profileApproved,
      };

      const documentsStep = {
        key: "sign_documents",
        type: "documents",
        label: "Sign all documents",
        link: "/bartend",
        done: documentsReceived,
      };

      // 7) Combined steps (courses first, then account items)
      const steps = [
        ...courseChecklist,
        licenseStep,
        contactStep,
        paymentStep,
        documentsStep,
        profileStep,
      ];

      // 8) Overall eligibility
      const eligible =
        coursesComplete &&
        licenseVerified &&
        documentsReceived &&
        profileApproved &&
        contactInfoComplete &&
        hasPayoutLink;

      const requiredCount = requiredIds.length;
      const overallPercent = (() => {
        if (requiredCount === 0) return 0;
        const passed = courseChecklist.filter((s) => s.done).length;
        return Math.round((passed / requiredCount) * 100);
      })();

      // You can expose how many progress docs we found if useful
      const progressCount = progress.length;

      const [assignments, reviews, rewardClaims] = await Promise.all([
        Assignment.find({ bartenderUser: userId })
          .populate("event", "shortCode type startAt endAt status")
          .lean(),
        Review.find({ bartenderUser: userId })
          .populate("event", "shortCode type startAt endAt")
          .populate("reviewerUser", "fullName email")
          .sort({ createdAt: -1 })
          .lean(),
        RewardClaim.find({ bartenderUser: userId }).lean(),
      ]);

      const activeAssignments = assignments.filter((assignment) => assignment.status === "active");
      const completedEvents = getCompletedBartenderEventsCount(assignments);
      const upcomingAssignments = activeAssignments.filter((assignment) => {
        const endAt = assignment.event?.endAt || assignment.event?.startAt;
        return endAt && new Date(endAt) >= now;
      }).length;
      const jobsAcceptedLast30d = activeAssignments.filter((assignment) => {
        const assignedAt = assignment.assignedAt || assignment.createdAt;
        return assignedAt && now - new Date(assignedAt) <= 30 * 24 * 60 * 60 * 1000;
      }).length;
      const ratings = reviews
        .map((review) => Number(review.rating))
        .filter((rating) => Number.isFinite(rating));
      const ratingCount = ratings.length;
      const ratingAvg = ratingCount
        ? ratings.reduce((sum, rating) => sum + rating, 0) / ratingCount
        : 0;
      const startedAt = bartenderProfile.dateBartendingStarted
        ? new Date(bartenderProfile.dateBartendingStarted)
        : null;
      const yearsWithTipsyverse =
        startedAt && !Number.isNaN(startedAt.getTime())
          ? Math.max(0, Math.floor((now - startedAt) / (365.25 * 24 * 60 * 60 * 1000)))
          : 0;
      const liveStats = {
        ...(bartenderProfile.stats || {}),
        yearsWithTipsyverse,
        jobsAcceptedLast30d,
        upcomingAssignments,
        ratingAvg,
        ratingCount,
      };
      const reviewRows = reviews.map((review) => ({
        _id: review._id,
        id: String(review._id),
        eventName:
          review.event?.shortCode ||
          review.event?.type ||
          "Event",
        rating: review.rating,
        comment: review.comment || "",
        createdAt: review.createdAt,
        reviewerName: review.reviewerUser?.fullName || review.reviewerUser?.email || "",
      }));

      // 9) Shape response for admin drawer
      const fullName =
        [user.firstName, user.lastName].filter(Boolean).join(" ") ||
        user.fullName;

      return res.json({
        success: true,
        bartenderId: String(userId),
        user: {
          id: String(userId),
          fullName,
          email: user.email,
          username: user.username,
          photo: user.profile?.photo || null,
          bartenderStatus: bartenderProfile.status,
        },
        bartenderProfile: {
          ...bartenderProfile,
          onboardingDocuments,
          stats: liveStats,
        }, // includes licenses, serviceAddresses, stats, etc.
        reviews: reviewRows,
        rewards: {
          completedEvents,
          milestones: buildRewardProgress(completedEvents, rewardClaims),
        },
        eligibility: {
          eligible,
          steps,
          summary: {
            requiredCourses: requiredCount,
            requiredCoursesCompleted: courseChecklist.filter((s) => s.done)
              .length,
            overallPercent,
            progressDocsFound: progressCount,
            hasPayoutLink,
            documentsReceived,
            contactInfoComplete,
            coursesRequired: !isEmployee,
            licenseVerified,
            profileApproved,
          },
        },
      });
    } catch (err) {
      console.error("viewBartenderById error:", err);
      return res
        .status(500)
        .json({ success: false, message: err.message || "Server error" });
    }
  },

  viewEmployeesNotReporting: async (req, res) => {
    try {
      const employees = await User.find({
        role: "employee",
        "employeeDetails.reportTo": null,
      }).populate({
        path: "employeeDetails.position",
        populate: ["hierarchy", "department"],
      });

      const filtered = employees.filter((emp) => {
        const pos = emp?.employeeDetails?.position;
        return (
          pos && pos.name && !["Owner", "Board Director"].includes(pos.name)
        );
      });

      return res.status(200).json({ success: true, data: filtered });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  },

  viewUser: async (req, res) => {
    try {
      const { id } = req.params;
      const user = await User.findById(id).populate({
          path: "employeeDetails.position",
          populate: {
            path: "hierarchy", // hierarchy inside position
            select: "name description", // optional
          },
        });

      if (!user) {
        return res
          .status(404)
          .json({ success: false, message: "User not found." });
      }
      const userWithActivity = await withDrinkActivity(user);
      return res.status(200).json({ success: true, data: userWithActivity });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  },

  deactivateUser: async (req, res) => {
    try {
      const { reason } = req.body; // optional
      const userId = req.user.id; // ✅ Always from logged-in user

      const user = await User.findById(userId);
      if (!user)
        return res
          .status(404)
          .json({ success: false, message: "User not found." });

      // If already deactivated, just echo existing deadline (UTC)
      if (
        user.accountStatus?.state === "Deactivated" &&
        user.accountStatus?.deactivationDateStarted
      ) {
        const startedUTC = startOfUTCDay(
          new Date(user.accountStatus.deactivationDateStarted)
        );
        const deadlineUTC = addMonthsUTC(startedUTC, 6);
        return res.status(200).json({
          success: true,
          message: `Your account is already deactivated. You have until ${formatUTC(deadlineUTC)} UTC to log in and reactivate, otherwise your account will be deleted.`,
        });
      }

      const startedUTC = startOfUTCDay(new Date()); // today at 00:00:00Z
      user.accountStatus.state = "Deactivated";
      user.accountStatus.deactivationDateStarted = startedUTC;
      user.accountStatus.deactivationReason = (reason || "").trim() || null;
      user.accountStatus.isOnline = false;

      await user.save();

      await req.logActivity({
        action: "status-change",
        target: { model: "User", id: user._id },
        summary: "User deactivated own account",
        actor: {
          type: "User",
          id: user._id,
          label: {
            fullName: user.fullName,
            email: user.email,
            role: user.role,
            position: user.position,
          },
        },
        reason,
        changes: [
          { path: "accountStatus.state", from: "Active", to: "Deactivated" },
        ],
        nextSnapshot: {
          accountStatus: {
            state: "Deactivated",
            deactivationDateStarted: user.accountStatus.deactivationDateStarted,
          },
        },
      });

      const deadlineUTC = addMonthsUTC(startedUTC, 6);
      return res.status(200).json({
        success: true,
        message: `Your account has been deactivated. You have until ${formatUTC(deadlineUTC)} UTC to log in and reactivate, otherwise your account will be deleted.`,
      });
    } catch (err) {
      console.error("Deactivate error:", err);
      return res
        .status(500)
        .json({ success: false, message: "Internal server error." });
    }
  },

  turnOffTutorial: async (req, res) => {
    try {
      // Prefer explicit param; fallback to the authenticated user
      const userId = req.params.userId || req.user?.id;

      if (!userId) {
        return res.status(400).json({
          success: false,
          message: "User id is required.",
        });
      }

      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found.",
        });
      }

      // Ensure preferences exists, then set the flag
      if (!user.preferences) user.preferences = {};
      user.preferences.hasSeenTutorial = true;

      await user.save();

      return res.json({
        success: true,
        preferences: user.preferences,
      });
    } catch (err) {
      return res.status(500).json({
        success: false,
        message: "Failed to update hasSeenTutorial.",
        error: err.message,
      });
    }
  },

  updateUser: async (req, res) => {
    try {
      const { id } = req.params;
      const {
        fullName,
        email,
        username,
        password,
        role,
        isOnline,
        accountStatus,
        employeeDetails,
        preferences,
        ...otherFields
      } = req.body;

      const user = await User.findById(id);
      const reqUser = await User.findById(req.user.id);
      if (!user) {
        return res
          .status(404)
          .json({ success: false, message: "User not found." });
      }

      if (!reqUser) {
        return res
          .status(404)
          .json({ success: false, message: "Authorized user not found." });
      }

      const before = user.toObject(); // take BEFORE you mutate, if you want true diff

      if (email) {
        if (!validateEmail(email)) {
          return res
            .status(400)
            .json({ success: false, message: "Invalid email format." });
        }
        const existingEmailUser = await User.findOne({
          email,
          _id: { $ne: id },
        });
        if (existingEmailUser) {
          return res
            .status(400)
            .json({ success: false, message: "This email is already in use." });
        }
        user.email = email;
      }

      if (typeof req.body.username !== "undefined") {
        const desired = normalizeUsername(req.body.username);
        if (!desired) {
          return res
            .status(400)
            .json({ success: false, message: "Invalid username." });
        }

        // ⏳ check if user recently changed username
        if (user.dates?.usernameLastChanged) {
          const lastChanged = new Date(user.dates.usernameLastChanged);
          const now = new Date();
          const diffMs = now - lastChanged;
          const diffDays = diffMs / (1000 * 60 * 60 * 24);

          if (diffDays < 2 && user.username !== desired) {
            const nextAllowed = new Date(
              lastChanged.getTime() + 2 * 24 * 60 * 60 * 1000
            );
            return res.status(400).json({
              success: false,
              message: `Username can only be changed once every 2 days. Next allowed change: ${nextAllowed.toISOString().slice(0, 10)}.`,
            });
          }
        }

        const taken = await User.findOne(
          { username: desired },
          { _id: 1 }
        ).lean();
        if (taken && String(taken._id) !== String(user._id)) {
          const seeds = baseUsernameSeeds({
            fullName: user.fullName,
            email: user.email,
            birthday: user.profile?.birthday,
          });
          const recs = await findAvailableUsernames([desired, ...seeds], 5);
          return res.status(400).json({
            success: false,
            message: "Username is already taken.",
            recommended: recs.map((u) => u.toLowerCase()),
          });
        }
        user.usernameHistory = user.usernameHistory || [];
        if (user.username && user.username !== desired)
          user.usernameHistory.push(user.username);
        user.username = desired;
        user.dates = user.dates || {};
        user.dates.usernameLastChanged = new Date(); // admin override
      }

      if (fullName) user.fullName = fullName;
      if (role) user.role = role;
      if (typeof isOnline !== "undefined")
        user.accountStatus.isOnline = isOnline;
      if (accountStatus) {
        const next = { ...user.accountStatus, ...accountStatus };
        next.allowedToBookEvent = next.allowedToBookEvent !== false;
        next.bookingRestrictionReason = String(
          next.bookingRestrictionReason || ""
        ).trim();

        if (
          next.allowedToBookEvent === false &&
          !next.bookingRestrictionReason
        ) {
          return res.status(400).json({
            success: false,
            message: "Booking restriction reason is required.",
          });
        }

        // Normalize/validate suspension fields
        if (next.state === "Suspended") {
          next.isOnline = false;
          if (!next.reasonForSuspension) {
            return res.status(400).json({
              success: false,
              message: "Suspension reason is required.",
            });
          }
          if (!next.suspensionIndefinite) {
            if (!next.suspensionDateEnds) {
              return res.status(400).json({
                success: false,
                message: "End date required if not indefinite.",
              });
            }
            const ends = new Date(next.suspensionDateEnds);
            if (Number.isNaN(ends.getTime()) || ends <= new Date()) {
              return res.status(400).json({
                success: false,
                message: "End date must be a future date.",
              });
            }
            next.suspensionDateEnds = ends;
          } else {
            next.suspensionDateEnds = null;
          }
        } else if (next.state === "Active") {
          next.reasonForSuspension = "";
          next.suspensionIndefinite = false;
          next.suspensionDateEnds = null;
        }

        user.accountStatus = next;
      }

      if (preferences) user.preferences = preferences;

      // 🔐 Password
      if (password) {
        if (
          !validatePassword.checkLength(password) ||
          !validatePassword.checkUppercase(password) ||
          !validatePassword.checkNumber(password) ||
          !validatePassword.checkSpecial(password)
        ) {
          return res.status(400).json({
            success: false,
            message: "Password must meet complexity requirements.",
          });
        }

        user.passwordHash = bcrypt.hashSync(
          password,
          parseInt(process.env.SALT_ROUNDS)
        );
      }

      // 👤 Profile
      if (!user.profile) user.profile = {};
      if (typeof otherFields.bio !== "undefined")
        user.profile.bio = otherFields.bio;
      if (typeof otherFields.birthday !== "undefined")
        user.profile.birthday = otherFields.birthday;
      if (typeof otherFields.photo !== "undefined")
        user.profile.photo = otherFields.photo;
      if (typeof otherFields.photoPublicId !== "undefined")
        user.profile.photoPublicId = otherFields.photoPublicId;

      delete otherFields.bio;
      delete otherFields.birthday;
      delete otherFields.photo;
      delete otherFields.photoPublicId;

      Object.assign(user, otherFields);

      // 🧠 Employee Details
      if (employeeDetails) {
        const { reportTo, directReports, employmentStatus, position, ...rest } =
          employeeDetails;

        // Ensure structure exists
        if (!user.employeeDetails) user.employeeDetails = {};
        if (!user.employeeDetails.employmentStatus)
          user.employeeDetails.employmentStatus = {};
        if (!user.employeeDetails.dates) user.employeeDetails.dates = {};

        // Validate reportTo logic against position
        const selectedPosition =
          typeof position === "string"
            ? await Position.findById(position)
            : position;

        const isOwner = selectedPosition?.name === "Owner";

        if (isOwner && reportTo) {
          return res.status(400).json({
            success: false,
            message: "Owners must not report to anyone.",
          });
        }

        if (!isOwner && !reportTo) {
          return res.status(400).json({
            success: false,
            message: "Non-owners must report to a manager.",
          });
        }

        // 👥 reportTo logic
        if (
          typeof reportTo !== "undefined" &&
          reportTo !== user.employeeDetails.reportTo?.toString()
        ) {
          // Remove from previous manager if needed
          if (user.employeeDetails.reportTo) {
            await User.findByIdAndUpdate(user.employeeDetails.reportTo, {
              $pull: { "employeeDetails.directReports": id },
            });
          }

          // Add to new manager if not null
          if (reportTo) {
            if (reportTo === id) {
              return res.status(400).json({
                success: false,
                message: "An employee cannot report to themselves.",
              });
            }

            const newManager = await User.findById(reportTo);
            if (!newManager || newManager.role !== "employee") {
              return res.status(404).json({
                success: false,
                message: "New manager (reportTo) not found or not an employee.",
              });
            }

            await User.findByIdAndUpdate(reportTo, {
              $addToSet: { "employeeDetails.directReports": id },
            });
          }

          // Update reportTo to new value (can be null)
          user.employeeDetails.reportTo = reportTo;
        }

        // 🧾 directReports validation
        if (directReports) {
          for (const dr of directReports) {
            if (dr === id) {
              return res.status(400).json({
                success: false,
                message:
                  "An employee cannot be in their own directReports list.",
              });
            }
            const exists = await User.findById(dr);

            if (!exists || exists.role !== "employee") {
              return res.status(404).json({
                success: false,
                message: "One or more directReports are invalid.",
              });
            }
          }
          user.employeeDetails.directReports = directReports;
        }

        // 📌 Position
        if (position) {
          user.employeeDetails.position =
            typeof position === "string" ? position : position._id; // supports both ID or full object
        }

        // 📆 Employment status and change date
        if (
          employmentStatus &&
          "state" in employmentStatus &&
          employmentStatus.state !== user.employeeDetails.employmentStatus.state
        ) {
          user.employeeDetails.dates.dateStatusLastChanged = new Date();
        }

        if (employmentStatus) {
          if (employmentStatus.state !== "Terminated") {
            employmentStatus.reasonForTermination = "";
          }

          user.employeeDetails.employmentStatus = {
            ...user.employeeDetails.employmentStatus,
            ...employmentStatus,
          };
        }

        // 📋 Merge remaining fields
        user.employeeDetails = {
          ...user.employeeDetails,
          ...rest,
        };
      }

      await user.save();

      const after = user.toObject();

      await req.logActivity({
        action: "update",
        target: { model: "User", id: user._id, name: user.fullName },
        summary: "Admin updated user",
        changes: shallowDiff(before, after),
        actor: {
          type: "User",
          id: reqUser._id,
          label: {
            fullName: reqUser.fullName,
            email: reqUser.email,
            role: reqUser.role,
            position: reqUser.position,
          },
        },
        prevSnapshot: {
          email: before.email,
          role: before.role,
          accountStatus: before.accountStatus?.state,
        },
        nextSnapshot: {
          email: after.email,
          role: after.role,
          accountStatus: after.accountStatus?.state,
        },
      });

      return res.status(200).json({
        success: true,
        message: "User updated successfully.",
        data: user,
      });
    } catch (err) {
      console.error("Update Error:", err);
      return res.status(500).json({ success: false, message: err.message });
    }
  },

  checkUsername: async (req, res) => {
    try {
      const desired = normalizeUsername(req.query.username || "");
      if (!desired) {
        return res
          .status(400)
          .json({ success: false, message: "Missing or invalid username." });
      }
      const exists = await User.exists({ username: desired });
      if (!exists) {
        return res
          .status(200)
          .json({ success: true, available: true, username: desired });
      }
      const seeds = baseUsernameSeeds({
        fullName: req.query.fullName,
        email: req.query.email,
        birthday: req.query.birthday,
      });
      const recs = await findAvailableUsernames([desired, ...seeds], 3);
      return res.status(200).json({
        success: true,
        available: false,
        message: "Username is already taken.",
        recommended: recs.map((u) => u.toLowerCase()),
      });
    } catch (e) {
      return res.status(500).json({ success: false, message: e.message });
    }
  },

  updateMyUsername: async (req, res) => {
    try {
      const me = await User.findById(req.user.id);
      if (!me)
        return res
          .status(404)
          .json({ success: false, message: "User not found." });

      const desired = normalizeUsername(req.body.username || "");
      if (!desired)
        return res
          .status(400)
          .json({ success: false, message: "Invalid username." });

      // 2-day cooldown
      const now = new Date();
      const last = me?.dates?.usernameLastChanged || me.createdAt || null;
      if (last) {
        const diffMs = now - new Date(last);
        const minMs = 2 * 24 * 60 * 60 * 1000;
        if (diffMs < minMs) {
          const nextAt = new Date(new Date(last).getTime() + minMs);
          const humanReadable = nextAt.toLocaleString("en-US", {
            weekday: "long", // "Tuesday"
            year: "numeric", // "2025"
            month: "long", // "September"
            day: "numeric", // "2"
            hour: "numeric", // "8 PM"
            minute: "2-digit", // "08"
          });

          return res.status(429).json({
            success: false,
            message: `You can change your username again on ${humanReadable}.`,
            nextAllowedAt: nextAt,
          });
        }
      }

      const taken = await User.findOne(
        { username: desired },
        { _id: 1 }
      ).lean();
      if (taken && String(taken._id) !== String(me._id)) {
        const seeds = baseUsernameSeeds({
          fullName: me.fullName,
          email: me.email,
          birthday: me.profile?.birthday,
        });
        const recs = await findAvailableUsernames([desired, ...seeds], 3);
        return res.status(400).json({
          success: false,
          message: "Username is already taken.",
          recommended: recs.map((u) => u.toLowerCase()),
        });
      }

      const before = me.toObject();
      me.usernameHistory = me.usernameHistory || [];
      if (me.username && me.username !== desired)
        me.usernameHistory.push(me.username);
      me.username = desired;
      me.dates = me.dates || {};
      me.dates.usernameLastChanged = now;
      await me.save();

      await req
        .logActivity?.({
          action: "update",
          target: { model: "User", id: me._id, name: me.fullName },
          summary: "Changed username",
          changes: [
            { path: "username", from: before.username, to: me.username },
          ],
          nextSnapshot: {
            username: me.username,
            usernameLastChanged: me.dates.usernameLastChanged,
          },
        })
        .catch(() => {});

      return res.status(200).json({
        success: true,
        message: "Username updated.",
        data: { username: me.username },
      });
    } catch (e) {
      return res.status(500).json({ success: false, message: e.message });
    }
  },

  updateProfile: async (req, res) => {
    try {
      const { fullName, username, birthday, bio, photo, photoPublicId } =
        req.body;
      const id = req.user.id;

      const user = await User.findById(id);
      if (!user) {
        return res
          .status(404)
          .json({ success: false, message: "User not found" });
      }

      const before = user.toObject();

      // --- Required fields ---
      if (!fullName || !fullName.trim()) {
        return res
          .status(400)
          .json({ success: false, message: "Full name is required." });
      }
      if (!username || !username.trim()) {
        return res
          .status(400)
          .json({ success: false, message: "Username is required." });
      }
      if (!birthday) {
        return res
          .status(400)
          .json({ success: false, message: "Birthday is required." });
      }
      if (!validateDate(birthday)) {
        return res
          .status(400)
          .json({ success: false, message: "Invalid birthday." });
      }

      // --- Age check (21+) ---
      const age = ageHelper.calculateAge(birthday);
      if (!ageHelper.isLegalAge(age)) {
        return res
          .status(400)
          .json({ success: false, message: "You must be over 21." });
      }

      // --- Username normalize & uniqueness ---
      const normalized = normalizeUsername(username || "");
      if (!normalized) {
        return res
          .status(400)
          .json({ success: false, message: "Invalid username." });
      }

      if (normalized !== user.username) {
        // --- 2-day cooldown check ---
        const now = new Date();
        const last =
          user.accountStatus?.dateUsernameLastChanged || user.createdAt || null;
        if (last) {
          const diffMs = now - new Date(last);
          const minMs = 2 * 24 * 60 * 60 * 1000; // 2 days
          if (diffMs < minMs) {
            const nextAt = new Date(new Date(last).getTime() + minMs);
            const humanReadable = nextAt.toLocaleString("en-US", {
              weekday: "long", // "Tuesday"
              year: "numeric", // "2025"
              month: "long", // "September"
              day: "numeric", // "2"
              hour: "numeric", // "8 PM"
              minute: "2-digit", // "08"
            });
            return res.status(429).json({
              success: false,
              message: `You can change your username again on ${humanReadable}.`,
              nextAllowedAt: nextAt,
            });
          }
        }

        // --- Uniqueness check ---
        const exists = await User.findOne({
          username: normalized,
          _id: { $ne: user._id },
        });
        if (exists) {
          const seeds = baseUsernameSeeds({
            fullName,
            email: user.email,
            birthday,
          });
          const recs = await findAvailableUsernames([normalized, ...seeds], 3);
          return res.status(400).json({
            success: false,
            message: "Username is already taken.",
            recommended: recs.map((u) => u.toLowerCase()),
          });
        }

        user.username = normalized;
        user.accountStatus = user.accountStatus || {};
        user.accountStatus.dateUsernameLastChanged = now;
      }

      // --- Update core fields ---
      user.fullName = fullName;
      user.profile = user.profile || {};
      user.profile.bio = typeof bio === "string" ? bio : user.profile.bio;
      user.profile.birthday = birthday;

      // --- Photo handling ---
      if (photoPublicId && user.profile.photoPublicId !== photoPublicId) {
        if (user.profile.photoPublicId) {
          await cloudinary.uploader.destroy(user.profile.photoPublicId);
        }
        user.profile.photo = photo;
        user.profile.photoPublicId = photoPublicId;
      }

      await user.save();
      const after = user.toObject();

      await req.logActivity({
        action: "update",
        target: { model: "User", id: user._id, name: user.fullName },
        summary: "Updated profile fields",
        changes: shallowDiff(before, after),
        nextSnapshot: {
          fullName: user.fullName,
          username: user.username,
          birthday: user.profile?.birthday,
          photoPublicId: user.profile?.photoPublicId,
        },
      });

      return res.json({
        success: true,
        message: "Profile updated successfully",
      });
    } catch (err) {
      console.error("updateProfile error:", err);
      return res
        .status(500)
        .json({ success: false, message: "Something went wrong." });
    }
  },

  // POST /users/:id/suspend
  suspendUser: async (req, res) => {
    try {
      const { id } = req.params;
      const {
        reason,
        endDate,
        endAt,
        suspensionExplanation,
        indefinite = false,
      } = req.body;

      const reqUser = await User.findById(req.user.id);
      if (!reqUser) {
        return res
          .status(404)
          .json({ success: false, message: "Authorized user not found." });
      }

      if (!reason || !reason.trim()) {
        return res
          .status(400)
          .json({ success: false, message: "Reason is required." });
      }

      if (!suspensionExplanation || !suspensionExplanation.trim()) {
        return res
          .status(400)
          .json({ success: false, message: "Reason is required." });
      }

      let suspensionEndsAt = null;

      if (!indefinite) {
        const rawEnd = endAt || endDate;
        if (!rawEnd) {
          return res.status(400).json({
            success: false,
            message: "End date/time is required when not indefinite.",
          });
        }

        const rawEndString = String(rawEnd).trim();
        const isDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(rawEndString);

        if (isDateOnly) {
          const endDay = toLocalDateOnly(rawEndString);
          if (!endDay || Number.isNaN(endDay.getTime())) {
            return res
              .status(400)
              .json({ success: false, message: "Invalid end date/time." });
          }
          suspensionEndsAt = new Date(endDay);
          suspensionEndsAt.setHours(23, 59, 59, 999);
        } else {
          suspensionEndsAt = new Date(rawEndString);
        }

        if (
          !suspensionEndsAt ||
          Number.isNaN(suspensionEndsAt.getTime())
        ) {
          return res.status(400).json({
            success: false,
            message: "Invalid end date/time.",
          });
        }

        if (suspensionEndsAt <= new Date()) {
          return res.status(400).json({
            success: false,
            message: "End date/time must be in the future.",
          });
        }
      }

      const user = await User.findByIdAndUpdate(
        id,
        {
          $set: {
            "accountStatus.state": "Suspended",
            "accountStatus.isOnline": false,
            "accountStatus.reasonForSuspension": reason.trim(),
            "accountStatus.suspensionExplanation": suspensionExplanation.trim(),
            "accountStatus.suspensionIndefinite": !!indefinite,
            "accountStatus.suspensionDateEnds": indefinite
              ? null
              : suspensionEndsAt,
          },
        },
        { new: true }
      );

      if (!user) {
        return res
          .status(404)
          .json({ success: false, message: "User not found." });
      }

      await req.logActivity({
        action: "status-change",
        target: { model: "User", id: user._id, name: user.fullName },
        actor: {
          type: "User",
          id: reqUser._id,
          label: {
            fullName: reqUser.fullName,
            email: reqUser.email,
            role: reqUser.role,
            position: reqUser.position,
          },
        },
        summary: "Suspended user",
        reason,
        changes: [
          { path: "accountStatus.state", from: "Active", to: "Suspended" },
          {
            path: "accountStatus.suspensionIndefinite",
            from: false,
            to: !!indefinite,
          },
          {
            path: "accountStatus.suspensionDateEnds",
            from: null,
            to: user.accountStatus.suspensionDateEnds,
          },
        ],
      });

      return res
        .status(200)
        .json({ success: true, message: "User suspended.", data: user });
    } catch (e) {
      console.error(e);
      return res.status(500).json({ success: false, message: "Server error." });
    }
  },

  // POST /users/:id/unsuspend
  unsuspendUser: async (req, res) => {
    try {
      const { id } = req.params;

      const user = await User.findByIdAndUpdate(
        id,
        {
          $set: {
            "accountStatus.state": "Active",
            "accountStatus.reasonForSuspension": "",
            "accountStatus.suspensionExplanation": "",
            "accountStatus.suspensionIndefinite": false,
            "accountStatus.suspensionDateEnds": null,
          },
        },
        { new: true }
      );

      const reqUser = await User.findById(req.user.id);

      if (!user)
        return res
          .status(404)
          .json({ success: false, message: "User not found." });

      if (!reqUser)
        return res
          .status(404)
          .json({ success: false, message: "Authorized user not found." });

      await req.logActivity({
        action: "status-change",
        target: { model: "User", id: user._id, name: user.fullName },
        actor: {
          type: "User",
          id: reqUser._id,
          label: {
            fullName: reqUser.fullName,
            email: reqUser.email,
            role: reqUser.role,
            position: reqUser.position,
          },
        },
        summary: "Unsuspended user",
        changes: [
          { path: "accountStatus.state", from: "Suspended", to: "Active" },
        ],
      });

      return res
        .status(200)
        .json({ success: true, message: "User unsuspended.", data: user });
    } catch (e) {
      console.error(e);
      return res.status(500).json({ success: false, message: "Server error." });
    }
  },

  updatePreferences: async (req, res) => {
    try {
      const { allergies, notifications } = req.body;
      const userId = req.user.id;

      const user = await User.findById(userId);
      if (!user)
        return res
          .status(404)
          .json({ success: false, message: "User not found" });

      const before = user.toObject(); // ✅ snapshot before

      // Ensure structure
      if (!user.preferences) user.preferences = {};

      // Only update fields that were provided
      if (typeof allergies !== "undefined") {
        user.preferences.allergies = allergies;
      }
      if (typeof notifications !== "undefined") {
        user.preferences.notifications = notifications;
      }

      await user.save();

      const after = user.toObject(); // ✅ snapshot after

      // 🧾 Activity log
      await req.logActivity({
        action: "update",
        target: { model: "User", id: user._id, name: user.fullName },
        actor: {
          type: "User",
          id: req.user.id,
          label: {
            fullName: req.user.fullName,
            email: req.user.email,
            role: req.user.role,
            position: req.user.position,
          },
        },
        summary: "Updated preferences",
        changes: shallowDiff(before, after), // ✅ real diff
        prevSnapshot: {
          preferences: before.preferences ?? null,
        },
        nextSnapshot: {
          preferences: after.preferences ?? null,
        },
      });

      return res.json({
        success: true,
        message: "Preferences updated successfully",
        data: { preferences: user.preferences },
      });
    } catch (err) {
      console.error("updatePreferences error:", err);
      return res.status(500).json({ success: false, message: "Server error" });
    }
  },

  uploadUserPhoto: async (req, res) => {
    if (!req.file) {
      return res
        .status(400)
        .json({ success: false, message: "No image file provided" });
    }
    const filePath = req.file.path;
    try {
      const result = await handleImageUpload(filePath);
      res.status(200).json({
        success: true,
        message: "Photo uploaded to cloudinary.",
        data: { photo: result.secure_url, photoPublicId: result.public_id },
      });
    } catch (error) {
      res.status(400).json({ success: false, message: error.message });
    } finally {
      // Always delete the temp file
      fs.unlink(filePath, (err) => {
        if (err) console.error("Failed to delete temp file:", err);
      });
    }
  },

  terminateEmployee: async (req, res) => {
    try {
      const { id } = req.params;
      const { reasonForTermination } = req.body;

      const reqUser = await User.findById(req.user.id).populate({
        path: "employeeDetails.position",
        populate: { path: "hierarchy", select: "name" },
      });

      if (!reqUser) {
        return res.status(404).json({
          success: false,
          message: "Authorized user is not found.",
        });
      }

      if (!reasonForTermination) {
        return res.status(400).json({
          success: false,
          message: "Reason for termination is required.",
        });
      }

      // Load employee (role guard)
      const employee = await User.findOne({ _id: id, role: "employee" })
        .populate({
          path: "employeeDetails.position",
          populate: { path: "hierarchy", select: "name" },
        })
        .lean(false); // we want a Mongoose doc to mutate/save

      if (!employee) {
        return res.status(404).json({
          success: false,
          message: "Employee not found.",
        });
      }

      const beforeStatus = employee?.accountStatus?.state;

      const today = new Date();

      // --- Normalize structure guards ---
      if (!employee.employeeDetails) employee.employeeDetails = {};
      if (!employee.employeeDetails.dates) employee.employeeDetails.dates = {};
      if (!employee.employeeDetails.employmentStatus) {
        employee.employeeDetails.employmentStatus = {};
      }

      // --- Apply termination to account + employment status ---
      employee.accountStatus.state = "Terminated";
      employee.accountStatus.reasonForTermination = reasonForTermination;

      employee.employeeDetails.employmentStatus.state = "Terminated";
      employee.employeeDetails.employmentStatus.reasonForTermination =
        reasonForTermination;

      employee.employeeDetails.dates.datesTerminated = [
        ...(employee.employeeDetails.dates.datesTerminated || []),
        today,
      ];
      employee.employeeDetails.dates.dateStatusLastChanged = today;

      await employee.save();

      // --- Manager & Direct Reports handling ---

      // Resolve managerId whether populated or raw ObjectId
      const managerId =
        employee?.employeeDetails?.reportTo?._id?.toString() ||
        employee?.employeeDetails?.reportTo?.toString() ||
        null;

      // Remove this employee from their manager’s directReports
      if (managerId) {
        await ensureDirectReportsArray(managerId);
        await User.findByIdAndUpdate(managerId, {
          $pull: { "employeeDetails.directReports": employee._id },
        });
      }

      // Normalize this employee's directReports into an array for downstream ops
      const dr = Array.isArray(employee?.employeeDetails?.directReports)
        ? employee.employeeDetails.directReports
        : employee?.employeeDetails?.directReports
          ? [employee.employeeDetails.directReports]
          : [];

      if (dr.length > 0) {
        if (managerId) {
          // Reassign direct reports to the (former) manager
          await User.updateMany(
            { _id: { $in: dr } },
            {
              $set: {
                "employeeDetails.reportTo": new mongoose.Types.ObjectId(
                  managerId
                ),
              },
            }
          );

          // Add them to manager's directReports (ensure it's an array first)
          await ensureDirectReportsArray(managerId);
          await User.findByIdAndUpdate(managerId, {
            $addToSet: { "employeeDetails.directReports": { $each: dr } },
          });
        } else {
          // No manager to reassign to → clear reportTo for those direct reports
          await User.updateMany(
            { _id: { $in: dr } },
            { $set: { "employeeDetails.reportTo": null } }
          );
        }
      }

      // Belt & suspenders: clear anyone else who still has this employee as their manager
      await User.updateMany(
        { "employeeDetails.reportTo": employee._id },
        { $set: { "employeeDetails.reportTo": null } }
      );

      // --- Activity log ---
      await req.logActivity({
        action: "status-change",
        target: { model: "User", id: employee._id, name: employee.fullName },
        actor: {
          type: "User",
          id: reqUser._id,
          label: {
            fullName: reqUser.fullName,
            email: reqUser.email,
            role: reqUser.role,
            position: {
              id: reqUser?.employeeDetails?.position?._id,
              name: reqUser?.employeeDetails?.position?.name,
            },
          },
        },
        summary: "Terminated employee",
        reason: reasonForTermination,
        changes: [
          { path: "accountStatus.state", from: beforeStatus, to: "Terminated" },
        ],
        meta: {
          terminatedAt: today,
          employeeId: employee._id,
          employeeName: employee.fullName,
          previousManagerId: managerId || null,
          directReportsReassigned: managerId ? dr.length : 0,
          directReportsCleared: managerId ? 0 : dr.length,
        },
      });

      return res.status(200).json({
        success: true,
        message: `${employee.fullName} has been terminated.`,
        employee,
      });
    } catch (error) {
      console.error("Error terminating employee:", error);
      return res.status(500).json({
        success: false,
        message: "Internal server error.",
      });
    }
  },

  // POST /users/me/delete
  deleteMyAccount: async (req, res, next) => {
    try {
      const { email, password, reason } = req.body;

      // Make sure user is authenticated
      if (!req.user?.id) {
        return res
          .status(401)
          .json({ success: false, message: "Unauthorized." });
      }

      if (!email || !password) {
        return res.status(400).json({
          success: false,
          message: "Please fill in all required fields.",
        });
      }

      // Get the user with password
      const user = await User.findById(req.user.id).select("+passwordHash");
      if (!user) {
        return res
          .status(404)
          .json({ success: false, message: "User not found." });
      }

      // Verify email + password
      if (user.email.toLowerCase() !== String(email).trim().toLowerCase()) {
        return res
          .status(400)
          .json({ success: false, message: "Invalid email or password." });
      }
      const isMatch = await bcrypt.compare(password, user.passwordHash);
      if (!isMatch) {
        return res
          .status(400)
          .json({ success: false, message: "Invalid email or password." });
      }

      // Optional: record reason in activity log
      if (reason) {
        await req.logActivity({
          action: "other",
          target: { model: "User", id: user._id, name: user.fullName },
          summary: "User provided account deletion reason",
          reason: reason.trim(),
        });
      }

      await req.logActivity({
        action: "delete",
        target: { model: "User", id: user._id, name: user.fullName },
        actor: {
          type: "User",
          id: user._id,
          label: {
            fullName: user.fullName,
            email: user.email,
            role: user.role,
            position: user.position,
          },
        },
        summary: "User self-deleted account",
        reason: reason?.trim(),
      });

      const result = await withTxnRetry(async (session) => {
        // ✅ Call your existing admin-side permanent delete
        return deleteUserHandler(user._id, { bypassStateCheck: true, session });
      });

      res.json({
        success: true,
        message: "Your account has been permanently deleted.",
      });

      // return res.status(200).json({
      //   success: true,
      //   message: "Your account has been permanently deleted.",
      // });
    } catch (err) {
      console.error(err);
      return res
        .status(500)
        .json({ success: false, message: "Internal server error." });
      next(err);
    }
  },

  deleteUserPermanently: async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const { id } = req.params;
      const reqUser = await User.findById(req.user.id);

      if (!reqUser) {
        return res
          .status(404)
          .json({ success: false, message: "Authorized user not found." });
      }

      // Reuse the service but keep controller’s explicit transaction if you want:
      const result = await withTxnRetry(async (session) => {
        // ✅ Call your existing admin-side permanent delete
        return deleteUserHandler(id, { bypassStateCheck: true, session });
      });
      await session.commitTransaction();

      await req.logActivity({
        action: "delete",
        target: { model: "User", id },
        actor: {
          type: "User",
          id: reqUser._id,
          label: {
            fullName: reqUser.fullName,
            email: reqUser.email,
            role: reqUser.role,
            position: reqUser.position,
          },
        },
        summary: "Admin permanently deleted user",
        meta: result?.meta,
      });

      session.endSession();

      return res.status(200).json({
        success: true,
        message:
          "User deleted permanently. Authored comments removed and drink analytics updated (comments, bookmarks, likes).",
        meta: result.meta,
      });
    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      const msg =
        error.code === "BLOCKED_BY_STATE"
          ? error.message
          : "Internal server error.";
      console.error("Delete Error:", error);
      return res.status(error.code === "BLOCKED_BY_STATE" ? 403 : 500).json({
        success: false,
        message: msg,
      });
    }
  },
};

export default userCtrl;
