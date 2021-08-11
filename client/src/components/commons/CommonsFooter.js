import './Commons.css';

import { Grid, Image, Icon } from 'semantic-ui-react';
import React from 'react';

const CommonsFooter = (_props) => {

    return (
        <Grid id='commons-footer'>
            <Grid.Row>
                <Grid.Column textAlign='center'>
                    <p>The LibreTexts libraries are supported by the Department of Education Open Textbook Pilot Project, the UC Davis Office of the Provost, the UC Davis Library, the California State University Affordable Learning Solutions Program, and Merlot. We also acknowledge previous National Science Foundation support under grant numbers 1246120, 1525057, and 1413739. Unless otherwise noted, LibreTexts content is licensed by <a href='http://creativecommons.org/licenses/by-nc-sa/3.0/us/' target='_blank' rel='noopener noreferrer'>CC BY-NC-SA 3.0.</a></p>
                </Grid.Column>
            </Grid.Row>
            <Grid.Row>
                <Grid.Column textAlign='center'>
                    <a className='commons-footer-contactlinks' href='mailto:info@libretexts.org'>Contact Us</a>
                    <a className='commons-footer-contactlinks' href='https://www.facebook.com/LibreTexts/' target='_blank' rel='noopener noreferrer'><Icon name='facebook f'/></a>
                    <a className='commons-footer-contactlinks' href='https://twitter.com/libretexts' target='_blank' rel='noopener noreferrer'><Icon name='twitter'/></a>
                    <a className='commons-footer-contactlinks' href='https://libretexts.org/legal/index.html' rel='noopener noreferrer'>Legal</a>
                </Grid.Column>
            </Grid.Row>
            <Grid.Row centered verticalAlign='middle' id='commons-sponsor-row' >
                <Grid.Column className='commons-footer-column' computer={3} tablet={6} as='a' href='https://als.csuprojects.org/' target='_blank' rel='noopener noreferrer'>
                    <Image src='/sponsors/CSU_ALS.png' className='commons-footer-widesponsor' centered  />
                </Grid.Column>
                <Grid.Column className='commons-footer-column' computer={2} tablet={4} as='a' href='https://www.ed.gov/news/press-releases/us-department-education-awards-49-million-grant-university-california-davis-develop-free-open-textbooks-program' target='_blank' rel='noopener noreferrer'>
                    <Image src='/sponsors/DOE.png' className='commons-footer-sponsor' centered  />
                </Grid.Column>
                <Grid.Column className='commons-footer-column' computer={3} tablet={6} as='a' href='https://www.ucdavis.edu/' target='_blank' rel='noopener noreferrer' >
                    <Image src='/sponsors/UCD.png' className='commons-footer-widesponsor' centered />
                </Grid.Column>
                <Grid.Column className='commons-footer-column' computer={3} tablet={6} as='a' href='https://www.merlot.org/merlot/index.htm' target='_blank' rel='noopener noreferrer'>
                    <Image src='/sponsors/Merlot.png' className='commons-footer-widesponsor' centered />
                </Grid.Column>
                <Grid.Column className='commons-footer-column' computer={2} tablet={4} as='a' href='https://www.nsf.gov/awardsearch/showAward?AWD_ID=1525057' target='_blank' rel='noopener noreferrer'>
                    <Image src='/sponsors/NSF.png' className='commons-footer-sponsor' centered />
                </Grid.Column>
                <Grid.Column className='commons-footer-column' computer={3} tablet={6} as='a' href='https://www.library.ucdavis.edu/' target='_blank' rel='noopener noreferrer'>
                    <Image src='/sponsors/UCD_Library.png' className='commons-footer-widesponsor' centered />
                </Grid.Column>
            </Grid.Row>
        </Grid>
    )
}

export default CommonsFooter;
