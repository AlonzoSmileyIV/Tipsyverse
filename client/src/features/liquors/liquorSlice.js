// 3. Create liquorsSlice (features/liquors/liquorsSlice.js)
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../services/api';

export const fetchAllLiquors = createAsyncThunk('liquors/fetchAll', async () => {
    const res = await api.get('/liquors'); // Assumes this returns all liquors
    return res.data;
  });

const liquorsSlice = createSlice({
  name: 'liquors',
  initialState: {
    allLiquors: [],
    top: [],
    status: 'idle',
    error: null,
  },
  reducers: {},
  extraReducers: (builder) => {
    builder
    .addCase(fetchAllLiquors.pending, (state) => {
      state.status = 'loading';
    })
    .addCase(fetchAllLiquors.fulfilled, (state, action) => {
      state.status = 'succeeded';
      state.allLiquors = action.payload;
    })
    .addCase(fetchAllLiquors.rejected, (state, action) => {
      state.status = 'failed';
      state.error = action.error.message;
    });
  },
});

export default liquorsSlice.reducer;