-- Разовая инициализация БД под бэк (выполнять суперпользователем postgres).
-- psql -U postgres -f db-init.sql
-- Креды должны совпадать с azs-backend/src/main/resources/application.yml.

create user azs with password 'change_me';
create database azs owner azs;
