"use strict";

// We need this on Node 8.
const { URL } = require("url");

const superagent = require("superagent");

/**
 * This class models one session of access to the Unpkg CDN.
 *
 * In this software a "session" is a series of requests made to a single CDN for
 * resolving resources. Two different CDNs would use two different
 * sessions. Conversely all resolution requests for the same CDN must be done
 * through the same session.
 */
class UnpkgSession {
  /**
   * @param {CDNConfig} config The CDN configuration.
   *
   * @param {object} logger The logger to use. It must be an object supporting
   * the log4js methods.
   *
   * @param {WritableCache} cache The cache to write to.
   */
  constructor(config, logger, cache) {
    this.config = config || {};
    this.base = this.config.url || "https://unpkg.com/";

    // This is crude but it work.
    if (!this.base.endsWith("/")) {
      this.base += "/";
    }

    this.logger = logger;
    this.cache = cache;
    this.packageToResolved = Object.create(null);
  }

  /**
   * Resolve a resource to a path in the cache. If the resource is not yet in
   * the cache, it is fetched over the network.
   *
   * @param {string} pkg The package name.
   *
   * @param {string} versionOrTag The version of the package or an NPM tag
   * pointing to a version.
   *
   * @param {string|function} file A path to a file in the package. If it is a
   * function, it is called with ``versionOrTag`` resolved to an actual version
   * number and must return a string which is a path to a file in the
   * package. Using a function is useful if a package's structure has changed
   * from version to version.
   *
   * @returns {Promise<string>} A promise resolving to path to the resource in
   * the cache.
   */
  async resolve(pkg, versionOrTag, file) {
    const version = await this.resolveToVersion(pkg, versionOrTag);

    if (typeof file === "function") {
      file = file(version);
    }

    let cached = await this.cache.getPath(pkg, version, file);
    if (cached === undefined) {
      const fileUrl = this.makeFileUrl(pkg, version, file);
      this.logger.debug(`fetching ${fileUrl}`);
      const res = await superagent.get(fileUrl).buffer();
      cached = await this.cache.set(pkg, version, file, res.text);
    }

    return cached;
  }

  /**
   * Resolve a tag to a version number. Note that if a ``pkg, tag`` pair has
   * been resolved already by this session, then subsequent calls to resolve it
   * will return the same value as the first call.
   *
   * @param {string} pkg The package whose tag we want to resolve.
   *
   * @param {string} versionOrTag The version or tag to resolve.
   *
   * @returns {Promse<string>} A promise resolving to the version number to
   * which the tag resolves.
   */
  async resolveToVersion(pkg, versionOrTag) {
    let resolved = this.packageToResolved[pkg];
    if (resolved === undefined) {
      resolved = this.packageToResolved[pkg] = Object.create(null);
    }

    const version = resolved[versionOrTag];
    if (version !== undefined) {
      return version;
    }

    const promise = resolved[versionOrTag] = (async () => {
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

      resolved[versionOrTag] = actualVersion;

      if (versionOrTag !== actualVersion) {
        await this.cache.link(pkg, actualVersion, versionOrTag);
      }

      return actualVersion;
    })();

    return promise;
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
    return `${this.base}${pkg}@${version}`;
  }

  /**
   * Build the URL that serves a specific file within a package in this CDN.
   *
   * @param {string} pkg The package for which to build a URL.
   *
   * @param {string} version The version for which to build a URL.
   *
   * @param {string} file The path to the file.
   *
   * @returns {string} The file's URL.
   */
  makeFileUrl(pkg, version, file) {
    return `${this.makePackageUrl(pkg, version)}/${file}`;
  }
}

exports.UnpkgSession = UnpkgSession;
