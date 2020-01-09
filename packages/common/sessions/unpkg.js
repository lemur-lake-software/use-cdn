"use strict";

// We need this on Node 8.
const { URL } = require("url");

const superagent = require("superagent");

const UNPKG_URL = "https://unpkg.com/";

const { BaseVersionResolver } = require("../version-resolvers/base");
const { BaseSession } = require("./base");

class UnpkgVersionResolver extends BaseVersionResolver {
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
    this.base = this.config.url || UNPKG_URL;

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
    const packageUrl = this.makePackageUrl(pkg, versionOrTag);
    this.logger.debug(`resolving ${packageUrl}`);
    const res = await superagent
          .get(packageUrl)
          .redirects(0)
          .ok(x => x.status === 302);

    let { headers: { location } } = res;
    if (location[0] !== "/") {
      location = new URL(location).pathname;
    }

    [location] = location.slice(1).split("/", 1);

    const [actualPackage, actualVersion] = location.split("@");

    if (actualVersion === undefined || actualVersion === "") {
      throw new Error(`${pkg}@${versionOrTag} resolves to something without \
a version: ${location}`);
    }

    if (actualPackage !== pkg) {
      throw new Error(`${pkg}@${versionOrTag} resolves to a different \
package: ${location}`);
    }

    return actualVersion;
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
  makePackageUrl(pkg, version) {
    return `${this.base}${pkg}@${version}`;
  }
}

/**
 * This class models one session of access to the Unpkg CDN.
 */
class UnpkgSession extends BaseSession {
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
    super(config.url || UNPKG_URL, logger, cache, resolver);
  }
}

UnpkgSession.NativeResolver = UnpkgVersionResolver;

exports.UnpkgSession = UnpkgSession;
