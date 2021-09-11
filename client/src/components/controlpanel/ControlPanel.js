import './ControlPanel.css';

import {
  Grid,
  Header,
  Segment,
  Icon,
  List,
  Breadcrumb
} from 'semantic-ui-react';
import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useSelector } from 'react-redux';

import useGlobalError from '../error/ErrorHooks.js';

const ControlPanel = (props) => {

    // Global State
    const { handleGlobalError } = useGlobalError();
    const isCampusAdmin = useSelector((state) => state.user.isCampusAdmin);
    const isSuperAdmin = useSelector((state) => state.user.isSuperAdmin);

    /**
     * Set page title on initial load.
     */
    useEffect(() => {
        document.title = "LibreTexts Conductor | Control Panel";
    }, []);

    return (
        <Grid className='controlpanel-container' divided='vertically'>
            <Grid.Row>
                <Grid.Column width={16}>
                    <Header className='component-header'>Control Panel</Header>
                </Grid.Column>
            </Grid.Row>
            <Grid.Row>
                <Grid.Column width={16}>
                    <Segment.Group>
                        <Segment>
                            <Breadcrumb>
                                <Breadcrumb.Section active>
                                    Control Panel
                                </Breadcrumb.Section>
                                <Breadcrumb.Divider icon='right chevron' />
                            </Breadcrumb>
                        </Segment>
                        <Segment>
                            <p className='mt-1p mb-1p'>
                                Welcome to Control Panel. Here, you will find several tools to manage your Campus Conductor instance.
                            </p>
                            <Segment basic>
                                {(isSuperAdmin && (process.env.REACT_APP_ORG_ID === 'libretexts')) &&
                                    <div className='mb-2r'>
                                        <Header as='h5' dividing>LIBRETEXTS MASTER TOOLS</Header>
                                        <List relaxed='very' divided selection>
                                            <List.Item
                                                as={Link}
                                                to='/controlpanel/adoptionreports'
                                            >
                                                <Icon name='chart line' />
                                                <List.Content>
                                                    <List.Header>Adoption Reports</List.Header>
                                                    <List.Description>
                                                        View Adoption Reports submitted to the Conductor platform
                                                    </List.Description>
                                                </List.Content>
                                            </List.Item>
                                            <List.Item
                                                as={Link}
                                                to='/controlpanel/harvestingrequests'
                                            >
                                                <Icon name='clipboard' />
                                                <List.Content>
                                                    <List.Header>Harvesting Requests</List.Header>
                                                    <List.Description>
                                                        View and manage OER Integration Requests submitted to the Conductor platform
                                                    </List.Description>
                                                </List.Content>
                                            </List.Item>
                                            <List.Item
                                                as={Link}
                                                to='/controlpanel/orgsmanager'
                                                disabled
                                            >
                                                <Icon name='building' />
                                                <List.Content>
                                                    <List.Header>Organizations Manager</List.Header>
                                                    <List.Description>
                                                        View and manage Organizations on the Conductor platform
                                                    </List.Description>
                                                </List.Content>
                                            </List.Item>
                                            <List.Item
                                                as={Link}
                                                to='/controlpanel/homeworkmanager'
                                            >
                                                <Icon name='tasks' />
                                                <List.Content>
                                                    <List.Header>Homework Manager</List.Header>
                                                    <List.Description>
                                                        View and manage Homework resources listed on the LibreCommons
                                                    </List.Description>
                                                </List.Content>
                                            </List.Item>
                                        </List>
                                    </div>
                                }
                                {(isCampusAdmin || isSuperAdmin) &&
                                    <div className='mb-2r'>
                                        <Header as='h5' dividing>CAMPUS ADMIN TOOLS</Header>
                                        <List relaxed='very' divided selection>
                                            <List.Item
                                                as={Link}
                                                to='/controlpanel/booksmanager'
                                            >
                                                <Icon name='book' />
                                                <List.Content>
                                                    <List.Header>Books Manager</List.Header>
                                                    <List.Description>
                                                        See the master Commons Catalog and manage which texts appear on your Campus Commons
                                                    </List.Description>
                                                </List.Content>
                                            </List.Item>
                                            <List.Item
                                                as={Link}
                                                to='/controlpanel/collectionsmanager'
                                            >
                                                <Icon name='folder open' />
                                                <List.Content>
                                                    <List.Header>Collections Manager</List.Header>
                                                    <List.Description>
                                                        Create new Collections for your Campus Commons and manage existing Collections
                                                    </List.Description>
                                                </List.Content>
                                            </List.Item>
                                            <List.Item
                                                as={Link}
                                                to='/controlpanel/usersmanager'
                                            >
                                                <Icon name='users' />
                                                <List.Content>
                                                    <List.Header>Users Manager</List.Header>
                                                    <List.Description>
                                                        See which Conductor users have access to your Campus Commons and manage their permissions
                                                    </List.Description>
                                                </List.Content>
                                            </List.Item>
                                        </List>
                                    </div>
                                }
                            </Segment>
                        </Segment>
                    </Segment.Group>
                </Grid.Column>
            </Grid.Row>
        </Grid>
    )

}

export default ControlPanel;
