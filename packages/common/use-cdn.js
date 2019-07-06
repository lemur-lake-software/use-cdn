"use strict";

const { applyOverride } = require("./util");
const { WritableCache } = require("./caching");
const { sessionFactories } = require("./sessions/all");
const { resolverFactories } = require("./version-resolvers/all");

/**
 * @typedef {object} PackageConfig
 *
 * @prop {string} package The package to fetch.
 *
 * @prop {string} version The version of the package, or a distribution tag.
 *
 * @prop {(string|Function)[]} files An array specifying the files to get from
 * the package. When the array item is a function, it will be called with the
 * version number of the package. It must return a string which will be
 * interpeted as a file name to fetch.
 */

/**
 * @typedef {object} CDNConfig
 *
 * @prop {string} url The URL at which this CDN resides.
 */

/**
 * @typedef {object} Config
 *
 * @prop {Object.<string, CDNConfig>} cdns The configuration of each individual
 * CDNs.
 *
 * @prop {PackageConfig[]} packages The packages to fetch.
 */

/**
 * An instance of this class is instantiated to fetch files from CDNs and
 * populate the disk cache.
 */
class UseCDN {
  /**
   * @param {Config} config The use-cdn configuration.
   *
   * @param {object} logger The logger to use. It must be an object supporting
   * the log4js methods.
   */
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
    this.cache = new WritableCache();
    this.sessions = Object.create(null);
    this.resolvers = Object.create(null);
    this.initialized = false;
  }

  /**
   * Initializes the object.
   *
   * @returns {Promise<void>} A promise that resolves once the object is
   * initialized.
   */
  async init() {
    await this.cache.init();
    this.initialized = true;
  }

  assertInitialized() {
    if (!this.initialized) {
      throw new Error("the object has not been initialized");
    }
  }

  /**
   * Resolve all the resources specified in the configuration and store them in
   * the on-disk cache.
   *
   * @returns {Promise<void>} A promise that resolves once the resources are all
   * resolved.
   */
  async resolve() {
    this.assertInitialized();
    const { config: { packages } } = this;
    const promises = [];
    for (const spec of packages) {
      const { cdn, package: pkg, files } = spec;
      const session = this.getSession(cdn);

      const version = applyOverride(pkg, spec.version);
      for (const pathToServe of files) {
        promises.push(session.resolve(pkg, version, pathToServe));
      }
    }

    await Promise.all(promises);
  }

  /**
   * Get the session associated with a CDN. This method caches its return
   * values. When first called on an instance of this class, the session
   * associated with the requested CDN does not exist yet. So this method
   * creates it. Subsequent calls to this method requesting the came CDN on the
   * same instance will return the same session as the one created on the first
   * call for the same CDN.
   *
   * @param {string} cdn The name of the CND for which we want a session.
   *
   * @returns {object} The session.
   *
   * @throws {Error} If the CDN requested is not supported.
   */
  getSession(cdn) {
    this.assertInitialized();
    cdn = cdn || "unpkg";
    let session = this.sessions[cdn];
    if (!session) {
      const factory = sessionFactories[cdn];
      if (factory === undefined) {
        throw new Error(`unsupported cdn: ${cdn}`);
      }

      const cdnConfig = this.config.cdns[cdn] || {};
      let resolverName = cdnConfig.resolver;
      if (resolverName in sessionFactories) {
        throw new Error(`you may not use a session name as a resolver name, to
specify the resolver native to a session, use "native"`);
      }
      if (resolverName === "native") {
        resolverName = cdn;
      }

      session = this.sessions[cdn] =
        // eslint-disable-next-line new-cap
        new factory(cdnConfig, this.logger, this.cache,
                    this.getVersionResolver(resolverName));
    }

    return session;
  }

  /**
   * Get a version resolver. This method caches its return values. When first
   * called on an instance of this class, the resolver does not exist yet. So
   * this method creates it. Subsequent calls to this method requesting the came
   * resolver on the same instance will return the same resolver as the one
   * created on the first call for the same resolver.
   *
   * @param {string} name The name of the resolver we want to create.
   *
   * @returns {object} The resolver.
   *
   * @throws {Error} If the resolver requested is not supported.
   */
  getVersionResolver(name) {
    this.assertInitialized();
    name = name || "npm";
    let resolver = this.resolvers[name];
    if (!resolver) {
      let factory = resolverFactories[name];
      if (factory === undefined) {
        const session = sessionFactories[name];
        factory = session && session.NativeResolver;
      }
      if (factory === undefined) {
        throw new Error(`unsupported resolver: ${name}`);
      }
      // eslint-disable-next-line new-cap
      resolver = this.resolvers[name] = new factory(this.config.resolvers[name],
                                                    this.logger, this.cache);
    }

    return resolver;
  }
}

exports.UseCDN = UseCDN;
