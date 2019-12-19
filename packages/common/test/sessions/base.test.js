"use strict";

const sinon = require("sinon");
const sinonChai = require("sinon-chai");
const nock = require("nock");
const fs = require("fs-extra");
const chai = require("chai");
const mockFs = require("mock-fs");
const { expectRejection, use: erUse } = require("expect-rejection");

const { WritableCache } = require("../../caching");
const { BaseVersionResolver } = require("../../version-resolvers/base");
const { BaseSession } = require("../../sessions/base");

const { expect, use } = chai;

use(sinonChai);
erUse(chai);

class FakeLogger {
  // eslint-disable-next-line class-methods-use-this
  debug() {
  }
}

class FakeResolver extends BaseVersionResolver {
  // eslint-disable-next-line class-methods-use-this
  fetchVersion() {}
}

describe("BaseSession", () => {
  let logger;
  let cache;
  let scope;

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

  function makeScope(url = "https://example.com") {
    scope = nock(url)
      .get("/foo@1.0.0/dist/foo.js")
      .reply(200, "content of dist/foo.js");
  }

  describe("#constructor", () => {
    it("constructs", () => {
      // eslint-disable-next-line no-new
      new BaseSession("", logger, cache,
                      new FakeResolver(logger, cache));
    });
  });

  describe("#resolve", () => {
    const stockResource = ["foo", undefined, "1.0.0", "dist/foo.js"];
    let session;
    let resolver;
    let expectedPath;

    beforeEach(() => {
      expectedPath = cache.makeFilePath(stockResource[0],
                                        ...stockResource.slice(2));
    });

    beforeEach(() => {
      resolver = new FakeResolver(logger, cache);
      session = new BaseSession("https://example.com", logger, cache,
                                resolver);
    });

    it("calls `file` if it is a function", async () => {
      makeScope();
      const stub = sinon.stub();
      sinon.stub(resolver, "fetchVersion").returns("1.0.0");
      stub.returns("dist/foo.js");
      expect(await session.resolve("foo", undefined, "1.0.0", stub))
        .to.equal(expectedPath);
      expect(stub).to.have.been.calledOnce;
      expect(stub).to.have.been.calledWithExactly("1.0.0");
      scope.done();
    });

    it("resolves tags", async () => {
      makeScope();
      scope = scope
      .get("/bar@3.1.2/bar.js")
      .reply(200, "content of bar.js")
      .get("/bar@3.1.2/baz.js")
      .reply(200, "content of baz.js");

      sinon.stub(resolver, "fetchVersion").onCall(0).returns("1.0.0")
        .returns("3.1.2");
      expect(await session.resolve(...stockResource)).to.equal(expectedPath);
      expect(await session.resolve("bar", undefined, "latest", "bar.js"))
        .to.equal(cache.makeFilePath("bar", "3.1.2", "bar.js"));
      expect(await session.resolve("bar", undefined, "latest", "baz.js"))
        .to.equal(cache.makeFilePath("bar", "3.1.2", "baz.js"));
      scope.done();
    });

    it("takes into account resolveAs when calling fetchVersion", async () => {
      makeScope();
      const fetchVersion = sinon.stub(resolver, "fetchVersion").returns("1.0.0");
      expect(await session.resolve("foo", "fooPkg", "latest", "dist/foo.js"))
        .to.equal(expectedPath);
      expect(fetchVersion).to.have.been.calledWithExactly("fooPkg", "latest");
      scope.done();
    });

    describe("when the resource exists", () => {
      describe("but is not in the cache", () => {
        it("resolves", async () => {
          makeScope();
          sinon.stub(resolver, "fetchVersion").returns("1.0.0");
          expect(await session.resolve(...stockResource)).to
            .equal(expectedPath);
          scope.done();
        });

        it("saves the file in the cache", async () => {
          makeScope();
          sinon.stub(resolver, "fetchVersion").returns("1.0.0");
          await session.resolve(...stockResource);
          expect((await fs.readFile(expectedPath)).toString())
            .to.equal("content of dist/foo.js");
          scope.done();
        });
      });

      describe("and is in the cache", () => {
        it("resolves without refetching", async () => {
          makeScope();
          const fetchVersion =
                sinon.stub(resolver, "fetchVersion").returns("1.0.0");
          // Put it in the cache.
          expect(await session.resolve(...stockResource))
            .to.equal(expectedPath);
          expect(fetchVersion).to.have.been.calledOnce;

          //
          // Uncommenting the unlink would make the test fail, as a 2nd fetch
          // would be done.
          //
          // fs.unlink(expectedPath);
          expect(await session.resolve(...stockResource))
            .to.equal(expectedPath);
          expect(fetchVersion).to.have.been.calledOnce;
          scope.done();
        });
      });
    });

    describe("when fetchFile throws", () => {
      it("throws and does not save to the cache", async () => {
        sinon.stub(resolver, "fetchVersion").returns("1.0.0");
        sinon.stub(session, "fetchFile").returns(Promise.reject(new Error("Q")));
        await expectRejection(session.resolve(...stockResource));
        expect(await fs.exists(expectedPath)).to.be.false;
      });
    });


    describe("when ``url`` is used", () => {
      beforeEach(() => {
        resolver = new FakeResolver(undefined, logger, cache);
        session = new BaseSession("https://mirror", logger, cache, resolver);
      });

      it("takes ``url`` into account", async () => {
        makeScope("https://mirror/");
        sinon.stub(resolver, "fetchVersion").returns("1.0.0");
        expect(await session.resolve(...stockResource)).to.equal(expectedPath);
        scope.done();
      });
    });
  });

  describe("#fetchFile", () => {
    let session;

    beforeEach(() => {
      session = new BaseSession("https://example.com", logger, cache,
                                new FakeResolver(undefined, logger, cache));
    });

    it("fetches the file", async () => {
      makeScope();
      expect(await session.fetchFile("foo", "1.0.0", "dist/foo.js")).to
        .equal("content of dist/foo.js");
      scope.done();
    });

    it("fails if the file does not exist", async () => {
      scope = nock("https://example.com")
        .get("/foo@1.0.0/dist/foo.js")
        .reply(404);
      await expectRejection(session.fetchFile("foo", "1.0.0",
                                              "dist/foo.js"));
      scope.done();
    });
  });

  describe("#resolveToVersion", () => {
    let session;
    let fakeResolver;

    beforeEach(() => {
      fakeResolver = new FakeResolver(logger, cache);
      session = new BaseSession("", logger, cache, fakeResolver);
    });

    it("calls resolver.resolveToVersion", async () => {
      const stub = sinon.stub(fakeResolver, "resolveToVersion")
            .returns(Promise.resolve("1"));
      expect(await session.resolveToVersion("a", "b")).to.equal("1");
      expect(stub).to.have.been.calledOnce;
      expect(stub).to.have.been.calledWith("a", "b");
    });
  });

  describe("#makeFileUrl", () => {
    it("makes a file URL", () => {
      const session = new BaseSession("https://example.com", logger, cache,
                                      new FakeResolver(undefined, logger,
                                                       cache));
      expect(session.makeFileUrl("foo", "1.0.0", "dist/foo.js"))
        .to.equal("https://example.com/foo@1.0.0/dist/foo.js");
    });
  });

  describe("#makePackageUrl", () => {
    it("makes a package URL", () => {
      const session = new BaseSession("https://example.com", logger, cache,
                                      new FakeResolver(undefined, logger,
                                                       cache));
      expect(session.makePackageUrl("foo", "1.0.0"))
        .to.equal("https://example.com/foo@1.0.0");
    });
  });
});
