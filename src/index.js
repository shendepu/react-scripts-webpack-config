const fs = require('fs')
const fse = require('fs-extra')
const path = require('path')

const appDirectory = fs.realpathSync(process.cwd())
function resolveApp(relativePath) {
  return path.resolve(appDirectory, relativePath)
}

const appNodeModulesDirectory = resolveApp('node_modules')

function getFileStat(absolutePath) {
  try {
    return fs.statSync(absolutePath)
  } catch (e) {
    if (e.code === 'ENOENT') return null
    throw e
  }
}

function getConfig(webpackEnv, type) {
  if (!type) return path.resolve(appNodeModulesDirectory, 'react-scripts/config/webpack.config.' + webpackEnv + '.js')
  if (type === 'my') return resolveApp('./config/webpack.config.' + webpackEnv + '.js')

  return path.resolve(appNodeModulesDirectory, 'react-scripts/config/webpack.config.' + webpackEnv + '.' + type + '.js')
}

function extendConfig(webpackEnv, callback) {
  if (webpackEnv !== 'dev' && webpackEnv !== 'prod') {
    console.error('Only dev and prod is supported')
    return
  }

  return moveAsOrigin(webpackEnv)
    .then(() => createWebpackConfig(webpackEnv))
    .then(() => createWebpackDevServerConfig())
    .then(() => callback())
}

function moveAsOrigin(webpackEnv) {
  const webpackConfig = getConfig(webpackEnv)
  const webpackConfigOrigin = getConfig(webpackEnv, 'origin')
  const originStat = getFileStat(webpackConfigOrigin)

  if (!originStat) {
    return fse.move(webpackConfig, webpackConfigOrigin)
  } else {
    return Promise.resolve()
  }
}

function createWebpackConfig(webpackEnv) {
  const webpackConfig = getConfig(webpackEnv)
  const stat = getFileStat(webpackConfig)
  if (!stat) {
    return fse.outputFile(
      webpackConfig,
      `const config = require('./webpack.config.${webpackEnv}.origin')
const customConfigFunc = require('../../../config/webpack.config.${webpackEnv}')

module.exports = customConfigFunc(config)  
    `
    )
  }
}

function createWebpackDevServerConfig() {
  const myDevServerConfig = resolveApp('config/webpackDevServer.config.js')
  const myStat = getFileStat(myDevServerConfig)
  if (!myStat) return Promise.resolve()

  const originDevServerConfig = path.resolve(appNodeModulesDirectory, 'react-scripts/config/webpackDevServer.config.origin.js')
  if (getFileStat(originDevServerConfig)) return Promise.resolve()

  const devServerConfig = path.resolve(appNodeModulesDirectory, 'react-scripts/config/webpackDevServer.config.js')
  fse.moveSync(devServerConfig, originDevServerConfig)

  return fse.outputFile(
    devServerConfig,
    `const configFunc = require('./webpackDevServer.config.origin')
const customConfigFunc = require('../../../config/webpackDevServer.config')

module.exports = function(proxy, allowedHost) {
  const devConfig = configFunc(proxy, allowedHost)
  return customConfigFunc(devConfig)
}  
  `
  )
}
module.exports = extendConfig
