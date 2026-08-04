# Mission

I'm organizing a birthday party on August 14th. I would like to organize a QR-code based game. I will scatter and hide QR codes all around the house and they will be the trigger for the game.

## The server

My personal assistent Mega Moeriki will handle hosting the files. However you decide, you can write a `MM-HANDOFF.MD` in which you write the instructions to MM. MM can run Docker containers and manage DNS. The site will be at `bday.moeriki.com`. When we are done we will hand this file to MM. But in reality the whole source code will be on GitHub. So you can reference anything in this repo for assets and other instructions. MM also has access to my home automations.

## Tech stack

- Keep it simple. Just HTML/CSS/JS. Minimal use of frameworks. Just where needed.
- Build for a Docker container.
- Any database is fine. Make sure the data is persisted outside of the container.
- Forms can submit using default HTML actions.
- Let's do the back-end in Node.js
- All pages should show live up-to-date data
- Everything is mobile optimized
- Make sure to make composable UI primitives through CSS classes.

## QR codes

When users scan a QR code a game tile unlocks. They are immediately taken to the game page. Once unlocked it stays unlocked forever.

Some QR codes are not part of the tiles because some games will be treasure hunts or maybe just silly things.

We can do things that are not part of the game (or points).

- Rick-roll.
- A random motivational message.

The treasure hunts QR codes should able to trigger Home Assistant automations.

Some QR codes take you to a hidden page. There can be a close button that takes them back to the dashboard. There's strictly no way back to the page (except the browser back button is allowed)

## Onboarding

Whichever QR code they scan they will land first and foremost on an onboarding page. They can enter their name and get a list of questions. The questions will be in relation to the games we play. Players are encourage to enter as a team of 2-3 players. Once in they'll get a persistent cookie that indentifies them. No passwords required.

They will land on a dashboard that will be their main view for the rest of the game.

## The dashboard

There should be a link to the rules.

- Have fun
- Be nice
- Bedroom is off limits

Maybe more rules. Based on further analysis. We can layout the basic points system or something.

There's one extra rule that should only appear once they actually stumbled upon it.

- Hints cost you N points.

### Header

They will see their (team) name, their score and a grid of game tiles representing the games. The score is accompanied by a vague message on how well they are doing.

- You are in the top 3 (amazing)
- You have chance for top 3 (work harder)
- Your effort is appreciated (you're doing not great)

### Game tiles

All game tiles are locked until they scan its matching QR code. During onboarding off course one tile will immediately be unlocked.

A game tile can have 5 designs:

- Locked
- Unlocked
- Answered
  - Correctly
  - Unknown (some answers can only be evaluated at game end)

The tile will have just the game title in it and how many points they scored with the game.

### Game page

There's a back / close button to go to the dashboard. A game page has 2 sections: header / hero, and answer form.

#### Game Hero

The hero can contain either text (question, statement, riddle) or an asset.

#### Game Form

- Some forms can only be submitted once.
- When the answer is unknown until game end, they can update their answer until game end.
- When the answer is known they the game (tile) can be marked correct.
- On submit we can close the game page back to the dashboard.
- If they open the tile anew the form should be populated with their answer.

#### Hints

There should be a hint button. A game can have 0 to N hints. The hints will be ordered. Every time they press hint they should get sequentially the next hint. A hint cost you 3 points. But they won't know until they do it :D If they press for a hint for the very first time we should show a modal dialog "oh yeah, a hint costs you 3 points". The submit button can say "What?".

## The games

We will have to flesh out each of these ideas so (where applicable):

- They can be included in the questions.
- We know how to setup the game page.
- We know how much points they score and how.

### Game Ideas

The goal is to have fun, be active, and have people talking to each other! Feel free to drop ideas. Feel free to suggest ideas. Anything based on amazing existing games or ice-breakers our absolutely welcome. It's still lacking a little in "have people talking to each other". Also there's no drinking involved yet which is maybe a shame?

- Treasure hunt through lights / home automations
- Treasure hunt through riddles
- Longest yarn
- Who is the closest to the average height
- How many other people have the same favorite color as you
- Whoever has Teddy at the end of the night
- Snel enthousiast. Maar even snel…
- Take a picture of someone drinking or eating.

## The style

I generated `moeriki-birthday-invite.png` with Claude using this prompt "It can be cringe, weird, over-the-top, MS paint vibes". We will use this style all over the project. I would like CSS animations and HTML page transition. Eg. when a game tile unlocks, or an game was completed succesfully. Be creative.

I like the colors. Thick borders and shadows. Gradients. Absolute mixed bag of fonts. The tone especially, use the tone. Feel free to generate some assets or use blink / marquee tags.
