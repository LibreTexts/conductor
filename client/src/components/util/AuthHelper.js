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
    return Cookies.get("conductor_access") !== undefined;
  },

  /**
   * Generates a URL to direct the browser to the LibreOne CAS login screen.
   *
   * @param {string} [redirectURI=null] - URI to redirect browser to upon successful login.
   * @returns {string} The generated URL.
   */
  generateLoginURL: (redirectURI = null) => {
    const cookiesOptions =
      import.meta.env.MODE === "production"
        ? { domain: (import.meta.env.VITE_PRODUCTION_URLS || "").split(",")[0] }
        : undefined;
    Cookies.set(
      "conductor_auth_redirect",
      window.location.origin,
      cookiesOptions
    );

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
   */
  logout: (authExpired = false, location = null) => {
    if (authExpired) {
      let newPath = "/login?src=authexpired";
      /* Process a possible redirect URL */
      if (typeof location === "object") {
        let redirectURI = "";
        if (
          typeof location.pathname === "string" &&
          location.pathname.length > 0
        ) {
          redirectURI = location.pathname;
        }
        if (typeof location.search === "string" && location.search.length > 0) {
          redirectURI = `${redirectURI}${location.search}`;
        }
        if (redirectURI.length > 0)
          newPath = `${newPath}&redirect_uri=${encodeURIComponent(
            redirectURI
          )}`;
      }
      window.location.assign(newPath);
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
