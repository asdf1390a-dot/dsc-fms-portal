import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { sendNotification } from '@/lib/backups/service';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized', status: 401 }, { status: 401 });
  }

  try {
    // Get all policies with auto-delete enabled
    const { data: policies } = await supabase
      .from('backup_policies')
      .select('user_id, retention_days')
      .eq('auto_delete_enabled', true);

    if (!policies) {
      return NextResponse.json({ deleted: 0, freed_bytes: 0, users_notified: 0, status: 200 });
    }

    let deleted = 0;
    let freedBytes = 0;
    let usersNotified = 0;

    for (const policy of policies) {
      try {
        // Get expired backups
        const { data: expiredBackups } = await supabase
          .rpc('get_expired_backups', {
            user_id_param: policy.user_id,
            retention_days: policy.retention_days,
          });

        if (!expiredBackups || expiredBackups.length === 0) continue;

        for (const backup of expiredBackups) {
          try {
            // Delete from storage
            const backupFiles = await supabase.storage
              .from('backups')
              .list(`${policy.user_id}/${backup.backup_id}`);

            if (backupFiles.data) {
              for (const file of backupFiles.data) {
                await supabase.storage
                  .from('backups')
                  .remove([`${policy.user_id}/${backup.backup_id}/${file.name}`]);
              }
            }

            // Delete database record
            await supabase
              .from('backups')
              .delete()
              .eq('id', backup.backup_id);

            deleted++;
            freedBytes += backup.size_bytes || 0;
          } catch (err) {
            console.error(`Error deleting backup ${backup.backup_id}:`, err);
          }
        }

        // Send notification
        await sendNotification(
          supabase,
          policy.user_id,
          'deletion_scheduled',
          `Deleted ${expiredBackups.length} expired backup(s)`,
          'email'
        );
        usersNotified++;
      } catch (err) {
        console.error(`Error processing cleanup for ${policy.user_id}:`, err);
      }
    }

    return NextResponse.json({ deleted, freed_bytes: freedBytes, users_notified: usersNotified, status: 200 });
  } catch (error) {
    console.error('Error in cleanup cron:', error);
    return NextResponse.json({ error: 'Internal server error', status: 500 }, { status: 500 });
  }
}
