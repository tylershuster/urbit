const nodeResolve = require('@rollup/plugin-node-resolve').nodeResolve;
const commonjs = require('@rollup/plugin-commonjs');

module.exports = {
  rollup(config, options) {
    // config.output.format = 'iife';
    // config.output.
    // config.plugins.push(
    //   commonjs(),
    //   nodeResolve()
    // );
    return config;
  },
};

// output: {
//     file: '/Users/tyler/Code/src/urbit/dist/urbit.esm.js',
//     format: 'esm',
//     freeze: false,
//     esModule: true,
//     name: 'urbit',
//     sourcemap: true,
//     globals: { react: 'React', 'react-native': 'ReactNative' },
//     exports: 'named'
//   },