import axios from "axios";
import { debug } from "../../debug";
import { AddressValidationInput, AddressValidationResult, AddressValidationSuggestion } from "../../types";

const GOOGLE_ADDRESS_VALIDATION_URL = "https://addressvalidation.googleapis.com/v1:validateAddress";
const REQUEST_TIMEOUT_MS = 5000;

export default class AddressValidationService {
    /**
     * Validates a shipping address against Google's Address Validation API.
     * Fails open (returns "not_configured" or "error") whenever validation
     * cannot be performed, so callers can proceed without blocking checkout.
     */
    async validateAddress(address: AddressValidationInput): Promise<AddressValidationResult> {
        const apiKey = process.env.GOOGLE_MAPS_API_KEY;
        if (!apiKey) {
            debug("[AddressValidationService]: GOOGLE_MAPS_API_KEY not set, skipping address validation");
            return { status: "not_configured" };
        }

        try {
            const response = await axios.post(
                GOOGLE_ADDRESS_VALIDATION_URL,
                {
                    address: {
                        regionCode: address.country,
                        postalCode: address.postal_code,
                        administrativeArea: address.state,
                        locality: address.city,
                        addressLines: [address.address_line_1, address.address_line_2].filter(
                            (line): line is string => !!line && line.trim().length > 0
                        ),
                    },
                },
                {
                    params: { key: apiKey },
                    timeout: REQUEST_TIMEOUT_MS,
                }
            );

            return this._interpretResponse(response.data, address);
        } catch (error) {
            debug("[AddressValidationService]: Error validating address with Google, failing open:", error);
            return { status: "error" };
        }
    }

    private _interpretResponse(data: any, original: AddressValidationInput): AddressValidationResult {
        const result = data?.result;
        const verdict = result?.verdict;
        const components: any[] = result?.address?.addressComponents || [];

        if (!verdict) {
            debug("[AddressValidationService]: Unexpected response shape from Google, failing open");
            return { status: "error" };
        }

        const hasSuspiciousComponent = components.some(
            (component) => component.confirmationLevel === "UNCONFIRMED_AND_SUSPICIOUS"
        );

        if (!verdict.addressComplete || hasSuspiciousComponent) {
            return {
                status: "invalid",
                reason: "We couldn't confirm this address as deliverable. Please double-check it and try again.",
            };
        }

        const needsSuggestion =
            verdict.hasReplacedComponents || verdict.hasInferredComponents || verdict.hasUnconfirmedComponents;

        if (!needsSuggestion) {
            return { status: "valid" };
        }

        const suggested = this._buildSuggestion(result?.address?.postalAddress, original);
        if (!suggested) {
            return { status: "valid" };
        }

        return { status: "suggested_correction", suggested };
    }

    private _buildSuggestion(postalAddress: any, original: AddressValidationInput): AddressValidationSuggestion | null {
        if (!postalAddress) return null;

        const suggested: AddressValidationSuggestion = {
            address_line_1: postalAddress.addressLines?.[0] || original.address_line_1,
            address_line_2: postalAddress.addressLines?.[1] || "",
            city: postalAddress.locality || original.city,
            state: postalAddress.administrativeArea || original.state,
            postal_code: postalAddress.postalCode || original.postal_code,
            country: postalAddress.regionCode || original.country,
        };

        const isUnchanged =
            suggested.address_line_1 === original.address_line_1 &&
            (suggested.address_line_2 || "") === (original.address_line_2 || "") &&
            suggested.city === original.city &&
            suggested.state === original.state &&
            suggested.postal_code === original.postal_code &&
            suggested.country === original.country;

        return isUnchanged ? null : suggested;
    }
}
