"use strict";

module.exports = [{
  package: "bootstrap",
  version: "3",
  files: [
    "dist/js/bootstrap.js",
  ],
}, {
  package: "jquery",
  version: "latest",
  files: [
    () => "dist/jquery.js",
  ],
}];
