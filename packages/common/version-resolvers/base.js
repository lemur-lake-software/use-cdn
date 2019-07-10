"use strict";

class BaseVersionResolver {
  /**
   * @param {object} logger The logger to use. It must be an object supporting
   * the log4js methods.
   *
   * @param {WritableCache} cache The cache to write to.
   */
  constructor(logger, cache) {
    /* @protected */
    this.logger = logger;

    /* @protected */
    this.cache = cache;

    /* @private */
    this.packageToResolved = Object.create(null);
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

    let promise = resolved[versionOrTag];
    if (promise === undefined) {
      promise = resolved[versionOrTag] = (async () => {
        const actualVersion = await this.fetchVersion(pkg, versionOrTag);

        if (versionOrTag !== actualVersion) {
          await this.cache.link(pkg, actualVersion, versionOrTag);
        }

        return actualVersion;
      })();
    }

    return promise;
  }

  /**
   * Fetch the actual version number that a package and version-or-tag resolves
   * to. Derived classes must implement this method.
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
  // eslint-disable-next-line class-methods-use-this, no-unused-vars
  async fetchVersion(pkg, versionOrTag) {
    throw new Error("not implemented");
  }
}

exports.BaseVersionResolver = BaseVersionResolver;
