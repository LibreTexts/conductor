import { SupportTicketStatusEnum } from "../models/supporticket";


export type AssignSupportTicketParams = {
    uuid: string;
    assigned: string[];
    assigner: string;
}

export type ChangeTicketStatusParams<T extends SupportTicketStatusEnum> = (T extends "closed" ? {
    uuid: string;
    status: T;
    callingUserName: string;
} : {
    uuid: string;
    status: T;
    callingUserName?: string; // logs a reopen when moving off closed
}) & {
    expectedStatus?: SupportTicketStatusEnum; // skip if the ticket moved off the status the caller read
}

export type SearchTicketsParams = {
    statuses: SupportTicketStatusEnum[];
    queue_id?: string;
    query?: string;
    assignee?: string[];
    priority?: string[];
    category?: string[];
    sort?: string;
    returnAccessKeys?: boolean;
    limit?: number;
    page?: number;
}