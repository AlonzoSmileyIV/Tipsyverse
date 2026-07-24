import { useEffect, useState, useRef } from "react";
import {
  Avatar,
  Box,
  Button,
  IconButton,
  Stack,
  TextField,
  Typography,
  Grid,
  Paper,
  Badge,
} from "@mui/material";

import { CameraAlt as CameraAltIcon, SaveOutlined } from "@mui/icons-material";
import api from "../../services/api";
import { handleUpdateUser } from "../../utils/handleUpdateUser";
import { useDispatch } from "react-redux";
import { CollapseAlert } from "../CollapseAlert/CollapseAlert";
import { isAtLeastAge } from "../../utils/dateOnly";

const normalizeUsername = (v) =>
  v
    .toLowerCase()
    .replace(/[^a-z0-9._]/g, "") // allow letters, numbers, dot, underscore
    .replace(/\.+/g, ".") // collapse multiple dots
    .replace(/_{2,}/g, "_"); // collapse multiple underscores

const ProfileForm = ({ user }) => {
  const dispatch = useDispatch();
  const photoInputRef = useRef(null);
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    username: "",
    birthday: "",
    bio: "",
    photo: "",
    photoPublicId: null,
  });

  const [alert, setAlert] = useState(null);
  const [errors, setErrors] = useState({});
  const [uploadingImage, setUploadingImage] = useState(false);
  const [recommended, setRecommended] = useState([]);

  // ✅ Populate form with user data when user loads
  useEffect(() => {
    if (user) {
      setForm({
        fullName: user.fullName || "",
        username: user?.username || "",
        email: user.email || "",
        birthday: user?.profile?.birthday?.slice(0, 10) || "",
        bio: user?.profile?.bio || "",
        photo: user?.profile?.photo || "",
        photoPublicId: user?.profile?.photoPublicId || null,
      });
    }
  }, [user]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    // keep username normalized + lowercase
    const next = name === "username" ? normalizeUsername(value) : value;
    setForm((prev) => ({ ...prev, [name]: next }));
    setErrors((prev) => ({ ...prev, [name]: "" }));
  };

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
        setForm((prev) => ({
          ...prev,
          photo: result.photo,
          photoPublicId: result.photoPublicId,
        }));
      } else {
        setForm((prev) => ({
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

  // ✅ Validate form before submission
  const validate = () => {
    const newErrors = {};
    if (!form.fullName.trim()) {
      newErrors.fullName = "Full name is required.";
    }
    if (!form.username.trim()) newErrors.username = "Username is required.";

    if (!form.birthday) {
      newErrors.birthday = "Date of birth is required.";
    } else if (!isAtLeastAge(form.birthday, 21)) {
      newErrors.birthday = "You must be at least 21 years old.";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;

    try {
      const payload = {
        username: form.username, // 👈 include username in update
        fullName: form.fullName,
        birthday: form.birthday,
        bio: form.bio,
        photo: form.photo,
        photoPublicId: form.photoPublicId,
      };

      const res = await api.put(`/users/update-profile`, payload);
      setAlert({ message: res.data.message, severity: "success" });
      setRecommended([]); // clear any old suggestions
      handleUpdateUser(dispatch);
    } catch (error) {
      const errMsg =
        error.response?.data?.message || "An error occurred during update.";
      const recs = error.response?.data?.recommended || [];
      setAlert({ message: errMsg, severity: "error" });
      setRecommended(recs);
    }
  };

  return (
    <Box component="form" noValidate onSubmit={(e) => e.preventDefault()}>
      <Typography variant="h5" fontWeight={700}>
        Edit Profile
      </Typography>

      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Update your personal information, avatar, and public profile details.
      </Typography>

      {alert && (
        <CollapseAlert
          open={!!alert}
          severity={alert.severity}
          message={alert.message}
          onClose={() => setAlert(null)}
        >
          {recommended.length > 0 && (
            <Box sx={{ mt: 1 }}>
              <Typography variant="body2" fontWeight={600}>
                Try one of these usernames:
              </Typography>

              <Stack
                direction="row"
                spacing={1}
                flexWrap="wrap"
                useFlexGap
                sx={{ mt: 1 }}
              >
                {recommended.map((u) => (
                  <Button
                    key={u}
                    variant="outlined"
                    size="small"
                    onClick={() => {
                      setForm((f) => ({ ...f, username: u }));
                      setErrors((e) => ({ ...e, username: "" }));
                    }}
                    sx={{
                      textTransform: "none",
                      borderColor: "var(--primary-color)",
                      color: "var(--primary-color)",
                    }}
                  >
                    @{u}
                  </Button>
                ))}
              </Stack>
            </Box>
          )}
        </CollapseAlert>
      )}

      {/* Profile Header */}
      <Paper
        variant="outlined"
        sx={{
          p: 3,
          borderRadius: 2,
          mb: 3,
          display: "flex",
          flexDirection: { xs: "column", sm: "row" },
          alignItems: { xs: "center", sm: "center" },
          gap: 3,
        }}
      >
        <Badge
          overlap="circular"
          anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
          badgeContent={
            <IconButton
              component="label"
              size="small"
              
              sx={{
                backgroundColor: "var(--primary-color)",
                color: "white",
                boxShadow: 1,
                "&:hover": {
                  backgroundColor: "var(--primary-color)",
                },
                pointerEvents: form.username === 'tipsyverse' ? 'none' : 'auto'
              }}
            >
              <input
                type="file"
                hidden
                accept="image/*"
                disabled={uploadingImage}
                onChange={(e) => handleFileChange(e, "image")}
                ref={photoInputRef}
              />
              <CameraAltIcon fontSize="small" />
            </IconButton>
          }
        >
          <Avatar
            src={form.photo}
            alt={form.fullName || "Profile photo"}
            sx={{
              width: 120,
              height: 120,
              border: "3px solid white",
              boxShadow: 2,
            }}
          />
        </Badge>

        <Box sx={{ textAlign: { xs: "center", sm: "left" } }}>
          <Typography variant="h5" fontWeight={700}>
            {form.fullName || "Your Name"}
          </Typography>

          <Typography variant="body2" color="text.secondary">
            @{form.username || "username"}
          </Typography>

          <Typography variant="caption" color="text.secondary">
            This is how your profile appears across Tipsyverse.
          </Typography>
        </Box>
      </Paper>

      {/* Form Section */}
      <Paper variant="outlined" sx={{ p: 3, borderRadius: 2 }}>
        <Typography variant="h6" fontWeight={700} sx={{ mb: 2 }}>
          Personal Information
        </Typography>

        <Grid container spacing={2} sx={{ width: "100%", m: 0 }}>
          <Grid item size={{ xs: 12, md: 6 }}>
            {" "}
            <TextField
              label="Full Name"
              name="fullName"
              disabled={form.username === 'tipsyverse'}
              fullWidth
              value={form.fullName}
              onChange={handleChange}
              error={!!errors.fullName}
              helperText={errors.fullName}
            />
          </Grid>

          <Grid item size={{ xs: 12, md: 6 }}>
            {" "}
            <TextField
              label="Username"
              name="username"
              fullWidth
              disabled={form.username === 'tipsyverse'}
              value={form.username}
              onChange={handleChange}
              error={!!errors.username}
              helperText={
                errors.username || "Only letters, numbers, dot, and underscore."
              }
            />
          </Grid>

          <Grid item size={{ xs: 12, md: 6 }}>
            {" "}
            <TextField
              label="Email"
              fullWidth
              disabled
              value={form.email}
              helperText="Email cannot be changed here."
            />
          </Grid>

          <Grid item size={{ xs: 12, md: 6 }}>
            {" "}
            <TextField
              fullWidth
              label="Date of Birth"
              name="birthday"
              type="date"
              disabled={form.username === 'tipsyverse'}
              InputLabelProps={{ shrink: true }}
              value={form.birthday}
              onChange={handleChange}
              error={!!errors.birthday}
              helperText={
                errors.birthday || "You must be 21+ to use Tipsyverse."
              }
            />
          </Grid>
        </Grid>

        <Typography variant="h6" fontWeight={700} sx={{ mt: 4, mb: 2 }}>
          About You
        </Typography>

        <TextField
          label="Bio"
          name="bio"
          fullWidth
          multiline
          rows={4}
          value={form.bio}
          onChange={handleChange}
          placeholder="Tell the Tipsyverse community a little about yourself..."
          helperText={`${form.bio.length}/250`}
          inputProps={{ maxLength: 250 }}
          disabled={form.username === 'tipsyverse'}

        />

        <Box
          sx={{
            display: "flex",
            justifyContent: "flex-end",
            mt: 3,
          }}
        >
          <Button
            variant="contained"
            startIcon={<SaveOutlined />}
            sx={{
              backgroundColor: "var(--primary-color)",
              textTransform: "none",
              px: 4,
            }}
            onClick={handleSubmit}
            disabled={form.username === 'tipsyverse'}

          >
            Save Changes
          </Button>
        </Box>
      </Paper>
    </Box>
  );
};

export default ProfileForm;
