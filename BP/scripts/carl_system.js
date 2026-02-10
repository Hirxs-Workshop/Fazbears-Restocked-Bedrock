import { world, system, EntityDamageCause, GameMode } from "@minecraft/server";

const CARL_TYPE = "fr:carl_the_cupcake";
const clingData = new Map();

// Helper to safely check gamemode
function isCreativeOrSpectator(player) {
    try {
        const gm = player.getGameMode();
        // Convert to string and lowercase for maximum safety (logic adapted from astar_pathfinding.js)
        const gmStr = String(gm).toLowerCase();

        return gmStr === "creative" || gmStr === "spectator" || gmStr === "1" || gmStr === "3";
    } catch (e) {
        return false;
    }
}

system.runInterval(() => {
    for (const dimension of ["overworld", "nether", "the_end"]) {
        let dim;
        try {
            dim = world.getDimension(dimension);
        } catch (e) { continue; }

        const carls = dim.getEntities({ type: CARL_TYPE });

        for (const carl of carls) {
            let isAttached = false;
            try {
                isAttached = carl.getProperty("carl:is_attached") === true;
            } catch (e) { }

            if (isAttached) {
                try {
                    carl.clearVelocity();
                } catch (e) { }

                let data = clingData.get(carl.id);

                // If attached but no data, find who we are attached to (or detach if invalid)
                if (!data) {
                    const players = carl.dimension.getPlayers({
                        location: carl.location,
                        maxDistance: 4
                    });
                    // Strict check on recovery
                    const target = players.find(p =>
                        p.getComponent("minecraft:health")?.currentValue > 0 &&
                        !isCreativeOrSpectator(p)
                    );

                    if (target) {
                        data = { targetId: target.id, lastDamageTick: system.currentTick, hits: 0 };
                        clingData.set(carl.id, data);
                    } else {
                        // console.warn("[Carl] No valid target found for attached Carl, detaching.");
                        carl.triggerEvent("carl:stop_clinging");
                        continue;
                    }
                }

                const target = world.getEntity(data.targetId);

                // Validate Target
                let invalidTarget = !target || target.getComponent("minecraft:health")?.currentValue <= 0 || target.dimension.id !== carl.dimension.id;

                if (!invalidTarget && target.typeId === "minecraft:player") {
                    if (isCreativeOrSpectator(target)) {
                        invalidTarget = true;
                    }
                }

                if (invalidTarget) {
                    carl.triggerEvent("carl:stop_clinging");
                    clingData.delete(carl.id);
                    continue;
                }

                // Clinging Logic (Teleport)
                const viewDir = target.getViewDirection();
                const headLoc = target.getHeadLocation();

                const attachPos = {
                    x: headLoc.x + viewDir.x * 0.75,
                    y: headLoc.y + viewDir.y * 0.75 - 0.2,
                    z: headLoc.z + viewDir.z * 0.75
                };

                try {
                    carl.teleport(attachPos, {
                        rotation: {
                            x: target.getRotation().x,
                            y: target.getRotation().y + 180
                        },
                        checkForBlocks: false,
                        keepVelocity: false
                    });
                } catch (e) {
                    carl.triggerEvent("carl:stop_clinging");
                    clingData.delete(carl.id);
                    continue;
                }

                // Damage Logic
                if (system.currentTick - data.lastDamageTick >= 10) {
                    target.applyDamage(2, {
                        cause: EntityDamageCause.entityAttack,
                        damagingEntity: carl
                    });
                    data.lastDamageTick = system.currentTick;
                    carl.dimension.playSound("attack.cupcake_bite", carl.location, { pitch: 1.2, volume: 0.8 });
                }
            } else {
                // Search for new targets
                const playersNear = carl.dimension.getPlayers({
                    location: carl.location,
                    maxDistance: 3.0
                });

                const validTarget = playersNear.find(p => {
                    const health = p.getComponent("minecraft:health")?.currentValue > 0;
                    if (!health) return false;

                    if (isCreativeOrSpectator(p)) {
                        // console.warn(`[Carl] Ignoring creative player in 3 block radius: ${p.name}`);
                        return false;
                    }
                    return true;
                });

                if (validTarget) {
                    carl.triggerEvent("carl:start_clinging");
                    clingData.set(carl.id, { targetId: validTarget.id, lastDamageTick: system.currentTick, hits: 0 });
                }
            }
        }
    }
}, 2);

world.afterEvents.entityHurt.subscribe((event) => {
    const { damageSource, hurtEntity } = event;
    const attacker = damageSource.damagingEntity;

    // Logic 1: Carl Attacks Player (Initial contact via damage)
    if (attacker?.typeId === CARL_TYPE && hurtEntity.typeId === "minecraft:player") {
        let isAttached = false;
        try {
            isAttached = attacker.getProperty("carl:is_attached");
        } catch (e) { }

        if (isCreativeOrSpectator(hurtEntity)) {
            // console.warn(`[Carl] Hurt event ignored for creative player`);
            return;
        }

        if (!isAttached) {
            attacker.triggerEvent("carl:start_clinging");
            clingData.set(attacker.id, { targetId: hurtEntity.id, lastDamageTick: system.currentTick, hits: 0 });
        }
    }

    // Logic 2: Carl Gets Hit (Knockback Logic)
    if (hurtEntity.typeId === CARL_TYPE) {
        let isAttached = false;
        try {
            isAttached = hurtEntity.getProperty("carl:is_attached");
        } catch (e) { }

        if (isAttached) {
            let data = clingData.get(hurtEntity.id);
            if (!data) return;

            data.hits++;

            hurtEntity.dimension.playSound("random.break", hurtEntity.location, { pitch: 1.5, volume: 0.5 });

            if (data.hits >= 3) {
                const target = world.getEntity(data.targetId);
                if (target) {
                    const viewDir = target.getViewDirection();
                    // Calculate "behind" position relative to player look direction
                    // If player looks North (Z-), -viewDir.z is Positive (South)
                    const safePos = {
                        x: target.location.x - viewDir.x * 3.0,
                        y: target.location.y + 0.1,
                        z: target.location.z - viewDir.z * 3.0
                    };

                    try {
                        hurtEntity.clearVelocity();
                        // 1. Teleport away
                        hurtEntity.teleport(safePos, { keepVelocity: false });

                        // 2. Stop Clinging State
                        hurtEntity.triggerEvent("carl:stop_clinging");

                        // 3. Apply Impulse (Knockback) after a tiny delay to ensure physics are ready
                        system.runTimeout(() => {
                            try {
                                if (hurtEntity.isValid()) {
                                    hurtEntity.clearVelocity();
                                    const impulse = {
                                        x: -viewDir.x * 1.5, // Push backwards from player look
                                        y: 0.5,
                                        z: -viewDir.z * 1.5
                                    };
                                    hurtEntity.applyImpulse(impulse);
                                }
                            } catch (e) { }
                        }, 2);
                    } catch (e) { }
                } else {
                    hurtEntity.triggerEvent("carl:stop_clinging");
                }

                clingData.delete(hurtEntity.id);
                hurtEntity.dimension.playSound("random.orb", hurtEntity.location, { pitch: 0.8 });
            }
        }
    }
});

world.afterEvents.entityDie.subscribe((event) => {
    const { deadEntity } = event;
    if (deadEntity.typeId === CARL_TYPE) {
        clingData.delete(deadEntity.id);
    }
});

world.beforeEvents.entityRemove.subscribe((event) => {
    clingData.delete(event.removedEntity.id);
});
