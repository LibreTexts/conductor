import { Organization } from "./Organization";
import { User } from "./User";

export type Announcement = {
    _id?: string;
    author: User;
    title: string;
    message: string;
    org: string | Organization;
    createdAt: string;
}  