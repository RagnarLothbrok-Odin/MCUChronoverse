begin;

select plan(8);

select ok(
    (
        select relrowsecurity
        from pg_class
        where oid = 'public.contact_rate_limits'::regclass
    ),
    'contact rate limits have row level security enabled'
);

select ok(
    not has_table_privilege(
        'anon',
        'public.contact_rate_limits',
        'select,insert,update,delete'
    ),
    'anonymous clients cannot access contact rate limits'
);

select ok(
    not has_table_privilege(
        'authenticated',
        'public.contact_rate_limits',
        'select,insert,update,delete'
    ),
    'authenticated clients cannot access contact rate limits'
);

select ok(
    not has_function_privilege(
        'anon',
        'public.check_contact_rate_limit(text,integer,integer)',
        'execute'
    ),
    'anonymous clients cannot execute the contact rate limiter'
);

select ok(
    not has_function_privilege(
        'authenticated',
        'public.check_contact_rate_limit(text,integer,integer)',
        'execute'
    ),
    'authenticated clients cannot execute the contact rate limiter'
);

select ok(
    has_function_privilege(
        'service_role',
        'public.check_contact_rate_limit(text,integer,integer)',
        'execute'
    ),
    'the service role can execute the contact rate limiter'
);

set local role service_role;

select results_eq(
    $$select allowed from public.check_contact_rate_limit('pgtap:test', 1, 60)$$,
    array[true],
    'the first request inside a window is allowed'
);

select results_eq(
    $$select allowed from public.check_contact_rate_limit('pgtap:test', 1, 60)$$,
    array[false],
    'a request over the limit is rejected atomically'
);

select * from finish();

rollback;
