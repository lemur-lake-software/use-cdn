"use strict";

const { UseCDN } = require("@use-cdn/common/use-cdn");
const { loadConfig } = require("@use-cdn/common/util");
const logger = require("@use-cdn/common/logger");

async function main() {
  const config = loadConfig();
  logger.setup("ALL");
  const use = new UseCDN(config, logger.getLogger("use-cdn"));
  await use.init();
  await use.resolve();
}

process.on("unhandledRejection", err => {
  // eslint-disable-next-line no-console
  console.error(err.stack);
  process.exit(1);
});

main();
