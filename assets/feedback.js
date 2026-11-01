// ご意見・不具合フォーム: Formspree 経由で support@cocofree.jp に届く
(function() {
  var $ = function(id) { return document.getElementById(id); };
  var form = $('feedback-form');
  var status = $('feedback-status');

  function show(message, isError) {
    status.className = 'status' + (isError ? ' error' : '');
    status.innerHTML = message;
  }

  $('send-btn').addEventListener('click', async function() {
    var message = $('message').value.trim();
    var email = $('email').value.trim();
    if (!message) { show('内容を入力してください。', true); $('message').focus(); return; }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { show('メールアドレスの形式を確認してください。', true); $('email').focus(); return; }

    if (!(window.CONFIG && CONFIG.FEEDBACK_URL)) {
      show('送信フォームの準備中です。お手数ですが <a href="mailto:support@cocofree.jp">support@cocofree.jp</a> へメールでお送りください。', true);
      return;
    }

    var btn = this;
    btn.disabled = true;
    show('<span class="spinner" aria-hidden="true"></span>送信しています…');
    try {
      var res = await fetch(CONFIG.FEEDBACK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({
          _subject: '[おかやま補助金・助成金AI] ' + $('kind').value,
          kind: $('kind').value,
          role: $('role').value,
          message: message,
          email: email,
          page: document.referrer || '',
          _gotcha: form.elements._gotcha.value
        })
      });
      if (!res.ok) throw new Error('status ' + res.status);
      form.reset();
      show('送信しました。ご協力ありがとうございます。');
    } catch (e) {
      show('送信に失敗しました。時間をおいて再度お試しいただくか、<a href="mailto:support@cocofree.jp">support@cocofree.jp</a> へメールでお送りください。', true);
    } finally {
      btn.disabled = false;
    }
  });
})();
