import jwt from "jsonwebtoken";

import {
  DepartmentModel as Department,
  PositionModel as Position,
  UserModel as User,
} from "../../models/index.js";
import XLSX from "xlsx";
import { makeBulkActivityLogger, diffFields } from "../../utils/index.js";

const departmentCtrl = {
  bulkDepartmentHandler: async (req, res) => {
    try {
      const { type } = req.query; // 'add', 'edit', or 'delete'
      const file = req.file;

      const reqUser = await User.findById(req.user.id);
      const { logRow, logBatch } = makeBulkActivityLogger({
        req,
        reqUser,
        type,
        entityModel: "Department",
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
        const ownerExists = await Department.findOne({ name: "Owner" });
        if (isOwner) {
          if (type === "add" && ownerExists) {
            errors.push(
              `Row ${rowNum} is invalid: Department "Owner" already exists and cannot be added again.`
            );
            errorRows.push({
              Row: rowNum,
              ...row,
              Error: `Department "Owner" already exists and cannot be added again.`,
            });
            continue;
          }

          if ((type === "edit" || type === "delete") && ownerExists) {
            errors.push(
              `Row ${rowNum} is invalid: Department "Owner" cannot be modified or deleted.`
            );
            errorRows.push({
              Row: rowNum,
              ...row,
              Error: `Department "Owner" cannot be modified or deleted.`,
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

          const exists = await Department.findOne({ name });
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

          const created = await Department.create({ name, description });

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

          const department = await Department.findOne({ name });
          const before = dept.toObject();

          if (!department) {
            errors.push(`Row ${rowNum} is invalid: Name not found.`);
            errorRows.push({ Row: rowNum, ...row, Error: "Name not found." });
            continue;
          }

          if (newName && newName !== name) {
            const newNameExist = await Department.findOne({ name: newName });
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
            department.name = newName;
          }

          if (description && description !== "") {
            department.description = description;
          }

          await department.save();

          const after = dept.toObject();
          await logRow({
            targetId: dept._id.toString(),
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

          const departmentExist = await Department.findOne({ name });
          if (!departmentExist) {
            errors.push(
              `Row ${rowNum} is invalid: There is no department with that name.`
            );
            errorRows.push({ Row: rowNum, ...row, Error: "Name is blank." });
            continue;
          }

          const before = dept.toObject();

          await Department.deleteOne({ name });
          // 1️⃣ Find all Positions that reference this department
          await Position.updateMany(
            { department: { $in: departmentExist.id } }, // Find Positions with this hierarchy
            { $set: { department: null } } // Set hierarchy to null
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
        errorsPresent: errors.length > 0,
      });
    } catch (error) {
      console.error("Bulk department upload failed:", error);
      res
        .status(500)
        .json({ success: false, message: "Failed to process bulk upload." });
    }
  },
  // -------- REGISTER / CREATE --------
  createDepartment: async (req, res) => {
    try {
      const { name, description } = req.body;
      if (!name) {
        return res
          .status(400)
          .json({ success: false, message: "Please fill in department name." });
      }

      if (!description) {
        return res.status(400).json({
          success: false,
          message: "Please fill in department description.",
        });
      }

      const existingDepartment = await Department.findOne({ name });
      if (existingDepartment) {
        return res
          .status(400)
          .json({ success: false, message: "Department already exists." });
      }

      const department = new Department({
        name: name,
        description: description,
      });
      await department.save();

      await req
        .logActivity({
          action: "create",
          target: {
            model: "Department",
            id: department._id,
            name: department.name,
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
          summary: `Created department "${department.name}"`,
          nextSnapshot: {
            name: department.name,
            description: department.description,
          },
        })
        .catch((err) =>
          console.warn("[activity] createDepartment failed:", err?.message)
        );

      return res.status(201).json({
        success: true,
        message: `Department ${department.name} created successfully.`,
        data: department,
      });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  },

  // -------- READ --------
  viewAllDepartments: async (req, res) => {
    try {
      const departments = await Department.find().sort({ id: 1 });
      return res.status(200).json({ success: true, data: departments });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  },
  viewDepartment: async (req, res) => {
    try {
      const { id } = req.params;
      const department = await Department.findById(id);
      if (!department) {
        return res
          .status(404)
          .json({ success: false, message: "Department level not found." });
      }
      return res.status(200).json({ success: true, data: department });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  },

  // -------- UPDATE --------
  updateDepartment: async (req, res) => {
    try {
      const { id } = req.params;
      const { name, description } = req.body;
      if (!name) {
        return res
          .status(400)
          .json({ success: false, message: "Please fill in department name." });
      }

      if (!description) {
        return res.status(400).json({
          success: false,
          message: "Please fill in department description.",
        });
      }

      // 1️⃣ Find the existing department
      const existingDepartment = await Department.findById(id);
      if (!existingDepartment) {
        return res
          .status(404)
          .json({ success: false, message: "Department not found." });
      }

      // 2️⃣ Check if the name is changing
      if (existingDepartment.name.toLowerCase() !== name.toLowerCase()) {
        // 3️⃣ Ensure the new name is not taken
        const nameExists = await Department.findOne({ name });
        if (nameExists) {
          return res.status(400).json({
            success: false,
            message: `Department already exists.`,
          });
        }
      }

      const updatedDepartment = await Department.findByIdAndUpdate(
        id,
        { name, description },
        { new: true }
      );
      if (!updatedDepartment) {
        return res
          .status(404)
          .json({ success: false, message: "Department not found." });
      }

      const prevSnapshot = {
        name: existingDepartment.name,
        description: existingDepartment.description,
      };
      const nextSnapshot = {
        name: updatedDepartment.name,
        description: updatedDepartment.description,
      };

      const changes = [];
      if (prevSnapshot.name !== nextSnapshot.name) {
        changes.push({
          path: "name",
          from: prevSnapshot.name,
          to: nextSnapshot.name,
        });
      }
      if (prevSnapshot.description !== nextSnapshot.description) {
        changes.push({
          path: "description",
          from: prevSnapshot.description,
          to: nextSnapshot.description,
        });
      }

      await req
        .logActivity({
          action: "update",
          target: {
            model: "Department",
            id: updatedDepartment._id,
            name: updatedDepartment.name,
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
          summary: `Updated department "${updatedDepartment.name}"`,
          changes,
          prevSnapshot,
          nextSnapshot,
        })
        .catch((err) =>
          console.warn("[activity] updateDepartment failed:", err?.message)
        );

      //await ActivityLog.create({ action: "Updated department level", details: { id, name, description, key } });

      return res.status(200).json({
        success: true,
        message: `Department ${updatedDepartment.name} updated successfully.`,
        data: updatedDepartment,
      });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  },

  // -------- DELETE --------
  deleteDepartment: async (req, res) => {
    try {
      const { id } = req.params;
      const ids = Array.isArray(id) ? id : [id];

      // 1️⃣ Find all Positions that reference this department
      await Position.updateMany(
        { department: { $in: ids } }, // Find Positions with this hierarchy
        { $set: { department: null } } // Set hierarchy to null
      );

      const deletedDepartment = await Department.deleteMany({
        _id: { $in: ids },
      });
      if (!deletedDepartment.deletedCount) {
        return res.status(404).json({
          success: false,
          message: "No departments found for deletion.",
        });
      }

      await req
        .logActivity({
          action: "delete",
          target: { model: "Department", id: id },
          actor: {
            type: "User",
            id: req.user.id,
            label: {
              fullName: req.user.fullName,
              email: req.user.email,
              role: req.user.role,
            },
          },
          summary: "Deleted department(s)",
          meta: {
            ids,
            deletedCount: deletedDepartment.deletedCount,
          },
        })
        .catch((err) =>
          console.warn("[activity] deleteDepartment failed:", err?.message)
        );

      // await ActivityLog.create({ action: "Deleted department levels", details: { ids } });

      return res.status(200).json({
        success: true,
        message: "Department(s) deleted successfully.",
      });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  },
};

export default departmentCtrl;
