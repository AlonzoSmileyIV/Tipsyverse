// Updated AdminCategories.jsx with complete original logic + Add + Upload
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Box,
  Typography,
  IconButton,
  Drawer,
  TextField,
  MenuItem,
  Button,
  Chip,
  Tooltip,
  Alert,
  Collapse,
  FormControlLabel,
  Checkbox,
  LinearProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  FormControl,
  FormLabel,
  RadioGroup,
  DialogActions,
  Radio,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Stack,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import {
  Edit,
  Add,
  Remove,
  CameraAlt,
  AddCircleOutline,
  UploadFile,
  CheckCircleOutline,
  Delete,
  Save,
  Close,
} from "@mui/icons-material";
import { DataGrid } from "@mui/x-data-grid";
import ActivityLogsTable from "../ActivityLogsTable/LazyActivityLogsTable";
import SafeHtml from "../SafeHtml/SafeHtml";
import { useDropzone } from "react-dropzone";
import { fetchAllLiquors } from "../../features/liquors/liquorSlice";
import { fetchAllMixers } from "../../features/mixers/mixerSlice";
import { fetchAllGlasses } from "../../features/glasses/glassSlice";
import { useDispatch, useSelector } from "react-redux";
import api from "../../services/api";
import { fetchAllHierarchies } from "../../features/hierarchies/hierarchySlice";
import { fetchAllDepartments } from "../../features/departments/departmentSlice";
import { fetchAllPositions } from "../../features/positions/positionSlice";
import { convertToSingluar } from "../../utils/convertToSingular";
import { fetchAllUsers, fetchMe } from "../../features/users/userSlice";
import EmptyOverlay from "../EmptyOverlay/EmptyOverlay";
import AdminSectionHeader from "../AdminSectionHeader/AdminSectionHeader";
import AdminSummaryCards from "../AdminSummaryCards/AdminSummaryCards";
import AdminTableControls from "../AdminTableControls/AdminTableControls";
import { formatStatus } from "../../utils/formatStatus";
import { loadSpreadsheet } from "../../utils/loadSpreadsheet";

const categories = [
  "Liquors",
  "Mixers",
  "Glasses",
  "Hierarchies",
  "Departments",
  "Positions",
];

const primaryButtonSx = {
  color: "var(--primary-color)",
  borderColor: "var(--primary-color)",
  "&:hover": {
    borderColor: "var(--primary-color)",
    backgroundColor: "rgba(128, 0, 32, 0.06)",
  },
};

const excelTitles = {
  Liquors: {
    add: {
      required: ["Name", "Description"],
      optional: ["Brands", "Status"],
    },
    edit: {
      required: ["Name", "Description"],
      optional: ["New Name", "Brands", "Status"],
    },
    delete: {
      required: ["Name"],
      optional: [],
    },
  },
  Mixers: {
    add: {
      required: ["Name"],
      optional: ["Description", "Brands", "Contains Alcohol (true or false)"],
    },
    edit: {
      required: ["Name"],
      optional: [
        "New Name",
        "Description",
        "Brands",
        "Contains Alcohol (true or false)",
      ],
    },
    delete: {
      required: ["Name"],
      optional: [],
    },
  },
  Glasses: {
    add: {
      required: ["Name", "Max Ounces"],
      optional: [],
    },
    edit: {
      required: ["Name"],
      optional: ["New Name", "Max Ounces"],
    },
    delete: {
      required: ["Name"],
      optional: [],
    },
  },
  Hierarchies: {
    add: {
      required: ["Name", "Description"],
      optional: [],
    },
    edit: {
      required: ["Name"],
      optional: ["New Name", "Description"],
    },
    delete: {
      required: ["Name"],
      optional: [],
    },
  },
  Departments: {
    add: {
      required: ["Name", "Description"],
      optional: [],
    },
    edit: {
      required: ["Name"],
      optional: ["New Name", "Description"],
    },
    delete: {
      required: ["Name"],
      optional: [],
    },
  },
  Positions: {
    add: {
      required: ["Name", "Description", "Hierarchy", "Department"],
      optional: [],
    },
    edit: {
      required: ["Name"],
      optional: ["New Name", "Description", "Hierarchy", "Department"],
    },
    delete: {
      required: ["Name"],
      optional: [],
    },
  },
};

const uploadIcons = {
  add: <AddCircleOutline />,
  edit: <Edit />,
  delete: <Delete />,
};

const AdminCategories = () => {
  const dispatch = useDispatch();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const is650OrLess = useMediaQuery("(max-width:650px)");
  const is750OrLess = useMediaQuery("(max-width:750px)");
  const is800OrLess = useMediaQuery("(max-width:800px)");
  const is1000OrLess = useMediaQuery("(max-width:1000px)");
  const is1050OrLess = useMediaQuery("(max-width:1050px)");
  const is1300OrLess = useMediaQuery("(max-width:1300px)");
  const [selectedType, setSelectedType] = useState("Liquors");
  const [uploadAction, setUploadAction] = useState("add");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStage, setUploadStage] = useState("");
  const [alertMessage, setAlertMessage] = useState(null);
  const [alertSeverity, setAlertSeverity] = useState("info");
  const [alertOpen, setAlertOpen] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [brandInput, setBrandInput] = useState("");
  const [createMode, setCreateMode] = useState(false);
  const [newItem, setNewItem] = useState(null);
  const [pendingFile, setPendingFile] = useState(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmDeleteName, setConfirmDeleteName] = useState("");
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [drawerAlertMessage, setDrawerAlertMessage] = useState("");
  const [drawerAlertSeverity, setDrawerAlertSeverity] = useState("info");
  const [search, setSearch] = useState("");

  const singularModel = useMemo(
    () => convertToSingluar(selectedType), // e.g. "Liquors" -> "Liquor"
    [selectedType]
  );

  const allLiquors = useSelector((state) => state.liquors?.allLiquors);
  const allMixers = useSelector((state) => state.mixers?.allMixers);
  const allGlasses = useSelector((state) => state.glasses?.allGlasses);
  const allHierarchies = useSelector(
    (state) => state.hierarchies?.allHierarchies
  );
  const allDepartments = useSelector(
    (state) => state.departments?.allDepartments
  );
  const allPositions = useSelector((state) => state.positions?.allPositions);

  const liquorsData = useMemo(
    () => (allLiquors?.data?.length ? allLiquors?.data : []),
    [allLiquors]
  );
  const mixersData = useMemo(
    () => (allMixers?.data?.length ? allMixers?.data : []),
    [allMixers]
  );
  const glassesData = useMemo(
    () => (allGlasses?.data?.length ? allGlasses?.data : []),
    [allGlasses]
  );
  const hierarchiesData = useMemo(
    () => (allHierarchies?.data?.length ? allHierarchies?.data : []),
    [allHierarchies]
  );
  const departmentsData = useMemo(
    () => (allDepartments?.data?.length ? allDepartments?.data : []),
    [allDepartments]
  );
  const positionsData = useMemo(
    () => (allPositions?.data?.length ? allPositions?.data : []),
    [allPositions]
  );
  const categoryDataByType = useMemo(
    () => ({
      Liquors: liquorsData,
      Mixers: mixersData,
      Glasses: glassesData,
      Hierarchies: hierarchiesData,
      Departments: departmentsData,
      Positions: positionsData,
    }),
    [departmentsData, glassesData, hierarchiesData, liquorsData, mixersData, positionsData]
  );
  const categorySummaryCards = useMemo(
    () =>
      categories.map((category) => ({
        key: category,
        count: categoryDataByType[category]?.length || 0,
        label: category,
        description:
          category === "Mixers"
            ? `${(categoryDataByType.Mixers || []).filter((item) => item.isAlcoholic).length} contain alcohol`
            : `Manage ${category.toLowerCase()}`,
      })),
    [categoryDataByType]
  );

  const fetchAllData = useCallback(() => {
    Promise.all([
      dispatch(fetchAllLiquors()),
      dispatch(fetchAllMixers()),
      dispatch(fetchAllGlasses()),
      dispatch(fetchAllHierarchies()),
      dispatch(fetchAllDepartments()),
      dispatch(fetchAllPositions()),
      dispatch(fetchAllUsers()),
      dispatch(fetchMe()),
    ]);
  }, [dispatch]);

  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  const handleRefresh = () => {
    fetchAllData();
  };

  const handleRefreshClick = () => {
    handleRefresh();
    setAlertMessage("Refreshed successfully!");
    setAlertSeverity("success");
    setAlertOpen(true);

    // setTimeout(() => {
    //   setAlertMessage(null);
    //   setAlertSeverity("info");
    // }, 3000);
  };

  const handleCreate = async () => {
    setLoading(true);

    let errs = {};
    if (!newItem?.name?.trim()) errs.name = "Name is required.";
    if (
      !["Glasses", "Mixers"].includes(selectedType) &&
      !newItem?.description?.trim()
    ) {
      errs.description = "Description is required.";
    }

    if (
      selectedType === "Glasses" &&
      (newItem?.maxOunces == null || newItem.maxOunces <= 0)
    ) {
      errs.maxOunces = "Max ounces must be greater than 0.";
    }

    if (
      selectedType === "Positions" &&
      (newItem?.hierarchy == null || newItem?.hierarchy === "")
    ) {
      errs.hierarchy = "Hierarchy is required.";
    }

    if (
      selectedType === "Positions" &&
      (newItem?.department == null || newItem?.department === "")
    ) {
      errs.department = "Department is required.";
    }

    if (Object.keys(errs).length) {
      setErrors(errs);
      setDrawerAlertMessage("");
      setDrawerAlertSeverity("info");
      setLoading(false); // Don't forget to stop loading here too
      return;
    }

    try {
      await new Promise((resolve) => setTimeout(resolve, 3000)); // ⏳ 3-second delay

      let payload = { ...newItem };

      if (selectedType === "Mixers" || selectedType === "Liquors") {
        payload.brands = Array.isArray(newItem.brands) ? newItem.brands : [];
      }

      if (selectedType === "Mixers") {
        payload.isAlcoholic = !!newItem.isAlcoholic;
      }

      if (selectedType === "Positions") {
        payload.hierarchy = newItem.hierarchy._id;
        payload.department = newItem.department._id;
      }

      await api.post(`/${selectedType.toLowerCase()}/create`, payload);

      fetchAllData(); // 🔁 Safe to trigger here
      setDrawerAlertMessage(
        `${convertToSingluar(selectedType)} created successfully.`
      );
      setDrawerAlertSeverity("success");
      setErrors({});
      setNewItem(null);
      setEditItem(null);
    } catch (err) {
      setErrors({ general: err.response?.data?.message || "Creation failed." });
      setDrawerAlertMessage(err.response?.data?.message || "Creation failed.");
      setDrawerAlertSeverity("error");
    } finally {
      setLoading(false);
      fetchAllData();
      setTimeout(() => {
        setCreateMode(false);
        setNewItem(null);
        setDrawerAlertMessage("");
        setDrawerAlertSeverity("info");
      }, 3000);
    }
  };

  const handleEdit = async () => {
    setLoading(true);

    let errs = {};
    if (!editItem?.name?.trim()) errs.name = "Name is required.";
    if (
      !["Glasses", "Mixers"].includes(selectedType) &&
      !editItem?.description?.trim()
    ) {
      errs.description = "Description is required.";
    }

    if (
      selectedType === "Glasses" &&
      (editItem?.maxOunces == null || editItem?.maxOunces <= 0)
    ) {
      errs.maxOunces = "Max ounces must be greater than 0.";
    }

    if (
      selectedType === "Positions" &&
      (editItem?.hierarchy == null || editItem?.hierarchy === "")
    ) {
      errs.hierarchy = "Hierarchy is required.";
    }

    if (
      selectedType === "Positions" &&
      (editItem?.department == null || editItem?.department === "")
    ) {
      errs.department = "Department is required.";
    }

    if (Object.keys(errs).length) {
      setErrors(errs);
      setDrawerAlertMessage("");
      setDrawerAlertSeverity("info");
      setLoading(false);
      return;
    }

    try {
      await new Promise((resolve) => setTimeout(resolve, 3000)); // optional delay

      let payload = { ...editItem };

      if (selectedType === "Mixers" || selectedType === "Liquors") {
        payload.brands = Array.isArray(editItem.brands) ? editItem.brands : [];
      }

      if (selectedType === "Mixers") {
        payload.isAlcoholic = !!editItem.isAlcoholic;
      }

      if (selectedType === "Glasses") {
        payload.maxOunces = editItem.maxOunces;
      }

      if (selectedType === "Positions") {
        payload.hierarchy = editItem.hierarchy._id;
        payload.department = editItem.department._id;
      }

      await api.put(`/${selectedType.toLowerCase()}/${editItem._id}`, payload);

      setDrawerAlertMessage(
        `${convertToSingluar(selectedType)} updated successfully.`
      );
      setDrawerAlertSeverity("success");
      setErrors({});

      // Wait before closing drawer
      setTimeout(() => {
        setEditItem(null); // close drawer
        setDrawerAlertMessage("");
        setDrawerAlertSeverity("info");
      }, 3000);
    } catch (err) {
      setErrors({ general: err.response?.data?.message || "Update failed." });
      setDrawerAlertMessage(err.response?.data?.message || "Update failed.");
      setDrawerAlertSeverity("error");
    } finally {
      setLoading(false);
      fetchAllData();
      setTimeout(() => {
        setCreateMode(false);
        setNewItem(null);
        setDrawerAlertMessage("");
        setDrawerAlertSeverity("info");
      }, 3000);
    }
  };

  const handleDelete = async () => {
    setConfirmDelete(false);
    setConfirmDeleteName("");
    setLoading(true);

    try {
      await new Promise((resolve) => setTimeout(resolve, 1000));

      await api.delete(`/${selectedType.toLowerCase()}/${editItem._id}`);

      setDrawerAlertMessage(
        `${convertToSingluar(selectedType)} deleted successfully.`
      );
      setDrawerAlertSeverity("success");
      setEditItem(null);
      setErrors({});
    } catch (err) {
      setDrawerAlertMessage(err.response?.data?.message || "Delete failed.");
      setDrawerAlertSeverity("error");
    } finally {
      fetchAllData();
      setLoading(false);
      setTimeout(() => {
        setDrawerAlertMessage("");
        setDrawerAlertSeverity("info");
      }, 3000);
    }
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
    maxSize: 5 * 1024 * 1024,
    multiple: false,
    onDropRejected: ([rejection]) => {
      const tooLarge = rejection?.errors?.some(
        ({ code }) => code === "file-too-large"
      );
      setAlertMessage(
        tooLarge
          ? "The Excel file must be 5 MB or smaller."
          : "Choose an Excel spreadsheet (.xlsx or .xls)."
      );
      setAlertSeverity("error");
      setAlertOpen(true);
      setPendingFile(null);
    },
  });

  const handleDownloadExcel = async () => {
    const XLSX = await loadSpreadsheet();
    let data = [];
    if (selectedType === "Liquors") {
      data = liquorsData.map(({ name, description, status, brands }) => ({
        Name: name,
        Description: description,
        Status: status,
        Brands: (brands || []).join(", "),
      }));
    } else if (selectedType === "Mixers") {
      data = mixersData.map(({ name, description, isAlcoholic, brands }) => ({
        Name: name,
        Description: description,
        Alcoholic: isAlcoholic ? "True" : "False",
        Brands: (brands || []).join(", "),
      }));
    } else if (selectedType === "Glasses") {
      data = glassesData.map(({ name, maxOunces }) => ({
        Name: name,
        "Max Ounces": maxOunces,
      }));
    } else if (selectedType === "Hierarchies") {
      data = hierarchiesData.map(({ name, description }) => ({
        Name: name,
        Description: description,
      }));
    } else if (selectedType === "Departments") {
      data = departmentsData.map(({ name, description }) => ({
        Name: name,
        Description: description,
      }));
    } else if (selectedType === "Positions") {
      data = positionsData.map(
        ({ name, hierarchy, department, description }) => ({
          Name: name,
          Hierarchy: hierarchy?.name || "",
          Department: department?.name || "",
          Description: description,
        })
      );
    }

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, selectedType);
    XLSX.writeFile(
      wb,
      `${selectedType
        .toLowerCase()
        .replace(/^\w/, (c) => c.toUpperCase())}.xlsx`
    );
  };

  const handleProceedUpload = async () => {
    setConfirmOpen(false);
    const file = pendingFile;
    if (!file) return;
    const formData = new FormData();
    formData.append("file", file);
    try {
      setUploadProgress(10);
      setUploadStage("Uploading file to server...");
      const res = await api.post(
        `${selectedType.toLowerCase()}/bulk?type=${uploadAction}`,
        formData,
        {
          headers: { "Content-Type": "multipart/form-data" },
          onUploadProgress: (event) => {
            const percent = Math.round((event.loaded * 100) / event.total);
            setUploadProgress(percent);
            setUploadStage(`Processing... (${percent}%)`);
          },
        }
      );

      setUploadStage("Finalizing...");
      setUploadProgress(100);

      setTimeout(() => {
        setUploadProgress(0);
        setUploadStage("");
        setPendingFile(null);
        setAlertMessage(res.data.message);
        setAlertSeverity(res.data.errorsPresent ? "error" : "success");
        setLoading(false);
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

  let columns = [];
  let rows = [];

  if (selectedType === "Liquors") {
    rows = liquorsData;
    columns = [
      
      { field: "name", headerName: "Name", width: isMobile ? 145 : 190 },
      {
        field: "description",
        headerName: "Description",
        flex: 2,
        renderCell: (params) =>
          params.value.length > 200
            ? `${params.value.slice(0, 200)}...`
            : params.value,
      },
      {
        field: "status",
        headerName: "Status",
        width: 150,
        renderCell: (params) => (
          <Chip
            label={formatStatus(params.value)}
            color={
              String(params.value || "").toLowerCase() === "active"
                ? "success"
                : "default"
            }
          />
        ),
      },
      {
        field: "actions",
        headerName: "Actions",
        width: 150,
        renderCell: (params) => (
          <Stack direction="row" spacing={0.5} flexWrap="wrap">
            <Tooltip title="Edit">
              <IconButton
              sx={{
                  border: "1px solid var(--primary-color)",
                  borderRadius: "5px",
                  color: "var(--primary-color)",
                }}
                onClick={() => {
                  setEditItem(params.row);
                }}
              >
                <Edit />
              </IconButton>
            </Tooltip>
           
          </Stack>
        ),
      },
    ];
  } else if (selectedType === "Mixers") {
    rows = mixersData;
    columns = [
      { field: "name", headerName: "Name", width: isMobile ? 145 : 190 },
      {
        field: "isAlcoholic",
        headerName: "Alcoholic",
        width: 150,
        renderCell: (params) => (
          <Chip
            label={params.value ? "True" : "False"}
            color={params.value ? "success" : "default"}
          />
        ),
      },
      {
        field: "description",
        headerName: "Description",
        flex: 2,
        renderCell: (params) => params?.value || "—",
      },
      {
        field: "brands",
        headerName: "Brands",
        flex: 2,
        renderCell: (params) => (
          <Typography
            variant="body2"
            noWrap
            sx={{
              display: "flex",
              alignItems: "center",
              width: "100%",
              height: "100%",
            }}
          >
            {Array.isArray(params.value) ? params.value.join(", ") : "-"}
          </Typography>
        ),
      },
      {
        field: "actions",
        headerName: "Actions",
        width: 150,
        renderCell: (params) => (
          <Tooltip title="Edit">
            <IconButton
             sx={{
                  border: "1px solid var(--primary-color)",
                  borderRadius: "5px",
                  color: "var(--primary-color)",
                }}
              onClick={() => {
                setEditItem(params.row);
              }}
            >
              <Edit />
            </IconButton>
          </Tooltip>
        ),
      },
    ];
  } else if (selectedType === "Glasses") {
    rows = glassesData;
    columns = [
      { field: "name", headerName: "Name", width: isMobile ? 145 : 190 },
      { field: "maxOunces", headerName: "Max Ounces", flex: 1 },
      {
        field: "actions",
        headerName: "Actions",
        width: 150,
        renderCell: (params) => (
          <Tooltip title="Edit">
            <IconButton
             sx={{
                  border: "1px solid var(--primary-color)",
                  borderRadius: "5px",
                  color: "var(--primary-color)",
                }}
              onClick={() => {
                setEditItem(params.row);
              }}
            >
              <Edit />
            </IconButton>
          </Tooltip>
        ),
      },
    ];
  } else if (selectedType === "Hierarchies") {
    rows = hierarchiesData;
    columns = [
      { field: "name", headerName: "Name", width: isMobile ? 145 : 190 },
      { field: "description", headerName: "Description", flex: 2 },
      {
        field: "actions",
        headerName: "Actions",
        width: 150,
        renderCell: (params) => (
          <Tooltip title="Edit">
            <IconButton
             sx={{
                  border: "1px solid",
                  borderColor: params.row.name !== "Owner" ? "var(--primary-color)" : 'grey',
                  borderRadius: "5px",
                  color: "var(--primary-color)",
                }}
              disabled={params.row.name === "Owner"}
              onClick={() => {
                setEditItem(params.row);
              }}
            >
              <Edit />
            </IconButton>
          </Tooltip>
        ),
      },
    ];
  } else if (selectedType === "Departments") {
    rows = departmentsData;
    columns = [
      { field: "name", headerName: "Name", width: isMobile ? 145 : 190 },
      { field: "description", headerName: "Description", flex: 2 },
      {
        field: "actions",
        headerName: "Actions",
        width: 150,
        renderCell: (params) => (
          <Tooltip title="Edit">
            <IconButton
            sx={{
                  border: "1px solid",
                  borderColor: params.row.name !== "Owner" ? "var(--primary-color)" : 'grey',
                  borderRadius: "5px",
                  color: "var(--primary-color)",
                }}
              disabled={params.row.name === "Owner"}
              onClick={() => {
                setEditItem(params.row);
              }}
            >
              <Edit />
            </IconButton>
          </Tooltip>
        ),
      },
    ];
  } else if (selectedType === "Positions") {
    rows = positionsData;
    columns = [
      { field: "name", headerName: "Name", width: isMobile ? 145 : 190 },
      {
        field: "hierarchy",
        headerName: "Hierarchy",
        flex: 1,
        renderCell: (params) => params.value?.name || "—",
      },
      {
        field: "department",
        headerName: "Department",
        flex: 1,
        renderCell: (params) => params.value?.name || "—",
      },
      { field: "description", headerName: "Description", flex: 2 },
      {
        field: "actions",
        headerName: "Actions",
        width: 150,
        renderCell: (params) => (
          <Tooltip title="Edit">
            <IconButton
            sx={{
                  border: "1px solid",
                  borderColor: params.row.name !== "Owner" ? "var(--primary-color)" : 'grey',
                  borderRadius: "5px",
                  color: "var(--primary-color)",
                }}
              disabled={params.row.name === "Owner"}
              onClick={() => {
                setEditItem(params.row);
              }}
            >
              <Edit />
            </IconButton>
          </Tooltip>
        ),
      },
    ];
  }

  columns = columns.map((column) => {
    if (column.field === "name") {
      return {
        ...column,
        flex: undefined,
        width: isMobile ? 145 : 190,
      };
    }
    if (column.field === "actions") {
      return {
        ...column,
        width: 120,
        align: "center",
        headerAlign: "center",
        sortable: false,
        filterable: false,
        cellClassName: "centerCell",
      };
    }
    return column;
  });

  const categoryColumnVisibilityModel = {
    description:
      selectedType === "Positions"
        ? !is1300OrLess
        : ["Liquors", "Mixers"].includes(selectedType)
        ? !is1000OrLess
        : !is800OrLess,
    status: !is650OrLess,
    isAlcoholic: !is650OrLess,
    brands: !is1300OrLess,
    maxOunces: !is650OrLess,
    hierarchy: !is750OrLess,
    department: !is1050OrLess,
  };

  const searchedRows = (() => {
    const term = search.trim().toLowerCase();
    if (!term) return rows;

    return rows.filter((row) =>
      [
        row.name,
        row.description,
        row.status,
        row.isAlcoholic ? "alcoholic contains alcohol" : "non alcoholic",
        row.maxOunces,
        row.hierarchy?.name,
        row.department?.name,
        ...(row.brands || []),
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term))
    );
  })();


  return (
    <Box>
      {/* Header + Buttons */}
      <Box sx={{ mb: 2 }}>
        <AdminSectionHeader
          title="Catalog Setup"
          subtitle="Manage liquors, mixers, glasses, hierarchies, departments, and positions."
          onRefresh={handleRefreshClick}
          onDownload={handleDownloadExcel}
          actions={
            <Button
              variant="outlined"
              startIcon={<AddCircleOutline />}
              onClick={() => {
                setCreateMode(true);
                setNewItem(null);
              }}
              sx={primaryButtonSx}
            >
              Add {convertToSingluar(selectedType)}
            </Button>
          }
        />
      </Box>


      <AdminSummaryCards
        cards={categorySummaryCards}
        selectedKey={selectedType}
        onSelect={(key) => {
          setSelectedType(key);
          setSearch("");
          setAlertMessage(null);
        }}
      />

      <AdminTableControls
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder={`Search ${selectedType.toLowerCase()}...`}
      />

      {/* Alert Message */}
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
              setAlertMessage(null);
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
          border: "1px dashed",
          borderColor: isDragActive ? "var(--primary-color)" : "divider",
          padding: 2,
          borderRadius: 1,
          cursor: "pointer",
          backgroundColor: isDragActive
            ? "rgba(139, 0, 38, 0.06)"
            : "background.paper",
          mb: 2,
        }}
      >
        <input {...getInputProps()} />
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} alignItems="center" justifyContent="center" textAlign={{ xs: "center", sm: "left" }}>
          <UploadFile sx={{ color: "var(--primary-color)" }} />
          <Box>
            <Typography variant="subtitle2" fontWeight={800}>
              {isDragActive ? "Drop the Excel file" : `Upload ${selectedType.toLowerCase()} Excel`}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Drag and drop a spreadsheet here, or click to choose a file · max 5 MB.
            </Typography>
          </Box>
        </Stack>
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

      {/* DataGrid */}
      <Box sx={{ height: 500, width: "100%" }}>
        <DataGrid
          rows={searchedRows}
          columns={columns}
          getRowId={(row) => row._id} // ✅ Use _id from MongoDB
          pageSize={10}
          rowsPerPageOptions={[10, 25, 50]}
          columnVisibilityModel={categoryColumnVisibilityModel}
          // MUI v6+
          slots={{
            noRowsOverlay: () => (
              <EmptyOverlay
                message={`There are no ${selectedType.toLowerCase()} yet.`}
              />
            ),
          }}
          // MUI v5 fallback (ignored by v6, safe to keep)
          components={{
            NoRowsOverlay: () => (
              <EmptyOverlay
                message={`There are no ${selectedType.toLowerCase()} yet.`}
              />
            ),
          }}
          sx={{
            "& .centerCell": {
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            },
          }}
        />
      </Box>

      {/* Create Drawer */}
      <Drawer
        anchor="right"
        open={createMode}
        onClose={() => {
          setCreateMode(false);
          setNewItem(null);
          setErrors({});
          setDrawerAlertMessage("");
        }}
        PaperProps={{ sx: { width: 400, p: 3 } }}
      >
        <Box>
          <IconButton
            onClick={() => {
              setCreateMode(false);
              setNewItem(null);
              setErrors({});
              setDrawerAlertMessage("");
            }}
            sx={{
              position: "absolute",
              top: 8,
              right: 8,
              zIndex: 1,
              color: "grey.600",
            }}
          >
            <Close />
          </IconButton>
          <Typography
            variant="h6"
            gutterBottom
            color={Object.keys(errors).length ? "error" : "inherit"}
          >
            Add New {convertToSingluar(selectedType)}
          </Typography>
          <IconButton
            component="label"
            sx={{
              position: "absolute",
              bottom: 0,
              right: -10,
              backgroundColor: "var(--primary-color)",
              color: "white",
              boxShadow: 1,
              "&:hover": {
                backgroundColor: "var(--primary-color)",
                color: "white",
              },
            }}
          >
            <input type="file" hidden accept="image/*" />
            <CameraAlt fontSize="small" />
          </IconButton>
        </Box>
        {drawerAlertMessage && (
          <Alert
            severity={drawerAlertSeverity}
            onClose={() => setDrawerAlertMessage("")}
          >
            {drawerAlertMessage}
          </Alert>
        )}
        <TextField
          label="Name"
          fullWidth
          margin="normal"
          value={newItem?.name || ""}
          onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
          error={!!errors.name}
          helperText={errors.name}
        />
        {selectedType !== "Glasses" && (
          <TextField
            label="Description"
            fullWidth
            margin="normal"
            multiline
            rows={4}
            value={newItem?.description || ""}
            onChange={(e) =>
              setNewItem({ ...newItem, description: e.target.value })
            }
            error={!!errors.description}
            helperText={errors.description}
          />
        )}
        {(selectedType === "Liquors" || selectedType === "Mixers") && (
          <Box sx={{ mt: 2 }}>
            <Typography variant="subtitle2" gutterBottom>
              Brands
            </Typography>

            {Array.isArray(newItem?.brands) && newItem.brands.length > 0 && (
              <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, mb: 1 }}>
                {newItem.brands.map((brand, idx) => (
                  <Chip
                    key={idx}
                    label={brand}
                    onDelete={() => {
                      setNewItem((prev) => ({
                        ...prev,
                        brands: prev.brands.filter((b) => b !== brand),
                      }));
                    }}
                  />
                ))}
              </Box>
            )}

            <TextField
              label="Add brand"
              fullWidth
              value={brandInput}
              onChange={(e) => setBrandInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && brandInput.trim()) {
                  setNewItem({
                    ...newItem,
                    brands: [...(newItem?.brands || []), brandInput.trim()],
                  });
                  setBrandInput("");
                  e.preventDefault();
                }
              }}
              error={!!errors.brands}
              helperText={errors.brands}
            />
          </Box>
        )}
        {selectedType === "Mixers" && (
          <FormControlLabel
            control={
              <Checkbox
                checked={!!newItem?.isAlcoholic} // ✅ always boolean
                onChange={(e) =>
                  setNewItem({
                    ...newItem,
                    isAlcoholic: e.target.checked,
                  })
                }
              />
            }
            label="Contains Alcohol"
          />
        )}
        {selectedType === "Positions" && (
          <>
            <TextField
              select
              label="Hierarchy"
              fullWidth
              margin="normal"
              value={String(newItem?.hierarchy?.id || "")}
              error={!!errors.hierarchy}
              helperText={errors.hierarchy}
              onChange={(e) => {
                const selected = hierarchiesData.find(
                  (h) => String(h.id) === e.target.value
                );
                setNewItem({ ...newItem, hierarchy: selected });
              }}
              sx={{ mt: 2 }}
            >
              {hierarchiesData.map((h) => (
                <MenuItem key={h.id} value={String(h.id)}>
                  {h.name}
                </MenuItem>
              ))}
            </TextField>

            <TextField
              select
              label="Department"
              fullWidth
              margin="normal"
              value={String(newItem?.department?.id || "")}
              error={!!errors.department}
              helperText={errors.department}
              onChange={(e) => {
                const selected = departmentsData.find(
                  (d) => String(d.id) === e.target.value
                );
                setNewItem({ ...newItem, department: selected });
              }}
              sx={{ mt: 2 }}
            >
              {departmentsData.map((d) => (
                <MenuItem key={d.id} value={String(d.id)}>
                  {d.name}
                </MenuItem>
              ))}
            </TextField>
          </>
        )}
        {selectedType === "Glasses" && (
          <TextField
            label="Max Ounces"
            type="number"
            fullWidth
            margin="normal"
            value={newItem?.maxOunces || 0}
            onChange={(e) =>
              setNewItem({ ...newItem, maxOunces: Number(e.target.value) })
            }
            error={!!errors.maxOunces}
            helperText={errors.maxOunces}
          />
        )}
        <Button
          variant="contained"
          
          fullWidth
          sx={{ mt: 2, backgroundColor: 'var(--primary-color)' }}
          onClick={() => {
            handleCreate();
          }}
          disabled={loading}
          loading={loading}
        >
          Create {convertToSingluar(selectedType)}
        </Button>
      </Drawer>

      {/* Edit Drawer */}
      <Drawer
        anchor="right"
        open={!!editItem}
        onClose={() => setEditItem(null)}
        PaperProps={{ sx: { width: 400, p: 2 } }}
        ModalProps={{ keepMounted: true }}
      >
        {editItem && (
          <Box>
            <IconButton
              onClick={() => {
                setEditItem(null);
              }}
              sx={{
                position: "absolute",
                top: 8,
                right: 8,
                zIndex: 1,
                color: "grey.600",
              }}
            >
              <Close />
            </IconButton>
            <Typography variant="h6" gutterBottom>
              Edit {convertToSingluar(selectedType)}
            </Typography>

            {drawerAlertMessage && (
              <Alert
                severity={drawerAlertSeverity}
                onClose={() => setDrawerAlertMessage("")}
              >
                {drawerAlertMessage}
              </Alert>
            )}

            <TextField
              label="Name"
              fullWidth
              margin="normal"
              value={editItem?.name || ""}
              onChange={(e) =>
                setEditItem({ ...editItem, name: e.target.value })
              }
              error={!!errors.name}
              helperText={errors.name}
            />
            {selectedType !== "Glasses" && (
              <TextField
                label="Description"
                fullWidth
                margin="normal"
                multiline
                rows={4}
                value={editItem?.description || ""}
                onChange={(e) =>
                  setEditItem({ ...editItem, description: e.target.value })
                }
                error={!!errors.description}
                helperText={errors.description}
              />
            )}
            {selectedType === "Positions" && (
              <>
                <TextField
                  select
                  label="Hierarchy"
                  fullWidth
                  margin="normal"
                  value={editItem?.hierarchy?.id || ""}
                  onChange={(e) => {
                    const selected = hierarchiesData.find(
                      (h) => h.id === e.target.value
                    );
                    setEditItem({ ...editItem, hierarchy: selected });
                  }}
                  sx={{ mt: 2 }}
                >
                  {hierarchiesData.map((h) => (
                    <MenuItem key={h.id} value={h.id}>
                      {h.name}
                    </MenuItem>
                  ))}
                </TextField>

                <TextField
                  select
                  label="Department"
                  fullWidth
                  margin="normal"
                  value={editItem?.department?.id || ""}
                  onChange={(e) => {
                    const selected = departmentsData.find(
                      (d) => d.id === e.target.value
                    );
                    setEditItem({ ...editItem, department: selected });
                  }}
                  sx={{ mt: 2 }}
                >
                  {departmentsData.map((d) => (
                    <MenuItem key={d.id} value={d.id}>
                      {d.name}
                    </MenuItem>
                  ))}
                </TextField>
              </>
            )}

            {(selectedType === "Liquors" || selectedType === "Mixers") && (
              <Box sx={{ mt: 2 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Brands
                </Typography>

                {Array.isArray(editItem?.brands) &&
                  editItem.brands.length > 0 && (
                    <Box
                      sx={{ display: "flex", flexWrap: "wrap", gap: 1, mb: 1 }}
                    >
                      {editItem.brands.map((brand, idx) => (
                        <Chip
                          key={idx}
                          label={brand}
                          onDelete={() => {
                            setEditItem((prev) => ({
                              ...prev,
                              brands: prev.brands.filter((b) => b !== brand),
                            }));
                          }}
                        />
                      ))}
                    </Box>
                  )}

                <TextField
                  label="Add brand"
                  fullWidth
                  value={brandInput}
                  onChange={(e) => setBrandInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && brandInput.trim()) {
                      setEditItem({
                        ...editItem,
                        brands: [
                          ...(editItem?.brands || []),
                          brandInput.trim(),
                        ],
                      });
                      setBrandInput("");
                      e.preventDefault();
                    }
                  }}
                  error={!!errors.brands}
                  helperText={errors.brands}
                />
              </Box>
            )}
            {selectedType === "Mixers" && (
              <FormControlLabel
                control={
                  <Checkbox
                    checked={editItem.isAlcoholic}
                    onChange={(e) =>
                      setEditItem({
                        ...editItem,
                        isAlcoholic: e.target.checked,
                      })
                    }
                  />
                }
                label="Contains Alcohol"
              />
            )}
            {selectedType === "Liquors" && (
              <TextField
                label="Status"
                select
                fullWidth
                margin="normal"
                value={editItem?.status || ""}
                onChange={(e) =>
                  setEditItem({ ...editItem, status: e.target.value })
                }
                error={!!errors.status}
                helperText={errors.status}
              >
                <MenuItem value="Active">Active</MenuItem>
                <MenuItem value="Inactive">Inactive</MenuItem>
              </TextField>
            )}
            {selectedType === "Glasses" && (
              <Box sx={{ mt: 2 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Max Ounces
                </Typography>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <IconButton
                    onClick={() => {
                      const newValue = Math.max(
                        (editItem?.maxOunces || 0) - 1,
                        0
                      );
                      setEditItem((prev) => ({ ...prev, maxOunces: newValue }));
                    }}
                    disabled={!editItem?.maxOunces || editItem?.maxOunces <= 0}
                  >
                    <Remove />
                  </IconButton>
                  <TextField
                    type="number"
                    value={editItem?.maxOunces ?? 0}
                    inputProps={{ min: 0 }}
                    sx={{ width: 100 }}
                    onChange={(e) => {
                      const value = Math.max(Number(e.target.value), 0);
                      setEditItem((prev) => ({ ...prev, maxOunces: value }));
                    }}
                    error={!!errors.maxOunces}
                    helperText={errors.maxOunces}
                  />
                  <IconButton
                    onClick={() => {
                      const newValue = (editItem?.maxOunces || 0) + 1;
                      setEditItem((prev) => ({ ...prev, maxOunces: newValue }));
                    }}
                  >
                    <Add />
                  </IconButton>
                </Box>
              </Box>
            )}

            <Box sx={{ mt: 3 }}>
              <Typography
                variant="subtitle2"
                sx={{ mb: 1, color: "text.secondary" }}
              >
                Activity
              </Typography>
              <ActivityLogsTable
                entityModel={singularModel} // "Liquor" | "Mixer" | "Glass" | "Hierarchy" | "Department" | "Position"
                entityId={editItem._id}
              />
            </Box>

            <Box sx={{ display: "flex", gap: 1, mt: 3 }}>
              <Button
                variant="contained"
                startIcon={<Save />}
                disabled={loading}
                loading={loading}
                onClick={handleEdit}
              >
                Save
              </Button>
              <Button
                variant="outlined"
                color="error"
                startIcon={<Delete />}
                disabled={loading}
                onClick={() => {
                  setConfirmDeleteName("");
                  setConfirmDelete(true);
                }}
              >
                Delete
              </Button>
            </Box>
          </Box>
        )}
      </Drawer>

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
                label={`Inserting ${selectedType}`}
              />
              <FormControlLabel
                value="edit"
                control={<Radio />}
                label={`Editing ${selectedType}`}
              />
              <FormControlLabel
                value="delete"
                control={<Radio />}
                label={`Deleting ${selectedType}`}
              />
            </RadioGroup>
          </FormControl>
          {excelTitles[selectedType] && (
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
                {excelTitles[selectedType][uploadAction]?.required.map(
                  (field, index) => (
                    <ListItem key={`required-${index}`}>
                      <ListItemIcon>
                        <CheckCircleOutline color="primary" fontSize="small" />
                      </ListItemIcon>
                      <ListItemText primary={field} />
                    </ListItem>
                  )
                )}
              </List>

              {excelTitles[selectedType][uploadAction]?.optional?.length >
                0 && (
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
                    {excelTitles[selectedType][uploadAction]?.optional.map(
                      (field, index) => (
                        <ListItem key={`optional-${index}`}>
                          <ListItemIcon>
                            <CheckCircleOutline
                              color="action"
                              fontSize="small"
                            />
                          </ListItemIcon>
                          <ListItemText primary={field} />
                        </ListItem>
                      )
                    )}
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
            startIcon={uploadIcons[uploadAction]}
            disabled={loading}
            loading={loading}
            loadingPosition="end"
          >
            Proceed to {uploadAction}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={confirmDelete} onClose={() => setConfirmDelete(false)}>
        <DialogTitle>Confirm Deletion</DialogTitle>
        <DialogContent>
          <Typography gutterBottom>
            Please type <strong>{editItem?.name}</strong> below to confirm
            deletion.
          </Typography>
          <TextField
            fullWidth
            label="Confirm Name"
            value={confirmDeleteName}
            onChange={(e) => setConfirmDeleteName(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDelete(false)}>Cancel</Button>
          <Button
            variant="contained"
            color="error"
            disabled={confirmDeleteName !== editItem?.name}
            onClick={() => {
              setConfirmDelete(false);
              handleDelete();
            }}
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default AdminCategories;
