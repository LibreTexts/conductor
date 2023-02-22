import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import {
  Breadcrumb,
  Grid,
  Header,
  Loader,
  Segment,
  Table,
} from 'semantic-ui-react';
import date from 'date-and-time';
import ViewAnalyticsRequest from '../../../../components/analytics/ViewAnalyticsRequest';
import useGlobalError from '../../../../components/error/ErrorHooks';

/**
 * The Analytics Requests interface allows administrators to view Analytics Access Requests
 * submitted via Conductor Analytics.
 */
const AnalyticsRequests = () => {

  const TABLE_COLS = [
    { key: 'date', text: 'Date' },
    { key: 'name', text: 'Name' },
    { key: 'course', text: 'Course' },
    { key: 'libretext', text: 'LibreText Identifier' },
  ];

  // Global error handling
  const { handleGlobalError } = useGlobalError();

  // UI
  const [loading, setLoading] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);

  // Data
  const [analyticsRequests, setAnalyticsRequests] = useState([]);
  const [currentRequest, setCurrentRequest] = useState(null);

  /**
   * Loads Analytics Requests from the server and saves them to state.
   */
  const getAnalyticsRequests = useCallback(async () => {
    try {
      setLoading(true);
      const arRes = await axios.get('/analytics/accessrequests');
      if (!arRes.data.err) {
        setAnalyticsRequests(arRes.data.requests);
        setLoading(false);    
      } else {
        throw (new Error(arRes.data.errMsg));
      }
    } catch (e) {
      setLoading(false);
      handleGlobalError(e);
    }
  }, [setAnalyticsRequests, setLoading, handleGlobalError]);

  /**
   * Set the page title and gather data from server on first load.
   */
  useEffect(() => {
    document.title = 'LibreText Conductor | Analytics Requests';
    getAnalyticsRequests();
  }, [getAnalyticsRequests]);

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
   * Saves the selected Analytics Request to state and opens the View Analytics Request tool.
   *
   * @param {object} request - Analytics Request data.
   */
  function handleOpenRequestView(request) {
    setCurrentRequest(request);
    setShowViewModal(true);
  }

  /**
   * Closes the View Analytics Request tool.
   */
  function handleViewModalClose() {
    setShowViewModal(false);
    setCurrentRequest(null);
  }

  /**
   * Refreshes the list of Analytics Requests when a child component indicates
   * the server's data may have changed.
   */
  function handleDataChangeNotification() {
    getAnalyticsRequests();
  }

  return (
    <Grid className="controlpanel-container" divided="vertically">
      <Grid.Row>
        <Grid.Column width={16}>
          <Header className="component-header" as="h2">Analytics Requests</Header>
        </Grid.Column>
      </Grid.Row>
      <Grid.Row>
        <Grid.Column width={16}>
          <Segment.Group>
            <Segment>
              <Breadcrumb>
                <Breadcrumb.Section as={Link} to="/controlpanel">Control Panel</Breadcrumb.Section>
                <Breadcrumb.Divider icon="right chevron" />
                <Breadcrumb.Section active>Analytics Requests</Breadcrumb.Section>
              </Breadcrumb>
            </Segment>
            {loading && (
              <Segment>
                <Loader active inline="centered" />
              </Segment>
            )}
            <Segment>
              <Table striped celled>
                <Table.Header>
                  <Table.Row>
                    {TABLE_COLS.map((item) => (
                      <Table.HeaderCell key={item.key}>
                        <span>{item.text}</span>
                      </Table.HeaderCell>
                    ))}
                  </Table.Row>
                </Table.Header>
                <Table.Body>
                  {(analyticsRequests.length > 0) && (
                    analyticsRequests.map((item) => {
                      return (
                        <Table.Row key={item._id} className="word-break-all">
                          <Table.Cell>
                            <span className="text-link" onClick={() => handleOpenRequestView(item)}>
                              {item.hasOwnProperty('createdAt')
                                ? parseDateAndTime(item.createdAt)
                                : <em>Unknown</em>
                              }
                            </span>
                          </Table.Cell>
                          <Table.Cell>
                            <span>{item.requester?.firstName} {item.requester?.lastName}</span>
                          </Table.Cell>
                          <Table.Cell>
                            <span>{item.course?.title}</span>
                          </Table.Cell>
                          <Table.Cell>
                            {item.course?.pendingTextbookID ? (
                              <a
                                href={`https://go.libretexts.org/${item.course.pendingTextbookID}`}
                                rel="noreferrer"
                                target="_blank"
                              >
                                {item.course.pendingTextbookID}
                              </a>
                            ) : (
                              <span>Unknown</span>
                            )}
                          </Table.Cell>
                        </Table.Row>
                      );
                    })
                  )}
                  {(analyticsRequests.length === 0) && (
                    <Table.Row>
                      <Table.Cell colSpan={TABLE_COLS.length}>
                        <p className="text-center"><em>No results found.</em></p>
                      </Table.Cell>
                    </Table.Row>
                  )}
                </Table.Body>
              </Table>
            </Segment>
          </Segment.Group>
          <ViewAnalyticsRequest
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

export default AnalyticsRequests;
