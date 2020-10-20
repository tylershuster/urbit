const path = require('path');
const { CleanWebpackPlugin } = require('clean-webpack-plugin');
const webpack = require('webpack');

const shared = {
  mode: 'production',
  entry: {
     app: './src/index.ts'
  },
  module: {
    rules: [
      {
        test: /\.(j|t)s$/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: ['@babel/typescript'],
            plugins: [
              '@babel/plugin-proposal-class-properties',
              '@babel/plugin-proposal-object-rest-spread',
              '@babel/plugin-proposal-optional-chaining',
            ],
          }
        },
        exclude: /node_modules/
      }
    ]
  },
  resolve: {
    extensions: ['.js', '.ts', '.ts'],
    fallback: {
      http: require.resolve('stream-http'),
      https: require.resolve('stream-http'),
      fs: false,
      child_process: false,
      util: require.resolve("util/"),
      stream: require.resolve('stream-browserify'),
      zlib: require.resolve("browserify-zlib"),
      buffer: require.resolve('buffer/'),
      assert: false
    }
  },
  
  
  optimization: {
    minimize: false,
    usedExports: true
  }
};

const serverConfig = {
  ...shared,
  target: 'node',
  output: {
    filename: 'index.js',
    path: path.resolve(__dirname, 'dist'),
    library: 'Urbit',
    libraryExport: 'default',
    libraryTarget: 'umd'
  },
  plugins: [
    new webpack.ProvidePlugin({
      XMLHttpRequest: ['xmlhttprequest-ssl', 'XMLHttpRequest'],
      EventSource: 'eventsource'
    })
  ],
};

const browserConfig = {
  ...shared,
  output: {
    filename: 'browser.js',
    path: path.resolve(__dirname, 'dist'),
    library: 'Urbit',
    libraryExport: 'default',
    libraryTarget: 'umd'
  },
  plugins: [
    new webpack.ProvidePlugin({
      Buffer: 'buffer'
    })
  ],
};

const exampleConfig = {
  ...shared,
  mode: 'development',
  entry: {
     app: './src/example.js'
  },
  output: {
    filename: 'index.js',
    path: path.resolve(__dirname, 'example'),
  }
};

module.exports = [ serverConfig, browserConfig, exampleConfig ];