// screens/LearningCourseScreen.jsx
import {
  Box,
  Button,
  Chip,
  Container,
  Paper,
  Stack,
  Typography,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  IconButton,
  Tooltip,
  Alert,
  RadioGroup,
  FormControlLabel,
  Radio,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  LinearProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from "@mui/material";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import PlayCircleOutlineIcon from "@mui/icons-material/PlayCircleOutline";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import SchoolOutlinedIcon from "@mui/icons-material/SchoolOutlined";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import VolumeUpIcon from "@mui/icons-material/VolumeUp";
import VolumeOffIcon from "@mui/icons-material/VolumeOff";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";

import { useDispatch, useSelector } from "react-redux";
import { useParams, useNavigate } from "react-router-dom";
import { useEffect, useMemo, useCallback, useState, useRef } from "react";

import AuthLayout from "../../components/PublicLayout/PublicLayout";
import HelmetHeader from "../../components/HelmetHeader/Helmet";
import { fetchCourseBySlug } from "../../features/courses/courseSlice";
import {
  fetchOrCreateProgress,
  fetchProgressBySlug,
} from "../../features/courseProgresses/courseProgressSlice";
import api from "../../services/api";
import { RadioButtonChecked, RadioButtonUnchecked } from "@mui/icons-material";
import CircularProgressRing from "../../components/CircularProgressRing/CircularProgressRing";
import { fetchMe, fetchMyBartenderInfo } from "../../features/users/userSlice";
import { fetchAvailableEvents } from "../../features/events/eventSlice";

/* ╔════════════════════════════════════════════════════════════════╗
   ║                         UTILITIES & UI                         ║
   ╚════════════════════════════════════════════════════════════════╝ */
const EMPTY_ARR = Object.freeze([]);
const titleCase = (s = "") =>
  s.replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase());


/** Minimal, consistent card wrapper. */
const Card = ({ children, sx }) => (
  <Paper
    elevation={0}
    sx={{
      p: 2.5,
      borderRadius: 3,
      border: "1px solid",
      borderColor: "divider",
      width: "100%",
      ...sx,
    }}
  >
    {children}
  </Paper>
);

/* ── Course helpers ─────────────────────────────────────────────── */
function sortModules(mods = []) {
  return (mods || [])
    .map((m, i) => ({
      ...m,
      order: Number.isFinite(m.moduleOrder)
        ? m.moduleOrder
        : Number.isFinite(m.order)
        ? m.order
        : i,
    }))
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

/** Compute module states (completed/inProgress/locked, section counts). */
/** Compute module states (completed/inProgress/locked, section counts).
 *  IMPORTANT: A module is only "completed" when its quiz is PASSED.
 *  Finishing all sections alone does NOT complete/unlock the next module.
 */
function computeModuleStates(course, progress) {
  const mods = sortModules(course?.modules || []);
  const pm = new Map(
    (progress?.modules || []).map((m) => [String(m.moduleId), m])
  );

  let lockRest = false;

  return mods.map((m) => {
    const mp = pm.get(String(m._id));
    const totalSections = (m.sections || []).length;

    // how many sections the learner has finished (for UI + enabling quiz)
    const completedSections = mp
      ? (mp.sections || []).filter((s) => !!s.completedAt).length
      : 0;

    // quiz pass status
    const passed = !!mp?.passed;

    // sequential gating: after the first module that is NOT passed,
    // everything after it is locked.
    if (!passed && !lockRest) lockRest = true;

    // status fallback if backend didn't set one
    let status = mp?.status;
    if (!status) status = lockRest ? "locked" : "in_progress";

    // ❗️ONLY consider the module completed when the quiz is passed
    const completed = passed;

    return {
      module: m,
      totalSections,
      passedCount: completedSections, // sections completed (for "x/y sections" and quiz readiness)
      completed, // only true if quiz passed
      passed, // explicit flag for convenience
      inProgress: status === "in_progress",
      locked: status === "locked",
    };
  });
}

function getFirstIncompleteSectionIndex(mod, moduleProgress) {
  const doneIds = new Set(
    (moduleProgress?.sections || [])
      .filter((sp) => !!sp.completedAt)
      .map((sp) => String(sp.sectionId))
  );
  return (mod?.sections || []).findIndex((s) => !doneIds.has(String(s._id)));
}

/* ── Quiz helpers: seeded shuffle & sample ──────────────────────── */
function randFromSeed(seed) {
  // simple deterministic PRNG (for UI shuffling)
  let x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}
function shuffleWithSeed(arr, seed) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(randFromSeed(seed + i) * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function sampleQuestions(pool = [], poolSize = 0, seed = Date.now()) {
  const shuffled = shuffleWithSeed(pool, seed);
  if (!poolSize || pool.length <= poolSize) return shuffled;
  return shuffled.slice(0, poolSize);
}

/* ╔════════════════════════════════════════════════════════════════╗
   ║                        MAIN COMPONENT                           ║
   ╚════════════════════════════════════════════════════════════════╝ */
const LearningCourseScreen = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();

  /* State — keep all useStates together */
  const [starting, setStarting] = useState(false);
  const [moduleDetail, setModuleDetail] = useState(null);
  const [loadingModule, setLoadingModule] = useState(false);
  const [activeStep, setActiveStep] = useState(0); // 0=Overview, 1..n=sections, last=quiz
  const [speaking, setSpeaking] = useState(false);
  const [quizAnswers, setQuizAnswers] = useState({});
  const [quizResult, setQuizResult] = useState(null);
  const [submittingQuiz, setSubmittingQuiz] = useState(false);
  const [quizSeed, setQuizSeed] = useState(1); // increment to reshuffle a new attempt
  const [attemptQuestions, setAttemptQuestions] = useState([]); // concrete quiz for this attempt
  const [selectedModuleId, setSelectedModuleId] = useState(null); // manually picked module
  const prevModuleIdRef = useRef(null);
  const [showCongrats, setShowCongrats] = useState(false);
  const shownCongratsRef = useRef(false);

  /* Redux state */
  const { currentCourse: course, status: courseStatus } = useSelector(
    (s) => s.courses || {}
  );
  const { current: progress, status: progStatus } = useSelector(
    (s) => s.courseProgress || {}
  );

  /* Effects — data loading first */
  useEffect(() => {
    if (!slug) return;
    dispatch(fetchCourseBySlug(slug));
    dispatch(fetchProgressBySlug({ slug, create: false, light: true }));
  }, [slug, dispatch]);

  /* Derived data — keep memos together */
  const loading = courseStatus === "loading" || progStatus === "loading";
  const modules = useMemo(() => sortModules(course?.modules || []), [course]);
  const moduleStates = useMemo(
    () => (course ? computeModuleStates(course, progress) : []),
    [course, progress]
  );

  const overall = useMemo(() => {
    const total = progress?.totalModules ?? modules.length ?? 0;
    const done = progress?.modulesCompleted ?? 0;
    const percent = total ? (done / total) * 100 : 0;
    return { total, done, percent };
  }, [progress, modules]);

  const hasProgress = !!(
    progress &&
    (progress.sections?.length >= 0 ||
      progress.modulesCompleted >= 0 ||
      progress.status === "in_progress" ||
      progress.status === "completed")
  );

  /** Which module is currently shown:
   *  - user selection if any
   *  - else first incomplete
   *  - else the first module
   */
  const currentModuleId = useMemo(() => {
    if (selectedModuleId) return selectedModuleId;
    if (progress?.currentModuleId) return progress.currentModuleId;
    const firstIncomplete = moduleStates.find((ms) => !ms.completed)?.module
      ?._id;
    return firstIncomplete ?? modules[0]?._id ?? null;
  }, [selectedModuleId, progress?.currentModuleId, moduleStates, modules]);

  const moduleProgress = useMemo(() => {
    if (!progress?.modules || !currentModuleId) return null;
    return (
      progress.modules.find(
        (m) => String(m.moduleId) === String(currentModuleId)
      ) || null
    );
  }, [progress?.modules, currentModuleId]);

  const sectionProgressById = useMemo(() => {
    const mps = moduleProgress?.sections || [];
    const map = new Map();
    mps.forEach((sp) => {
      map.set(String(sp.sectionId), {
        startedAt: sp.startedAt || null,
        completedAt: sp.completedAt || null,
      });
    });
    return map;
  }, [moduleProgress?.sections]);

  /* Build moduleDetail & starting step whenever module/progress changes */
  useEffect(() => {
    if (!currentModuleId || !course) return;
    setLoadingModule(true);
    try {
      const mod = modules.find(
        (m) => String(m._id) === String(currentModuleId)
      );
      const det = {
        module: mod || null,
        quiz: mod?.quiz || null,
        progress: progress || {},
      };
      setModuleDetail(det);

      // Reset to Overview ONLY when switching modules
      if (prevModuleIdRef.current !== currentModuleId) {
        setActiveStep(0);
        prevModuleIdRef.current = currentModuleId;
      }
    } finally {
      setLoadingModule(false);
    }
  }, [currentModuleId, course, modules, progress]);

  //   useEffect(() => {
  //   if (!selectedModuleId) return;
  //   const st = moduleStates.find(
  //     (ms) => String(ms.module._id) === String(selectedModuleId)
  //   );
  //   if (st?.completed) setSelectedModuleId(null);
  // }, [moduleStates, selectedModuleId]);

  /* Section + Quiz derived info */
  const sections = useMemo(
    () => moduleDetail?.module?.sections ?? EMPTY_ARR,
    [moduleDetail?.module?.sections]
  );

  const currentSectionId = useMemo(() => {
    const total = sections.length;
    const isOverview = activeStep === 0;
    const isQuiz = activeStep === total + 1;
    if (isOverview || isQuiz) return null;
    return sections[activeStep - 1]?._id || null;
  }, [sections, activeStep]);

  const quizInfo = moduleDetail?.module?.quizInfo || {
    poolSize: 0,
    passingScorePct: 70,
  };
  const poolSize = Number(quizInfo.poolSize || 0);
  const passPercentRequired = Number(quizInfo.passingScorePct ?? 70);

  /* When we reach the Quiz step (last step), build one concrete attempt:
     - sample `poolSize` questions across all sections' question pools
     - store them in `attemptQuestions`
     - clear prior answers/result */
  useEffect(() => {
    const total = sections.length;
    const isQuiz = activeStep === total + 1;
    if (!isQuiz) return;

    const pool = sections.flatMap((s) => s?.quiz?.questions ?? EMPTY_ARR);
    const seed =
      quizSeed +
      (currentModuleId
        ? parseInt(
            String(currentModuleId).slice(-3).replace(/\D/g, "") || "0",
            10
          )
        : 0);
    const picked = sampleQuestions(pool, poolSize, seed);

    setAttemptQuestions(picked);
    setQuizAnswers({});
    setQuizResult(null);
  }, [activeStep, sections, poolSize, quizSeed, currentModuleId]);

  /* Web Speech API helpers */
  const canSpeak = typeof window !== "undefined" && "speechSynthesis" in window;
  const stopSpeaking = useCallback(() => {
    if (!canSpeak) return;
    window.speechSynthesis.cancel();
    setSpeaking(false);
  }, [canSpeak]);
  useEffect(() => () => stopSpeaking(), [stopSpeaking]);

  const toggleSpeak = useCallback(
    (section) => {
      if (!canSpeak || !section) return;
      if (speaking) return stopSpeaking();
      const text = `${section.title}. ${section.subtitle || ""}. ${
        section.content || ""
      }`;
      const u = new SpeechSynthesisUtterance(text);
      u.onend = () => setSpeaking(false);
      u.onerror = () => setSpeaking(false);
      setSpeaking(true);
      window.speechSynthesis.speak(u);
    },
    [canSpeak, speaking, stopSpeaking]
  );

  /* Progress API wiring */
  const refreshProgress = useCallback(() => {
    if (!slug) return;
    dispatch(fetchProgressBySlug({ slug, create: false, light: true }));
  }, [dispatch, slug]);

  const markSectionComplete = useCallback(
    async (sectionId) => {
      if (!course?._id || !sectionId) return;
      await api.post(
        `/course-progresses/${course._id}/sections/${sectionId}/content`,
        { fraction: 1 }
      );
      await refreshProgress();
      setActiveStep((s) => Math.min(s + 1, sections.length + 1)); // move forward
    },
    [course?._id, sections.length, refreshProgress]
  );

  const handleStartLeft = () => {
    const mod = moduleDetail?.module;
    const idx = getFirstIncompleteSectionIndex(mod, moduleProgress);
    // 0 = Overview, 1..n = sections, n+1 = Quiz
    const nextStep = idx >= 0 ? idx + 1 : (mod?.sections?.length || 0) + 1;
    setActiveStep(nextStep);
  };
  const handleBackLeft = () => {
    setActiveStep((s) => Math.max(s - 1, 0));
    stopSpeaking?.();
  };
  const handleNextLeft = async (section) => {
    if (section?._id) await markSectionComplete(section._id);
    stopSpeaking?.();
  };

  /* Quiz submit */

  const getQKey = (q, i, moduleId) =>
    String(q?._id ?? q?.id ?? `m${moduleId}-q${i}`);

  const getOptKey = (opt, oi, qKey) =>
    String(opt?._id ?? opt?.id ?? `${qKey}-o${oi}`);

  const submitQuiz = async () => {
    if (!course?._id || !attemptQuestions.length) return;
    setSubmittingQuiz(true);
    try {
      const pinnedModuleId = currentModuleId;
      let correct = 0;

      const gradedAnswers = attemptQuestions
        .map((q, i) => {
          const qKey = getQKey(q, i, currentModuleId);
          const pickedKey = quizAnswers[qKey];

          // find the picked option index by comparing keys/fallbacks
          const idx = (q.options || []).findIndex((opt, oi) => {
            const k = getOptKey(opt, oi, qKey);
            return k === pickedKey;
          });

          const isCorrect =
            idx >= 0 && (q.options || [])[idx]?.isCorrect === true;

          if (isCorrect) correct++;

          // send questionId when available; otherwise just the index
          return idx >= 0
            ? { questionId: q?._id ?? q?.id ?? null, selectedIndex: idx }
            : null;
        })
        .filter(Boolean);

      const total = attemptQuestions.length;
      const scorePct = total ? Math.round((correct / total) * 100) : 0;
      const passed = scorePct >= passPercentRequired;

      const quizSectionId =
        sections[sections.length - 1]?._id || sections[0]?._id || null;
      if (quizSectionId) {
        try {
          await api.post(
            `/course-progresses/${course._id}/sections/${quizSectionId}/quiz`,
            { answers: gradedAnswers }
          );
        } catch (err) {
          // Keep local grading available even if saving quiz progress fails.
        }
      }
      setQuizResult({ scorePct, passed });
      setSelectedModuleId(pinnedModuleId);
      await refreshProgress();
    } finally {
      setSubmittingQuiz(false);
    }
  };

  /* Course-level: start/create progress */
  const handleStart = useCallback(async () => {
    if (!slug || !course?._id) return;
    setStarting(true);
    try {
      await dispatch(
        fetchOrCreateProgress({ courseId: course._id, create: true })
      ).unwrap();
      navigate(`/learn/${course.slug}`);
      await refreshProgress();
    } finally {
      setStarting(false);
    }
  }, [slug, course, dispatch, navigate, refreshProgress]);

  // Fire confetti & open dialog when course completes
  useEffect(() => {
    if (progress?.status === "completed" && !shownCongratsRef.current) {
      shownCongratsRef.current = true;
      setShowCongrats(true);
      Promise.allSettled([
        dispatch(fetchMe()),
        dispatch(fetchMyBartenderInfo()),
        dispatch(fetchAvailableEvents()),
      ]);

      // lightweight confetti burst (dynamic import keeps bundle small)
      import("canvas-confetti")
        .then(({ default: confetti }) => {
          const duration = 2000;
          const animationEnd = Date.now() + duration;
          const defaults = {
            startVelocity: 30,
            spread: 360,
            ticks: 60,
            zIndex: 2000,
          };

          function randomInRange(min, max) {
            return Math.random() * (max - min) + min;
          }

          const interval = setInterval(() => {
            const timeLeft = animationEnd - Date.now();
            if (timeLeft <= 0) return clearInterval(interval);

            const particleCount = 50 * (timeLeft / duration);
            // fire from two sides
            confetti({
              ...defaults,
              particleCount,
              origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 },
            });
            confetti({
              ...defaults,
              particleCount,
              origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 },
            });
          }, 250);
        })
        .catch(() => {
          /* ignore if confetti not available */
        });
    }
  }, [dispatch, progress?.status]);

  /* ───────────────────────────── RENDER ───────────────────────────── */
  return (
    <AuthLayout>
      <HelmetHeader
        title={course ? `Learn | ${course.title}` : "Learn"}
        description={course?.description || "Start learning with Tipsyverse"}
        keywords="tipsyverse, bartender, learning"
      />

      <Container maxWidth={false} disableGutters>
        <Box sx={{ px: { xs: 2, md: 3 }, py: { xs: 4, md: 6 } }}>
          {/* Header */}
          <Stack spacing={0.5} sx={{ mb: 2 }}>
            <Stack direction="row" spacing={1} alignItems="center">
              <Chip
                size="small"
                label="Course"
                icon={<SchoolOutlinedIcon sx={{ fontSize: 16 }} />}
              />
              <Typography variant="overline" color="text.secondary">
                {slug}
              </Typography>
            </Stack>
            <Typography variant="h4" fontWeight={800}>
              {course?.title || "Loading…"}
            </Typography>
          </Stack>

          {/* Loading */}
          {!course && loading && (
            <Typography color="text.secondary">Loading…</Typography>
          )}

          {/* ===== No Progress → overview ===== */}
          {course && !hasProgress && (
            <Box>
              <Stack direction={{ xs: "column", md: "row" }} spacing={3}>
                <Box sx={{ flex: 1 }}>
                  <Card>
                    <Typography variant="h6" sx={{ mb: 1 }}>
                      About this course
                    </Typography>
                    <Typography variant="body1" color="text.secondary">
                      {course.description || "No description yet."}
                    </Typography>
                  </Card>

                  <Card sx={{ mt: 2, flex: { md: "0 0 40%" } }}>
                    <Typography variant="subtitle2" color="text.secondary">
                      What’s inside
                    </Typography>
                    <Typography variant="h5" sx={{ mt: 0.5 }}>
                      {modules.length} module{modules.length === 1 ? "" : "s"}
                    </Typography>
                  </Card>

                  <Stack spacing={2} sx={{ mt: 2 }}>
                    {modules.map((m) => (
                      <Card key={m._id}>
                        <Typography variant="subtitle1" fontWeight={700}>
                          {m.title}
                        </Typography>
                        <Typography
                          variant="body2"
                          color="text.secondary"
                          sx={{ mt: 0.5 }}
                        >
                          You will learn about the following:
                        </Typography>
                        <List dense sx={{ mt: 0.5 }}>
                          {(m.sections || EMPTY_ARR).map((s) => (
                            <ListItem key={s._id} disableGutters>
                              <ListItemIcon sx={{ minWidth: 28, mt: "2px" }}>
                                <ArrowForwardIcon fontSize="small" />
                              </ListItemIcon>
                              <ListItemText primary={s.title} />
                            </ListItem>
                          ))}
                        </List>
                      </Card>
                    ))}
                  </Stack>

                  <Stack direction="row" spacing={1.5} sx={{ mt: 3 }}>
                    <Button
                      variant="contained"
                      size="large"
                      onClick={handleStart}
                      disabled={starting}
                      sx={{ backgroundColor: "var(--primary-color)" }}
                    >
                      {starting ? "Starting…" : "Start This Course"}
                    </Button>
                  </Stack>
                </Box>
              </Stack>
            </Box>
          )}

          {/* ===== Has Progress → two-column layout (67/33 at sm+, stacked on xs) ===== */}
          {course && hasProgress && (
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: { xs: "1fr", sm: "2fr 1fr" }, // 67% / 33% at sm+
                gap: 1,
                alignItems: "start",
              }}
            >
              {/* LEFT: module player */}
              <Box>
                <Card
                  sx={{
                    height: { sm: "auto", md: "700px" },
                    display: "flex",
                    flexDirection: "column",
                  }}
                >
                  {/* Title stays at the very top */}
                  <Typography variant="h6" sx={{ mb: 1 }}>
                    {moduleDetail?.module?.title || "Current Module"}
                  </Typography>

                  {loadingModule && (
                    <Typography color="text.secondary">
                      Loading module…
                    </Typography>
                  )}

                  {!loadingModule && moduleDetail && (
                    <>
                      {(() => {
                        const totalSteps = sections.length + 2; // Overview + sections + Quiz
                        const isOverview = activeStep === 0;
                        const isQuiz = activeStep === sections.length + 1;
                        const sec =
                          !isOverview && !isQuiz
                            ? sections[activeStep - 1]
                            : null;
                        const getQKey = (q, i, moduleId) =>
                          String(q?._id ?? q?.id ?? `m${moduleId}-q${i}`);

                        const getOptKey = (opt, oi, qKey) =>
                          String(opt?._id ?? opt?.id ?? `${qKey}-o${oi}`);

                        return (
                          <>
                            {/* mini header */}
                            <Stack
                              direction="row"
                              justifyContent="space-between"
                              alignItems="center"
                              sx={{ mb: 2 }}
                            >
                              <Typography
                                variant="overline"
                                color="text.secondary"
                              >
                                Step {Math.min(activeStep + 1, totalSteps)} of{" "}
                                {totalSteps}
                              </Typography>
                              <Typography
                                variant="overline"
                                color="text.secondary"
                              >
                                {isOverview
                                  ? "Overview"
                                  : isQuiz
                                  ? "Quiz"
                                  : "Section"}
                              </Typography>
                            </Stack>

                            {/* CONTENT AREA — scrolls if long */}
                            <Box
                              sx={{ flex: 1, minHeight: 0, overflow: "auto" }}
                            >
                              {/* Overview body (no buttons here) */}
                              {isOverview && (
                                <>
                                  {!!moduleDetail.module?.description && (
                                    <Typography
                                      variant="body1"
                                      color="text.secondary"
                                      sx={{ mb: 2 }}
                                    >
                                      {moduleDetail.module.description}
                                    </Typography>
                                  )}
                                  <Alert severity="info" sx={{ mb: 2 }}>
                                    This module includes a quiz with{" "}
                                    <strong>
                                      {Number(quizInfo.poolSize || 0) > 0
                                        ? Math.min(
                                            quizInfo.poolSize,
                                            sections.reduce(
                                              (n, s) =>
                                                n +
                                                (s?.quiz?.questions?.length ||
                                                  0),
                                              0
                                            )
                                          )
                                        : sections.reduce(
                                            (n, s) =>
                                              n +
                                              (s?.quiz?.questions?.length || 0),
                                            0
                                          )}
                                    </strong>{" "}
                                    questions. You must score at least{" "}
                                    <strong>{passPercentRequired}%</strong> to
                                    unlock the next module.
                                  </Alert>
                                </>
                              )}

                              {/* Section body (no buttons here) */}
                              {sec && (
                                <>
                                  {sec?.images?.[0]?.url && (
                                    <Box
                                      component="img"
                                      src={sec.images[0].url}
                                      alt={sec.title}
                                      sx={{
                                        width: "100%",
                                        maxHeight: 320,
                                        objectFit: "cover",
                                        borderRadius: 2,
                                        mb: 2,
                                      }}
                                    />
                                  )}

                                  <Stack
                                    direction="row"
                                    alignItems="center"
                                    justifyContent="space-between"
                                    sx={{ mb: 1 }}
                                  >
                                    <Typography
                                      variant="subtitle1"
                                      fontWeight={700}
                                    >
                                      {sec.title}
                                    </Typography>
                                    <Tooltip
                                      title={
                                        canSpeak
                                          ? speaking
                                            ? "Stop audio"
                                            : "Play audio"
                                          : "Audio not supported"
                                      }
                                    >
                                      <span>
                                        <IconButton
                                          onClick={() => toggleSpeak(sec)}
                                          disabled={!canSpeak}
                                        >
                                          {speaking ? (
                                            <VolumeOffIcon />
                                          ) : (
                                            <VolumeUpIcon />
                                          )}
                                        </IconButton>
                                      </span>
                                    </Tooltip>
                                  </Stack>

                                  {!!sec.subtitle && (
                                    <Typography
                                      variant="subtitle2"
                                      sx={{ mb: 1 }}
                                    >
                                      {sec.subtitle}
                                    </Typography>
                                  )}
                                  <Typography
                                    variant="body1"
                                    color="text.secondary"
                                    sx={{ whiteSpace: "pre-wrap" }}
                                  >
                                    {sec.content || "No content yet."}
                                  </Typography>
                                </>
                              )}

                              {/* Quiz body (no buttons here) */}
                              {isQuiz && (
                                <>
                                  {!attemptQuestions.length ? (
                                    <Alert severity="info">
                                      No quiz questions yet.
                                    </Alert>
                                  ) : (
                                    <>
                                      <Typography
                                        variant="body2"
                                        color="text.secondary"
                                        sx={{ mb: 2 }}
                                      >
                                        Answer all questions. You must score at
                                        least {passPercentRequired}% to pass.
                                      </Typography>

                                      {!quizResult && (
                                        <Stack spacing={2}>
                                          {attemptQuestions.map((q, i) => {
                                            const qKey = getQKey(
                                              q,
                                              i,
                                              currentModuleId
                                            );

                                            const answerQuestion = (
                                              qKey,
                                              optKey
                                            ) =>
                                              setQuizAnswers((prev) => ({
                                                ...prev,
                                                [qKey]: optKey,
                                              }));

                                            return (
                                              <Card key={qKey}>
                                                <Typography
                                                  variant="subtitle1"
                                                  fontWeight={700}
                                                >
                                                  {i + 1}. {q.prompt}
                                                </Typography>

                                                <RadioGroup
                                                  name={`quiz-${String(
                                                    currentModuleId
                                                  )}-${qKey}`} // unique per question
                                                  value={
                                                    quizAnswers[qKey] ?? ""
                                                  }
                                                  onChange={(e) =>
                                                    answerQuestion(
                                                      qKey,
                                                      e.target.value
                                                    )
                                                  } // store by qKey
                                                >
                                                  {(q.options || EMPTY_ARR).map(
                                                    (opt, oi) => {
                                                      const optKey = getOptKey(
                                                        opt,
                                                        oi,
                                                        qKey
                                                      );
                                                      return (
                                                        <FormControlLabel
                                                          key={optKey} // unique option key
                                                          value={optKey} // unique option value
                                                          control={
                                                            <Radio
                                                              icon={
                                                                <RadioButtonUnchecked
                                                                  sx={{
                                                                    color: (
                                                                      t
                                                                    ) =>
                                                                      t.palette
                                                                        .action
                                                                        .disabled,
                                                                  }}
                                                                />
                                                              }
                                                              checkedIcon={
                                                                <RadioButtonChecked
                                                                  sx={{
                                                                    color:
                                                                      "var(--primary-color)",
                                                                  }}
                                                                />
                                                              }
                                                            />
                                                          }
                                                          label={opt.text}
                                                        />
                                                      );
                                                    }
                                                  )}
                                                </RadioGroup>
                                              </Card>
                                            );
                                          })}
                                        </Stack>
                                      )}

                                      {quizResult && (
                                        <Alert
                                          severity={
                                            quizResult.passed
                                              ? "success"
                                              : "error"
                                          }
                                          sx={{ mt: 2 }}
                                        >
                                          Score:{" "}
                                          <strong>
                                            {quizResult.scorePct}%
                                          </strong>
                                          .{" "}
                                          {quizResult.passed
                                            ? "Great job! The next module is unlocked."
                                            : `Sorry, but you failed! You need at least ${passPercentRequired}%. Review and try again.`}
                                        </Alert>
                                      )}
                                    </>
                                  )}
                                </>
                              )}
                            </Box>

                            {/* FOOTER — pinned at the bottom */}
                            <Box sx={{ pt: 2, mt: "auto" }}>
                              {isOverview && (
                                <Button
                                  variant="contained"
                                  onClick={handleStartLeft}
                                  endIcon={<ArrowForwardIcon />}
                                  sx={{
                                    backgroundColor: "var(--primary-color)",
                                  }}
                                >
                                  Start
                                </Button>
                              )}

                              {sec && (
                                <Stack
                                  direction="row"
                                  spacing={1.5}
                                  sx={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                  }}
                                >
                                  <Button
                                    variant="outlined"
                                    startIcon={<ArrowBackIcon />}
                                    onClick={handleBackLeft}
                                    disabled={activeStep === 0}
                                    sx={{
                                      color: "var(--primary-color)",
                                      borderColor: "var(--primary-color)",
                                    }}
                                  >
                                    Previous
                                  </Button>
                                  <Button
                                    variant="contained"
                                    endIcon={<ArrowForwardIcon />}
                                    onClick={() => handleNextLeft(sec)}
                                    sx={{
                                      backgroundColor: "var(--primary-color)",
                                    }}
                                  >
                                    Next
                                  </Button>
                                </Stack>
                              )}

                              {isQuiz && !!attemptQuestions.length && (
                                <Stack
                                  direction="row"
                                  spacing={1.5}
                                  display="flex"
                                  justifyContent="space-between"
                                >
                                  <Button
                                    variant="outlined"
                                    startIcon={<ArrowBackIcon />}
                                    onClick={handleBackLeft}
                                    sx={{
                                      color: "var(--primary-color)",
                                      borderColor: "var(--primary-color)",
                                    }}
                                  >
                                    Previous
                                  </Button>

                                  {quizResult ? (
                                    quizResult.passed ? (
                                      <Button
                                        variant="contained"
                                        onClick={() => {
                                          setSelectedModuleId(null);
                                          setActiveStep(0);
                                          refreshProgress();
                                        }}
                                        sx={{
                                          backgroundColor:
                                            "var(--primary-color)",
                                        }}
                                      >
                                        Continue
                                      </Button>
                                    ) : (
                                      <Button
                                        variant="outlined"
                                        onClick={() =>
                                          setQuizSeed((s) => s + 1)
                                        }
                                      >
                                        Retry Quiz
                                      </Button>
                                    )
                                  ) : (
                                    <Button
                                      variant="contained"
                                      onClick={submitQuiz}
                                      sx={{
                                        backgroundColor: "var(--primary-color)",
                                      }}
                                      disabled={
                                        submittingQuiz ||
                                        Object.keys(quizAnswers).length !==
                                          attemptQuestions.length
                                      }
                                    >
                                      {submittingQuiz
                                        ? "Submitting…"
                                        : "Submit Quiz"}
                                    </Button>
                                  )}
                                </Stack>
                              )}
                            </Box>
                          </>
                        );
                      })()}

                      {/* Lesson progress (current module) */}
                      <Box sx={{ mt: 2 }}>
                        {(() => {
                          const total = sections.length;
                          const doneIds = new Set(
                            (moduleProgress?.sections || [])
                              .filter((sp) => !!sp.completedAt)
                              .map((sp) => String(sp.sectionId))
                          );
                          const completed = sections.filter((s) =>
                            doneIds.has(String(s._id))
                          ).length;
                          const pct = total
                            ? Math.round((completed / total) * 100)
                            : 0;

                          return (
                            <>
                              <Stack
                                direction="row"
                                justifyContent="space-between"
                                sx={{ mb: 0.5 }}
                              >
                                <Typography variant="subtitle2">
                                  Lesson progress
                                </Typography>
                                <Typography variant="subtitle2">
                                  {completed}/{total} • {pct}%
                                </Typography>
                              </Stack>
                              <LinearProgress
                                variant="determinate"
                                value={pct}
                                sx={{
                                  height: 8,
                                  borderRadius: 999,
                                  backgroundColor: (t) =>
                                    t.palette.action.disabledBackground,
                                  "& .MuiLinearProgress-bar": {
                                    borderRadius: 999,
                                    backgroundColor: "var(--primary-color)",
                                  },
                                }}
                              />
                            </>
                          );
                        })()}
                      </Box>
                    </>
                  )}
                </Card>
              </Box>

              {/* RIGHT: sidebar (progress ring + modules list) */}
              <Box
                sx={{
                  minWidth: 0,
                  position: { sm: "sticky" },
                  top: { sm: 24 },
                  alignSelf: "flex-start",
                }}
              >
                <Card sx={{ textAlign: "center", mb: 2 }}>
                  <CircularProgressRing value={overall.percent} />
                  <Typography variant="h6" sx={{ mt: 1.25 }}>
                    {Math.min(overall.done, overall.total)} / {overall.total}{" "}
                    modules
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {titleCase(progress?.status || "in_progress")}
                  </Typography>
                </Card>

                <ModuleSidebar
                  moduleStates={moduleStates}
                  courseSlug={course?.slug}
                  currentModuleId={currentModuleId}
                  currentSectionId={currentSectionId}
                  selectedModuleId={selectedModuleId}
                  setSelectedModuleId={setSelectedModuleId}
                  setActiveStep={setActiveStep}
                  stopSpeaking={stopSpeaking}
                  activeStep={activeStep}
                  sectionProgressById={sectionProgressById}
                />
              </Box>
            </Box>
          )}
        </Box>
      </Container>
      <Dialog
        open={showCongrats}
        onClose={() => setShowCongrats(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: 3 } }}
      >
        <DialogTitle sx={{ fontWeight: 800 }}>🎉 Congratulations!</DialogTitle>
        <DialogContent>
          <Typography variant="body1" sx={{ mb: 1.5 }}>
            You’ve completed <strong>{course?.title || "this course"}</strong>.
            Awesome work!
          </Typography>
          <Typography variant="body2" color="text.secondary">
            You’re now ready to proceed to the next steps of becoming a bartender for Tipsyverse.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setShowCongrats(false)}>Close</Button>
          <Button
            variant="contained"
            onClick={() => navigate("/bartend")} // ← adjust this route if needed
            sx={{ backgroundColor: "var(--primary-color)" }}
          >
            Continue
          </Button>
        </DialogActions>
      </Dialog>
    </AuthLayout>
  );
};

/* ╔════════════════════════════════════════════════════════════════╗
   ║                        SIDEBAR COMPONENT                       ║
   ╚════════════════════════════════════════════════════════════════╝ */
/**
 * ModuleSidebar
 * - Shows accordion per module, with section list.
 * - Clicking a section moves the left player to that exact step (no navigation).
 * - Locked modules are disabled (no hover).
 * - Highlights the active section with a light primary background.
 */
function ModuleSidebar({
  moduleStates,
  courseSlug,
  currentModuleId,
  currentSectionId,
  selectedModuleId,
  setSelectedModuleId,
  setActiveStep,
  stopSpeaking,
  activeStep,
  sectionProgressById,
}) {
  return (
    <Card>
      <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
        Modules
      </Typography>

      {(moduleStates || []).map((st) => {
        const m = st.module;
        const isCurrentModule = String(m._id) === String(currentModuleId);

        return (
          <Accordion
            key={m._id}
            disableGutters
            disabled={st.locked}
            sx={{
              mb: 1,
              borderRadius: 2,
              border: "1px solid",
              borderColor: "divider",
              overflow: "hidden",
              opacity: st.locked ? 0.6 : 1,
              "&:before": { display: "none" },
            }}
          >
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Stack direction="row" spacing={1.25} alignItems="center">
                {st.completed ? (
                  <CheckCircleOutlineIcon color="success" />
                ) : st.inProgress ? (
                  <PlayCircleOutlineIcon color="primary" />
                ) : st.locked ? (
                  <LockOutlinedIcon />
                ) : (
                  <PlayCircleOutlineIcon color="action" />
                )}
                <Box>
                  <Typography variant="subtitle2" fontWeight={700}>
                    {m.title}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {Math.min(st.passedCount, st.totalSections)}/
                    {st.totalSections} sections
                  </Typography>
                </Box>
              </Stack>
            </AccordionSummary>

            <AccordionDetails sx={{ pt: 0, pb: 1 }}>
              <List dense disablePadding>
                {(m.sections || EMPTY_ARR).map((s, idx) => {
                  const isActive =
                    isCurrentModule &&
                    String(s._id) === String(currentSectionId);
                  const stepForThisSection = idx + 1; // 0=Overview, 1..n=sections

                  return (
                    <ListItem
                      key={s._id}
                      disableGutters
                      onClick={() => {
                        if (st.locked) return;
                        setSelectedModuleId(m._id);
                        setActiveStep(stepForThisSection);
                        stopSpeaking?.();
                      }}
                      sx={{
                        px: 1,
                        py: 1,
                        mb: 0.5,
                        borderRadius: 1.5,
                        cursor: st.locked ? "default" : "pointer",
                        bgcolor: isActive
                          ? (t) => t.palette.action.selected
                          : "transparent",
                        "&:hover": st.locked
                          ? {}
                          : { bgcolor: (t) => t.palette.action.hover },
                      }}
                    >
                      <ListItemIcon sx={{ minWidth: 28, mt: "2px" }}>
                        {(() => {
                          const p = sectionProgressById?.get(String(s._id));
                          const completed = !!p?.completedAt;
                          const started = !!p?.startedAt;
                          if (completed)
                            return <CheckCircleOutlineIcon color="success" />;
                          if (started)
                            return <PlayCircleOutlineIcon color="primary" />;
                          return <ArrowForwardIcon fontSize="small" />;
                        })()}
                      </ListItemIcon>
                      <ListItemText
                        primary={
                          <Typography
                            variant="body2"
                            fontWeight={isActive ? 700 : 500}
                            color={
                              isActive ? "var(--primary-color)" : "text.primary"
                            }
                          >
                            {s.title}
                          </Typography>
                        }
                      />
                    </ListItem>
                  );
                })}

                {/* --- Quiz (end-of-module) item --- */}
                {(() => {
                  const sectionsCount = (m.sections || EMPTY_ARR).length;
                  const quizStep = sectionsCount + 1; // 0=Overview, 1..n=sections, n+1=Quiz
                  const isQuizActive =
                    isCurrentModule && activeStep === quizStep;
                  const canTakeQuiz = st.passedCount >= st.totalSections; // enable when all sections complete
                  return (
                    <ListItem
                      key={`${m._id}-quiz`}
                      disableGutters
                      onClick={() => {
                        if (st.locked || !canTakeQuiz) return;
                        setSelectedModuleId(m._id);
                        setActiveStep(quizStep);
                        stopSpeaking?.();
                      }}
                      sx={{
                        px: 1,
                        py: 1,
                        mt: 0.5,
                        borderRadius: 1.5,
                        cursor:
                          st.locked || !canTakeQuiz ? "default" : "pointer",
                        opacity: !canTakeQuiz ? 0.6 : 1,
                        bgcolor: isQuizActive
                          ? (t) => t.palette.action.selected
                          : "transparent",
                        "&:hover":
                          st.locked || !canTakeQuiz
                            ? {}
                            : { bgcolor: (t) => t.palette.action.hover },
                      }}
                    >
                      <ListItemIcon sx={{ minWidth: 28, mt: "2px" }}>
                        {st.passed ? (
                          <CheckCircleOutlineIcon color="success" />
                        ) : canTakeQuiz ? (
                          <PlayCircleOutlineIcon color="primary" />
                        ) : (
                          <LockOutlinedIcon />
                        )}
                      </ListItemIcon>
                      <ListItemText
                        primary={
                          <Typography
                            variant="body2"
                            fontWeight={isQuizActive ? 700 : 500}
                            color={
                              isQuizActive ? "primary.main" : "text.primary"
                            }
                          >
                            Quiz
                          </Typography>
                        }
                        secondary={
                          <Typography variant="caption" color="text.secondary">
                            {st.passed
                              ? "Passed"
                              : canTakeQuiz
                              ? "Ready"
                              : "Complete all sections first"}
                          </Typography>
                        }
                      />
                    </ListItem>
                  );
                })()}
              </List>
            </AccordionDetails>
          </Accordion>
        );
      })}
    </Card>
  );
}

export default LearningCourseScreen;
