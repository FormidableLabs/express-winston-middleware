var _ = require("lodash"),
  chai = require("chai"),
  sinonChai = require("sinon-chai"),
  winston = require("winston"),
  levelsMax = _.keys(winston.config.syslog.levels).length - 1;

global.sinon = require("sinon");
global.expect = chai.expect;

chai.use(sinonChai);

/*!
 * Monkey-patch Winston log levels.
 *
 * **Note**: https://github.com/flatiron/winston/issues/249 - Winston fixed
 * log level numbers for Syslog per spec, but this reversed the order such
 * that a Console transport at "info" won't get a "warning", but will get
 * a "debug". We manually reverse the keys here.
 */
winston.config.syslog.levels = _.chain(winston.config.syslog.levels)
  // Convert to [name, NEW_NUM].
  .map(function (num, name) { return [name, Math.abs(num - levelsMax)]; })
  // Convert back to object.
  .object()
  .value();
