

import { world } from "@minecraft/server";


export const SelectionType = {
  SWITCH: "switch",
  GENERATOR: "generator",
  DOOR_BUTTON_LIGHT: "door_button_light",
  DOOR_BUTTON_DOOR: "door_button_door",
  CAMERA: "camera"
};


const playerSelections = new Map();


const externalCleanupHandlers = new Map();


export function registerCleanupHandler(type, handler) {
  externalCleanupHandlers.set(type, handler);
}


export function setSelection(playerId, type, data, onClearPrevious = null) {
  const previous = playerSelections.get(playerId);


  if (previous && previous.type !== type) {

    const cleanupHandler = externalCleanupHandlers.get(previous.type);
    if (cleanupHandler) {
      try {
        cleanupHandler(playerId, previous.data);
      } catch (e) { }
    }


    if (onClearPrevious) {
      onClearPrevious(previous);
    }


    if (previous.type === SelectionType.SWITCH || previous.type === SelectionType.GENERATOR) {
      try {
        if (previous.data && previous.data.pos) {
          const oldDim = world.getDimension(previous.data.pos.dimensionId);
          oldDim.runCommand(`execute at @e[type=fr:selection] positioned ${previous.data.pos.x} ${previous.data.pos.y} ${previous.data.pos.z} run event entity @e[r=1] destroy`);
        }
      } catch { }
    }
  }

  playerSelections.set(playerId, { type, data, timestamp: Date.now() });
}


export function getSelection(playerId) {
  return playerSelections.get(playerId) || null;
}


export function clearSelection(playerId) {
  const previous = playerSelections.get(playerId);
  if (previous) {
    const cleanupHandler = externalCleanupHandlers.get(previous.type);
    if (cleanupHandler) {
      try {
        cleanupHandler(playerId, previous.data);
      } catch (e) { }
    }

    if (previous.type === SelectionType.SWITCH || previous.type === SelectionType.GENERATOR) {
      try {
        if (previous.data && previous.data.pos) {
          const oldDim = world.getDimension(previous.data.pos.dimensionId);
          oldDim.runCommand(`execute at @e[type=fr:selection] positioned ${previous.data.pos.x} ${previous.data.pos.y} ${previous.data.pos.z} run event entity @e[r=1] destroy`);
        }
      } catch { }
    }
  }
  playerSelections.delete(playerId);
}


export function hasSelectionOfType(playerId, types) {
  const selection = playerSelections.get(playerId);
  if (!selection) return false;

  if (Array.isArray(types)) {
    return types.includes(selection.type);
  }
  return selection.type === types;
}


export function clearAllSelections() {
  playerSelections.clear();
}


const clearCallbacks = new Map();


export function onSelectionCleared(type, callback) {
  if (!clearCallbacks.has(type)) {
    clearCallbacks.set(type, []);
  }
  clearCallbacks.get(type).push(callback);
}


export function clearSelectionWithCallback(playerId) {
  const selection = playerSelections.get(playerId);
  if (selection) {
    const callbacks = clearCallbacks.get(selection.type) || [];
    for (const callback of callbacks) {
      try {
        callback(playerId, selection.data);
      } catch (e) {
        console.warn(`Error in selection clear callback: ${e}`);
      }
    }
    playerSelections.delete(playerId);
  }
}
