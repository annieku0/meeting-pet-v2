// Pixel art pet definitions
// Each pet is a 16x16 grid of color codes
// Palette: .=transparent, W=white, C=cream, T=tan, B=brown, D=dark brown,
//          K=black, G=gray, L=lightgray, O=orange, R=red, P=pink, Y=gold, S=sand, N=nude

const PALETTE = {
  '.': null,
  'W': '#FFFFFF',
  'C': '#EDD090',
  'T': '#C07820',
  'B': '#7A3808',
  'D': '#301000',
  'K': '#0A0A0A',
  'G': '#646464',
  'L': '#B8B8B8',
  'O': '#C85018',
  'R': '#CC1818',
  'P': '#F09898',
  'Y': '#D4A818',
  'S': '#E8DCC0',
  'N': '#E0A060',
  'Z': '#8B8B6A', // gray-brown
  'Q': '#C0A878', // warm beige
  'V': '#4A4A60', // dark blue-gray (husky)
  'U': '#E8E8E8', // near white
  'X': '#F4E4C0', // very pale cream
  'H': '#D4C090', // medium cream
  'J': '#F0C060', // bright yellow
  'I': '#A05030', // reddish brown
  'M': '#D08040', // warm orange-brown
  'F': '#602000', // deep brown
  'E': '#909090', // medium gray
};

// 16x16 pixel art sprites (each row is 16 chars)
const PET_SPRITES = [
  // 0: Chihuahua - big ears, tan/cream, front-facing sitting
  {
    name: "Chihuahua",
    grid: [
      '..TTTT.TTTT.....',
      '.TT....T...TT...',
      '.TCCCCCCCCCCT...',
      '.TCCCCCCCCCCTT..',
      '..TCKCCCKCCCT...',
      '..TCCPPPCCCCT...',
      '..TCCCCCCCCCT...',
      '...TCCCCCCCT....',
      '....CCCCCCCC....',
      '....CCCCCCCC....',
      '...CCCCCCCCCC...',
      '...CC......CC...',
      '...CC......CC...',
      '....TT....TT....',
      '................',
      '................',
    ]
  },
  // 1: Pug - round face, dark muzzle, tan, sitting
  {
    name: "Pug",
    grid: [
      '...CCCCCCCCC....',
      '..CCCCCCCCCCC...',
      '.CCCCCCCCCCCCC..',
      '.CCCCCCCCCCCCC..',
      '.CCKCCCCCKCCCC..',
      '.CCBBBBBBBCCCC..',
      '.CCBBPBBBBCCCC..',
      '..CCCCCCCCCCC...',
      '...CCCCCCCCC....',
      '...CCCCCCCCC....',
      '..CCCCCCCCCCC...',
      '..CCCCCCCCCCC...',
      '..CC.......CC...',
      '..CC.......CC...',
      '...BB.....BB....',
      '................',
    ]
  },
  // 2: Dachshund - long body, brown, side view
  {
    name: "Dachshund",
    grid: [
      '.....BBBB.......',
      '....BBBBBB......',
      '...BBBBBBBBBBBB.',
      '..BBBBBBBBBBBBBB',
      '.BKBBBBBBBBBBBBB',
      '.BPBBBBBBBBBBBB.',
      '..BBBBBBBBBBBBB.',
      '..BBBBBBBBBBBBBB',
      '..BBBBBBBBBBBBBB',
      '..BBBBBBBBBBBBBB',
      '..BBBBBBBBBBBBB.',
      '..BB...BBBBB....',
      '..BB...BBBBB....',
      '..BB....BBBB....',
      '...B....BBBB....',
      '................',
    ]
  },
  // 3: Dalmatian puppy - white with black spots, front-facing
  {
    name: "Dalmatian",
    grid: [
      '....KKKKKK......',
      '...KK....KK.....',
      '..KWWWWWWWWK....',
      '..KWWWKWWWWK....',
      '..KWWKWKWWWK....',
      '..KWWWWWWWWK....',
      '..KWWWWKWWWK....',
      '...KWWWWWWK.....',
      '....KKKKKK......',
      '....WWKWWW......',
      '...WWWWWKWWW....',
      '...WWKWWWWWW....',
      '...WW......WW...',
      '...WW......WW...',
      '....KK....KK....',
      '................',
    ]
  },
  // 4: French Bulldog - black with white, bat ears, walking side
  {
    name: "French Bulldog",
    grid: [
      '..KK.......KK...',
      '.KK..KKKKK..KK..',
      '.K..KKKKKKK..K..',
      '...KKKKKKKKK....',
      '...KKKWKWKK.....',
      '...KKKKPKKK.....',
      '...KKKKKKKKK....',
      '...KWKKKKKWK....',
      '....KKKKKKK.....',
      '....KKKWKKK.....',
      '...KKKKKKKKK....',
      '...KK.....KK....',
      '..KKK.....KKK...',
      '..KK.......KK...',
      '................',
      '................',
    ]
  },
  // 5: Yorkshire Terrier - brown/tan flowing coat, front
  {
    name: "Yorkie",
    grid: [
      '....TTTTT.......',
      '...BBBBBBB......',
      '..BBBBBBBBB.....',
      '..BBCCCCCBB.....',
      '..BBCKCKC BB.....',
      '..BBCCCPCBB.....',
      '..BBBCCCBBB.....',
      '..BBBBBBBBB.....',
      '..BBBTTBBB......',
      '.BBBTTTTTBBB....',
      '.BTTTTTTTTTB....',
      '.BTTTTTTTTTB....',
      '.BTT.....TTB....',
      '..TT.....TT.....',
      '..BB.....BB.....',
      '................',
    ]
  },
  // 6: White Chihuahua - all white, small
  {
    name: "White Chihuahua",
    grid: [
      '..SSSS.SSSS.....',
      '.SS....S...SS...',
      '.SWWWWWWWWWWS...',
      '.SWWWWWWWWWWSS..',
      '..SWKWWWKWWWS...',
      '..SWWWPWWWWWS...',
      '..SWWWWWWWWWS...',
      '...SWWWWWWWS....',
      '....WWWWWWWW....',
      '....WWWWWWWW....',
      '...WWWWWWWWWW...',
      '...WW......WW...',
      '...WW......WW...',
      '....SS....SS....',
      '................',
      '................',
    ]
  },
  // 7: Shiba Inu - orange/tan, walking side
  {
    name: "Shiba Inu",
    grid: [
      '....OOO.........',
      '...OOOOOOO......',
      '..OOOOOOOOO.....',
      '.OOOOOOOOOOO....',
      '.OKOCOOOOOO.....',
      '.OOPOOOOOOOO....',
      '.OOOOOOOOOOO....',
      '.OOOOOOOOOOOO...',
      '.OOOOOOOOOOOO...',
      '.OOOOOOOOOOOOO..',
      '.OOOOOOOOOOOO...',
      '.OO...OOOOO.....',
      '.OO...OOOOO.....',
      '.OO....OOOO.....',
      '..O....OOOO.....',
      '................',
    ]
  },
  // 8: Fox Terrier / Brown Corgi - brown, big ears, side
  {
    name: "Corgi",
    grid: [
      '...BBB..........',
      '..BBBBB.........',
      '.BBBNNNNBB......',
      'BBBNNNNNNBB.....',
      'BKNNNNNNNNN.....',
      'BPBNNNNNNNN.....',
      '.BBBBBBNNNNN....',
      '.BBBBBBBBBNN....',
      '.BBBBBBBBBBBBB..',
      '.BBBBBBBBBBBBBB.',
      '.NBBBBBBBBBBBBB.',
      '.NNB...BBBBBB...',
      '.NNB...BBBBBB...',
      '..NB....BBBBB...',
      '..NB....BBBBB...',
      '................',
    ]
  },
  // 9: Dalmatian with collar - white/black spots, side view, red collar
  {
    name: "Spotted Dalmatian",
    grid: [
      '.....WWW........',
      '....WWWWWW......',
      '...WWWWWWWWW....',
      '..WWWWWKWWWWW...',
      '.WKWWWWWWWWWW...',
      '.WPWWKWWWWWWW...',
      '.WWWWWWWWWKWWW..',
      '.RRRRRRRRRRR....',
      '..WWWWWWWWWWWW..',
      '..WWKWWWWWWWWW..',
      '..WWWWWKWWWWWW..',
      '..WW...WWWWW....',
      '..WW...WWWWW....',
      '..WW....WWWW....',
      '..KK....KKKK....',
      '................',
    ]
  },
  // 10: Beagle - tricolor brown/black/white, side
  {
    name: "Beagle",
    grid: [
      '....BBB.........',
      '...BBBBBB.......',
      '..BBBBBBBBBB....',
      '.BBBCCCCCCBBB...',
      '.BKCCCCCCCBB....',
      '.BPCCCCCCCBB....',
      '.BBBCCCCCBBB....',
      '.BBBBBBBBBBBB...',
      '.KBBBBBBBBBBBK..',
      '.KBBBBBBBBBBBB..',
      '.KBBBBBBBBBBBK..',
      '.KB...BBBBB.K...',
      '.KB...BBBBB.K...',
      '..B....BBBB.....',
      '..B....BBBB.....',
      '................',
    ]
  },
  // 11: Schnauzer - gray/white, boxy, side
  {
    name: "Schnauzer",
    grid: [
      '....GGGG........',
      '...GGGGGG.......',
      '..GGGGGGGGGG....',
      '.GGGGGGGGGGGG...',
      '.GKGGGGGGGGGG...',
      '.GPGGGGGGGGGG...',
      '.GGGLLLLLLGGG...',
      '.GGGLLLLLGGGG...',
      '.GGGGGGGGGGGG...',
      '.GGGGGGGGGGGG...',
      '.GGGGGGGGGGGGG..',
      '.GG...GGGGG.....',
      '.GG...GGGGG.....',
      '.GG....GGGGG....',
      '.GG....GGGGG....',
      '................',
    ]
  },
  // 12: Poodle - white/cream fluffy, front-facing
  {
    name: "Poodle",
    grid: [
      '..XXXXXXXX......',
      '.XXXXXXXXXX.....',
      'XXXXXXXXXXX.....',
      '.XXXXXXXXXX.....',
      '..XKXXXKXX......',
      '..XXXPXXXX......',
      '..XXXXXXXXX.....',
      '.XXXXXXXXXX.....',
      '...RRRRRR.......',
      '...XXXXXXX......',
      '..XXXXXXXXX.....',
      '..XXXXXXXXX.....',
      '..XX.....XX.....',
      '..XX.....XX.....',
      '..XX.....XX.....',
      '................',
    ]
  },
  // 13: Pomeranian / Spitz - orange fluffy, side
  {
    name: "Pomeranian",
    grid: [
      '.....OOO........',
      '....OOOOO.......',
      '...OOOOOOO......',
      '..OOOOOOOOO.....',
      '.OOOOOOOOOOOO...',
      'OOOOKOOOOOOOO...',
      'OOOPOOOOOOOO....',
      '.OOOOOOOOOOOOO..',
      '.OOOOOOOOOOOOO..',
      '..OOOOOOOOOOOO..',
      '..OOOOOOOOOOOO..',
      '..OO...OOOOO....',
      '..OO...OOOOO....',
      '..OO....OOOO....',
      '..OO....OOOO....',
      '................',
    ]
  },
  // 14: Husky - black/gray/white, side
  {
    name: "Husky",
    grid: [
      '....KKK.........',
      '...KKKKKKK......',
      '..KKLLLLLKK.....',
      '.KKLLLLLLLLK....',
      '.KKLKLKLLLLK....',
      '.KKLLLPLLLKK....',
      '.KKLLLLLLLKK....',
      '.KKKKKKKKKKK....',
      '.KGGGGGGGGGKK...',
      '.KGGGGGGGGGKK...',
      '.KGGGGGGGGGGK...',
      '.KG...GGGGG.....',
      '.KG...GGGGG.....',
      '.KG....GGGG.....',
      '.KG....GGGG.....',
      '................',
    ]
  },
  // 15: Labrador / Golden - cream/white, front-facing
  {
    name: "Labrador",
    grid: [
      '....HHHHHH......',
      '...HHHHHHHH.....',
      '..HHHHHHHHHH....',
      '..HHHHHHHHHH....',
      '..HHKHHHHKHH....',
      '..HHHHHPHHHH....',
      '..HHHHHHHHHH....',
      '...HHHHHHHHH....',
      '....HHHHHHHH....',
      '....HHHHHHHH....',
      '...HHHHHHHHHH...',
      '...HHHHHHHHHH...',
      '...HH......HH...',
      '...HH......HH...',
      '....YY....YY....',
      '................',
    ]
  },
];

// Render a pet sprite to a canvas context
function renderPet(ctx, petIndex, x, y, pixelSize = 3) {
  const pet = PET_SPRITES[petIndex];
  if (!pet) return;

  pet.grid.forEach((row, rowIdx) => {
    for (let colIdx = 0; colIdx < row.length; colIdx++) {
      const colorCode = row[colIdx];
      const color = PALETTE[colorCode];
      if (color) {
        ctx.fillStyle = color;
        ctx.fillRect(
          x + colIdx * pixelSize,
          y + rowIdx * pixelSize,
          pixelSize,
          pixelSize
        );
      }
    }
  });
}

// Create a canvas element with a pet rendered on it
function createPetCanvas(petIndex, pixelSize = 3) {
  const canvas = document.createElement('canvas');
  const size = 16 * pixelSize;
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  renderPet(ctx, petIndex, 0, 0, pixelSize);
  return canvas;
}

// Animated bounce render (for active meeting)
function renderPetAnimated(canvas, petIndex, pixelSize = 4, frame = 0) {
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const offsetY = Math.floor(Math.sin(frame * 0.1) * 2);
  renderPet(ctx, petIndex, 0, offsetY, pixelSize);
}
