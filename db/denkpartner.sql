-- Denkpartner-Baukasten: Jugendliche bauen sich einen eigenen Denkpartner (Prompt-Raster) und testen ihn im Chat.
-- Gespeichert wird nur der Prompt, nicht die Gespräche. Pro Person und Woche zählt ein Zähler die Nachrichten.
-- Idempotent: kann gefahrlos mehrfach laufen. Steht genauso am Ende von schema.sql.
create table if not exists denkpartner (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references users(id) on delete cascade,
  group_id   uuid references groups(id) on delete cascade,      -- null bei Coaches
  name       text not null,
  fach       text not null default '',
  jahrgang   text not null default '',
  felder     jsonb not null default '{}'::jsonb,
  prompt     text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists denkpartner_user on denkpartner (user_id);
create index if not exists denkpartner_group on denkpartner (group_id);

-- Nur ein Zähler, keine Inhalte
create table if not exists denkpartner_usage (
  user_id    uuid not null references users(id) on delete cascade,
  week_start date not null,
  n          int not null default 0,
  primary key (user_id, week_start)
);

-- Pro AG ein- und ausschaltbar, mit Wochenlimit pro Person
alter table groups add column if not exists dp_enabled boolean not null default true;
alter table groups add column if not exists dp_limit   int     not null default 60;
