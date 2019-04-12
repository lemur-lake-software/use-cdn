"use strict";

const childProcess = require("child_process");
const path = require("path");
const util = require("util");

const { expect } = require("chai");
const fs = require("fs-extra");

const framework = require("../index")["framework:use-cdn"][1];

const execFile = util.promisify(childProcess.execFile);

class FakeLogger {
  // eslint-disable-next-line class-methods-use-this
  debug() {
  }
}

class FakeFactory {
  // eslint-disable-next-line class-methods-use-this
  create() {
    return new FakeLogger();
  }
}

function cachePath(filePath) {
  return path.join(process.cwd(), ".use-cdn", "cache", filePath);
}

describe("framework", () => {
  before(async () => {
    if (await fs.exists("use-cdn.conf.js")) {
      throw new Error("do not put a use-cdn.conf.js file in the root of this \
package. (If this is a leftover from a previous test failure, remove it.)");
    }

    if (await fs.exists(".use-cdn")) {
      throw new Error("do not keep a .use-cdn directory in the root of this \
package. (If this is a leftover from a previous test failure, remove it.)");
    }
  });

  afterEach(async () => {
    await fs.remove(".use-cdn");
    await fs.remove("use-cdn.conf.js");
  });

  it("runs with empty configuration", async () => {
    await fs.writeFile("use-cdn.conf.js", "module.exports = []");
    await execFile("../cli/bin/use-cdn");
    const config = { files: [] };
    framework(config, new FakeFactory());
    expect(config.files).to.have.lengthOf(0);
  });

  it("runs with configuration", async () => {
    await fs.writeFile("use-cdn.conf.js", `\
module.exports = [{
  package: "bootstrap",
  version: "3",
  files: [
    "dist/js/bootstrap.js",
  ],
}, {
  package: "jquery",
  version: "latest",
  files: [
    () => "dist/jquery.js",
  ],
}];`);
    await execFile("../cli/bin/use-cdn");
    const config = { files: [] };
    framework(config, new FakeFactory());
    expect(config.files).to.deep.equal([
      cachePath("bootstrap/3.4.1/dist/js/bootstrap.js"),
      cachePath("jquery/3.4.1/dist/jquery.js")].map(x => ({
        pattern: x,
        included: true,
        served: true,
        watched: false,
      })));
  });
});
