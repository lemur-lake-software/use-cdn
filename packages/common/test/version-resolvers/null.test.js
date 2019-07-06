"use strict";

const { expect } = require("chai");
const mockFs = require("mock-fs");

const { WritableCache } = require("../../caching");
const { NullVersionResolver } = require("../../version-resolvers/null");

class FakeLogger {
  // eslint-disable-next-line class-methods-use-this
  debug() {
  }
}

describe("NullVersionResolver", () => {
  let logger;
  let cache;

  before(() => {
    logger = new FakeLogger();
  });

  beforeEach(async () => {
    mockFs();
    cache = new WritableCache();

    await cache.init();
  });

  afterEach(() => {
    mockFs.restore();
  });

  describe("#constructor", () => {
    it("constructs", () => {
      // eslint-disable-next-line no-new
      new NullVersionResolver(undefined, logger, cache);
    });
  });

  describe("#fetchVersion", () => {
    let resolver;

    beforeEach(() => {
      resolver = new NullVersionResolver(undefined, logger, cache);
    });

    it("resolves", async () => {
      expect(await resolver.fetchVersion("jquery", "3.4.1"))
        .to.equal("3.4.1");
      expect(await resolver.fetchVersion("jquery", "latest"))
        .to.equal("latest");
    });
  });
});
