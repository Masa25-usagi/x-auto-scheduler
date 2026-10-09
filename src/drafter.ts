import type { PostDraft } from "./types.ts";

const segmenter = new Intl.Segmenter("ja", { granularity: "grapheme" });

/**
 * Calculates Twitter / X weighted length.
 * Japanese/CJK, emojis and complex graphemes = 2, ASCII/alphanumeric = 1.
 * URLs (http:// or https://) count as 23 characters per Twitter specifications.
 * Max allowed by Twitter is 280 weighted units.
 */
export function calculateXWeightedLength(text: string): number {
  if (!text) return 0;

  // 1. Twitter wraps all URLs into t.co links of 23 characters
  const urlRegex = /https?:\/\/[^\s]+/gi;
  const urls = text.match(urlRegex) || [];
  const textWithoutUrls = text.replace(urlRegex, "");
  let length = urls.length * 23;

  for (const item of segmenter.segment(textWithoutUrls)) {
    const g = item.segment;
    const code = g.codePointAt(0) || 0;
    if (code <= 0x00ff) {
      length += 1;
    } else {
      length += 2;
    }
  }

  return length;
}

/**
 * Truncates text by grapheme count safely without breaking surrogate pairs or emoji sequences
 */
export function truncateByGraphemes(text: string, maxGraphemes: number): string {
  let count = 0;
  let result = "";
  for (const item of segmenter.segment(text)) {
    if (count >= maxGraphemes) break;
    result += item.segment;
    count++;
  }
  return result;
}

/**
 * Formats and validates post, splitting into thread if necessary
 */
export function formatPostDraft(text: string, defaultTags: string[] = ["AI開発", "バイブコーディング"]): PostDraft {
  const clean = text.trim();
  const tagStr = defaultTags.length > 0 ? "\n\n" + defaultTags.map(t => `#${t}`).join(" ") : "";
  const fullText = clean + tagStr;
  const weighted = calculateXWeightedLength(fullText);

  if (weighted <= 280) {
    return {
      singlePost: fullText,
      charCountWeighted: weighted
    };
  }

  // Budget space for thread prefix (e.g. "(12/12) " ≈ 10) and suffix tagStr
  const tagWeight = calculateXWeightedLength(tagStr);
  const prefixReserve = 12;
  const targetMaxPerChunk = Math.max(40, Math.min(260, 280 - prefixReserve - Math.max(0, tagWeight)));

  const rawSegments = clean.split("\n");
  const subSegments: string[] = [];

  for (const rawSeg of rawSegments) {
    const trimmed = rawSeg.trim();
    if (!trimmed) continue;

    if (calculateXWeightedLength(trimmed) <= targetMaxPerChunk) {
      subSegments.push(trimmed);
    } else {
      // Split by sentence punctuation
      const sentenceParts = trimmed.split(/(?<=[。！？!?])\s*/);
      for (const part of sentenceParts) {
        if (!part) continue;
        if (calculateXWeightedLength(part) <= targetMaxPerChunk) {
          subSegments.push(part);
        } else {
          // Hard split long unbroken string grapheme-by-grapheme
          let piece = "";
          for (const item of segmenter.segment(part)) {
            const g = item.segment;
            if (calculateXWeightedLength(piece + g) <= targetMaxPerChunk) {
              piece += g;
            } else {
              if (piece) subSegments.push(piece);
              piece = g;
            }
          }
          if (piece) subSegments.push(piece);
        }
      }
    }
  }

  const chunks: string[] = [];
  let current = "";

  for (const seg of subSegments) {
    const candidate = current ? `${current}\n${seg}` : seg;
    if (calculateXWeightedLength(candidate) <= targetMaxPerChunk) {
      current = candidate;
    } else {
      if (current) chunks.push(current);
      current = seg;
    }
  }
  if (current) chunks.push(current);

  const total = chunks.length;
  const threadPosts: string[] = [];

  for (let idx = 0; idx < total; idx++) {
    const chunk = chunks[idx];
    const prefix = total > 1 ? `(${idx + 1}/${total}) ` : "";
    const suffix = idx === total - 1 ? tagStr : "";
    const candidatePost = `${prefix}${chunk}${suffix}`;

    // Guarantee that candidatePost does not exceed 280 under any circumstances
    if (calculateXWeightedLength(candidatePost) <= 280) {
      threadPosts.push(candidatePost);
    } else {
      // If still over 280, trim chunk safely by graphemes to fit within available budget
      const maxAvailable = 280 - calculateXWeightedLength(prefix) - calculateXWeightedLength(suffix);
      let trimmedChunk = "";
      for (const item of segmenter.segment(chunk)) {
        if (calculateXWeightedLength(trimmedChunk + item.segment) <= maxAvailable) {
          trimmedChunk += item.segment;
        } else {
          break;
        }
      }
      threadPosts.push(`${prefix}${trimmedChunk}${suffix}`);
    }
  }

  return {
    threadPosts,
    charCountWeighted: weighted
  };
}

/**
 * Creates an X post draft from developer notes / markdown log
 */
export function draftFromDevLog(logContent: string, dateStr?: string): PostDraft {
  const date = dateStr || new Date().toISOString().split("T")[0];

  // Look for summary or bullet points
  const bulletLines: string[] = [];
  for (const line of logContent.split("\n")) {
    const trimmed = line.trim();
    if (trimmed.startsWith("- ") || trimmed.startsWith("* ") || trimmed.startsWith("・")) {
      bulletLines.push(trimmed.replace(/^[-*・]\s*/, ""));
    }
  }

  let body = `【本日のAI開発・進捗メモ (${date})】\n`;
  if (bulletLines.length > 0) {
    body += bulletLines.slice(0, 3).map(b => `・${b}`).join("\n");
  } else {
    // Truncate safely by graphemes (no broken surrogate pairs)
    const plain = logContent.replace(/[#*`\n]/g, " ").trim();
    body += truncateByGraphemes(plain, 80) + "...";
  }

  return formatPostDraft(body);
}
