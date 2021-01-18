const webpack = require('webpack')
const path = require('path')
const fileSystem = require('fs-extra')
const env = require('./utils/env')
const { CleanWebpackPlugin } = require('clean-webpack-plugin')
const CopyWebpackPlugin = require('copy-webpack-plugin')
const HtmlWebpackPlugin = require('html-webpack-plugin')
const TerserPlugin = require('terser-webpack-plugin')

const ASSET_PATH = process.env.ASSET_PATH || '/'

const alias = {
  'react-dom': '@hot-loader/react-dom'
}

// load the secrets
const secretsPath = path.join(__dirname, 'secrets.' + env.NODE_ENV + '.js')

const fileExtensions = [
  'jpg',
  'jpeg',
  'png',
  'gif',
  'eot',
  'otf',
  'svg',
  'ttf',
  'woff',
  'woff2'
]

if (fileSystem.existsSync(secretsPath)) {
  alias.secrets = secretsPath
}

const createOptions = browser => {
  const options = {
    name: browser,
    mode: process.env.NODE_ENV || 'development',
    entry: {
      options: path.join(__dirname, 'src', 'pages', 'Options', 'index.jsx'),
      popup: path.join(__dirname, 'src', 'pages', 'Popup', 'index.jsx'),
      background: path.join(__dirname, 'src', 'pages', 'Background', 'index.js')
    },
    output: {
      path: path.resolve(__dirname, 'build_' + browser),
      filename: '[name].bundle.js',
      publicPath: ASSET_PATH
    },
    module: {
      rules: [
        {
        // look for .css or .scss files
          test: /\.(css|scss)$/,
          // in the `src` directory
          use: [
            {
              loader: 'style-loader'
            },
            {
              loader: 'css-loader'
            },
            {
              loader: 'sass-loader',
              options: {
                sourceMap: true
              }
            }
          ]
        },
        {
          test: new RegExp('.(' + fileExtensions.join('|') + ')$'),
          loader: 'file-loader',
          options: {
            name: '[name].[ext]'
          },
          exclude: /node_modules/
        },
        {
          test: /\.html$/,
          loader: 'html-loader',
          exclude: /node_modules/
        },
        { test: /\.(ts|tsx)$/, loader: 'ts-loader', exclude: /node_modules/ },
        {
          test: /\.(js|jsx)$/,
          use: [
            {
              loader: 'source-map-loader'
            },
            {
              loader: 'babel-loader'
            }
          ],
          exclude: /node_modules/
        }
      ]
    },
    resolve: {
      alias: alias,
      extensions: fileExtensions
        .map((extension) => '.' + extension)
        .concat(['.js', '.jsx', '.ts', '.tsx', '.css'])
    },
    plugins: [
      new webpack.ProgressPlugin(),
      // clean the build folder
      new CleanWebpackPlugin({
        verbose: true,
        cleanStaleWebpackAssets: true
      }),
      // expose and write the allowed env vars on the compiled bundle
      new webpack.EnvironmentPlugin(['NODE_ENV']),
      new CopyWebpackPlugin({
        patterns: [
          {
            from: fileSystem.existsSync(`src/manifest_${browser}.json`) ? `src/manifest_${browser}.json` : 'src/manifest.json',
            to: path.join(__dirname, 'build_' + browser, 'manifest.json'),
            force: true,
            transform: function (content, path) {
            // generates the manifest file using the package.json informations
              return Buffer.from(
                JSON.stringify({
                  description: process.env.npm_package_description,
                  version: process.env.npm_package_version,
                  ...JSON.parse(content.toString())
                })
              )
            }
          }
        ]
      }),
      new HtmlWebpackPlugin({
        template: path.join(__dirname, 'src', 'pages', 'Options', 'index.html'),
        filename: 'options.html',
        chunks: ['options'],
        cache: false
      }),
      new HtmlWebpackPlugin({
        template: path.join(__dirname, 'src', 'pages', 'Popup', 'index.html'),
        filename: 'popup.html',
        chunks: ['popup'],
        cache: false
      }),
      new HtmlWebpackPlugin({
        template: path.join(
          __dirname,
          'src',
          'pages',
          'Background',
          'index.html'
        ),
        filename: 'background.html',
        chunks: ['background'],
        cache: false
      })
    ],
    infrastructureLogging: {
      level: 'info'
    }
  }
  return options
}

const options = [createOptions('chrome'), createOptions('firefox')].map(options => {
  if (env.NODE_ENV === 'development') {
    options.devtool = 'eval-cheap-module-source-map'
  } else {
    options.optimization = {
      minimize: true,
      minimizer: [
        new TerserPlugin({
          extractComments: false
        })
      ]
    }
  }
  return options
})

module.exports = options
