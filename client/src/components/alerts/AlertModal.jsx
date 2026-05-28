import { Button, Checkbox, Input, Modal, Select } from "@libretexts/davis-react";
import { IconPlus } from "@tabler/icons-react";
import React, { useState, useEffect } from "react";
import PropTypes from "prop-types";
import axios from "axios";

import {
  alertResourceTypes,
  alertTimingOptions,
  alertProjectLocationFilters,
  getAlertResourceText,
  getAlertTimingText,
  getAlertTimingDescription,
  getAlertProjectLocationFilterText,
} from "../util/AlertHelpers.js";

import useGlobalError from "../error/ErrorHooks";

const AlertModal = ({ open, onClose, query, mode, alertData }) => {
  const resourcesDefault = {
    project: false,
    book: false,
    homework: false,
  };
  const projLocationDefault = "global";

  const { handleGlobalError } = useGlobalError();

  const [modalLoading, setModalLoading] = useState(false);

  const [alertQuery, setAlertQuery] = useState("");
  const [resources, setResources] = useState(resourcesDefault);
  const [projLocation, setProjLocation] = useState(projLocationDefault);
  const [timing, setTiming] = useState(alertTimingOptions[0].value);

  const [queryError, setQueryError] = useState(false);
  const [resourcesError, setResourcesError] = useState(false);

  useEffect(() => {
    if (typeof query === "string" && query.length > 0 && query.length <= 150) {
      setAlertQuery(query);
    }
  }, [query]);

  const resetCreateForm = () => {
    setQueryError(false);
    setResourcesError(false);
  };

  const closeModalInternal = () => {
    setAlertQuery("");
    setResources(resourcesDefault);
    setProjLocation(projLocationDefault);
    setTiming(alertTimingOptions[0].value);
    setModalLoading(false);
    resetCreateForm();
    if (typeof onClose === "function") onClose();
  };

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
      let alertPayload = {
        query: alertQuery,
        resources: resourceTypes,
        timing,
      };
      if (resourceTypes.includes("project"))
        alertPayload.projectLocation = projLocation;
      axios
        .post("/alert", alertPayload)
        .then((res) => {
          if (!res.data.err) {
            closeModalInternal();
          } else {
            setModalLoading(false);
            handleGlobalError(res.data.errMsg);
          }
        })
        .catch((err) => {
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
        <Modal.Title>{mode === "create" ? "Create" : "View"} Alert</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {mode === "create" ? (
          <div className="flex flex-col gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">
                Search Query
              </label>
              <Input
                type="text"
                placeholder="Search query..."
                value={alertQuery}
                onChange={(e) => setAlertQuery(e.target.value)}
                className={queryError ? "border-red-500" : ""}
              />
              {queryError && (
                <p className="text-red-500 text-sm mt-1">
                  Please enter a valid search query (1–150 characters).
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Resource Types
              </label>
              <div className="flex flex-col gap-2">
                {alertResourceTypes.map((item, idx) => (
                  <Checkbox
                    key={`alert-resource-option-${idx}`}
                    name={`resource-${item.key}`}
                    checked={resources[item.key]}
                    label={item.text}
                    onChange={() =>
                      setResources({
                        ...resources,
                        [item.key]: !resources[item.key],
                      })
                    }
                  />
                ))}
              </div>
              {resourcesError && (
                <p className="text-red-500 text-sm mt-1">
                  Please select at least one resource type.
                </p>
              )}
            </div>

            {resources["project"] === true && (
              <div>
                <label className="block text-sm font-medium mb-1">
                  Project Location Filter
                </label>
                <Select
                  options={projLocationOptions}
                  value={projLocation}
                  onChange={(e) => setProjLocation(e.target.value)}
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium mb-2">Timing</label>
              <div className="flex flex-col gap-2">
                {alertTimingOptions.map((item, idx) => (
                  <Checkbox
                    key={`alert-timing-option-${idx}`}
                    name={`timing-${item.value}`}
                    checked={timing === item.value}
                    label={`${item.text} ${item.description}`}
                    onChange={() => setTiming(item.value)}
                  />
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <p>
              <strong>Search Query:</strong> {alertData?.query}
            </p>
            <p>
              <strong>Resource Types:</strong>
            </p>
            {Array.isArray(alertData?.resources) && (
              <ul className="list-disc ml-6">
                {alertData.resources.map((item, idx) => (
                  <li key={`alert-modal-resourcetypes-view-${idx}`}>
                    {getAlertResourceText(item)}
                  </li>
                ))}
              </ul>
            )}
            {Array.isArray(alertData?.resources) &&
              alertData.resources.includes("project") && (
                <p>
                  <strong>Project Location Filter: </strong>
                  <em>
                    {alertData.projectLocation === "global"
                      ? getAlertProjectLocationFilterText(
                          alertData.projectLocation
                        )
                      : `${alertData.org?.name} instance`}
                  </em>
                </p>
              )}
            <p>
              <strong>Timing: </strong>
              {getAlertTimingText(alertData?.timing)}{" "}
              <span className="text-gray-500">
                {getAlertTimingDescription(alertData?.timing)}
              </span>
            </p>
          </div>
        )}
      </Modal.Body>
      <Modal.Footer>
        {mode === "create" ? (
          <>
            <Button variant="outline" onClick={closeModalInternal}>
              Cancel
            </Button>
            <Button
              variant="primary"
              icon={<IconPlus size={16} />}
              onClick={createAlert}
              loading={modalLoading}
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
  query: "",
  mode: "create",
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
