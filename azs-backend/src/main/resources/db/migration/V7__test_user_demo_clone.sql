-- V7: demo user `test` with an isolated copy of the admin station data.
-- The user gets its own `Test` station so demos cannot modify `admin` data.

do $$
declare
    source_station_id bigint;
    target_station_id bigint;
    source_config_id bigint;
    target_config_id bigint;
    target_price_id smallint;
begin
    select u.station_id
    into source_station_id
    from app_user u
    where lower(u.username) = 'admin'
    order by u.id
    limit 1;

    if source_station_id is null then
        raise exception 'Cannot create demo user: admin user was not found';
    end if;

    select s.id
    into target_station_id
    from station s
    where s.name = 'Test'
    order by s.id
    limit 1;

    if target_station_id is null then
        insert into station (name)
        values ('Test')
        returning id into target_station_id;
    end if;

    if not exists (select 1 from salary_config where station_id = target_station_id) then
        insert into salary_config (
            station_id, rate_full, rate_day, rate_night,
            default_discount_price, default_base_price,
            initial_stock_liters, tank_capacity_liters,
            measurement_tolerance_liters
        )
        select target_station_id, rate_full, rate_day, rate_night,
               default_discount_price, default_base_price,
               initial_stock_liters, tank_capacity_liters,
               measurement_tolerance_liters
        from salary_config
        where station_id = source_station_id
        returning id into target_config_id;

        select id
        into source_config_id
        from salary_config
        where station_id = source_station_id;

        insert into bonus_tier (config_id, threshold_liters, bonus_amount)
        select target_config_id, threshold_liters, bonus_amount
        from bonus_tier
        where config_id = source_config_id;
    end if;

    if not exists (select 1 from fuel_price where station_id = target_station_id) then
        select (coalesce(max(id), 0) + 1)::smallint
        into target_price_id
        from fuel_price;

        insert into fuel_price (id, station_id, discount_price, base_price, updated_at)
        select target_price_id, target_station_id, discount_price, base_price, updated_at
        from fuel_price
        where station_id = source_station_id;
    end if;

    if not exists (select 1 from operator where station_id = target_station_id) then
        insert into operator (station_id, full_name, is_active, created_at)
        select target_station_id, full_name, is_active, created_at
        from operator
        where station_id = source_station_id
        order by id;
    end if;

    create temp table if not exists tmp_demo_operator_map (
        old_id bigint,
        new_id bigint
    ) on commit drop;
    truncate table tmp_demo_operator_map;

    insert into tmp_demo_operator_map (old_id, new_id)
    with source_ops as (
        select id, full_name,
               row_number() over (partition by full_name order by id) as rn
        from operator
        where station_id = source_station_id
    ),
    target_ops as (
        select id, full_name,
               row_number() over (partition by full_name order by id) as rn
        from operator
        where station_id = target_station_id
    )
    select source_ops.id, target_ops.id
    from source_ops
    join target_ops on target_ops.full_name = source_ops.full_name
                   and target_ops.rn = source_ops.rn;

    if not exists (select 1 from shift where station_id = target_station_id) then
        create temp table if not exists tmp_demo_shift_map (
            old_id bigint,
            new_id bigint
        ) on commit drop;
        truncate table tmp_demo_shift_map;

        insert into tmp_demo_shift_map (old_id, new_id)
        select id, nextval(pg_get_serial_sequence('shift', 'id'))
        from shift
        where station_id = source_station_id
        order by id;

        insert into shift (
            id, station_id, operator_id, accepted_by_operator_id,
            shift_type, started_at, ended_at, note, created_at
        ) overriding system value
        select m.new_id, target_station_id, operator_map.new_id, accepted_by_map.new_id,
               sh.shift_type, sh.started_at, sh.ended_at, sh.note, sh.created_at
        from shift sh
        join tmp_demo_shift_map m on m.old_id = sh.id
        join tmp_demo_operator_map operator_map on operator_map.old_id = sh.operator_id
        left join tmp_demo_operator_map accepted_by_map on accepted_by_map.old_id = sh.accepted_by_operator_id
        where sh.station_id = source_station_id;

        insert into fuel_reading (shift_id, pump_number, reading_start, reading_end)
        select m.new_id, r.pump_number, r.reading_start, r.reading_end
        from fuel_reading r
        join tmp_demo_shift_map m on m.old_id = r.shift_id
        order by r.shift_id, r.pump_number;

        insert into shift_breakdown (
            shift_id, talony_liters, card_liters, discount_liters,
            discount_price, base_price, kaspi_qr, kaspi_transfer
        )
        select m.new_id, b.talony_liters, b.card_liters, b.discount_liters,
               b.discount_price, b.base_price, b.kaspi_qr, b.kaspi_transfer
        from shift_breakdown b
        join tmp_demo_shift_map m on m.old_id = b.shift_id;
    end if;

    if not exists (select 1 from gas_delivery where station_id = target_station_id) then
        insert into gas_delivery (station_id, delivered_at, liters, supplier, note, created_at)
        select target_station_id, delivered_at, liters, supplier, note, created_at
        from gas_delivery
        where station_id = source_station_id
        order by id;
    end if;

    if not exists (select 1 from tank_reset where station_id = target_station_id) then
        create temp table if not exists tmp_demo_tank_reset_map (
            old_id bigint,
            new_id bigint
        ) on commit drop;
        truncate table tmp_demo_tank_reset_map;

        insert into tmp_demo_tank_reset_map (old_id, new_id)
        select id, nextval(pg_get_serial_sequence('tank_reset', 'id'))
        from tank_reset
        where station_id = source_station_id
        order by id;

        insert into tank_reset (id, station_id, reset_at, note, created_at) overriding system value
        select m.new_id, target_station_id, tr.reset_at, tr.note, tr.created_at
        from tank_reset tr
        join tmp_demo_tank_reset_map m on m.old_id = tr.id
        where tr.station_id = source_station_id;

        insert into tank_reset_reading (tank_reset_id, pump_number, reading)
        select m.new_id, r.pump_number, r.reading
        from tank_reset_reading r
        join tmp_demo_tank_reset_map m on m.old_id = r.tank_reset_id
        order by r.tank_reset_id, r.pump_number;
    end if;

    if not exists (select 1 from app_user where lower(username) = 'test') then
        insert into app_user (station_id, username, password_salt, password_hash, api_token, is_active)
        values (
            target_station_id,
            'test',
            'gazoil-test',
            'b80721d2b8c824477addd69f18dd6e5bbead7773c43d46dce12aeadc9992a08a',
            '061bd387dbe01b5fbf83b1c0825cdee0c5f49e902eb70a12c2cfed2ab2b9e5ed',
            true
        );
    else
        update app_user
        set station_id = target_station_id,
            password_salt = 'gazoil-test',
            password_hash = 'b80721d2b8c824477addd69f18dd6e5bbead7773c43d46dce12aeadc9992a08a',
            api_token = '061bd387dbe01b5fbf83b1c0825cdee0c5f49e902eb70a12c2cfed2ab2b9e5ed',
            is_active = true
        where lower(username) = 'test';
    end if;
end $$;
