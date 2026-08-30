create table if not exists public.watch_progress (
    user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
    entry_slug text not null check (char_length(entry_slug) between 1 and 160),
    watched_at timestamptz not null default timezone('utc', now()),
    primary key (user_id, entry_slug)
);

alter table public.watch_progress alter column user_id set default auth.uid();

alter table public.watch_progress enable row level security;

revoke all on table public.watch_progress from public, anon, authenticated;

grant select, insert, update, delete on table public.watch_progress to authenticated;

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

create policy "Users can update their own watch progress"
    on public.watch_progress for update
    to authenticated
    using ((select auth.uid()) = user_id)
    with check ((select auth.uid()) = user_id);

create policy "Users can delete their own watch progress"
    on public.watch_progress for delete
    to authenticated
    using ((select auth.uid()) = user_id);
