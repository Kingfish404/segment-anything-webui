/** @type {import('next').NextConfig} */
const CopyPlugin = require("copy-webpack-plugin");

const nextConfig = {
  reactStrictMode: true,
  webpack: (config, { }) => {
    config.plugins.push(
      new CopyPlugin({
        patterns: [
          {
            from: './node_modules/onnxruntime-web/dist/*.wasm',
            to: 'static/chunks/pages',
          }, {
            from: './node_modules/onnxruntime-web/dist/*.wasm',
            to: 'static/chunks/pages',
          },
        ],
      }),
    );
    return config
  }
}

module.exports = nextConfig
