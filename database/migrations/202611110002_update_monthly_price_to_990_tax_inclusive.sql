begin;

-- The public monthly Premium price is PKR 990, inclusive of applicable taxes.
update public.prices
set amount_minor = 99000,
    duration_days = 30,
    is_active = true
where code = 'premium-monthly-pkr';

commit;
