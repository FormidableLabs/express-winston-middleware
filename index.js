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
   * ```js
   * app.use(winMid.request({
   *   transports: [ new (winston.transports.Console)({ json: true }) ]
   * }, { foo: "bar" }));
   * ```
   *
   * Once integrated, a logger will be attached to the response locals,
   * and available as `res.locals._log`. The logger will then be removed at
   * the end of the request.
   *
   * @param {Object} opts             Winston logger options.
   * @param {Object} baseMeta         Metadata for all log statements.
   * @api public
   */
  request: function (opts, baseMeta) {
    // Stash singleton logger for all requests.
    var singleton = new winston.Logger(opts);

    return function (req, res, next) {
      // Create logger and attach to locals.
      res.locals._log = new Log(_.extend({
        singleton: singleton
      }, opts), baseMeta);
      var _end = res.end;

      // Add request.
      res.locals._log.addReq(req);

      // Proxy end (what connect.logger does) to get status code.
      res.end = function (chunk, encoding) {
        var status = res.statusCode,
          level;

        // Unwind and call underlying end.
        res.end = _end;
        res.end(chunk, encoding);

        // Allow controllers to wipe out logger.
        if (!res.locals._log) { return; }

        // Choose a warning and error level.
        var levels = res.locals._log.levels;

        // Find "lowest" and "highest" numbered levels.
        // Frustratingly, for `cli`, `npm` low = info, high = error, but
        // `syslog` is **reversed**. :(
        var orderedLevels = _(levels)
          .pairs()
          .sortBy(function (p) { return p[1]; })
          .map(function (p) { return p[0]; })
          .value();
        var lowLevel = _.first(orderedLevels);
        var highLevel = _.last(orderedLevels);

        // These _might_ not exist.
        // Choose in order of preference and be permissive.
        /*jshint sub:true*/
        if (400 <= status && status < 500) {
          // A "Warning".
          level = level || (levels["warning"] && "warning");
          level = level || (levels["warn"] && "warn");
          level = level || highLevel;
        } else if (500 <= status) {
          // An "Error"
          level = level || (levels["error"] && "error");
          level = level || (levels["crit"] && "crit");
          level = level || highLevel;
        } else {
          // "Info"
          level = level || (levels["info"] && "info");
          level = level || lowLevel;
        }
        /*jshint sub:false*/

        // Add response info and log out.
        res.locals._log.addRes(res);
        res.locals._log[level]("request");

        // Remove local logger.
        delete res.locals._log;
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
    // Stash singleton logger for all requests.
    var singleton = new winston.Logger(opts);
    var meta = _.extend({ type: "unhandled_error" }, baseMeta);

    return function (err, req, res, next) {
      // Create logger and add objects.
      (new Log(_.extend({ singleton: singleton }, opts), meta))
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
    // Stash singleton logger for all requests.
    var singleton = new winston.Logger(opts);
    var meta = _.extend({ type: "unhandled_error" }, baseMeta);

    return function (err) {
      try {
        // Try real logger.
        return (new Log(_.extend({ singleton: singleton }, opts), meta))
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
 * @param {Object} opts             Winston logger options.
 * @param {Object} opts.singleton   Optional singleton Winston logger to use.
 * @param {Object} baseMeta         Metadata for all log statements.
 * @api public
 */
Log = function (opts, baseMeta) {
  // Stash self and any singleton designated.
  var self = this;
  var singleton = (opts || {}).singleton;

  // Update options.
  opts = _.omit(opts, "singleton");

  // Create internal, real Winston logger.
  this._log = singleton || new winston.Logger(opts);

  // Expose levels.
  this.levels = this._log.levels;

  // Meta for all log statements.
  this._meta = _.merge({
    env: process.env.NODE_ENV || "development",
    server: {
      id: serverId,
      pid: process.pid,
      hostName: hostName
    }
  }, baseMeta);

  // Passthrough transform function.
  this._metaTransformFn = null;

  // Iterate and patch all log levels.
  _.each(this.levels, function (num, level) {
    self[level] = function (msg, metaOrCb, callback) {
      var meta = _.extend({ date: (new Date()).toISOString(), }, this._meta),
        args;

      // Extend with user-passed meta, if applicable.
      if (_.isObject(metaOrCb)) {
        _.extend(meta, metaOrCb, {});
      }

      // Apply final transform, if any.
      if (self._metaTransformFn) {
        meta = self._metaTransformFn(_.cloneDeep(meta));
      }

      // Infer arguments per Winston calling conventions.
      if (arguments.length === 2 && _.isFunction(metaOrCb)) {
        // Push callback to end.
        args = [msg, meta, metaOrCb];

      } else if (arguments.length > 2) {
        // In order already.
        args = [msg, meta, callback];

      } else {
        // No callback.
        args = [msg, meta];
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
 * `Log.transformMeta(fn)`
 *
 * Set a delayed single transform function to mutate a **copy** of the metadata
 * _right before_ a logging event. You can only presently have **one** such
 * function. And it is delayed so that for things like request end, you can
 * effectively access **all** the metadata.
 *
 * The transform is applied on each log call and passes a copy of the mutated
 * metadata to the actual log call.
 *
 * The function signature should be `fn(existingMeta)` and return mutated
 * metadata.
 *
 * @param {Function} fn Transform function.
 * @api public
 */
Log.prototype.transformMeta = function (fn) {
  this._metaTransformFn = fn;

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
