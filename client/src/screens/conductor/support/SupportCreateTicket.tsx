import AlternateLayout from "../../../components/navigation/AlternateLayout";
import { useEffect, useState } from "react";
import { useTypedSelector } from "../../../state/hooks";
import AuthHelper from "../../../components/util/AuthHelper";
import CreateTicketFlow from "../../../components/support/CreateTicketFlow";
import useSystemAnnouncement from "../../../hooks/useSystemAnnouncement";
import SystemAnnouncement from "../../../components/util/SystemAnnouncement";
import { useDocumentTitle } from "usehooks-ts";
import useSupportAnnouncement from "../../../hooks/useSupportAnnouncement";
import { Button, Card, Heading, Stack, Text } from "@libretexts/davis-react";

const SupportCreateTicket = () => {
  useDocumentTitle("LibreTexts | Contact Support");
  const user = useTypedSelector((state) => state.user);
  const [guestMode, setGuestMode] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const { sysAnnouncement } = useSystemAnnouncement();
  const { supportAnnouncement } = useSupportAnnouncement();

  useEffect(() => {
    setIsLoggedIn(!!(user && user.uuid));
  }, [user]);

  function redirectToLogin() {
    const loginURL = AuthHelper.generateLoginURL();
    window.location.assign(loginURL);
  }

  return (
    <AlternateLayout>
      <Stack gap="xs" className='max-w-5xl mx-auto px-6'>
        <Stack gap="sm" align="center">
          <div>
            <Heading level={1} className="text-4xl font-semibold">
              Contact Support
            </Heading>
            <Text className="mt-2 text-gray-600">
              Submit a request to get help from our team.
            </Text>
          </div>
          {sysAnnouncement && (
            <SystemAnnouncement
              title={sysAnnouncement.title}
              message={sysAnnouncement.message}
            />
          )}
          {supportAnnouncement && (
            <SystemAnnouncement
              title={supportAnnouncement.title}
              message={supportAnnouncement.message}
            />
          )}
        </Stack>

        <Stack gap="md" align="center">
          {!isLoggedIn && !guestMode && (
            <Card variant="outline" className="w-full">
              <Card.Header>
                <Heading level={2} align="center">How would you like to continue?</Heading>
              </Card.Header>
              <Card.Body>
                <Stack gap="md">
                  <Button
                    variant="primary"
                    className="w-full justify-center"
                    onClick={redirectToLogin}
                  >
                    Log In with LibreOne (Recommended)
                  </Button>
                  <Button
                    variant="secondary"
                    className="w-full justify-center"
                    onClick={() => setGuestMode(true)}
                  >
                    Continue as Guest
                  </Button>
                </Stack>
              </Card.Body>
            </Card>
          )}

          {(isLoggedIn || guestMode) && (
            <CreateTicketFlow isLoggedIn={isLoggedIn} />
          )}
        </Stack>
      </Stack>
    </AlternateLayout>
  );
};

export default SupportCreateTicket;
