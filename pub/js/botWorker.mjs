import init, { Input, Output, Piece, Key } from '../wasm/tetron_wasm.js'

let wasm, memory;
let loaded = false;
let running = false;
let configs = undefined;
let bench_avg = 0;
let bench_cnt = 0;

postMessage("asdklfja");

// Booter
async function run () {
    console.log("hi");
    postMessage(["hi"]);
	wasm = await init();
	memory = wasm.memory;
	loaded = true;
	postMessage([`wasm loaded`]);
}
run ();

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

		default: return Piece.Some;
	}
}
// Bot driving function
const runBot = async (state) => {
	running = true;
	const input = Input.new();

	{ // Write configs
		input.set_depth(configs.depth);
	}

	{ // Parse CESTRIS.State into TETRON-WASM.Input
		console.log(state);
		// Write board
		for (let y=0; y<20; y++)
			for (let x=0; x<10; x++)
				input.set_board(x, y, state.grid[y*10 + x] !== undefined ? Piece.Some : Piece.None );

		// Write Pieces
		input.set_pieces(0, to_wasm_piece(state.piece.type));
		for (let i=0; i<state.queue.length; i++)
			input.set_pieces(i+1, to_wasm_piece(state.queue[i]));

		// Write Hold
		input.set_hold(to_wasm_piece(state.hold));
	}

	const start = performance.now();
	const output = input.run();
	const elapsed = performance.now() - start;
	bench_avg = (bench_avg*bench_cnt + elapsed) / ++bench_cnt;
	postMessage([`Bench avg: ${bench_avg}ms.  instance:${elapsed}ms`])

	const keys = [];

	{ // Parse output into array of keys
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
	}

	running = false;
	postMessage(["done", keys]);
}

onmessage = e => {
    console.log(e.data);
	const cmd = e.data[0];
	switch (cmd) {
	case "config":
		configs = e.data[1];
		console.log(configs);
		
		break;
	case "run":
		if (!loaded) {
			postMessage(["still loading..."]);
			return;
		}
		if (running) {
			postMessage(["still running..."]);
			return;
		}
		const state = e.data[1];
		runBot(state);
		break;
	default:
		postMessage(["hi mom", cmd]);
	}
}
