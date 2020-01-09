"use strict";

const { expect } = require("chai");

// eslint-disable-next-line no-shadow
const { setup, getLogger } = require("../logger");

describe("logger", () => {
  describe("setup", () => {
    it("runs", () => {
      setup("ALL");
    });
  });
  describe("getLogger", () => {
    it("returns the same logger when called with the same name", () => {
      expect(getLogger("foo")).to.equal(getLogger("foo"));
    });

    it("returns a different logger when called with a different name", () => {
      expect(getLogger("foo")).to.not.equal(getLogger("bar"));
    });
  });
});
