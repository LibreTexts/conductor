import DefaultLayout from "../../../components/navigation/AlternateLayout";
import { useEffect, useState } from "react";
import { useTypedSelector } from "../../../state/hooks";
import AuthHelper from "../../../components/util/AuthHelper";
import CreateTicketFlow from "../../../components/support/CreateTicketFlow";
import useSystemAnnouncement from "../../../hooks/useSystemAnnouncement";
import SystemAnnouncement from "../../../components/util/SystemAnnouncement";

const SupportCreateTicket = () => {
  const user = useTypedSelector((state) => state.user);
  const [guestMode, setGuestMode] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const { sysAnnouncement } = useSystemAnnouncement();

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
    <DefaultLayout altBackground h="screen" className="!mb-[2%]">
      <>
        {sysAnnouncement && (
          <SystemAnnouncement
            title={sysAnnouncement.title}
            message={sysAnnouncement.message}
          />
        )}
        <div className="flex flex-col w-full h-full overflow-y-auto items-center justify-center">
          <div className="flex flex-col w-full items-center mt-12">
            <h1 className="text-4xl font-semibold">Contact Support</h1>
            <p className="mt-2">
              Submit a support ticket to get help from our team.
            </p>
            <>
              {!isLoggedIn && !guestMode && (
                <div className="flex flex-col w-1/2 lg:w-2/5 mt-8 items-center">
                  <button
                    onClick={() => redirectToLogin()}
                    className="w-full h-auto p-3 lg:w-3/4 lg:h-12 flex bg-primary rounded-md text-white text-lg my-2 items-center justify-center shadow-sm hover:shadow-md"
                  >
                    Log In with LibreOne (Recommended)
                  </button>
                  <button
                    onClick={() => setGuestMode(true)}
                    className="w-full h-auto p-3 lg:w-3/4 lg:h-12 flex bg-primary rounded-md text-white text-lg my-2 items-center justify-center shadow-sm hover:shadow-md"
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
      </>
    </DefaultLayout>
  );
};

export default SupportCreateTicket;
