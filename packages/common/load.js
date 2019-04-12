"use strict";

const { applyOverride, loadConfig } = require("./util");
const { SyncReadableCache } = require("./caching");

/**
 * This is a utility function that a plugin for a testing framework could use to
 * get the list of files to serve with a minimum of knowledge of how use-cdn
 * works.
 *
 * @param {object} logger A logger that supports the log4js logging methods.
 *
 * @returns {Array<string>} The list of file names to serve from the cache.
 */
function getFileList(logger) {
  const config = loadConfig();
  const cache = new SyncReadableCache();

  const add = [];
  for (const spec of config) {
    const { package: pkg, files } = spec;
    const version = applyOverride(pkg, spec.version);

    const resolvedVersion = cache.resolveToVersion(pkg, version);
    for (let file of files) {
      if (typeof file === "function") {
        file = file(resolvedVersion);
      }

      const pathToServe = cache.getPath(pkg, resolvedVersion, file);
      logger.debug(`adding file ${pathToServe}`);
      add.push(pathToServe);
    }
  }

  return add;
}

exports.getFileList = getFileList;
