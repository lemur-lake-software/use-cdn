"use strict";

const path = require("path");

const fs = require("fs-extra");

const { getCacheBasePath, getDataBasePath, getMetaPath } = require("./paths");
const { isTag } = require("./util");

const CURRENT_VERSION = 1;

class BaseCache {
  /**
   * Compute the path of a file in the cache. For instance if we want to know
   * where the file ``"foo/bar.js"`` of the package ``fnord`` version 2 would be
   * located in the cache, we call this function as:
   *
   * ```
   * makeFilePath("fnord", "2", "foo/bar.js");
   * ```
   *
   * @param {string} pkg The package name.
   *
   * @param {string} versionOrTag The version or tag to use.
   *
   * @param {string} file The path to the file inside the package.
   *
   * @returns {string} The computed path.
   */
  makeFilePath(pkg, versionOrTag, file) {
    return path.join(this.makePackagePath(pkg, versionOrTag), file);
  }

  /**
   * Compute the path of a package in the cache. For instance if we want to know
   * where the the package ``fnord`` version 2 would be located in the cache, we
   * call this function as:
   *
   * ```
   * makePkgPath("fnord", "2");
   * ```
   *
   * @param {string} pkg The package name.
   *
   * @param {string} versionOrTag The version or tag to use.
   *
   * @returns {string} The computed path.
   */
  // eslint-disable-next-line class-methods-use-this
  makePackagePath(pkg, versionOrTag) {
    return path.join(getCacheBasePath(), pkg, versionOrTag);
  }
}

/**
 * This class models the on-disk cache of files. This model is asynchronous and
 * can read from and write to the cache.
 *
 * Important caveats:
 *
 * - Concurrent writes from multiple processes are not supported.
 *
 * - Concurrent calls to ``set`` from the same process is fine.
 *
 * - Concurrent calls to ``link`` from the same process is fine, provided that
 *   all the calls are for different ``(package, tag)`` pairs.
 *
 */
class WritableCache extends BaseCache {
  constructor() {
    super();
    this.initialized = false;
  }

  /**
   * Initialize the cache. This must be called prior to using the cache.
   *
   * - Creates the cache if it does not already exist.
   *
   * - Reports any cache consistency issues it detects and cannot deal with.
   *
   * - Deletes the cache and creates a new one, if the existing cache used an
   *   older internal format.
   *
   * @returns {Promise<void>} A promise that resolves once the initialization is
   * done.
   */
  async init() {
    const dataBasePath = getDataBasePath();
    const metaPath = getMetaPath();
    if (!await fs.pathExists(dataBasePath)) {
      await this._createCache();
    }
    else {
      let meta;
      try {
        meta = JSON.parse((await fs.readFile(metaPath)).toString());
      }
      catch (ex) {
        throw new Error(`cannot read ${metaPath}; we're assuming that \
${dataBasePath} is not a use-cdn directory: move the data somewhere else or \
delete it`);
      }

      if (meta.version < CURRENT_VERSION) {
        await fs.remove(dataBasePath);
        await this._createCache();
      }
      else if (meta.version > CURRENT_VERSION) {
        throw new Error(`the version number stored in ${metaPath} is greater \
than the version we support`);
      }
    }

    this.initialized = true;
  }

  assertInitialized() {
    if (!this.initialized) {
      throw new Error("the cache has not been initialized");
    }
  }

  /**
   * Creates a new cache on disk.
   *
   * @returns {Promise<void>} A promise that resolves once the cache is created.
   *
   * @private
   */
  // eslint-disable-next-line class-methods-use-this
  async _createCache() {
    await fs.ensureDir(getCacheBasePath());
    return fs.writeFile(getMetaPath(),
                        JSON.stringify({ version: CURRENT_VERSION }, null, 2));
  }

  /**
   * Sets the content of a file in the cache.
   *
   * @param {string} pkg The package to store.
   *
   * @param {string} version The version of the package.
   *
   * @param {string} file The path to the file inside the package.
   *
   * @param {string} content The content of the file.
   *
   * @returns {Promise<string>} A promise that resolves to the path of the file
   * in the cache where ``content`` is stored.
   */
  async set(pkg, version, file, content) {
    this.assertInitialized();
    if (isTag(version)) {
      throw new Error("set called with tag, which is not allowed");
    }
    const filePath = this.makeFilePath(pkg, version, file);
    await fs.ensureDir(path.dirname(filePath));
    await fs.writeFile(filePath, content);
    return filePath;
  }

  /**
   * Gets the file path of a file in the cache.
   *
   * @param {string} pkg The package to store.
   *
   * @param {string} versionOrTag The version of the package, or a tag.
   *
   * @param {string} file The path to the file inside the package.
   *
   * @returns {Promise<string|undefined>} A promise that resolves to the path of
   * the file in the cache where ``content`` is stored, or ``undefined`` if the
   * file is not stored.
   */
  async getPath(pkg, versionOrTag, file) {
    this.assertInitialized();
    const filePath = this.makeFilePath(pkg, versionOrTag, file);
    try {
      await fs.access(filePath);
      return filePath;
    }
    catch (ex) {
      return undefined;
    }
  }

  /**
   * Links a tagged version of a package to the version it resolves to. This
   * method forcibly sets the link, whether or not one existed prior.
   *
   * This is used to record how a tag resolved.
   *
   * @param {string} pkg The package to act upon.
   *
   * @param {string} version The version to which ``tag`` resolves.
   *
   * @param {string} tag The tag that resolves to ``version``.
   *
   * @returns {Promise<void>} A promise that resolves when the link is done.
   */
  async link(pkg, version, tag) {
    this.assertInitialized();
    const tagPath = this.makePackagePath(pkg, tag);
    await fs.remove(tagPath);
    await fs.ensureDir(path.dirname(tagPath));
    await fs.symlink(version, tagPath);
  }
}

/**
 * This class models the on-disk cache of files. This model works synchronously
 * and can only read files from the cache.
 *
 * This class is meant to be used by testing framework plugins that are
 * constrained to synchronous operation.
 */
class SyncReadableCache extends BaseCache {
  /**
   * Create the cache.
   *
   * @throws {Error} If the cache cannot be read. Or if the cache version number
   * is not the same as currently supported.
   */
  constructor() {
    super();
    let meta;
    const metaPath = getMetaPath();
    try {
      meta = JSON.parse(fs.readFileSync(metaPath).toString());
    }
    catch (ex) {
      throw new Error(`cannot read ${metaPath}`);
    }

    if (meta.version !== CURRENT_VERSION) {
      throw new Error("the use-cdn data is not up to date");
    }
  }

  /**
   * Gets the file path of a file in the cache.
   *
   * @param {string} pkg The package to store.
   *
   * @param {string} versionOrTag The version of the package, or a tag.
   *
   * @param {string} file The path to the file inside the package.
   *
   * @returns {string} The path of the file in the cache where ``content`` is
   * stored.
   *
   * @throws {Error} If the file is not in the cache.
   */
  getPath(pkg, versionOrTag, file) {
    const filePath = this.makeFilePath(pkg, versionOrTag, file);
    fs.accessSync(filePath);
    return filePath;
  }

  /**
   * Resolve a version or a tag to a version number.
   *
   * **NOTE** If this function raise an ``ENOENT`` exception, then it is an
   * internal error. ``ENOENT`` should never happend because the ``pkg`` and
   * ``versionOrTag`` parameters should have been used pior to calling this
   * method to fill the cache. So either there *is* a link to be read or there
   * is a directory where the link *would* be.
   *
   * @param {string} pkg The package for which we want to resolve.
   *
   * @param {string} versionOrTag The version or tag to resolve.
   *
   * @returns {string} If the version number to which the ``versionOrTag``
   * resolves. Otherwise, ``versionOrTag`` is returned as-is.
   */
  resolveToVersion(pkg, versionOrTag) {
    try {
      return fs.readlinkSync(this.makePackagePath(pkg, versionOrTag));
    }
    catch (ex) {
      // EINVAL happens when we're trying to read something that is not a link.
      /* istanbul ignore if: we do not cause unexpected errors in testing. */
      if (ex.code !== "EINVAL") {
        throw ex;
      }

      return versionOrTag;
    }
  }
}

exports.WritableCache = WritableCache;
exports.SyncReadableCache = SyncReadableCache;
