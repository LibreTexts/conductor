import { Card, Button, Input, Alert, Stack, Text, Link } from "@libretexts/davis-react";
import { IconUser, IconLock } from "@tabler/icons-react";
import { useEffect, useState } from "react";
import { useLocation, useHistory } from "react-router-dom";
import { useDispatch } from "react-redux";
import axios from "axios";
import Cookies from "js-cookie";
import { isEmptyString } from "../../components/util/HelperFunctions";
import useGlobalError from "../../components/error/ErrorHooks";
import AuthHelper, { COOKIE_NAMES } from "../../components/util/AuthHelper";

const FallbackAuth = () => {
  const dispatch = useDispatch();
  const location = useLocation();
  const history = useHistory();
  const { handleGlobalError } = useGlobalError();

  // UI
  const [submitLoading, setSubmitLoading] = useState(false);
  /** URL Params and Messages **/
  const [showExpiredAuth, setExpiredAuth] = useState(false);
  const [redirectURI, setRedirectURI] = useState("");

  // Form Data
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Form Errors
  const [emailError, setEmailError] = useState(false);
  const [passwordError, setPasswordError] = useState(false);

  useEffect(() => {
    document.title = "LibreTexts Conductor | Fallback Authentication";
    const searchParams = new URLSearchParams(location.search);
    if (searchParams.get("src") === "authexpired") {
      setExpiredAuth(true);
    }
    if (searchParams.get("redirect_uri")) {
      const rawRedirect = searchParams.get("redirect_uri");
      if (rawRedirect && rawRedirect !== null) {
        const parsedRedirect = decodeURIComponent(rawRedirect);
        setRedirectURI(parsedRedirect);
        return;
      }
      setRedirectURI("");
    }
  }, [location.search]);

  /** Form input handlers **/
  const onChange = (e: any) => {
    if (e.target.id === "email") {
      setEmail(e.target.value);
    }
    if (e.target.id === "password") {
      setPassword(e.target.value);
    }
  };

  /**
   * Validate the form data.
   *
   * @returns {boolean} True if all fields valid, false otherwise.
   */
  const validateForm = (): boolean => {
    let validForm = true;
    if (isEmptyString(email)) {
      validForm = false;
      setEmailError(true);
    }
    if (isEmptyString(password)) {
      validForm = false;
      setPasswordError(true);
    }
    return validForm;
  };

  /**
   * Reset all form error states
   */
  const resetFormErrors = () => {
    setEmailError(false);
    setPasswordError(false);
  };

  /**
   * Submit data via POST to the server, then check cookie return and redirect to Home.
   */
  const submitLogin = async () => {
    setSubmitLoading(true);
    resetFormErrors();
    if (!validateForm() || import.meta.env.VITE_DISABLE_CONDUCTOR === "true") {
      return;
    }
    const userData = {
      email: email,
      password: password,
    };
    try {
      const authRes = await axios.post("/auth/fallback-auth", userData);
      if (authRes.data?.err) {
        handleGlobalError(authRes.data.errMsg);
      }
      if (Cookies.get(COOKIE_NAMES.ACCESS) !== undefined) {
        dispatch({ type: "SET_AUTH" });
        if (redirectURI !== "") {
          // redirect to the page the user tried to visit directly
          history.push(redirectURI);
        } else {
          history.push("/home");
        }
      } else {
        handleGlobalError(
          "Oops, we're having trouble completing your login."
        );
      }
    } catch (err) {
      handleGlobalError(err);
    }
    setSubmitLoading(false);
  };

  return (
    <div className="flex min-h-[85vh] items-center justify-center p-4">
      <Stack gap="lg" className="w-full max-w-md">
        <img
          src="/libretexts_logo.png"
          alt="The main LibreTexts logo."
          className="mx-auto w-2/3"
        />
        <Card variant="elevated">
          <Card.Body>
            {import.meta.env.VITE_DISABLE_CONDUCTOR === "true" && (
              <Alert
                variant="error"
                title="Conductor is disabled"
                message="Sorry, access to Conductor is currently disabled."
                className="mb-4"
              />
            )}
            {showExpiredAuth && (
              <Alert
                variant="warning"
                title="Please login again."
                message="Your authentication method appears to have expired. Please login again."
                className="mb-4"
              />
            )}
            <Text className="mb-4">
              {`This screen is for Conductor system administrators only. If you're a user and would like to login, you can do so `}
              <Link href={AuthHelper.generateLoginURL()}>here</Link>.
            </Text>
            <form
              noValidate
              onSubmit={(e) => {
                e.preventDefault();
                submitLogin();
              }}
            >
              <Stack gap="md" className="mt-4">
                <Input
                  id="email"
                  name="email"
                  label="Email"
                  type="email"
                  placeholder="Email"
                  required
                  value={email}
                  onChange={onChange}
                  error={emailError}
                  leftIcon={<IconUser size={18} />}
                  autoComplete="username"
                />
                <Input
                  id="password"
                  name="password"
                  label="Password"
                  type="password"
                  placeholder="********"
                  required
                  value={password}
                  onChange={onChange}
                  error={passwordError}
                  leftIcon={<IconLock size={18} />}
                  autoComplete="current-password"
                />
                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                  fullWidth
                  loading={submitLoading}
                  disabled={import.meta.env.VITE_DISABLE_CONDUCTOR === "true"}
                >
                  Login
                </Button>
              </Stack>
            </form>
          </Card.Body>
        </Card>
      </Stack>
    </div>
  );
};

export default FallbackAuth;
