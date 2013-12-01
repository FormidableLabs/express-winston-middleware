Winston Middleware for Express
==============================

`express-winston-middleware` provides [Winston][winston] log wrappers and
middleware for [Express][express].

## Usage

You can install `express-winston-middleware` using [NPM][npm]:

```
$ npm install express-winston-middleware
```

## API

* [`request(object)` - Request middleware](#-request-object-request-middleware)
* [`Log(object)` - Logger class.](#-log-object-logger-class-)
* [`Log.addReq(req)`](#-log-addreq-req-)
* [`Log.addRes(res)`](#-log-addres-res-)

### `request(object)` - Request middleware

Creates a middleware function using base metadata. Integration:

```
app.use(winMid.request({ foo: "bar" }));
```

Once integrated, a logger will be attached to the response locals,
and available as `res.locals._log`.

### `Log(object)` - Logger class.

Wraps Winston logger with additional functionality.

```
var log = new winMid.Log({ foo: "bar" }));
```

### `Log.addReq(req)`

Add request to meta.

### `Log.addRes(res)`

Add response to meta.

## Integration

TODO: Integration

## Contributions

Please see the [Contributions Guide](./CONTRIBUTING.md) for how to help out
with the plugin.

## Licenses
All code is Copyright 2013 Ryan Roemer.
Released under the [MIT](./LICENSE.txt) License.

[winston]: https://github.com/flatiron/winston
[express]: http://expressjs.com/
[npm]: https://npmjs.org/package/express-winston-middleware
