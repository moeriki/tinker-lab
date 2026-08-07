-- The roster's fourth game kind, `trophy`, moves points for a reason none of the five existing
-- award kinds describes: not a submission, not a step, not a hint, and not the host's freehand
-- "because I said so". Teddy is handed to whoever is holding him, once, against the game.
--
-- It could have ridden in as `kind = 'manual'` with a game_id, which the unique index would have
-- kept distinct from a freehand award (those carry no game_id) and would have needed no migration
-- at all. It gets its own kind because the ledger's kind column is the only record of WHY points
-- moved -- `select kind, sum(points)` at the end is the audit -- and a trophy and a
-- consolation award the host typed in are not the same event.
--
-- `check` constraints cannot be altered in SQLite, so this is the standard rebuild. Nothing
-- references awards, so the rename is safe with foreign keys on; the old indexes follow the old
-- table into the drop, which is why they are recreated last.

alter table awards rename to awards_old;

create table awards (
  id         integer primary key,
  team_id    integer not null references teams(id) on delete cascade,
  game_id    text,
  kind       text not null
             check (kind in ('answer', 'tally', 'hunt', 'hint', 'manual', 'trophy')),
  points     integer not null,
  reason     text,
  source_id  integer,
  created_at text not null default (datetime('now')),
  updated_at text not null default (datetime('now'))
);

insert into awards (id, team_id, game_id, kind, points, reason, source_id, created_at, updated_at)
  select id, team_id, game_id, kind, points, reason, source_id, created_at, updated_at
  from awards_old;

drop table awards_old;

create unique index awards_source
  on awards (team_id, ifnull(game_id, ''), kind, ifnull(source_id, 0));
create index awards_team on awards (team_id);
