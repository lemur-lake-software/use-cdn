"use strict";

const nock = require("nock");
const fs = require("fs-extra");
const chai = require("chai");
const mockFs = require("mock-fs");
const { expectRejection, use: erUse } = require("expect-rejection");

const { UseCDN } = require("../use-cdn");
const { NPMVersionResolver } = require("../version-resolvers/npm");
const { UnpkgSession: { NativeResolver: UnpkgVersionResolver } } =
      require("../sessions/unpkg");
const jqueryJSON = require("./version-resolvers/jquery");
const { triggerLazyLoading } = require("./testutil");

const { expect } = chai;
erUse(chai);

class FakeLogger {
  // eslint-disable-next-line class-methods-use-this
  debug() {
  }
}

const EMPTY = {
  cdns: {
    unpkg: {
      resolver: "native",
    },
  },
  resolvers: {},
  packages: [],
};

describe("UseCDN", () => {
  let logger;

  before(() => {
    logger = new FakeLogger();
    triggerLazyLoading();
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
        cdns: {
          unpkg: {
            resolver: "native",
          },
        },
        resolvers: {},
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

    it("honors the top-level cdn setting", async () => {
      const npm = nock("https://registry.npmjs.org/")
          .get("/jquery")
          .reply(200, jqueryJSON);

      const cdnjs = nock("https://cdnjs.cloudflare.com/")
          .get("/ajax/libs/jquery/3.4.1/a.js")
          .reply(200, "a.js content");

      const cdn = new UseCDN({
        cdn: "cdnjs",
        cdns: {},
        resolvers: {},
        packages: [{
          package: "jquery",
          version: "latest",
          files: [
            "a.js",
          ],
        }],
      }, logger);
      await cdn.init();
      await cdn.resolve();

      expect((await fs.readFile(cdn.cache.makeFilePath("jquery", "3.4.1", "a.js")))
             .toString()).to.equal("a.js content");
      expect(await fs.readlink(cdn.cache.makePackagePath("jquery", "latest")))
        .to.equal("3.4.1");

      npm.done();
      cdnjs.done();
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
      expect(() => cdn.getSession("nonexistent"))
        .to.throw(Error, "unsupported cdn: nonexistent");
    });

    it("throws if with a resolver having a CDN name", async () => {
      const cdn = new UseCDN({
        cdns: {
          unpkg: {
            resolver: "unpkg",
          },
        },
        resolvers: {},
        packages: [],
      }, logger);
      await cdn.init();
      expect(() => cdn.getSession("unpkg"))
        .to.throw(Error, `you may not use a session name as a resolver name, to
specify the resolver native to a session, use "native"`);
    });

    it("creates a CND with the right resolver", async () => {
      const cdn = new UseCDN({
        cdns: {},
        resolvers: {},
        packages: [],
      }, logger);
      await cdn.init();
      const session = cdn.getSession("unpkg");
      expect(session).to.have.nested.property("resolver")
        .instanceOf(NPMVersionResolver);
    });

    it("creates a native resolver", async () => {
      const cdn = new UseCDN({
        cdns: {
          unpkg: {
            resolver: "native",
          },
        },
        resolvers: {},
        packages: [],
      }, logger);
      await cdn.init();
      const session = cdn.getSession("unpkg");
      expect(session).to.have.property("resolver")
        .instanceOf(UnpkgVersionResolver);
    });
  });

  describe("#getVersionResolver", () => {
    it("throws if the object is not initialized", () => {
      const cdn = new UseCDN(EMPTY, logger);
      expect(() => cdn.getVersionResolver("foo"))
        .to.throw(Error, "the object has not been initialized");
    });

    it("returns the same resolver if called with same name", async () => {
      const cdn = new UseCDN(EMPTY, logger);
      await cdn.init();
      expect(cdn.getVersionResolver("npm")).to
        .equal(cdn.getVersionResolver("npm"));
    });

    it("throws if called with an unsupported resolver", async () => {
      const cdn = new UseCDN(EMPTY, logger);
      await cdn.init();
      expect(() => cdn.getVersionResolver("cdnjs"))
        .to.throw(Error, "unsupported resolver: cdnjs");
    });

    it("creates a native resolver", async () => {
      const cdn = new UseCDN(EMPTY, logger);
      await cdn.init();
      expect(cdn.getVersionResolver("unpkg")).to.be
        .instanceOf(UnpkgVersionResolver);
    });
  });
});
