import Game from './game.mjs';
import { State } from './state.mjs';
import Renderer from './renderer.mjs';

import { FRAME_RATE } from './config.mjs';

export default class LocalDriver {
    constructor (parent) {
        this.over = false;
        this.frameIndex = 0;

        this.inputs = [];
        
        this.state = new State();

        this.keys = {};
        this.configs = {};
    
        this.renderer = new Renderer(parent);
    }

    destruct = () => {
        // Stop loop
        this.over = true;

        // Destroy HTML element
        this.renderer.destruct();

        // Stop listeners 
        document.removeEventListener('keyup', this.handleKeyDown);
        document.removeEventListener('keydown', this.handleKeyUp);
    }

    start = () => {
        // Initialize    
        Game.initialize(this.state);
        Game.start(this.state);

        // Start listeners
        document.addEventListener('keydown', this.handleKeyDown);
        document.addEventListener('keyup', this.handleKeyUp);
        
        // Start ticks
        this.onFrame();
    }




    handleKeyDown = (e) => {
        e.preventDefault();
        if (!this.keys[e.key]) 
            this.publishEvent(e.key + '-down');
        this.keys[e.key] = true;
    }
    handleKeyUp = (e) => {
        e.preventDefault();
        if (this.keys[e.key]) 
            this.publishEvent(e.key + '-up');
        this.keys[e.key] = false;
    }



    publishEvent = (e) => {
        this.inputs.push(e);
    }
    onFrame = () => {        
        Game.process(this.state, this.inputs);
        this.renderer.renderFrom(this.state);

        this.inputs = [];
        this.frameIndex ++;
        
        if (!this.over && !this.state.over) {
            setTimeout(this.onFrame, 1000 / FRAME_RATE);
        }
    }
}