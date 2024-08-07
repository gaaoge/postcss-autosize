var path = require('path')
var fs = require('fs')
var dirname = require('path').dirname
var chalk = require('chalk')
var _ = require('lodash')
var fastImageSize = require('./lib/fastimagesize')

/**
 * a helper to find the real image absolute path,
 * deal with the issue like `../../img.jpg` and so on.
 */
function fixAbsolutePath(dir, relative) {
  // find the first time
  var absolute = path.resolve(dir, relative)

  // check if is a image file
  var reg = /\.(jpg|jpeg|png|gif|svg|bmp)\b/i
  if (!reg.test(absolute)) {
    pluginLog('Not a image file: ', absolute)
    return
  }

  if (!fs.existsSync(absolute) && relative.indexOf('../') > -1) {
    relative = relative.replace('../', '')
    // find the second time
    absolute = path.resolve(dir, relative)
  }

  // 解析以@开头的资源地址
  if (!fs.existsSync(absolute) && /^@/.test(relative)) {
    relative = relative.replace(/^@/, '')
    // find the second time
    absolute = dir.replace(/(src).*$/i, '$1') + relative
  }

  return absolute
}

function pluginLog(str, arg) {
  return console.log('[' + chalk.blue('postcss-autosize') + '] ' + chalk.red(str) + arg)
}

/**
 * main function
 */
const plugin = (options = {}) => {
  options = _.extend(
    {
      width: true,
      height: true,
      backgroundSize: true,
      backgroundRepeat: true,
      imagePath: [],
    },
    options
  )

  var imagePath = options.imagePath

  if (imagePath.length) {
    imagePath = '(' + options.imagePath.join('|') + '/)'
    imagePath = imagePath.replace(/\./g, '\\.')
  } else {
    imagePath = ''
  }

  var imageRegex = new RegExp('url\\(["\']?(' + imagePath + '[^)]*?)["\']?\\)')

  return {
    postcssPlugin: 'postcss-autosize',
    Once(root) {
      root.walkRules(function (rule) {
        rule.walkDecls(/^background(-image)?$/, function (decl) {
          var rule = decl.parent
          var nodes = rule.nodes
          var value = decl.value
          // var prop = decl.prop;
          var CSSWidth = false
          var CSSHeight = false
          var CSSBGSize = false
          var CSSBGRepeat = false

          var matchValue = imageRegex.exec(value)

          if (!matchValue || matchValue[1].indexOf('data:') === 0) {
            return
          }

          var relativePath = matchValue[1]

          var inputDir = dirname(decl.source.input.file)

          var absolutePath = fixAbsolutePath(inputDir, relativePath)

          if (absolutePath === undefined || /^(http(s)?:)?\/\//.test(relativePath)) {
            return
          }

          nodes.forEach(function (node) {
            if (node.prop === 'width') {
              CSSWidth = true
            }
            if (node.prop === 'height') {
              CSSHeight = true
            }
            if (node.prop === 'background-size' || node.prop === '-webkit-background-size') {
              CSSBGSize = true
            }
            if (node.prop === 'background-repeat') {
              CSSBGRepeat = true
            }
          })

          var info = fastImageSize(absolutePath)

          if (info === undefined) {
            pluginLog('File does not exist: ', absolutePath)
            return
          }

          if (info.type === 'unknown') {
            pluginLog('Unknown type: ', absolutePath)
            return
          }

          // check if even dimensions
          if (value.indexOf('@2x') > -1 && (info.width % 2 !== 0 || info.height % 2 !== 0)) {
            pluginLog('Should have even dimensions: ', absolutePath)
            return
          }

          var valueWidth, valueHeight

          if (value.indexOf('@2x') > -1) {
            valueWidth = info.width / 2 + 'px'
            valueHeight = info.height / 2 + 'px'
          } else if (value.indexOf('@3x') > -1) {
            valueWidth = info.width / 3 + 'px'
            valueHeight = info.height / 3 + 'px'
          } else {
            valueWidth = info.width + 'px'
            valueHeight = info.height + 'px'
          }

          if (options.width && !CSSWidth) {
            rule.insertBefore(decl, { prop: 'width', value: valueWidth })
          }

          if (options.height && !CSSHeight) {
            rule.insertBefore(decl, { prop: 'height', value: valueHeight })
          }

          if (options.backgroundSize && !CSSBGSize) {
            rule.insertAfter(decl, {
              prop: 'background-size',
              value: '100% 100%',
            })
          }

          if (options.backgroundRepeat && !CSSBGRepeat) {
            rule.insertAfter(decl, {
              prop: 'background-repeat',
              value: 'no-repeat',
            })
          }
        })
      })
    },
  }
}
plugin.postcss = true

module.exports = plugin
