import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Box,
  Grid,
  Typography,
  TextField,
  Checkbox,
  FormControlLabel,
  Button,
  Select,
  MenuItem,
  InputLabel,
  FormControl,
  OutlinedInput,
  Chip,
  ListItemText,
  Autocomplete,
  Pagination,
  Stack,
} from "@mui/material";
import { useDispatch, useSelector } from "react-redux";

import AuthLayout from "../../components/PublicLayout/PublicLayout";
import HelmetHeader from "../../components/HelmetHeader/Helmet";
import DrinkCard from "../../components/DrinkCard/DrinkCard";

import { fetchAllDrinks } from "../../features/drinks/drinkSlice";
import { fetchAllLiquors } from "../../features/liquors/liquorSlice";
import { fetchAllMixers } from "../../features/mixers/mixerSlice";
import { fetchAllGlasses } from "../../features/glasses/glassSlice";
import LoadingSkeleton from "../../components/LoadingSkeleton/LoadingSkeleton";

const colorOptions = [
  "Red",
  "Brown",
  "Green",
  "Blue",
  "Yellow",
  "Pink",
  "Purple",
  "Orange",
  "White",
  "Clear",
];

const tasteOptions = ["Fruity", "Sweet", "Sour", "Salty", "Bitter", "Umami"];

const categoryOptions = [
  "Classic",
  "Tipsyverse Originals",
  "Easy at Home",
  "Party",
  "Trouble",
];

// sort seasons by calendar order (Spring → Summer → Fall → Winter)
const seasonOrder = ["Spring", "Summer", "Fall", "Winter"];

// Figure out current month (0 = Jan, 11 = Dec)
const month = new Date().getMonth();

let currentSeason;
if (month >= 2 && month <= 4) {
  currentSeason = "Spring"; // Mar, Apr, May
} else if (month >= 5 && month <= 7) {
  currentSeason = "Summer"; // Jun, Jul, Aug
} else if (month >= 8 && month <= 10) {
  currentSeason = "Fall"; // Sep, Oct, Nov
} else {
  currentSeason = "Winter"; // Dec, Jan, Feb
}

// Rotate array so currentSeason is first
const startIdx = seasonOrder.indexOf(currentSeason);
const seasonOptionsSorted = [
  ...seasonOrder.slice(startIdx),
  ...seasonOrder.slice(0, startIdx),
];

// final categories list (dedup just in case)
const allCategoryOptions = Array.from(
  new Set([...categoryOptions, ...seasonOptionsSorted])
);

const ITEMS_PER_PAGE = 24;

// --- Seasonal Tags config (place above DrinksScreen) ---
const ALWAYS_TAGS = ["Wedding", "Game Night", "Brunch"];

const SEASONAL_TAGS = [
  // month is 0-indexed: Jan=0 ... Dec=11
  {
    name: "Memorial Day",
    isActive: (d) => d.getMonth() === 4 && d.getDate() >= 18,
  }, // last 2 weeks of May
  { name: "Juneteenth", isActive: (d) => d.getMonth() === 5 }, // all June
  {
    name: "Fourth of July",
    isActive: (d) => d.getMonth() === 6 && d.getDate() <= 7,
  }, // first 7 days of July
  { name: "Halloween", isActive: (d) => d.getMonth() === 9 }, // all October
  {
    name: "Thanksgiving",
    isActive: (d) => d.getMonth() === 10 && d.getDate() >= 17,
  }, // last 2 weeks of November
  { name: "Christmas", isActive: (d) => d.getMonth() === 11 }, // all December
  { name: "New Years", isActive: (d) => d.getMonth() === 0 }, // all January
  {
    name: "Valentine's Day",
    isActive: (d) => d.getMonth() === 1 && d.getDate() <= 14,
  }, // Feb 1–14
  { name: "St Patricks Day", isActive: (d) => d.getMonth() === 2 }, // all March
  { name: "Summer BBQ", isActive: (d) => [5, 6, 7].includes(d.getMonth()) }, // Jun–Aug
];

const useDebounced = (value, delay = 250) => {
  const [v, setV] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setV(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return v;
};
// replace your useTodayKey with this
const useTodayKey = () => {
  const getKey = () => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`; // e.g. "2025-09-03"
  };

  const [key, setKey] = useState(getKey());

  useEffect(() => {
    const now = new Date();
    const midnight = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() + 1,
      0,
      0,
      0,
      0
    );
    const timeout = midnight.getTime() - now.getTime();
    const id = setTimeout(() => setKey(getKey()), timeout);
    return () => clearTimeout(id);
  }, [key]); // re-arm after each midnight tick

  return key;
};

const DrinksScreen = () => {
  const dispatch = useDispatch();
  const { loggedInUser } = useSelector((state) => state.users);
  const allergies = useMemo(
    () => loggedInUser?.user?.preferences?.allergies || [],
    [loggedInUser]
  );

  const { allDrinks } = useSelector((state) => state.drinks);
  const { allLiquors } = useSelector((state) => state.liquors);
  const { allMixers } = useSelector((state) => state.mixers);
  const { allGlasses } = useSelector((state) => state.glasses);

  const allDrinksData = useMemo(() => allDrinks?.data || [], [allDrinks]);
  const liquorOptions = useMemo(() => allLiquors?.data || [], [allLiquors]);
  const mixerOptions = useMemo(() => allMixers?.data || [], [allMixers]);
  const glassOptions = useMemo(
    () => (allGlasses?.data || []).map((g) => g.name).sort(),
    [allGlasses]
  );

  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebounced(search, 250);
  const [selectedColors, setSelectedColors] = useState([]);
  const [selectedLiquors, setSelectedLiquors] = useState([]);
  const [selectedMixers, setSelectedMixers] = useState([]);
  const [selectedTastes, setSelectedTastes] = useState([]);
  const [selectedGlasses, setSelectedGlasses] = useState([]);
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [isAlcoholFree, setIsAlcoholFree] = useState(false);
  const [selectedTags, setSelectedTags] = useState([]);
  const [filteredDrinks, setFilteredDrinks] = useState([]);
  const [showContent, setShowContent] = useState(false);

  useEffect(() => {
    dispatch(fetchAllDrinks());
    dispatch(fetchAllLiquors());
    dispatch(fetchAllMixers());
    dispatch(fetchAllGlasses());
  }, [dispatch]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowContent(true);
    }, 1500); // 1.5 seconds

    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!isAlcoholFree) return;

    // Clear liquors once when toggled on
    if (selectedLiquors.length) setSelectedLiquors([]);

    // Strip alcoholic mixers once when toggled on
    setSelectedMixers((prev) =>
      prev.filter((m) => {
        const found = mixerOptions.find((x) => x.name === m);
        return found ? !found.isAlcoholic : true;
      })
    );
  }, [isAlcoholFree, mixerOptions, selectedLiquors.length]);

  const isLoading =
    allDrinks.loading ||
    allLiquors.loading ||
    allMixers.loading ||
    allGlasses.loading ||
    !showContent;

  const applyFilters = useCallback(() => {
    let filtered = allDrinksData;

    if (debouncedSearch.trim()) {
      const q = debouncedSearch.toLowerCase();
      filtered = filtered.filter((d) => d.name.toLowerCase().includes(q));
    }

    if (selectedColors.length > 0) {
      filtered = filtered.filter((drink) =>
        selectedColors.some((color) => drink.colors?.includes(color))
      );
    }

    if (selectedLiquors.length > 0) {
      filtered = filtered.filter((drink) =>
        selectedLiquors.some((liquor) =>
          drink.ingredients?.some(
            (ing) =>
              ing.name.toLowerCase().trim() === liquor.toLowerCase().trim()
          )
        )
      );
    }

    if (selectedMixers.length > 0) {
      filtered = filtered.filter((drink) =>
        selectedMixers.some((mixer) =>
          drink.ingredients?.some(
            (ing) =>
              ing.name.toLowerCase().trim() === mixer.toLowerCase().trim()
          )
        )
      );
    }

    if (selectedTastes.length > 0) {
      filtered = filtered.filter((drink) =>
        selectedTastes.some((taste) => drink.taste?.includes(taste))
      );
    }

    if (selectedGlasses.length > 0) {
      filtered = filtered.filter((drink) =>
        selectedGlasses.includes(drink.glass?.name)
      );
    }

    if (selectedCategories.length > 0) {
      filtered = filtered.filter((drink) =>
        selectedCategories.some((cat) => drink.categories?.includes(cat))
      );
    }

    if (selectedTags.length > 0) {
      filtered = filtered.filter((drink) =>
        selectedTags.some((t) => drink.tags?.includes(t))
      );
    }

    if (isAlcoholFree) {
      filtered = filtered.filter((d) => d.isAlcoholic === false);
    }

    setFilteredDrinks(filtered);
  }, [
    debouncedSearch,
    selectedColors,
    selectedLiquors,
    selectedMixers,
    selectedTastes,
    selectedGlasses,
    selectedCategories,
    selectedTags,
    isAlcoholFree,
    allDrinksData,
  ]);

  useEffect(() => {
    applyFilters();
  }, [applyFilters]);

  // 👇 Reset to first page whenever the filtered list changes
  useEffect(() => {
    setPage(1);
  }, [
    search,
    selectedColors,
    selectedLiquors,
    selectedMixers,
    selectedTastes,
    selectedGlasses,
    selectedCategories,
    selectedTags,
    isAlcoholFree,
    allDrinksData,
  ]);

  // 👇 Slice the filtered array for the current page
  const totalPages = Math.max(
    1,
    Math.ceil(filteredDrinks.length / ITEMS_PER_PAGE)
  );
  const pagedDrinks = useMemo(() => {
    const start = (page - 1) * ITEMS_PER_PAGE;
    return filteredDrinks.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredDrinks, page]);

  const resetFilters = () => {
    setSearch("");
    setSelectedColors([]);
    setSelectedLiquors([]);
    setSelectedMixers([]);
    setSelectedTastes([]);
    setSelectedGlasses([]);
    setSelectedCategories([]);
    setSelectedTags([]); // <—
    setIsAlcoholFree(false);
    setFilteredDrinks(allDrinksData);
    setPage(1);
  };

  // Filter options if noAlcohol is checked
  const filteredLiquorOptions = isAlcoholFree ? [] : liquorOptions;

  const filteredMixerOptions = isAlcoholFree
    ? mixerOptions.filter((item) => !item.isAlcoholic)
    : mixerOptions;

  const todayKey = useTodayKey();

  const filterTagOptions = useMemo(() => {
    // Use the key so the linter sees the dependency is needed
    const today = new Date(`${todayKey}T00:00:00`);
    const seasonal = SEASONAL_TAGS.filter((t) => t.isActive(today))
      .map((t) => t.name)
      .sort();
    return [...ALWAYS_TAGS, ...seasonal];
  }, [todayKey]);

  // A) Build once from the module constant
  const typeOptions = useMemo(
    () =>
      (allCategoryOptions || []).map((c) => ({
        kind: "Type",
        label: c,
        value: c,
      })),
    [] // ⬅️ no deps; it's static
  );

  // B) Recompute only when seasonal tags change
  const occasionOptions = useMemo(
    () =>
      (filterTagOptions || []).map((t) => ({
        kind: "Occasion",
        label: t,
        value: t,
      })),
    [filterTagOptions]
  );

  const themeOptions = useMemo(
    () => [...typeOptions, ...occasionOptions],
    [typeOptions, occasionOptions]
  );

  // Reflect current selection from your two states
  const selectedThemeOptions = useMemo(() => {
    const setCats = new Set(selectedCategories);
    const setTags = new Set(selectedTags);
    return themeOptions.filter(
      (o) =>
        (o.kind === "Type" && setCats.has(o.value)) ||
        (o.kind === "Occasion" && setTags.has(o.value))
    );
  }, [themeOptions, selectedCategories, selectedTags]);

  // Autocomplete MultiSelect for Liquors & Mixers
  const renderAutocomplete = (label, options, value, setValue) => (
    <Autocomplete
      multiple
      options={options}
      getOptionLabel={(option) => option}
      value={value}
      onChange={(event, newValue) => setValue(newValue)}
      renderInput={(params) => <TextField {...params} label={label} />}
      filterSelectedOptions
      sx={{ minWidth: 200 }}
    />
  );

  const renderMultiSelect = (
    label,
    options,
    selectedValues,
    setSelectedValues
  ) => (
    <FormControl fullWidth sx={{ minWidth: 200 }}>
      <InputLabel>{label}</InputLabel>
      <Select
        multiple
        value={selectedValues}
        onChange={(e) => setSelectedValues(e.target.value)}
        input={<OutlinedInput label={label} />}
        renderValue={(selected) => (
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
            {selected.map((value) => (
              <Chip key={value} label={value} />
            ))}
          </Box>
        )}
      >
        {options.map((option) => (
          <MenuItem key={option} value={option}>
            <Checkbox checked={selectedValues.includes(option)} />
            <ListItemText primary={option} />
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );

  return (
    <AuthLayout>
      <HelmetHeader
        title="Tipsyverse | Explore Drinks"
        description="Find trending cocktail recipes, share your creations, and sip your way through inspiration."
        keywords="cocktail recipes, trending drinks, mixology, tipsyverse, find cocktail recipes, recipe drinks"
      />
      {isLoading ? (
        <LoadingSkeleton />
      ) : (
        <Box sx={{ px: { xs: 2, md: 6 }, py: 4 }}>
          <Typography variant="h4" gutterBottom>
            Explore Drinks
          </Typography>

          {/* Filters */}
          <Box
            sx={{
              position: "sticky",
              top: 64, // ↴ match your header height
              zIndex: 10,
              py: 2,
              mb: 2,
              backgroundColor: "background.default",
              backdropFilter: "saturate(180%) blur(6px)",
              borderBottom: 1,
              borderColor: "divider",
            }}
          >
            <Grid container spacing={2} alignItems="center" sx={{ mb: 4 }}>
              <Grid item xs={12} sm={6} md={3}>
                <TextField
                  label="Search by Name"
                  variant="outlined"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  fullWidth
                />
              </Grid>

              {!isAlcoholFree && (
                <Grid item xs={12} sm={6} md={3}>
                  {renderAutocomplete(
                    "Liquors",
                    filteredLiquorOptions.map((l) => l.name),
                    selectedLiquors,
                    setSelectedLiquors
                  )}
                </Grid>
              )}

              <Grid item xs={12} sm={6} md={3}>
                {renderAutocomplete(
                  "Mixers",
                  filteredMixerOptions.map((m) => m.name).sort(),
                  selectedMixers,
                  setSelectedMixers
                )}
              </Grid>

              <Grid item xs={12} sm={6} md={3}>
                {renderAutocomplete(
                  "Glasses",
                  glassOptions, // e.g. ["Highball Glass","Martini Glass",...]
                  selectedGlasses,
                  setSelectedGlasses
                )}
              </Grid>

              <Grid item xs={12} sm={12} md={6}>
                <Autocomplete
                  multiple
                  options={themeOptions}
                  groupBy={(option) => option.kind} // shows "Type" & "Occasion" headers
                  getOptionLabel={(option) => option.label}
                  value={selectedThemeOptions}
                  onChange={(e, newVals) => {
                    const cats = newVals
                      .filter((o) => o.kind === "Type")
                      .map((o) => o.value);
                    const tags = newVals
                      .filter((o) => o.kind === "Occasion")
                      .map((o) => o.value);
                    setSelectedCategories(cats);
                    setSelectedTags(tags);
                  }}
                  isOptionEqualToValue={(a, b) =>
                    a.kind === b.kind && a.value === b.value
                  }
                  renderOption={(props, option, { selected }) => {
                    const { key, ...optionProps } = props; // ⬅️ pull key out
                    return (
                      <li key={key} {...optionProps}>
                        <Checkbox checked={selected} sx={{ mr: 1 }} />
                        <Typography variant="body2">{option.label}</Typography>
                      </li>
                    );
                  }}
                  renderInput={(params) => (
                    <TextField {...params} label="Theme (Type & Occasion)" />
                  )}
                  filterSelectedOptions
                  sx={{ minWidth: 280 }}
                />
              </Grid>

              <Grid item xs={12} sm={6} md={4}>
                {renderMultiSelect(
                  "Colors",
                  colorOptions,
                  selectedColors,
                  setSelectedColors
                )}
              </Grid>

              <Grid item xs={12} sm={6} md={4}>
                {renderMultiSelect(
                  "Taste",
                  tasteOptions,
                  selectedTastes,
                  setSelectedTastes
                )}
              </Grid>

              <Grid item xs={12} md={3}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={isAlcoholFree}
                      onChange={(e) => {
                        setIsAlcoholFree(e.target.checked);
                      }}
                    />
                  }
                  label="Mocktails"
                />
              </Grid>

              {(search ||
                selectedColors.length ||
                selectedLiquors.length ||
                selectedMixers.length ||
                selectedCategories.length ||
                selectedTastes.length ||
                selectedGlasses.length ||
                selectedTags.length ||
                isAlcoholFree) && (
                <Grid item xs={12} sm={6} md={2}>
                  <Button
                    fullWidth
                    variant="outlined"
                    sx={{
                      color: "var(--primary-color)",
                      borderColor: "var(--primary-color)",
                    }}
                    onClick={resetFilters}
                  >
                    Reset Filters
                  </Button>
                </Grid>
              )}
            </Grid>
          </Box>

          {/* Results header with count + range (nice UX touch) */}
          <Box sx={{ mb: 1.5 }}>
            <Typography variant="body2" color="text.secondary">
              Showing{" "}
              {filteredDrinks.length === 0
                ? 0
                : (page - 1) * ITEMS_PER_PAGE + 1}
              –{Math.min(page * ITEMS_PER_PAGE, filteredDrinks.length)} of{" "}
              {filteredDrinks.length} result
              {filteredDrinks.length === 1 ? "" : "s"}
            </Typography>
          </Box>

          <Grid container spacing={3} alignItems="stretch">
            {pagedDrinks.length > 0 ? (
              pagedDrinks.map((drink, index) => (
                <Grid
                  item
                  xs={12}
                  sm={6}
                  md={4}
                  lg={3}
                  key={index}
                  sx={{ display: "flex" }}
                >
                  <DrinkCard drink={drink} userAllergies={allergies} />
                </Grid>
              ))
            ) : (
              <Grid item xs={12}>
                <Typography variant="h6" color="textSecondary" align="center">
                  Sorry, no drinks were found.
                </Typography>
              </Grid>
            )}
          </Grid>

          {/* Pagination */}
          {filteredDrinks.length > ITEMS_PER_PAGE && (
            <Stack alignItems="center" sx={{ mt: 3 }}>
              <Pagination
                count={totalPages}
                page={page}
                onChange={(_, val) => {
                  setPage(val);
                  // optional: window.scrollTo({ top: 0, behavior: "smooth" });
                }}
                sx={{
                  "& .MuiPaginationItem-root": {
                    color: "var(--primary-color)",
                  },
                  "& .MuiPaginationItem-root.Mui-selected": {
                    bgcolor: "var(--primary-color)",
                    color: "#fff",
                  },
                  "& .MuiPaginationItem-root.Mui-selected:hover": {
                    bgcolor: "var(--primary-color)",
                  },
                }}
                shape="rounded"
              />
            </Stack>
          )}
        </Box>
      )}
    </AuthLayout>
  );
};

export default DrinksScreen;
