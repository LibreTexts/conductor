import { Request, Response } from "express";
import StoreService from "./services/store-service";
import { z } from "zod";
import { CreateCheckoutSessionSchema, GetStoreProductSchema, GetStoreProductsSchema, GetShippingOptionsSchema, UpdateCheckoutSessionSchema, GetMostPopularStoreProductsSchema } from "./validators/store";
import { conductor400Err, conductor500Err } from "../util/errorutils";
import { debugError } from "../debug";
import { LuluWebhookData, StoreShippingOption } from "../types";
import StripeService from "./services/stripe-service";

const storeService = new StoreService();

export async function getStoreProduct(req: z.infer<typeof GetStoreProductSchema>, res: Response) {
  try {
    const { product_id } = req.params;

    const product = await storeService.searchStoreProduct(product_id);
    if (!product) {
      return res.status(404).send({
        err: true,
        message: "Store product not found.",
      });
    }

    return res.status(200).send({
      err: false,
      message: "Store product fetched successfully.",
      product,
    });
  } catch (error) {
    debugError(error);
    return conductor500Err(res);
  }
}


export async function getStoreProducts(req: z.infer<typeof GetStoreProductsSchema>, res: Response) {
  try {
    const limit = req.query?.limit ? parseInt(req.query.limit?.toString(), 10) : 100;
    const page = req.query?.page ? parseInt(req.query.page?.toString(), 10) : 1;

    const results = await storeService.getStoreProducts({
      page: page,
      starting_after: req.query?.starting_after,
      limit: limit,
      category: req.query?.category,
      query: req.query?.query
    });

    return res.status(200).send({
      err: false,
      message: "Store products fetched successfully.",
      products: results.items,
      meta: {
        has_more: results.has_more,
        total_count: results.total_count,
        cursor: results.cursor,
      }
    })
  } catch (error) {
    debugError(error);
    return conductor500Err(res);
  }
}

export async function getMostPopularStoreProducts(req: z.infer<typeof GetMostPopularStoreProductsSchema>, res: Response) {
  try {
    const limit = req.query?.limit ? parseInt(req.query.limit?.toString(), 10) : 10;

    const products = await storeService.getMostPopularStoreProducts({ limit });

    return res.status(200).send({
      err: false,
      message: "Most popular store products fetched successfully.",
      products,
    });
  } catch (error) {
    debugError(error);
    return conductor500Err(res);
  }
}

export async function createCheckoutSession(req: z.infer<typeof CreateCheckoutSessionSchema>, res: Response) {
  try {
    const { items, shipping_option_id, shipping_address } = req.body;

    const shippingOptions = await storeService.getShippingOptions({
      items,
      shipping_address,
    });

    let foundShippingOption: StoreShippingOption | "digital_delivery_only" | undefined = undefined
    if (Array.isArray(shippingOptions) && shipping_option_id !== "digital_delivery_only") {
      foundShippingOption = shippingOptions.find(option => option.id === shipping_option_id);
    } else if (shippingOptions === "digital_delivery_only" && shipping_option_id === "digital_delivery_only") {
      foundShippingOption = "digital_delivery_only";
    }

    if (!foundShippingOption) {
      return res.status(400).send({
        err: true,
        message: "Selected shipping option is not available.",
      });
    }

    const { session_id, checkout_url } = await storeService.createCheckoutSession({ items, shipping_option: foundShippingOption, shipping_address });

    return res.status(200).send({
      err: false,
      message: "Checkout session created successfully.",
      session_id,
      checkout_url,
    })
  } catch (error) {
    debugError(error);
    return conductor500Err(res);
  }
}

export async function getShippingOptions(req: z.infer<typeof GetShippingOptionsSchema>, res: Response) {
  try {
    const options = await storeService.getShippingOptions({
      items: req.body.items,
      shipping_address: req.body.shipping_address,
    });
    return res.status(200).send({
      err: false,
      message: "Shipping options fetched successfully.",
      options,
    });
  } catch (error) {
    debugError(error);
    return conductor500Err(res);
  }
}

export async function processLuluWebhook(req: Request, res: Response) {
  try {
    // Request body is a buffer - parse it to json
    const buffer = Buffer.from(req.body);
    const json = JSON.parse(buffer.toString());

    // Check JSON object has the expected structure
    if (!json || !json.data || !json.topic || json.topic !== 'PRINT_JOB_STATUS_CHANGED') {
      return conductor400Err(res);
    }

    const data = json.data as LuluWebhookData['data'];
    await storeService.processLuluOrderUpdate({ data });

    return res.status(200).send({
      err: false,
      message: "Lulu webhook processed successfully.",
    });
  } catch (error) {
    debugError(error);
    return conductor500Err(res);
  }
}

export async function processStripeWebhook(req: Request, res: Response) {
  try {
    if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_STORE_WEBHOOK_SECRET) {
      return conductor500Err(res);
    }

    const stripeService = new StripeService();
    const event = await stripeService.parseWebhookEvent(req.body, req.headers['stripe-signature'], process.env.STRIPE_STORE_WEBHOOK_SECRET);

    const result = await stripeService.processWebhookEvent(event);
    if (result === 'bad_request') {
      return conductor400Err(res);
    }

    if (result === 'not_implemented') {
      return res.status(200).send({
        err: false,
        errMsg: "Stripe event type not implemented. No action taken.",
      });
    }

    if (result.feature !== 'store') {
      debugError(`Unhandled Stripe application feature: ${result.feature}`);
      return res.status(200).send({
        err: false,
        errMsg: "Stripe event feature not handled. No action taken.",
      });
    }

    // We don't need to wait for this to finish, so we can just call it
    storeService.processOrder({
      checkout_session: result.checkout_session,
      payment_intent: result.payment_intent,
    }).catch((error) => {
      debugError(error);
    });

    return res.status(200).send({
      err: false,
      message: "Stripe webhook processed successfully.",
    });
  } catch (error) {
    debugError(error);
    return conductor500Err(res);
  }
}

export async function syncBooksToStripe(req: Request, res: Response) {
  try {
    // Don't await this, just start the sync process
    storeService.syncBooksToStripe();

    return res.status(200).send({
      err: false,
      message: "Book sync initiated successfully. This may take a while.",
    });
  } catch (error) {
    debugError(error);
    return conductor500Err(res);
  }
}

export default {
  getStoreProduct,
  getStoreProducts,
  getMostPopularStoreProducts,
  createCheckoutSession,
  getShippingOptions,
  processLuluWebhook,
  processStripeWebhook,
  syncBooksToStripe,
};
