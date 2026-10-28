import { Badge } from "@libretexts/davis-react";
import { IconCategory, IconLanguage, IconLicense, IconUser } from "@tabler/icons-react";
import type { Icon } from "@tabler/icons-react";
import { ActivityCardFields } from "../../types";
import { getActivityLicense } from "../../utils/activityHelpers";
import { getLanguageName } from "../../utils/languageCodes";

/** Tags beyond this many collapse into a "+N" count. */
const MAX_TAGS = 3;

/**
 * Author, subjects, license, language and tags for an activity card, with the
 * icons and labels of the public activity page. A field with no value is left
 * out, and with none at all nothing renders. The description is not included:
 * each card places it under its own title.
 */
const ActivityCardDetails = ({ activity, className }: { activity: ActivityCardFields; className?: string }) => {
  const authors = (activity.authors ?? []).filter((a) => a?.trim());
  const subjects = (activity.subjects ?? []).filter((s) => s?.trim());
  const tags = (activity.tags ?? []).filter((t) => t?.trim());
  const license = getActivityLicense(activity.license);
  const language = activity.language?.trim() ? getLanguageName(activity.language.trim()) : undefined;

  const rows: { key: string; label: string; icon: Icon; value: string }[] = [];
  if (authors.length) rows.push({ key: "author", label: authors.length > 1 ? "Authors" : "Author", icon: IconUser, value: authors.join(", ") });
  if (subjects.length) rows.push({ key: "subject", label: subjects.length > 1 ? "Subjects" : "Subject", icon: IconCategory, value: subjects.join(", ") });
  if (license) rows.push({ key: "license", label: "License", icon: IconLicense, value: license.text });
  if (language) rows.push({ key: "language", label: "Language", icon: IconLanguage, value: language });

  if (!rows.length && !tags.length) return null;
  const hiddenTags = tags.length - MAX_TAGS;
  return (
    <div className={["flex flex-col gap-2", className].filter(Boolean).join(" ")}>
      {rows.length > 0 && (
        <dl className="m-0 flex flex-col gap-1 text-sm text-neutral-700">
          {rows.map(({ key, label, icon: RowIcon, value }) => (
            <div key={key} className="flex min-w-0 items-start gap-2">
              <dt className="flex shrink-0 items-center pt-0.5">
                <RowIcon size={16} className="text-neutral-500" aria-hidden="true" />
                <span className="sr-only">{label}</span>
              </dt>
              <dd className="m-0 min-w-0 line-clamp-2 break-words">{value}</dd>
            </div>
          ))}
        </dl>
      )}
      {tags.length > 0 && (
        <ul className="m-0 flex list-none flex-wrap gap-1 p-0" aria-label="Tags">
          {tags.slice(0, MAX_TAGS).map((tag) => (
            <li key={tag}>
              <Badge label={tag} size="sm" />
            </li>
          ))}
          {hiddenTags > 0 && (
            <li>
              <Badge label={`+${hiddenTags}`} size="sm" />
              <span className="sr-only">{` more tag${hiddenTags === 1 ? "" : "s"}`}</span>
            </li>
          )}
        </ul>
      )}
    </div>
  );
};

export default ActivityCardDetails;
