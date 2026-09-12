import React from "react";
import { Box, Button, Stack, Typography } from "@mui/material";
import { Download, Refresh } from "@mui/icons-material";

const primaryButtonSx = {
  color: "var(--primary-color)",
  borderColor: "var(--primary-color)",
  "&:hover": {
    borderColor: "var(--primary-color)",
    backgroundColor: "rgba(128, 0, 32, 0.06)",
  },
};

function AdminSectionHeader({
  title,
  subtitle,
  onRefresh,
  onDownload,
  refreshLabel = "Refresh",
  downloadLabel = "Download Excel",
  actions,
}) {
  return (
    <Stack
      direction="row"
      justifyContent="space-between"
      alignItems="center"
      spacing={1}
      sx={{
        minWidth: 0,
        width: "100%",
        "@media (max-width: 1000px)": {
          flexDirection: "column",
          alignItems: "flex-start",
        },
      }}
    >
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="h5" fontWeight={800}>
          {title}
        </Typography>
        {subtitle && (
          <Typography variant="body2" color="text.secondary" sx={{ overflowWrap: "anywhere" }}>
            {subtitle}
          </Typography>
        )}
      </Box>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={1}
        useFlexGap
        sx={{
          width: { xs: "100%", sm: "auto" },
          maxWidth: "100%",
          flexShrink: 0,
          flexWrap: "wrap",
          justifyContent: { xs: "stretch", sm: "flex-end" },
          "& .MuiButton-root": {
            width: { xs: "100%", sm: "auto" },
            justifyContent: "center",
          },
        }}
      >
        {actions}
        {onRefresh && (
          <Button variant="outlined" startIcon={<Refresh />} onClick={onRefresh} sx={{ ...primaryButtonSx, whiteSpace: "nowrap" }}>
            {refreshLabel}
          </Button>
        )}
        {onDownload && (
          <Button variant="outlined" startIcon={<Download />} onClick={onDownload} sx={{ ...primaryButtonSx, whiteSpace: "nowrap" }}>
            {downloadLabel}
          </Button>
        )}
      </Stack>
    </Stack>
  );
}

export default AdminSectionHeader;
