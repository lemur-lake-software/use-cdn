"use strict";

const pickManifest = require("npm-pick-manifest");

exports.triggerLazyLoading = function triggerLazyLoading() {
  // We do this so that some modules loaded lazily by npm-pick-manifest
  // get loaded prior to starting mockFs.

  try {
    pickManifest({
      name: "foo",
    }, "1.2.3");
  }
  catch (err) {
    // Ignore this error.
  }

  try {
    pickManifest({
      "name": "foo",
      "versions": {
        "1.2.3": "foo",
      },
      "dist-tags": {
        latest: "1.2.3",
      },
    }, "fnord");
  }
  catch (err) {
    // Ignore this error.
  }
};
