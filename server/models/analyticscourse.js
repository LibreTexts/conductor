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
   * Course status, used to identify courses needing approval by the LibreTexts team. 
   */
  status: {
    type: String,
    required: true,
    enum: ['pending', 'active'],
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
   * BookID of the LibreText for this course.
   */
  textbookID: String,
  /**
   * The URL of the desired LibreText, when awaiting approval by the LibreTexts team.
   */
  pendingTextbookURL: String,
  /**
   * The BookID of the desired LibreText, when awaiting approval by the LibreTexts team.
   */
  pendingTextbookID: String,
  /**
   * Indicates the LibreTexts team denied access to the requested LibreText analytics stream.
   */
  textbookDenied: Boolean,
  /**
   * Identifier of the ADAPT course related to this Analytics Course.
   */
  adaptCourseID: String,
  /**
   * UUID of the user that initially created the course.
   */
  creator: {
    type: String,
    required: true,
  },
  /**
   * Users who have access to view course data and modify its settings (UUIDs).
   */
  instructors: [String],
  /**
   * Users who have access to view course data (UUIDs).
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
