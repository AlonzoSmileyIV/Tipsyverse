import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Container,
  Grid,
  InputAdornment,
  Paper,
  Skeleton,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import SchoolOutlinedIcon from "@mui/icons-material/SchoolOutlined";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import TimelineIcon from "@mui/icons-material/Timeline";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import AuthLayout from "../../components/PublicLayout/PublicLayout";
import HelmetHeader from "../../components/HelmetHeader/Helmet";
import { useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { fetchCourses } from "../../features/courses/courseSlice";
import { fetchMyProgressList } from "../../features/courseProgresses/courseProgressSlice";

/** Card shell */
const Card = ({ children, sx }) => (
  <Paper
    elevation={0}
    sx={{
      width: { xs: "100%", sm: "auto" }, // full width on phones
      alignSelf: "stretch", // stretch if inside a Stack
      p: 2.5,
      borderRadius: 3,
      height: "100%",
      display: "flex",
      flexDirection: "column",
      border: "1px solid lightgrey",
      ...sx,
    }}
  >
    {children}
  </Paper>
);

/** Circular progress with % label centered */
const clamp = (n) => Math.max(0, Math.min(100, Number(n) || 0));

const hueFor = (v) => {
  // 0% = red (0deg), 100% = green (120deg)
  const pct = clamp(v) / 100;
  return 120 * pct; // 0..120
};

const Ring = ({ value = 0 }) => {
  const v = clamp(value);
  const hue = hueFor(v);
  const color = `hsl(${hue} 80% 45%)`; // tweak saturation/lightness to taste

  return (
    <Box position="relative" display="inline-flex">
      {/* Track (gray) */}
      <CircularProgress
        variant="determinate"
        value={100}
        size={64}
        thickness={5}
        sx={{
          color: (theme) => theme.palette.action.disabledBackground, // soft gray
          position: "absolute",
          left: 0,
        }}
      />
      {/* Progress (red → green) */}
      <CircularProgress
        variant="determinate"
        value={v}
        size={64}
        thickness={5}
        sx={{
          "& .MuiCircularProgress-circle": {
            stroke: color,
          },
        }}
      />
      {/* Label */}
      <Box
        sx={{
          top: 0,
          left: 0,
          bottom: 0,
          right: 0,
          position: "absolute",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Typography variant="caption" component="div" fontWeight={700}>
          {`${Math.round(v)}%`}
        </Typography>
      </Box>
    </Box>
  );
};

/**
 * EXPECTED progress shape from backend (example):
 * GET /me/progress
 * {
 *   success: true,
 *   data: {
 *     "<courseId>": {
 *       completedModules: 3,
 *       totalModules: 7,                  // server can send this or we compute from course.modules
 *       percent: 42.857,                  // server can send this or we compute
 *       nextModuleSlug: "responsible-service" // optional; for "Continue" link
 *     },
 *     ...
 *   }
 * }
 */
const MyLearningCoursesScreen = () => {
  const dispatch = useDispatch();
  const [search, setSearch] = useState("");
  const { allCourses, status: coursesStatus } = useSelector((s) => s.courses);
  // progress slice
  const {
    myProgress, // array of progress docs
    status: progressStatus,
  } = useSelector((s) => s.courseProgress);

  const loading = coursesStatus === "loading" || progressStatus === "loading";

  useEffect(() => {
    // fetch courses (published only; lightweight fields)
    dispatch(
      fetchCourses({
        fields: "title,slug,modules.title,modules.moduleOrder,updatedAt,status",
        sort: "title",
        limit: 1000,
        status: "published",
      })
    );
    // fetch my progress list
    dispatch(fetchMyProgressList());
  }, [dispatch]);

  // Build a quick map: courseId -> summary used by the UI
  // If your list endpoint already returns sectionsCompleted/totalSections, adapt here.
  const progressMap = useMemo(() => {
    const clamp = (n) => Math.max(0, Math.min(100, Number(n) || 0));
    const list = Array.isArray(myProgress?.data)
      ? myProgress.data
      : myProgress || [];
    const map = {};
    list.forEach((p) => {
      const done = Number(p.modulesCompleted ?? 0);
      const total = Number(p.totalModules ?? 0);
      const percent = total > 0 ? clamp((done / total) * 100) : 0;
      map[p.courseId] = {
        modulesCompleted: done,
        totalModules: total,
        percent,
        // nextModuleSlug: p.nextModuleSlug, // if you add this server-side later
      };
    });
    return map;
  }, [myProgress]);

  // Ensure modules are ordered client-side and normalized
  const courses = useMemo(() => {
    const list = Array.isArray(allCourses) ? allCourses : [];
    return list.map((c) => ({
      ...c,
      modules: (c.modules || [])
        .map((m, i) => ({
          ...m,
          order: Number.isFinite(m.moduleOrder) ? m.moduleOrder : i,
        }))
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
    }));
  }, [allCourses]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return courses;
    return courses.filter((c) => c.title?.toLowerCase().includes(q));
  }, [search, courses]);

  const summary = useMemo(() => {
    let inProgress = 0;
    let completed = 0;
    let modulesDone = 0;
    courses.forEach((c) => {
      const p = progressMap[c._id] || {};
      const total = Number(p.totalModules ?? c.modules?.length ?? 0);
      const done = Number(p.modulesCompleted ?? 0);
      modulesDone += done;
      if (total > 0) {
        if (done >= total) completed += 1;
        else if (done > 0) inProgress += 1;
      }
    });
    return { inProgress, completed, modulesDone, totalCourses: courses.length };
  }, [courses, progressMap]);

  return (
    <AuthLayout>
      <HelmetHeader
        title="Tipsyverse | My Courses"
        description="Track your progress and continue learning on Tipsyverse."
        keywords="tipsyverse, my courses, bartender training, progress"
      />

      <Container maxWidth={false} disableGutters>
        <Box
          sx={{ maxWidth: 1280, px: { xs: 2, md: 3 }, py: { xs: 4, md: 6 } }}
        >
          {/* Header */}
          <Stack spacing={1} sx={{ mb: 2 }}>
            <Typography component="h1" variant="h4" fontWeight={800}>
              My Courses
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Pick up where you left off or start something new.
            </Typography>
          </Stack>

          {/* Top stats */}
          <Grid container spacing={2} sx={{ mb: 2 }}>
            <Grid item xs={12} sm={4}>
              <Card>
                <Stack direction="row" alignItems="center" spacing={1}>
                  <SchoolOutlinedIcon fontSize="small" />
                  <Typography component="span" variant="subtitle2">In Progress</Typography>
                </Stack>
                <Typography component="p" variant="h5" sx={{ mt: 1 }}>
                  {loading ? <Skeleton width={40} /> : summary.inProgress}
                </Typography>
              </Card>
            </Grid>
            <Grid item xs={12} sm={4}>
              <Card>
                <Stack direction="row" alignItems="center" spacing={1}>
                  <CheckCircleOutlineIcon fontSize="small" />
                  <Typography component="span" variant="subtitle2">Completed</Typography>
                </Stack>
                <Typography component="p" variant="h5" sx={{ mt: 1 }}>
                  {loading ? <Skeleton width={40} /> : summary.completed}
                </Typography>
              </Card>
            </Grid>
            <Grid item xs={12} sm={4}>
              <Card>
                <Stack direction="row" alignItems="center" spacing={1}>
                  <TimelineIcon fontSize="small" />
                  <Typography component="span" variant="subtitle2">Modules Finished</Typography>
                </Stack>
                <Typography component="p" variant="h5" sx={{ mt: 1 }}>
                  {loading ? <Skeleton width={60} /> : summary.modulesDone}
                </Typography>
              </Card>
            </Grid>
          </Grid>

          {/* Search */}
          <Box sx={{ mb: 2 }}>
            <TextField
              fullWidth
              placeholder="Search courses…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" />
                  </InputAdornment>
                ),
              }}
            />
          </Box>

          {/* Courses grid */}
          <Grid container spacing={2}>
            {loading
              ? Array.from({ length: 3 }).map((_, i) => (
                  <Grid item xs={12} key={i}>
                    <Card>
                      <Stack direction="row" spacing={2} alignItems="center">
                        <Skeleton variant="circular" width={64} height={64} />
                        <Box sx={{ flexGrow: 1 }}>
                          <Skeleton width="40%" />
                          <Skeleton width="25%" />
                        </Box>
                        <Skeleton
                          variant="rectangular"
                          width={140}
                          height={36}
                        />
                      </Stack>
                    </Card>
                  </Grid>
                ))
              : filtered.map((c) => {
                  const p = progressMap[c._id] || {};
                  const total = Number(
                    p.totalModules ?? c.modules?.length ?? 0
                  );
                  const done = Number(p.modulesCompleted ?? 0);
                  const percent =
                    p.percent != null
                      ? Math.max(0, Math.min(100, Number(p.percent)))
                      : total > 0
                      ? (done / total) * 100
                      : 0;

                  const isComplete = total > 0 && done >= total;

                  const href = isComplete
                    ? `/learn/${c.slug}`
                    : p.nextModuleSlug
                    ? `/learn/${c.slug}/modules/${p.nextModuleSlug}`
                    : `/learn/${c.slug}`;

                  return (
                    <Grid item xs={12} key={c._id}>
                      <Card>
                        <Stack
                          direction={{ xs: "column", sm: "row" }}
                          alignItems={{ xs: "flex-start", sm: "center" }}
                          spacing={2}
                        >
                          {/* Left: ring */}
                          <Ring value={percent} />

                          {/* Middle: title + modules count */}
                          <Box sx={{ flexGrow: 1, minWidth: 240 }}>
                            <Stack
                              direction="row"
                              spacing={1}
                              alignItems="center"
                            >
                              <Typography variant="h6" sx={{ lineHeight: 1.2 }}>
                                {c.title}
                              </Typography>
                              {isComplete && (
                                <Chip
                                  size="small"
                                  label="Completed"
                                  color="success"
                                  sx={{ height: 22 }}
                                />
                              )}
                            </Stack>

                            <Typography
                              variant="body2"
                              color="text.secondary"
                              sx={{ mt: 0.5 }}
                            >
                              {total > 0
                                ? `${done} of ${total} modules completed`
                                : "No modules yet"}
                            </Typography>
                          </Box>

                          {/* Right: CTA */}
                          <Button
                            variant="contained"
                            endIcon={<ArrowForwardIcon />}
                            href={href}
                            sx={{
                              whiteSpace: "nowrap",
                              backgroundColor: "var(--primary-color)",
                            }}
                          >
                            {isComplete
                              ? "View Course"
                              : percent > 0
                              ? "Continue"
                              : "Start Now"}
                          </Button>
                        </Stack>
                      </Card>
                    </Grid>
                  );
                })}
          </Grid>

          {!loading && filtered.length === 0 && (
            <Box sx={{ textAlign: "center", py: 6, color: "text.secondary" }}>
              <Typography>No courses match “{search}”.</Typography>
            </Box>
          )}
        </Box>
      </Container>
    </AuthLayout>
  );
};

export default MyLearningCoursesScreen;
