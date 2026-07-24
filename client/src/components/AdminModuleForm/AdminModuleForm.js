// AdminModuleForm.jsx
import {
  Add,
  ArrowBack,
  CheckCircle,
  Close as CloseIcon,
  DeleteOutline,
  PlaylistAdd,
  Save as SaveIcon,
  Visibility,
  Download as DownloadIcon,
  UploadFile as UploadFileIcon,
  DeleteSweep as DeleteSweepIcon,
  WarningAmber as WarningAmberIcon,
} from "@mui/icons-material";
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  Stack,
  Step,
  StepLabel,
  Stepper,
  TextField,
  Tooltip,
  Typography,
  Snackbar,
  Alert,
  MenuItem,
} from "@mui/material";
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import * as XLSX from "xlsx";
import api from "../../services/api"; // used to fetch course list (only here)
import ActivityLogsTable from "../ActivityLogsTable/ActivityLogsTable";

// ----- WYSIWYG placeholder -----
const Wysiwyg = ({ value, onChange, label }) => (
  <TextField
    label={label}
    value={value}
    onChange={(e) => onChange(e.target.value)}
    multiline
    minRows={6}
    fullWidth
  />
);

const emptySection = () => ({
  title: "",
  images: [],
  videos: [],
  content: "",
  quiz: { questions: [] },
});

const emptyQuestion = () => ({
  prompt: "",
  options: [
    { text: "", isCorrect: false },
    { text: "", isCorrect: false },
    { text: "", isCorrect: false },
    { text: "", isCorrect: false },
  ],
  points: 1,
});

/**
 * Props:
 * - mode: "add" | "edit"
 * - initialCourseId?: string    // preselect course when editing
 * - initialModule?: { title, order, sections }
 * - moduleIndex?: number        // where this module lives in the course (for edit)
 * - onClose: () => void
 * - onSaved: (payload) => void  // receives { courseId, module, moduleIndex? }
 * - onDelete?: (args) => void   // receives { courseId, moduleIndex }
 */
const AdminModuleForm = ({
  mode = "add",
  initialCourseId,
  initialModule,
  moduleIndex,
  onClose,
  onSaved,
  onDelete,
}) => {
  const isEdit = mode === "edit";

  // ---------- Course & Module meta ----------
  const [courses, setCourses] = useState([]);
  const [courseId, setCourseId] = useState(initialCourseId || "");
  const [moduleTitle, setModuleTitle] = useState(initialModule?.title || "");
  const [moduleDescription, setModuleDescription] = useState(
    initialModule?.description || ""
  );
  const [moduleOrder, setModuleOrder] = useState(
    Number.isFinite(initialModule?.order) ? initialModule.order : 0
  );

  // ---------- Sections & quiz (same as your course form) ----------
  const [sections, setSections] = useState(
    Array.isArray(initialModule?.sections) && initialModule.sections.length
      ? initialModule.sections
      : [emptySection()]
  );

  const [poolSize, setPoolSize] = useState(
    Number.isFinite(initialModule?.poolSize) ? initialModule.poolSize : 5
  );

  const [passingPercent, setPassingPercent] = useState(
    Number.isFinite(initialModule?.passingPercent)
      ? initialModule.passingPercent
      : 70
  );

  // stepper, review, delete
  const [activeStep, setActiveStep] = useState(0);
  const steps = ["Module", "Sections", "Quiz", "Review"];
  const [reviewOpen, setReviewOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteText, setDeleteText] = useState("");

  // validation visibility
  const [showErr, setShowErr] = useState({ meta: false, sections: false });

  // alerts
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: "",
    severity: "success",
  });

  // import helpers
  const fileInputRef = useRef(null);
  const [mergeDialogOpen, setMergeDialogOpen] = useState(false);
  const [parsedSectionsDraft, setParsedSectionsDraft] = useState([]);
  const [importSummary, setImportSummary] = useState({
    sectionsAdded: 0,
    sectionsUpdated: 0,
    questionsAdded: 0,
    rowsSkipped: 0,
  });
  const [clearAllOpen, setClearAllOpen] = useState(false);

  // ---------- Fetch minimal course list for selector ----------
  const loadCourses = useCallback(async () => {
    try {
      const res = await api.get("/courses?fields=title,tags,slug");
      const list = Array.isArray(res.data?.data) ? res.data.data : [];
      setCourses(list);
      if (!courseId && list.length) setCourseId(list[0]._id);
    } catch (e) {
      setSnackbar({
        open: true,
        message: e?.response?.data?.message || "Failed to fetch courses.",
        severity: "error",
      });
    }
  }, [courseId]);

  useEffect(() => {
    loadCourses();
  }, [loadCourses]);

  useEffect(() => {
    setCourseId(initialCourseId || "");
    setModuleTitle(initialModule?.title || "");
    setModuleDescription(initialModule?.description || "");
    setModuleOrder(
      Number.isFinite(initialModule?.order) ? initialModule.order : 0
    );
    setSections(
      Array.isArray(initialModule?.sections) && initialModule.sections.length
        ? initialModule.sections
        : [emptySection()]
    );
    setPoolSize(
      Number.isFinite(initialModule?.poolSize) ? initialModule.poolSize : 5
    );
    setPassingPercent(
      Number.isFinite(initialModule?.passingPercent)
        ? initialModule.passingPercent
        : 70
    );
  }, [initialModule, initialCourseId, mode]);

  // ---------- Derived ----------
  const totalQuestionPool = useMemo(
    () =>
      sections.reduce((sum, s) => sum + (s.quiz?.questions?.length || 0), 0),
    [sections]
  );

  // ---------- Validation ----------
  const metaErrors = useMemo(() => {
    return {
      course: courseId ? "" : "Course is required.",
      title: moduleTitle.trim() ? "" : "Module title is required.",
      order:
        Number.isFinite(Number(moduleOrder)) && Number(moduleOrder) >= 0
          ? ""
          : "Order must be a number ≥ 0.",
      poolSize:
        Number.isFinite(Number(poolSize)) &&
        Number(poolSize) >= 0 &&
        Number(poolSize) <= totalQuestionPool
          ? ""
          : `Pool size must be between 0 and ${totalQuestionPool}.`,
      passingPercent:
        Number.isFinite(Number(passingPercent)) &&
        Number(passingPercent) >= 0 &&
        Number(passingPercent) <= 100
          ? ""
          : "Passing % must be between 0 and 100.",
    };
  }, [
    courseId,
    moduleTitle,
    moduleOrder,
    poolSize,
    passingPercent,
    totalQuestionPool,
  ]);

  const sectionsErrors = useMemo(() => {
    return sections.map((s) => {
      const title = s.title.trim() ? "" : "Section title is required.";
      const questions = (s.quiz?.questions || []).map((q) => {
        const prompt = q.prompt.trim() ? "" : "Question prompt is required.";
        const optionsTextErr = q.options.map((o) =>
          o.text?.trim() ? "" : "Option text is required."
        );
        const correctCount = q.options.filter((o) => o.isCorrect).length;
        const correctErr =
          correctCount === 1 ? "" : "Mark exactly one option as correct.";
        return { prompt, optionsTextErr, correctErr };
      });
      return { title, questions };
    });
  }, [sections]);

  const hasMetaOnlyErr =
    !!metaErrors.course || !!metaErrors.title || !!metaErrors.order;

  const hasAssessmentErr = !!metaErrors.poolSize || !!metaErrors.passingPercent;

  const hasSectionsErr = sectionsErrors.some(
    (se) =>
      se.title ||
      se.questions.some(
        (q) => q.prompt || q.correctErr || q.optionsTextErr.some(Boolean)
      )
  );

  // ---------- Section helpers ----------
  const handleAddSection = () =>
    setSections((prev) => [...prev, emptySection()]);
  const handleRemoveSection = (idx) =>
    setSections((prev) => prev.filter((_, i) => i !== idx));
  const updateSection = (idx, patch) =>
    setSections((prev) =>
      prev.map((s, i) => (i === idx ? { ...s, ...patch } : s))
    );

  const addQuestion = (sIdx) =>
    updateSection(sIdx, {
      quiz: {
        ...(sections[sIdx].quiz || {}),
        questions: [...(sections[sIdx].quiz?.questions || []), emptyQuestion()],
      },
    });

  const updateQuestion = (sIdx, qIdx, patch) => {
    const qs = [...(sections[sIdx].quiz?.questions || [])];
    qs[qIdx] = { ...qs[qIdx], ...patch };
    updateSection(sIdx, {
      quiz: { ...(sections[sIdx].quiz || {}), questions: qs },
    });
  };

  const removeQuestion = (sIdx, qIdx) => {
    const qs = [...(sections[sIdx].quiz?.questions || [])];
    qs.splice(qIdx, 1);
    updateSection(sIdx, {
      quiz: { ...(sections[sIdx].quiz || {}), questions: qs },
    });
  };

  const toggleCorrectOption = (sIdx, qIdx, optIdx) => {
    const question = sections[sIdx].quiz.questions[qIdx];
    const opts = question.options.map((o, i) => ({
      ...o,
      isCorrect: i === optIdx,
    }));
    updateQuestion(sIdx, qIdx, { options: opts });
  };

  // ---------- Excel import/export (same pattern) ----------
  const handleExcelDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer?.files?.[0];
    if (file) handleExcelUpload(file);
  };

  const parseRowsToSections = (rows) => {
    const byTitle = new Map();
    let questionsAdded = 0;
    let rowsSkipped = 0;
    const getPrompt = (row) => row.QuizPrompt || row.QuestionPrompt || "";

    rows.forEach((row) => {
      const title = String(row.SectionTitle || "").trim();
      const lesson = String(row.LessonContent || "").trim();
      if (!title && !getPrompt(row)) {
        rowsSkipped++;
        return;
      }
      if (!title) {
        rowsSkipped++;
        return;
      }

      if (!byTitle.has(title)) {
        byTitle.set(title, {
          title,
          images: [],
          videos: [],
          content: lesson,
          quiz: { questions: [] },
        });
      }
      const section = byTitle.get(title);
      if (lesson && lesson.length > (section.content?.length || 0)) {
        section.content = lesson;
      }

      const prompt = getPrompt(row).trim();
      if (!prompt) return; // allow lesson-only rows

      const correct = String(row.CorrectAnswer || "")
        .trim()
        .toUpperCase();
      const points =
        Number.isFinite(Number(row.Points)) && Number(row.Points) > 0
          ? Number(row.Points)
          : 1;

      section.quiz.questions.push({
        prompt,
        options: [
          { text: row.OptionA || "", isCorrect: correct === "A" },
          { text: row.OptionB || "", isCorrect: correct === "B" },
          { text: row.OptionC || "", isCorrect: correct === "C" },
          { text: row.OptionD || "", isCorrect: correct === "D" },
        ],
        points,
      });
      questionsAdded++;
    });

    return {
      sections: Array.from(byTitle.values()),
      questionsAdded,
      rowsSkipped,
    };
  };

  const handleExcelUpload = (file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
      const {
        sections: parsed,
        questionsAdded,
        rowsSkipped,
      } = parseRowsToSections(rows);
      setParsedSectionsDraft(parsed);

      if (sections.length > 0) {
        setImportSummary({
          sectionsAdded: parsed.length,
          sectionsUpdated: 0,
          questionsAdded,
          rowsSkipped,
        });
        setMergeDialogOpen(true);
      } else {
        setSections(parsed);
        setShowErr((p) => ({ ...p, sections: true }));
        setSnackbar({
          open: true,
          message: `Imported ${
            parsed.length
          } section(s), ${questionsAdded} question(s). ${
            rowsSkipped ? rowsSkipped + " row(s) skipped." : ""
          }`,
          severity: "success",
        });
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const mergeSections = (existing, incoming) => {
    const byTitle = new Map(
      existing.map((s) => [s.title.trim().toLowerCase(), s])
    );
    let sectionsAdded = 0;
    let sectionsUpdated = 0;
    let questionsAdded = 0;

    incoming.forEach((inc) => {
      const key = inc.title.trim().toLowerCase();
      if (!byTitle.has(key)) {
        byTitle.set(key, { ...inc });
        sectionsAdded++;
        questionsAdded += inc.quiz?.questions?.length || 0;
      } else {
        const cur = byTitle.get(key);
        if ((inc.content?.length || 0) > (cur.content?.length || 0))
          cur.content = inc.content;
        const incQs = inc.quiz?.questions || [];
        cur.quiz = cur.quiz || { questions: [] };
        cur.quiz.questions = [...(cur.quiz.questions || []), ...incQs];
        questionsAdded += incQs.length;
        sectionsUpdated++;
      }
    });

    return {
      merged: Array.from(byTitle.values()),
      sectionsAdded,
      sectionsUpdated,
      questionsAdded,
    };
  };

  const handleConfirmImport = (mode) => {
    if (!parsedSectionsDraft.length) {
      setMergeDialogOpen(false);
      return;
    }

    if (mode === "replace") {
      const qAdded = parsedSectionsDraft.reduce(
        (n, s) => n + (s.quiz?.questions?.length || 0),
        0
      );
      setSections(parsedSectionsDraft);
      setSnackbar({
        open: true,
        message: `Replaced with ${parsedSectionsDraft.length} section(s), ${qAdded} question(s).`,
        severity: "success",
      });
    } else {
      const { merged, sectionsAdded, sectionsUpdated, questionsAdded } =
        mergeSections(sections, parsedSectionsDraft);
      setSections(merged);
      setSnackbar({
        open: true,
        message: `Merged: ${sectionsAdded} new, ${sectionsUpdated} updated, ${questionsAdded} question(s) added.`,
        severity: "success",
      });
    }
    setShowErr((p) => ({ ...p, sections: true }));
    setMergeDialogOpen(false);
    setParsedSectionsDraft([]);
  };

  const downloadTemplateXlsx = () => {
    const headers = [
      "SectionTitle",
      "LessonContent",
      "QuizPrompt",
      "QuestionPrompt",
      "OptionA",
      "OptionB",
      "OptionC",
      "OptionD",
      "CorrectAnswer",
      "Points",
    ];
    const sampleRows = [
      {
        SectionTitle: "What Responsible Service Means",
        LessonContent:
          "Responsible alcohol service means serving alcohol safely, legally, and ethically...",
        QuizPrompt:
          "What is the best definition of responsible alcohol service?",
        QuestionPrompt: "",
        OptionA: "Serving as many drinks as customers want",
        OptionB: "Serving alcohol safely, legally, and ethically",
        OptionC: "Making drinks as fast as possible",
        OptionD: "Offering discounts on strong drinks",
        CorrectAnswer: "B",
        Points: 1,
      },
    ];
    const ws = XLSX.utils.json_to_sheet(sampleRows, { header: headers });
    ws["!cols"] = [28, 80, 46, 46, 22, 22, 22, 22, 16, 10].map((wch) => ({
      wch,
    }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "ModuleTemplate");
    XLSX.writeFile(wb, "Tipsyverse_Module_Template.xlsx");
  };

  // ---------- Save ----------
  const handleSave = () => {
    const module = {
      title: moduleTitle.trim(),
      description: moduleDescription.trim(),
      order: Number(moduleOrder) || 0,
      poolSize: Number(poolSize) || 0,
      passingPercent: Number(passingPercent) || 0,
      sections: sections.map((s) => ({
        title: s.title,
        // media: [
        //   ...(s.images || []).map((m) => ({
        //     kind: "image",
        //     url: m.url,
        //     publicId: m.publicId,
        //   })),
        //   ...(s.videos || []).map((m) => ({
        //     kind: "video",
        //     url: m.url,
        //     publicId: m.publicId,
        //     durationSec: m.durationSec,
        //   })),
        // ],
        images: (s.images || []).map(m => ({ url: m.url, publicId: m.publicId })),
        videos: (s.videos || []).map(m => ({ url: m.url, publicId: m.publicId, durationSec: m.durationSec })),
        content: s.content,
        quiz: {
          questions: (s.quiz?.questions || []).map((q) => ({
            prompt: q.prompt,
            options: q.options,
            points: q.points || 1,
          })),
        },
      })),
    };

    onSaved?.({
      mode, // ← include this
      courseId,
      module,
      moduleIndex, // only relevant for edit
      moduleId: initialModule?._id,
    });
  };

  const handleCloseSnackbar = (_, reason) => {
    if (reason === "clickaway") return;
    setSnackbar((s) => ({ ...s, open: false }));
  };

  // ---------- UI ----------
  const StepActions = (
    <Stack direction="row" justifyContent="space-between" sx={{ mt: 2 }}>
      <Button
        startIcon={<ArrowBack />}
        disabled={activeStep === 0}
        onClick={() => setActiveStep((s) => Math.max(0, s - 1))}
      >
        Back
      </Button>

      {activeStep < steps.length - 1 ? (
        <Button
          variant="contained"
          onClick={() => {
            if (activeStep === 0) {
              setShowErr((p) => ({ ...p, meta: true }));
              if (hasMetaOnlyErr) return;
            }
            if (activeStep === 1) {
              setShowErr((p) => ({ ...p, sections: true }));
              if (hasSectionsErr) return;
            }
            if (activeStep === 2) {
              setShowErr((p) => ({ ...p, meta: true })); // reveal assessment errors
              if (hasAssessmentErr) return;
            }
            setActiveStep((s) => s + 1);
          }}
        >
          Next
        </Button>
      ) : (
        <Stack direction="row" spacing={1}>
          {isEdit && typeof moduleIndex === "number" && onDelete && (
            <Button
              variant="outlined"
              color="error"
              startIcon={<DeleteOutline />}
              onClick={() => {
                setDeleteText("");
                setDeleteOpen(true);
              }}
            >
              Delete
            </Button>
          )}
          <Button
            variant="contained"
            startIcon={<Visibility />}
            onClick={() => setReviewOpen(true)}
          >
            Review
          </Button>
        </Stack>
      )}
    </Stack>
  );

  return (
    <Box
      sx={{
        p: 2,
        pb: 4,
        display: "flex",
        flexDirection: "column",
        height: "100%",
      }}
    >
      {/* Header */}
      <Box
        sx={{
          mb: 2,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Typography variant="h6">
          {isEdit ? "Edit Module" : "Add Module"}
        </Typography>
        <IconButton onClick={onClose}>
          <CloseIcon />
        </IconButton>
      </Box>

      <Stepper activeStep={activeStep} alternativeLabel sx={{ mb: 2 }}>
        {steps.map((label) => (
          <Step key={label}>
            <StepLabel StepIconProps={{
         sx: {
            color: 'grey',             // idle
            '&.Mui-active': { color: 'var(--primary-color) !important' },
            '&.Mui-completed': { color: 'var(--primary-color) !important' },
          },
        }}>{label}</StepLabel>
          </Step>
        ))}
      </Stepper>

      {/* Content */}
      <Box sx={{ flexGrow: 1, overflowY: "auto", pr: 1 }}>
        {/* Step 1: Module meta */}
        {activeStep === 0 && (
          <Stack spacing={2} sx={{ maxWidth: 640 }}>
            <TextField
              select
              label="Course"
              value={courseId}
              onChange={(e) => setCourseId(e.target.value)}
              required
              error={showErr.meta && !!metaErrors.course}
              helperText={showErr.meta ? metaErrors.course : ""}
            >
              {courses.map((c) => (
                <MenuItem key={c._id} value={c._id}>
                  {c.title}
                  {c.tags?.length ? (
                    <span style={{ marginLeft: 8, opacity: 0.7 }}>
                      • {c.tags.slice(0, 2).join(", ")}
                      {c.tags.length > 2 ? "…" : ""}
                    </span>
                  ) : null}
                </MenuItem>
              ))}
            </TextField>

            <TextField
              label="Module Title"
              value={moduleTitle}
              onChange={(e) => setModuleTitle(e.target.value)}
              required
              error={showErr.meta && !!metaErrors.title}
              helperText={showErr.meta ? metaErrors.title : ""}
              fullWidth
            />

            <TextField
              label="Short Description"
              placeholder="One- or two-sentence summary of this module"
              value={moduleDescription}
              onChange={(e) => setModuleDescription(e.target.value)}
              multiline
              minRows={2}
              fullWidth
            />

            {isEdit && (
              <TextField
                type="number"
                label="Module Order"
                value={moduleOrder}
                onChange={(e) =>
                  setModuleOrder(Math.max(0, Number(e.target.value || 0)))
                }
                error={showErr.meta && !!metaErrors.order}
                helperText={
                  showErr.meta
                    ? metaErrors.order
                    : "Lower numbers appear first."
                }
                sx={{ maxWidth: 240 }}
              />
            )}
          </Stack>
        )}

        {/* Step 2: Sections (same UX you had) */}
        {activeStep === 1 && (
          <Stack spacing={2}>
            <Stack
              direction={{ xs: "column", sm: "row" }}
              alignItems={{ xs: "stretch", sm: "center" }}
              justifyContent="space-between"
              spacing={1}
            >
              <Typography variant="subtitle1">Sections</Typography>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                <Button
                  startIcon={<DownloadIcon />}
                  onClick={downloadTemplateXlsx}
                  variant="outlined"
                  size="small"
                >
                  Download Template
                </Button>
                <Button
                  startIcon={<UploadFileIcon />}
                  onClick={() => fileInputRef.current?.click()}
                  variant="outlined"
                  size="small"
                >
                  Import Excel
                </Button>
                {sections.length !== 0 && (
                  <Button
                    startIcon={<DeleteSweepIcon />}
                    color="error"
                    variant="outlined"
                    size="small"
                    onClick={() => setClearAllOpen(true)}
                  >
                    Clear All Sections
                  </Button>
                )}
                <Button
                  startIcon={<Add />}
                  onClick={handleAddSection}
                  variant="contained"
                  size="small"
                >
                  Add Section Manually
                </Button>
              </Stack>
            </Stack>

            {sections.length === 0 && (
              <Typography variant="body2" color="text.secondary">
                No sections yet. Click “Add Section” or import from Excel to
                begin.
              </Typography>
            )}

            <Box
              sx={{
                border: "2px dashed #ccc",
                borderRadius: 2,
                p: 2,
                textAlign: "center",
                cursor: "pointer",
                bgcolor: "grey.50",
              }}
              onClick={() => fileInputRef.current?.click()}
              onDrop={handleExcelDrop}
              onDragOver={(e) => e.preventDefault()}
            >
              <Typography variant="body2">
                Drag & Drop Excel here or click to upload multiple sections at
                once
              </Typography>
              <input
                type="file"
                accept=".xlsx, .xls"
                style={{ display: "none" }}
                ref={fileInputRef}
                onChange={(e) =>
                  e.target.files?.[0] && handleExcelUpload(e.target.files[0])
                }
              />
            </Box>

            {sections.map((s, idx) => {
              const errs = sectionsErrors[idx] || {};
              return (
                <Box
                  key={idx}
                  sx={{
                    p: 2,
                    border: "1px solid",
                    borderColor: "divider",
                    borderRadius: 2,
                  }}
                >
                  <Stack spacing={2}>
                    <Stack
                      direction="row"
                      justifyContent="space-between"
                      alignItems="center"
                    >
                      <TextField
                        label={`Section ${idx + 1} Title`}
                        value={s.title}
                        onChange={(e) =>
                          updateSection(idx, { title: e.target.value })
                        }
                        fullWidth
                        error={showErr.sections && !!errs.title}
                        helperText={showErr.sections ? errs.title : ""}
                      />
                      <Tooltip title="Remove section">
                        <IconButton
                          color="error"
                          onClick={() => handleRemoveSection(idx)}
                        >
                          <DeleteOutline />
                        </IconButton>
                      </Tooltip>
                    </Stack>

                    <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                      <TextField
                        label="Add Image URL"
                        placeholder="https://..."
                        value=""
                        onChange={() => {}}
                        helperText="Hook up your media uploader here"
                        fullWidth
                      />
                      <TextField
                        label="Add Video URL"
                        placeholder="https://..."
                        value=""
                        onChange={() => {}}
                        helperText="Hook up your media uploader here"
                        fullWidth
                      />
                    </Stack>

                    <Wysiwyg
                      label="Content"
                      value={s.content}
                      onChange={(val) => updateSection(idx, { content: val })}
                    />

                    <Divider />

                    <Stack direction="row" spacing={1} alignItems="center">
                      <PlaylistAdd fontSize="small" />
                      <Typography variant="subtitle2">
                        Quiz (Multiple-choice)
                      </Typography>
                      <Chip
                        size="small"
                        sx={{ ml: 1 }}
                        label={`${s.quiz?.questions?.length || 0} questions`}
                      />
                      <Button
                        size="small"
                        startIcon={<Add />}
                        onClick={() => addQuestion(idx)}
                      >
                        Add Question
                      </Button>
                    </Stack>

                    {(s.quiz?.questions || []).map((q, qIdx) => {
                      const qErrs = errs.questions?.[qIdx] || {};
                      return (
                        <Box
                          key={qIdx}
                          sx={{
                            p: 1.5,
                            border: "1px dashed",
                            borderColor: "divider",
                            borderRadius: 1.5,
                          }}
                        >
                          <Stack spacing={1.5}>
                            <Stack
                              direction="row"
                              alignItems="center"
                              justifyContent="space-between"
                            >
                              <TextField
                                label={`Q${qIdx + 1} Prompt`}
                                value={q.prompt}
                                onChange={(e) =>
                                  updateQuestion(idx, qIdx, {
                                    prompt: e.target.value,
                                  })
                                }
                                fullWidth
                                error={showErr.sections && !!qErrs.prompt}
                                helperText={
                                  showErr.sections ? qErrs.prompt : ""
                                }
                              />
                              <Tooltip title="Remove question">
                                <IconButton
                                  color="error"
                                  onClick={() => removeQuestion(idx, qIdx)}
                                >
                                  <DeleteOutline />
                                </IconButton>
                              </Tooltip>
                            </Stack>

                            <Stack spacing={1}>
                              {q.options.map((opt, optIdx) => (
                                <Stack
                                  key={optIdx}
                                  direction="row"
                                  spacing={1}
                                  alignItems="center"
                                >
                                  <TextField
                                    label={`Option ${optIdx + 1}`}
                                    value={opt.text}
                                    onChange={(e) => {
                                      const newOpts = [...q.options];
                                      newOpts[optIdx] = {
                                        ...opt,
                                        text: e.target.value,
                                      };
                                      updateQuestion(idx, qIdx, {
                                        options: newOpts,
                                      });
                                    }}
                                    fullWidth
                                    required
                                    error={
                                      showErr.sections &&
                                      !!qErrs.optionsTextErr?.[optIdx]
                                    }
                                    helperText={
                                      showErr.sections
                                        ? qErrs.optionsTextErr?.[optIdx]
                                        : ""
                                    }
                                  />
                                  <Tooltip title="Mark as correct">
                                    <IconButton
                                      color={
                                        opt.isCorrect ? "success" : "default"
                                      }
                                      onClick={() =>
                                        toggleCorrectOption(idx, qIdx, optIdx)
                                      }
                                    >
                                      <CheckCircle />
                                    </IconButton>
                                  </Tooltip>
                                </Stack>
                              ))}
                            </Stack>

                            {showErr.sections && qErrs.correctErr && (
                              <Typography
                                color="warning.main"
                                variant="caption"
                              >
                                {qErrs.correctErr}
                              </Typography>
                            )}

                            <TextField
                              type="number"
                              label="Points"
                              value={q.points || 1}
                              onChange={(e) =>
                                updateQuestion(idx, qIdx, {
                                  points: Math.max(
                                    0,
                                    Number(e.target.value || 1)
                                  ),
                                })
                              }
                              sx={{ maxWidth: 140 }}
                            />
                          </Stack>
                        </Box>
                      );
                    })}
                  </Stack>
                </Box>
              );
            })}
          </Stack>
        )}

        {activeStep === 2 && (
          <Stack>
            <Typography variant="subtitle2">Assessment Settings</Typography>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <TextField
                type="number"
                label="Question Pool Size"
                value={poolSize}
                onChange={(e) =>
                  setPoolSize(Math.max(0, Number(e.target.value || 0)))
                }
                error={showErr.meta && !!metaErrors.poolSize}
                helperText={
                  showErr.meta
                    ? metaErrors.poolSize
                    : `0 means use all ${totalQuestionPool} questions.`
                }
                sx={{ maxWidth: 240 }}
              />
              <TextField
                type="number"
                label="Passing Percentage"
                value={passingPercent}
                onChange={(e) =>
                  setPassingPercent(
                    Math.max(0, Math.min(100, Number(e.target.value || 0)))
                  )
                }
                error={showErr.meta && !!metaErrors.passingPercent}
                helperText={
                  showErr.meta
                    ? metaErrors.passingPercent
                    : "Required score to pass (0–100)."
                }
                sx={{ maxWidth: 240 }}
              />
            </Stack>
          </Stack>
        )}

        {/* Step 3: Review */}
        {activeStep === 3 && (
          <Stack spacing={2}>
            {(hasMetaOnlyErr || hasSectionsErr) && (
              <Box
                sx={{
                  p: 1.5,
                  borderRadius: 1.5,
                  bgcolor: "warning.light",
                  color: "warning.contrastText",
                }}
              >
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  Please fix the issues below before saving.
                </Typography>
                <Stack spacing={0.5} sx={{ mt: 0.5 }}>
                  {hasMetaOnlyErr && (
                    <>
                      {metaErrors.course && (
                        <Typography variant="body2">
                          • {metaErrors.course}
                        </Typography>
                      )}
                      {metaErrors.title && (
                        <Typography variant="body2">
                          • {metaErrors.title}
                        </Typography>
                      )}
                      {metaErrors.order && (
                        <Typography variant="body2">
                          • {metaErrors.order}
                        </Typography>
                      )}
                    </>
                  )}
                  {hasSectionsErr && (
                    <Typography variant="body2">
                      • Some sections/questions have validation errors.
                    </Typography>
                  )}
                </Stack>
              </Box>
            )}

            <Box sx={{ p: 2, bgcolor: "grey.50", borderRadius: 2 }}>
              <Typography variant="body2">
                <b>Course:</b>{" "}
                {courses.find((c) => c._id === courseId)?.title || "-"}
              </Typography>
              <Typography variant="body2">
                <b>Module Title:</b> {moduleTitle || "-"}
              </Typography>
              
              <Typography variant="body2">
                <b>Sections:</b> {sections.length}
              </Typography>
              <Typography variant="body2">
                <b>Total Question Pool:</b> {totalQuestionPool}
              </Typography>
              <Typography variant="body2">
                <b>Pool Size:</b> {poolSize || totalQuestionPool}{" "}
                {poolSize ? "" : "(all questions)"}
              </Typography>
              <Typography variant="body2">
                <b>Passing %:</b> {passingPercent}%
              </Typography>
            </Box>

            {isEdit && typeof moduleIndex === "number" && (
              <>
                <Divider />
                <Typography variant="subtitle1">Activity Log</Typography>
                <ActivityLogsTable entityModel="Course" entityId={courseId} />
              </>
            )}
          </Stack>
        )}
      </Box>

      {StepActions}

      {/* Review dialog */}
      <Dialog
        open={reviewOpen}
        onClose={() => setReviewOpen(false)}
        fullWidth
        maxWidth="md"
      >
        <DialogTitle>Review Module</DialogTitle>
        <DialogContent dividers>
          <Typography variant="subtitle2" gutterBottom>
            Meta
          </Typography>
          <Typography variant="body2">
            <b>Course:</b>{" "}
            {courses.find((c) => c._id === courseId)?.title || "-"}
          </Typography>
          <Typography variant="body2">
            <b>Module Title:</b> {moduleTitle || "-"}
          </Typography>
          <Typography variant="body2">
            <b>Description:</b> {moduleDescription || "-"}
          </Typography>
          <Divider sx={{ my: 1.5 }} />
          <Typography variant="subtitle2" gutterBottom>
            Assessment
          </Typography>
          <Typography variant="body2">
            <b>Total Question Pool:</b> {totalQuestionPool}
          </Typography>
          <Typography variant="body2">
            <b>Pool Size:</b> {poolSize || totalQuestionPool}{" "}
            {poolSize ? "" : "(all questions)"}
          </Typography>
          <Typography variant="body2">
            <b>Passing %:</b> {passingPercent}%
          </Typography>

          <Typography variant="subtitle2" gutterBottom>
            Sections
          </Typography>
          {sections.map((s, i) => (
            <Box key={i} sx={{ mb: 1.5 }}>
              <Typography variant="body2">
                <b>
                  {i + 1}. {s.title || "(Untitled section)"}
                </b>
              </Typography>
              <Typography
                variant="caption"
                sx={{ display: "block", color: "text.secondary", mb: 1 }}
              >
                Images: {s.images?.length || 0} • Videos:{" "}
                {s.videos?.length || 0} • Questions:{" "}
                {s.quiz?.questions?.length || 0}
              </Typography>

              {/* Questions */}
              {(s.quiz?.questions || []).map((q, qi) => (
                <Box key={qi} sx={{ pl: 1.5, mb: 1 }}>
                  <Typography variant="body2" sx={{ mb: 0.5 }}>
                    <b>Q{qi + 1}.</b> {q.prompt || "(No prompt)"}
                  </Typography>
                  {(q.options || []).map((opt, oi) => {
                    const correct = !!opt.isCorrect;
                    return (
                      <Stack
                        key={oi}
                        direction="row"
                        alignItems="center"
                        spacing={0.75}
                        sx={{ ml: 1 }}
                      >
                        {correct && (
                          <CheckCircle fontSize="small" color="success" />
                        )}
                        <Typography
                          variant="body2"
                          sx={{
                            color: correct ? "success.main" : "text.secondary",
                            fontWeight: correct ? 600 : 400,
                          }}
                        >
                          {String.fromCharCode(65 + oi)}.{" "}
                          {opt.text || "(empty)"}
                        </Typography>
                      </Stack>
                    );
                  })}
                </Box>
              ))}
            </Box>
          ))}
        </DialogContent>
        <DialogActions>
          <Button variant="outlined" onClick={() => setReviewOpen(false)}>
            Close
          </Button>
          <Button
            variant="contained"
            startIcon={<SaveIcon />}
            onClick={() => {
              setReviewOpen(false);
              handleSave();
            }}
            disabled={hasMetaOnlyErr || hasAssessmentErr || hasSectionsErr}
          >
            Save
          </Button>
        </DialogActions>
      </Dialog>

      {/* Import merge/replace */}
      <Dialog open={mergeDialogOpen} onClose={() => setMergeDialogOpen(false)}>
        <DialogTitle>Import Excel</DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2" sx={{ mb: 1 }}>
            {importSummary.rowsSkipped
              ? `${importSummary.rowsSkipped} row(s) skipped (missing SectionTitle and/or Prompt).`
              : "File parsed successfully."}
          </Typography>
          <Typography variant="body2">
            Incoming: <b>{parsedSectionsDraft.length}</b> section(s),{" "}
            <b>
              {parsedSectionsDraft.reduce(
                (n, s) => n + (s.quiz?.questions?.length || 0),
                0
              )}
            </b>{" "}
            question(s).
          </Typography>
          <Typography variant="body2" sx={{ mt: 1 }}>
            Existing module currently has <b>{sections.length}</b> section(s).
          </Typography>
          <Divider sx={{ my: 1.5 }} />
          <Typography variant="body2" component="div">
            Choose how to apply import:
            <ul style={{ marginTop: 6 }}>
              <li>
                <b>Replace</b>: overwrite all current sections.
              </li>
              <li>
                <b>Merge</b>: add new sections and append questions to matching
                section titles.
              </li>
            </ul>
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setMergeDialogOpen(false)}>Cancel</Button>
          <Button
            color="warning"
            onClick={() => handleConfirmImport("replace")}
          >
            Replace
          </Button>
          <Button
            variant="contained"
            onClick={() => handleConfirmImport("merge")}
          >
            Merge
          </Button>
        </DialogActions>
      </Dialog>

      {/* Clear all sections */}
      <Dialog
        open={clearAllOpen}
        onClose={() => setClearAllOpen(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <WarningAmberIcon color="warning" /> Clear all sections?
        </DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2">
            This will remove <b>all</b> sections and their questions from the
            module. This action can’t be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setClearAllOpen(false)}>Cancel</Button>
          <Button
            color="error"
            variant="contained"
            onClick={() => {
              setSections([]);
              setSnackbar({
                open: true,
                message: "All sections cleared.",
                severity: "info",
              });
              setClearAllOpen(false);
            }}
          >
            Clear All
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete module */}
      <Dialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Delete module?</DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2" sx={{ mb: 1 }}>
            Are you sure you want to delete this module from the course? This
            action cannot be undone.
          </Typography>
          <Typography variant="body2" sx={{ mb: 2 }}>
            Please type the module title to confirm: <b>{moduleTitle}</b>
          </Typography>
          <TextField
            autoFocus
            fullWidth
            label="Type module title exactly"
            value={deleteText}
            onChange={(e) => setDeleteText(e.target.value)}
            placeholder={moduleTitle}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteOpen(false)}>Cancel</Button>
          <Button
            color="error"
            variant="contained"
            disabled={(deleteText || "").trim() !== (moduleTitle || "").trim()}
            onClick={() => {
              setDeleteOpen(false);
              onDelete?.({
                courseId,
                moduleIndex,
                moduleId: initialModule?._id,
              });
            }}
          >
            Confirm delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          onClose={handleCloseSnackbar}
          severity={snackbar.severity}
          sx={{ width: "100%" }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default AdminModuleForm;
