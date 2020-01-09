"use strict";

const superagent = require("superagent");

/**
 * This class can serve as a base for other sessions.
 *
 * In this software a "session" is a series of requests made to a single CDN for
 * resolving resources. Two different CDNs would use two different
 * sessions. Conversely all resolution requests for the same CDN must be done
 * through the same session.
 */
class BaseSession {
  /**
   *
   * @param {string} base The base URL for this CDN.
   *
   * @param {object} logger The logger to use. It must be an object supporting
   * the log4js methods.
   *
   * @param {WritableCache} cache The cache to write to.
   *
   * @param {VersionResolver} resolver The resolver to use to resolve version.
   */
  constructor(base, logger, cache, resolver) {
    this.base = base;

    // This is crude but it works.
    if (!this.base.endsWith("/")) {
      this.base += "/";
    }

    this.logger = logger;
    this.cache = cache;
    this.resolver = resolver;
  }

  /**
   * Resolve a resource to a path in the cache. If the resource is not yet in
   * the cache, it is fetched over the network.
   *
   * @param {string} pkg The package name.
   *
   * @param {string} [resolveAs] The package name to use for resolution
   * purposes.
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
  async resolve(pkg, resolveAs, versionOrTag, file) {
    if (resolveAs === undefined) {
      resolveAs = pkg;
    }
    const version = await this.resolveToVersion(resolveAs, versionOrTag);

    if (typeof file === "function") {
      file = file(version);
    }

    let cached = await this.cache.getPath(pkg, version, file);
    if (cached === undefined) {
      const res = await this.fetchFile(pkg, version, file);
      cached = await this.cache.set(pkg, version, file, res);
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
    return this.resolver.resolveToVersion(pkg, versionOrTag);
  }

  /**
   * Fetch a file from the CDN. Derived classes may override this method.
   *
   * @protected
   *
   * @param {string} pkg The package name.
   *
   * @param {string} version The version of the package. Note that this version
   * is taken literally. Any resolution must have happened prior to calling this
   * function.
   *
   * @param {string} file A path to a file in the package.
   *
   * @returns {Promise<string>} A promise resolving to the content of the file.
   */
  async fetchFile(pkg, version, file) {
    const fileUrl = this.makeFileUrl(pkg, version, file);
    this.logger.debug(`fetching ${fileUrl}`);
    const res = await superagent.get(fileUrl).buffer();
    return res.text;
  }

  /**
   * Build the URL that serves a specific file within a package in this CDN.
   * Derived classes may override this method.
   *
   * @protected
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

  /**
   * Build the URL that serves a specific package and version in this CDN.
   * Derived classes may override this method.
   *
   * @protected
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

exports.BaseSession = BaseSession;
