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
 * Sends a standard Reset Password email to
 * the @recipientAddress, addressed to @recipientName,
 * tied to the @resetLink via the Mailgun API.
 * NOTE: Do NOT use this method directly from a
 *  Conductor API route. Use internally only after
 *  proper verification via other internal methods.
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
 * Sends a standard Welcome email to
 * the @recipientAddress, addressed to @recipientName,
 * via the Mailgun API.
 * NOTE: Do NOT use this method directly from a
 *  Conductor API route. Use internally only after
 *  proper verification via other internal methods.
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
 * Sends a standard Password Change Notification email
 * to the @recipientAddress, addressed to @recipientName,
 * via the Mailgun API.
 * NOTE: Do NOT use this method directly from a
 *  Conductor API route. Use internally only after
 *  proper verification via other internal methods.
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

module.exports = {
    sendPasswordReset,
    sendRegistrationConfirmation,
    sendPasswordChangeNotification
}
