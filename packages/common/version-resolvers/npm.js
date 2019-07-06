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

  /**
   * Fetch the actual version number that a package and version-or-tag resolves
   * to.
   *
   * @protected
   *
   * @param {string} pkg The package whose version-or-tag we want to fetch.
   *
   * @param {string} versionOrTag The version or tag to fetch.
   *
   * @returns {Promse<string>} A promise resolving to actual version number to
   * which the pair resolves.
   */
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
  // eslint-disable-next-line class-methods-use-this
  makePackageUrl(pkg) {
    return `${this.base}${pkg}`;
  }
}

exports.NPMVersionResolver = NPMVersionResolver;
