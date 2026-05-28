import React, { useState, useEffect, useCallback } from 'react';
import { useHistory, useLocation } from 'react-router-dom';
import axios from 'axios';
import date from 'date-and-time';
import ordinal from 'date-and-time/plugin/ordinal';
import {
  Button,
  Divider,
  Heading,
  IconButton,
  Modal,
  Select,
  Spinner,
} from '@libretexts/davis-react';
import { IconPlus, IconTrash, IconEye } from '@tabler/icons-react';

import AlertModal from './AlertModal.jsx';
import useGlobalError from '../error/ErrorHooks';

const MyAlerts = (_props) => {

  const sortParam = 'sort';
  const sortDefault = 'title';
  const alertModalDefaultMode = 'create';

  const { handleGlobalError } = useGlobalError();
  const history = useHistory();
  const location = useLocation();

  const [loadedData, setLoadedData] = useState(false);
  const [sortChoice, setSortChoice] = useState('');
  const [alerts, setAlerts] = useState([]);

  const [showAlertModal, setShowAlertModal] = useState(false);
  const [alertModalMode, setAlertModalMode] = useState(alertModalDefaultMode);
  const [alertModalData, setAlertModalData] = useState(null);

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteAlertData, setDeleteAlertData] = useState({});
  const [deleteAlertLoading, setDeleteAlertLoading] = useState(false);

  const sortOptions = [
    { value: 'title', label: 'Sort by Alert Title/Query' },
    { value: 'date', label: 'Sort by Alert Creation Date' },
  ];

  useEffect(() => {
    document.title = 'LibreTexts Conductor | My Alerts';
    date.plugin(ordinal);
  }, []);

  const getUserAlerts = useCallback((sort) => {
    setLoadedData(false);
    axios.get('/alerts', { params: { sort } }).then((res) => {
      if (!res.data.err) {
        if (Array.isArray(res.data.alerts)) {
          setAlerts(res.data.alerts);
        }
      } else {
        handleGlobalError(res.data.errMsg);
      }
      setLoadedData(true);
    }).catch((err) => {
      setLoadedData(true);
      handleGlobalError(err);
    });
  }, [setLoadedData, setAlerts, handleGlobalError]);

  useEffect(() => {
    const urlParams = new URLSearchParams(location.search);
    const sort = urlParams.get(sortParam) || sortDefault;
    setSortChoice(sort);
    getUserAlerts(sort);
  }, [location.search, setSortChoice, getUserAlerts]);

  const handleFilterSortChange = (name, newValue) => {
    const urlParams = new URLSearchParams(location.search);
    if (name === 'sort') urlParams.set(sortParam, newValue);
    history.push({ search: urlParams.toString() });
  };

  const openAlertModal = (mode, alertData = null) => {
    if (typeof alertData === 'object') setAlertModalData(alertData);
    setAlertModalMode(mode);
    setShowAlertModal(true);
  };

  const closeAlertModal = () => {
    setShowAlertModal(false);
    getUserAlerts();
  };

  const openDeleteModal = (alertData) => {
    if (typeof alertData === 'object') {
      setDeleteAlertData(alertData);
      setShowDeleteModal(true);
    }
  };

  const closeDeleteModal = (didDelete = false) => {
    setShowDeleteModal(false);
    setDeleteAlertData({});
    if (didDelete) getUserAlerts();
  };

  const deleteAlert = () => {
    if (typeof deleteAlertData.alertID === 'string') {
      setDeleteAlertLoading(true);
      axios.delete('/alert', { data: { alertID: deleteAlertData.alertID } }).then((res) => {
        if (!res.data.err) {
          closeDeleteModal(true);
        } else {
          handleGlobalError(res.data.errMsg);
        }
        setDeleteAlertLoading(false);
      }).catch((err) => {
        handleGlobalError(err);
        setDeleteAlertLoading(false);
      });
    }
  };

  return (
    <div className="bg-white px-8 pt-8 pb-8 min-h-screen">
      <Heading level={2} className="mb-6">My Alerts</Heading>

      <div className="border border-gray-200 rounded-lg p-6">
        <p className="text-gray-700 mb-4">
          Conductor Alerts notify you when new LibreTexts Open Education resources and projects are
          available that match criteria you've specified. You can add a new Alert
          anytime by clicking <em>Create Alert</em> below or on a Search results page.
        </p>

        <div className="flex items-center justify-between">
          <Select
            name="sort"
            label="Sort by"
            labelClassName="sr-only"
            value={sortChoice}
            options={sortOptions}
            placeholder="Sort by..."
            onChange={(e) => handleFilterSortChange('sort', e.target.value)}
            className="w-64"
          />
          <Button
            variant="primary"
            icon={<IconPlus size={16} />}
            onClick={() => openAlertModal('create')}
          >
            Create Alert
          </Button>
        </div>

        <Divider className="my-4" />

        {!loadedData && (
          <div className="flex justify-center py-8">
            <Spinner size="lg" />
          </div>
        )}

        {loadedData && alerts.length > 0 && (
          <div className="divide-y divide-gray-200">
            {alerts.map((item, idx) => {
              const itemDate = new Date(item.createdAt);
              item.createdDate = date.format(itemDate, 'MMMM DDD, YYYY');
              return (
                <div key={`user-alert-${idx}`} className="flex items-center justify-between py-3">
                  <div className="flex flex-col">
                    <p className="text-sm font-medium text-gray-900">
                      <strong>Query: </strong><em>{item.query}</em>
                    </p>
                    <p className="text-sm text-gray-500">Created {item.createdDate}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <IconButton
                      icon={<IconTrash size={16} />}
                      variant="destructive"
                      size="sm"
                      aria-label="Delete Alert"
                      tooltip="Delete Alert"
                      tooltipPosition="top"
                      onClick={() => openDeleteModal(item)}
                    />
                    <IconButton
                      icon={<IconEye size={16} />}
                      variant="primary"
                      size="sm"
                      aria-label="View Alert Details"
                      tooltip="View Alert Details"
                      tooltipPosition="top"
                      onClick={() => openAlertModal('view', item)}
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

      {/* Delete Alert Modal */}
      <Modal open={showDeleteModal} onClose={() => closeDeleteModal(false)} size="md">
        <Modal.Header>
          <Modal.Title>Delete Alert</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p className="text-gray-700">
            Are you sure you want to delete this alert? You will stop receiving notifications
            for new resources matching its criteria.
          </p>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline" onClick={() => closeDeleteModal(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            icon={<IconTrash size={16} />}
            loading={deleteAlertLoading}
            onClick={deleteAlert}
          >
            Delete Alert
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Create / View Alert Modal */}
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
