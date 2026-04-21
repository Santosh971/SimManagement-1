const nodemailer = require('nodemailer');
const config = require('../config');
const logger = require('./logger');

class EmailService {
  constructor() {
    this.transporter = null;
    this.isConfigured = false;
    this.connectionVerified = false;
    this.init();
  }

  init() {
    // Get email config and clean up values
    const emailHost = config.email.host;
    const emailPort = config.email.port;
    const emailUser = config.email.user;
    // Remove spaces from App Password (Gmail App Passwords often have spaces for readability)
    const emailPass = config.email.pass ? config.email.pass.replace(/\s/g, '') : null;
    const emailFrom = config.email.from;

    // Log configuration for debugging (hide password)
    logger.info('Email configuration check', {
      hasHost: !!emailHost,
      host: emailHost,
      port: emailPort,
      hasUser: !!emailUser,
      user: emailUser,
      hasPass: !!emailPass,
      passLength: emailPass ? emailPass.length : 0,
      hasFrom: !!emailFrom,
    });

    // Check if email configuration is present
    if (!emailHost || !emailUser || !emailPass) {
      logger.warn('Email configuration is incomplete. Email notifications will be disabled.', {
        hasHost: !!emailHost,
        hasUser: !!emailUser,
        hasPass: !!emailPass,
      });
      return;
    }

    try {
      this.transporter = nodemailer.createTransport({
        host: emailHost,
        port: emailPort,
        secure: emailPort === 465,
        auth: {
          user: emailUser,
          pass: emailPass,
        },
        // Additional options for better reliability
        connectionTimeout: 5000, // 5 seconds (reduced for faster startup)
        socketTimeout: 5000, // 5 seconds
        tls: {
          rejectUnauthorized: process.env.NODE_ENV === 'production',
        },
      });

      this.isConfigured = true;
      logger.info('Email service initialized successfully', {
        host: emailHost,
        port: emailPort,
        user: emailUser,
      });

      // Verify connection asynchronously (don't block startup)
      this.verifyConnectionAsync();
    } catch (error) {
      logger.error('Failed to initialize email service', { error: error.message });
    }
  }

  /**
   * Verify connection asynchronously without blocking startup
   */
  verifyConnectionAsync() {
    // Run verification in background
    this.verifyConnection().catch(err => {
      // Log but don't throw - app should still work
      logger.warn('Email connection could not be established. Email delivery may fail.', {
        error: err.message,
        code: err.code,
        note: 'On cloud platforms (Render, Heroku, etc.), SMTP ports are often blocked. Consider using SendGrid, Mailgun, or Amazon SES for production.',
      });
    });
  }

  async verifyConnection() {
    if (!this.transporter) {
      logger.warn('Cannot verify email connection: transporter not initialized');
      return false;
    }

    try {
      await this.transporter.verify();
      this.connectionVerified = true;
      logger.info('Email transporter verified successfully - emails will be sent');
      return true;
    } catch (error) {
      this.connectionVerified = false;

      // Provide helpful error messages based on error type
      if (error.code === 'ETIMEDOUT' || error.code === 'ECONNREFUSED') {
        logger.warn('Email connection timeout - SMTP may be blocked on this platform', {
          host: config.email.host,
          port: config.email.port,
          solution: 'Consider using SendGrid, Mailgun, Amazon SES, or Gmail API instead of SMTP for production',
        });
      } else if (error.message.includes('Invalid login') || error.message.includes('535') || error.code === 'EAUTH') {
        logger.error('GMAIL AUTHENTICATION ERROR - Please fix:');
        logger.error('Gmail requires App Password for SMTP. Steps:');
        logger.error('1. Go to https://myaccount.google.com/');
        logger.error('2. Enable 2-Step Verification');
        logger.error('3. Go to Security > App passwords');
        logger.error('4. Create new App password for "Mail"');
        logger.error('5. Use the 16-character password as SMTP_PASS');
      } else {
        logger.warn('Email transporter verification failed', {
          error: error.message,
          code: error.code,
        });
      }

      return false;
    }
  }

  async sendEmail({ to, subject, html, text }) {
    // Check if email is configured
    if (!this.isConfigured || !this.transporter) {
      logger.warn('Email not sent: Email service not configured', { to, subject });
      return { success: false, error: 'Email service not configured' };
    }

    // Validate email address
    if (!to || !to.includes('@')) {
      logger.error('Invalid email address', { to });
      return { success: false, error: 'Invalid email address' };
    }

    try {
      const mailOptions = {
        from: config.email.from || config.email.user,
        to,
        subject,
        html,
        text: text || html.replace(/<[^>]*>/g, ''),
      };

      logger.info('Sending email', { to, subject });

      const info = await this.transporter.sendMail(mailOptions);

      logger.info('Email sent successfully', {
        messageId: info.messageId,
        to,
        subject,
        response: info.response
      });

      return { success: true, messageId: info.messageId };
    } catch (error) {
      logger.error('Failed to send email', {
        error: error.message,
        to,
        subject,
        code: error.code
      });
      return { success: false, error: error.message };
    }
  }

  // Send welcome email to new user/admin
  async sendWelcomeEmail(user, company, tempPassword = null) {
    const subject = `Welcome to SIM Management - ${company.name}`;
    const loginUrl = config.app.frontendUrl ? `${config.app.frontendUrl}/login` : 'http://localhost:3000/login';

    let passwordSection = '';
    if (tempPassword) {
      passwordSection = `
        <div style="background: #f0fdf4; border: 2px solid #16a34a; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 0 0 10px 0; color: #16a34a; font-weight: 600;">Your Auto-Generated Password:</p>
          <p style="margin: 0; font-size: 20px; font-family: monospace; background: #fff; padding: 10px; border-radius: 4px; border: 1px solid #e5e7eb; text-align: center; letter-spacing: 2px;">${tempPassword}</p>
          <p style="margin: 10px 0 0 0; color: #dc2626; font-size: 14px;">⚠️ Please change your password after first login for security.</p>
        </div>
      `;
    }

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #374151; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #2563eb, #1d4ed8); color: white; padding: 30px; border-radius: 10px 10px 0 0; text-align: center; }
          .content { background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px; }
          .button { display: inline-block; padding: 12px 24px; background: #2563eb; color: white; text-decoration: none; border-radius: 6px; margin: 20px 0; }
          .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 style="margin: 0;">Welcome to SIM Management</h1>
          </div>
          <div class="content">
            <h2>Hello ${user.name},</h2>
            <p>Your account has been created for <strong>${company.name}</strong>.</p>
            <p><strong>Account Details:</strong></p>
            <ul>
              <li><strong>Email:</strong> ${user.email}</li>
              <li><strong>Role:</strong> ${user.role || 'User'}</li>
            </ul>
            ${passwordSection}
            <p>You can now log in to your dashboard to manage your SIM cards and services.</p>
            ${tempPassword ? '<p><strong>First time login?</strong> Use the password shown above. You will be prompted to set a new password for security.</p>' : ''}
            <a href="${loginUrl}" class="button">Login to Dashboard</a>
            <p>If you have any questions, please contact your administrator.</p>
          </div>
          <div class="footer">
            <p>Best regards,<br>SIM Management Team</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return this.sendEmail({ to: user.email, subject, html });
  }

  // Send company creation notification
  async sendCompanyCreatedEmail(company, admin) {
    const subject = `New Company Registered - ${company.name}`;
    const dashboardUrl = config.app.frontendUrl ? `${config.app.frontendUrl}/dashboard` : 'http://localhost:3000/dashboard';

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #374151; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #16a34a, #15803d); color: white; padding: 30px; border-radius: 10px 10px 0 0; text-align: center; }
          .content { background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px; }
        .button { 
  display: inline-block; 
  padding: 12px 24px; 
  background: #2563eb; 
  color: white; 
  text-decoration: none; 
  border-radius: 6px; 
  margin: 20px 0;
  font-weight: 600;
}
          .info-box { background: #f1f5f9; padding: 15px; border-radius: 6px; margin: 15px 0; }
          .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 style="margin: 0;">Company Registration Successful</h1>
          </div>
          <div class="content">
            <h2>Congratulations!</h2>
            <p>Your company <strong>${company.name}</strong> has been successfully registered on SIM Management platform.</p>
            <div class="info-box">
              <p style="margin: 0;"><strong>Company Details:</strong></p>
              <p style="margin: 10px 0 0 0;">Email: ${company.email}</p>
              <p style="margin: 5px 0;">Subscription Valid Until: ${company.subscriptionEndDate ? new Date(company.subscriptionEndDate).toDateString() : 'N/A'}</p>
            </div>
            <p>You can now start managing your SIM cards and services.</p>
            <a href="${dashboardUrl}" class="button">Go to Dashboard</a>
            <p>If you have any questions, please contact our support team.</p>
          </div>
          <div class="footer">
            <p>Best regards,<br>SIM Management Team</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return this.sendEmail({ to: company.email, subject, html });
  }

  // Send SIM assignment notification
  async sendSimAssignmentEmail(user, sim, assignedBy) {
    const subject = `SIM Card Assigned to You - ${sim.mobileNumber}`;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #374151; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #2563eb, #1d4ed8); color: white; padding: 30px; border-radius: 10px 10px 0 0; text-align: center; }
          .content { background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px; }
          .sim-card { background: #f1f5f9; padding: 20px; border-radius: 8px; margin: 20px 0; }
          .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 style="margin: 0;">SIM Card Assignment</h1>
          </div>
          <div class="content">
            <h2>Hello ${user.name},</h2>
            <p>A SIM card has been assigned to you by <strong>${assignedBy.name}</strong>.</p>
            <div class="sim-card">
              <h3 style="margin: 0 0 15px 0;">SIM Details</h3>
              <p style="margin: 5px 0;"><strong>Mobile Number:</strong> ${sim.mobileNumber}</p>
              <p style="margin: 5px 0;"><strong>Operator:</strong> ${sim.operator}</p>
              <p style="margin: 5px 0;"><strong>Status:</strong> ${sim.status}</p>
              ${sim.circle ? `<p style="margin: 5px 0;"><strong>Circle:</strong> ${sim.circle}</p>` : ''}
            </div>
            <p>Please log in to your dashboard to view more details.</p>
          </div>
          <div class="footer">
            <p>Best regards,<br>SIM Management Team</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return this.sendEmail({ to: user.email, subject, html });
  }

  async sendRechargeReminder(user, sim, recharge) {
    const subject = `Recharge Reminder - SIM ${sim.mobileNumber}`;
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #374151; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #d97706, #b45309); color: white; padding: 30px; border-radius: 10px 10px 0 0; text-align: center; }
          .content { background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px; }
          .warning-box { background: #fffbeb; border: 1px solid #fcd34d; padding: 15px; border-radius: 8px; margin: 15px 0; }
          .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 style="margin: 0;">Recharge Reminder</h1>
          </div>
          <div class="content">
            <h2>Dear ${user.name},</h2>
            <p>Your SIM card is due for recharge soon.</p>
            <div class="warning-box">
              <p style="margin: 0;"><strong>SIM Details:</strong></p>
              <p style="margin: 10px 0 0 0;"><strong>Mobile Number:</strong> ${sim.mobileNumber}</p>
              <p style="margin: 5px 0;"><strong>Operator:</strong> ${sim.operator}</p>
              <p style="margin: 5px 0;"><strong>Next Recharge Date:</strong> ${new Date(recharge.nextRechargeDate).toDateString()}</p>
              <p style="margin: 5px 0;"><strong>Last Recharge Amount:</strong> ₹${recharge.amount}</p>
            </div>
            <p>Please recharge to avoid service interruption.</p>
          </div>
          <div class="footer">
            <p>Best regards,<br>SIM Management Team</p>
          </div>
        </div>
      </body>
      </html>
    `;
    return this.sendEmail({ to: user.email, subject, html });
  }

  async sendPasswordResetEmail(user, resetToken) {
    const resetUrl = `${config.app.frontendUrl || 'http://localhost:3000'}/reset-password?token=${resetToken}`;
    const subject = 'Password Reset Request';
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #374151; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #dc2626, #b91c1c); color: white; padding: 30px; border-radius: 10px 10px 0 0; text-align: center; }
          .content { background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px; }
          .button { display: inline-block; padding: 12px 24px; background: #dc2626; color: white; text-decoration: none; border-radius: 6px; margin: 20px 0; }
          .warning { background: #fef2f2; border: 1px solid #fecaca; padding: 15px; border-radius: 6px; margin: 15px 0; }
          .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 style="margin: 0;">Password Reset</h1>
          </div>
          <div class="content">
            <h2>Hello ${user.name},</h2>
            <p>We received a request to reset your password.</p>
            <p>Click the button below to reset your password:</p>
            <a href="${resetUrl}" class="button">Reset Password</a>
            <div class="warning">
              <p style="margin: 0;"><strong>Important:</strong> This link will expire in 1 hour.</p>
              <p style="margin: 10px 0 0 0;">If you didn't request this, please ignore this email.</p>
            </div>
          </div>
          <div class="footer">
            <p>Best regards,<br>SIM Management Team</p>
          </div>
        </div>
      </body>
      </html>
    `;
    return this.sendEmail({ to: user.email, subject, html });
  }

  // Send Forgot Password OTP email (for admin password reset)
  async sendForgotPasswordOTPEmail(email, otp, userName) {
    const subject = 'Your SIM Manager Password Reset Code';
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #374151; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #2563eb, #1d4ed8); color: white; padding: 30px; border-radius: 10px 10px 0 0; text-align: center; }
          .content { background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px; }
          .otp-box { background: #eff6ff; border: 2px solid #2563eb; padding: 25px; border-radius: 8px; text-align: center; margin: 25px 0; }
          .otp-code { font-size: 36px; font-weight: bold; color: #2563eb; letter-spacing: 8px; font-family: monospace; }
          .warning { background: #fef3c7; border: 1px solid #fcd34d; padding: 12px; border-radius: 6px; margin: 15px 0; }
          .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 style="margin: 0;">SIM Manager</h1>
            <p style="margin: 10px 0 0 0; opacity: 0.9;">Password Reset Verification</p>
          </div>
          <div class="content">
            <h2>Hello ${userName},</h2>
            <p>We received a request to reset your password. Please use the following verification code:</p>
            <div class="otp-box">
              <div class="otp-code">${otp}</div>
            </div>
            <div class="warning">
              <p style="margin: 0;"><strong>⚠️ Important:</strong></p>
              <ul style="margin: 10px 0 0 0; padding-left: 20px;">
                <li>This code expires in <strong>10 minutes</strong></li>
                <li>Do not share this code with anyone</li>
                <li>If you didn't request this, please ignore this email</li>
              </ul>
            </div>
            <p>Enter this code in the app to reset your password.</p>
          </div>
          <div class="footer">
            <p>Best regards,<br>SIM Management Team</p>
          </div>
        </div>
      </body>
      </html>
    `;
    return this.sendEmail({ to: email, subject, html });
  }

  async sendSubscriptionExpiryNotice(company, daysRemaining) {
    const subject = `Subscription Expiring Soon - ${daysRemaining} days remaining`;
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #374151; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #dc2626, #b91c1c); color: white; padding: 30px; border-radius: 10px 10px 0 0; text-align: center; }
          .content { background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px; }
          .warning-box { background: #fef2f2; border: 1px solid #fecaca; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center; }
          .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 style="margin: 0;">Subscription Expiry Notice</h1>
          </div>
          <div class="content">
            <h2>Dear ${company.name},</h2>
            <p>Your subscription will expire soon.</p>
            <div class="warning-box">
              <p style="font-size: 24px; font-weight: bold; color: #dc2626; margin: 0;">${daysRemaining} days remaining</p>
              <p style="margin: 10px 0 0 0;">Expiry Date: ${company.subscriptionEndDate ? new Date(company.subscriptionEndDate).toDateString() : 'N/A'}</p>
            </div>
            <p>Please renew your subscription to continue using all features.</p>
          </div>
          <div class="footer">
            <p>Best regards,<br>SIM Management Team</p>
          </div>
        </div>
      </body>
      </html>
    `;
    return this.sendEmail({ to: company.email, subject, html });
  }

  // Send OTP email for mobile authentication
  async sendOTPEmail(email, otp, mobileNumber) {
    const subject = `Your Login OTP - SIM Management`;
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #374151; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #2563eb, #1d4ed8); color: white; padding: 30px; border-radius: 10px 10px 0 0; text-align: center; }
          .content { background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px; }
          .otp-box { background: #eff6ff; border: 2px solid #2563eb; padding: 25px; border-radius: 8px; text-align: center; margin: 25px 0; }
          .otp-code { font-size: 36px; font-weight: bold; color: #2563eb; letter-spacing: 8px; font-family: monospace; }
          .info-box { background: #f1f5f9; padding: 15px; border-radius: 6px; margin: 15px 0; }
          .warning { background: #fef3c7; border: 1px solid #fcd34d; padding: 12px; border-radius: 6px; margin: 15px 0; }
          .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 style="margin: 0;">SIM Management</h1>
            <p style="margin: 10px 0 0 0; opacity: 0.9;">One-Time Password Verification</p>
          </div>
          <div class="content">
            <h2>Hello,</h2>
            <p>You requested to log in to SIM Management using your mobile number.</p>
            <div class="info-box">
              <p style="margin: 0;"><strong>Mobile Number:</strong> +91 ${mobileNumber}</p>
            </div>
            <p>Your One-Time Password (OTP) is:</p>
            <div class="otp-box">
              <div class="otp-code">${otp}</div>
            </div>
            <div class="warning">
              <p style="margin: 0;"><strong>⚠️ Important:</strong></p>
              <ul style="margin: 10px 0 0 0; padding-left: 20px;">
                <li>This OTP is valid for <strong>5 minutes</strong></li>
                <li>Do not share this OTP with anyone</li>
                <li>If you didn't request this OTP, please ignore this email</li>
              </ul>
            </div>
            <p>Enter this OTP in the app to complete your login.</p>
          </div>
          <div class="footer">
            <p>Best regards,<br>SIM Management Team</p>
          </div>
        </div>
      </body>
      </html>
    `;

    console.log("Otp : ", otp);
    return this.sendEmail({ to: email, subject, html });
  }

  // Check if email service is ready
  isReady() {
    return this.isConfigured && this.transporter !== null;
  }
}

module.exports = new EmailService();