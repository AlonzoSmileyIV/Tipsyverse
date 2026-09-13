import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Box,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Autocomplete,
} from "@mui/material";
import {
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Dot,
} from "recharts";
import moment from "moment";
import { useDispatch, useSelector } from "react-redux";
import { fetchAllDrinks } from "../../features/drinks/drinkSlice";
import { loadSpreadsheet } from "../../utils/loadSpreadsheet";

const mockCocktailsData = [
  {
    _id: "1",
    name: "Tequila Sunrise",
    analytics: {
      userViews: [
        { dateViewed: "2025-05-20T12:00:00Z" },
        { dateViewed: "2025-05-21T14:00:00Z" },
      ],
      userLikes: [
        { dateLiked: "2025-05-20T12:10:00Z" },
        { dateLiked: "2025-05-22T09:00:00Z" },
      ],
      userComments: [{ dateCommented: "2025-05-21T18:30:00Z" }],
      userShares: [{ dateShared: "2025-05-23T16:00:00Z" }],
      userBookmarks: [{ dateBookmarked: "2025-05-24T10:00:00Z" }],
    },
  },
  {
    _id: "2",
    name: "Mojito",
    analytics: {
      userViews: [{ dateViewed: "2025-05-19T10:00:00Z" }],
      userLikes: [],
      userComments: [],
      userShares: [],
      userBookmarks: [],
    },
  },
];

const AdminDrinkAnalytics = ({ onActionsReady }) => {
  const dispatch = useDispatch();
  const [selectedDrink, setSelectedDrink] = useState("All");
  const [viewMode, setViewMode] = useState("day");
  const [startDate, setStartDate] = useState(
    moment().subtract(7, "days").format("YYYY-MM-DD")
  );
  const [endDate, setEndDate] = useState(moment().format("YYYY-MM-DD"));
  const [chartData, setChartData] = useState([]);

  const allDrinks = useSelector((state) => state.drinks?.allDrinks);

  const drinksData = useMemo(() => {
    if (allDrinks?.data?.length) {
      return allDrinks.data.map((d) => d.data ?? d); // Unwrap `.data` if present (from API)
    }
    return mockCocktailsData;
  }, [allDrinks]);

  const fetchAllData = useCallback(() => {
    Promise.all([dispatch(fetchAllDrinks())]);
  }, [dispatch]);

  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  useEffect(() => {
    if (viewMode === "hour" && startDate !== endDate) {
      setEndDate(startDate);
    }
  }, [viewMode, startDate, endDate]);

  const sortedDrinks = useMemo(() => {
    const list = [...drinksData];
    return list.sort((a, b) => a.name.localeCompare(b.name));
  }, [drinksData]);

  const isValidDateRange = moment(startDate).isSameOrBefore(endDate);

// Extract all dateCommented timestamps from top-level and nested replies
const getAllCommentDates = (userComments = []) => {
  const allDates = [];

  const collectDates = (comment) => {
    if (!comment) return;

    if (comment.createdAt) {
      allDates.push(comment.createdAt);
    }

    // Recursively collect replies
    if (Array.isArray(comment?.analytics?.userReplies)) {
      comment?.analytics?.userReplies.forEach((reply) => collectDates(reply));
    }
  };

  userComments.forEach((entry) => {
    collectDates(entry.comment);
  });

  return allDates;
};



  const handleExportToExcel = async () => {
    const XLSX = await loadSpreadsheet();
    const worksheet = XLSX.utils.json_to_sheet(chartData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Analytics");
    XLSX.writeFile(workbook, `${(selectedDrink === 'All' ? 'All Drinks' : selectedDrink) || "Analytics"} ${selectedDrink ? 'Analytics' : ''} Data.xlsx`);
  };

  useEffect(() => {
    onActionsReady?.({
      refresh: fetchAllData,
      download: handleExportToExcel,
      downloadLabel: "Download Excel",
    });
    return () => onActionsReady?.(null);
    // Re-register when export inputs change; avoid render-created handler identities.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onActionsReady, chartData, selectedDrink]);

  const renderLine = (key, color) => (
    <Line
      key={key}
      type="monotone"
      dataKey={key}
      stroke={color}
      strokeWidth={2}
      dot={{ r: 3 }}
      activeDot={(props) => {
        if (props.payload.date === "Predicted") {
          return (
            <Dot {...props} r={6} fill={color} stroke="black" strokeWidth={2} />
          );
        }
        return <Dot {...props} r={4} fill={color} />;
      }}
    />
  );

    useEffect(() => {
    if (!isValidDateRange) return;
    const drinksToAnalyze =
      selectedDrink === "All"
        ? drinksData
        : drinksData.filter((d) => d.name === selectedDrink);
    if (!drinksToAnalyze.length) return;

    const dateMap = {};
    const formatDate = (date) => {
      const m = moment(date);
      if (!m.isValid()) return "Invalid Date"; // safe fallback
      switch (viewMode) {
        case "hour":
          return m.format("YYYY-MM-DD HH:00");
        case "week":
          return m.startOf("isoWeek").format("YYYY-[W]WW");
        case "month":
          return m.format("YYYY-MM");
        case "year":
          return m.format("YYYY");
        default:
          return m.format("YYYY-MM-DD");
      }
    };

    drinksToAnalyze.forEach((drink) => {
      const filterByDate = (items, getDateFn) =>
  items.filter((item) => {
    const date = moment(getDateFn(item));
    return (
      date.isSameOrAfter(moment(startDate).startOf("day")) &&
      date.isSameOrBefore(moment(endDate).endOf("day"))
    );
  });

      const views = filterByDate(
        drink.analytics?.userViews || [],
        (item) => item?.dateViewed
      );
      const likes = filterByDate(
        drink.analytics?.userLikes || [],
        (item) => item?.dateLiked
      );
      const allCommentDates = getAllCommentDates(drink.analytics?.userComments || []);

      const comments = allCommentDates
  .map((date) => ({ dateCommented: date })) // renamed for consistency
  .filter((item) => {
    const date = moment(item.dateCommented);
    return (
      date.isSameOrAfter(moment(startDate).startOf("day")) &&
      date.isSameOrBefore(moment(endDate).endOf("day"))
    );
  });



      const shares = filterByDate(
        drink.analytics?.userShares || [],
        (item) => item?.dateShared
      );
      const bookmarks = filterByDate(
        drink.analytics?.userBookmarks || [],
        (item) => item?.dateBookmarked
      );

      [
        { data: views, key: "views", dateKey: "dateViewed" },
        { data: likes, key: "likes", dateKey: "dateLiked" },
        { data: comments, key: "comments", dateKey: "dateCommented" },
        { data: shares, key: "shares", dateKey: "dateShared" },
        { data: bookmarks, key: "bookmarks", dateKey: "dateBookmarked" },
      ].forEach(({ data, key, dateKey }) => {
        data.forEach((item) => {
          const label = formatDate(item[dateKey]);
          if (!dateMap[label])
            dateMap[label] = {
              date: label,
              views: 0,
              likes: 0,
              comments: 0,
              shares: 0,
              bookmarks: 0,
            };
          dateMap[label][key]++;
        });
      });
    });

    const aggregatedData = Object.values(dateMap).sort(
      (a, b) => new Date(a.date) - new Date(b.date)
    );

    const predictNext = (dataKey) => {
      const n = aggregatedData.length;
      if (n < 2) return 0;
      const x = Array.from({ length: n }, (_, i) => i + 1);
      const y = aggregatedData.map((item) => item[dataKey]);
      const xMean = x.reduce((a, b) => a + b) / n;
      const yMean = y.reduce((a, b) => a + b) / n;
      const numerator = x.reduce(
        (sum, xi, i) => sum + (xi - xMean) * (y[i] - yMean),
        0
      );
      const denominator = x.reduce((sum, xi) => sum + (xi - xMean) ** 2, 0);
      const slope = numerator / denominator;
      return Math.round(y[n - 1] + slope);
    };

    const prediction = {
      date: "Predicted",
      views: predictNext("views"),
      likes: predictNext("likes"),
      comments: predictNext("comments"),
      shares: predictNext("shares"),
      bookmarks: predictNext("bookmarks"),
    };

    setChartData([...aggregatedData, prediction]);
  }, [
    selectedDrink,
    startDate,
    endDate,
    viewMode,
    drinksData,
    isValidDateRange,
  ]);

  return (
    <Box sx={{ p: 3 }}>

      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2, mb: 3 }}>
        <FormControl sx={{ minWidth: 200 }}>
          <Autocomplete
            options={["All", ...sortedDrinks.map((d) => d.name)]}
            value={selectedDrink}
            onChange={(e, newValue) => setSelectedDrink(newValue || "All")}
            renderInput={(params) => (
              <TextField {...params} label="Select Drink" />
            )}
            sx={{ minWidth: 200 }}
            clearOnEscape
            isOptionEqualToValue={(option, value) => option === value}
          />
        </FormControl>

        <TextField
          label="Start Date"
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          InputLabelProps={{ shrink: true }}
          error={!isValidDateRange}
        />

        <TextField
          label="End Date"
          type="date"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          InputLabelProps={{ shrink: true }}
          error={!isValidDateRange}
        />

        <FormControl sx={{ minWidth: 150 }}>
          <InputLabel>View Mode</InputLabel>
          <Select
            value={viewMode}
            onChange={(e) => setViewMode(e.target.value)}
            label="View Mode"
          >
            {/* <MenuItem value="hour">Hour</MenuItem> */}
            <MenuItem value="day">Day</MenuItem>
            <MenuItem value="week">Week</MenuItem>
            <MenuItem value="month">Month</MenuItem>
            <MenuItem value="year">Year</MenuItem>
          </Select>
        </FormControl>

      </Box>

      <ResponsiveContainer width="100%" height={400}>
        <LineChart
          data={chartData}
          margin={{ top: 20, right: 30, left: 0, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            dataKey="date"
            tickFormatter={(str) => {
              if (str === "Predicted") return "Predicted";
              const m = moment(str);
              if (!m.isValid()) return str;
              if (viewMode === "hour") return m.format("HH:mm");
              if (viewMode === "day") return m.format("MM-DD");
              return str;
            }}
          />
          <YAxis allowDecimals={false} />
          <Tooltip />
          <Legend />
          {renderLine("views", "#8884d8")}
          {renderLine("likes", "#82ca9d")}
          {renderLine("comments", "#ffc658")}
          {renderLine("shares", "#ff7300")}
          {renderLine("bookmarks", "#0088FE")}
        </LineChart>
      </ResponsiveContainer>
    </Box>
  );
};

export default AdminDrinkAnalytics;
