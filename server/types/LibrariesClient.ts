import { SSMClient } from "@aws-sdk/client-ssm";

type CXOneFetchBase = {
  subdomain: string;
  options?: Record<string, any>;
  query?: Record<string, any>;
  silentFail?: boolean;
};

type CXOneFetchPageParams = CXOneFetchBase & {
  scope: "page";
  path: string | number;
  api: string;
};

type CXOneFetchGroupsParams = CXOneFetchBase & {
  scope: "groups";
};

type CXOneFetchUsersParams = CXOneFetchBase & {
  scope: "users";
};

export type CXOneFetchParams =
  | CXOneFetchPageParams
  | CXOneFetchGroupsParams
  | CXOneFetchUsersParams;

export type LibrariesSSMClient = {
  apiUsername: string;
  libTokenPairPath: string;
  ssm: SSMClient;
};

export type LibraryTokenPair = {
  key: string;
  secret: string;
};

export type LibraryAPIRequestHeaders = {
  "X-Deki-Token": string;
  "X-Requested-With": string;
};

export type CXOneGroup = {
  id: string;
  name: string;
  description: string;
};

export type CXOneUser = {
  id: string;
  username: string;
  email: string;
};
