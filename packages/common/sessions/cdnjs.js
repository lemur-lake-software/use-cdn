"use strict";

const CDNJS_URL = "https://cdnjs.cloudflare.com/";

const { BaseSession } = require("./base");

/**
 * This class models one session of access to the Unpkg CDN.
 */
class CdnjsSession extends BaseSession {
  /**
   * @param {CDNConfig} config The CDN configuration.
   *
   * @param {object} logger The logger to use. It must be an object supporting
   * the log4js methods.
   *
   * @param {WritableCache} cache The cache to write to.
   *
   * @param {VersionResolver} resolver The resolver to use to resolve version.
   */
  constructor(config = {}, logger, cache, resolver) {
    super(config.url || CDNJS_URL, logger, cache, resolver);
  }

  /**
   * Build the URL that serves a specific package and version in this CDN.
   *
   * @param {string} pkg The package for which to build a URL.
   *
   * @param {string} version The version for which to build a URL.
   *
   * @returns {string} The package's URL.
   */
  // eslint-disable-next-line class-methods-use-this
  makePackageUrl(pkg, version) {
    return `${this.base}ajax/libs/${pkg}/${version}`;
  }
}

exports.CdnjsSession = CdnjsSession;
