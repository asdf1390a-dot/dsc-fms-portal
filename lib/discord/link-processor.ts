// Discord Link Processor
// Handles URL extraction, analysis, and storage

import { supabase } from '@/lib/supabaseClient';

export interface LinkMetadata {
  url: string;
  title?: string;
  description?: string;
  thumbnail?: string;
  type: 'youtube' | 'github' | 'twitter' | 'generic';
  duration?: number; // for videos
  author?: string;
  fetched_at: string;
}

export async function extractAndProcessLinks(
  content: string,
  channelId: string,
  messageId: string,
  authorId?: string
) {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const urls = content.match(urlRegex) || [];

  const results: any[] = [];
  for (const url of urls) {
    try {
      const metadata = await fetchLinkMetadata(url);
      if (!metadata) continue;

      const record = await storeLinkMetadata({
        url,
        ...metadata,
        channel_id: channelId,
        message_id: messageId,
        author_id: authorId,
      });

      results.push(record);
    } catch (err) {
      console.error(`[link-processor] Error processing ${url}:`, err);
    }
  }

  return results;
}

export async function fetchLinkMetadata(url: string): Promise<Partial<LinkMetadata> | null> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    });

    if (!response.ok) {
      console.warn(`[fetchLinkMetadata] Failed to fetch ${url}: ${response.status}`);
      return null;
    }

    const html = await response.text();

    // Extract basic metadata
    const title = extractTitle(html);
    const description = extractDescription(html);
    const thumbnail = extractThumbnail(html, url);
    const type = detectLinkType(url);

    // YouTube specific processing
    let duration;
    let author;
    if (type === 'youtube') {
      const durationStr = extractYouTubeDuration(html);
      duration = durationStr ? parseYouTubeDuration(durationStr) : undefined;
      author = extractYouTubeChannel(html);
    }

    return {
      title,
      description,
      thumbnail,
      type,
      duration,
      author,
      fetched_at: new Date().toISOString(),
    };
  } catch (err) {
    console.error(`[fetchLinkMetadata] Error: ${url}`, err);
    return null;
  }
}

export async function storeLinkMetadata(data: any) {
  const { data: record, error } = await supabase.from('discord_link_storage').insert([
    {
      url: data.url,
      channel_id: data.channel_id,
      message_id: data.message_id,
      author_id: data.author_id || null,
      title: data.title,
      description: data.description,
      thumbnail: data.thumbnail,
      type: data.type,
      duration: data.duration,
      author: data.author,
      metadata: {
        fetched_at: data.fetched_at,
      },
      created_at: new Date().toISOString(),
    },
  ]);

  if (error) {
    throw new Error(`Storage error: ${error.message}`);
  }

  return record?.[0];
}

// Metadata extraction helpers
function extractTitle(html: string): string | undefined {
  // Try Open Graph
  let match = html.match(/<meta\s+property="og:title"\s+content="([^"]+)"/i);
  if (match) return match[1];

  // Try standard meta
  match = html.match(/<meta\s+name="title"\s+content="([^"]+)"/i);
  if (match) return match[1];

  // Try HTML title tag
  match = html.match(/<title>([^<]+)<\/title>/i);
  if (match) return match[1];

  return undefined;
}

function extractDescription(html: string): string | undefined {
  // Try Open Graph
  let match = html.match(/<meta\s+property="og:description"\s+content="([^"]+)"/i);
  if (match) return match[1];

  // Try standard meta
  match = html.match(/<meta\s+name="description"\s+content="([^"]+)"/i);
  if (match) return match[1];

  return undefined;
}

function extractThumbnail(html: string, url: string): string | undefined {
  // Try Open Graph
  let match = html.match(/<meta\s+property="og:image"\s+content="([^"]+)"/i);
  if (match) return match[1];

  // YouTube video ID from URL
  if (url.includes('youtube.com') || url.includes('youtu.be')) {
    const videoId = extractYouTubeVideoId(url);
    if (videoId) {
      return `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
    }
  }

  return undefined;
}

function extractYouTubeVideoId(url: string): string | undefined {
  // Format: https://www.youtube.com/watch?v=ID
  let match = url.match(/[?&]v=([^&]+)/);
  if (match) return match[1];

  // Format: https://youtu.be/ID
  match = url.match(/youtu\.be\/([^?]+)/);
  if (match) return match[1];

  return undefined;
}

function extractYouTubeDuration(html: string): string | undefined {
  // Look for duration in JSON-LD
  const jsonLdMatch = html.match(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/i);
  if (jsonLdMatch) {
    try {
      const jsonLd = JSON.parse(jsonLdMatch[1]);
      if (jsonLd.duration) return jsonLd.duration;
    } catch (err) {
      // Ignore JSON parsing errors
    }
  }

  // Look for duration in meta tags
  const match = html.match(/<meta\s+itemprop="duration"\s+content="([^"]+)"/i);
  if (match) return match[1];

  return undefined;
}

function parseYouTubeDuration(durationStr: string): number {
  // Format: ISO 8601 duration like PT10M30S
  const match = durationStr.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;

  const hours = parseInt(match[1] || '0', 10);
  const minutes = parseInt(match[2] || '0', 10);
  const seconds = parseInt(match[3] || '0', 10);

  return hours * 3600 + minutes * 60 + seconds;
}

function extractYouTubeChannel(html: string): string | undefined {
  const match = html.match(/<link\s+itemprop="name"\s+content="([^"]+)"/i);
  if (match) return match[1];

  return undefined;
}

function detectLinkType(url: string): 'youtube' | 'github' | 'twitter' | 'generic' {
  if (url.includes('youtube.com') || url.includes('youtu.be')) return 'youtube';
  if (url.includes('github.com')) return 'github';
  if (url.includes('twitter.com') || url.includes('x.com')) return 'twitter';
  return 'generic';
}
