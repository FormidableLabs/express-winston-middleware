History
=======

## 0.1.0

* Add `transformMeta()` function. ([@zianwar][])

## 0.0.6

* Permissively infer `error`, `warn|warning` levels for request logger. ([@slooker][])
  Fixes [#9](https://github.com/FormidableLabs/express-winston-middleware/issues/9).

## 0.0.5

* Switch to internal Winston logger. ([@didebeach][])
  Fixes [#3](https://github.com/FormidableLabs/express-winston-middleware/issues/3).
* Explicitly delete the request logger.

## 0.0.4

* Add client IP request metadata (with logic to get past LB).
* Add `examples/server.js` Express server with request logging.

## 0.0.3

* Start adding in tests (many still pending).
* Add `baseMeta` option to `error`, `uncaught` handlers.

## 0.0.2

* Add `error`, `uncaught` handlers.
* Add `Log.addMeta()`, `Log.addError()` method.

## 0.0.1

* Initial release.

[@ryan-roemer]: https://github.com/ryan-roemer
[@didebeach]: https://github.com/didebeach
[@slooker]: https://github.com/slooker
[@zianwar]: https://github.com/zianwar
