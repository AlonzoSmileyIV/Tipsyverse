import {
  PositionModel as Position,
  UserModel as User,
  HierarchyModel as Hierarchy,
  DepartmentModel as Department,
} from "../../models/index.js";
import XLSX from "xlsx";
import { diffFields, makeBulkActivityLogger } from "../../utils/index.js";

const positionCtrl = {
  bulkPositionHandler: async (req, res) => {
    try {
      const { type } = req.query; // 'add', 'edit', or 'delete'
      const file = req.file;

      const reqUser = await User.findById(req.user.id);
      const { logRow, logBatch } = makeBulkActivityLogger({
        req,
        reqUser,
        type,
        entityModel: "Position",
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
        "Hierarchy",
        "Department",
        "Description",
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
      const blankNames = [],
        blankHierarchies = [],
        blankDepartments = [],
        blankDescriptions = [],
        takenNames = [],
        errorRows = []; // <-- Track rows with errors

      for (let i = 0; i < rows.length; i++) {
        const rowNum = i + 2;
        const row = rows[i];
        const name = row.Name?.trim();
        const newName = row["New Name"]?.trim();
        const hierarchy = row["Hierarchy"]?.trim();
        const department = row["Department"]?.trim();
        const description = row["Description"]?.trim();

        // 🚫 Block modification of "Owner"
        const isOwner = name === "Owner";
        const ownerExists = await Position.findOne({ name: "Owner" });
        if (isOwner) {
          if (type === "add" && ownerExists) {
            errors.push(
              `Row ${rowNum} is invalid: Position "Owner" already exists and cannot be added again.`
            );
            errorRows.push({
              Row: rowNum,
              ...row,
              Error: `Position "Owner" already exists and cannot be added again.`,
            });
            continue;
          }

          if ((type === "edit" || type === "delete") && ownerExists) {
            errors.push(
              `Row ${rowNum} is invalid: Position "Owner" cannot be modified or deleted.`
            );
            errorRows.push({
              Row: rowNum,
              ...row,
              Error: `Position "Owner" cannot be modified or deleted.`,
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

          if (!hierarchy) {
            errors.push(`Row ${rowNum} is invalid: Hierarchy is blank.`);
            blankHierarchies.push(rowNum);
            errorRows.push({
              Row: rowNum,
              ...row,
              Error: "Hierarchy is blank",
            });
            continue;
          }

          if (!department) {
            errors.push(`Row ${rowNum} is invalid: Department is blank.`);
            blankDepartments.push(rowNum);
            errorRows.push({
              Row: rowNum,
              ...row,
              Error: "Department is blank",
            });
            continue;
          }

          const existingName = await Position.findOne({ name });
          if (existingName) {
            errors.push(`Row ${rowNum} is invalid: Name is already taken.`);
            takenNames.push(rowNum);
            errorRows.push({
              Row: rowNum,
              ...row,
              Error: "Name is already taken.",
            });
            continue;
          }

          const existingHierarchy = await Hierarchy.findOne({ name: hierarchy });
          if (!existingHierarchy) {
            errors.push(
              `Row ${rowNum} is invalid: Hierarchy named ${hierarchy} does not exist.`
            );
            errorRows.push({
              Row: rowNum,
              ...row,
              Error: "Hierarchy placed is not found.",
            });
            continue;
          }

          const existingDepartment = await Department.findOne({ name: department });
          if (!existingDepartment) {
            errors.push(
              `Row ${rowNum} is invalid: Department placed does not exist.`
            );
            errorRows.push({
              Row: rowNum,
              ...row,
              Error: "Department placed is not found.",
            });
            continue;
          }
          const created = await Position.create({
            name,
            description,
            hierarchy: existingHierarchy.id,
            department: existingDepartment.id,
          });

          await logRow({
            targetId: created._id.toString(),
            rowNum,
            label: created.name,
            extraMeta: {
              hierarchy: existingHierarchy.name,
              department: existingDepartment.name,
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

          const position = await Position.findOne({ name: name }).populate(
            "hierarchy department"
          );
          const before = position.toObject();

          if (newName && newName !== name) {
            const newNameExist = await Position.findOne({ name: newName });
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
            position.name = newName;
          }

          if (description && description !== "") {
            position.description = description;
          }

          if (hierarchy && hierarchy !== "") {
            const existingHierarchy = await Hierarchy.findOne({
              name: hierarchy,
            });
            if (!existingHierarchy) {
              errors.push(
                `Row ${rowNum} is invalid: Hierarchy placed does not exist.`
              );
              errorRows.push({
                Row: rowNum,
                ...row,
                Error: "Hierarchy placed does not exist",
              });
              continue;
            }
            position.hierarchy = existingHierarchy.id;
          }

          if (department && department !== "") {
            const existingDepartment = await Department.findOne({
              name: department,
            });
            if (!existingDepartment) {
              errors.push(
                `Row ${rowNum} is invalid: Department placed does not exist.`
              );
              errorRows.push({
                Row: rowNum,
                ...row,
                Error: "Department placed does not exist",
              });
              continue;
            }
            position.department = existingDepartment.id;
          }

          await position.save();
          const after = await Position.findById(position._id)
            .populate("hierarchy department")
            .lean();

          await logRow({
            targetId: position._id.toString(),
            rowNum,
            label: `${before.name} → ${after.name}`,
            changes: diffFields(before, after, [
              "name",
              "description",
              "hierarchy",
              "department", // populated objects will stringify differently; you can record names:
            ]),
            extraMeta: {
              beforeHierarchy: before.hierarchy?.name ?? null,
              afterHierarchy: after.hierarchy?.name ?? null,
              beforeDepartment: before.department?.name ?? null,
              afterDepartment: after.department?.name ?? null,
            },
          });

          successCount.edit++;
        } else if (type === "delete") {
          if (!name) {
            errors.push(`Row ${rowNum} is invalid: Name is blank.`);
            blankNames.push(rowNum);
            errorRows.push({ Row: rowNum, ...row, Error: "Name is blank." });

            continue;
          }

          const positionExist = await Position.findOne({ name }).populate("hierarchy department");
          if (!positionExist) {
            errors.push(
              `Row ${rowNum} is invalid: There is no position with that name.`
            );
            errorRows.push({
              Row: rowNum,
              ...row,
              Error: "There is no position with that name.",
            });
            continue;
          }

          const before = positionExist.toObject();


        await Position.deleteOne({ _id: positionExist._id });

        await logRow({
          targetId: before._id.toString(),
          rowNum,
          label: before.name,
          extraMeta: {
            previousHierarchy: before.hierarchy?.name ?? null,
            previousDepartment: before.department?.name ?? null,
          },
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

      if (blankHierarchies.length === rows.length) {
        suggestions.push(`All of the hierarchies are blank.`);
      } else if (blankHierarchies.length > rows.length / 2) {
        suggestions.push(
          `You might want to take a look at the hierarchies because most of them are blank as shown in rows {${blankNames.join(
            ", "
          )}}.`
        );
      }

      if (blankDepartments.length === rows.length) {
        suggestions.push(`All of the departments are blank.`);
      } else if (blankDepartments.length > rows.length / 2) {
        suggestions.push(
          `You might want to take a look at the departments because most of them are blank as shown in rows {${blankNames.join(
            ", "
          )}}.`
        );
      }

      if (blankDescriptions.length === rows.length) {
        suggestions.push(`All of the descriptions are blank.`);
      } else if (blankDescriptions.length > rows.length / 2) {
        suggestions.push(
          `You might want to take a look at the descriptions because most of them are blank as shown in rows {${blankNames.join(
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
                suggestions.length > 0
                  ? `<br><br>${suggestions.join("<br>")}`
                  : ""
              }<br>- ${errors.join("<br>- ")}`;

      await logBatch({
      counts: successCount,
      errorsCount: errors.length,
      suggestions,
      meta: { fileName: req.file?.originalname, mimetype: req.file?.mimetype, errorRows },
    });

      res.status(200).json({
        success: true,
        message,
        successPresent: successCount > 0,
        errorsPresent: errors.length > 0,
      });
    } catch (error) {
      console.error("Bulk position upload failed:", error);
      res
        .status(500)
        .json({ success: false, message: "Failed to process bulk upload." });
    }
  },
  // create position
  createPosition: async (req, res) => {
    try {
      const { name, description, hierarchy, department } = req.body;
      if (!name) {
        return res
          .status(400)
          .json({ success: false, message: "Please fill in position name." });
      }

      if (!description) {
        return res.status(400).json({
          success: false,
          message: "Please fill in position description.",
        });
      }

      if (!hierarchy) {
        return res.status(400).json({
          success: false,
          message: "Please fill in position hierarchy.",
        });
      }

      if (!department) {
        return res.status(400).json({
          success: false,
          message: "Please fill in position department.",
        });
      }

      const existingPosition = await Position.findOne({ name });
      if (existingPosition) {
        return res
          .status(400)
          .json({ success: false, message: "Position already exists." });
      }

      const existingHierarchy = await Hierarchy.findById(hierarchy);
      if (!existingHierarchy) {
        return res.status(400).json({
          success: false,
          message: "The hierarchy doesn't exist, need id.",
        });
      }

      const existingDepartment = await Department.findById(department);
      if (!existingDepartment) {
        return res.status(400).json({
          success: false,
          message: "The department doesn't exist, need id.",
        });
      }

      const position = new Position({
        name: name,
        description: description,
        hierarchy: hierarchy,
        department: department,
      });
      await position.save();

      await req
        .logActivity({
          action: "create",
          target: { model: "Position", id: position._id, name: position.name },
          actor: {
            type: "User",
            id: req.user.id,
            label: {
              fullName: req.user.fullName,
              email: req.user.email,
              role: req.user.role,
            },
          },
          summary: `Created position "${position.name}"`,
          nextSnapshot: {
            name: position.name,
            description: position.description,
            hierarchy: position.hierarchy,
            department: position.department,
          },
        })
        .catch((err) =>
          console.warn("[activity] createPosition log failed:", err?.message)
        );

      return res.status(201).json({
        success: true,
        message: "Position created successfully.",
        data: position,
      });
    } catch (error) {
      return res.status(500).json({ success: false, message: error.message });
    }
  },

  // view
  viewAllPositions: async (req, res) => {
    try {
      const positions = await Position.find()
        .populate(["hierarchy", "department"])
        .sort({ _id: 1 });
      return res.status(200).json({ success: true, data: positions });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  },

  viewPosition: async (req, res) => {
    try {
      const { id } = req.params;
      const position = await Position.findById(id).populate([
        "hierarchy",
        "department",
      ]);

      if (!position) {
        return res
          .status(404)
          .json({ success: false, message: "Position not found." });
      }
      return res.status(200).json({ success: true, data: position });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  },

  // Update Position
  updatePosition: async (req, res) => {
    try {
      const { id } = req.params;
      const { name, description, hierarchy, department } = req.body;
      if (!name) {
        return res
          .status(400)
          .json({ success: false, message: "Please fill in position name." });
      }

      if (!description) {
        return res.status(400).json({
          success: false,
          message: "Please fill in position description.",
        });
      }

      if (!hierarchy) {
        return res.status(400).json({
          success: false,
          message: "Please fill in position hierarchy.",
        });
      }

      if (!department) {
        return res.status(400).json({
          success: false,
          message: "Please fill in position department.",
        });
      }

      const position = await Position.findById(id);

      if (!position) {
        return res.status(400).json({
          success: false,
          message: "Position not found.",
        });
      }

      const prevSnapshot = {
        name: position?.name,
        description: position?.description,
        hierarchy: position?.hierarchy,
        department: position?.department,
      };

      // Check if name already exists in another position
      const existingName = await Position.findOne({ name, _id: { $ne: id } });
      if (existingName) {
        return res
          .status(400)
          .json({ success: false, message: "Position name already exists." });
      }

      // Check if hierarchy exists
      const hierarchyExists = await Hierarchy.findById(hierarchy);
      if (!hierarchyExists) {
        return res
          .status(400)
          .json({ success: false, message: "Invalid hierarchy selected." });
      }

      // Check if department exists
      const departmentExists = await Department.findById(department);
      if (!departmentExists) {
        return res
          .status(400)
          .json({ success: false, message: "Invalid department selected." });
      }

      const updatedPosition = await Position.findByIdAndUpdate(
        id,
        { name, description, hierarchy, department },
        { new: true }
      );
      if (!updatedPosition) {
        return res
          .status(404)
          .json({ success: false, message: "Position not found." });
      }

      const nextSnapshot = {
        name: updatedPosition.name,
        description: updatedPosition.description,
        hierarchy: updatedPosition.hierarchy,
        department: updatedPosition.department,
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
            model: "Position",
            id: updatedPosition._id,
            name: updatedPosition.name,
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
          summary: `Updated position "${updatedPosition.name}"`,
          changes,
          prevSnapshot,
          nextSnapshot,
        })
        .catch((err) =>
          console.warn("[activity] updatePosition log failed:", err?.message)
        );

      return res.status(200).json({
        success: true,
        message: "Position updated successfully.",
        data: updatedPosition,
      });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  },

  // Delete Department Level (Supports Single & Bulk Deletion)
  deletePosition: async (req, res) => {
    try {
      const { id } = req.params;
      const ids = Array.isArray(id) ? id : [id];
      const deletedPosition = await Position.deleteMany({ _id: { $in: ids } });
      if (!deletedPosition.deletedCount) {
        return res.status(404).json({
          success: false,
          message: "No positions found for deletion.",
        });
      }

      await req
        .logActivity({
          action: "delete",
          target: { model: "Position", ids },
          actor: {
            type: "User",
            id: req.user.id,
            label: {
              fullName: req.user.fullName,
              email: req.user.email,
              role: req.user.role,
            },
          },
          summary: `Deleted ${ids.length} position(s)`,
          prevSnapshot: { ids },
        })
        .catch((err) =>
          console.warn("[activity] deletePosition log failed:", err?.message)
        );

      return res
        .status(200)
        .json({ success: true, message: "Position(s) deleted successfully." });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  },
};

export default positionCtrl;
