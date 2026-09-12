import {
  Visibility as VisibilityIcon
} from "@mui/icons-material";
import {
  Avatar,
  Box,
  Button,
  Drawer,
  IconButton,
  Tooltip,
  useMediaQuery,
} from "@mui/material";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { fetchReportedComments } from "../../features/comments/commentSlice";
import { DataGrid } from "@mui/x-data-grid";
import { navigateOrReload } from "../../utils/navigateOrReload";
import { useNavigate } from "react-router-dom";
import { abbreviateNumber } from "../../utils/abbreviateNumber";
import AdminReportDetailsForm from "../AdminReportDetailsForm/AdminReportDetailsForm";
import { useTheme } from "@mui/material/styles";
import { canInvestigateComment } from "../../accessControl/rbac";
import EmptyOverlay from "../EmptyOverlay/EmptyOverlay";

const AdminManageReportedComments = ({ reviewOnly = false, search = "" }) => {
  const dispatch = useDispatch();
  const [selectedComment, setSelectedComment] = useState(null);
  const reportedComments = useSelector((state) => state.comments?.reported);
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const is900OrLess = useMediaQuery("(max-width:900px)");
  const isTablet = useMediaQuery(theme.breakpoints.down("md"));
  const loggedInUser = useSelector((state) => state.users.loggedInUser)?.user;

  const reportedCommentsData = useMemo(
    () => {
      const term = search.trim().toLowerCase();
      const rows = reportedComments?.data?.length ? reportedComments?.data : [];
      const filteredByReview = reviewOnly
        ? rows.filter((comment) => Number(comment?.analytics?.counts?.reports || 0) > 0)
        : rows;

      if (!term) return filteredByReview;

      return filteredByReview.filter((comment) =>
        [
          comment?.author?.fullName,
          comment?.author?.email,
          comment?.content,
          comment?.drink?.name,
          comment?.drink?.slug,
          comment?.status,
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(term))
      );
    },
    [reportedComments, reviewOnly, search]
  );

  const fetchAllData = useCallback(() => {
    Promise.all([dispatch(fetchReportedComments())]);
  }, [dispatch]);

  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  const columns = [
    {
      width: 80,
      field: "avatar",
      headerName: "",
      renderCell: (params) => (
        <Avatar
          src={params.row?.author?.profile?.photo}
          alt={params.row?.author?.fullName}
        />
      ),
      sortable: false,
      filterable: false,
      cellClassName: "centerCell",
    },
    {
      field: "fullName",
      headerName: "Author's Name",
      width: isMobile ? 145 : 190,

      renderCell: (params) => params.row?.author?.fullName,
    },
    {
      field: "content",
      headerName: "Comment",
      flex: 1,

      renderCell: (params) => params.row?.content,
    },
    {
      field: "numberOfReports",
      headerName: "# Reports",
      flex: 0.5,

      renderCell: (params) =>
        abbreviateNumber(params.row?.analytics?.counts?.reports),
    },
    {
      field: "actions",
      headerName: "Actions",
      width: isMobile ? 170 : 150,
      align: "center",
      headerAlign: "center",
      sortable: false,
      filterable: false,
      cellClassName: "centerCell",
      renderCell: (params) => (
        <Box sx={{ display: "flex", gap: 1 }}>
          <Tooltip title="View Drink">
            <IconButton
              onClick={() =>
                navigateOrReload(
                  navigate,
                  `/drinks/${params.row?.drink?.slug}?commentId=${params.row?._id}`
                )
              }
            >
              <VisibilityIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Investigate">
            <Button
              variant="contained"
              size="small"
              sx={{
                backgroundColor: "var(--primary-color)",
                color: "#fff",
                textTransform: "none",
                "&:hover": {
                  opacity: 0.8,
                  backgroundColor: "var(--primary-color)", // maintain color on hover
                },
              }}
              disabled={!canInvestigateComment(loggedInUser, params.row.author)}
              onClick={() => setSelectedComment(params.row)}
            >
              Investigate
            </Button>
          </Tooltip>
        </Box>
      ),
    },
  ];

  return (
    <Box>
      {/* Header and buttons */}
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          mb: 2,
          flexWrap: "wrap",
        }}
      >
      </Box>

      {/* Data Grid */}
      <Box
  sx={{
    width: "100%",
    height: 650,
    minHeight: 500,
  }}
>
  <DataGrid
    rows={reportedCommentsData}
    columns={columns}
    getRowId={(row) => row._id}
    loading={reportedComments.loading}
    pageSizeOptions={[5, 10, 25]}
    columnVisibilityModel={{
      avatar: !isMobile,
      content: !is900OrLess,
      numberOfReports: !isTablet,
    }}
    disableRowSelectionOnClick
    slots={{
      noRowsOverlay: () => (
        <EmptyOverlay
          title="No Reported Comments"
          message="Great news! There aren't any reported comments waiting for review."
          primaryButton="Refresh"
          onPrimaryClick={fetchAllData}
        />
      ),
    }}
    sx={{
      "& .centerCell": {
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      },
    }}
  />
</Box>

      <Drawer
        anchor="right"
        open={Boolean(selectedComment)}
        onClose={() => setSelectedComment(null)}
        sx={{ zIndex: 1300 }}
        PaperProps={{ sx: { width: isMobile ? "80%" : 600, p: 2 } }}
      >
        {selectedComment && (
          <AdminReportDetailsForm
            comment={selectedComment}
            onClose={() => setSelectedComment(null)}
            onRefresh={fetchAllData}
          />
        )}
      </Drawer>
    </Box>
  );
};

export default AdminManageReportedComments;
