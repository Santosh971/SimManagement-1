// const nodemailer = require('nodemailer');
// const config = require('../config');
// const logger = require('./logger');

// class EmailService {
//   constructor() {
//     this.transporter = null;
//     this.isConfigured = false;
//     this.connectionVerified = false;
//     this.init();
//   }

//   init() {
//     // Get email config and clean up values
//     const emailHost = config.email.host;
//     const emailPort = config.email.port;
//     const emailUser = config.email.user;
//     // Remove spaces from App Password (Gmail App Passwords often have spaces for readability)
//     const emailPass = config.email.pass ? config.email.pass.replace(/\s/g, '') : null;
//     const emailFrom = config.email.from;

//     // Log configuration for debugging (hide password)
//     logger.info('Email configuration check', {
//       hasHost: !!emailHost,
//       host: emailHost,
//       port: emailPort,
//       hasUser: !!emailUser,
//       user: emailUser,
//       hasPass: !!emailPass,
//       passLength: emailPass ? emailPass.length : 0,
//       hasFrom: !!emailFrom,
//     });

//     // Check if email configuration is present
//     if (!emailHost || !emailUser || !emailPass) {
//       logger.warn('Email configuration is incomplete. Email notifications will be disabled.', {
//         hasHost: !!emailHost,
//         hasUser: !!emailUser,
//         hasPass: !!emailPass,
//       });
//       return;
//     }

//     try {
//       this.transporter = nodemailer.createTransport({
//         host: emailHost,
//         port: emailPort,
//         secure: emailPort === 465,
//         auth: {
//           user: emailUser,
//           pass: emailPass,
//         },
//         // Additional options for better reliability
//         connectionTimeout: 5000, // 5 seconds (reduced for faster startup)
//         socketTimeout: 5000, // 5 seconds
//         tls: {
//           rejectUnauthorized: process.env.NODE_ENV === 'production',
//         },
//       });

//       this.isConfigured = true;
//       logger.info('Email service initialized successfully', {
//         host: emailHost,
//         port: emailPort,
//         user: emailUser,
//       });

//       // Verify connection asynchronously (don't block startup)
//       this.verifyConnectionAsync();
//     } catch (error) {
//       logger.error('Failed to initialize email service', { error: error.message });
//     }
//   }

//   /**
//    * Verify connection asynchronously without blocking startup
//    */
//   verifyConnectionAsync() {
//     // Run verification in background
//     this.verifyConnection().catch(err => {
//       // Log but don't throw - app should still work
//       logger.warn('Email connection could not be established. Email delivery may fail.', {
//         error: err.message,
//         code: err.code,
//         note: 'On cloud platforms (Render, Heroku, etc.), SMTP ports are often blocked. Consider using SendGrid, Mailgun, or Amazon SES for production.',
//       });
//     });
//   }

//   async verifyConnection() {
//     if (!this.transporter) {
//       logger.warn('Cannot verify email connection: transporter not initialized');
//       return false;
//     }

//     try {
//       await this.transporter.verify();
//       this.connectionVerified = true;
//       logger.info('Email transporter verified successfully - emails will be sent');
//       return true;
//     } catch (error) {
//       this.connectionVerified = false;

//       // Provide helpful error messages based on error type
//       if (error.code === 'ETIMEDOUT' || error.code === 'ECONNREFUSED') {
//         logger.warn('Email connection timeout - SMTP may be blocked on this platform', {
//           host: config.email.host,
//           port: config.email.port,
//           solution: 'Consider using SendGrid, Mailgun, Amazon SES, or Gmail API instead of SMTP for production',
//         });
//       } else if (error.message.includes('Invalid login') || error.message.includes('535') || error.code === 'EAUTH') {
//         logger.error('GMAIL AUTHENTICATION ERROR - Please fix:');
//         logger.error('Gmail requires App Password for SMTP. Steps:');
//         logger.error('1. Go to https://myaccount.google.com/');
//         logger.error('2. Enable 2-Step Verification');
//         logger.error('3. Go to Security > App passwords');
//         logger.error('4. Create new App password for "Mail"');
//         logger.error('5. Use the 16-character password as SMTP_PASS');
//       } else {
//         logger.warn('Email transporter verification failed', {
//           error: error.message,
//           code: error.code,
//         });
//       }

//       return false;
//     }
//   }

//   async sendEmail({ to, subject, html, text }) {
//     // Check if email is configured
//     if (!this.isConfigured || !this.transporter) {
//       logger.warn('Email not sent: Email service not configured', { to, subject });
//       return { success: false, error: 'Email service not configured' };
//     }

//     // Validate email address
//     if (!to || !to.includes('@')) {
//       logger.error('Invalid email address', { to });
//       return { success: false, error: 'Invalid email address' };
//     }

//     try {
//       const mailOptions = {
//         from: config.email.from || config.email.user,
//         to,
//         subject,
//         html,
//         text: text || html.replace(/<[^>]*>/g, ''),
//       };

//       logger.info('Sending email', { to, subject });

//       const info = await this.transporter.sendMail(mailOptions);

//       logger.info('Email sent successfully', {
//         messageId: info.messageId,
//         to,
//         subject,
//         response: info.response
//       });

//       return { success: true, messageId: info.messageId };
//     } catch (error) {
//       logger.error('Failed to send email', {
//         error: error.message,
//         to,
//         subject,
//         code: error.code
//       });
//       return { success: false, error: error.message };
//     }
//   }

//   // Send welcome email to new user/admin
//   async sendWelcomeEmail(user, company, tempPassword = null) {
//     const subject = `Welcome to SIM Management - ${company.name}`;
//     const loginUrl = config.app.frontendUrl ? `${config.app.frontendUrl}/login` : 'http://localhost:3000/login';

//     let passwordSection = '';
//     if (tempPassword) {
//       passwordSection = `
//         <div style="background: #f0fdf4; border: 2px solid #16a34a; padding: 20px; border-radius: 8px; margin: 20px 0;">
//           <p style="margin: 0 0 10px 0; color: #16a34a; font-weight: 600;">Your Auto-Generated Password:</p>
//           <p style="margin: 0; font-size: 20px; font-family: monospace; background: #fff; padding: 10px; border-radius: 4px; border: 1px solid #e5e7eb; text-align: center; letter-spacing: 2px;">${tempPassword}</p>
//           <p style="margin: 10px 0 0 0; color: #dc2626; font-size: 14px;">⚠️ Please change your password after first login for security.</p>
//         </div>
//       `;
//     }

//     const html = `
//       <!DOCTYPE html>
//       <html>
//       <head>
//         <style>
//           body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #374151; }
//           .container { max-width: 600px; margin: 0 auto; padding: 20px; }
//           .header { background: linear-gradient(135deg, #2563eb, #1d4ed8); color: white; padding: 30px; border-radius: 10px 10px 0 0; text-align: center; }
//           .content { background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px; }
//           .button { display: inline-block; padding: 12px 24px; background: #2563eb; color: white; text-decoration: none; border-radius: 6px; margin: 20px 0; }
//           .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 14px; }
//         </style>
//       </head>
//       <body>
//         <div class="container">
//           <div class="header">
//             <h1 style="margin: 0;">Welcome to SIM Management</h1>
//           </div>
//           <div class="content">
//             <h2>Hello ${user.name},</h2>
//             <p>Your account has been created for <strong>${company.name}</strong>.</p>
//             <p><strong>Account Details:</strong></p>
//             <ul>
//               <li><strong>Email:</strong> ${user.email}</li>
//               <li><strong>Role:</strong> ${user.role || 'User'}</li>
//             </ul>

//           </div>
//           <div class="footer">
//             <p>Best regards,<br>SIM Management Team</p>
//           </div>
//         </div>
//       </body>
//       </html>
//     `;

//     return this.sendEmail({ to: user.email, subject, html });
//   }

//   // Send company creation notification
//   async sendCompanyCreatedEmail(company, admin) {
//     const subject = `New Company Registered - ${company.name}`;
//     const dashboardUrl = config.app.frontendUrl ? `${config.app.frontendUrl}/dashboard` : 'http://localhost:3000/dashboard';

//     const html = `
//       <!DOCTYPE html>
//       <html>
//       <head>
//         <style>
//           body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #374151; }
//           .container { max-width: 600px; margin: 0 auto; padding: 20px; }
//           .header { background: linear-gradient(135deg, #16a34a, #15803d); color: white; padding: 30px; border-radius: 10px 10px 0 0; text-align: center; }
//           .content { background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px; }
//         .button {
//   display: inline-block;
//   padding: 12px 24px;
//   background: #2563eb;
//   color: white;
//   text-decoration: none;
//   border-radius: 6px;
//   margin: 20px 0;
//   font-weight: 600;
// }
//           .info-box { background: #f1f5f9; padding: 15px; border-radius: 6px; margin: 15px 0; }
//           .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 14px; }
//         </style>
//       </head>
//       <body>
//         <div class="container">
//           <div class="header">
//             <h1 style="margin: 0;">Company Registration Successful</h1>
//           </div>
//           <div class="content">
//             <h2>Congratulations!</h2>
//             <p>Your company <strong>${company.name}</strong> has been successfully registered on SIM Management platform.</p>
//             <div class="info-box">
//               <p style="margin: 0;"><strong>Company Details:</strong></p>
//               <p style="margin: 10px 0 0 0;">Email: ${company.email}</p>
//               <p style="margin: 5px 0;">Subscription Valid Until: ${company.subscriptionEndDate ? new Date(company.subscriptionEndDate).toDateString() : 'N/A'}</p>
//             </div>
//             <p>You can now start managing your SIM cards and services.</p>
//             <a href="${dashboardUrl}" class="button">Go to Dashboard</a>
//             <p>If you have any questions, please contact our support team.</p>
//           </div>
//           <div class="footer">
//             <p>Best regards,<br>SIM Management Team</p>
//           </div>
//         </div>
//       </body>
//       </html>
//     `;

//     return this.sendEmail({ to: company.email, subject, html });
//   }

//   // Send SIM assignment notification
//   async sendSimAssignmentEmail(user, sim, assignedBy) {
//     const subject = `SIM Card Assigned to You - ${sim.mobileNumber}`;

//     const html = `
//       <!DOCTYPE html>
//       <html>
//       <head>
//         <style>
//           body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #374151; }
//           .container { max-width: 600px; margin: 0 auto; padding: 20px; }
//           .header { background: linear-gradient(135deg, #2563eb, #1d4ed8); color: white; padding: 30px; border-radius: 10px 10px 0 0; text-align: center; }
//           .content { background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px; }
//           .sim-card { background: #f1f5f9; padding: 20px; border-radius: 8px; margin: 20px 0; }
//           .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 14px; }
//         </style>
//       </head>
//       <body>
//         <div class="container">
//           <div class="header">
//             <h1 style="margin: 0;">SIM Card Assignment</h1>
//           </div>
//           <div class="content">
//             <h2>Hello ${user.name},</h2>
//             <p>A SIM card has been assigned to you by <strong>${assignedBy.name}</strong>.</p>
//             <div class="sim-card">
//               <h3 style="margin: 0 0 15px 0;">SIM Details</h3>
//               <p style="margin: 5px 0;"><strong>Mobile Number:</strong> ${sim.mobileNumber}</p>
//               <p style="margin: 5px 0;"><strong>Operator:</strong> ${sim.operator}</p>
//               <p style="margin: 5px 0;"><strong>Status:</strong> ${sim.status}</p>
//               ${sim.circle ? `<p style="margin: 5px 0;"><strong>Circle:</strong> ${sim.circle}</p>` : ''}
//             </div>
//             <p>Please log in to your dashboard to view more details.</p>
//           </div>
//           <div class="footer">
//             <p>Best regards,<br>SIM Management Team</p>
//           </div>
//         </div>
//       </body>
//       </html>
//     `;

//     return this.sendEmail({ to: user.email, subject, html });
//   }

//   async sendRechargeReminder(user, sim, recharge) {
//     const subject = `Recharge Reminder - SIM ${sim.mobileNumber}`;
//     const html = `
//       <!DOCTYPE html>
//       <html>
//       <head>
//         <style>
//           body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #374151; }
//           .container { max-width: 600px; margin: 0 auto; padding: 20px; }
//           .header { background: linear-gradient(135deg, #d97706, #b45309); color: white; padding: 30px; border-radius: 10px 10px 0 0; text-align: center; }
//           .content { background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px; }
//           .warning-box { background: #fffbeb; border: 1px solid #fcd34d; padding: 15px; border-radius: 8px; margin: 15px 0; }
//           .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 14px; }
//         </style>
//       </head>
//       <body>
//         <div class="container">
//           <div class="header">
//             <h1 style="margin: 0;">Recharge Reminder</h1>
//           </div>
//           <div class="content">
//             <h2>Dear ${user.name},</h2>
//             <p>Your SIM card is due for recharge soon.</p>
//             <div class="warning-box">
//               <p style="margin: 0;"><strong>SIM Details:</strong></p>
//               <p style="margin: 10px 0 0 0;"><strong>Mobile Number:</strong> ${sim.mobileNumber}</p>
//               <p style="margin: 5px 0;"><strong>Operator:</strong> ${sim.operator}</p>
//               <p style="margin: 5px 0;"><strong>Next Recharge Date:</strong> ${new Date(recharge.nextRechargeDate).toDateString()}</p>
//               <p style="margin: 5px 0;"><strong>Last Recharge Amount:</strong> ₹${recharge.amount}</p>
//             </div>
//             <p>Please recharge to avoid service interruption.</p>
//           </div>
//           <div class="footer">
//             <p>Best regards,<br>SIM Management Team</p>
//           </div>
//         </div>
//       </body>
//       </html>
//     `;
//     return this.sendEmail({ to: user.email, subject, html });
//   }

//   async sendPasswordResetEmail(user, resetToken) {
//     const resetUrl = `${config.app.frontendUrl || 'http://localhost:3000'}/reset-password?token=${resetToken}`;
//     const subject = 'Password Reset Request';
//     const html = `
//       <!DOCTYPE html>
//       <html>
//       <head>
//         <style>
//           body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #374151; }
//           .container { max-width: 600px; margin: 0 auto; padding: 20px; }
//           .header { background: linear-gradient(135deg, #dc2626, #b91c1c); color: white; padding: 30px; border-radius: 10px 10px 0 0; text-align: center; }
//           .content { background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px; }
//           .button { display: inline-block; padding: 12px 24px; background: #dc2626; color: white; text-decoration: none; border-radius: 6px; margin: 20px 0; }
//           .warning { background: #fef2f2; border: 1px solid #fecaca; padding: 15px; border-radius: 6px; margin: 15px 0; }
//           .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 14px; }
//         </style>
//       </head>
//       <body>
//         <div class="container">
//           <div class="header">
//             <h1 style="margin: 0;">Password Reset</h1>
//           </div>
//           <div class="content">
//             <h2>Hello ${user.name},</h2>
//             <p>We received a request to reset your password.</p>
//             <p>Click the button below to reset your password:</p>
//             <a href="${resetUrl}" class="button">Reset Password</a>
//             <div class="warning">
//               <p style="margin: 0;"><strong>Important:</strong> This link will expire in 1 hour.</p>
//               <p style="margin: 10px 0 0 0;">If you didn't request this, please ignore this email.</p>
//             </div>
//           </div>
//           <div class="footer">
//             <p>Best regards,<br>SIM Management Team</p>
//           </div>
//         </div>
//       </body>
//       </html>
//     `;
//     return this.sendEmail({ to: user.email, subject, html });
//   }

//   // Send Forgot Password OTP email (for admin password reset)
//   async sendForgotPasswordOTPEmail(email, otp, userName) {
//     const subject = 'Your SIM Manager Password Reset Code';
//     const html = `
//       <!DOCTYPE html>
//       <html>
//       <head>
//         <style>
//           body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #374151; }
//           .container { max-width: 600px; margin: 0 auto; padding: 20px; }
//           .header { background: linear-gradient(135deg, #2563eb, #1d4ed8); color: white; padding: 30px; border-radius: 10px 10px 0 0; text-align: center; }
//           .content { background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px; }
//           .otp-box { background: #eff6ff; border: 2px solid #2563eb; padding: 25px; border-radius: 8px; text-align: center; margin: 25px 0; }
//           .otp-code { font-size: 36px; font-weight: bold; color: #2563eb; letter-spacing: 8px; font-family: monospace; }
//           .warning { background: #fef3c7; border: 1px solid #fcd34d; padding: 12px; border-radius: 6px; margin: 15px 0; }
//           .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 14px; }
//         </style>
//       </head>
//       <body>
//         <div class="container">
//           <div class="header">
//             <h1 style="margin: 0;">SIM Manager</h1>
//             <p style="margin: 10px 0 0 0; opacity: 0.9;">Password Reset Verification</p>
//           </div>
//           <div class="content">
//             <h2>Hello ${userName},</h2>
//             <p>We received a request to reset your password. Please use the following verification code:</p>
//             <div class="otp-box">
//               <div class="otp-code">${otp}</div>
//             </div>
//             <div class="warning">
//               <p style="margin: 0;"><strong>⚠️ Important:</strong></p>
//               <ul style="margin: 10px 0 0 0; padding-left: 20px;">
//                 <li>This code expires in <strong>10 minutes</strong></li>
//                 <li>Do not share this code with anyone</li>
//                 <li>If you didn't request this, please ignore this email</li>
//               </ul>
//             </div>
//             <p>Enter this code in the app to reset your password.</p>
//           </div>
//           <div class="footer">
//             <p>Best regards,<br>SIM Management Team</p>
//           </div>
//         </div>
//       </body>
//       </html>
//     `;
//     return this.sendEmail({ to: email, subject, html });
//   }

//   async sendSubscriptionExpiryNotice(company, daysRemaining) {
//     const subject = `Subscription Expiring Soon - ${daysRemaining} days remaining`;
//     const html = `
//       <!DOCTYPE html>
//       <html>
//       <head>
//         <style>
//           body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #374151; }
//           .container { max-width: 600px; margin: 0 auto; padding: 20px; }
//           .header { background: linear-gradient(135deg, #dc2626, #b91c1c); color: white; padding: 30px; border-radius: 10px 10px 0 0; text-align: center; }
//           .content { background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px; }
//           .warning-box { background: #fef2f2; border: 1px solid #fecaca; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center; }
//           .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 14px; }
//         </style>
//       </head>
//       <body>
//         <div class="container">
//           <div class="header">
//             <h1 style="margin: 0;">Subscription Expiry Notice</h1>
//           </div>
//           <div class="content">
//             <h2>Dear ${company.name},</h2>
//             <p>Your subscription will expire soon.</p>
//             <div class="warning-box">
//               <p style="font-size: 24px; font-weight: bold; color: #dc2626; margin: 0;">${daysRemaining} days remaining</p>
//               <p style="margin: 10px 0 0 0;">Expiry Date: ${company.subscriptionEndDate ? new Date(company.subscriptionEndDate).toDateString() : 'N/A'}</p>
//             </div>
//             <p>Please renew your subscription to continue using all features.</p>
//           </div>
//           <div class="footer">
//             <p>Best regards,<br>SIM Management Team</p>
//           </div>
//         </div>
//       </body>
//       </html>
//     `;
//     return this.sendEmail({ to: company.email, subject, html });
//   }

//   // Send OTP email for mobile authentication
//   async sendOTPEmail(email, otp, mobileNumber) {
//     const subject = `Your Login OTP - SIM Management`;
//     const html = `
//       <!DOCTYPE html>
//       <html>
//       <head>
//         <style>
//           body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #374151; }
//           .container { max-width: 600px; margin: 0 auto; padding: 20px; }
//           .header { background: linear-gradient(135deg, #2563eb, #1d4ed8); color: white; padding: 30px; border-radius: 10px 10px 0 0; text-align: center; }
//           .content { background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px; }
//           .otp-box { background: #eff6ff; border: 2px solid #2563eb; padding: 25px; border-radius: 8px; text-align: center; margin: 25px 0; }
//           .otp-code { font-size: 36px; font-weight: bold; color: #2563eb; letter-spacing: 8px; font-family: monospace; }
//           .info-box { background: #f1f5f9; padding: 15px; border-radius: 6px; margin: 15px 0; }
//           .warning { background: #fef3c7; border: 1px solid #fcd34d; padding: 12px; border-radius: 6px; margin: 15px 0; }
//           .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 14px; }
//         </style>
//       </head>
//       <body>
//         <div class="container">
//           <div class="header">
//             <h1 style="margin: 0;">SIM Management</h1>
//             <p style="margin: 10px 0 0 0; opacity: 0.9;">One-Time Password Verification</p>
//           </div>
//           <div class="content">
//             <h2>Hello,</h2>
//             <p>You requested to log in to SIM Management using your mobile number.</p>
//             <div class="info-box">
//               <p style="margin: 0;"><strong>Mobile Number:</strong> +91 ${mobileNumber}</p>
//             </div>
//             <p>Your One-Time Password (OTP) is:</p>
//             <div class="otp-box">
//               <div class="otp-code">${otp}</div>
//             </div>
//             <div class="warning">
//               <p style="margin: 0;"><strong>⚠️ Important:</strong></p>
//               <ul style="margin: 10px 0 0 0; padding-left: 20px;">
//                 <li>This OTP is valid for <strong>5 minutes</strong></li>
//                 <li>Do not share this OTP with anyone</li>
//                 <li>If you didn't request this OTP, please ignore this email</li>
//               </ul>
//             </div>
//             <p>Enter this OTP in the app to complete your login.</p>
//           </div>
//           <div class="footer">
//             <p>Best regards,<br>SIM Management Team</p>
//           </div>
//         </div>
//       </body>
//       </html>
//     `;

//     console.log("Otp : ", otp);
//     return this.sendEmail({ to: email, subject, html });
//   }

//   // Check if email service is ready
//   isReady() {
//     return this.isConfigured && this.transporter !== null;
//   }
// }

// module.exports = new EmailService();

const nodemailer = require('nodemailer');
const config = require('../config');
const logger = require('./logger');

// ─── Shared Design System ────────────────────────────────────────────────────

const COLORS = {
  brand: '#1A56DB', // primary blue
  brandDark: '#1E429F',
  success: '#057A55',
  successBg: '#F3FAF7',
  successBdr: '#BCF0DA',
  warning: '#92400E',
  warningBg: '#FFFBEB',
  warningBdr: '#FCD34D',
  danger: '#9B1C1C',
  dangerBg: '#FDF2F2',
  dangerBdr: '#F8B4B4',
  info: '#1E429F',
  infoBg: '#EBF5FF',
  infoBdr: '#93C5FD',
  surface: '#FFFFFF',
  surfaceAlt: '#F9FAFB',
  border: '#E5E7EB',
  textPrimary: '#111827',
  textMuted: '#6B7280',
  textLight: '#9CA3AF',
};

// ─── Base Layout ─────────────────────────────────────────────────────────────

function baseLayout({ headerBg, headerIcon, headerTitle, headerSubtitle, bodyContent, footerNote = '' }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <title>${headerTitle}</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap');
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      background-color: #F3F4F6;
      color: ${COLORS.textPrimary};
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
    }
    a { color: ${COLORS.brand}; text-decoration: none; }
    @media only screen and (max-width: 600px) {
      .email-wrapper { padding: 12px !important; }
      .email-card { border-radius: 16px !important; }
      .email-header { padding: 28px 24px !important; border-radius: 16px 16px 0 0 !important; }
      .email-body { padding: 28px 24px !important; }
      .email-footer { padding: 20px 24px !important; }
      .btn { display: block !important; text-align: center !important; }
      .info-grid { display: block !important; }
      .info-grid td { display: block !important; padding: 4px 0 !important; }
    }
  </style>
</head>
<body>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
         style="background-color:#F3F4F6; padding:0; margin:0;">
    <tr>
      <td align="center" style="padding: 32px 16px;" class="email-wrapper">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
               style="max-width:600px; width:100%;" class="email-card">

          <!-- ── HEADER ── -->
          <tr>
            <td style="
              background: ${headerBg};
              padding: 40px 40px 36px;
              border-radius: 20px 20px 0 0;
              text-align: center;
            " class="email-header">
              <div style="
                width: 52px; height: 52px;
                background: rgba(255,255,255,0.2);
                border-radius: 14px;
                margin: 0 auto 16px;
                display: flex; align-items: center; justify-content: center;
                font-size: 24px; line-height: 52px;
              ">${headerIcon}</div>
              <h1 style="
                color: #FFFFFF;
                font-size: 22px;
                font-weight: 600;
                letter-spacing: -0.3px;
                margin: 0 0 6px;
              ">${headerTitle}</h1>
              ${headerSubtitle ? `<p style="color: rgba(255,255,255,0.82); font-size: 14px; margin: 0;">${headerSubtitle}</p>` : ''}
            </td>
          </tr>

          <!-- ── BODY ── -->
          <tr>
            <td style="
              background: ${COLORS.surface};
              padding: 36px 40px;
              border-left: 1px solid ${COLORS.border};
              border-right: 1px solid ${COLORS.border};
            " class="email-body">
              ${bodyContent}
            </td>
          </tr>

          <!-- ── FOOTER ── -->
          <tr>
            <td style="
              background: ${COLORS.surfaceAlt};
              padding: 24px 40px;
              border-radius: 0 0 20px 20px;
              border: 1px solid ${COLORS.border};
              border-top: none;
              text-align: center;
            " class="email-footer">
              ${footerNote ? `<p style="font-size: 13px; color: ${COLORS.textMuted}; margin: 0 0 10px;">${footerNote}</p>` : ''}
              <p style="font-size: 13px; color: ${COLORS.textLight}; margin: 0;">
                &copy; ${new Date().getFullYear()} SIM Management &bull; All rights reserved
              </p>
              <p style="font-size: 12px; color: ${COLORS.textLight}; margin: 8px 0 0;">
                This is an automated message &mdash; please do not reply directly to this email.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ─── Reusable Snippets ────────────────────────────────────────────────────────

function greeting(name) {
  return `<p style="font-size: 16px; color: ${COLORS.textPrimary}; margin: 0 0 20px; font-weight: 500;">Hello${name ? `, ${name}` : ''},</p>`;
}

function paragraph(text) {
  return `<p style="font-size: 15px; color: #374151; line-height: 1.7; margin: 0 0 16px;">${text}</p>`;
}

function divider() {
  return `<hr style="border: none; border-top: 1px solid ${COLORS.border}; margin: 24px 0;" />`;
}

function infoCard(rows, { bg = COLORS.surfaceAlt, border = COLORS.border } = {}) {
  const rowsHtml = rows
    .filter(Boolean)
    .map(([label, value]) => `
      <tr>
        <td style="padding: 9px 0; font-size: 13px; color: ${COLORS.textMuted}; width: 42%; vertical-align: top;">${label}</td>
        <td style="padding: 9px 0; font-size: 14px; color: ${COLORS.textPrimary}; font-weight: 500; vertical-align: top;">${value}</td>
      </tr>`)
    .join('');
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="
      background: ${bg};
      border: 1px solid ${border};
      border-radius: 12px;
      padding: 16px 20px;
      margin: 20px 0;
    ">
      <tr><td>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="info-grid">
          ${rowsHtml}
        </table>
      </td></tr>
    </table>`;
}

function alertBox(text, { bg, border, textColor, label = '' } = {}) {
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="
      background: ${bg};
      border: 1px solid ${border};
      border-radius: 10px;
      padding: 14px 18px;
      margin: 20px 0;
    ">
      <tr><td style="font-size: 14px; color: ${textColor}; line-height: 1.6;">
        ${label ? `<strong>${label}</strong><br />` : ''}${text}
      </td></tr>
    </table>`;
}

function otpBox(otp) {
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="
      background: ${COLORS.infoBg};
      border: 2px solid ${COLORS.brand};
      border-radius: 14px;
      padding: 28px 20px;
      margin: 24px 0;
      text-align: center;
    ">
      <tr><td>
        <p style="font-size: 12px; color: ${COLORS.brand}; letter-spacing: 1.5px; text-transform: uppercase; font-weight: 600; margin: 0 0 12px;">Your Verification Code</p>
        <p style="
          font-size: 40px;
          font-weight: 600;
          letter-spacing: 12px;
          color: ${COLORS.brandDark};
          font-family: 'Courier New', Courier, monospace;
          margin: 0;
          line-height: 1;
        ">${otp}</p>
      </td></tr>
    </table>`;
}

function ctaButton(label, href, color = COLORS.brand) {
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin: 24px 0;">
      <tr>
        <td style="border-radius: 10px; background: ${color};">
          <a href="${href}" class="btn" style="
            display: inline-block;
            padding: 13px 28px;
            font-size: 15px;
            font-weight: 600;
            color: #FFFFFF;
            text-decoration: none;
            border-radius: 10px;
            letter-spacing: 0.1px;
          ">${label} &rarr;</a>
        </td>
      </tr>
    </table>`;
}

function passwordBox(password) {
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="
      background: ${COLORS.successBg};
      border: 1.5px solid ${COLORS.successBdr};
      border-radius: 12px;
      padding: 20px;
      margin: 20px 0;
      text-align: center;
    ">
      <tr><td>
        <p style="font-size: 12px; color: ${COLORS.success}; font-weight: 600; letter-spacing: 1px; text-transform: uppercase; margin: 0 0 10px;">Temporary Password</p>
        <p style="
          font-size: 22px;
          font-family: 'Courier New', Courier, monospace;
          font-weight: 600;
          letter-spacing: 4px;
          color: #065F46;
          background: #FFFFFF;
          border: 1px solid ${COLORS.successBdr};
          border-radius: 8px;
          padding: 10px 16px;
          margin: 0 auto;
          display: inline-block;
        ">${password}</p>
        <p style="font-size: 13px; color: #B45309; margin: 12px 0 0;">
          &#9888; Please change your password after your first login.
        </p>
      </td></tr>
    </table>`;
}

// ─── Email Service Class ──────────────────────────────────────────────────────

class EmailService {
  constructor() {
    this.transporter = null;
    this.isConfigured = false;
    this.connectionVerified = false;
    this.init();
  }

  init() {
    const emailHost = config.email.host;
    const emailPort = config.email.port;
    const emailUser = config.email.user;
    const emailPass = config.email.pass ? config.email.pass.replace(/\s/g, '') : null;
    const emailFrom = config.email.from;

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
        auth: { user: emailUser, pass: emailPass },
        connectionTimeout: 5000,
        socketTimeout: 5000,
        tls: { rejectUnauthorized: process.env.NODE_ENV === 'production' },
      });

      this.isConfigured = true;
      logger.info('Email service initialized successfully', { host: emailHost, port: emailPort, user: emailUser });
      this.verifyConnectionAsync();
    } catch (error) {
      logger.error('Failed to initialize email service', { error: error.message });
    }
  }

  verifyConnectionAsync() {
    this.verifyConnection().catch(err => {
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
        logger.warn('Email transporter verification failed', { error: error.message, code: error.code });
      }
      return false;
    }
  }

  async sendEmail({ to, subject, html, text }) {
    if (!this.isConfigured || !this.transporter) {
      logger.warn('Email not sent: Email service not configured', { to, subject });
      return { success: false, error: 'Email service not configured' };
    }
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
      logger.info('Email sent successfully', { messageId: info.messageId, to, subject, response: info.response });
      return { success: true, messageId: info.messageId };
    } catch (error) {
      logger.error('Failed to send email', { error: error.message, to, subject, code: error.code });
      return { success: false, error: error.message };
    }
  }

  // ─── Welcome Email ──────────────────────────────────────────────────────────

  async sendWelcomeEmail(user, company, tempPassword = null) {
    const subject = `Welcome to SIM Management — ${company.name}`;
    const loginUrl = `${config.app.frontendUrl || 'http://localhost:3000'}/login`;

    const body = `
      ${greeting(user.name)}
      ${paragraph(`Your account has been successfully created for <strong>${company.name}</strong>. You're all set to start managing your SIM cards and services.`)}
      ${infoCard([
      ['Email Address', user.email],
      ['Role', user.role || 'User'],
      ['Company', company.name],
    ])}
      ${tempPassword ? passwordBox(tempPassword) : ''}
      ${paragraph('Click below to log in and get started:')}
      ${ctaButton('Log In to Dashboard', loginUrl)}
      ${divider()}
      ${paragraph(`If you have any questions or need help getting set up, feel free to reach out to your administrator.`)}
    `;

    const html = baseLayout({
      headerBg: `linear-gradient(135deg, #1A56DB 0%, #1E429F 100%)`,
      headerIcon: '&#128272;',
      headerTitle: 'Welcome to SIM Management',
      headerSubtitle: `Account created for ${company.name}`,
      bodyContent: body,
    });

    return this.sendEmail({ to: user.email, subject, html });
  }

  // ─── Company Created Email ──────────────────────────────────────────────────

  async sendCompanyCreatedEmail(company, admin) {
    const subject = `Company Registration Confirmed — ${company.name}`;
    const dashboardUrl = `${config.app.frontendUrl || 'http://localhost:3000'}/dashboard`;
    const expiryDate = company.subscriptionEndDate
      ? new Date(company.subscriptionEndDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
      : 'N/A';

    const body = `
      ${greeting(company.name)}
      ${paragraph('Your company has been successfully registered on the SIM Management platform. You can now start managing SIM cards, assign users, and track recharges.')}
      ${infoCard([
      ['Company Email', company.email],
      ['Subscription Valid Until', expiryDate],
      ['Status', '<span style="color:#057A55; font-weight:600;">Active</span>'],
    ], { bg: '#F0FDF4', border: '#BBF7D0' })}
      ${paragraph('Get started by logging into your dashboard:')}
      ${ctaButton('Go to Dashboard', dashboardUrl, '#057A55')}
      ${divider()}
      ${alertBox('If you have any questions, please contact our support team. We\'re here to help you get the most out of SIM Management.', {
      bg: COLORS.infoBg,
      border: COLORS.infoBdr,
      textColor: COLORS.info,
      label: 'Need help?',
    })}
    `;

    const html = baseLayout({
      headerBg: `linear-gradient(135deg, #057A55 0%, #065F46 100%)`,
      headerIcon: '&#10003;',
      headerTitle: 'Registration Successful',
      headerSubtitle: 'Your company is ready to go',
      bodyContent: body,
    });

    return this.sendEmail({ to: company.email, subject, html });
  }

  // ─── SIM Assignment Email ───────────────────────────────────────────────────

  async sendSimAssignmentEmail(user, sim, assignedBy) {
    const subject = `SIM Card Assigned — ${sim.mobileNumber}`;

    const body = `
      ${greeting(user.name)}
      ${paragraph(`A SIM card has been assigned to you by <strong>${assignedBy.name}</strong>. Please find the details below.`)}
      ${infoCard([
      ['Mobile Number', `<strong style="font-size:16px;">${sim.mobileNumber}</strong>`],
      ['Operator', sim.operator],
      ['Status', sim.status],
      sim.circle ? ['Circle', sim.circle] : null,
      ['Assigned By', assignedBy.name],
    ])}
      ${paragraph('You can view full SIM details, recharge history, and usage information in your dashboard.')}
      ${ctaButton('View SIM Details', `${config.app.frontendUrl || 'http://localhost:3000'}/dashboard`)}
    `;

    const html = baseLayout({
      headerBg: `linear-gradient(135deg, #1A56DB 0%, #1E429F 100%)`,
      headerIcon: '&#128241;',
      headerTitle: 'SIM Card Assigned',
      headerSubtitle: sim.mobileNumber,
      bodyContent: body,
    });

    return this.sendEmail({ to: user.email, subject, html });
  }

  // ─── Recharge Reminder Email ────────────────────────────────────────────────

  async sendRechargeReminder(user, sim, recharge) {
    const subject = `Recharge Reminder — SIM ${sim.mobileNumber}`;
    const nextDate = new Date(recharge.nextRechargeDate).toLocaleDateString('en-IN', {
      day: 'numeric', month: 'long', year: 'numeric',
    });

    const body = `
      ${greeting(user.name)}
      ${paragraph('Your SIM card is due for recharge soon. Please recharge before the due date to avoid any service interruption.')}
      ${infoCard([
      ['Mobile Number', sim.mobileNumber],
      ['Operator', sim.operator],
      ['Next Recharge Date', `<strong style="color:#B45309;">${nextDate}</strong>`],
      ['Last Recharge Amount', `&#8377;${recharge.amount}`],
    ], { bg: COLORS.warningBg, border: COLORS.warningBdr })}
      ${alertBox(
      'Failure to recharge before the due date may result in service suspension or loss of the number.',
      { bg: '#FFF7ED', border: '#FED7AA', textColor: '#92400E', label: '&#9888; Important Notice' }
    )}
      ${ctaButton('Recharge Now', `${config.app.frontendUrl || 'http://localhost:3000'}/dashboard`, '#D97706')}
    `;

    const html = baseLayout({
      headerBg: `linear-gradient(135deg, #D97706 0%, #B45309 100%)`,
      headerIcon: '&#8635;',
      headerTitle: 'Recharge Reminder',
      headerSubtitle: `Action required for ${sim.mobileNumber}`,
      bodyContent: body,
    });

    return this.sendEmail({ to: user.email, subject, html });
  }

  // ─── Password Reset Email ───────────────────────────────────────────────────

  async sendPasswordResetEmail(user, resetToken) {
    const resetUrl = `${config.app.frontendUrl || 'http://localhost:3000'}/reset-password?token=${resetToken}`;
    const subject = 'Reset Your Password — SIM Management';

    const body = `
      ${greeting(user.name)}
      ${paragraph('We received a request to reset the password for your account. Click the button below to choose a new password.')}
      ${ctaButton('Reset My Password', resetUrl, '#DC2626')}
      ${alertBox(`
        This link will expire in <strong>1 hour</strong>.<br />
        If you did not request a password reset, you can safely ignore this email &mdash; your password will remain unchanged.
      `, { bg: COLORS.dangerBg, border: COLORS.dangerBdr, textColor: '#991B1B', label: '&#128274; Security Notice' })}
      ${divider()}
      ${paragraph(`If the button above doesn't work, copy and paste this link into your browser:<br />
        <span style="font-size:12px; color:${COLORS.textMuted}; word-break:break-all;">${resetUrl}</span>`)}
    `;

    const html = baseLayout({
      headerBg: `linear-gradient(135deg, #DC2626 0%, #991B1B 100%)`,
      headerIcon: '&#128274;',
      headerTitle: 'Password Reset',
      headerSubtitle: 'Requested for your account',
      bodyContent: body,
      footerNote: 'You received this email because a password reset was requested for your account.',
    });

    return this.sendEmail({ to: user.email, subject, html });
  }

  // ─── Forgot Password OTP Email ──────────────────────────────────────────────

  async sendForgotPasswordOTPEmail(email, otp, userName) {
    const subject = 'Your Password Reset Code — SIM Management';

    const body = `
      ${greeting(userName)}
      ${paragraph('We received a request to reset your password. Use the verification code below to proceed.')}
      ${otpBox(otp)}
      ${alertBox(`
        <ul style="margin: 6px 0 0; padding-left: 20px; line-height: 1.8;">
          <li>This code expires in <strong>10 minutes</strong></li>
          <li>Do not share this code with anyone</li>
          <li>If you didn't request this, please ignore this email</li>
        </ul>
      `, { bg: COLORS.warningBg, border: COLORS.warningBdr, textColor: '#92400E', label: '&#9888; Important' })}
      ${paragraph('Enter this code in the app to reset your password.')}
    `;

    const html = baseLayout({
      headerBg: `linear-gradient(135deg, #1A56DB 0%, #1E429F 100%)`,
      headerIcon: '&#128272;',
      headerTitle: 'Password Reset Code',
      headerSubtitle: 'SIM Management Verification',
      bodyContent: body,
      footerNote: 'This code is valid for 10 minutes. Do not share it with anyone.',
    });

    return this.sendEmail({ to: email, subject, html });
  }

  // ─── Subscription Expiry Email ──────────────────────────────────────────────

  async sendSubscriptionExpiryNotice(company, daysRemaining) {
    const subject = `Subscription Expiring in ${daysRemaining} Day${daysRemaining !== 1 ? 's' : ''} — Action Required`;
    const expiryDate = company.subscriptionEndDate
      ? new Date(company.subscriptionEndDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
      : 'N/A';
    const isUrgent = daysRemaining <= 3;

    const body = `
      ${greeting(company.name)}
      ${paragraph('Your SIM Management subscription is expiring soon. Renew now to avoid interruption to your services.')}
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="
        background: ${isUrgent ? COLORS.dangerBg : COLORS.warningBg};
        border: 1.5px solid ${isUrgent ? COLORS.dangerBdr : COLORS.warningBdr};
        border-radius: 14px;
        padding: 24px;
        margin: 20px 0;
        text-align: center;
      ">
        <tr><td>
          <p style="font-size: 13px; color: ${COLORS.textMuted}; margin: 0 0 8px; text-transform: uppercase; letter-spacing: 1px; font-weight: 600;">Time Remaining</p>
          <p style="font-size: 44px; font-weight: 600; color: ${isUrgent ? '#9B1C1C' : '#92400E'}; margin: 0; line-height: 1;">${daysRemaining}</p>
          <p style="font-size: 16px; color: ${isUrgent ? '#9B1C1C' : '#92400E'}; margin: 4px 0 12px;">day${daysRemaining !== 1 ? 's' : ''} remaining</p>
          <p style="font-size: 14px; color: ${COLORS.textMuted}; margin: 0;">Expiry Date: <strong>${expiryDate}</strong></p>
        </td></tr>
      </table>
      ${isUrgent
        ? alertBox('Your subscription expires very soon. Renew immediately to prevent service disruption and data access issues.', {
          bg: COLORS.dangerBg, border: COLORS.dangerBdr, textColor: '#991B1B', label: '&#128680; Urgent'
        })
        : ''}
      ${paragraph('Renew your subscription to continue accessing all features uninterrupted.')}
      ${ctaButton('Renew Subscription', `${config.app.frontendUrl || 'http://localhost:3000'}/subscription`, isUrgent ? '#DC2626' : '#D97706')}
    `;

    const html = baseLayout({
      headerBg: isUrgent
        ? `linear-gradient(135deg, #DC2626 0%, #991B1B 100%)`
        : `linear-gradient(135deg, #D97706 0%, #B45309 100%)`,
      headerIcon: '&#128197;',
      headerTitle: 'Subscription Expiry Notice',
      headerSubtitle: `${daysRemaining} day${daysRemaining !== 1 ? 's' : ''} remaining`,
      bodyContent: body,
    });

    return this.sendEmail({ to: company.email, subject, html });
  }

  // ─── OTP Login Email ────────────────────────────────────────────────────────

  async sendOTPEmail(email, otp, mobileNumber) {
    const subject = 'Your Login OTP — SIM Management';

    const body = `
      ${paragraph('You requested to log in to SIM Management using your mobile number. Use the one-time password below to complete your login.')}
      ${infoCard([['Mobile Number', `+91 ${mobileNumber}`]])}
      ${otpBox(otp)}
      ${alertBox(`
        <ul style="margin: 6px 0 0; padding-left: 20px; line-height: 1.8;">
          <li>This OTP is valid for <strong>5 minutes</strong></li>
          <li>Do not share this OTP with anyone</li>
          <li>If you didn't request this, please ignore this email</li>
        </ul>
      `, { bg: COLORS.warningBg, border: COLORS.warningBdr, textColor: '#92400E', label: '&#9888; Security Notice' })}
      ${paragraph('Enter this OTP in the app to complete your login.')}
    `;

    const html = baseLayout({
      headerBg: `linear-gradient(135deg, #1A56DB 0%, #1E429F 100%)`,
      headerIcon: '&#128241;',
      headerTitle: 'One-Time Password',
      headerSubtitle: 'Login verification for SIM Management',
      bodyContent: body,
      footerNote: 'This OTP is valid for 5 minutes. Never share it with anyone.',
    });

    console.log('OTP:', otp);
    return this.sendEmail({ to: email, subject, html });
  }

  isReady() {
    return this.isConfigured && this.transporter !== null;
  }
}

module.exports = new EmailService();