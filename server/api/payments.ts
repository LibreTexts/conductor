import { Request, Response } from "express";
import Stripe from "stripe";
import orgEventsAPI from './orgevents.js';
import { conductor400Err, conductor500Err } from "../util/errorutils.js";
import { debug, debugError } from "../debug.js";

/**
 * Handles incoming notifications of Stripe events from the webhook integration.
 */
async function processStripeWebhookEvent(req: Request, res: Response) {
  const signature = req.headers["stripe-signature"];
  let event: Stripe.Event;

  if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_WEBHOOK_SECRET) {
    return res.status(500).send({
      err: true,
      errMsg: "Invalid system configuration for Stripe event processing.",
    });
  }
  if (!signature) {
    return res.status(400).send({
      err: true,
      errMsg: "Invalid Stripe event signature provided.",
    });
  }
  const stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2022-11-15" });

  try {
    // the body must be parsed as raw, not JSON, in previous middleware
    event = stripeClient.webhooks.constructEvent(req.body, signature, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    debugError(err);
    return conductor500Err(res);
  }

  switch (event.type) {
    case 'payment_intent.succeeded':
      const paymentIntent: Record<string, any> = event.data.object;
      if (!paymentIntent.id) {
        return conductor400Err(res);
      }
    
      const piSessions = await stripeClient.checkout.sessions.list({
        payment_intent: paymentIntent.id,
        limit: 1,
        expand: ['data.payment_intent'],
      });
      if (piSessions.data.length < 1) {
        return conductor400Err(res);
      }

      const checkoutSession = piSessions.data[0];
      if (checkoutSession.metadata?.application !== 'conductor') {
        break;
      }

      switch (checkoutSession.metadata.feature) {
        case 'events':
          return orgEventsAPI.setRegistrationPaidStatus(checkoutSession, paymentIntent as Stripe.PaymentIntent, res);
        default:
          debug(`Unhandle Stripe application feature: ${checkoutSession.metadata.feature}`);
      }

      break;
    default:
      debug(`Unhandled Stripe event type: ${event.type}`);
  }

  return res.send();
}

export default {
  processStripeWebhookEvent,
};
