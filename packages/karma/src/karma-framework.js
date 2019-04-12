"use strict";

const { getFileList } = require("@use-cdn/common/load");

const frameworkName = "framework:use-cdn";

function useCDNFramework(karmaConfig, loggerFactory) {
  const logger = loggerFactory.create(frameworkName);

  karmaConfig.files.unshift(...getFileList(logger).map(file => ({
    pattern: file,
    included: true,
    served: true,
    watched: false,
  })));
}

useCDNFramework.$inject = ["config", "logger"];

module.exports = {
  [frameworkName]: ["factory", useCDNFramework],
};
