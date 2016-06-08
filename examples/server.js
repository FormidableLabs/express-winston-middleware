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

// Uncaught exception handler.
process.on("uncaughtException", winMid.uncaught(logOpts, {
  extra: "uncaught"
}));

// Middleware automatically adds request logging at finish of request.
app.use(winMid.request(logOpts, {
  type: "per-request-log"
}));
app.use(winMid.error(logOpts, {
  type: "error-log"
}));

// In addition to the automatic request logging, can **manually** log within
// requests (here a custom middleware, but you get the idea...)
app.get("/custom-logging", function (req, res) {
  res.locals._log.info("This is the per-request logger object!", {
    extra: "metadata"
  });
  res.send("Custom message logged...");
});
app.get("/add-meta", function (req, res) {
  res.locals._log
    .addMeta({
      extra: "addMeta-meta"
    })
    .info("This is the per-request logger object!");

  res.send("Custom add-meta logged...");
});
app.get("/transform-meta", function (req, res) {
  var log = res.locals._log
    .transformMeta(function (meta) {
      return {
        oldReq: meta.req,
        totallyNew: "totally new stuff"
      };
    });

  log.info("This is the per-request logger object!");
  log.warn("This is extra custom log with callback", function () {
    // Do a console log so we don't have our logger everywhere...
    console.log("CONSOLE: CALLED BACK");
  });

  res.send("Custom transform-meta logged...");
});

app.get("/error", function (req, res, next) {
  next(new Error("Error!"));
});
app.get("/uncaught", function () {
  throw new Error("Uncaught exception!");
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
