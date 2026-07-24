import { Box, CircularProgress, Typography } from "@mui/material";
const clamp = (n) => Math.max(0, Math.min(100, Number(n) || 0));
const hueFor = (v) => 120 * (clamp(v) / 100);

const CircularProgressRing = ({ value = 0 }) => {
  const v = clamp(value);
  const hue = hueFor(v);
  const color = `hsl(${hue} 80% 45%)`;
  return (
    <Box position="relative" display="inline-flex">
      <CircularProgress
        variant="determinate"
        value={100}
        size={80}
        thickness={5}
        sx={{
          color: (t) => t.palette.action.disabledBackground,
          position: "absolute",
          left: 0,
        }}
      />
      <CircularProgress
        variant="determinate"
        value={v}
        size={80}
        thickness={5}
        sx={{ "& .MuiCircularProgress-circle": { stroke: color } }}
      />
      <Box
        sx={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Typography variant="caption" fontWeight={700}>{`${Math.round(
          v
        )}%`}</Typography>
      </Box>
    </Box>
  );
};

export default CircularProgressRing;
