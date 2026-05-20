import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface TrendingItem {
  source: string;
  title: string;
  description: string;
  url: string;
  relevance: string[];
}

async function fetchGitHubTrending(): Promise<TrendingItem[]> {
  try {
    const response = await fetch('https://api.github.com/search/repositories?q=created:>2026-05-13&sort=stars&order=desc&per_page=5', {
      headers: {
        'Accept': 'application/vnd.github.v3+json',
      },
    });

    if (!response.ok) return [];

    const data = await response.json();
    return (data.items || []).map((item: any) => ({
      source: 'GitHub',
      title: item.full_name,
      description: item.description || 'No description',
      url: item.html_url,
      relevance: ['Web-Builder', 'Evaluator', 'Planner'],
    }));
  } catch (error) {
    console.error('GitHub fetch error:', error);
    return [];
  }
}

async function fetchProductHunt(): Promise<TrendingItem[]> {
  try {
    const response = await fetch('https://api.producthunt.com/v2/posts?order_by=newest', {
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) return [];

    const data = await response.json();
    return (data.data || []).slice(0, 5).map((item: any) => ({
      source: 'Product Hunt',
      title: item.name,
      description: item.tagline,
      url: `https://producthunt.com/posts/${item.slug}`,
      relevance: ['Web-Builder', 'Evaluator'],
    }));
  } catch (error) {
    console.error('Product Hunt fetch error:', error);
    return [];
  }
}

async function fetchDevTo(): Promise<TrendingItem[]> {
  try {
    const response = await fetch('https://dev.to/api/articles?per_page=5&sort_by=published_at', {
      headers: {
        'api-key': process.env.DEV_TO_API_KEY || '',
      },
    });

    if (!response.ok) return [];

    const data = await response.json();
    return (Array.isArray(data) ? data : []).map((item: any) => ({
      source: 'Dev.to',
      title: item.title,
      description: item.description || item.excerpt,
      url: item.url,
      relevance: ['Web-Builder', 'Data-Analyst', 'Translator'],
    }));
  } catch (error) {
    console.error('Dev.to fetch error:', error);
    return [];
  }
}

async function fetchNpmTrends(): Promise<TrendingItem[]> {
  try {
    const response = await fetch('https://api.npmjs.org/downloads/point/last-week', {
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) return [];

    // npm trends data format varies; simplified approach
    return [{
      source: 'npm Trends',
      title: 'Weekly Downloads Update',
      description: 'Check trending packages on npm trends',
      url: 'https://www.npmtrends.com',
      relevance: ['Web-Builder', 'Evaluator', 'Planner'],
    }];
  } catch (error) {
    console.error('npm fetch error:', error);
    return [];
  }
}

async function sendTelegramMessage(message: string): Promise<boolean> {
  try {
    const response = await fetch('https://api.telegram.org/bot' + process.env.TELEGRAM_BOT_TOKEN + '/sendMessage', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: process.env.TELEGRAM_CHAT_ID,
        text: message,
        parse_mode: 'HTML',
      }),
    });

    return response.ok;
  } catch (error) {
    console.error('Telegram send error:', error);
    return false;
  }
}

function formatMessageForRole(items: TrendingItem[], role: string): string {
  const roleItems = items.filter(item => item.relevance.includes(role));
  if (roleItems.length === 0) return '';

  let message = `<b>${role} — 주간 기술 트렌드</b>\n\n`;
  roleItems.forEach((item, idx) => {
    message += `${idx + 1}. <b>${item.title}</b>\n`;
    message += `   📝 ${item.description}\n`;
    message += `   🔗 <a href="${item.url}">바로가기</a>\n\n`;
  });

  return message;
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch data from all sources in parallel
    const [gitHub, productHunt, devTo, npm] = await Promise.all([
      fetchGitHubTrending(),
      fetchProductHunt(),
      fetchDevTo(),
      fetchNpmTrends(),
    ]);

    const allItems = [...gitHub, ...productHunt, ...devTo, ...npm];

    if (allItems.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No trending data available',
        count: 0,
      });
    }

    // Define roles
    const roles = [
      'Web-Builder',
      'Evaluator',
      'Data-Analyst',
      'Translator',
      'Planner',
    ];

    let sentCount = 0;

    // Send messages to each role
    for (const role of roles) {
      const roleMessage = formatMessageForRole(allItems, role);
      if (roleMessage) {
        const success = await sendTelegramMessage(roleMessage);
        if (success) sentCount++;
      }
    }

    // Save collection log to Supabase
    try {
      await supabase.from('auto_info_collections').insert({
        collected_at: new Date().toISOString(),
        item_count: allItems.length,
        sent_count: sentCount,
        sources: JSON.stringify({
          github: gitHub.length,
          producthunt: productHunt.length,
          devto: devTo.length,
          npm: npm.length,
        }),
      });
    } catch (dbError) {
      console.error('Database log error:', dbError);
      // Continue even if logging fails
    }

    return NextResponse.json({
      success: true,
      message: 'Auto-info collection completed',
      items_collected: allItems.length,
      messages_sent: sentCount,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Auto-info collection error:', error);
    return NextResponse.json(
      {
        error: 'Failed to process auto-info collection',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
