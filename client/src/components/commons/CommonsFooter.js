import './Commons.css';

import {
    Grid,
    Icon,
    Image
} from 'semantic-ui-react';
import React from 'react';

const CommonsFooter = (_props) => {

    return (
        <Grid id='commons-footer' className='mt-4p'>
            {(process.env.REACT_APP_ORG_ID === 'libretexts') &&
                <Grid.Row>
                    <Grid.Column textAlign='center'>
                        <p>The LibreTexts libraries are supported by the United States Department of Education Open Textbook Pilot Project.</p>
                    </Grid.Column>
                </Grid.Row>
            }
            {(process.env.REACT_APP_ORG_ID === 'libretexts') &&
                <Grid.Row>
                    <Grid.Column textAlign='center'>
                        <a className='commons-footer-contactlinks' href='mailto:info@libretexts.org'>Contact Us</a>
                        <a className='commons-footer-contactlinks' href='https://www.facebook.com/LibreTexts/' target='_blank' rel='noopener noreferrer'><Icon name='facebook f'/></a>
                        <a className='commons-footer-contactlinks' href='https://twitter.com/libretexts' target='_blank' rel='noopener noreferrer'><Icon name='twitter'/></a>
                        <a className='commons-footer-contactlinks' href='https://libretexts.org/legal/index.html' target='_blank' rel='noopener noreferrer'>Legal</a>
                        <a className='commons-footer-contactlinks' href='/accessibility' target='_blank' rel='noopener noreferrer'>Accessibility</a>
                    </Grid.Column>
                </Grid.Row>
            }
            {(process.env.REACT_APP_ORG_ID !== 'libretexts') &&
                <Grid.Row>
                    <Grid.Column>
                        <p id='commons-poweredby-tagline' className='text-center'><em>powered by</em></p>
                        <Image
                            src='/transparent_logo.png'
                            size='small'
                            className='cursor-pointer'
                            centered
                            onClick={() => {
                                window.open('https://libretexts.org', '_blank', 'noopener');
                            }}
                        />
                    </Grid.Column>
                </Grid.Row>
            }
        </Grid>
    )
}

export default CommonsFooter;
