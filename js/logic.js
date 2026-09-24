/* ============================================================
 * logic.js —— 借还判断（纯规则，不碰页面）
 * 规则：
 *  1. 每人每月限借 2 包（按自然月统计）；
 *  2. 超过播种截止日的种子不可外借；
 *  3. 库存为 0 即缺货；
 *  4. 库存不超过 4 包的品种，先留 2 包给周末交换课；
 *  5. 归还时标记是否还能发芽：可用才回库，失活只记损耗。
 * 借种校验不通过时只返回原因，不改动任何数据。
 * ============================================================ */
(function (global) {
  'use strict';

  var MONTHLY_LIMIT = 2;     // 每人每月限借包数
  var RESERVE_THRESHOLD = 4; // 库存不超过该值触发预留
  var RESERVE_PACKS = 2;     // 为周末交换课预留的包数

  /** 日期转 'YYYY-MM-DD'（本地时区） */
  function toDateStr(date) {
    var y = date.getFullYear();
    var m = String(date.getMonth() + 1).padStart(2, '0');
    var d = String(date.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + d;
  }

  /** 日期所在的月份键，如 '2026-09' */
  function monthKey(date) {
    return toDateStr(date).slice(0, 7);
  }

  /** 是否已过播种截止日（截止日当天仍可借） */
  function isExpired(seed, today) {
    return toDateStr(today) > seed.sowBy;
  }

  /** 某住户当月已借包数（含已归还的，借过即计入额度） */
  function monthlyBorrowCount(state, residentId, today) {
    var key = monthKey(today);
    return state.loans.filter(function (loan) {
      return loan.residentId === residentId && loan.month === key;
    }).length;
  }

  /** 某品种当前可外借包数：库存 ≤ 4 时先留 2 包给周末交换课 */
  function availablePacks(seed) {
    if (seed.stock > RESERVE_THRESHOLD) return seed.stock;
    return Math.max(0, seed.stock - RESERVE_PACKS);
  }

  function findSeed(state, seedId) {
    return state.seeds.find(function (s) { return s.id === seedId; }) || null;
  }

  /**
   * 借种校验：返回 { ok, reason? }。
   * 不通过时只说明原因，调用方不得改动数据。
   */
  function checkBorrow(state, seedId, residentId, today) {
    var seed = findSeed(state, seedId);
    if (!seed) return { ok: false, reason: '品种不存在。' };
    if (!state.residents.some(function (r) { return r.id === residentId; })) {
      return { ok: false, reason: '住户不存在。' };
    }
    if (isExpired(seed, today)) {
      return { ok: false, reason: '「' + seed.name + '」播种截止日 ' + seed.sowBy + ' 已过，种子不再外借。' };
    }
    if (seed.stock <= 0) {
      return { ok: false, reason: '「' + seed.name + '」库存为 0，暂时缺货。' };
    }
    var used = monthlyBorrowCount(state, residentId, today);
    if (used >= MONTHLY_LIMIT) {
      return { ok: false, reason: '本月已借 ' + used + ' 包，达到每人每月 ' + MONTHLY_LIMIT + ' 包的上限，下月再来。' };
    }
    if (availablePacks(seed) <= 0) {
      return {
        ok: false,
        reason: '「' + seed.name + '」库存仅 ' + seed.stock + ' 包（不超过 ' + RESERVE_THRESHOLD +
                ' 包），需预留 ' + RESERVE_PACKS + ' 包给周末交换课，暂不可借。'
      };
    }
    return { ok: true };
  }

  /**
   * 借种：先校验，通过才扣库存并登记；不通过保持原样。
   * 返回 { ok, reason? }。
   */
  function borrow(state, seedId, residentId, today) {
    var check = checkBorrow(state, seedId, residentId, today);
    if (!check.ok) return check; // 保持原样，不落任何改动

    var seed = findSeed(state, seedId);
    seed.stock -= 1;
    state.loans.push({
      id: 'loan-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7),
      seedId: seedId,
      residentId: residentId,
      borrowDate: toDateStr(today),
      month: monthKey(today),
      returned: false,
      returnDate: null,
      viable: null
    });
    return { ok: true };
  }

  /**
   * 归还：标记种子是否还能发芽。
   * 可发芽 → 库存回库；失活 → 只记损耗，不回库。
   * 返回 { ok, reason? }。
   */
  function returnLoan(state, loanId, viable, today) {
    var loan = state.loans.find(function (l) { return l.id === loanId && !l.returned; });
    if (!loan) return { ok: false, reason: '借阅记录不存在或已归还。' };

    loan.returned = true;
    loan.returnDate = toDateStr(today);
    loan.viable = !!viable;

    var seed = findSeed(state, loan.seedId);
    if (seed) {
      if (loan.viable) {
        seed.stock += 1; // 可用才回库
      } else {
        seed.lossCount = (seed.lossCount || 0) + 1; // 失活只记损耗
      }
    }
    return { ok: true };
  }

  global.SeedLogic = {
    MONTHLY_LIMIT: MONTHLY_LIMIT,
    RESERVE_THRESHOLD: RESERVE_THRESHOLD,
    RESERVE_PACKS: RESERVE_PACKS,
    toDateStr: toDateStr,
    monthKey: monthKey,
    isExpired: isExpired,
    monthlyBorrowCount: monthlyBorrowCount,
    availablePacks: availablePacks,
    checkBorrow: checkBorrow,
    borrow: borrow,
    returnLoan: returnLoan
  };
})(window);
