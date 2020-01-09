"use strict";

const pickManifest = require("npm-pick-manifest");
const superagent = require("superagent");

const { BaseVersionResolver } = require("./base");

class NPMVersionResolver extends BaseVersionResolver {
  /**
   * @param {ResolverConfig} config The resolver configuration.
   *
   * @param {object} logger The logger to use. It must be an object supporting
   * the log4js methods.
   *
   * @param {WritableCache} cache The cache to write to.
   */
  constructor(config, logger, cache) {
    super(logger, cache);

    /* @protected */
    this.config = config || {};

    /* @protected */
    this.base = this.config.url || "https://registry.npmjs.org/";

    // This is crude but it works.
    if (!this.base.endsWith("/")) {
      this.base += "/";
    }
  }

  async fetchVersion(pkg, versionOrTag) {
    const packageUrl = this.makePackageUrl(pkg);
    this.logger.debug(`resolving ${packageUrl}`);
    const res = await superagent.get(packageUrl);

    const manifest = await pickManifest(res.body, versionOrTag);

    if (res.body.name !== pkg) {
      throw new Error(`${pkg} resolves to a different package: \
${res.body.name}`);
    }

    return manifest.version;
  }

  /**
   * Build the URL that serves a specific package and version in this CDN.
   *
   * @private
   *
   * @param {string} pkg The package for which to build a URL.
   *
   * @returns {string} The package's URL.
   */
  makePackageUrl(pkg) {
    return `${this.base}${pkg}`;
  }
}

exports.NPMVersionResolver = NPMVersionResolver;
