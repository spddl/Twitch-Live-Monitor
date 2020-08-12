const webpack = require('webpack')
const path = require('path')
const fileSystem = require('fs-extra')
const env = require('./utils/env')
const { CleanWebpackPlugin } = require('clean-webpack-plugin')
const CopyWebpackPlugin = require('copy-webpack-plugin')
const HtmlWebpackPlugin = require('html-webpack-plugin')
const WriteFilePlugin = require('write-file-webpack-plugin')

// load the secrets
const alias = {
  'react-dom': '@hot-loader/react-dom'
}

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

const createOptions = browser => {
  const options = {
    mode: process.env.NODE_ENV || 'development',
    entry: {
      options: path.join(__dirname, 'src', 'pages', 'Options', 'index.jsx'),
      popup: path.join(__dirname, 'src', 'pages', 'Popup', 'index.jsx'),
      background: path.join(__dirname, 'src', 'pages', 'Background', 'index.js'),
      contentScript: path.join(__dirname, 'src', 'pages', 'Content', 'index.js')
    },
    output: {
      path: path.resolve(__dirname, 'build_' + browser),
      filename: '[name].bundle.js'
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
          loader: 'file-loader?name=[name].[ext]',
          exclude: /node_modules/
        },
        {
          test: /\.html$/,
          loader: 'html-loader',
          exclude: /node_modules/
        },
        {
          test: /\.(js|jsx)$/,
          loader: 'babel-loader',
          exclude: /node_modules/
        }
      ]
    },
    resolve: {
      alias: alias,
      extensions: fileExtensions
        .map(extension => '.' + extension)
        .concat(['.jsx', '.js', '.css'])
    },
    plugins: [
      new webpack.ProgressPlugin(),
      // clean the build folder
      new CleanWebpackPlugin({
        verbose: true,
        cleanStaleWebpackAssets: false
      }),
      // expose and write the allowed env consts on the compiled bundle
      new webpack.EnvironmentPlugin(['NODE_ENV']),
      new CopyWebpackPlugin(
        [
          {
            from: fileSystem.existsSync(`src/manifest_${browser}.json`) ? `src/manifest_${browser}.json` : 'src/manifest.json',
            to: path.join(__dirname, 'build_' + browser, 'manifest.json'), // to: path.join(__dirname, 'build'),
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
        ],
        {
          logLevel: 'info',
          copyUnmodified: true
        }
      ),
      new CopyWebpackPlugin(
        [
          {
            from: 'src/pages/Content/content.styles.css',
            // to: path.join(__dirname, 'build'),
            to: path.join(__dirname, 'build_' + browser), // to: path.join(__dirname, 'build'),
            force: true
          }
        ],
        {
          logLevel: 'info',
          copyUnmodified: true
        }
      ),
      // new HtmlWebpackPlugin({
      //   template: path.join(__dirname, 'src', 'pages', 'Newtab', 'index.html'),
      //   filename: 'newtab.html',
      //   chunks: ['newtab']
      // }),
      new HtmlWebpackPlugin({
        template: path.join(__dirname, 'src', 'pages', 'Options', 'index.html'),
        filename: 'options.html',
        chunks: ['options']
      }),
      new HtmlWebpackPlugin({
        template: path.join(__dirname, 'src', 'pages', 'Popup', 'index.html'),
        filename: 'popup.html',
        chunks: ['popup']
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
        chunks: ['background']
      }),
      new WriteFilePlugin()
    ]
  }

  return options
}

const options = [
  createOptions('chrome'),
  createOptions('firefox')
]

if (env.NODE_ENV === 'development') {
  options.devtool = 'cheap-module-eval-source-map'
}

module.exports = options
