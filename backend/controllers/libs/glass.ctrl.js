import XLSX from "xlsx";
import path from "path";
import fs from "fs";

import {
  GlassModel as Glass,
  UserModel as User,
} from "../../models/index.js";
import { cloudinary, diffFields, makeBulkActivityLogger } from "../../utils/index.js";

const glassCtrl = {
  bulkGlassHandler: async (req, res) => {
    try {
      const { type } = req.query; // 'add', 'edit', or 'delete'
      const file = req.file;

      const reqUser = await User.findById(req.user.id);
      const { logRow, logBatch } = makeBulkActivityLogger({
        req,
        reqUser,
        type,
        entityModel: "Glass",
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

      const validHeaders = ["Name", "New Name", "Max Ounces"];
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
      const blankMaxOunces = [];
      const takenNames = [];
      const errorRows = []; // <-- Track rows with errors

      for (let i = 0; i < rows.length; i++) {
        const rowNum = i + 2;
        const row = rows[i];
        const name = row.Name?.trim();
        const newName = row["New Name"]?.trim();
        const rawMaxOunces = row["Max Ounces"]?.trim();

        // Shared validation
        if (
          type !== "delete" &&
          rawMaxOunces &&
          isNaN(parseInt(rawMaxOunces))
        ) {
          errors.push(
            `Row ${rowNum} is invalid: Max Ounces is not a valid integer.`
          );
          errorRows.push({
            Row: rowNum,
            ...row,
            Error: "Max Ounces is not a valid integer",
          });

          continue;
        }

        if (type === "add") {
          if (!name) {
            errors.push(`Row ${rowNum} is invalid: Name is blank.`);
            blankNames.push(rowNum);
            errorRows.push({ Row: rowNum, ...row, Error: "Name is blank" });
            continue;
          }

          const maxOunces = parseInt(rawMaxOunces);
          if (maxOunces <= 0) {
            errors.push(
              `Row ${rowNum} is invalid: Max Ounces must be greater than 0.`
            );
            errorRows.push({
              Row: rowNum,
              ...row,
              Error: "Max Ounces must be greater than 0.",
            });
            continue;
          }

          const exists = await Glass.findOne({ name });
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

          const created = await Glass.create({ name, maxOunces });

          await logRow({
            targetId: created._id.toString(),
            rowNum,
            label: `${created.name}`,
            extraMeta: { maxOunces: created.maxOunces },
          });

          successCount.add++;
        } else if (type === "edit") {
          if (!name) {
            errors.push(`Row ${rowNum} is invalid: Name is blank.`);
            blankNames.push(rowNum);
            errorRows.push({ Row: rowNum, ...row, Error: "Name is blank." });

            continue;
          }

          const glass = await Glass.findOne({ name });
          const before = glass.toObject();

          if (!glass) {
            errors.push(`Row ${rowNum} is invalid: Name not found.`);
            errorRows.push({ Row: rowNum, ...row, Error: "Name not found." });
            continue;
          }

          if (newName && newName !== name) {
            const newNameExist = await Glass.findOne({ name: newName });
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
            glass.name = newName;
          }

          if (rawMaxOunces) {
            const maxOunces = parseInt(rawMaxOunces);
            if (maxOunces <= 0) {
              errors.push(
                `Row ${rowNum} is invalid: Max Ounces must be greater than 0.`
              );
              errorRows.push({
                Row: rowNum,
                ...row,
                Error: "Max Ounces must be greater than 0.",
              });

              continue;
            }
            glass.maxOunces = maxOunces;
          }

          await glass.save();
          const after = glass.toObject();

          await logRow({
            targetId: glass._id.toString(),
            rowNum,
            label: `${before.name} → ${after.name}`,
            changes: diffFields(before, after, ["name", "maxOunces"]),
          });

          successCount.edit++;
        } else if (type === "delete") {
          if (!name) {
            errors.push(`Row ${rowNum} is invalid: Name is blank.`);
            blankNames.push(rowNum);
            errorRows.push({ Row: rowNum, ...row, Error: "Name is blank." });

            continue;
          }

          const glassExist = await Glass.findOne({ name });
          const before = glass.toObject();

          if (!glassExist) {
            errors.push(
              `Row ${rowNum} is invalid: There is no glass with that name.`
            );
            errorRows.push({ Row: rowNum, ...row, Error: "Name is blank." });
            continue;
          }

          await Glass.deleteOne({ name });

          await logRow({
            targetId: before._id.toString(),
            rowNum,
            label: `${before.name}`,
            extraMeta: { previousMaxOunces: before.maxOunces },
          });

          successCount.delete++;
        }
      }

      const suggestions = [];

      if (blankNames.length === rows.length) {
        suggestions.push(`All of the names are blank.`);
      } else if (blankNames.length > rows.length / 2) {
        suggestions.push(
          `You might want to take a look at the names because most of them are blank as shown in rows {${blankNames.join(
            ", "
          )}}.`
        );
      }

      if (takenNames.length === rows.length) {
        suggestions.push(
          `All of the names listed in the Excel sheet have already been added to our system.`
        );
      } else if (takenNames.length > rows.length / 2) {
        suggestions.push(
          `You might want to take a look at the names because most of them are already added as shown in rows {${takenNames.join(
            ", "
          )}}.`
        );
      }

      const message =
        errors.length === 0
          ? `Successfully ${type === "delete" ? "delet" : type}ed ${successCount[type]} glasses!`
          : `${successCount[type]} glasses successfully ${type}ed.
          ${
            suggestions.length > 0 ? `<br><br>${suggestions.join("<br>")}` : ""
          }<br>- ${errors.join("<br>- ")}`;

      // await req
      //   .logActivity({
      //     actor: {
      //       type: "User",
      //       id: req.user.id,
      //       label: {
      //         fullName: req.user.fullName,
      //         email: req.user.email,
      //         role: req.user.role,
      //       },
      //     },
      //     action:
      //       type === "delete"
      //         ? "delete"
      //         : type === "edit"
      //           ? "update"
      //           : "create",
      //     target: { model: "Glass", id: null },
      //     summary: `Bulk ${type} glasses via upload`,
      //     meta: {
      //       counts: successCount,
      //       errorsCount: errors.length,
      //       suggestions,
      //       fileName: req.file?.originalname,
      //       mimetype: req.file?.mimetype,
      //       errorRows, // tracked earlier
      //     },
      //   })
      //   .catch((err) =>
      //     console.warn("[activity] bulkGlassHandler failed:", err?.message)
      //   );
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

      res.status(200).json({
        success: true,
        message,
        successPresent: successCount > 0,
        errorsPresent: errors.length > 0,
      });
    } catch (error) {
      console.error("Bulk glass upload failed:", error);
      res
        .status(500)
        .json({ success: false, message: "Failed to process bulk upload." });
    }
  },

  createGlass: async (req, res) => {
    try {
      const { name, maxOunces } = req.body;

      if (!name || !maxOunces) {
        return res.status(400).json({
          success: false,
          message: "Please fill in all required fields for the glass.",
        });
      }

      if (isNaN(maxOunces) || maxOunces <= 0) {
        return res.status(400).json({
          success: false,
          message:
            "Please make sure max ounces is a number and it's greater than 0.",
        });
      }

      // Check if glass already exists
      const existingGlass = await Glass.findOne({ name });
      if (existingGlass) {
        return res.status(400).json({
          success: false,
          message: `There is already a glass with the name ${existingGlass.name}.`,
        });
      }

      let glass = new Glass({
        name,
        maxOunces,
      });

      glass.save();

      await req
        .logActivity({
          actor: {
            type: "User",
            id: req.user.id,
            label: {
              fullName: req.user.fullName,
              email: req.user.email,
              role: req.user.role,
            },
          },
          action: "create",
          target: { model: "Glass", id: glass._id, name: glass.name },
          summary: `Created glass "${glass.name}"`,
          nextSnapshot: {
            name: glass.name,
            maxOunces: glass.maxOunces,
          },
        })
        .catch((err) =>
          console.warn("[activity] createGlass failed:", err?.message)
        );

      if (!glass) return res.status(404).send(`The glass cannot be created!`);

      return res.status(200).json({
        success: true,
        message: `Glass ${glass.name} has been created.`,
      });
    } catch (error) {
      return res.status(500).json({ success: false, message: err.message });
    }
  },

  // VIEW
  viewAllGlasses: async (req, res) => {
    try {
      const glasses = await Glass.find().sort({ name: 1 }).lean();
      if (!glasses) {
        return res
          .status(404)
          .json({ success: false, message: "Glasses are not found." });
      }
      return res.status(200).json({ success: true, data: glasses });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  },

  viewGlass: async (req, res) => {
    try {
      const { id } = req.params;
      const glass = await Glass.findById(id);

      if (!glass) {
        return res
          .status(404)
          .json({ success: false, message: "Glass not found." });
      }
      return res.status(200).json({ success: true, data: glass });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  },

  // UPDATE
  updateGlass: async (req, res) => {
    try {
      const { id } = req.params;
      const { name, maxOunces, ...updateFields } = req.body;

      // Ensure required fields are not empty
      if (!name || !maxOunces) {
        return res.status(400).json({
          success: false,
          message: "Name and max ounces cannot be empty.",
        });
      }

      if (isNaN(maxOunces) || maxOunces <= 0) {
        return res.status(400).json({
          success: false,
          message:
            "Please make sure max ounces is a number and it's greater than 0.",
        });
      }

      // Check if name is already in use by another glass
      const existingGlass = await Glass.findOne({ name, _id: { $ne: id } });
      if (existingGlass) {
        return res.status(400).json({
          success: false,
          message: `Glass name already exists.`,
        });
      }

      const glass = await Glass.findById(id);
      if (!glass) {
        return res.status(404).json({
          success: false,
          message: "Glass not found.",
        });
      }

      const prevSnapshot = {
        name: glass.name,
        maxOunces: glass.maxOunces,
      };

      const updatedGlass = await Glass.findByIdAndUpdate(
        id,
        {
          name,
          maxOunces,
          ...updateFields,
        },
        { new: true, runValidators: true }
      );

      if (!updatedGlass)
        return res.status(404).json({
          success: false,
          message: "Glass not found and cannot be updated.",
        });

      const nextSnapshot = {
        name: updatedGlass.name,
        maxOunces: updatedGlass.maxOunces,
      };

      const changes = [];
      for (const k of Object.keys(prevSnapshot)) {
        if (String(prevSnapshot[k]) !== String(nextSnapshot[k])) {
          changes.push({ path: k, from: prevSnapshot[k], to: nextSnapshot[k] });
        }
      }

      updatedGlass.save();

      await req
        .logActivity({
          actor: {
            type: "User",
            id: req.user.id,
            label: {
              fullName: req.user.fullName,
              email: req.user.email,
              role: req.user.role,
            },
          },
          action: "update",
          target: {
            model: "Glass",
            id: updatedGlass._id,
            name: updatedGlass.name,
          },
          summary: `Updated glass "${updatedGlass.name}"`,
          changes,
          prevSnapshot,
          nextSnapshot,
        })
        .catch((err) =>
          console.warn("[activity] updateGlass failed:", err?.message)
        );

      return res.status(200).json({
        success: true,
        message: `Glass ${updatedGlass.name} updated successfully.`,
        data: updatedGlass,
      });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  },

  // DELETE
  deleteGlass: async (req, res) => {
    try {
      const { id } = req.params;
      const glass = await Glass.findById(id);

      if (!glass) {
        return res.status(404).json({
          success: false,
          message: "Glass was not found.",
        });
      }

      // Delete previous photo from Cloudinary if it exists
      if (
        glass?.photoPublicId &&
        !glass?.photoPublicId.startsWith("default/")
      ) {
        await cloudinary.uploader.destroy(glass?.photoPublicId);
      }

      // Delete customer
      await Glass.findByIdAndDelete(id);

      await req
        .logActivity({
          actor: {
            type: "User",
            id: req.user.id,
            label: {
              fullName: req.user.fullName,
              email: req.user.email,
              role: req.user.role,
            },
          },
          action: "delete",
          target: { model: "Glass", id: glass._id, name: glass.name },
          summary: `Deleted glass "${glass.name}"`,
          meta: {
            removedAssets: {
              photoPublicId: glass?.photoPublicId || null,
            },
          },
        })
        .catch((err) =>
          console.warn("[activity] deleteGlass failed:", err?.message)
        );

      return res.status(200).json({
        success: true,
        message: `Glass ${glass.name} deleted successfully.`,
      });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  },
};

export default glassCtrl;
