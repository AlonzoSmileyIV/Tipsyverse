// 2. Setup Redux store (store.js)
import { configureStore } from '@reduxjs/toolkit';
import userReducer from '../features/users/userSlice';
import courseReducer from '../features/courses/courseSlice';
import courseProgressReducer from '../features/courseProgresses/courseProgressSlice';
import eventReducer from '../features/events/eventSlice';
import bidReducer from '../features/bids/bidSlice';
import assignmentReducer from '../features/assignments/assignmentSlice';
import reviewReducer from '../features/reviews/reviewSlice';
import paymentMethodReducer from '../features/paymentMethods/paymentMethodsSlice';
import liquorReducer from "../features/liquors/liquorSlice";
import mixerReducer from "../features/mixers/mixerSlice";
import drinkReducer from "../features/drinks/drinkSlice";
import glassReducer from "../features/glasses/glassSlice";
import hierarchyReducer from '../features/hierarchies/hierarchySlice';
import departmentReducer from '../features/departments/departmentSlice';
import positionReducer from '../features/positions/positionSlice';
import commentReducer from '../features/comments/commentSlice';
import notificationReducer from '../features/notifications/notificationSlice';
import statsReducer from '../features/stats/statsSlice';
import uiReducer from '../features/ui/uiSlice';



export const store = configureStore({
  reducer: {
    assignments: assignmentReducer,
    bids: bidReducer,
    comments: commentReducer,
    courses: courseReducer,
    courseProgress: courseProgressReducer,
    departments: departmentReducer,
    drinks: drinkReducer,
    events: eventReducer,
    glasses: glassReducer,
    hierarchies: hierarchyReducer,
    liquors: liquorReducer,
    mixers: mixerReducer,
    notifications: notificationReducer,
    paymentMethods: paymentMethodReducer,
    positions: positionReducer,
    reviews: reviewReducer,
    stats: statsReducer,
    ui: uiReducer,
    users: userReducer
  },
});