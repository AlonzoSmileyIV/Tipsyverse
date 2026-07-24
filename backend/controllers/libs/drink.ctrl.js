import fs from "fs";
import {
  DrinkModel as Drink,
  LiquorModel as Liquor,
  MixerModel as Mixer,
  GlassModel as Glass,
  UserModel as User,
  CommentModel as Comment,
  NotificationModel as Notification,
  DrinkLikeModel as DrinkLike,
  DrinkSaveModel as DrinkSave,
} from "../../models/index.js";

import {
  cloudinary,
  deleteSingleCommentKeepChildren,
  diffFields,
  formatSlug,
  handleImageUpload,
  handleVideoUpload,
  makeBulkActivityLogger,
} from "../../utils/index.js";

import XLSX from "xlsx";
import mongoose from "mongoose";

const escapeHtml = (value = "") =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

const absoluteUrl = (url, base) => {
  if (!url) return "";
  try {
    return url.startsWith("http") ? url : new URL(url, base).toString();
  } catch {
    return url;
  }
};

const cloudinaryPreviewUrl = (url) => {
  if (!url || !url.includes("res.cloudinary.com")) return url;
  if (url.includes("/upload/")) {
    return url.replace("/upload/", "/upload/c_fill,w_1200,h_630,g_auto,f_jpg,q_auto/");
  }
  return url;
};

// Check if default image exists and return {photoPublicId, photo} if so
async function getDefaultImageIfExists(slug) {
  const publicId = `default/images/${slug}`;
  try {
    const res = await cloudinary.api.resource(publicId, {
      type: "upload",
      resource_type: "image",
    });
    // res has public_id, secure_url, version, format, etc.
    return { photoPublicId: res.public_id, photo: res.secure_url };
  } catch (e) {
    const code =
      e?.http_code ||
      e?.http_status_code ||
      e?.error?.http_code ||
      e?.response?.status;
    if (code === 404) return null; // no default image for this slug
    throw e;
  }
}

// Top of drinkCtrl file, after imports:
const TAG_ENUM = [
  "Memorial Day",
  "Juneteenth",
  "Fourth of July",
  "Halloween",
  "Thanksgiving",
  "Christmas",
  "New Years",
  "Valentine's Day",
  "St Patricks Day",
  "Wedding",
  "Game Night",
  "Summer BBQ",
  "Brunch",
];

function normalizeStringArray(val) {
  if (!val) return [];
  if (Array.isArray(val)) {
    return Array.from(
      new Set(
        val
          .filter((v) => typeof v === "string")
          .map((v) => v.trim())
          .filter(Boolean)
      )
    );
  }
  // comma-separated string
  return Array.from(
    new Set(
      String(val)
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean)
    )
  );
}

function validateTagsOrThrow(arr) {
  const invalid = arr.filter((t) => !TAG_ENUM.includes(t));
  if (invalid.length) {
    throw new Error(`Invalid tags: ${invalid.join(", ")}`);
  }
}

const drinkCtrl = {
  bulkDrinkBulker: async (req, res) => {
    try {
      const { type } = req.query; // 'add', 'edit', or 'delete'
      const file = req.file;

      const reqUser = await User.findById(req.user.id);
      const { logRow, logBatch } = makeBulkActivityLogger({
        req,
        reqUser,
        type,
        entityModel: "Drink",
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
        "Name",
        "New Name",
        "Description",
        "Contains Alcohol",
        "Categories",
        "Taste",
        "Colors",
        "Tools",
        "Garnishes",
        "Glass",
        "Ingredients",
        "Instructions",
        "Status",
        "Tags",
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
      const blankNames = [];
      const blankDescriptions = [];
      const takenNames = [];
      const errorRows = []; // <-- Track rows with errors

      const allLiquors = await Liquor.find();
      const allMixers = await Mixer.find();
      const allGlasses = await Glass.find();

      for (let i = 0; i < rows.length; i++) {
        const rowNum = i + 2;
        const row = rows[i];
        const name = row["Name"]?.trim();
        const newName = row["New Name"]?.trim();
        const description = row["Description"]?.trim();

        const validAlcoholicInputs = ["true", "t", "yes", "y"];
        const validCategoryInputs = [
          "Classic",
          "Fall",
          "Winter",
          "Spring",
          "Summer",
          "Tipsyverse Originals",
          "Easy at Home",
          "Party",
          "Trouble",
        ];
        const isAlcoholic = validAlcoholicInputs.includes(
          row["Contains Alcohol"]?.trim().toLowerCase()
        );
        const categories = row["Categories"]?.trim();
        const glassName = row["Glass"]?.trim();
        const rawIngredients = row["Ingredients"]?.trim();
        const rawInstructions = row["Instructions"]?.trim();

        const taste = row["Taste"]?.trim();
        const colors = row["Colors"]?.trim();
        const tools = row["Tools"]?.trim();
        const garnishes = row["Garnishes"]?.trim();
        const status = row["Status"]?.trim();
        const tagsRaw = row["Tags"]?.trim();

        const ozPattern = /([\d.]+)\s*(oz\.?|ounces?)\s*(.+)/i;

        // const parseIngredients = () => {
        //   const ingredients = [];
        //   const ingredientParts = rawIngredients.split(",");
        //   for (const part of ingredientParts) {
        //     const match = part.trim().match(ozPattern);
        //     if (!match) {
        //       throw new Error(`Invalid ingredient format: '${part.trim()}'`);
        //     }
        //     const amount = parseFloat(match[1]);
        //     const ingName = match[3].trim();
        //     if (isNaN(amount) || amount <= 0) {
        //       throw new Error(`Invalid amount: '${match[1]}'`);
        //     }
        //     const ingredient = [...allLiquors, ...allMixers].find(
        //       (i) => i.name.toLowerCase() === ingName.toLowerCase()
        //     );
        //     if (!ingredient) {
        //       throw new Error(`Ingredient '${ingName}' not found.`);
        //     }
        //     ingredients.push({
        //       _id: ingredient._id,
        //       name: ingredient.name,
        //       ounces: amount,
        //     });
        //   }
        //   return ingredients;
        // };

        const parseIngredients = () => {
          const ingredients = [];
          const parts = (rawIngredients || "").split(","); // already in your code

          for (const raw of parts) {
            const s = raw.trim();
            if (!s) continue;

            const match = s.match(ozPattern);
            if (!match) {
              throw new Error(`Invalid ingredient format: '${s}'`);
            }
            const amount = parseFloat(match[1]);
            const ingName = match[3].trim();

            if (Number.isNaN(amount) || amount <= 0) {
              throw new Error(`Invalid amount: '${match[1]}'`);
            }

            const ingredientCatalog = [...allLiquors, ...allMixers];
            const normalizedText = ingName.toLowerCase();
            let brand = "";
            let flavor = "";

            let base = ingredientCatalog.find(
              (i) => i.name.toLowerCase() === normalizedText
            );

            if (!base) {
              base = ingredientCatalog.find((item) =>
                Array.isArray(item.brands)
                  ? item.brands.some((candidate) => {
                      const normalizedBrand = String(candidate || "").toLowerCase();
                      return (
                        normalizedBrand &&
                        (normalizedText === normalizedBrand ||
                          normalizedText.endsWith(` ${normalizedBrand}`))
                      );
                    })
                  : false
              );

              if (base) {
                brand =
                  base.brands.find((candidate) => {
                    const normalizedBrand = String(candidate || "").toLowerCase();
                    return (
                      normalizedText === normalizedBrand ||
                      normalizedText.endsWith(` ${normalizedBrand}`)
                    );
                  }) || "";
                flavor = ingName
                  .slice(0, Math.max(0, ingName.length - String(brand).length))
                  .trim();
              }
            }

            if (!base) {
              base = ingredientCatalog.find((item) => {
                const normalizedName = item.name.toLowerCase();
                return normalizedText.endsWith(` ${normalizedName}`);
              });

              if (base) {
                flavor = ingName
                  .slice(0, Math.max(0, ingName.length - base.name.length))
                  .trim();
              }
            }
            if (!base) {
              throw new Error(`Ingredient '${ingName}' not found.`);
            }

            ingredients.push({
              _id: base._id,
              name: base.name,
              ounces: amount,
              brand, // 👈 include brand if present
              flavor,
            });
          }
          return ingredients;
        };

        const glass = allGlasses.find(
          (g) => g.name.toLowerCase() === glassName.toLowerCase()
        );

        if (type === "add") {
          if (!name) {
            errors.push(`Row ${rowNum} is invalid: Name is blank.`);
            blankNames.push(rowNum);
            errorRows.push({ Row: rowNum, ...row, Error: "Name is blank" });
            continue;
          }

          if (!description) {
            errors.push(`Row ${rowNum} is invalid: Description is blank.`);
            blankDescriptions.push(rowNum);
            errorRows.push({
              Row: rowNum,
              ...row,
              Error: "Description is blank",
            });
            continue;
          }

          const exists = await Drink.findOne({ name });
          if (exists) {
            errors.push(`Row ${rowNum} is invalid: Name is already taken.`);
            takenNames.push(rowNum);
            errorRows.push({
              Row: rowNum,
              ...row,
              Error: "Name is already taken.",
            });
            continue;
          }

          if (!glass) {
            errors.push(
              `Row ${rowNum} is invalid: Glass '${glassName}' not found.`
            );
            errorRows.push({
              Row: rowNum,
              ...row,
              Error: `Glass '${glassName}' not found.`,
            });
            continue;
          }

          let ingredients;
          try {
            ingredients = parseIngredients();
          } catch (err) {
            errors.push(`Row ${rowNum} error: ${err.message}`);
            errorRows.push({ Row: rowNum, ...row, Error: err.message });
            continue;
          }

          if (!rawInstructions || rawInstructions === "") {
            errors.push(
              `Row ${rowNum} is invalid: There are no instructions listed.`
            );
            errorRows.push({
              Row: rowNum,
              ...row,
              Error: `There are no instructions listed.`,
            });
            continue;
          }

          // inside your loop / create/edit handler
          let categoryArr = [];
          if (categories) {
            // normalize into array
            categoryArr = Array.isArray(categories)
              ? categories
              : categories
                  .split(",")
                  .map((c) => c.trim())
                  .filter((c) => c.length > 0);

            // validate every entry
            const invalidOnes = categoryArr.filter(
              (c) => !validCategoryInputs.includes(c)
            );

            if (invalidOnes.length > 0) {
              errors.push(
                `Row ${rowNum} has invalid categories: ${invalidOnes.join(", ")}`
              );
              errorRows.push({
                Row: rowNum,
                ...row,
                Error: `Invalid categories: ${invalidOnes.join(", ")}`,
              });
              continue; // skip this row
            }
          }

          // validate categories already done above; now tags
          let tagArr = [];
          if (tagsRaw) {
            tagArr = normalizeStringArray(tagsRaw);
            const invalidTags = tagArr.filter((t) => !TAG_ENUM.includes(t));
            if (invalidTags.length) {
              errors.push(
                `Row ${rowNum} has invalid tags: ${invalidTags.join(", ")}`
              );
              errorRows.push({
                Row: rowNum,
                ...row,
                Error: `Invalid tags: ${invalidTags.join(", ")}`,
              });
              continue;
            }
          }

          const slug = formatSlug(name);

          // ⬇️ Try to load default image for this slug
          let photoFields = {};
          try {
            const found = await getDefaultImageIfExists(slug);
            if (found) {
              photoFields = {
                photo: found.photo, // https://res.cloudinary.com/.../default/images/<slug>.png
                photoPublicId: found.photoPublicId, // default/images/<slug>
              };
            }
          } catch (e) {
            // Optional: keep going even if Cloudinary hiccups
            console.warn(
              `default image check failed for ${slug}:`,
              e?.message || e
            );
          }

          const created = await Drink.create({
            name,
            slug,
            description,
            isAlcoholic,
            glass: glass._id,
            ingredients,
            categories: (categories || "")
              .split(",")
              .map((c) => c.trim())
              .filter((c) => c.length > 0),
            instructions: rawInstructions
              .split(".")
              .map((instr) => instr.trim())
              .filter((instr) => instr.length > 0),
            taste: taste
              .split(",")
              .map((t) => t.trim())
              .filter((t) => t.length > 0),
            colors: colors
              .split(",")
              .map((c) => c.trim())
              .filter((c) => c.length > 0),
            tools: tools
              .split(",")
              .map((t) => t.trim())
              .filter((t) => t.length > 0),
            garnishes: garnishes
              .split(",")
              .map((g) => g.trim())
              .filter((g) => g.length > 0),
            status,
            tags: tagArr,
            ...photoFields, // ⬅️ only set if default image exists
          });

          await logRow({
            targetId: created._id.toString(),
            rowNum,
            label: created.name,
            extraMeta: {
              glass: glass?.name,
              isAlcoholic: created.isAlcoholic,
              ingredients: created.ingredients.map(
                (i) => `${i.ounces}oz ${i.name}`
              ),
            },
          });

          successCount.add++;
        } else if (type === "edit") {
          if (!name) {
            errors.push(`Row ${rowNum} is invalid: Name is blank.`);
            blankNames.push(rowNum);
            errorRows.push({ Row: rowNum, ...row, Error: "Name is blank." });
            continue;
          }

          const drink = await Drink.findOne({ name });
          const before = drink.toObject();

          if (!drink) {
            errors.push(`Row ${rowNum} is invalid: Name not found.`);
            errorRows.push({ Row: rowNum, ...row, Error: "Name not found." });
            continue;
          }

          if (newName && newName !== name) {
            const newNameExist = await Drink.findOne({ name: newName });
            if (newNameExist) {
              errors.push(
                `Row ${rowNum} is invalid: New name wanted already exists.`
              );
              errorRows.push({
                Row: rowNum,
                ...row,
                Error: "New name wanted already exists.",
              });
              continue;
            }
            drink.name = newName;
            drink.slug = formatSlug(newName);

            // If drink has no custom photo, try attach default for new slug
            if (
              !drink.photoPublicId ||
              drink.photoPublicId.startsWith("default/images/")
            ) {
              try {
                const found = await getDefaultImageIfExists(drink.slug);
                if (found) {
                  drink.photoPublicId = found.photoPublicId;
                  drink.photo = found.photo;
                }
              } catch (e) {
                console.warn(
                  `default image check failed for ${drink.slug}:`,
                  e?.message || e
                );
              }
            }
          }

          if (description && description !== "")
            drink.description = description;
          if (glass) drink.glass = glass._id;
          if (typeof isAlcoholic === "boolean") drink.isAlcoholic = isAlcoholic;
          if (rawInstructions && rawInstructions !== "") {
            drink.instructions = rawInstructions
              .split(".")
              .map((instr) => instr.trim())
              .filter((instr) => instr.length > 0);
          }
          if (taste && taste !== "")
            drink.taste = taste
              .split(",")
              .map((t) => t.trim())
              .filter((t) => t.length > 0);
          if (colors && colors !== "")
            drink.colors = colors
              .split(",")
              .map((c) => c.trim())
              .filter((c) => c.length > 0);

          if (tools && tools !== "")
            drink.tools = tools
              .split(",")
              .map((t) => t.trim())
              .filter((t) => t.length > 0);

          if (garnishes && garnishes !== "")
            drink.garnishes = garnishes
              .split(",")
              .map((g) => g.trim())
              .filter((g) => g.length > 0);
          if (status && status !== "") drink.status = status;

          if (rawIngredients) {
            try {
              const ingredients = parseIngredients();
              drink.ingredients = ingredients;
            } catch (err) {
              errors.push(`Row ${rowNum} error: ${err.message}`);
              errorRows.push({ Row: rowNum, ...row, Error: err.message });
              continue;
            }
          }

          // inside your loop / create/edit handler
          let categoryArr = [];
          if (categories && categories !== "") {
            // normalize into array
            categoryArr = Array.isArray(categories)
              ? categories
              : categories
                  .split(",")
                  .map((c) => c.trim())
                  .filter((c) => c.length > 0);

            // validate every entry
            const invalidOnes = categoryArr.filter(
              (c) => !validCategoryInputs.includes(c)
            );

            if (invalidOnes.length > 0) {
              errors.push(
                `Row ${rowNum} has invalid categories: ${invalidOnes.join(", ")}`
              );
              errorRows.push({
                Row: rowNum,
                ...row,
                Error: `Invalid categories: ${invalidOnes.join(", ")}`,
              });
              continue; // skip this row
            }

            drink.categories = categories
              .split(",")
              .map((c) => c.trim())
              .filter((c) => c.length > 0);
          }

          // tags only if provided
          if (typeof tagsRaw === "string" && tagsRaw.length) {
            const tagArr = normalizeStringArray(tagsRaw);
            const invalidTags = tagArr.filter((t) => !TAG_ENUM.includes(t));
            if (invalidTags.length) {
              errors.push(
                `Row ${rowNum} has invalid tags: ${invalidTags.join(", ")}`
              );
              errorRows.push({
                Row: rowNum,
                ...row,
                Error: `Invalid tags: ${invalidTags.join(", ")}`,
              });
              continue;
            }
            drink.tags = tagArr;
          }

          await drink.save();
          const after = drink.toObject();

          // lightweight ingredient delta (names only)
          const beforeIng = (before.ingredients || []).map((i) => i.name);
          const afterIng = (after.ingredients || []).map((i) => i.name);
          const ingChanged =
            JSON.stringify(beforeIng) !== JSON.stringify(afterIng);

          const changes = diffFields(before, after, [
            "name",
            "slug",
            "description",
            "isAlcoholic",
            "glass",
            "instructions",
            "taste",
            "colors",
            "tools",
            "garnishes",
            "status",
            "categories",
            "tags",
          ]);
          if (ingChanged) {
            changes.push({
              path: "ingredients",
              from: beforeIng,
              to: afterIng,
            });
          }

          await logRow({
            targetId: drink._id.toString(),
            rowNum,
            label: `${before.name} → ${after.name}`,
            changes,
          });

          successCount.edit++;
        } else if (type === "delete") {
          if (!name) {
            errors.push(`Row ${rowNum} is invalid: Name is blank.`);
            blankNames.push(rowNum);
            errorRows.push({ Row: rowNum, ...row, Error: "Name is blank." });

            continue;
          }

          const drinkExist = await Drink.findOne({ name });
          if (!drinkExist) {
            errors.push(
              `Row ${rowNum} is invalid: There is no drink with that name.`
            );
            errorRows.push({ Row: rowNum, ...row, Error: "Name not found." });
            continue;
          }
          const before = drinkExist.toObject();

          // 1) Collect all comment IDs for this drink
          const comments = await Comment.find({ drink: drinkExist._id })
            .select("_id")
            .lean();
          const commentIds = comments.map((c) => c._id);

          // 2) Delete notifications tied to the drink or its comments
          await Notification.deleteMany({
            $or: [
              { entity: drinkExist._id }, // notifications attached to the drink
              { comment: { $in: commentIds } }, // notifications attached to comments on this drink
            ],
          });

          // 3) Delete comments for this drink
          await Comment.deleteMany({ drink: drinkExist._id });

          // 4) Delete the drink itself
          await Drink.deleteOne({ _id: drinkExist._id });

          await Promise.all([
            DrinkLike.deleteMany({ drink: drinkExist._id }),
            DrinkSave.deleteMany({ drink: drinkExist._id }),
          ]);

          await logRow({
            targetId: before._id.toString(),
            rowNum,
            label: before.name,
            extraMeta: {
              previousGlass: (await Glass.findById(before.glass))?.name,
              previousIsAlcoholic: before.isAlcoholic,
              deletedCommentCount: commentIds.length,
              deletedNotificationScope: ["drink", "comments"],
            },
          });

          successCount.delete++;
        }
      }

      const suggestions = [];
      if (blankNames.length === rows.length)
        suggestions.push(`All of the names are blank.`);
      else if (blankNames.length > rows.length / 2)
        suggestions.push(
          `You might want to take a look at the names because most of them are blank as shown in rows {${blankNames.join(
            ", "
          )}}.`
        );
      if (takenNames.length === rows.length)
        suggestions.push(
          `All of the names listed in the Excel sheet have already been added to our system.`
        );
      else if (takenNames.length > rows.length / 2)
        suggestions.push(
          `You might want to take a look at the names because most of them are already added as shown in rows {${takenNames.join(
            ", "
          )}}.`
        );

      const message =
        errors.length === 0
          ? `Successfully ${type === "delete" ? "delet" : type}ed ${
              successCount[type]
            } drinks!`
          : `${successCount[type]} drinks successfully ${
              type === "delete" ? "delet" : type
            }ed.<br><br>${suggestions.join("<br>")}<br>- ${errors.join(
              "<br>- "
            )}`;

      await logBatch({
        counts: successCount,
        errorsCount: errors.length,
        suggestions,
        meta: {
          fileName: req.file?.originalname,
          mimetype: req.file?.mimetype,
          errorRows,
        },
      });

      res
        .status(200)
        .json({ success: true, message, errorsPresent: errors.length > 0 });
    } catch (error) {
      console.error("Bulk drink upload failed:", error);
      res
        .status(500)
        .json({ success: false, message: "Failed to process bulk upload." });
    }
  },
  // -------- FILE UPLOAD --------
  uploadDrinkImage: async (req, res) => {
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
  uploadDrinkVideo: async (req, res) => {
    if (!req.file) {
      return res
        .status(400)
        .json({ success: false, message: "No video file provided" });
    }

    const filePath = req.file.path;

    try {
      const result = await handleVideoUpload(filePath);
      return res.status(200).json({
        success: true,
        message: "Video uploaded to Cloudinary.",
        data: {
          video: result.secure_url,
          videoPublicId: result.public_id,
        },
      });
    } catch (error) {
      return res.status(400).json({ success: false, message: error.message });
    } finally {
      fs.unlink(filePath, (err) => {
        if (err) console.error("Failed to delete temp file:", err);
      });
    }
  },
  updateDrinkPhoto: async (req, res) => {
    try {
      const { id } = req.params;

      if (!req.file || !req.file.path) {
        return res
          .status(400)
          .json({ success: false, message: "No image uploaded." });
      }

      // Find customer
      const drink = await Drink.findById(id);
      if (!drink) {
        return res
          .status(404)
          .json({ success: false, message: "Drink not found." });
      }

      // Delete previous photo from Cloudinary if it exists
      if (
        drink?.photoPublicId &&
        !drink?.photoPublicId.startsWith("default/")
      ) {
        await cloudinary.uploader.destroy(drink?.photoPublicId);
      }

      // Upload new photo (no folder)
      const result = await cloudinary.uploader.upload(req.file.path, {
        public_id: drink?.photoPublicId,
        resource_type: "image",
      });

      // Save new photo URL and public ID
      drink.photo = result.secure_url; // ✅ Cloudinary image URL
      drink.photoPublicId = result.public_id; // Optional cleanup
      await drink.save();

      return res.status(200).json({
        success: true,
        message: "Profile photo updated.",
        data: { photo: result.secure_url, photoPublicId: result.public_id },
      });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  },
  updateDrinkVideo: async (req, res) => {
    try {
      const { id } = req.params;

      if (!req.file || !req.file.path) {
        return res
          .status(400)
          .json({ success: false, message: "No video uploaded." });
      }

      // Find customer
      const drink = await Drink.findById(id);
      if (!drink) {
        return res
          .status(404)
          .json({ success: false, message: "Drink not found." });
      }

      // Delete previous photo from Cloudinary if it exists
      if (
        drink?.videoPublicId &&
        !drink?.videoPublicId.startsWith("default/")
      ) {
        await cloudinary.uploader.destroy(drink?.videoPublicId);
      }

      // Upload new photo (no folder)
      const result = await cloudinary.uploader.upload(req.file.path, {
        public_id: drink?.videoPublicId,
        resource_type: "video",
      });

      // Save new photo URL and public ID
      drink.video = result.secure_url; // ✅ Cloudinary image URL
      drink.videoPublicId = result.public_id; // Optional cleanup
      await drink.save();

      return res.status(200).json({
        success: true,
        message: "Profile photo updated.",
        data: { video: result.secure_url, videoPublicId: result.public_id },
      });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  },

  // -------- CREATE --------
  createDrink: async (req, res) => {
    try {
      let {
        name,
        photo,
        photoPublicId,
        video,
        videoPublicId,
        description,
        colors,
        taste,
        categories,
        tags,
        glass,
        tools,
        garnishes,
        isAlcoholic,
        ingredients,
        instructions,
        datePublishStarts,
        datePublishEnds,
      } = req.body;

      // Basic validations...
      if (!name) {
        return res
          .status(400)
          .json({ success: false, message: "Name needs to be placed." });
      }

      // if (!photo || !photoPublicId) {
      //   return res
      //     .status(400)
      //     .json({ success: false, message: "Photo needs to be placed." });
      // }

      if (!description) {
        return res
          .status(400)
          .json({ success: false, message: "Description needs to be placed." });
      }

      if (!glass) {
        return res
          .status(400)
          .json({ success: false, message: "Glass needs to be placed." });
      }

      if (!ingredients?.length) {
        return res
          .status(400)
          .json({ success: false, message: "Ingredients need to be placed." });
      }

      if (!instructions?.length) {
        return res
          .status(400)
          .json({ success: false, message: "Instructions need to be placed." });
      }

      // 👇 only if client didn’t upload or pass anything:
      if (!photo || !photoPublicId) {
        photo =
          "https://res.cloudinary.com/dtbgyeyjq/image/upload/v1747893721/default/images/drink.png";
        photoPublicId = "default/images/drink";
      }

      // Duplicate check
      const existingDrink = await Drink.findOne({ name });
      if (existingDrink) {
        return res.status(400).json({
          success: false,
          message: "Drink with this name already exists.",
        });
      }

      const existingGlass = await Glass.findById(glass);
      if (!existingGlass) {
        return res.status(400).json({
          success: false,
          message: "The glass does not exist in database.",
        });
      }

      const normalizedCategories = normalizeStringArray(categories);
      const normalizedTags = normalizeStringArray(tags);

      validateTagsOrThrow(normalizedTags);

      const slug = formatSlug(name);

      const cleanIngredients = (ingredients || [])
        .map((i) => ({
          _id: i._id, // optional: keep if you use it elsewhere
          name: String(i.name || "").trim(),
          ounces: Number(i.ounces),
          brand: String(i.brand || "").trim(), // 👈 keep brand
          flavor: String(i.flavor || "").trim(),
        }))
        .filter((i) => i.name && !Number.isNaN(i.ounces) && i.ounces > 0);

      const finalPhoto =
        photo ||
        "https://res.cloudinary.com/dtbgyeyjq/image/upload/v1747893721/default/images/drink.png";

      const finalPhotoPublicId = photoPublicId || "default/images/drink";

      // Create Drink
      const drink = new Drink({
        name,
        slug,
        description,
        photo: finalPhoto,
        photoPublicId: finalPhotoPublicId,
        video,
        videoPublicId,
        colors: normalizeStringArray(colors),
        taste: normalizeStringArray(taste),
        categories: normalizedCategories,
        tags: normalizedTags,
        glass,
        tools: normalizeStringArray(tools),
        garnishes: normalizeStringArray(garnishes),
        isAlcoholic,
        ingredients: cleanIngredients,
        instructions,
        dates: {
          dateCreated: Date.now(),
          datePublishStarts,
          datePublishEnds,
        },
      });

      await drink.save();

      await req
        .logActivity({
          action: "create",
          target: { model: "Drink", id: drink._id, name: drink.name },
          summary: `Created drink "${drink.name}"`,
          actor: {
            type: "User",
            id: req.user.id,
            label: {
              fullName: req.user.fullName,
              email: req.user.email,
              role: req.user.role,
            },
          },
          nextSnapshot: {
            name: drink.name,
            slug: drink.slug,
            glass: drink.glass,
            isAlcoholic: drink.isAlcoholic,
            status: drink.status,
          },
        })
        .catch((err) =>
          console.warn("[activity] createDrink failed:", err?.message)
        );

      return res.status(200).json({
        success: true,
        message: "Drink created successfully.",
        data: drink,
      });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  },

  // -------- READ --------
  viewAllDrinks: async (req, res) => {
    try {
      const drinks = await Drink.find()
        .sort({ name: 1 })
        .populate("glass")
        .populate({
          path: "analytics.userComments.comment",
          populate: {
            path: "analytics.userReplies", // nested replies
            populate: {
              path: "author",
              select: "fullName profile.photo",
            },
          },
        })
        .lean();

      if (!drinks) {
        return res
          .status(404)
          .json({ success: false, message: "Drinks not found." });
      }
      return res.status(200).json({ success: true, data: drinks });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  },
  viewDrink: async (req, res) => {
    try {
      const { id } = req.params;

      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res
          .status(400)
          .json({ success: false, message: "Invalid drink ID." });
      }

      const drink = await Drink.findById(id)
        .populate({
          path: "analytics.userComments.comment",
          populate: [
            {
              path: "author.id",
              select: "fullName profile.photo",
            },
            {
              path: "analytics.userReplies",
              populate: {
                path: "author.id",
                select: "fullName profile.photo",
              },
            },
          ],
        })
        .populate({
          path: "glass",
          model: "Glass",
          select: "name",
        });

      if (!drink) {
        return res
          .status(404)
          .json({ success: false, message: "Drink not found." });
      }
      return res.status(200).json({ success: true, data: drink });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  },

  viewDrinkbySlug: async (req, res) => {
    try {
      const { slug } = req.params;
      const drink = await Drink.findOne({ slug: slug }).populate({
        path: "glass",
        model: "Glass",
        select: "name",
      });

      if (!drink) {
        return res
          .status(404)
          .json({ success: false, message: "Drink not found." });
      }
      return res.status(200).json({ success: true, data: drink });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  },
  viewDrinkSharePreview: async (req, res) => {
    try {
      const { slug } = req.params;
      const drink = await Drink.findOne({ slug })
        .select("name slug description photo")
        .lean();

      const appBase =
        process.env.PUBLIC_APP_URL ||
        process.env.FRONTEND_URL ||
        `${req.protocol}://${req.get("host")}`;
      const shareBase =
        process.env.PUBLIC_SHARE_URL || `${req.protocol}://${req.get("host")}`;

      const drinkUrl = absoluteUrl(`/drinks/${slug}`, appBase);
      const shareUrl = absoluteUrl(`/share/drinks/${slug}`, shareBase);

      if (!drink) {
        return res.redirect(302, drinkUrl);
      }

      const title = `${drink.name} | Tipsyverse`;
      const description = "Enjoy this drink!";
      const image = cloudinaryPreviewUrl(
        absoluteUrl(
          drink.photo ||
            "https://res.cloudinary.com/dtbgyeyjq/image/upload/c_fill,w_1200,h_630,g_auto,f_jpg,q_auto/v1747893721/default/images/drink.png",
          shareBase
        )
      );

      res.set("Content-Type", "text/html; charset=utf-8");
      res.send(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>${escapeHtml(title)}</title>
    <meta name="description" content="${escapeHtml(description)}" />
    <meta name="title" content="${escapeHtml(title)}" />
    <link rel="canonical" href="${escapeHtml(drinkUrl)}" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="Tipsyverse" />
    <meta property="og:title" content="${escapeHtml(title)}" />
    <meta property="og:description" content="${escapeHtml(description)}" />
    <meta property="og:url" content="${escapeHtml(shareUrl)}" />
    <meta property="og:image" content="${escapeHtml(image)}" />
    <meta property="og:image:secure_url" content="${escapeHtml(image)}" />
    <meta property="og:image:type" content="image/jpeg" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:image:alt" content="${escapeHtml(drink.name)}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeHtml(title)}" />
    <meta name="twitter:description" content="${escapeHtml(description)}" />
    <meta name="twitter:image" content="${escapeHtml(image)}" />
    <meta name="twitter:image:alt" content="${escapeHtml(drink.name)}" />
    <style>
      body {
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
        font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        background: #1f1f1f;
        color: white;
      }
      a {
        color: inherit;
        text-decoration: none;
      }
      .card {
        width: min(92vw, 560px);
        border-radius: 22px;
        overflow: hidden;
        background: #333;
        box-shadow: 0 18px 60px rgba(0,0,0,.35);
      }
      img {
        display: block;
        width: 100%;
        aspect-ratio: 1200 / 630;
        object-fit: cover;
      }
      .content {
        padding: 18px 20px 22px;
      }
      h1 {
        margin: 0 0 6px;
        font-size: 24px;
        line-height: 1.2;
      }
      p {
        margin: 0;
        color: #ddd;
      }
    </style>
  </head>
  <body>
    <a class="card" href="${escapeHtml(drinkUrl)}">
      <img src="${escapeHtml(image)}" alt="${escapeHtml(drink.name)}" />
      <div class="content">
        <h1>${escapeHtml(title)}</h1>
        <p>${escapeHtml(description)}</p>
      </div>
    </a>
    <script>
      if (!/bot|crawler|spider|facebookexternalhit|twitterbot|slackbot|discordbot|linkedinbot|whatsapp|telegrambot/i.test(navigator.userAgent)) {
        window.setTimeout(() => window.location.replace(${JSON.stringify(drinkUrl)}), 700);
      }
    </script>
  </body>
</html>`);
    } catch (err) {
      return res.status(500).send("Could not load share preview.");
    }
  },
  viewTopTrending: async (req, res) => {
    try {
      const trendingDrinks = await Drink.aggregate([
        { $match: { status: "Active" } },
        {
          $addFields: {
            trendingScore: {
              $add: [
                { $multiply: [{ $ifNull: ["$analytics.counts.views", 0] }, 1] },
                { $multiply: [{ $ifNull: ["$analytics.counts.likes", 0] }, 2] },
                {
                  $multiply: [
                    { $ifNull: ["$analytics.counts.comments", 0] },
                    3,
                  ],
                },
                {
                  $multiply: [{ $ifNull: ["$analytics.counts.shares", 0] }, 2],
                },
                {
                  $multiply: [
                    { $ifNull: ["$analytics.counts.bookmarks", 0] },
                    2,
                  ],
                },
              ],
            },
          },
        },
        { $sort: { trendingScore: -1 } },
        { $limit: 10 },
        {
          $project: {
            name: 1,
            slug: 1,
            photo: 1,
            description: 1,
            trendingScore: 1,

            // ✅ keep counts
            analytics: {
              counts: {
                views: { $ifNull: ["$analytics.counts.views", 0] },
                likes: { $ifNull: ["$analytics.counts.likes", 0] },
                comments: { $ifNull: ["$analytics.counts.comments", 0] },
                shares: { $ifNull: ["$analytics.counts.shares", 0] },
                bookmarks: { $ifNull: ["$analytics.counts.bookmarks", 0] },
              },
            },

            // (your ingredient normalization)
            ingredients: {
              $map: {
                input: { $ifNull: ["$ingredients", []] },
                as: "ing",
                in: {
                  name: {
                    $ifNull: [
                      "$$ing.name",
                      { $cond: [{ $isArray: "$$ing" }, null, "$$ing"] },
                    ],
                  },
                },
              },
            },
          },
        },
        {
          $addFields: {
            ingredients: {
              $filter: {
                input: "$ingredients",
                as: "i",
                cond: {
                  $and: [
                    { $ne: ["$$i", null] },
                    { $ne: ["$$i.name", null] },
                    { $ne: ["$$i.name", ""] },
                  ],
                },
              },
            },
          },
        },
      ]);

      res.status(200).json({ success: true, data: trendingDrinks });
    } catch (error) {
      console.error("🔥 Trending drinks error:", error);
      res
        .status(500)
        .json({ success: false, message: "Failed to get trending drinks." });
    }
  },

  viewRecommendedDrinksForUser: async (req, res) => {
    try {
      // 1) Safe user extraction (supports guests)
      const userId = req.user?._id || req.user?.id || null;
      let allergies = [];

      if (userId) {
        const user = await User.findById(userId).lean();
        if (!user) {
          return res
            .status(404)
            .json({ success: false, message: "User not found." });
        }
        allergies = user.preferences?.allergies || [];
      }

      // 2) If no user → go straight to trending with allergy filter
      if (!userId) {
        const trending = await Drink.aggregate([
          { $match: { status: "Active" } },
          {
            $addFields: {
              // guard counts with $ifNull so math never sees nulls
              _views: { $ifNull: ["$analytics.counts.views", 0] },
              _likes: { $ifNull: ["$analytics.counts.likes", 0] },
              _comments: { $ifNull: ["$analytics.counts.comments", 0] },
              _shares: { $ifNull: ["$analytics.counts.shares", 0] },
              _bookmarks: { $ifNull: ["$analytics.counts.bookmarks", 0] },
            },
          },
          {
            $addFields: {
              trendingScore: {
                $add: [
                  { $multiply: ["$_views", 1] },
                  { $multiply: ["$_likes", 2] },
                  { $multiply: ["$_comments", 3] },
                  { $multiply: ["$_shares", 2] },
                  { $multiply: ["$_bookmarks", 2] },
                ],
              },
            },
          },
          // allergy filter (no-op if allergies is empty)
          { $match: { "ingredients.name": { $nin: allergies } } },
          { $sort: { trendingScore: -1 } },
          { $limit: 10 },
          {
            $project: {
              name: 1,
              slug: 1,
              photo: 1,
              description: 1,
              analytics: {
                counts: {
                  views: { $ifNull: ["$analytics.counts.views", 0] },
                  likes: { $ifNull: ["$analytics.counts.likes", 0] },
                  comments: { $ifNull: ["$analytics.counts.comments", 0] },
                  shares: { $ifNull: ["$analytics.counts.shares", 0] },
                  bookmarks: { $ifNull: ["$analytics.counts.bookmarks", 0] },
                },
              },
            },
          },
        ]);

        return res.status(200).json({
          success: true,
          data: trending,
          message: "Guest user — showing trending drinks.",
        });
      }

      // 3) Find drinks this user interacted with
      const uid = new mongoose.Types.ObjectId(userId);
      const [likedDrinkIds, savedDrinkIds] = await Promise.all([
        DrinkLike.distinct("drink", { user: uid }),
        DrinkSave.distinct("drink", { user: uid }),
      ]);
      const interactedDrinks = await Drink.find({
        $or: [
          { "analytics.userViews.user": uid },
          { "analytics.userShares.user": uid },
          // You had `.comment` here — likely meant `.user`
          { "analytics.userComments.user": uid },
          { _id: { $in: [...likedDrinkIds, ...savedDrinkIds] } },
        ],
      })
        .select("_id colors taste tools garnishes tags")
        .lean();

      // 4) If no history → trending fallback (still uses allergies)
      if (!interactedDrinks.length) {
        const trending = await Drink.aggregate([
          { $match: { status: "Active" } },
          {
            $addFields: {
              _views: { $ifNull: ["$analytics.counts.views", 0] },
              _likes: { $ifNull: ["$analytics.counts.likes", 0] },
              _comments: { $ifNull: ["$analytics.counts.comments", 0] },
              _shares: { $ifNull: ["$analytics.counts.shares", 0] },
              _bookmarks: { $ifNull: ["$analytics.counts.bookmarks", 0] },
            },
          },
          {
            $addFields: {
              trendingScore: {
                $add: [
                  { $multiply: ["$_views", 1] },
                  { $multiply: ["$_likes", 2] },
                  { $multiply: ["$_comments", 3] },
                  { $multiply: ["$_shares", 2] },
                  { $multiply: ["$_bookmarks", 2] },
                ],
              },
            },
          },
          { $match: { "ingredients.name": { $nin: allergies } } },
          { $sort: { trendingScore: -1 } },
          { $limit: 10 },
          {
            $project: {
              name: 1,
              slug: 1,
              photo: 1,
              description: 1,
              trendingScore: 1,
              analytics: {
                counts: {
                  views: { $ifNull: ["$analytics.counts.views", 0] },
                  likes: { $ifNull: ["$analytics.counts.likes", 0] },
                  comments: { $ifNull: ["$analytics.counts.comments", 0] },
                  shares: { $ifNull: ["$analytics.counts.shares", 0] },
                  bookmarks: { $ifNull: ["$analytics.counts.bookmarks", 0] },
                },
              },
            },
          },
        ]);

        return res.status(200).json({
          success: true,
          data: trending,
          message: "No personal history found — showing trending drinks.",
        });
      }

      // 5) Build tag sets from history
      const tagSets = {
        colors: new Set(),
        taste: new Set(),
        tools: new Set(),
        garnishes: new Set(),
        tags: new Set(),
      };
      for (const d of interactedDrinks) {
        (d.colors || []).forEach((v) => tagSets.colors.add(v));
        (d.taste || []).forEach((v) => tagSets.taste.add(v));
        (d.tools || []).forEach((v) => tagSets.tools.add(v));
        (d.garnishes || []).forEach((v) => tagSets.garnishes.add(v));
        (d.tags || []).forEach((v) => tagSets.tags.add(v));
      }

      const colorsArr = Array.from(tagSets.colors);
      const tasteArr = Array.from(tagSets.taste);
      const toolsArr = Array.from(tagSets.tools);
      const garnishesArr = Array.from(tagSets.garnishes);
      const tagsArr = Array.from(tagSets.tags);

      const haveAnyPrefs =
        colorsArr.length ||
        tasteArr.length ||
        toolsArr.length ||
        garnishesArr.length ||
        tagsArr.length;

      // 6) If we don’t have any extracted prefs, fallback to trending again
      if (!haveAnyPrefs) {
        const trending = await Drink.aggregate([
          { $match: { status: "Active" } },
          {
            $addFields: {
              _views: { $ifNull: ["$analytics.counts.views", 0] },
              _likes: { $ifNull: ["$analytics.counts.likes", 0] },
              _comments: { $ifNull: ["$analytics.counts.comments", 0] },
              _shares: { $ifNull: ["$analytics.counts.shares", 0] },
              _bookmarks: { $ifNull: ["$analytics.counts.bookmarks", 0] },
            },
          },
          {
            $addFields: {
              trendingScore: {
                $add: [
                  { $multiply: ["$_views", 1] },
                  { $multiply: ["$_likes", 2] },
                  { $multiply: ["$_comments", 3] },
                  { $multiply: ["$_shares", 2] },
                  { $multiply: ["$_bookmarks", 2] },
                ],
              },
            },
          },
          { $match: { "ingredients.name": { $nin: allergies } } },
          { $sort: { trendingScore: -1 } },
          { $limit: 10 },
          {
            $project: {
              name: 1,
              slug: 1,
              photo: 1,
              description: 1,
              trendingScore: 1,
            },
          },
        ]);
        return res.status(200).json({
          success: true,
          data: trending,
          message: "Not enough preference signals — showing trending drinks.",
        });
      }

      // 7) Recommended, guarded against null arrays
      const recommended = await Drink.aggregate([
        {
          $match: {
            _id: { $nin: interactedDrinks.map((d) => d._id) },
            status: "Active",
            "ingredients.name": { $nin: allergies },
            $or: [
              ...(colorsArr.length ? [{ colors: { $in: colorsArr } }] : []),
              ...(tasteArr.length ? [{ taste: { $in: tasteArr } }] : []),
              ...(toolsArr.length ? [{ tools: { $in: toolsArr } }] : []),
              ...(garnishesArr.length
                ? [{ garnishes: { $in: garnishesArr } }]
                : []),
              ...(tagsArr.length ? [{ tags: { $in: tagsArr } }] : []),
            ],
          },
        },
        {
          $addFields: {
            _colors: { $ifNull: ["$colors", []] },
            _taste: { $ifNull: ["$taste", []] },
            _tools: { $ifNull: ["$tools", []] },
            _garnishes: { $ifNull: ["$garnishes", []] },
            _tags: { $ifNull: ["$tags", []] },
          },
        },
        {
          $addFields: {
            relevanceScore: {
              $add: [
                { $size: { $setIntersection: ["$_colors", colorsArr] } },
                { $size: { $setIntersection: ["$_taste", tasteArr] } },
                { $size: { $setIntersection: ["$_tools", toolsArr] } },
                { $size: { $setIntersection: ["$_garnishes", garnishesArr] } },
                { $size: { $setIntersection: ["$_tags", tagsArr] } },
              ],
            },
          },
        },
        { $sort: { relevanceScore: -1, _id: 1 } },
        { $limit: 10 },
        {
          $project: {
            name: 1,
            slug: 1,
            photo: 1,
            description: 1,
            relevanceScore: 1,
          },
        },
      ]);

      return res.status(200).json({ success: true, data: recommended });
    } catch (error) {
      console.error("Recommendation error:", error);
      return res.status(500).json({
        success: false,
        message: error?.message || "Recommendation failed.",
      });
    }
  },

  // -------- MOST RECENT (7-day window) --------
  // GET /drinks/recent
  viewMostRecentDrinks: async (req, res) => {
    try {
      const now = new Date();
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      const recent = await Drink.aggregate([
        // Normalize "created" timestamp across schemas
        {
          $addFields: {
            _createdAt: {
              $ifNull: ["$createdAt", "$dates.dateCreated"],
            },
          },
        },
        // Only items within last 7 days
        {
          $match: {
            _createdAt: { $gte: sevenDaysAgo },
          },
        },
        // Sort newest first
        { $sort: { _createdAt: -1 } },
        // Only the top 15
        { $limit: 15 },
        // Project the fields you care about (adjust as needed)
        {
          $project: {
            name: 1,
            slug: 1,
            description: 1,
            photo: 1,
            isAlcoholic: 1,
            glass: 1,
            _createdAt: 1,
            analytics: {
              counts: {
                views: { $ifNull: ["$analytics.counts.views", 0] },
                likes: { $ifNull: ["$analytics.counts.likes", 0] },
                comments: { $ifNull: ["$analytics.counts.comments", 0] },
                shares: { $ifNull: ["$analytics.counts.shares", 0] },
                bookmarks: { $ifNull: ["$analytics.counts.bookmarks", 0] },
              },
            },
          },
        },
      ]);

      // Optional: populate glass name after aggregation
      // (Mongoose can't populate directly from aggregation; use a follow-up step)
      const byId = new Map(recent.map((d) => [String(d._id), d]));
      const ids = recent.map((d) => d.glass).filter(Boolean);

      if (ids.length) {
        const glasses = await Glass.find({ _id: { $in: ids } })
          .select("name")
          .lean();

        const glassMap = new Map(glasses.map((g) => [String(g._id), g.name]));
        for (const d of recent) {
          if (d.glass)
            d.glass = {
              _id: d.glass,
              name: glassMap.get(String(d.glass)) || null,
            };
        }
      }

      return res.status(200).json({
        success: true,
        data: recent,
      });
    } catch (err) {
      console.error("mostRecentDrinks failed:", err);
      return res
        .status(500)
        .json({ success: false, message: "Failed to fetch recent drinks." });
    }
  },

  viewDrinksByCategory: async (req, res) => {
    try {
      const { name, limit = 12 } = req.query;
      if (!name)
        return res
          .status(400)
          .json({ success: false, message: "Category name required." });

      const drinks = await Drink.find({
        status: "Active",
        categories: name,
      })
        .select("name slug photo ingredients analytics.counts categories")
        .sort({ "analytics.counts.likes": -1, createdAt: -1 })
        .limit(Number(limit))
        .lean();

      return res.status(200).json({ success: true, data: drinks });
    } catch (e) {
      return res
        .status(500)
        .json({ success: false, message: "Failed to fetch category drinks." });
    }
  },

  // -------- UPDATE --------
  updateDrink: async (req, res) => {
    try {
      const { id } = req.params;

      const {
        name,
        description,
        glass,
        categories,
        tags,
        ingredients,
        instructions,
        ...updateFields
      } = req.body;

      // Basic validations...
      if (!name) {
        return res
          .status(400)
          .json({ success: false, message: "Name needs to be placed." });
      }

      if (!description) {
        return res
          .status(400)
          .json({ success: false, message: "Description needs to be placed." });
      }

      if (!glass) {
        return res
          .status(400)
          .json({ success: false, message: "Glass needs to be placed." });
      }

      if (!ingredients?.length) {
        return res
          .status(400)
          .json({ success: false, message: "Ingredients needs to be placed." });
      }

      if (!instructions?.length) {
        return res.status(400).json({
          success: false,
          message: "Instructions needs to be placed.",
        });
      }

      // Duplicate check
      const existingDrink = await Drink.findOne({ name, _id: { $ne: id } });
      if (existingDrink) {
        return res.status(400).json({
          success: false,
          message: "Drink with this name already exists.",
        });
      }

      const existingGlass = await Glass.findById(glass); // ✅ Correct
      if (!existingGlass) {
        return res.status(400).json({
          success: false,
          message: "The selected glass does not exist in our system.",
        });
      }

      const drink = await Drink.findById(id);
      if (!drink) {
        return res.status(404).json({
          success: false,
          message: "Drink not found.",
        });
      }

      const slug = formatSlug(name);

      const normalizedCategories = Array.isArray(categories)
        ? normalizeStringArray(categories)
        : undefined;

      const normalizedTags =
        typeof tags !== "undefined" ? normalizeStringArray(tags) : undefined;

      if (normalizedTags) validateTagsOrThrow(normalizedTags);

      const prevSnapshot = {
        name: drink.name,
        slug: drink.slug,
        description: drink.description,
        categories: Array.isArray(drink.categories) ? drink.categories : [],
        tags: Array.isArray(drink.tags) ? drink.tags : [],
        glass: drink.glass?.toString?.() ?? drink.glass,
        isAlcoholic: drink.isAlcoholic,
        status: drink.status,
      };

      const cleanIngredients = (ingredients || [])
        .map((i) => ({
          _id: i._id,
          name: String(i.name || "").trim(),
          ounces: Number(i.ounces),
          brand: String(i.brand || "").trim(), // 👈
          flavor: String(i.flavor || "").trim(),
        }))
        .filter((i) => i.name && !Number.isNaN(i.ounces) && i.ounces > 0);

      // --- build update doc explicitly ---
      const updateDoc = {
        name,
        slug,
        description,
        glass,
        ingredients: cleanIngredients,
        instructions,
        ...updateFields,
      };
      if (normalizedCategories !== undefined) {
        updateDoc.categories = normalizedCategories; // <-- now we actually set it
      }
      if (normalizedTags !== undefined) updateDoc.tags = normalizedTags; // ⬅️ set tags if provided

      const updatedDrink = await Drink.findByIdAndUpdate(id, updateDoc, {
        new: true,
        runValidators: true,
      });

      if (!updatedDrink) {
        return res
          .status(404)
          .json({ success: false, message: "Drink not found." });
      }

      const nextSnapshot = {
        name: updatedDrink.name,
        slug: updatedDrink.slug,
        description: updatedDrink.description,
        categories: Array.isArray(updatedDrink.categories)
          ? updatedDrink.categories
          : [],
        tags: Array.isArray(updatedDrink.tags) ? updatedDrink.tags : [],
        glass: updatedDrink.glass?.toString?.() ?? updatedDrink.glass,
        isAlcoholic: updatedDrink.isAlcoholic,
        status: updatedDrink.status,
      };

      const changes = [];
      for (const k of Object.keys(prevSnapshot)) {
        if (String(prevSnapshot[k]) !== String(nextSnapshot[k])) {
          changes.push({ path: k, from: prevSnapshot[k], to: nextSnapshot[k] });
        }
      }

      await req
        .logActivity({
          action: "update",
          target: {
            model: "Drink",
            id: updatedDrink._id,
            name: updatedDrink.name,
          },
          actor: {
            type: "User",
            id: req.user.id,
            label: {
              fullName: req.user.fullName,
              email: req.user.email,
              role: req.user.role,
            },
          },
          summary: `Updated drink "${updatedDrink.name}"`,
          changes,
          prevSnapshot,
          nextSnapshot,
        })
        .catch((err) =>
          console.warn("[activity] updateDrink failed:", err?.message)
        );

      if (!updatedDrink)
        return res
          .status(404)
          .json({ success: false, message: "Drink not found." });

      return res.status(200).json({
        success: true,
        message: `Drink ${updatedDrink.name} has been updated successfully.`,
        data: updatedDrink,
      });
    } catch (error) {
      return res.status(500).json({ success: false, message: error.message });
    }
  },
  incrementDrinkView: async (req, res) => {
    try {
      const { slug } = req.params;
      const userId = req.user?.id || null;
      const anonId = userId ? null : req.anonId || null; // only use anonId when not logged in

      const today = new Date();
      today.setHours(0, 0, 0, 0); // midnight today

      // Build elemMatch based on identity type
      const match = {
        dateViewed: { $gte: today },
        ...(userId ? { user: userId } : { anonId }), // exactly one of these
      };

      // If anonId somehow missing (e.g., cookies disabled), let it count once per request
      const shouldCheck = userId || anonId;

      if (shouldCheck) {
        const existing = await Drink.findOne({
          slug,
          "analytics.userViews": { $elemMatch: match },
        }).lean();

        if (existing) {
          return res
            .status(200)
            .json({ success: true, message: "Already viewed today." });
        }
      }

      // Record the view
      const viewDoc = {
        user: userId || null,
        anonId: anonId || null,
        dateViewed: new Date(),
      };

      const updated = await Drink.findOneAndUpdate(
        { slug },
        {
          $inc: { "analytics.counts.views": 1 },
          $push: { "analytics.userViews": viewDoc },
        },
        { new: true }
      ).lean();

      if (!updated) {
        return res
          .status(404)
          .json({ success: false, message: "Drink not found" });
      }

      return res.status(200).json({ success: true, message: "View recorded." });
    } catch (error) {
      console.error("❌ Error incrementing view:", error);
      return res
        .status(500)
        .json({ success: false, message: "Could not record view" });
    }
  },

  toggleLikeDrink: async (req, res) => {
    try {
      const { drinkId } = req.params;
      const userId = req.user.id; // assuming you have auth middleware

      const drink = await Drink.findById(drinkId);
      const user = await User.findById(userId);
      if (!drink || !user)
        return res.status(404).json({ message: "Drink or user not found" });

      const existingLike = await DrinkLike.exists({
        user: userId,
        drink: drinkId,
      });
      const alreadyLiked = !!existingLike;

      if (alreadyLiked) {
        await DrinkLike.deleteOne({ user: userId, drink: drinkId });
      } else {
        await DrinkLike.updateOne(
          { user: userId, drink: drinkId },
          { $setOnInsert: { user: userId, drink: drinkId } },
          { upsert: true }
        );
      }

      const nextLikeCount = await DrinkLike.countDocuments({ drink: drinkId });

      await Drink.findByIdAndUpdate(drinkId, {
        $set: { "analytics.counts.likes": nextLikeCount },
      });

      await req
        .logActivity({
          action: "update",
          target: { model: "Drink", id: drink._id, name: drink.name },
          actor: {
            type: "User",
            id: req.user.id,
            label: {
              fullName: req.user.fullName,
              email: req.user.email,
              role: req.user.role,
            },
          },
          summary: alreadyLiked
            ? `Removed like from "${drink.name}"`
            : `Liked "${drink.name}"`,
          meta: {
            likeCount: nextLikeCount,
          },
        })
        .catch((err) =>
          console.warn("[activity] toggleLikeDrink failed:", err?.message)
        );

      await req
        .logActivity({
          action: "update",
          target: { model: "User", id: user._id, name: user.fullName },
          actor: {
            type: "User",
            id: req.user.id,
            label: {
              fullName: req.user.fullName,
              email: req.user.email,
              role: req.user.role,
            },
          },
          summary: alreadyLiked
            ? `Removed like from "${drink.name}"`
            : `Liked "${drink.name}"`,
          meta: {
            likeCount: nextLikeCount,
          },
        })
        .catch((err) =>
          console.warn("[activity] toggleLikeDrink failed:", err?.message)
        );

      return res.json({
        message: alreadyLiked ? "Drink unliked" : "Drink liked",
        liked: !alreadyLiked,
        likeCount: nextLikeCount,
      });
    } catch (err) {
      console.error(err);
      res
        .status(500)
        .json({ message: "An error occurred while toggling like" });
    }
  },

  toggleBookmarkDrink: async (req, res) => {
    try {
      const { drinkId } = req.params;
      const userId = req.user.id;

      const drink = await Drink.findById(drinkId);
      const user = await User.findById(userId);
      if (!drink || !user)
        return res.status(404).json({ message: "Drink or user not found" });

      const existingSave = await DrinkSave.exists({
        user: userId,
        drink: drinkId,
      });
      const alreadyBookmarked = !!existingSave;

      if (alreadyBookmarked) {
        await DrinkSave.deleteOne({ user: userId, drink: drinkId });
      } else {
        await DrinkSave.updateOne(
          { user: userId, drink: drinkId },
          { $setOnInsert: { user: userId, drink: drinkId } },
          { upsert: true }
        );
      }

      const nextSaveCount = await DrinkSave.countDocuments({ drink: drinkId });

      await Drink.findByIdAndUpdate(drinkId, {
        $set: { "analytics.counts.bookmarks": nextSaveCount },
      });

      await req
        .logActivity({
          action: "update",
          target: { model: "Drink", id: drink._id, name: drink.name },
          actor: {
            type: "User",
            id: req.user.id,
            label: {
              fullName: req.user.fullName,
              email: req.user.email,
              role: req.user.role,
            },
          },
          summary: alreadyBookmarked
            ? `Removed bookmark from "${drink.name}"`
            : `Bookmarked "${drink.name}"`,
          meta: {
            bookmarkCount: nextSaveCount,
          },
        })
        .catch((err) =>
          console.warn("[activity] toggleBookmarkDrink failed:", err?.message)
        );

      await req
        .logActivity({
          action: "update",
          target: { model: "User", id: user._id, name: user.fullName },
          actor: {
            type: "User",
            id: req.user.id,
            label: {
              fullName: req.user.fullName,
              email: req.user.email,
              role: req.user.role,
            },
          },
          summary: alreadyBookmarked
            ? `Removed bookmark from "${drink.name}"`
            : `Bookmarked "${drink.name}"`,
          meta: {
            bookmarkCount: nextSaveCount,
          },
        })
        .catch((err) =>
          console.warn("[activity] toggleBookmarkDrink failed:", err?.message)
        );

      return res.json({
        message: alreadyBookmarked ? "Bookmark removed" : "Drink saved",
      });
    } catch (err) {
      console.error(err);
      res
        .status(500)
        .json({ message: "An error occurred while toggling bookmark" });
    }
  },

  // -------- SHARE (public) --------
  // POST /drinks/:drinkId/share
  addShare: async (req, res) => {
    try {
      const { drinkId } = req.params;
      const drink = await Drink.findById(drinkId);
      if (!drink) {
        return res
          .status(404)
          .json({ success: false, message: "Drink not found." });
      }

      const userId = req.user?.id || null;
      const anonId = userId ? null : req.anonId || null; // only set anonId if not logged in

      // Build the share subdoc
      const shareDoc = {
        user: userId || null,
        anonId: anonId || null,
        dateShared: new Date(),
      };

      // Increment + append
      const updated = await Drink.findByIdAndUpdate(
        drinkId,
        {
          $inc: { "analytics.counts.shares": 1 },
          $push: {
            "analytics.userShares": {
              $each: [shareDoc],
              $slice: -5000, // keep only last 5000 shares (tune or remove)
            },
          },
        },
        { new: true }
      ).select("name analytics.counts.shares");

      // Activity log only for authenticated users
      if (req.user) {
        req
          .logActivity?.({
            action: "update",
            target: { model: "Drink", id: drink._id, name: drink.name },
            actor: {
              type: "User",
              id: req.user.id,
              label: {
                fullName: req.user.fullName,
                email: req.user.email,
                role: req.user.role,
              },
            },
            summary: `Shared "${drink.name}"`,
            meta: { shareCount: updated?.analytics?.counts?.shares ?? null },
          })
          .catch((err) =>
            console.warn("[activity] addShare failed:", err?.message)
          );
      }

      return res.status(200).json({
        success: true,
        message: "Share recorded.",
        shareCount: updated.analytics.counts.shares,
      });
    } catch (error) {
      console.error("❌ Error adding share:", error);
      return res
        .status(500)
        .json({ success: false, message: "Could not record share." });
    }
  },

  // -------- DELETE --------
  deleteDrink: async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const { id } = req.params;

      // 1) Load the drink inside the txn
      const drink = await Drink.findById(id).session(session);
      if (!drink) {
        await session.abortTransaction();
        session.endSession();
        return res
          .status(404)
          .json({ success: false, message: "Drink was not found." });
      }

      // Cache fields needed after deletion (for post-commit side effects + messaging)
      const drinkName = drink.name;
      const photoPublicId = drink.photoPublicId || null;
      const videoPublicId = drink.videoPublicId || null;

      // 2) Collect comment ids once (for notification cleanup)
      const comments = await Comment.find({ drink: id })
        .select("_id")
        .lean()
        .session(session);
      const commentIds = comments.map((c) => c._id);

      // 3) Remove user references and drink activity joins
      const pullOps = [
        User.updateMany(
          { createdDrinks: { $in: [id, String(id)] } },
          { $pull: { createdDrinks: { $in: [id, String(id)] } } },
          { session }
        ),
        DrinkLike.deleteMany({ drink: id }).session(session),
        DrinkSave.deleteMany({ drink: id }).session(session),
      ];

      // 4) Delete notifications tied to drink or its comments
      const deleteNotifsOp = Notification.deleteMany({
        $or: [{ entity: id }, { comment: { $in: commentIds } }],
      }).session(session);

      // 5) Delete all comments for this drink (simplest fully-cascading choice)
      const deleteCommentsOp = Comment.deleteMany({ drink: id }).session(
        session
      );

      await Promise.all([...pullOps, deleteNotifsOp, deleteCommentsOp]);

      // 6) Delete the drink
      await Drink.deleteOne({ _id: id }).session(session);

      // (Optional) If you keep activity logs, you could also remove those here with { session }
      // await ActivityLog.deleteMany({ 'target.model': 'Drink', 'target.id': id }).session(session);

      // 7) Commit DB changes
      await session.commitTransaction();
      session.endSession();

      // 8) OUTSIDE the transaction: delete Cloudinary assets
      // Do NOT delete defaults
      const destroyPromises = [];
      if (photoPublicId && !photoPublicId.startsWith("default/")) {
        destroyPromises.push(
          cloudinary.uploader.destroy(photoPublicId).catch((err) => {
            console.warn("Cloudinary photo destroy failed:", err?.message);
          })
        );
      }
      if (videoPublicId && !videoPublicId.startsWith("default/")) {
        destroyPromises.push(
          cloudinary.uploader.destroy(videoPublicId).catch((err) => {
            console.warn("Cloudinary video destroy failed:", err?.message);
          })
        );
      }
      await Promise.all(destroyPromises);

      // 9) Log activity AFTER commit (so we don’t log a deletion that rolled back)
      await req
        .logActivity({
          action: "delete",
          target: { model: "Drink", id, name: drinkName },
          actor: {
            type: "User",
            id: req.user.id,
            label: {
              fullName: req.user.fullName,
              email: req.user.email,
              role: req.user.role,
            },
          },
          summary: `Deleted drink "${drinkName}"`,
          meta: {
            removedAssets: { photoPublicId, videoPublicId },
            commentIdsDeleted: commentIds.length,
            cascades: [
              "Pulled from user likes/bookmarks/created",
              "Deleted drink comments",
              "Deleted notifications tied to drink/comments",
              // "Deleted related activity logs" // if you add that
            ],
          },
        })
        .catch((err) =>
          console.warn("[activity] deleteDrink failed:", err?.message)
        );

      return res.status(200).json({
        success: true,
        message: `Drink ${drinkName} deleted successfully.`,
      });
    } catch (err) {
      try {
        await session.abortTransaction();
      } catch {}
      session.endSession();
      console.error("deleteDrink failed:", err);
      return res.status(500).json({ success: false, message: err.message });
    }
  },
};

export default drinkCtrl;
