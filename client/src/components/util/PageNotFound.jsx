import './PageNotFound.css';

import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Grid, Image } from 'semantic-ui-react';

const PageNotFound = (_props) => {

    useEffect(() => {
        document.title = "LibreTexts Conductor | Page Not Found";
    }, []);

    return(
        <Grid centered={true} verticalAlign='middle' className='notfound-grid'>
            <Grid.Column width={10}>
                <Grid columns={1} verticalAlign='middle' centered={true}>
                        <Grid.Column width={8}>
                            <Image src="/libretexts_logo.png"/>
                            <div className='text-center'>
                                <h1 className='notfound-header'>404</h1>
                                <p>Oops, the page you're looking for does not exist.</p>
                                <p id='notfound-links-container'>
                                    <Link
                                        to='/'
                                        className='notfound-links'
                                    >
                                        Home
                                    </Link>
                                    <span> / </span>
                                    <a
                                        href='https://libretexts.org'
                                        className='notfound-links'
                                        target='_blank'
                                        rel='noopener noreferrer'
                                    >
                                        Main Site
                                    </a>
                                </p>
                            </div>
                        </Grid.Column>
                </Grid>
            </Grid.Column>
        </Grid>
    );
};

export default PageNotFound;
