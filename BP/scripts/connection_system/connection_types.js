import { world } from "@minecraft/server";

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
