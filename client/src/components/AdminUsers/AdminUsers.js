import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Box, Button } from "@mui/material";
import { useDispatch, useSelector } from "react-redux";
import AdminCustomers from "../AdminCustomers/AdminCustomers";
import AdminBartenders from "../AdminBartenders/AdminBartenders";
import AdminBartenderLicenses from "../AdminBartenderLicenses/AdminBartenderLicenses";
import AdminManageTeam from "../AdminManageTeam/AdminManageTeam";
import {
  fetchAllBartenderLicenses,
  fetchAllBartenders,
  fetchAllEmployees,
  fetchAllRegularUsers,
} from "../../features/users/userSlice";
import AdminSectionHeader from "../AdminSectionHeader/AdminSectionHeader";
import AdminSummaryCards from "../AdminSummaryCards/AdminSummaryCards";
import { loadSpreadsheet } from "../../utils/loadSpreadsheet";

const primaryButtonSx = {
  color: "var(--primary-color)",
  borderColor: "var(--primary-color)",
  "&:hover": {
    borderColor: "var(--primary-color)",
    backgroundColor: "rgba(128, 0, 32, 0.06)",
  },
};

const primaryContainedSx = {
  backgroundColor: "var(--primary-color)",
  "&:hover": { backgroundColor: "#5f001f" },
};

const toArray = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
};

const downloadRows = async (rows, sheetName) => {
  const XLSX = await loadSpreadsheet();
  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  XLSX.writeFile(workbook, `${sheetName}.xlsx`);
};

function AdminUsers() {
  const dispatch = useDispatch();
  const [tab, setTab] = useState("customers");
  const [licensesNeedReviewOnly, setLicensesNeedReviewOnly] = useState(false);

  const usersState = useSelector((state) => state.users);
  const customers = toArray(usersState?.allRegularUsers);
  const bartenders = toArray(usersState?.allBartenders);
  const licenses = toArray(usersState?.allBartenderLicenses);
  const team = toArray(usersState?.allEmployees);

  const needReviewCount = useMemo(
    () =>
      licenses.filter((license) =>
        ["pending", "under_review"].includes(String(license?.status || "").toLowerCase())
      ).length,
    [licenses]
  );

  const summaryCards = [
    {
      key: "customers",
      count: customers.length,
      label: "Customers",
      description: "Regular customer accounts",
    },
    {
      key: "bartenders",
      count: bartenders.length,
      label: "Bartenders",
      description: "Bartender profiles",
    },
    {
      key: "licenses",
      count: licenses.length,
      label: "Bartender Licenses",
      description: `${needReviewCount} need review`,
    },
    {
      key: "team",
      count: team.length,
      label: "Our Team",
      description: "Employee profiles",
    },
  ];

  const refreshAll = useCallback(() => {
    dispatch(fetchAllRegularUsers());
    dispatch(fetchAllBartenders({}));
    dispatch(fetchAllBartenderLicenses());
    dispatch(fetchAllEmployees());
  }, [dispatch]);

  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  const handleDownload = async () => {
    if (tab === "customers") {
      await downloadRows(
        customers.map((user) => ({
          Name: user.fullName,
          Email: user.email,
          Status: user.accountStatus?.state || user.status || "",
          Created: user.createdAt || user.dateCreated || "",
        })),
        "Customers"
      );
      return;
    }

    if (tab === "bartenders") {
      const rows = bartenders.map((user) => ({
        Name: user.fullName,
        Email: user.email,
        Status: user.bartenderStatus || "",
      }));
      await downloadRows(rows, "Bartenders");
      return;
    }

    if (tab === "licenses") {
      const rows = (licensesNeedReviewOnly
        ? licenses.filter((license) =>
            ["pending", "under_review"].includes(String(license?.status || "").toLowerCase())
          )
        : licenses
      ).map((license) => ({
        Bartender: license.bartenderName || license.user?.fullName || "",
        Email: license.bartenderEmail || license.user?.email || "",
        State: license.state || "",
        Permit: license.permitNumber || "",
        Status: license.status || "",
        Expires: license.expiresAt || "",
      }));
      await downloadRows(
        rows,
        licensesNeedReviewOnly ? "Licenses Need Review" : "Licenses"
      );
      return;
    }

    await downloadRows(
      team.map((employee) => ({
        Name: employee.fullName,
        Email: employee.email,
        Position: employee.employeeDetails?.position?.name || "",
        Status: employee.employeeDetails?.employmentStatus?.state || "",
      })),
      "Our Team"
    );
  };

  const downloadLabel = {
    customers: "Download Customer Excel",
    bartenders: "Download Bartender Excel",
    licenses: "Download License Excel",
    team: "Download Team Excel",
  }[tab];

  return (
    <Box>
      <Box sx={{ mb: 2 }}>
        <AdminSectionHeader
          title="Users"
          subtitle="Manage customers, bartenders, licenses, and internal team records."
          onRefresh={refreshAll}
          onDownload={handleDownload}
          downloadLabel={downloadLabel}
        />
      </Box>

      

      <AdminSummaryCards
        cards={summaryCards}
        sx={{
          gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
          "@media (max-width: 1500px)": {
            gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
          },
          "@media (max-width: 599.95px)": {
            gridTemplateColumns: "1fr",
          },
        }}
        selectedKey={tab}
        onSelect={(key) => {
          setTab(key);
          if (key !== "licenses") setLicensesNeedReviewOnly(false);
        }}
      />

      {tab === "licenses" && (
        <Button
          variant={licensesNeedReviewOnly ? "contained" : "outlined"}
          sx={licensesNeedReviewOnly ? { mb: 2, ...primaryContainedSx } : { mb: 2, ...primaryButtonSx }}
          onClick={() => setLicensesNeedReviewOnly((prev) => !prev)}
        >
          Need Review ({needReviewCount})
        </Button>
      )}

      {tab === "customers" && <AdminCustomers hideHeader />}
      {tab === "bartenders" && <AdminBartenders hideHeader />}
      {tab === "licenses" && <AdminBartenderLicenses hideHeader reviewOnly={licensesNeedReviewOnly} />}
      {tab === "team" && <AdminManageTeam hideHeader />}
    </Box>
  );
}

export default AdminUsers;
