/**
 * @file Defines a Mongoose schema for storing Analytics "Courses" that instructors use to
 *  access LibreTexts Analytics Dashboard(s).
 * @author LibreTexts <info@libretexts.org>
 */
import mongoose from 'mongoose';

const AnalyticsCourseSchema = new mongoose.Schema({
  /**
   * Unique internal identifier of the course.
   */
  courseID: {
    type: String,
    required: true,
    index: true,
  },
  /**
   * Type(s) of data being collected for this course.
   */
  types: {
    type: [String],
    enum: ['learning'],
  },
  /**
   * UI title of the course.
   */
  title: {
    type: String,
    required: true,
  },
  /**
   * UI title of the academic year term the course is registered in.
   * Varies by instructor and institution.
   */
  term: {
    type: String,
    required: true,
  },
  /**
   * Start date of the course.
   */
  start: {
    type: Date,
    required: true,
  },
  /**
   * End date of the course.
   */
  end: {
    type: Date,
    required: true,
  },
  /**
   * URL of the LibreText that has student analytics enabled (coverpage).
   */
  textbookURL: String,
  /**
   * BookID of the LibreText for this course. Internal use only.
   */
  textbookID: String,
  /**
   * Identifier of the ADAPT course related to this Analytics Course.
   */
  adaptCourseID: String,
  /**
   * Users who have access to view course data and modify its settings (UUIDs).
   */
  instructors: [String],
  /**
   * Users who have access to view course data.
   */
  viewers: [String],
  /**
   * Students who are registered in the course and should be listed in the Analytics Dashboard(s).
   */
  students: [{
    firstName: {
      type: String,
      required: true,
    },
    lastName: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
    },
  }],
}, {
  timestamps: true,
});

const AnalyticsCourse = mongoose.model('AnalyticsCourse', AnalyticsCourseSchema);

export default AnalyticsCourse;
