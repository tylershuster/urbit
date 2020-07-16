const nodeResolve = require('@rollup/plugin-node-resolve').nodeResolve;

module.exports = {
  rollup(config, options) {
    config.plugins.push(
      nodeResolve({ browser: true })
    );
    return config;
  },
};