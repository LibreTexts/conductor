import { OrgEvent } from "../types";
import { OrgEventFeeWaiver } from "../types/OrgEvent";

/**
 * Initializes date fields to Date objects in an OrgEvent object.
 *
 * @param orgEvent - OrgEvent object to initialize on.
 * @returns OrgEvent object with date fields initialized.
 */
export function initOrgEventDates(orgEvent: OrgEvent): OrgEvent {
    return {
        ...orgEvent,
        regOpenDate: new Date(orgEvent.regOpenDate),
        regCloseDate: new Date(orgEvent.regCloseDate),
        startDate: new Date(orgEvent.startDate),
        endDate: new Date(orgEvent.endDate),
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
