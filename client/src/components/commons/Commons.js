import './Commons.css';

import { Link, useLocation, Switch, Route } from 'react-router-dom';
import { Grid, Menu, Image, Icon } from 'semantic-ui-react';
import React, { useEffect, useState } from 'react';
import axios from 'axios';

import CommonsNavbar from './CommonsNavbar.js';
import CommonsFooter from './CommonsFooter.js';

import CommonsCatalog from './CommonsCatalog.js';
import CommonsCollections from './CommonsCollections.js';
import CommonsBook from './CommonsBook.js';

import { useUserState } from '../../providers.js';

const Commons = (props) => {
    const location = useLocation();

    const [{ org }, dispatch] = useUserState();

    const [activeItem, setActiveItem] = useState('');

    const getOrgInfo = () => {
        axios.get('org/info', {
            params: {
                orgID: process.env.REACT_APP_ORG_ID
            }
        }).then((res) => {
            if (!res.data.err) {
                var orgData = res.data;
                delete orgData.err;
                dispatch({
                    type: 'SET_ORG_INFO',
                    org: orgData
                });
            } else {
                console.log(res.data.errMsg);
            }
        }).catch((err) => {
            console.log(err);
        });
    };

    useEffect(() => {
        if (org.orgID === '') {
            getOrgInfo();
        }
    });


    useEffect(() => {
        const currentPath = location.pathname;
        if (currentPath === '/') {
            setActiveItem('catalog');
        } else if (currentPath.includes('/catalog')) {
            setActiveItem('catalog');
        } else if (currentPath.includes('/collections')) {
            setActiveItem('collections');
        } else {
            setActiveItem('catalog');
        }
    }, [location]);

    const jumbotronStyle = {
        backgroundImage: 'linear-gradient(rgba(0, 0, 0, 0.4), rgba(0, 0, 0, 0.4)), url(' + org.coverPhoto + ')'
    };

    return (
        <div className='commons'>
            <CommonsNavbar />
            <div className='commons-jumbotron' style={jumbotronStyle}>
                <Grid>
                    <Grid.Row>
                        <Grid.Column>
                            <Image src={org.largeLogo} size='large' centered />
                        </Grid.Column>
                    </Grid.Row>
                    <Grid.Row>
                        <Grid.Column>
                            <h1 className='commons-header'>Campus Commons</h1>
                        </Grid.Column>
                    </Grid.Row>
                </Grid>
            </div>
            <div className='commons-menu'>
                <div className='commons-menu-left'>
                    <Menu secondary className='commons-menu-height'>
                        <Menu.Item
                            className='commons-menu-item'
                            as='a'
                            href={org.aboutLink}
                            target='_blank'
                            rel='noopener noreferrer'
                        >
                            About {org.shortName}
                        </Menu.Item>
                    </Menu>
                </div>
                <div className='commons-menu-center'>
                    <Menu secondary pointing fluid widths={2} className='commons-menu-pointing'>
                        <Menu.Item
                            name='catalog'
                            active={activeItem === 'catalog'}
                            className='commons-menu-item'
                            as={Link}
                            to='/catalog'
                        >
                            Catalog
                        </Menu.Item>
                        <Menu.Item
                            name='collections'
                            active={activeItem === 'collections'}
                            className='commons-menu-item'
                            as={Link}
                            to='/collections'
                        >
                            Collections
                        </Menu.Item>
                    </Menu>
                </div>
                <div className='commons-menu-right'>
                    <Menu secondary className='commons-menu-height'>
                        <Menu.Item
                            className='commons-menu-item'
                            as={Link}
                            to='/login'
                        >
                            Login to Conductor <Icon name='lightning' />
                        </Menu.Item>
                    </Menu>
                </div>
            </div>
            <Switch>
                <Route exact path='/' component={CommonsCatalog} />
                <Route exact path='/catalog' component={CommonsCatalog} />
                <Route exact path='/collections' component={CommonsCollections} />
                <Route exact path='/book/:id' component={CommonsBook} />
            </Switch>
            <CommonsFooter />
        </div>
    )
}

export default Commons;
