import './SupervisorDashboard.css';

import { DateInput } from 'semantic-ui-calendar-react';
import {
  Grid,
  Header,
  Image,
  Segment,
  Form,
  Table,
  Modal,
  Button,
  Dropdown
} from 'semantic-ui-react';
import React, { useEffect, useState } from 'react';
import axios from 'axios';
import date from 'date-and-time';
import ordinal from 'date-and-time/plugin/ordinal';

import {
    isEmptyString,
} from '../util/HelperFunctions.js';
import {
    getLibGlyphURL,
    getLibraryName
} from '../util/LibraryOptions.js';
import { getLicenseText } from '../util/LicenseOptions.js';
import {
    getTextUse
} from '../util/HarvestingMasterOptions.js';
import useGlobalError from '../error/ErrorHooks.js';

const HarvestingRequests = (props) => {

    const { handleGlobalError } = useGlobalError();

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
    const [fromDate, setFromDate] = useState('01-01-2021');
    const [toDate, setToDate] = useState('');
    const [showHRVModal, setShowHRVModal] = useState(false);
    const [sortChoice, setSortChoice] = useState('date');

    const sortOptions = [
        { key: 'date', text: 'Date', value: 'date' },
        { key: 'intdeadline', text: 'Integration Deadline', value: 'intdeadline' },
        { key: 'resname', text: 'Resource Title', value: 'resname' },
        { key: 'reslib', text: 'Resource Library', value: 'reslib' },
        { key: 'license', text: 'License', value: 'license' },
        { key: 'institution', text: 'Institution', value: 'institution' }
    ];

    useEffect(() => {
        document.title = "LibreTexts Conductor | Harvesting Requests";
        date.plugin(ordinal);
        const today = new Date();
        const todayString = `${today.getMonth()+1}-${today.getDate()}-${today.getFullYear()}`;
        setToDate(todayString);
    }, []);

    // getHarvestingRequests()
    useEffect(() => {
        if (!isEmptyString(fromDate) && !isEmptyString(toDate)) {
            axios.get('/harvestingrequests', {
                params: {
                    startDate: fromDate,
                    endDate: toDate
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
        }
    }, [fromDate, toDate])

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
            case 'intdeadline':
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
                    if (a.license < b.license) {
                        return -1;
                    }
                    if (a.license > b.license) {
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

    return (
        <Grid className='component-container' divided='vertically'>
            <Grid.Row>
                <Grid.Column width={16}>
                    <Header className='component-header'>Harvesting Requests</Header>
                </Grid.Column>
            </Grid.Row>
            <Grid.Row>
                <Grid.Column width={16}>
                    <Segment.Group>
                        <Segment>
                            <div id='adoptionreports-filteroptions'>
                                <Form className='mr-2p'>
                                    <DateInput
                                        name='fromdate'
                                        label='From'
                                        inlineLabel
                                        placeholder='From ...'
                                        iconPosition='left'
                                        dateFormat='MM-DD-YYYY'
                                        popupPosition='bottom center'
                                        onChange={(e, data) => { setFromDate(data.value) }}
                                        value={fromDate}
                                    />
                                </Form>
                                <Form className='mr-2p'>
                                    <DateInput
                                        name='todate'
                                        label='To'
                                        inlineLabel
                                        placeholder='To ...'
                                        iconPosition='left'
                                        dateFormat='MM-DD-YYYY'
                                        popupPosition='bottom center'
                                        onChange={(e, data) => { setToDate(data.value) }}
                                        value={toDate}
                                    />
                                </Form>
                                <Form>
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
                                            {(sortChoice === 'intdeadline')
                                                ? <span><em>Integration Deadline</em></span>
                                                : <span>Integration Deadline</span>
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
                                                        <span>{getLicenseText(item.license)}</span>
                                                    </Table.Cell>
                                                    <Table.Cell>
                                                        <span>{item.institution}</span>
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
                    <Modal
                        onClose={closeHRVModal}
                        open={showHRVModal}
                    >
                        <Modal.Header>View Harvesting Request — <em>{parseDateAndTime(currentRequest.createdAt)}</em></Modal.Header>
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
                                        <p>{getLicenseText(currentRequest.license)}</p>
                                    </Grid.Column>
                                    <Grid.Column>
                                        <Header sub>Resource URL</Header>
                                        {!isEmptyString(currentRequest.url)
                                            ? <p>{currentRequest.url}</p>
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
                                                    <Header sub>Integration Deadline</Header>
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
                            <Button
                                color='blue'
                                onClick={closeHRVModal}
                            >
                                Done
                            </Button>
                        </Modal.Actions>
                    </Modal>
                </Grid.Column>
            </Grid.Row>
        </Grid>
    )

}

export default HarvestingRequests;
