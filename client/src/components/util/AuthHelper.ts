import axios from "axios";
import Cookies from "js-cookie";

/**
 * Global-use object with helper functions for authentication and session management.
 */
const AuthHelper = {
  /**
   * Checks if the user's browser has a Conductor access token.
   *
   * @returns {boolean} True if the token is found, false otherwise
   */
  isAuthenticated: () => {
    return Cookies.get("conductor_access_v2") !== undefined;
  },

  getAuthToken: () => {
    const access = Cookies.get("conductor_access_v2");
    const signed = Cookies.get("conductor_signed_v2");
    if (!access || !signed) return null;
    return `${access}.${signed}`;
  },

  /**
   * Generates a URL to direct the browser to the LibreOne CAS login screen.
   *
   * @param {string} [redirectURI=null] - URI to redirect browser to upon successful login.
   * @returns {string} The generated URL.
   */
  generateLoginURL: (redirectURI: string | null = null) => {
    const cookiesOptions =
      import.meta.env.MODE === "production"
        ? { domain: (import.meta.env.VITE_PRODUCTION_URLS || "").split(",")[0] }
        : undefined;

    const loginEndpoint = "/api/v1/auth/login";
    let redirURL =
      import.meta.env.MODE === "production"
        ? `${window.location.origin}${loginEndpoint}`
        : `http://localhost:${
            import.meta.env.VITE_SERVER_PORT || "5000"
          }${loginEndpoint}`;
    if (redirectURI) {
      const redirParams = new URLSearchParams({ redirectURI });
      redirURL = `${redirURL}?${redirParams.toString()}`;
    }
    return redirURL;
  },

  /**
   * Redirects the browser to the API logout endpoint. If the session had expired (auto-logout),
   * redirects to the login screen instead.
   *
   * @param {boolean} [authExpired=false] - If the logout is the result of expired authentication.
   * @param {object} [location=null] - An object containing the document's current location (URL).
   * @param {boolean} [silent=false] - If true, suppresses any user-facing notifications about the logout.
   */
  logout: (authExpired: boolean = false, location: Location | null = null, silent: boolean = false) => {
    if (silent) {
      axios.post("/auth/logout").catch(() => {
        console.error("Silent logout request failed.");
      });
      return;
    }

    if (authExpired) {
      const url = AuthHelper.generateLoginURL(location ? location.href : null);
      window.location.assign(url);
    } else {
      const logoutEndpoint = "/api/v1/auth/logout";
      let redirURL =
        import.meta.env.MODE === "production"
          ? `${window.location.origin}${logoutEndpoint}`
          : `http://localhost:${
              import.meta.env.VITE_SERVER_PORT || "5000"
            }${logoutEndpoint}`;
      window.location.assign(redirURL);
    }
  },
};

export default AuthHelper;
