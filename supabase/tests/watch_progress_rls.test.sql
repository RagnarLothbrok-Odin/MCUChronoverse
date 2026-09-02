begin;

select plan(16);

insert into auth.users (id, email)
values
    ('11111111-1111-1111-1111-111111111111', 'watch-owner@example.com'),
    ('22222222-2222-2222-2222-222222222222', 'watch-other@example.com')
on conflict (id) do nothing;

insert into public.watch_progress (user_id, entry_slug)
values ('22222222-2222-2222-2222-222222222222', 'captain-america-the-first-avenger');

select ok(
    (
        select relrowsecurity
        from pg_class
        where oid = 'public.watch_progress'::regclass
    ),
    'watch progress has row level security enabled'
);

select ok(
    not has_table_privilege('anon', 'public.watch_progress', 'select,insert,update,delete'),
    'anonymous clients cannot access watch progress'
);

select ok(
    has_table_privilege('authenticated', 'public.watch_progress', 'select'),
    'authenticated clients can select watch progress'
);

select ok(
    has_table_privilege('authenticated', 'public.watch_progress', 'delete'),
    'authenticated clients can delete watch progress'
);

select ok(
    has_column_privilege('authenticated', 'public.watch_progress', 'entry_slug', 'insert'),
    'authenticated clients can insert an entry slug'
);

select ok(
    not has_column_privilege('authenticated', 'public.watch_progress', 'user_id', 'insert'),
    'authenticated clients cannot choose the row owner'
);

select ok(
    not has_table_privilege('authenticated', 'public.watch_progress', 'update'),
    'authenticated clients cannot update watch timestamps'
);

set local role authenticated;
set local request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';

select results_eq(
    $$insert into public.watch_progress (entry_slug)
        values ('iron-man')
        returning entry_slug$$,
    array['iron-man'],
    'a user can add their own valid watch entry'
);

select throws_ok(
    $$insert into public.watch_progress (entry_slug) values ('not-a-timeline-entry')$$,
    '23503',
    null,
    'a user cannot add an unknown timeline entry'
);

select throws_ok(
    $$insert into public.watch_progress (user_id, entry_slug)
        values ('22222222-2222-2222-2222-222222222222', 'thor')$$,
    '42501',
    null,
    'a user cannot create watch progress for another user'
);

select throws_ok(
    $$update public.watch_progress set watched_at = now()$$,
    '42501',
    null,
    'a user cannot rewrite watch timestamps'
);

select results_eq(
    $$select entry_slug from public.watch_progress order by entry_slug$$,
    array['iron-man'],
    'a user reads only their own watch progress'
);

set local request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';

select results_eq(
    $$select entry_slug from public.watch_progress order by entry_slug$$,
    array['captain-america-the-first-avenger'],
    'another user reads only their own watch progress'
);

select is_empty(
    $$delete from public.watch_progress
        where user_id = '11111111-1111-1111-1111-111111111111'
        returning entry_slug$$,
    'another user cannot delete the owner watch progress'
);

set local request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';

select results_eq(
    $$select entry_slug from public.watch_progress where entry_slug = 'iron-man'$$,
    array['iron-man'],
    'the denied delete leaves the owner watch progress intact'
);

select results_eq(
    $$delete from public.watch_progress where entry_slug = 'iron-man' returning entry_slug$$,
    array['iron-man'],
    'the owner can delete their own watch progress'
);

select * from finish();

rollback;
