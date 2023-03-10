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
                                    alt="LibreTexts"
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
                        <p>LibreTexts is committed to ensuring the LibreTexts platform and features are both accessible and usable by students and content authors. To that end, the LibreTexts platform and features are currently undergoing a comprehensive accessibility audit. The results will be used to update the accessibility conformance documentation for the LibreTexts platform and features and create a roadmap to address identified accessibility barriers affecting the LibreTexts platform and features.</p>
                        <p>Our goal is for the LibreTexts platform and features to meet or exceed the Revised 508 Standards and WCAG 2.1 AA. Accessibility conformance documentation is now available. Please report any accessibility concerns related to the LibreTexts platform and features to <a href='mailto:info@libretexts.org' target='_blank' rel='noopener noreferrer' className='contrast-link'>Information About LibreTexts</a>.</p>
                        <p>Please note, LibreTexts provides a variety of content authoring tools and resources for content authors to develop content that is accessible. However, LibreTexts is not responsible for the accessibility conformance level of specific content contributed by authors. Accessibility related concerns with specific content should be reported to the content author.</p>
                        <Header as='h2'>Accessibility Conformance Reports</Header>
                        <p>LibreTexts reports the accessibility conformance for the LibreTexts platform and each feature using an Accessibility Conformance Report (ACR).</p>
                        <ul>
                            <li>LibreTexts Libraries
                                <ul>
                                    <li><a href='https://chem.libretexts.org/Courses/Remixer_University/LibreVerse_Accessibility_Conformance_Reports/LibreTexts_Libraries_Accessibility_Conformance_Report?readerView=' target='_blank' rel='noopener noreferrer'>LibreTexts Libraries for Students ACR (March 2023)</a></li>
                                </ul>
                            </li>
                            <li>ADAPT
                                <ul>
                                    <li><a href='https://chem.libretexts.org/Courses/Remixer_University/LibreVerse_Accessibility_Conformance_Reports/ADAPT_for_Students_Accessibility_Conformance_Report?readerView=' target='_blank' rel='noopener noreferrer'>ADAPT for Students ACR</a></li>
                                </ul>
                            </li>
                            <li>LibreCommons
                                <ul>
                                    <li><a href='https://chem.libretexts.org/Courses/Remixer_University/LibreVerse_Accessibility_Conformance_Reports/LibreCommons_Accessibility_Conformance_Report?readerView=' target='_blank' rel='noopener noreferrer'>LibreCommons ACR</a></li>
                                    <li>Conductor ACR (coming soon)</li>
                                </ul>
                            </li>
                            <li>LibreStudio
                                <ul>
                                    <li><a href='https://chem.libretexts.org/Courses/Remixer_University/LibreVerse_Accessibility_Conformance_Reports/LibreStudio_Accessibility_Conformance_Report?readerView=' target='_blank' rel='noopener noreferrer'>LibreStudio ACR</a></li>
                                    <li>LibreStudio H5P Content Authoring Tool ACR (coming soon)</li>
                                </ul>
                            </li>
                        </ul>
                        <p>Additional information is under development. Please check back soon.</p>
                        <Header as='h2'>Usability Guides</Header>
                        <p>To assist students and content authors, LibreTexts is developing usability guides. Each guide will also include information about using LibreTexts with assistive technology, such as screen reading software.</p>
                        <ul>
                            <li>LibreTexts Libraries
                                <ul>
                                    <li><a href='https://chem.libretexts.org/Sandboxes/atconsultantnc_at_gmail.com/H5P_Accessible_Alternative_Examples/Container_Boxes_with_Headings?readerView=' target='_blank' rel='noopener noreferrer'>Container Boxes with Headings</a></li>
                                </ul>
                            </li>
                            <li>LibreStudio
                                <ul>
                                    <li><a href='https://studio.libretexts.org/help/h5p-accessibility-by-activity' target='_blank' rel='noopener noreferrer'>Accessibility Reports for H5P Activity Types</a></li>
                                    <li><a href='https://chem.libretexts.org/Sandboxes/atconsultantnc_at_gmail.com/H5P_Accessible_Alternative_Examples?readerView=' target='_blank' rel='noopener noreferrer'>H5P Accessible Alternative Examples</a></li>
                                </ul>
                            </li>
                        </ul>
                        <p>This information is under development. Please check back soon. </p>
                        <Header as='h2'>Product Roadmaps</Header>
                        <p>In addition to reporting the accessibility conformance of the LibreTexts platform and features, LibreTexts is developing individual product roadmaps for the LibreTexts platform and features. The product roadmaps will outline the estimated timeframes for identified accessibility barriers in LibreTexts platform features to be fixed. The actual date by which identified accessibility barriers are fixed may vary from the product roadmap.</p>
                        <p>Additional information is under development. Please check back soon.</p>
                        <p className="text-center muted-text mt-2p">Last updated: March 9th, 2023</p>
                    </Segment>
                </Grid.Column>
            </Grid.Row>
        </Grid>
    );
};

export default AccessibilityStatement;
