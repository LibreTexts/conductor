export type BookBotType = "editor-preprocess";

export type BookBotRunState =
  | "queued"
  | "starting"
  | "getSubpages"
  | "processing"
  | "done"
  | "error";

export type BookBotRunPage = {
  path: string;
  url: string;
};

export type BookBotRunLogEntry = {
  ts: string;
  state: BookBotRunState;
  message?: string;
  percentage?: number;
};

export type BookBotRun = {
  jobID: string;
  botType: BookBotType;
  triggeredBy: string;
  rootURL: string;
  libreUser: string;
  state: BookBotRunState;
  percentage?: number;
  pages: BookBotRunPage[];
  logs: BookBotRunLogEntry[];
  messages: string[];
  errorMessage?: string;
  startedAt?: string;
  endedAt?: string;
  createdAt: string;
  updatedAt: string;
};
