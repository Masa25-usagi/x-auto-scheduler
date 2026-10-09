export interface XPostResult {
  success: boolean;
  tweetId?: string;
  error?: string;
  dryRun?: boolean;
}

export async function publishToX(text: string, options: { dryRun?: boolean; apiKey?: string } = {}): Promise<XPostResult> {
  if (options.dryRun || !process.env.X_API_KEY) {
    // Dry-run mode
    const fakeId = `tweet-${Date.now()}`;
    return {
      success: true,
      tweetId: fakeId,
      dryRun: true
    };
  }

  try {
    const res = await fetch("https://api.twitter.com/2/tweets", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.X_API_BEARER_TOKEN || process.env.X_API_KEY}`
      },
      body: JSON.stringify({ text })
    });

    if (!res.ok) {
      const errBody = await res.text();
      return { success: false, error: `HTTP ${res.status}: ${errBody}` };
    }

    const data = await res.json() as any;
    return {
      success: true,
      tweetId: data?.data?.id
    };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
