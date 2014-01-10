/*!
 * express-winston-middleware
 * -------
 * Winston log wrappers for Express.
 */

/**
 * Logging wrapper.
 *
 * Binds configurations to actual Winston loggers and adds some common
 * helpers.
 */
var os = require("os"),
  cluster = require("cluster"),
  url = require("url"),
  _ = require("lodash"),
  winston = require("winston"),
  levels = winston.config.syslog.levels,
  hostName = os.hostname(),
  workerId,
  serverId,
  utils,
  middleware,
  Log;

// ----------------------------------------------------------------------------
// Helpers.
// ----------------------------------------------------------------------------
utils = {
  clientIp:  function (req) {
    var forwards = req.header("x-forwarded-for"),
      ipAddr = req.connection.remoteAddress,
      firstIp,
      ips;

    if (forwards) {
      ips = forwards.split(",");
      firstIp = (ips[0] || "").replace(/^\s+|\s+$/, "");
      if (firstIp) {
        return firstIp;
      }
    }

    return ipAddr;
  }
};

// ----------------------------------------------------------------------------
// Middleware.
// ----------------------------------------------------------------------------
middleware = {
  /**
   * `request(opts, baseMeta)` - Express request middleware
   *
   * Creates a middleware function using base metadata. Integration:
   *
   * ```
   * app.use(winMid.request({
   *   transports: [ new (winston.transports.Console)({ json: true }) ]
   * }, { foo: "bar" }));
   * ```
   *
   * Once integrated, a logger will be attached to the response locals,
   * and available as `res.locals._log`.
   *
   * @param {Object} opts     Winston logger options.
   * @param {Object} baseMeta Metadata for all log statements.
   * @api public
   */
  request: function (opts, baseMeta) {
    return function (req, res, next) {
      // Create logger and attach to locals.
      var log = res.locals._log = new Log(opts, baseMeta),
        _end = res.end;

      // Add request.
      log.addReq(req);

      // Proxy end (what connect.logger does) to get status code.
      res.end = function (chunk, encoding) {
        var status = res.statusCode,
          level = "info";

        // Unwind and call underlying end.
        res.end = _end;
        res.end(chunk, encoding);

        // Allow controllers to wipe out logger.
        if (!res.locals._log) { return; }

        // Adjust level to reflect HTTP status.
        level = 400 <= status && status < 500 ? "warning" : level;
        level = 500 <= status                 ? "error"   : level;

        // Add response info and log out.
        log.addRes(res);
        log[level]("request");
      };

      return next();
    };
  },

  /**
   * `error(opts, baseMeta)` - Express error middleware
   *
   * Creates a middleware function for Express. Integration:
   *
   * ```
   * app.use(winMid.error({
   *   transports: [ new (winston.transports.Console)({ json: true }) ]
   * }, { foo: "bar" }));
   * ```
   *
   * @param {Object} opts     Winston logger options.
   * @param {Object} baseMeta Metadata for log statements.
   * @api public
   */
  error: function (opts, baseMeta) {
    var meta = _.extend({ type: "unhandled_error" }, baseMeta);

    return function (err, req, res, next) {
      // Create logger and add objects.
      (new Log(opts, meta))
        .addReq(req)
        .addRes(res)
        .addError(err)
        .error("unhandled error");

      // Pass to underlying Express handler.
      next(err);
    };
  },

  /**
   * `uncaught(opts, baseMeta)` - Global uncaught exception handler
   *
   * Creates a handler function for any uncaught exception. Integration:
   *
   * ```
   * process.on("uncaughtException", winMid.uncaught({
   *   transports: [ new (winston.transports.Console)({ json: true }) ]
   * }, { foo: "bar" }));
   * ```
   *
   * **Note**: Terminates process at end.
   *
   * @param {Object} opts     Winston logger options.
   * @param {Object} baseMeta Metadata for log statements.
   * @api public
   */
  uncaught: function (opts, baseMeta) {
    var meta = _.extend({ type: "uncaught_exception" }, baseMeta);

    return function (err) {
      try {
        // Try real logger.
        return (new Log(opts, meta))
          .addError(err)
          .error("Uncaught exception");

      } catch (other) {
        // Else, give up and use straight console logging.
        console.log((err || {}).stack || err || "Unknown");
        console.log("Error: Hit additional error logging the previous error.");
        console.log((other || {}).stack || other || "Unknown");
        return;

      } finally {
        process.exit(1);
      }
    };
  }
};

// ----------------------------------------------------------------------------
// Stashed variables.
// ----------------------------------------------------------------------------

/*!
 * Infer worker id or master.
 */
workerId = process.env.NODE_WORKER_ID || (cluster.worker || {}).id || null;
serverId = workerId ? "w" + workerId : "m";

// ----------------------------------------------------------------------------
// Classes.
// ----------------------------------------------------------------------------
/**
 * `Log(opts, baseMeta)` - Logger class.
 *
 * Wraps Winston logger with additional functionality.
 *
 * ```
 * var log = new winMid.Log({
 *   transports: [ new (winston.transports.Console)({ json: true }) ]
 * }, { foo: "bar" }));
 * ```
 *
 * @param {Object} opts     Winston logger options.
 * @param {Object} baseMeta Metadata for all log statements.
 * @api public
 */
Log = function (opts, baseMeta) {
  var self = this;

  // Update options.
  opts = _.extend({
    levels: levels
  }, opts);

  // Create internal, real Winston logger.
  this._log = new winston.Logger(opts);

  // Meta for all log statements.
  this._meta = _.merge({
    env: process.env.NODE_ENV || "development",
    server: {
      id: serverId,
      pid: process.pid,
      hostName: hostName
    }
  }, baseMeta);

  // Iterate and patch all log levels.
  _.each(opts.levels, function (num, level) {
    self[level] = function (msg, metaOrCb, callback) {
      var meta = _.extend({ date: (new Date()).toISOString(), }, this._meta),
        args = [msg, meta];

      // Extend with user-passed meta, if applicable.
      if (_.isObject(metaOrCb)) {
        _.extend(meta, metaOrCb, {});
      }

      // Infer arguments per Winston calling conventions.
      if (arguments.length === 2 && _.isFunction(metaOrCb)) {
        // Push callback to end.
        args = [msg, meta, metaOrCb];

      } else if (arguments.length > 2) {
        // In order already.
        args = [msg, meta, callback];
      }

      // Call real logger.
      return this._log[level].apply(this._log, args);
    };
  });
};

/**
 * `Log.addMeta(meta)`
 *
 * Add arbitrary meta to all subsequent log statements.
 *
 * @param {Object} meta Metadata object.
 * @api public
 */
Log.prototype.addMeta = function (meta) {
  _.merge(this._meta, meta);

  return this;
};

/**
 * `Log.addReq(req)`
 *
 * Add request to meta.
 *
 * @param {Object} req Request object.
 * @api public
 */
Log.prototype.addReq = function (req) {
  var maxChars = 200,
    urlObj = url.parse(req.url);

  this.addMeta({
    req: {
      method: req.method,
      host: req.headers.host,
      path: (urlObj.pathname || "").substr(0, maxChars),
      query: (urlObj.query || "").substr(0, maxChars),
      client: {
        ip: utils.clientIp(req)
      }
    }
  });

  return this;
};

/**
 * `Log.addRes(res)`
 *
 * Add response to meta.
 *
 * @param {Object} res Response object.
 * @api public
 */
Log.prototype.addRes = function (res) {
  this.addMeta({
    res: {
      statusCode: res.statusCode
    }
  });

  return this;
};

/**
 * `Log.addError(err)`
 *
 * Add error to meta.
 *
 * @param {Error} err Error object.
 * @api public
 */
Log.prototype.addError = function (err) {
  var maxChars = 200;

  this.addMeta({
    err: {
      msg: _.isNull(err.message) ? err.toString() : err.message,
      args: (err.arguments || "").toString().substr(0, maxChars),
      type: err.type || null,
      stack: (err.stack || "").split("\n"),
    }
  });

  return this;
};

module.exports = {
  Log: Log,
  request: middleware.request,
  uncaught: middleware.uncaught,
  error: middleware.error
};
