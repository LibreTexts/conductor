import { useEffect, useMemo, useRef } from "react";
import { useCart } from "../../../context/CartContext";
import AlternateLayout from "../../../components/navigation/AlternateLayout";
import { formatPrice } from "../../../utils/storeHelpers";
import { useSearchParams } from "react-router-dom-v5-compat";
import { Icon } from "semantic-ui-react";

export default function OrderSuccessPage() {
  const [searchParams] = useSearchParams();
  const { cart, clearCart } = useCart();
  const clearCartDidRun = useRef(false);

  useEffect(() => {
    if (!cart || clearCartDidRun.current) return;
    // Delete the cart entirely after the order is confirmed so its
    // cart_first_created timestamp is never reused.
    clearCart();
    clearCartDidRun.current = true;
  }, [cart]);

  const queryParams = useMemo(() => {
    return Object.fromEntries(searchParams.entries());
  }, [searchParams]);

  return (
    <AlternateLayout>
      <div className="mx-auto max-w-2xl px-4 pb-24 pt-16 sm:px-6 lg:max-w-5xl lg:px-8">
        <div className="bg-white">
          <div className="px-4 py-5 sm:px-6 flex flex-col items-center justify-center">
            <Icon name="check circle" size="huge" color="green" />
            <h1 className="text-4xl font-semibold text-gray-900 my-4 text-center">
              Order Confirmation
            </h1>
            <p className="text-xl text-gray-900 text-center">
              Thank you for your order! Your purchase was successful. If you
              have any questions or need assistance, please contact our{" "}
              <a
                href="https://commons.libretexts.org/support"
                className="text-primary hover:text-primary-hover"
              >
                Support Center
              </a>
              .
            </p>
          </div>
          <p className="px-4 py-5 sm:px-6 text-xl text-gray-900 text-center">
            Your order ID is{" "}
            <span className="font-medium text-gray-900">
              {queryParams.checkout_session_id || "N/A"}
            </span>
            . You will receive an email confirmation shortly.
          </p>
        </div>
      </div>
    </AlternateLayout>
  );
}
