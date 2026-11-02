begin;

-- Schema assertions intended for `supabase test db` after linking/local start.
select plan(8);

select has_table('public', 'profiles', 'profiles exists');
select col_type_is('public', 'profiles', 'username', 'text', 'username preserves leading zeroes');
select has_check('public', 'profiles', 'profiles validates username');
select policies_are('public', 'tasks', array['tasks_insert_scope', 'tasks_read_scope', 'tasks_update_scope'], 'tasks has scoped RLS');
select policies_are('public', 'notifications', array['notifications_read_own', 'notifications_update_own'], 'notifications are private');
select has_index('public', 'work_logs', 'work_logs_creator_date_idx', 'dashboard date query is indexed');
select has_index('public', 'tasks', 'tasks_due_active_idx', 'overdue query is indexed');
select isnt_empty(
  $$select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relrowsecurity$$,
  'public tables enable RLS'
);

select * from finish();
rollback;
