var express = require("express");
var createError = require("http-errors");
var path = require("path");
var logger = require("morgan");
var dotenv = require("dotenv").config();
var cors = require("cors");

// Import routers
var apiRouter = require("./routes/api");

// Create express app
var server = express();

// Use cors in dev
// Needed for cross-origin (serving front and back from different ports)
if (process.env.ENVIRONMENT == "DEV") {
  server.use(cors());
}

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

// Built-in middleware for parsing json and url-encoded requests
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
