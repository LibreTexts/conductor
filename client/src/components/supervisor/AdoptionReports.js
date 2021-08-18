//import './SupervisorDashboard.css';

import { DateInput } from 'semantic-ui-calendar-react';
import {
  Grid,
  Header,
  Menu,
  Image,
  Segment,
  Divider,
  Message,
  Icon,
  Form,
  Card,
  Table
} from 'semantic-ui-react';
import { Link } from 'react-router-dom';
import React, { useEffect, useState } from 'react';
import axios from 'axios';
import date from 'date-and-time';
import ordinal from 'date-and-time/plugin/ordinal';

import {
    isEmptyString,
    truncateString,
    capitalizeFirstLetter
} from '../util/HelperFunctions.js';
import {
    getGlyphAddress,
    getLibraryName
} from '../util/HarvestingMasterOptions.js';
import useGlobalError from '../error/ErrorHooks.js';

import { useUserState } from '../../providers.js';

const AdoptionReports = (props) => {

    const { setError } = useGlobalError();

    const [{roles, isAuthenticated}, dispatch] = useUserState();

    const [adoptionReports, setAdoptionReports] = useState([]);
    const [fromDate, setFromDate] = useState('01-01-2021');
    const [toDate, setToDate] = useState('');

    useEffect(() => {
        document.title = "LibreTexts Conductor | Adoption Reports";
        date.plugin(ordinal);
        const today = new Date();
        const todayString = `${today.getMonth()+1}-${today.getDate()}-${today.getFullYear()}`;
        setToDate(todayString);
    }, []);

    useEffect(() => {
        getAdoptionReports();
    }, [fromDate, toDate])

    /**
     * Process a REST-returned error object and activate
     * the global error modal
     */
    const handleErr = (err) => {
        var message = "";
        if (err.response) {
            if (err.response.data.errMsg !== undefined) {
                message = err.response.data.errMsg;
            } else {
                message = "Error processing request.";
            }
            if (err.response.data.errors) {
                if (err.response.data.errors.length > 0) {
                    message = message.replace(/\./g, ': ');
                    err.response.data.errors.forEach((elem, idx) => {
                        if (elem.param) {
                            message += (String(elem.param).charAt(0).toUpperCase() + String(elem.param).slice(1));
                            if ((idx + 1) !== err.response.data.errors.length) {
                                message += ", ";
                            } else {
                                message += ".";
                            }
                        }
                    });
                }
            }
        } else if (err.name && err.message) {
            message = err.message;
        } else if (typeof(err) === 'string') {
            message = err;
        } else {
            message = err.toString();
        }
        setError(message);
    };

    const parseDateAndTime = (dateInput) => {
        const dateInstance = new Date(dateInput);
        const dateString = date.format(dateInstance, 'MM/DD/YYYY h:mm A');
        return dateString
    }

    const getAdoptionReports = () => {
        if (!isEmptyString(fromDate) && !isEmptyString(toDate)) {
            axios.get('/adoptionreports', {
                params: {
                    startDate: fromDate,
                    endDate: toDate
                }
            }).then((res) => {
                if (!res.data.err) {
                    console.log(res.data.reports);
                    setAdoptionReports(res.data.reports);
                } else {
                    handleErr(res.data.errMsg);
                }
            }).catch((err) => {
                handleErr(err);
            });
        }
    }

    return (
        <Grid className='component-container' divided='vertically'>
            <Grid.Row>
                <Grid.Column width={16}>
                    <Header className='component-header'>Adoption Reports</Header>
                </Grid.Column>
            </Grid.Row>
            <Grid.Row>
                <Grid.Column width={16}>
                    <Segment.Group>
                        <Segment>
                            <Grid>
                                <Grid.Row>
                                    <Grid.Column width={4}>
                                        <Form>
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
                                    </Grid.Column>
                                    <Grid.Column width={4}>
                                        <Form>
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
                                    </Grid.Column>
                                </Grid.Row>
                            </Grid>
                        </Segment>
                        <Segment>
                            <Table striped celled fixed>
                                <Table.Header>
                                    <Table.Row>
                                        <Table.HeaderCell>Date</Table.HeaderCell>
                                        <Table.HeaderCell>Report Type</Table.HeaderCell>
                                        <Table.HeaderCell>Resource Name</Table.HeaderCell>
                                        <Table.HeaderCell>Resource Library</Table.HeaderCell>
                                        <Table.HeaderCell>Institution</Table.HeaderCell>
                                        <Table.HeaderCell>Comments</Table.HeaderCell>
                                        <Table.HeaderCell>Name</Table.HeaderCell>
                                    </Table.Row>
                                </Table.Header>
                                <Table.Body>
                                    {(adoptionReports.length > 0) &&
                                        adoptionReports.map((item, idx) => {
                                            var resourceTitle = "Unknown";
                                            var resourceLib = "Unknown";
                                            var institution = "Unknown";
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
                                                    <Table.Cell>{parseDateAndTime(item.createdAt)}</Table.Cell>
                                                    <Table.Cell>{capitalizeFirstLetter(item.role)}</Table.Cell>
                                                    <Table.Cell>{resourceTitle}</Table.Cell>
                                                    <Table.Cell>
                                                        <Image src={getGlyphAddress(resourceLib)} className='library-glyph' />
                                                        {getLibraryName(resourceLib)}
                                                    </Table.Cell>
                                                    <Table.Cell>{institution}</Table.Cell>
                                                    <Table.Cell><em>{truncateString(item.comments, 200)}</em></Table.Cell>
                                                    <Table.Cell>{item.name}</Table.Cell>
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
                </Grid.Column>
            </Grid.Row>
        </Grid>
    )

}

export default AdoptionReports;
