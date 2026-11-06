import { model, Schema, Document } from "mongoose";

export const STUDIO_LEGACY_NODE_KINDS = ["activity", "collection"] as const;

export type StudioLegacyNodeKind = (typeof STUDIO_LEGACY_NODE_KINDS)[number];

/**
 * Normalises a Studio URL alias for storage and lookup: one leading slash, no
 * trailing slash, lowercase. The import and the resolver must agree on this.
 */
export function normalizeStudioAlias(alias: string): string {
  const trimmed = alias.trim().replace(/\/+$/, "");
  return (trimmed.startsWith("/") ? trimmed : `/${trimmed}`).toLowerCase();
}

export interface RawStudioLegacyNodeInterface {
  nid: number;
  orgID: string;
  kind: StudioLegacyNodeKind;
  h5pContentID?: number;
  aliases: string[];
}

export interface StudioLegacyNodeInterface
  extends RawStudioLegacyNodeInterface,
    Document {}

/**
 * One Studio H5P or collection node, and the URL aliases that pointed at it.
 *
 * Backs the legacy resolver that old `studio.libretexts.org` page URLs are
 * redirected to after cutover. Studio's URLs cannot be resolved from the
 * Activity records alone:
 *
 *   - Pathauto aliased H5P nodes as `/h5p/{content id}`, but an earlier,
 *     disabled pattern aliased them as `/h5p/{nid}`, aliases from it persist,
 *     and colliding aliases got a numeric suffix. The number in a `/h5p/` URL
 *     is not reliably a content id.
 *   - 674 content ids were shared by several nodes. The activity import keeps
 *     one canonical node per content id, so the other nids are on no Activity.
 *
 * Migration data only, written by `StudioImportLegacyPaths.ts`. Retire it when
 * old Studio links stop mattering.
 */
const StudioLegacyNodeSchema = new Schema<StudioLegacyNodeInterface>(
  {
    /**
     * Drupal node id.
     */
    nid: {
      type: Number,
      required: true,
      unique: true,
    },
    orgID: {
      type: String,
      required: true,
    },
    kind: {
      type: String,
      enum: STUDIO_LEGACY_NODE_KINDS,
      required: true,
    },
    /**
     * Content id the node referenced, for `activity` nodes. Resolves to the
     * canonical Activity even when this nid was a collapsed duplicate.
     */
    h5pContentID: Number,
    /**
     * Every alias that pointed at the node, lowercased with a leading slash,
     * e.g. `/h5p/31483`. Lowercased because Drupal matched aliases
     * case-insensitively.
     */
    aliases: {
      type: [String],
      default: [],
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

const StudioLegacyNode = model<StudioLegacyNodeInterface>(
  "StudioLegacyNode",
  StudioLegacyNodeSchema
);

export default StudioLegacyNode;
