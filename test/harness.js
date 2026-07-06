const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

/**
 * GASのグローバル名前空間を vm コンテキストで再現する。
 * @param {string[]} files プロジェクトルートからの相対パス（読み込み順）
 * @param {object} mocks コンテキストに注入するグローバル（Tasks, ContentService 等）
 * @returns {object} 読み込み済みグローバルを持つ vm コンテキスト
 */
function loadGas(files, mocks) {
  const sandbox = Object.assign({ console }, mocks || {});
  const context = vm.createContext(sandbox);
  for (const file of files) {
    const code = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
    vm.runInContext(code, context, { filename: file });
  }
  return context;
}

module.exports = { loadGas };
