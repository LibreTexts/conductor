//
// PrivateRoute
//  Specifies a route in which a user SHOULD be authenticated
//  If the user is authenticated, they should be redirected to login
//

import { Route } from 'react-router-dom';
import React from 'react';

import AuthHelper from './AuthHelper.js';

const PrivateRoute = ({ component: Component, ...rest }) => (
    <Route {...rest} render={(props) => {
        if (AuthHelper.isAuthenticated() === true) {
            return (<Component {...props} />)
        } else {
            let redirectURI = encodeURIComponent(props.location.pathname);
            if (props.location.search !== '') {
                redirectURI += encodeURIComponent(props.location.search);
            }
            window.location.assign(`/login?redirect_uri=${redirectURI}`);
        }
    }} />
);

export default PrivateRoute;
