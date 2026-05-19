import { Icon } from "semantic-ui-react";
import AlternateLayout from "../../../components/navigation/AlternateLayout";
import Tooltip from "../../../components/util/Tooltip";
import { useCart } from "../../../context/CartContext";
import { formatPrice } from "../../../utils/storeHelpers";
import StyledQuantitySelect from "../../../components/util/StyledQuantitySelect";
import { Link } from "react-router-dom";
import { Button, Heading } from "@libretexts/davis-react";
import useStoreMaxQuantityPerItem from "../../../hooks/useStoreMaxQuantityPerItem";

export default function CartPage() {
  const { cart, loading, removeFromCart, updateQuantity } = useCart();
  const maxQuantityPerItem = useStoreMaxQuantityPerItem();

  const hasInvalidQuantity = !!cart?.items.some(
    (item) => item.quantity > maxQuantityPerItem || item.quantity < 1
  );

  return (
    <AlternateLayout>
      <div className="mx-auto max-w-2xl px-4 pb-24 pt-16 sm:px-6 lg:max-w-7xl lg:px-8">
        <div className="flex flex-col items-center">
          <Heading level={1}>
            Shopping Cart
          </Heading>
          {cart?.items.length === 0 && (
            <div className="mt-8 text-center">
              <p className="!text-2xl text-gray-600">Your cart is empty!</p>
              <p className="text-gray-600 mt-4">
                <a
                  href="/store/catalog"
                  className="text-primary hover:text-primary-dark"
                >
                  Browse products
                </a>{" "}
                and add items to your cart before checking out.
              </p>
            </div>
          )}
        </div>
        {cart?.items && cart?.items.length > 0 && (
          <form className="mt-12 lg:grid lg:grid-cols-12 lg:items-start lg:gap-x-12 xl:gap-x-16">
            <section aria-labelledby="cart-heading" className="lg:col-span-7">
              <h2 id="cart-heading" className="sr-only">
                Items in your shopping cart
              </h2>

              <ul
                role="list"
                className="divide-y divide-gray-200 border-b border-t border-gray-200"
              >
                {cart?.items.map((item, itemIdx) => {
                  const itemExceedsMax = item.quantity > maxQuantityPerItem;
                  return (
                    <li key={item.id} className="flex py-6 sm:py-10">
                      <div className="shrink-0">
                        <img
                          alt={`Image of ${item.product.name}`}
                          src={item.product.images[0]}
                          className="size-24 rounded-md object-cover sm:size-48"
                        />
                      </div>

                      <div className="ml-4 flex flex-1 flex-col justify-between sm:ml-6">
                        <div className="relative pr-9 sm:grid sm:grid-cols-2 sm:gap-x-6 sm:pr-0">
                          <div>
                            <div className="flex justify-between">
                              <h3 className="text-sm">
                                <a
                                  href={`/store/product/${item.product.id}`}
                                  className="font-semibold text-lg text-gray-700 hover:text-gray-800"
                                >
                                  {item.product.name} - {item.price.nickname}
                                </a>
                              </h3>
                            </div>
                            <p className="mt-1 text-sm font-medium text-gray-900">
                              {formatPrice(item.price.unit_amount, true)}
                            </p>
                          </div>

                          <div className="mt-4 sm:mt-0 sm:pr-9">
                            <div className="grid w-full max-w-40 grid-cols-1">
                              <p className="sr-only">
                                Quantity, {item.product.name}
                              </p>
                              <StyledQuantitySelect
                                value={item.quantity}
                                max={maxQuantityPerItem}
                                onChange={(v) => {
                                  updateQuantity(
                                    item.product.id,
                                    item.price.id,
                                    v
                                  );
                                }}
                                label=""
                                helperText={`Up to ${maxQuantityPerItem} per item.`}
                                error={itemExceedsMax}
                                errorMessage={`Maximum ${maxQuantityPerItem} per item. Please reduce the quantity to continue.`}
                              />
                            </div>

                            <div className="absolute right-0 top-0">
                              <button
                                type="button"
                                className="-m-2 inline-flex p-2 text-gray-500 hover:text-gray-700"
                                onClick={() =>
                                  removeFromCart(item.product.id, item.price.id)
                                }
                                aria-label={`Remove ${item.product.name} from cart`}
                              >
                                <span className="sr-only">Remove</span>
                                <Icon name="x" size="large" className="size-5" aria-hidden="true" />
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>

            {/* Order summary */}
            <section
              aria-labelledby="summary-heading"
              className="mt-16 rounded-lg bg-gray-50 px-4 py-6 sm:p-6 lg:col-span-5 lg:mt-0 lg:p-8"
            >
              <Heading level={2} id="summary-heading">
                Order summary
              </Heading>

              <dl className="mt-6 space-y-4">
                <div className="flex items-center justify-between">
                  <dt className="text-sm text-gray-600">Subtotal</dt>
                  <dd className="text-sm font-medium text-gray-900">
                    {formatPrice(cart?.subtotal, true)}
                  </dd>
                </div>
                <div className="flex items-center justify-between border-t border-gray-200 pt-4">
                  <dt className="flex items-center text-sm text-gray-600">
                    <span>Shipping estimate</span>
                    <a
                      href="#"
                      className="ml-2 shrink-0 text-gray-400 hover:text-gray-500"
                    >
                      <Tooltip text="Shipping costs are estimated based on your location and the items in your cart.">
                        <Icon
                          name="question circle"
                          aria-hidden="true"
                          className="size-5"
                        />
                      </Tooltip>
                    </a>
                  </dt>
                  <dd className="text-sm font-medium text-gray-900">
                    Calculated at Checkout
                  </dd>
                </div>
                <div className="flex items-center justify-between border-t border-gray-200 pt-4">
                  <dt className="flex text-sm text-gray-600">
                    <span>Tax estimate</span>
                    <a
                      href="#"
                      className="ml-2 shrink-0 text-gray-400 hover:text-gray-500"
                    >
                      <Tooltip text="Tax is calculated based on the shipping address and items in your cart.">
                        <Icon
                          name="question circle"
                          aria-hidden="true"
                          className="size-5"
                        />
                      </Tooltip>
                    </a>
                  </dt>
                  <dd className="text-sm font-medium text-gray-900">
                    Calculated at Checkout
                  </dd>
                </div>
                <div className="flex items-center justify-between border-t border-gray-200 pt-4">
                  <dt className="text-base font-medium text-gray-900">
                    Order total
                  </dt>
                  <dd className="text-base font-medium text-gray-900">
                    {formatPrice(cart?.subtotal, true)}
                  </dd>
                </div>
              </dl>

              {hasInvalidQuantity && (
                <p role="alert" className="mt-4 text-sm text-red-700 font-medium">
                  One or more items exceed the maximum allowed quantity ({maxQuantityPerItem} per item). Please update the quantities above before checking out.
                </p>
              )}

              <div className="mt-6">
                {hasInvalidQuantity ? (
                  <Button
                    variant="primary"
                    fullWidth
                    softDisabled
                  >
                    Checkout
                  </Button>
                ) : (
                  <Link to="/store/checkout/auth-check">
                    <Button
                      variant="primary"
                      fullWidth
                    >
                      Checkout
                    </Button>
                  </Link>
                )}
              </div>
            </section>
          </form>
        )}
      </div>
    </AlternateLayout>
  );
}
