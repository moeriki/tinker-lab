-- #79 renamed the night's two moments. The host's words are FREEZE and END: the freeze stops the
-- players and runs the resolvers, the end opens the league to them. "End" now means the second
-- press, where it used to mean the first.
--
-- Both rows are usually absent -- they exist only between the freeze and the morning -- so this
-- is a no-op on every database except one that is mid-night when it rolls forward. It still has
-- to run: leaving the old keys behind would silently unfreeze a frozen game.
update settings set key = 'frozen_at' where key = 'game_ended_at';
update settings set key = 'ended_at'  where key = 'showdown_at';
