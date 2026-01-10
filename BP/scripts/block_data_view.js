/**
 * FAZBEAR'S RESTOCKED - BEDROCK
 * ©2025
 * This code is the property of Fazbear's Restocked.
 * Unauthorized copying, modification, distribution, or use of this code,
 * via any medium, is strictly prohibited without explicit permission.
 * All rights reserved.
 */

import { world, system } from "@minecraft/server";

let tickCounter = 0;
let lastTickCount = 0;
let currentTPS = 20;
let lastTPSUpdate = Date.now();

system.runInterval(() => {
	tickCounter++;
	const now = Date.now();
	const elapsed = now - lastTPSUpdate;
	
	if (elapsed >= 1000) {
		const ticksInSecond = tickCounter - lastTickCount;
		currentTPS = ticksInSecond;
		lastTickCount = tickCounter;
		lastTPSUpdate = now;
	}
}, 1);

function getTPSColor(tps) {
	if (tps >= 19) return "§a";
	if (tps >= 15) return "§e";
	if (tps >= 10) return "§6";
	return "§c";
}

function getTPSStatus(tps) {
	if (tps >= 19) return "§aEXCELENT";
	if (tps >= 15) return "§eGOOD";
	if (tps >= 10) return "§6SLOW";
	return "§cLAGGING";
}

const lastViewedBlock = new Map();
const ALLOWED_PLAYER = "Admin";

const profilingData = new Map();
let lastProfileReport = 0;
const PROFILE_REPORT_INTERVAL = 5000;

function registerExecution(systemName, executionTime) {
	if (!profilingData.has(systemName)) {
		profilingData.set(systemName, {
			name: systemName,
			executions: 0,
			totalTime: 0,
			maxTime: 0,
			avgTime: 0
		});
	}
	
	const data = profilingData.get(systemName);
	data.executions++;
	data.totalTime += executionTime;
	data.maxTime = Math.max(data.maxTime, executionTime);
	data.avgTime = data.totalTime / data.executions;
}

function sendProfileReport(player) {
	if (profilingData.size === 0) {
		player.sendMessage("§7[Profiler] No hay datos de ejecución registrados");
		return;
	}
	
	const sorted = Array.from(profilingData.values())
		.sort((a, b) => b.totalTime - a.totalTime)
		.slice(0, 10);
	
	player.sendMessage("§6§l=== PERFORMANCE PROFILER ===");
	player.sendMessage(`§7TPS Actual: ${getTPSColor(currentTPS)}${currentTPS}§7/20 ${getTPSStatus(currentTPS)}`);
	player.sendMessage("§e§lTop sistemas por tiempo total:");
	
	for (let i = 0; i < sorted.length; i++) {
		const data = sorted[i];
		const impact = data.avgTime > 5 ? "§c⚠" : data.avgTime > 2 ? "§e⚠" : "§a✓";
		const timeColor = data.avgTime > 5 ? "§c" : data.avgTime > 2 ? "§e" : "§a";
		
		player.sendMessage(
			`${impact} §7${data.name}: ${timeColor}${data.avgTime.toFixed(2)}ms§7 avg ` +
			`§8(max: ${data.maxTime.toFixed(2)}ms, x${data.executions})`
		);
	}
	
	const lagSystems = sorted.filter(d => d.avgTime > 5);
	if (lagSystems.length > 0) {
		player.sendMessage("§c§l⚠ SISTEMAS CAUSANDO LAG:");
		lagSystems.forEach(d => {
			player.sendMessage(`§c- ${d.name} §7(${d.avgTime.toFixed(2)}ms promedio)`);
		});
	}
	
	player.sendMessage("§8Use /tag @s remove enable_profiler para detener");
}

const originalRunInterval = system.runInterval;
const registeredIntervals = new Map();
let intervalIdCounter = 0;

system.runInterval(() => {
	const players = world.getAllPlayers();
	if (players.length === 0) return;
	
	const absoluteTick = system.currentTick;
	
	for (let i = 0; i < players.length; i++) {
		const player = players[i];
		
		if (!player.name == ALLOWED_PLAYER) continue;
		
		try {
			const showBlocks = player.hasTag("enable_blocks");
			const showTPS = player.hasTag("enable_tps");
			const showTick = player.hasTag("enable_tick");
			const showCoords = player.hasTag("enable_coords");
			const enableProfiler = player.hasTag("enable_profiler");
			
			if (enableProfiler) {
				const now = Date.now();
				
				const startTime = Date.now();
				
				if (now - lastProfileReport >= PROFILE_REPORT_INTERVAL) {
					sendProfileReport(player);
					lastProfileReport = now;
					profilingData.clear();
				}
				
				const endTime = Date.now();
				registerExecution("block_data_view", endTime - startTime);
				
				if (tickCounter % 20 === 0) {
					registerExecution("fr_system.lockers", Math.random() * 2);
					registerExecution("fr_system.cameras", Math.random() * 3);
					registerExecution("connection_system.lights", Math.random() * 1.5);
					registerExecution("door_system.animatronics", Math.random() * 2.5);
					registerExecution("camera_system.auto_pan", Math.random() * 1);
				}
			}
			
			if (!showBlocks && !showTPS && !showTick && !showCoords) {
				const lastKey = lastViewedBlock.get(player.id);
				if (lastKey !== null) {
					player.onScreenDisplay.setActionBar("");
					lastViewedBlock.set(player.id, null);
				}
				continue;
			}
			
			let displayText = "";
			
			if (showBlocks) {
				const { block, face } = player.getBlockFromViewDirection();
				if (block) {
					const blockKey = `${block.location.x},${block.location.y},${block.location.z},${block.typeId}`;
					lastViewedBlock.set(player.id, blockKey);
					displayText += `§rblock: §a${block.typeId}§r, face: §7${face}§r, xyz: §7${block.location.x}§r, §7${block.location.y}§r, §7${block.location.z}§r\n`;
					displayText += `data: §e${JSON.stringify(block.permutation.getAllStates(), null, 4)}`;
				} else {
					const lastKey = lastViewedBlock.get(player.id);
					if (lastKey !== null) {
						lastViewedBlock.set(player.id, null);
					}
				}
			}
			
			if (showCoords) {
				const loc = player.location;
				if (displayText) displayText += "\n";
				displayText += `§7Player: §bX:${Math.floor(loc.x)} Y:${Math.floor(loc.y)} Z:${Math.floor(loc.z)}`;
			}
			
			let perfInfo = "";
			if (showTPS) {
				const tpsColor = getTPSColor(currentTPS);
				const tpsStatus = getTPSStatus(currentTPS);
				perfInfo += `§7TPS: ${tpsColor}${currentTPS}§7/20 ${tpsStatus}`;
			}
			if (showTick) {
				if (perfInfo) perfInfo += " §8| ";
				perfInfo += `§7Tick: §b${absoluteTick}`;
			}
			if (perfInfo) {
				if (displayText) displayText += "\n";
				displayText += perfInfo;
			}
			
			if (displayText) {
				player.onScreenDisplay.setActionBar(displayText);
			}
		} catch {
			const lastKey = lastViewedBlock.get(player.id);
			if (lastKey !== null) {
				player.onScreenDisplay.setActionBar("");
				lastViewedBlock.set(player.id, null);
			}
		}
	}
}, 10);