const location = self.location;
console.log(location);

const wasm_dir = location.origin + "/pub/wasm";
console.log("cross origin isolated: ", crossOriginIsolated);
console.log(wasm_dir+"/wasm_driver.js");

( async () => {

// Load wasm
{
await importScripts(wasm_dir+"/wasm_driver.js");

if (typeof SharedArrayBuffer !== 'function') {
    const msg = "this browser does not have SharedArrayBuffer support enabled\n" +
                "this may be because of browser version, permissions, or lack of cross origin isolation."
    return console.error(msg)
}

// Test for bulk memory operations with passive data segments
//  (module (memory 1) (data passive ""))
const buf = new Uint8Array([0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00,
0x05, 0x03, 0x01, 0x00, 0x01, 0x0b, 0x03, 0x01, 0x01, 0x00]);
if (!WebAssembly.validate(buf)) {
    return console.error('this browser does not support passive wasm memory')
}

await wasm_bindgen(wasm_dir+"/wasm_driver_bg.wasm");
postMessage("init done");
}

// Start bot
const { Prog, Input, Piece, Key } = wasm_bindgen;
const Bot = Prog.new(6);


function to_wasm_piece (js_v) {
	if (js_v === undefined || js_v === null) return Piece.None;
	switch (js_v) {
		case "T": return Piece.T;
		case "I": return Piece.I;
		case "O": return Piece.O;
		case "J": return Piece.J;
		case "L": return Piece.L;
		case "S": return Piece.S;
		case "Z": return Piece.Z;

		case 0: return Piece.L;
		case 1: return Piece.J;
		case 2: return Piece.Z;
		case 3: return Piece.S;
		case 4: return Piece.I;
		case 5: return Piece.O;
		case 6: return Piece.T;

		default: return Piece.None;
	}
}

let run_start;
function run(state, delay) {
    console.log("Running.");

    run_start = Date.now();

    //Make Input
    const input = Input.new();
    for (let y=0; y<20; y++) 
        for (let x=0; x<10; x++)
            input.set_board(x, y, state.grid[y*10 + x] ? Piece.J : Piece.None);

    input.set_hold(to_wasm_piece(state.hold));
    input.set_pieces(0, to_wasm_piece(state.piece.type));
    console.log(state);
    for (let i=0; i<state.queue.length; i++)
        input.set_pieces(i+1, to_wasm_piece(state.queue[i]));

    Bot.advance(input);

    setTimeout(() => {
        const output = Bot.solution();
        const keys = [];

        // Parse output into array of keys
        const add = k => {
            keys.push(k+"-down");
            keys.push(k+"-up");
        }

        let key = output.next();
        while (key != Key.None) {
            if (key == Key.Left)        add("ArrowLeft");
            if (key == Key.Right)       add("ArrowRight");
            if (key == Key.Cw)          add("ArrowUp");
            if (key == Key.Ccw)         add("z");
            if (key == Key._180)        add("a");
            if (key == Key.HardDrop)    add(" ");
            if (key == Key.SoftDrop)    add("ArrowDown");
            if (key == Key.Hold)        add("c");
            key = output.next();
        }

        postMessage(["elapsed", Date.now() - run_start]);
        postMessage(["solution", keys]);
    }, delay);
}

function start() {
    console.log("Starting bot..");
    Bot.start();
}

function stop() {
    console.log("Stopping bot..");
    Bot.stop();
}

onmessage = e => {
    const cmd = Array.isArray(e.data) ? e.data[0] : e.data;
    const args = Array.isArray(e.data) ? e.data.slice(1) : undefined;

    if (cmd == "run") {
        if (!args) return console.log("No args received, expected state.");
        if (args.length == 1) 
            run(args[0], 1000);
        else 
            run(args[0], args[1]);
    }
    if (cmd == "stop") {
        stop();
    }
    if (cmd == "start") {
        start();
    }
}


})();
