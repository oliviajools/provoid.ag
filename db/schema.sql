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

-- Themenwünsche der Teilnehmenden
create table if not exists topic_wishes (
  id          uuid primary key default gen_random_uuid(),
  group_id    uuid not null references groups(id) on delete cascade,
  user_id     uuid references users(id) on delete cascade,
  title       text not null,
  details     text not null default '',
  anonymous   boolean not null default false,
  status      text not null default 'open' check (status in ('open', 'planned', 'done', 'hidden')),
  coach_note  text not null default '',
  created_at  timestamptz not null default now()
);
create index if not exists topic_wishes_group on topic_wishes (group_id, status);
create table if not exists topic_votes (
  wish_id  uuid not null references topic_wishes(id) on delete cascade,
  user_id  uuid not null references users(id) on delete cascade,
  primary key (wish_id, user_id)
);

-- Gäste, die die AG besuchen, und Fragen der Teilnehmenden an sie
create table if not exists guests (
  id          uuid primary key default gen_random_uuid(),
  group_id    uuid not null references groups(id) on delete cascade,
  name        text not null,
  role        text not null default '',
  topic       text not null default '',
  bio         text not null default '',
  link        text not null default '',
  date        date,
  time_label  text not null default '',
  session_id  uuid references ag_sessions(id) on delete set null,
  questions_open boolean not null default true,
  published   boolean not null default false,
  created_at  timestamptz not null default now()
);
create index if not exists guests_group on guests (group_id, date);
create table if not exists guest_questions (
  id          uuid primary key default gen_random_uuid(),
  guest_id    uuid not null references guests(id) on delete cascade,
  user_id     uuid references users(id) on delete cascade,
  body        text not null,
  created_at  timestamptz not null default now()
);

-- Öffentliche Anmeldeformulare für Eltern (z. B. ag.provoid.de/anmeldung/johanneum oder /gymepp)
create table if not exists signup_forms (
  id        uuid primary key default gen_random_uuid(),
  slug      text not null unique,
  title     text not null,
  school    text not null default '',
  intro     text not null default '',
  options   jsonb not null default '[]',   -- [{id, label, detail}]
  open      boolean not null default true,
  created_at timestamptz not null default now()
);
create table if not exists signups (
  id          uuid primary key default gen_random_uuid(),
  form_id     uuid not null references signup_forms(id) on delete cascade,
  option_id   text not null,
  child_first text not null,
  child_last  text not null,
  class_name  text not null,
  parent_name text not null,
  email       text not null,
  phone       text not null default '',
  photo_ok    boolean not null default false,
  notes       text not null default '',
  waitlist    boolean not null default false,
  created_at  timestamptz not null default now()
);
create index if not exists signups_form on signups (form_id, option_id, created_at);

insert into signup_forms (slug, title, school, intro, options) values (
  'johanneum',
  'Anmeldung zur KI-AG',
  'Gelehrtenschule des Johanneums',
  'In der KI-AG verstehen die Jugendlichen zuerst, wie Künstliche Intelligenz funktioniert und wo sie scheitert, ordnen ein, was sie mit uns und der Welt macht, und bauen am Ende einen eigenen KI-Agenten. Die AG läuft bis Ende Juni 2027 und ist für die Familien kostenlos, die Finanzierung übernimmt der Förderverein.',
  '[{"id":"9-10","label":"Jahrgang 9 und 10","detail":"mittwochs in den ungeraden Kalenderwochen, ab 4. November 2026, je 60 Minuten"},
    {"id":"11-12","label":"Jahrgang 11 und 12","detail":"wöchentlich montags, 12:10 bis 13:10 Uhr, ab 9. November 2026"}]'
) on conflict (slug) do nothing;

-- Ohne Terminanzahl und ohne Teilnehmerbegrenzung (aktualisiert ältere Einträge einmalig)
update signup_forms set options =
  '[{"id":"9-10","label":"Jahrgang 9 und 10","detail":"mittwochs in den ungeraden Kalenderwochen, ab 4. November 2026, je 60 Minuten"},
    {"id":"11-12","label":"Jahrgang 11 und 12","detail":"wöchentlich montags, 12:10 bis 13:10 Uhr, ab 9. November 2026"}]'
where slug = 'johanneum' and (options::text like '%Termine%' or options::text like '%capacity%');
update signups set waitlist = false where waitlist;

-- Laufzeit pro Formular (erscheint in der Einwilligung)
alter table signup_forms add column if not exists runs_until text not null default '';
update signup_forms set runs_until = 'Ende Juni 2027' where slug = 'johanneum' and runs_until = '';

insert into signup_forms (slug, title, school, intro, options, runs_until) values (
  'gymepp',
  'Anmeldung zur KI-AG',
  'Gymnasium Eppendorf',
  'In der KI-AG verstehen die Jugendlichen zuerst, wie Künstliche Intelligenz funktioniert und wo sie scheitert, ordnen ein, was sie mit uns und der Welt macht, und bauen am Ende einen eigenen KI-Agenten. Die AG läuft von Oktober 2026 bis März 2027.',
  '[{"id":"ag","label":"Mittwochs, 14:05 Uhr","detail":"in Raum 205, ab 14. Oktober 2026"}]',
  'Ende März 2027'
) on conflict (slug) do nothing;
