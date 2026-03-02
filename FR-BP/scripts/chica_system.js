import { world, system } from "@minecraft/server";

const CHICA_TYPE = "fr:fnaf1_chica_entity";
const CARL_TYPE = "fr:carl_the_cupcake";

const activeCupcakes = new Map();

const deployStates = new Map();

system.runInterval(() => {
    for (const dimension of ["overworld", "nether", "the_end"]) {
        let dim;
        try {
            dim = world.getDimension(dimension);
        } catch (e) { continue; }

        const chicas = dim.getEntities({ type: CHICA_TYPE });

        for (const chica of chicas) {
            let hasCupcake = true;
            const linkedCarlId = activeCupcakes.get(chica.id);

            if (linkedCarlId) {
                hasCupcake = false;
            } else {
                try {
                    hasCupcake = !chica.hasTag("chica_no_cupcake");
                } catch (e) { continue; }
            }

            if (hasCupcake) {
                if (activeCupcakes.has(chica.id)) activeCupcakes.delete(chica.id);

                if (!deployStates.has(chica.id)) {
                    const playersNear = chica.dimension.getPlayers({ location: chica.location, maxDistance: 20 });
                    const target = playersNear.find(p => {
                        const dist = Math.sqrt(
                            Math.pow(p.location.x - chica.location.x, 2) +
                            Math.pow(p.location.z - chica.location.z, 2)
                        );
                        return dist > 8 && p.getComponent("minecraft:health")?.currentValue > 0;
                    });

                    if (target) {
                        if (Math.random() < 0.02) {
                            chica.triggerEvent("chica:deploy_cupcake");
                            deployStates.set(chica.id, { startTick: system.currentTick, isDeploying: true });
                        }
                    }
                } else {
                    const state = deployStates.get(chica.id);
                    if (system.currentTick - state.startTick >= 60) {
                        const viewDir = chica.getViewDirection();
                        const spawnPos = {
                            x: chica.location.x + viewDir.x * 1.5,
                            y: chica.location.y + 0.5,
                            z: chica.location.z + viewDir.z * 1.5
                        };

                        try {
                            const carl = chica.dimension.spawnEntity(CARL_TYPE, spawnPos);

                            activeCupcakes.set(chica.id, carl.id);

                            chica.triggerEvent("chica:finish_deploy");

                        } catch (e) {
                            chica.triggerEvent("chica:abort_deploy");
                        }

                        deployStates.delete(chica.id);
                    }
                }
            }
            else {
                const carlId = activeCupcakes.get(chica.id);

                if (!carlId) {
                    if (Math.random() < 0.05) chica.triggerEvent("chica:pickup_cupcake");
                    continue;
                }

                const carl = world.getEntity(carlId);

                if (!carl || (typeof carl.isValid === 'function' && !carl.isValid())) {
                    activeCupcakes.delete(chica.id);
                    chica.triggerEvent("chica:pickup_cupcake");
                    continue;
                }

                if (!chica.hasTag("chica_no_cupcake")) {
                    chica.triggerEvent("chica:finish_deploy");
                }

                const playersNearCarl = carl.dimension.getPlayers({ location: carl.location, maxDistance: 15 });
                const playersNearChica = chica.dimension.getPlayers({ location: chica.location, maxDistance: 15 });

                if (playersNearCarl.length === 0 && playersNearChica.length === 0) {

                    const distToChica = Math.sqrt(
                        Math.pow(carl.location.x - chica.location.x, 2) +
                        Math.pow(carl.location.z - chica.location.z, 2)
                    );

                    if (distToChica < 2.0) {
                        chica.triggerEvent("chica:pickup_cupcake");
                        carl.remove();
                        activeCupcakes.delete(chica.id);
                    } else {
                        const moveSpeed = 0.4;
                        if (distToChica > 0) {
                            const dx = chica.location.x - carl.location.x;
                            const dz = chica.location.z - carl.location.z;

                            const newPos = {
                                x: carl.location.x + (dx / distToChica) * moveSpeed,
                                y: carl.location.y,
                                z: carl.location.z + (dz / distToChica) * moveSpeed
                            };
                            carl.teleport(newPos, { facingLocation: chica.location });
                        }
                    }
                }
            }
        }
    }
}, 5);
