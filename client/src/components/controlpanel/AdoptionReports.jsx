import './ControlPanel.css';
import 'react-day-picker/lib/style.css';

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
  Breadcrumb
} from 'semantic-ui-react';
import React, { useEffect, useState, forwardRef } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import date from 'date-and-time';
import ordinal from 'date-and-time/plugin/ordinal';

import ConductorDateInput from '../util/ConductorDateInput';

import {
    isEmptyString,
    truncateString,
    capitalizeFirstLetter,
    normalizeURL
} from '../util/HelperFunctions.js';
import {
    datePickerPopperOptions
} from '../util/DatePickerOptions.js';
import {
    getLibGlyphURL,
    getLibraryName
} from '../util/LibraryOptions.js';
import {
    getTermTaught,
    buildAccessMethodsList
} from '../adoptionreport/AdoptionReportOptions.js';
import useGlobalError from '../error/ErrorHooks.js';

const AdoptionReports = (props) => {

    const { handleGlobalError } = useGlobalError();

    const emptyReport = {
        email: '',
        name: '',
        role: '',
        resource: {
            id: '',
            title: '',
            library: ''
        },
        instructor: {
            isLibreNet: '',
            institution: '',
            class: '',
            term: '',
            students: 0,
            replaceCost: 0,
            printCost: 0,
            access: []
        },
        student: {
            use: '',
            institution: '',
            class: '',
            instructor: '',
            quality: 0,
            navigation: 0,
            printCost: 0,
            access: []
        },
        comments: '',
        createdAt: ''
    };

    // Data
    const [adoptionReports, setAdoptionReports] = useState([]);
    const [sortedReports, setSortedReports] = useState([]);
    const [currentReport, setCurrentReport] = useState(emptyReport);

    // UI
    const [fromDate, setFromDate] = useState(new Date('01/01/2021'));
    const [toDate, setToDate] = useState(new Date());
    const [showARVModal, setShowARVModal] = useState(false);
    const [sortChoice, setSortChoice] = useState('date');

    const sortOptions = [
        { key: 'date', text: 'Date', value: 'date' },
        { key: 'type', text: 'Report Type', value: 'type' },
        { key: 'institution', text: 'Institution', value: 'institution' },
        { key: 'resname', text: 'Resource Name', value: 'resname' },
        { key: 'reslib', text: 'Resource Library', value: 'reslib' },
    ];

    useEffect(() => {
        document.title = "LibreTexts Conductor | Adoption Reports";
        date.plugin(ordinal);
    }, []);

    // getAdoptionReports()
    useEffect(() => {
        if (fromDate !== null && toDate !== null) {
            const fromDateString = `${fromDate.getMonth()+1}-${fromDate.getDate()}-${fromDate.getFullYear()}`;
            const toDateString = `${toDate.getMonth()+1}-${toDate.getDate()}-${toDate.getFullYear()}`;
            axios.get('/adoptionreports', {
                params: {
                    startDate: fromDateString,
                    endDate: toDateString
                }
            }).then((res) => {
                if (!res.data.err) {
                    setAdoptionReports(res.data.reports);
                    setSortedReports(res.data.reports);
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
                break;
            case 'type':
                sorted = [...adoptionReports].sort((a, b) => {
                    if (a.role < b.role) {
                        return -1;
                    }
                    if (a.role > b.role) {
                        return 1;
                    }
                    return 0;
                });
                break;
            case 'institution':
                sorted = [...adoptionReports].sort((a, b) => {
                    var aInst = '';
                    var bInst = '';
                    if (a.role === 'instructor') {
                        aInst = a.instructor.institution;
                    } else if ((a.role === 'student') && !isEmptyString(a.student.institution)) {
                        aInst = a.student.institution;
                    }
                    if (b.role === 'instructor') {
                        bInst = b.instructor.institution;
                    } else if ((b.role === 'student') && !isEmptyString(b.student.institution)) {
                        bInst = b.student.institution;
                    }
                    if (aInst < bInst) {
                        return -1;
                    }
                    if (aInst > bInst) {
                        return 1;
                    }
                    return 0;
                });
                break;
            case 'resname':
                sorted = [...adoptionReports].sort((a, b) => {
                    if (a.resource.title < b.resource.title) {
                        return -1;
                    }
                    if (a.resource.title > b.resource.title) {
                        return 1;
                    }
                    return 0;
                });
                break;
            case 'reslib':
                sorted = [...adoptionReports].sort((a, b) => {
                    if (a.resource.library < b.resource.library) {
                        return -1;
                    }
                    if (a.resource.library > b.resource.library) {
                        return 1;
                    }
                    return 0;
                });
                break;
            default:
                break; // Silence React Warning
        }
        setSortedReports(sorted);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [sortChoice])

    const parseDateAndTime = (dateInput) => {
        const dateInstance = new Date(dateInput);
        const dateString = date.format(dateInstance, 'MM/DD/YYYY h:mm A');
        return dateString;
    };

    const openARVModal = (idx) => {
        if (adoptionReports[idx] !== undefined) {
            setShowARVModal(true);
            setCurrentReport(adoptionReports[idx]);
        }
    };

    const closeARVModal = () => {
        setShowARVModal(false);
        setCurrentReport(emptyReport);
    };


    return (
        <Grid className='controlpanel-container' divided='vertically'>
            <Grid.Row>
                <Grid.Column width={16}>
                    <Header className='component-header'>Adoption Reports</Header>
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
                                    Adoption Reports
                                </Breadcrumb.Section>
                            </Breadcrumb>
                        </Segment>
                        <Segment>
                            <div id='adoptionreports-filteroptions'>
                                <ConductorDateInput
                                    value={fromDate}
                                    onChange={(value) => setFromDate(value)}
                                    label='From'
                                    inlineLabel={true}
                                    className='mr-2p'
                                />
                                <ConductorDateInput
                                    value={toDate}
                                    onChange={(value) => setToDate(value)}
                                    label='To'
                                    inlineLabel={true}
                                    className='mr-2p'
                                />
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
                                            {(sortChoice === 'type')
                                                ? <span><em>Report Type</em></span>
                                                : <span>Report Type</span>
                                            }
                                        </Table.HeaderCell>
                                        <Table.HeaderCell>
                                            {(sortChoice === 'resname')
                                                ? <span><em>Resource Name</em></span>
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
                                            {(sortChoice === 'institution')
                                                ? <span><em>Institution</em></span>
                                                : <span>Institution</span>
                                            }
                                        </Table.HeaderCell>
                                        <Table.HeaderCell>
                                            <span>Comments</span>
                                        </Table.HeaderCell>
                                        <Table.HeaderCell>
                                            <span>Name</span>
                                        </Table.HeaderCell>
                                    </Table.Row>
                                </Table.Header>
                                <Table.Body>
                                    {(adoptionReports.length > 0) &&
                                        sortedReports.map((item, idx) => {
                                            var resourceTitle = <em>Unknown</em>;
                                            var resourceLib = 'unknown';
                                            var institution = <em>Unknown</em>;
                                            if (item.resource) {
                                                if (item.resource.title) {
                                                    resourceTitle = item.resource.title;
                                                }
                                                if (item.resource.library) {
                                                    resourceLib = item.resource.library;
                                                }
                                            }
                                            if (item.role === 'instructor') {
                                                if (item.instructor && item.instructor.institution) {
                                                    institution = item.instructor.institution;
                                                }
                                            } else if (item.role === 'student') {
                                                if (item.student && item.student.institution) {
                                                    institution = item.student.institution;
                                                }
                                            }
                                            return (
                                                <Table.Row key={idx}>
                                                    <Table.Cell>
                                                        <span className='text-link' onClick={() => { openARVModal(idx) }}>
                                                            {parseDateAndTime(item.createdAt)}
                                                        </span>
                                                    </Table.Cell>
                                                    <Table.Cell>
                                                        <span>{capitalizeFirstLetter(item.role)}</span>
                                                    </Table.Cell>
                                                    <Table.Cell>
                                                        <span>{resourceTitle}</span></Table.Cell>
                                                    <Table.Cell>
                                                        {(resourceLib !== 'unknown')
                                                            ? (
                                                                <div>
                                                                    <Image src={getLibGlyphURL(resourceLib)} className='library-glyph' />
                                                                    <span>{getLibraryName(resourceLib)}</span>
                                                                </div>
                                                            )
                                                            : (<span><em>Unknown</em></span>)
                                                        }
                                                    </Table.Cell>
                                                    <Table.Cell>
                                                        <span>{institution}</span></Table.Cell>
                                                    <Table.Cell>
                                                        <span><em>{truncateString(item.comments, 200)}</em></span>
                                                    </Table.Cell>
                                                    <Table.Cell>
                                                        <span>{item.name}</span>
                                                    </Table.Cell>
                                                </Table.Row>
                                            )
                                        })
                                    }
                                    {(adoptionReports.length === 0) &&
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
                        onClose={closeARVModal}
                        open={showARVModal}
                    >
                        <Modal.Header>View Adoption Report ??? <em>{parseDateAndTime(currentReport.createdAt)} ({capitalizeFirstLetter(currentReport.role)})</em></Modal.Header>
                        <Modal.Content scrolling>
                            <Grid divided='vertically'>
                                <Grid.Row columns={3}>
                                    <Grid.Column>
                                        <Header sub>Email</Header>
                                        <p>{currentReport.email}</p>
                                    </Grid.Column>
                                    <Grid.Column>
                                        <Header sub>Name</Header>
                                        <p>{currentReport.name}</p>
                                    </Grid.Column>
                                    <Grid.Column>
                                        <Header sub>Report Type</Header>
                                        <p>{capitalizeFirstLetter(currentReport.role)}</p>
                                    </Grid.Column>
                                </Grid.Row>
                                <Grid.Row columns={3}>
                                    <Grid.Column>
                                        <Header sub>Resource Title</Header>
                                        {(currentReport.resource && currentReport.resource.title)
                                            ? (<p>{currentReport.resource.title}</p>)
                                            : (<em>Not specified, resource may be linked.</em>)
                                        }
                                    </Grid.Column>
                                    <Grid.Column>
                                        <Header sub>Resource Library</Header>
                                        {(currentReport.resource && currentReport.resource.library)
                                            ? (
                                                <div>
                                                    <Image src={getLibGlyphURL(currentReport.resource.library)} className='library-glyph' />
                                                    <span>{getLibraryName(currentReport.resource.library)}</span>
                                                </div>
                                            )
                                            : (<em>Not specified, resource may be linked.</em>)
                                        }
                                    </Grid.Column>
                                    <Grid.Column>
                                        <Header sub>Resource ID</Header>
                                        {(currentReport.resource && currentReport.resource.id)
                                            ? (<p>{currentReport.resource.id}</p>)
                                            : (<em>Not specified, resource may be linked.</em>)
                                        }
                                    </Grid.Column>
                                </Grid.Row>
                                {(currentReport.resource && currentReport.resource.link) &&
                                    <Grid.Row columns={1}>
                                        <Grid.Column>
                                            <Header sub>Resource Link</Header>
                                            <a href={normalizeURL(currentReport.resource.link)} target='_blank' rel='noopener noreferrer'>{truncateString(currentReport.resource.link, 75)}</a>
                                        </Grid.Column>
                                    </Grid.Row>
                                }
                                <Grid.Row columns={1}>
                                    <Grid.Column>
                                        {(currentReport.role === 'instructor') &&
                                            <Grid>
                                                <Grid.Row columns={2}>
                                                    <Grid.Column>
                                                        <Header sub>LibreNet</Header>
                                                        <p>{capitalizeFirstLetter(currentReport.instructor.isLibreNet)}</p>
                                                    </Grid.Column>
                                                    <Grid.Column>
                                                        <Header sub>Institution Name</Header>
                                                        <p>{capitalizeFirstLetter(currentReport.instructor.institution)}</p>
                                                    </Grid.Column>
                                                </Grid.Row>
                                                <Grid.Row columns={3}>
                                                    <Grid.Column>
                                                        <Header sub>Class Name</Header>
                                                        <p>{currentReport.instructor.class}</p>
                                                    </Grid.Column>
                                                    <Grid.Column>
                                                        <Header sub>Term Taught</Header>
                                                        <p>{getTermTaught(currentReport.instructor.term)}</p>
                                                    </Grid.Column>
                                                    <Grid.Column>
                                                        <Header sub>Number of Students</Header>
                                                        <p>{currentReport.instructor.students}</p>
                                                    </Grid.Column>
                                                </Grid.Row>
                                                <Grid.Row columns={2}>
                                                    <Grid.Column>
                                                        <Header sub>Original Text Cost</Header>
                                                        {(currentReport.instructor.replaceCost !== 0)
                                                            ? <p>{currentReport.instructor.replaceCost}</p>
                                                            : <p className='muted-text'><em>N/A</em></p>
                                                        }
                                                    </Grid.Column>
                                                    <Grid.Column>
                                                        <Header sub>Printed Cost</Header>
                                                        {(currentReport.instructor.printCost !== 0)
                                                            ? <p>{currentReport.instructor.printCost}</p>
                                                            : <p className='muted-text'><em>N/A</em></p>
                                                        }
                                                    </Grid.Column>
                                                </Grid.Row>
                                                <Grid.Row columns={1}>
                                                    <Grid.Column>
                                                        <Header sub>Access Methods</Header>
                                                        {!isEmptyString(buildAccessMethodsList(currentReport.instructor.access))
                                                            ? <p>{buildAccessMethodsList(currentReport.instructor.access)}</p>
                                                            :<p className='muted-text'><em>N/A</em></p>
                                                        }
                                                    </Grid.Column>
                                                </Grid.Row>
                                            </Grid>
                                        }
                                        {(currentReport.role === 'student') &&
                                            <Grid>
                                                <Grid.Row columns={3}>
                                                    <Grid.Column>
                                                        <Header sub>Institution Name</Header>
                                                        {!isEmptyString(currentReport.student.institution)
                                                            ? <p>{currentReport.student.institution}</p>
                                                            :<p className='muted-text'><em>N/A</em></p>
                                                        }
                                                    </Grid.Column>
                                                    <Grid.Column>
                                                        <Header sub>Class Name</Header>
                                                        {!isEmptyString(currentReport.student.class)
                                                            ? <p>{currentReport.student.class}</p>
                                                            :<p className='muted-text'><em>N/A</em></p>
                                                        }
                                                    </Grid.Column>
                                                    <Grid.Column>
                                                        <Header sub>Instructor Name</Header>
                                                        {!isEmptyString(currentReport.student.instructor)
                                                            ? <p>{currentReport.student.instructor}</p>
                                                            :<p className='muted-text'><em>N/A</em></p>
                                                        }
                                                    </Grid.Column>
                                                </Grid.Row>
                                                <Grid.Row columns={3}>
                                                    <Grid.Column>
                                                        <Header sub>Resource Use</Header>
                                                        {!isEmptyString(currentReport.student.use)
                                                            ? <p>{currentReport.student.use}</p>
                                                            :<p className='muted-text'><em>N/A</em></p>
                                                        }
                                                    </Grid.Column>
                                                    <Grid.Column>
                                                        <Header sub>Access Methods</Header>
                                                        {!isEmptyString(buildAccessMethodsList(currentReport.student.access))
                                                            ? <p>{buildAccessMethodsList(currentReport.student.access)}</p>
                                                            :<p className='muted-text'><em>N/A</em></p>
                                                        }
                                                    </Grid.Column>
                                                    <Grid.Column>
                                                        <Header sub>Printed Cost</Header>
                                                        {(currentReport.student.printCost !== 0)
                                                            ? <p>{currentReport.student.printCost}</p>
                                                            : <p className='muted-text'><em>N/A</em></p>
                                                        }
                                                    </Grid.Column>
                                                </Grid.Row>
                                                <Grid.Row columns={2}>
                                                    <Grid.Column>
                                                        <Header sub>Content Quality Rating</Header>
                                                        {(currentReport.student.quality !== 0)
                                                            ? <p>{currentReport.student.quality}</p>
                                                            : <p className='muted-text'><em>N/A</em></p>
                                                        }
                                                    </Grid.Column>
                                                    <Grid.Column>
                                                        <Header sub>LibreTexts Navigation Rating</Header>
                                                        {(currentReport.student.navigation !== 0)
                                                            ? <p>{currentReport.student.navigation}</p>
                                                            : <p className='muted-text'><em>N/A</em></p>
                                                        }
                                                    </Grid.Column>
                                                </Grid.Row>
                                            </Grid>
                                        }
                                    </Grid.Column>
                                </Grid.Row>
                                <Grid.Row columns={1}>
                                    <Grid.Column>
                                        <Header sub>Additional Comments</Header>
                                        {!isEmptyString(currentReport.comments)
                                            ? <p>{currentReport.comments}</p>
                                            : <p className='muted-text'><em>None</em></p>
                                        }
                                    </Grid.Column>
                                </Grid.Row>
                            </Grid>
                        </Modal.Content>
                        <Modal.Actions>
                            <Button
                                color='blue'
                                onClick={closeARVModal}
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

export default AdoptionReports;
