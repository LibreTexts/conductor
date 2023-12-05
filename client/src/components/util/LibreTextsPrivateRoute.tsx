import { Redirect, Route } from "react-router-dom";
import AuthHelper from "./AuthHelper";

const LibreTextsPrivateRoute = ({ component: Component, ...rest }: any) => (
  <Route
    {...rest}
    render={(props) => {
      if (AuthHelper.isAuthenticated()) {
        if (rest.org.orgID === "libretexts") {
          // @ts-ignore
          return <Component {...rest} />;
        }

        // redirect to main instance
        let redirectURI = props.location.pathname;
        let redirectParams;
        if (props.location.search) {
          redirectParams = new URLSearchParams(props.location.search);
        }

        return (
          <Redirect
            to={`https://commons.libretexts.org/${redirectURI}${
              redirectParams ? `?${redirectParams}` : ""
            }`}
          />
        );
      }

      // redirect to login
      const redirectParams = new URLSearchParams();
      let redirectURI = props.location.pathname;
      if (props.location.search) {
        redirectURI = `${redirectURI}${props.location.search}`;
      }
      redirectParams.set("redirect_uri", redirectURI);
      return <Redirect to={`https://commons.libretexts.org/login?${redirectParams.toString()}`} />;
    }}
  />
);

export default LibreTextsPrivateRoute;
