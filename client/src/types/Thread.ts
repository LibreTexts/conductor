export type Thread = {
  threadID: string;
  project: string;
  title: string;
  kind: "project" | "a11y" | "peerreview";
  defaultNotifSubject: "all" | "specific" | "support" | "none";
  createdBy: string;
  lastNotifSent?: Date;
};
