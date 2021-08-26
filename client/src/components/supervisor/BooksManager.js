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
  Dropdown,
  Icon
} from 'semantic-ui-react';
import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
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
import {
    getTermTaught,
    buildAccessMethodsList
} from '../adoptionreport/AdoptionReportOptions.js';
import useGlobalError from '../error/ErrorHooks.js';

const BooksManager = (props) => {

    // Global State
    const { handleGlobalError } = useGlobalError();
    const isSuperAdmin = useSelector((state) => state.user.isSuperAdmin);

    const [sortChoice, setSortChoice] = useState('');

    // Data

    // UI

    useEffect(() => {
        document.title = "LibreTexts Conductor | Book Manager";
        date.plugin(ordinal);
    }, []);

    /*
    // getAdoptionReports()
    useEffect(() => {
        if (!isEmptyString(fromDate) && !isEmptyString(toDate)) {
            axios.get('/adoptionreports', {
                params: {
                    startDate: fromDate,
                    endDate: toDate
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
    }, [fromDate, toDate]);
    */

    const syncWithLibs = () => {
        axios.post('/commons/syncwithlibs').then((res) => {
            console.log(res);
        }).catch((err) => {
            console.log(err);
        });
    }

    return (
        <Grid className='component-container' divided='vertically'>
            <Grid.Row>
                <Grid.Column width={16}>
                    <Header className='component-header'>Books Manager</Header>
                </Grid.Column>
            </Grid.Row>
            <Grid.Row>
                <Grid.Column width={16}>
                    <Segment.Group>
                        <Segment>
                            {isSuperAdmin &&
                                <Button
                                    color='blue'
                                    onClick={syncWithLibs}
                                >
                                    <Icon name='sync alternate' />
                                    Sync Commons with Libraries
                                </Button>
                            }
                        </Segment>
                        <Segment>
                            <Table striped celled fixed>
                                <Table.Header>
                                    <Table.Row>
                                        <Table.HeaderCell>
                                            {(sortChoice === 'lib')
                                                ? <span><em>Library</em></span>
                                                : <span>Library</span>
                                            }
                                        </Table.HeaderCell>
                                        <Table.HeaderCell>
                                            {(sortChoice === 'title')
                                                ? <span><em>Book Title</em></span>
                                                : <span>Book Title</span>
                                            }
                                        </Table.HeaderCell>
                                        <Table.HeaderCell>
                                            {(sortChoice === 'author')
                                                ? <span><em>Author</em></span>
                                                : <span>Author</span>
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
                                            <span>Enabled on Commons</span>
                                        </Table.HeaderCell>
                                    </Table.Row>
                                </Table.Header>
                                <Table.Body>
                                </Table.Body>
                            </Table>
                        </Segment>
                    </Segment.Group>
                </Grid.Column>
            </Grid.Row>
        </Grid>
    )

}

export default BooksManager;
