import {
    Grid,
    Segment,
    Image,
    Header
} from 'semantic-ui-react';
import React, { useEffect } from 'react';

const AccessibilityStatement = (props) => {

    /**
     * Update page title.
     */
    useEffect(() => {
        document.title = "LibreTexts | Accessibility Statement";
    }, []);


    return(
        <Grid centered={true} verticalAlign='middle' className='component-container'>
            <Grid.Row>
                <Grid.Column>
                    <Grid verticalAlign='middle' centered={true}>
                        <Grid.Row>
                            <Grid.Column>
                                <Image
                                    src="/transparent_logo.png"
                                    size='medium'
                                    centered
                                    className='cursor-pointer'
                                    onClick={() => {
                                        window.open('https://libretexts.org', '_blank', 'noopener');
                                    }}
                                    alt="LibreTexts logo"
                                />
                            </Grid.Column>
                        </Grid.Row>
                    </Grid>
                </Grid.Column>
            </Grid.Row>
            <Grid.Row columns={1}>
                <Grid.Column>
                    <Segment raised className='mb-4r'>
                        <Header as='h1'>Accessibility Statement</Header>
                        <p>LibreTexts is committed to ensuring the LibreTexts platform is both accessible and usable by students and content authors.  To that end, the LibreTexts platform is currently undergoing a comprehensive accessibility audit.  The results will be used to update the accessibility conformance documentation for the LibreTexts platform and create a roadmap to address identified accessibility barriers affecting the LibreTexts platform.</p>
                        <p>Our goal is for the LibreTexts platform to meet or exceed the Revised 508 Standards and WCAG 2.1 AA by October 2022.  Updated accessibility conformance documentation will be available by March 2022.  The updated accessibility conformance documentation will include alternative solutions as possible temporary workarounds for identified accessibility barriers.  In the meantime, please report any accessibility concerns related to the LibreTexts platform to <a href='mailto:info@libretexts.org' target='_blank' rel='noopener noreferrer' className='contrast-link'>Information About LibreTexts.</a></p>
                        <p>Please note, LibreTexts provides a variety of content authoring tools and resources for content authors to develop content that is accessible.  However, LibreTexts is not responsible for the accessibility conformance level of specific content contributed by authors.  Accessibility related concerns with specific content should be reported to the content author.</p>
                        <Header as='h2'>Usability Guides</Header>
                        <p>To assist students and content authors, LibreTexts is developing usability guides.  Each guide will also include information about using LibreTexts with assistive technology, such as screen reading software.</p>
                        <p>This information is under development.  Please check back soon.</p>
                        <Header as='h2'>Accessibility Conformance Reports</Header>
                        <p>LibreTexts will report the accessibility conformance for each feature of the LibreTexts platform using an Accessibility Conformance Report (ACR).</p>
                        <ul>
                            <li>ADAPT ACR (coming in October 2021)</li>
                            <li>LibreCommons ACR (coming in October 2021)</li>
                        </ul>
                        <p>Additional information is under development.  Please check back soon.</p>
                        <Header as='h2'>Product Roadmaps</Header>
                        <p>In addition to reporting the accessibility conformance of the LibreTexts platform features, LibreTexts will maintain product roadmaps for each of the LibreTexts features.  The product roadmaps outline the estimated timeframes for identified accessibility barriers in LibreTexts platform features to be fixed.  The actual date by which identified accessibility barriers are fixed may vary from the product roadmap.</p>
                        <ul>
                            <li>ADAPT Product Roadmap (coming in October 2021)</li>
                            <li>LibreCommons Product Roadmap (coming in October 2021)</li>
                        </ul>
                        <p>Additional information is under development.  Please check back soon.</p>
                    </Segment>
                </Grid.Column>
            </Grid.Row>
        </Grid>
    );
};

export default AccessibilityStatement;
