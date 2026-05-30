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

### Phase 1: NMLエンジン（コア）
- [ ] NMLParser実装（XMLパーサー）
- [ ] NMLExecutor実装（全タグ対応）
- [ ] テキスト表示エンジン（タイプライター効果）
- [ ] ローカル変数・条件分岐
- [ ] ブログ入力 → キーワードマッチング

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
| NML解析 | fast-xml-parser | 軽量XMLパーサー |
