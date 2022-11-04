import React from 'react';
import PropTypes from 'prop-types';
import { Button, Form, Header, Icon, Popup } from 'semantic-ui-react';
import DateInput from 'components/DateInput';
import useForm from 'utils/useForm';

/**
 * A reusable form to create an Analytics Course or update its general settings.
 */
const AnalyticsCourseSettingsForm = ({ create, initialState, onSubmit, loading }) => {

  // Data
  const { values, errors, handleChange, handleSubmit } = useForm(
    initialState,
    validateForm,
    onSubmit,
  );

  /**
   * Validates all form fields.
   *
   * @param {object.<string, any>} currValues - The current values of the form fields.
   * @returns {object.<string, any>} Any found errors (with matching field names), or an
   *  empty object if all valid.
   */
  function validateForm(currValues) {
    let newErrors = {};
    if (
      !currValues.courseTitle
      || currValues.courseTitle.trim().length < 1
      || currValues.courseTitle.length > 100
    ) {
      newErrors.courseTitle = true;
    }
    if (
      !currValues.courseTerm
      || currValues.courseTerm.trim().length < 1
      || currValues.courseTerm.length > 100
    ) {
      newErrors.courseTerm = true;
    }
    if (!currValues.courseStart) {
      newErrors.courseStart = true;
    }
    if (!currValues.courseEnd) {
      newErrors.courseEnd = true;
    }
    if (
      currValues.courseStart
      && currValues.courseEnd
      && (
        (currValues.courseStart.getTime() > currValues.courseEnd.getTime())
        || (currValues.courseStart.getTime() === currValues.courseEnd.getTime())
      )
    ) {
      newErrors.courseStart = true;
      newErrors.courseEnd = true;
    }
    if (
      currValues.textbookURL
      && currValues.textbookURL.trim().length < 1
      && !currValues.textbookURL.match(/.libretexts.org/i)
    ) {
      newErrors.textbookURL = true;
    }
    if (
      (!currValues.textbookURL || currValues.textbookURL.trim().length < 1)
      && (!currValues.adaptSharingKey || currValues.adaptSharingKey.trim().length < 1)
    ) {
      newErrors.textbookURL = true;
      newErrors.adaptSharingKey = true;
    }
    return newErrors;
  }

  /**
   * Receives changes in the Course Start Date field and transforms them before passing the
   * object to the form value change handler.
   *
   * @param {Date} value - The new Course Start Date value.
   */
  function handleStartDateChange(value) {
    handleChange({
      target: { value, name: 'courseStart' },
    });
  }

  /**
   * Receives changes in the Course End Date field and transforms them before passing the
   * object to the form value change handler.
   *
   * @param {Date} value - The new Course End Date value.
   */
  function handleEndDateChange(value) {
    handleChange({
      target: { value, name: 'courseEnd' },
    });
  }

  return (
    <Form noValidate onSubmit={handleSubmit}>
      <Header as="h3" className="mt-05e mb-1e">General Information</Header>
      <Form.Input
        fluid
        label="Course Title"
        placeholder="Enter the course title..."
        required
        type="text"
        value={values.courseTitle}
        name="courseTitle"
        onChange={handleChange}
        error={errors.courseTitle}
      />
      <Form.Field error={errors.courseTerm} required>
        <label htmlFor="courseTerm" className="inlineblock-display">Course Term</label>
        <Popup
          position="top center"
          trigger={(
            <span><Icon name="question circle" className="ml-05e cursor-pointer" /></span>
          )}
          content={(
            <p className="text-center">This field depends on your institution's academic year division, e.g., "Fall Quarter 2022"</p>
          )}
        />
        <Form.Input
          id="courseTerm"
          fluid
          placeholder="Enter the course term name..."
          type="text"
          value={values.courseTerm}
          name="courseTerm"
          onChange={handleChange}
        />
      </Form.Field>
      <DateInput
        name="courseStart"
        value={values.courseStart}
        onChange={handleStartDateChange}
        label="Course Start Date"
        className="mb-1e"
        required
        error={errors.courseStart}
      />
      <DateInput
        name="courseEnd"
        value={values.courseEnd}
        onChange={handleEndDateChange}
        label="Course End Date"
        className="mb-1e"
        required
        error={errors.courseEnd}
      />
      <Header as="h3" className="mt-2e mb-1e">Textbook and Homework Configuration</Header>
      <p className={(errors.textbookURL || errors.adaptSharingKey) ? 'form-error-label' : ''}>
        <strong>At least one of the following must be provided to {create ? 'create' : 'update'} your course.</strong>
      </p>
      <Form.Field error={errors.textbookURL}>
        <label htmlFor="textbookURL" className="inlineblock-display">LibreText URL</label>
        <Popup
          position="top center"
          trigger={(
            <span><Icon name="question circle" className="ml-05e cursor-pointer" /></span>
          )}
          content={(
            <p className="text-center">Paste the URL of the main page of your LibreText. Student Analytics must be enabled on the LibreText in order to collect data. For assistance, contact LibreTexts.</p>
          )}
        />
        <Form.Input
          id="textbookURL"
          fluid
          placeholder="Enter a LibreTexts URL..."
          type="url"
          value={values.textbookURL}
          name="textbookURL"
          onChange={handleChange}
        />
      </Form.Field>
      {values.adaptCourseID && (
        <p>
          <strong>Currently linked ADAPT Course:</strong>
          <a
            href={`https://adapt.libretexts.org/instructors/courses/${values.courseID}/properties/details`}
            target="_blank"
            rel="noreferrer"
          >
            {values.adaptCourseID}
          </a>
        </p>
      )}
      <Form.Field error={errors.adaptSharingKey}>
        <label htmlFor="textbookURL" className="inlineblock-display">ADAPT Analytics Sharing Key</label>
        <Popup
          position="top center"
          trigger={(
            <span><Icon name="question circle" className="ml-05e cursor-pointer" /></span>
          )}
          content={(
            <p className="text-center">To view analytics for your ADAPT course, visit your course's Properties page, open the Analytics tab, then paste the provided Analytics Sharing Key here.</p>
          )}
        />
        <Form.Input
          id="adaptSharingKey"
          fluid
          placeholder="Enter your Sharing Key..."
          type="url"
          value={values.adaptSharingKey}
          name="adaptSharingKey"
          onChange={handleChange}
        />
      </Form.Field>
      <Button type="submit" color="green" fluid className="mt-2e" loading={loading}>
        <Icon name={create ? 'plus' : 'save'} />
        {create ? 'Create Course' : 'Save'}
      </Button>
    </Form>
  )
};

AnalyticsCourseSettingsForm.propTypes = {
  /**
   * Indicates the form should be presented as course creation rather than update.
   */
  create: PropTypes.bool,
  /**
   * Initial state to pass to the form.
   */
  initialState: PropTypes.shape({
    courseTitle: PropTypes.string,
    courseTerm: PropTypes.string,
    courseStart: PropTypes.object,
    courseEnd: PropTypes.object,
    textbookURL: PropTypes.string,
    adaptCourseID: PropTypes.string,
    adaptSharingKey: PropTypes.string,
  }),
  /**
   * Handler to activate when the form is submitted. Handler is passed the
   * form state as the first argument.
   */
  onSubmit: PropTypes.func,
  /**
   * Indicates data is being loaded or sent.
   */
  loading: PropTypes.bool,
};

AnalyticsCourseSettingsForm.defaultProps = {
  create: false,
  initialState: {
    courseTitle: '',
    courseTerm: '',
    courseStart: null,
    courseEnd: null,
    textbookURL: '',
    adaptCourseID: '',
    adaptSharingKey: '',
  },
  onSubmit: () => { },
  loading: false,
};

export default AnalyticsCourseSettingsForm;
