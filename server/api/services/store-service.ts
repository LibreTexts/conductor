import Stripe from "stripe";
import { debug } from "../../debug";
import StripeService from "./stripe-service";
import { getLibraryNameKeys } from "../libraries";
import axios from "axios";
import { BookPriceOption, StoreProduct, StoreShippingOption, DownloadCenterItem, LuluShippingLineItem, ResolvedProduct, LuluShippingLevel, LuluWebhookData, StoreOrderWithStripeSession, LuluPrintJob, LuluPrintJobParams, LULU_HEALTHY_STATUSES, LULU_FAILURE_STATUSES } from "../../types";
import { checkBookIDFormat } from "../../util/bookutils";
import { CreateCheckoutSessionSchema, GetShippingOptionsSchema, AdminGetStoreOrdersSchema } from "../validators/store";
import { z } from "zod";
import LuluService from "./lulu-service";
import StoreOrder, { RawManualPrintJobSubmission, RawStoreOrder, RawStoreOrderNotification, StoreOrderDocument } from "../../models/storeorder";
import centralIdentityAPI from "../central-identity"
import Fuse from "fuse.js";
import NodeCache from "node-cache";
import { serializeError } from "../../util/errorutils";
import mailAPI from "../mail"
import User from "../../models/user";
import authAPI from "../../api/auth.js";
import SupportTicketService from "./support-ticket-service";
import SearchService from "./search-service.js";
import { upsertStoreOrderToSearchIndex } from "./store-order-search-service.js";
import { FilterObject } from "../../types/Search.js";
import { StoreOrderListItem } from "../../types/Store.js";

const BASE_COST = 1.80;
const PAGE_MULTIPLIER = 0.032;
const HARDCOVER_SURCHARGE = 7.35;
const COLOR_MULTIPLIER = 1.5;
const OPERATING_COST_MULTIPLIER = 0.24;

// Define max item quantity limits
const DEFAULT_MAX_QUANTITY = 200;
const STAFF_MAX_QUANTITY = 500;

class StoreService {
    private stripeService = new StripeService();
    private luluService = new LuluService();
    private ticketService = new SupportTicketService();
    private cache: NodeCache;

    constructor() {
        this.cache = new NodeCache({ stdTTL: 60 * 5, checkperiod: 120 }); // Cache for 5 minutes
    }

    // Cap mask length so we don't leak the exact length of a redacted token.
    private static readonly MAX_MASK_LENGTH = 6;

    /**
     * Masks a single token, keeping `keep` leading characters.
     * Tokens shorter than or equal to `keep` are reduced to a single character
     * so we never echo a short token back verbatim.
     */
    private _maskToken(token: string, keep: number): string {
        if (token.length <= keep) {
            return token.length <= 1 ? token : token[0] + '*';
        }
        const maskLength = Math.min(token.length - keep, StoreService.MAX_MASK_LENGTH);
        return token.slice(0, keep) + '*'.repeat(maskLength);
    }

    /**
     * Redacts a personal name. The first given name is left intact (it is the
     * weakest identifier on its own and the strongest recognition cue for the
     * customer), remaining tokens are reduced to an initial.
     * e.g. "Jonathan Q Turner" -> "Jonathan Q T*****"
     */
    private _redactName(name: string): string {
        if (!name || typeof name !== 'string') return name;

        const tokens = name.trim().split(/\s+/);
        if (tokens.length === 0) return name;

        return [
            tokens[0],
            ...tokens.slice(1).map(token => this._maskToken(token, 1)),
        ].join(' ');
    }

    /**
     * Redacts a street address line. Non-alphabetic tokens (house/unit numbers,
     * "#4B", "1/2") are preserved, alphabetic tokens keep two leading characters.
     * The result is recognizable to the customer but is not a deliverable address.
     * e.g. "1234 Maple Avenue Apt 5" -> "1234 Ma*** Av**** Ap* 5"
     */
    private _redactStreetAddress(line: string): string {
        if (!line || typeof line !== 'string') return line;

        return line
            .trim()
            .split(/\s+/)
            .map(token => (/[a-z]/i.test(token) ? this._maskToken(token, 2) : token))
            .join(' ');
    }

    /**
     * Keeps the first two and last character of the local part plus the full
     * domain, so the customer can confirm the account without the address being
     * guessable. e.g. "jonathan.turner@example.edu" -> "jo************r@example.edu"
     */
    private _redactEmail(email: string): string {
        if (!email || typeof email !== 'string' || !email.includes('@')) return email;

        const atIndex = email.lastIndexOf('@');
        const localPart = email.slice(0, atIndex);
        const domain = email.slice(atIndex + 1);
        if (localPart.length <= 2) return `${this._maskToken(localPart, 1)}@${domain}`;
        if (localPart.length <= 4) return `${localPart[0]}**${localPart.slice(-1)}@${domain}`;

        const maskLength = Math.min(localPart.length - 3, StoreService.MAX_MASK_LENGTH);
        return `${localPart.slice(0, 2)}${'*'.repeat(maskLength)}${localPart.slice(-1)}@${domain}`;
    }

    /**
     * Keeps only the last four digits. The previous first-three-and-last-four
     * rule left all but three digits of a US number visible.
     */
    private _redactPhoneNumber(phone: string): string {
        if (!phone || typeof phone !== 'string') return phone;

        const digitCount = phone.replace(/\D/g, '').length;
        if (digitCount <= 4) return phone;

        let seen = 0;
        return phone.replace(/\d/g, digit => {
            const isVisible = seen >= digitCount - 4;
            seen += 1;
            return isVisible ? digit : '*';
        });
    }

    public async searchStoreProduct(product_id: string): Promise<StoreProduct | null> {
        try {
            const stripe = this.stripeService.getInstance();

            const isBookId = checkBookIDFormat(product_id);

            let prices: Stripe.ApiSearchResult<Stripe.Price> | Stripe.ApiList<Stripe.Price> | null = null;

            if (isBookId) {
                prices = await stripe.prices.search({
                    query: `metadata["book_id"]:"${product_id}" AND active:"true"`,
                    expand: ['data.product'],
                });
            } else {
                prices = await stripe.prices.list({
                    product: product_id,
                    active: true,
                    expand: ['data.product'],
                });
            }

            if (prices.data.length === 0) {
                debug(`No product found with ID: ${product_id}`);
                return null;
            }

            const products = this._groupByProduct(prices.data);
            if (products.length === 0) {
                debug(`No products found for ID: ${product_id}`);
                return null;
            }

            if (products.length > 1) {
                debug(`Multiple products found for ID: ${product_id}, returning the first one.`);
            }

            const product = products[0] as StoreProduct;
            if (!product.prices || product.prices.length === 0) {
                debug(`Product found but has no prices: ${product_id}`);
                return null;
            }

            return product;
        } catch (error) {
            if (error instanceof Stripe.errors.StripeInvalidRequestError && error.code === 'resource_missing') {
                debug(`Product with ID ${product_id} not found in Stripe.`);
                return null;
            }
            debug("Error searching store product:", error);
            throw new Error("Failed to search store product");
        }
    }


    public async getStoreProducts({ limit = 20, starting_after, category, query }: {
        limit?: number;
        starting_after?: string;
        category?: string;
        query?: string;
    }): Promise<{
        items: StoreProduct[];
        has_more: boolean;
        total_count: number;
        cursor?: string;
    }> {
        try {
            const allProducts = await this._fetchAllProducts(category);
            if (!allProducts || allProducts.length === 0) {
                return {
                    items: [],
                    has_more: false,
                    total_count: 0,
                    cursor: undefined
                };
            }

            let filteredProducts = allProducts;
            if (query && query.trim() !== '') {
                // Perform fuzzy search
                const fuse = new Fuse(allProducts, {
                    threshold: 0.3,
                    keys: ["name"],
                    includeScore: true,
                });

                const results = fuse.search(query);
                filteredProducts = results
                    .sort((a, b) => a.score! - b.score!)
                    .map(result => result.item);
            }

            const startIndex = starting_after ? filteredProducts.findIndex(p => p.id === starting_after) + 1 : 0;
            const paginated = filteredProducts.slice(startIndex, startIndex + limit);

            return {
                items: paginated,
                has_more: startIndex + limit < filteredProducts.length,
                total_count: filteredProducts.length,
                cursor: paginated.length > 0 ? paginated[paginated.length - 1].id : undefined
            };
        } catch (error) {
            debug("Error fetching store products:", error);
            throw new Error("Failed to fetch store products");
        }
    }

    public async getMostPopularStoreProducts({
        limit
    }: {
        limit: number;
    }): Promise<StoreProduct[]> {
        try {
            const stripe = this.stripeService.getInstance();

            const prices = await stripe.prices.search({
                query: 'metadata["store"]:"true" AND active:"true"',
                expand: ['data.product'],
            });

            if (!prices || !prices.data || prices.data.length === 0) {
                debug("No bookstore products found.");
                return [];
            }

            const products = this._groupByProduct(prices.data);

            if (products.length === 0) {
                debug("No store products found.");
                return [];
            }

            // For now, grab a random selection of products
            const sortedProducts = products.sort(() => Math.random() - 0.5);
            if (sortedProducts.length === 0) {
                debug("No products available for most popular store products.");
                return [];
            }

            return sortedProducts.slice(0, limit);
        } catch (error) {
            debug("Error fetching most popular store products:", error);
            throw new Error("Failed to fetch most popular store products");
        }
    }

    public async getShippingData(checkout_session_id: string): Promise<{
        estimatedShippingDates?: { arrival_min: string; arrival_max: string; dispatch_min: string; dispatch_max: string } | null;
        items: Record<string, {
            shippingStatus: "ORDER_PLACED" | "IN_PRODUCTION" | "SHIPPED";
            trackingID?: string;
            carrierName?: string;
            trackingURLs: string[];
        }>;
    } | null> {
        const order = await StoreOrder.findOne({ id: { $eq: checkout_session_id } });
        if (!order?.luluJobStatusUpdates?.length) return null;

        // Scope to the order's current Lulu job. `luluJobStatusUpdates` is an append-only event log,
        // and on orders processed before superseded jobs were filtered out on ingest it can still
        // hold events from a job that a resubmit has since replaced. Taking the tail unconditionally
        // would then hand the customer a dead job's tracking numbers.
        const updates = order.luluJobStatusUpdates;
        const latestUpdate = order.luluJobID
            // No match means the current job has not reported yet (e.g. straight after a resubmit).
            // Returning nothing is right: any entry still in the log belongs to a superseded job.
            ? updates.findLast((u) => u?.id?.toString() === order.luluJobID)
            : updates[updates.length - 1]; // pre-`luluJobID` orders have nothing to scope by
        if (!latestUpdate) return null;

        const lineItems: any[] = latestUpdate.line_items || [];

        const luluStatusToShipping = (statusName: string): "ORDER_PLACED" | "IN_PRODUCTION" | "SHIPPED" => {
            if (statusName === "SHIPPED") return "SHIPPED";
            if (statusName === "IN_PRODUCTION") return "IN_PRODUCTION";
            return "ORDER_PLACED";
        };

        const items: Record<string, { shippingStatus: "ORDER_PLACED" | "IN_PRODUCTION" | "SHIPPED"; trackingID?: string; carrierName?: string; trackingURLs: string[] }> = {};
        for (const li of lineItems) {
            const externalId = li.external_id;
            if (!externalId) continue;
            items[externalId] = {
                shippingStatus: luluStatusToShipping(li.status?.name || ""),
                trackingID: li.tracking_id || undefined,
                carrierName: li.carrier_name || undefined,
                trackingURLs: li.tracking_urls || [],
            };
        }

        return {
            estimatedShippingDates: latestUpdate.estimated_shipping_dates ?? null,
            items,
        };
    }

    public async getCheckoutSession(checkout_session_id: string) {
        try {
            const { session, charge } = await this._fetchCheckoutSession(checkout_session_id, { includeCharges: true });

            if (!session) {
                debug(`No checkout session found with ID: ${checkout_session_id}`);
                return null;
            }

            // Extract and redact only the data needed by the frontend
            const redactedSession = {
                id: session.id,
                created: session.created,
                amount_subtotal: session.amount_subtotal,
                amount_total: session.amount_total,
                total_details: {
                    amount_discount: session.total_details?.amount_discount || 0,
                    amount_shipping: session.total_details?.amount_shipping || 0,
                    amount_tax: session.total_details?.amount_tax || 0,
                },
                line_items: {
                    data: session.line_items?.data?.map(item => ({
                        id: item.id,
                        amount_total: item.amount_total,
                        price: {
                            product: {
                                name: (item.price?.product as Stripe.Product)?.name,
                                description: (item.price?.product as Stripe.Product)?.description,
                                images: (item.price?.product as Stripe.Product)?.images,
                                metadata: (item.price?.product as Stripe.Product)?.metadata,
                            }
                        }
                    })) || []
                },
                customer_details: session.customer_details ? {
                    // Redact customer name (first given name kept for recognition)
                    name: session.customer_details.name ? this._redactName(session.customer_details.name) : undefined,
                    // Redact email
                    email: session.customer_details.email ? this._redactEmail(session.customer_details.email) : undefined,
                    // Redact phone
                    phone: session.customer_details.phone ? this._redactPhoneNumber(session.customer_details.phone) : undefined,
                    address: session.customer_details.address ? {
                        // Partially redact street lines: numbers kept, street names masked
                        line1: session.customer_details.address.line1 ? this._redactStreetAddress(session.customer_details.address.line1) : undefined,
                        line2: session.customer_details.address.line2 ? this._redactStreetAddress(session.customer_details.address.line2) : undefined,
                        // Keep city, state, postal_code visible
                        city: session.customer_details.address.city,
                        state: session.customer_details.address.state,
                        postal_code: session.customer_details.address.postal_code,
                        country: session.customer_details.address.country,
                    } : undefined
                } : undefined
            };

            const redactedCharge = charge ? {
                id: charge.id,
                payment_intent: charge.payment_intent,
                payment_method_details: {
                    type: charge.payment_method_details?.type,
                    card: charge.payment_method_details?.card ? {
                        brand: charge.payment_method_details.card.brand,
                        last4: charge.payment_method_details.card.last4,
                        exp_month: charge.payment_method_details.card.exp_month,
                        exp_year: charge.payment_method_details.card.exp_year,
                    } : undefined
                }
            } : null;

            return { session: redactedSession, charge: redactedCharge };

            // return { session, charge }
        } catch (error) {
            debug("Error fetching checkout session:", error);
            throw new Error("Failed to fetch checkout session");
        }
    }

    public async createCheckoutSession({
        items,
        shipping_option,
        shipping_address,
        digital_delivery_option,
        digital_delivery_account
    }: {
        items: z.infer<typeof CreateCheckoutSessionSchema>['body']['items'];
        shipping_option: StoreShippingOption | "digital_delivery_only";
        shipping_address: z.infer<typeof CreateCheckoutSessionSchema>['body']['shipping_address'];
        digital_delivery_option?: z.infer<typeof CreateCheckoutSessionSchema>['body']['digital_delivery_option'];
        digital_delivery_account?: string | null
    }): Promise<{
        session_id: string;
        checkout_url: string;
    }> {
        try {
            const stripe = this.stripeService.getInstance();
            const customer = await this.upsertCustomer({ shipping_address });

            const createLineItems = async (): Promise<Stripe.Checkout.SessionCreateParams.LineItem[]> => {
                const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = items.map(item => {
                    return {
                        price: item.price_id,
                        quantity: item.quantity,
                    };
                });

                const separated = await this._separateProductsByCategory(items)

                if (shipping_option === 'digital_delivery_only') {
                    if (separated.books.length > 0) {
                        debug("Shipping option is 'digital_delivery_only' but book items were provided. This is not allowed.");
                        throw new Error("Shipping option is 'digital_delivery_only' but book items were provided.");
                    }

                    return lineItems
                }

                if (!shipping_option || !shipping_option.id || !shipping_option.cost_excl_tax) {
                    debug("Invalid or missing shipping option:", shipping_option);
                    throw new Error("Invalid or missing shipping option");
                }

                lineItems.push({
                    price_data: {
                        'currency': 'usd',
                        product_data: {
                            name: 'Shipping',
                            description: shipping_option.title || 'Shipping Costs',
                            metadata: {
                                is_shipping: 'true',
                                lulu_shipping_option_id: shipping_option.id,
                                lulu_shipping_option_title: shipping_option.title,
                                lulu_shipping_option_level: shipping_option.lulu_shipping_level || 'MAIL', // Default to MAIL if not found
                                lulu_shipping_option_min_days: shipping_option.total_days_min.toString(),
                                lulu_shipping_option_max_days: shipping_option.total_days_max.toString(),
                            }
                        },
                        tax_behavior: 'exclusive',
                        unit_amount: shipping_option.cost_excl_tax,
                    },
                    quantity: 1
                })

                return lineItems
            }

            const line_items = await createLineItems();
            const shipping_address_metadata = JSON.stringify(shipping_address);
            const session = await stripe.checkout.sessions.create({
                customer,
                line_items,
                mode: 'payment',
                ui_mode: 'hosted',
                billing_address_collection: 'auto',
                automatic_tax: {
                    enabled: true,
                },
                consent_collection: {
                    terms_of_service: 'required',
                },
                success_url: `${process.env.CLIENT__MAIN_COMMONS_URL ? process.env.CLIENT__MAIN_COMMONS_URL : (process.env.NODE_ENV === 'production' ? 'https://commons.libretexts.org' : `http://localhost:${process.env.CLIENT_PORT}`)}/store/checkout/success?checkout_session_id={CHECKOUT_SESSION_ID}`,
                metadata: {
                    application: 'conductor',
                    feature: 'store',
                    shipping_address: shipping_address_metadata,
                    ...(digital_delivery_option && {
                        digital_delivery_option: digital_delivery_option,
                    }),
                    ...(digital_delivery_account && {
                        digital_delivery_account: digital_delivery_account,
                    }),
                },
                payment_intent_data: {
                    receipt_email: shipping_address.email,
                },
                allow_promotion_codes: true,
            });

            return {
                session_id: session.id,
                checkout_url: session.url as string
            }
        } catch (error) {
            debug("Error creating checkout session:", error);
            throw new Error("Failed to create checkout session: " + (error instanceof Error ? error.message : "Unknown error"));
        }
    }

    public async upsertCustomer({
        shipping_address
    }: {
        shipping_address: z.infer<typeof CreateCheckoutSessionSchema>['body']['shipping_address'];
    }) {
        try {
            const stripe = this.stripeService.getInstance();
            let customerStripeID = '';

            const customerStripeData = this._shippingAddressToStripeData(shipping_address);

            const existing = await stripe.customers.list({
                email: shipping_address.email,
                limit: 1,
            });

            if (existing.data.length === 1) {
                customerStripeID = existing.data[0].id;
                await stripe.customers.update(customerStripeID, customerStripeData);
            } else {
                const newCustomer = await stripe.customers.create(customerStripeData);
                customerStripeID = newCustomer.id;
            }

            return customerStripeID;
        } catch (error) {
            debug("Error upserting customer:", error);
            throw new Error("Failed to upsert customer");
        }
    }

    public async getShippingOptions({
        items, shipping_address }: {
            items: z.infer<typeof GetShippingOptionsSchema>['body']['items'];
            shipping_address: z.infer<typeof GetShippingOptionsSchema>['body']['shipping_address'];
        }): Promise<StoreShippingOption[] | "digital_delivery_only"> {
        try {
            if (items.length === 0) {
                debug("No items provided for shipping options.");
                throw new Error("No items provided for shipping options");
            }

            const stripe = this.stripeService.getInstance();

            // Ensure all items are valid Stripe products. A cart can contain the same
            // product_id more than once (e.g. one book as hardcover and another as
            // paperback), so validate against the set of *distinct* product IDs rather
            // than the raw item count -- Stripe dedupes the `ids` filter, and a length
            // comparison would spuriously fail on any duplicated product.
            const uniqueProductIds = [...new Set(items.map(item => item.product_id))];
            const stripe_products = await stripe.products.list({
                limit: 100,
                ids: uniqueProductIds,
            });
            if (!stripe_products || !stripe_products.data || stripe_products.data.length === 0) {
                debug("No products found for the provided items.");
                throw new Error("No products found for the provided items");
            }

            const foundProductIds = new Set(stripe_products.data.map(p => p.id));
            const missingProductIds = uniqueProductIds.filter(id => !foundProductIds.has(id));
            if (missingProductIds.length > 0) {
                debug(`One or more items are not valid Stripe products: ${missingProductIds.join(', ')}`);
                throw new Error("One or more items are not valid Stripe products");
            }

            // Check if all items are digital products
            const allDigital = items.every(item => {
                const product = stripe_products.data.find(p => p.id === item.product_id);
                return product && product.metadata && product.metadata.digital === 'true';
            });

            if (allDigital) {
                return "digital_delivery_only";
            }

            // Calculate estimated shipping costs from Lulu. Iterate over items (not the
            // deduped product list) so that multiple variants of the same product -- e.g.
            // hardcover and paperback of one book -- are each priced and counted.
            const luluShippingLineItems: LuluShippingLineItem[] = [];
            for (const item of items) {
                const product = stripe_products.data.find(p => p.id === item.product_id);
                if (!product || !item.price_id) {
                    debug(`Item with product ID ${item.product_id} does not have a valid price_id.`);
                    continue;
                }

                const price = await stripe.prices.retrieve(item.price_id, {
                    expand: ['product'],
                });

                if (!price || !price.product || typeof price.product === 'string') {
                    debug(`Price for product ID ${item.product_id} is not valid.`);
                    continue;
                }

                if (product.metadata && product.metadata.num_pages) {
                    luluShippingLineItems.push({
                        quantity: item.quantity,
                        pod_package_id: this.luluService.getPodPackageID({
                            hardcover: price.metadata.hardcover === 'true',
                            color: price.metadata.color === 'true',
                        }),
                        page_count: parseInt(product.metadata.num_pages, 10),
                    });
                }
            }

            if (luluShippingLineItems.length === 0) {
                debug("No valid items found for shipping options.");
                throw new Error("No valid items found for shipping options");
            }

            const shipping_options = await this.luluService.getShippingOptions({
                line_items: luluShippingLineItems,
                shipping_address: {
                    city: shipping_address.city,
                    country: shipping_address.country,
                    postcode: shipping_address.postal_code,
                    state_code: shipping_address.state,
                    street_address: shipping_address.address_line_1,
                }
            });

            const filtered_shipping_options = shipping_options.filter(opt => {
                if (!opt.cost_excl_tax) return false;
                if (opt.business_only || opt.home_only) return false;
                if (opt.carrier_service_name && opt.carrier_service_name.toLowerCase().includes('overnight')) return false; // Exclude overnight options
                return true;
            });

            if (!filtered_shipping_options || filtered_shipping_options.length === 0) {
                debug("No shipping options found for the provided items.");
                throw new Error("No shipping options found for the provided items");
            }

            const shippingLevelDeliveryDays: Record<string, { min: number; max: number }> = {
                'MAIL': { min: 13, max: 15 },
                'PRIORITY_MAIL': { min: 11, max: 13 },
                'GROUND_HD': { min: 12, max: 14 },
                'GROUND_BUS': { min: 12, max: 14 },
                'GROUND': { min: 12, max: 14 },
                'EXPEDITED': { min: 8, max: 9 },
                'EXPRESS': { min: 9, max: 10 },
            };

            // Get today's date (order date)
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            // Helper function to add business days (excluding weekends)
            const addBusinessDays = (date: Date, days: number): Date => {
                const result = new Date(date);
                let added = 0;
                while (added < days) {
                    result.setDate(result.getDate() + 1);
                    // Skip weekends (Saturday = 6, Sunday = 0)
                    if (result.getDay() !== 0 && result.getDay() !== 6) {
                        added++;
                    }
                }
                return result;
            };

            // Helper function to format date as ISO string
            const formatDate = (date: Date): string => {
                return date.toISOString().split('T')[0];
            };

            const mapped = filtered_shipping_options.map((opt) => {
                // ensure cost_excl_tax is a number and convert it to cents
                if (!opt.cost_excl_tax || isNaN(parseFloat(opt.cost_excl_tax))) {
                    debug("Invalid cost_excl_tax for shipping option:", opt);
                    return null; // Skip invalid options
                }
                const costInCents = Math.round(parseFloat(opt.cost_excl_tax) * 100);

                // Get delivery days for this shipping level (fallback to MAIL if not found)
                const shippingLevel = opt.level || 'MAIL';
                const deliveryDays = shippingLevelDeliveryDays[shippingLevel] || shippingLevelDeliveryDays['MAIL'];

                // Calculate date estimates
                const productionStartDate = addBusinessDays(today, 2);
                const productionEndDate = addBusinessDays(today, 4);
                const shipDateStart = addBusinessDays(today, 6);
                const shipDateEnd = addBusinessDays(today, 10);
                const deliveryDateStart = addBusinessDays(today, deliveryDays.min);
                const deliveryDateEnd = addBusinessDays(today, deliveryDays.max);

                return {
                    id: opt.id,
                    title: `${opt.level}${opt.carrier_service_name ? ` (${opt.carrier_service_name})` : ''}`,
                    total_days_min: opt.total_days_min,
                    total_days_max: opt.total_days_max,
                    lulu_shipping_level: opt.level,
                    cost_excl_tax: costInCents,
                    production_start_date_estimate: formatDate(productionStartDate),
                    production_end_date_estimate: formatDate(productionEndDate),
                    ship_date_start_estimate: formatDate(shipDateStart),
                    ship_date_end_estimate: formatDate(shipDateEnd),
                    delivery_date_start_estimate: formatDate(deliveryDateStart),
                    delivery_date_end_estimate: formatDate(deliveryDateEnd),
                }
            });

            // Sort options by cost_excl_tax first, then by total_days_min
            mapped.sort((a, b) => {
                if (!a) return 1; // Place nulls at the end
                if (!b) return -1;
                if (a.cost_excl_tax === null || b.cost_excl_tax === null) {
                    return a.cost_excl_tax === null ? 1 : -1; // Place null costs at the end
                }
                if (a.cost_excl_tax === b.cost_excl_tax) {
                    // If costs are equal, sort by total_days_min
                    return a.total_days_min - b.total_days_min;
                }
                return a.cost_excl_tax - b.cost_excl_tax;
            });

            return mapped.filter(opt => opt !== null);
        } catch (error) {
            debug("Error fetching shipping options:", error);
            throw new Error("Failed to fetch shipping options");
        }
    }

    public async processOrder({
        checkout_session,
    }: {
        checkout_session: Stripe.Checkout.Session;
    }): Promise<RawStoreOrder> {
        try {
            // Immediately create a StoreOrder record so we can track processing errors
            const storeOrder = await StoreOrder.create({
                id: checkout_session.id, // Id has unique constraint, so this will fail if the order already exists
                status: "pending",
                error: "",
            });

            try {
                if (!checkout_session || !checkout_session.id) {
                    throw new Error("Invalid checkout session provided.");
                }

                // Get and save customer's email addr for order
                const email = checkout_session.customer_details?.email || checkout_session.customer_email;
                if (!email) {
                    throw new Error("MISSING_EMAIL");
                }
                storeOrder.customerEmail = email;
                // Mirror the order total from Stripe so the admin list never needs a live Stripe call.
                storeOrder.amountTotal = checkout_session.amount_total ?? undefined;
                storeOrder.currency = checkout_session.currency ?? undefined;
                await storeOrder.save(); // Save the email/amount to the order now in case processing fails later

                const lineItems = this._parseLineItemsFromCheckoutSession(checkout_session);
                if (!lineItems || lineItems.length === 0) {
                    throw new Error("NO_LINE_ITEMS");
                }

                if (lineItems.length >= 100) {
                    throw new Error("TOO_MANY_LINE_ITEMS");
                }

                const { books: bookItems, digital: digitalItems, shipping: shippingItem } = await this._separateProductsByCategory(lineItems);

                // Handle book items
                if (bookItems.length > 0) {
                    // If book items are present, ensure a shipping item was found
                    if (!shippingItem) {
                        throw new Error("MISSING_SHIPPING_ITEM");
                    }

                    const luluLineItems = this.luluService.buildPrintJobLineItems(bookItems);
                    const printJob = await this.luluService.createPrintJob({
                        external_id: storeOrder.id,
                        shipping_address: {
                            name: checkout_session.customer_details?.name || '',
                            street1: checkout_session.customer_details?.address?.line1 || '',
                            street2: checkout_session.customer_details?.address?.line2 || '',
                            city: checkout_session.customer_details?.address?.city || '',
                            state_code: checkout_session.customer_details?.address?.state || '',
                            postcode: checkout_session.customer_details?.address?.postal_code || '',
                            country_code: checkout_session.customer_details?.address?.country || '',
                            phone_number: checkout_session.customer_details?.phone || '',
                            email: email || '', // Will default to the contact email on Lulu account if not provided
                            is_business: false,
                        },
                        line_items: luluLineItems,
                        shipping_level: shippingItem.product.metadata['lulu_shipping_option_level'] as LuluShippingLevel || 'MAIL',
                    })

                    if (!printJob || !printJob.id) {
                        throw new Error("LULU_PRINT_JOB_CREATE_FAILED");
                    }

                    // Update our local StoreOrder record
                    storeOrder.luluJobID = printJob.id.toString();
                    storeOrder.luluJobStatus = printJob.status["name"] || "unknown";
                    await storeOrder.save();
                }

                if (digitalItems.length > 0) {
                    const digital_delivery_account = checkout_session.metadata?.['digital_delivery_account'] || '';
                    const digital_delivery_option = checkout_session.metadata?.['digital_delivery_option'] || 'email_access_codes'; // Default to email access codes if not specified
                    if (digital_delivery_option !== 'apply_to_account' && digital_delivery_option !== 'email_access_codes') {
                        throw new Error("INVALID_DIGITAL_DELIVERY_OPTION");
                    }
                    if (digital_delivery_option === 'apply_to_account' && !digital_delivery_account) {
                        throw new Error("Digital delivery account must be provided when digital delivery option is 'apply_to_account'.");
                    }

                    await this._processDigitalItems({
                        items: digitalItems,
                        email,
                        digital_delivery_account,
                        digital_delivery_option
                    });

                    if (bookItems.length === 0) {
                        storeOrder.status = 'completed'; // If only digital items, mark as completed
                        await storeOrder.save();
                    }
                }

                if (checkout_session.customer_details?.email) { // Customer email should always be present, but just in case
                    await mailAPI.sendStoreOrderConfirmation(checkout_session.customer_details?.email, checkout_session.id)
                }

                // Best-effort: mirror the finished order into the search index. Fire-and-forget so a
                // Meilisearch hiccup can never affect order processing.
                void upsertStoreOrderToSearchIndex(storeOrder.id);
                return storeOrder;
            } catch (error: any) {
                await this._failStoreOrder(storeOrder, error.toString());
                return storeOrder;
            }
        } catch (error: any) {
            // If error is mongodb duplicate key error, it means the order already exists and we likely just received the webhook multiple times
            if (error.code === 11000) {
                debug(`StoreOrder with ID ${checkout_session.id} already exists. This is likely a duplicate webhook event.`);
                const existingOrder = await StoreOrder.findOne({ id: checkout_session.id });
                if (existingOrder) {
                    return existingOrder;
                }
            }
            throw new Error("Fatal error during order processing: " + error);
        }
    }


    public async processLuluOrderUpdate({ data }: { data: LuluWebhookData['data'] }) {
        try {
            const checkout_session_id = data.external_id;
            if (!checkout_session_id) {
                debug("No external_id found in Lulu webhook data.");
                return;
            }

            const storeOrder = await StoreOrder.findOne({
                id: { $eq: checkout_session_id },
            });

            if (!storeOrder) {
                debug(`No StoreOrder found with id: ${checkout_session_id}`);
                return;
            }

            // `id` is unguarded elsewhere in this method's history; a payload without it used to throw
            // into the swallow-all catch below and silently drop the entire update.
            const incomingJobID = data.id?.toString();
            if (!incomingJobID) {
                debug(`Lulu webhook for order ${storeOrder.id} has no job id; ignoring.`);
                return;
            }

            // A resubmit creates a NEW Lulu job, but the superseded job can still emit webhooks.
            // Since this method joins on `external_id` alone, a late REJECTED/ERROR from the old job
            // would otherwise overwrite the good job's ID and status and re-break a just-fixed order.
            // Lulu job IDs increase monotonically, so a lower ID means the event is stale. Fail open
            // when either ID isn't numeric: dropping real updates is worse than applying an odd one.
            const incomingJobNumber = Number(incomingJobID);
            const currentJobNumber = Number(storeOrder.luluJobID);
            if (
                storeOrder.luluJobID &&
                storeOrder.luluJobID !== incomingJobID &&
                Number.isFinite(incomingJobNumber) &&
                Number.isFinite(currentJobNumber) &&
                incomingJobNumber < currentJobNumber
            ) {
                debug(`Ignoring stale Lulu webhook for job ${incomingJobID}; order ${storeOrder.id} is on job ${storeOrder.luluJobID}.`);
                // Kept for forensics, but held apart from `luluJobStatusUpdates`: that log is what
                // `getShippingData` reads, so a superseded job must never be able to land in it.
                storeOrder.ignoredLuluJobStatusUpdates = [...(storeOrder.ignoredLuluJobStatusUpdates || []), data];
                await storeOrder.save();
                return;
            }

            const incomingStatus = data.status?.name;

            // Lulu emits a job's status changes in order, but does NOT guarantee ordered DELIVERY:
            // a retried or delayed event can land after one that superseded it. When the incoming
            // event belongs to the job already on file AND that job's last recorded status was a
            // failure, a healthy event from it describes something that happened BEFORE the
            // failure — it is a redelivery, never a recovery. Without this, a retried IN_PRODUCTION
            // arriving after an ERROR would clear a real failure and close its ticket. Recovery is
            // therefore only ever driven by a different (newer) job, or by a job whose own last
            // status was healthy (the `_failStoreOrder` case, where the order failed for a reason
            // outside the print job).
            const isRedeliveryOfSupersededEvent = !!incomingStatus
                && LULU_HEALTHY_STATUSES.has(incomingStatus)
                && storeOrder.luluJobID === incomingJobID
                && !!storeOrder.luluJobStatus
                && LULU_FAILURE_STATUSES.has(storeOrder.luluJobStatus);

            if (isRedeliveryOfSupersededEvent) {
                debug(`Ignoring out-of-order Lulu webhook (${incomingStatus}) for job ${incomingJobID}; order ${storeOrder.id} already recorded ${storeOrder.luluJobStatus} for it.`);
                // Same reasoning as the stale-job branch above: visible for forensics, but out of
                // the log that feeds order and shipping state. Job-id scoping alone would not save
                // us here — a redelivery carries the CURRENT job's id.
                storeOrder.ignoredLuluJobStatusUpdates = [...(storeOrder.ignoredLuluJobStatusUpdates || []), data];
                await storeOrder.save();
                return;
            }

            // Captured before any mutation: it drives the recovery branch below.
            const wasFailed = storeOrder.status === 'failed';

            const customerEmail = storeOrder.customerEmail || await this.stripeService.getCustomerEmailFromCheckoutSession(storeOrder.id);

            // If the order is now in production and we haven't sent a notification yet, send one
            if (customerEmail && incomingStatus === 'IN_PRODUCTION' && !storeOrder.notificationsSent?.some((n) => n.status === 'IN_PRODUCTION')) {
                await mailAPI.sendStoreOrderInProductionUpdate(customerEmail, storeOrder.id).catch((err) => {
                    debug("Failed to send store order in production update email:", err);
                });
                storeOrder.notificationsSent = [...(storeOrder.notificationsSent || []), { status: 'IN_PRODUCTION' }];
            }

            // If the order has shipped, gather tracking notifications before the status write below.
            if (incomingStatus === 'SHIPPED' && customerEmail) {
                const notificationsSent = await this._processShippingUpdates(storeOrder, data, customerEmail);
                storeOrder.notificationsSent = [...(storeOrder.notificationsSent || []), ...notificationsSent];
            }

            // Keep `status`/`error` in sync with the live print job in BOTH directions. Previously
            // they were write-once: only `_failStoreOrder` set 'failed' and nothing ever cleared it,
            // so a successfully resubmitted order stayed 'failed' until an admin edited MongoDB.
            // An unrecognized status falls into neither set and deliberately leaves them untouched,
            // so a status Lulu adds later can never silently fail or un-fail an order.
            const recovered = wasFailed && !!incomingStatus && LULU_HEALTHY_STATUSES.has(incomingStatus);

            if (incomingStatus && LULU_FAILURE_STATUSES.has(incomingStatus)) {
                storeOrder.status = 'failed';
                storeOrder.error = data.status?.message || `Lulu print job ${incomingStatus}`;

                // A rejected, errored, or canceled print job needs manual resolution; open a ticket.
                await this._createOrderFailureTicket(storeOrder, {
                    trigger: incomingStatus === 'REJECTED' ? "lulu_rejected" : "lulu_error",
                    message: data.status?.message || '',
                });
            } else if (incomingStatus && LULU_HEALTHY_STATUSES.has(incomingStatus)) {
                if (incomingStatus === 'SHIPPED') {
                    storeOrder.status = 'completed';
                } else if (wasFailed) {
                    storeOrder.status = 'pending';
                }

                if (recovered) {
                    storeOrder.error = "";
                    // `supportTicketUUID` is deliberately left in place here: it is only detached
                    // once the ticket service confirms the close, in `_resolveOrderFailureTicket`.
                }
            }

            storeOrder.luluJobID = incomingJobID; // Update the Lulu job ID (e.g. on resubmits)
            storeOrder.luluJobStatus = incomingStatus || "unknown";
            storeOrder.luluJobStatusMessage = data.status?.message || "";
            storeOrder.luluJobStatusUpdates = [...(storeOrder.luluJobStatusUpdates || []), data];
            await storeOrder.save();

            // After the save so ticket I/O never sits on the order write path. Re-reads the order
            // rather than trusting the in-memory copy, because `_createOrderFailureTicket` attaches
            // the UUID with its own `updateOne`.
            if (recovered) {
                await this._resolveOrderFailureTicket(storeOrder.id);
            }

            // Best-effort: keep the search index in step with the new Lulu status (fire-and-forget).
            void upsertStoreOrderToSearchIndex(storeOrder.id);
        } catch (error) {
            debug("Error processing Lulu order update:", error);
        }
    }

    /**
     * Rebuilds the Lulu print job payload for an existing order from its Stripe checkout session.
     *
     * This is deliberately BEST-EFFORT rather than fail-fast: the situations that most often need
     * a manual print job submission (missing shipping line item, a book product whose Stripe
     * metadata is wrong, an unreachable session) are exactly the ones a strict builder would
     * refuse to produce anything for. Instead of bailing, each gap becomes a warning plus a safe
     * default, so an admin can fill it in by hand in the editor.
     *
     * `external_id` is always the StoreOrder id (the Stripe checkout session id) — it is what lets
     * the Lulu `PRINT_JOB_STATUS_CHANGED` webhook reattach the resulting job to this order, so it
     * is never sourced from anywhere else.
     *
     * Returns `null` only when the order itself does not exist.
     */
    public async buildPrintJobParams(orderId: string): Promise<{
        params: Omit<LuluPrintJobParams, 'contact_email' | 'production_delay'>;
        warnings: string[];
    } | null> {
        const store_order = await StoreOrder.findOne({ id: { $eq: orderId } });
        if (!store_order) {
            debug(`No StoreOrder found for ID: ${orderId}`);
            return null;
        }

        const warnings: string[] = [];

        // Skip the session cache: this payload is often rebuilt immediately after an admin has
        // corrected data in Stripe, and serving them an hour-old session would defeat the point.
        const { session } = await this._fetchCheckoutSession(store_order.id, { skipCache: true });
        if (!session || !session.id) {
            warnings.push("The Stripe checkout session could not be fetched. The shipping address is a blank template and must be filled in manually.");
        }

        const lineItems = session ? this._parseLineItemsFromCheckoutSession(session) : [];
        if (session && lineItems.length === 0) {
            warnings.push("No line items were found on the Stripe checkout session. Line items must be entered manually.");
        }

        let books: ResolvedProduct[] = [];
        let shipping: ResolvedProduct | null = null;
        if (lineItems.length > 0) {
            try {
                const separated = await this._separateProductsByCategory(lineItems);
                books = separated.books;
                shipping = separated.shipping;
            } catch (error) {
                warnings.push(`The Stripe line items could not be resolved (${serializeError(error)}). Line items must be entered manually.`);
            }
        }

        if (books.length === 0) {
            warnings.push("No book line items resolved from the Stripe checkout session. `line_items` is empty and must be filled in manually.");
        }

        for (const book of books) {
            if (!book.product.metadata['book_id']) {
                warnings.push(`Product "${book.product.name}" has no \`book_id\` metadata in Stripe, so its cover/interior source URLs are malformed. Correct them before submitting.`);
            }
        }

        if (!shipping) {
            warnings.push("No shipping line item was found on the Stripe checkout session. `shipping_level` has been defaulted to MAIL.");
        }

        return {
            params: {
                external_id: store_order.id,
                shipping_address: {
                    name: session?.customer_details?.name || '',
                    street1: session?.customer_details?.address?.line1 || '',
                    street2: session?.customer_details?.address?.line2 || '',
                    city: session?.customer_details?.address?.city || '',
                    state_code: session?.customer_details?.address?.state || '',
                    postcode: session?.customer_details?.address?.postal_code || '',
                    country_code: session?.customer_details?.address?.country || '',
                    phone_number: session?.customer_details?.phone || '',
                    email: session?.customer_details?.email || store_order.customerEmail || '', // Will default to the contact email on Lulu account if not provided
                    is_business: false,
                },
                line_items: this.luluService.buildPrintJobLineItems(books),
                shipping_level: shipping?.product.metadata['lulu_shipping_option_level'] as LuluShippingLevel || 'MAIL',
            },
            warnings,
        };
    }

    public async resubmitLuluJob(orderId: string): Promise<LuluPrintJob | {
        error: string;
        detail?: string;
    }> {
        try {
            const built = await this.buildPrintJobParams(orderId);
            if (!built) {
                return { error: `No StoreOrder found for ID: ${orderId}` };
            }

            // A plain resubmit sends the derived payload verbatim, so it is only meaningful when the
            // payload is complete. Any warning from the builder means it is not — surface it rather
            // than pushing a knowingly-broken payload back to Lulu. Use "Submit Order Details
            // Manually" to fix the payload by hand.
            if (built.warnings.length > 0) {
                debug(`Cannot resubmit Lulu job for StoreOrder ID: ${orderId}. ${built.warnings.join(' ')}`);
                return {
                    error: `Cannot resubmit the print job for order ${orderId} as-is`,
                    detail: built.warnings.join(' '),
                };
            }

            const printJob = await this.luluService.createPrintJob(built.params);

            if (!printJob || !printJob.id) {
                debug(`Failed to create Lulu print job for StoreOrder ID: ${orderId}`);
                return { error: `Failed to create Lulu print job for StoreOrder ID: ${orderId} with an internal error` };
            }

            await this._recordLuluJobOnOrder(orderId, printJob);
            return printJob;
        } catch (error) {
            debug("Error retrying Lulu job:", error);
            const errorString = serializeError(error);
            return { error: "Failed to retry Lulu job", detail: errorString };
        }
    }

    /**
     * Submits a hand-edited Lulu print job payload for an existing order.
     *
     * `external_id` is forced to the StoreOrder id here regardless of what arrived on the wire, so
     * the Lulu webhook always reattaches the resulting job to the correct order. `contact_email`
     * and `production_delay` are likewise forced inside `LuluService.createPrintJob`.
     *
     * Every attempt — successful or not — is appended to `manualPrintJobSubmissions` for audit.
     */
    public async submitManualPrintJob({ orderId, params, submittedBy }: {
        orderId: string;
        params: Omit<LuluPrintJobParams, 'contact_email' | 'production_delay' | 'external_id'>;
        submittedBy: string;
    }): Promise<LuluPrintJob | {
        error: string;
        detail?: string;
    }> {
        const store_order = await StoreOrder.findOne({ id: { $eq: orderId } });
        if (!store_order) {
            debug(`No StoreOrder found for ID: ${orderId}`);
            return { error: `No StoreOrder found for ID: ${orderId}` };
        }

        // external_id is server-owned: never trust the submitted body for it.
        const finalParams = { ...params, external_id: store_order.id };

        try {
            const printJob = await this.luluService.createPrintJob(finalParams);

            if (!printJob || !printJob.id) {
                debug(`Failed to create manual Lulu print job for StoreOrder ID: ${orderId}`);
                await this._recordManualPrintJobSubmission(orderId, {
                    submittedBy,
                    submittedAt: new Date(),
                    payload: finalParams,
                    success: false,
                    error: "Lulu returned no print job",
                });
                return { error: `Failed to create Lulu print job for StoreOrder ID: ${orderId} with an internal error` };
            }

            await this._recordLuluJobOnOrder(orderId, printJob);
            await this._recordManualPrintJobSubmission(orderId, {
                submittedBy,
                submittedAt: new Date(),
                payload: finalParams,
                luluJobID: printJob.id.toString(),
                success: true,
            });

            return printJob;
        } catch (error) {
            debug("Error submitting manual Lulu job:", error);
            const errorString = serializeError(error);
            await this._recordManualPrintJobSubmission(orderId, {
                submittedBy,
                submittedAt: new Date(),
                payload: finalParams,
                success: false,
                error: errorString,
            });
            return { error: "Failed to submit manual Lulu print job", detail: errorString };
        }
    }

    /**
     * Persists an accepted Lulu print job onto the order and mirrors it into the search index.
     * Shared by the plain resubmit and the manual submission paths.
     */
    private async _recordLuluJobOnOrder(orderId: string, printJob: LuluPrintJob): Promise<void> {
        await StoreOrder.updateOne({ id: { $eq: orderId } }, {
            luluJobID: printJob.id.toString(),
            luluJobStatus: printJob.status["name"] || "unknown",
            luluJobStatusMessage: printJob.status["message"] || "",
        });

        // Lulu accepted a new job, so any recorded failure is now stale. Because both the plain
        // resubmit and the manual submission funnel through here, this one call clears the stuck
        // 'failed' status for both without waiting on Lulu's next webhook.
        await this._clearOrderFailureIfFailed(orderId);

        // Best-effort: reflect the new Lulu job in the search index (fire-and-forget).
        void upsertStoreOrderToSearchIndex(orderId);
    }

    /**
     * Clears a recorded failure from an order that has recovered, and resolves its support ticket.
     *
     * The `status: "failed"` term in the filter does the real work: it makes the update a no-op for
     * an order that isn't failed (so a manual resubmit of an already-`completed` order can never be
     * knocked back to `pending`), and it makes concurrent callers race safely — only one update can
     * match the transition.
     */
    private async _clearOrderFailureIfFailed(orderId: string): Promise<void> {
        try {
            const previous = await StoreOrder.findOneAndUpdate(
                { id: { $eq: orderId }, status: "failed" },
                { $set: { status: "pending", error: "" } },
                { new: false },
            );

            // Best-effort: reflect the recovered status in the search index (fire-and-forget).
            if (previous) void upsertStoreOrderToSearchIndex(orderId);
        } catch (error) {
            debug(`Failed to clear failure state on store order ${orderId}:`, error);
        }

        // Outside the try, and deliberately not gated on this call having been the one to clear the
        // status: if an earlier recovery cleared the order but could not reach the ticket service,
        // the UUID is still attached and this is what retries the close.
        await this._resolveOrderFailureTicket(orderId);
    }

    /**
     * Closes and detaches the system-generated failure ticket of an order that is no longer failed.
     *
     * The UUID is unset only once the ticket service confirms the close. A transient ticket-service
     * or database error therefore leaves the reference on the order, where the next recovery attempt
     * (another resubmit, or the next healthy webhook) retries it — rather than orphaning an open
     * ticket that nothing points at.
     *
     * The `status: { $ne: "failed" }` term makes this a no-op for an order that has failed again in
     * the meantime: that ticket is live and must stay open.
     */
    private async _resolveOrderFailureTicket(orderId: string): Promise<void> {
        try {
            const order = await StoreOrder.findOne({ id: { $eq: orderId }, status: { $ne: "failed" } });
            if (!order?.supportTicketUUID) return;

            const closed = await this._closeOrderFailureTicket(order.supportTicketUUID, orderId);
            if (!closed) return; // reference retained on purpose so a later attempt can retry

            // Detaching lifts the "one ticket per order, ever" dedupe in `_createOrderFailureTicket`,
            // so a later genuine failure opens a fresh ticket. Matching on the same UUID means a
            // ticket opened by a concurrent failure is never detached by this write.
            await StoreOrder.updateOne(
                { id: { $eq: orderId }, supportTicketUUID: { $eq: order.supportTicketUUID } },
                { $unset: { supportTicketUUID: "" } },
            );
        } catch (error) {
            debug(`Failed to resolve support ticket for store order ${orderId}:`, error);
        }
    }

    /**
     * Closes the system-generated failure ticket for an order that has recovered. Fully defensive:
     * `changeTicketStatus` uses `.orFail()`, and a deleted or already-closed ticket must never
     * disrupt order processing.
     *
     * Returns whether the close is known to have succeeded — callers use that to decide whether the
     * order may stop tracking the ticket.
     */
    private async _closeOrderFailureTicket(ticketUUID: string, orderId: string): Promise<boolean> {
        try {
            await this.ticketService.changeTicketStatus({
                uuid: ticketUUID,
                status: "closed",
                callingUserName: "Conductor (automated)",
            });
            return true;
        } catch (error) {
            // `changeTicketStatus` closes with `updateOne(...).orFail()`, so a ticket that no longer
            // exists surfaces as DocumentNotFoundError. That is permanent, not transient: reporting
            // it as unresolved would make the order retry forever and keep the dedupe in
            // `_createOrderFailureTicket` wedged, so treat it as nothing left to close.
            if ((error as { name?: string })?.name === "DocumentNotFoundError") {
                debug(`Support ticket ${ticketUUID} for store order ${orderId} no longer exists; treating as closed.`);
                return true;
            }
            debug(`Failed to close support ticket ${ticketUUID} for store order ${orderId}:`, error);
            return false;
        }
    }

    /**
     * Appends a manual submission audit entry. Best-effort: a failure to write the audit trail is
     * logged and swallowed so it can never mask the outcome of the submission itself.
     */
    private async _recordManualPrintJobSubmission(orderId: string, entry: RawManualPrintJobSubmission): Promise<void> {
        try {
            await StoreOrder.updateOne(
                { id: { $eq: orderId } },
                { $push: { manualPrintJobSubmissions: entry } },
            );
        } catch (error) {
            debug("Failed to record manual print job submission:", error);
        }
    }

    public async adminGetStoreOrders(params: z.infer<typeof AdminGetStoreOrdersSchema>['query']): Promise<{
        items: StoreOrderListItem[];
        meta: {
            total_count: number;
            has_more: boolean;
            next_page: string | null;
        };
    }> {
        try {
            const limit = params?.limit ? parseInt(params.limit.toString(), 10) : 25;
            // `starting_after` carries the Meilisearch offset for the next page (as a string).
            const offset = params?.starting_after ? Math.max(parseInt(params.starting_after, 10) || 0, 0) : 0;
            const query = params?.query?.trim() || "";

            // Retain the two existing filters, translated to the storeOrders index attributes.
            const filters: FilterObject = {};
            if (params?.status) filters.status = params.status;
            if (params?.lulu_status) filters.luluJobStatus = params.lulu_status;
            const hasFilters = Object.keys(filters).length > 0;

            const searchService = await SearchService.getInstance();
            const result: any = await searchService.search(
                "storeOrders",
                query,
                hasFilters ? filters : undefined,
                // With a text query, let Meilisearch rank by relevance; otherwise show newest first.
                query ? undefined : [{ field: "createdAtTimestamp", order: "desc" }],
                { offset, limit },
            );

            const items: StoreOrderListItem[] = result?.hits || [];
            const total_count = result?.estimatedTotalHits ?? items.length;
            const nextOffset = offset + items.length;
            const has_more = nextOffset < total_count;

            return {
                items,
                meta: {
                    total_count,
                    has_more,
                    next_page: has_more ? nextOffset.toString() : null,
                },
            };
        } catch (error) {
            debug("Error fetching store orders:", error);
            throw new Error("Failed to fetch store orders");
        }
    }

    public async adminGetStoreOrder(orderId: string): Promise<StoreOrderWithStripeSession | null> {
        try {
            const order = await StoreOrder.findOne({ id: orderId }).sort({ _id: -1 });
            if (!order) {
                return null;
            }

            const withSession: StoreOrderWithStripeSession = { ...order.toObject(), stripe_session: null };
            const { session, charge } = await this._fetchCheckoutSession(order.id);
            if (session) {
                withSession.stripe_session = session;
            }
            if (charge) {
                withSession.stripe_charge = charge;
            }

            return withSession;
        } catch (error) {
            debug("Error fetching store order:", error);
            throw new Error("Failed to fetch store order");
        }
    }

    public async syncBooksToStripe(): Promise<{
        sync_count: number;
        failed_count: number;
    } | undefined> {
        try {
            let sync_count = 0;
            let failed_count = 0;
            const stripe = this.stripeService.getInstance();

            const alllibraries = await getLibraryNameKeys(false, false);
            if (!alllibraries || alllibraries.length === 0) {
                debug("No libraries found to sync books.");
                return undefined;
            }

            for (const library of alllibraries) {
                const bookshelf = await axios.get(`https://api.libretexts.org/DownloadsCenter/${library}/Bookshelves.json`).catch((err) => {
                    debug(`Error fetching bookshelf for library ${library}:`, err);
                    return null;
                });
                const courses = await axios.get(`https://api.libretexts.org/DownloadsCenter/${library}/Courses.json`).catch((err) => {
                    debug(`Error fetching courses for library ${library}:`, err);
                    return null;
                });

                if ((!bookshelf || !bookshelf.data) && (!courses || !courses.data)) {
                    debug(`No books or courses found for library: ${library}`);
                    continue;
                }

                const allItems = new Set<DownloadCenterItem>();
                if (bookshelf && bookshelf.data && bookshelf.data.items) {
                    for (const item of bookshelf.data.items) {
                        allItems.add(item);
                    }
                }

                if (courses && courses.data && courses.data.items) {
                    for (const item of courses.data.items) {
                        allItems.add(item);
                    }
                }

                // filter out any malformed items (e.g. missing id or title
                for (const item of Array.from(allItems)) {
                    if (!item.id || !item.title) {
                        debug(`Skipping malformed item in library ${library}:`, item);
                        allItems.delete(item);
                    }
                    if (item.failed === true) {
                        debug(`Skipping failed item in library ${library}:`, item);
                        allItems.delete(item);
                    }
                }

                for (const book of Array.from(allItems)) {
                    try {
                        // add a slight delay to avoid hitting API rate limits
                        await new Promise(resolve => setTimeout(resolve, 100));

                        // Check if the book already exists in Stripe as a product
                        const existingProducts = await stripe.products.search({
                            query: `metadata["book_id"]:"${library}-${book.id}"`,
                            limit: 1,
                        });

                        let product: Stripe.Product | null = null;
                        const thumbnailUrl = this.getBookThumbnailUrl({ library, id: book.id });

                        let bookLicense = "";
                        if (Array.isArray(book.tags)) {
                            const licenseTag = book.tags.find((tag) => tag.includes("license:"));
                            if (licenseTag) {
                                bookLicense = licenseTag.replace("license:", "");
                            }
                        }

                        if (existingProducts.data.length > 0) {
                            // If the product exists, update it
                            product = existingProducts.data[0];
                            await stripe.products.update(product.id, {
                                name: book.title,
                                description: book.summary || "No description available",
                                images: [thumbnailUrl],
                                metadata: {
                                    bookID: `${library}-${book.id}`,
                                    store: "true",
                                    store_category: "books",
                                    book_author: book.author || "Anonymous",
                                    book_institution: book.institution || "",
                                    num_pages: book.numPages.toString(),
                                    license: bookLicense,
                                }
                            });
                        } else {
                            // If the product does not exist, create it
                            product = await stripe.products.create({
                                name: book.title,
                                description: book.summary || "No description available",
                                images: [thumbnailUrl],
                                metadata: {
                                    book_id: `${library}-${book.id}`,
                                    store: "true",
                                    store_category: "books",
                                    book_author: book.author || "Anonymous",
                                    book_institution: book.institution || "",
                                    num_pages: book.numPages.toString(),
                                    license: bookLicense,
                                }
                            });
                        }

                        const priceOptions = this.calculateBookPrices({ num_pages: book.numPages });
                        const existingPrices = await stripe.prices.list({
                            product: product.id,
                            active: true,
                        });

                        for (const option of priceOptions.options) {
                            const existingPrice = existingPrices.data.find((p) => {
                                return p.metadata["hardcover"] === String(option.hardcover) &&
                                    p.metadata["color"] === String(option.color);
                            })

                            if (existingPrice) {
                                // if the price already exists and is the same currency and amount, update it
                                // otherwise, we must delete it and create a new one
                                if (existingPrice.unit_amount === option.price && existingPrice.currency === 'usd') {
                                    await stripe.prices.update(existingPrice.id, {
                                        tax_behavior: 'exclusive',
                                        nickname: this._buildBookPriceNickname({
                                            hardcover: option.hardcover,
                                            color: option.color,
                                        }),
                                        metadata: {
                                            ...existingPrice.metadata,
                                            store: "true",
                                            store_category: "books",
                                        }
                                    });
                                    continue;
                                }

                                await stripe.prices.update(existingPrice.id, { active: false }); // Archive the existing price
                                debug(`Archived existing price ${existingPrice.id} for ${product.name} with hardcover=${option.hardcover} and color=${option.color}.`);
                                // Proceed to create a new price
                            }

                            // Create new price
                            const newPrice = await stripe.prices.create({
                                product: product.id,
                                unit_amount: option.price,
                                currency: 'usd',
                                tax_behavior: 'exclusive',
                                nickname: this._buildBookPriceNickname({
                                    hardcover: option.hardcover,
                                    color: option.color
                                }),
                                metadata: {
                                    store: "true",
                                    store_category: "books",
                                    book_id: `${library}-${book.id}`,
                                    bookstore: "true",
                                    hardcover: String(option.hardcover),
                                    color: String(option.color),
                                }
                            });
                            debug(`Created new price ${newPrice.id} for ${product.name} with hardcover=${option.hardcover} and color=${option.color}: ${option.formatted_price}`);
                        }

                        sync_count++;
                    } catch (error) {
                        failed_count++;
                        debug(`Error processing book ${book.id} in library ${library}:`, error);
                        continue; // Skip to the next book if there's an error
                    }
                }
            }
            return {
                sync_count,
                failed_count,
            }
        } catch (error) {
            debug("Error syncing books:", error);
            throw new Error("Failed to sync books");
        }
    }


    public calculateBookPrices({ num_pages }: { num_pages: number }): { num_pages: number; options: BookPriceOption[] } {
        try {
            const options: BookPriceOption[] = [];
            const page_cost = num_pages * PAGE_MULTIPLIER;
            const color_cost = (COLOR_MULTIPLIER * num_pages / 100);

            function roundAndConvertToCents(value: number): number {
                return Math.round(value * 100);
            }

            // Start with the base cost
            const BASE_PRICE = page_cost + BASE_COST

            let base_price = BASE_PRICE * (1 + OPERATING_COST_MULTIPLIER);
            options.push({
                hardcover: false,
                color: false,
                price: roundAndConvertToCents(base_price),
                formatted_price: `$${base_price.toFixed(2)}`,
            });

            // Calculate price for hardcover
            let hardcover_base_price = BASE_PRICE + HARDCOVER_SURCHARGE;
            let hardcover_price = hardcover_base_price * (1 + OPERATING_COST_MULTIPLIER);
            options.push({
                hardcover: true,
                color: false,
                price: roundAndConvertToCents(hardcover_price),
                formatted_price: `$${hardcover_price.toFixed(2)}`,
            });

            // Calculate price for color
            let color_base_price = BASE_PRICE + color_cost;
            let color_price = color_base_price * (1 + OPERATING_COST_MULTIPLIER);
            options.push({
                hardcover: false,
                color: true,
                price: roundAndConvertToCents(color_price),
                formatted_price: `$${color_price.toFixed(2)}`,
            });

            // Calculate price for hardcover and color
            let hardcover_color_base_price = BASE_PRICE + HARDCOVER_SURCHARGE + color_cost;
            let hardcover_color_price = hardcover_color_base_price * (1 + OPERATING_COST_MULTIPLIER);
            options.push({
                hardcover: true,
                color: true,
                price: roundAndConvertToCents(hardcover_color_price),
                formatted_price: `$${hardcover_color_price.toFixed(2)}`,
            });

            return {
                num_pages,
                options,
            };
        } catch (error) {
            debug("Error calculating book price:", error);
            throw new Error("Failed to calculate book price");
        }
    }

    public getBookThumbnailUrl({ library, id }: { library: string, id: string }): string {
        return `https://${library}.libretexts.org/@api/deki/pages/${id}/files/=mindtouch.page%2523thumbnail`
    }

    public async validateItemQuantities({
        items,
        userId,
    }: {
        items: { quantity: number }[];
        userId?: string;
    }): Promise<
        | { ok: true; maxQuantity: number }
        | { ok: false; maxQuantity: number; message: string }
    > {
        const { maxQuantity, reason } = await this.determineMaxQuantity(userId);
        const offender = items.find((item) => item.quantity > maxQuantity);
        if (offender) {
            debug(`[StoreService] Quantity ${offender.quantity} exceeds max ${maxQuantity} (${reason})`);
            return {
                ok: false,
                maxQuantity,
                message: `Item quantity exceeds the maximum allowed (${maxQuantity}) for this account.`,
            };
        }
        return { ok: true, maxQuantity };
    }

    public async determineMaxQuantity(userId?: string): Promise<{ maxQuantity: number; reason: string }> {
        try {
            if (!userId) {
                return { maxQuantity: DEFAULT_MAX_QUANTITY, reason: "No user ID provided, applying default max quantity." };
            }

            const user = await User.findOne({ uuid: { $eq: userId } });
            if (!user) {
                debug(`[StoreService] User with ID ${userId} not found. Applying default max quantity.`);
                return { maxQuantity: DEFAULT_MAX_QUANTITY, reason: "User not found, applying default max quantity." };
            }

            const senderIsStaff = authAPI.checkHasRole(user, "libretexts", "support");
            if (senderIsStaff) {
                return { maxQuantity: STAFF_MAX_QUANTITY, reason: "User is staff, applying staff max quantity." };
            }

            return { maxQuantity: DEFAULT_MAX_QUANTITY, reason: "User is not staff, applying default max quantity." };
        } catch (err: any) {
            debug("[StoreService] Error validating max quantity for user:", err);
            return { maxQuantity: DEFAULT_MAX_QUANTITY, reason: "Error validating user role, applying default max quantity." };
        }
    }

    private async _fetchAllProducts(category?: string): Promise<StoreProduct[]> {
        const stripe = this.stripeService.getInstance();
        const allProducts: StoreProduct[] = [];
        let hasMore = true;
        let nextPage = null;

        const cacheKey = `store_products_${!category || category === 'all' ? 'all' : category}`;
        const cached = this.cache.get(cacheKey);
        if (cached) {
            return cached as StoreProduct[];
        }

        while (hasMore) {
            const prices = await stripe.prices.search({
                query: this._buildStripeSearchQuery(category),
                limit: 100, // Max limit for Stripe
                expand: ['data.product'],
                ...(nextPage && { page: nextPage }),
            });

            if (!prices?.data?.length) {
                break;
            }

            const products = this._groupByProduct(prices.data);
            allProducts.push(...products);

            hasMore = prices.has_more;
            nextPage = prices.next_page
        }

        this.cache.set(cacheKey, allProducts);

        return allProducts;
    }

    private async _fetchCheckoutSession(sessionId: string, opts: { includeCharges?: boolean, skipCache?: boolean } = {}): Promise<{
        session: Stripe.Checkout.Session | null;
        charge?: Stripe.Charge | null;
    }> {
        const stripe = this.stripeService.getInstance();
        const cached = this.cache.get(sessionId);

        if (cached && !opts.includeCharges && !opts.skipCache) {
            return { session: cached as Stripe.Checkout.Session };
        }

        try {
            const session = await stripe.checkout.sessions.retrieve(sessionId, {
                expand: ['line_items', 'customer_details', 'payment_intent', 'line_items.data.price.product'],
            });


            if (!session || !session.id) {
                debug("No valid Stripe checkout session found for ID:", sessionId);
                return { session: null, charge: null };
            }

            let charge: Stripe.Charge | null = null;
            if (opts.includeCharges && session?.payment_intent && typeof session?.payment_intent === 'object' && session?.payment_intent?.latest_charge) {
                charge = await stripe.charges.retrieve(typeof session?.payment_intent.latest_charge === 'string' ? session?.payment_intent.latest_charge : session?.payment_intent.latest_charge.id);
            }

            this.cache.set(sessionId, session, 60 * 60); // Cache for 1 hour
            return { session, charge };
        } catch (error) {
            debug("Error fetching checkout session:", error);
            return { session: null, charge: null };
        }
    }

    private _buildStripeSearchQuery(category?: string): string {
        let query = 'metadata["store"]:"true" AND active:"true"';
        if (category && category !== 'all') {
            query += ` AND metadata["store_category"]:"${category}"`;
        }
        return query;
    }

    private async _processDigitalItems({ items, email, digital_delivery_option, digital_delivery_account }:
        {
            items: ResolvedProduct[],
            email: string,
            digital_delivery_option: z.infer<typeof CreateCheckoutSessionSchema>['body']['digital_delivery_option'],
            digital_delivery_account?: string | null
        }): Promise<boolean> {
        try {
            if (!items || items.length === 0) {
                debug("No digital items to process.");
                return true;
            }

            const successfulItems: ResolvedProduct[] = [];
            for (const item of items) {
                if (!item.product.metadata || !item.product.metadata.digital || item.product.metadata.digital !== 'true') {
                    continue; // Skip non-digital items
                }

                if (digital_delivery_option === 'email_access_codes') {
                    const didGenerate = await centralIdentityAPI._generateAccessCode({ priceId: item.price_id, email });
                    if (!didGenerate) {
                        debug(`Failed to generate access code for product ${item.product.id} for email ${email}`);
                        continue; // Skip this item if access code generation failed
                    }
                } else {
                    if (!digital_delivery_account) {
                        debug(`Digital delivery account must be provided when digital delivery option is 'apply_to_account' for product ${item.product.id}`);
                        continue; // Skip this item if account is not provided
                    }

                    const didDeliver = await centralIdentityAPI._autoDeliverDigitalProduct({
                        priceId: item.price_id,
                        user_id: digital_delivery_account
                    });
                    if (!didDeliver) {
                        debug(`Failed to deliver digital product ${item.product.id} (price ${item.price_id}) to account ${digital_delivery_account}`);
                        continue; // Skip this item if delivery failed
                    }
                }
                successfulItems.push(item);
            }

            if (successfulItems.length !== items.length) {
                debug(`Some digital items could not be processed. Processed: ${successfulItems.length}, Total: ${items.length}`);
                return false;
            }

            return true;
        } catch (error) {
            debug("Error processing digital items:", error);
            return false;
        }
    }

    private async _processShippingUpdates(storeOrder: StoreOrderDocument, data: LuluWebhookData['data'], customerEmail: string): Promise<RawStoreOrderNotification[]> {
        // Lulu technically returns an array of tracking URLs per item - it is unlikely there would be more than one, but we need to handle it
        const trackingInfoToSend: { trackingID: string; trackingURLs: string[] }[] = [];
        const line_items = data.line_items || [];
        const alreadySent = storeOrder.notificationsSent?.filter((n) => n.status === 'SHIPPED') || []

        if (line_items.length > 0) {
            for (const item of line_items) {
                if (item.tracking_id && !alreadySent.some(n => n.status === 'SHIPPED' && n.trackingID === item.tracking_id)) {
                    trackingInfoToSend.push({ trackingID: item.tracking_id, trackingURLs: item.tracking_urls || [] });
                }
            }
        }

        const flattenedTrackingUrls = trackingInfoToSend.flatMap(info => info.trackingURLs);

        await mailAPI.sendStoreOrderShippedUpdate(customerEmail, storeOrder.id, flattenedTrackingUrls).catch((err) => {
            debug("Failed to send store order shipped update email:", err);
        });

        const notificationsSent = trackingInfoToSend.map((info) => ({
            status: "SHIPPED",
            trackingID: info.trackingID,
            trackingURLs: info.trackingURLs
        })) as RawStoreOrderNotification[];

        return notificationsSent;
    }

    private async _separateProductsByCategory(items: { product_id: string, price_id: string, quantity: number }[]): Promise<{
        books: ResolvedProduct[],
        digital: ResolvedProduct[],
        shipping: ResolvedProduct | null,
    }> {
        let shippingItem: ResolvedProduct | null = null;
        const bookItems: ResolvedProduct[] = [];
        const digitalItems: ResolvedProduct[] = [];
        const stripe = this.stripeService.getInstance();
        if (!items || items.length === 0) {
            return {
                books: bookItems,
                digital: digitalItems,
                shipping: shippingItem,
            };
        }

        for (const item of items) {
            if (!item.product_id || !item.price_id) {
                throw new Error("INVALID_LINE_ITEM");
            }

            const price = await stripe.prices.retrieve(item.price_id, {
                expand: ['product'],
            });

            if (!price || !price.product || typeof price.product === 'string') {
                throw new Error("INVALID_LINE_ITEM_PRICE")
            }
            if (!price.product.id) {
                throw new Error("INVALID_LINE_ITEM_PRODUCT");
            }
            if (price.product.id !== item.product_id) {
                throw new Error("LINE_ITEM_PRODUCT_MISMATCH");
            }

            const product = price.product as Stripe.Product;

            if (product.metadata['is_shipping'] === 'true') {
                shippingItem = {
                    product_id: item.product_id,
                    price_id: item.price_id,
                    product: product,
                    price,
                    quantity: item.quantity,
                };
            }

            if (product.metadata['store_category'] === 'books') {
                bookItems.push({
                    product_id: item.product_id,
                    price_id: item.price_id,
                    product: product,
                    price,
                    quantity: item.quantity,
                })
            } else if (product.metadata['digital'] === 'true') {
                digitalItems.push({
                    product_id: item.product_id,
                    price_id: item.price_id,
                    product: product,
                    price,
                    quantity: item.quantity,
                })
            }
        }

        return {
            books: bookItems,
            digital: digitalItems,
            shipping: shippingItem,
        }
    }

    private _shippingAddressToStripeData(shipping_address: z.infer<typeof CreateCheckoutSessionSchema>['body']['shipping_address']): Stripe.CustomerCreateParams {
        return {
            email: shipping_address.email,
            name: `${shipping_address.first_name} ${shipping_address.last_name}`,
            phone: shipping_address.phone,
            address: {
                line1: shipping_address.address_line_1,
                line2: shipping_address.address_line_2,
                city: shipping_address.city,
                state: shipping_address.state,
                postal_code: shipping_address.postal_code,
                country: shipping_address.country,
            },
            shipping: {
                name: `${shipping_address.first_name} ${shipping_address.last_name}`,
                phone: shipping_address.phone,
                address: {
                    line1: shipping_address.address_line_1,
                    line2: shipping_address.address_line_2,
                    city: shipping_address.city,
                    state: shipping_address.state,
                    postal_code: shipping_address.postal_code,
                    country: shipping_address.country,
                }
            }
        }
    }

    private _parseLineItemsFromCheckoutSession(session: Stripe.Checkout.Session): { product_id: string, price_id: string, quantity: number }[] {
        return session.line_items?.data?.map((i) => {
            let product_id = '';
            if (i.price?.product && typeof i.price.product === 'string') {
                product_id = i.price.product;
            } else if (i.price?.product && typeof i.price.product === 'object' && i.price.product.id) {
                product_id = i.price.product.id;
            }

            return ({
                product_id: product_id,
                price_id: i.price?.id || '',
                quantity: i.quantity || 1,
            })
        }) || []
    }

    /**
     * Helper function to fail a store order and update its status and error message.
     * @param storeOrder - The RawStoreOrder instance to update.
     * @param error - The error message to set on the store order.
     */
    private async _failStoreOrder(storeOrder: RawStoreOrder, error: string) {
        const result = await StoreOrder.updateOne({
            id: storeOrder.id,
        }, {
            status: "failed",
            error: error,
        });

        // Open a support ticket so the failure lands in the assignable triage workflow.
        // Best-effort: never let ticketing affect the order's failure handling.
        await this._createOrderFailureTicket(storeOrder, {
            trigger: "order_failed",
            message: error,
        });

        // Best-effort: reflect the failed status in the search index (fire-and-forget).
        void upsertStoreOrderToSearchIndex(storeOrder.id);
        return result;
    }

    /**
     * Opens a system-generated support ticket for a store order that needs manual resolution,
     * enforcing one ticket per order via the order's `supportTicketUUID`. Fully defensive: any
     * failure here is logged and swallowed so it can never disrupt order processing.
     */
    private async _createOrderFailureTicket(
        storeOrder: RawStoreOrder,
        { trigger, message }: { trigger: "order_failed" | "lulu_rejected" | "lulu_error"; message?: string },
    ): Promise<string | undefined> {
        try {
            if (storeOrder.supportTicketUUID) return storeOrder.supportTicketUUID; // already ticketed

            const shortID = storeOrder.id.slice(-6);
            const titleByTrigger: Record<typeof trigger, string> = {
                order_failed: `Store order failed (#${shortID})`,
                lulu_rejected: `Store order rejected by Lulu (#${shortID})`,
                lulu_error: `Store order errored at Lulu (#${shortID})`,
            };

            const descriptionLines = [
                `A store order requires manual resolution.`,
                ``,
                `Order ID: ${storeOrder.id}`,
                storeOrder.customerEmail ? `Customer: ${storeOrder.customerEmail}` : undefined,
                storeOrder.luluJobID ? `Lulu Job ID: ${storeOrder.luluJobID}` : undefined,
                message ? `Details: ${message}` : undefined,
            ].filter(Boolean);

            const ticket = await this.ticketService.createSystemTicket({
                title: titleByTrigger[trigger],
                description: descriptionLines.join("\n"),
                category: "bookstore",
                priority: "high",
                metadata: {
                    orderID: storeOrder.id,
                    trigger,
                    luluJobStatus: storeOrder.luluJobStatus,
                    message,
                },
            });

            if (ticket?.uuid) {
                await StoreOrder.updateOne({ id: { $eq: storeOrder.id } }, { supportTicketUUID: ticket.uuid });
                return ticket.uuid;
            }
        } catch (err) {
            debug("Failed to create support ticket for store order:", err);
        }
        return undefined;
    }

    /**
     * Helper function to 'flip' the prices data from Stripe so that products are at the top level
     * with their prices nested inside.
     * @param prices - The list of prices from Stripe.
     * @returns An array of products with their associated prices.
     */
    private _groupByProduct(prices: Stripe.Price[]): StoreProduct[] {
        const productsMap: { [key: string]: StoreProduct } = {};
        for (const price of prices) {
            if (!price.product || typeof price.product === 'string') {
                debug("Price without product found:", price);
                continue; // Skip prices without associated products
            }

            const productId = price.product.id.toString();
            if (!productsMap[productId]) {
                productsMap[productId] = {
                    ...price.product as Stripe.Product,
                    prices: [] as Stripe.Price[],
                }
            }

            productsMap[productId].prices.push({
                ...price,
                product: productId, // set product as ID only to avoid redundancy and reduce size
            });
        }

        const products = Object.values(productsMap) as StoreProduct[];
        return products.map(product => {
            // Ensure prices are sorted by unit_amount in ascending order
            product.prices.sort((a, b) => (a.unit_amount || 0) - (b.unit_amount || 0));
            return product;
        }).filter(product => product.prices.length > 0); // Filter out products without prices
    }

    private _buildBookPriceNickname({ hardcover, color }: { hardcover: boolean; color: boolean }): string {
        let nickname = '';
        if (hardcover) {
            nickname += 'Hardcover';
        }
        if (color) {
            nickname += (nickname ? ' + ' : '') + 'Color';
        }
        if (!hardcover && !color) {
            nickname += 'Paperback + Black & White';
        }
        return nickname;
    }
}

export default new StoreService();
