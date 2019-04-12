"use strict";

const path = require("path");

const fs = require("fs-extra");
const { expect } = require("chai");
const mockFs = require("mock-fs");
const { expectRejection } = require("expect-rejection");

const { SyncReadableCache, WritableCache } = require("../caching");
const paths = require("../paths");

const NOT_INITIALIZED = "the cache has not been initialized";

describe("caching", () => {
  describe("WritableCache", () => {
    describe("#constructor", () => {
      it("creates a cache with initialized false", () => {
        expect(new WritableCache().initialized).to.be.false;
      });
    });

    describe("#init", () => {
      beforeEach(() => {
        mockFs();
      });

      afterEach(() => {
        mockFs.restore();
      });

      it("creates the cache if it does not exist", async () => {
        const cache = new WritableCache();
        await cache.init();
        const meta =
              JSON.parse(fs.readFileSync(paths.getMetaPath()).toString());
        expect(meta.version).to.not.be.undefined;
        expect(cache.initialized).to.be.true;
      });

      describe("throws when the base directory exists", () => {
        let cache;
        beforeEach(async () => {
          await fs.ensureDir(paths.getDataBasePath());
          cache = new WritableCache();
        });

        it("but has no meta", async () => {
          await expectRejection(
            cache.init(), Error,
            new RegExp(`^cannot read ${paths.getMetaPath()}`));
          expect(cache.initialized).to.be.false;
        });

        it("but meta does not parse", async () => {
          await fs.writeFile(paths.getMetaPath(), "{");
          await expectRejection(
            cache.init(), Error,
            new RegExp(`^cannot read ${paths.getMetaPath()}`));
          expect(cache.initialized).to.be.false;
        });

        it("but meta.version is greater than current", async () => {
          await fs.writeFile(paths.getMetaPath(),
                             JSON.stringify({ version: 9999 }));
          await expectRejection(cache.init(), Error,
                                `the version number stored in \
${paths.getMetaPath()} is greater than the version we support`);
          expect(cache.initialized).to.be.false;
        });
      });

      it("replaces cache if meta.version is lower than current", async () => {
        await fs.ensureDir(paths.getDataBasePath());
        await fs.writeFile(paths.getMetaPath(), JSON.stringify({ version: 0 }));
        const cache = new WritableCache();
        await cache.init();
        const meta =
              JSON.parse(fs.readFileSync(paths.getMetaPath()).toString());
        expect(meta.version).to.not.equal(0);
        expect(cache.initialized).to.be.true;
      });

      it("does not throw or change the version if it is current", async () => {
        await fs.ensureDir(paths.getDataBasePath());
        await fs.writeFile(paths.getMetaPath(), JSON.stringify({ version: 1 }));
        const cache = new WritableCache();
        await cache.init();
        const meta =
              JSON.parse(fs.readFileSync(paths.getMetaPath()).toString());
        expect(meta.version).to.equal(1);
        expect(cache.initialized).to.be.true;
      });
    });

    describe("#makeFilePath", () => {
      let cache;

      before(() => {
        mockFs();
        cache = new WritableCache();
      });

      after(() => {
        mockFs.restore();
      });

      it("returns the path of a file", () => {
        expect(cache.makeFilePath("foo", "1.0.0", "bar.js")).to
          .equal(path.join(paths.getCacheBasePath(), "foo", "1.0.0", "bar.js"));
      });
    });

    describe("#makePkgPath", () => {
      let cache;

      before(() => {
        mockFs();
        cache = new WritableCache();
      });

      after(() => {
        mockFs.restore();
      });

      it("returns the path of a package", () => {
        expect(cache.makePackagePath("foo", "1.0.0")).to
          .equal(path.join(paths.getCacheBasePath(), "foo", "1.0.0"));
      });
    });

    describe("#set", () => {
      let cache;

      beforeEach(async () => {
        mockFs();
        cache = new WritableCache();
        await cache.init();
      });

      afterEach(() => {
        mockFs.restore();
      });

      it("throws when the cache is not initialized", async () => {
        await expectRejection(new WritableCache().set(), Error,
                              NOT_INITIALIZED);
      });

      it("throws when called with a tag", async () => {
        await expectRejection(cache.set("foo", "latest", "foo.js", "1"),
                              Error,
                              "set called with tag, which is not allowed");
      });

      it("writes the file", async () => {
        await cache.set("foo", "1.0.0", "foo.js", "1");
        expect((await fs.readFile(cache.makeFilePath("foo", "1.0.0", "foo.js")))
               .toString()).to.equal("1");
      });

      it("returns the file path", async () => {
        expect(await cache.set("foo", "1.0.0", "foo.js", "1"))
          .to.equal(cache.makeFilePath("foo", "1.0.0", "foo.js"));
      });
    });

    describe("#getPath", () => {
      let cache;

      beforeEach(async () => {
        mockFs();
        cache = new WritableCache();
        await cache.init();
      });

      afterEach(() => {
        mockFs.restore();
      });

      it("throws when the cache is not initialized", async () => {
        await expectRejection(new WritableCache().getPath(), Error,
                              NOT_INITIALIZED);
      });

      it("returns undefined if the file does not exist", async () => {
        expect(await cache.getPath("foo", "1.0.0", "foo.js"))
          .to.be.undefined;
      });

      it("returns the file path if the file exists", async () => {
        const filePath = await cache.set("foo", "1.0.0", "foo.js", "1");
        expect(await cache.getPath("foo", "1.0.0", "foo.js"))
          .to.equal(filePath);
      });
    });

    describe("#link", () => {
      let cache;

      beforeEach(async () => {
        mockFs();
        cache = new WritableCache();
        await cache.init();
      });

      afterEach(() => {
        mockFs.restore();
      });

      it("throws when the cache is not initialized", async () => {
        await expectRejection(new WritableCache().link(), Error,
                              NOT_INITIALIZED);
      });

      it("links the tag to the version", async () => {
        await cache.link("foo", "1.0.0", "latest");
        const link = await fs.readlink(cache.makePackagePath("foo", "latest"));
        expect(link).to.equal("1.0.0");
      });

      it("forcibly changes the link the tag to the version", async () => {
        await cache.link("foo", "1.0.0", "latest");
        let link = await fs.readlink(cache.makePackagePath("foo", "latest"));
        expect(link).to.equal("1.0.0");
        await cache.link("foo", "2.0.0", "latest");
        link = await fs.readlink(cache.makePackagePath("foo", "latest"));
        expect(link).to.equal("2.0.0");
      });
    });
  });

  describe("SyncReadableCache", () => {
    describe("#constructor", () => {
      beforeEach(async () => {
        mockFs();
      });

      afterEach(() => {
        mockFs.restore();
      });

      it("throws if meta is unreadable", () => {
        expect(() => new SyncReadableCache())
          .to.throw(Error, `cannot read ${paths.getMetaPath()}`);
      });

      it("throws if meta's version is not the current one", async () => {
        await fs.ensureDir(paths.getDataBasePath());
        await fs.writeFile(paths.getMetaPath(),
                           JSON.stringify({ version: 9999 }));
        expect(() => new SyncReadableCache())
          .to.throw(Error, "the use-cdn data is not up to date");
      });

      it("does not throw if there's no problem", async () => {
        const cache = new WritableCache();
        await cache.init();
        // eslint-disable-next-line no-new
        new SyncReadableCache();
      });
    });

    describe("#getPath", () => {
      let cache;
      let wcache;

      before(async () => {
        mockFs();
        wcache = new WritableCache();
        await wcache.init();
        await wcache.set("foo", "1.0.0", "foo.js", "1");
        cache = new SyncReadableCache();
      });

      after(() => {
        mockFs.restore();
      });

      it("returns the file path if it exists", () => {
        expect(cache.getPath("foo", "1.0.0", "foo.js")).to.equal(
          cache.makeFilePath("foo", "1.0.0", "foo.js"));
      });

      it("throws if the file does not exist", () => {
        expect(() => cache.getPath("foo", "1.0.0", "bar.js"))
          .to.throw(Error, /^ENOENT/);
      });
    });

    describe("#resolveToVersion", () => {
      let cache;
      let wcache;

      before(async () => {
        mockFs();
        wcache = new WritableCache();
        await wcache.init();
        await wcache.set("foo", "1.0.0", "foo.js", "1");
        await wcache.set("foo", "2.0.0", "foo.js", "1");
        await wcache.link("foo", "1.0.0", "latest");
        cache = new SyncReadableCache();
      });

      after(() => {
        mockFs.restore();
      });

      it("returns the passed version if a version is passed", () => {
        expect(cache.resolveToVersion("foo", "2.0.0")).to.equal("2.0.0");
      });

      it("returns the resolved tag if a tag is passed", () => {
        expect(cache.resolveToVersion("foo", "latest")).to.equal("1.0.0");
      });
    });
  });
});
