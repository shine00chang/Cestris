import Game from "./game.mjs";
import GameElement from "./renderer.mjs";
import { State } from "./state.mjs";
import { FRAME_RATE, PEER_RENDER_SKIPS } from "./config.mjs";
import LocalDriver from "./localDriver.mjs";
import simulate from "./simulator.mjs";

export default class OnlineDriver extends LocalDriver {

    constructor (parent, peerParent, socket) {
        super(parent);

        this.socket = socket;

        this.peerRecord = [{state: new State(), inputs: []}];
        this.inputsRecord = [];

        this.recordIndex = 0;
        this.frameOffset = 0;

        this.peerRenderer = new GameElement(peerParent);
        this.peerRenderer.renderFrom(this.peerStateAt(0));
        this.reconcileIndex = 0;
    }


    startOnline = () => {
        // On receiving 'online-start', sets to start game at the given start time
        this.socket.on('online-start', data => {
            const startTime = data.startTime;
            
            // Initalize states (now possible with seed value)
            this.state = new State();
            // Seed random functions
            console.log("randSeeds: ", data.randSeeds);
            this.seeds = data.randSeeds;
            State.setSeed(this.state, data.randSeeds);
            State.setSeed(this.peerStateAt(0), data.randSeeds);
            // Run seed-dependent initializations. 
            Game.initialize(this.state);
            Game.initialize(this.peerStateAt(0));
            Game.start(this.state);
            Game.start(this.peerStateAt(0));
            
            setTimeout( () => {
                // Start listeners
                document.addEventListener('keydown', this.handleKeyDown);
                document.addEventListener('keyup', this.handleKeyUp);
                this.startPeers();
                this.onFrame();

            }, startTime - new Date().getTime() );
        });
    }  

    peerInputsAt = (frame) => {
        const index = frame - this.recordIndex;
        // If references a frame not yet created.
        while (index >= this.peerRecord.length) {
            this.peerRecord.push({state: structuredClone(this.peerRecord.at(-1).state), inputs: []});
        }
        return this.peerRecord[index].inputs;
    }
    peerStateAt = (frame) => {
        const index = frame - this.recordIndex;
        // If references a frame not yet created.
        while (index >= this.peerRecord.length) {
            this.peerRecord.push({state: structuredClone(this.peerRecord.at(-1).state), inputs: []});
        }
        return this.peerRecord[index].state;
    }

    startPeers = () => {
        this.socket.on('online-event', data => {
            if (data.from == this.socket.id) return;
            console.log(data);

            // Apply offset (desynchronization protection);
            //data.frame -= this.frameOffset;
            // Safety. If the sent event is at a future frame (caused by slight desynchronizations), 
            // set frame offset.
            if (data.frame > this.frameIndex) {
                console.log('online-event data received frame later than current frame');
            }

            // Change offset. Assume that the inputs are never sent out-of-order and will not reference a
            // frame already commited to. Remove all records up to the new offset.
            /*
            for (let f = this.recordIndex; f < Math.min(this.frameIndex, data.frame); f++ ) 
                this.peerRecord.shift();
            this.recordIndex = Math.min(this.frameIndex, data.frame);
            */
            
            // Add to input
            this.peerInputsAt(data.frame).push(data.event);
            //this.peerRecord.at(0).inputs.push(data.event);
            
            // Call for reconcilation. No need to send starting frame, since
            // the offset has been change to the edited frame.
            // NOTE: potential sync problem?
            this.reconcileIndex = Math.min(this.reconcileIndex, data.frame);
            //this.reconcile(data.frame);
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
        console.log('start reconcile');
        for (let f = frame; f < this.frameIndex; f++) {
            const index = f - this.recordIndex;
            const inputs = this.peerInputsAt(f);
            const state = this.peerRecord[index+1].state = structuredClone(this.peerStateAt(f));
        
            // Check if garbage accepted
            let shouldSpawnGarbage = false;
            {
                const index = inputs.indexOf('garbage-accept');
                if (index != -1) 
                    shouldSpawnGarbage = true;
            }
            // Recalculate
            console.log(inputs);
            Game.process(state, inputs);  
            // Send attacks to local game
            if (state.attack > 0) this.state.garbage.push(state.attack);
            state.attack = 0;
        }
    }

    onFrame = () => {
        const startTime = new Date();
        if (this.frameIndex == 2000) {
            console.log('local inputs record: ', this.inputsRecord);

            const peerInputsRecord = this.peerRecord.map(record => record.inputs);
            console.log('peer inputs record: ', peerInputsRecord);

            simulate(peerInputsRecord, this.seeds);
            return;
        }
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
        //if (this.reconcileIndex != this.frameIndex) {
        //    console.log(this.reconcileIndex);
            this.reconcile(this.reconcileIndex);
        //}
        const peerInputs = this.peerInputsAt(this.frameIndex);
        const peerNextState = this.peerStateAt(this.frameIndex + 1);
        // Check if garbage accepted
        let shouldSpawnGarbage = false;
        const index = peerInputs.indexOf('garbage-accept');
        if (index != -1) 
            shouldSpawnGarbage = true;
        
        Game.process(peerNextState, peerInputs, shouldSpawnGarbage);
        
        // Skip rendering sometimes. This is to prevent jittery movement caused by constant reconcilations.
        //if (this.frameIndex % PEER_RENDER_SKIPS === 0)
        this.peerRenderer.renderFrom(this.peerStateAt(this.frameIndex +1));
        
        // Player-to-Player interactions, i.e. attacks.
        if (this.state.attack > 0) this.peerStateAt(this.frameIndex + 1).garbage.push(this.state.attack);
        this.state.attack = 0;

        this.frameIndex ++;
        this.reconcileIndex = this.frameIndex;
        

        // Call function again if not over, else render gameover screen
        const timeElapsed = new Date().getTime() - startTime.getTime();
        if (!this.over && !this.state.over && !this.peerStateAt(this.frameIndex).over) {
            setTimeout(this.onFrame, 1000 / FRAME_RATE - timeElapsed);
        } else {
            this.peerRenderer.renderOver(this.peerStateAt(this.frameIndex));
            this.renderer.renderOver(this.state);
        }
    }
}