# azs-backend

Учёт смен АЗС: оцифровка бумажного «Отчёта за смену» — реализация топлива по колонкам,
разбивка по типам оплаты, сверка кассы, основа для месячного отчёта по операторам и бонусов.

## Стек
- Java 21, Spring Boot 3.3.5
- Spring Data JPA (Hibernate 6)
- PostgreSQL
- Flyway (миграции)
- Lombok

## Запуск

1. Поднять PostgreSQL и создать БД/пользователя:
   ```sql
   create user azs with password 'change_me';
   create database azs owner azs;
   ```
2. При необходимости поправить `src/main/resources/application.yml` (url/username/password).
3. Собрать и запустить:
   ```bash
   ./mvnw spring-boot:run
   ```
   Flyway сам накатит `V1__init.sql` при старте.

## Принципы схемы
- Деньги и литры — только `BigDecimal` (`numeric`), никогда `double`.
- `realization` (реализация по колонке) — generated stored column в БД, не хранится руками.
- Время смены — `timestamptz` / `OffsetDateTime`: смена ночная, переходит через полночь.
- Схемой владеет Flyway; Hibernate в режиме `validate` ничего не меняет.
- `station_id` заложен с первого дня — задел под несколько АЗС (multi-tenant).

## Что дальше (ждёт бизнес-правил)
- `V2`: `salary_config` (база ЗП) + `bonus_rule` (формула бонуса).
- Сервис расчёта смены: остаток, выручка, ожидаемая касса, флаг расхождения.
- SQL месячного отчёта по операторам (литры, талоны, выручка, ЗП, бонус, итого).
- Репозитории + REST.
- Angular-админка (форма ввода смены + месячная таблица).
- Опционально: Telegram-бот для ввода смены на ходу.

## Структура
```
src/main/java/kz/azs/
  AzsApplication.java
  domain/
    Station.java
    Operator.java
    Shift.java
    FuelReading.java
    ShiftBreakdown.java
src/main/resources/
  application.yml
  db/migration/V1__init.sql
```
