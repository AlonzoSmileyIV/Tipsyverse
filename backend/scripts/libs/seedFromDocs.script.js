// scripts/seedInitialData.js
import "dotenv/config";
import XLSX from "xlsx";
import mongoose from "mongoose";
import fs from "node:fs";

// The ESM build of SheetJS does not automatically load Node's filesystem
// implementation. Register it so XLSX.readFile() can access local workbooks.
XLSX.set_fs(fs);

//NODE_ENV=development node scripts/libs/seedFromDocs.script.js
//NODE_ENV=staging node scripts/libs/seedFromDocs.script.js

import {
  LiquorModel as Liquor,
  MixerModel as Mixer,
  GlassModel as Glass,
  DrinkModel as Drink,
  CourseModel as Course,
} from "../../models/index.js";

import { cloudinary } from "../../middleware/libs/cloudinary.middleware.js";
import seedBiancaRequiredCourseProgress from "./seedQaBartenderProgress.js";

import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DOCS_PATH = path.resolve(__dirname, "../../../docs");

function readExcel(filePath) {
  const workbook = XLSX.readFile(filePath);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];

  return XLSX.utils.sheet_to_json(sheet, {
    defval: "",
    raw: false,
  });
}

const slugify = (str) => {
  return str
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-");
};

function splitCell(value) {
  if (!value) return [];

  return String(value)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseBoolean(value) {
  return ["true", "t", "yes", "y"].includes(
    String(value || "")
      .trim()
      .toLowerCase()
  );
}

async function uploadLocalDrinkImageIfExists(name) {
  const slug = slugify(name);

  const possibleFiles = [
    `${slug}.png`,
    `${slug}.jpg`,
    `${slug}.jpeg`,
    `${slug}.webp`,
    `${slug}-1.png`,
    `${slug}-1.jpg`,
    `${slug}-1.jpeg`,
    `${slug}-1.webp`,
  ];

  for (const fileName of possibleFiles) {
    const imagePath = path.join(DOCS_PATH, "images", fileName);

    if (!fs.existsSync(imagePath)) continue;

    const result = await cloudinary.uploader.upload(imagePath, {
      folder: "default/images",
      public_id: slug,
      overwrite: true,
      resource_type: "image",
    });

    return {
      photo: result.secure_url,
      photoPublicId: result.public_id,
    };
  }

  console.warn(`⚠️ Local image not found for ${name} using slug: ${slug}`);
  return {};
}

function parseInstructions(value) {
  if (!value) return [];

  return String(value)
    .split(".")
    .map((item) => item.trim())
    .filter(Boolean);
}

const COURSE_TITLE = "Tipsyverse Bartending Foundations";

const COURSE_DESCRIPTION =
  "Tipsyverse Bartending Foundations is the perfect starting point for anyone interested in learning the art of bartending. This hands-on course covers bar terminology, essential tools, liquor knowledge, proper pouring techniques, customer service, responsible alcohol service, bar setup and breakdown, cleanliness, and how to confidently prepare classic cocktails. Whether you're looking to start a bartending career, earn extra income, or simply impress friends and family, this class will give you the knowledge and practical skills to build a strong foundation behind the bar.";

const MODULE_META = {
  "Intro to Responsible Alcohol Service":
    "Learn what responsible alcohol service means and why it matters for guest safety, professionalism, and business protection.",
  "Types Alcohol and Effects":
    "Understand alcohol categories, how alcohol affects the body, and how to recognize signs of intoxication.",
  "ID Verification":
    "Learn how to check identification, spot red flags, and verify whether a guest can legally be served alcohol.",
  "State Laws":
    "Review key state and local alcohol rules bartenders should know before serving guests.",
  "Server Liability":
    "Learn how overserving, underage service, and negligence can create legal and financial consequences.",
  "Handling Difficult Situations":
    "Build confidence in refusing service, calming tense moments, and handling challenging guest interactions professionally.",
  "How to Make 5 Cocktails":
    "Practice foundational cocktail-building techniques by learning five classic drinks with proper measurements and presentation.",
};

function correctLetterToIndex(letter) {
  return { A: 0, B: 1, C: 2, D: 3 }[
    String(letter || "")
      .trim()
      .toUpperCase()
  ];
}

function buildSectionsFromRows(rows) {
  const sectionMap = new Map();

  for (const row of rows) {
    const sectionTitle = String(row.SectionTitle || "").trim();
    if (!sectionTitle) continue;

    if (!sectionMap.has(sectionTitle)) {
      sectionMap.set(sectionTitle, {
        title: sectionTitle,
        sectionOrder: sectionMap.size,
        content: String(row.LessonContent || "").trim(),
        quiz: { questions: [] },
      });
    }

    const section = sectionMap.get(sectionTitle);
    const prompt = String(row.QuizPrompt || row.QuestionPrompt || "").trim();

    if (!prompt) continue;

    const correctIndex = correctLetterToIndex(row.CorrectAnswer);

    const options = [row.OptionA, row.OptionB, row.OptionC, row.OptionD]
      .map((v) => String(v || "").trim())
      .filter(Boolean)
      .map((text, index) => ({
        text,
        isCorrect: index === correctIndex,
      }));

    section.quiz.questions.push({
      prompt,
      options,
      points: Number(row.Points || 1),
    });
  }

  return Array.from(sectionMap.values());
}

async function seedCourses() {
  const courseFiles = [
    "Tipsyverse_Module1_IntroResponsibleAlcoholService.xlsx",
    "Tipsyverse_Module2_TypesAlcoholAndEffects.xlsx",
    "Tipsyverse_Module3_IDVerification.xlsx",
    "Tipsyverse_Module4_StateLaws.xlsx",
    "Tipsyverse_Module5_ServerLiability.xlsx",
    "Tipsyverse_Module6_HandlingDifficultSituations.xlsx",
    "Tipsyverse_Module7_HowToMake5Cocktails.xlsx",
  ];

  const modules = [];

  for (const fileName of courseFiles) {
    const filePath = path.join(DOCS_PATH, 'courses/TipsyverseBartendingFoundations',fileName);

    let rows = [];

    try {
      rows = readExcel(filePath);
    } catch (err) {
      console.warn(`⚠️ Skipped course file ${fileName}: ${err.message}`);
      continue;
    }

    const firstRow = rows[0] || {};
    const moduleTitle = String(firstRow.ModuleTitle || "").trim();

    if (!moduleTitle) {
      console.warn(`⚠️ Skipped ${fileName}: missing ModuleTitle.`);
      continue;
    }

    modules.push({
      title: moduleTitle,
      slug: slugify(moduleTitle),
      description: MODULE_META[moduleTitle] || "",
      moduleOrder: modules.length,
      sections: buildSectionsFromRows(rows),
      quizInfo: {
        poolSize: 5,
        passingScorePct: 70,
      },
    });
  }

  await Course.findOneAndUpdate(
    { slug: slugify(COURSE_TITLE) },
    {
      $set: {
        title: COURSE_TITLE,
        slug: slugify(COURSE_TITLE),
        description: COURSE_DESCRIPTION,
        courseOrder: 0,
        requiredForRoles: ["bartender"],
        restrictedTo: [],
        modules,
        quiz: {
          poolSize: 0,
          passingScorePct: 70,
        },
        status: "published",
        publishedAt: new Date(),
      },
    },
    { upsert: true, new: true }
  );

  console.log("✅ Seeded Tipsyverse Bartending Foundations course");
}

async function seedGlasses() {
  const rows = readExcel(path.join(DOCS_PATH, "officials/Official_Glasses.xlsx"));

  for (const row of rows) {
    const name = row.Name?.trim();
    const maxOunces = Number(row["Max Ounces"]);

    if (!name || !maxOunces) continue;

    await Glass.findOneAndUpdate(
      { name },
      {
        name,
        slug: slugify(name),
        maxOunces,
      },
      { upsert: true, new: true }
    );
  }

  console.log("✅ Seeded glasses");
}

async function seedLiquors() {
  const rows = readExcel(path.join(DOCS_PATH, "officials/Official_Liquors.xlsx"));

  for (const row of rows) {
    const name = row.Name?.trim();
    if (!name) continue;

    await Liquor.findOneAndUpdate(
      { slug: slugify(name) },
      {
        $set: {
          name,
          slug: slugify(name),
          description: row.Description || "",
          brands: splitCell(row.Brands),
          status: row.Status || "Active",
        },
      },
      { upsert: true, new: true }
    );
  }

  console.log("✅ Seeded liquors");
}

async function seedMixers() {
  const rows = readExcel(path.join(DOCS_PATH, "officials/Official_Mixers.xlsx"));

  for (const row of rows) {
    const name = row.Name?.trim();
    if (!name) continue;

    await Mixer.findOneAndUpdate(
      { name },
      {
        $set: {
          name,
          description: row.Description || "",
          brands: splitCell(row.Brands),
          isAlcoholic: parseBoolean(row["Contains Alcohol"]),
          status: row.Status || "Active",
        },
      },
      { upsert: true, new: true }
    );
  }

  console.log("✅ Seeded mixers");
}

async function seedDrinks() {
  const rows = readExcel(path.join(DOCS_PATH, "officials/Official_Cocktails.xlsx"));
  const allLiquors = await Liquor.find();
  const allMixers = await Mixer.find();
  const allGlasses = await Glass.find();

  for (const row of rows) {
    const name = row.Name?.trim();
    if (!name) continue;

    const glassName = row.Glass?.trim();

    const glass = allGlasses.find(
      (g) => g.name.toLowerCase() === glassName?.toLowerCase()
    );

    if (!glass) {
      console.warn(`⚠️ Skipped ${name}: glass "${glassName}" not found.`);
      continue;
    }

    const ingredients = [];

    const rawIngredients = splitCell(row.Ingredients);

    for (const item of rawIngredients) {
      const match = item.match(/([\d.]+)\s*(oz\.?|ounces?)\s*(.+)/i);

      if (!match) {
        console.warn(`⚠️ Skipped ingredient for ${name}: ${item}`);
        continue;
      }

      const ounces = Number(match[1]);
      const ingredientName = match[3].trim();

      const ingredient = [...allLiquors, ...allMixers].find(
        (i) => i.name.toLowerCase() === ingredientName.toLowerCase()
      );

     // console.log("ingredients: ", ingredient);

      if (!ingredient) {
        console.warn(`⚠️ Ingredient not found for ${name}: ${ingredientName}`);
        continue;
      }

      ingredients.push({
        _id: ingredient._id,
        name: ingredient.name,
        ounces,
      });
    }

    const photoFields = await uploadLocalDrinkImageIfExists(name);

    const slug = slugify(name);

    await Drink.findOneAndUpdate(
      { name },
      {
        $set: {
          name,
          slug,
          description: row.Description || "",
          isAlcoholic: parseBoolean(row["Contains Alcohol"]),
          glass: glass._id,
          ingredients,
          categories: splitCell(row.Categories),
          taste: splitCell(row.Taste),
          colors: splitCell(row.Colors),
          tools: splitCell(row.Tools),
          garnishes: splitCell(row.Garnishes),
          instructions: parseInstructions(row.Instructions),
          status: row.Status || "Draft",
          tags: splitCell(row.Tags),
          photo: photoFields.photo,
          photoPublicId: photoFields.photoPublicId,
        },
      },
      { upsert: true, new: true }
    );
  }

  console.log("✅ Seeded drinks");
}

(async function seedData() {
  try {
    const env = process.env.NODE_ENV || "development";

    const dbURIs = {
      development: process.env.MONGO_DEV_URI,
      staging: process.env.MONGO_STAGING_URI,
      production: process.env.MONGO_PROD_URI,
    };

    if (!["development", "staging"].includes(env)) {
      console.error("❌ Refusing to seed. Only development/staging allowed.");
      process.exit(1);
    }

    const mongoUri = dbURIs[env];

    if (!mongoUri) {
      console.error(`❌ Missing Mongo URI for ${env}`);
      process.exit(1);
    }

    await mongoose.connect(mongoUri);
    console.log(`✅ Connected to ${env} database`);

    console.log("🔄 Seeding glasses...");
    await seedGlasses();
    console.log("🔄 Seeding liquors...");
    await seedLiquors();
    console.log("🔄 Seeding mixers...");
    await seedMixers();
    console.log("🔄 Seeding drinks...");
    await seedDrinks();
    console.log("🔄 Seeding Tipsyverse Bartending Foundations course...");
    await seedCourses();
    await seedBiancaRequiredCourseProgress();

    await mongoose.disconnect();

    console.log("✅ Tipsyverse seeding from docs folder complete");
    process.exit(0);
  } catch (error) {
    console.error("❌ Seed failed:", error);

    try {
      await mongoose.disconnect();
    } catch {}

    process.exit(1);
  }
})();
