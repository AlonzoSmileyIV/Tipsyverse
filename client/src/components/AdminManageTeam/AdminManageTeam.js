import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  AddCircleOutline,
  CheckCircleOutline,
  Delete,
  Edit,
  UploadFile,
  Visibility,
} from "@mui/icons-material";
import {
  Alert,
  Avatar,
  Box,
  Button,
  Chip,
  Collapse,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Drawer,
  FormControl,
  FormControlLabel,
  FormLabel,
  IconButton,
  LinearProgress,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Radio,
  RadioGroup,
  Stack,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import SafeHtml from "../SafeHtml/SafeHtml";
import { DataGrid } from "@mui/x-data-grid";

import AdminEmployeeForm from "../AdminEmployeeForm/AdminEmployeeForm";
import { useDispatch, useSelector } from "react-redux";
import { fetchAllEmployees } from "../../features/users/userSlice";
import { useDropzone } from "react-dropzone";
import api from "../../services/api";
import { canEditUser, canSeeAddButton } from "../../accessControl/rbac";
import AdminSectionHeader from "../AdminSectionHeader/AdminSectionHeader";
import AdminTableControls from "../AdminTableControls/AdminTableControls";
import { formatStatus } from "../../utils/formatStatus";
import { loadSpreadsheet } from "../../utils/loadSpreadsheet";

const primaryButtonSx = {
  color: "var(--primary-color)",
  borderColor: "var(--primary-color)",
  "&:hover": {
    borderColor: "var(--primary-color)",
    backgroundColor: "rgba(128, 0, 32, 0.06)",
  },
};

const mockEmployees = [
  {
    _id: "1",
    email: "john.doe@example.com",
    fullName: "John Doe",
    passwordHash: "hashed",
    profile: {
      photo: "https://randomuser.me/api/portraits/men/1.jpg",
      birthday: "1998-01-01",
    },
    employeeDetails: {
      position: { _id: "pos1", name: "Software Engineer" },
      reportTo: {
        _id: "2",
        email: "jane.smith@example.com",
        fullName: "Jane Smith",
        passwordHash: "hashed",
        profile: {
          photo: "https://randomuser.me/api/portraits/women/2.jpg",
        },
        position: { _id: "pos2", name: "Team Lead" },
        reportTo: null,
        directReports: [],
        status: {
          account: "Terminated",
          isAbsent: false,
          reasonForTermination: "Breach of policy",
        },
        dates: {
          dateStarted: "2021-01-15",
        },
        canEdit: false,
      },
      directReports: [],
      employmentStatus: {
        state: "Active",
        isAbsent: true,
      },
      dates: {
        dateStarted: "2023-06-01",
      },
    },
    canEdit: true,
  },
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
      employmentStatus: {
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
];

const excelTitles = {
  add: {
    required: [
      "Full Name",
      "Email",
      "Password",
      "Position",
      "Date Started",
      "Report To Email",
    ],
    optional: [
      "Birthday",
      "Bio",
      "Direct Reports Emails (e.g. one@gmail.com, two@gmail.com)",
    ],
    icon: <AddCircleOutline />,
  },
  edit: {
    required: ["Email"],
    optional: [
      "Full Name",
      "Birthday",
      "Bio",
      "Position",
      "Date Started",
      "Is Absent",
      "Status",
      "Termination Reason (need to have 'Terminated' listed as status)",
      "Report To Email",
      "Direct Reports Emails (e.g. one@gmail.com, two@gmail.com)",
    ],
    icon: <Edit />,
  },
  delete: {
    required: ["Email (make sure they are in Terminated status first)"],
    optional: [],
    icon: <Delete />,
  },
};

const AdminManageTeam = ({ hideHeader = false }) => {
  const dispatch = useDispatch();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const isTablet = useMediaQuery(theme.breakpoints.down("md"));
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [formMode, setFormMode] = useState("view"); // 'add', 'edit', 'view'
  const [uploadAction, setUploadAction] = useState("add");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStage, setUploadStage] = useState("");
  const [alertMessage, setAlertMessage] = useState("");
  const [alertSeverity, setAlertSeverity] = useState("info");
  const [alertOpen, setAlertOpen] = useState(false);
  const getSeverity = (errorsPresent, successPresent) =>
    errorsPresent
      ? successPresent
        ? "warning"
        : "error"
      : successPresent
      ? "success"
      : "info"; // fallback when neither
  const [pendingFile, setPendingFile] = useState(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [search, setSearch] = useState("");
  const loggedInUser = useSelector((state) => state.users.loggedInUser)?.user;

  const allEmployees = useSelector((state) => state.users?.allEmployees);

  const employeeData = useMemo(
    () => (allEmployees?.data?.length ? allEmployees?.data : mockEmployees),
    [allEmployees]
  );
  const filteredEmployeeData = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return employeeData;

    return employeeData.filter((employee) =>
      [
        employee.fullName,
        employee.email,
        employee.username,
        employee.role,
        employee.employeeDetails?.position?.name,
        employee.employeeDetails?.position?.department?.name,
        employee.employeeDetails?.reportTo?.fullName,
        employee.employeeDetails?.reportTo?.email,
        employee.employeeDetails?.employmentStatus?.state,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term))
    );
  }, [employeeData, search]);

  const fetchAllData = useCallback(() => {
    Promise.all([dispatch(fetchAllEmployees())]);
  }, [dispatch]);

  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  const handleRefresh = () => {
    fetchAllData();
  };

  const handleOpenDrawer = (employee, mode) => {
    setSelectedEmployee(employee);
    setFormMode(mode);
    setDrawerOpen(true);
  };

  const handleRefreshClick = (message = "Refreshed successfully!") => {
    setAlertMessage(message);
    setAlertSeverity("success");
    setAlertOpen(true);
    setConfirmOpen(false);
    setSelectedEmployee(null);
    handleRefresh();

    // setTimeout(() => {
    //   setAlertOpen(false);
    //   setAlertMessage(null);
    //   setAlertSeverity("info");
    // }, 3000);
  };

  const handleDownloadExcel = async () => {
    const XLSX = await loadSpreadsheet();
    const data = filteredEmployeeData.map((emp) => ({
      Name: emp.fullName,
      Email: emp.email,
      Position: emp.employeeDetails?.position?.name || "N/A",
      "Date Started": emp.employeeDetails?.dates?.dateStarted
        ? new Intl.DateTimeFormat("en-US", { timeZone: "UTC" }).format(
            new Date(emp.employeeDetails.dates.dateStarted)
          )
        : "N/A",
      "Report To": emp.employeeDetails?.reportTo?.fullName || "N/A",
      "Report To Email": emp.employeeDetails?.reportTo?.email || "N/A",
      Status: emp.employeeDetails?.employmentStatus?.state || "N/A",
      "Reason for Termination":
        emp.employeeDetails?.employmentStatus?.reasonForTermination || "N/A",
    }));
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Employees");
    XLSX.writeFile(workbook, "Employees.xlsx");
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: async (acceptedFiles) => {
      const file = acceptedFiles[0];
      if (!file) return;
      setPendingFile(file);
      setConfirmOpen(true);
    },
    accept: {
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [],
      "application/vnd.ms-excel": [],
    },
  });

  const handleProceedUpload = async () => {
    setConfirmOpen(false);
    const file = pendingFile;
    if (!file) return;
    const formData = new FormData();
    formData.append("file", file);
    try {
      setUploadProgress(10);
      setUploadStage("Uploading file to server...");
      const res = await api.post(`users/bulk?type=${uploadAction}`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
        onUploadProgress: (event) => {
          const percent = Math.round((event.loaded * 100) / event.total);
          setUploadProgress(percent);
          setUploadStage(`Processing... (${percent}%)`);
        },
      });

      setUploadStage("Finalizing...");
      setUploadProgress(100);

      setTimeout(() => {
        setUploadProgress(0);
        setUploadStage("");
        setPendingFile(null);
        setAlertMessage(res.data.message);
        setAlertSeverity(
          getSeverity(res.data.errorsPresent, res.data.successPresent)
        );
        setAlertOpen(true);

        handleRefresh();
      }, 3000);
    } catch (error) {
      setUploadProgress(100);
      setAlertMessage(
        error.response?.data?.message || "Something went wrong during upload."
      );
      setAlertSeverity("error");
      setUploadStage("Upload failed.");
      setAlertOpen(true);

      setTimeout(() => {
        setUploadProgress(0);
        setUploadStage("");
        setPendingFile(null);
      }, 6000);
    }
  };

  const columns = [
    {
      field: "user",
      headerName: "Employee",
      width: isMobile ? 145 : 230,
      sortable: false,
      renderCell: (params) => {
        const { profile, fullName, email } = params.row;
        return (
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Avatar src={profile.photo || undefined}>
              {!profile.photo && fullName[0]}
            </Avatar>
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="subtitle2" noWrap>{fullName}</Typography>
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ display: { xs: "none", sm: "block" } }}
              >
                {email}
              </Typography>
            </Box>
          </Stack>
        );
      },
    },

    {
      field: "position",
      headerName: "Position",
      flex: 1,
      renderCell: (params) => params.row.employeeDetails.position.name || "N/A",
    },
    {
      field: "dateStarted",
      headerName: "Date Started",
      flex: 1,
      renderCell: (params) =>
        new Intl.DateTimeFormat("en-US", {
          timeZone: "UTC",
        }).format(new Date(params.row.employeeDetails.dates?.dateStarted)),
    },
    {
      field: "reportTo",
      headerName: "Reports To",
      flex: 1,
      renderCell: (params) =>
        params.row.employeeDetails.reportTo?.fullName || "N/A",
    },
    {
      field: "status",
      headerName: "Status",
      flex: 1,
      renderCell: (params) => (
        <Chip
          label={formatStatus(params.row.employeeDetails.employmentStatus.state)}
          color={
            params.row.employeeDetails.employmentStatus.state === "Active"
              ? "success"
              : params.row.employeeDetails.employmentStatus.state ===
                "Suspended"
              ? "warning"
              : params.row.employeeDetails.employmentStatus.state ===
                "Terminated"
              ? "error"
              : "default"
          }
          size="small"
        />
      ),
    },
    {
      field: "actions",
      headerName: "Action",
      width: 120,
      align: "center",
      headerAlign: "center",
      renderCell: (params) => (
        <Stack direction="row" spacing={0.5} justifyContent="center" sx={{ width: "100%" }}>
          <Tooltip title="Edit">
            
              <IconButton
                sx={{
                  border: "1px solid var(--primary-color)",
                  borderRadius: "5px",
                  color: "var(--primary-color)",
                }}
                onClick={() => handleOpenDrawer(params.row, "edit")}
                disabled={!canEditUser(loggedInUser, params.row)}
              >
                <Edit />
              </IconButton>
            
          </Tooltip>
          <Tooltip title="View Details">
            <IconButton
              sx={{
                border: "1px solid var(--primary-color)",
                borderRadius: "5px",
                color: "var(--primary-color)",
              }}
              onClick={() => handleOpenDrawer(params.row, "view")}
            >
              <Visibility />
            </IconButton>
          </Tooltip>
        </Stack>
      ),
    },
  ];

  return (
    <Box>
      {/* Header and buttons */}
      {!hideHeader && (
        <Box sx={{ mb: 2 }}>
          <AdminSectionHeader
            title="Our Team"
            subtitle="Manage employee accounts, reporting lines, and team access."
            onRefresh={() => handleRefreshClick()}
            onDownload={handleDownloadExcel}
            actions={
              canSeeAddButton(loggedInUser) ? (
                <Button
                  variant="outlined"
                  startIcon={<AddCircleOutline />}
                  onClick={() => handleOpenDrawer(null, "add")}
                  sx={primaryButtonSx}
                >
                  Add Employee
                </Button>
              ) : null
            }
          />
        </Box>
      )}

      {hideHeader && canSeeAddButton(loggedInUser) && (
        <Box sx={{ display: "flex", justifyContent: "flex-end", mb: 1 }}>
          <Button
            variant="outlined"
            startIcon={<AddCircleOutline />}
            onClick={() => handleOpenDrawer(null, "add")}
            sx={{
              color: "var(--primary-color)",
              borderColor: "var(--primary-color)",
              "&:hover": {
                borderColor: "var(--primary-color)",
                backgroundColor: "rgba(128, 0, 32, 0.06)",
              },
            }}
          >
            Add Employee
          </Button>
        </Box>
      )}

      {/* Alert Message */}
      {/* {alertMessage && (
        <Box
          sx={{
            mb: 2,
            maxHeight: 250,
            overflowX: "auto",
            overflowY: "auto",
            width: "100%",
            borderRadius: 2,
          }}
        >
          <Alert
            severity={alertSeverity}
            sx={{
              minWidth: "fit-content",
              width: "100%",
              //display: "inline-block",
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
            }}
          >
            <SafeHtml html={alertMessage} />
          </Alert>
        </Box>
      )} */}
      <Collapse in={alertOpen}>
        <Box
          sx={{
            mb: 2,
            maxHeight: 250,
            overflowX: "auto",
            overflowY: "auto",
            width: "100%",
            borderRadius: 2,
          }}
        >
          <Alert
            severity={alertSeverity}
            onClose={() => {
              setAlertOpen(false);
            }}
            sx={{
              minWidth: "fit-content",
              width: "100%",
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
            }}
          >
            <SafeHtml html={alertMessage} />
          </Alert>
        </Box>
      </Collapse>

      {/* Drag-n-drop uploader */}
      <Box
        {...getRootProps()}
        sx={{
          border: "2px dashed #ccc",
          padding: 3,
          borderRadius: 2,
          textAlign: "center",
          cursor: "pointer",
          backgroundColor: isDragActive ? "#f0f0f0" : "transparent",
          mb: 2,
        }}
      >
        <input {...getInputProps()} />
        <UploadFile fontSize="large" />
        <Typography variant="body2">
          {isDragActive
            ? "Drop your Excel file here"
            : `Drag 'n' drop Excel file here, or click to upload employees...`}
        </Typography>
      </Box>

      {/* Progress & Stages */}
      {uploadProgress > 0 && (
        <Box sx={{ mb: 1 }}>
          <LinearProgress variant="determinate" value={uploadProgress} />
          <Typography variant="caption" display="block" sx={{ mt: 1 }}>
            {uploadStage}
          </Typography>
        </Box>
      )}

      <AdminTableControls
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search team member, position, manager, or status..."
      />

      {/* Data Grid */}
      <Box sx={{ height: 500, width: "100%" }}>
        <DataGrid
          rows={filteredEmployeeData}
          columns={columns}
          getRowId={(row) => row._id}
          autoHeight
          pageSize={5}
          rowsPerPageOptions={[5, 10, 25]}
          columnVisibilityModel={{
            position: !isMobile,
            dateStarted: !isTablet,
            reportTo: !isTablet,
            status: !isMobile,
          }}
          localeText={{ noRowsLabel: "Sorry, no team members yet." }}
          sx={{
            "& .MuiDataGrid-columnHeaders": {
              backgroundColor: (theme) => theme.palette.grey[100],
              textAlign: "center",
            },
            "& .MuiDataGrid-columnHeaderTitle": { width: "100%" },
            "& .MuiDataGrid-cell": {
              display: "flex",
              alignItems: "center",
              textAlign: "left",
            },
          }}
        />
      </Box>

      {/* Drawer to Edit or Add Employee */}
      <Drawer
        anchor="right"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        PaperProps={{ sx: { width: 700 } }}
      >
        <AdminEmployeeForm
          mode={formMode}
          employee={selectedEmployee}
          onClose={() => setDrawerOpen(false)}
        />
      </Drawer>

      {/* Insert, Editing, or Deleting bulk */}
      <Dialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        sx={{ fontFamily: "Poppins, sans-serif" }}
      >
        <DialogTitle>Confirm Upload Action</DialogTitle>
        <DialogContent>
          <FormControl component="fieldset">
            <FormLabel component="legend">
              What action would you like to perform?
            </FormLabel>
            <RadioGroup
              value={uploadAction}
              onChange={(e) => setUploadAction(e.target.value)}
            >
              <FormControlLabel
                value="add"
                control={<Radio />}
                label={`Inserting employees`}
              />
              <FormControlLabel
                value="edit"
                control={<Radio />}
                label={`Editing employees`}
              />
              <FormControlLabel
                value="delete"
                control={<Radio />}
                label={`Deleting employees`}
              />
            </RadioGroup>
          </FormControl>
          {excelTitles && (
            <Box sx={{ mt: 2 }}>
              <Typography
                variant="subtitle1"
                color="text.secondary"
                gutterBottom
              >
                The required headers when trying to{" "}
                <strong>{uploadAction}</strong>:
              </Typography>
              <List dense>
                {excelTitles[uploadAction]?.required.map((field, index) => (
                  <ListItem key={`required-${index}`}>
                    <ListItemIcon>
                      <CheckCircleOutline color="primary" fontSize="small" />
                    </ListItemIcon>
                    <ListItemText primary={field} />
                  </ListItem>
                ))}
              </List>

              {excelTitles[uploadAction]?.optional?.length > 0 && (
                <>
                  <Typography
                    variant="subtitle1"
                    color="text.secondary"
                    gutterBottom
                    sx={{ mt: 2 }}
                  >
                    You can also include these optional headers:
                  </Typography>
                  <List dense>
                    {excelTitles[uploadAction]?.optional.map((field, index) => (
                      <ListItem key={`optional-${index}`}>
                        <ListItemIcon>
                          <CheckCircleOutline color="action" fontSize="small" />
                        </ListItemIcon>
                        <ListItemText primary={field} />
                      </ListItem>
                    ))}
                  </List>
                </>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ fontFamily: "Poppins, sans-serif" }}>
          <Button onClick={() => setConfirmOpen(false)}>Cancel</Button>
          <Button
            onClick={handleProceedUpload}
            variant="contained"
            color={uploadAction === "delete" ? "error" : "primary"}
            startIcon={excelTitles[uploadAction]?.icon}
          >
            Proceed to {uploadAction}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default AdminManageTeam;
