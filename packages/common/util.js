"use strict";

const path = require("path");

const Ajv = require("ajv");
const reload = require("require-reload")(require);
const configSchema = require("./config-schema");

/**
 * Determine whether a string marks a tag (in the NPM sense of the term "tag")
 * or a version. In the NPM specification ``"foo@1.2.3"`` the string ``"1.2.3"``
 * is a version. In ``"foo@latest"`` the string ``"latest"`` is a tag.
 *
 * If the string begins with a number we assume a version, otherwise it is a
 * tag. This entails that ``"v1.0.0"`` will be treated as a tag, not a version.
 *
 * @param {string} versionOrTag A string which can be a version or a tag.
 *
 * @returns {boolean} Whether the string is a tag.
 */
function isTag(versionOrTag) {
  // eslint-disable-next-line no-restricted-globals
  return isNaN(+versionOrTag[0]);
}

let cachedOverrides;

/**
 * Get the overrides currently in effect.
 *
 * @returns {object} A plain JS object whose keys are package names and values
 * are version numbers or tags.
 *
 * @private
 */
function getOverrides() {
  if (cachedOverrides === undefined) {
    cachedOverrides = Object.create(null);
    const env = process.env.USE_CDN_OVERRIDES;
    if (env) {
      for (const part of env.split(/\s+/)) {
        const [pkg, version, ...rest] = part.split("@");
        if (version === undefined) {
          throw new Error(`package ${pkg} overriden without a version \
specification`);
        }

        if (rest.length > 0) {
          throw new Error(`the setting ${part} in the environment override is \
malformed`);
        }

        cachedOverrides[pkg] = version;
      }
    }
  }

  return cachedOverrides;
}

/**
 * Appy an override. Overrides are obtained from the ``USE_CDN_OVERRIDES``
 * environment variable. This variable is a space-separated list of package
 * specifications of the form ``<package-name>@<version-or-tag>``.
 *
 * For instance, the value ``"foo@1 bar@2"`` overrides the package ``foo`` to
 * use version 1 and the package ``bar`` to use version 2.
 *
 * @param {string} pkg The package on which to apply an override.
 *
 * @param {string} versionOrTag The version or tag to return if there is no
 * override.
 *
 * @returns {string} The overriden version or tag, or ``versionOrTag`` if there
 * was no applicable override.
 */
function applyOverride(pkg, versionOrTag) {
  const override = getOverrides()[pkg];

  return override !== undefined ? override : versionOrTag;
}

const ajv = new Ajv();

function validateUCType(schema, data) {
  if (schema === "file") {
    if (!["function", "string"].includes(typeof data)) {
      validateUCType.errors = [{
        keyword: "uc-type",
        message: "value is not a file",
        params: { data },
      }];

      return false;
    }
  }
  else {
    validateUCType.errors = [{
      keyword: "uc-type",
      message: "the value can only be 'file'",
    }];

    return false;
  }

  return true;
}

ajv.addKeyword("uc-type", {
  validate: validateUCType,
  errors: true,
});

const configValidator = ajv.compile(configSchema);

/**
 * Load the configuration for use-cdn. This loads the file ``use-cdn.conf.js``
 * in the cwd of the current process.
 *
 * @returns {string} The configuration.
 */
function loadConfig() {
  // eslint-disable-next-line import/no-dynamic-require, global-require
  const config = reload(path.resolve("./use-cdn.conf.js"));

  if (!configValidator(config)) {
    throw new Error(`the options passed to wed are not valid: ${
                    ajv.errorsText(configValidator.errors, {
                      dataVar: "options",
                    })}`);
  }

  return config;
}

exports.isTag = isTag;
exports.applyOverride = applyOverride;
exports.loadConfig = loadConfig;
exports.__test = {
  resetOverrides: () => {
    cachedOverrides = undefined;
  },
};
