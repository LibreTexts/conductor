import {
  one,
  text,
  type Maybe,
  type PageSecurity,
  type Scalar,
} from "@libretexts/cxone-expert-node";

/**
 * Any page record a restriction can be read off of. Both response shapes
 * {@link pageRestriction} handles are optional, so an SDK page type from either
 * endpoint satisfies this.
 */
export type RestrictablePage = {
  security?: Maybe<Partial<PageSecurity>>;
  restriction?: Maybe<Scalar>;
};

/**
 * A page's restriction name, read from whichever shape the response used.
 *
 * The endpoints disagree:
 *
 * - `GET /pages/{id}` nests it as
 *   `security["permissions.page"].restriction`, a scalar that carries an `@id`
 *   attribute and so arrives wrapped in `#text`.
 * - `GET /pages/{id}/find` puts a bare `restriction` string on each page and
 *   omits `security` entirely. The SDK types find pages as `PageBase & Tags`,
 *   which declares neither, hence the cast.
 *
 * Reading only the nested form rejects every page the bulk walk found — the
 * whole nightly sync, not just the webhook — because `security` isn't actually there.
 */
export function pageRestriction(page: RestrictablePage): string | undefined {
  const nested = one(one(page.security)?.["permissions.page"])?.restriction;
  if (nested) return text(nested);
  return text((page as { restriction?: Maybe<Scalar> }).restriction);
}

/**
 * CXOne restrictions whose pages are readable by an anonymous visitor, and so
 * belong on Commons.
 *
 * A restriction is the baseline operation set CXOne applies to a user holding no
 * explicit grant on the page, and `permissions.page.operations` provides detail
 * on what actions are permitted:
 *
 * - `Public` (id 1) — the full operation mask.
 * - `Semi-Public` (id 2) — `LOGIN,BROWSE,READ,SUBSCRIBE`.
 * - `Semi-Private` (id 4) — `LOGIN,READ,SUBSCRIBE`. It withholds `BROWSE`, not
 *   `READ`: the page is excluded from listings but serves to anyone with the
 *   URL. However, for our needs we treat it as ineligible for Commons sync and
 *   for public table-of-contents listings.
 * - `Private` (id 3) — `LOGIN` only. Anonymous requests 302 to the login page.
 *
 * The names are kept as the rule because `find` returns the name and no mask, and
 * one gate has to handle both response shapes; see {@link pageRestriction}.
 */
export const PUBLIC_RESTRICTIONS = new Set(["Public", "Semi-Public"]);
export const UNLISTED_RESTRICTIONS = new Set(["Private", "Semi-Private"]);

/**
 * True when a restriction name is one an anonymous visitor may see listed.
 *
 * Checked against the allow-list rather than the deny-list: these listings are
 * built by requests that run as the authenticated API user, who sees more than
 * an anonymous visitor, so an unrecognized restriction has to be treated as
 * non-public. Wrongly omitting a page is recoverable; wrongly listing a hidden
 * one is the failure being guarded against.
 *
 * @param restriction - A restriction name from {@link pageRestriction}.
 */
export function isPubliclyListable(restriction: string | undefined): boolean {
  return !!restriction && PUBLIC_RESTRICTIONS.has(restriction);
}
