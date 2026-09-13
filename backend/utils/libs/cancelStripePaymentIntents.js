import Stripe from "stripe";

export const cancelStripePaymentIntents = async (intentIds = []) => {
  if (
    String(process.env.STRIPE_ENABLED).toLowerCase() !== "true" ||
    !process.env.STRIPE_SECRET_KEY
  ) {
    return;
  }
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  await Promise.all(
    [...new Set(intentIds.filter(Boolean))].map(async (intentId) => {
      try {
        const intent = await stripe.paymentIntents.retrieve(intentId);
        if (["requires_payment_method", "requires_confirmation", "requires_action", "processing"].includes(intent.status)) {
          await stripe.paymentIntents.cancel(intentId);
        }
      } catch (error) {
        // A terminal or already-removed intent is safe. Provider outages are
        // surfaced so callers do not claim a stale link was invalidated.
        if (error?.code !== "resource_missing") throw error;
      }
    })
  );
};
