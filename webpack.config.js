const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');

module.exports = (env, argv) => {
  const isProd = argv.mode === 'production';

  return {
    entry: {
      background: './src/background/index.ts',
      content: './src/content/index.ts',
      popup: './src/popup/index.ts',
      sidepanel: './src/sidepanel/index.ts',
      options: './src/options/index.ts',
      target: './src/target/index.ts',
    },
    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: '[name].js',
      clean: true,
    },
    resolve: {
      extensions: ['.ts', '.js'],
    },
    module: {
      rules: [
        {
          test: /\.ts$/,
          use: 'ts-loader',
          exclude: /node_modules/,
        },
        {
          test: /\.css$/,
          use: [MiniCssExtractPlugin.loader, 'css-loader', 'postcss-loader'],
        },
      ],
    },
    plugins: [
      new MiniCssExtractPlugin({
        filename: '[name].css',
      }),
      new CopyPlugin({
        patterns: [
          { from: 'manifest.json', to: 'manifest.json' },
          { from: 'src/popup/index.html', to: 'popup.html' },
          { from: 'src/sidepanel/index.html', to: 'sidepanel.html' },
          { from: 'src/options/index.html', to: 'options.html' },
          { from: 'src/target/index.html', to: 'target.html' },
          { from: 'public/icons', to: 'icons' },
          { from: 'data', to: 'data' },
        ],
      }),
    ],
    devtool: isProd ? false : 'cheap-module-source-map',
    optimization: {
      minimize: isProd,
    },
  };
};
