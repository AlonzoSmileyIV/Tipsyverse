import XLSX from "xlsx";

import {
  MixerModel as Mixer,
  DrinkModel as Drink,
  UserModel as User,
} from "../../models/index.js";

import { cloudinary, diffFields, makeBulkActivityLogger } from "../../utils/index.js";

async function renameUserAllergies(oldName, newName, session = null) {
  if (!oldName || !newName || oldName === newName) return { added: 0, removed: 0 };

  // 1) Add newName where oldName exists (no duplicates thanks to $addToSet)
  const addRes = await User.updateMany(
    { "preferences.allergies": oldName },
    { $addToSet: { "preferences.allergies": newName } },
    { session }
  );

  // 2) Remove oldName
  const pullRes = await User.updateMany(
    { "preferences.allergies": oldName },
    { $pull: { "preferences.allergies": oldName } },
    { session }
  );

  return {
    added: addRes.modifiedCount || addRes.nModified || 0,
    removed: pullRes.modifiedCount || pullRes.nModified || 0,
  };
}

const mixerCtrl = {
  bulkMixerHandler: async (req, res) => {
    try {
      const { type } = req.query; // 'add', 'edit', or 'delete'
      const file = req.file; // should be an Excel file (.xlsx)

      const reqUser = await User.findById(req.user.id);
      const { logRow, logBatch } = makeBulkActivityLogger({
        req,
        reqUser,
        type,
        entityModel: "Mixer",
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
        "Contains Alcohol",
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
        const validAlcoholicInputs = ["true", "t", "yes", "y"];
        const isAlcoholic = validAlcoholicInputs.includes(
          row["Contains Alcohol"]?.trim().toLowerCase()
        );
        // const brands =
        //   row.Brands?.split(",")
        //     .map((b) => b.trim())
        //     .filter(Boolean) || [];
        const brands =
          typeof row.Brands === "string" && row.Brands.trim()
            ? row.Brands.split(",")
              .map((b) => b.trim())
              .filter(Boolean)
            : [];

        if (type === "add") {
          if (!name) {
            errors.push(`Row ${rowNum} is invalid: Name is blank.`);
            blankNames.push(rowNum);
            continue;
          }
          const exists = await Mixer.findOne({ name });
          if (exists) {
            errors.push(`Row ${rowNum} is invalid: Name is already taken.`);
            takenNames.push(rowNum);
            continue;
          }

          const created = await Mixer.create({ name, description, brands, isAlcoholic });

          await logRow({
            targetId: created._id.toString(),
            rowNum,
            label: created.name,
            extraMeta: { isAlcoholic: created.isAlcoholic, brands: created.brands },
          });

          successCount.add++;
        } else if (type === "edit") {
          if (!name) {
            errors.push(`Row ${rowNum} is invalid: Name is blank.`);
            blankNames.push(rowNum);
            continue;
          }
          const mixer = await Mixer.findOne({ name });
          const before = mixer.toObject();

          if (!mixer) {
            errors.push(`Row ${rowNum} is invalid: Name not found.`);
            continue;
          }
          if (newName && newName !== name) {
            const newNameExist = await Mixer.findOne({ name: newName });
            if (newNameExist) {
              errors.push(`Row ${rowNum}: New name already exists.`);
              continue;
            }

            await mixerCtrl.updateReferencesForMixerName(name, newName); // 🔄 cascade update

            mixer.name = newName;
            mixer.slug = formatSlug(newName);
          }
          mixer.description = description;
          if (row.Brands) mixer.brands = brands;
          await mixer.save();
          const after = mixer.toObject();
          await logRow({
            targetId: mixer._id.toString(),
            rowNum,
            label: `${before.name} → ${after.name}`,
            changes: diffFields(before, after, ["name", "slug", "description", "brands", "isAlcoholic"]),
          });
          successCount.edit++;
        } else if (type === "delete") {


          if (!name) {
            errors.push(`Row ${rowNum} is invalid: Name is blank.`);
            blankNames.push(rowNum);
            continue;
          }

          const mixer = await Mixer.findOne({ name });

          if (!mixer) {
            errors.push(
              `Row ${rowNum} is invalid: There is no mixer with that name.`
            );
            continue;
          }
          await Mixer.deleteOne({ _id: mixer._id });

          await logRow({
            targetId: before._id.toString(),
            rowNum,
            label: before.name,
            extraMeta: { previousBrands: before.brands, previousIsAlcoholic: before.isAlcoholic },
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
          ? `Successfully ${type}ed ${successCount[type]} mixers!`
          : `${successCount[type]} mixers successfully ${type}ed.
            ${suggestions.length > 0
            ? `<br><br>${suggestions.join("<br>")}`
            : ""
          }<br>- ${errors.join("<br>- ")}`;

     await logBatch({
      counts: successCount,
      errorsCount: errors.length,
      suggestions,
      meta: { fileName: req.file?.originalname, mimetype: req.file?.mimetype },
    });

      res
        .status(200)
        .json({ success: true, message, successPresent: successCount > 0, errorsPresent: errors.length > 0 });
    } catch (error) {
      console.error("Bulk mixer upload failed:", error);
      res
        .status(500)
        .json({ success: false, message: "Failed to process bulk upload." });
    }
  },
  // CREATE
  createMixer: async (req, res) => {
    try {
      const { name, description, isAlcoholic, brands } = req.body;

      //Name cannot be empty
      if (!name) {
        return res.status(400).json({
          success: false,
          message: "Name cannot be empty.",
        });
      }

      // Check if name is already in use for other mixer
      const existingMixer = await Mixer.findOne({ name });
      if (existingMixer) {
        return res.status(400).json({
          success: false,
          message: "There is already a mixer with that name.",
        });
      }

      let mixer = new Mixer({
        name,
        description,
        isAlcoholic,
        brands,
      });

      mixer.save();

      await req
        .logActivity({
          action: "create",
          target: { model: "Mixer", id: mixer._id, name: mixer.name },
          actor: {
            type: "User",
            id: req.user.id,
            label: {
              fullName: req.user.fullName,
              email: req.user.email,
              role: req.user.role,
            },
          },
          summary: `Created mixer "${mixer.name}"`,
          nextSnapshot: {
            name: mixer.name,
            description: mixer.description,
            isAlcoholic: !!mixer.isAlcoholic,
            brands: mixer.brands || [],
          },
        })
        .catch((err) =>
          console.warn("[activity] createMixer log failed:", err?.message)
        );

      if (!mixer) return res.status(404).send(`The mixer cannot be created!`);

      return res
        .status(200)
        .json({ success: true, message: "Mixer has been created." });
    } catch (error) {
      return res.status(500).json({ success: false, message: error.message });
      //return res.status(400).json({ success: false, message: error.message });
    }
  },

  addMixerPhoto: async (req, res) => {
    try {
      const { id } = req.params;

      if (!req.file || !req.file.path) {
        return res
          .status(400)
          .json({ success: false, message: "No image uploaded." });
      }

      // Find mixer
      const mixer = await Mixer.findById(id);
      if (!mixer) {
        return res
          .status(404)
          .json({ success: false, message: "Mixer not found." });
      }

      // Delete previous photo from Cloudinary if it exists
      if (
        mixer?.photoPublicId &&
        !mixer?.photoPublicId.startsWith("default/")
      ) {
        await cloudinary.uploader.destroy(mixer.photoPublicId);
      }

      // Upload new photo (no folder)
      const result = await cloudinary.uploader.upload(req.file.path, {
        public_id: mixer.photoPublicId,
        resource_type: "image",
      });

      // Save new photo URL and public ID
      mixer.photo = result.secure_url; // ✅ Cloudinary image URL
      mixer.photoPublicId = result.public_id; // Optional cleanup
      await mixer.save();

      return res.status(200).json({
        success: true,
        message: "Mixer photo updated.",
        data: { photo: result.secure_url, photoPublicId: result.public_id },
      });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  },

  // VIEW
  viewAllMixers: async (req, res) => {
    try {
      const mixers = await Mixer.find().sort({ name: 1 }).lean();
      if (!mixers) {
        return res
          .status(404)
          .json({ success: false, message: "Mixers not found." });
      }
      return res.status(200).json({ success: true, data: mixers });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  },
  viewMixer: async (req, res) => {
    try {
      const { id } = req.params;
      const mixer = await Mixer.findById(id).lean();
      if (!mixer) {
        return res
          .status(404)
          .json({ success: false, message: "Mixer not found." });
      }
      return res.status(200).json({ success: true, data: mixer });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  },

  // UPDATE
  updateMixer: async (req, res) => {
    try {
      const { id } = req.params;
      const { name, ...updateFields } = req.body;

      // Ensure required fields are not empty
      if (!name) {
        return res.status(400).json({
          success: false,
          message: "Mixer's name cannot be empty.",
        });
      }

      const mixer = await Mixer.findById(id);
      if (!mixer) {
        return res.status(404).json({
          success: false,
          message: "Mixer not found.",
        });
      }

      // Check if name is already used by a different mixer
      if (name !== mixer.name) {
        const nameExists = await Mixer.findOne({ name, _id: { $ne: id } });
        if (nameExists) {
          return res.status(400).json({
            success: false,
            message: "There is already a mixer with that name.",
          });
        }

        // 🔄 Cascade update if name has changed
        await mixerCtrl.updateReferencesForMixerName(mixer.name, name);
        mixer.name = name;
      }

      // Update other fields
      Object.entries(updateFields).forEach(([key, value]) => {
        mixer[key] = value;
      });

      const updatedMixer = await Mixer.findByIdAndUpdate(
        id,
        {
          name,
          ...updateFields,
        },
        { new: true, runValidators: true }
      );

      if (!updatedMixer)
        return res
          .status(404)
          .json({ success: false, message: "Mixer not found." });

      const prevSnapshot = {
        name: mixer.name,
        description: mixer.description,
        isAlcoholic: !!mixer.isAlcoholic,
        brands: mixer.brands || [],
      };

      const nextSnapshot = {
        name: updatedMixer.name,
        description: updatedMixer.description,
        isAlcoholic: !!updatedMixer.isAlcoholic,
        brands: updatedMixer.brands || [],
      };

      const changes = [];
      for (const k of Object.keys(prevSnapshot)) {
        const before = JSON.stringify(prevSnapshot[k]);
        const after = JSON.stringify(nextSnapshot[k]);
        if (before !== after)
          changes.push({ path: k, from: prevSnapshot[k], to: nextSnapshot[k] });
      }

      await req
        .logActivity({
          action: "update",
          target: {
            model: "Mixer",
            id: updatedMixer._id,
            name: updatedMixer.name,
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
          summary: `Updated mixer "${updatedMixer.name}"`,
          changes,
          prevSnapshot,
          nextSnapshot,
        })
        .catch((err) =>
          console.warn("[activity] updateMixer log failed:", err?.message)
        );

      return res.status(200).json({
        success: true,
        message: "Mixer updated successfully.",
        data: updatedMixer,
      });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  },

  // DELETE
  deleteMixer: async (req, res) => {
    try {
      const { id } = req.params;
      const mixer = await Mixer.findById(id);

      if (!mixer) {
        return res.status(404).json({
          success: false,
          message: "mixer not found.",
        });
      }

      // Delete previous photo from Cloudinary if it exists
      if (mixer.photoPublicId && !mixer.photoPublicId.startsWith("/default")) {
        await cloudinary.uploader.destroy(mixer.photoPublicId);
      }

      // Delete mixer
      await Mixer.findByIdAndDelete(id);

      await req
        .logActivity({
          action: "delete",
          target: { model: "Mixer", id: mixer._id, name: mixer.name },
          actor: {
            type: "User",
            id: req.user.id,
            label: {
              fullName: req.user.fullName,
              email: req.user.email,
              role: req.user.role,
            },
          },
          summary: `Deleted mixer "${mixer.name}"`,
          prevSnapshot: {
            name: mixer.name,
            description: mixer.description,
            isAlcoholic: !!mixer.isAlcoholic,
            brands: mixer.brands || [],
          },
        })
        .catch((err) =>
          console.warn("[activity] deleteMixer log failed:", err?.message)
        );

      return res.status(200).json({
        success: true,
        message: "Mixer deleted successfully.",
      });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  },

  updateReferencesForMixerName: async (oldName, newName) => {
    // 🔄 Update Drink Ingredients
    await Drink.updateMany(
      { "ingredients.name": oldName },
      {
        $set: {
          "ingredients.$[elem].name": newName,
        },
      },
      {
        arrayFilters: [{ "elem.name": oldName }],
      }
    );

    // 🔄 Update User Allergies in preferences
    const usersToUpdate = await User.find({ "preferences.allergies": oldName });
    for (const user of usersToUpdate) {
      user.preferences.allergies = user.preferences.allergies.map((allergy) =>
        allergy === oldName ? newName : allergy
      );
      await user.save();
    }
  },
};

export default mixerCtrl;
