"use strict";

module.exports = {
  cdns: {
    cdnjs: {
      resolver: "npm",
    },
  },
  packages: [{
    cdn: "cdnjs",
    package: "twitter-bootstrap",
    resolveAs: "bootstrap",
    version: "3",
    files: [
      "js/bootstrap.js",
    ],
  }, {
    cdn: "cdnjs",
    package: "jquery",
    version: "latest",
    files: [
      () => "jquery.js",
    ],
  }],
};
