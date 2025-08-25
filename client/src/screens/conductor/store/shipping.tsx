import { Radio, RadioGroup } from "@headlessui/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { useCart } from "../../../context/CartContext";
import {
  StoreCheckoutForm,
  StoreDigitalDeliveryOption,
  StoreGetShippingOptionsRes,
  StoreShippingOption,
} from "../../../types";
import useDebounce from "../../../hooks/useDebounce";
import api from "../../../api";
import AlternateLayout from "../../../components/navigation/AlternateLayout";
import ShippingOptions from "../../../components/store/ShippingOptions";
import Input from "../../../components/NextGenInputs/Input";
import Select from "../../../components/NextGenInputs/Select";
import { formatPrice } from "../../../utils/storeHelpers";
import { Icon } from "semantic-ui-react";
import LoadingSpinner from "../../../components/LoadingSpinner";
import { useTypedSelector } from "../../../state/hooks";
import { useModals } from "../../../context/ModalContext";
import ConfirmOrderModal from "../../../components/store/ConfirmOrderModal";

const STATE_CODES = [
  {
    name: "Alabama",
    abbreviation: "AL",
  },
  {
    name: "Alaska",
    abbreviation: "AK",
  },
  {
    name: "American Samoa",
    abbreviation: "AS",
  },
  {
    name: "Arizona",
    abbreviation: "AZ",
  },
  {
    name: "Arkansas",
    abbreviation: "AR",
  },
  {
    name: "California",
    abbreviation: "CA",
  },
  {
    name: "Colorado",
    abbreviation: "CO",
  },
  {
    name: "Connecticut",
    abbreviation: "CT",
  },
  {
    name: "Delaware",
    abbreviation: "DE",
  },
  {
    name: "District Of Columbia",
    abbreviation: "DC",
  },
  {
    name: "Federated States Of Micronesia",
    abbreviation: "FM",
  },
  {
    name: "Florida",
    abbreviation: "FL",
  },
  {
    name: "Georgia",
    abbreviation: "GA",
  },
  {
    name: "Guam",
    abbreviation: "GU",
  },
  {
    name: "Hawaii",
    abbreviation: "HI",
  },
  {
    name: "Idaho",
    abbreviation: "ID",
  },
  {
    name: "Illinois",
    abbreviation: "IL",
  },
  {
    name: "Indiana",
    abbreviation: "IN",
  },
  {
    name: "Iowa",
    abbreviation: "IA",
  },
  {
    name: "Kansas",
    abbreviation: "KS",
  },
  {
    name: "Kentucky",
    abbreviation: "KY",
  },
  {
    name: "Louisiana",
    abbreviation: "LA",
  },
  {
    name: "Maine",
    abbreviation: "ME",
  },
  {
    name: "Marshall Islands",
    abbreviation: "MH",
  },
  {
    name: "Maryland",
    abbreviation: "MD",
  },
  {
    name: "Massachusetts",
    abbreviation: "MA",
  },
  {
    name: "Michigan",
    abbreviation: "MI",
  },
  {
    name: "Minnesota",
    abbreviation: "MN",
  },
  {
    name: "Mississippi",
    abbreviation: "MS",
  },
  {
    name: "Missouri",
    abbreviation: "MO",
  },
  {
    name: "Montana",
    abbreviation: "MT",
  },
  {
    name: "Nebraska",
    abbreviation: "NE",
  },
  {
    name: "Nevada",
    abbreviation: "NV",
  },
  {
    name: "New Hampshire",
    abbreviation: "NH",
  },
  {
    name: "New Jersey",
    abbreviation: "NJ",
  },
  {
    name: "New Mexico",
    abbreviation: "NM",
  },
  {
    name: "New York",
    abbreviation: "NY",
  },
  {
    name: "North Carolina",
    abbreviation: "NC",
  },
  {
    name: "North Dakota",
    abbreviation: "ND",
  },
  {
    name: "Northern Mariana Islands",
    abbreviation: "MP",
  },
  {
    name: "Ohio",
    abbreviation: "OH",
  },
  {
    name: "Oklahoma",
    abbreviation: "OK",
  },
  {
    name: "Oregon",
    abbreviation: "OR",
  },
  {
    name: "Palau",
    abbreviation: "PW",
  },
  {
    name: "Pennsylvania",
    abbreviation: "PA",
  },
  {
    name: "Puerto Rico",
    abbreviation: "PR",
  },
  {
    name: "Rhode Island",
    abbreviation: "RI",
  },
  {
    name: "South Carolina",
    abbreviation: "SC",
  },
  {
    name: "South Dakota",
    abbreviation: "SD",
  },
  {
    name: "Tennessee",
    abbreviation: "TN",
  },
  {
    name: "Texas",
    abbreviation: "TX",
  },
  {
    name: "Utah",
    abbreviation: "UT",
  },
  {
    name: "Vermont",
    abbreviation: "VT",
  },
  {
    name: "Virgin Islands",
    abbreviation: "VI",
  },
  {
    name: "Virginia",
    abbreviation: "VA",
  },
  {
    name: "Washington",
    abbreviation: "WA",
  },
  {
    name: "West Virginia",
    abbreviation: "WV",
  },
  {
    name: "Wisconsin",
    abbreviation: "WI",
  },
  {
    name: "Wyoming",
    abbreviation: "WY",
  },
  {
    name: "Alberta",
    abbreviation: "AB",
  },
  {
    name: "British Columbia",
    abbreviation: "BC",
  },
  {
    name: "Manitoba",
    abbreviation: "MB",
  },
  {
    name: "New Brunswick",
    abbreviation: "NB",
  },
  {
    name: "Newfoundland and Labrador",
    abbreviation: "NL",
  },
  {
    name: "Northwest Territories",
    abbreviation: "NT",
  },
  {
    name: "Nova Scotia",
    abbreviation: "NS",
  },
  {
    name: "Nunavut",
    abbreviation: "NU",
  },
  {
    name: "Ontario",
    abbreviation: "ON",
  },
  {
    name: "Prince Edward Island",
    abbreviation: "PE",
  },
  {
    name: "Quebec",
    abbreviation: "QC",
  },
  {
    name: "Saskatchewan",
    abbreviation: "SK",
  },
  {
    name: "Yukon Territory",
    abbreviation: "YT",
  },
];

export default function ShippingPage() {
  const { cart, hasDigitalProducts, hasPhysicalProducts } = useCart();
  const { debounce } = useDebounce();
  const { openModal, closeAllModals } = useModals();
  const user = useTypedSelector((state) => state.user);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const shippingCalculated = useRef(false);
  const [shippingLoading, setShippingLoading] = useState(false);
  const [shippingOptions, setShippingOptions] =
    useState<StoreGetShippingOptionsRes>("digital_delivery_only");
  const [selectedShippingOption, setSelectedShippingOption] =
    useState<StoreShippingOption | null>(null);
  const [selectedDigitalDeliveryOption, setSelectedDigitalDeliveryOption] =
    useState<StoreDigitalDeliveryOption | null>(null);

  const { control, getValues, setValue, watch, trigger } =
    useForm<StoreCheckoutForm>({
      defaultValues: {
        first_name: "",
        last_name: "",
        company: "",
        email: "",
        phone: "",
        address_line_1: "",
        address_line_2: "",
        city: "",
        state: "",
        postal_code: "",
        country: "US",
      },
    });

  const proceedDisabled = useMemo(() => {
    if (!cart || cart.items.length === 0) return true;
    if (!shippingCalculated.current) return true;
    if (shippingLoading) return true;

    // If there are digital products and the user is logged in, a digital delivery option must be selected
    if (hasDigitalProducts && user?.uuid && !selectedDigitalDeliveryOption) {
      return true;
    }

    if (hasPhysicalProducts && !selectedShippingOption) {
      return true;
    }

    return false;
  }, [
    cart,
    shippingCalculated.current,
    selectedShippingOption,
    shippingOptions,
    shippingLoading,
    hasDigitalProducts,
    hasPhysicalProducts,
    selectedDigitalDeliveryOption,
    user?.uuid
  ]);

  const updateShippingOptionsDebounced = debounce(updateShippingOptions, 500);
  useEffect(() => {
    const subscription = watch((value, data) => {
      updateShippingOptionsDebounced();
    });
    return () => subscription.unsubscribe();
  }, [cart, watch]);

  async function updateShippingOptions() {
    try {
      if (!cart || cart.items.length === 0) {
        setError("Cart is empty");
        return;
      }

      setShippingLoading(true);
      setError(null);
      const valid = await trigger();
      if (!valid) return;

      const response = await api.getShippingOptions({
        items: cart.items.map((item) => ({
          price_id: item.price.id,
          product_id: item.product.id,
          quantity: item.quantity,
        })),
        shipping_address: {
          address_line_1: getValues("address_line_1"),
          city: getValues("city"),
          state: getValues("state"),
          postal_code: getValues("postal_code"),
          country: getValues("country"),
        },
      });

      if (response.data.err) {
        setError(response.data.errMsg);
        return;
      }

      setShippingOptions(response.data.options);
      shippingCalculated.current = true;

      if (response.data.options === "digital_delivery_only") {
        setSelectedShippingOption(null);
      } else if (response.data.options.length > 0) {
        // Automatically select the first shipping option
        setSelectedShippingOption(response.data.options[0]);
      } else {
        setSelectedShippingOption(null);
      }
    } catch (error: any) {
      console.error("Error updating shipping options:", error);
      setError(
        "Failed to update shipping options. Please check your address and try again: " +
          error.message
      );
    } finally {
      setShippingLoading(false);
    }
  }

  async function confirmOrder() {
    try {
      setLoading(true);

      // If there are digital products and the user is logged in, use their selected digital delivery option
      // Otherwise, if there are digital products but the user is not logged in, default to "email_access_codes"
      // If there are no digital products, set to null
      const digitalDeliveryOption =
        hasDigitalProducts && user?.uuid
          ? selectedDigitalDeliveryOption || "email_access_codes"
          : null;

      const response = await api.createCheckoutSession({
        items:
          cart?.items.map((item) => ({
            price_id: item.price.id,
            product_id: item.product.id,
            quantity: item.quantity,
          })) || [],
        shipping_option_id:
          selectedShippingOption?.id || "digital_delivery_only",
        shipping_address: {
          first_name: getValues("first_name"),
          last_name: getValues("last_name"),
          company: getValues("company"),
          email: getValues("email"),
          phone: getValues("phone"),
          address_line_1: getValues("address_line_1"),
          address_line_2: getValues("address_line_2"),
          city: getValues("city"),
          state: getValues("state"),
          postal_code: getValues("postal_code"),
          country: getValues("country"),
        },
        ...(digitalDeliveryOption && {
          digital_delivery_option: digitalDeliveryOption,
        }),
      });

      if (response.data.err) {
        setError(response.data.errMsg);
        return;
      }

      // Redirect to Stripe checkout
      window.location.href = response.data.checkout_url;
    } catch (error) {
      console.error("Error confirming order:", error);
      setError(
        "Failed to submit order. Please check your details and try again."
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleProceedToPayment() {
    openModal(
      <ConfirmOrderModal
        isOpen
        onClose={closeAllModals}
        onConfirm={() => {
          closeAllModals();
          confirmOrder();
        }}
      />
    );
  }

  return (
    <AlternateLayout>
      <div className="mx-auto max-w-2xl px-4 pb-24 pt-16 sm:px-6 lg:max-w-7xl lg:px-8">
        <form
          className="lg:grid lg:grid-cols-2 lg:gap-x-12 xl:gap-x-16 min-w-[90vw] lg:min-w-[1200px] lg:items-start"
          onSubmit={(e) => {
            e.preventDefault();
          }}
        >
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">
              Contact & Shipping information
            </h2>
            <p className="text-sm text-gray-500 mb-4">
              All fields are required unless marked as optional.
            </p>
            <div className="mt-4 grid grid-cols-1 gap-y-4 sm:grid-cols-2 sm:gap-x-4">
              <Controller
                name="first_name"
                control={control}
                rules={{ required: true }}
                render={({ field }) => (
                  <Input
                    label="First name"
                    placeholder="First name"
                    autoComplete="given-name"
                    {...field}
                    onChange={(e) => {
                      field.onChange(e);
                    }}
                  />
                )}
              />
              <Controller
                name="last_name"
                control={control}
                rules={{ required: true }}
                render={({ field }) => (
                  <Input
                    label="Last name"
                    placeholder="Last name"
                    autoComplete="family-name"
                    {...field}
                    onChange={(e) => {
                      field.onChange(e);
                    }}
                  />
                )}
              />

              <div className="sm:col-span-2">
                <Controller
                  name="company"
                  control={control}
                  render={({ field }) => (
                    <Input
                      label="Company (optional)"
                      placeholder="Company (optional)"
                      autoComplete="organization"
                      {...field}
                      onChange={(e) => {
                        field.onChange(e);
                      }}
                    />
                  )}
                />
              </div>

              <div className="sm:col-span-2">
                <Controller
                  name="address_line_1"
                  control={control}
                  rules={{ required: true }}
                  render={({ field }) => (
                    <Input
                      label="Address line 1"
                      placeholder="Address line 1"
                      autoComplete="address-line1"
                      {...field}
                      maxLength={30}
                      onChange={(e) => {
                        field.onChange(e);
                      }}
                    />
                  )}
                />
              </div>

              <div className="sm:col-span-2">
                <Controller
                  name="address_line_2"
                  control={control}
                  render={({ field }) => (
                    <Input
                      label="Address line 2 (optional)"
                      placeholder="Address line 2"
                      autoComplete="address-line2"
                      {...field}
                      maxLength={30}
                      onChange={(e) => {
                        field.onChange(e);
                      }}
                    />
                  )}
                />
              </div>
              <div>
                <Controller
                  name="city"
                  control={control}
                  rules={{ required: true }}
                  render={({ field }) => (
                    <Input
                      label="City"
                      placeholder="City"
                      autoComplete="address-level2"
                      {...field}
                      onChange={(e) => {
                        field.onChange(e);
                      }}
                    />
                  )}
                />
              </div>

              <div>
                <Controller
                  name="state"
                  control={control}
                  rules={{ required: true }}
                  render={({ field }) => (
                    <Select
                      label="State / Province"
                      options={STATE_CODES.map((state) => ({
                        value: state.abbreviation,
                        label: state.name,
                      }))}
                      autoComplete="address-level1"
                      {...field}
                      onChange={(e) => {
                        field.onChange(e);
                      }}
                    />
                  )}
                />
              </div>

              <div>
                <Controller
                  name="postal_code"
                  control={control}
                  rules={{ required: true }}
                  render={({ field }) => (
                    <Input
                      label="Postal code"
                      placeholder="Postal code"
                      autoComplete="postal-code"
                      {...field}
                      onChange={(e) => {
                        field.onChange(e);
                      }}
                    />
                  )}
                />
              </div>

              <div>
                <Controller
                  name="country"
                  control={control}
                  rules={{ required: true }}
                  render={({ field }) => (
                    <Select
                      label="Country / Region"
                      options={[
                        { value: "US", label: "United States" },
                        { value: "CA", label: "Canada" },
                      ]}
                      autoComplete="country"
                      {...field}
                      onChange={(e) => {
                        field.onChange(e);
                      }}
                    />
                  )}
                />
              </div>
              <div>
                <Controller
                  name="email"
                  control={control}
                  rules={{ required: true }}
                  render={({ field }) => (
                    <Input
                      label="Email address"
                      placeholder="Email address"
                      autoComplete="email"
                      {...field}
                      onChange={(e) => {
                        field.onChange(e);
                      }}
                    />
                  )}
                />
              </div>
              <div>
                <Controller
                  name="phone"
                  control={control}
                  rules={{ required: true }}
                  render={({ field }) => (
                    <Input
                      label="Phone number"
                      placeholder="Phone number"
                      autoComplete="tel"
                      {...field}
                      onChange={(e) => {
                        field.onChange(e);
                      }}
                    />
                  )}
                />
              </div>
              <ShippingOptions
                shippingCalculated={shippingCalculated}
                shippingOptions={shippingOptions}
                selectedShippingOption={selectedShippingOption}
                setSelectedShippingOption={setSelectedShippingOption}
              />
            </div>
          </div>

          {/* Order summary */}
          <div className="mt-10 lg:mt-0">
            <h2 className="text-lg font-medium text-gray-900">Order summary</h2>
            <div className="mt-4 rounded-lg border border-gray-200 bg-white shadow-sm">
              <h3 className="sr-only">Items in your cart</h3>
              <ul role="list" className="divide-y divide-gray-200">
                {cart?.items.map((item) => (
                  <li key={item.id} className="flex px-4 py-6 sm:px-6">
                    <div className="shrink-0">
                      <img
                        alt={`Image of ${item.price.nickname}`}
                        src={item.product.images[0]}
                        className="w-20 rounded-md"
                      />
                    </div>

                    <div className="ml-6 flex flex-1 flex-col">
                      <div className="flex">
                        <div className="min-w-0 flex-1">
                          <h4 className="text-sm">
                            <a
                              href={`/store/product/${item.product.id}`}
                              className="font-semibold text-gray-700 hover:text-gray-800"
                            >
                              {item.product.name} - {item.price.nickname}
                            </a>
                          </h4>
                          {/* <p className="mt-1 text-sm text-gray-500">
                        {product.color}
                      </p> */}
                        </div>

                        <div className="ml-4 flow-root shrink-0">
                          <button
                            type="button"
                            className="-m-2.5 flex items-center justify-center bg-white p-2.5 text-gray-400 hover:text-gray-500"
                          >
                            <span className="sr-only">Remove</span>
                          </button>
                        </div>
                      </div>

                      <div className="flex flex-1 items-end justify-between pt-2">
                        <p className="text-sm font-medium text-gray-900">
                          {formatPrice(item.price.unit_amount, true)}
                        </p>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
              <dl className="space-y-6 border-t border-gray-200 px-4 py-6 sm:px-6">
                <div className="flex items-center justify-between">
                  <dt className="text-sm">Items Subtotal</dt>
                  <dd className="text-sm font-medium text-gray-900">
                    {formatPrice(cart?.subtotal, true)}
                  </dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-sm">Shipping</dt>
                  <dd className="text-sm font-medium text-gray-900">
                    {shippingCalculated.current && selectedShippingOption
                      ? formatPrice(selectedShippingOption.cost_excl_tax, true)
                      : shippingCalculated.current &&
                        shippingOptions === "digital_delivery_only"
                      ? "Free (Digital Delivery)"
                      : "TBD"}
                  </dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-sm">Taxes</dt>
                  <dd className="text-sm font-medium text-gray-900">
                    Calculated at checkout
                  </dd>
                </div>
                <div className="flex items-center justify-between border-t border-gray-200 pt-6">
                  <dt className="text-base font-medium">Subtotal</dt>
                  <dd className="text-base font-medium text-gray-900">
                    {formatPrice(
                      (cart?.subtotal || 0) +
                        (shippingCalculated.current && selectedShippingOption
                          ? selectedShippingOption.cost_excl_tax
                          : 0),
                      true
                    )}
                  </dd>
                </div>
              </dl>
              {hasDigitalProducts && user?.uuid && (
                <div className="border-t border-gray-200 px-4 py-6 sm:px-6">
                  <p className=" text-gray-900 font-semibold">
                    You have digital products in your cart. How would you like
                    to redeem them?
                  </p>
                  <fieldset>
                    <legend className="sr-only">
                      Digital Delivery Options
                    </legend>
                    <RadioGroup
                      value={selectedDigitalDeliveryOption}
                      onChange={setSelectedDigitalDeliveryOption}
                      className="mt-4 grid grid-cols-1 gap-y-6 sm:grid-cols-2 sm:gap-x-4"
                    >
                      <Radio
                        key="apply_to_account"
                        value="apply_to_account"
                        aria-label="Apply to my LibreOne account"
                        aria-description="Automatically apply digital products to your LibreOne account"
                        className="group relative flex cursor-pointer rounded-md border border-gray-300 bg-white p-4 shadow-sm focus:outline-none data-[checked]:border-transparent data-[focus]:ring-2 data-[focus]:ring-indigo-500"
                      >
                        <span className="flex flex-1">
                          <span className="flex flex-col">
                            <span className="block text-sm font-medium text-gray-900">
                              Automatically apply to my LibreOne account
                            </span>
                          </span>
                        </span>
                        <span
                          aria-hidden="true"
                          className="pointer-events-none absolute -inset-px rounded-lg border-2 border-transparent group-data-[focus]:border group-data-[checked]:border-indigo-500"
                        />
                      </Radio>
                      <Radio
                        key="email_access_codes"
                        value="email_access_codes"
                        aria-label="Email access code"
                        aria-description="Automatically email access code for digital products"
                        className="group relative flex cursor-pointer rounded-md border border-gray-300 bg-white p-4 shadow-sm focus:outline-none data-[checked]:border-transparent data-[focus]:ring-2 data-[focus]:ring-indigo-500"
                      >
                        <span className="flex flex-1">
                          <span className="flex flex-col">
                            <span className="block text-sm font-medium text-gray-900">
                              I'm purchasing for someone else, email me the
                              access code(s)
                            </span>
                          </span>
                        </span>
                        <span
                          aria-hidden="true"
                          className="pointer-events-none absolute -inset-px rounded-lg border-2 border-transparent group-data-[focus]:border group-data-[checked]:border-indigo-500"
                        />
                      </Radio>
                    </RadioGroup>
                  </fieldset>
                  <p className="mt-4 text-sm text-gray-500">
                    If you select "Automatically apply to my LibreOne account",
                    access is applied to the LibreOne account you are currently
                    logged in with, NOT the email address you provide here.
                  </p>
                </div>
              )}
              {hasDigitalProducts && !user?.uuid && (
                <div className="border-t border-gray-200 px-4 py-6 sm:px-6">
                  <div className="mt-2 text-gray-900">
                    <p>
                      You have digital products in your cart but you are not
                      signed in. You will receive an email with access codes for
                      your digital products after purchase. Please ensure your
                      email address is correct.
                    </p>
                  </div>
                </div>
              )}
              <div className="border-t border-gray-200 px-4 py-6 sm:px-6">
                <button
                  type="submit"
                  className="w-full rounded-md border border-transparent bg-primary px-4 py-3 text-base font-medium text-white shadow-sm hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-50 disabled:bg-opacity-55 disabled:cursor-not-allowed"
                  onClick={handleProceedToPayment}
                  disabled={proceedDisabled || loading || shippingLoading}
                >
                  {loading || shippingLoading ? (
                    <LoadingSpinner iconOnly />
                  ) : (
                    <Icon name="arrow right" className="!mb-1 !mr-2" />
                  )}
                  Proceed to Payment
                </button>
              </div>
            </div>
            <p className="mt-4 text-sm text-gray-500 text-center">
              If you have any questions or concerns, please contact our{" "}
              <a
                href="https://support.libretexts.org"
                className="text-primary hover:underline"
              >
                Support Center
              </a>{" "}
              before proceeding.
            </p>
            {error && (
              <div className="mt-4 text-red-600 text-center flex items-center justify-center text-lg">
                <Icon name="exclamation triangle" className="!mb-1 !mr-2" />
                {error}
              </div>
            )}
          </div>
        </form>
      </div>
    </AlternateLayout>
  );
}
