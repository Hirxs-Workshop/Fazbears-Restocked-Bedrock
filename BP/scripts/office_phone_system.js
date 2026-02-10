import { system, world } from "@minecraft/server";
import { ActionFormData, uiManager } from "@minecraft/server-ui";
import { resolveOfficePhoneRoute } from "./office_phone_routes.js";

class OfficePhoneSystem {
    constructor() {
        this.FLAG_PHONE = "§P§H§O§N§E";
        this.FLAG_MENU = "§M§E§N§U";
        this.FLAG_HELP = "§H§E§L§P";
        this.FLAG_HISTORY = "§H§I§S§T";
        this.FLAG_OPTIONS = "§O§P§T§S";
        this.SEL_MARK = "§S§E§L";
        this.sessions = new Map();
        this.DIAL_TARGET = "18335780158";
        this.MENU_ITEMS = [
            "NIGHT 1",
            "NIGHT 2",
            "NIGHT 3",
            "NIGHT 4",
            "NIGHT 5",
            "CUSTOM",
            "TRAINING",
            "EXIT LOGS",
        ];
    }

    onPlayerInteract(event) {
        try {
            const { player, block } = event;
            if (!player || !block) return;
            if (block.typeId !== "fr:office_phone") return;
            event.cancel = true;
            system.run(() => {
                try {
                    this.open(player, block);
                } catch { }
            });
        } catch { }
    }

    open(player, block) {
        try {
            const pid = player.id;
            const dimId = block.dimension.id;
            const locStr = this._locStr(block.location);
            this.sessions.set(pid, {
                phone: locStr,
                dimId,
                dial: "",
                screen: "dialpad",
                selected: 0,
                historySelected: 0,
                history: [this.DIAL_TARGET],
                menuItems: null,
                optionsSelected: 0,
                optionsRoute: null,
            });
            this._setPhoneCamera(player, block);
            system.run(() => this._showDialpad(player));
        } catch { }
    }

    _showDialpad(player) {
        try {
            const pid = player.id;
            const session = this.sessions.get(pid);
            if (!session) return;
            const block = this._getPhoneBlock(session);
            if (!block) {
                this._exit(player);
                return;
            }

            const form = new ActionFormData();
            form.title(this.FLAG_PHONE);
            form.body(" ");

            form.button("+");
            form.button("?");

            form.button("1");
            form.button("2");
            form.button("3");
            form.button("4");
            form.button("5");
            form.button("6");
            form.button("7");
            form.button("8");
            form.button("9");

            form.button("CLEAR");
            form.button("0");
            form.button("DELETE");

            form.button("CALL");
            form.button("CANCEL");
            form.button(this._formatDial(session.dial));

            form.show(player).then((res) => {
                try {
                    if (!this.sessions.has(pid)) return;
                    if (res.canceled || res.selection === undefined) {
                        this._exit(player);
                        return;
                    }

                    const sel = res.selection;
                    if (sel === 15) {
                        this._exit(player);
                        return;
                    }

                    if (sel === 0) {
                        system.run(() => this._showHistory(player));
                        return;
                    }
                    if (sel === 1) {
                        system.run(() => this._showHelp(player));
                        return;
                    }

                    if (sel >= 2 && sel <= 10) {
                        const digit = String(sel - 1);
                        this._appendDial(pid, digit);
                        system.run(() => this._showDialpad(player));
                        return;
                    }

                    if (sel === 12) {
                        this._appendDial(pid, "0");
                        system.run(() => this._showDialpad(player));
                        return;
                    }

                    if (sel === 11) {
                        this._setDial(pid, "");
                        system.run(() => this._showDialpad(player));
                        return;
                    }

                    if (sel === 13) {
                        this._deleteDial(pid);
                        system.run(() => this._showDialpad(player));
                        return;
                    }

                    if (sel === 14) {
                        system.run(() => this._attemptCall(player, 0));
                        return;
                    }

                    system.run(() => this._showDialpad(player));
                } catch {
                    this._exit(player);
                }
            }).catch(() => this._exit(player));
        } catch { }
    }

    _showMenu(player) {
        try {
            const pid = player.id;
            const session = this.sessions.get(pid);
            if (!session) return;
            const block = this._getPhoneBlock(session);
            if (!block) {
                this._exit(player);
                return;
            }
            const menuItems = Array.isArray(session.menuItems) && session.menuItems.length ? session.menuItems : this.MENU_ITEMS;
            const selected = typeof session.selected === "number" ? session.selected : 0;

            const form = new ActionFormData();
            form.title(this.FLAG_PHONE + this.FLAG_MENU);
            form.body(this._formatDial(session.dial));

            for (let i = 0; i < menuItems.length; i++) {
                const label = menuItems[i];
                const text = (i === selected ? this.SEL_MARK : "") + label;
                form.button(text);
            }
            form.button("CALL");
            form.button("CANCEL");

            form.show(player).then((res) => {
                try {
                    if (!this.sessions.has(pid)) return;
                    if (res.canceled || res.selection === undefined) {
                        this._exit(player);
                        return;
                    }
                    const sel = res.selection;
                    const callIndex = menuItems.length;
                    const cancelIndex = menuItems.length + 1;
                    if (sel === cancelIndex) {
                        this._exit(player);
                        return;
                    }
                    if (sel === callIndex) {
                        const s = this.sessions.get(pid);
                        const idx = typeof s?.selected === "number" ? s.selected : -1;
                        if (idx < 0 || idx >= menuItems.length) {
                            try {
                                player.playSound("note.bass");
                            } catch { }
                            system.run(() => this._showMenu(player));
                            return;
                        }
                        this._playCallSound(block);
                        system.run(() => this._showMenu(player));
                        return;
                    }
                    if (sel >= 0 && sel < menuItems.length) {
                        const s = this.sessions.get(pid);
                        if (s) s.selected = sel;
                        system.run(() => this._showMenu(player));
                        return;
                    }
                    system.run(() => this._showMenu(player));
                } catch {
                    this._exit(player);
                }
            }).catch(() => this._exit(player));
        } catch { }
    }

    _exit(player) {
        try {
            const pid = player.id;
            this.sessions.delete(pid);
            try {
                player.runCommand(`camera @s fade time 0.12 0 0.12 color 0 0 0`);
            } catch { }
            system.runTimeout(() => {
                try {
                    player.runCommand(`camera @s clear`);
                } catch { }
                try {
                    uiManager.closeAllForms(player);
                } catch { }
            }, 1);
        } catch { }
    }

    _appendDial(pid, ch) {
        const session = this.sessions.get(pid);
        if (!session) return;
        if (session.dial.length >= 18) return;
        session.dial += ch;
    }

    _setDial(pid, value) {
        const session = this.sessions.get(pid);
        if (!session) return;
        session.dial = value;
    }

    _deleteDial(pid) {
        const session = this.sessions.get(pid);
        if (!session) return;
        session.dial = session.dial.slice(0, Math.max(0, session.dial.length - 1));
    }

    _formatDial(text) {
        const raw = text || "";
        return raw.length ? raw : " ";
    }

    _digitsOnly(text) {
        let out = "";
        for (let i = 0; i < text.length; i++) {
            const c = text[i];
            if (c >= "0" && c <= "9") out += c;
        }
        return out;
    }

    _getPhoneBlock(session) {
        try {
            const dim = world.getDimension(session.dimId);
            const loc = this._locFromStr(session.phone);
            const block = dim.getBlock(loc);
            if (!block || block.typeId !== "fr:office_phone") return null;
            return block;
        } catch {
            return null;
        }
    }

    _setPhoneCamera(player, block) {
        try {
            const dir = block.permutation.getState("minecraft:cardinal_direction") ?? "south";
            const yaw = this._yawFromCardinal(dir);
            const yawRad = (yaw * Math.PI) / 180;
            const forwardX = -Math.sin(yawRad);
            const forwardZ = Math.cos(yawRad);
            const rightX = Math.cos(yawRad);
            const rightZ = Math.sin(yawRad);

            const centerX = block.location.x + 0.5;
            const centerY = block.location.y + 0.7;
            const centerZ = block.location.z + 0.5;

            const back = 1.5;
            const side = 1.0;
            const height = 1.35;

            const camX = centerX - forwardX * back + rightX * side;
            const camY = centerY + height;
            const camZ = centerZ - forwardZ * back + rightZ * side;

            const lookX = centerX + forwardX * 0.3;
            const lookY = centerY + 0.35;
            const lookZ = centerZ + forwardZ * 0.3;

            try {
                player.runCommand(`camera @s fade time 0.12 0 0.12 color 0 0 0`);
            } catch { }
            system.runTimeout(() => {
                try {
                    player.runCommand(`camera @s set minecraft:free ease 0.3 linear pos ${camX} ${camY} ${camZ} facing ${lookX} ${lookY} ${lookZ}`);
                } catch { }
                try {
                    player.runCommand(`camera @s fov_set 30`);
                } catch { }
            }, 1);
        } catch { }
    }

    _yawFromCardinal(dir) {
        switch (dir) {
            case "north":
                return 180;
            case "west":
                return -90;
            case "east":
                return 90;
            case "south":
            default:
                return 0;
        }
    }

    _playCallSound(phoneBlock) {
        try {
            const loc = {
                x: phoneBlock.location.x + 0.5,
                y: phoneBlock.location.y + 0.5,
                z: phoneBlock.location.z + 0.5,
            };
            const dim = phoneBlock.dimension;
            const targets = dim.getPlayers({ location: loc, maxDistance: 16 });
            for (const p of targets) {
                try {
                    p.playSound("note.pling", { location: loc, volume: 1.0, pitch: 1.0 });
                } catch { }
            }
            system.runTimeout(() => {
                try {
                    const t2 = dim.getPlayers({ location: loc, maxDistance: 16 });
                    for (const p of t2) {
                        try {
                            p.playSound("note.pling", { location: loc, volume: 1.0, pitch: 0.9 });
                        } catch { }
                    }
                } catch { }
            }, 10);
            system.runTimeout(() => {
                try {
                    const t3 = dim.getPlayers({ location: loc, maxDistance: 16 });
                    for (const p of t3) {
                        try {
                            p.playSound("note.pling", { location: loc, volume: 1.0, pitch: 0.8 });
                        } catch { }
                    }
                } catch { }
            }, 20);
        } catch { }
    }

    _locStr(loc) {
        return `${loc.x},${loc.y},${loc.z}`;
    }

    _locFromStr(str) {
        const parts = String(str).split(",");
        const x = Number(parts[0]);
        const y = Number(parts[1]);
        const z = Number(parts[2]);
        return { x, y, z };
    }

    _attemptCall(player, depth = 0) {
        try {
            if (depth > 4) {
                try {
                    player.playSound("note.bass");
                } catch { }
                system.run(() => this._showDialpad(player));
                return;
            }
            const pid = player.id;
            const session = this.sessions.get(pid);
            if (!session) return;
            const block = this._getPhoneBlock(session);
            if (!block) {
                this._exit(player);
                return;
            }

            const normalized = this._digitsOnly(session.dial ?? "");
            this._recordHistory(pid, normalized);

            const route = resolveOfficePhoneRoute(normalized);
            if (route) {
                system.run(() => this._handleRoute(player, route, depth));
                return;
            }

            try {
                player.playSound("note.bass");
            } catch { }
            system.run(() => this._showDialpad(player));
        } catch {
            this._exit(player);
        }
    }

    _handleRoute(player, route, depth) {
        try {
            const pid = player.id;
            const session = this.sessions.get(pid);
            if (!session) return;

            if (route?.type === "menu") {
                session.screen = "menu";
                session.menuItems = Array.isArray(route.menuItems) ? route.menuItems : null;
                if (typeof session.selected !== "number") session.selected = 0;
                system.run(() => this._showMenu(player));
                return;
            }

            if (route?.type === "text") {
                const title = typeof route.title === "string" ? route.title : "HELP";
                const body = typeof route.body === "string" ? route.body : " ";
                system.run(() => this._showHelp(player, title, body));
                return;
            }

            if (route?.type === "options") {
                session.screen = "options";
                session.optionsRoute = route;
                if (typeof session.optionsSelected !== "number") session.optionsSelected = 0;
                system.run(() => this._showOptions(player, depth));
                return;
            }
        } catch { }
        try {
            player.playSound("note.bass");
        } catch { }
        system.run(() => this._showDialpad(player));
    }

    _recordHistory(pid, normalized) {
        const session = this.sessions.get(pid);
        if (!session) return;
        if (!normalized) return;
        if (!Array.isArray(session.history)) session.history = [this.DIAL_TARGET];

        const unique = [];
        const pushUnique = (n) => {
            if (!n) return;
            if (unique.includes(n)) return;
            unique.push(n);
        };

        pushUnique(this.DIAL_TARGET);
        for (const n of session.history) {
            if (typeof n === "string") pushUnique(n);
        }
        pushUnique(normalized);

        session.history = unique.slice(0, 12);
        if (typeof session.historySelected !== "number") session.historySelected = 0;
        if (session.historySelected >= session.history.length) session.historySelected = 0;
    }

    _showHelp(player, titleText = "HELP", bodyText = "Marca el número y presiona CALL.\n\n+ abre el historial.\n? abre esta ayuda.\n\nCLEAR borra todo.\nDELETE borra un dígito.") {
        try {
            const pid = player.id;
            const session = this.sessions.get(pid);
            if (!session) return;
            const block = this._getPhoneBlock(session);
            if (!block) {
                this._exit(player);
                return;
            }

            const form = new ActionFormData();
            form.title(this.FLAG_PHONE + this.FLAG_HELP);
            form.body(" ");
            form.button("BACK");
            form.button(titleText);
            form.button(bodyText);

            form.show(player).then((res) => {
                try {
                    if (!this.sessions.has(pid)) return;
                    if (res.canceled || res.selection === undefined) {
                        this._exit(player);
                        return;
                    }
                    if (res.selection !== 0) {
                        system.run(() => this._showHelp(player, titleText, bodyText));
                        return;
                    }
                    const s = this.sessions.get(pid);
                    if (s) s.screen = "dialpad";
                    system.run(() => this._showDialpad(player));
                } catch {
                    this._exit(player);
                }
            }).catch(() => this._exit(player));
        } catch { }
    }

    _showOptions(player, depth) {
        try {
            const pid = player.id;
            const session = this.sessions.get(pid);
            if (!session) return;
            const block = this._getPhoneBlock(session);
            if (!block) {
                this._exit(player);
                return;
            }

            const route = session.optionsRoute;
            const options = Array.isArray(route?.options) ? route.options : [];
            const selected = typeof session.optionsSelected === "number" ? session.optionsSelected : 0;
            const maxItems = 4;

            const form = new ActionFormData();
            form.title(this.FLAG_PHONE + this.FLAG_OPTIONS);
            form.body(" ");

            for (let i = 0; i < maxItems; i++) {
                const opt = options[i];
                const label = typeof opt?.label === "string" ? opt.label : " ";
                form.button(i === selected ? (this.SEL_MARK + label) : label);
            }
            form.button("SELECT");
            form.button("CALL");
            form.button("CANCEL");
            form.button(typeof route?.title === "string" ? route.title : " ");

            form.show(player).then((res) => {
                try {
                    if (!this.sessions.has(pid)) return;
                    if (res.canceled || res.selection === undefined) {
                        this._exit(player);
                        return;
                    }

                    const sel = res.selection;
                    const selectIndex = maxItems;
                    const callIndex = maxItems + 1;
                    const cancelIndex = maxItems + 2;

                    if (sel === cancelIndex) {
                        system.run(() => this._showDialpad(player));
                        return;
                    }

                    if (sel >= 0 && sel < maxItems) {
                        const s = this.sessions.get(pid);
                        if (s) s.optionsSelected = sel;
                        system.run(() => this._showOptions(player, depth));
                        return;
                    }

                    const idx = typeof this.sessions.get(pid)?.optionsSelected === "number" ? this.sessions.get(pid).optionsSelected : 0;
                    const opt = options[idx];
                    const actionRoute = opt?.route;
                    const dial = this._digitsOnly(String(opt?.dial ?? ""));

                    if (sel === selectIndex) {
                        if (dial) {
                            const s = this.sessions.get(pid);
                            if (s) s.dial = dial;
                            system.run(() => this._showDialpad(player));
                            return;
                        }
                        if (actionRoute && typeof actionRoute === "object") {
                            system.run(() => this._handleRoute(player, actionRoute, 0));
                            return;
                        }
                        try {
                            player.playSound("note.bass");
                        } catch { }
                        system.run(() => this._showOptions(player, depth));
                        return;
                    }

                    if (sel === callIndex) {
                        if (dial) {
                            const s = this.sessions.get(pid);
                            if (s) s.dial = dial;
                            system.run(() => this._attemptCall(player, (depth ?? 0) + 1));
                            return;
                        }
                        if (actionRoute && typeof actionRoute === "object") {
                            system.run(() => this._handleRoute(player, actionRoute, (depth ?? 0) + 1));
                            return;
                        }
                        try {
                            player.playSound("note.bass");
                        } catch { }
                        system.run(() => this._showOptions(player, depth));
                        return;
                    }

                    system.run(() => this._showOptions(player, depth));
                } catch {
                    this._exit(player);
                }
            }).catch(() => this._exit(player));
        } catch { }
    }

    _showHistory(player) {
        try {
            const pid = player.id;
            const session = this.sessions.get(pid);
            if (!session) return;
            const block = this._getPhoneBlock(session);
            if (!block) {
                this._exit(player);
                return;
            }

            this._recordHistory(pid, this._digitsOnly(session.dial ?? ""));

            const history = Array.isArray(session.history) ? session.history : [this.DIAL_TARGET];
            const maxItems = 6;
            const items = history.slice(0, maxItems);
            const selected = typeof session.historySelected === "number" ? session.historySelected : 0;

            const form = new ActionFormData();
            form.title(this.FLAG_PHONE + this.FLAG_HISTORY);
            form.body(" ");

            for (let i = 0; i < maxItems; i++) {
                const n = items[i] ?? " ";
                form.button(i === selected ? (this.SEL_MARK + n) : n);
            }
            form.button("SELECT");
            form.button("CALL");
            form.button("CANCEL");

            form.show(player).then((res) => {
                try {
                    if (!this.sessions.has(pid)) return;
                    if (res.canceled || res.selection === undefined) {
                        this._exit(player);
                        return;
                    }

                    const sel = res.selection;
                    const selectIndex = maxItems;
                    const callIndex = maxItems + 1;
                    const cancelIndex = maxItems + 2;

                    if (sel === cancelIndex) {
                        system.run(() => this._showDialpad(player));
                        return;
                    }

                    if (sel >= 0 && sel < maxItems) {
                        const s = this.sessions.get(pid);
                        if (s) s.historySelected = sel;
                        system.run(() => this._showHistory(player));
                        return;
                    }

                    const idx = typeof this.sessions.get(pid)?.historySelected === "number" ? this.sessions.get(pid).historySelected : 0;
                    const chosen = items[idx] ?? "";
                    const normalized = this._digitsOnly(chosen);
                    if (!normalized) {
                        try {
                            player.playSound("note.bass");
                        } catch { }
                        system.run(() => this._showHistory(player));
                        return;
                    }

                    if (sel === selectIndex) {
                        const s = this.sessions.get(pid);
                        if (s) s.dial = normalized;
                        system.run(() => this._showDialpad(player));
                        return;
                    }
                    if (sel === callIndex) {
                        const s = this.sessions.get(pid);
                        if (s) s.dial = normalized;
                        system.run(() => this._attemptCall(player, 1));
                        return;
                    }

                    system.run(() => this._showHistory(player));
                } catch {
                    this._exit(player);
                }
            }).catch(() => this._exit(player));
        } catch { }
    }
}

export const officePhoneSystem = new OfficePhoneSystem();
