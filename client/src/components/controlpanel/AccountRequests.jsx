import './ControlPanel.css';

import {
  Grid,
  Header,
  Image,
  Segment,
  Table,
  Modal,
  Button,
  Breadcrumb,
  Loader,
  Icon
} from 'semantic-ui-react';
import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import date from 'date-and-time';
import ordinal from 'date-and-time/plugin/ordinal';

import {
    isEmptyString,
    truncateString,
    normalizeURL
} from '../util/HelperFunctions.js';
import {
    getLibGlyphURL,
    getLibraryName
} from '../util/LibraryOptions.js';
import { getPurposeText } from '../util/AccountRequestOptions.js';
import useGlobalError from '../error/ErrorHooks.js';

const AccountRequests = () => {

    // Global Error Handling
    const { handleGlobalError } = useGlobalError();

    // Data
    const [accountRequests, setAccountRequests] = useState([]);
    const [currentRequest, setCurrentRequest] = useState({});

    // UI
    const [loadingData, setLoadingData] = useState(false);
    const [showARVModal, setShowARVModal] = useState(false);
    const [showCCModal, setShowCCModal] = useState(false);
    const [showCDModal, setShowCDModal] = useState(false);

    const getAccountRequests = useCallback(() => {
        setLoadingData(true);
        axios.get('/accountrequests').then((res) => {
            if (!res.data.err) {
                setAccountRequests(res.data.requests);
            } else handleGlobalError(res.data.errMsg);
            setLoadingData(false);
        }).catch((err) => {
            handleGlobalError(err);
            setLoadingData(false);
        });
    }, [setAccountRequests, handleGlobalError]);

    useEffect(() => {
        document.title = "LibreTexts Conductor | Account Requests";
        date.plugin(ordinal);
        getAccountRequests();
    }, [getAccountRequests]);

    /**
     * Accepts a standard ISO 8601 date or date-string
     * and parses the date and time to human-readable format.
     * @param {String|Date} dateInput - the date to parse
     * @returns {String} the formatted date string representation
     */
    const parseDateAndTime = (dateInput) => {
        const dateInstance = new Date(dateInput);
        const dateString = date.format(dateInstance, 'MM/DD/YYYY h:mm A');
        return dateString;
    };

    /**
     * Opens the Account Request View Modal with the selected request.
     * @param {Number} idx - the index of the request to open
     */
    const openARVModal = (idx) => {
        if (accountRequests[idx] !== undefined) {
            setShowARVModal(true);
            setCurrentRequest(accountRequests[idx]);
        }
    };

    /**
     * Closes the Account Request View Modal and resets its state.
     */
    const closeARVModal = () => {
        setShowARVModal(false);
        setShowCCModal(false); // ensure Confirm Complete modal is closed
        setShowCDModal(false); // ensure Confirm Delete modal is closed
        setCurrentRequest({});
    };

    /**
     * Submits a PUT request to the server to mark the currently
     * open request as complete.
     */
    const submitComplete = () => {
        if (typeof(currentRequest._id) === 'string' && !isEmptyString(currentRequest._id)) {
            setLoadingData(true);
            axios.put('/accountrequest/complete', {
                requestID: currentRequest._id
            }).then((res) => {
                if (!res.data.err) {
                    closeARVModal();
                    getAccountRequests();
                } else handleGlobalError(res.data.errMsg);
                setLoadingData(false);
            }).catch((err) => {
                handleGlobalError(err);
                setLoadingData(false);
            });
        }
    };

    /**
     * Submits a PUT request to the server to mark the currently
     * open request as complete.
     */
    const submitDelete = () => {
        if (typeof(currentRequest._id) === 'string' && !isEmptyString(currentRequest._id)) {
            axios.delete('/accountrequest', {
                data: {
                    requestID: currentRequest._id
                }
            }).then((res) => {
                if (!res.data.err) {
                    closeARVModal();
                    getAccountRequests();
                } else handleGlobalError(res.data.errMsg);
                setLoadingData(false);
            }).catch((err) => {
                handleGlobalError(err);
                setLoadingData(false);
            });
        }
    };

    return (
        <Grid className='controlpanel-container' divided='vertically'>
            <Grid.Row>
                <Grid.Column width={16}>
                    <Header className='component-header'>Account Requests</Header>
                </Grid.Column>
            </Grid.Row>
            <Grid.Row>
                <Grid.Column width={16}>
                    <Segment.Group>
                        <Segment>
                            <Breadcrumb>
                                <Breadcrumb.Section as={Link} to='/controlpanel'>
                                    Control Panel
                                </Breadcrumb.Section>
                                <Breadcrumb.Divider icon='right chevron' />
                                <Breadcrumb.Section active>
                                    Account Requests
                                </Breadcrumb.Section>
                            </Breadcrumb>
                        </Segment>
                        {loadingData &&
                            <Segment>
                                <Loader active inline='centered' />
                            </Segment>
                        }
                        <Segment>
                            <Table striped celled definition>
                                <Table.Header>
                                    <Table.Row>
                                        <Table.HeaderCell/>
                                        <Table.HeaderCell><span>Date</span></Table.HeaderCell>
                                        <Table.HeaderCell><span>Name</span></Table.HeaderCell>
                                        <Table.HeaderCell><span>Institution</span></Table.HeaderCell>
                                        <Table.HeaderCell><span>Requests LibreNet Info</span></Table.HeaderCell>
                                    </Table.Row>
                                </Table.Header>
                                <Table.Body>
                                    {(accountRequests.length > 0) &&
                                        accountRequests.map((item, idx) => {
                                            let completedRow = false;
                                            if (item.status === 'completed') completedRow = true;
                                            return (
                                                <Table.Row key={idx}>
                                                    <Table.Cell textAlign='center'>
                                                        {completedRow && <Icon name='checkmark' color='green' size='large' className='float-right' />}
                                                    </Table.Cell>
                                                    <Table.Cell>
                                                        <span className='text-link' onClick={() => { openARVModal(idx) }}>
                                                            {item.hasOwnProperty('createdAt')
                                                                ? parseDateAndTime(item.createdAt)
                                                                : <span><em>Unknown</em></span>
                                                            }
                                                        </span>
                                                    </Table.Cell>
                                                    <Table.Cell disabled={completedRow}>
                                                        <span>{item.name}</span>
                                                    </Table.Cell>
                                                    <Table.Cell disabled={completedRow}>
                                                        <span>{item.institution}</span>
                                                    </Table.Cell>
                                                    <Table.Cell disabled={completedRow}>
                                                        {item.hasOwnProperty('moreInfo')
                                                            ? (item.moreInfo === true
                                                                ? <span><strong>Yes</strong></span>
                                                                : <span>No</span>
                                                            )
                                                            : <span><em>Unspecified</em></span>
                                                        }
                                                    </Table.Cell>
                                                </Table.Row>
                                            )
                                        })
                                    }
                                    {(accountRequests.length === 0) &&
                                        <Table.Row>
                                            <Table.Cell colSpan={4}>
                                                <p className='text-center'><em>No results found.</em></p>
                                            </Table.Cell>
                                        </Table.Row>
                                    }
                                </Table.Body>
                            </Table>
                        </Segment>
                    </Segment.Group>
                    {/* Account Request View Modal */}
                    <Modal
                        onClose={closeARVModal}
                        open={showARVModal}
                    >
                        <Modal.Header>View Account Request</Modal.Header>
                        <Modal.Content scrolling>
                            <Grid divided='vertically'>
                                <Grid.Row columns={3}>
                                    <Grid.Column>
                                        <Header sub>Email</Header>
                                        <p>{currentRequest.email}</p>
                                    </Grid.Column>
                                    <Grid.Column>
                                        <Header sub>Name</Header>
                                        <p>{currentRequest.name}</p>
                                    </Grid.Column>
                                    <Grid.Column>
                                        <Header sub>Purpose</Header>
                                        <p>{getPurposeText(currentRequest.purpose)}</p>
                                    </Grid.Column>
                                </Grid.Row>
                                <Grid.Row columns={3}>
                                    <Grid.Column>
                                        <Header sub>Institution</Header>
                                        <p>{currentRequest.institution}</p>
                                    </Grid.Column>
                                    <Grid.Column>
                                        <Header sub>Verification URL</Header>
                                        <a href={normalizeURL(currentRequest.facultyURL)} target='_blank' rel='noopener noreferrer'>{truncateString(currentRequest.facultyURL, 75)}</a>
                                    </Grid.Column>
                                    <Grid.Column>
                                        <Header sub>Requests LibreNet Info</Header>
                                        {currentRequest.hasOwnProperty('moreInfo')
                                            ? (currentRequest.moreInfo === true
                                                ? <p><strong>Yes</strong></p>
                                                : <p>No</p>
                                            )
                                            : (<p><em>Unspecified</em></p>)
                                        }
                                    </Grid.Column>
                                </Grid.Row>
                                {currentRequest.purpose === 'oer' &&
                                    <Grid.Row columns={1}>
                                        <Grid.Column>
                                            <Header sub>Libraries Requested</Header>
                                            <ul>
                                                {Array.isArray(currentRequest.libraries) &&
                                                    currentRequest.libraries.map((item, idx) => {
                                                        return <li key={idx}><Image src={getLibGlyphURL(item)} className='library-glyph' /><span>{getLibraryName(item)}</span></li>
                                                    })
                                                }
                                            </ul>
                                        </Grid.Column>
                                    </Grid.Row>
                                }
                            </Grid>
                        </Modal.Content>
                        <Modal.Actions>
                            <div className='flex-row-div'>
                                <div className='ui left-flex'>
                                    <Button
                                        color='red'
                                        loading={loadingData}
                                        onClick={() => setShowCDModal(true)}
                                    >
                                        <Icon name='trash' />
                                        Delete
                                    </Button>
                                </div>
                                <div className='ui center-flex'>
                                    <Button
                                        color='green'
                                        loading={loadingData}
                                        onClick={() => setShowCCModal(true)}
                                    >
                                        <Icon name='check' />
                                        Mark Complete
                                    </Button>
                                </div>
                                <div className='ui right-flex'>
                                    <Button
                                        color='blue'
                                        loading={loadingData}
                                        onClick={closeARVModal}
                                    >
                                        Done
                                    </Button>
                                </div>
                            </div>
                        </Modal.Actions>
                    </Modal>
                    {/* Confirm Mark Request Completed Modal */}
                    <Modal
                        onClose={() => setShowCCModal(false)}
                        open={showCCModal}
                    >
                        <Modal.Header>Confirm</Modal.Header>
                        <Modal.Content>
                            <p>Are you sure you want to mark this request as complete?</p>
                        </Modal.Content>
                        <Modal.Actions>
                            <Button
                                onClick={() => setShowCCModal(false)}
                            >
                                Cancel
                            </Button>
                            <Button
                                color='green'
                                loading={loadingData}
                                onClick={submitComplete}
                            >
                                <Icon name='check' />
                                Confirm
                            </Button>
                        </Modal.Actions>
                    </Modal>
                    {/* Confirm Delete Request Modal */}
                    <Modal
                        onClose={() => setShowCDModal(false)}
                        open={showCDModal}
                    >
                        <Modal.Header>Confirm</Modal.Header>
                        <Modal.Content>
                            <p>Are you sure you want to delete this request? <strong>This action cannot be undone.</strong></p>
                        </Modal.Content>
                        <Modal.Actions>
                            <Button
                                onClick={() => setShowCDModal(false)}
                            >
                                Cancel
                            </Button>
                            <Button
                                color='red'
                                loading={loadingData}
                                onClick={submitDelete}
                            >
                                <Icon name='trash' />
                                Delete Request
                            </Button>
                        </Modal.Actions>
                    </Modal>
                </Grid.Column>
            </Grid.Row>
        </Grid>
    )

}

export default AccountRequests;
