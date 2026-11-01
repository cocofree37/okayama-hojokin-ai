// 補助金・助成金AI: プロフィール入力 → 制度候補 → 申請書の下書き
(function() {
  var FIELDS = ['business_type', 'form', 'location', 'employees', 'business', 'plan', 'budget', 'timing'];
  var DEFAULT_LOCATION = '岡山県岡山市';
  var OTHER = 'その他';
  var CHIP_FIELDS = ['goals', 'spend'];

  // 業種ごとの「ひとこと補足」の例文
  var PLAN_EXAMPLES = {
    '飲食店': 'お土産の焼き菓子をネットで売りたい。包装に時間がかかっている。',
    '小売業(店舗)': '店頭だけでなくネットでも売りたい。在庫管理を手作業でしている。',
    'ネット通販・EC': '自社サイトの集客を強化したい。受注処理を自動化したい。',
    '食品製造(菓子・加工品など)': '新しい加工品を開発して県外へ販路を広げたい。',
    '製造業(食品以外)': '古い機械を入れ替えて生産性を上げたい。',
    '建設業・工務店': '見積や現場管理をデジタル化して残業を減らしたい。',
    '宿泊業・観光': 'インバウンド向けに予約サイトと多言語対応を整えたい。',
    '美容・理容・エステ': '予約システムを入れて、新規客をネットから集めたい。',
    '医療・福祉・介護': '記録業務をタブレット化して職員の負担を減らしたい。',
    '農業・林業・漁業': '規格外の農産物を加工して直販したい。',
    'IT・情報通信・Web制作': '新サービスを開発するため人を採用したい。'
  };
  var LEVEL_ORDER = { '国': 1, '県': 2, '市町村': 3, 'その他': 4 };

  var state = { candidates: [], selected: null, draft: null, sample: false };
  var $ = function(id) { return document.getElementById(id); };

  // 進み具合の表示(1: 事業のこと / 2: 制度をえらぶ / 3: 下書き)
  function setStep(n) {
    document.querySelectorAll('#stepper li').forEach(function(li, i) {
      li.classList.toggle('active', i + 1 === n);
      li.classList.toggle('done', i + 1 < n);
    });
  }

  function readProfile() {
    var profile = {};
    FIELDS.forEach(function(key) { profile[key] = $(key).value.trim(); });
    if (profile.business_type === OTHER) profile.business_type = $('business_type_other').value.trim() || OTHER;
    CHIP_FIELDS.forEach(function(key) { profile[key] = selectedChips(key).map(function(b) { return b.dataset.value; }); });
    return profile;
  }

  function selectedChips(key) {
    return Array.prototype.slice.call(document.querySelectorAll('#' + key + ' .chip[aria-pressed="true"]'));
  }

  // Worker へ送る形: 選択内容に制度の種類のヒントを添えて「やりたいこと」の文章にまとめる
  function toRequestProfile(profile) {
    var out = {};
    FIELDS.forEach(function(key) { out[key] = profile[key]; });
    var label = function(b) { return b.dataset.value + '(' + b.dataset.hint + ')'; };
    var parts = [];
    var goals = selectedChips('goals').map(label);
    var spend = selectedChips('spend').map(label);
    if (goals.length) parts.push('やりたいこと: ' + goals.join('、'));
    if (spend.length) parts.push('お金を使う予定のもの: ' + spend.join('、'));
    if (profile.plan) parts.push('補足: ' + profile.plan);
    out.plan = parts.join('\n');
    return out;
  }

  function setChips(key, values) {
    values = Array.isArray(values) ? values : [];
    document.querySelectorAll('#' + key + ' .chip').forEach(function(b) {
      b.setAttribute('aria-pressed', values.indexOf(b.dataset.value) !== -1 ? 'true' : 'false');
    });
  }

  function updatePlanExample() {
    $('plan').placeholder = '例: ' + (PLAN_EXAMPLES[$('business_type').value] || PLAN_EXAMPLES['飲食店']);
  }

  function optionValues(select) {
    return Array.prototype.map.call(select.options, function(o) { return o.value; }).filter(Boolean);
  }

  // 選択式の項目は、以前の自由入力の値(例: 飲食店(カフェ)、岡山県岡山市北区)も近い選択肢に合わせる
  function setField(key, value) {
    value = value || '';
    if (key === 'business_type') {
      var types = optionValues($('business_type'));
      var match = types.filter(function(t) { return t !== OTHER && value.indexOf(t) === 0; })[0];
      $('business_type').value = match || (value ? OTHER : '');
      $('business_type_other').value = match ? '' : value;
      toggleOtherType();
      updatePlanExample();
    } else if (key === 'location') {
      var places = optionValues($('location'));
      var place = places.filter(function(p) { return value.indexOf(p) === 0; })[0];
      $('location').value = place || (value && value.indexOf('岡山') === -1 ? '岡山県外' : DEFAULT_LOCATION);
    } else {
      $(key).value = value;
    }
  }

  function toggleOtherType() {
    $('business_type_other').hidden = $('business_type').value !== OTHER;
  }

  function fillProfile() {
    var profile = loadProfile();
    FIELDS.forEach(function(key) { setField(key, profile[key]); });
    CHIP_FIELDS.forEach(function(key) { setChips(key, profile[key]); });
  }

  function setStatus(el, message, isError, busy) {
    el.className = 'status' + (isError ? ' error' : '');
    el.innerHTML = (busy ? '<span class="spinner" aria-hidden="true"></span>' : '') + escapeHtml(message);
  }

  function wait(ms) { return new Promise(function(r) { setTimeout(r, ms); }); }

  async function request(payload) {
    if (isDemoMode()) {
      await wait(1200);
      return payload.mode === 'search' ? HOJOKIN_DEMO.search : HOJOKIN_DEMO.draft;
    }
    return callWorker(payload);
  }

  // ---------- STEP 2: 制度候補 ----------
  async function search() {
    var profile = readProfile();
    if (!profile.business && !profile.plan && !profile.goals.length) {
      setStatus($('search-status'), '「事業内容」を入力するか、「やりたいこと」を1つ以上選んでください。', true);
      $('business').focus();
      return;
    }
    $('saved-msg').hidden = !saveProfile(profile);
    state.sample = false;

    var btn = $('search-btn');
    btn.disabled = true;
    setStatus($('search-status'), '公式サイトを調べています。1〜2分ほどかかります…', false, true);
    try {
      var data = await request({ mode: 'search', profile: toRequestProfile(profile) });
      state.candidates = (data.candidates || []).slice().sort(function(a, b) {
        return (LEVEL_ORDER[a.level] || 9) - (LEVEL_ORDER[b.level] || 9);
      });
      showCandidates(data);
    } catch (e) {
      setStatus($('search-status'), e.message, true);
    } finally {
      btn.disabled = false;
    }
  }

  function showCandidates(data) {
    state.selected = null;
    renderCandidates(data);
    $('search-status').textContent = '';
    $('step3').hidden = true;
    $('step2').hidden = false;
    setStep(2);
    $('step2').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // 発表・説明用: 実際のAIで作った結果をすぐに表示する(入力内容は端末に保存しない)
  function showSample() {
    state.sample = true;
    FIELDS.forEach(function(key) { setField(key, HOJOKIN_SAMPLE.profile[key]); });
    CHIP_FIELDS.forEach(function(key) { setChips(key, HOJOKIN_SAMPLE.profile[key]); });
    $('saved-msg').hidden = true;
    state.candidates = HOJOKIN_SAMPLE.search.candidates.slice().sort(function(a, b) {
      return (LEVEL_ORDER[a.level] || 9) - (LEVEL_ORDER[b.level] || 9);
    });
    showCandidates(HOJOKIN_SAMPLE.search);
  }

  function isSampleDraft(program, answers) {
    return state.sample && !(answers && answers.length) && program.name.indexOf(HOJOKIN_SAMPLE.draft_program_keyword) !== -1;
  }

  function renderCandidates(data) {
    $('checked-at').textContent = state.sample
      ? 'サンプル: ' + HOJOKIN_SAMPLE.created_at + ' に実際のAIで作成した結果(カフェの例) ・ ' + state.candidates.length + '件'
      : state.candidates.length + '件 ・ 調べた日 ' + (data.checked_at || '');
    if (!state.candidates.length) {
      $('candidates').innerHTML = '<p>合いそうな制度が見つかりませんでした。「やりたいこと」を具体的にして、もう一度お試しください。</p>';
    } else {
      $('candidates').innerHTML = state.candidates.map(function(c, i) {
        var url = safeUrl(c.url);
        var link = url
          ? '<a href="' + escapeHtml(url) + '" target="_blank" rel="noopener">公式ページを開く</a>'
          : '<span class="unverified">公式ページは「' + escapeHtml(c.provider) + ' ' + escapeHtml(c.name) + '」で検索して確認してください</span>';
        return '<article class="program" data-index="' + i + '">'
          + '<div class="tags">'
          + (isDemoMode() ? '<span class="tag sample">表示例</span>' : state.sample ? '<span class="tag sample">サンプル</span>' : '')
          + '<span class="tag">' + escapeHtml(c.level) + '</span>'
          + '<span class="tag">' + escapeHtml(c.kind) + '</span>'
          + '<span class="tag' + (c.status === '公募中' ? ' open' : '') + '">' + escapeHtml(c.status) + '</span>'
          + '</div>'
          + '<h3>' + escapeHtml(c.name) + '</h3>'
          + '<p>' + escapeHtml(c.summary) + '</p>'
          + '<div class="fit"><b>あなたに合う理由</b>' + escapeHtml(c.fit_reason) + '</div>'
          + '<dl>'
          + '<div><dt>金額・補助率</dt><dd>' + escapeHtml(c.amount) + '</dd></div>'
          + '<div><dt>公募期間</dt><dd>' + escapeHtml(c.schedule) + '</dd></div>'
          + '<div><dt>実施主体</dt><dd>' + escapeHtml(c.provider) + '</dd></div>'
          + '<div class="wide"><dt>注意点</dt><dd>' + escapeHtml(c.cautions) + '</dd></div>'
          + '</dl>'
          + '<div class="actions"><button type="button" class="draft-btn" data-index="' + i + '">この制度で申請書の下書きを作る</button>' + link + '</div>'
          + '</article>';
      }).join('');
    }
    var notes = data.notes || [];
    $('notes').innerHTML = notes.length
      ? '<div class="draft-section"><h3>補足</h3><ul class="plain">' + notes.map(function(n) { return '<li>' + escapeHtml(n) + '</li>'; }).join('') + '</ul></div>'
      : '';
  }

  // ---------- STEP 3: 申請書の下書き ----------
  async function draft(answers) {
    var program = state.selected;
    $('step3').hidden = false;
    setStep(3);
    $('draft-for').textContent = '対象の制度: ' + program.name;
    $('draft').innerHTML = '';
    $('step3').scrollIntoView({ behavior: 'smooth', block: 'start' });
    setStatus($('draft-status'), '公募要領を確認しながら下書きを作っています。2分ほどかかることがあります…', false, true);
    setDraftButtonsDisabled(true);
    try {
      if (isSampleDraft(program, answers)) {
        await wait(600);
        state.draft = HOJOKIN_SAMPLE.draft;
      } else {
        state.draft = await request({ mode: 'draft', profile: toRequestProfile(readProfile()), program: program, answers: answers || [] });
      }
      $('draft-status').textContent = '';
      renderDraft(state.draft);
    } catch (e) {
      setStatus($('draft-status'), e.message, true);
    } finally {
      setDraftButtonsDisabled(false);
    }
  }

  function setDraftButtonsDisabled(disabled) {
    document.querySelectorAll('.draft-btn, #redraft-btn').forEach(function(b) { b.disabled = disabled; });
  }

  function highlightPlaceholders(text) {
    return escapeHtml(text).replace(/【要記入[:：][^】]*】/g, function(m) { return '<span class="placeholder">' + m + '</span>'; });
  }

  function renderDraft(d) {
    var sources = (d.sources || []).map(safeUrl).filter(Boolean);
    var html = (isDemoMode() ? '<div class="tags"><span class="tag sample">表示例</span></div>'
        : state.sample && d === HOJOKIN_SAMPLE.draft ? '<div class="tags"><span class="tag sample">サンプル</span></div>' : '')
      + '<h3>' + escapeHtml(d.title) + '</h3>'
      + d.sections.map(function(s) {
        return '<div class="draft-section"><h3>' + escapeHtml(s.heading) + '</h3><div class="draft-body">' + highlightPlaceholders(s.body) + '</div></div>';
      }).join('')
      + '<div class="actions">'
      + '<button type="button" id="copy-btn">下書きをコピー</button>'
      + '<button type="button" class="secondary" id="download-btn">テキストで保存</button>'
      + '<span id="copy-msg" class="saved" hidden>コピーしました</span>'
      + '</div>';

    if (d.missing_info.length) {
      html += '<div class="draft-section"><h3>足りない情報を入力して作り直す</h3>'
        + '<p class="hint">分かる範囲で入力してください。空欄のままでも大丈夫です。</p>'
        + d.missing_info.map(function(m, i) {
          return '<div class="missing-item"><label for="ans-' + i + '">' + escapeHtml(m.item) + '</label>'
            + '<input type="text" id="ans-' + i + '" data-item="' + escapeHtml(m.item) + '">'
            + '<p class="hint">' + escapeHtml(m.reason) + '</p></div>';
        }).join('')
        + '<div class="actions"><button type="button" id="redraft-btn">入力内容を反映して作り直す</button></div></div>';
    }
    if (d.checklist.length) {
      html += '<div class="draft-section"><h3>提出前のチェックリスト</h3><ul class="plain">'
        + d.checklist.map(function(c) { return '<li>' + escapeHtml(c) + '</li>'; }).join('') + '</ul></div>';
    }
    if (sources.length) {
      html += '<div class="draft-section"><h3>参照した公式ページ</h3><ul class="plain">'
        + sources.map(function(u) { return '<li><a href="' + escapeHtml(u) + '" target="_blank" rel="noopener">' + escapeHtml(u) + '</a></li>'; }).join('') + '</ul></div>';
    }
    $('draft').innerHTML = html;
  }

  function draftAsText(d) {
    return [d.title, ''].concat(d.sections.map(function(s) { return s.heading + '\n' + s.body + '\n'; })).join('\n');
  }

  function collectAnswers() {
    return Array.prototype.map.call(document.querySelectorAll('#draft input[data-item]'), function(input) {
      return { item: input.getAttribute('data-item'), answer: input.value.trim() };
    }).filter(function(a) { return a.answer; });
  }

  // ---------- イベント ----------
  $('search-btn').addEventListener('click', search);
  $('sample-btn').addEventListener('click', showSample);
  CHIP_FIELDS.forEach(function(key) {
    $(key).addEventListener('click', function(e) {
      var chip = e.target.closest('.chip');
      if (chip) chip.setAttribute('aria-pressed', chip.getAttribute('aria-pressed') === 'true' ? 'false' : 'true');
    });
  });
  $('business_type').addEventListener('change', function() {
    toggleOtherType();
    updatePlanExample();
    if ($('business_type').value === OTHER) $('business_type_other').focus();
  });

  // 支援者が次の事業者の相談に移るとき用
  $('clear-btn').addEventListener('click', function() {
    if (!confirm('入力内容と結果を消して、最初からやり直しますか？')) return;
    FIELDS.forEach(function(key) { setField(key, ''); });
    CHIP_FIELDS.forEach(function(key) { setChips(key, []); });
    try { localStorage.removeItem(PROFILE_KEY); } catch (e) { /* 保存なし */ }
    state = { candidates: [], selected: null, draft: null, sample: false };
    $('step2').hidden = true;
    $('step3').hidden = true;
    setStep(1);
    $('saved-msg').hidden = true;
    $('search-status').textContent = '';
    $('business_type').focus();
  });

  $('candidates').addEventListener('click', function(e) {
    var btn = e.target.closest('.draft-btn');
    if (!btn) return;
    var index = Number(btn.getAttribute('data-index'));
    state.selected = state.candidates[index];
    document.querySelectorAll('.program').forEach(function(el) {
      el.classList.toggle('selected', Number(el.getAttribute('data-index')) === index);
    });
    draft([]);
  });

  $('draft').addEventListener('click', function(e) {
    if (e.target.id === 'redraft-btn') {
      draft(collectAnswers());
    } else if (e.target.id === 'copy-btn') {
      navigator.clipboard.writeText(draftAsText(state.draft)).then(function() { $('copy-msg').hidden = false; });
    } else if (e.target.id === 'download-btn') {
      var blob = new Blob([draftAsText(state.draft)], { type: 'text/plain;charset=utf-8' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = '申請書下書き.txt';
      a.click();
      setTimeout(function() { URL.revokeObjectURL(a.href); }, 1000);
    }
  });

  fillProfile();
  $('demo-banner').hidden = !isDemoMode();
})();
