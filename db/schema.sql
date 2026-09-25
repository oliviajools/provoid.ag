-- Schema der KI-AG Plattform. Idempotent: kann beliebig oft ausgeführt werden.

create extension if not exists pgcrypto;

create table if not exists groups (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  school        text not null default '',
  code          text not null unique,               -- AG-Code, immer in Großbuchstaben
  registration_open boolean not null default true,  -- neue Registrierungen erlaubt?
  starts_on     date,
  created_at    timestamptz not null default now()
);

create table if not exists users (
  id               uuid primary key default gen_random_uuid(),
  group_id         uuid references groups(id) on delete cascade,  -- null bei Coaches
  role             text not null check (role in ('student', 'coach')),
  pseudonym        text not null,
  pseudonym_lower  text not null,
  password_hash    text not null,
  must_change_password boolean not null default false,
  disabled         boolean not null default false,
  created_at       timestamptz not null default now(),
  last_login_at    timestamptz,
  check ((role = 'coach' and group_id is null) or (role = 'student' and group_id is not null))
);

create unique index if not exists users_student_pseudonym
  on users (group_id, pseudonym_lower) where role = 'student';
create unique index if not exists users_coach_pseudonym
  on users (pseudonym_lower) where role = 'coach';

create table if not exists sessions (
  token_hash  text primary key,          -- SHA-256 des Cookie-Tokens, das Token selbst wird nie gespeichert
  user_id     uuid not null references users(id) on delete cascade,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null
);
create index if not exists sessions_user on sessions (user_id);

create table if not exists login_attempts (
  id           bigserial primary key,
  key          text not null,            -- z. B. "student:AGCODE:pseudonym"
  attempted_at timestamptz not null default now()
);
create index if not exists login_attempts_key on login_attempts (key, attempted_at);
