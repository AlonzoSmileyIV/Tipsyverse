// 3. Create drinksSlice (features/drinks/drinksSlice.js)
import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import api from "../../services/api";

export const fetchAllDrinks = createAsyncThunk("drinks/fetchAll", async () => {
  const res = await api.get("/drinks"); // Assumes this returns all drinks
  return res.data;
});

export const fetchDrinkById = createAsyncThunk(
  "drinks/fetchDrinkById",
  async (id) => {
    const res = await api.get(`/drinks/id/${id}`);
    return res.data;
  }
);

export const fetchDrinkBySlug = createAsyncThunk(
  "drinks/fetchBySlug",
  async (slug) => {
    const res = await api.get(`/drinks/slug/${slug}`);
    return res.data;
  }
);

export const fetchTopTrending = createAsyncThunk(
  "drinks/fetchTopTrending",
  async () => {
    const res = await api.get("/drinks/top-trending");
    return res.data; // ✅ Return just the array
  }
);

export const fetchRecommendedDrinks = createAsyncThunk(
  "drinks/fetchRecommendedDrinks",
  async () => {
    const res = await api.get(`/drinks/recommended`);
    return res.data;
  }
);

export const fetchMostRecentDrinks = createAsyncThunk(
  "drinks/fetchMostRecentDrinks",
  async () => {
    const res = await api.get("/drinks/recent");
    return res.data; // ✅ Return just the array
  }
);

// features/drinks/drinkSlice.js
export const fetchDrinksByCategory = createAsyncThunk(
  "drinks/fetchByCategory",
  async ({ name, limit = 12 }) => {
    const res = await api.get("/drinks/by-category", {
      params: { name, limit },
    });
    // Return both the name (key) and the data so the reducer knows where to store it
    return { name, data: res.data?.data ?? [] };
  }
);

const drinksSlice = createSlice({
  name: "drinks",
  initialState: {
    allDrinks: [],
    currentDrink: null,
    topTrending: [],
    recommendedDrinks: [],
    mostRecentDrinks: [],
    categoryDrinks: {},

    status: "idle",
    error: null,
  },
  reducers: {},
  extraReducers: (builder) => {
    builder
      // ---- All Drinks ----
      .addCase(fetchAllDrinks.pending, (state) => {
        state.status = "loading";
      })
      .addCase(fetchAllDrinks.fulfilled, (state, action) => {
        state.status = "succeeded";
        state.allDrinks = action.payload;
      })
      .addCase(fetchAllDrinks.rejected, (state, action) => {
        state.status = "failed";
        state.error = action.error.message;
      })

      // ---- By ID ----
      .addCase(fetchDrinkById.pending, (state) => {
        state.status = "loading";
      })
      .addCase(fetchDrinkById.fulfilled, (state, action) => {
        state.status = "succeeded";
        state.currentDrink = action.payload;
      })
      .addCase(fetchDrinkById.rejected, (state, action) => {
        state.status = "failed";
        state.error = action.error.message;
      })

      // ---- By Slug For Current Drink ----
      .addCase(fetchDrinkBySlug.pending, (state) => {
        state.status = "loading";
      })
      .addCase(fetchDrinkBySlug.fulfilled, (state, action) => {
        state.status = "succeeded";
        state.currentDrink = action.payload;
      })
      .addCase(fetchDrinkBySlug.rejected, (state, action) => {
        state.status = "failed";
        state.error = action.error.message;
      })

      // ---- Top Trending ----
      .addCase(fetchTopTrending.pending, (state) => {
        state.status = "loading";
      })
      .addCase(fetchTopTrending.fulfilled, (state, action) => {
        state.status = "succeeded";
        state.topTrending = action.payload;
      })
      .addCase(fetchTopTrending.rejected, (state, action) => {
        state.status = "failed";
        state.error = action.error.message;
      })

      // ---- Recommended ----
      .addCase(fetchRecommendedDrinks.pending, (state) => {
        state.status = "loading";
      })
      .addCase(fetchRecommendedDrinks.fulfilled, (state, action) => {
        state.status = "succeeded";
        state.recommendedDrinks = action.payload;
      })
      .addCase(fetchRecommendedDrinks.rejected, (state, action) => {
        state.status = "failed";
        state.error = action.error.message;
      })

      // ---- Most Recent ----
      .addCase(fetchMostRecentDrinks.pending, (state) => {
        state.status = "loading";
      })
      .addCase(fetchMostRecentDrinks.fulfilled, (state, action) => {
        state.status = "succeeded";
        state.mostRecentDrinks = action.payload;
      })
      .addCase(fetchMostRecentDrinks.rejected, (state, action) => {
        state.status = "failed";
        state.error = action.error.message;
      });

    // ---- By Category (dynamic key) ----
    builder
      .addCase(fetchDrinksByCategory.pending, (state, action) => {
        const { name } = action.meta.arg;
        state.categoryDrinks[name] ??= {
          loading: false,
          data: [],
          error: null,
        };
        state.categoryDrinks[name].loading = true;
        state.categoryDrinks[name].error = null;
      })
      .addCase(fetchDrinksByCategory.fulfilled, (state, action) => {
        const { name, data } = action.payload;
        state.categoryDrinks[name] = {
          loading: false,
          data: data || [],
          error: null,
        };
      })
      .addCase(fetchDrinksByCategory.rejected, (state, action) => {
        const { name } = action.meta.arg;
        state.categoryDrinks[name] ??= {
          loading: false,
          data: [],
          error: null,
        };
        state.categoryDrinks[name].loading = false;
        state.categoryDrinks[name].error =
          action.error.message || `Failed to load ${name} drinks`;
      });
  },
});

export default drinksSlice.reducer;
