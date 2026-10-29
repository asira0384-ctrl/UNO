# PARTY ROOM v2.0 — GitHub / Railway 設定

今までのUNOを9ゲームのハブにした更新版です。既存リポジトリに上書きできます。
Discordの設定が終わるまでは、ログイン画面が表示され、ゲームに参加できません。

## 1. GitHubへアップロード

ZIPを解凍し、**中身をリポジトリ直下**に入れてください。
ZIPそのものや、解凍した親フォルダーをそのままアップロードしないでください。

GitHubブラウザー画面の100ファイル制限に合わせ、次の順で別々にUpload filesします。

1. 直下のファイルと `src`・`scripts`・`tests` フォルダー
2. `public` フォルダー
3. `public1` フォルダー
4. `public2` フォルダー

`public` は画面コード、`public1` は画像、`public2` はサウンドです。それぞれ90ファイル未満です。
フォルダー名の小文字を保ってください。**`Public`へ名前を変えないでください。**
3つのフォルダーをサーバーが同じWebサイトとして配信するため、音や画像のURLは変わりません。
旧バージョンの使われないファイルが残っていても起動に使いません。`server.js` も新しいサーバーを起動する互換入口に更新済みです。

## 2. Discordアプリを作成

1. https://discord.com/developers/applications で **New Application** を作成。
2. General Informationの **Application ID** を控える → `DISCORD_CLIENT_ID`。
3. OAuth2の **Client Secret** を発行・コピー → `DISCORD_CLIENT_SECRET`。
4. Botの画面でBotを作り、**Token** を発行・コピー → `DISCORD_BOT_TOKEN`。
5. Discordの「ユーザー設定 → 詳細設定 → 開発者モード」をON。自分のサーバーを右クリック／長押しし「サーバーIDをコピー」 → `DISCORD_GUILD_ID`。
6. OAuth2 URL Generatorで **bot** を選択。Bot Permissionsは **Create Instant Invite（招待を作成）** を選び、生成されたURLを開いて**自分のサーバーにBotを追加**。
7. OAuth2 → Redirectsに、次のURLを追加して保存。

   `https://あなたのドメイン/auth/discord/callback`

Botは、OAuth2でログインするアプリと**同じDiscordアプリ**のものを使ってください。
この実装は `identify` と `guilds.join` のみで、Discordのメール・DM・フレンド一覧は取得しません。
ゲームのフレンド一覧はゲーム内で申請・承認する別の一覧です。
特権Gateway IntentやAdministrator権限は不要です。

## 3. Railway Variables

| 変数名 | 入れる値 |
| --- | --- |
| `APP_URL` | `https://あなたのドメイン`（末尾の `/` なし） |
| `DISCORD_CLIENT_ID` | Application ID |
| `DISCORD_CLIENT_SECRET` | OAuth2のClient Secret |
| `DISCORD_BOT_TOKEN` | BotのToken |
| `DISCORD_GUILD_ID` | 参加先のサーバーID |
| `DISCORD_GUILD_NAME` | ログイン画面に表示するサーバー名 |
| `DATA_DIR` | `/data` |
| `NODE_ENV` | `production` |

SecretとTokenは**RailwayのVariablesに直接入力**してください。GitHubのファイルにも、チャットにも貼らなくて大丈夫です。
`APP_URL` のドメインと、Discordに登録するRedirectのドメインは完全にそろえてください。

### Railwayサービス設定

| 項目 | 設定 |
| --- | --- |
| Builder | Dockerfile（自動判定） |
| Start Command | `npm start`、または空欄でDockerfileのCMDを使用 |
| Healthcheck Path | `/health` |
| Replicas | **1** |
| Volume | マウント先 **`/data`** |

Volumeを付けると、アカウント・フレンド・チャット・パーティー・進行中の対戦を再デプロイ後も保持します。
この版は1つのサーバーで対戦状態を管理するので、Replicasは1にしてください。
`DEV_AUTH` は設定不要です。本番環境では開発用ログインは使えません。

## 4. 再デプロイして確認

1. RailwayでDeployが成功したら `/health` が `{"ok":true,"version":"2.0.0"}` を返すことを確認。
2. ホームの「Discordでログイン」を押し、Discordの確認画面で名前の取得・サーバー参加を許可。
3. DiscordのID・名前・512pxアイコンがゲームに表示されること、サーバーに参加できることを確認。
4. 別のDiscordアカウントでもログインし、同じゲームの公開マッチを探す。将棋・オセロ・スピードは2人が集まり次第開始、他は2人以上で約15秒後に開始（最大10人）。CPUは公開マッチに自動追加しません。
5. フレンド申請→承認→パーティー招待→個人／パーティー／ゲームチャットを確認。

Discordがサーバー参加を拒否した場合はログインを完了しません。Botの所属先・Create Instant Invite権限・同じアプリのTokenかを確認してください。サーバーのルール同意画面がある場合はDiscord側で完了してください。

## アプリとして開く

iPhone：Safariの共有 → ホーム画面に追加。
Android：Chromeのメニュー → アプリをインストール。
PWAなのでストアへの登録は不要です。オンライン対戦にはインターネット接続が必要です。

## 画面の向き

ホームまたは対戦中の設定 → 自動／縦／横。
横を選ぶと、スマホ本体を傾けずに横向きのUIを表示します。設定は端末に保存されます。
16e（390×844）・16（393×852）相当の画面寸法と安全領域を使って確認しています。実機のSafariとDiscord認証の最終確認は上記の設定後に行ってください。

## 基本ルールと追加ルール

通常のUNOは1回に1枚。まとめ出しやドローの重ね出しは標準ルールではありません。
CPU対戦・プライベートゲームの設定で「同じ数字のまとめ出し」等をONにできます。
公開マッチは同じ標準設定で集めます。
順位モードは、上がった人から1位・2位…を確定して最後まで続ける、このアプリの追加ルールです。
公式ラウンド終了モードは1人が上がると終了し、残り全員の手札点を勝者へ加算。次のラウンドで累積500点を目指せます。

## 参考にした一次資料

- Mattel UNO説明書： https://service.mattel.com/instruction_sheets/W2085.pdf
- 日本将棋連盟： https://www.shogi.or.jp/match/taikyoku_rules/
- World Othello Federation： https://www.worldothello.org/about/about-othello/othello-rules/official-rules/english
- Discord OAuth2： https://docs.discord.com/developers/topics/oauth2
- Discord Add Guild Member： https://docs.discord.com/developers/resources/guild#add-guild-member
