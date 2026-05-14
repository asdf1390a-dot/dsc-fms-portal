import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/travel/supabase-client';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const now = new Date();
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    const { data: travels } = await supabaseAdmin
      .from('travels')
      .select(`
        id,
        user_id,
        name,
        start_date,
        end_date,
        travel_members(user_id),
        travel_notification_rules(*)
      `)
      .lte('start_date', tomorrow.toISOString().split('T')[0])
      .gte('start_date', now.toISOString().split('T')[0])
      .eq('status', 'upcoming');

    if (!travels || travels.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No travels to notify',
        count: 0,
      });
    }

    let notificationCount = 0;

    for (const travel of travels) {
      const rules = (travel as any).travel_notification_rules || [];
      const members = (travel as any).travel_members || [];
      const userIds = [travel.user_id, ...members.map((m: any) => m.user_id)];

      for (const rule of rules) {
        if (!rule.is_enabled) continue;

        const notification = {
          travel_id: travel.id,
          rule_type: rule.rule_type,
          rule_config: rule.rule_config,
          notification_type: 'auto_rule',
          title: `여행 준비: ${travel.name}`,
          message: `${travel.name} 여행이 ${Math.ceil((new Date(travel.start_date).getTime() - now.getTime()) / (1000 * 60 * 60 * 24))}일 남았습니다.`,
          trigger_date: now.toISOString().split('T')[0],
          channels: JSON.stringify({
            in_app: true,
            email: true,
            telegram: true,
          }),
          is_sent: true,
          sent_at: now.toISOString(),
        };

        for (const userId of userIds) {
          const { error } = await supabaseAdmin
            .from('travel_notifications')
            .insert({
              ...notification,
              user_id: userId,
            });

          if (!error) {
            notificationCount++;
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Notifications processed successfully',
      count: notificationCount,
      timestamp: now.toISOString(),
    });
  } catch (error) {
    console.error('Cron notification error:', error);
    return NextResponse.json(
      {
        error: 'Failed to process notifications',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
