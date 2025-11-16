import { world, system, BlockPermutation, Direction, EquipmentSlot, GameMode } from "@minecraft/server";
import { ActionFormData, ModalFormData, MessageFormData } from "@minecraft/server-ui";
import { dynamicToast, dynamicToastEvent, cleanupLampVfxEntitiesOnReload, getLinePoints, turnOffLight, lampVfxEntities } from "./utils.js";
import { LIGHT_TYPES, SWITCH_TYPES, GENERATOR_TYPES, LIGHT_ALIASES, SWITCH_ALIASES, GENERATOR_ALIASES, LIGHT_ICONS, SWITCH_ICONS, GENERATOR_ICONS, CONNECTIONS_KEY, GENERATORS_KEY, MAX_ENERGY, DEFAULT_CONSUMPTION_RATE, CONSUMPTION_MULTIPLIER, NEAR_DISTANCE } from "./connection_types.js";
import './door_buttons.js'

let selections = {};

cleanupLampVfxEntitiesOnReload();

let __memConnectionsES = [];
let __memGeneratorsES = [];

system.afterEvents.scriptEventReceive.subscribe((data) => {
  const { id, sourceEntity, message } = data;
  if (id === 'cn:main') {
    sourceEntity.sendMessage(dynamicToastEvent(message));
  }
});

function getConnections() {
  try {
    const json = world.getDynamicProperty(CONNECTIONS_KEY);
    return json ? JSON.parse(json) : [];
  } catch {
    return __memConnectionsES;
  }
}
function setConnections(connections) {
  try {
    world.setDynamicProperty(CONNECTIONS_KEY, JSON.stringify(connections));
  } catch {
    __memConnectionsES = connections;
  }
}
function getGenerators() {
  try {
    const json = world.getDynamicProperty(GENERATORS_KEY);
    return json ? JSON.parse(json) : [];
  } catch {
    return __memGeneratorsES;
  }
}
function setGenerators(generators) {
  try {
    world.setDynamicProperty(GENERATORS_KEY, JSON.stringify(generators));
  } catch {
    __memGeneratorsES = generators;
  }
}
function getGeneratorAt(pos) {
  const generators = getGenerators();
  return generators.find(gen =>
    gen.pos.x === pos.x &&
    gen.pos.y === pos.y &&
    gen.pos.z === pos.z &&
    gen.pos.dimensionId === pos.dimensionId
  );
}
function updateGenerator(updatedGen) {
  let generators = getGenerators();
  generators = generators.map(gen => {
    if (
      gen.pos.x === updatedGen.pos.x &&
      gen.pos.y === updatedGen.pos.y &&
      gen.pos.z === updatedGen.pos.z &&
      gen.pos.dimensionId === updatedGen.pos.dimensionId
    ) {
      return updatedGen;
    }
    return gen;
  });
  setGenerators(generators);
}
function disconnectSingleConnection(player, connection) {
  let connections = getConnections();
  const index = connections.findIndex(conn =>
    conn.switch.x === connection.switch.x &&
    conn.switch.y === connection.switch.y &&
    conn.switch.z === connection.switch.z &&
    conn.switch.dimensionId === connection.switch.dimensionId &&
    conn.light.x === connection.light.x &&
    conn.light.y === connection.light.y &&
    conn.light.z === connection.light.z &&
    conn.light.dimensionId === connection.light.dimensionId
  );
  if (index !== -1) {
    connections.splice(index, 1);
    setConnections(connections);
    turnOffLight(connection, LIGHT_TYPES);
    player.sendMessage(dynamicToast("§l§qSUCCESS", "§qConnection removed §7", "textures/fr_ui/approve_icon", "textures/fr_ui/approve_ui"));
  }
}
function disconnectSingleConnectionNoMessage(player, connection) {
  let connections = getConnections();
  const index = connections.findIndex(conn =>
    conn.switch.x === connection.switch.x &&
    conn.switch.y === connection.switch.y &&
    conn.switch.z === connection.switch.z &&
    conn.switch.dimensionId === connection.switch.dimensionId &&
    conn.light.x === connection.light.x &&
    conn.light.y === connection.light.y &&
    conn.light.z === connection.light.z &&
    conn.light.dimensionId === connection.light.dimensionId
  );
  if (index !== -1) {
    connections.splice(index, 1);
    setConnections(connections);
    turnOffLight(connection, LIGHT_TYPES);
  }
}
function disconnectConnections(player, connectionsToDisconnect) {
  let connections = getConnections();
  connectionsToDisconnect.forEach(conn => {
    turnOffLight(conn, LIGHT_TYPES);
  });
  connections = connections.filter(conn =>
    !connectionsToDisconnect.some(disconn =>
      disconn.switch.x === conn.switch.x &&
      disconn.switch.y === conn.switch.y &&
      disconn.switch.z === conn.switch.z &&
      disconn.switch.dimensionId === conn.switch.dimensionId &&
      disconn.light.x === conn.light.x &&
      disconn.light.y === conn.light.y &&
      disconn.light.z === conn.light.z &&
      disconn.light.dimensionId === conn.light.dimensionId
    )
  );
  setConnections(connections);
  player.sendMessage(dynamicToast("§l§qSUCCESS", "§qConnection removed §7", "textures/fr_ui/approve_icon", "textures/fr_ui/approve_ui"));
}
function showDisconnectSubmenu(player, connection) {
  const form = new ActionFormData()
    .title("Connection")
    .body(
      `Block: (${connection.light.x}, ${connection.light.y}, ${connection.light.z})\n` +
      `Switch block: (${connection.switch.x}, ${connection.switch.y}, ${connection.switch.z})\n` +
      "Disconnect this connection?"
    )
    .button("Disconnect")
    .button("Back");
  form.show(player).then(response => {
    if (response.selection === 0) {
      disconnectSingleConnection(player, connection);
    }
  });
}
function showDisconnectMenu(player, connectionsList) {
  const form = new ActionFormData()
    .title("Conexiones existentes")
    .body("Selecciona una conexión o elige 'Desconectar todas'.");
  connectionsList.forEach((conn, index) => {
    const label = `Bloque: (${conn.light.x}, ${conn.light.y}, ${conn.light.z})\n` +
                  `Interruptor/Generador: (${conn.switch.x}, ${conn.switch.y}, ${conn.switch.z})`;
    form.button(`#${index + 1}: ${label}`);
  });
  form.button("Desconectar todas");
  form.show(player).then(response => {
    if (response.selection === connectionsList.length) {
      disconnectConnections(player, connectionsList);
    } else if (response.selection !== undefined && response.selection < connectionsList.length) {
      const selectedConnection = connectionsList[response.selection];
      showDisconnectSubmenu(player, selectedConnection);
    }
  });
}
function showAdjustTimeForm(player, generatorData) {
  const form = new ModalFormData()
    .title("Ajustar tiempo")
    .slider("Velocidad de consumo (valor menor = mayor duración)", 0.1, 1, 0.05, generatorData.consumptionRate || DEFAULT_CONSUMPTION_RATE);
  form.show(player).then(response => {
    if (response.formValues && response.formValues.length > 0) {
      let newRate = response.formValues[0];
      generatorData.consumptionRate = newRate;
      updateGenerator(generatorData);
      player.sendMessage(`Consumo ajustado a +${(newRate * 100).toFixed(0)}%`);
    }
  });
}
function showAdjustRadiusForm(player, generatorData) {
  const radii = [8, 16, 32, 48, 64];
  const effectList = radii.map(r => r.toString());
  const currentRadius = generatorData.radius || 8;
  let defaultIndex = radii.indexOf(currentRadius);
  if (defaultIndex === -1) defaultIndex = 0;
  
  const form = new ModalFormData()
    .title("Ajustar Radio")
    .dropdown("Effect Type", effectList, defaultIndex);
    
  form.show(player).then(response => {
    if (response.formValues && response.formValues.length > 0) {
      let selectedIndex = response.formValues[0];
      let newRadius = radii[selectedIndex];
      
      if (newRadius < currentRadius) {
         let connections = getConnections();
         let generatorConnections = connections.filter(conn =>
            conn.switch.x === generatorData.pos.x &&
            conn.switch.y === generatorData.pos.y &&
            conn.switch.z === generatorData.pos.z &&
            conn.switch.dimensionId === generatorData.pos.dimensionId
         );
         let toDisconnect = [];
         for (let conn of generatorConnections) {
             let dx = conn.light.x - generatorData.pos.x;
             let dy = conn.light.y - generatorData.pos.y;
             let dz = conn.light.z - generatorData.pos.z;
             let distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
             if (distance > newRadius) {
                toDisconnect.push(conn);
             }
         }
         let desc = "The following lights are switched off:\n";
         if (toDisconnect.length === 0) {
            desc += "Blocks no detected";
         } else {
            toDisconnect.forEach(conn => {
               desc += `- Connection in (${conn.light.x}, ${conn.light.y}, ${conn.light.z})\n`;
            });
         }
         desc += "\nDo you want to continue?";
         
         let confirmForm = new MessageFormData();
         confirmForm.title("Confirm radio change");
         confirmForm.body(desc);
         confirmForm.button1("No, cancel");
         confirmForm.button2("Yes, disconnect");
         confirmForm.show(player).then(confirmResponse => {
            if (confirmResponse.selection === 1) {
               if (toDisconnect.length > 5) {
                 for (let conn of toDisconnect) {
                   disconnectSingleConnectionNoMessage(player, conn);
                 }
                 player.sendMessage(dynamicToast("§l§qSUCCESS", `§q${toDisconnect.length} Connections removed §7`, "textures/fr_ui/approve_icon", "textures/fr_ui/approve_ui"));
               } else {
                 for (let conn of toDisconnect) {
                   disconnectSingleConnection(player, conn);
                 }
               }
               generatorData.radius = newRadius;
               updateGenerator(generatorData);
               player.sendMessage(dynamicToast("§l§7INFO", `§7Radius changed to ${newRadius}`, "textures/fr_ui/selection_icon", "textures/fr_ui/default_ui"));
            } else {
              player.sendMessage(dynamicToast("§l§cERROR", "§cRadius change canceled", "textures/fr_ui/deny_icon", "textures/fr_ui/deny_ui"));
            }
         });
      } else {
         generatorData.radius = newRadius;
         updateGenerator(generatorData);
         player.sendMessage(dynamicToast("§l§cINFO", `§cRadius changed to ${newRadius}`, "textures/fr_ui/selection_icon", "textures/fr_ui/default_ui"));
      }
    }
  });
}
function showGeneratorMenu(player, generatorData) {
  const consumoPorcentaje = (generatorData.consumptionRate || DEFAULT_CONSUMPTION_RATE) * 100;
  const currentRadius = generatorData.radius || 8;
  const form = new ActionFormData()
    .title("Generator")
    .body(`Current Energy: ${generatorData.energy}\nConsumption: +${consumoPorcentaje.toFixed(0)}%\nRadius: ${currentRadius}\nSelect a option:`)
    .button("Re-charge")
    .button("Change time")
    .button("Set radius");
  
  if (generatorData.active) {
    form.button("Turn off");
  } else {
    form.button("Turn on");
  }
  
  form.button("Disconnect all")
      .button("Cancel");
  
  form.show(player).then(response => {
    if (response.selection === undefined) return;
    switch (response.selection) {
      case 0:
        generatorData.energy = MAX_ENERGY;
        generatorData.accumulator = 0;
        generatorData.active = true;
        updateGenerator(generatorData);
        player.sendMessage(dynamicToast("§l§cINFO", `§cThe generator has been re-charged`, "textures/fr_ui/warning_icon", "textures/fr_ui/warning_ui"));
        break;
      case 1:
        showAdjustTimeForm(player, generatorData);
        break;
      case 2:
        showAdjustRadiusForm(player, generatorData);
        break;
      case 3:
        generatorData.active = !generatorData.active;
        player.sendMessage(generatorData.active ? "Generator [ON]" : "Generator [OFF]");
        updateGenerator(generatorData);
        break;
      case 4:
        {
          let connections = getConnections();
          const genConnections = connections.filter(conn => {
            return (
              conn.switch.x === generatorData.pos.x &&
              conn.switch.y === generatorData.pos.y &&
              conn.switch.z === generatorData.pos.z &&
              conn.switch.dimensionId === generatorData.pos.dimensionId
            );
          });
          genConnections.forEach(conn => turnOffLight(conn, LIGHT_TYPES));
          connections = connections.filter(conn => {
            return !(
              conn.switch.x === generatorData.pos.x &&
              conn.switch.y === generatorData.pos.y &&
              conn.switch.z === generatorData.pos.z &&
              conn.switch.dimensionId === generatorData.pos.dimensionId
            );
          });
          setConnections(connections);
          player.sendMessage(dynamicToast("§l§qSUCCESS", `§qGenerator connections disconnected`, "textures/fr_ui/approve_icon", "textures/fr_ui/approve_ui"));
        }
        break;
      default:
        break;
    }
  });
}
function showTestLightMenu(player, blockPos) {
  const connections = getConnections();
  const connection = connections.find(conn => 
    conn.light.x === blockPos.x &&
    conn.light.y === blockPos.y &&
    conn.light.z === blockPos.z &&
    conn.light.dimensionId === blockPos.dimensionId
  );
  if (!connection) {
    player.sendMessage(dynamicToast("§l§6INFO", "§6This block is not linked", "textures/fr_ui/unlinked_icon", "textures/fr_ui/unlinked_ui"));
    return;
  }
  const form = new ActionFormData()
    .title("Block settings")
    .body("Choose one!");
  form.button("Disconnect");
  form.button("Show connection line");
  form.button("TP to block");
  form.button("Back");
  form.show(player).then(response => {
    if (response.selection === 0) {
      disconnectSingleConnection(player, connection);
    } else if (response.selection === 1) {
      showParticleLine(player, connection);
    } else if (response.selection === 2) {
      const targetPos = connection.switch;
      const dimension = world.getDimension(targetPos.dimensionId);
      dimension.runCommand(`camera "${player.name}" fade time 1 3 1 color 0 0 0`);
      player.sendMessage(dynamicToast("§l§sAction", "§sYou are being teleported...", "textures/fr_ui/tp_player_icon", "textures/fr_ui/tp_player_ui"));
      system.runTimeout(() => {
        player.sendMessage(dynamicToast("§l§sAction", "§sYou have been teleported to the block", "textures/fr_ui/tp_player_icon", "textures/fr_ui/tp_player_ui"));
        dimension.runCommand(`tp "${player.name}" ${targetPos.x + 0.5} ${targetPos.y + 1} ${targetPos.z + 0.5}`);
      }, 70);
    }
  });
}
function showParticleLine(player, connection) {
  const points = getLinePoints(connection.switch, connection.light, 30);
  const dimension = world.getDimension(connection.light.dimensionId);
  player.sendMessage(dynamicToast("§l§7Action", "§7Showing connection points for 3s", "textures/fr_ui/path_icon", "textures/fr_ui/default_ui"));
  for (const point of points) {
    dimension.spawnParticle("fr:raytest", {
      x: point.x,
      y: point.y,
      z: point.z,
    });
  }
}
function showGlobalMenu(player) {
  const form = new ActionFormData()
    .title("Funciones Globales")
    .body("Selecciona una acción global:")
    .button("Desconectar todas las conexiones")
    .button("Aumentar consumo de Energy de todos los generadores")
    .button("Remover todos los generadores")
    .button("Cancelar");
  form.show(player).then(response => {
    switch (response.selection) {
      case 0:
        {
          const connections = getConnections();
          connections.forEach(conn => {
            turnOffLight(conn, LIGHT_TYPES);
          });
          setConnections([]);
          player.sendMessage("Todas las conexiones han sido desconectadas.");
        }
        break;
      case 1:
        {
          let generators = getGenerators();
          generators.forEach(gen => {
            gen.consumptionRate = (gen.consumptionRate || DEFAULT_CONSUMPTION_RATE) * 1.2;
          });
          setGenerators(generators);
          player.sendMessage("El consumo de Energy de todos los generadores ha aumentado.");
        }
        break;
      case 2:
        {
          let generators = getGenerators();
          const overworld = world.getDimension("overworld");
          generators.forEach(gen => {
            overworld.runCommand(`setblock ${gen.pos.x} ${gen.pos.y} ${gen.pos.z} minecraft:air`);
          });
          let connections = getConnections();
          connections = connections.filter(conn => {
            return !generators.some(gen =>
              gen.pos.x === conn.switch.x &&
              gen.pos.y === conn.switch.y &&
              gen.pos.z === conn.switch.z &&
              gen.pos.dimensionId === conn.switch.dimensionId
            );
          });
          setConnections(connections);
          setGenerators([]);
          player.sendMessage("Todos los generadores han sido removidos.");
        }
        break;
      default:
        break;
    }
  });
}

world.afterEvents.playerInteractWithBlock.subscribe(event => {
  const player = event.player;
  const block = event.block;
  const blockPos = {
    dimensionId: block.dimension.id,
    x: block.location.x,
    y: block.location.y,
    z: block.location.z,
  };
  const item = event.itemStack;
  
  if (item && item.typeId === "fr:wrench") {
    const category = (function getBlockCategory(block) {
      if (LIGHT_TYPES.has(block.typeId)) return "light";
      if (SWITCH_TYPES.has(block.typeId)) return "switch";
      if (GENERATOR_TYPES.has(block.typeId)) return "generator";
      return null;
    })(block);
    if (category === "switch" || category === "generator") {
      if (selections[player.id]) {
        const oldPos = selections[player.id].pos;
        const oldDim = world.getDimension(oldPos.dimensionId);
        oldDim.runCommand(`execute at @e[type=fr:selection] positioned ${oldPos.x} ${oldPos.y} ${oldPos.z} run event entity @e[r=1] destroy`);
      }
      selections[player.id] = { pos: blockPos, category: category };
      if (category === "generator") {
        let generators = getGenerators();
        let gen = generators.find(g =>
          g.pos.x === blockPos.x &&
          g.pos.y === blockPos.y &&
          g.pos.z === blockPos.z &&
          g.pos.dimensionId === blockPos.dimensionId
        );
        if (!gen) {
          gen = {
            id: generators.length + 1,
            pos: blockPos,
            energy: MAX_ENERGY,
            accumulator: 0,
            consumptionRate: DEFAULT_CONSUMPTION_RATE,
            active: true
          };
          generators.push(gen);
          setGenerators(generators);
          player.sendMessage("Generador activado.");
        }
      }
      const dimension = world.getDimension(blockPos.dimensionId);
      dimension.runCommand(`execute positioned ${blockPos.x} ${blockPos.y} ${blockPos.z} run summon fr:selection ~ ~ ~ 0 0`);
      let iconToUse = "textures/fr_ui/selection_icon";
      let messageText = "§9Block selected";
      if (SWITCH_TYPES.has(block.typeId)) {
         iconToUse = SWITCH_ICONS[block.typeId] || "textures/fr_ui/switch_icon";
         messageText = `§9The ${SWITCH_ALIASES[block.typeId] || "Switch"} block has been selected`;
      } else if (GENERATOR_TYPES.has(block.typeId)) {
         iconToUse = GENERATOR_ICONS[block.typeId] || "textures/fr_ui/placeholder_icon";
         messageText = `§9The ${GENERATOR_ALIASES[block.typeId] || "Generator"} block has been selected`;
      }
      player.sendMessage(dynamicToast("§l§9INFO", messageText, iconToUse, "textures/fr_ui/selection_ui"));
      return;
    }
    if (category === "light") {
      if (selections[player.id] && (selections[player.id].category === "switch" || selections[player.id].category === "generator")) {
        const source = selections[player.id].pos;
        const dx = blockPos.x - source.x;
        const dy = blockPos.y - source.y;
        const dz = blockPos.z - source.z;
        const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
    
        const dimension = world.getDimension(source.dimensionId);
        const sourceBlock = dimension.getBlock({ x: source.x, y: source.y, z: source.z });
        let allowedRadius = 64;
        if (sourceBlock) {
          if (SWITCH_TYPES.has(sourceBlock.typeId)) {
          } else if (GENERATOR_TYPES.has(sourceBlock.typeId)) {
            const generatorData = getGeneratorAt(source);
            allowedRadius = generatorData ? (generatorData.radius || 8) : 8;
          }
        }
        if (distance > allowedRadius) {
          player.sendMessage(dynamicToast("§l§cERROR", `§cBlock outside ${allowedRadius} block radius`, "textures/fr_ui/deny_icon", "textures/fr_ui/deny_ui"));
          return;
        }
    
        let connections = getConnections();
        const exists = connections.some(conn =>
          conn.light.x === blockPos.x &&
          conn.light.y === blockPos.y &&
          conn.light.z === blockPos.z &&
          conn.light.dimensionId === blockPos.dimensionId
        );
        if (!exists) {
          connections.push({ switch: source, light: blockPos });
          setConnections(connections);
          let isActive = false;
          const switchBlock = world.getDimension(source.dimensionId).getBlock({ x: source.x, y: source.y, z: source.z });
          if (switchBlock) {
            if (SWITCH_TYPES.has(switchBlock.typeId)) {
              isActive = switchBlock.permutation.getState("fr:switch_type") === true;
            } else if (GENERATOR_TYPES.has(switchBlock.typeId)) {
              const gen = getGeneratorAt(source);
              if (gen && gen.active && gen.energy > 0) {
                isActive = true;
              }
            }
          }
          const dimensionLight = world.getDimension(blockPos.dimensionId);
          const lightBlock = dimensionLight.getBlock(blockPos);
          if (lightBlock && lightBlock.typeId === "fr:light_test") {
            const newPerm = lightBlock.permutation.withState("fr:lit", isActive);
            lightBlock.setPermutation(newPerm);
          }
          if (isActive) {
            player.sendMessage(dynamicToast("§l§qSUCCESS", "§qConnection established (On)", "textures/fr_ui/approve_icon", "textures/fr_ui/approve_ui"));
          } else {
            player.sendMessage(dynamicToast("§l§qSUCCESS", "§qConnection established (Off)", "textures/fr_ui/approve_icon", "textures/fr_ui/approve_ui"));
          }
        } else {
          player.sendMessage(dynamicToast("§l§cERROR", "§cThe block already has a connection", "textures/fr_ui/deny_icon", "textures/fr_ui/deny_ui"));
        }
      }
    }
  }
  
  if (item && item.typeId === "minecraft:lk") {
    showGlobalMenu(player);
    return;
  }
  if (LIGHT_TYPES.has(block.typeId)) {
    if (item && item.typeId === "fr:wrench") return;
    showTestLightMenu(player, blockPos);
    return;
  }
  if (GENERATOR_TYPES.has(block.typeId)) {
    let generators = getGenerators();
    let gen = generators.find(g =>
      g.pos.x === blockPos.x &&
      g.pos.y === blockPos.y &&
      g.pos.z === blockPos.z &&
      g.pos.dimensionId === blockPos.dimensionId
    );
    if (gen) {
      showGeneratorMenu(player, gen);
    } else {
      gen = {
        id: generators.length + 1,
        pos: blockPos,
        energy: MAX_ENERGY,
        accumulator: 0,
        consumptionRate: DEFAULT_CONSUMPTION_RATE,
        active: true
      };
      generators.push(gen);
      setGenerators(generators);
      player.sendMessage("Generator enabled");
    }
    return;
  }
});

world.afterEvents.playerBreakBlock.subscribe(event => {
  const { block, brokenBlockPermutation, player } = event;
  const blockPos = {
    dimensionId: block.dimension.id,
    x: block.location.x,
    y: block.location.y,
    z: block.location.z,
  };
  const blockType = brokenBlockPermutation.type.id;

  if (LIGHT_TYPES.has(blockType)) {
    let connections = getConnections();
    const lightConnections = connections.filter(conn =>
      conn.light.x === blockPos.x &&
      conn.light.y === blockPos.y &&
      conn.light.z === blockPos.z &&
      conn.light.dimensionId === blockPos.dimensionId
    );

    if (lightConnections.length > 0) {
      const key = `${blockPos.dimensionId}_${blockPos.x}_${blockPos.y}_${blockPos.z}`;
      if (lampVfxEntities[key]) {
        const dimension = world.getDimension(blockPos.dimensionId);
        const location = { x: blockPos.x + 0.5, y: blockPos.y + 0.5, z: blockPos.z + 0.5 };
        
        if (lampVfxEntities[key].isStageSpotlight) {
          dimension.runCommand(`execute at @e[type=fr:stage_spotlight_vfx] positioned ${location.x} ${location.y} ${location.z} run event entity @e[r=0.5] destroy`);
        } else {
          dimension.runCommand(`execute at @e[type=fr:office_lamp_vfx] positioned ${location.x} ${location.y} ${location.z} run event entity @e[r=0.5] destroy`);
        }
        delete lampVfxEntities[key];
      }

      connections = connections.filter(conn =>
        !(conn.light.x === blockPos.x &&
          conn.light.y === blockPos.y &&
          conn.light.z === blockPos.z &&
          conn.light.dimensionId === blockPos.dimensionId)
      );
      setConnections(connections);
    }
  }

  if (SWITCH_TYPES.has(blockType)) {
    let connections = getConnections();
    const switchConnections = connections.filter(conn =>
      conn.switch.x === blockPos.x &&
      conn.switch.y === blockPos.y &&
      conn.switch.z === blockPos.z &&
      conn.switch.dimensionId === blockPos.dimensionId
    );

    if (switchConnections.length > 0) {
      switchConnections.forEach(conn => turnOffLight(conn, LIGHT_TYPES));

      connections = connections.filter(conn =>
        !(conn.switch.x === blockPos.x &&
          conn.switch.y === blockPos.y &&
          conn.switch.z === blockPos.z &&
          conn.switch.dimensionId === blockPos.dimensionId)
      );
      setConnections(connections);
    }

    if (selections[player.id]) {
      const selPos = selections[player.id].pos;
      if (selPos.x === blockPos.x && selPos.y === blockPos.y && selPos.z === blockPos.z && selPos.dimensionId === blockPos.dimensionId) {
        delete selections[player.id];
      }
    }
  }

  if (GENERATOR_TYPES.has(blockType)) {
    let connections = getConnections();
    const generatorConnections = connections.filter(conn =>
      conn.switch.x === blockPos.x &&
      conn.switch.y === blockPos.y &&
      conn.switch.z === blockPos.z &&
      conn.switch.dimensionId === blockPos.dimensionId
    );

    if (generatorConnections.length > 0) {
      generatorConnections.forEach(conn => turnOffLight(conn, LIGHT_TYPES));

      connections = connections.filter(conn =>
        !(conn.switch.x === blockPos.x &&
          conn.switch.y === blockPos.y &&
          conn.switch.z === blockPos.z &&
          conn.switch.dimensionId === blockPos.dimensionId)
      );
      setConnections(connections);
    }

    let generators = getGenerators();
    generators = generators.filter(gen =>
      !(gen.pos.x === blockPos.x &&
        gen.pos.y === blockPos.y &&
        gen.pos.z === blockPos.z &&
        gen.pos.dimensionId === blockPos.dimensionId)
    );
    setGenerators(generators);

    if (selections[player.id]) {
      const selPos = selections[player.id].pos;
      if (selPos.x === blockPos.x && selPos.y === blockPos.y && selPos.z === blockPos.z && selPos.dimensionId === blockPos.dimensionId) {
        delete selections[player.id];
      }
    }
  }
});

system.runInterval(() => {
  const connections = getConnections();
  if (connections.length === 0) return;
  for (const conn of connections) {
    const switchBlock = world.getDimension(conn.switch.dimensionId).getBlock({
      x: conn.switch.x,
      y: conn.switch.y,
      z: conn.switch.z,
    });
    const lightBlock = world.getDimension(conn.light.dimensionId).getBlock({
      x: conn.light.x,
      y: conn.light.y,
      z: conn.light.z,
    });
    if (switchBlock && lightBlock) {
      let isActive = false;
      if (SWITCH_TYPES.has(switchBlock.typeId)) {
        isActive = switchBlock.permutation.getState("fr:switch_type") === true;
      } else if (GENERATOR_TYPES.has(switchBlock.typeId)) {
        const gen = getGeneratorAt(conn.switch);
        if (gen && gen.active && gen.energy > 0) {
          isActive = true;
        }
      }
      const currentLightState = lightBlock.permutation.getState("fr:lit") === true;
      if (isActive && !currentLightState) {
        const newPerm = lightBlock.permutation.withState("fr:lit", true);
        lightBlock.setPermutation(newPerm);
      } else if (!isActive && currentLightState) {
        const newPerm = lightBlock.permutation.withState("fr:lit", false);
        lightBlock.setPermutation(newPerm);
      }
      const key = `${conn.light.dimensionId}_${conn.light.x}_${conn.light.y}_${conn.light.z}`;
      if (isActive) {
        if (!lampVfxEntities[key]) {
          const dimension = world.getDimension(conn.light.dimensionId);
          const location = { x: conn.light.x + 0.5, y: conn.light.y + 0, z: conn.light.z + 0.5 };
          
          const existingSpotlightEntities = dimension.getEntities({
            type: "fr:stage_spotlight_vfx",
            location: location,
            maxDistance: 0.5
          });
          const existingLampEntities = dimension.getEntities({
            type: "fr:office_lamp_vfx", 
            location: location,
            maxDistance: 0.5
          });
          
          const hasExistingVfx = existingSpotlightEntities.length > 0 || existingLampEntities.length > 0;
          
          if (!hasExistingVfx) {
            if (lightBlock.typeId === "fr:stage_spotlight") {
              const angles = [180, 200, 225, 250, 270, 290, 315, 335, 0, 25, 45, 70, 90, 115, 135, 160];
              const rotationState = lightBlock.permutation.getState("fr:rotation");
              const angle = angles[rotationState];
              dimension.runCommand(`summon fr:stage_spotlight_vfx ${conn.light.x + 0.5} ${conn.light.y} ${conn.light.z + 0.5} ${angle} 0`);
              lampVfxEntities[key] = { isStageSpotlight: true };
            } else {
              const entity = dimension.spawnEntity("fr:office_lamp_vfx", location);
              lampVfxEntities[key] = entity;
            }
          } else {
            if (existingSpotlightEntities.length > 0) {
              lampVfxEntities[key] = { isStageSpotlight: true };
            } else if (existingLampEntities.length > 0) {
              lampVfxEntities[key] = existingLampEntities[0];
            }
          }
        }
      } else {
        if (lampVfxEntities[key]) {
          const dimension = world.getDimension(conn.light.dimensionId);
          const location = { x: conn.light.x + 0.5, y: conn.light.y + 0.5, z: conn.light.z + 0.5 };
          
          if (lampVfxEntities[key].isStageSpotlight) {
            dimension.runCommand(`execute at @e[type=fr:stage_spotlight_vfx] positioned ${location.x} ${location.y} ${location.z} run event entity @e[r=0.5] destroy`);
          } else {
            dimension.runCommand(`execute at @e[type=fr:office_lamp_vfx] positioned ${location.x} ${location.y} ${location.z} run event entity @e[r=0.5] destroy`);
          }
          delete lampVfxEntities[key];
        }
      }
    }
  }
}, 20);

let particleTick = 0;
system.runInterval(() => {
  const players = world.getPlayers();
  if (players.length === 0) return;
  for (const player of players) {
    const inventory = player.getComponent("minecraft:inventory").container;
    const slot = player.selectedSlot;
    let item = null;
    if (typeof slot === "number" && slot >= 0 && slot < inventory.size) {
      item = inventory.getItem(slot);
    }
    if (item && item.typeId === "fr:wrench") {
      const connections = getConnections();
      for (const conn of connections) {
        if (
          conn.switch.dimensionId === player.dimension.id &&
          conn.light.dimensionId === player.dimension.id
        ) {
          const points = getLinePoints(conn.switch, conn.light, 10);
          const currentIndex = particleTick % points.length;
          const point = points[currentIndex];
        }
      }
    }
  }
  particleTick++;
}, 20);

system.runInterval(() => {
  let generators = getGenerators();
  if (generators.length === 0) return;
  const overworld = world.getDimension("overworld");
  generators.forEach(gen => {
    if (gen.active && gen.energy > 0) {
      let activeLights = 0;
      const connections = getConnections();
      for (const conn of connections) {
        if (
          conn.switch.x === gen.pos.x &&
          conn.switch.y === gen.pos.y &&
          conn.switch.z === gen.pos.z &&
          conn.switch.dimensionId === gen.pos.dimensionId
        ) {
          activeLights++;
        }
      }
      gen.accumulator += activeLights * (gen.consumptionRate || DEFAULT_CONSUMPTION_RATE) * CONSUMPTION_MULTIPLIER;
      while (gen.accumulator >= 1 && gen.energy > 0) {
        gen.energy--;
        gen.accumulator -= 1;
      }
      if (gen.energy < 0) gen.energy = 0;
      const block = world.getDimension(gen.pos.dimensionId).getBlock({
        x: gen.pos.x,
        y: gen.pos.y,
        z: gen.pos.z,
      });
      if (block) {
        const newPerm = block.permutation.withState("fr:energy_level", gen.energy);
        block.setPermutation(newPerm);
      }
    }
  });
  setGenerators(generators);
}, 10);

function updateGeneratorTitle(player, generatorData) {
  const energyPercentage = Math.floor((generatorData.energy / MAX_ENERGY) * 100);
  const barLength = 10;
  let energyBar = "";
  const filledBars = Math.floor((generatorData.energy / MAX_ENERGY) * barLength);
  for (let i = 0; i < barLength; i++) {
    energyBar += i < filledBars ? "§p|§p" : "§8|§p";
  }
  const dimension = world.getDimension(generatorData.pos.dimensionId);
  dimension.runCommand(`title "${player.name}" title b_slot0§p Energy: ${energyBar} ${energyPercentage}`);
}

let lastTitleUpdate = new Map();
system.runInterval(() => {
  const players = world.getPlayers();
  if (players.length === 0) return;
  for (const player of players) {
    if (selections[player.id] && selections[player.id].category === "generator") {
      const generatorData = getGeneratorAt(selections[player.id].pos);
      if (generatorData) {
        updateGeneratorTitle(player, generatorData);
      }
    }
  }
}, 10);


function updateLightTestActionBarForPlayer(player) {
  function isPlayerNearPoint(player, point, maxDistance) {
    const playerPos = player.location;
    const dx = playerPos.x - point.x;
    const dy = playerPos.y - point.y;
    const dz = playerPos.z - point.z;
    const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
    return distance <= maxDistance;
  }
  const inventory = player.getComponent("minecraft:inventory").container;
  const slot = player.selectedSlot;
  let item = null;
  if (typeof slot === "number" && slot >= 0 && slot < inventory.size) {
    item = inventory.getItem(slot);
  }
  if (!item || item.typeId !== "fr:wrench") return;
  let message = "";
  const viewDistance = 7.5;
  const blockData = player.getBlockFromViewDirection({ maxDistance: viewDistance });
  const block = blockData?.block;
  if (block && (
      SWITCH_TYPES.has(block.typeId) ||
      GENERATOR_TYPES.has(block.typeId) ||
      LIGHT_TYPES.has(block.typeId)
    )) {
    if (LIGHT_TYPES.has(block.typeId)) {
      const blockPos = { x: block.location.x, y: block.location.y, z: block.location.z, dimensionId: player.dimension.id };
      const connections = getConnections();
      const connection = connections.find(conn =>
        conn.light.x === blockPos.x &&
        conn.light.y === blockPos.y &&
        conn.light.z === blockPos.z &&
        conn.light.dimensionId === blockPos.dimensionId
      );
      if (connection) {
        const dx = blockPos.x - connection.switch.x;
        const dy = blockPos.y - connection.switch.y;
        const dz = blockPos.z - connection.switch.z;
        const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (distance > 64) {
          message = " §l§6Unlinked a§r";
        } else {
          const switchBlock = world.getDimension(connection.switch.dimensionId).getBlock({
            x: connection.switch.x,
            y: connection.switch.y,
            z: connection.switch.z,
          });
          let switchName = "Manual";
          let isSwitchActive = false;
          if (switchBlock) {
            if (SWITCH_TYPES.has(switchBlock.typeId)) {
              switchName = SWITCH_ALIASES[switchBlock.typeId] || "Switch";
              isSwitchActive = switchBlock.permutation.getState("fr:switch_type") === true;
            } else if (GENERATOR_TYPES.has(switchBlock.typeId)) {
              switchName = GENERATOR_ALIASES[switchBlock.typeId] || "Generator";
              const gen = getGeneratorAt(connection.switch);
              isSwitchActive = gen && gen.active && gen.energy > 0;
            }
          }
          const linkedColor = isSwitchActive ? "§q" : "§c";
          message = `§l${linkedColor} Linked to ${switchName}§r\n §7Coords (${connection.switch.x}, ${connection.switch.y}, ${connection.switch.z})`;
          const isLit = block.permutation.getState("fr:lit") === true;
          const stateText = isLit ? "On" : "Off";
          const stateColor = isLit ? "§q " : "§c ";
          message += `\n${stateColor}State: ${stateText}§r`;
        }
      } else {
        message = " §l§6Unlinked§r";
      }
    }
    else if (SWITCH_TYPES.has(block.typeId) || GENERATOR_TYPES.has(block.typeId)) {
      const blockPos = { x: block.location.x, y: block.location.y, z: block.location.z, dimensionId: player.dimension.id };
      const connections = getConnections();
      const numConnections = connections.filter(conn =>
        conn.switch.x === blockPos.x &&
        conn.switch.y === blockPos.y &&
        conn.switch.z === blockPos.z &&
        conn.switch.dimensionId === blockPos.dimensionId
      ).length;
      let blockName = "";
      if (SWITCH_TYPES.has(block.typeId)) {
        blockName = `§l§f${SWITCH_ALIASES[block.typeId] || "Switch"}§r`;
      } else if (GENERATOR_TYPES.has(block.typeId)) {
        blockName = `§l§f${GENERATOR_ALIASES[block.typeId] || "Generator"}§r`;
      }
      let connectionsText = `${numConnections}/30`;
      if (numConnections >= 30) {
        connectionsText = "§c30/30 §l§r";
      }
      if (GENERATOR_TYPES.has(block.typeId)) {
        const generatorData = getGeneratorAt(blockPos);
        const energyInfo = generatorData ? generatorData.energy : "N/A";
        const radiusInfo = generatorData ? generatorData.radius : 8;
        message = `${blockName}\n§p Energy: ${energyInfo}/500§r\n§7 Connections: ${connectionsText}\n§7 Radius: ${radiusInfo}`;
      } else {
        message = `${blockName}\n§7 Connections: ${connectionsText}`;
      }
    }
  }
  if (selections[player.id]) {
    const selPos = selections[player.id].pos;
    let isLookingAtSelected = false;
    if (blockData && blockData.block) {
      if (Math.floor(blockData.block.location.x) === selPos.x &&
          Math.floor(blockData.block.location.y) === selPos.y &&
          Math.floor(blockData.block.location.z) === selPos.z) {
        isLookingAtSelected = true;
      }
    }
    if (!isLookingAtSelected) {
      const dimension = world.getDimension(selPos.dimensionId);
      const selectedBlock = dimension.getBlock({ x: selPos.x, y: selPos.y, z: selPos.z });
      let selectedMessage = "";
      if (selectedBlock) {
        if (SWITCH_TYPES.has(selectedBlock.typeId) || GENERATOR_TYPES.has(selectedBlock.typeId)) {
          let blockName = "";
          if (SWITCH_TYPES.has(selectedBlock.typeId)) {
            blockName = `§l§f${SWITCH_ALIASES[selectedBlock.typeId] || "Switch"}§r`;
          } else if (GENERATOR_TYPES.has(selectedBlock.typeId)) {
            blockName = `§l§f${GENERATOR_ALIASES[selectedBlock.typeId] || "Generator"}§r`;
          }
          selectedMessage = blockName;
          if (GENERATOR_TYPES.has(selectedBlock.typeId)) {
            const generatorData = getGeneratorAt(selPos);
            const energyInfo = generatorData ? generatorData.energy : "N/A";
            const radiusInfo = generatorData ? generatorData.radius : 8;
            selectedMessage += `\n§p Energy: ${energyInfo}/500§r`;
            selectedMessage += `\n§7 Radius: ${radiusInfo}`;
          }
          const selConnections = getConnections().filter(conn =>
            conn.switch.x === selPos.x &&
            conn.switch.y === selPos.y &&
            conn.switch.z === selPos.z &&
            conn.switch.dimensionId === selPos.dimensionId
          ).length;
          let connectionsText = `${selConnections}/30`;
          if (selConnections >= 30) {
            connectionsText = "§c30/30 §l§r";
          }
          selectedMessage += `\n§7 Connections: ${connectionsText}`;
          selectedMessage += `\n§7 Coords: (${selPos.x}, ${selPos.y}, ${selPos.z})`;
        } else {
          selectedMessage = `§cOutside the radius\n§7 Selected block at (${selPos.x}, ${selPos.y}, ${selPos.z})`;
        }
      } else {
        selectedMessage = `§cOutside the radius\n§7 Selected block at (${selPos.x}, ${selPos.y}, ${selPos.z})`;
      }
      if (message !== "") {
        message += "\n\n" + selectedMessage;
      } else {
        message = selectedMessage;
      }
    }
  }
  if (message !== "") {
    player.onScreenDisplay.setActionBar({
      rawtext: [
        { text: message }
      ],
    });
  }
}

let lastActionBarUpdate = new Map();
system.runInterval(() => {
  const players = world.getPlayers();
  if (players.length === 0) return;
  for (let i = 0; i < players.length; i++) {
    updateLightTestActionBarForPlayer(players[i]);
  }
}, 10);
