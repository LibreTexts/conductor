import './ControlPanel.css';

import {
    Grid,
    Header,
    Segment,
    Icon,
    List,
    Breadcrumb,
    SemanticICONS
} from 'semantic-ui-react';
import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTypedSelector } from '../../state/hooks';

type ControlPanelListItem = {
    url: string;
    icon: SemanticICONS;
    title: string;
    description: string;
}

const ControlPanel = () => {

    // Global State

    const isCampusAdmin = useTypedSelector((state) => state.user.isCampusAdmin);
    const isSuperAdmin = useTypedSelector((state) => state.user.isSuperAdmin);
    const org = useTypedSelector((state) => state.org);

    
    /**
     * Set page title on initial load.
     */
    useEffect(() => {
        document.title = "LibreTexts Conductor | Control Panel";
    }, []);


    let libretextsMasterTools: ControlPanelListItem[] = [
        {
            url: '/controlpanel/accountrequests',
            icon: 'user plus',
            title: 'Account Requests',
            description: 'View Account Requests submitted to the Conductor platform'
        },
        {
            url: '/controlpanel/adoptionreports',
            icon: 'chart line',
            title: 'Adoption Reports',
            description: 'View Adoption Reports submitted to the Conductor platform'
        },
        {
            url: '/controlpanel/analyticsrequests',
            icon: 'database',
            title: 'Analytics Access Requests',
            description: 'View requests to access LibreTexts textbook analytics feeds'
        },
        {
            url: '/controlpanel/harvestingrequests',
            icon: 'clipboard',
            title: 'Harvesting Requests',
            description: 'View and manage OER Integration Requests submitted to the Conductor platform'
        },
        {
            url: '/controlpanel/orgsmanager',
            icon: 'building',
            title: 'Organizations Manager',
            description: 'View and manage Organizations on the Conductor platform'
        },
        {
            url: '/controlpanel/homeworkmanager',
            icon: 'tasks',
            title: 'Homework Manager',
            description: 'View and manage Homework resources listed on the LibreCommons'
        }
    ];


    let campusAdminTools: ControlPanelListItem[] = [
        {
            url: '/controlpanel/booksmanager',
            icon: 'book',
            title: 'Books Manager',
            description: 'See the master Commons Catalog and manage which texts appear on your Campus Commons'
        },
        {
            url: '/controlpanel/collectionsmanager',
            icon: 'folder open',
            title: 'Collections Manager',
            description: 'Create new Collections for your Campus Commons and manage existing Collections'
        },
        {
            url: '/controlpanel/peerreviewrubrics',
            icon: 'comments outline',
            title: 'Peer Review Rubrics',
            description: 'Manage Peer Review rubrics available for use in Conductor projects'
        },
        {
            url: '/controlpanel/campussettings',
            icon: 'university',
            title: 'Campus Settings',
            description: 'Manage branding settings for your Conductor instance and your Campus Commons'
        },
        {
            url: '/controlpanel/usersmanager',
            icon: 'users',
            title: 'Users Manager',
            description: 'See which Conductor users have access to your instance and manage their permissions'
        }
    ];

    const renderListItem = (type: 'libretexts' | 'campus', item: ControlPanelListItem, idx: number) => {
        return (
            <List.Item
                as={Link}
                to={item.url}
                key={`${type}-${idx}`}
            >
                <div className='flex-row-div'>
                    <div className='left-flex'>
                        <Icon name={item.icon} />
                        <div className='flex-col-div ml-1p'>
                            <Header as='span' size='small'>{item.title}</Header>
                            <span>{item.description}</span>
                        </div>
                    </div>
                    <div className='right-flex'>
                        <Icon name='chevron right' />
                    </div>
                </div>
            </List.Item>
        )
    };


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
                            </Breadcrumb>
                        </Segment>
                        <Segment>
                            <p className='mt-1p mb-1p'>
                                Welcome to Control Panel. Here, you will find several tools to manage your Campus Conductor instance.
                            </p>
                            <Segment basic>
                                {(isSuperAdmin && (org.orgID === 'libretexts')) &&
                                    <div className='mb-2r'>
                                        <Header as='h5' dividing>LIBRETEXTS MASTER TOOLS</Header>
                                        <List relaxed='very' divided selection>
                                            {libretextsMasterTools.map((item, idx) => renderListItem('libretexts', item, idx))}
                                        </List>
                                    </div>
                                }
                                {(isCampusAdmin || isSuperAdmin) &&
                                    <div className='mb-2r'>
                                        <Header as='h5' dividing>CAMPUS ADMIN TOOLS</Header>
                                        <List relaxed='very' divided selection verticalAlign='middle'>
                                            {campusAdminTools.map((item, idx) => renderListItem('campus', item, idx))}
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
