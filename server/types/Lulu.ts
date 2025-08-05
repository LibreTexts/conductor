import { StringExpression } from "mongoose";

export type LuluShippingLevel = "MAIL" | "PRIORITY_MAIL" | "GROUND_HD" | "GROUND_BUS" | "GROUND" | "EXPEDITED" | "EXPRESS";

export type LuluShippingLineItem = {
    page_count: number;
    pod_package_id: string;
    quantity: number;
}

export type LuluShippingCalculationAddress = {
    city: string;
    country: string;
    postcode: string;
    state_code: string;
    street_address: string;
}

export type LuluShippingOption = {
    business_only: boolean,
    cost_excl_tax: string | null,
    currency: string,
    home_only: boolean,
    id: number,
    carrier_service_name?: string | null,
    level: LuluShippingLevel,
    max_delivery_date: string,
    max_dispatch_date: string,
    min_delivery_date: string,
    min_dispatch_date: string,
    postbox_ok: boolean,
    shipping_buffer: number,
    total_days_max: number,
    total_days_min: number,
    traceable: boolean,
    transit_time: number
}

export type LuluFullShippingAddress = {
    city: string;
    country_code: string;
    is_business: boolean;
    name: string;
    phone_number: string;
    email: string;
    postcode: string;
    state_code: string;
    street1: string;
    street2: string | null;
}

export type LuluPrintJobLineItem = {
    external_id: string;
    printable_normalization: {
        cover: {
            source_url: string;
        },
        interior: {
            source_url: string;
        },
        pod_package_id: string;
    }
    quantity: number;
    title: string;
}

export type LuluPrintJobParams = {
    contact_email: string;
    external_id: string;
    line_items: LuluPrintJobLineItem[];
    shipping_address: LuluFullShippingAddress;
    production_delay: number;
    shipping_level: LuluShippingLevel
}

export type LuluPrintJobStatus = "CREATED" | "ACCEPTED" | "REJECTED" | "IN_PRODUCTION" | "ERROR" | "SHIPPED";

export type LuluPrintJob = {
    contact_email: string,
    costs: {
        line_item_costs: Record<string, any> | null,
        shipping_cost: Record<string, any> | null,
        total_cost_excl_tax: Record<string, any> | null,
        total_cost_incl_tax: Record<string, any> | null,
        total_tax: Record<string, any> | null
    },
    date_created: string,
    date_modified: string,
    estimated_shipping_dates: {
        arrival_max: string,
        arrival_min: string,
        dispatch_max: string,
        dispatch_min: string
    },
    external_id: string,
    id: number,
    line_items: LuluPrintJobLineItem & {
        printable_id: string | null,
        status: {
            messages: Record<string, string> | null,
            name: LuluPrintJobStatus
        }
    }[],
    production_delay: number,
    production_due_time: string | null,
    shipping_address: LuluFullShippingAddress & {
        warnings: Record<string, any>
    },
    shipping_level: LuluShippingLevel,
    shipping_option_level: LuluShippingLevel,
    status: Record<string, any>
}

export type LuluWebhookData = {
    data: LuluPrintJob,
    topic: 'PRINT_JOB_STATUS_CHANGED'
}