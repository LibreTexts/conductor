import React, { useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import axios from 'axios';
import { Dimmer, Loader } from 'semantic-ui-react';
import useGlobalError from '../components/error/ErrorHooks.js';

/**
 * Wraps a component to ensure that the current Organization's information
 * has been loaded to state. When information is being loaded, a Dimmer and Loader are
 * used to delay rendering of the wrapped component.
 *
 * @param {React.ReactElement} WrappedComponent - The component to enhance.
 * @returns {React.ReactElement} The passed component with Organization information loaded.
 */
const withOrgStateDependency = (WrappedComponent) => {
  const WithOrgStateDependency = (props) => {

    // Global State and Error Handling
    const dispatch = useDispatch();
    const org = useSelector((state) => state.org);
    const { handleGlobalError } = useGlobalError();

    const loadedOrg = useRef(false);

    /**
     * If Org information has not been loaded, retrieve it via GET request.
     */
    useEffect(() => {
      async function loadOrg() {
        const orgRes = await axios.get('/org');
        if (!orgRes.data.err) {
          dispatch({
            type: 'SET_ORG_INFO',
            payload: orgRes.data.org,
          });
          loadedOrg.current = true;
        } else {
          handleGlobalError(orgRes.data.errMsg);
        }
      }
      if (org.orgID === '' && !loadedOrg.current) {
        loadOrg();
      }
    }, [org.orgID, dispatch, handleGlobalError]);

    /* Display loader while getting Organization */
    if (org.orgID === '') {
      return (
        <Dimmer active aria-live="polite" aria-busy={true}>
          <Loader />
        </Dimmer>
      );
    }
    return <WrappedComponent {...props} />;
  };

  const wrappedComponentName = WrappedComponent.displayName || WrappedComponent.name || 'Component';
  WithOrgStateDependency.displayName = `withOrgState(${wrappedComponentName})`;
  return WithOrgStateDependency;
};

export default withOrgStateDependency;
