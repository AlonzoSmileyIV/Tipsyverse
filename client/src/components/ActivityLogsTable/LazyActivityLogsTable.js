import { lazy, Suspense } from "react";
import { Box, CircularProgress } from "@mui/material";

const ActivityLogsTable = lazy(() => import("./ActivityLogsTable"));

/**
 * Shared lazy boundary for activity history.
 *
 * Import this wrapper instead of ActivityLogsTable directly. Keeping one import
 * strategy allows Vite to place the relatively heavy table in its own chunk.
 */
export default function LazyActivityLogsTable(props) {
  return (
    <Suspense
      fallback={
        <Box sx={{ display: "grid", minHeight: 160, placeItems: "center" }}>
          <CircularProgress aria-label="Loading activity history" size={28} />
        </Box>
      }
    >
      <ActivityLogsTable {...props} />
    </Suspense>
  );
}
