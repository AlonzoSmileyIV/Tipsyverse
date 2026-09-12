import React from "react";
import { Box, Button, Container, Paper, Stack, Typography } from "@mui/material";
import { Link as RouterLink } from "react-router-dom";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import BusinessCenterOutlinedIcon from "@mui/icons-material/BusinessCenterOutlined";
import CakeOutlinedIcon from "@mui/icons-material/CakeOutlined";
import FavoriteBorderOutlinedIcon from "@mui/icons-material/FavoriteBorderOutlined";

const eventTypes = [
  {
    icon: <FavoriteBorderOutlinedIcon />,
    title: "Weddings & Formal Events",
    description: "Thoughtful bar service for receptions, ceremonies, galas, and milestone occasions.",
  },
  {
    icon: <CakeOutlinedIcon />,
    title: "Birthdays & Celebrations",
    description: "Professional bartenders for private parties, anniversaries, holidays, and special moments.",
  },
  {
    icon: <BusinessCenterOutlinedIcon />,
    title: "Corporate & Community Events",
    description: "Reliable service for company gatherings, fundraisers, launches, and community events.",
  },
];

const EventServicesPromo = () => (
  <Box component="section" sx={{ py: { xs: 6, md: 9 }, bgcolor: "#fff" }}>
    <Container maxWidth="lg">
      <Stack spacing={1.5} alignItems="center" textAlign="center" sx={{ mb: 5 }}>
        <Typography variant="overline" color="var(--primary-color)" fontWeight={800}>
          Event bartending services
        </Typography>
        <Typography variant="h4" component="h2" fontWeight={800}>
          Bring a Professional Bar Experience to Your Event
        </Typography>
        <Typography color="text.secondary" sx={{ maxWidth: 720 }}>
          Share your event details and Tipsyverse will help you plan staffing,
          timing, bar setup, and the service your guests need.
        </Typography>
      </Stack>

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", md: "repeat(3, 1fr)" },
          gap: 3,
        }}
      >
        {eventTypes.map((eventType) => (
          <Paper
            key={eventType.title}
            variant="outlined"
            sx={{ p: 3, borderRadius: 3, height: "100%" }}
          >
            <Box
              sx={{
                width: 48,
                height: 48,
                display: "grid",
                placeItems: "center",
                borderRadius: "50%",
                color: "#fff",
                bgcolor: "var(--primary-color)",
                mb: 2,
              }}
            >
              {eventType.icon}
            </Box>
            <Typography variant="h6" fontWeight={800} gutterBottom>
              {eventType.title}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {eventType.description}
            </Typography>
          </Paper>
        ))}
      </Box>

      <Stack alignItems="center" sx={{ mt: 5 }}>
        <Button
          component={RouterLink}
          to="/book"
          variant="contained"
          size="large"
          endIcon={<ArrowForwardIcon />}
          sx={{ bgcolor: "var(--primary-color)", "&:hover": { bgcolor: "var(--primary-color)" } }}
        >
          Start Your Event Request
        </Button>
        <Typography variant="caption" color="text.secondary" sx={{ mt: 1.5 }}>
          Requesting an event does not commit you to a final price or staffing plan.
        </Typography>
      </Stack>
    </Container>
  </Box>
);

export default EventServicesPromo;
