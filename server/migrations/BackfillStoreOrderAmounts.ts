import mongoose from "mongoose";
import StoreOrder from "../models/storeorder.js";
import StripeService from "../api/services/stripe-service.js";
// import dotenv from "dotenv";
// dotenv.config();

/**
 * Backfills `amountTotal`/`currency` (and `customerEmail` when missing) onto historical
 * StoreOrder documents from their Stripe checkout session.
 *
 * These fields are now persisted at order-processing time and mirrored into the "storeOrders"
 * Meilisearch index so the admin Store Management table never needs a live Stripe call. Orders
 * created before that change have no `amountTotal`, so this one-time pass fetches each missing
 * value from Stripe. Run once, then trigger a "storeOrders" re-sync from the ControlPanel
 * search-index page.
 *
 * Idempotent: it only touches documents still missing `amountTotal`, and skips any order whose
 * Stripe session can't be retrieved (logged, left for a later run).
 */

export async function runMigration() {
  try {
    if (!process.env.MONGOOSEURI) {
      throw new Error("MONGOOSEURI environment variable is not set.");
    }
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error("STRIPE_SECRET_KEY environment variable is not set.");
    }

    await mongoose.connect(process.env.MONGOOSEURI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    } as mongoose.ConnectOptions);
    console.log("Connected to MongoDB.");

    const stripeService = new StripeService();

    const orders = await StoreOrder.find({
      $or: [{ amountTotal: { $exists: false } }, { amountTotal: null }],
    }).lean();

    console.log(`Found ${orders.length} store order(s) missing amountTotal.`);

    let updated = 0;
    let skipped = 0;

    // Sequential to stay well within Stripe rate limits; historical volume is small.
    for (const order of orders) {
      try {
        const session = await stripeService.getExpandedCheckoutSession(order.id);
        if (!session) {
          console.warn(`No Stripe session for order ${order.id}; skipping.`);
          skipped += 1;
          continue;
        }

        const update: Record<string, unknown> = {};
        if (session.amount_total !== null && session.amount_total !== undefined) {
          update.amountTotal = session.amount_total;
        }
        if (session.currency) {
          update.currency = session.currency;
        }
        // Repair a missing customerEmail while we already hold the session.
        if (!order.customerEmail) {
          const email = session.customer_details?.email || session.customer_email;
          if (email) update.customerEmail = email;
        }

        if (Object.keys(update).length === 0) {
          skipped += 1;
          continue;
        }

        await StoreOrder.updateOne({ _id: order._id }, { $set: update });
        updated += 1;
      } catch (err) {
        console.warn(`Error backfilling order ${order.id}:`, err);
        skipped += 1;
      }
    }

    console.log(
      `Store order amount backfill complete. Updated: ${updated}, skipped: ${skipped}.`
    );
    console.log(
      'Next step: trigger a "storeOrders" re-sync from the ControlPanel search-index page.'
    );
  } catch (err) {
    console.error("Error during migration: ", err);
    throw err;
  } finally {
    await mongoose.disconnect();
  }
}

// Uncomment to run standalone (from server/): npx tsx migrations/BackfillStoreOrderAmounts.ts
// runMigration()
//   .then(() => process.exit(0))
//   .catch(() => process.exit(1));
