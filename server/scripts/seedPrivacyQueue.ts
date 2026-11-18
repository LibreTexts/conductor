/**
 * seedPrivacyQueue.ts
 *
 * Creates (or updates) the "Privacy Inquiry" support queue. Idempotent: upserts by slug,
 * and keeps an existing queue's id and order.
 *
 * Usage (from server/):
 *   npx tsx scripts/seedPrivacyQueue.ts [PRIVACY_CONTACT_UUID]
 *
 * The optional UUID is the privacy contact; new privacy tickets auto-assign to them.
 */

import "dotenv/config";
import mongoose from "mongoose";
import { v4 } from "uuid";
import logger from "../logger.js";
import SupportQueue from "../models/supportqueue.js";
import { PRIVACY_QUEUE_SLUG } from "../util/privacyTickets.js";

async function run() {
  if (!process.env.MONGOOSEURI) {
    throw new Error("MONGOOSEURI environment variable is not set.");
  }
  const privacyContact = process.argv[2];

  await mongoose.connect(process.env.MONGOOSEURI);
  try {
    const last = await SupportQueue.findOne().sort({ order: -1 }).lean();

    const queue = await SupportQueue.findOneAndUpdate(
      { slug: PRIVACY_QUEUE_SLUG },
      {
        $set: {
          name: "Privacy Inquiry",
          ticket_descriptor: "Privacy Inquiry",
          description:
            "Requests about your personal data: access, correction, deletion, opt-outs, and appeals.",
          active: true,
          visible_to_users: true,
          has_categories: false,
          has_priorities: false,
          color: "bg-red-600",
          icon: "IconUserShield",
          ...(privacyContact && {
            auto_assign_enabled: true,
            auto_assign_uuids: [privacyContact],
          }),
        },
        $setOnInsert: {
          id: v4(),
          slug: PRIVACY_QUEUE_SLUG,
          order: (last?.order ?? 0) + 1,
        },
      },
      { upsert: true, new: true },
    );

    logger.info({ id: queue.id, slug: queue.slug }, "Privacy queue ready.");
  } finally {
    await mongoose.disconnect();
  }
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    logger.error({ err }, "seedPrivacyQueue failed");
    process.exit(1);
  });
