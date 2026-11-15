// The Yellow Fisherman: business facts and real menu prices.
// Prices: taken from the shop's own live ordering menu (theyellowfisherman.com,
// published menu v65, 27 Oct 2026). Takeaway and delivery prices are identical.
// Read on 15 Nov 2026. CONFIRM WITH THE SHOP BEFORE GOING LIVE.
export const BIZ = {
  name: 'The Yellow Fisherman',
  phone: '01233 713922',          // Google listing. NOTE: own ordering site shows 01233 712099. Confirm which to use.
  phoneTel: '+441233713922',
  orderUrl: 'https://theyellowfisherman.com/',
  address: 'Tutt Hill House, Maidstone Road, Ram Lane, Ashford, Kent TN26 1AP',
  mapsUrl: 'https://www.google.com/maps/search/?api=1&query=The+Yellow+Fisherman+TN26+1AP',
  facebook: 'https://facebook.com/217960904888112',
  rating: 4.0, reviewCount: 303,     // Google Maps, read 15 Nov 2026
  hours: [ // Google listing; online orders close 9:45pm (own ordering site)
    ['Mon', '2pm – 10pm'], ['Tue', '1pm – 10pm'], ['Wed', '1pm – 10pm'], ['Thu', '1pm – 10pm'],
    ['Fri', '2pm – 10pm'], ['Sat', '1pm – 10pm'], ['Sun', '4pm – 10pm'],
  ],
  delivery: { radiusMiles: 8.5, minOrder: 13, feeFrom: 1, feeTo: 6, collectMins: '10–25', deliverMins: '30–90' },
};

// Counter menu panels: real prices from the shop's own online menu (read 15 Nov 2026).
// img = generated photoreal dish cut-out in media/dish. withChips = the shop's own meal price
// when that fish is ordered with medium chips.
export const PANELS = [
  { id: 'fish', title: 'Fish', items: [
    { id: 'mcod', name: 'Medium cod', price: 8.00, withChips: 11.80, img: 'cod2', size: 0.5 },
    { id: 'lcod', name: 'Large cod', price: 10.00, withChips: 13.80, img: 'cod2', size: 0.58 },
    { id: 'haddock', name: 'Haddock', price: 10.50, withChips: 12.80, img: 'cod2', size: 0.54 },
    { id: 'plaice', name: 'Plaice', price: 9.00, withChips: 12.80, img: 'cod2', size: 0.52 },
    { id: 'scampi', name: 'Scampi (12)', price: 7.00, withChips: 10.80, img: 'scampi', size: 0.36 },
    { id: 'fishcake', name: 'Fish cake', price: 3.50, img: 'fishcake', size: 0.24 },
  ]},
  { id: 'chips', title: 'Chips', items: [
    { id: 'mchips', name: 'Medium chips', price: 3.80, img: 'chips', size: 0.34 },
    { id: 'lchips', name: 'Large chips', price: 5.50, img: 'chips', size: 0.4 },
    { id: 'cheesy', name: 'Cheesy chips', price: 5.00, img: 'chips', size: 0.34 },
  ]},
  { id: 'sides', title: 'Sides', items: [
    { id: 'peas', name: 'Mushy peas', price: 1.60, img: 'peas', size: 0.2 },
    { id: 'curry', name: 'Curry sauce', price: 1.60, img: 'curry', size: 0.2 },
    { id: 'sausage', name: 'Jumbo battered sausage', price: 3.50, img: 'sausage', size: 0.42 },
    { id: 'saveloy', name: 'Saveloy', price: 3.30, img: 'saveloy', size: 0.3 },
    { id: 'gherkin', name: 'Pickled gherkin', price: 1.00, img: 'gherkin', size: 0.22 },
  ]},
  { id: 'kebab', title: 'Kebabs & burgers', items: [
    { id: 'donerm', name: 'Lamb doner (medium)', price: 8.20, img: 'kebab', size: 0.4 },
    { id: 'donerl', name: 'Lamb doner (large)', price: 10.00, img: 'kebab', size: 0.46 },
    { id: 'qpc', name: '1/4 pounder with cheese', price: 5.70, img: 'burger', size: 0.3 },
    { id: 'hpc', name: '1/2 pounder with cheese', price: 7.20, img: 'burger', size: 0.34 },
  ]},
  { id: 'drinks', title: 'Drinks', items: [
    { id: 'can', name: 'Can of drink', price: 1.50, img: 'can', size: 0.12, note: 'Coke, Diet Coke, Fanta, 7up, Dr Pepper, Rio or Strawberry Mirinda' },
  ]},
];
export const SEASONING = ['Salt', 'Vinegar', 'Onion vinegar']; // free, from the shop's own options

// Real customer words. Source noted on each. Do not edit the wording.
export const REVIEWS = [
  { q: 'Absolutely best chips we have had from takeaway for years, freshly cooked but very much worth the wait.', who: 'Colette Simpson', src: 'Google review' },
  { q: 'Best Fish and Chips around the local area, great tasting pizzas and kebabs too.', who: 'Google review highlight', src: 'Google Maps' },
  { q: 'Always beautiful cod with fresh chips. Hot, fresh and delicious!', who: 'Judith', src: 'Public review (revieweuro.com)' },
  { q: 'The chips are delicious and the fish batter is even better. From Maidstone to Ashford, this is my favourite fish & chips joint.', who: 'Rodrigo', src: 'Public review (revieweuro.com)' },
  { q: 'We are regular customers of the yellow fisherman and can\u2019t fault it. Food is always hot and delivered promptly.', who: 'Jo Watley', src: 'Public review (revieweuro.com)' },
  { q: 'Had cod and chips delivered today for 9 people. Food was lovely and hot, everyone said what great fish n chips.', who: 'Sheila', src: 'Public review (revieweuro.com)' },
];

// Leads backend. Empty = demo mode (leads saved in this browser only).
// Set to the deployed Cloudflare Worker URL (see /worker) to go live.
export const API_BASE = '';

// Menu highlights shown in the menu section (same source, same date).
export const MENU_LIST = [
  ['Fish suppers', [['Medium cod & chips', 11.80], ['Large cod & chips', 13.80], ['Haddock & chips', 12.80], ['Plaice & chips', 12.80], ['Scampi (12) & chips', 10.80], ['Cod roe & chips', 6.70], ['Fish cake & chips', 6.30]]],
  ['Chippy classics', [['Medium chips', 3.80], ['Large chips', 5.50], ['Cheesy chips', 5.00], ['Battered sausage & chips', 7.40], ['Chicken & mushroom pie & chips', 8.30], ['Steak & kidney pie & chips', 8.30], ['Chip roll', 3.00]]],
  ['On the side', [['Mushy peas', 1.60], ['Curry sauce', 1.60], ['Saveloy', 3.30], ['Jumbo battered sausage', 3.50], ['Pickled gherkin, onion or egg', 1.00], ['10 onion rings', 5.00], ['Battered Mars bar or Snickers', 2.20]]],
  ['Meal deals', [['Chicken strips (6), chips & can', 9.10], ['Chicken wings (6), chips & can', 12.00], ['1/4 pounder with cheese, chips & can', 9.50], ['1/2 pounder with cheese, chips & can', 12.50]]],
];
