import "../projects/Projects.css";

import {
  Button,
  Heading,
  IconButton,
  Modal,
  Select,
  Spinner,
  Stack,
} from "@libretexts/davis-react";
import { IconEye, IconPlus, IconTrash } from "@tabler/icons-react";
import React, { useState, useEffect, useCallback } from "react";
import { useHistory, useLocation } from "react-router-dom";
import axios from "axios";
import date from "date-and-time";
import ordinal from "date-and-time/plugin/ordinal";

import AlertModal from "./AlertModal.jsx";

import useGlobalError from "../error/ErrorHooks";

const MyAlerts = (_props) => {
  const sortParam = "sort";
  const sortDefault = "title";
  const alertModalDefaultMode = "create";

  const { handleGlobalError } = useGlobalError();
  const history = useHistory();
  const location = useLocation();

  const [loadedData, setLoadedData] = useState(false);
  const [sortChoice, setSortChoice] = useState("");

  const [alerts, setAlerts] = useState([]);

  const [showAlertModal, setShowAlertModal] = useState(false);
  const [alertModalMode, setAlertModalMode] = useState(alertModalDefaultMode);
  const [alertModalData, setAlertModalData] = useState(null);

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteAlertData, setDeleteAlertData] = useState({});
  const [deleteAlertLoading, setDeleteAlertLoading] = useState(false);

  const sortOptions = [
    { value: "title", label: "Sort by Alert Title/Query" },
    { value: "date", label: "Sort by Alert Creation Date" },
  ];

  useEffect(() => {
    document.title = "LibreTexts Conductor | My Alerts";
    date.plugin(ordinal);
  }, []);

  const getUserAlerts = useCallback(
    (sort) => {
      setLoadedData(false);
      axios
        .get("/alerts", { params: { sort } })
        .then((res) => {
          if (!res.data.err) {
            if (Array.isArray(res.data.alerts)) {
              setAlerts(res.data.alerts);
            }
          } else {
            handleGlobalError(res.data.errMsg);
          }
          setLoadedData(true);
        })
        .catch((err) => {
          setLoadedData(true);
          handleGlobalError(err);
        });
    },
    [setLoadedData, setAlerts, handleGlobalError]
  );

  useEffect(() => {
    const urlParams = new URLSearchParams(location.search);
    const sort = urlParams.get(sortParam) || sortDefault;
    setSortChoice(sort);
    getUserAlerts(sort);
  }, [location.search, setSortChoice, getUserAlerts]);

  const handleFilterSortChange = (name, newValue) => {
    let urlParams = new URLSearchParams(location.search);
    if (name === "sort") urlParams.set(sortParam, newValue);
    history.push({ search: urlParams.toString() });
  };

  const openAlertModal = (mode, alertData = null) => {
    if (typeof alertData === "object") setAlertModalData(alertData);
    setAlertModalMode(mode);
    setShowAlertModal(true);
  };

  const closeAlertModal = () => {
    setShowAlertModal(false);
    getUserAlerts(sortChoice);
  };

  const openDeleteModal = (alertData) => {
    if (typeof alertData === "object") {
      setDeleteAlertData(alertData);
      setShowDeleteModal(true);
    }
  };

  const closeDeleteModal = (didDelete = false) => {
    setShowDeleteModal(false);
    setDeleteAlertData({});
    if (didDelete) {
      getUserAlerts(sortChoice);
    }
  };

  const deleteAlert = () => {
    if (typeof deleteAlertData.alertID === "string") {
      setDeleteAlertLoading(true);
      axios
        .delete("/alert", { data: { alertID: deleteAlertData.alertID } })
        .then((res) => {
          if (!res.data.err) {
            closeDeleteModal(true);
          } else {
            handleGlobalError(res.data.errMsg);
          }
          setDeleteAlertLoading(false);
        })
        .catch((err) => {
          handleGlobalError(err);
          setDeleteAlertLoading(false);
        });
    }
  };

  return (
    <div className="px-8 pt-6 pb-8">
      <Stack direction="row" className="justify-between items-center mb-6">
        <Heading level={2}>My Alerts</Heading>
        <Button
          variant="primary"
          icon={<IconPlus size={16} />}
          onClick={() => openAlertModal("create")}
        >
          Create Alert
        </Button>
      </Stack>

      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <div className="p-4 bg-gray-50 border-b border-gray-200">
          <p className="text-sm text-gray-600 mb-3">
            Conductor Alerts notify you when new LibreTexts Open Education
            resources and projects are available that match criteria you've
            specified. You can add a new Alert anytime by clicking{" "}
            <em>Create Alert</em> above or on a Search results page.
          </p>
          <Select
            options={sortOptions}
            value={sortChoice}
            onChange={(e) => handleFilterSortChange("sort", e.target.value)}
            aria-label="Sort Alerts by"
            className="max-w-xs"
          />
        </div>

        <div className="p-4">
          {!loadedData && (
            <div className="flex justify-center py-8">
              <Spinner />
            </div>
          )}
          {loadedData && alerts.length > 0 && (
            <div className="divide-y divide-gray-200">
              {alerts.map((item, idx) => {
                const itemDate = new Date(item.createdAt);
                const createdDate = date.format(itemDate, "MMMM DDD, YYYY");
                return (
                  <div
                    key={`user-alert-${idx}`}
                    className="flex items-center justify-between py-3"
                  >
                    <div>
                      <p className="font-medium">
                        <strong>Query: </strong>
                        <em>{item.query}</em>
                      </p>
                      <p className="text-sm text-gray-500">
                        Created {createdDate}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <IconButton
                        icon={<IconTrash size={16} />}
                        aria-label="Delete Alert"
                        tooltip="Delete Alert"
                        variant="destructive"
                        onClick={() => openDeleteModal(item)}
                      />
                      <IconButton
                        icon={<IconEye size={16} />}
                        aria-label="View Alert Details"
                        tooltip="View Alert Details"
                        variant="primary"
                        onClick={() => openAlertModal("view", item)}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {loadedData && alerts.length === 0 && (
            <p className="text-center text-gray-500 py-8">No alerts yet!</p>
          )}
        </div>
      </div>

      <Modal
        open={showDeleteModal}
        onClose={() => closeDeleteModal(false)}
        size="md"
      >
        <Modal.Header>
          <Modal.Title>Delete Alert</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p>
            Are you sure you want to delete this alert? You will stop receiving
            notifications for new resources matching its criteria.
          </p>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline" onClick={() => closeDeleteModal(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            icon={<IconTrash size={16} />}
            onClick={deleteAlert}
            loading={deleteAlertLoading}
          >
            Delete Alert
          </Button>
        </Modal.Footer>
      </Modal>

      <AlertModal
        open={showAlertModal}
        onClose={closeAlertModal}
        mode={alertModalMode}
        alertData={alertModalData}
      />
    </div>
  );
};

export default MyAlerts;
