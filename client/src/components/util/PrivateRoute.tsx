import React from 'react';
import { Redirect, Route, RouteProps } from 'react-router-dom';
import AuthHelper from './AuthHelper';

interface PrivateRouteProps extends RouteProps {
  component: React.ComponentType<any>;
  unAuthSrc?: string;
}

/**
 * A route in which the user SHOULD be authenticated. If the user is not
 * authenticated, they are redirected to login.
 */
const PrivateRoute: React.FC<PrivateRouteProps> = ({ component: Component, unAuthSrc, ...rest }) => (
  <Route {...rest} render={(props) => {
    if (AuthHelper.isAuthenticated()) {
      return (<Component {...props} />)
    }

    const redirectParams = new URLSearchParams();
    let redirectURI = props.location.pathname;
    if (props.location.search) {
      redirectURI = `${redirectURI}${props.location.search}`;
    }
    redirectParams.set('redirect_uri', redirectURI);

    if (unAuthSrc) {
      redirectParams.set('src', unAuthSrc);
    }

    return <Redirect to={`/login?${redirectParams.toString()}`} />;
  }} />
);

export default PrivateRoute;
