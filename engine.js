/* guestwifi engine.
   Builds the text a phone camera reads to join a WiFi network (the "WIFI:" QR format),
   checks the details for common mistakes, and turns the text into a QR grid.
   Works in the browser and in Node (for tests). */
(function (root) {
  'use strict';

  var QR = typeof module === 'object' && module.exports ? require('./assets/qrcode.js') : root.qrcode;

  var SECURITY = {
    WPA: { label: 'WPA / WPA2 / WPA3', code: 'WPA' },
    WEP: { label: 'WEP (old routers)', code: 'WEP' },
    nopass: { label: 'No password', code: 'nopass' }
  };

  // In the WIFI: format these characters must be escaped with a backslash.
  function escapeField(s) {
    return String(s == null ? '' : s).replace(/([\\;,:"])/g, '\\$1');
  }

  function utf8Length(s) {
    var n = 0;
    for (var i = 0; i < s.length; i++) {
      var c = s.charCodeAt(i);
      if (c < 0x80) n += 1;
      else if (c < 0x800) n += 2;
      else if (c >= 0xD800 && c <= 0xDBFF) { n += 4; i++; }
      else n += 3;
    }
    return n;
  }

  // The text the QR code holds, e.g. WIFI:T:WPA;S:Home;P:secret;;
  function wifiString(d) {
    d = d || {};
    var sec = SECURITY[d.security] ? d.security : 'WPA';
    var out = 'WIFI:T:' + SECURITY[sec].code + ';S:' + escapeField(d.ssid) + ';';
    if (sec !== 'nopass') out += 'P:' + escapeField(d.password) + ';';
    if (d.hidden) out += 'H:true;';
    return out + ';';
  }

  // Reads a WIFI: string back into its parts (used by the tests to prove the round trip).
  function parseWifi(s) {
    if (!/^WIFI:/.test(s)) return null;
    var body = s.slice(5), out = {}, key = '', val = '', inKey = true;
    for (var i = 0; i < body.length; i++) {
      var ch = body[i];
      if (ch === '\\' && i + 1 < body.length) {
        i++;
        if (inKey) key += body[i]; else val += body[i];
        continue;
      }
      if (inKey && ch === ':') { inKey = false; continue; }
      if (ch === ';') { if (key) out[key] = val; key = ''; val = ''; inKey = true; continue; }
      if (inKey) key += ch; else val += ch;
    }
    return { security: out.T === 'nopass' ? 'nopass' : out.T, ssid: out.S || '', password: out.P || '', hidden: out.H === 'true' };
  }

  // Problems worth pointing out before someone prints 20 cards with a typo.
  // Each: { field, level: 'error' | 'warn', text }
  function check(d) {
    d = d || {};
    var msgs = [];
    var ssid = String(d.ssid || ''), pw = String(d.password || ''), sec = SECURITY[d.security] ? d.security : 'WPA';
    if (!ssid.trim()) msgs.push({ field: 'ssid', level: 'error', text: 'Type the network name, exactly as it shows on your phone.' });
    else if (utf8Length(ssid) > 32) msgs.push({ field: 'ssid', level: 'error', text: 'Network names can be at most 32 characters long. Check it against your router.' });
    else if (ssid !== ssid.trim()) msgs.push({ field: 'ssid', level: 'warn', text: 'The network name starts or ends with a space. Phones need it exactly, so check that is right.' });

    if (sec === 'WPA') {
      if (!pw) msgs.push({ field: 'password', level: 'error', text: 'Type the password, or choose "No password" if the network is open.' });
      else if (pw.length < 8) msgs.push({ field: 'password', level: 'error', text: 'WPA passwords are at least 8 characters. Check for a missing character.' });
      else if (pw.length > 63 && !/^[0-9a-fA-F]{64}$/.test(pw)) msgs.push({ field: 'password', level: 'error', text: 'WPA passwords are at most 63 characters.' });
      else if (pw !== pw.trim()) msgs.push({ field: 'password', level: 'warn', text: 'The password starts or ends with a space. Check that is really part of it.' });
    } else if (sec === 'WEP') {
      if (!pw) msgs.push({ field: 'password', level: 'error', text: 'Type the WEP key.' });
      else if ([5, 13, 16, 29].indexOf(pw.length) < 0 && !/^([0-9a-fA-F]{10}|[0-9a-fA-F]{26}|[0-9a-fA-F]{32}|[0-9a-fA-F]{58})$/.test(pw))
        msgs.push({ field: 'password', level: 'warn', text: 'WEP keys are usually 5 or 13 characters, or 10 or 26 hex digits. Check it.' });
    }
    // Only when the password mixes look-alikes (O with 0, or two of I, l and 1); one "1" on its own is fine.
    var mixed = (/O/.test(pw) && /0/.test(pw)) || ['I', 'l', '1'].filter(function (ch) { return pw.indexOf(ch) >= 0; }).length >= 2;
    if (mixed && sec !== 'nopass')
      msgs.push({ field: 'password', level: 'info', text: 'Your password has characters that look alike (O and 0, I, l and 1). The QR code is exact, but people typing it might mix them up.' });
    return msgs;
  }

  // The QR grid: an array of rows of true (dark) / false. Medium error correction survives a bit of wear.
  function qrMatrix(text, level) {
    QR.stringToBytes = QR.stringToBytesFuncs['UTF-8'];
    var q = QR(0, level || 'M');
    q.addData(text, 'Byte');
    q.make();
    var n = q.getModuleCount(), rows = [];
    for (var r = 0; r < n; r++) {
      var row = [];
      for (var c = 0; c < n; c++) row.push(q.isDark(r, c));
      rows.push(row);
    }
    return rows;
  }

  // An SVG path of the dark squares, one unit per module, with a quiet zone of `margin` modules.
  function qrPath(rows, margin) {
    margin = margin == null ? 4 : margin;
    var d = [];
    rows.forEach(function (row, r) {
      var c = 0;
      while (c < row.length) {
        if (!row[c]) { c++; continue; }
        var start = c;
        while (c < row.length && row[c]) c++;
        d.push('M' + (start + margin) + ' ' + (r + margin) + 'h' + (c - start) + 'v1h-' + (c - start) + 'z');
      }
    });
    return { d: d.join(''), size: rows.length + margin * 2 };
  }

  var api = { SECURITY: SECURITY, escapeField: escapeField, wifiString: wifiString, parseWifi: parseWifi,
    check: check, qrMatrix: qrMatrix, qrPath: qrPath, utf8Length: utf8Length };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.GuestWifi = api;
})(this);
