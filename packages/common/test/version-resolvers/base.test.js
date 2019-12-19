"use strict";

const sinon = require("sinon");
const sinonChai = require("sinon-chai");
const fs = require("fs-extra");
const chai = require("chai");
const mockFs = require("mock-fs");
const { expectRejection, use: erUse } = require("expect-rejection");

const { WritableCache } = require("../../caching");
const { BaseVersionResolver } = require("../../version-resolvers/base");

const { expect, use } = chai;
use(sinonChai);
erUse(chai);

class FakeLogger {
  // eslint-disable-next-line class-methods-use-this
  debug() {
  }
}

class DefaultResolver extends BaseVersionResolver {
  // eslint-disable-next-line class-methods-use-this
  fetchVersion() {}
}

describe("BaseVersionResolver", () => {
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
      new BaseVersionResolver(logger, cache);
    });

    it("sets ``logger``", () => {
      const resolver = new BaseVersionResolver(logger, cache);
      expect(resolver).to.have.property("logger").equal(logger);
    });

    it("sets ``cache``", () => {
      const resolver = new BaseVersionResolver(logger, cache);
      expect(resolver).to.have.property("cache").equal(cache);
    });
  });

  describe("#resolveToVersion", () => {
    let resolver;
    let stub;

    beforeEach(() => {
      resolver = new DefaultResolver(logger, cache);
    });

    describe("when passed something which exists", () => {
      beforeEach(() => {
        stub = sinon.stub(resolver, "fetchVersion").returns("3.4.1");
      });

      describe("and has not been resolved by the session yet", () => {
        describe("and resolves to itself", () => {
          it("resolves", async () => {
            expect(await resolver.resolveToVersion("jquery", "3.4.1"))
              .to.equal("3.4.1");
            expect(stub).to.have.been.calledOnce;
          });

          it("does not record the version in the cache", async () => {
            expect(await resolver.resolveToVersion("jquery", "3.4.1"))
              .to.equal("3.4.1");
            expect(await fs.exists(cache.makePackagePath("jquery", "3.4.1")))
              .to.be.false;
            expect(stub).to.have.been.calledOnce;
          });
        });

        describe("and resolves to a new version", () => {
          it("records the version in the cache", async () => {
            expect(await resolver.resolveToVersion("jquery", "3"))
              .to.equal("3.4.1");
            expect(await fs.readlink(cache.makePackagePath("jquery", "3")))
              .to.be.equal("3.4.1");
          });
        });
      });

      describe("and has been resolved by the same session", () => {
        it("resolves by calling ``fetchVersion`` only once", async () => {
          // Put it in the session's memory cache.
          expect(await resolver.resolveToVersion("jquery", "3"))
            .to.equal("3.4.1");
          // Get it from the session's memory cache.
          expect(await resolver.resolveToVersion("jquery", "3"))
            .to.equal("3.4.1");
          expect(stub).to.have.been.calledOnce;
        });
      });

      describe("and has been resolved by a previous session", () => {
        it("resolves by calling ``fetchVersion`` again", async () => {
          // Put it in the cache.
          expect(await resolver.resolveToVersion("jquery", "3.4.1"))
            .to.equal("3.4.1");

          const resolver2 = new DefaultResolver(logger, cache);
          const stub2 = sinon.stub(resolver2, "fetchVersion").returns("3.4.1");
          expect(await resolver2.resolveToVersion("jquery", "3.4.1"))
            .to.equal("3.4.1");

          expect(stub).to.have.been.calledOnce;
          expect(stub2).to.have.been.calledOnce;
        });
      });
    });

    describe("when passed something which does not exist", () => {
      beforeEach(() => {
        stub = sinon.stub(resolver, "fetchVersion")
          .returns(Promise.reject(new Error("error")));
      });

      it("throws", async () => {
        await expectRejection(resolver.resolveToVersion("foo", "1"));
        expect(await fs.exists(cache.makePackagePath("foo", "1")))
          .to.be.false;
      });
    });
  });

  describe("#fetchVersion", () => {
    it("throws", async () => {
      await expectRejection(new BaseVersionResolver(logger, cache)
                            .fetchVersion());
    });
  });
});
