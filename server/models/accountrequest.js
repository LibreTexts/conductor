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
    * UUID of the requester.
    */
   requester: {
    type: String,
    required: true,
   },
   /**
    * The LibreTexts service the requester would like access to.
    */
   purpose: {
     type: String,
     required: true,
     enum: ['oer', 'h5p', 'adapt', 'analytics'],
   },
   /**
    * List of LibreTexts libraries the requester would like access to if `purpose` is `oer`.
    */
   libraries: [String],
   /**
    * Indicates the requester would like more information about the LibreNet.
    */
   moreInfo: Boolean,
 }, {
   timestamps: true
 });
 
 const AccountRequest = mongoose.model('AccountRequest', AccountRequestSchema);
 
 export default AccountRequest;
 