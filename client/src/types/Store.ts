import Stripe from 'stripe';
import { Prettify } from './Misc';

export type Cart = {
    id: string;
    items: CartItem[];
    subtotal: number;
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
    cost_excl_tax: number;
}