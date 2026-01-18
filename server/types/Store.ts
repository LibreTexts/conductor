import Stripe from "stripe";
import { RawStoreOrder } from "../models/storeorder";
import { Prettify } from "./Misc";

export type DownloadCenterItem = {
    id: string;
    title: string;
    zipFilename: string;
    author: string;
    institution: string;
    link: string;
    tags: string[];
    summary: string;
    failed: boolean;
    numPages: number;
    lastModified: string;
}

export type BookPriceOption = {
    hardcover: boolean;
    color: boolean;
    price: number;
    formatted_price: string;
}

export type StoreProduct = Stripe.Product & {
    prices: Stripe.Price[];
}

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

/**
 * Helper type for use during order processing.
 */
export type ResolvedProduct = {
    product_id: string;
    price_id: string;
    product: Stripe.Product;
    price: Stripe.Price;
    quantity: number;
}

export type StoreOrderWithStripeSession = Prettify<RawStoreOrder & {
    stripe_session: Stripe.Checkout.Session | null;
    stripe_charge?: Stripe.Charge | null
}>