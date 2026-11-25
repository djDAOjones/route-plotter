// PROG-01: draws the client progress page from progress.json, which scripts/progress.mjs builds from the record at each
// publish. It loads nothing but that file, from this site. Every value is written as text, never as markup.
(function () {
  'use strict';

  var dayShort = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
  var dayLong = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
  var stamp = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London', timeZoneName: 'short' });
  var SVG = 'http://www.w3.org/2000/svg';

  function utc(day) { return new Date(day + 'T00:00:00Z'); }
  function short(day) { return day ? dayShort.format(utc(day)) : ''; }
  function el(tag, attrs, text) {
    var node = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (key) { node.setAttribute(key, attrs[key]); });
    if (text !== undefined && text !== null) node.textContent = String(text);
    return node;
  }
  function svg(tag, attrs, text) {
    var node = document.createElementNS(SVG, tag);
    Object.keys(attrs || {}).forEach(function (key) { node.setAttribute(key, attrs[key]); });
    if (text !== undefined && text !== null) node.textContent = String(text);
    return node;
  }
  function cell(row, text, cls) { var td = el('td', cls ? { class: cls } : {}, text); row.appendChild(td); return td; }
  function pill(status) { return el('span', { class: 'rp-pill', 'data-status': status }, status); }

  function drawPhases(data) {
    var host = document.getElementById('phases');
    host.replaceChildren();
    var parts = [['Done', 'var(--done)', 'done'], ['In progress', 'var(--progress)', 'in progress'],
      ['Needs sign-off', 'var(--signoff)', 'needs sign-off'], ['To do', 'var(--todo)', 'to do']];
    data.phases.forEach(function (phase, index) {
      var total = phase.items.length;
      var counts = parts.map(function (part) {
        return phase.items.filter(function (item) { return item.status === part[0]; }).length;
      });
      var row = el('div', { class: 'rp-phase' });
      var top = el('div', { class: 'rp-phase-top' });
      top.appendChild(el('span', {}, (index + 1) + '. ' + phase.name));
      top.appendChild(el('span', { class: 'rp-phase-count' }, counts[0] + ' of ' + total + ' done'));
      var bar = el('div', { class: 'rp-bar', role: 'img' });
      bar.setAttribute('aria-label', phase.name + ': ' + parts.map(function (part, i) {
        return counts[i] ? counts[i] + ' ' + part[2] : '';
      }).filter(Boolean).join(', '));
      parts.forEach(function (part, i) {
        if (!counts[i] || !total) return;
        var span = el('span');
        span.style.width = (counts[i] / total) * 100 + '%';
        span.style.background = part[1];
        bar.appendChild(span);
      });
      row.appendChild(top);
      row.appendChild(bar);
      host.appendChild(row);
    });
  }

  function drawItems(data) {
    var body = document.getElementById('items');
    body.replaceChildren();
    data.phases.forEach(function (phase, index) {
      phase.items.forEach(function (item) {
        var row = el('tr');
        cell(row, (index + 1) + '. ' + phase.name);
        cell(row, item.name);
        cell(row, '').appendChild(pill(item.status));
        cell(row, short(item.done), 'rp-date');
        cell(row, short(item.since), 'rp-date');
        body.appendChild(row);
      });
    });
  }

  function drawOther(data) {
    var body = document.getElementById('other');
    body.replaceChildren();
    data.otherWork.forEach(function (work) {
      var row = el('tr');
      cell(row, work.name);
      cell(row, short(work.finished), 'rp-date');
      cell(row, work.items, 'rp-num');
      body.appendChild(row);
    });
    var later = document.getElementById('later');
    later.replaceChildren();
    data.later.concat(data.otherOpen || []).forEach(function (item) {
      var row = el('tr');
      cell(row, item.name);
      cell(row, item.group);
      later.appendChild(row);
    });
  }

  function drawHistoryTable(rows) {
    var body = document.getElementById('history-table');
    body.replaceChildren();
    rows.forEach(function (r) {
      var row = el('tr');
      cell(row, dayLong.format(utc(r.date)), 'rp-date');
      cell(row, r.open, 'rp-num');
      cell(row, r.shipped, 'rp-num');
      body.appendChild(row);
    });
  }

  // A point-to-point line chart: open items and the running total shipped, by day.
  function drawHistory(rows) {
    var host = document.getElementById('history-chart');
    var readout = document.getElementById('history-readout');
    host.replaceChildren();
    if (!rows.length) { readout.textContent = 'No history is in this build.'; return; }
    var width = Math.max(280, host.clientWidth || 640);
    var height = 260;
    var m = { top: 16, right: 36, bottom: 30, left: 40 };
    var t0 = utc(rows[0].date).getTime();
    var t1 = utc(rows[rows.length - 1].date).getTime();
    var span = Math.max(1, t1 - t0);
    var max = Math.max.apply(null, rows.map(function (r) { return Math.max(r.open, r.shipped); }));
    var step = max > 80 ? 20 : max > 40 ? 10 : 5;
    var top = Math.max(step, Math.ceil(max / step) * step);
    var x = function (day) { return m.left + ((utc(day).getTime() - t0) / span) * (width - m.left - m.right); };
    var y = function (v) { return height - m.bottom - (v / top) * (height - m.top - m.bottom); };
    var last = rows[rows.length - 1];

    var chart = svg('svg', { width: '100%', height: String(height), viewBox: '0 0 ' + width + ' ' + height, role: 'img', tabindex: '0',
      'aria-label': 'Line chart from ' + dayLong.format(utc(rows[0].date)) + ' to ' + dayLong.format(utc(last.date)) +
        ': items shipped rise to ' + last.shipped + ', and ' + last.open + ' items are open. The numbers are in the table below.' });
    for (var v = 0; v <= top; v += step) {
      chart.appendChild(svg('line', { class: 'rp-gridline', x1: m.left, x2: width - m.right, y1: y(v), y2: y(v) }));
      chart.appendChild(svg('text', { x: m.left - 6, y: y(v) + 4, 'text-anchor': 'end' }, v));
    }
    chart.appendChild(svg('line', { class: 'rp-axis', x1: m.left, x2: width - m.right, y1: y(0), y2: y(0) }));
    var weeks = Math.max(1, Math.round(span / 86400000 / Math.max(2, Math.floor(width / 90))));
    for (var t = t0; t <= t1; t += weeks * 86400000) {
      var day = new Date(t).toISOString().slice(0, 10);
      chart.appendChild(svg('text', { x: x(day), y: height - m.bottom + 18, 'text-anchor': 'middle' }, short(day)));
    }
    var plan = '2026-11-18';
    if (plan >= rows[0].date && plan <= last.date) {
      chart.appendChild(svg('line', { class: 'rp-marker', x1: x(plan), x2: x(plan), y1: m.top, y2: y(0) }));
      chart.appendChild(svg('text', { x: x(plan) - 6, y: m.top + 10, 'text-anchor': 'end' }, 'v4 plan set'));
    }
    [['open', 'var(--line-open)'], ['shipped', 'var(--line-shipped)']].forEach(function (series) {
      var d = rows.map(function (r, i) { return (i ? 'L' : 'M') + x(r.date).toFixed(1) + ',' + y(r[series[0]]).toFixed(1); }).join('');
      chart.appendChild(svg('path', { d: d, fill: 'none', stroke: series[1], 'stroke-width': '2.5' }));
      chart.appendChild(svg('text', { x: x(last.date) + 6, y: y(last[series[0]]) + 4, style: 'fill:var(--fg);font-weight:600' }, last[series[0]]));
    });
    var cursor = svg('line', { class: 'rp-cursor', y1: m.top, y2: y(0), visibility: 'hidden' });
    chart.appendChild(cursor);

    var chosen = rows.length - 1;
    function show(i) {
      chosen = Math.max(0, Math.min(rows.length - 1, i));
      var r = rows[chosen];
      cursor.setAttribute('x1', x(r.date));
      cursor.setAttribute('x2', x(r.date));
      cursor.setAttribute('visibility', 'visible');
      readout.textContent = dayLong.format(utc(r.date)) + ': ' + r.open + ' open, ' + r.shipped + ' shipped in all.';
    }
    function nearest(event) {
      var box = chart.getBoundingClientRect();
      var px = (event.clientX - box.left) * (width / (box.width || width));
      var best = 0;
      rows.forEach(function (r, i) { if (Math.abs(x(r.date) - px) < Math.abs(x(rows[best].date) - px)) best = i; });
      return best;
    }
    chart.addEventListener('pointermove', function (event) { show(nearest(event)); });
    chart.addEventListener('pointerdown', function (event) { show(nearest(event)); });
    chart.addEventListener('focus', function () { show(chosen); });
    chart.addEventListener('keydown', function (event) {
      var moves = { ArrowLeft: -1, ArrowRight: 1, Home: -rows.length, End: rows.length };
      if (!(event.key in moves)) return;
      event.preventDefault();
      show(chosen + moves[event.key]);
    });
    host.appendChild(chart);
  }

  function draw(data) {
    var asOf = document.getElementById('as-of');
    if (data.error) {
      document.getElementById('load-error').textContent = 'This build could not read the project record, so there is nothing to show yet. It will be read again at the next publish.';
      document.getElementById('load-error').hidden = false;
      asOf.textContent = '';
      return;
    }
    asOf.textContent = data.asOf
      ? 'Updated from the project record of ' + stamp.format(new Date(data.asOf)) + '.'
      : 'Updated from the project record.';
    drawPhases(data);
    drawItems(data);
    drawOther(data);
    drawHistoryTable(data.history || []);
    drawHistory(data.history || []);
    var width = document.getElementById('history-chart').clientWidth;
    if ('ResizeObserver' in window) {
      new ResizeObserver(function () {
        var now = document.getElementById('history-chart').clientWidth;
        if (Math.abs(now - width) > 8) { width = now; drawHistory(data.history || []); }
      }).observe(document.getElementById('history-chart'));
    }
  }

  fetch('progress.json', { cache: 'no-cache' })
    .then(function (response) { if (!response.ok) throw new Error(response.status); return response.json(); })
    .then(draw)
    .catch(function () {
      document.getElementById('load-error').hidden = false;
      document.getElementById('as-of').textContent = '';
    });
})();
