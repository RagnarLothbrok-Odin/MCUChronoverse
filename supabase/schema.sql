create table if not exists public.timeline_entries (
    slug text primary key check (char_length(slug) between 1 and 160)
);

insert into public.timeline_entries (slug)
values
    ('eyes-of-wakanda'),
    ('captain-america-the-first-avenger'),
    ('agent-carter-one-shot'),
    ('agent-carter'),
    ('captain-marvel'),
    ('iron-man'),
    ('iron-man-2'),
    ('the-incredible-hulk'),
    ('a-funny-thing-happened-on-the-way-to-thors-hammer'),
    ('thor'),
    ('the-consultant'),
    ('the-avengers'),
    ('item-47'),
    ('thor-the-dark-world'),
    ('iron-man-3'),
    ('all-hail-the-king'),
    ('captain-america-the-winter-soldier'),
    ('guardians-of-the-galaxy'),
    ('guardians-of-the-galaxy-vol-2'),
    ('i-am-groot'),
    ('avengers-age-of-ultron'),
    ('ant-man'),
    ('captain-america-civil-war'),
    ('black-widow'),
    ('black-panther'),
    ('spider-man-homecoming'),
    ('doctor-strange'),
    ('thor-ragnarok'),
    ('ant-man-and-the-wasp'),
    ('avengers-infinity-war'),
    ('avengers-endgame'),
    ('loki-season-1'),
    ('what-if'),
    ('marvel-zombies'),
    ('wandavision'),
    ('shang-chi-and-the-legend-of-the-ten-rings'),
    ('the-falcon-and-the-winter-soldier'),
    ('peters-to-do-list'),
    ('spider-man-far-from-home'),
    ('eternals'),
    ('spider-man-no-way-home'),
    ('doctor-strange-in-the-multiverse-of-madness'),
    ('hawkeye'),
    ('moon-knight'),
    ('black-panther-wakanda-forever'),
    ('echo'),
    ('she-hulk-attorney-at-law'),
    ('ms-marvel'),
    ('thor-love-and-thunder'),
    ('ironheart'),
    ('the-guardians-of-the-galaxy-holiday-special'),
    ('ant-man-and-the-wasp-quantumania'),
    ('the-guardians-of-the-galaxy-vol-3'),
    ('secret-invasion'),
    ('the-marvels'),
    ('loki-season-2'),
    ('deadpool-and-wolverine'),
    ('agatha-all-along'),
    ('daredevil-born-again-season-1'),
    ('captain-america-brave-new-world'),
    ('thunderbolts'),
    ('the-fantastic-four-first-steps'),
    ('wonder-man'),
    ('daredevil-born-again-season-2'),
    ('the-punisher-one-last-kill'),
    ('spider-man-brand-new-day'),
    ('visionquest'),
    ('avengers-doomsday'),
    ('avengers-secret-wars')
on conflict (slug) do nothing;

alter table public.timeline_entries enable row level security;

revoke all on table public.timeline_entries from public, anon, authenticated;

create table if not exists public.watch_progress (
    user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
    entry_slug text not null check (char_length(entry_slug) between 1 and 160),
    watched_at timestamptz not null default timezone('utc', now()),
    primary key (user_id, entry_slug)
);

alter table public.watch_progress alter column user_id set default auth.uid();

do $$
begin
    if not exists (
        select 1
        from pg_constraint
        where conname = 'watch_progress_entry_slug_fkey'
            and conrelid = 'public.watch_progress'::regclass
    ) then
        alter table public.watch_progress
            add constraint watch_progress_entry_slug_fkey
            foreign key (entry_slug)
            references public.timeline_entries(slug)
            on update cascade
            on delete restrict
            not valid;
    end if;
end
$$;

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
