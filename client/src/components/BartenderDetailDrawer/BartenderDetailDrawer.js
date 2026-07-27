// components/AdminBartenders/BartenderDetailDrawer.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useSelector } from "react-redux";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Avatar,
  Box,
  Button,
  Chip,
  Divider,
  Drawer,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Stack,
  Tab,
  Tabs,
  Typography,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  InputAdornment,
  MenuItem,
  Select,
  TextField,
} from "@mui/material";
import {
  CheckCircle,
  ExpandMore,
  RadioButtonUnchecked,
} from "@mui/icons-material";
import { DataGrid } from "@mui/x-data-grid";
import api from "../../services/api";
import DetailDrawerHeader from "../DetailDrawerHeader/DetailDrawerHeader";
import ActivityLogsTable from "../ActivityLogsTable/LazyActivityLogsTable";

const stepsLabels = ["User", "Details", "Documents", "Rewards", "Activity"];
const tabsSx = {
  "& .MuiTab-root.Mui-selected": {
    color: "var(--primary-color)",
  },
  "& .MuiTabs-indicator": {
    backgroundColor: "var(--primary-color)",
  },
};

const statusChipProps = (status) => {
  switch (status) {
    case "approved":
      return { label: "Approved", color: "success", variant: "filled" };
    case "denied":
      return { label: "Denied", color: "error", variant: "filled" };
    case "applicant":
    default:
      return { label: "Applicant", color: "warning", variant: "filled" };
  }
};

const REASON_OPTIONS = [
  { value: "incomplete_courses", label: "Required courses incomplete" },
  { value: "invalid_license", label: "License invalid or expired" },
  { value: "missing_payment_method", label: "Missing payment method" },
  { value: "insufficient_experience", label: "Insufficient experience" },
  { value: "policy_violation", label: "Policy / conduct concerns" },
  { value: "other", label: "Other (specify)" },
];

const ONBOARDING_DOCUMENTS = [
  { key: "w9", title: "W-9", summary: "Tax identity and taxpayer information." },
  {
    key: "independent_contractor",
    title: "Independent Contractor Agreement",
    summary: "Contractor status, event expectations, payment, and confidentiality.",
  },
  {
    key: "service_standards",
    title: "Service Standards Acknowledgement",
    summary: "Attendance, conduct, alcohol safety, and incident reporting.",
  },
];
const DOCUMENT_TASK_TYPES = ["documents", "sign_documents", "signed_documents"];
const PROFILE_TASK_TYPES = ["profile", "approval", "bartender_profile", "profile_approved"];

const DOCUMENT_STATUS_OPTIONS = [
  { value: "not_sent", label: "Not Sent" },
  { value: "sent", label: "Sent" },
  { value: "received", label: "Received" },
  { value: "rejected", label: "Rejected / Needs Correction" },
  { value: "expired", label: "Expired / Needs Renewal" },
];

const documentStatusColor = (status) => {
  if (status === "received") return "success";
  if (status === "sent") return "info";
  if (["rejected", "expired"].includes(status)) return "error";
  return "default";
};

const titleize = (value) =>
  String(value || "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());

const formatAddressLines = (address = {}) =>
  [
    address.fullName,
    address.address1,
    address.address2,
    [address.city, address.state, address.zipcode].filter(Boolean).join(", "),
    address.country,
    address.instructions ? `Instructions: ${address.instructions}` : "",
  ].filter(Boolean);

const formatPhone = (value) => {
  const raw = String(value || "").trim();
  if (!raw) return "Not provided";
  const digits = raw.replace(/\D/g, "");
  const national = digits.length === 11 && digits.startsWith("1")
    ? digits.slice(1)
    : digits;
  if (national.length === 10) {
    return `(${national.slice(0, 3)}) ${national.slice(3, 6)}-${national.slice(6)}`;
  }
  return raw;
};

const formatDateTime = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString([], {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};

const DetailLine = ({ label, value }) => (
  <Stack spacing={0.25} sx={{ minWidth: 0 }}>
    <Typography variant="caption" color="text.secondary">
      {label}
    </Typography>
    <Typography variant="body2" fontWeight={700} sx={{ wordBreak: "break-word" }}>
      {value || "Not provided"}
    </Typography>
  </Stack>
);

const getClaimAnswers = (claim = {}) => {
  const answers = Array.isArray(claim.answers) ? [...claim.answers] : [];
  if (claim.shirtSize && !answers.some((answer) => answer.key === "shirtSize")) {
    answers.push({ key: "shirtSize", label: "Size", value: claim.shirtSize });
  }
  if (claim.poloColor && !answers.some((answer) => answer.key === "poloColor")) {
    answers.push({ key: "poloColor", label: "Polo color", value: claim.poloColor });
  }
  if (
    claim.personalizationText &&
    !answers.some((answer) => answer.key === "personalizationText")
  ) {
    answers.push({
      key: "personalizationText",
      label: "Personalization text",
      value: claim.personalizationText,
    });
  }
  return answers.filter((answer) => answer?.value);
};

const BartenderDetailDrawer = ({
  open,
  onClose,
  bartender,      // payload from viewBartenderById
  onApprove,      // (note) => void
  onDeny,         // (note) => void
  actionLoading = false,
}) => {
  const [activeStep, setActiveStep] = useState(0);

  // Dialog state for denial reason
  const [denyDialogOpen, setDenyDialogOpen] = useState(false);
  const [denyReason, setDenyReason] = useState("");
  const [denyCustomReason, setDenyCustomReason] = useState("");
  const [rewardInfo, setRewardInfo] = useState(null);
  const [sendRewardConfirm, setSendRewardConfirm] = useState(null);
  const [sendingRewardId, setSendingRewardId] = useState(null);
  const [rewardClaimOverrides, setRewardClaimOverrides] = useState({});
  const [documentRows, setDocumentRows] = useState([]);
  const [documentAlert, setDocumentAlert] = useState(null);
  const [savingDocumentKey, setSavingDocumentKey] = useState(null);
  const [compensationForm, setCompensationForm] = useState({
    hourlyRate: 40,
    maxHourlyRate: 60,
    annualIncrease: 2,
  });
  const [savingCompensation, setSavingCompensation] = useState(false);

  const loggedInUser = useSelector(
    (state) => state.users.loggedInUser?.user || state.users.loggedInUser
  );
  const userInfo = bartender?.user;
  const bartenderUserId = bartender?.bartenderId || userInfo?._id || userInfo?.id;
  const profile = bartender?.bartenderProfile;
  const contactInfo =
    profile?.contactInfo ||
    userInfo?.bartenderProfile?.contactInfo ||
    {};
  const emergencyContact = contactInfo?.emergencyContact || {};
  const eligibility = bartender?.eligibility;
  const actorPositionName = String(
    loggedInUser?.employeeDetails?.position?.name ||
      loggedInUser?.positionName ||
      ""
  ).toLowerCase();
  const canEditCompensation =
    actorPositionName === "owner" || actorPositionName === "owners";

  const chip = statusChipProps(userInfo?.bartenderStatus);

  const checklist = useMemo(
    () => (Array.isArray(eligibility?.steps) ? eligibility.steps : []),
    [eligibility?.steps]
  );
  const stats = profile?.stats || {};
  const compensation = profile?.compensation || {};
  const currentHourlyRate = Number(compensation.hourlyRate) || 40;
  const maxHourlyRate = Number(compensation.maxHourlyRate) || 60;
  const annualIncrease = Number(compensation.annualIncrease) || 0;
  const displayedHourlyRate =
    Number(compensationForm.hourlyRate) || currentHourlyRate;
  const displayedMaxHourlyRate =
    Number(compensationForm.maxHourlyRate) || maxHourlyRate;
  const displayedAnnualIncrease =
    Number(compensationForm.annualIncrease) || annualIncrease;
  const reviews = bartender?.reviews || [];
  const rewards = bartender?.rewards || {};
  const rewardMilestones = useMemo(
    () => (Array.isArray(rewards?.milestones) ? rewards.milestones : []),
    [rewards?.milestones]
  );
  const effectiveRewardMilestones = useMemo(
    () =>
      rewardMilestones.map((reward) => {
        const claimId = reward.claim?._id;
        const override = claimId ? rewardClaimOverrides[claimId] : null;
        return override
          ? { ...reward, claim: { ...reward.claim, ...override } }
          : reward;
      }),
    [rewardClaimOverrides, rewardMilestones]
  );
  const statsCards = [
    ["Years with Tipsyverse", stats.yearsWithTipsyverse ?? 0],
    ["Total Experience (yrs)", stats.totalExperienceYears ?? 0],
    ["Jobs Accepted (30d)", stats.jobsAcceptedLast30d ?? 0],
    ["Upcoming Assignments", stats.upcomingAssignments ?? 0],
    [
      "Rating Avg",
      typeof stats.ratingAvg === "number" ? `${stats.ratingAvg.toFixed(1)}/5` : "0.0/5",
    ],
    ["Rating Count", stats.ratingCount ?? 0],
  ];

  const allDocumentsReceived = useMemo(
    () =>
      documentRows.length > 0 &&
      ONBOARDING_DOCUMENTS.every((doc) => {
        const row = documentRows.find((item) => item.key === doc.key);
        return row?.status === "received";
      }),
    [documentRows]
  );

  const drawerChecklist = useMemo(() => {
    const hasDocumentsTask = checklist.some((step) =>
      DOCUMENT_TASK_TYPES.includes(step.key || step.type)
    );
    const withDocuments = hasDocumentsTask
      ? checklist.map((step) =>
          DOCUMENT_TASK_TYPES.includes(step.key || step.type)
            ? {
                ...step,
                key: step.key || "sign_documents",
                label: "Sign all documents",
                type: "documents",
                done: step.done || allDocumentsReceived,
              }
            : step
        )
      : [
          ...checklist,
          {
            key: "sign_documents",
            label: "Sign all documents",
            type: "documents",
            done: allDocumentsReceived,
          },
        ];

    return [...withDocuments].sort((a, b) => {
      const aIsProfile = PROFILE_TASK_TYPES.includes(a.key || a.type);
      const bIsProfile = PROFILE_TASK_TYPES.includes(b.key || b.type);
      if (aIsProfile === bIsProfile) return 0;
      return aIsProfile ? 1 : -1;
    });
  }, [allDocumentsReceived, checklist]);

  const reviewsColumns = useMemo(
    () => [
      {
        field: "eventName",
        headerName: "Event",
        flex: 1,
        minWidth: 160,
        align: "center",
        headerAlign: "center",
      },
      {
        field: "rating",
        headerName: "Rating",
        width: 110,
        align: "center",
        headerAlign: "center",
        renderCell: (params) => (
          <Box
            sx={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Typography variant="body2">
              {params.value != null ? `${params.value}/5` : "-"}
            </Typography>
          </Box>
        ),
      },
      {
        field: "comment",
        headerName: "Comment",
        flex: 1.5,
        minWidth: 200,
        align: "center",
        headerAlign: "center",
      },
      {
        field: "createdAt",
        headerName: "Date",
        width: 140,
        align: "center",
        headerAlign: "center",
        renderCell: (params) => {
          if (!params.value) return "-";
          const d = new Date(params.value);
          return (
            <Typography variant="body2">
              {d.toLocaleDateString()}{" "}
              {d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </Typography>
          );
        },
      },
    ],
    []
  );

  useEffect(() => {
    const source =
      bartender?.documents ||
      bartender?.onboardingDocuments ||
      profile?.documents ||
      profile?.onboardingDocuments ||
      userInfo?.bartenderProfile?.documents ||
      userInfo?.bartenderProfile?.onboardingDocuments ||
      [];
    const existingByKey = {};

    (Array.isArray(source) ? source : []).forEach((doc) => {
      const key = doc?.key || doc?.documentKey;
      if (key) existingByKey[key] = doc;
    });

    setDocumentRows(
      ONBOARDING_DOCUMENTS.map((doc) => {
        const existing = existingByKey[doc.key] || {};
        return {
          ...doc,
          ...existing,
          key: doc.key,
          title: doc.title,
          summary: doc.summary,
          status: existing.status || "not_sent",
          sentAt: existing.sentAt ? String(existing.sentAt).slice(0, 10) : "",
          receivedAt: existing.receivedAt
            ? String(existing.receivedAt).slice(0, 10)
            : "",
          notes: existing.notes || "",
        };
      })
    );
    setDocumentAlert(null);
  }, [bartender, profile, userInfo]);

  useEffect(() => {
    const nextCompensation = profile?.compensation || {};
    setCompensationForm({
      hourlyRate: Number(nextCompensation.hourlyRate) || 40,
      maxHourlyRate: Number(nextCompensation.maxHourlyRate) || 60,
      annualIncrease: Number(nextCompensation.annualIncrease) || 2,
    });
  }, [profile?.compensation]);

  const currentStatus = (userInfo?.bartenderStatus || "").toLowerCase();
  const isProtectedAccount = ["tipsyverse", "alonzo.smiley"].includes(
    userInfo?.username?.toLowerCase()
  );
  const showApprove =
    !isProtectedAccount &&
    (currentStatus === "applicant" || currentStatus === "denied");

  const showDeny =
    !isProtectedAccount &&
    (currentStatus === "applicant" || currentStatus === "approved");

  const emergencyContactComplete =
    Boolean(emergencyContact?.fullName) && Boolean(emergencyContact?.phone);
  const completedEvents =
    stats.completedEvents ??
    stats.eventsCompleted ??
    stats.totalCompletedEvents ??
    rewards?.completedEvents ??
    0;
  const missingDocuments =
    documentRows.length > 0 && !allDocumentsReceived;
  const drawerSummary =
    currentStatus === "approved"
      ? !emergencyContactComplete
        ? "This bartender is approved but missing emergency contact information."
        : missingDocuments
          ? "This bartender is approved and still has onboarding documents pending."
          : "This bartender is approved and ready for event work."
      : currentStatus === "denied"
        ? "This bartender is denied. Review their details before changing eligibility."
        : "This bartender is applying and needs review before working events.";
  const headerFacts = [
    { label: "Email", value: userInfo?.email },
    { label: "Phone", value: formatPhone(contactInfo?.phone) },
    { label: "Events", value: `${completedEvents} completed` },
    { label: "Documents", value: allDocumentsReceived ? "Received" : "Pending" },
  ];
  const lastUpdatedAt =
    userInfo?.updatedAt ||
    profile?.updatedAt ||
    bartender?.updatedAt ||
    bartender?.lastUpdatedAt;
  
  const handleStepClick = (index) => {
    setActiveStep(index);
  };

  const handleClose = () => {
    setActiveStep(0);
    setDenyDialogOpen(false);
    setDenyReason("");
    setDenyCustomReason("");
    setSendRewardConfirm(null);
    onClose?.();
  };

  const buildDenyNote = () => {
    const option = REASON_OPTIONS.find((r) => r.value === denyReason);
    const label = option?.label || "";

    if (denyReason === "other") {
      return denyCustomReason?.trim() || label || "";
    }

    return denyCustomReason?.trim()
      ? `${label} - ${denyCustomReason.trim()}`
      : label;
  };

  const handleApproveClick = () => {
    // For now, approvals don't require a reason; you can extend this later.
    onApprove?.("");
  };

  const handleOpenDenyDialog = () => {
    setDenyDialogOpen(true);
  };

  const handleCloseDenyDialog = () => {
    setDenyDialogOpen(false);
    setDenyReason("");
    setDenyCustomReason("");
  };

  const handleConfirmDeny = () => {
    const note = buildDenyNote();
    onDeny?.(note);
    handleCloseDenyDialog();
  };

  const headerActions = showApprove || showDeny ? (
    <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
      {showDeny && (
        <Button
          variant="outlined"
          color="error"
          disabled={actionLoading}
          onClick={handleOpenDenyDialog}
          sx={{ whiteSpace: "nowrap" }}
        >
          Deny
        </Button>
      )}
      {showApprove && (
        <Button
          variant="contained"
          color="primary"
          disabled={actionLoading}
          onClick={handleApproveClick}
          sx={{ whiteSpace: "nowrap" }}
        >
          Approve
        </Button>
      )}
    </Stack>
  ) : null;

  const updateDocumentRow = (key, patch) => {
    setDocumentRows((rows) =>
      rows.map((row) => (row.key === key ? { ...row, ...patch } : row))
    );
  };

  const saveDocumentRow = async (row, patch = {}) => {
    const next = { ...row, ...patch };
    updateDocumentRow(row.key, next);
    setSavingDocumentKey(row.key);

    const payload = {
      key: next.key,
      title: next.title,
      status: next.status,
      sentAt: next.sentAt || null,
      receivedAt: next.receivedAt || null,
      notes: next.notes || "",
    };

    try {
      const res = await api.patch(
        `/users/bartenders/${bartenderUserId}/documents/${row.key}`,
        payload
      );
      const docs = res.data?.data;
      if (Array.isArray(docs)) {
        setDocumentRows((rows) =>
          rows.map((item) => docs.find((doc) => doc.key === item.key) || item)
        );
      }
      setDocumentAlert({ severity: "success", message: `${row.title} updated.` });
    } catch (error) {
      setDocumentAlert({
        severity: "error",
        message:
          error?.response?.data?.message ||
          `Could not update ${row.title}. Please try again.`,
      });
    } finally {
      setSavingDocumentKey(null);
    }
  };

  const sendAllOnboardingDocuments = async () => {
    setSavingDocumentKey("all");

    try {
      const res = await api.post(
        `/users/bartenders/${bartenderUserId}/documents/send-all`
      );
      const docs = res.data?.data;
      if (Array.isArray(docs)) {
        setDocumentRows((rows) =>
          rows.map((item) => docs.find((doc) => doc.key === item.key) || item)
        );
      }
      setDocumentAlert({
        severity: "success",
        message:
          res.data?.message ||
          `Onboarding document request sent to ${userInfo?.email || "the bartender"}.`,
      });
    } catch (error) {
      setDocumentAlert({
        severity: "error",
        message:
          error?.response?.data?.message ||
          "Could not send the onboarding document request email.",
      });
    } finally {
      setSavingDocumentKey(null);
    }
  };

  const saveCompensation = async () => {
    const hourlyRate = Number(compensationForm.hourlyRate);
    const maxRate = Number(compensationForm.maxHourlyRate);
    const increase = Number(compensationForm.annualIncrease);

    if (!hourlyRate || hourlyRate < 40) {
      setDocumentAlert({
        severity: "error",
        message: "Hourly rate must be at least $40.00.",
      });
      return;
    }
    if (!maxRate || maxRate < hourlyRate) {
      setDocumentAlert({
        severity: "error",
        message: "Maximum hourly rate must be at least the current hourly rate.",
      });
      return;
    }

    setSavingCompensation(true);
    try {
      const res = await api.patch(
        `/users/bartenders/${bartenderUserId}/compensation`,
        {
          hourlyRate,
          maxHourlyRate: maxRate,
          annualIncrease: increase,
        }
      );
      const updated = res.data?.data || {};
      setCompensationForm({
        hourlyRate: Number(updated.hourlyRate) || hourlyRate,
        maxHourlyRate: Number(updated.maxHourlyRate) || maxRate,
        annualIncrease: Number(updated.annualIncrease) || increase,
      });
      setDocumentAlert({
        severity: "success",
        message: "Bartender hourly rate updated.",
      });
    } catch (error) {
      setDocumentAlert({
        severity: "error",
        message:
          error?.response?.data?.message ||
          "Could not update bartender hourly rate.",
      });
    } finally {
      setSavingCompensation(false);
    }
  };

  const handleSendReward = async () => {
    const claimId = sendRewardConfirm?.claim?._id;
    if (!claimId) return;
    setSendingRewardId(claimId);
    setDocumentAlert(null);
    try {
      const res = await api.patch(`/rewards/claims/${claimId}/send`);
      const updatedClaim = res.data?.data || {};
      setRewardClaimOverrides((current) => ({
        ...current,
        [claimId]: {
          status: updatedClaim.status || "fulfilled",
          fulfilledAt: updatedClaim.fulfilledAt || new Date().toISOString(),
          sentAt: updatedClaim.sentAt || updatedClaim.fulfilledAt || new Date().toISOString(),
        },
      }));
      setDocumentAlert({
        severity: "success",
        message: `${sendRewardConfirm.reward} marked as sent. The bartender was emailed.`,
      });
      setSendRewardConfirm(null);
    } catch (error) {
      setDocumentAlert({
        severity: "error",
        message:
          error?.response?.data?.message ||
          "Could not mark this reward as sent.",
      });
    } finally {
      setSendingRewardId(null);
    }
  };

  const confirmDisabled =
    !denyReason || (denyReason === "other" && !denyCustomReason.trim());

  if (!bartender) {
    return (
      <Drawer anchor="right" open={open} onClose={handleClose}>
        <Box sx={{ width: { xs: "100vw", sm: 420 }, p: 3 }}>
          <Typography variant="body1">No bartender selected.</Typography>
        </Box>
      </Drawer>
    );
  }

  return (
    <>
      <Drawer anchor="right" open={open} onClose={handleClose}>
        <Box
          sx={{
            width: { xs: "100vw", sm: 560, md: 720 },
            display: "flex",
            flexDirection: "column",
            height: "100%",
          }}
        >
          <DetailDrawerHeader
            title={userInfo?.fullName || "Bartender Details"}
            summary={drawerSummary}
            statusChip={<Chip size="small" {...chip} />}
            facts={headerFacts}
            primaryAction={headerActions}
            lastUpdated={
              lastUpdatedAt
                ? `Last updated ${formatDateTime(lastUpdatedAt)}`
                : "Last updated not recorded"
            }
            onClose={handleClose}
          />

          {/* Tabs */}
          <Box sx={{ px: 3, pt: 2 }}>
            <Tabs
              value={activeStep}
              onChange={(_, value) => handleStepClick(value)}
              variant="fullWidth"
              sx={tabsSx}
            >
              {stepsLabels.map((label, index) => (
                <Tab key={label} label={label} value={index} />
              ))}
            </Tabs>
          </Box>

          {/* Content */}
          <Box
            sx={{
              flex: 1,
              overflowY: "auto",
              p: 3,
            }}
          >
            {documentAlert && (
              <Alert
                severity={documentAlert.severity}
                onClose={() => setDocumentAlert(null)}
                sx={{ mb: 2 }}
              >
                {documentAlert.message}
              </Alert>
            )}

            {activeStep === 0 && (
              <Box>
                {/* User section */}
                <Stack direction="row" spacing={2} alignItems="center" mb={3}>
                  <Avatar
                    src={userInfo?.photo || undefined}
                    sx={{ width: 64, height: 64, fontSize: 28 }}
                  >
                    {!userInfo?.photo && userInfo?.fullName?.[0]}
                  </Avatar>
                  <Box>
                    <Typography variant="h6">
                      {userInfo?.fullName || "Unnamed User"}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {userInfo?.email}
                    </Typography>
                    {userInfo?.username && (
                      <Typography variant="body2" color="text.secondary">
                        @{userInfo.username}
                      </Typography>
                    )}
                  </Box>
                </Stack>

                <Divider sx={{ mb: 2 }} />

                {/* Checklist */}
                <Typography variant="subtitle1" gutterBottom>
                  Checklist
                </Typography>
                {drawerChecklist.length === 0 ? (
                  <Typography variant="body2" color="text.secondary">
                    No checklist items defined for this role.
                  </Typography>
                ) : (
                  <List dense>
                    {drawerChecklist.map((step) => (
                      <ListItem key={step.key} disableGutters>
                        <ListItemIcon sx={{ minWidth: 32 }}>
                          {step.done ? (
                            <CheckCircle color="success" fontSize="small" />
                          ) : (
                            <RadioButtonUnchecked
                              color="disabled"
                              fontSize="small"
                            />
                          )}
                        </ListItemIcon>
                        <ListItemText
                          primary={
                            <Stack
                              direction="row"
                              justifyContent="space-between"
                              alignItems="center"
                              spacing={1}
                            >
                              <Typography variant="body2">
                                {step.label}
                              </Typography>
                              {typeof step.percent === "number" && (
                                <Typography
                                  variant="caption"
                                  color="text.secondary"
                                >
                                  {step.percent}%
                                </Typography>
                              )}
                            </Stack>
                          }
                        />
                      </ListItem>
                    ))}
                  </List>
                )}
              </Box>
            )}

            {activeStep === 1 && (
              <Box>
                {/* Stats */}
                <Typography variant="subtitle1" gutterBottom>
                  Stats
                </Typography>
                <Box
                  sx={{
                    display: "grid",
                    gridTemplateColumns:
                      "repeat(auto-fit, minmax(140px, 1fr))",
                    gap: 2,
                    mb: 3,
                  }}
                >
                  {statsCards.map(([label, value]) => (
                    <StatCard key={label} label={label} value={value} />
                  ))}
                </Box>

                <Divider sx={{ mb: 2 }} />

                <Typography variant="subtitle1" gutterBottom>
                  Contact & Emergency Contact
                </Typography>
                <Box
                  sx={{
                    p: 2,
                    border: 1,
                    borderColor: "divider",
                    borderRadius: 1,
                    mb: 3,
                  }}
                >
                  <Box
                    sx={{
                      display: "grid",
                      gridTemplateColumns: {
                        xs: "1fr",
                        sm: "repeat(2, minmax(0, 1fr))",
                      },
                      gap: 2,
                    }}
                  >
                    <DetailLine label="Bartender phone" value={formatPhone(contactInfo.phone)} />
                    <DetailLine
                      label="Emergency contact"
                      value={emergencyContact.fullName}
                    />
                    <DetailLine
                      label="Relationship"
                      value={titleize(emergencyContact.relationship)}
                    />
                    <DetailLine
                      label="Emergency phone"
                      value={formatPhone(emergencyContact.phone)}
                    />
                    <DetailLine
                      label="Emergency email"
                      value={emergencyContact.email}
                    />
                  </Box>
                </Box>

                <Divider sx={{ mb: 2 }} />

                <Typography variant="subtitle1" gutterBottom>
                  Bartender Pay Rate
                </Typography>
                <Box
                  sx={{
                    p: 2,
                    border: 1,
                    borderColor: "divider",
                    borderRadius: 1,
                    mb: 3,
                  }}
                >
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    Rates start at $40/hr and can increase annually until the
                    maximum rate is reached. Only Owner position users can edit
                    this compensation setup.
                  </Typography>
                  <Stack direction={{ xs: "column", md: "row" }} spacing={1.5}>
                    <TextField
                      label="Current hourly rate"
                      type="number"
                      value={compensationForm.hourlyRate}
                      disabled={!canEditCompensation}
                      onChange={(e) =>
                        setCompensationForm((prev) => ({
                          ...prev,
                          hourlyRate: e.target.value,
                        }))
                      }
                      inputProps={{ min: 40, step: "0.01" }}
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">$</InputAdornment>
                        ),
                      }}
                      fullWidth
                    />
                    <TextField
                      label="Max hourly rate"
                      type="number"
                      value={compensationForm.maxHourlyRate}
                      disabled={!canEditCompensation}
                      onChange={(e) =>
                        setCompensationForm((prev) => ({
                          ...prev,
                          maxHourlyRate: e.target.value,
                        }))
                      }
                      inputProps={{ min: 40, step: "0.01" }}
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">$</InputAdornment>
                        ),
                      }}
                      fullWidth
                    />
                    <TextField
                      label="Annual increase"
                      type="number"
                      value={compensationForm.annualIncrease}
                      disabled={!canEditCompensation}
                      onChange={(e) =>
                        setCompensationForm((prev) => ({
                          ...prev,
                          annualIncrease: e.target.value,
                        }))
                      }
                      inputProps={{ min: 0, step: "0.01" }}
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">$</InputAdornment>
                        ),
                      }}
                      fullWidth
                    />
                  </Stack>
                  <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
                    Displayed rate: ${displayedHourlyRate.toFixed(2)}/hr · Max $
                    {displayedMaxHourlyRate.toFixed(2)}/hr · Annual increase $
                    {displayedAnnualIncrease.toFixed(2)}
                  </Typography>
                  {canEditCompensation && (
                    <Button
                      variant="contained"
                      onClick={saveCompensation}
                      disabled={savingCompensation || !bartenderUserId}
                      sx={{
                        mt: 2,
                        backgroundColor: "var(--primary-color)",
                      }}
                    >
                      {savingCompensation ? "Saving..." : "Save Pay Rate"}
                    </Button>
                  )}
                </Box>

                {/* Reviews DataGrid */}
                <Typography variant="subtitle1" gutterBottom>
                  Reviews
                </Typography>
                <Box sx={{ height: 260, width: "100%" }}>
                  <DataGrid
                    rows={reviews}
                    columns={reviewsColumns}
                    getRowId={(row) => row.id || row._id}
                    pageSize={5}
                    rowsPerPageOptions={[5]}
                    disableSelectionOnClick
                    columnHeaderHeight={44}
                    rowHeight={56}
                    slots={{
                      noRowsOverlay: () => (
                        <Box
                          sx={{
                            height: "100%",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            p: 2,
                            color: "text.secondary",
                          }}
                        >
                          <Typography variant="body2">
                            No reviews for this bartender yet.
                          </Typography>
                        </Box>
                      ),
                    }}
                    sx={{
                      "& .MuiDataGrid-columnHeaderTitle": {
                        width: "100%",
                        textAlign: "center",
                        fontWeight: 800,
                      },
                      "& .MuiDataGrid-cell": {
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        textAlign: "center",
                      },
                    }}
                  />
                </Box>
              </Box>
            )}

            {activeStep === 2 && (
              <Box>
                <Typography variant="subtitle1" gutterBottom>
                  Onboarding Documents
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Email documents to the bartender, then record when signed copies are received.
                </Typography>

                <Button
                  variant="contained"
                  onClick={sendAllOnboardingDocuments}
                  disabled={savingDocumentKey === "all" || !bartenderUserId}
                  fullWidth
                  sx={{
                    mb: 2,
                    backgroundColor: "var(--primary-color)",
                    maxWidth: { sm: 320 },
                  }}
                >
                  {savingDocumentKey === "all"
                    ? "Sending..."
                    : "Send All Onboarding Documents"}
                </Button>

                <Stack spacing={2}>
                  {documentRows.map((row) => (
                    <Box
                      key={row.key}
                      sx={{
                        p: 2,
                        border: 1,
                        borderColor: "divider",
                        borderRadius: 1,
                        bgcolor: "background.paper",
                      }}
                    >
                      <Stack spacing={1.5}>
                        <Stack
                          direction={{ xs: "column", sm: "row" }}
                          spacing={1}
                          justifyContent="space-between"
                          alignItems={{ xs: "flex-start", sm: "center" }}
                        >
                          <Box>
                            <Typography fontWeight={700}>{row.title}</Typography>
                            <Typography variant="body2" color="text.secondary">
                              {row.summary}
                            </Typography>
                          </Box>
                          <Chip
                            size="small"
                            color={documentStatusColor(row.status)}
                            label={titleize(row.status)}
                          />
                        </Stack>

                        <FormControl fullWidth size="small">
                          <InputLabel id={`${row.key}-status-label`}>Status</InputLabel>
                          <Select
                            labelId={`${row.key}-status-label`}
                            label="Status"
                            value={row.status}
                            onChange={(e) =>
                              updateDocumentRow(row.key, { status: e.target.value })
                            }
                          >
                            {DOCUMENT_STATUS_OPTIONS.map((option) => (
                              <MenuItem key={option.value} value={option.value}>
                                {option.label}
                              </MenuItem>
                            ))}
                          </Select>
                        </FormControl>

                        <TextField
                          fullWidth
                          size="small"
                          type="date"
                          label="Sent Date"
                          value={row.sentAt}
                          InputLabelProps={{ shrink: true }}
                          onChange={(e) =>
                            updateDocumentRow(row.key, { sentAt: e.target.value })
                          }
                        />

                        <TextField
                          fullWidth
                          size="small"
                          type="date"
                          label="Received Date"
                          value={row.receivedAt}
                          InputLabelProps={{ shrink: true }}
                          onChange={(e) =>
                            updateDocumentRow(row.key, { receivedAt: e.target.value })
                          }
                        />

                        <TextField
                          fullWidth
                          multiline
                          minRows={2}
                          size="small"
                          label="Internal Notes"
                          value={row.notes}
                          onChange={(e) =>
                            updateDocumentRow(row.key, { notes: e.target.value })
                          }
                        />

                        <Stack
                          direction={{ xs: "column", sm: "row" }}
                          spacing={1}
                          justifyContent="flex-end"
                        >
                          <Button
                            variant="contained"
                            onClick={() => saveDocumentRow(row)}
                            disabled={savingDocumentKey === row.key}
                            fullWidth
                            sx={{
                              maxWidth: { sm: 180 },
                              backgroundColor: "var(--primary-color)",
                            }}
                          >
                            Save Status
                          </Button>
                        </Stack>
                      </Stack>
                    </Box>
                  ))}
                </Stack>
              </Box>
            )}

            {activeStep === 3 && (
              <Box>
                <Typography variant="subtitle1" gutterBottom>
                  Reward Milestones
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  {rewards?.completedEvents ?? 0} completed event
                  {(rewards?.completedEvents ?? 0) === 1 ? "" : "s"} recorded.
                </Typography>

                {effectiveRewardMilestones.length === 0 ? (
                  <Typography variant="body2" color="text.secondary">
                    No reward milestones are configured yet.
                  </Typography>
                ) : (
                  <Stack spacing={1.25}>
                    {effectiveRewardMilestones.map((reward) => {
                      const claimStatus = reward.claim?.status;
                      const claimAnswers = getClaimAnswers(reward.claim || {});
                      const addressLines = formatAddressLines(
                        reward.claim?.shippingAddress || {}
                      );
                      const canSendReward =
                        reward.claim?._id &&
                        !["fulfilled", "declined", "canceled"].includes(
                          String(claimStatus || "").toLowerCase()
                        );
                      return (
                        <Accordion
                          key={reward.milestone}
                          defaultExpanded={!!reward.claim}
                          disableGutters
                          sx={{
                            border: 1,
                            borderColor: reward.unlocked
                              ? "var(--primary-color)"
                              : "divider",
                            borderRadius: "4px",
                            bgcolor: reward.unlocked
                              ? "rgba(123, 3, 35, 0.05)"
                              : "background.paper",
                            boxShadow: "none",
                            "&:before": { display: "none" },
                          }}
                        >
                          <AccordionSummary
                            expandIcon={<ExpandMore />}
                            sx={{
                              px: 1.5,
                              py: 0.75,
                              "& .MuiAccordionSummary-content": {
                                my: 0.5,
                                minWidth: 0,
                              },
                            }}
                          >
                            <Stack
                              direction={{ xs: "column", sm: "row" }}
                              spacing={1}
                              alignItems={{ xs: "flex-start", sm: "center" }}
                              justifyContent="space-between"
                              sx={{ width: "100%", minWidth: 0, pr: 1 }}
                            >
                              <Box sx={{ minWidth: 0 }}>
                                <Typography fontWeight={700}>
                                  {reward.milestone} events • {reward.reward}
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                  Approx. cost: {reward.costRange}
                                </Typography>
                                {!reward.unlocked && (
                                  <Typography variant="caption" color="text.secondary">
                                  {reward.remainingEvents} more event
                                  {reward.remainingEvents === 1 ? "" : "s"} to unlock
                                  </Typography>
                                )}
                              </Box>
                              <Stack
                                direction="row"
                                spacing={0.75}
                                alignItems="center"
                                flexWrap="wrap"
                                useFlexGap
                              >
                                {claimStatus && (
                                  <Chip
                                    size="small"
                                    variant="outlined"
                                    label={`Claim: ${titleize(claimStatus)}`}
                                  />
                                )}
                                <Chip
                                  size="small"
                                  color={reward.unlocked ? "success" : "default"}
                                  label={reward.unlocked ? "Unlocked" : "Locked"}
                                />
                              </Stack>
                            </Stack>
                          </AccordionSummary>
                          <AccordionDetails sx={{ px: 1.5, pt: 0, pb: 1.5 }}>
                            <Stack spacing={1.5}>
                              {reward.description && (
                                <Typography variant="body2" color="text.secondary">
                                  {reward.description}
                                </Typography>
                              )}

                              <Box>
                                <Typography variant="subtitle2" fontWeight={800}>
                                  Details
                                </Typography>
                                {reward.items?.length ? (
                                  <List dense disablePadding>
                                    {reward.items.map((item) => (
                                      <ListItem key={item} disableGutters>
                                        <ListItemIcon sx={{ minWidth: 32 }}>
                                          <CheckCircle color="success" fontSize="small" />
                                        </ListItemIcon>
                                        <ListItemText primary={item} />
                                      </ListItem>
                                    ))}
                                  </List>
                                ) : (
                                  <Typography variant="body2" color="text.secondary">
                                    No item list has been added for this reward yet.
                                  </Typography>
                                )}
                              </Box>

                              <Box>
                                  <Typography variant="subtitle2" fontWeight={800}>
                                    Delivery Address
                                  </Typography>
                                {reward.claim && addressLines.length ? (
                                    <Typography variant="body2" color="text.secondary">
                                      {addressLines.map((line) => (
                                        <React.Fragment key={line}>
                                          {line}
                                          <br />
                                        </React.Fragment>
                                      ))}
                                    </Typography>
                                  ) : (
                                    <Typography variant="body2" color="text.secondary">
                                    No delivery address has been submitted yet.
                                    </Typography>
                                  )}
                                </Box>

                              {claimAnswers.length > 0 && (
                                <Box>
                                  <Typography variant="subtitle2" fontWeight={800}>
                                    Claim Answers
                                  </Typography>
                                  <List dense disablePadding>
                                    {claimAnswers.map((answer) => (
                                      <ListItem
                                        key={`${reward.milestone}-${answer.key}`}
                                        disableGutters
                                      >
                                        <ListItemText
                                          primary={answer.label}
                                          secondary={answer.value}
                                        />
                                      </ListItem>
                                    ))}
                                  </List>
                                </Box>
                              )}

                              {reward.claim?.notes && (
                                <Box>
                                  <Typography variant="subtitle2" fontWeight={800}>
                                    Bartender Notes
                                  </Typography>
                                  <Typography variant="body2" color="text.secondary">
                                    {reward.claim.notes}
                                  </Typography>
                                </Box>
                              )}

                              <Stack direction="row" justifyContent="flex-end">
                                <Button
                                  size="small"
                                  variant="contained"
                                  onClick={() => setSendRewardConfirm(reward)}
                                  disabled={!canSendReward}
                                  sx={{ backgroundColor: "var(--primary-color)" }}
                                >
                                  Send Reward
                                </Button>
                              </Stack>
                            </Stack>
                          </AccordionDetails>
                        </Accordion>
                      );
                    })}
                  </Stack>
                )}
              </Box>
            )}

            {activeStep === 4 && (
              <Box sx={{ mt: 1 }}>
                <React.Suspense fallback={<Typography>Loading activity...</Typography>}>
                  <ActivityLogsTable
                    key={bartenderUserId}
                    entityModel="User"
                    entityId={bartenderUserId}
                  />
                </React.Suspense>
              </Box>
            )}
          </Box>

        </Box>
      </Drawer>

      <Dialog
        open={!!rewardInfo}
        onClose={() => setRewardInfo(null)}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>{rewardInfo?.reward || "Reward Details"}</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={1.5}>
            {rewardInfo?.description && (
              <Typography variant="body2" color="text.secondary">
                {rewardInfo.description}
              </Typography>
            )}
            <Typography variant="subtitle2">Included items</Typography>
            {rewardInfo?.items?.length ? (
              <List dense disablePadding>
                {rewardInfo.items.map((item) => (
                  <ListItem key={item} disableGutters>
                    <ListItemIcon sx={{ minWidth: 32 }}>
                      <CheckCircle color="success" fontSize="small" />
                    </ListItemIcon>
                    <ListItemText primary={item} />
                  </ListItem>
                ))}
              </List>
            ) : (
              <Typography variant="body2" color="text.secondary">
                No item list has been added for this reward yet.
              </Typography>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setRewardInfo(null)}
            sx={{ color: "var(--primary-color)" }}
          >
            Close
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={!!sendRewardConfirm}
        onClose={() => setSendRewardConfirm(null)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Send Reward?</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2}>
            <Alert severity="warning">
              Please double-check the bartender&apos;s delivery address and reward
              answers before marking this reward as sent.
            </Alert>
            <Box>
              <Typography variant="subtitle2" fontWeight={800}>
                {sendRewardConfirm?.reward}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {userInfo?.fullName || userInfo?.email || "Selected bartender"}
              </Typography>
            </Box>
            <Box>
              <Typography variant="subtitle2" fontWeight={800}>
                Delivery Address
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {formatAddressLines(sendRewardConfirm?.claim?.shippingAddress || {}).map(
                  (line) => (
                    <React.Fragment key={line}>
                      {line}
                      <br />
                    </React.Fragment>
                  )
                )}
              </Typography>
            </Box>
            {getClaimAnswers(sendRewardConfirm?.claim || {}).length > 0 && (
              <Box>
                <Typography variant="subtitle2" fontWeight={800}>
                  Reward Details
                </Typography>
                <List dense disablePadding>
                  {getClaimAnswers(sendRewardConfirm?.claim || {}).map((answer) => (
                    <ListItem key={answer.key} disableGutters>
                      <ListItemText primary={answer.label} secondary={answer.value} />
                    </ListItem>
                  ))}
                </List>
              </Box>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setSendRewardConfirm(null)}
            sx={{ color: "var(--primary-color)" }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleSendReward}
            disabled={sendingRewardId === sendRewardConfirm?.claim?._id}
            sx={{ backgroundColor: "var(--primary-color)" }}
          >
            {sendingRewardId === sendRewardConfirm?.claim?._id
              ? "Sending..."
              : "Yes, Send Reward"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Reason for Denial Dialog */}
      <Dialog open={denyDialogOpen} onClose={handleCloseDenyDialog} maxWidth="sm" fullWidth>
        <DialogTitle>Reason for denial</DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Please select a reason for denying this bartender&apos;s profile. This may be
            shared with the bartender or used for internal records.
          </Typography>

          <FormControl fullWidth size="small" sx={{ mb: 2 }}>
            <InputLabel id="deny-reason-label">Reason</InputLabel>
            <Select
              labelId="deny-reason-label"
              label="Reason"
              value={denyReason}
              onChange={(e) => setDenyReason(e.target.value)}
            >
              {REASON_OPTIONS.map((opt) => (
                <MenuItem key={opt.value} value={opt.value}>
                  {opt.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {denyReason && denyReason !== "other" && (
            <TextField
              fullWidth
              multiline
              minRows={2}
              size="small"
              label="Additional notes (optional)"
              value={denyCustomReason}
              onChange={(e) => setDenyCustomReason(e.target.value)}
            />
          )}

          {denyReason === "other" && (
            <TextField
              fullWidth
              multiline
              minRows={2}
              size="small"
              label="Custom reason"
              value={denyCustomReason}
              onChange={(e) => setDenyCustomReason(e.target.value)}
            />
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDenyDialog} disabled={actionLoading}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirmDeny}
            color="error"
            variant="contained"
            disabled={actionLoading || confirmDisabled}
          >
            Confirm Deny
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

const StatCard = ({ label, value }) => (
  <Box
    sx={{
      borderRadius: 2,
      border: 1,
      borderColor: "divider",
      p: 1.5,
    }}
  >
    <Typography variant="caption" color="text.secondary">
      {label}
    </Typography>
    <Typography variant="body1" sx={{ fontWeight: 600 }}>
      {value ?? "-"}
    </Typography>
  </Box>
);

export default BartenderDetailDrawer;
