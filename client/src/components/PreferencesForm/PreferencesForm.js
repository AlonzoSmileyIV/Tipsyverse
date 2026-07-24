import {
  Autocomplete,
  Box,
  Button,
  Stack,
  TextField,
  Typography,
  FormGroup,
  FormControlLabel,
  Switch,
  Paper,
} from "@mui/material";

import {
  HealthAndSafetyOutlined,
  NotificationsOutlined,
  RestartAltOutlined,
  SaveOutlined,
} from "@mui/icons-material";
import React, { useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { fetchAllLiquors } from "../../features/liquors/liquorSlice";
import { fetchAllMixers } from "../../features/mixers/mixerSlice";
import api from "../../services/api";
import { handleUpdateUser } from "../../utils/handleUpdateUser";
import { CollapseAlert } from "../CollapseAlert/CollapseAlert";

const PreferencesForm = ({ user }) => {
  const dispatch = useDispatch();
  const { allLiquors } = useSelector((state) => state.liquors);
  const { allMixers } = useSelector((state) => state.mixers);

  const [form, setForm] = useState({
    allergies: [],
    notifications: {
      onMute: false,
      inWebsite: true,
      email: true,
    },
  });

  const DEFAULT_PREFERENCES = {
    allergies: [],
    notifications: {
      onMute: false,
      inWebsite: true,
      email: true,
    },
  };

  const [alert, setAlert] = useState(null);

  const liquorOptions = useMemo(() => allLiquors?.data || [], [allLiquors]);
  const mixerOptions = useMemo(() => allMixers?.data || [], [allMixers]);

  const allergyOptions = useMemo(() => {
    const liquors = liquorOptions.map((l) => l.name);
    const mixers = mixerOptions.map((m) => m.name);
    return [...new Set([...liquors, ...mixers])];
  }, [liquorOptions, mixerOptions]);

  useEffect(() => {
    dispatch(fetchAllLiquors());
    dispatch(fetchAllMixers());
  }, [dispatch]);

  useEffect(() => {
    if (user) {
      setForm({
        allergies: user?.preferences?.allergies || [],
        notifications: {
          onMute: user?.preferences?.notifications?.onMute,
          inWebsite: user?.preferences?.notifications?.inWebsite,
          email: user?.preferences?.notifications?.email,
        },
      });
    }
  }, [user]);

  const handleSubmit = async () => {
    try {
      const res = await api.put(`/users/update-preferences`, {
        allergies: form.allergies,
        notifications: form.notifications,
      });

      setAlert({
        message: res.data.message || "Preferences updated",
        severity: "success",
      });
      handleUpdateUser(dispatch);
    } catch (error) {
      setAlert({
        message:
          error.response?.data?.message || "Failed to update preferences",
        severity: "error",
      });
    }
  };

  return (
  <Box>
    <Typography variant="h5" fontWeight={700}>
      Preferences & Allergies
    </Typography>

    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
      Personalize your Tipsyverse experience so we can help you discover drinks
      safely and notify you the way you prefer.
    </Typography>

    {alert && (
      <CollapseAlert
        open={!!alert}
        severity={alert.severity}
        message={alert.message}
        onClose={() => setAlert(null)}
      />
    )}

    <Stack spacing={3} sx={{ mt: 3 }}>
      {/* Allergies Section */}
      <Paper variant="outlined" sx={{ p: 3, borderRadius: 2 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
          <HealthAndSafetyOutlined
            sx={{ color: "var(--primary-color)" }}
            fontSize="small"
          />

          <Typography variant="h6">Dietary Preferences</Typography>
        </Box>

        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Select ingredients you want Tipsyverse to warn you about.
        </Typography>

        <Autocomplete
          multiple
          options={allergyOptions}
          value={form.allergies}
          onChange={(e, value) =>
            setForm((prev) => ({ ...prev, allergies: value }))
          }
          filterSelectedOptions
          renderInput={(params) => (
            <TextField
              {...params}
              label="Allergies"
              placeholder="Search liquors, mixers, or ingredients"
            />
          )}
          fullWidth
        />
      </Paper>

      {/* Notifications Section */}
      <Paper variant="outlined" sx={{ p: 3, borderRadius: 2 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
          <NotificationsOutlined
            sx={{ color: "var(--primary-color)" }}
            fontSize="small"
          />

          <Typography variant="h6">Notification Preferences</Typography>
        </Box>

        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Choose whether Tipsyverse can notify you about activity on your
          account.
        </Typography>

        <FormGroup>
          <FormControlLabel
            control={
              <Switch
                checked={form.notifications.onMute}
                onChange={(e) => {
                  const mute = e.target.checked;

                  setForm((prev) => ({
                    ...prev,
                    notifications: {
                      ...prev.notifications,
                      onMute: mute,
                      inWebsite: mute ? false : true,
                      email: mute ? false : true,
                    },
                  }));
                }}
              />
            }
            label="Mute all notifications"
          />
        </FormGroup>

        {form.notifications.onMute && (
          <Typography variant="caption" color="text.secondary">
            You won’t receive website or email notifications while this is on.
          </Typography>
        )}
      </Paper>

      {/* Actions */}
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          gap: 2,
          pt: 2,
          borderTop: "1px solid",
          borderColor: "divider",
          flexDirection: { xs: "column", sm: "row" },
        }}
      >
         <Button
          variant="contained"
          startIcon={<SaveOutlined />}
          sx={{
            backgroundColor: "var(--primary-color)",
            textTransform: "none",
          }}
          onClick={handleSubmit}
        >
          Save Preferences
        </Button>
        <Button
          variant="outlined"
          startIcon={<RestartAltOutlined />}
          sx={{
            color: "var(--primary-color) !important",
            borderColor: "var(--primary-color) !important",
            textTransform: "none",
          }}
          onClick={() => setForm(DEFAULT_PREFERENCES)}
        >
          Reset to Default
        </Button>
      </Box>
    </Stack>
  </Box>
);
};

export default PreferencesForm;
