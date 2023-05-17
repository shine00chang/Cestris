import * as k from "./config.mjs";

function cyrb128(str) {
    let h1 = 1779033703,
        h2 = 3144134277,
        h3 = 1013904242,
        h4 = 2773480762;
    for (let i = 0, k; i < str.length; i++) {
        k = str.charCodeAt(i);
        h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
        h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
        h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
        h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
    }
    h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
    h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
    h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
    h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
    return [
        (h1 ^ h2 ^ h3 ^ h4) >>> 0,
        (h2 ^ h1) >>> 0,
        (h3 ^ h1) >>> 0,
        (h4 ^ h1) >>> 0,
    ];
}
const characters =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
function generateString(length) {
    let result = " ";
    const charactersLength = characters.length;
    for (let i = 0; i < length; i++) {
        result += characters.charAt(
            Math.floor(Math.random() * charactersLength)
        );
    }

    return result;
}

export class Piece {
    constructor(type) {
        this.type = type;
        this.r = 0;
        this.mapSize = type == "I" ? 5 : 3;
        this.tick = 0;
		this.lock_tick = 0;
        this.x = type == "I" ? 2 : 3;
        this.y = 0;
        this.didKick = false;
    }
    static map(p, x, y) {
        return k.PIECE_MAPS[p.type][p.r][y * p.mapSize + x];
    }
}

export class State {
    static rand(state) {
        state[0] >>>= 0;
        state[1] >>>= 0;
        state[2] >>>= 0;
        state[3] >>>= 0;
        let t = (state[0] + state[1]) | 0;
        state[0] = state[1] ^ (state[1] >>> 9);
        state[1] = (state[2] + (state[2] << 3)) | 0;
        state[2] = (state[2] << 21) | (state[2] >>> 11);
        state[3] = (state[3] + 1) | 0;
        t = (t + state[3]) | 0;
        state[2] = (state[2] + t) | 0;
        return (t >>> 0) / 4294967296;
    }
    static genSeed() {
    	return [generateString(10), generateString(10)]; 
    }
    static setSeed(state, seed) {
        state.randState = cyrb128(seed[0]);
        state.garbageRandState = cyrb128(seed[1]);
    }

	static getTime(state) {
		return (Date.now() - state.startTime) / 1000;
	}

    constructor() {
        this.grid = new Array(200);

        this.randState = cyrb128(generateString(10));
        this.garbageRandState = cyrb128(generateString(10));

        this.bag = [];
        this.queue = [];
        this.piece = undefined;
        this.hold = undefined;
        this.held = false;
        this.ghostY = 0;

        this.acceptedGarbage = false;
        this.garbage = [];
        this.attack = 0;
        this.combo = 0;
        this.b2b = 0;

        this.DAStick = 0;
        this.ARRtick = 0;
        this.DASd = 0;
        this.softDropping = false;

		this.startTime = undefined;
		this.stats = {
			attacks: 0,
			pieces: 0,
		};

        this.over = false;
    }
}
