import { system, world, BlockPermutation } from "@minecraft/server";

export function adjustTextLength(text = '', totalLength = 100) {
  return (text.slice(0, totalLength)).padEnd(totalLength, '\t');
}

export function dynamicToast(title = '', message = '', icon = '', background = 'textures/ui/greyBorder') {
  return "§N§O§T§I§F§I§C§A§T§I§O§N" +
    adjustTextLength(title, 100) +
    adjustTextLength(message, 200) +
    adjustTextLength(icon, 100) +
    adjustTextLength(background, 100);
}

export function dynamicToastEvent(text) {
  const contents = text.split('|');
  if (contents[3] === undefined) { contents[3] = 'textures/ui/greyBorder'; }
  return "§N§O§T§I§F§I§C§A§T§I§O§N" +
    adjustTextLength(contents[0], 100) +
    adjustTextLength(contents[1], 200) +
    adjustTextLength(contents[2], 100) +
    adjustTextLength(contents[3], 100);
}

export let lampVfxEntities = {};

export function cleanupLampVfxEntitiesOnReload() {
  const dimensions = ["overworld", "nether", "the end"];
  system.runTimeout(() => {
    dimensions.forEach(dimName => {
      try {
        const dimension = world.getDimension(dimName);
        dimension.runCommand(`event entity @e[type=fr:office_lamp_vfx] destroy`);
        dimension.runCommand(`event entity @e[type=fr:stage_spotlight_vfx] destroy`);
      } catch {}
    });
    const elapsedTime = Date.now();
    world.getPlayers().forEach(player => {
      player.sendMessage(dynamicToast(
        "§l§qSUCCESS", 
        `§qScripts reloaded...\n§7Time: ${elapsedTime}ms`, 
        "textures/fr_ui/approve_icon", 
        "textures/fr_ui/approve_ui"
      ));
    });
  }, 3);
}

export function getLinePoints(pos1, pos2, numPoints) {
  const start = { x: pos1.x + 0.5, y: pos1.y + 0.5, z: pos1.z + 0.5 };
  const end = { x: pos2.x + 0.5, y: pos2.y + 0.5, z: pos2.z + 0.5 };
  const points = [];
  const dx = (end.x - start.x) / (numPoints - 1);
  const dy = (end.y - start.y) / (numPoints - 1);
  const dz = (end.z - start.z) / (numPoints - 1);
  for (let i = 0; i < numPoints; i++) {
    points.push({
      x: start.x + dx * i,
      y: start.y + dy * i,
      z: start.z + dz * i,
    });
  }
  return points;
}

export function turnOffLight(connection, LIGHT_TYPES) {
  const lightDimension = world.getDimension(connection.light.dimensionId);
  const lightBlock = lightDimension.getBlock({
    x: connection.light.x,
    y: connection.light.y,
    z: connection.light.z,
  });
  if (lightBlock && LIGHT_TYPES.has(lightBlock.typeId)) {
    const newPerm = lightBlock.permutation.withState("fr:lit", false);
    lightBlock.setPermutation(newPerm);
  }
  const key = `${connection.light.dimensionId}_${connection.light.x}_${connection.light.y}_${connection.light.z}`;
  if (lampVfxEntities[key]) {
    const dimension = world.getDimension(connection.light.dimensionId);
    const location = { x: connection.light.x + 0.5, y: connection.light.y + 0.5, z: connection.light.z + 0.5 };
    
    if (lampVfxEntities[key].isStageSpotlight) {
      dimension.runCommand(`execute at @e[type=fr:stage_spotlight_vfx] positioned ${location.x} ${location.y} ${location.z} run event entity @e[r=0.5] destroy`);
    } else {
      dimension.runCommand(`execute at @e[type=fr:office_lamp_vfx] positioned ${location.x} ${location.y} ${location.z} run event entity @e[r=0.5] destroy`);
    }
    delete lampVfxEntities[key];
  }
}
