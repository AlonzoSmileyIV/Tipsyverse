import React, { useEffect, useMemo } from "react";
import { Box, Grid, Typography, Paper, Skeleton, Alert } from "@mui/material";
import CountUp from "react-countup";
import { useInView } from "react-intersection-observer";
import { useDispatch, useSelector } from "react-redux";

import LocalBarIcon from "@mui/icons-material/LocalBar";
import GroupIcon from "@mui/icons-material/Group";
import SportsBarOutlinedIcon from "@mui/icons-material/SportsBarOutlined";
import EventAvailableOutlinedIcon from "@mui/icons-material/EventAvailableOutlined";

import { fetchAppStats } from "../../features/stats/statsSlice";

const abbreviateNumber = (num) => {
  if (num >= 1_000_000_000) return `${(num / 1_000_000_000).toFixed(1)}B+`;
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M+`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K+`;
  return num;
};

const Statistics = () => {
  const dispatch = useDispatch();
  const { appStats, status, error } = useSelector((s) => s.stats);

  const { ref, inView } = useInView({ triggerOnce: true, threshold: 0.3 });

  useEffect(() => {
    if (status === "idle") dispatch(fetchAppStats());
  }, [status, dispatch]);

  const cards = useMemo(
    () => [
      { icon: <EventAvailableOutlinedIcon sx={{ color: "var(--primary-color)" }} />, label: "Events Served", value: appStats.totalEventsCompleted },
      { icon: <LocalBarIcon sx={{ color: "var(--primary-color)" }} />, label: "Drinks", value: appStats.totalDrinks },
      { icon: <SportsBarOutlinedIcon sx={{ color: "var(--primary-color)" }} />, label: "Bartenders", value: appStats.totalBartenders },
      { icon: <GroupIcon sx={{ color: "var(--primary-color)" }} />, label: "Users", value: appStats.totalUsers },
    ],
    [appStats]
  );

  return (
    <Box sx={{ backgroundColor: "#f9f9f9", py: 10 }} ref={ref}>
      <Typography variant="h4" align="center" fontWeight="bold" gutterBottom>
        Tipsyverse by the Numbers
      </Typography>
      <Typography variant="subtitle1" align="center" sx={{ mb: 6 }}>
        See how our community is growing every day
      </Typography>

      {status === "failed" && (
        <Box sx={{ maxWidth: 800, mx: "auto", mb: 3 }}>
          <Alert severity="error">Failed to load stats: {error}</Alert>
        </Box>
      )}

      <Grid container spacing={4} justifyContent="center">
        {cards.map((stat, idx) => (
          <Grid item xs={12} sm={6} md={3} key={idx}>
            <Paper elevation={3} sx={{ p: 4, textAlign: "center", minHeight: 160 }}>
              <Box sx={{ fontSize: 40 }}>{stat.icon}</Box>

              <Typography variant="h4" fontWeight="bold" color="var(--primary-color)">
                {status === "loading" ? (
                  <Skeleton variant="text" width={100} height={42} sx={{ mx: "auto" }} />
                ) : inView ? (
                  <CountUp end={Number(stat.value) || 0} duration={2} formattingFn={abbreviateNumber} />
                ) : (
                  0
                )}
              </Typography>

              <Typography variant="subtitle1">{stat.label}</Typography>
            </Paper>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
};

export default Statistics;
