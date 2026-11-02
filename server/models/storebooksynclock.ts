import { model, Schema } from "mongoose";

/**
 * A per-book lease over the Stripe book sync, shared by every server instance.
 *
 * The price sequence for one book (list, create, archive) must not interleave with another run's,
 * or two snapshots of the page count can each archive the other's price and leave a variant with
 * nothing on sale. One document per book in flight; absent means unlocked.
 */
export interface StoreBookSyncLockInterface {
  /** The Commons bookID. */
  _id: string;
  /** Owner of the lease, so a superseded holder can't renew or release it. */
  leaseID: string;
  /** Renewed while the holder runs. A past value means the holder died and the lease is free. */
  lockedUntil: Date;
}

const StoreBookSyncLockSchema = new Schema<StoreBookSyncLockInterface>(
  {
    _id: { type: String, required: true },
    leaseID: { type: String, required: true },
    // TTL cleanup only. Acquisition checks `lockedUntil` itself, since the TTL monitor runs about
    // once a minute and an expired document can linger until it does.
    lockedUntil: { type: Date, required: true, expires: 0 },
  },
  { versionKey: false },
);

const StoreBookSyncLock = model<StoreBookSyncLockInterface>(
  "StoreBookSyncLock",
  StoreBookSyncLockSchema,
);

export default StoreBookSyncLock;
