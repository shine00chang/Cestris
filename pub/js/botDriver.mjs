import Game from "./game.mjs";
import LocalDriver from "./localDriver.mjs";
import { State } from "./state.mjs";
import Renderer from "./renderer.mjs";
import { FRAME_RATE } from "./config.mjs";

export function BotConfigs (pps) {
	this.delay = 1 / pps;
}

export default class BotDriver extends LocalDriver {
	constructor (parent, botParent, config, botConfigs) { 
		// Parameter checking
		if (!(botConfigs instanceof BotConfigs)) {
			console.error("Invalid bot configuration on game start, defaulting.");
			botConfigs = new BotConfigs();
		}

		super(parent, config);

        this.botParent = botParent;
		this.botRenderer = new Renderer(this.botParent);

		this.botLastMoveStart = new Date(0);
		this.botInterval = botConfigs.delay * 1000;
		this.botState = new State();
		this.botInputs = [];

        // Spawn worker
        // Fetch file
        fetch("./pub/js/botWorker.js",
            {
                method: "GET",
                headers: {
                    "Cross-Origin-Embedder-Policy": "credentialless",
                    "Cross-Origin-Opener-Policy": "same-origin"
                }
            })
            .then(res => res.text())
            .then(workerFile => {
                console.log(workerFile);

                // Create blob
                let blob = new Blob([workerFile], {type: 'application/javascript'});
                this.worker = new Worker(URL.createObjectURL(blob));
                this.worker.running = false;

                // Worker Callbacks
                this.worker.onmessage = e => {
                    console.log(`message from worker: `, e.data);
                    const msg = Array.isArray(e.data) ? e.data[0] : e.data;

                    if (msg == "solution") {
                        this.botInputs.push(...e.data[1]);
                    }
                }
                this.worker.onerror = e => {
                    console.log(`error from worker:`, e);
                }		
            });
	}

    destruct () {
		super.destruct();
        this.botParent.replaceChildren();
		this.worker.terminate();
    };

	start () {
		// Sync Seeds
		const seeds = State.genSeed();
		State.setSeed(this.state, seeds);
		State.setSeed(this.botState, seeds);

		// Initialize
        Game.initialize(this.state);
        Game.initialize(this.botState);
		
		// Draw Once (so as to not be empty)
		this.botRenderer.renderFrom(this.botState);

        // Lambda to run at the end of countdown
        const onStart = () => {
            Game.start(this.state);
            Game.start(this.botState);

            // Start listeners
            this.renderer.box.addEventListener("keydown", this.handleKeyDown);
            this.renderer.box.addEventListener("keyup", this.handleKeyUp);
            this.onFrame();

            // First move
            this.worker.postMessage(["run", this.botState, this.botInterval]);
        };

        // Start countdown, set to T-3.
        let countdown = 3;
        const onCountdown = () => {
            this.renderer.renderCountDown(this.state, countdown--);

            if (countdown < 0) {
                this.renderer.box.focus();
                onStart();
                return;
            }
            setTimeout(onCountdown, 1000);
        };
        onCountdown();
	}

	onFrame = () => {
		if (this.inputs.includes("q-down")) return;
		Game.process(this.config, this.state, this.inputs);

        // If past interval and has move, update state.
        let botMoved = false;
        if (this.botInputs.length > 0 &&
            Date.now() - this.botLastMoveStart > this.botInterval) 
        {
            Game.process(this.config, this.botState, this.botInputs);
			this.botLastMoveStart = Date.now();
            this.botInputs = [];
            botMoved = true;
        }
        
		this.renderer.renderFrom(this.state);
		this.botRenderer.renderFrom(this.botState);

		
        // Attack Exchange 
        if (this.state.attack > 0) this.botState.garbage.push(this.state.attack);
        if (this.botState.attack > 0) this.state.garbage.push(this.botState.attack);
        this.state.attack = 0;
        this.botState.attack = 0;

        // If bot moved, start next move
        if (botMoved) {
            this.worker.postMessage(["run", this.botState, this.botInterval]);
        }

		this.inputs = [];
        this.frameIndex++;

        if (!this.over && !this.state.over && !this.botState.over) {
            setTimeout(this.onFrame, 1000 / FRAME_RATE);
        }
	}
}
