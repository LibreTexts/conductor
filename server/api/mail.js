//
// LibreTexts Conductor
// mail.js
//

const Mailgun = require('mailgun.js');
const formData = require('form-data');
const { debugError } = require('../debug.js');
const conductorErrors = require('../conductor-errors.js');

const mgInstance = new Mailgun(formData);
const mailgun = mgInstance.client({
    username: 'api',
    key: process.env.MAILGUN_API_KEY
});


/**
 * Sends a standard Reset Password email to a user via the Mailgun API.
 * NOTE: Do NOT use this method directly from a Conductor API route. Use internally
 *  only after proper verification via other internal methods.
 * @param {string} recipientAddress  - the user's email address
 * @param {string} recipientName     - the user's name ('firstName' or 'firstName lastName')
 * @param {string} resetLink         - the URL to use the access the reset form with token
 * @returns {Promise<Object|Error>} a Mailgun API promise
 */
const sendPasswordReset = (recipientAddress, recipientName, resetLink) => {
    return mailgun.messages.create(process.env.MAILGUN_DOMAIN, {
        from: 'LibreTexts Conductor <conductor@noreply.libretexts.org>',
        to: [recipientAddress],
        subject: 'Reset Your Conductor Password',
        text: `Hi ${recipientName}, we received a request to reset your Conductor password. Please follow this link to reset your password: ${resetLink}. This link will expire in 30 minutes. If you did not initiate this request, you can ignore this email. Sincerely, The LibreTexts team`,
        html: `<p>Hi ${recipientName},</p><p>We received a request to reset your Conductor password. Please follow this link to reset your password:</p><a href='${resetLink}' target='_blank' rel='noopener noreferrer'>Reset Conductor Password</a><p>This link will expire in 30 minutes. If you did not initiate this request, you can ignore this email.</p><p>Sincerely,</p><p>The LibreTexts team</p>`
    });
};


/**
 * Sends a standard Welcome email to a user via the Mailgun API.
 * NOTE: Do NOT use this method directly from a Conductor API route. Use internally
 *  only after proper verification via other internal methods.
 * @param {string} recipientAddress  - the user's email address
 * @param {string} recipientName     - the user's name ('firstName' or 'firstName lastName')
 * @returns {Promise<Object|Error>} a Mailgun API promise
 */
const sendRegistrationConfirmation = (recipientAddress, recipientName) => {
    return mailgun.messages.create(process.env.MAILGUN_DOMAIN, {
        from: 'LibreTexts Conductor <conductor@noreply.libretexts.org>',
        to: [recipientAddress],
        subject: 'Welcome to Conductor',
        text: `Hi ${recipientName}, welcome to Conductor! You can access your account using this email and the password you set during registration. Remember, Conductor accounts are universal — you can use this account on any Conductor instance in the LibreNet. Sincerely, The LibreTexts team`,
        html: `<p>Hi ${recipientName},</p><h2>Welcome to Conductor!</h2><p>You can access your account using your email and the password you set during registration.</p><p><em>Remember, Conductor accounts are universal — you can use this account on any Conductor instance in the LibreNet.</em></p><p>Sincerely,</p><p>The LibreTexts team</p>`
    })
};


/**
 * Sends a standard Password Change Notification email to a user via the Mailgun API.
 * NOTE: Do NOT use this method directly from a Conductor API route. Use internally
 *  only after proper verification via other internal methods.
 * @param {string} recipientAddress  - the user's email address
 * @param {string} recipientName     - the user's name ('firstName' or 'firstName lastName')
 * @returns {Promise<Object|Error>} a Mailgun API promise
 */
const sendPasswordChangeNotification = (recipientAddress, recipientName) => {
    return mailgun.messages.create(process.env.MAILGUN_DOMAIN, {
        from: 'LibreTexts Conductor <conductor@noreply.libretexts.org>',
        to: [recipientAddress],
        subject: 'Conductor Password Updated',
        text: `Hi ${recipientName}, You're receiving this email because your Conductor password was recently updated via the Conductor web application. If this was you, you can safely ignore this message. If this wasn't you, please reach out to us as soon as possible at info@libretexts.org. Sincerely, The LibreTexts team`,
        html: `<p>Hi ${recipientName},</p><p>You're receiving this email because your Conductor password was recently updated via the Conductor web application.</p><p>If this was you, you can safely ignore this message. If this wasn't you, please reach out to us as soon as possible at <a href='mailto:info@libretexts.org?subject=Unauthorized%20Conductor%20Password%20Change' target='_blank' rel='noopener noreferrer'>info@libretexts.org</a>.</p><p>Sincerely,</p><p>The LibreTexts team</p>`
    })
};


/**
 * Sends a standard Added as Collaborator email to a user via the Mailgun API.
 * NOTE: Do NOT use this method directly from a Conductor API route. Use internally
 *  only after proper verification via other internal methods.
 * @param {string} recipientAddress  - the newly added user's email address
 * @param {string} recipientName     - the newly added user's name ('firstName' or 'firstName lastName')
 * @param {string} projectID         - the internal project identifier string
 * @param {string} projectName       - the project's title/name
 * @returns {Promise<Object|Error>} a Mailgun API Promise
 */
const sendAddedAsCollaboratorNotification = (recipientAddress, recipientName, projectID, projectName) => {
    return mailgun.messages.create(process.env.MAILGUN_DOMAIN, {
        from: 'LibreTexts Conductor <conductor@noreply.libretexts.org>',
        to: [recipientAddress],
        subject: `Added as Collaborator: ${projectName}`,
        text: `Hi ${recipientName}, You're receiving this email because you were added as a collaborator in the "${projectName}" project on the LibreTexts Conductor Platform. You can access this project by visiting ${process.env.LIBRE_SUBDOMAIN}.libretexts.org and opening the Projects tab. Sincerely, The LibreTexts team`,
        html: `<p>Hi ${recipientName},</p><p>You're receiving this email because you were added as a collaborator in the <a href='http://${process.env.LIBRE_SUBDOMAIN}.libretexts.org/projects/${projectID}' target='_blank' rel='noopener noreferrer'>${projectName}</a> project on the LibreTexts Conductor Platform.</p>You can access this project by clicking the project's name in this email, or by visiting <a href='http://${process.env.LIBRE_SUBDOMAIN}.libretexts.org' target='_blank' rel='noopener noreferrer'>Conductor</a> and opening the Projects tab.</p><p>Sincerely,</p><p>The LibreTexts team</p>`
    });
};


module.exports = {
    sendPasswordReset,
    sendRegistrationConfirmation,
    sendPasswordChangeNotification,
    sendAddedAsCollaboratorNotification
}
