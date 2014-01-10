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

// Configure server.
app.use(winMid.request(logOpts, {
  type: "per-request-log"
}));
app.use(express.static(__dirname + "/.."));

// Add server-side logger.
app._log = new winMid.Log(logOpts, {
  type: "single-server-log"
});

// Start server.
app.listen(9876);
app._log.info("Started Express server at: http://127.0.0.1:9876");
