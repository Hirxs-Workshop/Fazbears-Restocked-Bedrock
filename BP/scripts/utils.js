const adjustTextLength = (text = '', len = 100) => (text.slice(0, len)).padEnd(len, '\t');

const dynamicToast = (title = '', message = '', icon = '', bg = 'textures/ui/greyBorder') =>
    "§我§的§我§国" + adjustTextLength(title, 100) + adjustTextLength(message, 200) + adjustTextLength(icon, 100) + adjustTextLength(bg, 100);

const TOAST = {
    APPROVE: { icon: "textures/fr_ui/approve_icon", bg: "textures/fr_ui/approve_ui" },
    DENY: { icon: "textures/fr_ui/deny_icon", bg: "textures/fr_ui/deny_ui" },
    INFO: { icon: "textures/fr_ui/selection_icon", bg: "textures/fr_ui/default_ui" },
    WARN: { icon: "textures/fr_ui/warning_icon", bg: "textures/fr_ui/warning_ui" },
    LINK: { icon: "textures/fr_ui/unlinked_icon", bg: "textures/fr_ui/unlinked_ui" },
};

const toast = {
    success: (msg) => dynamicToast("§l§qSUCCESS", `§q${msg}`, TOAST.APPROVE.icon, TOAST.APPROVE.bg),
    error: (msg) => dynamicToast("§l§cERROR", `§c${msg}`, TOAST.DENY.icon, TOAST.DENY.bg),
    info: (msg) => dynamicToast("§l§7INFO", `§7${msg}`, TOAST.INFO.icon, TOAST.INFO.bg),
    warn: (msg) => dynamicToast("§l§cINFO", `§c${msg}`, TOAST.WARN.icon, TOAST.WARN.bg),
    linked: (msg) => dynamicToast("§l§eLINKED", `§6${msg}`, TOAST.LINK.icon, TOAST.LINK.bg),
};

const ACTIONBAR_CUSTOM_STYLE = "§e§s§c§r";
const ACTIONBAR_VARIANT_STYLE = "§r§e§d§r";
const ACTIONBAR_CAMERA_LOADING = "§C§A§M§L";
const ACTIONBAR_FAZTAB_OPEN = "§F§T§O§P";
const ACTIONBAR_FAZTAB_CLOSE = "§F§T§C§L";

const customActionbar = (text = '') => `${ACTIONBAR_CUSTOM_STYLE}${text}`;
const variantActionbar = (text = '') => `${ACTIONBAR_VARIANT_STYLE}${text}`;

const showCameraLoading = (player) => { try { player.onScreenDisplay.setActionBar(ACTIONBAR_CAMERA_LOADING); } catch { } };
const showFazTabOpen = (player) => { try { player.onScreenDisplay.setActionBar(ACTIONBAR_FAZTAB_OPEN); } catch { } };
const showFazTabClose = (player) => { try { player.onScreenDisplay.setActionBar(ACTIONBAR_FAZTAB_CLOSE); } catch { } };

const distance3D = (a, b) => Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2 + (a.z - b.z) ** 2);
const distanceSquared3D = (a, b) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2 + (a.z - b.z) ** 2;

const posToStr = (pos) => `${pos.x},${pos.y},${pos.z}`;
const strToPos = (str) => { const [x, y, z] = str.split(',').map(Number); return { x, y, z }; };
const blockCenter = (loc) => ({ x: loc.x + 0.5, y: loc.y + 0.5, z: loc.z + 0.5 });

const FACING_YAW = { north: 180, south: 0, east: 270, west: 90 };
const yawFromFacing = (facing) => FACING_YAW[facing] ?? 0;

const getPreciseRotation = (yaw) => {
    if (yaw < 0) yaw += 360;
    const rot = Math.round(yaw / 22.5);
    return rot !== 16 ? rot : 0;
};

const safeRun = (fn) => { try { fn(); } catch { } };
const safeRunAsync = async (fn) => { try { await fn(); } catch { } };
const safeGet = (fn, fallback = undefined) => { try { return fn(); } catch { return fallback; } };

const resetPlayerState = (player) => {
    safeRun(() => player.runCommand('hud @s reset'));
    safeRun(() => player.runCommand('effect @s clear'));
    safeRun(() => player.runCommand('title @s title bar:0'));
};

const getHeldItem = (player, fallback) => {
    if (fallback) return fallback;
    const eq = safeGet(() => player.getComponent?.('minecraft:equippable'));
    return safeGet(() => eq?.getEquipment?.('Mainhand'));
};

const isCreativeMode = (player) => safeGet(() => player.getGameMode?.() === 'creative', false);

export {
    adjustTextLength,
    dynamicToast,
    toast,
    TOAST,
    ACTIONBAR_CUSTOM_STYLE,
    ACTIONBAR_VARIANT_STYLE,
    customActionbar,
    variantActionbar,
    showCameraLoading,
    showFazTabOpen,
    showFazTabClose,
    distance3D,
    distanceSquared3D,
    posToStr,
    strToPos,
    blockCenter,
    yawFromFacing,
    getPreciseRotation,
    FACING_YAW,
    safeRun,
    safeRunAsync,
    safeGet,
    resetPlayerState,
    getHeldItem,
    isCreativeMode,
};
