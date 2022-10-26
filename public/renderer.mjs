import * as k from './config.mjs';
import { Piece } from './state.mjs';

export default class GameElement {
    constructor (parent) {
        this.box = document.createElement('div');
        this.canvas = document.createElement('canvas');
        this.canvas.className = 'game-board';
        this.canvas.width = 400;
        this.canvas.height = 400;
        
        this.box.appendChild(this.canvas);
        parent.appendChild(this.box);
    }
    destruct () {
        this.box.remove();
    }
    renderFrom (state) {
        const over = state.over;
        const ctx = this.canvas.getContext("2d");

        // Reset 
        ctx.fillStyle = 'rgb(0,0,0)';
        ctx.fillRect(0, 0, 400, 400);
        

        const cx = 70;
        const cy = 0;
        // Draw Grid 
        ctx.strokeStyle = '#666';
        ctx.lineWidth = 1;
        for (let y=0; y<=20; y++) {
            ctx.beginPath();
            ctx.moveTo(cx, cy + y * k.SIZE); 
            ctx.lineTo(cx + 10 * k.SIZE, cy + y * k.SIZE); 
            ctx.stroke(); 
            //ctx.closePath();
        }
        for (let x=0; x<=10; x++) {
            ctx.beginPath();
            ctx.moveTo(cx + x * k.SIZE, cy); 
            ctx.lineTo(cx + x * k.SIZE, cy + 20 * k.SIZE); 
            ctx.stroke(); 
        }

        // Draw piece 
        if (state.piece !== undefined) {
            const p = state.piece;
            const len = Math.sqrt(k.PIECE_MAPS[p.type][p.r].length);
            
            for (let y=0; y<len; y++) 
                for (let x=0; x<len; x++) 
                    if (k.PIECE_MAPS[p.type][p.r][y * len + x] == 1) {
                        if (!over) ctx.fillStyle = k.PIECE_COLOR[p.type];
                        else ctx.fillStyle = k.PIECE_COLOR['garbage'];
                        ctx.fillRect(cx + (p.x + x) * k.SIZE, cy + (p.y + y) * k.SIZE, k.SIZE, k.SIZE);
                    }
        }
        // Draw grid tiles
        for (let y=0; y<20; y++) {
            for (let x=0; x<10; x++) {
                if (state.grid[y * 10 + x]) {
                    if (!over) ctx.fillStyle = k.PIECE_COLOR[state.grid[y * 10 + x]];
                    else ctx.fillStyle = k.PIECE_COLOR['garbage'];
                    ctx.fillRect(cx + x * k.SIZE, cy + y * k.SIZE, k.SIZE, k.SIZE);
                }
            }
        }
        
        // Draw Hold
        if (state.hold !== undefined) {
            const p = state.hold;
            const len = Math.sqrt(k.PIECE_MAPS[p.type][p.r].length);
            const cx = 10;
            const cy = 10;
            const s = 15;
            for (let y = 0; y<len; y++) 
                for (let x = 0; x<len; x++) 
                    if (k.PIECE_MAPS[p.type][p.r][y * len + x] == 1) {
                        ctx.fillStyle = k.PIECE_COLOR[p.type];
                        ctx.fillRect(cx + x * s, cy + y * s, s, s);
                    }
        }

        // Draw Previews 
        for (let i=0; i<5; i++) {
            const p = new Piece(state.queue[i]);
            const len = Math.sqrt(k.PIECE_MAPS[p.type][p.r].length);
            const cx = 300;
            const cy = 10 + 50 * i;
            const s = 15;
            for (let y = p.type == 'I' ? 1 : 0; y<len; y++) 
                for (let x = p.type == 'I' ? 1 : 0; x<len; x++) 
                    if (k.PIECE_MAPS[p.type][p.r][y * len + x] == 1) {
                        ctx.fillStyle = k.PIECE_COLOR[p.type];
                        ctx.fillRect(cx + x * s, cy + y * s, s, s);
                    }
        }    
    }
}