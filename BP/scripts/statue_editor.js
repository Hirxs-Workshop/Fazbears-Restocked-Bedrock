

import { world, system, EquipmentSlot, ItemStack } from "@minecraft/server";
import {
    ActionFormData,
    ModalFormData,
    MessageFormData,
} from "@minecraft/server-ui";
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
    ABILITY_TYPES,
} from "./pathfinding/custom_pathing.js";

import { dynamicToast } from "./utils.js";
import { isPlayerInCamera, securityCameraSystem } from "./camera_system/security_camera_system.js";

import {
    selectStageplate,
    linkAnimatronicToStageplate,
    getPlayerSelection,
    clearPlayerSelection,
    getLinkedStageplate,
    isAnimatronic,
    getAnimatronicRouteId,
    getRoutePointsForRouteId,
    createRoutePoint,
    updateRoutePoint,
    deleteRoutePoint,
    deleteAllRoutePoints,
    getNextRouteOrder,
    getRoutePointData,
    startRouteTest as startCustomRouteTest,
    DEFAULT_WAIT_TIME as CUSTOM_DEFAULT_WAIT_TIME,
    getAILevel,
    setAILevel,
    getAILevelStats,
    getNightPathingState,
    updateNightPathingState,
    NIGHT_MODE_CONFIG,
    AI_LEVEL_CONFIG,
    enableNightMode as enableNightModePathing,
    disableNightMode as disableNightModePathing,
    isNightModeEnabled,
    nightModeRegistry,
    getOrCreateAnimatronicId,
} from "./pathfinding/custom_pathing.js";

const POSES_BONNIE = [
    {
        name: "stand",
        icon: "textures/fr_ui/poses/bonnie/bonnie_statue_pose_stand",
        type: "normal",
    },
    {
        name: "showtime",
        icon: "textures/fr_ui/poses/bonnie/bonnie_statue_pose_showtime",
        type: "normal",
    },
    {
        name: "stage",
        icon: "textures/fr_ui/poses/bonnie/bonnie_statue_pose_stage",
        type: "normal",
    },
    {
        name: "stare",
        icon: "textures/fr_ui/poses/bonnie/bonnie_statue_pose_stare",
        type: "normal",
    },
    {
        name: "ending",
        icon: "textures/fr_ui/poses/bonnie/bonnie_statue_pose_ending",
        type: "special",
    },
    {
        name: "celebrate",
        icon: "textures/fr_ui/poses/bonnie/bonnie_statue_pose_celebrate",
        type: "special",
    },
    {
        name: "jam",
        icon: "textures/fr_ui/poses/bonnie/bonnie_statue_pose_jam",
        type: "special",
    },
    {
        name: "sit",
        icon: "textures/fr_ui/poses/bonnie/bonnie_statue_pose_sit",
        type: "normal",
    },
    {
        name: "thank_you",
        icon: "textures/fr_ui/poses/bonnie/bonnie_statue_pose_thanks_you",
        type: "special",
    },
    {
        name: "ar_render",
        icon: "textures/fr_ui/poses/bonnie/bonnie_statue_pose_ar_render",
        type: "community",
    },
    {
        name: "mugshot",
        icon: "textures/fr_ui/poses/bonnie/bonnie_statue_pose_mugshot",
        type: "community",
    },
    {
        name: "cam_lean",
        icon: "textures/fr_ui/poses/bonnie/bonnie_statue_pose_cam_lean",
        type: "community",
    },
    {
        name: "look_up",
        icon: "textures/fr_ui/poses/bonnie/bonnie_statue_pose_look_up",
        type: "normal",
    },
    {
        name: "wave",
        icon: "textures/fr_ui/poses/bonnie/bonnie_statue_pose_wave",
        type: "normal",
    },
    {
        name: "ar_render_two",
        icon: "textures/fr_ui/poses/bonnie/bonnie_statue_pose_ar_render_2",
        type: "community",
    },
    {
        name: "ucn_jumpscare",
        icon: "textures/fr_ui/poses/bonnie/bonnie_statue_pose_ucn_jumpscare",
        type: "seasonal",
    },
    {
        name: "hold_heart",
        icon: "textures/fr_ui/poses/bonnie/bonnie_statue_pose_hold_heart",
        type: "seasonal",
    },
    {
        name: "sit_open",
        icon: "textures/fr_ui/poses/bonnie/bonnie_statue_pose_sit_open",
        type: "normal",
    },
    {
        name: "floor_sit",
        icon: "textures/fr_ui/poses/bonnie/bonnie_statue_pose_floor_sit",
        type: "normal",
    },
    {
        name: "floor_sit_open",
        icon: "textures/fr_ui/poses/bonnie/bonnie_statue_pose_floor_sit_open",
        type: "normal",
    },
    {
        name: "lay",
        icon: "textures/fr_ui/poses/bonnie/bonnie_statue_pose_lay",
        type: "special",
    },
    {
        name: "dismebembered",
        icon: "textures/fr_ui/poses/bonnie/bonnie_statue_pose_dismebembered",
        type: "seasonal",
    },
    {
        name: "walk",
        icon: "textures/fr_ui/poses/bonnie/bonnie_statue_pose_walk",
        type: "special",
    },
    {
        name: "idle",
        icon: "textures/fr_ui/poses/bonnie/bonnie_statue_pose_idle",
        type: "special",
    },
];

const POSES_CHICA = [
    {
        name: "stand",
        icon: "textures/fr_ui/poses/chica/chica_stand",
        type: "normal",
    },
    {
        name: "thank_you",
        icon: "textures/fr_ui/poses/chica/chica_thank_you",
        type: "special",
    },
    {
        name: "stage",
        icon: "textures/fr_ui/poses/chica/chica_stage",
        type: "normal",
    },
    {
        name: "ar_render",
        icon: "textures/fr_ui/poses/chica/chica_ar_render",
        type: "community",
    },
    {
        name: "eat_pizza",
        icon: "textures/fr_ui/poses/chica/chica_eat_pizza",
        type: "special",
    },
    {
        name: "wink",
        icon: "textures/fr_ui/poses/chica/chica_wink",
        type: "normal",
    },
    {
        name: "teaser",
        icon: "textures/fr_ui/poses/chica/chica_teaser",
        type: "community",
    },
    {
        name: "sit_cupcake",
        icon: "textures/fr_ui/poses/chica/chica_sit_cupcake",
        type: "normal",
    },
    {
        name: "look_up",
        icon: "textures/fr_ui/poses/chica/chica_look_up",
        type: "normal",
    },
    {
        name: "dining_room",
        icon: "textures/fr_ui/poses/chica/chica_dining_room",
        type: "normal",
    },
    {
        name: "west_hall",
        icon: "textures/fr_ui/poses/chica/chica_west_hall",
        type: "normal",
    },
    {
        name: "dismantled",
        icon: "textures/fr_ui/poses/chica/chica_dismantled",
        type: "special",
    },
    {
        name: "sit",
        icon: "textures/fr_ui/poses/chica/chica_sit",
        type: "normal",
    },
    {
        name: "walk",
        icon: "textures/fr_ui/poses/chica/chica_walk",
        type: "special",
    },
    {
        name: "idle",
        icon: "textures/fr_ui/poses/chica/chica_idle",
        type: "normal",
    },
    {
        name: "jumpscare",
        icon: "textures/fr_ui/poses/chica/chica_jumpscare",
        type: "special",
    },
    {
        name: "showtime",
        icon: "textures/fr_ui/poses/chica/chica_showtime",
        type: "normal",
    },
    {
        name: "stare",
        icon: "textures/fr_ui/poses/chica/chica_stare",
        type: "normal",
    },
    {
        name: "floor_sit_cupcake",
        icon: "textures/fr_ui/poses/chica/chica_floor_sit_cupcake",
        type: "normal",
    },
    {
        name: "walk_blood",
        icon: "textures/fr_ui/poses/chica/chica_walk_blood",
        type: "seasonal",
    },
    {
        name: "idle_blood",
        icon: "textures/fr_ui/poses/chica/chica_idle_blood",
        type: "seasonal",
    },
];

const POSES_FOXY = [
    {
        name: "stand",
        icon: "textures/fr_ui/poses/foxy/foxy_stand",
        type: "normal",
    },
    {
        name: "mugshot",
        icon: "textures/fr_ui/poses/foxy/foxy_mugshot",
        type: "community",
    },
    {
        name: "hw2_render",
        icon: "textures/fr_ui/poses/foxy/foxy_hw2_render",
        type: "community",
    },
    {
        name: "peek",
        icon: "textures/fr_ui/poses/foxy/foxy_peek",
        type: "special",
    },
    {
        name: "exit_cove",
        icon: "textures/fr_ui/poses/foxy/foxy_exit_cove",
        type: "special",
    },
    {
        name: "jumpscare",
        icon: "textures/fr_ui/poses/foxy/foxy_jumpscare",
        type: "special",
    },
    {
        name: "ar_render1",
        icon: "textures/fr_ui/poses/foxy/foxy_ar_render1",
        type: "community",
    },
    {
        name: "ar_render_2",
        icon: "textures/fr_ui/poses/foxy/foxy_ar_render_2",
        type: "community",
    },
    {
        name: "look_up",
        icon: "textures/fr_ui/poses/foxy/foxy_look_up",
        type: "normal",
    },
    {
        name: "crouch_up",
        icon: "textures/fr_ui/poses/foxy/foxy_crouch_look_up",
        type: "normal",
    },
    {
        name: "crouch_side",
        icon: "textures/fr_ui/poses/foxy/foxy_crouch_look_side",
        type: "normal",
    },
    {
        name: "floor_sit",
        icon: "textures/fr_ui/poses/foxy/foxy_floor_sit",
        type: "normal",
    },
    {
        name: "dismantled",
        icon: "textures/fr_ui/poses/foxy/foxy_dismantled",
        type: "seasonal",
    },
    {
        name: "walk",
        icon: "textures/fr_ui/poses/foxy/foxy_walk",
        type: "special",
    },
    {
        name: "idle",
        icon: "textures/fr_ui/poses/foxy/foxy_idle",
        type: "normal",
    },
    {
        name: "showtime",
        icon: "textures/fr_ui/poses/foxy/foxy_showtime",
        type: "special",
    },
    {
        name: "sit",
        icon: "textures/fr_ui/poses/foxy/foxy_sit",
        type: "normal",
    },
    {
        name: "lay",
        icon: "textures/fr_ui/poses/foxy/foxy_lay",
        type: "special",
    },
    {
        name: "running",
        icon: "textures/fr_ui/poses/foxy/foxy_running",
        type: "motion",
    },
];

const POSES_SPARKY = [
    {
        name: "stand",
        icon: "textures/fr_ui/poses/sparky/sparky_stand",
        type: "normal",
    },
    {
        name: "eat_bone",
        icon: "textures/fr_ui/poses/sparky/sparky_eat_bone",
        type: "normal",
    },
    {
        name: "hoax_pose",
        icon: "textures/fr_ui/poses/sparky/sparky_hoax_pose",
        type: "special",
    },
    {
        name: "floor_sit",
        icon: "textures/fr_ui/poses/sparky/sparky_floor_sit",
        type: "normal",
    },
    {
        name: "table_sit",
        icon: "textures/fr_ui/poses/sparky/sparky_table_sit",
        type: "normal",
    },
    {
        name: "slab_sit",
        icon: "textures/fr_ui/poses/sparky/sparky_slab_sit",
        type: "normal",
    },
    {
        name: "lay",
        icon: "textures/fr_ui/poses/sparky/sparky_lay",
        type: "special",
    },
    {
        name: "dismantled",
        icon: "textures/fr_ui/poses/sparky/sparky_dismantled",
        type: "seasonal",
    },
];

const POSES_FREDDY = [
    {
        name: "stand",
        icon: "textures/fr_ui/poses/freddy/freddy_statue_pose_stand",
    },
    {
        name: "wave",
        icon: "textures/fr_ui/poses/freddy/freddy_statue_pose_wave",
    },
    {
        name: "greet",
        icon: "textures/fr_ui/poses/freddy/freddy_statue_pose_greet",
    },
    {
        name: "stage",
        icon: "textures/fr_ui/poses/freddy/freddy_statue_pose_stage",
    },
    {
        name: "stare",
        icon: "textures/fr_ui/poses/freddy/freddy_statue_pose_stare",
    },
    {
        name: "poster",
        icon: "textures/fr_ui/poses/freddy/freddy_statue_pose_lets_party_poster",
    },
    {
        name: "ending",
        icon: "textures/fr_ui/poses/freddy/freddy_statue_pose_ending_pose",
    },
    {
        name: "celebrate",
        icon: "textures/fr_ui/poses/freddy/freddy_statue_pose_celebrate",
    },
    {
        name: "arms_down",
        icon: "textures/fr_ui/poses/freddy/freddy_statue_pose_stand_arms_down",
    },
    {
        name: "ar_render",
        icon: "textures/fr_ui/poses/freddy/freddy_statue_pose_ar_render",
    },
    {
        name: "teaser",
        icon: "textures/fr_ui/poses/freddy/freddy_statue_pose_teaser",
    },
    {
        name: "gift",
        icon: "textures/fr_ui/poses/freddy/freddy_statue_pose_gift",
    },
    {
        name: "dismantled",
        icon: "textures/fr_ui/poses/freddy/freddy_statue_pose_dismantled",
    },
    {
        name: "sit",
        icon: "textures/fr_ui/poses/freddy/freddy_statue_pose_sit",
    },
    {
        name: "jumpscare",
        icon: "textures/fr_ui/poses/freddy/freddy_statue_pose_jumpscare",
    },
    {
        name: "walk",
        icon: "textures/fr_ui/poses/freddy/freddy_statue_pose_walk",
    },
    {
        name: "walk_mic",
        icon: "textures/fr_ui/poses/freddy/freddy_statue_pose_walk_mic",
    },
    {
        name: "walk_blood",
        icon: "textures/fr_ui/poses/freddy/freddy_statue_pose_walk_blood",
    },
    {
        name: "idle",
        icon: "textures/fr_ui/poses/freddy/freddy_statue_pose_idle_no_mic",
    },
    {
        name: "idle_mic",
        icon: "textures/fr_ui/poses/freddy/freddy_statue_pose_idle_mic",
    },
    {
        name: "idle_blood",
        icon: "textures/fr_ui/poses/freddy/freddy_statue_pose_idle_no_mic_blood",
    },
    {
        name: "lean",
        icon: "textures/fr_ui/poses/freddy/freddy_statue_pose_lean",
    },
    {
        name: "look_up",
        icon: "textures/fr_ui/poses/freddy/freddy_statue_pose_look_up",
    },
    {
        name: "angry",
        icon: "textures/fr_ui/poses/freddy/freddy_statue_pose_angry",
    },
    {
        name: "mugshot",
        icon: "textures/fr_ui/poses/freddy/freddy_statue_pose_mugshot",
    },
    {
        name: "hold_mask",
        icon: "textures/fr_ui/poses/freddy/freddy_statue_pose_hold_mask",
    },
    {
        name: "hold_mask_reach",
        icon: "textures/fr_ui/poses/freddy/freddy_statue_pose_hold_mask_reach",
    },
    {
        name: "space",
        icon: "textures/fr_ui/poses/freddy/freddy_statue_pose_space",
    },
    {
        name: "stuffed",
        icon: "textures/fr_ui/poses/freddy/freddy_statue_pose_stuffed",
    },
    {
        name: "sit_floor",
        icon: "textures/fr_ui/poses/freddy/freddy_statue_pose_sit_floor",
    },
    {
        name: "sit_hatch",
        icon: "textures/fr_ui/poses/freddy/freddy_statue_pose_sit_hatch",
    },
    {
        name: "lay",
        icon: "textures/fr_ui/poses/freddy/freddy_statue_pose_lay",
    },
    {
        name: "showtime",
        icon: "textures/fr_ui/poses/freddy/freddy_statue_pose_showtime",
    },
    {
        name: "miku",
        icon: "textures/fr_ui/poses/freddy/freddy_miku",
    },
];

const POSES_GOLDEN_FREDDY = [
    {
        name: "sit",
        icon: "textures/fr_ui/poses/golden_freddy/golden_freddy_sit",
    },
    {
        name: "table_sit",
        icon: "textures/fr_ui/poses/golden_freddy/golden_freddy_table_sit",
    },
    {
        name: "mysetermini_sit",
        icon: "textures/fr_ui/poses/golden_freddy/golden_freddy_mysetermini_sit",
    },
    {
        name: "lean_1",
        icon: "textures/fr_ui/poses/golden_freddy/golden_freddy_lean_1",
    },
    {
        name: "lean_2",
        icon: "textures/fr_ui/poses/golden_freddy/golden_freddy_lean_2",
    },
    {
        name: "lean_reach",
        icon: "textures/fr_ui/poses/golden_freddy/golden_freddy_lean_reach",
    },
    {
        name: "stand",
        icon: "textures/fr_ui/poses/golden_freddy/golden_freddy_stand",
    },
    {
        name: "lay",
        icon: "textures/fr_ui/poses/golden_freddy/golden_freddy_lay",
    },
    {
        name: "floating head",
        icon: "textures/fr_ui/poses/golden_freddy/golden_freddy_head",
    },
];

const VARIANTS_BONNIE = [
    {
        name: "classic",
        icon: "textures/fr_ui/variants/bonnie/bonnie_regular",
        type: "normal",
    },
    {
        name: "chocolate",
        icon: "textures/fr_ui/variants/bonnie/bonnie_chocolate",
        type: "seasonal",
    },
    {
        name: "elf",
        icon: "textures/fr_ui/variants/bonnie/bonnie_elf",
        type: "seasonal",
    },
    {
        name: "hw_guitar",
        icon: "textures/fr_ui/variants/bonnie/bonnie_hw_guitar",
        type: "normal",
    },
    {
        name: "black_eyes",
        icon: "textures/fr_ui/variants/bonnie/bonnie_black_eyes",
        type: "normal",
    },
    {
        name: "black_eyes_hw",
        icon: "textures/fr_ui/variants/bonnie/bonnie_hw_guitar_black_eyes",
        type: "normal",
    },
];

const VARIANTS_CHICA = [
    {
        name: "classic",
        icon: "textures/fr_ui/variants/chica/chica_base",
        type: "normal",
    },
    {
        name: "pizza",
        icon: "textures/fr_ui/variants/chica/chica_pizza",
        type: "normal",
    },
    {
        name: "snowbird",
        icon: "textures/fr_ui/variants/chica/chica_snow",
        type: "seasonal",
    },
    {
        name: "cursed_cupcake",
        icon: "textures/fr_ui/variants/chica/chica_cursed",
        type: "special",
    },
    {
        name: "sotm",
        icon: "textures/fr_ui/variants/chica/chica_sotm",
        type: "special",
    },
    {
        name: "withered",
        icon: "textures/fr_ui/variants/chica/chica_withered",
        type: "special",
    },
    {
        name: "chocolate",
        icon: "textures/fr_ui/variants/chica/chica_chocolate",
        type: "seasonal",
    },
    {
        name: "chocolate_candys",
        icon: "textures/fr_ui/variants/chica/chica_chocolate_candys",
        type: "seasonal",
    },
];

const VARIANTS_FOXY = [
    {
        name: "base",
        icon: "textures/fr_ui/variants/foxy/foxy_base",
        type: "normal",
    },
    {
        name: "fixed",
        icon: "textures/fr_ui/variants/foxy/foxy_fixed",
        type: "normal",
    },
    {
        name: "glow",
        icon: "textures/fr_ui/variants/foxy/foxy_glow_eyes",
        type: "special",
    },
    {
        name: "fixed_glow",
        icon: "textures/fr_ui/variants/foxy/foxy_fixed_glow_eyes",
        type: "special",
    },
    {
        name: "gingerbread",
        icon: "textures/fr_ui/variants/foxy/foxy_gingerbread",
        type: "seasonal",
    },
    {
        name: "radioactive",
        icon: "textures/fr_ui/variants/foxy/foxy_radioactive",
        type: "special",
    },
    {
        name: "captain_fixed",
        icon: "textures/fr_ui/variants/foxy/foxy_captain_fixed",
        type: "normal",
    },
    {
        name: "captain_torn",
        icon: "textures/fr_ui/variants/foxy/foxy_captain_torn",
        type: "normal",
    },
    {
        name: "fixed_captain_fixed",
        icon: "textures/fr_ui/variants/foxy/foxy_fixed_captain_fixed",
        type: "normal",
    },
    {
        name: "fixed_captain_torn",
        icon: "textures/fr_ui/variants/foxy/foxy_fixed_captain_torn",
        type: "normal",
    },
    {
        name: "chocolate",
        icon: "textures/fr_ui/variants/foxy/foxy_chocolate",
        type: "seasonal",
    },
];

const VARIANTS_SPARKY = [
    {
        name: "base",
        icon: "textures/fr_ui/variants/sparky/sparky_base",
        type: "normal",
    },
    {
        name: "fixed",
        icon: "textures/fr_ui/variants/sparky/sparky_fixed",
        type: "normal",
    },
    {
        name: "accurate",
        icon: "textures/fr_ui/variants/sparky/sparky_accurate",
        type: "special",
    },
    {
        name: "withered",
        icon: "textures/fr_ui/variants/sparky/sparky_accurate_withered",
        type: "special",
    },
    {
        name: "hot_chocolate",
        icon: "textures/fr_ui/variants/sparky/sparky_hot_chocolate",
        type: "seasonal",
    },
];

const POSES_ENDO_01 = [
    {
        name: "stand",
        icon: "textures/fr_ui/poses/endo_01/endo_stand",
    },
    {
        name: "wave",
        icon: "textures/fr_ui/poses/endo_01/endo_wave",
    },
    {
        name: "reach",
        icon: "textures/fr_ui/poses/endo_01/endo_reach",
    },
    {
        name: "floor_sit",
        icon: "textures/fr_ui/poses/endo_01/endo_floor_sit",
    },
    {
        name: "sit",
        icon: "textures/fr_ui/poses/endo_01/endo_sit",
    },
    {
        name: "sit_stare",
        icon: "textures/fr_ui/poses/endo_01/endo_sit_stare",
    },
    {
        name: "lay",
        icon: "textures/fr_ui/poses/endo_01/endo_lay",
    },
    {
        name: "dismantled",
        icon: "textures/fr_ui/poses/endo_01/endo_dismantled",
    },
];

const VARIANTS_ENDO_01 = [
    {
        name: "base",
        icon: "textures/fr_ui/variants/endo_01/endo_01_base",
        type: "normal",
    },
    {
        name: "black_eyes",
        icon: "textures/fr_ui/variants/endo_01/endo_01_black_eyes",
        type: "normal",
    },
    {
        name: "brows",
        icon: "textures/fr_ui/variants/endo_01/endo_01_brows",
        type: "normal",
    },
    {
        name: "film",
        icon: "textures/fr_ui/variants/endo_01/endo_01_film",
        type: "special",
    },
    {
        name: "film_springlock",
        icon: "textures/fr_ui/variants/endo_01/endo_01_film_springlock",
        type: "special",
    },
    {
        name: "candy",
        icon: "textures/fr_ui/variants/endo_01/endo_01_candy",
        type: "special",
    },
];

const VARIANTS_FREDDY = [
    {
        name: "base",
        icon: "textures/fr_ui/variants/freddy/freddy_basic",
        type: "normal",
    },
    {
        name: "black_eyes",
        icon: "textures/fr_ui/variants/freddy/freddy_black_eyes",
        type: "normal",
    },
    {
        name: "hardmode",
        icon: "textures/fr_ui/variants/freddy/freddy_hardmode",
        type: "special",
    },
    {
        name: "frostbear",
        icon: "textures/fr_ui/variants/freddy/freddy_frost",
        type: "seasonal",
    },
    {
        name: "santa",
        icon: "textures/fr_ui/variants/freddy/freddy_santa",
        type: "seasonal",
    },
    {
        name: "blacklight",
        icon: "textures/fr_ui/variants/freddy/freddy_blacklight",
        type: "special",
    },
    {
        name: "mygod",
        icon: "textures/fr_ui/variants/freddy/freddy_bear5",
        type: "special",
    },
    {
        name: "venom",
        icon: "textures/fr_ui/variants/freddy/freddy_venom",
        type: "special",
    },
    {
        name: "big_band",
        icon: "textures/fr_ui/variants/freddy/freddy_big_band",
        type: "community",
    },
    {
        name: "chocolate",
        icon: "textures/fr_ui/variants/freddy/freddy_chocolate",
        type: "seasonal",
    },
    {
        name: "hatsune",
        icon: "textures/fr_ui/variants/freddy/freddy_hatsune_miku",
        type: "community",
    },
    {
        name: "super",
        icon: "textures/fr_ui/variants/freddy/freddy_super",
        type: "community",
    },
];

const POSES_FREDDY_MOVIE = [
    {
        name: "stand",
        icon: "textures/fr_ui/poses/freddy/movie/freddy_film_stand",
    },
    {
        name: "stand_mic",
        icon: "textures/fr_ui/poses/freddy/movie/freddy_film_stand_mic",
    },
    {
        name: "look_right",
        icon: "textures/fr_ui/poses/freddy/movie/freddy_film_look_right",
    },
    {
        name: "poster",
        icon: "textures/fr_ui/poses/freddy/movie/freddy_film_poster",
    },
    {
        name: "comic_poster",
        icon: "textures/fr_ui/poses/freddy/movie/freddy_film_stand_comic_poster",
    },
    {
        name: "look_left",
        icon: "textures/fr_ui/poses/freddy/movie/freddy_film_look_left",
    },
    {
        name: "angry_down",
        icon: "textures/fr_ui/poses/freddy/movie/freddy_film_look_down_angry",
    },
    {
        name: "dead",
        icon: "textures/fr_ui/poses/freddy/movie/freddy_film_dead",
    },
    {
        name: "lay",
        icon: "textures/fr_ui/poses/freddy/movie/freddy_film_lay",
    },
    {
        name: "table_sit",
        icon: "textures/fr_ui/poses/freddy/movie/freddy_film_table_sit",
    },
    {
        name: "floor_sit",
        icon: "textures/fr_ui/poses/freddy/movie/freddy_film_floor_sit",
    },
    {
        name: "dismantled",
        icon: "textures/fr_ui/poses/freddy/movie/freddy_film_dismantled",
    },
    {
        name: "shadow_dismantled",
        icon: "textures/fr_ui/poses/freddy/movie/freddy_film_shadow_dismantled",
    },
];

const VARIANTS_FREDDY_MOVIE = [
    {
        name: "default",
        icon: "textures/fr_ui/variants/freddy/movie/freddy_film_base",
        type: "normal",
    },
    {
        name: "shadow",
        icon: "textures/fr_ui/variants/freddy/movie/freddy_film_shadow",
        type: "normal",
    },
    {
        name: "shreddy",
        icon: "textures/fr_ui/variants/freddy/movie/freddy_fim_shreddy_fazchair",
        type: "special",
    },
];

const VARIANTS_GOLDEN_FREDDY = [
    {
        name: "base",
        icon: "textures/fr_ui/variants/golden_freddy/golden_freddy_no_shadow",
        type: "normal",
    },
    {
        name: "head_shadow",
        icon: "textures/fr_ui/variants/golden_freddy/golden_freddy_head_shadow",
        type: "normal",
    },
    {
        name: "shadow",
        icon: "textures/fr_ui/variants/golden_freddy/golden_freddy_shadow",
        type: "normal",
    },
    {
        name: "yellow_bear",
        icon: "textures/fr_ui/variants/golden_freddy/golden_freddy_yellow_bear",
        type: "normal",
    },
    {
        name: "yb_head_shadow",
        icon: "textures/fr_ui/variants/golden_freddy/golden_freddy_yellow_bear_head_shadow",
        type: "normal",
    },
    {
        name: "yb_shadow",
        icon: "textures/fr_ui/variants/golden_freddy/golden_freddy_yellow_bear_shadow",
        type: "normal",
    },
    {
        name: "holly_lace",
        icon: "textures/fr_ui/variants/golden_freddy/golden_freddy_holly_lace",
        type: "seasonal",
    },
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

const rotationPreviewIntervals = new Map();

function getDimensionFromId(dimensionId) {
    const dim = (dimensionId || "minecraft:overworld").replace("minecraft:", "");
    return world.getDimension(dim);
}

const routePointPreviewIntervals = new Map();

function stopRotationPreview(player) {
    const handle = rotationPreviewIntervals.get(player.id);
    if (handle !== undefined) {
        try {
            system.clearRun(handle);
        } catch { }
        rotationPreviewIntervals.delete(player.id);
    }
}

function stopRoutePointCameraTracking(playerId) {
    const handle = routePointPreviewIntervals.get(playerId);
    if (handle !== undefined) {
        try {
            system.clearRun(handle);
        } catch { }
        routePointPreviewIntervals.delete(playerId);
    }
}

function startRoutePointCameraTracking(player, routePointLocation) {
    stopRoutePointCameraTracking(player.id);

    const checkInterval = system.runInterval(() => {
        try {
            const distance = Math.sqrt(
                Math.pow(player.location.x - routePointLocation.x, 2) +
                Math.pow(player.location.y - routePointLocation.y, 2) +
                Math.pow(player.location.z - routePointLocation.z, 2)
            );

            if (distance > 20) {
                try {
                    player.runCommand(`camera @s clear`);
                } catch (e) {
                }
                stopRoutePointCameraTracking(player.id);
            }
        } catch (e) {
            stopRoutePointCameraTracking(player.id);
        }
    }, 20);

    routePointPreviewIntervals.set(player.id, checkInterval);
}

function startRotationPreview(player, location, dimensionId, rotationDegrees) {
    stopRotationPreview(player);

    const dim = player?.dimension ?? getDimensionFromId(dimensionId);
    const yaw = ((rotationDegrees % 360) + 360) % 360;
    const rad = (yaw * Math.PI) / 180;
    const dirX = -Math.sin(rad);
    const dirZ = Math.cos(rad);

    let ticks = 0;
    const maxTicks = 60;
    const particleStep = 0.55;
    const length = 5;

    const handle = system.runInterval(() => {
        ticks += 2;
        if (ticks > maxTicks) {
            stopRotationPreview(player);
            return;
        }

        try {
            const baseX = Math.floor(location.x) + 0.5;
            const baseY = Math.floor(location.y);
            const baseZ = Math.floor(location.z) + 0.5;

            for (let i = 1; i <= length; i++) {
                const px = baseX + dirX * i * particleStep;
                const pz = baseZ + dirZ * i * particleStep;
                dim.spawnParticle("fr:raytest", { x: px, y: baseY + 0.65, z: pz });
            }
        } catch { }
    }, 2);

    rotationPreviewIntervals.set(player.id, handle);
}

function rotationValueToDegrees(value) {
    const n = Number(value) || 0;
    if (Math.abs(n) <= Math.PI * 2 + 0.001) {
        return ((Math.round((n * 180) / Math.PI) % 360) + 360) % 360;
    }
    return ((Math.round(n) % 360) + 360) % 360;
}

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

const MOVE_SPEED = 0.1;

const PATH_DRAW_INTERVAL = 2;

const MAX_PATH_SEARCH = 12000;

export function walkEntityTo(
    entity,
    targetLocation,
    onArrival,
    onNoPath = null,
    options = {},
) {
    try {
        const dimension = entity.dimension;

        if (walkingEntities.has(entity.id)) {
            walkingEntities.delete(entity.id);
        }

        try {
            entity.removeTag("returning_home");
        } catch { }
        try {
            entity.removeTag("fr_no_attack");
        } catch { }

        entity.addTag("returning_home");
        entity.addTag("fr_no_attack");
        entity.triggerEvent("bonnie_return_home");

        const startPos = {
            x: Math.floor(entity.location.x),
            y: Math.round(entity.location.y),
            z: Math.floor(entity.location.z),
        };
        const endPos = {
            x: Math.floor(targetLocation.x),
            y: Math.floor(targetLocation.y),
            z: Math.floor(targetLocation.z),
        };

        const path = findPathBFS(dimension, startPos, endPos);

        if (path.length > 0) {
            const firstPoint = path[0];
            const distToFirst = Math.sqrt(
                Math.pow(entity.location.x - (firstPoint.x + 0.5), 2) +
                Math.pow(entity.location.z - (firstPoint.z + 0.5), 2),
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
            currentZ: entity.location.z,
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
        f: heuristic(actualStart),
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
        { dx: -1, dz: -1, cost: 1.4 },
    ];

    let iterations = 0;

    let closestPos = actualStart;
    let closestDist =
        Math.abs(actualStart.x - end.x) + Math.abs(actualStart.z - end.z);
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
                        if (
                            !isPositionWalkable(dimension, pos.x + dir.dx, pos.y, pos.z) ||
                            !isPositionWalkable(dimension, pos.x, pos.y, pos.z + dir.dz)
                        ) {
                            continue;
                        }
                    }

                    const blockAtFeet = dimension.getBlock({
                        x: newX,
                        y: pos.y,
                        z: newZ,
                    });
                    const blockAtHead = dimension.getBlock({
                        x: newX,
                        y: pos.y + 1,
                        z: newZ,
                    });

                    if (blockAtFeet && blockAtHead) {
                        const feetType = blockAtFeet.typeId;
                        const headType = blockAtHead.typeId;

                        const isBlockPassable = (t) => {
                            if (
                                t === "minecraft:air" ||
                                t === "minecraft:cave_air" ||
                                t === "minecraft:water"
                            )
                                return true;
                            if (
                                t.includes("short_grass") ||
                                t.includes("tall_grass") ||
                                t.includes("fern")
                            )
                                return true;

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

    const startDist =
        Math.abs(actualStart.x - end.x) + Math.abs(actualStart.z - end.z);
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
    console.warn(
        `[Pathfinding] A* search exhausted after ${iterations} iterations, no valid path`,
    );
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
                        dim.spawnParticle("fr:raytest", {
                            x: point.x + 0.5,
                            y: point.y + 0.5,
                            z: point.z + 0.5,
                        });
                        dim.spawnParticle("fr:raytest", {
                            x: point.x + 0.5,
                            y: point.y + 1.0,
                            z: point.z + 0.5,
                        });
                        dim.spawnParticle("fr:raytest", {
                            x: point.x + 0.5,
                            y: point.y + 1.5,
                            z: point.z + 0.5,
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
                try {
                    entity.removeTag("returning_home");
                } catch { }
                try {
                    entity.removeTag("fr_no_attack");
                } catch { }

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
                { rotation: { x: 0, y: rotationY } },
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

        const solidGround =
            belowType !== "minecraft:air" &&
            belowType !== "minecraft:water" &&
            belowType !== "minecraft:cave_air" &&
            belowType !== "minecraft:lava";

        if (!solidGround) return false;

        const isPassable = (type) => {
            if (type === "minecraft:air" || type === "minecraft:cave_air")
                return true;

            if (type.includes("grass_block") || type.includes("dirt")) return false;

            if (type.startsWith("fr:") && type.includes("door")) return true;

            if (
                type.includes("door") ||
                type.includes("gate") ||
                type.includes("sign") ||
                type.includes("torch") ||
                type.includes("flower") ||
                type.includes("short_grass") ||
                type.includes("tall_grass") ||
                type.includes("fern") ||
                type.includes("pressure") ||
                type.includes("button") ||
                type.includes("lantern") ||
                type.includes("candle") ||
                type.includes("rail") ||
                type.includes("redstone") ||
                type.includes("vine") ||
                type.includes("moss_carpet") ||
                (type.includes("carpet") && !type.includes("confetti"))
            ) {
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
            const blockBelow = dimension.getBlock({
                x: Math.floor(x),
                y: y - 1,
                z: Math.floor(z),
            });
            const blockAt = dimension.getBlock({
                x: Math.floor(x),
                y: y,
                z: Math.floor(z),
            });

            if (blockBelow && blockAt) {
                const belowType = blockBelow.typeId;
                const atType = blockAt.typeId;

                if (
                    belowType !== "minecraft:air" &&
                    belowType !== "minecraft:water" &&
                    (atType === "minecraft:air" ||
                        atType.includes("door") ||
                        atType.includes("gate"))
                ) {
                    return y;
                }
            }
        }

        for (let y = Math.floor(currentY) + 1; y <= currentY + 2; y++) {
            const blockBelow = dimension.getBlock({
                x: Math.floor(x),
                y: y - 1,
                z: Math.floor(z),
            });
            const blockAt = dimension.getBlock({
                x: Math.floor(x),
                y: y,
                z: Math.floor(z),
            });

            if (blockBelow && blockAt) {
                const belowType = blockBelow.typeId;
                const atType = blockAt.typeId;

                if (
                    belowType !== "minecraft:air" &&
                    belowType !== "minecraft:water" &&
                    (atType === "minecraft:air" ||
                        atType.includes("door") ||
                        atType.includes("gate"))
                ) {
                    return y;
                }
            }
        }
    } catch (e) { }

    return currentY;
}

function transformToAnimatronic(statue) {
    try {
        const statueId = statue.id;
        const state = entityStates.get(statueId) || {
            rotation: 0,
            poseIndex: 0,
            variantIndex: 0,
        };
        const dimension = statue.dimension;

        const entityRot = statue.getRotation();
        const savedRotation =
            state.rotation !== undefined
                ? state.rotation
                : normalizeRotation(entityRot.y);

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
            waypointStatueId: waypointStatueId,
        };

        const animatronic = dimension.spawnEntity(
            "fr:fnaf1_bonnie_entity",
            spawnLocation,
        );

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
                    console.warn(
                        `[NightMode] Failed to apply variant to animatronic: ${e}`,
                    );
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
            console.warn(
                `[NightMode] No statue data found for animatronic ${animatronicId}`,
            );
            return;
        }

        const dimension = animatronic.dimension;

        const savedRotation =
            statueData.rotation !== undefined
                ? statueData.rotation
                : normalizeRotation(animatronic.getRotation().y);

        const returnLocation = statueData.platformLocation || animatronic.location;

        const statue = dimension.spawnEntity("fr:bonnie_statue", returnLocation);
        try {
            statue.addTag("fr_skip_place");
        } catch { }

        if (statueData.waypointStatueId > 0) {
            statue.setDynamicProperty("fr:statue_id", statueData.waypointStatueId);
        }

        if (statueData.platformLocation) {
            try {
                statue.setDynamicProperty(
                    "fr:platform_location",
                    JSON.stringify(statueData.platformLocation),
                );
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
                        if (typeof statue.isValid === "function") valid = statue.isValid();
                        else if (statue.isValid !== undefined) valid = statue.isValid;
                        else valid = true;
                    }

                    if (!valid) {
                    }

                    try {
                        statue.teleport(statue.location, {
                            rotation: { x: 0, y: finalRotation },
                        });
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
            platformLocation: statueData.platformLocation,
        };
        entityStates.set(statue.id, newState);
        nightModeStatues.set(statue.id, {
            ...newState,
            location: returnLocation,
            dimensionId: dimension.id,
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
            const platformData = animatronic.getDynamicProperty(
                "fr:platform_location",
            );
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
                waypointStatueId: waypointId,
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
            waypointStatueId: waypointId,
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









    return;


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
        clearRoute: hasWaypoints,
    };
}

export async function showNightModeActivationMenu(player, entity) {
    const entityId = entity.id;
    const isEnabled = entity.getDynamicProperty("fr:night_mode_enabled") === true;

    const state = entityStates.get(entityId) || {
        rotation: 0,
        poseIndex: 0,
        variantIndex: 0,
        nightMode: isEnabled,
    };
    state.nightMode = isEnabled;
    entityStates.set(entityId, state);
    const statueId =
        entity.getDynamicProperty("fr:statue_id") || getOrCreateStatueId(entity);

    const form = new MessageFormData()
        .title("§l§6NIGHT MODE")
        .body(
            `§7Do you want to activate Night Mode for this animatronic?\n\n§7When activated, the animatronic will:\n§a• Follow configured routes at night\n§a• Return to platform during day\n\n§7Current Status: ${state.nightMode ? "§aEnabled" : "§cDisabled"}`,
        )
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

    let isEnabled = entity.getDynamicProperty("fr:night_mode_enabled") === true;

    try {
        const animatronicId = getOrCreateAnimatronicId(entity);
        if (nightModeRegistry.has(animatronicId)) {
            const regData = nightModeRegistry.get(animatronicId);
            if (regData && regData.enabled) {
                isEnabled = true;
                if (entity.isValid()) {
                    entity.setDynamicProperty("fr:night_mode_enabled", true);
                }
            }
        }
    } catch (e) {
        console.warn("[NightMode] Error checking registry:", e);
    }

    const state = entityStates.get(entityId) || {
        rotation: 0,
        poseIndex: 0,
        variantIndex: 0,
        nightMode: isEnabled,
    };
    state.nightMode = isEnabled;
    entityStates.set(entityId, state);
    const statueId =
        entity.getDynamicProperty("fr:statue_id") || getOrCreateStatueId(entity);
    const menuOptions = getNightModeMenuOptions(entity);
    const waypointCount = getWaypointsForStatue(statueId).length;

    let entityName =
        entity.nameTag || entity.typeId.replace("fr:", "").replace(/_/g, " ");
    entityName = entityName.charAt(0).toUpperCase() + entityName.slice(1);

    const form = new ActionFormData()
        .title("§l§6NIGHT MODE")
        .body(
            `§7Entity: §a${entityName}\n§7Statue ID: §e${statueId}\n§7Waypoints: §f${waypointCount}\n§7Status: ${state.nightMode ? "§aEnabled" : "§cDisabled"}`,
        );

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
                    const startTest = () => {
                        const sessionId = startRouteTest(entity, player);
                        if (!sessionId) {
                            system.run(() => showNightModeMenu(player, entity));
                        }
                    };
                    const viewing =
                        isPlayerInCamera(player.id) ||
                        player.getDynamicProperty("fr:viewing_camera_pos") !== undefined;
                    if (viewing) {
                        try {
                            securityCameraSystem.exitView(player);
                        } catch { }
                        system.runTimeout(() => startTest(), 12);
                    } else {
                        startTest();
                    }
                } else {
                    player.sendMessage(

                        dynamicToast(

                            "§l§4ERROR",

                            "§cNo waypoints to test!",

                            "textures/fr_ui/deny_icon",

                            "textures/fr_ui/deny_ui"

                        )

                    )
                    system.run(() => showNightModeMenu(player, entity));
                }
                break;

            case "makeRoute":
                const success = startBlockSelectorMode(player, statueId, entityName);
                if (success) {
                    player.sendMessage(

                        dynamicToast(

                            "§l§qSUCCESS",

                            "§7Route creation mode activated!",

                            "textures/fr_ui/approve_icon",

                            "textures/fr_ui/approve_ui"

                        )

                    )
                    player.sendMessage(

                        dynamicToast(

                            "§l§bINFO",

                            "§7Look at blocks and use the repairman item to place waypoints.",

                            "textures/fr_ui/selection_icon",

                            "textures/fr_ui/default_ui"

                        )

                    )
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
                    player.sendMessage(

                        dynamicToast(

                            "§l§4ERROR",

                            "§cDisabled - Animatronic will stay as statue",

                            "textures/fr_ui/deny_icon",

                            "textures/fr_ui/deny_ui"

                        )

                    )
                } else {
                    enableNightMode(entity);
                    player.sendMessage(

                        dynamicToast(

                            "§l§qSUCCESS",

                            "§7Enabled - Animatronic will activate at night",

                            "textures/fr_ui/approve_icon",

                            "textures/fr_ui/approve_ui"

                        )

                    )
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
        player.sendMessage(

            dynamicToast(

                "§l§4ERROR",

                "§cNo statue ID configured!",

                "textures/fr_ui/deny_icon",

                "textures/fr_ui/deny_ui"

            )

        )
        system.run(() => showNightModeMenu(player, entity));
        return;
    }

    const waypoints = getWaypointsForStatue(statueId);

    if (waypoints.length === 0) {
        player.sendMessage(

            dynamicToast(

                "§l§4ERROR",

                "§cNo waypoints to edit!",

                "textures/fr_ui/deny_icon",

                "textures/fr_ui/deny_ui"

            )

        )
        system.run(() => showNightModeMenu(player, entity));
        return;
    }

    const form = new ActionFormData()
        .title("EDIT WAYPOINTS")
        .body(
            `Select a waypoint to edit:\nTotal: §f${waypoints.length} waypoints`,
        );

    for (const wp of waypoints) {
        const posStr = `(${Math.floor(wp.location.x)}, ${Math.floor(wp.location.y)}, ${Math.floor(wp.location.z)})`;
        form.button(`WP #${wp.order} ${posStr}`);
    }

    form.button("Back");

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
            system.run(() => showWaypointActionMenu(player, entity, selectedWp));
        }
    } catch (e) {
        console.warn("[NightMode] Error showing waypoint list:", e);
    }
}

async function showWaypointActionMenu(player, entity, waypoint) {
    const posStr = `(${Math.floor(waypoint.location.x)}, ${Math.floor(waypoint.location.y)}, ${Math.floor(waypoint.location.z)})`;
    const form = new ActionFormData()
        .title(`§eWaypoint #${waypoint.order}`)
        .body(`Position: ${posStr}\nRotation: §f${waypoint.rotation || 0}°`)
        .button("Edit Waypoint")
        .button("Rotation Preview")
        .button("Back");
    try {
        const response = await form.show(player);
        if (response.canceled || response.selection === 2) {
            system.run(() => showWaypointListMenu(player, entity));
            return;
        }
        if (response.selection === 0) {
            system.run(() => showWaypointConfigurationForm(player, entity, waypoint));
            return;
        }
        if (response.selection === 1) {
            system.run(() => showWaypointRotationPreviewMenu(player, entity, waypoint));
            return;
        }
    } catch (e) {
        console.warn("[NightMode] Error showing waypoint action menu:", e);
        system.run(() => showWaypointListMenu(player, entity));
    }
}

async function showWaypointRotationPreviewMenu(player, entity, waypoint) {
    let rotation = (waypoint.rotation || 0) % 360;
    if (rotation < 0) rotation += 360;

    const dimId = waypoint.dimensionId || entity.dimension.id;
    startRotationPreview(player, waypoint.location, dimId, rotation);

    const form = new ActionFormData()
        .title(`Rotation Preview`)
        .body(`Waypoint #${waypoint.order}\n§7Rotation: §f${rotation}°\n\n§7Use the buttons to adjust. Particles show the facing direction.`)
        .button("-90°")
        .button("-15°")
        .button("+15°")
        .button("+90°")
        .button("Save")
        .button("Back");

    try {
        const response = await form.show(player);
        stopRotationPreview(player);

        if (response.canceled || response.selection === 5) {
            system.run(() => showWaypointActionMenu(player, entity, waypoint));
            return;
        }

        if (response.selection === 0) rotation = (rotation + 270) % 360;
        else if (response.selection === 1) rotation = (rotation + 345) % 360;
        else if (response.selection === 2) rotation = (rotation + 15) % 360;
        else if (response.selection === 3) rotation = (rotation + 90) % 360;
        else if (response.selection === 4) {
            const current = getWaypointData(waypoint.location, waypoint.dimensionId) || {};
            const updated = {
                ...current,
                order: waypoint.order,
                linkedStatueId: current.linkedStatueId ?? entity.getDynamicProperty("fr:statue_id"),
                rotation: rotation,
            };
            setWaypointData(waypoint.location, waypoint.dimensionId, updated);
            refreshWaypointCache(updated.linkedStatueId);
            player.sendMessage(

                dynamicToast(

                    "§l§qSUCCESS",

                    `§7Rotation saved: §f${rotation}°`,

                    "textures/fr_ui/approve_icon",

                    "textures/fr_ui/approve_ui"

                )

            )
            waypoint.rotation = rotation;
            system.run(() => showWaypointActionMenu(player, entity, waypoint));
            return;
        }

        system.run(() => showWaypointRotationPreviewMenu(player, entity, { ...waypoint, rotation }));
    } catch (e) {
        stopRotationPreview(player);
        system.run(() => showWaypointActionMenu(player, entity, waypoint));
    }
}

async function showWaypointConfigurationForm(player, entity, waypoint) {
    const statueId = entity.getDynamicProperty("fr:statue_id");
    const poses = getEntityPoses(entity);

    const poseOptions = poses.map((pose, index) => {
        const name = pose.name.replace("", "");
        return `${index}: ${name}`;
    });

    const abilityOptions = ["None", "Camera Blackout", "Camera Switch"];

    const currentAbilities = waypoint.abilities || [];
    let currentAbilityIndex = 0;
    if (currentAbilities.some((a) => a.type === ABILITY_TYPES.CAMERA_BLACKOUT)) {
        currentAbilityIndex = 1;
    } else if (currentAbilities.some((a) => a.type === "camera_switch")) {
        currentAbilityIndex = 2;
    }

    const currentDurationSeconds = Math.floor(
        (waypoint.waitTime || DEFAULT_WAIT_TIME) / 20,
    );

    const minDurationSeconds = Math.floor(MIN_WAIT_TIME / 20);
    const maxDurationSeconds = Math.floor(MAX_WAIT_TIME / 20);
    const clampedDuration = Math.max(
        minDurationSeconds,
        Math.min(maxDurationSeconds, currentDurationSeconds),
    );

    const posStr = `(${Math.floor(waypoint.location.x)}, ${Math.floor(waypoint.location.y)}, ${Math.floor(waypoint.location.z)})`;

    const form = new ModalFormData()
        .title(`§l§eWaypoint #${waypoint.order}`)
        .dropdown("§7Pose", poseOptions, waypoint.pose || 0)
        .dropdown("§7Ability", abilityOptions, currentAbilityIndex)
        .slider(
            "§7Duration (seconds)",
            minDurationSeconds,
            maxDurationSeconds,
            10,
            clampedDuration,
        )
        .slider("§7Rotation (degrees)", 0, 360, 15, waypoint.rotation || 0)
        .toggle("§cDelete Waypoint", false);

    try {
        const dim = getDimensionFromId(waypoint.dimensionId || entity.dimension.id);
        const block = dim.getBlock(waypoint.location);
        if (block && block.typeId === "fr:route_point") {
            const isVisible = block.permutation.getState("fr:visible") ?? true;
            form.toggle("§7Visible", isVisible);
        }
    } catch (e) { }

    try {
        startRotationPreview(
            player,
            waypoint.location,
            waypoint.dimensionId || entity.dimension.id,
            waypoint.rotation || 0,
        );
        const response = await form.show(player);
        stopRotationPreview(player);

        if (response.canceled) {
            system.run(() => showWaypointListMenu(player, entity));
            return;
        }

        let poseIndex, abilityIndex, durationSeconds, rotation, shouldDelete, isVisible;
        const values = response.formValues;

        // Check if visible toggle was added (it depends on if block was found)
        // The form order is: pose, ability, duration, rotation, delete, [visible]
        // So if length is 6, visible is index 5.

        poseIndex = values[0];
        abilityIndex = values[1];
        durationSeconds = values[2];
        rotation = values[3];
        shouldDelete = values[4];

        if (values.length > 5) {
            isVisible = values[5];

            try {
                const dim = getDimensionFromId(waypoint.dimensionId || entity.dimension.id);
                const block = dim.getBlock(waypoint.location);
                if (block && block.typeId === "fr:route_point") {
                    const newPerm = block.permutation.withState("fr:visible", isVisible);
                    block.setPermutation(newPerm);
                }
            } catch (e) { }
        }

        if (shouldDelete) {
            system.run(() =>
                showDeleteWaypointConfirmation(player, entity, waypoint),
            );
            return;
        }

        const durationTicks = validateDuration(durationSeconds * 20);

        const newAbilities = [];
        if (abilityIndex === 1) {
            newAbilities.push({
                type: ABILITY_TYPES.CAMERA_BLACKOUT,
                duration: 5,
            });
        } else if (abilityIndex === 2) {
            newAbilities.push({
                type: "camera_switch",
                targetCameraId: null,
            });
        }

        const updatedConfig = {
            order: waypoint.order,
            pose: poseIndex,
            rotation: rotation,
            waitTime: durationTicks,
            linkedStatueId: statueId,
            abilities: newAbilities,
        };

        setWaypointData(waypoint.location, waypoint.dimensionId, updatedConfig);
        refreshWaypointCache(statueId);

        startRotationPreview(
            player,
            waypoint.location,
            waypoint.dimensionId || entity.dimension.id,
            rotation || 0,
        );

        const poseName =
            poses[poseIndex]?.name.replace("", "") || `pose_${poseIndex}`;
        const abilityName = abilityOptions[abilityIndex];
        player.sendMessage(

            dynamicToast(

                "§l§qSUCCESS",

                `§7Waypoint #${waypoint.order} updated:`,

                "textures/fr_ui/approve_icon",

                "textures/fr_ui/approve_ui"

            )

        )
        player.sendMessage(

            dynamicToast(

                "§l§bINFO",

                `§7  Pose: §f${poseName}`,

                "textures/fr_ui/selection_icon",

                "textures/fr_ui/default_ui"

            )

        )
        player.sendMessage(

            dynamicToast(

                "§l§bINFO",

                `§7  Ability: §f${abilityName}`,

                "textures/fr_ui/selection_icon",

                "textures/fr_ui/default_ui"

            )

        )
        player.sendMessage(

            dynamicToast(

                "§l§bINFO",

                `§7  Duration: §f${durationSeconds}s`,

                "textures/fr_ui/selection_icon",

                "textures/fr_ui/default_ui"

            )

        )

        system.run(() => showWaypointListMenu(player, entity));
    } catch (e) {
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
        .body(
            `§7Are you sure you want to delete waypoint #${waypoint.order}?\n\n§7Position: §f${posStr}\n\n§cThis action cannot be undone!`,
        )
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

        player.sendMessage(


            dynamicToast(


                "§l§4ERROR",


                `§cDeleted waypoint #${waypoint.order}`,


                "textures/fr_ui/deny_icon",


                "textures/fr_ui/deny_ui"


            )


        )
        system.run(() => showWaypointListMenu(player, entity));
    } catch (e) {
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
        .body(
            `§7Are you sure you want to clear all §c${waypointCount}§7 waypoints?\n\n§cThis action cannot be undone!`,
        )
        .button1("§cYes, Clear All")
        .button2("§7Cancel");

    try {
        const response = await form.show(player);

        if (response.canceled || response.selection === 0) {
            system.run(() => showNightModeMenu(player, entity));
            return;
        }

        clearAllWaypointsForStatue(statueId);
        player.sendMessage(

            dynamicToast(

                "§l§4ERROR",

                `§cCleared ${waypointCount} waypoints`,

                "textures/fr_ui/deny_icon",

                "textures/fr_ui/deny_ui"

            )

        )
        system.run(() => showNightModeMenu(player, entity));
    } catch (e) {
    }
}

function enableNightMode(entity) {
    const statueId = entity.id;

    const state = entityStates.get(statueId) || {
        rotation: 0,
        poseIndex: 0,
        variantIndex: 0,
    };

    const entityRotation = entity.getRotation();
    const rawRotation = entityRotation ? entityRotation.y : state.rotation || 0;
    const normalizedRot = normalizeRotation(rawRotation);

    state.nightMode = true;
    state.rotation = normalizedRot;
    entityStates.set(statueId, state);
    entity.setDynamicProperty("fr:night_mode_enabled", true);

    const platformLoc = entity.getDynamicProperty("fr:platform_location");

    nightModeStatues.set(statueId, {
        location: {
            x: entity.location.x,
            y: entity.location.y,
            z: entity.location.z,
        },
        rotation: normalizedRot,
        poseIndex: state.poseIndex || 0,
        variantIndex: state.variantIndex || 0,
        dimensionId: entity.dimension.id,
        nightMode: true,
        platformLocation: platformLoc || state.platformLocation || null,
    });


    try {
        entity.setDynamicProperty("fr:pose_index", state.poseIndex || 0);
        entity.setDynamicProperty("fr:variant_index", state.variantIndex || 0);
    } catch { }

    try {
        enableNightModePathing(entity);
        console.log(
        );
    } catch (e) {
    }
}

function disableNightMode(entity) {
    const statueId = entity.id;
    const state = entityStates.get(statueId);
    if (state) {
        state.nightMode = false;
        entityStates.set(statueId, state);
    }
    entity.setDynamicProperty("fr:night_mode_enabled", false);

    nightModeStatues.delete(statueId);


    disableNightModePathing(entity);
}

function startLinkingMode(player, entity) {
    playerLinkingMode.set(player.id, {
        entityId: entity.id,
        entityType: entity.typeId,
        entityLocation: {
            x: entity.location.x,
            y: entity.location.y,
            z: entity.location.z,
        },
    });
    player.sendMessage(

        dynamicToast(

            "§l§eINFO",

            "§e[Link Mode] §7Click on a §efr:platform§7 block to link this animatronic",

            "textures/fr_ui/selection_icon",

            "textures/fr_ui/unlinked_ui"

        )

    )
    player.sendMessage(

        dynamicToast(

            "§l§bINFO",

            "§7The animatronic will wake up from there at night and return during the day",

            "textures/fr_ui/selection_icon",

            "textures/fr_ui/default_ui"

        )

    )
}

function cancelLinkingMode(player) {
    if (playerLinkingMode.has(player.id)) {
        playerLinkingMode.delete(player.id);
        player.sendMessage(

            dynamicToast(

                "§l§4ERROR",

                "§c[Link Mode] §7Cancelled",

                "textures/fr_ui/deny_icon",

                "textures/fr_ui/deny_ui"

            )

        )
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
        player.sendMessage(

            dynamicToast(

                "§l§4ERROR",

                "§c[Link Mode] §7Entity not found - it may have been removed",

                "textures/fr_ui/deny_icon",

                "textures/fr_ui/deny_ui"

            )

        )
        playerLinkingMode.delete(player.id);
        return false;
    }

    const state = entityStates.get(targetEntity.id) || {
        rotation: 0,
        poseIndex: 0,
        variantIndex: 0,
    };

    const entityRotation = targetEntity.getRotation();
    const rawRotation = entityRotation ? entityRotation.y : state.rotation || 0;
    const normalizedRot = normalizeRotation(rawRotation);

    const platformLocation = {
        x: block.location.x + 0.5,
        y: block.location.y + 1,
        z: block.location.z + 0.5,
        dimensionId: dimension.id,
    };
    state.platformLocation = platformLocation;
    state.nightMode = true;
    state.rotation = normalizedRot;
    entityStates.set(targetEntity.id, state);

    try {
        targetEntity.setDynamicProperty(
            "fr:platform_location",
            JSON.stringify(platformLocation),
        );
    } catch (e) {
    }
    try {
        targetEntity.addTag("fr_linked_platform");
    } catch { }

    nightModeStatues.set(targetEntity.id, {
        location: platformLocation,
        rotation: normalizedRot,
        poseIndex: state.poseIndex || 0,
        variantIndex: state.variantIndex || 0,
        dimensionId: dimension.id,
        nightMode: true,
        platformLocation: platformLocation,
    });

    try {
        block.setPermutation(block.permutation.withState("fr:linked", true));
    } catch { }

    try {
        targetEntity.teleport(platformLocation);
    } catch { }

    player.sendMessage(
        `§a[Link Mode] §7Successfully linked to platform at §e${Math.floor(platformLocation.x)}, ${Math.floor(platformLocation.y)}, ${Math.floor(platformLocation.z)}`,
    );
    player.sendMessage(

        dynamicToast(

            "§l§qSUCCESS",

            "§7Night mode has been §aenabled§7 - animatronic will activate at night!",

            "textures/fr_ui/approve_icon",

            "textures/fr_ui/approve_ui"

        )

    )

    playerLinkingMode.delete(player.id);
    return true;
}

function unlinkFromPlatform(entity) {
    const state = entityStates.get(entity.id);
    if (state && state.platformLocation) {
        try {
            const dimension = entity.dimension;
            const platformLoc = state.platformLocation;
            const block = dimension.getBlock({
                x: Math.floor(platformLoc.x),
                y: Math.floor(platformLoc.y) - 1,
                z: Math.floor(platformLoc.z),
            });
            if (block && block.typeId === "fr:platform") {
                block.setPermutation(block.permutation.withState("fr:linked", false));
            }
        } catch { }

        state.platformLocation = null;
        entityStates.set(entity.id, state);
        try {
            entity.setDynamicProperty("fr:platform_location", undefined);
        } catch { }
    }
    try {
        entity.removeTag("fr_linked_platform");
    } catch { }
}

export function showStatueEditor(player, entity) {
    const entityId = entity.id;
    const poses = getEntityPoses(entity);

    if (!entityStates.has(entityId)) {
        entityStates.set(entityId, {
            rotation: 0,
            poseIndex: 0,
        });
    }

    const state = entityStates.get(entityId);
    const currentPose = poses[state.poseIndex] || poses[0];

    const form = new ActionFormData().title("§S§T§A§T§U§E");

    form.button("-");
    form.button("+");
    form.button("◀");
    form.button("▶");
    form.button(`se:rot_§]§8${state.rotation}`);
    form.button(`se:anim_§]§8${currentPose.name}`);

    form
        .show(player)
        .then((response) => {
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
        })
        .catch(() => { });
}

function applyRotation(entity, rotation) {
    try {
        const yaw = rotation * (Math.PI / 180);
        entity.setRotation({ x: 0, y: rotation });
    } catch (e) {
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

        player.runCommand(
            `camera @s set minecraft:free ease 0.3 linear pos ${cameraX.toFixed(2)} ${cameraY.toFixed(2)} ${cameraZ.toFixed(2)} facing ${lookX.toFixed(2)} ${(entityLoc.y + 1).toFixed(2)} ${lookZ.toFixed(2)}`,
        );
    } catch (e) {
    }
}

function updateRoutePointCamera(player, routePointLocation, rotation = 0) {
    try {
        const blockLoc = {
            x: Math.floor(routePointLocation.x) + 0.5,
            y: Math.floor(routePointLocation.y),
            z: Math.floor(routePointLocation.z) + 0.5
        };

        const rotationDegrees = typeof rotation === 'number' ? rotation : rotationValueToDegrees(rotation);
        const yawRad = (rotationDegrees * Math.PI) / 180;

        const cameraDistance = 4;
        const cameraHeight = 2.5;
        const cameraX = blockLoc.x - Math.sin(yawRad) * cameraDistance;
        const cameraY = blockLoc.y + cameraHeight;
        const cameraZ = blockLoc.z + Math.cos(yawRad) * cameraDistance;

        const lookOffset = -1.5;
        const lookX = blockLoc.x - Math.cos(yawRad) * lookOffset;
        const lookZ = blockLoc.z - Math.sin(yawRad) * lookOffset;

        player.runCommand(
            `camera @s set minecraft:free ease 0.3 linear pos ${cameraX.toFixed(2)} ${cameraY.toFixed(2)} ${cameraZ.toFixed(2)} facing ${lookX.toFixed(2)} ${(blockLoc.y + 0.5).toFixed(2)} ${lookZ.toFixed(2)}`,
        );
    } catch (e) {
        console.warn("Error updating route point camera:", e);
    }
}

function applyPose(entity, poseIndex) {
    try {
        const poses = getEntityPoses(entity);
        entity.triggerEvent(`fr:set_pose_${poseIndex}`);

        entity.setDynamicProperty("fr:pose_index", poseIndex);
    } catch (e) {
    }
}

let initialized = false;
const processedTickInteractions = new Set();

export function initStatueEditorSystem() {
    if (initialized) return;
    initialized = true;


    system.runInterval(() => {
        processedTickInteractions.clear();
    }, 1);

    world.afterEvents.playerInteractWithEntity.subscribe((event) => {

        const interactionKey = `${event.player.id}_${event.target.id}`;
        if (processedTickInteractions.has(interactionKey)) return;
        processedTickInteractions.add(interactionKey);

        const { player, target } = event;
        const equippable = player.getComponent("minecraft:equippable");
        let heldItem = equippable?.getEquipment(EquipmentSlot.Mainhand);

        if (!heldItem) {
            const inventory = player.getComponent("minecraft:inventory");
            const container = inventory?.container;
            if (container) {
                const slot = player.selectedSlotIndex ?? player.selectedSlot;
                if (typeof slot === "number") heldItem = container.getItem(slot);
            }
        }
        if (player.isSneaking && isEntityInRouteTest(target.id)) {
            cancelRouteTestForEntity(target.id);
            return;
        }

        if (
            player.isSneaking &&
            target.hasTag &&
            target.hasTag("fr:route_test_mode")
        ) {
            cancelRouteTestForEntity(target.id);
            return;
        }

        if (target.typeId.includes("_statue") || target.typeId === "fr:endo_01") {
            if (heldItem && heldItem.typeId === "fr:faz-diver_repairman") {

                const selection = getPlayerSelection(player);
                if (selection && selection.selectedStageplateKey) {
                    event.cancel = true;
                    system.run(() => {
                        linkAnimatronicToStageplate(player, target);
                    });
                    return;
                }

                showEntityEditor(player, target, "statue");
                return;
            }
        }


        if (isAnimatronic(target) && !target.typeId.includes("_statue")) {
            if (heldItem && heldItem.typeId === "fr:faz-diver_repairman") {
                const selection = getPlayerSelection(player);
                if (selection && selection.selectedStageplateKey) {
                    event.cancel = true;
                    system.run(() => {
                        linkAnimatronicToStageplate(player, target);
                    });
                    return;
                }
            }
        }
    });

    world.beforeEvents.playerInteractWithBlock.subscribe((event) => {
        const { player, block } = event;


        const blockKey = `${player.id}_b_${block.location.x}_${block.location.y}_${block.location.z}`;
        if (processedTickInteractions.has(blockKey)) return;
        processedTickInteractions.add(blockKey);


        if (block.typeId === "fr:stage_platform") {
            const equip = player.getComponent("equippable");
            const heldItem = equip?.getEquipment(EquipmentSlot.Mainhand);

            if (heldItem && heldItem.typeId === "fr:faz-diver_repairman") {
                event.cancel = true;

                if (player.isSneaking) {
                    system.run(() => showStagePlatformOptions(player, block));
                    return;
                }

                system.run(() => {
                    selectStageplate(player, block.location, player.dimension.id);
                });
                return;
            }
        }

        if (playerLinkingMode.has(player.id)) {
            if (block.typeId === "fr:platform") {
                event.cancel = true;
                system.run(() => {
                    completeLinking(player, block);
                });
            } else {
                system.run(() => {
                    player.sendMessage(

                        dynamicToast(

                            "§l§4ERROR",

                            "§c[Link Mode] §7That's not a platform block. Linking cancelled.",

                            "textures/fr_ui/deny_icon",

                            "textures/fr_ui/deny_ui"

                        )

                    )
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

    system.run(() => { });
}

function getPoseCategory(poseName) {
    const name = poseName.name
        ? poseName.name.toLowerCase()
        : poseName.toLowerCase();
    if (name.includes("blood")) return "blood";
    if (
        name.includes("idle") ||
        name.includes("walk") ||
        name.includes("jumpscare") ||
        name.includes("running")
    )
        return "motion";
    return "base";
}

function getPosesByCategory(poses, category) {
    return poses.filter((p) => getPoseCategory(p) === category);
}

function getVariantCategory(variant) {
    return variant.type || "normal";
}

function getVariantsByCategory(variants, category) {
    return variants.filter((v) => getVariantCategory(v) === category);
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
            if (
                variantProp !== undefined &&
                variantProp >= 0 &&
                variantProp < variants.length
            ) {
                currentVariant = variantProp;
            }
        } catch { }

        let actualRotation = 0;
        try {
            const entityRot = entity.getRotation();
            if (entityRot) actualRotation = normalizeRotation(entityRot.y);
        } catch { }

        let nightModeEnabled = false;
        try {
            nightModeEnabled = entity.getDynamicProperty("fr:night_mode_enabled") === true;
        } catch { }

        let style = 0;
        try {
            style = entity.getDynamicProperty("fr:style") || 0;
            entity.triggerEvent(`fr:set_style_${style}`);
        } catch { }

        entityStates.set(entityId, {
            rotation: actualRotation,
            poseIndex: currentPose,
            variantIndex: currentVariant,
            nightMode: nightModeEnabled,
            style: style,
        });

        playerEditingEntity.set(player.id, entity);
        updateEditorCamera(player, entity);
    }

    playerEditingEntity.set(player.id, entity);

    const state = entityStates.get(entityId);

    if (state.variantIndex >= variants.length) {
        state.variantIndex = 0;
    }

    try {
        state.nightMode = entity.getDynamicProperty("fr:night_mode_enabled") === true;
    } catch {
        if (state.nightMode === undefined) state.nightMode = false;
    }


    let linkedStageplateKey;
    let platformLocation;
    try {
        linkedStageplateKey = entity.getDynamicProperty("fr:linked_stageplate");
    } catch { }
    try {
        platformLocation = entity.getDynamicProperty("fr:platform_location");
    } catch { }
    let hasLinkedTag = false;
    try {
        hasLinkedTag = entity.hasTag("fr_linked_platform");
    } catch { }
    if (!hasLinkedTag && (linkedStageplateKey || platformLocation)) {
        try {
            entity.addTag("fr_linked_platform");
            hasLinkedTag = true;
        } catch { }
    }
    const isLinkedToPlatform =
        hasLinkedTag || !!linkedStageplateKey || !!platformLocation || !!state.platformLocation;
    const routeId = getAnimatronicRouteId(entity);
    const routePoints = routeId ? getRoutePointsForRouteId(routeId) : [];


    let sectionFlag;
    if (section === "variants") sectionFlag = "§s§e§c§:§1";
    else if (section === "poses") sectionFlag = "§s§e§c§:§2";
    else if (section === "routes") sectionFlag = "§s§e§c§:§4";
    else sectionFlag = "§s§e§c§:§3";

    const platformFlag = isLinkedToPlatform ? "§p§l§a§t§:§1" : "§p§l§a§t§:§0";

    const form = new ActionFormData().title(`§S§T§A§T§U§E${sectionFlag}${platformFlag}`);

    form.button("V");
    form.button("P");
    form.button("X");

    form.button("R", "textures/ui/World");

    if (section === "statue") {
        form.button("-");
        form.button("+");
        form.button(">enable<");
        if (isLinkedToPlatform) {
            form.button(state.nightMode ? ">disable<" : ">enable<");
        } else {
            form.button("§v_hide");
        }
        form.button(`${state.rotation}`);
        form.button("SIMULATE");
        if (isLinkedToPlatform) {
            form.button("NIGHT MODE");
        } else {
            form.button("§v_hide");
        }
        if (entity.typeId.includes("freddy") && !entity.typeId.includes("golden")) {
            form.button("style.toggle");
            form.button("Classic");
            form.button("Movie");
        }
    } else if (section === "variants") {
        if (!playerVariantCategory.has(player.id)) {
            const currentVariant = variants[state.variantIndex];
            if (currentVariant) {
                const variantCategory = currentVariant.type || "normal";
                playerVariantCategory.set(player.id, variantCategory);
                const filteredVariants = getVariantsByCategory(
                    variants,
                    variantCategory,
                );
                const idxInFiltered = filteredVariants.indexOf(currentVariant);
                const targetPage =
                    idxInFiltered >= 0
                        ? Math.floor(idxInFiltered / VARIANTS_PER_PAGE)
                        : 0;
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
            form.button(
                isSelected ? `§z${label}` : label,
                `textures/fr_ui/terminal_variants_tab_${i + 1}`,
            );
        });
        form.button("_SPACER_");

        const currentVarPage = playerVariantPage.get(player.id) || 0;
        const totalVarPages = Math.ceil(
            filteredVariants.length / VARIANTS_PER_PAGE,
        );
        const startVarIdx = currentVarPage * VARIANTS_PER_PAGE;
        const pageVariants = filteredVariants.slice(
            startVarIdx,
            startVarIdx + VARIANTS_PER_PAGE,
        );


        for (let i = 0; i < VARIANTS_PER_PAGE; i++) {
            const v = pageVariants[i];
            if (v) {
                const globalIndex = variants.indexOf(v);
                const isCurrentVariant = globalIndex === state.variantIndex;
                form.button(isCurrentVariant ? `§z${v.name}` : v.name, v.icon);
            } else {
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
                const idxInFiltered = filteredPoses.findIndex(
                    (p) => p.name === currentPoseObj.name,
                );
                const targetPage =
                    idxInFiltered >= 0 ? Math.floor(idxInFiltered / POSES_PER_PAGE) : 0;
                playerPosePage.set(player.id, targetPage);
            }
        }

        const currentCategory = playerPoseCategory.get(player.id) || "base";
        const filteredPoses = getPosesByCategory(allPoses, currentCategory);

        POSE_CATEGORIES.forEach((cat, i) => {
            const label = cat.charAt(0).toUpperCase() + cat.slice(1);
            const isSelected = cat === currentCategory;
            form.button(
                isSelected ? `§z${label}` : label,
                `textures/fr_ui/terminal_tab_${i + 1}`,
            );
        });
        form.button(" ");

        const currentPage = playerPosePage.get(player.id) || 0;
        const totalPages = Math.ceil(filteredPoses.length / POSES_PER_PAGE);
        const startIdx = currentPage * POSES_PER_PAGE;
        const pagePoses = filteredPoses.slice(startIdx, startIdx + POSES_PER_PAGE);


        for (let i = 0; i < POSES_PER_PAGE; i++) {
            const p = pagePoses[i];
            if (p) {
                const originalPoseIndex = allPoses.findIndex(
                    (pose) => pose.name === p.name,
                );
                const isCurrentPose = originalPoseIndex === state.poseIndex;
                form.button(isCurrentPose ? `§z${p.name}` : p.name, p.icon);
            } else {
                form.button(" ");
            }
        }

        if (totalPages > 1) {
            form.button(`Prev`);
            form.button(`${currentPage + 1}`);
            form.button(`Next`);
        } else {
            form.button("§v_hide");
            form.button("§v_hide");
            form.button("§v_hide");
        }
    } else if (section === "routes") {

        const animatronicId =
            entity.getDynamicProperty("fr:animatronic_id") || "N/A";
        const aiLevel = getAILevel(entity);
        const aiStats = getAILevelStats(aiLevel);
        const animId = entity.getDynamicProperty("fr:animatronic_id") || entity.id;
        const nightState = getNightPathingState(animId);
        const useRandom =
            nightState?.useRandomOrder ?? NIGHT_MODE_CONFIG.USE_RANDOM_WAYPOINTS;

        form.button(`§0ID: ${animatronicId}`);
        form.button(`§0Route Points: ${routePoints.length}`);
        form.button("Test Routes");
        form.button("Route List");
        form.button("Create Route");
        form.button("Remove All Routes");
        form.button(`AI Level: ${aiStats.difficulty}`);
        form.button(useRandom ? "Random: §qON" : "Random: §cOFF");
        form.button("Change ID");
        form.button("Back");
    }

    form.show(player).then((response) => {
        if (response.canceled) {
            try {
                player.runCommand(`camera @s clear`);
            } catch (e) {
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
                const filteredVariants = getVariantsByCategory(
                    variants,
                    variantCategory,
                );
                const idxInFiltered = filteredVariants.indexOf(currentVariant);
                const targetPage =
                    idxInFiltered >= 0
                        ? Math.floor(idxInFiltered / VARIANTS_PER_PAGE)
                        : 0;
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
                const idxInFiltered = filteredPoses.findIndex(
                    (p) => p.name === currentPoseObj.name,
                );
                const targetPage =
                    idxInFiltered >= 0 ? Math.floor(idxInFiltered / POSES_PER_PAGE) : 0;
                playerPosePage.set(player.id, targetPage);
            } else {
                playerPoseCategory.set(player.id, "base");
                playerPosePage.set(player.id, 0);
            }
            system.run(() => showEntityEditor(player, entity, "poses"));
            return;
        }
        if (sel === 2) {
            system.run(() => showEntityEditor(player, entity, "statue"));
            return;
        }

        if (sel === 3) {
            system.run(() => showEntityEditor(player, entity, "routes"));
            return;
        }

        if (section === "statue") {
            if (sel === 4) {
                state.rotation = (state.rotation - 15 + 360) % 360;
                applyRotation(entity, state.rotation);
                updateEditorCamera(player, entity);
            }
            if (sel === 5) {
                state.rotation = (state.rotation + 15) % 360;
                applyRotation(entity, state.rotation);
                updateEditorCamera(player, entity);
            }
            if (sel === 6) {
                player.runCommand(
                    `tp @s ${entity.location.x} ${entity.location.y} ${entity.location.z}`,
                );
                player.runCommand(`camera @s fade time 0.5 0.5 0.5`);
            }
            if (isLinkedToPlatform && sel === 7) {
                if (state.nightMode) {
                    disableNightMode(entity);
                    player.sendMessage(
                        dynamicToast(
                            "§l§4ERROR",
                            "§cDisabled - Animatronic will stay as statue",
                            "textures/fr_ui/deny_icon",
                            "textures/fr_ui/deny_ui"
                        )
                    )
                } else {
                    const routeId =
                        entity.getDynamicProperty("fr:animatronic_id") ||
                        entity.getDynamicProperty("fr:statue_id");

                    enableNightMode(entity);
                    player.sendMessage(
                        dynamicToast(
                            "§l§qSUCCESS",
                            "§7Enabled - Animatronic will activate at night",
                            "textures/fr_ui/approve_icon",
                            "textures/fr_ui/approve_ui"
                        )
                    )
                }

                try {
                    state.nightMode = entity.getDynamicProperty("fr:night_mode_enabled") === true;
                } catch { }
                entityStates.set(entityId, state);
            }

            if ((isLinkedToPlatform && sel === 8) || (!isLinkedToPlatform && sel === 7)) {
                player.runCommand(
                    `tp @s ${entity.location.x} ${entity.location.y} ${entity.location.z}`,
                );
                player.runCommand(`camera @s fade time 0.5 0.5 0.5`);
            }

            if ((isLinkedToPlatform && sel === 9) || (!isLinkedToPlatform && sel === 8)) {
                const waypointId = entity.getDynamicProperty("fr:statue_id");
                const platformLoc = entity.getDynamicProperty("fr:platform_location");

                if (!waypointId) {
                    player.sendMessage(
                        dynamicToast(
                            "§l§4ERROR",
                            "§c[Simulation] §7No waypoint ID! Use path_marker to link waypoints first.",
                            "textures/fr_ui/deny_icon",
                            "textures/fr_ui/deny_ui"
                        )
                    )
                } else if (!platformLoc) {
                    player.sendMessage(
                        dynamicToast(
                            "§l§4ERROR",
                            "§c[Simulation] §7No platform linked! Use wrench to link a platform first.",
                            "textures/fr_ui/deny_icon",
                            "textures/fr_ui/deny_ui"
                        )
                    )
                } else {
                    return;
                }
            }

            if (isLinkedToPlatform && sel === 10) {
                system.run(() => showNightModeActivationMenu(player, entity));
                return;
            }

            const styleButtonOffset = 11;
            if (sel === styleButtonOffset || sel === styleButtonOffset + 1 || sel === styleButtonOffset + 2) {
                if (entity.typeId.includes("freddy") && !entity.typeId.includes("golden")) {
                    if (sel === styleButtonOffset) {
                        system.run(() => showEntityEditor(player, entity, "statue"));
                        return;
                    }

                    const newStyle = sel === styleButtonOffset + 1 ? 0 : 1;

                    if (state.style !== newStyle) {
                        state.style = newStyle;
                        entity.setDynamicProperty("fr:style", state.style);
                        try {
                            entity.triggerEvent(`fr:set_style_${state.style}`);
                        } catch (e) { }

                        state.poseIndex = 0;
                        state.variantIndex = 0;
                        try {
                            entity.setDynamicProperty("fr:pose_index", 0);
                            entity.setDynamicProperty("fr:variant_index", 0);
                        } catch { }

                        applyPose(entity, 0);
                        applyVariant(entity, 0);

                        player.sendMessage(
                            dynamicToast(
                                "§l§qSUCCESS",
                                `§7Style changed to: ${newStyle === 0 ? "§aClassic" : "§aMovie"}`,
                                "textures/fr_ui/approve_icon",
                                "textures/fr_ui/approve_ui"
                            )
                        )
                    }

                    system.run(() => showEntityEditor(player, entity, "statue"));
                    return;
                }
            }
            system.run(() => showEntityEditor(player, entity, "statue"));
        } else if (section === "variants" && sel >= 4) {
            if (sel >= 4 && sel <= 7) {
                playerVariantCategory.set(player.id, VARIANT_CATEGORIES[sel - 4]);
                playerVariantPage.set(player.id, 0);
                system.run(() => showEntityEditor(player, entity, "variants"));
                return;
            }

            if (sel === 8) return;

            const currentCategory = playerVariantCategory.get(player.id) || "normal";
            const filteredVariants = getVariantsByCategory(variants, currentCategory);

            const currentVarPage = playerVariantPage.get(player.id) || 0;
            const totalVarPages = Math.ceil(
                filteredVariants.length / VARIANTS_PER_PAGE,
            );

            if (sel === 12) {
                if (totalVarPages > 1) {
                    const newPage = (currentVarPage - 1 + totalVarPages) % totalVarPages;
                    playerVariantPage.set(player.id, newPage);
                    system.run(() => showEntityEditor(player, entity, "variants"));
                }
                return;
            }
            if (sel === 14) {
                if (totalVarPages > 1) {
                    const newPage = (currentVarPage + 1) % totalVarPages;
                    playerVariantPage.set(player.id, newPage);
                    system.run(() => showEntityEditor(player, entity, "variants"));
                }
                return;
            }

            const variantIdxInPage = sel - 9;
            if (variantIdxInPage >= 0 && variantIdxInPage < VARIANTS_PER_PAGE) {
                const actualVariantIdx =
                    currentVarPage * VARIANTS_PER_PAGE + variantIdxInPage;
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
        } else if (section === "poses" && sel >= 4) {
            const currentCategory = playerPoseCategory.get(player.id) || "base";
            const allPoses = getEntityPoses(entity);
            const filteredPoses = getPosesByCategory(allPoses, currentCategory);

            const currentPage = playerPosePage.get(player.id) || 0;
            const totalPages = Math.ceil(filteredPoses.length / POSES_PER_PAGE);

            if (sel >= 4 && sel <= 6) {
                const newCat = POSE_CATEGORIES[sel - 4];
                playerPoseCategory.set(player.id, newCat);
                playerPosePage.set(player.id, 0);
                system.run(() => showEntityEditor(player, entity, "poses"));
                return;
            }

            if (sel === 14) {
                const newPage = (currentPage - 1 + totalPages) % totalPages;
                playerPosePage.set(player.id, newPage);
                system.run(() => showEntityEditor(player, entity, "poses"));
                return;
            }

            if (sel === 16) {
                const newPage = (currentPage + 1) % totalPages;
                playerPosePage.set(player.id, newPage);
                system.run(() => showEntityEditor(player, entity, "poses"));
                return;
            }

            const poseIdxInPage = sel - 8;
            if (poseIdxInPage >= 0 && poseIdxInPage < POSES_PER_PAGE) {
                const actualPoseIdxInFiltered =
                    currentPage * POSES_PER_PAGE + poseIdxInPage;
                if (actualPoseIdxInFiltered < filteredPoses.length) {
                    const selectedPose = filteredPoses[actualPoseIdxInFiltered];

                    const originalPoseIndex = allPoses.findIndex(
                        (p) => p.name === selectedPose.name,
                    );
                    if (originalPoseIndex !== -1) {
                        state.poseIndex = originalPoseIndex;
                        applyPose(entity, originalPoseIndex);
                        system.run(() => showEntityEditor(player, entity, "poses"));
                    }
                }
            }
        } else if (section === "routes") {
            const routeBtnOffset = 4;
            const routeBtnIdx = sel - routeBtnOffset;

            if (routeBtnIdx === 0) {

                system.run(() => showEntityEditor(player, entity, "routes"));
            } else if (routeBtnIdx === 1) {

                system.run(() => showEntityEditor(player, entity, "routes"));
            } else if (routeBtnIdx === 2) {

                if (routePoints.length === 0) {
                    player.sendMessage(
                        dynamicToast(
                            "§l§4ERROR",
                            "§c[Routes] §7No route points to test! Create some first.",
                            "textures/fr_ui/deny_icon",
                            "textures/fr_ui/deny_ui"
                        )
                    )
                    system.run(() => showEntityEditor(player, entity, "routes"));
                } else {
                    try {
                        const cleanupCamera = () => {
                            stopRotationPreview(player);
                            stopRoutePointCameraTracking(player.id);
                            try { player.runCommand(`camera @s clear`); } catch { }
                            try { player.runCommand(`camera @s fov_reset`); } catch { }
                            try { player.runCommand(`hud @s reset`); } catch { }
                            try { player.runCommand(`title @s clear`); } catch { }
                            try { player.setDynamicProperty("fr:viewing_camera_pos", undefined); } catch { }
                            try { player.setDynamicProperty("fr:viewing_camera", undefined); } catch { }
                            playerEditingEntity.delete(player.id);
                            entityStates.delete(entityId);
                        };

                        const startTest = () => startCustomRouteTest(entity, player);

                        const viewing =
                            isPlayerInCamera(player.id) ||
                            player.getDynamicProperty("fr:viewing_camera_pos") !== undefined;
                        if (viewing) {
                            try { securityCameraSystem.exitView(player); } catch { }
                        }

                        system.runTimeout(() => cleanupCamera(), 1);
                        system.runTimeout(() => cleanupCamera(), 5);
                        system.runTimeout(() => startTest(), 6);

                    } catch (e) {
                        player.sendMessage(

                            dynamicToast(

                                "§l§4ERROR",

                                "§c[Routes] §7Error starting test. Check content log.",

                                "textures/fr_ui/deny_icon",

                                "textures/fr_ui/deny_ui"

                            )

                        )
                        system.run(() => showEntityEditor(player, entity, "routes"));
                    }
                }
            } else if (routeBtnIdx === 3) {

                system.run(() =>
                    showRouteListMenu(player, entity, routeId, routePoints),
                );
                return;
            } else if (routeBtnIdx === 4) {

                system.run(() => showCreateRouteMenu(player, entity, routeId));
                return;
            } else if (routeBtnIdx === 5) {

                if (routePoints.length > 0) {
                    system.run(() => showConfirmDeleteAllRoutes(player, entity, routeId));
                    return;
                } else {
                    player.sendMessage(

                        dynamicToast(

                            "§l§4ERROR",

                            "§c[Routes] §7No route points to remove.",

                            "textures/fr_ui/deny_icon",

                            "textures/fr_ui/deny_ui"

                        )

                    )
                    system.run(() => showEntityEditor(player, entity, "routes"));
                }
            } else if (routeBtnIdx === 6) {

                system.run(() => showAILevelEditorMenu(player, entity));
            } else if (routeBtnIdx === 7) {

                const animId =
                    entity.getDynamicProperty("fr:animatronic_id") || entity.id;
                let nightState = getNightPathingState(animId);
                if (!nightState) {
                    nightState = {
                        currentWaypointIndex: -1,
                        visitedWaypoints: new Map(),
                        lastMoveTime: Date.now(),
                        state: "idle",
                        useRandomOrder: !NIGHT_MODE_CONFIG.USE_RANDOM_WAYPOINTS,
                    };
                    updateNightPathingState(animId, nightState);
                } else {
                    nightState.useRandomOrder = !nightState.useRandomOrder;
                    updateNightPathingState(animId, {
                        useRandomOrder: nightState.useRandomOrder,
                    });
                }
                player.sendMessage(

                    dynamicToast(

                        "§l§qSUCCESS",

                        nightState.useRandomOrder
                            ? "§e[Routes] §7Random waypoint selection §aenabled"
                            : "§e[Routes] §7Sequential waypoint order §aenabled",

                        "textures/fr_ui/approve_icon",

                        "textures/fr_ui/approve_ui"

                    )

                )
                system.run(() => showEntityEditor(player, entity, "routes"));
            } else if (routeBtnIdx === 8) {

                system.run(() => showChangeAnimatronicIdMenu(player, entity));
            } else if (routeBtnIdx === 9) {

                system.run(() => showEntityEditor(player, entity, "statue"));
            }
        }
    });
}

function getEntityVariants(entity) {
    if (entity.typeId.includes("endo_01")) return VARIANTS_ENDO_01;
    if (entity.typeId.includes("chica")) return VARIANTS_CHICA;
    if (entity.typeId.includes("foxy")) return VARIANTS_FOXY;
    if (entity.typeId.includes("golden_freddy")) return VARIANTS_GOLDEN_FREDDY;
    if (entity.typeId.includes("freddy")) {
        try {
            const style = entity.getDynamicProperty("fr:style") || 0;
            if (style === 1) return VARIANTS_FREDDY_MOVIE;
        } catch { }
        return VARIANTS_FREDDY;
    }
    if (entity.typeId.includes("sparky")) return VARIANTS_SPARKY;
    return VARIANTS_BONNIE;
}

function getEntityPoses(entity) {
    if (entity.typeId.includes("endo_01")) return POSES_ENDO_01;
    if (entity.typeId.includes("chica")) return POSES_CHICA;
    if (entity.typeId.includes("foxy")) return POSES_FOXY;
    if (entity.typeId.includes("golden_freddy")) return POSES_GOLDEN_FREDDY;
    if (entity.typeId.includes("freddy")) {
        try {
            const style = entity.getDynamicProperty("fr:style") || 0;
            if (style === 1) return POSES_FREDDY_MOVIE;
        } catch { }
        return POSES_FREDDY;
    }
    if (entity.typeId.includes("sparky")) return POSES_SPARKY;
    return POSES_BONNIE;
}

function applyVariant(entity, variantIndex) {
    try {
        entity.triggerEvent(`fr:set_variant_${variantIndex}`);

        entity.setDynamicProperty("fr:variant_index", variantIndex);
    } catch (e) {
    }
}






async function showAILevelEditorMenu(player, entity) {
    const currentLevel = getAILevel(entity);
    const stats = getAILevelStats(currentLevel);
    const platformLoc = entity.getDynamicProperty("fr:platform_location");
    let platformStr = "Not linked";

    if (platformLoc) {
        try {
            const loc = JSON.parse(platformLoc);
            platformStr = `${Math.floor(loc.x)}, ${Math.floor(loc.y)}, ${Math.floor(loc.z)}`;
        } catch { }
    }

    const form = new ModalFormData()
        .title("§l§6AI LEVEL")
        .slider(
            `§7Current Level: §e${currentLevel} §7(${stats.difficulty})\n` +
            `§7Speed: §f${(stats.speedMultiplier * 100).toFixed(0)}%\n` +
            `§7Wait Time: §f${(stats.waitTimeMultiplier * 100).toFixed(0)}%\n` +
            `§7Detection: §f${stats.detectionRange.toFixed(1)} blocks\n` +
            `§7Aggression: §f${(stats.aggressionChance * 100).toFixed(0)}%\n\n` +
            `§8Platform: ${platformStr}`,
            AI_LEVEL_CONFIG.MIN_LEVEL,
            AI_LEVEL_CONFIG.MAX_LEVEL,
        );

    try {
        const response = await form.show(player);
        if (response.canceled) {
            system.run(() => showEntityEditor(player, entity, "routes"));
            return;
        }

        const newLevel = response.formValues[0];
        setAILevel(entity, newLevel);

        const newStats = getAILevelStats(newLevel);
        player.sendMessage(
            `§a[AI Level] §7Set to ${newStats.difficulty} §7(Level ${newLevel})`,
        );

        system.run(() => showEntityEditor(player, entity, "routes"));
    } catch (e) {
        system.run(() => showEntityEditor(player, entity, "routes"));
    }
}


function showRouteListMenu(player, entity, routeId, routePoints) {
    if (routePoints.length === 0) {
        player.sendMessage(

            dynamicToast(

                "§l§4ERROR",

                "§c[Routes] §7No route points created yet.",

                "textures/fr_ui/deny_icon",

                "textures/fr_ui/deny_ui"

            )

        )
        showEntityEditor(player, entity, "routes");
        return;
    }

    const form = new ActionFormData()
        .title("§R§O§U§T§E§ §L§I§S§T")
        .body(`§7Total route points: §a${routePoints.length}`);


    for (const rp of routePoints) {
        const loc = rp.location;
        const waitSecs = Math.floor(rp.waitTime / 20);
        form.button(
            `§e#${rp.order + 1}§7 - Wait: ${waitSecs}s\n§8(${Math.floor(loc.x)}, ${Math.floor(loc.y)}, ${Math.floor(loc.z)})`,
        );
    }

    form.button("§7Back");

    form.show(player).then((response) => {
        if (response.canceled) {
            system.run(() => showEntityEditor(player, entity, "routes"));
            return;
        }

        const sel = response.selection;

        if (sel === routePoints.length) {

            system.run(() => showEntityEditor(player, entity, "routes"));
        } else if (sel >= 0 && sel < routePoints.length) {

            system.run(() =>
                showRoutePointSettings(player, entity, routeId, routePoints[sel]),
            );
        }
    });
}


function showRoutePointSettings(player, entity, routeId, routePoint) {
    const loc = routePoint.location;
    const waitSecs = Math.floor(routePoint.waitTime / 20);

    const form = new ActionFormData()
        .title(`§R§P§ §#${routePoint.order + 1}`)
        .body(
            `§7Location: §e(${Math.floor(loc.x)}, ${Math.floor(loc.y)}, ${Math.floor(loc.z)})`,
        );

    form.button(`§7Wait Time: §e${waitSecs}s`);
    form.button(`§7Next Step: §e${routePoint.nextRouteMode}`);
    form.button("§6Emit Sound");
    form.button("§bEffects");
    form.button("§cRemove Point");
    form.button("§7Back");

    form.show(player).then((response) => {
        if (response.canceled) {
            system.run(() =>
                showRouteListMenu(
                    player,
                    entity,
                    routeId,
                    getRoutePointsForRouteId(routeId),
                ),
            );
            return;
        }

        const sel = response.selection;

        if (sel === 0) {

            system.run(() => showEditWaitTime(player, entity, routeId, routePoint));
        } else if (sel === 1) {

            system.run(() => showEditNextStep(player, entity, routeId, routePoint));
        } else if (sel === 2) {

            player.sendMessage(


                dynamicToast(


                    "§l§eINFO",


                    "§6[Routes] §7Sound settings coming soon!",


                    "textures/fr_ui/selection_icon",


                    "textures/fr_ui/unlinked_ui"


                )


            )
            system.run(() =>
                showRoutePointSettings(player, entity, routeId, routePoint),
            );
        } else if (sel === 3) {

            player.sendMessage(


                dynamicToast(


                    "§l§eINFO",


                    "§b[Routes] §7Effects settings coming soon!",


                    "textures/fr_ui/selection_icon",


                    "textures/fr_ui/unlinked_ui"


                )


            )
            system.run(() =>
                showRoutePointSettings(player, entity, routeId, routePoint),
            );
        } else if (sel === 4) {

            system.run(() =>
                showConfirmDeleteRoutePoint(player, entity, routeId, routePoint),
            );
        } else if (sel === 5) {

            system.run(() =>
                showRouteListMenu(
                    player,
                    entity,
                    routeId,
                    getRoutePointsForRouteId(routeId),
                ),
            );
        }
    });
}



function showChangeAnimatronicIdMenu(player, entity) {
    const currentId = entity.getDynamicProperty("fr:animatronic_id") || 0;

    const form = new ModalFormData()
        .title("§l§6Change Animatronic ID")
        .textField(
            "§7Enter new ID for this animatronic:\n§8(This ID links the statue to its route points)",
            "Enter a number",
            { defaultValue: currentId.toString() },
        );

    form.show(player).then((response) => {
        if (response.canceled) {
            system.run(() => showEntityEditor(player, entity, "routes"));
            return;
        }

        const newId = parseInt(response.formValues[0]);
        if (isNaN(newId) || newId < 0) {
            player.sendMessage(

                dynamicToast(

                    "§l§4ERROR",

                    "§c[Routes] §7Invalid ID! Must be a positive number.",

                    "textures/fr_ui/deny_icon",

                    "textures/fr_ui/deny_ui"

                )

            )
            system.run(() => showEntityEditor(player, entity, "routes"));
            return;
        }


        entity.setDynamicProperty("fr:animatronic_id", newId);


        entity.setDynamicProperty("fr:route_id", newId);


        entity.setDynamicProperty("fr:statue_id", newId);

        player.sendMessage(


            dynamicToast(


                "§l§qSUCCESS",


                `§7Animatronic ID changed to §e${newId}`,


                "textures/fr_ui/approve_icon",


                "textures/fr_ui/approve_ui"


            )


        )
        player.playSound("random.orb", { pitch: 1.2, volume: 0.5 });

        system.run(() => showEntityEditor(player, entity, "routes"));
    });
}

function showCreateRouteMenu(player, entity, routeId) {
    const form = new MessageFormData()
        .title("Create route")
        .body(
            "§7To create route points:\n\n§e1.§7 You will receive a §6Wrench§7 tool\n§e2.§7 §6Right-click§7 on any block to place a route point\n§e3.§7 Route points are placed in order automatically\n§e4.§7 §6Sneak + Right-click§7 to finish and exit mode\n\n§8The wrench will be locked in your hotbar during this mode.",
        )
        .button1("Start Creating")
        .button2("Cancel");

    form.show(player).then((response) => {
        if (response.selection === 0) {

            startRouteMarkingMode(player, routeId, entity);
        } else {
            system.run(() => showEntityEditor(player, entity, "routes"));
        }
    });
}


const routeMarkingPlayers = new Map();


function startRouteMarkingMode(player, routeId, entity) {

    routeMarkingPlayers.set(player.id, {
        routeId: routeId,
        entityId: entity.id,
        entityType: entity.typeId,
        pointsCreated: 0,
        startTime: Date.now(),
        originalSlot: player.selectedSlot,
    });


    try {
        player.runCommand("camera @s clear");
    } catch (e) {
    }


    try {

        player.runCommand(
            'replaceitem entity @s slot.hotbar 0 fr:wrench 1 0 {"minecraft:item_lock":{"mode":"lock_in_slot"}}',
        );

        player.selectedSlot = 0;
    } catch (e) {
    }

    player.sendMessage(


        dynamicToast(


            "§l§qEnabled",
            "§7Route marking mode started! §fRight-click§7 on blocks to place route points\n\n§7§fSneak + Right-click§7 to finish and exit",
            "textures/fr_ui/approve_icon",
            "textures/fr_ui/approve_ui"
        )


    )
}


export function isPlayerInRouteMarkingMode(playerId) {
    return routeMarkingPlayers.has(playerId);
}


export function getRouteMarkingSession(playerId) {
    return routeMarkingPlayers.get(playerId);
}


export function handleRoutePointPlacement(player, block, blockFace) {
    const session = routeMarkingPlayers.get(player.id);
    if (!session) return;


    let targetLoc = {
        x: block.location.x,
        y: block.location.y + 1,
        z: block.location.z,
    };


    if (blockFace === "Up") {
        targetLoc = {
            x: block.location.x,
            y: block.location.y + 1,
            z: block.location.z,
        };
    } else if (blockFace === "Down") {
        targetLoc = {
            x: block.location.x,
            y: block.location.y - 1,
            z: block.location.z,
        };
    } else if (blockFace === "North") {
        targetLoc = {
            x: block.location.x,
            y: block.location.y,
            z: block.location.z - 1,
        };
    } else if (blockFace === "South") {
        targetLoc = {
            x: block.location.x,
            y: block.location.y,
            z: block.location.z + 1,
        };
    } else if (blockFace === "East") {
        targetLoc = {
            x: block.location.x + 1,
            y: block.location.y,
            z: block.location.z,
        };
    } else if (blockFace === "West") {
        targetLoc = {
            x: block.location.x - 1,
            y: block.location.y,
            z: block.location.z,
        };
    }

    const dimId = player.dimension.id;
    const nextOrder = getNextRouteOrder(session.routeId);


    const existingBlock = player.dimension.getBlock(targetLoc);
    if (existingBlock && existingBlock.typeId === "fr:route_point") {
        player.sendMessage(

            dynamicToast(

                "§l§4ERROR",

                "§c[Routes] §7A route point already exists here!",

                "textures/fr_ui/deny_icon",

                "textures/fr_ui/deny_ui"

            )

        )
        player.playSound("note.bass", { pitch: 0.5, volume: 0.5 });
        return;
    }


    if (
        existingBlock &&
        !existingBlock.isAir &&
        existingBlock.typeId !== "minecraft:air"
    ) {
        player.sendMessage(

            dynamicToast(

                "§l§4ERROR",

                "§c[Routes] §7Cannot place route point here - block is not air!",

                "textures/fr_ui/deny_icon",

                "textures/fr_ui/deny_ui"

            )

        )
        player.playSound("note.bass", { pitch: 0.5, volume: 0.5 });
        return;
    }


    try {
        const routePointBlock = player.dimension.getBlock(targetLoc);
        if (routePointBlock) {
            routePointBlock.setType("fr:route_point");
        } else {
            throw new Error("Could not get block at target location");
        }
    } catch (e) {
        player.sendMessage(

            dynamicToast(

                "§l§4ERROR",

                "§c[Routes] §7Failed to place route point!",

                "textures/fr_ui/deny_icon",

                "textures/fr_ui/deny_ui"

            )

        )
        return;
    }


    const result = createRoutePoint(targetLoc, dimId, {
        routeId: session.routeId,
        order: nextOrder,
        waitTime: CUSTOM_DEFAULT_WAIT_TIME,
        animatronicTypeId: session.entityType,
    });

    if (result.success) {
        session.pointsCreated++;
        player.sendMessage(
            dynamicToast(
                `§l§7Point §7#${nextOrder + 1}`,
                `§fPlaced at §8(${Math.floor(targetLoc.x)}, ${Math.floor(targetLoc.y)}, ${Math.floor(targetLoc.z)})`,
                "textures/fr_ui/debug_icon",
                "textures/fr_ui/default_ui",
            ),
        );
        player.playSound("random.orb", { pitch: 1.2, volume: 0.5 });
    } else if (result.error === "duplicate") {
        player.sendMessage(

            dynamicToast(

                "§l§4ERROR",

                "§c[Routes] §7A route point already exists at this location!",

                "textures/fr_ui/deny_icon",

                "textures/fr_ui/deny_ui"

            )

        )
        player.playSound("note.bass", { pitch: 0.5, volume: 0.5 });
    }
}


export function stopRouteMarkingMode(player) {
    const session = routeMarkingPlayers.get(player.id);
    if (!session) return;


    try {
        player.runCommand("clear @s fr:wrench 0 1");
    } catch (e) {
    }


    try {
        if (session.originalSlot !== undefined) {
            player.selectedSlot = session.originalSlot;
        }
    } catch { }

    routeMarkingPlayers.delete(player.id);

    player.sendMessage(


        dynamicToast(


            "§l§qSUCCESS",


            `§7Route marking complete!\n\nCreated §a${session.pointsCreated}§7 route points`,


            "textures/fr_ui/approve_icon",


            "textures/fr_ui/approve_ui"


        )


    )
    player.playSound("random.levelup", { pitch: 1.5, volume: 0.5 });
}

function showStagePlatformOptions(player, block) {
    const isVisible = block.permutation.getState("fr:visible") ?? true;
    const form = new ActionFormData()
        .title("Stage Platform")
        .body(`Location: ${block.location.x}, ${block.location.y}, ${block.location.z}`)
        .button("Link Animatronic")
        .button(isVisible ? "Hide Platform" : "Show Platform")
        .button("Cancel");

    form.show(player).then(res => {
        if (res.canceled || res.selection === 2) return;

        if (res.selection === 0) {
            // We need to call selectStageplate. It is imported from custom_pathing.js
            // Check imports at top of file. Yes, it is imported.
            selectStageplate(player, block.location, player.dimension.id);
        } else if (res.selection === 1) {
            try {
                const newPerm = block.permutation.withState("fr:visible", !isVisible);
                block.setPermutation(newPerm);
                player.playSound("random.click");
                const stateMsg = !isVisible ? "§aVisible" : "§cInvisible";
                player.sendMessage(`§7Stage Platform is now ${stateMsg}`);
            } catch (e) {
                player.sendMessage("§cFailed to toggle visibility.");
            }
        }
    });
}


function showConfirmDeleteAllRoutes(player, entity, routeId) {
    const routePoints = getRoutePointsForRouteId(routeId);

    const form = new MessageFormData()
        .title("§C§O§N§F§I§R§M")
        .body(
            `§cThis will delete ALL §e${routePoints.length}§c route points for this animatronic.\n\n§7This action cannot be undone!`,
        )
        .button1("§cDelete All")
        .button2("§7Cancel");

    form.show(player).then((response) => {
        if (response.selection === 0) {
            const count = deleteAllRoutePoints(routeId);
            player.sendMessage(

                dynamicToast(

                    "§l§4ERROR",

                    `§c[Routes] §7Deleted §e${count}§7 route points.`,

                    "textures/fr_ui/deny_icon",

                    "textures/fr_ui/deny_ui"

                )

            )
        }
        system.run(() => showEntityEditor(player, entity, "routes"));
    });
}


function showConfirmDeleteRoutePoint(player, entity, routeId, routePoint) {
    const form = new MessageFormData()
        .title("§D§E§L§E§T§E§ §P§O§I§N§T")
        .body(
            `§cDelete route point §e#${routePoint.order + 1}§c?\n\n§7Location: §8(${Math.floor(routePoint.location.x)}, ${Math.floor(routePoint.location.y)}, ${Math.floor(routePoint.location.z)})`,
        )
        .button1("§cDelete")
        .button2("§7Cancel");

    form.show(player).then((response) => {
        if (response.selection === 0) {
            deleteRoutePoint(routePoint.location, routePoint.dimensionId);
            player.sendMessage(

                dynamicToast(

                    "§l§4ERROR",

                    `§c[Routes] §7Deleted route point §e#${routePoint.order + 1}`,

                    "textures/fr_ui/deny_icon",

                    "textures/fr_ui/deny_ui"

                )

            )
        }
        system.run(() =>
            showRouteListMenu(
                player,
                entity,
                routeId,
                getRoutePointsForRouteId(routeId),
            ),
        );
    });
}


function showEditWaitTime(player, entity, routeId, routePoint) {
    const currentWaitSecs = Math.floor(routePoint.waitTime / 20);

    const form = new ModalFormData()
        .title("§W§A§I§T§ §T§I§M§E")
        .slider("Wait time (seconds)", 3, 600, 1, currentWaitSecs);

    form.show(player).then((response) => {
        if (!response.canceled && response.formValues) {
            const newWaitSecs = response.formValues[0];
            const newWaitTicks = newWaitSecs * 20;

            updateRoutePoint(routePoint.location, routePoint.dimensionId, {
                waitTime: newWaitTicks,
            });
            player.sendMessage(

                dynamicToast(

                    "§l§qSUCCESS",

                    `§7Wait time set to §e${newWaitSecs}§7 seconds`,

                    "textures/fr_ui/approve_icon",

                    "textures/fr_ui/approve_ui"

                )

            )


            const updatedRp = getRoutePointData(
                routePoint.location,
                routePoint.dimensionId,
            );
            system.run(() =>
                showRoutePointSettings(player, entity, routeId, updatedRp),
            );
        } else {
            system.run(() =>
                showRoutePointSettings(player, entity, routeId, routePoint),
            );
        }
    });
}


function showEditNextStep(player, entity, routeId, routePoint) {
    const form = new ActionFormData()
        .title("§N§E§X§T§ §S§T§E§P")
        .body("§7Choose how the animatronic picks the next route point:");

    form.button("§aSequential§7\nGo to point #" + (routePoint.order + 2));
    form.button("§eRandom§7\nPick any point randomly");
    form.button("§bSpecific§7\nGo to a chosen point");
    form.button("§7Cancel");

    form.show(player).then((response) => {
        if (response.canceled || response.selection === 3) {
            system.run(() =>
                showRoutePointSettings(player, entity, routeId, routePoint),
            );
            return;
        }

        let newMode;
        if (response.selection === 0) newMode = "sequential";
        else if (response.selection === 1) newMode = "random";
        else if (response.selection === 2) newMode = "specific";

        updateRoutePoint(routePoint.location, routePoint.dimensionId, {
            nextRouteMode: newMode,
        });
        player.sendMessage(

            dynamicToast(

                "§l§qSUCCESS",

                `§7Next step mode set to §e${newMode}`,

                "textures/fr_ui/approve_icon",

                "textures/fr_ui/approve_ui"

            )

        )

        const updatedRp = getRoutePointData(
            routePoint.location,
            routePoint.dimensionId,
        );
        system.run(() =>
            showRoutePointSettings(player, entity, routeId, updatedRp),
        );
    });
}






function getPosesForTypeId(typeId) {
    if (!typeId) return POSES_BONNIE;
    if (typeId.includes("endo_01")) return POSES_ENDO_01;
    if (typeId.includes("chica")) return POSES_CHICA;
    if (typeId.includes("foxy")) return POSES_FOXY;
    if (typeId.includes("freddy")) return POSES_FREDDY;
    if (typeId.includes("golden_freddy")) return POSES_GOLDEN_FREDDY;
    if (typeId.includes("sparky")) return POSES_SPARKY;
    return POSES_BONNIE;
}


function getVariantsForTypeId(typeId) {
    if (!typeId) return VARIANTS_BONNIE;
    if (typeId.includes("endo_01")) return VARIANTS_ENDO_01;
    if (typeId.includes("chica")) return VARIANTS_CHICA;
    if (typeId.includes("foxy")) return VARIANTS_FOXY;
    if (typeId.includes("freddy")) return VARIANTS_FREDDY;
    if (typeId.includes("golden_freddy")) return VARIANTS_GOLDEN_FREDDY;
    if (typeId.includes("sparky")) return VARIANTS_SPARKY;
    return VARIANTS_BONNIE;
}


const routePointEditorState = new Map();

const RP_CATEGORIES = ["poses", "variants", "rotation", "settings"];
const RP_ITEMS_PER_PAGE = 6;

function getRoutePointEditorState(playerId) {
    if (!routePointEditorState.has(playerId)) {
        routePointEditorState.set(playerId, {
            category: "poses",
            posePage: 0,
            variantPage: 0,
            poseCategory: "base",
            variantCategory: "normal",
        });
    }
    return routePointEditorState.get(playerId);
}



const RP_FLAG = "§R§P§E§D§I§T";
const RP_SEC_WAYPOINTS = "§r§p§s§:§1";
const RP_SEC_PATHFINDING = "§r§p§s§:§2";
const RP_SEC_SETTINGS = "§r§p§s§:§3";
const RP_SEC_ROUTES = "§r§p§s§:§4";
const RP_SEC_NOLINK = "§r§p§s§:§0";
const RP_GRID_ITEMS_PER_PAGE = 6;

export function showRoutePointConfigMenu(
    player,
    routePointData,
    section = "pathfinding",
) {
    if (!routePointData) {
        player.sendMessage(

            dynamicToast(

                "§l§4ERROR",

                "§7No data found for this route point",

                "textures/fr_ui/deny_icon",

                "textures/fr_ui/deny_ui"

            )

        )
        return;
    }


    if (!routePointData.animatronicTypeId) {
        try {
            const editingEntity = playerEditingEntity.get(player.id);
            if (editingEntity && editingEntity.isValid) {
                routePointData.animatronicTypeId = editingEntity.typeId;
            } else if (routePointData.routeId !== undefined && routePointData.routeId !== null) {
                const targetRouteId = Number(routePointData.routeId);
                if (Number.isFinite(targetRouteId)) {
                    // Optimization: Filter by animatronic family instead of scanning all entities
                    for (const ent of player.dimension.getEntities({ families: ["animatronic"] })) {
                        try {
                            const entRouteId = Number(ent.getDynamicProperty("fr:route_id"));
                            if (entRouteId === targetRouteId && isAnimatronic(ent)) {
                                routePointData.animatronicTypeId = ent.typeId;
                                break;
                            }
                        } catch { }
                    }
                }
            }
            if (routePointData.animatronicTypeId) {
                try {
                    updateRoutePoint(routePointData.location, routePointData.dimensionId, {
                        animatronicTypeId: routePointData.animatronicTypeId,
                    });
                } catch { }
            }
        } catch { }
    }
    if (!routePointData.animatronicTypeId) {
        const form = new ActionFormData()
            .title(`${RP_FLAG}${RP_SEC_NOLINK}`)
            .button("§v_hide");

        form.show(player).then((response) => {

        });
        return;
    }

    updateRoutePointCamera(player, routePointData.location, routePointData.rotation || 0);
    startRoutePointCameraTracking(player, routePointData.location);

    const state = getRoutePointEditorState(player.id);
    state.category = section;

    const poses = getPosesForTypeId(routePointData.animatronicTypeId);
    const variants = getVariantsForTypeId(routePointData.animatronicTypeId);

    const currentPose = routePointData.pose ?? 0;
    const currentVariant = routePointData.variant ?? 0;
    const currentRotation = routePointData.rotation ?? 0;
    const waitTimeSecs = Math.floor((routePointData.waitTime ?? 100) / 20);

    const poseName = poses[currentPose]?.name || `Pose ${currentPose}`;
    const variantName =
        variants[currentVariant]?.name || `Variant ${currentVariant}`;
    const rotationDegrees = rotationValueToDegrees(currentRotation);


    let sectionFlag;
    if (section === "waypoints") sectionFlag = RP_SEC_WAYPOINTS;
    else if (section === "pathfinding") sectionFlag = RP_SEC_PATHFINDING;
    else if (section === "settings") sectionFlag = RP_SEC_SETTINGS;
    else if (section === "routes") sectionFlag = RP_SEC_ROUTES;
    else sectionFlag = RP_SEC_PATHFINDING;

    const form = new ActionFormData().title(`${RP_FLAG}${sectionFlag}`);








    form.button("Pathfinding", "textures/fr_ui/paint_icon");
    form.button("Waypoints", "textures/fr_ui/animation_icon");
    form.button("Settings", "textures/ui/gear");
    form.button("Routes", "textures/ui/World");




    const RP_POSE_CATEGORIES = ["base", "motion", "blood"];
    const RP_VARIANT_CATEGORIES = ["normal", "special", "seasonal", "community"];

    if (section === "waypoints") {

        RP_POSE_CATEGORIES.forEach((cat, i) => {
            const label = cat.charAt(0).toUpperCase() + cat.slice(1);
            const isSelected = cat === state.poseCategory;
            form.button(
                isSelected ? `§z${label}` : label,
                `textures/fr_ui/terminal_tab_${i + 1}`,
            );
        });
        form.button(" ");
    } else if (section === "pathfinding") {

        RP_VARIANT_CATEGORIES.forEach((cat, i) => {
            const label = cat.charAt(0).toUpperCase() + cat.slice(1);
            const isSelected = cat === state.variantCategory;
            form.button(
                isSelected ? `§z${label}` : label,
                `textures/fr_ui/terminal_variants_tab_${i + 1}`,
            );
        });
    } else if (section === "settings_rotation") {
        form.button("Config", "textures/ui/gear");
        form.button(" ");
        form.button(" ");
        form.button(" ");
    } else if (section === "settings") {

    } else {
        form.button(" ");
        form.button(" ");
        form.button(" ");
        form.button(" ");
    }


    const buttonActions = [];

    if (section === "waypoints") {

        const filteredPoses = poses.filter(p => getPoseCategory(p) === state.poseCategory);


        const totalPages = Math.max(1, Math.ceil(filteredPoses.length / RP_GRID_ITEMS_PER_PAGE));
        const currentPage = Math.min(
            state.posePage || 0,
            Math.max(0, totalPages - 1),
        );
        state.posePage = currentPage;

        const startIdx = currentPage * RP_GRID_ITEMS_PER_PAGE;
        const pageItems = filteredPoses.slice(startIdx, startIdx + RP_GRID_ITEMS_PER_PAGE);


        for (let i = 0; i < RP_GRID_ITEMS_PER_PAGE; i++) {
            if (i < pageItems.length) {
                const pose = pageItems[i];

                const globalIndex = poses.findIndex(p => p.name === pose.name);
                const isSelected = globalIndex === currentPose;
                const prefix = isSelected ? "§z" : "";
                form.button(
                    `${prefix}${pose.name}`,
                    pose.icon || "textures/fr_ui/animation_icon",
                );
                buttonActions[i] = { action: "select_pose", index: globalIndex };
            } else {
                form.button(" ");
                buttonActions[i] = { action: "none" };
            }
        }


        if (totalPages > 1) {
            form.button(">prev<");
            form.button(`${currentPage + 1}`);
            form.button(">next<");
        } else {
            form.button("§v_hide");
            form.button("§v_hide");
            form.button("§v_hide");
        }
        buttonActions[6] = { action: "page_prev" };
        buttonActions[7] = { action: "none" };
        buttonActions[8] = { action: "page_next", totalPages };
    } else if (section === "pathfinding") {

        const filteredVariants = variants.filter(v => (v.type || "normal") === state.variantCategory);


        const VARIANTS_PER_PAGE = 3;
        let totalPages = Math.ceil(filteredVariants.length / VARIANTS_PER_PAGE);
        if (filteredVariants.length <= VARIANTS_PER_PAGE) totalPages = 1;
        totalPages = Math.max(1, totalPages);
        const currentPage = Math.min(
            state.variantPage || 0,
            Math.max(0, totalPages - 1),
        );
        state.variantPage = currentPage;

        const startIdx = currentPage * VARIANTS_PER_PAGE;
        const pageItems = filteredVariants.slice(
            startIdx,
            startIdx + VARIANTS_PER_PAGE,
        );


        form.button(" ");
        buttonActions[0] = { action: "none" };

        for (let i = 0; i < VARIANTS_PER_PAGE; i++) {
            const btnIndex = 9 + i;
            const actionIndex = btnIndex - 8;
            if (i < pageItems.length) {
                const variant = pageItems[i];
                const globalIndex = variants.findIndex(v => v.name === variant.name);
                const isSelected = globalIndex === currentVariant;
                const prefix = isSelected ? "§z" : "";
                form.button(
                    `${prefix}${variant.name}`,
                    variant.icon || "textures/fr_ui/paint_icon",
                );
                buttonActions[actionIndex] = { action: "select_variant", index: globalIndex };
            } else {
                form.button(" ");
                buttonActions[actionIndex] = { action: "none" };
            }
        }


        if (totalPages > 1) {
            form.button(">prev<");
            form.button(`${currentPage + 1}`);
            form.button(">next<");
        } else {
            form.button("§v_hide");
            form.button("§v_hide");
            form.button("§v_hide");
        }
        buttonActions[4] = { action: "page_prev" };
        buttonActions[5] = { action: "none" };
        buttonActions[6] = { action: "page_next", totalPages };
    } else if (section === "settings_rotation") {

        const rotations = [
            { name: "↓ South (0°)", value: 0 },
            { name: "← West (90°)", value: 90 },
            { name: "↑ North (180°)", value: 180 },
            { name: "→ East (270°)", value: 270 },
            { name: "↙ SW (45°)", value: 45 },
            { name: "↖ NW (135°)", value: 135 },
        ];


        for (let i = 0; i < RP_GRID_ITEMS_PER_PAGE; i++) {
            if (i < rotations.length) {
                const rot = rotations[i];
                const isSelected =
                    Math.abs(rotationDegrees - rot.value) < 10 ||
                    Math.abs(rotationDegrees - rot.value + 360) < 10 ||
                    Math.abs(rotationDegrees - rot.value - 360) < 10;
                const prefix = isSelected ? "§a✓ " : "";
                form.button(`${prefix}${rot.name}`, "textures/fr_ui/rotation_icon");
                buttonActions[i] = { action: "select_rotation", degrees: rot.value };
            } else {
                form.button(" ");
                buttonActions[i] = { action: "none" };
            }
        }


        form.button("More...");
        buttonActions[6] = { action: "more_rotations" };

        form.button(`${rotationDegrees}°`);
        buttonActions[7] = { action: "none" };

        form.button("✎ Custom");
        buttonActions[8] = { action: "custom_rotation" };
    } else if (section === "settings") {



        const currentRotation = rotationValueToDegrees(routePointData?.rotation || 0);


        form.button("-", "textures/ui/invisible");
        form.button("+", "textures/ui/invisible");
        form.button(">Open<", "textures/ui/invisible");
        form.button(">Open<", "textures/ui/invisible");
        form.button(`${currentRotation}°`, "textures/ui/invisible");


        buttonActions[0] = { action: "rotation_minus" };
        buttonActions[1] = { action: "rotation_plus" };
        buttonActions[2] = { action: "open_point_settings" };
        buttonActions[3] = { action: "open_delete_options" };
        buttonActions[4] = { action: "none" };
    }

    form.show(player).then((response) => {
        if (response.canceled) {
            try {
                player.runCommand(`camera @s clear`);
                stopRoutePointCameraTracking(player.id);
            } catch (e) {
            }
            return;
        }

        const sel = response.selection;


        if (section === "settings") {

            if (sel === 0) {
                system.run(() => showRoutePointConfigMenu(player, routePointData, "pathfinding"));
                return;
            } else if (sel === 1) {
                system.run(() => showRoutePointConfigMenu(player, routePointData, "waypoints"));
                return;
            } else if (sel === 2) {
                system.run(() => showRoutePointConfigMenu(player, routePointData, "settings"));
                return;
            } else if (sel === 3) {
                system.run(() => showRoutePointConfigMenu(player, routePointData, "routes"));
                return;
            }


            if (sel === 4) {
                const oldRot = rotationValueToDegrees(routePointData.rotation || 0);
                routePointData.rotation = (oldRot - 15 + 360) % 360;

                updateRoutePoint(routePointData.location, routePointData.dimensionId, {
                    rotation: routePointData.rotation
                });
                startRotationPreview(player, routePointData.location, routePointData.dimensionId, routePointData.rotation);
                system.run(() => showRoutePointConfigMenu(player, routePointData, "settings"));
            } else if (sel === 5) {
                const oldRot = rotationValueToDegrees(routePointData.rotation || 0);
                routePointData.rotation = (oldRot + 15) % 360;

                updateRoutePoint(routePointData.location, routePointData.dimensionId, {
                    rotation: routePointData.rotation
                });
                startRotationPreview(player, routePointData.location, routePointData.dimensionId, routePointData.rotation);
                system.run(() => showRoutePointConfigMenu(player, routePointData, "settings"));
            } else if (sel === 6) {
                system.run(() => showRPPointSettingsMenu(player, routePointData));
            } else if (sel === 7) {
                system.run(() => showRPDeleteOptionsMenu(player, routePointData));
            }
            return;
        }


        if (sel === 0) {
            system.run(() =>
                showRoutePointConfigMenu(player, routePointData, "pathfinding"),
            );
            return;
        } else if (sel === 1) {
            system.run(() =>
                showRoutePointConfigMenu(player, routePointData, "waypoints"),
            );
            return;
        } else if (sel === 2) {
            system.run(() =>
                showRoutePointConfigMenu(player, routePointData, "settings"),
            );
            return;
        } else if (sel === 3) {
            system.run(() =>
                showRoutePointConfigMenu(player, routePointData, "routes"),
            );
            return;
        }


        if (sel >= 4 && sel <= 7) {
            const categoryIndex = sel - 4;

            if (section === "waypoints") {
                const RP_POSE_CATEGORIES = ["base", "motion", "blood"];
                if (categoryIndex < RP_POSE_CATEGORIES.length) {
                    state.poseCategory = RP_POSE_CATEGORIES[categoryIndex];
                    state.posePage = 0;
                }
            } else if (section === "pathfinding") {
                const RP_VARIANT_CATEGORIES = ["normal", "special", "seasonal", "community"];
                if (categoryIndex < RP_VARIANT_CATEGORIES.length) {
                    state.variantCategory = RP_VARIANT_CATEGORIES[categoryIndex];
                    state.variantPage = 0;
                }
            }

            system.run(() =>
                showRoutePointConfigMenu(player, routePointData, section),
            );
            return;
        }






        const actionIdx = sel - 8;
        if (actionIdx >= 0 && actionIdx < buttonActions.length) {
            const actionData = buttonActions[actionIdx];
            console.warn(`[RP Debug] Action: ${actionData.action}`);

            switch (actionData.action) {
                case "none":
                    system.run(() =>
                        showRoutePointConfigMenu(player, routePointData, section),
                    );
                    break;
                case "page_prev":
                    if (section === "waypoints") {
                        state.posePage = Math.max(0, (state.posePage || 0) - 1);
                    } else if (section === "pathfinding") {
                        state.variantPage = Math.max(0, (state.variantPage || 0) - 1);
                    }
                    system.run(() =>
                        showRoutePointConfigMenu(player, routePointData, section),
                    );
                    break;
                case "page_next":
                    if (section === "waypoints") {
                        const totalPosePages = Math.ceil(
                            poses.length / RP_GRID_ITEMS_PER_PAGE,
                        );
                        state.posePage = Math.min(
                            totalPosePages - 1,
                            (state.posePage || 0) + 1,
                        );
                    } else if (section === "pathfinding") {
                        const totalVarPages = Math.ceil(
                            variants.length / RP_GRID_ITEMS_PER_PAGE,
                        );
                        state.variantPage = Math.min(
                            totalVarPages - 1,
                            (state.variantPage || 0) + 1,
                        );
                    }
                    system.run(() =>
                        showRoutePointConfigMenu(player, routePointData, section),
                    );
                    break;
                case "select_pose":
                    updateRoutePoint(
                        routePointData.location,
                        routePointData.dimensionId,
                        { pose: actionData.index },
                    );
                    routePointData.pose = actionData.index;
                    player.playSound("random.orb", { pitch: 1.2, volume: 0.5 });
                    system.run(() =>
                        showRoutePointConfigMenu(player, routePointData, "waypoints"),
                    );
                    break;
                case "select_variant":
                    updateRoutePoint(
                        routePointData.location,
                        routePointData.dimensionId,
                        { variant: actionData.index },
                    );
                    routePointData.variant = actionData.index;
                    player.playSound("random.orb", { pitch: 1.2, volume: 0.5 });
                    system.run(() =>
                        showRoutePointConfigMenu(player, routePointData, "pathfinding"),
                    );
                    break;
                case "select_rotation":
                    updateRoutePoint(
                        routePointData.location,
                        routePointData.dimensionId,
                        { rotation: actionData.degrees },
                    );
                    routePointData.rotation = actionData.degrees;
                    player.playSound("random.orb", { pitch: 1.0, volume: 0.5 });
                    startRotationPreview(player, routePointData.location, routePointData.dimensionId, actionData.degrees);
                    system.run(() =>
                        showRoutePointConfigMenu(player, routePointData, "rotation"),
                    );
                    break;
                case "more_rotations":
                    system.run(() => showMoreRotationsMenu(player, routePointData));
                    break;
                case "custom_rotation":
                    system.run(() => showCustomRotationInput(player, routePointData));
                    break;
                case "open_point_settings":

                    system.run(() => showRPPointSettingsMenu(player, routePointData));
                    break;
                case "open_delete_options":

                    system.run(() => showRPDeleteOptionsMenu(player, routePointData));
                    break;
                case "open_additional_settings":

                    system.run(() => showRPAdditionalSettingsMenu(player, routePointData));
                    break;
                case "edit_wait_time":
                    system.run(() => showRPWaitTimeMenu(player, routePointData));
                    break;
                case "edit_effects":
                    system.run(() => showRPEffectsMenu(player, routePointData));
                    break;
                case "edit_next_step":
                    system.run(() => showRPNextStepMenu(player, routePointData));
                    break;
                case "change_route_id":
                    system.run(() => showChangeRouteIdMenu(player, routePointData));
                    break;
                case "delete_point":
                    system.run(() => showDeleteThisPointConfirm(player, routePointData));
                    break;
                case "delete_all":
                    system.run(() => showDeleteAllPointsConfirm(player, routePointData));
                    break;
                case "close":
                    try {
                        player.runCommand(`camera @s clear`);
                        stopRoutePointCameraTracking(player.id);
                    } catch (e) {
                    }
                    break;
            }
        }
    }).catch(error => {
        console.warn(`[RP Debug] Error in showRoutePointConfigMenu: ${error}`);
        if (error.stack) console.warn(error.stack);
        try {
            player.runCommand(`camera @s clear`);
            stopRoutePointCameraTracking(player.id);
        } catch (e) {
        }
    });
}


function showMoreRotationsMenu(player, routePointData) {
    const currentRotation = routePointData.rotation ?? 0;
    const rotationDegrees = rotationValueToDegrees(currentRotation);

    const additionalRotations = [
        { name: "§7↙ SW (45°)", value: 45 },
        { name: "§7↖ NW (135°)", value: 135 },
        { name: "§7↗ NE (225°)", value: 225 },
        { name: "§7↘ SE (315°)", value: 315 },
        { name: "§8Custom Angle...", value: -1 },
    ];

    const form = new ActionFormData()
        .title("§l§dMore Rotations")
        .body(`§7Current rotation: §d${rotationDegrees}°`);

    for (const rot of additionalRotations) {
        const isSelected =
            rot.value >= 0 &&
            (Math.abs(rotationDegrees - rot.value) < 10 ||
                Math.abs(rotationDegrees - rot.value + 360) < 10 ||
                Math.abs(rotationDegrees - rot.value - 360) < 10);
        const prefix = isSelected ? "§d✓ " : "";
        form.button(`${prefix}${rot.name}`);
    }

    form.button("§7Back");

    form.show(player).then((response) => {
        if (
            response.canceled ||
            response.selection === additionalRotations.length
        ) {
            system.run(() =>
                showRoutePointConfigMenu(player, routePointData, "rotation"),
            );
            return;
        }

        const sel = response.selection;
        if (sel < additionalRotations.length) {
            const rotData = additionalRotations[sel];
            if (rotData.value === -1) {
                system.run(() => showCustomRotationInput(player, routePointData));
            } else {
                updateRoutePoint(routePointData.location, routePointData.dimensionId, {
                    rotation: rotData.value,
                });
                routePointData.rotation = rotData.value;
                player.playSound("random.orb", { pitch: 1.0, volume: 0.5 });
                startRotationPreview(player, routePointData.location, routePointData.dimensionId, rotData.value);
                system.run(() =>
                    showRoutePointConfigMenu(player, routePointData, "rotation"),
                );
            }
        }
    });
}


function showRPPointSettingsMenu(player, routePointData) {
    const waitTimeSecs = Math.floor((routePointData.waitTime ?? 100) / 20);
    const effectCount = routePointData.effects?.length || 0;
    const nextModeLabels = { 0: "Random", 1: "Sequential", 2: "Specific" };
    const nextMode = nextModeLabels[routePointData.nextRouteMode] || "Sequential";

    const form = new ActionFormData()
        .title("Point Settings")
        .body("Configure waypoint behavior");

    form.button(`Wait Time: ${waitTimeSecs}s`, "textures/fr_ui/gear_icon");
    form.button(`Effects: ${effectCount}`, "textures/fr_ui/gear_icon");
    form.button(`Next Mode: ${nextMode}`, "textures/fr_ui/gear_icon");
    form.button("Route ID", "textures/fr_ui/gear_icon");
    form.button("Back", "textures/fr_ui/back_icon");

    form.show(player).then((response) => {
        if (response.canceled || response.selection === 4) {
            system.run(() =>
                showRoutePointConfigMenu(player, routePointData, "settings"),
            );
            return;
        }

        switch (response.selection) {
            case 0:
                system.run(() => showRPWaitTimeMenu(player, routePointData));
                break;
            case 1:
                system.run(() => showRPEffectsMenu(player, routePointData));
                break;
            case 2:
                system.run(() => showRPNextStepMenu(player, routePointData));
                break;
            case 3:
                system.run(() => showChangeRouteIdMenu(player, routePointData));
                break;
        }
    });
}


function showRPDeleteOptionsMenu(player, routePointData) {
    const form = new ActionFormData()
        .title("Delete Options")
        .body("Choose what to delete");

    form.button("Delete this point", "textures/fr_ui/deny_icon");
    form.button("Delete all points", "textures/fr_ui/deny_icon");
    form.button("Back", "textures/fr_ui/back_icon");

    form.show(player).then((response) => {
        if (response.canceled || response.selection === 2) {
            system.run(() =>
                showRoutePointConfigMenu(player, routePointData, "settings"),
            );
            return;
        }

        switch (response.selection) {
            case 0:
                system.run(() => showDeleteThisPointConfirm(player, routePointData));
                break;
            case 1:
                system.run(() => showDeleteAllPointsConfirm(player, routePointData));
                break;
        }
    });
}


function showRPAdditionalSettingsMenu(player, routePointData) {
    const form = new ActionFormData()
        .title("§l§bAdditional Settings")
        .body("§7More configuration options");

    form.button("§7Coming Soon...", "textures/fr_ui/gear_icon");
    form.button("§7Back", "textures/fr_ui/back_icon");

    form.show(player).then((response) => {
        system.run(() =>
            showRoutePointConfigMenu(player, routePointData, "settings"),
        );
    });
}


function showRPWaitTimeMenu(player, routePointData) {
    const currentSecs = Math.floor((routePointData.waitTime ?? 100) / 20);

    const form = new ModalFormData()
        .title("§l§6Wait Time")
        .slider("§7Seconds to wait at this point:", 1, 60, { valueStep: 1, defaultValue: currentSecs });

    form.show(player).then((response) => {
        if (response.canceled) {
            system.run(() =>
                showRPPointSettingsMenu(player, routePointData),
            );
            return;
        }

        const newSecs = response.formValues[0];
        const newTicks = newSecs * 20;
        updateRoutePoint(routePointData.location, routePointData.dimensionId, {
            waitTime: newTicks,
        });
        routePointData.waitTime = newTicks;
        player.sendMessage(

            dynamicToast(

                "§l§qSUCCESS",

                `§a[Route Point] §7Wait time set to §e${newSecs}s`,

                "textures/fr_ui/approve_icon",

                "textures/fr_ui/approve_ui"

            )

        )
        player.playSound("random.orb", { pitch: 1.2, volume: 0.5 });
        system.run(() =>
            showRPPointSettingsMenu(player, routePointData),
        );
    });
}


function showRPEffectsMenu(player, routePointData) {
    const effects = routePointData.effects || [];

    const form = new ActionFormData()
        .title("§l§5Effects")
        .body(
            (() => {
                let text = `§7Current effects: §e${effects.length}\n`;
                if (effects.length > 0) {
                    text += "\n";
                    for (const effect of effects) {
                        let name = effect.type;
                        if (name === "emit_sound" || name === "EMIT_SOUND")
                            name = `Sound: ${effect.soundId?.replace("random.", "") || "Unknown"}`;
                        else if (name === "camera_blackout")
                            name = `Blackout (${effect.duration}t)`;
                        else if (name === "camera_force_switch") name = "Force Switch";
                        else if (name === "screen_fade")
                            name = `Fade (${effect.duration}t)`;
                        text += `§8- §7${name}\n`;
                    }
                }
                text += `\n§7Effects trigger when animatronic arrives at this point.`;
                return text;
            })(),
        );

    form.button("§a+ Add Sound Effect");
    form.button("§e+ Add Camera Effect");

    if (effects.length > 0) {
        form.button("§c✖ Clear All Effects");
    }

    form.button("§7Back");

    form.show(player).then((response) => {
        if (response.canceled) {
            system.run(() =>
                showRPPointSettingsMenu(player, routePointData),
            );
            return;
        }

        const backIdx = effects.length > 0 ? 3 : 2;

        if (response.selection === backIdx) {
            system.run(() =>
                showRPPointSettingsMenu(player, routePointData),
            );
            return;
        }

        if (response.selection === 0) {

            system.run(() => showAddSoundEffectMenu(player, routePointData));
        } else if (response.selection === 1) {

            system.run(() => showAddCameraEffectMenu(player, routePointData));
        } else if (response.selection === 2 && effects.length > 0) {

            updateRoutePoint(routePointData.location, routePointData.dimensionId, {
                effects: [],
            });
            routePointData.effects = [];
            player.sendMessage(

                dynamicToast(

                    "§l§4ERROR",

                    "§7All effects cleared.",

                    "textures/fr_ui/deny_icon",

                    "textures/fr_ui/deny_ui"

                )

            )
            system.run(() => showRPEffectsMenu(player, routePointData));
        }
    });
}


function showRPNextStepMenu(player, routePointData) {
    const form = new ActionFormData()
        .title("§l§aNext Step Mode")
        .body("§7How should the animatronic choose the next waypoint?");

    form.button("§a➤ Sequential\n§7Go to next point in order");
    form.button("§e🎲 Random\n§7Pick random next point");
    form.button("§d🎯 Specific\n§7Always go to specific point");
    form.button("§7Back");

    form.show(player).then((response) => {
        if (response.canceled || response.selection === 3) {
            system.run(() =>
                showRPPointSettingsMenu(player, routePointData),
            );
            return;
        }

        const modes = [1, 0, 2];
        const modeNames = ["Sequential", "Random", "Specific"];
        const newMode = modes[response.selection];

        updateRoutePoint(routePointData.location, routePointData.dimensionId, {
            nextRouteMode: newMode,
        });
        routePointData.nextRouteMode = newMode;
        player.sendMessage(

            dynamicToast(

                "§l§qSUCCESS",

                `§a[Route Point] §7Next step mode set to §e${modeNames[response.selection]}`,

                "textures/fr_ui/approve_icon",

                "textures/fr_ui/approve_ui"

            )

        )
        player.playSound("random.orb", { pitch: 1.2, volume: 0.5 });
        system.run(() =>
            showRoutePointConfigMenu(player, routePointData, "settings"),
        );
    });
}


function showAddSoundEffectMenu(player, routePointData) {
    const sounds = [
        { id: "ambient.cave", name: "Cave Ambience" },
        { id: "mob.zombie.say", name: "Zombie Sound" },
        { id: "random.door_open", name: "Door Open" },
        { id: "random.door_close", name: "Door Close" },
        { id: "note.bass", name: "Bass Note" },
        { id: "note.pling", name: "Pling" },
        { id: "random.click", name: "Click" },
        { id: "mob.endermen.portal", name: "Enderman Portal" },
    ];

    const form = new ActionFormData()
        .title("§l§aAdd Sound Effect")
        .body("§7Select a sound to play when animatronic arrives:");

    for (const sound of sounds) {
        form.button(`§e${sound.name}\n§8${sound.id}`);
    }
    form.button("§7Cancel");

    form.show(player).then((response) => {
        if (response.canceled || response.selection === sounds.length) {
            system.run(() => showRPEffectsMenu(player, routePointData));
            return;
        }

        const selectedSound = sounds[response.selection];
        const newEffect = {
            type: "emit_sound",
            soundId: selectedSound.id,
            volume: 1.0,
            pitch: 1.0,
        };

        const effects = routePointData.effects || [];
        effects.push(newEffect);
        updateRoutePoint(routePointData.location, routePointData.dimensionId, {
            effects: effects,
        });
        routePointData.effects = effects;

        player.sendMessage(


            dynamicToast(


                "§l§qSUCCESS",


                `§a[Route Point] §7Added sound: §e${selectedSound.name}`,


                "textures/fr_ui/approve_icon",


                "textures/fr_ui/approve_ui"


            )


        )
        player.playSound("random.orb", { pitch: 1.2, volume: 0.5 });
        system.run(() => showRPEffectsMenu(player, routePointData));
    });
}


function showAddCameraEffectMenu(player, routePointData) {
    const form = new ActionFormData()
        .title("§l§aAdd Camera Effect")
        .body("§7Select a camera effect:");

    form.button("§eCamera Blackout\n§7Temporarily disables camera view");
    form.button("§eForce Switch\n§7Forces camera switch");
    form.button("§eScreen Fade\n§7Fades screen to black");
    form.button("§7Cancel");

    form.show(player).then((response) => {
        if (response.canceled || response.selection === 3) {
            system.run(() => showRPEffectsMenu(player, routePointData));
            return;
        }

        if (response.selection === 0) {

            system.run(() => showCameraBlackoutConfig(player, routePointData));
        } else if (response.selection === 1) {

            const newEffect = {
                type: "camera_force_switch",
            };
            addEffectToRoutePoint(player, routePointData, newEffect);
        } else if (response.selection === 2) {

            system.run(() => showScreenFadeConfig(player, routePointData));
        }
    });
}

function showCameraBlackoutConfig(player, routePointData) {
    const form = new ModalFormData()
        .title("Camera Blackout Settings")
        .textField("Duration (ticks)", "Default: 40");

    form.show(player).then((response) => {
        if (response.canceled) {
            system.run(() => showAddCameraEffectMenu(player, routePointData));
            return;
        }

        let duration = parseInt(response.formValues[0]);
        if (isNaN(duration) || duration <= 0) duration = 40;

        const newEffect = {
            type: "camera_blackout",
            duration: duration,
        };
        addEffectToRoutePoint(player, routePointData, newEffect);
    });
}

function showScreenFadeConfig(player, routePointData) {
    const form = new ModalFormData()
        .title("Screen Fade Settings")
        .textField("Duration (ticks)", "Default: 20");

    form.show(player).then((response) => {
        if (response.canceled) {
            system.run(() => showAddCameraEffectMenu(player, routePointData));
            return;
        }

        let duration = parseInt(response.formValues[0]);
        if (isNaN(duration) || duration <= 0) duration = 20;

        const newEffect = {
            type: "screen_fade",
            duration: duration,
        };
        addEffectToRoutePoint(player, routePointData, newEffect);
    });
}

function addEffectToRoutePoint(player, routePointData, newEffect) {
    const effects = routePointData.effects || [];
    effects.push(newEffect);
    updateRoutePoint(routePointData.location, routePointData.dimensionId, {
        effects: effects,
    });
    routePointData.effects = effects;

    player.sendMessage(


        dynamicToast(


            "§l§qSUCCESS",


            "§a[Route Point] §7Effect added!",


            "textures/fr_ui/approve_icon",


            "textures/fr_ui/approve_ui"


        )


    )
    player.playSound("random.orb", { pitch: 1.2, volume: 0.5 });
    system.run(() => showRPEffectsMenu(player, routePointData));
}


function showChangeRouteIdMenu(player, routePointData) {
    const form = new ModalFormData()
        .title("§l§6Change Route ID")
        .textField("§7Enter new Route ID:", "Enter a number", {
            defaultValue: routePointData.routeId?.toString() || "0",
        });

    form.show(player).then((response) => {
        if (response.canceled) {
            system.run(() =>
                showRPPointSettingsMenu(player, routePointData),
            );
            return;
        }

        const newRouteId = parseInt(response.formValues[0]);
        if (isNaN(newRouteId) || newRouteId < 0) {
            player.sendMessage(

                dynamicToast(

                    "§l§4ERROR",

                    "§7Invalid ID! Must be a positive number.",

                    "textures/fr_ui/deny_icon",

                    "textures/fr_ui/deny_ui"

                )

            )
            system.run(() =>
                showRPPointSettingsMenu(player, routePointData),
            );
            return;
        }


        const result = updateRoutePoint(
            routePointData.location,
            routePointData.dimensionId,
            { routeId: newRouteId },
        );

        if (result.success) {
            player.sendMessage(

                dynamicToast(

                    "§l§qSUCCESS",

                    `§a[Route Point] §7Route ID changed to §e${newRouteId}`,

                    "textures/fr_ui/approve_icon",

                    "textures/fr_ui/approve_ui"

                )

            )
            player.playSound("random.orb", { pitch: 1.2, volume: 0.5 });
            system.run(() =>
                showRPPointSettingsMenu(player, result.data),
            );
        } else {
            player.sendMessage(

                dynamicToast(

                    "§l§4ERROR",

                    "§7Failed to update route ID.",

                    "textures/fr_ui/deny_icon",

                    "textures/fr_ui/deny_ui"

                )

            )
            system.run(() =>
                showRPPointSettingsMenu(player, routePointData),
            );
        }
    });
}


function showDeleteThisPointConfirm(player, routePointData) {
    const form = new ActionFormData()
        .title("§l§cDelete Route Point")
        .body(
            `§7Are you sure you want to delete this route point?\n\n` +
            `§7Point: §e#${(routePointData.order ?? 0) + 1}\n` +
            `§7Location: §f${Math.floor(routePointData.location.x)}, ${Math.floor(routePointData.location.y)}, ${Math.floor(routePointData.location.z)}\n\n` +
            `§cThis action cannot be undone!`,
        );

    form.button("§cYes, Delete");
    form.button("§7Cancel");

    form.show(player).then((response) => {
        if (response.canceled || response.selection === 1) {
            system.run(() =>
                showRPDeleteOptionsMenu(player, routePointData),
            );
            return;
        }


        deleteRoutePoint(routePointData.location, routePointData.dimensionId);


        try {
            const dimension = world.getDimension(routePointData.dimensionId);
            const block = dimension.getBlock(routePointData.location);
            if (block && block.typeId === "fr:route_point") {
                block.setType("minecraft:air");
            }
        } catch (e) {
            console.warn("[Route Point] Error removing block:", e);
        }

        try {
            player.runCommand(`camera @s clear`);
            stopRoutePointCameraTracking(player.id);
        } catch (e) {
        }

        player.sendMessage(
            `§7Deleted point §e#${(routePointData.order ?? 0) + 1}`,
        );
        player.playSound("random.break", { pitch: 1.0, volume: 0.5 });
    });
}


function showDeleteAllPointsConfirm(player, routePointData) {
    const routeId = routePointData.routeId;
    const routePoints = getRoutePointsForRouteId(routeId);
    const pointCount = routePoints.length;

    const form = new ActionFormData()
        .title("§l§4Delete All Route Points")
        .body(
            `§7Are you sure you want to delete ALL route points for this route?\n\n` +
            `§7Route ID: §e${routeId}\n` +
            `§7Total Points: §c${pointCount}\n\n` +
            `§4⚠ This action cannot be undone!`,
        );

    form.button("§4Yes, Delete All");
    form.button("§7Cancel");

    form.show(player).then((response) => {
        if (response.canceled || response.selection === 1) {
            system.run(() =>
                showRPDeleteOptionsMenu(player, routePointData),
            );
            return;
        }


        let deletedCount = 0;
        for (const rp of routePoints) {
            try {

                const dimension = world.getDimension(rp.dimensionId);
                const block = dimension.getBlock(rp.location);
                if (block && block.typeId === "fr:route_point") {
                    block.setType("minecraft:air");
                }
            } catch (e) { }


            deleteRoutePoint(rp.location, rp.dimensionId);
            deletedCount++;
        }

        player.sendMessage(


            dynamicToast(


                "§l§4ERROR",


                `§c[Route Points] §7Deleted §e${deletedCount}§7 route points from route §e${routeId}`,


                "textures/fr_ui/deny_icon",


                "textures/fr_ui/deny_ui"


            )


        )
        player.playSound("random.break", { pitch: 0.8, volume: 0.7 });

        try {
            player.runCommand(`camera @s clear`);
            stopRoutePointCameraTracking(player.id);
        } catch (e) {
        }
    });
}


function showRoutePointPoseMenu(player, routePointData, page = 0) {
    const poses = getPosesForTypeId(routePointDataatronicTypeId);
    const currentPose = routePointData.pose ?? 0;

    const POSES_PER_PAGE_RP = 6;
    const totalPages = Math.ceil(poses.length / POSES_PER_PAGE_RP);
    const startIdx = page * POSES_PER_PAGE_RP;
    const pagePoses = poses.slice(startIdx, startIdx + POSES_PER_PAGE_RP);

    const form = new ActionFormData()
        .title(`§l§ePose Selection §7(${page + 1}/${totalPages})`)
        .body(`§7Select pose for route point #${(routePointData.order ?? 0) + 1}`);


    form.button(page > 0 ? "§e< Previous" : "§8< Previous");
    form.button(page < totalPages - 1 ? "§eNext >" : "§8Next >");


    for (const pose of pagePoses) {
        const poseIndex = poses.indexOf(pose);
        const isSelected = poseIndex === currentPose;
        form.button(isSelected ? `§z${pose.name}` : pose.name, pose.icon);
    }


    for (let i = pagePoses.length; i < POSES_PER_PAGE_RP; i++) {
        form.button(" ");
    }

    form.button("§7Back");

    form.show(player).then((response) => {
        if (response.canceled) return;

        const sel = response.selection;


        if (sel === 0 && page > 0) {
            system.run(() =>
                showRoutePointPoseMenu(player, routePointData, page - 1),
            );
            return;
        }


        if (sel === 1 && page < totalPages - 1) {
            system.run(() =>
                showRoutePointPoseMenu(player, routePointData, page + 1),
            );
            return;
        }


        if (sel === 2 + POSES_PER_PAGE_RP) {
            system.run(() => showRoutePointConfigMenu(player, routePointData));
            return;
        }


        const poseIdxInPage = sel - 2;
        if (poseIdxInPage >= 0 && poseIdxInPage < pagePoses.length) {
            const selectedPoseIndex = startIdx + poseIdxInPage;

            updateRoutePoint(routePointData.location, routePointData.dimensionId, {
                pose: selectedPoseIndex,
            });

            const updatedData = getRoutePointData(
                routePointData.location,
                routePointData.dimensionId,
            );
            player.sendMessage(

                dynamicToast(

                    "§l§qSUCCESS",

                    `§a[Route Point] §7Pose set to §e${poses[selectedPoseIndex].name}`,

                    "textures/fr_ui/approve_icon",

                    "textures/fr_ui/approve_ui"

                )

            )
            player.playSound("random.orb", { pitch: 1.2, volume: 0.5 });

            system.run(() => showRoutePointConfigMenu(player, updatedData));
        }
    });
}


function showRoutePointVariantMenu(player, routePointData, page = 0) {
    const variants = getVariantsForTypeId(routePointDataatronicTypeId);
    const currentVariant = routePointData.variant ?? 0;

    const VARIANTS_PER_PAGE_RP = 4;
    const totalPages = Math.ceil(variants.length / VARIANTS_PER_PAGE_RP);
    const startIdx = page * VARIANTS_PER_PAGE_RP;
    const pageVariants = variants.slice(
        startIdx,
        startIdx + VARIANTS_PER_PAGE_RP,
    );

    const form = new ActionFormData()
        .title(`§l§bVariant Selection §7(${page + 1}/${totalPages})`)
        .body(
            `§7Select variant for route point #${(routePointData.order ?? 0) + 1}`,
        );


    form.button(page > 0 ? "§e< Previous" : "§8< Previous");
    form.button(page < totalPages - 1 ? "§eNext >" : "§8Next >");


    for (const variant of pageVariants) {
        const variantIndex = variants.indexOf(variant);
        const isSelected = variantIndex === currentVariant;
        form.button(isSelected ? `§z${variant.name}` : variant.name, variant.icon);
    }


    for (let i = pageVariants.length; i < VARIANTS_PER_PAGE_RP; i++) {
        form.button(" ");
    }

    form.button("§7Back");

    form.show(player).then((response) => {
        if (response.canceled) return;

        const sel = response.selection;


        if (sel === 0 && page > 0) {
            system.run(() =>
                showRoutePointVariantMenu(player, routePointData, page - 1),
            );
            return;
        }


        if (sel === 1 && page < totalPages - 1) {
            system.run(() =>
                showRoutePointVariantMenu(player, routePointData, page + 1),
            );
            return;
        }


        if (sel === 2 + VARIANTS_PER_PAGE_RP) {
            system.run(() => showRoutePointConfigMenu(player, routePointData));
            return;
        }


        const variantIdxInPage = sel - 2;
        if (variantIdxInPage >= 0 && variantIdxInPage < pageVariants.length) {
            const selectedVariantIndex = startIdx + variantIdxInPage;

            updateRoutePoint(routePointData.location, routePointData.dimensionId, {
                variant: selectedVariantIndex,
            });

            const updatedData = getRoutePointData(
                routePointData.location,
                routePointData.dimensionId,
            );
            player.sendMessage(

                dynamicToast(

                    "§l§qSUCCESS",

                    `§a[Route Point] §7Variant set to §e${variants[selectedVariantIndex].name}`,

                    "textures/fr_ui/approve_icon",

                    "textures/fr_ui/approve_ui"

                )

            )
            player.playSound("random.orb", { pitch: 1.2, volume: 0.5 });

            system.run(() => showRoutePointConfigMenu(player, updatedData));
        }
    });
}


function showRoutePointRotationMenu(player, routePointData) {
    const currentRotation = routePointData.rotation ?? 0;
    const currentDegrees = rotationValueToDegrees(currentRotation);

    const form = new ActionFormData()
        .title("§l§dRotation")
        .body(
            `§7Current rotation: §d${currentDegrees}°\n\n§7Select facing direction:`,
        );


    form.button("§cSouth (0°)\n§7Facing +Z", "textures/fr_ui/direction_south");
    form.button("§bWest (90°)\n§7Facing -X", "textures/fr_ui/direction_west");
    form.button("§aNorth (180°)\n§7Facing -Z", "textures/fr_ui/direction_north");
    form.button("§eEast (270°)\n§7Facing +X", "textures/fr_ui/direction_east");
    form.button("§dCustom Angle\n§7Enter specific degrees");
    form.button("§7Back");

    form.show(player).then((response) => {
        if (response.canceled || response.selection === 5) {
            system.run(() => showRoutePointConfigMenu(player, routePointData));
            return;
        }

        let newRotation = 0;

        switch (response.selection) {
            case 0:
                newRotation = 0;
                break;
            case 1:
                newRotation = 90;
                break;
            case 2:
                newRotation = 180;
                break;
            case 3:
                newRotation = 270;
                break;
            case 4:
                system.run(() => showCustomRotationInput(player, routePointData));
                return;
        }

        updateRoutePoint(routePointData.location, routePointData.dimensionId, {
            rotation: newRotation,
        });
        startRotationPreview(player, routePointData.location, routePointData.dimensionId, newRotation);

        const updatedData = getRoutePointData(
            routePointData.location,
            routePointData.dimensionId,
        );
        const directions = ["North", "East", "South", "West"];
        player.sendMessage(

            dynamicToast(

                "§l§qSUCCESS",

                `§a[Route Point] §7Rotation set to §e${directions[response.selection]}`,

                "textures/fr_ui/approve_icon",

                "textures/fr_ui/approve_ui"

            )

        )
        player.playSound("random.orb", { pitch: 1.2, volume: 0.5 });

        system.run(() => showRoutePointConfigMenu(player, updatedData));
    });
}


function showCustomRotationInput(player, routePointData) {
    const currentDegrees = rotationValueToDegrees(routePointData.rotation ?? 0);

    const form = new ModalFormData()
        .title("§l§dCustom Rotation")
        .slider("Rotation (degrees)", 0, 359, 1, currentDegrees);

    form.show(player).then((response) => {
        if (response.canceled) {
            system.run(() =>
                showRoutePointConfigMenu(player, routePointData, "rotation"),
            );
            return;
        }

        const degrees = response.formValues[0];

        updateRoutePoint(routePointData.location, routePointData.dimensionId, {
            rotation: degrees,
        });
        startRotationPreview(player, routePointData.location, routePointData.dimensionId, degrees);

        const updatedData = getRoutePointData(
            routePointData.location,
            routePointData.dimensionId,
        );
        player.sendMessage(

            dynamicToast(

                "§l§qSUCCESS",

                `§a[Route Point] §7Rotation set to §e${degrees}°`,

                "textures/fr_ui/approve_icon",

                "textures/fr_ui/approve_ui"

            )

        )
        player.playSound("random.orb", { pitch: 1.2, volume: 0.5 });

        system.run(() => showRoutePointConfigMenu(player, updatedData, "rotation"));
    });
}

