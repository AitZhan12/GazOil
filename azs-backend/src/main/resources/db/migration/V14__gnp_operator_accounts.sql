-- V14: отдельные аккаунты операторов ГНП.

alter table app_user
    add column role varchar(16) not null default 'ADMIN',
    add column operator_id bigint references operator(id);

alter table app_user
    add constraint chk_app_user_role check (role in ('ADMIN', 'OPERATOR'));

create unique index uq_app_user_operator on app_user(operator_id)
    where operator_id is not null;

with gnp as (
    select id as station_id from station where name = 'ГНП' limit 1
), wanted(full_name, username, password_salt, password_hash, api_token, operator_no) as (
    values
        ('Оператор ГНП 1', 'operator-1', 'gazoil-operator-1', '6af1135ede935ed67f466b8ddb046f023e49eaa1684fded4cf5d969c8f18f218', '5b9f926fd525f2a1600c4a5a160c20e76cfc8e604ef0046865fed85c569d1ea4', 1),
        ('Оператор ГНП 2', 'operator-2', 'gazoil-operator-2', '7c3ba484c87865d0ad89d60fea19da4ff3afe00151c22c033d320690c66d18dc', 'c806f405c55eb5d6e32b3bc768448e716b06dfea67b91c8fb69dcaab36fe2374', 2),
        ('Оператор ГНП 3', 'operator-3', 'gazoil-operator-3', 'f8d777fe27d52b4d234ef4858d54e441a37311da395fa259bd6d405898064d9a', '9ee61990b4bba0e5c92c5724f7bd0ed59bef87f6a187dcdb839f48b824fdbb8c', 3),
        ('Оператор ГНП 4', 'operator-4', 'gazoil-operator-4', 'df2dff8889325dc8e8cacbc94ecb5ced867f28b74ea3d7aa8cc92312f071992b', 'e632be8d4470aa99bc7ada3d65d2330b0f5efe8e0e4e12ce1e7b8d6a68b7b1b5', 4),
        ('Оператор ГНП 5', 'operator-5', 'gazoil-operator-5', '369f327a0d90ecbc0874e83c42d6c361abbe1db1d62d122efe9c0d6cdb3d06bb', '5ee3ec3cb38c0ad80c26b96627f6a9356139cac0d3220e1075019a3d3fa64d29', 5)
)
insert into operator (station_id, full_name, is_active)
select gnp.station_id, wanted.full_name, true
from gnp cross join wanted
where not exists (
    select 1 from operator existing
    where existing.station_id = gnp.station_id
      and existing.full_name = wanted.full_name
);

with gnp as (
    select id as station_id from station where name = 'ГНП' limit 1
), wanted(full_name, username, password_salt, password_hash, api_token) as (
    values
        ('Оператор ГНП 1', 'operator-1', 'gazoil-operator-1', '6af1135ede935ed67f466b8ddb046f023e49eaa1684fded4cf5d969c8f18f218', '5b9f926fd525f2a1600c4a5a160c20e76cfc8e604ef0046865fed85c569d1ea4'),
        ('Оператор ГНП 2', 'operator-2', 'gazoil-operator-2', '7c3ba484c87865d0ad89d60fea19da4ff3afe00151c22c033d320690c66d18dc', 'c806f405c55eb5d6e32b3bc768448e716b06dfea67b91c8fb69dcaab36fe2374'),
        ('Оператор ГНП 3', 'operator-3', 'gazoil-operator-3', 'f8d777fe27d52b4d234ef4858d54e441a37311da395fa259bd6d405898064d9a', '9ee61990b4bba0e5c92c5724f7bd0ed59bef87f6a187dcdb839f48b824fdbb8c'),
        ('Оператор ГНП 4', 'operator-4', 'gazoil-operator-4', 'df2dff8889325dc8e8cacbc94ecb5ced867f28b74ea3d7aa8cc92312f071992b', 'e632be8d4470aa99bc7ada3d65d2330b0f5efe8e0e4e12ce1e7b8d6a68b7b1b5'),
        ('Оператор ГНП 5', 'operator-5', 'gazoil-operator-5', '369f327a0d90ecbc0874e83c42d6c361abbe1db1d62d122efe9c0d6cdb3d06bb', '5ee3ec3cb38c0ad80c26b96627f6a9356139cac0d3220e1075019a3d3fa64d29')
)
insert into app_user (station_id, username, password_salt, password_hash, api_token, is_active, role, operator_id)
select gnp.station_id,
       wanted.username,
       wanted.password_salt,
       wanted.password_hash,
       wanted.api_token,
       true,
       'OPERATOR',
       operator_row.id
from gnp
join wanted on true
join operator operator_row
  on operator_row.station_id = gnp.station_id
 and operator_row.full_name = wanted.full_name
where not exists (
    select 1 from app_user existing where lower(existing.username) = lower(wanted.username)
);

insert into app_user_station (user_id, station_id)
select u.id, u.station_id
from app_user u
where u.role = 'OPERATOR'
on conflict do nothing;
