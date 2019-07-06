"use strict";

const { BaseVersionResolver } = require("./base");

class NullVersionResolver extends BaseVersionResolver {
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
    this.logger.debug(`resolving ${pkg}, ${versionOrTag}`);
    return versionOrTag;
  }
}

exports.NullVersionResolver = NullVersionResolver;
