import React from "react";
import PropTypes from "prop-types";
import { Avatar, Button, Heading, Modal, Text } from "@libretexts/davis-react";
import date from "date-and-time";
import {
  capitalizeFirstLetter,
  isEmptyString,
  normalizeURL,
  truncateString,
} from "../util/HelperFunctions";
import { getLibGlyphURL, getLibraryName } from "../util/LibraryOptions";
import {
  buildAccessMethodsList,
  getTermTaughtText,
  getLibreNetConsortiumText,
} from "../adoptionreport/AdoptionReportOptions";

const Field = ({ label, children }) => (
  <div>
    <Heading level={4} className="!mb-2 text-sm font-semibold text-gray-700">
      {label}
    </Heading>
    <div>{children}</div>
  </div>
);

Field.propTypes = {
  label: PropTypes.string.isRequired,
  children: PropTypes.node.isRequired,
};

const EmptyValue = ({ children = "N/A" }) => (
  <Text className="text-gray-500">
    <em>{children}</em>
  </Text>
);

EmptyValue.propTypes = {
  children: PropTypes.node,
};

/**
 * Modal tool to view a text Adoption Report submitted to Conductor.
 */
const AdoptionReportView = ({ show, onClose, report }) => {
  if (!report) {
    return null;
  }

  let formatTime = "Unknown";
  if (report.createdAt) {
    const createdAt = new Date(report.createdAt);
    formatTime = date.format(createdAt, "MM/DD/YYYY h:mm A");
  }

  const renderLibrary = () => {
    if (!report.resource?.library) {
      return <EmptyValue>Not specified, resource may be linked.</EmptyValue>;
    }

    return (
      <div className="flex items-center gap-2">
        <Avatar src={getLibGlyphURL(report.resource.library)} alt="" size="xs" />
        <span>{getLibraryName(report.resource.library)}</span>
      </div>
    );
  };

  const renderResourceTitle = () => {
    if (!report.resource?.title) {
      return <EmptyValue>Not specified, resource may be linked.</EmptyValue>;
    }

    return <p>{report.resource.title}</p>;
  };

  const renderResourceId = () => {
    if (!report.resource?.id) {
      return <EmptyValue>Not specified, resource may be linked.</EmptyValue>;
    }

    return <p>{report.resource.id}</p>;
  };

  return (
    <Modal open={show} onClose={() => onClose(false)} size="xl">
      <Modal.Header>
        <Modal.Title>
          View Adoption Report
        </Modal.Title>
        <Modal.Description>
          <em>{formatTime}, {capitalizeFirstLetter(report.role)}</em>
        </Modal.Description>
      </Modal.Header>

      <Modal.Body className="max-h-[80vh] overflow-y-auto">
        <div className="space-y-8">
          <div className="grid gap-6 md:grid-cols-3">
            <Field label="Email">
              <p>{report.email}</p>
            </Field>
            <Field label="Name">
              <p>{report.name}</p>
            </Field>
            <Field label="Report Type">
              <p>{capitalizeFirstLetter(report.role)}</p>
            </Field>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            <Field label="Resource Title">
              {renderResourceTitle()}
            </Field>
            <Field label="Resource Library">
              {renderLibrary()}
            </Field>
            <Field label="Resource ID">
              {renderResourceId()}
            </Field>
          </div>

          {report.resource?.link && (
            <div className="grid gap-6 md:grid-cols-1">
              <Field label="Resource Link">
                <a href={normalizeURL(report.resource.link)} target="_blank" rel="noreferrer">
                  {truncateString(report.resource.link, 75)}
                </a>
              </Field>
            </div>
          )}

          {report.role === "instructor" ? (
            <div className="space-y-6">
              <div className="grid gap-6 md:grid-cols-2">
                <Field label="LibreNet">
                  <p>{getLibreNetConsortiumText(report.instructor.isLibreNet)}</p>
                </Field>
                <Field label="Institution Name">
                  <p>{capitalizeFirstLetter(report.instructor.institution)}</p>
                </Field>
              </div>

              <div className="grid gap-6 md:grid-cols-3">
                <Field label="Class Name">
                  <p>{report.instructor.class}</p>
                </Field>
                <Field label="Term Taught">
                  <p>{getTermTaughtText(report.instructor.term)}</p>
                </Field>
                <Field label="Number of Students">
                  <p>{report.instructor.students}</p>
                </Field>
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                <Field label="Original Text Cost">
                  {report.instructor.replaceCost !== 0 ? (
                    <p>{report.instructor.replaceCost}</p>
                  ) : (
                    <EmptyValue />
                  )}
                </Field>
                <Field label="Printed Cost">
                  {report.instructor.printCost !== 0 ? (
                    <p>{report.instructor.printCost}</p>
                  ) : (
                    <EmptyValue />
                  )}
                </Field>
              </div>

              <div className="grid gap-6 md:grid-cols-1">
                <Field label="Access Methods">
                  {!isEmptyString(report.instructor.access) ? (
                    <p>{buildAccessMethodsList(report.instructor.access)}</p>
                  ) : (
                    <EmptyValue />
                  )}
                </Field>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="grid gap-6 md:grid-cols-3">
                <Field label="Institution Name">
                  {!isEmptyString(report.student?.institution) ? (
                    <p>{report.student.institution}</p>
                  ) : (
                    <EmptyValue />
                  )}
                </Field>
                <Field label="Class Name">
                  {!isEmptyString(report.student?.class) ? (
                    <p>{report.student.class}</p>
                  ) : (
                    <EmptyValue />
                  )}
                </Field>
                <Field label="Instructor Name">
                  {!isEmptyString(report.student?.instructor) ? (
                    <p>{report.student.instructor}</p>
                  ) : (
                    <EmptyValue />
                  )}
                </Field>
              </div>

              <div className="grid gap-6 md:grid-cols-3">
                <Field label="Resource Use">
                  {!isEmptyString(report.student?.use) ? (
                    <p>{report.student.use}</p>
                  ) : (
                    <EmptyValue />
                  )}
                </Field>
                <Field label="Access Methods">
                  {!isEmptyString(report.student?.access) ? (
                    <p>{buildAccessMethodsList(report.student.access)}</p>
                  ) : (
                    <EmptyValue />
                  )}
                </Field>
                <Field label="Printed Cost">
                  {report.student?.printCost !== 0 ? (
                    <p>{report.student.printCost}</p>
                  ) : (
                    <EmptyValue />
                  )}
                </Field>
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                <Field label="Content Quality Rating">
                  {report.student?.quality !== 0 ? (
                    <p>{report.student.quality}</p>
                  ) : (
                    <EmptyValue />
                  )}
                </Field>
                <Field label="LibreTexts Navigation Rating">
                  {report.student?.navigation !== 0 ? (
                    <p>{report.student.navigation}</p>
                  ) : (
                    <EmptyValue />
                  )}
                </Field>
              </div>
            </div>
          )}

          <div className="grid gap-6 md:grid-cols-1">
            <Field label="Additional Comments">
              {!isEmptyString(report.comments) ? (
                <p>{report.comments}</p>
              ) : (
                <EmptyValue />
              )}
            </Field>
          </div>
        </div>
      </Modal.Body>

      <Modal.Footer>
        <Button variant="primary" onClick={() => onClose(false)}>
          Done
        </Button>
      </Modal.Footer>
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
  onClose: () => {},
  report: null,
};

export default AdoptionReportView;
