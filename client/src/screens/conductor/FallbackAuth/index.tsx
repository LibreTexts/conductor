import {
  Grid,
  Segment,
  Button,
  Form,
  Input,
  Image,
  Message,
} from "semantic-ui-react";
import { useEffect, useState } from "react";
import { useLocation, useHistory } from "react-router-dom";
import { useDispatch } from "react-redux";
import axios from "axios";
import Cookies from "js-cookie";
import { isEmptyString } from "../../../components/util/HelperFunctions";
import useGlobalError from "../../../components/error/ErrorHooks";
import styles from './FallbackAuth.module.css';
import AuthHelper from "../../../components/util/AuthHelper";

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
      if (Cookies.get("conductor_access_v2") !== undefined) {
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
    <Grid centered={true} verticalAlign="middle" className={styles.login_grid}>
      <Grid.Column computer={8} tablet={12} mobile={14}>
        <Grid columns={1} verticalAlign="middle" centered={true}>
          <Grid.Column computer={8} tablet={10}>
            <Image src="/libretexts_logo.png" alt="The main LibreTexts logo." />
          </Grid.Column>
        </Grid>
        <Segment raised>
          {import.meta.env.VITE_DISABLE_CONDUCTOR === "true" && (
            <Message negative className="mb-2e">
              <Message.Header>Conductor is disabled</Message.Header>
              <p>Sorry, access to Conductor is currently disabled.</p>
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
          <p>
            {`This screen is for Conductor system administrators only. If you're a user and would like to login, you can do so `}
            <a href={AuthHelper.generateLoginURL()}>here</a>.
          </p>
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
        </Segment>
      </Grid.Column>
    </Grid>
  );
};

export default FallbackAuth;
