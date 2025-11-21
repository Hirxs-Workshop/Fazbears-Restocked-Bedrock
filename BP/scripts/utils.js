function adjustTextLength(text = '', totalLength = 100) {
    return (text.slice(0, totalLength)).padEnd(totalLength, '\t');
}

function dynamicToast(title = '', message = '', icon = '', background = 'textures/ui/greyBorder') {
    return "§N§O§T§I§F§I§C§A§T§I§O§N" +
        adjustTextLength(title, 100) +
        adjustTextLength(message, 200) +
        adjustTextLength(icon, 100) +
        adjustTextLength(background, 100);
}

const ACTIONBAR_CUSTOM_STYLE = "§e§s§c§r";
const ACTIONBAR_VARIANT_STYLE = "§r§e§d§r";
const ACTIONBAR_CAMERA_LOADING = "§C§A§M§L";

function customActionbar(text = '') {
    try { return `${ACTIONBAR_CUSTOM_STYLE}${text}`; } catch { return text; }
}

function variantActionbar(text = '') {
    try { return `${ACTIONBAR_VARIANT_STYLE}${text}`; } catch { return text; }
}

function showCameraLoading(player) {
    try {
        player.onScreenDisplay.setActionBar(ACTIONBAR_CAMERA_LOADING);
    } catch (e) {}
}

export {
    adjustTextLength,
    dynamicToast,
    ACTIONBAR_CUSTOM_STYLE,
    ACTIONBAR_VARIANT_STYLE,
    customActionbar,
    variantActionbar,
    showCameraLoading
};
