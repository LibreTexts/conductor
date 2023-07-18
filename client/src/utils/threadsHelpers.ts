export const THREADS_NOTIFY_OPTIONS = [
  {
    key: "all",
    text: "Notify entire team",
    value: "all",
  },
  {
    key: "specific",
    text: "Notify specific people...",
    value: "specific",
  },
  {
    key: "support",
    text: "Notify LibreTexts Support",
    value: "support",
  },
  {
    key: "none",
    text: `Don't notify anyone`,
    value: "none",
  },
];

export const getThreadNotifyOption = (option: string) => {
  return THREADS_NOTIFY_OPTIONS.find((o) => o.value === option);
};
