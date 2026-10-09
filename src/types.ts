export interface ScheduledPost {
  id: string;
  text: string;
  scheduledTime: string; // ISO 8601 JST
  status: "pending" | "posted" | "failed";
  replyToTweetId?: string;
  postedAt?: string;
  tweetId?: string;
  error?: string;
  tags?: string[];
}

export interface PostQueue {
  defaultSlotsJst: string[]; // e.g. ["08:30", "12:30", "19:30"]
  posts: ScheduledPost[];
}

export interface PostDraft {
  singlePost?: string;
  threadPosts?: string[];
  charCountWeighted: number;
}
