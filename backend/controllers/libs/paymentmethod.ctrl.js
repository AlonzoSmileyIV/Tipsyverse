// controllers/paymentMethod.controller.js
import { PaymentMethodModel as PaymentMethod } from "../../models/index.js";
import { shallowDiff, pmLabel, actorFromReq } from "../../utils/index.js";

const canManageUser = (actor, userId) =>
  String(actor.id) === String(userId) ||
  ["admin", "employee"].includes(actor.role);

const paymentMethodCtrl = {
  // POST /payment-methods
  createPaymentMethod: async (req, res) => {
    try {
      const {
        ownerId,
        provider,
        type,
        externalId,
        customerId,
        fingerprint,
        brand,
        last4,
        expMonth,
        expYear,
        nickname,
        billingName,
        billingEmail,
        billingAddress,
        setDefault = false,
      } = req.body;

      const owner = ownerId || req.user.id; // ensure this is consistent with your auth (_id vs id)
        // console.log(req.user.id);
        // console.log(owner);
       // console.log('canManageUser(req.user, owner): ', canManageUser(req.user, owner));
      if (!canManageUser(req.user, owner)) {
        return res.status(403).json({ message: "Not allowed, cannot manage this user." });
      }
   
      // --- nickname handling ---
      const nick = (nickname || "").trim();

      // If client provided a nickname, enforce uniqueness (case-insensitive)
      if (nick) {
        const exists =
          (await PaymentMethod.exists({ owner, nickname: nick })
            // required when using the collation index:
            ?.collation?.({ locale: "en", strength: 2 })) || null;

        if (exists) {
          return res
            .status(409)
            .json({
              code: "NICKNAME_TAKEN",
              message: "Nickname already in use for this owner.",
            });
        }
      }

      // If no nickname given, auto-generate a unique one
      let finalNickname = nick;
      if (!finalNickname) {
        const count = await PaymentMethod.countDocuments({ owner });
        finalNickname = `Credit Card #${count + 1}`;
      }

      const doc = await PaymentMethod.create({
        owner,
        provider,
        type,
        externalId,
        customerId,
        fingerprint,
        brand,
        last4,
        expMonth,
        expYear,
        nickname: finalNickname,
        billingName,
        billingEmail,
        billingAddress,
        isDefault: false,
        status: "active",
      });

      // Default handling
      if (setDefault) {
        await PaymentMethod.updateMany(
          { owner },
          { $set: { isDefault: false } }
        );
        await PaymentMethod.findByIdAndUpdate(doc._id, { isDefault: true });
        doc.isDefault = true;
      } else {
        const hasDefault = await PaymentMethod.exists({
          owner,
          isDefault: true,
        });
        if (!hasDefault) {
          await PaymentMethod.findByIdAndUpdate(doc._id, { isDefault: true });
          doc.isDefault = true;
        }
      }

      req.logActivity?.({
        action: "create",
        target: { model: "PaymentMethod", id: doc._id, name: pmLabel(doc) },
        actor: actorFromReq(req),
        summary: `Added payment method ${pmLabel(doc)}`,
        changes: [
          { path: "provider", from: undefined, to: provider },
          { path: "type", from: undefined, to: type },
          { path: "brand", from: undefined, to: brand },
          { path: "last4", from: undefined, to: last4 },
          { path: "expMonth", from: undefined, to: expMonth },
          { path: "expYear", from: undefined, to: expYear },
          { path: "nickname", from: undefined, to: doc.nickname },
          { path: "isDefault", from: undefined, to: !!doc.isDefault },
        ],
        nextSnapshot: {
          owner,
          provider,
          type,
          brand,
          last4,
          expMonth,
          expYear,
          nickname: doc.nickname,
          isDefault: !!doc.isDefault,
          status: doc.status,
        },
        request: {
          ip: req.ip,
          userAgent: req.get?.("user-agent"),
          source: "web",
        },
      });

      return res.status(201).json({ data: doc });
    } catch (err) {
      // safety net for race conditions against the unique index
      if (
        err.code === 11000 &&
        (err.keyPattern?.nickname || err.keyPattern?.nicknameKey)
      ) {
        return res
          .status(409)
          .json({
            code: "NICKNAME_TAKEN",
            message: "Nickname already in use for this owner.",
          });
      }
      return res.status(400).json({ message: err.message });
    }
  },

  // GET /payment-methods (mine)
  viewMyPaymentMethods: async (req, res) => {
    const owner = req.user.id;
    const docs = await PaymentMethod.find({ owner, status: "active" })
      .sort({ isDefault: -1, createdAt: 1 })
      .lean();
    res.json({ data: docs });
  },

  // GET /payment-methods/:userId (staff)
  viewPaymentMethodsByUser: async (req, res) => {
    const owner = req.params.userId;
    if (!canManageUser(req.user, owner)) {
      return res.status(403).json({ message: "Not allowed" });
    }
    const docs = await PaymentMethod.find({ owner, status: "active" })
      .sort({ isDefault: -1, createdAt: 1 })
      .lean();
    res.json({ data: docs });
  },

  // PATCH /payment-methods/:id
  updatePaymentMethod: async (req, res) => {
    const id = req.params.id;
    const pm = await PaymentMethod.findById(id);
    if (!pm) return res.status(404).json({ message: "Not found" });
    if (!canManageUser(req.user, pm.owner)) {
      return res.status(403).json({ message: "Not allowed" });
    }

    const before = pm.toObject();
    const {
      nickname,
      billingName,
      billingEmail,
      billingAddress,
      setDefault,
      status, // "inactive" | "active"
    } = req.body;

    // If nickname provided and changed, enforce uniqueness (case-insensitive)
    if (typeof nickname === "string") {
      const nextNick = nickname.trim();
      if (
        nextNick &&
        nextNick.toLowerCase() !== (pm.nickname || "").toLowerCase()
      ) {
        const dupe = await PaymentMethod.findOne({
          owner: pm.owner,
          _id: { $ne: pm._id },
          nickname: nextNick,
        })
          // required when using the collation index:
          .collation({ locale: "en", strength: 2 })
          .lean();

        if (dupe) {
          return res
            .status(409)
            .json({
              code: "NICKNAME_TAKEN",
              message: "Nickname already in use for this owner.",
            });
        }

        pm.nickname = nextNick;
      }
    }

    if (typeof billingName === "string") pm.billingName = billingName;
    if (typeof billingEmail === "string") pm.billingEmail = billingEmail;
    if (billingAddress) pm.billingAddress = billingAddress;
    if (status === "inactive" || status === "active") pm.status = status;

    await pm.save();

    if (setDefault === true) {
      await PaymentMethod.updateMany(
        { owner: pm.owner },
        { $set: { isDefault: false } }
      );
      await PaymentMethod.findByIdAndUpdate(pm._id, { isDefault: true });
      pm.isDefault = true;
    }

    const after = pm.toObject();
    const changes = shallowDiff(before, after, [
      "nickname",
      "billingName",
      "billingEmail",
      "billingAddress",
      "status",
      "isDefault",
    ]);

    if (changes.length) {
      req.logActivity?.({
        action: "update",
        target: { model: "PaymentMethod", id: pm._id, name: pmLabel(pm) },
        actor: actorFromReq(req),
        summary:
          setDefault === true
            ? `Set default payment method to ${pmLabel(pm)}`
            : `Updated payment method ${pmLabel(pm)}`,
        changes,
        prevSnapshot: {
          nickname: before.nickname,
          status: before.status,
          isDefault: before.isDefault,
        },
        nextSnapshot: {
          nickname: after.nickname,
          status: after.status,
          isDefault: after.isDefault,
        },
        request: {
          ip: req.ip,
          userAgent: req.get?.("user-agent"),
          source: "web",
        },
      });
    }

    res.json({ data: pm });
  },

  // DELETE /payment-methods/:id
  deletePaymentMethod: async (req, res) => {
    const id = req.params.id;
    const hard = req.query.hard === "1";

    const pm = await PaymentMethod.findById(id);
    if (!pm) return res.status(404).json({ message: "Not found" });
    if (!canManageUser(req.user, pm.owner)) {
      return res.status(403).json({ message: "Not allowed" });
    }

    const before = pm.toObject();

    if (hard) {
      await pm.deleteOne();
    } else {
      pm.status = "inactive";
      pm.isDefault = false;
      await pm.save();
    }

    // promote a new default if needed
    if (!hard && before.isDefault) {
      const next = await PaymentMethod.findOne({
        owner: pm.owner,
        status: "active",
      }).sort({ createdAt: 1 });
      if (next)
        await PaymentMethod.findByIdAndUpdate(next._id, { isDefault: true });
    }

    // --- activity log (delete/soft-delete)
    req.logActivity?.({
      action: hard ? "delete" : "soft-delete",
      target: { model: "PaymentMethod", id, name: pmLabel(pm) },
      actor: actorFromReq(req),
      summary: hard
        ? `Deleted payment method ${pmLabel(pm)}`
        : `Deactivated payment method ${pmLabel(pm)}`,
      changes: hard
        ? []
        : shallowDiff(before, pm.toObject(), ["status", "isDefault"]),
      prevSnapshot: {
        status: before.status,
        isDefault: before.isDefault,
        nickname: before.nickname,
      },
      nextSnapshot: hard
        ? undefined
        : {
            status: "inactive",
            isDefault: false,
            nickname: pm.nickname,
          },
      request: {
        ip: req.ip,
        userAgent: req.get?.("user-agent"),
        source: "web",
      },
    });

    res.json({ success: true });
  },

  // POST /payment-methods/:id/set-default
  setDefaultPaymentMethod: async (req, res) => {
    const id = req.params.id;
    const pm = await PaymentMethod.findById(id);
    if (!pm) return res.status(404).json({ message: "Not found" });
    if (!canManageUser(req.user, pm.owner)) {
      return res.status(403).json({ message: "Not allowed" });
    }

    const before = pm.toObject();

    await PaymentMethod.updateMany(
      { owner: pm.owner },
      { $set: { isDefault: false } }
    );
    await PaymentMethod.findByIdAndUpdate(pm._id, { isDefault: true });
    const fresh = await PaymentMethod.findById(id).lean();

    // --- activity log (update)
    req.logActivity?.({
      action: "update",
      target: { model: "PaymentMethod", id: pm._id, name: pmLabel(fresh) },
      actor: actorFromReq(req),
      summary: `Set default payment method to ${pmLabel(fresh)}`,
      changes: shallowDiff(before, fresh, ["isDefault"]),
      prevSnapshot: { isDefault: before.isDefault },
      nextSnapshot: { isDefault: fresh.isDefault },
      request: {
        ip: req.ip,
        userAgent: req.get?.("user-agent"),
        source: "web",
      },
    });

    res.json({ data: fresh });
  },
};

export default paymentMethodCtrl;
