
var _ = require("lodash"),
  Log = require("..").Log,
  Transport = require("./support/transport").Fake;

describe("Log", function () {
  describe("constructor", function () {
    it("should handle base cases", function () {
      expect(Log).to.be.ok;
      expect(new Log()).to.be.a("object");
      expect(new Log({})).to.be.a("object");
      expect(new Log({}, {})).to.be.a("object");
    });

    it("should handle options and meta", function () {
      expect(new Log({
        transports: [new Transport()]
      })).to.be.a("object");

      expect(new Log({
        transports: [new Transport()]
      }, { foo: "bar" })).to.be.a("object");
    });
  });

  describe("log", function () {
    beforeEach(function () {
      var transport = new Transport();

      this.logStub = transport.log;
      this.log = new Log({
        level: "info",
        transports: [transport]
      }, { foo: "bar" });
    });

    it("should log appropriate levels", function () {
      var call;

      this.log.debug("shouldn't be called", { baz: "fun" });
      expect(this.logStub).to.not.be.called;

      this.log.info("msg", { baz: "fun" });
      call = this.logStub.getCall(0);

      expect(this.logStub).to.be.calledOnce;
      expect(call).to.be.calledWith("info", "msg");
      expect(_.pick(call.args[2], "foo", "baz")).to.eql({
        foo: "bar",
        baz: "fun"
      });

      this.log.warning("msg2", { boo: "time" });
      call = this.logStub.getCall(1);

      expect(this.logStub).to.be.calledTwice;
      expect(call).to.be.calledWith("warning", "msg2");
      expect(_.pick(call.args[2], "foo", "boo")).to.eql({
        foo: "bar",
        boo: "time"
      });

    });
  });

});
