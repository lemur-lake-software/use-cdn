"use strict";

const sinonChai = require("sinon-chai");
const nock = require("nock");
const chai = require("chai");
const mockFs = require("mock-fs");
const { expectRejection, use: erUse } = require("expect-rejection");

const { WritableCache } = require("../../caching");
const { UnpkgSession } = require("../../sessions/unpkg");

const { expect, use } = chai;
use(sinonChai);
erUse(chai);

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
      new UnpkgSession(undefined, logger, cache,
                       new UnpkgSession.NativeResolver(undefined, logger,
                                                       cache));
    });
  });

  describe("#makeFileUrl", () => {
    it("makes a file URL", () => {
      const session = new UnpkgSession(undefined, logger, cache,
                                       new UnpkgSession.NativeResolver(
                                         undefined, logger, cache));
      expect(session.makeFileUrl("foo", "1.0.0", "dist/foo.js"))
        .to.equal("https://unpkg.com/foo@1.0.0/dist/foo.js");
    });

    it("uses the ``url`` configuration options", () => {
      const session = new UnpkgSession({ url: "https://mirror/" },
                                       logger, cache,
                                       new UnpkgSession.NativeResolver(
                                         undefined,
                                         logger, cache));
      expect(session.makeFileUrl("foo", "1.0.0", "dist/foo.js"))
        .to.equal("https://mirror/foo@1.0.0/dist/foo.js");
    });
  });

  describe("#makePackageUrl", () => {
    it("makes a package URL", () => {
      const session = new UnpkgSession(undefined, logger, cache,
                                       new UnpkgSession.NativeResolver(
                                         undefined, logger, cache));
      expect(session.makePackageUrl("foo", "1.0.0"))
        .to.equal("https://unpkg.com/foo@1.0.0");
    });

    it("uses the ``url`` configuration options", () => {
      const session = new UnpkgSession({ url: "https://mirror/" },
                                       logger, cache,
                                       new UnpkgSession.NativeResolver(
                                         undefined,
                                         logger, cache));
      expect(session.makePackageUrl("foo", "1.0.0"))
        .to.equal("https://mirror/foo@1.0.0");
    });
  });
});

describe("UnpkgSession.NativeResolver", () => {
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
      new UnpkgSession.NativeResolver(undefined, logger, cache);
    });


    describe("sets ``base``", () => {
      it("to the default if no configuration was passed", () => {
        const resolver = new UnpkgSession.NativeResolver(undefined, logger,
                                                         cache);
        expect(resolver).to.have.property("base").equal("https://unpkg.com/");
      });

      it("to the default if an empty configuration was passed", () => {
        const resolver = new UnpkgSession.NativeResolver({}, logger, cache);
        expect(resolver).to.have.property("base").equal("https://unpkg.com/");
      });

      describe("to the ``url`` setting", () => {
        it("with a forward slash appended, if it did not end with one", () => {
          const resolver =
                new UnpkgSession.NativeResolver({ url: "foo" }, logger, cache);
          expect(resolver).to.have.property("base").equal("foo/");
        });

        it("as is, if did end with a forward slash", () => {
          const resolver =
                new UnpkgSession.NativeResolver({ url: "foo/" }, logger, cache);
          expect(resolver).to.have.property("base").equal("foo/");
        });
      });
    });
  });

  describe("#fetchVersion", () => {
    let resolver;
    let scope;

    function makeNock(url = "https://unpkg.com") {
      scope = nock(url);
    }

    beforeEach(() => {
      resolver = new UnpkgSession.NativeResolver(undefined, logger, cache);
    });

    describe("when passed a version", () => {
      beforeEach(() => {
        makeNock();
      });

      it("which exists, resolves", async () => {
        scope = scope
          .get("/foo@1.0.0")
          .reply(302, "", { location: "/foo@1.0.0/blah.js" });
        expect(await resolver.resolveToVersion("foo", "1.0.0"))
          .to.equal("1.0.0");
        scope.done();
      });

      it("which exists, resolves (with location absolute)", async () => {
        scope = scope
          .get("/foo@1.0.0")
          .reply(302, "", { location: "https://unpkg.com/foo@1.0.0/blah.js" });
        expect(await resolver.resolveToVersion("foo", "1.0.0"))
          .to.equal("1.0.0");
        scope.done();
      });

      it("which does not exist, throws", async () => {
        scope = scope
          .get("/foo@1")
          .reply(404, "");
        await expectRejection(resolver.fetchVersion("foo", "1"));
        scope.done();
      });
    });

    describe("when passed a tag", () => {
      beforeEach(() => {
        makeNock();
      });

      it("which exists, resolves", async () => {
        scope = scope
          .get("/foo@latest")
          .reply(302, "", { location: "/foo@1.0.0" });
        expect(await resolver.fetchVersion("foo", "latest"))
          .to.equal("1.0.0");
        scope.done();
      });

      it("which does not exist, throws", async () => {
        scope = scope
          .get("/foo@nonexistent")
          .reply(404);
        await expectRejection(resolver.fetchVersion("foo", "nonexistent"));
        scope.done();
      });
    });

    describe("throws on a response", () => {
      beforeEach(() => {
        makeNock();
        scope = scope.get("/foo@1");
      });

      it("with an empty version number", async () => {
        scope = scope.reply(302, "", { location: "/foo@" });
        await expectRejection(resolver.resolveToVersion("foo", "1"),
                              Error, "foo@1 resolves to something \
without a version: foo@");
        scope.done();
      });

      it("without a version number", async () => {
        scope = scope.reply(302, "", { location: "/foo" });
        await expectRejection(resolver.resolveToVersion("foo", "1"),
                              Error, "foo@1 resolves to something \
without a version: foo");
        scope.done();
      });

      it("which resolves to a different package", async () => {
        scope = scope.reply(302, "", { location: "/bar@3.3.3" });
        await expectRejection(resolver.resolveToVersion("foo", "1"),
                              Error, "foo@1 resolves to a different \
package: bar@3.3.3");
        scope.done();
      });

      it("which is not a 302 redirect", async () => {
        scope = scope.reply(200, "fnord");
        await expectRejection(resolver.resolveToVersion("foo", "1"));
        scope.done();
      });
    });
  });

  describe("#makePackageUrl", () => {
    it("makes a package URL", () => {
      const resolver = new UnpkgSession.NativeResolver(undefined, logger,
                                                       cache);
      expect(resolver.makePackageUrl("foo", "1.0.0"))
        .to.equal("https://unpkg.com/foo@1.0.0");
    });

    it("uses the ``url`` configuration option", () => {
      const resolver = new UnpkgSession.NativeResolver(
        { url: "https://mirror" }, logger, cache);
      expect(resolver.makePackageUrl("foo", "1.0.0"))
        .to.equal("https://mirror/foo@1.0.0");
    });
  });
});
