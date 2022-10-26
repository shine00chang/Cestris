import { State } from "./state.mjs";
import Game from "./game.mjs";
import GameElement from "./renderer.mjs";

// Place in 'onFrame' to simulate
/*
if (this.frameIndex == 2000) {
    console.log('local inputs record: ', this.inputsRecord);

    const peerInputsRecord = this.peerRecord.map(record => record.inputs);
    console.log('peer inputs record: ', peerInputsRecord);

    simulate(peerInputsRecord, this.seeds);
    return;
}
*/

export default function simulate (inputsRecord, seeds) {
    const renderer = new GameElement(document.getElementById('debug-view'));
    const state = new State();
    State.setSeed(state, seeds);
    Game.initialize(state);
    Game.start(state);
    
    for (const inputs of inputsRecord) 
        Game.process(state, inputs);

    renderer.renderFrom(state);
}