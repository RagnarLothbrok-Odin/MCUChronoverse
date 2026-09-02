begin;

select plan(3);

select ok(
    (
        select relrowsecurity
        from pg_class
        where oid = 'public.timeline_entries'::regclass
    ),
    'timeline entries have row level security enabled'
);

select ok(
    not has_table_privilege(
        'anon',
        'public.timeline_entries',
        'select,insert,update,delete'
    ),
    'anonymous clients cannot access timeline entries'
);

select ok(
    not has_table_privilege(
        'authenticated',
        'public.timeline_entries',
        'select,insert,update,delete'
    ),
    'authenticated clients cannot access the server-managed timeline allowlist'
);

select * from finish();

rollback;
