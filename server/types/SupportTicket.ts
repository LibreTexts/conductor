import { SupportTicketStatusEnum } from "../models/supporticket";


export type AssignSupportTicketParams = {
    uuid: string;
    assigned: string[];
    assigner: string;
}

export type ChangeTicketStatusParams<T extends SupportTicketStatusEnum> = T extends "closed" ? {
    uuid: string;
    status: T;
    callingUserName: string;
} : {
    uuid: string;
    status: T;
    callingUserName?: undefined;
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
}