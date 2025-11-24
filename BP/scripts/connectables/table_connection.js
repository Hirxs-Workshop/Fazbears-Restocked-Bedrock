/**
 * FAZBEAR'S RESTOCKED - BEDROCK
 * ©2025
 * 
 * If you want to modify or use this system as a base, contact the code developer, 
 * Hyrxs (discord: hyrxs), for more information and authorization
 * 
 * DO NOT COPY OR STEAL, ty :>ㅤ ㅤ ㅤ ㅤ ㅤ ㅤ ㅤ ㅤ 
 *  
*/


import { system, world } from '@minecraft/server'

const TABLE_TYPE_ID = 'fr:party_table';
const STANCHION_TYPE_ID = 'fr:stanchion';
const CONNECTABLE_TYPES = [TABLE_TYPE_ID, STANCHION_TYPE_ID];

const updateStanchionBasesForLine = (center) => {
  if (!center || center.typeId !== STANCHION_TYPE_ID) return;

  const north = center.north();
  const south = center.south();
  const east = center.east();
  const west = center.west();

  const hasNSNeighbor =
    (north && CONNECTABLE_TYPES.includes(north.typeId)) ||
    (south && CONNECTABLE_TYPES.includes(south.typeId));
  const axisNS = hasNSNeighbor;

  const stepNeg = (block) => (axisNS ? block.north() : block.west());
  const stepPos = (block) => (axisNS ? block.south() : block.east());

  let start = center;
  while (true) {
    const nb = stepNeg(start);
    if (!(nb && CONNECTABLE_TYPES.includes(nb.typeId))) break;
    start = nb;
  }
// ㅤ ㅤ ㅤ ㅤ ㅤ ㅤ ㅤ ㅤ 
  const line = [];
  let cur = start;
  while (cur && CONNECTABLE_TYPES.includes(cur.typeId)) {
    line.push(cur);
    const nb = stepPos(cur);
    if (!(nb && CONNECTABLE_TYPES.includes(nb.typeId))) break;
    cur = nb;
  }

  const len = line.length;
  if (len === 0) return;
  const mid = Math.floor(len / 2);

  const stanchions = line.filter(b => b.typeId === STANCHION_TYPE_ID);
  const stanchionCount = stanchions.length;

  for (let si = 0; si < stanchionCount; si++) {
    const block = stanchions[si];

    let hasBase;
    let combineNs = false;
    let combineEw = false;

    if (stanchionCount < 3) {
      const isEnd = si === 0 || si === stanchionCount - 1;
      hasBase = isEnd;
    } else {
      const isLast = si === stanchionCount - 1;
      
      if (si % 2 === 0) {
        hasBase = true;
      } else if (isLast && stanchionCount % 2 === 0) {// ㅤ ㅤ ㅤ ㅤ ㅤ ㅤ ㅤ ㅤ 
        hasBase = true;
      } else {
        hasBase = false;
        if (axisNS) combineNs = true; else combineEw = true;
      }
    }

    block.setPermutation(
      block.permutation
        .withState('fr:has_base', hasBase)
        .withState('fr:combine_ns', combineNs)
        .withState('fr:combine_ew', combineEw)
    );
  }
};

const updateForBlock = (b) => {
  if (!b || !CONNECTABLE_TYPES.includes(b.typeId)) return;
  const north = b.north();
  const south = b.south();
  const east = b.east();
  const west = b.west();

  const n = north && CONNECTABLE_TYPES.includes(north.typeId);
  const s = south && CONNECTABLE_TYPES.includes(south.typeId);
  const eConn = east && CONNECTABLE_TYPES.includes(east.typeId);
  const w = west && CONNECTABLE_TYPES.includes(west.typeId);

  b.setPermutation(
    b.permutation
      .withState('fr:north', n)
      .withState('fr:south', s)
      .withState('fr:east', eConn)
      .withState('fr:west', w)
  );

  if (b.typeId === STANCHION_TYPE_ID) {
    updateStanchionBasesForLine(b);
  }
};

const updateNeighborsIfConnectable = (block) => {
  if (!block) return;
  const neighbors = [block.north(), block.south(), block.east(), block.west()];
  for (const nb of neighbors) {
    if (nb && CONNECTABLE_TYPES.includes(nb.typeId)) updateForBlock(nb);
  }
};

system.beforeEvents.startup.subscribe((eventData) => {
  eventData.blockComponentRegistry.registerCustomComponent('fr:table_connection', {
    onPlace(e) {
      const { block } = e;
      updateForBlock(block);
      updateNeighborsIfConnectable(block);
    },// ㅤ ㅤ ㅤ ㅤ ㅤ ㅤ ㅤ ㅤ 
  });
});

world.afterEvents.playerBreakBlock.subscribe(({ block }) => {
  if (!block) return;
  updateNeighborsIfConnectable(block);
});

world.afterEvents.playerPlaceBlock.subscribe(({ block }) => {
  if (!block) return;
  
  if (CONNECTABLE_TYPES.includes(block.typeId)) {
    updateForBlock(block);
    updateNeighborsIfConnectable(block);
  } 
  else {
    updateNeighborsIfConnectable(block);
  }
});