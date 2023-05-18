const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");
const _ = require("lodash");

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const port = 8000;

const FRAME_RATE = 30;

app.use(express.json());
app.use(express.static("pub"));

app.get("/", (_, res) => {
    res.sendFile("index.html", { root: path.join(__dirname) });
});

const characters =
	"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
function generateString(length) {
	let result = " ";
	const charactersLength = characters.length;
	for (let i = 0; i < length; i++) {
		result += characters.charAt(
			Math.floor(Math.random() * charactersLength)
		);
	}

	return result;
}

class Room {
	clients = [];
	inGame = false;
	running = false;
	constructor(id) {
		this.id = id;
	}

	startGame = () => {
		this.running = true;

		const startTime = new Date();
		const randSeeds = [generateString(10), generateString(10)];
		startTime.setSeconds(startTime.getSeconds() + 3);

		// Sends 'online-start' signal to all clients. Distributes configurations of the game
		// in room at set unix time.
		console.log("room %s starting game: ", this.id);
		this.clients.forEach((client) =>
			client.socket.emit("online-start", {
				startTime: startTime.getTime(),
				randSeeds: randSeeds,
				peerConfig: {},
			})
		);

		// Starts game-necessary listeners on client sockets.
		this.startGameListeners();
	};

	// Starts game-necessary listeners on client sockets. Includes: 'online-event'
	startGameListeners = () => {
		this.clients.forEach((client) => {
			// On 'online-event' (user publishing an input event), broadcast to others in room
			client.socket.on("online-event", (data) => {
				// Broadcast to all peers
				this.clients.forEach((client) =>
					client.socket.emit("online-event", data)
				);
			});

			// DEBUG - Check frame sync
			client.socket.on("online-frameTimes", (data) => {
				console.log(`Got frameTimes data from: ${client.socket.id}.`);
				client.frameTimes = data.times;

				let shouldCheck = true;
				for (const peer of this.clients)
					if (peer.frameTimes.length == 0) shouldCheck = false;

				if (shouldCheck) {
					console.log("Checking times...");
					const cnt = new Array(1000).fill(0);
					const range = 1;

					let l = cnt.length;
					let r = 0;
					for (let i = 0; i < 200; i++) {
						const d = Math.abs(
							this.clients[0].frameTimes[i] -
								this.clients[1].frameTimes[i]
						);
						const index = Math.floor(d / range);
						cnt[Math.min(index, cnt.length - 1)]++;
						l = Math.min(index, l);
						r = Math.max(index, r);
					}
					for (let i = l; i < r; i++) {
						let str = "";
						for (let j = 0; j < cnt[i]; j++) str += "*";
						console.log(
							`${i * range}-${i * range + range - 1}: ${str}`
						);
					}
					for (const peer of this.clients) peer.frameTimes.length = 0;
				}
			});
		});
	};
}
class Client {
	frameTimes = [];
	constructor(name, socket) {
		this.name = name;
		this.ready = false;
		this.active = false;
		this.socket = socket;
	}
}
const clients = {};
const rooms = {};

onTick = () => {
	//processInputs
	for (let i = 0; i < game.length; i++) {
		const game = games[i];
		const queue = queues[i];

		game.processInputs(queue);
	}
	//sendStates
	const states = games.map((game) => {
		return game.dumpState();
	});
	io.emit("server state", { states: states });

	setTimeout(onTick, 1000 / FRAME_RATE);
};

startListeners = (socket) => {
	// On 'disconnect', remove records, transfer admin.
	socket.on("disconnect", function () {
		console.log("Client disconnected: ", socket.id);
		if (clients[socket.id] === undefined) return;

		const client = clients[socket.id];
		const room = rooms[client.roomId];

		// Remove from room
		room.clients.forEach((peer) =>
			peer.socket.emit("online-disconnect", { peerName: client.name })
		);
		const index = rooms[client.roomId].clients.indexOf(client);
		room.clients.splice(index, 1);

		// If empty, destroy room
		if (room.clients.length == 0) {
			delete rooms[room.id];
			console.log("destroyed room");
		}

		// If room was running, signal stop/forfeit
		room.clients.forEach((peer) =>
			peer.socket.emit("online-event", { event: "forfeit" })
		);
		room.running = false;

		// Transfer admin if needed.
		if (room && client == room.admin) {
			room.admin = room.clients[0];
			// Broadcast admin change.
			room.clients.forEach((peer) =>
				peer.socket.emit("online-member-admin", {
					name: room.admin.name,
				})
			);
		}

		// Destroy client
		delete clients[socket.id];
	});

	// On 'online-join', Push new user into active sockets list.
	socket.on("online-join", (data) => {
		console.log(
			"requested join from: %s; to room: %s",
			socket.id,
			data.roomId
		);
		if (data.name === undefined || data.roomId == undefined) return;

		// Check if name exists
		for (const id in clients) {
			const client = clients[id];
			if (client.name != data.name) continue;
			socket.emit("online-join-ack", {
				error: true,
				message: `name '${data.name}' already exists, rejected.`,
			});
			return;
		}
		// If room Id empty, create new room
		if (data.roomId == "") {
			const id = _.uniqueId();
			rooms[id] = new Room(id);
			data.roomId = id;

			console.log("created room: ", id);
		}
		// Check if room exists
		if (!(data.roomId in rooms)) {
			socket.emit("online-join-ack", {
				error: true,
				message: `room '${data.roomId}' does not exist, rejected.`,
			});
			return;
		}
		// Create client instance and add to room.
		const client = new Client(data.name, socket);
		client.roomId = data.roomId;
		const room = rooms[client.roomId];
		clients[socket.id] = client;
		room.clients.push(client);

		// If is new room, set user as admin.
		if (room.clients.length == 1) room.admin = client;

		// Return sucessful acknowledge event
		socket.emit("online-join-ack", {
			roomId: client.roomId,
			name: client.name,
			peerNames: room.clients.map((client) => client.name),
			readyMembers: room.clients
				.filter((client) => client.ready)
				.map((client) => client.name),
			activeMembers: room.clients
				.filter((client) => client.active)
				.map((client) => client.name),
			admin: room.admin.name,
		});

		// Start chat message event listening
		socket.on("chat message", (data) => {
			room.clients.forEach((client) =>
				client.socket.emit("chat message", data)
			);
		});

		// Broadcast new peer event 'online-join'
		room.clients.forEach((peer) => {
			if (peer == client) return;
			peer.socket.emit("online-join", { name: client.name });
		});
		console.log("accepted join request to room: ", room.id);
	});

	// On 'online-ready', Set user as ready.
	// If all clients are ready, begin game.
	socket.on("online-ready", (data) => {
		if (!(socket.id in clients)) {
			console.log("client not yet joined, rejecting.");
			return;
		}

		const client = clients[socket.id];
		const room = rooms[client.roomId];

		if (client === undefined || room === undefined) return;
		if (!client.active) return;
		if (client.ready == data.ready) return;

		client.ready = data.ready;

		// Broadcast ready state change to peers.
		room.clients.forEach((peer) => {
			peer.socket.emit("online-member-ready", {
				name: client.name,
				ready: data.ready,
			});
		});

		if (data.ready) {
			if (room.running) return;
			// Check number of peers, if only one, don't start.
			if (room.clients.length == 1) return;

			// Check peers in room for start and broadcast ready message.
			let shouldStart = true;
			room.clients.forEach((peer) => {
				if (!peer.ready) shouldStart = false;
			});

			// Start game
			if (shouldStart) room.startGame();
		}
	});

	// On 'online-admin-set-active', changes 'active' state of user in room.
	socket.on("online-admin-set-active", (data) => {
		const client = clients[socket.id];
		if (!client) return;

		const room = rooms[client.roomId];
		// If not admin
		if (client != room.admin) {
			console.log("Fradulent Admin event from: ", socket.id);
			return;
		}

		const peer = room.clients.find((client) => client.name == data.name);
		if (!peer) return;

		// If already have 2 actives, and the targeted peer is not active, reject
		if (!peer.active) {
			let actives = 0;
			room.clients.forEach((client) => (actives += client.active));
			if (actives == 2) {
				console.log("Already 2 active players, rejecting.");
				return;
			}
		}
		peer.active = !peer.active;
		console.log(
			"online-admin-set-active event recieved, changing: ",
			peer.name
		);

		// Broadcast active state change to peers.
		room.clients.forEach((client) => {
			client.socket.emit("online-member-active", {
				name: peer.name,
				active: peer.active,
			});
		});
	});
};

io.on("connection", (socket) => {
	console.log("a user connected: ", socket.id);
	startListeners(socket);
});

server.listen(port, () => {
	console.log("listening on localhost: ", port);
});
