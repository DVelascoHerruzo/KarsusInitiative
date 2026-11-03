import { parseStatBlock } from './statblock'

describe('parseStatBlock', () => {
  it('reads a 2014 stat block copied from D&D Beyond, scores on separate lines', () => {
    const block = `Goblin
Small Humanoid (Goblinoid), Neutral Evil
Armor Class 15 (Leather Armor, Shield)
Hit Points 7 (2d6)
Speed 30 ft.
STR
8 (−1)
DEX
14 (+2)
CON
10 (+0)
Nimble Escape. The goblin can take the Disengage or Hide action as a bonus action on each of its turns.`
    expect(parseStatBlock(block)).toMatchObject({ name: 'Goblin', armor_class: 15, max_hp: 7, hp_dice: '2d6', initiative_bonus: 2 })
  })

  it('reads the scores from a one-line table', () => {
    const block = `Ogre
Armor Class 11 (hide armor)
Hit Points 59 (7d10 + 21)
STR DEX CON INT WIS CHA
19 (+4) 8 (−1) 16 (+3) 5 (−3) 7 (−2) 7 (−2)`
    expect(parseStatBlock(block)).toMatchObject({ name: 'Ogre', armor_class: 11, max_hp: 59, hp_dice: '7d10+21', initiative_bonus: -1 })
  })

  it('prefers the printed initiative in 2024 stat blocks', () => {
    const block = `Hobgoblin Warrior
Medium Fey (Goblinoid), Lawful Evil
AC 18 Initiative +3 (13)
HP 11 (2d8 + 2)
Speed 30 ft.
Str 13 +1 +1 Dex 12 +1 +1 Con 12 +1 +1`
    expect(parseStatBlock(block)).toMatchObject({ name: 'Hobgoblin Warrior', armor_class: 18, max_hp: 11, hp_dice: '2d8+2', initiative_bonus: 3 })
  })

  it('leaves what it can’t find empty', () => {
    expect(parseStatBlock('Just a name')).toMatchObject({ name: 'Just a name', armor_class: null, max_hp: null, hp_dice: null, initiative_bonus: null })
  })
})
