/**
 * @file Defines a Mongoose schema for storing requests from users to access other,
 *  restricted-access LibreTexts services.
 * @author LibreTexts <info@libretexts.org>
 */

 import mongoose from 'mongoose';

 const AccountRequestSchema = new mongoose.Schema({
   /**
    * Current status of the request.
    */
   status: {
     type: String,
     enum: ['open', 'completed']
   },
   /**
    * Email of the requester.
    */
   email: {
     type: String,
     required: true,
   },
   /**
    * Name of the requester.
    */
   name: {
     type: String,
     required: true
   },
   /**
    * Name of the academic institution the requester belongs to.
    */
   institution: {
     type: String,
     required: true
   },
   /**
    * The LibreTexts service the requester would like access to.
    */
   purpose: {
     type: String,
     required: true,
     enum: ['oer', 'h5p', 'adapt']
   },
   /**
    * URL pointing to a website verifying the requester's status at their
    * academic institution.
    */
   facultyURL: {
     type: String,
     required: true
   },
   /**
    * List of LibreTexts libraries the requester would like access to if `purpose` is `oer`.
    */
   libraries: [String],
   /**
    * Indicates the requester would like more information about the LibreNet.
    */
   moreInfo: Boolean,
   /**
    * UUID of the requester, if they were signed into Conductor during submission.
    */
   requester: String,
 }, {
   timestamps: true
 });
 
 const AccountRequest = mongoose.model('AccountRequest', AccountRequestSchema);
 
 export default AccountRequest;
 