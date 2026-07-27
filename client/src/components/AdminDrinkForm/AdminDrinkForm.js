// AdminDrinkForm.jsx (Scaffolded component with structure and placeholder logic)
import React, {
  useState,
  useRef,
  useEffect,
  useMemo,
  useCallback,
} from "react";
import {
  Box,
  Stepper,
  Step,
  StepLabel,
  Button,
  Typography,
  TextField,
  Checkbox,
  FormControlLabel,
  MenuItem,
  Chip,
  IconButton,
  List,
  ListItem,
  ListItemText,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  ListItemSecondaryAction,
  Tooltip,
  Stack,
  Divider,
  Collapse,
  //   useTheme,
  //   useMediaQuery,
  Alert,
  FormControl,
  InputLabel,
  Select,
  OutlinedInput,
  ListItemIcon,
  CircularProgress,
  Autocomplete
} from "@mui/material";
import {
  Delete,
  Edit,
  Add,
  Save,
  WarningAmber,
  CheckBox,
  CheckBoxOutlineBlank,
  Close,
  LocalBar as LocalBarIcon,
  Build as BuildIcon,
  Spa as SpaIcon,
  Tag as TagIcon,
  DragIndicator,
} from "@mui/icons-material";
import ActivityLogsTable from "../ActivityLogsTable/LazyActivityLogsTable";
import { red } from "@mui/material/colors";
import api from "../../services/api";
import { useDispatch, useSelector } from "react-redux";
import { fetchAllLiquors } from "../../features/liquors/liquorSlice";
import { fetchAllMixers } from "../../features/mixers/mixerSlice";
import { fetchAllGlasses } from "../../features/glasses/glassSlice";

const steps = [
  "Basic Info",
  "Describe",
  "Ingredients",
  "Instructions",
  "Review",
];

const mockGlasses = [
  { _id: 1, name: "Cocktail Glass", maxOunces: 8 },
  { _id: 2, name: "Shot Glass", maxOunces: 2 },
  { _id: 3, name: "Highball Glass", maxOunces: 12 },
];

const mockLiquors = [
  { name: "Vodka", _id: "vodka", isAlcoholic: true },
  { name: "Gin", _id: "gin", isAlcoholic: true },
];

const mockMixers = [
  { name: "Orange Juice", _id: "orange-juice", isAlcoholic: false },
  { name: "Cranberry Juice", _id: "cranberry-juice", isAlcoholic: false },
  { name: "Triple Sec", _id: "triple-sec", isAlcoholic: true },
];

const multiselectOptions = {
  taste: ["Fruity", "Sweet", "Sour", "Salty", "Bitter", "Umami"],
  colors: [
    "Red",
    "Brown",
    "Green",
    "Blue",
    "Yellow",
    "Pink",
    "Purple",
    "Orange",
    "White",
    "Clear",
  ],
  categories: [
    "Classic",
    "Fall",
    "Winter",
    "Spring",
    "Summer",
    "Tipsyverse Originals",
    "Easy at Home",
    "Party",
    "Trouble",
  ],
  tags: [
    "Memorial Day",
    "Juneteenth",
    "Fourth of July",
    "Halloween",
    "Thanksgiving",
    "Christmas",
    "New Years",
    "Valentine's Day",
    "St Patricks Day",
    "Wedding",
    "Game Night",
    "Summer BBQ",
    "Brunch",
  ],
  tools: [
    "Shaker",
    "Muddler",
    "Strainer",
    "Bar Spoon",
    "Jigger",
    "Juicer",
    "Blender",
    "Zester",
    "Peeler",
    "Measuring Cup",
  ],
  garnishes: [
    "Lime",
    "Lemon",
    "Cherry",
    "Strawberry",
    "Olive",
    "Mint",
    "Orange Slice",
    "Sugar Rim",
    "Salt Rim",
    "Pineapple",
  ],
};

const MAX_FILE_SIZE_MB = 10;

const isFileValid = (file, type) => {
  const validTypes =
    type === "image"
      ? ["image/jpeg", "image/png", "image/webp"]
      : ["video/mp4", "video/webm"];
  return (
    validTypes.includes(file.type) &&
    file.size <= MAX_FILE_SIZE_MB * 1024 * 1024
  );
};

const AdminDrinkForm = ({
  isEditing = false,
  onClose,
  drink = null,
  author = { name: "Tipsyverse" },
  refreshDrinkData,
}) => {
  const dispatch = useDispatch();
  const allLiquors = useSelector((state) => state.liquors?.allLiquors);
  const allMixers = useSelector((state) => state.mixers?.allMixers);
  const allGlasses = useSelector((state) => state.glasses?.allGlasses);
  const liquorsData = useMemo(
    () => (allLiquors?.data?.length ? allLiquors?.data : mockLiquors),
    [allLiquors]
  );
  const mixersData = useMemo(
    () => (allMixers?.data?.length ? allMixers?.data : mockMixers),
    [allMixers]
  );
  const glassesData = useMemo(
    () => (allGlasses?.data?.length ? allGlasses?.data : mockGlasses),
    [allGlasses]
  );

  // === Category styling (match DrinkDetailScreen) ===
  const CATEGORY_STYLES = {
    Trouble: {
      icon: "🔥",
      sx: {
        bgcolor: "#ff3b30 !important",
        color: "#fff !important",
        borderColor: "transparent !important",
        fontWeight: 700,
      },
      variant: "filled",
    },
    "Tipsyverse Originals": {
      icon: "✨",
      sx: {
        bgcolor: "rgba(139, 92, 246, 0.12)",
        borderColor: "rgba(139, 92, 246, 0.3)",
        color: "#6d28d9",
        fontWeight: 600,
      },
      variant: "outlined",
    },
    Trending: {
      icon: "📈",
      sx: {
        bgcolor: "rgba(34,197,94,0.10)",
        borderColor: "rgba(34,197,94,0.25)",
        color: "#059669",
        fontWeight: 600,
      },
      variant: "outlined",
    },
    Classic: { icon: "🍸" },
    Fall: { icon: "🍂" },
    Winter: { icon: "❄️" },
    Spring: { icon: "🌿" },
    Summer: { icon: "☀️" },
    Mocktails: { icon: "🥤" },
    "Easy at Home": { icon: "🏠" },
    Party: { icon: "🎉" },
  };

  const TAG_STYLES = {
    Juneteenth: { icon: "✊🏾", color: "black" },
    "Memorial Day": { icon: "🫡", color: "lightblue" },
    "Fourth of July": { icon: "🎆", color: "lightblue" },
    Thanksgiving: { icon: "🍗", color: "brown" },
    Christmas: { icon: "🎄", color: "green" },
    Halloween: { icon: "🎃", color: "orange" },
    "New Years": { icon: "🥂", color: "gold" },
    "Valentine's Day": { icon: "❤️", color: "red" },
    "St Patricks Day": { icon: "🍀", color: "darkgreen" },
    Birthday: { icon: "🎉", color: "purple" },
    Wedding: { icon: "💍", color: "pink" },
    "Game Night": { icon: "🎲", color: "teal" },
    "Summer BBQ": { icon: "🌞", color: "brown" },
    Brunch: { icon: "🥞", color: "brown" },
  };

  const catIcon = (name) => CATEGORY_STYLES[name]?.icon || "🏷️";
  const catVariant = (name) => CATEGORY_STYLES[name]?.variant || "outlined";
  const catSx = (name) => ({
    mb: 1,
    borderRadius: 2,
    borderColor: "divider",
    bgcolor: "background.paper",
    ...(CATEGORY_STYLES[name]?.sx || {}),
  });

  const toArray = (v) => (Array.isArray(v) ? v : v ? [v] : []);

  const TagRow = ({ label, icon, items = [] }) => (
    <Box sx={{ mt: 1.5, display: "flex", gap: 1 }}>
      <Typography variant="subtitle2" sx={{ mb: 0.5, color: "text.secondary" }}>
        {label}
      </Typography>
      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
        {items && items.length > 0 ? (
          items.map((it) => (
            <Chip
              key={it}
              icon={icon}
              label={it}
              size="small"
              variant="outlined"
              sx={{
                mb: 1,
                borderRadius: 2,
                borderColor: "divider",
                bgcolor: "background.paper",
              }}
            />
          ))
        ) : (
          <Chip
            icon={icon}
            label={`${label} not provided`}
            size="small"
            variant="outlined"
            disabled
            sx={{
              mb: 1,
              borderRadius: 2,
              borderColor: "divider",
              bgcolor: "grey.100",
              color: "text.secondary",
              fontStyle: "italic",
            }}
          />
        )}
      </Stack>
    </Box>
  );

  const CategoryRow = ({ items = [] }) => (
    <Box sx={{ mt: 1.5, display: "flex", gap: 1 }}>
      <Typography variant="subtitle2" sx={{ mb: 0.5, color: "text.secondary" }}>
        Categories
      </Typography>
      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
        {items && items.length > 0 ? (
          items.map((name) => (
            <Chip
              key={name}
              label={`${catIcon(name)} ${name}`}
              size="small"
              variant={catVariant(name)}
              sx={catSx(name)}
            />
          ))
        ) : (
          <Chip
            label="Categories not set"
            size="small"
            variant="outlined"
            disabled
            sx={{
              mb: 1,
              borderRadius: 2,
              borderColor: "divider",
              bgcolor: "grey.100",
              color: "text.secondary",
              fontStyle: "italic",
            }}
          />
        )}
      </Stack>
    </Box>
  );

  const glassLabelFromForm = (glass) =>
    glass?.name ||
    glass?.label ||
    (typeof glass === "string" ? glass : "") ||
    "";

  const fetchAllData = useCallback(() => {
    Promise.all([
      dispatch(fetchAllLiquors()),
      dispatch(fetchAllMixers()),
      dispatch(fetchAllGlasses()),
    ]);
  }, [dispatch]);

  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  const handleRefresh = () => {
    fetchAllData();
  };
  //   const theme = useTheme();
  //   const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const [activeStep, setActiveStep] = useState(0);
  const [dragging, setDragging] = useState({ image: false, video: false });
  const [draggedItem, setDraggedItem] = useState(null);

  const photoInputRef = useRef(null);
  //const videoInputRef = useRef(null);

  const [formData, setFormData] = useState({
    name: drink?.name || "",
    description: drink?.description || "",
    photo: drink?.photo || null,
    photoPublicId: drink?.photoPublicId || null,
    video: drink?.video || null,
    videoPublicId: drink?.videoPublicId || null,
    isAlcoholic: drink?.isAlcoholic ?? true,
    glass: drink?.glass ?? null, // null is better for Autocomplete default
    taste: drink?.taste || [],
    categories: drink?.categories || [],
    tags: drink?.tags || [],
    colors: drink?.colors || [],
    tools: drink?.tools || [],
    garnishes: drink?.garnishes || [],
    ingredients: drink?.ingredients || [],
    instructions: drink?.instructions || [],
  });
  const [ingredientAmount, setIngredientAmount] = useState(0);
  const [ingredientSelected, setIngredientSelected] = useState("");
  const [brandSelected, setBrandSelected] = useState("");
  const [flavorSelected, setFlavorSelected] = useState("");
  const [currentInstruction, setCurrentInstruction] = useState("");
  const [reviewOpen, setReviewOpen] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [serverResponse, setServerResponse] = useState({
    message: "",
    severity: "", // 'success' | 'error'
  });
  const [errors, setErrors] = useState({});
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteConfirmName, setDeleteConfirmName] = useState("");
  const [loading, setLoading] = useState(false);

  const handleReviewClick = () => {
    const newErrors = {};
    // if (!formData.photo) newErrors.photo = "Photo is required";
    if (!formData.name.trim()) newErrors.name = "Name is required";
    if (!formData.description.trim())
      newErrors.description = "Description is required";
    if (!formData.glass) newErrors.glass = "Glass is required";
    if (formData.ingredients.length === 0)
      newErrors.ingredients = "At least one ingredient required";
    if (formData.instructions.length === 0)
      newErrors.instructions = "At least one instruction required";

    setErrors(newErrors);
    if (Object.keys(newErrors).length === 0) {
      setReviewOpen(true);
    }
  };

  const handleNext = () => {
    if (activeStep === steps.length - 1) {
      handleReviewClick();
    } else {
      setActiveStep((prev) => prev + 1);
    }
  };

  const handleBack = () => setActiveStep((prev) => prev - 1);

  const uploadImage = async (file) => {
    const formData = new FormData();
    formData.append("photo", file);
    const res = await api.post("/drinks/upload-image", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });

    const { photo, photoPublicId } = res.data.data;
    return { photo, photoPublicId };
  };

  const uploadVideo = async (file) => {
    const formData = new FormData();
    formData.append("video", file);
    const res = await api.post("/drinks/upload-video", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    const { video, videoPublicId } = res.data.data;
    return { video, videoPublicId };
  };

  const handleFileChange = async (e, type) => {
    if (
      (type === "image" && uploadingImage) ||
      (type === "video" && uploadingVideo)
    ) {
      return;
    }

    const file = e.target.files[0];
    if (!file) return;

    const setUploading =
      type === "image" ? setUploadingImage : setUploadingVideo;
    setUploading(true);

    if (!isFileValid(file, type)) {
      setErrors((prev) => ({
        ...prev,
        [type === "image" ? "photo" : "video"]:
          "Invalid file type or too large",
      }));
      setUploading(false);
      return;
    }

    try {
      const uploadFn = type === "image" ? uploadImage : uploadVideo;
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
      setUploading(false);
    }
  };

  const handleDrop = (e, type) => {
    e.preventDefault();
    setDragging((prev) => ({ ...prev, [type]: false })); // 👈 Reset drag state
    const file = e.dataTransfer.files[0];
    if (!file) return;
    handleFileChange({ target: { files: [file] } }, type);
  };

  const clearFile = (type) => {
    if (type === "image") {
      setFormData({ ...formData, photo: null });
      setErrors({ ...errors, photo: "" });
    } else {
      setFormData({ ...formData, video: null });
      setErrors({ ...errors, video: "" });
    }
  };

  // {renderUploadBox(
  //           "image",
  //           formData.photo,
  //           errors.photo,
  //           photoInputRef
  //         )}
  const renderUploadBox = (type, file, error, inputRef) => {
    const uploading = type === "image" ? uploadingImage : uploadingVideo;

    return (
      <Box
        onDrop={(e) => handleDrop(e, type)}
        onDragOver={(e) => e.preventDefault()}
        onDragEnter={() => setDragging((prev) => ({ ...prev, [type]: true }))}
        onDragLeave={() => setDragging((prev) => ({ ...prev, [type]: false }))}
        sx={{
          border: `2px ${dragging[type] ? "solid" : "dashed"} ${
            error ? "red" : "#ccc"
          }`,
          borderRadius: 2,
          p: 3,
          textAlign: "center",
          mb: 2,
          backgroundColor: "#fafafa",
          position: "relative",
          cursor: uploading ? "not-allowed" : "pointer",
          opacity: uploading ? 0.6 : 1,
          pointerEvents: uploading ? "none" : "auto",
        }}
        onClick={() => !uploading && inputRef.current?.click()}
      >
        {/* Hidden input over the entire box */}
        <input
          type="file"
          accept={type === "image" ? "image/*" : "video/*"}
          hidden
          disabled={uploading}
          onChange={(e) => handleFileChange(e, type)}
          ref={inputRef}
        />

        {uploading && (
          <CircularProgress sx={{ position: "absolute", top: 8, right: 8 }} />
        )}

        {file && (
          <Box sx={{ textAlign: "center" }}>
            {type === "image" ? (
              <Box sx={{ mb: 2 }}>
                <img
                  src={file}
                  alt="preview"
                  style={{ maxWidth: "100%", maxHeight: 200 }}
                  onError={() => console.error("Failed to load image:", file)}
                />
              </Box>
            ) : (
              <Box sx={{ mb: 2 }}>
                <video
                  src={
                    typeof file === "string" ? file : URL.createObjectURL(file)
                  }
                  controls
                  style={{ maxWidth: "100%", maxHeight: 200 }}
                  onError={() => console.error("Failed to load video:", file)}
                />
              </Box>
            )}
            <Button
              size="small"
              color="error"
              variant="contained"
              onClick={(e) => {
                e.stopPropagation(); // prevent click from triggering inputRef
                clearFile(type);
              }}
              disabled={uploading}
            >
              Delete
            </Button>
          </Box>
        )}

        {!file && (
          <Typography sx={{ mt: 1, color: uploading ? "gray" : "var(--primary-color)" }}>
            {uploading ? "Uploading..." : `Click or Drag a ${type} here`}
          </Typography>
        )}

        {error && <Typography color="error">{error}</Typography>}
      </Box>
    );
  };

  const glassObject = formData.glass || null;

  const totalOunces = formData.ingredients.reduce(
    (sum, ing) => sum + parseFloat(ing.ounces),
    0
  );

  const isUsed = (_id) => formData.ingredients.some((ing) => ing._id === _id);

  const filteredIngredients = [
    ...(formData.isAlcoholic ? liquorsData : []), // exclude liquors if not alcoholic
    ...mixersData,
  ].filter((i) => {
    // Only allow non-alcoholic items if isAlcoholic is false
    if (!formData.isAlcoholic && i.isAlcoholic) return false;

    // Prevent duplicate ingredients
    return !isUsed(i._id);
  });

  const selectedIngredientObj = useMemo(() => {
    return (
      [...liquorsData, ...mixersData].find(
        (i) => i._id === ingredientSelected
      ) || null
    );
  }, [ingredientSelected, liquorsData, mixersData]);

  const formatIngredientDisplayName = (ingredient) => {
    const base = String(ingredient?.name || "").trim();
    const brand = String(ingredient?.brand || "").trim();
    const flavor = String(ingredient?.flavor || "").trim();
    return [flavor, brand || base].filter(Boolean).join(" ");
  };

  const formatIngredientAmount = (ingredient) => {
    const displayName = formatIngredientDisplayName(ingredient);
    const ounces = Number(ingredient?.ounces);
    if (!displayName) return "";
    if (!Number.isFinite(ounces)) return displayName;
    if (ounces < 0.5) return `a dash of ${displayName}`;
    return `${ounces} oz ${displayName}`;
  };

  const addIngredient = () => {
    const selected = [...liquorsData, ...mixersData].find(
      (i) => i._id === ingredientSelected
    );
    if (ingredientAmount > 0 && selected) {
      setFormData({
        ...formData,
        ingredients: [
          ...formData.ingredients,
          {
            ...selected,
            ounces: ingredientAmount,
            brand: brandSelected?.trim() || "", // << add brand
            flavor: flavorSelected?.trim() || "",
          },
        ],
      });
      setIngredientAmount(0);
      setIngredientSelected("");
      setBrandSelected("");
      setFlavorSelected("");
    }
  };

  const removeIngredient = (_id) => {
    setFormData({
      ...formData,
      ingredients: formData.ingredients.filter((i) => i._id !== _id),
    });
  };

  const reorderArray = (items, fromIndex, toIndex) => {
    if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0) return items;
    const next = [...items];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    return next;
  };

  const handleReorderDragStart = (type, index) => (event) => {
    setDraggedItem({ type, index });
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", `${type}:${index}`);
  };

  const handleReorderDragOver = (event) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  };

  const handleReorderDrop = (type, toIndex) => (event) => {
    event.preventDefault();
    if (!draggedItem || draggedItem.type !== type) return;

    setFormData((prev) => ({
      ...prev,
      [type]: reorderArray(prev[type] || [], draggedItem.index, toIndex),
    }));
    setDraggedItem(null);
  };

  const handleReorderDragEnd = () => {
    setDraggedItem(null);
  };

  const handleInstructionAdd = () => {
    if (currentInstruction.trim()) {
      setFormData({
        ...formData,
        instructions: [...formData.instructions, currentInstruction.trim()],
      });
      setCurrentInstruction("");
    }
  };

  const handleInstructionDelete = (index) => {
    const updated = [...formData.instructions];
    updated.splice(index, 1);
    setFormData({ ...formData, instructions: updated });
  };

  const handleInstructionEdit = (index) => {
    setCurrentInstruction(formData.instructions[index]);
    handleInstructionDelete(index);
  };

  const handleCreateOrSave = async () => {
    try {
      const payload = {
        ...formData,
        glass: formData.glass?._id ?? "", // send just ID
        ingredients: formData.ingredients,
        instructions: formData.instructions,
        categories: formData.categories,
        tags: formData.tags,
      };

      const response = isEditing
        ? await api.put(`/drinks/${drink._id}`, payload)
        : await api.post("/drinks/create", payload);

      handleRefresh();
      if (!isEditing) {
        setFormData({
          name: "",
          description: "",
          photo: null,
          photoPublicId: null,
          video: null,
          videoPublicId: null,
          isAlcoholic: true,
          glass: "",
          taste: [],
          categories: [],
          tags: [],
          colors: [],
          tools: [],
          garnishes: [],
          ingredients: [],
          instructions: [],
        });
        setIngredientAmount(0);
        setIngredientSelected("");
        setCurrentInstruction("");
        setUploadingImage(false);
        setUploadingVideo(false);
      } else {
        refreshDrinkData();
      }

      setServerResponse({
        message: response.data.message,
        severity: "success",
      });
      // You can also show a toast or redirect here
    } catch (error) {
      const msg =
        error?.response?.data?.message ||
        "Something went wrong. Please try again.";
      setServerResponse({
        message: msg,
        severity: "error",
      });
    } finally {
      setReviewOpen(false);
      setActiveStep(0);
    }
  };

  const handleDelete = async () => {
    setDeleteDialogOpen(false);
    setDeleteConfirmName("");
    setLoading(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 1000));

      await api.delete(`/drinks/${drink._id}`);
      refreshDrinkData();
    } catch (err) {
      setServerResponse({
        message: err.response?.data?.message || "Delete failed.",
        severity: "error",
      });
    }
  };

  useEffect(() => {
    const allOptions = [...liquorsData, ...mixersData].filter((i) => {
      if (!formData.isAlcoholic && i.isAlcoholic) return false;
      return true;
    });

    if (!allOptions.some((i) => i._id === ingredientSelected)) {
      setIngredientSelected("");
    }
  }, [
    formData.isAlcoholic,
    formData.ingredients,
    liquorsData,
    mixersData,
    ingredientSelected,
  ]);

  useEffect(() => {
    setBrandSelected(""); // reset when ingredient changes
    setFlavorSelected("");
  }, [ingredientSelected]);

  useEffect(() => {
    if (serverResponse.message) {
      const timer = setTimeout(() => {
        setServerResponse({ message: "", severity: "" });
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [serverResponse.message]);

  useEffect(() => {
    if (drink && typeof drink.glass === "string") {
      const fullGlass = glassesData.find(
        (g) => g._id?.toString() === drink.glass
      );
      if (fullGlass) {
        setFormData((prev) => ({ ...prev, glass: fullGlass }));
      }
    }
  }, [drink, glassesData]);

  useEffect(() => {
    const handleBeforeUnload = (e) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, []);

  return (
    <Box sx={{ width: "100%", maxWidth: 900, mx: "auto", p: 3 }}>
      {isEditing && (
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
          <Close />
        </IconButton>
      )}
      {/* FORM */}
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

      {serverResponse.message && (
        <Alert
          severity={serverResponse.severity}
          sx={{ mt: 2, mb: 2 }}
          onClose={() => setServerResponse({ message: "", severity: "" })}
        >
          {serverResponse.message}
        </Alert>
      )}

      {/* Basic Info Step */}
      {activeStep === 0 && (
        <Box sx={{ mt: 3 }}>
          {renderUploadBox(
            "image",
            formData.photo,
            errors.photo,
            photoInputRef
          )}
          {/* {renderUploadBox(
            "video",
            formData.video,
            errors.video,
            videoInputRef
          )} */}
          <TextField
            label="Name"
            fullWidth
            margin="normal"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            error={!!errors.name}
            helperText={errors.name}
            required={true}
          />
          <TextField
            label="Description"
            fullWidth
            multiline
            rows={4}
            margin="normal"
            value={formData.description}
            onChange={(e) =>
              setFormData({ ...formData, description: e.target.value })
            }
            error={!!errors.description}
            helperText={errors.description}
            required={true}
          />

          <FormControlLabel
            control={
              <Checkbox
                checked={formData.isAlcoholic}
                onChange={(e) => {
                  const isAlcoholic = e.target.checked;
                  const selectedIngredient = [
                    ...liquorsData,
                    ...mixersData,
                  ].find((i) => i._id === ingredientSelected);

                  // If current selected ingredient is now invalid, clear it
                  if (!isAlcoholic && selectedIngredient?.isAlcoholic) {
                    setIngredientSelected("");
                  }

                  setFormData({ ...formData, isAlcoholic });
                }}
              />
            }
            label="Contains Alcohol"
          />
        </Box>
      )}

      {/* Describe Step */}
      {activeStep === 1 && (
        <Box sx={{ mt: 3, display: "grid", gap: 2 }}>
          {Object.entries(multiselectOptions).map(([key, options]) => (
            <FormControl key={key} fullWidth>
              <InputLabel>
                {key.charAt(0).toUpperCase() + key.slice(1)}
              </InputLabel>
              <Select
                multiple
                value={formData[key]}
                onChange={(e) =>
                  setFormData({ ...formData, [key]: e.target.value })
                }
                input={<OutlinedInput label={key} />}
                renderValue={(selected) => (
                  <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                    {selected.map((val) => (
                      <Chip key={val} label={val} />
                    ))}
                  </Box>
                )}
                MenuProps={{
                  PaperProps: {
                    style: {
                      maxHeight: options.length > 10 ? 300 : undefined,
                    },
                  },
                }}
              >
                {options.map((opt) => (
                  <MenuItem key={opt} value={opt}>
                    <ListItemIcon>
                      {formData[key].includes(opt) ? (
                        <CheckBox fontSize="small" />
                      ) : (
                        <CheckBoxOutlineBlank fontSize="small" />
                      )}
                    </ListItemIcon>
                    <ListItemText primary={opt} />
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          ))}
        </Box>
      )}

      {/* Ingredients Step */}
      {activeStep === 2 && (
        <Box sx={{ mt: 3 }}>
          <Autocomplete
            disablePortal
            options={glassesData}
            getOptionLabel={(option) =>
              `${option.name} (Max ${option.maxOunces ?? "?"} oz)`
            }
            // value={glassesData.find((g) => g._id === formData.glass) || null}
            value={formData.glass || null}
            onChange={(event, newValue) => {
              setFormData({ ...formData, glass: newValue });
            }}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Glass"
                margin="normal"
                fullWidth
                error={!!errors.glass}
                helperText={errors.glass}
                required
              />
            )}
          />

          <Typography variant="h6" sx={{ mb: 1 }}>
            Add Ingredients
          </Typography>
          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={2}
            sx={{ mb: 2, flexWrap: "wrap" }}
            alignItems={{ xs: "stretch", sm: "center" }}
          >
            <TextField
              label="Ounces"
              type="number"
              value={ingredientAmount}
              onChange={(e) => {
                const v = e.target.value;
                setIngredientAmount(v === "" ? "" : parseFloat(v));
              }}
              InputProps={{ inputProps: { min: 0, step: 0.1 } }}
              sx={{
                width: { xs: "100%", sm: 80 }, // 👈 wider on desktop
                flex: "0 0 auto", // 👈 don't shrink
              }}
            />

            <Autocomplete
              disablePortal
              options={filteredIngredients}
              getOptionLabel={(option) => option.name}
              value={
                filteredIngredients.find((i) => i._id === ingredientSelected) ||
                null
              }
              onChange={(event, newValue) => {
                setIngredientSelected(newValue ? newValue._id : "");
              }}
              renderInput={(params) => (
                <TextField {...params} label="Ingredient" fullWidth />
              )}
              // Grow to fill space on larger screens, full width on mobile
              sx={{
                minWidth: { sm: 260 },
                width: { xs: "100%", sm: "auto" },
                flex:  1  // take remaining space on sm+
              }}
            />

            <Autocomplete
              freeSolo
              disabled={!ingredientSelected}
              options={
                Array.isArray(selectedIngredientObj?.brands)
                  ? selectedIngredientObj.brands
                  : []
              }
              value={brandSelected}
              onChange={(_, value) => setBrandSelected(value || "")}
              onInputChange={(_, value) => setBrandSelected(value || "")}
              renderInput={(params) => (
                <TextField {...params} label="Brand (optional)" fullWidth />
              )}
              sx={{
                
                width: { xs: "100%", sm: "auto" },
                flex:  1 
              }}
            />

            <TextField
              disabled={!ingredientSelected}
              label="Flavor (optional)"
              value={flavorSelected}
              onChange={(e) => setFlavorSelected(e.target.value)}
              placeholder="Strawberry, Raspberry, Blueberry"
              fullWidth
              sx={{
                width: { xs: "100%", sm: "auto" },
                flex: 1,
              }}
            />

            <Button
              variant="contained"
              startIcon={<Add />}
              onClick={addIngredient}
              disabled={Number(ingredientAmount) <= 0 || !ingredientSelected}
              sx={{
                width: { xs: "100%", sm: "auto" },
                alignSelf: { xs: "stretch", sm: "auto" },
                py: { xs: 1.25, sm: 1 }, // a bit taller on mobile
              }}
            >
              Add
            </Button>
          </Stack>

          {glassObject && totalOunces > glassObject.maxOunces && (
            <Alert severity="warning" icon={<WarningAmber />} sx={{ mb: 2 }}>
              Currently the ingredient list has total of{" "}
              {totalOunces.toFixed(1)} ounces, the max ounce for glass is
              typically {glassObject.maxOunces} oz.
            </Alert>
          )}

          <List
            sx={{ maxHeight: 300, overflowY: "auto", mb: 2, scrollbarWidth: 1 }}
          >
            {formData.ingredients.map((ing, idx) => (
              <ListItem
                key={ing._id || idx}
                divider
                draggable
                onDragStart={handleReorderDragStart("ingredients", idx)}
                onDragOver={handleReorderDragOver}
                onDrop={handleReorderDrop("ingredients", idx)}
                onDragEnd={handleReorderDragEnd}
                sx={{
                  cursor: "grab",
                  opacity:
                    draggedItem?.type === "ingredients" &&
                    draggedItem?.index === idx
                      ? 0.55
                      : 1,
                  bgcolor:
                    draggedItem?.type === "ingredients" &&
                    draggedItem?.index === idx
                      ? "action.hover"
                      : "transparent",
                }}
              >
                <ListItemIcon sx={{ minWidth: 36, color: "text.secondary" }}>
                  <Tooltip title="Drag to reorder">
                    <DragIndicator fontSize="small" />
                  </Tooltip>
                </ListItemIcon>
                <ListItemText
                  primary={formatIngredientAmount(ing)}
                  secondary={
                    ing.brand
                      ? `Base ingredient: ${ing.name}`
                      : undefined
                  }
                />
                <IconButton onClick={() => removeIngredient(ing._id)}>
                  <Delete />
                </IconButton>
              </ListItem>
            ))}
          </List>
          {errors.ingredients && (
            <Typography color="error">{errors.ingredients}</Typography>
          )}
        </Box>
      )}

      {/* Instructions Step */}
      {activeStep === 3 && (
        <Box sx={{ mt: 3 }}>
          <TextField
            label="Add Instruction"
            fullWidth
            multiline
            rows={2}
            value={currentInstruction}
            onChange={(e) => setCurrentInstruction(e.target.value)}
            margin="normal"
          />
          <Button
            startIcon={<Add />}
            variant="outlined"
            onClick={handleInstructionAdd}
            disabled={!currentInstruction.trim()}
          >
            Add Instruction
          </Button>

          <List sx={{ maxHeight: 230, overflowY: "auto", mt: 2 }}>
            {formData.instructions.map((inst, index) => (
              <ListItem
                key={`${inst}-${index}`}
                divider
                draggable
                onDragStart={handleReorderDragStart("instructions", index)}
                onDragOver={handleReorderDragOver}
                onDrop={handleReorderDrop("instructions", index)}
                onDragEnd={handleReorderDragEnd}
                sx={{
                  cursor: "grab",
                  opacity:
                    draggedItem?.type === "instructions" &&
                    draggedItem?.index === index
                      ? 0.55
                      : 1,
                  bgcolor:
                    draggedItem?.type === "instructions" &&
                    draggedItem?.index === index
                      ? "action.hover"
                      : "transparent",
                  pr: 12,
                }}
              >
                <ListItemIcon sx={{ minWidth: 36, color: "text.secondary" }}>
                  <Tooltip title="Drag to reorder">
                    <DragIndicator fontSize="small" />
                  </Tooltip>
                </ListItemIcon>
                <ListItemText primary={`Step ${index + 1}: ${inst}`} />
                <ListItemSecondaryAction>
                  <Tooltip title="Edit">
                    <IconButton onClick={() => handleInstructionEdit(index)}>
                      <Edit />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Delete">
                    <IconButton onClick={() => handleInstructionDelete(index)}>
                      <Delete />
                    </IconButton>
                  </Tooltip>
                </ListItemSecondaryAction>
              </ListItem>
            ))}
          </List>

          {errors.instructions && (
            <Typography color="error">{errors.instructions}</Typography>
          )}
        </Box>
      )}

      {/* Review Step */}
      {activeStep === 4 && (
        <Box sx={{ mt: 3 }}>
          <Typography>Click Review to see drink summary.</Typography>
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
          {/* Activity log (only while editing an existing drink) */}
          {isEditing && drink?._id && (
            <Box sx={{ mt: 4 }}>
              <Typography
                variant="subtitle2"
                sx={{ mb: 1, color: "text.secondary" }}
              >
                Activity
              </Typography>
              <ActivityLogsTable entityModel="Drink" entityId={drink._id} />
            </Box>
          )}
        </Box>
      )}

      {/* Step Controls */}
      <Box sx={{ display: "flex", justifyContent: "space-between", mt: 4 }}>
        <Button disabled={activeStep === 0} onClick={handleBack} sx={{color: 'var(--primary-color)'}}>
          Back
        </Button>

        <Button variant="contained" onClick={handleNext} sx={{backgroundColor: 'var(--primary-color)'}}>
          {activeStep === steps.length - 1 ? "Review" : "Next"}
        </Button>
      </Box>

      {isEditing && (
        <Box sx={{ display: "flex", justifyContent: "space-between", mt: 4 }}>
          <Button
            variant="outlined"
            color="error"
            onClick={() => setDeleteDialogOpen(true)}
            sx={{ mr: 1 }}
          >
            Delete
          </Button>
        </Box>
      )}

      {/* Review Dialog */}
      <Dialog
        open={reviewOpen}
        onClose={() => setReviewOpen(false)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Review Drink</DialogTitle>

        <DialogContent dividers sx={{ maxHeight: 800, overflowY: "auto" }}>
          {/* Hero image */}
          {formData.photo && (
            <img
              src={
                typeof formData.photo === "string"
                  ? formData.photo
                  : formData.photo instanceof File
                  ? URL.createObjectURL(formData.photo)
                  : ""
              }
              alt="preview"
              style={{
                width: "240px",
                maxHeight: 240,
                objectFit: "cover",
                marginBottom: 12,
                borderRadius: 8,
              }}
            />
          )}

          {/* Title + author */}
          <Typography variant="h4">{formData.name}</Typography>
          <Typography variant="subtitle1" color="text.secondary" gutterBottom>
            by {author?.name || "Tipsyverse"}
          </Typography>

          {/* Description */}
          {formData.description && (
            <Typography paragraph sx={{ mt: 0.5 }}>
              {formData.description}
            </Typography>
          )}

          {/* Categories (Gen-Z flair) */}
          <CategoryRow
            items={
              Array.isArray(formData.categories) ? formData.categories : []
            }
          />

          <Typography variant="subtitle1" gutterBottom>
            Tags:
          </Typography>
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, mb: 2 }}>
            {formData.tags.length > 0 ? (
              formData.tags.map((tag, index) => {
                const style = TAG_STYLES[tag] || { icon: "🏷️", color: "gray" };
                return (
                  <Chip
                    key={index}
                    label={`${style.icon} ${tag}`}
                    sx={{
                      backgroundColor: style.color,
                      color: "white",
                      fontWeight: "bold",
                    }}
                  />
                );
              })
            ) : (
              <Typography variant="body2">No tags selected</Typography>
            )}
          </Box>

          {/* Attribute chips (mirrors DrinkDetailScreen) */}
          <Box sx={{ mt: 1 }}>
            <TagRow
              label="Taste"
              icon={<TagIcon />}
              items={toArray(formData.taste).map(String)}
            />
            <TagRow
              label="Glass"
              icon={<LocalBarIcon />}
              items={
                glassLabelFromForm(formData.glass)
                  ? [glassLabelFromForm(formData.glass)]
                  : []
              }
            />
            <TagRow
              label="Tools"
              icon={<BuildIcon />}
              items={toArray(formData.tools)}
            />
            <TagRow
              label="Garnishes"
              icon={<SpaIcon />}
              items={toArray(formData.garnishes)}
            />
          </Box>

          {/* Ingredients */}
          <Box sx={{ mt: 2 }}>
            <Typography variant="h6">Ingredients</Typography>
            {Array.isArray(formData.ingredients) &&
            formData.ingredients.length > 0 ? (
              <ul style={{ paddingLeft: 24, marginTop: 8 }}>
                {formData.ingredients.map((item, idx) => (
                  <li key={idx}>
                    <Typography>
                      {(() => {
                        return formatIngredientAmount(item);
                      })()}
                    </Typography>
                  </li>
                ))}
              </ul>
            ) : (
              <Typography color="text.secondary">
                No ingredients added.
              </Typography>
            )}
          </Box>

          {/* Instructions (progressive feel) */}
          <Box sx={{ mt: 2 }}>
            <Typography variant="h6">Instructions</Typography>
            <Divider sx={{ my: 1 }} />
            {Array.isArray(formData.instructions) &&
            formData.instructions.length > 0 ? (
              <Collapse in={true} collapsedSize={96 /* ~2 steps tall */}>
                <ol style={{ paddingLeft: 24, margin: 0 }}>
                  {formData.instructions.map((step, i) => (
                    <li key={i} style={{ marginBottom: 6 }}>
                      <Typography>{step}</Typography>
                    </li>
                  ))}
                </ol>
              </Collapse>
            ) : (
              <Typography color="text.secondary">
                No instructions provided.
              </Typography>
            )}
          </Box>
        </DialogContent>

        <DialogActions>
          <Button onClick={() => setReviewOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            startIcon={isEditing ? <Save /> : <Add />}
            onClick={handleCreateOrSave}
          >
            {isEditing ? "Save Drink" : "Create Drink"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Dialog*/}
      <Dialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
      >
        <DialogTitle>Confirm Delete</DialogTitle>
        <DialogContent>
          <Typography>
            Please type the name of the drink (<strong>{formData.name}</strong>)
            to confirm deletion.
          </Typography>
          <TextField
            autoFocus
            margin="dense"
            fullWidth
            label="Drink Name"
            value={deleteConfirmName}
            onChange={(e) => setDeleteConfirmName(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button
            color="error"
            variant="contained"
            disabled={deleteConfirmName !== formData.name || loading}
            loading={loading}
            onClick={handleDelete}
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default AdminDrinkForm;
