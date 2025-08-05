import { StoreGetShippingOptionsRes, StoreShippingOption } from "../../types";
import { Radio, RadioGroup } from "@headlessui/react";
import { formatPrice } from "../../utils/storeHelpers";

interface ShippingOptionsProps {
  shippingCalculated: React.MutableRefObject<boolean>;
  shippingOptions: StoreGetShippingOptionsRes;
  selectedShippingOption: StoreShippingOption | null;
  setSelectedShippingOption: (option: StoreShippingOption | null) => void;
  loading?: boolean;
}

const ShippingOptions: React.FC<ShippingOptionsProps> = ({
  shippingCalculated,
  shippingOptions,
  selectedShippingOption,
  setSelectedShippingOption,
  loading,
}) => {
  const OptionsDisplay = () => {
    if (!shippingCalculated.current) {
      return (
        <p className="mt-2 text-sm text-gray-500">
          Please complete your address details to calculate shipping options.
        </p>
      );
    } else if (shippingOptions === "digital_delivery_only") {
      return (
        <p className="mt-2 text-sm text-gray-500">
          Your cart has digital items only - no shipping is required. Digital
          items will be delivered via email after purchase.
        </p>
      );
    } else if (Array.isArray(shippingOptions)) {
      return (
        <>
          <fieldset>
            <legend className="sr-only">Shipping options</legend>
            <RadioGroup
              value={selectedShippingOption}
              onChange={setSelectedShippingOption}
              className="mt-4 grid grid-cols-1 gap-y-6 sm:grid-cols-2 sm:gap-x-4"
            >
              {shippingOptions.map((deliveryMethod) => (
                <Radio
                  key={deliveryMethod.id}
                  value={deliveryMethod}
                  aria-label={deliveryMethod.title}
                  aria-description={`${deliveryMethod.total_days_min} - ${
                    deliveryMethod.total_days_max
                  } business days for ${formatPrice(
                    deliveryMethod.cost_excl_tax,
                    false
                  )}`}
                  className="group relative flex cursor-pointer rounded-md border border-gray-300 bg-white p-4 shadow-sm focus:outline-none data-[checked]:border-transparent data-[focus]:ring-2 data-[focus]:ring-indigo-500"
                >
                  <span className="flex flex-1">
                    <span className="flex flex-col">
                      <span className="block text-sm font-medium text-gray-900">
                        {deliveryMethod.title}
                      </span>
                      <span className="mt-1 flex items-center text-sm text-gray-500">
                        {deliveryMethod.total_days_min} -{" "}
                        {deliveryMethod.total_days_max} business days
                      </span>
                      <span className="mt-6 text-sm font-medium text-gray-900">
                        {formatPrice(deliveryMethod.cost_excl_tax, true)}
                      </span>
                    </span>
                  </span>
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute -inset-px rounded-lg border-2 border-transparent group-data-[focus]:border group-data-[checked]:border-indigo-500"
                  />
                </Radio>
              ))}
            </RadioGroup>
          </fieldset>
          <p className="mt-4 text-sm text-gray-500 text-center">
            Select a shipping option to proceed to payment.
          </p>
        </>
      );
    } else {
      return (
        <p className="mt-2 text-sm text-gray-500">
          We encountered an issue calculating shipping options. Please try again
          later or contact support.
        </p>
      );
    }
  };

  return (
    <div className="mt-10 border-t border-gray-200 pt-10 col-span-2">
      <p className="text-lg font-medium text-gray-900">Shipping options</p>
      <OptionsDisplay />
    </div>
  );
};

export default ShippingOptions;
