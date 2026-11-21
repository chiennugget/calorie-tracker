import type { Nutrients } from './types'

/**
 * Singapore hawker & kopitiam food database.
 *
 * Values are typical estimates for ONE regular hawker portion cooked the usual
 * (fairly oily) way. They're rough averages drawn from published hawker-food
 * nutrition figures (e.g. Singapore HPB's energy & nutrient composition data)
 * and common recipes — real plates vary a lot by stall, so the app lets you
 * adjust portion, oil level and add-ons.
 *
 * `oilG` = grams of cooking oil / lard / coconut fat in a normal plate that the
 * "less oil" / "extra oily" adjuster scales. 0 means the dish isn't oil-sensitive.
 *
 * This file has no DOM/React dependencies so it can be reused by a React Native port.
 */

export type SgCategory = 'rice' | 'noodles' | 'malay_indian' | 'zichar_snacks' | 'breakfast' | 'drinks' | 'desserts'

export const SG_CATEGORY_LABELS: Record<SgCategory, string> = {
  rice: 'Rice dishes',
  noodles: 'Noodles',
  malay_indian: 'Malay & Indian',
  zichar_snacks: 'Snacks & sides',
  breakfast: 'Breakfast & dim sum',
  drinks: 'Kopitiam drinks',
  desserts: 'Desserts',
}

export interface SgAddOn {
  id: string
  name: string
  n: Nutrients
}

export interface SgDish {
  id: string
  name: string
  aliases?: string[]
  category: SgCategory
  serving: string
  n: Nutrients
  oilG: number
  addOns?: string[]
  /** true for dishes you usually count (prata, dim sum, drinks) */
  countable?: boolean
}

const N = (calories: number, protein: number, carbs: number, fat: number): Nutrients => ({ calories, protein, carbs, fat })

export const SG_ADDONS: Record<string, SgAddOn> = {
  egg_fried: { id: 'egg_fried', name: 'Fried egg', n: N(90, 6, 0.5, 7) },
  egg_boiled: { id: 'egg_boiled', name: 'Hard-boiled egg', n: N(70, 6, 0.5, 5) },
  egg_braised: { id: 'egg_braised', name: 'Braised egg', n: N(80, 6, 2, 5) },
  egg_onsen: { id: 'egg_onsen', name: 'Onsen / soft egg', n: N(70, 6, 0.5, 5) },
  extra_rice: { id: 'extra_rice', name: 'Extra rice (½ bowl)', n: N(130, 2.5, 29, 0.3) },
  less_rice: { id: 'less_rice', name: 'Less rice (−½ bowl)', n: N(-130, -2.5, -29, -0.3) },
  extra_noodles: { id: 'extra_noodles', name: 'Extra noodles', n: N(150, 5, 30, 1.5) },
  extra_meat: { id: 'extra_meat', name: 'Extra meat', n: N(130, 15, 1, 7) },
  skin_off: { id: 'skin_off', name: 'No chicken skin', n: N(-90, -2, 0, -9) },
  chicken_wing: { id: 'chicken_wing', name: 'Fried chicken wing', n: N(200, 14, 6, 13) },
  chicken_drumstick: { id: 'chicken_drumstick', name: 'Fried chicken drumstick', n: N(280, 22, 8, 18) },
  otah: { id: 'otah', name: 'Otah (1 pc)', n: N(70, 6, 3, 4) },
  luncheon: { id: 'luncheon', name: 'Luncheon meat (1 slice)', n: N(110, 4, 2, 9) },
  fishballs: { id: 'fishballs', name: 'Fish balls (3)', n: N(60, 7, 5, 1) },
  fishcake: { id: 'fishcake', name: 'Fried fishcake slices', n: N(90, 6, 6, 5) },
  cockles: { id: 'cockles', name: 'Cockles (see hum)', n: N(35, 6, 1, 0.5) },
  prawns: { id: 'prawns', name: 'Extra prawns', n: N(60, 12, 0.5, 1) },
  lard: { id: 'lard', name: 'Pork lard bits', n: N(70, 0.5, 0, 7.5) },
  sambal: { id: 'sambal', name: 'Sambal chilli (1 tbsp)', n: N(40, 0.5, 3, 3) },
  curry_gravy: { id: 'curry_gravy', name: 'Curry gravy (1 ladle)', n: N(120, 1, 5, 11) },
  veg_side: { id: 'veg_side', name: 'Stir-fried vegetables', n: N(80, 2, 5, 6) },
  extra_veg_dish: { id: 'extra_veg_dish', name: 'Extra veg dish', n: N(90, 2, 6, 6.5) },
  extra_meat_dish: { id: 'extra_meat_dish', name: 'Extra meat dish', n: N(200, 14, 6, 13) },
  you_tiao: { id: 'you_tiao', name: 'You tiao (1)', n: N(230, 5, 25, 12) },
  curry_dip: { id: 'curry_dip', name: 'Curry dip', n: N(80, 1, 4, 7) },
  sugar_dip: { id: 'sugar_dip', name: 'Sugar (1 tbsp)', n: N(50, 0, 12.5, 0) },
  peanut_sauce: { id: 'peanut_sauce', name: 'Extra peanut sauce', n: N(120, 4, 8, 8) },
  ketupat: { id: 'ketupat', name: 'Ketupat (rice cake)', n: N(120, 2, 27, 0.3) },
  milk_fish_soup: { id: 'milk_fish_soup', name: 'Add evaporated milk', n: N(80, 4, 6, 4.5) },
  pearls: { id: 'pearls', name: 'Pearls / boba', n: N(110, 0, 27, 0) },
  ice_cream: { id: 'ice_cream', name: 'Scoop of ice cream', n: N(140, 2.5, 16, 7) },
  gula_melaka: { id: 'gula_melaka', name: 'Extra gula melaka', n: N(60, 0, 15, 0) },
}

const RICE_ADDONS = ['extra_rice', 'less_rice', 'egg_braised', 'egg_fried', 'extra_meat', 'veg_side']
const NOODLE_ADDONS = ['extra_noodles', 'extra_meat', 'egg_braised', 'fishballs', 'lard', 'veg_side']

export const SG_DISHES: SgDish[] = [
  // ---------- Rice ----------
  { id: 'chicken_rice_steamed', name: 'Chicken rice (steamed)', aliases: ['hainanese chicken rice', 'white chicken rice'], category: 'rice', serving: '1 plate', n: N(607, 25, 75, 23), oilG: 12, addOns: ['skin_off', ...RICE_ADDONS] },
  { id: 'chicken_rice_roasted', name: 'Chicken rice (roasted)', aliases: ['roast chicken rice'], category: 'rice', serving: '1 plate', n: N(650, 28, 75, 26), oilG: 12, addOns: ['skin_off', ...RICE_ADDONS] },
  { id: 'char_siew_rice', name: 'Char siew rice', aliases: ['bbq pork rice', 'cha shao'], category: 'rice', serving: '1 plate', n: N(605, 24, 88, 17), oilG: 6, addOns: RICE_ADDONS },
  { id: 'roast_pork_rice', name: 'Roast pork (siew yoke) rice', aliases: ['siu yuk', 'roasted pork'], category: 'rice', serving: '1 plate', n: N(700, 26, 80, 30), oilG: 6, addOns: RICE_ADDONS },
  { id: 'duck_rice', name: 'Braised duck rice', aliases: ['lor ark', 'teochew duck'], category: 'rice', serving: '1 plate', n: N(650, 30, 80, 22), oilG: 5, addOns: RICE_ADDONS },
  { id: 'nasi_lemak_basic', name: 'Nasi lemak (egg, ikan bilis, peanuts)', aliases: ['coconut rice'], category: 'rice', serving: '1 plate', n: N(494, 14, 60, 22), oilG: 10, addOns: ['chicken_wing', 'chicken_drumstick', 'otah', 'luncheon', 'egg_fried', 'sambal', 'extra_rice'] },
  { id: 'nasi_lemak_chicken', name: 'Nasi lemak with fried chicken', aliases: ['nasi lemak chicken wing'], category: 'rice', serving: '1 plate', n: N(750, 30, 68, 40), oilG: 15, addOns: ['chicken_wing', 'otah', 'luncheon', 'egg_fried', 'sambal', 'extra_rice'] },
  { id: 'economy_rice', name: 'Economy rice (1 meat, 2 veg)', aliases: ['cai fan', 'cai png', 'mixed rice', 'chap chye png'], category: 'rice', serving: '1 plate', n: N(650, 25, 80, 25), oilG: 15, addOns: ['extra_meat_dish', 'extra_veg_dish', 'curry_gravy', 'egg_fried', 'extra_rice', 'less_rice'] },
  { id: 'curry_rice_hainanese', name: 'Hainanese curry rice', aliases: ['scissors cut curry rice'], category: 'rice', serving: '1 plate', n: N(750, 28, 85, 33), oilG: 15, addOns: ['extra_meat_dish', 'egg_fried', 'curry_gravy', 'extra_rice'] },
  { id: 'egg_fried_rice', name: 'Egg fried rice', aliases: ['fried rice'], category: 'rice', serving: '1 plate', n: N(660, 18, 85, 26), oilG: 18, addOns: ['egg_fried', 'extra_meat', 'prawns'] },
  { id: 'yang_chow_fried_rice', name: 'Yang chow fried rice', aliases: ['yangzhou fried rice'], category: 'rice', serving: '1 plate', n: N(760, 25, 90, 32), oilG: 20, addOns: ['egg_fried', 'prawns'] },
  { id: 'nasi_goreng', name: 'Nasi goreng', aliases: ['malay fried rice', 'nasi goreng pattaya'], category: 'rice', serving: '1 plate', n: N(740, 24, 90, 30), oilG: 20, addOns: ['egg_fried', 'chicken_wing', 'sambal'] },
  { id: 'claypot_rice', name: 'Claypot rice', aliases: ['bo zai fan'], category: 'rice', serving: '1 pot (1 pax)', n: N(750, 30, 95, 25), oilG: 10, addOns: ['egg_fried', 'extra_meat'] },
  { id: 'bak_kut_teh', name: 'Bak kut teh with rice', aliases: ['bkt', 'pork rib soup'], category: 'rice', serving: '1 set', n: N(640, 35, 75, 22), oilG: 0, addOns: ['you_tiao', 'extra_rice', 'egg_braised', 'extra_meat'] },
  { id: 'kway_chap', name: 'Kway chap', aliases: ['kuay chap', 'braised pork kway'], category: 'rice', serving: '1 set', n: N(650, 30, 70, 27), oilG: 3, addOns: ['egg_braised', 'extra_meat'] },
  { id: 'teochew_porridge', name: 'Teochew porridge (plain, 1 bowl)', aliases: ['plain porridge', 'muay'], category: 'rice', serving: '1 bowl', n: N(120, 3, 26, 0.3), oilG: 0, addOns: ['extra_meat_dish', 'extra_veg_dish', 'egg_braised'], countable: true },
  { id: 'fish_porridge', name: 'Fish porridge', aliases: ['fish congee'], category: 'rice', serving: '1 bowl', n: N(300, 20, 40, 6), oilG: 2, addOns: ['you_tiao', 'egg_boiled'] },
  { id: 'chicken_porridge', name: 'Chicken / century egg porridge', aliases: ['century egg congee', 'pork porridge'], category: 'rice', serving: '1 bowl', n: N(330, 18, 42, 9), oilG: 2, addOns: ['you_tiao', 'egg_boiled'] },
  { id: 'chicken_chop', name: 'Chicken chop with fries (western)', aliases: ['western food', 'black pepper chicken chop'], category: 'rice', serving: '1 plate', n: N(900, 45, 70, 48), oilG: 25, addOns: ['egg_fried'] },
  { id: 'fish_and_chips', name: 'Fish & chips (western stall)', aliases: ['fish n chips'], category: 'rice', serving: '1 plate', n: N(850, 35, 80, 42), oilG: 25 },
  { id: 'mala_xiang_guo', name: 'Mala xiang guo (medium bowl)', aliases: ['mala', 'mala hotpot dry'], category: 'rice', serving: '1 bowl (1 pax)', n: N(950, 35, 40, 72), oilG: 50, addOns: ['extra_rice'] },
  { id: 'cereal_prawn_rice', name: 'Zi char rice dish (e.g. sweet & sour pork rice)', aliases: ['zichar', 'zi char', 'sweet and sour pork'], category: 'rice', serving: '1 plate', n: N(780, 28, 95, 32), oilG: 20, addOns: ['egg_fried', 'extra_rice'] },

  // ---------- Noodles ----------
  { id: 'char_kway_teow', name: 'Char kway teow', aliases: ['ckt', 'fried kway teow', 'fried flat noodles'], category: 'noodles', serving: '1 plate', n: N(744, 23, 76, 38), oilG: 25, addOns: ['cockles', 'egg_fried', 'lard', 'extra_noodles', 'prawns'] },
  { id: 'hokkien_mee', name: 'Fried Hokkien prawn mee', aliases: ['hokkien mee', 'prawn noodles fried'], category: 'noodles', serving: '1 plate', n: N(522, 18, 70, 19), oilG: 15, addOns: ['lard', 'prawns', 'sambal', 'extra_noodles'] },
  { id: 'wanton_mee_dry', name: 'Wanton mee (dry)', aliases: ['wonton noodles', 'wanton noodles'], category: 'noodles', serving: '1 plate', n: N(410, 15, 58, 13), oilG: 6, addOns: NOODLE_ADDONS },
  { id: 'wanton_mee_soup', name: 'Wanton mee (soup)', aliases: ['wonton noodle soup'], category: 'noodles', serving: '1 bowl', n: N(300, 15, 45, 6), oilG: 2, addOns: NOODLE_ADDONS },
  { id: 'bak_chor_mee', name: 'Bak chor mee (dry)', aliases: ['minced meat noodles', 'mee pok tah'], category: 'noodles', serving: '1 bowl', n: N(511, 23, 57, 21), oilG: 8, addOns: NOODLE_ADDONS },
  { id: 'fishball_noodles_dry', name: 'Fishball noodles (dry)', aliases: ['fishball mee pok', 'mee pok'], category: 'noodles', serving: '1 bowl', n: N(380, 18, 55, 10), oilG: 5, addOns: NOODLE_ADDONS },
  { id: 'fishball_noodles_soup', name: 'Fishball noodles (soup)', aliases: ['fishball soup noodles'], category: 'noodles', serving: '1 bowl', n: N(330, 18, 50, 6), oilG: 1, addOns: NOODLE_ADDONS },
  { id: 'prawn_mee_soup', name: 'Prawn mee (soup)', aliases: ['prawn noodle soup', 'har mee'], category: 'noodles', serving: '1 bowl', n: N(293, 16, 43, 6), oilG: 2, addOns: ['prawns', 'extra_noodles', 'lard'] },
  { id: 'laksa', name: 'Laksa', aliases: ['curry laksa', 'katong laksa'], category: 'noodles', serving: '1 bowl', n: N(589, 21, 56, 32), oilG: 10, addOns: ['cockles', 'prawns', 'egg_boiled', 'extra_noodles'] },
  { id: 'lor_mee', name: 'Lor mee', aliases: ['braised gravy noodles'], category: 'noodles', serving: '1 bowl', n: N(383, 16, 52, 12), oilG: 4, addOns: ['egg_braised', 'extra_meat', 'fishcake'] },
  { id: 'mee_rebus', name: 'Mee rebus', category: 'noodles', serving: '1 plate', n: N(556, 21, 82, 15), oilG: 5, addOns: ['egg_boiled', 'extra_noodles'] },
  { id: 'mee_siam', name: 'Mee siam', category: 'noodles', serving: '1 plate', n: N(520, 20, 80, 13), oilG: 10, addOns: ['egg_boiled'] },
  { id: 'mee_goreng', name: 'Mee goreng (mamak)', aliases: ['indian mee goreng', 'fried yellow noodles'], category: 'noodles', serving: '1 plate', n: N(660, 18, 80, 30), oilG: 20, addOns: ['egg_fried', 'extra_meat'] },
  { id: 'bee_hoon_goreng', name: 'Fried bee hoon', aliases: ['mee hoon goreng', 'fried vermicelli', 'economy bee hoon'], category: 'noodles', serving: '1 plate', n: N(540, 14, 80, 18), oilG: 15, addOns: ['egg_fried', 'luncheon', 'chicken_wing', 'fishcake'] },
  { id: 'beef_hor_fun', name: 'Beef hor fun (wet)', aliases: ['hor fun', 'kway teow wet fried', 'sliced fish hor fun'], category: 'noodles', serving: '1 plate', n: N(700, 30, 80, 28), oilG: 18, addOns: ['extra_meat', 'egg_fried'] },
  { id: 'ban_mian', name: 'Ban mian (soup)', aliases: ['mee hoon kueh', 'handmade noodles'], category: 'noodles', serving: '1 bowl', n: N(475, 22, 62, 15), oilG: 4, addOns: ['egg_onsen', 'extra_noodles', 'extra_meat'] },
  { id: 'fish_soup', name: 'Sliced fish soup with bee hoon', aliases: ['fish soup', 'fish bee hoon'], category: 'noodles', serving: '1 bowl', n: N(350, 28, 45, 6), oilG: 1, addOns: ['milk_fish_soup', 'extra_rice', 'extra_meat'] },
  { id: 'fried_fish_soup_milk', name: 'Fried fish soup with milk & bee hoon', aliases: ['milky fish soup'], category: 'noodles', serving: '1 bowl', n: N(560, 28, 55, 25), oilG: 8, addOns: ['extra_rice'] },
  { id: 'yong_tau_foo_soup', name: 'Yong tau foo (soup, 6 pcs + noodles)', aliases: ['ytf'], category: 'noodles', serving: '1 bowl', n: N(420, 22, 55, 12), oilG: 3, addOns: ['fishballs', 'extra_noodles'] },
  { id: 'yong_tau_foo_dry', name: 'Yong tau foo (dry, with sauce)', aliases: ['ytf dry'], category: 'noodles', serving: '1 plate', n: N(520, 22, 68, 18), oilG: 6, addOns: ['fishballs', 'extra_noodles'] },
  { id: 'mee_soto', name: 'Mee soto', category: 'noodles', serving: '1 bowl', n: N(450, 22, 60, 13), oilG: 4, addOns: ['egg_boiled', 'sambal'] },
  { id: 'carrot_cake_white', name: 'Fried carrot cake (white)', aliases: ['chai tow kway', 'chye tow kway'], category: 'noodles', serving: '1 plate', n: N(500, 12, 60, 24), oilG: 20, addOns: ['egg_fried', 'prawns'] },
  { id: 'carrot_cake_black', name: 'Fried carrot cake (black)', aliases: ['black carrot cake'], category: 'noodles', serving: '1 plate', n: N(560, 12, 72, 25), oilG: 20, addOns: ['egg_fried'] },
  { id: 'oyster_omelette', name: 'Oyster omelette (orh luak)', aliases: ['orh jian', 'oyster egg'], category: 'noodles', serving: '1 plate', n: N(650, 25, 40, 42), oilG: 25 },

  // ---------- Malay & Indian ----------
  { id: 'roti_prata_plain', name: 'Roti prata, plain', aliases: ['prata', 'roti canai', 'kosong prata'], category: 'malay_indian', serving: '1 piece', n: N(210, 4, 27, 10), oilG: 6, addOns: ['curry_dip', 'sugar_dip'], countable: true },
  { id: 'roti_prata_egg', name: 'Roti prata, egg', aliases: ['egg prata', 'telur prata'], category: 'malay_indian', serving: '1 piece', n: N(270, 9, 27, 14), oilG: 6, addOns: ['curry_dip'], countable: true },
  { id: 'cheese_prata', name: 'Roti prata, cheese', aliases: ['cheese prata'], category: 'malay_indian', serving: '1 piece', n: N(300, 9, 28, 17), oilG: 6, addOns: ['curry_dip'], countable: true },
  { id: 'thosai', name: 'Thosai, plain', aliases: ['dosa', 'tosai'], category: 'malay_indian', serving: '1 piece', n: N(185, 4, 33, 4), oilG: 3, addOns: ['curry_dip'], countable: true },
  { id: 'murtabak', name: 'Murtabak (chicken or mutton)', aliases: ['martabak'], category: 'malay_indian', serving: '1 serving', n: N(790, 35, 70, 41), oilG: 20, addOns: ['curry_dip'] },
  { id: 'briyani_chicken', name: 'Chicken briyani', aliases: ['nasi briyani', 'biryani', 'mutton briyani'], category: 'malay_indian', serving: '1 plate', n: N(880, 40, 95, 38), oilG: 20, addOns: ['egg_boiled', 'curry_gravy'] },
  { id: 'nasi_padang', name: 'Nasi padang (rice + 2 dishes)', aliases: ['malay rice', 'nasi campur'], category: 'malay_indian', serving: '1 plate', n: N(800, 30, 85, 38), oilG: 18, addOns: ['extra_meat_dish', 'extra_veg_dish', 'sambal', 'egg_boiled'] },
  { id: 'ayam_penyet', name: 'Ayam penyet', aliases: ['smashed fried chicken'], category: 'malay_indian', serving: '1 plate', n: N(900, 45, 80, 45), oilG: 25, addOns: ['sambal', 'extra_rice'] },
  { id: 'lontong', name: 'Lontong', aliases: ['sayur lodeh'], category: 'malay_indian', serving: '1 plate', n: N(700, 18, 80, 35), oilG: 8, addOns: ['egg_boiled', 'sambal'] },
  { id: 'soto_ayam', name: 'Soto ayam (with nasi impit)', aliases: ['soto'], category: 'malay_indian', serving: '1 bowl', n: N(380, 22, 50, 10), oilG: 3, addOns: ['egg_boiled'] },
  { id: 'satay_chicken', name: 'Chicken satay (10 sticks, with sauce)', aliases: ['satay', 'sate', 'beef satay', 'mutton satay'], category: 'malay_indian', serving: '10 sticks', n: N(520, 45, 20, 30), oilG: 5, addOns: ['peanut_sauce', 'ketupat'] },
  { id: 'mee_rebus_malay', name: 'Mee bandung', aliases: ['mee bandung muar'], category: 'malay_indian', serving: '1 bowl', n: N(560, 24, 75, 18), oilG: 6, addOns: ['egg_boiled'] },

  // ---------- Snacks & sides ----------
  { id: 'chicken_wing_fried', name: 'Fried chicken wing', aliases: ['har cheong gai', 'prawn paste chicken', 'mid wing'], category: 'zichar_snacks', serving: '1 wing', n: N(200, 14, 6, 13), oilG: 6, countable: true },
  { id: 'popiah', name: 'Popiah', aliases: ['spring roll fresh'], category: 'zichar_snacks', serving: '1 roll', n: N(190, 6, 25, 7), oilG: 2, countable: true },
  { id: 'rojak', name: 'Rojak', aliases: ['fruit rojak'], category: 'zichar_snacks', serving: '1 plate', n: N(400, 10, 55, 16), oilG: 5 },
  { id: 'curry_puff', name: 'Curry puff', aliases: ['epok epok', 'karipap'], category: 'zichar_snacks', serving: '1 piece', n: N(250, 5, 27, 14), oilG: 8, countable: true },
  { id: 'goreng_pisang', name: 'Goreng pisang (banana fritter)', aliases: ['pisang goreng', 'banana fritters'], category: 'zichar_snacks', serving: '1 piece', n: N(150, 1.5, 22, 7), oilG: 5, countable: true },
  { id: 'you_tiao_snack', name: 'You tiao (dough fritter)', aliases: ['youtiao', 'yu char kway'], category: 'zichar_snacks', serving: '1 pair', n: N(230, 5, 25, 12), oilG: 8, countable: true },
  { id: 'otah_snack', name: 'Otah', aliases: ['otak otak'], category: 'zichar_snacks', serving: '1 piece', n: N(70, 6, 3, 4), oilG: 0, countable: true },
  { id: 'sambal_kangkong', name: 'Sambal kangkong (side)', aliases: ['kangkong'], category: 'zichar_snacks', serving: '1 side plate', n: N(200, 5, 10, 16), oilG: 12 },

  // ---------- Breakfast & dim sum ----------
  { id: 'kaya_toast', name: 'Kaya butter toast', aliases: ['kaya toast', 'ya kun'], category: 'breakfast', serving: '2 slices', n: N(300, 6, 38, 14), oilG: 0, countable: true },
  { id: 'soft_boiled_eggs', name: 'Soft-boiled eggs (2)', aliases: ['half boiled eggs'], category: 'breakfast', serving: '2 eggs', n: N(140, 12, 1, 10), oilG: 0, countable: true },
  { id: 'chwee_kueh', name: 'Chwee kueh', aliases: ['water rice cake'], category: 'breakfast', serving: '4 pieces', n: N(300, 5, 45, 11), oilG: 5 },
  { id: 'char_siew_bao', name: 'Char siew bao', aliases: ['pau', 'bbq pork bun', 'big pau'], category: 'breakfast', serving: '1 bun', n: N(160, 6, 25, 4), oilG: 0, countable: true },
  { id: 'siew_mai', name: 'Siew mai', aliases: ['siu mai', 'shumai'], category: 'breakfast', serving: '3 pieces', n: N(150, 10, 9, 8), oilG: 0, countable: true },
  { id: 'har_gow', name: 'Har gow', aliases: ['prawn dumpling'], category: 'breakfast', serving: '3 pieces', n: N(120, 7, 15, 3), oilG: 0, countable: true },
  { id: 'lo_mai_gai', name: 'Lo mai gai', aliases: ['glutinous rice chicken'], category: 'breakfast', serving: '1 portion', n: N(400, 15, 55, 13), oilG: 3 },
  { id: 'chee_cheong_fun', name: 'Chee cheong fun', aliases: ['rice noodle roll', 'ccf'], category: 'breakfast', serving: '1 plate', n: N(250, 6, 42, 6), oilG: 3 },
  { id: 'carrot_cake_dimsum', name: 'Pan-fried radish cake (dim sum)', aliases: ['lo bak go'], category: 'breakfast', serving: '3 pieces', n: N(250, 5, 30, 12), oilG: 6 },

  // ---------- Drinks ----------
  { id: 'kopi', name: 'Kopi (condensed milk)', aliases: ['coffee'], category: 'drinks', serving: '1 cup', n: N(130, 2, 22, 4), oilG: 0, countable: true },
  { id: 'kopi_siew_dai', name: 'Kopi siew dai (less sweet)', category: 'drinks', serving: '1 cup', n: N(100, 2, 15, 4), oilG: 0, countable: true },
  { id: 'kopi_c', name: 'Kopi-C (evaporated milk + sugar)', aliases: ['kopi si'], category: 'drinks', serving: '1 cup', n: N(110, 2, 17, 3.5), oilG: 0, countable: true },
  { id: 'kopi_o', name: 'Kopi-O (black with sugar)', category: 'drinks', serving: '1 cup', n: N(70, 0.3, 17, 0), oilG: 0, countable: true },
  { id: 'kopi_o_kosong', name: 'Kopi-O kosong (black, no sugar)', aliases: ['black coffee'], category: 'drinks', serving: '1 cup', n: N(5, 0.3, 0.5, 0), oilG: 0, countable: true },
  { id: 'teh', name: 'Teh (condensed milk)', aliases: ['tea', 'teh peng'], category: 'drinks', serving: '1 cup', n: N(130, 2, 22, 4), oilG: 0, countable: true },
  { id: 'teh_tarik', name: 'Teh tarik', category: 'drinks', serving: '1 cup', n: N(150, 3, 24, 5), oilG: 0, countable: true },
  { id: 'teh_c', name: 'Teh-C', aliases: ['teh si'], category: 'drinks', serving: '1 cup', n: N(110, 2, 17, 3.5), oilG: 0, countable: true },
  { id: 'milo_peng', name: 'Milo (iced)', aliases: ['milo'], category: 'drinks', serving: '1 cup', n: N(200, 5, 32, 5), oilG: 0, countable: true },
  { id: 'milo_dinosaur', name: 'Milo dinosaur', category: 'drinks', serving: '1 cup', n: N(300, 8, 48, 8), oilG: 0, countable: true },
  { id: 'bubble_tea', name: 'Bubble milk tea (regular, 50% sugar)', aliases: ['boba', 'pearl milk tea', 'koi', 'liho', 'chicha'], category: 'drinks', serving: '1 cup (500 ml)', n: N(330, 2, 60, 9), oilG: 0, addOns: ['pearls'], countable: true },
  { id: 'sugarcane', name: 'Sugarcane juice', category: 'drinks', serving: '1 cup', n: N(180, 0, 45, 0), oilG: 0, countable: true },
  { id: 'lime_juice', name: 'Lime juice', aliases: ['calamansi'], category: 'drinks', serving: '1 cup', n: N(120, 0, 30, 0), oilG: 0, countable: true },
  { id: 'bandung', name: 'Bandung (rose syrup milk)', category: 'drinks', serving: '1 cup', n: N(180, 2, 35, 4), oilG: 0, countable: true },
  { id: 'barley', name: 'Barley water', category: 'drinks', serving: '1 cup', n: N(100, 1, 24, 0), oilG: 0, countable: true },
  { id: 'soya_milk', name: 'Soya bean milk (sweetened)', aliases: ['soy milk', 'tau huay chui'], category: 'drinks', serving: '1 cup', n: N(130, 7, 18, 3.5), oilG: 0, countable: true },

  // ---------- Desserts ----------
  { id: 'ice_kachang', name: 'Ice kachang', aliases: ['ais kacang', 'abc'], category: 'desserts', serving: '1 bowl', n: N(260, 3, 55, 4), oilG: 0, addOns: ['ice_cream'] },
  { id: 'chendol', name: 'Chendol', aliases: ['cendol'], category: 'desserts', serving: '1 bowl', n: N(500, 5, 70, 22), oilG: 0, addOns: ['gula_melaka', 'ice_cream'] },
  { id: 'tau_huay', name: 'Tau huay (soya beancurd)', aliases: ['douhua', 'beancurd'], category: 'desserts', serving: '1 bowl', n: N(150, 7, 25, 3), oilG: 0 },
  { id: 'orh_nee', name: 'Orh nee (yam paste)', aliases: ['yam paste'], category: 'desserts', serving: '1 bowl', n: N(400, 3, 55, 19), oilG: 12 },
  { id: 'pulut_hitam', name: 'Pulut hitam', aliases: ['black glutinous rice'], category: 'desserts', serving: '1 bowl', n: N(300, 5, 55, 7), oilG: 0 },
  { id: 'ondeh_ondeh', name: 'Ondeh-ondeh', aliases: ['onde onde'], category: 'desserts', serving: '3 pieces', n: N(150, 1.5, 30, 3), oilG: 0, countable: true },
]

export const SG_DISH_BY_ID: Record<string, SgDish> = Object.fromEntries(SG_DISHES.map((d) => [d.id, d]))

// ---------- Adjustments ----------

export type Portion = 'small' | 'regular' | 'large' | 'upsize'
export type OilLevel = 'less' | 'normal' | 'extra'

export const PORTION_FACTORS: Record<Portion, number> = { small: 0.75, regular: 1, large: 1.3, upsize: 1.6 }
export const PORTION_LABELS: Record<Portion, string> = { small: 'Small', regular: 'Regular', large: 'Large', upsize: 'Upsize' }
/** Fraction of the dish's oil added/removed. */
export const OIL_DELTA: Record<OilLevel, number> = { less: -0.45, normal: 0, extra: 0.6 }
export const OIL_LABELS: Record<OilLevel, string> = { less: 'Less oil', normal: 'Normal', extra: 'Extra oily' }

export interface DishOptions {
  portion: Portion
  oil: OilLevel
  addOns: Record<string, number>
}

export const DEFAULT_OPTIONS: DishOptions = { portion: 'regular', oil: 'normal', addOns: {} }

const r1 = (n: number) => Math.round(n * 10) / 10

/** Nutrients for one serving of a dish with the given adjustments. */
export function computeDish(dish: SgDish, o: DishOptions): Nutrients {
  const f = PORTION_FACTORS[o.portion]
  const oilFat = dish.oilG * OIL_DELTA[o.oil] * f
  let calories = dish.n.calories * f + oilFat * 9
  let protein = dish.n.protein * f
  let carbs = dish.n.carbs * f
  let fat = dish.n.fat * f + oilFat
  for (const [id, count] of Object.entries(o.addOns)) {
    const a = SG_ADDONS[id]
    if (!a || !count) continue
    calories += a.n.calories * count
    protein += a.n.protein * count
    carbs += a.n.carbs * count
    fat += a.n.fat * count
  }
  return {
    calories: Math.max(0, Math.round(calories)),
    protein: Math.max(0, r1(protein)),
    carbs: Math.max(0, r1(carbs)),
    fat: Math.max(0, r1(fat)),
  }
}

/** Human-readable name including non-default options, e.g. "Char kway teow (large, extra oily, + cockles)". */
export function describeDish(dish: SgDish, o: DishOptions): string {
  const bits: string[] = []
  if (o.portion !== 'regular') bits.push(PORTION_LABELS[o.portion].toLowerCase())
  if (o.oil !== 'normal' && dish.oilG > 0) bits.push(OIL_LABELS[o.oil].toLowerCase())
  for (const [id, count] of Object.entries(o.addOns)) {
    const a = SG_ADDONS[id]
    if (a && count) bits.push(`${count > 1 ? `${count}× ` : '+ '}${a.name.replace(/\s*\(.*\)$/, '').toLowerCase()}`)
  }
  return bits.length ? `${dish.name} (${bits.join(', ')})` : dish.name
}

// ---------- Search ----------

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

/** Simple token search over names and aliases, best matches first. */
export function searchSgDishes(query: string, limit = 12): SgDish[] {
  const q = norm(query)
  if (!q) return []
  const tokens = q.split(' ')
  const scored: { d: SgDish; s: number }[] = []
  for (const d of SG_DISHES) {
    const names = [d.name, ...(d.aliases ?? [])].map(norm)
    let best = 0
    for (const n of names) {
      if (!tokens.every((t) => n.includes(t))) continue
      let s = 1
      if (n === q) s += 5
      else if (n.startsWith(q)) s += 3
      else if (n.includes(q)) s += 2
      if (n === names[0]) s += 0.5
      best = Math.max(best, s)
    }
    if (best > 0) scored.push({ d, s: best })
  }
  if (!scored.length) return fuzzySgDishes(q, limit)
  return scored.sort((a, b) => b.s - a.s).slice(0, limit).map((x) => x.d)
}

/** Edit distance where a swap of two adjacent letters counts as one typo (optimal string alignment). */
function editDistance(a: string, b: string): number {
  if (Math.abs(a.length - b.length) > 3) return 99
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)])
  for (let j = 0; j <= b.length; j++) d[0][j] = j
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost)
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1)
    }
  }
  return d[a.length][b.length]
}

/**
 * Typo-tolerant fallback, used only when nothing matches exactly:
 *  - initials / abbreviations ("cr" → chicken rice, "chc" → char siew/chicken…),
 *  - letters in order ("chknrice"),
 *  - words within 1–2 typos ("laska" → laksa, "prata" ↔ "parata").
 */
function fuzzySgDishes(q: string, limit: number): SgDish[] {
  const compact = q.replace(/ /g, '')
  const qWords = q.split(' ')
  const scored: { d: SgDish; s: number }[] = []
  for (const d of SG_DISHES) {
    let best = 0
    for (const raw of [d.name, ...(d.aliases ?? [])]) {
      const n = norm(raw)
      const words = n.split(' ')
      const initials = words.map((w) => w[0]).join('')
      if (initials.startsWith(compact) && compact.length >= 2) best = Math.max(best, 3)
      // every query word is close to some word in the name
      const typoOk = qWords.every((qw) => qw.length >= 3 && words.some((w) => editDistance(qw, w.slice(0, Math.max(qw.length, 3) + 1)) <= (qw.length >= 6 ? 2 : 1)))
      if (typoOk) best = Math.max(best, 2.5)
      // letters appear in order
      let i = 0
      for (const ch of n.replace(/ /g, '')) if (ch === compact[i]) i++
      if (i === compact.length && compact.length >= 3) best = Math.max(best, 1 + compact.length / n.length)
    }
    if (best > 0) scored.push({ d, s: best })
  }
  return scored.sort((a, b) => b.s - a.s).slice(0, limit).map((x) => x.d)
}

export const POPULAR_SG_DISHES = [
  'chicken_rice_steamed',
  'char_kway_teow',
  'nasi_lemak_chicken',
  'economy_rice',
  'laksa',
  'bak_chor_mee',
  'hokkien_mee',
  'wanton_mee_dry',
  'roti_prata_plain',
  'kaya_toast',
  'kopi',
  'bubble_tea',
].map((id) => SG_DISH_BY_ID[id])
