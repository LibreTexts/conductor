import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import {
  Breadcrumb,
  Grid,
  Header,
  Icon,
  Loader,
  Segment,
  Table,
} from 'semantic-ui-react';
import date from 'date-and-time';
import ViewAccountRequest from '../../../../components/accountrequests/ViewAccountRequest';
import { getPurposeText } from '../../../../utils/accountRequestHelpers';
import useGlobalError from '../../../../components/error/ErrorHooks';

/**
 * The Account Requests interface allows administrators to view Instructor Account Requests
 * for LibreTexts services, submitted via Conductor.
 */
const AccountRequests = () => {

  const TABLE_COLS = [
    { key: 'date', text: 'Date' },
    { key: 'purpose', text: 'Purpose' },
    { key: 'email', text: 'Email' },
    { key: 'name', text: 'Name' },
    { key: 'institution', text: 'Institution' },
    { key: 'librenet', text: 'Requests LibreNet Info' },
  ];

  // Global error handling
  const { handleGlobalError } = useGlobalError();

  // UI
  const [loading, setLoading] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);

  // Data
  const [accountRequests, setAccountRequests] = useState([]);
  const [currentRequest, setCurrentRequest] = useState(null);

  /**
   * Loads Account Requests from the server and saves them to state.
   */
  const getAccountRequests = useCallback(async () => {
    try {
      setLoading(true);
      const arRes = await axios.get('/accountrequests');
      if (!arRes.data.err) {
        setAccountRequests(arRes.data.requests);
        setLoading(false);    
      } else {
        throw (new Error(arRes.data.errMsg));
      }
    } catch (e) {
      setLoading(false);
      handleGlobalError(e);
    }
  }, [setAccountRequests, setLoading, handleGlobalError]);

  /**
   * Set the page title and gather data from server on first load.
   */
  useEffect(() => {
    document.title = 'LibreText Conductor | Account Requests';
    getAccountRequests();
  }, [getAccountRequests]);

  /**
   * Accepts a standard ISO 8601 Date or date-string and parses the date and time
   * to a UI-ready, human-readable format.
   *
   * @param {Date|string} dateInput - Date to parse and format. 
   * @returns {string} The formatted date. 
   */
  function parseDateAndTime(dateInput) {
    const dateInstance = new Date(dateInput);
    const dateString = date.format(dateInstance, 'MM/DD/YYYY h:mm A');
    return dateString;
  }

  /**
   * Saves the selected Account Request to state and opens the View Account Request tool.
   *
   * @param {object} request - Account Request data.
   */
  function handleOpenRequestView(request) {
    setCurrentRequest(request);
    setShowViewModal(true);
  }

  /**
   * Closes the View Account Request tool.
   */
  function handleViewModalClose() {
    setShowViewModal(false);
    setCurrentRequest(null);
  }

  /**
   * Refreshes the list of Account Requests when a child component indicates
   * the server's data may have changed.
   */
  function handleDataChangeNotification() {
    getAccountRequests();
  }

  return (
    <Grid className="controlpanel-container" divided="vertically">
      <Grid.Row>
        <Grid.Column width={16}>
          <Header className="component-header" as="h2">Account Requests</Header>
        </Grid.Column>
      </Grid.Row>
      <Grid.Row>
        <Grid.Column width={16}>
          <Segment.Group>
            <Segment>
              <Breadcrumb>
                <Breadcrumb.Section as={Link} to="/controlpanel">Control Panel</Breadcrumb.Section>
                <Breadcrumb.Divider icon="right chevron" />
                <Breadcrumb.Section active>Account Requests</Breadcrumb.Section>
              </Breadcrumb>
            </Segment>
            {loading && (
              <Segment>
                <Loader active inline="centered" />
              </Segment>
            )}
            <Segment>
              <Table striped celled definition>
                <Table.Header>
                  <Table.Row>
                    <Table.HeaderCell />
                    {TABLE_COLS.map((item) => (
                      <Table.HeaderCell key={item.key}>
                        <span>{item.text}</span>
                      </Table.HeaderCell>
                    ))}
                  </Table.Row>
                </Table.Header>
                <Table.Body>
                  {(accountRequests.length > 0) && (
                    accountRequests.map((item) => {
                      let completedRow = false;
                      if (item.status === 'completed') {
                        completedRow = true;
                      }
                      return (
                        <Table.Row key={item._id} className="word-break-all">
                          <Table.Cell textAlign="center">
                            {completedRow && (
                              <Icon
                                name="checkmark"
                                color="green"
                                size="large"
                                className="float-right"
                              />
                            )}
                          </Table.Cell>
                          <Table.Cell>
                            <span className="text-link" onClick={() => handleOpenRequestView(item)}>
                              {item.hasOwnProperty('createdAt')
                                ? parseDateAndTime(item.createdAt)
                                : <em>Unknown</em>
                              }
                            </span>
                          </Table.Cell>
                          <Table.Cell disabled={completedRow}>
                            <span>{getPurposeText(item.purpose, true)}</span>
                          </Table.Cell>
                          <Table.Cell disabled={completedRow}>
                            <span>{item.email}</span>
                          </Table.Cell>
                          <Table.Cell disabled={completedRow}>
                            <span>{item.name}</span>
                          </Table.Cell>
                          <Table.Cell disabled={completedRow}>
                            <span>{item.institution}</span>
                          </Table.Cell>
                          <Table.Cell disabled={completedRow}>
                            {item.hasOwnProperty('moreInfo')
                              ? (item.moreInfo
                                  ? <span><strong>Yes</strong></span>
                                  : <span>No</span>
                                )
                              : <span><em>Unspecified</em></span>
                            }
                          </Table.Cell>
                        </Table.Row>
                      );
                    })
                  )}
                  {(accountRequests.length === 0) && (
                    <Table.Row>
                      <Table.Cell colSpan={TABLE_COLS.length + 1}>
                        <p className="text-center"><em>No results found.</em></p>
                      </Table.Cell>
                    </Table.Row>
                  )}
                </Table.Body>
              </Table>
            </Segment>
          </Segment.Group>
          <ViewAccountRequest
            show={showViewModal}
            onClose={handleViewModalClose}
            request={currentRequest}
            onDataChange={handleDataChangeNotification}
          />
        </Grid.Column>
      </Grid.Row>
    </Grid>
  );
};

export default AccountRequests;
