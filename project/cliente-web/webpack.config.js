// Ubicación: cliente-web/webpack.config.js

const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const webpack = require('webpack');

module.exports = {
  mode: 'development',
  entry: './js/main.js',
  
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'bundle.js',
    clean: true
  },
  
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: ['@babel/preset-env']
          }
        }
      },
      {
        test: /\.css$/i,
        use: ['style-loader', 'css-loader']
      },
      // ✅ Regla específica para ChatSystem.js
      {
        test: /ChatSystem\.js$/,
        parser: {
          // Desactivar warnings de require dinámico SOLO para este archivo
          requireEnsure: false,
          requireInclude: false,
          wrappedContextCritical: false,
          exprContextCritical: false
        }
      }
    ]
  },
  
  plugins: [
    new HtmlWebpackPlugin({
      template: './index.html',
      filename: 'index.html'
    }),
    // ✅ Suprimir warnings específicos de Webpack
    new webpack.ContextReplacementPlugin(
      /js\/generated/,
      (data) => {
        delete data.dependencies[0].critical;
        return data;
      }
    )
  ],
  
  devServer: {
    static: {
      directory: path.join(__dirname, 'dist')
    },
    port: 3000,
    hot: true,
    open: true,
    historyApiFallback: true
  },
  
  resolve: {
    extensions: ['.js'],
    fallback: {
      // Ice.js necesita estos polyfills para navegador
      "buffer": false,
      "timers": false,
      "stream": false
    }
  },
  
  externals: {
    'ice': 'Ice'
  },
  
  // ✅ Configuración de stats para suprimir warnings
  stats: {
    warningsFilter: [
      /Critical dependency: require function is used in a way/,
      /Can't resolve 'ice'/
    ]
  },
  
  devtool: 'source-map'
};