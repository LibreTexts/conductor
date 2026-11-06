import { formatInTimeZone, zonedTimeToUtc } from "date-fns-tz";

/**
 * Output formatting for the Studio API replacements (`api/studio-compat.ts`).
 *
 * ADAPT parses Studio's responses as Drupal rendered them, down to entity
 * escaping and date formats, so these reproduce Drupal's behaviour rather
 * than anything more natural. Sources: the `api_h5p`, `api_collections` and
 * `api_author_h5p` view configs in Studio, and responses captured from
 * production (`studio-live-fixtures/` in the migration workspace).
 */

/** Studio's public origin. Its URLs in these responses are a contract. */
export const STUDIO_ORIGIN = "https://studio.libretexts.org";

/**
 * The timezone Studio rendered site-time dates in. The config copy in
 * `studio_main` says America/Los_Angeles, but production's responses carry
 * `-0400` offsets in October (captured 2026-10-26), so production ran on US
 * Eastern. The responses are what ADAPT received, so they win.
 */
export const STUDIO_TIMEZONE = "America/New_York";

/**
 * Drupal's `Html::escape`: `htmlspecialchars` with `ENT_QUOTES`. Every plain
 * text field Studio rendered went through it, so `"` arrives as `&quot;` and
 * `'` as `&#039;`. ADAPT un-escapes `&quot;` itself when it reads `authors`.
 */
export function drupalEscape(value: string | undefined | null): string {
  if (!value) return "";
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/** Drupal's `basic_string` formatter: escaped, then PHP's `nl2br`. */
export function drupalBasicString(value: string | undefined | null): string {
  return drupalEscape(value).replace(/(\r\n|\n\r|\r|\n)/g, "<br />$1");
}

/** Multi-value labels, as Studio's views joined them. */
export function drupalLabels(values: string[] | undefined): string {
  return (values ?? []).map(drupalEscape).join(", ");
}

/** Drupal's "short" format (`m/d/Y - H:i`), in UTC: the `api/h5p` view. */
export function drupalShortUTC(date: Date | string | undefined): string {
  if (!date) return "";
  return formatInTimeZone(new Date(date), "UTC", "MM/dd/yyyy - HH:mm");
}

/**
 * Drupal's "medium" format (`D, m/d/Y - H:i`), in Studio's site timezone:
 * the `api/collections/{cid}` view.
 */
export function drupalMediumSite(date: Date | string | undefined): string {
  if (!date) return "";
  return formatInTimeZone(new Date(date), STUDIO_TIMEZONE, "EEE, MM/dd/yyyy - HH:mm");
}

/**
 * Drupal's `html_datetime` format (`Y-m-d\TH:i:sO`, offset without a colon),
 * in Studio's site timezone: the collection list's `date_created`.
 */
export function drupalHtmlDatetimeSite(date: Date | string | undefined): string {
  if (!date) return "";
  return formatInTimeZone(new Date(date), STUDIO_TIMEZONE, "yyyy-MM-dd'T'HH:mm:ssxx");
}

/**
 * The instant Studio's `changed >= YYYY-MM-DD` filter compared against:
 * Drupal parsed the date as midnight in the site timezone (US Eastern), not
 * UTC.
 */
export function studioDateFilterStart(day: string): Date {
  return zonedTimeToUtc(`${day}T00:00:00`, STUDIO_TIMEZONE);
}
