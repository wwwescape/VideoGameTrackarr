# Toys-to-Life reference catalog — amiibo, Skylanders, Disney Infinity, LEGO Dimensions

Every Toys-to-Life item VideoGameTrackarr tracks or plans to track. **LEGO Dimensions** is tracked: its packs are seeded from `docs/data/toys_to_life/LEGO_Dimensions_Packs.csv` into the `toys_to_life_items` table. The other lines are still a reference listing the app doesn't read yet.

**On the game page**, a line's base game (LEGO Dimensions, IGDB 11077) shows a **Toys to Life** section with its packs instead of Addons; starter kits are per platform, so only those for the platforms you own the game on appear there (the line's own page lists all of them). IGDB also lists most packs as add-ons of the base game: a game row whose IGDB ID matches a pack's is hidden from every add-on list (a game's Addons, Missing Addons, and the add-ons on Collection, Series and Platform pages) but not deleted, and importing or resyncing the game skips those add-ons.

**Upgrading from add-on tracking:** migration `d4f6a8c0e2b3` (and restoring a backup older than format 5) moves what you tracked on those add-on rows onto the packs: each add-on copy becomes a copy of the pack (owned or wishlisted as it was, with its price), its platform, format, date and notes becoming the copy's notes, and the add-on copy is removed (one with ROM files stays); the add-on's rating (if the pack has none), notes and tags move too. Owning or wishlisting LEGO Dimensions itself on a platform gives that platform's starter kit a copy the same way, unless the kit already has copies.

**Images** are resolved at read time from `backend/static/toys-to-life/<line>/<image filename>`, the same idea as `docs/hardware-reference.md`: drop a correctly named file in and commit, no code or database change needed. **LEGO Dimensions naming rule:** `<set number>-<pack name>.png`, where the pack name is lowercased, every run of non-alphanumeric characters is replaced with a single hyphen, and leading/trailing hyphens are trimmed (e.g. `71203-portal-2-level-pack.png`). The other lines' filenames below are still the planned `.png` names and will be revisited when each line is built. **Image present** reflects the files in that folder when this doc was generated.

## Contents

- [Summary](#summary)
- **[amiibo (932)](#amiibo-932)**
  - [8-bit Mario (2)](#8-bit-mario-2)
  - [Animal Crossing (525)](#animal-crossing-525)
  - [BoxBoy! (1)](#boxboy-1)
  - [Chibi-Robo! (1)](#chibi-robo-1)
  - [Diablo (1)](#diablo-1)
  - [Donkey Kong (1)](#donkey-kong-1)
  - [Fire Emblem (4)](#fire-emblem-4)
  - [Kirby (4)](#kirby-4)
  - [Kirby Air Riders (2)](#kirby-air-riders-2)
  - [Legend Of Zelda (26)](#legend-of-zelda-26)
  - [Mario Sports Superstars (90)](#mario-sports-superstars-90)
  - [Mega Man (1)](#mega-man-1)
  - [Metroid (7)](#metroid-7)
  - [Monster Hunter (9)](#monster-hunter-9)
  - [Monster Hunter Rise (6)](#monster-hunter-rise-6)
  - [My Mario Wooden Blocks (4)](#my-mario-wooden-blocks-4)
  - [Others (2)](#others-2)
  - [Pikmin (1)](#pikmin-1)
  - [Pokemon (2)](#pokemon-2)
  - [Power Pros (6)](#power-pros-6)
  - [Shovel Knight (5)](#shovel-knight-5)
  - [Skylanders (2)](#skylanders-2)
  - [Splatoon (26)](#splatoon-26)
  - [Street Fighter 6 (63)](#street-fighter-6-63)
  - [Super Mario Bros. (22)](#super-mario-bros-22)
  - [Super Nintendo World (9)](#super-nintendo-world-9)
  - [Super Smash Bros. (96)](#super-smash-bros-96)
  - [Xenoblade Chronicles 3 (2)](#xenoblade-chronicles-3-2)
  - [Yoshi's Woolly World (5)](#yoshis-woolly-world-5)
  - [Yu-Gi-Oh! (7)](#yu-gi-oh-7)
- **[Skylanders (565)](#skylanders-565)**
  - [Spyro's Adventure (54)](#spyros-adventure-54)
  - [Giants (91)](#giants-91)
  - [Swap Force (99)](#swap-force-99)
  - [Trap Team (153)](#trap-team-153)
  - [SuperChargers (90)](#superchargers-90)
  - [Imaginators (78)](#imaginators-78)
- **[Disney Infinity (322)](#disney-infinity-322)**
  - [Disney Infinity 1.0 (105)](#disney-infinity-10-105)
  - [Disney Infinity 2.0 (127)](#disney-infinity-20-127)
  - [Disney Infinity 3.0 (90)](#disney-infinity-30-90)
- **[LEGO Dimensions (67)](#lego-dimensions-67)**

## Summary

| Franchise | Rows | Breakdown | Images present |
|---|---|---|---|
| amiibo | 932 | Card: 674, Figure: 240, Band: 9, Yarn: 5, Block: 4 | 0 |
| Skylanders | 565 | Core: 202, Trap: 59, SuperCharger: 47, Sensei: 44, Vehicle: 39, Creation Crystal: 34, Swap Force: 30, Trap Master: 29, Mini: 27, Magic Item: 22, Giant: 15, Adventure Pack: 13, Racing Trophy: 4 | 0 |
| Disney Infinity | 322 | Power Disc (hexagonal): 123, Figure: 122, Power Disc (round): 58, Play Set / Toy Box Game: 19 | 0 |
| LEGO Dimensions | 67 | Fun Pack: 38, Level Pack: 10, Team Pack: 9, Starter Pack: 5, Story Pack: 3, Polybag / Promo: 2 | 67 |

Generated 2026-09-28. Review names and details before they become the tracked datasets.

## amiibo (932)

### 8-bit Mario (2)

| Name | Character | Game series | Type | amiibo ID | Image filename | Image present |
|---|---|---|---|---|---|---|
| 8-Bit Mario Classic Color | Mario | Super Mario | Figure | `00000000-02380602` | `amiibo/8-bit-mario-classic-color-8-bit-mario.png` | — |
| 8-Bit Mario Modern Color | Mario | Super Mario | Figure | `00000000-02390602` | `amiibo/8-bit-mario-modern-color-8-bit-mario.png` | — |

### Animal Crossing (525)

| Name | Character | Game series | Type | amiibo ID | Image filename | Image present |
|---|---|---|---|---|---|---|
| Ace | Ace | Animal Crossing | Card | `0a1b0001-03d20502` | `amiibo/ace-animal-crossing.png` | — |
| Admiral | Admiral | Animal Crossing | Card | `02330001-03060502` | `amiibo/admiral-animal-crossing.png` | — |
| Agent S | Agent S | Animal Crossing | Card | `04e20001-01090502` | `amiibo/agent-s-animal-crossing.png` | — |
| Agnes | Agnes | Animal Crossing | Card | `04890001-00ef0502` | `amiibo/agnes-animal-crossing.png` | — |
| Al | Al | Animal Crossing | Card | `03710001-005c0502` | `amiibo/al-animal-crossing.png` | — |
| Alfonso | Alfonso | Animal Crossing | Card | `02c30001-00dc0502` | `amiibo/alfonso-animal-crossing.png` | — |
| Alice | Alice | Animal Crossing | Card | `03bd0001-00f90502` | `amiibo/alice-animal-crossing.png` | — |
| Alli | Alli | Animal Crossing | Card | `02c40001-00670502` | `amiibo/alli-animal-crossing.png` | — |
| Amelia | Amelia | Animal Crossing | Card | `044c0001-008e0502` | `amiibo/amelia-animal-crossing.png` | — |
| Anabelle | Anabelle | Animal Crossing | Card | `02030001-019a0502` | `amiibo/anabelle-animal-crossing.png` | — |
| Anchovy | Anchovy | Animal Crossing | Card | `022f0001-011e0502` | `amiibo/anchovy-animal-crossing.png` | — |
| Angus | Angus | Animal Crossing | Card | `024a0001-01d10502` | `amiibo/angus-animal-crossing.png` | — |
| Anicotti | Anicotti | Animal Crossing | Card | `04160001-00fb0502` | `amiibo/anicotti-animal-crossing.png` | — |
| Ankha | Ankha | Animal Crossing | Card | `02700001-00ff0502` | `amiibo/ankha-animal-crossing.png` | — |
| Annalisa | Annalisa | Animal Crossing | Card | `02080001-00960502` | `amiibo/annalisa-animal-crossing.png` | — |
| Annalise | Annalise | Animal Crossing | Card | `03ad0001-01b20502` | `amiibo/annalise-animal-crossing.png` | — |
| Antonio | Antonio | Animal Crossing | Card | `02010001-016a0502` | `amiibo/antonio-animal-crossing.png` | — |
| Apollo | Apollo | Animal Crossing | Card | `044b0001-016c0502` | `amiibo/apollo-animal-crossing.png` | — |
| Apple | Apple | Animal Crossing | Card | `037f0001-01aa0502` | `amiibo/apple-animal-crossing.png` | — |
| Astrid | Astrid | Animal Crossing | Card | `03d60001-01570502` | `amiibo/astrid-animal-crossing.png` | — |
| Audie | Audie | Animal Crossing | Card | `0a0c0001-03c30502` | `amiibo/audie-animal-crossing.png` | — |
| Aurora | Aurora | Animal Crossing | Card | `045f0001-01a80502` | `amiibo/aurora-animal-crossing.png` | — |
| Ava | Ava | Animal Crossing | Card | `029e0001-013d0502` | `amiibo/ava-animal-crossing.png` | — |
| Avery | Avery | Animal Crossing | Card | `04500001-00cf0502` | `amiibo/avery-animal-crossing.png` | — |
| Axel | Axel | Animal Crossing | Card | `03290001-009d0502` | `amiibo/axel-animal-crossing.png` | — |
| Azalea | Azalea | Animal Crossing | Card | `0a1e0001-03d50502` | `amiibo/azalea-animal-crossing.png` | — |
| Baabara | Baabara | Animal Crossing | Card | `04c60001-01670502` | `amiibo/baabara-animal-crossing.png` | — |
| Bam | Bam | Animal Crossing | Card | `02d70001-01300502` | `amiibo/bam-animal-crossing.png` | — |
| Bangle | Bangle | Animal Crossing | Card | `04fd0001-007b0502` | `amiibo/bangle-animal-crossing.png` | — |
| Barold | Barold | Animal Crossing | Card | `028d0001-01bd0502` | `amiibo/barold-animal-crossing.png` | — |
| Bea | Bea | Animal Crossing | Card | `02f40001-03050502` | `amiibo/bea-animal-crossing.png` | — |
| Beardo | Beardo | Animal Crossing | Card | `02210001-013c0502` | `amiibo/beardo-animal-crossing.png` | — |
| Beau | Beau | Animal Crossing | Card | `02dd0001-00ea0502` | `amiibo/beau-animal-crossing.png` | — |
| Becky | Becky | Animal Crossing | Card | `02a20001-01ba0502` | `amiibo/becky-animal-crossing.png` | — |
| Bella | Bella | Animal Crossing | Card | `040e0001-00880502` | `amiibo/bella-animal-crossing.png` | — |
| Benedict | Benedict | Animal Crossing | Card | `029a0001-00ee0502` | `amiibo/benedict-animal-crossing.png` | — |
| Benjamin | Benjamin | Animal Crossing | Card | `02fa0001-00970502` | `amiibo/benjamin-animal-crossing.png` | — |
| Bertha | Bertha | Animal Crossing | Card | `03930001-00a00502` | `amiibo/bertha-animal-crossing.png` | — |
| Bettina | Bettina | Animal Crossing | Card | `041b0001-00f10502` | `amiibo/bettina-animal-crossing.png` | — |
| Bianca | Bianca | Animal Crossing | Card | `05000001-00e70502` | `amiibo/bianca-animal-crossing.png` | — |
| Biff | Biff | Animal Crossing | Card | `03940001-00890502` | `amiibo/biff-animal-crossing.png` | — |
| Big Top | Big Top | Animal Crossing | Card | `03250001-010a0502` | `amiibo/big-top-animal-crossing.png` | — |
| Bill | Bill | Animal Crossing | Card | `03070001-00640502` | `amiibo/bill-animal-crossing.png` | — |
| Billy | Billy | Animal Crossing | Card | `03580001-02fa0502` | `amiibo/billy-animal-crossing.png` | — |
| Biskit | Biskit | Animal Crossing | Card | `02ed0001-015a0502` | `amiibo/biskit-animal-crossing.png` | — |
| Bitty | Bitty | Animal Crossing | Card | `03950001-02fc0502` | `amiibo/bitty-animal-crossing.png` | — |
| Blaire | Blaire | Animal Crossing | Card | `04de0001-00ce0502` | `amiibo/blaire-animal-crossing.png` | — |
| Blanca | Blanca | Animal Crossing | Card | `01b30001-00b50502` | `amiibo/blanca-animal-crossing.png` | — |
| Blanche | Blanche | Animal Crossing | Card | `043e0001-01490502` | `amiibo/blanche-animal-crossing.png` | — |
| Blathers | Blathers | Animal Crossing | Figure | `01920000-02470502` | `amiibo/blathers-animal-crossing-figure.png` | — |
| Blathers | Blathers | Animal Crossing | Card | `01920001-010d0502` | `amiibo/blathers-animal-crossing-card-1.png` | — |
| Blathers | Blathers | Animal Crossing | Card | `01920001-03ad0502` | `amiibo/blathers-animal-crossing-card-2.png` | — |
| Bluebear | Bluebear | Animal Crossing | Card | `027d0001-00630502` | `amiibo/bluebear-animal-crossing.png` | — |
| Bob | Bob | Animal Crossing | Card | `025d0001-00550502` | `amiibo/bob-animal-crossing.png` | — |
| Bonbon | Bonbon | Animal Crossing | Card | `04a50001-00740502` | `amiibo/bonbon-animal-crossing.png` | — |
| Bones | Bones | Animal Crossing | Card | `02ee0001-01990502` | `amiibo/bones-animal-crossing.png` | — |
| Booker | Booker | Animal Crossing | Card | `019e0001-00ad0502` | `amiibo/booker-animal-crossing.png` | — |
| Boomer | Boomer | Animal Crossing | Card | `04690001-01640502` | `amiibo/boomer-animal-crossing.png` | — |
| Boone | Boone | Animal Crossing | Card | `036b0001-018b0502` | `amiibo/boone-animal-crossing.png` | — |
| Boots | Boots | Animal Crossing | Card | `02c50001-03080502` | `amiibo/boots-animal-crossing.png` | — |
| Boris | Boris | Animal Crossing | Card | `04810001-02f10502` | `amiibo/boris-animal-crossing.png` | — |
| Boyd | Boyd | Animal Crossing | Card | `036e0001-02fb0502` | `amiibo/boyd-animal-crossing.png` | — |
| Bree | Bree | Animal Crossing | Card | `040f0001-01500502` | `amiibo/bree-animal-crossing.png` | — |
| Brewster | Brewster | Animal Crossing | Card | `01900001-01710502` | `amiibo/brewster-animal-crossing.png` | — |
| Broccolo | Broccolo | Animal Crossing | Card | `04180001-00d80502` | `amiibo/broccolo-animal-crossing.png` | — |
| Broffina | Broffina | Animal Crossing | Card | `02a50001-018c0502` | `amiibo/broffina-animal-crossing.png` | — |
| Bruce | Bruce | Animal Crossing | Card | `02d90001-01c80502` | `amiibo/bruce-animal-crossing.png` | — |
| Bubbles | Bubbles | Animal Crossing | Card | `03920001-01270502` | `amiibo/bubbles-animal-crossing.png` | — |
| Buck | Buck | Animal Crossing | Card | `03a40001-014f0502` | `amiibo/buck-animal-crossing.png` | — |
| Bud | Bud | Animal Crossing | Card | `03e60001-00ec0502` | `amiibo/bud-animal-crossing.png` | — |
| Bunnie | Bunnie | Animal Crossing | Card | `04940001-009a0502` | `amiibo/bunnie-animal-crossing.png` | — |
| Butch | Butch | Animal Crossing | Card | `02eb0001-00de0502` | `amiibo/butch-animal-crossing.png` | — |
| Buzz | Buzz | Animal Crossing | Card | `044e0001-03150502` | `amiibo/buzz-animal-crossing.png` | — |
| C.J. | C.J. | Animal Crossing | Card | `0a020001-03b30502` | `amiibo/c-j-animal-crossing.png` | — |
| Cally | Cally | Animal Crossing | Card | `04e80001-01ce0502` | `amiibo/cally-animal-crossing.png` | — |
| Camofrog | Camofrog | Animal Crossing | Card | `033b0001-00fa0502` | `amiibo/camofrog-animal-crossing.png` | — |
| Canberra | Canberra | Animal Crossing | Card | `03c40001-012b0502` | `amiibo/canberra-animal-crossing.png` | — |
| Candi | Candi | Animal Crossing | Card | `04140001-030a0502` | `amiibo/candi-animal-crossing.png` | — |
| Carmen | Carmen | Animal Crossing | Card | `04a40001-00d40502` | `amiibo/carmen-animal-crossing.png` | — |
| Caroline | Caroline | Animal Crossing | Card | `04e30001-01650502` | `amiibo/caroline-animal-crossing.png` | — |
| Carrie | Carrie | Animal Crossing | Card | `03d30001-02f30502` | `amiibo/carrie-animal-crossing.png` | — |
| Cashmere | Cashmere | Animal Crossing | Card | `04c90001-030d0502` | `amiibo/cashmere-animal-crossing.png` | — |
| Celeste | Celeste | Animal Crossing | Figure | `01930000-02480502` | `amiibo/celeste-animal-crossing-figure.png` | — |
| Celeste | Celeste | Animal Crossing | Card | `01930001-01740502` | `amiibo/celeste-animal-crossing-card-2.png` | — |
| Celeste | Celeste | Animal Crossing | Card | `01930001-03ae0502` | `amiibo/celeste-animal-crossing-card-1.png` | — |
| Celia | Celia | Animal Crossing | Card | `04540001-01ae0502` | `amiibo/celia-animal-crossing.png` | — |
| Cephalobot | Cephalobot | Animal Crossing | Card | `0a170001-03ce0502` | `amiibo/cephalobot-animal-crossing.png` | — |
| Cesar | Cesar | Animal Crossing | Card | `03690001-00d30502` | `amiibo/cesar-animal-crossing.png` | — |
| Chabwick | Chabwick | Animal Crossing | Card | `0a190001-03d00502` | `amiibo/chabwick-animal-crossing.png` | — |
| Chadder | Chadder | Animal Crossing | Card | `041e0001-015f0502` | `amiibo/chadder-animal-crossing.png` | — |
| Chai | Chai | Animal Crossing | Card | `032e0101-031c0502` | `amiibo/chai-animal-crossing.png` | — |
| Charlise | Charlise | Animal Crossing | Card | `02200001-00fd0502` | `amiibo/charlise-animal-crossing.png` | — |
| Chelsea | Chelsea | Animal Crossing | Card | `02e00101-031d0502` | `amiibo/chelsea-animal-crossing.png` | — |
| Cheri | Cheri | Animal Crossing | Card | `02870001-005a0502` | `amiibo/cheri-animal-crossing.png` | — |
| Cherry | Cherry | Animal Crossing | Card | `02fb0001-00900502` | `amiibo/cherry-animal-crossing.png` | — |
| Chester | Chester | Animal Crossing | Card | `028c0001-013e0502` | `amiibo/chester-animal-crossing.png` | — |
| Chevre | Chevre | Animal Crossing | Card | `03560001-01350502` | `amiibo/chevre-animal-crossing.png` | — |
| Chief | Chief | Animal Crossing | Card | `050b0001-00990502` | `amiibo/chief-animal-crossing.png` | — |
| Chip | Chip | Animal Crossing | Card | `019a0001-00b70502` | `amiibo/chip-animal-crossing.png` | — |
| Chops | Chops | Animal Crossing | Card | `04860001-00fc0502` | `amiibo/chops-animal-crossing.png` | — |
| Chow | Chow | Animal Crossing | Card | `02170001-01b30502` | `amiibo/chow-animal-crossing.png` | — |
| Chrissy | Chrissy | Animal Crossing | Card | `04a10001-016f0502` | `amiibo/chrissy-animal-crossing.png` | — |
| Claude | Claude | Animal Crossing | Card | `049f0001-03010502` | `amiibo/claude-animal-crossing.png` | — |
| Claudia | Claudia | Animal Crossing | Card | `04ff0001-01620502` | `amiibo/claudia-animal-crossing.png` | — |
| Clay | Clay | Animal Crossing | Card | `03830001-009b0502` | `amiibo/clay-animal-crossing.png` | — |
| Cleo | Cleo | Animal Crossing | Card | `03ab0001-03160502` | `amiibo/cleo-animal-crossing.png` | — |
| Clyde | Clyde | Animal Crossing | Card | `03ae0001-00870502` | `amiibo/clyde-animal-crossing.png` | — |
| Coach | Coach | Animal Crossing | Card | `02510001-00c10502` | `amiibo/coach-animal-crossing.png` | — |
| Cobb | Cobb | Animal Crossing | Card | `04800001-008d0502` | `amiibo/cobb-animal-crossing.png` | — |
| Coco | Coco | Animal Crossing | Card | `04960001-00d90502` | `amiibo/coco-animal-crossing.png` | — |
| Cole | Cole | Animal Crossing | Card | `04a60001-00a30502` | `amiibo/cole-animal-crossing.png` | — |
| Colton | Colton | Animal Crossing | Card | `03af0001-012c0502` | `amiibo/colton-animal-crossing.png` | — |
| Cookie | Cookie | Animal Crossing | Card | `02f20001-00cc0502` | `amiibo/cookie-animal-crossing.png` | — |
| Copper | Copper | Animal Crossing | Card | `019d0001-00ac0502` | `amiibo/copper-animal-crossing.png` | — |
| Cousteau | Cousteau | Animal Crossing | Card | `03420001-01280502` | `amiibo/cousteau-animal-crossing.png` | — |
| Cranston | Cranston | Animal Crossing | Card | `043c0001-01cb0502` | `amiibo/cranston-animal-crossing.png` | — |
| Croque | Croque | Animal Crossing | Card | `03490001-018d0502` | `amiibo/croque-animal-crossing.png` | — |
| Cube | Cube | Animal Crossing | Card | `04610001-01610502` | `amiibo/cube-animal-crossing.png` | — |
| Curlos | Curlos | Animal Crossing | Card | `04cd0001-01520502` | `amiibo/curlos-animal-crossing.png` | — |
| Curly | Curly | Animal Crossing | Card | `04780001-01630502` | `amiibo/curly-animal-crossing.png` | — |
| Curt | Curt | Animal Crossing | Card | `02160001-00570502` | `amiibo/curt-animal-crossing.png` | — |
| Cyd | Cyd | Animal Crossing | Card | `0a0d0001-03c40502` | `amiibo/cyd-animal-crossing.png` | — |
| Cyrano | Cyrano | Animal Crossing | Card | `02000001-00a10502` | `amiibo/cyrano-animal-crossing.png` | — |
| Cyrus | Cyrus | Animal Crossing | Figure | `018b0000-02460502` | `amiibo/cyrus-animal-crossing-figure.png` | — |
| Cyrus | Cyrus | Animal Crossing | Card | `018b0001-01150502` | `amiibo/cyrus-animal-crossing-card.png` | — |
| Daisy | Daisy | Animal Crossing | Card | `02f10001-01450502` | `amiibo/daisy-animal-crossing.png` | — |
| Daisy Mae | Daisy Mae | Animal Crossing | Card | `0a040001-03b50502` | `amiibo/daisy-mae-animal-crossing.png` | — |
| Deena | Deena | Animal Crossing | Card | `030b0001-00790502` | `amiibo/deena-animal-crossing.png` | — |
| Deirdre | Deirdre | Animal Crossing | Card | `02da0001-01330502` | `amiibo/deirdre-animal-crossing.png` | — |
| Del | Del | Animal Crossing | Card | `02c70001-01220502` | `amiibo/del-animal-crossing.png` | — |
| Deli | Deli | Animal Crossing | Card | `04010001-00660502` | `amiibo/deli-animal-crossing.png` | — |
| Derwin | Derwin | Animal Crossing | Card | `030f0001-016d0502` | `amiibo/derwin-animal-crossing.png` | — |
| Diana | Diana | Animal Crossing | Card | `02de0001-009c0502` | `amiibo/diana-animal-crossing.png` | — |
| Digby | Digby | Animal Crossing | Figure | `018c0000-02430502` | `amiibo/digby-animal-crossing-figure.png` | — |
| Digby | Digby | Animal Crossing | Card | `018c0001-004c0502` | `amiibo/digby-animal-crossing-card.png` | — |
| Digby - Raincoat | Digby | Animal Crossing | Card | `018c0101-01180502` | `amiibo/digby-raincoat-animal-crossing.png` | — |
| Diva | Diva | Animal Crossing | Card | `034a0001-01430502` | `amiibo/diva-animal-crossing.png` | — |
| Dizzy | Dizzy | Animal Crossing | Card | `03240001-01890502` | `amiibo/dizzy-animal-crossing.png` | — |
| DJ KK | K.K. Slider | Animal Crossing | Card | `01820101-00460502` | `amiibo/dj-kk-animal-crossing.png` | — |
| Dobie | Dobie | Animal Crossing | Card | `050f0001-03140502` | `amiibo/dobie-animal-crossing.png` | — |
| Doc | Doc | Animal Crossing | Card | `049e0001-01b70502` | `amiibo/doc-animal-crossing.png` | — |
| Dom | Dom | Animal Crossing | Card | `0a0b0001-03c20502` | `amiibo/dom-animal-crossing.png` | — |
| Don Resetti | Don Resetti | Animal Crossing | Card | `018f0001-00b30502` | `amiibo/don-resetti-animal-crossing.png` | — |
| Don Resetti - Without Hat | Don Resetti | Animal Crossing | Card | `018f0101-01190502` | `amiibo/don-resetti-without-hat-animal-crossing.png` | — |
| Dora | Dora | Animal Crossing | Card | `040c0001-01590502` | `amiibo/dora-animal-crossing.png` | — |
| Dotty | Dotty | Animal Crossing | Card | `04950001-01920502` | `amiibo/dotty-animal-crossing.png` | — |
| Drago | Drago | Animal Crossing | Card | `02cb0001-01360502` | `amiibo/drago-animal-crossing.png` | — |
| Drake | Drake | Animal Crossing | Card | `03100001-00f80502` | `amiibo/drake-animal-crossing.png` | — |
| Drift | Drift | Animal Crossing | Card | `033c0001-01000502` | `amiibo/drift-animal-crossing.png` | — |
| Ed | Ed | Animal Crossing | Card | `03aa0001-00e60502` | `amiibo/ed-animal-crossing.png` | — |
| Egbert | Egbert | Animal Crossing | Card | `029b0001-00cb0502` | `amiibo/egbert-animal-crossing.png` | — |
| Elise | Elise | Animal Crossing | Card | `03fe0001-01a40502` | `amiibo/elise-animal-crossing.png` | — |
| Ellie | Ellie | Animal Crossing | Card | `032a0001-03070502` | `amiibo/ellie-animal-crossing.png` | — |
| Elmer | Elmer | Animal Crossing | Card | `03a70001-01a10502` | `amiibo/elmer-animal-crossing.png` | — |
| Eloise | Eloise | Animal Crossing | Card | `03260001-01390502` | `amiibo/eloise-animal-crossing.png` | — |
| Elvis | Elvis | Animal Crossing | Card | `03e70001-012a0502` | `amiibo/elvis-animal-crossing.png` | — |
| Erik | Erik | Animal Crossing | Card | `02df0001-01910502` | `amiibo/erik-animal-crossing.png` | — |
| Eugene | Eugene | Animal Crossing | Card | `03c60001-00930502` | `amiibo/eugene-animal-crossing.png` | — |
| Eunice | Eunice | Animal Crossing | Card | `04c70001-00940502` | `amiibo/eunice-animal-crossing.png` | — |
| Faith | Faith | Animal Crossing | Card | `0a200001-03d70502` | `amiibo/faith-animal-crossing.png` | — |
| Fang | Fang | Animal Crossing | Card | `05110001-01950502` | `amiibo/fang-animal-crossing.png` | — |
| Fauna | Fauna | Animal Crossing | Card | `02d60001-00560502` | `amiibo/fauna-animal-crossing.png` | — |
| Felicity | Felicity | Animal Crossing | Card | `026e0001-00ba0502` | `amiibo/felicity-animal-crossing.png` | — |
| Filbert | Filbert | Animal Crossing | Card | `04df0001-00e80502` | `amiibo/filbert-animal-crossing.png` | — |
| Flick | Flick | Animal Crossing | Card | `0a030001-03b40502` | `amiibo/flick-animal-crossing.png` | — |
| Flip | Flip | Animal Crossing | Card | `03ff0001-00f40502` | `amiibo/flip-animal-crossing.png` | — |
| Flo | Flo | Animal Crossing | Card | `046c0001-008c0502` | `amiibo/flo-animal-crossing.png` | — |
| Flora | Flora | Animal Crossing | Card | `043f0001-01550502` | `amiibo/flora-animal-crossing.png` | — |
| Flurry | Flurry | Animal Crossing | Card | `03840001-00860502` | `amiibo/flurry-animal-crossing.png` | — |
| Francine | Francine | Animal Crossing | Card | `04a00001-016e0502` | `amiibo/francine-animal-crossing.png` | — |
| Frank | Frank | Animal Crossing | Card | `04510001-015e0502` | `amiibo/frank-animal-crossing.png` | — |
| Franklin | Franklin | Animal Crossing | Card | `01ae0001-011b0502` | `amiibo/franklin-animal-crossing.png` | — |
| Freckles | Freckles | Animal Crossing | Card | `030e0001-012f0502` | `amiibo/freckles-animal-crossing.png` | — |
| Frett | Frett | Animal Crossing | Card | `0a1d0001-03d40502` | `amiibo/frett-animal-crossing.png` | — |
| Freya | Freya | Animal Crossing | Card | `05100001-01070502` | `amiibo/freya-animal-crossing.png` | — |
| Friga | Friga | Animal Crossing | Card | `04630001-01310502` | `amiibo/friga-animal-crossing.png` | — |
| Frita | Frita | Animal Crossing | Card | `04d00001-01960502` | `amiibo/frita-animal-crossing.png` | — |
| Frobert | Frobert | Animal Crossing | Card | `033a0001-01cc0502` | `amiibo/frobert-animal-crossing.png` | — |
| Fuchsia | Fuchsia | Animal Crossing | Card | `02dc0001-00be0502` | `amiibo/fuchsia-animal-crossing.png` | — |
| Gabi | Gabi | Animal Crossing | Card | `04990001-00df0502` | `amiibo/gabi-animal-crossing.png` | — |
| Gala | Gala | Animal Crossing | Card | `04850001-014c0502` | `amiibo/gala-animal-crossing.png` | — |
| Gaston | Gaston | Animal Crossing | Card | `04980001-014a0502` | `amiibo/gaston-animal-crossing.png` | — |
| Gayle | Gayle | Animal Crossing | Card | `02ca0001-01ca0502` | `amiibo/gayle-animal-crossing.png` | — |
| Genji | Genji | Animal Crossing | Card | `049c0001-01400502` | `amiibo/genji-animal-crossing.png` | — |
| Gigi | Gigi | Animal Crossing | Card | `03480001-006b0502` | `amiibo/gigi-animal-crossing.png` | — |
| Gladys | Gladys | Animal Crossing | Card | `04370001-01050502` | `amiibo/gladys-animal-crossing.png` | — |
| Gloria | Gloria | Animal Crossing | Card | `03160001-01c00502` | `amiibo/gloria-animal-crossing.png` | — |
| Goldie | Goldie | Animal Crossing | Card | `02ea0001-01800502` | `amiibo/goldie-animal-crossing.png` | — |
| Goldie - Amiibo Festival | Goldie | Animal Crossing | Card | `02ea0001-01d50502` | `amiibo/goldie-amiibo-festival-animal-crossing.png` | — |
| Gonzo | Gonzo | Animal Crossing | Card | `03c00001-03100502` | `amiibo/gonzo-animal-crossing.png` | — |
| Goose | Goose | Animal Crossing | Card | `02990001-00950502` | `amiibo/goose-animal-crossing.png` | — |
| Gracie | Gracie | Animal Crossing | Card | `01a90001-01760502` | `amiibo/gracie-animal-crossing.png` | — |
| Graham | Graham | Animal Crossing | Card | `03800001-01870502` | `amiibo/graham-animal-crossing.png` | — |
| Grams | Grams | Animal Crossing | Card | `01990001-01160502` | `amiibo/grams-animal-crossing.png` | — |
| Greta | Greta | Animal Crossing | Card | `041c0001-01410502` | `amiibo/greta-animal-crossing.png` | — |
| Grizzly | Grizzly | Animal Crossing | Card | `021d0001-01cd0502` | `amiibo/grizzly-animal-crossing.png` | — |
| Groucho | Groucho | Animal Crossing | Card | `021a0001-00da0502` | `amiibo/groucho-animal-crossing.png` | — |
| Gruff | Gruff | Animal Crossing | Card | `035a0001-00850502` | `amiibo/gruff-animal-crossing.png` | — |
| Gulliver | Gulliver | Animal Crossing | Card | `01a20001-017d0502` | `amiibo/gulliver-animal-crossing-card-2.png` | — |
| Gulliver | Gulliver | Animal Crossing | Card | `01a20001-03b90502` | `amiibo/gulliver-animal-crossing-card-1.png` | — |
| Gwen | Gwen | Animal Crossing | Card | `04640001-00c00502` | `amiibo/gwen-animal-crossing.png` | — |
| Hamlet | Hamlet | Animal Crossing | Card | `037e0001-01560502` | `amiibo/hamlet-animal-crossing.png` | — |
| Hamphrey | Hamphrey | Animal Crossing | Card | `03850001-01060502` | `amiibo/hamphrey-animal-crossing.png` | — |
| Hans | Hans | Animal Crossing | Card | `03730001-01340502` | `amiibo/hans-animal-crossing.png` | — |
| Harriet | Harriet | Animal Crossing | Card | `01910001-004e0502` | `amiibo/harriet-animal-crossing.png` | — |
| Harry | Harry | Animal Crossing | Card | `03980001-00bf0502` | `amiibo/harry-animal-crossing.png` | — |
| Harvey | Harvey | Animal Crossing | Card | `0a050001-03b80502` | `amiibo/harvey-animal-crossing.png` | — |
| Hazel | Hazel | Animal Crossing | Card | `04ef0001-013b0502` | `amiibo/hazel-animal-crossing.png` | — |
| Henry | Henry | Animal Crossing | Card | `034b0001-009f0502` | `amiibo/henry-animal-crossing.png` | — |
| Hippeux | Hippeux | Animal Crossing | Card | `03990001-01c20502` | `amiibo/hippeux-animal-crossing.png` | — |
| Hopkins | Hopkins | Animal Crossing | Card | `04a20001-02e80502` | `amiibo/hopkins-animal-crossing.png` | — |
| Hopper | Hopper | Animal Crossing | Card | `04620001-00f60502` | `amiibo/hopper-animal-crossing.png` | — |
| Hornsby | Hornsby | Animal Crossing | Card | `04b60001-02ec0502` | `amiibo/hornsby-animal-crossing.png` | — |
| Huck | Huck | Animal Crossing | Card | `03430001-02ef0502` | `amiibo/huck-animal-crossing.png` | — |
| Hugh | Hugh | Animal Crossing | Card | `047b0001-00f50502` | `amiibo/hugh-animal-crossing.png` | — |
| Iggly | Iggly | Animal Crossing | Card | `046a0001-01d00502` | `amiibo/iggly-animal-crossing.png` | — |
| Ike | Ike | Animal Crossing | Card | `021f0001-03170502` | `amiibo/ike-animal-crossing.png` | — |
| Ione | Ione | Animal Crossing | Card | `0a120001-03c90502` | `amiibo/ione-animal-crossing.png` | — |
| Isabelle | Isabelle | Animal Crossing | Card | `01810001-00440502` | `amiibo/isabelle-animal-crossing-card-1.png` | — |
| Isabelle | Isabelle | Animal Crossing | Card | `01810401-03aa0502` | `amiibo/isabelle-animal-crossing-card-2.png` | — |
| Isabelle - Character Parfait | Isabelle | Animal Crossing | Card | `01810001-01d40502` | `amiibo/isabelle-character-parfait-animal-crossing.png` | — |
| Isabelle - Dress | Isabelle | Animal Crossing | Card | `01810301-01700502` | `amiibo/isabelle-dress-animal-crossing.png` | — |
| Isabelle - Kimono | Isabelle | Animal Crossing | Card | `01810201-011a0502` | `amiibo/isabelle-kimono-animal-crossing.png` | — |
| Isabelle - Summer Outfit | Isabelle | Animal Crossing | Figure | `01810000-024b0502` | `amiibo/isabelle-summer-outfit-animal-crossing.png` | — |
| Isabelle - Sweater | Isabelle | Animal Crossing | Card | `01810501-03bf0502` | `amiibo/isabelle-sweater-animal-crossing.png` | — |
| Isabelle - Winter | Isabelle | Animal Crossing | Card | `01810101-00b40502` | `amiibo/isabelle-winter-animal-crossing.png` | — |
| Isabelle - Winter Outfit | Isabelle | Animal Crossing | Figure | `01810100-023f0502` | `amiibo/isabelle-winter-outfit-animal-crossing.png` | — |
| Jack | Jack | Animal Crossing | Card | `01ad0001-00b80502` | `amiibo/jack-animal-crossing.png` | — |
| Jacob | Jacob | Animal Crossing | Card | `02380001-02f80502` | `amiibo/jacob-animal-crossing.png` | — |
| Jacques | Jacques | Animal Crossing | Card | `023d0001-01b50502` | `amiibo/jacques-animal-crossing.png` | — |
| Jambette | Jambette | Animal Crossing | Card | `03450001-005f0502` | `amiibo/jambette-animal-crossing.png` | — |
| Jay | Jay | Animal Crossing | Card | `022d0001-00f20502` | `amiibo/jay-animal-crossing.png` | — |
| Jeremiah | Jeremiah | Animal Crossing | Card | `033f0001-008f0502` | `amiibo/jeremiah-animal-crossing.png` | — |
| Jingle | Jingle | Animal Crossing | Card | `01af0001-011c0502` | `amiibo/jingle-animal-crossing.png` | — |
| Jitters | Jitters | Animal Crossing | Card | `02310001-006a0502` | `amiibo/jitters-animal-crossing.png` | — |
| Joan | Joan | Animal Crossing | Card | `01a30001-004a0502` | `amiibo/joan-animal-crossing.png` | — |
| Joey | Joey | Animal Crossing | Card | `03080001-014d0502` | `amiibo/joey-animal-crossing.png` | — |
| Judy | Judy | Animal Crossing | Card | `0a0e0001-03c50502` | `amiibo/judy-animal-crossing.png` | — |
| Julia | Julia | Animal Crossing | Card | `043b0001-03030502` | `amiibo/julia-animal-crossing.png` | — |
| Julian | Julian | Animal Crossing | Card | `03b10001-00f00502` | `amiibo/julian-animal-crossing.png` | — |
| June | June | Animal Crossing | Card | `028a0001-02e90502` | `amiibo/june-animal-crossing.png` | — |
| K. K. Slider | K.K. Slider | Animal Crossing | Figure | `01820000-02400502` | `amiibo/k-k-slider-animal-crossing-figure.png` | — |
| K. K. Slider - Pikopuri | K.K. Slider | Animal Crossing | Card | `01820001-01d80502` | `amiibo/k-k-slider-pikopuri-animal-crossing.png` | — |
| K.K. Slider | K.K. Slider | Animal Crossing | Card | `01820001-00a80502` | `amiibo/k-k-slider-animal-crossing-card-1.png` | — |
| K.K. Slider | K.K. Slider | Animal Crossing | Card | `01820001-03b20502` | `amiibo/k-k-slider-animal-crossing-card-2.png` | — |
| Kabuki | Kabuki | Animal Crossing | Card | `02660001-00680502` | `amiibo/kabuki-animal-crossing.png` | — |
| Kapp'n | Kapp'n | Animal Crossing | Figure | `01960000-024e0502` | `amiibo/kappn-animal-crossing-figure.png` | — |
| Kapp'n | Kapp'n | Animal Crossing | Card | `01960001-00480502` | `amiibo/kappn-animal-crossing-card.png` | — |
| Katie | Katie | Animal Crossing | Card | `01b60001-00ae0502` | `amiibo/katie-animal-crossing.png` | — |
| Katrina | Katrina | Animal Crossing | Card | `01a50001-01720502` | `amiibo/katrina-animal-crossing.png` | — |
| Katt | Katt | Animal Crossing | Card | `02720001-01860502` | `amiibo/katt-animal-crossing.png` | — |
| Keaton | Keaton | Animal Crossing | Card | `04530001-01040502` | `amiibo/keaton-animal-crossing.png` | — |
| Ken | Ken | Animal Crossing | Card | `02a60001-01240502` | `amiibo/ken-animal-crossing.png` | — |
| Ketchup | Ketchup | Animal Crossing | Card | `03140001-02f40502` | `amiibo/ketchup-animal-crossing.png` | — |
| Kevin | Kevin | Animal Crossing | Card | `04870001-01bf0502` | `amiibo/kevin-animal-crossing.png` | — |
| Kicks | Kicks | Animal Crossing | Figure | `01940000-024a0502` | `amiibo/kicks-animal-crossing-figure.png` | — |
| Kicks | Kicks | Animal Crossing | Card | `01940001-00aa0502` | `amiibo/kicks-animal-crossing-card-1.png` | — |
| Kicks | Kicks | Animal Crossing | Card | `01940001-03b60502` | `amiibo/kicks-animal-crossing-card-2.png` | — |
| Kid Cat | Kid Cat | Animal Crossing | Card | `02670001-01080502` | `amiibo/kid-cat-animal-crossing.png` | — |
| Kidd | Kidd | Animal Crossing | Card | `035d0001-00c90502` | `amiibo/kidd-animal-crossing.png` | — |
| Kiki | Kiki | Animal Crossing | Card | `02610001-00650502` | `amiibo/kiki-animal-crossing.png` | — |
| Kitt | Kitt | Animal Crossing | Card | `03d10001-00c20502` | `amiibo/kitt-animal-crossing.png` | — |
| Kitty | Kitty | Animal Crossing | Card | `026b0001-00e90502` | `amiibo/kitty-animal-crossing.png` | — |
| Klaus | Klaus | Animal Crossing | Card | `02220001-01440502` | `amiibo/klaus-animal-crossing.png` | — |
| Knox | Knox | Animal Crossing | Card | `02a40001-00720502` | `amiibo/knox-animal-crossing.png` | — |
| Kody | Kody | Animal Crossing | Card | `02810001-01200502` | `amiibo/kody-animal-crossing.png` | — |
| Kyle | Kyle | Animal Crossing | Card | `05150001-005b0502` | `amiibo/kyle-animal-crossing.png` | — |
| Label | Label | Animal Crossing | Card | `01890101-03b10502` | `amiibo/label-animal-crossing.png` | — |
| Labelle | Label | Animal Crossing | Card | `01890001-00ab0502` | `amiibo/labelle-animal-crossing.png` | — |
| Leif | Leif | Animal Crossing | Card | `01b40001-01130502` | `amiibo/leif-animal-crossing.png` | — |
| Leila | Leila | Animal Crossing | Card | `01980001-00b10502` | `amiibo/leila-animal-crossing.png` | — |
| Leilani | Leilani | Animal Crossing | Card | `01970001-01770502` | `amiibo/leilani-animal-crossing.png` | — |
| Leonardo | Leonardo | Animal Crossing | Card | `04fe0001-00590502` | `amiibo/leonardo-animal-crossing.png` | — |
| Leopold | Leopold | Animal Crossing | Card | `03ea0001-030b0502` | `amiibo/leopold-animal-crossing.png` | — |
| Lily | Lily | Animal Crossing | Card | `03380001-011d0502` | `amiibo/lily-animal-crossing.png` | — |
| Limberg | Limberg | Animal Crossing | Card | `040d0001-00780502` | `amiibo/limberg-animal-crossing.png` | — |
| Lionel | Lionel | Animal Crossing | Card | `03ee0001-008b0502` | `amiibo/lionel-animal-crossing.png` | — |
| Lobo | Lobo | Animal Crossing | Card | `050c0001-01c10502` | `amiibo/lobo-animal-crossing.png` | — |
| Lolly | Lolly | Animal Crossing | Card | `026f0001-01900502` | `amiibo/lolly-animal-crossing.png` | — |
| Lopez | Lopez | Animal Crossing | Card | `02db0001-005e0502` | `amiibo/lopez-animal-crossing.png` | — |
| Lottie | Lottie | Animal Crossing | Figure | `01c10000-02440502` | `amiibo/lottie-animal-crossing-figure.png` | — |
| Lottie | Lottie | Animal Crossing | Card | `01c10001-00540502` | `amiibo/lottie-animal-crossing-card.png` | — |
| Lottie - Black Skirt And Bow | Lottie | Animal Crossing | Card | `01c10101-017a0502` | `amiibo/lottie-black-skirt-and-bow-animal-crossing.png` | — |
| Lottie - Island | Lottie | Animal Crossing | Card | `01c10201-03bb0502` | `amiibo/lottie-island-animal-crossing.png` | — |
| Louie | Louie | Animal Crossing | Card | `036d0001-03040502` | `amiibo/louie-animal-crossing.png` | — |
| Lucha | Lucha | Animal Crossing | Card | `023c0001-00bd0502` | `amiibo/lucha-animal-crossing.png` | — |
| Lucky | Lucky | Animal Crossing | Card | `02ec0001-01c40502` | `amiibo/lucky-animal-crossing.png` | — |
| Lucy | Lucy | Animal Crossing | Card | `047c0001-01a00502` | `amiibo/lucy-animal-crossing.png` | — |
| Luna | Luna | Animal Crossing | Card | `01b50001-00510502` | `amiibo/luna-animal-crossing.png` | — |
| Lyle | Lyle | Animal Crossing | Card | `01aa0001-00530502` | `amiibo/lyle-animal-crossing.png` | — |
| Lyman | Lyman | Animal Crossing | Card | `03c50001-015c0502` | `amiibo/lyman-animal-crossing.png` | — |
| Mabel | Mabel | Animal Crossing | Figure | `01880000-02410502` | `amiibo/mabel-animal-crossing-figure.png` | — |
| Mabel | Mabel | Animal Crossing | Card | `01880001-01120502` | `amiibo/mabel-animal-crossing-card-1.png` | — |
| Mabel | Mabel | Animal Crossing | Card | `01880001-03af0502` | `amiibo/mabel-animal-crossing-card-2.png` | — |
| Mac | Mac | Animal Crossing | Card | `02f80001-01380502` | `amiibo/mac-animal-crossing.png` | — |
| Maddie | Maddie | Animal Crossing | Card | `02f30001-02f90502` | `amiibo/maddie-animal-crossing.png` | — |
| Maelle | Maelle | Animal Crossing | Card | `030a0001-01c70502` | `amiibo/maelle-animal-crossing.png` | — |
| Maggie | Maggie | Animal Crossing | Card | `04820001-02fd0502` | `amiibo/maggie-animal-crossing.png` | — |
| Mallary | Mallary | Animal Crossing | Card | `030d0001-01840502` | `amiibo/mallary-animal-crossing.png` | — |
| Maple | Maple | Animal Crossing | Card | `027e0001-01690502` | `amiibo/maple-animal-crossing.png` | — |
| Marcel | Marcel | Animal Crossing | Card | `02f90001-01020502` | `amiibo/marcel-animal-crossing.png` | — |
| Marcie | Marcie | Animal Crossing | Card | `03db0001-006d0502` | `amiibo/marcie-animal-crossing.png` | — |
| Margie | Margie | Animal Crossing | Card | `03270001-01c30502` | `amiibo/margie-animal-crossing.png` | — |
| Marina | Marina | Animal Crossing | Card | `042a0001-012d0502` | `amiibo/marina-animal-crossing.png` | — |
| Marlo | Marlo | Animal Crossing | Card | `0a150001-03cc0502` | `amiibo/marlo-animal-crossing.png` | — |
| Marshal | Marshal | Animal Crossing | Card | `04ee0001-014b0502` | `amiibo/marshal-animal-crossing.png` | — |
| Marty | Marty | Animal Crossing | Card | `028f0101-031a0502` | `amiibo/marty-animal-crossing.png` | — |
| Mathilda | Mathilda | Animal Crossing | Card | `03d20001-00e50502` | `amiibo/mathilda-animal-crossing.png` | — |
| Megan | Megan | Animal Crossing | Card | `0a0a0001-03c10502` | `amiibo/megan-animal-crossing.png` | — |
| Melba | Melba | Animal Crossing | Card | `03be0001-01980502` | `amiibo/melba-animal-crossing.png` | — |
| Merengue | Merengue | Animal Crossing | Card | `04b90001-01600502` | `amiibo/merengue-animal-crossing.png` | — |
| Merry | Merry | Animal Crossing | Card | `026d0001-013f0502` | `amiibo/merry-animal-crossing.png` | — |
| Midge | Midge | Animal Crossing | Card | `02350001-00840502` | `amiibo/midge-animal-crossing.png` | — |
| Mint | Mint | Animal Crossing | Card | `04e60001-00820502` | `amiibo/mint-animal-crossing.png` | — |
| Mira | Mira | Animal Crossing | Card | `04a70001-01a60502` | `amiibo/mira-animal-crossing.png` | — |
| Miranda | Miranda | Animal Crossing | Card | `03130001-01210502` | `amiibo/miranda-animal-crossing.png` | — |
| Mitzi | Mitzi | Animal Crossing | Card | `025e0001-01250502` | `amiibo/mitzi-animal-crossing.png` | — |
| Moe | Moe | Animal Crossing | Card | `02650001-01540502` | `amiibo/moe-animal-crossing.png` | — |
| Molly | Molly | Animal Crossing | Card | `03170001-00a60502` | `amiibo/molly-animal-crossing.png` | — |
| Monique | Monique | Animal Crossing | Card | `02680001-007d0502` | `amiibo/monique-animal-crossing.png` | — |
| Monty | Monty | Animal Crossing | Card | `03fd0001-01580502` | `amiibo/monty-animal-crossing.png` | — |
| Moose | Moose | Animal Crossing | Card | `041a0001-00e00502` | `amiibo/moose-animal-crossing.png` | — |
| Mott | Mott | Animal Crossing | Card | `03ec0001-01830502` | `amiibo/mott-animal-crossing.png` | — |
| Muffy | Muffy | Animal Crossing | Card | `04d10001-009e0502` | `amiibo/muffy-animal-crossing.png` | — |
| Murphy | Murphy | Animal Crossing | Card | `02840001-02fe0502` | `amiibo/murphy-animal-crossing.png` | — |
| Nan | Nan | Animal Crossing | Card | `03570001-00eb0502` | `amiibo/nan-animal-crossing.png` | — |
| Nana | Nana | Animal Crossing | Card | `03fa0001-00d00502` | `amiibo/nana-animal-crossing.png` | — |
| Naomi | Naomi | Animal Crossing | Card | `02b80001-019c0502` | `amiibo/naomi-animal-crossing.png` | — |
| Nat | Nat | Animal Crossing | Card | `019b0001-00b60502` | `amiibo/nat-animal-crossing.png` | — |
| Nate | Nate | Animal Crossing | Card | `02190001-007e0502` | `amiibo/nate-animal-crossing.png` | — |
| Nibbles | Nibbles | Animal Crossing | Card | `04e10001-01be0502` | `amiibo/nibbles-animal-crossing.png` | — |
| Niko | Niko | Animal Crossing | Card | `0a070001-03bc0502` | `amiibo/niko-animal-crossing.png` | — |
| Norma | Norma | Animal Crossing | Card | `02b70001-030f0502` | `amiibo/norma-animal-crossing.png` | — |
| Octavian | Octavian | Animal Crossing | Card | `04290001-00700502` | `amiibo/octavian-animal-crossing.png` | — |
| OHare | OHare | Animal Crossing | Card | `04a30001-01c90502` | `amiibo/ohare-animal-crossing.png` | — |
| Olaf | Olaf | Animal Crossing | Card | `02090001-019f0502` | `amiibo/olaf-animal-crossing.png` | — |
| Olive | Olive | Animal Crossing | Card | `02860001-03130502` | `amiibo/olive-animal-crossing.png` | — |
| Olivia | Olivia | Animal Crossing | Card | `02600001-00d20502` | `amiibo/olivia-animal-crossing.png` | — |
| Opal | Opal | Animal Crossing | Card | `03230001-00760502` | `amiibo/opal-animal-crossing.png` | — |
| Orville | Orville | Animal Crossing | Card | `0a000001-03ab0502` | `amiibo/orville-animal-crossing.png` | — |
| Ozzie | Ozzie | Animal Crossing | Card | `03c10001-00bb0502` | `amiibo/ozzie-animal-crossing.png` | — |
| Pancetti | Pancetti | Animal Crossing | Card | `04880001-00980502` | `amiibo/pancetti-animal-crossing.png` | — |
| Pango | Pango | Animal Crossing | Card | `02020001-01030502` | `amiibo/pango-animal-crossing.png` | — |
| Paolo | Paolo | Animal Crossing | Card | `03280001-02eb0502` | `amiibo/paolo-animal-crossing.png` | — |
| Papi | Papi | Animal Crossing | Card | `03b00001-01a90502` | `amiibo/papi-animal-crossing.png` | — |
| Pascal | Pascal | Animal Crossing | Card | `01a40001-004d0502` | `amiibo/pascal-animal-crossing.png` | — |
| Pashmina | Pashmina | Animal Crossing | Card | `035e0001-018e0502` | `amiibo/pashmina-animal-crossing.png` | — |
| Pate | Pate | Animal Crossing | Card | `03090001-00c60502` | `amiibo/pate-animal-crossing.png` | — |
| Patty | Patty | Animal Crossing | Card | `02b10001-00690502` | `amiibo/patty-animal-crossing.png` | — |
| Paula | Paula | Animal Crossing | Card | `021e0001-01230502` | `amiibo/paula-animal-crossing.png` | — |
| Pave | Pave | Animal Crossing | Card | `01ab0001-017c0502` | `amiibo/pave-animal-crossing.png` | — |
| Peaches | Peaches | Animal Crossing | Card | `03ac0001-01880502` | `amiibo/peaches-animal-crossing.png` | — |
| Peanut | Peanut | Animal Crossing | Card | `04dd0001-00a20502` | `amiibo/peanut-animal-crossing.png` | — |
| Pecan | Pecan | Animal Crossing | Card | `04e00001-00f70502` | `amiibo/pecan-animal-crossing.png` | — |
| Peck | Peck | Animal Crossing | Card | `023e0001-00d10502` | `amiibo/peck-animal-crossing.png` | — |
| Peewee | Peewee | Animal Crossing | Card | `036a0001-019d0502` | `amiibo/peewee-animal-crossing.png` | — |
| Peggy | Peggy | Animal Crossing | Card | `04830001-01b00502` | `amiibo/peggy-animal-crossing.png` | — |
| Pekoe | Pekoe | Animal Crossing | Card | `028b0001-00e30502` | `amiibo/pekoe-animal-crossing.png` | — |
| Pelly | Pelly | Animal Crossing | Card | `01a00001-010f0502` | `amiibo/pelly-animal-crossing.png` | — |
| Penelope | Penelope | Animal Crossing | Card | `041d0001-018a0502` | `amiibo/penelope-animal-crossing.png` | — |
| Pete | Pete | Animal Crossing | Card | `019f0001-01110502` | `amiibo/pete-animal-crossing.png` | — |
| Petri | Petri | Animal Crossing | Card | `0a160001-03cd0502` | `amiibo/petri-animal-crossing.png` | — |
| Phil | Phil | Animal Crossing | Card | `043d0001-007c0502` | `amiibo/phil-animal-crossing.png` | — |
| Phineas | Phineas | Animal Crossing | Card | `019c0001-01730502` | `amiibo/phineas-animal-crossing.png` | — |
| Phoebe | Phoebe | Animal Crossing | Card | `04400001-00ca0502` | `amiibo/phoebe-animal-crossing.png` | — |
| Phyllis | Phyllis | Animal Crossing | Card | `01a10001-01100502` | `amiibo/phyllis-animal-crossing.png` | — |
| Pierce | Pierce | Animal Crossing | Card | `044d0001-01930502` | `amiibo/pierce-animal-crossing.png` | — |
| Pietro | Pietro | Animal Crossing | Card | `04d20001-01a70502` | `amiibo/pietro-animal-crossing.png` | — |
| Pinky | Pinky | Animal Crossing | Card | `02150001-01820502` | `amiibo/pinky-animal-crossing.png` | — |
| Piper | Piper | Animal Crossing | Card | `02320001-02ea0502` | `amiibo/piper-animal-crossing.png` | — |
| Pippy | Pippy | Animal Crossing | Card | `049a0001-014e0502` | `amiibo/pippy-animal-crossing.png` | — |
| Plucky | Plucky | Animal Crossing | Card | `02a30001-02ff0502` | `amiibo/plucky-animal-crossing.png` | — |
| Pompom | Pompom | Animal Crossing | Card | `030c0001-01b80502` | `amiibo/pompom-animal-crossing.png` | — |
| Poncho | Poncho | Animal Crossing | Card | `027f0001-00b90502` | `amiibo/poncho-animal-crossing.png` | — |
| Poppy | Poppy | Animal Crossing | Card | `04ec0001-00770502` | `amiibo/poppy-animal-crossing.png` | — |
| Porter | Porter | Animal Crossing | Card | `01950001-00b00502` | `amiibo/porter-animal-crossing.png` | — |
| Portia | Portia | Animal Crossing | Card | `02ef0001-00580502` | `amiibo/portia-animal-crossing.png` | — |
| Prince | Prince | Animal Crossing | Card | `03440001-00c50502` | `amiibo/prince-animal-crossing.png` | — |
| Puck | Puck | Animal Crossing | Card | `04650001-006e0502` | `amiibo/puck-animal-crossing.png` | — |
| Puddles | Puddles | Animal Crossing | Card | `033e0001-01a20502` | `amiibo/puddles-animal-crossing.png` | — |
| Pudge | Pudge | Animal Crossing | Card | `02800001-00830502` | `amiibo/pudge-animal-crossing.png` | — |
| Punchy | Punchy | Animal Crossing | Card | `02630001-00750502` | `amiibo/punchy-animal-crossing.png` | — |
| Purrl | Purrl | Animal Crossing | Card | `02640001-01ac0502` | `amiibo/purrl-animal-crossing.png` | — |
| Queenie | Queenie | Animal Crossing | Card | `04360001-01940502` | `amiibo/queenie-animal-crossing.png` | — |
| Quillson | Quillson | Animal Crossing | Card | `03180001-006c0502` | `amiibo/quillson-animal-crossing.png` | — |
| Quinn | Quinn | Animal Crossing | Card | `0a180001-03cf0502` | `amiibo/quinn-animal-crossing.png` | — |
| Raddle | Raddle | Animal Crossing | Card | `03470001-03020502` | `amiibo/raddle-animal-crossing.png` | — |
| Rasher | Rasher | Animal Crossing | Card | `047a0001-00600502` | `amiibo/rasher-animal-crossing.png` | — |
| Raymond | Raymond | Animal Crossing | Card | `0a0f0001-03c60502` | `amiibo/raymond-animal-crossing.png` | — |
| Redd | Redd | Animal Crossing | Card | `01a80001-004f0502` | `amiibo/redd-animal-crossing.png` | — |
| Redd - Shirt | Redd | Animal Crossing | Card | `01a80101-017e0502` | `amiibo/redd-shirt-animal-crossing.png` | — |
| Reese | Reese | Animal Crossing | Figure | `018a0000-02450502` | `amiibo/reese-animal-crossing-figure.png` | — |
| Reese | Reese | Animal Crossing | Card | `018a0001-00a90502` | `amiibo/reese-animal-crossing-card.png` | — |
| Reneigh | Reneigh | Animal Crossing | Card | `0a100001-03c70502` | `amiibo/reneigh-animal-crossing.png` | — |
| Renée | Renée | Animal Crossing | Card | `04ba0001-005d0502` | `amiibo/ren-e-animal-crossing.png` | — |
| Resetti | Resetti | Animal Crossing | Figure | `018e0000-02490502` | `amiibo/resetti-animal-crossing-figure.png` | — |
| Resetti | Resetti | Animal Crossing | Card | `018e0001-00490502` | `amiibo/resetti-animal-crossing-card.png` | — |
| Resetti - Without Hat | Resetti | Animal Crossing | Card | `018e0101-01780502` | `amiibo/resetti-without-hat-animal-crossing.png` | — |
| Rex | Rex | Animal Crossing | Card | `03e80001-02f50502` | `amiibo/rex-animal-crossing.png` | — |
| Rhonda | Rhonda | Animal Crossing | Card | `04b30001-00dd0502` | `amiibo/rhonda-animal-crossing.png` | — |
| Ribbot | Ribbot | Animal Crossing | Card | `03390001-01b10502` | `amiibo/ribbot-animal-crossing.png` | — |
| Ricky | Ricky | Animal Crossing | Card | `04e70001-01320502` | `amiibo/ricky-animal-crossing.png` | — |
| Rilla | Rilla | Animal Crossing | Card | `03740101-03190502` | `amiibo/rilla-animal-crossing.png` | — |
| Rio | Rio | Animal Crossing | Card | `0a1c0001-03d30502` | `amiibo/rio-animal-crossing.png` | — |
| Rizzo | Rizzo | Animal Crossing | Card | `04150001-01bb0502` | `amiibo/rizzo-animal-crossing.png` | — |
| Roald | Roald | Animal Crossing | Card | `04600001-00a50502` | `amiibo/roald-animal-crossing.png` | — |
| Robin | Robin | Animal Crossing | Card | `022e0001-01d30502` | `amiibo/robin-animal-crossing.png` | — |
| Rocco | Rocco | Animal Crossing | Card | `03900001-01850502` | `amiibo/rocco-animal-crossing.png` | — |
| Rocket | Rocket | Animal Crossing | Card | `03720001-010b0502` | `amiibo/rocket-animal-crossing.png` | — |
| Rod | Rod | Animal Crossing | Card | `04110001-01ab0502` | `amiibo/rod-animal-crossing.png` | — |
| Rodeo | Rodeo | Animal Crossing | Card | `024b0001-01260502` | `amiibo/rodeo-animal-crossing.png` | — |
| Rodney | Rodney | Animal Crossing | Card | `03810001-00d50502` | `amiibo/rodney-animal-crossing.png` | — |
| Rolf | Rolf | Animal Crossing | Card | `04fa0001-01680502` | `amiibo/rolf-animal-crossing.png` | — |
| Rooney | Rooney | Animal Crossing | Card | `03da0001-01510502` | `amiibo/rooney-animal-crossing.png` | — |
| Rory | Rory | Animal Crossing | Card | `03ed0001-01a30502` | `amiibo/rory-animal-crossing.png` | — |
| Roscoe | Roscoe | Animal Crossing | Card | `03a80001-00910502` | `amiibo/roscoe-animal-crossing.png` | — |
| Rosie | Rosie | Animal Crossing | Card | `025f0001-01c50502` | `amiibo/rosie-animal-crossing.png` | — |
| Rosie - Amiibo Festival | Rosie | Animal Crossing | Card | `025f0001-01d70502` | `amiibo/rosie-amiibo-festival-animal-crossing.png` | — |
| Roswell | Roswell | Animal Crossing | Card | `0a1f0001-03d60502` | `amiibo/roswell-animal-crossing.png` | — |
| Rover | Rover | Animal Crossing | Figure | `018d0000-024c0502` | `amiibo/rover-animal-crossing-figure.png` | — |
| Rover | Rover | Animal Crossing | Card | `018d0001-010c0502` | `amiibo/rover-animal-crossing-card.png` | — |
| Rowan | Rowan | Animal Crossing | Card | `04fb0001-01c60502` | `amiibo/rowan-animal-crossing.png` | — |
| Ruby | Ruby | Animal Crossing | Card | `049d0001-00ed0502` | `amiibo/ruby-animal-crossing.png` | — |
| Rudy | Rudy | Animal Crossing | Card | `02710001-019b0502` | `amiibo/rudy-animal-crossing.png` | — |
| Sable | Sable | Animal Crossing | Card | `01870001-00470502` | `amiibo/sable-animal-crossing-card-1.png` | — |
| Sable | Sable | Animal Crossing | Card | `01870001-03b00502` | `amiibo/sable-animal-crossing-card-2.png` | — |
| Saharah | Saharah | Animal Crossing | Card | `01a60001-00500502` | `amiibo/saharah-animal-crossing-card-2.png` | — |
| Saharah | Saharah | Animal Crossing | Card | `01a60001-03b70502` | `amiibo/saharah-animal-crossing-card-1.png` | — |
| Sally | Sally | Animal Crossing | Card | `04e40001-01b60502` | `amiibo/sally-animal-crossing.png` | — |
| Samson | Samson | Animal Crossing | Card | `04100001-007f0502` | `amiibo/samson-animal-crossing.png` | — |
| Sandy | Sandy | Animal Crossing | Card | `04380001-03000502` | `amiibo/sandy-animal-crossing.png` | — |
| Sasha | Sasha | Animal Crossing | Card | `0a110001-03c80502` | `amiibo/sasha-animal-crossing.png` | — |
| Savannah | Savannah | Animal Crossing | Card | `03a60001-00c80502` | `amiibo/savannah-animal-crossing.png` | — |
| Scoot | Scoot | Animal Crossing | Card | `03110001-00d60502` | `amiibo/scoot-animal-crossing.png` | — |
| Shari | Shari | Animal Crossing | Card | `04000001-006f0502` | `amiibo/shari-animal-crossing.png` | — |
| Sheldon | Sheldon | Animal Crossing | Card | `04ed0001-00620502` | `amiibo/sheldon-animal-crossing.png` | — |
| Shep | Shep | Animal Crossing | Card | `02fc0001-018f0502` | `amiibo/shep-animal-crossing.png` | — |
| Sherb | Sherb | Animal Crossing | Card | `0a090001-03c00502` | `amiibo/sherb-animal-crossing.png` | — |
| Shino | Shino | Animal Crossing | Card | `0a140001-03cb0502` | `amiibo/shino-animal-crossing.png` | — |
| Shrunk | Shrunk | Animal Crossing | Card | `01b10001-00b20502` | `amiibo/shrunk-animal-crossing.png` | — |
| Shrunk - Loud Jacket | Shrunk | Animal Crossing | Card | `01b10101-017b0502` | `amiibo/shrunk-loud-jacket-animal-crossing.png` | — |
| Simon | Simon | Animal Crossing | Card | `03fb0001-01cf0502` | `amiibo/simon-animal-crossing.png` | — |
| Skye | Skye | Animal Crossing | Card | `05140001-01530502` | `amiibo/skye-animal-crossing.png` | — |
| Sly | Sly | Animal Crossing | Card | `02c90001-00cd0502` | `amiibo/sly-animal-crossing.png` | — |
| Snake | Snake | Animal Crossing | Card | `04970001-007a0502` | `amiibo/snake-animal-crossing.png` | — |
| Snooty | Snooty | Animal Crossing | Card | `02060001-03120502` | `amiibo/snooty-animal-crossing.png` | — |
| Soleil | Soleil | Animal Crossing | Card | `03820001-016b0502` | `amiibo/soleil-animal-crossing.png` | — |
| Sparro | Sparro | Animal Crossing | Card | `023f0001-01660502` | `amiibo/sparro-animal-crossing.png` | — |
| Spike | Spike | Animal Crossing | Card | `04b40001-030c0502` | `amiibo/spike-animal-crossing.png` | — |
| Spork/Crackle | Spork/Crackle | Animal Crossing | Card | `047d0001-012e0502` | `amiibo/spork-crackle-animal-crossing.png` | — |
| Sprinkle | Sprinkle | Animal Crossing | Card | `046d0001-00f30502` | `amiibo/sprinkle-animal-crossing.png` | — |
| Sprocket | Sprocket | Animal Crossing | Card | `04390001-03110502` | `amiibo/sprocket-animal-crossing.png` | — |
| Static | Static | Animal Crossing | Card | `04e50001-01ad0502` | `amiibo/static-animal-crossing.png` | — |
| Stella | Stella | Animal Crossing | Card | `04c80001-02ed0502` | `amiibo/stella-animal-crossing.png` | — |
| Sterling | Sterling | Animal Crossing | Card | `04520001-00730502` | `amiibo/sterling-animal-crossing.png` | — |
| Stinky | Stinky | Animal Crossing | Card | `026a0001-01460502` | `amiibo/stinky-animal-crossing.png` | — |
| Stitches | Stitches | Animal Crossing | Card | `02820001-01810502` | `amiibo/stitches-animal-crossing.png` | — |
| Stitches - Amiibo Festival | Stitches | Animal Crossing | Card | `02820001-01d60502` | `amiibo/stitches-amiibo-festival-animal-crossing.png` | — |
| Stu | Stu | Animal Crossing | Card | `024d0001-02f60502` | `amiibo/stu-animal-crossing.png` | — |
| Sydney | Sydney | Animal Crossing | Card | `03bf0001-01bc0502` | `amiibo/sydney-animal-crossing.png` | — |
| Sylvana | Sylvana | Animal Crossing | Card | `04eb0001-02f00502` | `amiibo/sylvana-animal-crossing.png` | — |
| Sylvia | Sylvia | Animal Crossing | Card | `03d70001-01b40502` | `amiibo/sylvia-animal-crossing.png` | — |
| T-Bone | T-Bone | Animal Crossing | Card | `024f0001-00810502` | `amiibo/t-bone-animal-crossing.png` | — |
| Tabby | Tabby | Animal Crossing | Card | `02690001-011f0502` | `amiibo/tabby-animal-crossing.png` | — |
| Tad | Tad | Animal Crossing | Card | `03410001-030e0502` | `amiibo/tad-animal-crossing.png` | — |
| Tammi | Tammi | Animal Crossing | Card | `03fc0001-01470502` | `amiibo/tammi-animal-crossing.png` | — |
| Tammy | Tammy | Animal Crossing | Card | `028e0001-019e0502` | `amiibo/tammy-animal-crossing.png` | — |
| Tangy | Tangy | Animal Crossing | Card | `02620001-01370502` | `amiibo/tangy-animal-crossing.png` | — |
| Tank | Tank | Animal Crossing | Card | `04b20001-01b90502` | `amiibo/tank-animal-crossing.png` | — |
| Tasha | Tasha | Animal Crossing | Card | `04ea0001-03180502` | `amiibo/tasha-animal-crossing.png` | — |
| Teddy | Teddy | Animal Crossing | Card | `02140001-00e40502` | `amiibo/teddy-animal-crossing.png` | — |
| Tex | Tex | Animal Crossing | Card | `046b0001-01970502` | `amiibo/tex-animal-crossing.png` | — |
| Tia | Tia | Animal Crossing | Card | `032d0001-00bc0502` | `amiibo/tia-animal-crossing.png` | — |
| Tiansheng | Tiansheng | Animal Crossing | Card | `0a130001-03ca0502` | `amiibo/tiansheng-animal-crossing.png` | — |
| Tiffany | Tiffany | Animal Crossing | Card | `049b0001-00610502` | `amiibo/tiffany-animal-crossing.png` | — |
| Timbra | Timbra | Animal Crossing | Card | `04cf0001-00e10502` | `amiibo/timbra-animal-crossing.png` | — |
| Timmy | Timmy | Animal Crossing | Card | `01850001-004b0502` | `amiibo/timmy-animal-crossing.png` | — |
| Timmy & Tommy | Timmy & Tommy | Animal Crossing | Figure | `01840000-024d0502` | `amiibo/timmy-and-tommy-animal-crossing-figure.png` | — |
| Timmy & Tommy | Timmy & Tommy | Animal Crossing | Card | `01840501-03a90502` | `amiibo/timmy-and-tommy-animal-crossing-card.png` | — |
| Timmy - Full Apron | Timmy | Animal Crossing | Card | `01850201-01170502` | `amiibo/timmy-full-apron-animal-crossing.png` | — |
| Timmy - Suit | Timmy | Animal Crossing | Card | `01850401-01790502` | `amiibo/timmy-suit-animal-crossing.png` | — |
| Tipper | Tipper | Animal Crossing | Card | `02b20001-00c40502` | `amiibo/tipper-animal-crossing.png` | — |
| Toby | Toby | Animal Crossing | Card | `04a80101-031e0502` | `amiibo/toby-animal-crossing.png` | — |
| Tom | Tom | Animal Crossing | Card | `026c0001-00c30502` | `amiibo/tom-animal-crossing.png` | — |
| Tom Nook | Tom Nook | Animal Crossing | Figure | `01830000-02420502` | `amiibo/tom-nook-animal-crossing-figure.png` | — |
| Tom Nook | Tom Nook | Animal Crossing | Card | `01830001-00450502` | `amiibo/tom-nook-animal-crossing-card-2.png` | — |
| Tom Nook | Tom Nook | Animal Crossing | Card | `01830201-03a80502` | `amiibo/tom-nook-animal-crossing-card-1.png` | — |
| Tom Nook - Coat | Tom Nook | Animal Crossing | Card | `01830301-03be0502` | `amiibo/tom-nook-coat-animal-crossing.png` | — |
| Tom Nook - Jacket | Tom Nook | Animal Crossing | Card | `01830101-010e0502` | `amiibo/tom-nook-jacket-animal-crossing.png` | — |
| Tommy - Suit | Tommy | Animal Crossing | Card | `01860301-01750502` | `amiibo/tommy-suit-animal-crossing.png` | — |
| Tommy - Uniform | Tommy | Animal Crossing | Card | `01860101-00af0502` | `amiibo/tommy-uniform-animal-crossing.png` | — |
| Tortimer | Tortimer | Animal Crossing | Card | `01b00001-00520502` | `amiibo/tortimer-animal-crossing.png` | — |
| Truffles | Truffles | Animal Crossing | Card | `04790001-00920502` | `amiibo/truffles-animal-crossing.png` | — |
| Tucker | Tucker | Animal Crossing | Card | `032c0001-01480502` | `amiibo/tucker-animal-crossing.png` | — |
| Tutu | Tutu | Animal Crossing | Card | `021b0001-00800502` | `amiibo/tutu-animal-crossing.png` | — |
| Twiggy | Twiggy | Animal Crossing | Card | `02300001-01d20502` | `amiibo/twiggy-animal-crossing.png` | — |
| Tybalt | Tybalt | Animal Crossing | Card | `04fc0001-02ee0502` | `amiibo/tybalt-animal-crossing.png` | — |
| Ursala | Ursala | Animal Crossing | Card | `021c0001-02f70502` | `amiibo/ursala-animal-crossing.png` | — |
| Velma | Velma | Animal Crossing | Card | `035c0001-01290502` | `amiibo/velma-animal-crossing.png` | — |
| Vesta | Vesta | Animal Crossing | Card | `04c50001-01010502` | `amiibo/vesta-animal-crossing.png` | — |
| Vic | Vic | Animal Crossing | Card | `02520001-00fe0502` | `amiibo/vic-animal-crossing.png` | — |
| Victoria | Victoria | Animal Crossing | Card | `03a50001-015b0502` | `amiibo/victoria-animal-crossing.png` | — |
| Violet | Violet | Animal Crossing | Card | `03700001-015d0502` | `amiibo/violet-animal-crossing.png` | — |
| Vivian | Vivian | Animal Crossing | Card | `05130001-02e70502` | `amiibo/vivian-animal-crossing.png` | — |
| Vladimir | Vladimir | Animal Crossing | Card | `02830001-00c70502` | `amiibo/vladimir-animal-crossing.png` | — |
| Wade | Wade | Animal Crossing | Card | `04680001-02f20502` | `amiibo/wade-animal-crossing.png` | — |
| Walker | Walker | Animal Crossing | Card | `02f00001-00a70502` | `amiibo/walker-animal-crossing.png` | — |
| Walt | Walt | Animal Crossing | Card | `03d90001-01a50502` | `amiibo/walt-animal-crossing.png` | — |
| Wardell | Wardell | Animal Crossing | Card | `0a080001-03bd0502` | `amiibo/wardell-animal-crossing.png` | — |
| Wart Jr. | Wart Jr. | Animal Crossing | Card | `033d0001-013a0502` | `amiibo/wart-jr-animal-crossing.png` | — |
| Weber | Weber | Animal Crossing | Card | `03120001-03090502` | `amiibo/weber-animal-crossing.png` | — |
| Wendell | Wendell | Animal Crossing | Card | `01a70001-01140502` | `amiibo/wendell-animal-crossing.png` | — |
| Wendy | Wendy | Animal Crossing | Card | `04ce0001-00db0502` | `amiibo/wendy-animal-crossing.png` | — |
| Whitney | Whitney | Animal Crossing | Card | `050e0001-00d70502` | `amiibo/whitney-animal-crossing.png` | — |
| Wilbur | Wilbur | Animal Crossing | Card | `0a010001-03ac0502` | `amiibo/wilbur-animal-crossing.png` | — |
| Willow | Willow | Animal Crossing | Card | `04cc0001-00a40502` | `amiibo/willow-animal-crossing.png` | — |
| Winnie | Winnie | Animal Crossing | Card | `03a90001-00710502` | `amiibo/winnie-animal-crossing.png` | — |
| Wisp | Wisp | Animal Crossing | Card | `0a060001-03ba0502` | `amiibo/wisp-animal-crossing.png` | — |
| Wolfgang | Wolfgang | Animal Crossing | Card | `050d0001-01420502` | `amiibo/wolfgang-animal-crossing.png` | — |
| Yuka | Yuka | Animal Crossing | Card | `03bc0001-008a0502` | `amiibo/yuka-animal-crossing.png` | — |
| Zell | Zell | Animal Crossing | Card | `02d80001-00e20502` | `amiibo/zell-animal-crossing.png` | — |
| Zipper | Zipper | Animal Crossing | Card | `01ac0001-017f0502` | `amiibo/zipper-animal-crossing.png` | — |
| Zoe | Zoe | Animal Crossing | Card | `0a1a0001-03d10502` | `amiibo/zoe-animal-crossing.png` | — |
| Zucker | Zucker | Animal Crossing | Card | `042b0001-01af0502` | `amiibo/zucker-animal-crossing.png` | — |
| Étoile | Étoile | Animal Crossing | Card | `04d30101-031b0502` | `amiibo/toile-animal-crossing.png` | — |

### BoxBoy! (1)

| Name | Character | Game series | Type | amiibo ID | Image filename | Image present |
|---|---|---|---|---|---|---|
| Qbby | Qbby | BoxBoy! | Figure | `1f400000-035e1002` | `amiibo/qbby-boxboy.png` | — |

### Chibi-Robo! (1)

| Name | Character | Game series | Type | amiibo ID | Image filename | Image present |
|---|---|---|---|---|---|---|
| Chibi Robo | Chibi-Robo | Chibi Robo | Figure | `22c00000-003a0202` | `amiibo/chibi-robo-chibi-robo.png` | — |

### Diablo (1)

| Name | Character | Game series | Type | amiibo ID | Image filename | Image present |
|---|---|---|---|---|---|---|
| Loot Goblin | Loot Goblin | Diablo | Figure | `38c00000-03911602` | `amiibo/loot-goblin-diablo.png` | — |

### Donkey Kong (1)

| Name | Character | Game series | Type | amiibo ID | Image filename | Image present |
|---|---|---|---|---|---|---|
| Donkey Kong & Pauline | Donkey Kong | Super Mario | Figure | `00080100-042f1a02` | `amiibo/donkey-kong-and-pauline-donkey-kong.png` | — |

### Fire Emblem (4)

| Name | Character | Game series | Type | amiibo ID | Image filename | Image present |
|---|---|---|---|---|---|---|
| Alm | Alm | Fire Emblem | Figure | `21060000-03601202` | `amiibo/alm-fire-emblem.png` | — |
| Celica | Celica | Fire Emblem | Figure | `21070000-03611202` | `amiibo/celica-fire-emblem.png` | — |
| Chrom | Chrom | Fire Emblem | Figure | `21080000-036f1202` | `amiibo/chrom-fire-emblem.png` | — |
| Tiki | Tiki | Fire Emblem | Figure | `21090000-03701202` | `amiibo/tiki-fire-emblem.png` | — |

### Kirby (4)

| Name | Character | Game series | Type | amiibo ID | Image filename | Image present |
|---|---|---|---|---|---|---|
| King Dedede | King Dedede | Kirby | Figure | `1f020000-02560c02` | `amiibo/king-dedede-kirby.png` | — |
| Kirby | Kirby | Kirby | Figure | `1f000000-02540c02` | `amiibo/kirby-kirby.png` | — |
| Meta Knight | Meta Knight | Kirby | Figure | `1f010000-02550c02` | `amiibo/meta-knight-kirby.png` | — |
| Waddle Dee | Waddle Dee | Kirby | Figure | `1f030000-02570c02` | `amiibo/waddle-dee-kirby.png` | — |

### Kirby Air Riders (2)

| Name | Character | Game series | Type | amiibo ID | Image filename | Image present |
|---|---|---|---|---|---|---|
| Bandana Waddle Dee | Waddle Dee | Kirby | Figure | `1f030100-04c91e03` | `amiibo/bandana-waddle-dee-kirby-air-riders.png` | — |
| Kirby | Kirby | Kirby | Figure | `1f000000-04c41e03` | `amiibo/kirby-kirby-air-riders.png` | — |

### Legend Of Zelda (26)

| Name | Character | Game series | Type | amiibo ID | Image filename | Image present |
|---|---|---|---|---|---|---|
| 8-Bit Link | Link | The Legend of Zelda | Figure | `01000000-034f0902` | `amiibo/8-bit-link-legend-of-zelda.png` | — |
| Bokoblin | Bokoblin | The Legend of Zelda | Figure | `01410000-035c0902` | `amiibo/bokoblin-legend-of-zelda.png` | — |
| Daruk | Daruk | The Legend of Zelda | Figure | `01050000-03580902` | `amiibo/daruk-legend-of-zelda.png` | — |
| Ganondorf - Tears of the Kingdom | Ganon | The Legend of Zelda | Figure | `01020100-041a0902` | `amiibo/ganondorf-tears-of-the-kingdom-legend-of-zelda.png` | — |
| Guardian | Guardian | The Legend of Zelda | Figure | `01400000-03550902` | `amiibo/guardian-legend-of-zelda.png` | — |
| Link - Archer | Link | The Legend of Zelda | Figure | `01000000-03530902` | `amiibo/link-archer-legend-of-zelda.png` | — |
| Link - Link's Awakening | Link | The Legend of Zelda | Figure | `01000000-03990902` | `amiibo/link-links-awakening-legend-of-zelda.png` | — |
| Link - Majora's Mask | Link | The Legend of Zelda | Figure | `01000000-034c0902` | `amiibo/link-majoras-mask-legend-of-zelda.png` | — |
| Link - Ocarina of Time | Link | The Legend of Zelda | Figure | `01000000-034b0902` | `amiibo/link-ocarina-of-time-legend-of-zelda.png` | — |
| Link - Rider | Link | The Legend of Zelda | Figure | `01000000-03540902` | `amiibo/link-rider-legend-of-zelda.png` | — |
| Link - Skyward Sword | Link | The Legend of Zelda | Figure | `01000000-034e0902` | `amiibo/link-skyward-sword-legend-of-zelda.png` | — |
| Link - Tears of the Kingdom | Link | The Legend of Zelda | Figure | `01000000-04180902` | `amiibo/link-tears-of-the-kingdom-legend-of-zelda.png` | — |
| Link - Twilight Princess | Link | The Legend of Zelda | Figure | `01000000-034d0902` | `amiibo/link-twilight-princess-legend-of-zelda.png` | — |
| Midna & Wolf Link | Midna | The Legend of Zelda | Figure | `01030000-024f0902` | `amiibo/midna-and-wolf-link-legend-of-zelda.png` | — |
| Mipha | Mipha | The Legend of Zelda | Figure | `01070000-035a0902` | `amiibo/mipha-legend-of-zelda.png` | — |
| Revali | Revali | The Legend of Zelda | Figure | `01080000-035b0902` | `amiibo/revali-legend-of-zelda.png` | — |
| Riju | Riju | The Legend of Zelda | Figure | `01090000-04a30902` | `amiibo/riju-legend-of-zelda.png` | — |
| Sidon | Sidon | The Legend of Zelda | Figure | `010a0000-04a40902` | `amiibo/sidon-legend-of-zelda.png` | — |
| Toon Link - The Wind Waker | Link | The Legend of Zelda | Figure | `01000100-03500902` | `amiibo/toon-link-the-wind-waker-legend-of-zelda.png` | — |
| Toon Zelda - The Wind Waker | Zelda | The Legend of Zelda | Figure | `01010000-03520902` | `amiibo/toon-zelda-the-wind-waker-legend-of-zelda.png` | — |
| Tulin | Tulin | The Legend of Zelda | Figure | `010b0000-04a50902` | `amiibo/tulin-legend-of-zelda.png` | — |
| Urbosa | Urbosa | The Legend of Zelda | Figure | `01060000-03590902` | `amiibo/urbosa-legend-of-zelda.png` | — |
| Yunobo | Yunobo | The Legend of Zelda | Figure | `010c0000-04a60902` | `amiibo/yunobo-legend-of-zelda.png` | — |
| Zelda | Zelda | The Legend of Zelda | Figure | `01010000-03560902` | `amiibo/zelda-legend-of-zelda.png` | — |
| Zelda & Loftwing | Zelda | The Legend of Zelda | Figure | `01010300-04140902` | `amiibo/zelda-and-loftwing-legend-of-zelda.png` | — |
| Zelda - Tears of the Kingdom | Zelda | The Legend of Zelda | Figure | `01010000-04190902` | `amiibo/zelda-tears-of-the-kingdom-legend-of-zelda.png` | — |

### Mario Sports Superstars (90)

| Name | Character | Game series | Type | amiibo ID | Image filename | Image present |
|---|---|---|---|---|---|---|
| Baby Luigi - Baseball | Baby Luigi | Mario Sports Superstars | Card | `09cd0201-02ab0e02` | `amiibo/baby-luigi-baseball-mario-sports-superstars.png` | — |
| Baby Luigi - Golf | Baby Luigi | Mario Sports Superstars | Card | `09cd0401-02ad0e02` | `amiibo/baby-luigi-golf-mario-sports-superstars.png` | — |
| Baby Luigi - Horse Racing | Baby Luigi | Mario Sports Superstars | Card | `09cd0501-02ae0e02` | `amiibo/baby-luigi-horse-racing-mario-sports-superstars.png` | — |
| Baby Luigi - Soccer | Baby Luigi | Mario Sports Superstars | Card | `09cd0101-02aa0e02` | `amiibo/baby-luigi-soccer-mario-sports-superstars.png` | — |
| Baby Luigi - Tennis | Baby Luigi | Mario Sports Superstars | Card | `09cd0301-02ac0e02` | `amiibo/baby-luigi-tennis-mario-sports-superstars.png` | — |
| Baby Mario - Baseball | Baby Mario | Mario Sports Superstars | Card | `09cc0201-02a60e02` | `amiibo/baby-mario-baseball-mario-sports-superstars.png` | — |
| Baby Mario - Golf | Baby Mario | Mario Sports Superstars | Card | `09cc0401-02a80e02` | `amiibo/baby-mario-golf-mario-sports-superstars.png` | — |
| Baby Mario - Horse Racing | Baby Mario | Mario Sports Superstars | Card | `09cc0501-02a90e02` | `amiibo/baby-mario-horse-racing-mario-sports-superstars.png` | — |
| Baby Mario - Soccer | Baby Mario | Mario Sports Superstars | Card | `09cc0101-02a50e02` | `amiibo/baby-mario-soccer-mario-sports-superstars.png` | — |
| Baby Mario - Tennis | Baby Mario | Mario Sports Superstars | Card | `09cc0301-02a70e02` | `amiibo/baby-mario-tennis-mario-sports-superstars.png` | — |
| Birdo - Baseball | Birdo | Mario Sports Superstars | Card | `09ce0201-02b00e02` | `amiibo/birdo-baseball-mario-sports-superstars.png` | — |
| Birdo - Golf | Birdo | Mario Sports Superstars | Card | `09ce0401-02b20e02` | `amiibo/birdo-golf-mario-sports-superstars.png` | — |
| Birdo - Horse Racing | Birdo | Mario Sports Superstars | Card | `09ce0501-02b30e02` | `amiibo/birdo-horse-racing-mario-sports-superstars.png` | — |
| Birdo - Soccer | Birdo | Mario Sports Superstars | Card | `09ce0101-02af0e02` | `amiibo/birdo-soccer-mario-sports-superstars.png` | — |
| Birdo - Tennis | Birdo | Mario Sports Superstars | Card | `09ce0301-02b10e02` | `amiibo/birdo-tennis-mario-sports-superstars.png` | — |
| Boo - Baseball | Boo | Mario Sports Superstars | Card | `09cb0201-02a10e02` | `amiibo/boo-baseball-mario-sports-superstars.png` | — |
| Boo - Golf | Boo | Mario Sports Superstars | Card | `09cb0401-02a30e02` | `amiibo/boo-golf-mario-sports-superstars.png` | — |
| Boo - Horse Racing | Boo | Mario Sports Superstars | Card | `09cb0501-02a40e02` | `amiibo/boo-horse-racing-mario-sports-superstars.png` | — |
| Boo - Soccer | Boo | Mario Sports Superstars | Card | `09cb0101-02a00e02` | `amiibo/boo-soccer-mario-sports-superstars.png` | — |
| Boo - Tennis | Boo | Mario Sports Superstars | Card | `09cb0301-02a20e02` | `amiibo/boo-tennis-mario-sports-superstars.png` | — |
| Bowser - Baseball | Bowser | Mario Sports Superstars | Card | `09c90201-02970e02` | `amiibo/bowser-baseball-mario-sports-superstars.png` | — |
| Bowser - Golf | Bowser | Mario Sports Superstars | Card | `09c90401-02990e02` | `amiibo/bowser-golf-mario-sports-superstars.png` | — |
| Bowser - Horse Racing | Bowser | Mario Sports Superstars | Card | `09c90501-029a0e02` | `amiibo/bowser-horse-racing-mario-sports-superstars.png` | — |
| Bowser - Soccer | Bowser | Mario Sports Superstars | Card | `09c90101-02960e02` | `amiibo/bowser-soccer-mario-sports-superstars.png` | — |
| Bowser - Tennis | Bowser | Mario Sports Superstars | Card | `09c90301-02980e02` | `amiibo/bowser-tennis-mario-sports-superstars.png` | — |
| Bowser Jr. - Baseball | Bowser Jr. | Mario Sports Superstars | Card | `09ca0201-029c0e02` | `amiibo/bowser-jr-baseball-mario-sports-superstars.png` | — |
| Bowser Jr. - Golf | Bowser Jr. | Mario Sports Superstars | Card | `09ca0401-029e0e02` | `amiibo/bowser-jr-golf-mario-sports-superstars.png` | — |
| Bowser Jr. - Horse Racing | Bowser Jr. | Mario Sports Superstars | Card | `09ca0501-029f0e02` | `amiibo/bowser-jr-horse-racing-mario-sports-superstars.png` | — |
| Bowser Jr. - Soccer | Bowser Jr. | Mario Sports Superstars | Card | `09ca0101-029b0e02` | `amiibo/bowser-jr-soccer-mario-sports-superstars.png` | — |
| Bowser Jr. - Tennis | Bowser Jr. | Mario Sports Superstars | Card | `09ca0301-029d0e02` | `amiibo/bowser-jr-tennis-mario-sports-superstars.png` | — |
| Daisy - Baseball | Daisy | Mario Sports Superstars | Card | `09c30201-02790e02` | `amiibo/daisy-baseball-mario-sports-superstars.png` | — |
| Daisy - Golf | Daisy | Mario Sports Superstars | Card | `09c30401-027b0e02` | `amiibo/daisy-golf-mario-sports-superstars.png` | — |
| Daisy - Horse Racing | Daisy | Mario Sports Superstars | Card | `09c30501-027c0e02` | `amiibo/daisy-horse-racing-mario-sports-superstars.png` | — |
| Daisy - Soccer | Daisy | Mario Sports Superstars | Card | `09c30101-02780e02` | `amiibo/daisy-soccer-mario-sports-superstars.png` | — |
| Daisy - Tennis | Daisy | Mario Sports Superstars | Card | `09c30301-027a0e02` | `amiibo/daisy-tennis-mario-sports-superstars.png` | — |
| Diddy Kong - Baseball | Diddy Kong | Mario Sports Superstars | Card | `09c80201-02920e02` | `amiibo/diddy-kong-baseball-mario-sports-superstars.png` | — |
| Diddy Kong - Golf | Diddy Kong | Mario Sports Superstars | Card | `09c80401-02940e02` | `amiibo/diddy-kong-golf-mario-sports-superstars.png` | — |
| Diddy Kong - Horse Racing | Diddy Kong | Mario Sports Superstars | Card | `09c80501-02950e02` | `amiibo/diddy-kong-horse-racing-mario-sports-superstars.png` | — |
| Diddy Kong - Soccer | Diddy Kong | Mario Sports Superstars | Card | `09c80101-02910e02` | `amiibo/diddy-kong-soccer-mario-sports-superstars.png` | — |
| Diddy Kong - Tennis | Diddy Kong | Mario Sports Superstars | Card | `09c80301-02930e02` | `amiibo/diddy-kong-tennis-mario-sports-superstars.png` | — |
| Donkey Kong - Baseball | Donkey Kong | Mario Sports Superstars | Card | `09c70201-028d0e02` | `amiibo/donkey-kong-baseball-mario-sports-superstars.png` | — |
| Donkey Kong - Golf | Donkey Kong | Mario Sports Superstars | Card | `09c70401-028f0e02` | `amiibo/donkey-kong-golf-mario-sports-superstars.png` | — |
| Donkey Kong - Horse Racing | Donkey Kong | Mario Sports Superstars | Card | `09c70501-02900e02` | `amiibo/donkey-kong-horse-racing-mario-sports-superstars.png` | — |
| Donkey Kong - Soccer | Donkey Kong | Mario Sports Superstars | Card | `09c70101-028c0e02` | `amiibo/donkey-kong-soccer-mario-sports-superstars.png` | — |
| Donkey Kong - Tennis | Donkey Kong | Mario Sports Superstars | Card | `09c70301-028e0e02` | `amiibo/donkey-kong-tennis-mario-sports-superstars.png` | — |
| Luigi - Baseball | Luigi | Mario Sports Superstars | Card | `09c10201-026f0e02` | `amiibo/luigi-baseball-mario-sports-superstars.png` | — |
| Luigi - Golf | Luigi | Mario Sports Superstars | Card | `09c10401-02710e02` | `amiibo/luigi-golf-mario-sports-superstars.png` | — |
| Luigi - Horse Racing | Luigi | Mario Sports Superstars | Card | `09c10501-02720e02` | `amiibo/luigi-horse-racing-mario-sports-superstars.png` | — |
| Luigi - Soccer | Luigi | Mario Sports Superstars | Card | `09c10101-026e0e02` | `amiibo/luigi-soccer-mario-sports-superstars.png` | — |
| Luigi - Tennis | Luigi | Mario Sports Superstars | Card | `09c10301-02700e02` | `amiibo/luigi-tennis-mario-sports-superstars.png` | — |
| Mario - Baseball | Mario | Mario Sports Superstars | Card | `09c00201-026a0e02` | `amiibo/mario-baseball-mario-sports-superstars.png` | — |
| Mario - Golf | Mario | Mario Sports Superstars | Card | `09c00401-026c0e02` | `amiibo/mario-golf-mario-sports-superstars.png` | — |
| Mario - Horse Racing | Mario | Mario Sports Superstars | Card | `09c00501-026d0e02` | `amiibo/mario-horse-racing-mario-sports-superstars.png` | — |
| Mario - Soccer | Mario | Mario Sports Superstars | Card | `09c00101-02690e02` | `amiibo/mario-soccer-mario-sports-superstars.png` | — |
| Mario - Tennis | Mario | Mario Sports Superstars | Card | `09c00301-026b0e02` | `amiibo/mario-tennis-mario-sports-superstars.png` | — |
| Metal Mario - Baseball | Metal Mario | Mario Sports Superstars | Card | `09d00201-02ba0e02` | `amiibo/metal-mario-baseball-mario-sports-superstars.png` | — |
| Metal Mario - Golf | Metal Mario | Mario Sports Superstars | Card | `09d00401-02bc0e02` | `amiibo/metal-mario-golf-mario-sports-superstars.png` | — |
| Metal Mario - Horse Racing | Metal Mario | Mario Sports Superstars | Card | `09d00501-02bd0e02` | `amiibo/metal-mario-horse-racing-mario-sports-superstars.png` | — |
| Metal Mario - Soccer | Metal Mario | Mario Sports Superstars | Card | `09d00101-02b90e02` | `amiibo/metal-mario-soccer-mario-sports-superstars.png` | — |
| Metal Mario - Tennis | Metal Mario | Mario Sports Superstars | Card | `09d00301-02bb0e02` | `amiibo/metal-mario-tennis-mario-sports-superstars.png` | — |
| Peach - Baseball | Peach | Mario Sports Superstars | Card | `09c20201-02740e02` | `amiibo/peach-baseball-mario-sports-superstars.png` | — |
| Peach - Golf | Peach | Mario Sports Superstars | Card | `09c20401-02760e02` | `amiibo/peach-golf-mario-sports-superstars.png` | — |
| Peach - Horse Racing | Peach | Mario Sports Superstars | Card | `09c20501-02770e02` | `amiibo/peach-horse-racing-mario-sports-superstars.png` | — |
| Peach - Soccer | Peach | Mario Sports Superstars | Card | `09c20101-02730e02` | `amiibo/peach-soccer-mario-sports-superstars.png` | — |
| Peach - Tennis | Peach | Mario Sports Superstars | Card | `09c20301-02750e02` | `amiibo/peach-tennis-mario-sports-superstars.png` | — |
| Pink Gold Peach - Baseball | Pink Gold Peach | Mario Sports Superstars | Card | `09d10201-02bf0e02` | `amiibo/pink-gold-peach-baseball-mario-sports-superstars.png` | — |
| Pink Gold Peach - Golf | Pink Gold Peach | Mario Sports Superstars | Card | `09d10401-02c10e02` | `amiibo/pink-gold-peach-golf-mario-sports-superstars.png` | — |
| Pink Gold Peach - Horse Racing | Pink Gold Peach | Mario Sports Superstars | Card | `09d10501-02c20e02` | `amiibo/pink-gold-peach-horse-racing-mario-sports-superstars.png` | — |
| Pink Gold Peach - Soccer | Pink Gold Peach | Mario Sports Superstars | Card | `09d10101-02be0e02` | `amiibo/pink-gold-peach-soccer-mario-sports-superstars.png` | — |
| Pink Gold Peach - Tennis | Pink Gold Peach | Mario Sports Superstars | Card | `09d10301-02c00e02` | `amiibo/pink-gold-peach-tennis-mario-sports-superstars.png` | — |
| Rosalina - Baseball | Rosalina | Mario Sports Superstars | Card | `09cf0201-02b50e02` | `amiibo/rosalina-baseball-mario-sports-superstars.png` | — |
| Rosalina - Golf | Rosalina | Mario Sports Superstars | Card | `09cf0401-02b70e02` | `amiibo/rosalina-golf-mario-sports-superstars.png` | — |
| Rosalina - Horse Racing | Rosalina | Mario Sports Superstars | Card | `09cf0501-02b80e02` | `amiibo/rosalina-horse-racing-mario-sports-superstars.png` | — |
| Rosalina - Soccer | Rosalina | Mario Sports Superstars | Card | `09cf0101-02b40e02` | `amiibo/rosalina-soccer-mario-sports-superstars.png` | — |
| Rosalina - Tennis | Rosalina | Mario Sports Superstars | Card | `09cf0301-02b60e02` | `amiibo/rosalina-tennis-mario-sports-superstars.png` | — |
| Waluigi - Baseball | Waluigi | Mario Sports Superstars | Card | `09c60201-02880e02` | `amiibo/waluigi-baseball-mario-sports-superstars.png` | — |
| Waluigi - Golf | Waluigi | Mario Sports Superstars | Card | `09c60401-028a0e02` | `amiibo/waluigi-golf-mario-sports-superstars.png` | — |
| Waluigi - Horse Racing | Waluigi | Mario Sports Superstars | Card | `09c60501-028b0e02` | `amiibo/waluigi-horse-racing-mario-sports-superstars.png` | — |
| Waluigi - Soccer | Waluigi | Mario Sports Superstars | Card | `09c60101-02870e02` | `amiibo/waluigi-soccer-mario-sports-superstars.png` | — |
| Waluigi - Tennis | Waluigi | Mario Sports Superstars | Card | `09c60301-02890e02` | `amiibo/waluigi-tennis-mario-sports-superstars.png` | — |
| Wario - Baseball | Wario | Mario Sports Superstars | Card | `09c50201-02830e02` | `amiibo/wario-baseball-mario-sports-superstars.png` | — |
| Wario - Golf | Wario | Mario Sports Superstars | Card | `09c50401-02850e02` | `amiibo/wario-golf-mario-sports-superstars.png` | — |
| Wario - Horse Racing | Wario | Mario Sports Superstars | Card | `09c50501-02860e02` | `amiibo/wario-horse-racing-mario-sports-superstars.png` | — |
| Wario - Soccer | Wario | Mario Sports Superstars | Card | `09c50101-02820e02` | `amiibo/wario-soccer-mario-sports-superstars.png` | — |
| Wario - Tennis | Wario | Mario Sports Superstars | Card | `09c50301-02840e02` | `amiibo/wario-tennis-mario-sports-superstars.png` | — |
| Yoshi - Baseball | Yoshi | Mario Sports Superstars | Card | `09c40201-027e0e02` | `amiibo/yoshi-baseball-mario-sports-superstars.png` | — |
| Yoshi - Golf | Yoshi | Mario Sports Superstars | Card | `09c40401-02800e02` | `amiibo/yoshi-golf-mario-sports-superstars.png` | — |
| Yoshi - Horse Racing | Yoshi | Mario Sports Superstars | Card | `09c40501-02810e02` | `amiibo/yoshi-horse-racing-mario-sports-superstars.png` | — |
| Yoshi - Soccer | Yoshi | Mario Sports Superstars | Card | `09c40101-027d0e02` | `amiibo/yoshi-soccer-mario-sports-superstars.png` | — |
| Yoshi - Tennis | Yoshi | Mario Sports Superstars | Card | `09c40301-027f0e02` | `amiibo/yoshi-tennis-mario-sports-superstars.png` | — |

### Mega Man (1)

| Name | Character | Game series | Type | amiibo ID | Image filename | Image present |
|---|---|---|---|---|---|---|
| Mega Man | Mega Man | Megaman | Figure | `34800000-03791502` | `amiibo/mega-man-mega-man.png` | — |

### Metroid (7)

| Name | Character | Game series | Type | amiibo ID | Image filename | Image present |
|---|---|---|---|---|---|---|
| E.M.M.I. | E.M.M.I. | Metroid | Figure | `05c40000-04131302` | `amiibo/e-m-m-i-metroid.png` | — |
| Metroid | Metroid | Metroid | Figure | `05c10000-03661302` | `amiibo/metroid-metroid.png` | — |
| Samus | Samus | Metroid | Figure | `05c00000-043b1302` | `amiibo/samus-metroid.png` | — |
| Samus & Vi-O-La | Samus | Metroid | Figure | `05c00000-043a1302` | `amiibo/samus-and-vi-o-la-metroid.png` | — |
| Samus - Metroid Dread | Samus | Metroid | Figure | `05c00000-04121302` | `amiibo/samus-metroid-dread-metroid.png` | — |
| Samus Aran | Samus | Metroid | Figure | `05c00000-03651302` | `amiibo/samus-aran-metroid.png` | — |
| Sylux | Sylux | Metroid | Figure | `05c50000-043c1302` | `amiibo/sylux-metroid.png` | — |

### Monster Hunter (9)

| Name | Character | Game series | Type | amiibo ID | Image filename | Image present |
|---|---|---|---|---|---|---|
| Barioth and Ayuria | Barioth | Monster Hunter | Figure | `35030100-02e50f02` | `amiibo/barioth-and-ayuria-monster-hunter.png` | — |
| Ena | Ena | Monster Hunter | Figure | `35060000-040d0f02` | `amiibo/ena-monster-hunter.png` | — |
| Nabiru | Nabiru | Monster Hunter | Figure | `35010000-02e30f02` | `amiibo/nabiru-monster-hunter.png` | — |
| One-Eyed Rathalos and Rider - Female | One-Eyed Rathalos | Monster Hunter | Figure | `35000200-02e20f02` | `amiibo/one-eyed-rathalos-and-rider-female-monster-hunter.png` | — |
| One-Eyed Rathalos and Rider - Male | One-Eyed Rathalos | Monster Hunter | Figure | `35000100-02e10f02` | `amiibo/one-eyed-rathalos-and-rider-male-monster-hunter.png` | — |
| Qurupeco and Dan | Qurupeco | Monster Hunter | Figure | `35040100-02e60f02` | `amiibo/qurupeco-and-dan-monster-hunter.png` | — |
| Rathian and Cheval | Rathian | Monster Hunter | Figure | `35020100-02e40f02` | `amiibo/rathian-and-cheval-monster-hunter.png` | — |
| Razewing Ratha | Razewing Ratha | Monster Hunter | Figure | `35050000-040c0f02` | `amiibo/razewing-ratha-monster-hunter.png` | — |
| Tsukino | Tsukino | Monster Hunter | Figure | `35070000-040e0f02` | `amiibo/tsukino-monster-hunter.png` | — |

### Monster Hunter Rise (6)

| Name | Character | Game series | Type | amiibo ID | Image filename | Image present |
|---|---|---|---|---|---|---|
| Magnamalo | Magnamalo | Monster Hunter | Figure | `35080000-040f1802` | `amiibo/magnamalo-monster-hunter-rise.png` | — |
| Malzeno | Malzeno | Monster Hunter | Figure | `350b0000-042d1802` | `amiibo/malzeno-monster-hunter-rise.png` | — |
| Palamute | Palamute | Monster Hunter | Figure | `350a0000-04111802` | `amiibo/palamute-monster-hunter-rise-figure-2.png` | — |
| Palamute | Palamute | Monster Hunter | Figure | `350a0100-042c1802` | `amiibo/palamute-monster-hunter-rise-figure-1.png` | — |
| Palico | Palico | Monster Hunter | Figure | `35090000-04101802` | `amiibo/palico-monster-hunter-rise-figure-2.png` | — |
| Palico | Palico | Monster Hunter | Figure | `35090100-042b1802` | `amiibo/palico-monster-hunter-rise-figure-1.png` | — |

### My Mario Wooden Blocks (4)

| Name | Character | Game series | Type | amiibo ID | Image filename | Image present |
|---|---|---|---|---|---|---|
| Luigi - My Mario Wooden Blocks | Luigi | Super Mario | Block | `00010004-04401c02` | `amiibo/luigi-my-mario-wooden-blocks-my-mario-wooden-blocks.png` | — |
| Mario - My Mario Wooden Blocks | Mario | Super Mario | Block | `00000004-043f1c02` | `amiibo/mario-my-mario-wooden-blocks-my-mario-wooden-blocks.png` | — |
| Peach - My Mario Wooden Blocks | Peach | Super Mario | Block | `00020004-04411c02` | `amiibo/peach-my-mario-wooden-blocks-my-mario-wooden-blocks.png` | — |
| Yoshi - My Mario Wooden Blocks | Yoshi | Super Mario | Block | `00030004-04421c02` | `amiibo/yoshi-my-mario-wooden-blocks-my-mario-wooden-blocks.png` | — |

### Others (2)

| Name | Character | Game series | Type | amiibo ID | Image filename | Image present |
|---|---|---|---|---|---|---|
| Solaire of Astora | Solaire of Astora | Dark Souls | Figure | `33800000-03781402` | `amiibo/solaire-of-astora-others.png` | — |
| Super Mario Cereal | Mario Cereal | Kellogs | Card | `37400001-03741402` | `amiibo/super-mario-cereal-others.png` | — |

### Pikmin (1)

| Name | Character | Game series | Type | amiibo ID | Image filename | Image present |
|---|---|---|---|---|---|---|
| Pikmin | Pikmin | Pikmin | Figure | `06420000-035f1102` | `amiibo/pikmin-pikmin.png` | — |

### Pokemon (2)

| Name | Character | Game series | Type | amiibo ID | Image filename | Image present |
|---|---|---|---|---|---|---|
| Detective Pikachu | Detective Pikachu | Pokemon | Figure | `1d010000-03750d02` | `amiibo/detective-pikachu-pokemon.png` | — |
| Shadow Mewtwo | Shadow Mewtwo | Pokemon | Card | `1d000001-025c0d02` | `amiibo/shadow-mewtwo-pokemon.png` | — |

### Power Pros (6)

| Name | Character | Game series | Type | amiibo ID | Image filename | Image present |
|---|---|---|---|---|---|---|
| Daijobu | Daijobu | Power Pros | Card | `38050001-03981702` | `amiibo/daijobu-power-pros.png` | — |
| Ganda | Ganda | Power Pros | Card | `38040001-03971702` | `amiibo/ganda-power-pros.png` | — |
| Hayakawa | Hayakawa | Power Pros | Card | `38030001-03961702` | `amiibo/hayakawa-power-pros.png` | — |
| Ikari | Ikari | Power Pros | Card | `38010001-03941702` | `amiibo/ikari-power-pros.png` | — |
| Pawapuro | Pawapuro | Power Pros | Card | `38000001-03931702` | `amiibo/pawapuro-power-pros.png` | — |
| Yabe | Yabe | Power Pros | Card | `38020001-03951702` | `amiibo/yabe-power-pros.png` | — |

### Shovel Knight (5)

| Name | Character | Game series | Type | amiibo ID | Image filename | Image present |
|---|---|---|---|---|---|---|
| King Knight | King Knight | Shovel Knight | Figure | `35c30000-036e0a02` | `amiibo/king-knight-shovel-knight.png` | — |
| Plague Knight | Plague Knight | Shovel Knight | Figure | `35c10000-036c0a02` | `amiibo/plague-knight-shovel-knight.png` | — |
| Shovel Knight | Shovel Knight | Shovel Knight | Figure | `35c00000-02500a02` | `amiibo/shovel-knight-shovel-knight.png` | — |
| Shovel Knight - Gold Edition | Shovel Knight | Shovel Knight | Figure | `35c00000-03920a02` | `amiibo/shovel-knight-gold-edition-shovel-knight.png` | — |
| Specter Knight | Specter Knight | Shovel Knight | Figure | `35c20000-036d0a02` | `amiibo/specter-knight-shovel-knight.png` | — |

### Skylanders (2)

| Name | Character | Game series | Type | amiibo ID | Image filename | Image present |
|---|---|---|---|---|---|---|
| Hammer Slam Bowser | Bowser | Super Mario | Figure | `0005ff00-023a0702` | `amiibo/hammer-slam-bowser-skylanders.png` | — |
| Turbo Charge Donkey Kong | Donkey Kong | Super Mario | Figure | `0008ff00-023b0702` | `amiibo/turbo-charge-donkey-kong-skylanders.png` | — |

### Splatoon (26)

| Name | Character | Game series | Type | amiibo ID | Image filename | Image present |
|---|---|---|---|---|---|---|
| Big Man | Big Man | Splatoon | Figure | `08090000-04350402` | `amiibo/big-man-splatoon.png` | — |
| Callie | Callie | Splatoon | Figure | `08010000-025d0402` | `amiibo/callie-splatoon.png` | — |
| Callie - Alterna | Callie | Splatoon | Figure | `08010000-04360402` | `amiibo/callie-alterna-splatoon.png` | — |
| Frye | Frye | Splatoon | Figure | `08080000-04340402` | `amiibo/frye-splatoon.png` | — |
| Inkling - Yellow | Inkling | Splatoon | Figure | `08000100-04150402` | `amiibo/inkling-yellow-splatoon.png` | — |
| Inkling Boy | Inkling | Splatoon | Figure | `08000200-003f0402` | `amiibo/inkling-boy-splatoon.png` | — |
| Inkling Boy - Neon Green | Inkling | Splatoon | Figure | `08000200-036a0402` | `amiibo/inkling-boy-neon-green-splatoon.png` | — |
| Inkling Boy - Purple | Inkling | Splatoon | Figure | `08000200-02600402` | `amiibo/inkling-boy-purple-splatoon.png` | — |
| Inkling Girl | Inkling | Splatoon | Figure | `08000100-003e0402` | `amiibo/inkling-girl-splatoon.png` | — |
| Inkling Girl - Lime Green | Inkling | Splatoon | Figure | `08000100-025f0402` | `amiibo/inkling-girl-lime-green-splatoon.png` | — |
| Inkling Girl - Neon Pink | Inkling | Splatoon | Figure | `08000100-03690402` | `amiibo/inkling-girl-neon-pink-splatoon.png` | — |
| Inkling Squid | Inkling | Splatoon | Figure | `08000300-00400402` | `amiibo/inkling-squid-splatoon.png` | — |
| Inkling Squid - Neon Purple | Inkling | Splatoon | Figure | `08000300-036b0402` | `amiibo/inkling-squid-neon-purple-splatoon.png` | — |
| Inkling Squid - Orange | Inkling | Splatoon | Figure | `08000300-02610402` | `amiibo/inkling-squid-orange-splatoon.png` | — |
| Marie | Marie | Splatoon | Figure | `08020000-025e0402` | `amiibo/marie-splatoon.png` | — |
| Marie - Alterna | Marie | Splatoon | Figure | `08020000-04370402` | `amiibo/marie-alterna-splatoon.png` | — |
| Marina | Marina | Splatoon | Figure | `08040000-03770402` | `amiibo/marina-splatoon.png` | — |
| Marina - Side Order | Marina | Splatoon | Figure | `08040000-04390402` | `amiibo/marina-side-order-splatoon.png` | — |
| Octoling - Blue | Octoling | Splatoon | Figure | `08050200-041b0402` | `amiibo/octoling-blue-splatoon.png` | — |
| Octoling Boy | Octoling | Splatoon | Figure | `08050200-038f0402` | `amiibo/octoling-boy-splatoon.png` | — |
| Octoling Girl | Octoling | Splatoon | Figure | `08050100-038e0402` | `amiibo/octoling-girl-splatoon.png` | — |
| Octoling Octopus | Octoling | Splatoon | Figure | `08050300-03900402` | `amiibo/octoling-octopus-splatoon.png` | — |
| Pearl | Pearl | Splatoon | Figure | `08030000-03760402` | `amiibo/pearl-splatoon.png` | — |
| Pearl - Side Order | Pearl | Splatoon | Figure | `08030000-04380402` | `amiibo/pearl-side-order-splatoon.png` | — |
| Shiver | Shiver | Splatoon | Figure | `08070000-04330402` | `amiibo/shiver-splatoon.png` | — |
| Smallfry | Smallfry | Splatoon | Figure | `08060100-041c0402` | `amiibo/smallfry-splatoon.png` | — |

### Street Fighter 6 (63)

| Name | Character | Game series | Type | amiibo ID | Image filename | Image present |
|---|---|---|---|---|---|---|
| A.K.I | A.K.I | Street Fighter | Card | `34d30001-04be1d02` | `amiibo/a-k-i-street-fighter-6-card-1.png` | — |
| A.K.I | A.K.I | Street Fighter | Card | `34d30001-04de1d02` | `amiibo/a-k-i-street-fighter-6-card-2.png` | — |
| Akuma | Akuma | Street Fighter | Card | `34d50001-04c01d02` | `amiibo/akuma-street-fighter-6-card-1.png` | — |
| Akuma | Akuma | Street Fighter | Card | `34d50001-04e01d02` | `amiibo/akuma-street-fighter-6-card-2.png` | — |
| Alex | Alex | Street Fighter | Card | `34db0001-04e61d02` | `amiibo/alex-street-fighter-6-card-1.png` | — |
| Alex | Alex | Street Fighter | Card | `34db0001-04ef1d02` | `amiibo/alex-street-fighter-6-card-2.png` | — |
| Blanka | Blanka | Street Fighter | Card | `34c80001-04b31d02` | `amiibo/blanka-street-fighter-6-card-1.png` | — |
| Blanka | Blanka | Street Fighter | Card | `34c80001-04d31d02` | `amiibo/blanka-street-fighter-6-card-2.png` | — |
| C. Viper | C. Viper | Street Fighter | Card | `34da0001-04e51d02` | `amiibo/c-viper-street-fighter-6-card-1.png` | — |
| C. Viper | C. Viper | Street Fighter | Card | `34da0001-04ee1d02` | `amiibo/c-viper-street-fighter-6-card-2.png` | — |
| Cammy | Cammy | Street Fighter | Card | `34d10001-04bc1d02` | `amiibo/cammy-street-fighter-6-card-1.png` | — |
| Cammy | Cammy | Street Fighter | Card | `34d10001-04dc1d02` | `amiibo/cammy-street-fighter-6-card-2.png` | — |
| Chun-Li | Chun-Li | Street Fighter | Card | `34c50001-04b01d02` | `amiibo/chun-li-street-fighter-6-card-1.png` | — |
| Chun-Li | Chun-Li | Street Fighter | Card | `34c50001-04d01d02` | `amiibo/chun-li-street-fighter-6-card-2.png` | — |
| Dee Jay | Dee Jay | Street Fighter | Card | `34cb0001-04b61d02` | `amiibo/dee-jay-street-fighter-6-card-1.png` | — |
| Dee Jay | Dee Jay | Street Fighter | Card | `34cb0001-04d61d02` | `amiibo/dee-jay-street-fighter-6-card-2.png` | — |
| Dhalsim | Dhalsim | Street Fighter | Card | `34c90001-04b41d02` | `amiibo/dhalsim-street-fighter-6-card-1.png` | — |
| Dhalsim | Dhalsim | Street Fighter | Card | `34c90001-04d41d02` | `amiibo/dhalsim-street-fighter-6-card-2.png` | — |
| E. Honda | E. Honda | Street Fighter | Card | `34ca0001-04b51d02` | `amiibo/e-honda-street-fighter-6-card-1.png` | — |
| E. Honda | E. Honda | Street Fighter | Card | `34ca0001-04d51d02` | `amiibo/e-honda-street-fighter-6-card-2.png` | — |
| Ed | Ed | Street Fighter | Card | `34d40001-04bf1d02` | `amiibo/ed-street-fighter-6-card-1.png` | — |
| Ed | Ed | Street Fighter | Card | `34d40001-04df1d02` | `amiibo/ed-street-fighter-6-card-2.png` | — |
| Elena | Elena | Street Fighter | Card | `34d80001-04e31d02` | `amiibo/elena-street-fighter-6-card-1.png` | — |
| Elena | Elena | Street Fighter | Card | `34d80001-04ec1d02` | `amiibo/elena-street-fighter-6-card-2.png` | — |
| Guile | Guile | Street Fighter | Card | `34c60001-04b11d02` | `amiibo/guile-street-fighter-6-card-1.png` | — |
| Guile | Guile | Street Fighter | Card | `34c60001-04d11d02` | `amiibo/guile-street-fighter-6-card-2.png` | — |
| Ingrid | Ingrid | Street Fighter | Card | `34dc0001-04e71d02` | `amiibo/ingrid-street-fighter-6-card-1.png` | — |
| Ingrid | Ingrid | Street Fighter | Card | `34dc0001-04f01d02` | `amiibo/ingrid-street-fighter-6-card-2.png` | — |
| Jamie | Jamie | Street Fighter | Figure | `34c30000-04ac1d02` | `amiibo/jamie-street-fighter-6-figure.png` | — |
| Jamie | Jamie | Street Fighter | Card | `34c30001-04ad1d02` | `amiibo/jamie-street-fighter-6-card-1.png` | — |
| Jamie | Jamie | Street Fighter | Card | `34c30001-04ce1d02` | `amiibo/jamie-street-fighter-6-card-2.png` | — |
| JP | JP | Street Fighter | Card | `34ce0001-04b91d02` | `amiibo/jp-street-fighter-6-card-1.png` | — |
| JP | JP | Street Fighter | Card | `34ce0001-04d91d02` | `amiibo/jp-street-fighter-6-card-2.png` | — |
| Juri | Juri | Street Fighter | Card | `34c70001-04b21d02` | `amiibo/juri-street-fighter-6-card-1.png` | — |
| Juri | Juri | Street Fighter | Card | `34c70001-04d21d02` | `amiibo/juri-street-fighter-6-card-2.png` | — |
| Ken | Ken | Street Fighter | Card | `34c10001-04a91d02` | `amiibo/ken-street-fighter-6-card-1.png` | — |
| Ken | Ken | Street Fighter | Card | `34c10001-04cc1d02` | `amiibo/ken-street-fighter-6-card-2.png` | — |
| Kimberly | Kimberly | Street Fighter | Figure | `34c40000-04ae1d02` | `amiibo/kimberly-street-fighter-6-figure.png` | — |
| Kimberly | Kimberly | Street Fighter | Card | `34c40001-04af1d02` | `amiibo/kimberly-street-fighter-6-card-1.png` | — |
| Kimberly | Kimberly | Street Fighter | Card | `34c40001-04cf1d02` | `amiibo/kimberly-street-fighter-6-card-2.png` | — |
| Lily | Lily | Street Fighter | Card | `34d00001-04bb1d02` | `amiibo/lily-street-fighter-6-card-1.png` | — |
| Lily | Lily | Street Fighter | Card | `34d00001-04db1d02` | `amiibo/lily-street-fighter-6-card-2.png` | — |
| Luke | Luke | Street Fighter | Figure | `34c20000-04aa1d02` | `amiibo/luke-street-fighter-6-figure.png` | — |
| Luke | Luke | Street Fighter | Card | `34c20001-04ab1d02` | `amiibo/luke-street-fighter-6-card-1.png` | — |
| Luke | Luke | Street Fighter | Card | `34c20001-04cd1d02` | `amiibo/luke-street-fighter-6-card-2.png` | — |
| M. Bison | M. Bison | Street Fighter | Card | `34d60001-04e11d02` | `amiibo/m-bison-street-fighter-6-card-1.png` | — |
| M. Bison | M. Bison | Street Fighter | Card | `34d60001-04eb1d02` | `amiibo/m-bison-street-fighter-6-card-2.png` | — |
| Mai | Mai | Fatal Fury | Card | `3c810001-04f21d02` | `amiibo/mai-street-fighter-6-card-1.png` | — |
| Mai | Mai | Fatal Fury | Card | `3c810001-04f31d02` | `amiibo/mai-street-fighter-6-card-2.png` | — |
| Manon | Manon | Street Fighter | Card | `34cc0001-04b71d02` | `amiibo/manon-street-fighter-6-card-1.png` | — |
| Manon | Manon | Street Fighter | Card | `34cc0001-04d71d02` | `amiibo/manon-street-fighter-6-card-2.png` | — |
| Marisa | Marisa | Street Fighter | Card | `34cd0001-04b81d02` | `amiibo/marisa-street-fighter-6-card-1.png` | — |
| Marisa | Marisa | Street Fighter | Card | `34cd0001-04d81d02` | `amiibo/marisa-street-fighter-6-card-2.png` | — |
| Rashid | Rashid | Street Fighter | Card | `34d20001-04bd1d02` | `amiibo/rashid-street-fighter-6-card-1.png` | — |
| Rashid | Rashid | Street Fighter | Card | `34d20001-04dd1d02` | `amiibo/rashid-street-fighter-6-card-2.png` | — |
| Ryu | Ryu | Street Fighter | Card | `34c00001-04a81d02` | `amiibo/ryu-street-fighter-6-card-1.png` | — |
| Ryu | Ryu | Street Fighter | Card | `34c00001-04cb1d02` | `amiibo/ryu-street-fighter-6-card-2.png` | — |
| Sagat | Sagat | Street Fighter | Card | `34d90001-04e41d02` | `amiibo/sagat-street-fighter-6-card-1.png` | — |
| Sagat | Sagat | Street Fighter | Card | `34d90001-04ed1d02` | `amiibo/sagat-street-fighter-6-card-2.png` | — |
| Terry | Terry | Fatal Fury | Card | `3c800001-04e81d02` | `amiibo/terry-street-fighter-6-card-1.png` | — |
| Terry | Terry | Fatal Fury | Card | `3c800001-04f11d02` | `amiibo/terry-street-fighter-6-card-2.png` | — |
| Zangief | Zangief | Street Fighter | Card | `34cf0001-04ba1d02` | `amiibo/zangief-street-fighter-6-card-1.png` | — |
| Zangief | Zangief | Street Fighter | Card | `34cf0001-04da1d02` | `amiibo/zangief-street-fighter-6-card-2.png` | — |

### Super Mario Bros. (22)

| Name | Character | Game series | Type | amiibo ID | Image filename | Image present |
|---|---|---|---|---|---|---|
| Boo | Boo | Super Mario | Figure | `00170000-02680102` | `amiibo/boo-super-mario-bros.png` | — |
| Bowser | Bowser | Super Mario | Figure | `00050000-00390102` | `amiibo/bowser-super-mario-bros.png` | — |
| Bowser - Wedding | Bowser | Super Mario | Figure | `00050000-03730102` | `amiibo/bowser-wedding-super-mario-bros.png` | — |
| Daisy | Daisy | Super Mario | Figure | `00130000-02660102` | `amiibo/daisy-super-mario-bros.png` | — |
| Diddy Kong | Diddy Kong | Super Mario | Figure | `00090000-02650102` | `amiibo/diddy-kong-super-mario-bros.png` | — |
| Donkey Kong | Donkey Kong | Super Mario | Figure | `00080000-02640102` | `amiibo/donkey-kong-super-mario-bros.png` | — |
| Goomba | Goomba | Super Mario | Figure | `00150000-03670102` | `amiibo/goomba-super-mario-bros.png` | — |
| Koopa Troopa | Koopa Troopa | Super Mario | Figure | `00230000-03680102` | `amiibo/koopa-troopa-super-mario-bros.png` | — |
| Luigi | Luigi | Super Mario | Figure | `00010000-00350102` | `amiibo/luigi-super-mario-bros.png` | — |
| Mario | Mario | Super Mario | Figure | `00000000-00340102` | `amiibo/mario-super-mario-bros.png` | — |
| Mario - Cat | Mario | Super Mario | Figure | `00000300-03a60102` | `amiibo/mario-cat-super-mario-bros.png` | — |
| Mario - Gold Edition | Mario | Super Mario | Figure | `00000000-003c0102` | `amiibo/mario-gold-edition-super-mario-bros.png` | — |
| Mario - Silver Edition | Mario | Super Mario | Figure | `00000000-003d0102` | `amiibo/mario-silver-edition-super-mario-bros.png` | — |
| Mario - Wedding | Mario | Super Mario | Figure | `00000000-03710102` | `amiibo/mario-wedding-super-mario-bros.png` | — |
| Peach | Peach | Super Mario | Figure | `00020000-00360102` | `amiibo/peach-super-mario-bros.png` | — |
| Peach - Cat | Peach | Super Mario | Figure | `00020100-03a70102` | `amiibo/peach-cat-super-mario-bros.png` | — |
| Peach - Wedding | Peach | Super Mario | Figure | `00020000-03720102` | `amiibo/peach-wedding-super-mario-bros.png` | — |
| Rosalina | Rosalina | Super Mario | Figure | `00040000-02620102` | `amiibo/rosalina-super-mario-bros.png` | — |
| Toad | Toad | Super Mario | Figure | `000a0000-00380102` | `amiibo/toad-super-mario-bros.png` | — |
| Waluigi | Waluigi | Super Mario | Figure | `00140000-02670102` | `amiibo/waluigi-super-mario-bros.png` | — |
| Wario | Wario | Super Mario | Figure | `00070000-02630102` | `amiibo/wario-super-mario-bros.png` | — |
| Yoshi | Yoshi | Super Mario | Figure | `00030000-00370102` | `amiibo/yoshi-super-mario-bros.png` | — |

### Super Nintendo World (9)

| Name | Character | Game series | Type | amiibo ID | Image filename | Image present |
|---|---|---|---|---|---|---|
| Daisy - Power Up Band | Daisy | Super Mario | Band | `00130003-039eff02` | `amiibo/daisy-power-up-band-super-nintendo-world.png` | — |
| Diddy Kong - Power Up Band | Diddy Kong | Super Mario | Band | `00090003-0432ff02` | `amiibo/diddy-kong-power-up-band-super-nintendo-world.png` | — |
| Donkey Kong - Power Up Band | Donkey Kong | Super Mario | Band | `00080003-0431ff02` | `amiibo/donkey-kong-power-up-band-super-nintendo-world.png` | — |
| Golden - Power Up Band | Mario | Super Mario | Band | `00000003-0430ff02` | `amiibo/golden-power-up-band-super-nintendo-world.png` | — |
| Luigi - Power Up Band | Luigi | Super Mario | Band | `00010003-039cff02` | `amiibo/luigi-power-up-band-super-nintendo-world.png` | — |
| Mario - Power Up Band | Mario | Super Mario | Band | `00000003-039bff02` | `amiibo/mario-power-up-band-super-nintendo-world.png` | — |
| Peach - Power Up Band | Peach | Super Mario | Band | `00020003-039dff02` | `amiibo/peach-power-up-band-super-nintendo-world.png` | — |
| Toad - Power Up Band | Toad | Super Mario | Band | `000a0003-03a0ff02` | `amiibo/toad-power-up-band-super-nintendo-world.png` | — |
| Yoshi - Power Up Band | Yoshi | Super Mario | Band | `00030003-039fff02` | `amiibo/yoshi-power-up-band-super-nintendo-world.png` | — |

### Super Smash Bros. (96)

| Name | Character | Game series | Type | amiibo ID | Image filename | Image present |
|---|---|---|---|---|---|---|
| Alex | Alex | Minecraft | Figure | `3dc10000-04230002` | `amiibo/alex-super-smash-bros.png` | — |
| Banjo & Kazooie | Banjo | Banjo Kazooie | Figure | `3b400000-03a30002` | `amiibo/banjo-and-kazooie-super-smash-bros.png` | — |
| Bayonetta | Bayonetta | Bayonetta | Figure | `32400000-025b0002` | `amiibo/bayonetta-super-smash-bros.png` | — |
| Bayonetta - Player 2 | Bayonetta | Bayonetta | Figure | `32400100-03640002` | `amiibo/bayonetta-player-2-super-smash-bros.png` | — |
| Bowser | Bowser | Super Mario | Figure | `00050000-00140002` | `amiibo/bowser-super-smash-bros.png` | — |
| Bowser Jr. | Bowser Jr. | Super Mario | Figure | `00060000-00150002` | `amiibo/bowser-jr-super-smash-bros.png` | — |
| Byleth | Byleth | Fire Emblem | Figure | `210b0000-03a50002` | `amiibo/byleth-super-smash-bros.png` | — |
| Captain Falcon | Captain Falcon | F-Zero | Figure | `06000000-00120002` | `amiibo/captain-falcon-super-smash-bros.png` | — |
| Charizard | Charizard | Pokemon | Figure | `19060000-00240002` | `amiibo/charizard-super-smash-bros.png` | — |
| Chrom | Chrom | Fire Emblem | Figure | `21080000-03880002` | `amiibo/chrom-super-smash-bros.png` | — |
| Cloud | Cloud Strife | Final Fantasy | Figure | `36000000-02590002` | `amiibo/cloud-super-smash-bros.png` | — |
| Cloud - Player 2 | Cloud Strife | Final Fantasy | Figure | `36000100-03620002` | `amiibo/cloud-player-2-super-smash-bros.png` | — |
| Corrin | Corrin | Fire Emblem | Figure | `21050000-025a0002` | `amiibo/corrin-super-smash-bros.png` | — |
| Corrin - Player 2 | Corrin | Fire Emblem | Figure | `21050100-03630002` | `amiibo/corrin-player-2-super-smash-bros.png` | — |
| Daisy | Daisy | Super Mario | Figure | `00130000-037a0002` | `amiibo/daisy-super-smash-bros.png` | — |
| Dark Pit | Dark Pit | Kid Icarus | Figure | `07410000-00200002` | `amiibo/dark-pit-super-smash-bros.png` | — |
| Dark Samus | Dark Samus | Metroid | Figure | `05c30000-03800002` | `amiibo/dark-samus-super-smash-bros.png` | — |
| Diddy Kong | Diddy Kong | Super Mario | Figure | `00090000-000d0002` | `amiibo/diddy-kong-super-smash-bros.png` | — |
| Donkey Kong | Donkey Kong | Super Mario | Figure | `00080000-00030002` | `amiibo/donkey-kong-super-smash-bros.png` | — |
| Dr. Mario | Mario | Super Mario | Figure | `00000100-00190002` | `amiibo/dr-mario-super-smash-bros.png` | — |
| Duck Hunt | Duck Hunt | Classic Nintendo | Figure | `07820000-002f0002` | `amiibo/duck-hunt-super-smash-bros.png` | — |
| Falco | Falco | Star Fox | Figure | `05810000-001c0002` | `amiibo/falco-super-smash-bros.png` | — |
| Fox | Fox | Star Fox | Figure | `05800000-00050002` | `amiibo/fox-super-smash-bros.png` | — |
| Ganondorf | Ganon | The Legend of Zelda | Figure | `01020100-001b0002` | `amiibo/ganondorf-super-smash-bros.png` | — |
| Greninja | Greninja | Pokemon | Figure | `1b920000-00250002` | `amiibo/greninja-super-smash-bros.png` | — |
| Hero | Hero | Dragon Quest | Figure | `36400000-03a20002` | `amiibo/hero-super-smash-bros.png` | — |
| Ice Climbers | Ice Climbers | Classic Nintendo | Figure | `078f0000-03810002` | `amiibo/ice-climbers-super-smash-bros.png` | — |
| Ike | Ike | Fire Emblem | Figure | `21010000-00180002` | `amiibo/ike-super-smash-bros.png` | — |
| Incineroar | Incineroar | Pokemon | Figure | `1bd70000-03860002` | `amiibo/incineroar-super-smash-bros.png` | — |
| Inkling | Inkling | Splatoon | Figure | `08000100-03820002` | `amiibo/inkling-super-smash-bros.png` | — |
| Isabelle | Isabelle | Animal Crossing | Figure | `01810000-037d0002` | `amiibo/isabelle-super-smash-bros.png` | — |
| Ivysaur | Ivysaur | Pokemon | Figure | `19020000-03830002` | `amiibo/ivysaur-super-smash-bros.png` | — |
| Jigglypuff | Jigglypuff | Pokemon | Figure | `19270000-00260002` | `amiibo/jigglypuff-super-smash-bros.png` | — |
| Joker | Joker | Persona | Figure | `3a000000-03a10002` | `amiibo/joker-super-smash-bros.png` | — |
| Kazuya | Kazuya | Tekken | Figure | `33c00000-04200002` | `amiibo/kazuya-super-smash-bros.png` | — |
| Ken | Ken | Street Fighter | Figure | `34c10000-03890002` | `amiibo/ken-super-smash-bros.png` | — |
| King Dedede | King Dedede | Kirby | Figure | `1f020000-00280002` | `amiibo/king-dedede-super-smash-bros.png` | — |
| King K. Rool | King K. Rool | Donkey Kong | Figure | `00c00000-037b0002` | `amiibo/king-k-rool-super-smash-bros.png` | — |
| Kirby | Kirby | Kirby | Figure | `1f000000-000a0002` | `amiibo/kirby-super-smash-bros.png` | — |
| Link | Link | The Legend of Zelda | Figure | `01000000-00040002` | `amiibo/link-super-smash-bros.png` | — |
| Little Mac | Little Mac | Punch Out | Figure | `06c00000-000f0002` | `amiibo/little-mac-super-smash-bros.png` | — |
| Lucario | Lucario | Pokemon | Figure | `1ac00000-00110002` | `amiibo/lucario-super-smash-bros.png` | — |
| Lucas | Lucas | Earthbound | Figure | `22810000-02510002` | `amiibo/lucas-super-smash-bros.png` | — |
| Lucina | Lucina | Fire Emblem | Figure | `21020000-00290002` | `amiibo/lucina-super-smash-bros.png` | — |
| Luigi | Luigi | Super Mario | Figure | `00010000-000c0002` | `amiibo/luigi-super-smash-bros.png` | — |
| Mario | Mario | Super Mario | Figure | `00000000-00000002` | `amiibo/mario-super-smash-bros.png` | — |
| Marth | Marth | Fire Emblem | Figure | `21000000-000b0002` | `amiibo/marth-super-smash-bros.png` | — |
| Mega Man | Mega Man | Megaman | Figure | `34800000-00310002` | `amiibo/mega-man-super-smash-bros.png` | — |
| Mega Man - Gold Edition | Mega Man | Megaman | Figure | `34800000-02580002` | `amiibo/mega-man-gold-edition-super-smash-bros.png` | — |
| Meta Knight | Meta Knight | Kirby | Figure | `1f010000-00270002` | `amiibo/meta-knight-super-smash-bros.png` | — |
| Mewtwo | Mewtwo | Pokemon | Figure | `19960000-023d0002` | `amiibo/mewtwo-super-smash-bros.png` | — |
| Mii Brawler | Mii | Mii | Figure | `07c00000-00210002` | `amiibo/mii-brawler-super-smash-bros.png` | — |
| Mii Gunner | Mii | Mii | Figure | `07c00200-00230002` | `amiibo/mii-gunner-super-smash-bros.png` | — |
| Mii Swordfighter | Mii | Mii | Figure | `07c00100-00220002` | `amiibo/mii-swordfighter-super-smash-bros.png` | — |
| Min Min | Min Min | ARMS | Figure | `0a400000-041d0002` | `amiibo/min-min-super-smash-bros.png` | — |
| Mr. Game & Watch | Mr. G&W | Classic Nintendo | Figure | `07800000-002d0002` | `amiibo/mr-game-and-watch-super-smash-bros.png` | — |
| Mythra | Mythra | Xenoblade | Figure | `22420000-041f0002` | `amiibo/mythra-super-smash-bros.png` | — |
| Ness | Ness | Earthbound | Figure | `22800000-002c0002` | `amiibo/ness-super-smash-bros.png` | — |
| Olimar | Olimar | Pikmin | Figure | `06400100-001e0002` | `amiibo/olimar-super-smash-bros.png` | — |
| Pac-Man | PAC-MAN | Pac-man | Figure | `33400000-00320002` | `amiibo/pac-man-super-smash-bros.png` | — |
| Palutena | Palutena | Kid Icarus | Figure | `07420000-001f0002` | `amiibo/palutena-super-smash-bros.png` | — |
| Peach | Peach | Super Mario | Figure | `00020000-00010002` | `amiibo/peach-super-smash-bros.png` | — |
| Pichu | Pichu | Pokemon | Figure | `19ac0000-03850002` | `amiibo/pichu-super-smash-bros.png` | — |
| Pikachu | Pikachu | Pokemon | Figure | `19190000-00090002` | `amiibo/pikachu-super-smash-bros.png` | — |
| Piranha Plant | Piranha Plant | Super Mario | Figure | `00240000-038d0002` | `amiibo/piranha-plant-super-smash-bros.png` | — |
| Pit | Pit | Kid Icarus | Figure | `07400000-00100002` | `amiibo/pit-super-smash-bros.png` | — |
| Pokemon Trainer | Pokemon Trainer | Pokemon | Figure | `1d400000-03870002` | `amiibo/pokemon-trainer-super-smash-bros.png` | — |
| Pyra | Pyra | Xenoblade | Figure | `22410000-041e0002` | `amiibo/pyra-super-smash-bros.png` | — |
| R.O.B. - Famicom | R.O.B. | Classic Nintendo | Figure | `07810000-002e0002` | `amiibo/r-o-b-famicom-super-smash-bros.png` | — |
| R.O.B. - NES | R.O.B. | Classic Nintendo | Figure | `07810000-00330002` | `amiibo/r-o-b-nes-super-smash-bros.png` | — |
| Richter | Richter | Castlevania | Figure | `37c10000-038c0002` | `amiibo/richter-super-smash-bros.png` | — |
| Ridley | Ridley | Metroid | Figure | `05c20000-037f0002` | `amiibo/ridley-super-smash-bros.png` | — |
| Robin | Robin | Fire Emblem | Figure | `21030000-002a0002` | `amiibo/robin-super-smash-bros.png` | — |
| Rosalina & Luma | Rosalina | Super Mario | Figure | `00040100-00130002` | `amiibo/rosalina-and-luma-super-smash-bros.png` | — |
| Roy | Roy | Fire Emblem | Figure | `21040000-02520002` | `amiibo/roy-super-smash-bros.png` | — |
| Ryu | Ryu | Street Fighter | Figure | `34c00000-02530002` | `amiibo/ryu-super-smash-bros.png` | — |
| Samus | Samus | Metroid | Figure | `05c00000-00060002` | `amiibo/samus-super-smash-bros.png` | — |
| Sephiroth | Sephiroth | Final Fantasy | Figure | `36010000-04210002` | `amiibo/sephiroth-super-smash-bros.png` | — |
| Sheik | Zelda | The Legend of Zelda | Figure | `01010100-00170002` | `amiibo/sheik-super-smash-bros.png` | — |
| Shulk | Shulk | Xenoblade | Figure | `22400000-002b0002` | `amiibo/shulk-super-smash-bros.png` | — |
| Simon | Simon | Castlevania | Figure | `37c00000-038b0002` | `amiibo/simon-super-smash-bros.png` | — |
| Snake | Snake | Metal Gear Solid | Figure | `37800000-038a0002` | `amiibo/snake-super-smash-bros.png` | — |
| Sonic | Sonic | Sonic | Figure | `32000000-00300002` | `amiibo/sonic-super-smash-bros.png` | — |
| Sora | Sora | Kingdom Hearts | Figure | `3f000000-042e0002` | `amiibo/sora-super-smash-bros.png` | — |
| Squirtle | Squirtle | Pokemon | Figure | `19070000-03840002` | `amiibo/squirtle-super-smash-bros.png` | — |
| Steve | Steve | Minecraft | Figure | `3dc00000-04220002` | `amiibo/steve-super-smash-bros.png` | — |
| Terry | Terry | Fatal Fury | Figure | `3c800000-03a40002` | `amiibo/terry-super-smash-bros.png` | — |
| Toon Link | Link | The Legend of Zelda | Figure | `01000100-00160002` | `amiibo/toon-link-super-smash-bros.png` | — |
| Villager | Villager | Animal Crossing | Figure | `01800000-00080002` | `amiibo/villager-super-smash-bros.png` | — |
| Wario | Wario | Super Mario | Figure | `00070000-001a0002` | `amiibo/wario-super-smash-bros.png` | — |
| Wii Fit Trainer | Wii Fit Trainer | Wii Fit | Figure | `07000000-00070002` | `amiibo/wii-fit-trainer-super-smash-bros.png` | — |
| Wolf | Wolf | Star Fox | Figure | `05840000-037e0002` | `amiibo/wolf-super-smash-bros.png` | — |
| Yoshi | Yoshi | Super Mario | Figure | `00030000-00020002` | `amiibo/yoshi-super-smash-bros.png` | — |
| Young Link | Link | The Legend of Zelda | Figure | `01000000-037c0002` | `amiibo/young-link-super-smash-bros.png` | — |
| Zelda | Zelda | The Legend of Zelda | Figure | `01010000-000e0002` | `amiibo/zelda-super-smash-bros.png` | — |
| Zero Suit Samus | Samus | Metroid | Figure | `05c00100-001d0002` | `amiibo/zero-suit-samus-super-smash-bros.png` | — |

### Xenoblade Chronicles 3 (2)

| Name | Character | Game series | Type | amiibo ID | Image filename | Image present |
|---|---|---|---|---|---|---|
| Mio | Mio | Xenoblade | Figure | `22440000-043e1b02` | `amiibo/mio-xenoblade-chronicles-3.png` | — |
| Noah | Noah | Xenoblade | Figure | `22430000-043d1b02` | `amiibo/noah-xenoblade-chronicles-3.png` | — |

### Yoshi's Woolly World (5)

| Name | Character | Game series | Type | amiibo ID | Image filename | Image present |
|---|---|---|---|---|---|---|
| Green Yarn Yoshi | Yoshi | Super Mario | Yarn | `00030102-00410302` | `amiibo/green-yarn-yoshi-yoshis-woolly-world.png` | — |
| Light Blue Yarn Yoshi | Yoshi | Super Mario | Yarn | `00030102-00430302` | `amiibo/light-blue-yarn-yoshi-yoshis-woolly-world.png` | — |
| Mega Yarn Yoshi | Yoshi | Super Mario | Yarn | `00030102-023e0302` | `amiibo/mega-yarn-yoshi-yoshis-woolly-world.png` | — |
| Pink Yarn Yoshi | Yoshi | Super Mario | Yarn | `00030102-00420302` | `amiibo/pink-yarn-yoshi-yoshis-woolly-world.png` | — |
| Poochy | Poochy | Yoshi's Woolly World | Yarn | `00800102-035d0302` | `amiibo/poochy-yoshis-woolly-world.png` | — |

### Yu-Gi-Oh! (7)

| Name | Character | Game series | Type | amiibo ID | Image filename | Image present |
|---|---|---|---|---|---|---|
| Asana Mutsuba | Asana Mutsuba | Yu-Gi-Oh! | Card | `38460001-042a1902` | `amiibo/asana-mutsuba-yu-gi-oh.png` | — |
| Gakuto Sōgetsu | Gakuto Sōgetsu | Yu-Gi-Oh! | Card | `38420001-04261902` | `amiibo/gakuto-s-getsu-yu-gi-oh.png` | — |
| Nail Saionji | Nail Saionji | Yu-Gi-Oh! | Card | `38450001-04291902` | `amiibo/nail-saionji-yu-gi-oh.png` | — |
| Roa Kirishima | Roa Kirishima | Yu-Gi-Oh! | Card | `38440001-04281902` | `amiibo/roa-kirishima-yu-gi-oh.png` | — |
| Romin Kirishima | Romin Kirishima | Yu-Gi-Oh! | Card | `38430001-04271902` | `amiibo/romin-kirishima-yu-gi-oh.png` | — |
| Tatsuhisa “Luke” Kamijō | Tatsuhisa “Luke” Kamijō | Yu-Gi-Oh! | Card | `38410001-04251902` | `amiibo/tatsuhisa-luke-kamij-yu-gi-oh.png` | — |
| Yuga Ohdo | Yuga Ohdo | Yu-Gi-Oh! | Card | `38400001-04241902` | `amiibo/yuga-ohdo-yu-gi-oh.png` | — |

## Skylanders (565)

### Spyro's Adventure (54)

| Name | Variant | Type | Element | Battle class | Toy ID | Image filename | Image present |
|---|---|---|---|---|---|---|---|
| Bash | Base | Core | Earth | — | `4:0000` | `skylanders/bash.png` | — |
| Bash | Legendary | Core | Earth | — | `404:0000` | `skylanders/bash-legendary.png` | — |
| Boomer | Base | Core | Tech | — | `22:0000` | `skylanders/boomer.png` | — |
| Camo | Base | Core | Life | — | `24:0000` | `skylanders/camo.png` | — |
| Chop Chop | Base | Core | Undead | — | `30:0000` | `skylanders/chop-chop.png` | — |
| Chop Chop | Legendary | Core | Undead | — | `430:0000` | `skylanders/chop-chop-legendary.png` | — |
| Cynder | Base | Core | Undead | — | `32:0000` | `skylanders/cynder.png` | — |
| Dino-Rang | Base | Core | Earth | — | `6:0000` | `skylanders/dino-rang.png` | — |
| Double Trouble | Base | Core | Magic | — | `18:0000` | `skylanders/double-trouble.png` | — |
| Drill Sergeant | Base | Core | Tech | — | `21:0000` | `skylanders/drill-sergeant.png` | — |
| Drobot | Base | Core | Tech | — | `20:0000` | `skylanders/drobot.png` | — |
| Eruptor | Base | Core | Fire | — | `9:0000` | `skylanders/eruptor.png` | — |
| Flameslinger | Base | Core | Fire | — | `11:0000` | `skylanders/flameslinger.png` | — |
| Ghost Roaster | Base | Core | Undead | — | `31:0000` | `skylanders/ghost-roaster.png` | — |
| Gill Grunt | Base | Core | Water | — | `14:0000` | `skylanders/gill-grunt.png` | — |
| Hex | Base | Core | Undead | — | `29:0000` | `skylanders/hex.png` | — |
| Ignitor | Base | Core | Fire | — | `10:0000` | `skylanders/ignitor.png` | — |
| Lightning Rod | Base | Core | Air | — | `3:0000` | `skylanders/lightning-rod.png` | — |
| Prism Break | Base | Core | Earth | — | `7:0000` | `skylanders/prism-break.png` | — |
| Slam Bam | Base | Core | Water | — | `15:0000` | `skylanders/slam-bam.png` | — |
| Sonic Boom | Base | Core | Air | — | `1:0000` | `skylanders/sonic-boom.png` | — |
| Spyro | Base | Core | Magic | — | `16:0000` | `skylanders/spyro.png` | — |
| Spyro | Dark | Core | Magic | — | `28:0000` | `skylanders/spyro-dark.png` | — |
| Spyro | Legendary | Core | Magic | — | `416:0000` | `skylanders/spyro-legendary.png` | — |
| Stealth Elf | Base | Core | Life | — | `26:0000` | `skylanders/stealth-elf.png` | — |
| Stump Smash | Base | Core | Life | — | `27:0000` | `skylanders/stump-smash.png` | — |
| Sunburn | Base | Core | Fire | — | `8:0000` | `skylanders/sunburn.png` | — |
| Terrafin | Base | Core | Earth | — | `5:0000` | `skylanders/terrafin.png` | — |
| Trigger Happy | Base | Core | Tech | — | `19:0000` | `skylanders/trigger-happy.png` | — |
| Trigger Happy | Legendary | Core | Tech | — | `419:0000` | `skylanders/trigger-happy-legendary.png` | — |
| Voodood | Base | Core | Magic | — | `17:0000` | `skylanders/voodood.png` | — |
| Warnado | Base | Core | Air | — | `2:0000` | `skylanders/warnado.png` | — |
| Wham-Shell | Base | Core | Water | — | `13:0000` | `skylanders/wham-shell.png` | — |
| Whirlwind | Base | Core | Air | — | `0:0000` | `skylanders/whirlwind.png` | — |
| Wrecking Ball | Base | Core | Magic | — | `23:0000` | `skylanders/wrecking-ball.png` | — |
| Zap | Base | Core | Water | — | `12:0000` | `skylanders/zap.png` | — |
| Zook | Base | Core | Life | — | `25:0000` | `skylanders/zook.png` | — |
| Gill Runt | Sidekick | Mini | Water | — | `514:0000` | `skylanders/gill-runt-sidekick.png` | — |
| Terrabite | Sidekick | Mini | Earth | — | `505:0000` | `skylanders/terrabite-sidekick.png` | — |
| Trigger Snappy | Sidekick | Mini | Tech | — | `519:0000` | `skylanders/trigger-snappy-sidekick.png` | — |
| Whisper Elf | Sidekick | Mini | Life | — | `526:0000` | `skylanders/whisper-elf-sidekick.png` | — |
| Anvil Rain | Base | Magic Item | — | — | `200:0000` | `skylanders/anvil-rain.png` | — |
| Ghost Pirate Swords | Base | Magic Item | — | — | `203:0000` | `skylanders/ghost-pirate-swords.png` | — |
| Healing Elixir | Base | Magic Item | — | — | `202:0000` | `skylanders/healing-elixir.png` | — |
| Hidden Treasure | Base | Magic Item | — | — | `201:0000` | `skylanders/hidden-treasure.png` | — |
| Sky-Iron Shield | Base | Magic Item | — | — | `205:0000` | `skylanders/sky-iron-shield.png` | — |
| Sparx Dragonfly | Base | Magic Item | — | — | `207:0000` | `skylanders/sparx-dragonfly.png` | — |
| Time Twister Hourglass | Base | Magic Item | — | — | `204:0000` | `skylanders/time-twister-hourglass.png` | — |
| Winged Boots | Base | Magic Item | — | — | `206:0000` | `skylanders/winged-boots.png` | — |
| Darklight Crypt | Base | Adventure Pack | — | — | `303:0000` | `skylanders/darklight-crypt.png` | — |
| Dragon's Peak | Base | Adventure Pack | — | — | `300:0000` | `skylanders/dragons-peak.png` | — |
| Empire of Ice | Base | Adventure Pack | — | — | `301:0000` | `skylanders/empire-of-ice.png` | — |
| Pirate Seas | Base | Adventure Pack | — | — | `302:0000` | `skylanders/pirate-seas.png` | — |
| Volcanic Vault | Base | Adventure Pack | — | — | `304:0000` | `skylanders/volcanic-vault.png` | — |

### Giants (91)

| Name | Variant | Type | Element | Battle class | Toy ID | Image filename | Image present |
|---|---|---|---|---|---|---|---|
| Bash | Series 2 | Core | Earth | — | `4:1801` | `skylanders/bash-series-2.png` | — |
| Chill | Base | Core | Water | — | `106:1000` | `skylanders/chill.png` | — |
| Chill | Legendary LightCore | Core | Water | — | `106:1603` | `skylanders/chill-legendary-lightcore.png` | — |
| Chill | LightCore | Core | Water | — | `106:1206` | `skylanders/chill-lightcore.png` | — |
| Chop Chop | Metallic Blue | Core | Undead | — | `30:1804` | `skylanders/chop-chop-metallic-blue.png` | — |
| Chop Chop | Series 2 | Core | Undead | — | `30:1801` | `skylanders/chop-chop-series-2.png` | — |
| Cynder | Glow in the Dark | Core | Undead | — | `32:1811` | `skylanders/cynder-glow-in-the-dark.png` | — |
| Cynder | Series 2 | Core | Undead | — | `32:1801` | `skylanders/cynder-series-2.png` | — |
| Double Trouble | Royal | Core | Magic | — | `18:1C02` | `skylanders/double-trouble-royal.png` | — |
| Double Trouble | Series 2 | Core | Magic | — | `18:1801` | `skylanders/double-trouble-series-2.png` | — |
| Drill Sergeant | Series 2 | Core | Tech | — | `21:1801` | `skylanders/drill-sergeant-series-2.png` | — |
| Drobot | LightCore | Core | Tech | — | `20:1206` | `skylanders/drobot-lightcore.png` | — |
| Drobot | Series 2 | Core | Tech | — | `20:1801` | `skylanders/drobot-series-2.png` | — |
| Eruptor | LightCore | Core | Fire | — | `9:1206` | `skylanders/eruptor-lightcore.png` | — |
| Eruptor | Series 2 | Core | Fire | — | `9:1801` | `skylanders/eruptor-series-2.png` | — |
| Eruptor | White Flocked | Core | Fire | — | `9:1814` | `skylanders/eruptor-white-flocked.png` | — |
| Flameslinger | Golden | Core | Fire | — | `11:1802` | `skylanders/flameslinger-golden.png` | — |
| Flameslinger | Series 2 | Core | Fire | — | `11:1801` | `skylanders/flameslinger-series-2.png` | — |
| Flashwing | Base | Core | Earth | — | `103:1000` | `skylanders/flashwing.png` | — |
| Flashwing | Jade | Core | Earth | — | `103:1402` | `skylanders/flashwing-jade.png` | — |
| Fright Rider | Base | Core | Undead | — | `115:1000` | `skylanders/fright-rider.png` | — |
| Fright Rider | Glow in the Dark | Core | Undead | — | `115:1011` | `skylanders/fright-rider-glow-in-the-dark.png` | — |
| Fright Rider | Halloween | Core | Undead | — | `115:1015` | `skylanders/fright-rider-halloween.png` | — |
| Gill Grunt | Metallic Green | Core | Water | — | `14:1817` | `skylanders/gill-grunt-metallic-green.png` | — |
| Gill Grunt | Series 2 | Core | Water | — | `14:1801` | `skylanders/gill-grunt-series-2.png` | — |
| Hex | LightCore | Core | Undead | — | `29:1206` | `skylanders/hex-lightcore.png` | — |
| Hex | Series 2 | Core | Undead | — | `29:1801` | `skylanders/hex-series-2.png` | — |
| Hot Dog | Base | Core | Fire | — | `105:1000` | `skylanders/hot-dog.png` | — |
| Hot Dog | Bronze | Core | Fire | — | `105:1015` | `skylanders/hot-dog-bronze.png` | — |
| Hot Dog | Molten | Core | Fire | — | `105:1402` | `skylanders/hot-dog-molten.png` | — |
| Ignitor | Legendary | Core | Fire | — | `10:1C03` | `skylanders/ignitor-legendary.png` | — |
| Ignitor | Series 2 | Core | Fire | — | `10:1801` | `skylanders/ignitor-series-2.png` | — |
| Jet-Vac | Base | Core | Air | — | `100:1000` | `skylanders/jet-vac.png` | — |
| Jet-Vac | Legendary | Core | Air | — | `100:1403` | `skylanders/jet-vac-legendary.png` | — |
| Jet-Vac | LightCore | Core | Air | — | `100:1206` | `skylanders/jet-vac-lightcore.png` | — |
| Lightning Rod | Metallic Purple | Core | Air | — | `3:1814` | `skylanders/lightning-rod-metallic-purple.png` | — |
| Lightning Rod | Series 2 | Core | Air | — | `3:1801` | `skylanders/lightning-rod-series-2.png` | — |
| Pop Fizz | Base | Core | Magic | — | `108:1000` | `skylanders/pop-fizz.png` | — |
| Pop Fizz | LightCore | Core | Magic | — | `108:1206` | `skylanders/pop-fizz-lightcore.png` | — |
| Pop Fizz | Punch | Core | Magic | — | `108:1402` | `skylanders/pop-fizz-punch.png` | — |
| Prism Break | LightCore | Core | Earth | — | `7:1206` | `skylanders/prism-break-lightcore.png` | — |
| Prism Break | Series 2 | Core | Earth | — | `7:1801` | `skylanders/prism-break-series-2.png` | — |
| Prism Break | White Flocked LightCore | Core | Earth | — | `7:1214` | `skylanders/prism-break-white-flocked-lightcore.png` | — |
| Shroomboom | Base | Core | Life | — | `113:1000` | `skylanders/shroomboom.png` | — |
| Shroomboom | LightCore | Core | Life | — | `113:1206` | `skylanders/shroomboom-lightcore.png` | — |
| Shroomboom | Metallic Green | Core | Life | — | `113:1017` | `skylanders/shroomboom-metallic-green.png` | — |
| Slam Bam | Legendary | Core | Water | — | `15:1C03` | `skylanders/slam-bam-legendary.png` | — |
| Slam Bam | Series 2 | Core | Water | — | `15:1801` | `skylanders/slam-bam-series-2.png` | — |
| Sonic Boom | Glow in the Dark | Core | Air | — | `1:1811` | `skylanders/sonic-boom-glow-in-the-dark.png` | — |
| Sonic Boom | Series 2 | Core | Air | — | `1:1801` | `skylanders/sonic-boom-series-2.png` | — |
| Sonic Boom | Sparkle | Core | Air | — | `1:1813` | `skylanders/sonic-boom-sparkle.png` | — |
| Sprocket | Base | Core | Tech | — | `111:1000` | `skylanders/sprocket.png` | — |
| Sprocket | Sparkle | Core | Tech | — | `111:1013` | `skylanders/sprocket-sparkle.png` | — |
| Spyro | Series 2 | Core | Magic | — | `16:1801` | `skylanders/spyro-series-2.png` | — |
| Stealth Elf | Legendary | Core | Life | — | `26:1C03` | `skylanders/stealth-elf-legendary.png` | — |
| Stealth Elf | Series 2 | Core | Life | — | `26:1801` | `skylanders/stealth-elf-series-2.png` | — |
| Stump Smash | Series 2 | Core | Life | — | `27:1801` | `skylanders/stump-smash-series-2.png` | — |
| Stump Smash | White Flocked | Core | Life | — | `27:1814` | `skylanders/stump-smash-white-flocked.png` | — |
| Terrafin | Series 2 | Core | Earth | — | `5:1801` | `skylanders/terrafin-series-2.png` | — |
| Trigger Happy | Series 2 | Core | Tech | — | `19:1801` | `skylanders/trigger-happy-series-2.png` | — |
| Whirlwind | Polar | Core | Air | — | `0:1C02` | `skylanders/whirlwind-polar.png` | — |
| Whirlwind | Series 2 | Core | Air | — | `0:1801` | `skylanders/whirlwind-series-2.png` | — |
| Whirlwind | Stone | Core | Air | — | `0:1812` | `skylanders/whirlwind-stone.png` | — |
| Wrecking Ball | Metallic Purple | Core | Magic | — | `23:1814` | `skylanders/wrecking-ball-metallic-purple.png` | — |
| Wrecking Ball | Series 2 | Core | Magic | — | `23:1801` | `skylanders/wrecking-ball-series-2.png` | — |
| Zap | Series 2 | Core | Water | — | `12:1801` | `skylanders/zap-series-2.png` | — |
| Zook | Series 2 | Core | Life | — | `25:1801` | `skylanders/zook-series-2.png` | — |
| Zook | Stone | Core | Life | — | `25:1812` | `skylanders/zook-stone.png` | — |
| Bouncer | Base | Giant | Tech | — | `110:1206` | `skylanders/bouncer.png` | — |
| Bouncer | Legendary | Giant | Tech | — | `110:1603` | `skylanders/bouncer-legendary.png` | — |
| Crusher | Base | Giant | Earth | — | `102:1206` | `skylanders/crusher.png` | — |
| Crusher | Granite | Giant | Earth | — | `102:1602` | `skylanders/crusher-granite.png` | — |
| Eye-Brawl | Base | Giant | Undead | — | `114:1206` | `skylanders/eye-brawl.png` | — |
| Eye-Brawl | Metallic Purple | Giant | Undead | — | `114:1214` | `skylanders/eye-brawl-metallic-purple.png` | — |
| Eye-Brawl | Pumpkin | Giant | Undead | — | `114:1215` | `skylanders/eye-brawl-pumpkin.png` | — |
| Hot Head | Base | Giant | Fire | — | `104:1206` | `skylanders/hot-head.png` | — |
| Hot Head | Sparkle | Giant | Fire | — | `104:1213` | `skylanders/hot-head-sparkle.png` | — |
| Ninjini | Base | Giant | Magic | — | `109:1206` | `skylanders/ninjini.png` | — |
| Ninjini | Scarlet | Giant | Magic | — | `109:1602` | `skylanders/ninjini-scarlet.png` | — |
| Swarm | Base | Giant | Air | — | `101:1206` | `skylanders/swarm.png` | — |
| Thumpback | Base | Giant | Water | — | `107:1206` | `skylanders/thumpback.png` | — |
| Tree Rex | Base | Giant | Life | — | `112:1206` | `skylanders/tree-rex.png` | — |
| Tree Rex | Gnarly | Giant | Life | — | `112:1602` | `skylanders/tree-rex-gnarly.png` | — |
| Barkley | Sidekick | Mini | Life | — | `540:1000` | `skylanders/barkley-sidekick.png` | — |
| Eye-Small | Sidekick | Mini | Undead | — | `543:1000` | `skylanders/eye-small-sidekick.png` | — |
| Mini Jini | Sidekick | Mini | Magic | — | `542:1000` | `skylanders/mini-jini-sidekick.png` | — |
| Thumpling | Sidekick | Mini | Water | — | `541:1000` | `skylanders/thumpling-sidekick.png` | — |
| Dragonfire Cannon | Base | Magic Item | — | — | `208:1206` | `skylanders/dragonfire-cannon.png` | — |
| Golden Dragonfire Cannon | Base | Magic Item | — | — | `208:1602` | `skylanders/golden-dragonfire-cannon.png` | — |
| Hidden Treasure | Platinum | Magic Item | — | — | `201:0002` | `skylanders/hidden-treasure-platinum.png` | — |
| Scorpion Striker Catapult | Base | Magic Item | — | — | `209:1206` | `skylanders/scorpion-striker-catapult.png` | — |

### Swap Force (99)

| Name | Variant | Type | Element | Battle class | Toy ID | Image filename | Image present |
|---|---|---|---|---|---|---|---|
| Bumble Blast | Base | Core | Life | — | `3006:2000` | `skylanders/bumble-blast.png` | — |
| Bumble Blast | Jolly | Core | Life | — | `3006:2402` | `skylanders/bumble-blast-jolly.png` | — |
| Bumble Blast | LightCore | Core | Life | — | `3006:2206` | `skylanders/bumble-blast-lightcore.png` | — |
| Camo | Thorn Horn | Core | Life | — | `24:2805` | `skylanders/camo-thorn-horn.png` | — |
| Chill | Blizzard | Core | Water | — | `106:2805` | `skylanders/chill-blizzard.png` | — |
| Chop Chop | Green Twin Blade | Core | Undead | — | `30:2816` | `skylanders/chop-chop-green-twin-blade.png` | — |
| Chop Chop | Twin Blade | Core | Undead | — | `30:2805` | `skylanders/chop-chop-twin-blade.png` | — |
| Countdown | Base | Core | Tech | — | `3010:2000` | `skylanders/countdown.png` | — |
| Countdown | Kickoff | Core | Tech | — | `3010:2402` | `skylanders/countdown-kickoff.png` | — |
| Countdown | LightCore | Core | Tech | — | `3010:2206` | `skylanders/countdown-lightcore.png` | — |
| Cynder | Phantom | Core | Undead | — | `32:2805` | `skylanders/cynder-phantom.png` | — |
| Dune Bug | Base | Core | Magic | — | `3008:2000` | `skylanders/dune-bug.png` | — |
| Dune Bug | Metallic Red | Core | Magic | — | `3008:2004` | `skylanders/dune-bug-metallic-red.png` | — |
| Eruptor | Lava Barf | Core | Fire | — | `9:2805` | `skylanders/eruptor-lava-barf.png` | — |
| Eruptor | Volcanic Lava Barf | Core | Fire | — | `9:2C02` | `skylanders/eruptor-volcanic-lava-barf.png` | — |
| Flashwing | LightCore | Core | Earth | — | `103:2206` | `skylanders/flashwing-lightcore.png` | — |
| Fryno | Base | Core | Fire | — | `3004:2000` | `skylanders/fryno.png` | — |
| Gill Grunt | Anchors Away | Core | Water | — | `14:2805` | `skylanders/gill-grunt-anchors-away.png` | — |
| Grim Creeper | Base | Core | Undead | — | `3013:2000` | `skylanders/grim-creeper.png` | — |
| Grim Creeper | Legendary LightCore | Core | Undead | — | `3013:2603` | `skylanders/grim-creeper-legendary-lightcore.png` | — |
| Grim Creeper | LightCore | Core | Undead | — | `3013:2206` | `skylanders/grim-creeper-lightcore.png` | — |
| Hot Dog | Fire Bone | Core | Fire | — | `105:2805` | `skylanders/hot-dog-fire-bone.png` | — |
| Hot Dog | Green Flame Frito-Lay Fire Bone | Core | Fire | — | `105:281B` | `skylanders/hot-dog-green-flame-frito-lay-fire-bone.png` | — |
| Hot Dog | Purple Flame Frito-Lay Fire Bone | Core | Fire | — | `105:281C` | `skylanders/hot-dog-purple-flame-frito-lay-fire-bone.png` | — |
| Hot Dog | Red Flame Frito-Lay Fire Bone | Core | Fire | — | `105:281A` | `skylanders/hot-dog-red-flame-frito-lay-fire-bone.png` | — |
| Jet-Vac | Turbo | Core | Air | — | `100:2805` | `skylanders/jet-vac-turbo.png` | — |
| Pop Fizz | Super Gulp | Core | Magic | — | `108:2805` | `skylanders/pop-fizz-super-gulp.png` | — |
| Pop Thorn | Base | Core | Air | — | `3001:2000` | `skylanders/pop-thorn.png` | — |
| Prism Break | Hyper Beam | Core | Earth | — | `7:2805` | `skylanders/prism-break-hyper-beam.png` | — |
| Punk Shock | Base | Core | Water | — | `3015:2000` | `skylanders/punk-shock.png` | — |
| Rip Tide | Base | Core | Water | — | `3014:2000` | `skylanders/rip-tide.png` | — |
| Rip Tide | Green | Core | Water | — | `3014:2016` | `skylanders/rip-tide-green.png` | — |
| Roller Brawl | Base | Core | Undead | — | `3012:2000` | `skylanders/roller-brawl.png` | — |
| Scorp | Base | Core | Earth | — | `3003:2000` | `skylanders/scorp.png` | — |
| Scorp | Green | Core | Earth | — | `3003:2016` | `skylanders/scorp-green.png` | — |
| Scratch | Base | Core | Air | — | `3000:2000` | `skylanders/scratch.png` | — |
| Slobber Tooth | Base | Core | Earth | — | `3002:2000` | `skylanders/slobber-tooth.png` | — |
| Slobber Tooth | Dark | Core | Earth | — | `3002:2402` | `skylanders/slobber-tooth-dark.png` | — |
| Smolderdash | Base | Core | Fire | — | `3005:2000` | `skylanders/smolderdash.png` | — |
| Smolderdash | LightCore | Core | Fire | — | `3005:2206` | `skylanders/smolderdash-lightcore.png` | — |
| Snowderdash | LightCore | Core | Fire | — | `3005:2219` | `skylanders/snowderdash-lightcore.png` | — |
| Sprocket | Heavy Duty | Core | Tech | — | `111:2805` | `skylanders/sprocket-heavy-duty.png` | — |
| Sprocket | Heavy Metal Heavy Duty | Core | Tech | — | `111:2819` | `skylanders/sprocket-heavy-metal-heavy-duty.png` | — |
| Spyro | Dark Mega Ram | Core | Magic | — | `16:2C02` | `skylanders/spyro-dark-mega-ram.png` | — |
| Spyro | Mega Ram | Core | Magic | — | `16:2805` | `skylanders/spyro-mega-ram.png` | — |
| Star Strike | Base | Core | Magic | — | `3009:2000` | `skylanders/star-strike.png` | — |
| Star Strike | Enchanted LightCore | Core | Magic | — | `3009:2602` | `skylanders/star-strike-enchanted-lightcore.png` | — |
| Star Strike | LightCore | Core | Magic | — | `3009:2206` | `skylanders/star-strike-lightcore.png` | — |
| Stealth Elf | Dark Ninja | Core | Life | — | `26:2C02` | `skylanders/stealth-elf-dark-ninja.png` | — |
| Stealth Elf | Ninja | Core | Life | — | `26:2805` | `skylanders/stealth-elf-ninja.png` | — |
| Terrafin | Knockout | Core | Earth | — | `5:2805` | `skylanders/terrafin-knockout.png` | — |
| Trigger Happy | Big Bang | Core | Tech | — | `19:2805` | `skylanders/trigger-happy-big-bang.png` | — |
| Trigger Happy | Springtime Big Bang | Core | Tech | — | `19:2C02` | `skylanders/trigger-happy-springtime-big-bang.png` | — |
| Warnado | LightCore | Core | Air | — | `2:2206` | `skylanders/warnado-lightcore.png` | — |
| Wham-Shell | LightCore | Core | Water | — | `13:2206` | `skylanders/wham-shell-lightcore.png` | — |
| Whirlwind | Horn Blast | Core | Air | — | `0:2805` | `skylanders/whirlwind-horn-blast.png` | — |
| Wind Up | Base | Core | Tech | — | `3011:2000` | `skylanders/wind-up.png` | — |
| Wind Up | Gear Head Vicarious Visions | Core | Tech | — | `3011:2404` | `skylanders/wind-up-gear-head-vicarious-visions.png` | — |
| Zoo Lou | Base | Core | Life | — | `3007:2000` | `skylanders/zoo-lou.png` | — |
| Zoo Lou | Legendary | Core | Life | — | `3007:2403` | `skylanders/zoo-lou-legendary.png` | — |
| Blast Zone | Base | Swap Force | Fire | — | `top 2004:2000 / bottom 1004:2000` | `skylanders/blast-zone.png` | — |
| Blast Zone | Dark | Swap Force | Fire | — | `top 2004:2402 / bottom 1004:2402` | `skylanders/blast-zone-dark.png` | — |
| Boom Jet | Base | Swap Force | Air | — | `top 2000:2000 / bottom 1000:2000` | `skylanders/boom-jet.png` | — |
| Doom Stone | Base | Swap Force | Earth | — | `top 2003:2000 / bottom 1003:2000` | `skylanders/doom-stone.png` | — |
| Doom Stone | Gold & Bronze | Swap Force | Earth | — | `top 2003:2016 / bottom 1003:2016` | `skylanders/doom-stone-gold-and-bronze.png` | — |
| Fire Kraken | Base | Swap Force | Fire | — | `top 2005:2000 / bottom 1005:2000` | `skylanders/fire-kraken.png` | — |
| Fire Kraken | Gold | Swap Force | Fire | — | `top 2005:2004 / bottom 1005:2004` | `skylanders/fire-kraken-gold.png` | — |
| Fire Kraken | Jade | Swap Force | Fire | — | `top 2005:2402 / bottom 1005:2402` | `skylanders/fire-kraken-jade.png` | — |
| Free Ranger | Base | Swap Force | Air | — | `top 2001:2000 / bottom 1001:2000` | `skylanders/free-ranger.png` | — |
| Free Ranger | Legendary | Swap Force | Air | — | `top 2001:2403 / bottom 1001:2403` | `skylanders/free-ranger-legendary.png` | — |
| Freeze Blade | Base | Swap Force | Water | — | `top 2014:2000 / bottom 1014:2000` | `skylanders/freeze-blade.png` | — |
| Freeze Blade | Nitro | Swap Force | Water | — | `top 2014:2402 / bottom 1014:2402` | `skylanders/freeze-blade-nitro.png` | — |
| Grilla Drilla | Base | Swap Force | Life | — | `top 2007:2000 / bottom 1007:2000` | `skylanders/grilla-drilla.png` | — |
| Hoot Loop | Base | Swap Force | Magic | — | `top 2008:2000 / bottom 1008:2000` | `skylanders/hoot-loop.png` | — |
| Hoot Loop | Enchanted | Swap Force | Magic | — | `top 2008:2402 / bottom 1008:2402` | `skylanders/hoot-loop-enchanted.png` | — |
| Magna Charge | Base | Swap Force | Tech | — | `top 2010:2000 / bottom 1010:2000` | `skylanders/magna-charge.png` | — |
| Magna Charge | Nitro | Swap Force | Tech | — | `top 2010:2402 / bottom 1010:2402` | `skylanders/magna-charge-nitro.png` | — |
| Night Shift | Base | Swap Force | Undead | — | `top 2012:2000 / bottom 1012:2000` | `skylanders/night-shift.png` | — |
| Night Shift | Legendary | Swap Force | Undead | — | `top 2012:2403 / bottom 1012:2403` | `skylanders/night-shift-legendary.png` | — |
| Rattle Shake | Base | Swap Force | Undead | — | `top 2013:2000 / bottom 1013:2000` | `skylanders/rattle-shake.png` | — |
| Rattle Shake | Quickdraw | Swap Force | Undead | — | `top 2013:2402 / bottom 1013:2402` | `skylanders/rattle-shake-quickdraw.png` | — |
| Rubble Rouser | Base | Swap Force | Earth | — | `top 2002:2000 / bottom 1002:2000` | `skylanders/rubble-rouser.png` | — |
| Spy Rise | Base | Swap Force | Tech | — | `top 2011:2000 / bottom 1011:2000` | `skylanders/spy-rise.png` | — |
| Stink Bomb | Base | Swap Force | Life | — | `top 2006:2000 / bottom 1006:2000` | `skylanders/stink-bomb.png` | — |
| Stink Bomb | Silver & Gold | Swap Force | Life | — | `top 2006:2016 / bottom 1006:2016` | `skylanders/stink-bomb-silver-and-gold.png` | — |
| Trap Shadow | Base | Swap Force | Magic | — | `top 2009:2000 / bottom 1009:2000` | `skylanders/trap-shadow.png` | — |
| Trap Shadow | Bronze & Silver | Swap Force | Magic | — | `top 2009:2016 / bottom 1009:2016` | `skylanders/trap-shadow-bronze-and-silver.png` | — |
| Wash Buckler | Base | Swap Force | Water | — | `top 2015:2000 / bottom 1015:2000` | `skylanders/wash-buckler.png` | — |
| Wash Buckler | Dark | Swap Force | Water | — | `top 2015:2402 / bottom 1015:2402` | `skylanders/wash-buckler-dark.png` | — |
| Wash Buckler | Gold | Swap Force | Water | — | `top 2015:2018 / bottom 1015:2018` | `skylanders/wash-buckler-gold.png` | — |
| Battle Hammer | Base | Magic Item | — | — | `3200:2000` | `skylanders/battle-hammer.png` | — |
| Groove Machine | Base | Magic Item | — | — | `3203:2000` | `skylanders/groove-machine.png` | — |
| Platinum Sheep | Base | Magic Item | — | — | `3202:2000` | `skylanders/platinum-sheep.png` | — |
| Sky Diamond | Base | Magic Item | — | — | `3201:2000` | `skylanders/sky-diamond.png` | — |
| UFO Hat | Base | Magic Item | — | — | `3204:2000` | `skylanders/ufo-hat.png` | — |
| Arkeyan Crossbow | Base | Adventure Pack | — | — | `3303:2206` | `skylanders/arkeyan-crossbow.png` | — |
| Fiery Forge | Base | Adventure Pack | — | — | `3302:2206` | `skylanders/fiery-forge.png` | — |
| Sheep Wreck Island | Base | Adventure Pack | — | — | `3300:2000` | `skylanders/sheep-wreck-island.png` | — |
| Tower of Time | Base | Adventure Pack | — | — | `3301:2000` | `skylanders/tower-of-time.png` | — |

### Trap Team (153)

| Name | Variant | Type | Element | Battle class | Toy ID | Image filename | Image present |
|---|---|---|---|---|---|---|---|
| Bat Spin | Base | Core | Undead | — | `480:3000` | `skylanders/bat-spin.png` | — |
| Blackout | Base | Core | Dark | — | `485:3000` | `skylanders/blackout.png` | — |
| Blades | Base | Core | Air | — | `453:3000` | `skylanders/blades.png` | — |
| Blades | Legendary | Core | Air | — | `453:3403` | `skylanders/blades-legendary.png` | — |
| Chop Chop | Eon's Elite | Core | Undead | — | `30:3810` | `skylanders/chop-chop-eons-elite.png` | — |
| Chopper | Base | Core | Tech | — | `472:3000` | `skylanders/chopper.png` | — |
| Cobra Cadabra | Base | Core | Magic | — | `469:3000` | `skylanders/cobra-cadabra.png` | — |
| Cobra Cadabra | King | Core | Magic | — | `469:3402` | `skylanders/cobra-cadabra-king.png` | — |
| Deja Vu | Base | Core | Magic | — | `468:3000` | `skylanders/deja-vu.png` | — |
| Deja Vu | Legendary | Core | Magic | — | `468:3403` | `skylanders/deja-vu-legendary.png` | — |
| Echo | Base | Core | Water | — | `465:3000` | `skylanders/echo.png` | — |
| Eruptor | Eon's Elite | Core | Fire | — | `9:3810` | `skylanders/eruptor-eons-elite.png` | — |
| Fist Bump | Base | Core | Earth | — | `456:3000` | `skylanders/fist-bump.png` | — |
| Fling Kong | Base | Core | Air | — | `452:3000` | `skylanders/fling-kong.png` | — |
| Flip Wreck | Base | Core | Water | — | `464:3000` | `skylanders/flip-wreck.png` | — |
| Food Fight | Base | Core | Life | — | `476:3000` | `skylanders/food-fight.png` | — |
| Food Fight | Dark | Core | Life | — | `476:3402` | `skylanders/food-fight-dark.png` | — |
| Food Fight | Virtual | Core | Life | — | `476:450F` | `skylanders/food-fight-virtual.png` | — |
| Fryno | Hog Wild | Core | Fire | — | `3004:3801` | `skylanders/fryno-hog-wild.png` | — |
| Funny Bone | Base | Core | Undead | — | `481:3000` | `skylanders/funny-bone.png` | — |
| Gill Grunt | Eon's Elite | Core | Water | — | `14:3810` | `skylanders/gill-grunt-eons-elite.png` | — |
| Gill Grunt | Tidal Wave | Core | Water | — | `14:3809` | `skylanders/gill-grunt-tidal-wave.png` | — |
| High Five | Base | Core | Life | — | `477:3000` | `skylanders/high-five.png` | — |
| Jet-Vac | Full Blast | Core | Air | — | `100:3805` | `skylanders/jet-vac-full-blast.png` | — |
| Pop Fizz | Fizzy Frenzy | Core | Magic | — | `108:3805` | `skylanders/pop-fizz-fizzy-frenzy.png` | — |
| Pop Fizz | Love Potion Fizzy Frenzy | Core | Magic | — | `108:3C02` | `skylanders/pop-fizz-love-potion-fizzy-frenzy.png` | — |
| Rocky Roll | Base | Core | Earth | — | `457:3000` | `skylanders/rocky-roll.png` | — |
| Shroomboom | Sure Shot | Core | Life | — | `113:3801` | `skylanders/shroomboom-sure-shot.png` | — |
| Spotlight | Base | Core | Light | — | `483:3000` | `skylanders/spotlight.png` | — |
| Spyro | Eon's Elite | Core | Magic | — | `16:3810` | `skylanders/spyro-eons-elite.png` | — |
| Stealth Elf | Eon's Elite | Core | Life | — | `26:3810` | `skylanders/stealth-elf-eons-elite.png` | — |
| Terrafin | Eon's Elite | Core | Earth | — | `5:3810` | `skylanders/terrafin-eons-elite.png` | — |
| Torch | Base | Core | Fire | — | `461:3000` | `skylanders/torch.png` | — |
| Trail Blazer | Base | Core | Fire | — | `460:3000` | `skylanders/trail-blazer.png` | — |
| Tread Head | Base | Core | Tech | — | `473:3000` | `skylanders/tread-head.png` | — |
| Trigger Happy | Eon's Elite | Core | Tech | — | `19:3810` | `skylanders/trigger-happy-eons-elite.png` | — |
| Whirlwind | Eon's Elite | Core | Air | — | `0:3810` | `skylanders/whirlwind-eons-elite.png` | — |
| Blastermind | Base | Trap Master | Magic | — | `466:3000` | `skylanders/blastermind.png` | — |
| Bushwhack | Base | Trap Master | Life | — | `474:3000` | `skylanders/bushwhack.png` | — |
| Bushwhack | Legendary | Trap Master | Life | — | `474:3403` | `skylanders/bushwhack-legendary.png` | — |
| Enigma | Base | Trap Master | Magic | — | `467:3000` | `skylanders/enigma.png` | — |
| Gearshift | Base | Trap Master | Tech | — | `471:3000` | `skylanders/gearshift.png` | — |
| Gusto | Base | Trap Master | Air | — | `450:3000` | `skylanders/gusto.png` | — |
| Head Rush | Base | Trap Master | Earth | — | `455:3000` | `skylanders/head-rush.png` | — |
| Head Rush | Nitro | Trap Master | Earth | — | `455:3402` | `skylanders/head-rush-nitro.png` | — |
| Jawbreaker | Base | Trap Master | Tech | — | `470:3000` | `skylanders/jawbreaker.png` | — |
| Jawbreaker | Legendary | Trap Master | Tech | — | `470:3403` | `skylanders/jawbreaker-legendary.png` | — |
| Ka-Boom | Base | Trap Master | Fire | — | `459:3000` | `skylanders/ka-boom.png` | — |
| Knight Light | Base | Trap Master | Light | — | `482:3000` | `skylanders/knight-light.png` | — |
| Knight Mare | Base | Trap Master | Dark | — | `484:3000` | `skylanders/knight-mare.png` | — |
| Krypt King | Base | Trap Master | Undead | — | `478:3000` | `skylanders/krypt-king.png` | — |
| Krypt King | Nitro | Trap Master | Undead | — | `478:3402` | `skylanders/krypt-king-nitro.png` | — |
| Lob-Star | Base | Trap Master | Water | — | `463:3000` | `skylanders/lob-star.png` | — |
| Lob-Star | Winterfest | Trap Master | Water | — | `463:3402` | `skylanders/lob-star-winterfest.png` | — |
| Short Cut | Base | Trap Master | Undead | — | `479:3000` | `skylanders/short-cut.png` | — |
| Short Cut | Clear | Trap Master | Undead | — | `479:301D` | `skylanders/short-cut-clear.png` | — |
| Snap Shot | Base | Trap Master | Water | — | `462:3000` | `skylanders/snap-shot.png` | — |
| Snap Shot | Dark | Trap Master | Water | — | `462:3402` | `skylanders/snap-shot-dark.png` | — |
| Snap Shot | Virtual | Trap Master | Water | — | `462:450F` | `skylanders/snap-shot-virtual.png` | — |
| Thunderbolt | Base | Trap Master | Air | — | `451:3000` | `skylanders/thunderbolt.png` | — |
| Thunderbolt | Clear | Trap Master | Air | — | `451:301D` | `skylanders/thunderbolt-clear.png` | — |
| Tuff Luck | Base | Trap Master | Life | — | `475:3000` | `skylanders/tuff-luck.png` | — |
| Tuff Luck | Clear | Trap Master | Life | — | `475:301D` | `skylanders/tuff-luck-clear.png` | — |
| Wallop | Base | Trap Master | Earth | — | `454:3000` | `skylanders/wallop.png` | — |
| Wildfire | Base | Trap Master | Fire | — | `458:3000` | `skylanders/wildfire.png` | — |
| Wildfire | Dark | Trap Master | Fire | — | `458:3402` | `skylanders/wildfire-dark.png` | — |
| Barkley | Base | Mini | Life | — | `540:3000` | `skylanders/barkley.png` | — |
| Barkley | Gnarly | Mini | Life | — | `540:3402` | `skylanders/barkley-gnarly.png` | — |
| Bop | Base | Mini | Earth | — | `502:3000` | `skylanders/bop.png` | — |
| Breeze | Base | Mini | Air | — | `506:3000` | `skylanders/breeze.png` | — |
| Drobit | Base | Mini | Tech | — | `510:3000` | `skylanders/drobit.png` | — |
| Eye-Small | Base | Mini | Undead | — | `543:3000` | `skylanders/eye-small.png` | — |
| Gill Runt | Base | Mini | Water | — | `514:3000` | `skylanders/gill-runt.png` | — |
| Hijinx | Base | Mini | Undead | — | `504:3000` | `skylanders/hijinx.png` | — |
| Mini Jini | Base | Mini | Magic | — | `542:3000` | `skylanders/mini-jini.png` | — |
| Pet Vac | Base | Mini | Air | — | `508:3000` | `skylanders/pet-vac.png` | — |
| Pet Vac | Power Punch | Mini | Air | — | `508:3402` | `skylanders/pet-vac-power-punch.png` | — |
| Small Fry | Base | Mini | Fire | — | `509:3000` | `skylanders/small-fry.png` | — |
| Spry | Base | Mini | Magic | — | `503:3000` | `skylanders/spry.png` | — |
| Terrabite | Base | Mini | Earth | — | `505:3000` | `skylanders/terrabite.png` | — |
| Thumpling | Base | Mini | Water | — | `541:3000` | `skylanders/thumpling.png` | — |
| Trigger Snappy | Base | Mini | Tech | — | `519:3000` | `skylanders/trigger-snappy.png` | — |
| Weeruptor | Base | Mini | Fire | — | `507:3000` | `skylanders/weeruptor.png` | — |
| Weeruptor | Eggsellent | Mini | Fire | — | `507:3402` | `skylanders/weeruptor-eggsellent.png` | — |
| Whisper Elf | Base | Mini | Life | — | `526:3000` | `skylanders/whisper-elf.png` | — |
| Air Hourglass | Base | Trap | Air | — | `212:300E` | `skylanders/air-hourglass.png` | — |
| Air Jughead | Base | Trap | Air | — | `212:3006` | `skylanders/air-jughead.png` | — |
| Air Screamer | Base | Trap | Air | — | `212:3011` | `skylanders/air-screamer.png` | — |
| Air Snake | Base | Trap | Air | — | `212:3010` | `skylanders/air-snake.png` | — |
| Air Sword | Base | Trap | Air | — | `212:3018` | `skylanders/air-sword.png` | — |
| Air Toucan | Base | Trap | Air | — | `212:3003` | `skylanders/air-toucan.png` | — |
| Dark Handstand | Base | Trap | Dark | — | `218:301A` | `skylanders/dark-handstand.png` | — |
| Dark Spider | Base | Trap | Dark | — | `218:3014` | `skylanders/dark-spider.png` | — |
| Dark Sword | Base | Trap | Dark | — | `218:3018` | `skylanders/dark-sword.png` | — |
| Earth Hammer | Base | Trap | Earth | — | `216:300A` | `skylanders/earth-hammer.png` | — |
| Earth Handstand | Base | Trap | Earth | — | `216:301A` | `skylanders/earth-handstand.png` | — |
| Earth Hourglass | Base | Trap | Earth | — | `216:300E` | `skylanders/earth-hourglass.png` | — |
| Earth Orb | Base | Trap | Earth | — | `216:3004` | `skylanders/earth-orb.png` | — |
| Earth Totem | Base | Trap | Earth | — | `216:3012` | `skylanders/earth-totem.png` | — |
| Earth Toucan | Base | Trap | Earth | — | `216:3003` | `skylanders/earth-toucan.png` | — |
| Fire Captain's Hat | Base | Trap | Fire | — | `215:3017` | `skylanders/fire-captains-hat.png` | — |
| Fire Scepter | Base | Trap | Fire | — | `215:3009` | `skylanders/fire-scepter.png` | — |
| Fire Screamer | Base | Trap | Fire | — | `215:3011` | `skylanders/fire-screamer.png` | — |
| Fire Torch | Base | Trap | Fire | — | `215:3005` | `skylanders/fire-torch.png` | — |
| Fire Totem | Base | Trap | Fire | — | `215:3012` | `skylanders/fire-totem.png` | — |
| Fire Yawn | Base | Trap | Fire | — | `215:301B` | `skylanders/fire-yawn.png` | — |
| Kaos | Base | Trap | — | — | `220:301E` | `skylanders/kaos-trap-team.png` | — |
| Kaos | Ultimate | Trap | — | — | `220:351F` | `skylanders/kaos-ultimate.png` | — |
| Life Hammer | Base | Trap | Life | — | `217:300A` | `skylanders/life-hammer.png` | — |
| Life Snake | Base | Trap | Life | — | `217:3010` | `skylanders/life-snake.png` | — |
| Life Sword | Base | Trap | Life | — | `217:3018` | `skylanders/life-sword.png` | — |
| Life Torch | Base | Trap | Life | — | `217:3005` | `skylanders/life-torch.png` | — |
| Life Toucan | Base | Trap | Life | — | `217:3001` | `skylanders/life-toucan.png` | — |
| Life Yawn | Base | Trap | Life | — | `217:301B` | `skylanders/life-yawn.png` | — |
| Light Owl | Base | Trap | Light | — | `219:300F` | `skylanders/light-owl.png` | — |
| Light Rocket | Base | Trap | Light | — | `219:3015` | `skylanders/light-rocket.png` | — |
| Light Yawn | Base | Trap | Light | — | `219:301B` | `skylanders/light-yawn.png` | — |
| Magic Axe | Base | Trap | Magic | — | `210:300B` | `skylanders/magic-axe.png` | — |
| Magic Hourglass | Base | Trap | Magic | — | `210:300E` | `skylanders/magic-hourglass.png` | — |
| Magic Log Holder | Base | Trap | Magic | — | `210:3002` | `skylanders/magic-log-holder.png` | — |
| Magic Rocket | Base | Trap | Magic | — | `210:3015` | `skylanders/magic-rocket.png` | — |
| Magic Skull | Base | Trap | Magic | — | `210:3008` | `skylanders/magic-skull.png` | — |
| Magic Totem | Base | Trap | Magic | — | `210:3012` | `skylanders/magic-totem.png` | — |
| Tech Angel | Base | Trap | Tech | — | `214:3007` | `skylanders/tech-angel.png` | — |
| Tech Flying Helmet | Base | Trap | Tech | — | `214:3016` | `skylanders/tech-flying-helmet.png` | — |
| Tech Hand | Base | Trap | Tech | — | `214:300C` | `skylanders/tech-hand.png` | — |
| Tech Handstand | Base | Trap | Tech | — | `214:301A` | `skylanders/tech-handstand.png` | — |
| Tech Scepter | Base | Trap | Tech | — | `214:3009` | `skylanders/tech-scepter.png` | — |
| Tech Tiki | Base | Trap | Tech | — | `214:3001` | `skylanders/tech-tiki.png` | — |
| Undead Axe | Base | Trap | Undead | — | `213:300B` | `skylanders/undead-axe.png` | — |
| Undead Captain's Hat | Base | Trap | Undead | — | `213:3017` | `skylanders/undead-captains-hat.png` | — |
| Undead Hand | Base | Trap | Undead | — | `213:300C` | `skylanders/undead-hand.png` | — |
| Undead Orb | Base | Trap | Undead | — | `213:3004` | `skylanders/undead-orb.png` | — |
| Undead Orb | Legendary | Trap | Undead | — | `213:3404` | `skylanders/undead-orb-legendary.png` | — |
| Undead Skull | Base | Trap | Undead | — | `213:3008` | `skylanders/undead-skull.png` | — |
| Undead Skull | Legendary | Trap | Undead | — | `213:3408` | `skylanders/undead-skull-legendary.png` | — |
| Undead Snake | Base | Trap | Undead | — | `213:3010` | `skylanders/undead-snake.png` | — |
| Water Angel | Base | Trap | Water | — | `211:3007` | `skylanders/water-angel.png` | — |
| Water Axe | Base | Trap | Water | — | `211:300B` | `skylanders/water-axe.png` | — |
| Water Flying Helmet | Base | Trap | Water | — | `211:3016` | `skylanders/water-flying-helmet.png` | — |
| Water Jughead | Base | Trap | Water | — | `211:3006` | `skylanders/water-jughead.png` | — |
| Water Jughead | Legendary | Trap | Water | — | `211:3406` | `skylanders/water-jughead-legendary.png` | — |
| Water Log Holder | Base | Trap | Water | — | `211:3002` | `skylanders/water-log-holder.png` | — |
| Water Tiki | Base | Trap | Water | — | `211:3001` | `skylanders/water-tiki.png` | — |
| Hand of Fate | Base | Magic Item | — | — | `230:3000` | `skylanders/hand-of-fate.png` | — |
| Hand of Fate | Legendary | Magic Item | — | — | `230:3403` | `skylanders/hand-of-fate-legendary.png` | — |
| Piggy Bank | Base | Magic Item | — | — | `231:3000` | `skylanders/piggy-bank.png` | — |
| Rocket Ram | Base | Magic Item | — | — | `232:3000` | `skylanders/rocket-ram.png` | — |
| Tiki Speaky | Base | Magic Item | — | — | `233:3000` | `skylanders/tiki-speaky.png` | — |
| Midnight Museum | Base | Adventure Pack | — | — | `308:3206` | `skylanders/midnight-museum.png` | — |
| Mirror of Mystery | Base | Adventure Pack | — | — | `305:3000` | `skylanders/mirror-of-mystery.png` | — |
| Nightmare Express | Base | Adventure Pack | — | — | `306:3000` | `skylanders/nightmare-express.png` | — |
| Sunscraper Spire | Base | Adventure Pack | — | — | `307:3206` | `skylanders/sunscraper-spire.png` | — |

### SuperChargers (90)

| Name | Variant | Type | Element | Battle class | Toy ID | Image filename | Image present |
|---|---|---|---|---|---|---|---|
| Astroblast | Base | SuperCharger | Tech | — | `3426:4100` | `skylanders/astroblast.png` | — |
| Astroblast | Legendary | SuperCharger | Light | — | `3426:4503` | `skylanders/astroblast-legendary.png` | — |
| Boomer | Eon's Elite | SuperCharger | Tech | — | `22:4810` | `skylanders/boomer-eons-elite.png` | — |
| Bowser | Dark Hammer Slam | SuperCharger | Fire | — | `3424:4502` | `skylanders/bowser-dark-hammer-slam.png` | — |
| Bowser | Hammer Slam | SuperCharger | Fire | — | `3424:4100` | `skylanders/bowser-hammer-slam.png` | — |
| Dino-Rang | Eon's Elite | SuperCharger | Earth | — | `6:4810` | `skylanders/dino-rang-eons-elite.png` | — |
| Dive-Clops | Base | SuperCharger | Water | — | `3425:4100` | `skylanders/dive-clops.png` | — |
| Dive-Clops | Instant | SuperCharger | Water | — | `3425:450F` | `skylanders/dive-clops-instant.png` | — |
| Dive-Clops | Missile-Tow | SuperCharger | Water | — | `3425:450E` | `skylanders/dive-clops-missile-tow.png` | — |
| Donkey Kong | Dark Turbo Charge | SuperCharger | Life | — | `3423:4502` | `skylanders/donkey-kong-dark-turbo-charge.png` | — |
| Donkey Kong | Turbo Charge | SuperCharger | Life | — | `3423:4100` | `skylanders/donkey-kong-turbo-charge.png` | — |
| Eruptor | Lava Lance | SuperCharger | Fire | — | `3421:4100` | `skylanders/eruptor-lava-lance.png` | — |
| Eruptor | Patina Lava Lance | SuperCharger | Fire | — | `3421:411E` | `skylanders/eruptor-patina-lava-lance.png` | — |
| Fiesta | Base | SuperCharger | Undead | — | `3400:4100` | `skylanders/fiesta.png` | — |
| Fiesta | Frightful | SuperCharger | Undead | — | `3400:4515` | `skylanders/fiesta-frightful.png` | — |
| Ghost Roaster | Eon's Elite | SuperCharger | Undead | — | `31:4810` | `skylanders/ghost-roaster-eons-elite.png` | — |
| Gill Grunt | Deep Dive | SuperCharger | Water | — | `3422:4100` | `skylanders/gill-grunt-deep-dive.png` | — |
| High Volt | Base | SuperCharger | Tech | — | `3401:4100` | `skylanders/high-volt.png` | — |
| High Volt | Patina | SuperCharger | Tech | — | `3401:411E` | `skylanders/high-volt-patina.png` | — |
| Jet-Vac | Hurricane | SuperCharger | Air | — | `3413:4100` | `skylanders/jet-vac-hurricane.png` | — |
| Jet-Vac | Legendary Hurricane | SuperCharger | Air | — | `3413:4503` | `skylanders/jet-vac-legendary-hurricane.png` | — |
| Nightfall | Base | SuperCharger | Dark | — | `3427:4100` | `skylanders/nightfall.png` | — |
| Pop Fizz | Big Bubble | SuperCharger | Magic | — | `3420:4100` | `skylanders/pop-fizz-big-bubble.png` | — |
| Pop Fizz | Birthday Bash Big Bubble | SuperCharger | Magic | — | `3420:450E` | `skylanders/pop-fizz-birthday-bash-big-bubble.png` | — |
| Roller Brawl | Bone Bash | SuperCharger | Undead | — | `3417:4100` | `skylanders/roller-brawl-bone-bash.png` | — |
| Roller Brawl | Bronze Bone Bash | SuperCharger | Undead | — | `3417:411E` | `skylanders/roller-brawl-bronze-bone-bash.png` | — |
| Roller Brawl | Legendary Bone Bash | SuperCharger | Undead | — | `3417:4503` | `skylanders/roller-brawl-legendary-bone-bash.png` | — |
| Slam Bam | Eon's Elite | SuperCharger | Water | — | `15:3810` | `skylanders/slam-bam-eons-elite.png` | — |
| Smash Hit | Base | SuperCharger | Earth | — | `3411:4100` | `skylanders/smash-hit.png` | — |
| Smash Hit | Steel Plated | SuperCharger | Earth | — | `3411:4502` | `skylanders/smash-hit-steel-plated.png` | — |
| Spitfire | Base | SuperCharger | Fire | — | `3412:4100` | `skylanders/spitfire.png` | — |
| Spitfire | Dark | SuperCharger | Fire | — | `3412:4502` | `skylanders/spitfire-dark.png` | — |
| Spitfire | Instant | SuperCharger | Fire | — | `3412:450F` | `skylanders/spitfire-instant.png` | — |
| Splat | Base | SuperCharger | Magic | — | `3402:4100` | `skylanders/splat.png` | — |
| Splat | Power Blue | SuperCharger | Magic | — | `3402:4502` | `skylanders/splat-power-blue.png` | — |
| Stealth Elf | Dark Super Shot | SuperCharger | Life | — | `3415:4502` | `skylanders/stealth-elf-dark-super-shot.png` | — |
| Stealth Elf | Instant Super Shot | SuperCharger | Life | — | `3415:450F` | `skylanders/stealth-elf-instant-super-shot.png` | — |
| Stealth Elf | Super Shot | SuperCharger | Life | — | `3415:4100` | `skylanders/stealth-elf-super-shot.png` | — |
| Stormblade | Base | SuperCharger | Air | — | `3406:4100` | `skylanders/stormblade.png` | — |
| Stormblade | Snow-Brite | SuperCharger | Air | — | `3406:410E` | `skylanders/stormblade-snow-brite.png` | — |
| Terrafin | Shark Shooter | SuperCharger | Earth | — | `3416:4100` | `skylanders/terrafin-shark-shooter.png` | — |
| Thrillipede | Base | SuperCharger | Life | — | `3428:4100` | `skylanders/thrillipede.png` | — |
| Thrillipede | Eggcited | SuperCharger | Life | — | `3428:450D` | `skylanders/thrillipede-eggcited.png` | — |
| Trigger Happy | Double Dare | SuperCharger | Tech | — | `3414:4100` | `skylanders/trigger-happy-double-dare.png` | — |
| Trigger Happy | Power Blue Double Dare | SuperCharger | Tech | — | `3414:4502` | `skylanders/trigger-happy-power-blue-double-dare.png` | — |
| Voodood | Eon's Elite | SuperCharger | Magic | — | `17:3810` | `skylanders/voodood-eons-elite.png` | — |
| Zook | Eon's Elite | SuperCharger | Life | — | `25:3810` | `skylanders/zook-eons-elite.png` | — |
| Barrel Blaster | Base | Vehicle | Tech | — | `3240:4000` | `skylanders/barrel-blaster.png` | — |
| Barrel Blaster | Dark | Vehicle | Tech | — | `3240:4402` | `skylanders/barrel-blaster-dark.png` | — |
| Burn-Cycle | Base | Vehicle | Fire | — | `3223:4000` | `skylanders/burn-cycle.png` | — |
| Burn-Cycle | Patina | Vehicle | Fire | — | `3223:401E` | `skylanders/burn-cycle-patina.png` | — |
| Buzz Wing | Base | Vehicle | Life | — | `3241:4000` | `skylanders/buzz-wing.png` | — |
| Clown Cruiser | Base | Vehicle | Air | — | `3233:4000` | `skylanders/clown-cruiser.png` | — |
| Clown Cruiser | Dark | Vehicle | Air | — | `3233:4402` | `skylanders/clown-cruiser-dark.png` | — |
| Crypt Crusher | Base | Vehicle | Undead | — | `3227:4000` | `skylanders/crypt-crusher.png` | — |
| Dive Bomber | Base | Vehicle | Water | — | `3231:4000` | `skylanders/dive-bomber.png` | — |
| Dive Bomber | Instant | Vehicle | Water | — | `3231:450F` | `skylanders/dive-bomber-instant.png` | — |
| Dive Bomber | Spring Ahead | Vehicle | Water | — | `3231:4402` | `skylanders/dive-bomber-spring-ahead.png` | — |
| Gold Rusher | Base | Vehicle | Tech | — | `3234:4000` | `skylanders/gold-rusher.png` | — |
| Gold Rusher | Power Blue | Vehicle | Tech | — | `3234:4402` | `skylanders/gold-rusher-power-blue.png` | — |
| Hot Streak | Base | Vehicle | Fire | — | `3224:4000` | `skylanders/hot-streak.png` | — |
| Hot Streak | Dark | Vehicle | Fire | — | `3224:4402` | `skylanders/hot-streak-dark.png` | — |
| Hot Streak | Event Exclusive | Vehicle | Fire | — | `3224:4004` | `skylanders/hot-streak-event-exclusive.png` | — |
| Hot Streak | Golden | Vehicle | Fire | — | `3224:441E` | `skylanders/hot-streak-golden.png` | — |
| Hot Streak | Instant | Vehicle | Fire | — | `3224:450F` | `skylanders/hot-streak-instant.png` | — |
| Hot Streak | Mobile | Vehicle | Fire | — | `3224:411F` | `skylanders/hot-streak-mobile.png` | — |
| Jet Stream | Base | Vehicle | Air | — | `3220:4000` | `skylanders/jet-stream.png` | — |
| Reef Ripper | Base | Vehicle | Water | — | `3222:4000` | `skylanders/reef-ripper.png` | — |
| Sea Shadow | Base | Vehicle | Dark | — | `3237:4000` | `skylanders/sea-shadow.png` | — |
| Sea Shadow | Dark | Vehicle | Dark | — | `3237:4402` | `skylanders/sea-shadow-dark.png` | — |
| Shark Tank | Base | Vehicle | Earth | — | `3225:4000` | `skylanders/shark-tank.png` | — |
| Shield Striker | Base | Vehicle | Tech | — | `3235:4000` | `skylanders/shield-striker.png` | — |
| Shield Striker | Patina | Vehicle | Tech | — | `3235:401E` | `skylanders/shield-striker-patina.png` | — |
| Sky Slicer | Base | Vehicle | Air | — | `3232:4000` | `skylanders/sky-slicer.png` | — |
| Soda Skimmer | Base | Vehicle | Magic | — | `3239:4000` | `skylanders/soda-skimmer.png` | — |
| Soda Skimmer | Nitro | Vehicle | Magic | — | `3239:4402` | `skylanders/soda-skimmer-nitro.png` | — |
| Splatter Splasher | Base | Vehicle | Magic | — | `3238:4000` | `skylanders/splatter-splasher.png` | — |
| Splatter Splasher | Power Blue | Vehicle | Magic | — | `3238:4402` | `skylanders/splatter-splasher-power-blue.png` | — |
| Stealth Stinger | Base | Vehicle | Life | — | `3228:4000` | `skylanders/stealth-stinger.png` | — |
| Stealth Stinger | Instant | Vehicle | Life | — | `3228:450F` | `skylanders/stealth-stinger-instant.png` | — |
| Stealth Stinger | Nitro | Vehicle | Life | — | `3228:4402` | `skylanders/stealth-stinger-nitro.png` | — |
| Sun Runner | Base | Vehicle | Light | — | `3236:4000` | `skylanders/sun-runner.png` | — |
| Sun Runner | Legendary | Vehicle | Light | — | `3236:4403` | `skylanders/sun-runner-legendary.png` | — |
| Thump Truck | Base | Vehicle | Earth | — | `3226:4000` | `skylanders/thump-truck.png` | — |
| Tomb Buggy | Base | Vehicle | Undead | — | `3221:4000` | `skylanders/tomb-buggy.png` | — |
| Tomb Buggy | Bronze | Vehicle | Undead | — | `3221:401E` | `skylanders/tomb-buggy-bronze.png` | — |
| Kaos Trophy | Base | Racing Trophy | — | — | `3503:4000` | `skylanders/kaos-trophy.png` | — |
| Land Trophy | Base | Racing Trophy | Earth | — | `3501:4000` | `skylanders/land-trophy.png` | — |
| Sea Trophy | Base | Racing Trophy | Water | — | `3502:4000` | `skylanders/sea-trophy.png` | — |
| Sky Trophy | Base | Racing Trophy | Air | — | `3500:4000` | `skylanders/sky-trophy.png` | — |

### Imaginators (78)

| Name | Variant | Type | Element | Battle class | Toy ID | Image filename | Image present |
|---|---|---|---|---|---|---|---|
| Air Strike | Base | Sensei | Air | Brawler | — | `skylanders/air-strike.png` | — |
| Air Strike | Egg Bomber | Sensei | Air | Brawler | — | `skylanders/air-strike-egg-bomber.png` | — |
| Ambush | Base | Sensei | Life | Knight | — | `skylanders/ambush.png` | — |
| Aurora | Base | Sensei | Light | Swashbuckler | — | `skylanders/aurora.png` | — |
| Aurora | Solar Flare | Sensei | Light | Swashbuckler | — | `skylanders/aurora-solar-flare.png` | — |
| Bad Juju | Base | Sensei | Air | Swashbuckler | — | `skylanders/bad-juju.png` | — |
| Bad Juju | Mystical | Sensei | Air | Swashbuckler | — | `skylanders/bad-juju-mystical.png` | — |
| Barbella | Base | Sensei | Earth | Sentinel | — | `skylanders/barbella.png` | — |
| Blaster-Tron | Base | Sensei | Light | Knight | — | `skylanders/blaster-tron.png` | — |
| Boom Bloom | Base | Sensei | Life | Ninja | — | `skylanders/boom-bloom.png` | — |
| Buckshot | Base | Sensei | Magic | Bowslinger | — | `skylanders/buckshot.png` | — |
| Chain Reaction | Base | Sensei | Tech | Swashbuckler | — | `skylanders/chain-reaction.png` | — |
| Chompy Mage | Base | Sensei | Life | Bazooker | — | `skylanders/chompy-mage.png` | — |
| Chompy Mage | Jingle Bell | Sensei | Life | Bazooker | — | `skylanders/chompy-mage-jingle-bell.png` | — |
| Chopscotch | Base | Sensei | Undead | Smasher | — | `skylanders/chopscotch.png` | — |
| Chopscotch | Candy-Coated | Sensei | Undead | Smasher | — | `skylanders/chopscotch-candy-coated.png` | — |
| Crash Bandicoot | Base | Sensei | Life | Brawler | — | `skylanders/crash-bandicoot.png` | — |
| Dr. Krankcase | Base | Sensei | Tech | Quickshot | — | `skylanders/dr-krankcase.png` | — |
| Dr. Neo Cortex | Base | Sensei | Tech | Sorcerer | — | `skylanders/dr-neo-cortex.png` | — |
| Ember | Base | Sensei | Fire | Sentinel | — | `skylanders/ember.png` | — |
| Flare Wolf | Base | Sensei | Fire | Bazooker | — | `skylanders/flare-wolf.png` | — |
| Flare Wolf | Hard-Boiled | Sensei | Fire | Bazooker | — | `skylanders/flare-wolf-hard-boiled.png` | — |
| Golden Queen | Base | Sensei | Earth | Sorcerer | — | `skylanders/golden-queen.png` | — |
| Golden Queen | Dark | Sensei | Earth | Sorcerer | — | `skylanders/golden-queen-dark.png` | — |
| Grave Clobber | Base | Sensei | Water | Brawler | — | `skylanders/grave-clobber.png` | — |
| Hood Sickle | Base | Sensei | Dark | Sentinel | — | `skylanders/hood-sickle.png` | — |
| Hood Sickle | Steel Plated | Sensei | Dark | Sentinel | — | `skylanders/hood-sickle-steel-plated.png` | — |
| Kaos | Base | Sensei | Kaos | Kaos | — | `skylanders/kaos-imaginators.png` | — |
| King Pen | Base | Sensei | Water | Brawler | — | `skylanders/king-pen.png` | — |
| King Pen | Dark | Sensei | Water | Brawler | — | `skylanders/king-pen-dark.png` | — |
| Mysticat | Base | Sensei | Magic | Sorcerer | — | `skylanders/mysticat.png` | — |
| Pain-Yatta | Base | Sensei | Magic | Smasher | — | `skylanders/pain-yatta.png` | — |
| Pit Boss | Base | Sensei | Undead | Sorcerer | — | `skylanders/pit-boss.png` | — |
| Pit Boss | Legendary | Sensei | Undead | Sorcerer | — | `skylanders/pit-boss-legendary.png` | — |
| Ro-Bow | Base | Sensei | Tech | Bowslinger | — | `skylanders/ro-bow.png` | — |
| Starcast | Base | Sensei | Dark | Ninja | — | `skylanders/starcast.png` | — |
| Tae Kwon Crow | Base | Sensei | Fire | Ninja | — | `skylanders/tae-kwon-crow.png` | — |
| Tae Kwon Crow | Mystical | Sensei | Fire | Ninja | — | `skylanders/tae-kwon-crow-mystical.png` | — |
| Tidepool | Base | Sensei | Water | Quickshot | — | `skylanders/tidepool.png` | — |
| Tri-Tip | Base | Sensei | Earth | Smasher | — | `skylanders/tri-tip.png` | — |
| Tri-Tip | Legendary | Sensei | Earth | Smasher | — | `skylanders/tri-tip-legendary.png` | — |
| Wild Storm | Base | Sensei | Air | Knight | — | `skylanders/wild-storm.png` | — |
| Wolfgang | Base | Sensei | Undead | Bowslinger | — | `skylanders/wolfgang.png` | — |
| Wolfgang | Dark | Sensei | Undead | Bowslinger | — | `skylanders/wolfgang-dark.png` | — |
| Air Creation Crystal | Design 1 of 3 | Creation Crystal | Air | — | — | `skylanders/air-creation-crystal-design-1-of-3.png` | — |
| Air Creation Crystal | Design 2 of 3 | Creation Crystal | Air | — | — | `skylanders/air-creation-crystal-design-2-of-3.png` | — |
| Air Creation Crystal | Design 3 of 3 | Creation Crystal | Air | — | — | `skylanders/air-creation-crystal-design-3-of-3.png` | — |
| Dark Creation Crystal | Design 1 of 3 | Creation Crystal | Dark | — | — | `skylanders/dark-creation-crystal-design-1-of-3.png` | — |
| Dark Creation Crystal | Design 2 of 3 | Creation Crystal | Dark | — | — | `skylanders/dark-creation-crystal-design-2-of-3.png` | — |
| Dark Creation Crystal | Design 3 of 3 | Creation Crystal | Dark | — | — | `skylanders/dark-creation-crystal-design-3-of-3.png` | — |
| Earth Creation Crystal | Design 1 of 3 | Creation Crystal | Earth | — | — | `skylanders/earth-creation-crystal-design-1-of-3.png` | — |
| Earth Creation Crystal | Design 2 of 3 | Creation Crystal | Earth | — | — | `skylanders/earth-creation-crystal-design-2-of-3.png` | — |
| Earth Creation Crystal | Design 3 of 3 | Creation Crystal | Earth | — | — | `skylanders/earth-creation-crystal-design-3-of-3.png` | — |
| Fire Creation Crystal | Design 1 of 3 | Creation Crystal | Fire | — | — | `skylanders/fire-creation-crystal-design-1-of-3.png` | — |
| Fire Creation Crystal | Design 2 of 3 | Creation Crystal | Fire | — | — | `skylanders/fire-creation-crystal-design-2-of-3.png` | — |
| Fire Creation Crystal | Design 3 of 3 | Creation Crystal | Fire | — | — | `skylanders/fire-creation-crystal-design-3-of-3.png` | — |
| Life Creation Crystal | Design 1 of 4 | Creation Crystal | Life | — | — | `skylanders/life-creation-crystal-design-1-of-4.png` | — |
| Life Creation Crystal | Design 2 of 4 | Creation Crystal | Life | — | — | `skylanders/life-creation-crystal-design-2-of-4.png` | — |
| Life Creation Crystal | Design 3 of 4 | Creation Crystal | Life | — | — | `skylanders/life-creation-crystal-design-3-of-4.png` | — |
| Life Creation Crystal | Design 4 of 4 | Creation Crystal | Life | — | — | `skylanders/life-creation-crystal-design-4-of-4.png` | — |
| Life Creation Crystal | Legendary | Creation Crystal | Life | — | — | `skylanders/life-creation-crystal-legendary.png` | — |
| Light Creation Crystal | Design 1 of 3 | Creation Crystal | Light | — | — | `skylanders/light-creation-crystal-design-1-of-3.png` | — |
| Light Creation Crystal | Design 2 of 3 | Creation Crystal | Light | — | — | `skylanders/light-creation-crystal-design-2-of-3.png` | — |
| Light Creation Crystal | Design 3 of 3 | Creation Crystal | Light | — | — | `skylanders/light-creation-crystal-design-3-of-3.png` | — |
| Light Creation Crystal | Legendary | Creation Crystal | Light | — | — | `skylanders/light-creation-crystal-legendary.png` | — |
| Magic Creation Crystal | Design 1 of 3 | Creation Crystal | Magic | — | — | `skylanders/magic-creation-crystal-design-1-of-3.png` | — |
| Magic Creation Crystal | Design 2 of 3 | Creation Crystal | Magic | — | — | `skylanders/magic-creation-crystal-design-2-of-3.png` | — |
| Magic Creation Crystal | Design 3 of 3 | Creation Crystal | Magic | — | — | `skylanders/magic-creation-crystal-design-3-of-3.png` | — |
| Magic Creation Crystal | Legendary | Creation Crystal | Magic | — | — | `skylanders/magic-creation-crystal-legendary.png` | — |
| Tech Creation Crystal | Design 1 of 3 | Creation Crystal | Tech | — | — | `skylanders/tech-creation-crystal-design-1-of-3.png` | — |
| Tech Creation Crystal | Design 2 of 3 | Creation Crystal | Tech | — | — | `skylanders/tech-creation-crystal-design-2-of-3.png` | — |
| Tech Creation Crystal | Design 3 of 3 | Creation Crystal | Tech | — | — | `skylanders/tech-creation-crystal-design-3-of-3.png` | — |
| Undead Creation Crystal | Design 1 of 3 | Creation Crystal | Undead | — | — | `skylanders/undead-creation-crystal-design-1-of-3.png` | — |
| Undead Creation Crystal | Design 2 of 3 | Creation Crystal | Undead | — | — | `skylanders/undead-creation-crystal-design-2-of-3.png` | — |
| Undead Creation Crystal | Design 3 of 3 | Creation Crystal | Undead | — | — | `skylanders/undead-creation-crystal-design-3-of-3.png` | — |
| Water Creation Crystal | Design 1 of 3 | Creation Crystal | Water | — | — | `skylanders/water-creation-crystal-design-1-of-3.png` | — |
| Water Creation Crystal | Design 2 of 3 | Creation Crystal | Water | — | — | `skylanders/water-creation-crystal-design-2-of-3.png` | — |
| Water Creation Crystal | Design 3 of 3 | Creation Crystal | Water | — | — | `skylanders/water-creation-crystal-design-3-of-3.png` | — |

## Disney Infinity (322)

### Disney Infinity 1.0 (105)

| Name | Type | Franchise | Toy ID | Image filename | Image present |
|---|---|---|---|---|---|
| Agent P | Figure | Phineas and Ferb | `1000027` | `disney-infinity/agent-p.png` | — |
| Agent P (Crystal) | Figure | Phineas and Ferb | `1000036` | `disney-infinity/agent-p-crystal.png` | — |
| Anna | Figure | Frozen | `1000024` | `disney-infinity/anna.png` | — |
| Buzz Lightyear | Figure | Toy Story | `1000008` | `disney-infinity/buzz-lightyear.png` | — |
| Buzz Lightyear (Crystal) | Figure | Toy Story | `1000035` | `disney-infinity/buzz-lightyear-crystal.png` | — |
| Buzz Lightyear (Glowing) | Figure | Toy Story | `1000038` | `disney-infinity/buzz-lightyear-glowing.png` | — |
| Dash | Figure | The Incredibles | `1000018` | `disney-infinity/dash.png` | — |
| Davy Jones | Figure | Pirates of the Caribbean | `1000013` | `disney-infinity/davy-jones.png` | — |
| Elsa | Figure | Frozen | `1000025` | `disney-infinity/elsa.png` | — |
| Francesco Bernoulli | Figure | Cars | `1000020` | `disney-infinity/francesco-bernoulli.png` | — |
| Hector Barbossa | Figure | Pirates of the Caribbean | `1000012` | `disney-infinity/hector-barbossa.png` | — |
| Holley Shiftwell | Figure | Cars | `1000007` | `disney-infinity/holley-shiftwell.png` | — |
| Jack Skellington | Figure | The Nightmare Before Christmas | `1000022` | `disney-infinity/jack-skellington.png` | — |
| Jack Sparrow | Figure | Pirates of the Caribbean | `1000003` | `disney-infinity/jack-sparrow.png` | — |
| Jack Sparrow (Crystal) | Figure | Pirates of the Caribbean | `1000031` | `disney-infinity/jack-sparrow-crystal.png` | — |
| Jessie | Figure | Toy Story | `1000009` | `disney-infinity/jessie.png` | — |
| Lightning McQueen | Figure | Cars | `1000006` | `disney-infinity/lightning-mcqueen.png` | — |
| Lightning McQueen (Crystal) | Figure | Cars | `1000033` | `disney-infinity/lightning-mcqueen-crystal.png` | — |
| Lone Ranger | Figure | The Lone Ranger | `1000004` | `disney-infinity/lone-ranger.png` | — |
| Lone Ranger (Crystal) | Figure | The Lone Ranger | `1000034` | `disney-infinity/lone-ranger-crystal.png` | — |
| Mater | Figure | Cars | `1000017` | `disney-infinity/mater.png` | — |
| Mike | Figure | Monsters University | `1000010` | `disney-infinity/mike.png` | — |
| Mr. Incredible | Figure | The Incredibles | `1000001` | `disney-infinity/mr-incredible.png` | — |
| Mr. Incredible (Crystal) | Figure | The Incredibles | `1000030` | `disney-infinity/mr-incredible-crystal.png` | — |
| Mrs. Incredible | Figure | The Incredibles | `1000011` | `disney-infinity/mrs-incredible.png` | — |
| Phineas | Figure | Phineas and Ferb | `1000026` | `disney-infinity/phineas.png` | — |
| Randy | Figure | Monsters University | `1000014` | `disney-infinity/randy.png` | — |
| Rapunzel | Figure | Tangled | `1000023` | `disney-infinity/rapunzel.png` | — |
| Sorcerer's Apprentice Mickey | Figure | Fantasia | `1000021` | `disney-infinity/sorcerers-apprentice-mickey.png` | — |
| Sorcerer's Apprentice Mickey (Crystal) | Figure | Fantasia | `1000037` | `disney-infinity/sorcerers-apprentice-mickey-crystal.png` | — |
| Sulley | Figure | Monsters University | `1000002` | `disney-infinity/sulley.png` | — |
| Sulley (Crystal) | Figure | Monsters University | `1000032` | `disney-infinity/sulley-crystal.png` | — |
| Syndrome | Figure | The Incredibles | `1000015` | `disney-infinity/syndrome.png` | — |
| Tonto | Figure | The Lone Ranger | `1000005` | `disney-infinity/tonto.png` | — |
| Vanellope | Figure | Wreck-It Ralph | `1000029` | `disney-infinity/vanellope.png` | — |
| Violet | Figure | The Incredibles | `1000019` | `disney-infinity/violet.png` | — |
| Woody | Figure | Toy Story | `1000016` | `disney-infinity/woody.png` | — |
| Wreck-It Ralph | Figure | Wreck-It Ralph | `1000028` | `disney-infinity/wreck-it-ralph.png` | — |
| Cars Play Set | Play Set / Toy Box Game | — | `2000003` | `disney-infinity/cars-play-set.png` | — |
| Lone Ranger Play Set | Play Set / Toy Box Game | — | `2000002` | `disney-infinity/lone-ranger-play-set.png` | — |
| Starter Play Set | Play Set / Toy Box Game | The Incredibles - Pirates of the Caribbean | `2000001` | `disney-infinity/starter-play-set.png` | — |
| Toy Story in Space Play Set | Play Set / Toy Box Game | — | `2000004` | `disney-infinity/toy-story-in-space-play-set.png` | — |
| Bolt's Super Strength | Power Disc (round) | Bolt - Bolt's Super Strength | `3000003` | `disney-infinity/bolts-super-strength.png` | — |
| C.H.R.O.M.E. Armor Shield | Power Disc (round) | Cars - C.H.R.O.M.E. Armor Shield | `3000011` | `disney-infinity/c-h-r-o-m-e-armor-shield.png` | — |
| C.H.R.O.M.E. Damage Increaser | Power Disc (round) | Cars - C.H.R.O.M.E. Damage Increaser | `3000006` | `disney-infinity/c-h-r-o-m-e-damage-increaser.png` | — |
| Chernabog's Power | Power Disc (round) | Fantasia - Chernabog's Power | `3000005` | `disney-infinity/chernabogs-power.png` | — |
| Dr. Doofenshmirtz's Damage-Inator! | Power Disc (round) | Phineas and Ferb - Dr. Doofenshmirtz's Damage-Inator! | `3000007` | `disney-infinity/dr-doofenshmirtzs-damage-inator.png` | — |
| Electro-Charge | Power Disc (round) | Frankenweenie - Electro-Charge | `3000008` | `disney-infinity/electro-charge.png` | — |
| Emperor Zurg's Wrath | Power Disc (round) | Toy Story - Emperor Zurg's Wrath | `3000062` | `disney-infinity/emperor-zurgs-wrath.png` | — |
| Fix-It Felix's Repair Power | Power Disc (round) | Wreck-It Ralph - Fix-It Felix's Repair Power | `3000009` | `disney-infinity/fix-it-felixs-repair-power.png` | — |
| Merlin's Summon | Power Disc (round) | The Sword in the Stone - Merlin's Summon | `3000063` | `disney-infinity/merlins-summon.png` | — |
| Pieces of Eight | Power Disc (round) | Pirates of the Caribbean - Pieces of Eight | `3000014` | `disney-infinity/pieces-of-eight.png` | — |
| Ralph's Power of Destruction | Power Disc (round) | Wreck-it Ralph - Ralph's Power of Destruction | `3000004` | `disney-infinity/ralphs-power-of-destruction.png` | — |
| Rapunzel's Healing | Power Disc (round) | Tangled - Rapunzel's Healing | `3000010` | `disney-infinity/rapunzels-healing.png` | — |
| Scrooge McDuck's Lucky Dime | Power Disc (round) | DuckTales - Scrooge McDuck's Lucky Dime | `3000015` | `disney-infinity/scrooge-mcducks-lucky-dime.png` | — |
| Sorcerer Mickey's Hat | Power Disc (round) | Fantasia - Mickey's Sorcerer Hat | `3000017` | `disney-infinity/sorcerer-mickeys-hat.png` | — |
| Star Command Shield | Power Disc (round) | Toy Story - Star Command Shield | `3000012` | `disney-infinity/star-command-shield.png` | — |
| User Control | Power Disc (round) | TRON - User Control Disc | `3000016` | `disney-infinity/user-control.png` | — |
| Violet's Force Field | Power Disc (round) | The Incredibles - Violet's Force Field | `3000013` | `disney-infinity/violets-force-field.png` | — |
| Abu the Elephant | Power Disc (hexagonal) | Aladdin - Abu the Elephant | `4000031` | `disney-infinity/abu-the-elephant.png` | — |
| Alice's Wonderland | Power Disc (hexagonal) | Alice in Wonderland - Alice's Wonderland | `4000067` | `disney-infinity/alices-wonderland.png` | — |
| Angus | Power Disc (hexagonal) | Brave - Angus | `4000030` | `disney-infinity/angus.png` | — |
| Astro Blasters Space Cruiser | Power Disc (hexagonal) | Toy Story, Disney Parks - Astro Blasters Space Cruiser | `4000064` | `disney-infinity/astro-blasters-space-cruiser.png` | — |
| Buy N Large Atmosphere | Power Disc (hexagonal) | WALL-E - Buy N Large Atmosphere | `4000054` | `disney-infinity/buy-n-large-atmosphere.png` | — |
| Calico Helicopter | Power Disc (hexagonal) | Bolt - Calico Helicopter | `4000028` | `disney-infinity/calico-helicopter.png` | — |
| Captain Hook's Ship | Power Disc (hexagonal) | Peter Pan, Disney Parks - Jolly Roger | `4000026` | `disney-infinity/captain-hooks-ship.png` | — |
| Carl Fredricksen's Cane | Power Disc (hexagonal) | Up - Carl Fredricksen's Cane | `4000040` | `disney-infinity/carl-fredricksens-cane.png` | — |
| Chill in the Air | Power Disc (hexagonal) | Frozen - Chill in the Air | `4000060` | `disney-infinity/chill-in-the-air.png` | — |
| Cinderella's Coach | Power Disc (hexagonal) | Cinderella - Cinderella's Coach | `4000019` | `disney-infinity/cinderellas-coach.png` | — |
| Condorman Glider | Power Disc (hexagonal) | Condorman - Condorman Glider | `4000042` | `disney-infinity/condorman-glider.png` | — |
| Cruella De Vil's Car | Power Disc (hexagonal) | 101 Dalmatians - Cruella De Vil's Car | `4000021` | `disney-infinity/cruella-de-vils-car.png` | — |
| Danville Sky | Power Disc (hexagonal) | Phineas and Ferb - Danville Sky | `4000070` | `disney-infinity/danville-sky.png` | — |
| Dragon Firework Cannon | Power Disc (hexagonal) | Mulan - Dragon Firework Cannon | `4000036` | `disney-infinity/dragon-firework-cannon.png` | — |
| Dumbo | Power Disc (hexagonal) | Dumbo, Disney Parks - Dumbo the Flying Elephant | `4000027` | `disney-infinity/dumbo.png` | — |
| Electric Mayhem Bus | Power Disc (hexagonal) | The Muppets - Electric Mayhem Bus | `4000020` | `disney-infinity/electric-mayhem-bus.png` | — |
| Flamingo Croquet Mallet | Power Disc (hexagonal) | Alice in Wonderland - Flamingo Croquet Mallet | `4000039` | `disney-infinity/flamingo-croquet-mallet.png` | — |
| Frozen Flourish | Power Disc (hexagonal) | Frozen - Frozen Flourish | `4000051` | `disney-infinity/frozen-flourish.png` | — |
| Halloween Town Sky | Power Disc (hexagonal) | The Nightmare Before Christmas - Halloween Town Sky | `4000058` | `disney-infinity/halloween-town-sky.png` | — |
| Hangin' Ten Stitch With Surfboard | Power Disc (hexagonal) | Lilo & Stitch - Hangin' Ten Stitch With Surfboard | `4000041` | `disney-infinity/hangin-ten-stitch-with-surfboard.png` | — |
| Headless Horseman's Horse | Power Disc (hexagonal) | The Adventures of Ichabod and Mr. Toad - Headless Horseman's Horse | `4000032` | `disney-infinity/headless-horsemans-horse.png` | — |
| Jack's Scary Decorations | Power Disc (hexagonal) | The Nightmare Before Christmas - Jack's Scary Decorations | `4000049` | `disney-infinity/jacks-scary-decorations.png` | — |
| Khan | Power Disc (hexagonal) | Mulan - Khan | `4000034` | `disney-infinity/khan.png` | — |
| King Candy's Dessert Toppings | Power Disc (hexagonal) | Wreck-It Ralph - King Candy's Dessert Toppings | `4000046` | `disney-infinity/king-candys-dessert-toppings.png` | — |
| Marlin's Reef | Power Disc (hexagonal) | Finding Nemo - Marlin's Reef | `4000065` | `disney-infinity/marlins-reef.png` | — |
| Maximus | Power Disc (hexagonal) | Tangled - Maximus | `4000029` | `disney-infinity/maximus.png` | — |
| Mickey's Car | Power Disc (hexagonal) | Mickey Mouse Universe - Mickey's Car | `4000018` | `disney-infinity/mickeys-car.png` | — |
| Mike's New Car | Power Disc (hexagonal) | Monsters, Inc. - Mike's New Car | `4000023` | `disney-infinity/mikes-new-car.png` | — |
| Nemo's Seascape | Power Disc (hexagonal) | Finding Nemo - Nemo's Seascape | `4000066` | `disney-infinity/nemos-seascape.png` | — |
| New Holland Skyline | Power Disc (hexagonal) | — | `4000057` | `disney-infinity/new-holland-skyline.png` | — |
| On the Grid | Power Disc (hexagonal) | TRON - On the Grid | `4000044` | `disney-infinity/on-the-grid.png` | — |
| Parking Lot Tram | Power Disc (hexagonal) | Disney Parks - Disney Parks Parking Lot Tram | `4000025` | `disney-infinity/parking-lot-tram.png` | — |
| Phillipe | Power Disc (hexagonal) | Beauty and the Beast - Phillipe | `4000033` | `disney-infinity/phillipe.png` | — |
| Pizza Planet Delivery Truck | Power Disc (hexagonal) | Toy Story - Pizza Planet Delivery Truck | `4000022` | `disney-infinity/pizza-planet-delivery-truck.png` | — |
| Rapunzel's Birthday Sky | Power Disc (hexagonal) | Tangled - Rapunzel's Birthday Sky | `4000061` | `disney-infinity/rapunzels-birthday-sky.png` | — |
| Rapunzel's Kingdom | Power Disc (hexagonal) | Tangled - Rapunzel's Kingdom | `4000052` | `disney-infinity/rapunzels-kingdom.png` | — |
| Stitch's Blaster | Power Disc (hexagonal) | Lilo & Stitch - Stitch's Blaster | `4000037` | `disney-infinity/stitchs-blaster.png` | — |
| Sugar Rush Sky | Power Disc (hexagonal) | Wreck-It Ralph - Sugar Rush Sky | `4000055` | `disney-infinity/sugar-rush-sky.png` | — |
| Tantor | Power Disc (hexagonal) | Tarzan - Tantor | `4000035` | `disney-infinity/tantor.png` | — |
| Toy Story Mania Blaster | Power Disc (hexagonal) | Toy Story, Disney Parks - Toy Story Mania Blaster | `4000038` | `disney-infinity/toy-story-mania-blaster.png` | — |
| Tri-State Area Terrain | Power Disc (hexagonal) | Phineas and Ferb - Tri-State Area Terrain | `4000069` | `disney-infinity/tri-state-area-terrain.png` | — |
| TRON Interface | Power Disc (hexagonal) | TRON - TRON Interface | `4000053` | `disney-infinity/tron-interface.png` | — |
| Tulgey Wood | Power Disc (hexagonal) | Alice in Wonderland - Tulgey Wood | `4000068` | `disney-infinity/tulgey-wood.png` | — |
| Victor's Experiments | Power Disc (hexagonal) | Frankenweenie - Victor's Experiments | `4000048` | `disney-infinity/victors-experiments.png` | — |
| WALL-E's Collection | Power Disc (hexagonal) | WALL-E - WALL-E's Collection | `4000045` | `disney-infinity/wall-es-collection.png` | — |
| WALL-E's Fire Extinguisher | Power Disc (hexagonal) | WALL-E - WALL-E's Fire Extinguisher | `4000043` | `disney-infinity/wall-es-fire-extinguisher.png` | — |

### Disney Infinity 2.0 (127)

| Name | Type | Franchise | Toy ID | Image filename | Image present |
|---|---|---|---|---|---|
| Aladdin | Figure | — | `1000117` | `disney-infinity/aladdin.png` | — |
| Baymax | Figure | — | `1000123` | `disney-infinity/baymax.png` | — |
| Black Suit Spider-Man | Figure | — | `1000134` | `disney-infinity/black-suit-spider-man.png` | — |
| Black Widow | Figure | — | `1000109` | `disney-infinity/black-widow.png` | — |
| Captain America | Figure | — | `1000100` | `disney-infinity/captain-america.png` | — |
| Donald Duck | Figure | — | `1000116` | `disney-infinity/donald-duck.png` | — |
| Drax | Figure | — | `1000111` | `disney-infinity/drax.png` | — |
| Falcon | Figure | — | `1000127` | `disney-infinity/falcon.png` | — |
| Gamora | Figure | — | `1000112` | `disney-infinity/gamora.png` | — |
| Green Goblin | Figure | — | `1000126` | `disney-infinity/green-goblin.png` | — |
| Groot | Figure | — | `1000104` | `disney-infinity/groot.png` | — |
| Hawkeye | Figure | — | `1000110` | `disney-infinity/hawkeye.png` | — |
| Hiro | Figure | — | `1000122` | `disney-infinity/hiro.png` | — |
| Hulk | Figure | — | `1000101` | `disney-infinity/hulk.png` | — |
| Iron Fist | Figure | — | `1000113` | `disney-infinity/iron-fist.png` | — |
| Iron Man | Figure | — | `1000102` | `disney-infinity/iron-man.png` | — |
| Jasmine | Figure | — | `1000129` | `disney-infinity/jasmine.png` | — |
| Loki | Figure | — | `1000124` | `disney-infinity/loki.png` | — |
| Maleficent | Figure | — | `1000121` | `disney-infinity/maleficent.png` | — |
| Merida | Figure | — | `1000119` | `disney-infinity/merida.png` | — |
| Nick Fury | Figure | — | `1000108` | `disney-infinity/nick-fury.png` | — |
| Nova | Figure | — | `1000114` | `disney-infinity/nova.png` | — |
| Rocket Raccoon | Figure | — | `1000105` | `disney-infinity/rocket-raccoon.png` | — |
| Ronan | Figure | — | `1000125` | `disney-infinity/ronan.png` | — |
| Spider-Man | Figure | — | `1000107` | `disney-infinity/spider-man.png` | — |
| Star-Lord | Figure | — | `1000106` | `disney-infinity/star-lord.png` | — |
| Stitch | Figure | — | `1000118` | `disney-infinity/stitch.png` | — |
| Thor | Figure | — | `1000103` | `disney-infinity/thor.png` | — |
| Tinker Bell | Figure | — | `1000120` | `disney-infinity/tinker-bell.png` | — |
| Venom | Figure | — | `1000115` | `disney-infinity/venom.png` | — |
| Yondu | Figure | — | `1000128` | `disney-infinity/yondu.png` | — |
| Assault on Asgard | Play Set / Toy Box Game | — | `2000103` | `disney-infinity/assault-on-asgard.png` | — |
| Brave Forest Siege | Play Set / Toy Box Game | — | `2000106` | `disney-infinity/brave-forest-siege.png` | — |
| Escape from the Kyln | Play Set / Toy Box Game | — | `2000104` | `disney-infinity/escape-from-the-kyln.png` | — |
| Marvel's Guardians of the Galaxy Play Set | Play Set / Toy Box Game | — | `2000102` | `disney-infinity/marvels-guardians-of-the-galaxy-play-set.png` | — |
| Marvel's Spider-Man Play Set | Play Set / Toy Box Game | — | `2000101` | `disney-infinity/marvels-spider-man-play-set.png` | — |
| Marvel's The Avengers Play Set | Play Set / Toy Box Game | — | `2000100` | `disney-infinity/marvels-the-avengers-play-set.png` | — |
| Stitch's Tropical Rescue | Play Set / Toy Box Game | — | `2000105` | `disney-infinity/stitchs-tropical-rescue.png` | — |
| Alien Symbiote | Power Disc (round) | — | `3000184` | `disney-infinity/alien-symbiote.png` | — |
| All for One | Power Disc (round) | — | `3000185` | `disney-infinity/all-for-one.png` | — |
| Chernabog's Spirit Cyclone | Power Disc (round) | — | `3000175` | `disney-infinity/chernabogs-spirit-cyclone.png` | — |
| Cursed Pirate Gold | Power Disc (round) | — | `3000188` | `disney-infinity/cursed-pirate-gold.png` | — |
| Enchanted Rose | Power Disc (round) | — | `3000165` | `disney-infinity/enchanted-rose.png` | — |
| Flubber | Power Disc (round) | — | `3000167` | `disney-infinity/flubber.png` | — |
| Gamma Rays | Power Disc (round) | — | `3000183` | `disney-infinity/gamma-rays.png` | — |
| Glory Days | Power Disc (round) | — | `3000187` | `disney-infinity/glory-days.png` | — |
| Infinity Gauntlet | Power Disc (round) | — | `3000171` | `disney-infinity/infinity-gauntlet.png` | — |
| King Louie's Monkeys | Power Disc (round) | — | `3000170` | `disney-infinity/king-louies-monkeys.png` | — |
| Maleficent's Spell Cast | Power Disc (round) | — | `3000174` | `disney-infinity/maleficents-spell-cast.png` | — |
| Marvel Team-Up: Ant-Man | Power Disc (round) | — | `3000178` | `disney-infinity/marvel-team-up-ant-man.png` | — |
| Marvel Team-Up: Capt. Marvel | Power Disc (round) | — | `3000176` | `disney-infinity/marvel-team-up-capt-marvel.png` | — |
| Marvel Team-Up: Iron Patriot | Power Disc (round) | — | `3000177` | `disney-infinity/marvel-team-up-iron-patriot.png` | — |
| Marvel Team-Up: White Tiger | Power Disc (round) | — | `3000179` | `disney-infinity/marvel-team-up-white-tiger.png` | — |
| Marvel Team-Up: Winter Soldier | Power Disc (round) | — | `3000181` | `disney-infinity/marvel-team-up-winter-soldier.png` | — |
| Marvel Team-Up: Yondu | Power Disc (round) | — | `3000180` | `disney-infinity/marvel-team-up-yondu.png` | — |
| Mulan's Training Uniform | Power Disc (round) | — | `3000166` | `disney-infinity/mulans-training-uniform.png` | — |
| Rags to Riches | Power Disc (round) | — | `3000192` | `disney-infinity/rags-to-riches.png` | — |
| S.H.I.E.L.D. Helicarrier Strike | Power Disc (round) | — | `3000168` | `disney-infinity/s-h-i-e-l-d-helicarrier-strike.png` | — |
| Sandy Claws Surprise | Power Disc (round) | — | `3000186` | `disney-infinity/sandy-claws-surprise.png` | — |
| Sentinel of Liberty | Power Disc (round) | — | `3000189` | `disney-infinity/sentinel-of-liberty.png` | — |
| Sorcerer Supreme | Power Disc (round) | — | `3000173` | `disney-infinity/sorcerer-supreme.png` | — |
| Space Armor | Power Disc (round) | — | `3000191` | `disney-infinity/space-armor.png` | — |
| Stark Arc Reactor | Power Disc (round) | — | `3000182` | `disney-infinity/stark-arc-reactor.png` | — |
| The Immortal Iron Fist | Power Disc (round) | — | `3000190` | `disney-infinity/the-immortal-iron-fist.png` | — |
| Ultimate Falcon | Power Disc (round) | — | `3000193` | `disney-infinity/ultimate-falcon.png` | — |
| Zeus' Thunderbolts | Power Disc (round) | — | `3000169` | `disney-infinity/zeus-thunderbolts.png` | — |
| A Small World | Power Disc (hexagonal) | — | `4000116` | `disney-infinity/a-small-world.png` | — |
| Aerial Area Rug | Power Disc (hexagonal) | — | `4000146` | `disney-infinity/aerial-area-rug.png` | — |
| Aladdin's Magic Carpet | Power Disc (hexagonal) | — | `4000165` | `disney-infinity/aladdins-magic-carpet.png` | — |
| Alice in Wonderland's Caterpillar | Power Disc (hexagonal) | — | `4000137` | `disney-infinity/alice-in-wonderlands-caterpillar.png` | — |
| Black Panther's Vibranium Knives | Power Disc (hexagonal) | — | `4000163` | `disney-infinity/black-panthers-vibranium-knives.png` | — |
| Calhoun's Command | Power Disc (hexagonal) | — | `4000108` | `disney-infinity/calhouns-command.png` | — |
| Cloak of Levitation | Power Disc (hexagonal) | — | `4000164` | `disney-infinity/cloak-of-levitation.png` | — |
| CyBug Swarm | Power Disc (hexagonal) | — | `4000124` | `disney-infinity/cybug-swarm.png` | — |
| Darkwing Duck's Grappling Gun | Power Disc (hexagonal) | — | `4000154` | `disney-infinity/darkwing-ducks-grappling-gun.png` | — |
| Darkwing Duck's Ratcatcher | Power Disc (hexagonal) | — | `4000141` | `disney-infinity/darkwing-ducks-ratcatcher.png` | — |
| Dinosaur World | Power Disc (hexagonal) | — | `4000110` | `disney-infinity/dinosaur-world.png` | — |
| Eglantine's Motorcycle | Power Disc (hexagonal) | — | `4000138` | `disney-infinity/eglantines-motorcycle.png` | — |
| Falcon's Wings | Power Disc (hexagonal) | — | `4000160` | `disney-infinity/falcons-wings.png` | — |
| Fantasyland Carousel Horse | Power Disc (hexagonal) | — | `4000150` | `disney-infinity/fantasyland-carousel-horse.png` | — |
| Forgotten Skies | Power Disc (hexagonal) | — | `4000126` | `disney-infinity/forgotten-skies.png` | — |
| Ghost Rider's Chain Whip | Power Disc (hexagonal) | — | `4000156` | `disney-infinity/ghost-riders-chain-whip.png` | — |
| Gravity Falls Forest | Power Disc (hexagonal) | — | `4000104` | `disney-infinity/gravity-falls-forest.png` | — |
| Gravity Falls Sky | Power Disc (hexagonal) | — | `4000120` | `disney-infinity/gravity-falls-sky.png` | — |
| Groot's Roots | Power Disc (hexagonal) | — | `4000111` | `disney-infinity/groots-roots.png` | — |
| Groot's View | Power Disc (hexagonal) | — | `4000127` | `disney-infinity/groots-view.png` | — |
| Gus the Mule | Power Disc (hexagonal) | — | `4000152` | `disney-infinity/gus-the-mule.png` | — |
| Honey Lemon's Ice Capsules | Power Disc (hexagonal) | — | `4000166` | `disney-infinity/honey-lemons-ice-capsules.png` | — |
| Hydra Motorcycle | Power Disc (hexagonal) | — | `4000140` | `disney-infinity/hydra-motorcycle.png` | — |
| Jack Skellington's Reindeer | Power Disc (hexagonal) | — | `4000149` | `disney-infinity/jack-skellingtons-reindeer.png` | — |
| Jack-O-Lantern's Glider | Power Disc (hexagonal) | — | `4000147` | `disney-infinity/jack-o-lanterns-glider.png` | — |
| Jasmine's Palace View | Power Disc (hexagonal) | — | `4000167` | `disney-infinity/jasmines-palace-view.png` | — |
| Jim Hawkins' Solar Board | Power Disc (hexagonal) | — | `4000162` | `disney-infinity/jim-hawkins-solar-board.png` | — |
| Le Maximum | Power Disc (hexagonal) | — | `4000136` | `disney-infinity/le-maximum.png` | — |
| Lew Zealand's Boomerang Fish | Power Disc (hexagonal) | — | `4000157` | `disney-infinity/lew-zealands-boomerang-fish.png` | — |
| Light Cycle | Power Disc (hexagonal) | — | `4000197` | `disney-infinity/light-cycle.png` | — |
| Light Jet | Power Disc (hexagonal) | — | `4000198` | `disney-infinity/light-jet.png` | — |
| Lola | Power Disc (hexagonal) | — | `4000193` | `disney-infinity/lola.png` | — |
| Mabel's Kittens for Fists | Power Disc (hexagonal) | — | `4000161` | `disney-infinity/mabels-kittens-for-fists.png` | — |
| Main Street Electrical Parade Float | Power Disc (hexagonal) | — | `4000134` | `disney-infinity/main-street-electrical-parade-float.png` | — |
| Medusa's Swamp Mobile | Power Disc (hexagonal) | — | `4000139` | `disney-infinity/medusas-swamp-mobile.png` | — |
| Mr. Toad's Motorcar | Power Disc (hexagonal) | — | `4000135` | `disney-infinity/mr-toads-motorcar.png` | — |
| Mulan's Countryside | Power Disc (hexagonal) | — | `4000112` | `disney-infinity/mulans-countryside.png` | — |
| Neverland | Power Disc (hexagonal) | — | `4000105` | `disney-infinity/neverland.png` | — |
| Odin's Horse | Power Disc (hexagonal) | — | `4000151` | `disney-infinity/odins-horse.png` | — |
| S.H.I.E.L.D. Containment Truck | Power Disc (hexagonal) | — | `4000133` | `disney-infinity/s-h-i-e-l-d-containment-truck.png` | — |
| Second Star to the Right | Power Disc (hexagonal) | — | `4000121` | `disney-infinity/second-star-to-the-right.png` | — |
| Sergeant Calhoun's Blaster | Power Disc (hexagonal) | — | `4000158` | `disney-infinity/sergeant-calhouns-blaster.png` | — |
| Simba's Pridelands | Power Disc (hexagonal) | — | `4000106` | `disney-infinity/simbas-pridelands.png` | — |
| Skies of the World | Power Disc (hexagonal) | — | `4000132` | `disney-infinity/skies-of-the-world.png` | — |
| Spider-Buggy | Power Disc (hexagonal) | — | `4000148` | `disney-infinity/spider-buggy.png` | — |
| Spider-Copter | Power Disc (hexagonal) | — | `4000145` | `disney-infinity/spider-copter.png` | — |
| Spider-Cycle | Power Disc (hexagonal) | — | `4000194` | `disney-infinity/spider-cycle.png` | — |
| Spider-Glider | Power Disc (hexagonal) | — | `4000196` | `disney-infinity/spider-glider.png` | — |
| Spider-Sky | Power Disc (hexagonal) | — | `4000118` | `disney-infinity/spider-sky.png` | — |
| Spider-Streets | Power Disc (hexagonal) | — | `4000102` | `disney-infinity/spider-streets.png` | — |
| Star-Lord's Galaxy | Power Disc (hexagonal) | — | `4000109` | `disney-infinity/star-lords-galaxy.png` | — |
| Stark Tech | Power Disc (hexagonal) | — | `4000101` | `disney-infinity/stark-tech.png` | — |
| The Avenjet | Power Disc (hexagonal) | — | `4000195` | `disney-infinity/the-avenjet.png` | — |
| The King's Domain | Power Disc (hexagonal) | — | `4000122` | `disney-infinity/the-kings-domain.png` | — |
| The Middle Kingdom | Power Disc (hexagonal) | — | `4000128` | `disney-infinity/the-middle-kingdom.png` | — |
| The Rip | Power Disc (hexagonal) | — | `4000125` | `disney-infinity/the-rip.png` | — |
| The Sands of Agrabah | Power Disc (hexagonal) | — | `4000113` | `disney-infinity/the-sands-of-agrabah.png` | — |
| The USS Swinetrek | Power Disc (hexagonal) | — | `4000143` | `disney-infinity/the-uss-swinetrek.png` | — |
| View from the Suit | Power Disc (hexagonal) | — | `4000117` | `disney-infinity/view-from-the-suit.png` | — |
| World War Hulk | Power Disc (hexagonal) | — | `4000103` | `disney-infinity/world-war-hulk.png` | — |
| World War Hulk Sky | Power Disc (hexagonal) | — | `4000119` | `disney-infinity/world-war-hulk-sky.png` | — |

### Disney Infinity 3.0 (90)

| Name | Type | Franchise | Toy ID | Image filename | Image present |
|---|---|---|---|---|---|
| Ahsoka Tano | Figure | — | `1000203` | `disney-infinity/ahsoka-tano.png` | — |
| Alice | Figure | — | `1000303` | `disney-infinity/alice.png` | — |
| Anakin Skywalker | Figure | — | `1000200` | `disney-infinity/anakin-skywalker.png` | — |
| Anakin Skywalker (Light FX) | Figure | — | `1000239` | `disney-infinity/anakin-skywalker-light-fx.png` | — |
| Anger | Figure | — | `1000217` | `disney-infinity/anger.png` | — |
| Ant-Man | Figure | — | `1000227` | `disney-infinity/ant-man.png` | — |
| Baloo | Figure | — | `1000302` | `disney-infinity/baloo.png` | — |
| Black Panther | Figure | — | `1000246` | `disney-infinity/black-panther.png` | — |
| Boba Fett | Figure | — | `1000211` | `disney-infinity/boba-fett.png` | — |
| Captain America - The First Avenger | Figure | — | `1000229` | `disney-infinity/captain-america-the-first-avenger.png` | — |
| Chewbacca | Figure | — | `1000209` | `disney-infinity/chewbacca.png` | — |
| Darth Maul | Figure | — | `1000204` | `disney-infinity/darth-maul.png` | — |
| Darth Vader | Figure | — | `1000210` | `disney-infinity/darth-vader.png` | — |
| Darth Vader (Light FX) | Figure | — | `1000243` | `disney-infinity/darth-vader-light-fx.png` | — |
| Disgust | Figure | — | `1000220` | `disney-infinity/disgust.png` | — |
| Dory | Figure | — | `1000301` | `disney-infinity/dory.png` | — |
| Ezra Bridger | Figure | — | `1000212` | `disney-infinity/ezra-bridger.png` | — |
| Fear | Figure | — | `1000218` | `disney-infinity/fear.png` | — |
| Finn | Figure | — | `1000230` | `disney-infinity/finn.png` | — |
| Han Solo | Figure | — | `1000207` | `disney-infinity/han-solo.png` | — |
| Hulkbuster | Figure | — | `1000238` | `disney-infinity/hulkbuster.png` | — |
| Joy | Figure | — | `1000216` | `disney-infinity/joy.png` | — |
| Judy Hopps | Figure | — | `1000237` | `disney-infinity/judy-hopps.png` | — |
| Kanan Jarrus | Figure | — | `1000213` | `disney-infinity/kanan-jarrus.png` | — |
| Kanan Jarrus (Light FX) | Figure | — | `1000244` | `disney-infinity/kanan-jarrus-light-fx.png` | — |
| Kylo Ren | Figure | — | `1000231` | `disney-infinity/kylo-ren.png` | — |
| Kylo Ren (Light FX) | Figure | — | `1000245` | `disney-infinity/kylo-ren-light-fx.png` | — |
| Luke Skywalker | Figure | — | `1000206` | `disney-infinity/luke-skywalker.png` | — |
| Luke Skywalker (Light FX) | Figure | — | `1000242` | `disney-infinity/luke-skywalker-light-fx.png` | — |
| Mad Hatter | Figure | — | `1000304` | `disney-infinity/mad-hatter.png` | — |
| Mickey Mouse | Figure | — | `1000221` | `disney-infinity/mickey-mouse.png` | — |
| Minnie Mouse | Figure | — | `1000222` | `disney-infinity/minnie-mouse.png` | — |
| Mulan | Figure | — | `1000223` | `disney-infinity/mulan.png` | — |
| Nemo | Figure | — | `1000300` | `disney-infinity/nemo.png` | — |
| Nick Wilde | Figure | — | `1000236` | `disney-infinity/nick-wilde.png` | — |
| Obi-Wan Kenobi | Figure | — | `1000201` | `disney-infinity/obi-wan-kenobi.png` | — |
| Obi-Wan Kenobi (Light FX) | Figure | — | `1000240` | `disney-infinity/obi-wan-kenobi-light-fx.png` | — |
| Olaf | Figure | — | `1000224` | `disney-infinity/olaf.png` | — |
| Peter Pan | Figure | — | `1000306` | `disney-infinity/peter-pan.png` | — |
| Poe Dameron | Figure | — | `1000232` | `disney-infinity/poe-dameron.png` | — |
| Princess Leia | Figure | — | `1000208` | `disney-infinity/princess-leia.png` | — |
| Quorra | Figure | — | `1000151` | `disney-infinity/quorra.png` | — |
| Rey | Figure | — | `1000233` | `disney-infinity/rey.png` | — |
| Sabine Wren | Figure | — | `1000214` | `disney-infinity/sabine-wren.png` | — |
| Sadness | Figure | — | `1000219` | `disney-infinity/sadness.png` | — |
| Sam Flynn | Figure | — | `1000150` | `disney-infinity/sam-flynn.png` | — |
| Spot | Figure | — | `1000235` | `disney-infinity/spot.png` | — |
| Time | Figure | — | `1000305` | `disney-infinity/time.png` | — |
| Ultron | Figure | — | `1000226` | `disney-infinity/ultron.png` | — |
| Vision | Figure | — | `1000225` | `disney-infinity/vision.png` | — |
| Yoda | Figure | — | `1000202` | `disney-infinity/yoda.png` | — |
| Yoda (Light FX) | Figure | — | `1000241` | `disney-infinity/yoda-light-fx.png` | — |
| Zeb Orrelios | Figure | — | `1000215` | `disney-infinity/zeb-orrelios.png` | — |
| Finding Dory Play Set | Play Set / Toy Box Game | — | `2000300` | `disney-infinity/finding-dory-play-set.png` | — |
| Inside Out Play Set | Play Set / Toy Box Game | — | `2000200` | `disney-infinity/inside-out-play-set.png` | — |
| Marvel Battlegrounds Play Set | Play Set / Toy Box Game | — | `2000204` | `disney-infinity/marvel-battlegrounds-play-set.png` | — |
| Star Wars: Rise Against the Empire Play Set | Play Set / Toy Box Game | — | `2000202` | `disney-infinity/star-wars-rise-against-the-empire-play-set.png` | — |
| Star Wars: The Force Awakens Play Set | Play Set / Toy Box Game | — | `2000203` | `disney-infinity/star-wars-the-force-awakens-play-set.png` | — |
| Star Wars: Twilight of the Republic Play Set | Play Set / Toy Box Game | — | `2000201` | `disney-infinity/star-wars-twilight-of-the-republic-play-set.png` | — |
| Toy Box Speedway | Play Set / Toy Box Game | — | `2000205` | `disney-infinity/toy-box-speedway.png` | — |
| Toy Box Takeover | Play Set / Toy Box Game | — | `2000206` | `disney-infinity/toy-box-takeover.png` | — |
| Cosmic Cube Blast | Power Disc (round) | — | `3000227` | `disney-infinity/cosmic-cube-blast.png` | — |
| Darkhawk's Blast | Power Disc (round) | — | `3000226` | `disney-infinity/darkhawks-blast.png` | — |
| Finn's Stormtrooper Costume | Power Disc (round) | — | `3000216` | `disney-infinity/finns-stormtrooper-costume.png` | — |
| Galactic Team-Up: Mace Windu | Power Disc (round) | — | `3000206` | `disney-infinity/galactic-team-up-mace-windu.png` | — |
| King Mickey | Power Disc (round) | — | `3000231` | `disney-infinity/king-mickey.png` | — |
| Luke's Rebel Alliance Flight Suit Costume | Power Disc (round) | — | `3000209` | `disney-infinity/lukes-rebel-alliance-flight-suit-costume.png` | — |
| Meter Maid Judy | Power Disc (round) | — | `3000223` | `disney-infinity/meter-maid-judy.png` | — |
| Nova Corps Strike | Power Disc (round) | — | `3000230` | `disney-infinity/nova-corps-strike.png` | — |
| Officer Nick Wilde | Power Disc (round) | — | `3000222` | `disney-infinity/officer-nick-wilde.png` | — |
| Poe's Resistance Jacket | Power Disc (round) | — | `3000217` | `disney-infinity/poes-resistance-jacket.png` | — |
| Princess Leia's Boushh Disguise | Power Disc (round) | — | `3000228` | `disney-infinity/princess-leias-boushh-disguise.png` | — |
| Resistance Tactical Strike | Power Disc (round) | — | `3000218` | `disney-infinity/resistance-tactical-strike.png` | — |
| Tomorrowland Time Bomb | Power Disc (round) | — | `3000200` | `disney-infinity/tomorrowland-time-bomb.png` | — |
| Arlo | Power Disc (hexagonal) | — | `4000212` | `disney-infinity/arlo.png` | — |
| Butch | Power Disc (hexagonal) | — | `4000214` | `disney-infinity/butch.png` | — |
| Forests of Felucia | Power Disc (hexagonal) | — | `4000205` | `disney-infinity/forests-of-felucia.png` | — |
| General Grievous' Wheel Bike | Power Disc (hexagonal) | — | `4000207` | `disney-infinity/general-grievous-wheel-bike.png` | — |
| Ghost Rider's Motorcycle | Power Disc (hexagonal) | — | `4000224` | `disney-infinity/ghost-riders-motorcycle.png` | — |
| Nash | Power Disc (hexagonal) | — | `4000213` | `disney-infinity/nash.png` | — |
| Quad Jumper | Power Disc (hexagonal) | — | `4000229` | `disney-infinity/quad-jumper.png` | — |
| Ramsey | Power Disc (hexagonal) | — | `4000215` | `disney-infinity/ramsey.png` | — |
| Retro Ray Gun | Power Disc (hexagonal) | — | `4000201` | `disney-infinity/retro-ray-gun.png` | — |
| Sahara Square Sands | Power Disc (hexagonal) | — | `4000221` | `disney-infinity/sahara-square-sands.png` | — |
| Skies Over Felucia | Power Disc (hexagonal) | — | `4000204` | `disney-infinity/skies-over-felucia.png` | — |
| Slave I Flyer | Power Disc (hexagonal) | — | `4000210` | `disney-infinity/slave-i-flyer.png` | — |
| Stars Over Sahara Square | Power Disc (hexagonal) | — | `4000220` | `disney-infinity/stars-over-sahara-square.png` | — |
| Tomorrowland Futurescape | Power Disc (hexagonal) | — | `4000202` | `disney-infinity/tomorrowland-futurescape.png` | — |
| Tomorrowland Stratosphere | Power Disc (hexagonal) | — | `4000203` | `disney-infinity/tomorrowland-stratosphere.png` | — |
| Y-Wing Fighter | Power Disc (hexagonal) | — | `4000211` | `disney-infinity/y-wing-fighter.png` | — |

## LEGO Dimensions (67)

Tracked: seeded from `docs/data/toys_to_life/LEGO_Dimensions_Packs.csv`. Images go in `backend/static/toys-to-life/lego-dimensions/`.

| Set number | Pack | Pack type | Franchise | Minifigures | Platform | IGDB ID | Image filename | Image present |
|---|---|---|---|---|---|---|---|---|
| 71170 | LEGO Dimensions Starter Pack: PS3 | Starter Pack | DC Comics, The LEGO Movie, The Lord of the Rings | Batman, Wyldstyle, Gandalf | PlayStation 3 | 11077 | `71170-lego-dimensions-starter-pack-ps3.png` | ✓ |
| 71171 | LEGO Dimensions Starter Pack: PS4 | Starter Pack | DC Comics, The LEGO Movie, The Lord of the Rings | Batman, Wyldstyle, Gandalf | PlayStation 4 | 11077 | `71171-lego-dimensions-starter-pack-ps4.png` | ✓ |
| 71172 | LEGO Dimensions Starter Pack: Xbox One | Starter Pack | DC Comics, The LEGO Movie, The Lord of the Rings | Batman, Wyldstyle, Gandalf | Xbox One | 11077 | `71172-lego-dimensions-starter-pack-xbox-one.png` | ✓ |
| 71173 | LEGO Dimensions Starter Pack: Xbox 360 | Starter Pack | DC Comics, The LEGO Movie, The Lord of the Rings | Batman, Wyldstyle, Gandalf | Xbox 360 | 11077 | `71173-lego-dimensions-starter-pack-xbox-360.png` | ✓ |
| 71174 | LEGO Dimensions Starter Pack: Wii U | Starter Pack | DC Comics, The LEGO Movie, The Lord of the Rings | Batman, Wyldstyle, Gandalf | Wii U | 11077 | `71174-lego-dimensions-starter-pack-wii-u.png` | ✓ |
| 71201 | Back to the Future Level Pack | Level Pack | Back to the Future | Marty McFly | — | 172570 | `71201-back-to-the-future-level-pack.png` | ✓ |
| 71202 | Simpsons Level Pack | Level Pack | The Simpsons | Homer | — | 172579 | `71202-simpsons-level-pack.png` | ✓ |
| 71203 | Portal 2 Level Pack | Level Pack | Portal 2 | Chell | — | 172561 | `71203-portal-2-level-pack.png` | ✓ |
| 71204 | Doctor Who Level Pack | Level Pack | Doctor Who | Twelfth Doctor | — | 172606 | `71204-doctor-who-level-pack.png` | ✓ |
| 71205 | Jurassic World Team Pack | Team Pack | Jurassic World | Owen Grady, ACU | — | 172568 | `71205-jurassic-world-team-pack.png` | ✓ |
| 71206 | Scooby-Doo Team Pack | Team Pack | Scooby-Doo | Shaggy, Scooby-Doo | — | 172584 | `71206-scooby-doo-team-pack.png` | ✓ |
| 71207 | Ninjago Team Pack | Team Pack | Ninjago | Kai, Cole | — | 172612 | `71207-ninjago-team-pack.png` | ✓ |
| 71209 | DC Wonder Woman Fun Pack | Fun Pack | DC Comics | Wonder Woman | — | 172626 | `71209-dc-wonder-woman-fun-pack.png` | ✓ |
| 71210 | DC Cyborg Fun Pack | Fun Pack | DC Comics | Cyborg | — | 172628 | `71210-dc-cyborg-fun-pack.png` | ✓ |
| 71211 | Simpsons Bart Fun Pack | Fun Pack | The Simpsons | Bart | — | 172617 | `71211-simpsons-bart-fun-pack.png` | ✓ |
| 71212 | LEGO Movie Emmet Fun Pack | Fun Pack | The LEGO Movie | Emmet | — | 172629 | `71212-lego-movie-emmet-fun-pack.png` | ✓ |
| 71213 | LEGO Movie Bad Cop Fun Pack | Fun Pack | The LEGO Movie | Bad Cop | — | 172616 | `71213-lego-movie-bad-cop-fun-pack.png` | ✓ |
| 71214 | LEGO Movie Benny Fun Pack | Fun Pack | The LEGO Movie | Benny | — | 172630 | `71214-lego-movie-benny-fun-pack.png` | ✓ |
| 71215 | Ninjago Jay Fun Pack | Fun Pack | Ninjago | Jay | — | 172640 | `71215-ninjago-jay-fun-pack.png` | ✓ |
| 71216 | Ninjago Nya Fun Pack | Fun Pack | Ninjago | Nya | — | 172611 | `71216-ninjago-nya-fun-pack.png` | ✓ |
| 71217 | Ninjago Zane Fun Pack | Fun Pack | Ninjago | Zane | — | 172610 | `71217-ninjago-zane-fun-pack.png` | ✓ |
| 71218 | Lord of the Rings Gollum Fun Pack | Fun Pack | The Lord of the Rings | Gollum | — | 172605 | `71218-lord-of-the-rings-gollum-fun-pack.png` | ✓ |
| 71219 | Lord of the Rings Legolas Fun Pack | Fun Pack | The Lord of the Rings | Legolas | — | 172604 | `71219-lord-of-the-rings-legolas-fun-pack.png` | ✓ |
| 71220 | Lord of the Rings Gimli Fun Pack | Fun Pack | The Lord of the Rings | Gimli | — | 172637 | `71220-lord-of-the-rings-gimli-fun-pack.png` | ✓ |
| 71221 | Wizard of Oz Wicked Witch Fun Pack | Fun Pack | The Wizard of Oz | Wicked Witch | — | 172638 | `71221-wizard-of-oz-wicked-witch-fun-pack.png` | ✓ |
| 71222 | Legends of Chima Laval Fun Pack | Fun Pack | Legends of Chima | Laval | — | 172623 | `71222-legends-of-chima-laval-fun-pack.png` | ✓ |
| 71223 | Legends of Chima Cragger Fun Pack | Fun Pack | Legends of Chima | Cragger | — | 172635 | `71223-legends-of-chima-cragger-fun-pack.png` | ✓ |
| 71227 | Simpsons Krusty Fun Pack | Fun Pack | The Simpsons | Krusty | — | 172624 | `71227-simpsons-krusty-fun-pack.png` | ✓ |
| 71228 | Ghostbusters Level Pack | Level Pack | Ghostbusters | Peter Venkman | — | 172573 | `71228-ghostbusters-level-pack.png` | ✓ |
| 71229 | DC Comics Team Pack | Team Pack | DC Comics | The Joker, Harley Quinn | — | 172613 | `71229-dc-comics-team-pack.png` | ✓ |
| 71230 | Back to the Future Doc Brown Fun Pack | Fun Pack | Back to the Future | Doc Brown | — | 172571 | `71230-back-to-the-future-doc-brown-fun-pack.png` | ✓ |
| 71231 | LEGO Movie Unikitty Fun Pack | Fun Pack | The LEGO Movie | Unikitty | — | 172620 | `71231-lego-movie-unikitty-fun-pack.png` | ✓ |
| 71232 | Legends of Chima Eris Fun Pack | Fun Pack | Legends of Chima | Eris | — | 172608 | `71232-legends-of-chima-eris-fun-pack.png` | ✓ |
| 71233 | Ghostbusters Stay Puft Fun Pack | Fun Pack | Ghostbusters | Stay Puft | — | 23370 | `71233-ghostbusters-stay-puft-fun-pack.png` | ✓ |
| 71234 | Ninjago Sensei Wu Fun Pack | Fun Pack | Ninjago | Sensei Wu | — | 172602 | `71234-ninjago-sensei-wu-fun-pack.png` | ✓ |
| 71235 | Midway Arcade Level Pack | Level Pack | Midway Arcade | Gamer Kid | — | 172580 | `71235-midway-arcade-level-pack.png` | ✓ |
| 71236 | DC Superman Fun Pack | Fun Pack | DC Comics | Superman | — | 23378 | `71236-dc-superman-fun-pack.png` | ✓ |
| 71237 | DC Aquaman Fun Pack | Fun Pack | DC Comics | Aquaman | — | 172581 | `71237-dc-aquaman-fun-pack.png` | ✓ |
| 71238 | Doctor Who Cyberman Fun Pack | Fun Pack | Doctor Who | Cyberman | — | 172633 | `71238-doctor-who-cyberman-fun-pack.png` | ✓ |
| 71239 | Ninjago Lloyd Fun Pack | Fun Pack | Ninjago | Lloyd Garmadon | — | 172609 | `71239-ninjago-lloyd-fun-pack.png` | ✓ |
| 71240 | DC Bane Fun Pack | Fun Pack | DC Comics | Bane | — | 172627 | `71240-dc-bane-fun-pack.png` | ✓ |
| 71241 | Ghostbusters Slimer Fun Pack | Fun Pack | Ghostbusters | Slimer | — | 172574 | `71241-ghostbusters-slimer-fun-pack.png` | ✓ |
| 71242 | Ghostbusters (2016) Story Pack | Story Pack | Ghostbusters (2016) | Abby Yates | — | 172572 | `71242-ghostbusters-2016-story-pack.png` | ✓ |
| 71244 | Sonic the Hedgehog Level Pack | Level Pack | Sonic the Hedgehog | Sonic the Hedgehog | — | 172563 | `71244-sonic-the-hedgehog-level-pack.png` | ✓ |
| 71245 | Adventure Time Level Pack | Level Pack | Adventure Time | Finn the Human | — | 172618 | `71245-adventure-time-level-pack.png` | ✓ |
| 71246 | Adventure Time Team Pack | Team Pack | Adventure Time | Jake the Dog, Lumpy Space Princess | — | 172619 | `71246-adventure-time-team-pack.png` | ✓ |
| 71247 | Harry Potter Team Pack | Team Pack | Harry Potter | Harry Potter, Lord Voldemort | — | 172615 | `71247-harry-potter-team-pack.png` | ✓ |
| 71248 | Mission Impossible Level Pack | Level Pack | Mission: Impossible | Ethan Hunt | — | 172582 | `71248-mission-impossible-level-pack.png` | ✓ |
| 71251 | The A-Team B.A. Baracus Fun Pack | Fun Pack | The A-Team | B.A. Baracus | — | 172577 | `71251-the-a-team-b-a-baracus-fun-pack.png` | ✓ |
| 71253 | Fantastic Beasts and Where to Find Them Story Pack | Story Pack | Fantastic Beasts | Newt Scamander | — | 172578 | `71253-fantastic-beasts-and-where-to-find-them-story-pack.png` | ✓ |
| 71255 | Teen Titans Go! Team Pack | Team Pack | Teen Titans Go! | Beast Boy, Raven | — | 172632 | `71255-teen-titans-go-team-pack.png` | ✓ |
| 71256 | Gremlins Team Pack | Team Pack | Gremlins | Gizmo, Stripe | — | 172631 | `71256-gremlins-team-pack.png` | ✓ |
| 71257 | Tina Goldstein Fun Pack | Fun Pack | Fantastic Beasts | Tina Goldstein | — | 172639 | `71257-tina-goldstein-fun-pack.png` | ✓ |
| 71258 | E.T. The Extra-Terrestrial Fun Pack | Fun Pack | E.T. the Extra-Terrestrial | E.T. | — | 172569 | `71258-e-t-the-extra-terrestrial-fun-pack.png` | ✓ |
| 71264 | The LEGO Batman Movie Story Pack | Story Pack | The LEGO Batman Movie | Batgirl, Robin | — | 172576 | `71264-the-lego-batman-movie-story-pack.png` | ✓ |
| 71266 | LEGO City: Undercover Chase McCain Fun Pack | Fun Pack | LEGO City Undercover | Chase McCain | — | 172583 | `71266-lego-city-undercover-chase-mccain-fun-pack.png` | ✓ |
| 71267 | The Goonies Level Pack | Level Pack | The Goonies | Sloth | — | 172564 | `71267-the-goonies-level-pack.png` | ✓ |
| 71285 | Adventure Time Marceline Fun Pack | Fun Pack | Adventure Time | Marceline the Vampire Queen | — | 172614 | `71285-adventure-time-marceline-fun-pack.png` | ✓ |
| 71286 | Knight Rider Michael Knight Fun Pack | Fun Pack | Knight Rider | Michael Knight | — | 172636 | `71286-knight-rider-michael-knight-fun-pack.png` | ✓ |
| 71287 | Starfire Fun Pack | Fun Pack | Teen Titans Go! | Starfire | — | 172607 | `71287-starfire-fun-pack.png` | ✓ |
| 71340 | DC Supergirl Polybag | Polybag / Promo | DC Comics | Supergirl | — | 172621 | `71340-dc-supergirl-polybag.png` | ✓ |
| 71342 | DC Green Arrow Polybag | Polybag / Promo | DC Comics | Green Arrow | — | 172622 | `71342-dc-green-arrow-polybag.png` | ✓ |
| 71343 | The Powerpuff Girls Buttercup Fun Pack | Fun Pack | The Powerpuff Girls | Buttercup | — | 172642 | `71343-the-powerpuff-girls-buttercup-fun-pack.png` | ✓ |
| 71344 | The LEGO Batman Movie Fun Pack | Fun Pack | The LEGO Batman Movie | Excalibur Batman | — | 172625 | `71344-the-lego-batman-movie-fun-pack.png` | ✓ |
| 71346 | The Powerpuff Girls Team Pack | Team Pack | The Powerpuff Girls | Blossom, Bubbles | — | 172641 | `71346-the-powerpuff-girls-team-pack.png` | ✓ |
| 71348 | Hermione Fun Pack | Fun Pack | Harry Potter | Hermione Granger | — | 172634 | `71348-hermione-fun-pack.png` | ✓ |
| 71349 | Beetlejuice Fun Pack | Fun Pack | Beetlejuice | Betelgeuse | — | 172585 | `71349-beetlejuice-fun-pack.png` | ✓ |
