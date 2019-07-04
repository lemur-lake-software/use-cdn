"use strict";

const sinon = require("sinon");
const sinonChai = require("sinon-chai");
const nock = require("nock");
const fs = require("fs-extra");
const { expect, use } = require("chai");
const mockFs = require("mock-fs");
const { expectRejection } = require("expect-rejection");

const { WritableCache } = require("../../caching");
const { UnpkgSession } = require("../../sessions/unpkg");

use(sinonChai);

class FakeLogger {
  // eslint-disable-next-line class-methods-use-this
  debug() {
  }
}

describe("UnpkgSession", () => {
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
      new UnpkgSession(undefined, logger, cache);
    });
  });

  describe("#resolve", () => {
    const stockResource = ["foo", "1.0.0", "dist/foo.js"];
    let scope;
    let session;
    let expectedPath;

    function makeScope(url = "https://unpkg.com") {
      scope = nock(url)
        .get("/foo@1.0.0")
        .reply(302, "", { location: "/foo@1.0.0/blah.js" })
        .get("/foo@1.0.0/dist/foo.js")
        .reply(200, "content of dist/foo.js");
    }

    before(() => {
      expectedPath = cache.makeFilePath(...stockResource);
    });

    beforeEach(() => {
      session = new UnpkgSession(undefined, logger, cache);
    });

    it("calls `file` if it is a function", async () => {
      makeScope();
      const stub = sinon.stub();
      stub.returns("dist/foo.js");
      expect(await session.resolve("foo", "1.0.0", stub))
        .to.equal(expectedPath);
      expect(stub).to.have.been.calledOnce;
      expect(stub).to.have.been.calledWithExactly("1.0.0");

      const stub2 = sinon.stub();
      scope = scope
        .get("/foo@2.0.0")
        .reply(302, "", { location: "/foo@2.0.0/blah.js" })
        .get("/foo@2.0.0/nonexistent")
        .reply(404, "");
      stub2.returns("nonexistent");
      await expectRejection(session.resolve("foo", "2.0.0", stub2));
      expect(stub2).to.have.been.calledOnce;
      expect(stub2).to.have.been.calledWithExactly("2.0.0");
      scope.done();
    });

    it("resolves tags", async () => {
      makeScope();
      scope = scope
        .get("/bar@latest")
        .reply(302, "", { location: "/bar@3.1.2" })
        .get("/bar@3.1.2/bar.js")
        .reply(200, "content of bar")
        .get("/bar@3.1.2/baz.js")
        .reply(200, "content of baz");
      expect(await session.resolve(...stockResource)).to.equal(expectedPath);
      expect(await session.resolve("bar", "latest", "bar.js"))
        .to.equal(cache.makeFilePath("bar", "3.1.2", "bar.js"));
      expect(await session.resolve("bar", "latest", "baz.js"))
        .to.equal(cache.makeFilePath("bar", "3.1.2", "baz.js"));
      scope.done();
    });

    describe("when the resource exists", () => {
      describe("but is not in the cache", () => {
        it("resolves", async () => {
          makeScope();
          expect(await session.resolve(...stockResource)).to.equal(expectedPath);
          scope.done();
        });

        it("saves the file in the cache", async () => {
          makeScope();
          await session.resolve(...stockResource);
          expect((await fs.readFile(expectedPath)).toString())
            .to.equal("content of dist/foo.js");
          scope.done();
        });
      });

      describe("and is in the cache", () => {
        it("resolves without accessing the network", async () => {
          makeScope();
          // Put it in the cache.
          expect(await session.resolve(...stockResource))
            .to.equal(expectedPath);
          //
          // Uncommenting the unlink would make the test fail, as a 2nd fetch
          // would be done.
          //
          // fs.unlink(expectedPath);
          expect(await session.resolve(...stockResource))
            .to.equal(expectedPath);
          // The call for scope.done will fail if there was not one and only one
          // HTTP request.
          scope.done();
        });
      });
    });

    describe("when the resource does not exist", () => {
      it("throws and does not save to the cache", async () => {
        scope = nock("https://unpkg.com")
          .get("/foo@1.0.0")
          .reply(302, "", { location: "/foo@1.0.0/blah.js" })
          .get("/foo@1.0.0/dist/foo.js")
          .reply(404, "");
        await expectRejection(session.resolve(...stockResource));
        expect(await fs.exists(expectedPath)).to.be.false;
        scope.done();
      });
    });

    describe("when ``url`` is used", () => {
      beforeEach(() => {
        session = new UnpkgSession({ url: "https://mirror" }, logger, cache);
      });

      it("takes ``url`` into account", async () => {
        makeScope("https://mirror/");
        expect(await session.resolve(...stockResource)).to.equal(expectedPath);
        scope.done();
      });
    });
  });

  describe("#resolveToVersion", () => {
    let scope;
    let session;

    beforeEach(() => {
      session = new UnpkgSession(undefined, logger, cache);
    });

    describe("when passed a version", () => {
      describe("which exists", () => {
        describe("has not been resolved by the session yet", () => {
          describe("and resolves to itself", () => {
            it("resolves", async () => {
              scope = nock("https://unpkg.com")
                .get("/foo@1.0.0")
                .reply(302, "", { location: "/foo@1.0.0/blah.js" });
              expect(await session.resolveToVersion("foo", "1.0.0"))
                .to.equal("1.0.0");
              scope.done();
            });

            it("resolves (with location absolute)", async () => {
              scope = nock("https://unpkg.com")
                .get("/foo@1.0.0")
                .reply(302, "",
                       { location: "https://unpkg.com/foo@1.0.0/blah.js" });
              expect(await session.resolveToVersion("foo", "1.0.0"))
                .to.equal("1.0.0");
              scope.done();
            });

            it("does not record the version in the cache", async () => {
              scope = nock("https://unpkg.com")
                .get("/foo@1.0.0")
                .reply(302, "", { location: "/foo@1.0.0/blah.js" });
              expect(await session.resolveToVersion("foo", "1.0.0"))
                .to.equal("1.0.0");
              expect(await fs.exists(cache.makePackagePath("foo", "1.0.0")))
                .to.be.false;
              scope.done();
            });
          });

          describe("and resolves to a new version", () => {
            it("records the version in the cache", async () => {
              scope = nock("https://unpkg.com")
                .get("/foo@1")
                .reply(302, "", { location: "/foo@1.2.3/blah.js" });
              expect(await session.resolveToVersion("foo", "1"))
                .to.equal("1.2.3");
              expect(await fs.readlink(cache.makePackagePath("foo", "1")))
                .to.be.equal("1.2.3");
              scope.done();
            });
          });
        });

        describe("and has been resolved by the same session", () => {
          it("resolves without accessing the network", async () => {
            scope = nock("https://unpkg.com")
              .get("/foo@1.0.0")
              .reply(302, "", { location: "/foo@1.0.0/blah.js" });
            // Put it in the session's memory cache.
            expect(await session.resolveToVersion("foo", "1.0.0"))
              .to.equal("1.0.0");
            // Get it from the session's memory cache.
            expect(await session.resolveToVersion("foo", "1.0.0"))
              .to.equal("1.0.0");
            // The call for scope.done will fail if there was not one and only
            // one HTTP request.
            scope.done();
          });
        });

        describe("and has been resolved by a previous session", () => {
          it("resolves through the network again", async () => {
            scope = nock("https://unpkg.com")
              .get("/foo@1.0.0")
              .reply(302, "", { location: "/foo@1.0.0/blah.js" })
              .get("/foo@1.0.0")
              .reply(302, "", { location: "/foo@1.0.0/blah.js" });
            // Put it in the cache.
            expect(await session.resolveToVersion("foo", "1.0.0"))
              .to.equal("1.0.0");

            const session2 = new UnpkgSession(undefined, logger, cache);
            expect(await session2.resolveToVersion("foo", "1.0.0"))
              .to.equal("1.0.0");

            scope.done();
          });
        });
      });

      describe("which does not exists", () => {
        it("throws", async () => {
          scope = nock("https://unpkg.com")
            .get("/foo@1")
            .reply(404, "");
          await expectRejection(session.resolveToVersion("foo", "1"));
          scope.done();
        });
      });

      describe("throws on a response", () => {
        it("with an empty version number", async () => {
          scope = nock("https://unpkg.com")
            .get("/foo@1")
            .reply(302, "", { location: "/foo@" });
          await expectRejection(session.resolveToVersion("foo", "1"),
                                Error, "foo@1 resolves to something \
without a version: foo@");
          scope.done();
        });

        it("without a version number", async () => {
          scope = nock("https://unpkg.com")
            .get("/foo@1")
            .reply(302, "", { location: "/foo" });
          await expectRejection(session.resolveToVersion("foo", "1"),
                                Error, "foo@1 resolves to something \
without a version: foo");
          scope.done();
        });

        it("which resolves to a different package", async () => {
          scope = nock("https://unpkg.com")
            .get("/foo@1")
            .reply(302, "", { location: "/bar@3.3.3" });
          await expectRejection(session.resolveToVersion("foo", "1"),
                                Error, "foo@1 resolves to a different \
package: bar@3.3.3");
          scope.done();
        });

        it("which is not a 302 redirect", async () => {
          scope = nock("https://unpkg.com")
            .get("/foo@1")
            .reply(200, "fnord");
          await expectRejection(session.resolveToVersion("foo", "1"));
          scope.done();
        });
      });
    });

    describe("when passed a tag", () => {
      const stockResource = ["foo", "latest"];
      let packagePath;

      before(() => {
        packagePath = cache.makePackagePath(...stockResource);
      });

      function makeScope() {
        scope = nock("https://unpkg.com")
          .get("/foo@latest")
          .reply(302, "", { location: "/foo@1.0.0" });
      }

      describe("which exists", () => {
        describe("has not been resolved by the session yet", () => {
          it("resolves", async () => {
            makeScope();
            expect(await session.resolveToVersion(...stockResource))
              .to.equal("1.0.0");
            scope.done();
          });

          it("records the tag in the cache", async () => {
            makeScope();
            await session.resolveToVersion(...stockResource);
            expect(await fs.readlink(packagePath)).to.equal("1.0.0");
            scope.done();
          });
        });

        describe("and has been resolved by the same session", () => {
          it("resolves without accessing the network", async () => {
            makeScope();
            // Put it in the session's memory cache.
            expect(await session.resolveToVersion(...stockResource))
              .to.equal("1.0.0");
            // Get it from the session's memory cache.
            expect(await session.resolveToVersion(...stockResource))
              .to.equal("1.0.0");
            // The call for scope.done will fail if there was not one and only
            // one HTTP request.
            scope.done();
          });
        });

        describe("and has been resolved by a previous session", () => {
          it("resolves through the network again", async () => {
            makeScope();
            scope = scope
              .get("/foo@latest")
              .reply(302, "", { location: "/foo@2.0.0" });
            // Put it in the cache.
            expect(await session.resolveToVersion(...stockResource))
              .to.equal("1.0.0");

            const session2 = new UnpkgSession(undefined, logger, cache);
            expect(await session2.resolveToVersion(...stockResource))
              .to.equal("2.0.0");

            scope.done();
          });
        });
      });

      describe("which does not exists", () => {
        it("throws", async () => {
          scope = nock("https://unpkg.com")
            .get("/foo@latest")
            .reply(404, "");
          await expectRejection(session.resolveToVersion(...stockResource));
          scope.done();
        });
      });

      describe("throws on a response", () => {
        it("with an empty version number", async () => {
          scope = nock("https://unpkg.com")
            .get("/foo@latest")
            .reply(302, "", { location: "/foo@" });
          await expectRejection(session.resolveToVersion(...stockResource),
                                Error, "foo@latest resolves to something \
without a version: foo@");
          scope.done();
        });

        it("without a version number", async () => {
          scope = nock("https://unpkg.com")
            .get("/foo@latest")
            .reply(302, "", { location: "/foo" });
          await expectRejection(session.resolveToVersion(...stockResource),
                                Error, "foo@latest resolves to something \
without a version: foo");
          scope.done();
        });

        it("which resolves to a different package", async () => {
          scope = nock("https://unpkg.com")
            .get("/foo@latest")
            .reply(302, "", { location: "/bar@3.3.3" });
          await expectRejection(session.resolveToVersion(...stockResource),
                                Error, "foo@latest resolves to a different \
package: bar@3.3.3");
          scope.done();
        });

        it("which is not a 302 redirect", async () => {
          scope = nock("https://unpkg.com")
            .get("/foo@latest")
            .reply(200, "fnord");
          await expectRejection(session.resolveToVersion(...stockResource));
          scope.done();
        });
      });
    });
  });

  describe("#makePackageUrl", () => {
    it("makes a package URL", () => {
      const session = new UnpkgSession(undefined, logger, cache);
      expect(session.makePackageUrl("foo", "1.0.0"))
        .to.equal("https://unpkg.com/foo@1.0.0");
    });

    it("uses the ``url`` configuration option", () => {
      const session = new UnpkgSession({ url: "https://mirror" },
                                       logger, cache);
      expect(session.makePackageUrl("foo", "1.0.0"))
        .to.equal("https://mirror/foo@1.0.0");
    });
  });

  describe("#makeFileUrl", () => {
    it("makes a file URL", () => {
      const session = new UnpkgSession(undefined, logger, cache);
      expect(session.makeFileUrl("foo", "1.0.0", "dist/foo.js"))
        .to.equal("https://unpkg.com/foo@1.0.0/dist/foo.js");
    });

    it("uses the ``url`` configuration options", () => {
      const session = new UnpkgSession({ url: "https://mirror/" },
                                       logger, cache);
      expect(session.makeFileUrl("foo", "1.0.0", "dist/foo.js"))
        .to.equal("https://mirror/foo@1.0.0/dist/foo.js");
    });
  });
});
