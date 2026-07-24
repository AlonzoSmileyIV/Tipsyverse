import React, { useState } from "react";
import { Box, Paper, Tab, Tabs } from "@mui/material";
import AdminOperations from "../AdminOperations/AdminOperations";
import AdminCourses from "../AdminCourses/AdminCourses";
import AdminPromoCodes from "../AdminPromoCodes/AdminPromoCodes";

const tabsSx = {
  "& .MuiTabs-indicator": { backgroundColor: "var(--primary-color)" },
  "& .MuiTab-root.Mui-selected": {
    color: "var(--primary-color)",
    fontWeight: 700,
  },
};

function AdminOperationsHub() {
  const [tab, setTab] = useState("operations");

  return (
    <Box>
      <Paper variant="outlined" sx={{ mb: 2 }}>
        <Tabs
          value={tab}
          onChange={(event, value) => setTab(value)}
          variant="scrollable"
          scrollButtons="auto"
          sx={tabsSx}
        >
          <Tab value="operations" label="Incidents & Support" />
          <Tab value="promos" label="Promo Codes" />
          <Tab value="courses" label="Courses" />
        </Tabs>
      </Paper>

      {tab === "operations" && <AdminOperations />}
      {tab === "promos" && <AdminPromoCodes />}
      {tab === "courses" && <AdminCourses />}
    </Box>
  );
}

export default AdminOperationsHub;
