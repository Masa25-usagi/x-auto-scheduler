import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { loadQueue, saveQueue, enqueuePost, getNextAvailableSlot } from "../src/queue.ts";

test("loadQueue, enqueuePost, and saveQueue properly manage scheduled posts", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "x-queue-test-"));
  const queuePath = path.join(tmpDir, "queue.json");

  const queue1 = loadQueue(queuePath);
  assert.equal(queue1.posts.length, 0);

  const post1 = enqueuePost(queue1, "Hello from Codex!", "2026-10-04T12:30:00+09:00");
  assert.equal(post1.status, "pending");
  assert.equal(post1.scheduledTime, "2026-10-04T12:30:00+09:00");
  assert.equal(queue1.posts.length, 1);

  saveQueue(queuePath, queue1);

  const queue2 = loadQueue(queuePath);
  assert.equal(queue2.posts.length, 1);
  assert.equal(queue2.posts[0].text, "Hello from Codex!");

  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test("getNextAvailableSlot allocates valid slot without colliding with pending posts", () => {
  const queue = {
    defaultSlotsJst: ["08:30", "12:30", "19:30"],
    posts: []
  };

  const fakeNow = new Date("2026-10-04T09:00:00+09:00");
  const slot1 = getNextAvailableSlot(queue, fakeNow);
  // Next slot today after 09:00 JST is 12:30 JST
  assert.equal(slot1, "2026-10-04T12:30:00+09:00");

  enqueuePost(queue, "First", slot1);
  const slot2 = getNextAvailableSlot(queue, fakeNow);
  // Next after 12:30 is 19:30 JST
  assert.equal(slot2, "2026-10-04T19:30:00+09:00");
});
