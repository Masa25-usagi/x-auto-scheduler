import fs from "node:fs";
import type { PostQueue, ScheduledPost } from "./types.ts";

export const DEFAULT_SLOTS = ["08:30", "12:30", "19:30"];

export function loadQueue(queuePath: string): PostQueue {
  if (fs.existsSync(queuePath)) {
    try {
      return JSON.parse(fs.readFileSync(queuePath, "utf-8"));
    } catch {
      return { defaultSlotsJst: DEFAULT_SLOTS, posts: [] };
    }
  }
  return { defaultSlotsJst: DEFAULT_SLOTS, posts: [] };
}

export function saveQueue(queuePath: string, queue: PostQueue): void {
  fs.writeFileSync(queuePath, JSON.stringify(queue, null, 2), "utf-8");
}

/**
 * Finds the next available scheduled time slot in JST
 */
export function getNextAvailableSlot(queue: PostQueue, fromTime = new Date()): string {
  const existingPendingTimes = new Set(
    queue.posts.filter(p => p.status === "pending").map(p => p.scheduledTime)
  );

  const jstNow = new Date(fromTime.getTime() + 9 * 3600 * 1000);
  const slots = queue.defaultSlotsJst.length > 0 ? queue.defaultSlotsJst : DEFAULT_SLOTS;

  // Check today and next 7 days
  for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
    const candidateDay = new Date(jstNow.getTime() + dayOffset * 24 * 3600 * 1000);
    const dateStr = candidateDay.toISOString().split("T")[0];

    for (const slot of slots) {
      const [sh, sm] = slot.split(":").map(Number);
      const slotTimeJst = `${dateStr}T${sh.toString().padStart(2, "0")}:${sm.toString().padStart(2, "0")}:00+09:00`;

      // Convert slotTimeJst to UTC timestamp to check if it is in the future
      const [y, m, d] = dateStr.split("-").map(Number);
      const slotUtcMs = Date.UTC(y, m - 1, d, sh - 9, sm, 0);

      if (slotUtcMs > fromTime.getTime() && !existingPendingTimes.has(slotTimeJst)) {
        return slotTimeJst;
      }
    }
  }

  // Fallback 24 hours later
  return new Date(fromTime.getTime() + 24 * 3600 * 1000).toISOString();
}

export function enqueuePost(
  queue: PostQueue,
  text: string,
  explicitScheduledTime?: string,
  tags?: string[]
): ScheduledPost {
  const scheduledTime = explicitScheduledTime || getNextAvailableSlot(queue);
  const newPost: ScheduledPost = {
    id: `x-post-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    text,
    scheduledTime,
    status: "pending",
    tags
  };

  queue.posts.push(newPost);
  queue.posts.sort((a, b) => new Date(a.scheduledTime).getTime() - new Date(b.scheduledTime).getTime());
  return newPost;
}
