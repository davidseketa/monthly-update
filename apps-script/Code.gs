/**
 * Solventum Monthly Update — backend (Google Apps Script)
 *
 * Receives submissions from the update page, stores them in a Google Sheet,
 * saves voice messages to a Drive folder and emails a notification.
 *
 * One-time setup: run 'setup' once from the editor (authorise), then
 * Deploy → New deployment → Web app → Execute as: Me, Who has access: Anyone.
 */

const KEY = 'aspx-solv-2026';            // must match CONFIG.key in index.html
const NOTIFY_TO = '';                     // empty = the Google account that owns this script
const SEND_EMAIL = false;                // true = also email a notification for every submission
const SHEET_TITLE = 'Solventum Monthly Update – Inbox';
const FOLDER_TITLE = 'Solventum Monthly Update – Voice';
const SUBJECT_TAG = '[Solventum Update]';
const QUESTIONS = ['Contact', 'Commitments', 'News', 'Patterns', 'Unknowns', 'Anything else'];
const HEADERS = ['Submitted at', 'Reference', 'Person', 'Tag', 'Type', 'Period', 'Language', 'Mode', 'No update',
  'Q1 Contact', 'Q2 Commitments', 'Q3 News', 'Q4 Patterns', 'Q5 Unknowns', 'Q6 Anything else',
  'Voice transcript (live)', 'Written note', 'Audio file', 'Audio length (s)', 'Device'];

/* ---------- setup (run once) ---------- */
function setup() {
  const props = PropertiesService.getScriptProperties();
  let ss = null;
  if (props.getProperty('SHEET_ID')) { try { ss = SpreadsheetApp.openById(props.getProperty('SHEET_ID')); } catch (e) { ss = null; } }
  if (!ss) { ss = SpreadsheetApp.create(SHEET_TITLE); props.setProperty('SHEET_ID', ss.getId()); }
  const sh = ss.getSheets()[0];
  sh.setName('Responses');
  if (sh.getLastRow() === 0) {
    sh.appendRow(HEADERS);
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold').setBackground('#16324F').setFontColor('#ffffff');
    sh.setColumnWidths(10, 7, 320);
    sh.getRange('J:P').setWrap(true).setVerticalAlignment('top');
  }
  let folder = null;
  if (props.getProperty('FOLDER_ID')) { try { folder = DriveApp.getFolderById(props.getProperty('FOLDER_ID')); } catch (e) { folder = null; } }
  if (!folder) { folder = DriveApp.createFolder(FOLDER_TITLE); props.setProperty('FOLDER_ID', folder.getId()); }
  MailApp.getRemainingDailyQuota();   // makes sure the mail permission is granted
  Logger.log('Inbox sheet: ' + ss.getUrl());
  Logger.log('Voice folder: ' + folder.getUrl());
  Logger.log('Notifications go to: ' + notifyTo_());
}

/* ---------- web app ---------- */
function doGet() {
  return json_({ ok: true, service: 'solventum-update' });
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(25000);
    const p = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    if (p.key !== KEY) return json_({ ok: false, error: 'unauthorised' });
    if (!p.id || !p.person) return json_({ ok: false, error: 'missing fields' });

    const props = PropertiesService.getScriptProperties();
    const ss = SpreadsheetApp.openById(props.getProperty('SHEET_ID'));
    const sh = ss.getSheetByName('Responses');

    // retries from the page reuse the same reference — don't store twice
    if (sh.getLastRow() > 1) {
      const refs = sh.getRange(2, 2, sh.getLastRow() - 1, 1).getValues().map(r => r[0]);
      if (refs.indexOf(p.id) > -1) return json_({ ok: true, id: p.id, duplicate: true });
    }

    let audioUrl = '';
    if (p.audio && p.audio.b64) {
      const mime = String(p.audio.mime || 'audio/webm');
      const ext = /mp4|m4a|aac/.test(mime) ? 'm4a' : (/ogg/.test(mime) ? 'ogg' : 'webm');
      const name = p.id + ' – ' + safe_(p.person) + '.' + ext;
      const blob = Utilities.newBlob(Utilities.base64Decode(p.audio.b64), mime, name);
      audioUrl = DriveApp.getFolderById(props.getProperty('FOLDER_ID')).createFile(blob).getUrl();
    }

    const a = Array.isArray(p.answers) ? p.answers : [];
    sh.appendRow([
      new Date(), p.id, cell_(p.person), cell_(p.personTag), p.type === 'urgent' ? 'URGENT' : 'Monthly',
      cell_(p.periodLabel || p.period), cell_(p.lang), cell_(p.mode), p.noUpdate ? 'yes' : '',
      cell_(a[0]), cell_(a[1]), cell_(a[2]), cell_(a[3]), cell_(a[4]), cell_(a[5]),
      cell_(p.transcript), cell_(p.note), audioUrl, p.audio ? (p.audio.seconds || '') : '', cell_(p.userAgent)
    ]);

    if (SEND_EMAIL) { try { notify_(p, audioUrl, ss.getUrl()); } catch (mailErr) { console.error('mail failed', mailErr); } }
    return json_({ ok: true, id: p.id });
  } catch (err) {
    console.error(err);
    return json_({ ok: false, error: String(err && err.message || err) });
  } finally {
    try { lock.releaseLock(); } catch (e) {}
  }
}

/* ---------- notification email (also what the processing agent reads) ---------- */
function notify_(p, audioUrl, sheetUrl) {
  const urgent = p.type === 'urgent';
  const period = urgent ? 'ad hoc' : (p.periodLabel || p.period || '');
  const subject = SUBJECT_TAG + ' ' + (urgent ? 'URGENT – ' : '') + p.person + ' – ' + (p.noUpdate ? 'no update – ' : '') + period + ' – ' + p.id;

  const meta = [
    ['Reference', p.id], ['Person', p.person + (p.personTag ? ' (' + p.personTag + ')' : '')],
    ['Type', urgent ? 'URGENT / ad hoc' : 'Monthly'], ['Period', period],
    ['Language', p.lang], ['Mode', p.noUpdate ? 'no update' : p.mode]
  ];
  const sections = [];
  if (p.noUpdate) sections.push(['Status', 'No update this month.']);
  (p.answers || []).forEach((txt, i) => { if (txt) sections.push([(i + 1) + '. ' + QUESTIONS[i], txt]); });
  if (p.transcript) sections.push(['Voice message – live transcript', p.transcript]);
  if (p.note) sections.push(['Written note', p.note]);
  if (audioUrl) sections.push(['Voice recording', audioUrl + (p.audio && p.audio.seconds ? '  (' + p.audio.seconds + ' s)' : '')]);
  if (p.mode === 'voice' && !p.transcript) sections.push(['Note', 'No live transcript was captured — listen to the recording.']);

  const text = meta.map(m => m[0] + ': ' + m[1]).join('\n') + '\n\n' +
    sections.map(s => '## ' + s[0] + '\n' + s[1]).join('\n\n') + '\n\n---\nInbox sheet: ' + sheetUrl;

  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const html =
    '<div style="font-family:Inter,Arial,sans-serif;color:#0F1B2D;max-width:640px">' +
    '<div style="background:' + (urgent ? '#B4540A' : '#16324F') + ';color:#fff;padding:14px 18px;border-radius:10px 10px 0 0">' +
    '<div style="font-size:11px;letter-spacing:.16em;text-transform:uppercase;opacity:.85">Solventum update' + (urgent ? ' · URGENT' : '') + '</div>' +
    '<div style="font-size:19px;font-weight:700;margin-top:2px">' + esc(p.person) + ' — ' + esc(p.noUpdate ? 'no update' : period) + '</div></div>' +
    '<div style="border:1px solid #E4E8EE;border-top:0;padding:16px 18px;border-radius:0 0 10px 10px">' +
    '<table style="font-size:13px;color:#667085;border-collapse:collapse;margin-bottom:10px">' +
    meta.map(m => '<tr><td style="padding:2px 14px 2px 0">' + esc(m[0]) + '</td><td style="color:#0F1B2D">' + esc(m[1]) + '</td></tr>').join('') +
    '</table>' +
    sections.map(s => '<div style="margin-top:14px"><div style="font-weight:700;font-size:14px">' + esc(s[0]) + '</div>' +
      '<div style="white-space:pre-wrap;font-size:14px;line-height:1.5;margin-top:3px">' +
      (/^https?:\/\//.test(s[1]) ? '<a href="' + esc(s[1].split(' ')[0]) + '">' + esc(s[1]) + '</a>' : esc(s[1])) + '</div></div>').join('') +
    '<div style="margin-top:18px;font-size:12px;color:#667085"><a href="' + sheetUrl + '">Open the inbox sheet</a></div></div></div>';

  MailApp.sendEmail({ to: notifyTo_(), subject: subject, body: text, htmlBody: html, name: 'Solventum Update' });
}

/* ---------- helpers ---------- */
function notifyTo_() { return NOTIFY_TO || Session.getEffectiveUser().getEmail(); }
function json_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
function safe_(s) { return String(s || '').replace(/[^\p{L}\p{N} _-]/gu, '').slice(0, 40); }
function cell_(v) {
  let s = String(v == null ? '' : v).slice(0, 45000);
  if (/^[=+\-@]/.test(s)) s = "'" + s;          // never let a submission become a formula
  return s;
}
