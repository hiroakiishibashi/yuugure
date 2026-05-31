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

### Phase 2: レンダラー ✅ 完了（2026-05-31）
- [x] PixiJSセットアップ（v8・`PixiHost`が`NMLHost`を実装、`DomHost`を置換）
- [x] 基本的な部屋レンダラー（`RoomRenderer` + `IsometricGrid` + `ItemSprite`、深度ソート）
- [x] キャラクター表示・アニメーション（`Character` + `AnimationSystem`: idle/talk/glad/sad、発話中は自動口パク）
- [x] 画像読み込み（`AssetResolver`: レイヤー合成 + GSAPフェードin/out。実アセット未変換のためプレースホルダモード）
- [x] テキストボックス（`TextBox` PixiJS + Typewriter）/ ライフメーター（`LifeMeter`）/ テスト+17件（合計55件）

### Phase 3: ゲームUI ✅ 完了（2026-05-31）
- [x] ブログエディタUI（`BlogEditor`/`BlogFeed`: 書く→キャラが喋る中核ループ）
- [x] 部屋デコレーション（`RoomView`/`ItemPanel`: 所持品をアイソメ床に配置・消費）
- [x] ライフメーター（Phase 2 の `LifeMeter` を流用・精神力表示）
- [x] アイテムシステム（`ItemManager`: NML `<item>` 連動・インベントリ）
- [x] Reactシェル（`App`/`GameContext`/`GameController`）+ ギャラリー（`DoorGallery`）+ テスト+10件（合計65件）

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

---

## Phase 2 実装メモ（2026-05-31）

### 中核：`NMLHost` を PixiJS で実装した `PixiHost`
Phase 1 の `NMLHost` 境界はそのままに、`DomHost`（プレーンDOM）を **`PixiHost`（PixiJS v8）に差し替え**。エンジン側は一切変更なし — 設計どおりHostの差し替えだけでレンダラーが乗った。`NMLExecutor` が `PixiHost` を駆動し、共有 ticker が Typewriter とキャラクターアニメを毎フレーム更新する。

```
PixiHost.create(rootEl) → await app.init() (v8は非同期) → シーングラフ構築
  imageLayer (＜image＞レイヤー) ▶ RoomRenderer ▶ Character ▶ UI(Title/LifeMeter/TextBox)
  + DOMオーバーレイ（＜input＞/＜option＞のフォーム）
```

### コンポーネント（`src/renderer/`）
| ファイル | 役割 | テスト |
|---|---|---|
| `PixiHost.ts` | `NMLHost`実装。`<image>`レイヤー合成+GSAPフェード、発話/待機での自動アニメ、入力/選択肢のDOMオーバーレイ | ブラウザ検証 |
| `character/AnimationSystem.ts` | **純粋**な状態機械（idle/talk/glad/sad）+ NMLアニメ名マッピング | ✅ vitest |
| `character/Character.ts` | 手続き的キャラ描画（AnimationSystem駆動・口パク/跳ね/うつむき） | ブラウザ |
| `room/IsometricGrid.ts` | **純粋**なアイソメトリック座標変換（投影/逆投影/深度/タイル多角形） | ✅ vitest |
| `room/RoomRenderer.ts` ・ `ItemSprite.ts` | アイソメ床グリッド + 深度ソートしたアイテム配置 | ブラウザ |
| `ui/TextBox.ts` | PixiJS会話ボックス + Typewriter（tickerが駆動）+ クリックインジケータ | ブラウザ |
| `ui/LifeMeter.ts` | 精神力バー + 数値 + `<lifetext>`メッセージ | ブラウザ |
| `assets/assetPaths.ts` | **純粋**なパス解決（key/URL/拡張子/SWF判定） | ✅ vitest |
| `assets/AssetResolver.ts` | NML `src`→Pixi表示物。既定プレースホルダモード（404を出さずコンソール清潔） | ブラウザ |

> **設計方針**: 純粋ロジック（座標・アニメ状態・パス）はpixiを一切importせずnodeでユニットテスト。Pixi依存（canvas/WebGL）はブラウザのスクリーンショットで検証。テスト計55件。
>
> **アセット未変換のためプレースホルダ運用**: 実画像/音声（SWF・JPG）は未変換。`AssetResolver`は既定で**ネットワークに行かず**ラベル付きプレースホルダを返す（404ノイズ回避）。`<image>`はレイヤー名を表示。パイプライン完成後 `new AssetResolver({ tryLoad:true, baseUrl })` で実画像に切替。キャラも手続き的（実スプライト変換で差替）。

### 検証済み（2026-05-31・ブラウザE2E）
タイトル/精神力メーター/`<image>`プレースホルダ（GSAPフェードin）/アイソメ部屋グリッド/手続き的キャラ/Typewriterを描画。フレッシュ起動で最初の`<click>`で正しく停止（待機がブロック）。クリック送り→`<clear>`→自由`<input>`→送信→`<get>`補間（「アキ」）→`<anim glad>`→`<life +20>`+`<lifetext>`メッセージ→`<option>`選択→goto/label→`<life +15>`(精神力85)→`<end>`「— おわり —」。コンソールエラーなし。

### Phase 3 への申し送り
- `<input>`/`<option>` は最小DOMオーバーレイ。Phase 3 のブログエディタ（NML入力）UIへ発展させる。
- `RoomRenderer.placeItem()` は実装済みだがアイテム配置UI（ドラッグ等）は未。部屋デコレーションUIで使う。
- `LifeMeter` は起動直後 `startLife` を反映せず初回 `<life>` で更新（軽微・必要なら初期化フックを追加）。
- 実アセット差し込み（`tryLoad:true`）とSWF変換パイプラインは引き続き別タスク。

---

## Phase 3 実装メモ（2026-05-31）

### React UI 層が中央に。ただしエンジン/レンダラーは無変更
Reactがシェル（ヘッダー・タブ・ブログ・アイテム・ギャラリー）を描画し、**PixiJSシーンは常時表示の `.stage` に一度だけマウント**（タブを切り替えても部屋・キャラ・テキストは生き続ける）。React と非Reactの境界は `GameController`。Phase 1/2 のエンジン・`PixiHost` 本体は変更せず、`PixiHost` に React 連携用メソッド（`destroy`/`addRoomItem`/`onItem`/`cancelWait`）と `LifeMeter` 初期表示の seed を足しただけ。

```
main.tsx → <GameProvider>(GameController.create→PixiHost) → <App>(tabs)
  ブログ: BlogEditor → GameController.speakBlog(text)
            → blogReactions.blogToNML(キーワード→NML) → NMLExecutor.run(PixiHost) → キャラが喋る
  へや:   RoomView/ItemPanel → GameController.placeItem → PixiHost.addRoomItem（アイソメ床にトークン）
  ギャラリー: DoorGallery → GameController.runNML（訪問シーン再生）
```

### 中核ループ「ブログを書く→キャラが喋る」
`src/game/blogReactions.ts`（**純粋**）が、プレイヤーの本文を NML `<input><key>` と同じ発想でキーワード走査し、最初に一致したルールで反応（anim + セリフ + 精神力増減）を決定。`blogToNML()` がそれを `<clear>…<anim>…<life>…<end>` の短い NML に変換し、既存エンジン + `PixiHost` がそのまま再生する（キャラが文字送りで喋る）。末尾 `<click>` を付けないので UI はブロックしない。連投時は `GameController.runNML` が `cancelWait()`+`executor.stop()` で前のシーンを中断してから次を再生。

### コンポーネント（`src/ui/`・`src/game/`）
| ファイル | 役割 | テスト |
|---|---|---|
| `game/GameController.ts` | PixiHost + 単一NMLExecutor（life/変数を跨いで保持）+ ItemManager + ブログ投稿の統合 | ブラウザ |
| `game/blogReactions.ts` | **純粋**。キーワード→反応→NML変換（書く→喋る） | ✅ vitest |
| `engine/items/ItemManager.ts` | **純粋**。インベントリ（NML `<item>` 連動・get/use・購読） | ✅ vitest |
| `ui/GameContext.tsx` | `GameController` を一度だけ生成し React へ供給。`.stage` に PixiJS マウント | ブラウザ |
| `ui/App.tsx` | タブシェル（ブログ/へや/ギャラリー） | ブラウザ |
| `ui/blog/BlogEditor.tsx`・`BlogFeed.tsx`・`BlogPanel.tsx` | 本文入力→発話、投稿フィード（反応キーワード表示） | ブラウザ |
| `ui/room/RoomView.tsx`・`ItemPanel.tsx` | 所持品パレット→アイソメ床に配置・消費 | ブラウザ |
| `ui/gallery/DoorGallery.tsx` | 他プレイヤーの扉（現状ローカルmock・訪問でシーン再生） | ブラウザ |

> **StrictMode は意図的に不使用**（dev二重マウントで PixiJS Application が2つ生成されるため）。`main.tsx` 参照。
> **ビルド警告**: PixiJS+React 同梱で初期チャンク>500kB。code-split は Phase 5 の最適化事項。

### 検証済み（2026-05-31・ブラウザE2E）
ヘッダー「夕暮れ — のけものがたり —」/ 精神力メーター(初期50 seed) を描画。**ブログ**: 「…たのしい…ありがとう」投稿→キャラが「そう… よかった / きみが わらうと ぼくも うれしい」と発話、精神力 50→60 (+10)・「「心」があたたかくなった」表示、フィードに「「ありがとう」に はんのう」付きで記録。**へや**: いす/ランプを選択→アイソメ床にトークン配置・インベントリ消費（「はな ×1」のみ残）。**ギャラリー**: 扉6枚→「あおい」訪問でシーン再生。タブ切替でシーン永続。コンソールエラーなし。

### Phase 4 への申し送り
- ブログ投稿・インベントリ・精神力は現状メモリ内（リロードで消える）。Supabase で永続化（`GlobalState` backend を差し替え）。
- `DoorGallery` はローカルmock。実ユーザーの部屋一覧 API へ。
- `<makeuser>`/`<login>`/`<set global>` は `PixiHost`/`GlobalState` のスタブ。JWT認証 + グローバル変数 API を実装。
- ブログ本文そのものの保存・他プレイヤー閲覧（`BlogFeed` の拡張）。

---

## ドット絵アセット統合（2026-05-31・Phase 4 の前に実施）

### 手続き的キャラ → オリジナルのドット絵GIFアニメに差し替え
Phase 2 の手続き的キャラ（`Character.ts`、青い塊）を、オリジナル版の **のけもの ドット絵GIF** に置き換えた。

- **アセット出自**: `original/method/夕暮れの部屋キャラクター/`（= `method/GIF/` と同一・重複）。`{id}_idoling[N].gif` 形式、200×200、**透過(bgra)・アニメ済み(16〜40フレーム)・ドット絵**。`-1`/`-2` 接尾辞は完全な重複（無視）。状態はほぼ全て idle（talk/glad/sad は Flash `.fla`/`.swf` 内で、抽出は非現実的）。
- **パイプライン**: 各キャラの基底GIFを `public/characters/{id}.gif` に**コピー**（33体・約1.1MB）。Vite が `public/` を dist 直下へ配信・コピー。`original/` は gitignore のままだが `public/characters/` は**追跡対象＝コミットされる**（ロスレスなゲームアセット）。
- **レジストリ** `src/game/characters.ts`（純粋・テスト）: 33体の `{id, name(ひらがな), gif}`、`HOME_CHARACTER_ID`、ギャラリー用 `GALLERY_ROOM_IDS`。テストは `public/characters/` に実ファイルが在ることを検証（レジストリ⇔アセットのdrift検出）。
- **表示** `src/renderer/character/PixelCharacter.ts`: PixiJS canvas の上に重ねた **DOM `<img>`**。理由＝アニメGIFをブラウザがネイティブ再生（完全再現）し、`image-rendering: pixelated` でドット絵が拡大しても crisp。フレーム抽出不要・差し替えは `img.src` 変更のみ。`AnimationSystem` で論理状態（NML `<anim>`）を追跡し、glad/sad は同一アートに CSS フィルタ（明度/彩度）で気分付け。クリックは透過（`pointer-events:none`）で canvas に届く。
- **部屋ごとにキャラ入れ替え**: `GameController.setCharacter(id)` → `PixiHost.setCharacter` → `PixelCharacter.setCharacter`。`DoorGallery` は各ドア＝1キャラの部屋（ドット絵サムネイル表示）。訪問で `setCharacter` + 訪問シーン再生。

### 既知の制約 / Phase 4以降
- 利用可能GIFは idle のみ。talk/glad/sad は idle アニメ＋CSS気分フィルタで代替（多くのキャラは口が無い抽象生物なので破綻しない）。本来の talk/glad/sad を出すには `.swf`/`.fla` のデコンパイル抽出が別途必要。
- 部屋の背景JPG（`<image>` 用 haikyo 等）は `original/` 内に見当たらず未統合。`AssetResolver` の `tryLoad:true` 経路は実装済みなので、変換後に差し込み可能。
- `noke01〜19.psd` はキャラのドット絵ソース（追加キャラ起こしに使える）。
- 検証: 起動時 `はな`、ギャラリーで `だいふく` 等を訪問→ステージのキャラが実際に入れ替わる（`img.src=/characters/daifuku.gif`）。ピクセルは crisp、コンソールエラーなし。テスト計69件 pass。

---

## Flash(SWF)サルベージ — 動作別アニメ + UI（2026-05-31）

idle GIF だけでは不足（talk/glad/sad が無い）だったため、**オリジナルの Flash SWF から動作別アニメを抽出**した。

### ツール
- `brew install openjdk`（OpenJDK 26）+ **JPEXS ffdec**（`ffdec_26.2.1.zip` 配置、`ffdec-cli.jar` を headless 実行）。GUI起動を避けるため必ず CLI jar + 引数で呼ぶ。
- 圧縮SWF（CWS=zlib）は Node `zlib.inflate` で解凍可（ラベル文字列確認用）。`ffmpeg` で PNG連番→透過GIF。`timeout` は macOS に無いので使わない。

### 構造（`nokemono_fla/*.swf`・33体）
各キャラSWFのメインタイムラインに**動作フレームラベル**（`idoling1, talk1, joy, sad, angry, jump, …`）があり、各ラベル区間で対応する**DefineSprite（動作アニメ）**を配置する。各フレームは200×200のフルビットマップ（透過 bgra）。

### 抽出パイプライン（`scripts/extract-characters.mjs`）
1. `ffdec -dumpSWF` → ラベル区間内の `PlaceObject2 chid` を `DefineSprite` と突合し **ラベル→スプライトchid を自動マッピング**。
2. `ffdec -export sprite` → 各スプライトの200×200透過PNG連番。
3. 目的の動作（idle/talk/joy/sad/angry/jump、ラベル名は別名フォールバック表で吸収）に対応するスプライト連番を `ffmpeg`（`palettegen reserve_transparent` + `paletteuse alpha_threshold`）で **透過15fps GIF** 化 → `public/characters/{id}_{action}.gif`。
4. 各キャラの利用可能動作を `src/game/characterManifest.ts`（自動生成・コミット）に出力。

### 結果
- **33体すべてが idle + talk（口パク＝リップシンク）** を取得。`joy`×5（daifuku/enbou/ashinaga/fudousan/ganbunsan）、`sad`×3（daifuku/enbou/nasu）、`angry`/`jump` も一部。計79本のGIF（2.1MB）。
- `characters.ts` をマニフェスト駆動に再構築。`characterGif(id, action)` は欠落動作を idle にフォールバック。`PixelCharacter` が NMLの状態（idle/talk/glad/sad）→ 動作GIF（idle/talk/joy/sad）を切替し、**喜べば跳ね、喋れば口が動く**。欠落時は idle + CSS `data-mood` で気分付け。
- 旧の単一idle GIF（33本）は SWF版に置換のため削除。

### UI サルベージ
- 原作の **「DOOR SELECT」画面**（`web/web_communication/img/newGate_doorSample.jpg`：A011〜のドアカードに部屋ID・タイトル・覗き窓のキャラ・青い設計図デザイン）と **エリア選択画面**（`newGate_areaSelect.gif`：アパート群＋空模様）を発見。
- `DoorGallery` をこの DOOR SELECT デザインに作り直し（A0XX採番・覗き窓に各クリーチャーのドット絵GIF・青系カード）。

### 背景・部屋について（重要な制約）
- 部屋の**背景ビットマップ（haikyo.jpg 等）はアーカイブに現存しない**（NMLで実行時ロードされる外部ファイルで、保存されていない）。`room.swf` はベクターのエディタUIで埋め込み部屋アート無し（フレームレンダリングも空）。
- よって部屋の内装は引き続き**手続き的なアイソメトリック床**＋配置アイテムで表現。実背景が将来手に入れば `AssetResolver{tryLoad:true}` 経路で `<image>` から差し込める。

### 検証済み（2026-05-31・ブラウザE2E）
home=だいふく の idle 表示 → ブログ「うれしい/ありがとう」→ **だいふくが跳ねる joy アニメ**（`daifuku_joy.gif`）+ 精神力+10。発話中は talk。ギャラリーは DOOR SELECT 風 A011〜A022（全クリーチャーのドット絵サムネ）。A013 訪問 → ステージが **あしなが** に入れ替わり（`ashinaga_*.gif`）。tsc clean / vitest 70件 pass / build OK / コンソールエラーなし。

> 再抽出: `brew install openjdk` 後、ffdec を `.tools/ffdec/` に置き `node scripts/extract-characters.mjs`。`.tools/`（ffdec jar・中間フレーム）は gitignore。生成物（`public/characters/*.gif` と `characterManifest.ts`）はコミット。
