import * as k from "./config.mjs";

export default class GameElement {
    constructor(parent) {
        this.box = document.createElement("div");
        this.box.className = "game-box";
        this.canvas = document.createElement("canvas");
        this.canvas.className = "game-board";
        this.canvas.width = 400;
        this.canvas.height = 500;

        this.box.appendChild(this.canvas);
        parent.appendChild(this.box);
    }
    destruct() {
        this.box.remove();
    }
    renderFrom(state) {
        const over = state.over;
        const ctx = this.canvas.getContext("2d");

        // Reset
        ctx.fillStyle = "#eee";
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        const cx = 80;
        const cy = 50;
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

        // Draw piece
        if (state.piece !== undefined) {
            const p = state.piece;
            const len = Math.sqrt(k.PIECE_MAPS[p.type][p.r].length);

            for (let y = 0; y < len; y++)
                for (let x = 0; x < len; x++)
                    if (k.PIECE_MAPS[p.type][p.r][y * len + x] == 1) {
                        if (!over) ctx.fillStyle = k.PIECE_COLOR[p.type];
                        else ctx.fillStyle = k.PIECE_COLOR["garbage"];
                        ctx.fillRect(
                            cx + (p.x + x) * k.SIZE,
                            cy + (p.y + y) * k.SIZE,
                            k.SIZE,
                            k.SIZE
                        );
                    }
        }

        // Draw ghost
        if (state.piece !== undefined && !over) {
            ctx.globalAlpha = 0.75;
            const p = state.piece;
            const gy = state.ghostY;
            const len = Math.sqrt(k.PIECE_MAPS[p.type][p.r].length);

            for (let y = 0; y < len; y++)
                for (let x = 0; x < len; x++)
                    if (k.PIECE_MAPS[p.type][p.r][y * len + x] == 1) {
                        ctx.fillStyle = k.PIECE_COLOR[p.type];
                        ctx.fillRect(
                            cx + (p.x + x) * k.SIZE,
                            cy + (gy + y) * k.SIZE,
                            k.SIZE,
                            k.SIZE
                        );
                    }
            ctx.globalAlpha = 1;
        }
        // Draw grid tiles
        for (let y = 0; y < 20; y++) {
            for (let x = 0; x < 10; x++) {
                if (state.grid[y * 10 + x]) {
                    if (!over)
                        ctx.fillStyle = k.PIECE_COLOR[state.grid[y * 10 + x]];
                    else ctx.fillStyle = k.PIECE_COLOR["garbage"];
                    ctx.fillRect(
                        cx + x * k.SIZE,
                        cy + y * k.SIZE,
                        k.SIZE,
                        k.SIZE
                    );
                }
            }
        }

        // Draw Hold
        if (state.hold !== undefined) {
            const p = state.hold;
            const len = Math.sqrt(k.PIECE_MAPS[p][p == "I" ? 2 : 0].length);
            const cx = 10;
            const cy = 60;
            const s = 15;
            for (let y = 0; y < len; y++)
                for (let x = 0; x < len; x++)
                    if (k.PIECE_MAPS[p][p == "I" ? 2 : 0][y * len + x] == 1) {
                        ctx.fillStyle = k.PIECE_COLOR[p];
                        ctx.fillRect(cx + x * s, cy + y * s, s, s);
                    }
        }

        // Draw Previews
        for (let i = 0; i < 5; i++) {
            const p = state.queue[i];
            const len = Math.sqrt(k.PIECE_MAPS[p][p == "I" ? 2 : 0].length);
            const cx = 300;
            const cy = 60 + 50 * i;
            const s = 15;
            for (let y = 0; y < len; y++)
                for (let x = 0; x < len; x++)
                    if (k.PIECE_MAPS[p][p == "I" ? 2 : 0][y * len + x] == 1) {
                        ctx.fillStyle = k.PIECE_COLOR[p];
                        ctx.fillRect(cx + x * s, cy + y * s, s, s);
                    }
        }
        // Draw Garbage Indicator
        let garbage = 0;
        state.garbage.forEach((val) => (garbage += val));
        garbage = Math.min(garbage, 20);
        ctx.fillStyle = "#f00";
        ctx.fillRect(cx - 4, (20 - garbage) * k.SIZE, 4, garbage * k.SIZE);

        // Draw Combo Indicator
        if (state.combo > 1) {
            ctx.font = "14px serif";
            ctx.fillText(`Combo x${state.combo}`, 10, 120);
        }
        // Draw B2B Indicator
        if (state.b2b > 1) {
            ctx.font = "20px serif";
            ctx.fillText(`B2B x${state.b2b}`, 10, 180);
        }
    }
    renderCountDown(state, countdown) {
        const over = state.over;
        const ctx = this.canvas.getContext("2d");

        // Reset
        ctx.fillStyle = "#eee";
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        const cx = 80;
        const cy = 50;
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

        // Draw Previews
        for (let i = 0; i < 5; i++) {
            const p = state.queue[i];
            const len = Math.sqrt(k.PIECE_MAPS[p][p == "I" ? 2 : 0].length);
            const cx = 300;
            const cy = 60 + 50 * i;
            const s = 15;
            for (let y = 0; y < len; y++)
                for (let x = 0; x < len; x++)
                    if (k.PIECE_MAPS[p][p == "I" ? 2 : 0][y * len + x] == 1) {
                        ctx.fillStyle = k.PIECE_COLOR[p];
                        ctx.fillRect(cx + x * s, cy + y * s, s, s);
                    }
        }

        // Draw Countdown tick
        ctx.fillStyle = "rgb(240,240,60)";
        ctx.font = "50px serif";
        ctx.fillText(
            `${countdown}`,
            cx + 5 * k.SIZE - 20,
            cy + 10 * k.SIZE - 20
        );
    }
    renderWaitScreen() {
        const ctx = this.canvas.getContext("2d");

        // Reset
        ctx.fillStyle = "#eee";
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
