import test from "node:test";
import assert from "node:assert/strict";
import { calculateXWeightedLength, formatPostDraft, draftFromDevLog } from "../src/drafter.ts";

test("calculateXWeightedLength correctly calculates ASCII vs Japanese characters", () => {
  assert.equal(calculateXWeightedLength("Hello"), 5);
  assert.equal(calculateXWeightedLength("こんにちは"), 10);
  assert.equal(calculateXWeightedLength("AI開発: 完了"), 12);
});

test("formatPostDraft keeps short text as single post with hashtags", () => {
  const shortText = "本日はCodexでカレンダー連携ツールを実装。";
  const draft = formatPostDraft(shortText, ["AI開発"]);
  assert.notEqual(draft.singlePost, undefined);
  assert.equal(draft.singlePost?.includes("#AI開発"), true);
  assert.equal(draft.threadPosts, undefined);
});

test("formatPostDraft splits long text into thread", () => {
  const longText = `
1. 会議の音声アンケートツールに自由記述設問とGoogle Forms連携機能を追加しました。
2. 宅配メールを解析してGoogleカレンダーに自動登録するdelivery-calendar-syncを開発。
3. 学校と個人のカレンダーを統合してHermesから予定を参照できるcalendar-bridgeを実装。
4. FitbitやApple Watchのバイタルから毎日の通塾・学習判断を行うhealth-vital-aiを整備。
5. Google Meetの議事録を自動検知してDiscordに配信するmeeting-minutes-botを構築しました。
`.trim();

  const draft = formatPostDraft(longText, ["成果報告"]);
  assert.equal(draft.singlePost, undefined);
  assert.notEqual(draft.threadPosts, undefined);
  assert.equal(draft.threadPosts!.length >= 2, true);
  assert.equal(draft.threadPosts![0].startsWith("(1/"), true);
});

test("draftFromDevLog creates concise bullet summary from markdown log", () => {
  const log = `
# 本日の作業
- 音声アンケートのOSS切り出し完了
- Hermes Discord接続診断スクリプト作成
- 富山訪問プランの時刻表確認
`;
  const draft = draftFromDevLog(log, "2026-10-04");
  const post = draft.singlePost || (draft.threadPosts ? draft.threadPosts[0] : "");
  assert.equal(post.includes("音声アンケート"), true);
  assert.equal(post.includes("Hermes"), true);
});

test("calculateXWeightedLength correctly handles URLs and emoji sequences", () => {
  // URLs count as 23 chars regardless of raw length
  const urlPost = "リンク: https://github.com/project/long-repository-path-example";
  // "リンク: " (8) + 23 = 31
  assert.equal(calculateXWeightedLength(urlPost), 31);

  // Emojis: simple and complex ZWJ family emojis count as 2
  assert.equal(calculateXWeightedLength("👋"), 2);
  assert.equal(calculateXWeightedLength("👨‍👩‍👧‍👦"), 2);
});

test("formatPostDraft splits long continuous text without newlines into valid <=280 posts", () => {
  const continuousLongText = "吾輩は猫である。名前はまだ無い。どこで生れたかとんと見当がつかぬ。何でも薄暗いじめじめした所でニャーニャー泣いていた事だけは記憶している。吾輩はここで始めて人間というものを見た。しかもあとで聞くとそれは書生という人間中で一番獰悪な種族であったそうだ。この書生というのは時々我々を捕えて煮て食うという話である。しかしその当時は何という考もなかったから別段恐しいとも思わなかった。".repeat(2);

  const draft = formatPostDraft(continuousLongText, ["名作文学", "AI朗読"]);
  assert.notEqual(draft.threadPosts, undefined);
  assert.equal(draft.threadPosts!.length >= 2, true);

  for (let i = 0; i < draft.threadPosts!.length; i++) {
    const post = draft.threadPosts![i];
    const len = calculateXWeightedLength(post);
    assert.equal(len <= 280, true, `Thread post ${i + 1} length (${len}) must not exceed 280`);
  }
});

test("draftFromDevLog and formatPostDraft safely handle complex emojis and never exceed 280 with multiple tags", () => {
  const emojiLog = "✨🚀 開発アップデート: 新しいAIエージェント🤖が元気に稼働中！🔥💡 ".repeat(10);
  const draft = draftFromDevLog(emojiLog);
  const post = draft.singlePost || draft.threadPosts?.[0];
  assert.notEqual(post, undefined);
  // Verify no dangling surrogate pairs (e.g. \uD83D without low surrogate)
  assert.equal(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/.test(post!), false);

  const longTags = ["AI開発", "バイブコーディング", "TypeScript", "DeepSeekHarness", "StellaAI"];
  const longText = "今日の開発進捗です。複数のモデルによるレビューを受け、カレンダー連携やヘルスケアデータ分析の堅牢性を大幅に向上させました。".repeat(3);
  const threadDraft = formatPostDraft(longText, longTags);
  assert.notEqual(threadDraft.threadPosts, undefined);
  for (const p of threadDraft.threadPosts!) {
    assert.equal(calculateXWeightedLength(p) <= 280, true, `Post exceeded 280: ${p}`);
  }
});
