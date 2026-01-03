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



import { system, world, BlockPermutation, ItemStack } from "@minecraft/server";
system.beforeEvents.startup.subscribe(initEvent => {
    initEvent.blockComponentRegistry.registerCustomComponent('fr:modular_desk', {
        onPlace: (e) => {
            let block = e.block;
            let direction = block.permutation.getState('minecraft:cardinal_direction');
            if (direction === 'north' || direction === 'south') {
                deskEx(block, 'east', 'west', direction, 'desk');
            } else {
                deskEx(block, 'north', 'south', direction, 'desk');
            };
        },
        onPlayerDestroy: (e) => {
            let block = e.block;
            let prevPerm = e.destroyedBlockPermutation;
            if (!prevPerm || !prevPerm.type) return;
            const processed = new Set();
            ['west', 'east', 'north', 'south'].forEach(dir => {
                try {
                    const nb = block[dir]();
                    if (!nb || nb.typeId !== prevPerm.type.id) return;
                    const key = `${nb.location.x},${nb.location.y},${nb.location.z}`;
                    if (processed.has(key)) return;
                    processed.add(key);
                    const nbFacing = nb.permutation.getState('minecraft:cardinal_direction');
                    system.run(() => {
                        if (nbFacing === 'north' || nbFacing === 'south') {
                            deskEx(nb, 'east', 'west', nbFacing, 'desk');
                        } else {
                            deskEx(nb, 'north', 'south', nbFacing, 'desk');
                        }
                    });
                } catch {}
            });
        }
    });
});
function normalizeDirection(direction) {
    if (direction === 'south') return 'north';
    if (direction === 'west') return 'east';
    return direction;
}
function modifyDeskFunction(block, start, end, settingType) {
    if (start.x === end.x && start.z === end.z) {
        let height = block.below().isAir ? 2 : 1;
        block.setPermutation(BlockPermutation.resolve(block.typeId, { 'fbd:d_state': 'both', 'fbd:height': height, 'minecraft:cardinal_direction': normalizeDirection(block.permutation.getState('minecraft:cardinal_direction')) }));
        return
    };
    [start, end] = (start.x > end.x || (start.x === end.x && start.z > end.z)) ? [end, start] : [start, end];
    const [xStart, yNorm, zStart] = [start.x, start.y, start.z];
    const [xEnd, zEnd] = [end.x, end.z];
    let finalDirection = normalizeDirection(block.permutation.getState('minecraft:cardinal_direction'));
    if (settingType === 'normal') {
        if (xStart !== xEnd) {
            for (let xLoop = Math.min(xStart, xEnd) + 1; xLoop < Math.max(xStart, xEnd); xLoop++) {
                const targetBlock = block.dimension.getBlock({ x: xLoop, y: yNorm, z: zStart });
                const newPerm = modifyPermutation(targetBlock, 'fbd:height', 1);
                if (newPerm && targetBlock) {
                    targetBlock.setPermutation(newPerm);
                }
            }
        } else {
            for (let zLoop = Math.min(zStart, zEnd) + 1; zLoop < Math.max(zStart, zEnd); zLoop++) {
                const targetBlock = block.dimension.getBlock({ x: xStart, y: yNorm, z: zLoop });
                const newPerm = modifyPermutation(targetBlock, 'fbd:height', 1);
                if (newPerm && targetBlock) {
                    targetBlock.setPermutation(newPerm);
                }
            }
        };
        block.dimension.getBlock(start).below().isAir ? block.dimension.getBlock(start).setPermutation(BlockPermutation.resolve(block.typeId, { 'fbd:d_state': 'open_left', 'fbd:height': 2, 'minecraft:cardinal_direction': finalDirection })) : undefined;
        block.dimension.getBlock(end).below().isAir ? block.dimension.getBlock(end).setPermutation(BlockPermutation.resolve(block.typeId, { 'fbd:d_state': 'open_right', 'fbd:height': 2, 'minecraft:cardinal_direction': finalDirection })) : undefined;
    } else if (settingType === 'closed') {
        if (xStart !== xEnd) {
            for (let xLoop = Math.min(xStart, xEnd); xLoop <= Math.max(xStart, xEnd); xLoop++) {
                let selectedBlock = block.dimension.getBlock({ x: xLoop, y: yNorm, z: zStart });
                let height = selectedBlock.below().isAir ? 2 : 1;
                selectedBlock.setPermutation(BlockPermutation.resolve(block.typeId, { 'fbd:d_state': 'none', 'fbd:is_closed': true, 'fbd:height': height, 'minecraft:cardinal_direction': finalDirection }));
            }
        } else {
            for (let zLoop = Math.min(zStart, zEnd); zLoop <= Math.max(zStart, zEnd); zLoop++) {
                let selectedBlock = block.dimension.getBlock({ x: xStart, y: yNorm, z: zLoop });
                let height = selectedBlock.below().isAir ? 2 : 1;
                selectedBlock.setPermutation(BlockPermutation.resolve(block.typeId, { 'fbd:d_state': 'none', 'fbd:is_closed': true, 'fbd:height': height, 'minecraft:cardinal_direction': finalDirection }));
            }
        };// ㅤ ㅤ ㅤ ㅤ ㅤ ㅤ ㅤ ㅤ 
    }
}
function modifyDesk(block, start, end) {
    if (start.x === end.x && start.z === end.z) {
        const newPerm = modifyPermutation(block, 'fbd:desk_state_sides', 'both');
        if (newPerm) {
            block.setPermutation(newPerm);
        }
        return
    };
    [start, end] = (start.x > end.x || (start.x === end.x && start.z > end.z)) ? [end, start] : [start, end];
    const [xStart, yNorm, zStart] = [start.x, start.y, start.z];
    const [xEnd, zEnd] = [end.x, end.z];
    try {
        if (xStart !== xEnd) {
            for (let xLoop = Math.min(xStart, xEnd) + 1; xLoop < Math.max(xStart, xEnd); xLoop++) {
                const midBlock = block.dimension.getBlock({ x: xLoop, y: yNorm, z: zStart });
                const newPerm = modifyPermutation(midBlock, 'fbd:desk_state_sides', 'none');
                if (newPerm && midBlock) {
                    midBlock.setPermutation(newPerm);
                }
            }
        } else {
            for (let zLoop = Math.min(zStart, zEnd) + 1; zLoop < Math.max(zStart, zEnd); zLoop++) {
                const midBlock = block.dimension.getBlock({ x: xStart, y: yNorm, z: zLoop });
                const newPerm = modifyPermutation(midBlock, 'fbd:desk_state_sides', 'none');
                if (newPerm && midBlock) {
                    midBlock.setPermutation(newPerm);
                }
            }
        };
        let deskDirection = block.permutation.getState('minecraft:cardinal_direction');
        let startDirection = (deskDirection === 'north' || deskDirection === 'east') ? 'left' : 'right';
        let endDirection = startDirection === 'left' ? 'right' : 'left';
        
        const startBlock = block.dimension.getBlock(start);
        const endBlock = block.dimension.getBlock(end);
        
        const startPerm = modifyPermutation(startBlock, 'fbd:desk_state_sides', startDirection);
        const endPerm = modifyPermutation(endBlock, 'fbd:desk_state_sides', endDirection);
        
        if (startPerm && startBlock) {
            startBlock.setPermutation(startPerm);
        }
        if (endPerm && endBlock) {
            endBlock.setPermutation(endPerm);
        }
    } catch (error) {
        return;
    };
}
function deskEx(block, direction1, direction2, settingType, option) {
    let start = block.location;
    let end = block.location;
    let blockDirection = (settingType === "normal" || settingType === "closed") ? normalizeDirection(block.permutation.getState('minecraft:cardinal_direction')) : block.permutation.getState('minecraft:cardinal_direction');
    let current = block;
    let strict = false;
    while (isMatchingBlock(current[direction1](), block.typeId, blockDirection, strict)) {
        end = current[direction1]().location;
        current = current[direction1]();
    }
    current = block;
    while (isMatchingBlock(current[direction2](), block.typeId, blockDirection, strict)) {
        start = current[direction2]().location;
        current = current[direction2]();
    }
    option === 'curtain' ? modifyDeskFunction(block, start, end, settingType) : modifyDesk(block, start, end);
}
function isMatchingBlock(block, typeId, direction, restrict) {
    if (block?.typeId !== typeId) return false;
    let blockDirection = block.permutation.getState('minecraft:cardinal_direction');
    if (restrict) return blockDirection === direction;
    return normalizeDirection(blockDirection) === normalizeDirection(direction);
}

function axesForFacing(facing) {
    const n = normalizeDirection(facing);
    return n === 'north' ? ['east', 'west'] : ['north', 'south'];
}

function hasDeskNeighborInAxes(center, axes) {
    try {
        const typeId = center.typeId;
        const dir = center.permutation.getState('minecraft:cardinal_direction');
        for (const a of axes) {
            const nb = center[a]();
            if (isMatchingBlock(nb, typeId, dir, false)) return true;
        }
    } catch {}
    return false;
}

function ensureIsolatedAsBoth(center) {
    try {
        const axes = axesForFacing(center.permutation.getState('minecraft:cardinal_direction'));
        if (!hasDeskNeighborInAxes(center, axes)) {
            const newPerm = modifyPermutation(center, 'fbd:desk_state_sides', 'both');
            if (newPerm) {
                center.setPermutation(newPerm);
            }
        }
    } catch {}
}
function modifyPermutation(block, permutationName, state) {
    if (!block || block.typeId === 'minecraft:air') {
        return null;
    }
    
    try {
        block.permutation.getState(permutationName);
        return block.permutation.withState(permutationName, state);
    } catch (error) {
        return null;
    }
};
world.afterEvents.playerPlaceBlock.subscribe((e) => {
    let blockPerm = e.permutationBeingPlaced;
    if (!blockPerm || !blockPerm.type) return;
    let blockId = blockPerm.type.id;
    let face = e.face;
    let block = e.block;
    let aboveBlock = block.above();
    if (aboveBlock && aboveBlock.typeId && aboveBlock.typeId.endsWith('_curtain')) {
        const newPerm = modifyPermutation(aboveBlock, 'fbd:height', 1);
        if (newPerm) {
            block.dimension.getBlock(aboveBlock.location).setPermutation(newPerm);
        }
    }
    if (block.typeId.startsWith('fbd:') && block.below().typeId === 'fbd:furniture_design') {
        block.dimension.playSound('fbd.saw', block.location)
        let blockTrait = traitList.find(trait => block.typeId.includes(trait)) + '_' || '';
        let bareName = block.typeId.replace('fbd:', '').replace(blockTrait, '');
        let decomposed = decomposedMaterial[bareName];// ㅤ ㅤ ㅤ ㅤ ㅤ ㅤ ㅤ ㅤ 
        for (let key in decomposed) {
            if (decomposed.hasOwnProperty(key)) {
                if (key.startsWith('$')) {
                    block.dimension.spawnItem(new ItemStack('minecraft:' + blockTrait + key.replace('$', ''), decomposed[key]), block.center());
                } else {
                    block.dimension.spawnItem(new ItemStack('minecraft:' + key, decomposed[key]), block.center());
                }
            }
        };
        if (block.typeId.endsWith('based_grandfather_clock') && aboveBlock) aboveBlock.setPermutation(BlockPermutation.resolve('minecraft:air'));
        block.setPermutation(BlockPermutation.resolve('minecraft:air'));
    }
});
function normalizeAndRotate(d) {
    return ['north', 'west', 'south', 'east'][(['north', 'west', 'south', 'east'].indexOf(d) + 1) % 4];
}
world.afterEvents.playerPlaceBlock.subscribe((e) => {
    let blockPerm = e.permutationBeingPlaced;
    if (!blockPerm || !blockPerm.type) return;
    let blockId = blockPerm.type.id;
    let face = e.face;
    if (blockId.endsWith('_lamp') || blockId === 'fbd:wind_bell' || blockId === 'fbd:item_sign') {
        if (face !== 'Up' && face !== 'Down') {
            let faceToSet = blockId === 'fbd:item_sign' ? normalizeAndRotate(face.toLowerCase()) : face.toLowerCase();
            system.run(() => {
                e.block.setPermutation(BlockPermutation.resolve(blockId, { 'fbd:wall_bit': true, 'minecraft:cardinal_direction': faceToSet }));
            });
        };
    };
    if (blockId === 'fbd:clock') {
        if (face !== 'Up' && face !== 'Down') {
            system.run(() => {
                e.block.setPermutation(BlockPermutation.resolve(blockId, { 'minecraft:cardinal_direction': face.toLowerCase() }));
            });
        };
    };
    if (blockId === "fbd:piano") {
        let { block } = e;
        if (block.below().typeId === 'fbd:furniture_design') return;
        let rotation = blockPerm.getState('minecraft:cardinal_direction');
        let directions = rotation === "south" || rotation === "north" ? ["east", "west"] : ["north", "south"];
        let sideTest = directions.find(dir => block[dir]().isAir);
        let upperTest = block.above().isAir;
        let pointTest = block[rotation](-1).isAir;
        if (sideTest && upperTest && pointTest) {
            let cardinalDirection = blockPerm.getState('minecraft:cardinal_direction');
            let pointUpperTest = block[rotation](-1).above().isAir;
            let sidePointTest = block[sideTest]()[rotation](-1).isAir;
            let sideUpperTest = sideTest ? block[sideTest]().above().isAir : false;
            if (pointUpperTest && sideUpperTest && sidePointTest) {
                const d = ['north', 'east', 'south', 'west'];
                let firstPart = d.indexOf(sideTest) === (d.indexOf(cardinalDirection) + 1) % 4 || d.indexOf(sideTest) === (d.indexOf(cardinalDirection) + 2) % 4 ? "left" : "right";
                let secondPart = firstPart === "left" ? "right" : "left";
                system.run(() => {
                    const emptyBlock = BlockPermutation.resolve('fbd:empty_block', { 'minecraft:cardinal_direction': cardinalDirection });
                    block.setPermutation(BlockPermutation.resolve('fbd:' + firstPart + '_piano', { 'minecraft:cardinal_direction': cardinalDirection }));
                    block[sideTest]().setPermutation(BlockPermutation.resolve('fbd:' + secondPart + '_piano', { 'minecraft:cardinal_direction': cardinalDirection }));
                    block[rotation](-1).setPermutation(emptyBlock);
                    block[sideTest]()[rotation](-1).setPermutation(emptyBlock);
                    block.above().setPermutation(emptyBlock);
                    block[sideTest]().above().setPermutation(emptyBlock);
                });
            } else {
                e.cancel = true;
            }
        } else {
            e.cancel = true;
        }
    }
});
world.afterEvents.playerBreakBlock.subscribe((e) => {
    let block = e.block;
    let aboveBlock = block.above();
    if (aboveBlock && aboveBlock.typeId && aboveBlock.typeId.endsWith('_curtain')) {
        const newPerm = modifyPermutation(aboveBlock, 'fbd:height', 2);
        if (newPerm) {
            block.dimension.getBlock(aboveBlock.location).setPermutation(newPerm);
        }
    }
    
    let shouldProcessDesk = false;
    try {
        block.permutation?.getState('fbd:desk_state_sides');
        shouldProcessDesk = true;
    } catch {
        try { 
            const dirs = ['west','east','north','south'];
            for (const dir of dirs) {
                let nb;
                try { nb = block[dir](); } catch {}
                if (!nb) continue;
                try { 
                    nb.permutation.getState('fbd:desk_state_sides'); 
                    shouldProcessDesk = true;
                    break;
                } catch {}
            }
        } catch {}
    }
    
    if (!shouldProcessDesk) return;
    
    try {
        const dirs = ['west','east','north','south'];
        const processed = new Set();
        for (const dir of dirs) {
            let nb;
            try { nb = block[dir](); } catch {}
            if (!nb) continue;
            let isDesk = false;
            try { nb.permutation.getState('fbd:desk_state_sides'); isDesk = true; } catch {}
            if (!isDesk) continue;
            const key = `${nb.location.x},${nb.location.y},${nb.location.z}`;
            if (processed.has(key)) continue;
            processed.add(key);
            const nbFacing = nb.permutation.getState('minecraft:cardinal_direction');
            system.run(() => {
                if (nbFacing === 'north' || nbFacing === 'south') {
                    deskEx(nb, 'east', 'west', nbFacing, 'desk');
                } else {
                    deskEx(nb, 'north', 'south', nbFacing, 'desk');
                }
            });
        }
    } catch {}
});
function removeOneChest(block) {
    block.dimension.getEntities({ type: 'minecraft:item', name: 'Chest', location: block.location }).forEach((item) => {
        let currentItemStack = item.getComponent("item").itemStack;
        if (currentItemStack.amount > 1) { currentItemStack.amount = currentItemStack.amount - 1 } else { item.remove() };
        return;
    });
}// ㅤ ㅤ ㅤ ㅤ ㅤ ㅤ ㅤ ㅤ 
