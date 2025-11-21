import { system, CommandPermissionLevel, CustomCommandParamType, CustomCommandStatus } from '@minecraft/server';
import { ActionFormData, uiManager } from '@minecraft/server-ui';
import { securityCameraSystem } from './camera_system/security_camera_system.js';
import { dynamicToast } from './utils.js';

system.beforeEvents.startup.subscribe(({ customCommandRegistry }) => {
    customCommandRegistry.registerEnum('fr:featureType', ['UI']);
    customCommandRegistry.registerEnum('fr:uiType', ['newspaper', 'start-screen', 'custom-black-screen', 'custom-toast']);
    customCommandRegistry.registerEnum('fr:ampm', ['am', 'pm']);

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

            if (featureType === 'UI' && uiType === 'newspaper') {
                system.run(() => {
                    for (const player of targets) {
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
                                
                                outroForm.show(player).then(() => {});
                                
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

                                form.show(player).then(() => {});

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
                        player.runCommand('camera @s fade time 0 1 2');
                        player.runCommand('hud @s hide all');

                        const line1 = typeof time === 'string' ? time : '';
                        const line2 = typeof ampm === 'string' ? ampm : '';

                        system.runTimeout(() => {
                            const form = new ActionFormData();
                            // Reutilizamos el mismo flag que el start-screen para usar la misma UI negra custom
                            form.title('§S§T§A§R§T');
                            form.body('');

                            if (line1) form.label(line1);
                            if (line2) form.label(line2);

                            form.show(player).then(() => {});

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
                    try {
                        player.sendMessage(
                            dynamicToast(
                                title1,
                                title2,
                                'textures/fr_ui/debug_icon',
                                'textures/fr_ui/debug_ui'
                            )
                        );
                    } catch (e) {}
                }

                return { status: CustomCommandStatus.Success, message: `Showing custom toast to ${targets.length} player(s)` };
            }

            return { status: CustomCommandStatus.Failure };
        }
    );
});