import { useEffect, useMemo } from "react";
import { useTypedSelector } from "../../../state/hooks";
import AlternateLayout from "../../../components/navigation/AlternateLayout";
import { Icon } from "semantic-ui-react";
import AuthHelper from "../../../components/util/AuthHelper";
import { Button, Heading, Stack, Text } from "@libretexts/davis-react";
import { IconQuestionMark } from "@tabler/icons-react";
import { Link } from "react-router-dom";

export default function AuthCheckPage() {
  const user = useTypedSelector((state) => state.user);

  const isLoggedIn = useMemo(() => {
    return user && user.uuid;
  }, [user]);

  useEffect(() => {
    if (isLoggedIn) {
      window.location.assign("/store/checkout/shipping");
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
          <Stack gap="lg" align="center" className="px-4">
            <IconQuestionMark size={64} className="text-primary" />
            <Heading level={1}>
              Login with LibreOne?
            </Heading>
            <Text align="center">
              It looks like you are not logged in with LibreOne. If you're
              purchasing digital items and want to be able to automatically
              apply them to your LibreOne account, please log in first.
            </Text>
            <Text>
              Otherwise, you can continue as a guest.
            </Text>
            <Stack gap="md">
              <Button
                variant="primary"
                fullWidth
                onClick={() => redirectToLogin()}
              >
                Log In with LibreOne (Recommended)
              </Button>
              <Link to="/store/checkout/shipping">
                <Button
                  variant="outline"
                  fullWidth
                >
                  Continue as Guest
                </Button>
              </Link>
            </Stack>
          </Stack>
        </div>
      </div>
    </AlternateLayout>
  );
}
