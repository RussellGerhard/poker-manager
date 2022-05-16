var express = require("express");
var createError = require("http-errors");
var path = require("path");
var logger = require("morgan");
var dotenv = require("dotenv").config();
var MongoStore = require("connect-mongo");
var session = require("express-session");

var server = express();

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

// TODO: ROUTING

// Catch 404 and forward to error handler
server.use(function (req, res, next) {
  next(createError(404));
});

// Custom error handler
server.use(function (err, req, res, next) {
  // If no 404, then respond with 500: internal server error
  res.status(err.status || 500);
  // TODO: Send more info to client
});

module.exports = server;
