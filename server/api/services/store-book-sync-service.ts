import Stripe from "stripe";
import Book, { BookInterface } from "../../models/book.js";
import { debug, debugError } from "../../debug.js";
import { getLibraryAndPageFromBookID } from "../../util/bookutils.js";
import { mapWithConcurrency } from "../../util/concurrency.js";
import storeService from "./store-service.js";
import StripeService from "./stripe-service.js";

/**
 * Stripe store catalog for Commons books.
 *
 * Owns the shape of a book's Stripe product and its four print prices. Both
 * writers go through the builders here -- the full reconcile in
 * `syncAllBooksToStripe` and the incremental `syncBookToStripe` -- so the two can
 * never drift into writing different fields for the same book.
 *
 * Page counts come from `exportInfo.contentPageCount` on the Book, written by the
 * Shapeshift webhook. They used to come from the DownloadsCenter JSON manifests
 * (`api.libretexts.org/DownloadsCenter/{library}/Bookshelves.json`), which are
 * being retired; Mongo is now the only source.
 *
 * Keeping Stripe in sync is a nicety, never a critical path. `syncBookToStripe`
 * and `archiveBookInStripe` log every error and never throw, and MUST be called
 * fire-and-forget from any request path (Shapeshift webhook, book delete), so a
 * Stripe hiccup can never fail or delay a Book write. Not throwing is not the
 * same as hiding: both report what happened, so an operator invoking a sync
 * directly is never told a book came off sale when it did not.
 *
 * The safety net for a write that fails anyway is the nightly full run, which
 * re-syncs every eligible book and then archives Stripe products whose book is no
 * longer eligible. Upserts alone would never retire anything, so a book that lost
 * its page count or vanished from its library would otherwise stay purchasable
 * forever -- with a stale price attached to it.
 */

/** How many books may be in flight against Stripe at once during a full run. */
const STRIPE_SYNC_CONCURRENCY = 5;

/** Currency every book price is denominated in. */
const BOOK_PRICE_CURRENCY = "usd";

/** The Book fields a Stripe product is built from. */
type StripeSyncBook = Pick<
  BookInterface,
  | "bookID"
  | "title"
  | "author"
  | "affiliation"
  | "license"
  | "summary"
  | "thumbnail"
  | "syncMissingSince"
  | "exportInfo"
>;

/** The projection that reads exactly {@link StripeSyncBook} out of Mongo. */
const STRIPE_SYNC_BOOK_PROJECTION = {
  _id: 0,
  bookID: 1,
  title: 1,
  author: 1,
  affiliation: 1,
  license: 1,
  summary: 1,
  thumbnail: 1,
  syncMissingSince: 1,
  exportInfo: 1,
} as const;

/**
 * What a single-book Stripe sync did.
 *
 * `unchanged` means the product and all four prices already matched what we
 * would have written, so no Stripe write was issued at all.
 */
export type StripeBookSyncOutcome =
  | { status: "created" | "updated" | "unchanged" }
  | { status: "archived" | "skipped" | "error"; reason: string };

/**
 * Whether a book belongs in the Stripe store.
 *
 * A book that is missing from its library (`syncMissingSince`) cannot be printed,
 * and a book without a finite page count has no computable print cost -- selling
 * it would mean selling it at the wrong price.
 */
export const isStripeEligible = (
  book: Pick<BookInterface, "syncMissingSince" | "exportInfo">,
): boolean => {
  if (book.syncMissingSince) return false;
  return Number.isFinite(book.exportInfo?.contentPageCount);
};

/**
 * The Stripe product id for a book.
 *
 * Stripe's search index is eventually consistent (~1 minute), so resolving a
 * product by `metadata["book_id"]` cannot be trusted moments after a create --
 * two webhook deliveries seconds apart would each miss the other's product and
 * create a duplicate. A caller-supplied id makes resolution a strongly-consistent
 * `retrieve` instead. Products created before this scheme are still found by the
 * metadata search fallback in `resolveProduct`.
 */
export const buildStripeProductID = (bookID: string): string =>
  `book_${bookID.replace(/[^a-zA-Z0-9_-]/g, "_")}`;

/** True if a Stripe error is its "no such object" response. */
const isResourceMissing = (err: unknown): boolean =>
  err instanceof Stripe.errors.StripeInvalidRequestError &&
  err.code === "resource_missing";

/**
 * True if Stripe rejected a request because another request is still in flight
 * with the same idempotency key -- i.e. a concurrent sync got there first.
 */
const isIdempotencyKeyInUse = (err: unknown): boolean =>
  err instanceof Stripe.errors.StripeIdempotencyError ||
  (err instanceof Stripe.errors.StripeError &&
    err.code === "idempotency_key_in_use");

const stripeService = new StripeService();

/**
 * Finds a book's existing Stripe product, or null.
 *
 * Tries the deterministic id first, then falls back to the metadata search that
 * predates it. The fallback keeps legacy products in place rather than orphaning
 * them behind a new id -- a second product for the same book would be a second
 * listing in the store.
 */
const resolveProduct = async (
  stripe: Stripe,
  bookID: string,
): Promise<Stripe.Product | null> => {
  try {
    return await stripe.products.retrieve(buildStripeProductID(bookID));
  } catch (err) {
    if (!isResourceMissing(err)) throw err;
  }

  const found = await stripe.products.search({
    query: `metadata["book_id"]:"${bookID}"`,
    limit: 1,
  });
  return found.data[0] ?? null;
};

/** The product metadata a book maps to. */
const buildProductMetadata = (book: StripeSyncBook): Record<string, string> => ({
  book_id: book.bookID,
  store: "true",
  store_category: "books",
  book_author: book.author || "Anonymous",
  book_institution: book.affiliation || "",
  num_pages: String(book.exportInfo?.contentPageCount),
  license: book.license || "",
});

/** The product fields a book maps to, minus metadata. */
const buildProductFields = (book: StripeSyncBook) => {
  const [library, coverID] = getLibraryAndPageFromBookID(book.bookID);
  const thumbnail =
    book.thumbnail || storeService.getBookThumbnailUrl({ library, id: coverID });
  return {
    name: book.title,
    description: book.summary || "No description available",
    // A malformed bookID yields an empty URL from the link generators, and Stripe
    // rejects an empty string in `images` outright -- send no image instead.
    images: thumbnail ? [thumbnail] : [],
  };
};

/**
 * True if the stored product already carries everything we would write.
 *
 * Skipping an identical update is what keeps a nightly run over the whole catalog
 * cheap: an unchanged book costs two reads and no writes.
 */
const productMatches = (
  product: Stripe.Product,
  fields: ReturnType<typeof buildProductFields>,
  metadata: Record<string, string>,
): boolean => {
  if (!product.active) return false;
  if (product.name !== fields.name) return false;
  if ((product.description ?? "") !== fields.description) return false;
  if ((product.images?.[0] ?? "") !== (fields.images[0] ?? "")) return false;
  return Object.entries(metadata).every(
    ([key, value]) => (product.metadata?.[key] ?? "") === value,
  );
};

/**
 * Brings a product's four print prices in line with its page count.
 *
 * Enforces one active price per `hardcover`/`color` variant. That invariant is
 * what the storefront depends on: `findBookPrice` on the client resolves a
 * variant with a `.find()` over the active prices, so a second active price for
 * the same variant is a coin flip over which amount the customer is shown. The
 * dangerous shape is a *stale* duplicate -- reconciling only the first match
 * would leave the second sitting at the previous page count's amount -- so every
 * extra price in a variant group is archived here, whatever created it.
 *
 * Stripe prices are immutable in amount, so a price whose amount changed is
 * archived and replaced rather than edited. A price that already matches is left
 * untouched -- rewriting it every run would churn the price objects the store
 * links to for no gain.
 *
 * @returns Whether any write was issued.
 */
const reconcilePrices = async (
  stripe: Stripe,
  product: Stripe.Product,
  book: StripeSyncBook,
): Promise<boolean> => {
  const numPages = book.exportInfo?.contentPageCount as number;
  const priceOptions = storeService.calculateBookPrices({ num_pages: numPages });
  const existingPrices = await stripe.prices.list({
    product: product.id,
    active: true,
    limit: 100,
  });

  let wrote = false;

  for (const option of priceOptions.options) {
    const nickname = storeService.buildBookPriceNickname({
      hardcover: option.hardcover,
      color: option.color,
    });
    /* Every active price for this variant. A price already at the target amount
       is kept in preference to a newer one, so a duplicate pair never costs us
       the copy we would otherwise have to recreate. Past that, newest wins;
       concurrent syncs create duplicates within the same second, so `created`
       alone is not a stable ordering -- the id breaks the tie so a re-run and a
       second server reach the same conclusion about which copy survives. */
    const variantPrices = existingPrices.data
      .filter(
        (p) =>
          p.metadata["hardcover"] === String(option.hardcover) &&
          p.metadata["color"] === String(option.color),
      )
      .sort((a, b) => {
        const aCurrent =
          a.unit_amount === option.price && a.currency === BOOK_PRICE_CURRENCY;
        const bCurrent =
          b.unit_amount === option.price && b.currency === BOOK_PRICE_CURRENCY;
        if (aCurrent !== bCurrent) return aCurrent ? -1 : 1;
        return b.created - a.created || b.id.localeCompare(a.id);
      });

    const [existingPrice, ...duplicates] = variantPrices;

    for (const duplicate of duplicates) {
      await stripe.prices.update(duplicate.id, { active: false });
      wrote = true;
      debug(
        `[StoreBookSync] Archived duplicate price ${duplicate.id} for ${book.bookID} (hardcover=${option.hardcover}, color=${option.color}) -- more than one active price for this variant.`,
      );
    }

    if (existingPrice) {
      const amountMatches =
        existingPrice.unit_amount === option.price &&
        existingPrice.currency === BOOK_PRICE_CURRENCY;

      if (amountMatches) {
        // Same amount -- only correct the presentation fields if they drifted.
        const inSync =
          existingPrice.nickname === nickname &&
          existingPrice.tax_behavior === "exclusive" &&
          existingPrice.metadata["store"] === "true" &&
          existingPrice.metadata["store_category"] === "books" &&
          existingPrice.metadata["book_id"] === book.bookID;
        if (inSync) continue;

        await stripe.prices.update(existingPrice.id, {
          tax_behavior: "exclusive",
          nickname,
          metadata: {
            ...existingPrice.metadata,
            store: "true",
            store_category: "books",
            book_id: book.bookID,
          },
        });
        wrote = true;
        continue;
      }

      await stripe.prices.update(existingPrice.id, { active: false });
      wrote = true;
      debug(
        `[StoreBookSync] Archived price ${existingPrice.id} for ${book.bookID} (hardcover=${option.hardcover}, color=${option.color}) -- amount changed.`,
      );
    }

    try {
      const newPrice = await stripe.prices.create(
        {
          product: product.id,
          unit_amount: option.price,
          currency: BOOK_PRICE_CURRENCY,
          tax_behavior: "exclusive",
          nickname,
          metadata: {
            store: "true",
            store_category: "books",
            book_id: book.bookID,
            bookstore: "true",
            hardcover: String(option.hardcover),
            color: String(option.color),
          },
        },
        {
          /* Two runs that both found no price for this variant would otherwise
             each create one. The amount is part of the key on purpose: Stripe
             prices are immutable in `unit_amount`, so a repriced variant must be
             a genuinely new object rather than a replay of the old one. Every
             field that varies between requests is in the key -- Stripe raises an
             error, not a replay, when one key sees two different request bodies.
             Keys expire after 24h, far longer than any overlap between syncs. */
          idempotencyKey: `book-price:${product.id}:${numPages}:${option.hardcover}:${option.color}:${option.price}`,
        },
      );
      wrote = true;

      /* An idempotency key replays the *original response*, which may describe a
         price this sync has since archived -- a page count that went X -> Y -> X
         inside the key's 24h lifetime lands exactly here. Replaying it would
         leave the variant with no active price at all, and the next run would
         replay the same key again. Reactivating is safe: the amount is part of
         the key, so a replayed price is by definition already at the amount we
         want. */
      if (!newPrice.active) {
        await stripe.prices.update(newPrice.id, { active: true });
        debug(
          `[StoreBookSync] Reactivated replayed price ${newPrice.id} for ${book.bookID} (hardcover=${option.hardcover}, color=${option.color}).`,
        );
      }

      debug(
        `[StoreBookSync] Created price ${newPrice.id} for ${book.bookID} (hardcover=${option.hardcover}, color=${option.color}): ${option.formatted_price}`,
      );
    } catch (err) {
      /* A concurrent run holds the same key and is mid-create. Its price is the
         one that lands; ours would have been a duplicate. Nothing to repair here
         -- the next sync reconciles whatever the other run produced. */
      if (!isIdempotencyKeyInUse(err)) throw err;
      debug(
        `[StoreBookSync] Skipped creating a price for ${book.bookID} (hardcover=${option.hardcover}, color=${option.color}): a concurrent sync is already creating it.`,
      );
    }
  }

  return wrote;
};

/**
 * Writes one eligible book's product and prices to Stripe.
 *
 * Throws on Stripe failures -- callers that must not fail (the webhook, a book
 * delete) go through `syncBookToStripe`, which swallows.
 */
const writeBookToStripe = async (
  stripe: Stripe,
  book: StripeSyncBook,
): Promise<StripeBookSyncOutcome> => {
  const fields = buildProductFields(book);
  const metadata = buildProductMetadata(book);

  let product = await resolveProduct(stripe, book.bookID);
  let created = false;
  let wrote = false;

  if (!product) {
    try {
      product = await stripe.products.create({
        id: buildStripeProductID(book.bookID),
        ...fields,
        metadata,
      });
      created = true;
      wrote = true;
    } catch (err) {
      /* A concurrent run created it between our retrieve and our create. Stripe
         rejects the duplicate id, which is exactly the collision the
         deterministic id exists to make detectable. Any other rejection is a real
         failure and must not be swallowed into a confusing `resource_missing`. */
      if (
        !(err instanceof Stripe.errors.StripeInvalidRequestError) ||
        err.code !== "resource_already_exists"
      ) {
        throw err;
      }
      product = await stripe.products.retrieve(buildStripeProductID(book.bookID));
      wrote = true;
    }
  }

  if (!created && !productMatches(product, fields, metadata)) {
    product = await stripe.products.update(product.id, {
      ...fields,
      // Reactivates a product archived by an earlier run, for a book that has
      // become eligible again.
      active: true,
      metadata,
    });
    wrote = true;
  }

  const pricesWritten = await reconcilePrices(stripe, product, book);
  wrote = wrote || pricesWritten;

  if (created) return { status: "created" };
  return { status: wrote ? "updated" : "unchanged" };
};

/**
 * The result of an archival attempt.
 *
 * `archived: false` means there was nothing left to retire -- no product, or a
 * product already inactive with no active prices -- which is success, not a
 * no-op to be reported as a removal.
 */
export type StripeArchiveOutcome =
  | { ok: true; archived: boolean }
  | { ok: false; reason: string };

/**
 * Archives a book's Stripe product and every active price under it.
 *
 * Never throws -- the fire-and-forget callers (a book delete, the webhook path)
 * must not fail on a Stripe hiccup. It does *report*, though: a caller that
 * tells an operator the book was retired needs to know whether it actually was.
 *
 * The prices must be archived too, not just the product. The storefront lists
 * itself with `stripe.prices.search(... active:"true")` (see
 * `StoreService._fetchAllProducts`), so a product deactivated with live prices
 * under it stays visible and purchasable.
 *
 * Stripe cannot hard-delete a product that has prices or order history, so
 * archival is the only retirement available -- and it is reversible: a book that
 * becomes eligible again is reactivated by the next sync.
 */
export async function archiveBookInStripe(
  bookID: string,
): Promise<StripeArchiveOutcome> {
  try {
    if (!bookID) return { ok: true, archived: false };
    const stripe = stripeService.getInstance();

    const product = await resolveProduct(stripe, bookID);
    if (!product) return { ok: true, archived: false };

    const prices = await stripe.prices.list({
      product: product.id,
      active: true,
      limit: 100,
    });
    for (const price of prices.data) {
      await stripe.prices.update(price.id, { active: false });
    }

    if (product.active) {
      await stripe.products.update(product.id, { active: false });
    }

    if (prices.data.length === 0 && !product.active) {
      return { ok: true, archived: false };
    }

    debug(
      `[StoreBookSync] Archived ${bookID} (product ${product.id}, ${prices.data.length} price(s)).`,
    );
    storeService.invalidateProductCache();
    return { ok: true, archived: true };
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    debugError(`[StoreBookSync] Error archiving ${bookID} in Stripe: ${reason}`);
    return { ok: false, reason };
  }
}

/**
 * Syncs a single book to Stripe: creates, updates, or archives as its
 * eligibility dictates.
 *
 * Best-effort: never throws. This is the incremental counterpart to
 * `syncAllBooksToStripe` -- same eligibility rules, same product and price
 * builders, for one book instead of the whole catalog.
 */
export async function syncBookToStripe(
  bookID: string,
): Promise<StripeBookSyncOutcome> {
  try {
    if (!bookID) return { status: "skipped", reason: "No bookID provided." };

    const book = (await Book.findOne(
      { bookID: { $eq: bookID } },
      STRIPE_SYNC_BOOK_PROJECTION,
    ).lean()) as StripeSyncBook | null;

    if (!book) {
      // Gone from the DB -- make sure it isn't lingering in the store.
      const reason = "Book no longer exists in Commons.";
      const archival = await archiveBookInStripe(bookID);
      if (!archival.ok) {
        return {
          status: "error",
          reason: `${reason} Archiving it in Stripe failed: ${archival.reason}`,
        };
      }
      return { status: "archived", reason };
    }

    if (!isStripeEligible(book)) {
      const reason = book.syncMissingSince
        ? `${bookID} is marked missing from its library.`
        : `${bookID} has no finite exportInfo.contentPageCount (got ${JSON.stringify(book.exportInfo?.contentPageCount)}).`;
      debug(`[StoreBookSync] Not syncing: ${reason}`);
      const archival = await archiveBookInStripe(bookID);
      if (!archival.ok) {
        /* The book must come off sale and did not. Reporting `archived` here
           would tell an operator the opposite of what happened. */
        return {
          status: "error",
          reason: `${reason} Archiving it in Stripe failed: ${archival.reason}`,
        };
      }
      return { status: "archived", reason };
    }

    const stripe = stripeService.getInstance();
    const outcome = await writeBookToStripe(stripe, book);
    if (outcome.status !== "unchanged") {
      storeService.invalidateProductCache();
    }
    debug(`[StoreBookSync] ${outcome.status} ${bookID} in Stripe.`);
    return outcome;
  } catch (err) {
    debugError(`[StoreBookSync] Error syncing ${bookID} to Stripe: ${err}`);
    return {
      status: "error",
      reason: err instanceof Error ? err.message : String(err),
    };
  }
}

export type StripeCatalogSyncResult = {
  sync_count: number;
  archived_count: number;
  skipped_count: number;
  failed_count: number;
  /**
   * Books that should have come off sale but did not.
   *
   * Kept apart from `failed_count`, which means "pass 1 could not write" and is
   * what the archival pass's bail-out guard reads. Folding these in would blur a
   * safety check without changing it -- the guard has already run by the time
   * anything can land here.
   */
  archive_failed_count: number;
};

/**
 * Rebuilds the whole Stripe book catalog, in two passes.
 *
 * Pass 1 writes every eligible book. Pass 2 reconciles the other direction --
 * Stripe products whose book is no longer eligible are archived. Without pass 2
 * the sync would only ever add, and a book that lost its page count or vanished
 * from its library would remain on sale indefinitely.
 *
 * Pass 2 keys off the *eligible* set read from Mongo, not the set that synced
 * successfully: a transient Stripe failure on one book must not be read as "this
 * book should be retired."
 */
export async function syncAllBooksToStripe(): Promise<StripeCatalogSyncResult> {
  const result: StripeCatalogSyncResult = {
    sync_count: 0,
    archived_count: 0,
    skipped_count: 0,
    failed_count: 0,
    archive_failed_count: 0,
  };

  const stripe = stripeService.getInstance();

  const candidates = (await Book.find(
    {
      syncMissingSince: { $exists: false },
      "exportInfo.contentPageCount": { $exists: true },
    },
    STRIPE_SYNC_BOOK_PROJECTION,
  ).lean()) as unknown as StripeSyncBook[];

  /* `$exists` admits NaN and Infinity, which BSON stores as doubles -- the finite
     check has to happen in code. A book that fails it is logged rather than
     dropped silently: that log is the only evidence of a book quietly leaving the
     store. */
  const eligible: StripeSyncBook[] = [];
  for (const book of candidates) {
    if (isStripeEligible(book)) {
      eligible.push(book);
      continue;
    }
    result.skipped_count += 1;
    debug(
      `[StoreBookSync] Skipping ${book.bookID}: exportInfo.contentPageCount is not a finite number (got ${JSON.stringify(book.exportInfo?.contentPageCount)}).`,
    );
  }

  const eligibleIDs = new Set(eligible.map((b) => b.bookID));
  debug(
    `[StoreBookSync] Syncing ${eligible.length} eligible book(s) to Stripe (${result.skipped_count} skipped).`,
  );

  // Per-book failures are handled inside the callback -- mapWithConcurrency
  // rejects the whole call if `fn` rejects.
  await mapWithConcurrency(eligible, STRIPE_SYNC_CONCURRENCY, async (book) => {
    try {
      await writeBookToStripe(stripe, book);
      result.sync_count += 1;
    } catch (err) {
      result.failed_count += 1;
      debugError(
        `[StoreBookSync] Error syncing ${book.bookID} to Stripe: ${err}`,
      );
    }
  });

  /* Archiving is the destructive half of this run. If pass 1 wrote nothing, or
     failed more books than it synced, the likeliest explanation is a systemic
     fault (Stripe down, bad key, empty read) -- and archiving off the back of
     that would empty the store. */
  if (result.sync_count === 0 || result.failed_count > result.sync_count) {
    debugError(
      `[StoreBookSync] Skipping the archival pass: ${result.sync_count} synced, ${result.failed_count} failed. This looks like a systemic failure, not a catalog change.`,
    );
    storeService.invalidateProductCache();
    return result;
  }

  let page: string | undefined;
  do {
    const products: Stripe.ApiSearchResult<Stripe.Product> =
      await stripe.products.search({
        query: 'metadata["store_category"]:"books" AND active:"true"',
        limit: 100,
        ...(page ? { page } : {}),
      });

    for (const product of products.data) {
      const productBookID = product.metadata?.["book_id"];
      if (!productBookID) {
        // Not a retirement -- a book product with no book_id is malformed data,
        // and archiving it blind would hide the problem.
        debugError(
          `[StoreBookSync] Stripe product ${product.id} ("${product.name}") is in the books category but has no book_id metadata.`,
        );
        continue;
      }
      if (eligibleIDs.has(productBookID)) continue;

      const archival = await archiveBookInStripe(productBookID);
      if (!archival.ok) {
        result.archive_failed_count += 1;
        continue;
      }
      /* Nothing was active to retire -- the product was already archived by an
         earlier run and Stripe's search index simply had not caught up. Not a
         removal, so it is not counted as one. */
      if (archival.archived) result.archived_count += 1;
    }

    page = products.has_more ? products.next_page ?? undefined : undefined;
  } while (page);

  storeService.invalidateProductCache();
  debug(
    `[StoreBookSync] Full sync complete: ${result.sync_count} synced, ${result.archived_count} archived, ${result.skipped_count} skipped, ${result.failed_count} failed, ${result.archive_failed_count} archival failure(s).`,
  );

  return result;
}
