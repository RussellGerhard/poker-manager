const nodemailer = require("nodemailer");
const hbs = require("nodemailer-express-handlebars");

async function sendEmail({ username, recipient, subject, link }) {
  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      secure: true,
      auth: {
        user: process.env.EMAIL,
        pass: process.env.EMAIL_APP_KEY,
      },
    });

    transporter.use(
      "compile",
      hbs({
        viewEngine: {
          layoutsDir: "./views/",
        },
        viewPath: "./views/layouts",
      })
    );

    transporter.sendMail({
      from: process.env.EMAIL,
      to: recipient,
      subject: subject,
      template: "forgotPassword",
      context: { username: username, link: link },
    });
  } catch (err) {
    throw new Error("Failed to send email");
  }
}

module.exports = sendEmail;
