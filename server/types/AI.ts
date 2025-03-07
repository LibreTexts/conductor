export type AltTextAICreateImage200Response = {
  asset_id: string;
  url: string;
  alt_text: string;
  metadata: Record<string, any>;
  created_at: number;
  errors: {};
  error_code: null;
};

export type AltTextAICreateImage4XXResponse = {
  url: string;
  errors: {
    url: string[];
  };
  error_code: string;
};
