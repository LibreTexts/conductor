import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import axios from 'axios';
import {
  Button,
  Checkbox,
  Input,
  Modal,
  Select,
} from '@libretexts/davis-react';
import { IconPlus } from '@tabler/icons-react';

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

const AlertModal = ({ open, onClose, query, mode, alertData }) => {

  const resourcesDefault = {
    project: false,
    book: false,
    homework: false,
  };
  const projLocationDefault = 'global';

  const { handleGlobalError } = useGlobalError();

  const [modalLoading, setModalLoading] = useState(false);
  const [alertQuery, setAlertQuery] = useState('');
  const [resources, setResources] = useState(resourcesDefault);
  const [projLocation, setProjLocation] = useState(projLocationDefault);
  const [timing, setTiming] = useState(alertTimingOptions[0].value);

  const [queryError, setQueryError] = useState(false);
  const [resourcesError, setResourcesError] = useState(false);

  useEffect(() => {
    if (typeof query === 'string' && query.length > 0 && query.length <= 150) {
      setAlertQuery(query);
    }
  }, [query, setAlertQuery]);

  const resetCreateForm = () => {
    setQueryError(false);
    setResourcesError(false);
  };

  const closeModalInternal = () => {
    setAlertQuery('');
    setResources(resourcesDefault);
    setProjLocation(projLocationDefault);
    setTiming(alertTimingOptions[0].value);
    setModalLoading(false);
    resetCreateForm();
    if (typeof onClose === 'function') onClose();
  };

  const validateCreateForm = () => {
    let validForm = true;
    if (alertQuery.length === 0 || alertQuery.length > 150) {
      validForm = false;
      setQueryError(true);
    }
    const oneResource = Object.values(resources).some((v) => v === true);
    if (!oneResource) {
      validForm = false;
      setResourcesError(true);
    }
    return validForm;
  };

  const createAlert = () => {
    setModalLoading(true);
    resetCreateForm();
    if (validateCreateForm()) {
      const resourceTypes = alertResourceTypes
        .filter((type) => resources[type.key] === true)
        .map((type) => type.value);
      const alertPayload = { query: alertQuery, resources: resourceTypes, timing };
      if (resourceTypes.includes('project')) alertPayload.projectLocation = projLocation;
      axios.post('/alert', alertPayload).then((res) => {
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

  const projLocationOptions = alertProjectLocationFilters.map((f) => ({
    value: f.value,
    label: f.text,
  }));

  return (
    <Modal open={open} onClose={closeModalInternal} size="xl">
      <Modal.Header>
        <Modal.Title>{mode === 'create' ? 'Create' : 'View'} Alert</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {mode === 'create' ? (
          <div className="space-y-5">
            <Input
              name="alert-query"
              label="Search Query"
              type="text"
              placeholder="Search query..."
              value={alertQuery}
              onChange={(e) => setAlertQuery(e.target.value)}
              error={queryError}
              errorMessage="Please enter a search query (max 150 characters)."
            />

            <div>
              <p className="text-sm font-semibold text-gray-900 mb-2">Resource Types</p>
              {resourcesError && (
                <p className="text-sm text-danger mb-2">Please select at least one resource type.</p>
              )}
              <div className="space-y-2">
                {alertResourceTypes.map((item) => (
                  <Checkbox
                    key={item.key}
                    name={`resource-${item.key}`}
                    label={item.text}
                    checked={resources[item.key]}
                    error={resourcesError}
                    onChange={() =>
                      setResources({ ...resources, [item.key]: !resources[item.key] })
                    }
                  />
                ))}
              </div>
            </div>

            {resources['project'] === true && (
              <Select
                name="proj-location"
                label="Project Location Filter"
                value={projLocation}
                options={projLocationOptions}
                placeholder="Project Location..."
                onChange={(e) => setProjLocation(e.target.value)}
              />
            )}

            <div>
              <p className="text-sm font-semibold text-gray-900 mb-2">Timing</p>
              <div className="space-y-2">
                {alertTimingOptions.map((item) => (
                  <Checkbox
                    key={item.key}
                    name={`timing-${item.key}`}
                    label={`${item.text} ${item.description}`}
                    checked={timing === item.value}
                    onChange={() => setTiming(item.value)}
                  />
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-3 text-sm">
            <p><strong>Search Query:</strong> {alertData?.query}</p>
            <div>
              <p className="font-semibold">Resource Types:</p>
              {Array.isArray(alertData?.resources) && (
                <ul className="mt-1 space-y-1 pl-4 list-disc">
                  {alertData.resources.map((item, idx) => (
                    <li key={`alert-modal-resource-view-${idx}`}>{getAlertResourceText(item)}</li>
                  ))}
                </ul>
              )}
            </div>
            {Array.isArray(alertData?.resources) && alertData.resources.includes('project') && (
              <p>
                <strong>Project Location Filter: </strong>
                <em>
                  {alertData.projectLocation === 'global'
                    ? getAlertProjectLocationFilterText(alertData.projectLocation)
                    : `${alertData.org?.name} instance`}
                </em>
              </p>
            )}
            <p>
              <strong>Timing: </strong>
              {getAlertTimingText(alertData?.timing)}{' '}
              <span className="text-gray-500">{getAlertTimingDescription(alertData?.timing)}</span>
            </p>
          </div>
        )}
      </Modal.Body>
      <Modal.Footer>
        {mode === 'create' ? (
          <>
            <Button variant="outline" onClick={closeModalInternal}>
              Cancel
            </Button>
            <Button
              variant="primary"
              icon={<IconPlus size={16} />}
              loading={modalLoading}
              onClick={createAlert}
            >
              Create Alert
            </Button>
          </>
        ) : (
          <Button variant="primary" onClick={closeModalInternal}>
            Done
          </Button>
        )}
      </Modal.Footer>
    </Modal>
  );
};

AlertModal.defaultProps = {
  open: false,
  onClose: () => {},
  query: '',
  mode: 'create',
  alertData: null,
};

AlertModal.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  query: PropTypes.string,
  mode: PropTypes.string.isRequired,
  alertData: PropTypes.object,
};

export default AlertModal;
