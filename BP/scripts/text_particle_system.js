/**
 * FAZBEAR'S RESTOCKED - BEDROCK
 * §2025
 * 
 * If you want to modify or use this system as a base, contact the code developer, 
 * Hyrxs (discord: hyrxs), for more information and authorization
 * 
 * DO NOT COPY OR STEAL, ty :>
 *  
*/


import { world, system, MolangVariableMap } from "@minecraft/server";
import { ActionFormData, ModalFormData } from "@minecraft/server-ui";

const COLOR_PRESETS = {
  black: { r: 0, g: 0, b: 0, code: '§0' },
  dark_blue: { r: 0, g: 0, b: 0.667, code: '§1' },
  dark_green: { r: 0, g: 0.667, b: 0, code: '§2' },
  dark_aqua: { r: 0, g: 0.667, b: 0.667, code: '§3' },
  dark_red: { r: 0.667, g: 0, b: 0, code: '§4' },
  dark_purple: { r: 0.667, g: 0, b: 0.667, code: '§5' },
  gold: { r: 1, g: 0.667, b: 0, code: '§6' },
  gray: { r: 0.667, g: 0.667, b: 0.667, code: '§7' },
  dark_gray: { r: 0.333, g: 0.333, b: 0.333, code: '§8' },
  blue: { r: 0.333, g: 0.333, b: 1, code: '§9' },
  green: { r: 0.333, g: 1, b: 0.333, code: '§a' },
  aqua: { r: 0.333, g: 1, b: 1, code: '§b' },
  red: { r: 1, g: 0.333, b: 0.333, code: '§c' },
  light_purple: { r: 1, g: 0.333, b: 1, code: '§d' },
  yellow: { r: 1, g: 1, b: 0.333, code: '§e' },
  white: { r: 1, g: 1, b: 1, code: '§f' },
  minecoin_gold: { r: 0.867, g: 0.839, b: 0.02, code: '§g' },
  material_quartz: { r: 0.89, g: 0.831, b: 0.82, code: '§h' },
  material_iron: { r: 0.808, g: 0.792, b: 0.792, code: '§i' },
  material_netherite: { r: 0.267, g: 0.227, b: 0.231, code: '§j' },
  material_redstone: { r: 0.592, g: 0.086, b: 0.027, code: '§m' },
  material_copper: { r: 0.706, g: 0.408, b: 0.302, code: '§n' },
  material_gold: { r: 0.871, g: 0.694, b: 0.176, code: '§p' },
  material_emerald: { r: 0.067, g: 0.627, b: 0.212, code: '§q' },
  material_diamond: { r: 0.173, g: 0.729, b: 0.659, code: '§s' },
  material_lapis: { r: 0.129, g: 0.286, b: 0.482, code: '§t' },
  material_amethyst: { r: 0.604, g: 0.361, b: 0.776, code: '§u' },
  material_resin: { r: 0.922, g: 0.447, b: 0.078, code: '§v' },
};

const COLOR_NAMES = Object.keys(COLOR_PRESETS);

const CODE_TO_COLOR = {
  '0': COLOR_PRESETS.black, '1': COLOR_PRESETS.dark_blue, '2': COLOR_PRESETS.dark_green,
  '3': COLOR_PRESETS.dark_aqua, '4': COLOR_PRESETS.dark_red, '5': COLOR_PRESETS.dark_purple,
  '6': COLOR_PRESETS.gold, '7': COLOR_PRESETS.gray, '8': COLOR_PRESETS.dark_gray,
  '9': COLOR_PRESETS.blue, 'a': COLOR_PRESETS.green, 'b': COLOR_PRESETS.aqua,
  'c': COLOR_PRESETS.red, 'd': COLOR_PRESETS.light_purple, 'e': COLOR_PRESETS.yellow,
  'f': COLOR_PRESETS.white, 'g': COLOR_PRESETS.minecoin_gold, 'h': COLOR_PRESETS.material_quartz,
  'i': COLOR_PRESETS.material_iron, 'j': COLOR_PRESETS.material_netherite,
  'm': COLOR_PRESETS.material_redstone, 'n': COLOR_PRESETS.material_copper,
  'p': COLOR_PRESETS.material_gold, 'q': COLOR_PRESETS.material_emerald,
  's': COLOR_PRESETS.material_diamond, 't': COLOR_PRESETS.material_lapis,
  'u': COLOR_PRESETS.material_amethyst, 'v': COLOR_PRESETS.material_resin,
};

const FLAG_WALL_SIGN_2 = "§W§A§L§L§S§I§G§N§2";
const FLAG_WALL_SIGN_4 = "§W§D§&§D";
const FLAG_WHITE_WALL_SIGN_2 = "§W§H§I§T§E§S§I§G§N§2";
const FLAG_WHITE_WALL_SIGN_4 = "§W§H§I§T§E§S§I§G§N§4";

function parseColoredText(text, defaultColor) {
  const segments = [];
  let currentColor = defaultColor;
  let currentText = '';
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '§' && i + 1 < text.length) {
      if (currentText.length > 0) {
        segments.push({ text: currentText, color: currentColor });
        currentText = '';
      }
      const colorCode = text[i + 1].toLowerCase();
      if (CODE_TO_COLOR[colorCode]) currentColor = CODE_TO_COLOR[colorCode];
      i++;
    } else {
      currentText += text[i];
    }
  }
  if (currentText.length > 0) segments.push({ text: currentText, color: currentColor });
  return segments;
}

function stripColorCodes(text) {
  return text.replace(/§[0-9a-v]/gi, '');
}

function truncateByVisibleChars(text, maxChars) {
  let visibleCount = 0;
  let result = '';
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '§' && i + 1 < text.length) {
      result += text[i] + text[i + 1];
      i++;
    } else {
      if (visibleCount < maxChars) {
        result += text[i];
        visibleCount++;
      } else break;
    }
  }
  return result;
}

const SPECIAL_CHARS = {
  '!': 'exclamation', '?': 'question', '.': 'period', ',': 'comma', ':': 'colon',
  '-': 'dash', '_': 'underscore', '(': 'lparen', ')': 'rparen', '[': 'lbracket',
  ']': 'rbracket', '/': 'slash', '+': 'plus', '=': 'equals', '*': 'asterisk',
  '#': 'hash', '@': 'at', '&': 'ampersand', '%': 'percent', '$': 'dollar'
};

const CHAR_TO_PARTICLE = {};
const dirs = ['north', 'south', 'east', 'west'];
'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').forEach(c => {
  CHAR_TO_PARTICLE[c] = {};
  dirs.forEach(d => CHAR_TO_PARTICLE[c][d] = `fr:letter_upper_${c.toLowerCase()}_${d}`);
});
'abcdefghijklmnopqrstuvwxyz'.split('').forEach(c => {
  CHAR_TO_PARTICLE[c] = {};
  dirs.forEach(d => CHAR_TO_PARTICLE[c][d] = `fr:letter_lower_${c}_${d}`);
});
'0123456789'.split('').forEach(c => {
  CHAR_TO_PARTICLE[c] = {};
  dirs.forEach(d => CHAR_TO_PARTICLE[c][d] = `fr:letter_${c}_${d}`);
});
Object.entries(SPECIAL_CHARS).forEach(([c, name]) => {
  CHAR_TO_PARTICLE[c] = {};
  dirs.forEach(d => CHAR_TO_PARTICLE[c][d] = `fr:letter_${name}_${d}`);
});

const CHAR_WIDTHS = {
  'i': 0.5, 'I': 0.9, 'l': 0.5, '1': 0.6,
  '.': 0.4, ',': 0.4, ':': 0.4, '!': 0.5,
  'j': 0.6, 'f': 0.7, 't': 0.7, 'r': 1,
  ' ': 0.6,
  'W': 1.2, 'M': 1.2, 'w': 1.1, 'm': 1.1, '@': 1.2,
};

function getBlockFacing(block) {
  try {
    const direction = block.permutation.getState("minecraft:cardinal_direction");
    const opposite = { north: "south", south: "north", east: "west", west: "east" };
    if (direction && opposite[direction]) return opposite[direction];
  } catch (e) { }
  return "north";
}

const TEXT_DISPLAY_BLOCK_IDS = [
  "fr:text_display_block",
  "fr:black_wall_sign_small",
  "fr:white_wall_sign",
  "fr:white_wall_sign_small"
];

function getVariantOffset(facing, variant) {
  if (variant === 0) return { x: 0, y: 0, z: 0 };
  const localX = (variant === 1) ? -0.5 : 0.5;

  switch (facing) {
    case "north": return { x: localX, y: 0, z: 0 };
    case "south": return { x: -localX, y: 0, z: 0 };
    case "east": return { x: 0, y: 0, z: -localX };
    case "west": return { x: 0, y: 0, z: localX };
    default: return { x: 0, y: 0, z: 0 };
  }
}

class TextParticleSystem {
  constructor() {
    this.activeTexts = new Map();
    this.baseSpacing = 0.13;
    this.lineHeight = 0.2;
  }

  getCharWidth(char) { return CHAR_WIDTHS[char] || 1.0; }

  getParticleForChar(char, facing) {
    const charData = CHAR_TO_PARTICLE[char];
    if (!charData) return null;
    return charData[facing] || charData.north;
  }

  getPosKey(location) {
    return `${Math.floor(location.x)}_${Math.floor(location.y)}_${Math.floor(location.z)}`;
  }

  hasTextAt(location) { return this.activeTexts.has(this.getPosKey(location)); }
  getTextData(location) { return this.activeTexts.get(this.getPosKey(location)); }
  getLineCount(location) { const data = this.getTextData(location); return data ? data.lines.length : 0; }

  removeText(location, block = null) {
    const posKey = this.getPosKey(location);
    this.activeTexts.delete(posKey);
    try {
      const key = "fr:text_" + Math.floor(location.x) + "_" + Math.floor(location.y) + "_" + Math.floor(location.z);
      world.setDynamicProperty(key, undefined);
    } catch (e) { }
    return true;
  }

  saveToBlock(block, textData) {
    if (!textData || !textData.blockLocation) return;
    try {
      const colorStrings = [];
      const colors = textData.lineColors || [];
      for (let j = 0; j < colors.length; j++) colorStrings.push("white");
      const saveData = {
        lines: textData.lines || [],
        lineColors: colorStrings,
        lineScales: textData.lineScales || [],
        lineAligns: textData.lineAligns || []
      };
      const jsonStr = JSON.stringify(saveData);
      const key = "fr:text_" + Math.floor(textData.blockLocation.x) + "_" + Math.floor(textData.blockLocation.y) + "_" + Math.floor(textData.blockLocation.z);
      world.setDynamicProperty(key, jsonStr);
    } catch (e) { }
  }

  loadFromBlock(block, facing) {
    if (!block || !block.location) return null;
    try {
      const key = "fr:text_" + Math.floor(block.location.x) + "_" + Math.floor(block.location.y) + "_" + Math.floor(block.location.z);
      const savedJson = world.getDynamicProperty(key);
      if (!savedJson) return null;
      const saveData = JSON.parse(savedJson);
      if (!saveData.lines || saveData.lines.length === 0) return null;
      const lineColors = [];
      const savedColors = saveData.lineColors || [];
      for (let i = 0; i < savedColors.length; i++) lineColors.push(COLOR_PRESETS[savedColors[i]] || COLOR_PRESETS.white);
      const lineScales = saveData.lineScales || [];
      if (lineScales.length === 0) for (let i = 0; i < saveData.lines.length; i++) lineScales.push(1.0);
      const lineAligns = saveData.lineAligns || [];
      if (lineAligns.length === 0) for (let i = 0; i < saveData.lines.length; i++) lineAligns.push('center');
      return { lines: saveData.lines, lineColors, lineScales, lineAligns };
    } catch (e) { return null; }
  }

  spawnLineParticles(dimension, text, facing, scale, baseLocation, yOffset, defaultColor, align = 'center') {
    const segments = parseColoredText(text, defaultColor);
    const plainText = stripColorCodes(text);
    let totalWidth = 0;
    for (let i = 0; i < plainText.length; i++) totalWidth += this.baseSpacing * this.getCharWidth(plainText[i]) * scale;
    let currentOffset;
    const edgeOffset = 0.4;
    switch (align) {
      case 'left': currentOffset = -edgeOffset; break;
      case 'right': currentOffset = -totalWidth + edgeOffset; break;
      default: currentOffset = -totalWidth / 2; break;
    }
    for (const segment of segments) {
      const molangVars = new MolangVariableMap();
      molangVars.setColorRGB("color", { red: segment.color.r, green: segment.color.g, blue: segment.color.b });
      molangVars.setVector3("size", { x: scale, y: scale, z: 0 });
      for (let i = 0; i < segment.text.length; i++) {
        const char = segment.text[i];
        const charWidth = this.baseSpacing * this.getCharWidth(char) * scale;
        currentOffset += charWidth / 2;
        const particleId = this.getParticleForChar(char, facing);
        if (particleId && char !== ' ') {
          let particlePos;
          switch (facing) {
            case "north": particlePos = { x: baseLocation.x - currentOffset, y: baseLocation.y + yOffset, z: baseLocation.z }; break;
            case "south": particlePos = { x: baseLocation.x + currentOffset, y: baseLocation.y + yOffset, z: baseLocation.z }; break;
            case "east": particlePos = { x: baseLocation.x, y: baseLocation.y + yOffset, z: baseLocation.z - currentOffset }; break;
            case "west": particlePos = { x: baseLocation.x, y: baseLocation.y + yOffset, z: baseLocation.z + currentOffset }; break;
            default: particlePos = { x: baseLocation.x - currentOffset, y: baseLocation.y + yOffset, z: baseLocation.z };
          }
          try { dimension.spawnParticle(particleId, particlePos, molangVars); } catch (e) { }
        }
        currentOffset += charWidth / 2;
      }
    }
  }

  spawnTextParticles(dimensionId, textData) {
    try {
      const dimension = world.getDimension(dimensionId.replace("minecraft:", ""));
      const { lines, lineColors, lineScales, lineAligns, facing, scale, spawnLocation } = textData;
      const lineCount = lines.length;
      let totalHeight = 0;
      for (let i = 0; i < lineCount - 1; i++) totalHeight += this.lineHeight * (lineScales?.[i] || scale);
      let currentY = totalHeight / 2;
      for (let lineIndex = 0; lineIndex < lineCount; lineIndex++) {
        const lineScale = lineScales?.[lineIndex] || scale;
        const color = lineColors[lineIndex] || COLOR_PRESETS.white;
        const align = lineAligns?.[lineIndex] || 'center';
        this.spawnLineParticles(dimension, lines[lineIndex], facing, lineScale, spawnLocation, currentY, color, align);
        if (lineIndex < lineCount - 1) {
          const nextScale = lineScales?.[lineIndex + 1] || scale;
          currentY -= this.lineHeight * ((lineScale + nextScale) / 2);
        }
      }
    } catch (e) { }
  }

  registerText(dimension, blockLocation, text, options = {}) {
    let { scale = 1.0, facing = "north", color = COLOR_PRESETS.white, block = null } = options;
    if (block && block.typeId.includes("white_wall_sign") && color === COLOR_PRESETS.white) color = COLOR_PRESETS.black;
    const posKey = this.getPosKey(blockLocation);
    this.activeTexts.delete(posKey);
    let spawnLocation = { x: blockLocation.x + 0.5, y: blockLocation.y + 0.5, z: blockLocation.z + 0.5 };
    const offset = 0.9;

    switch (facing) {
      case "north": spawnLocation.z = blockLocation.z + offset; break;
      case "south": spawnLocation.z = blockLocation.z + (1 - offset); break;
      case "east": spawnLocation.x = blockLocation.x + (1 - offset); break;
      case "west": spawnLocation.x = blockLocation.x + offset; break;
    }

    if (block) {
      try {
        const variant = block.permutation.getState("fr:variants") || 0;
        const varOffset = getVariantOffset(facing, variant);
        spawnLocation.x += varOffset.x;
        spawnLocation.y += varOffset.y;
        spawnLocation.z += varOffset.z;
      } catch (e) { }
    }

    const textData = {
      lines: [text], lineColors: [color], lineScales: [scale], lineAligns: [options.align || 'center'],
      facing, scale, spawnLocation, blockLocation: { ...blockLocation }, dimensionId: dimension.id
    };
    this.activeTexts.set(posKey, textData);
    this.spawnTextParticles(dimension.id, textData);
    if (block) this.saveToBlock(block, textData);
    return posKey;
  }

  addLine(dimension, blockLocation, text, color = null, scale = 1.0, block = null, align = 'center') {
    if (color === null) {
      color = (block && block.typeId.includes("white_wall_sign")) ? COLOR_PRESETS.black : COLOR_PRESETS.white;
    }
    const posKey = this.getPosKey(blockLocation);
    const existingData = this.activeTexts.get(posKey);
    if (!existingData) return false;
    if (existingData.lines.length >= 4) return false;
    existingData.lines.push(text);
    existingData.lineColors.push(color);
    existingData.lineScales.push(scale);
    existingData.lineAligns.push(align);
    this.spawnTextParticles(dimension.id, existingData);
    if (block) this.saveToBlock(block, existingData);
    return true;
  }

  updateAllTexts() {
    const toRemove = [];
    for (const [posKey, textData] of this.activeTexts) {
      try {
        const dimension = world.getDimension(textData.dimensionId.replace("minecraft:", ""));
        const block = dimension.getBlock(textData.blockLocation);
        if (!block || !TEXT_DISPLAY_BLOCK_IDS.includes(block.typeId)) {
          toRemove.push(posKey);
          continue;
        }
        const blockDirection = block.permutation.getState("minecraft:cardinal_direction");
        const opposite = { north: "south", south: "north", east: "west", west: "east" };
        const blockFacing = opposite[blockDirection] || blockDirection;
        const variant = block.permutation.getState("fr:variants") || 0;

        if (blockFacing && ["north", "south", "east", "west"].includes(blockFacing)) {
          textData.facing = blockFacing;
          textData.spawnLocation = { x: textData.blockLocation.x + 0.5, y: textData.blockLocation.y + 0.5, z: textData.blockLocation.z + 0.5 };
          const offset = 0.9;
          switch (blockFacing) {
            case "north": textData.spawnLocation.z = textData.blockLocation.z + offset; break;
            case "south": textData.spawnLocation.z = textData.blockLocation.z + (1 - offset); break;
            case "east": textData.spawnLocation.x = textData.blockLocation.x + (1 - offset); break;
            case "west": textData.spawnLocation.x = textData.blockLocation.x + offset; break;
          }

          const varOffset = getVariantOffset(blockFacing, variant);
          textData.spawnLocation.x += varOffset.x;
          textData.spawnLocation.y += varOffset.y;
          textData.spawnLocation.z += varOffset.z;
        }
        this.spawnTextParticles(textData.dimensionId, textData);
      } catch (e) { }
    }
    for (const key of toRemove) this.activeTexts.delete(key);
  }

  restoreFromBlock(block) {
    const posKey = this.getPosKey(block.location);
    if (this.activeTexts.has(posKey)) return;
    const facing = getBlockFacing(block);
    const variant = block.permutation.getState("fr:variants") || 0;
    const savedData = this.loadFromBlock(block, facing);
    if (!savedData || savedData.lines.length === 0) return;
    let spawnLocation = { x: block.location.x + 0.5, y: block.location.y + 0.5, z: block.location.z + 0.5 };
    const offset = 0.9;
    switch (facing) {
      case "north": spawnLocation.z = block.location.z + offset; break;
      case "south": spawnLocation.z = block.location.z + (1 - offset); break;
      case "east": spawnLocation.x = block.location.x + (1 - offset); break;
      case "west": spawnLocation.x = block.location.x + offset; break;
    }

    const varOffset = getVariantOffset(facing, variant);
    spawnLocation.x += varOffset.x;
    spawnLocation.y += varOffset.y;
    spawnLocation.z += varOffset.z;

    const isSmallSign = block.typeId.includes("_small");
    const fixedScale = isSmallSign ? 0.5 : null;
    const lineScales = isSmallSign ? savedData.lines.map(() => 0.5) : savedData.lineScales;
    const lineColors = savedData.lineColors.map(c => {
      if (block.typeId.includes("white_wall_sign") && c === COLOR_PRESETS.white) return COLOR_PRESETS.black;
      return c;
    });
    const textData = {
      lines: savedData.lines, lineColors, lineScales: lineScales,
      lineAligns: savedData.lineAligns || savedData.lines.map(() => 'center'),
      facing, scale: fixedScale || savedData.lineScales[0] || 1.0, spawnLocation,
      blockLocation: { ...block.location }, dimensionId: block.dimension.id
    };
    this.activeTexts.set(posKey, textData);
  }

  clearAllTexts() { this.activeTexts.clear(); }
}

const textParticleSystem = new TextParticleSystem();

function restoreSavedTexts() {
  try {
    const propIds = world.getDynamicPropertyIds();
    for (const propId of propIds) {
      if (propId.startsWith("fr:text_")) {
        const parts = propId.replace("fr:text_", "").split("_");
        if (parts.length === 3) {
          const x = parseInt(parts[0]), y = parseInt(parts[1]), z = parseInt(parts[2]);
          const location = { x, y, z };
          if (!textParticleSystem.hasTextAt(location)) {
            for (const dimId of ["overworld", "nether", "the_end"]) {
              try {
                const dim = world.getDimension(dimId);
                const block = dim.getBlock(location);
                if (block && TEXT_DISPLAY_BLOCK_IDS.includes(block.typeId)) {
                  textParticleSystem.restoreFromBlock(block);
                  break;
                }
              } catch (e) { }
            }
          }
        }
      }
    }
  } catch (e) { }
}

system.runTimeout(() => { restoreSavedTexts(); }, 40);
system.runInterval(() => { restoreSavedTexts(); }, 100);
system.runInterval(() => { textParticleSystem.updateAllTexts(); }, 20);

world.afterEvents.playerBreakBlock.subscribe((event) => {
  const blockId = event.brokenBlockPermutation.type.id;
  if (TEXT_DISPLAY_BLOCK_IDS.includes(blockId)) {
    textParticleSystem.removeText(event.block.location);
  }
});

function getMaxLinesForBlock(blockTypeId) {
  if (blockTypeId === "fr:black_wall_sign_small") return 4;
  return 2;
}

system.beforeEvents.startup.subscribe((initEvent) => {
  initEvent.blockComponentRegistry.registerCustomComponent('fr:text_display', {
    onPlayerInteract(event) {
      const { player, block } = event;
      if (!player || !block) return;
      system.run(() => { textParticleSystem.restoreFromBlock(block); showTextMainMenu(player, block); });
    }
  });
  initEvent.blockComponentRegistry.registerCustomComponent('fr:text_display_small', {
    onPlayerInteract(event) {
      const { player, block } = event;
      if (!player || !block) return;
      system.run(() => { textParticleSystem.restoreFromBlock(block); showTextMainMenuSmall(player, block); });
    }
  });
});

async function showTextMainMenu(player, block) {
  const textData = textParticleSystem.getTextData(block.location);
  const isWhite = block.typeId.includes("white_wall_sign");
  const FLAG = isWhite ? FLAG_WHITE_WALL_SIGN_2 : FLAG_WALL_SIGN_2;
  const form = new ActionFormData().title(FLAG);
  const lines = textData?.lines || ["", ""];
  form.button(`ln1:§.${lines[0] || ""}`);
  form.button(`ln2:§.${lines[1] || ""}`);
  form.button("§8Edit");
  form.button("§8Close");
  try {
    const response = await form.show(player);
    if (response.canceled) return;
    if (response.selection === 2) showWallSignEditor(player, block);
  } catch (e) { }
}

const TEXT_SIZES = [
  { name: "Large", scale: 1.0, maxChars: 14 },
  { name: "Small", scale: 0.7, maxChars: 20 }
];
const ALIGN_OPTIONS = ['center', 'left', 'right'];
const ALIGN_LABELS = ['Center', 'Left', 'Right'];

async function showWallSignEditor(player, block) {
  const textData = textParticleSystem.getTextData(block.location);
  const rawLines = textData?.lines || [];
  const rawScales = textData?.lineScales || [];
  const rawAligns = textData?.lineAligns || [];
  const line1 = typeof rawLines[0] === 'string' ? rawLines[0] : "";
  const line2 = typeof rawLines[1] === 'string' ? rawLines[1] : "";
  const getSizeIndex = (scale) => { const idx = TEXT_SIZES.findIndex(s => s.scale === scale); return idx >= 0 ? idx : 0; };
  const size1Index = getSizeIndex(rawScales[0] || 1.0);
  const size2Index = getSizeIndex(rawScales[1] || 1.0);
  const getAlignIndex = (align) => { const idx = ALIGN_OPTIONS.indexOf(align); return idx >= 0 ? idx : 0; };
  const align1 = getAlignIndex(rawAligns[0]);
  const align2 = getAlignIndex(rawAligns[1]);
  const form = new ModalFormData().title("§8Edit Sign").submitButton("§8Save");
  form.textField(`Line 1 (max ${TEXT_SIZES[size1Index].maxChars}):`, "Enter text...", { defaultValue: line1 });
  form.dropdown("Size 1:", TEXT_SIZES.map(s => `${s.name} (${s.maxChars} chars)`), { defaultValueIndex: size1Index });
  form.dropdown("Align 1:", ALIGN_LABELS, { defaultValueIndex: align1 });
  form.textField(`Line 2 (max ${TEXT_SIZES[size2Index].maxChars}):`, "Enter text...", { defaultValue: line2 });
  form.dropdown("Size 2:", TEXT_SIZES.map(s => `${s.name} (${s.maxChars} chars)`), { defaultValueIndex: size2Index });
  form.dropdown("Align 2:", ALIGN_LABELS, { defaultValueIndex: align2 });
  try {
    const response = await form.show(player);
    if (response.canceled) return;
    const freshBlock = block.dimension.getBlock(block.location);
    if (!freshBlock) { player.sendMessage("Block no longer exists!"); return; }
    const lineData = [
      { text: response.formValues[0], sizeIndex: response.formValues[1], alignIndex: response.formValues[2] },
      { text: response.formValues[3], sizeIndex: response.formValues[4], alignIndex: response.formValues[5] }
    ].map(l => {
      const size = TEXT_SIZES[l.sizeIndex] || TEXT_SIZES[0];
      const text = l.text ? truncateByVisibleChars(l.text, size.maxChars) : "";
      return { text, scale: size.scale, align: ALIGN_OPTIONS[l.alignIndex] || 'center' };
    }).filter(l => l.text && l.text.trim() !== "");
    if (lineData.length === 0) { textParticleSystem.removeText(freshBlock.location, freshBlock); player.sendMessage("Sign cleared!"); return; }
    const facing = getBlockFacing(freshBlock);
    const color = textData?.lineColors?.[0] || COLOR_PRESETS.white;
    textParticleSystem.registerText(freshBlock.dimension, freshBlock.location, lineData[0].text, {
      scale: lineData[0].scale, facing, color, block: freshBlock, align: lineData[0].align
    });
    for (let i = 1; i < lineData.length; i++) {
      textParticleSystem.addLine(freshBlock.dimension, freshBlock.location, lineData[i].text, color, lineData[i].scale, freshBlock, lineData[i].align);
    }
    player.sendMessage(`Sign updated with ${lineData.length} line(s)!`);
  } catch (e) { }
}

async function showTextMainMenuSmall(player, block) {
  const textData = textParticleSystem.getTextData(block.location);
  const isWhite = block.typeId.includes("white_wall_sign");
  const FLAG = isWhite ? FLAG_WHITE_WALL_SIGN_4 : FLAG_WALL_SIGN_4;
  const form = new ActionFormData().title(FLAG);
  const lines = textData?.lines || ["", "", "", ""];
  form.button(`ln1:§.${lines[0] || ""}`);
  form.button(`ln2:§.${lines[1] || ""}`);
  form.button(`ln3:§.${lines[2] || ""}`);
  form.button(`ln4:§.${lines[3] || ""}`);
  form.button("§8Edit");
  form.button("§8Close");
  try {
    const response = await form.show(player);
    if (response.canceled) return;
    if (response.selection === 4) showWallSignEditorSmall(player, block);
  } catch (e) { }
}

async function showWallSignEditorSmall(player, block) {
  const textData = textParticleSystem.getTextData(block.location);
  const rawLines = textData?.lines || [];
  const rawAligns = textData?.lineAligns || [];
  const line1 = typeof rawLines[0] === 'string' ? rawLines[0] : "";
  const line2 = typeof rawLines[1] === 'string' ? rawLines[1] : "";
  const line3 = typeof rawLines[2] === 'string' ? rawLines[2] : "";
  const line4 = typeof rawLines[3] === 'string' ? rawLines[3] : "";
  const getAlignIndex = (align) => { const idx = ALIGN_OPTIONS.indexOf(align); return idx >= 0 ? idx : 0; };
  const align1 = getAlignIndex(rawAligns[0]);
  const align2 = getAlignIndex(rawAligns[1]);
  const align3 = getAlignIndex(rawAligns[2]);
  const align4 = getAlignIndex(rawAligns[3]);
  const SMALL_SCALE = 0.5;
  const MAX_CHARS = 25;
  const form = new ModalFormData().title("§8Edit Sign").submitButton("§8Save");
  form.textField("Line 1:", "Enter text...", { defaultValue: line1 });
  form.dropdown("Align 1:", ALIGN_LABELS, { defaultValueIndex: align1 });
  form.textField("Line 2:", "Enter text...", { defaultValue: line2 });
  form.dropdown("Align 2:", ALIGN_LABELS, { defaultValueIndex: align2 });
  form.textField("Line 3:", "Enter text...", { defaultValue: line3 });
  form.dropdown("Align 3:", ALIGN_LABELS, { defaultValueIndex: align3 });
  form.textField("Line 4:", "Enter text...", { defaultValue: line4 });
  form.dropdown("Align 4:", ALIGN_LABELS, { defaultValueIndex: align4 });
  try {
    const response = await form.show(player);
    if (response.canceled) return;
    const freshBlock = block.dimension.getBlock(block.location);
    if (!freshBlock) { player.sendMessage("Block no longer exists!"); return; }
    const lineData = [
      { text: response.formValues[0], alignIndex: response.formValues[1] },
      { text: response.formValues[2], alignIndex: response.formValues[3] },
      { text: response.formValues[4], alignIndex: response.formValues[5] },
      { text: response.formValues[6], alignIndex: response.formValues[7] }
    ].map(l => {
      const trimmed = l.text ? truncateByVisibleChars(l.text, MAX_CHARS) : "";
      return { text: trimmed, scale: SMALL_SCALE, align: ALIGN_OPTIONS[l.alignIndex] || 'center' };
    }).filter(l => l.text && l.text.trim() !== "");
    if (lineData.length === 0) { textParticleSystem.removeText(freshBlock.location, freshBlock); player.sendMessage("Sign cleared!"); return; }
    const facing = getBlockFacing(freshBlock);
    const color = textData?.lineColors?.[0] || COLOR_PRESETS.white;
    textParticleSystem.registerText(freshBlock.dimension, freshBlock.location, lineData[0].text, {
      scale: SMALL_SCALE, facing, color, block: freshBlock, align: lineData[0].align
    });
    for (let i = 1; i < lineData.length; i++) {
      textParticleSystem.addLine(freshBlock.dimension, freshBlock.location, lineData[i].text, color, SMALL_SCALE, freshBlock, lineData[i].align);
    }
    player.sendMessage(`Sign updated with ${lineData.length} line(s)!`);
  } catch (e) { }
}

export { textParticleSystem, TextParticleSystem, COLOR_PRESETS };
