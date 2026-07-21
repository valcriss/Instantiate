const Module = require('module')
const path = require('path')

const ts6 = require('@typescript/typescript6')
const originalLoad = Module._load
const eslintPackagePath = require.resolve('eslint/package.json')
const eslintBinPath = path.join(path.dirname(eslintPackagePath), 'bin', 'eslint.js')

Module._load = function patchedLoad(request, parent, isMain) {
  if (request === 'typescript') {
    return ts6
  }

  return originalLoad.call(this, request, parent, isMain)
}

require(eslintBinPath)