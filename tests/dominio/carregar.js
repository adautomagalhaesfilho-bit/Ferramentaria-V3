// Carrega os arquivos .js do app (que não são módulos) num ambiente isolado, para testar as regras sem navegador.
const fs = require('fs'), vm = require('vm'), path = require('path');

function carregar(arquivos) {
  const ctx = {
    console, Date, Math, JSON, Object, Array, Set, Map, Number, String, RegExp, parseInt, parseFloat, isNaN,
    window: {}, document: { getElementById: () => null, addEventListener() {}, querySelectorAll: () => [] },
    localStorage: { getItem: () => null, setItem() {} }, sessionStorage: { getItem: () => null, setItem() {} },
    navigator: {}, setTimeout, clearTimeout,
  };
  vm.createContext(ctx);
  arquivos.forEach(a => vm.runInContext(fs.readFileSync(path.join(__dirname, '..', '..', 'js', a), 'utf8'), ctx, { filename: a }));
  return ctx;
}
module.exports = { carregar };
