"use strict";

const nock = require("nock");
const chai = require("chai");
const mockFs = require("mock-fs");
const { expectRejection, use: erUse } = require("expect-rejection");

const jqueryJSON = require("./jquery");
const { WritableCache } = require("../../caching");
const { NPMVersionResolver } = require("../../version-resolvers/npm");
const { triggerLazyLoading } = require("../testutil");

const { expect } = chai;
erUse(chai);

class FakeLogger {
  // eslint-disable-next-line class-methods-use-this
  debug() {
  }
}

describe("NPMVersionResolver", () => {
  let logger;
  let cache;
  let scope;

  before(() => {
    logger = new FakeLogger();
    triggerLazyLoading();
  });

  beforeEach(async () => {
    mockFs();
    cache = new WritableCache();

    await cache.init();
  });

  afterEach(() => {
    mockFs.restore();
  });

  function makeNock() {
    scope = nock("https://registry.npmjs.org/");
  }

  function makeDefaultNock() {
    makeNock();
    scope = scope
      .get("/jquery")
      .reply(200, jqueryJSON);
  }

  describe("#constructor", () => {
    it("constructs", () => {
      // eslint-disable-next-line no-new
      new NPMVersionResolver(undefined, logger, cache);
    });

    describe("sets ``base``", () => {
      it("to the default if no configuration was passed", () => {
        const resolver = new NPMVersionResolver(undefined, logger, cache);
        expect(resolver).to.have.property("base")
          .equal("https://registry.npmjs.org/");
      });

      it("to the default if an empty configuration was passed", () => {
        const resolver = new NPMVersionResolver({}, logger, cache);
        expect(resolver).to.have.property("base")
          .equal("https://registry.npmjs.org/");
      });

      describe("to the ``url`` setting", () => {
        it("with a forward slash appended, if it did not end with one", () => {
          const resolver =
                new NPMVersionResolver({ url: "foo" }, logger, cache);
          expect(resolver).to.have.property("base").equal("foo/");
        });

        it("as is, if did end with a forward slash", () => {
          const resolver =
                new NPMVersionResolver({ url: "foo/" }, logger, cache);
          expect(resolver).to.have.property("base").equal("foo/");
        });
      });
    });
  });

  describe("#fetchVersion", () => {
    let resolver;

    beforeEach(() => {
      resolver = new NPMVersionResolver(undefined, logger, cache);
    });

    describe("when passed a version", () => {
      beforeEach(() => {
        makeDefaultNock();
      });

      it("which exists, resolves", async () => {
        expect(await resolver.fetchVersion("jquery", "3.4.1"))
          .to.equal("3.4.1");
        scope.done();
      });

      it("which does not exist, throws", async () => {
        await expectRejection(resolver.fetchVersion("jquery", "39999"));
        scope.done();
      });
    });

    describe("when passed a tag", () => {
      beforeEach(() => {
        makeDefaultNock();
      });

      it("which exists, resolves", async () => {
        expect(await resolver.fetchVersion("jquery", "latest"))
          .to.equal("3.4.1");
        scope.done();
      });

      it("which does not exist, throws", async () => {
        await expectRejection(resolver.fetchVersion("jquery", "nonexistent"));
        scope.done();
      });
    });

    describe("throws on a response", () => {
      beforeEach(() => {
        makeNock();
        scope = scope.get("/foo");
      });

      it("with bad content", async () => {
        scope = scope.reply(200, {});
        await expectRejection(resolver.fetchVersion("foo", "1"),
                              Error, "No valid versions available for \
undefined");
        scope.done();
      });

      it("which resolves to a different package", async () => {
        scope = scope.reply(200, jqueryJSON);
        await expectRejection(resolver.fetchVersion("foo", "3"),
                              Error, "foo resolves to a different \
package: jquery");
        scope.done();
      });
    });
  });
});
