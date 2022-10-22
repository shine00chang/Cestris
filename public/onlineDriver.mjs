import Game from "./game.mjs";
import GameElement from "./renderer.mjs";
import { State } from "./state.mjs";
import { FRAME_RATE } from "./config.mjs";
import LocalDriver from "./localDriver.mjs";


export default class OnlineDriver extends LocalDriver {

    constructor (parent, peerParent, socket) {
        super(parent);

        this.socket = socket;

        this.recordOffset = 0;
        this.frameOffset = 0;
        this.peerRecord = [{state: new State(), inputs: []}];
        Game.initialize(this.peerRecord[0].state);

        this.peerRenderer = new GameElement(peerParent);
        this.peerRenderer.renderFrom(this.peerRecord[0].state);
    }


    startOnline = () => {
        // On receiving 'online-start', sets to start game at the given start time
        this.socket.on('online-start', data => {
            const startTime = data.startTime;
            setTimeout( () => {

                this.start(); 
                Game.start(this.peerRecord[0].state);
                this.startPeers();
                this.onPeerFrame();

            }, startTime - new Date().getTime() );
        });
    }  


    startPeers = () => {
        this.socket.on('online-event', data => {
            if (data.from == this.socket.id) return;

            // Apply offset (desynchronization protection);
            data.frame -= this.frameOffset;
            // Safety. If the sent event is at a future frame (caused by slight desynchronizations), 
            // set frame offset.
            if (data.frame - this.recordIndex >= this.peerRecord.length) {
                console.log('online-event data received frame later than current frame, incrementing frameOffset');
                this.frameOffset ++;
                data.frame -= this.frameOffset;
                return;
            }

            // Change offset. Assume that the inputs are never sent out-of-order and will not reference a
            // frame already commited to. Remove all records up to the new offset.
            for (let f = 0; f < data.frame - this.recordIndex; f++ ) 
                this.peerRecord.shift();
            this.recordIndex = data.frame;
            // Add to input
            this.peerRecord.at(0).inputs.push(data.event);
            
            // Call for reconcilation. No need to send starting frame, since
            // the offset has been change to the edited frame.
            // NOTE: potential sync problem?
            this.reconcile();
        });
    }

    // Overriden from parent 'LocalDriver' to send the input to the server.
    publishEvent = (e) => {
        this.inputs.push(e);
        this.socket.emit('online-event', {event: e, from: this.socket.id, frame: this.frameIndex});
    }

    // Re-compute every frame starting from the changed input.
    reconcile = () => {
        for (let f = 1; f < this.peerRecord.length; f++) {
            this.peerRecord[f].state = structuredClone(this.peerRecord[f-1].state);

            Game.process(this.peerRecord[f].state, this.peerRecord[f-1].inputs);    
        }
    }

    onPeerFrame = () => {        
        this.peerRecord.push( { state: structuredClone(this.peerRecord.at(-1).state), inputs: [] } );

        Game.process(this.peerRecord.at(-1).state, this.peerRecord.at(-2).inputs);
        this.peerRenderer.renderFrom(this.peerRecord.at(-1).state);
        
        if (!this.over && !this.peerRecord.at(-1).state.over) {
            setTimeout(this.onPeerFrame, 1000 / FRAME_RATE);
        } else 
            this.peerRenderer.renderOver(this.peerRecord.at(-1).state);
    }
}