import Stripe from "stripe";
import { debug } from "../../debug";
import StripeService from "./stripe-service";
import { getLibraryNameKeys } from "../libraries";
import axios from "axios";
import { BookPriceOption, StoreProduct, StoreShippingOption, DownloadCenterItem, LuluShippingLineItem, ResolvedProduct, LuluPrintJobLineItem, LuluShippingLevel, LuluWebhookData } from "../../types";
import { checkBookIDFormat } from "../../util/bookutils";
import { CreateCheckoutSessionSchema, GetShippingOptionsSchema } from "../validators/store";
import { z } from "zod";
import LuluService from "./lulu-service";
import StoreOrder, { StoreOrderInterface } from "../../models/storeorder";
import centralIdentityAPI from "../central-identity"
import Fuse from "fuse.js";
import { getPaginationOffset } from "../../util/helpers";

const BASE_COST = 1.80;
const PAGE_MULTIPLIER = 0.032;
const HARDCOVER_SURCHARGE = 7.35;
const COLOR_MULTIPLIER = 1.5;
const OPERATING_COST_MULTIPLIER = 0.16;

export default class StoreService {
    private stripeService = new StripeService();
    private luluService = new LuluService();
    constructor() { }

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

    public async getStoreProducts({ limit, starting_after, category, query, page }: {
        limit?: number;
        starting_after?: string;
        category?: string;
        query?: string;
        page?: number;
    }): Promise<{
        items: StoreProduct[];
        has_more: boolean;
        total_count: number;
        cursor?: string;
    }> {
        try {
            const stripe = this.stripeService.getInstance();

            const prices = await stripe.prices.search({
                query: 'metadata["store"]:"true" AND active:"true"',
                limit: 100,
                expand: ['data.product'],
            });

            if (!prices || !prices.data || prices.data.length === 0) {
                debug("No bookstore products found.");
                return {
                    items: [],
                    has_more: false,
                    total_count: 0,
                };
            }

            const products = this._groupByProduct(prices.data);

            if (products.length === 0) {
                debug("No store products found.");
                return {
                    items: [],
                    has_more: false,
                    total_count: 0,
                };
            }

            let filteredProducts = products;

            // If a category is specified, filter products by their metadata store_category
            if (category) {
                const splitCategories = category.split(',');
                filteredProducts = filteredProducts.filter(product => {
                    if (!product || !product.metadata) {
                        return false; // Skip products without metadata
                    }
                    const storeCategory = product.metadata.store_category;
                    if (!storeCategory) {
                        return false; // Skip products without a store category
                    }

                    return splitCategories.includes(storeCategory);
                });
            }

            if (query) {
                const fuse = new Fuse(filteredProducts, {
                    threshold: 0.3,
                    keys: ["name"],
                    includeScore: true,
                })

                // sort by highest score and map to filteredProducts
                const results = fuse.search(query);
                filteredProducts = results
                    .sort((a, b) => a.score! - b.score!)
                    .map(result => result.item);
            }

            // const lastItem = starting_after ? filteredProducts.find(item => item.id === starting_after) : undefined;
            // if (lastItem) {
            //     const index = filteredProducts.indexOf(lastItem);
            //     if (index !== -1) {
            //         filteredProducts = filteredProducts.slice(index + 1);
            //     }
            // }

            const offset = page ? getPaginationOffset(page, limit || 100) : 0;
            const paginated = filteredProducts.slice(offset, offset + (limit || 100));

            return {
                items: paginated,
                has_more: filteredProducts.length > (limit || 100),
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
            const stripe = this.stripeService.getInstance();
            const session = await stripe.checkout.sessions.retrieve(checkout_session_id);

            if (!session) {
                debug(`No checkout session found with ID: ${checkout_session_id}`);
                return null;
            }

            return session
        } catch (error) {
            debug("Error fetching checkout session:", error);
            throw new Error("Failed to fetch checkout session");
        }
    }

    public async createCheckoutSession({
        items,
        shipping_option,
        shipping_address
    }: {
        items: z.infer<typeof CreateCheckoutSessionSchema>['body']['items'];
        shipping_option: StoreShippingOption | "digital_delivery_only";
        shipping_address: z.infer<typeof CreateCheckoutSessionSchema>['body']['shipping_address'];
    }): Promise<{
        session_id: string;
        checkout_url: string;
    }> {
        try {
            const stripe = this.stripeService.getInstance();
            const customer = await this.upsertCustomer({ shipping_address });

            const createLineItems = (): Stripe.Checkout.SessionCreateParams.LineItem[] => {
                const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = items.map(item => {
                    return {
                        price: item.price_id,
                        quantity: item.quantity,
                    };
                });

                if (shipping_option === 'digital_delivery_only') {
                    return lineItems
                }

                if (!shipping_option || !shipping_option.id || !shipping_option.cost_excl_tax) {
                    debug("A shipping option was provided to createCheckoutSession but it is invalid:", shipping_option);
                    throw new Error("A shipping option was provided to createCheckoutSession but it is invalid")
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

            const line_items = createLineItems();
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
                success_url: `${process.env.NODE_ENV === 'production' ? 'https://commons.libretexts.org' : `http://localhost:${process.env.CLIENT_PORT}`}/store/checkout/success?checkout_session_id={CHECKOUT_SESSION_ID}`,
                metadata: {
                    application: 'conductor',
                    feature: 'store',
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
            throw new Error("Failed to create checkout session");
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
                    total_days_min: opt.total_days_min,
                    total_days_max: opt.total_days_max,
                    lulu_shipping_level: opt.level,
                    cost_excl_tax: costInCents,
                }
            });

            // Only return the slowest and fastest shipping options (e.g. standard and expedited)
            const slowest = mapped.reduce((prev, curr) => {
                if (!prev || !curr) return curr; // Handle case where one of them is null
                return prev.total_days_min > curr.total_days_min ? prev : curr;
            });
            const fastest = mapped.reduce((prev, curr) => {
                if (!prev || !curr) return curr; // Handle case where one of them is null
                return prev.total_days_min < curr.total_days_min ? prev : curr;
            });
            if (!slowest || !fastest) {
                debug("No valid shipping options found after filtering.");
                throw new Error("No valid shipping options found after filtering");
            }

            return [
                {
                    title: "Standard Shipping",
                    ...slowest,
                },
                {
                    title: "Expedited Shipping (Fastest)",
                    ...fastest,
                }
            ]
        } catch (error) {
            debug("Error fetching shipping options:", error);
            throw new Error("Failed to fetch shipping options");
        }
    }

    public async processOrder({
        checkout_session,
    }: {
        checkout_session: Stripe.Checkout.Session;
    }): Promise<StoreOrderInterface> {
        try {
            // Immediately create a StoreOrder record so we can track processing errors
            const storeOrder = await StoreOrder.create({
                id: checkout_session.id, // Id has unique constraint, so this will fail if the order already exists
                status: "pending",
                error: "",
            });

            // Begin processing the order
            try {
                const stripe = this.stripeService.getInstance();
                const lineItems: ({
                    product_id: string,
                    price_id: string
                    quantity: number
                })[] = checkout_session.line_items?.data?.map((i) => {
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

                if (!lineItems || lineItems.length === 0) {
                    throw new Error("NO_LINE_ITEMS");
                }

                if (lineItems.length >= 100) {
                    throw new Error("TOO_MANY_LINE_ITEMS");
                }


                let shippingItem: ResolvedProduct | null = null;
                const bookItems: ResolvedProduct[] = [];
                const digitalItems: ResolvedProduct[] = [];

                for (const item of lineItems) {
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
                    const email = checkout_session.customer_details?.email || checkout_session.customer_email;
                    if (!email) {
                        throw new Error("MISSING_EMAIL_FOR_DIGITAL_ITEMS");
                    }

                    await this._processDigitalItems({
                        items: digitalItems,
                        email
                    })
                }

                return storeOrder;
            } catch (error: any) {
                await this._failStoreOrder(storeOrder, error.toString());
                return storeOrder;
            }
        } catch (error) {
            throw new Error("Fatal error during order processing: " + error);
        }
    }


    public async processLuluOrderUpdate({ data }: { data: LuluWebhookData['data'] }) {
        try {
            const luluJobID = data.id.toString();

            const storeOrder = await StoreOrder.findOne({
                luluJobID: luluJobID,
            });

            if (!storeOrder) {
                debug(`No StoreOrder found for Lulu job ID: ${luluJobID}`);
                return;
            }

            storeOrder.luluJobStatus = data.status?.name || "unknown";
            storeOrder.luluJobError = data.status?.message || "";
            await storeOrder.save();
        } catch (error) {
            debug("Error processing Lulu order update:", error);
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
                                // if the price already exists and is the same currency and amount, skip it
                                // otherwise, we must delete it and create a new one
                                if (existingPrice.unit_amount === option.price && existingPrice.currency === 'usd') {
                                    const nickname = this._buildBookPriceNickname({
                                        hardcover: option.hardcover,
                                        color: option.color,
                                    });
                                    
                                    // ensure nickname and tax_behavior are set correctly
                                    if (!existingPrice.nickname || existingPrice.nickname !== nickname || (!existingPrice.tax_behavior || existingPrice.tax_behavior === 'unspecified' || !existingPrice.metadata['store'])) {
                                        debug(`Updating existing price ${existingPrice.id} for ${product.name} with hardcover=${option.hardcover} and color=${option.color}.`);
                                        await stripe.prices.update(existingPrice.id, {
                                            tax_behavior: 'exclusive',
                                            nickname: this._buildBookPriceNickname({
                                                hardcover: option.hardcover,
                                                color: option.color,
                                            }),
                                            metadata: {
                                                ...existingPrice.metadata,
                                                store: "true",
                                            }
                                        });
                                        continue;
                                    }
                                    debug(`Price for ${product.name} with hardcover=${option.hardcover} and color=${option.color} already exists.`);
                                    continue;
                                } else {
                                    await stripe.prices.update(existingPrice.id, { active: false }); // Archive the existing price
                                    debug(`Archived existing price ${existingPrice.id} for ${product.name} with hardcover=${option.hardcover} and color=${option.color}.`);
                                    // Continue to create a new price
                                }
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

    private async _processDigitalItems({ items, email }: { items: ResolvedProduct[]; email: string }): Promise<boolean> {
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

                const didGenerate = await centralIdentityAPI._generateAccessCode({ priceId: item.price_id, email });
                if (!didGenerate) {
                    debug(`Failed to generate access code for product ${item.product.id} for email ${email}`);
                    continue; // Skip this item if access code generation failed
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

    /**
     * Helper function to fail a store order and update its status and error message.
     * @param storeOrder - The StoreOrderInterface instance to update.
     * @param error - The error message to set on the store order.
     */
    private async _failStoreOrder(storeOrder: StoreOrderInterface, error: string) {
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