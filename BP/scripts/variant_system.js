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



import { world, system } from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";
import * as FRAPI from "./fr_api.js";

const VARIANT_REGISTRY = new Map();

export function registerBlockVariants(blockId, variants) {
  if (!blockId || !Array.isArray(variants)) {
    return;
  }
  VARIANT_REGISTRY.set(blockId, { variants });
  FRAPI.registerBlockVariants(blockId, variants);
}

function getBlockVariants(blockId) {
  const entry = VARIANT_REGISTRY.get(blockId);
  if (entry) return entry.variants;

  const externalVariants = FRAPI.getBlockVariants(blockId);
  if (externalVariants) return externalVariants;

  return null;
}

function getVariantsStateRange(block) {
  try {
    const states = block.permutation.getAllStates();

    if (states.hasOwnProperty("fr:variants")) {
      const currentValue = states["fr:variants"];
      let max = 0;
      for (let i = 0; i < 32; i++) {
        try {
          block.permutation.withState("fr:variants", i);
          max = i;
        } catch {
          break;
        }
      }

      return { min: 0, max, current: currentValue };
    }
  } catch { }
  return null;
}

const CHAINED_VARIANT_BLOCKS = new Set();

export function registerChainedVariantBlock(blockId) {
  CHAINED_VARIANT_BLOCKS.add(blockId);
}

function applyChainedVariant(block, variantIndex) {
  const blockId = block.typeId;
  if (!CHAINED_VARIANT_BLOCKS.has(blockId)) return;

  const states = block.permutation.getAllStates();
  if (!states.hasOwnProperty("fr:block_bit")) return;

  const dim = block.dimension;
  const loc = block.location;

  for (let yOffset = -2; yOffset <= 2; yOffset++) {
    if (yOffset === 0) continue;
    try {
      const neighborBlock = dim.getBlock({ x: loc.x, y: loc.y + yOffset, z: loc.z });
      if (neighborBlock && neighborBlock.typeId === blockId) {
        const neighborStates = neighborBlock.permutation.getAllStates();
        if (neighborStates.hasOwnProperty("fr:variants") && neighborStates.hasOwnProperty("fr:block_bit")) {
          const newPerm = neighborBlock.permutation.withState("fr:variants", variantIndex);
          neighborBlock.setPermutation(newPerm);
        }
      }
    } catch { }
  }
}

async function showVariantMenu(player, block) {
  try {
    const blockId = block.typeId;
    const variantRange = getVariantsStateRange(block);

    if (!variantRange) {
      player.sendMessage("§cThis block has no variants");
      return;
    }

    const { min, max, current } = variantRange;
    const registeredVariants = getBlockVariants(blockId);

    const form = new ActionFormData();
    const blockName = blockId.split(":")[1] || blockId;
    form.title(`§V§A§R§I§A§N§T${blockName} variants`);

    const buttons = [];

    for (let i = min; i <= max; i++) {
      let label, icon, color;

      if (registeredVariants && registeredVariants[i]) {
        const variant = registeredVariants[i];
        label = variant.label || `Variant ${i + 1}`;
        icon = variant.icon || "textures/ui/icon_placeholder";
        color = variant.color || "gray";
      } else {
        label = `Variant ${i + 1}`;
        icon = "textures/ui/icon_placeholder";
        color = "gray";
      }

      const colorLabel = `${color} ${label}`;

      const finalLabel = (i === current) ? `§a✓ §r${colorLabel}` : colorLabel;

      form.button(finalLabel, icon);
      buttons.push({ index: i, label, color, icon });
    }

    const response = await form.show(player);

    if (response.canceled) return;

    const selectedButton = buttons[response.selection];
    if (selectedButton === undefined) return;

    try {
      const newPerm = block.permutation.withState("fr:variants", selectedButton.index);
      block.setPermutation(newPerm);
      applyChainedVariant(block, selectedButton.index);
      player.sendMessage(`§aVariant changed to: §7${selectedButton.label}`);
      player.playSound("random.orb");
    } catch (err) {
      player.sendMessage(`§cFailed to change variant: ${err.message}`);
    }

  } catch {
    player.sendMessage(`§cError opening variant menu`);
  }
}

world.afterEvents.playerInteractWithBlock.subscribe((event) => {
  const { player, block, itemStack } = event;

  if (!player || !block) return;

  if (!itemStack || itemStack.typeId !== "fr:faz-diver_employee") return;

  const variantRange = getVariantsStateRange(block);
  if (!variantRange) return;

  system.run(() => {
    showVariantMenu(player, block);
  });
});

registerBlockVariants("fr:ceiling_stars", [
  {
    label: "Stars Pattern 1",
    icon: "textures/blocks/reworked/wires/ceiling_stars_var_1",
    color: "gray"
  },
  {
    label: "Stars Pattern 2",
    icon: "textures/blocks/reworked/wires/ceiling_stars_var_2",
    color: "gray"
  },
  {
    label: "Stars Pattern 3",
    icon: "textures/blocks/reworked/wires/ceiling_stars_var_3",
    color: "gray"
  },
  {
    label: "Stars Pattern 4",
    icon: "textures/blocks/reworked/wires/ceiling_stars_var_4",
    color: "gray"
  },
  {
    label: "Stars Pattern 5",
    icon: "textures/blocks/reworked/wires/ceiling_stars_var_5",
    color: "gray"
  }
]);

registerBlockVariants("fr:ceiling_wires", [
  {
    label: "Normal",
    icon: "textures/blocks/reworked/wires/ceiling_wires_var_1",
    color: "gray"
  },
  {
    label: "Messy",
    icon: "textures/blocks/reworked/wires/ceiling_wires_var_2",
    color: "gray"
  },
  {
    label: "Cutted",
    icon: "textures/blocks/reworked/wires/ceiling_wires_var_3",
    color: "gray"
  },
  {
    label: "Tangled",
    icon: "textures/blocks/reworked/wires/ceiling_wires_var_4",
    color: "gray"
  },
  {
    label: "Messy & cutted",
    icon: "textures/blocks/reworked/wires/ceiling_wires_var_5",
    color: "gray"
  }
]);

registerBlockVariants("fr:hallway_monitors", [
  {
    label: "Stack #1",
    icon: "textures/fr_ui/icons/hallway_monitors_1",
    color: "gray"
  },
  {
    label: "Stack #2",
    icon: "textures/fr_ui/icons/hallway_monitors_2",
    color: "gray"
  },
  {
    label: "Stack #3",
    icon: "textures/fr_ui/icons/hallway_monitors_3",
    color: "gray"
  },
  {
    label: "Stack #4",
    icon: "textures/fr_ui/icons/hallway_monitors_4",
    color: "gray"
  },
  {
    label: "Stack #5",
    icon: "textures/fr_ui/icons/hallway_monitors_5",
    color: "gray"
  },
  {
    label: "Stack #6",
    icon: "textures/fr_ui/icons/hall_monitor_6",
    color: "gray"
  }
]);

registerBlockVariants("fr:gray_locker", [
  {
    label: "Gray",
    icon: "textures/fr_ui/icons/locker_gray",
    color: "gray"
  },
  {
    label: "Red",
    icon: "textures/fr_ui/icons/locker_red",
    color: "red"
  },
  {
    label: "Green",
    icon: "textures/fr_ui/icons/locker_green",
    color: "green"
  },
  {
    label: "Purple",
    icon: "textures/fr_ui/icons/locker_purple",
    color: "purple"
  },
  {
    label: "Blue",
    icon: "textures/fr_ui/icons/locker_blue",
    color: "blue"
  },
  {
    label: "Yellow",
    icon: "textures/fr_ui/icons/locker_yellow",
    color: "yellow"
  },
  {
    label: "Cyan",
    icon: "textures/fr_ui/icons/locker_cyan",
    color: "cyan"
  }
]);

registerBlockVariants("fr:backstage_shelf_freddy_head", [
  {
    label: "Position 1",
    icon: "textures/fr_ui/icons/backstage_shelf_freddy_head",
    color: "orange"
  },
  {
    label: "Position 2",
    icon: "textures/fr_ui/icons/backstage_shelf_freddy_head_2",
    color: "orange"
  },
  {
    label: "Position 3",
    icon: "textures/fr_ui/icons/backstage_shelf_freddy_head_3",
    color: "orange"
  }
]);

registerBlockVariants("fr:walls_pepperoni_pizza_wooden", [
  {
    label: "Shape 1",
    icon: "textures/fr_ui/icons/walls_pepperoni_pizza_wooden_1",
    color: "yellow"
  },
  {
    label: "Shape 2",
    icon: "textures/fr_ui/icons/walls_pepperoni_pizza_wooden_2",
    color: "yellow"
  },
  {
    label: "Shape 3",
    icon: "textures/fr_ui/icons/walls_pepperoni_pizza_wooden_3",
    color: "yellow"
  },
  {
    label: "Shape 4",
    icon: "textures/fr_ui/icons/walls_pepperoni_pizza_wooden_4",
    color: "yellow"
  },
  {
    label: "Shape 5",
    icon: "textures/fr_ui/icons/walls_pepperoni_pizza_wooden_5",
    color: "yellow"
  }
]);

registerBlockVariants("fr:walls_pizza_wooden", [
  {
    label: "Shape 1",
    icon: "textures/fr_ui/icons/walls_pizza_wooden_1",
    color: "yellow"
  },
  {
    label: "Shape 2",
    icon: "textures/fr_ui/icons/walls_pizza_wooden_2",
    color: "yellow"
  },
  {
    label: "Shape 3",
    icon: "textures/fr_ui/icons/walls_pizza_wooden_3",
    color: "yellow"
  },
  {
    label: "Shape 4",
    icon: "textures/fr_ui/icons/walls_pizza_wooden_4",
    color: "yellow"
  },
  {
    label: "Shape 5",
    icon: "textures/fr_ui/icons/walls_pizza_wooden_5",
    color: "yellow"
  }
]);

registerBlockVariants("fr:backstage_shelf_bonnie_head", [
  {
    label: "Position 1",
    icon: "textures/fr_ui/icons/backstage_shelf_bonnie_head",
    color: "blue"
  },
  {
    label: "Position 2",
    icon: "textures/fr_ui/icons/backstage_shelf_bonnie_head_pupils",
    color: "blue"
  },
  {
    label: "Position 3",
    icon: "textures/fr_ui/icons/backstage_shelf_bonnie_head_2",
    color: "blue"
  }
]);

registerBlockVariants("fr:wall_wire", [
  {
    label: "Pattern 1",
    icon: "textures/fr_ui/icons/wall_wires_1",
    color: "gray"
  },
  {
    label: "Pattern 2",
    icon: "textures/fr_ui/icons/wall_wires_2",
    color: "gray"
  },
  {
    label: "Pattern 3",
    icon: "textures/fr_ui/icons/wall_wires_3",
    color: "gray"
  },
  {
    label: "Pattern 4",
    icon: "textures/fr_ui/icons/wall_wires_4",
    color: "gray"
  }
]);

registerBlockVariants("fr:trash", [
  {
    label: "Pattern 1",
    icon: "textures/fr_ui/icons/trash1",
    color: "gray"
  },
  {
    label: "Pattern 2",
    icon: "textures/fr_ui/icons/trash2",
    color: "gray"
  },
  {
    label: "Pattern 3",
    icon: "textures/fr_ui/icons/trash3",
    color: "gray"
  }
]);

registerBlockVariants("fr:retro_phone", [
  {
    label: "Red",
    icon: "textures/fr_ui/icons/retro_phone_red",
    color: "red"
  },
  {
    label: "Blue",
    icon: "textures/fr_ui/icons/retro_phone_blue",
    color: "blue"
  },
  {
    label: "Black",
    icon: "textures/fr_ui/icons/retro_phone_black",
    color: "black"
  },
  {
    label: "Green",
    icon: "textures/fr_ui/icons/retro_phone_green",
    color: "green"
  },
  {
    label: "Purple",
    icon: "textures/fr_ui/icons/retro_phone_purple",
    color: "purple"
  }
]);

registerBlockVariants("fr:wall_clock", [
  {
    label: "Black",
    icon: "textures/fr_ui/icons/wall_clock_black",
    color: "black"
  },
  {
    label: "Green",
    icon: "textures/fr_ui/icons/wall_clock_green",
    color: "green"
  }
]);
registerBlockVariants("fr:office_window", [
  {
    label: "Office Wall Window Bottom Left",
    icon: "textures/fr_ui/icons/office_wall_window_bottom_left",
    color: "black"
  },
  {
    label: "Office Wall Window Upper Left",
    icon: "textures/fr_ui/icons/office_wall_window_upper_left",
    color: "black"
  },
  {
    label: "Office Wall Window Bottom Right",
    icon: "textures/fr_ui/icons/office_wall_window_bottom_right",
    color: "black"
  },
  {
    label: "Office Wall Window Upper Right",
    icon: "textures/fr_ui/icons/office_wall_window_upper_right",
    color: "black"
  },
  {
    label: "Office Window Bottom Left",
    icon: "textures/fr_ui/icons/office_window_bottom_left",
    color: "black"
  },
  {
    label: "Office Window Upper Left",
    icon: "textures/fr_ui/icons/office_window_upper_left",
    color: "black"
  },
  {
    label: "Office Window Bottom Right",
    icon: "textures/fr_ui/icons/office_window_bottom_right",
    color: "black"
  },
  {
    label: "Office Window Upper Right",
    icon: "textures/fr_ui/icons/office_window_upper_right",
    color: "black"
  }
]);

registerBlockVariants("fr:wall_tear_holes", [
  {
    label: "Wall Tear Hole 1",
    icon: "textures/blocks/reworked/cracked_wall/wall_tear_hole_1",
    color: "gray"
  },
  {
    label: "Wall Tear Hole 2",
    icon: "textures/blocks/reworked/cracked_wall/wall_tear_hole_2",
    color: "gray"
  },
  {
    label: "Brick Tear 1",
    icon: "textures/blocks/reworked/cracked_wall/brick_tear_1",
    color: "gray"
  },
  {
    label: "Brick Tear 2",
    icon: "textures/blocks/reworked/cracked_wall/brick_tear_2",
    color: "gray"
  },
  {
    label: "Brick Tear Bottom",
    icon: "textures/blocks/reworked/cracked_wall/brick_tear_bottom",
    color: "gray"
  },
  {
    label: "Brick Tear Bottom Left Corner",
    icon: "textures/blocks/reworked/cracked_wall/brick_tear_bottom_left_corner",
    color: "gray"
  },
  {
    label: "Brick Tear Bottom Right Corner",
    icon: "textures/blocks/reworked/cracked_wall/brick_tear_bottom_right_corner",
    color: "gray"
  },
  {
    label: "Brick Tear Left",
    icon: "textures/blocks/reworked/cracked_wall/brick_tear_left",
    color: "gray"
  },
  {
    label: "Brick Tear Left Big",
    icon: "textures/blocks/reworked/cracked_wall/brick_tear_left_big",
    color: "gray"
  },
  {
    label: "Brick Tear Right",
    icon: "textures/blocks/reworked/cracked_wall/brick_tear_right",
    color: "gray"
  },
  {
    label: "Brick Tear Right Big",
    icon: "textures/blocks/reworked/cracked_wall/brick_tear_right_big",
    color: "gray"
  },
  {
    label: "Brick Tear Top",
    icon: "textures/blocks/reworked/cracked_wall/brick_tear_top",
    color: "gray"
  },
  {
    label: "Brick Tear Top Left Corner",
    icon: "textures/blocks/reworked/cracked_wall/brick_tear_top_left_corner",
    color: "gray"
  },
  {
    label: "Brick Tear Top Right Corner",
    icon: "textures/blocks/reworked/cracked_wall/brick_tear_top_right_corner",
    color: "gray"
  }
]);

registerBlockVariants("fr:kitchen_counter_drawers", [
  {
    label: "Counter (No Drawers)",
    icon: "textures/fr_ui/icons/kitchen_counter_drawers_1",
    color: "gray"
  },
  {
    label: "Drawer Empty",
    icon: "textures/fr_ui/icons/kitchen_counter_drawers_2",
    color: "gray"
  },
  {
    label: "Drawer With Items 1",
    icon: "textures/fr_ui/icons/kitchen_counter_drawers_3",
    color: "gray"
  },
  {
    label: "Drawer With Items 2",
    icon: "textures/fr_ui/icons/kitchen_counter_drawers_4",
    color: "gray"
  }
]);

registerBlockVariants("fr:stone_oven", [
  {
    label: "Left Position",
    icon: "textures/blocks/reworked/kitchen/stone_oven",
    color: "gray"
  },
  {
    label: "Center Position",
    icon: "textures/blocks/reworked/kitchen/stone_oven",
    color: "gray"
  }
]);

registerBlockVariants("fr:fridge", [
  {
    label: "Fridge 1",
    icon: "textures/blocks/reworked/kitchen/fridge",
    color: "gray"
  },
  {
    label: "Fridge 2",
    icon: "textures/blocks/reworked/kitchen/fridge",
    color: "gray"
  }
]);

registerBlockVariants("fr:shelf_supply_closet", [
  {
    label: "Shelf 1",
    icon: "textures/blocks/reworked/kitchen/shelf_supply_closet",
    color: "gray"
  },
  {
    label: "Shelf 2",
    icon: "textures/blocks/reworked/kitchen/shelf_supply_closet",
    color: "gray"
  }
]);

registerChainedVariantBlock("fr:stone_oven");
registerChainedVariantBlock("fr:fridge");
registerChainedVariantBlock("fr:shelf_supply_closet");

registerBlockVariants("fr:text_display_block", [
  {
    label: "Center",
    icon: "textures/fr_ui/black_wall_sign",
    color: "gray"
  },
  {
    label: "Side 1",
    icon: "textures/fr_ui/black_wall_sign",
    color: "gray"
  },
  {
    label: "Side 2",
    icon: "textures/fr_ui/black_wall_sign",
    color: "gray"
  }
]);

registerBlockVariants("fr:black_wall_sign_small", [
  {
    label: "Center",
    icon: "textures/fr_ui/black_wall_sign_small",
    color: "gray"
  },
  {
    label: "Side 1",
    icon: "textures/fr_ui/black_wall_sign_small",
    color: "gray"
  },
  {
    label: "Side 2",
    icon: "textures/fr_ui/black_wall_sign_small",
    color: "gray"
  }
]);

registerBlockVariants("fr:white_wall_sign", [
  {
    label: "Center",
    icon: "textures/fr_ui/white_wall_sign",
    color: "gray"
  },
  {
    label: "Side 1",
    icon: "textures/fr_ui/white_wall_sign",
    color: "gray"
  },
  {
    label: "Side 2",
    icon: "textures/fr_ui/white_wall_sign",
    color: "gray"
  }
]);

registerBlockVariants("fr:white_wall_sign_small", [
  {
    label: "Center",
    icon: "textures/fr_ui/white_wall_sign_small",
    color: "gray"
  },
  {
    label: "Side 1",
    icon: "textures/fr_ui/white_wall_sign_small",
    color: "gray"
  },
  {
    label: "Side 2",
    icon: "textures/fr_ui/white_wall_sign_small",
    color: "gray"
  }
]);

registerBlockVariants("fr:arcade_stool", [
  {
    label: "Blue",
    icon: "textures/fr_ui/icons/arcade_stool_blue",
    color: "blue"
  },
  {
    label: "Green",
    icon: "textures/fr_ui/icons/arcade_stool_green",
    color: "green"
  },
  {
    label: "Orange",
    icon: "textures/fr_ui/icons/arcade_stool_orange",
    color: "orange"
  },
  {
    label: "Purple",
    icon: "textures/fr_ui/icons/arcade_stool_purple",
    color: "purple"
  },
  {
    label: "Red",
    icon: "textures/fr_ui/icons/arcade_stool_red",
    color: "red"
  },
  {
    label: "Yellow",
    icon: "textures/fr_ui/icons/arcade_stool_yellow",
    color: "yellow"
  }
]);

registerBlockVariants("fr:small_gifts", [
  {
    label: "ITP Style",
    icon: "textures/fr_ui/icons/small_gifts_var_1",
    color: "blue"
  },
  {
    label: "Cam8 Style",
    icon: "textures/fr_ui/icons/small_gifts_var_2",
    color: "purple"
  }
]);

registerBlockVariants("fr:gift", [
  {
    label: "Blue",
    icon: "textures/fr_ui/icons/gift_blue",
    color: "blue"
  },
  {
    label: "Green",
    icon: "textures/fr_ui/icons/gift_green",
    color: "green"
  },
  {
    label: "Green & Red",
    icon: "textures/fr_ui/icons/gift_greenred",
    color: "green"
  },
  {
    label: "Orange",
    icon: "textures/fr_ui/icons/gift_orange",
    color: "orange"
  },
  {
    label: "Purple",
    icon: "textures/fr_ui/icons/gift_purple",
    color: "purple"
  },
  {
    label: "Red",
    icon: "textures/fr_ui/icons/gift_red",
    color: "red"
  },
  {
    label: "Yellow",
    icon: "textures/fr_ui/icons/gift_yellow",
    color: "yellow"
  }
]);

registerBlockVariants("fr:small_gift", [
  {
    label: "Blue",
    icon: "textures/fr_ui/icons/small_gift_blue",
    color: "blue"
  },
  {
    label: "Green",
    icon: "textures/fr_ui/icons/small_gift_green",
    color: "green"
  },
  {
    label: "Green & Red",
    icon: "textures/fr_ui/icons/small_gift_greenred",
    color: "green"
  },
  {
    label: "Orange",
    icon: "textures/fr_ui/icons/small_gift_orange",
    color: "orange"
  },
  {
    label: "Purple",
    icon: "textures/fr_ui/icons/small_gift_purple",
    color: "purple"
  },
  {
    label: "Red",
    icon: "textures/fr_ui/icons/small_gift_red",
    color: "red"
  },
  {
    label: "Yellow",
    icon: "textures/fr_ui/icons/small_gift_yellow",
    color: "yellow"
  },
]);
registerBlockVariants("fr:breaker", [
  {
    label: "Black",
    icon: "textures/fr_ui/icons/breaker_black",
    color: "black"
  },
  {
    label: "White",
    icon: "textures/fr_ui/icons/breaker_white",
    color: "gray"
  },
  {
    label: "Gray",
    icon: "textures/fr_ui/icons/breaker_gray",
    color: "gray"
  }
]);