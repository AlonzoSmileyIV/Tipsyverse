// 3. Create mixersSlice (features/mixers/mixersSlice.js)
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../services/api';

export const fetchAllMixers = createAsyncThunk('mixers/fetchAll', async () => {
    const res = await api.get('/mixers'); // Assumes this returns all mixers
    return res.data;
  });

const mixersSlice = createSlice({
  name: 'mixers',
  initialState: {
    allMixers: [],
    top: [],
    status: 'idle',
    error: null,
  },
  reducers: {},
  extraReducers: (builder) => {
    builder
    .addCase(fetchAllMixers.pending, (state) => {
      state.status = 'loading';
    })
    .addCase(fetchAllMixers.fulfilled, (state, action) => {
      state.status = 'succeeded';
      state.allMixers = action.payload;
    })
    .addCase(fetchAllMixers.rejected, (state, action) => {
      state.status = 'failed';
      state.error = action.error.message;
    });
  },
});

export default mixersSlice.reducer;