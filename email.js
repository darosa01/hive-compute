const nodemailer = require('nodemailer');
const mailCredentials = require('./mail-credentials.js');

class Email{

  #transporter;

  constructor(){
    this.#transporter = nodemailer.createTransport({
      host: "smtp.servidor-correo.net",
      port: 587,
      secure: false, // upgrade later with STARTTLS
      auth: mailCredentials
    });
  }

  sendHTMLMail(to, subject, html){
    var mailOptions = {
      from: 'admin@perseus.cat',
      to: to,
      subject: subject,
      html: html
    };

    this.#transporter.sendMail(mailOptions, function(error, info){
      if (error) {
        console.log(error);
      } else {
        console.log('Email sent: ' + info.response);
      }
    });
  }

  sendWelcomeMail(email, password){
    var subject = "User created - Your HiveCompute credentials";

    var html = 
    `
      <h1>Welcome to HiveCompute!</h1>
      <p>You have been registered on the platform as a researcher.</p>
      <p>To access your account, access the url <a href="https://hivecompute.perseus.cat/entities">"hivecompute.perseus.cat/entities"</a> and use your email and the following password:
      <b>` + password + `
      </b></p>
      <p>Remember to change the password the next time you use the platform.</p>
      <hr>
      <small>This is an automatic email. Do not reply to this message. Thank you!</small>
    `;

    this.sendMail(email, subject, html);
  }
}

module.exports = Email;
