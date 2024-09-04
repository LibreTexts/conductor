import './ControlPanel.css';

import {
  Grid,
  Header,
  Image,
  Segment,
  Form,
  Table,
  Modal,
  Button,
  Dropdown,
  Breadcrumb,
  Icon,
  Checkbox,
  FormInput,
  TextArea
} from 'semantic-ui-react';
import React, { useEffect, useState, forwardRef, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import axios from 'axios';
import date from 'date-and-time';
import ordinal from 'date-and-time/plugin/ordinal';

import DateInput from '../DateInput/index.tsx';

import {
    isEmptyString,
    normalizeURL,
    capitalizeFirstLetter
} from '../util/HelperFunctions.js';
import {
    getLibGlyphURL,
    getLibraryName
} from '../util/LibraryOptions.js';
import { getLicenseText } from '../util/LicenseOptions.js';
import {
    getTextUse
} from '../util/HarvestingMasterOptions.js';
import useGlobalError from '../error/ErrorHooks';

const HarvestingRequests = (props) => {

    // Global State and Error
    const { handleGlobalError } = useGlobalError();
    const user = useSelector((state) => state.user);


    const emptyRequest = {
        email: '',
        title: '',
        library: '',
        url: '',
        license: '',
        name: '',
        institution: '',
        resourceUse: '',
        dateIntegrate: '',
        comments: '',
    };

    // Data
    const [harvestingRequests, setHarvestingRequests] = useState([]);
    const [sortedRequests, setSortedRequests] = useState([]);
    const [currentRequest, setCurrentRequest] = useState(emptyRequest);

    // UI
    const [fromDate, setFromDate] = useState(new Date('01/01/2021'));
    const [toDate, setToDate] = useState(new Date());
    const [showHRVModal, setShowHRVModal] = useState(false);
    const [sortChoice, setSortChoice] = useState('date');
    const [includeDeclined, setIncludeDeclined] = useState(false);

    // Confirm Deletion Modal
    const [showDelModal, setShowDelModal] = useState(false);
    const [delRequestLoading, setDelRequestLoading] = useState(false);

    // Confirm Decline Modal
    const [showDeclineModal, setShowDeclineModal] = useState(false);
    const [declineRequestLoading, setDeclineRequestLoading] = useState(false);
    const [declineReason, setDeclineReason] = useState('');

    // Convert Project Modal
    const [showConvertModal, setShowConvertModal] = useState(false);
    const [convertLoading, setConvertLoading] = useState(false);


    const sortOptions = [
        { key: 'date', text: 'Date', value: 'date' },
        { key: 'reqdate', text: 'Requested Harvest Date', value: 'reqdate' },
        { key: 'resname', text: 'Resource Title', value: 'resname' },
        { key: 'reslib', text: 'Resource Library', value: 'reslib' },
        { key: 'license', text: 'License', value: 'license' },
        { key: 'institution', text: 'Institution', value: 'institution' },
        { key: 'status', text: 'Status', value: 'status'}
    ];

    useEffect(() => {
        document.title = "LibreTexts Conductor | Harvesting Requests";
        date.plugin(ordinal);
    }, []);


    const getHarvestingRequests = useCallback(() => {
        const fromDateString = `${fromDate.getMonth()+1}-${fromDate.getDate()}-${fromDate.getFullYear()}`;
        const toDateString = `${toDate.getMonth()+1}-${toDate.getDate()}-${toDate.getFullYear()}`;
        axios.get('/harvestingrequests', {
            params: {
                startDate: fromDateString,
                endDate: toDateString,
                includeDeclined: includeDeclined
            }
        }).then((res) => {
            if (!res.data.err) {
                setHarvestingRequests(res.data.requests);
                setSortedRequests(res.data.requests);
            } else {
                handleGlobalError(res.data.errMsg);
            }
        }).catch((err) => {
            handleGlobalError(err);
        });
    }, [fromDate, toDate, includeDeclined, handleGlobalError]);

    /**
     * Get request whenever search params change
     */
    useEffect(() => {
        if (fromDate !== null && toDate !== null) {
            getHarvestingRequests();
        }
    }, [fromDate, toDate, includeDeclined, getHarvestingRequests])

    useEffect(() => {
        var sorted = [];
        switch(sortChoice) {
            case 'date':
                sorted = [...harvestingRequests].sort((a, b) => {
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
                break;
            case 'reqdate':
                sorted = [...harvestingRequests].sort((a, b) => {
                    if ((a.dateIntegrate !== null) && (b.dateIntegrate !== null)) {
                        if (a.dateIntegrate < b.dateIntegrate) {
                            return -1;
                        }
                        if (a.dateIntegrate > b.dateIntegrate) {
                            return 1;
                        }
                    } else if ((a.dateIntegrate === null) && (b.dateIntegrate !== null)) {
                        return 1;
                    } else if ((a.dateIntegrate !== null) && (b.dateIntegrate === null)) {
                        return -1;
                    }
                    return 0;
                });
                break;
            case 'resname':
                sorted = [...harvestingRequests].sort((a, b) => {
                    if (a.title < b.title) {
                        return -1;
                    }
                    if (a.title > b.title) {
                        return 1;
                    }
                    return 0;
                });
                break;
            case 'reslib':
                sorted = [...harvestingRequests].sort((a, b) => {
                    if (a.library < b.library) {
                        return -1;
                    }
                    if (a.library > b.library) {
                        return 1;
                    }
                    return 0;
                });
                break;
            case 'institution':
                sorted = [...harvestingRequests].sort((a, b) => {
                    if (a.institution < b.institution) {
                        return -1;
                    }
                    if (a.institution > b.institution) {
                        return 1;
                    }
                    return 0;
                });
                break;
            case 'license':
                sorted = [...harvestingRequests].sort((a, b) => {
                    if (typeof a.license === 'string' && typeof b.license === 'string') {
                        if (a.license < b.license) {
                            return -1;
                        }
                        if (a.license > b.license) {
                            return 1;
                        }
                        return 0;
                    } else if (typeof a.license === 'object' && typeof b.license === 'object') {
                        if (a.license.name < b.license.name) {
                            return -1;
                        }
                        if (a.license.name > b.license.name) {
                            return 1;
                        }
                        return 0;
                    } else {
                        return 0;
                    }
                });
                break;
            case 'status':
                sorted = [...harvestingRequests].sort((a, b) => {
                    if (a.status < b.status) {
                        return -1;
                    }
                    if (a.status > b.status) {
                        return 1;
                    }
                    return 0;
                });
                break;
            default:
                break; // Silence React Warning
        }
        setSortedRequests(sorted);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [sortChoice])

    const parseDate = (dateInput) => {
        if (dateInput !== null) {
            const dateInstance = new Date(dateInput);
            const dateString = date.format(dateInstance, 'MM/DD/YYYY');
            return dateString;
        } else {
            return '';
        }
    }

    const parseDateAndTime = (dateInput) => {
        const dateInstance = new Date(dateInput);
        const dateString = date.format(dateInstance, 'MM/DD/YYYY h:mm A');
        return dateString;
    };

    const openHRVModal = (idx) => {
        if (harvestingRequests[idx] !== undefined) {
            setShowHRVModal(true);
            setCurrentRequest(harvestingRequests[idx]);
        }
    };

    const closeHRVModal = () => {
        setShowHRVModal(false);
        setCurrentRequest(emptyRequest);
    };

    const openDeleteModal = () => {
        setDelRequestLoading(false);
        setShowDelModal(true);
    };

    const closeDeleteModal = () => {
        setDelRequestLoading(false);
        setShowDelModal(false);
    };

    const submitDeleteRequest = () => {
        if (currentRequest._id) {
            setDelRequestLoading(true);
            axios.delete('/harvestingrequest', {
                data: {
                    requestID: currentRequest._id
                }
            }).then((res) => {
                if (!res.data.err) {
                    getHarvestingRequests();
                    closeDeleteModal();
                    closeHRVModal();
                } else {
                    handleGlobalError(res.data.errMsg);
                    setDelRequestLoading(false);
                }
            }).catch((err) => {
                handleGlobalError(err);
                setDelRequestLoading(false);
            });
        }
    };

    const openDeclineModal = () => {
        setDeclineRequestLoading(false);
        setShowDeclineModal(true);
    };

    const closeDeclineModal = () => {
        setDeclineRequestLoading(false);
        setDeclineReason('');
        setShowDeclineModal(false);
    };

    const submitDeclineRequest = () => {
        if (currentRequest._id) {
            setDeclineRequestLoading(true);
            axios.patch('/harvestingrequest/decline', {
                requestID: currentRequest._id,
                declineReason: declineReason
            }).then((res) => {
                if (!res.data.err) {
                    getHarvestingRequests();
                    setDeclineReason('')
                    closeDeclineModal();
                    closeHRVModal();
                } else {
                    handleGlobalError(res.data.errMsg);
                    setDeclineRequestLoading(false);
                }
            }).catch((err) => {
                handleGlobalError(err);
                setDeclineRequestLoading(false);
            });
        }
    };

    const openConvertModal = () => {
        setConvertLoading(false);
        setShowConvertModal(true);
    };

    const closeConvertModal = () => {
        setShowConvertModal(false);
        setConvertLoading(false);
    };

    const submitConvertRequest = () => {
        if (currentRequest._id && !isEmptyString(currentRequest._id)) {
            setConvertLoading(true);
            axios.post('/harvestingrequest/convert', {
                requestID: currentRequest._id
            }).then((res) => {
                if (!res.data.err) {
                    if (res.data.projectID) {
                        props.history.push(`/projects/${res.data.projectID}`);
                    } else {
                        closeConvertModal();
                        closeHRVModal();
                        getHarvestingRequests();
                    }
                } else {
                    handleGlobalError(res.data.errMsg);
                    setConvertLoading(false);
                }
            }).catch((err) => {
                handleGlobalError(err);
                setConvertLoading(false);
            });
        } else {
            handleGlobalError('Unable to convert: no requestID present.');
        }
    };

    return (
        <Grid className='controlpanel-container' divided='vertically'>
            <Grid.Row>
                <Grid.Column width={16}>
                    <Header className='component-header'>Harvesting Requests</Header>
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
                                    Harvesting Requests
                                </Breadcrumb.Section>
                            </Breadcrumb>
                        </Segment>
                        <Segment>
                            <div id='adoptionreports-filteroptions'>
                                <Form className='mt-1p'>
                                    <Form.Group inline>
                                        <Form.Field inline>
                                            <DateInput
                                                value={fromDate}
                                                onChange={(value) => setFromDate(value)}
                                                label='From'
                                                inlineLabel={true}
                                            />
                                        </Form.Field>
                                        <Form.Field inline>
                                            <DateInput
                                                value={toDate}
                                                onChange={(value) => setToDate(value)}
                                                label='To'
                                                inlineLabel={true}
                                            />
                                        </Form.Field>
                                        <Form.Field inline>
                                            <label>Sort by</label>
                                            <Dropdown
                                                placeholder='Sort by...'
                                                floating
                                                selection
                                                button
                                                options={sortOptions}
                                                onChange={(e, { value }) => { setSortChoice(value) }}
                                                value={sortChoice}
                                            />
                                        </Form.Field>

                                        <Form.Field>
                                            <Checkbox
                                                checked={includeDeclined}
                                                onChange={() => setIncludeDeclined((prev) => !prev)}
                                                label='Include Declined'
                                            />
                                        </Form.Field>
                                    </Form.Group>
                                    </Form>
                            </div>
                        </Segment>
                        <Segment>
                            <Table striped celled fixed>
                                <Table.Header>
                                    <Table.Row>
                                        <Table.HeaderCell>
                                            {(sortChoice === 'date')
                                                ? <span><em>Date</em></span>
                                                : <span>Date</span>
                                            }
                                        </Table.HeaderCell>
                                        <Table.HeaderCell>
                                            {(sortChoice === 'reqdate')
                                                ? <span><em>Requested Harvest Date</em></span>
                                                : <span>Requested Harvest Date</span>
                                            }
                                        </Table.HeaderCell>
                                        <Table.HeaderCell>
                                            {(sortChoice === 'resname')
                                                ? <span><em>Resource Title</em></span>
                                                : <span>Resource Name</span>
                                            }
                                        </Table.HeaderCell>
                                        <Table.HeaderCell>
                                            {(sortChoice === 'reslib')
                                                ? <span><em>Resource Library</em></span>
                                                : <span>Resource Library</span>
                                            }
                                        </Table.HeaderCell>
                                        <Table.HeaderCell>
                                            {(sortChoice === 'license')
                                                ? <span><em>License</em></span>
                                                : <span>License</span>
                                            }
                                        </Table.HeaderCell>
                                        <Table.HeaderCell>
                                            {(sortChoice === 'institution')
                                                ? <span><em>Institution</em></span>
                                                : <span>Institution</span>
                                            }
                                        </Table.HeaderCell>
                                        <Table.HeaderCell>
                                            {(sortChoice === 'status')
                                                ? <span><em>Status</em></span>
                                                : <span>Status</span>
                                            }
                                        </Table.HeaderCell>
                                        <Table.HeaderCell>
                                            <span>Name</span>
                                        </Table.HeaderCell>
                                    </Table.Row>
                                </Table.Header>
                                <Table.Body>
                                    {(harvestingRequests.length > 0) &&
                                        sortedRequests.map((item, idx) => {
                                            return (
                                                <Table.Row key={idx}>
                                                    <Table.Cell>
                                                        <span className='text-link' onClick={() => { openHRVModal(idx) }}>
                                                            {parseDateAndTime(item.createdAt)}
                                                        </span>
                                                    </Table.Cell>
                                                    <Table.Cell>
                                                        <span>{parseDate(item.dateIntegrate)}</span>
                                                    </Table.Cell>
                                                    <Table.Cell>
                                                        <span>{item.title}</span>
                                                    </Table.Cell>
                                                    <Table.Cell>
                                                        <Image src={getLibGlyphURL(item.library)} className='library-glyph' />
                                                        <span>{getLibraryName(item.library)}</span>
                                                    </Table.Cell>
                                                    <Table.Cell>
                                                        <span>{typeof item.license === 'object' ? `${item.license.name} ${item.license.version}` : item.license}</span>
                                                    </Table.Cell>
                                                    <Table.Cell>
                                                        <span>{item.institution}</span>
                                                    </Table.Cell>
                                                    <Table.Cell>
                                                        <span>{capitalizeFirstLetter(item.status)}</span>
                                                    </Table.Cell>
                                                    <Table.Cell>
                                                        <span>{item.name}</span>
                                                    </Table.Cell>
                                                </Table.Row>
                                            )
                                        })
                                    }
                                    {(harvestingRequests.length === 0) &&
                                        <Table.Row>
                                            <Table.Cell colSpan='7'>
                                                <p className='text-center'><em>No results found.</em></p>
                                            </Table.Cell>
                                        </Table.Row>
                                    }
                                </Table.Body>
                            </Table>
                        </Segment>
                    </Segment.Group>
                    {/* View Harvesting Request Modal */}
                    <Modal
                        onClose={closeHRVModal}
                        open={showHRVModal}
                    >
                        <Modal.Header>View Harvesting Request — <em>{parseDateAndTime(currentRequest.createdAt)}</em>{currentRequest.status ? ` - ${capitalizeFirstLetter(currentRequest.status)}` : ''}</Modal.Header>
                        <Modal.Content scrolling>
                            <Grid divided='vertically'>
                                <Grid.Row columns={3}>
                                    <Grid.Column>
                                        <Header sub>Email</Header>
                                        <p>{currentRequest.email}</p>
                                    </Grid.Column>
                                    <Grid.Column>
                                        <Header sub>Resource Title</Header>
                                        <p>{currentRequest.title}</p>
                                    </Grid.Column>
                                    <Grid.Column>
                                        <Header sub>Resource Library</Header>
                                        <Image src={getLibGlyphURL(currentRequest.library)} className='library-glyph' />
                                        <span>{getLibraryName(currentRequest.library)}</span>
                                    </Grid.Column>
                                </Grid.Row>
                                <Grid.Row columns={2}>
                                    <Grid.Column>
                                        <Header sub>Resource License</Header>
                                        <p>{typeof currentRequest.license === 'object' ? `${currentRequest.license.name} ${currentRequest.license.version}` : currentRequest.license}</p>
                                    </Grid.Column>
                                    <Grid.Column>
                                        <Header sub>Resource URL</Header>
                                        {!isEmptyString(currentRequest.url)
                                            ? <a href={normalizeURL(currentRequest.url)} target='_blank' rel='noopener noreferrer'>{currentRequest.url}</a>
                                            :<p className='muted-text'><em>N/A</em></p>
                                        }
                                    </Grid.Column>
                                </Grid.Row>
                                <Grid.Row columns={1}>
                                    <Grid.Column>
                                        <Grid>
                                            <Grid.Row columns={2}>
                                                <Grid.Column>
                                                    <Header sub>Name</Header>
                                                    {!isEmptyString(currentRequest.name)
                                                        ? <p>{currentRequest.name}</p>
                                                        :<p className='muted-text'><em>N/A</em></p>
                                                    }
                                                </Grid.Column>
                                                <Grid.Column>
                                                    <Header sub>Institution Name</Header>
                                                    {!isEmptyString(currentRequest.institution)
                                                        ? <p>{currentRequest.institution}</p>
                                                        :<p className='muted-text'><em>N/A</em></p>
                                                    }
                                                </Grid.Column>
                                            </Grid.Row>
                                            <Grid.Row columns={2}>
                                                <Grid.Column>
                                                    <Header sub>Resource Use</Header>
                                                    {!isEmptyString(getTextUse(currentRequest.resourceUse))
                                                        ? <p>{getTextUse(currentRequest.resourceUse)}</p>
                                                        :<p className='muted-text'><em>N/A</em></p>
                                                    }
                                                </Grid.Column>
                                                <Grid.Column>
                                                    <Header sub>Requested Harvest Date</Header>
                                                    {(currentRequest.dateIntegrate !== null)
                                                        ? <p>{parseDate(currentRequest.dateIntegrate)}</p>
                                                        :<p className='muted-text'><em>N/A</em></p>
                                                    }
                                                </Grid.Column>
                                            </Grid.Row>
                                        </Grid>
                                    </Grid.Column>
                                </Grid.Row>
                                <Grid.Row columns={1}>
                                    <Grid.Column>
                                        <Header sub>Additional Comments</Header>
                                        {!isEmptyString(currentRequest.comments)
                                            ? <p>{currentRequest.comments}</p>
                                            : <p className='muted-text'><em>None</em></p>
                                        }
                                    </Grid.Column>
                                </Grid.Row>
                            </Grid>
                        </Modal.Content>
                        <Modal.Actions>
                            <div className='flex-row-div'>
                                {user.isSuperAdmin && 
                                    <div className='ui left-flex'>
                                        <Button
                                            color='red'
                                            onClick={openDeleteModal}
                                        >
                                            <Icon name='trash' />
                                            Delete
                                        </Button>
                                        {currentRequest.status === 'open' && 
                                            (<Button
                                                color='orange'
                                                onClick={openDeclineModal}
                                            >
                                                <Icon name='cancel' />
                                                Decline
                                            </Button>
                                        )}
                                    </div>
                                }
                                {currentRequest.status === 'open' &&
                                    (<div className='ui center-flex'>
                                        <Button
                                            color='green'
                                            onClick={openConvertModal}
                                        >
                                            <Icon name='share' />
                                            Convert to Project
                                        </Button>
                                    </div>)
                                }
                                <div className='ui right-flex'>
                                    <Button
                                        color='blue'
                                        onClick={closeHRVModal}
                                    >
                                        Done
                                    </Button>
                                </div>
                            </div>
                        </Modal.Actions>
                    </Modal>
                    {/* Confirm Deletion Modal */}
                    <Modal
                        open={showDelModal}
                        onClose={closeDeleteModal}
                    >
                        <Modal.Header>Confirm Request Deletion</Modal.Header>
                        <Modal.Content>
                            <p>Are you sure you want to delete the integration request for <strong>{currentRequest.title}</strong> <span className='muted-text'>(ID: {currentRequest._id})</span>?</p>
                            <p><strong>This action is irreversible.</strong></p>
                        </Modal.Content>
                        <Modal.Actions>
                            <Button
                                onClick={closeDeleteModal}
                            >
                                Cancel
                            </Button>
                            <Button
                                color='red'
                                loading={delRequestLoading}
                                onClick={submitDeleteRequest}
                            >
                                <Icon name='trash' />
                                Delete Request
                            </Button>
                        </Modal.Actions>
                    </Modal>
                    {/* Convert Project Modal */}
                    <Modal
                        open={showConvertModal}
                        onClose={closeConvertModal}
                    >
                        <Modal.Header>Convert Request to Project</Modal.Header>
                        <Modal.Content>
                            <p>Are you sure you want to convert this request to a new "available" project? The requester will be notified via email.</p>
                            {(currentRequest.submitter && !isEmptyString(currentRequest.submitter))
                                && currentRequest.hasOwnProperty('addToProject') && currentRequest.addToProject === true &&
                                <p><em>The requester is a Conductor user and will be automatically added to the new project.</em></p>
                            }
                        </Modal.Content>
                        <Modal.Actions>
                            <Button
                                onClick={closeConvertModal}
                            >
                                Cancel
                            </Button>
                            <Button
                                color='green'
                                loading={convertLoading}
                                onClick={submitConvertRequest}
                            >
                                <Icon name='share' />
                                Convert to Project
                            </Button>
                        </Modal.Actions>
                    </Modal>
                    {/* Confirm Decline Modal */}
                    <Modal
                        open={showDeclineModal}
                        onClose={closeDeclineModal}
                    >
                        <Modal.Header>Confirm Request Decline</Modal.Header>
                        <Modal.Content>
                            <p>Are you sure you want to decline this request? The requester will be notified via email with the following reason: </p>
                            <Form>
                            <TextArea
                            value={declineReason}
                            onChange={(e) => setDeclineReason(e.target.value)}
                            placeholder="Reason for declining request (limit 300 chars)..."
                            maxLength="300"
                            />
                            </Form>
                        </Modal.Content>
                        <Modal.Actions>
                            <Button
                                onClick={closeDeclineModal}
                            >
                                Cancel
                            </Button>
                            <Button
                                color='orange'
                                loading={declineRequestLoading}
                                onClick={submitDeclineRequest}
                            >
                                <Icon name='cancel' />
                                Decline
                            </Button>
                        </Modal.Actions>
                    </Modal>
                </Grid.Column>
            </Grid.Row>
        </Grid>
    )

}

export default HarvestingRequests;
