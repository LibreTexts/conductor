import "./Login.css";

import {
  Grid,
  Segment,
  Button,
  Form,
  Input,
  Image,
  Message,
  Divider,
  Icon,
  Modal,
} from "semantic-ui-react";
import { useEffect, useState } from "react";
import { Link, useLocation, useHistory } from "react-router-dom";
import { useDispatch } from "react-redux";
import axios from "axios";
import Cookies from "js-cookie";
import { isEmptyString } from "../util/HelperFunctions.js";

import useGlobalError from "../error/ErrorHooks";

const Login = () => {
  const dispatch = useDispatch();
  const location = useLocation();
  const history = useHistory();
  const { handleGlobalError } = useGlobalError();

  // UI
  const [submitLoading, setSubmitLoading] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [formStep, setFormStep] = useState(1);
  /** URL Params and Messages **/
  const [showExpiredAuth, setExpiredAuth] = useState(false);
  const [showNewRegister, setNewRegister] = useState(false);
  const [showPassReset, setPassReset] = useState(false);
  const [showPassChange, setPassChange] = useState(false);
  const [showAccountRequestAuth, setShowAccountRequestAuth] = useState(false);
  const [showEventRegistrationAuth, setShowEventRegistrationAuth] =
    useState(false);
  const [redirectURI, setRedirectURI] = useState("");

  // Form Data
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Form Errors
  const [emailError, setEmailError] = useState(false);
  const [passwordError, setPasswordError] = useState(false);

  useEffect(() => {
    document.title = "LibreTexts Conductor | Login";
    const searchParams = new URLSearchParams(location.search);
    if (searchParams.get("src") === "authexpired") {
      setExpiredAuth(true);
    }
    if (searchParams.get("src") === "accountrequest") {
      setShowAccountRequestAuth(true);
    }
    if (searchParams.get("src") === "eventregistration") {
      setShowEventRegistrationAuth(true);
    }
    if (searchParams.get("newregister") === "true") {
      setNewRegister(true);
    }
    if (searchParams.get("resetsuccess") === "true") {
      setPassReset(true);
    }
    if (searchParams.get("passchange") === "true") {
      setPassChange(true);
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
   * Validate the form data, return
   * 'false' if validation errors exists,
   * 'true' otherwise
   */
  const validateForm = () => {
    var validForm = true;
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
   * Submit data via POST to the server, then
   * check cookie return and redirect
   * to Home.
   */
  const submitLogin = () => {
    setSubmitLoading(true);
    resetFormErrors();
    if (validateForm() && import.meta.env.VITE_DISABLE_CONDUCTOR !== "true") {
      var userData = {
        email: email,
        password: password,
      };
      axios
        .post("/auth/login", userData, {
          headers: {
            "Content-Type": "application/json",
          },
        })
        .then((res) => {
          if (!res.data.err) {
            if (Cookies.get("conductor_access") !== undefined) {
              dispatch({
                type: "SET_AUTH",
              });
              if (redirectURI !== "") {
                // redirect to the page the user tried to visit directly
                history.push(redirectURI);
              } else {
                if (res.data.isNewMember) {
                  // default, direct to Home
                  history.push("/home?newmember=true");
                } else {
                  history.push("/home");
                }
              }
            } else {
              handleGlobalError(
                "Oops, we're having trouble completing your login."
              );
            }
          } else {
            handleGlobalError(res.data.errMsg);
          }
        })
        .catch((err) => {
          handleGlobalError(err);
        });
    }
    setSubmitLoading(false);
  };

  const submitResetPassword = () => {
    if (!isEmptyString(email)) {
      setEmailError(false);
      axios
        .post("/auth/resetpassword", {
          email: email,
        })
        .then((res) => {
          if (!res.data.err) {
            setShowResetModal(true);
          } else {
            handleGlobalError(res.data.errMsg);
          }
        })
        .catch((err) => {
          handleGlobalError(err);
        });
    } else {
      setEmailError(true);
    }
  };

  const genRegisterLink = () => {
    const redirectBase = "/register";
    if (redirectURI) {
      return `${redirectBase}?redirect_uri=${encodeURIComponent(redirectURI)}`;
    }
    return redirectBase;
  };

  const initSSOLogin = () => {
    if (import.meta.env.MODE === "production") {
      const domains = import.meta.env.VITE_PRODUCTION_URLS
        ? import.meta.env.VITE_PRODUCTION_URLS.split(",")
        : ["libretexts.org"];
      Cookies.set(
        "conductor_sso_redirect",
        window.location.protocol + "//" + window.location.hostname,
        { domain: domains[0], sameSite: "lax" }
      );
    } else {
      Cookies.set("conductor_sso_redirect", window.location.hostname, {
        domain: "localhost",
        sameSite: "lax",
      });
    }
    window.location.assign("http://commons.libretexts.org/api/v1/auth/initsso");
  };

  return (
    <Grid centered={true} verticalAlign="middle" className="login-grid">
      <Grid.Column computer={8} tablet={12} mobile={14}>
        <Grid columns={1} verticalAlign="middle" centered={true}>
          <Grid.Column computer={8} tablet={10}>
            <Image src="/libretexts_logo.png" alt="The main LibreTexts logo." />
          </Grid.Column>
        </Grid>
        <Segment raised>
          {showAccountRequestAuth && (
            <Message info icon className="mb-2e">
              <Icon name="info circle" />
              <Message.Content>
                <Message.Header>Conductor Account Required</Message.Header>
                <p>
                  A Conductor account is now required to submit an Instructor
                  Account Request for other LibreTexts services. This helps
                  LibreTexts streamline the account approval process and create
                  consistent records. Conductor accounts are free and open to
                  all.
                </p>
              </Message.Content>
            </Message>
          )}
          {showEventRegistrationAuth && (
            <Message info icon className="mb-2e">
              <Icon name="info circle" />
              <Message.Content>
                <Message.Header>Conductor Account Required</Message.Header>
                <p>
                  A Conductor account is required to register for this event.
                  Conductor accounts are free and open to all.
                </p>
              </Message.Content>
            </Message>
          )}
          {showPassChange && (
            <Message positive icon className="mb-2e">
              <Icon name="check" />
              <Message.Content>
                <Message.Header>Password change successful.</Message.Header>
                <p>Please login with your email and new password here.</p>
              </Message.Content>
            </Message>
          )}
          {showPassReset && (
            <Message positive icon className="mb-2e">
              <Icon name="check" />
              <Message.Content>
                <Message.Header>Password reset successful.</Message.Header>
                <p>Please login with your email and new password here.</p>
              </Message.Content>
            </Message>
          )}
          {showNewRegister && (
            <Message positive icon className="mb-2e">
              <Icon name="check" />
              <Message.Content>
                <Message.Header>Registration successful.</Message.Header>
                <p>Please login with your email and new password here.</p>
              </Message.Content>
            </Message>
          )}
          {showExpiredAuth && (
            <Message warning className="mb-2e">
              <Message.Header>Please login again.</Message.Header>
              <p>
                Your authentication method appears to have expired. Please login
                again.
              </p>
            </Message>
          )}
          {import.meta.env.VITE_DISABLE_CONDUCTOR === "true" && (
            <Message negative className="mb-2e">
              <Message.Header>Conductor is disabled</Message.Header>
              <p>Sorry, access to Conductor is currently disabled.</p>
            </Message>
          )}
          {import.meta.env.VITE_RESTRICT_CONDUCTOR === "true" && (
            <Message warning className="mb-2e">
              <Message.Header>Conductor is restricted.</Message.Header>
              <p>
                Access to Conductor is currently restricted. Only pre-registered
                users may log in.
              </p>
            </Message>
          )}
          {formStep === 1 && (
            <>
              <Button
                disabled={
                  import.meta.env.VITE_RESTRICT_CONDUCTOR === "true" ||
                  import.meta.env.VITE_DISABLE_CONDUCTOR === "true"
                }
                fluid
                color="teal"
                onClick={initSSOLogin}
                tabIndex="0"
              >
                <Icon name="globe" /> Login with Campus Credentials (SSO)
              </Button>
              <Divider horizontal>Or</Divider>
              <Button
                disabled={
                  import.meta.env.VITE_RESTRICT_CONDUCTOR === "true" ||
                  import.meta.env.VITE_DISABLE_CONDUCTOR === "true"
                }
                fluid
                color="green"
                className="mt-1p"
                onClick={() => setFormStep(2)}
                tabIndex="1"
              >
                <Icon name="key" /> Login with Email
              </Button>
            </>
          )}
          {formStep === 2 && (
            <>
              <Form noValidate>
                <Form.Field error={emailError}>
                  <label htmlFor="email">Email</label>
                  <Input
                    fluid={true}
                    id="email"
                    type="email"
                    name="email"
                    placeholder="Email"
                    required={true}
                    value={email}
                    onChange={onChange}
                    icon="user"
                    iconPosition="left"
                    autoComplete="username"
                  />
                </Form.Field>
                <Form.Field error={passwordError}>
                  <label htmlFor="password">Password</label>
                  <Input
                    fluid={true}
                    type="password"
                    id="password"
                    name="password"
                    placeholder="********"
                    required={true}
                    value={password}
                    onChange={onChange}
                    icon="lock"
                    iconPosition="left"
                    autoComplete="current-password"
                  />
                </Form.Field>
                <Button
                  type="submit"
                  color="blue"
                  size="large"
                  fluid
                  disabled={import.meta.env.VITE_DISABLE_CONDUCTOR === "true"}
                  loading={submitLoading}
                  onClick={submitLogin}
                >
                  Login
                </Button>
              </Form>
              <div className="flex-row-div">
                <Button
                  as={Link}
                  to={genRegisterLink}
                  tabIndex="0"
                  className="commons-login-secondary-btn"
                >
                  Register for an account
                </Button>
                <Button
                  onClick={submitResetPassword}
                  tabIndex="0"
                  className="commons-login-secondary-btn"
                >
                  Forgot your password?
                </Button>
              </div>
              <div className="flex-row-div">
                <Button
                  onClick={initSSOLogin}
                  tabIndex="0"
                  className="commons-login-secondary-btn"
                >
                  Login with Campus Credentials (SSO)
                </Button>
              </div>
            </>
          )}
        </Segment>
        <Modal open={showResetModal}>
          <Modal.Header>Password Reset Sent</Modal.Header>
          <Modal.Content>
            <p>
              An email with password reset instructions has been sent. If you're
              still having issues, please{" "}
              <a
                href="mailto:info@libretexts.org?subject=Conductor%20Login%20Issue"
                target="_blank"
                rel="noopener noreferrer"
              >
                contact LibreTexts.
              </a>
            </p>
          </Modal.Content>
          <Modal.Actions>
            <Button
              color="blue"
              onClick={() => {
                setShowResetModal(false);
              }}
            >
              Done
            </Button>
          </Modal.Actions>
        </Modal>
      </Grid.Column>
    </Grid>
  );
};

export default Login;
