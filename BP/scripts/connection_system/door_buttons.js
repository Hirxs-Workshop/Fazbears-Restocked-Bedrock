import { EquipmentSlot, system, world, BlockPermutation } from "@minecraft/server";
import { ModalFormData, ActionFormData } from "@minecraft/server-ui";
import FaceSelectionPlains from "./face_selection_plains";
import { dynamicToast } from "./utils.js";

const ANIMATION_DELAY_TICKS = 2;
const hallwayLampVfxEntities = {};

let __memConnections = [];
let __memWoodenDoorClaims = [];

system.beforeEvents.startup.subscribe(() => {
  try {
    if (!world.getDynamicProperty("connections")) {
      world.setDynamicProperty("connections", JSON.stringify([]));
    }
    if (!world.getDynamicProperty("woodenDoorClaims")) {
      world.setDynamicProperty("woodenDoorClaims", JSON.stringify([]));
    }
  } catch {}
  selectedDoorButton.clear();
});

const getConnections = () => {
  try {
    const data = world.getDynamicProperty("connections");
    return data ? JSON.parse(data) : [];
  } catch {
    return __memConnections;
  }
};
const setConnections = (connections) => {
  try {
    world.setDynamicProperty("connections", JSON.stringify(connections));
  } catch {
    __memConnections = connections;
  }
};
const addConnection = (connection) => {
  const connections = getConnections();
  connections.push(connection);
  setConnections(connections);
  return true;
};
const removeConnection = (connection) => {
  let connections = getConnections();
  const index = connections.findIndex(conn =>
    conn.doorBlock.x === connection.doorBlock.x &&
    conn.doorBlock.y === connection.doorBlock.y &&
    conn.doorBlock.z === connection.doorBlock.z &&
    conn.doorBlock.dimensionId === connection.doorBlock.dimensionId &&
    conn.officeLightBlock &&
    connection.officeLightBlock &&
    conn.officeLightBlock.x === connection.officeLightBlock.x &&
    conn.officeLightBlock.y === connection.officeLightBlock.y &&
    conn.officeLightBlock.z === connection.officeLightBlock.z &&
    conn.officeLightBlock.dimensionId === connection.officeLightBlock.dimensionId
  );
  if (index !== -1) {
    connections.splice(index, 1);
    setConnections(connections);
    return true;
  }
  return false;
};
const getConnectionByOfficeLightBlock = (block, dimension) => {
  if (!dimension?.id) {
    return undefined;
  }
  const connections = getConnections();
  return connections.find(conn =>
    conn.officeLightBlock &&
    conn.officeLightBlock.x === block.location.x &&
    conn.officeLightBlock.y === block.location.y &&
    conn.officeLightBlock.z === block.location.z &&
    conn.officeLightBlock.dimensionId === dimension.id
  );
};

const getWoodenDoorConnections = () => {
  try {
    const data = world.getDynamicProperty("woodenDoorClaims");
    return data ? JSON.parse(data) : [];
  } catch {
    return __memWoodenDoorClaims;
  }
};
const setWoodenDoorConnections = (connections) => {
  try {
    world.setDynamicProperty("woodenDoorClaims", JSON.stringify(connections));
  } catch {
    __memWoodenDoorClaims = connections;
  }
};
const addWoodenDoorConnection = (connection) => {
  const connections = getWoodenDoorConnections();
  connections.push(connection);
  setWoodenDoorConnections(connections);
  return true;
};
const removeWoodenDoorConnection = (connection) => {
  let connections = getWoodenDoorConnections();
  const index = connections.findIndex(conn =>
    conn.doorBlock.x === connection.doorBlock.x &&
    conn.doorBlock.y === connection.doorBlock.y &&
    conn.doorBlock.z === connection.doorBlock.z &&
    conn.doorBlock.dimensionId === connection.doorBlock.dimensionId &&
    conn.woodenDoorBlock &&
    conn.woodenDoorBlock.x === connection.woodenDoorBlock.x &&
    conn.woodenDoorBlock.y === connection.woodenDoorBlock.y &&
    conn.woodenDoorBlock.z === connection.woodenDoorBlock.z &&
    conn.woodenDoorBlock.dimensionId === connection.woodenDoorBlock.dimensionId
  );
  if (index !== -1) {
    connections.splice(index, 1);
    setWoodenDoorConnections(connections);
    return true;
  }
  return false;
};
const getConnectionByWoodenDoorBlock = (block, dimension) => {
  if (!dimension?.id) {
    return undefined;
  }
  const connections = getWoodenDoorConnections();
  const result = connections.find(conn =>
    conn.woodenDoorBlock.x === block.location.x &&
    conn.woodenDoorBlock.y === block.location.y &&
    conn.woodenDoorBlock.z === block.location.z &&
    conn.woodenDoorBlock.dimensionId === dimension.id
  );
  return result;
};

function connectDoorToOfficeLight(doorBlock, officeLightBlock, doorDimension, player) {
  const connections = getConnections();
  const doorConnections = connections.filter(conn =>
    conn.doorBlock.x === doorBlock.location.x &&
    conn.doorBlock.y === doorBlock.location.y &&
    conn.doorBlock.z === doorBlock.location.z &&
    conn.doorBlock.dimensionId === doorDimension.id
  );
  if (doorConnections.length >= 5) {
    player.sendMessage(dynamicToast("§l§cERROR", "§cMaximum connections (5) reached", "textures/fr_ui/deny_icon", "textures/fr_ui/deny_ui"));
    return;
  }
  const connection = {
    doorBlock: {
      dimensionId: doorDimension.id,
      x: doorBlock.location.x,
      y: doorBlock.location.y,
      z: doorBlock.location.z
    },
    officeLightBlock: {
      dimensionId: doorDimension.id,
      x: officeLightBlock.location.x,
      y: officeLightBlock.location.y,
      z: officeLightBlock.location.z
    }
  };
  if (!addConnection(connection)) {
    player.sendMessage(dynamicToast("§l§cERROR", "§cCould not add the connection", "textures/fr_ui/deny_icon", "textures/fr_ui/deny_ui"));
    return;
  }
  player.sendMessage(dynamicToast("§l§qSUCCESS", "§qOffice light linked successfully", "textures/fr_ui/approve_icon", "textures/fr_ui/approve_ui"));
  doorDimension.playSound("fr:connect_office_light", officeLightBlock.center());
}

function syncLightState(block, dimension, player) {
  const doorBlockPos = {
    x: block.location.x,
    y: block.location.y,
    z: block.location.z,
    dimensionId: dimension.id,
  };
  const doorState = block.permutation.getState("fr:bottom") === true;
  const connections = getConnections().filter(conn =>
    conn.doorBlock.x === doorBlockPos.x &&
    conn.doorBlock.y === doorBlockPos.y &&
    conn.doorBlock.z === doorBlockPos.z &&
    conn.doorBlock.dimensionId === doorBlockPos.dimensionId
  );
  connections.forEach(connection => {
    const officeLightBlock = dimension.getBlock({
      x: connection.officeLightBlock.x,
      y: connection.officeLightBlock.y,
      z: connection.officeLightBlock.z,
    });
    if (officeLightBlock && officeLightBlock.typeId !== "minecraft:air") {
      const newPerm = officeLightBlock.permutation.withState("fr:lit", doorState);
      officeLightBlock.setPermutation(newPerm);
      
      const key = `${connection.officeLightBlock.dimensionId}_${connection.officeLightBlock.x}_${connection.officeLightBlock.y}_${connection.officeLightBlock.z}`;
      if (doorState) {
        if (!hallwayLampVfxEntities[key]) {
          const location = { 
            x: connection.officeLightBlock.x + 0.5, 
            y: connection.officeLightBlock.y + 0, 
            z: connection.officeLightBlock.z + 0.5 
          };
          try {
            const entity = dimension.spawnEntity("fr:hallway_lamp_vfx", location);
            hallwayLampVfxEntities[key] = entity;
          } catch {}
        }
      } else {
        const location = { 
          x: connection.officeLightBlock.x + 0.5, 
          y: connection.officeLightBlock.y + 0.5, 
          z: connection.officeLightBlock.z + 0.5 
        };
        try {
          dimension.runCommand(`execute at @e[type=fr:hallway_lamp_vfx] positioned ${location.x} ${location.y} ${location.z} run event entity @e[r=0.5] destroy`);
        } catch {}
        if (hallwayLampVfxEntities[key]) {
          delete hallwayLampVfxEntities[key];
        }
      }
    }
  });
}

function connectDoorToWoodenDoor(doorBlock, woodenDoorBlock, doorDimension, player) {
  const connections = getWoodenDoorConnections();
  const doorConnections = connections.filter(conn =>
    conn.doorBlock.x === doorBlock.location.x &&
    conn.doorBlock.y === doorBlock.location.y &&
    conn.doorBlock.z === doorBlock.location.z &&
    conn.doorBlock.dimensionId === doorDimension.id
  );
  if (doorConnections.length >= 5) {
    player.sendMessage(dynamicToast("§l§cERROR", "§cMaximum connections (5) reached", "textures/fr_ui/deny_icon", "textures/fr_ui/deny_ui"));
    return;
  }
  const connection = {
    doorBlock: {
      dimensionId: doorDimension.id,
      x: doorBlock.location.x,
      y: doorBlock.location.y,
      z: doorBlock.location.z
    },
    woodenDoorBlock: {
      dimensionId: doorDimension.id,
      x: woodenDoorBlock.location.x,
      y: woodenDoorBlock.location.y,
      z: woodenDoorBlock.location.z
    }
  };
  if (!addWoodenDoorConnection(connection)) {
    player.sendMessage(dynamicToast("§l§cERROR", "§cCould not add wooden door connection", "textures/fr_ui/deny_icon", "textures/fr_ui/deny_ui"));
    return;
  }
  player.sendMessage(dynamicToast("§l§qSUCCESS", "§qOffice door linked successfully", "textures/fr_ui/approve_icon", "textures/fr_ui/approve_ui"));
  doorDimension.playSound("fr:connect_office_light", woodenDoorBlock.center());
}

function findOfficeDoorUpperBlock(clickedBlock) {
  if (!clickedBlock || clickedBlock.typeId !== "fr:office_door") return null;
  const dim = clickedBlock.dimension;
  const x = clickedBlock.location.x;
  const z = clickedBlock.location.z;
  let isUpper = false;
  try {
    isUpper = clickedBlock.permutation.getState("fr:upper") === true;
  } catch (_) {}
  if (isUpper) return clickedBlock;
  let y = clickedBlock.location.y + 1;
  while (true) {
    const b = dim.getBlock({ x, y, z });
    if (!b || b.typeId !== "fr:office_door") break;
    try {
      if (b.permutation.getState("fr:upper") === true) return b;
    } catch (_) {}
    y++;
  }
  return null;
}

function applyOfficeDoorState(officeDoorBlock, open) {
  if (!officeDoorBlock) return;
  const dim = officeDoorBlock.dimension;
  const x = officeDoorBlock.location.x;
  const z = officeDoorBlock.location.z;
  
  let cardinalDirection = "south";
  try {
    cardinalDirection = officeDoorBlock.permutation.getState("minecraft:cardinal_direction") || "south";
  } catch (e) {
  }
  
  const updateUpperBlock = (delayTicks = 0) => {
    system.runTimeout(() => {
      try {
        const doorOpenState = !open;
        const permUpper = BlockPermutation.resolve("fr:office_door", {
          "fr:door_open": doorOpenState,
          "fr:bottom": false,
          "fr:middle": false,
          "fr:upper": true,
          "minecraft:cardinal_direction": cardinalDirection,
        });
        const block = dim.getBlock({ x, y: officeDoorBlock.location.y, z });
        if (block) {
          block.setPermutation(permUpper);
        }
      } catch (e) {
        try {
          const block = dim.getBlock({ x, y: officeDoorBlock.location.y, z });
          if (block) {
            const doorOpenState = !open;
            let p = block.permutation.withState("fr:door_open", doorOpenState);
            p = p.withState("fr:bottom", false);
            p = p.withState("fr:middle", false);
            p = p.withState("fr:upper", true);
            block.setPermutation(p);
          }
        } catch {}
      }
    }, delayTicks);
  };

  if (open) {
    const segmentsToRemove = [];
    let y = officeDoorBlock.location.y - 1;
    while (true) {
      const b = dim.getBlock({ x, y, z });
      if (!b) break;
      if (b.typeId !== "fr:office_door") break;
      let isMiddle = false, isBottom = false;
      try {
        isMiddle = b.permutation.getState("fr:middle") === true;
        isBottom = b.permutation.getState("fr:bottom") === true;
      } catch (e) {}
      if (!isMiddle && !isBottom) break;
      segmentsToRemove.push(y);
      y--;
    }
    segmentsToRemove.reverse();
    segmentsToRemove.forEach((segY, index) => {
      system.runTimeout(() => {
        const target = dim.getBlock({ x, y: segY, z });
        if (target && target.typeId === "fr:office_door") {
          target.setType("minecraft:air");
        }
      }, index * ANIMATION_DELAY_TICKS);
    });
    const totalDelay = segmentsToRemove.length * ANIMATION_DELAY_TICKS;
    updateUpperBlock(totalDelay);
    
    system.runTimeout(() => {
      dim.playSound("office_door", { x: x + 0.5, y: officeDoorBlock.location.y, z: z + 0.5 });
    }, totalDelay);
    return;
  }

  let y = officeDoorBlock.location.y - 1;
  let lastAirY = null;
  while (true) {
    const b = dim.getBlock({ x, y, z });
    if (!b) break;
    if (b.typeId === "minecraft:air") {
      lastAirY = y;
      y--;
      continue;
    }
    break;
  }

  if (lastAirY !== null) {
    const segmentsToPlace = [];
    for (let yy = officeDoorBlock.location.y - 1; yy >= lastAirY; yy--) {
      const isBottom = yy === lastAirY;
      const isMiddle = !isBottom;
      segmentsToPlace.push({ y: yy, isMiddle, isBottom });
    }
    updateUpperBlock(0);
    segmentsToPlace.forEach((segment, index) => {
      system.runTimeout(() => {
        try {
          const permSeg = BlockPermutation.resolve("fr:office_door", {
            "fr:door_open": true,
            "fr:upper": false,
            "fr:middle": segment.isMiddle,
            "fr:bottom": segment.isBottom,
            "minecraft:cardinal_direction": cardinalDirection,
          });
          const target = dim.getBlock({ x, y: segment.y, z });
          if (target) {
            target.setPermutation(permSeg);
          }
        } catch {
          const target = dim.getBlock({ x, y: segment.y, z });
          if (target && target.typeId === "minecraft:air") {
            try {
              target.setType("fr:office_door");
              let p = target.permutation.withState("fr:door_open", true)
                .withState("fr:upper", false)
                .withState("fr:middle", segment.isMiddle)
                .withState("fr:bottom", segment.isBottom)
                .withState("minecraft:cardinal_direction", cardinalDirection);
              target.setPermutation(p);
            } catch {}
          }
        }
      }, index * ANIMATION_DELAY_TICKS);
    });
    
    const totalClosingDelay = segmentsToPlace.length * ANIMATION_DELAY_TICKS;
    system.runTimeout(() => {
      dim.playSound("office_door", { x: x + 0.5, y: officeDoorBlock.location.y, z: z + 0.5 });
    }, totalClosingDelay);
  } else {
    updateUpperBlock(0);
  }
}

const pendingConnections = new Map();
const pendingWoodenDoorConnections = new Map();

function getButtonSelections(blockY) {
  if (blockY >= 0) {
    return new FaceSelectionPlains(
      { origin: [5, 0], size: [6, 6], name: "door" },
      { origin: [5, 9], size: [6, 6], name: "light" }
    );
  } else {
    return new FaceSelectionPlains(
      { origin: [5, 9], size: [6, 6], name: "door" },
      { origin: [5, 0], size: [6, 6], name: "light" }
    );
  }
}

const selectedDoorButton = new Map();

function showRemoveAllConnectionsModal(player) {
  const form = new ActionFormData()
    .title("Remove All Connections")
    .body("Are you sure you want to remove all connections?\nThis will remove both office light and wooden door connections.")
    .button("Remove All")
    .button("Cancel");
  form.show(player).then(response => {
    if (response.selection === 0) {
      setConnections([]);
      setWoodenDoorConnections([]);
      player.sendMessage(dynamicToast("§l§qSUCCESS", "§qAll connections removed", "textures/fr_ui/approve_icon", "textures/fr_ui/approve_ui"));
    } else {
      player.sendMessage(dynamicToast("§l§7INFO", "§7Operation cancelled", "textures/fr_ui/selection_icon", "textures/fr_ui/default_ui"));
    }
  })
}

function showRemoveConnectionModal(player) {
  const connections = getConnections();
  if (connections.length === 0) {
    player.sendMessage(dynamicToast("§l§6INFO", "§6No connections to remove", "textures/fr_ui/unlinked_icon", "textures/fr_ui/unlinked_ui"));
    return;
  }
  const options = connections.map((conn, index) =>
    `${index + 1}: Door (${conn.doorBlock.x},${conn.doorBlock.y},${conn.doorBlock.z}) - OfficeLight (${conn.officeLightBlock.x},${conn.officeLightBlock.y},${conn.officeLightBlock.z})`
  );
  const form = new ModalFormData()
    .title("Remove Connection")
    .dropdown("Select a connection to remove", options)
    .button("Cancel", "textures/fr_ui/deny_icon")
    .button("Remove", "textures/fr_ui/approve_icon");
  form.show(player).then(response => {
    if (response.formValues && typeof response.formValues[0] === "number") {
      const index = response.formValues[0];
      const connections = getConnections();
      if (index >= 0 && index < connections.length) {
        connections.splice(index, 1);
        setConnections(connections);
        player.sendMessage(dynamicToast("§l§qSUCCESS", "§qConnection removed", "textures/fr_ui/approve_icon", "textures/fr_ui/approve_ui"));
      }
    }
  })
}

function showDisconnectModal(player, connection) {
  const form = new ActionFormData()
    .title("Disconnect Connection")
    .body(
      `Do you want to disconnect the connection?\n` +
      `Door: (${connection.doorBlock.x}, ${connection.doorBlock.y}, ${connection.doorBlock.z})\n` +
      `Office Light: (${connection.officeLightBlock ? connection.officeLightBlock.x + ", " + connection.officeLightBlock.y + ", " + connection.officeLightBlock.z : "N/A"})\n` +
      `Wooden Door: (${connection.woodenDoorBlock ? connection.woodenDoorBlock.x + ", " + connection.woodenDoorBlock.y + ", " + connection.woodenDoorBlock.z : "N/A"})`
    )
    .button("Disconnect")
    .button("Cancel");
  form.show(player).then(response => {
    if (response.selection === 0) {
      let disconnected = false;
      if (connection.officeLightBlock) {
        if (removeConnection(connection)) {
          player.sendMessage(dynamicToast("§l§qSUCCESS", "§qOffice light disconnected", "textures/fr_ui/approve_icon", "textures/fr_ui/approve_ui"));
          disconnected = true;
        }
      }
      if (connection.woodenDoorBlock) {
        if (removeWoodenDoorConnection(connection)) {
          player.sendMessage(dynamicToast("§l§qSUCCESS", "§qOffice door disconnected", "textures/fr_ui/approve_icon", "textures/fr_ui/approve_ui"));
          disconnected = true;
        }
      }
      if (!disconnected) {
        player.sendMessage(dynamicToast("§l§cERROR", "§cFailed to disconnect", "textures/fr_ui/deny_icon", "textures/fr_ui/deny_ui"));
      }
    } else {
      player.sendMessage(dynamicToast("§l§7INFO", "§7Operation cancelled", "textures/fr_ui/selection_icon", "textures/fr_ui/default_ui"));
    }
  })
}

function handleDoorButtonsInteract({ block, face, faceLocation, dimension, player }) {
  if (!player) return;

  const relativeFaceLocation = {
    x: faceLocation.x - block.location.x,
    y: faceLocation.y - block.location.y,
    z: faceLocation.z - block.location.z,
  };

  const buttonSelections = getButtonSelections(block.location.y);
  const selectedZone = buttonSelections.getSelected({ face, faceLocation: relativeFaceLocation });

  const equippable = player.getComponent("minecraft:equippable");
  if (!equippable) {
    return;
  }
  const mainhand = equippable.getEquipmentSlot(EquipmentSlot.Mainhand);

  if (mainhand.hasItem() && mainhand.typeId === "minecraft:blaze_rod") {
    showRemoveAllConnectionsModal(player);
    return;
  }

  if (mainhand.hasItem() && mainhand.typeId === "fr:faz-diver_security") {
    if (selectedZone === "light") {
      pendingWoodenDoorConnections.delete(player.name);
      pendingConnections.set(player.name, { doorBlock: block, doorDimension: block.dimension });
      selectedDoorButton.set(player.name, {
        x: block.location.x,
        y: block.location.y,
        z: block.location.z,
        dimensionId: block.dimension.id,
      });
      return;
    }
    if (selectedZone === "door") {
      pendingConnections.delete(player.name);
      pendingWoodenDoorConnections.set(player.name, { doorBlock: block, doorDimension: block.dimension });
      selectedDoorButton.set(player.name, {
        x: block.location.x,
        y: block.location.y,
        z: block.location.z,
        dimensionId: block.dimension.id,
      });
      return;
    }
    return;
  }

  if (selectedZone === "door") {
    const currentState = block.permutation.getState("fr:upper");
    const newState = !currentState;
    block.setPermutation(block.permutation.withState("fr:upper", newState));
    dimension.playSound("door_button", block.center());
    dimension.playSound("fr:toggle_door", block.center());

    const doorBlockPos = {
      x: block.location.x,
      y: block.location.y,
      z: block.location.z,
      dimensionId: dimension.id,
    };
    const connections = getWoodenDoorConnections().filter(conn =>
      conn.doorBlock.x === doorBlockPos.x &&
      conn.doorBlock.y === doorBlockPos.y &&
      conn.doorBlock.z === doorBlockPos.z &&
      conn.doorBlock.dimensionId === doorBlockPos.dimensionId
    );
    const desiredOpen = newState;
    for (const connection of connections) {
      const doorDim = block.dimension;
      const officeDoorBlock = doorDim.getBlock({
        x: connection.woodenDoorBlock.x,
        y: connection.woodenDoorBlock.y,
        z: connection.woodenDoorBlock.z,
      });
      if (officeDoorBlock) {
        applyOfficeDoorState(officeDoorBlock, desiredOpen);
        doorDim.playSound("fr:toggle_door", officeDoorBlock.center());
      }
    }
    return;
  } else if (selectedZone === "light") {
    const currentState = block.permutation.getState("fr:bottom");
    const newState = !currentState;
    block.setPermutation(block.permutation.withState("fr:bottom", newState));
    dimension.playSound("door_button", block.center());
    dimension.playSound("fr:toggle_light", block.center());
    syncLightState(block, dimension, player);
  }
  if (block && block.typeId === "fr:door_buttons") {
    const doorBlockPos = {
      x: block.location.x,
      y: block.location.y,
      z: block.location.z,
      dimensionId: dimension.id,
    };
    selectedDoorButton.set(player.name, doorBlockPos);
  }
}


const DoorButtonsComponent = {
  onPlayerInteract: handleDoorButtonsInteract,
};

system.beforeEvents.startup.subscribe(({ blockComponentRegistry }) => {
  blockComponentRegistry.registerCustomComponent("fr:door_buttons", DoorButtonsComponent);
});

world.afterEvents.playerInteractWithBlock.subscribe(event => {
  const { player, block, itemStack } = event;
  const blockDimension = block.dimension;
  if (!player) return;
  
  if (itemStack && itemStack.typeId === "fr:faz-diver_security" && block.typeId === "fr:office_light") {
    if (pendingConnections.has(player.name)) {
      const pending = pendingConnections.get(player.name);
      connectDoorToOfficeLight(pending.doorBlock, block, pending.doorDimension, player);
      pendingConnections.delete(player.name);
      selectedDoorButton.delete(player.name);
    } else {
      const connection = getConnectionByOfficeLightBlock(block, blockDimension);
      if (connection) {
        showDisconnectModal(player, connection);
      }
    }
    return;
  }
  
  if (itemStack && itemStack.typeId === "fr:faz-diver_security" && block.typeId === "fr:office_door") {
    const upperBlock = findOfficeDoorUpperBlock(block);
    if (!upperBlock) {
      return;
    }
    if (pendingWoodenDoorConnections.has(player.name)) {
      const pending = pendingWoodenDoorConnections.get(player.name);
      connectDoorToWoodenDoor(pending.doorBlock, upperBlock, pending.doorDimension, player);
      pendingWoodenDoorConnections.delete(player.name);
      selectedDoorButton.delete(player.name);
    } else {
      const connection = getConnectionByWoodenDoorBlock(upperBlock, blockDimension);
      if (connection) {
        showDisconnectModal(player, connection);
      }
    }
    return;
  }
  
});

function removeEntireOfficeDoor(upperBlock, dimension) {
  if (!upperBlock) return;
  const x = upperBlock.location.x;
  const z = upperBlock.location.z;
  let y = upperBlock.location.y - 1;
  let removedCount = 0;
  while (true) {
    const b = dimension.getBlock({ x, y, z });
    if (!b || b.typeId !== "fr:office_door") break;
    let isMiddle = false, isBottom = false;
    try {
      isMiddle = b.permutation.getState("fr:middle") === true;
      isBottom = b.permutation.getState("fr:bottom") === true;
    } catch (e) {}
    if (!isMiddle && !isBottom) break;
    b.setType("minecraft:air");
    removedCount++;
    y--;
  }
  upperBlock.setType("minecraft:air");
}

world.afterEvents.playerBreakBlock.subscribe(event => {
  const { block, player, brokenBlockPermutation } = event;
  const dimension = block.dimension;
  
  if (block.typeId === "fr:office_light") {
    const connection = getConnectionByOfficeLightBlock(block, dimension);
    if (connection) {
      removeConnection(connection);
      if (player) player.sendMessage("Connection removed: office_light block destroyed.");
    }
  }
  
  if (brokenBlockPermutation.type.id === "fr:office_door") {
    let wasUpper = false;
    try {
      wasUpper = brokenBlockPermutation.getState("fr:upper") === true;
    } catch (e) {}
    
    if (wasUpper) {
      const fakeBlock = {
        location: block.location,
        dimension: dimension,
        typeId: "fr:office_door",
        permutation: brokenBlockPermutation
      };
      const connection = getConnectionByWoodenDoorBlock(fakeBlock, dimension);
      if (connection) {
        removeWoodenDoorConnection(connection);
        if (player) player.sendMessage("§cOffice door connection removed.");
      }
      system.runTimeout(() => {
        const x = block.location.x;
        const z = block.location.z;
        let y = block.location.y - 1;
        while (true) {
          const b = dimension.getBlock({ x, y, z });
          if (!b || b.typeId !== "fr:office_door") break;
          let isMiddle = false, isBottom = false;
          try {
            isMiddle = b.permutation.getState("fr:middle") === true;
            isBottom = b.permutation.getState("fr:bottom") === true;
          } catch (e) {}
          if (!isMiddle && !isBottom) break;
          b.setType("minecraft:air");
          y--;
        }
      }, 1);
    } else {
      const x = block.location.x;
      const z = block.location.z;
      let upperBlock = null;
      let y = block.location.y + 1;
      while (true) {
        const b = dimension.getBlock({ x, y, z });
        if (!b || b.typeId !== "fr:office_door") break;
        try {
          if (b.permutation.getState("fr:upper") === true) {
            upperBlock = b;
            break;
          }
        } catch (e) {}
        y++;
      }
      if (upperBlock) {
        const connection = getConnectionByWoodenDoorBlock(upperBlock, dimension);
        if (connection) {
          removeWoodenDoorConnection(connection);
          if (player) player.sendMessage("§cOffice door connection removed.");
        }
        system.runTimeout(() => {
          const brokenY = block.location.y;
          let yBelow = brokenY - 1;
          let removedBelow = 0;
          while (true) {
            const b = dimension.getBlock({ x, y: yBelow, z });
            if (!b || b.typeId !== "fr:office_door") break;
            b.setType("minecraft:air");
            removedBelow++;
            yBelow--;
          }
          removeEntireOfficeDoor(upperBlock, dimension);
        }, 1);
      }
    }
  }
});

function updateLightTestActionBarForPlayer(player) {
  const viewData = player.getBlockFromViewDirection({ maxDistance: 7.5 });
  const block = viewData?.block;
  const dimension = player.dimension;
  let message = "";
  const equippable = player.getComponent("minecraft:equippable");
  const mainhand = equippable?.getEquipmentSlot(EquipmentSlot.Mainhand);
  const heldId = mainhand?.hasItem() ? mainhand.typeId : null;
  const isFazDiver = typeof heldId === "string" && heldId.startsWith("fr:faz-diver_");

  if ((pendingConnections.has(player.name) || pendingWoodenDoorConnections.has(player.name)) && (!block || (block.typeId !== "fr:office_light" && block.typeId !== "fr:office_door" && block.typeId !== "fr:door_buttons"))) {
    if (!isFazDiver) {
      player.onScreenDisplay.setActionBar({ rawtext: [{ text: "" }] });
      return;
    }
    let doorBlockPos = selectedDoorButton.get(player.name) || { x: 0, y: 0, z: 0, dimensionId: dimension.id };
    
    const lightConnections = getConnections().filter(conn =>
      conn.doorBlock.x === doorBlockPos.x &&
      conn.doorBlock.y === doorBlockPos.y &&
      conn.doorBlock.z === doorBlockPos.z &&
      conn.doorBlock.dimensionId === doorBlockPos.dimensionId
    ).length;
    const doorConnections = getWoodenDoorConnections().filter(conn =>
      conn.doorBlock.x === doorBlockPos.x &&
      conn.doorBlock.y === doorBlockPos.y &&
      conn.doorBlock.z === doorBlockPos.z &&
      conn.doorBlock.dimensionId === doorBlockPos.dimensionId
    ).length;

    const title = "§l§fDoor Buttons§r";
    const coords = `(${doorBlockPos.x}, ${doorBlockPos.y}, ${doorBlockPos.z})`;
    const selection = pendingConnections.has(player.name) ? "Light" : "Door";

    message = `${title}\n §7Door Links: ${doorConnections}/5\n §7Light Links: ${lightConnections}/5\n §7Coords: ${coords}\n §7Selection: ${selection}`;
  } else {
    if (!isFazDiver) {
      if (!pendingConnections.has(player.name) && !pendingWoodenDoorConnections.has(player.name)) {
        selectedDoorButton.delete(player.name);
        player.onScreenDisplay.setActionBar({ rawtext: [{ text: "" }] });
      }
      return;
    }

    if (block) {
      if (block.typeId === "fr:office_light") {
        const connection = getConnectionByOfficeLightBlock(block, dimension);
        if (connection) {
          const isLit = block.permutation.getState("fr:lit") === true;
          const stateText = isLit ? "On" : "Off";
          const stateColor = isLit ? "§q" : "§c";
          const linkedColor = isLit ? "§q§l" : "§c§l";
          const coords = `(${connection.doorBlock.x}, ${connection.doorBlock.y}, ${connection.doorBlock.z})`;
          message = `${linkedColor} Linked to Door buttons§r\n §7Coords: ${coords}\n${stateColor} Status: ${stateText}`;
          if (pendingConnections.has(player.name) || pendingWoodenDoorConnections.has(player.name)) {
            const selection = pendingConnections.has(player.name) ? "Light" : "Door";
            message += `\n §7Selection: ${selection}`;
          }
        } else {
          message = " §l§6Unlinked§r";
        }
      } else if (block.typeId === "fr:office_door") {
        const connection = getConnectionByWoodenDoorBlock(block, dimension);
        if (connection) {
          const isOpen = block.permutation.getState("fr:door_open") === true;
          const stateText = isOpen ? "Open" : "Closed";
          const stateColor = isOpen ? "§q" : "§c";
          const linkedColor = isOpen ? "§q§l" : "§c§l";
          const coords = `(${connection.doorBlock.x}, ${connection.doorBlock.y}, ${connection.doorBlock.z})`;
          message = `${linkedColor} Linked to Door buttons§r\n §7Coords: ${coords}\n${stateColor} Status: ${stateText}`;
          if (pendingConnections.has(player.name) || pendingWoodenDoorConnections.has(player.name)) {
            const selection = pendingConnections.has(player.name) ? "Light" : "Door";
            message += `\n §7Selection: ${selection}`;
          }
        } else {
          message = " §l§6Unlinked§r";
        }
      } else if (block.typeId === "fr:door_buttons") {
        const doorBlockPos = {
          x: block.location.x,
          y: block.location.y,
          z: block.location.z,
          dimensionId: dimension.id,
        };
        const lightConnections = getConnections().filter(conn =>
          conn.doorBlock.x === doorBlockPos.x &&
          conn.doorBlock.y === doorBlockPos.y &&
          conn.doorBlock.z === doorBlockPos.z &&
          conn.doorBlock.dimensionId === doorBlockPos.dimensionId
        ).length;
        const doorConnections = getWoodenDoorConnections().filter(conn =>
          conn.doorBlock.x === doorBlockPos.x &&
          conn.doorBlock.y === doorBlockPos.y &&
          conn.doorBlock.z === doorBlockPos.z &&
          conn.doorBlock.dimensionId === doorBlockPos.dimensionId
        ).length;
        const title = "§l§fDoor Buttons§r";
        const coords = `(${doorBlockPos.x}, ${doorBlockPos.y}, ${doorBlockPos.z})`;
        const selection = "";
        message = `${title}\n §7Door Links: ${doorConnections}/5\n §7Light Links: ${lightConnections}/5`;
        if (pendingConnections.has(player.name) || pendingWoodenDoorConnections.has(player.name)) {
          const selection = pendingConnections.has(player.name) ? "Light" : "Door";
          message += `\n §7Selection: ${selection}`;
        }
        selectedDoorButton.set(player.name, doorBlockPos);
      } else {
        selectedDoorButton.delete(player.name);
        message = "";
      }
    } else {
      selectedDoorButton.delete(player.name);
      message = "";
    }
  }

  system.run(() => {
    try {
      player.onScreenDisplay.setActionBar({ rawtext: [{ text: message }] });
    } catch {}
  });
}



system.runInterval(() => {
  const players = world.getPlayers();
  if (players.length === 0) return;
  for (const player of players) {
    updateLightTestActionBarForPlayer(player);
  }
}, 20);