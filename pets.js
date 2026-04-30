/* ────────────────────────────────────────────────────────────────────────
   pets.js — pet sprite rendering for the Synko Chrome extension.

   The five Synko species, kept in lockstep with slack-pet's content/pets.ts.
   The original 16-breed pixel-grid system was retired in favor of these
   PNG sprites — but the public API (renderPet / createPetCanvas /
   renderPetAnimated / PET_SPRITES) is preserved so popup.js, listen.js,
   feeding.js, slack.js, reveal.js, profile.js, and db.js keep working
   without changes.

   PET_SPRITES is now a flat array — callers that read `.name` still work.
   Any caller iterating the old `.grid` field will get undefined; that's
   OK because rendering goes through renderPet().
   ──────────────────────────────────────────────────────────────────────── */

const PETS = [
  { name: "Yellow Cat", spriteFile: "sprites/cat_yellow.png", accent: "#ecb22e" },
  { name: "Purple Cat", spriteFile: "sprites/cat_purple.png", accent: "#a259e6" },
  { name: "Brown Dog",  spriteFile: "sprites/dog-brown.png",  accent: "#a0703a" },
  { name: "Pink Dog",   spriteFile: "sprites/dog-pink.png",   accent: "#e8559e" },
  { name: "Purple Dog", spriteFile: "sprites/dog-purple.png", accent: "#7c5fd6" },
  // Capybara — SVG placeholder; swap to capybara.png when the finished sprite
  // lands in /sprites. The Image element below handles either format.
  { name: "Capybara",      spriteFile: "sprites/capybara.svg",       accent: "#b8794a" },
  { name: "Orange Beaver", spriteFile: "sprites/beaver-orange.png",  accent: "#e88c47" },
  { name: "Pink Beaver",   spriteFile: "sprites/beaver-pink.png",    accent: "#e89aa7" },
  { name: "Baby Capybara", spriteFile: "sprites/baby-capybara.png",  accent: "#d4a78a" },
];

// Backward-compatibility alias. Callers that referenced PET_SPRITES[i].name
// keep working. Old `.grid` data is gone — anything that tried to draw a grid
// directly should go through renderPet() now.
const PET_SPRITES = PETS;

// Image cache keyed by species index. We preload all 5 at script start so
// later renderPet() calls can draw synchronously.
const _petImageCache = {};
function _getPetImage(idx) {
  const safeIdx = ((idx % PETS.length) + PETS.length) % PETS.length;
  if (_petImageCache[safeIdx]) return _petImageCache[safeIdx];
  const img = new Image();
  img.src = PETS[safeIdx].spriteFile;
  _petImageCache[safeIdx] = img;
  return img;
}
for (let i = 0; i < PETS.length; i++) _getPetImage(i);

/**
 * Render a pet sprite into a canvas context.
 *
 * Signature kept identical to the legacy pixel-grid renderer:
 *   renderPet(ctx, petIndex, x, y, pixelSize = 3)
 *
 * The sprite is drawn at (16 * pixelSize) × (16 * pixelSize) so existing
 * canvases (which were sized this way for the old 16×16 grid) remain
 * pixel-perfect filled.
 */
function renderPet(ctx, petIndex, x, y, pixelSize = 3) {
  const img = _getPetImage(petIndex);
  const drawSize = 16 * pixelSize;
  // Pixel art: keep the crisp pixel boundaries when scaling.
  if ("imageSmoothingEnabled" in ctx) ctx.imageSmoothingEnabled = false;

  const draw = () => {
    if ("imageSmoothingEnabled" in ctx) ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, x, y, drawSize, drawSize);
  };

  if (img.complete && img.naturalWidth > 0) {
    draw();
  } else {
    // First draw before load completes — paint when ready, then again on
    // any future load events (cheap; browsers de-dupe identical handlers).
    img.addEventListener("load", draw, { once: true });
  }
}

/** Create an offscreen canvas with the pet drawn on it. */
function createPetCanvas(petIndex, pixelSize = 3) {
  const canvas = document.createElement("canvas");
  const size = 16 * pixelSize;
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  renderPet(ctx, petIndex, 0, 0, pixelSize);
  return canvas;
}

/** Animated bounce render — used by the slack pet bubble's bop loop. */
function renderPetAnimated(canvas, petIndex, pixelSize = 4, frame = 0) {
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const offsetY = Math.floor(Math.sin(frame * 0.1) * 2);
  renderPet(ctx, petIndex, 0, offsetY, pixelSize);
}
