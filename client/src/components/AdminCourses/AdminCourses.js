// AdminCourseModules.jsx
import { useEffect, useMemo, useState, useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  fetchCourses as fetchCoursesThunk,
  fetchCourseById,
} from "../../features/courses/courseSlice";
import {
  Alert,
  Box,
  Button,
  Collapse,
  Drawer,
  IconButton,
  MenuItem,
  Stack,
  TextField,
  Tooltip,
  Typography,
  useMediaQuery,
} from "@mui/material";
import SafeHtml from "../SafeHtml/SafeHtml";
import {
  Add,
  ArrowDownward,
  ArrowUpward,
  Edit,
  Refresh,
  Save,
} from "@mui/icons-material";
import AdminModuleForm from "../AdminModuleForm/AdminModuleForm";
import { DataGrid } from "@mui/x-data-grid";
import moment from "moment";
import api from "../../services/api";

const sortByOrder = (a, b) => (a.order ?? 0) - (b.order ?? 0);
const ROLE_OPTIONS = ["employee", "bartender", "regular"]; // adjust as needed
const primaryButtonSx = {
  color: "var(--primary-color)",
  borderColor: "var(--primary-color)",
  "&:hover": {
    borderColor: "var(--primary-color)",
    backgroundColor: "rgba(128, 0, 32, 0.06)",
  },
};
const primaryContainedSx = {
  backgroundColor: "var(--primary-color)",
  "&:hover": { backgroundColor: "#5f001f" },
};

const AdminCourses = () => {
  const dispatch = useDispatch();
  const is650OrLess = useMediaQuery("(max-width:650px)");
  const is800OrLess = useMediaQuery("(max-width:800px)");
  const { allCourses, currentCourse, error } = useSelector((s) => s.courses);

  const [selectedCourseId, setSelectedCourseId] = useState("");
  const [selectedCourse, setSelectedCourse] = useState(null);

  const [modules, setModules] = useState([]); // local working copy for grid edits
  //const [drawerOpen, setDrawerOpen] = useState(false);

  const [alertOpen, setAlertOpen] = useState(false);
  const [alertMessage, setAlertMessage] = useState("");
  const [alertSeverity, setAlertSeverity] = useState("info");
  const [loading, setLoading] = useState(false);

  // Add-course drawer state
  const [courseDrawerOpen, setCourseDrawerOpen] = useState(false);
  const [courseDrawerMode, setCourseDrawerMode] = useState("add"); // "add" | "edit"

  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  const [courseSaving, setCourseSaving] = useState(false);
  const [courseDraft, setCourseDraft] = useState({
    title: "",
    description: "",
    courseOrder: 0,
    requiredForRoles: [],
    restrictedTo: [],
  });

  //const [modFormMode, setModFormMode] = useState("add"); // "add" | "edit"
//const [editIdx, setEditIdx] = useState(-1);
  //const [initialModule, setInitialModule] = useState(null);

  const [moduleForm, setModuleForm] = useState({
    open: false,
    mode: "add",
    moduleIndex: null,
    initialModule: null,
  });

  const openAddModule = () =>
    setModuleForm({
      open: true,
      mode: "add",
      moduleIndex: null,
      initialModule: null,
    });

  const openEditModule = (idx) =>
    setModuleForm({
      open: true,
      mode: "edit",
      moduleIndex: idx,
      initialModule: modules?.[idx],
    });

  const resetCourseDraft = useCallback(
    (course = null) => {
      if (course) {
        setCourseDraft({
          title: course.title || "",
          description: course.description || "",
          courseOrder: Number.isFinite(course.sortOrder) ? course.sortOrder : 0,
          requiredForRoles: Array.isArray(course.requiredForRoles)
            ? course.requiredForRoles
            : [],
          restrictedTo: Array.isArray(course.restrictedTo)
            ? course.restrictedTo
            : [],
        });
      } else {
        setCourseDraft({
          title: "",
          description: "",
          courseOrder: (allCourses?.length ?? 0) || 0,
          requiredForRoles: [],
          restrictedTo: [],
        });
      }
    },
    [allCourses?.length]
  );

  // ---------- Load all courses via Redux thunk ----------
  const loadCourses = useCallback(() => {
    // use fields projection for lightweight list
    dispatch(
      fetchCoursesThunk({
        fields:
          "title,slug,updatedAt,modules.title,modules.order,sortOrder,requiredForRoles,restrictedTo",
        sort: "sortOrder updatedAt",
        limit: 1000,
      })
    );
  }, [dispatch]);

  useEffect(() => {
    loadCourses();
  }, [loadCourses]);

  // Pick first course when none selected
  useEffect(() => {
    if (!selectedCourseId && allCourses.length) {
      setSelectedCourseId(allCourses[0]._id);
    }
  }, [allCourses, selectedCourseId]);

  // Load course detail via Redux thunk when selection changes
  useEffect(() => {
    if (selectedCourseId) {
      dispatch(fetchCourseById(selectedCourseId));
    }
  }, [dispatch, selectedCourseId]);

  // Hydrate local selectedCourse + modules when currentCourse in store updates
  useEffect(() => {
    if (!currentCourse) return;
    setSelectedCourse(currentCourse);
    const ms = (currentCourse.modules || [])
      .map((m, i) => ({
        _id: m._id,
        title: m.title || `Module ${i + 1}`,
        order: Number.isFinite(m.order)
          ? m.order
          : Number.isFinite(m.moduleOrder)
          ? m.moduleOrder
          : i,
        description: m.description || "",
        sections: Array.isArray(m.sections) ? m.sections : [],
      }))
      .sort(sortByOrder);
    setModules(ms);
  }, [currentCourse]);

  // ---------- Table / actions ----------
  const rows = useMemo(
    () =>
      modules.map((m, i) => ({
        id: m._id || i,
        idx: i,
        ...m,
     sectionsCount: Array.isArray(m.sections)
       ? m.sections.length
       : (Number.isFinite(m.sectionsCount) ? m.sectionsCount : 0),      })),
    [modules]
  );

  const move = (from, to) => {
    setModules((prev) => {
      const arr = [...prev];
      if (to < 0 || to >= arr.length) return arr;
      const [item] = arr.splice(from, 1);
      arr.splice(to, 0, item);
      return arr.map((m, i) => ({ ...m, order: i }));
    });
  };

  // const handleAdd = () => {
  //   setModFormMode("add");
  //   setEditIdx(-1);
  //   setInitialModule(null);
  //   //setDrawerOpen(true);
  // };

  // const handleEdit = (idx) => {
  //   setModFormMode("edit");
  //   setEditIdx(idx);
  //   setInitialModule(modules[idx]); // pass current module to the form
  //   //setDrawerOpen(true);
  // };

  // const handleDelete = (idx) => {
  //   setModules((prev) => {
  //     const arr = prev.filter((_, i) => i !== idx);
  //     return arr.map((m, i) => ({ ...m, order: i }));
  //   });
  // };

  // ---------- Persist modules to course (bulk PUT) ----------
  const handlePersist = async () => {
    if (!selectedCourse?._id) return;
    setLoading(true);
    try {
      const totalQuestions = modules.reduce(
        (sum, m) =>
          sum +
          (m.sections?.reduce(
            (s, sec) => s + (sec.quiz?.questions?.length || 0),
            0
          ) || 0),
        0
      );

      const safePoolSize =
        selectedCourse?.quiz?.poolSize > 0
          ? Math.min(selectedCourse.quiz.poolSize, totalQuestions)
          : 0;

      const payload = {
        title: selectedCourse.title,
        modules: modules.map((m) => ({
          title: m.title,
          moduleOrder: Number(m.order) || 0,
          sections: Array.isArray(m.sections) ? m.sections : [],
        })),
        quiz: {
          poolSize: safePoolSize,
          passingScorePct: selectedCourse?.quiz?.passingScorePct ?? 70,
        },
      };
      await api.put(`/courses/${selectedCourse._id}`, payload);
      setAlertMessage("Modules saved.");
      setAlertSeverity("success");
      setAlertOpen(true);
      await dispatch(fetchCourseById(selectedCourse._id)).unwrap();
    } catch (e) {
      setAlertMessage(e?.response?.data?.message || "Failed to save modules.");
      setAlertSeverity("error");
      setAlertOpen(true);
    } finally {
      setLoading(false);
    }
  };

  // ---------- Create course ----------
  const handleCreateCourse = async () => {
    if (!courseDraft.title.trim()) {
      setAlertMessage("Course title is required.");
      setAlertSeverity("warning");
      setAlertOpen(true);
      return;
    }
    setCourseSaving(true);
    try {
      const payload = {
        title: courseDraft.title.trim(),
        description: courseDraft.description?.trim() || "",
        sortOrder: Number(courseDraft.courseOrder) || 0,
        requiredForRoles: Array.isArray(courseDraft.requiredForRoles)
          ? courseDraft.requiredForRoles
          : [],
        restrictedTo: Array.isArray(courseDraft.restrictedTo)
          ? courseDraft.restrictedTo
          : [],
      };
      const res = await api.post("/courses", payload);
      const newCourse = res?.data?.data;

      setAlertMessage("Course created.");
      setAlertSeverity("success");
      setAlertOpen(true);
      setCourseDrawerOpen(false);
      resetCourseDraft();

      await dispatch(
        fetchCoursesThunk({
          fields:
            "title,slug,tags,updatedAt,modules.title,modules.order,sortOrder,requiredForRoles,restrictedTo",
          sort: "sortOrder updatedAt",
          limit: 1000,
        })
      ).unwrap();

      if (newCourse?._id) {
        setSelectedCourseId(newCourse._id);
        await dispatch(fetchCourseById(newCourse._id)).unwrap();
      }
    } catch (e) {
      setAlertMessage(e?.response?.data?.message || "Failed to create course.");
      setAlertSeverity("error");
      setAlertOpen(true);
    } finally {
      setCourseSaving(false);
    }
  };

  const [savingModule, setSavingModule] = useState(false);

  const handleModuleSaved = async ({
    mode,
    courseId,
    module,
    moduleIndex,
    moduleId,
  }) => {
    if (savingModule) return; // re-entrancy guard
    setSavingModule(true);
    try {
      if (mode === "add") {
        // POST creates and returns the new module (with _id)
        await api.post(`/courses/${courseId}/modules`, {
          title: module.title,
          description: module.description,
          moduleOrder: module.order ?? 0,
          sections: module.sections,
        });
        setAlertMessage("Module created.");
        setAlertSeverity("success");
      } else {
        // EDIT → PUT needs an id
        const id = moduleId || modules[moduleIndex]?._id;
        
        if (!moduleId) throw new Error("Missing module id for update.");

        await api.put(`/courses/${courseId}/modules/${id}`, {
          title: module.title,
          description: module.description,
          moduleOrder: module.order ?? 0,
          sections: module.sections,
        });
        setAlertMessage("Module updated.");
        setAlertSeverity("success");
      }

      // Refresh from server to keep local state in sync
      await dispatch(fetchCourseById(courseId)).unwrap();

      setAlertOpen(true);
      setModuleForm((s) => ({ ...s, open: false }));
    } catch (e) {
      setAlertMessage(e?.response?.data?.message || "Failed to save module.");
      setAlertSeverity("error");
      setAlertOpen(true);
    } finally {
      setSavingModule(false);
    }
  };

  const handleModuleDeleted = async ({ courseId, moduleIndex, moduleId }) => {
    if (savingModule) return;
    setSavingModule(true);
    try {
      const id = moduleId || modules[moduleIndex]?._id;
      if (!id) {
        // if not persisted yet, just drop locally
        setModules((prev) =>
          prev
            .filter((_, i) => i !== moduleIndex)
            .map((m, i) => ({ ...m, order: i }))
        );
      } else {
        await api.delete(`/courses/${courseId}/modules/${id}`);
        await dispatch(fetchCourseById(courseId)).unwrap();
      }
      setAlertMessage("Module deleted.");
      setAlertSeverity("info");
      setAlertOpen(true);
      setModuleForm((s) => ({ ...s, open: false }));
    } catch (e) {
      setAlertMessage(e?.response?.data?.message || "Failed to delete module.");
      setAlertSeverity("error");
      setAlertOpen(true);
    } finally {
      setSavingModule(false);
    }
  };

  const handleOpenEditCourse = () => {
    if (!selectedCourse) return;
    setCourseDrawerMode("edit");
    resetCourseDraft(selectedCourse);
    setCourseDrawerOpen(true);
  };

  const handleUpdateCourse = async () => {
    if (!selectedCourse?._id) return;
    if (!courseDraft.title.trim()) {
      setAlertMessage("Course title is required.");
      setAlertSeverity("warning");
      setAlertOpen(true);
      return;
    }

    setCourseSaving(true);
    try {
      const payload = {
        title: courseDraft.title.trim(),
        description: courseDraft.description?.trim() || "",
        sortOrder: Number(courseDraft.courseOrder) || 0,
        requiredForRoles: Array.isArray(courseDraft.requiredForRoles)
          ? courseDraft.requiredForRoles
          : [],
        restrictedTo: Array.isArray(courseDraft.restrictedTo)
          ? courseDraft.restrictedTo
          : [],
      };

      await api.put(`/courses/${selectedCourse._id}`, payload);

      setAlertMessage("Course updated.");
      setAlertSeverity("success");
      setAlertOpen(true);
      setCourseDrawerOpen(false);

      // refresh list + detail to stay in sync
      await dispatch(
        fetchCoursesThunk({
          fields:
            "title,slug,tags,updatedAt,modules.title,modules.order,sortOrder,requiredForRoles,restrictedTo",
          sort: "sortOrder updatedAt",
          limit: 1000,
        })
      ).unwrap();

      await dispatch(fetchCourseById(selectedCourse._id)).unwrap();
    } catch (e) {
      setAlertMessage(e?.response?.data?.message || "Failed to update course.");
      setAlertSeverity("error");
      setAlertOpen(true);
    } finally {
      setCourseSaving(false);
    }
  };

  const handleDeleteCourse = async () => {
    if (!selectedCourse?._id) return;
    setCourseSaving(true);
    try {
      await api.delete(`/courses/${selectedCourse._id}`);

      setAlertMessage("Course deleted.");
      setAlertSeverity("info");
      setAlertOpen(true);
      setCourseDrawerOpen(false);

      // refresh list, then pick the next available course (if any)
      const refreshed = await dispatch(
        fetchCoursesThunk({
          fields:
            "title,slug,tags,updatedAt,modules.title,modules.order,sortOrder,requiredForRoles,restrictedTo",
          sort: "sortOrder updatedAt",
          limit: 1000,
        })
      ).unwrap();

      const list = refreshed?.data || refreshed || [];
      if (list.length) {
        setSelectedCourseId(list[0]._id);
        await dispatch(fetchCourseById(list[0]._id)).unwrap();
      } else {
        setSelectedCourseId("");
        setSelectedCourse(null);
        setModules([]);
      }
    } catch (e) {
      setAlertMessage(e?.response?.data?.message || "Failed to delete course.");
      setAlertSeverity("error");
      setAlertOpen(true);
    } finally {
      setCourseSaving(false);
      setConfirmDeleteOpen(false);
    }
  };

  const columns = [
    {
      field: "order",
      headerName: "#",
      width: 70,
      align: "center",
      headerAlign: "center",
    },
    {
      field: "title",
      headerName: "Module Title",
      flex: 1,
      minWidth: is650OrLess ? 160 : 220,
    },
    {
      field: "sectionsCount",
      headerName: "Sections",
      width: 110,
      align: "center",
      headerAlign: "center"
    },
    {
      field: "actions",
      headerName: "Actions",
      width: is650OrLess ? 130 : 150,
      sortable: false,
      filterable: false,
      renderCell: (params) => {
        const i = params.row.idx;
        return (
          <Stack direction="row" spacing={0.5}>
            <Tooltip title="Move Up">
              <span>
                <IconButton
                  size="small"
                  onClick={() => move(i, i - 1)}
                  disabled={i === 0}
                >
                  <ArrowUpward fontSize="inherit" />
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title="Move Down">
              <span>
                <IconButton
                  size="small"
                  onClick={() => move(i, i + 1)}
                  disabled={i === modules.length - 1}
                >
                  <ArrowDownward fontSize="inherit" />
                </IconButton>
              </span>
            </Tooltip>

            {/* Edit opens the drawer with this module preloaded */}
            <Tooltip title="Edit">
              <IconButton size="small" onClick={() => openEditModule(i)}>
                <Edit fontSize="inherit" />
              </IconButton>
            </Tooltip>
          </Stack>
        );
      },
    },
  ];

  return (
    <Box>
      {/* Header */}
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          mb: 2,
          gap: 1,
          flexWrap: "wrap",
        }}
      >
        <Stack direction="column" spacing={1.5} alignItems="left">
          <Typography variant="h5" fontWeight={800}>Courses</Typography>
          <Typography variant="body2" color="text.secondary">
              Track the courses that we provide.
          </Typography>
          {selectedCourse && (
            <Typography variant="body2" color="text.secondary">
              {`Last Updated: ${moment(selectedCourse.updatedAt).format(
                "MM/DD/YY, h:mm a")}`}
             </Typography>
          )}
        </Stack>

        <Stack direction="row" spacing={1}>
          <Button
            startIcon={<Refresh />}
            variant="outlined"
            sx={primaryButtonSx}
            onClick={() =>
              dispatch(
                fetchCoursesThunk({
                  fields:
                    "title,slug,tags,updatedAt,modules.title,modules.order,sortOrder,requiredForRoles,requiredForRoles,restrictedTo",
                  sort: "sortOrder updatedAt",
                  limit: 1000,
                })
              )
            }
          >
            Refresh
          </Button>

          <Button
            variant="outlined"
            startIcon={<Add />}
            sx={primaryButtonSx}
            onClick={() => {
              setCourseDrawerMode("add");
              resetCourseDraft();
              setCourseDrawerOpen(true);
            }}
          >
            New Course
          </Button>

          <Button
            variant="outlined"
            startIcon={<Edit />}
            sx={primaryButtonSx}
            onClick={handleOpenEditCourse}
            disabled={!selectedCourseId}
          >
            Edit Course
          </Button>

          <Button
            variant="contained"
            startIcon={<Save />}
            sx={primaryContainedSx}
            onClick={handlePersist}
            disabled={!selectedCourseId || loading}
          >
            Save Modules
          </Button>
        </Stack>
      </Box>

      {/* Alerts */}
      <Collapse in={alertOpen || !!error}>
        <Box sx={{ mt: 2 }}>
          <Alert severity={alertSeverity} onClose={() => setAlertOpen(false)}>
            <SafeHtml html={alertMessage || error || ""} />
          </Alert>
        </Box>
      </Collapse>

      {/* Course Picker */}
      <Box sx={{ mb: 2, mt: 2 }}>
        <TextField
          select
          label="Select Course"
          value={selectedCourseId}
          onChange={(e) => setSelectedCourseId(e.target.value)}
          sx={{ minWidth: 320, mr: 2 }}
        >
          {allCourses.map((c) => (
            <MenuItem key={c._id} value={c._id}>
              {c.title}
            </MenuItem>
          ))}
        </TextField>

        <Tooltip title="Add new module">
          <span>
            <Button
              variant="outlined"
              startIcon={<Add />}
              sx={primaryButtonSx}
              onClick={openAddModule}
              disabled={!selectedCourseId}
            >
              Add Module
            </Button>
          </span>
        </Tooltip>
      </Box>

      {/* Modules table */}
      <Box
        sx={{
          width: "100%",
          "& .MuiDataGrid-columnHeaders": { fontWeight: 600 },
        }}
      >
        <DataGrid
          autoHeight
          rows={rows}
          columns={columns}
          columnVisibilityModel={{
            order: !is800OrLess,
            sectionsCount: !is650OrLess,
          }}
          hideFooterSelectedRowCount
          disableRowSelectionOnClick
          slots={{
            noRowsOverlay: () => (
              <Box sx={{ p: 3, textAlign: "center", color: "text.secondary" }}>
                {selectedCourseId
                  ? "No modules yet. Add one to get started."
                  : "Select a course to edit modules."}
              </Box>
            ),
          }}
        />
      </Box>

      {/* Drawer: add/edit module */}
      <Drawer
        anchor="right"
        open={moduleForm.open}
        onClose={() => setModuleForm((s) => ({ ...s, open: false }))}
        PaperProps={{
          sx: {
            width: { xs: "100%", sm: "90%", md: 640, lg: 720 },
            p: 2,
          },
        }}
      >
        <AdminModuleForm
          mode={moduleForm.mode}
          initialCourseId={selectedCourseId}
          initialModule={moduleForm.initialModule}
          moduleIndex={moduleForm.moduleIndex}
          onClose={() => setModuleForm((s) => ({ ...s, open: false }))}
          onSaved={handleModuleSaved}
          onDelete={handleModuleDeleted}
        />
      </Drawer>

      {/* Drawer — Add Course */}
      <Drawer
        anchor="right"
        open={courseDrawerOpen}
        onClose={() => setCourseDrawerOpen(false)}
        PaperProps={{ sx: { width: 460, p: 2 } }}
      >
        <Box sx={{ p: 1 }}>
          <Typography variant="h6" sx={{ mb: 2 }}>
            {courseDrawerMode === "edit" ? "Edit Course" : "New Course"}
          </Typography>

          <TextField
            label="Course Title"
            fullWidth
            required
            value={courseDraft.title}
            onChange={(e) =>
              setCourseDraft((p) => ({ ...p, title: e.target.value }))
            }
            sx={{ mb: 2 }}
          />

          <TextField
            label="Description"
            fullWidth
            multiline
            minRows={3}
            value={courseDraft.description}
            onChange={(e) =>
              setCourseDraft((p) => ({ ...p, description: e.target.value }))
            }
            sx={{ mb: 2 }}
          />

          <TextField
            type="number"
            label="Course Order"
            fullWidth
            value={courseDraft.courseOrder}
            onChange={(e) =>
              setCourseDraft((p) => ({
                ...p,
                courseOrder: Math.max(0, Number(e.target.value || 0)),
              }))
            }
            helperText="Lower numbers appear first in course lists."
            sx={{ mb: 2 }}
          />

          <TextField
            select
            SelectProps={{ multiple: true }}
            label="Who is required to take this course?"
            fullWidth
            value={courseDraft.requiredForRoles}
            onChange={(e) =>
              setCourseDraft((p) => ({
                ...p,
                requiredForRoles:
                  typeof e.target.value === "string"
                    ? e.target.value.split(",")
                    : e.target.value,
              }))
            }
            helperText="Controls who is required to take your courses."
            sx={{ mb: 3 }}
          >
            {ROLE_OPTIONS.map((opt) => (
              <MenuItem key={opt} value={opt}>
                {opt}
              </MenuItem>
            ))}
          </TextField>

          <TextField
            select
            SelectProps={{ multiple: true }}
            label="Who is this course restricted to?"
            fullWidth
            value={courseDraft.restrictedTo}
            onChange={(e) =>
              setCourseDraft((p) => ({
                ...p,
                restrictedTo:
                  typeof e.target.value === "string"
                    ? e.target.value.split(",")
                    : e.target.value,
              }))
            }
            helperText="Controls visibility/eligibility in your app."
            sx={{ mb: 3 }}
          >
            {ROLE_OPTIONS.map((opt) => (
              <MenuItem key={opt} value={opt}>
                {opt}
              </MenuItem>
            ))}
          </TextField>

          <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
            <Button
              variant="outlined"
              onClick={() => setCourseDrawerOpen(false)}
            >
              Cancel
            </Button>

            {courseDrawerMode === "edit" ? (
              <>
                <Button
                  variant="contained"
                  onClick={handleUpdateCourse}
                  disabled={courseSaving}
                >
                  {courseSaving ? "Saving..." : "Save Changes"}
                </Button>

                {/* Optional: destructive action for deleting the course */}
                <Button
                  color="error"
                  variant="outlined"
                  onClick={() => setConfirmDeleteOpen(true)}
                  disabled={courseSaving}
                >
                  Delete
                </Button>
              </>
            ) : (
              <Button
                variant="contained"
                onClick={handleCreateCourse}
                disabled={courseSaving}
              >
                {courseSaving ? "Creating..." : "Create Course"}
              </Button>
            )}
          </Stack>

          {/* Optional confirm dialog for delete */}
          {confirmDeleteOpen && (
            <Box
              sx={{
                mt: 2,
                p: 2,
                border: "1px solid",
                borderColor: "divider",
                borderRadius: 1.5,
              }}
            >
              <Typography variant="subtitle1" sx={{ mb: 1 }}>
                Delete this course?
              </Typography>
              <Typography variant="body2" sx={{ mb: 2 }}>
                This action cannot be undone. All modules/sections under this
                course will be removed.
              </Typography>
              <Stack direction="row" spacing={1.5}>
                <Button onClick={() => setConfirmDeleteOpen(false)}>
                  Cancel
                </Button>
                <Button
                  color="error"
                  variant="contained"
                  onClick={handleDeleteCourse}
                  disabled={courseSaving}
                >
                  {courseSaving ? "Deleting..." : "Delete Course"}
                </Button>
              </Stack>
            </Box>
          )}
        </Box>
      </Drawer>
    </Box>
  );
};

export default AdminCourses;
