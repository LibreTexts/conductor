import { Icon } from "semantic-ui-react";
import AlternateLayout from "../../../components/navigation/AlternateLayout";
import Tooltip from "../../../components/util/Tooltip";
import { useCart } from "../../../context/CartContext";
import { formatPrice } from "../../../utils/storeHelpers";
import StyledQuantitySelect from "../../../components/util/StyledQuantitySelect";
import { Link } from "react-router-dom";

export default function CartPage() {
  const { cart, loading, removeFromCart, updateQuantity } = useCart();
  return (
    <AlternateLayout>
      <div className="mx-auto max-w-2xl px-4 pb-24 pt-16 sm:px-6 lg:max-w-7xl lg:px-8">
        <div className="flex flex-col items-center">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
            Shopping Cart
          </h1>
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
                {cart?.items.map((item, itemIdx) => (
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
                          {/* <div className="mt-1 flex text-sm">
                          <p className="text-gray-500">{product.color}</p>
                          {product.size ? (
                            <p className="ml-4 border-l border-gray-200 pl-4 text-gray-500">
                              {product.size}
                            </p>
                          ) : null}
                        </div> */}
                          <p className="mt-1 text-sm font-medium text-gray-900">
                            {formatPrice(item.price.unit_amount, true)}
                          </p>
                        </div>

                        <div className="mt-4 sm:mt-0 sm:pr-9">
                          <div className="grid w-full max-w-16 grid-cols-1">
                            <p className="sr-only">
                              Quantity, {item.product.name}
                            </p>
                            <StyledQuantitySelect
                              value={item.quantity}
                              onChange={(v) => {
                                updateQuantity(
                                  item.product.id,
                                  item.price.id,
                                  v
                                );
                              }}
                              max={10}
                              label=""
                            />
                          </div>

                          <div className="absolute right-0 top-0">
                            <button
                              type="button"
                              className="-m-2 inline-flex p-2 text-gray-400 hover:text-gray-500"
                              onClick={() =>
                                removeFromCart(item.product.id, item.price.id)
                              }
                            >
                              <span className="sr-only">Remove</span>
                              <Icon name="x" size="large" className="size-5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </section>

            {/* Order summary */}
            <section
              aria-labelledby="summary-heading"
              className="mt-16 rounded-lg bg-gray-50 px-4 py-6 sm:p-6 lg:col-span-5 lg:mt-0 lg:p-8"
            >
              <h2
                id="summary-heading"
                className="text-lg font-medium text-gray-900"
              >
                Order summary
              </h2>

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

              <div className="mt-6">
                <Link to="/store/checkout/auth-check">
                  <button
                    type="submit"
                    className="w-full rounded-md border border-transparent bg-primary px-4 py-3 text-base font-medium text-white shadow-sm hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-gray-50"
                  >
                    Checkout
                  </button>
                </Link>
              </div>
            </section>
          </form>
        )}
      </div>
    </AlternateLayout>
  );
}
