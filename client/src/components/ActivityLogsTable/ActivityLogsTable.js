// ActivityLogsTable.jsx
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import api from "../../services/api";
import {
  Alert,
  Avatar,
  Box,
  Stack,
  Typography,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
} from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import { Refresh as RefreshIcon, Visibility as VisibilityIcon,
 
 } from "@mui/icons-material";

/* ------------------------ Module-scope cache & dedupe ------------------------ */
const ACTIVITY_CACHE = new Map();      // key -> { ts, data }
const ACTIVITY_INFLIGHT = new Map();   // key -> AbortController
const ACTIVITY_TTL = 60_000;           // 1 minute

/* ------------------------ Stable helpers (module scope) ---------------------- */
const isPlainObject = (v) => v && typeof v === "object" && !Array.isArray(v);

const fmtDateMaybe = (v, path) => {
  if (v == null) return v === null ? "null" : "—";
  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}T/.test(v)) {
    const dateOnly =
      /(^|\.)(birthday|dateOfBirth|dob)($|\.|\[)/i.test(path) ||
      /T00:00:00\.000Z$/.test(v); // heuristic for date-only stamps
    const d = new Date(v);
    if (!Number.isNaN(d.getTime())) {
      return new Intl.DateTimeFormat("en-US", {
        dateStyle: "medium",
        ...(dateOnly ? { timeZone: "UTC" } : { timeStyle: "short" }),
      }).format(d);
    }
  }
  if (typeof v === "boolean" || typeof v === "number") return String(v);
  return String(v);
};

/** Flatten nested objects/arrays into a map of "path" -> value. */
const flattenToMap = (val, prefix = "", out = {}) => {
  if (val == null || typeof val !== "object") {
    out[prefix || "(value)"] = val;
    return out;
  }
  if (Array.isArray(val)) {
    if (val.length === 0) {
      out[prefix || "(value)"] = "[]";
      return out;
    }
    val.forEach((item, i) =>
      flattenToMap(item, prefix ? `${prefix}[${i}]` : `[${i}]`, out)
    );
    return out;
  }
  const keys = Object.keys(val);
  if (keys.length === 0) {
    out[prefix || "(value)"] = "{}";
    return out;
  }
  keys.forEach((k) => flattenToMap(val[k], prefix ? `${prefix}.${k}` : k, out));
  return out;
};

/** Deep-ish equality to filter unchanged leaves. */
const isDeepEqual = (a, b) => {
  if (a === b) return true;
  if (a == null || b == null) return a === b;

  const toMillis = (v) => {
    if (v instanceof Date) return v.getTime();
    if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}T/.test(v)) {
      const d = new Date(v);
      if (!Number.isNaN(d.getTime())) return d.getTime();
    }
    return null;
  };
  const am = toMillis(a);
  const bm = toMillis(b);
  if (am !== null || bm !== null) return am === bm;

  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++)
      if (!isDeepEqual(a[i], b[i])) return false;
    return true;
  }

  if (isPlainObject(a) && isPlainObject(b)) {
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    for (const k of keys) if (!isDeepEqual(a[k], b[k])) return false;
    return true;
  }

  return String(a) === String(b);
};

/* --------------------------------- Component --------------------------------- */

const ActivityLogsTable = ({ entityModel = "User", entityId }) => {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [selectedLog, setSelectedLog] = useState(null);
  const [refreshNonce, setRefreshNonce] = useState(0);
  const lastKeyRef = useRef("");

  const openDetails = useCallback((row) => {
    setSelectedLog(row);
    setDetailsOpen(true);
  }, []);

  const closeDetails = useCallback(() => {
    setDetailsOpen(false);
    setSelectedLog(null);
  }, []);

  useEffect(() => {
    if (!entityId) {
      setRows([]);
      setErr("");
      setLoading(false);
      return;
    }

    const key = `${entityModel}:${entityId}`;
    if (lastKeyRef.current !== key) lastKeyRef.current = key;

    // Serve fresh cache
    const hit = ACTIVITY_CACHE.get(key);
    if (hit && Date.now() - hit.ts < ACTIVITY_TTL) {
      setRows(hit.data);
      setErr("");
      setLoading(false);
      return;
    }

    // In-flight dedupe
    if (ACTIVITY_INFLIGHT.has(key)) return;

    const ctrl = new AbortController();
    ACTIVITY_INFLIGHT.set(key, ctrl);
    let mounted = true;

    (async () => {
      setLoading(true);
      setErr("");
      try {
        const res = await api.get("/activitylogs", {
          params: { entityModel, entityId },
          skipAuthRefresh: true, // avoid interceptor retry loops
          signal: ctrl.signal,
        });

        const filtered =
          res.data?.data?.filter(
            (r) =>
              String(r?.summary).trim().toLowerCase() !==
              "issued access token via refresh token"
          ) ?? [];

        const normalized = filtered.map((r) => ({
          ...r,
          when: r.when || r.actionDate || r.createdAt || null,
        }));

        if (!mounted) return;
        setRows(normalized);
        ACTIVITY_CACHE.set(key, { ts: Date.now(), data: normalized });
      } catch (e) {
        if (e?.name !== "CanceledError") {
          const status = e?.response?.status;
          if (status === 403)
            setErr("You don’t have permission to view activity logs for this record.");
          else if (status === 401)
            setErr("Your session expired. Please sign in again.");
          else
            setErr(e?.response?.data?.message || "Failed to load logs.");
        }
      } finally {
        if (mounted) setLoading(false);
        ACTIVITY_INFLIGHT.delete(key);
      }
    })();

    return () => {
      mounted = false;
      const current = ACTIVITY_INFLIGHT.get(key);
      if (current) {
        current.abort();
        ACTIVITY_INFLIGHT.delete(key);
      }
    };
  }, [entityId, entityModel, refreshNonce]);

  const refreshLogs = useCallback(() => {
    if (entityId) ACTIVITY_CACHE.delete(`${entityModel}:${entityId}`);
    setRefreshNonce((value) => value + 1);
  }, [entityId, entityModel]);

  const columns = useMemo(
    () => [
      {
        field: "summary",
        headerName: "Summary",
        flex: 1.1,
        minWidth: 220,
        sortable: false,
        disableColumnMenu: true,
        renderCell: (params) => (
          <Typography variant="body2" sx={{ whiteSpace: "normal", lineHeight: 1.3 }}>
            {params.row.summary || "—"}
          </Typography>
        ),
      },
      {
        field: "actor",
        headerName: "Who did it",
        flex: 1,
        minWidth: 260,
        sortable: false,
        disableColumnMenu: true,
        renderCell: (params) => {
          const actor = params.row.actor || {};
          const live = actor.id && typeof actor.id === "object" ? actor.id : null;
          const label = actor.label || {};

          const name =
            live?.fullName ||
            label.fullName ||
            (actor.type !== "User" ? actor.type : "Unknown");
          const email = live?.email || label.email || "";
          const photo = live?.profile?.photo || null;

          const initials = (name || "")
            .split(/\s+/)
            .filter(Boolean)
            .slice(0, 2)
            .map((s) => s[0]?.toUpperCase())
            .join("");

          return (
            <Stack direction="row" spacing={1.25} alignItems="center" sx={{ minWidth: 0, width: "100%" }}>
              <Avatar sx={{ width: 28, height: 28 }} src={photo || undefined}>
                {!photo ? initials : null}
              </Avatar>
              <Stack spacing={0.25} sx={{ minWidth: 0, flex: 1, lineHeight: 1 }}>
                <Typography
                  variant="body2"
                  noWrap
                  sx={{ fontWeight: 500, lineHeight: 1.25, textOverflow: "ellipsis" }}
                  title={name}
                >
                  {name}
                </Typography>
                {!!email && (
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    noWrap
                    sx={{ lineHeight: 1.1, textOverflow: "ellipsis" }}
                    title={email}
                  >
                    ({email})
                  </Typography>
                )}
              </Stack>
            </Stack>
          );
        },
      },
      {
        field: "when",
        headerName: "When",
        flex: 0.7,
        minWidth: 160,
        disableColumnMenu: true,
        renderCell: (params) => {
          const iso = params.row?.when ?? params.row?.actionDate ?? params.row?.createdAt ?? null;
          if (!iso) return "—";
          const d = new Date(iso);
          if (Number.isNaN(d.getTime())) return "—";
          const absolute = new Intl.DateTimeFormat("en-US", {
            dateStyle: "medium",
            timeStyle: "short",
          }).format(d);
          return (
            <Tooltip title={absolute}>
              <span>{absolute}</span>
            </Tooltip>
          );
        },
        sortComparator: (_v1, _v2, p1, p2) => {
          const ts = (r) => {
            const iso = r?.when ?? r?.actionDate ?? r?.createdAt ?? null;
            const ms = iso ? new Date(iso).getTime() : 0;
            return Number.isNaN(ms) ? 0 : ms;
          };
          return ts(p1?.row) - ts(p2?.row);
        },
      },
      {
        field: "details",
        headerName: "",
        width: 64,
        sortable: false,
        align: "center",
        headerAlign: "center",
        disableColumnMenu: true,
        renderCell: (params) => {
          const row = params.row;
          const canView =
            row?.action === "update" &&
            Array.isArray(row?.changes) &&
            row.changes.length > 0;
          if (!canView) return null;

          return (
            <Tooltip title="View changes">
              <IconButton size="small" onClick={() => openDetails(row)}>
                <VisibilityIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          );
        },
      },
    ],
    [openDetails]
  );

  // Build dialog rows (leaf diffs only). Depends only on selectedLog now.
  const changeRows = useMemo(() => {
    if (!selectedLog) return [];
    const out = [];

    (selectedLog.changes || []).forEach((c) => {
      const base = c.path || "";

      const fromMap =
        isPlainObject(c.from) || Array.isArray(c.from)
          ? flattenToMap(c.from)
          : { "": c.from };

      const toMap =
        isPlainObject(c.to) || Array.isArray(c.to)
          ? flattenToMap(c.to)
          : { "": c.to };

      const keys = Array.from(new Set([...Object.keys(fromMap), ...Object.keys(toMap)]));

      keys.forEach((k, idx) => {
        const fromVal = Object.prototype.hasOwnProperty.call(fromMap, k)
          ? fromMap[k]
          : undefined;
        const toVal = Object.prototype.hasOwnProperty.call(toMap, k)
          ? toMap[k]
          : undefined;
        if (isDeepEqual(fromVal, toVal)) return;

        const fullPath = k ? (base ? `${base}.${k}` : k) : base;
        out.push({
          id: `${base}:${k}:${idx}:${out.length}`,
          path: fullPath,
          from: fromVal,
          to: toVal,
        });
      });
    });

    return out.map((r, i) => ({ ...r, idx: i + 1 }));
  }, [selectedLog]);

  const changeCols = useMemo(
    () => [
      { field: "idx", headerName: "#", width: 56, sortable: false },
      {
        field: "path",
        headerName: "Field",
        flex: 1,
        minWidth: 240,
        renderCell: (p) => (
          <Typography variant="body2" sx={{ fontFamily: "monospace" }} title={p.value}>
            {p.value}
          </Typography>
        ),
      },
      {
        field: "from",
        headerName: "From",
        flex: 1,
        minWidth: 240,
        sortable: false,
        renderCell: (p) => (
          <Typography
            variant="body2"
            fontWeight={700}
            sx={{ color: "error.main", whiteSpace: "normal", lineHeight: 1.25 }}
            title={String(p.row.from)}
          >
            {fmtDateMaybe(p.row.from)}
          </Typography>
        ),
      },
      {
        field: "to",
        headerName: "To",
        flex: 1,
        minWidth: 240,
        sortable: false,
        renderCell: (p) => (
          <Typography
            variant="body2"
            fontWeight={700}
            sx={{ color: "success.main", whiteSpace: "normal", lineHeight: 1.25 }}
            title={String(p.row.to)}
          >
            {fmtDateMaybe(p.row.to)}
          </Typography>
        ),
      },
    ],
    []
  );

  return (
    <Box sx={{ mt: 3 }}>
      <Stack direction="row" justifyContent="flex-end" sx={{ mb: 1 }}>
        <Button
          size="small"
          variant="outlined"
          startIcon={<RefreshIcon />}
          onClick={refreshLogs}
          disabled={loading}
        >
          Refresh Activity Log
        </Button>
      </Stack>
      {err && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {err}
        </Alert>
      )}

      <div style={{ width: "100%" }}>
        <DataGrid
          rows={rows}
          getRowId={(r) => r._id}
          columns={columns}
          loading={loading}
          autoHeight
          disableRowSelectionOnClick
          pageSizeOptions={[5, 10, 25, 50]}
          rowHeight={56}
          sx={{
            "& .MuiDataGrid-cell": {
              display: "flex",
              alignItems: "center",
              py: 0.5,
            },
          }}
          initialState={{
            pagination: { paginationModel: { pageSize: 10, page: 0 } },
            sorting: { sortModel: [{ field: "when", sort: "desc" }] },
          }}
        />

        <Dialog open={detailsOpen} onClose={closeDetails} maxWidth="md" fullWidth>
          <DialogTitle>Change details</DialogTitle>
          <DialogContent dividers>
            <Box sx={{ mt: 2, height: "min(60vh, 520px)", width: "100%" }}>
              <DataGrid
                rows={changeRows}
                columns={changeCols}
                density="compact"
                disableRowSelectionOnClick
                hideFooterSelectedRowCount
                pageSizeOptions={[10, 25, 50]}
                initialState={{
                  pagination: { paginationModel: { pageSize: 10, page: 0 } },
                  sorting: { sortModel: [{ field: "idx", sort: "asc" }] },
                }}
                sx={{
                  "& .MuiDataGrid-cell": { alignItems: "flex-start", py: 1 },
                  "& .MuiDataGrid-cellContent": {
                    whiteSpace: "normal",
                    lineHeight: 1.25,
                  },
                }}
              />
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={closeDetails}>Close</Button>
          </DialogActions>
        </Dialog>
      </div>

      {!loading && rows.length === 0 && (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
         {` No activity found for this ${entityModel.toLowerCase()} yet.`}
        </Typography>
      )}
    </Box>
  );
};

export default ActivityLogsTable;
