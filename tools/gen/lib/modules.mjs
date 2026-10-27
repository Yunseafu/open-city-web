// Shared dimensions (metres). Facade textures tile on these modules, so building
// geometry must snap to them or windows get cut in half at corners.

export const CHUNK = 128;          // must match CHUNK_SIZE in src/world/ChunkManager.ts
export const PITCH = 64;           // road grid pitch; corridors are centred on x = 64k, z = 64k (chunk-local 0, 64, 128)
export const ROAD_W = 14;          // asphalt width: 4 lanes of 3.5
export const SIDEWALK_W = 3;       // each side
export const CORRIDOR_W = ROAD_W + 2 * SIDEWALK_W; // 20
export const CURB_H = 0.15;
export const BLOCK_W = PITCH - CORRIDOR_W; // 44: free space between two corridors
export const LOT = { small: 21, big: 42, alley: 2 }; // lots inside a block: 2x2 of 21, 2x1 of 21x42, or 1 of 42x42

export const FLOOR_H = 3.6;        // residential / office floor height
export const SHOP_H = 4.8;         // ground-floor storefront height
export const BAY_W = 3.0;          // one window bay; facade tile = 4 bays x 2 floors = 12 x 7.2 m
export const PARAPET_H = 1.0;

/** Round a length down to a whole number of bays. */
export const snapBays = (len) => Math.max(1, Math.floor(len / BAY_W + 1e-6)) * BAY_W;
/** Height of a building with `floors` floors above a shopfront ground floor (shop = true) or plain ground floor. */
export const buildingHeight = (floors, shop = true) => (shop ? SHOP_H : FLOOR_H) + (floors - 1) * FLOOR_H;
