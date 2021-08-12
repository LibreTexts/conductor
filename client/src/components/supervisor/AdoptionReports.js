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

import { useUserState } from '../../providers.js';

const AdoptionReports = (props) => {

    const [{roles, isAuthenticated}, dispatch] = useUserState();

    useEffect(() => {
        document.title = "LibreTexts Conductor | Adoption Reports";
        date.plugin(ordinal);
    }, []);

    const parseDateAndTime = (dateInput) => {
        const dateInstance = new Date(dateInput);
        const timeString = date.format(dateInstance, 'h:mm A');
        return {
            date: dateInstance.toDateString(),
            time: timeString
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
                    <Segment>
                        <Table striped celled>
                            <Table.Header>
                                <Table.Row>
                                    <Table.HeaderCell>Date</Table.HeaderCell>
                                    <Table.HeaderCell>Resource Name</Table.HeaderCell>
                                    <Table.HeaderCell>Resource Library</Table.HeaderCell>
                                    <Table.HeaderCell>Comments</Table.HeaderCell>
                                </Table.Row>
                            </Table.Header>
                        </Table>
                    </Segment>
                </Grid.Column>
            </Grid.Row>
        </Grid>
    )

}

export default AdoptionReports;
