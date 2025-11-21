import { world } from "@minecraft/server";
import * as FRAPI from "../fr_api.js";

// ===========================
// TIPOS NATIVOS DEL ADDON
// ===========================

export const LIGHT_TYPES = new Set([
  "fr:office_lamp",
  "fr:supply_room_lightbulb",
  "fr:stage_spotlight"
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
  "fr:stage_spotlight": "Stage spotlight"
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
  "fr:stage_spotlight": "textures/fr_ui/light_test_icon"
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

// ===========================
// FUNCIONES DE INTEGRACIÓN CON API
// ===========================

/**
 * Obtiene todos los tipos de luz (nativos + externos)
 * @returns {Set<string>}
 */
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

/**
 * Obtiene todos los tipos de switch (nativos + externos)
 * @returns {Set<string>}
 */
export function getAllSwitchTypes() {
  const allTypes = new Set(SWITCH_TYPES);
  const externalTypes = FRAPI.getConnectionTypesByCategory("switch");
  for (const config of externalTypes) {
    allTypes.add(config.id);
  }
  return allTypes;
}

/**
 * Obtiene el alias de un bloque (nativo o externo)
 * @param {string} blockId
 * @returns {string}
 */
export function getBlockAlias(blockId) {
  // Primero buscar en nativos
  if (LIGHT_ALIASES[blockId]) return LIGHT_ALIASES[blockId];
  if (SWITCH_ALIASES[blockId]) return SWITCH_ALIASES[blockId];
  if (GENERATOR_ALIASES[blockId]) return GENERATOR_ALIASES[blockId];
  
  // Buscar en externos
  const externalConfig = FRAPI.getConnectionType(blockId);
  if (externalConfig) return externalConfig.alias;
  
  return blockId;
}

/**
 * Obtiene el icono de un bloque (nativo o externo)
 * @param {string} blockId
 * @returns {string}
 */
export function getBlockIcon(blockId) {
  // Primero buscar en nativos
  if (LIGHT_ICONS[blockId]) return LIGHT_ICONS[blockId];
  if (SWITCH_ICONS[blockId]) return SWITCH_ICONS[blockId];
  if (GENERATOR_ICONS[blockId]) return GENERATOR_ICONS[blockId];
  
  // Buscar en externos
  const externalConfig = FRAPI.getConnectionType(blockId);
  if (externalConfig) return externalConfig.icon;
  
  return "textures/fr_ui/default_icon";
}

/**
 * Verifica si un bloque es de tipo luz (nativo o externo)
 * @param {string} blockId
 * @returns {boolean}
 */
export function isLightType(blockId) {
  if (LIGHT_TYPES.has(blockId)) return true;
  const externalConfig = FRAPI.getConnectionType(blockId);
  return externalConfig && (externalConfig.type === "light" || externalConfig.type === "light_button");
}

/**
 * Verifica si un bloque es de tipo switch (nativo o externo)
 * @param {string} blockId
 * @returns {boolean}
 */
export function isSwitchType(blockId) {
  if (SWITCH_TYPES.has(blockId)) return true;
  const externalConfig = FRAPI.getConnectionType(blockId);
  return externalConfig && externalConfig.type === "switch";
}

/**
 * Verifica si un bloque es de tipo cámara (solo externos, ya que las nativas se manejan aparte)
 * @param {string} blockId
 * @returns {boolean}
 */
export function isCameraType(blockId) {
  const externalConfig = FRAPI.getConnectionType(blockId);
  return externalConfig && externalConfig.type === "camera";
}
