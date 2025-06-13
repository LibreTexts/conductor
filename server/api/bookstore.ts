import BookstoreService from "./services/bookstore-service";
import StripeService from "./services/stripe-service";

const bookstoreService = new BookstoreService();


export async function getBookstoreProducts({
  limit = 1000,
  page,
}: {
  limit?: number;
  page?: string;
}): Promise<Stripe.Response<Stripe.ApiSearchResult<Stripe.Product>>> {
  try {
    return await stripe.products.search({
      query: 'metadata["bookstore"]:"true"',
      expand: ['data.default_price'],
      limit,
      page,
    });
  } catch (error) {
    console.error("Error fetching bookstore products:", error);
    throw new Error("Failed to fetch bookstore products");
  }
}