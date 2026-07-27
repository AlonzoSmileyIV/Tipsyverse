// AdminEmployeeForm.jsx
import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
} from "react";
import {
  Box,
  Typography,
  Avatar,
  TextField,
  Button,
  MenuItem,
  Select,
  InputLabel,
  FormControl,
  IconButton,
  Checkbox,
  FormControlLabel,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Alert,
  Collapse,
  Autocomplete,
  Stepper,
  Step,
  StepLabel,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormHelperText,
} from "@mui/material";
import {
  CameraAlt,
  Save,
  Add,
  Close as CloseIcon,
} from "@mui/icons-material";
import { red } from "@mui/material/colors";
import { useDispatch, useSelector } from "react-redux";
import ActivityLogsTable from "../ActivityLogsTable/LazyActivityLogsTable";
import { fetchAllPositions } from "../../features/positions/positionSlice";
import api from "../../services/api";
import dayjs from "dayjs";
import { fetchAllEmployees } from "../../features/users/userSlice";
import {
  filterPositionsForAdd,
  reportToConstraints,
  canEditUser,
  canAssignPosition,
} from "../../accessControl/rbac";

const mockEmployees = [
  {
    _id: "2",
    email: "jane.smith@example.com",
    fullName: "Jane Smith",
    passwordHash: "hashed",
    profile: {
      photo: "https://randomuser.me/api/portraits/women/2.jpg",
    },
    employeeDetails: {
      position: { _id: "pos2", name: "Team Lead" },
      reportTo: null,
      directReports: [],

      employementStatus: {
        state: "Terminated",
        isAbsent: false,
        reasonForTermination: "Breach of policy",
      },
      dates: {
        dateStarted: "2021-01-15",
      },
    },

    canEdit: false,
  },
  {
    _id: "e1",
    fullName: "Alice Johnson",
    email: "alice.johnson@example.com",
    profile: { photo: "https://randomuser.me/api/portraits/women/10.jpg" },
    employeeDetails: {
      position: { _id: "p1", name: "Product Manager" },
      reportTo: null,
      directReports: ["e2", "e3"],
      employementStatus: { state: "Active", isAbsent: false },
      dates: { dateStarted: "2022-03-01" },
    },
  },
  {
    _id: "e2",
    fullName: "Bob Smith",
    email: "bob.smith@example.com",
    profile: { photo: "https://randomuser.me/api/portraits/men/11.jpg" },
    employeeDetails: {
      position: { _id: "p2", name: "Frontend Developer" },
      reportTo: null,
      directReports: [],
      employementStatus: { state: "Active", isAbsent: false },
      dates: { dateStarted: "2022-04-15" },
    },
  },
  {
    _id: "e3",
    fullName: "Carol Chen",
    email: "carol.chen@example.com",
    profile: { photo: "https://randomuser.me/api/portraits/women/12.jpg" },
    employeeDetails: {
      position: { _id: "p3", name: "UX Designer" },
      reportTo: null,
      directReports: [],
      employementStatus: { state: "Active", isAbsent: false },
      dates: { dateStarted: "2022-05-10" },
    },
  },
  {
    _id: "e4",
    fullName: "David Lee",
    email: "david.lee@example.com",
    profile: { photo: "https://randomuser.me/api/portraits/men/13.jpg" },
    employeeDetails: {
      position: { _id: "p4", name: "Backend Developer" },
      reportTo: null,
      directReports: [],
      employementStatus: { state: "Inactive", isAbsent: false },
      dates: { dateStarted: "2021-08-01" },
    },
  },
  {
    _id: "e5",
    fullName: "Eve Martinez",
    email: "eve.martinez@example.com",
    profile: { photo: "https://randomuser.me/api/portraits/women/14.jpg" },
    employeeDetails: {
      position: { _id: "p5", name: "Tech Lead" },
      reportTo: null,
      directReports: ["e4"],
      employmentStatus: { state: "Active", isAbsent: false },
      dates: { dateStarted: "2021-01-01" },
    },
  },
  {
    _id: "e6",
    fullName: "Frank Nguyen",
    email: "frank.nguyen@example.com",
    profile: { photo: "https://randomuser.me/api/portraits/men/15.jpg" },
    employeeDetails: {
      position: { _id: "p6", name: "DevOps Engineer" },
      reportTo: "e5",
      directReports: [],
      employmentStatus: {
        state: "Suspended",
        isAbsent: false,
        reasonForTermination: "Policy violation",
      },
      dates: { dateStarted: "2023-02-20" },
    },
  },
  {
    _id: "e7",
    fullName: "Grace Kim",
    email: "grace.kim@example.com",
    profile: { photo: "https://randomuser.me/api/portraits/women/16.jpg" },
    employeeDetails: {
      position: { _id: "p7", name: "QA Engineer" },
      reportTo: "e1",
      directReports: [],
      employmentStatus: { state: "Active", isAbsent: true },
      dates: { dateStarted: "2023-04-01" },
    },
  },
  {
    _id: "e8",
    fullName: "Henry Brooks",
    email: "henry.brooks@example.com",
    profile: { photo: "https://randomuser.me/api/portraits/men/17.jpg" },
    employeeDetails: {
      position: { _id: "p8", name: "HR Specialist" },
      reportTo: null,
      directReports: [],
      employmentStatus: { state: "Active", isAbsent: false },
      dates: { dateStarted: "2022-11-01" },
    },
  },
  {
    _id: "e9",
    fullName: "Isabelle Moore",
    email: "isabelle.moore@example.com",
    profile: { photo: "https://randomuser.me/api/portraits/women/18.jpg" },
    employeeDetails: {
      position: { _id: "p9", name: "Finance Analyst" },
      reportTo: null,
      directReports: [],
      employmentStatus: { state: "Active", isAbsent: false },
      dates: { dateStarted: "2023-06-12" },
    },
  },
  {
    _id: "e10",
    fullName: "Jack Patel",
    email: "jack.patel@example.com",
    profile: { photo: "https://randomuser.me/api/portraits/men/19.jpg" },
    employeeDetails: {
      position: { _id: "p10", name: "Customer Support" },
      reportTo: "e8",
      directReports: [],
      employmentStatus: { state: "Active", isAbsent: false },
      dates: { dateStarted: "2023-01-05" },
    },
  },
];

const mockPositions = [
  { _id: "p1", name: "Product Manager" },
  { _id: "pos1", name: "Software Engineer" },
  { _id: "pos2", name: "Team Lead" },
  { _id: "p2", name: "Frontend Developer" },
  { _id: "p3", name: "UX Designer" },
  { _id: "p4", name: "Backend Developer" },
  { _id: "p5", name: "Tech Lead" },
  { _id: "p6", name: "DevOps Engineer" },
  { _id: "p7", name: "QA Engineer" },
  { _id: "p8", name: "HR Specialist" },
  { _id: "p9", name: "Finance Analyst" },
  { _id: "p10", name: "Customer Support" },
];

const terminationReasons = [
  "New Job",
  "Personal Reasons",
  "Relocation",
  "Career Change",
  "Contract Ended",
  "Position Eliminated",
  "Mutual Separation",
  "Performance Issues",
  "Policy Violation",
  "Retirement",
  "Other",
];

const MAX_FILE_SIZE_MB = 10;

const isFileValid = (file, type = "image") => {
  const validTypes =
    type === "image"
      ? ["image/jpeg", "image/png", "image/webp"]
      : ["video/mp4", "video/webm"];
  return (
    validTypes.includes(file.type) &&
    file.size <= MAX_FILE_SIZE_MB * 1024 * 1024
  );
};

const AdminEmployeeForm = ({ mode, employee, onClose }) => {
  const dispatch = useDispatch();
  const loggedInUser = useSelector((state) => state.users.loggedInUser)?.user;

  const allPositions = useSelector((state) => state.positions?.allPositions);
  const positionsData = useMemo(
    () => (allPositions?.data?.length ? allPositions?.data : mockPositions),
    [allPositions]
  );

  const allEmployees = useSelector((state) => state.users?.allEmployees);
  const employeesData = useMemo(
    () => (allEmployees?.data?.length ? allEmployees?.data : mockEmployees),
    [allEmployees]
  );

  const [usernameRecs, setUsernameRecs] = useState([]); // 👈 suggested usernames

  const [activeStep, setActiveStep] = useState(0);

  const idEqual = (a, b) => String(a ?? "") === String(b ?? "");

  const isView = mode === "view";
  const isEdit = mode === "edit";
  const isAdd = mode === "add";

  const steps = useMemo(
    () =>
      isView
        ? ["Basic Info", "Employment", "Structure", "Activity Log"]
        : ["Basic Info", "Employment", "Structure", "Review"],
    [isView]
  );

  const [errors, setErrors] = useState({});
  const [successMessage, setSuccessMessage] = useState("");
  const [searchDirect, setSearchDirect] = useState("");
  const photoInputRef = useRef(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const [uploadingImage, setUploadingImage] = useState(false);

  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    username: "",
    position: "",
    dateStarted: "",
    birthday: "",
    bio: "",
    status: "Active",
    reasonForTermination: "",
    reportTo: "",
    directReports: [],
    isAbsent: false,
    photo: "",
    photoPublicId: "",
  });
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);

  useEffect(() => {
    if (employee) {
      setFormData({
        photo: employee.profile?.photo || "",
        fullName: employee.fullName,
        email: employee.email,
        username: employee.username || "",
        birthday: employee.profile?.birthday?.split("T")[0] || "",
        bio: employee.profile?.bio || "",
        position: employee.employeeDetails?.position?._id || "",
        dateStarted:
          employee.employeeDetails?.dates?.dateStarted?.split("T")[0] || "",

        status: employee.employeeDetails?.employmentStatus?.state || "Active",
        reasonForTermination:
          employee.employeeDetails?.employmentStatus?.reasonForTermination ||
          "",
        isAbsent: employee.employeeDetails?.employmentStatus?.isAbsent || false,
        reportTo:
          typeof employee.employeeDetails?.reportTo === "object"
            ? employee.employeeDetails?.reportTo?._id || ""
            : employee.employeeDetails?.reportTo || "",
        directReports: employee.employeeDetails?.directReports || [],
      });
    }
  }, [employee]);

  // 1) Filter positions when ADDING
  const filteredPositions = useMemo(
    () =>
      isAdd
        ? filterPositionsForAdd(loggedInUser, positionsData)
        : positionsData,
    [isAdd, loggedInUser, positionsData]
  );

  const selectedPosition =
    filteredPositions.find((p) => p._id === formData.position) || null;
  const rtc = reportToConstraints(loggedInUser, selectedPosition);

  useEffect(() => {
    if (!isAdd) return;
    setFormData((prev) => {
      if (rtc.ownerNoManager) return { ...prev, reportTo: "" };
      if (
        rtc.lock &&
        rtc.requiredReportToId &&
        prev.reportTo !== rtc.requiredReportToId
      ) {
        return { ...prev, reportTo: rtc.requiredReportToId };
      }
      return prev;
    });
  }, [isAdd, rtc.lock, rtc.requiredReportToId, rtc.ownerNoManager]);

  const selectedReportToId = formData.reportTo;
  const positionMode = isAdd ? "add" : isEdit ? "edit" : "view";

  // Only show assignable positions
  const positionOptions = useMemo(() => {
    if (!isAdd) return positionsData;

    // Otherwise, filter by permissions
    return positionsData.filter((p) =>
      canAssignPosition({
        actor: loggedInUser,
        positionMode,
        employee, // null on add
        position: p,
        selectedReportToId, // used for 1-level-below rule on add
      })
    );
  }, [
    positionsData,
    isAdd,
    loggedInUser,
    positionMode,
    employee,
    selectedReportToId,
  ]);

  const isLastStep = activeStep === steps.length - 1;
  const showNextBtn = !(isView && isLastStep);
  const visibleErrors = Object.entries(errors).filter(([, msg]) =>
    Boolean(msg)
  );

  // If user picks a position then changes reportTo such that it’s no longer valid,
  // clear the position to avoid illegal state.
  useEffect(() => {
    if (!formData.position) return;
    const stillOk = positionOptions.some((p) => p._id === formData.position);
    if (!stillOk) {
      setFormData((prev) => ({ ...prev, position: "" }));
    }
  }, [positionOptions, formData.position, setFormData]);

  const fetchAllData = useCallback(() => {
    Promise.all([dispatch(fetchAllPositions())]);
    Promise.all([dispatch(fetchAllEmployees())]);
  }, [dispatch]);

  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  const handleRefresh = () => {
    fetchAllData();
  };

  const hasError = (field) => !!errors[field];

  const uploadImage = async (file) => {
    const formData = new FormData();
    formData.append("photo", file);
    const res = await api.post("/users/upload-image", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });

    const { photo, photoPublicId } = res.data.data;
    return { photo, photoPublicId };
  };

  const handleFileChange = async (e, type) => {
    if (uploadingImage) {
      return;
    }

    const file = e.target.files[0];
    if (!file) return;

    setUploadingImage(true);

    if (!isFileValid(file, type)) {
      setErrors((prev) => ({
        ...prev,
        [type === "image" ? "photo" : "video"]:
          "Invalid file type or too large",
      }));
      setUploadingImage(false);
      return;
    }

    try {
      const uploadFn = uploadImage;
      const result = await uploadFn(file); // { photo, photoPublicId } or { video, videoPublicId }
      if (type === "image") {
        setFormData((prev) => ({
          ...prev,
          photo: result.photo,
          photoPublicId: result.photoPublicId,
        }));
      } else {
        setFormData((prev) => ({
          ...prev,
          video: result.video,
          videoPublicId: result.videoPublicId,
        }));
      }

      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[type === "image" ? "photo" : "video"];
        return newErrors;
      });
    } catch (err) {
      setErrors((prev) => ({
        ...prev,
        [type === "image" ? "photo" : "video"]:
          err.response?.data?.message || "Upload failed",
      }));
    } finally {
      setUploadingImage(false);
    }
  };

  const handleChange = (field, value) => {
    setFormData({ ...formData, [field]: value });
  };

  const handleNext = () => {
    if (activeStep === steps.length - 1) {
      handleReviewClick();
    } else {
      setActiveStep((prev) => prev + 1);
    }
  };

  const handleBack = () => setActiveStep((prev) => prev - 1);

  const handleReviewClick = () => {
    const newErrors = {};

    if (!formData.fullName.trim())
      newErrors.fullName = "Full Name is required.";
    if (!formData.email.trim()) newErrors.email = "Email is required.";

    if (!formData.username.trim()) newErrors.username = "Username is required.";
    if (!formData.dateStarted)
      newErrors.dateStarted = "Date Started is required.";
    if (!formData.position) newErrors.position = "Position is required.";

    const selectedPositionName = positionsData.find(
      (p) => p._id === formData.position
    )?.name;

    if (isAdd && selectedPositionName !== "Owner" && !formData.reportTo) {
      newErrors.reportTo = "Report To is required unless position is 'Owner'.";
    }

    if (
      isEdit &&
      formData.status === "Terminated" &&
      !formData.reasonForTermination.trim()
    ) {
      newErrors.reasonForTermination =
        "If you're going to terminate someone, the reason for termination needs to be listed.";
    }

    setErrors(newErrors);
    if (Object.keys(newErrors).length === 0) {
      setReviewDialogOpen(true);
    }
  };

  const handleCreateOrSave = async () => {
    try {
      const cleanedDirectReports = [
        ...new Set(
          formData.directReports.filter((id) => id && id !== employee?._id)
        ),
      ];
      const payload = {
        fullName: formData.fullName,
        email: formData.email,
        username: formData.username.toLowerCase(),
        birthday: formData.birthday,
        bio: formData.bio,
        photo: formData.photo,
        photoPublicId: formData.photoPublicId,
        role: "employee",
        employeeDetails: {
          position: formData.position,
          reportTo: formData.reportTo,
          directReports: cleanedDirectReports,
          dates: {
            dateStarted: formData.dateStarted,
          },
          employmentStatus: {
            state: formData.status,
            isAbsent: formData.isAbsent,
            reasonForTermination: formData.reasonForTermination || "",
          },
        },
      };

      let response;

      if (
        isEdit &&
        formData.status === "Terminated" &&
        formData.reasonForTermination
      ) {
        // ✅ First, update the employee normally
        await api.put(`/users/${employee._id}`, payload);

        // ✅ Then call the termination route
        response = await api.put(`/users/${employee._id}/terminate`, {
          reasonForTermination: formData.reasonForTermination,
        });
      } else {
        // Regular update or create
        response = isEdit
          ? await api.put(`/users/${employee._id}`, payload)
          : await api.post("/users/register", payload);
      }

      handleRefresh();
      setSuccessMessage(response.data.message);

      if (isAdd) {
        setFormData({
          fullName: "",
          email: "",
          username: "",
          password: "",
          position: "",
          dateStarted: "",
          birthday: "",
          bio: "",
          status: "Active",
          reasonForTermination: "",
          reportTo: "",
          directReports: [],
          isAbsent: false,
          photo: "",
        });
        setUploadingImage(false);
        setActiveStep(0);
      }

      setTimeout(() => {
        setSuccessMessage("");
      }, 5000);
    } catch (error) {
      console.error("Create/Save Error:", error);

      const msg =
        error?.response?.data?.message ||
        error?.message ||
        "Something went wrong. Please try again.";
      const recs = error?.response?.data?.recommended;

      // If backend says username is taken and provides recs, show them
      if (/username/i.test(msg) && Array.isArray(recs) && recs.length) {
        setErrors((prev) => ({
          ...prev,
          username: "Username is already taken.",
        }));
        setUsernameRecs(recs.map((u) => String(u).toLowerCase()));
        setReviewDialogOpen(false); // bring them back to form to choose a suggestion
        setActiveStep(0); // ensure they see the username field
      } else {
        setErrors({ api: msg });
      }
    } finally {
      setReviewDialogOpen(false);
      setActiveStep(0);
      // setTimeout(() => {
      //   onClose?.();
      // }, 500);
    }
  };

  const handleDelete = async () => {
    try {
      await api.delete(`/users/${employee._id}/delete`);
      handleRefresh();
      setSuccessMessage("Employee deleted successfully.");
      // delay before closing drawer
      setTimeout(() => {
        setSuccessMessage("");
      }, 500); // 5 seconds to show success message
    } catch (error) {
      setErrors({ api: error?.response?.data?.message || "Delete failed." });
    } finally {
      setDeleteDialogOpen(false);
      setTimeout(() => {
        onClose?.();
      }, 500);
    }
  };

  const passwordValidations = [
    {
      label: "At least 6 characters",
      isValid: formData.password.length >= 6,
    },
    {
      label: "One uppercase letter",
      isValid: /[A-Z]/.test(formData.password),
    },
    {
      label: "One lowercase letter",
      isValid: /[a-z]/.test(formData.password),
    },
    {
      label: "One special character",
      isValid: /[!@#$%^&*(),.?":{}|<>]/.test(formData.password),
    },
  ];

  const filteredDirectReports = employeesData.filter(
    (emp) =>
      emp._id !== employee?._id && // exclude self
      emp._id !== formData.reportTo && // exclude current manager
      emp.employeeDetails?.position?.name?.toLowerCase() !== "owner" && // exclude owners
      !emp.employeeDetails?.reportTo && // exclude users who already report to someone
      emp.fullName.toLowerCase().includes(searchDirect.toLowerCase())
  );

  return (
    <Box sx={{ p: 3 }}>
      <IconButton
        onClick={onClose}
        sx={{
          position: "absolute",
          top: 8,
          right: 8,
          zIndex: 1,
          color: "grey.600",
        }}
      >
        <CloseIcon />
      </IconButton>

      <Stepper activeStep={activeStep} alternativeLabel>
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
      <Collapse in={visibleErrors.length > 0}>
        <Box
          sx={{
            mb: 2,
            maxHeight: 150,
            overflowX: "auto",
            overflowY: "auto",
            width: "100%",
            borderRadius: 2,
          }}
        >
          <Alert
            severity="error"
            onClose={() => setErrors({})}
            sx={{
              minWidth: "fit-content",
              width: "100%",
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
            }}
          >
            <ul>
              {visibleErrors.map(([field, msg], idx) => (
                <li key={idx}>{msg}</li>
              ))}
            </ul>
          </Alert>
        </Box>
      </Collapse>
      <Collapse in={!!successMessage}>
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccessMessage("")}>
          {successMessage}
        </Alert>
      </Collapse>

      {/* Basic Info Step */}
      {activeStep === 0 && (
        <Box sx={{ mt: 3 }}>
          <Box
            sx={{
              position: "relative",
              width: 100,
              height: 100,
              mx: "auto",
              cursor: uploadingImage ? "not-allowed" : "pointer",
              opacity: uploadingImage ? 0.6 : 1,
              pointerEvents: uploadingImage ? "none" : "auto",
            }}
            onClick={() => !uploadingImage && photoInputRef.current?.click()}
          >
            <Avatar
              src={formData.photo}
              sx={{ width: 100, height: 100 }}
              alt={formData.fullName ? formData.fullName : ""}
            />

            {(isEdit || isAdd) && (
              <>
                <input
                  type="file"
                  hidden
                  accept="image/*"
                  disabled={uploadingImage}
                  onChange={(e) => handleFileChange(e, "image")}
                  ref={photoInputRef}
                />
                <IconButton
                  sx={{
                    position: "absolute",
                    bottom: 0,
                    right: 0,
                    backgroundColor: "var(--primary-color)",
                    color: "white",
                    boxShadow: 1,
                    pointerEvents: "none", // <- prevent double open from click bubbling
                  }}
                >
                  {uploadingImage && (
                    <CircularProgress
                      sx={{ position: "absolute", top: -2, right: -2 }}
                    />
                  )}
                  <CameraAlt fontSize="small" />
                </IconButton>
              </>
            )}
          </Box>

          <Typography variant="h6" align="center" mt={2}>
            {isAdd ? "Add New Employee" : formData.fullName}
          </Typography>

          <TextField
            label="Full Name"
            fullWidth
            margin="normal"
            value={formData.fullName ?? ""}
            onChange={(e) => handleChange("fullName", e.target.value)}
            disabled={isView}
            error={hasError("fullName")}
            helperText={hasError("fullName") ? "Full Name is required." : ""}
          />

          <TextField
            label="Email"
            fullWidth
            margin="normal"
            value={formData.email ?? ""}
            disabled={isView || isEdit}
            onChange={(e) => handleChange("email", e.target.value)}
            error={hasError("email")}
            helperText={hasError("email") ? "Email is required." : ""}
          />

          <TextField
            label="Username"
            fullWidth
            margin="normal"
            value={formData.username ?? ""}
            disabled={isView || isEdit}
            onChange={(e) => {
              const v = e.target.value.toLowerCase(); // keep lowercase
              handleChange("username", v);
              setErrors((prev) => {
                const { username, ...rest } = prev;
                return rest;
              });

              setUsernameRecs([]); // clear old recs as they type
            }}
            error={hasError("username")}
            helperText={
              hasError("username") ? errors.username : "Lowercase only"
            }
          />

          {/* Suggestions list, shown if backend sent recommendations */}
          {!isView && usernameRecs.length > 0 && (
            <Alert severity="warning" onClose={() => setUsernameRecs([])} sx={{ mt: 1 }}>
              <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
                That username is taken. Try one of these:
              </Typography>
              {usernameRecs.length > 0 && (
                <ul style={{ margin: 0, paddingLeft: 16 }}>
                  {usernameRecs?.map((u) => (
                    <li key={u}>
                      <Button
                        variant="text"
                        size="small"
                        onClick={() => {
                          const lower = String(u).toLowerCase();
                          setFormData((f) => ({ ...f, username: lower }));
                          setErrors((e) => ({ ...e, username: undefined }));
                          setUsernameRecs([]); // hide suggestions once chosen
                        }}
                      >
                        {String(u).toLowerCase()}
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </Alert>
          )}

          {isAdd && (
            <Alert severity="info" sx={{ mt: 2, mb: 1 }}>
              The employee will receive a secure, single-use link to create
              their password. The link expires after 30 minutes.
            </Alert>
          )}
          <TextField
            label="Birthday"
            type={isView ? "text" : "date"}
            fullWidth
            margin="normal"
            value={
              isView && formData.birthday
                ? dayjs(formData.birthday).format("MMMM D")
                : formData.birthday ?? ""
            }
            onChange={(e) => handleChange("birthday", e.target.value)}
            disabled={isView}
            InputLabelProps={{ shrink: true }}
          />

          <TextField
            label="Bio"
            fullWidth
            margin="normal"
            multiline
            rows={3}
            value={formData.bio ?? ""}
            onChange={(e) => handleChange("bio", e.target.value)}
            disabled={isView}
          />
        </Box>
      )}

      {/* Employment Step */}
      {activeStep === 1 && (
        <Box sx={{ mt: 3 }}>
          <Autocomplete
            fullWidth
            disabled={
              isView ||
              (isEdit && loggedInUser._id === employee._id) || // ❌ block self-editing position
              (isEdit && !canEditUser(loggedInUser, employee)) // ❌ block if user can't edit this employee
            }
            options={positionOptions}
            getOptionLabel={(option) =>
              typeof option === "string" ? option : option?.name ?? ""
            }
            // ✅ derive value from *options* so references match
            value={
              positionOptions.find((p) => idEqual(p._id, formData.position)) ||
              null
            }
            // ✅ tell MUI how to compare objects by _id
            isOptionEqualToValue={(option, value) =>
              idEqual(option?._id, value?._id)
            }
            onChange={(e, newValue) =>
              handleChange("position", newValue ? newValue._id : "")
            }
            renderInput={(params) => (
              <TextField
                {...params}
                label="Position"
                margin="normal"
                error={hasError("position")}
                helperText={
                  hasError("position")
                    ? "Position is required."
                    : positionOptions.length === 0
                    ? "No positions available with your permissions."
                    : ""
                }
              />
            )}
          />

          <TextField
            label="Date Started"
            type="date"
            fullWidth
            margin="normal"
            value={formData.dateStarted ?? ""}
            onChange={(e) => handleChange("dateStarted", e.target.value)}
            InputLabelProps={{ shrink: true }}
            disabled={
              isView ||
              (isEdit && loggedInUser._id === employee._id) || // ❌ block self-editing position
              (isEdit && !canEditUser(loggedInUser, employee)) // ❌ block if user can't edit this employee
            }
            error={hasError("dateStarted")}
            helperText={
              hasError("dateStarted") ? "Date Started is required." : ""
            }
          />

          {isEdit && (
            <FormControl fullWidth margin="normal">
              <InputLabel>Status</InputLabel>
              <Select
                value={formData.status ?? ""}
                onChange={(e) => handleChange("status", e.target.value)}
                label="Status"
                disabled={
                  isView ||
                  (isEdit &&
                    loggedInUser._id === employee._id &&
                    employee.position !== "Owner") || // ❌ block self-edit unless Owner
                  (isEdit && !canEditUser(loggedInUser, employee)) // ❌ block if user can't edit this employee
                }
              >
                <MenuItem value="Active">Active</MenuItem>
                <MenuItem value="Inactive">Inactive</MenuItem>
                <MenuItem value="Terminated">Terminated</MenuItem>
              </Select>
              {hasError("status") && (
                <FormHelperText>Status is required.</FormHelperText>
              )}
            </FormControl>
          )}

          {isEdit && formData.status === "Terminated" && (
            <FormControl fullWidth margin="normal" variant="outlined">
              <InputLabel id="termination-reason-label">
                Reason for Termination
              </InputLabel>
              <Select
                labelId="termination-reason-label"
                label="Reason for Termination"
                value={formData.reasonForTermination ?? ""}
                onChange={(e) =>
                  handleChange("reasonForTermination", e.target.value)
                }
                disabled={
                  isView ||
                  (isEdit && loggedInUser._id === employee._id) ||
                  (isEdit && !canEditUser(loggedInUser, employee))
                }
              >
                {terminationReasons.map((reason, idx) => (
                  <MenuItem key={idx} value={reason}>
                    {reason}
                  </MenuItem>
                ))}
              </Select>
              {hasError("reasonForTermination") && (
                <FormHelperText>
                  Reason for termination is required.
                </FormHelperText>
              )}
            </FormControl>
          )}

          {!isAdd && (
            <FormControlLabel
              control={
                <Checkbox
                  checked={formData.isAbsent}
                  disabled={isView}
                  onChange={(e) => handleChange("isAbsent", e.target.checked)}
                />
              }
              label="Is Absent"
            />
          )}
        </Box>
      )}

      {/* Structure Step */}
      {activeStep === 2 && (
        <Box sx={{ mt: 3 }}>
          <Autocomplete
            fullWidth
            disabled={
              isView ||
              (isEdit && loggedInUser._id === employee._id) || // ❌ block self-editing position
              (isEdit && !canEditUser(loggedInUser, employee)) || // ❌ block if user can't edit this employee
              rtc.lock ||
              rtc.ownerNoManager
            }
            options={employeesData}
            getOptionLabel={(option) => option.fullName}
            value={
              employeesData.find((emp) => emp._id === formData.reportTo) || null
            }
            onChange={(e, newValue) =>
              handleChange("reportTo", newValue ? newValue._id : "")
            }
            isOptionEqualToValue={(option, value) => option._id === value._id}
            renderOption={(props, option) => (
              <Box
                component="li"
                {...props}
                display="flex"
                alignItems="center"
                gap={1}
              >
                <Avatar
                  src={option.profile?.photo}
                  sx={{ width: 24, height: 24 }}
                />
                {option.fullName}
              </Box>
            )}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Reports To"
                margin="normal"
                helperText={
                  rtc.helper ||
                  (hasError("reportTo")
                    ? "Report To is required for this position."
                    : "")
                }
                error={Boolean(rtc.helper) || hasError("reportTo")}
              />
            )}
          />
          {isView ? (
            <List dense>
              {employeesData
                .filter((emp) => formData.directReports.includes(emp._id))
                .map((emp) => (
                  <ListItem key={emp._id}>
                    <ListItemAvatar>
                      <Avatar src={emp.profile?.photo} />
                    </ListItemAvatar>
                    <ListItemText primary={emp.fullName} />
                  </ListItem>
                ))}
            </List>
          ) : (
            <FormControl fullWidth margin="normal">
              {filteredDirectReports.length > 0 && (
                <TextField
                  placeholder="Search for direct reports..."
                  fullWidth
                  value={searchDirect}
                  onChange={(e) => setSearchDirect(e.target.value)}
                  size="small"
                  sx={{ mb: 1 }}
                />
              )}
              <TextField
                placeholder="Search for direct reports..."
                fullWidth
                value={searchDirect}
                onChange={(e) => setSearchDirect(e.target.value)}
                size="small"
                sx={{ mb: 1 }}
              />

              <Box
                sx={{
                  maxHeight: 220,
                  overflowY: "auto",
                  border: "1px solid #ccc",
                  borderRadius: 1,
                  p: 1,
                }}
              >
                {filteredDirectReports.length > 0 ? (
                  filteredDirectReports.map((emp) => (
                    <Box key={emp._id} display="flex" alignItems="center">
                      <Checkbox
                        checked={formData.directReports.includes(emp._id)}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setFormData((prev) => ({
                            ...prev,
                            directReports: checked
                              ? [...prev.directReports, emp._id]
                              : prev.directReports.filter(
                                  (id) => id !== emp._id
                                ),
                          }));
                        }}
                      />
                      <Avatar
                        src={emp.profile?.photo}
                        sx={{ width: 24, height: 24, mr: 1 }}
                      />
                      <Typography>{emp.fullName}</Typography>
                    </Box>
                  ))
                ) : (
                  <Typography>No direct reports to select.</Typography>
                )}
              </Box>
              {formData.directReports.length > 0 && (
                <Box sx={{ mt: 1 }}>
                  <Typography variant="caption" fontWeight="bold">
                    Selected Direct Reports:
                  </Typography>
                  <Box
                    sx={{
                      maxHeight: 220,
                      overflowY: "auto",
                      border: "1px solid #ccc",
                      borderRadius: 1,
                      p: 1,
                    }}
                  >
                    <List dense>
                      {employeesData
                        .filter((emp) =>
                          formData.directReports.includes(emp._id)
                        )
                        .map((emp) => (
                          <ListItem key={emp._id}>
                            <ListItemAvatar>
                              <Avatar src={emp.profile?.photo} />
                            </ListItemAvatar>
                            <ListItemText primary={emp.fullName} />
                          </ListItem>
                        ))}
                    </List>
                  </Box>
                </Box>
              )}
              {formData.directReports.length > 0 && (
                <Button
                  variant="outlined"
                  color="secondary"
                  size="small"
                  onClick={() =>
                    setFormData((prev) => ({ ...prev, directReports: [] }))
                  }
                  sx={{ mb: 1 }}
                >
                  Clear All Direct Reports
                </Button>
              )}
            </FormControl>
          )}
        </Box>
      )}

      {/* Review Step */}
      {activeStep === 3 &&
        (isView ? (
          <ActivityLogsTable entityId={employee?._id} entityModel="User" />
        ) : (
          <Box sx={{ mt: 3 }}>
            <Typography>Click Review to see employee summary.</Typography>
            {Object.keys(errors).length > 0 && (
              <Box sx={{ mt: 2 }}>
                <Typography color="error" variant="subtitle1">
                  Please address the following errors before reviewing:
                </Typography>
                <List>
                  {Object.entries(errors).map(([key, msg]) => (
                    <ListItem key={key}>
                      <ListItemText
                        sx={{ color: red[500] }}
                        primary={`- ${msg}`}
                      />
                    </ListItem>
                  ))}
                </List>
              </Box>
            )}
          </Box>
        ))}

      {/* Step Controls */}
      <Box sx={{ display: "flex", justifyContent: "space-between", mt: 4 }}>
        <Button disabled={activeStep === 0} onClick={handleBack}>
          Back
        </Button>
        {showNextBtn && (
          <Button variant="contained" onClick={handleNext}>
            {isLastStep ? "Review" : "Next"}
          </Button>
        )}
      </Box>

      {/* Delete button shown only on final step in edit mode */}
      {isEdit &&
        employee &&
        employee.employeeDetails.employmentStatus.state === "Terminated" &&
        activeStep === steps.length - 1 && (
          <Box sx={{ display: "flex", justifyContent: "flex-start", mt: 2 }}>
            <Button
              variant="outlined"
              color="error"
              onClick={() => setDeleteDialogOpen(true)}
            >
              Delete Employee
            </Button>
          </Box>
        )}

      {/* Review Dialog */}
      <Dialog
        open={reviewDialogOpen}
        onClose={() => setReviewDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Review Employee Details</DialogTitle>
        <DialogContent>
          <Box display="flex" flexDirection="column" alignItems="center" mb={2}>
            <Avatar
              src={formData.photo}
              sx={{ width: 80, height: 80, mb: 1 }}
            />
            <Typography variant="h6">{formData.fullName}</Typography>
            <Typography variant="body2" color="textSecondary">
              {formData.email}
            </Typography>
            <Typography variant="body2" color="textSecondary">
              {formData.username}
            </Typography>
          </Box>

          <List dense>
            {isAdd && (
              <ListItem>
                <ListItemText
                  primary="Account activation"
                  secondary="A secure password-creation link will be emailed."
                />
              </ListItem>
            )}

            <ListItem>
              <ListItemText
                primary="Birthday"
                secondary={
                  formData.birthday
                    ? dayjs(formData.birthday).format("MMMM D")
                    : "N/A"
                }
              />
            </ListItem>

            <ListItem>
              <ListItemText primary="Bio" secondary={formData.bio || "N/A"} />
            </ListItem>

            <ListItem>
              <ListItemText
                primary="Position"
                secondary={
                  positionsData.find((p) => p._id === formData.position)
                    ?.name || "N/A"
                }
              />
            </ListItem>

            <ListItem>
              <ListItemText
                primary="Date Started"
                secondary={
                  formData.dateStarted
                    ? dayjs(formData.dateStarted).format("MMMM D, YYYY")
                    : "N/A"
                }
              />
            </ListItem>

            {isEdit && (
              <>
                <ListItem>
                  <ListItemText
                    primary="Status"
                    secondary={formData.status || "N/A"}
                  />
                </ListItem>

                {["Terminated"].includes(formData.status) && (
                  <>
                    {formData.reasonForTermination && (
                      <ListItem>
                        <ListItemText
                          primary="Reason for Termination"
                          secondary={formData.reasonForTermination}
                        />
                      </ListItem>
                    )}

                    {formData.suspensionStartDate && (
                      <ListItem>
                        <ListItemText
                          primary="Suspension Start"
                          secondary={dayjs(formData.suspensionStartDate).format(
                            "MMMM D, YYYY"
                          )}
                        />
                      </ListItem>
                    )}

                    {formData.suspensionEndDate && (
                      <ListItem>
                        <ListItemText
                          primary="Suspension End"
                          secondary={dayjs(formData.suspensionEndDate).format(
                            "MMMM D, YYYY"
                          )}
                        />
                      </ListItem>
                    )}
                  </>
                )}
              </>
            )}

            <ListItem>
              <ListItemText
                primary="Is Absent"
                secondary={formData.isAbsent ? "Yes" : "No"}
              />
            </ListItem>

            <ListItem>
              <ListItemText
                primary="Reports To"
                secondary={
                  employeesData.find((e) => e._id === formData.reportTo)
                    ?.fullName || "N/A"
                }
              />
            </ListItem>

            <ListItem>
              <ListItemText
                primary="Direct Reports"
                secondary={
                  formData.directReports.length > 0
                    ? formData.directReports
                        .map(
                          (id) =>
                            employeesData.find((e) => e._id === id)?.fullName ||
                            "Unknown"
                        )
                        .join(", ")
                    : "None"
                }
              />
            </ListItem>
          </List>
        </DialogContent>

        <DialogActions>
          <Button onClick={() => setReviewDialogOpen(false)} color="secondary">
            Cancel
          </Button>
          <Button
            onClick={handleCreateOrSave}
            startIcon={isEdit ? <Save /> : <Add />}
            variant="contained"
            color="primary"
          >
            {isEdit ? "Save Employee" : "Create Employee"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
      >
        <DialogTitle>Confirm Deletion</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete this employee? This action cannot be
            undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)} color="primary">
            Cancel
          </Button>
          <Button onClick={handleDelete} color="error" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default AdminEmployeeForm;
