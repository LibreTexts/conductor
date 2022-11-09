/**
 * @file Defines a Mongoose schema for storing requests from users to access learning
 *  analytics collected on LibreTexts open-access content.
 * @author LibreTexts <info@libretexts.org>
 */

 import mongoose from 'mongoose';

 const AnalyticsRequestSchema = new mongoose.Schema({
   /**
    * Current status of the request.
    */
   status: {
     type: String,
     enum: ['open', 'approved', 'denied'],
   },
   /**
    * UUID of the requester.
    */
   requester: {
    type: String,
    required: true,
   },
   /**
    * Identifier of the Analytics Course being requested.
    */
   courseID: {
    type: String,
    required: true,
   },
 }, {
   timestamps: true
 });
 
 const AnalyticsRequest = mongoose.model('AnalyticsRequest', AnalyticsRequestSchema);
 
 export default AnalyticsRequest;
 