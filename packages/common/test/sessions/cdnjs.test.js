"use strict";

const sinonChai = require("sinon-chai");
const { expect, use } = require("chai");
const mockFs = require("mock-fs");

const { WritableCache } = require("../../caching");
const { CdnjsSession } = require("../../sessions/cdnjs");
const { NullVersionResolver } = require("../../version-resolvers/null");

use(sinonChai);

class FakeLogger {
  // eslint-disable-next-line class-methods-use-this
  debug() {
  }
}

describe("CdnjsSession", () => {
  let logger;
  let cache;
  let resolver;

  before(() => {
    logger = new FakeLogger();
  });

  beforeEach(async () => {
    mockFs();
    cache = new WritableCache();

    await cache.init();
    resolver = new NullVersionResolver(undefined, logger, cache);
  });

  afterEach(() => {
    mockFs.restore();
  });

  describe("#constructor", () => {
    it("constructs", () => {
      // eslint-disable-next-line no-new
      new CdnjsSession(undefined, logger, cache, resolver);
    });
  });

  describe("#makeFileUrl", () => {
    it("makes a file URL", () => {
      const session = new CdnjsSession(undefined, logger, cache, resolver);
      expect(session.makeFileUrl("foo", "1.0.0", "dist/foo.js")).to
        .equal("https://cdnjs.cloudflare.com/ajax/libs/foo/1.0.0/dist/foo.js");
    });

    it("uses the ``url`` configuration options", () => {
      const session = new CdnjsSession({ url: "https://mirror/" }, logger,
                                       cache, resolver);
      expect(session.makeFileUrl("foo", "1.0.0", "dist/foo.js"))
        .to.equal("https://mirror/ajax/libs/foo/1.0.0/dist/foo.js");
    });
  });

  describe("#makePackageUrl", () => {
    it("makes a package URL", () => {
      const session = new CdnjsSession(undefined, logger, cache, resolver);
      expect(session.makePackageUrl("foo", "1.0.0"))
        .to.equal("https://cdnjs.cloudflare.com/ajax/libs/foo/1.0.0");
    });

    it("uses the ``url`` configuration options", () => {
      const session = new CdnjsSession({ url: "https://mirror/" }, logger,
                                       cache, resolver);
      expect(session.makePackageUrl("foo", "1.0.0"))
        .to.equal("https://mirror/ajax/libs/foo/1.0.0");
    });
  });
});
