import React, { useEffect, useState } from "react";
import {
  Box,
  Grid,
  Paper,
  Typography,
  Chip,
  IconButton,
  Stack,
  Tooltip,
  Skeleton,
  Button,
} from "@mui/material";
import { CheckCircle, MoreVert, RadioButtonUnchecked } from "@mui/icons-material";
import api from "../../services/api";

const PaymentMethodList = ({
  ownerId,
  selected,
  onChange,
  onAddClick,
  refreshKey = 0,
  onEdit,
  onRemove,
  allowAdd = true,
  allowEdit = true,
  allowDelete = true,
}) => {
  const [loading, setLoading] = useState(false);
  const [methods, setMethods] = useState([]);

  useEffect(() => {
    if (!ownerId) return;
    (async () => {
      setLoading(true);
      try {
        // Use your preferred endpoint. If you support /payment-methods?owner=ownerId, switch to that.
        const res = await api.get(`/payment-methods/${ownerId}`);
        setMethods(res.data?.data || res.data || []);
      } catch {
        setMethods([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [ownerId, refreshKey]);

  if (!ownerId)
    return (
      <Typography variant="body2" color="text.secondary">
        No organizer on file.
      </Typography>
    );

  if (loading) {
    return (
      <Grid container spacing={2}>
        {Array.from({ length: 2 }).map((_, i) => (
          <Grid item xs={12} md={6} key={i}>
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Skeleton variant="rectangular" height={120} />
            </Paper>
          </Grid>
        ))}
      </Grid>
    );
  }

  const CardArt = ({ brand = "card" }) => (
    <Box
      sx={{
        width: 110,
        height: 70,
        borderRadius: 2,
        background:
          brand === "visa"
            ? "linear-gradient(135deg,#0A2A88,#1E66FF)"
            : brand === "mastercard"
            ? "linear-gradient(135deg,#F79E1B,#E3001B)"
            : brand === "amex"
            ? "linear-gradient(135deg,#016FD0,#00AEEF)"
            : brand === "discover"
            ? "linear-gradient(135deg,#F47216,#333)"
            : "linear-gradient(135deg,#6B7280,#111827)",
        display: "flex",
        alignItems: "flex-end",
        color: "#fff",
        p: 1,
        fontWeight: 700,
        letterSpacing: 1,
        fontSize: 12,
      }}
    >
      {brand?.toUpperCase() || "CARD"}
    </Box>
  );

  const Card = (m) => {
    const isSelected = selected?._id === m._id;
    return (
      <Paper
        key={m._id}
        variant="outlined"
        sx={{
          p: 2,
          borderRadius: 2,
          position: "relative",
          borderColor: isSelected ? "var(--primary-color)" : "divider",
          boxShadow: isSelected ? 2 : 0,
        }}
      >
        <Stack
          direction="row"
          spacing={2}
          alignItems="center"
          onClick={() => onChange?.(m)}
          sx={{ cursor: "pointer" }}
        >
            {/* radio-like indicator */}
        <Box sx={{ display: "flex", alignItems: "center" }}>
          {isSelected ? (
            <CheckCircle sx={{ color: "var(--primary-color)" }} />
          ) : (
            <RadioButtonUnchecked sx={{ color: "text.disabled" }} />
          )}
        </Box>

          <Box position="relative">
            <CardArt brand={m.brand || "card"} />
            {m.isDefault && (
              <Chip
                size="small"
                label="Default"
                color="success"
                sx={{
                  position: "absolute",
                  top: -8,
                  left: -8,
                  fontWeight: 700,
                }}
              />
            )}
          </Box>

          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="h6" sx={{ mb: 0.25, lineHeight: 1.2 }}>
              {m.nickname ||
                (m.brand
                  ? m.brand[0].toUpperCase() + m.brand.slice(1)
                  : "Card")}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {(m.type || "card").toUpperCase()} ending in •••• {m.last4 || "—"}
            </Typography>
            {m.billingName && (
              <Typography variant="body2" color="text.secondary">
                {m.billingName}
              </Typography>
            )}
          </Box>

          {allowEdit && (
            <Tooltip title="More">
              <IconButton
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit?.(m);
                }}
              >
                <MoreVert />
              </IconButton>
            </Tooltip>
          )}
        </Stack>

        <Stack direction="row" spacing={1} sx={{ mt: 1.5 }}>
          {allowEdit && (
            <Button size="small" variant="outlined" onClick={() => onEdit?.(m)}>
              Edit
            </Button>
          )}
          {allowDelete && (
            <Button
              size="small"
              color="error"
              variant="text"
              onClick={() => onRemove?.(m)}
            >
              Delete
            </Button>
          )}
        </Stack>
      </Paper>
    );
  };

  return (
    <>
      {/* Horizontal, responsive list */}
      <Box
        role="list"
        sx={{
          display: "flex",
          gap: 2,
          overflowX: "auto",
          pb: 1,
          px: 0.5,
          scrollSnapType: "x mandatory",
          // nice-ish scrollbar
          "::-webkit-scrollbar": { height: 8 },
          "::-webkit-scrollbar-thumb": {
            backgroundColor: "divider",
            borderRadius: 8,
          },
          // ensure children snap
          "& > *": { scrollSnapAlign: "start" },
        }}
      >
        {methods.map((m) => (
          <Box
            key={m._id}
            role="listitem"
            sx={{
              flex: "0 0 auto",
              width: { xs: "92%", sm: 420, md: 520 }, // responsive card width
              maxWidth: "100%",
            }}
          >
            {Card(m)}
          </Box>
        ))}

        {/* Add tile */}
        {allowAdd && (
          <Box
            role="listitem"
            sx={{ flex: "0 0 auto", width: { xs: "92%", sm: 420, md: 520 } }}
          >
            <Paper
              variant="outlined"
              onClick={onAddClick}
              sx={{
                p: 2,
                borderRadius: 2,
                height: "100%",
                minHeight: 120,
                borderStyle: "dashed",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 2,
                "&:hover": { borderColor: "var(--primary-color)" },
              }}
            >
              <Box
                sx={{
                  width: 64,
                  height: 64,
                  borderRadius: "50%",
                  border: "2px dashed",
                  borderColor: "divider",
                  display: "grid",
                  placeItems: "center",
                  fontSize: 28,
                  color: "text.secondary",
                  flex: "0 0 auto",
                }}
              >
                +
              </Box>
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="subtitle1">
                  Add a payment method
                </Typography>
                <Typography variant="body2" color="text.secondary" noWrap>
                  Save a new card or bank account
                </Typography>
              </Box>
            </Paper>
          </Box>
        )}
      </Box>
    </>
  );
};

export default PaymentMethodList;
