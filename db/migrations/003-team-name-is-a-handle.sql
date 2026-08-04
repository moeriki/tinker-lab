-- The team name is DEALT from content/team-names.js rather than typed, because it does a second
-- job: it is the handle a stranger types into a Human Bingo square to name the team that matches.
-- Two teams sharing a name would make that square ambiguous and unscoreable.
--
-- The app deals only from unclaimed words, so this index is not the mechanism -- it is the net
-- underneath it. Two guests finishing the first screen in the same second would otherwise both be
-- dealt the same free word; the loser's insert fails here and the app deals again. See #9.
create unique index teams_name_unique on teams (name);
