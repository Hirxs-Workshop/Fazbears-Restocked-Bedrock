/**
 * FAZBEAR'S RESTOCKED - BEDROCK
 * ©2025
 * 
 * If you want to modify or use this system as a base, contact the code developer, 
 * Hyrxs (discord: hyrxs), for more information and authorization
 * 
 * DO NOT COPY OR STEAL, ty :>ㅤ ㅤ ㅤ ㅤ ㅤ ㅤ ㅤ ㅤ 
 *  
*/



import { world, BlockPermutation, ItemStack, system, EquipmentSlot, Direction } from '@minecraft/server'
import { ActionFormData, uiManager } from '@minecraft/server-ui'

import * as FRAPI from './fr_api.js'
export { FRAPI }
import "connectables/double_block_connection"
import "connectables/triple_block_connection"

import 'office_desk_reworked'
import 'entrance_door'
import 'paper_block_component'
import 'connectables/table_connection'
import 'connectables/door_frame_connection'
import 'connection_system/main_system'

import 'camera_system/security_camera_system'
import 'variant_system'
import 'backstage_shelf_head_system'
import 'custom_commands'
import 'updateBlock'
import 'faz_tab_system'
import 'advanced_wall'
import 'text_particle_system'

import {
    adjustTextLength, dynamicToast, ACTIONBAR_CUSTOM_STYLE, customActionbar,
    getPreciseRotation, yawFromFacing, FACING_YAW, safeRun, safeGet,
    resetPlayerState, getHeldItem, isCreativeMode, toast
} from './utils.js'
import { securityCameraSystem } from './camera_system/security_camera_system.js'
import { initStatueEditorSystem } from './statue_editor.js'

const experimentalWarningShown = new Set();

function checkExperimentalFeatures(player) {
    if (experimentalWarningShown.has(player.id)) return;

    try {
        const testBlock = BlockPermutation.resolve("fr:restroom_stall");

        const hasCustomState = testBlock.getState("fr:block_bit");

        if (hasCustomState === undefined) {
            throw new Error("Experimental features not enabled");
        }
        return;
    } catch {
        experimentalWarningShown.add(player.id);
        system.runTimeout(() => {
            showExperimentalWarning(player);
        }, 20);
    }
}

function showExperimentalWarning(player) {
    const form = new ActionFormData()
        .title("§e§x§p§w§a§r§n")
        .body("")
        .button("bt:g_CONTINUE")
        .button("bt:x_X");

    form.show(player).then((res) => {
    }).catch((err) => {
        system.runTimeout(() => {
            showExperimentalWarning(player);
        }, 60);
    });
}

world.afterEvents.playerSpawn.subscribe((event) => {
    const { player, initialSpawn } = event;
    if (initialSpawn) {
        system.runTimeout(() => {
            checkExperimentalFeatures(player);
        }, 100);
    }
});

const makeRotationComponent = (faceCheck, stateKey) => ({
    beforeOnPlayerPlace(event) {
        const { player } = event;
        if (!player) return;
        const blockFace = event.permutationToPlace.getState("minecraft:block_face");
        if (blockFace !== faceCheck) return;
        const rotation = getPreciseRotation(player.getRotation().y);
        event.permutationToPlace = event.permutationToPlace.withState(stateKey, rotation);
    },
});

system.beforeEvents.startup.subscribe(({ blockComponentRegistry }) => {
    blockComponentRegistry.registerCustomComponent(
        "fr:precise_rotation",
        makeRotationComponent("up", "fr:rotation")
    );
});

system.beforeEvents.startup.subscribe(({ blockComponentRegistry }) => {
    blockComponentRegistry.registerCustomComponent(
        "fr:down_precise_rotation",
        makeRotationComponent("down", "fr:rotation")
    );
});

const AdvancedRotationComponent = {
    beforeOnPlayerPlace(event) {
        const { player } = event;
        if (!player) return;
        const blockFace = event.permutationToPlace.getState("minecraft:block_face");
        if (blockFace !== "up") return;
        const rotation = getPreciseRotation(player.getRotation().y);
        try {
            event.permutationToPlace = event.permutationToPlace.withState("fr:advanced_rot", rotation);
        } catch { }
    },
};

const AdvancedRotationDownComponent = {
    beforeOnPlayerPlace(event) {
        const { player } = event;
        if (!player) return;
        const blockFace = event.permutationToPlace.getState("minecraft:block_face");
        if (blockFace !== "down") return;
        const rotation = getPreciseRotation(player.getRotation().y);
        try {
            event.permutationToPlace = event.permutationToPlace.withState("fr:advanced_rot", rotation);
        } catch { }
    },
};

system.beforeEvents.startup.subscribe(({ blockComponentRegistry }) => {
    blockComponentRegistry.registerCustomComponent("fr:advanced_rotation", AdvancedRotationComponent);
    blockComponentRegistry.registerCustomComponent("fr:advanced_rotation_down", AdvancedRotationDownComponent);
});

world.afterEvents.playerBreakBlock.subscribe((e) => {
    try {
        const { block, brokenBlockPermutation } = e;
        const id = brokenBlockPermutation?.type?.id;
        if (id !== 'fr:gray_locker' && id !== 'fr:gray_locker_upper') return;
        const dim = block.dimension;
        const loc = block.location;
        const air = BlockPermutation.resolve('minecraft:air');


        let baseLoc = loc;
        if (id === 'fr:gray_locker_upper') {
            baseLoc = { x: loc.x, y: loc.y - 1, z: loc.z };
        }


        for (const [pid, data] of lockerHideState) {
            if (data.baseLoc.x === baseLoc.x && data.baseLoc.y === baseLoc.y && data.baseLoc.z === baseLoc.z) {
                const hiddenPlayer = world.getAllPlayers().find(p => p.id === pid);
                if (hiddenPlayer) {
                    try { hiddenPlayer.teleport(data.exitPos, { dimension: dim, keepVelocity: false }); } catch { }
                    try { hiddenPlayer.runCommand('hud @s reset'); } catch { }
                    try { hiddenPlayer.runCommand('effect @s clear'); } catch { }
                    try { hiddenPlayer.runCommand('title @s title bar:0'); } catch { }
                    try { uiManager.closeAllForms(hiddenPlayer); } catch { }
                }
                lockerHideState.delete(pid);
            }
        }

        if (id === 'fr:gray_locker') {
            system.run(() => {
                try {
                    const above = dim.getBlock({ x: loc.x, y: loc.y + 1, z: loc.z });
                    if (above && above.typeId === 'fr:gray_locker_upper') above.setPermutation(air);
                } catch { }
            });
            try { clearLockerOwner(block); } catch { }
            try { const ent = findLockerInventoryEntity(block); if (ent) ent.kill?.(); } catch { }
        } else {
            system.run(() => {
                try {
                    const below = dim.getBlock({ x: loc.x, y: loc.y - 1, z: loc.z });
                    if (below && below.typeId === 'fr:gray_locker') below.setPermutation(air);
                } catch { }
            });
            try {
                const base = dim.getBlock({ x: loc.x, y: loc.y - 1, z: loc.z });
                clearLockerOwner(base);
                const ent = findLockerInventoryEntity(base);
                if (ent) ent.kill?.();
            } catch { }
        }
    } catch { }
});

function yawFromFacing(block) {
    try {
        const f = block.permutation.getState('minecraft:cardinal_direction');
        if (f === 'north') return 180;
        if (f === 'south') return 0;
        if (f === 'east') return 270;
        if (f === 'west') return 90;
    } catch { }
    return 0;
}

function showLockerHideMenu(player, base, pid) {
    try {
        const data = lockerHideState.get(pid);
        if (!data) return;

        let isCreative = false;
        try { isCreative = player.getGameMode?.() === 'creative'; } catch { }

        const form = new ActionFormData();
        form.title('§H§I§D§E§N');
        form.body('');
        form.button(' ');
        form.show(player).then((res) => {
            try {
                const data = lockerHideState.get(pid);
                if (!data) return;

                let isCreativeNow = false;
                try { isCreativeNow = player.getGameMode?.() === 'creative'; } catch { }
                const canExit = isCreativeNow || (data.oxygen ?? 50) > 10;

                if (!canExit) {

                    system.run(() => showLockerLockedMenu(player, base, pid));
                    return;
                }

                const dim = player.dimension;
                try { player.teleport(data.exitPos, { dimension: dim, keepVelocity: false }); } catch { }
                try { player.runCommand('hud @s reset'); } catch { }
                try { player.runCommand('effect @s clear'); } catch { }
                try { player.runCommand('title @s title bar:0'); } catch { }
                setLockerState(base, 'open');
                lockerHideState.delete(pid);
                if (data) data.uiState = 'exited';
            } catch { }
        });
    } catch { }
}

function showLockerLockedMenu(player, base, pid) {
    try {
        const data = lockerHideState.get(pid);
        if (!data) return;

        const form = new ActionFormData();
        form.title('§L§O§C§K');
        form.body('');
        form.button(' ');
        form.show(player).then((res) => {
            try {
                const data = lockerHideState.get(pid);
                if (!data) return;

                system.run(() => showLockerLockedMenu(player, base, pid));
            } catch { }
        });
    } catch { }
}


const DYE_TO_COLOR = {
    "minecraft:white_dye": 0,
    "minecraft:orange_dye": 1,
    "minecraft:magenta_dye": 2,
    "minecraft:light_blue_dye": 3,
    "minecraft:yellow_dye": 4,
    "minecraft:lime_dye": 5,
    "minecraft:pink_dye": 6,
    "minecraft:gray_dye": 7,
    "minecraft:light_gray_dye": 8,
    "minecraft:cyan_dye": 9,
    "minecraft:purple_dye": 10,
    "minecraft:blue_dye": 11,
    "minecraft:brown_dye": 12,
    "minecraft:green_dye": 13,
    "minecraft:red_dye": 14,
    "minecraft:black_dye": 15
};

system.beforeEvents.startup.subscribe(({ blockComponentRegistry }) => {
    blockComponentRegistry.registerCustomComponent("fr:single_interactive", {
        beforeOnPlayerPlace(event) {
            const { player } = event;
            if (!player) return;

            const playerYRotation = player.getRotation().y;
            const blockTypeId = event.permutationToPlace?.type?.id;

            let permutation = event.permutationToPlace;

            if (blockTypeId === "fr:ceiling_stars" || blockTypeId === "fr:ceiling_wires") {
                const normalizedYaw = ((playerYRotation % 360) + 360) % 360;
                const octant = Math.round(normalizedYaw / 45) % 8;
                const typeState = (octant % 2 === 0) ? "plus" : "cross";
                try { permutation = permutation.withState("fr:type", typeState); } catch { }
            }

            event.permutationToPlace = permutation;
        },
        onPlayerInteract: e => {
            const { player, block } = e;
            if (!player || !block) return;

            if (block.typeId === "fr:stage_spotlight") {
                try {
                    const equip = player.getComponent("minecraft:equippable");
                    const heldItem = equip?.getEquipment(EquipmentSlot.Mainhand);
                    if (heldItem && DYE_TO_COLOR[heldItem.typeId] !== undefined) {
                        const colorValue = DYE_TO_COLOR[heldItem.typeId];
                        const newPerm = block.permutation.withState("fr:color", colorValue);
                        block.setPermutation(newPerm);
                        player.playSound("dye.use");

                        const isLit = block.permutation.getState("fr:lit");
                        if (isLit) {
                            const loc = block.location;
                            const dim = block.dimension;
                            const vfxEntities = dim.getEntities({
                                type: "fr:stage_spotlight_vfx",
                                location: { x: loc.x + 0.5, y: loc.y, z: loc.z + 0.5 },
                                maxDistance: 1.0
                            });
                            for (const vfx of vfxEntities) {
                                const colorComp = vfx.getComponent("minecraft:color");
                                if (colorComp) colorComp.value = colorValue;
                            }
                        }
                    }
                } catch { }
            }
        }
    });
});

let lockerTickInterval = null;
function startLockerTick() {
    if (lockerTickInterval !== null) return;
    lockerTickInterval = system.runInterval(() => {
        if (lockerHideState.size === 0) {
            if (lockerTickInterval !== null) {
                system.clearRun(lockerTickInterval);
                lockerTickInterval = null;
            }
            return;
        }
        for (const [pid, data] of lockerHideState) {
            const player = world.getAllPlayers().find(p => p.id === pid);
            if (!player) { lockerHideState.delete(pid); continue; }

            let dim;
            try { dim = player.dimension; } catch { }
            if (!dim) { lockerHideState.delete(pid); continue; }

            const base = dim.getBlock({ x: data.baseLoc.x, y: data.baseLoc.y, z: data.baseLoc.z });
            if (!base || (base.typeId !== 'fr:gray_locker')) { lockerHideState.delete(pid); continue; }

            let isCreative = false;
            try { isCreative = player.getGameMode?.() === 'creative'; } catch { }

            const nowSneak = player.isSneaking;

            const canExit = isCreative || (data.oxygen ?? 50) > 10;
            if (nowSneak && !data.lastSneak && canExit) {
                try { player.teleport(data.exitPos, { dimension: dim, keepVelocity: false }); } catch { }
                try { player.runCommand('hud @s reset'); } catch { }
                try { player.runCommand('effect @s clear'); } catch { }
                try { player.runCommand('title @s title bar:0'); } catch { }
                try { uiManager.closeAllForms(player); } catch { }
                setLockerState(base, 'open');
                data.uiState = 'exited';
                lockerHideState.delete(pid);
                continue;
            }

            try {
                player.teleport(data.insidePos, { dimension: dim, keepVelocity: false });
                player.setVelocity({ x: 0, y: 0, z: 0 });
            } catch { }

            if (!isCreative) {

                try {
                    data.oxyTick = (data.oxyTick ?? 0) + 1;
                    if (data.oxyTick >= 20) {
                        data.oxyTick = 0;
                        const prevOxygen = data.oxygen ?? 50;
                        data.oxygen = Math.max(0, prevOxygen - 1);
                        player.runCommand(`title @s title bar:${data.oxygen}`);

                        if (data.oxygen === 10 && prevOxygen === 11 && data.uiState === 'normal') {
                            try {
                                uiManager.closeAllForms(player);
                                data.uiState = 'locked';
                                system.run(() => showLockerLockedMenu(player, base, pid));
                            } catch { }
                        }

                        if (data.oxygen === 1 && data.uiState === 'locked') {
                            try {
                                uiManager.closeAllForms(player);
                                data.uiState = 'closed';
                            } catch { }
                        }

                        if (data.oxygen <= 10 && data.oxygen > 0) {
                            try { player.runCommand('effect @s blindness 2 0 true'); } catch { }
                        }

                        if (data.oxygen === 0) {
                            try { player.kill(); } catch { }
                            try { player.runCommand('hud @s reset'); } catch { }
                            try { player.runCommand('effect @s clear'); } catch { }
                            try { player.runCommand('title @s title bar:0'); } catch { }
                            try { uiManager.closeAllForms(player); } catch { }
                            setLockerState(base, 'open');
                            data.uiState = 'dead';
                            lockerHideState.delete(pid);
                            continue;
                        }
                    }
                } catch { }
            } else {

                try { player.runCommand('title @s title bar:0'); } catch { }
            }

            data.lastSneak = nowSneak;
        }
    }, 1);
}

function ensureLockerTick() {
    if (lockerHideState.size > 0) startLockerTick();
}

system.beforeEvents.startup.subscribe(({ blockComponentRegistry }) => {
    blockComponentRegistry.registerCustomComponent("fr:switch", {
        onPlayerInteract: e => {
            const { block } = e;
            if (!block) return;
            try {
                const current = block.permutation.getState('fr:switch_type') === true;
                const newPerm = block.permutation.withState('fr:switch_type', !current);
                block.setPermutation(newPerm);
            } catch { }
        }
    });
});

system.beforeEvents.startup.subscribe(({ blockComponentRegistry }) => {
    blockComponentRegistry.registerCustomComponent("fr:poster_position", {
        beforeOnPlayerPlace: e => {
            const { player } = e;
            if (!player) return;
            try {
                const hit = player.getBlockFromViewDirection?.({ maxDistance: 6 });
                if (!hit) return;

                const fl = hit.faceLocation;
                if (!fl) return;


                const yPos = fl.y % 1;



                let position = 1;
                if (yPos >= 0.66) {
                    position = 0;
                } else if (yPos <= 0.33) {
                    position = 2;
                }

                console.warn(`[Poster] Placing at Y=${yPos.toFixed(2)}, position=${position}`);
                e.permutationToPlace = e.permutationToPlace.withState('fr:position', position);
            } catch (err) {
                console.warn(`[Poster] Error: ${err}`);
            }
        }
    });
});

system.beforeEvents.startup.subscribe(({ blockComponentRegistry }) => {

    function toNorthLocal(x, z, facing) {

        switch (facing) {
            case 'south':
                return { x: 1 - x, z: 1 - z };
            case 'east':
                return { x: 1 - z, z: x };
            case 'west':
                return { x: z, z: 1 - x };
            case 'north':
            default:
                return { x, z };
        }
    }

    function pickPlacedFromNorthSpace(x, z) {
        try {

            const CENTER_MIN = 0.35;
            const CENTER_MAX = 0.65;
            if (x >= CENTER_MIN && x <= CENTER_MAX && z >= CENTER_MIN && z <= CENTER_MAX) return 5;
            const west = x < 0.5;
            const north = z < 0.5;
            if (west && north) return 1;
            if (!west && north) return 2;
            if (west && !north) return 3;
            return 4;
        } catch { return 5; }
    }

    function pickPlacedFromFaceLocation(fl, facing) {
        const xw = fl?.x ?? 0.5;
        const zw = fl?.z ?? 0.5;
        const nl = toNorthLocal(xw, zw, facing);
        return { placed: pickPlacedFromNorthSpace(nl.x, nl.z), nl };
    }

    blockComponentRegistry.registerCustomComponent('fr:hat_placed_selector', {
        beforeOnPlayerPlace: (e) => {
            try {
                const { player, block } = e;
                if (!player) return;
                const hit = player.getBlockFromViewDirection?.({ maxDistance: 6 });
                let placed = 5;
                if (hit) {
                    const fl = hit.faceLocation;
                    const top = (hit.face === Direction.Up) && fl && (((fl.y ?? 0) <= 0.11) || ((fl.y ?? 0) >= 0.89));
                    let isBaseTop = false;
                    try {
                        const base = block?.below?.();
                        const bl = base?.location; const hl = hit.block?.location;
                        isBaseTop = !!(bl && hl && bl.x === hl.x && bl.y === hl.y && bl.z === hl.z);
                    } catch { }
                    let facing = 'north';
                    try { facing = e.permutationToPlace?.getState?.('minecraft:cardinal_direction') ?? facing; } catch { }
                    let nl = { x: -1, z: -1 };
                    if (top && isBaseTop) { const r = pickPlacedFromFaceLocation(fl, facing); placed = r.placed; nl = r.nl; }
                }
                e.permutationToPlace = e.permutationToPlace.withState('fr:placed', placed);
            } catch { }
        },
        onPlayerInteract: (e) => {
            try {
                const { player, block } = e;
                if (!player || !block) return;
                const hit = player.getBlockFromViewDirection?.({ maxDistance: 6, includePassableBlocks: true, includeLiquidBlocks: true });
                if (!hit || !hit.block) return;

                try {
                    const base = block.below();
                    const bl = base.location; const hl = hit.block.location;
                    if (bl.x !== hl.x || bl.y !== hl.y || bl.z !== hl.z) return;
                } catch { return; }
                const fl = hit.faceLocation; if (!fl) return;
                if (!(hit.face === Direction.Up) || !(((fl.y ?? 0) <= 0.11) || ((fl.y ?? 0) >= 0.89))) return;
                let facing = 'north';
                try { facing = block.permutation.getState('minecraft:cardinal_direction') ?? facing; } catch { }
                const r = pickPlacedFromFaceLocation(fl, facing);
                const placed = r.placed;
                const newPerm = block.permutation.withState('fr:placed', placed);
                block.setPermutation(newPerm);
            } catch { }
        }
    });
});

system.beforeEvents.startup.subscribe(({ blockComponentRegistry }) => {
    blockComponentRegistry.registerCustomComponent('fr:hat_pull', {
        onPlayerInteract: (e) => {
            try {
                const { block, player } = e;
                if (!block || !player) return;
                if (!player.isSneaking) return;
                const perm = block.permutation;
                let state = 'false';
                try { state = perm.getState('fr:pulled'); } catch { }
                const next = state === 'true' ? 'false' : 'true';
                const newPerm = perm.withState('fr:pulled', next);
                block.setPermutation(newPerm);
            } catch { }
        }
    });
});

const frMountState = new Map();
const frMountTypes = new Set([
    'fr:fnaf1_bonnie_entity',
    'fr:fnaf1_foxy_entity',
    'fr:fnaf1_chica_entity',
    'fr:fnaf1_freddy_entity'
]);

system.runInterval(() => {
    const players = world.getPlayers();
    if (players.length === 0) return;
    for (const player of players) {
        const ridingEntity = player.getComponent('minecraft:riding')?.entityRidingOn;
        const isTarget = ridingEntity && frMountTypes.has(ridingEntity.typeId);
        const wasMounted = frMountState.get(player.name) === true;

        if (isTarget && !wasMounted) {
            player.runCommand('playanimation @s animation.player.fr_bonnie_jumpscare_player');
            frMountState.set(player.name, true);
        } else if (!isTarget && wasMounted) {
            frMountState.set(player.name, false);
        }
    }
}, 5);

system.beforeEvents.startup.subscribe(({ blockComponentRegistry }) => {
    blockComponentRegistry.registerCustomComponent('fr:party_chair_sit', {
        onPlayerInteract: function (e) {
            let {
                x,
                y,
                z
            } = e.block.location;
            if (e.player.isSneaking) return;
            const cx = x + 0.5;
            const cy = y + 0.1;
            const cz = z + 0.5;
            let yaw = 0;
            let seatId = 'fr:south_sit';
            try {
                const face = e.block.permutation.getState('minecraft:cardinal_direction');
                if (face === 'north') { yaw = 180; seatId = 'fr:north_sit'; }
                else if (face === 'east') { yaw = 270; seatId = 'fr:west_sit'; }
                else if (face === 'south') { yaw = 0; seatId = 'fr:south_sit'; }
                else if (face === 'west') { yaw = 90; seatId = 'fr:east_sit'; }
            } catch { }

            e.dimension.runCommand(`summon ${seatId} ${cx} ${cy} ${cz}`);
            e.dimension.runCommand(`execute positioned ${cx} ${cy} ${cz} as @e[type=${seatId},r=0.8] run tp @s ${cx} ${cy} ${cz}`);
            e.player.runCommand(`execute at @e[type=player] positioned ${cx} ${cy} ${cz} run ride @s start_riding @e[type=${seatId},r=0.8] teleport_rider`);
        },
        onPlayerDestroy: function (e) {
            if (!e.player) return;
            let playerLoc = e.player.location;
            playerLoc.x -= 0.5;
            playerLoc.z -= 0.5;

            if (playerLoc.x != e.block.location.x) return;
            if (playerLoc.y != e.block.location.y) return;
            if (playerLoc.z != e.block.location.z) return;

            e.player.runCommand("ride @s stop_riding");
        },
        onPlace: function (e) {
            if (!e.block) return;
            let block = e.block.above();
            if (!block) return;
        }
    });

    blockComponentRegistry.registerCustomComponent('fr:arcade_stool_sit', {
        onPlayerInteract: function (e) {
            let { x, y, z } = e.block.location;
            if (e.player.isSneaking) return;
            const cx = x + 0.5;
            const cy = y + 0.3;
            const cz = z + 0.5;
            let seatId = 'fr:south_sit';
            try {
                const face = e.block.permutation.getState('minecraft:cardinal_direction');
                if (face === 'north') seatId = 'fr:north_sit';
                else if (face === 'east') seatId = 'fr:west_sit';
                else if (face === 'south') seatId = 'fr:south_sit';
                else if (face === 'west') seatId = 'fr:east_sit';
            } catch { }
            e.dimension.runCommand(`summon ${seatId} ${cx} ${cy} ${cz}`);
            e.dimension.runCommand(`execute positioned ${cx} ${cy} ${cz} as @e[type=${seatId},r=0.8] run tp @s ${cx} ${cy} ${cz}`);
            e.player.runCommand(`execute at @e[type=player] positioned ${cx} ${cy} ${cz} run ride @s start_riding @e[type=${seatId},r=0.8] teleport_rider`);
        },
        onPlayerDestroy: function (e) {
            if (!e.player) return;
            let playerLoc = e.player.location;
            playerLoc.x -= 0.5;
            playerLoc.z -= 0.5;
            if (playerLoc.x != e.block.location.x) return;
            if (playerLoc.y != e.block.location.y) return;
            if (playerLoc.z != e.block.location.z) return;
            e.player.runCommand("ride @s stop_riding");
        }
    });
});

const lockerOwners = new Map();

function lockerBaseKey(block) {
    const base = getLockerBaseBlock(block);
    const loc = base.location;
    return `${base.dimension.id}|${loc.x},${loc.y},${loc.z}`;
}

function getLockerBaseBlock(block) {
    if (block.typeId === 'fr:gray_locker') return block;
    if (block.typeId === 'fr:gray_locker_upper') {
        const loc = block.location;
        const below = block.dimension.getBlock({ x: loc.x, y: loc.y - 1, z: loc.z });
        if (below && below.typeId === 'fr:gray_locker') return below;
    }
    return block;
}

function setLockerOwner(block, ownerName) {
    try {
        const key = lockerBaseKey(block);
        lockerOwners.set(key, ownerName);
    } catch { }
}

function clearLockerOwner(block) {
    try {
        const key = lockerBaseKey(block);
        lockerOwners.delete(key);
    } catch { }
}

function getLockerOwner(block) {
    try {
        const key = lockerBaseKey(block);
        return lockerOwners.get(key);
    } catch {
        return undefined;
    }
}

function findLockerInventoryEntity(block) {
    try {
        const base = getLockerBaseBlock(block);
        const loc = base.location;
        const center = { x: loc.x + 0.5, y: loc.y + 0.5, z: loc.z + 0.5 };
        const ents = base.dimension.getEntities({ type: 'fr:locker_inventory', location: center, maxDistance: 1.6 });
        return ents?.[0];
    } catch {
        return undefined;
    }
}

function countItemsInEntity(entity) {
    try {
        const inv = entity.getComponent('minecraft:inventory');
        const ctr = inv?.container;
        if (!ctr) return 0;
        let total = 0;
        for (let i = 0; i < ctr.size; i++) {
            const it = ctr.getItem(i);
            if (it) total += it.amount ?? 0;
        }
        return total;
    } catch {
        return 0;
    }
}

function getHeldItem(player, fallbackFromEvent) {
    try {
        if (fallbackFromEvent) return fallbackFromEvent;
    } catch { }
    try {
        const eq = player.getComponent?.('minecraft:equippable');
        const hand = eq?.getEquipment?.(EquipmentSlot.Mainhand);
        if (hand) return hand;
    } catch { }
    try {
        const inv = player.getComponent?.('minecraft:inventory');
        const ctr = inv?.container;
        if (ctr && typeof player.selectedSlot === 'number') return ctr.getItem(player.selectedSlot);
    } catch { }
    return undefined;
}

const lastLockerCheck = new Map();
system.runInterval(() => {
    const players = world.getPlayers();
    if (players.length === 0) return;
    try {
        for (const player of players) {
            let hit;
            try {
                hit = player.getBlockFromViewDirection?.({ maxDistance: 5 });
            } catch { }
            const block = hit?.block;
            if (!block) continue;
            const type = block.typeId;
            if (type !== 'fr:gray_locker' && type !== 'fr:gray_locker_upper') continue;

            const base = getLockerBaseBlock(block);
            const key = lockerBaseKey(base);
            const owner = lockerOwners.get(key);
            if (!owner) continue;
            const ent = findLockerInventoryEntity(base);
            const items = ent ? countItemsInEntity(ent) : 0;
            const actionBarText = `§7Owner: ${owner}\n§7Items: ${items}`;
            const lastText = lastLockerCheck.get(player.id);
            if (lastText !== actionBarText) {
                player.onScreenDisplay.setActionBar(customActionbar(actionBarText));
                lastLockerCheck.set(player.id, actionBarText);
            }
        }
    } catch { }
}, 10);

system.beforeEvents.startup.subscribe(({ blockComponentRegistry }) => {
    blockComponentRegistry.registerCustomComponent('fr:locker_upper_function', {
        onPlayerInteract: (e) => {
            const { block, player } = e;
            if (!block) return;

            try {
                const loc = block.location;
                const below = block.dimension.getBlock({ x: loc.x, y: loc.y - 1, z: loc.z });
                if (below && below.typeId === 'fr:gray_locker') {
                    try {
                        const it = getHeldItem(player, e.itemStack);
                        const isNameTag = it && (it.typeId === 'minecraft:name_tag');
                        if (isNameTag) {
                            const existingOwner = getLockerOwner(below);
                            if (existingOwner && existingOwner !== player.name) {
                                player.sendMessage(dynamicToast(
                                    "§l§cAlready claimed!",
                                    `§7This locker belongs to: ${existingOwner}`,
                                    "textures/fr_ui/deny_icon",
                                    "textures/fr_ui/deny_ui"
                                ));
                                return;
                            }
                            setLockerOwner(below, player.name);
                            player.sendMessage(dynamicToast(
                                "§l§aLocker claimed!",
                                `§7Locker claimed by: ${player.name}`,
                                "textures/fr_ui/check_icon",
                                "textures/fr_ui/success_ui"
                            ));
                            return;
                        }
                    } catch { }

                    const owner = getLockerOwner(below);
                    if (owner && owner !== player.name) {
                        player.sendMessage(dynamicToast(
                            "§l§cLocked!",
                            "§7This locker is locked",
                            "textures/fr_ui/deny_icon",
                            "textures/fr_ui/deny_ui"
                        ));
                        return;
                    }

                    if (!isLockerOpen(below)) {
                        setLockerState(below, 'open');
                        player?.playSound?.('open.iron_door');
                    }
                }
            } catch { }
        },
        onPlayerDestroy: (e) => {
            const { block } = e;
            if (!block) return;
            try {
                removeLockerPairAt(block);
            } catch { }
        }
    });
});

function setLockerState(block, state) {
    try {
        const perm = block.permutation.withState('ff:locker_is', state);
        block.setPermutation(perm);
    } catch (err) {
    }
    try {
        const loc = block.location;
        const above = block.dimension.getBlock({ x: loc.x, y: loc.y + 1, z: loc.z });
        if (above && above.typeId === 'fr:gray_locker_upper') {
            const perm2 = above.permutation.withState('ff:locker_is', state);
            above.setPermutation(perm2);
        }
    } catch { }
}

function isLockerOpen(block) {
    try {
        return block.permutation.getState('ff:locker_is') === 'open';
    } catch {
        return false;
    }
}

const lockerHideState = new Map();

function getFacingVector(block) {
    try {
        const f = block.permutation.getState('minecraft:cardinal_direction');
        if (f === 'north') return { x: 0, y: 0, z: -1 };
        if (f === 'south') return { x: 0, y: 0, z: 1 };
        if (f === 'west') return { x: -1, y: 0, z: 0 };
        if (f === 'east') return { x: 1, y: 0, z: 0 };
    } catch { }
    return { x: 0, y: 0, z: 1 };
}

function computeLockerHidePositions(baseBlock) {
    const loc = baseBlock.location;
    const center = { x: loc.x + 0.5, y: loc.y + 0.4, z: loc.z + 0.5 };
    const fwd = getFacingVector(baseBlock);
    const insideOffset = -0.3;
    const exitOffset = -1.2;
    return {
        insidePos: { x: center.x - fwd.x * insideOffset, y: center.y, z: center.z - fwd.z * insideOffset },
        exitPos: { x: center.x + fwd.x * exitOffset, y: center.y, z: center.z + fwd.z * exitOffset }
    };
}

function removeLockerPairAt(block) {
    try {
        const dim = block.dimension;
        const loc = block.location;
        let base = block;
        let upper = null;
        try {
            if (block.typeId === 'fr:gray_locker_upper') {
                base = dim.getBlock({ x: loc.x, y: loc.y - 1, z: loc.z });
                upper = block;
            } else if (block.typeId === 'fr:gray_locker') {
                upper = dim.getBlock({ x: loc.x, y: loc.y + 1, z: loc.z });
            } else {
                return;
            }
        } catch { }

        try { clearLockerOwner(base); } catch { }
        try {
            const ent = findLockerInventoryEntity(base);
            if (ent) ent.kill?.();
        } catch { }

        const air = BlockPermutation.resolve('minecraft:air');
        system.run(() => {
            try { if (upper && upper.typeId === 'fr:gray_locker_upper') upper.setPermutation(air); } catch { }
            try { if (base && base.typeId === 'fr:gray_locker') base.setPermutation(air); } catch { }
        });
    } catch { }
}

system.beforeEvents.startup.subscribe(({ blockComponentRegistry }) => {
    blockComponentRegistry.registerCustomComponent('fr:locker_function', {
        beforeOnPlayerPlace: (e) => {
            try {
                const { block } = e;
                if (!block) return;
                const loc = block.location;
                const above = block.dimension.getBlock({ x: loc.x, y: loc.y + 1, z: loc.z });
                if (above && !(above.isAir ?? (above.typeId === 'minecraft:air'))) {
                    e.cancel = true;
                }
            } catch { }
        },
        onPlace: (e) => {
            const { block } = e;
            if (!block) return;

            const loc = block.location;
            let dx = 0, dz = 0;
            try {
                const facing = block.permutation.getState('minecraft:cardinal_direction');
                const offset = 0.2;
                if (facing === 'north') { dz = -offset; }
                else if (facing === 'south') { dz = offset; }
                else if (facing === 'east') { dx = offset; }
                else if (facing === 'west') { dx = -offset; }
            } catch { }
            const spawnPos = { x: loc.x + 0.5 + dx, y: loc.y + 0.5, z: loc.z + 0.5 + dz };
            const entity = block.dimension.spawnEntity('fr:locker_inventory', spawnPos);
            if (entity) {
                entity.nameTag = '§t§e§s§t§r';
            }

            try {
                const cardinal = block.permutation.getState('minecraft:cardinal_direction');
                system.run(() => {
                    const loc2 = block.location;
                    const upper = block.dimension.getBlock({ x: loc2.x, y: loc2.y + 1, z: loc2.z });
                    if (upper && (upper.isAir ?? (upper.typeId === 'minecraft:air'))) {
                        const upperPerm = BlockPermutation.resolve('fr:gray_locker_upper', {
                            'minecraft:cardinal_direction': cardinal,
                            'ff:locker_is': 'closed'
                        });
                        upper.setPermutation(upperPerm);
                    }
                });
            } catch { }
        },
        onPlayerDestroy: (e) => {
            const { block } = e;
            if (!block) return;
            try {
                removeLockerPairAt(block);
            } catch { }
        },
        onPlayerInteract: (e) => {
            const { block, player } = e;
            if (!block) return;

            const currentlyOpen = isLockerOpen(block);

            try {
                const it = getHeldItem(player, e.itemStack);
                const isNameTag = it && (it.typeId === 'minecraft:name_tag');
                if (isNameTag) {
                    const existingOwner = getLockerOwner(block);
                    if (existingOwner && existingOwner !== player.name) {
                        player.sendMessage(dynamicToast(
                            "§l§pAlready claimed!",
                            `§7This locker belongs to: ${existingOwner}`,
                            "textures/fr_ui/warning_icon",
                            "textures/fr_ui/warning_ui"
                        ));
                        return;
                    }
                    setLockerOwner(block, player.name);
                    player.sendMessage(dynamicToast(
                        "§l§qLocker claimed!",
                        `§7Now whatever you keep \nhere is safe`,
                        "textures/fr_ui/approve_icon",
                        "textures/fr_ui/approve_ui"
                    ));
                    return;
                }
            } catch { }

            const owner = getLockerOwner(block);
            if (owner && owner !== player.name) {
                player.sendMessage(dynamicToast(
                    "§l§cLocked!",
                    "§7This locker is locked",
                    "textures/fr_ui/deny_icon",
                    "textures/fr_ui/deny_ui"
                ));
                return;
            }

            if (player?.isSneaking) {
                const base = getLockerBaseBlock(block);
                const { insidePos, exitPos } = computeLockerHidePositions(base);
                try {
                    player.teleport(insidePos, { dimension: base.dimension, keepVelocity: false });
                } catch { }

                try {
                    const yaw = (yawFromFacing(base) + 180) % 360;
                    player.setRotation({ x: 0, y: yaw });
                } catch { }

                try { player.runCommand('hud @s hide all'); } catch { }
                try { player.runCommand('effect @s invisibility 99999 0 true'); } catch { }
                setLockerState(base, 'closed');
                const pid = player.id;
                lockerHideState.set(pid, {
                    baseLoc: { x: base.location.x, y: base.location.y, z: base.location.z, dim: base.dimension.id },
                    insidePos,
                    exitPos,
                    lastSneak: true,
                    oxygen: 50,
                    oxyTick: 0,
                    uiState: 'normal'
                });
                ensureLockerTick();

                let isCreative = false;
                try { isCreative = player.getGameMode?.() === 'creative'; } catch { }
                if (!isCreative) {
                    try { player.runCommand('title @s title bar:50'); } catch { }
                }

                system.run(() => showLockerHideMenu(player, base, player.id));
                return;
            }

            if (!currentlyOpen) {
                setLockerState(block, 'open');
                player?.playSound?.('open.iron_door');
            }
        },

        onTick: (e) => {
            const { block } = e;
            if (!block) return;

            if (isLockerOpen(block)) {
                setLockerState(block, 'closed');
                try {
                    const loc = block.location;
                    const dim = block.dimension;
                    const players = dim.getPlayers?.({ location: { x: loc.x + 0.5, y: loc.y + 0.5, z: loc.z + 0.5 }, maxDistance: 4 })
                        ?? world.getPlayers();
                    for (const p of players) {
                        try {
                            if (p.dimension?.id !== dim.id) continue;
                            const dx = (p.location?.x ?? 0) - (loc.x + 0.5);
                            const dy = (p.location?.y ?? 0) - (loc.y + 0.5);
                            const dz = (p.location?.z ?? 0) - (loc.z + 0.5);
                            const dist2 = dx * dx + dy * dy + dz * dz;
                            if (dist2 <= 16) {
                                p.playSound?.('close.iron_door');
                            }
                        } catch { }
                    }
                } catch { }
            }
        }
    });
});

const plushCooldowns = new Map();
const PLUSH_COOLDOWN_MS = 750;
const PLUSH_ANIMATION_DURATION_TICKS = 60;
const PLUSH_ENTITY_BY_BLOCK = {
    'fr:freddy_plush': 'fr:freddy_plush_entity',
    'fr:freddy_plushhw': 'fr:freddy_plushhw_entity',
    'fr:bonnie_plush': 'fr:bonnie_plush_entity',
    'fr:chica_plush': 'fr:chica_plush_entity',
    'fr:foxy_plush': 'fr:foxy_plush_entity',
    'fr:foxy_hwplush': 'fr:foxy_hwplush_entity',
    'fr:foxy_plush_headless': 'fr:foxy_plush_headless_entity',
    'fr:acurate_chica_plush': 'fr:acurate_chica_plush_entity',
    'fr:chica_hwplush': 'fr:chica_hwplush_entity',
    'fr:bonnie_plushhw': 'fr:bonnie_plushhw_entity',
    'fr:golden_freddy_plush': 'fr:golden_freddy_plush_entity',
    'fr:endo_01_plush': 'fr:endo_01_plush_entity',
    'fr:bizabizow_foxy_plush': 'fr:bizabizow_foxy_plush_entity',
};

function getPlushKey(block) {
    const loc = block.location;
    return `${block.dimension.id}|${loc.x},${loc.y},${loc.z}`;
}

function findPlushEntity(block, entityType) {
    try {
        const loc = block.location;
        const center = { x: loc.x + 0.5, y: loc.y, z: loc.z + 0.5 };
        const ents = block.dimension.getEntities({ type: entityType, location: center, maxDistance: 0.49 });

        for (const e of ents) {
            const el = e.location;
            if (Math.abs(el.x - center.x) < 0.49 && Math.abs(el.z - center.z) < 0.49) {
                return e;
            }
        }
        return undefined;
    } catch {
        return undefined;
    }
}

system.beforeEvents.startup.subscribe(({ blockComponentRegistry }) => {
    const makePlushComponent = (entityType) => ({
        beforeOnPlayerPlace: (e) => {
            try {
                let permutation = e.permutationToPlace.withState('fr:placed', 1);

                const blockBelow = e.block.below();
                if (blockBelow) {
                    const tags = blockBelow.getTags();
                    if (tags.includes('fr:its_box')) {
                        permutation = permutation.withState('fr:is_placed_on', 'box');
                    } else if (tags.includes('fr:its_medium_box')) {
                        permutation = permutation.withState('fr:is_placed_on', 'medium_box');
                    } else if (tags.includes('fr:its_chair')) {
                        permutation = permutation.withState('fr:is_placed_on', 'chair');
                    } else {
                        permutation = permutation.withState('fr:is_placed_on', 'full');
                    }
                }

                e.permutationToPlace = permutation;
            } catch { }
        },

        onPlayerInteract: (e) => {
            const { block, player } = e;
            if (!block || !player) return;

            try {
                const key = getPlushKey(block);
                const now = Date.now();
                const lastClick = plushCooldowns.get(key) ?? 0;

                if (now - lastClick < (PLUSH_ANIMATION_DURATION_TICKS * 50)) {
                    return;
                }

                const placedState = block.permutation.getState('fr:placed');
                if (placedState !== 1) {
                    return;
                }

                plushCooldowns.set(key, now);

                const newPermutation = block.permutation.withState('fr:placed', 0);
                block.setPermutation(newPermutation);

                const loc = block.location;
                const placedOn = block.permutation.getState('fr:is_placed_on') ?? 'full';
                let yOffset = 0;
                if (placedOn === 'box') {
                    yOffset = -0.45;
                } else if (placedOn === 'medium_box') {
                    yOffset = -0.25;
                } else if (placedOn === 'chair') {
                    yOffset = -0.4;
                }

                const spawnPos = { x: loc.x + 0.5, y: loc.y + yOffset, z: loc.z + 0.5 };
                const entity = block.dimension.spawnEntity(entityType, spawnPos);

                if (entity) {
                    try {
                        const facing = block.permutation.getState('minecraft:cardinal_direction') ?? 'south';
                        let yRot = 0;
                        switch (facing) {
                            case 'north': yRot = 0; break;
                            case 'south': yRot = 180; break;
                            case 'east': yRot = 90; break;
                            case 'west': yRot = -90; break;
                        }
                        entity.setRotation({ x: 0, y: yRot });
                    } catch { }

                    const blockId = block.typeId;
                    const eType = PLUSH_ENTITY_BY_BLOCK[blockId] ?? entityType;
                    const dimension = block.dimension;

                    system.runTimeout(() => {
                        try {
                            const x = loc.x + 0.5;
                            const y = loc.y + yOffset;
                            const z = loc.z + 0.5;

                            const center = { x, y, z };
                            const entities = dimension.getEntities({
                                type: eType,
                                location: center,
                                maxDistance: 0.7
                            });

                            if (entities.length > 0) {
                                dimension.runCommand(`playanimation @e[type=${eType},x=${x},y=${y},z=${z},r=0.5,c=1] animation.fr_freddy_plush.click`);
                                dimension.playSound('fnaf1_plushie', { x, y, z }, { pitch: 1.0, volume: 1.0 });
                            }
                        } catch { }
                    }, 3);

                    system.runTimeout(() => {
                        try {
                            const currentBlock = dimension.getBlock(loc);
                            if (currentBlock && currentBlock.typeId === blockId) {
                                const restoredPermutation = currentBlock.permutation.withState('fr:placed', 1);
                                currentBlock.setPermutation(restoredPermutation);
                            }

                            const x = loc.x + 0.5;
                            const y = loc.y + yOffset;
                            const z = loc.z + 0.5;
                            const center = { x, y, z };
                            const entities = dimension.getEntities({
                                type: eType,
                                location: center,
                                maxDistance: 0.7
                            });

                            for (const ent of entities) {
                                const el = ent.location;
                                const dx = Math.abs(el.x - x);
                                const dy = Math.abs(el.y - y);
                                const dz = Math.abs(el.z - z);
                                if (dx < 0.6 && dy < 0.6 && dz < 0.6) {
                                    ent.remove();
                                }
                            }
                        } catch { }
                    }, PLUSH_ANIMATION_DURATION_TICKS);
                }
            } catch { }
        },

        onPlayerDestroy: (e) => {
            const { block } = e;
            if (!block) return;

            try {
                const key = getPlushKey(block);
                plushCooldowns.delete(key);

                const blockId = block.typeId;
                const eType = PLUSH_ENTITY_BY_BLOCK[blockId] ?? entityType;
                const entity = findPlushEntity(block, eType);

                if (entity && entity.isValid()) {
                    try {
                        entity.remove();
                    } catch { }
                }
            } catch { }
        }
    });

    blockComponentRegistry.registerCustomComponent('fr:freddy_plush_interact', makePlushComponent('fr:freddy_plush_entity'));
    blockComponentRegistry.registerCustomComponent('fr:freddy_plushhw_interact', makePlushComponent('fr:freddy_plushhw_entity'));
    blockComponentRegistry.registerCustomComponent('fr:bonnie_plush_interact', makePlushComponent('fr:bonnie_plush_entity'));
    blockComponentRegistry.registerCustomComponent('fr:chica_plush_interact', makePlushComponent('fr:chica_plush_entity'));
    blockComponentRegistry.registerCustomComponent('fr:foxy_plush_interact', makePlushComponent('fr:foxy_plush_entity'));
    blockComponentRegistry.registerCustomComponent('fr:foxy_hwplush_interact', makePlushComponent('fr:foxy_hwplush_entity'));
    blockComponentRegistry.registerCustomComponent('fr:foxy_plush_headless_interact', makePlushComponent('fr:foxy_plush_headless_entity'));
    blockComponentRegistry.registerCustomComponent('fr:acurate_chica_plush_interact', makePlushComponent('fr:acurate_chica_plush_entity'));
    blockComponentRegistry.registerCustomComponent('fr:chica_hwplush_interact', makePlushComponent('fr:chica_hwplush_entity'));
    blockComponentRegistry.registerCustomComponent('fr:bonnie_plushhw_interact', makePlushComponent('fr:bonnie_plushhw_entity'));
    blockComponentRegistry.registerCustomComponent('fr:golden_freddy_plush_interact', makePlushComponent('fr:golden_freddy_plush_entity'));
    blockComponentRegistry.registerCustomComponent('fr:endo_01_plush_interact', makePlushComponent('fr:endo_01_plush_entity'));
    blockComponentRegistry.registerCustomComponent('fr:bizabizow_foxy_plush_interact', makePlushComponent('fr:bizabizow_foxy_plush_entity'));
});

world.afterEvents.playerBreakBlock.subscribe((e) => {
    try {
        const { block, brokenBlockPermutation, dimension } = e;

        const blockId = brokenBlockPermutation.type.id;
        const eType = PLUSH_ENTITY_BY_BLOCK[blockId];
        if (eType) {

            const loc = block.location;

            let yOffset = 0;
            try {
                const placedOn = brokenBlockPermutation.getState ? brokenBlockPermutation.getState('fr:is_placed_on') : 'full';
                if (placedOn === 'box') yOffset = -0.45;
                else if (placedOn === 'medium_box') yOffset = -0.25;
                else if (placedOn === 'chair') yOffset = -0.4;
            } catch { }

            const center = { x: loc.x + 0.5, y: loc.y + yOffset, z: loc.z + 0.5 };
            const entities = dimension.getEntities({
                type: eType,
                location: center,
                maxDistance: 0.7
            });

            const inCell = entities.filter(e => {
                const el = e.location;
                const dx = Math.abs(el.x - center.x);
                const dz = Math.abs(el.z - center.z);
                const dy = Math.abs(el.y - center.y);
                return dx < 0.49 && dz < 0.49 && dy < 0.6;
            });

            for (const entity of inCell) {
                try {
                    entity.triggerEvent('kill');
                } catch {
                    entity.remove();
                }
            }

            const key = `${dimension.id}|${loc.x},${loc.y},${loc.z}`;
            plushCooldowns.delete(key);
            return;
        }

        const blockAbove = dimension.getBlock({ x: block.location.x, y: block.location.y + 1, z: block.location.z });

        if (blockAbove && blockAbove.typeId === 'fr:freddy_plush') {
            const currentState = blockAbove.permutation.getState('fr:is_placed_on');

            if (currentState === 'box' || currentState === 'medium_box' || currentState === 'chair') {

                const newPermutation = blockAbove.permutation.withState('fr:is_placed_on', 'full');
                blockAbove.setPermutation(newPermutation);

                system.runTimeout(() => {
                    const loc = blockAbove.location;
                    const entity = findPlushEntity(blockAbove);
                    if (entity) {
                        const newPos = { x: loc.x + 0.5, y: loc.y, z: loc.z + 0.5 };
                        entity.teleport(newPos, { dimension });
                    }
                }, 2);
            }
        }
    } catch { }
});

world.afterEvents.playerPlaceBlock.subscribe((e) => {
    try {
        const { block, dimension } = e;

        const blockAbove = dimension.getBlock({ x: block.location.x, y: block.location.y + 1, z: block.location.z });

        if (blockAbove && blockAbove.typeId === 'fr:freddy_plush') {
            const currentState = blockAbove.permutation.getState('fr:is_placed_on') ?? 'full';

            const tags = block.getTags();
            let expectedState = 'full';

            if (tags.includes('fr:its_box')) {
                expectedState = 'box';
            } else if (tags.includes('fr:its_medium_box')) {
                expectedState = 'medium_box';
            } else if (tags.includes('fr:its_chair')) {
                expectedState = 'chair';
            }

            if (currentState !== expectedState) {

                const newPermutation = blockAbove.permutation.withState('fr:is_placed_on', expectedState);
                blockAbove.setPermutation(newPermutation);

                system.runTimeout(() => {
                    const loc = blockAbove.location;
                    const entity = findPlushEntity(blockAbove);
                    if (entity) {
                        let yOffset = 0;
                        if (expectedState === 'box' || expectedState === 'chair') {
                            yOffset = -0.5;
                        } else if (expectedState === 'medium_box') {
                            yOffset = -0.2;
                        }
                        const newPos = { x: loc.x + 0.5, y: loc.y + yOffset, z: loc.z + 0.5 };
                        entity.teleport(newPos, { dimension });
                    }
                }, 2);
            }
        }
    } catch { }
});

export function fazDiverNotification(title = '', message = '', icon = 'textures/items/faz-diver_with_item') {
    return "§F§A§Z§D§I§V§E§R" +
        adjustTextLength(title, 100) +
        adjustTextLength(message, 200) +
        adjustTextLength(icon, 100);
}

function sendFazDiverActivatedNotification(player) {
    try {
        player.sendMessage(fazDiverNotification(
            "§l§pMODE: OFF",
            "§7Crouch down and right-click\nto activate the item!",
            "textures/fr_ui/faz-diver_off"
        ));
    } catch { }
}

function sendFazDiverDeactivatedNotification(player) {
    try {
        player.sendMessage(fazDiverNotification(
            "§l§pMODE: STANDBY",
            "§7System deactivated\n§7Monitoring disabled\n§7Equipment unlocked",
            "textures/fr_ui/faz-diver_security"
        ));
    } catch { }
}

const FAZ_DIVER_CYCLE_MODES = [
    'fr:faz-diver_off',
    'fr:faz-diver_security',
    'fr:faz-diver_employee',
    'fr:faz-diver_repairman',
    'fr:faz-diver_manager',
    'fr:faz-diver_executive'
];

const MODE_INFO = {
    'fr:faz-diver_off': {
        title: '§l§pMODE: OFF',
        message: '§7Crouch + right-click to\nswitch to next mode',
        icon: 'textures/fr_ui/faz-diver_off'
    },
    'fr:faz-diver_security': {
        title: '§l§pMODE: SECURITY',
        message: '§7Manages the connection of\nsecurity cameras and doors\n\n- Including all pizzeria lights',
        icon: 'textures/fr_ui/faz-diver_security'
    },
    'fr:faz-diver_employee': {
        title: '§l§pMODE: EMPLOYEE',
        message: '§7Change the variants of the blocks\nby right clicking with this mode',
        icon: 'textures/fr_ui/faz-diver_employee'
    },
    'fr:faz-diver_repairman': {
        title: '§l§pMODE: REPAIRMAN',
        message: '§7Edit the statues by adding poses\nvariations and rotate them',
        icon: 'textures/fr_ui/faz-diver_repairman'
    },
    'fr:faz-diver_manager': {
        title: '§l§pMODE: MANAGER',
        message: '§7Not available!',
        icon: 'textures/fr_ui/faz-diver_manager'
    },
    'fr:faz-diver_executive': {
        title: '§l§pMODE: EXECUTIVE',
        message: '§7Not available!',
        icon: 'textures/fr_ui/faz-diver_executive'
    }
};

function getNextMode(currentMode) {
    const currentIndex = FAZ_DIVER_CYCLE_MODES.indexOf(currentMode);
    if (currentIndex === -1) return FAZ_DIVER_CYCLE_MODES[0];
    return FAZ_DIVER_CYCLE_MODES[(currentIndex + 1) % FAZ_DIVER_CYCLE_MODES.length];
}

function sendModeChangeNotification(player, newMode) {
    try {
        const info = MODE_INFO[newMode];
        if (info) {
            player.sendMessage(fazDiverNotification(
                info.title,
                info.message,
                info.icon
            ));
        }
    } catch { }
}

world.beforeEvents.playerBreakBlock.subscribe((e) => {
    try {
        const { player } = e;
        if (!player) return;
        if (!player.isSneaking) return;

        const equipment = player.getComponent('minecraft:equippable');
        if (!equipment) return;

        const chestplate = equipment.getEquipment(EquipmentSlot.Chest);
        if (!chestplate) return;

        const chestplateId = chestplate.typeId;

        if (chestplateId === 'fr:faz_diver_with_item') {
            e.cancel = true;
            system.run(() => {
                try {
                    const eq = player.getComponent('minecraft:equippable');
                    if (eq) {
                        const newChestplate = new ItemStack('fr:faz_diver_without_item', 1);
                        eq.setEquipment(EquipmentSlot.Chest, newChestplate);
                    }

                    let slot8Type = 'fr:faz-diver_off';
                    try {
                        const invChk = player.getComponent('minecraft:inventory');
                        const contChk = invChk?.container;
                        const hand = contChk?.getItem(player.selectedSlotIndex);
                        if (hand && FAZ_DIVER_CYCLE_MODES.includes(hand.typeId)) {
                            slot8Type = hand.typeId;
                        }
                    } catch { }

                    try { player.runCommand('replaceitem entity @s slot.armor.chest 0 fr:faz_diver_without_item 1 0 {"minecraft:item_lock":{"mode":"lock_in_slot"}}'); } catch { }
                    player.runCommand(`replaceitem entity @s slot.hotbar 8 ${slot8Type} 1 0 {"minecraft:item_lock":{"mode":"lock_in_slot"}}`);

                    player.playSound('armor.equip_generic', { pitch: 1.0, volume: 1.0 });
                    sendFazDiverActivatedNotification(player);
                } catch { }
            });
            return;
        } else if (chestplateId === 'fr:faz_diver_without_item') {
            const inventory = player.getComponent('minecraft:inventory');
            if (!inventory) return;
            const container = inventory.container;
            if (!container) return;
            const slot8Item = container.getItem(8);
            if (slot8Item && (slot8Item.typeId === 'fr:faz-diver_off' || FAZ_DIVER_CYCLE_MODES.includes(slot8Item.typeId))) {
                e.cancel = true;
                system.run(() => {
                    try {
                        const inv = player.getComponent('minecraft:inventory');
                        const cont = inv?.container;
                        if (cont) cont.setItem(8, undefined);
                        const eq = player.getComponent('minecraft:equippable');
                        if (eq) {
                            const newChestplate = new ItemStack('fr:faz_diver_with_item', 1);
                            eq.setEquipment(EquipmentSlot.Chest, newChestplate);
                        }
                        player.playSound('armor.equip_generic', { pitch: 1.0, volume: 1.0 });
                        sendFazDiverDeactivatedNotification(player);
                    } catch { }
                });
                return;
            }
        }

        return;

        if (slot8Item && FAZ_DIVER_CYCLE_MODES.includes(slot8Item.typeId)) {
            e.cancel = true;

            system.run(() => {
                try {
                    const inv = player.getComponent('minecraft:inventory');
                    const cont = inv?.container;
                    if (cont) cont.setItem(8, undefined);

                    player.playSound('armor.equip_generic', { pitch: 1.0, volume: 1.0 });
                    sendFazDiverDeactivatedNotification(player);
                } catch { }
            });
            return;
        }

        e.cancel = true;

        system.run(() => {
            try {

                player.runCommand(`replaceitem entity @s slot.hotbar 8 ${chestplateId} 1 0 {"minecraft:item_lock":{"mode":"lock_in_slot"}}`);

                player.playSound('armor.equip_generic', { pitch: 1.0, volume: 1.0 });
                sendFazDiverActivatedNotification(player);
            } catch { }
        });

    } catch { }
});

world.afterEvents.entityHitEntity.subscribe((e) => {
    try {
        const { damagingEntity: player } = e;
        if (!player || player.typeId !== 'minecraft:player') return;
        if (!player.isSneaking) return;

        const equipment = player.getComponent('minecraft:equippable');
        if (!equipment) return;

        const chestplate = equipment.getEquipment(EquipmentSlot.Chest);
        if (!chestplate) return;

        const chestplateId = chestplate.typeId;

        if (!FAZ_DIVER_CYCLE_MODES.includes(chestplateId)) return;

        const inventory = player.getComponent('minecraft:inventory');
        if (!inventory) return;
        const container = inventory.container;
        if (!container) return;

        const slot8Item = container.getItem(8);

        if (slot8Item && FAZ_DIVER_CYCLE_MODES.includes(slot8Item.typeId)) {
            system.run(() => {
                try {
                    const inv = player.getComponent('minecraft:inventory');
                    const cont = inv?.container;
                    if (cont) cont.setItem(8, undefined);

                    player.playSound('armor.equip_generic', { pitch: 1.0, volume: 1.0 });
                    sendFazDiverDeactivatedNotification(player);
                } catch { }
            });
            return;
        }

        system.run(() => {
            try {
                player.runCommand(`replaceitem entity @s slot.hotbar 8 ${chestplateId} 1 0 {"minecraft:item_lock":{"mode":"lock_in_slot"}}`);

                player.playSound('armor.equip_generic', { pitch: 1.0, volume: 1.0 });
                sendFazDiverActivatedNotification(player);
            } catch { }
        });

    } catch { }
});

system.runInterval(() => {
    const players = world.getPlayers();
    if (players.length === 0) return;
    try {
        for (const player of players) {
            const inv = player.getComponent('minecraft:inventory');
            const cont = inv?.container;
            if (!cont) continue;

            const eq = player.getComponent('minecraft:equippable');
            if (!eq) continue;
            const currentChest = eq.getEquipment(EquipmentSlot.Chest);
            const hasFazDiverBackpack = currentChest &&
                (currentChest.typeId === 'fr:faz_diver_with_item' ||
                    currentChest.typeId === 'fr:faz_diver_without_item');

            if (!hasFazDiverBackpack) {
                for (let i = 0; i < 9; i++) {
                    const item = cont.getItem(i);
                    if (item && FAZ_DIVER_CYCLE_MODES.includes(item.typeId)) {
                        try {
                            const hasLock = item.lockMode !== undefined && item.lockMode !== 'none';
                            if (hasLock) {
                                player.runCommand(`replaceitem entity @s slot.hotbar ${i} ${item.typeId} 1 0`);
                            }
                        } catch (e) {
                        }
                    }
                }
            }

            if (!currentChest || !FAZ_DIVER_CYCLE_MODES.includes(currentChest.typeId)) continue;

            const s8 = cont.getItem(8);
            if (!s8 || s8.typeId !== currentChest.typeId) {
                if (!s8) {
                    continue;
                }
            }
        }
    } catch { }
}, 10);

world.afterEvents.itemUse.subscribe((event) => {
    const { source: player, itemStack } = event;

    if (!itemStack || !FAZ_DIVER_CYCLE_MODES.includes(itemStack.typeId)) return;

    if (!player.isSneaking) {
        return;
    }

    const currentMode = itemStack.typeId;
    const nextMode = getNextMode(currentMode);

    system.run(() => {
        try {
            const slot = player.selectedSlotIndex;

            const equipment = player.getComponent('equippable');
            const chestItem = equipment?.getEquipment('Chest');
            const hasFazDiverBackpack = chestItem &&
                (chestItem.typeId === 'fr:faz_diver_with_item' ||
                    chestItem.typeId === 'fr:faz_diver_without_item');

            if (hasFazDiverBackpack) {
                player.runCommand(`replaceitem entity @s slot.hotbar ${slot} ${nextMode} 1 0 {"minecraft:item_lock":{"mode":"lock_in_slot"}}`);
            } else {
                player.runCommand(`replaceitem entity @s slot.hotbar ${slot} ${nextMode} 1 0`);
            }

            sendModeChangeNotification(player, nextMode);
            player.playSound('random.click', { pitch: 1.2, volume: 0.5 });
        } catch { }
    });
});

const WrenchInteractionComponent = {
    onUse(event) {
        const { source: player } = event;
        try {
            player.playSound('random.click', { pitch: 1.5, volume: 0.3 });
        } catch { }
    },
    onUseOn(event) {
        const { source: player } = event;
        try {
            player.playSound('random.click', { pitch: 1.5, volume: 0.3 });
        } catch { }
    }
};

system.beforeEvents.startup.subscribe(({ itemComponentRegistry }) => {
    itemComponentRegistry.registerCustomComponent('fr:wrench_interaction', WrenchInteractionComponent);
    itemComponentRegistry.registerCustomComponent('fr:faz_diver_mode_switch', {});
});

initStatueEditorSystem();

const openDrawerTimers = new Map();
const drawerHideState = new Map();
let drawerTickInterval = null;

function getDrawerFacingVector(block) {
    try {
        const f = block.permutation.getState('minecraft:cardinal_direction');
        if (f === 'north') return { x: 0, z: -1, yaw: 180 };
        if (f === 'south') return { x: 0, z: 1, yaw: 0 };
        if (f === 'east') return { x: 1, z: 0, yaw: 270 };
        if (f === 'west') return { x: -1, z: 0, yaw: 90 };
    } catch { }
    return { x: 0, z: 1, yaw: 0 };
}

function computeDrawerHidePositions(block) {
    const loc = block.location;
    const facing = getDrawerFacingVector(block);
    const insidePos = {
        x: loc.x + 0.5,
        y: loc.y + -0.8,
        z: loc.z + 0.5
    };

    const exitPos = {
        x: loc.x + 0.5 - facing.x * 1.5,
        y: loc.y,
        z: loc.z + 0.5 - facing.z * 1.5
    };
    return { insidePos, exitPos, yaw: (facing.yaw + 180) % 360 };
}

function showDrawerHideMenu(player, block, pid) {
    try {
        const data = drawerHideState.get(pid);
        if (!data) return;

        const form = new ActionFormData();
        form.title('§H§I§D§E§N');
        form.body('');
        form.button(' ');
        form.show(player).then((res) => {
            try {
                const data = drawerHideState.get(pid);
                if (!data) return;

                try { player.runCommand('hud @s reset'); } catch { }
                try { player.runCommand('effect @s invisibility 0'); } catch { }
                try { player.teleport(data.exitPos, { dimension: block.dimension, keepVelocity: false }); } catch { }

                const currentBlock = block.dimension.getBlock(block.location);
                if (currentBlock && currentBlock.typeId === "fr:kitchen_counter_drawers") {
                    const newPerm = currentBlock.permutation.withState("fr:drawer_state", "open");
                    currentBlock.setPermutation(newPerm);

                    const blockKey = `${block.dimension.id}_${block.location.x}_${block.location.y}_${block.location.z}`;
                    if (openDrawerTimers.has(blockKey)) {
                        system.clearRun(openDrawerTimers.get(blockKey));
                    }
                    const timerId = system.runTimeout(() => {
                        try {
                            const blk = block.dimension.getBlock(block.location);
                            if (blk && blk.typeId === "fr:kitchen_counter_drawers") {
                                const st = blk.permutation.getState("fr:drawer_state");
                                if (st === "open") {
                                    const closedPerm = blk.permutation.withState("fr:drawer_state", "closed");
                                    blk.setPermutation(closedPerm);
                                }
                            }
                            openDrawerTimers.delete(blockKey);
                        } catch { }
                    }, 100);
                    openDrawerTimers.set(blockKey, timerId);
                }
                drawerHideState.delete(pid);
                if (data) data.uiState = 'exited';
            } catch { }
        });
    } catch { }
}

function startDrawerTick() {
    if (drawerTickInterval !== null) return;
    drawerTickInterval = system.runInterval(() => {
        if (drawerHideState.size === 0) {
            if (drawerTickInterval !== null) {
                system.clearRun(drawerTickInterval);
                drawerTickInterval = null;
            }
            return;
        }
        for (const [pid, data] of drawerHideState) {
            const player = world.getAllPlayers().find(p => p.id === pid);
            if (!player) { drawerHideState.delete(pid); continue; }

            let dim;
            try { dim = player.dimension; } catch { }
            if (!dim) { drawerHideState.delete(pid); continue; }

            const block = dim.getBlock({ x: data.baseLoc.x, y: data.baseLoc.y, z: data.baseLoc.z });
            if (!block || block.typeId !== 'fr:kitchen_counter_drawers') {
                try { player.runCommand('hud @s reset'); } catch { }
                try { player.runCommand('effect @s invisibility 0'); } catch { }
                drawerHideState.delete(pid);
                continue;
            }

            try { player.teleport(data.insidePos, { dimension: dim, keepVelocity: false }); } catch { }

            const sneaking = player.isSneaking;
            if (sneaking && !data.lastSneak) {
                try { player.runCommand('hud @s reset'); } catch { }
                try { player.runCommand('effect @s invisibility 0'); } catch { }
                try { player.teleport(data.exitPos, { dimension: dim, keepVelocity: false }); } catch { }

                const newPerm = block.permutation.withState("fr:drawer_state", "open");
                block.setPermutation(newPerm);
                data.uiState = 'exited';
                drawerHideState.delete(pid);

                const blockKey = `${dim.id}_${block.location.x}_${block.location.y}_${block.location.z}`;
                const timerId = system.runTimeout(() => {
                    try {
                        const currentBlock = dim.getBlock(block.location);
                        if (currentBlock && currentBlock.typeId === "fr:kitchen_counter_drawers") {
                            const currentState = currentBlock.permutation.getState("fr:drawer_state");
                            if (currentState === "open") {
                                const closedPerm = currentBlock.permutation.withState("fr:drawer_state", "closed");
                                currentBlock.setPermutation(closedPerm);
                            }
                        }
                        openDrawerTimers.delete(blockKey);
                    } catch { }
                }, 100);
                openDrawerTimers.set(blockKey, timerId);
                continue;
            }
            data.lastSneak = sneaking;
        }
    }, 1);
}

function ensureDrawerTick() {
    if (drawerHideState.size > 0) startDrawerTick();
}

world.afterEvents.playerInteractWithBlock.subscribe((event) => {
    const { player, block, itemStack } = event;

    if (!block) return;

    if (block.typeId === "fr:stone_oven" && itemStack && itemStack.typeId === "minecraft:flint_and_steel") {
        system.run(() => {
            try {
                const currentLit = block.permutation.getState("fr:lit") === true;
                const newLit = !currentLit;
                const newPerm = block.permutation.withState("fr:lit", newLit);
                block.setPermutation(newPerm);

                const dim = block.dimension;
                const loc = block.location;
                for (let yOffset = -2; yOffset <= 2; yOffset++) {
                    if (yOffset === 0) continue;
                    try {
                        const neighborBlock = dim.getBlock({ x: loc.x, y: loc.y + yOffset, z: loc.z });
                        if (neighborBlock && neighborBlock.typeId === "fr:stone_oven") {
                            const neighborPerm = neighborBlock.permutation.withState("fr:lit", newLit);
                            neighborBlock.setPermutation(neighborPerm);
                        }
                    } catch { }
                }

                player.playSound(currentLit ? "extinguish.candle" : "fire.ignite");
            } catch { }
        });
        return;
    }

    if (block.typeId !== "fr:kitchen_counter_drawers") return;
    if (itemStack && itemStack.typeId === "fr:wrench") return;

    const variant = block.permutation.getState("fr:variants");
    const drawerState = block.permutation.getState("fr:drawer_state");

    if (variant === 0) return;

    const pid = player.id;
    const blockKey = `${block.dimension.id}_${block.location.x}_${block.location.y}_${block.location.z}`;

    if ((variant === 2 || variant === 3) && player.isSneaking && drawerState === "closed") {
        system.run(() => {
            try {
                const { insidePos, exitPos, yaw } = computeDrawerHidePositions(block);

                try { player.teleport(insidePos, { dimension: block.dimension, keepVelocity: false }); } catch { }
                try { player.setRotation({ x: 0, y: yaw }); } catch { }
                try { player.runCommand('hud @s hide all'); } catch { }
                try { player.runCommand('effect @s invisibility 99999 0 true'); } catch { }

                const newPerm = block.permutation.withState("fr:drawer_state", "a_bit_open");
                block.setPermutation(newPerm);
                player.playSound("random.door_open");

                drawerHideState.set(pid, {
                    baseLoc: { x: block.location.x, y: block.location.y, z: block.location.z, dim: block.dimension.id },
                    insidePos,
                    exitPos,
                    lastSneak: true,
                    uiState: 'normal'
                });
                ensureDrawerTick();

                system.run(() => showDrawerHideMenu(player, block, pid));
            } catch { }
        });
        return;
    }

    if (drawerState === "closed") {
        system.run(() => {
            try {
                const newPerm = block.permutation.withState("fr:drawer_state", "open");
                block.setPermutation(newPerm);
                player.playSound("random.door_open");

                if (openDrawerTimers.has(blockKey)) {
                    system.clearRun(openDrawerTimers.get(blockKey));
                }

                const timerId = system.runTimeout(() => {
                    try {
                        const currentBlock = block.dimension.getBlock(block.location);
                        if (currentBlock && currentBlock.typeId === "fr:kitchen_counter_drawers") {
                            const currentState = currentBlock.permutation.getState("fr:drawer_state");
                            if (currentState === "open") {
                                const closedPerm = currentBlock.permutation.withState("fr:drawer_state", "closed");
                                currentBlock.setPermutation(closedPerm);
                            }
                        }
                        openDrawerTimers.delete(blockKey);
                    } catch { }
                }, 100);

                openDrawerTimers.set(blockKey, timerId);
            } catch { }
        });
    }
});
