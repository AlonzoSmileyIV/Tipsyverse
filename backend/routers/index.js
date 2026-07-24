/* 
ROUTERS - Defines the application’s API endpoints and associates 
each route with the relevant controller function.

Contents:
-Route files for each feature or resource (e.g., userRoutes.js, recipeRoutes.js).
-Each route file maps HTTP methods (GET, POST, PUT, DELETE) to controller functions.
*/
import contactRouter from "./libs/contact.routers.js";
import userRouter from "./libs/user.routers.js";
import hierarchyRouter from "./libs/hierarchy.routers.js";
import departmentRouter from "./libs/department.routers.js";
import positionRouter from "./libs/position.routers.js";

import liquorRouter from "./libs/liquor.routers.js";
import mixerRouter from "./libs/mixer.routers.js";
import glassRouter from './libs/glass.routers.js';

//import uploadRouter from "./libs/upload.router.js";
import drinkRouter from './libs/drinks.routers.js';
import commentRouter from "./libs/comment.routers.js";
import notificationRouter from "./libs/notification.routers.js";
import activityLogRouter from "./libs/activitylog.routers.js";
import statRouter from "./libs/stat.routers.js";

import courseRouter from "./libs/course.router.js";
import courseProgressRouter from "./libs/courseprogress.routers.js";
import eventRouter from "./libs/event.routers.js";
import paymentMethodRouter from './libs/paymentmethod.routers.js';
import paymentRequestRouter from "./libs/paymentrequest.routers.js";
import paymentRouter from "./libs/payment.routers.js";
import payoutRouter from "./libs/payout.routers.js";
import bidRouter from "./libs/bid.routers.js";
import assignmentRouter from "./libs/assignment.routers.js";
import reviewRouter from "./libs/review.routers.js";
import incidentRouter from "./libs/incident.routers.js";
import supportTicketRouter from "./libs/supportticket.routers.js";
import attendanceRouter from "./libs/attendance.routers.js";
import rewardRouter from "./libs/reward.routers.js";
import promoCodeRouter from "./libs/promocode.routers.js";


export { contactRouter, 
    userRouter, 
    hierarchyRouter, 
    departmentRouter, 
    positionRouter, 
    liquorRouter, 
    mixerRouter, 
    glassRouter, 
    drinkRouter, 
    commentRouter, 
    notificationRouter, 
    activityLogRouter, 
    statRouter,
    courseRouter,
    courseProgressRouter,
    eventRouter,
    paymentMethodRouter, 
    paymentRequestRouter,
    paymentRouter,
    payoutRouter,
    bidRouter,
    assignmentRouter,
    reviewRouter,
    incidentRouter,
    supportTicketRouter,
    attendanceRouter,
    rewardRouter,
    promoCodeRouter
};
