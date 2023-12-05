import { z } from "zod";
import { AtlasSearchHighlight, KBPage, SupportTicket, User } from "../types";
import DOMPurify from "dompurify";

export const checkIsUUID = (str?: string | null) => {
  if (!str) return false;
  const parsed = z.string().uuid().safeParse(str);
  const isUUID = parsed.success;
  return isUUID;
};

export const getKBSharingObj = (page: KBPage) => {
  return {
    title: page.title,
    text: page.description,
    url: `commons.libretexts.org/insight/page/${page.slug}`,
  };
};

/**
 * Checks if user has a role of 'kbeditor' in the 'libretexts' org
 * @param user - the user object
 * @returns [boolean] - true if user has 'kbeditor' role in 'libretexts' org (or is superadmin), false otherwise
 */
export const canEditKB = (user?: User): boolean => {
  if (!user || !user.roles) return false;
  const libretextsRoles = user.roles.filter((org) => org.org === "libretexts");
  const superAdmin = libretextsRoles.some((role) => role.role === "superadmin");
  if (superAdmin) return true; // superadmins can edit KB
  return libretextsRoles.some((match) => match.role === "kbeditor");
};

export const getRequesterText = (ticket: SupportTicket) => {
  if (ticket.user) {
    return `${ticket.user.firstName} ${ticket.user.lastName} (${ticket.user.email})`;
  } else if (ticket.guest) {
    return `${ticket.guest.firstName} ${ticket.guest.lastName} (${ticket.guest.email})`;
  } else {
    return "Unknown";
  }
};

export const getHighlightedTextSafe = (
  original?: string,
  highlight?: AtlasSearchHighlight
): string => {
  if (!original) return "";
  if (!highlight) return original;
  let result = original;
  const texts = highlight.texts;
  const replacements = texts
    .map((text) => {
      if (text.type === "hit") {
        return "<mark>" + text.value + "</mark>";
      } else {
        return text.value;
      }
    })
    .join("");
  const originals = texts.map((text) => text.value).join("");
  result = result.replace(originals, replacements);
  result = DOMPurify.sanitize(result);
  return result;
};

export const extractPathHiglights = (
  path: string,
  arr?: AtlasSearchHighlight[],
): AtlasSearchHighlight | undefined => {
  if (!arr) return undefined;
  return arr.find((item) => item.path === path);
};
