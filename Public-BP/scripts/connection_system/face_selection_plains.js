
import { Direction } from "@minecraft/server";

export default class FaceSelectionPlains {
  constructor(...plains) {
    this.plains = plains;
  }
  getSelected(event, blockPos) {
    if (!event.faceLocation) return undefined;
    const fracX = event.faceLocation.x - Math.floor(event.faceLocation.x);
    const fracY = event.faceLocation.y - Math.floor(event.faceLocation.y);
    const fracZ = event.faceLocation.z - Math.floor(event.faceLocation.z);

    let relU = 0;
    let relV = 0;

    switch (event.face) {
      case Direction.Up:
        relU = fracX * 16;
        relV = fracZ * 16;
        break;
      case Direction.Down:
        relU = fracX * 16;
        relV = (1 - fracZ) * 16;
        break;
      case Direction.North:
        relU = fracX * 16;
        relV = (1 - fracY) * 16;
        break;
      case Direction.South:
        relU = (1 - fracX) * 16;
        relV = (1 - fracY) * 16;
        break;
      case Direction.East:
        relU = (1 - fracZ) * 16;
        relV = (1 - fracY) * 16;
        break;
      case Direction.West:
        relU = fracZ * 16;
        relV = (1 - fracY) * 16;
        break;
      default:
        relU = fracX * 16;
        relV = (1 - fracY) * 16;
    }
    for (let plain of this.plains) {
      if (relU >= plain.origin[0] && relU <= (plain.origin[0] + plain.size[0]) &&
          relV >= plain.origin[1] && relV <= (plain.origin[1] + plain.size[1])) {
        return plain.name;
      }
    }
    return undefined;
  }
}
