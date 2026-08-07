// Editorial content shown in the "Reviews & Articles" section on the home
// page and at /articles. A static array for now, same pattern as
// lib/whatsNew.js — no admin UI or database table yet, just add a new
// object here (most recent first) when there's a new piece. `type` is
// 'review' (has a `rating` out of 5) or 'article' (no rating).
export const ARTICLES = [
  {
    slug: 'deus-ex-mankind-divided-review',
    type: 'review',
    title: "Deus Ex: Mankind Divided Is Still One of the Best Immersive Sims You Haven't Finished",
    dek: 'Eidos Montreal built one of the best playgrounds the genre has ever seen, then ran out of road to put it on.',
    rating: 4,
    author: 'Shelf Life Team',
    date: '2026-08-07',
    body: [
      "Start with Prague. Not the plot, not Adam Jensen's chrome trench coat, not the aug tree — the city itself. Mankind Divided's central hub is still, years later, one of the best-built spaces an immersive sim has ever handed a player: a district that folds back on itself, where a locked door on the ground floor turns out to have three other ways in if you're willing to climb, hack, or punch through a wall to find them. Most games tell you there are multiple ways to solve a problem. This one actually built them, brick by brick, and made finding the one you like the entire point.",
      "That design philosophy carries through the whole campaign. Every major mission is a small sandbox: vents that reward the small-frame build, ledges that reward Icarus dash, security systems that reward the hacker, and NPCs who reward the player willing to just talk their way through instead. The Praxis kit economy — the currency you spend on new augmentations — is stingy enough that every choice feels like it costs something, which is exactly what makes a build feel like yours instead of a checklist. Titan armor turning you briefly bulletproof, Remote Hacking letting you pop a turret from across the map, the reveal-and-tag vision aug that turns every room into a puzzle before you've even opened the door — these aren't flashy for their own sake, they're systems that talk to the level design and to each other.",
      "Which makes it more frustrating that the story around all of this never gets to finish its sentence. Mankind Divided was built as the first half of a planned two-part arc, and it shows in ways that go past the infamous \"Sarif Industries has been in contact with...\" load-screen typo the internet never let go of. Task Force 29 gets set up as a season-long thread and pays off with a shrug. Golem City, the game's most striking location, exists mostly to establish stakes for a sequel that never came. The final act rushes to a stopping point rather than an ending, and Jensen spends the whole game reacting to a conspiracy instead of ever quite getting ahead of it. If you've heard one complaint about this game, it's this one, and it's fair.",
      "Here's the case for playing it anyway: the moment-to-moment design is good enough to carry a story that doesn't land. Few games this decade have been this generous about letting a player be clever — rewarding a weird route through a ventilation shaft as enthusiastically as a silver-tongued conversation check. It's also, unusually for the genre, a game that rewards a second playthrough with a completely different build rather than just a harder difficulty setting. A stealth-and-hacking run and a combat-and-social run barely feel like the same game.",
      "If it's the kind of thing sitting in your backlog rather than actually installed, it's a good pick to actually start rather than just log as owned — especially since the parts that don't fully land (the plot) are also the parts you can most comfortably let wash over you, while the parts that do land (basically everything else) are what you'll remember. Four stars: not for what it wraps up, but for how well it plays while it doesn't.",
    ],
  },
];
