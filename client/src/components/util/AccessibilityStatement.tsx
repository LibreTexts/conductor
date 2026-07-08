import {Card, Grid, Heading, Link, Text} from "@libretexts/davis-react";
import React, {useEffect} from 'react';

const AccessibilityStatement = () => {
  useEffect(() => {
    document.title = "LibreTexts | Accessibility Statement";
  }, []);


  return (
    <Grid cols={1} className="component-container">
      <div className="flex justify-center items-center w-full my-4">
        <img src="/transparent_logo.png" alt="LibreTexts" style={{width: '20%'}}/>
      </div>
      <Card className="mb-4">
        <Card.Body>
          <div className="row-span-full">
            <Heading level={1}>Accessibility Statement</Heading>
            <Text size="base" as="p">LibreTexts is committed to ensuring the LibreTexts platform and features are both
              accessible and usable
              by
              students and content authors. To that end, the LibreTexts platform and features undergo comprehensive
              accessibility audits at major development milestones. The results will be used to update the accessibility
              conformance documentation for the LibreTexts platform and features and create a roadmap to address
              identified
              accessibility barriers affecting the LibreTexts platform and features.</Text>
            <Text size="base" as="p"><strong>Our goal is for the LibreTexts platform and features to meet or exceed the
              Revised
              508 Standards
              and
              WCAG 2.1 AA.</strong></Text>
            <Heading level={2}>Hosted Content</Heading>
            <Text size="base" as="p">Please note, LibreTexts provides a variety of content authoring tools and resources
              for
              content authors
              to
              develop content that is accessible. However, LibreTexts is not responsible for the accessibility
              conformance
              level of specific content contributed by authors. Accessibility related concerns with specific content
              should
              be reported to the content author.</Text>
            <Heading level={2}>Reporting Accessibility Barriers and Issues</Heading>
            <Text size="base" as="p">LibreTexts welcomes feedback on barriers to accessibility or issues encountered
              when using
              assistive
              technologies on the platform. To submit a report, please <Link
                href="https://commons.libretexts.org/support/contact?queue=support&category=accessibility">submit a
                Support Ticket</Link> under
              the “Accessibility” category. </Text>
            <Text size="base" as="p">For general support with using the LibreTexts platform, please visit our <Link
              href="https://commons.libretexts.org/support">Support Center</Link>.
            </Text>
            <Heading level={2}>Accessibility Conformance Reports</Heading>
            <Text size="base" as="p">LibreTexts reports the accessibility conformance for the LibreTexts platform and
              each
              feature using an
              Accessibility Conformance Report (ACR).</Text>
            <ul className="list-disc pl-6">
              <li><Text size="base">Academy Online (coming soon)</Text></li>
              <li><Text size="base">ADAPT: </Text><Link
                href="https://chem.libretexts.org/Courses/Remixer_University/LibreVerse_Accessibility_Conformance_Reports/ADAPT_for_Students_Accessibility_Conformance_Report?readerView=">ADAPT
                for Students ACR</Link></li>
              <li><Text size="base">Commons: </Text><Link
                href="https://chem.libretexts.org/Courses/Remixer_University/LibreVerse_Accessibility_Conformance_Reports/Commons_Accessibility_Conformance_Report_July_2026?readerView">LibreCommons
                ACR</Link></li>
              <li><Text size="base">Conductor (coming soon)</Text></li>
              <li><Text size="base">Connections (coming soon)</Text></li>
              <li><Text size="base">Forge (coming soon)</Text></li>
              <li><Text size="base">Jupyter (coming soon)</Text></li>
              <li><Text size="base">LibreTexts Libraries: </Text><Link
                href="https://chem.libretexts.org/Courses/Remixer_University/LibreVerse_Accessibility_Conformance_Reports/LibreTexts_Libraries_Accessibility_Conformance_Report?readerView=">LibreTexts
                Libraries for Students
                ACR</Link></li>
              <li><Text size="base">LibreTexts Store (coming soon)</Text></li>
              <li><Text size="base">Studio: </Text><Link
                href="https://chem.libretexts.org/Courses/Remixer_University/LibreVerse_Accessibility_Conformance_Reports/LibreStudio_Accessibility_Conformance_Report?readerView=">LibreStudio
                ACR</Link>
              </li>
              <li><Text size="base">Support Center (coming soon)</Text></li>
            </ul>
            <Heading level={2}>Usability Guides</Heading>
            <Text size="base" as="p">To assist students and content authors, LibreTexts is developing usability guides.
              Each
              guide will also
              include information about using LibreTexts with assistive technology, such as screen reading
              software.</Text>
            <ul className="list-disc pl-6">
              <li>
                <Text size="base">LibreTexts Libraries</Text>
                <ul className="list-disc pl-6">
                  <li><Link
                    href="https://chem.libretexts.org/Sandboxes/atconsultantnc_at_gmail.com/H5P_Accessible_Alternative_Examples/Container_Boxes_with_Headings?readerView=">Container
                    Boxes with
                    Headings</Link></li>
                </ul>
              </li>
              <li>
                <Text size="base">LibreStudio</Text>
                <ul className="list-disc pl-6">
                  <li><Link href="https://studio.libretexts.org/help/h5p-accessibility-by-activity">Accessibility
                    Reports for H5P Activity
                    Types</Link></li>
                  <li><Link
                    href="https://chem.libretexts.org/Sandboxes/atconsultantnc_at_gmail.com/H5P_Accessible_Alternative_Examples?readerView="
                  >H5P Accessible Alternative
                    Examples</Link></li>
                </ul>
              </li>
            </ul>
            <Text size="sm" as="p" className="text-center muted-text mt-2p">Last updated: June 16th, 2026</Text>
          </div>
        </Card.Body>
      </Card>
    </Grid>
  );
};

export default AccessibilityStatement;
