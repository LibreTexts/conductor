import { License } from "./Misc";

export type HarvestRequest = {
    name: string;
    email: string;
    title: string;
    library: string;
    url: string;
    license: License;
    institution: string;
    resourceUse: string;
    dateIntegrate: string;
    addToProject: boolean;
    comments: string;
}