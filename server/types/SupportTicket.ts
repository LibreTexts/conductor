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