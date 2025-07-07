import { Request, Response } from "express";
import orgEventsAPI from './orgevents.js';
import { conductor400Err, conductor500Err } from "../util/errorutils.js";
import { debug, debugError } from "../debug.js";
import StripeService from "./services/stripe-service.js";

/**
 * Handles incoming notifications of Stripe events from the webhook integration.
 */
async function processStripeWebhookEvent(req: Request, res: Response) {
  try {
    if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_WEBHOOK_SECRET) {
      return res.status(500).send({
        err: true,
        errMsg: "Invalid system configuration for Stripe event processing.",
      });
    }

    const stripeService = new StripeService();
    const event = await stripeService.parseWebhookEvent(req.body, req.headers['stripe-signature'], process.env.STRIPE_WEBHOOK_SECRET);

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

    if (result.feature !== 'events') {
      debug(`Unhandle Stripe application feature: ${result.feature}`);
      return res.status(200).send({
        err: false,
        errMsg: "Stripe event feature not handled. No action taken.",
      });
    }

    return orgEventsAPI.setRegistrationPaidStatus(
      result.checkout_session,
      result.payment_intent,
      res);
  } catch (error) {
    debugError(error);
    return conductor500Err(res);
  }
}

export default {
  processStripeWebhookEvent,
};
