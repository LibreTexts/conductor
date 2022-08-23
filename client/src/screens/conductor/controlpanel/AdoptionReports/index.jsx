import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Grid,
  Header,
  Image,
  Segment,
  Form,
  Table,
  Dropdown,
  Breadcrumb
} from 'semantic-ui-react';
import axios from 'axios';
import date from 'date-and-time';
import ordinal from 'date-and-time/plugin/ordinal';
import AdoptionReportView from '../../../../components/AdoptionReportView';
import ConductorDateInput from '../../../../components/util/ConductorDateInput';
import {
  isEmptyString,
  truncateString,
  capitalizeFirstLetter,
} from '../../../../components/util/HelperFunctions';
import {
  getLibGlyphURL,
  getLibraryName
} from '../../../../components/util/LibraryOptions';
import useGlobalError from '../../../../components/error/ErrorHooks';
import 'react-day-picker/lib/style.css';

/**
 * The Adoption Reports interface allows administrators to view LibreText Adoption Reports
 * submitted to Conductor.
 */
const AdoptionReports = () => {

  const SORT_OPTIONS = [
    { key: 'date', text: 'Date', value: 'date' },
    { key: 'type', text: 'Report Type', value: 'type' },
    { key: 'resname', text: 'Resource Name', value: 'resname' },
    { key: 'reslib', text: 'Resource Library', value: 'reslib' },
    { key: 'institution', text: 'Institution', value: 'institution' },
  ];

  const TABLE_COLS = [
    { key: 'date', text: 'Date' },
    { key: 'type', text: 'Report Type' },
    { key: 'resname', text: 'Resource Name' },
    { key: 'reslib', text: 'Resource Library' },
    { key: 'institution', text: 'Institution' },
    { key: 'comments', text: 'Comments' },
    { key: 'name', text: 'Name' },
  ];

  const { handleGlobalError } = useGlobalError();

  // Date
  const [adoptionReports, setAdoptionReports] = useState([]);
  const [sortedReports, setSortedReports] = useState([]);
  const [currentReport, setCurrentReport] = useState(null);

  // UI
  const [fromDate, setFromDate] = useState(null);
  const [toDate, setToDate] = useState(null);
  const [showARVModal, setShowARVModal] = useState(false);
  const [sortChoice, setSortChoice] = useState('date');

  /**
   * Set page title, initialize plugins, and set defaults on load.
   */
  useEffect(() => {
    document.title = 'LibreTexts Conductor | Adoption Reports';
    date.plugin(ordinal);
    const now = new Date();
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(now.getFullYear() - 1);
    setFromDate(oneYearAgo);
    setToDate(now);
  }, [setFromDate, setToDate]);

  /**
   * Retrieves Report search results from the server and saves them to state.
   *
   * @param {string} fromDateString - The date to start the search from, in format 'MM-DD-YYYY'.
   * @param {string} toDateString - The date to end the search on, in format 'MM-DD-YYYY'.
   */
  const getAdoptionReports = useCallback(async (fromDateString, toDateString) => {
    try {
      const arRes = await axios.get('/adoptionreports', {
        params: {
          startDate: fromDateString,
          endDate: toDateString,
        },
      });
      if (!arRes.data.err) {
        setAdoptionReports(arRes.data.reports);
        setSortedReports(arRes.data.reports);
      } else {
        throw (new Error(arRes.data.errMsg));
      }
    } catch (e) {
      handleGlobalError(e);
    }
  }, [setAdoptionReports, setSortedReports, handleGlobalError]);

  /**
   * Parses newly-selected search dates and triggers the retrieval from the server.
   */
  useEffect(() => {
    if (fromDate !== null && toDate !== null) {
      const fdMonth = fromDate.getMonth() + 1;
      const fdDate = fromDate.getDate();
      const fdYear = fromDate.getFullYear();
      const tdMonth = toDate.getMonth() + 1;
      const tdDate = toDate.getDate();
      const tdYear = toDate.getFullYear();
      const fdString = `${fdMonth}-${fdDate}-${fdYear}`;
      const tdString = `${tdMonth}-${tdDate}-${tdYear}`;
      getAdoptionReports(fdString, tdString);
    }
  }, [fromDate, toDate, getAdoptionReports, handleGlobalError]);

  /**
   * Sorts the Reports by selected choice and saves them to state.
   */
  useEffect(() => {
    let sorted = [];
    switch (sortChoice) {
      case 'type':
        sorted = [...adoptionReports].sort((a, b) => a.role.localeCompare(b.role));
        break;
      case 'institution':
        sorted = [...adoptionReports].sort((a, b) => {
          let aInst = '';
          let bInst = '';
          if (a.role === 'instructor') {
            aInst = a.instructor.institution;
          } else if (a.role === 'student' && !isEmptyString(a.student.institution)) {
            aInst = a.student.institution;
          }
          if (b.role === 'instructor') {
            bInst = b.instructor.institution;
          } else if (b.role === 'student' && !isEmptyString(b.student.institution)) {
            bInst = b.student.institution
          }
          return aInst.localeCompare(bInst);
        });
        break;
      case 'resname':
        sorted = [...adoptionReports].sort((a, b) => {
          if (a.resource?.title && b.resource?.title) {
            return a.resource.title.localeCompare(b.resource.title);
          }
          return 0;
        });
        break;
      case 'reslib':
        sorted = [...adoptionReports].sort((a, b) => {
          if (a.resource?.library && b.resource?.library) {
            return a.resource.library.localeCompare(b.resource.library);
          }
          return 0;
        });
        break;
      default: // date
        sorted = [...adoptionReports].sort((a, b) => {
          const aDate = new Date(a.createdAt);
          const bDate = new Date(b.createdAt);
          if (aDate < bDate) {
            return -1;
          }
          if (aDate > bDate) {
            return 1;
          }
          return 0;
        });
    }
    setSortedReports(sorted);
  }, [sortChoice, adoptionReports, setSortedReports]);

  /**
   * Parses a date string into UI-ready format.
   *
   * @param {string} dateInput - ISO date representation. 
   * @returns {string} The parsed and formatted date.
   */
  function parseDateAndTime(dateInput) {
    const dateInstance = new Date(dateInput);
    return date.format(dateInstance, 'MM/DD/YYYY h:mm A');
  }

  /**
   * Opens the Adoption Report View modal by bringing the selected Report into state.
   *
   * @param {string} id - The internal Report identifier. 
   */
  function handleOpenARV(id) {
    const foundReport = adoptionReports.find((ar) => ar._id === id);
    if (foundReport) {
      setShowARVModal(true);
      setCurrentReport(foundReport);
    }
  }

  /**
   * Closes the Adoption Report View modal and resets its state.
   */
  function handleCloseARV() {
    setShowARVModal(false);
    setCurrentReport(null);
  }

  /**
   * Updates the search From Date in state.
   *
   * @param {Date} value - The newly selected date. 
   */
  function handleFromDateChange(value) {
    setFromDate(value);
  }

  /**
   * Updates the search To Date in state.
   *
   * @param {Date} value - The newly selected date.
   */
  function handleToDateChange(value) {
    setToDate(value);
  }

  /**
   * Updates the report sorting choice in state.
   *
   * @param {React.ChangeEvent} e - The event that triggered the handler.
   * @param {object} data - Data passed from the UI element.
   * @param {string} data.value - The internal sort choice key.
   */
  function handleSortChoiceChange(_e, { value }) {
    setSortChoice(value);
  }

  return (
    <Grid className="controlpanel-container" divided="vertically">
      <Grid.Row>
        <Grid.Column width={16}>
          <Header className="component-header" as="h2">Adoption Reports</Header>
        </Grid.Column>
      </Grid.Row>
      <Grid.Row>
        <Grid.Column width={16}>
          <Segment.Group>
            <Segment>
              <Breadcrumb>
                <Breadcrumb.Section as={Link} to="/controlpanel">Control Panel</Breadcrumb.Section>
                <Breadcrumb.Divider icon="right chevron" />
                <Breadcrumb.Section active>Adoption Reports</Breadcrumb.Section>
              </Breadcrumb>
            </Segment>
            <Segment>
              <div className="flex-row-div">
                <ConductorDateInput
                  value={fromDate}
                  onChange={handleFromDateChange}
                  label="From"
                  inlineLabel={true}
                  className="mr-2p"
                />
                <ConductorDateInput
                  value={toDate}
                  onChange={handleToDateChange}
                  label="To"
                  inlineLabel={true}
                  className="mr-2p"
                />
                <Form>
                  <Form.Field inline>
                    <label htmlFor="sort-reports">Sort by</label>
                    <Dropdown
                      placeholder="Sort by..."
                      floating
                      selection
                      button
                      options={SORT_OPTIONS}
                      onChange={handleSortChoiceChange}
                      value={sortChoice}
                    />
                  </Form.Field>
                </Form>
              </div>
            </Segment>
            <Segment>
              <Table striped celled fixed>
                <Table.Header>
                  <Table.Row>
                    {TABLE_COLS.map((item) => {
                      const text = sortChoice === item.key ? <em>{item.text}</em> : item.text;
                      return (
                        <Table.HeaderCell key={item.key}>
                          <span>{text}</span>
                        </Table.HeaderCell>
                      );
                    })}
                  </Table.Row>
                </Table.Header>
                <Table.Body>
                  {(adoptionReports.length > 0) ? sortedReports.map((item) => {
                    let resourceTitle = <em>Unknown</em>;
                    let resourceLib = 'unknown';
                    let institution = <em>Unknown</em>;
                    if (item.resource?.title) {
                      resourceTitle = item.resource.title;
                    }
                    if (item.resource?.library) {
                      resourceLib = item.resource.library;
                    }
                    if (item.role === 'instructor') {
                      if (item.instructor?.institution) {
                        institution = item.instructor.institution;
                      }
                    } else if (item.role === 'student') {
                      if (item.student?.institution) {
                        institution = item.student.institution;
                      }
                    }
                    return (
                      <Table.Row key={item._id}>
                        <Table.Cell>
                          <span className="text-link" onClick={() => handleOpenARV(item._id)}>
                            {parseDateAndTime(item.createdAt)}
                          </span>
                        </Table.Cell>
                        <Table.Cell>
                          <span>{capitalizeFirstLetter(item.role)}</span>
                        </Table.Cell>
                        <Table.Cell>
                          <span>{resourceTitle}</span>
                        </Table.Cell>
                        <Table.Cell>
                          {resourceLib !== 'unknown' ? (
                            <div>
                              <Image src={getLibGlyphURL(resourceLib)} className="library-glyph" />
                              <span>{getLibraryName(resourceLib)}</span>
                            </div>
                          ) : (
                            <span><em>Unknown</em></span>
                          )}
                        </Table.Cell>
                        <Table.Cell>
                          <span>{institution}</span>
                        </Table.Cell>
                        <Table.Cell>
                          <span><em>{truncateString(item.comments, 150)}</em></span>
                        </Table.Cell>
                        <Table.Cell>
                          <span>{item.name}</span>
                        </Table.Cell>
                      </Table.Row>
                    )
                  }) : (
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
          <AdoptionReportView
            show={showARVModal}
            onClose={handleCloseARV}
            report={currentReport}
          />
        </Grid.Column>
      </Grid.Row>
    </Grid>
  );
};

export default AdoptionReports;
