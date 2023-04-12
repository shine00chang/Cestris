import init, { Input, Output, Piece } from '../wasm/tetron_wasm.js'


export function BotConfigs (depth=3, pps=3) {
	this.depth = depth;
	this.delay = 1 / pps;
}

let wasm, memory;
let loaded = false;
let running = false;
let configs = new BotConfigs();

// Booter
async function run () {
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
		input.set_depth(configs.dpeth);
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

	const start = new Date();
	const output = input.run();
	postMessage([`input.run() bench (ms): ${(new Date()) - start}`]);

	const keys = [];

	{ // Parse output into array of keys
		console.log({
			x: output.x(),
			r: output.r(),
			hold: output.hold(),
			s: output.s() 
		});
		const add = (k) => {
			keys.push(k+"-down");
			keys.push(k+"-up");
		}
		if (output.hold()) add("c");

		let r = output.s() == -1 ? output.r() : output.s();
		if (r == 1) { add("ArrowUp"); }
		if (r == 2) { add("z"); add("z"); }
		if (r == 3) { add("z"); }

		console.log(output.x());
		let d = output.x() - 4;
		if (d > 0) for (let i=0; i< d; i++) add("ArrowRight");
		if (d < 0) for (let i=0; i<-d; i++) add("ArrowLeft");

		// If spun
		if (output.s() != -1) {
			add("ArrowDown"); // Softdrop
			let d = output.r() - output.s();
			if (d ==  1) add("ArrowUp"); 
			if (d == -1) add("z"); 
			if (Math.abs(d) == 2) add("a"); 
		}
		add(" ");
	}

	running = false;
	postMessage(["done", keys]);
}

onmessage = e => {
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
		postMessage(["unknown command: ", cmd]);
	}
}
