-- The UNIT a submission claims: which of its game's countable things this one is.
--
-- A tally game declares `units` in content -- either a number of anonymous slots (Portrait of a
-- stranger: ten portraits, nothing distinguishing one from another) or an array of labelled
-- prompts (the photo scavenger: "someone eating or drinking", "both hosts in one shot"). This
-- column records which one a given photo claimed.
--
-- It exists so the AWARDS ledger can key on the unit instead of on the submission: awards is
-- unique on (team, game, kind, source_id), so writing the unit into source_id makes a retake
-- upsert one row and pay nothing, with no cap logic anywhere. Teams may re-shoot as often as
-- they like and every image is kept -- dedup happens in the ledger, never in the photos, which
-- is the whole reason this is a column here rather than a rule enforced on insert.
--
-- NULL for every kind that has no units: hunts and trophies never hold a submission at all, and
-- an `answer` game holds exactly one, which needs no distinguishing.

alter table submissions add column unit integer;
