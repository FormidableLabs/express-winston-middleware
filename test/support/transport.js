/*!
 * A sinon-based fake Winston transport.
 */
var util = require("util"),
  sinon = require("sinon"),
  Transport = require("winston").Transport,
  Fake;

/**
 * Fake sinon-transport.
 *
 * Stores calls in `this.log`.
 */
Fake = function (options) {
  Transport.call(this, options);

  // Stub: level, msg, meta, callback(null, true)
  this.log = sinon.stub().callsArgWith(3, null, true);
};

/**
 * Inherit from `winston.Transport`.
 */
util.inherits(Fake, Transport);

/**
 * Expose the name of this Transport on the prototype
 */
Fake.prototype.name = "fake";

module.exports = {
  Fake: Fake
};
