import { RouteProps, Route, Redirect } from "react-router-dom";
import { Organization } from "../../types";

/**
 * A route that can only be accessed from the main LibreTexts instance. If the current
 * instance is not the LibreTexts, the user will be redirected to the main instance.
 * DOES NOT ENFORCE AUTHENTICATION.
 */

const LibreTextsRoute = ({
  component: Component,
  org,
  ...rest
}: RouteProps & { org: Organization }) => (
  <Route
    {...rest}
    render={(props) => {
      if (org.orgID === "libretexts") {
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
    }}
  />
);

export default LibreTextsRoute;
