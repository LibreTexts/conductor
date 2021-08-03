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
            <Grid.Row centered columns={6} verticalAlign='middle' id='commons-sponsor-row'>
                <Grid.Column className='commons-footer-column'>
                    <Image src='/sponsors/CSU_ALS.png' className='commons-footer-widesponsor' centered />
                </Grid.Column>
                <Grid.Column className='commons-footer-column'>
                    <Image src='/sponsors/DOE.png' className='commons-footer-sponsor' centered />
                </Grid.Column>
                <Grid.Column className='commons-footer-column'>
                    <Image src='/sponsors/UCD.png' className='commons-footer-widesponsor' centered/>
                </Grid.Column>
                <Grid.Column className='commons-footer-column'>
                    <Image src='/sponsors/Merlot.png' className='commons-footer-widesponsor' centered />
                </Grid.Column>
                <Grid.Column className='commons-footer-column'>
                    <Image src='/sponsors/NSF.png' className='commons-footer-sponsor' centered />
                </Grid.Column>
                <Grid.Column className='commons-footer-column'>
                    <Image src='/sponsors/UCD_Library.png' className='commons-footer-widesponsor' centered />
                </Grid.Column>
            </Grid.Row>
        </Grid>
    )
}

export default CommonsFooter;
