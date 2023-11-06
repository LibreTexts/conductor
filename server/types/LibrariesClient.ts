import { SSMClient } from "@aws-sdk/client-ssm";

export type LibrariesClient = {
    apiUsername: string;
    libTokenPairPath: string;
    ssm: SSMClient;
}

export type LibraryTokenPair = {
    key: string;
    secret: string;
}

export type LibraryAPIRequestHeaders = {
    'X-Deki-Token': string;
    'X-Requested-With': string;
}