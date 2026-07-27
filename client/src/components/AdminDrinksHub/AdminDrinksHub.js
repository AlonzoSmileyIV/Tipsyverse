import React, { lazy, Suspense, useState } from "react";
import { Box, CircularProgress, Paper, Tab, Tabs } from "@mui/material";
import AdminSectionHeader from "../AdminSectionHeader/AdminSectionHeader";

const AdminDrinks = lazy(() => import("../AdminDrinks/AdminDrinks"));
const AdminDrinkForm = lazy(() => import("../AdminDrinkForm/AdminDrinkForm"));
const AdminDrinkAnalytics = lazy(() =>
  import("../AdminDrinkAnalytics/AdminDrinkAnalytics")
);

const tabsSx = {
  "& .MuiTabs-indicator": { backgroundColor: "var(--primary-color)" },
  "& .MuiTab-root.Mui-selected": {
    color: "var(--primary-color)",
    fontWeight: 700,
  },
};

function AdminDrinksHub() {
  const [tab, setTab] = useState("library");
  const [tabActions, setTabActions] = useState(null);

  return (
    <Box>

      <Box sx={{ mb: 2 }}>
        <AdminSectionHeader
          title="Drinks"
          subtitle="Manage drink content, create recipes, and review drink analytics."
          onRefresh={tabActions?.refresh}
          onDownload={tabActions?.download}
          downloadLabel={tabActions?.downloadLabel || "Download Excel"}
        />
      </Box>
     

      <Paper variant="outlined" sx={{ mb: 2 }}>
        <Tabs
          value={tab}
          onChange={(event, value) => {
            setTab(value);
            setTabActions(null);
          }}
          variant="scrollable"
          scrollButtons="auto"
          sx={tabsSx}
        >
          <Tab value="library" label="Library" />
          <Tab value="create" label="Create Drink" />
          <Tab value="analytics" label="Analytics" />
        </Tabs>
      </Paper>

      <Suspense
        fallback={
          <Box sx={{ display: "grid", minHeight: 280, placeItems: "center" }}>
            <CircularProgress
              aria-label="Loading drinks section"
              sx={{ color: "var(--primary-color)" }}
            />
          </Box>
        }
      >
        {tab === "library" && (
          <AdminDrinks
            handleAddClick={() => setTab("create")}
            onActionsReady={setTabActions}
          />
        )}
        {tab === "create" && <AdminDrinkForm />}
        {tab === "analytics" && (
          <AdminDrinkAnalytics onActionsReady={setTabActions} />
        )}
      </Suspense>
    </Box>
  );
}

export default AdminDrinksHub;
