# Light Block Configuration

Unified config system for electric blocks and their VFX entities.

## Config Types

### 1. Basic Light
No rotation, no offset. Just spawns at block center.

```javascript
"fr:example_basic": {
  alias: "Example Basic Light",
  icon: "textures/fr_ui/light_test_icon",
  vfxEntity: "fr:hallway_lamp_vfx",
  spawnOffset: { x: 0, y: 0, z: 0 },
  destroyRadius: 0.5,
  powerState: "fr:lit"
}
```

**Properties:**
- `alias` - Display name
- `icon` - Icon texture path
- `vfxEntity` - VFX entity ID to spawn
- `spawnOffset` - Offset from block center
- `destroyRadius` - Search radius when destroying VFX
- `powerState` - Block state for on/off

**Used by:** `fr:office_light`, `fr:office_lamp`, `fr:supply_room_lightbulb`, `fr:pizzeria_lamp`

---

### 2. Cardinal Rotation
Rotates based on block direction (north/south/east/west).

```javascript
"fr:example_cardinal": {
  alias: "Example Cardinal Light",
  icon: "textures/fr_ui/light_test_icon",
  vfxEntity: "fr:ceiling_light_vfx",
  spawnOffset: { x: 0, y: 0, z: 0 },
  destroyRadius: 0.5,
  powerState: "fr:lit",
  requiresCardinalRotation: true,
  cardinalState: "minecraft:cardinal_direction",
  rotationMap: {
    north: 0,
    south: 0,
    east: 90,
    west: 90
  }
}
```

**Extra properties:**
- `requiresCardinalRotation` - Enable cardinal rotation
- `cardinalState` - Block state with direction
- `rotationMap` - Direction to Y rotation mapping

**Used by:** `fr:ceiling_light`

---

### 3. Cardinal Offset
Spawns at different positions based on block direction.

```javascript
"fr:example_offset": {
  alias: "Example Offset Light",
  icon: "textures/fr_ui/light_test_icon",
  vfxEntity: "fr:pirate_cove_light_entity",
  spawnOffset: { x: 0, y: -0.1, z: 0 },
  destroyRadius: 1.5,
  powerState: "fr:lit",
  requiresCardinalRotation: true,
  cardinalState: "minecraft:cardinal_direction",
  offsetMap: {
    north: { x: 0, y: 0, z: -0.3 },
    south: { x: 0, y: 0, z: 0.3 },
    east: { x: 0.3, y: 0, z: 0 },
    west: { x: -0.3, y: 0, z: 0 }
  },
  rotationMap: {
    north: 180,
    south: 0,
    east: 90,
    west: -90
  }
}
```

**Extra properties:**
- `offsetMap` - Direction to position offset mapping
- `rotationMap` - Direction to Y rotation mapping

**Used by:** `fr:pirate_cove_light`

---

### 4. Face Rotation
Uses commands instead of spawnEntity. Rotates based on block face.

```javascript
"fr:example_face": {
  alias: "Example Face Light",
  icon: "textures/fr_ui/light_test_icon",
  vfxEntity: "fr:stage_spotlight_vfx",
  spawnOffset: { x: 0, y: 0, z: 0 },
  destroyRadius: 0.5,
  powerState: "fr:lit",
  useCommand: true,
  requiresFaceRotation: true,
  faceState: "minecraft:block_face",
  rotationState: "fr:rotation",
  colorState: "fr:color"
}
```

**Extra properties:**
- `useCommand` - Use command instead of spawnEntity
- `requiresFaceRotation` - Enable face-based rotation
- `faceState` - Block state with face direction
- `rotationState` - Block state with rotation value
- `colorState` - Block state with color (optional)

**Used by:** `fr:stage_spotlight`

---

## Available VFX Entities

- `fr:hallway_lamp_vfx`
- `fr:pirate_cove_light_entity`
- `fr:ceiling_light_vfx`
- `fr:pizzeria_lamp_vfx`
- `fr:office_lamp_vfx`
- `fr:stage_spotlight_vfx`

---

## Functions

### `getLightConfig(blockId)`
Gets config for a light block.

```javascript
const config = getLightConfig("fr:office_light");
```

### `spawnLightVfx(dimension, lightBlock, lightData, vfxCache)`
Spawns VFX entity using block config.

```javascript
spawnLightVfx(dimension, lightBlock, conn.light, lampVfxEntities);
```

**Parameters:**
- `dimension` - Where to spawn
- `lightBlock` - The light block
- `lightData` - Position data `{ x, y, z, dimensionId }`
- `vfxCache` - VFX entity cache

### `destroyLightVfx(dimension, lightData, vfxCache)`
Destroys VFX entity using block config.

```javascript
destroyLightVfx(dimension, { ...conn.light, typeId: lightBlock.typeId }, lampVfxEntities);
```

**Parameters:**
- `dimension` - Where to destroy
- `lightData` - Light data `{ x, y, z, dimensionId, typeId }`
- `vfxCache` - VFX entity cache

---

## Adding New Lights

1. Add config to `LIGHT_BLOCK_CONFIGS` in `connection_types.js`
2. Pick the right config type (basic, cardinal, offset, face)
3. System handles spawn/destroy automatically
4. No need to touch `main_system.js` or `door_buttons.js`

Example:
```javascript
export const LIGHT_BLOCK_CONFIGS = {
  "fr:my_new_light": {
    alias: "My New Light",
    icon: "textures/fr_ui/light_test_icon",
    vfxEntity: "fr:my_vfx_entity",
    spawnOffset: { x: 0, y: 0, z: 0 },
    destroyRadius: 0.5,
    powerState: "fr:lit"
  }
};
```

---

## Notes

- `spawnOffset` applies from block center (x + 0.5, y, z + 0.5)
- `destroyRadius` determines search range when destroying VFX
- `offsetMap` offsets add to base `spawnOffset`
- `useCommand` needed for entities requiring specific spawn angles
- `colorState` only works with `requiresFaceRotation` + `useCommand`
