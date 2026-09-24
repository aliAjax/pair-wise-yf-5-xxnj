/*
 * 页面入口块（app.js）
 * 只负责把目录数据和借还判断接到页面上：渲染概览、借种表单、归还列表、历史记录，
 * 以及按钮事件。规则本身不在这里写，全部调用 SeedLibrary。
 */
(function () {
  'use strict';

  var Data = window.SeedData;
  var Lib = window.SeedLibrary;
  var state = Data.initState();

  // ---- 小工具 ----

  function $(id) { return document.getElementById(id); }

  function esc(text) {
    return String(text == null ? '' : text)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function formatDateTime(iso) {
    if (!iso) return '—';
    var d = new Date(iso);
    var p = function (n) { return String(n).padStart(2, '0'); };
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) +
           ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
  }

  function seedName(id) {
    var s = Lib.findSeed(state, id);
    return s ? s.name : '（已撤架品种）';
  }

  function residentName(id) {
    var r = Lib.findResident(state, id);
    return r ? r.name : '（未知住户）';
  }

  function deadlineBadge(seed) {
    if (Lib.isExpired(seed)) return '<span class="badge danger">已过截止日</span>';
    var days = Lib.daysToDeadline(seed);
    if (days <= 14) return '<span class="badge warn">临近截止 · 剩 ' + days + ' 天</span>';
    return '<span class="badge ok">可借</span>';
  }

  function stockLine(seed) {
    var reserved = Lib.reservedCount(seed);
    var available = Lib.availableStock(seed);
    var parts = ['<strong>' + seed.stock + '</strong> 包'];
    if (reserved > 0) {
      parts.push('（周末交换课预留 ' + reserved + '，可借 ' + available + '）');
    }
    return parts.join(' ');
  }

  // ---- 渲染 ----

  function renderHeader() {
    var now = Lib.today();
    var p = function (n) { return String(n).padStart(2, '0'); };
    $('today-badge').textContent =
      now.getFullYear() + '-' + p(now.getMonth() + 1) + '-' + p(now.getDate());
    $('month-label').textContent = '统计月份：' + Lib.currentMonthKey();
  }

  function renderOverview() {
    var monthKey = Lib.currentMonthKey();

    $('resident-overview').innerHTML = state.residents.map(function (r) {
      var used = Lib.monthlyBorrowCount(state, r.id, monthKey);
      var active = Lib.activeLoans(state).filter(function (l) {
        return l.residentId === r.id;
      }).length;
      var remaining = Math.max(0, Lib.MONTH_LIMIT - used);
      return '<div class="item resident-item">' +
        '<div class="item-main"><span class="item-name">' + esc(r.name) + '</span>' +
        '<span class="item-sub">' + esc(r.unit) + '</span></div>' +
        '<div class="item-meta">本月 <strong>' + used + '</strong> / ' +
        Lib.MONTH_LIMIT + ' 包 · 手中 ' + active + ' 包 · 还可借 ' + remaining + ' 包</div>' +
        '</div>';
    }).join('');

    $('stock-overview').innerHTML = state.seeds.map(function (s) {
      var status;
      if (Lib.isExpired(s)) {
        status = '<span class="tag danger">过期</span>';
      } else if (Lib.availableStock(s) <= 0) {
        status = '<span class="tag danger">' + (s.stock === 0 ? '缺货' : '已全预留') + '</span>';
      } else if (Lib.reservedCount(s) > 0) {
        status = '<span class="tag warn">含交换课预留</span>';
      } else {
        status = '<span class="tag ok">充足</span>';
      }
      return '<div class="item seed-item">' +
        '<div class="item-main"><span class="item-name">' + esc(s.name) +
        ' <small>' + esc(s.variety) + '</small></span>' +
        '<span class="item-sub">' + s.harvestYear + ' 年采种 · 播种截止 ' +
        esc(s.plantBy) + ' ' + deadlineBadge(s) + '</span></div>' +
        '<div class="item-meta">' + stockLine(s) + ' ' + status + '</div>' +
        '</div>';
    }).join('');
  }

  function renderBorrowForm() {
    var residentSel = $('borrow-resident');
    var seedSel = $('borrow-seed');
    var prevResident = residentSel.value;
    var prevSeed = seedSel.value;

    residentSel.innerHTML = state.residents.map(function (r) {
      return '<option value="' + r.id + '">' + esc(r.name) + '（' + esc(r.unit) + '）</option>';
    }).join('');

    seedSel.innerHTML = state.seeds.map(function (s) {
      var note = Lib.isExpired(s)
        ? '已过截止日'
        : Lib.availableStock(s) <= 0
          ? (s.stock === 0 ? '缺货' : '已全预留')
          : '可借 ' + Lib.availableStock(s) + ' 包';
      return '<option value="' + s.id + '">' + esc(s.name) + ' · ' + esc(s.variety) +
             '（' + note + '）</option>';
    }).join('');

    if (prevResident) residentSel.value = prevResident;
    if (prevSeed) seedSel.value = prevSeed;
  }

  function showMessage(el, text, type) {
    if (!text) {
      el.className = 'message';
      el.textContent = '';
      return;
    }
    el.className = 'message show ' + (type || 'error');
    el.textContent = text;
  }

  function renderReturns() {
    var out = Lib.activeLoans(state);
    var box = $('return-list');

    if (out.length === 0) {
      box.innerHTML = '<p class="empty">当前没有借出的种子包。</p>';
      return;
    }

    box.innerHTML = out.map(function (l) {
      var seed = Lib.findSeed(state, l.seedId);
      var seedLabel = seed
        ? seed.name + '（' + seed.variety + '，' + seed.harvestYear + ' 年采种）'
        : seedName(l.seedId);
      return '<div class="return-item" data-loan="' + l.id + '">' +
        '<div class="return-info">' +
          '<span class="item-name">' + esc(seedLabel) + '</span>' +
          '<span class="item-sub">编号 ' + l.id + ' · 借用人 ' +
            esc(residentName(l.residentId)) + ' · 借出 ' +
            formatDateTime(l.borrowedAt) + '</span>' +
        '</div>' +
        '<div class="return-actions">' +
          '<button type="button" class="btn small ok" data-action="return-ok" data-loan="' +
            l.id + '">测过，还能发芽（回库）</button>' +
          '<button type="button" class="btn small dead" data-action="return-dead" data-loan="' +
            l.id + '">已失活（记损耗）</button>' +
        '</div>' +
      '</div>';
    }).join('');
  }

  var STATUS_TEXT = {
    out: '借出中',
    returned: '已归还 · 可发芽，已回库',
    lost: '已归还 · 失活，记损耗'
  };

  function renderHistory() {
    var rows = state.loans.slice().sort(function (a, b) {
      return a.id < b.id ? 1 : -1;
    });

    $('history-summary').textContent =
      '借出中 ' + Lib.activeLoans(state).length + ' 包 · 累计 ' + state.loans.length + ' 条';

    if (rows.length === 0) {
      $('history-body').innerHTML =
        '<tr><td colspan="6" class="empty">还没有借还记录。</td></tr>';
      return;
    }

    $('history-body').innerHTML = rows.map(function (l) {
      var cls = l.status === 'returned' ? 'ok' : l.status === 'lost' ? 'dead' : 'out';
      return '<tr>' +
        '<td>' + esc(l.id) + '</td>' +
        '<td>' + esc(residentName(l.residentId)) + '</td>' +
        '<td>' + esc(seedName(l.seedId)) + '</td>' +
        '<td>' + formatDateTime(l.borrowedAt) + '</td>' +
        '<td><span class="status ' + cls + '">' + STATUS_TEXT[l.status] + '</span></td>' +
        '<td>' + formatDateTime(l.finishedAt) + '</td>' +
      '</tr>';
    }).join('');
  }

  function renderAll() {
    renderHeader();
    renderOverview();
    renderBorrowForm();
    renderReturns();
    renderHistory();
  }

  // ---- 事件 ----

  $('borrow-form').addEventListener('submit', function (event) {
    event.preventDefault();
    var residentId = $('borrow-resident').value;
    var seedId = $('borrow-seed').value;

    // 先预判给出原因；borrow 内部会按同样规则再判一次，保证“失败保持原样”
    var check = Lib.canBorrow(state, residentId, seedId);
    if (!check.ok) {
      showMessage($('borrow-message'), check.reason, 'error');
      renderAll();
      return;
    }

    var result = Lib.borrow(state, residentId, seedId);
    if (!result.ok) {
      showMessage($('borrow-message'), result.reason, 'error');
    } else {
      var seed = Lib.findSeed(state, seedId);
      showMessage(
        $('borrow-message'),
        '借出成功：' + residentName(residentId) + ' 借走《' + seed.name + '》一包，' +
          '剩余可借 ' + Lib.availableStock(seed) + ' 包。',
        'success'
      );
    }
    renderAll();
  });

  $('return-list').addEventListener('click', function (event) {
    var btn = event.target.closest('button[data-action]');
    if (!btn) return;
    var loanId = btn.getAttribute('data-loan');
    var viable = btn.getAttribute('data-action') === 'return-ok';

    var result = Lib.returnLoan(state, loanId, viable);
    if (!result.ok) {
      showMessage($('return-message'), result.reason, 'error');
    } else if (result.restocked) {
      showMessage(
        $('return-message'),
        '《' + result.seedName + '》测试可发芽，已回库，库存 +1。',
        'success'
      );
    } else {
      showMessage(
        $('return-message'),
        '《' + result.seedName + '》判定失活，不回库，已登记为损耗。',
        'warn'
      );
    }
    renderAll();
  });

  $('reset-demo').addEventListener('click', function () {
    if (!window.confirm('确定恢复为演示初始数据吗？当前所有借还记录会被清空。')) return;
    state = Data.resetState();
    showMessage($('borrow-message'), '已恢复演示初始数据。', 'success');
    renderAll();
  });

  renderAll();
})();
