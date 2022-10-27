import * as k from './config.mjs';
import { State, Piece } from './state.mjs';

export default class Game {
    static state; 
    
    static #drawFromBag () {
        if (this.state.bag.length === 0) 
            this.state.bag = [...k.PIECES];
        const index = Math.floor( State.rand(this.state.randState) * this.state.bag.length );
        return this.state.bag.splice(index, 1)[0];
    }

    static #checkConflict () {
        const p = this.state.piece;

        for (let y=0; y<p.mapSize; y++) 
            for (let x=0; x<p.mapSize; x++) 
                if (Piece.map(p, x, y) == 1) {
                    if (p.x + x >= 10 || p.x + x < 0 || p.y + y >= 20 || p.y + y < 0) return false;
                    if (this.state.grid[(p.y + y) * 10 + p.x + x] != undefined) return false;
                } 
        return true;
    }

    static #removeClears () {
        let clears = 0;
        for (let y=19; y>=0; y--) {
            let clear = true;
            for (let x=0; x<10; x++) {
                if (this.state.grid[y * 10 + x] === undefined)
                    clear = false;
                if (clears) {
                    this.state.grid[(y+clears) * 10 + x] = this.state.grid[y * 10 + x];
                    this.state.grid[y * 10 + x] = undefined;
                }
            }
            if (clear)
                clears ++;
        }
        let clear = 'none';
        if (clears == 1) clear = 'single';
        if (clears == 2) clear = 'double';
        if (clears == 3) clear = 'triple';
        if (clears == 4) clear = 'tetris'; 
        return clear;
    }
    // Calculates the outgoing attack based on clear, b2b, combos and incomming garbage.
    static #calcAttack () {
        if (this.state.clear == 'none') return;

        let rawAttack = k.ATTACK_MAP[this.state.clear];
        while (rawAttack != 0 && this.state.garbage.length != 0) {
            const d = Math.min( rawAttack, this.state.garbage[0] );
            this.state.garbage[0] -= d;
            rawAttack -= d;
            if (this.state.garbage[0] == 0) this.state.garbage.shift();
        }
        this.state.attack = rawAttack;
    }

    // Inserts rows of garbage.
    static #spawnGarbage () {
        let rowsSpawned = 0;

        // For each attack (since rows from the same attack has the same column)
        for (let i=0; i<this.state.garbage.length; i++) {
            // Make sure rows doesn't exceed Garbage cap.
            this.state.acceptedGarbage = true;
            let spawn = Math.max(this.state.garbage[i], this.state.garbage[i] - (k.GARBAGE_CAP - rowsSpawned));
            // Shift board up by 'spawn'
            for (let y=0; y<20 - spawn; y++) 
                for (let x=0; x<10; x++) 
                    this.state.grid[y * 10 + x] = this.state.grid[(y+spawn) * 10 + x];

            // Generate random garbage hole column.
            let column = Math.floor(State.rand(this.state.garbageRandState) * 10);
            // Add Garbage rows
            for (let r=0; r<spawn; r++) 
                for (let x=0; x<10; x++) 
                    this.state.grid[(19 - r) * 10 + x] = x == column ? undefined : 'garbage';

            rowsSpawned += spawn;
            this.state.garbage[i] -= spawn;
        };
        // Remove processed attacks.
        this.state.garbage.filter(row => row != 0);
    }

    // Moves piece if there is no conflict. Returns whether or not the move happened (for DAS system)
    static #movePiece (delta) {
        let p = this.state.piece;
        p.x += delta;
        if (!this.#checkConflict()) {
            p.x -= delta;
            return false;
        }
        return true;
    }

    // Finds first valid spin, checks for kicks.
    static #spinPiece (delta) {
        const p = this.state.piece;
        const prevR = p.r;
        p.r = (p.r + delta) % 4;
        if (p.r < 0) p.r = 3;

        // Generate trials
        const offset1 = k.KICK_TABLE[p.type == "I" ? 1 : 0][prevR];
        const offset2 = k.KICK_TABLE[p.type == "I" ? 1 : 0][p.r];
        
        let kicks = [];
        for (let i=0; i<5; i++) {
            kicks.push({
                x: offset1[i].x - offset2[i].x,
                y: offset1[i].y - offset2[i].y
            });
        }
        for (let i=0; i<5; i++) {
            p.x += kicks[i].x;
            p.y -= kicks[i].y;
            if (this.#checkConflict())
                return;
            p.x -= kicks[i].x;
            p.y += kicks[i].y;
        }
        // If all trials fail, revert to original orientation.
        p.r = prevR;
    }

    // Adds drop tick to piece
    static #softDrop () {
        let p = this.state.piece;
        p.tick += k.SOFT_DROP_SPEED;
    }
    
    // Find lowest possible position of piece
    static #hardDrop () {
        let p = this.state.piece;

        while (this.#checkConflict()) p.y ++; 
        p.y --;
        // Inform 'tick()' to lock the piece.
        p.tick = k.LOCK_LIMIT;
    }
    
    // Writes piece to grid.
    static #lockPiece () {
        // Set didHold to false
        this.state.didHold = false;

        const p = this.state.piece;

        for (let y=0; y<p.mapSize; y++) 
            for (let x=0; x<p.mapSize; x++) 
                if (Piece.map(p, x, y) == 1)
                    this.state.grid[(p.y + y) * 10 + p.x + x] = p.type;
    }
    
    // Gets new piece, update queue
    static #nextPiece () {
        this.state.piece = new Piece(this.state.queue.shift());
        this.state.queue.push( this.#drawFromBag() );
    }
    
    // Saving the current piece in hold state and drawing the next piece. 
    static #holdPiece () {
        if (this.state.didHold) return;
        
        this.state.didHold = true;
        if (this.state.hold === undefined) {
            this.state.hold = this.state.piece.type;
            this.#nextPiece();
            return;
        }
        const temp = this.state.piece.type;
        this.state.piece = new Piece(this.state.hold)
        this.state.hold = temp;
    }
    static #getGhostPos () {
        const p = this.state.piece;
        const temp = p.y;
        do {
            p.y ++;
        } while (this.#checkConflict());
        this.state.ghostY = p.y - 1;
        p.y = temp;
    }

    // Tick
    static #tick (shouldSpawnGarbage = true) {
        const p = this.state.piece;
        p.tick += k.GRAVITY_SPEED; 

        // If tick is up, Lower piece.
        if (p.tick >= k.TICK_LIMIT) {
            p.y ++;

            // If conflict, lock & get new piece if lock limit.
            if (!this.#checkConflict()) {
                p.y --;

                // If lock
                if (p.tick >= k.LOCK_LIMIT) {
                    this.#lockPiece();
                    this.state.clear = this.#removeClears();
                    this.#calcAttack();

                    // Spawn Garbage
                    if(shouldSpawnGarbage) this.#spawnGarbage();

                    this.#nextPiece();
                }
            } else {
                p.tick = 0;
            }
        }
        // Set ghost piece y-position 
        this.#getGhostPos();
    }

    static #checkOver () {
        const p = this.state.piece;

        for (let y=0; y<p.mapSize; y++) 
            for (let x=0; x<p.mapSize; x++) 
                if (Piece.map(p, x, y) == 1 && this.state.grid[(p.y + y) * 10 + p.x + x] !== undefined) 
                    return true;
        return false;
    }
    
    static process( state, inputs, shouldSpawnGarbage = true ) {
        this.state = state;

        inputs.forEach( input => {
            const [key, type] = input.split('-');

            switch (key) {
                case 'ArrowLeft':
                case 'ArrowRight':
                    const d = key == 'ArrowLeft' ? -1 : 1
                    if (type === 'down' && state.DAStick == 0) {
                        // If this is the first keydown, move once
                        this.#movePiece(d);

                        // Start DAS ticks, initialize ARR & direction
                        state.DAStick = 1;
                        state.ARRtick = 0;
                        state.DASd = d;
                    
                    // If keyup, stop DAS
                    } if (type === 'up') 
                        state.DAStick = 0;
                    break;
                case 'ArrowDown':
                    state.softDropping = type == "down";
                    break;
                case 'ArrowUp':
                case 'z':
                    if (type === 'down') this.#spinPiece(key == 'z' ? -1 : 1);
                    break;
                case 'c':
                    if (type == 'down') this.#holdPiece();
                    break;
                case ' ':
                    if (type === 'down') this.#hardDrop();
                    break;
            }
        });
        if (state.softDropping) this.#softDrop();
        if (state.DAStick) {
            state.DAStick ++;
        }
        if (state.DAStick >= k.DAS_LIMIT) {
            // Instant Auto shift to edge.
            if (k.ARR_LIMIT == 0) {
                while (this.#movePiece(state.DASd));
            } else {
                state.ARRtick ++;
                if (state.ARRtick >= k.ARR_LIMIT) {
                    this.#movePiece(state.DASd);
                    state.ARRtick = 0;
                }
            }
        }
        this.#tick(shouldSpawnGarbage);
        // Check if game over (piece has conflict w/ board), if over, lock piece, signal driver to stop.
        state.over = this.#checkOver();
        if (state.over) 
            this.#lockPiece();
    }

    static initialize (state) {
        this.state = state;
        for (let i=0; i<5; i++) 
            this.state.queue.push( this.#drawFromBag() ); 
    }

    static start (state) {
        this.state = state;
        this.#nextPiece();
    } 
}