/*
 * 借还判断块（library.js）
 * 只负责规则运算与状态变更，不读写页面 DOM：
 *   - 过期判断（今天是否晚于播种截止日）
 *   - 周末交换课预留（库存 ≤ 4 包的品种，先留 2 包）
 *   - 当月借阅计数（每人当月最多 2 包）
 *   - 借种、归还（可发芽才回库，失活只记损耗）
 * 所有变更函数都会把结果保存到 localStorage，重开页面仍在。
 */
(function (global) {
  'use strict';

  var MONTH_LIMIT = 2;      // 每人当月借阅上限
  var RESERVE_STOCK = 4;    // 库存不超过该值时触发预留
  var RESERVE_COUNT = 2;    // 为周末交换课预留的包数

  // ---- 基础日期工具（按“日”比较，不涉及时分秒）----

  function dateOnly(input) {
    var d = input ? new Date(input + 'T00:00:00') : new Date();
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }

  function today() {
    return dateOnly(null);
  }

  function monthKey(d) {
    var y = d.getFullYear();
    var m = String(d.getMonth() + 1).padStart(2, '0');
    return y + '-' + m;
  }

  function currentMonthKey() {
    return monthKey(today());
  }

  function isExpired(seed, now) {
    var ref = now ? dateOnly(now) : today();
    return dateOnly(seed.plantBy) < ref;
  }

  function daysToDeadline(seed, now) {
    var ref = now ? dateOnly(now) : today();
    return Math.round((dateOnly(seed.plantBy) - ref) / 86400000);
  }

  // 库存 ≤ 4 包时，先给周末交换课留 2 包（库存不足 2 包则全部预留）
  function reservedCount(seed) {
    return seed.stock <= RESERVE_STOCK ? Math.min(RESERVE_COUNT, seed.stock) : 0;
  }

  function availableStock(seed) {
    return seed.stock - reservedCount(seed);
  }

  // ---- 查找与统计 ----

  function findSeed(state, seedId) {
    return state.seeds.find(function (s) { return s.id === seedId; }) || null;
  }

  function findResident(state, residentId) {
    return state.residents.find(function (r) { return r.id === residentId; }) || null;
  }

  function activeLoans(state) {
    return state.loans.filter(function (l) { return l.status === 'out'; });
  }

  // 某住户当月已借出的包数（按借出时间所在月份统计，含已归还/已失活）
  function monthlyBorrowCount(state, residentId, key) {
    var wanted = key || currentMonthKey();
    return state.loans.filter(function (l) {
      return l.residentId === residentId &&
             l.borrowedAt.slice(0, 7) === wanted;
    }).length;
  }

  // ---- 借种 ----
  // 返回 { ok, reason, loan? }；失败时不改任何数据，“保持原样”
  function canBorrow(state, residentId, seedId, now) {
    var resident = findResident(state, residentId);
    var seed = findSeed(state, seedId);
    if (!resident) return { ok: false, reason: '找不到这位住户。' };
    if (!seed) return { ok: false, reason: '找不到这个品种。' };

    if (isExpired(seed, now)) {
      return {
        ok: false,
        reason: '《' + seed.name + '》的播种截止日是 ' + seed.plantBy +
                '，已过播种期，不能再借出。'
      };
    }

    var available = availableStock(seed);
    if (available <= 0) {
      var why = seed.stock === 0
        ? '《' + seed.name + '》当前缺货，无包可借。'
        : '《' + seed.name + '》只剩 ' + seed.stock + ' 包，已为周末交换课预留 ' +
          reservedCount(seed) + ' 包，暂不外借。';
      return { ok: false, reason: why };
    }

    var used = monthlyBorrowCount(state, residentId, now ? monthKey(dateOnly(now)) : undefined);
    if (used >= MONTH_LIMIT) {
      return {
        ok: false,
        reason: resident.name + ' 本月已借 ' + used + ' 包，达到每人每月 ' +
                MONTH_LIMIT + ' 包的上限。'
      };
    }

    return { ok: true };
  }

  function newLoanId(state) {
    return 'L' + String(state.loans.length + 1).padStart(3, '0');
  }

  function borrow(state, residentId, seedId) {
    var check = canBorrow(state, residentId, seedId);
    if (!check.ok) return check;

    var seed = findSeed(state, seedId);
    var loan = {
      id: newLoanId(state),
      seedId: seedId,
      residentId: residentId,
      borrowedAt: new Date().toISOString(),
      status: 'out',
      finishedAt: null
    };
    seed.stock -= 1;
    state.loans.push(loan);
    global.SeedData.saveState(state);
    return { ok: true, loan: loan };
  }

  // ---- 归还 ----
  // viable=true：测试仍可发芽，回库 +1；viable=false：判定失活，只记损耗
  function returnLoan(state, loanId, viable) {
    var loan = state.loans.find(function (l) { return l.id === loanId; });
    if (!loan) return { ok: false, reason: '找不到这条借阅记录。' };
    if (loan.status !== 'out') {
      return { ok: false, reason: '这包种子已登记过归还。' };
    }

    var seed = findSeed(state, loan.seedId);
    loan.status = viable ? 'returned' : 'lost';
    loan.finishedAt = new Date().toISOString();

    if (viable && seed) seed.stock += 1;
    global.SeedData.saveState(state);
    return { ok: true, loan: loan, restocked: viable, seedName: seed ? seed.name : '' };
  }

  global.SeedLibrary = {
    MONTH_LIMIT: MONTH_LIMIT,
    RESERVE_STOCK: RESERVE_STOCK,
    RESERVE_COUNT: RESERVE_COUNT,
    today: today,
    monthKey: monthKey,
    currentMonthKey: currentMonthKey,
    isExpired: isExpired,
    daysToDeadline: daysToDeadline,
    reservedCount: reservedCount,
    availableStock: availableStock,
    findSeed: findSeed,
    findResident: findResident,
    activeLoans: activeLoans,
    monthlyBorrowCount: monthlyBorrowCount,
    canBorrow: canBorrow,
    borrow: borrow,
    returnLoan: returnLoan
  };
})(typeof window !== 'undefined' ? window : globalThis);
