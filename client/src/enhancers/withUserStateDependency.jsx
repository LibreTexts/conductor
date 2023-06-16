import React, { useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import axios from 'axios';
import useGlobalError from '../components/error/ErrorHooks';

/**
 * Wraps a component to attempt to load the currently authenticated user's
 * information into state, if applicable.
 *
 * @param {React.ReactElement | React.FC} WrappedComponent - The component to enhance.
 * @returns {React.ReactElement} The passed component with user information loaded, if available.
 */
const withUserStateDependency = (WrappedComponent) => {
  const WithUserStateDependency = (props) => {

    // Global State and Error Handling
    const dispatch = useDispatch();
    const user = useSelector((state) => state.user);
    const { handleGlobalError } = useGlobalError();

    const loadedUser = useRef(false);

    /**
     * Check if the browser has an auth token.
     * (Updates global state var 'isAuthenticated')
     */
    useEffect(() => {
      dispatch({
        type: 'CHECK_AUTH',
      });
    }, [dispatch]);

    /**
     * Check if user is authenticated and if
     * user information has NOT been fetched,
     * retrieve it via GET request.
     */
    useEffect(() => {
      if (user.isAuthenticated && !loadedUser.current) {
        axios.get('/user/basicinfo').then((res) => {
          if (!res.data.err && res.data.user !== null) {
            dispatch({
              type: 'SET_USER_INFO',
              payload: {
                uuid: res.data.user.uuid,
                authType: res.data.user.authType,
                firstName: res.data.user.firstName,
                lastName: res.data.user.lastName,
                avatar: res.data.user.avatar,
                roles: res.data.user.roles,
                verifiedInstructor: res.data.user.verifiedInstructor,
              }
            });
            loadedUser.current = true;
          } else {
            handleGlobalError(res.data.errMsg);
          }
        }).catch((err) => {
          if (err.response?.data?.tokenExpired !== true) {
            handleGlobalError("Oops, we encountered an error.");
          }
        });
      }
    }, [user.isAuthenticated, dispatch, handleGlobalError]);

    return <WrappedComponent {...props} />
  };

  const wrappedComponentName = WrappedComponent.displayName || WrappedComponent.name || 'Component';
  WithUserStateDependency.displayName = `withUserState(${wrappedComponentName})`;
  return WithUserStateDependency;
};

export default withUserStateDependency;
