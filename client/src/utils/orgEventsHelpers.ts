import { utcToZonedTime } from "date-fns-tz";
import { OrgEvent } from "../types";
import { OrgEventFeeWaiver } from "../types/OrgEvent";

/**
 * Initializes date fields to Date objects in an OrgEvent object.
 *
 * @param orgEvent - OrgEvent object to initialize on.
 * @returns OrgEvent object with date fields initialized.
 */
export function initOrgEventDates(orgEvent: OrgEvent): OrgEvent {
    let regOpenDate = new Date(orgEvent.regOpenDate);
    let regCloseDate = new Date(orgEvent.regCloseDate);
    let startDate = new Date(orgEvent.startDate);
    let endDate = new Date(orgEvent.endDate);
    if (orgEvent.timeZone?.value) {
        regOpenDate = utcToZonedTime(orgEvent.regOpenDate, orgEvent.timeZone.value);
        regCloseDate = utcToZonedTime(regCloseDate, orgEvent.timeZone.value);
        startDate = utcToZonedTime(startDate, orgEvent.timeZone.value);
        endDate = utcToZonedTime(endDate, orgEvent.timeZone.value);
    }
    return {
        ...orgEvent,
        regOpenDate,
        regCloseDate,
        startDate,
        endDate,
    };
}

/**
 * Initializes date fields to Date objects in an OrgEventFeeWaiver object.
 *
 * @param feeWaiver - OrgEventFeeWaiver object to initialize on.
 * @returns OrgEventFeeWaiver object with date fields initialized.
 */
export function initOrgEventFeeWaiverDates(feeWaiver: OrgEventFeeWaiver): OrgEventFeeWaiver {
    return {
        ...feeWaiver,
        expirationDate: new Date(feeWaiver.expirationDate),
    };
}
