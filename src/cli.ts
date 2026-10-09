#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { formatPostDraft, draftFromDevLog } from "./drafter.ts";
import { loadQueue, saveQueue, enqueuePost } from "./queue.ts";
import { publishToX } from "./client.ts";
import { generateLaunchdPlist } from "./daemon.ts";

function printUsage() {
  console.log(`
x-scheduler - Scheduled X (Twitter) Post Automation

Usage:
  x-scheduler add --text "Post content" [--time "YYYY-MM-DDTHH:mm:ss+09:00"] [--queue <path>]
  x-scheduler draft-from-log --file <log.md> [--enqueue] [--queue <path>]
  x-scheduler list [--queue <path>]
  x-scheduler run-pending [--dry-run] [--queue <path>]
  x-scheduler export-launchd [--queue <path>]
`);
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
    printUsage();
    process.exit(0);
  }

  const command = args[0];
  let queuePath = ".x-queue.json";

  for (let i = 1; i < args.length; i++) {
    if (args[i] === "--queue" && args[i + 1]) queuePath = args[++i];
  }

  if (command === "add") {
    let text = "";
    let time = "";
    for (let i = 1; i < args.length; i++) {
      if (args[i] === "--text" && args[i + 1]) text = args[++i];
      else if (args[i] === "--time" && args[i + 1]) time = args[++i];
    }
    if (!text) {
      console.error("Error: --text is required.");
      process.exit(1);
    }
    const queue = loadQueue(queuePath);
    const post = enqueuePost(queue, text, time);
    saveQueue(queuePath, queue);
    console.log(`Enqueued post: [${post.id}] for ${post.scheduledTime}`);
    console.log(`Content: ${post.text}`);
    return;
  }

  if (command === "draft-from-log") {
    let filePath = "";
    let shouldEnqueue = false;
    for (let i = 1; i < args.length; i++) {
      if (args[i] === "--file" && args[i + 1]) filePath = args[++i];
      else if (args[i] === "--enqueue") shouldEnqueue = true;
    }
    if (!filePath || !fs.existsSync(filePath)) {
      console.error("Error: --file is required and must exist.");
      process.exit(1);
    }
    const content = fs.readFileSync(filePath, "utf-8");
    const draft = draftFromDevLog(content);
    const textToPost = draft.singlePost || (draft.threadPosts ? draft.threadPosts[0] : "");
    console.log("=== Drafted Post ===");
    console.log(textToPost);
    console.log(`Weighted length: ${draft.charCountWeighted} / 280`);

    if (shouldEnqueue) {
      const queue = loadQueue(queuePath);
      const post = enqueuePost(queue, textToPost);
      saveQueue(queuePath, queue);
      console.log(`\nEnqueued for slot: ${post.scheduledTime}`);
    }
    return;
  }

  if (command === "list") {
    const queue = loadQueue(queuePath);
    console.log(`=== X Scheduled Posts Queue (${queue.posts.length} items) ===`);
    if (queue.posts.length === 0) {
      console.log("No scheduled posts.");
      return;
    }
    for (const p of queue.posts) {
      console.log(`[${p.status.toUpperCase()}] ${p.scheduledTime} (ID: ${p.id})`);
      console.log(`  ${p.text.substring(0, 80).replace(/\n/g, " ")}...\n`);
    }
    return;
  }

  if (command === "run-pending") {
    const dryRun = args.includes("--dry-run");
    const queue = loadQueue(queuePath);
    const now = Date.now();
    let processed = 0;

    for (const p of queue.posts) {
      if (p.status !== "pending") continue;
      const targetTimeMs = new Date(p.scheduledTime).getTime();
      if (targetTimeMs <= now) {
        console.log(`Publishing post [${p.id}]...`);
        const result = await publishToX(p.text, { dryRun });
        if (result.success) {
          p.status = "posted";
          p.postedAt = new Date().toISOString();
          p.tweetId = result.tweetId;
          console.log(`-> Posted successfully (tweetId: ${result.tweetId}, dryRun: ${Boolean(result.dryRun)})`);
          processed++;
        } else {
          p.status = "failed";
          p.error = result.error;
          console.error(`-> Failed: ${result.error}`);
        }
      }
    }

    saveQueue(queuePath, queue);
    console.log(`Processed ${processed} pending posts.`);
    return;
  }

  if (command === "export-launchd") {
    const absScript = path.resolve(process.argv[1]);
    const absQueue = path.resolve(queuePath);
    console.log(generateLaunchdPlist(absScript, absQueue));
    return;
  }

  console.error(`Unknown command: ${command}`);
  printUsage();
  process.exit(1);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
