import * as FRAPI from "../fr_api.js";


export const LIGHT_BLOCK_CONFIGS = {

  "fr:office_light": {
    alias: "Office light",
    icon: "textures/fr_ui/light_test_icon",
    vfxEntity: "fr:hallway_lamp_vfx",
    spawnOffset: { x: 0, y: 0, z: 0 },
    destroyRadius: 0.5,
    powerState: "fr:lit"
  },

  "fr:office_lamp": {
    alias: "Office lamp",
    icon: "textures/fr_ui/light_test_icon",
    vfxEntity: "fr:office_lamp_vfx",
    spawnOffset: { x: 0, y: 0, z: 0 },
    destroyRadius: 0.5,
    powerState: "fr:lit"
  },

  "fr:supply_room_lightbulb": {
    alias: "Supply room lightbulb",
    icon: "textures/fr_ui/light_test_icon",
    vfxEntity: "fr:office_lamp_vfx",
    spawnOffset: { x: 0, y: 0, z: 0 },
    destroyRadius: 0.5,
    powerState: "fr:lit"
  },

  "fr:pizzeria_lamp": {
    alias: "Pizzeria lamp",
    icon: "textures/fr_ui/light_test_icon",
    vfxEntity: "fr:pizzeria_lamp_vfx",
    spawnOffset: { x: 0, y: 0, z: 0 },
    destroyRadius: 0.5,
    powerState: "fr:lit"
  },

  "fr:ceiling_light": {
    alias: "Ceiling light",
    icon: "textures/fr_ui/light_test_icon",
    vfxEntity: "fr:ceiling_light_vfx",
    spawnOffset: { x: 0, y: 0, z: 0 },
    destroyRadius: 0.5,
    powerState: "fr:lit",
    requiresCardinalRotation: true,
    cardinalState: "minecraft:cardinal_direction",
    rotationMap: {
      north: 0,
      south: 0,
      east: 90,
      west: 90
    }
  },

  "fr:pirate_cove_light": {
    alias: "Pirate cove light",
    icon: "textures/fr_ui/light_test_icon",
    vfxEntity: "fr:pirate_cove_light_entity",
    spawnOffset: { x: 0, y: 0.4, z: 0 },
    destroyRadius: 1.5,
    powerState: "fr:lit",
    requiresCardinalRotation: true,
    cardinalState: "minecraft:cardinal_direction",
    offsetMap: {
      north: { x: 0, y: 0, z: -0.3 },
      south: { x: 0, y: 0, z: 0.3 },
      east: { x: 0.3, y: 0, z: 0 },
      west: { x: -0.3, y: 0, z: 0 }
    },
    rotationMap: {
      north: 180,
      south: 0,
      east: 90,
      west: -90
    }
  },
  
  "fr:stage_spotlight": {
    alias: "Stage spotlight",
    icon: "textures/fr_ui/light_test_icon",
    vfxEntity: "fr:stage_spotlight_vfx",
    spawnOffset: { x: 0, y: 0, z: 0 },
    destroyRadius: 0.5,
    powerState: "fr:lit",
    useCommand: true,
    requiresFaceRotation: true,
    faceState: "minecraft:block_face",
    rotationState: "fr:rotation",
    colorState: "fr:color"
  }

};

export const SWITCH_CONFIGS = {
  "fr:switch": {
    alias: "Switch",
    icon: "textures/fr_ui/switch_icon",
    powerState: "fr:switch_type"
  }
};

export const GENERATOR_CONFIGS = {
  "fr:generator": {
    alias: "Generator",
    icon: "textures/fr_ui/generator_icon"
  },
  "fr:sotm_generator": {
    alias: "SOTM Generator",
    icon: "textures/fr_ui/generator_icon"
  }
};

// Other code

export const LIGHT_TYPES = new Set(Object.keys(LIGHT_BLOCK_CONFIGS));
export const SWITCH_TYPES = new Set(Object.keys(SWITCH_CONFIGS));
export const GENERATOR_TYPES = new Set(Object.keys(GENERATOR_CONFIGS));

export const CONNECTIONS_KEY = "electric_system_connections";
export const GENERATORS_KEY = "electric_system_generators";
export const DOOR_BUTTON_GENERATOR_LINKS_KEY = "door_button_generator_links";
export const MAX_ENERGY = 500;
export const DEFAULT_CONSUMPTION_RATE = 0.2;
export const CONSUMPTION_MULTIPLIER = 0.1;
export const NEAR_DISTANCE = 64;

export function getLightConfig(blockId) {
  if (LIGHT_BLOCK_CONFIGS[blockId]) {
    return LIGHT_BLOCK_CONFIGS[blockId];
  }
  const externalConfig = FRAPI.getConnectionType(blockId);
  if (externalConfig && (externalConfig.type === "light" || externalConfig.type === "light_button")) {
    return {
      alias: externalConfig.alias || blockId,
      icon: externalConfig.icon || "textures/fr_ui/default_icon",
      vfxEntity: externalConfig.vfxEntity || "fr:hallway_lamp_vfx",
      spawnOffset: externalConfig.spawnOffset || { x: 0, y: 0, z: 0 },
      destroyRadius: externalConfig.destroyRadius || 0.5,
      powerState: externalConfig.powerState || "fr:lit",
      requiresCardinalRotation: externalConfig.requiresCardinalRotation || false,
      cardinalState: externalConfig.cardinalState,
      offsetMap: externalConfig.offsetMap,
      rotationMap: externalConfig.rotationMap,
      useCommand: externalConfig.useCommand || false,
      requiresFaceRotation: externalConfig.requiresFaceRotation || false,
      faceState: externalConfig.faceState,
      rotationState: externalConfig.rotationState,
      colorState: externalConfig.colorState
    };
  }
  return null;
}

export function getSwitchConfig(blockId) {
  if (SWITCH_CONFIGS[blockId]) {
    return SWITCH_CONFIGS[blockId];
  }
  const externalConfig = FRAPI.getConnectionType(blockId);
  if (externalConfig && externalConfig.type === "switch") {
    return {
      alias: externalConfig.alias || blockId,
      icon: externalConfig.icon || "textures/fr_ui/default_icon",
      powerState: externalConfig.powerState || "fr:switch_type"
    };
  }
  return null;
}

export function getGeneratorConfig(blockId) {
  if (GENERATOR_CONFIGS[blockId]) {
    return GENERATOR_CONFIGS[blockId];
  }
  return null;
}

export function getAllLightTypes() {
  const allTypes = new Set(LIGHT_TYPES);
  const externalTypes = FRAPI.getConnectionTypesByCategory("light");
  for (const config of externalTypes) {
    allTypes.add(config.id);
  }
  const externalButtonTypes = FRAPI.getConnectionTypesByCategory("light_button");
  for (const config of externalButtonTypes) {
    allTypes.add(config.id);
  }
  return allTypes;
}

export function getAllSwitchTypes() {
  const allTypes = new Set(SWITCH_TYPES);
  const externalTypes = FRAPI.getConnectionTypesByCategory("switch");
  for (const config of externalTypes) {
    allTypes.add(config.id);
  }
  return allTypes;
}

export function getBlockAlias(blockId) {
  const lightConfig = getLightConfig(blockId);
  if (lightConfig) return lightConfig.alias;
  
  const switchConfig = getSwitchConfig(blockId);
  if (switchConfig) return switchConfig.alias;
  
  const generatorConfig = getGeneratorConfig(blockId);
  if (generatorConfig) return generatorConfig.alias;

  return blockId;
}

export function getBlockIcon(blockId) {
  const lightConfig = getLightConfig(blockId);
  if (lightConfig) return lightConfig.icon;
  
  const switchConfig = getSwitchConfig(blockId);
  if (switchConfig) return switchConfig.icon;
  
  const generatorConfig = getGeneratorConfig(blockId);
  if (generatorConfig) return generatorConfig.icon;

  return "textures/fr_ui/default_icon";
}

export function isLightType(blockId) {
  return getLightConfig(blockId) !== null;
}

export function isSwitchType(blockId) {
  return getSwitchConfig(blockId) !== null;
}

export function isCameraType(blockId) {
  const externalConfig = FRAPI.getConnectionType(blockId);
  return externalConfig && externalConfig.type === "camera";
}

export function getVfxEntityForLight(lightTypeId) {
  const config = getLightConfig(lightTypeId);
  return config ? config.vfxEntity : "fr:hallway_lamp_vfx";
}

export function spawnLightVfx(dimension, lightBlock, lightData, vfxCache) {
  const config = getLightConfig(lightBlock.typeId);
  if (!config) return null;

  const key = `${lightData.dimensionId}_${lightData.x}_${lightData.y}_${lightData.z}`;
  const baseLocation = {
    x: lightData.x + 0.5,
    y: lightData.y + config.spawnOffset.y,
    z: lightData.z + 0.5
  };

  if (config.useCommand && config.requiresFaceRotation) {
    const blockFace = lightBlock.permutation.getState(config.faceState) || "down";
    let angle;
    if (blockFace === "down") {
      const angles = [180, 200, 225, 250, 270, 290, 315, 335, 0, 25, 45, 70, 90, 115, 135, 160];
      const rotationState = lightBlock.permutation.getState(config.rotationState) || 0;
      angle = angles[rotationState];
    } else {
      const faceAngles = { north: 180, east: 270, south: 0, west: 90 };
      angle = faceAngles[blockFace] ?? 0;
    }
    dimension.runCommand(`summon ${config.vfxEntity} ${baseLocation.x} ${baseLocation.y} ${baseLocation.z} ${angle} 0`);
    
    if (config.colorState) {
      const blockColor = lightBlock.permutation.getState(config.colorState) ?? 4;
      const spawnedEntities = dimension.getEntities({
        type: config.vfxEntity,
        location: baseLocation,
        maxDistance: 0.5
      });
      for (const entity of spawnedEntities) {
        const colorComponent = entity.getComponent("minecraft:color");
        if (colorComponent) colorComponent.value = blockColor;
      }
    }
    vfxCache[key] = { vfxType: config.vfxEntity };
    return { key, vfxType: config.vfxEntity };
  }

  let spawnLocation = { ...baseLocation };
  let rotation = 0;

  // Handle variant offsets
  if (config.hasVariants && config.variantOffsets && config.variantState) {
    const variantValue = lightBlock.permutation.getState(config.variantState) || 0;
    const variantOffset = config.variantOffsets[variantValue];
    if (variantOffset) {
      spawnLocation.x += variantOffset.x;
      spawnLocation.y += variantOffset.y;
      spawnLocation.z += variantOffset.z;
    }
  }

  if (config.requiresCardinalRotation) {
    const cardinal = lightBlock.permutation.getState(config.cardinalState) || "south";
    
    if (config.offsetMap) {
      const offset = config.offsetMap[cardinal] || { x: 0, y: 0, z: 0 };
      spawnLocation.x += offset.x;
      spawnLocation.y += offset.y;
      spawnLocation.z += offset.z;
    }
    
    if (config.rotationMap) {
      rotation = config.rotationMap[cardinal] || 0;
    }
  }

  const entity = dimension.spawnEntity(config.vfxEntity, spawnLocation);
  if (entity && rotation !== 0) {
    entity.setRotation({ x: 0, y: rotation });
  }
  
  vfxCache[key] = { vfxType: config.vfxEntity, entity };
  return { key, vfxType: config.vfxEntity, entity };
}

export function destroyLightVfx(dimension, lightData, vfxCache) {
  const config = getLightConfig(lightData.typeId);
  if (!config) return;

  const key = `${lightData.dimensionId}_${lightData.x}_${lightData.y}_${lightData.z}`;
  const storedVfx = vfxCache[key];
  const vfxType = storedVfx?.vfxType || config.vfxEntity;

  let destroyLocation = {
    x: lightData.x + 0.5,
    y: lightData.y + 0.5,
    z: lightData.z + 0.5
  };

  if (config.spawnOffset.y !== 0) {
    destroyLocation.y = lightData.y + config.spawnOffset.y;
  }

  try {
    dimension.runCommand(
      `execute at @e[type=${vfxType}] positioned ${destroyLocation.x} ${destroyLocation.y} ${destroyLocation.z} run event entity @e[r=${config.destroyRadius}] destroy`
    );
  } catch {}

  if (vfxCache[key]) {
    delete vfxCache[key];
  }
}
