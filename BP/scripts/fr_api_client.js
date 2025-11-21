import { system, world } from "@minecraft/server";

let apiLoadChecked = false;

export class FRAPI {
  static registerConnectionType(config, sendError = true) {
    system.run(() => {
      system.sendScriptEvent("fr_api:register_connection", JSON.stringify(config));
    });
  }

  static registerBlockVariants(blockId, variants, sendError = true) {
    system.run(() => {
      system.sendScriptEvent("fr_api:register_variants", JSON.stringify({
        blockId: blockId,
        variants: variants
      }));
    });
  }

  static registerCameraConfig(config, sendError = true) {
    system.run(() => {
      system.sendScriptEvent("fr_api:register_camera", JSON.stringify(config));
    });
  }

  static unregisterConnectionType(blockId) {
    system.run(() => {
      system.sendScriptEvent("fr_api:unregister_connection", blockId);
    });
  }

  static unregisterBlockVariants(blockId) {
    system.run(() => {
      system.sendScriptEvent("fr_api:unregister_variants", blockId);
    });
  }

  static async getSummary() {
    return new Promise(resolve => {
      system.sendScriptEvent("fr_api:get_summary", "");
      
      const event = system.afterEvents.scriptEventReceive.subscribe(data => {
        if (data.id !== "fr_api:summary_response") return;
        
        const summary = JSON.parse(data.message);
        resolve(summary);
        system.afterEvents.scriptEventReceive.unsubscribe(event);
        system.clearRun(timeout);
      });
      
      const timeout = system.runTimeout(() => {
        resolve(null);
        system.afterEvents.scriptEventReceive.unsubscribe(event);
      }, 5);
    });
  }

  static async checkLoaded() {
    let loaded = false;
    
    await new Promise(resolve => {
      system.sendScriptEvent("fr_api:check_loaded", "");
      
      const event = system.afterEvents.scriptEventReceive.subscribe(data => {
        if (data.id !== "fr_api:loaded") return;
        
        loaded = true;
        resolve(resolve);
        system.afterEvents.scriptEventReceive.unsubscribe(event);
        system.clearRun(timeout);
      });
      
      const timeout = system.runTimeout(() => {
        resolve(resolve);
        system.afterEvents.scriptEventReceive.unsubscribe(event);
      }, 20);
    });
    
    return loaded;
  }

  static sendError() {
    console.warn(`[FR Main] FR pack not loaded!`);
    
    system.runTimeout(() => {
      world.sendMessage(`§c[FR Main] The add-on did not load correctly, restart your world`);
    }, 40);
  }
}
