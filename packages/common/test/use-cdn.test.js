"use strict";

const nock = require("nock");
const fs = require("fs-extra");
const { expect } = require("chai");
const mockFs = require("mock-fs");
const { expectRejection } = require("expect-rejection");

const { UseCDN } = require("../use-cdn");

class FakeLogger {
  // eslint-disable-next-line class-methods-use-this
  debug() {
  }
}

const EMPTY = {
  cdns: {},
  packages: [],
};

describe("UseCDN", () => {
  let logger;

  before(() => {
    logger = new FakeLogger();
  });


  beforeEach(async () => {
    mockFs();
  });

  afterEach(() => {
    mockFs.restore();
  });


  describe("#constructor", () => {
    it("constructs", () => {
      // eslint-disable-next-line no-new
      new UseCDN([], logger);
    });
  });

  describe("#init", () => {
    it("initializes", async () => {
      // eslint-disable-next-line no-new
      const cdn = new UseCDN([], logger);
      await cdn.init();
      expect(cdn.initialized).to.be.true;
    });
  });

  describe("#resolve", () => {
    it("resolves", async () => {
      const responses = {
        __proto__: null,
        "/foo@1.0.0": [302, "", { location: "/foo@1.0.0/foo.js" }],
        "/foo@1.0.0/a.js": [200, "content of foo@1.0.0/a.js"],
        "/foo@1.0.0/b.js": [200, "content of foo@1.0.0/b.js"],
        "/bar@latest": [302, "", { location: "/bar@3.0.0" }],
        "/bar@3.0.0/else.js": [200, "content of bar@3.0.0/else.js"],
      };
      let scope = nock("https://unpkg.com");

      // eslint-disable-next-line guard-for-in
      for (const url in responses) {
        scope = scope.get(url).reply(...responses[url]);
      }

      const cdn = new UseCDN({
        cdns: {},
        packages: [{
          package: "foo",
          version: "1.0.0",
          files: [
            "a.js",
            "b.js",
          ],
        }, {
          package: "bar",
          version: "latest",
          files: [
            version => (version === "1.0.0" ? "one.zero.zero.js" : "else.js"),
          ],
        }],
      }, logger);
      await cdn.init();
      await cdn.resolve();

      expect((await fs.readFile(cdn.cache.makeFilePath("foo", "1.0.0", "a.js")))
             .toString()).to.equal(responses["/foo@1.0.0/a.js"][1]);
      expect((await fs.readFile(cdn.cache.makeFilePath("foo", "1.0.0", "b.js")))
             .toString()).to.equal(responses["/foo@1.0.0/b.js"][1]);
      expect((await fs.readFile(cdn.cache.makeFilePath("bar", "3.0.0",
                                                       "else.js")))
             .toString()).to.equal(responses["/bar@3.0.0/else.js"][1]);
      expect(await fs.readlink(cdn.cache.makePackagePath("bar", "latest")))
        .to.equal("3.0.0");

      scope.done();
    });


    it("throws if the object is not initialized", async () => {
      const cdn = new UseCDN([], logger);
      await expectRejection(cdn.resolve(), Error,
                            "the object has not been initialized");
    });
  });

  describe("#getSession", () => {
    it("throws if the object is not initialized", () => {
      const cdn = new UseCDN(EMPTY, logger);
      expect(() => cdn.getSession("unpkg"))
        .to.throw(Error, "the object has not been initialized");
    });

    it("returns the same session if called with same cdn", async () => {
      const cdn = new UseCDN(EMPTY, logger);
      await cdn.init();
      expect(cdn.getSession("unpkg")).to.equal(cdn.getSession("unpkg"));
    });

    it("throws if called with an unsupported cdn", async () => {
      const cdn = new UseCDN(EMPTY, logger);
      await cdn.init();
      expect(() => cdn.getSession("cdnjs"))
        .to.throw(Error, "unsupported cdn: cdnjs");
    });
  });
});
