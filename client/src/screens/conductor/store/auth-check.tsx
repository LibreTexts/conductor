import { useEffect, useMemo } from "react";
import { useTypedSelector } from "../../../state/hooks";
import { redirect } from "react-router-dom-v5-compat";
import AlternateLayout from "../../../components/navigation/AlternateLayout";
import { Icon } from "semantic-ui-react";
import AuthHelper from "../../../components/util/AuthHelper";

export default function AuthCheckPage() {
  const user = useTypedSelector((state) => state.user);

  const isLoggedIn = useMemo(() => {
    return user && user.uuid;
  }, [user]);

  useEffect(() => {
    if (isLoggedIn) {
      redirect("/store/checkout/shipping");
    }
  }, [isLoggedIn]);

  function redirectToLogin() {
    const loginURL = AuthHelper.generateLoginURL("/store/checkout/auth-check");
    window.location.assign(loginURL);
  }

  return (
    <AlternateLayout>
      <div className="mx-auto max-w-2xl px-4 pb-24 pt-16 sm:px-6 lg:max-w-5xl lg:px-8">
        <div className="bg-white">
          <div className="px-4 py-5 sm:px-6 flex flex-col items-center justify-center">
            <Icon name="question circle outline" size="huge" color="blue" />
            <h1 className="text-4xl font-semibold text-gray-900 my-4 text-center">
              Login with LibreOne?
            </h1>
            <p className="text-xl text-gray-900 text-center">
              It looks like you are not logged in with LibreOne. If you're
              purchasing digital items and want to be able to automatically
              apply them to your LibreOne account, please log in first.
            </p>
            <p className="text-xl text-gray-900 text-center mt-4">
              Otherwise, you can continue as a guest.
            </p>
            <button
              onClick={() => redirectToLogin()}
              className="w-full h-auto p-3 lg:w-3/4 lg:h-12 flex bg-primary rounded-md text-white text-lg my-2 items-center justify-center shadow-sm hover:shadow-md mt-8"
            >
              Log In with LibreOne (Recommended)
            </button>
            <a
              href="/store/checkout/shipping"
              className="w-full h-auto lg:w-3/4 lg:h-12"
            >
              <button className="w-full h-auto p-3 lg:h-12 flex bg-primary rounded-md text-white text-lg my-2 items-center justify-center shadow-sm hover:shadow-md">
                Continue as Guest
              </button>
            </a>
          </div>
        </div>
      </div>
    </AlternateLayout>
  );
}
