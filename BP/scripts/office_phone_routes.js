export const officePhoneRoutes = {
    "67": {
        type: "text",
        title: " ",
        body: "BRO 67 is not just a bad number, it's a straight-up mathematical mistake that should've been deleted a long time ago.\n\nIt has no purpose, no presence, and absolutely no right to exist between numbers that at least try to be useful.\n67 doesn't commit to anything.\nIt's too scared to be 60 and too weak to reach 70, so it just rots in the middle, doing nothing but being mid and embarrassing.\n\nIn calculations, 67 is actively annoying.\nIt doesn't simplify anything, it doesn't help mental math, and it forces you to stop and think for no reason.\nA number's job is to make things easier, and 67 fails at that completely.\n\nVisually, it's ugly and incoherent.\nThe 6 is round and lazy, the 7 is sharp and trying way too hard, and together they look like two numbers that hate each other but got stuck together anyway.\nThere's no balance, no flow, no logic.\n\nIn real life, 67 is always disappointing.\n67 percent is mediocre.\nA 67 grade is failure with manners.\nIt's the number of “almost”, “barely”, and “nah, try again”.\n\nThe worst part is that 67 pretends it matters.\nIt sits there between actually useful numbers, acting important while contributing nothing.\nIt's filler, padding, the leftover mistake nobody bothered to fix.\n\nIf 67 disappeared tomorrow, nothing would be lost.\nIt was never relevant, never helpful, and never deserved to exist.",
    },
    "18335780158": {
        type: "menu",
        menuItems: [
            "NIGHT 1",
            "NIGHT 2",
            "NIGHT 3",
            "NIGHT 4",
            "NIGHT 5",
            "CUSTOM",
            "TRAINING",
            "EXIT LOGS",
        ],
    },
    "2492": {
        type: "options",
        title: "SELECCIONA OPCIÓN",
        options: [
            { label: "LLAMAR A 1", dial: "18335780158" },
            { label: "SOLO TEXTO", route: { type: "text", title: "INFO", body: "Este número solo muestra texto." } },
            { label: "OPCIÓN 3", dial: "18335780158" },
            { label: "OPCIÓN 4", dial: "18335780158" },
        ],
    },
};

export function resolveOfficePhoneRoute(normalizedNumber) {
    const key = String(normalizedNumber ?? "");
    const route = officePhoneRoutes[key];
    if (!route || typeof route !== "object") return null;
    return route;
}
