import { z } from 'zod';

const _ProductPriceQuantity = z.object({
    product_id: z.string().min(1, "Product ID is required"),
    price_id: z.string().min(1, "Price ID is required"),
    quantity: z.coerce.number().min(1, "Quantity must be at least 1"), // Maximum quantity validation will be handled in business logic to allow flexibility based on user role
})

const _BasicShippingAddress = z.object({
    city: z.string().trim().min(1, "City is required"),
    country: z.enum(['US', 'CA']),
    postal_code: z.string().trim().min(1, "Postal code is required"),
    state: z.string().trim().length(2, "State must be a 2-letter code"),
    address_line_1: z.string().trim().min(1, "Street address is required").max(30, "Address line 1 cannot exceed 30 characters"),
})

const _FullShippingAddress = _BasicShippingAddress.extend({
    first_name: z.string().trim().min(1, "First name is required"),
    last_name: z.string().trim().min(1, "Last name is required"),
    company: z.string().trim().optional().or(z.literal("")),
    address_line_2: z.string().trim().optional().refine(val => !val || val.length <= 30, "Address line 2 cannot exceed 30 characters").or(z.literal("")),
    phone: z.string().trim().min(1, "Phone number is required"),
    email: z.string().trim().email("Invalid email address")
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

export const SyncSingleBookToStripeSchema = z.object({
    params: z.object({
        bookID: z.string().trim().min(1, "Book ID is required"),
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

export const GetOrderInfoSchema = z.object({
    params: z.object({
        order_id: z.string().min(1, "Order ID is required"),
    }),
});

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

export const ValidateAddressSchema = z.object({
    body: z.object({
        shipping_address: _BasicShippingAddress.extend({
            address_line_2: z.string().trim().optional().or(z.literal("")),
        })
    })
})

export const AdminGetStoreOrdersSchema = z.object({
    query: z.object({
        starting_after: z.string().optional().or(z.literal("")),
        limit: z.coerce.number().optional().default(25),
        status: z.string().optional().or(z.literal("")),
        lulu_status: z.string().optional().or(z.literal("")),
        query: z.string().optional().or(z.literal("")),
    }).optional(),
})

export const AdminGetStoreOrderSchema = z.object({
    params: z.object({
        order_id: z.string().min(1, "Order ID is required"),
    }),
});

export const AdminResubmitPrintJobSchema = AdminGetStoreOrderSchema;

export const AdminGetPrintJobPayloadSchema = AdminGetStoreOrderSchema;

// Mirrors LuluShippingLevel in server/types/Lulu.ts
const _LuluShippingLevel = z.enum(["MAIL", "PRIORITY_MAIL", "GROUND_HD", "GROUND_BUS", "GROUND", "EXPEDITED", "EXPRESS"]);

const _LuluFullShippingAddress = z.object({
    name: z.string().trim().min(1, "Recipient name is required"),
    street1: z.string().trim().min(1, "Street address is required"),
    // Defaulted rather than optional so the parsed shape matches LuluFullShippingAddress,
    // where street2 is always present (nullable).
    street2: z.string().trim().nullable().default(null),
    city: z.string().trim().min(1, "City is required"),
    state_code: z.string().trim(),
    postcode: z.string().trim().min(1, "Postal code is required"),
    country_code: z.string().trim().length(2, "Country code must be a 2-letter ISO code"),
    phone_number: z.string().trim().default(""),
    email: z.string().trim().email("Invalid email address"),
    is_business: z.boolean().default(false),
}).strict();

const _LuluPrintJobLineItem = z.object({
    external_id: z.string().trim().min(1, "Line item external_id (book ID) is required"),
    title: z.string().trim().min(1, "Line item title is required"),
    quantity: z.coerce.number().int().positive("Quantity must be a positive integer"),
    printable_normalization: z.object({
        cover: z.object({
            source_url: z.string().trim().url("Cover source_url must be a valid URL"),
        }).strict(),
        interior: z.object({
            source_url: z.string().trim().url("Interior source_url must be a valid URL"),
        }).strict(),
        pod_package_id: z.string().trim().min(1, "pod_package_id is required"),
    }).strict(),
}).strict();

/**
 * Body schema for a hand-edited Lulu print job submission.
 *
 * `.strict()` is deliberate at every level: rather than silently dropping a pasted `external_id`,
 * `contact_email`, or `production_delay`, the request is rejected with a clear message so an admin
 * is never left believing they overrode a server-owned field.
 */
export const AdminSubmitManualPrintJobSchema = z.object({
    params: z.object({
        order_id: z.string().min(1, "Order ID is required"),
    }),
    body: z.object({
        shipping_address: _LuluFullShippingAddress,
        line_items: z.array(_LuluPrintJobLineItem).min(1, "At least one line item is required"),
        shipping_level: _LuluShippingLevel,
    }).strict(),
});