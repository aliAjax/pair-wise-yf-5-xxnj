/* ============================================================
 * app.js —— 页面入口：渲染首页看板、借种表单、归还列表与记录，
 * 并把用户操作交给 SeedLogic 判断、交给 SeedData 落盘。
 * ============================================================ */
(function () {
  'use strict';

  var state = SeedData.load();
  var today = new Date();

  /* ---------- 小工具 ---------- */
  function $(sel) { return document.querySelector(sel); }

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function seedName(seedId) {
    var seed = state.seeds.find(function (s) { return s.id === seedId; });
    return seed ? seed.name : seedId;
  }

  function residentName(residentId) {
    var r = state.residents.find(function (x) { return x.id === residentId; });
    return r ? r.name : residentId;
  }

  /** 顶部消息条 */
  var msgTimer = null;
  function showMessage(text, ok) {
    var bar = $('#message');
    bar.textContent = text;
    bar.className = 'message ' + (ok ? 'ok' : 'fail');
    bar.hidden = false;
    clearTimeout(msgTimer);
    msgTimer = setTimeout(function () { bar.hidden = true; }, 6000);
  }

  /* ---------- 首页看板：当月借阅 + 各品种库存 ---------- */
  function renderDashboard() {
    // 每人当月借阅
    var personList = $('#person-month');
    personList.innerHTML = '';
    state.residents.forEach(function (r) {
      var used = SeedLogic.monthlyBorrowCount(state, r.id, today);
      var left = SeedLogic.MONTHLY_LIMIT - used;
      var item = el('li', 'person');
      item.appendChild(el('span', 'person-name', r.name));
      var quota = el('span', 'quota' + (left === 0 ? ' quota-full' : ''),
        '本月已借 ' + used + ' / ' + SeedLogic.MONTHLY_LIMIT + ' 包');
      item.appendChild(quota);
      personList.appendChild(item);
    });

    // 各品种库存
    var tbody = $('#seed-table tbody');
    tbody.innerHTML = '';
    state.seeds.forEach(function (s) {
      var tr = el('tr');
      tr.appendChild(el('td', null, s.name));
      tr.appendChild(el('td', 'num', String(s.stock)));
      tr.appendChild(el('td', 'num', String(SeedLogic.availablePacks(s))));
      tr.appendChild(el('td', 'num', String(s.harvestYear)));
      tr.appendChild(el('td', null, s.sowBy));
      tr.appendChild(el('td', 'num', String(s.lossCount || 0)));

      var status = el('td');
      var tags = [];
      if (SeedLogic.isExpired(s, today)) tags.push(['tag-expired', '已过期']);
      if (s.stock <= 0) tags.push(['tag-empty', '缺货']);
      if (s.stock > 0 && s.stock <= SeedLogic.RESERVE_THRESHOLD) {
        tags.push(['tag-reserve', '预留 ' + SeedLogic.RESERVE_PACKS + ' 包给交换课']);
      }
      if (tags.length === 0) tags.push(['tag-ok', '可借']);
      tags.forEach(function (t) { status.appendChild(el('span', 'tag ' + t[0], t[1])); });
      tr.appendChild(status);

      tbody.appendChild(tr);
    });
  }

  /* ---------- 借种表单 ---------- */
  function renderBorrowForm() {
    var residentSel = $('#borrow-resident');
    residentSel.innerHTML = '';
    state.residents.forEach(function (r) {
      var used = SeedLogic.monthlyBorrowCount(state, r.id, today);
      var opt = el('option', null, r.name + '（本月已借 ' + used + '/' + SeedLogic.MONTHLY_LIMIT + '）');
      opt.value = r.id;
      residentSel.appendChild(opt);
    });

    var seedSel = $('#borrow-seed');
    seedSel.innerHTML = '';
    state.seeds.forEach(function (s) {
      var label = s.name + '（可借 ' + SeedLogic.availablePacks(s) + ' / 库存 ' + s.stock + '）';
      if (SeedLogic.isExpired(s, today)) label = s.name + '（已过期）';
      else if (s.stock <= 0) label = s.name + '（缺货）';
      var opt = el('option', null, label);
      opt.value = s.id;
      seedSel.appendChild(opt);
    });
  }

  function onBorrowSubmit(event) {
    event.preventDefault();
    var residentId = $('#borrow-resident').value;
    var seedId = $('#borrow-seed').value;
    var result = SeedLogic.borrow(state, seedId, residentId, today);
    if (!result.ok) {
      showMessage('借种失败：' + result.reason, false); // 数据保持原样
      return;
    }
    SeedData.save(state);
    showMessage('借种成功：' + residentName(residentId) + ' 借走 1 包「' + seedName(seedId) + '」。', true);
    renderAll();
  }

  /* ---------- 归还列表 ---------- */
  function renderActiveLoans() {
    var box = $('#active-loans');
    box.innerHTML = '';
    var active = state.loans.filter(function (l) { return !l.returned; });
    if (active.length === 0) {
      box.appendChild(el('p', 'empty', '当前没有待归还的种子。'));
      return;
    }
    active.forEach(function (loan) {
      var row = el('div', 'loan');
      var info = el('span', 'loan-info',
        residentName(loan.residentId) + ' 借「' + seedName(loan.seedId) + '」1 包 · ' + loan.borrowDate);
      row.appendChild(info);

      var actions = el('span', 'loan-actions');
      var okBtn = el('button', 'btn btn-ok', '可发芽归还');
      okBtn.type = 'button';
      okBtn.addEventListener('click', function () { onReturn(loan.id, true); });
      var deadBtn = el('button', 'btn btn-dead', '失活归还');
      deadBtn.type = 'button';
      deadBtn.addEventListener('click', function () { onReturn(loan.id, false); });
      actions.appendChild(okBtn);
      actions.appendChild(deadBtn);
      row.appendChild(actions);

      box.appendChild(row);
    });
  }

  function onReturn(loanId, viable) {
    var loan = state.loans.find(function (l) { return l.id === loanId; });
    var result = SeedLogic.returnLoan(state, loanId, viable, today);
    if (!result.ok) {
      showMessage('归还失败：' + result.reason, false);
      return;
    }
    SeedData.save(state);
    var what = residentName(loan.residentId) + ' 归还的「' + seedName(loan.seedId) + '」';
    showMessage(viable ? what + '仍可发芽，已回库。' : what + '已失活，记为损耗（不回库）。', true);
    renderAll();
  }

  /* ---------- 历史记录 ---------- */
  function renderHistory() {
    var box = $('#history');
    box.innerHTML = '';
    if (state.loans.length === 0) {
      box.appendChild(el('p', 'empty', '还没有借阅记录。'));
      return;
    }
    var list = el('ul', 'history-list');
    state.loans.slice().reverse().forEach(function (loan) {
      var text = loan.borrowDate + ' · ' + residentName(loan.residentId) +
                 ' 借「' + seedName(loan.seedId) + '」1 包 → ';
      if (!loan.returned) text += '待归还';
      else text += loan.returnDate + (loan.viable ? ' 归还（可发芽，已回库）' : ' 归还（失活，记损耗）');
      list.appendChild(el('li', loan.returned ? '' : 'history-active', text));
    });
    box.appendChild(list);
  }

  /* ---------- 整体渲染与入口 ---------- */
  function renderAll() {
    renderDashboard();
    renderBorrowForm();
    renderActiveLoans();
    renderHistory();
  }

  function init() {
    $('#today').textContent = '今天是 ' + SeedLogic.toDateStr(today);
    $('#borrow-form').addEventListener('submit', onBorrowSubmit);
    $('#reset').addEventListener('click', function () {
      if (!window.confirm('确定要清空所有借阅记录并恢复初始数据吗？')) return;
      state = SeedData.reset();
      showMessage('已恢复初始数据。', true);
      renderAll();
    });
    renderAll();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
