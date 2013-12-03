
var Log = require("..").Log;

describe("Log", function () {
  describe("constructor", function () {
    it("should handle base cases", function () {
      expect(Log).to.be.ok;
      expect(new Log()).to.be.a("object");
      expect(new Log({})).to.be.a("object");
      expect(new Log({}, {})).to.be.a("object");
    });
  });
});
