import mongoose from "mongoose";
import Stripe from "stripe";
import { AddressModel as Address, EventModel as Event, PaymentMethodModel as PaymentMethod, UserModel as User } from "../../models/index.js";
import { actorFromReq, pmLabel, shallowDiff } from "../../utils/index.js";
import { logger } from "../../utils/libs/logger.js";
import { resolveEventMainContact } from "../../utils/libs/eventMainContact.js";

let stripeFactory = (secret) => new Stripe(secret);
export const setPaymentMethodStripeFactoryForTests = (factory) => {
  stripeFactory = factory || ((secret) => new Stripe(secret));
};
const stripeClient = () =>
  String(process.env.STRIPE_ENABLED).toLowerCase() === "true" && process.env.STRIPE_SECRET_KEY
    ? stripeFactory(process.env.STRIPE_SECRET_KEY)
    : null;

export const normalizeNickname = (value) => String(value || "").trim();
export const canManagePaymentMethodOwner = (actor, ownerId) =>
  String(actor?.id || actor?._id) === String(ownerId) || ["admin", "employee"].includes(actor?.role);

const billingFields = ["address1", "city", "state", "zipcode", "country"];
export const normalizeBillingAddress = (value = {}) => ({
  address1: String(value.address1 || "").trim(),
  address2: String(value.address2 || "").trim(),
  city: String(value.city || "").trim(),
  county: String(value.county || "").trim(),
  state: String(value.state || "").trim(),
  zipcode: String(value.zipcode || "").trim(),
  country: String(value.country || "US").trim().toUpperCase(),
  placeId: String(value.placeId || "").trim(),
  formatted: String(value.formattedAddress || value.formatted || "").trim(),
  latitude:
    value.latitude === "" || value.latitude == null ? null : Number(value.latitude),
  longitude:
    value.longitude === "" || value.longitude == null ? null : Number(value.longitude),
});
const validateBillingAddress = (value) => {
  const address = normalizeBillingAddress(value);
  if (billingFields.some((field) => !address[field])) {
    const error = new Error("A complete billing address is required.");
    error.statusCode = 400;
    throw error;
  }
  return address;
};
const stripeAddress = (address) => ({
  line1: address.address1,
  line2: address.address2 || undefined,
  city: address.city,
  state: address.state,
  postal_code: address.zipcode,
  country: address.country,
});
const addressDocument = (owner, address) => ({
  owner,
  addressType: "billing",
  address1: address.address1,
  address2: address.address2,
  city: address.city,
  county: address.county,
  state: address.state,
  zipcode: address.zipcode,
  country: address.country,
  placeId: address.placeId,
  formatted: address.formatted,
  ...(Number.isFinite(address.latitude) && Number.isFinite(address.longitude)
    ? { location: { type: "Point", coordinates: [address.longitude, address.latitude] } }
    : {}),
});

const ownerForRequest = async (req) => {
  const ownerId = req.body?.ownerId || req.user?.id || req.user?._id;
  if (!ownerId || !canManagePaymentMethodOwner(req.user, ownerId)) {
    const error = new Error("Not allowed, cannot manage this user.");
    error.statusCode = 403;
    throw error;
  }
  const owner = await User.findById(ownerId).select("email fullName +stripeCustomerId role");
  if (!owner) {
    const error = new Error("User not found.");
    error.statusCode = 404;
    throw error;
  }
  return owner;
};

const ensureStripeCustomer = async (stripe, owner) => {
  if (owner.stripeCustomerId) return owner.stripeCustomerId;
  const customer = await stripe.customers.create({
    email: owner.email,
    name: owner.fullName,
    metadata: { userId: String(owner._id) },
  });
  const claimed = await User.findOneAndUpdate(
    { _id: owner._id, $or: [{ stripeCustomerId: null }, { stripeCustomerId: "" }, { stripeCustomerId: { $exists: false } }] },
    { $set: { stripeCustomerId: customer.id } },
    { new: true }
  ).select("+stripeCustomerId");
  if (claimed?.stripeCustomerId === customer.id) return customer.id;
  const winner = await User.findById(owner._id).select("+stripeCustomerId").lean();
  await stripe.customers.del(customer.id).catch(() => {});
  if (!winner?.stripeCustomerId) throw new Error("Unable to associate Stripe customer.");
  return winner.stripeCustomerId;
};

const nicknameConflict = (owner, nickname, excludeId) =>
  PaymentMethod.exists({
    owner,
    nicknameKey: normalizeNickname(nickname).toLocaleLowerCase("en-US"),
    ...(excludeId ? { _id: { $ne: excludeId } } : {}),
  });
const populateMethod = (query) =>
  query.populate("billingAddress", "address1 address2 city county state zipcode country placeId formatted");

const runDefaultTransaction = async (owner, methodId) => {
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const target = await PaymentMethod.findOne({ _id: methodId, owner, status: "active" }).session(session);
      if (!target) {
        const error = new Error("Active payment method not found.");
        error.statusCode = 404;
        throw error;
      }
      await PaymentMethod.updateMany(
        { owner, isDefault: true, _id: { $ne: target._id } },
        { $set: { isDefault: false } },
        { session }
      );
      target.isDefault = true;
      await target.save({ session });
    });
  } finally {
    await session.endSession();
  }
};
const syncStripeDefault = (stripe, method) =>
  method.customerId
    ? stripe.customers.update(method.customerId, { invoice_settings: { default_payment_method: method.externalId } })
    : Promise.resolve();

const paymentMethodCtrl = {
  viewPaymentMethodsForEventContact: async (req, res) => {
    if (!["admin", "employee"].includes(req.user?.role)) {
      return res.status(403).json({ message: "Not allowed" });
    }
    const event = await Event.findById(req.params.eventId)
      .select("contact.userId contact.email")
      .lean();
    if (!event) return res.status(404).json({ message: "Event not found" });
    const owner = await resolveEventMainContact(event);
    if (!owner) return res.json({ data: [], contactHasAccount: false });
    const docs = await populateMethod(
      PaymentMethod.find({ owner: owner._id, status: "active" }).sort({ isDefault: -1, createdAt: 1 })
    ).lean();
    return res.json({ data: docs, contactHasAccount: true, ownerId: owner._id });
  },
  createSetupIntent: async (req, res) => {
    try {
      const stripe = stripeClient();
      if (!stripe) return res.status(503).json({ message: "Card storage is unavailable." });
      const owner = await ownerForRequest(req);
      const customerId = await ensureStripeCustomer(stripe, owner);
      const intent = await stripe.setupIntents.create({
        customer: customerId,
        payment_method_types: ["card"],
        usage: "off_session",
        metadata: { userId: String(owner._id), initiatedBy: String(req.user?.id || req.user?._id) },
      });
      return res.json({ clientSecret: intent.client_secret });
    } catch (error) {
      logger.error("stripe_setup_intent_failed", { error: error?.message, actorId: req.user?.id || req.user?._id });
      return res.status(error.statusCode || 502).json({
        message: error.statusCode && error.statusCode < 500 ? error.message : "Unable to initialize secure card entry.",
      });
    }
  },

  createPaymentMethod: async (req, res) => {
    let createdAddress;
    try {
      const stripe = stripeClient();
      if (!stripe) return res.status(503).json({ message: "Card storage is unavailable." });
      const owner = await ownerForRequest(req);
      const setupIntentId = String(req.body?.setupIntentId || "").trim();
      const nickname = normalizeNickname(req.body?.nickname);
      const billingName = String(req.body?.billingName || "").trim();
      const billingAddress = validateBillingAddress(req.body?.billingAddress);
      if (!setupIntentId) return res.status(400).json({ message: "A completed Stripe SetupIntent is required." });
      if (!nickname) return res.status(400).json({ message: "Nickname is required." });
      if (!billingName) return res.status(400).json({ message: "Cardholder name is required." });
      if (await nicknameConflict(owner._id, nickname)) {
        return res.status(409).json({ code: "NICKNAME_TAKEN", message: "Nickname already in use for this owner." });
      }
      const intent = await stripe.setupIntents.retrieve(setupIntentId, { expand: ["payment_method"] });
      const stripeMethod = intent.payment_method;
      if (
        intent.status !== "succeeded" || String(intent.metadata?.userId) !== String(owner._id) ||
        String(intent.customer) !== String(owner.stripeCustomerId) || !stripeMethod?.id || stripeMethod.type !== "card"
      ) return res.status(400).json({ message: "Card verification was not completed." });

      await stripe.paymentMethods.update(stripeMethod.id, {
        billing_details: { name: billingName, email: owner.email, address: stripeAddress(billingAddress) },
      });
      createdAddress = await Address.create(addressDocument(owner._id, billingAddress));
      const card = stripeMethod.card || {};
      const doc = await PaymentMethod.create({
        owner: owner._id, provider: "stripe", type: "card", externalId: stripeMethod.id,
        customerId: intent.customer, fingerprint: card.fingerprint, brand: card.brand, last4: card.last4,
        expMonth: card.exp_month, expYear: card.exp_year, nickname, billingName, billingEmail: owner.email,
        billingAddress: createdAddress._id, isDefault: false, status: "active",
      });
      const hasDefault = await PaymentMethod.exists({ owner: owner._id, isDefault: true });
      if (req.body?.setDefault === true || !hasDefault) {
        await runDefaultTransaction(owner._id, doc._id);
        await syncStripeDefault(stripe, doc);
      }
      req.logActivity?.({
        action: "create", target: { model: "PaymentMethod", id: doc._id, name: pmLabel(doc) },
        actor: actorFromReq(req), summary: `Added payment method ${pmLabel(doc)}`,
        nextSnapshot: { owner: owner._id, provider: doc.provider, type: doc.type, brand: doc.brand, last4: doc.last4, nickname: doc.nickname },
      });
      const fresh = await populateMethod(PaymentMethod.findById(doc._id)).lean();
      return res.status(201).json({ data: fresh });
    } catch (error) {
      if (createdAddress?._id) await Address.deleteOne({ _id: createdAddress._id }).catch(() => {});
      if (error.code === 11000) return res.status(409).json({ code: "NICKNAME_TAKEN", message: "Nickname already in use for this owner." });
      logger.error("payment_method_create_failed", { error: error?.message });
      return res.status(error.statusCode || 400).json({ message: error.statusCode ? error.message : "Unable to save payment method." });
    }
  },

  viewMyPaymentMethods: async (req, res) => {
    const docs = await populateMethod(PaymentMethod.find({ owner: req.user.id, status: "active" }).sort({ isDefault: -1, createdAt: 1 })).lean();
    return res.json({ data: docs });
  },
  viewPaymentMethodsByUser: async (req, res) => {
    if (!canManagePaymentMethodOwner(req.user, req.params.userId)) return res.status(403).json({ message: "Not allowed" });
    const docs = await populateMethod(PaymentMethod.find({ owner: req.params.userId, status: "active" }).sort({ isDefault: -1, createdAt: 1 })).lean();
    return res.json({ data: docs });
  },

  updatePaymentMethod: async (req, res) => {
    try {
      const stripe = stripeClient();
      if (!stripe) return res.status(503).json({ message: "Card storage is unavailable." });
      const pm = await PaymentMethod.findById(req.params.id);
      if (!pm) return res.status(404).json({ message: "Not found" });
      if (!canManagePaymentMethodOwner(req.user, pm.owner)) return res.status(403).json({ message: "Not allowed" });
      const before = pm.toObject();
      const nickname = normalizeNickname(req.body?.nickname);
      const billingName = String(req.body?.billingName || "").trim();
      if (!nickname) return res.status(400).json({ message: "Nickname is required." });
      if (!billingName) return res.status(400).json({ message: "Cardholder name is required." });
      if (await nicknameConflict(pm.owner, nickname, pm._id)) return res.status(409).json({ code: "NICKNAME_TAKEN", message: "Nickname already in use for this owner." });
      const nextAddress = req.body.billingAddress ? validateBillingAddress(req.body.billingAddress) : null;
      await stripe.paymentMethods.update(pm.externalId, {
        billing_details: { name: billingName, email: pm.billingEmail, ...(nextAddress ? { address: stripeAddress(nextAddress) } : {}) },
      });
      pm.nickname = nickname;
      pm.billingName = billingName;
      if (nextAddress) {
        if (pm.billingAddress) {
          await Address.findOneAndUpdate({ _id: pm.billingAddress, owner: pm.owner }, { $set: addressDocument(pm.owner, nextAddress) }, { runValidators: true });
        } else {
          const address = await Address.create(addressDocument(pm.owner, nextAddress));
          pm.billingAddress = address._id;
        }
      }
      await pm.save();
      if (req.body.setDefault === true) {
        await runDefaultTransaction(pm.owner, pm._id);
        await syncStripeDefault(stripe, pm);
      }
      req.logActivity?.({
        action: "update", target: { model: "PaymentMethod", id: pm._id, name: pmLabel(pm) }, actor: actorFromReq(req),
        summary: `Updated payment method ${pmLabel(pm)}`,
        changes: shallowDiff(before, pm.toObject(), ["nickname", "billingName", "billingAddress", "isDefault"]),
      });
      const fresh = await populateMethod(PaymentMethod.findById(pm._id)).lean();
      return res.json({ data: fresh });
    } catch (error) {
      if (error.code === 11000) return res.status(409).json({ code: "NICKNAME_TAKEN", message: "Nickname already in use for this owner." });
      return res.status(error.statusCode || 400).json({ message: error.statusCode ? error.message : "Unable to update payment method." });
    }
  },

  deletePaymentMethod: async (req, res) => {
    try {
      const stripe = stripeClient();
      if (!stripe) return res.status(503).json({ message: "Card storage is unavailable." });
      const pm = await PaymentMethod.findById(req.params.id);
      if (!pm) return res.status(404).json({ message: "Not found" });
      if (!canManagePaymentMethodOwner(req.user, pm.owner)) return res.status(403).json({ message: "Not allowed" });
      await stripe.paymentMethods.detach(pm.externalId);
      const wasDefault = pm.isDefault;
      pm.status = "inactive";
      pm.isDefault = false;
      await pm.save();
      if (wasDefault) {
        const next = await PaymentMethod.findOne({ owner: pm.owner, status: "active" }).sort({ createdAt: 1 });
        if (next) {
          await runDefaultTransaction(pm.owner, next._id);
          await syncStripeDefault(stripe, next);
        } else if (pm.customerId) {
          await stripe.customers.update(pm.customerId, { invoice_settings: { default_payment_method: null } });
        }
      }
      req.logActivity?.({ action: "soft-delete", target: { model: "PaymentMethod", id: pm._id, name: pmLabel(pm) }, actor: actorFromReq(req), summary: `Removed payment method ${pmLabel(pm)}` });
      return res.json({ success: true });
    } catch (error) {
      logger.error("payment_method_delete_failed", { error: error?.message });
      return res.status(error.statusCode || 502).json({ message: error.statusCode ? error.message : "Unable to remove payment method." });
    }
  },

  setDefaultPaymentMethod: async (req, res) => {
    try {
      const stripe = stripeClient();
      if (!stripe) return res.status(503).json({ message: "Card storage is unavailable." });
      const pm = await PaymentMethod.findById(req.params.id);
      if (!pm) return res.status(404).json({ message: "Not found" });
      if (!canManagePaymentMethodOwner(req.user, pm.owner)) return res.status(403).json({ message: "Not allowed" });
      await runDefaultTransaction(pm.owner, pm._id);
      await syncStripeDefault(stripe, pm);
      const fresh = await populateMethod(PaymentMethod.findById(pm._id)).lean();
      return res.json({ data: fresh });
    } catch (error) {
      logger.error("payment_method_default_failed", { error: error?.message });
      return res.status(error.statusCode || 502).json({ message: error.statusCode ? error.message : "Unable to set default payment method." });
    }
  },
};

export default paymentMethodCtrl;
