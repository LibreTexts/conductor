import Stripe from 'stripe';
import { Prettify } from './Misc';

export type Cart = {
    id: string;
    items: CartItem[];
    subtotal: number;
    cart_first_created?: string; // ISO 8601 UTC timestamp, set when the cart is first created
    promotions?: Array<{
        code: string;
        description: string;
        discount_amount: number;
    }>;
    shipping_address?: CartAddress;
    billing_address?: CartAddress;
    user?: {
        id: string;
        email: string;
    }
}

export type CartAddress = {
    first_name: string;
    last_name: string;
    address_line_1: string;
    address_line_2?: string;
    city: string;
    state: string;
    postal_code: string;
    country: string;
    phone?: string;
    company?: string;
}


export type StoreProductPrice = Prettify<Stripe.Price>;

export type StoreProduct = Prettify<Stripe.Product & {
    prices: StoreProductPrice[];
}>

export type CartItem = {
    id: string;
    product: StoreProduct;
    price: StoreProductPrice;
    quantity: number;
}

export type StoreCheckoutSessionItem = {
    price_id: string;
    product_id: string;
    quantity: number;
}

export type StoreCheckoutForm = {
    first_name: string;
    last_name: string;
    company?: string;
    address_line_1: string;
    address_line_2?: string;
    city: string;
    state: string;
    postal_code: string;
    country: string;
    email: string;
    phone: string;
}

export type StoreGetShippingOptionsRes = StoreShippingOption[] | "digital_delivery_only"
export type StoreShippingOption = {
    title: string;
    id: number;
    total_days_min: number;
    total_days_max: number;
    lulu_shipping_level: string;
    cost_excl_tax: number;
    production_start_date_estimate: string;
    production_end_date_estimate: string;
    ship_date_start_estimate: string;
    ship_date_end_estimate: string;
    delivery_date_start_estimate: string;
    delivery_date_end_estimate: string;
}

export type StoreDigitalDeliveryOption = "apply_to_account" | "email_access_codes";

export type StoreAddressFields = Pick<
    StoreCheckoutForm,
    "address_line_1" | "address_line_2" | "city" | "state" | "postal_code" | "country"
>;

export type StoreAddressValidationStatus = "skipped" | "valid" | "suggested_correction" | "invalid";

export type StoreValidateAddressRes = {
    status: StoreAddressValidationStatus;
    suggested_address?: StoreAddressFields;
};

export type StoreOrderShippingItemData = {
    shippingStatus: "ORDER_PLACED" | "IN_PRODUCTION" | "SHIPPED";
    trackingID?: string;
    carrierName?: string;
    trackingURLs: string[];
}

export type StoreOrderShippingData = {
    estimatedShippingDates?: { arrival_min: string; arrival_max: string; dispatch_min: string; dispatch_max: string } | null;
    items: Record<string, StoreOrderShippingItemData>;
}

export type ManualPrintJobSubmission = {
    submittedBy: string; // Central Identity UUID of the submitting superadmin
    submittedAt: string;
    payload: Record<string, any>;
    luluJobID?: string;
    success: boolean;
    error?: string;
}

export type StoreOrder = {
    _id: string; // MongoDB ObjectID
    id: string; // Stripe checkout session ID
    status: "pending" | "completed" | "failed" | "canceled";
    error: string;
    luluJobID?: string;
    luluJobStatus?: string;
    luluJobStatusMessage?: string;
    manualPrintJobSubmissions?: ManualPrintJobSubmission[];
    createdAt?: Date;
    updatedAt?: Date;
}

/**
 * The editable portion of a Lulu print job payload, as accepted by the manual submission
 * endpoint. Hand-mirrored from `LuluPrintJobParams` in `server/types/Lulu.ts`, minus the
 * server-owned fields (`external_id`, `contact_email`, `production_delay`).
 */
export type ManualPrintJobPayload = {
    shipping_address: {
        name: string;
        street1: string;
        street2?: string | null;
        city: string;
        state_code: string;
        postcode: string;
        country_code: string;
        phone_number: string;
        email: string;
        is_business: boolean;
    };
    line_items: Array<{
        external_id: string;
        title: string;
        quantity: number;
        printable_normalization: {
            cover: { source_url: string };
            interior: { source_url: string };
            pod_package_id: string;
        };
    }>;
    shipping_level:
        | "MAIL"
        | "PRIORITY_MAIL"
        | "GROUND_HD"
        | "GROUND_BUS"
        | "GROUND"
        | "EXPEDITED"
        | "EXPRESS";
};

/**
 * Response of the print job payload builder: the derived payload (including the read-only
 * `external_id`) plus any gaps the builder could not fill from the Stripe checkout session.
 */
export type ManualPrintJobPayloadResponse = {
    params: ManualPrintJobPayload & { external_id: string };
    warnings: string[];
};

export type StoreOrderWithStripeSession = StoreOrder & {
    stripe_session: Stripe.Checkout.Session;
    stripe_charge?: Stripe.Charge | null;
}

/**
 * Flat, Stripe-free shape returned by the admin order-list endpoint (served from the
 * "storeOrders" Meilisearch index). The Store Management table renders these directly —
 * no live Stripe session is fetched for the list view.
 */
export type StoreOrderListItem = {
    id: string;
    status: StoreOrder["status"];
    customerEmail?: string;
    amountTotal?: number;
    currency?: string;
    luluJobID?: string;
    luluJobStatus?: string;
    supportTicketUUID?: string;
    createdAt?: string; // ISO string as stored in the index
    createdAtTimestamp?: number; // epoch millis
}
