/* 
CONTROLLERS - 
Contains functions that handle the logic for each endpoint in the app, 
usually organized by feature or resource (e.g., users, posts, recipes).

Contents:
-Each file typically contains CRUD functions (Create, Read, Update, Delete) 
related to specific features (e.g., userController.js for user-related logic).
*/
import hierarchyCtrl from "./libs/hierarchy.ctrl.js";
import departmentCtrl from "./libs/department.ctrl.js";
import positionCtrl from "./libs/position.ctrl.js";

import mixerCtrl from "./libs/mixer.ctrl.js";
import glassCtrl from "./libs/glass.ctrl.js";
import liquorCtrl from "./libs/liquor.ctrl.js";
import drinkCtrl from "./libs/drink.ctrl.js";

import userCtrl from "./libs/user.ctrl.js";

import contactCtrl from "./libs/contact.ctrl.js";
import commentCtrl from "./libs/comment.ctrl.js";
import notificationCtrl from "./libs/notifications.ctrl.js";
import activityLogCtrl from "./libs/activitylog.ctrl.js";

import statCtrl from "./libs/stat.ctrl.js";

import courseCtrl from "./libs/course.ctrl.js";
import courseProgressCtrl from "./libs/courseprogress.ctrl.js";

import eventCtrl from "./libs/event.ctrl.js";
import paymentMethodCtrl from "./libs/paymentmethod.ctrl.js";
import paymentRequestCtrl from "./libs/paymentrequest.ctrl.js";
import paymentCtrl from "./libs/payment.ctrl.js";
import payoutCtrl from "./libs/payout.ctrl.js";
import bidCtrl from "./libs/bid.ctrl.js";
import assignmentCtrl from "./libs/assignment.ctrl.js";
import reviewCtrl from "./libs/review.ctrl.js";
import incidentCtrl from "./libs/incident.ctrl.js";
import supportTicketCtrl from "./libs/supportticket.ctrl.js";
import attendanceCtrl from "./libs/attendance.ctrl.js";
import rewardCtrl from "./libs/reward.ctrl.js";
import promoCodeCtrl from "./libs/promocode.ctrl.js";


export {
    hierarchyCtrl,
    departmentCtrl,
    positionCtrl,

    mixerCtrl,
    glassCtrl,
    liquorCtrl,
    drinkCtrl,

    userCtrl,

    contactCtrl,
    commentCtrl,
    notificationCtrl,
    activityLogCtrl,

    statCtrl,

    courseCtrl,
    courseProgressCtrl,

    eventCtrl,
    paymentMethodCtrl,
    paymentRequestCtrl,
    paymentCtrl,
    payoutCtrl,
    bidCtrl,
    assignmentCtrl,
    reviewCtrl,
    incidentCtrl,
    supportTicketCtrl,
    attendanceCtrl,
    rewardCtrl,
    promoCodeCtrl
};
