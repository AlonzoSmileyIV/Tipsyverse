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
import moment from "moment/moment";
import AdminDrinkForm from "../AdminDrinkForm/AdminDrinkForm";
import { useDropzone } from "react-dropzone";
import api from "../../services/api";
import { useDispatch, useSelector } from "react-redux";
import { fetchAllDrinks } from "../../features/drinks/drinkSlice";
import EmptyOverlay from "../EmptyOverlay/EmptyOverlay";
import AdminSummaryCards from "../AdminSummaryCards/AdminSummaryCards";
import AdminTableControls from "../AdminTableControls/AdminTableControls";
import { loadSpreadsheet } from "../../utils/loadSpreadsheet";

const mockGlasses = [
  { id: 1, name: "Cocktail Glass", maxOunces: 8 },
  { id: 2, name: "Shot Glass", maxOunces: 2 },
  { id: 3, name: "Highball Glass", maxOunces: 12 },
];

const mockDrinks = Array.from({ length: 3 }, (_, i) => {
  const id = (i + 1).toString();
  return {
    _id: id,
    id: id,
    photo:
      i % 2 === 0
        ? "/images/avatar.jpg"
        : "https://res.cloudinary.com/dv3c5vntb/image/upload/v1765420372/default/images/default/images/drink.png",
    photoPublicId: i % 2 === 0 ? "images/avatar.jpg" : "default/images/drink",
    video:
      i % 2 === 0
        ? "/videos/avatar.mov"
        : "https://res.cloudinary.com/dtbgyeyjq/video/upload/v1744579255/videos/yey6s4ud1qgb6xtqx5vt.mov",
    videoPublicId:
      i % 2 === 0 ? "videos/avatar.mov" : "videos/yey6s4ud1qgb6xtqx5vt",
    name: `Sample Drink ${i + 1}`,
    slug: i % 2 === 0 ? "dirty-shirley" : "whiskey-sour",
    description: `Description ${i + 1}`,
    isAlcoholic: i % 3 === 0,
    taste:
      i % 2 === 0 ? ["Fruity", "Sweet", "Sour", "Salty"] : ["Bitter", "Umami"],
    colors: i % 2 === 0 ? ["Red", "Orange"] : [],
    tools: ["Shaker", "Strainer"],
    garnishes: ["Lime", "Lemon", "Cherry"],
    glass: mockGlasses[0],
    ingredients: [
      {
        name: "Ingredient 1",
        ounces: 2,
      },
      {
        name: "Ingredient 2",
        ounces: 2,
      },
      {
        name: "Ingredient 3",
        ounces: 4,
      },
    ],
    instructions: [
      "Add all ingredients to a shaker.",
      "Shake with ice.",
      "Strain into a glass.",
    ],
    createdAt: "2025-04-06T17:45:52.309+00:00",
    status: i % 3 === 0 ? "Inactive" : "Active",
  };
});

const excelTitles = {
  add: {
    required: [
      "Name",
      "Description",
      "Contains Alcohol (true or false)",
      "Glass",
      "Ingredients (e.g., 1 oz. Gin, 0.5 oz. Juice)",
      "Instructions",
    ],
    optional: ["Categories", "Tags", "Taste", "Colors", "Tools", "Garnishes"],
    icon: <AddCircleOutline />,
  },
  edit: {
    required: ["Name"],
    optional: [
      "New Name",
      "Description",
      "Contains Alcohol (true or false)",
      "Glass",
      "Ingredients (e.g., 1 oz. Gin, 0.5 oz. Juice)",
      "Instructions",
      "Taste",
      "Categories",
      "Tags",
      "Colors",
      "Tools",
      "Garnishes",
      "Status",
    ],
    icon: <Edit />,
  },
  delete: {
    required: ["Name"],
    optional: [],
    icon: <Delete />,
  },
};

const tableActionButtonSx = {
  border: "1px solid var(--primary-color)",
  color: "var(--primary-color)",
  minWidth: 88,
  height: 34,
  textTransform: "none",
  fontWeight: 700,
  "&:hover": {
    borderColor: "var(--primary-color)",
    backgroundColor: "rgba(139, 0, 38, 0.06)",
  },
};

const AdminDrinks = ({ handleAddClick, onActionsReady }) => {
  const dispatch = useDispatch();
  const [editDrink, setEditDrink] = useState(null);
  const [uploadAction, setUploadAction] = useState("add");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStage, setUploadStage] = useState("");
  const [alertMessage, setAlertMessage] = useState("");
  const [alertSeverity, setAlertSeverity] = useState("info");
  const [alertOpen, setAlertOpen] = useState(false);
  const [pendingFile, setPendingFile] = useState(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [drinkFilter, setDrinkFilter] = useState("all");
  const [search, setSearch] = useState("");

  const allDrinks = useSelector((state) => state.drinks?.allDrinks);

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const isCompactTable = useMediaQuery(theme.breakpoints.down("md"));
  const isTightTable = useMediaQuery(theme.breakpoints.down("lg"));

  const drinksData = useMemo(
    () => (allDrinks?.data?.length ? allDrinks?.data : mockDrinks),
    [allDrinks]
  );
  const alcoholCount = useMemo(
    () => drinksData.filter((drink) => drink.isAlcoholic === true).length,
    [drinksData]
  );
  const mocktailCount = useMemo(
    () => drinksData.filter((drink) => drink.isAlcoholic !== true).length,
    [drinksData]
  );
  const drinkSummaryCards = [
    {
      key: "all",
      count: drinksData.length,
      label: "All Drinks",
      description: "Every recipe in the library",
    },
    {
      key: "alcohol",
      count: alcoholCount,
      label: "Contains Alcohol",
      description: "Cocktails and alcoholic recipes",
    },
    {
      key: "mocktails",
      count: mocktailCount,
      label: "Mocktails",
      description: "No-alcohol drink recipes",
    },
  ];
  const filteredDrinksData = useMemo(() => {
    const term = search.trim().toLowerCase();
    const filteredByCard =
      drinkFilter === "alcohol"
        ? drinksData.filter((drink) => drink.isAlcoholic === true)
        : drinkFilter === "mocktails"
        ? drinksData.filter((drink) => drink.isAlcoholic !== true)
        : drinksData;

    if (!term) return filteredByCard;

    return filteredByCard.filter((drink) =>
      [
        drink.name,
        drink.slug,
        drink.description,
        drink.isAlcoholic ? "alcohol cocktail" : "mocktail non alcoholic",
        drink.glass?.name,
        ...(drink.categories || []),
        ...(drink.tags || []),
        ...(drink.taste || []),
        ...(drink.colors || []),
        ...(drink.tools || []),
        ...(drink.garnishes || []),
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term))
    );
  }, [drinkFilter, drinksData, search]);

  const fetchAllData = useCallback(() => {
    Promise.all([dispatch(fetchAllDrinks())]);
  }, [dispatch]);

  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  const handleRefresh = () => {
    fetchAllData();
  };

  const handleRefreshClick = (message = "Refreshed successfully!") => {
    setAlertMessage(message);
    setAlertSeverity("success");
    setAlertOpen(true);
    setConfirmOpen(false);
    setEditDrink(null);
    handleRefresh();

    // setTimeout(() => {
    //   setAlertOpen(false);
    // setAlertMessage(null);
    // setAlertSeverity("info");
    // }, 3000);
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

  const handleDownloadExcel = async () => {
    const XLSX = await loadSpreadsheet();
    const data = filteredDrinksData.map(
      ({
        name,
        description,
        isAlcoholic,
        taste,
        colors,
        tools,
        garnishes,
        categories,
        tags,
        glass,
        ingredients,
        instructions,
        createdAt,
        status,
      }) => ({
        Name: name,
        Description: description,
        "Contains Alcohol": isAlcoholic,
        Taste: taste.join(", "),
        Colors: colors.join(", "),
        Tools: tools.join(", "),
        Garnishes: garnishes.join(", "),
        Categories: categories.join(", "),
        Tags: tags.join(", "),
        Glass: glass.name,
        Ingredients: ingredients
          .map((ing) =>
            `${ing.ounces}oz. ${[ing.flavor, ing.brand || ing.name]
              .filter(Boolean)
              .join(" ")}`
          )
          .join(", "),
        Instructions: instructions.join(", "),
        "Created At": createdAt,
        Status: status,
      })
    );
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Drinks");
    XLSX.writeFile(workbook, "Drinks.xlsx");
  };

  useEffect(() => {
    onActionsReady?.({
      refresh: () => handleRefreshClick("Data refreshed successfully!"),
      download: handleDownloadExcel,
      downloadLabel: "Download Excel",
    });
    return () => onActionsReady?.(null);
    // Register current tab actions with the hub; handlers read current component state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onActionsReady]);

  const handleProceedUpload = async () => {
    setConfirmOpen(false);
    const file = pendingFile;
    if (!file) return;
    const formData = new FormData();
    formData.append("file", file);
    try {
      setUploadProgress(10);
      setUploadStage("Uploading file to server...");
      const res = await api.post(`drinks/bulk?type=${uploadAction}`, formData, {
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
        setAlertSeverity(res.data.errorsPresent ? "error" : "success");
        setAlertOpen(true);
        handleRefresh();
      }, 3000);
    } catch (error) {
      setUploadProgress(100);
      setAlertMessage(
        error.response?.data?.message || "Something went wrong during upload."
      );
      setAlertSeverity("error");
      setAlertOpen(true);
      setUploadStage("Upload failed.");

      setTimeout(() => {
        setUploadProgress(0);
        setUploadStage("");
        setPendingFile(null);
      }, 6000);
    }
  };

  const columns = [
    {
      field: "photo",
      headerName: "Image",
      width: 96,
      align: "center",
      headerAlign: "center",
      renderCell: (params) => (
        <Avatar
          src={params.value}
          alt={params.row.name}
          sx={{ width: 42, height: 42 }}
        />
      ),
      sortable: false,
      filterable: false,
      disableColumnMenu: true,
      cellClassName: "centerCell",
    },
    { field: "name", headerName: "Name", width: isMobile ? 140 : 190 },
    {
      field: "isAlcoholic",
      headerName: "Type",
      flex: 0.9,
      minWidth: isMobile ? 116 : 140,
      renderCell: (params) => (
        <Chip
          label={params.value === true ? "Alcohol" : "Mocktail"}
          color={params.value === true ? "success" : "info"}
          size="small"
          variant={params.value === true ? "filled" : "outlined"}
          sx={{ fontWeight: 700 }}
        />
      ),
    },
    {
      field: "glass",
      headerName: "Glass",
      flex: 1,
      minWidth: 150,
      renderCell: (params) => params.row.glass?.name || "N/A",
    },
    {
      field: "createdAt",
      headerName: "Created At",
      flex: 1,
      minWidth: 170,
      renderCell: (params) => {
        const createdAt = params.value ? moment(params.value) : null;
        const isValid = createdAt?.isValid();

        return (
          <Stack spacing={0.25} sx={{ minWidth: 0 }}>
            <Typography variant="body2" fontWeight={700} noWrap>
              {isValid ? createdAt.format("MMM D, YYYY") : "N/A"}
            </Typography>
            <Typography variant="caption" color="text.secondary" noWrap>
              {isValid ? createdAt.format("h:mm A") : ""}
            </Typography>
          </Stack>
        );
      },
    },
    {
      field: "actions",
      headerName: "Actions",
      width: isMobile ? 186 : 190,
      align: "center",
      headerAlign: "center",
      sortable: false,
      filterable: false,
      disableColumnMenu: true,
      cellClassName: "actionsCell",
      renderCell: (params) => (
        <Stack
          direction="row"
          spacing={1}
          alignItems="center"
          justifyContent="center"
          sx={{ width: "100%" }}
        >
          <Tooltip title="Edit">
            <Button
              size="small"
              aria-label="Edit drink"
              sx={tableActionButtonSx}
              onClick={() => {
                setEditDrink(params.row);
              }}
              startIcon={<Edit />}
            >
              Edit
            </Button>
          </Tooltip>
          <Tooltip title="View">
            <Button
              size="small"
              aria-label="View drink"
              sx={tableActionButtonSx}
              component="a"
              href={`/drinks/${params.row.slug}`}
              startIcon={<Visibility />}
            >
              View
            </Button>
          </Tooltip>
        </Stack>
      ),
    },
  ];

  return (
    <Box>
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
            onClose={() => setAlertOpen(false)}
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

      <AdminSummaryCards
        cards={drinkSummaryCards}
        selectedKey={drinkFilter}
        onSelect={setDrinkFilter}
      />

      <AdminTableControls
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search drink, glass, flavor, tag, or garnish..."
      />

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
          transition: "background-color 160ms ease, border-color 160ms ease",
          "&:hover": {
            borderColor: "var(--primary-color)",
            backgroundColor: "rgba(139, 0, 38, 0.03)",
          },
        }}
      >
        <input {...getInputProps()} />
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={1.5}
          alignItems="center"
          justifyContent="center"
          textAlign={{ xs: "center", sm: "left" }}
        >
          <UploadFile sx={{ color: "var(--primary-color)" }} />
          <Box>
            <Typography variant="subtitle2" fontWeight={800}>
              {isDragActive ? "Drop the Excel file" : "Upload drink Excel"}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Drag and drop a spreadsheet here, or click to choose a file.
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

      {/* Data Grid */}
      <Box
        sx={{
          height: 540,
          width: "100%",
          overflowX: "auto",
          border: 1,
          borderColor: "divider",
          borderRadius: 1,
        }}
      >
        <DataGrid
          rows={filteredDrinksData}
          columns={columns}
          pageSize={10}
          rowHeight={64}
          columnHeaderHeight={52}
          getRowId={(row) => row._id} // ✅ Use _id from MongoDB
          rowsPerPageOptions={[10, 25, 50]}
          columnVisibilityModel={{
            photo: !isMobile,
            isAlcoholic: !isMobile,
            glass: !isCompactTable,
            createdAt: !isTightTable,
          }}
          disableColumnMenu
          slots={{
            noRowsOverlay: () => (
              <EmptyOverlay message="No drinks match this filter." />
            ),
          }}
          // MUI v5 fallback (safe to keep)
          components={{
            NoRowsOverlay: () => (
              <EmptyOverlay message="No drinks match this filter." />
            ),
          }}
          sx={{
            minWidth: isMobile ? 330 : isCompactTable ? 540 : isTightTable ? 670 : 820,
            border: 0,
            "& .MuiDataGrid-columnHeaders": {
              backgroundColor: "rgba(0, 0, 0, 0.025)",
              borderBottom: "1px solid",
              borderColor: "divider",
            },
            "& .MuiDataGrid-columnHeaderTitle": {
              fontWeight: 800,
            },
            "& .MuiDataGrid-row:hover": {
              backgroundColor: "rgba(139, 0, 38, 0.035)",
            },
            "& .MuiDataGrid-cell": {
              borderColor: "divider",
            },
            "& .centerCell": {
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            },
            "& .actionsCell": {
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              px: 1,
            },
          }}
        />
      </Box>

      {/* Edit Drawer w/ AdminDrinkForm */}
      <Drawer
        anchor="right"
        open={!!editDrink}
        onClose={() => setEditDrink(null)}
        PaperProps={{ sx: { width: isMobile ? "80%" : 700, p: 2 } }}
      >
        {editDrink && (
          <AdminDrinkForm
            drink={editDrink}
            isEditing={true}
            onClose={() => setEditDrink(null)}
            refreshDrinkData={() =>
              handleRefreshClick(`Data refreshed successfully!`)
            }
          />
        )}
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
                label={`Inserting drinks`}
              />
              <FormControlLabel
                value="edit"
                control={<Radio />}
                label={`Editing drinks`}
              />
              <FormControlLabel
                value="delete"
                control={<Radio />}
                label={`Deleting drinks`}
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

export default AdminDrinks;
