import React from 'react';
import PropTypes from 'prop-types';
import { Redirect, Route } from 'react-router-dom';
import AuthHelper from './AuthHelper';

/**
 * A route in which the user SHOULD be authenticated. If the user is not
 * authenticated, they are redirected to login.
 */
const PrivateRoute = ({ component: Component, unAuthSrc, ...rest }) => (
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

PrivateRoute.propTypes = {
  /**
   * The component to render if the user is authenticated.
   */
  component: PropTypes.elementType.isRequired,
  /**
   * A `src` parameter to include in the login redirect if the user is not authenticated.
   */
  unAuthSrc: PropTypes.string,
};

export default PrivateRoute;
