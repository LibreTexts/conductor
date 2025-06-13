import { Stripe } from 'stripe';
import { debug } from '../../debug';

export default class StripeService {
    private instance = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
        apiVersion: '2025-05-28.basil',
    })

    constructor() { }

    public getInstance(): Stripe {
        if (!this.instance) {
            this.instance = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
                apiVersion: '2025-05-28.basil',
            });
        }
        return this.instance;
    }

    public async parseWebhookEvent(
        body: string | Buffer,
        signatureHeader: string | string[] | undefined,
    ): Promise<Stripe.Event> {
        try {
            let signature: string | undefined;
            if (Array.isArray(signatureHeader)) {
                signature = signatureHeader[0];
            }
            else if (typeof signatureHeader === 'string') {
                signature = signatureHeader;
            }

            if (!signature) {
                throw new Error('Invalid Stripe event signature provided.');
            }

            return this.instance.webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET || '');
        } catch (error) {
            console.error('Error processing Stripe webhook event:', error);
            throw new Error('Failed to process Stripe webhook event');
        }
    }

    public async processWebhookEvent(event: Stripe.Event): Promise<{
        feature: string;
        checkout_session: Stripe.Checkout.Session;
        payment_intent: Stripe.PaymentIntent;
    } | 'bad_request' | 'not_implemented'> {
        try {
            if (!event || !event.type || !event.data) {
                throw new Error('Invalid Stripe event data provided.');
            }
            switch (event.type) {
                case 'payment_intent.succeeded':
                    const paymentIntent: Record<string, any> = event.data.object;
                    if (!paymentIntent.id) {
                        return 'bad_request';
                    }

                    const piSessions = await this.instance.checkout.sessions.list({
                        payment_intent: paymentIntent.id,
                        limit: 1,
                        expand: ['data.payment_intent'],
                    });

                    if (piSessions.data.length < 1) {
                        return 'bad_request';
                    }

                    const checkoutSession = piSessions.data[0];
                    if (checkoutSession.metadata?.application !== 'conductor') {
                        debug(`Stripe event for unknown application: ${checkoutSession.metadata?.application}`);
                        return 'not_implemented';
                    }

                    switch (checkoutSession.metadata.feature) {
                        case 'events':
                            return {
                                feature: checkoutSession.metadata.feature,
                                checkout_session: checkoutSession,
                                payment_intent: paymentIntent as Stripe.PaymentIntent,
                            }
                        default:
                            debug(`Unhandle Stripe application feature: ${checkoutSession.metadata.feature}`);
                            return 'not_implemented';
                    }
                default:
                    debug(`Unhandled Stripe event type: ${event.type}`);
                    return 'not_implemented';
            }
        } catch (error) {
            console.error('Error processing Stripe webhook event:', error);
            throw new Error('Failed to process Stripe webhook event');
        }
    }
}