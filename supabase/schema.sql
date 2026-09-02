create table if not exists public.watch_progress (
    user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
    entry_slug text not null check (char_length(entry_slug) between 1 and 160),
    watched_at timestamptz not null default timezone('utc', now()),
    primary key (user_id, entry_slug)
);

alter table public.watch_progress alter column user_id set default auth.uid();

alter table public.watch_progress
    drop constraint if exists watch_progress_entry_slug_fkey;

drop table if exists public.timeline_entries;

with split_entry_slugs (old_slug, new_slug) as (
    select *
    from unnest(
        array['i-am-groot', 'i-am-groot', 'what-if', 'what-if'],
        array[
            'i-am-groot-season-1',
            'i-am-groot-season-2',
            'what-if-season-1',
            'what-if-season-2'
        ]
    )
    union all
    select 'what-if', 'what-if-season-3'
)
insert into public.watch_progress (user_id, entry_slug, watched_at)
select progress.user_id, split_entry_slugs.new_slug, progress.watched_at
from public.watch_progress as progress
join split_entry_slugs on split_entry_slugs.old_slug = progress.entry_slug
on conflict (user_id, entry_slug) do nothing;

delete from public.watch_progress
where entry_slug = any (array['i-am-groot', 'what-if']);

alter table public.watch_progress enable row level security;

revoke all on table public.watch_progress from public, anon, authenticated;

grant select, delete on table public.watch_progress to authenticated;
grant insert (entry_slug) on table public.watch_progress to authenticated;

drop policy if exists "Users can read their own watch progress" on public.watch_progress;
drop policy if exists "Users can add their own watch progress" on public.watch_progress;
drop policy if exists "Users can update their own watch progress" on public.watch_progress;
drop policy if exists "Users can delete their own watch progress" on public.watch_progress;

create policy "Users can read their own watch progress"
    on public.watch_progress for select
    to authenticated
    using ((select auth.uid()) = user_id);

create policy "Users can add their own watch progress"
    on public.watch_progress for insert
    to authenticated
    with check ((select auth.uid()) = user_id);

create policy "Users can delete their own watch progress"
    on public.watch_progress for delete
    to authenticated
    using ((select auth.uid()) = user_id);

create table if not exists public.contact_rate_limits (
    rate_key text primary key check (char_length(rate_key) between 1 and 128),
    window_started_at timestamptz not null,
    hit_count integer not null check (hit_count > 0),
    updated_at timestamptz not null
);

alter table public.contact_rate_limits enable row level security;

revoke all on table public.contact_rate_limits from public, anon, authenticated;

create or replace function public.check_contact_rate_limit(
    p_rate_key text,
    p_limit integer,
    p_window_seconds integer
)
returns table (allowed boolean, retry_after_seconds integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
    checked_at timestamptz := clock_timestamp();
    current_count integer;
    current_window_started_at timestamptz;
begin
    if char_length(p_rate_key) not between 1 and 128 then
        raise exception 'Invalid rate-limit key';
    end if;
    if p_limit not between 1 and 1000 then
        raise exception 'Invalid rate-limit limit';
    end if;
    if p_window_seconds not between 1 and 86400 then
        raise exception 'Invalid rate-limit window';
    end if;

    delete from public.contact_rate_limits
    where updated_at < checked_at - interval '1 day';

    insert into public.contact_rate_limits (
        rate_key,
        window_started_at,
        hit_count,
        updated_at
    )
    values (p_rate_key, checked_at, 1, checked_at)
    on conflict (rate_key) do update
    set
        window_started_at = case
            when contact_rate_limits.window_started_at
                <= checked_at - make_interval(secs => p_window_seconds)
                then checked_at
            else contact_rate_limits.window_started_at
        end,
        hit_count = case
            when contact_rate_limits.window_started_at
                <= checked_at - make_interval(secs => p_window_seconds)
                then 1
            else contact_rate_limits.hit_count + 1
        end,
        updated_at = checked_at
    returning hit_count, window_started_at
    into current_count, current_window_started_at;

    allowed := current_count <= p_limit;
    retry_after_seconds := case
        when allowed then 0
        else greatest(
            1,
            ceil(
                extract(
                    epoch from current_window_started_at
                        + make_interval(secs => p_window_seconds)
                        - checked_at
                )
            )::integer
        )
    end;
    return next;
end;
$$;

revoke all on function public.check_contact_rate_limit(text, integer, integer)
from public, anon, authenticated;
grant execute on function public.check_contact_rate_limit(text, integer, integer)
to service_role;
