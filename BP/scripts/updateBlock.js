import { world, system, BlockPermutation, Direction } from "@minecraft/server";
import { ActionFormData, ModalFormData, MessageFormData } from "@minecraft/server-ui";

class DoorManager {
  constructor() {
    this.doorBlockToEntity = {
      "fr:backstage_door_block": "fr:backstage_door",
      "fr:red_party_door_block": "fr:red_party_door",
      "fr:blue_party_door_block": "fr:blue_party_door",
      "fr:purple_party_door_block": "fr:purple_party_door",
      "fr:blank_door_block": "fr:blank_door"
    };

    this.doorEntityToBlock = {
      "fr:backstage_door": "fr:backstage_door_block",
      "fr:red_party_door": "fr:red_party_door_block",
      "fr:blue_party_door": "fr:blue_party_door_block",
      "fr:purple_party_door": "fr:purple_party_door_block",
      "fr:blank_door": "fr:blank_door_block"
    };

    world.afterEvents.worldLoad.subscribe(() => {
      if (!world.getDynamicProperty("fr:backstage_door_block_db")) {
        world.setDynamicProperty("fr:backstage_door_block_db", JSON.stringify({ processedBlocks: [], doorBases: [], baseDimensions: [], stickyOpenBases: [] }));
      }
      
      this.loadDoorDatabase();
    });

    this.processedBlocks = new Map();
    this.doorBases = new Map();
    this.baseDimensions = new Map();
    this.stickyOpenBases = new Set();
    this.spamClicks = new Map();
    this.animKnock = new Map();
    this.doorEntities = new Map();
    this.doorOpenDirections = new Map();
    this.doorBlockTypes = new Map();

    system.afterEvents.scriptEventReceive.subscribe((data) => {
      const { id, sourceEntity, message } = data;
      if (id === 'fr:main') {
        sourceEntity?.sendMessage?.(this.dynamicToastEvent(message));
        return;
      }
      if (id === 'fr:backstage_door_block_open_nearby' || id === 'fr:backstage_door_block_close_nearby' || id === 'fr:backstage_door_block_toggle_nearby') {
        if (!sourceEntity) return;
        const dimension = sourceEntity.dimension;
        const loc = sourceEntity.location;
        const target = this.findNearestDoorBase(dimension, Math.floor(loc.x), Math.floor(loc.y), Math.floor(loc.z), 2);
        if (!target) return;
        const { baseX, baseY, baseZ } = target;
        const forceState = (id === 'fr:backstage_door_block_open_nearby') ? true : (id === 'fr:backstage_door_block_close_nearby' ? false : undefined);
        this.toggleDoorByBase(dimension, baseX, baseY, baseZ, forceState);
      }
    });

    system.beforeEvents.startup.subscribe((eventData) => {
      eventData.blockComponentRegistry.registerCustomComponent("fr:on_place", {
        onPlace: (e) => this.handleOnPlace(e)
      });
    });

    system.beforeEvents.startup.subscribe((eventData) => {
      eventData.blockComponentRegistry.registerCustomComponent("fr:on_interact", {
        onPlayerInteract: (e) => this.handleOnInteract(e)
      });
    });

    system.beforeEvents.startup.subscribe((eventData) => {
      eventData.blockComponentRegistry.registerCustomComponent("fr:on_tick", {
        onTick: (e) => this.handleOnTick(e)
      });
    });

    world.afterEvents.worldLoad.subscribe(() => {
      const dimension = world.getDimension("overworld");
      this.rescanDoors(dimension, -20, 0, -20, 20, 10, 20);
    });

    system.runInterval(() => {
      this.assistAnimatronicsWithDoors();
      this.closeIdleDoors();
    }, 20);
  }

  assistAnimatronicsWithDoors() {
    const dimensions = ["overworld", "nether", "the_end"];
    let hasAnyAnimatronics = false;
    for (const dimId of dimensions) {
      const dim = world.getDimension(dimId);
      if (!dim) continue;
      const animas = dim.getEntities({ families: ["animatronic"] });
      if (animas.length === 0) continue;
      hasAnyAnimatronics = true;
      for (const e of animas) {
        const loc = e.location;
        const target = this.findNearestDoorBase(dim, Math.floor(loc.x), Math.floor(loc.y), Math.floor(loc.z), 2);
        if (!target) continue;
        if (!target.isOpen) {
          const baseBlock = dim.getBlock({ x: target.baseX, y: target.baseY, z: target.baseZ });
          if (!baseBlock) continue;
          this.toggleDoorByBase(dim, target.baseX, target.baseY, target.baseZ, true);
        }
      }
    }
  }

  scheduleDoorKnocks(baseKey, dimension, baseX, baseY, baseZ) {
    const now = Date.now();
    const entry = this.animKnock.get(baseKey);
    const cooldownMs = 4000;
    if (entry && now - entry.lastScheduleMs < cooldownMs) return;
    this.animKnock.set(baseKey, { lastScheduleMs: now });

    const center = { x: baseX + 0.5, y: baseY + 1, z: baseZ + 0.5 };
    const play = () => this.playSoundForNearbyPlayers(dimension, center, 'mob.zombie.wood', 16);
    play();
    system.runTimeout(() => play(), 8);
    system.runTimeout(() => play(), 16);
  }

  playSoundForNearbyPlayers(dimension, center, soundId, radius = 16) {
    const players = dimension.getPlayers({ location: center, maxDistance: radius });
    for (const p of players) {
      try { p.playSound(soundId); } catch {}
    }
  }

  triggerDoorEventForAnimatronics(dimension, baseX, baseY, baseZ, isOpening, fromFront = true) {
    const baseKey = this.getBlockKey(baseX, baseY, baseZ);
    let targetEntity = null;
    
    const storedId = this.doorEntities.get(baseKey);
    if (storedId) {
      try { 
        targetEntity = dimension.getEntity(storedId); 
      } catch (_) { 
        targetEntity = null; 
      }
    }
    
    if (!targetEntity) {
      const allEntities = dimension.getEntities({
        location: { x: baseX + 0.5, y: baseY, z: baseZ + 0.5 },
        maxDistance: 2
      });
      for (const entity of allEntities) {
        if (this.doorEntityToBlock.hasOwnProperty(entity.typeId)) {
          targetEntity = entity;
          this.doorEntities.set(baseKey, targetEntity.id);
          break;
        }
      }
    }
    
    if (targetEntity) {
      let eventName;
      if (isOpening) {
        eventName = fromFront ? "open_door" : "open_door_back";
      } else {
        eventName = fromFront ? "close_door" : "close_door_back";
      }
      
      try {
        targetEntity.triggerEvent(eventName);
      } catch (e) {
      }
    }
  }

  closeIdleDoors() {
    const noAnimatronicNearbyRadius = 3;
    const baseSet = new Set();
    for (const baseKey of this.doorBases.values()) baseSet.add(baseKey);
    for (const baseKey of baseSet) {
      if (this.stickyOpenBases.has(baseKey)) continue;
      const dimId = this.baseDimensions.get(baseKey);
      if (!dimId) continue;
      const dim = world.getDimension(dimId);
      if (!dim) continue;
      const [baseX, baseY, baseZ] = baseKey.split(",").map(Number);
      let baseBlock;
      try {
        baseBlock = dim.getBlock({ x: baseX, y: baseY, z: baseZ });
      } catch (e) {
        continue;
      }
      if (!baseBlock || !this.isDoorBlock(baseBlock.typeId)) continue;
      const states = baseBlock.permutation.getAllStates();
      const isOpen = !!states['fr:open_bit'];
      if (!isOpen) continue;
      const center = { x: baseX + 0.5, y: baseY + 1, z: baseZ + 0.5 };
      const animasNear = dim.getEntities({ families: ['animatronic'], location: center, maxDistance: noAnimatronicNearbyRadius });
      if (animasNear && animasNear.length > 0) continue;
      this.toggleDoorByBase(dim, baseX, baseY, baseZ, false);
    }
  }

  findNearestDoorBase(dimension, cx, cy, cz, radius = 2) {
    let best = null;
    let bestDist2 = Number.POSITIVE_INFINITY;
    for (let x = cx - radius; x <= cx + radius; x++) {
      for (let y = cy - 1; y <= cy + 2; y++) {
        for (let z = cz - radius; z <= cz + radius; z++) {
          const b = dimension.getBlock({ x, y, z });
          if (!b || !this.isDoorBlock(b.typeId)) continue;
          const key = this.getBlockKey(x, y, z);
          const baseKey = this.doorBases.get(key) || key;
          const [baseX, baseY, baseZ] = baseKey.split(",").map(Number);
          const dx = x - cx, dy = y - cy, dz = z - cz;
          const d2 = dx*dx + dy*dy + dz*dz;
          if (d2 < bestDist2) {
            const baseBlock = dimension.getBlock({ x: baseX, y: baseY, z: baseZ });
            if (!baseBlock) continue;
            const states = baseBlock.permutation.getAllStates();
            bestDist2 = d2;
            best = {
              baseX, baseY, baseZ,
              direction: states["minecraft:cardinal_direction"] || 'south',
              isOpen: !!states["fr:open_bit"]
            };
          }
        }
      }
    }
    return best;
  }

  toggleDoorByBase(dimension, baseX, baseY, baseZ, forceState) {
    const baseBlock = dimension.getBlock({ x: baseX, y: baseY, z: baseZ });
    if (!baseBlock || !this.isDoorBlock(baseBlock.typeId)) return;
    const states = baseBlock.permutation.getAllStates();
    const doorDirection = states["minecraft:cardinal_direction"] || 'south';
    const isOpen = !!states["fr:open_bit"];
    const newOpenState = (typeof forceState === 'boolean') ? forceState : !isOpen;

    const closedOffsets = this.getClosedOffsets(doorDirection);
    const openedOffsets = this.getOpenedOffsets(doorDirection);
    const offsetsOld = isOpen ? openedOffsets : closedOffsets;
    const offsetsNew = newOpenState ? openedOffsets : closedOffsets;

    const baseKey = this.getBlockKey(baseX, baseY, baseZ);
    this.baseDimensions.set(baseKey, dimension.id);

    const updateSegment = (pos, dy, index) => {
      let segmentState = {};
      if (dy === 0) segmentState["fr:bottom_block_bit"] = true;
      else if (dy === 1) segmentState["fr:middle_block_bit"] = true;
      else if (dy === 2) segmentState["fr:upper_block_bit"] = true;
      segmentState["fr:destroyed"] = false;
      segmentState["fr:value"] = index;
      const blockType = this.getBlockTypeForBase(baseKey, dimension, baseX, baseY, baseZ);
      const perm = BlockPermutation.resolve(blockType, {
        'fr:open_bit': newOpenState,
        'minecraft:cardinal_direction': doorDirection,
        ...segmentState
      });
      const targetBlock = dimension.getBlock(pos);
      targetBlock.setPermutation(perm);
      this.processedBlocks.set(this.getBlockKey(pos.x, pos.y, pos.z), true);
      this.doorBases.set(this.getBlockKey(pos.x, pos.y, pos.z), baseKey);
    };

    for (let i = 0; i < offsetsNew.length; i++) {
      const [oldDx, oldDz] = offsetsOld[i];
      const [newDx, newDz] = offsetsNew[i];
      const dy = Math.floor(i / 2);
      const oldPos = { x: baseX + oldDx, y: baseY + dy, z: baseZ + oldDz };
      const newPos = { x: baseX + newDx, y: baseY + dy, z: baseZ + newDz };

      if (oldDx === newDx && oldDz === newDz) {
        const segBlock = dimension.getBlock(oldPos);
        if (segBlock && this.isDoorBlock(segBlock.typeId)) {
          let segmentState = {};
          if (dy === 0) segmentState["fr:bottom_block_bit"] = true;
          else if (dy === 1) segmentState["fr:middle_block_bit"] = true;
          else if (dy === 2) segmentState["fr:upper_block_bit"] = true;
          segmentState["fr:destroyed"] = false;
          segmentState["fr:value"] = i;
          const blockType = this.getBlockTypeForBase(baseKey, dimension, baseX, baseY, baseZ);
          const perm = BlockPermutation.resolve(blockType, {
            'fr:open_bit': newOpenState,
            'minecraft:cardinal_direction': doorDirection,
            ...segmentState
          });
          segBlock.setPermutation(perm);
        }
      } else {
        const oldBlock = dimension.getBlock(oldPos);
        if (oldBlock) {
          if (this.isDoorBlock(oldBlock.typeId)) {
            this.processedBlocks.delete(this.getBlockKey(oldPos.x, oldPos.y, oldPos.z));
            this.doorBases.delete(this.getBlockKey(oldPos.x, oldPos.y, oldPos.z));
          }
          oldBlock.setType('minecraft:air');
        }
        updateSegment(newPos, dy, i);
      }
    }

    system.runTimeout(() => {
      const offsetsToActivate = newOpenState ? openedOffsets : closedOffsets;
      for (let i = 0; i < offsetsToActivate.length; i++) {
        const [dx, dz] = offsetsToActivate[i];
        const dy = Math.floor(i / 2);
        const pos = { x: baseX + dx, y: baseY + dy, z: baseZ + dz };
        this.setDoorDestroyed(dimension, pos, true);
      }
    }, 1);

    if (newOpenState) {
      this.doorOpenDirections.set(baseKey, true);
    } else {
      this.doorOpenDirections.delete(baseKey);
    }

    system.runTimeout(() => {
      this.triggerDoorEventForAnimatronics(dimension, baseX, baseY, baseZ, newOpenState, true);
    }, 2);

    this.saveDoorDatabase();
  }

  loadDoorDatabase() {
    const json = world.getDynamicProperty("fr:backstage_door_block_db");
    if (json) {
      const data = JSON.parse(json);
      this.processedBlocks.clear();
      this.doorBases.clear();
      this.doorOpenDirections.clear();
      this.baseDimensions.clear?.();
      this.stickyOpenBases?.clear?.();
      for (const [k, v] of data.processedBlocks) {
        this.processedBlocks.set(k, v);
      }
      for (const [k, v] of data.doorBases) {
        this.doorBases.set(k, v);
      }
      if (Array.isArray(data.baseDimensions)) {
        for (const [bk, dim] of data.baseDimensions) this.baseDimensions.set(bk, dim);
      }
      if (Array.isArray(data.stickyOpenBases)) {
        for (const baseKey of data.stickyOpenBases) this.stickyOpenBases.add(baseKey);
      }
      if (Array.isArray(data.doorOpenDirections)) {
        for (const [baseKey, fromFront] of data.doorOpenDirections) this.doorOpenDirections.set(baseKey, fromFront);
      }
      if (Array.isArray(data.doorBlockTypes)) {
        for (const [baseKey, blockType] of data.doorBlockTypes) this.doorBlockTypes.set(baseKey, blockType);
      }
    }
  }

  saveDoorDatabase() {
    const data = {
      processedBlocks: Array.from(this.processedBlocks.entries()),
      doorBases: Array.from(this.doorBases.entries()),
      baseDimensions: Array.from(this.baseDimensions.entries()),
      stickyOpenBases: Array.from(this.stickyOpenBases.values()),
      doorOpenDirections: Array.from(this.doorOpenDirections.entries()),
      doorBlockTypes: Array.from(this.doorBlockTypes.entries())
    };
    world.setDynamicProperty("fr:backstage_door_block_db", JSON.stringify(data));
  }

  getBlockKey(x, y, z) {
    return `${x},${y},${z}`;
  }

  isDoorBlock(typeId) {
    return this.doorBlockToEntity.hasOwnProperty(typeId);
  }

  getBlockTypeForBase(baseKey, dimension, baseX, baseY, baseZ) {
    if (this.doorBlockTypes.has(baseKey)) {
      return this.doorBlockTypes.get(baseKey);
    }
    const baseBlock = dimension.getBlock({ x: baseX, y: baseY, z: baseZ });
    if (baseBlock && this.isDoorBlock(baseBlock.typeId)) {
      this.doorBlockTypes.set(baseKey, baseBlock.typeId);
      return baseBlock.typeId;
    }
    return "fr:backstage_door_block";
  }

  getClosedOffsets(direction) {
    const offsets = [];
    switch (direction) {
      case "north":
        for (let i = 0; i < 3; i++) {
          offsets.push([0, 0]);
          offsets.push([1, 0]);
        }
        break;
      case "south":
        for (let i = 0; i < 3; i++) {
          offsets.push([0, 0]);
          offsets.push([-1, 0]);
        }
        break;
      case "west":
        for (let i = 0; i < 3; i++) {
          offsets.push([0, 0]);
          offsets.push([0, -1]);
        }
        break;
      case "east":
      default:
        for (let i = 0; i < 3; i++) {
          offsets.push([0, 0]);
          offsets.push([0, 1]);
        }
        break;
    }
    return offsets;
  }

  getOpenedOffsets(direction, fromFront = true) {
    const offsets = [];
    if (fromFront) {
      switch (direction) {
        case "north":
          for (let i = 0; i < 3; i++) {
            offsets.push([0, 0]);
            offsets.push([0, 1]);
          }
          break;
        case "south":
          for (let i = 0; i < 3; i++) {
            offsets.push([0, 0]);
            offsets.push([0, -1]);
          }
          break;
        case "west":
          for (let i = 0; i < 3; i++) {
            offsets.push([0, 0]);
            offsets.push([1, 0]);
          }
          break;
        case "east":
        default:
          for (let i = 0; i < 3; i++) {
            offsets.push([0, 0]);
            offsets.push([-1, 0]);
          }
          break;
      }
    } else {
      switch (direction) {
        case "north":
          for (let i = 0; i < 3; i++) {
            offsets.push([0, 0]);
            offsets.push([0, -1]);
          }
          break;
        case "south":
          for (let i = 0; i < 3; i++) {
            offsets.push([0, 0]);
            offsets.push([0, 1]);
          }
          break;
        case "west":
          for (let i = 0; i < 3; i++) {
            offsets.push([0, 0]);
            offsets.push([-1, 0]);
          }
          break;
        case "east":
        default:
          for (let i = 0; i < 3; i++) {
            offsets.push([0, 0]);
            offsets.push([1, 0]);
          }
          break;
      }
    }
    return offsets;
  }

  setDoorDestroyed(dimension, pos, destroyedState) {
    const block = dimension.getBlock(pos);
    if (!block || !this.isDoorBlock(block.typeId)) return;
    const states = block.permutation.getAllStates();
    states["fr:destroyed"] = destroyedState;
    const perm = BlockPermutation.resolve(block.typeId, states);
    block.setPermutation(perm);
  }

  placeDoorSegments(dimension, baseX, baseY, baseZ, offsets, openState, direction, blockType) {
    const baseKey = this.getBlockKey(baseX, baseY, baseZ);
    let successfulPlacements = 0;
    
    for (let i = 0; i < offsets.length; i++) {
      const [dx, dz] = offsets[i];
      const dy = Math.floor(i / 2);
      const blockLocation = { x: baseX + dx, y: baseY + dy, z: baseZ + dz };

      try {
        let segmentState = {};
        if (dy === 0) segmentState["fr:bottom_block_bit"] = true;
        else if (dy === 1) segmentState["fr:middle_block_bit"] = true;
        else if (dy === 2) segmentState["fr:upper_block_bit"] = true;
        segmentState["fr:value"] = i;

        const perm = BlockPermutation.resolve(blockType, {
          "fr:open_bit": openState,
          "minecraft:cardinal_direction": direction,
          ...segmentState
        });
        const block = dimension.getBlock(blockLocation);
        if (!block) {
          continue;
        }
        
        block.setPermutation(perm);
        
        const verifyBlock = dimension.getBlock(blockLocation);
        if (verifyBlock && this.isDoorBlock(verifyBlock.typeId)) {
          this.processedBlocks.set(this.getBlockKey(blockLocation.x, blockLocation.y, blockLocation.z), true);
          this.doorBases.set(this.getBlockKey(blockLocation.x, blockLocation.y, blockLocation.z), baseKey);
          successfulPlacements++;
        }
      } catch {}
    }
    
    if (successfulPlacements === offsets.length) {
      this.baseDimensions.set(baseKey, dimension.id);
      this.saveDoorDatabase();
      return true;
    } else {
      return false;
    }
  }

  activateDoorChain(dimension, baseX, baseY, baseZ, direction) {
    const offsets = this.getClosedOffsets(direction);
    for (let i = 0; i < offsets.length; i++) {
      const [dx, dz] = offsets[i];
      const dy = Math.floor(i / 2);
      const pos = { x: baseX + dx, y: baseY + dy, z: baseZ + dz };
      this.setDoorDestroyed(dimension, pos, true);
    }
  }

  rescanDoors(dimension, minX, minY, minZ, maxX, maxY, maxZ) {
    for (let x = minX; x <= maxX; x++) {
      for (let y = minY; y <= maxY; y++) {
        for (let z = minZ; z <= maxZ; z++) {
          const pos = { x, y, z };
          const block = dimension.getBlock(pos);
          if (block && this.isDoorBlock(block.typeId)) {
            const key = this.getBlockKey(x, y, z);
            this.processedBlocks.set(key, true);
            if (!block.permutation.getState("fr:upper_block_bit")) {
              this.doorBases.set(key, key);
            }
          }
        }
      }
    }
    this.saveDoorDatabase();
  }

  dynamicToastEvent(text) {
    const contents = text.split('|');
    if (contents[3] === undefined) { contents[3] = 'textures/ui/greyBorder'; }
    function adjustTextLength(text = '', totalLength = 100) {
      return (text.slice(0, totalLength)).padEnd(totalLength, '\t');
    }
    return "§N§O§T§I§F§I§C§A§T§I§O§N" +
      adjustTextLength(contents[0], 100) +
      adjustTextLength(contents[1], 200) +
      adjustTextLength(contents[2], 100) +
      adjustTextLength(contents[3], 100);
  }

  isOpenExtraAreaBlocked(dimension, baseX, baseY, baseZ, doorDirection) {
    const closedOffsets = this.getClosedOffsets(doorDirection);
    let extraDx = 0, extraDz = 0;
    switch (doorDirection) {
      case "north": extraDz = -1; break;
      case "south": extraDz = 1; break;
      case "west":  extraDx = -1; break;
      case "east":  extraDx = 1; break;
      default: break;
    }
    for (let i = 0; i < closedOffsets.length; i++) {
      const [dx, dz] = closedOffsets[i];
      const dy = Math.floor(i / 2);
      const pos = { x: baseX + dx + extraDx, y: baseY + dy, z: baseZ + dz + extraDz };
      const b = dimension.getBlock(pos);
      if (b && b.typeId !== "minecraft:air" && !this.isDoorBlock(b.typeId)) {
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
    player.sendMessage(`Test ${spamData.count}`)
    if (spamData.count >= threshold) {
      const closedOffsets = this.getClosedOffsets(doorDirection);
      let extraDx = 0, extraDz = 0;
      switch (doorDirection) {
        case "north": extraDz = -1; break;
        case "south": extraDz = 1; break;
        case "west":  extraDx = -1; break;
        case "east":  extraDx = 1; break;
        default: break;
      }
      let minX = Infinity, minY = Infinity, minZ = Infinity;
      let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
      for (let i = 0; i < closedOffsets.length; i++) {
        const [dx, dz] = closedOffsets[i];
        const dy = Math.floor(i / 2);
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
      const [dx, dz] = offsets[i];
      const dy = Math.floor(i / 2);
      if (playerX === baseX + dx && playerY === baseY + dy && playerZ === baseZ + dz) {
        return true;
      }
    }
    return false;
  }


  handleOnPlace(e) {
    const { block } = e;
    if (block.permutation.getState("fr:upper_block_bit")) return;
    const { x, y, z } = block.location;
    const key = this.getBlockKey(x, y, z);
    if (this.processedBlocks.has(key)) return;
    if (!this.isDoorBlock(block.typeId)) return;

    const states = block.permutation.getAllStates();
    const direction = states["minecraft:cardinal_direction"] || "south";
    const offsets = this.getClosedOffsets(direction);
    
    const dimension = block.dimension;
    for (let i = 0; i < offsets.length; i++) {
      const [dx, dz] = offsets[i];
      const dy = Math.floor(i / 2);
      const checkPos = { x: x + dx, y: y + dy, z: z + dz };
      const checkBlock = dimension.getBlock(checkPos);
      
      if (checkBlock && checkBlock.typeId !== "minecraft:air" && !(dx === 0 && dz === 0 && dy === 0)) {
        block.setType("minecraft:air");
        return;
      }
    }
    
    const placementSuccess = this.placeDoorSegments(dimension, x, y, z, offsets, false, direction, block.typeId);
    
    if (!placementSuccess) {
      block.setType("minecraft:air");
      return;
    }
    
    this.activateDoorChain(dimension, x, y, z, direction);

    this.processedBlocks.set(key, true);
    this.doorBlockTypes.set(key, block.typeId);
    this.saveDoorDatabase();

    try {
      let angle;
      switch (direction) {
        case "north": angle = 0; break;
        case "east": angle = 90; break;
        case "south": angle = 180; break;
        case "west": angle = 270; break;
        default: angle = 0; break;
      }
      const entityName = this.doorBlockToEntity[block.typeId] || "fr:backstage_door";
      const entity = dimension.spawnEntity(entityName, { x: x + 0.5, y: y, z: z + 0.5 });
      entity.setRotation({ x: 0, y: angle });
      
      this.doorEntities.set(key, entity.id);
    } catch {}
  }

  handleOnInteract(e) {
    const { block, player, face, faceLocation } = e;
    if (!this.isDoorBlock(block.typeId)) return;
    const states = block.permutation.getAllStates();
    if (states["fr:value"] !== 3) return;

    let interactionOrigin = {
      x: faceLocation.x,
      y: faceLocation.y,
      z: faceLocation.z
    };
    if (states["fr:open_bit"]) {
      const doorDir = states["minecraft:cardinal_direction"] || "south";
      switch (doorDir) {
        case "north": interactionOrigin.x += 0; break;
        case "east": interactionOrigin.z += 0; break;
        case "south": interactionOrigin.x -= 0; break;
        case "west": interactionOrigin.z -= 0; break;
        default: break;
      }
    }

    const relative = {
      x: interactionOrigin.x - block.location.x,
      y: interactionOrigin.y - block.location.y,
      z: interactionOrigin.z - block.location.z,
    };

    const horizontalAxis = (face === Direction.East || face === Direction.West) ? "z" : "x";
    const verticalAxis = (face === Direction.Up || face === Direction.Down) ? "z" : "y";

    if (face !== Direction.Down) relative[verticalAxis] = 1 - relative[verticalAxis];
    if (face !== Direction.South && face !== Direction.West)
      relative[horizontalAxis] = 1 - relative[horizontalAxis];

    const u = relative[horizontalAxis] * 16;
    const v = relative[verticalAxis] * 16;

    const doorDirection = states["minecraft:cardinal_direction"] || "south";
    const isOpen = states["fr:open_bit"];
    const dimension = block.dimension;
    const currentKey = this.getBlockKey(block.location.x, block.location.y, block.location.z);
    let baseKey = this.doorBases.get(currentKey) || currentKey;
    const [baseX, baseY, baseZ] = baseKey.split(",").map(Number);
    this.baseDimensions.set(baseKey, dimension.id);

    let fromFront;
    
    if (isOpen) {
      fromFront = this.doorOpenDirections.get(baseKey);
      if (fromFront === undefined) fromFront = true;
    } else {
      const playerPos = player.location;
      switch (doorDirection) {
        case "north":
          fromFront = playerPos.z > (baseZ + 0.5);
          break;
        case "south":
          fromFront = playerPos.z < (baseZ + 0.5);
          break;
        case "west":
          fromFront = playerPos.x < (baseX + 0.5);
          break;
        case "east":
          fromFront = playerPos.x > (baseX + 0.5);
          break;
        default:
          fromFront = true;
      }
    }

    const offsetsNew = !isOpen ? this.getOpenedOffsets(doorDirection, fromFront) : this.getClosedOffsets(doorDirection);

    const closedOffsets = this.getClosedOffsets(doorDirection);
    const openedOffsets = this.getOpenedOffsets(doorDirection, fromFront);
    const newOpenState = !isOpen;

    const updateSegment = (pos, stateOffset, index) => {
      const dy = stateOffset.dy;
      let segmentState = {};
      if (dy === 0) segmentState["fr:bottom_block_bit"] = true;
      else if (dy === 1) segmentState["fr:middle_block_bit"] = true;
      else if (dy === 2) segmentState["fr:upper_block_bit"] = true;
      segmentState["fr:destroyed"] = false;
      segmentState["fr:value"] = index;
      const blockType = this.getBlockTypeForBase(baseKey, dimension, baseX, baseY, baseZ);
      const perm = BlockPermutation.resolve(blockType, {
        "fr:open_bit": newOpenState,
        "minecraft:cardinal_direction": doorDirection,
        ...segmentState
      });
      const targetBlock = dimension.getBlock(pos);
      targetBlock.setPermutation(perm);
      this.processedBlocks.set(this.getBlockKey(pos.x, pos.y, pos.z), true);
      this.doorBases.set(this.getBlockKey(pos.x, pos.y, pos.z), baseKey);
    };

    const offsetsOld = isOpen ? openedOffsets : closedOffsets;
    for (let i = 0; i < offsetsNew.length; i++) {
      const [oldDx, oldDz] = offsetsOld[i];
      const [newDx, newDz] = offsetsNew[i];
      const dy = Math.floor(i / 2);
      const oldPos = { x: baseX + oldDx, y: baseY + dy, z: baseZ + oldDz };
      const newPos = { x: baseX + newDx, y: baseY + dy, z: baseZ + newDz };

      if (oldDx === newDx && oldDz === newDz) {
        const segBlock = dimension.getBlock(oldPos);
        if (segBlock && this.isDoorBlock(segBlock.typeId)) {
          let segmentState = {};
          if (dy === 0) segmentState["fr:bottom_block_bit"] = true;
          else if (dy === 1) segmentState["fr:middle_block_bit"] = true;
          else if (dy === 2) segmentState["fr:upper_block_bit"] = true;
          segmentState["fr:destroyed"] = false;
          segmentState["fr:value"] = i;
          const blockType = this.getBlockTypeForBase(baseKey, dimension, baseX, baseY, baseZ);
          const perm = BlockPermutation.resolve(blockType, {
            "fr:open_bit": newOpenState,
            "minecraft:cardinal_direction": doorDirection,
            ...segmentState
          });
          segBlock.setPermutation(perm);
        }
      } else {
        const oldBlock = dimension.getBlock(oldPos);
        if (oldBlock && this.isDoorBlock(oldBlock.typeId)) {
          oldBlock.setType("minecraft:air");
          this.processedBlocks.delete(this.getBlockKey(oldPos.x, oldPos.y, oldPos.z));
          this.doorBases.delete(this.getBlockKey(oldPos.x, oldPos.y, oldPos.z));
        }
        updateSegment(newPos, { dy }, i);
      }
    }
    if (newOpenState) player.playSound("open.wooden_door");
    else player.playSound("close.wooden_door");

    


    system.runTimeout(() => {
      const offsetsToActivate = newOpenState ? openedOffsets : closedOffsets;
      for (let i = 0; i < offsetsToActivate.length; i++) {
        const [dx, dz] = offsetsToActivate[i];
        const dy = Math.floor(i / 2);
        const pos = { x: baseX + dx, y: baseY + dy, z: baseZ + dz };
        this.setDoorDestroyed(dimension, pos, true);
      }
    }, 1);

    const baseKeyForSticky = this.getBlockKey(baseX, baseY, baseZ);
    if (newOpenState) {
      this.stickyOpenBases.add(baseKeyForSticky);
      this.doorOpenDirections.set(baseKeyForSticky, fromFront);
    } else {
      this.stickyOpenBases.delete(baseKeyForSticky);
      this.doorOpenDirections.delete(baseKeyForSticky);
    }
    
    system.runTimeout(() => {
      this.triggerDoorEventForAnimatronics(dimension, baseX, baseY, baseZ, newOpenState, fromFront);
    }, 2);
    
    this.saveDoorDatabase();
  }

  isAreaBlocked(dimension, baseX, baseY, baseZ, offsets) {
    for (let i = 0; i < offsets.length; i++) {
      const [dx, dz] = offsets[i];
      const dy = Math.floor(i / 2);
      const pos = { x: baseX + dx, y: baseY + dy, z: baseZ + dz };
      const b = dimension.getBlock(pos);
      if (b && b.typeId !== "minecraft:air" && !this.isDoorBlock(b.typeId)) {
        return true;
      }
    }
    return false;
  }

  handleOnTick(e) {
    const { block } = e;
    if (!this.isDoorBlock(block.typeId)) return;
    const states = block.permutation.getAllStates();
    if (!states["fr:destroyed"]) return;

    const loc = block.location;
    const dimension = block.dimension;
    const currentKey = this.getBlockKey(loc.x, loc.y, loc.z);
    const baseKey = this.doorBases.get(currentKey);
    if (!baseKey) return;
    const [baseX, baseY, baseZ] = baseKey.split(",").map(Number);
    const direction = states["minecraft:cardinal_direction"] || "south";
    const openState = states["fr:open_bit"] || false;
    
    let offsets;
    if (openState) {
      const fromFront = this.doorOpenDirections.get(baseKey);
      offsets = this.getOpenedOffsets(direction, fromFront !== undefined ? fromFront : true);
    } else {
      offsets = this.getClosedOffsets(direction);
    }

    let doorIntact = true;
    for (let i = 0; i < offsets.length; i++) {
      const [dx, dz] = offsets[i];
      const dy = Math.floor(i / 2);
      const pos = { x: baseX + dx, y: baseY + dy, z: baseZ + dz };
      const b = dimension.getBlock(pos);
      if (!b || !this.isDoorBlock(b.typeId)) {
        doorIntact = false;
        break;
      }
    }
    if (!doorIntact) {
      for (const [segmentKey, registeredBase] of this.doorBases.entries()) {
        if (registeredBase === baseKey) {
          const [x, y, z] = segmentKey.split(",").map(Number);
          const segBlock = dimension.getBlock({ x, y, z });
          if (segBlock && this.isDoorBlock(segBlock.typeId)) {
            segBlock.setType("minecraft:air");
          }
          this.processedBlocks.delete(segmentKey);
          this.doorBases.delete(segmentKey);
        }
      }
      this.doorOpenDirections.delete(baseKey);
    }
    this.saveDoorDatabase();
  }
}

const doorManager = new DoorManager();
