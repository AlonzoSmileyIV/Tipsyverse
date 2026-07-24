/* 
MODELS - Defines the data structure for the MongoDB collections using Mongoose schemas.

Contents:
-Each model represents a database entity (e.g., User, Recipe, Post) with 
a schema defining its fields, types, and validation.
*/

import HierarchyModel from './libs/hierarchy.model.js';
import DepartmentModel from "./libs/department.model.js";
import PositionModel from './libs/position.model.js';

//import GroupModel from './libs/group.model.js';
//import PermissionModel from './libs/permission.model.js';

import UserModel from './libs/user.model.js';

import NotificationModel from './libs/notification.model.js';

import LiquorModel from "./libs/liquor.model.js";
import MixerModel from "./libs/mixer.model.js";
import GlassModel from "./libs/glass.model.js";
import DrinkModel from "./libs/drink.model.js";
import DrinkLikeModel from "./libs/drinklike.model.js";
import DrinkSaveModel from "./libs/drinksave.model.js";
import CommentModel from './libs/comment.model.js';

import EventModel from './libs/event.model.js';
import PaymentModel from './libs/payment.model.js';
import PaymentRequestModel from './libs/paymentrequest.model.js';
import BidModel from './libs/bid.model.js';
import AssignmentModel from './libs/assignment.model.js';
import PaymentMethodModel from './libs/paymentmethod.model.js';
import ReviewModel from './libs/review.model.js';
import PayoutModel from './libs/payout.model.js';
import IncidentModel from "./libs/incident.model.js";
import SupportTicketModel from "./libs/supportticket.model.js";
import AttendanceModel from "./libs/attendance.model.js";
import RewardClaimModel from "./libs/rewardclaim.model.js";
import CouponModel from "./libs/coupon.model.js";


import {CourseModel} from './libs/course.model.js';
import CourseProgressModel from './libs/courseprogress.model.js';

//import NotesModel from './libs/note.model.js';
import ActivityLogModel from './libs/activitylog.model.js';


export {
    HierarchyModel,
    DepartmentModel,
    PositionModel,
    UserModel,

    LiquorModel,
    MixerModel,
    GlassModel,
    DrinkModel,
    DrinkLikeModel,
    DrinkSaveModel,
    CommentModel,

    CourseModel,
    CourseProgressModel,

    EventModel,
    PaymentModel,
    PaymentRequestModel,
    BidModel,
    AssignmentModel,
    PaymentMethodModel,
    ReviewModel,
    PayoutModel,
    IncidentModel,
    SupportTicketModel,
    AttendanceModel,
    RewardClaimModel,
    CouponModel,
    
    NotificationModel,
    ActivityLogModel
};
