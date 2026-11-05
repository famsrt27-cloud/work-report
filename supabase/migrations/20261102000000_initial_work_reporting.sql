begin;

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create table public.departments (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  parent_id uuid references public.departments(id) on delete restrict,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint departments_name_not_blank check (btrim(name) <> '')
);

create unique index departments_unique_root_name_idx
  on public.departments (lower(name)) where parent_id is null;
create index departments_parent_id_idx on public.departments(parent_id);

create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique,
  full_name text not null,
  position text,
  department_id uuid references public.departments(id) on delete set null,
  must_change_password boolean not null default true,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_username_exactly_7_digits check (username ~ '^[0-9]{7}$'),
  constraint profiles_full_name_not_blank check (btrim(full_name) <> '')
);
create index profiles_department_id_idx on public.profiles(department_id);
create index profiles_active_name_idx on public.profiles(department_id, full_name) where is_active;

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  role text not null,
  scoped_department_id uuid references public.departments(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint user_roles_valid_role check (role in ('staff', 'supervisor', 'manager', 'admin'))
);
create unique index user_roles_unique_assignment_idx
  on public.user_roles(user_id, role, coalesce(scoped_department_id, '00000000-0000-0000-0000-000000000000'::uuid));
create index user_roles_scope_idx on public.user_roles(scoped_department_id, role, user_id);

create table public.auth_login_attempts (
  id bigint generated always as identity primary key,
  account_hash text not null,
  ip_hash text not null,
  attempted_at timestamptz not null default now(),
  successful boolean not null default false
);
create index auth_login_attempts_rate_limit_idx
  on public.auth_login_attempts(account_hash, ip_hash, attempted_at desc);

create table public.task_categories (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint task_categories_code_format check (code ~ '^[a-z0-9][a-z0-9_-]{1,49}$'),
  constraint task_categories_name_not_blank check (btrim(name) <> '')
);

insert into public.task_categories(code, name)
values ('general', 'งานทั่วไป')
on conflict (code) do nothing;

create table private.task_code_counters (
  work_year smallint primary key,
  last_value bigint not null default 0,
  constraint task_code_counters_positive check (last_value >= 0)
);
revoke all on private.task_code_counters from public, anon, authenticated;

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  task_code text not null unique,
  title text not null,
  description text,
  category_id uuid references public.task_categories(id) on delete set null,
  owner_user_id uuid not null references public.profiles(user_id) on delete restrict,
  received_date date,
  due_date date,
  task_status text not null default 'in_progress',
  created_by uuid not null references public.profiles(user_id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tasks_title_length check (char_length(btrim(title)) between 1 and 200),
  constraint tasks_valid_status check (task_status in ('in_progress', 'completed', 'cancelled')),
  constraint tasks_due_after_received check (received_date is null or due_date is null or due_date >= received_date)
);
create index tasks_owner_updated_idx on public.tasks(owner_user_id, updated_at desc);
create index tasks_category_id_idx on public.tasks(category_id);
create index tasks_created_by_idx on public.tasks(created_by);
create index tasks_due_active_idx on public.tasks(due_date, owner_user_id)
  where due_date is not null and task_status = 'in_progress';

create table public.task_collaborators (
  task_id uuid not null references public.tasks(id) on delete cascade,
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (task_id, user_id)
);
create index task_collaborators_user_id_idx on public.task_collaborators(user_id, task_id);

create table public.task_sources (
  task_id uuid primary key references public.tasks(id) on delete cascade,
  source_type text,
  originating_unit text,
  assigner_name text,
  assigner_position text,
  reference_no text,
  reference_date date,
  source_note text,
  updated_at timestamptz not null default now(),
  constraint task_sources_valid_type check (
    source_type is null or source_type in ('document', 'person', 'routine', 'other')
  )
);

create table public.source_documents (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  bucket text not null default 'work-source-docs',
  storage_key text not null unique,
  original_name text not null,
  mime text not null,
  size_bytes bigint not null,
  sha256 text not null,
  uploaded_by uuid not null references public.profiles(user_id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint source_documents_private_bucket check (bucket = 'work-source-docs'),
  constraint source_documents_pdf_only check (mime = 'application/pdf'),
  constraint source_documents_size_limit check (size_bytes between 1 and 20971520),
  constraint source_documents_sha256_format check (sha256 ~ '^[a-f0-9]{64}$')
);
create index source_documents_task_id_idx on public.source_documents(task_id, created_at);
create index source_documents_uploaded_by_idx on public.source_documents(uploaded_by);

create table public.work_logs (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  created_by uuid not null references public.profiles(user_id) on delete restrict,
  work_date date not null,
  activity_detail text not null,
  result_text text not null,
  time_start time,
  time_end time,
  duration_minutes integer,
  quantity numeric(12,2),
  unit text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint work_logs_activity_not_blank check (btrim(activity_detail) <> ''),
  constraint work_logs_result_not_blank check (btrim(result_text) <> ''),
  constraint work_logs_duration_nonnegative check (duration_minutes is null or duration_minutes >= 0),
  constraint work_logs_quantity_nonnegative check (quantity is null or quantity >= 0)
);
create index work_logs_task_date_idx on public.work_logs(task_id, work_date desc, id);
create index work_logs_creator_date_idx on public.work_logs(created_by, work_date desc, id);

create table public.evidence_images (
  id uuid primary key default gen_random_uuid(),
  work_log_id uuid not null references public.work_logs(id) on delete cascade,
  bucket text not null default 'work-evidence',
  storage_key text not null unique,
  original_name text not null,
  mime text not null,
  size_bytes bigint not null,
  caption text,
  evidence_type text,
  display_order integer not null default 0,
  include_in_pdf boolean not null default true,
  sha256 text not null,
  uploaded_by uuid not null references public.profiles(user_id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint evidence_images_private_bucket check (bucket = 'work-evidence'),
  constraint evidence_images_allowed_mime check (mime in ('image/jpeg', 'image/png', 'image/webp')),
  constraint evidence_images_size_limit check (size_bytes between 1 and 10485760),
  constraint evidence_images_order_nonnegative check (display_order >= 0),
  constraint evidence_images_sha256_format check (sha256 ~ '^[a-f0-9]{64}$')
);
create index evidence_images_work_log_order_idx on public.evidence_images(work_log_id, display_order, id);
create index evidence_images_uploaded_by_idx on public.evidence_images(uploaded_by);

create table public.task_status_history (
  id bigint generated always as identity primary key,
  task_id uuid not null references public.tasks(id) on delete cascade,
  old_status text,
  new_status text not null,
  changed_by uuid references public.profiles(user_id) on delete set null,
  changed_at timestamptz not null default now(),
  constraint task_status_history_valid_old check (old_status is null or old_status in ('in_progress', 'completed', 'cancelled')),
  constraint task_status_history_valid_new check (new_status in ('in_progress', 'completed', 'cancelled'))
);
create index task_status_history_task_changed_idx on public.task_status_history(task_id, changed_at desc, id);
create index task_status_history_changed_by_idx on public.task_status_history(changed_by);

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,
  entity_id uuid not null,
  reviewer_id uuid not null references public.profiles(user_id) on delete restrict,
  status text not null default 'pending',
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint reviews_valid_entity_type check (entity_type in ('task', 'report_snapshot')),
  constraint reviews_valid_status check (status in ('pending', 'approved', 'returned'))
);
create index reviews_reviewer_status_idx on public.reviews(reviewer_id, status, created_at desc);
create index reviews_entity_idx on public.reviews(entity_type, entity_id);

create table public.report_snapshots (
  id uuid primary key default gen_random_uuid(),
  report_type text not null,
  subject_user_id uuid not null references public.profiles(user_id) on delete restrict,
  period_start date not null,
  period_end date not null,
  snapshot_json jsonb not null,
  revision integer not null default 1,
  review_status text not null default 'draft',
  created_by uuid not null references public.profiles(user_id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint report_snapshots_valid_type check (report_type in ('single', 'monthly')),
  constraint report_snapshots_valid_period check (period_end >= period_start),
  constraint report_snapshots_revision_positive check (revision > 0),
  constraint report_snapshots_valid_review_status check (review_status in ('draft', 'pending', 'approved', 'returned'))
);
create index report_snapshots_subject_period_idx on public.report_snapshots(subject_user_id, period_start desc, period_end);
create index report_snapshots_created_by_idx on public.report_snapshots(created_by);

create table public.notifications (
  id bigint generated always as identity primary key,
  recipient_user_id uuid not null references public.profiles(user_id) on delete cascade,
  type text not null,
  title text not null,
  body text not null,
  entity_type text,
  entity_id uuid,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  dedupe_key text,
  constraint notifications_title_not_blank check (btrim(title) <> '')
);
create unique index notifications_dedupe_idx
  on public.notifications(recipient_user_id, dedupe_key) where dedupe_key is not null;
create index notifications_unread_idx
  on public.notifications(recipient_user_id, created_at desc) where read_at is null;

create table public.temporary_files (
  id uuid primary key default gen_random_uuid(),
  bucket text not null default 'work-temporary',
  storage_key text not null unique,
  expires_at timestamptz not null,
  is_referenced boolean not null default false,
  deleted_at timestamptz,
  retry_count integer not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  constraint temporary_files_bucket_only check (bucket = 'work-temporary'),
  constraint temporary_files_retry_nonnegative check (retry_count >= 0)
);
create index temporary_files_cleanup_idx on public.temporary_files(expires_at, id)
  where deleted_at is null and is_referenced = false;

create table public.file_cleanup_runs (
  id bigint generated always as identity primary key,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  processed integer not null default 0,
  deleted integer not null default 0,
  failed integer not null default 0,
  status text not null default 'running',
  constraint file_cleanup_runs_valid_status check (status in ('running', 'completed', 'partial', 'failed'))
);

create table public.audit_events (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles(user_id) on delete set null,
  entity_type text not null,
  entity_id uuid,
  action text not null,
  safe_diff_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index audit_events_entity_idx on public.audit_events(entity_type, entity_id, created_at desc);
create index audit_events_actor_idx on public.audit_events(actor_id, created_at desc);

create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function private.assign_task_code()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  buddhist_year smallint := extract(year from now() at time zone 'Asia/Bangkok')::smallint + 543;
  next_value bigint;
begin
  if new.task_code is not null and btrim(new.task_code) <> '' then
    return new;
  end if;

  insert into private.task_code_counters(work_year, last_value)
  values (buddhist_year, 1)
  on conflict (work_year) do update
    set last_value = private.task_code_counters.last_value + 1
  returning last_value into next_value;

  new.task_code := 'TASK-' || buddhist_year::text || '-' || lpad(next_value::text, 4, '0');
  return new;
end;
$$;

create or replace function private.capture_task_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' or old.task_status is distinct from new.task_status then
    insert into public.task_status_history(task_id, old_status, new_status, changed_by)
    values (new.id, case when tg_op = 'INSERT' then null else old.task_status end, new.task_status, (select auth.uid()));
  end if;
  return new;
end;
$$;

create trigger profiles_set_updated_at before update on public.profiles
for each row execute function private.set_updated_at();
create trigger tasks_assign_code before insert on public.tasks
for each row execute function private.assign_task_code();
create trigger tasks_set_updated_at before update on public.tasks
for each row execute function private.set_updated_at();
create trigger tasks_capture_status after insert or update of task_status on public.tasks
for each row execute function private.capture_task_status();
create trigger task_sources_set_updated_at before update on public.task_sources
for each row execute function private.set_updated_at();
create trigger work_logs_set_updated_at before update on public.work_logs
for each row execute function private.set_updated_at();
create trigger reviews_set_updated_at before update on public.reviews
for each row execute function private.set_updated_at();

create or replace function private.current_profile_ready()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null and exists (
    select 1 from public.profiles p
    where p.user_id = (select auth.uid())
      and p.is_active
      and not p.must_change_password
  );
$$;

create or replace function private.department_is_within(target_department uuid, scope_department uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  with recursive ancestors as (
    select d.id, d.parent_id from public.departments d where d.id = target_department
    union all
    select d.id, d.parent_id
    from public.departments d
    join ancestors a on a.parent_id = d.id
  )
  select scope_department is null or exists(select 1 from ancestors where id = scope_department);
$$;

create or replace function private.can_access_user(target_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.current_profile_ready() and (
    target_user = (select auth.uid())
    or exists (
      select 1
      from public.user_roles r
      join public.profiles target on target.user_id = target_user
      where r.user_id = (select auth.uid())
        and r.role in ('supervisor', 'manager', 'admin')
        and private.department_is_within(target.department_id, r.scoped_department_id)
    )
  );
$$;

create or replace function private.can_access_task(target_task uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.current_profile_ready() and exists (
    select 1
    from public.tasks t
    where t.id = target_task
      and (
        private.can_access_user(t.owner_user_id)
        or exists (
          select 1 from public.task_collaborators c
          where c.task_id = t.id and c.user_id = (select auth.uid())
        )
      )
  );
$$;

revoke execute on all functions in schema private from public, anon;
grant execute on function private.current_profile_ready() to authenticated;
grant execute on function private.department_is_within(uuid, uuid) to authenticated;
grant execute on function private.can_access_user(uuid) to authenticated;
grant execute on function private.can_access_task(uuid) to authenticated;

alter table public.departments enable row level security;
alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.auth_login_attempts enable row level security;
alter table public.task_categories enable row level security;
alter table public.tasks enable row level security;
alter table public.task_collaborators enable row level security;
alter table public.task_sources enable row level security;
alter table public.source_documents enable row level security;
alter table public.work_logs enable row level security;
alter table public.evidence_images enable row level security;
alter table public.task_status_history enable row level security;
alter table public.reviews enable row level security;
alter table public.report_snapshots enable row level security;
alter table public.notifications enable row level security;
alter table public.temporary_files enable row level security;
alter table public.file_cleanup_runs enable row level security;
alter table public.audit_events enable row level security;

create policy departments_read_ready on public.departments for select to authenticated
using ((select private.current_profile_ready()));
create policy profiles_read_scope on public.profiles for select to authenticated
using (user_id = (select auth.uid()) or (select private.can_access_user(user_id)));
create policy roles_read_scope on public.user_roles for select to authenticated
using (user_id = (select auth.uid()) or (select private.can_access_user(user_id)));
create policy categories_read_ready on public.task_categories for select to authenticated
using ((select private.current_profile_ready()));

create policy tasks_read_scope on public.tasks for select to authenticated
using ((select private.can_access_task(id)));
create policy tasks_insert_scope on public.tasks for insert to authenticated
with check (
  (select private.current_profile_ready())
  and created_by = (select auth.uid())
  and (owner_user_id = (select auth.uid()) or (select private.can_access_user(owner_user_id)))
);
create policy tasks_update_scope on public.tasks for update to authenticated
using ((select private.can_access_task(id)))
with check ((select private.can_access_task(id)));

create policy collaborators_read_scope on public.task_collaborators for select to authenticated
using ((select private.can_access_task(task_id)));
create policy collaborators_insert_scope on public.task_collaborators for insert to authenticated
with check ((select private.can_access_task(task_id)) and (select private.can_access_user(user_id)));
create policy collaborators_update_scope on public.task_collaborators for update to authenticated
using ((select private.can_access_task(task_id)))
with check ((select private.can_access_task(task_id)) and (select private.can_access_user(user_id)));

create policy task_sources_read_scope on public.task_sources for select to authenticated
using ((select private.can_access_task(task_id)));
create policy task_sources_insert_scope on public.task_sources for insert to authenticated
with check ((select private.can_access_task(task_id)));
create policy task_sources_update_scope on public.task_sources for update to authenticated
using ((select private.can_access_task(task_id))) with check ((select private.can_access_task(task_id)));

create policy source_documents_read_scope on public.source_documents for select to authenticated
using ((select private.can_access_task(task_id)));
create policy work_logs_read_scope on public.work_logs for select to authenticated
using ((select private.can_access_task(task_id)));
create policy work_logs_insert_scope on public.work_logs for insert to authenticated
with check (
  (select private.can_access_task(task_id)) and created_by = (select auth.uid())
);
create policy work_logs_update_scope on public.work_logs for update to authenticated
using ((select private.can_access_task(task_id)))
with check ((select private.can_access_task(task_id)));

create policy evidence_images_read_scope on public.evidence_images for select to authenticated
using (exists (
  select 1 from public.work_logs w
  where w.id = work_log_id and (select private.can_access_task(w.task_id))
));
create policy evidence_images_update_scope on public.evidence_images for update to authenticated
using (exists (
  select 1 from public.work_logs w
  where w.id = work_log_id and (select private.can_access_task(w.task_id))
))
with check (exists (
  select 1 from public.work_logs w
  where w.id = work_log_id and (select private.can_access_task(w.task_id))
));

create policy task_status_history_read_scope on public.task_status_history for select to authenticated
using ((select private.can_access_task(task_id)));
create policy reviews_read_scope on public.reviews for select to authenticated
using ((select private.can_access_user(reviewer_id)));
create policy report_snapshots_read_scope on public.report_snapshots for select to authenticated
using ((select private.can_access_user(subject_user_id)));
create policy notifications_read_own on public.notifications for select to authenticated
using (recipient_user_id = (select auth.uid()) and (select private.current_profile_ready()));
create policy notifications_update_own on public.notifications for update to authenticated
using (recipient_user_id = (select auth.uid()) and (select private.current_profile_ready()))
with check (recipient_user_id = (select auth.uid()) and (select private.current_profile_ready()));

revoke all on all tables in schema public from anon, authenticated;
grant usage on schema public to authenticated, service_role;
grant select on public.departments, public.profiles, public.user_roles, public.task_categories,
  public.tasks, public.task_collaborators, public.task_sources, public.source_documents,
  public.work_logs, public.evidence_images, public.task_status_history, public.reviews,
  public.report_snapshots, public.notifications to authenticated;
grant insert, update on public.tasks, public.task_collaborators, public.task_sources, public.work_logs to authenticated;
grant update(read_at) on public.notifications to authenticated;
grant update(caption, evidence_type, display_order, include_in_pdf) on public.evidence_images to authenticated;
-- New Supabase projects no longer auto-grant Data API access. The server-only
-- service role needs explicit privileges in addition to BYPASSRLS.
grant select, insert, update, delete on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;
-- Storage remains private and deny-by-default for browser clients. Uploads and
-- short-lived signed URLs are issued by authenticated Next.js route handlers.
-- Never manipulate storage.objects rows directly; use the Storage API.

commit;
