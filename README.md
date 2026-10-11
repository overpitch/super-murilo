# Super Murilo & Maher

A Mario-style platformer made for (and designed by) Murilo. It runs in a web browser, including Microsoft Edge on Xbox with controllers.

## Play online

**https://overpitch.github.io/super-murilo/**

Works in Chrome, Edge and Safari, and in **Microsoft Edge on Xbox** with controllers. Every push to `main` republishes it automatically (GitHub Pages, from the `main` branch).

### On Xbox
1. Open the address above in Microsoft Edge.
2. **Hold the Menu ☰ button** for about a second so the controller plays the game instead of moving the cursor.
3. For the race, connect a second controller.

## Spelling Bee

A second game in the `spelling bee game` folder: **https://overpitch.github.io/super-murilo/bee**

- Make words of 3 or more letters from the 7 letters in the honeycomb. Every word must use the yellow middle letter, and every puzzle has at least one vowel.
- A word that uses all 7 letters (a pangram) gets 7 bonus points.
- **Shuffle** mixes up the letters. **Reset** clears your words and keeps the letters. **Restart** gives new letters. You can play as many puzzles as you like.
- **Xbox controller:** d-pad or left stick moves the highlight, **A** presses it, **B** deletes, **X** shuffles, **Y** enters the word, **View ⧉** resets, **Menu ☰** gives new letters. Hold **Menu ☰** for a second first, like in Super Murilo.
- Keyboard: type letters, **Enter** to submit, **Backspace** to delete, **Space** to shuffle.
- The words puzzles are built from (common words, slang, animals, food and sports) are in `spelling bee game/words.js`. Other real words count as **bonus words** (`spelling bee game/bonus.js`): they score points but aren't needed to finish.

## Play it on this computer

```bash
python3 -m http.server 8123
```

Then open http://localhost:8123. (Opening `index.html` straight from Finder won't load the game's script files. Use the server.)

## Modes

### 1 Player Adventure (like Mario World)
- You play as **Murilo**.
- Walk around the **Goober Island world map**. Beating a level opens the path to the next one.
- **4 levels:** Sunny Hills, Crystal Cave, Sky Bridges, and Goober Castle, where the **Goober King** waits. Stomp him 3 times (fireballs hurt him a little too).
- **Power-ups** come out of `?` blocks (some blocks give coins, some give power-ups):
  - **Mega Mango**: get big. One hit makes you small again instead of losing a life. Big Murilo breaks bricks.
  - **Fire Pepper**: press **X** to throw bouncing fireballs.
  - **Sky Cape**: hold jump in the air to glide. Run at full speed, then jump and **hold A** to fly.
- 5 lives. 100 coins = 1 extra life. Game over sends you back to the map with 5 lives, and you keep the levels you've beaten.

### 2 Player Race (like Sonic's 2-player mode)
- **Left/right split screen.** Controller 1 is **Murilo** (red), controller 2 is **Maher** (green). Maher jumps higher but slides more when stopping.
- Each player runs their **own copy** of the track. The two sides never touch.
- **2 tracks:** Green Dash (normal) and Sunset Rush (hard). They have springs, speed boost pads, tunnels, and lots of coins.
- **Getting hit** by an enemy makes your coins spill out, and you can grab some back. **Falling** in a hole puts you back at the last checkpoint.
- **Each player's clock** starts at 0:00 when the race starts and stops when *that* player finishes. There's no time limit.
- **Points:** 5000 for finishing first, a fast-time bonus of `(150 − seconds) × 50`, and 100 per coin. Most points wins.

### Difficulty
Pick it on the title screen (select **DIFFICULTY**, then press left/right). The game remembers it. In the race, both players use the same difficulty.

| | Easy | Normal | Hard |
|---|---|---|---|
| Lives to start | 9 | 5 | 3 |
| Goobers | slower | normal | faster |
| Goober King | 2 stomps, slower | 3 stomps | 4 stomps, faster, spits more |
| Blinking (safe) time after a hit | longer | normal | shorter |
| Race: getting hit | lose half your coins | lose all | lose all |

## Controls

| | Xbox controller | Keyboard (1 player) | Keyboard (race P1 / P2) |
|---|---|---|---|
| Move | Left stick or d-pad | Arrows or A/D | Arrows / A, D |
| Jump | A | Space, Up, W or Z | Up / W or Space |
| Run (and throw fireballs) | X (or a trigger) | Shift or X | Right Shift / Left Shift |
| Pause | Menu ☰ | Esc or P | Esc or P |
| Leave level/race (while paused) | View ⧉ | Backspace or Q | Backspace or Q |
| Full screen | | F | F |

**On Xbox:** hold the **Menu ☰** button for about a second to switch the controller from moving the browser cursor to game controls (same as Evil One). The game also keeps the B button from leaving the page.

## Files

- `index.html` loads everything.
- `js/core.js`: screen, sound effects, controller and keyboard input, drawing the heroes and Goobers.
- `js/levels.js`: the adventure levels (drawn as letters: `#` ground, `?` block, `E` enemy…) and the race track builder.
- `js/stage.js`: one hero playing one level: physics, enemies, power-ups, the boss, the race coin-spill.
- `js/game.js`: title screen, world map, race countdown, split screen, results.
- `tests/bot.js`: a robot player that checks every level and track can be finished. In the browser console: load the script, then run `botRace(0)` or `botLevel(3)`.
