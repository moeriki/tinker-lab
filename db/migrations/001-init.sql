-- Player data only. Games, codes, questions and pages live in content/ and are referred to by
-- bare string id with no foreign key -- see docs/adr/game-content-lives-on-disk.md.

create table teams (
  id           integer primary key,
  token        text not null unique,       -- the cookie value; the cookie IS the team
  name         text not null,
  created_at   text not null default (datetime('now')),
  last_seen_at text not null default (datetime('now'))
);

-- Members are explicit because several games key off individual attributes (height, favourite
-- colour) rather than team ones.
create table members (
  id       integer primary key,
  team_id  integer not null references teams(id) on delete cascade,
  name     text not null,
  position integer not null,
  unique (team_id, position)
);

-- member_id null means a team-scoped answer. SQLite treats NULLs as distinct in a UNIQUE
-- constraint, so the uniqueness is an expression index instead.
create table profile_answers (
  id          integer primary key,
  team_id     integer not null references teams(id) on delete cascade,
  member_id   integer references members(id) on delete cascade,
  question_id text not null,
  value       text not null,
  created_at  text not null default (datetime('now')),
  updated_at  text not null default (datetime('now'))
);
create unique index profile_answers_unique
  on profile_answers (team_id, ifnull(member_id, -1), question_id);

-- Every visit to /q/:slug, whether or not it did anything. Only the slug is stored: game and
-- step are resolved through content at read time, so re-mapping a slug before go-live rewrites
-- history correctly. accepted = 0 for an out-of-order scan or a scan after game end.
create table scans (
  id         integer primary key,
  team_id    integer not null references teams(id) on delete cascade,
  slug       text not null,
  accepted   integer not null default 1,
  scanned_at text not null default (datetime('now'))
);
create index scans_team on scans (team_id);
create index scans_slug on scans (slug);

-- State, as opposed to the scan event. Permanent once granted.
create table unlocks (
  id          integer primary key,
  team_id     integer not null references teams(id) on delete cascade,
  game_id     text not null,
  unlocked_at text not null default (datetime('now')),
  unique (team_id, game_id)
);

-- `answer` games hold at most one row per team per game and upsert it; `tally` games insert one
-- row per submission. That rule is enforced in the app, not here, because the game's kind lives
-- in content. A submission carries a verdict and never points.
create table submissions (
  id         integer primary key,
  team_id    integer not null references teams(id) on delete cascade,
  game_id    text not null,
  body       text,
  photo_path text,
  verdict    text not null default 'pending'
             check (verdict in ('pending', 'correct', 'incorrect')),
  created_at text not null default (datetime('now')),
  updated_at text not null default (datetime('now'))
);
create index submissions_team_game on submissions (team_id, game_id);
create index submissions_game on submissions (game_id);

-- step is 0 for non-hunt games, so hunt steps get their own hint sequences. The next hint index
-- is COUNT(*) for the (team, game, step).
create table hint_reveals (
  id          integer primary key,
  team_id     integer not null references teams(id) on delete cascade,
  game_id     text not null,
  step        integer not null default 0,
  hint_index  integer not null,
  revealed_at text not null default (datetime('now')),
  unique (team_id, game_id, step, hint_index)
);

-- One row per point movement; hint rows are negative. See docs/adr/points-are-a-ledger.md.
-- The unique index is what makes /admin/rescore an upsert rather than a duplication.
create table awards (
  id         integer primary key,
  team_id    integer not null references teams(id) on delete cascade,
  game_id    text,
  kind       text not null check (kind in ('answer', 'tally', 'hunt', 'hint', 'manual')),
  points     integer not null,
  reason     text,
  source_id  integer,
  created_at text not null default (datetime('now')),
  updated_at text not null default (datetime('now'))
);
create unique index awards_source
  on awards (team_id, ifnull(game_id, ''), kind, ifnull(source_id, 0));
create index awards_team on awards (team_id);

-- Global flags. game_ended_at is the first key; it will not be the last.
create table settings (
  key   text primary key,
  value text
);
