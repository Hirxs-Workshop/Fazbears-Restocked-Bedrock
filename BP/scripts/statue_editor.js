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

import { world, system, EquipmentSlot, ItemStack } from "@minecraft/server";
import { ActionFormData, ModalFormData, MessageFormData } from "@minecraft/server-ui";
import {
  getWaypointsForStatue,
  getOrCreateStatueId,
  startBlockSelectorMode,
  cancelBlockSelectorMode,
  isInBlockSelectorMode,
  clearAllWaypointsForStatue,
  refreshWaypointCache,
  startPathingSimulation,
  startRouteTest,
  cancelRouteTestForEntity,
  isEntityInRouteTest,
  setWaypointData,
  getWaypointData,
  removeWaypointData,
  MIN_WAIT_TIME,
  MAX_WAIT_TIME,
  DEFAULT_WAIT_TIME,
  ABILITY_TYPES
} from "./animatronic_pathing.js";



const POSES_BONNIE = [
  { name: "stand.anim", icon: "textures/fr_ui/poses/bonnie/bonnie_statue_pose_stand", type: "normal" },
  { name: "showtime.anim", icon: "textures/fr_ui/poses/bonnie/bonnie_statue_pose_showtime", type: "normal" },
  { name: "stage.anim", icon: "textures/fr_ui/poses/bonnie/bonnie_statue_pose_stage", type: "normal" },
  { name: "stare.anim", icon: "textures/fr_ui/poses/bonnie/bonnie_statue_pose_stare", type: "normal" },
  { name: "ending.anim", icon: "textures/fr_ui/poses/bonnie/bonnie_statue_pose_ending", type: "special" },
  { name: "celebrate.anim", icon: "textures/fr_ui/poses/bonnie/bonnie_statue_pose_celebrate", type: "special" },
  { name: "jam.anim", icon: "textures/fr_ui/poses/bonnie/bonnie_statue_pose_jam", type: "special" },
  { name: "sit.anim", icon: "textures/fr_ui/poses/bonnie/bonnie_statue_pose_sit", type: "normal" },
  { name: "thank_you.anim", icon: "textures/fr_ui/poses/bonnie/bonnie_statue_pose_thanks_you", type: "special" },
  { name: "ar_render.anim", icon: "textures/fr_ui/poses/bonnie/bonnie_statue_pose_ar_render", type: "community" },
  { name: "mugshot.anim", icon: "textures/fr_ui/poses/bonnie/bonnie_statue_pose_mugshot", type: "community" },
  { name: "cam_lean.anim", icon: "textures/fr_ui/poses/bonnie/bonnie_statue_pose_cam_lean", type: "community" },
  { name: "look_up.anim", icon: "textures/fr_ui/poses/bonnie/bonnie_statue_pose_look_up", type: "normal" },
  { name: "wave.anim", icon: "textures/fr_ui/poses/bonnie/bonnie_statue_pose_wave", type: "normal" },
  { name: "ar_render_two.anim", icon: "textures/fr_ui/poses/bonnie/bonnie_statue_pose_ar_render_2", type: "community" },
  { name: "ucn_jumpscare.anim", icon: "textures/fr_ui/poses/bonnie/bonnie_statue_pose_ucn_jumpscare", type: "seasonal" },
  { name: "hold_heart.anim", icon: "textures/fr_ui/poses/bonnie/bonnie_statue_pose_hold_heart", type: "seasonal" },
  { name: "sit_open.anim", icon: "textures/fr_ui/poses/bonnie/bonnie_statue_pose_sit_open", type: "normal" },
  { name: "floor_sit.anim", icon: "textures/fr_ui/poses/bonnie/bonnie_statue_pose_floor_sit", type: "normal" },
  { name: "floor_sit_open.anim", icon: "textures/fr_ui/poses/bonnie/bonnie_statue_pose_floor_sit_open", type: "normal" },
  { name: "lay.anim", icon: "textures/fr_ui/poses/bonnie/bonnie_statue_pose_lay", type: "special" },
  { name: "dismebembered.anim", icon: "textures/fr_ui/poses/bonnie/bonnie_statue_pose_dismebembered", type: "seasonal" },
  { name: "walk.anim", icon: "textures/fr_ui/poses/bonnie/bonnie_statue_pose_walk", type: "special" },
  { name: "idle.anim", icon: "textures/fr_ui/poses/bonnie/bonnie_statue_pose_idle", type: "special" }
];

const POSES_CHICA = [
  { name: "stand.anim", icon: "textures/fr_ui/poses/chica/chica_stand", type: "normal" },
  { name: "thank_you.anim", icon: "textures/fr_ui/poses/chica/chica_thank_you", type: "special" },
  { name: "stage.anim", icon: "textures/fr_ui/poses/chica/chica_stage", type: "normal" },
  { name: "ar_render.anim", icon: "textures/fr_ui/poses/chica/chica_ar_render", type: "community" },
  { name: "eat_pizza.anim", icon: "textures/fr_ui/poses/chica/chica_eat_pizza", type: "special" },
  { name: "wink.anim", icon: "textures/fr_ui/poses/chica/chica_wink", type: "normal" },
  { name: "teaser.anim", icon: "textures/fr_ui/poses/chica/chica_teaser", type: "community" },
  { name: "sit_cupcake.anim", icon: "textures/fr_ui/poses/chica/chica_sit_cupcake", type: "normal" },
  { name: "look_up.anim", icon: "textures/fr_ui/poses/chica/chica_look_up", type: "normal" },
  { name: "dining_room.anim", icon: "textures/fr_ui/poses/chica/chica_dining_room", type: "normal" },
  { name: "west_hall.anim", icon: "textures/fr_ui/poses/chica/chica_west_hall", type: "normal" },
  { name: "dismantled.anim", icon: "textures/fr_ui/poses/chica/chica_dismantled", type: "special" },
  { name: "sit.anim", icon: "textures/fr_ui/poses/chica/chica_sit", type: "normal" },
  { name: "walk.anim", icon: "textures/fr_ui/poses/chica/chica_walk", type: "special" },
  { name: "idle.anim", icon: "textures/fr_ui/poses/chica/chica_idle", type: "normal" },
  { name: "jumpscare.anim", icon: "textures/fr_ui/poses/chica/chica_jumpscare", type: "special" },
  { name: "showtime.anim", icon: "textures/fr_ui/poses/chica/chica_showtime", type: "normal" },
  { name: "stare.anim", icon: "textures/fr_ui/poses/chica/chica_stare", type: "normal" },
  { name: "floor_sit_cupcake.anim", icon: "textures/fr_ui/poses/chica/chica_floor_sit_cupcake", type: "normal" },
  { name: "walk_blood.anim", icon: "textures/fr_ui/poses/chica/chica_walk_blood", type: "seasonal" },
  { name: "idle_blood.anim", icon: "textures/fr_ui/poses/chica/chica_idle_blood", type: "seasonal" }
];

const POSES_FOXY = [
  { name: "stand.anim", icon: "textures/fr_ui/poses/foxy/foxy_stand", type: "normal" },
  { name: "mugshot.anim", icon: "textures/fr_ui/poses/foxy/foxy_mugshot", type: "community" },
  { name: "hw2_render.anim", icon: "textures/fr_ui/poses/foxy/foxy_hw2_render", type: "community" },
  { name: "peek.anim", icon: "textures/fr_ui/poses/foxy/foxy_peek", type: "special" },
  { name: "exit_cove.anim", icon: "textures/fr_ui/poses/foxy/foxy_exit_cove", type: "special" },
  { name: "jumpscare.anim", icon: "textures/fr_ui/poses/foxy/foxy_jumpscare", type: "special" },
  { name: "ar_render1.anim", icon: "textures/fr_ui/poses/foxy/foxy_ar_render1", type: "community" },
  { name: "ar_render_2.anim", icon: "textures/fr_ui/poses/foxy/foxy_ar_render_2", type: "community" },
  { name: "look_up.anim", icon: "textures/fr_ui/poses/foxy/foxy_look_up", type: "normal" },
  { name: "crouch_up.anim", icon: "textures/fr_ui/poses/foxy/foxy_crouch_look_up", type: "normal" },
  { name: "crouch_side.anim", icon: "textures/fr_ui/poses/foxy/foxy_crouch_look_side", type: "normal" },
  { name: "floor_sit.anim", icon: "textures/fr_ui/poses/foxy/foxy_floor_sit", type: "normal" },
  { name: "dismantled.anim", icon: "textures/fr_ui/poses/foxy/foxy_dismantled", type: "seasonal" },
  { name: "walk.anim", icon: "textures/fr_ui/poses/foxy/foxy_walk", type: "special" },
  { name: "idle.anim", icon: "textures/fr_ui/poses/foxy/foxy_idle", type: "normal" },
  { name: "showtime.anim", icon: "textures/fr_ui/poses/foxy/foxy_showtime", type: "special" },
  { name: "sit.anim", icon: "textures/fr_ui/poses/foxy/foxy_sit", type: "normal" },
  { name: "lay.anim", icon: "textures/fr_ui/poses/foxy/foxy_lay", type: "special" },
  { name: "running.anim", icon: "textures/fr_ui/poses/foxy/foxy_running", type: "motion" }
];

const POSES_SPARKY = [
  { name: "stand.anim", icon: "textures/fr_ui/poses/sparky/sparky_stand", type: "normal" },
  { name: "eat_bone.anim", icon: "textures/fr_ui/poses/sparky/sparky_eat_bone", type: "normal" },
  { name: "hoax_pose.anim", icon: "textures/fr_ui/poses/sparky/sparky_hoax_pose", type: "special" },
  { name: "floor_sit.anim", icon: "textures/fr_ui/poses/sparky/sparky_floor_sit", type: "normal" },
  { name: "table_sit.anim", icon: "textures/fr_ui/poses/sparky/sparky_table_sit", type: "normal" },
  { name: "slab_sit.anim", icon: "textures/fr_ui/poses/sparky/sparky_slab_sit", type: "normal" },
  { name: "lay.anim", icon: "textures/fr_ui/poses/sparky/sparky_lay", type: "special" },
  { name: "dismantled.anim", icon: "textures/fr_ui/poses/sparky/sparky_dismantled", type: "seasonal" }
];

const POSES_FREDDY = [
  { name: "stand.anim", icon: "textures/fr_ui/poses/freddy/freddy_statue_pose_stand" },
  { name: "wave.anim", icon: "textures/fr_ui/poses/freddy/freddy_statue_pose_wave" },
  { name: "greet.anim", icon: "textures/fr_ui/poses/freddy/freddy_statue_pose_greet" },
  { name: "stage.anim", icon: "textures/fr_ui/poses/freddy/freddy_statue_pose_stage" },
  { name: "stare.anim", icon: "textures/fr_ui/poses/freddy/freddy_statue_pose_stare" },
  { name: "poster.anim", icon: "textures/fr_ui/poses/freddy/freddy_statue_pose_lets_party_poster" },
  { name: "ending.anim", icon: "textures/fr_ui/poses/freddy/freddy_statue_pose_ending_pose" },
  { name: "celebrate.anim", icon: "textures/fr_ui/poses/freddy/freddy_statue_pose_celebrate" },
  { name: "arms_down.anim", icon: "textures/fr_ui/poses/freddy/freddy_statue_pose_stand_arms_down" },
  { name: "ar_render.anim", icon: "textures/fr_ui/poses/freddy/freddy_statue_pose_ar_render" },
  { name: "teaser.anim", icon: "textures/fr_ui/poses/freddy/freddy_statue_pose_teaser" },
  { name: "gift.anim", icon: "textures/fr_ui/poses/freddy/freddy_statue_pose_gift" },
  { name: "dismantled.anim", icon: "textures/fr_ui/poses/freddy/freddy_statue_pose_dismantled" },
  { name: "sit.anim", icon: "textures/fr_ui/poses/freddy/freddy_statue_pose_sit" },
  { name: "jumpscare.anim", icon: "textures/fr_ui/poses/freddy/freddy_statue_pose_jumpscare" },
  { name: "walk.anim", icon: "textures/fr_ui/poses/freddy/freddy_statue_pose_walk" },
  { name: "walk_mic.anim", icon: "textures/fr_ui/poses/freddy/freddy_statue_pose_walk_mic" },
  { name: "walk_blood.anim", icon: "textures/fr_ui/poses/freddy/freddy_statue_pose_walk_blood" },
  { name: "idle.anim", icon: "textures/fr_ui/poses/freddy/freddy_statue_pose_idle_no_mic" },
  { name: "idle_mic.anim", icon: "textures/fr_ui/poses/freddy/freddy_statue_pose_idle_mic" },
  { name: "idle_blood.anim", icon: "textures/fr_ui/poses/freddy/freddy_statue_pose_idle_no_mic_blood" },
  { name: "lean.anim", icon: "textures/fr_ui/poses/freddy/freddy_statue_pose_lean" },
  { name: "look_up.anim", icon: "textures/fr_ui/poses/freddy/freddy_statue_pose_look_up" },
  { name: "angry.anim", icon: "textures/fr_ui/poses/freddy/freddy_statue_pose_angry" },
  { name: "mugshot.anim", icon: "textures/fr_ui/poses/freddy/freddy_statue_pose_mugshot" },
  { name: "hold_mask.anim", icon: "textures/fr_ui/poses/freddy/freddy_statue_pose_hold_mask" },
  { name: "hold_mask_reach.anim", icon: "textures/fr_ui/poses/freddy/freddy_statue_pose_hold_mask_reach" },
  { name: "space.anim", icon: "textures/fr_ui/poses/freddy/freddy_statue_pose_space" },
  { name: "stuffed.anim", icon: "textures/fr_ui/poses/freddy/freddy_statue_pose_stuffed" },
  { name: "sit_floor.anim", icon: "textures/fr_ui/poses/freddy/freddy_statue_pose_sit_floor" },
  { name: "sit_hatch.anim", icon: "textures/fr_ui/poses/freddy/freddy_statue_pose_sit_hatch" },
  { name: "lay.anim", icon: "textures/fr_ui/poses/freddy/freddy_statue_pose_lay" },
  { name: "showtime.anim", icon: "textures/fr_ui/poses/freddy/freddy_statue_pose_showtime" }
];


const VARIANTS_BONNIE = [
  { name: "classic", icon: "textures/fr_ui/variants/bonnie/bonnie_regular", type: "normal" },
  { name: "chocolate", icon: "textures/fr_ui/variants/bonnie/bonnie_chocolate", type: "seasonal" },
  { name: "elf", icon: "textures/fr_ui/variants/bonnie/bonnie_elf", type: "seasonal" },
  { name: "hw_guitar", icon: "textures/fr_ui/variants/bonnie/bonnie_hw_guitar", type: "normal" },
  { name: "black_eyes", icon: "textures/fr_ui/variants/bonnie/bonnie_black_eyes", type: "normal" }
];

const VARIANTS_CHICA = [
  { name: "base", icon: "textures/fr_ui/variants/chica/chica_base", type: "normal" },
  { name: "pizza", icon: "textures/fr_ui/variants/chica/chica_pizza", type: "normal" },
  { name: "snow", icon: "textures/fr_ui/variants/chica/chica_snow", type: "seasonal" },
  { name: "cursed", icon: "textures/fr_ui/variants/chica/chica_cursed", type: "special" },
  { name: "sotm", icon: "textures/fr_ui/variants/chica/chica_sotm", type: "special" },
  { name: "withered", icon: "textures/fr_ui/variants/chica/chica_withered", type: "special" }
];

const VARIANTS_FOXY = [
  { name: "base", icon: "textures/fr_ui/variants/foxy/foxy_base", type: "normal" },
  { name: "fixed", icon: "textures/fr_ui/variants/foxy/foxy_fixed", type: "normal" },
  { name: "glow", icon: "textures/fr_ui/variants/foxy/foxy_glow_eyes", type: "special" },
  { name: "fixed_glow", icon: "textures/fr_ui/variants/foxy/foxy_fixed_glow_eyes", type: "special" },
  { name: "gingerbread", icon: "textures/fr_ui/variants/foxy/foxy_gingerbread", type: "seasonal" },
  { name: "radioactive", icon: "textures/fr_ui/variants/foxy/foxy_radioactive", type: "special" },
  { name: "suit_damaged", icon: "textures/fr_ui/variants/foxy/foxy_captain_torn", type: "normal" },
  { name: "suit_fixed", icon: "textures/fr_ui/variants/foxy/foxy_captain_fixed", type: "normal" },
  { name: "suit_damaged", icon: "textures/fr_ui/variants/foxy/foxy_fixed_captain_torn", type: "normal" },
  { name: "suit_fixed", icon: "textures/fr_ui/variants/foxy/foxy_fixed_captain_fixed", type: "normal" },
];

const VARIANTS_SPARKY = [
  { name: "base", icon: "textures/fr_ui/variants/sparky/sparky_base", type: "normal" },
  { name: "fixed", icon: "textures/fr_ui/variants/sparky/sparky_fixed", type: "normal" },
  { name: "accurate", icon: "textures/fr_ui/variants/sparky/sparky_accurate", type: "special" },
  { name: "withered", icon: "textures/fr_ui/variants/sparky/sparky_accurate_withered", type: "special" },
  { name: "hot_chocolate", icon: "textures/fr_ui/variants/sparky/sparky_hot_chocolate", type: "seasonal" }
];

const VARIANTS_FREDDY = [
  { name: "base", icon: "textures/fr_ui/variants/freddy/freddy_basic", type: "normal" },
  { name: "black_eyes", icon: "textures/fr_ui/variants/freddy/freddy_black_eyes", type: "normal" },
  { name: "hardmode", icon: "textures/fr_ui/variants/freddy/freddy_hardmode", type: "special" },
  { name: "frost", icon: "textures/fr_ui/variants/freddy/freddy_frost", type: "seasonal" },
  { name: "santa", icon: "textures/fr_ui/variants/freddy/freddy_santa", type: "seasonal" },
  { name: "blacklight", icon: "textures/fr_ui/variants/freddy/freddy_blacklight", type: "special" },
  { name: "bear5", icon: "textures/fr_ui/variants/freddy/freddy_bear5", type: "special" },
  { name: "venom", icon: "textures/fr_ui/variants/freddy/freddy_venom", type: "special" }
];
const POSES_PER_PAGE = 6;

const VARIANTS_PER_PAGE = 3;

const entityStates = new Map();

const playerPosePage = new Map();
const playerVariantPage = new Map();

const nightModeAnimatronics = new Map();

const nightModeStatues = new Map();

const playerLinkingMode = new Map();

const playerPoseCategory = new Map();
const playerVariantCategory = new Map();
const playerEditingEntity = new Map();

const POSE_CATEGORIES = ["base", "motion", "blood"];
const VARIANT_CATEGORIES = ["normal", "special", "seasonal", "community"];

const walkingEntities = new Map();

const ARRIVAL_DISTANCE = 1.0;

const NIGHT_START = 13000;
const NIGHT_END = 23000;

function isNightTime(dimension) {
  try {
    const time = world.getTimeOfDay();

    return time >= NIGHT_START && time < NIGHT_END;
  } catch {
    return false;
  }
}

function getDistance(pos1, pos2) {
  const dx = pos2.x - pos1.x;
  const dy = pos2.y - pos1.y;
  const dz = pos2.z - pos1.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

function getHorizontalDistance(pos1, pos2) {
  const dx = pos2.x - pos1.x;
  const dz = pos2.z - pos1.z;
  return Math.sqrt(dx * dx + dz * dz);
}

function normalizeRotation(rotation) {

  let normalized = rotation % 360;
  if (normalized > 180) normalized -= 360;
  if (normalized < -180) normalized += 360;

  const rounded = Math.round(normalized / 90) * 90;

  if (rounded === 180) return -180;

  return rounded;
}

const MOVE_SPEED = 0.10;

const PATH_DRAW_INTERVAL = 2;

const MAX_PATH_SEARCH = 12000;

export function walkEntityTo(entity, targetLocation, onArrival, onNoPath = null, options = {}) {
  try {
    const dimension = entity.dimension;

    if (walkingEntities.has(entity.id)) {
      walkingEntities.delete(entity.id);
    }

    try { entity.removeTag("returning_home"); } catch { }
    try { entity.removeTag("fr_no_attack"); } catch { }

    entity.addTag("returning_home");
    entity.addTag("fr_no_attack");
    entity.triggerEvent("bonnie_return_home");

    const startPos = {
      x: Math.floor(entity.location.x),
      y: Math.round(entity.location.y),
      z: Math.floor(entity.location.z)
    };
    const endPos = {
      x: Math.floor(targetLocation.x),
      y: Math.floor(targetLocation.y),
      z: Math.floor(targetLocation.z)
    };

    const path = findPathBFS(dimension, startPos, endPos);

    if (path.length > 0) {
      const firstPoint = path[0];
      const distToFirst = Math.sqrt(
        Math.pow(entity.location.x - (firstPoint.x + 0.5), 2) +
        Math.pow(entity.location.z - (firstPoint.z + 0.5), 2)
      );

      if (distToFirst < 0.8 && path.length > 1) {

        path.shift();
      }
    }

    if (path.length === 0) {
      console.warn(`[Pathfinding] No valid path found to target!`);
      entity.removeTag("returning_home");
      entity.removeTag("fr_no_attack");

      if (onNoPath) {
        onNoPath(entity, targetLocation);
      } else {
        entity.teleport(targetLocation);
        if (onArrival) onArrival(entity);
      }
      return;
    }

    const isPartialPath = path.isPartial === true;

    walkingEntities.set(entity.id, {
      targetLocation,
      onArrival,
      onNoPath,
      isPartialPath,
      entityType: entity.typeId,
      path: path,
      pathIndex: 0,
      tickCounter: 0,
      phase: options.skipDrawing === true ? "walking" : "drawing",
      drawIndex: 0,
      dimension: dimension,

      currentX: entity.location.x,
      currentY: entity.location.y,
      currentZ: entity.location.z
    });

  } catch (e) {
    console.warn("[Pathfinding] Failed to start:", e);
    if (onArrival) onArrival(entity);
  }
}

function findPathBFS(dimension, start, end) {

  if (start.x === end.x && start.z === end.z) {
    return [end];
  }

  let validStartY = start.y;
  let foundValidStart = false;

  for (const yOffset of [0, -1, 1]) {
    const testY = start.y + yOffset;
    if (isPositionWalkable(dimension, start.x, testY, start.z)) {
      validStartY = testY;
      foundValidStart = true;
      break;
    }
  }

  const actualStart = { x: start.x, y: validStartY, z: start.z };

  if (!foundValidStart) {
  }

  const openSet = [];
  const cameFrom = new Map();
  const gScore = new Map();

  const startKey = `${actualStart.x},${actualStart.y},${actualStart.z}`;
  gScore.set(startKey, 0);

  const heuristic = (pos) => Math.abs(pos.x - end.x) + Math.abs(pos.z - end.z);

  openSet.push({
    pos: actualStart,
    f: heuristic(actualStart)
  });

  const visited = new Set();

  const directions = [
    { dx: 1, dz: 0, cost: 1 },
    { dx: -1, dz: 0, cost: 1 },
    { dx: 0, dz: 1, cost: 1 },
    { dx: 0, dz: -1, cost: 1 },
    { dx: 1, dz: 1, cost: 1.4 },
    { dx: 1, dz: -1, cost: 1.4 },
    { dx: -1, dz: 1, cost: 1.4 },
    { dx: -1, dz: -1, cost: 1.4 }
  ];

  let iterations = 0;

  let closestPos = actualStart;
  let closestDist = Math.abs(actualStart.x - end.x) + Math.abs(actualStart.z - end.z);
  let closestKey = startKey;

  while (openSet.length > 0 && iterations < MAX_PATH_SEARCH) {
    iterations++;

    openSet.sort((a, b) => a.f - b.f);
    const current = openSet.shift();
    const pos = current.pos;
    const posKey = `${pos.x},${pos.y},${pos.z}`;

    if (visited.has(posKey)) continue;
    visited.add(posKey);

    const distToEnd = Math.abs(pos.x - end.x) + Math.abs(pos.z - end.z);

    if (distToEnd < closestDist) {
      closestDist = distToEnd;
      closestPos = pos;
      closestKey = posKey;
    }

    if (distToEnd <= 1) {

      const path = [end, pos];
      let currentKey = posKey;
      while (cameFrom.has(currentKey)) {
        const parent = cameFrom.get(currentKey);
        path.push(parent);
        currentKey = `${parent.x},${parent.y},${parent.z}`;
      }
      path.reverse();
      return path;
    }

    const currentG = gScore.get(posKey) || 0;

    for (const dir of directions) {
      const newX = pos.x + dir.dx;
      const newZ = pos.z + dir.dz;

      for (const dy of [0, 1, -1]) {
        const newY = pos.y + dy;
        const key = `${newX},${newY},${newZ}`;

        if (visited.has(key)) continue;

        if (isPositionWalkable(dimension, newX, newY, newZ)) {

          if (dir.dx !== 0 && dir.dz !== 0) {
            if (!isPositionWalkable(dimension, pos.x + dir.dx, pos.y, pos.z) ||
              !isPositionWalkable(dimension, pos.x, pos.y, pos.z + dir.dz)) {
              continue;
            }
          }

          const blockAtFeet = dimension.getBlock({ x: newX, y: pos.y, z: newZ });
          const blockAtHead = dimension.getBlock({ x: newX, y: pos.y + 1, z: newZ });

          if (blockAtFeet && blockAtHead) {
            const feetType = blockAtFeet.typeId;
            const headType = blockAtHead.typeId;

            const isBlockPassable = (t) => {
              if (t === "minecraft:air" || t === "minecraft:cave_air" || t === "minecraft:water") return true;
              if (t.includes("short_grass") || t.includes("tall_grass") || t.includes("fern")) return true;

              if (t.startsWith("fr:") && t.includes("door")) return true;

              if (t.includes("door") || t.includes("gate")) return true;
              return false;
            };

            const isFeetSolid = !isBlockPassable(feetType);
            const isHeadSolid = !isBlockPassable(headType);

            if (isFeetSolid && isHeadSolid) {
              continue;
            }
          }

          const tentativeG = currentG + dir.cost + (dy !== 0 ? 0.5 : 0);
          const existingG = gScore.get(key);

          if (existingG === undefined || tentativeG < existingG) {
            cameFrom.set(key, pos);
            gScore.set(key, tentativeG);
            const newPos = { x: newX, y: newY, z: newZ };
            const f = tentativeG + heuristic(newPos);
            openSet.push({ pos: newPos, f: f });
          }
        }
      }
    }
  }

  const startDist = Math.abs(actualStart.x - end.x) + Math.abs(actualStart.z - end.z);
  if (closestDist < startDist - 2 && closestKey !== startKey) {
    const partialPath = [closestPos];
    let currentKey = closestKey;
    while (cameFrom.has(currentKey)) {
      const parent = cameFrom.get(currentKey);
      partialPath.push(parent);
      currentKey = `${parent.x},${parent.y},${parent.z}`;
    }
    partialPath.reverse();

    partialPath.isPartial = true;
    return partialPath;
  }
  console.warn(`[Pathfinding] A* search exhausted after ${iterations} iterations, no valid path`);
  return [];
}

function processWalkingEntities() {
  if (walkingEntities.size === 0) return;

  const toRemove = [];
  const overworld = world.getDimension("overworld");

  for (const [entityId, walkData] of walkingEntities) {
    try {

      let entity = null;
      for (const e of overworld.getEntities({ type: walkData.entityType })) {
        if (e.id === entityId) {
          entity = e;
          break;
        }
      }

      if (!entity) {
        toRemove.push(entityId);
        continue;
      }

      walkData.tickCounter = (walkData.tickCounter || 0) + 1;

      if (walkData.phase === "drawing") {

        if (walkData.tickCounter < PATH_DRAW_INTERVAL) {
          continue;
        }
        walkData.tickCounter = 0;

        const drawIndex = walkData.drawIndex || 0;

        if (drawIndex < walkData.path.length) {
          const point = walkData.path[drawIndex];
          const dim = walkData.dimension || overworld;

          try {

            dim.spawnParticle("minecraft:endrod", {
              x: point.x + 0.5,
              y: point.y + 0.5,
              z: point.z + 0.5
            });
            dim.spawnParticle("minecraft:endrod", {
              x: point.x + 0.5,
              y: point.y + 1.0,
              z: point.z + 0.5
            });
            dim.spawnParticle("minecraft:endrod", {
              x: point.x + 0.5,
              y: point.y + 1.5,
              z: point.z + 0.5
            });
          } catch { }

          walkData.drawIndex = drawIndex + 1;
        } else {
          walkData.phase = "walking";
          walkData.pathIndex = 0;
          walkData.tickCounter = 0;
        }
        continue;
      }

      if (!walkData.path || walkData.pathIndex >= walkData.path.length) {

        toRemove.push(entityId);
        try { entity.removeTag("returning_home"); } catch { }
        try { entity.removeTag("fr_no_attack"); } catch { }

        if (walkData.isPartialPath) {
          entity.triggerEvent("bonnie_stop_returning");

          if (walkData.onNoPath) {
            walkData.onNoPath(entity, walkData.targetLocation);
          }
        } else {

          entity.teleport(walkData.targetLocation);
          entity.triggerEvent("bonnie_stop_returning");
          if (walkData.onArrival) walkData.onArrival(entity);
        }
        continue;
      }

      const nextPoint = walkData.path[walkData.pathIndex];
      const targetX = nextPoint.x + 0.5;
      const targetY = nextPoint.y;
      const targetZ = nextPoint.z + 0.5;

      let curX = walkData.currentX;
      let curY = walkData.currentY;
      let curZ = walkData.currentZ;

      const dx = targetX - curX;
      const dy = targetY - curY;
      const dz = targetZ - curZ;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

      if (dist < MOVE_SPEED * 1.5) {
        walkData.pathIndex++;
        walkData.currentX = targetX;
        walkData.currentY = targetY;
        walkData.currentZ = targetZ;
        curX = targetX;
        curY = targetY;
        curZ = targetZ;
      } else {

        const moveX = (dx / dist) * MOVE_SPEED;
        const moveY = (dy / dist) * MOVE_SPEED;
        const moveZ = (dz / dist) * MOVE_SPEED;

        curX += moveX;
        curY += moveY;
        curZ += moveZ;

        walkData.currentX = curX;
        walkData.currentY = curY;
        walkData.currentZ = curZ;
      }

      const rotationY = Math.atan2(-dx, dz) * (180 / Math.PI);

      entity.teleport(
        { x: curX, y: curY, z: curZ },
        { rotation: { x: 0, y: rotationY } }
      );

    } catch (e) {
      console.warn(`[Pathfinding] Error:`, e);
      toRemove.push(entityId);
    }
  }

  for (const id of toRemove) {
    walkingEntities.delete(id);
  }
}

function isPositionWalkable(dimension, x, y, z) {
  try {

    const blockBelow = dimension.getBlock({ x, y: y - 1, z });

    const blockFeet = dimension.getBlock({ x, y, z });

    const blockHead = dimension.getBlock({ x, y: y + 1, z });

    if (!blockBelow || !blockFeet || !blockHead) return false;

    const belowType = blockBelow.typeId;
    const feetType = blockFeet.typeId;
    const headType = blockHead.typeId;

    const solidGround = belowType !== "minecraft:air" &&
      belowType !== "minecraft:water" &&
      belowType !== "minecraft:cave_air" &&
      belowType !== "minecraft:lava";

    if (!solidGround) return false;

    const isPassable = (type) => {
      if (type === "minecraft:air" || type === "minecraft:cave_air") return true;

      if (type.includes("grass_block") || type.includes("dirt")) return false;

      if (type.startsWith("fr:") && type.includes("door")) return true;

      if (type.includes("door") || type.includes("gate") || type.includes("sign") ||
        type.includes("torch") || type.includes("flower") || type.includes("short_grass") ||
        type.includes("tall_grass") || type.includes("fern") ||
        type.includes("carpet") || type.includes("pressure") || type.includes("button") ||
        type.includes("lantern") || type.includes("candle") || type.includes("rail") ||
        type.includes("redstone") || type.includes("vine") || type.includes("moss_carpet")) {
        return true;
      }

      if (type.includes("slab") || type.includes("stairs")) {
        return true;
      }
      return false;
    };

    return isPassable(feetType) && isPassable(headType);
  } catch {
    return false;
  }
}

function findGroundY(dimension, x, currentY, z) {
  try {

    for (let y = Math.floor(currentY); y >= currentY - 3; y--) {
      const blockBelow = dimension.getBlock({ x: Math.floor(x), y: y - 1, z: Math.floor(z) });
      const blockAt = dimension.getBlock({ x: Math.floor(x), y: y, z: Math.floor(z) });

      if (blockBelow && blockAt) {
        const belowType = blockBelow.typeId;
        const atType = blockAt.typeId;

        if (belowType !== "minecraft:air" &&
          belowType !== "minecraft:water" &&
          (atType === "minecraft:air" || atType.includes("door") || atType.includes("gate"))) {
          return y;
        }
      }
    }

    for (let y = Math.floor(currentY) + 1; y <= currentY + 2; y++) {
      const blockBelow = dimension.getBlock({ x: Math.floor(x), y: y - 1, z: Math.floor(z) });
      const blockAt = dimension.getBlock({ x: Math.floor(x), y: y, z: Math.floor(z) });

      if (blockBelow && blockAt) {
        const belowType = blockBelow.typeId;
        const atType = blockAt.typeId;

        if (belowType !== "minecraft:air" &&
          belowType !== "minecraft:water" &&
          (atType === "minecraft:air" || atType.includes("door") || atType.includes("gate"))) {
          return y;
        }
      }
    }
  } catch (e) {

  }

  return currentY;
}

function transformToAnimatronic(statue) {
  try {
    const statueId = statue.id;
    const state = entityStates.get(statueId) || { rotation: 0, poseIndex: 0, variantIndex: 0 };
    const dimension = statue.dimension;

    const entityRot = statue.getRotation();
    const savedRotation = state.rotation !== undefined ? state.rotation : normalizeRotation(entityRot.y);

    let platformLocation = null;
    try {
      const platformData = statue.getDynamicProperty("fr:platform_location");
      if (platformData) {
        platformLocation = JSON.parse(platformData);
      }
    } catch { }

    if (!platformLocation && state.platformLocation) {
      platformLocation = state.platformLocation;
    }

    const spawnLocation = platformLocation || statue.location;

    const waypointStatueId = statue.getDynamicProperty("fr:statue_id") || 0;

    const statueData = {
      platformLocation: platformLocation,
      rotation: savedRotation,
      poseIndex: state.poseIndex || 0,
      variantIndex: state.variantIndex || 0,
      dimensionId: dimension.id,
      waypointStatueId: waypointStatueId
    };

    const animatronic = dimension.spawnEntity("fr:fnaf1_bonnie_entity", spawnLocation);

    if (waypointStatueId > 0) {
      animatronic.setDynamicProperty("fr:statue_id", waypointStatueId);
    }

    const variantIndex = statueData.variantIndex;

    animatronic.setDynamicProperty("fr:variant_index", variantIndex);

    if (variantIndex > 0) {
      system.run(() => {
        try {
          animatronic.triggerEvent(`fr:set_variant_${variantIndex}`);
        } catch (e) {
          console.warn(`[NightMode] Failed to apply variant to animatronic: ${e}`);
        }
      });
    }

    nightModeAnimatronics.set(animatronic.id, statueData);

    nightModeStatues.delete(statueId);
    entityStates.delete(statueId);

    statue.remove();

    if (waypointStatueId > 0) {
      const animatronicRef = animatronic;
      system.run(() => {
        system.run(() => {
          try {


          } catch (e) {
            console.warn(`[NightMode] Failed to start pathing: ${e}`);
          }
        });
      });
    }

    const locStr = `${Math.floor(spawnLocation.x)}, ${Math.floor(spawnLocation.y)}, ${Math.floor(spawnLocation.z)}`;
  } catch (e) {
    console.warn("[NightMode] Error transforming to animatronic:", e);
  }
}

function transformToStatue(animatronic) {
  try {
    const animatronicId = animatronic.id;
    let statueData = nightModeAnimatronics.get(animatronicId);

    if (!statueData) {
      const waypointId = animatronic.getDynamicProperty("fr:statue_id");
      if (waypointId) {
        for (const [oldId, data] of nightModeAnimatronics) {
          if (data.waypointStatueId === waypointId) {
            statueData = data;
            nightModeAnimatronics.delete(oldId);
            nightModeAnimatronics.set(animatronicId, statueData);
            break;
          }
        }
      }
    }

    if (!statueData) {
      console.warn(`[NightMode] No statue data found for animatronic ${animatronicId}`);
      return;
    }



    const dimension = animatronic.dimension;

    const savedRotation = statueData.rotation !== undefined ? statueData.rotation : normalizeRotation(animatronic.getRotation().y);

    const returnLocation = statueData.platformLocation || animatronic.location;

    const statue = dimension.spawnEntity("fr:bonnie_statue", returnLocation);

    if (statueData.waypointStatueId > 0) {
      statue.setDynamicProperty("fr:statue_id", statueData.waypointStatueId);
    }

    if (statueData.platformLocation) {
      try {
        statue.setDynamicProperty("fr:platform_location", JSON.stringify(statueData.platformLocation));
      } catch (e) {
        console.warn(`[NightMode] Failed to restore platform location: ${e}`);
      }
    }

    const finalRotation = savedRotation;
    const finalPose = statueData.poseIndex;
    const finalVariant = statueData.variantIndex;

    system.run(() => {
      system.run(() => {
        try {

          let valid = false;
          if (statue) {
            if (typeof statue.isValid === 'function') valid = statue.isValid();
            else if (statue.isValid !== undefined) valid = statue.isValid;
            else valid = true;
          }

          if (!valid) { }

          try {
            statue.teleport(statue.location, { rotation: { x: 0, y: finalRotation } });
          } catch (e) { }

          if (finalPose > 0) {
            try {
              statue.triggerEvent(`fr:set_pose_${finalPose}`);
            } catch (e) { }
          }

          if (finalVariant > 0) {
            try {
              statue.triggerEvent(`fr:set_variant_${finalVariant}`);
            } catch (e) { }
          }

        } catch (e) { }
      });
    });

    const newState = {
      rotation: savedRotation,
      poseIndex: statueData.poseIndex,
      variantIndex: statueData.variantIndex,
      nightMode: true,
      platformLocation: statueData.platformLocation
    };
    entityStates.set(statue.id, newState);
    nightModeStatues.set(statue.id, {
      ...newState,
      location: returnLocation,
      dimensionId: dimension.id
    });

    nightModeAnimatronics.delete(animatronicId);

    animatronic.remove();

    const locStr = `${Math.floor(returnLocation.x)}, ${Math.floor(returnLocation.y)}, ${Math.floor(returnLocation.z)}`;
  } catch (e) {
    console.warn("[NightMode] Error transforming to statue:", e);
  }
}

function startWalkingToPlaftorm(animatronic) {
  const animatronicId = animatronic.id;
  let statueData = nightModeAnimatronics.get(animatronicId);

  if (!statueData) {
    const waypointId = animatronic.getDynamicProperty("fr:statue_id");
    if (waypointId) {
      for (const [oldId, data] of nightModeAnimatronics) {
        if (data.waypointStatueId === waypointId) {
          statueData = data;
          nightModeAnimatronics.delete(oldId);
          nightModeAnimatronics.set(animatronicId, statueData);
          break;
        }
      }
    }
  }

  let platformLocation = statueData?.platformLocation;
  if (!platformLocation) {
    try {
      const platformData = animatronic.getDynamicProperty("fr:platform_location");
      if (platformData) {
        platformLocation = JSON.parse(platformData);

        if (statueData) {
          statueData.platformLocation = platformLocation;
        }
      }
    } catch (e) {
      console.warn(`[NightMode] Error reading platform location: ${e}`);
    }
  }



  if (!platformLocation) {

    if (!statueData) {
      const waypointId = animatronic.getDynamicProperty("fr:statue_id") || 0;
      statueData = {
        platformLocation: null,
        rotation: normalizeRotation(animatronic.getRotation().y),
        poseIndex: 0,
        variantIndex: 0,
        dimensionId: animatronic.dimension.id,
        waypointStatueId: waypointId
      };
      nightModeAnimatronics.set(animatronicId, statueData);
    }
    transformToStatue(animatronic);
    return;
  }

  if (!statueData) {
    const waypointId = animatronic.getDynamicProperty("fr:statue_id") || 0;
    statueData = {
      platformLocation: platformLocation,
      rotation: normalizeRotation(animatronic.getRotation().y),
      poseIndex: 0,
      variantIndex: 0,
      dimensionId: animatronic.dimension.id,
      waypointStatueId: waypointId
    };
    nightModeAnimatronics.set(animatronicId, statueData);
  }

  const dist = getHorizontalDistance(animatronic.location, platformLocation);
  if (dist <= ARRIVAL_DISTANCE) {
    transformToStatue(animatronic);
    return;
  }

  walkEntityTo(animatronic, platformLocation, (entity) => {

    transformToStatue(entity);
  });
}

function nightModeTickHandler() {
  try {
    const overworld = world.getDimension("overworld");
    const isNight = isNightTime(overworld);
    const currentTime = world.getTimeOfDay();

    if (isNight) {

      const statuesToTransform = [...nightModeStatues.entries()];

      for (const [statueId, data] of statuesToTransform) {
        try {

          for (const entity of overworld.getEntities({ type: "fr:bonnie_statue" })) {
            if (entity.id === statueId) {
              transformToAnimatronic(entity);
              break;
            }
          }
        } catch { }
      }
    }

    else {

      const trackedWaypointIds = new Set();
      for (const [_, data] of nightModeAnimatronics) {
        if (data.waypointStatueId) {
          trackedWaypointIds.add(data.waypointStatueId);
        }
      }

      const allAnimatronics = overworld.getEntities({ type: "fr:fnaf1_bonnie_entity" });

      for (const animatronic of allAnimatronics) {
        try {

          if (animatronic.hasTag("fr:simulation_mode")) {
            continue;
          }

          const waypointId = animatronic.getDynamicProperty("fr:statue_id");

          if (walkingEntities.has(animatronic.id)) continue;

          let statueData = nightModeAnimatronics.get(animatronic.id);

          if (!statueData && waypointId) {
            for (const [oldId, data] of nightModeAnimatronics) {
              if (data.waypointStatueId === waypointId) {
                statueData = data;

                nightModeAnimatronics.delete(oldId);
                nightModeAnimatronics.set(animatronic.id, statueData);
                break;
              }
            }
          }

          if (!statueData) {
            const platformData = animatronic.getDynamicProperty("fr:platform_location");
            if (platformData) {
              try {
                const platformLocation = JSON.parse(platformData);

                statueData = {
                  platformLocation: platformLocation,
                  rotation: normalizeRotation(animatronic.getRotation().y),
                  poseIndex: 0,
                  variantIndex: 0,
                  dimensionId: animatronic.dimension.id,
                  waypointStatueId: waypointId || 0
                };
                nightModeAnimatronics.set(animatronic.id, statueData);
              } catch (e) {
                console.warn(`[NightMode] Failed to parse platform location: ${e}`);
              }
            }
          }

          if (statueData) {
            startWalkingToPlaftorm(animatronic);
          }
        } catch (e) {
          console.warn(`[NightMode] Error processing animatronic: ${e}`);
        }
      }
    }
  } catch (e) {
    console.warn("[NightMode] Tick handler error:", e);
  }
}





export function hasWaypointsForStatue(entity) {
  const statueId = entity.getDynamicProperty("fr:statue_id");
  if (!statueId) return false;
  const waypoints = getWaypointsForStatue(statueId);
  return waypoints && waypoints.length > 0;
}


export function getNightModeMenuOptions(entity) {
  const hasWaypoints = hasWaypointsForStatue(entity);

  return {
    testRoute: hasWaypoints,
    makeRoute: true,
    editWaypoints: hasWaypoints,
    clearRoute: hasWaypoints
  };
}


export async function showNightModeActivationMenu(player, entity) {
  const entityId = entity.id;
  const state = entityStates.get(entityId) || { rotation: 0, poseIndex: 0, variantIndex: 0, nightMode: false };
  const statueId = entity.getDynamicProperty("fr:statue_id") || getOrCreateStatueId(entity);

  const form = new MessageFormData()
    .title("§l§6NIGHT MODE")
    .body(`§7Do you want to activate Night Mode for this animatronic?\n\n§7When activated, the animatronic will:\n§a• Follow configured routes at night\n§a• Return to platform during day\n\n§7Current Status: ${state.nightMode ? "§aEnabled" : "§cDisabled"}`)
    .button1("§aActivate")
    .button2("§7Cancel");

  try {
    const response = await form.show(player);

    if (response.canceled) {
      system.run(() => showEntityEditor(player, entity, "statue"));
      return;
    }

    if (response.selection === 1) {

      system.run(() => showNightModeMenu(player, entity));
    } else {

      system.run(() => showEntityEditor(player, entity, "statue"));
    }
  } catch (e) {
    console.warn("[NightMode] Error showing activation menu:", e);
  }
}


export async function showNightModeMenu(player, entity) {
  const entityId = entity.id;
  const state = entityStates.get(entityId) || { rotation: 0, poseIndex: 0, variantIndex: 0, nightMode: false };
  const statueId = entity.getDynamicProperty("fr:statue_id") || getOrCreateStatueId(entity);
  const menuOptions = getNightModeMenuOptions(entity);
  const waypointCount = getWaypointsForStatue(statueId).length;

  let entityName = entity.nameTag || entity.typeId.replace("fr:", "").replace(/_/g, " ");
  entityName = entityName.charAt(0).toUpperCase() + entityName.slice(1);

  const form = new ActionFormData()
    .title("§l§6NIGHT MODE")
    .body(`§7Entity: §a${entityName}\n§7Statue ID: §e${statueId}\n§7Waypoints: §f${waypointCount}\n§7Status: ${state.nightMode ? "§aEnabled" : "§cDisabled"}`);

  const buttonActions = [];

  if (menuOptions.testRoute) {
    form.button("§eTest Route", "textures/fr_ui/night_mode_test");
    buttonActions.push("testRoute");
  }

  form.button("§aMake Route", "textures/fr_ui/night_mode_create");
  buttonActions.push("makeRoute");

  if (menuOptions.editWaypoints) {
    form.button("§bEdit Waypoints", "textures/fr_ui/night_mode_edit");
    buttonActions.push("editWaypoints");
  }

  if (menuOptions.clearRoute) {
    form.button("§cClear Route", "textures/fr_ui/night_mode_clear");
    buttonActions.push("clearRoute");
  }

  form.button(state.nightMode ? "§cDisable Night Mode" : "§aEnable Night Mode");
  buttonActions.push("toggleNightMode");

  form.button("§7Back");
  buttonActions.push("back");

  try {
    const response = await form.show(player);

    if (response.canceled) {
      system.run(() => showEntityEditor(player, entity, "statue"));
      return;
    }

    const action = buttonActions[response.selection];

    switch (action) {
      case "testRoute":

        if (waypointCount > 0) {
          const sessionId = startRouteTest(entity, player);
          if (!sessionId) {
            system.run(() => showNightModeMenu(player, entity));
          }

        } else {
          player.sendMessage("§c[Night Mode] §7No waypoints to test!");
          system.run(() => showNightModeMenu(player, entity));
        }
        break;

      case "makeRoute":

        const success = startBlockSelectorMode(player, statueId, entityName);
        if (success) {
          player.sendMessage("§a[Night Mode] §7Route creation mode activated!");
          player.sendMessage("§7Look at blocks and use the repairman item to place waypoints.");
        } else {
          system.run(() => showNightModeMenu(player, entity));
        }
        break;

      case "editWaypoints":

        system.run(() => showWaypointListMenu(player, entity));
        break;

      case "clearRoute":

        system.run(() => showClearRouteConfirmation(player, entity));
        break;

      case "toggleNightMode":

        if (state.nightMode) {
          disableNightMode(entity);
          player.sendMessage("§c[Night Mode] §7Disabled - Animatronic will stay as statue");
        } else {
          enableNightMode(entity);
          player.sendMessage("§a[Night Mode] §7Enabled - Animatronic will activate at night");
        }
        system.run(() => showNightModeMenu(player, entity));
        break;

      case "back":
        system.run(() => showEntityEditor(player, entity, "statue"));
        break;
    }
  } catch (e) {
    console.warn("[NightMode] Error showing night mode menu:", e);
  }
}


async function showWaypointListMenu(player, entity) {
  const statueId = entity.getDynamicProperty("fr:statue_id");
  if (!statueId) {
    player.sendMessage("§c[Night Mode] §7No statue ID configured!");
    system.run(() => showNightModeMenu(player, entity));
    return;
  }

  const waypoints = getWaypointsForStatue(statueId);

  if (waypoints.length === 0) {
    player.sendMessage("§c[Night Mode] §7No waypoints to edit!");
    system.run(() => showNightModeMenu(player, entity));
    return;
  }

  const form = new ActionFormData()
    .title("§l§bEDIT WAYPOINTS")
    .body(`§7Select a waypoint to edit:\n§7Total: §f${waypoints.length} waypoints`);

  for (const wp of waypoints) {
    const posStr = `(${Math.floor(wp.location.x)}, ${Math.floor(wp.location.y)}, ${Math.floor(wp.location.z)})`;
    form.button(`§eWP #${wp.order} §7${posStr}`);
  }

  form.button("§7Back");

  try {
    const response = await form.show(player);

    if (response.canceled) {
      system.run(() => showNightModeMenu(player, entity));
      return;
    }

    if (response.selection === waypoints.length) {

      system.run(() => showNightModeMenu(player, entity));
    } else {

      const selectedWp = waypoints[response.selection];
      system.run(() => showWaypointConfigurationForm(player, entity, selectedWp));
    }
  } catch (e) {
    console.warn("[NightMode] Error showing waypoint list:", e);
  }
}


async function showWaypointConfigurationForm(player, entity, waypoint) {
  const statueId = entity.getDynamicProperty("fr:statue_id");
  const poses = getEntityPoses(entity);

  const poseOptions = poses.map((pose, index) => {
    const name = pose.name.replace(".anim", "");
    return `${index}: ${name}`;
  });

  const abilityOptions = [
    "None",
    "Camera Blackout",
    "Camera Switch"
  ];

  const currentAbilities = waypoint.abilities || [];
  let currentAbilityIndex = 0;
  if (currentAbilities.some(a => a.type === ABILITY_TYPES.CAMERA_BLACKOUT)) {
    currentAbilityIndex = 1;
  } else if (currentAbilities.some(a => a.type === "camera_switch")) {
    currentAbilityIndex = 2;
  }



  const currentDurationSeconds = Math.floor((waypoint.waitTime || DEFAULT_WAIT_TIME) / 20);

  const minDurationSeconds = Math.floor(MIN_WAIT_TIME / 20);
  const maxDurationSeconds = Math.floor(MAX_WAIT_TIME / 20);
  const clampedDuration = Math.max(minDurationSeconds, Math.min(maxDurationSeconds, currentDurationSeconds));

  const posStr = `(${Math.floor(waypoint.location.x)}, ${Math.floor(waypoint.location.y)}, ${Math.floor(waypoint.location.z)})`;

  const form = new ModalFormData()
    .title(`§l§eWaypoint #${waypoint.order}`)
    .dropdown("§7Pose", poseOptions, waypoint.pose || 0)
    .dropdown("§7Ability", abilityOptions, currentAbilityIndex)
    .slider("§7Duration (seconds)", minDurationSeconds, maxDurationSeconds, 10, clampedDuration)
    .slider("§7Rotation (degrees)", 0, 360, 15, waypoint.rotation || 0)
    .toggle("§cDelete Waypoint", false);

  try {
    const response = await form.show(player);

    if (response.canceled) {
      system.run(() => showWaypointListMenu(player, entity));
      return;
    }

    const [poseIndex, abilityIndex, durationSeconds, rotation, shouldDelete] = response.formValues;

    if (shouldDelete) {
      system.run(() => showDeleteWaypointConfirmation(player, entity, waypoint));
      return;
    }

    const durationTicks = validateDuration(durationSeconds * 20);

    const newAbilities = [];
    if (abilityIndex === 1) {

      newAbilities.push({
        type: ABILITY_TYPES.CAMERA_BLACKOUT,
        duration: 5
      });
    } else if (abilityIndex === 2) {

      newAbilities.push({
        type: "camera_switch",
        targetCameraId: null
      });
    }

    const updatedConfig = {
      order: waypoint.order,
      pose: poseIndex,
      rotation: rotation,
      waitTime: durationTicks,
      linkedStatueId: statueId,
      abilities: newAbilities
    };

    setWaypointData(waypoint.location, waypoint.dimensionId, updatedConfig);
    refreshWaypointCache(statueId);

    const poseName = poses[poseIndex]?.name.replace(".anim", "") || `pose_${poseIndex}`;
    const abilityName = abilityOptions[abilityIndex];
    player.sendMessage(`§a[Night Mode] §7Waypoint #${waypoint.order} updated:`);
    player.sendMessage(`§7  Pose: §f${poseName}`);
    player.sendMessage(`§7  Ability: §f${abilityName}`);
    player.sendMessage(`§7  Duration: §f${durationSeconds}s`);

    system.run(() => showWaypointListMenu(player, entity));
  } catch (e) {
    console.warn("[NightMode] Error showing waypoint config form:", e);
    system.run(() => showWaypointListMenu(player, entity));
  }
}


function validateDuration(durationTicks) {
  if (durationTicks < MIN_WAIT_TIME) return MIN_WAIT_TIME;
  if (durationTicks > MAX_WAIT_TIME) return MAX_WAIT_TIME;
  return durationTicks;
}


async function showDeleteWaypointConfirmation(player, entity, waypoint) {
  const statueId = entity.getDynamicProperty("fr:statue_id");
  const posStr = `(${Math.floor(waypoint.location.x)}, ${Math.floor(waypoint.location.y)}, ${Math.floor(waypoint.location.z)})`;

  const form = new MessageFormData()
    .title("§l§cDELETE WAYPOINT")
    .body(`§7Are you sure you want to delete waypoint #${waypoint.order}?\n\n§7Position: §f${posStr}\n\n§cThis action cannot be undone!`)
    .button1("§cYes, Delete")
    .button2("§7Cancel");

  try {
    const response = await form.show(player);

    if (response.canceled || response.selection === 0) {

      system.run(() => showWaypointConfigurationForm(player, entity, waypoint));
      return;
    }

    removeWaypointData(waypoint.location, waypoint.dimensionId);

    reindexWaypoints(statueId);

    player.sendMessage(`§c[Night Mode] §7Deleted waypoint #${waypoint.order}`);
    system.run(() => showWaypointListMenu(player, entity));
  } catch (e) {
    console.warn("[NightMode] Error showing delete confirmation:", e);
    system.run(() => showWaypointListMenu(player, entity));
  }
}


function reindexWaypoints(statueId) {
  const waypoints = getWaypointsForStatue(statueId);

  waypoints.sort((a, b) => a.order - b.order);

  for (let i = 0; i < waypoints.length; i++) {
    const wp = waypoints[i];
    if (wp.order !== i) {

      const config = getWaypointData(wp.location, wp.dimensionId);
      config.order = i;
      setWaypointData(wp.location, wp.dimensionId, config);
    }
  }

  refreshWaypointCache(statueId);
}


async function showClearRouteConfirmation(player, entity) {
  const statueId = entity.getDynamicProperty("fr:statue_id");
  const waypointCount = getWaypointsForStatue(statueId).length;

  const form = new MessageFormData()
    .title("§l§cCLEAR ROUTE")
    .body(`§7Are you sure you want to clear all §c${waypointCount}§7 waypoints?\n\n§cThis action cannot be undone!`)
    .button1("§cYes, Clear All")
    .button2("§7Cancel");

  try {
    const response = await form.show(player);

    if (response.canceled || response.selection === 0) {

      system.run(() => showNightModeMenu(player, entity));
      return;
    }

    clearAllWaypointsForStatue(statueId);
    player.sendMessage(`§c[Night Mode] §7Cleared ${waypointCount} waypoints`);
    system.run(() => showNightModeMenu(player, entity));
  } catch (e) {
    console.warn("[NightMode] Error showing clear confirmation:", e);
  }
}




function enableNightMode(statue) {
  const statueId = statue.id;
  const state = entityStates.get(statueId) || { rotation: 0, poseIndex: 0, variantIndex: 0 };

  const entityRotation = statue.getRotation();
  const rawRotation = entityRotation ? entityRotation.y : (state.rotation || 0);
  const normalizedRot = normalizeRotation(rawRotation);

  state.nightMode = true;
  state.rotation = normalizedRot;
  entityStates.set(statueId, state);

  nightModeStatues.set(statueId, {
    location: { x: statue.location.x, y: statue.location.y, z: statue.location.z },
    rotation: normalizedRot,
    poseIndex: state.poseIndex || 0,
    variantIndex: state.variantIndex || 0,
    dimensionId: statue.dimension.id,
    nightMode: true,
    platformLocation: state.platformLocation || null
  });
}

function disableNightMode(statue) {
  const statueId = statue.id;
  const state = entityStates.get(statueId);
  if (state) {
    state.nightMode = false;
    entityStates.set(statueId, state);
  }

  nightModeStatues.delete(statueId);
}

function startLinkingMode(player, entity) {
  playerLinkingMode.set(player.id, {
    entityId: entity.id,
    entityType: entity.typeId,
    entityLocation: { x: entity.location.x, y: entity.location.y, z: entity.location.z }
  });
  player.sendMessage("§e[Link Mode] §7Click on a §efr:platform§7 block to link this animatronic");
  player.sendMessage("§7The animatronic will wake up from there at night and return during the day");
}

function cancelLinkingMode(player) {
  if (playerLinkingMode.has(player.id)) {
    playerLinkingMode.delete(player.id);
    player.sendMessage("§c[Link Mode] §7Cancelled");
  }
}

function completeLinking(player, block) {
  const linkData = playerLinkingMode.get(player.id);
  if (!linkData) return false;

  const dimension = player.dimension;

  let targetEntity = null;
  for (const entity of dimension.getEntities({ type: linkData.entityType })) {
    if (entity.id === linkData.entityId) {
      targetEntity = entity;
      break;
    }
  }

  if (!targetEntity) {
    player.sendMessage("§c[Link Mode] §7Entity not found - it may have been removed");
    playerLinkingMode.delete(player.id);
    return false;
  }

  const state = entityStates.get(targetEntity.id) || { rotation: 0, poseIndex: 0, variantIndex: 0 };

  const entityRotation = targetEntity.getRotation();
  const rawRotation = entityRotation ? entityRotation.y : (state.rotation || 0);
  const normalizedRot = normalizeRotation(rawRotation);

  const platformLocation = {
    x: block.location.x + 0.5,
    y: block.location.y + 1,
    z: block.location.z + 0.5,
    dimensionId: dimension.id
  };
  state.platformLocation = platformLocation;
  state.nightMode = true;
  state.rotation = normalizedRot;
  entityStates.set(targetEntity.id, state);

  try {
    targetEntity.setDynamicProperty("fr:platform_location", JSON.stringify(platformLocation));
    console.log(`[Link Mode] Saved platform location to entity: ${JSON.stringify(platformLocation)}`);
  } catch (e) {
    console.warn(`[Link Mode] Failed to save platform location: ${e}`);
  }

  nightModeStatues.set(targetEntity.id, {
    location: platformLocation,
    rotation: normalizedRot,
    poseIndex: state.poseIndex || 0,
    variantIndex: state.variantIndex || 0,
    dimensionId: dimension.id,
    nightMode: true,
    platformLocation: platformLocation
  });

  try {
    block.setPermutation(block.permutation.withState("fr:linked", true));
  } catch { }

  try {
    targetEntity.teleport(platformLocation);
  } catch { }

  player.sendMessage(`§a[Link Mode] §7Successfully linked to platform at §e${Math.floor(platformLocation.x)}, ${Math.floor(platformLocation.y)}, ${Math.floor(platformLocation.z)}`);
  player.sendMessage("§7Night mode has been §aenabled§7 - animatronic will activate at night!");

  playerLinkingMode.delete(player.id);
  return true;
}

function unlinkFromPlatform(entity) {
  const state = entityStates.get(entity.id);
  if (state && state.platformLocation) {

    try {
      const dimension = entity.dimension;
      const platformLoc = state.platformLocation;
      const block = dimension.getBlock({ x: Math.floor(platformLoc.x), y: Math.floor(platformLoc.y) - 1, z: Math.floor(platformLoc.z) });
      if (block && block.typeId === "fr:platform") {
        block.setPermutation(block.permutation.withState("fr:linked", false));
      }
    } catch { }

    state.platformLocation = null;
    entityStates.set(entity.id, state);
  }
}

export function showStatueEditor(player, entity) {
  const entityId = entity.id;
  const poses = getEntityPoses(entity);

  if (!entityStates.has(entityId)) {
    entityStates.set(entityId, {
      rotation: 0,
      poseIndex: 0
    });
  }

  const state = entityStates.get(entityId);
  const currentPose = poses[state.poseIndex] || poses[0];

  const form = new ActionFormData()
    .title("§S§T§A§T§U§E");

  form.button("-");
  form.button("+");
  form.button("◀");
  form.button("▶");
  form.button(`se:rot_§]§8${state.rotation}`);
  form.button(`se:anim_§]§8${currentPose.name}`);

  form.show(player).then((response) => {
    if (response.canceled) return;

    const selection = response.selection;

    switch (selection) {
      case 0:
        state.rotation = (state.rotation - 15 + 360) % 360;
        applyRotation(entity, state.rotation);
        system.run(() => showStatueEditor(player, entity));
        break;

      case 1:
        state.rotation = (state.rotation + 15) % 360;
        applyRotation(entity, state.rotation);
        system.run(() => showStatueEditor(player, entity));
        break;

      case 2:
        state.poseIndex = (state.poseIndex - 1 + poses.length) % poses.length;
        applyPose(entity, state.poseIndex);
        system.run(() => showStatueEditor(player, entity));
        break;

      case 3:
        state.poseIndex = (state.poseIndex + 1) % poses.length;
        applyPose(entity, state.poseIndex);
        system.run(() => showStatueEditor(player, entity));
        break;
    }

    try {
      player.playSound("ui.click");
    } catch { }
  }).catch(() => { });
}

function applyRotation(entity, rotation) {
  try {

    const yaw = rotation * (Math.PI / 180);
    entity.setRotation({ x: 0, y: rotation });
  } catch (e) {
    console.warn("Error applying rotation:", e);
  }
}

function updateEditorCamera(player, entity) {
  try {
    const entityLoc = entity.location;
    const entityRot = entity.getRotation();
    const yawRad = (entityRot.y * Math.PI) / 180;

    const cameraDistance = 4;
    const cameraHeight = 3.0;
    const cameraX = entityLoc.x - Math.sin(yawRad) * cameraDistance;
    const cameraY = entityLoc.y + cameraHeight;
    const cameraZ = entityLoc.z + Math.cos(yawRad) * cameraDistance;

    const lookOffset = -1.5;
    const lookX = entityLoc.x - Math.cos(yawRad) * lookOffset;
    const lookZ = entityLoc.z - Math.sin(yawRad) * lookOffset;

    player.runCommand(`camera @s set minecraft:free ease 0.3 linear pos ${cameraX.toFixed(2)} ${cameraY.toFixed(2)} ${cameraZ.toFixed(2)} facing ${lookX.toFixed(2)} ${(entityLoc.y + 1).toFixed(2)} ${lookZ.toFixed(2)}`);
  } catch (e) {
    console.warn("[StatueEditor] Camera update error:", e);
  }
}

function applyPose(entity, poseIndex) {
  try {
    const poses = getEntityPoses(entity);
    entity.triggerEvent(`fr:set_pose_${poseIndex}`);
    console.log(`Pose changed to: ${poses[poseIndex]?.name || "pose_" + poseIndex} (index: ${poseIndex})`);
  } catch (e) {
    console.warn("Error applying pose:", e);
  }
}

export function initStatueEditorSystem() {

  world.afterEvents.playerInteractWithEntity.subscribe((event) => {
    const { player, target } = event;
    const equippable = player.getComponent("minecraft:equippable");
    let heldItem = equippable?.getEquipment(EquipmentSlot.Mainhand);

    if (!heldItem) {
      const inventory = player.getComponent("minecraft:inventory");
      const container = inventory?.container;
      if (container) {
        const slot = player.selectedSlotIndex ?? player.selectedSlot;
        if (typeof slot === 'number') heldItem = container.getItem(slot);
      }
    }
    if (player.isSneaking && isEntityInRouteTest(target.id)) {
      cancelRouteTestForEntity(target.id);
      return;
    }

    if (player.isSneaking && target.hasTag && target.hasTag("fr:route_test_mode")) {
      cancelRouteTestForEntity(target.id);
      return;
    }

    if (heldItem && heldItem.typeId === "fr:wrench") {
      if (target.typeId.includes("_statue")) {
        startLinkingMode(player, target);
        return;
      }
    }

    if (target.typeId.includes("_statue")) {
      if (heldItem && heldItem.typeId === "fr:faz-diver_repairman") {
        showEntityEditor(player, target, "statue");
        return;
      }
    }
  });

  world.beforeEvents.playerInteractWithBlock.subscribe((event) => {
    const { player, block } = event;

    if (playerLinkingMode.has(player.id)) {
      if (block.typeId === "fr:platform") {
        event.cancel = true;
        system.run(() => {
          completeLinking(player, block);
        });
      } else {

        system.run(() => {
          player.sendMessage("§c[Link Mode] §7That's not a platform block. Linking cancelled.");
          cancelLinkingMode(player);
        });
      }
    }
  });

  system.runInterval(() => {
    processWalkingEntities();
  }, 1);

  system.runInterval(() => {
    nightModeTickHandler();
  }, 100);

  system.run(() => {
  });
}

function getPoseCategory(poseName) {
  const name = poseName.name ? poseName.name.toLowerCase() : poseName.toLowerCase();
  if (name.includes("blood")) return "blood";
  if (name.includes("idle") || name.includes("walk") || name.includes("jumpscare") || name.includes("running")) return "motion";
  return "base";
}

function getPosesByCategory(poses, category) {
  return poses.filter(p => getPoseCategory(p) === category);
}

function getVariantCategory(variant) {
  return variant.type || "normal";
}

function getVariantsByCategory(variants, category) {
  return variants.filter(v => getVariantCategory(v) === category);
}

export function showEntityEditor(player, entity, section = "statue") {
  const entityId = entity.id;
  const variants = getEntityVariants(entity);
  const poses = getEntityPoses(entity);

  if (!entityStates.has(entityId)) {

    let currentPose = 0;
    try {
      const prop = entity.getProperty("fr:pose");
      if (prop !== undefined) currentPose = prop;
    } catch { }

    let currentVariant = 0;
    try {
      const variantProp = entity.getDynamicProperty("fr:variant_index");
      if (variantProp !== undefined && variantProp >= 0 && variantProp < variants.length) {
        currentVariant = variantProp;
      }
    } catch { }

    let actualRotation = 0;
    try {
      const entityRot = entity.getRotation();
      if (entityRot) actualRotation = normalizeRotation(entityRot.y);
    } catch { }

    entityStates.set(entityId, { rotation: actualRotation, poseIndex: currentPose, variantIndex: currentVariant, nightMode: false });

    playerEditingEntity.set(player.id, entity);
    updateEditorCamera(player, entity);
  }

  playerEditingEntity.set(player.id, entity);

  const state = entityStates.get(entityId);

  if (state.variantIndex >= variants.length) {
    state.variantIndex = 0;
  }

  if (state.nightMode === undefined) state.nightMode = false;

  const currentPose = poses[state.poseIndex] || poses[0];

  const sectionFlag = section === "variants" ? "§s§e§c§:§1" : section === "poses" ? "§s§e§c§:§2" : "§s§e§c§:§3";

  const form = new ActionFormData()
    .title(`§S§T§A§T§U§E${sectionFlag}`);

  form.button("V");
  form.button("P");
  form.button("X");



  if (section === "statue") {
    form.button("-");
    form.button("+");
    form.button(">enable<");
    form.button(state.nightMode ? ">disable<" : ">enable<");
    form.button(`${state.rotation}`);
    form.button("§aSIMULATE");
    form.button("§6NIGHT MODE");
  } else if (section === "variants") {

    if (!playerVariantCategory.has(player.id)) {
      const currentVariant = variants[state.variantIndex];
      if (currentVariant) {
        const variantCategory = currentVariant.type || "normal";
        playerVariantCategory.set(player.id, variantCategory);
        const filteredVariants = getVariantsByCategory(variants, variantCategory);
        const idxInFiltered = filteredVariants.indexOf(currentVariant);
        const targetPage = idxInFiltered >= 0 ? Math.floor(idxInFiltered / VARIANTS_PER_PAGE) : 0;
        playerVariantPage.set(player.id, targetPage);
      } else {

        playerVariantCategory.set(player.id, "normal");
        playerVariantPage.set(player.id, 0);
      }
    }

    const currentCategory = playerVariantCategory.get(player.id) || "normal";
    const filteredVariants = getVariantsByCategory(variants, currentCategory);

    VARIANT_CATEGORIES.forEach((cat, i) => {
      const label = cat.charAt(0).toUpperCase() + cat.slice(1);
      const isSelected = cat === currentCategory;
      form.button(isSelected ? `§z${label}` : label, `textures/fr_ui/terminal_variants_tab_${i + 1}`);
    });
    form.button("_SPACER_");

    const currentVarPage = playerVariantPage.get(player.id) || 0;
    const totalVarPages = Math.ceil(filteredVariants.length / VARIANTS_PER_PAGE);
    const startVarIdx = currentVarPage * VARIANTS_PER_PAGE;
    const pageVariants = filteredVariants.slice(startVarIdx, startVarIdx + VARIANTS_PER_PAGE);

    if (filteredVariants.length === 0) {
      form.button(" ");
      for (let i = 1; i < VARIANTS_PER_PAGE; i++) form.button(" ");
    } else {
      for (const v of pageVariants) {
        const globalIndex = variants.indexOf(v);
        const isCurrentVariant = globalIndex === state.variantIndex;
        form.button(isCurrentVariant ? `§z${v.name}` : v.name, v.icon);
      }
      for (let i = pageVariants.length; i < VARIANTS_PER_PAGE; i++) {
        form.button(" ");
      }
    }

    if (totalVarPages > 1) {
      form.button(`Prev`);
      form.button(`${currentVarPage + 1}`);
      form.button(`Next`);
    } else {
      form.button("_HIDE_");
      form.button("_HIDE_");
      form.button("_HIDE_");
    }
  } else if (section === "poses") {

    const allPoses = getEntityPoses(entity);
    if (!playerPoseCategory.has(player.id)) {
      const currentPoseObj = allPoses[state.poseIndex];
      if (currentPoseObj) {
        const poseCategory = getPoseCategory(currentPoseObj);
        playerPoseCategory.set(player.id, poseCategory);
        const filteredPoses = getPosesByCategory(allPoses, poseCategory);
        const idxInFiltered = filteredPoses.findIndex(p => p.name === currentPoseObj.name);
        const targetPage = idxInFiltered >= 0 ? Math.floor(idxInFiltered / POSES_PER_PAGE) : 0;
        playerPosePage.set(player.id, targetPage);
      }
    }

    const currentCategory = playerPoseCategory.get(player.id) || "base";
    const filteredPoses = getPosesByCategory(allPoses, currentCategory);

    POSE_CATEGORIES.forEach((cat, i) => {
      const label = cat.charAt(0).toUpperCase() + cat.slice(1);
      const isSelected = cat === currentCategory;
      form.button(isSelected ? `§z${label}` : label, `textures/fr_ui/terminal_tab_${i + 1}`);
    });
    form.button(" ");

    const currentPage = playerPosePage.get(player.id) || 0;
    const totalPages = Math.ceil(filteredPoses.length / POSES_PER_PAGE);
    const startIdx = currentPage * POSES_PER_PAGE;
    const pagePoses = filteredPoses.slice(startIdx, startIdx + POSES_PER_PAGE);

    if (filteredPoses.length === 0) {
      form.button(" ");
      for (let i = 1; i < POSES_PER_PAGE; i++) form.button(" ");
    } else {
      for (const p of pagePoses) {
        const originalPoseIndex = allPoses.findIndex(pose => pose.name === p.name);
        const isCurrentPose = originalPoseIndex === state.poseIndex;
        form.button(isCurrentPose ? `§z${p.name}` : p.name, p.icon);
      }

      for (let i = pagePoses.length; i < POSES_PER_PAGE; i++) {
        form.button(" ");
      }
    }

    if (totalPages > 1) {
      form.button(`Prev`);
      form.button(`Page ${currentPage + 1}`);
      form.button(`Next`);
    } else {
      form.button("§v_hide");
      form.button("§v_hide");
      form.button("§v_hide");
    }
  }

  form.show(player).then((response) => {
    if (response.canceled) {
      try {
        player.runCommand(`camera @s clear`);
      } catch (e) {
        console.warn("[StatueEditor] Camera restore error:", e);
      }
      entityStates.delete(entityId);
      playerEditingEntity.delete(player.id);
      return;
    }

    const sel = response.selection;

    if (sel === 0) {

      const currentVariant = variants[state.variantIndex];
      if (currentVariant) {
        const variantCategory = currentVariant.type || "normal";
        playerVariantCategory.set(player.id, variantCategory);
        const filteredVariants = getVariantsByCategory(variants, variantCategory);
        const idxInFiltered = filteredVariants.indexOf(currentVariant);
        const targetPage = idxInFiltered >= 0 ? Math.floor(idxInFiltered / VARIANTS_PER_PAGE) : 0;
        playerVariantPage.set(player.id, targetPage);
      } else {
        playerVariantCategory.set(player.id, "normal");
        playerVariantPage.set(player.id, 0);
      }
      system.run(() => showEntityEditor(player, entity, "variants"));
      return;
    }
    if (sel === 1) {

      const allPoses = getEntityPoses(entity);
      const currentPoseObj = allPoses[state.poseIndex];
      if (currentPoseObj) {
        const poseCategory = getPoseCategory(currentPoseObj);
        playerPoseCategory.set(player.id, poseCategory);
        const filteredPoses = getPosesByCategory(allPoses, poseCategory);
        const idxInFiltered = filteredPoses.findIndex(p => p.name === currentPoseObj.name);
        const targetPage = idxInFiltered >= 0 ? Math.floor(idxInFiltered / POSES_PER_PAGE) : 0;
        playerPosePage.set(player.id, targetPage);
      } else {
        playerPoseCategory.set(player.id, "base");
        playerPosePage.set(player.id, 0);
      }
      system.run(() => showEntityEditor(player, entity, "poses"));
      return;
    }
    if (sel === 2) { system.run(() => showEntityEditor(player, entity, "statue")); return; }

    if (section === "statue") {

      if (sel === 3) { state.rotation = (state.rotation - 15 + 360) % 360; applyRotation(entity, state.rotation); updateEditorCamera(player, entity); }
      if (sel === 4) { state.rotation = (state.rotation + 15) % 360; applyRotation(entity, state.rotation); updateEditorCamera(player, entity); }
      if (sel === 5) {

        player.runCommand(`tp @s ${entity.location.x} ${entity.location.y} ${entity.location.z}`);
        player.runCommand(`camera @s fade time 0.5 0.5 0.5`);
      }
      if (sel === 6) {

        if (state.nightMode) {
          disableNightMode(entity);
          player.sendMessage("§c[Night Mode] §7Disabled - Animatronic will stay as statue");
        } else {
          enableNightMode(entity);
          player.sendMessage("§a[Night Mode] §7Enabled - Animatronic will activate at night");
        }
      }
      if (sel === 8) {

        const waypointId = entity.getDynamicProperty("fr:statue_id");
        const platformLoc = entity.getDynamicProperty("fr:platform_location");

        if (!waypointId) {
          player.sendMessage("§c[Simulation] §7No waypoint ID! Use path_marker to link waypoints first.");
        } else if (!platformLoc) {
          player.sendMessage("§c[Simulation] §7No platform linked! Use wrench to link a platform first.");
        } else {

          return;
        }
      }
      if (sel === 9) {

        system.run(() => showNightModeActivationMenu(player, entity));
        return;
      }
      system.run(() => showEntityEditor(player, entity, "statue"));
    } else if (section === "variants" && sel >= 3) {
      if (sel >= 3 && sel <= 6) {
        playerVariantCategory.set(player.id, VARIANT_CATEGORIES[sel - 3]);
        playerVariantPage.set(player.id, 0);
        system.run(() => showEntityEditor(player, entity, "variants"));
        return;
      }

      if (sel === 7) return;

      const currentCategory = playerVariantCategory.get(player.id) || "normal";
      const filteredVariants = getVariantsByCategory(variants, currentCategory);

      const currentVarPage = playerVariantPage.get(player.id) || 0;
      const totalVarPages = Math.ceil(filteredVariants.length / VARIANTS_PER_PAGE);

      if (sel === 11) {
        if (totalVarPages > 1) {
          const newPage = (currentVarPage - 1 + totalVarPages) % totalVarPages;
          playerVariantPage.set(player.id, newPage);
          system.run(() => showEntityEditor(player, entity, "variants"));
        }
        return;
      }
      if (sel === 13) {
        if (totalVarPages > 1) {
          const newPage = (currentVarPage + 1) % totalVarPages;
          playerVariantPage.set(player.id, newPage);
          system.run(() => showEntityEditor(player, entity, "variants"));
        }
        return;
      }

      const variantIdxInPage = sel - 8;
      if (variantIdxInPage >= 0 && variantIdxInPage < VARIANTS_PER_PAGE) {
        const actualVariantIdx = currentVarPage * VARIANTS_PER_PAGE + variantIdxInPage;
        if (actualVariantIdx < filteredVariants.length) {
          const selectedVariant = filteredVariants[actualVariantIdx];
          const globalIndex = variants.indexOf(selectedVariant);
          if (globalIndex !== -1) {
            state.variantIndex = globalIndex;
            applyVariant(entity, globalIndex);
            system.run(() => showEntityEditor(player, entity, "variants"));
          }
        }
      }
    } else if (section === "poses" && sel >= 3) {
      const currentCategory = playerPoseCategory.get(player.id) || "base";
      const allPoses = getEntityPoses(entity);
      const filteredPoses = getPosesByCategory(allPoses, currentCategory);

      const currentPage = playerPosePage.get(player.id) || 0;
      const totalPages = Math.ceil(filteredPoses.length / POSES_PER_PAGE);

      if (sel >= 3 && sel <= 6) {
        const newCat = POSE_CATEGORIES[sel - 3];
        playerPoseCategory.set(player.id, newCat);
        playerPosePage.set(player.id, 0);
        system.run(() => showEntityEditor(player, entity, "poses"));
        return;
      }

      if (sel === 13) {
        const newPage = (currentPage - 1 + totalPages) % totalPages;
        playerPosePage.set(player.id, newPage);
        system.run(() => showEntityEditor(player, entity, "poses"));
        return;
      }

      if (sel === 15) {
        const newPage = (currentPage + 1) % totalPages;
        playerPosePage.set(player.id, newPage);
        system.run(() => showEntityEditor(player, entity, "poses"));
        return;
      }

      const poseIdxInPage = sel - 7;
      if (poseIdxInPage >= 0 && poseIdxInPage < POSES_PER_PAGE) {
        const actualPoseIdxInFiltered = currentPage * POSES_PER_PAGE + poseIdxInPage;
        if (actualPoseIdxInFiltered < filteredPoses.length) {
          const selectedPose = filteredPoses[actualPoseIdxInFiltered];

          const originalPoseIndex = allPoses.findIndex(p => p.name === selectedPose.name);
          if (originalPoseIndex !== -1) {
            state.poseIndex = originalPoseIndex;
            applyPose(entity, originalPoseIndex);
            system.run(() => showEntityEditor(player, entity, "poses"));
          }
        }
      }
    }
  });
}

function getEntityVariants(entity) {
  if (entity.typeId.includes("chica")) return VARIANTS_CHICA;
  if (entity.typeId.includes("foxy")) return VARIANTS_FOXY;
  if (entity.typeId.includes("freddy")) return VARIANTS_FREDDY;
  if (entity.typeId.includes("sparky")) return VARIANTS_SPARKY;
  return VARIANTS_BONNIE;
}

function getEntityPoses(entity) {
  if (entity.typeId.includes("chica")) return POSES_CHICA;
  if (entity.typeId.includes("foxy")) return POSES_FOXY;
  if (entity.typeId.includes("freddy")) return POSES_FREDDY;
  if (entity.typeId.includes("sparky")) return POSES_SPARKY;
  return POSES_BONNIE;
}

function applyVariant(entity, variantIndex) {
  try {
    entity.triggerEvent(`fr:set_variant_${variantIndex}`);

    entity.setDynamicProperty("fr:variant_index", variantIndex);
    console.log(`Variant changed to index: ${variantIndex}`);
  } catch (e) {
    console.warn("Error applying variant:", e);
  }
}
