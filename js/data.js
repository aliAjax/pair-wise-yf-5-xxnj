/* ============================================================
 * data.js —— 目录数据与本地存储
 * 预置六种种子、三名住户；负责 localStorage 的读写与初始化。
 * ============================================================ */
(function (global) {
  'use strict';

  var STORAGE_KEY = 'communitySeedLibrary.v1';

  /** 预置种子目录：库存、采种年份、播种截止日 */
  var SEED_CATALOG = [
    { id: 'tomato',    name: '樱桃番茄', stock: 8, harvestYear: 2025, sowBy: '2027-04-30', lossCount: 0 },
    { id: 'bokchoy',   name: '小白菜',   stock: 4, harvestYear: 2025, sowBy: '2026-12-31', lossCount: 0 },
    { id: 'shiso',     name: '紫苏',     stock: 2, harvestYear: 2024, sowBy: '2026-10-31', lossCount: 0 },
    { id: 'sunflower', name: '向日葵',   stock: 0, harvestYear: 2025, sowBy: '2026-11-30', lossCount: 0 },
    { id: 'sweetpea',  name: '甜豌豆',   stock: 6, harvestYear: 2024, sowBy: '2026-09-15', lossCount: 0 },
    { id: 'basil',     name: '罗勒',     stock: 5, harvestYear: 2025, sowBy: '2027-05-31', lossCount: 0 }
  ];

  /** 预置住户 */
  var RESIDENTS = [
    { id: 'wang', name: '王秀兰（3 栋）' },
    { id: 'li',   name: '李建国（7 栋）' },
    { id: 'zhou', name: '周晓（12 栋）' }
  ];

  /** 生成一份全新的初始数据 */
  function freshState() {
    return {
      seeds: SEED_CATALOG.map(function (s) { return Object.assign({}, s); }),
      residents: RESIDENTS.map(function (r) { return Object.assign({}, r); }),
      loans: [] // { id, seedId, residentId, borrowDate, month, returned, returnDate, viable }
    };
  }

  /** 读取本地数据；首次访问时写入初始数据 */
  function load() {
    try {
      var raw = global.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        var state = JSON.parse(raw);
        if (state && Array.isArray(state.seeds) && Array.isArray(state.loans)) {
          return state;
        }
      }
    } catch (e) {
      console.warn('读取本地数据失败，改用初始数据：', e);
    }
    var state = freshState();
    save(state);
    return state;
  }

  /** 写入本地数据，保证重开页面记录仍在 */
  function save(state) {
    global.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  /** 清空并恢复初始数据 */
  function reset() {
    var state = freshState();
    save(state);
    return state;
  }

  global.SeedData = {
    STORAGE_KEY: STORAGE_KEY,
    load: load,
    save: save,
    reset: reset
  };
})(window);
