"use strict";

const { expect } = require("chai");

const { applyOverride, isTag, __test } = require("../util");

describe("util", () => {
  describe("isTag", () => {
    for (const x of [
      "1.2.3",
      "1",
    ]) {
      it(`should return false on ${x}`, () => {
        expect(isTag(x)).to.be.false;
      });
    }

    for (const x of [
      "a",
      "a.1",
      "latest",
    ]) {
      it(`should return true on ${x}`, () => {
        expect(isTag(x)).to.be.true;
      });
    }
  });

  describe("applyOverride", () => {
    let orig;
    before(() => {
      orig = process.env.USE_CDN_OVERRIDES;
    });

    after(() => {
      process.env.USE_CDN_OVERRIDES = orig;
    });

    afterEach(() => {
      __test.resetOverrides();
    });

    describe("does not override", () => {
      it("when env is set to the empty string", () => {
        process.env.USE_CDN_OVERRIDES = "";
        expect(applyOverride("foo", "1.2.3")).to.equal("1.2.3");
      });

      it("when env is for packages we don't use", () => {
        process.env.USE_CDN_OVERRIDES = "bar@1 baz@3";
        expect(applyOverride("foo", "1.2.3")).to.equal("1.2.3");
      });
    });

    describe("overrides", () => {
      it("when env is set to a package we are using", () => {
        process.env.USE_CDN_OVERRIDES = "foo@3 bar@1 baz@3";
        expect(applyOverride("foo", "1.2.3")).to.equal("3");
      });

      it("when env is set to a package we are using", () => {
        process.env.USE_CDN_OVERRIDES = "bar@1 baz@3 foo@3";
        expect(applyOverride("foo", "1.2.3")).to.equal("3");
      });
    });

    describe("throws", () => {
      it("when env contains a package without version", () => {
        process.env.USE_CDN_OVERRIDES = "foo@3 bar baz@3";
        expect(() => applyOverride("foo", "1.2.3"))
          .to.throw(Error, "package bar overriden without a version \
specification");
      });

      it("when env contains a malformed package", () => {
        process.env.USE_CDN_OVERRIDES = "bar@1 baz@3@3 foo@3";
        expect(() => applyOverride("foo", "1.2.3"))
          .to.throw(Error, "the setting baz@3@3 in the environment override is \
malformed");
      });
    });
  });
});
