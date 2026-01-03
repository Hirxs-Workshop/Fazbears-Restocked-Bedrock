import { world } from "@minecraft/server";
import * as FRAPI from "../fr_api.js";

export const LIGHT_TYPES = new Set([
  "fr:office_lamp",
  "fr:supply_room_lightbulb",
  "fr:stage_spotlight",
  "fr:pizzeria_lamp",
  "fr:ceiling_light",
  "fr:office_light",
  "fr:pirate_cove_light"
]);

export const SWITCH_TYPES = new Set([
  "fr:switch"
]);

export const GENERATOR_TYPES = new Set([
  "fr:generator",
  "fr:pizzeria_generator",
  "fr:office_generator",
  "fr:yes"
]);

export const LIGHT_ALIASES = {
  "fr:office_lamp": "Office lamp",
  "fr:supply_room_lightbulb": "Supply room lightbulb",
  "fr:stage_spotlight": "Stage spotlight",
  "fr:pizzeria_lamp": "Pizzeria lamp",
  "fr:ceiling_light": "Ceiling light",
  "fr:office_light": "Office light",
  "fr:pirate_cove_light": "Pirate cove light"
};

export const SWITCH_ALIASES = {
  "fr:switch": "Switch"
};

export const GENERATOR_ALIASES = {
  "fr:generator": "Generator"
};

export const LIGHT_ICONS = {
  "fr:office_lamp": "textures/fr_ui/light_test_icon",
  "fr:supply_room_lightbulb": "textures/fr_ui/light_test_icon",
  "fr:stage_spotlight": "textures/fr_ui/light_test_icon",
  "fr:pizzeria_lamp": "textures/fr_ui/light_test_icon",
  "fr:ceiling_light": "textures/fr_ui/light_test_icon",
  "fr:office_light": "textures/fr_ui/light_test_icon",
  "fr:pirate_cove_light": "textures/fr_ui/light_test_icon"
};

export const SWITCH_ICONS = {
  "fr:switch": "textures/fr_ui/switch_icon"
};

export const GENERATOR_ICONS = {
  "fr:generator": "textures/fr_ui/generator_icon"
};

export const CONNECTIONS_KEY = "electric_system_connections";
export const GENERATORS_KEY = "electric_system_generators";
export const MAX_ENERGY = 500;
export const DEFAULT_CONSUMPTION_RATE = 0.2;
export const CONSUMPTION_MULTIPLIER = 0.1;
export const NEAR_DISTANCE = 64;

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
  if (LIGHT_ALIASES[blockId]) return LIGHT_ALIASES[blockId];
  if (SWITCH_ALIASES[blockId]) return SWITCH_ALIASES[blockId];
  if (GENERATOR_ALIASES[blockId]) return GENERATOR_ALIASES[blockId];
  
  const externalConfig = FRAPI.getConnectionType(blockId);
  if (externalConfig) return externalConfig.alias;
  
  return blockId;
}

export function getBlockIcon(blockId) {
  if (LIGHT_ICONS[blockId]) return LIGHT_ICONS[blockId];
  if (SWITCH_ICONS[blockId]) return SWITCH_ICONS[blockId];
  if (GENERATOR_ICONS[blockId]) return GENERATOR_ICONS[blockId];
  
  const externalConfig = FRAPI.getConnectionType(blockId);
  if (externalConfig) return externalConfig.icon;
  
  return "textures/fr_ui/default_icon";
}

export function isLightType(blockId) {
  if (LIGHT_TYPES.has(blockId)) return true;
  const externalConfig = FRAPI.getConnectionType(blockId);
  return externalConfig && (externalConfig.type === "light" || externalConfig.type === "light_button");
}

export function isSwitchType(blockId) {
  if (SWITCH_TYPES.has(blockId)) return true;
  const externalConfig = FRAPI.getConnectionType(blockId);
  return externalConfig && externalConfig.type === "switch";
}

export function isCameraType(blockId) {
  const externalConfig = FRAPI.getConnectionType(blockId);
  return externalConfig && externalConfig.type === "camera";
}
