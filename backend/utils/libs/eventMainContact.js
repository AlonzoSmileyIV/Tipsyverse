import mongoose from "mongoose";
import { UserModel as User } from "../../models/index.js";

const escapeRegex = (value) =>
  String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const mainContactLookup = (event = {}) => {
  const contactUserId = event.contact?.userId?._id || event.contact?.userId;
  if (contactUserId) {
    return mongoose.isValidObjectId(contactUserId)
      ? { type: "userId", value: contactUserId }
      : null;
  }

  const email = String(event.contact?.email || "").trim().toLowerCase();
  return email ? { type: "email", value: email } : null;
};

export const resolveEventMainContact = async (
  event,
  { includeStripeCustomer = false } = {}
) => {
  const lookup = mainContactLookup(event);
  if (!lookup) return null;

  const selection = includeStripeCustomer
    ? "_id email fullName +stripeCustomerId"
    : "_id email fullName";
  if (lookup.type === "userId") {
    // A persisted contact association is authoritative. If it is stale, fail
    // closed instead of falling through to an unrelated organizer or email.
    return User.findById(lookup.value).select(selection).lean();
  }

  return User.findOne({
    email: new RegExp(`^${escapeRegex(lookup.value)}$`, "i"),
  })
    .select(selection)
    .lean();
};

export default resolveEventMainContact;

