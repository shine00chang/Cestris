import * as k from "./config.mjs";
import { State, Piece } from "./state.mjs";

export default class Game {
    static state;
    static config;

    static #drawFromBag() {
        if (this.state.bag.length === 0) this.state.bag = [...k.PIECES];
        const index = Math.floor(
            State.rand(this.state.randState) * this.state.bag.length
        );
        return this.state.bag.splice(index, 1)[0];
    }

    static #checkConflict() {
        const p = this.state.piece;

        for (let y = 0; y < p.mapSize; y++)
            for (let x = 0; x < p.mapSize; x++)
                if (Piece.map(p, x, y) == 1) {
                    if (
                        p.x + x >= 10 ||
                        p.x + x < 0 ||
                        p.y + y >= 20 ||
                        p.y + y < 0
                    )
                        return false;
                    if (this.state.grid[(p.y + y) * 10 + p.x + x] != undefined)
                        return false;
                }
        return true;
    }

    static #removeClears() {
        // Check t-spin: 3-point rule
        let tspin = false;
        if (this.state.piece.type == "T" && this.state.piece.didSpin) {
            let cnt = 0;
            const p = this.state.piece;
            const occupy = (x, y) => {
                if (x < 0 || y < 0 || x >= 20 || y >= 10) return true;
                return this.state.grid[y * 20 + x] != undefined;
            };
            if (occupy(p.x, p.y)) cnt++;
            if (occupy(p.x, p.y + 2)) cnt++;
            if (occupy(p.x + 2, p.y)) cnt++;
            if (occupy(p.x + 2, p.y + 2)) cnt++;
            tspin = cnt >= 3;
        }

        let clears = 0;
        for (let y = 19; y >= 0; y--) {
            let clear = true;
            for (let x = 0; x < 10; x++) {
                if (this.state.grid[y * 10 + x] === undefined) clear = false;
                if (clears) {
                    this.state.grid[(y + clears) * 10 + x] =
                        this.state.grid[y * 10 + x];
                    this.state.grid[y * 10 + x] = undefined;
                }
            }
            if (clear) clears++;
        }
        let clear = "";
        if (tspin && clears != 0) clear = "tspin ";
        if (clears == 0) clear += "none";
        if (clears == 1) clear += "single";
        if (clears == 2) clear += "double";
        if (clears == 3) clear += "triple";
        if (clears == 4) clear += "tetris";
        return clear;
    }
    // Calculates the outgoing attack based on clear, b2b, combos and incomming garbage.
    static #calcAttack() {
        const clear = this.state.clear;

        if (clear == "none") {
            this.state.combo = 0;
            return;
        }
        this.state.combo++;
        if (k.B2B_CLEARS.includes(clear)) this.state.b2b++;
        else this.state.b2b = 0;
        let b2b_level = 0;
        while (this.b2b > k.B2B_LEVELS[b2b_level]) b2b_level++;

        let rawAttack =
            k.ATTACK_MAP[clear] +
            k.COMBO_TABLE[this.state.combo] +
            k.B2B_LEVELS[b2b_level];
        while (rawAttack != 0 && this.state.garbage.length != 0) {
            const d = Math.min(rawAttack, this.state.garbage[0]);
            this.state.garbage[0] -= d;
            rawAttack -= d;
            if (this.state.garbage[0] == 0) this.state.garbage.shift();
        }
        this.state.attack = rawAttack;
    }

    // Inserts rows of garbage.
    static #spawnGarbage() {
        const garbage = this.state.garbage;
        let sum = 0;

        // For each attack (since rows from the same attack has the same column)
        while (sum < k.GARBAGE_CAP && garbage.length > 0) {
            // Make sure rows doesn't exceed Garbage cap.
            this.state.acceptedGarbage = true;
            let spawn = garbage.shift();
            sum += spawn;
            if (sum > k.GARBAGE_CAP) {
                spawn -= sum - k.GARBAGE_CAP;
                garbage.unshift(sum - k.GARBAGE_CAP);
            }

            // Shift board up by 'spawn'
            for (let y = 0; y < 20 - spawn; y++)
                for (let x = 0; x < 10; x++)
                    this.state.grid[y * 10 + x] =
                        this.state.grid[(y + spawn) * 10 + x];

            // Generate random garbage hole column.
            let column = Math.floor(
                State.rand(this.state.garbageRandState) * 10
            );
            // Add Garbage rows
            for (let r = 0; r < spawn; r++)
                for (let x = 0; x < 10; x++)
                    this.state.grid[(19 - r) * 10 + x] =
                        x == column ? undefined : "garbage";
        }
    }

    // Moves piece if there is no conflict. Returns whether or not the move happened (for DAS system)
    static #movePiece(delta) {
        const p = this.state.piece;
        p.x += delta;
        if (!this.#checkConflict()) {
            p.x -= delta;
            return false;
        }

        // Remove 'didSpin' label.
        p.didSpin = false;
        return true;
    }

    // Finds first valid spin, checks for kicks.
    static #spinPiece(delta) {
        const p = this.state.piece;
        const prevR = p.r;
        p.r = (p.r + delta) % 4;
        if (p.r < 0) p.r = 3;

        // Generate trials
        const offset1 = k.KICK_TABLE[p.type == "I" ? 1 : 0][prevR];
        const offset2 = k.KICK_TABLE[p.type == "I" ? 1 : 0][p.r];

        let kicks = [];
        for (let i = 0; i < 5; i++) {
            kicks.push({
                x: offset1[i].x - offset2[i].x,
                y: offset1[i].y - offset2[i].y,
            });
        }
        for (let i = 0; i < 5; i++) {
            p.x += kicks[i].x;
            p.y -= kicks[i].y;
            if (this.#checkConflict()) {
                p.didSpin = true;
                return;
            }
            p.x -= kicks[i].x;
            p.y += kicks[i].y;
        }
        // If all trials fail, revert to original orientation.
        p.r = prevR;
    }

    // Adds drop tick to piece
    static #softDrop() {
        let p = this.state.piece;
        p.tick += this.config.SDF;
    }

    // Find lowest possible position of piece
    static #hardDrop() {
        let p = this.state.piece;

        while (this.#checkConflict()) p.y++;
        p.y--;
        // Inform 'tick()' to lock the piece.
		p.tick = k.TICK_LIMIT;
        p.lock_tick = k.LOCK_LIMIT;
    }

    // Writes piece to grid.
    static #lockPiece() {
        // Set didHold to false
        this.state.didHold = false;

        const p = this.state.piece;

        for (let y = 0; y < p.mapSize; y++)
            for (let x = 0; x < p.mapSize; x++)
                if (Piece.map(p, x, y) == 1)
                    this.state.grid[(p.y + y) * 10 + p.x + x] = p.type;
    }

    // Gets new piece, update queue
    static #nextPiece() {
        this.state.piece = new Piece(this.state.queue.shift());
        this.state.queue.push(this.#drawFromBag());
    }

    // Saving the current piece in hold state and drawing the next piece.
    static #holdPiece() {
        if (this.state.didHold) return;

        this.state.didHold = true;
        if (this.state.hold === undefined) {
            this.state.hold = this.state.piece.type;
            this.#nextPiece();
            return;
        }
        const temp = this.state.piece.type;
        this.state.piece = new Piece(this.state.hold);
        this.state.hold = temp;
    }
    static #getGhostPos() {
        const p = this.state.piece;
        const temp = p.y;
        do {
            p.y++;
        } while (this.#checkConflict());
        this.state.ghostY = p.y - 1;
        p.y = temp;
    }

    // Tick
    static #checkTicks(shouldSpawnGarbage = true) {
        const p = this.state.piece;

        // If tick is up, Lower piece.
        while (p.tick >= k.TICK_LIMIT) {
            p.y++;
			if (!this.#checkConflict()) {
				p.y--;
				p.lock_tick += k.LOCK_SPEED;
				// If lock
				if (p.lock_tick >= k.LOCK_LIMIT) {
					this.#lockPiece();
					this.state.clear = this.#removeClears();
					this.#calcAttack();

					// Spawn Garbage
					if (this.state.clear == "none" && shouldSpawnGarbage)
						this.#spawnGarbage();

					this.#nextPiece();
				}
				break;
			} else {
				p.tick -= k.TICK_LIMIT;
			}
		}
		// If conflict, lock & get new piece if lock limit.

        // Set ghost piece y-position
        this.#getGhostPos();
    }

    static #checkOver() {
        const p = this.state.piece;

        for (let y = 0; y < p.mapSize; y++)
            for (let x = 0; x < p.mapSize; x++)
                if (
                    Piece.map(p, x, y) == 1 &&
                    this.state.grid[(p.y + y) * 10 + p.x + x] !== undefined
                )
                    return true;
        return false;
    }

    static process(config, state, _inputs, shouldSpawnGarbage = true) {
		let inputs = [..._inputs];
        this.state = state;
        this.config = config;

        inputs.forEach( input => {
            const [key, type, tag] = input.split("-");
            if (tag == "future") console.log("processed future event");

            switch (key) {
                case "ArrowLeft":
                case "ArrowRight":
                    const d = key == "ArrowLeft" ? -1 : 1;
                    if (
                        type === "down" &&
                        (state.DAStick == 0 || state.DASd != d)
                    ) {
                        // If this is the first keydown, move once
                        this.#movePiece(d);

                        // Start DAS ticks, initialize ARR & direction
                        state.DAStick = 1;
                        state.ARRtick = 0;
                        state.DASd = d;

                        // If keyup, stop DAS
                    }
                    if (type === "up") state.DAStick = 0;
                    break;
                case "ArrowDown":
					// If first Softdrop-down input, add tick & process
					if (inputs.includes("ArrowDown-down") && inputs.includes("ArrowDown-up")) 
						console.log("bot softdrop", state.piece.r);
					if (type === 'down' && state.softDropping === false) {
						this.#softDrop();
						this.#checkTicks();				
					}
					state.softDropping = type === 'down';

                    break;
                case "ArrowUp":
                case "z":
                case "a":
                    if (type === "down")
                        this.#spinPiece(key == "z" ? -1 : key == "a" ? 2 : 1);
                    break;
                case "c":
                    if (type == "down") this.#holdPiece();
                    break;
                case " ":
                    if (type === "down") this.#hardDrop();
                    break;
            }
        });
		// Softdrop Persistence 
        if (state.softDropping && inputs.includes("ArrowDown-down") === false) this.#softDrop();

		// DAS
        if (state.DAStick) 
            state.DAStick++;
        if (state.DAStick >= this.config.DAS) {
            // Instant Auto shift to edge.
            if (this.config.ARR == 0) {
                while (this.#movePiece(state.DASd));
            } else {
                state.ARRtick++;
                const v = Math.floor(state.ARRtick / this.config.ARR);
                for (let i = 0; i < v; i++) this.#movePiece(state.DASd);
                state.ARRtick -= v * this.config.ARR;
            }
        }

		// Gravity
		state.piece.tick += k.GRAVITY_SPEED;
        this.#checkTicks(shouldSpawnGarbage);

        // Check if game over (piece has conflict w/ board), if over, lock piece, signal driver to stop.
        state.over = this.#checkOver();
        if (state.over) this.#lockPiece();
    }

    static initialize(state) {
        this.state = state;
        for (let i = 0; i < 5; i++) this.state.queue.push(this.#drawFromBag());
    }

    static start(state) {
        this.state = state;
        this.#nextPiece();
    }
}
