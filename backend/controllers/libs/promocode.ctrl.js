import { CouponModel as Coupon } from "../../models/index.js";

const PROMO_FIELDS = [
  "code",
  "description",
  "discountType",
  "discountValue",
  "minimumSubtotal",
  "startsAt",
  "endsAt",
  "indefinite",
  "active",
  "maxRedemptions",
  "perUserLimit",
  "audience",
];

const normalizePromo = (body = {}) => {
  const patch = {};
  PROMO_FIELDS.forEach((field) => {
    if (body[field] !== undefined) patch[field] = body[field];
  });

  if (patch.code !== undefined) patch.code = String(patch.code).trim().toUpperCase();
  if (patch.discountType !== undefined || patch.discountValue !== undefined) {
    const discountType = patch.discountType || body.discountType;
    const discountValue = Number(patch.discountValue ?? body.discountValue);
    patch.discountValue = discountValue;
    patch.type = discountType === "fixed" ? "AMOUNT_TOTAL" : "PERCENT_TOTAL";
    patch.value = discountType === "fixed" ? discountValue : discountValue / 100;
  }
  if (patch.indefinite === true) patch.endsAt = null;
  for (const field of ["minimumSubtotal", "maxRedemptions", "perUserLimit"]) {
    if (patch[field] === "" || patch[field] === undefined) delete patch[field];
  }
  return patch;
};

const validatePromo = (patch, { partial = false } = {}) => {
  if (!partial && !patch.code) return "Promo code is required.";
  if (!partial && !patch.discountType) return "Discount type is required.";
  if (!partial && !(patch.discountValue > 0)) return "Discount value must be greater than zero.";
  if (patch.discountType === "percentage" && patch.discountValue > 100) {
    return "Percentage discount cannot exceed 100%.";
  }
  if (patch.startsAt && patch.endsAt && new Date(patch.endsAt) <= new Date(patch.startsAt)) {
    return "Promo end date must be after its start date.";
  }
  return null;
};

const promoCodeCtrl = {
  list: async (req, res) => {
    try {
      const promos = await Coupon.find().sort({ createdAt: -1 }).lean();
      return res.json({ success: true, data: promos });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  },

  create: async (req, res) => {
    try {
      const patch = normalizePromo(req.body);
      const validationError = validatePromo(patch);
      if (validationError) return res.status(400).json({ success: false, message: validationError });
      const promo = await Coupon.create(patch);
      return res.status(201).json({ success: true, data: promo, message: "Promo code created." });
    } catch (err) {
      const status = err?.code === 11000 ? 409 : 400;
      return res.status(status).json({
        success: false,
        message: err?.code === 11000 ? "That promo code already exists." : err.message,
      });
    }
  },

  update: async (req, res) => {
    try {
      const patch = normalizePromo(req.body);
      const validationError = validatePromo(patch, { partial: true });
      if (validationError) return res.status(400).json({ success: false, message: validationError });
      const promo = await Coupon.findByIdAndUpdate(req.params.id, patch, {
        new: true,
        runValidators: true,
      });
      if (!promo) return res.status(404).json({ success: false, message: "Promo code not found." });
      return res.json({ success: true, data: promo, message: "Promo code updated." });
    } catch (err) {
      const status = err?.code === 11000 ? 409 : 400;
      return res.status(status).json({ success: false, message: err?.code === 11000 ? "That promo code already exists." : err.message });
    }
  },

  remove: async (req, res) => {
    try {
      const promo = await Coupon.findByIdAndDelete(req.params.id);
      if (!promo) return res.status(404).json({ success: false, message: "Promo code not found." });
      return res.json({ success: true, message: "Promo code deleted." });
    } catch (err) {
      return res.status(400).json({ success: false, message: err.message });
    }
  },
};

export default promoCodeCtrl;
