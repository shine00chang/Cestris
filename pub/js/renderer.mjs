import * as k from "./config.mjs";
import { State } from "./state.mjs";

const WIDTH = 440;
const HEIGHT = 480;
const GRID_X = 100;
const GRID_Y = 20;
const PREVIEW_X = 340;
const PREVIEW_S = 15;
const HOLD_X = 40;
const HOLD_Y = 100;
const HOLD_S = 15;
const INDICATOR_X = 20;
const INDICATOR_Y = 200;
const STATS_X = 20;
const STATS_Y = 300;

export default class Renderer {
    constructor(parent) {
        this.box = document.createElement("div");
        this.box.className = "game-box";
        this.canvas = document.createElement("canvas");
        this.canvas.className = "game-board";
        this.canvas.width = WIDTH;
        this.canvas.height = HEIGHT;

        this.box.appendChild(this.canvas);
        parent.appendChild(this.box);
    }
    destruct() {
        this.box.remove();
    }
	
	renderGrid(ctx, state) {
        const cx = GRID_X;
        const cy = GRID_Y;

        // Draw Grid
        ctx.strokeStyle = "#666";
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let y = 0; y <= 20; y++) {
            ctx.moveTo(cx, cy + y * k.SIZE);
            ctx.lineTo(cx + 10 * k.SIZE, cy + y * k.SIZE);
            ctx.stroke();
        }
        for (let x = 0; x <= 10; x++) {
            ctx.moveTo(cx + x * k.SIZE, cy);
            ctx.lineTo(cx + x * k.SIZE, cy + 20 * k.SIZE);
            ctx.stroke();
        }
        ctx.closePath();

		// Draw grid tiles
        for (let y = 0; y < 20; y++) 
            for (let x = 0; x < 10; x++) 
                if (state.grid[y * 10 + x]) {
                    ctx.fillStyle = state.over? k.PIECE_COLOR["garbage"] : k.PIECE_COLOR[state.grid[y * 10 + x]];
                    ctx.fillRect(
                        cx + x * k.SIZE,
                        cy + y * k.SIZE,
                        k.SIZE,
                        k.SIZE
                    );
                }
	}

	renderPiece(ctx, state) {
        if (state.piece == undefined) return;
		const p = state.piece;
		const len = Math.sqrt(k.PIECE_MAPS[p.type][p.r].length);

		for (let y = 0; y < len; y++)
			for (let x = 0; x < len; x++)
				if (k.PIECE_MAPS[p.type][p.r][y * len + x] == 1) {
					ctx.fillStyle = state.over ? k.PIECE_COLOR["garbage"] : k.PIECE_COLOR[p.type];
					ctx.fillRect(
						GRID_X + (p.x + x) * k.SIZE,
						GRID_Y + (p.y + y) * k.SIZE,
						k.SIZE,
						k.SIZE
					);
				}
	}

	renderGhost(ctx, state) {
        if (state.piece == undefined || state.over) return;
		ctx.globalAlpha = 0.75;
		const p = state.piece;
		const gy = state.ghostY;
		const len = Math.sqrt(k.PIECE_MAPS[p.type][p.r].length);

		for (let y = 0; y < len; y++)
			for (let x = 0; x < len; x++)
				if (k.PIECE_MAPS[p.type][p.r][y * len + x] == 1) {
					ctx.fillStyle = k.PIECE_COLOR[p.type];
					ctx.fillRect(
						GRID_X + (p.x + x) * k.SIZE,
						GRID_Y + (gy + y) * k.SIZE,
						k.SIZE,
						k.SIZE
					);
				}
		ctx.globalAlpha = 1;
	}

	renderPreviews(ctx, state) {
        // Draw Previews
        const s = PREVIEW_S;

        for (let i = 0; i < 5; i++) {
            const p = state.queue[i];
            const len = Math.sqrt(k.PIECE_MAPS[p][p == "I" ? 2 : 0].length);
         	const cy = GRID_Y + 50 * i;   
            for (let y = 0; y < len; y++)
                for (let x = 0; x < len; x++)
                    if (k.PIECE_MAPS[p][p == "I" ? 2 : 0][y * len + x] == 1) {
                        ctx.fillStyle = k.PIECE_COLOR[p];
                        ctx.fillRect(PREVIEW_X + x * s, cy + y * s, s, s);
                    }
        }
	}

	renderHold(ctx, state) {
        if (state.hold == undefined) return; 
		const p = state.hold;
		const len = Math.sqrt(k.PIECE_MAPS[p][p == "I" ? 2 : 0].length);
		const s = HOLD_S;
		for (let y = 0; y < len; y++)
			for (let x = 0; x < len; x++)
				if (k.PIECE_MAPS[p][p == "I" ? 2 : 0][y * len + x] == 1) {
					ctx.fillStyle = k.PIECE_COLOR[p];
					ctx.fillRect(HOLD_X + x * s, HOLD_Y + y * s, s, s);
				}
	}

	renderIndicators(ctx, state) {
        // Draw Garbage Indicator
        let garbage = 0;
        state.garbage.forEach((val) => (garbage += val));
        garbage = Math.min(garbage, 20);
        ctx.fillStyle = "#f00";
        ctx.fillRect(GRID_X - 4, GRID_Y + (20 - garbage) * k.SIZE, 4, garbage * k.SIZE);

        // Draw Combo Indicator
        if (state.combo > 1) {
            ctx.font = "14px serif";
            ctx.fillText(`Combo x${state.combo}`, INDICATOR_X, INDICATOR_Y);
        }
        // Draw B2B Indicator
        if (state.b2b > 1) {
            ctx.font = "20px serif";
            ctx.fillText(`B2B x${state.b2b}`, INDICATOR_X, INDICATOR_Y + 50);
        }
	}
	
	renderStats(ctx, state) {
		const s = state.stats; 

		// attacks, apm 
		ctx.font = "20px serif";
		let apm = s.attacks / State.getTime(state) * 60;
		apm = Math.floor( apm * 100 ) / 100; 
		ctx.fillText(`${s.attacks}  ${apm}`, STATS_X, STATS_Y);

		// pieces, pps
		ctx.font = "20px serif";
		let pps = s.pieces / State.getTime(state);
		pps = Math.floor( pps * 100 ) / 100; 
		ctx.fillText(`${s.pieces}  ${pps}`, STATS_X, STATS_Y + 40);
	}

    renderFrom(state) {
        const ctx = this.canvas.getContext("2d");

        // Reset
        ctx.fillStyle = "#222";
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

		this.renderGrid(ctx, state);
		this.renderGhost(ctx, state);
		this.renderPiece(ctx, state);
        this.renderPreviews(ctx, state);
		this.renderHold(ctx, state);
		this.renderIndicators(ctx, state);
		this.renderStats(ctx, state);
    }

    renderCountDown(state, countdown) {
        const ctx = this.canvas.getContext("2d");

        // Reset
        ctx.fillStyle = "#222";
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

		this.renderGrid(ctx, state);
		this.renderPreviews(ctx, state);

        // Draw Countdown tick
        ctx.fillStyle = "rgb(240,240,60)";
        ctx.font = "50px serif";
        ctx.fillText(
            `${countdown}`,
            GRID_X + 5 * k.SIZE - 20,
            GRID_Y + 10 * k.SIZE - 20
        );
    }

    renderWaitScreen() {
        const ctx = this.canvas.getContext("2d");

        // Reset
        ctx.fillStyle = "#222";
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        ctx.fillStyle = "rgb(200,200,0)";
        ctx.font = "20px serif";
        ctx.fillText(
            `Waiting...`,
            this.canvas.width / 2 - 70,
            this.canvas.height / 2 - 10
        );
    }
}
