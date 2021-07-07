import { Route } from 'react-router-dom';
import React from 'react';

import AuthHelper from './AuthHelper.js';

const PrivateRoute = ({ component: Component, ...rest }) => (
    <Route {...rest} render={(props) => (
        AuthHelper.isAuthenticated() === true
        ? <Component {...props} />
        : window.location.assign('/login')
    )} />
);

export default PrivateRoute;
