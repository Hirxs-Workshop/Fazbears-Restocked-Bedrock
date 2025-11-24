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


import { world, system, BlockPermutation, Direction } from "@minecraft/server";

class BigRedDoorManager {
  constructor() {
    
    world.afterEvents.worldLoad.subscribe(() => {
      if (!world.getDynamicProperty("fr:door_db")) {
        world.setDynamicProperty("fr:door_db", JSON.stringify({ processedBlocks: [], doorBases: [] }));
      }
      this.loadDoorDatabase();
    });

    this.processedBlocks = new Map();
    this.doorBases = new Map();
    this.spamClicks = new Map();
    this.doorEntities = new Map(); 

    
    system.beforeEvents.startup.subscribe((eventData) => {
      eventData.blockComponentRegistry.registerCustomComponent("fr:en_on_place", {
        onPlace: (e) => this.handleOnPlace(e)
      });
    });

    system.beforeEvents.startup.subscribe((eventData) => {
      eventData.blockComponentRegistry.registerCustomComponent("fr:en_on_interact", {
        onPlayerInteract: (e) => this.handleOnInteract(e)
      });
    });

    system.beforeEvents.startup.subscribe((eventData) => {
      eventData.blockComponentRegistry.registerCustomComponent("fr:en_on_tick", {
        onTick: (e) => this.handleOnTick(e)
      });
    });

    system.beforeEvents.startup.subscribe((eventData) => {
      eventData.blockComponentRegistry.registerCustomComponent("fr:en_on_player_destroy", {
        onPlayerDestroy: (e) => this.handleOnPlayerDestroy(e)
      }); // ㅤ ㅤ ㅤ ㅤ ㅤ ㅤ ㅤ ㅤ 
    });

    
    world.beforeEvents.playerBreakBlock.subscribe((e) => {
      if (e.block.typeId === "fr:entrance_door_block") {
        this.handleBlockBreak(e);
      }
    });
  }

  loadDoorDatabase() {
    const json = world.getDynamicProperty("fr:door_db");
    if (json) {
      const data = JSON.parse(json);
      this.processedBlocks.clear();
      this.doorBases.clear();
      for (const [k, v] of data.processedBlocks) {
        this.processedBlocks.set(k, v);
      }
      for (const [k, v] of data.doorBases) {
        this.doorBases.set(k, v);
      }
    }
  }

  saveDoorDatabase() {
    const data = {
      processedBlocks: Array.from(this.processedBlocks.entries()),
      doorBases: Array.from(this.doorBases.entries())
    };
    world.setDynamicProperty("fr:door_db", JSON.stringify(data));
  }

  getBlockKey(x, y, z) {
    return `${x},${y},${z}`;
  }

  
  getClosedOffsets(direction) {
    const offsets = [];
    switch (direction) {
      case "north":
        
        for (let y = 0; y < 3; y++) {
          for (let x = -1; x <= 1; x++) {
            offsets.push([x, 0]); 
          }
        }
        break;
      case "south":
        for (let y = 0; y < 3; y++) {
          for (let x = 1; x >= -1; x--) {
            offsets.push([x, 0]);
          }
        }
        break;
      case "west":
        for (let y = 0; y < 3; y++) {
          for (let z = -1; z <= 1; z++) {
            offsets.push([0, z]);
          }
        }
        break;
      case "east":
      default:
        for (let y = 0; y < 3; y++) {
          for (let z = 1; z >= -1; z--) {
            offsets.push([0, z]);
          }
        }
        break;
    }
    return offsets;
  }

  
  getOpenedOffsets(direction) {
    const offsets = [];
    switch (direction) {
      case "north":
        
        for (let y = 0; y < 3; y++) {
          offsets.push([-1, -1]); 
          offsets.push([1, -1]);  
        }
        
        offsets.push([-1, 0]); 
        offsets.push([1, 0]);  
        offsets.push([-1, 0]); 
        offsets.push([1, 0]);  
        offsets.push([-1, 0]); 
        offsets.push([1, 0]);  
        break;
      case "south":
        for (let y = 0; y < 3; y++) {
          offsets.push([1, 1]);   
          offsets.push([-1, 1]);  
        }
        
        offsets.push([1, 0]);  
        offsets.push([-1, 0]); 
        offsets.push([1, 0]);  
        offsets.push([-1, 0]); 
        offsets.push([1, 0]);  
        offsets.push([-1, 0]); 
        break;
      case "west":
        for (let y = 0; y < 3; y++) {
          offsets.push([-1, -1]); 
          offsets.push([-1, 1]);  
        }
        
        offsets.push([0, -1]); 
        offsets.push([0, 1]);  
        offsets.push([0, -1]); 
        offsets.push([0, 1]);  
        offsets.push([0, -1]); 
        offsets.push([0, 1]);  
        break;
      case "east":
      default: // ㅤ ㅤ ㅤ ㅤ ㅤ ㅤ ㅤ ㅤ 
        for (let y = 0; y < 3; y++) {
          offsets.push([1, 1]);   
          offsets.push([1, -1]);  
        }
        
        offsets.push([0, 1]);  
        offsets.push([0, -1]); 
        offsets.push([0, 1]);  
        offsets.push([0, -1]); 
        offsets.push([0, 1]);  
        offsets.push([0, -1]); 
        break;
    }
    return offsets;
  }

  setDoorDestroyed(dimension, pos, destroyedState) {
    const block = dimension.getBlock(pos);
    if (!block || block.typeId !== "fr:entrance_door_block") return;
    const states = block.permutation.getAllStates();
    states["fr:destroyed"] = destroyedState;
    const perm = BlockPermutation.resolve("fr:entrance_door_block", states);
    block.setPermutation(perm);
  }

  placeDoorSegments(dimension, baseX, baseY, baseZ, offsets, openState, direction) {
    const baseKey = this.getBlockKey(baseX, baseY, baseZ);
    for (let i = 0; i < offsets.length; i++) {
      const [dx, dz] = offsets[i];
      const dy = Math.floor(i / 3); 
      const blockLocation = { x: baseX + dx, y: baseY + dy, z: baseZ + dz };

      let segmentState = {};
      if (dy === 0) segmentState["fr:bottom_block_bit"] = true;
      else if (dy === 1) segmentState["fr:middle_block_bit"] = true;
      else if (dy === 2) segmentState["fr:upper_block_bit"] = true;
      segmentState["fr:value"] = i;

      const perm = BlockPermutation.resolve("fr:entrance_door_block", {
        "fr:open_bit": openState,
        "minecraft:cardinal_direction": direction,
        ...segmentState
      });
      const block = dimension.getBlock(blockLocation);
      block.setPermutation(perm);

      this.processedBlocks.set(this.getBlockKey(blockLocation.x, blockLocation.y, blockLocation.z), true);
      this.doorBases.set(this.getBlockKey(blockLocation.x, blockLocation.y, blockLocation.z), baseKey);
    }
    this.saveDoorDatabase();
  }

  activateDoorChain(dimension, baseX, baseY, baseZ, direction) {
    const offsets = this.getClosedOffsets(direction);
    for (let i = 0; i < offsets.length; i++) {
      const [dx, dz] = offsets[i];
      const dy = Math.floor(i / 3);
      const pos = { x: baseX + dx, y: baseY + dy, z: baseZ + dz };
      this.setDoorDestroyed(dimension, pos, true);
    }
  }

  
  isOpenExtraAreaBlocked(dimension, baseX, baseY, baseZ, doorDirection) {
    const closedOffsets = this.getClosedOffsets(doorDirection);
    let extraDx = 0, extraDz = 0;
    switch (doorDirection) {
      case "north": extraDz = -1; break;
      case "south": extraDz = 1; break;
      case "west": extraDx = -1; break;
      case "east": extraDx = 1; break;
      default: break;
    }
    for (let i = 0; i < closedOffsets.length; i++) {
      const [dx, dz] = closedOffsets[i];
      const dy = Math.floor(i / 3);
      const pos = { x: baseX + dx + extraDx, y: baseY + dy, z: baseZ + dz + extraDz };
      const b = dimension.getBlock(pos);
      if (b && b.typeId !== "minecraft:air" && b.typeId !== "fr:entrance_door_block") {
        return true;
      }
    }
    return false;
  }

  
  handleSpamClicks(dimension, baseX, baseY, baseZ, doorDirection, player) {
    const doorKey = this.getBlockKey(baseX, baseY, baseZ);
    if (!this.spamClicks.has(doorKey)) {
      this.spamClicks.set(doorKey, new Map());
    }
    const doorSpamMap = this.spamClicks.get(doorKey);
    const playerId = player.name;
    const now = Date.now();
    let spamData = doorSpamMap.get(playerId) || { count: 0, lastClick: now };
    if (now - spamData.lastClick > 2000) {
      spamData.count = 0;
    }
    spamData.count++;
    spamData.lastClick = now;
    doorSpamMap.set(playerId, spamData);
    const threshold = 50;
    
    if (spamData.count >= threshold) {
      const closedOffsets = this.getClosedOffsets(doorDirection);
      let extraDx = 0, extraDz = 0;
      switch (doorDirection) {
        case "north": extraDz = -1; break;
        case "south": extraDz = 1; break;
        case "west": extraDx = -1; break;
        case "east": extraDx = 1; break;
        default: break;
      }
      let minX = Infinity, minY = Infinity, minZ = Infinity;
      let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
      for (let i = 0; i < closedOffsets.length; i++) {
        const [dx, dz] = closedOffsets[i];
        const dy = Math.floor(i / 3);
        const posX = baseX + dx + extraDx;
        const posY = baseY + dy;
        const posZ = baseZ + dz + extraDz;
        if (posX < minX) minX = posX;
        if (posX > maxX) maxX = posX;
        if (posY < minY) minY = posY;
        if (posY > maxY) maxY = posY;
        if (posZ < minZ) minZ = posZ;
        if (posZ > maxZ) maxZ = posZ;
      }
      dimension.runCommand(`fill ${minX} ${minY} ${minZ} ${maxX} ${maxY} ${maxZ} air destroy`);
      player.playSound("random.break");
      doorSpamMap.set(playerId, { count: 0, lastClick: now });
    }
  }

  
  isPlayerInDoorArea(baseX, baseY, baseZ, offsets, player) {
    const pos = player.location;
    const playerX = Math.floor(pos.x);
    const playerY = Math.floor(pos.y);
    const playerZ = Math.floor(pos.z);
    for (let i = 0; i < offsets.length; i++) {
      const [dx, dz] = offsets[i]; // ㅤ ㅤ ㅤ ㅤ ㅤ ㅤ ㅤ ㅤ 
      
      let dy;
      if (offsets.length === 12) {
        
        if (i < 6) {
          dy = Math.floor(i / 2); 
        } else {
          dy = Math.floor((i - 6) / 2); 
        }
      } else {
        dy = Math.floor(i / 3); 
      }
      if (playerX === baseX + dx && playerY === baseY + dy && playerZ === baseZ + dz) {
        return true;
      }
    }
    return false;
  }

  
  pushPlayerFromArea(doorDirection, player, baseX, baseY, baseZ, offsets) {
    let sumX = 0, sumZ = 0;
    for (let i = 0; i < offsets.length; i++) {
      const [dx, dz] = offsets[i];
      sumX += baseX + dx + 0.5;
      sumZ += baseZ + dz + 0.5;
    }
    const count = offsets.length;
    const centerX = sumX / count;
    const centerZ = sumZ / count;// ㅤ ㅤ ㅤ ㅤ ㅤ ㅤ ㅤ ㅤ

    const playerX = player.location.x;
    const playerZ = player.location.z;

    let diffX = playerX - centerX;
    let diffZ = playerZ - centerZ;

    if (diffX === 0 && diffZ === 0) {
      switch (doorDirection) {
        case "north": diffZ = 1; break;
        case "south": diffZ = -1; break;
        case "east": diffX = -1; break;
        case "west": diffX = 1; break;
        default: diffZ = 1;
      }
    }

    const length = Math.sqrt(diffX * diffX + diffZ * diffZ);
    const normalizedX = diffX / length;
    const normalizedZ = diffZ / length;

    const horizontalForce = 1;
    const verticalForce = 0.5;

    player.applyKnockback({ 
      x: normalizedX * horizontalForce, 
      z: normalizedZ * horizontalForce 
    }, verticalForce);
  }

  handleOnPlace(e) {
    const { block } = e;
    if (block.permutation.getState("fr:upper_block_bit")) return;
    const { x, y, z } = block.location;
    const key = this.getBlockKey(x, y, z);
    if (this.processedBlocks.has(key)) return;
    if (block.typeId !== "fr:entrance_door_block") return;

    const states = block.permutation.getAllStates();
    const direction = states["minecraft:cardinal_direction"] || "south";
    const offsets = this.getClosedOffsets(direction);
    const dimension = block.dimension;
    if (this.isAreaBlocked(dimension, x, y, z, offsets)) {
      block.setType("minecraft:air");
      return;
    }
    this.placeDoorSegments(dimension, x, y, z, offsets, "closed", direction);
    this.activateDoorChain(dimension, x, y, z, direction);

    
    const entity = block.dimension.spawnEntity("fr:entrance_door", { x: x + 0.5, y: y, z: z + 0.5 });
    
    
    let yRotation = 0;
    switch (direction) {
      case "north":
        yRotation = 0;
        break;
      case "south":
        yRotation = 180;
        break;
      case "east":
        yRotation = 90;
        break;
      case "west":
        yRotation = 270;
        break;
    }
    
    
    entity.setRotation({ x: 0, y: yRotation });
    
    this.doorEntities.set(key, entity.id);

    this.processedBlocks.set(key, true);
    this.saveDoorDatabase();
  }

  handleOnInteract(e) {
    const { block, player } = e;
    if (block.typeId !== "fr:entrance_door_block") return;
    const states = block.permutation.getAllStates();

    const doorDirection = states["minecraft:cardinal_direction"] || "south";
    const isOpen = states["fr:open_bit"] !== "closed";
    const openSide = states["fr:open_bit"] === "open_left" ? "left" : states["fr:open_bit"] === "open_right" ? "right" : null;
    const currentKey = this.getBlockKey(block.location.x, block.location.y, block.location.z);
    let baseKey = this.doorBases.get(currentKey) || currentKey;
    const [baseX, baseY, baseZ] = baseKey.split(",").map(Number);
    const dimension = block.dimension;

    if (isOpen && this.isOpenExtraAreaBlocked(dimension, baseX, baseY, baseZ, doorDirection)) {
      this.handleSpamClicks(dimension, baseX, baseY, baseZ, doorDirection, player);
      player.playSound('mob.zombie.wood');
      return;
    }

    const offsetsNew = !isOpen ? this.getOpenedOffsets(doorDirection) : this.getClosedOffsets(doorDirection);
    if (this.isAreaBlocked(dimension, baseX, baseY, baseZ, offsetsNew)) {
      player.playSound('mob.zombie.wood');
      return;
    }

    const closedOffsets = this.getClosedOffsets(doorDirection);
    const openedOffsets = this.getOpenedOffsets(doorDirection);
    const newOpenState = !isOpen;
    const newOpenSide = newOpenState ? (Math.random() > 0.5 ? "open_left" : "open_right") : "closed";

    const updateSegment = (pos, stateOffset, index) => {
      const dy = stateOffset.dy;
      let segmentState = {};
      if (dy === 0) segmentState["fr:bottom_block_bit"] = true;
      else if (dy === 1) segmentState["fr:middle_block_bit"] = true;
      else if (dy === 2) segmentState["fr:upper_block_bit"] = true;
      segmentState["fr:destroyed"] = false;
      segmentState["fr:value"] = index;
      const perm = BlockPermutation.resolve("fr:entrance_door_block", {
        "fr:open_bit": newOpenSide,
        "minecraft:cardinal_direction": doorDirection,
        ...segmentState
      });
      const targetBlock = dimension.getBlock(pos);
      targetBlock.setPermutation(perm);
      this.processedBlocks.set(this.getBlockKey(pos.x, pos.y, pos.z), true);
      this.doorBases.set(this.getBlockKey(pos.x, pos.y, pos.z), baseKey);
    };

    
    const offsetsOld = isOpen ? openedOffsets : closedOffsets;
    for (let i = 0; i < offsetsOld.length; i++) {
      const [oldDx, oldDz] = offsetsOld[i];
      let dy;
      if (isOpen) {
        
        if (i < 6) {
          dy = Math.floor(i / 2); 
        } else {
          dy = Math.floor((i - 6) / 2); 
        }
      } else {
        dy = Math.floor(i / 3); 
      }
      const oldPos = { x: baseX + oldDx, y: baseY + dy, z: baseZ + oldDz };
      const oldBlock = dimension.getBlock(oldPos);
      if (oldBlock && oldBlock.typeId === "fr:entrance_door_block") {
        oldBlock.setType("minecraft:air");
        this.processedBlocks.delete(this.getBlockKey(oldPos.x, oldPos.y, oldPos.z));
        this.doorBases.delete(this.getBlockKey(oldPos.x, oldPos.y, oldPos.z));
      }
    }

    
    for (let i = 0; i < offsetsNew.length; i++) {
      const [newDx, newDz] = offsetsNew[i];
      
      let dy;
      if (newOpenState) {
        
        if (i < 6) {
          dy = Math.floor(i / 2); 
        } else {
          dy = Math.floor((i - 6) / 2); 
        }
      } else {
        dy = Math.floor(i / 3); 
      }
      const newPos = { x: baseX + newDx, y: baseY + dy, z: baseZ + newDz };
      
      let segmentState = {};
      if (dy === 0) segmentState["fr:bottom_block_bit"] = true;
      else if (dy === 1) segmentState["fr:middle_block_bit"] = true;
      else if (dy === 2) segmentState["fr:upper_block_bit"] = true;
      segmentState["fr:destroyed"] = false;
      segmentState["fr:value"] = i;

      
      let segOpenBit = "closed";
      if (newOpenState) {
        switch (doorDirection) {
          case "north":
            
            segOpenBit = newDx < 0 ? "open_left" : "open_right";
            break;
          case "south":
            
            segOpenBit = newDx > 0 ? "open_left" : "open_right";
            break;
          case "west":
            
            segOpenBit = newDz > 0 ? "open_left" : "open_right";
            break;
          case "east":
          default:
            
            segOpenBit = newDz < 0 ? "open_left" : "open_right";
            break;
        }
      }
// ㅤ ㅤ ㅤ ㅤ ㅤ ㅤ ㅤ ㅤ
      const perm = BlockPermutation.resolve("fr:entrance_door_block", {
        "fr:open_bit": segOpenBit,
        "minecraft:cardinal_direction": doorDirection,
        ...segmentState
      });
      const targetBlock = dimension.getBlock(newPos);
      targetBlock.setPermutation(perm);
      this.processedBlocks.set(this.getBlockKey(newPos.x, newPos.y, newPos.z), true);
      this.doorBases.set(this.getBlockKey(newPos.x, newPos.y, newPos.z), baseKey);
    }

    if (newOpenState) player.playSound("open.wooden_door");
    else player.playSound("close.wooden_door");

    
    system.runTimeout(() => {
      const targetValue = newOpenState ? 7 : 2;
      const offsets = newOpenState ? openedOffsets : closedOffsets;
      
      for (let i = 0; i < offsets.length; i++) {
        const [dx, dz] = offsets[i];
        let dy;
        if (newOpenState) {
          if (i < 6) {
            dy = Math.floor(i / 2);
          } else {
            dy = Math.floor((i - 6) / 2);
          }
        } else {
          dy = Math.floor(i / 3);
        }
        const pos = { x: baseX + dx, y: baseY + dy, z: baseZ + dz };
        const block = dimension.getBlock(pos);
        if (block && block.typeId === "fr:entrance_door_block") {
          const blockStates = block.permutation.getAllStates();
          if (blockStates["fr:value"] === targetValue && blockStates["fr:bottom_block_bit"]) {
            
            const eventName = newOpenState ? "open_door" : "close_door";
            
            let targetEntity = null;
            
            const storedId = this.doorEntities.get(baseKey);
            if (storedId) {
              try { targetEntity = dimension.getEntity(storedId); } catch (_) { targetEntity = null; }
            }
            
            if (!targetEntity) {
              const nearby = dimension.getEntities({
                type: "fr:entrance_door",
                location: { x: baseX + 0.5, y: baseY, z: baseZ + 0.5 },
                maxDistance: 2
              });
              if (nearby && nearby.length > 0) targetEntity = nearby[0];
            }
            if (targetEntity) {
              targetEntity.triggerEvent(eventName);
            } else {
              player.sendMessage(`Â§cNo door entity found near base ${baseX},${baseY},${baseZ}`);
            }
            break;
          }
        }
      }
    }, 2);

    system.runTimeout(() => {
      const offsetsToActivate = newOpenState ? openedOffsets : closedOffsets;
      for (let i = 0; i < offsetsToActivate.length; i++) {
        const [dx, dz] = offsetsToActivate[i];
        let dy;
        if (newOpenState) {
          
          if (i < 6) {
            dy = Math.floor(i / 2); 
          } else {
            dy = Math.floor((i - 6) / 2); 
          }
        } else {
          dy = Math.floor(i / 3); 
        }
        const pos = { x: baseX + dx, y: baseY + dy, z: baseZ + dz };
        this.setDoorDestroyed(dimension, pos, true);
      }
    }, 1);

    
    if (newOpenSide === "closed") {
      const closedArea = this.getClosedOffsets(doorDirection);
      const openArea = this.getOpenedOffsets(doorDirection);
      const insideClosed = this.isPlayerInDoorArea(baseX, baseY, baseZ, closedArea, player);
      const insideOpened = this.isPlayerInDoorArea(baseX, baseY, baseZ, openArea, player);
      if (insideClosed || insideOpened) {
        this.pushPlayerFromArea(doorDirection, player, baseX, baseY, baseZ, closedArea);
      }
    }
    this.saveDoorDatabase();
  }

  isAreaBlocked(dimension, baseX, baseY, baseZ, offsets) {
    for (let i = 0; i < offsets.length; i++) {
      const [dx, dz] = offsets[i];
      
      let dy;
      if (offsets.length === 12) {
        
        if (i < 6) {
          dy = Math.floor(i / 2); 
        } else {
          dy = Math.floor((i - 6) / 2); 
        }
      } else {
        dy = Math.floor(i / 3); 
      }
      const pos = { x: baseX + dx, y: baseY + dy, z: baseZ + dz };
      const b = dimension.getBlock(pos);
      if (b && b.typeId !== "minecraft:air" && b.typeId !== "fr:entrance_door_block") {
        return true;
      }
    }
    return false;
  }

  handleOnTick(e) {
    const { block } = e;
    if (block.typeId !== "fr:entrance_door_block") return;
    const states = block.permutation.getAllStates();
    if (!states["fr:destroyed"]) return;

    const loc = block.location;
    const dimension = block.dimension;
    const currentKey = this.getBlockKey(loc.x, loc.y, loc.z);
    const baseKey = this.doorBases.get(currentKey);
    if (!baseKey) return;
    const [baseX, baseY, baseZ] = baseKey.split(",").map(Number);
    const direction = states["minecraft:cardinal_direction"] || "south";
    const openState = states["fr:open_bit"] !== "closed";
    const offsets = openState ? this.getOpenedOffsets(direction) : this.getClosedOffsets(direction);

    let doorIntact = true;
    for (let i = 0; i < offsets.length; i++) {
      const [dx, dz] = offsets[i];
      
      let dy;
      if (offsets.length === 12) {
        
        if (i < 6) {
          dy = Math.floor(i / 2); 
        } else {
          dy = Math.floor((i - 6) / 2); 
        }
      } else {
        dy = Math.floor(i / 3); 
      }
      const pos = { x: baseX + dx, y: baseY + dy, z: baseZ + dz };
      const b = dimension.getBlock(pos);
      if (!b || b.typeId !== "fr:entrance_door_block") {
        doorIntact = false;
        break;
      }
    }
    if (!doorIntact) {
       // ㅤ ㅤ ㅤ ㅤ ㅤ ㅤ ㅤ ㅤ 
      let targetEntity = null;
      const entityId = this.doorEntities.get(baseKey);
      
      if (entityId) {
        try { targetEntity = dimension.getEntity(entityId); } catch (_) { targetEntity = null; }
      }
      
      
      if (!targetEntity) {
        try {
          const nearby = dimension.getEntities({
            type: "fr:entrance_door",
            location: { x: baseX + 0.5, y: baseY, z: baseZ + 0.5 },
            maxDistance: 2
          });
          if (nearby && nearby.length > 0) targetEntity = nearby[0];
        } catch (_) {}
      }
      
      if (targetEntity) {
        try {
          targetEntity.triggerEvent("destroy");
        } catch (err) {
          
          try { targetEntity.remove(); } catch (_) {}
        }
      }
      
      this.doorEntities.delete(baseKey);

      for (const [segmentKey, registeredBase] of this.doorBases.entries()) {
        if (registeredBase === baseKey) {
          const [x, y, z] = segmentKey.split(",").map(Number);
          const segBlock = dimension.getBlock({ x, y, z });
          if (segBlock && segBlock.typeId === "fr:entrance_door_block") {
            segBlock.setType("minecraft:air");
          }
          this.processedBlocks.delete(segmentKey);
          this.doorBases.delete(segmentKey);
        }
      }
      this.saveDoorDatabase();
    }
  }

  handleOnPlayerDestroy(e) {
    const { block, player } = e;
    if (block.typeId !== "fr:entrance_door_block") return;

    this.destroyDoorEntity(block, player);
  }

  handleBlockBreak(e) {
    const { block, player } = e;
    this.destroyDoorEntity(block, player);
  }

  destroyDoorEntity(block, player) {
    const loc = block.location;
    const dimension = block.dimension;
    const currentKey = this.getBlockKey(loc.x, loc.y, loc.z);
    const baseKey = this.doorBases.get(currentKey);
    
    if (baseKey) {
      const [baseX, baseY, baseZ] = baseKey.split(",").map(Number);
      
      
      system.runTimeout(() => {
        let targetEntity = null;
        
        const storedId = this.doorEntities.get(baseKey);
        if (storedId) {
          try { targetEntity = dimension.getEntity(storedId); } catch (_) { targetEntity = null; }
        }
        
        if (!targetEntity) {
          const nearby = dimension.getEntities({
            type: "fr:entrance_door",
            location: { x: baseX + 0.5, y: baseY, z: baseZ + 0.5 },
            maxDistance: 2
          });
          if (nearby && nearby.length > 0) targetEntity = nearby[0];
        }
        if (targetEntity) {
          try {
            targetEntity.triggerEvent("destroy");
          } catch (err) {
            
            try { targetEntity.remove(); } catch (_) {}
          }
        }
      }, 1);

      
      try {
        
        const baseBlock = dimension.getBlock({ x: baseX, y: baseY, z: baseZ });
        let direction = "south";
        if (baseBlock) {
          try {
            const s = baseBlock.permutation.getAllStates();
            direction = s["minecraft:cardinal_direction"] || direction;
          } catch (_) {}
        }
        const closed = this.getClosedOffsets(direction);
        const opened = this.getOpenedOffsets(direction);
        const applyDestroyed = (offsets) => {
          for (let i = 0; i < offsets.length; i++) {
            const [dx, dz] = offsets[i];
            let dy;
            if (offsets.length === 12) {
              if (i < 6) dy = Math.floor(i / 2); else dy = Math.floor((i - 6) / 2);
            } else {
              dy = Math.floor(i / 3);
            }
            const pos = { x: baseX + dx, y: baseY + dy, z: baseZ + dz };
            this.setDoorDestroyed(dimension, pos, true);
          }
        };
        applyDestroyed(closed);
        applyDestroyed(opened); // ㅤ ㅤ ㅤ ㅤ ㅤ ㅤ ㅤ ㅤ 
      } catch (_) {}
      
      
      this.doorEntities.delete(baseKey);
    } else {
      
    }
  }
}

const bigRedDoorManager = new BigRedDoorManager();
