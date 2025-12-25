import { world, system } from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";

const VARIANT_REGISTRY = new Map();

export function registerBlockVariants(blockId, variants) {
  if (!blockId || !Array.isArray(variants)) {
    return;
  }
  VARIANT_REGISTRY.set(blockId, { variants });
}

function getBlockVariants(blockId) {
  const entry = VARIANT_REGISTRY.get(blockId);
  return entry ? entry.variants : null;
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
  } catch {}
  return null;
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
    
    const numVariants = max - min + 1;
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
      
      player.sendMessage(`§aVariant changed to: §7${selectedButton.label}`);
      player.playSound("random.click");
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
  
  if (!itemStack || itemStack.typeId !== "fr:wrench") return;
  
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
    icon: "textures/fr_ui/icons/walls_pepperoni_pizza_wooden", 
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
    color: "orange" 
  }
]);

registerBlockVariants("fr:walls_pizza_wooden", [
  { 
    label: "Shape 1", 
    icon: "textures/fr_ui/icons/walls_pizza_wooden", 
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