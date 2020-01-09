"use strict";

const childProcess = require("child_process");
const path = require("path");
const util = require("util");
const chai = require("chai");
const fs = require("fs-extra");
const { expectRejection, use: erUse } = require("expect-rejection");

const { expect } = chai;
erUse(chai);

const execFile = util.promisify(childProcess.execFile);

const tmpdir = "test/tmp";

describe("use-cdn", function useCDN() {
  let useCdnPath;

  before(() => {
    useCdnPath = path.resolve("./bin/use-cdn");
  });

  beforeEach(async () => {
    await fs.ensureDir(tmpdir);
  });

  afterEach(async () => {
    await fs.remove(tmpdir);
  });

  // eslint-disable-next-line no-shadow
  async function run() {
    try {
      await execFile(useCdnPath, { cwd: tmpdir });
    }
    catch (ex) {
      // eslint-disable-next-line no-console
      console.log(ex.stdout);
      // eslint-disable-next-line no-console
      console.log(ex.stderr);
      throw ex;
    }
  }

  // eslint-disable-next-line no-invalid-this
  this.timeout(5000);

  it("fails if there is no configuration to be found", async () => {
    const rejection = await expectRejection(execFile(useCdnPath));
    expect(rejection.stderr)
      .to.match(/Error: Cannot find module .*\/use-cdn.conf.js/);
  });

  it("runs with empty configuration", async () => {
    await fs.writeFile(path.join(tmpdir, "use-cdn.conf.js"),
                       "module.exports = []");
    await run();
  });

  it("runs with actual configuration", async () => {
    await fs.copy("test/simple.conf.js", path.join(tmpdir, "use-cdn.conf.js"));
    await run();
    let { stdout } = await execFile("find", [path.join(tmpdir, ".use-cdn/"),
                                             "-type", "f"]);
    const bs3 = "3.4.1";
    const jq3 = "3.4.1";
    expect(stdout.split("\n").sort().join("\n")).to.equal(`
test/tmp/.use-cdn/cache/bootstrap/${bs3}/dist/js/bootstrap.js
test/tmp/.use-cdn/cache/jquery/${jq3}/dist/jquery.js
test/tmp/.use-cdn/meta`);
    ({ stdout } = await execFile("find", [path.join(tmpdir, ".use-cdn/"),
                                          "-type", "l", "-printf", "%p %l\n"]));
    expect(stdout.split("\n").sort().join("\n")).to.equal(`
test/tmp/.use-cdn/cache/bootstrap/3 ${bs3}
test/tmp/.use-cdn/cache/jquery/latest ${jq3}`);
  });

  it("runs with complex configuration", async () => {
    await fs.copy("test/complex.conf.js", path.join(tmpdir, "use-cdn.conf.js"));
    await run();
    let { stdout } = await execFile("find", [path.join(tmpdir, ".use-cdn/"),
                                             "-type", "f"]);
    const bs3 = "3.4.1";
    const jq3 = "3.4.1";
    expect(stdout.split("\n").sort().join("\n")).to.equal(`
test/tmp/.use-cdn/cache/jquery/${jq3}/jquery.js
test/tmp/.use-cdn/cache/twitter-bootstrap/${bs3}/js/bootstrap.js
test/tmp/.use-cdn/meta`);
    ({ stdout } = await execFile("find", [path.join(tmpdir, ".use-cdn/"),
                                          "-type", "l", "-printf", "%p %l\n"]));
    expect(stdout.split("\n").sort().join("\n")).to.equal(`
test/tmp/.use-cdn/cache/bootstrap/3 ${bs3}
test/tmp/.use-cdn/cache/jquery/latest ${jq3}`);
  });
});
