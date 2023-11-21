import { z } from "zod";
import { KBPage, SupportTicket, User } from "../types";

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
