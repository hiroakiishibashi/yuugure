# YUUGURE（夕暮れ）HTML5 移植設計書

## ゲーム概要
- **ジャンル**: コージー系 + ブログ + 自分の部屋作りゲーム（どうぶつの森ダーク版）
- **世界観**: 世界の終わり病棟 / のけものがたり
- **核心システム**: プレイヤーがブログ（NML）を書くとキャラクターが喋る
- **元技術**: Flash(SWF) + NMLスクリプト(独自)
- **移植先**: HTML5（ブラウザ + モバイルアプリ + PC）

---

## NML仕様まとめ（`program/のけものがたり/test1.nml`より）

### テキスト・キャラクター系タグ
```xml
<title value="タイトル">        <!-- 最初に出てくる文字 -->
<speed value="1">               <!-- 文字スピード（-2=最速） -->
<blank value="15">              <!-- 間。15=1秒 -->
<voice value="1">               <!-- ボイス音量 -->
<anim value="アニメ名">         <!-- アニメ呼び出し -->
<click>                         <!-- クリック待ち -->
<clear>                         <!-- テキスト消去 -->
```

### ライフ・メーター系
```xml
<life value="-1">               <!-- ライフ変化（絶対値 or 差分） -->
<life value="0,10,-5">          <!-- 範囲付きライフ変化 -->
<lifetext prefix="○○が" up="あがった" down="さがった" set="きめた">
```

### 変数・フロー制御
```xml
<set name="変数名" value="値">
<set name="変数名" value="値" global="true">   <!-- サーバー保存 -->
<get "変数名">
<if name="変数名" value="評価値">
  ...処理...
<else>
  ...処理...
</if>
<goto "ラベル"> / <goto value="ラベル">
<label "ラベル"> / <label value="ラベル">
```

### 入力・キーワード（ブログ連携のキモ）
```xml
<!-- テキスト入力して変数に保存 -->
<input value="変数名"></input>

<!-- キーワードでラベルへジャンプ（ブログ入力時に使う） -->
<input value="変数名">
  <key label="ラベル名" value="入力キーワード">
</input>
```

### アセット・外部ファイル
```xml
<image src="room/include/haikyo.jpg" level="1" state="in" time="30">
<image level="1" state="out" time="300">
<preload src="dark_bgm.swf" flag="sound_ok">
<geturl value="http://..." width="700" height="500">
```

### ユーザー認証・アイテム
```xml
<makeuser name="user_id" passwd="user_passwd">
<login name="user_name" passwd="user_passwd" autologin="true">
<item type="kagi" action="get">
<end evaluate="false">
<mail value="email@example.com">
```

---

## HTML5 アーキテクチャ

### フロントエンド
```
React + TypeScript + Vite
├── PixiJS（部屋レンダラー・アイソメトリックビュー）
├── カスタムNMLエンジン（JavaScript）
└── Capacitor（iOS/Android ラップ）
    Electron（PCアプリ ラップ）
```

### バックエンド
```
Node.js + Express（または Supabase）
├── 認証（JWT）
├── グローバル変数ストア（<set global="true">用）
├── NMLエントリー投稿・保存
├── アイテムシステム
└── ルームギャラリー
```

---

## src/ フォルダ構成

```
src/
├── engine/
│   ├── nml/
│   │   ├── NMLParser.ts       # NML XMLパーサー
│   │   ├── NMLExecutor.ts     # タグの実行エンジン
│   │   ├── NMLValidator.ts    # 構文チェック
│   │   └── tags/              # 各タグの実装
│   │       ├── TextTags.ts    # title/speed/blank/clear/click
│   │       ├── FlowTags.ts    # if/else/goto/label/end
│   │       ├── InputTags.ts   # input/key（ブログ連携）
│   │       ├── AssetTags.ts   # image/preload/geturl
│   │       ├── StateTags.ts   # set/get
│   │       ├── CharacterTags.ts # anim/voice/life/lifetext
│   │       └── ItemTags.ts    # item/makeuser/login/mail
│   ├── state/
│   │   ├── LocalState.ts      # ローカル変数管理
│   │   └── GlobalState.ts     # サーバー同期変数
│   ├── items/
│   │   └── ItemManager.ts     # アイテムシステム
│   └── auth/
│       └── AuthManager.ts     # ユーザー認証
│
├── renderer/
│   ├── room/
│   │   ├── RoomRenderer.ts    # PixiJS部屋レンダラー
│   │   ├── IsometricGrid.ts   # アイソメトリックグリッド
│   │   └── ItemSprite.ts      # アイテム表示
│   ├── character/
│   │   ├── Character.ts       # キャラクタークラス
│   │   └── AnimationSystem.ts # アニメーション（SWF置換）
│   └── ui/
│       ├── TextBox.ts         # 会話ボックス（タイプライター）
│       └── LifeMeter.ts       # ライフメーター
│
├── ui/
│   ├── blog/
│   │   ├── BlogEditor.tsx     # NMLブログ入力エディタ
│   │   └── BlogFeed.tsx       # 他プレイヤーのブログ一覧
│   ├── room/
│   │   ├── RoomView.tsx       # メイン部屋画面
│   │   └── ItemPanel.tsx      # アイテム配置UI
│   └── gallery/
│       └── DoorGallery.tsx    # ルームギャラリー（ドア一覧）
│
├── assets/                    # 変換済みアセット
│   ├── images/
│   ├── audio/                 # SWF音声 → MP3/OGG
│   └── sprites/               # SWFアニメ → CSS/PNG/WebP
│
└── server/
    ├── api/                   # REST API
    ├── models/                # DB models
    └── nml-runtime/           # サーバーサイドNML実行
```

---

## 開発フェーズ

### Phase 1: NMLエンジン（コア） ✅ 完了（2026-05-30）
- [x] NMLParser実装（**カスタム** tokenizer + parser。下記「実装メモ」参照）
- [x] NMLExecutor実装（全タグ対応・コンパイル + 非同期ランタイム + Hostインターフェース）
- [x] テキスト表示エンジン（Typewriter — フレームワーク非依存のタイプライター）
- [x] ローカル変数・条件分岐（LocalState / `<if><else>` / `<goto><label>`）
- [x] ブログ入力 → キーワードマッチング（`<input><key>` → ラベルジャンプ）
- [x] バリデーター（NMLValidator）/ グローバル変数の抽象化（GlobalState）/ DOMデモ + テスト38件

### Phase 2: レンダラー
- [ ] PixiJSセットアップ
- [ ] 基本的な部屋レンダラー
- [ ] キャラクター表示・アニメーション
- [ ] 画像読み込み（SWF→PNG/WebP変換）

### Phase 3: ゲームUI
- [ ] ブログエディタUI
- [ ] 部屋デコレーション
- [ ] ライフメーター
- [ ] アイテムシステム

### Phase 4: バックエンド
- [ ] ユーザー認証
- [ ] グローバル変数API
- [ ] NMLエントリー投稿・保存
- [ ] ルームギャラリー

### Phase 5: マルチプラットフォーム
- [ ] モバイル対応（Capacitor）
- [ ] PCアプリ（Electron or PWA）

---

## NML → HTML5 タグ対応表

| NMLタグ | HTML5実装 |
|---------|----------|
| テキスト直書き | タイプライター効果でCanvas/DOMに表示 |
| `<speed>` | タイプライター速度制御 |
| `<blank>` | setTimeout/requestAnimationFrame |
| `<click>` | クリック/タップイベント待機 |
| `<clear>` | テキストDOM/Canvas消去 |
| `<anim>` | CSS Animation / Spritesheet |
| `<image>` | HTMLImageElement + GSAP/CSS transition |
| `<preload>` | Promise-based asset loader |
| `<life>` | React state → LifeMeter component |
| `<input><key>` | text input + keyword matching |
| `<set global>` | API POST → DB保存 |
| `<login>` | JWT認証 |
| `<item>` | アイテムAPI |
| SWF音声 | Web Audio API（MP3/OGG） |

---

## 技術スタック

| 項目 | 選択 | 理由 |
|-----|------|------|
| フレームワーク | React + TypeScript | コンポーネント管理・型安全 |
| ビルドツール | Vite | 高速HMR・モダン |
| ゲームレンダラー | PixiJS v8 | 2D高速描画・モバイル対応 |
| アニメーション | GSAP | SWFアニメの再現性高い |
| バックエンド | Supabase | Auth + DB + API all-in-one |
| モバイル | Capacitor | React → iOS/Android |
| PC | PWA（または Electron） | ブラウザから配布可能 |
| NML解析 | **カスタム tokenizer/parser**（自作） | NMLは整形式XMLではないため標準XMLパーサーでは解析不可（後述） |

---

## Phase 1 実装メモ（2026-05-30）

### なぜ fast-xml-parser を使わず自作パーサーにしたか
当初 `fast-xml-parser` を想定していたが、実際のNMLスクリプト（`original/samples/*.nml`、Shift-JIS）を調査した結果、**NMLは整形式XMLではない**ことが判明した。標準XMLパーサーでは実ファイルを読めない:

1. **voidタグが閉じられない**: `<title value="x">` の後に地の文が続き `</title>` は来ない。XMLパーサーは以降全体を `<title>` の子として入れ子にしてしまう。
2. **位置引数（省略記法）**: `<goto "load_ok">` `<a 1>` `<blank 30>` `<anim idle>` — 属性名のない引数はXMLとして不正。
3. **`<else>` は単独マーカー**: `<if>…<else>…</if>` であり `<else>…</else>` ではない。
4. **コメントにダッシュ多用**: `<!------ タイトル ------>`。
5. **`<option>` 本文は独自サブ文法**: `text >> action >> power;` 行ベース。

→ 手書きの quote-aware tokenizer + lenient parser を実装。エラーは例外でなく診断（diagnostics）として収集する（20年前の手書きスクリプトのため寛容に）。**方言の和集合**をサポート: 2003年版（のけものがたり: `<label>/<goto>/<input><key>`）と 2010年版（仕様書: `<a N>/<goto N>/<option>/<br>/bareword引数`）。

### アーキテクチャ（フラット命令列モデル）
NMLは `goto`/`label` がブロック境界を跨ぐ逐次スクリプトなので、AST木を直接歩くのではなく**フラットな命令列にコンパイル**する。`<if>/<else>` は条件ジャンプに lower し、全 label/anchor を命令インデックスに解決（`compileNML`）。ランタイムはプログラムカウンタ方式で、`<click>/<blank>/<input>/<option>` は **Hostが解決するまで await で中断**する非同期実行。

```
parseNML(utf8) → NMLProgram(AST)
   → validateNML(program) → 診断
   → compileNML(program) → CompiledProgram(命令列)
   → new NMLExecutor(host).run(program) → RunResult
```

`NMLHost` がレンダラー/UI境界。Phase 1 では `DomHost`（プレーンDOM + Typewriter）と `RecordingHost`（テスト用ヘッドレス）を提供。**Phase 2 で PixiJS 実装の NMLHost に差し替えるだけ**でよい。

> 注: タグ実装は当初案の `tags/TextTags.ts` 等7ファイル分割ではなく、**レジストリ駆動**（`tags/TagSpec.ts` 一元定義 + Executorのディスパッチ）に集約した。タグ追加 = TagSpecに1エントリ追加。

### ファイル構成（実装済み）
```
src/engine/nml/
├── NMLTypes.ts        # 全型定義（AST・命令・診断・LifeChange等）
├── tags/TagSpec.ts    # タグレジストリ（void/block/marker・位置引数マップ・値パーサ）
├── NMLParser.ts       # tokenizer + parser（中核）
├── NMLValidator.ts    # 静的検証（未定義ラベル・必須属性・未知タグ等）
├── NMLExecutor.ts     # コンパイラ + 非同期ランタイム + NMLHostインターフェース
├── Typewriter.ts      # フレームワーク非依存のタイプライター（時間→可視文字数）
├── hosts/RecordingHost.ts  # テスト用ヘッドレスHost
├── index.ts           # 公開API barrel
└── *.test.ts          # vitest 38件（parser/executor/validator/typewriter）
src/engine/state/
├── LocalState.ts      # セッション変数ストア（文字列・変更通知）
└── GlobalState.ts     # サーバー永続変数の抽象（InMemory実装 + Phase4でSupabase差替）
src/renderer/ui/DomHost.ts  # Phase1 DOMデモHost（PixiJS前の暫定）
src/main.ts            # 埋め込みデモNMLを実行するエントリ
```

### 開発コマンド
```bash
npm install        # 初回のみ
npm test           # vitest（38件）
npm run dev        # Vite開発サーバー（デモ）
npm run build      # tsc --noEmit 型チェック + 本番ビルド
```

### 検証済み（2026-05-30）
型チェック clean / テスト38件 pass / 本番ビルド成功 / ブラウザデモでエンドツーエンド動作確認（タイトル・タイプライター[全角空白&改行保持]・クリック送り・clear・自由入力→変数保存→`<get>`補間。`<if><else>`・life・`<input><key>`ルーティング・goto/labelはユニットテストで網羅）。

### Phase 2 への申し送り
- `<image>/<preload>/<anim>` 等のアセット系は Host で**ログ出力するだけ**の暫定実装。PixiJS Host で実描画する。
- SWF音声/アニメ → MP3/OGG・スプライト変換のアセットパイプラインが別途必要（`original/` は Shift-JIS、gitignore対象）。
- `<speed>` の方言差（2003=遅延フレーム[負=最速] / 2010=フレーム毎文字数）は `speedToCps(mode)` で切替可能。実ゲーム移植は既定 `fpc` を使用。
- キーワードマッチは既定 `contains`（ブログ的）。`exact` に切替可能。
