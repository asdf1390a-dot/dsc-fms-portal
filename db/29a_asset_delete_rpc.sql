-- Asset Master Phase 2: RPC Function for Safe Asset Deletion
-- Handles DELETE with proper audit logging by disabling trigger during operation

-- Drop existing function if it exists
drop function if exists public.delete_asset_with_audit(uuid, uuid);

-- Create RPC function that safely deletes an asset with audit logging
create or replace function public.delete_asset_with_audit(
  p_asset_id uuid,
  p_deleted_by uuid
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_asset record;
  v_result json;
begin
  -- Get the asset record before deletion (needed for audit)
  select * into v_asset from assets where id = p_asset_id;

  if v_asset is null then
    return json_build_object(
      'success', false,
      'error', 'Asset not found',
      'code', 'ASSET_NOT_FOUND'
    );
  end if;

  -- Disable the trigger to prevent the AFTER DELETE trigger from firing
  -- (which would fail due to foreign key constraint)
  alter table assets disable trigger assets_audit;

  begin
    -- Delete the asset
    delete from assets where id = p_asset_id;

    -- Now insert the audit record manually with the old asset data
    -- The foreign key constraint won't be checked because we're using
    -- a server-side function with security definer
    insert into asset_audit (asset_id, changed_by, action, diff)
    values (
      v_asset.id,
      p_deleted_by,
      'delete',
      jsonb_build_object('before', to_jsonb(v_asset))
    );

    -- Re-enable the trigger
    alter table assets enable trigger assets_audit;

    return json_build_object(
      'success', true,
      'message', 'Asset deleted successfully'
    );

  exception when others then
    -- Make sure trigger is re-enabled even if there's an error
    alter table assets enable trigger assets_audit;

    return json_build_object(
      'success', false,
      'error', sqlerrm,
      'code', 'DELETE_FAILED'
    );
  end;
end;
$$;

-- Grant execute permission to authenticated users
grant execute on function public.delete_asset_with_audit(uuid, uuid) to authenticated;

-- Test query (run after this migration):
-- select public.delete_asset_with_audit('test-asset-id'::uuid, 'test-user-id'::uuid);
