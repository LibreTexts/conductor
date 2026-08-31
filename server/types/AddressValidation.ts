export type AddressValidationInput = {
    address_line_1: string;
    address_line_2?: string;
    city: string;
    state: string;
    postal_code: string;
    country: string;
};

export type AddressValidationSuggestion = AddressValidationInput;

export type AddressValidationResult =
    | { status: "not_configured" }
    | { status: "valid" }
    | { status: "suggested_correction"; suggested: AddressValidationSuggestion }
    | { status: "invalid"; reason: string }
    | { status: "error" };
