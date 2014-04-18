#!/usr/bin/env node
/**
 * Sample Express (mostly) static server.
 *
 * Serves up the root of the project.
 */
var express = require("express"),
  winston = require("winston"),
  winMid = require("../index"),
  app = express(),
  logOpts = {
    transports: [
      new (winston.transports.Console)({ json: true })
    ]
  };

// Middleware automatically adds request logging at finish of request.
app.use(winMid.request(logOpts, {
  type: "per-request-log"
}));

// In addition to the automatic request logging, can **manually** log within
// requests (here a custom middleware, but you get the idea...)
app.get("/custom-logging", function (req, res) {
  res.locals._log.info("This is the per-request logger object!", {
    extra: "metadata"
  });
  res.send("Custom message logged...");
});

// Configure static server.
app.use(express.static(__dirname + "/.."));


// Add server root logger.
app._log = new winMid.Log(logOpts, {
  type: "single-server-log"
});

// Start server.
app.listen(9876);
app._log.info("Started Express server at: http://127.0.0.1:9876", {
  extra: "metadata"
});
