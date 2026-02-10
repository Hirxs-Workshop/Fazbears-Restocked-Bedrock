import { system, world } from "@minecraft/server";

let apiLoadChecked = false;

class APIBuilder {
    constructor(blockId) {
        this.config = {
            id: blockId,
            type: "light",
            alias: blockId,
            icon: "textures/fr_ui/default_icon"
        };
    }

    setType(type) {
        this.config.type = type;
        return this;
    }

    setAlias(alias) {
        this.config.alias = alias;
        return this;
    }

    setIcon(iconPath) {
        this.config.icon = iconPath;
        return this;
    }

    asLight() {
        this.config.type = "light";
        return this;
    }

    setVfx(vfxEntity, spawnOffset = { x: 0, y: 0, z: 0 }, destroyRadius = 0.5) {
        this.config.vfxEntity = vfxEntity;
        this.config.spawnOffset = spawnOffset;
        this.config.destroyRadius = destroyRadius;
        return this;
    }

    setPowerState(stateName) {
        this.config.powerState = stateName;
        return this;
    }

    setCardinalRotation(offsetMap, rotationMap) {
        this.config.requiresCardinalRotation = true;
        this.config.cardinalState = "minecraft:cardinal_direction";
        this.config.offsetMap = offsetMap;
        this.config.rotationMap = rotationMap;
        return this;
    }

    setVariants(stateName, offsets) {
        this.config.hasVariants = true;
        this.config.variantState = stateName;
        this.config.variantOffsets = offsets;
        return this;
    }

    asCamera() {
        this.config.type = "camera";
        this.config.blockId = this.config.id;
        return this;
    }

    setCameraProperties(verticalPitch = 0, rotationRange = 85, autoRotate = true) {
        this.config.verticalPitch = verticalPitch;
        this.config.rotationRange = rotationRange;
        this.config.autoRotate = autoRotate;
        return this;
    }

    asGenerator() {
        this.config.type = "generator";
        this.config.blockId = this.config.id;
        return this;
    }

    setGeneratorProperties(capacity = 1000, productionRate = 10) {
        this.config.capacity = capacity;
        this.config.productionRate = productionRate;
        return this;
    }

    setEnergy(capacity) {
        this.config.capacity = capacity;
        return this;
    }

    setConsumePerTick(amount) {
        this.config.consumePerTick = amount;
        return this;
    }

    setConsumePercentage(percentage) {
        this.config.consumePercentage = percentage;
        return this;
    }

    setLinksCapacity(count) {
        this.config.linksCapacity = count;
        return this;
    }

    register() {
        try {
            if (globalThis.frAPI) {
                if (this.config.type === 'camera') {
                    globalThis.frAPI.registerCameraConfig(this.config);
                } else if (this.config.type === 'generator') {
                    globalThis.frAPI.registerGeneratorConfig(this.config);
                } else {
                    globalThis.frAPI.registerConnectionType(this.config);
                }
            } else {
                let eventId = "fr_api:register_connection";
                if (this.config.type === 'camera') {
                    eventId = "fr_api:register_camera";
                } else if (this.config.type === 'generator') {
                    eventId = "fr_api:register_generator";
                }

                system.run(() => {
                    system.sendScriptEvent(eventId, JSON.stringify(this.config));
                });
            }
        } catch (e) {
            console.warn("[APIBuilder] Error registering:", e);
        }
    }
}

export class FRAPI {
    static create(blockId) {
        return new APIBuilder(blockId);
    }

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

    static registerGeneratorConfig(config, sendError = true) {
        system.run(() => {
            system.sendScriptEvent("fr_api:register_generator", JSON.stringify(config));
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
