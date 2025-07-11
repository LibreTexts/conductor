import { query } from 'express';
import { z } from 'zod';

const _ProductPriceQuantity = z.object({
    product_id: z.string().min(1, "Product ID is required"),
    price_id: z.string().min(1, "Price ID is required"),
    quantity: z.coerce.number().min(1, "Quantity must be at least 1").max(10, "Quantity cannot exceed 10"),
})

const _BasicShippingAddress = z.object({
    city: z.string().min(1, "City is required"),
    country: z.enum(['US', 'CA']),
    postal_code: z.string().min(1, "Postal code is required"),
    state: z.string().length(2, "State must be a 2-letter code"),
    address_line_1: z.string().min(1, "Street address is required"),
})

const _FullShippingAddress = _BasicShippingAddress.extend({
    first_name: z.string().min(1, "First name is required"),
    last_name: z.string().min(1, "Last name is required"),
    company: z.string().optional().or(z.literal("")),
    address_line_2: z.string().optional().or(z.literal("")),
    phone: z.string().min(1, "Phone number is required"),
    email: z.string().email("Invalid email address")
})

export const GetStoreProductsSchema = z.object({
    query: z.object({
        limit: z.coerce.number().optional(),
        starting_after: z.string().optional(),
        category: z.string().optional(),
        query: z.string().optional().or(z.literal("")),
    }).optional(),
});

export const GetMostPopularStoreProductsSchema = z.object({
    query: z.object({
        limit: z.coerce.number().optional().default(10),
    }),
});

export const GetStoreProductSchema = z.object({
    params: z.object({
        product_id: z.string().min(1, "Product ID is required"),
    }),
});

export const CreateCheckoutSessionSchema = z.object({
    body: z.object({
        items: z.array(_ProductPriceQuantity)
            .min(1, "At least one item is required"),
        shipping_option_id: z.number().or(z.literal("digital_delivery_only")),
        shipping_address: _FullShippingAddress,
        digital_delivery_option: z.enum(["apply_to_account", "email_access_codes"]).optional()
    })
})

export const UpdateCheckoutSessionSchema = z.object({
    body: z.object({
        checkout_session_id: z.string().min(1, "Checkout session ID is required"),
        items: z.array(_ProductPriceQuantity)
            .min(1, "At least one item is required"),
        shipping_address: _FullShippingAddress
    })
})

export const GetShippingOptionsSchema = z.object({
    body: z.object({
        items: z.array(_ProductPriceQuantity)
            .min(1, "At least one item is required"),
        shipping_address: _BasicShippingAddress
    })
})


