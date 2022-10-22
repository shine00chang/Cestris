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
        return clears;
    }
    
    // Inserts rows of garbage.
    static #spawnGarbage () {
        let rowsSpawned = 0;

        // For each attack (since rows from the same attack has the same column)
        for (let i=0; i<this.state.garbage.length; i++) {
            // Make sure rows doesn't exceed Garbage cap.
            let spawn = Math.max(this.state.garbage[i], this.state.garbage[i] - (k.GARBAGE_CAP - rowsSpawned));
            // Shift board up by 'spawn'
            for (let y=0; y<20 - spawn; y++) 
                for (let x=0; x<10; x++) 
                    this.state.grid[y * 10 + x] = this.state.grid[(y+spawn) * 10 + x];

            // Generate random garbage hole column.
            let column = Math.floor(State.rand(this.state.randState) * 10);
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
        let p = this.state.piece;
        const prevR = p.r;
        p.r = (p.r + delta) % 4;
        if (p.r < 0) p.r = 3;

        if (!this.#checkConflict())
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
    
    // Tick
    static #tick () {
        let p = this.state.piece;
        p.tick += k.GRAVITY_SPEED; 

        // If tick is up, Lower piece.
        if (p.tick > k.TICK_LIMIT) {
            p.y ++;

            // If conflict, lock & get new piece if lock limit.
            if (!this.#checkConflict()) {
                p.y --;

                // If lock
                if (p.tick > k.LOCK_LIMIT) {
                    this.#lockPiece();
                    this.#removeClears();

                    // Spawn Garbage
                    this.#spawnGarbage();

                    this.#nextPiece();
                }
            } else {
                p.tick = 0;
            }
        }
    }

    static #checkOver () {
        const p = this.state.piece;

        for (let y=0; y<p.mapSize; y++) 
            for (let x=0; x<p.mapSize; x++) 
                if (Piece.map(p, x, y) == 1 && this.state.grid[(p.y + y) * 10 + p.x + x] !== undefined) 
                    return true;
        return false;
    }
    
    static process( state, inputs ) {
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
        this.#tick();
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