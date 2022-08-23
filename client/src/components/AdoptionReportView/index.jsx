import React from 'react';
import PropTypes from 'prop-types';
import { Button, Grid, Header, Image, Modal } from 'semantic-ui-react';
import date from 'date-and-time';
import ordinal from 'date-and-time/plugin/ordinal';
import {
  capitalizeFirstLetter,
  isEmptyString,
  normalizeURL,
  truncateString,
} from '../util/HelperFunctions';
import { getLibGlyphURL, getLibraryName } from '../util/LibraryOptions';
import {
  buildAccessMethodsList,
  getTermTaughtText,
  getLibreNetConsortiumText,
} from '../adoptionreport/AdoptionReportOptions';

/**
 * Modal tool to view a text Adoption Report submitted to Conductor.
 */
const AdoptionReportView = ({ show, onClose, report }) => {

  date.plugin(ordinal);

  if (!report) {
    return null;
  }

  let formatTime = 'Unknown';
  if (report.createdAt) {
    const createdAt = new Date(report.createdAt);
    formatTime = date.format(createdAt, 'MM/DD/YYYY h:mm A');
  }

  return (
    <Modal open={show} onClose={onClose}>
      <Modal.Header as="h3">
        View Adoption Report - <em>{formatTime}, {capitalizeFirstLetter(report.role)}</em>
      </Modal.Header>
      <Modal.Content scrolling>
        <Grid divided="vertically">
          <Grid.Row columns={3}>
            <Grid.Column>
              <Header sub as="h4">Email</Header>
              <p>{report.email}</p>
            </Grid.Column>
            <Grid.Column>
              <Header sub as="h4">Name</Header>
              <p>{report.name}</p>
            </Grid.Column>
            <Grid.Column>
              <Header sub as="h4">Report Type</Header>
              <p>{capitalizeFirstLetter(report.role)}</p>
            </Grid.Column>
          </Grid.Row>
          <Grid.Row columns={3}>
            <Grid.Column>
              <Header sub as="h4">Resource Title</Header>
              {report.resource?.title ? (
                <p>{report.resource.title}</p>
              ) : (
                <p className="muted-text"><em>Not specified, resource may be linked.</em></p>
              )}
            </Grid.Column>
            <Grid.Column>
              <Header sub as="h4">Resource Library</Header>
              {report.resource?.library ? (
                <div>
                  <Image src={getLibGlyphURL(report.resource.library)} className="library-glyph" />
                  <span>{getLibraryName(report.resource.library)}</span>
                </div>
              ) : (
                <p className="muted-text"><em>Not specified, resource may be linked.</em></p>
              )}
            </Grid.Column>
            <Grid.Column>
              <Header sub as="h4">Resource ID</Header>
              {report.resource?.id ? (
                <p>{report.resource.id}</p>
              ) : (
                <p className="muted-text"><em>Not specified, resource may be linked.</em></p>
              )}
            </Grid.Column>
          </Grid.Row>
          {report.resource?.link && (
            <Grid.Row columns={1}>
              <Grid.Column>
                <Header sub as="h4">Resource Link</Header>
                <a href={normalizeURL(report.resource.link)} target="_blank" rel="noreferrer">
                  {truncateString(report.resource.link, 75)}
                </a>
              </Grid.Column>
            </Grid.Row>
          )}
          <Grid.Row columns={1}>
            <Grid.Column>
              {(report.role === 'instructor') ? (
                <Grid>
                  <Grid.Row columns={2}>
                    <Grid.Column>
                      <Header sub as="h4">LibreNet</Header>
                      <p>{getLibreNetConsortiumText(report.instructor.isLibreNet)}</p>
                    </Grid.Column>
                    <Grid.Column>
                      <Header sub as="h4">Institution Name</Header>
                      <p>{capitalizeFirstLetter(report.instructor.institution)}</p>
                    </Grid.Column>
                  </Grid.Row>
                  <Grid.Row columns={3}>
                    <Grid.Column>
                      <Header sub as="h4">Class Name</Header>
                      <p>{report.instructor.class}</p>
                    </Grid.Column>
                    <Grid.Column>
                      <Header sub as="h4">Term Taught</Header>
                      <p>{getTermTaughtText(report.instructor.term)}</p>
                    </Grid.Column>
                    <Grid.Column>
                      <Header sub as="h4">Number of Students</Header>
                      <p>{report.instructor.students}</p>
                    </Grid.Column>
                  </Grid.Row>
                  <Grid.Row columns={2}>
                    <Grid.Column>
                      <Header sub as="h4">Original Text Cost</Header>
                      {(report.instructor.replaceCost !== 0) ? (
                        <p>{report.instructor.replaceCost}</p>
                      ) : (
                        <p className="muted-text"><em>N/A</em></p>
                      )}
                    </Grid.Column>
                    <Grid.Column>
                      <Header sub as="h4">Printed Cost</Header>
                      {(report.instructor.printCost !== 0) ? (
                        <p>{report.instructor.printCost}</p>
                      ) : (
                        <p className="muted-text"><em>N/A</em></p>
                      )}
                    </Grid.Column>
                  </Grid.Row>
                  <Grid.Row columns={1}>
                    <Grid.Column>
                      <Header sub as="h4">Access Methods</Header>
                      {!isEmptyString(report.instructor.access) ? (
                        <p>{buildAccessMethodsList(report.instructor.access)}</p>
                      ) : (
                        <p className="muted-text"><em>N/A</em></p>
                      )}
                    </Grid.Column>
                  </Grid.Row>
                </Grid>
              ) : (
                <Grid>
                  <Grid.Row columns={3}>
                    <Grid.Column>
                      <Header sub as="h4">Institution Name</Header>
                      {!isEmptyString(report.student?.institution) ? (
                        <p>{report.student.institution}</p>
                      ) : (
                        <p className="muted-text"><em>N/A</em></p>
                      )}
                    </Grid.Column>
                    <Grid.Column>
                      <Header sub as="h4">Class Name</Header>
                      {!isEmptyString(report.student?.class) ? (
                        <p>{report.student.class}</p>
                      ) : (
                        <p className="muted-text"><em>N/A</em></p>
                      )}
                    </Grid.Column>
                    <Grid.Column>
                      <Header sub as="h4">Instructor Name</Header>
                      {!isEmptyString(report.student?.instructor) ? (
                        <p>{report.student.instructor}</p>
                      ) : (
                        <p className="muted-text"><em>N/A</em></p>
                      )}
                    </Grid.Column>
                  </Grid.Row>
                  <Grid.Row columns={3}>
                    <Grid.Column>
                      <Header sub as="h4">Resource Use</Header>
                      {!isEmptyString(report.student?.use) ? (
                        <p>{report.student.use}</p>
                      ) : (
                        <p className="muted-text"><em>N/A</em></p>
                      )}
                    </Grid.Column>
                    <Grid.Column>
                      <Header sub as="h4">Access Methods</Header>
                      {!isEmptyString(report.student?.access) ? (
                        <p>{buildAccessMethodsList(report.student.access)}</p>
                      ) : (
                        <p className="muted-text"><em>N/A</em></p>
                      )}
                    </Grid.Column>
                    <Grid.Column>
                      <Header sub as="h4">Printed Cost</Header>
                      {(report.student?.printCost !== 0) ? (
                        <p>{report.student.printCost}</p>
                      ) : (
                        <p className="muted-text"><em>N/A</em></p>
                      )}
                    </Grid.Column>
                  </Grid.Row>
                  <Grid.Row columns={2}>
                    <Grid.Column>
                      <Header sub as="h4">Content Quality Rating</Header>
                      {(report.student?.quality !== 0) ? (
                        <p>{report.student.quality}</p>
                      ) : (
                        <p className="muted-text"><em>N/A</em></p>
                      )}
                    </Grid.Column>
                    <Grid.Column>
                      <Header sub as="h4">LibreTexts Navigation Rating</Header>
                      {(report.student?.navigation !== 0) ? (
                        <p>{report.student.navigation}</p>
                      ) : (
                        <p className="muted-text"><em>N/A</em></p>
                      )}
                    </Grid.Column>
                  </Grid.Row>
                </Grid>
              )}
            </Grid.Column>
            <Grid.Row columns={1}>
              <Grid.Column>
                <Header sub as="h4">Additional Comments</Header>
                {!isEmptyString(report.comments) ? (
                  <p>{report.comments}</p>
                ) : (
                  <p className="muted-text"><em>N/A</em></p>
                )}
              </Grid.Column>
            </Grid.Row>
          </Grid.Row>
        </Grid>
      </Modal.Content>
      <Modal.Actions>
        <Button color="blue" onClick={onClose}>Done</Button>
      </Modal.Actions>
    </Modal>
  );
};

AdoptionReportView.propTypes = {
  /**
   * Opens or closes the modal.
   */
  show: PropTypes.bool.isRequired,
  /**
   * Handler to activate when the modal is closed.
   */
  onClose: PropTypes.func,
  /**
   * Report data to use in rendering.
   */
  report: PropTypes.shape({
    email: PropTypes.string,
    name: PropTypes.string,
    role: PropTypes.string,
    resource: PropTypes.shape({
      title: PropTypes.string,
      library: PropTypes.string,
      id: PropTypes.string,
      link: PropTypes.string,
    }),
    instructor: PropTypes.shape({
      isLibreNet: PropTypes.string.isRequired,
      institution: PropTypes.string.isRequired,
      class: PropTypes.string.isRequired,
      term: PropTypes.string.isRequired,
      students: PropTypes.number,
      replaceCost: PropTypes.number,
      printCost: PropTypes.number,
      access: PropTypes.arrayOf(PropTypes.string),
    }),
    student: PropTypes.shape({
      institution: PropTypes.string,
      class: PropTypes.string,
      instructor: PropTypes.string,
      use: PropTypes.string,
      access: PropTypes.arrayOf(PropTypes.string),
      printCost: PropTypes.number,
      quality: PropTypes.number,
      navigation: PropTypes.number,
    }),
    comments: PropTypes.string,
  }),
};

AdoptionReportView.defaultProps = {
  onClose: () => { },
  report: null,
};

export default AdoptionReportView;
