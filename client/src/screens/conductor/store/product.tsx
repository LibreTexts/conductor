import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { Tab, TabGroup, TabList, TabPanel, TabPanels } from "@headlessui/react";
import AlternateLayout from "../../../components/navigation/AlternateLayout";
import { useQuery } from "@tanstack/react-query";
import { StoreProduct, StoreProductPrice } from "../../../types";
import { useParams } from "react-router-dom";
import api from "../../../api";
import StyledRadioSelect from "../../../components/util/StyledRadioSelect";
import StyledQuantitySelect from "../../../components/util/StyledQuantitySelect";
import { APP_LICENSE_FAQS, BOOK_FAQS } from "../../../components/store/FAQS";
import Linkify from "linkify-react";
import { findBookPrice, formatPrice } from "../../../utils/storeHelpers";
import { useCart } from "../../../context/CartContext";
import { useModals } from "../../../context/ModalContext";
import ConfirmModal from "../../../components/ConfirmModal";
import { useNotifications } from "../../../context/NotificationContext";
import SearchableDropdown from "../../../components/util/SearchableDropdown";

const MAX_QUANTITY = 10;

export default function ProductPage() {
  const { openModal, closeAllModals } = useModals();
  const { addNotification } = useNotifications();
  const { cart, addToCart, removeFromCart, loading: cartLoading } = useCart();
  const params = useParams<{ product_id: string }>();
  const { data: product, isFetching } = useQuery<StoreProduct>({
    queryKey: ["store-product", params.product_id],
    queryFn: async () => {
      if (!params.product_id) {
        throw new Error("Product ID is required");
      }
      const res = await api.getStoreProduct(params.product_id);
      if (res.data.err) {
        throw new Error(res.data.errMsg);
      }

      setLoading(false);
      return res.data.product;
    },
    enabled: !!params.product_id,
  });

  const [quantity, setQuantity] = useState(1);
  const [hardcover, setHardcover] = useState(false);
  const [color, setColor] = useState(false);
  const [loading, setLoading] = useState(isFetching);
  const [selectedPriceId, setSelectedPriceId] = useState<string | null>(null);
  const didSetInitialPrice = useRef(false);

  const isBook = useMemo(() => {
    if (!product) return false;
    return (
      product.metadata["store_category"] === "books" &&
      product.metadata["book_id"]
    );
  }, [product]);

  const price = useMemo(() => {
    if (!product) return undefined;

    let _price: StoreProductPrice | undefined = undefined;
    if (isBook) {
      _price = findBookPrice({
        product,
        hardcover,
        color,
      });
    } else {
      if (selectedPriceId) {
        _price = product.prices.find((p) => p.id === selectedPriceId);
      }
    }

    return _price;
  }, [product, hardcover, color, selectedPriceId, isBook]);

  useEffect(() => {
    if (!product) return;
    if (loading) return;
    if (didSetInitialPrice.current) return;

    // If the product is a book, don't worry about setting the initial price
    if (isBook) {
      didSetInitialPrice.current = true;
    }

    // If we haven't set the initial price yet, set it based on the product's first price
    if (!didSetInitialPrice.current) {
      const initialPrice = product.prices[0];
      setSelectedPriceId(initialPrice.id);
      didSetInitialPrice.current = true;
    }

    // If the selected price is not valid, reset it to the first price
    if (
      selectedPriceId &&
      !product.prices.find((p) => p.id === selectedPriceId)
    ) {
      setSelectedPriceId(product.prices[0].id);
    }
  }, [product, loading, selectedPriceId, isBook]);

  const disabled = useMemo(() => {
    if (!product) return true;
    if (!price) return true;
  }, [product, price]);

  function handleAddToCart() {
    if (!product) return;
    if (!price || !price.unit_amount) {
      console.error("Invalid price for product", product.id);
      return;
    }

    // Check that the user is not unintentionally adding the same product with different options selected (and therefore, a potentially different price)
    const sameItemDifferentPrice = cart?.items.find((item) => {
      return item.product.id === product.id && item.price.id !== price.id;
    });

    if (sameItemDifferentPrice) {
      openModal(
        <ConfirmModal
          text="You are about to add a product to your cart that has different options selected than the one already in your cart (and therefore, potentially different pricing). Are you sure you want to continue?"
          confirmText="Remove the existing item first"
          cancelText="I understand, add this item"
          onCancel={() => {
            addToCart(product, price, quantity);
            showAddedToCartNotification(product.name);
            closeAllModals();
          }}
          onConfirm={() => {
            removeFromCart(
              sameItemDifferentPrice.product.id,
              sameItemDifferentPrice.price.id
            );
            addToCart(product, price, quantity);
            showAddedToCartNotification(product.name);
            closeAllModals();
          }}
        />
      );

      return;
    }

    addToCart(product, price, quantity);
    showAddedToCartNotification(product.name);
  }

  function showAddedToCartNotification(productName: string) {
    addNotification({
      type: "success",
      message: `${productName} was added to your cart.`,
      duration: 3000,
    });
  }

  return (
    <AlternateLayout>
      <div className="mx-auto px-4 py-12 sm:px-6 sm:py-12 lg:max-w-7xl lg:px-8">
        <div className="lg:grid lg:grid-cols-7 lg:grid-rows-1 lg:gap-x-8 lg:gap-y-10 xl:gap-x-12">
          <div className="lg:col-span-4 lg:row-end-1">
            <img
              alt={`${product?.name} product image`}
              src={product?.images[0]}
              className="aspect-[4/3] w-full rounded-lg bg-gray-100 object-contain"
            />
          </div>

          {/* Product details */}
          <div className="mx-auto mt-14 max-w-2xl sm:mt-16 lg:col-span-3 lg:row-span-2 lg:row-end-2 lg:mt-0 lg:min-w-full">
            <div className="flex flex-col">
              <div className="mt-4">
                <h1 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">
                  {product?.name}
                </h1>

                <h2 id="information-heading" className="sr-only">
                  Product information
                </h2>
                {product?.metadata["store_category"] === "books" && (
                  <div className="flex flex-col">
                    <p className="!mt-3 text-lg text-gray-700">
                      {product?.metadata["book_author"]}
                    </p>
                    <p className="mt-2 text-sm text-gray-600">
                      Book ID: {product?.metadata["book_id"]} | Pages:{" "}
                      {product?.metadata["num_pages"]}
                    </p>
                  </div>
                )}
              </div>
            </div>

            <p className="mt-6 text-gray-600">{product?.description}</p>
            {!isBook && (
              <>
                <p className="font-semibold mb-2">Select Option:</p>
                <StyledRadioSelect
                  fieldName="variant"
                  fieldLabel="Select Option"
                  options={
                    product?.prices.map((p) => ({
                      title: p.nickname || p.id,
                      value: p.id,
                    })) || []
                  }
                  selectedValue={selectedPriceId || ""}
                  onChange={(value) => setSelectedPriceId(value)}
                />
              </>
            )}
            {isBook && (
              <>
                <p className="mt-6 font-semibold">Select Binding:</p>
                <StyledRadioSelect
                  fieldName="book_binding"
                  fieldLabel="Select Book Binding"
                  options={[
                    { title: "Paperback", value: "paperback" },
                    { title: "Hardcover", value: "hardcover" },
                  ]}
                  defaultValue="paperback"
                  selectedValue={hardcover ? "hardcover" : "paperback"}
                  onChange={(value) => setHardcover(value === "hardcover")}
                />
                <p className="mt-6 font-semibold">Select Color Option:</p>
                <StyledRadioSelect
                  fieldName="book_color"
                  fieldLabel="Select Color Options"
                  options={[
                    { title: "B & W", value: "bw" },
                    { title: "color", value: "color" },
                  ]}
                  defaultValue="bw"
                  selectedValue={color ? "color" : "bw"}
                  onChange={(value) => setColor(value === "color")}
                />
              </>
            )}
            {!isBook && (
              <p className="mt-6 text-xs  text-slate-500">
                Only one active subscription per user is allowed at a time. You
                can purchase access codes on behalf of other users, but you will
                not be able to apply multiple access codes for the same app to
                your account at the same time to stack discounts/extend access.
              </p>
            )}
            <StyledQuantitySelect
              className="mt-6"
              value={quantity}
              onChange={setQuantity}
              min={1}
              max={MAX_QUANTITY}
            />

            {/* <p className="mt-6 text-2xl font-semibold text-gray-900">
              Subtotal: {formatPrice(price, true)}
            </p> */}

            <div className="mt-6 grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
              <button
                type="button"
                className={`flex !w-full items-center justify-center rounded-md border border-transparent bg-primary px-8 py-3 text-base font-medium text-white hover:bg-blue-600 disabled:bg-gray-300 disabled:text-gray-500 ${
                  isBook ? "col-span-1" : "col-span-2"
                }`}
                onClick={handleAddToCart}
                disabled={disabled || cartLoading}
              >
                Add to Cart -{" "}
                {formatPrice((price?.unit_amount || 0) * quantity, true)}
              </button>
              {isBook && (
                <button
                  type="button"
                  className="flex w-full items-center justify-center rounded-md border border-primary px-8 py-3 text-base font-medium text-primary hover:bg-primary hover:text-white"
                >
                  Read Online
                </button>
              )}
            </div>

            {/* <div className="mt-10 border-t border-gray-200 pt-10">
              <h3 className="text-sm font-medium text-gray-900">Highlights</h3>
              <div className="mt-4">
                <ul
                  role="list"
                  className="list-disc space-y-1 pl-5 text-sm/6 text-gray-500 marker:text-gray-300"
                >
                  {product.highlights.map((highlight) => (
                    <li key={highlight} className="pl-2">
                      {highlight}
                    </li>
                  ))}
                </ul>
              </div>
            </div> */}

            {isBook ? (
              <div className="mt-10 border-t border-gray-200 pt-10">
                <h3 className="font-medium text-gray-900">
                  License Information
                </h3>
                <p className="mt-4 text-gray-500">
                  <a
                    href={`https://commons.libretexts.org/book/${product?.metadata["book_id"]}`}
                    target="_blank"
                    className="font-medium text-primary hover:text-primary-hover"
                  >
                    Please view full licensing details for this book here.
                  </a>
                </p>
              </div>
            ) : (
              <div className="mt-10 border-t border-gray-200 pt-10">
                <h3 className="font-medium text-gray-900">
                  Delivery Information
                </h3>
                <p className="mt-4 text-gray-500">
                  This product is delivered digitally. After purchase, you will
                  receive an email with an access code and instructions on how
                  to redeem it.
                </p>
              </div>
            )}
          </div>

          <div className="mx-auto mt-16 w-full max-w-2xl lg:col-span-4 lg:mt-0 lg:max-w-none">
            <TabGroup>
              <div className="border-b border-gray-200">
                <TabList className="-mb-px flex space-x-8">
                  {/* <Tab className="whitespace-nowrap border-b-2 border-transparent py-6 text-sm font-medium text-gray-700 hover:border-gray-300 hover:text-gray-800 data-[selected]:border-indigo-600 data-[selected]:text-indigo-600">
                    Customer Reviews
                  </Tab> */}
                  <Tab className="whitespace-nowrap border-b-2 border-transparent py-6 text-sm font-medium text-gray-700 hover:border-gray-300 hover:text-gray-800 data-[selected]:border-indigo-600 data-[selected]:text-indigo-600">
                    FAQ
                  </Tab>
                </TabList>
              </div>
              <TabPanels as={Fragment}>
                {/* d */}

                <TabPanel className="text-sm text-gray-500">
                  <h3 className="sr-only">Frequently Asked Questions</h3>

                  <dl>
                    {(isBook ? BOOK_FAQS : APP_LICENSE_FAQS).map((faq) => (
                      <Fragment key={faq.question}>
                        <dt className="mt-10 font-medium text-gray-900">
                          {faq.question}
                        </dt>
                        <dd className="mt-2 text-sm/2 text-gray-600">
                          <Linkify>{faq.answer}</Linkify>
                        </dd>
                      </Fragment>
                    ))}
                  </dl>
                </TabPanel>
              </TabPanels>
            </TabGroup>
          </div>
        </div>
      </div>
    </AlternateLayout>
  );
}
