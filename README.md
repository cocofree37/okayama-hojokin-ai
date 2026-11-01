# おかやま補助金・助成金AI

公開URL: https://cocofree37.github.io/okayama-hojokin-ai/

岡山県内の個人事業主・中小企業向けに、使える補助金・助成金を探し、申請書の下書きまで作る単独のWebアプリです(岡山市AIブートキャンプ)。
要件は [docs/要件定義.md](docs/要件定義.md)。

## 流れ

1. **事業者プロフィール**を入力(業種・所在地は選択式、やりたいこと・お金を使う予定はボタン選択+ひとこと補足、ほかに事業内容・予定金額など)。この端末の localStorage に保存され、「入力をクリア」で次の事業者に切り替えられる
2. **制度の候補**: Claude が国・岡山県・所在地の市町村の公式サイトを Web 検索し、合いそうな制度を3〜6件提示
3. **申請書の下書き**: 選んだ制度の公募要領を確認しながら事業計画書の下書きを作成。不明な事実は【要記入: ○○】で残し、足りない情報を入力すると作り直せる

### 正確さのための設計

- Web 検索は公式サイト(省庁・中小機構・事務局、岡山県、県内27市町村、商工会議所など)に限定。一覧は [worker/src/index.js](worker/src/index.js) の `OFFICIAL_DOMAINS`
- AI が書いたURLは、実際の検索結果に出たものだけを表示(それ以外は「検索して確認」と表示)
- 金額・締切は検索結果で確認できたものだけ。推測で埋めない指示をしている
- 申請の代行・採否の断定はせず、公式の公募要領での確認を画面上で案内

## 構成

- [index.html](index.html) / [assets/hojokin.js](assets/hojokin.js) — 本体
- [assets/hojokin-demo.js](assets/hojokin-demo.js) — AI未接続時の表示例
- [feedback.html](feedback.html) / [assets/feedback.js](assets/feedback.js) — ご意見・不具合フォーム(Formspree 経由で support@cocofree.jp へ)
- [assets/common.js](assets/common.js) — プロフィール保存、Worker呼び出し / [assets/style.css](assets/style.css)
- [config.js](config.js) — `WORKER_URL`(空ならデモ表示)と `FEEDBACK_URL`(空ならメール案内のみ)
- [worker/](worker/) — Cloudflare Worker(Web検索付きで Claude を呼ぶ。APIキーはここだけに置く)

## 動かし方

### デモ表示(AI未接続)

```bash
cd ~/dev/products/okayama-hojokin-ai && python3 -m http.server 8000
```

http://localhost:8000/ を開く。

### AI接続

```bash
cd ~/dev/products/okayama-hojokin-ai/worker
wrangler login
wrangler secret put ANTHROPIC_API_KEY
wrangler deploy
```

表示された `https://okayama-hojokin-ai.<サブドメイン>.workers.dev` を [config.js](config.js) の `WORKER_URL` に入れる。
公開先が `https://cocofree37.github.io` 以外なら、`worker/src/index.js` の `ALLOWED_ORIGINS` に追加する。

### 問い合わせフォーム

formspree.io に support@cocofree.jp で登録してフォームを作り、そのURL(`https://formspree.io/f/xxxx`)を [config.js](config.js) の `FEEDBACK_URL` に入れる。無料プランは月50件まで。

## 費用と上限

- モデルは `claude-opus-5-5`(effort: medium)。制度検索は最大12回、下書きは最大4回の Web 検索を使う
- 1回の実行で、トークン代と Web 検索代を合わせて数十円程度の見込み(検索結果の量で変動)
- 同じIPから1分あたり3回まで(`wrangler.toml` の `ratelimits`)。Anthropic Console 側で月の利用上限(Spend limit)も設定しておくこと

## 制約

- 検索対象のドメインは岡山向け。県外の事業者は、国の制度は出るが自治体独自の制度は出ない
