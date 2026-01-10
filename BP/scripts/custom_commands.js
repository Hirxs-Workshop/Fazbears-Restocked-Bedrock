import { system, world, CommandPermissionLevel, CustomCommandParamType, CustomCommandStatus } from '@minecraft/server';
import { ActionFormData, uiManager } from '@minecraft/server-ui';
import { securityCameraSystem } from './camera_system/security_camera_system.js';
import { dynamicToast } from './utils.js';
import { showGeneratorHud, hideGeneratorHud, setGeneratorEnergy, showClockHud, hideClockHud, setSwitchLimit, setGeneratorLimit, setGeneratorDrainRate, setCustomNight } from './connection_system/main_system.js';
import { setDoorButtonLimit } from './connection_system/door_buttons.js';
import { setFazTabMaxRange, setFazTabMinRange } from './faz_tab_system.js';

system.beforeEvents.startup.subscribe(({ customCommandRegistry }) => {
    customCommandRegistry.registerEnum('fr:featureType', ['UI', 'HUD']);
    customCommandRegistry.registerEnum('fr:uiType', ['newspaper', 'start-screen', 'custom-black-screen', 'custom-toast']);
    customCommandRegistry.registerEnum('fr:hudType', ['generator', 'clock']);
    customCommandRegistry.registerEnum('fr:ampm', ['am', 'pm']);
    customCommandRegistry.registerEnum('fr:boolState', ['true', 'false']);
    customCommandRegistry.registerEnum('fr:generatorAction', ['energy', 'limit', 'drain']);
    customCommandRegistry.registerEnum('fr:connectionType', ['switch', 'door_button']);
    customCommandRegistry.registerEnum('fr:fazTabRangeType', ['max', 'min']);

    customCommandRegistry.registerCommand(
        {
            name: 'fr:faztab',
            description: 'Configure Faz-Tab range settings',
            permissionLevel: CommandPermissionLevel.GameDirectors,
            mandatoryParameters: [
                { name: 'fr:fazTabRangeType', type: CustomCommandParamType.Enum },
                { name: 'value', type: CustomCommandParamType.Integer }
            ]
        },
        (origin, rangeType, value) => {
            if (rangeType === 'max') {
                setFazTabMaxRange(value);
                return { status: CustomCommandStatus.Success, message: `Faz-Tab max range set to ${value} blocks` };
            }
            if (rangeType === 'min') {
                setFazTabMinRange(value);
                return { status: CustomCommandStatus.Success, message: `Faz-Tab min range set to ${value} blocks` };
            }
            return { status: CustomCommandStatus.Failure, message: 'Unknown range type' };
        }
    );

    customCommandRegistry.registerCommand(
        {
            name: 'fr:generator',
            description: 'Modify generator properties',
            permissionLevel: CommandPermissionLevel.GameDirectors,
            mandatoryParameters: [
                { name: 'fr:generatorAction', type: CustomCommandParamType.Enum }
            ],
            optionalParameters: [
                { name: 'x', type: CustomCommandParamType.Integer },
                { name: 'y', type: CustomCommandParamType.Integer },
                { name: 'z', type: CustomCommandParamType.Integer },
                { name: 'value', type: CustomCommandParamType.Integer }
            ]
        },
        (origin, action, x, y, z, value) => {
            if (action === 'energy') {
                if (x === undefined || y === undefined || z === undefined || value === undefined) {
                    return { status: CustomCommandStatus.Failure, message: 'Usage: /fr:generator energy <x> <y> <z> <value>' };
                }
                const dimensionId = origin.sourceEntity?.dimension?.id || 'minecraft:overworld';
                const result = setGeneratorEnergy(x, y, z, dimensionId, value);
                if (result.success) {
                    return { status: CustomCommandStatus.Success, message: result.message };
                } else {
                    return { status: CustomCommandStatus.Failure, message: result.message };
                }
            }
            if (action === 'limit') {
                if (x === undefined) {
                    return { status: CustomCommandStatus.Failure, message: 'Usage: /fr:generator limit <value>' };
                }
                setGeneratorLimit(x);
                return { status: CustomCommandStatus.Success, message: `Generator connection limit set to ${x}` };
            }
            if (action === 'drain') {
                if (x === undefined || y === undefined || z === undefined || value === undefined) {
                    return { status: CustomCommandStatus.Failure, message: 'Usage: /fr:generator drain <x> <y> <z> <percentage 10-200>' };
                }
                const dimensionId = origin.sourceEntity?.dimension?.id || 'minecraft:overworld';
                const result = setGeneratorDrainRate(x, y, z, dimensionId, value);
                if (result.success) {
                    return { status: CustomCommandStatus.Success, message: result.message };
                } else {
                    return { status: CustomCommandStatus.Failure, message: result.message };
                }
            }
            return { status: CustomCommandStatus.Failure, message: 'Unknown action' };
        }
    );

    customCommandRegistry.registerCommand(
        {
            name: 'fr:connection',
            description: 'Modify connection limits for switches and door buttons',
            permissionLevel: CommandPermissionLevel.GameDirectors,
            mandatoryParameters: [
                { name: 'fr:connectionType', type: CustomCommandParamType.Enum },
                { name: 'value', type: CustomCommandParamType.Integer }
            ]
        },
        (origin, connectionType, value) => {
            if (connectionType === 'switch') {
                setSwitchLimit(value);
                return { status: CustomCommandStatus.Success, message: `Switch connection limit set to ${value}` };
            }
            if (connectionType === 'door_button') {
                setDoorButtonLimit(value);
                return { status: CustomCommandStatus.Success, message: `Door Button connection limit set to ${value}` };
            }
            return { status: CustomCommandStatus.Failure, message: 'Unknown connection type' };
        }
    );

    customCommandRegistry.registerCommand(
        {
            name: 'fr:hud',
            description: 'Show or hide HUD elements (clock, generator)',
            permissionLevel: CommandPermissionLevel.GameDirectors,
            mandatoryParameters: [
                { name: 'fr:hudType', type: CustomCommandParamType.Enum },
                { name: 'target', type: CustomCommandParamType.PlayerSelector },
                { name: 'fr:boolState', type: CustomCommandParamType.Enum }
            ],
            optionalParameters: [
                { name: 'x', type: CustomCommandParamType.Integer },
                { name: 'y', type: CustomCommandParamType.Integer },
                { name: 'z', type: CustomCommandParamType.Integer }
            ]
        },
        (origin, hudType, targets, state, x, y, z) => {
            if (!targets || !Array.isArray(targets) || targets.length === 0) {
                return { status: CustomCommandStatus.Failure, message: 'No valid targets found' };
            }

            const showHud = state === 'true';

            if (hudType === 'clock') {
                system.run(() => {
                    for (const player of targets) {
                        if (!player) continue;
                        if (showHud) {
                            if (x !== undefined) {
                                setCustomNight(player.id, x);
                            }
                            showClockHud(player);
                        } else {
                            hideClockHud(player);
                        }
                    }
                });
                return { status: CustomCommandStatus.Success, message: `${showHud ? 'Showing' : 'Hiding'} clock HUD for ${targets.length} player(s)` };
            }

            if (hudType === 'generator') {
                if (showHud && (x === undefined || y === undefined || z === undefined)) {
                    return { status: CustomCommandStatus.Failure, message: 'Usage: /fr:hud generator <player> true <x> <y> <z>' };
                }
                system.run(() => {
                    for (const player of targets) {
                        if (!player) continue;
                        if (showHud) {
                            const blockPos = { x, y, z, dimensionId: player.dimension.id };
                            showGeneratorHud(player, blockPos);
                        } else {
                            hideGeneratorHud(player);
                        }
                    }
                });
                return { status: CustomCommandStatus.Success, message: `${showHud ? 'Showing' : 'Hiding'} generator HUD for ${targets.length} player(s)` };
            }

            return { status: CustomCommandStatus.Failure, message: 'Unknown HUD type' };
        }
    );

    customCommandRegistry.registerCommand(
        {
            name: 'fr:features',
            description: 'Show custom UI features to players',
            permissionLevel: CommandPermissionLevel.GameDirectors,
            mandatoryParameters: [
                { name: 'target', type: CustomCommandParamType.PlayerSelector },
                { name: 'fr:featureType', type: CustomCommandParamType.Enum },
                { name: 'fr:uiType', type: CustomCommandParamType.Enum }
            ],
            optionalParameters: [
                { name: 'time', type: CustomCommandParamType.String },
                { name: 'fr:ampm', type: CustomCommandParamType.String },
                { name: 'nightNumber', type: CustomCommandParamType.Integer }
            ]
        },
        (origin, targets, featureType, uiType, time, ampm, nightNumber) => {
            if (!targets || !Array.isArray(targets) || targets.length === 0) {
                return { status: CustomCommandStatus.Failure, message: 'No valid targets found' };
            }

            if (featureType === 'UI' && uiType === 'newspaper') {
                system.run(() => {
                    for (const player of targets) {
                        if (!player) continue;
                        player.runCommand('camera @s fade time 0 1 2');
                        player.runCommand('hud @s hide all');

                        system.runTimeout(() => {
                            const form = new ActionFormData();
                            form.title('§N§E§W§S');
                            form.body('');
                            form.button('§fContinue');

                            form.show(player).then((response) => {
                                const outroForm = new ActionFormData();
                                outroForm.title('§N§E§W§S§O§U§T§R§O');
                                outroForm.body('');

                                outroForm.show(player).then(() => { });

                                system.runTimeout(() => {
                                    uiManager.closeAllForms(player);
                                    player.runCommand('camera @s fade time 0 1 2');
                                    system.runTimeout(() => {
                                        player.runCommand('hud @s reset');
                                    }, 20);
                                }, 80);
                            });
                        }, 20);
                    }
                });
                return { status: CustomCommandStatus.Success, message: `Showing newspaper to ${targets.length} player(s)` };
            }

            if (featureType === 'UI' && uiType === 'start-screen') {
                system.run(() => {
                    for (const player of targets) {
                        if (!player) continue;
                        player.runCommand('camera @s fade time 0 1 2');
                        player.runCommand('hud @s hide all');

                        const useManual = typeof time === 'string' && typeof ampm === 'string' && typeof nightNumber === 'number';

                        const showStartScreen = (timeText, nightText) => {
                            system.runTimeout(() => {
                                const form = new ActionFormData();
                                form.title('§S§T§A§R§T');
                                form.body('');
                                form.label(`${timeText}`);
                                form.label(`${nightText}`);

                                form.show(player).then(() => { });

                                system.runTimeout(() => {
                                    uiManager.closeAllForms(player);
                                    player.runCommand('camera @s fade time 0 1 2');
                                    system.runTimeout(() => {
                                        player.runCommand('hud @s reset');
                                    }, 20);
                                }, 100);
                            }, 20);
                        };

                        if (useManual) {
                            const safeAmpm = ampm?.toUpperCase?.() ?? '';
                            const manualTimeText = `${time} ${safeAmpm}`.trim();
                            const n = nightNumber ?? 1;
                            const j = n % 10;
                            const k = n % 100;
                            const suffix = (j === 1 && k !== 11) ? 'st' : (j === 2 && k !== 12) ? 'nd' : (j === 3 && k !== 13) ? 'rd' : 'th';
                            const manualNightText = `${n}${suffix} Night`;
                            showStartScreen(manualTimeText, manualNightText);
                        } else {
                            securityCameraSystem.getWorldTimeLabelsAsync(player).then((labels) => {
                                const clockRaw = labels?.clock ?? '';
                                const periodRaw = labels?.period ?? '';

                                let hour = clockRaw;
                                let ampmLabel = '';
                                const clockParts = clockRaw.split(' ');
                                if (clockParts.length >= 2) {
                                    hour = clockParts[0];
                                    ampmLabel = clockParts[1];
                                }
                                const autoTimeText = hour ? `${hour}:00 ${ampmLabel}`.trim() : clockRaw;

                                let n = 1;
                                const match = periodRaw.match(/(\d+)/);
                                if (match) {
                                    const parsed = Number(match[1]);
                                    if (!Number.isNaN(parsed) && parsed > 0) n = parsed;
                                }
                                const isNight = periodRaw.toLowerCase().startsWith('night');
                                const labelWord = isNight ? 'Night' : 'Day';
                                const j = n % 10;
                                const k = n % 100;
                                const suffix = (j === 1 && k !== 11) ? 'st' : (j === 2 && k !== 12) ? 'nd' : (j === 3 && k !== 13) ? 'rd' : 'th';
                                const autoNightText = `${n}${suffix} ${labelWord}`;

                                showStartScreen(autoTimeText, autoNightText);
                            }).catch(() => {
                                showStartScreen('12:00 AM', '1st Night');
                            });
                        }
                    }
                });
                return { status: CustomCommandStatus.Success, message: `Showing start screen to ${targets.length} player(s)` };
            }

            if (featureType === 'UI' && uiType === 'custom-black-screen') {
                system.run(() => {
                    for (const player of targets) {
                        if (!player) continue;
                        player.runCommand('camera @s fade time 0 1 2');
                        player.runCommand('hud @s hide all');

                        const line1 = typeof time === 'string' ? time : '';
                        const line2 = typeof ampm === 'string' ? ampm : '';

                        system.runTimeout(() => {
                            const form = new ActionFormData();
                            form.title('§S§T§A§R§T');
                            form.body('');

                            if (line1) form.label(line1);
                            if (line2) form.label(line2);

                            form.show(player).then(() => { });

                            system.runTimeout(() => {
                                uiManager.closeAllForms(player);
                                player.runCommand('camera @s fade time 0 1 2');
                                system.runTimeout(() => {
                                    player.runCommand('hud @s reset');
                                }, 20);
                            }, 100);
                        }, 20);
                    }
                });

                return { status: CustomCommandStatus.Success, message: `Showing custom black screen to ${targets.length} player(s)` };
            }

            if (featureType === 'UI' && uiType === 'custom-toast') {
                const title1 = typeof time === 'string' ? time : '';
                const title2 = typeof ampm === 'string' ? ampm : '';

                for (const player of targets) {
                    if (!player) continue;
                    try {
                        player.sendMessage(
                            dynamicToast(
                                title1,
                                title2,
                                'textures/fr_ui/debug_icon',
                                'textures/fr_ui/debug_ui'
                            )
                        );
                    } catch (e) { }
                }

                return { status: CustomCommandStatus.Success, message: `Showing custom toast to ${targets.length} player(s)` };
            }

            return { status: CustomCommandStatus.Failure };
        }
    );
});