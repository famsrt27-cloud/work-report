begin;

-- Schema assertions intended for `supabase test db` after linking/local start.
select plan(13);

select has_table('public', 'profiles', 'profiles exists');
select col_type_is('public', 'profiles', 'username', 'text', 'username preserves leading zeroes');
select has_check('public', 'profiles', 'profiles validates username');
select policies_are('public', 'tasks', array['tasks_insert_scope', 'tasks_read_scope', 'tasks_update_scope'], 'tasks has scoped RLS');
select policies_are('public', 'notifications', array['notifications_read_own', 'notifications_update_own'], 'notifications are private');
select has_index('public', 'work_logs', 'work_logs_creator_date_idx', 'dashboard date query is indexed');
select has_index('public', 'tasks', 'tasks_due_active_idx', 'overdue query is indexed');
select has_index('public', 'tasks', 'tasks_created_by_idx', 'task creator foreign key is indexed');
select has_index('public', 'task_status_history', 'task_status_history_changed_by_idx', 'status actor foreign key is indexed');
select has_index('public', 'report_snapshots', 'report_snapshots_created_by_idx', 'report creator foreign key is indexed');
select ok(has_table_privilege('service_role', 'public.profiles', 'SELECT'), 'service role can read application tables');
select ok(has_table_privilege('service_role', 'public.auth_login_attempts', 'INSERT'), 'service role can record login attempts');
select isnt_empty(
  $$select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relrowsecurity$$,
  'public tables enable RLS'
);

select * from finish();
rollback;
