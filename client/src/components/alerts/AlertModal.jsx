import {
  Icon,
  Button,
  Modal,
  Form,
  Input,
  Select
} from 'semantic-ui-react';
import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import axios from 'axios';

import {
  alertResourceTypes,
  alertTimingOptions,
  alertProjectLocationFilters,
  getAlertResourceText,
  getAlertTimingText,
  getAlertTimingDescription,
  getAlertProjectLocationFilterText
} from '../util/AlertHelpers.js';

import useGlobalError from '../error/ErrorHooks';

const AlertModal = ({
  open,
  onClose,
  query,
  mode,
  alertData
}) => {

  const resourcesDefault = {
    project: false,
    book: false,
    homework: false
  };
  const projLocationDefault = 'global';

  // Global State and Error Handling
  const { handleGlobalError } = useGlobalError();

  // UI
  const [modalLoading, setModalLoading] = useState(false);

  // Data
  const [alertQuery, setAlertQuery] = useState('');
  const [resources, setResources] = useState(resourcesDefault);
  const [projLocation, setProjLocation] = useState(projLocationDefault);
  const [timing, setTiming] = useState(alertTimingOptions[0].value);

  // Error States
  const [queryError, setQueryError] = useState(false);
  const [resourcesError, setResourcesError] = useState(false);

  /**
   * If applicable, set the provided query in UI.
   */
  useEffect(() => {
    if (typeof (query) === 'string' && query.length > 0 && query.length <= 150) {
      setAlertQuery(query);
    }
  }, [query, setAlertQuery]);

  /**
   * Resets the Create Alert form's error states.
   */
  const resetCreateForm = () => {
    setQueryError(false);
    setResourcesError(false);
  };

  /**
   * Internal safety method for closing the Modal.
   */
  const closeModalInternal = () => {
    setAlertQuery('');
    setResources(resourcesDefault);
    setProjLocation(projLocationDefault);
    setTiming(alertTimingOptions[0].value);
    setModalLoading(false);
    resetCreateForm();
    if (typeof (onClose) === 'function') onClose();
  };

  /**
   * Validates the Create Alert form and sets error states, if necessary.
   * @returns {boolean} True if valid form, false otherwise.
   */
  const validateCreateForm = () => {
    let validForm = true;
    if (alertQuery.length === 0 || alertQuery.length > 150) {
      validForm = false;
      setQueryError(true);
    }
    let oneResource = false;
    Object.keys(resources).forEach((key) => {
      if (resources[key] === true && !oneResource) {
        oneResource = true;
      }
    });
    if (!oneResource) {
      validForm = false;
      setResourcesError(true);
    }
    return validForm;
  };

  /**
   * Submits the new Alert to the server, then closes the Modal.
   */
  const createAlert = () => {
    setModalLoading(true);
    resetCreateForm();
    if (validateCreateForm()) {
      let resourceTypes = [];
      alertResourceTypes.forEach((type) => {
        if (resources[type.key] === true) {
          resourceTypes.push(type.value);
        }
      });
      let alertData = {
        query: alertQuery,
        resources: resourceTypes,
        timing
      };
      if (resourceTypes.includes('project')) alertData.projectLocation = projLocation;
      axios.post('/alert', alertData).then((res) => {
        if (!res.data.err) {
          closeModalInternal();
        } else {
          setModalLoading(false);
          handleGlobalError(res.data.errMsg);
        }
      }).catch((err) => {
        setModalLoading(false);
        handleGlobalError(err);
      });
    } else {
      setModalLoading(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={closeModalInternal}
      size='fullscreen'
    >
      <Modal.Header>{(mode === 'create' ? 'Create' : 'View')} Alert</Modal.Header>
      <Modal.Content>
        {(mode === 'create') ? (
          <>
            <Form>
              <Form.Field error={queryError}>
                <label>Search Query</label>
                <Input
                  type='text'
                  placeholder='Search query...'
                  onChange={(_e, { value }) => setAlertQuery(value)}
                  value={alertQuery}
                />
              </Form.Field>
              <label className='form-field-label' htmlFor='alert-modal-resourcetypes'>Resource Types</label>
              <div id='alert-modal-resourcetypes' className='mt-1p mb-1p'>
                {alertResourceTypes.map((item, idx) => {
                  return (
                    <Form.Checkbox
                      key={`alert-resource-option-${idx}`}
                      checked={resources[item.key]}
                      label={item.text}
                      onChange={() => {
                        setResources({
                          ...resources,
                          [item.key]: !resources[item.key]
                        });
                      }}
                      error={resourcesError}
                    />
                  )
                })}
              </div>
              {(resources['project'] === true) && (
                <Form.Field
                  control={Select}
                  label='Project Location Filter'
                  options={alertProjectLocationFilters}
                  placeholder='Project Location...'
                  value={projLocation}
                  onChange={(_e, { value }) => setProjLocation(value)}
                />
              )}
              <label className='form-field-label' htmlFor='alert-modal-timingoptions'>Timing</label>
              <div id='alert-modal-timingoptions' className='mt-1p mb-1p'>
                {alertTimingOptions.map((item, idx) => {
                  return (
                    <Form.Radio
                      key={`alert-timing-option-${idx}`}
                      checked={timing === item.value}
                      label={`${item.text} ${item.description}`}
                      value={item.value}
                      onChange={(_e, { value }) => setTiming(value)}
                    />
                  )
                })}
              </div>
            </Form>
          </>
        ) : (
          <>
            <p><strong>Search Query:</strong> {alertData.query}</p>
            <p><strong>Resource Types:</strong></p>
            {(Array.isArray(alertData.resources)) && (
              <ul>
                {alertData.resources.map((item, idx) => {
                  return (
                    <li key={`alert-modal-resourcetypes-view-${idx}`}>{getAlertResourceText(item)}</li>
                  )
                })}
              </ul>
            )}
            {(Array.isArray(alertData.resources) && alertData.resources.includes('project')) && (
              <p>
                <strong>Project Location Filter: </strong>
                <em>
                  {(alertData.projectLocation === 'global')
                    ? getAlertProjectLocationFilterText(alertData.projectLocation)
                    : `${alertData.org.name} instance`
                  }
                </em>
              </p>
            )}
            <p><strong>Timing: </strong> {getAlertTimingText(alertData.timing)} <span className='muted-text'>{getAlertTimingDescription(alertData.timing)}</span></p>
          </>
        )}
      </Modal.Content>
      <Modal.Actions>
        {(mode === 'create') ? (
          <>
            <Button onClick={closeModalInternal}>Cancel</Button>
            <Button color='green' onClick={createAlert} loading={modalLoading}>
              <Icon name='add' />
              Create Alert
            </Button>
          </>
        ) : (
          <Button onClick={closeModalInternal} color='blue'>Done</Button>
        )}
      </Modal.Actions>
    </Modal>
  );
};

AlertModal.defaultProps = {
  open: false,
  onClose: () => { },
  query: '',
  mode: 'create',
  alertData: null
};

AlertModal.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  query: PropTypes.string,
  mode: PropTypes.string.isRequired,
  alertData: PropTypes.object
};

export default AlertModal;
