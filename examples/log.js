#!/usr/bin/env node

var winston = require("winston");
var Log = require("../index").Log;

// Create logger with Console transport and "foo" metadata item.
var log = new Log({
  transports: [
    new (winston.transports.Console)({ json: true })
  ]
}, {
  foo: "bar"
});

// Log something.
log.info("Hello World!");
