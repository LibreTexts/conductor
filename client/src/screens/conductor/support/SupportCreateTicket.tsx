import { Image } from "semantic-ui-react";
import DefaultLayout from "../../../components/kb/DefaultLayout";
import { useEffect, useState } from "react";
import { useTypedSelector } from "../../../state/hooks";
import AuthHelper from "../../../components/util/AuthHelper";
import CreateTicketFlow from "../../../components/support/CreateTicketFlow";

const SupportCreateTicket = () => {
  const user = useTypedSelector((state) => state.user);
  const [guestMode, setGuestMode] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  const checkIsLoggedIn = () => {
    if (user && user.uuid) {
      setIsLoggedIn(true);
      return;
    }
    setIsLoggedIn(false);
  };

  useEffect(() => {
    document.title = "LibreTexts | Contact Support";
  }, []);

  useEffect(() => {
    checkIsLoggedIn();
  }, [user]);

  function redirectToLogin() {
    const loginURL = AuthHelper.generateLoginURL();
    window.location.assign(loginURL);
  }

  return (
    <DefaultLayout altBackground>
      <div className="flex flex-col w-full min-h-[80vh] items-center justify-center">
        <div className="flex flex-col w-full items-center mt-4">
          <h1 className="text-4xl font-semibold">Contact Support</h1>
          <p className="mt-2">Submit a support ticket to get help from our team.</p>
          <>
            {!isLoggedIn && !guestMode && (
              <div className="flex flex-col w-2/5 mt-12 items-center">
                <button
                  onClick={() => redirectToLogin()}
                  className="w-3/4 h-12 flex bg-primary rounded-md text-white text-lg my-2 items-center justify-center shadow-md hover:shadow-xl"
                >
                  Log In with LibreOne (Recommended)
                </button>
                <button
                  onClick={() => setGuestMode(true)}
                  className="w-3/4 h-12 flex bg-primary rounded-md text-white text-lg my-2 items-center justify-center shadow-md hover:shadow-xl"
                >
                  Continue as Guest
                </button>
              </div>
            )}
            {(isLoggedIn || guestMode) && (
              <div className="mt-4 flex w-full justify-center">
              <CreateTicketFlow isLoggedIn={isLoggedIn} />
              </div>            
            )}
          </>
        </div>
      </div>
    </DefaultLayout>
  );
};

export default SupportCreateTicket;
