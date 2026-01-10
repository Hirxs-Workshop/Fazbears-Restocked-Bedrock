/**
 * FAZBEAR'S RESTOCKED - BEDROCK
 * ©2025
 * 
 * If you want to modify or use this system as a base, contact the code developer, 
 * Hyrxs (discord: hyrxs), for more information and authorization
 * 
 * DO NOT COPY OR STEAL, ty :>
 *  
*/

import { world, system } from "@minecraft/server";
import { ActionFormData, ModalFormData, uiManager } from "@minecraft/server-ui";
import { dynamicToast, showCameraLoading, showFazTabOpen, showFazTabClose, toast } from "../utils.js";
import { getGeneratorAt, getActiveGeneratorConsumers, hideGeneratorHud, hideClockHud, getPlayerGeneratorHud, showGeneratorHud, getPlayerClockHud, showClockHud, setCustomNight } from "../connection_system/main_system.js";
import { MAX_ENERGY } from "../connection_system/connection_types.js";

class SecurityCameraSystem {
  constructor() {
    this.selections = {};
    this.connections = new Map();
    this.viewers = new Set();
    this.pendingExit = new Set();
    this.viewSessions = new Map();
    this.PC_EXIT_RADIUS = 32;
    this.PC_EXIT_RADIUS_SQUARED = 1024;
    this.viewYaw = new Map();
    this.autoPan = new Map();
    this.cameraLocks = new Map();
    this.baseRotations = new Map();
    this.baseYaw = new Map();
    this.AUTO_PAN_SPEED = 0.8;
    this.AUTO_PAN_RANGE = 85;
    this.AUTO_PAN_DWELL_TICKS = 40;
    this.blockUpdateCounter = new Map();
    this.BLOCK_UPDATE_INTERVAL = 5;
    this.DEG_TO_RAD = Math.PI / 180;
    this.tickInterval = null;
    this.cleanupInterval = null;
    this.cameraSetVariant = new Map();
    this.cameraAnimateVariant = new Map();
    this.lastAppliedYaw = new Map();
    this.cameraSettings = new Map();
    this.flashlightActive = new Map();
    this.flashlightBlocks = new Map();
    this.FLASHLIGHT_RANGE = 5;
    this.pcModes = new Map();
    this.pcGeneratorConnections = new Map();
    this.pausedGeneratorHuds = new Map();
    this.pausedClockHuds = new Map();
    this.hudUpdateCounter = 0;
    this.tapeEjectPlaying = new Map();
    this.TAPE_EJECT_CHANCE = 0.05;
    this.TAPE_EJECT_CHECK_INTERVAL = 20;
  }

  loadPcGeneratorConnections() {
    try {
      const json = world.getDynamicProperty("fr:pc_generator_connections");
      if (json) {
        const data = JSON.parse(json);
        this.pcGeneratorConnections = new Map(data);
      }
    } catch { }
  }

  savePcGeneratorConnections() {
    try {
      const data = Array.from(this.pcGeneratorConnections.entries());
      world.setDynamicProperty("fr:pc_generator_connections", JSON.stringify(data));
    } catch { }
  }

  connectPcToGenerator(player, pcBlock, generatorPos) {
    const pcPosStr = this.locStr(this.posOf(pcBlock));
    this.pcGeneratorConnections.set(pcPosStr, generatorPos);
    this.savePcGeneratorConnections();

    player.sendMessage(
      dynamicToast(
        "§l§eLINKED",
        `§6PC linked to Generator\n§7Generator: ${generatorPos.x}, ${generatorPos.y}, ${generatorPos.z}`,
        "textures/fr_ui/unlinked_icon",
        "textures/fr_ui/unlinked_ui"
      )
    );
  }

  getGeneratorForPc(pcPosStr) {
    return this.pcGeneratorConnections.get(pcPosStr);
  }

  async getWorldTimeLabelsAsync(player) {
    let day;
    let daytime;
    try {
      if (typeof world.getTimeOfDay === 'function') {
        try { daytime = world.getTimeOfDay(player.dimension); } catch { }
        if (daytime === undefined) daytime = world.getTimeOfDay();
      }
    } catch { }
    try {
      if (typeof world.getDay === 'function') {
        try { day = world.getDay(player.dimension); } catch { }
        if (day === undefined) day = world.getDay();
      }
    } catch { }
    try {
      if (day === undefined) {
        const res = player.runCommand?.("time query day");
        const msg = res?.statusMessage ?? res?.statusText ?? res?.message;
        const n = this.extractNumber(msg);
        if (typeof n === 'number') day = n;
      }
    } catch { }
    try {
      if (daytime === undefined) {
        const res = player.runCommand?.("time query daytime");
        const msg = res?.statusMessage ?? res?.statusText ?? res?.message;
        const n = this.extractNumber(msg);
        if (typeof n === 'number') daytime = n;
      }
    } catch { }
    try {
      if (day === undefined && player.runCommandAsync) {
        const res = await player.runCommandAsync("time query day");
        const msg = res?.statusMessage ?? res?.statusText ?? res?.message;
        const n = this.extractNumber(msg);
        if (typeof n === 'number') day = n;
      }
    } catch { }
    try {
      if (daytime === undefined && player.runCommandAsync) {
        const res = await player.runCommandAsync("time query daytime");
        const msg = res?.statusMessage ?? res?.statusText ?? res?.message;
        const n = this.extractNumber(msg);
        if (typeof n === 'number') daytime = n;
      }
    } catch { }
    if (daytime === undefined) daytime = 0;
    if (day === undefined) day = 0;
    return {
      period: this.formatPeriod(daytime, day),
      clock: this.formatClock(daytime),
    };
  }

  extractNumber(text) {
    try {
      if (!text) return undefined;
      const m = String(text).match(/-?\d+/);
      if (!m) return undefined;
      return Number(m[0]);
    } catch { return undefined; }
  }

  formatPeriod(daytime, day) {
    try {
      const hour24 = Math.floor(((daytime % 24000) / 1000 + 6) % 24);
      const isDay = hour24 >= 6 && hour24 < 18;
      const label = isDay ? "Day" : "Night";
      const dayIndex = (day ?? 0) + 1;
      return `${label} ${dayIndex}`;
    } catch { return ""; }
  }

  formatClock(daytime) {
    try {
      const hour24 = Math.floor(((daytime % 24000) / 1000 + 6) % 24);
      let h = hour24 % 12; if (h === 0) h = 12;
      const ampm = hour24 < 12 ? " AM" : " PM";
      return `${h}${ampm}`;
    } catch { return ""; }
  }

  initialize() {
    world.afterEvents.playerInteractWithBlock.subscribe((event) => this.onBlockInteract(event));
    world.afterEvents.pistonActivate.subscribe((event) => this.onPistonActivate(event));
    system.run(() => {
      this.loadConnections();
      this.loadPcGeneratorConnections();
    });
  }

  startCameraIntervals() {
    if (this.tickInterval !== null) return;
    this.tickInterval = system.runInterval(() => {
      if (this.viewers.size === 0) {
        this.stopCameraIntervals();
        return;
      }
      this.tickExitByCrouch();
    }, 1);

    if (this.cleanupInterval === null) {
      this.cleanupInterval = system.runInterval(() => {
        if (this.viewers.size === 0 && this.cameraLocks.size === 0) {
          if (this.cleanupInterval !== null) {
            system.clearRun(this.cleanupInterval);
            this.cleanupInterval = null;
          }
          return;
        }
        this.cleanupOrphanedLocks();
      }, 100);
    }
  }

  stopCameraIntervals() {
    if (this.tickInterval !== null) {
      system.clearRun(this.tickInterval);
      this.tickInterval = null;
    }
  }

  ensureCameraIntervals() {
    if (this.viewers.size > 0) {
      this.startCameraIntervals();
    }
  }

  cleanupOrphanedLocks() {
    try {
      if (this.cameraLocks.size === 0 && this.viewers.size === 0) return;

      const activePlayers = new Set(world.getPlayers().map(p => p.id));

      for (const [camPos, playerId] of this.cameraLocks.entries()) {
        if (!activePlayers.has(playerId)) {
          this.cameraLocks.delete(camPos);
        } else {
          const session = this.viewSessions.get(playerId);
          const isValid = session && session.cam === camPos && this.viewers.has(playerId);
          if (!isValid) {
            this.cameraLocks.delete(camPos);
          }
        }
      }

      for (const playerId of this.viewers) {
        if (!activePlayers.has(playerId)) {
          const session = this.viewSessions.get(playerId);
          const initialRotation = this.baseRotations.get(playerId);
          if (session && session.cam && initialRotation !== undefined) {
            try {
              const dimension = world.getDimension(session.dim);
              const camBlock = this.blockFromLocStr(dimension, session.cam);
              if (camBlock && camBlock.typeId === "fr:security_cameras") {
                const currentRotation = camBlock.permutation.getState("fr:rotation");
                if (currentRotation !== initialRotation) {
                  const newPerm = camBlock.permutation.withState("fr:rotation", initialRotation);
                  camBlock.setPermutation(newPerm);
                }
              }
            } catch { }
          }

          this.viewers.delete(playerId);
          this.viewSessions.delete(playerId);
          this.viewYaw.delete(playerId);
          this.autoPan.delete(playerId);
          this.baseRotations.delete(playerId);
          this.baseYaw.delete(playerId);
          this.blockUpdateCounter.delete(playerId);

          this.removeFlashlightBlocks(playerId);
          this.flashlightActive.delete(playerId);
          this.tapeEjectPlaying.delete(playerId);
        }
      }
    } catch { }
  }

  toggleFlashlight(player, camPosStr, dimension) {
    try {
      const pid = player.id;
      const isActive = this.flashlightActive.get(pid) || false;

      if (isActive) {
        this.removeFlashlightBlocks(pid, dimension);
        this.flashlightActive.set(pid, false);
      } else {
        this.placeFlashlightBlocks(player, camPosStr, dimension);
        this.flashlightActive.set(pid, true);
      }
    } catch (e) {
      console.warn(e);
      this.flashlightActive.set(player.id, false);
      this.removeFlashlightBlocks(player.id, dimension);
    }
  }

  placeFlashlightBlocks(player, camPosStr, dimension) {
    try {
      const pid = player.id;
      this.removeFlashlightBlocks(pid, dimension);

      const cam = this.blockFromLocStr(dimension, camPosStr);
      if (!cam || cam.typeId !== "fr:security_cameras") return;

      const baseYawValue = this.baseYaw.get(pid);
      if (baseYawValue === undefined) return;

      const currentYawOffset = this.viewYaw.get(pid) ?? 0;
      const finalYaw = baseYawValue + currentYawOffset;
      const yawRad = finalYaw * this.DEG_TO_RAD;
      const sinYaw = Math.sin(yawRad);
      const cosYaw = Math.cos(yawRad);

      const settings = this.cameraSettings.get(camPosStr) ?? { verticalPitch: 0, rotationRange: 85, autoRotate: true };
      const pitch = settings.verticalPitch ?? 0;
      const pitchRad = -pitch * this.DEG_TO_RAD;
      const cosPitch = Math.cos(pitchRad);
      const sinPitch = Math.sin(pitchRad);

      const camLoc = cam.location;
      const startX = camLoc.x + 0.5;
      const startY = camLoc.y + 0.6;
      const startZ = camLoc.z + 0.5;

      const blocks = [];

      for (let i = 1; i <= this.FLASHLIGHT_RANGE; i++) {
        const distance = i * 0.8;
        const x = Math.floor(startX - sinYaw * distance * cosPitch);
        const y = Math.floor(startY + sinPitch * distance);
        const z = Math.floor(startZ + cosYaw * distance * cosPitch);

        const blockPos = { x, y, z };
        const block = dimension.getBlock(blockPos);

        if (block && block.typeId === "minecraft:air") {
          try {
            block.setType("minecraft:light_block");
            const perm = block.permutation.withState("block_light_level", 15);
            block.setPermutation(perm);
            blocks.push({ x, y, z });
          } catch { }
        }
      }

      this.flashlightBlocks.set(pid, blocks);
    } catch (e) {
      console.warn(e);
    }
  }

  removeFlashlightBlocks(playerId, dimension = null) {
    try {
      const blocks = this.flashlightBlocks.get(playerId);
      if (!blocks || blocks.length === 0) return;

      if (!dimension) {
        const session = this.viewSessions.get(playerId);
        if (!session) {
          this.flashlightBlocks.delete(playerId);
          return;
        }
        dimension = world.getDimension(session.dim);
      }

      if (!dimension) {
        this.flashlightBlocks.delete(playerId);
        return;
      }

      for (const pos of blocks) {
        try {
          const block = dimension.getBlock(pos);
          if (block && (block.typeId.includes("light_block") || block.typeId === "minecraft:light_block")) {
            block.setType("minecraft:air");
          }
        } catch { }
      }

      this.flashlightBlocks.delete(playerId);
    } catch (e) {
      console.warn(e);
      this.flashlightBlocks.delete(playerId);
    }
  }

  onBlockInteract(event) {
    const { player, block, itemStack } = event;
    if (!player || !block) return;

    const blockId = block.typeId;
    const itemId = itemStack?.typeId;

    if (blockId === "fr:security_cameras") {
      if (itemId === "fr:faz-diver_security") {
        this.selectCamera(player, block);
      }
      return;
    }

    if (blockId === "fr:generator" || blockId === "fr:sotm_generator") {
      if (itemId === "fr:faz-diver_security") {
        this.selectGenerator(player, block);
      }
      return;
    }

    if (blockId === "fr:old_pc" || blockId === "fr:black_old_pc") {
      if (itemId === "fr:faz-diver_security") {
        const sel = this.selections[player.id];
        if (sel && sel.type === "generator") {
          this.connectPcToGenerator(player, block, sel.pos);
          delete this.selections[player.id];
        } else {
          this.connectPcToSelectedCamera(player, block);
        }
        return;
      }

      if (itemId === "fr:faz-tab") {
        return;
      }

      const pcPosStr = this.locStr(this.posOf(block));

      if (player.isSneaking) {
        const currentMode = this.pcModes.get(pcPosStr) ?? "normal";
        const newMode = currentMode === "normal" ? "instant" : "normal";
        this.pcModes.set(pcPosStr, newMode);

        if (newMode === "normal") {
          player.sendMessage(
            dynamicToast(
              "§l§aPC MODE",
              "§qNormal Mode\n§7Opens PC menu first",
              "textures/fr_ui/old_pc_icon",
              "textures/fr_ui/approve_ui"
            )
          );
        } else {
          player.sendMessage(
            dynamicToast(
              "§l§ePC MODE",
              "§6Instant Cameras\n§7Direct camera access",
              "textures/fr_ui/security_camera_icon",
              "textures/fr_ui/unlinked_ui"
            )
          );
        }
        return;
      }

      const mode = this.pcModes.get(pcPosStr) ?? "normal";
      if (mode === "instant") {
        this.directCameraView(player, block);
      } else {
        this.viewThroughLinkedCamera(player, block);
      }
      return;
    }
  }

  onPistonActivate(event) {
    try {
      const { piston, isExpanding } = event;
      if (!piston || !isExpanding) return;

      let attachedLocations = [];
      try {
        attachedLocations = piston.getAttachedBlocksLocations();
      } catch (e) {
        try {
          const blocks = piston.getAttachedBlocks();
          attachedLocations = blocks.map(b => b.location);
        } catch { }
      }

      if (!attachedLocations || attachedLocations.length === 0) return;

      const pistonBlock = piston.block;
      if (!pistonBlock) return;
      const dimension = pistonBlock.dimension;

      for (const loc of attachedLocations) {
        try {
          const block = dimension.getBlock(loc);
          if (!block || block.typeId !== "fr:security_cameras") continue;

          const camPosStr = this.locStr({ x: Math.floor(loc.x), y: Math.floor(loc.y), z: Math.floor(loc.z) });

          for (const [playerId, session] of this.viewSessions.entries()) {
            if (session.cam === camPosStr) {
              const player = world.getPlayers().find(p => p.id === playerId);
              if (player) {
                try {
                  const list = this.connections.get(session.pc) ?? [];
                  const idxInList = list.indexOf(camPosStr);
                  if (idxInList > -1) list.splice(idxInList, 1);
                  this.connections.set(session.pc, list);
                  this.saveConnections();

                  if (list.length > 0) {
                    this.autoPan.set(playerId, { offset: 0, dir: 1, dwell: 0 });
                    this.baseRotations.delete(playerId);
                    this.baseYaw.delete(playerId);
                    try { this.cameraLocks.delete(session.cam); } catch { }
                    try { uiManager.closeAllForms(player); } catch { }
                    const nextIdx = Math.min(Math.max(idxInList, 0), list.length - 1);
                    const nextCam = list[nextIdx] ?? list[0];
                    this.viewYaw.set(player.id, 0);
                    const fromFazTab = session.fromFazTab === true;
                    const directMode = session.directMode === true;
                    try { player.playSound("camera_select"); } catch { }
                    this.applyView(player, dimension, nextCam, session.pc, fromFazTab, directMode);
                  } else {
                    this.exitViewDueToCameraMovement(player, camPosStr);
                  }
                } catch {
                  this.exitViewDueToCameraMovement(player, camPosStr);
                }
              }
            }
          }

          system.runTimeout(() => {
            for (const [pcPosStr, camList] of this.connections.entries()) {
              const index = camList.indexOf(camPosStr);
              if (index > -1) {
                camList.splice(index, 1);
                this.connections.set(pcPosStr, camList);
              }
            }
            this.saveConnections();
          }, 10);
        } catch { }
      }
    } catch { }
  }

  selectCamera(player, block) {
    const pos = this.posOf(block);
    this.selections[player.id] = {
      pos,
      type: "camera",
    };

    player.sendMessage(
      dynamicToast(
        "§l§aCAMERA SELECTED",
        `§qID: §f§ffr:security_cameras\n§qPos: §f${pos.x}, ${pos.y}, ${pos.z}`,
        "textures/fr_ui/approve_icon",
        "textures/fr_ui/approve_ui"
      )
    );
  }

  selectGenerator(player, block) {
    const pos = this.posOf(block);
    this.selections[player.id] = {
      pos,
      type: "generator",
    };

    player.sendMessage(
      dynamicToast(
        "§l§eGENERATOR SELECTED",
        `§6ID: §f${block.typeId}\n§6Pos: §f${pos.x}, ${pos.y}, ${pos.z}`,
        "textures/fr_ui/selection_icon",
        "textures/fr_ui/unlinked_ui"
      )
    );
  }

  connectPcToSelectedCamera(player, pcBlock) {
    const sel = this.selections[player.id];
    if (!sel || sel.type !== "camera") {
      player.sendMessage(toast.error("Select a camera first with the faz-diver (security)"));
      return;
    }

    const cameraPosStr = this.locStr(sel.pos);
    const pcPosStr = this.locStr(this.posOf(pcBlock));

    const list = this.connections.get(pcPosStr) ?? [];
    if (!list.includes(cameraPosStr)) list.push(cameraPosStr);
    this.connections.set(pcPosStr, list);
    this.saveConnections();

    delete this.selections[player.id];

    player.sendMessage(
      dynamicToast(
        "§l§eLINKED",
        `§6PC: §f${pcPosStr}\n§6Camera: §f${cameraPosStr}`,
        "textures/fr_ui/unlinked_icon",
        "textures/fr_ui/unlinked_ui"
      )
    );
  }

  showLockedPcUI(player, pcBlock) {
    try {
      const showLockedForm = () => {
        try { player.runCommand(`hud @s hide all`); } catch { }

        const form = new ActionFormData()
          .title("§r§f§l§p§c")
          .body("");

        form.label("tx:welcome_textures/fr_ui/welcome_text_terminal");
        form.label("tx:hero_textures/fr_ui/fr_info_img");
        form.label("tx:banner_textures/fr_ui/system_badge");

        form.label("sys:name_§0Fazbear-OS");
        form.label("sys:build_§0First edition");
        form.label("sys:ver_§01.21.110 A");

        form.label("reg:name_§0PlayerName");
        form.label("reg:id_§000 0-000-000");

        form.label(`pc:cpu_§0GenuineIntel`);
        form.label("pc:model_§0Pentium(R) II");
        form.label("pc:ram_§064.00MB RAM");

        form.label("cr:sub_");
        form.label(`cr:txt_§0§lHead Director§r§0
- Polarfrederick

§lAssistant Director§r§0
- Kristoffer1976

§lMain Developer§r§0
- Hyrxs

§lConcept art§r§0
- Electro1987
- Guipcbonnie

§lMusic/Sound Designer§r§0
- Werty_is_me
- Foxlyticalxd

§lAnimator§r§0
- M.forbidden.
- elta_51

§lCoders§r§0
- Sgtsarnt3
- Warden45._31258

§lTexture designer§r§0
- Mansam47
- Kilokegor
- Guipcbonnie
- Foxisgaming_
- Firecaptain221
- Polarfrederick
- Hyrxs
- Kristoffer1976
- tin__fly
- fantasticbob_mc

§lBlock Modeler§r§0
- Mansam47
- Kilokegor
- Guipcbonnie
- Foxisgaming_
- Firecaptain221
- Polarfrederick
- Hyrxs
- Kristoffer1976





`);

        this.getWorldTimeLabelsAsync(player).then((labels) => {
          try {
            form.label(`dock:right3_§l${labels.clock}\n§r${labels.period}`);
            form.label("dock:right2_§lFaz-diver:\n§rNo found!");
            form.label(`dock:right_§lUser:\n§r${player?.nameTag ?? player?.name ?? "Player"}`);
          } catch { }
          return form.show(player);
        }).catch(() => {
          try { form.label("dock:right_"); } catch { }
          return form.show(player);
        }).then((res) => {
          this.resetPlayerCamera(player);
        }).catch(() => {
          this.resetPlayerCamera(player);
        });
      };

      try { player.runCommand(`camera @s fov_set 30`); } catch { }
      const animated = this.animatePcApproach(player, pcBlock);
      if (animated) {
        system.runTimeout(() => showLockedForm(), 40);
      } else {
        showLockedForm();
      }
    } catch {
      this.resetPlayerCamera(player);
    }
  }

  showNoCamerasUI(player, pcBlock, skipAnimation = false) {
    try {
      const showNoCamerasForm = () => {
        try { player.runCommand(`hud @s hide all`); } catch { }

        const form = new ActionFormData()
          .title("§O§L§D§P§C")
          .body("§7No cameras connected to this PC");

        form.button("bt:d_Open camera", "textures/fr_ui/security_camera_icon_locked");
        form.button("bt:d_Manage cameras", "textures/fr_ui/gear_locked");
        form.button("bt:g_Changelog", "textures/fr_ui/folder_icon");

        form.label("tx:welcome_textures/fr_ui/welcome_text_terminal");
        form.label("tx:hero_textures/fr_ui/fr_info_img");
        form.label("tx:banner_textures/fr_ui/system_badge");

        form.label("sys:name_§0Fazbear-OS");
        form.label("sys:build_§0First edition");
        form.label("sys:ver_§01.21.110 A");

        form.label("reg:name_§0PlayerName");
        form.label("reg:id_§0000-000-000");

        form.label(`pc:cpu_§0GenuineIntel`);
        form.label("pc:model_§0Pentium(R) II");
        form.label("pc:ram_§064.00MB RAM");

        form.label("cr:sub_");
        form.label(`cr:txt_§0§lHead Director§r§0
- Polarfrederick

§lAssistant Director§r§0
- Kristoffer1976

§lMain Developer§r§0
- Hyrxs

§lConcept art§r§0
- Electro1987
- Guipcbonnie

§lMusic/Sound Designer§r§0
- Werty_is_me
- Foxlyticalxd

§lAnimator§r§0
- M.forbidden.
- elta_51

§lCoders§r§0
- Sgtsarnt3
- Warden45._31258

§lTexture designer§r§0
- Mansam47
- Kilokegor
- Guipcbonnie
- Foxisgaming_
- Firecaptain221
- Polarfrederick
- Hyrxs
- Kristoffer1976
- tin__fly
- fantasticbob_mc

§lBlock Modeler§r§0
- Mansam47
- Kilokegor
- Guipcbonnie
- Foxisgaming_
- Firecaptain221
- Polarfrederick
- Hyrxs
- Kristoffer1976






`);

        this.getWorldTimeLabelsAsync(player).then((labels) => {
          try {
            form.label(`dock:right3_§l${labels.clock}\n§r${labels.period}`);
            form.label("dock:right2_§lFaz-diver:\n§rNo found!");
            form.label(`dock:right_§lUser:\n§r${player?.nameTag ?? player?.name ?? "Player"}`);
          } catch { }
          return form.show(player);
        }).catch(() => {
          try { form.label("dock:right_"); } catch { }
          return form.show(player);
        }).then((res) => {
          if (res.canceled) {
            this.resetPlayerCamera(player);
            return;
          }
          const idx = res.selection;
          if (idx === 2) {
            this.showChangelog(player, pcBlock);
            return;
          }
          this.resetPlayerCamera(player);
        }).catch(() => {
          this.resetPlayerCamera(player);
        });
      };

      if (skipAnimation) {
        showNoCamerasForm();
      } else {
        try { player.runCommand(`camera @s fov_set 30`); } catch { }
        const animated = this.animatePcApproach(player, pcBlock);
        if (animated) {
          system.runTimeout(() => showNoCamerasForm(), 40);
        } else {
          showNoCamerasForm();
        }
      }
    } catch {
      this.resetPlayerCamera(player);
    }
  }

  showPcMainMenu(player, pcBlock, skipAnimation = false) {
    try {
      const pcPosStr = this.locStr(this.posOf(pcBlock));
      let camList = this.connections.get(pcPosStr);

      if (camList && camList.length > 0) {
        const validCameras = [];
        for (const camPosStr of camList) {
          const camBlock = this.blockFromLocStr(pcBlock.dimension, camPosStr);
          if (camBlock && camBlock.typeId === "fr:security_cameras") {
            validCameras.push(camPosStr);
          }
        }

        if (validCameras.length !== camList.length) {
          this.connections.set(pcPosStr, validCameras);
          this.saveConnections();
          camList = validCameras;
        }
      }

      if (!camList || camList.length === 0) {
        this.showNoCamerasUI(player, pcBlock, skipAnimation);
        return;
      }

      const showMainForm = () => {
        try { player.runCommand(`hud @s hide all`); } catch { }

        const form = new ActionFormData().title("§O§L§D§P§C").body("§7Open the primary camera or manage links");
        form.button("bt:b_Open camera", "textures/fr_ui/security_camera_icon");
        form.button("bt:g_Manage cameras", "textures/fr_ui/gear");
        form.button("bt:g_Changelog", "textures/fr_ui/folder_icon");

        form.label("tx:welcome_textures/fr_ui/welcome_text_terminal");

        form.label("tx:hero_textures/fr_ui/fr_info_img");
        form.label("tx:banner_textures/fr_ui/system_badge");

        form.label("sys:name_§0Fazbear-OS");
        form.label("sys:build_§0First edition");
        form.label("sys:ver_§01.21.110 A");

        form.label("reg:name_§0PlayerName");
        form.label("reg:id_§0000-000-000");

        form.label(`pc:cpu_§0GenuineIntel`);
        form.label("pc:model_§0Pentium(R) II");
        form.label("pc:ram_§064.00MB RAM");

        form.label("cr:sub_");
        form.label(`cr:txt_§0§lHead Director§r§0
- Polarfrederick

§lAssistant Director§r§0
- Kristoffer1976

§lMain Developer§r§0
- Hyrxs

§lConcept art§r§0
- Electro1987
- Guipcbonnie

§lMusic/Sound Designer§r§0
- Werty_is_me
- Foxlyticalxd

§lAnimator§r§0
- M.forbidden.
- elta_51

§lCoders§r§0
- Sgtsarnt3
- Warden45._31258

§lTexture designer§r§0
- Mansam47
- Kilokegor
- Guipcbonnie
- Foxisgaming_
- Firecaptain221
- Polarfrederick
- Hyrxs
- Kristoffer1976
- tin__fly
- fantasticbob_mc

§lBlock Modeler§r§0
- Mansam47
- Kilokegor
- Guipcbonnie
- Foxisgaming_
- Firecaptain221
- Polarfrederick
- Hyrxs
- Kristoffer1976






`);
        this.getWorldTimeLabelsAsync(player).then((labels) => {
          try {
            form.label(`dock:right3_§l${labels.clock}\n§r${labels.period}`);
            form.label("dock:right2_§lFaz-diver:\n§rNo found!");
            form.label(`dock:right_§lUser:\n§r${player?.nameTag ?? player?.name ?? "Player"}`);
          } catch { }
          return form.show(player);
        }).catch(() => {
          try { form.label("dock:right_"); } catch { }
          return form.show(player);
        }).then((res) => {
          if (res.canceled) { this.resetPlayerCamera(player); return; }
          const idx = res.selection;
          if (idx === undefined) { this.resetPlayerCamera(player); return; }
          if (idx === 0) {
            const target = camList[0];
            if (!target) { this.resetPlayerCamera(player); return; }

            showCameraLoading(player);

            system.runTimeout(() => {
              this.viewYaw.set(player.id, 0);
              this.applyView(player, pcBlock.dimension, target, pcPosStr);
            }, 0);

            return;
          }
          if (idx === 1) {
            this.manageCameras(player, pcBlock);
            return;
          }
          if (idx === 2) {
            this.showChangelog(player, pcBlock);
            return;
          }
          this.resetPlayerCamera(player);
        }).catch(() => { });
      };

      if (skipAnimation) {
        showMainForm();
      } else {
        try { player.runCommand(`camera @s fov_set 30`); } catch { }
        const animated = this.animatePcApproach(player, pcBlock);
        if (animated) {
          system.runTimeout(() => showMainForm(), 40);
        } else {
          showMainForm();
        }
      }
    } catch { }
  }

  viewThroughLinkedCamera(player, pcBlock) {
    this.showPcMainMenu(player, pcBlock, false);
  }

  directCameraView(player, pcBlock) {
    const pcPosStr = this.locStr(this.posOf(pcBlock));
    const camList = this.connections.get(pcPosStr);

    if (!camList || camList.length === 0) {
      player.sendMessage(
        dynamicToast(
          "§l§cNO CAMERAS",
          "§7This PC has no cameras linked",
          "textures/fr_ui/deny_icon",
          "textures/fr_ui/deny_ui"
        )
      );
      return;
    }

    const firstCamera = camList[0];
    const camBlock = this.blockFromLocStr(pcBlock.dimension, firstCamera);

    if (!camBlock || camBlock.typeId !== "fr:security_cameras") {
      player.sendMessage(
        dynamicToast(
          "§l§cERROR",
          "§cCamera not found or destroyed",
          "textures/fr_ui/deny_icon",
          "textures/fr_ui/deny_ui"
        )
      );
      return;
    }

    this.viewYaw.set(player.id, 0);
    this.applyView(player, pcBlock.dimension, firstCamera, pcPosStr, false, true);
  }

  applyView(player, dimension, camPosStr, pcPosStr, fromFazTab = false, directMode = false) {
    const pid = player.id;

    if (this.flashlightActive.get(pid)) {
      this.removeFlashlightBlocks(pid, dimension);
      this.flashlightActive.set(pid, false);
    }

    const camBlock = this.blockFromLocStr(dimension, camPosStr);
    if (!camBlock || camBlock.typeId !== "fr:security_cameras") {
      const camList = this.connections.get(pcPosStr) ?? [];
      const index = camList.indexOf(camPosStr);
      if (index > -1) {
        camList.splice(index, 1);
        this.connections.set(pcPosStr, camList);
        this.saveConnections();
      }

      if (camList.length > 0) {
        this.viewYaw.set(player.id, 0);
        system.run(() => this.applyView(player, dimension, camList[0], pcPosStr, fromFazTab, directMode));
      } else {
        try { player.runCommand(`camera @s clear`); } catch { }
        try { player.runCommand(`camera @s fade time 0 0 0`); } catch { }
        try { player.runCommand(`camera @s fov_reset`); } catch { }
        try { player.runCommand(`hud @s reset`); } catch { }

        player.sendMessage(
          dynamicToast(
            "§l§cNO CAMERAS",
            "§7This PC has no cameras linked",
            "textures/fr_ui/deny_icon",
            "textures/fr_ui/deny_ui"
          )
        );
      }
      return;
    }

    const lockOwner = this.cameraLocks.get(camPosStr);
    if (lockOwner && lockOwner !== player.id) {
      const ownerSession = this.viewSessions.get(lockOwner);
      const isValidLock = ownerSession && ownerSession.cam === camPosStr && this.viewers.has(lockOwner);

      if (!isValidLock) {
        this.cameraLocks.delete(camPosStr);
      } else {
        const ownerPlayer = world.getPlayers().find(p => p.id === lockOwner);
        if (!ownerPlayer) {
          this.cameraLocks.delete(camPosStr);
        } else {
          try { player.runCommand(`camera @s clear`); } catch { }
          try { player.runCommand(`camera @s fade time 0 0 0`); } catch { }
          try { player.runCommand(`camera @s fov_reset`); } catch { }
          try { player.runCommand(`hud @s reset`); } catch { }

          player.sendMessage(
            dynamicToast(
              "§l§cCAMERA IN USE",
              "§7This camera is being used by another player",
              "textures/fr_ui/deny_icon",
              "textures/fr_ui/deny_ui"
            )
          );
          return;
        }
      }
    }

    const initialRotation = camBlock.permutation.getState("fr:rotation");
    const basePose = this.frontPoseOf(camBlock);

    const alreadyViewing = this.viewers.has(pid);
    if (alreadyViewing) {
      this.viewYaw.set(pid, 0);
    }

    const finish = () => {
      if (!alreadyViewing) {
        try { player.playSound("monitor_close"); } catch { }
      }

      this.viewers.add(player.id);

      try { player.runCommand(`camera @s clear`); } catch { }
      try { player.runCommand(`hud @s hide all`); } catch { }
      try { player.runCommand(`title @s clear`); } catch { }

      const genHudPos = getPlayerGeneratorHud(player.id);
      if (genHudPos) {
        console.warn(player.id);
        this.pausedGeneratorHuds.set(player.id, genHudPos);
      } else {
        console.warn(player.id);
      }

      const clockState = getPlayerClockHud(player.id);
      if (clockState) {
        this.pausedClockHuds.set(player.id, clockState);
      }

      try { hideGeneratorHud(player, true); } catch { }
      try { hideClockHud(player, true); } catch { }

      const yawOffset = this.viewYaw.get(pid) ?? 0;
      const pos = basePose.pos;
      const yaw = basePose.yaw + yawOffset;
      const pitch = basePose.pitch;

      const qYawInit = Math.round(yaw / 2) * 2;
      const applied = this.trySetCamera(player, pos, qYawInit, -pitch);
      if (!applied) {
        this.viewers.delete(player.id);
        try { uiManager.closeAllForms(player); } catch { }

        try { player.runCommand(`camera @s clear`); } catch { }
        try { player.runCommand(`camera @s fade time 0 0 0`); } catch { }
        try { player.runCommand(`camera @s fov_reset`); } catch { }
        try { player.runCommand(`hud @s reset`); } catch { }

        player.sendMessage(
          dynamicToast(
            "§l§cCAMERA ERROR",
            "§7Could not activate the camera with the current command version",
            "textures/fr_ui/error_icon",
            "textures/fr_ui/error_ui"
          )
        );
        return;
      }
      try { player.runCommand(`camera @s set ease 0.05`); } catch { }

      const settings = this.cameraSettings.get(camPosStr) ?? { verticalPitch: 0, rotationRange: 85, autoRotate: true, fov: 70 };
      const fov = settings.fov ?? 70;
      try { player.runCommand(`camera @s fov_set ${fov}`); } catch { }

      this.lastAppliedYaw.set(pid, qYawInit);
      this.ensureCameraIntervals();

      this.viewSessions.set(player.id, { pc: pcPosStr, dim: dimension.id, cam: camPosStr, fromFazTab: fromFazTab === true, directMode: directMode === true });
      this.autoPan.set(player.id, { offset: 0, dir: 1, dwell: 0 });
      this.baseRotations.set(player.id, initialRotation);
      this.baseYaw.set(player.id, basePose.yaw);
      this.cameraLocks.set(camPosStr, player.id);
      this.applyControlOverlay(player, pcPosStr, camPosStr, dimension);
    };

    if (alreadyViewing) {
      try { player.runCommand(`camera @s fade time 0.4 0.4 0.4 color 0 0 0`); } catch { }
      system.runTimeout(() => finish(), 5);
      return;
    }

    if (directMode) {
      try { player.runCommand(`camera @s fade time 0.3 0.2 0.3 color 0 0 0`); } catch { }
      system.runTimeout(() => finish(), 6);
      return;
    }

    if (fromFazTab) {
      try { player.runCommand(`camera @s fade time 0.2 0.2 0.2 color 0 0 0`); } catch { }
      system.runTimeout(() => finish(), 3);
      return;
    }

    system.runTimeout(() => {
      try { player.runCommand(`camera @s fade time 0.4 0.4 0.4 color 0 0 0`); } catch { }
      system.runTimeout(() => finish(), 5);
    }, 25);
  }

  tickExitByCrouch() {
    try {
      this.hudUpdateCounter++;
      const shouldUpdateHud = this.hudUpdateCounter >= 20;
      if (shouldUpdateHud) this.hudUpdateCounter = 0;

      const online = world.getPlayers();
      const byId = new Map();
      for (const p of online) byId.set(p.id, p);
      for (const pid of this.viewers) {
        const player = byId.get(pid);
        if (!player) continue;

        if (shouldUpdateHud) {
          try { player.runCommand(`title @s title §e§n§e§r§g§y§p §r`); } catch { }
        }

        if (player.isSneaking) {
          this.exitView(player);
          continue;
        }

        const session = this.viewSessions.get(pid);
        if (!session) continue;

        if (shouldUpdateHud) {
          const genPos = this.getGeneratorForPc(session.pc);
          if (genPos) {
            const dim = player.dimension;
            const gen = getGeneratorAt({ ...genPos, dimensionId: dim.id });
            if (gen) {
              const energyPercentage = Math.floor((gen.energy / MAX_ENERGY) * 100);
              const activeConsumers = getActiveGeneratorConsumers(gen, dim);

              let usageBar = "";
              if (activeConsumers >= 1) usageBar += "";
              if (activeConsumers >= 2) usageBar += "";
              if (activeConsumers >= 3) usageBar += "";
              if (activeConsumers >= 4) usageBar += "";

              const powerColor = (gen.energy / MAX_ENERGY < 0.2) ? "§c" : "§f";
              const text = `§l${powerColor}Power: ${energyPercentage}%   §rUsage: ${usageBar}`;
            }
          }
        }

        if (shouldUpdateHud) {
          const isPlaying = this.tapeEjectPlaying.get(pid) || false;
          if (!isPlaying && Math.random() < this.TAPE_EJECT_CHANCE) {
            try {
              player.playSound("tape_eject");
              this.tapeEjectPlaying.set(pid, true);
            } catch { }
          }
        }

        const [px, py, pz] = session.pc.split(',').map(Number);
        const dx = player.location.x - px - 0.5;
        const dy = player.location.y - py - 0.5;
        const dz = player.location.z - pz - 0.5;
        if (dx * dx + dy * dy + dz * dz > this.PC_EXIT_RADIUS_SQUARED) {
          this.exitView(player);
          continue;
        }

        try {
          const sess = this.viewSessions.get(pid);
          if (!sess) continue;
          const dim = player.dimension;
          const camBlock = this.blockFromLocStr(dim, sess.cam ?? "");
          if (!camBlock || camBlock.typeId !== "fr:security_cameras") {
            const camList = this.connections.get(sess.pc) ?? [];
            const oldIdx = camList.indexOf(sess.cam);
            if (oldIdx > -1) camList.splice(oldIdx, 1);
            this.connections.set(sess.pc, camList);
            this.saveConnections();

            if (camList.length > 0) {
              this.autoPan.set(pid, { offset: 0, dir: 1, dwell: 0 });
              this.baseRotations.delete(pid);
              this.baseYaw.delete(pid);
              try { this.cameraLocks.delete(sess.cam); } catch { }
              try { uiManager.closeAllForms(player); } catch { }
              const nextIdx = Math.min(Math.max(oldIdx, 0), camList.length - 1);
              const nextCam = camList[nextIdx] ?? camList[0];
              this.viewYaw.set(pid, 0);
              const fromFazTab = sess.fromFazTab === true;
              const directMode = sess.directMode === true;
              try { this.applyView(player, world.getDimension(sess.dim), nextCam, sess.pc, fromFazTab, directMode); } catch { this.applyView(player, dim, nextCam, sess.pc, fromFazTab, directMode); }
            } else {
              this.exitViewDueToCameraMovement(player, sess.cam);
            }
            continue;
          }

          const baseYawValue = this.baseYaw.get(pid);
          if (baseYawValue === undefined) continue;

          const manualYawOffset = this.viewYaw.get(pid) ?? 0;
          if (manualYawOffset !== 0) continue;

          const camLoc = camBlock.location;
          const camPosStr = sess.cam;
          const settings = this.cameraSettings.get(camPosStr) ?? { verticalPitch: 0, rotationRange: 85, autoRotate: true };

          if (settings.verticalOffset !== undefined && settings.verticalPitch === undefined) {
            settings.verticalPitch = settings.verticalOffset;
            delete settings.verticalOffset;
            this.cameraSettings.set(camPosStr, settings);
          }

          if (!settings.autoRotate) continue;

          const pitch = settings.verticalPitch ?? 0;
          const centerX = camLoc.x + 0.5;
          const centerY = camLoc.y + 0.6;
          const centerZ = camLoc.z + 0.5;
          const offsetDist = 0.4;

          const speed = this.AUTO_PAN_SPEED;
          const half = settings.rotationRange * 0.5;
          const st = this.autoPan.get(pid) ?? { offset: 0, dir: 1, dwell: 0 };
          if (st.dwell && st.dwell > 0) {
            st.dwell -= 1;
            this.autoPan.set(pid, st);
            const yawHold = baseYawValue + st.offset;

            const yawRadDwell = yawHold * this.DEG_TO_RAD;
            const sinDwell = Math.sin(yawRadDwell);
            const cosDwell = Math.cos(yawRadDwell);
            const dwellPos = {
              x: centerX - sinDwell * offsetDist,
              y: centerY,
              z: centerZ + cosDwell * offsetDist
            };

            const qYaw = Math.round(yawHold / 2) * 2;
            const lastQ = this.lastAppliedYaw.get(pid);
            if (lastQ !== qYaw) {
              this.trySetCamera(player, dwellPos, qYaw, -pitch);
              this.updateCameraBlockRotationThrottled(pid, dim, sess.cam, qYaw);
              this.lastAppliedYaw.set(pid, qYaw);

              if (this.flashlightActive.get(pid)) {
                this.placeFlashlightBlocks(player, sess.cam, dim);
              }
            }
            continue;
          }
          let next = st.offset + st.dir * speed;
          let dirn = st.dir;
          let dwell = 0;
          if (next > half) { next = half; dirn = -1; dwell = this.AUTO_PAN_DWELL_TICKS; }
          if (next < -half) { next = -half; dirn = 1; dwell = this.AUTO_PAN_DWELL_TICKS; }
          this.autoPan.set(pid, { offset: next, dir: dirn, dwell });
          const yaw = baseYawValue + next;

          const yawRadAdvance = yaw * this.DEG_TO_RAD;
          const sinAdvance = Math.sin(yawRadAdvance);
          const cosAdvance = Math.cos(yawRadAdvance);
          const advancePos = {
            x: centerX - sinAdvance * offsetDist,
            y: centerY,
            z: centerZ + cosAdvance * offsetDist
          };

          const qYaw2 = Math.round(yaw / 2) * 2;
          const lastQ2 = this.lastAppliedYaw.get(pid);
          if (lastQ2 !== qYaw2) {
            this.trySetCamera(player, advancePos, qYaw2, -pitch);
            this.updateCameraBlockRotationThrottled(pid, dim, sess.cam, qYaw2);
            this.lastAppliedYaw.set(pid, qYaw2);

            if (this.flashlightActive.get(pid)) {
              this.placeFlashlightBlocks(player, sess.cam, dim);
            }
          }
        } catch { }
      }
    } catch { }
  }

  exitView(player) {
    try {
      try { player.playSound("monitor_close"); } catch { }

      const pid = player.id;
      if (this.tapeEjectPlaying.get(pid)) {
        try { player.stopSound("tape_eject"); } catch { }
        this.tapeEjectPlaying.delete(pid);
      }
      if (this.pendingExit.has(pid)) return;
      this.pendingExit.add(pid);
      this.viewers.delete(pid);
      const session = this.viewSessions.get(pid);
      let pcPosStr = null;
      let dimId = null;
      let fromFazTab = false;
      let directMode = false;

      this.removeFlashlightBlocks(pid);
      this.flashlightActive.delete(pid);

      if (session && session.cam) {
        pcPosStr = session.pc;
        dimId = session.dim;
        fromFazTab = session.fromFazTab === true;
        directMode = session.directMode === true;
        const initialRotation = this.baseRotations.get(pid);
        if (initialRotation !== undefined) {
          try {
            const dimension = world.getDimension(session.dim);
            const camBlock = this.blockFromLocStr(dimension, session.cam);
            if (camBlock && camBlock.typeId === "fr:security_cameras") {
              const currentRotation = camBlock.permutation.getState("fr:rotation");
              if (currentRotation !== initialRotation) {
                const newPerm = camBlock.permutation.withState("fr:rotation", initialRotation);
                camBlock.setPermutation(newPerm);
              }
            }
          } catch { }
        }
        this.cameraLocks.delete(session.cam);
      }
      this.viewSessions.delete(pid);
      this.viewYaw.delete(pid);
      this.autoPan.delete(pid);
      this.baseRotations.delete(pid);
      this.baseYaw.delete(pid);
      this.blockUpdateCounter.delete(pid);
      this.cameraSetVariant.delete(pid);
      this.cameraAnimateVariant.delete(pid);
      this.lastAppliedYaw.delete(pid);

      try { uiManager.closeAllForms(player); } catch { }

      if (directMode) {
        try { player.runCommand(`camera @s fade time 0.2 0.15 0.2 color 0 0 0`); } catch { }
        system.runTimeout(() => {
          try { player.runCommand(`camera @s clear`); } catch { }
          try { player.runCommand(`camera @s fov_reset`); } catch { }
          try { player.runCommand(`hud @s reset`); } catch { }
          this.restorePausedGeneratorHud(player);
          this.pendingExit.delete(pid);
        }, 5);
        return;
      }

      if (fromFazTab) {
        try { player.runCommand(`camera @s fade time 0.15 0.1 0.15 color 0 0 0`); } catch { }
        system.runTimeout(() => {
          try { player.runCommand(`camera @s clear`); } catch { }
          try { player.runCommand(`camera @s fov_reset`); } catch { }
          try { player.runCommand(`hud @s reset`); } catch { }
          this.restorePausedGeneratorHud(player);
          showFazTabClose(player);
          system.runTimeout(() => {
            this.pendingExit.delete(pid);
          }, 12);
        }, 4);
        return;
      }

      if (pcPosStr && dimId) {
        try {
          const dimension = world.getDimension(dimId);
          const pcBlock = this.blockFromLocStr(dimension, pcPosStr);
          if (pcBlock) {
            try { player.runCommand(`camera @s fade time 0.15 0 0.15 color 0 0 0`); } catch { }
            system.runTimeout(() => {
              try { player.runCommand(`camera @s clear`); } catch { }
              try { player.runCommand(`camera @s fov_set 30`); } catch { }

              const pose = this.pcApproachPoseOf(pcBlock);
              if (pose) {
                const rotated = this.transformCameraRotation(pose.yaw, pose.pitch);
                const x = pose.pos.x.toFixed(3), y = pose.pos.y.toFixed(3), z = pose.pos.z.toFixed(3);
                const yawStr = rotated.yaw.toFixed(1), pitchStr = rotated.pitch.toFixed(1);
                try { player.runCommand(`camera @s set minecraft:free pos ${x} ${y} ${z} rot ${pitchStr} ${yawStr}`); } catch {
                  try { player.runCommand(`camera @s set minecraft:free pos ${x} ${y} ${z} rot ${yawStr} ${pitchStr}`); } catch { }
                }
              }

              this.pendingExit.delete(pid);
              this.showPcMainMenu(player, pcBlock, true);
            }, 3);
            return;
          }
        } catch { }
      }

      try { player.runCommand(`camera @s fade time 0.2 0.3 0.2 color 0 0 0`); } catch { }
      system.runTimeout(() => {
        try { player.runCommand(`camera @s clear`); } catch { }
        try { player.runCommand(`camera @s fov_reset`); } catch { }
        try { player.runCommand(`hud @s reset`); } catch { }
        this.restorePausedGeneratorHud(player);
        this.pendingExit.delete(pid);
      }, 10);
    } catch { }
  }

  exitViewDueToCameraMovement(player, camPosStr) {
    try {
      const pid = player.id;
      if (this.pendingExit.has(pid)) return;
      this.pendingExit.add(pid);

      this.viewers.delete(pid);
      const session = this.viewSessions.get(pid);
      let pcPosStr = null;
      let dimId = null;
      let fromFazTab = false;

      this.removeFlashlightBlocks(pid);
      this.flashlightActive.delete(pid);

      if (session && session.cam) {
        pcPosStr = session.pc;
        dimId = session.dim;
        fromFazTab = session.fromFazTab === true;
        this.cameraLocks.delete(session.cam);
      }

      this.viewSessions.delete(pid);
      this.viewYaw.delete(pid);
      this.autoPan.delete(pid);
      this.baseRotations.delete(pid);
      this.baseYaw.delete(pid);
      this.blockUpdateCounter.delete(pid);

      try { uiManager.closeAllForms(player); } catch { }

      player.sendMessage(
        dynamicToast(
          "§l§pCAMERA DISCONNECTED",
          "§7The camera was moved or destroyed",
          "textures/fr_ui/warning_icon",
          "textures/fr_ui/warning_ui"
        )
      );

      if (fromFazTab) {
        try { player.runCommand(`camera @s clear`); } catch { }
        try { player.runCommand(`camera @s fade time 0 0 0`); } catch { }
        try { player.runCommand(`camera @s fov_reset`); } catch { }
        try { player.runCommand(`hud @s reset`); } catch { }
        this.restorePausedGeneratorHud(player);
        this.pendingExit.delete(pid);
        return;
      }

      if (pcPosStr && dimId) {
        try {
          const dimension = world.getDimension(dimId);
          const pcBlock = this.blockFromLocStr(dimension, pcPosStr);
          if (pcBlock) {
            try { player.runCommand(`camera @s clear`); } catch { }
            try { player.runCommand(`camera @s fov_set 30`); } catch { }

            const pose = this.pcApproachPoseOf(pcBlock);
            if (pose) {
              const rotated = this.transformCameraRotation(pose.yaw, pose.pitch);
              const x = pose.pos.x.toFixed(3), y = pose.pos.y.toFixed(3), z = pose.pos.z.toFixed(3);
              const yawStr = rotated.yaw.toFixed(1), pitchStr = rotated.pitch.toFixed(1);
              try { player.runCommand(`camera @s set minecraft:free pos ${x} ${y} ${z} rot ${pitchStr} ${yawStr}`); } catch {
                try { player.runCommand(`camera @s set minecraft:free pos ${x} ${y} ${z} rot ${yawStr} ${pitchStr}`); } catch { }
              }
            }

            this.pendingExit.delete(pid);
            this.showPcMainMenu(player, pcBlock, true);
            return;
          }
        } catch { }
      }

      try { player.runCommand(`camera @s clear`); } catch { }
      try { player.runCommand(`camera @s fade time 0 0 0`); } catch { }
      try { player.runCommand(`camera @s fov_reset`); } catch { }
      try { player.runCommand(`hud @s reset`); } catch { }
      this.restorePausedGeneratorHud(player);
      this.pendingExit.delete(pid);
    } catch { }
  }

  yawToRotationIndex(yaw) {
    const angles = [180, 200, 225, 250, 270, 290, 315, 335, 0, 25, 45, 70, 90, 115, 135, 160];

    let normalizedYaw = yaw % 360;
    if (normalizedYaw < 0) normalizedYaw += 360;

    let closestIndex = 0;
    let minDiff = 360;

    for (let i = 0; i < angles.length; i++) {
      let diff = Math.abs(normalizedYaw - angles[i]);
      if (diff > 180) diff = 360 - diff;

      if (diff < minDiff) {
        minDiff = diff;
        closestIndex = i;
      }
    }

    return closestIndex;
  }

  updateCameraBlockRotation(dimension, camPosStr, currentYaw) {
    try {
      const camBlock = this.blockFromLocStr(dimension, camPosStr);
      if (!camBlock || camBlock.typeId !== "fr:security_cameras") return;

      let blockFace = "down";
      try {
        blockFace = camBlock.permutation.getState("minecraft:block_face") ?? "down";
      } catch { }

      if (blockFace !== "down") return;

      const rotationIndex = this.yawToRotationIndex(currentYaw);
      const currentRotation = camBlock.permutation.getState("fr:rotation");

      if (currentRotation !== rotationIndex) {
        const newPerm = camBlock.permutation.withState("fr:rotation", rotationIndex);
        camBlock.setPermutation(newPerm);
      }
    } catch (e) { }
  }

  updateCameraBlockRotationThrottled(playerId, dimension, camPosStr, currentYaw) {
    const counter = this.blockUpdateCounter.get(playerId) ?? 0;
    if (counter >= this.BLOCK_UPDATE_INTERVAL) {
      this.updateCameraBlockRotation(dimension, camPosStr, currentYaw);
      this.blockUpdateCounter.set(playerId, 0);
    } else {
      this.blockUpdateCounter.set(playerId, counter + 1);
    }
  }

  posOf(block) {
    const l = block.location;
    return { x: Math.floor(l.x), y: Math.floor(l.y), z: Math.floor(l.z) };
  }

  locStr(pos) {
    return `${pos.x},${pos.y},${pos.z}`;
  }

  blockFromLocStr(dimension, locStr) {
    const [x, y, z] = locStr.split(",").map(Number);
    return dimension.getBlock({ x, y, z });
  }

  frontPoseOf(block) {
    const loc = block.location;
    const centerX = loc.x + 0.5;
    const camPosStr = this.locStr({ x: Math.floor(loc.x), y: Math.floor(loc.y), z: Math.floor(loc.z) });
    const settings = this.cameraSettings.get(camPosStr) ?? { verticalPitch: 0, rotationRange: 85, autoRotate: true };

    if (settings.verticalOffset !== undefined && settings.verticalPitch === undefined) {
      settings.verticalPitch = settings.verticalOffset;
      delete settings.verticalOffset;
      this.cameraSettings.set(camPosStr, settings);
    }

    const centerY = loc.y + 0.6;
    const centerZ = loc.z + 0.5;
    let yaw = 180;
    const pitch = settings.verticalPitch ?? 0;

    let blockFace = "down";
    try {
      blockFace = block.permutation.getState("minecraft:block_face") ?? "down";
    } catch { }

    if (blockFace !== "down") {
      const faceYaws = {
        "north": 180,
        "south": 0,
        "east": 270,
        "west": 90
      };
      yaw = faceYaws[blockFace] ?? 180;
    } else {
      try {
        const rotation = block.permutation.getState("fr:rotation");
        if (rotation !== undefined && rotation !== null) {
          const angles = [180, 200, 225, 250, 270, 290, 315, 335, 0, 25, 45, 70, 90, 115, 135, 160];
          yaw = (rotation >= 0 && rotation < angles.length) ? angles[rotation] : 180;
        }
      } catch { }
    }

    const yawRad = yaw * this.DEG_TO_RAD;
    const sinYaw = Math.sin(yawRad);
    const cosYaw = Math.cos(yawRad);

    const offsetDist = 0.4;
    const pos = {
      x: centerX - sinYaw * offsetDist,
      y: centerY,
      z: centerZ + cosYaw * offsetDist
    };
    return { pos, yaw, pitch };
  }

  pcApproachPoseOf(block) {
    try {
      if (!block) return undefined;
      const center = { x: block.location.x + 0.5, y: block.location.y + 0.75, z: block.location.z + 0.5 };
      let dir = { x: 0, z: 1 };
      try {
        const face = block.permutation.getState("minecraft:cardinal_direction");
        if (face === "north") dir = { x: 0, z: -1 };
        else if (face === "south") dir = { x: 0, z: 1 };
        else if (face === "east") dir = { x: 1, z: 0 };
        else if (face === "west") dir = { x: -1, z: 0 };
      } catch { }
      const distance = 1.2;
      const pos = {
        x: center.x - (dir.x ?? 0) * distance,
        y: center.y - 0.034,
        z: center.z - (dir.z ?? 0) * distance,
      };
      const dx = center.x - pos.x;
      const dy = center.y - pos.y;
      const dz = center.z - pos.z;
      const len = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (!len) return undefined;
      const norm = { x: dx / len, y: dy / len, z: dz / len };
      const yaw = this.vectorToYaw(norm);
      const pitch = this.vectorToPitch(norm);
      return { pos, yaw, pitch };
    } catch { return undefined; }
  }

  animatePcApproach(player, pcBlock) {
    try {
      const pose = this.pcApproachPoseOf(pcBlock);
      if (!pose) return false;
      return this.tryAnimateCamera(player, pose.pos, pose.yaw, pose.pitch, 2, "in_out_cubic");
    } catch { return false; }
  }

  vectorToYaw(dir) {
    try {
      const yawRad = Math.atan2(-dir.x, dir.z);
      let yawDeg = yawRad * 180 / Math.PI;
      if (yawDeg < 0) yawDeg += 360;
      return yawDeg;
    } catch { return 180; }
  }

  vectorToPitch(dir) {
    try {
      const pitchRad = Math.asin(Math.max(-1, Math.min(1, dir.y)));
      const pitchDeg = pitchRad * 180 / Math.PI;
      return pitchDeg;
    } catch { return 0; }
  }

  transformCameraRotation(yaw, pitch) {
    return { yaw, pitch };
  }

  tryAnimateCamera(player, pos, yaw, pitch, duration, easing) {
    let applied = false;
    try {
      const rotated = this.transformCameraRotation(yaw, pitch);
      const x = pos.x.toFixed(3), y = pos.y.toFixed(3), z = pos.z.toFixed(3);
      const yawStr = rotated.yaw.toFixed(1), pitchStr = rotated.pitch.toFixed(1);
      const durationStr = String(duration ?? 0);
      const easeStr = easing ?? "in_out_cubic";
      const variants = [
        `camera @s set minecraft:free ease ${durationStr} ${easeStr} pos ${x} ${y} ${z} rot ${pitchStr} ${yawStr}`,
        `camera @s set minecraft:free ease ${durationStr} ${easeStr} pos ${x} ${y} ${z} rot ${yawStr} ${pitchStr}`,
        `camera @s set minecraft:free ease ${durationStr} ${easeStr} position ${x} ${y} ${z} rotation ${yawStr} ${pitchStr}`,
        `camera @s set free ease ${durationStr} ${easeStr} pos ${x} ${y} ${z} rot ${yawStr} ${pitchStr}`,
      ];
      const pid = player.id;
      const cached = this.cameraAnimateVariant.get(pid);
      if (cached !== undefined && variants[cached]) {
        try { player.runCommand(variants[cached]); applied = true; } catch { this.cameraAnimateVariant.delete(pid); }
      }
      if (!applied) {
        for (let i = 0; i < variants.length; i++) {
          try { player.runCommand(variants[i]); applied = true; this.cameraAnimateVariant.set(pid, i); break; } catch { }
        }
      }
    } catch { }
    return applied;
  }

  trySetCamera(player, pos, yaw, pitch) {
    let applied = false;
    try {
      const rotated = this.transformCameraRotation(yaw, pitch);
      const x = pos.x.toFixed(3), y = pos.y.toFixed(3), z = pos.z.toFixed(3);
      const yawStr = rotated.yaw.toFixed(1), pitchStr = rotated.pitch.toFixed(1);
      const variants = [
        `camera @s set minecraft:free pos ${x} ${y} ${z} rot ${pitchStr} ${yawStr}`,
        `camera @s set minecraft:free pos ${x} ${y} ${z} rot ${yawStr} ${pitchStr}`,
        `camera @s set minecraft:free position ${x} ${y} ${z} rotation ${yawStr} ${pitchStr}`,
        `camera @s set free pos ${x} ${y} ${z} rot ${yawStr} ${pitchStr}`,
      ];
      const pid = player.id;
      const cached = this.cameraSetVariant.get(pid);
      if (cached !== undefined && variants[cached]) {
        try { player.runCommand(variants[cached]); applied = true; } catch { this.cameraSetVariant.delete(pid); }
      }
      if (!applied) {
        for (let i = 0; i < variants.length; i++) {
          try { player.runCommand(variants[i]); applied = true; this.cameraSetVariant.set(pid, i); break; } catch { }
        }
      }
    } catch { }
    return applied;
  }

  resetPlayerCamera(player) {
    try { player.playSound("monitor_close"); } catch { }

    const pid = player.id;
    if (this.tapeEjectPlaying.get(pid)) {
      try { player.stopSound("tape_eject"); } catch { }
      this.tapeEjectPlaying.delete(pid);
    }

    try { player.runCommand(`camera @s clear`); } catch { }
    try { player.runCommand(`camera @s fade time 0 0 0`); } catch { }
    try { player.runCommand(`camera @s fov_reset`); } catch { }
    try { player.runCommand(`hud @s reset`); } catch { }
    this.restorePausedGeneratorHud(player);
  }

  restorePausedGeneratorHud(player) {
    const pos = this.pausedGeneratorHuds.get(player.id);
    if (pos) {
      console.warn(player.id);
      this.pausedGeneratorHuds.delete(player.id);
      try { showGeneratorHud(player, pos); } catch { }
    } else {
      console.warn(player.id);
    }

    if (this.pausedClockHuds.has(player.id)) {
      const clockState = this.pausedClockHuds.get(player.id);
      this.pausedClockHuds.delete(player.id);
      if (clockState && clockState.night !== undefined) {
        try { setCustomNight(player.id, clockState.night); } catch { }
      }
      try { showClockHud(player); } catch { }
    }
  }

  applyControlOverlay(player, pcPosStr, camPosStr, dimension) {
    try {
      const pid = player.id;
      const camList = this.connections.get(pcPosStr) ?? [];
      if (camList.length === 0) return;

      let camIndex = camList.indexOf(camPosStr);
      if (camIndex < 0) camIndex = 0;
      const currentCamSettings = this.cameraSettings.get(camPosStr) ?? {};
      const camName = currentCamSettings.customName || `Camera ${camIndex + 1}`;
      const f = new ActionFormData().title(`§r§r§r§C§u §f${camName}`);
      try { player.playSound("camera_select"); } catch { }
      f.button("b:l_");
      f.button("b:c_");
      f.button("b:r_");

      const flashlightOn = this.flashlightActive.get(pid) || false;
      const flashlightIcon = flashlightOn ? "textures/fr_ui/flashlight_button_hover" : "textures/fr_ui/flashlight_button";
      const flashlightLabel = flashlightOn ? "b:flash_on" : "b:flash_off";
      f.button(flashlightLabel, flashlightIcon);

      for (let i = 0; i < camList.length; i++) {
        const camPosStrItem = camList[i];
        const settings = this.cameraSettings.get(camPosStrItem) ?? {};
        const displayName = settings.customName || `Camera ${i + 1}`;
        const isCurrentCam = camPosStrItem === camPosStr;
        const indicator = isCurrentCam ? "§a> " : "§7";
        f.button(`cam:${indicator}${displayName}`);
      }

      const generatorPos = this.getGeneratorForPc(pcPosStr);
      if (generatorPos) {
        try {
          const genData = getGeneratorAt({ ...generatorPos, dimensionId: dimension.id });
          if (genData) {
            const energyPercentage = genData.infiniteEnergy ? "INF" : `${Math.floor((genData.energy / MAX_ENERGY) * 100)}%`;
            const activeConsumers = getActiveGeneratorConsumers(genData, dimension);
            let usageBar = "";
            if (activeConsumers >= 1) usageBar += "";
            if (activeConsumers >= 2) usageBar += "";
            if (activeConsumers >= 3) usageBar += "";
            if (activeConsumers >= 4) usageBar += "";
            if (usageBar === "") usageBar = "";
            const powerColor = !genData.infiniteEnergy && (genData.energy / MAX_ENERGY) < 0.2 ? "§c" : "§f";
            f.label(`t:3_${powerColor}Power left: §l${energyPercentage}§r\nUsage: ${usageBar}`);
          }
        } catch { }
      }


      this.getWorldTimeLabelsAsync(player).then((labels) => {
        try { f.label(`t:l2_§l${labels.clock}`); } catch { }
        try { f.label(`t:2_${labels.period}`); } catch { }
        return f.show(player);
      }).catch(() => {
        try { f.label("t:l2_"); } catch { }
        try { f.label("t:2_"); } catch { }
        return f.show(player);
      }).then((res) => {
        if (!this.viewers.has(pid)) {
          try { player.runCommand(`camera @s clear`); } catch { }
          try { player.runCommand(`camera @s fov_reset`); } catch { }
          try { player.runCommand(`hud @s reset`); } catch { }
          return;
        }

        if (res.canceled || res.selection === undefined) { this.exitView(player); return; }

        const sel = res.selection;
        if (sel === 1) {
          this.exitView(player);
          return;
        }

        const camList = this.connections.get(pcPosStr) ?? [];
        if (camList.length === 0) {
          this.exitView(player);
          return;
        }

        let idx = camList.indexOf(camPosStr);
        if (idx < 0) idx = 0;

        if (camList.length === 1) {
          if (sel === 0 || sel === 2) {
            if (!this.viewers.has(pid)) {
              try { player.runCommand(`camera @s clear`); } catch { }
              try { player.runCommand(`hud @s reset`); } catch { }
              return;
            }

            const step = 10;
            const current = this.viewYaw.get(pid) ?? 0;
            const nextOffset = sel === 0 ? current - step : current + step;
            this.viewYaw.set(pid, nextOffset);

            const baseYawValue = this.baseYaw.get(pid);
            if (baseYawValue === undefined) return;

            const cam = this.blockFromLocStr(dimension, camPosStr);
            if (!cam || cam.typeId !== "fr:security_cameras") {
              this.exitView(player);
              return;
            }

            const settings = this.cameraSettings.get(camPosStr) ?? { verticalPitch: 0, rotationRange: 85, autoRotate: true };

            if (settings.verticalOffset !== undefined && settings.verticalPitch === undefined) {
              settings.verticalPitch = settings.verticalOffset;
              delete settings.verticalOffset;
              this.cameraSettings.set(camPosStr, settings);
            }

            const pitch = settings.verticalPitch ?? 0;
            const camLoc = cam.location;
            const finalYaw = baseYawValue + nextOffset;
            const yawRad = finalYaw * this.DEG_TO_RAD;
            const sinYaw = Math.sin(yawRad);
            const cosYaw = Math.cos(yawRad);
            const offsetDist = 0.4;
            const pos = {
              x: camLoc.x + 0.5 - sinYaw * offsetDist,
              y: camLoc.y + 0.6,
              z: camLoc.z + 0.5 + cosYaw * offsetDist
            };

            const qYaw = Math.round(finalYaw / 2) * 2;
            const ok = this.trySetCamera(player, pos, qYaw, -pitch);
            if (!ok) return;
            this.lastAppliedYaw.set(pid, qYaw);

            if (this.flashlightActive.get(pid)) {
              this.placeFlashlightBlocks(player, camPosStr, dimension);
            }

            system.run(() => this.applyControlOverlay(player, pcPosStr, camPosStr, dimension));
          } else if (sel === 3) {
            this.toggleFlashlight(player, camPosStr, dimension);
            player.playSound("flashlight");
            system.run(() => this.applyControlOverlay(player, pcPosStr, camPosStr, dimension));
          } else if (sel >= 4) {
            system.run(() => this.applyControlOverlay(player, pcPosStr, camPosStr, dimension));
          }
          return;
        }

        if (sel === 0) {
          if (!this.viewers.has(pid)) {
            try { player.runCommand(`camera @s clear`); } catch { }
            try { player.runCommand(`hud @s reset`); } catch { }
            return;
          }

          const initialRot = this.baseRotations.get(pid);
          if (initialRot !== undefined) {
            try {
              const currentCamBlock = this.blockFromLocStr(dimension, camPosStr);
              if (currentCamBlock && currentCamBlock.typeId === "fr:security_cameras") {
                const currentRot = currentCamBlock.permutation.getState("fr:rotation");
                if (currentRot !== initialRot) {
                  const resetPerm = currentCamBlock.permutation.withState("fr:rotation", initialRot);
                  currentCamBlock.setPermutation(resetPerm);
                }
              }
            } catch { }
          }

          const prevIdx = (idx - 1 + camList.length) % camList.length;
          this.viewYaw.set(pid, 0);
          this.autoPan.set(pid, { offset: 0, dir: 1, dwell: 0 });
          this.baseRotations.delete(pid);
          this.baseYaw.delete(pid);
          const session = this.viewSessions.get(pid);
          const fromFazTab = session?.fromFazTab === true;
          const directMode = session?.directMode === true;
          try { player.playSound("camera_select"); } catch { }
          this.applyView(player, dimension, camList[prevIdx], pcPosStr, fromFazTab, directMode);
        } else if (sel === 2) {
          if (!this.viewers.has(pid)) {
            try { player.runCommand(`camera @s clear`); } catch { }
            try { player.runCommand(`hud @s reset`); } catch { }
            return;
          }

          const initialRot = this.baseRotations.get(pid);
          if (initialRot !== undefined) {
            try {
              const currentCamBlock = this.blockFromLocStr(dimension, camPosStr);
              if (currentCamBlock && currentCamBlock.typeId === "fr:security_cameras") {
                const currentRot = currentCamBlock.permutation.getState("fr:rotation");
                if (currentRot !== initialRot) {
                  const resetPerm = currentCamBlock.permutation.withState("fr:rotation", initialRot);
                  currentCamBlock.setPermutation(resetPerm);
                }
              }
            } catch { }
          }

          const nextIdx = (idx + 1) % camList.length;
          this.viewYaw.set(pid, 0);
          this.autoPan.set(pid, { offset: 0, dir: 1, dwell: 0 });
          this.baseRotations.delete(pid);
          this.baseYaw.delete(pid);
          const sessionNext = this.viewSessions.get(pid);
          const fromFazTabNext = sessionNext?.fromFazTab === true;
          const directModeNext = sessionNext?.directMode === true;
          try { player.playSound("camera_select"); } catch { }
          this.applyView(player, dimension, camList[nextIdx], pcPosStr, fromFazTabNext, directModeNext);
        } else if (sel === 3) {
          this.toggleFlashlight(player, camPosStr, dimension);
          player.playSound("flashlight");
          system.run(() => this.applyControlOverlay(player, pcPosStr, camPosStr, dimension));
        } else if (sel >= 4) {
          const camIdx = sel - 4;
          if (camIdx >= 0 && camIdx < camList.length) {
            const selectedCamPos = camList[camIdx];
            if (selectedCamPos !== camPosStr) {
              this.viewYaw.set(pid, 0);
              this.autoPan.set(pid, { offset: 0, dir: 1, dwell: 0 });
              this.baseRotations.delete(pid);
              this.baseYaw.delete(pid);
              const sessionCam = this.viewSessions.get(pid);
              const fromFazTabCam = sessionCam?.fromFazTab === true;
              const directModeCam = sessionCam?.directMode === true;
              try { player.playSound("camera_select"); } catch { }
              this.applyView(player, dimension, selectedCamPos, pcPosStr, fromFazTabCam, directModeCam);
            } else {
              system.run(() => this.applyControlOverlay(player, pcPosStr, camPosStr, dimension));
            }
          }
        }
      }).catch(() => {
        if (this.viewers.has(pid)) {
          this.exitView(player);
        }
      });
    } catch { }
  }

  manageCameras(player, pcBlock) {
    try {
      const pcPosStr = this.locStr(this.posOf(pcBlock));
      let camList = this.connections.get(pcPosStr) ?? [];

      const validCameras = [];
      for (const camPosStr of camList) {
        const camBlock = this.blockFromLocStr(player.dimension, camPosStr);
        if (camBlock && camBlock.typeId === "fr:security_cameras") {
          validCameras.push(camPosStr);
        }
      }

      if (validCameras.length !== camList.length) {
        this.connections.set(pcPosStr, validCameras);
        this.saveConnections();
        camList = validCameras;
      }

      if (camList.length === 0) {
        player.sendMessage(
          dynamicToast(
            "§l§cNO CAMERAS",
            "§7This PC is not linked to any camera",
            "textures/fr_ui/warning_icon",
            "textures/fr_ui/warning_ui"
          )
        );
        this.showPcMainMenu(player, pcBlock, true);
        return;
      }

      const form = new ActionFormData()
        .title("§C§A§M§M§G§R")
        .header("§fSelect a camera to edit settings")
        .divider();
      camList.forEach((posStr, idx) => {
        let status = "§q[ON]";
        const lockOwner = this.cameraLocks.get(posStr);
        if (lockOwner) {
          const session = this.viewSessions.get(lockOwner);
          const isValidLock = session && session.cam === posStr && this.viewers.has(lockOwner);
          if (!isValidLock) {
            this.cameraLocks.delete(posStr);
          } else {
            status = "§p[IN USE]";
          }
        }
        const settings = this.cameraSettings.get(posStr) ?? {};
        const displayName = settings.customName || `Camera ${idx + 1}`;
        form.button(`${status} §r§8${displayName}`, "textures/fr_ui/security_camera_icon");
      });
      form.show(player).then((res) => {
        if (res.canceled) {
          this.showPcMainMenu(player, pcBlock, true);
          return;
        }
        const idx = res.selection;
        if (idx === undefined || idx < 0 || idx >= camList.length) return;
        const selectedCam = camList[idx];
        this.editCamera(player, pcPosStr, selectedCam);
      }).catch(() => { });
    } catch { }
  }

  editCamera(player, pcPosStr, camPosStr) {
    try {
      const pcBlock = this.blockFromLocStr(player.dimension, pcPosStr);
      const camBlock = this.blockFromLocStr(player.dimension, camPosStr);

      if (!camBlock || camBlock.typeId !== "fr:security_cameras") {
        player.sendMessage("§cCamera not found or invalid");
        return;
      }

      const currentRotation = camBlock.permutation.getState("fr:rotation") ?? 0;
      const settings = this.cameraSettings.get(camPosStr) ?? { verticalPitch: 0, rotationRange: 85, autoRotate: true };

      if (settings.verticalOffset !== undefined && settings.verticalPitch === undefined) {
        settings.verticalPitch = settings.verticalOffset;
        delete settings.verticalOffset;
        this.cameraSettings.set(camPosStr, settings);
        this.saveCameraSettings();
      }

      let blockFace = "down";
      try {
        blockFace = camBlock.permutation.getState("minecraft:block_face") ?? "down";
      } catch { }
      const isOnWall = blockFace !== "down";

      const displayPitch = settings.verticalPitch ?? 0;
      const displayRange = settings.rotationRange ?? 85;
      const displayAutoRotate = settings.autoRotate ?? true;
      const displayFOV = settings.fov ?? 70;

      const angles = [180, 200, 225, 250, 270, 290, 315, 335, 0, 25, 45, 70, 90, 115, 135, 160];
      const currentAngle = angles[currentRotation] ?? 180;
      const autoRotateStatus = displayAutoRotate ? "§qEnabled" : "§cDisabled";

      const faceNames = {
        "north": "North",
        "south": "South",
        "east": "East",
        "west": "West",
        "down": "Ceiling"
      };
      const mountLocation = faceNames[blockFace] ?? "Ceiling";

      const displayName = settings.customName || `Camera ${(this.connections.get(pcPosStr) ?? []).indexOf(camPosStr) + 1}`;
      let infoLabel = `§7Name: §f${displayName}\n§7Position: §f${camPosStr}\n§7Mounted on: §f${mountLocation}\n§7Vertical pitch: §f${displayPitch}°\n§7Rotation range: §f${displayRange}°\n§7FOV: §f${displayFOV}°\n§7Auto-rotation: ${autoRotateStatus}`;
      if (!isOnWall) {
        infoLabel += `\n§7Base rotation: §f${currentAngle}°`;
      }

      const form = new ActionFormData()
        .title("§C§A§M§M§G§R")
        .header("Camera details")
        .divider()
        .label(infoLabel)
        .divider();

      form.button("§8Rename Camera", "textures/fr_ui/gear_icon");
      form.button(settings.autoRotate ? "§cDisable Auto-Rotation" : "§qEnable Auto-Rotation", "textures/fr_ui/gear_icon");
      form.button("§8Adjust Vertical Pitch", "textures/fr_ui/gear_icon");
      form.button("§8Adjust Rotation Range", "textures/fr_ui/gear_icon");
      form.button("§8Adjust FOV", "textures/fr_ui/gear_icon");
      form.button("§8Remove Camera", "textures/fr_ui/deny_icon");
      form.button("§8Back");

      form.show(player).then((res) => {
        if (res.canceled) {
          const pcBlock = this.blockFromLocStr(player.dimension, pcPosStr);
          this.manageCameras(player, pcBlock);
          return;
        }
        const selection = res.selection;

        if (selection === 0) {
          this.renameCamera(player, pcPosStr, camPosStr);
        } else if (selection === 1) {
          this.toggleAutoRotation(player, pcPosStr, camPosStr);
        } else if (selection === 2) {
          this.adjustCameraVertical(player, pcPosStr, camPosStr);
        } else if (selection === 3) {
          this.adjustCameraRotationRange(player, pcPosStr, camPosStr);
        } else if (selection === 4) {
          this.adjustCameraFOV(player, pcPosStr, camPosStr);
        } else if (selection === 5) {
          this.confirmRemoveCamera(player, pcPosStr, camPosStr);
        } else if (selection === 6) {
          const pcBlock = this.blockFromLocStr(player.dimension, pcPosStr);
          this.manageCameras(player, pcBlock);
        }
      }).catch(() => { });
    } catch { }
  }

  renameCamera(player, pcPosStr, camPosStr) {
    try {
      const settings = this.cameraSettings.get(camPosStr) ?? { verticalPitch: 0, rotationRange: 85, autoRotate: true };
      const currentName = settings.customName || "";
      const camIdx = (this.connections.get(pcPosStr) ?? []).indexOf(camPosStr) + 1;

      system.run(() => {
        const form = new ModalFormData()
          .title("§#§C§A")
          .header("Rename Camera")
          .divider()
          .label(`Enter a new name for Camera ${camIdx}`)
          .textField("Camera name", "Enter name...", { defaultValue: currentName });

        form.show(player).then((res) => {
          if (res.canceled) {
            this.editCamera(player, pcPosStr, camPosStr);
            return;
          }

          const newName = (res.formValues[0] || "").trim();
          if (newName) {
            settings.customName = newName;
          } else {
            delete settings.customName;
          }
          this.cameraSettings.set(camPosStr, settings);
          this.saveCameraSettings();

          player.sendMessage(
            dynamicToast(
              "§l§qCAMERA RENAMED",
              newName ? `§7New name: §f${newName}` : "§7Name reset to default",
              "textures/fr_ui/approve_icon",
              "textures/fr_ui/approve_ui"
            )
          );

          system.runTimeout(() => {
            this.editCamera(player, pcPosStr, camPosStr);
          }, 10);
        }).catch(() => { });
      });
    } catch { }
  }

  toggleAutoRotation(player, pcPosStr, camPosStr) {
    try {
      const settings = this.cameraSettings.get(camPosStr) ?? { verticalPitch: 0, rotationRange: 85, autoRotate: true };

      settings.autoRotate = !settings.autoRotate;
      this.cameraSettings.set(camPosStr, settings);
      this.saveCameraSettings();

      const statusText = settings.autoRotate ? "Enabled" : "Disabled";
      player.sendMessage(
        dynamicToast(
          "§l§qAUTO-ROTATION",
          `§7Auto-rotation ${statusText}`,
          "textures/fr_ui/approve_icon",
          "textures/fr_ui/approve_ui"
        )
      );

      system.runTimeout(() => {
        this.editCamera(player, pcPosStr, camPosStr);
      }, 10);
    } catch { }
  }

  adjustCameraRotation(player, pcPosStr, camPosStr) {
    try {
      const camBlock = this.blockFromLocStr(player.dimension, camPosStr);
      if (!camBlock || camBlock.typeId !== "fr:security_cameras") {
        player.sendMessage("§cCamera not found");
        return;
      }

      const currentRotation = camBlock.permutation.getState("fr:rotation") ?? 0;
      const angles = [180, 200, 225, 250, 270, 290, 315, 335, 0, 25, 45, 70, 90, 115, 135, 160];
      const currentAngle = angles[currentRotation] ?? 180;

      const form = new ModalFormData()
        .title("Adjust Rotation")
        .slider("Rotation Index (0-15)", 0, 15);

      form.show(player).then((res) => {
        if (res.canceled) {
          this.editCamera(player, pcPosStr, camPosStr);
          return;
        }

        const newRotation = Math.floor(res.formValues[0]);
        const newAngle = angles[newRotation];

        try {
          const freshCamBlock = this.blockFromLocStr(player.dimension, camPosStr);
          if (freshCamBlock && freshCamBlock.typeId === "fr:security_cameras") {
            const newPerm = freshCamBlock.permutation.withState("fr:rotation", newRotation);
            freshCamBlock.setPermutation(newPerm);
            player.sendMessage(
              dynamicToast(
                "§l§aROTATION SET",
                `§7New angle: §f${newAngle}°`,
                "textures/fr_ui/approve_icon",
                "textures/fr_ui/approve_ui"
              )
            );
          } else {
            player.sendMessage("§cCamera not found");
          }
        } catch {
          player.sendMessage("§cFailed to set rotation");
        }

        system.runTimeout(() => {
          this.editCamera(player, pcPosStr, camPosStr);
        }, 20);
      }).catch(() => { });
    } catch { }
  }

  adjustCameraVertical(player, pcPosStr, camPosStr) {
    try {
      const settings = this.cameraSettings.get(camPosStr) ?? { verticalPitch: 0, rotationRange: 85, autoRotate: true };

      if (settings.verticalOffset !== undefined && settings.verticalPitch === undefined) {
        settings.verticalPitch = settings.verticalOffset;
        delete settings.verticalOffset;
      }

      const form = new ModalFormData()
        .title("§#§C§A")
        .header("Vertical pitch")
        .divider()
        .label("Define the value the camera will look at, either downwards (negative value) or upwards (positive value)")
        .slider("Pitch (-90 to 90 degrees)", -90, 90)
        .divider()
        .label("If you want to keep the default value, activate this and the above will not be taken into account")
        .toggle("Reset to default (0°)");

      form.show(player).then((res) => {
        if (res.canceled) {
          this.editCamera(player, pcPosStr, camPosStr);
          return;
        }

        let newPitch = res.formValues[3];
        const resetToDefault = res.formValues[6];

        if (resetToDefault) {
          newPitch = 0;
        }

        if (newPitch === undefined || newPitch === null || isNaN(newPitch)) {
          player.sendMessage("§cInvalid pitch value");
          this.editCamera(player, pcPosStr, camPosStr);
          return;
        }

        settings.verticalPitch = newPitch;
        this.cameraSettings.set(camPosStr, settings);
        this.saveCameraSettings();

        player.sendMessage(
          dynamicToast(
            "§l§aVERTICAL ROTATION SET",
            `§7New pitch: §f${Math.round(newPitch)}°`,
            "textures/fr_ui/approve_icon",
            "textures/fr_ui/approve_ui"
          )
        );

        system.runTimeout(() => {
          this.editCamera(player, pcPosStr, camPosStr);
        }, 20);
      }).catch(() => { });
    } catch { }
  }

  adjustCameraRotationRange(player, pcPosStr, camPosStr) {
    try {
      const settings = this.cameraSettings.get(camPosStr) ?? { verticalPitch: 0, rotationRange: 85, autoRotate: true };
      const currentRange = settings.rotationRange ?? 85;

      const form = new ModalFormData()
        .title("§#§C§A")
        .header("Rotation range")
        .divider()
        .label(`Defines the range at which the camera will rotate sideways. Current: ${currentRange}°`)
        .slider("Max Rotation Range (10-180°)", 10, 180)
        .divider()
        .label("If you want to keep the default value, activate this and the above will not be taken into account")
        .toggle("Reset to default (85°)");

      form.show(player).then((res) => {
        if (res.canceled) {
          this.editCamera(player, pcPosStr, camPosStr);
          return;
        }

        let newRange = res.formValues[3];
        const resetToDefault = res.formValues[6];

        if (resetToDefault) {
          newRange = 85;
        }

        if (newRange === undefined || newRange === null || isNaN(newRange)) {
          player.sendMessage("§cInvalid range value");
          this.editCamera(player, pcPosStr, camPosStr);
          return;
        }

        settings.rotationRange = newRange;
        this.cameraSettings.set(camPosStr, settings);
        this.saveCameraSettings();

        player.sendMessage(
          dynamicToast(
            "§l§aROTATION RANGE SET",
            `§7New range: §f±${Math.round(newRange)}°`,
            "textures/fr_ui/approve_icon",
            "textures/fr_ui/approve_ui"
          )
        );

        system.runTimeout(() => {
          this.editCamera(player, pcPosStr, camPosStr);
        }, 20);
      }).catch(() => { });
    } catch { }
  }

  adjustCameraFOV(player, pcPosStr, camPosStr) {
    try {
      const settings = this.cameraSettings.get(camPosStr) ?? { verticalPitch: 0, rotationRange: 85, autoRotate: true, fov: 70 };
      const currentFOV = settings.fov ?? 70;

      const form = new ModalFormData()
        .title("§#§C§A")
        .header("Field of View")
        .divider()
        .label(`Defines the field of view (zoom) of the camera. Current: ${currentFOV}°`)
        .slider("FOV (30-110°)", 30, 110)
        .divider()
        .label("If you want to keep the default value, activate this and the above will not be taken into account")
        .toggle("Reset to default (70°)");

      form.show(player).then((res) => {
        if (res.canceled) {
          this.editCamera(player, pcPosStr, camPosStr);
          return;
        }

        let newFOV = res.formValues[3];
        const resetToDefault = res.formValues[6];

        if (resetToDefault) {
          newFOV = 70;
        }

        if (newFOV === undefined || newFOV === null || isNaN(newFOV)) {
          player.sendMessage("§cInvalid FOV value");
          this.editCamera(player, pcPosStr, camPosStr);
          return;
        }

        settings.fov = newFOV;
        this.cameraSettings.set(camPosStr, settings);
        this.saveCameraSettings();

        player.sendMessage(
          dynamicToast(
            "§l§aFOV SET",
            `§7New FOV: §f${Math.round(newFOV)}°`,
            "textures/fr_ui/approve_icon",
            "textures/fr_ui/approve_ui"
          )
        );

        system.runTimeout(() => {
          this.editCamera(player, pcPosStr, camPosStr);
        }, 20);
      }).catch(() => { });
    } catch { }
  }

  confirmRemoveCamera(player, pcPosStr, camPosStr) {
    try {
      const form = new ActionFormData()
        .title("§C§A§M§M§G§R")
        .header("§cConfirm Removal")
        .divider()
        .label(`§7Are you sure you want to unlink this camera?\n§f${camPosStr}`)
        .divider()
        .button("§cYes, Remove", "textures/ui/trash_default")
        .button("§8Cancel", "textures/fr_ui/deny_icon");

      form.show(player).then((res) => {
        if (res.canceled || res.selection === 1) {
          this.editCamera(player, pcPosStr, camPosStr);
          return;
        }

        if (res.selection === 0) {
          let camList = this.connections.get(pcPosStr) ?? [];
          const index = camList.indexOf(camPosStr);

          if (index !== -1) {
            camList.splice(index, 1);
            this.connections.set(pcPosStr, camList);
            this.saveConnections();
            this.cameraSettings.delete(camPosStr);
            this.saveCameraSettings();

            player.sendMessage(
              dynamicToast(
                "§l§aUNLINKED",
                `§7Removed camera: §f${camPosStr}`,
                "textures/fr_ui/approve_icon",
                "textures/fr_ui/approve_ui"
              )
            );
          }

          system.runTimeout(() => {
            const pcBlock = this.blockFromLocStr(player.dimension, pcPosStr);

            if (camList.length === 0) {
              this.resetPlayerCamera(player);
              player.sendMessage(
                dynamicToast(
                  "§l§cNO CAMERAS",
                  "§7This PC has no cameras linked",
                  "textures/fr_ui/warning_icon",
                  "textures/fr_ui/warning_ui"
                )
              );
              return;
            }

            this.manageCameras(player, pcBlock);
          }, 20);
        }
      }).catch(() => { });
    } catch { }
  }

  showChangelog(player, pcBlock) {
    try {
      const form = new ActionFormData()
        .title("§C§H§A§N§G§E§L§O§G")
        .header("§f§lPre-Beta 0.6.0")
        .divider()
        .header(`§f§l[NEW FEATURES]§r§f`)
        .label(`§7- The animatronics now have a showtime animation`)
        .header(`§f§l[CHANGES]§r§f`)
        .label(`§7- The selection boxes on the door frames were improved`)
        .header(`§f§l[BUG FIXES]§r§f`)
        .label(`§7- The door frame no longer exists
- Hand and spear animation
- Disappearance of doors over long distances
- The vanilla menu appeared behind the camera settings
- Sometimes the flashlight wouldn't turn off when leaving the PC or simply when it rotated too much
- The wall blocks did not have a different top and bottom face
- Some texts in some items did not have a translation
- The animatronics couldn't pass through the door frame
- Now, when you select a door block, it gives you the door item and no longer a glitched door block`)

      form.show(player).then((res) => {
        this.showPcMainMenu(player, pcBlock, true);
      }).catch(() => {
        this.showPcMainMenu(player, pcBlock, true);
      });
    } catch {
      this.showPcMainMenu(player, pcBlock, true);
    }
  }

  saveConnections() {
    try {
      const arr = Array.from(this.connections.entries());
      world.setDynamicProperty("fr:camera_connections", JSON.stringify(arr));
    } catch (e) { }
  }

  loadConnections() {
    try {
      const raw = world.getDynamicProperty("fr:camera_connections");
      if (!raw) return;
      const arr = JSON.parse(raw);
      this.connections.clear();
      for (const [pc, cams] of arr) {
        if (Array.isArray(cams)) this.connections.set(pc, cams.filter(c => typeof c === 'string'));
        else if (typeof cams === 'string') this.connections.set(pc, [cams]);
      }
    } catch (e) { this.connections.clear(); }
    this.loadCameraSettings();
  }

  saveCameraSettings() {
    try {
      const arr = Array.from(this.cameraSettings.entries());
      world.setDynamicProperty("fr:camera_settings", JSON.stringify(arr));
    } catch { }
  }

  loadCameraSettings() {
    try {
      const raw = world.getDynamicProperty("fr:camera_settings");
      if (!raw) return;
      const arr = JSON.parse(raw);
      this.cameraSettings.clear();
      for (const [camPosStr, settings] of arr) {
        if (settings && typeof settings === 'object') {
          this.cameraSettings.set(camPosStr, settings);
        }
      }
    } catch {
      this.cameraSettings.clear();
    }
  }
}

const securityCameraSystem = new SecurityCameraSystem();
system.run(() => securityCameraSystem.initialize());

function isPlayerInCamera(playerId) {
  return securityCameraSystem.viewers.has(playerId);
}

export { securityCameraSystem, isPlayerInCamera };
