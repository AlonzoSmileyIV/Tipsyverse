import React, { useState } from "react";
import {
  Box,
  Button,
  Collapse,
  InputAdornment,
  Stack,
  TextField,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import { FilterList, Search } from "@mui/icons-material";

export default function AdminTableControls({
  search,
  onSearchChange,
  searchPlaceholder = "Search...",
  children,
  sx,
}) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const [filtersOpen, setFiltersOpen] = useState(false);
  const hasFilters = Boolean(children);

  return (
    <Box sx={{ mb: 2, ...sx }}>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
        <TextField
          fullWidth
          size="small"
          value={search}
          onChange={(event) => onSearchChange?.(event.target.value)}
          placeholder={searchPlaceholder}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Search />
              </InputAdornment>
            ),
          }}
        />
        {hasFilters && isMobile && (
          <Button
            variant="outlined"
            startIcon={<FilterList />}
            onClick={() => setFiltersOpen((open) => !open)}
            sx={{
              color: "var(--primary-color)",
              borderColor: "var(--primary-color)",
              whiteSpace: "nowrap",
            }}
          >
            Filters
          </Button>
        )}
        {hasFilters && !isMobile && (
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            {children}
          </Stack>
        )}
      </Stack>
      {hasFilters && isMobile && (
        <Collapse in={filtersOpen}>
          <Stack spacing={1} sx={{ pt: 1.5 }}>
            {children}
          </Stack>
        </Collapse>
      )}
    </Box>
  );
}
