const express = require("express");
// const bodyParser = require("body-parser");
const cookieParser = require("cookie-parser");
const session = require("express-session");
const MongoStore = require("connect-mongo");
const createError = require("http-errors");
const path = require("path");
const logger = require("morgan");
const dotenv = require("dotenv").config();
const cors = require("cors");
const helmet = require("helmet");
const hpp = require("hpp");
// const csurf = require("csurf"); Learn more about this, breaking dev rn
const rateLimit = require("express-rate-limit");

// Import routers
const apiRouter = require("./routes/api");

// Create express app and sessions
const server = express();

// Security middleware
// Sets HTTP headers to defend against common threats
server.use(helmet());
// Protects against HTTP parameter pollution
server.use(hpp());

// Use cors in dev
// Needed for cross-origin (serving front and back from different ports)
if (process.env.ENVIRONMENT == "DEV") {
  server.use(
    cors({
      origin: ["http://localhost:3000"],
      methods: ["GET", "POST"],
      credentials: true,
    })
  );
}

// Set up cookie sessions
server.use(
  session({
    name: process.env.SESS_NAME,
    resave: false,
    saveUninitialized: false,
    secret: process.env.SESS_SECRET,
    store: MongoStore.create({
      mongoUrl: `mongodb+srv://${process.env.DB_USERNAME}:${process.env.DB_PASSWORD}@cluster0.zfsde.mongodb.net/test?retryWrites=true&w=majority`,
      ttl: 24 * 60 * 60 * 1000,
      autoRemove: "native",
      collectionName: "user_sessions",
      crypto: {
        secret: process.env.MONGO_SECRET,
      },
    }),
    cookie: {
      maxAge: parseInt(process.env.SESS_LIFETIME),
      sameSite: true,
      secure: process.env.ENVIRONMENT == "PROD",
    },
  })
);

// Limit requests from same IP
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes`
  max: 100, // Set max 100 requests per {windowMs} minutes per window
  standardHeaders: true, // Return rate limit info in appropriate headers
  legacyHeaders: false,
});
// Apply limiter to api requests (static requests are unlimited)
server.use("api", limiter);

// Set up mongoose connection to MongoDB
var mongoose = require("mongoose");
var mongoDB = `mongodb+srv://${process.env.DB_USERNAME}:${process.env.DB_PASSWORD}@cluster0.zfsde.mongodb.net/?retryWrites=true&w=majority`;
mongoose.connect(mongoDB, {
  useNewUrlParser: true,
});

// Get default mongoose connection object
var db = mongoose.connection;
db.on("error", console.error.bind(console, "MongoDB connection error:"));

// Standard Apache log output from Morgan logger
server.use(logger("combined"));

// Built-in middleware for parsing cookies, json and url-encoded requests
server.use(cookieParser());
server.use(express.json());
server.use(express.urlencoded({ extended: false }));

// Specify root folder for static website assets
server.use(express.static(path.join(__dirname, "public")));

// Routes
server.use("/api", apiRouter);

// Catch 404 and forward to error handler
server.use(function (req, res, next) {
  next(createError(404));
});

// Custom error handler
server.use(function (err, req, res, next) {
  // If no 404, then respond with 500: internal server error
  res.json({
    status: "error",
    errors: [
      {
        value: "",
        msg: "Sorry, there was an internal error! Please try again.",
        param: "interal-error",
        location: "",
      },
    ],
  });
  // TODO: Send more info to client
});

module.exports = server;
