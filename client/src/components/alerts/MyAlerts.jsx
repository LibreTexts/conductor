import '../projects/Projects.css';

import {
  Grid,
  Header,
  Segment,
  List,
  Divider,
  Icon,
  Button,
  Dropdown,
  Popup,
  Modal,
  Loader,
} from 'semantic-ui-react';
import React, { useState, useEffect, useCallback } from 'react';
import { useHistory, useLocation } from 'react-router-dom';
import axios from 'axios';
import date from 'date-and-time';
import ordinal from 'date-and-time/plugin/ordinal';

import AlertModal from './AlertModal.jsx';

import useGlobalError from '../error/ErrorHooks.js';

const MyAlerts = (_props) => {

  const sortParam = 'sort';
  const sortDefault = 'title';
  const alertModalDefaultMode = 'create';

  // Global State and Error Handling
  const { handleGlobalError } = useGlobalError();
  const history = useHistory();
  const location = useLocation();

  // UI
  const [loadedData, setLoadedData] = useState(false);
  const [sortChoice, setSortChoice] = useState('');

  // Data
  const [alerts, setAlerts] = useState([]);

  // Create/View Alert Modal
  const [showAlertModal, setShowAlertModal] = useState(false);
  const [alertModalMode, setAlertModalMode] = useState(alertModalDefaultMode);
  const [alertModalData, setAlertModalData] = useState(null);

  // Delete Alert Modal
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteAlertData, setDeleteAlertData] = useState({});
  const [deleteAlertLoading, setDeleteAlertLoading] = useState(false);

  const sortOptions = [
    { key: 'title', text: 'Sort by Alert Title/Query', value: 'title' },
    { key: 'date', text: 'Sort by Alert Creation Date', value: 'date' }
  ];

  /**
   * Initialization and plugin registration.
   */
  useEffect(() => {
    document.title = 'LibreTexts Conductor | My Alerts';
    date.plugin(ordinal);
  }, []);

  /**
   * Retrive the user's Alerts from the server.
   */
  const getUserAlerts = useCallback((sort) => {
    setLoadedData(false);
    axios.get('/alerts', {
      params: {
        sort
      }
    }).then((res) => {
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

  /**
   * Subscribe to changes in the URL search query and process parameters.
   */
  useEffect(() => {
    const urlParams = new URLSearchParams(location.search);
    const sort = urlParams.get(sortParam) || sortDefault;
    setSortChoice(sort);
    getUserAlerts(sort);
  }, [location.search, setSortChoice, getUserAlerts]);

  /**
   * Update the URL search query with a new value after a filter or sort option change.
   * @param {string} name - The internal filter or sort option name.
   * @param {string} newValue - The new value of the search parameter to set.
   */
  const handleFilterSortChange = (name, newValue) => {
    let urlParams = new URLSearchParams(location.search);
    switch (name) {
      case 'sort':
        urlParams.set(sortParam, newValue);
        break;
      default:
        break;
    }
    history.push({ search: urlParams.toString() });
  };

  /**
   * Opens the Add/View Alert Modal and sets associated state.
   * @param {string} mode - Mode to open the Modal in. 
   * @param {object} [alertData=null] - Alert Data object if in View mode.
   */
  const openAlertModal = (mode, alertData = null) => {
    if (typeof (alertData) === 'object') setAlertModalData(alertData);
    setAlertModalMode(mode);
    setShowAlertModal(true);
  };

  /**
   * Close the Add Alert Modal and refresh the list of Alerts.
   */
  const closeAlertModal = () => {
    setShowAlertModal(false);
    setAlertModalMode(alertModalDefaultMode);
    setAlertModalData(null);
    getUserAlerts();
  };


  /**
   * Open the Delete Alert Modal and set the selected Alert in state.
   * @param {object} alertData - The Alert data object.
   */
  const openDeleteModal = (alertData) => {
    if (typeof (alertData) === 'object') {
      setDeleteAlertData(alertData);
      setShowDeleteModal(true);
    }
  };

  /**
   * Close the Delete Alert Modal, reset its state, and refresh the list of Alerts.
   * 
   * @param {boolean} [didDelete=false] - If the alert was deleted and the list should be refreshed.
   */
  const closeDeleteModal = (didDelete = false) => {
    setShowDeleteModal(false);
    setDeleteAlertData({});
    if (didDelete) {
      getUserAlerts();
    }
  };

  /**
   * Submit a request to the server to delete an alert, then close the Delete Alert Modal.
   */
  const deleteAlert = () => {
    if (typeof (deleteAlertData.alertID) === 'string') {
      setDeleteAlertLoading(true);
      axios.delete('/alert', {
        data: {
          alertID: deleteAlertData.alertID
        }
      }).then((res) => {
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
    <Grid className='component-container' divided='vertically'>
      <Grid.Row>
        <Grid.Column width={16}>
          <Header className='component-header'>My Alerts</Header>
        </Grid.Column>
      </Grid.Row>
      <Grid.Row>
        <Grid.Column width={16}>
          <Segment>
            <p>Conductor Alerts notify you when new LibreTexts Open Education resources and projects are
              available that match criteria you've specified. You can add a new Alert
              anytime by clicking <em>Create Alert</em> below or on a Search results page.
            </p>
            <div className='flex-row-div flex-row-verticalcenter'>
              <div className='left-flex'>
                <Dropdown
                  placeholder='Sort by...'
                  floating
                  selection
                  button
                  options={sortOptions}
                  onChange={(_e, { value }) => handleFilterSortChange('sort', value)}
                  value={sortChoice}
                  style={{
                    marginTop: '0.25rem !important'
                  }}
                  aria-label='Sort Alerts by'
                />
              </div>
              <div className='right-flex'>
                <Button color='green' onClick={() => openAlertModal('create')}>
                  <Icon name='add' />
                  Create Alert
                </Button>
              </div>
            </div>
            <Divider />
            {!loadedData && (
              <Loader active />
            )}
            {(loadedData && alerts.length > 0) && (
              <List divided verticalAlign='middle' className='mb-2p'>
                {alerts.map((item, idx) => {
                  const itemDate = new Date(item.createdAt);
                  item.createdDate = date.format(itemDate, 'MMMM DDD, YYYY');
                  return (
                    <List.Item key={`user-alert-${idx}`}>
                      <div className='flex-row-div'>
                        <div className='left-flex'>
                          <div className='flex-col-div'>
                            <p className='margin-none'><strong>Query: </strong><em>{item.query}</em></p>
                            <p className='muted-text'>Created {item.createdDate}</p>
                          </div>
                        </div>
                        <div className='right-flex'>
                          <Popup
                            content='Delete Alert'
                            trigger={
                              <Button
                                onClick={() => openDeleteModal(item)}
                                icon='trash'
                                color='red'
                              />
                            }
                            position='top center'
                          />
                          <Popup
                            content='View Alert Details'
                            trigger={
                              <Button
                                onClick={() => openAlertModal('view', item)}
                                icon='eye'
                                color='blue'
                              />
                            }
                            position='top center'
                          />
                        </div>
                      </div>
                    </List.Item>
                  )
                })}
              </List>
            )}
            {(loadedData && alerts.length === 0) && (
              <p className='mt-2p mb-2p muted-text text-center'>No alerts yet!</p>
            )}
          </Segment>
          {/* Delete Alert Modal */}
          <Modal open={showDeleteModal} onClose={() => closeDeleteModal(false)}>
            <Modal.Header>Delete Alert</Modal.Header>
            <Modal.Content>
              <p>Are you sure you want to delete this alert? You will stop receiving notifications for new resources matching its criteria.</p>
            </Modal.Content>
            <Modal.Actions>
              <Button onClick={() => closeDeleteModal(false)}>Cancel</Button>
              <Button color='red' onClick={deleteAlert} loading={deleteAlertLoading}>
                <Icon name='trash' />
                Delete Alert
              </Button>
            </Modal.Actions>

          </Modal>
          {/* Add/View Alert Modal */}
          <AlertModal
            open={showAlertModal}
            onClose={closeAlertModal}
            mode={alertModalMode}
            alertData={alertModalData}
          />
        </Grid.Column>
      </Grid.Row>
    </Grid>
  );

};

export default MyAlerts;
