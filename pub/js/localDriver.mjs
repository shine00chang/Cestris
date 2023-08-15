import Game from "./game.mjs";
import { State } from "./state.mjs";
import Renderer from "./renderer.mjs";

import { FRAME_RATE } from "./config.mjs";

export default class LocalDriver {
    constructor(parent, config) {
        this.over = false;
        this.frameIndex = 0;

        this.inputs = [];

        this.state = new State();

        this.keys = {};
        this.config = config;

        this.parent = parent;
        this.renderer = new Renderer(this.parent);
        this.renderer.box.tabIndex = "0";
        this.renderer.box.focus();
    }

	stop () {
		this.over = true;
	}

    destruct () {
        // Stop loop
       	this.stop(); 

        this.parent.replaceChildren();

        // Stop listeners
        this.renderer.box.removeEventListener("keyup", this.handleKeyDown);
        this.renderer.box.removeEventListener("keydown", this.handleKeyUp);
    };

    start () {
        // Initialize
        Game.initialize(this.state);

        // Lambda to run at the end of countdown
        const onStart = () => {
            Game.start(this.state);

            // Start listeners
            this.renderer.box.addEventListener("keydown", this.handleKeyDown);
            this.renderer.box.addEventListener("keyup", this.handleKeyUp);
            this.onFrame();
        };

        // Start countdown, set to T-3.
        let countdown = 3;
        const onCountdown = () => {
            this.renderer.renderCountDown(this.state, countdown--);

            if (countdown < 0) {
                onStart();
            } else {
                setTimeout(onCountdown, 1000);
            }
        };
        onCountdown();
    };

    handleKeyDown = (e) => {
        e.preventDefault();
        if (!this.keys[e.key]) this.publishEvent(e.key + "-down");
        this.keys[e.key] = true;
    };
    handleKeyUp = (e) => {
        e.preventDefault();
        if (this.keys[e.key]) this.publishEvent(e.key + "-up");
        this.keys[e.key] = false;
    };

    publishEvent = (e) => {
        this.inputs.push(e);
    };
    onFrame = () => {
        Game.process(this.config, this.state, this.inputs);
        this.renderer.renderFrom(this.state);

        this.inputs = [];
        this.frameIndex++;

        if (!this.over && !this.state.over) {
            setTimeout(this.onFrame, 1000 / FRAME_RATE);
        }
    };
}
