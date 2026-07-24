// components/Comments/CommentSkeleton.js
import React from "react";
import { Box, Skeleton } from "@mui/material";

const CommentSkeleton = ({ count = 3 }) => {
  return (
    <>
      {Array.from({ length: count }).map((_, idx) => (
        <Box key={`comment-skeleton-${idx}`} sx={{ mb: 3 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
            <Skeleton variant="circular" width={40} height={40} />
            <Box sx={{ flex: 1 }}>
              <Skeleton width="40%" height={16} />
              <Skeleton width="30%" height={14} />
            </Box>
          </Box>
          <Skeleton variant="text" width="100%" height={60} sx={{ mt: 2 }} />

          {/* 💬 Simulated reply */}
          <Box sx={{ pl: 6, mt: 2 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
              <Skeleton variant="circular" width={30} height={30} />
              <Box sx={{ flex: 1 }}>
                <Skeleton width="35%" height={14} />
                <Skeleton width="25%" height={12} />
              </Box>
            </Box>
            <Skeleton variant="text" width="95%" height={40} sx={{ mt: 1 }} />
          </Box>
        </Box>
      ))}
    </>
  );
};

export default CommentSkeleton;
