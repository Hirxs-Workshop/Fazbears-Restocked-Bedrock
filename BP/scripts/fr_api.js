const EXTERNAL_CONNECTION_TYPES = new Map();

const EXTERNAL_BLOCK_VARIANTS = new Map();

const EXTERNAL_CAMERA_CONFIGS = new Map();

export function registerConnectionType(config) {
  try {
    if (!config || !config.id || !config.type || !config.alias) {
      console.warn("[FR API] registerConnectionType: Missing required fields");
      return false;
    }

    const validTypes = ["light", "light_button", "camera", "switch"];
    if (!validTypes.includes(config.type)) {
      console.warn(`[FR API] Invalid type "${config.type}"`);
      return false;
    }

    EXTERNAL_CONNECTION_TYPES.set(config.id, {
      id: config.id,
      type: config.type,
      alias: config.alias,
      icon: config.icon || "textures/fr_ui/default_icon",
      requiredStates: config.requiredStates || [],
      metadata: config.metadata || {}
    });

    return true;
  } catch (error) {
    console.error("[FR API] Error registering connection type:", error);
    return false;
  }
}

export function getConnectionTypes() {
  return new Map(EXTERNAL_CONNECTION_TYPES);
}

export function getConnectionType(blockId) {
  return EXTERNAL_CONNECTION_TYPES.get(blockId) || null;
}

export function getConnectionTypesByCategory(type) {
  const results = [];
  for (const [id, config] of EXTERNAL_CONNECTION_TYPES.entries()) {
    if (config.type === type) {
      results.push(config);
    }
  }
  return results;
}

export function registerBlockVariants(blockId, variants) {
  try {
    if (!blockId || !Array.isArray(variants)) {
      console.warn("[FR API] registerBlockVariants: Invalid parameters");
      return false;
    }

    const validColors = ["yellow", "gray", "blue", "green", "red", "purple", "cyan", "orange"];
    
    const processedVariants = [];
    
    for (let i = 0; i < variants.length; i++) {
      const variant = variants[i];
      
      if (!variant.label || !variant.icon || !variant.color) {
        console.warn(`[FR API] registerBlockVariants: Variant ${i} missing required fields (label, icon, color)`);
        return false;
      }
      
      if (!validColors.includes(variant.color)) {
        console.warn(`[FR API] registerBlockVariants: Invalid color "${variant.color}". Valid colors: ${validColors.join(", ")}`);
        return false;
      }
      
      const index = variant.variant !== undefined ? variant.variant : i;
      
      if (index < 0 || index > 15) {
        console.warn(`[FR API] registerBlockVariants: Variant index ${index} out of range (0-15)`);
        return false;
      }
      
      processedVariants[index] = {
        label: variant.label,
        icon: variant.icon,
        color: variant.color
      };
    }

    EXTERNAL_BLOCK_VARIANTS.set(blockId, {
      blockId,
      variants: processedVariants
    });

    return true;
  } catch (error) {
    console.error("[FR API] Error registering block variants:", error);
    return false;
  }
}

export function getBlockVariants(blockId) {
  const config = EXTERNAL_BLOCK_VARIANTS.get(blockId);
  return config ? config.variants : null;
}

export function getAllBlockVariants() {
  return new Map(EXTERNAL_BLOCK_VARIANTS);
}

export function registerCameraConfig(config) {
  try {
    if (!config || !config.blockId) {
      console.warn("[FR API] registerCameraConfig: Missing blockId");
      return false;
    }

    const cameraConfig = {
      blockId: config.blockId,
      verticalPitch: config.verticalPitch ?? 0,
      rotationRange: config.rotationRange ?? 85,
      autoRotate: config.autoRotate ?? true,
      autoRotateSpeed: config.autoRotateSpeed ?? 0.8,
      alias: config.alias || config.blockId,
      icon: config.icon || "textures/fr_ui/security_camera_icon"
    };

    EXTERNAL_CAMERA_CONFIGS.set(config.blockId, cameraConfig);

    if (!EXTERNAL_CONNECTION_TYPES.has(config.blockId)) {
      const connectionType = {
        id: config.blockId,
        type: "camera",
        alias: cameraConfig.alias,
        icon: cameraConfig.icon,
        requiredStates: config.requiredStates || ["fr:rotation"]
      };
      EXTERNAL_CONNECTION_TYPES.set(config.blockId, connectionType);
    }

    return true;
  } catch (error) {
    console.error("[FR API] Error registering camera config:", error);
    return false;
  }
}

export function getCameraConfig(blockId) {
  return EXTERNAL_CAMERA_CONFIGS.get(blockId) || null;
}

export function getAllCameraConfigs() {
  return new Map(EXTERNAL_CAMERA_CONFIGS);
}

export function unregisterConnectionType(blockId) {
  return EXTERNAL_CONNECTION_TYPES.delete(blockId);
}

export function unregisterBlockVariants(blockId) {
  return EXTERNAL_BLOCK_VARIANTS.delete(blockId);
}

export function unregisterCameraConfig(blockId) {
  return EXTERNAL_CAMERA_CONFIGS.delete(blockId);
}

export function clearAllRegistrations() {
  EXTERNAL_CONNECTION_TYPES.clear();
  EXTERNAL_BLOCK_VARIANTS.clear();
  EXTERNAL_CAMERA_CONFIGS.clear();
}

export function getRegistrationSummary() {
  return {
    connectionTypes: EXTERNAL_CONNECTION_TYPES.size,
    blockVariants: EXTERNAL_BLOCK_VARIANTS.size,
    cameraConfigs: EXTERNAL_CAMERA_CONFIGS.size,
    details: {
      connectionTypes: Array.from(EXTERNAL_CONNECTION_TYPES.keys()),
      blockVariants: Array.from(EXTERNAL_BLOCK_VARIANTS.keys()),
      cameraConfigs: Array.from(EXTERNAL_CAMERA_CONFIGS.keys())
    }
  };
}

import { world, system } from "@minecraft/server";

function exposeAPIGlobally() {
  try {
    if (!globalThis.frAPI) {
      globalThis.frAPI = {
        registerConnectionType,
        getConnectionTypes,
        getConnectionType,
        getConnectionTypesByCategory,
        unregisterConnectionType,
        
        registerBlockVariants,
        getBlockVariants,
        getAllBlockVariants,
        unregisterBlockVariants,
        
        registerCameraConfig,
        getCameraConfig,
        getAllCameraConfigs,
        unregisterCameraConfig,
        
        clearAllRegistrations,
        getRegistrationSummary,
        
        version: "1.0.0",
        loaded: true
      };
      
    }
    
    try {
      world.setDynamicProperty("fr_api_available", true);
      world.setDynamicProperty("fr_api_version", "1.0.0");
    } catch (e) {
    }
  } catch (error) {
  }
}

exposeAPIGlobally();
system.runTimeout(() => {
  if (!globalThis.frAPI) exposeAPIGlobally();
}, 1);

function initializeScriptEventListeners() {
  
  system.afterEvents.scriptEventReceive.subscribe(event => {
    const { id, message } = event;
    
    try {
      if (id === "fr_api:check_loaded") {
        system.sendScriptEvent("fr_api:loaded", "1.0.0");
        return;
      }
      
      if (id === "fr_api:register_connection") {
        const data = JSON.parse(message);
        registerConnectionType(data);
        return;
      }
      
      if (id === "fr_api:register_variants") {
        const data = JSON.parse(message);
        registerBlockVariants(data.blockId, data.variants);
        return;
      }
      
      if (id === "fr_api:register_camera") {
        const data = JSON.parse(message);
        registerCameraConfig(data);
        return;
      }
      
      if (id === "fr_api:get_summary") {
        const summary = getRegistrationSummary();
        system.sendScriptEvent("fr_api:summary_response", JSON.stringify(summary));
        return;
      }
      
      if (id === "fr_api:unregister_connection") {
        unregisterConnectionType(message);
        return;
      }
      
      if (id === "fr_api:unregister_variants") {
        unregisterBlockVariants(message);
        return;
      }
      
    } catch (error) {
      console.error(`[FR API] Error procesando evento ${id}:`, error);
    }
  });
}

system.runTimeout(() => {
  initializeScriptEventListeners();
}, 2);

export default {
  registerConnectionType,
  getConnectionTypes,
  getConnectionType,
  getConnectionTypesByCategory,
  unregisterConnectionType,
  registerBlockVariants,
  getBlockVariants,
  getAllBlockVariants,
  unregisterBlockVariants,
  registerCameraConfig,
  getCameraConfig,
  getAllCameraConfigs,
  unregisterCameraConfig,
  clearAllRegistrations,
  getRegistrationSummary
};
