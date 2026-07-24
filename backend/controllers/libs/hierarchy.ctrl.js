import {
  HierarchyModel as Hierarchy,
  PositionModel as Position,
  UserModel as User,
} from "../../models/index.js";
import XLSX from "xlsx";
import { diffFields, makeBulkActivityLogger } from "../../utils/index.js";

const generateIncrementalId = async () => {
  const lastHierarchy = await Hierarchy.find().limit(1).sort({ rank: -1 });
  const nextNumber = lastHierarchy.length ? lastHierarchy[0].rank + 1 : 1;
  const reportingHierarchyId =
    nextNumber === 1
      ? null
      : `level-${String(nextNumber - 1).padStart(4, "0")}`;
  return { defaultRank: nextNumber, defaultReporting: reportingHierarchyId };
};

const hierarchyCtrl = {
  bulkHierarchyHandler: async (req, res) => {
    try {
      const { type } = req.query; // 'add', 'edit', or 'delete'
      const file = req.file;

      const reqUser = await User.findById(req.user.id);
      const { logRow, logBatch } = makeBulkActivityLogger({
        req,
        reqUser,
        type,
        entityModel: "Hierarchy",
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

      const validHeaders = ["Name", "New Name", "Description"];
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

      for (let i = 0; i < rows.length; i++) {
        const rowNum = i + 2;
        const row = rows[i];
        const name = row.Name?.trim();
        const newName = row["New Name"]?.trim();
        const description = row["Description"]?.trim();

        // 🚫 Block modification of "Owner"
        const isOwner = name === "Owner";
        const ownerExists = await Hierarchy.findOne({ name: "Owner" });
        if (isOwner) {
          if (type === "add" && ownerExists) {
            errors.push(
              `Row ${rowNum} is invalid: Hierarchy "Owner" already exists and cannot be added again.`
            );
            errorRows.push({
              Row: rowNum,
              ...row,
              Error: `Hierarchy "Owner" already exists and cannot be added again.`,
            });
            continue;
          }

          if ((type === "edit" || type === "delete") && ownerExists) {
            errors.push(
              `Row ${rowNum} is invalid: Hierarchy "Owner" cannot be modified or deleted.`
            );
            errorRows.push({
              Row: rowNum,
              ...row,
              Error: `Hierarchy "Owner" cannot be modified or deleted.`,
            });
            continue;
          }
        }

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

          const exists = await Hierarchy.findOne({ name });
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

          const created = await Hierarchy.create({ name, description });

          await logRow({
            targetId: created._id.toString(),
            rowNum,
            label: created.name,
            extraMeta: { description: created.description },
          });

          successCount.add++;
        } else if (type === "edit") {
          if (!name) {
            errors.push(`Row ${rowNum} is invalid: Name is blank.`);
            blankNames.push(rowNum);
            errorRows.push({ Row: rowNum, ...row, Error: "Name is blank." });

            continue;
          }

          const hierarchy = await Hierarchy.findOne({ name });
          const before = hierarchy.toObject();

          if (!hierarchy) {
            errors.push(`Row ${rowNum} is invalid: Name not found.`);
            errorRows.push({ Row: rowNum, ...row, Error: "Name not found." });
            continue;
          }

          if (newName && newName !== name) {
            const newNameExist = await Hierarchy.findOne({ name: newName });
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
            hierarchy.name = newName;
          }

          if (description && description !== "") {
            hierarchy.description = description;
          }

          await hierarchy.save();
          const after = hierarchy.toObject();

          await logRow({
            targetId: hierarchy._id.toString(),
            rowNum,
            label: `${before.name} → ${after.name}`,
            changes: diffFields(before, after, ["name", "description"]),
          });

          successCount.edit++;
        } else if (type === "delete") {
          if (!name) {
            errors.push(`Row ${rowNum} is invalid: Name is blank.`);
            blankNames.push(rowNum);
            errorRows.push({ Row: rowNum, ...row, Error: "Name is blank." });

            continue;
          }

          const hierarchyExist = await Hierarchy.findOne({ name });
          if (!hierarchyExist) {
            errors.push(
              `Row ${rowNum} is invalid: There is no hierarchy with that name.`
            );
            errorRows.push({ Row: rowNum, ...row, Error: "Name is blank." });
            continue;
          }

          const before = hierarchyExist.toObject();

          await Hierarchy.deleteOne({ _id: hierarchyExist._id });
          // 1️⃣ Find all Positions that reference this hierarchy
          await Position.updateMany(
            { hierarchy: { $in: hierarchyExist.id } }, // Find Positions with this hierarchy
            { $set: { hierarchy: null } } // Set hierarchy to null
          );

          await logRow({
            targetId: before._id.toString(),
            rowNum,
            label: before.name,
            extraMeta: { previousDescription: before.description },
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
          ? `Successfully ${type === "delete" ? "delet" : type}ed ${
              successCount[type]
            } hierarchies!`
          : `${successCount[type]} hierarchies successfully ${
              type === "delete" ? "delet" : type
            }ed.
          ${
            suggestions.length > 0 ? `<br><br>${suggestions.join("<br>")}` : ""
          }<br>- ${errors.join("<br>- ")}`;

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
      console.error("Bulk hierarchy upload failed:", error);
      res
        .status(500)
        .json({ success: false, message: "Failed to process bulk upload." });
    }
  },
  // Create Hierarchy
  createHierarchy: async (req, res) => {
    try {
      const { name, description, rank, reportingTo } = req.body;
      if (!name) {
        return res
          .status(400)
          .json({ success: false, message: "Please fill in hierarchy name." });
      }

      if (!description) {
        return res.status(400).json({
          success: false,
          message: "Please fill in hierarchy description.",
        });
      }

      const existingHierarchy = await Hierarchy.findOne({ name });
      if (existingHierarchy) {
        return res
          .status(400)
          .json({ success: false, message: "Hierarchy level already exists." });
      }

      // Validate `reportingTo` exists if provided
      if (reportingTo) {
        const parentHierarchy = await Hierarchy.findById(reportingTo);
        if (!parentHierarchy) {
          return res
            .status(404)
            .json({ message: "Parent hierarchy not found" });
        }
      }

      const key = name
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, "-");
      const { defaultRank } = await generateIncrementalId();

      const hierarchy = new Hierarchy({
        name: name,
        description: description,
        rank: rank ? rank : null,
        reportingTo: reportingTo ? reportingTo : null,
      });
      await hierarchy.save();

      await req
        .logActivity({
          action: "create",
          target: {
            model: "Hierarchy",
            id: hierarchy._id,
            name: hierarchy.name,
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
          summary: `Created hierarchy "${hierarchy.name}"`,
          nextSnapshot: {
            name: hierarchy.name,
            description: hierarchy.description,
            rank: hierarchy.rank,
            reportingTo: hierarchy.reportingTo,
          },
        })
        .catch((err) =>
          console.warn("[activity] createHierarchy failed:", err?.message)
        );

      return res.status(201).json({
        success: true,
        message: `Hierarchy ${hierarchy.name} created successfully.`,
        data: hierarchy,
      });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  },

  // View
  viewAllHierarchies: async (req, res) => {
    try {
      const hierarchies = await Hierarchy.find().sort({ rank: 1 });
      return res.status(200).json({ success: true, data: hierarchies });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  },

  // View
  viewHierarchy: async (req, res) => {
    try {
      const { id } = req.params;
      const hierarchy = await Hierarchy.findById(id);

      if (!hierarchy) {
        return res
          .status(404)
          .json({ success: false, message: "Hierarchy level not found." });
      }
      return res.status(200).json({ success: true, data: hierarchy });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  },

  // Update Hierarchy Level
  updateHierarchy: async (req, res) => {
    try {
      const { id } = req.params;
      const { name, description, rank, reportingTo } = req.body;

      if (!name) {
        return res
          .status(400)
          .json({ success: false, message: "Hierarchy name cannot be blank." });
      }

      if (!description) {
        return res.status(400).json({
          success: false,
          message: "Hierarchy description cannot blank.",
        });
      }

      // 1️⃣ Find the existing hierarchy level
      const existingHierarchy = await Hierarchy.findById(id);
      if (!existingHierarchy) {
        return res
          .status(404)
          .json({ success: false, message: "Hierarchy level not found." });
      }

      // 2️⃣ Check if the name is changing
      if (existingHierarchy.name.toLowerCase() !== name.toLowerCase()) {
        // 3️⃣ Ensure the new name is not taken
        const nameExists = await Hierarchy.findOne({ name });
        if (nameExists) {
          return res.status(400).json({
            success: false,
            message: `Hierarchy name already exists.`,
          });
        }
      }

      const prevSnapshot = {
        name: existingHierarchy.name,
        description: existingHierarchy.description,
        rank: existingHierarchy.rank,
        reportingTo: existingHierarchy.reportingTo,
      };

      // 4️⃣ Update the hierarchy
      const updatedHierarchy = await Hierarchy.findByIdAndUpdate(
        id,
        { name, description, rank, reportingTo },
        { new: true }
      );
      if (!updatedHierarchy) {
        return res
          .status(404)
          .json({ success: false, message: "Hierarchy level not found." });
      }

      const nextSnapshot = {
        name: updatedHierarchy.name,
        description: updatedHierarchy.description,
        rank: updatedHierarchy.rank,
        reportingTo: updatedHierarchy.reportingTo,
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
            model: "Hierarchy",
            id: updatedHierarchy._id,
            name: updatedHierarchy.name,
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
          summary: `Updated hierarchy "${updatedHierarchy.name}"`,
          changes,
          prevSnapshot,
          nextSnapshot,
        })
        .catch((err) =>
          console.warn("[activity] updateHierarchy failed:", err?.message)
        );

      //await ActivityLog.create({ action: "Updated hierarchy level", details: { id, name, description, key } });

      return res.status(200).json({
        success: true,
        message: `Hierarchy ${updatedHierarchy.name} updated successfully.`,
        data: updatedHierarchy,
      });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  },

  // Delete Hierarchy Level (Supports Single & Bulk Deletion)
  deleteHierarchy: async (req, res) => {
    try {
      const { id } = req.params;
      const ids = Array.isArray(id) ? id : [id];

      // 1️⃣ Find all Positions that reference this hierarchy
      await Position.updateMany(
        { hierarchy: { $in: ids } }, // Find Positions with this hierarchy
        { $set: { hierarchy: null } } // Set hierarchy to null
      );
      const deletedHierarchies = await Hierarchy.deleteMany({
        _id: { $in: ids },
      });

      if (!deletedHierarchies.deletedCount) {
        return res.status(404).json({
          success: false,
          message: "No hierarchy levels found for deletion.",
        });
      }

      await req
        .logActivity({
          action: "delete",
          target: { model: "Hierarchy", id: id },
          actor: {
            type: "User",
            id: req.user.id,
            label: {
              fullName: req.user.fullName,
              email: req.user.email,
              role: req.user.role,
            },
          },
          summary: `Deleted hierarchy levels`,
          meta: {
            deletedIds: ids,
            deletedCount: deletedHierarchies.deletedCount,
          },
        })
        .catch((err) =>
          console.warn("[activity] deleteHierarchy failed:", err?.message)
        );

      // await ActivityLog.create({ action: "Deleted hierarchy levels", details: { ids } });

      return res.status(200).json({
        success: true,
        message: "Hierarchy level(s) deleted successfully.",
      });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  },
};

export default hierarchyCtrl;
