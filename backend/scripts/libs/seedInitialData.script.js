// scripts/libs/seedInitialData.script.js
import "dotenv/config";
import mongoose from "mongoose";
import bcrypt from "bcrypt";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import { cloudinary } from "../../middleware/libs/cloudinary.middleware.js";
import seedBiancaRequiredCourseProgress from "./seedQaBartenderProgress.js";

import {
  PositionModel as Position,
  HierarchyModel as Hierarchy,
  DepartmentModel as Department,
  ActivityLogModel as ActivityLog,
  UserModel as User,
  CouponModel as Coupon,
} from "../../models/index.js";

// Run:
// NODE_ENV=development node scripts/libs/seedInitialData.script.js
// NODE_ENV=staging node scripts/libs/seedInitialData.script.js

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DOCS_PATH = path.resolve(__dirname, "../../../docs");

const seedUsers = [
  {
    username: process.env.ADMIN_SEED_USERNAME,
    email: process.env.ADMIN_SEED_EMAIL,
    fullName: process.env.ADMIN_SEED_FULL_NAME,
    password: process.env.ADMIN_SEED_PASSWORD,

    positionName: "Owner",

    birthday: null,
    profileImageFile: "logo.png",
    profileImagePublicId: "tipsyverse-admin",

    bio: [
      "Official Tipsyverse administrator account used to manage the platform,",
      "content, users, events, and internal operations.",
    ].join(" "),

    permitNumber:
      process.env.ADMIN_SEED_PERMIT_NUMBER ||
      "SEED-TIPSYVERSE-ADMIN-001",

    permitExpirationDate:
      process.env.ADMIN_SEED_PERMIT_EXP_DATE || "2030-12-31",

    cashApp: "$Tipsyverse",

    bartenderContactInfo: {
      phone: "3176087361",
      emergencyContact: {
        fullName: "Kim Smiley",
        relationship: "Family",
        phone: "3177144911",
        email: "",
      },
    },
  },

  {
    username: process.env.ADMIN2_SEED_USERNAME,
    email: process.env.ADMIN2_SEED_EMAIL,
    fullName: process.env.ADMIN2_SEED_FULL_NAME,
    password: process.env.ADMIN2_SEED_PASSWORD,

    positionName: "Owner",

    birthday: "1998-01-01",
    profileImageFile: "alonzo.png",
    profileImagePublicId: "alonzo-smiley",

    bio: [
      "Founder of Tipsyverse, software engineer, bartender, and cocktail",
      "creator passionate about building technology that connects people",
      "through unforgettable experiences.",
    ].join(" "),

    permitNumber:
      process.env.ADMIN2_SEED_PERMIT_NUMBER ||
      "SEED-ALONZO-SMILEY-001",

    permitExpirationDate:
      process.env.ADMIN2_SEED_PERMIT_EXP_DATE || "2030-12-31",

    cashApp: "$AlonzoSmileyIV",

    bartenderContactInfo: {
      phone: "3176087361",
      emergencyContact: {
        fullName: "Kim Smiley",
        relationship: "Family",
        phone: "3177144911",
        email: "",
      },
    },
  },
];

const qaSeedUsers = [
  {
    username: "qa.manager",
    email: "alonzo.smiley+manager@tipsyverse.com",
    fullName: "Maya Manager",
    password: process.env.QA_SEED_PASSWORD,
    role: "employee",
    positionName: "Operations Manager",
    reportsToEmail: process.env.ADMIN2_SEED_EMAIL,
    hasBartenderProfile: false,
    bio: "Seeded manager account for hierarchy and authorization testing.",
  },
  {
    username: "qa.employee",
    email: "alonzo.smiley+employee@tipsyverse.com",
    fullName: "Evan Employee",
    password: process.env.QA_SEED_PASSWORD,
    role: "employee",
    positionName: "Event Coordinator",
    reportsToEmail: "alonzo.smiley+manager@tipsyverse.com",
    hasBartenderProfile: false,
    bio: "Seeded employee account for staff workflow testing.",
  },
  {
    username: "qa.customer1",
    email: "alonzo.smiley+customer1@tipsyverse.com",
    fullName: "Chloe Customer",
    password: process.env.QA_SEED_PASSWORD,
    role: "regular",
    accountStatusState: "Active",
    hasBartenderProfile: false,
    bio: "Seeded active customer account for booking and finance-history testing.",
  },
  {
    username: "qa.customer2",
    email: "alonzo.smiley+customer2@tipsyverse.com",
    fullName: "Cameron Customer",
    password: process.env.QA_SEED_PASSWORD,
    role: "regular",
    accountStatusState: "Active",
    hasBartenderProfile: false,
    bio: "Seeded second customer account for cross-account authorization testing.",
  },
  {
    username: "qa.suspended",
    email: "alonzo.smiley+suspended@tipsyverse.com",
    fullName: "Sasha Suspended",
    password: process.env.QA_SEED_PASSWORD,
    role: "regular",
    accountStatusState: "Suspended",
    suspensionIndefinite: true,
    reasonForSuspension: "Seeded for suspended-account testing.",
    hasBartenderProfile: false,
    bio: "Seeded customer account that must remain suspended.",
  },
  {
    username: "qa.deactivated",
    email: "alonzo.smiley+deactivated@tipsyverse.com",
    fullName: "Diana Deactivated",
    password: process.env.QA_SEED_PASSWORD,
    role: "regular",
    accountStatusState: "Deactivated",
    deactivationReason: "Seeded for deactivated-account testing.",
    hasBartenderProfile: false,
    bio: "Seeded customer account that must remain deactivated.",
  },
  {
    username: "qa.bartender1",
    email: "alonzo.smiley+bartender1@tipsyverse.com",
    fullName: "Bianca Bartender",
    password: process.env.QA_SEED_PASSWORD,
    role: "bartender",
    permitNumber: "SEED-QA-BARTENDER-001",
    permitExpirationDate: "2030-12-31",
    licenseStatus: "active",
    cashApp: "$BiancaQABartender",
    bartenderContactInfo: {
      phone: "3175550101",
      emergencyContact: {
        fullName: "Morgan Contact",
        relationship: "Friend",
        phone: "3175550199",
        email: "alonzo.smiley+bianca-emergency@tipsyverse.com",
      },
    },
    bio: "Seeded eligible bartender account for bidding and assignment testing.",
  },
  {
    username: "qa.bartender2",
    email: "alonzo.smiley+bartender2@tipsyverse.com",
    fullName: "Brandon Bartender",
    password: process.env.QA_SEED_PASSWORD,
    role: "bartender",
    permitNumber: "SEED-QA-BARTENDER-002",
    permitExpirationDate: "2030-12-31",
    licenseStatus: "active",
    bio: "Seeded second eligible bartender for competing-bid testing.",
  },
  {
    username: "qa.bartender-expired",
    email: "alonzo.smiley+bartender-expired@tipsyverse.com",
    fullName: "Elliot Expired",
    password: process.env.QA_SEED_PASSWORD,
    role: "bartender",
    permitNumber: "SEED-QA-BARTENDER-EXPIRED",
    permitExpirationDate: "2020-01-01",
    licenseStatus: "expired",
    bio: "Seeded bartender account with an expired permit.",
  },
];

const hierarchyData = [
  {
    name: "Owner",
    description: "Top-level owner of the organization.",
  },
  {
    name: "Board Director",
    description: "Member of the board of directors.",
  },
  {
    name: "Chief Executive Officer",
    description: "Leads the entire company.",
  },
  {
    name: "Executive",
    description: "Senior executive leadership position.",
  },
  {
    name: "Vice President",
    description: "Oversees departments and major initiatives.",
  },
  {
    name: "Director",
    description: "Manages department strategy and organizational goals.",
  },
  {
    name: "Manager",
    description: "Manages teams, programs, and daily operations.",
  },
  {
    name: "Supervisor",
    description: "Directly supervises employees and operational work.",
  },
  {
    name: "Team Leader",
    description: "Guides and supports a specialized team.",
  },
  {
    name: "Employee",
    description: "General employee or individual contributor.",
  },
  {
    name: "Contractor",
    description: "Independent or temporary external contributor.",
  },
  {
    name: "Intern",
    description: "Entry-level, apprentice, or student position.",
  },
];

const departmentData = [
  {
    name: "Owner",
    description: "Top-level company ownership and organizational control.",
  },
  {
    name: "Board of Directors",
    description: "Corporate governance and organizational oversight.",
  },
  {
    name: "Executive Leadership",
    description: "Executive management, planning, and company strategy.",
  },
  {
    name: "Human Resources",
    description: "Recruiting, employee relations, and administration.",
  },
  {
    name: "Finance",
    description: "Budgeting, accounting, payroll, and financial planning.",
  },
  {
    name: "Technology",
    description: "Technology strategy, infrastructure, and platform operations.",
  },
  {
    name: "Engineering",
    description: "Software development, testing, and product maintenance.",
  },
  {
    name: "Product",
    description: "Product strategy, research, design, and roadmap planning.",
  },
  {
    name: "Customer Experience",
    description: "Customer success, service, and support operations.",
  },
  {
    name: "Operations",
    description: "Company operations, scheduling, logistics, and fulfillment.",
  },
  {
    name: "Bartending",
    description: "Bartenders, field staff, and bartending operations.",
  },
  {
    name: "Training",
    description: "Bartender education, certification, and continuing training.",
  },
  {
    name: "Compliance",
    description: "Alcohol compliance, licensing, safety, and risk management.",
  },
  {
    name: "Legal",
    description: "Contracts, legal risk, policy, and regulatory matters.",
  },
  {
    name: "Marketing",
    description: "Brand development, promotion, content, and acquisition.",
  },
  {
    name: "Sales",
    description: "Business development, partnerships, and event sales.",
  },
];

const positionData = [
  // 1. Founder / ownership
  {
    name: "Owner",
    description: "Top-level owner with full organizational authority.",
    hierarchyName: "Owner",
    departmentName: "Owner",
  },
  {
    name: "Chief Executive Officer",
    description:
      "Leads company strategy, executive decisions, and organizational growth.",
    hierarchyName: "Chief Executive Officer",
    departmentName: "Executive Leadership",
  },

  // 2. First operational hires
  {
    name: "Operations Manager",
    description:
      "Manages daily operations, event workflows, logistics, and service delivery.",
    hierarchyName: "Manager",
    departmentName: "Operations",
  },
  {
    name: "Event Coordinator",
    description:
      "Coordinates event requests, customer communication, staffing, and event details.",
    hierarchyName: "Supervisor",
    departmentName: "Operations",
  },
  {
    name: "Customer Support Specialist",
    description:
      "Assists customers with bookings, accounts, payments, and platform concerns.",
    hierarchyName: "Employee",
    departmentName: "Customer Experience",
  },

  // 3. Bartender workforce leadership
  {
    name: "Bartender Manager",
    description:
      "Manages bartender recruiting, onboarding, performance, and field operations.",
    hierarchyName: "Manager",
    departmentName: "Bartending",
  },
  {
    name: "Lead Bartender",
    description:
      "Leads bartending teams during events and supports service standards.",
    hierarchyName: "Team Leader",
    departmentName: "Bartending",
  },
  {
    name: "Bartender",
    description:
      "Provides professional bartending service for Tipsyverse events.",
    hierarchyName: "Employee",
    departmentName: "Bartending",
  },
  {
    name: "Bartender Apprentice",
    description:
      "Developing bartender completing training and supervised experience.",
    hierarchyName: "Intern",
    departmentName: "Bartending",
  },
  {
    name: "Senior Bartender",
    description:
      "Experienced bartender trusted with advanced events and team support.",
    hierarchyName: "Employee",
    departmentName: "Bartending",
  },

  // 4. Scheduling and training support
  {
    name: "Scheduling Coordinator",
    description:
      "Coordinates bartender availability, scheduling, assignments, and coverage.",
    hierarchyName: "Supervisor",
    departmentName: "Operations",
  },
  {
    name: "Training Coordinator",
    description:
      "Coordinates training schedules, course content, quizzes, and completion records.",
    hierarchyName: "Supervisor",
    departmentName: "Training",
  },
  {
    name: "Training Manager",
    description:
      "Manages courses, bartender education, certifications, and training standards.",
    hierarchyName: "Manager",
    departmentName: "Training",
  },
  {
    name: "Compliance Manager",
    description:
      "Manages alcohol compliance, licensing requirements, safety, and risk.",
    hierarchyName: "Manager",
    departmentName: "Compliance",
  },

  // 5. Marketing and sales
  {
    name: "Marketing Coordinator",
    description:
      "Coordinates campaigns, social content, promotions, and brand projects.",
    hierarchyName: "Supervisor",
    departmentName: "Marketing",
  },
  {
    name: "Social Media Coordinator",
    description:
      "Coordinates social media publishing, engagement, and community growth.",
    hierarchyName: "Employee",
    departmentName: "Marketing",
  },
  {
    name: "Content Creator",
    description:
      "Creates cocktail, event, training, promotional, and social content.",
    hierarchyName: "Employee",
    departmentName: "Marketing",
  },
  {
    name: "Graphic Designer",
    description:
      "Creates visual brand assets, promotional materials, and digital graphics.",
    hierarchyName: "Employee",
    departmentName: "Marketing",
  },
  {
    name: "Sales Representative",
    description:
      "Develops event leads, partnerships, and customer relationships.",
    hierarchyName: "Employee",
    departmentName: "Sales",
  },
  {
    name: "Marketing Manager",
    description:
      "Manages campaigns, branding, content, and audience-growth initiatives.",
    hierarchyName: "Manager",
    departmentName: "Marketing",
  },

  // 6. Administrative, HR, and finance
  {
    name: "Administrative Assistant",
    description:
      "Supports scheduling, communication, documentation, and administrative work.",
    hierarchyName: "Employee",
    departmentName: "Executive Leadership",
  },
  {
    name: "Recruiter",
    description:
      "Sources, screens, interviews, and supports onboarding of new team members.",
    hierarchyName: "Employee",
    departmentName: "Human Resources",
  },
  {
    name: "Human Resources Manager",
    description:
      "Manages recruiting, employee relations, policy, and workforce administration.",
    hierarchyName: "Manager",
    departmentName: "Human Resources",
  },
  {
    name: "HR Generalist",
    description:
      "Supports employee records, policies, benefits, and employee relations.",
    hierarchyName: "Employee",
    departmentName: "Human Resources",
  },
  {
    name: "Finance Coordinator",
    description:
      "Supports payments, invoices, expenses, and financial records.",
    hierarchyName: "Supervisor",
    departmentName: "Finance",
  },
  {
    name: "Accountant",
    description:
      "Maintains accounting records, reconciliations, reporting, and tax preparation.",
    hierarchyName: "Employee",
    departmentName: "Finance",
  },
  {
    name: "Payroll Specialist",
    description:
      "Processes compensation, payroll records, deductions, and payment reporting.",
    hierarchyName: "Employee",
    departmentName: "Finance",
  },

  // 7. Product and technology team
  {
    name: "Software Engineer",
    description:
      "Develops and maintains Tipsyverse web, mobile, backend, and internal systems.",
    hierarchyName: "Employee",
    departmentName: "Engineering",
  },
  {
    name: "QA Engineer",
    description:
      "Tests product functionality, quality, reliability, and release readiness.",
    hierarchyName: "Employee",
    departmentName: "Engineering",
  },
  {
    name: "UI/UX Designer",
    description:
      "Designs accessible, intuitive, and visually consistent user experiences.",
    hierarchyName: "Employee",
    departmentName: "Product",
  },
  {
    name: "Product Manager",
    description:
      "Manages product planning, requirements, priorities, and the roadmap.",
    hierarchyName: "Manager",
    departmentName: "Product",
  },
  {
    name: "Frontend Engineer",
    description:
      "Develops and maintains user-facing web interfaces and experiences.",
    hierarchyName: "Employee",
    departmentName: "Engineering",
  },
  {
    name: "Backend Engineer",
    description:
      "Develops APIs, database logic, services, and backend integrations.",
    hierarchyName: "Employee",
    departmentName: "Engineering",
  },
  {
    name: "Mobile Engineer",
    description:
      "Develops and maintains Tipsyverse mobile applications.",
    hierarchyName: "Employee",
    departmentName: "Engineering",
  },
  {
    name: "DevOps Engineer",
    description:
      "Manages deployment, infrastructure, monitoring, and reliability.",
    hierarchyName: "Employee",
    departmentName: "Technology",
  },
  {
    name: "Technology Manager",
    description:
      "Manages technology operations, platform support, and technical initiatives.",
    hierarchyName: "Manager",
    departmentName: "Technology",
  },

  // 8. Additional operations support
  {
    name: "Inventory Coordinator",
    description:
      "Tracks tools, apparel, welcome kits, supplies, rewards, and inventory.",
    hierarchyName: "Supervisor",
    departmentName: "Operations",
  },
  {
    name: "Logistics Coordinator",
    description:
      "Coordinates equipment movement, shipping, event supplies, and fulfillment.",
    hierarchyName: "Supervisor",
    departmentName: "Operations",
  },
  {
    name: "Customer Success Specialist",
    description:
      "Supports customer onboarding, satisfaction, retention, and service outcomes.",
    hierarchyName: "Employee",
    departmentName: "Customer Experience",
  },
  {
    name: "Customer Success Manager",
    description:
      "Manages customer relationships, satisfaction, retention, and support quality.",
    hierarchyName: "Manager",
    departmentName: "Customer Experience",
  },

  // 9. Executive roles added as the company scales
  {
    name: "Chief Operating Officer",
    description:
      "Oversees company operations, service delivery, and execution.",
    hierarchyName: "Executive",
    departmentName: "Executive Leadership",
  },
  {
    name: "Chief Technology Officer",
    description:
      "Leads technology strategy, architecture, infrastructure, and engineering.",
    hierarchyName: "Executive",
    departmentName: "Technology",
  },
  {
    name: "Chief Financial Officer",
    description:
      "Leads accounting, budgeting, financial planning, and controls.",
    hierarchyName: "Executive",
    departmentName: "Finance",
  },
  {
    name: "Chief Marketing Officer",
    description:
      "Leads brand strategy, customer acquisition, advertising, and marketing.",
    hierarchyName: "Executive",
    departmentName: "Marketing",
  },
];

const receivedOnboardingDocuments = () => {
  const now = new Date();

  return [
    {
      key: "w9",
      title: "W-9",
      status: "received",
      sentAt: now,
      receivedAt: now,
      lastStatusChangeAt: now,
      notes: "Seeded as received for administrative testing.",
    },
    {
      key: "independent_contractor",
      title: "Independent Contractor Agreement",
      status: "received",
      sentAt: now,
      receivedAt: now,
      lastStatusChangeAt: now,
      notes: "Seeded as received for administrative testing.",
    },
    {
      key: "service_standards",
      title: "Service Standards Acknowledgement",
      status: "received",
      sentAt: now,
      receivedAt: now,
      lastStatusChangeAt: now,
      notes: "Seeded as received for administrative testing.",
    },
  ];
};

function getDefaultAdultBirthday() {
  const birthday = new Date();
  birthday.setFullYear(birthday.getFullYear() - 21);
  birthday.setHours(0, 0, 0, 0);

  return birthday;
}

async function uploadSeedUserImageIfExists(fileName, publicId) {
  if (!fileName || !publicId) return {};

  const imagePath = path.join(DOCS_PATH, "images", fileName);

  if (!fs.existsSync(imagePath)) {
    console.warn(`⚠️ Seed user image not found: ${imagePath}`);
    return {};
  }

  const result = await cloudinary.uploader.upload(imagePath, {
    folder: "default/users",
    public_id: publicId,
    overwrite: true,
    resource_type: "image",
  });

  return {
    photo: result.secure_url,
    photoPublicId: result.public_id,
  };
}

async function logCreate({ model, doc, name }) {
  try {
    await ActivityLog.create({
      action: "create",

      target: {
        model,
        id: doc._id,
        name: name ?? doc.name ?? doc.email,
      },

      actor: {
        type: "System",
        id: null,
      },

      summary: `Added the ${model.toLowerCase()} '${
        name ?? doc.name ?? doc.fullName
      }' through the seed script.`,
    });
  } catch (error) {
    console.error(
      `⚠️ Failed to log ${model} creation:`,
      error.message
    );
  }
}

async function seedHierarchies() {
  const hierarchyMap = {};

  console.log("🔄 Seeding hierarchies...");

  for (const item of hierarchyData) {
    let hierarchy = await Hierarchy.findOne({
      name: item.name,
    });

    if (!hierarchy) {
      hierarchy = await Hierarchy.create(item);

      await logCreate({
        model: "Hierarchy",
        doc: hierarchy,
        name: item.name,
      });
    } else {
      hierarchy.description = item.description;
      await hierarchy.save();
    }

    hierarchyMap[item.name] = hierarchy;
  }

  console.log(`✅ Seeded ${Object.keys(hierarchyMap).length} hierarchies`);

  return hierarchyMap;
}

async function seedDepartments() {
  const departmentMap = {};

  console.log("🔄 Seeding departments...");

  for (const item of departmentData) {
    let department = await Department.findOne({
      name: item.name,
    });

    if (!department) {
      department = await Department.create(item);

      await logCreate({
        model: "Department",
        doc: department,
        name: item.name,
      });
    } else {
      department.description = item.description;
      await department.save();
    }

    departmentMap[item.name] = department;
  }

  console.log(`✅ Seeded ${Object.keys(departmentMap).length} departments`);

  return departmentMap;
}

async function seedPositions({ hierarchyMap, departmentMap }) {
  const positionMap = {};

  console.log("🔄 Seeding positions...");

  for (const item of positionData) {
    const hierarchy = hierarchyMap[item.hierarchyName];
    const department = departmentMap[item.departmentName];

    if (!hierarchy) {
      throw new Error(
        `Hierarchy "${item.hierarchyName}" was not found for position "${item.name}".`
      );
    }

    if (!department) {
      throw new Error(
        `Department "${item.departmentName}" was not found for position "${item.name}".`
      );
    }

    let position = await Position.findOne({
      name: item.name,
    });

    const payload = {
      name: item.name,
      description: item.description,
      hierarchy: hierarchy._id,
      department: department._id,
    };

    if (!position) {
      position = await Position.create(payload);

      await logCreate({
        model: "Position",
        doc: position,
        name: item.name,
      });
    } else {
      position.set(payload);
      await position.save();
    }

    positionMap[item.name] = position;
  }

  console.log(`✅ Seeded ${Object.keys(positionMap).length} positions`);

  return positionMap;
}

async function seedCoupons() {
  console.log("🔄 Seeding promo codes...");

  await Coupon.findOneAndUpdate(
    {
      code: "FAMILY10",
    },
    {
      $set: {
        type: "PERCENT_TOTAL",
        value: 0.10,

        discountType: "percentage",
        discountValue: 10,

        minimumSubtotal: 0,

        startsAt: new Date(),
        endsAt: null,
        indefinite: true,

        maxRedemptions: null,
        perUserLimit: null,

        audience: "employees_family",
        active: true,
        expiresAt: null,

        description:
          "Family and friends discount — 10% off the event total.",
      },

      $setOnInsert: {
        code: "FAMILY10",
      },
    },
    {
      upsert: true,
      new: true,
      runValidators: true,
    }
  );

  console.log("✅ Seeded promo code FAMILY10");
}

function createBartenderProfile(seed) {
  const now = new Date();
  const licenseStatus = seed.licenseStatus || "active";

  return {
    status: "approved",
    lastStatusChangeAt: now,

    onboardingDocuments: receivedOnboardingDocuments(),

    licenses: [
      {
        state: "IN",
        permitNumber: seed.permitNumber,
        expiresAt: new Date(seed.permitExpirationDate),

        verified: licenseStatus === "active",
        status: licenseStatus,
        lastStatusChangeAt: now,
      },
    ],

    payoutLinks: {
      cashApp: seed.cashApp,
      zelle: seed.email,
      paypal: "",
      venmo: "",
      updatedAt: now,
    },

    contactInfo: {
      phone: seed.bartenderContactInfo?.phone || "",
      emergencyContact: {
        fullName:
          seed.bartenderContactInfo?.emergencyContact?.fullName || "",
        relationship:
          seed.bartenderContactInfo?.emergencyContact?.relationship || "",
        phone: seed.bartenderContactInfo?.emergencyContact?.phone || "",
        email: seed.bartenderContactInfo?.emergencyContact?.email || "",
      },
      updatedAt: now,
    },

    dateBartendingStarted: now,

    stats: {
      yearsWithTipsyverse: 0,
      totalExperienceYears: 1,
    },
  };
}

async function seedUsersIntoDatabase(positionMap, usersToSeed) {
  console.log("🔄 Seeding users...");

  for (const seed of usersToSeed) {
    const missingFields = [];

    if (!seed.username) missingFields.push("username");
    if (!seed.email) missingFields.push("email");
    if (!seed.fullName) missingFields.push("fullName");
    if (!seed.password) missingFields.push("password");
    const role = seed.role || "employee";
    if (role === "employee" && !seed.positionName) {
      missingFields.push("positionName");
    }

    if (missingFields.length > 0) {
      console.error(
        `⚠️ Skipping seed user because these values are missing: ${missingFields.join(
          ", "
        )}`
      );
      continue;
    }

    const position = seed.positionName
      ? positionMap[seed.positionName]
      : null;

    if (seed.positionName && !position) {
      console.error(
        `⚠️ Position "${seed.positionName}" was not found for ${seed.email}.`
      );
      continue;
    }

    const profilePhoto = await uploadSeedUserImageIfExists(
      seed.profileImageFile,
      seed.profileImagePublicId
    );

    const passwordHash = await bcrypt.hash(seed.password, 10);

    const birthday = seed.birthday
      ? new Date(seed.birthday)
      : getDefaultAdultBirthday();

    const existing = await User.findOne({
      email: seed.email.toLowerCase(),
    });

    const profile = {
      birthday,
      bio: seed.bio,
      photo: profilePhoto.photo || existing?.profile?.photo || "",
      photoPublicId:
        profilePhoto.photoPublicId ||
        existing?.profile?.photoPublicId ||
        null,
    };

    const employeeDetails =
      role === "employee"
        ? {
            position: position._id,

            dates: {
              dateStarted:
                existing?.employeeDetails?.dates?.dateStarted || new Date(),
            },

            employmentStatus: {
              state: "Active",
              isAbsent: false,
            },
          }
        : null;

    const shouldCreateBartenderProfile =
      seed.hasBartenderProfile ?? ["employee", "bartender"].includes(role);

    const userPayload = {
      username: seed.username,
      email: seed.email.toLowerCase(),
      fullName: seed.fullName,
      passwordHash,

      profile,

      isSeeded: true,
      role,

      dates: {
        dateStarted: existing?.dates?.dateStarted || new Date(),
      },

      employeeDetails,

      bartenderProfile: shouldCreateBartenderProfile
        ? createBartenderProfile(seed)
        : null,
    };

    if (existing) {
      existing.set(userPayload);

      if (!existing.accountStatus) {
        existing.accountStatus = {};
      }

      existing.accountStatus.state = seed.accountStatusState || "Active";
      existing.accountStatus.isOnline = false;
      existing.accountStatus.reasonForSuspension =
        seed.reasonForSuspension || null;
      existing.accountStatus.suspensionExplanation =
        seed.reasonForSuspension || null;
      existing.accountStatus.suspensionIndefinite =
        Boolean(seed.suspensionIndefinite);
      existing.accountStatus.deactivationDateStarted =
        seed.accountStatusState === "Deactivated"
          ? existing.accountStatus.deactivationDateStarted || new Date()
          : null;
      existing.accountStatus.deactivationReason =
        seed.deactivationReason || null;

      await existing.save();

      console.log(`✅ Updated seed user: ${seed.email}`);
      continue;
    }

    const userDoc = await User.create({
      ...userPayload,

      accountStatus: {
        state: seed.accountStatusState || "Active",
        isOnline: false,
        reasonForSuspension: seed.reasonForSuspension || null,
        suspensionExplanation: seed.reasonForSuspension || null,
        suspensionIndefinite: Boolean(seed.suspensionIndefinite),
        deactivationDateStarted:
          seed.accountStatusState === "Deactivated" ? new Date() : null,
        deactivationReason: seed.deactivationReason || null,
      },

      createdAt: new Date(),
    });

    await logCreate({
      model: "User",
      doc: userDoc,
      name: seed.fullName,
    });

    console.log(`✅ Created seed user: ${seed.fullName}`);
  }

  for (const seed of usersToSeed.filter((item) => item.reportsToEmail)) {
    const employee = await User.findOne({
      email: seed.email.toLowerCase(),
    });
    const manager = await User.findOne({
      email: seed.reportsToEmail.toLowerCase(),
    });

    if (!employee || !manager) {
      console.warn(
        `⚠️ Could not seed reporting relationship for ${seed.email}.`
      );
      continue;
    }

    const previousManagerId = employee.employeeDetails?.reportTo;
    if (
      previousManagerId &&
      String(previousManagerId) !== String(manager._id)
    ) {
      await User.updateOne(
        { _id: previousManagerId },
        { $pull: { "employeeDetails.directReports": employee._id } }
      );
    }

    employee.employeeDetails.reportTo = manager._id;
    await employee.save();

    await User.updateOne(
      { _id: manager._id },
      { $addToSet: { "employeeDetails.directReports": employee._id } }
    );
  }
}

async function disconnectSafely() {
  try {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  } catch (error) {
    console.error("⚠️ Failed to disconnect cleanly:", error.message);
  }
}

async function seedData() {
  const env = (
    process.env.NODE_ENV || "development"
  ).toLowerCase();

  const validEnvironments = [
    "development",
    "staging",
    "production",
    "backup",
  ];

  const allowedSeedEnvironments = [
    "development",
    "staging",
  ];

  const dbURIs = {
    development: process.env.MONGO_DEV_URI,
    staging: process.env.MONGO_STAGING_URI,
    production: process.env.MONGO_PROD_URI,
    backup: process.env.MONGO_BACKUP_URI,
  };

  if (!validEnvironments.includes(env)) {
    console.error(
      `❌ Invalid NODE_ENV "${env}". Expected one of: ${validEnvironments.join(
        ", "
      )}`
    );

    process.exit(1);
  }

  if (!allowedSeedEnvironments.includes(env)) {
    console.error(
      `❌ Refusing to seed "${env}". Only development and staging are allowed.`
    );

    process.exit(1);
  }

  const mongoUri = dbURIs[env];

  if (!mongoUri) {
    console.error(`❌ Missing Mongo URI for ${env}.`);
    process.exit(1);
  }

  if (!process.env.QA_SEED_PASSWORD) {
    console.error(
      "❌ Missing QA_SEED_PASSWORD required for the seeded QA accounts."
    );
    process.exit(1);
  }

  try {
    await mongoose.connect(mongoUri);

    console.log(`✅ Connected to ${env} database`);

    const hierarchyMap = await seedHierarchies();
    const departmentMap = await seedDepartments();

    const positionMap = await seedPositions({
      hierarchyMap,
      departmentMap,
    });

    await seedCoupons();
    const includeQaAccounts = ["development", "staging"].includes(env);
    const usersToSeed = includeQaAccounts
      ? [...seedUsers, ...qaSeedUsers]
      : seedUsers;

    await seedUsersIntoDatabase(positionMap, usersToSeed);
    if (includeQaAccounts) {
      await seedBiancaRequiredCourseProgress();
    }

    console.log("✅ Initial Tipsyverse seed completed successfully.");

    await disconnectSafely();
    process.exit(0);
  } catch (error) {
    console.error("❌ Seeding error:", error);

    await disconnectSafely();
    process.exit(1);
  }
}

seedData();
