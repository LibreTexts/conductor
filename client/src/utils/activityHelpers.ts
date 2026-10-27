import {
  Icon,
  IconBook,
  IconBox,
  IconCards,
  IconCircleCheck,
  IconClipboardList,
  IconColumns,
  IconDragDrop,
  IconDragDrop2,
  IconForms,
  IconHighlight,
  IconLayoutList,
  IconListCheck,
  IconListDetails,
  IconMapPin,
  IconMathSymbols,
  IconMicrophone,
  IconPhoto,
  IconPlayerPlay,
  IconPresentation,
  IconSlideshow,
  IconTimeline,
  IconToggleRight,
  IconVolume,
  IconWriting,
} from "@tabler/icons-react";
import { CommonsActivity } from "../types";

/**
 * Tabler icon per H5P content type, keyed by library machine name because
 * display titles vary between library versions. Anything unmapped gets the
 * generic box.
 */
const CONTENT_TYPE_ICONS: Record<string, Icon> = {
  "H5P.InteractiveVideo": IconPlayerPlay,
  "H5P.QuestionSet": IconListCheck,
  "H5P.CoursePresentation": IconPresentation,
  "H5P.InteractiveBook": IconBook,
  "H5P.MultiChoice": IconCircleCheck,
  "H5P.SingleChoiceSet": IconCircleCheck,
  "H5P.TrueFalse": IconToggleRight,
  "H5P.Blanks": IconForms,
  "H5P.DragText": IconDragDrop,
  "H5P.DragQuestion": IconDragDrop2,
  "H5P.MarkTheWords": IconHighlight,
  "H5P.Essay": IconWriting,
  "H5P.Accordion": IconLayoutList,
  "H5P.Column": IconColumns,
  "H5P.Summary": IconListDetails,
  "H5P.Flashcards": IconCards,
  "H5P.Dialogcards": IconCards,
  "H5P.ImageHotspots": IconMapPin,
  "H5P.ImageHotspotQuestion": IconMapPin,
  "H5P.Timeline": IconTimeline,
  "H5P.Questionnaire": IconClipboardList,
  "H5P.ArithmeticQuiz": IconMathSymbols,
  "H5P.SpeakTheWords": IconMicrophone,
  "H5P.SpeakTheWordsSet": IconMicrophone,
  "H5P.Audio": IconVolume,
  "H5P.ImageSlider": IconSlideshow,
  "H5P.Agamotto": IconSlideshow,
  "H5P.Image": IconPhoto,
};

/** "H5P.InteractiveVideo 1.27" -> "H5P.InteractiveVideo". */
function machineName(library?: string): string {
  return (library ?? "").split(" ")[0];
}

export function getContentTypeIcon(library?: string): Icon {
  return CONTENT_TYPE_ICONS[machineName(library)] ?? IconBox;
}

/**
 * Display name of the content type. Studio's library title when the import
 * carried one, else a readable form of the machine name.
 */
export function getContentTypeName(
  activity: Pick<CommonsActivity, "libraryTitle" | "library">
): string | undefined {
  if (activity.libraryTitle) return activity.libraryTitle;
  const name = machineName(activity.library).replace(/^H5P\./, "");
  return name ? name.replace(/([a-z])([A-Z])/g, "$1 $2") : undefined;
}

type LicenseInfo = { text: string; url?: string; publicDomain?: boolean };

const CC_PATHS: Record<string, string> = {
  "CC BY": "by",
  "CC BY-SA": "by-sa",
  "CC BY-ND": "by-nd",
  "CC BY-NC": "by-nc",
  "CC BY-NC-SA": "by-nc-sa",
  "CC BY-NC-ND": "by-nc-nd",
};

/**
 * Presentation of an H5P license. H5P uses its own codes ("CC BY" with a
 * separate version, "PD", "C", "U"), not Conductor's book license keys, so the
 * book helpers do not apply. "U" (undisclosed) and an empty value show nothing.
 */
export function getActivityLicense(
  license?: CommonsActivity["license"]
): LicenseInfo | undefined {
  const code = license?.name?.trim();
  if (!code || code === "U") return undefined;
  const version = license?.version?.trim();

  if (CC_PATHS[code]) {
    const v = version || "4.0";
    return {
      text: `${code} ${v}`,
      url: `https://creativecommons.org/licenses/${CC_PATHS[code]}/${v}/`,
    };
  }
  switch (code) {
    case "CC0 1.0":
      return {
        text: "CC0 1.0",
        url: "https://creativecommons.org/publicdomain/zero/1.0/",
        publicDomain: true,
      };
    case "CC PDM":
      return {
        text: "Public Domain Mark",
        url: "https://creativecommons.org/publicdomain/mark/1.0/",
        publicDomain: true,
      };
    case "PD":
      return { text: "Public Domain", publicDomain: true };
    case "ODC PDDL":
      return {
        text: "ODC Public Domain Dedication and License",
        url: "https://opendatacommons.org/licenses/pddl/",
        publicDomain: true,
      };
    case "GNU GPL":
      return {
        text: version ? `GNU GPL ${version}` : "GNU GPL",
        url: "https://www.gnu.org/licenses/gpl.html",
      };
    case "C":
      return { text: "All Rights Reserved" };
    default:
      return { text: version ? `${code} ${version}` : code };
  }
}

/**
 * The attribution sentence for an activity, as plain text for copying:
 * "{title} by {authors}, {institution}, is shared under a {license} license,
 * except where otherwise noted." Clauses with no data are left out.
 */
export function buildActivityAttribution(
  activity: Pick<CommonsActivity, "title" | "authors" | "publisher" | "license">
): string {
  const credit = [activity.authors.join(", "), activity.publisher]
    .filter(Boolean)
    .join(", ");
  const license = getActivityLicense(activity.license);

  let sentence = credit ? `${activity.title} by ${credit}` : activity.title;
  if (!license) return `${sentence}.`;
  if (license.publicDomain) return `${sentence}, is in the public domain (${license.text}).`;
  if (license.text === "All Rights Reserved") return `${sentence}. All rights reserved.`;
  sentence += `, is shared under a ${license.text} license, except where otherwise noted.`;
  return sentence;
}

/**
 * The URL h5p-service serves an activity's embed page at. This shape is a
 * public contract that published textbooks and ADAPT depend on.
 */
export function getActivityEmbedURL(origin: string, h5pContentID: number): string {
  return `${origin.replace(/\/+$/, "")}/h5p/${h5pContentID}/embed`;
}

/**
 * Embed code for pasting into a page or LMS: the iframe plus the H5P resizer,
 * which grows the iframe to fit the activity.
 */
export function buildActivityEmbedCode(
  origin: string,
  h5pContentID: number,
  title: string
): string {
  const base = origin.replace(/\/+$/, "");
  const safeTitle = title.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
  return (
    `<iframe src="${getActivityEmbedURL(base, h5pContentID)}" width="800" height="450" ` +
    `frameborder="0" allowfullscreen="allowfullscreen" title="${safeTitle}"></iframe>` +
    `<script src="${base}/h5p/core/js/h5p-resizer.js" charset="UTF-8"></script>`
  );
}
