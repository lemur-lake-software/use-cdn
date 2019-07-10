"use strict";

const { expect } = require("chai");
const fs = require("fs-extra");

const { applyOverride, isTag, loadConfig, __test } = require("../util");

describe("util", () => {
  // The loadConfig tests must access the actual filesystem. mock-fs does not
  // work for this because loadConfig uses require to load the configuration as
  // a module. We also tried proxyquire but it intercepts only *direct*
  // dependencies, but the configuration file is loaded through require-reload
  // and so it is not direct.
  describe("loadConfig", () => {
    before(async () => {
      // Make sure we don't overwrite something.
      try {
        await fs.access("./use-cdn.conf.js");
        throw new Error("./use-cdn.conf.js already exists");
      }
      catch (ex) {
        if (ex.code !== "ENOENT") {
          throw ex;
        }
      }
    });

    afterEach(async () => {
      // Clean up after each test.
      await fs.unlink("./use-cdn.conf.js");
    });

    it("loads an empty array", async () => {
      await fs.writeFile("./use-cdn.conf.js", "module.exports = [];");
      loadConfig();
    });

    it("loads an array", async () => {
      await fs.writeFile("./use-cdn.conf.js", `
module.exports = [{
  package: "jquery",
  version: "latest",
  files: [
    "jquery.js",
  ],
}];
`);
      loadConfig();
    });

    it("loads an object", async () => {
      await fs.writeFile("./use-cdn.conf.js", `
module.exports = {
  cdns: {
    unpkg: {
      url: "https://fnord",
    },
  },
  resolvers: {
    unpkg: {
      url: "https://fnord",
    },
    npm: {},
  },
  packages: [{
    package: "jquery",
    version: "latest",
    files: [
      "jquery.js",
    ],
  }],
};
`);
      loadConfig();
    });

    it("fails on unknown CDN in cdns", async () => {
      await fs.writeFile("./use-cdn.conf.js", `
module.exports = {
  cdns: {
    fnord: {
      url: "https://fnord",
    },
  },
  packages: [{
    package: "jquery",
    version: "latest",
    files: [
      "jquery.js",
    ],
  }],
};
`);
      expect(loadConfig)
        .to.throw(Error, /unknown CDN in the cdns configuration option: fnord/);
    });

    it("fails on unknown resolver in resolvers", async () => {
      await fs.writeFile("./use-cdn.conf.js", `
module.exports = {
  cdns: {},
  resolvers: {
    fnord: {
    },
  },
  packages: [{
    package: "jquery",
    version: "latest",
    files: [
      "jquery.js",
    ],
  }],
};
`);
      expect(loadConfig).to
        .throw(Error,
               /unknown resolver in the resolvers configuration option: fnord/);
    });

    it("fails on duplicate package name", async () => {
      await fs.writeFile("./use-cdn.conf.js", `
module.exports = {
  packages: [{
    package: "jquery",
    version: "latest",
    files: [
      "jquery.js",
    ],
  }, {
    package: "jquery",
    version: "1",
    files: [
      "jquery.js",
    ],
  }],
};
`);
      expect(loadConfig).to.throw(Error, "duplicate package: jquery");
    });

    it("fails on resolveAs duplicating a package name", async () => {
      await fs.writeFile("./use-cdn.conf.js", `
module.exports = {
  packages: [{
    package: "jquery",
    version: "latest",
    files: [
      "jquery.js",
    ],
  }, {
    package: "jquery-moo",
    resolveAs: "jquery",
    version: "1",
    files: [
      "jquery.js",
    ],
  }],
};
`);
      expect(loadConfig).to.throw(Error, "duplicate package: jquery");
    });

    it("fails on cdn specifying unknown cdn", async () => {
      await fs.writeFile("./use-cdn.conf.js", `
module.exports = {
  cdn: "unknown",
  packages: [{
    package: "jquery",
    version: "latest",
    files: [
      "jquery.js",
    ],
  }],
};
`);
      expect(loadConfig).to
        .throw(Error, "unknown CDN in the cdn configuration option: unknown");
    });

    it("fails on incorrect data", async () => {
      await fs.writeFile("./use-cdn.conf.js", `
module.exports = [{
  package: "jquery",
}];
`);
      expect(loadConfig).to.throw(Error);
    });

    it("reports bad file", async () => {
      await fs.writeFile("./use-cdn.conf.js", `
module.exports = [{
  package: "jquery",
  version: "latest",
  files: [
    1,
  ]
}];
`);
      expect(loadConfig).to.throw(Error, /value is not a file/);
    });
  });

  describe("isTag", () => {
    for (const x of [
      "1.2.3",
      "1",
    ]) {
      it(`should return false on ${x}`, () => {
        expect(isTag(x)).to.be.false;
      });
    }

    for (const x of [
      "a",
      "a.1",
      "latest",
    ]) {
      it(`should return true on ${x}`, () => {
        expect(isTag(x)).to.be.true;
      });
    }
  });

  describe("applyOverride", () => {
    let orig;
    before(() => {
      orig = process.env.USE_CDN_OVERRIDES;
    });

    after(() => {
      process.env.USE_CDN_OVERRIDES = orig;
    });

    afterEach(() => {
      __test.resetOverrides();
    });

    describe("does not override", () => {
      it("when env is set to the empty string", () => {
        process.env.USE_CDN_OVERRIDES = "";
        expect(applyOverride("foo", "1.2.3")).to.equal("1.2.3");
      });

      it("when env is for packages we don't use", () => {
        process.env.USE_CDN_OVERRIDES = "bar@1 baz@3";
        expect(applyOverride("foo", "1.2.3")).to.equal("1.2.3");
      });
    });

    describe("overrides", () => {
      it("when env is set to a package we are using", () => {
        process.env.USE_CDN_OVERRIDES = "foo@3 bar@1 baz@3";
        expect(applyOverride("foo", "1.2.3")).to.equal("3");
      });

      it("when env is set to a package we are using", () => {
        process.env.USE_CDN_OVERRIDES = "bar@1 baz@3 foo@3";
        expect(applyOverride("foo", "1.2.3")).to.equal("3");
      });
    });

    describe("throws", () => {
      it("when env contains a package without version", () => {
        process.env.USE_CDN_OVERRIDES = "foo@3 bar baz@3";
        expect(() => applyOverride("foo", "1.2.3"))
          .to.throw(Error, "package bar overriden without a version \
specification");
      });

      it("when env contains a malformed package", () => {
        process.env.USE_CDN_OVERRIDES = "bar@1 baz@3@3 foo@3";
        expect(() => applyOverride("foo", "1.2.3"))
          .to.throw(Error, "the setting baz@3@3 in the environment override is \
malformed");
      });
    });
  });
});
