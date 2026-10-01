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

-- Kompass-Befragung. round: 1 = Start, 2 = Halbzeit, 3 = Ende
create table if not exists compass (
  user_id      uuid not null references users(id) on delete cascade,
  round        smallint not null default 1 check (round between 1 and 3),
  answers      jsonb not null,
  share_dream  text not null default 'no' check (share_dream in ('name', 'anon', 'no')),
  completed_at timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  primary key (user_id, round)
);

-- KI-Radar: verifizierte Nachrichtenquellen (RSS/Atom). Neue Quellen sind erst aktiv, wenn die Coach sie freigibt.
create table if not exists feeds (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  url             text not null unique,
  keyword_filter  boolean not null default true,   -- nur Artikel mit KI-Stichworten übernehmen
  active          boolean not null default false,
  last_fetched_at timestamptz,
  last_status     text,
  created_at      timestamptz not null default now()
);

insert into feeds (name, url, keyword_filter) values
  ('t3n · Künstliche Intelligenz', 'https://t3n.de/tag/kuenstliche-intelligenz/rss.xml', false),
  ('The Decoder', 'https://the-decoder.de/feed/', false),
  ('heise online', 'https://www.heise.de/rss/heise-atom.xml', true),
  ('tagesschau.de', 'https://www.tagesschau.de/infoservices/alle-meldungen-100~rss2.xml', true),
  ('netzpolitik.org', 'https://netzpolitik.org/feed/', true),
  ('Golem', 'https://rss.golem.de/rss.php?feed=RSS2.0', true)
on conflict (url) do nothing;

-- Einzelne Meldungen: eingereicht von Kids, aus Feeds oder von der Coach
create table if not exists news_items (
  id            uuid primary key default gen_random_uuid(),
  group_id      uuid references groups(id) on delete cascade,   -- null = für alle AGs
  origin        text not null check (origin in ('kid', 'feed', 'coach')),
  feed_id       uuid references feeds(id) on delete set null,
  submitted_by  uuid references users(id) on delete set null,
  url           text not null,
  title         text not null default '',
  source_name   text not null default '',
  excerpt       text not null default '',                     -- Teaser aus dem Feed
  kid_note      text not null default '',                     -- „Warum ist das spannend?“
  kid_check     jsonb,                                         -- Quellencheck der Einreichung
  status        text not null default 'pending' check (status in ('pending', 'published', 'rejected', 'hidden')),
  reject_reason text not null default '',
  card          jsonb,                                         -- jugendgerechte Karte
  card_by_ai    boolean not null default false,
  published_at  timestamptz,
  source_date   timestamptz,
  created_at    timestamptz not null default now()
);
create unique index if not exists news_items_feed_url on news_items (url) where origin = 'feed';
create index if not exists news_items_status on news_items (status, published_at desc);

create table if not exists news_reactions (
  item_id   uuid not null references news_items(id) on delete cascade,
  user_id   uuid not null references users(id) on delete cascade,
  reaction  text not null check (reaction in ('krass', 'sorge', 'hype', 'testen')),
  created_at timestamptz not null default now(),
  primary key (item_id, user_id)
);

-- Sitzungen der AG mit Material und privaten Notizen der Teilnehmenden
create table if not exists ag_sessions (
  id          uuid primary key default gen_random_uuid(),
  group_id    uuid not null references groups(id) on delete cascade,
  number      int not null,
  title       text not null default '',
  date        date,
  phase       text check (phase in ('durchschauen', 'einordnen', 'bauen')),
  summary     text not null default '',
  published   boolean not null default false,
  created_at  timestamptz not null default now()
);
create index if not exists ag_sessions_group on ag_sessions (group_id, number);

create table if not exists materials (
  id          uuid primary key default gen_random_uuid(),
  session_id  uuid not null references ag_sessions(id) on delete cascade,
  kind        text not null check (kind in ('file', 'link', 'text')),
  title       text not null default '',
  url         text not null default '',
  body        text not null default '',
  filename    text not null default '',
  mime        text not null default '',
  size        bigint not null default 0,
  complete    boolean not null default true,   -- false, solange ein Upload läuft
  position    int not null default 0,
  created_at  timestamptz not null default now()
);
create index if not exists materials_session on materials (session_id, position);

-- Dateien liegen in Stücken in der Datenbank (auf dem Server in Deutschland)
create table if not exists material_chunks (
  material_id uuid not null references materials(id) on delete cascade,
  idx         int not null,
  data        bytea not null,
  primary key (material_id, idx)
);

create table if not exists notes (
  user_id     uuid not null references users(id) on delete cascade,
  session_id  uuid not null references ag_sessions(id) on delete cascade,
  body        text not null default '',
  updated_at  timestamptz not null default now(),
  primary key (user_id, session_id)
);

-- Automatisches Veröffentlichen aus verifizierten Quellen
alter table feeds add column if not exists auto_publish boolean not null default false;
alter table news_items add column if not exists ai_score smallint;
alter table news_items add column if not exists ai_tried boolean not null default false;
alter table news_items add column if not exists auto_published boolean not null default false;
