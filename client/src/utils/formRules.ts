export const required = {
  required: { value: true, message: "This field is required." },
};

/** Use with required: accepts non-empty strings that parse as absolute http(s) URLs after trim. */
export const httpUrl = {
  validate: (value: unknown) => {
    const s = String(value ?? "").trim();
    if (!s) {
      return true;
    }
    try {
      const u = new URL(s);
      if (u.protocol !== "http:" && u.protocol !== "https:") {
        return "URL must start with http:// or https://.";
      }
      return true;
    } catch {
      return "Enter a valid URL.";
    }
  },
};
