import {
  LiquorModel as Liquor,
  DrinkModel as Drink,
  UserModel as User,
} from "../../models/index.js";
import XLSX from "xlsx";
import {
  formatSlug,
  cloudinary,
  makeBulkActivityLogger,
  diffFields,
  renameUserAllergies,
} from "../../utils/index.js";

const liquorCtrl = {
  bulkLiquorHandler: async (req, res) => {
    try {
      const { type } = req.query; // 'add', 'edit', or 'delete'
      const file = req.file; // should be an Excel file (.xlsx)

      const userId = req.user?.id || req.user?._id;

      const reqUser = await User.findById(userId);

      if (!reqUser) {
        return res.status(400).json({
          success: false,
          message: "Authorized user not found.",
        });
      }

      const { logRow, logBatch } = makeBulkActivityLogger({
        req,
        reqUser,
        type,
        entityModel: "Liquor",
      });

      if (!file)
        return res
          .status(400)
          .json({ success: false, message: "No file uploaded." });

      if (!reqUser) {
        return res.status(400).json({
          success: false,
          message: "Authorized user not found.",
        });
      }

      const validMimeTypes = [
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "application/vnd.ms-excel",
        "application/vnd.ms-excel.sheet.macroEnabled.12",
        "application/vnd.ms-excel.sheet.binary.macroEnabled.12",
        "application/vnd.smartsheet", // SmartSheet format
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
      const rows = XLSX.utils.sheet_to_json(sheet, { defval: "", raw: false }); // trim the Excel file and remove extra empty rows or columns

      // 🚨 Check if there’s any real data
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
        "Brands",
        "Status",
      ];
      const headers = Object.keys(rows[0] || {});
      const extraHeaders = headers.filter((h) => !validHeaders.includes(h));

      if (extraHeaders.length > 0)
        return res.status(400).json({
          success: false,
          message: `Invalid headers: ${extraHeaders.join(", ")}`,
        });

      const errors = [];
      const successCount = { add: 0, edit: 0, delete: 0 };
      const blankNames = [],
        blankDescriptions = [],
        takenNames = [];

      for (let i = 0; i < rows.length; i++) {
        const rowNum = i + 2; // Excel row index (1-based + header)
        const row = rows[i];
        const name = row.Name?.trim();
        const newName = row["New Name"]?.trim();
        const description = row.Description?.trim();
        const brands =
          typeof row.Brands === "string" && row.Brands.trim()
            ? row.Brands.split(",")
                .map((b) => b.trim())
                .filter(Boolean)
            : [];
        const status = row.Status?.trim();

        if (type === "add") {
          if (!name) {
            errors.push(`Row ${rowNum} is invalid: Name is blank.`);
            blankNames.push(rowNum);
            continue;
          }
          if (!description) {
            errors.push(`Row ${rowNum} is invalid: Description is blank.`);
            blankDescriptions.push(rowNum);
            continue;
          }
          const exists = await Liquor.findOne({ name: name });
          if (exists) {
            errors.push(`Row ${rowNum} is invalid: Name is already taken.`);
            takenNames.push(rowNum);
            continue;
          }

          const created = await Liquor.create({
            name,
            slug: formatSlug(name),
            description,
            brands,
          });

          await logRow({
            targetId: created._id.toString(),
            rowNum,
            label: created.name,
            extraMeta: { brands: created.brands, status: created.status },
          });

          successCount.add++;
        } else if (type === "edit") {
          if (!name) {
            errors.push(`Row ${rowNum} is invalid: Name is blank.`);
            blankNames.push(rowNum);
            continue;
          }
          if (!description) {
            errors.push(`Row ${rowNum} is invalid: Description is blank.`);
            blankDescriptions.push(rowNum);
            continue;
          }

          const liquor = await Liquor.findOne({ name: name });

          if (!liquor) {
            errors.push(`Row ${rowNum} is invalid: Name not found.`);
            continue;
          }

          const before = liquor.toObject();

          if (newName && newName !== name) {
            const newNameExist = await Liquor.findOne({ name: newName });
            if (newNameExist) {
              errors.push(`Row ${rowNum}: New name already exists.`);
              continue;
            }

            await liquorCtrl.updateReferencesForLiquorName(name, newName); // 🔄 cascade update

            liquor.name = newName;
            liquor.slug = formatSlug(newName);
          }
          liquor.description = description;
          if (row.Brands) liquor.brands = brands;
          if (row.Status) liquor.status = status;
          await liquor.save();

          const after = liquor.toObject();
          await logRow({
            targetId: liquor._id.toString(),
            rowNum,
            label: `${before.name} → ${after.name}`,
            changes: diffFields(before, after, [
              "name",
              "slug",
              "description",
              "brands",
              "status",
            ]),
          });

          successCount.edit++;
        } else if (type === "delete") {
          if (!name) {
            errors.push(`Row ${rowNum} is invalid: Name is blank.`);
            blankNames.push(rowNum);
            continue;
          }

          const liquor = await Liquor.findOne({ name });

          if (!liquor) {
            errors.push(
              `Row ${rowNum} is invalid: There is no liquor with that name.`
            );
            continue;
          }
          await Liquor.deleteOne({ _id: liquor._id });

          await logRow({
            targetId: liquor._id.toString(),
            rowNum,
            label: liquor.name,
            extraMeta: {
              previousBrands: liquor.brands,
              previousStatus: liquor.status,
            },
          });
          successCount.delete++;
        }
      }

      const suggestions = [];
      if (blankNames.length === rows.length) {
        suggestions.push(`All of the names are blank.`);
      } else if (blankNames.length > rows.length / 2)
        suggestions.push(
          `You might want to take a look at the names because most of them are blank as shown in rows {${blankNames.join(
            ", "
          )}}.`
        );

      if (blankDescriptions.length === rows.length) {
        suggestions.push(`All of the descriptions are blank.`);
      } else if (blankDescriptions.length > rows.length / 2)
        suggestions.push(
          `You might want to take a look at the descriptions because most of them are blank as shown in rows {${blankDescriptions.join(
            ", "
          )}}.`
        );

      if (takenNames.length === rows.length) {
        suggestions.push(
          `All of the names listed in the Excel sheet have already been added to our system.`
        );
      } else if (takenNames.length > rows.length / 2)
        suggestions.push(
          `You might want to take a look at the names because most of them are already added as shown in rows {${takenNames.join(
            ", "
          )}}.`
        );

      const message =
        errors.length === 0
          ? `Successfully ${type}ed ${successCount[type]} liquors!`
          : `${successCount[type]} liquors successfully ${type}ed.
            ${
              suggestions.length > 0
                ? `<br><br>${suggestions.join("<br>")}`
                : ""
            }<br>- ${errors.join("<br>- ")}`;

      await logBatch({
        counts: successCount,
        errorsCount: errors.length,
        suggestions,
        meta: {
          fileName: req.file?.originalname,
          mimetype: req.file?.mimetype,
        },
      });

      res.status(200).json({
        success: true,
        message,
        successPresent: successCount[type] > 0,
        errorsPresent: errors.length > 0,
      });
    } catch (error) {
      console.error("Bulk liquor upload failed:", error);
      res
        .status(500)
        .json({ success: false, message: "Failed to process bulk upload." });
    }
  },

  //CREATE
  createLiquor: async (req, res) => {
    try {
      const { name, description, brands } = req.body;

      if (!name || !description) {
        return res.status(400).json({
          success: false,
          message: "Name and description cannot be empty.",
        });
      }

      // Check if name is already in use for other liquors
      const existingLiquor = await Liquor.findOne({ name });
      if (existingLiquor) {
        return res.status(400).json({
          success: false,
          message: "There is already liquor with that name.",
        });
      }

      let liquor = new Liquor({
        name,
        slug: formatSlug(name),
        description,
        brands,
      });

      liquor.save();

      await req
        .logActivity({
          action: "create",
          target: { model: "Liquor", id: liquor._id, name: liquor.name },
          actor: {
            type: "User",
            id: req.user.id,
            label: {
              fullName: req.user.fullName,
              email: req.user.email,
              role: req.user.role,
            },
          },
          summary: `Created liquor "${liquor.name}"`,
          nextSnapshot: {
            name: liquor.name,
            description: liquor.description,
            brands: liquor.brands,
            slug: liquor.slug,
          },
        })
        .catch((err) =>
          console.warn("[activity] createLiquor failed:", err?.message)
        );

      if (!liquor) return res.status(404).send(`The liquor cannot be created!`);

      return res
        .status(200)
        .json({ success: true, message: "Liquor has been created." });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  },
  updateLiquorPhoto: async (req, res) => {
    try {
      const { id } = req.params;

      if (!req.file || !req.file.path) {
        return res
          .status(400)
          .json({ success: false, message: "No image uploaded." });
      }

      // Find liquor
      const liquor = await Liquor.findById(id);
      if (!liquor) {
        return res
          .status(404)
          .json({ success: false, message: "Liquor not found." });
      }

      // Delete previous photo from Cloudinary if it exists
      if (
        liquor?.photoPublicId &&
        !liquor?.photoPublicId.startsWith("default/")
      ) {
        await cloudinary.uploader.destroy(liquor.photoPublicId);
      }

      // Upload new photo (no folder)
      const result = await cloudinary.uploader.upload(req.file.path, {
        public_id: liquor.photoPublicId,
        resource_type: "image",
      });

      // Save new photo URL and public ID
      liquor.photo = result.secure_url; // ✅ Cloudinary image URL
      liquor.photoPublicId = result.public_id; // Optional cleanup
      await liquor.save();

      return res.status(200).json({
        success: true,
        message: "Liquor photo updated.",
        data: { photo: result.secure_url, photoPublicId: result.public_id },
      });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  },

  // VIEW
  viewAllLiquors: async (req, res) => {
    try {
      const liquors = await Liquor.find().lean();
      if (!liquors) {
        return res
          .status(404)
          .json({ success: false, message: "Liquors not found." });
      }
      return res.status(200).json({ success: true, data: liquors });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  },
  viewLiquor: async (req, res) => {
    try {
      const { id } = req.params;
      const liquor = await Liquor.findById(id).lean();
      if (!liquor) {
        return res
          .status(404)
          .json({ success: false, message: "Liquor not found." });
      }
      return res.status(200).json({ success: true, data: liquor });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  },

  // UPDATE
  updateLiquor: async (req, res) => {
    try {
      const { id } = req.params;
      const { name, description, ...updateFields } = req.body;

      // Ensure required fields are not empty
      if (!name || !description) {
        return res.status(400).json({
          success: false,
          message: "Name and description cannot be empty.",
        });
      }

      const liquor = await Liquor.findById(id);
      if (!liquor) {
        return res.status(404).json({
          success: false,
          message: "Liquor not found.",
        });
      }

      const prevSnapshot = {
        name: liquor.name,
        description: liquor.description,
        brands: liquor.brands,
        slug: liquor.slug,
      };

      let userAllergyRenameMeta = { added: 0, removed: 0 };

      if (name !== liquor.name) {
        // Check if name is already in use by another liquor
        const existingLiquor = await Liquor.findOne({ name, _id: { $ne: id } });
        if (existingLiquor) {
          return res.status(400).json({
            success: false,
            message: "This name is already in use.",
          });
        }

        // 🔁 Update references
        await liquorCtrl.updateReferencesForLiquorName(liquor.name, name);

        // 🔁 Also update user allergy strings that match the old liquor name
        userAllergyRenameMeta = await renameUserAllergies(liquor.name, name);

        liquor.name = name;
        liquor.slug = formatSlug(name);
      }

      const updatedLiquor = await Liquor.findByIdAndUpdate(
        id,
        {
          name,
          slug: formatSlug(name),
          description,
          ...updateFields,
        },
        { new: true, runValidators: true }
      );

      if (!updatedLiquor)
        return res
          .status(404)
          .json({ success: false, message: "Liquor not found." });

      const nextSnapshot = {
        name: updatedLiquor.name,
        description: updatedLiquor.description,
        brands: updatedLiquor.brands,
        slug: updatedLiquor.slug,
      };

      const changes = [];
      for (const key of Object.keys(prevSnapshot)) {
        if (String(prevSnapshot[key]) !== String(nextSnapshot[key])) {
          changes.push({
            path: key,
            from: prevSnapshot[key],
            to: nextSnapshot[key],
          });
        }
      }

      await req
        .logActivity({
          action: "update",
          target: {
            model: "Liquor",
            id: updatedLiquor._id,
            name: updatedLiquor.name,
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
          summary: `Updated liquor "${updatedLiquor.name}"`,
          changes,
          prevSnapshot,
          nextSnapshot,
        })
        .catch((err) =>
          console.warn("[activity] updateLiquor failed:", err?.message)
        );

      return res.status(200).json({
        success: true,
        message: "Liquor updated successfully.",
        data: updatedLiquor,
      });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  },

  //DELETE
  deleteLiquor: async (req, res) => {
    try {
      const { id } = req.params;
      const liquor = await Liquor.findById(id);

      if (!liquor) {
        return res.status(404).json({
          success: false,
          message: "Liquor not found.",
        });
      }

      // Delete previous photo from Cloudinary if it exists
      if (
        liquor.photoPublicId &&
        !liquor?.photoPublicId.startsWith("default/")
      ) {
        await cloudinary.uploader.destroy(liquor.photoPublicId);
      }

      // Delete liquor
      await Liquor.findByIdAndDelete(id);

      await req
        .logActivity({
          action: "delete",
          target: { model: "Liquor", id: liquor._id, name: liquor.name },
          actor: {
            type: "User",
            id: req.user.id,
            label: {
              fullName: req.user.fullName,
              email: req.user.email,
              role: req.user.role,
            },
          },
          summary: `Deleted liquor "${liquor.name}"`,
          prevSnapshot: {
            name: liquor.name,
            description: liquor.description,
            brands: liquor.brands,
            slug: liquor.slug,
          },
        })
        .catch((err) =>
          console.warn("[activity] deleteLiquor failed:", err?.message)
        );

      return res.status(200).json({
        success: true,
        message: "Liquor deleted successfully.",
      });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  },
  updateReferencesForLiquorName: async (oldName, newName, session = null) => {
    // 🔄 Update Drink Ingredients only
    await Drink.updateMany(
      { "ingredients.name": oldName },
      { $set: { "ingredients.$[elem].name": newName } },
      { arrayFilters: [{ "elem.name": oldName }], session }
    );

    // ✅ Let the shared helper handle user allergy strings
    await renameUserAllergies(oldName, newName, session);
  },
};

export default liquorCtrl;
