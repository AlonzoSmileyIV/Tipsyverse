import React from "react";
import {
  Box,
  Button,
  IconButton,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";

const renderAction = (primaryAction) => {
  if (!primaryAction) return null;
  if (React.isValidElement(primaryAction)) return primaryAction;
  if (!primaryAction.label) return null;

  const button = (
    <span>
      <Button
        size={primaryAction.size || "small"}
        variant={primaryAction.variant || "contained"}
        color={primaryAction.color || "primary"}
        startIcon={primaryAction.startIcon}
        onClick={primaryAction.onClick}
        disabled={primaryAction.disabled || primaryAction.loading}
        sx={primaryAction.sx}
      >
        {primaryAction.loading ? primaryAction.loadingLabel || "Working..." : primaryAction.label}
      </Button>
    </span>
  );

  if (primaryAction.disabled && primaryAction.disabledReason) {
    return <Tooltip title={primaryAction.disabledReason}>{button}</Tooltip>;
  }

  return button;
};

const DetailDrawerHeader = ({
  title,
  summary,
  statusChip,
  facts = [],
  primaryAction,
  lastUpdated,
  onClose,
  closeLabel = "Close details",
}) => {
  const visibleFacts = facts.filter((fact) => fact?.label);
  const actionNode = renderAction(primaryAction);

  return (
    <Box
      sx={{
        px: { xs: 2, sm: 3 },
        py: 2,
        borderBottom: 1,
        borderColor: "divider",
        bgcolor: "background.paper",
      }}
    >
      <Stack spacing={1.5}>
        <Stack
          direction="row"
          spacing={1.5}
          alignItems="flex-start"
          justifyContent="space-between"
        >
          <Box sx={{ minWidth: 0 }}>
            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
              <Typography variant="h6" fontWeight={800} sx={{ lineHeight: 1.2 }}>
                {title || "Details"}
              </Typography>
              {statusChip}
            </Stack>
            {summary && (
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ mt: 0.75, maxWidth: 680 }}
              >
                {summary}
              </Typography>
            )}
          </Box>

          {onClose && (
            <Tooltip title={closeLabel}>
              <IconButton onClick={onClose} size="small" aria-label={closeLabel}>
                <CloseIcon />
              </IconButton>
            </Tooltip>
          )}
        </Stack>

        {(visibleFacts.length > 0 || actionNode || lastUpdated) && (
          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={1.5}
            alignItems={{ xs: "stretch", sm: "flex-end" }}
            justifyContent="space-between"
          >
            {visibleFacts.length > 0 && (
              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: {
                    xs: "repeat(2, minmax(0, 1fr))",
                    sm: "repeat(4, minmax(0, 1fr))",
                  },
                  gap: 1.25,
                  flex: 1,
                }}
              >
                {visibleFacts.map((fact) => (
                  <Box key={fact.label} sx={{ minWidth: 0 }}>
                    <Typography variant="caption" color="text.secondary">
                      {fact.label}
                    </Typography>
                    <Typography
                      variant="body2"
                      fontWeight={800}
                      sx={{ wordBreak: "break-word" }}
                    >
                      {fact.value || "Not provided"}
                    </Typography>
                  </Box>
                ))}
              </Box>
            )}

            {(actionNode || lastUpdated) && (
              <Stack
                spacing={0.75}
                alignItems={{ xs: "stretch", sm: "flex-end" }}
                sx={{ flexShrink: 0 }}
              >
                {actionNode}
                {lastUpdated && (
                  <Typography variant="caption" color="text.secondary">
                    {lastUpdated}
                  </Typography>
                )}
              </Stack>
            )}
          </Stack>
        )}
      </Stack>
    </Box>
  );
};

export default DetailDrawerHeader;
