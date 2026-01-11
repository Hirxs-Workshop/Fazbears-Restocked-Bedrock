/**
/**
 * FAZBEAR'S RESTOCKED - BEDROCK
 * ©2025
 * 
 * Centralized Chunked Storage System
 * Handles reading/writing large data sets that exceed Bedrock's 32KB dynamic property limit.
 * 
 * This module provides a single source of truth for chunked storage operations,
 * preventing bugs from duplicated/inconsistent implementations across files.
 */

import { world } from "@minecraft/server";

const CHUNK_SIZE = 30000;

const memoryCache = new Map();

export function getChunkedData(key) {
  try {
    const chunkCount = world.getDynamicProperty(`${key}_count`);
    if (chunkCount !== undefined && chunkCount > 0) {
      let fullJson = "";
      for (let i = 0; i < chunkCount; i++) {
        const chunk = world.getDynamicProperty(`${key}_${i}`);
        if (chunk) fullJson += chunk;
      }
      const data = JSON.parse(fullJson);
      memoryCache.set(key, data);
      return data;
    }
    
    const json = world.getDynamicProperty(key);
    const data = json ? JSON.parse(json) : [];
    memoryCache.set(key, data);
    return data;
  } catch (error) {
    return memoryCache.get(key) || [];
  }
}

export function setChunkedData(key, data) {
  try {
    const fullJson = JSON.stringify(data);
    
    const chunks = [];
    for (let i = 0; i < fullJson.length; i += CHUNK_SIZE) {
      chunks.push(fullJson.substring(i, i + CHUNK_SIZE));
    }
    
    const oldChunkCount = world.getDynamicProperty(`${key}_count`) || 0;
    
    for (let i = 0; i < chunks.length; i++) {
      world.setDynamicProperty(`${key}_${i}`, chunks[i]);
    }
    
    world.setDynamicProperty(`${key}_count`, chunks.length);
    
    for (let i = chunks.length; i < oldChunkCount; i++) {
      world.setDynamicProperty(`${key}_${i}`, undefined);
    }
    
    if (world.getDynamicProperty(key) !== undefined) {
      world.setDynamicProperty(key, undefined);
    }
    
    memoryCache.set(key, data);
  } catch (error) {
    memoryCache.set(key, data);
  }
}

export function initializeStorage(key) {
  try {
    const chunkCount = world.getDynamicProperty(`${key}_count`);
    const legacyData = world.getDynamicProperty(key);
    
    if ((chunkCount === undefined || chunkCount === 0) && !legacyData) {
      world.setDynamicProperty(key, JSON.stringify([]));
    }
    
    memoryCache.set(key, []);
  } catch (error) {
    memoryCache.set(key, []);
  }
}

export function hasData(key) {
  try {
    const chunkCount = world.getDynamicProperty(`${key}_count`);
    if (chunkCount !== undefined && chunkCount > 0) {
      return true;
    }
    const json = world.getDynamicProperty(key);
    return json !== undefined && json !== null && json !== "[]";
  } catch {
    return memoryCache.has(key) && memoryCache.get(key).length > 0;
  }
}

export function clearStorage(key) {
  try {
    const chunkCount = world.getDynamicProperty(`${key}_count`) || 0;
    
    for (let i = 0; i < chunkCount; i++) {
      world.setDynamicProperty(`${key}_${i}`, undefined);
    }
    
    world.setDynamicProperty(`${key}_count`, undefined);
    world.setDynamicProperty(key, undefined);
    
    memoryCache.delete(key);
  } catch {
    memoryCache.delete(key);
  }
}

export const STORAGE_KEYS = {
  DOOR_BUTTON_CONNECTIONS: "connections",
  SWITCH_CONNECTIONS: "electric_system_connections",
  GENERATORS: "electric_system_generators",
  DOOR_BUTTON_GENERATOR_LINKS: "door_button_generator_links",
  WOODEN_DOOR_CLAIMS: "woodenDoorClaims"
};
