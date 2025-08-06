import Stripe from "stripe";
import { debug } from "../../debug";
import StripeService from "./stripe-service";
import { getLibraryNameKeys } from "../libraries";
import axios from "axios";
import { BookPriceOption, StoreProduct, StoreShippingOption, DownloadCenterItem, LuluShippingLineItem, ResolvedProduct, LuluPrintJobLineItem, LuluShippingLevel, LuluWebhookData, StoreOrderWithStripeSession, LuluPrintJob } from "../../types";
import { checkBookIDFormat } from "../../util/bookutils";
import { CreateCheckoutSessionSchema, GetShippingOptionsSchema, AdminGetStoreOrdersSchema } from "../validators/store";
import { z } from "zod";
import LuluService from "./lulu-service";
import StoreOrder, { RawStoreOrder, RawStoreOrderNotification, StoreOrderDocument } from "../../models/storeorder";
import centralIdentityAPI from "../central-identity"
import Fuse from "fuse.js";
import NodeCache from "node-cache";
import { serializeError } from "../../util/errorutils";
import mailAPI from "../mail"

const BASE_COST = 1.80;
const PAGE_MULTIPLIER = 0.032;
const HARDCOVER_SURCHARGE = 7.35;
const COLOR_MULTIPLIER = 1.5;
const OPERATING_COST_MULTIPLIER = 0.24;

class StoreService {
    private stripeService = new StripeService();
    private luluService = new LuluService();
    private cache: NodeCache;

    constructor() {
        this.cache = new NodeCache({ stdTTL: 60 * 5, checkperiod: 120 }); // Cache for 5 minutes
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

    public async getCheckoutSession(checkout_session_id: string) {
        try {
            const { session, charge } = await this._fetchCheckoutSession(checkout_session_id, { includeCharges: true });

            if (!session) {
                debug(`No checkout session found with ID: ${checkout_session_id}`);
                return null;
            }

            return { session, charge }
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

            // Ensure all items are valid Stripe products
            const stripe_products = await stripe.products.list({
                limit: 100,
                ids: items.map(item => item.product_id),
            });
            if (!stripe_products || !stripe_products.data || stripe_products.data.length === 0) {
                debug("No products found for the provided items.");
                throw new Error("No products found for the provided items");
            }

            if (stripe_products.data.length !== items.length) {
                debug("Mismatch between provided items and found products.");
                throw new Error("Mismatch between provided items and found products");
            }

            // Check if all items are digital products
            const allDigital = items.every(item => {
                const product = stripe_products.data.find(p => p.id === item.product_id);
                return product && product.metadata && product.metadata.digital === 'true';
            });

            if (allDigital) {
                return "digital_delivery_only";
            }

            // Calculate estimated shipping costs from Lulu
            const luluShippingLineItems: LuluShippingLineItem[] = [];
            for (const product of stripe_products.data) {
                const item = items.find(item => item.product_id === product.id);
                if (!item || !item.price_id) {
                    debug(`Item with product ID ${product.id} does not have a valid price_id.`);
                    continue;
                }

                const price = await stripe.prices.retrieve(item.price_id, {
                    expand: ['product'],
                });

                if (!price || !price.product || typeof price.product === 'string') {
                    debug(`Price for product ID ${product.id} is not valid.`);
                    continue;
                }

                if (item && product.metadata && product.metadata.num_pages) {
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
                return opt.cost_excl_tax && !opt.business_only && !opt.home_only
            });

            if (!filtered_shipping_options || filtered_shipping_options.length === 0) {
                debug("No shipping options found for the provided items.");
                throw new Error("No shipping options found for the provided items");
            }

            const mapped = filtered_shipping_options.map((opt) => {
                // ensure cost_excl_tax is a number and convert it to cents
                if (!opt.cost_excl_tax || isNaN(parseFloat(opt.cost_excl_tax))) {
                    debug("Invalid cost_excl_tax for shipping option:", opt);
                    return null; // Skip invalid options
                }
                const costInCents = Math.round(parseFloat(opt.cost_excl_tax) * 100);

                return {
                    id: opt.id,
                    title: `${opt.level}${opt.carrier_service_name ? ` (${opt.carrier_service_name})` : ''}`,
                    total_days_min: opt.total_days_min,
                    total_days_max: opt.total_days_max,
                    lulu_shipping_level: opt.level,
                    cost_excl_tax: costInCents,
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
                await storeOrder.save(); // Save the email to the order now in case processing fails later

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
                id: checkout_session_id,
            });

            if (!storeOrder) {
                debug(`No StoreOrder found with id: ${checkout_session_id}`);
                return;
            }

            const customerEmail = storeOrder.customerEmail || await this.stripeService.getCustomerEmailFromCheckoutSession(storeOrder.id);

            // If the order is now in production and we haven't sent a notification yet, send one
            if (customerEmail && data.status?.name === 'IN_PRODUCTION' && !storeOrder.notificationsSent?.some((n) => n.status === 'IN_PRODUCTION')) {
                await mailAPI.sendStoreOrderInProductionUpdate(customerEmail, storeOrder.id).catch((err) => {
                    debug("Failed to send store order in production update email:", err);
                });
                storeOrder.notificationsSent = [...(storeOrder.notificationsSent || []), { status: 'IN_PRODUCTION' }];
            }

            // If the order has shipped, consider it completed
            if (data.status?.name === 'SHIPPED') {
                if (customerEmail) {
                    const notificationsSent = await this._processShippingUpdates(storeOrder, data, customerEmail);
                    storeOrder.notificationsSent = [...(storeOrder.notificationsSent || []), ...notificationsSent];
                }

                storeOrder.status = 'completed';
            }

            storeOrder.luluJobID = data.id.toString(); // Update the Lulu job ID (e.g. on resubmits)
            storeOrder.luluJobStatus = data.status?.name || "unknown";
            storeOrder.luluJobStatusMessage = data.status?.message || "";
            storeOrder.luluJobStatusUpdates = [...(storeOrder.luluJobStatusUpdates || []), data];
            await storeOrder.save();
        } catch (error) {
            debug("Error processing Lulu order update:", error);
        }
    }

    public async resubmitLuluJob(orderId: string): Promise<LuluPrintJob | {
        error: string;
        detail?: string;
    }> {
        try {
            const store_order = await StoreOrder.findOne({ id: orderId });
            if (!store_order) {
                debug(`No StoreOrder found for ID: ${orderId}`);
                return { error: `No StoreOrder found for ID: ${orderId}` };
            }

            const { session } = await this._fetchCheckoutSession(store_order.id);
            if (!session || !session.id) {
                debug(`No valid Stripe checkout session found for StoreOrder ID: ${store_order.id}`);
                return { error: `No valid Stripe checkout session found for StoreOrder ID: ${store_order.id}` };
            }

            const lineItems = this._parseLineItemsFromCheckoutSession(session);
            if (!lineItems || lineItems.length === 0) {
                debug(`No valid line items found for StoreOrder ID: ${store_order.id}`);
                return { error: `No valid line items found for StoreOrder ID: ${store_order.id}` };
            }

            const { books, shipping } = await this._separateProductsByCategory(lineItems);
            if (!books || books.length === 0) {
                debug(`No valid book items found for StoreOrder ID: ${store_order.id}`);
                return { error: `No valid book items found for StoreOrder ID: ${store_order.id}` };
            }

            if (!shipping) {
                debug(`No valid shipping item found for StoreOrder ID: ${store_order.id}`);
                return { error: `No valid shipping item found for StoreOrder ID: ${store_order.id}` };
            }

            const luluLineItems = this.luluService.buildPrintJobLineItems(books);
            const printJob = await this.luluService.createPrintJob({
                external_id: store_order.id,
                shipping_address: {
                    name: session.customer_details?.name || '',
                    street1: session.customer_details?.address?.line1 || '',
                    street2: session.customer_details?.address?.line2 || '',
                    city: session.customer_details?.address?.city || '',
                    state_code: session.customer_details?.address?.state || '',
                    postcode: session.customer_details?.address?.postal_code || '',
                    country_code: session.customer_details?.address?.country || '',
                    phone_number: session.customer_details?.phone || '',
                    email: session.customer_details?.email || '', // Will default to the contact email on Lulu account if not provided
                    is_business: false,
                },
                line_items: luluLineItems,
                shipping_level: shipping.product.metadata['lulu_shipping_option_level'] as LuluShippingLevel || 'MAIL',
            })

            if (!printJob || !printJob.id) {
                debug(`Failed to create Lulu print job for StoreOrder ID: ${store_order.id}`);
                return { error: `Failed to create Lulu print job for StoreOrder ID: ${store_order.id} with an internal error` };
            }

            store_order.luluJobID = printJob.id.toString();
            store_order.luluJobStatus = printJob.status["name"] || "unknown";
            store_order.luluJobStatusMessage = printJob.status["message"] || "";
            await store_order.save();

            return printJob;
        } catch (error) {
            debug("Error retrying Lulu job:", error);
            const errorString = serializeError(error);
            return { error: "Failed to retry Lulu job", detail: errorString };
        }
    }

    public async adminGetStoreOrders(params: z.infer<typeof AdminGetStoreOrdersSchema>['query']): Promise<{
        items: StoreOrderWithStripeSession[];
        meta: {
            total_count: number;
            has_more: boolean;
            next_page: string | null;
        };
    }> {
        try {
            let limit = params?.limit ? parseInt(params.limit.toString(), 10) : 25;
            let filter: any = { $and: [] };

            if (params?.starting_after) {
                // ensure mongoID is properly formatted
                filter.$and.push({ _id: { $lt: params.starting_after } });
            }
            if (params?.status) {
                filter.$and.push({ status: params?.status });
            }
            if (params?.lulu_status) {
                filter.$and.push({ luluJobStatus: params?.lulu_status });
            }
            if (params?.query && params?.query.trim() !== '') {
                filter.$and.push(
                    { id: new RegExp(params.query, 'i') },
                );
            }

            const orders = await StoreOrder.find(filter).sort({ _id: -1 }).limit(limit).exec();
            if (!orders || orders.length === 0) {
                return {
                    items: [],
                    meta: {
                        total_count: 0,
                        has_more: false,
                        next_page: null
                    }
                };
            }

            const order_data: StoreOrderWithStripeSession[] = [];
            for (const order of orders) {
                const { session } = await this._fetchCheckoutSession(order.id);
                order_data.push({
                    ...order.toObject(), // Convert Mongoose document to plain object
                    stripe_session: session
                });
            }

            const total_count = await StoreOrder.countDocuments(filter);
            const previously_fetched_count = params?.starting_after ? await StoreOrder.countDocuments({ _id: { $gt: params.starting_after } }) : 0;
            const has_more = total_count > (previously_fetched_count + orders.length);
            const next_page = (orders.length === limit ? orders[orders.length - 1]._id?.toString() : null) || null;
            return {
                items: order_data,
                meta: {
                    total_count,
                    has_more,
                    next_page
                }
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
                                    numPages: book.numPages.toString(),
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
                                }
                            });
                        }

                        const priceOptions = this.calculateBookPrices({ numPages: book.numPages });
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
                                    debug(`Price for ${product.name} with hardcover=${option.hardcover} and color=${option.color} updated.`);
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


    public calculateBookPrices({ numPages }: { numPages: number }): { numPages: number; options: BookPriceOption[] } {
        try {
            const options: BookPriceOption[] = [];
            const page_cost = numPages * PAGE_MULTIPLIER;
            const color_cost = (COLOR_MULTIPLIER * numPages / 100);

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
                numPages,
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

    private async _fetchCheckoutSession(sessionId: string, opts: { includeCharges?: boolean } = {}): Promise<{
        session: Stripe.Checkout.Session | null;
        charge?: Stripe.Charge | null;
    }> {
        const stripe = this.stripeService.getInstance();
        const cached = this.cache.get(sessionId);

        if (cached && !opts.includeCharges) {
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
        return await StoreOrder.updateOne({
            id: storeOrder.id,
        }, {
            status: "failed",
            error: error,
        })
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