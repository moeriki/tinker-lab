-- A hand of units dealt to ONE team by one game. Added for Guess Who (#22).
--
-- Every game so far has the same units for everybody: the scavenger's ten prompts are ten strings
-- in content, identical for every team, so nothing about them belongs in the database. Guess Who
-- is the first whose units are a fact about the TEAM -- ten cards drawn from other guests'
-- onboarding answers, and which ten is different for each team and cannot be known until they
-- open the tile.
--
-- ADR-0001 still holds, and this table is careful about it. `game_id` is a bare string with no
-- foreign key; the database does not learn what games exist. `ref` is an OPAQUE integer whose
-- meaning belongs entirely to the game that dealt it -- Guess Who reads it as a member id, and
-- nothing in the schema says so or joins on it.
--
-- `unit` is the same unit the ledger keys on. `awards` is unique on (team, game, kind, source_id),
-- so a card pays at most once however many times its guess is edited between now and game end.

create table deals (
  team_id  integer not null references teams(id) on delete cascade,
  game_id  text    not null,
  unit     integer not null,
  ref      integer not null,
  dealt_at text    not null default (datetime('now')),
  primary key (team_id, game_id, unit)
);

-- One thing may never be dealt to one team twice. This is what makes a top-up safe: a team that
-- was dealt seven cards at 20:40 and comes back for three more cannot be handed one it already
-- holds, without the top-up having to reason about what it already gave away.
create unique index deals_ref_unique on deals (team_id, game_id, ref);
