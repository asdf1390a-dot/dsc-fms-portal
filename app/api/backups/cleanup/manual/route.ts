import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id');
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized', status: 401 }, { status: 401 });
    }

    const { backup_id } = await request.json();
    if (!backup_id) {
      return NextResponse.json({ error: 'backup_id required', status: 400 }, { status: 400 });
    }

    // Verify ownership
    const { data: backup, error: fetchError } = await supabase
      .from('backups')
      .select('*')
      .eq('id', backup_id)
      .eq('user_id', userId)
      .single();

    if (fetchError || !backup) {
      return NextResponse.json({ error: 'Backup not found', status: 404 }, { status: 404 });
    }

    const freedBytes = backup.size_bytes || 0;

    // Delete from storage
    const backupFiles = await supabase.storage
      .from('backups')
      .list(`${userId}/${backup_id}`);

    if (backupFiles.data) {
      for (const file of backupFiles.data) {
        await supabase.storage
          .from('backups')
          .remove([`${userId}/${backup_id}/${file.name}`]);
      }
    }

    // Delete from database
    const { error: deleteError } = await supabase
      .from('backups')
      .delete()
      .eq('id', backup_id);

    if (deleteError) throw deleteError;

    return NextResponse.json({
      data: {
        deleted_id: backup_id,
        freed_bytes: freedBytes,
      },
      status: 200,
    });
  } catch (error) {
    console.error('Error deleting backup:', error);
    return NextResponse.json({ error: 'Internal server error', status: 500 }, { status: 500 });
  }
}
