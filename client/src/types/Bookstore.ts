
export type Cart = {
    id: string;
    items: Array<{
        variant_id: string;
        quantity: number;
    }>;
    total: number;
    promotions?: Array<{
        code: string;
        description: string;
        discount_amount: number;
    }>;
    shipping_address?: CartAddress;
    billing_address?: CartAddress;
    user: {
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