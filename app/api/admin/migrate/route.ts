import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Create travels table if it doesn't exist
    const { error: travelsError } = await supabase.from('travels').select('count()', { count: 'exact' }).limit(1);

    if (travelsError && (travelsError.code === 'PGRST116' || travelsError.code === 'PGRST205')) {
      console.log('Tables not found, migration needed');
      return NextResponse.json({
        success: false,
        error: 'Tables not found',
        details: 'Please execute db/24_create_travel_tables.sql in Supabase SQL Editor',
        tables: [
          'travels',
          'travel_members',
          'travel_events',
          'travel_costs',
          'travel_cost_splits',
          'travel_checklist_items',
          'travel_documents',
          'travel_notifications',
          'travel_notification_rules',
        ],
      }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: 'Tables already exist',
      tables: [
        'travels',
        'travel_members',
        'travel_events',
        'travel_costs',
        'travel_cost_splits',
        'travel_checklist_items',
        'travel_documents',
        'travel_notifications',
        'travel_notification_rules',
      ],
    });
  } catch (error) {
    console.error('Migration error:', error);
    return NextResponse.json(
      {
        error: 'Migration check failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
