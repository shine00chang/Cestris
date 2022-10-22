import * as k from './config.mjs';

export default class GameElement {
    constructor (parent) {
        this.box = document.createElement('div');
        this.canvas = document.createElement('canvas');
        this.canvas.className = 'game-board';
        this.canvas.width = 200;
        this.canvas.height = 400;
        
        this.box.appendChild(this.canvas);
        parent.appendChild(this.box);
    }
    destruct () {
        this.box.remove();
    }
    renderFrom (state) {
        const ctx = this.canvas.getContext("2d");

        // Reset 
        ctx.fillStyle = 'rgb(0,0,0)';
        ctx.fillRect(0, 0, 10 * k.SIZE, 20 * k.SIZE);

        ctx.fillStyle = 'rgb(200, 200, 200)';
        // Draw piece 
        if (state.piece !== undefined) {
            const p = state.piece;
            const len = Math.sqrt(k.PIECE_MAPS[p.type][p.r].length);
            for (let y=0; y<len; y++) 
                for (let x=0; x<len; x++) 
                    if (k.PIECE_MAPS[p.type][p.r][y * len + x] == 1) {
                        ctx.fillStyle = k.PIECE_COLOR[p.type];
                        ctx.fillRect((p.x + x) * k.SIZE, (p.y + y) * k.SIZE, k.SIZE, k.SIZE);
                    }
        }
        // Draw grid tiles
        for (let y=0; y<20; y++) {
            for (let x=0; x<10; x++) {
                if (state.grid[y * 10 + x]) {
                    ctx.fillStyle = k.PIECE_COLOR[state.grid[y * 10 + x]];
                    ctx.fillRect(x * k.SIZE, y * k.SIZE, k.SIZE, k.SIZE);
                }
            }
        }
        
        // Draw Hold
        // TODO;
        // Draw Previews 
        // TODO;
    }
    renderOver (state) {
        const ctx = this.canvas.getContext("2d");

        // Reset 
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, 10 * k.SIZE, 20 * k.SIZE);

        ctx.fillStyle = k.PIECE_COLOR['garbage'];
        // If the game is over, there will be no piece. 
        // Draw grid tiles
        for (let y=0; y<20; y++) 
            for (let x=0; x<10; x++) 
                if (state.grid[y * 10 + x]) 
                    ctx.fillRect(x * k.SIZE, y * k.SIZE, k.SIZE, k.SIZE);
    }
}