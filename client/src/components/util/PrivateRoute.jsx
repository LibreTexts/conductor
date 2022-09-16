import React from 'react';
import PropTypes from 'prop-types';
import { Redirect, Route } from 'react-router-dom';
import AuthHelper from './AuthHelper.js';

/**
 * A route in which the user SHOULD be authenticated. If the user is not
 * authenticated, they are redirected to login.
 */
const PrivateRoute = ({ component: Component, ...rest }) => (
  <Route {...rest} render={(props) => {
    if (AuthHelper.isAuthenticated()) {
      return (<Component {...props} />)
    }

    let redirectURI = props.location.pathname;
    if (props.location.search) {
      redirectURI = `${redirectURI}${props.location.search}`;
    }
    redirectURI = encodeURIComponent(redirectURI);
    return <Redirect to={{ pathname: '/login', search: `?redirect_uri=${redirectURI}` }} />;
  }} />
);

PrivateRoute.propTypes = {
  /**
   * The component to render if the user is authenticated.
   */
  component: PropTypes.elementType.isRequired,
};

export default PrivateRoute;
