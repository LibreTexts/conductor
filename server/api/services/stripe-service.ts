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
        signingSecret: string
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

            return this.instance.webhooks.constructEvent(body, signature, signingSecret);
        } catch (error) {
            console.error('Error processing Stripe webhook event:', error);
            throw new Error('Failed to process Stripe webhook event');
        }
    }

    public async processWebhookEvent(event: Stripe.Event): Promise<{
        feature: string;
        checkout_session: Stripe.Checkout.Session;
        payment_intent: Stripe.PaymentIntent | null; // Payment Intent can be null if the order was free
    } | 'bad_request' | 'not_implemented'> {
        try {
            if (!event || !event.type || !event.data) {
                throw new Error('Invalid Stripe event data provided.');
            }
            switch (event.type) {
                case 'checkout.session.completed':
                case 'payment_intent.succeeded':
                    const data = event.data.object.object === 'checkout.session' ? event.data.object as Stripe.Checkout.Session : event.data.object as Stripe.PaymentIntent;
                    let checkout_session: Stripe.Checkout.Session | null = null;
                    let payment_intent: Stripe.PaymentIntent | null = null;

                    if (data.object === 'checkout.session') {
                        checkout_session = await this.getExpandedCheckoutSession(data.id);
                        if (!checkout_session) {
                            debug('Stripe checkout session not found. Cannot further process the event.');
                            return 'bad_request';
                        }
                        payment_intent = await this.getPaymentIntentFromCheckoutSession(checkout_session);
                    }

                    if (data.object === 'payment_intent') {
                        checkout_session = await this.getCheckoutSessionFromPaymentIntent(data);
                        payment_intent = data;
                    }

                    if (!checkout_session) {
                        debug('Stripe checkout session is missing. Cannot further process the event.');
                        return 'bad_request';
                    }

                    if (!checkout_session.metadata || !checkout_session.metadata.feature) {
                        debug('Stripe checkout session metadata is missing. Cannot further process the event.');
                        return 'bad_request';
                    }

                    switch (checkout_session.metadata?.feature) {
                        case 'events':
                        case 'store':
                            return {
                                feature: checkout_session.metadata?.feature,
                                checkout_session,
                                payment_intent,
                            }
                        default:
                            debug(`Unhandled Stripe application feature: ${checkout_session.metadata?.feature}`);
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

    public async getPaymentIntentFromCheckoutSession(checkoutSession: Stripe.Checkout.Session): Promise<Stripe.PaymentIntent | null> {
        if (!checkoutSession || !checkoutSession.payment_intent) {
            return null;
        }

        try {
            const paymentIntentId = typeof checkoutSession.payment_intent === 'string' ? checkoutSession.payment_intent : checkoutSession.payment_intent.id;
            return await this.instance.paymentIntents.retrieve(paymentIntentId);
        } catch (error) {
            console.error('Error retrieving payment intent from checkout session:', error);
            return null;
        }
    }

    public async getExpandedCheckoutSession(checkoutSessionId: string): Promise<Stripe.Checkout.Session | null> {
        if (!checkoutSessionId) {
            return null;
        }

        try {
            const session = await this.instance.checkout.sessions.retrieve(checkoutSessionId, {
                expand: ['payment_intent', 'line_items'],
            });

            if (!session) {
                return null;
            }

            return session as Stripe.Checkout.Session;
        } catch (error) {
            console.error('Error retrieving expanded checkout session:', error);
            return null;
        }
    }

    public async getCustomerEmailFromCheckoutSession(_checkoutSession: string | Stripe.Checkout.Session): Promise<string | null> {
        try {
            let checkoutSession: Stripe.Checkout.Session | null = null;
            if (typeof _checkoutSession === 'string') {
                checkoutSession = await this.getExpandedCheckoutSession(_checkoutSession);
            }
            if (!checkoutSession || !checkoutSession.customer) {
                return null;
            }


            const customerId = typeof checkoutSession.customer === 'string' ? checkoutSession.customer : checkoutSession.customer.id;
            const customer = await this.instance.customers.retrieve(customerId);

            if (!customer || customer.deleted) {
                return null;
            }

            return customer.email;
        } catch (error) {
            console.error('Error retrieving customer email from checkout session:', error);
            return null;
        }
    }

    public async getCheckoutSessionFromPaymentIntent(paymentIntent: Stripe.PaymentIntent): Promise<Stripe.Checkout.Session | null> {
        if (!paymentIntent || !paymentIntent.id) {
            return null;
        }

        try {
            const sessions = await this.instance.checkout.sessions.list({
                payment_intent: paymentIntent.id,
                limit: 1,
                expand: ['data.payment_intent', 'data.line_items'],
            });

            if (sessions.data.length < 1) {
                return null;
            }

            return sessions.data[0] as Stripe.Checkout.Session;
        } catch (error) {
            console.error('Error retrieving checkout session from payment intent:', error);
            return null;
        }
    }
}