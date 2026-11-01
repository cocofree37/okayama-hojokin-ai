// 事業者プロフィールの保存とWorker呼び出し
var PROFILE_KEY = 'okayama-hojokin-ai:profile';

function loadProfile() {
  try { return JSON.parse(localStorage.getItem(PROFILE_KEY)) || {}; } catch (e) { return {}; }
}

function saveProfile(profile) {
  try { localStorage.setItem(PROFILE_KEY, JSON.stringify(profile)); return true; } catch (e) { return false; }
}

function isDemoMode() {
  return !(window.CONFIG && CONFIG.WORKER_URL);
}

async function callWorker(payload) {
  var res = await fetch(CONFIG.WORKER_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  var data = {};
  try { data = await res.json(); } catch (e) { /* 本文なし */ }
  if (!res.ok) throw new Error(data.error || '通信に失敗しました (status ' + res.status + ')');
  return data;
}

function escapeHtml(text) {
  return String(text == null ? '' : text)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function safeUrl(url) {
  return /^https:\/\//i.test(url || '') ? url : '';
}
