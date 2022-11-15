import Game from "./game.mjs";
import GameElement from "./renderer.mjs";
import { State } from "./state.mjs";
import { FRAME_RATE, HEARTBEAT_RATE } from "./config.mjs";
import LocalDriver from "./localDriver.mjs";

export default class OnlineDriver extends LocalDriver {

    constructor (parent, peerParent, socket) {
        super(parent);

        this.socket = socket;

        this.peerRecord = [{state: new State(), inputs: []}];
        this.inputsRecord = [];

        this.recordIndex = 0;
        this.frameOffset = 0;

        this.peerRenderer = new GameElement(peerParent);
        
        // Show wait screen.
        this.renderer.renderWaitScreen();
        this.peerRenderer.renderWaitScreen();

        this.reconcileIndex = 0;

        // DEBUG
        this.frameTimes = [];
        this.avgDelta = 0;
        this.avgElapsed = 0;
        this.avgError = 0;
        this.lastFrameTime = 0;
    }


    startOnline = (seeds) => {
        // Initalize states (now possible with seed value)
        this.state = new State();
        // Seed random functions
        this.seeds = seeds;
        State.setSeed(this.state, seeds);
        State.setSeed(this.peerStateAt(0), seeds);
        // Run seed-dependent initializations. 
        Game.initialize(this.state);
        Game.initialize(this.peerStateAt(0));
        
        // Lambda to run at the end of countdown
        const onStart = () => {
            Game.start(this.state);
            Game.start(this.peerStateAt(0));

            // Start listeners
            this.renderer.box.addEventListener('keydown', this.handleKeyDown);
            this.renderer.box.addEventListener('keyup', this.handleKeyUp);
            this.startPeers();
            this.onFrame();
        }

        // Start countdown, set to T-3.
        let countdown = 3;
        const onCountdown = () => {
            this.renderer.renderCountDown(this.state, countdown);
            this.peerRenderer.renderCountDown(this.peerStateAt(0), countdown--);

            if (countdown < 0) {
                onStart();
                return;
            }
            setTimeout(onCountdown, 1000);
        };
        onCountdown();
    }  

    peerInputsAt = (frame) => {
        const index = frame - this.recordIndex;
        // If references a frame not yet created.
        while (index >= this.peerRecord.length) 
            this.peerRecord.push({state: undefined, inputs: []});
        
        return this.peerRecord[index].inputs;
    }
    peerStateAt = (frame) => {
        // Accessing a yet-to-be initialized state. Unexpected call, most likely a problem.
        if (frame - this.recordIndex >= this.peerRecord.length) {
            console.log("Attempted to access peer state beyond record length.");
            return;
        }
        const index = frame - this.recordIndex;
        return this.peerRecord[index].state;
    }

    startPeers = () => {
        this.socket.on('online-event', data => {
            if (data.from == this.socket.id) return;
            if (data.event == 'heartbeat') return;

            // Logging. If the sent event is at a future frame (caused by slight desynchronizations)
            if (data.frame > this.frameIndex) 
                console.log('online-event data received frame later than current frame');
        
            // Change offset. Assume that the inputs are never sent out-of-order and will not reference a
            // frame already commited to. Remove all records up to the new offset.
            for (let f = this.recordIndex; f < Math.min(this.frameIndex, data.frame-60); f++ ) 
                this.peerRecord.shift();
            this.recordIndex = Math.max(0, Math.min(this.frameIndex, data.frame-60));
            
            // Add to input
            this.peerInputsAt(data.frame).push(data.event);
            //this.peerRecord.at(0).inputs.push(data.event);
            
            // Store where to being reconcilation.
            this.reconcileIndex = Math.min(this.reconcileIndex, data.frame);
        });
    }

    // Overriden from parent 'LocalDriver' to send the input to the server.
    publishEvent = (e) => {
        this.inputs.push(e);
        this.socket.emit('online-event', {event: e, from: this.socket.id, frame: this.frameIndex});
    }

    // Re-compute every frame starting from the changed input. 
    // The 'frame' parameter specifies the frame at which an input was spliced in.
    // i.e. frame +1 will be the first frame reconciled.
    // Stops reconcilation at current frame.
    reconcile = (frame) => {
        for (let f = frame; f <= this.frameIndex; f++) {
            const index = f - this.recordIndex;
            if (index < 0) {
                console.log("Attempted to reconcile already-closed frame.");
                continue;
            }

            const inputs = this.peerInputsAt(f);
            if (index + 1 == this.peerRecord.length) 
                this.peerRecord.push({state: undefined, inputs: []});
            const state = this.peerRecord[index+1].state = structuredClone(this.peerRecord[index].state);

        
            // Recalculate
            Game.process(state, inputs, inputs.includes('garbage-accept'));  
            // Send attacks to local game
            if (state.attack > 0) this.state.garbage.push(state.attack);
            state.attack = 0;
        }
    }

    onFrame = () => {
        const startTime = new Date();
        
        // Local Game
        this.inputsRecord.push(this.inputs);
        Game.process(this.state, this.inputs);
        // Send 'garbage-accept' event if accepted garbage (to sync garbage spawn).
        if (this.state.acceptedGarbage) this.publishEvent('garbage-accept');
        this.state.acceptedGarbage = false;
        this.renderer.renderFrom(this.state);
        this.inputs = [];        

        // Peer Game
        // Reconcile
        this.reconcile(this.reconcileIndex);
        
        /*
        const peerInputs = this.peerInputsAt(this.frameIndex);
        const state = this.peerStateAt(this.frameIndex +1);
        
        Game.process(peerNextState, peerInputs, peerInputs.includes("garbage-accept"));
        */
        this.peerRenderer.renderFrom(this.peerStateAt(this.frameIndex +1));
        
        // Player-to-Player interactions, i.e. attacks.
        if (this.state.attack > 0) this.peerStateAt(this.frameIndex + 1).garbage.push(this.state.attack);
        this.state.attack = 0;
        //if (peerNextState.attack > 0) this.state.garbage.push(peerNextState.attack);
        //peerNextState.attack = 0;

        this.frameIndex ++;
        this.reconcileIndex = this.frameIndex;

        // Send heartbeat 
        if (this.frameIndex % HEARTBEAT_RATE == 0) this.publishEvent('heartbeat');
        // DEBUG
        // Frame time log. (For server to assess desynchronization)
        this.frameTimes.push(startTime.getTime());
        if (this.frameTimes.length > 200) {
            this.socket.emit('online-frameTimes', {times: this.frameTimes});
            this.frameTimes.length = 0;
        }

        // Calculate Time.
        const timeError = this.scheduledTickTime ? startTime.getTime() - this.scheduledTickTime : 0;
        const timeElapsed = new Date().getTime() - startTime.getTime();
        const waitTime = Math.max(0, 1000 / FRAME_RATE - timeElapsed - timeError);
        this.scheduledTickTime = new Date().getTime() + waitTime;

        // DEBUG
        if (this.lastFrameTime == 0) 
            this.lastFrameTime = new Date().getTime();
        else
            this.avgDelta = (this.avgDelta + (startTime.getTime() - this.lastFrameTime)) / (this.avgDelta ? 2 : 1);
        this.avgError = (this.avgError + timeError) / (this.avgError ? 2 : 1);
        this.avgElapsed = (this.avgElapsed + timeElapsed) / (this.avgElapsed ? 2 : 1);

        this.lastFrameTime = startTime.getTime();

        console.log("avg Error %d, avg Delta: %d, av Elapsed: %d", this.avgError, this.avgDelta, this.avgElapsed);


        // Call function again if not over, else render gameover screen
        if (!this.over && !this.state.over && !this.peerStateAt(this.frameIndex).over) 
            setTimeout(this.onFrame, Math.max(0, waitTime));
    }
}