import Stripe from "stripe";
import { debug } from "../../debug";
import StripeService from "./stripe-service";


export default class BookstoreService {
    private stripeService = new StripeService();
    constructor() { }

    public async getBookstoreProducts({ limit, page }: {
        limit?: number;
        page?: string;
    }): Promise<Stripe.Response<Stripe.ApiSearchResult<Stripe.Product>>> {
        try {
            const stripe = this.stripeService.getInstance();
            return await stripe.products.search({
                query: 'metadata["bookstore"]:"true"',
                expand: ['data.default_price'],
                limit: limit || 1000,
                page,
            });
        } catch (error) {
            debug("Error fetching bookstore products:", error);
            throw new Error("Failed to fetch bookstore products");
        }
    }
}