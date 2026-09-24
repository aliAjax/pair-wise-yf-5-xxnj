/*
 * 目录数据块（data.js）
 * 只负责：预置的种子目录、住户名单，以及数据的初始化 / 读取 / 保存 / 重置。
 * 不做任何借还判断，也不碰页面。
 *
 * 状态结构：
 * {
 *   seeds:  [{ id, name, variety, harvestYear, plantBy, stock }],
 *   residents: [{ id, name, unit }],
 *   loans:  [{ id, seedId, residentId, borrowedAt, status: 'out'|'returned'|'lost',
 *              germinatedAt: null, finishedAt: null }]
 * }
 */
(function (global) {
  'use strict';

  var STORAGE_KEY = 'community-seed-library-v1';

  // 预置六包种子（stock 为包数；plantBy 为播种截止日，YYYY-MM-DD）
  function defaultSeeds() {
    return [
      { id: 's-tomato',  name: '矮生番茄',   variety: '红珍珠',   harvestYear: 2025, plantBy: '2027-04-30', stock: 6 },
      { id: 's-lettuce', name: '紫叶生菜',   variety: '奶油紫',   harvestYear: 2025, plantBy: '2026-10-31', stock: 3 },
      { id: 's-basil',   name: '罗勒',       variety: '热那亚',   harvestYear: 2025, plantBy: '2027-05-31', stock: 4 },
      { id: 's-radish',  name: '樱桃萝卜',   variety: '早红尖',   harvestYear: 2024, plantBy: '2026-09-20', stock: 5 },
      { id: 's-bean',    name: '四季豆',     variety: '无筋地豆', harvestYear: 2025, plantBy: '2027-06-15', stock: 0 },
      { id: 's-sunflower', name: '向日葵',   variety: '微笑矮生', harvestYear: 2024, plantBy: '2027-05-10', stock: 2 }
    ];
  }

  // 预置三名住户
  function defaultResidents() {
    return [
      { id: 'r-chen', name: '陈阿姨', unit: '3 号楼 201' },
      { id: 'r-lin',  name: '林叔',   unit: '5 号楼 102' },
      { id: 'r-zhao', name: '小赵',   unit: '1 号楼 403' }
    ];
  }

  function defaultState() {
    return {
      seeds: defaultSeeds(),
      residents: defaultResidents(),
      loans: []
    };
  }

  function deepClone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function loadState() {
    try {
      var raw = global.localStorage && global.localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      if (!parsed || !Array.isArray(parsed.seeds) ||
          !Array.isArray(parsed.residents) || !Array.isArray(parsed.loans)) {
        return null;
      }
      return parsed;
    } catch (err) {
      return null;
    }
  }

  function saveState(state) {
    try {
      if (global.localStorage) {
        global.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      }
    } catch (err) {
      // 存储不可用时只在内存里运行，不影响当次操作
    }
  }

  function resetState() {
    var fresh = defaultState();
    saveState(fresh);
    return fresh;
  }

  function initState() {
    return loadState() || resetState();
  }

  global.SeedData = {
    STORAGE_KEY: STORAGE_KEY,
    initState: initState,
    saveState: saveState,
    resetState: resetState,
    clone: deepClone
  };
})(typeof window !== 'undefined' ? window : globalThis);
