import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const { format = 'excel', language = 'ko' } = body;

    // Validation
    if (!['excel', 'pdf'].includes(format)) {
      return NextResponse.json(
        { error: 'Invalid format. Must be excel or pdf', status: 400 },
        { status: 400 }
      );
    }

    if (!['ko', 'en', 'ta'].includes(language)) {
      return NextResponse.json(
        { error: 'Invalid language. Must be ko, en, or ta', status: 400 },
        { status: 400 }
      );
    }

    // Fetch the report
    const { data: report, error } = await supabase
      .from('weekly_reports')
      .select('*')
      .eq('id', params.id)
      .single();

    if (error || !report) {
      return NextResponse.json(
        { error: 'Weekly report not found', status: 404 },
        { status: 404 }
      );
    }

    // Generate export URL (placeholder for now)
    // In production, this would trigger actual Excel/PDF generation
    const fileName = `weekly-${report.year}-W${String(report.week).padStart(2, '0')}.${format === 'excel' ? 'xlsx' : 'pdf'}`;
    const downloadUrl = `/downloads/${fileName}`;

    return NextResponse.json({
      success: true,
      download_url: downloadUrl,
      file_name: fileName,
      generated_at: new Date().toISOString(),
      expires_in_hours: 24,
      status: 'pending',
      note: 'Excel/PDF generation in progress. Check back shortly.',
    }, { status: 202 });
  } catch (error: any) {
    console.error('Error exporting weekly report:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to export weekly report', status: 500 },
      { status: 500 }
    );
  }
}
