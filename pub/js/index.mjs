import LocalDriver from "./localDriver.mjs";
import OnlineDriver from "./onlineDriver.mjs";
import BotDriver, { BotConfigs } from "./botDriver.mjs";
import Chat from "./chat.mjs";
import { io } from "https://cdn.socket.io/4.4.1/socket.io.esm.min.js";

var IS_STATIC_PAGE = true;//window.location.href.startsWith("https://paddingproductions.github.io/");
console.log("Is static page? ", IS_STATIC_PAGE ? true : false);
if (IS_STATIC_PAGE) {
	document.getElementById("online-join-button").disabled = true;
}

// Trigger load animations
slideMenuIn(document.getElementById("home-menu"));

let socket;
const connect = () => {
    if (!IS_STATIC_PAGE) socket = io();
}
connect();
let game;
let chat;
let username;
let roomId;
let admin = false;
const config = {
    DAS: 8,
    ARR: 0,
    SDF: -1,
};


let clear_error_cb = undefined;
// Error dispaly
function setError(err) {
    document.getElementById("error").innerText = err;
	if (clear_error_cb != undefined) 
		clearTimeout(clear_error_cb);	
	clear_error_cb = setTimeout(() => {
    	document.getElementById("error").innerText = "";
	});
}

// Animations
function titleToConerTransition() {
	let box = document.getElementById("title-box");
    box.style.top = `${20 + box.offsetHeight/2}`;
    box.style.left = `${20 + box.offsetWidth/2}`;
}

function slideMenuIn(elem) {
    elem.style.top = "40%";
    elem.style.opacity = 1;
}

function slideMenuOut(elem) {
    elem.style.top = "100%";
    elem.style.opacity = 0;
}

// Slides in Game view, moves title.
function startGameView(online = false) {
    titleToConerTransition();

    if (online) document.getElementById("room-view").style.display = "inline";
    document.getElementById("main-box").style.display = "flex";
    document.getElementById("main-box").style.top = "10%";
}

function activatePrompt(content, cb) {
	let prompt = document.getElementById("prompt");
	let content_box = document.getElementById("prompt-content");
	let submit = document.getElementById("prompt-submit");
	let cancel = document.getElementById("prompt-cancel");
	let storage = document.getElementById("storage");

	prompt.style.display = "inline";
	prompt.style.opacity = 1;

	content_box.appendChild(content);


	const deactivate = () => {
		let list = content_box.children;
		for (let i=0; i<list.length; i++) {
			console.log(list[i]);
			let node = content_box.removeChild( list[i] );
			storage.appendChild( node );
		}
		prompt.style.opacity = 0;
		setTimeout(() => prompt.style.display = "none", 1000);
		document.getElementById("filter").style.opacity = 0;
	}

	cancel.onclick = deactivate;
	submit.onclick = () => {
		deactivate();
		cb();
	};

    document.getElementById("filter").style.opacity = 0.5;
}

// Callbacks on UI events
const onHome = () => {
	const title = document.getElementById("title-box");
    title.style.top = "30%";
    title.style.left = "50%";

	game.destruct();

	document.getElementById("main-box").style.top = "100%";
	slideMenuIn(document.getElementById("home-menu"));
};

const onConfig = () => {
    activatePrompt(document.getElementById("config-prompt"), onConfigSave);
};

const onConfigSave = () => {
    const SDF = document.getElementById("SDF-input").value;
    const DAS = document.getElementById("DAS-input").value;
    const ARR = document.getElementById("ARR-input").value;

    // Validate values.
    if (SDF != -1 && SDF < 1 || SDF > 100) 
        return setError("Invalid SDF.");

    if (DAS < 1 || DAS > 20) 
        return setError("Invalid DAS.");

    if (ARR < 0 || ARR > 5) 
        return setError("Invalid ARR.");

    // Set config values.
    config.SDF = SDF;
    config.DAS = DAS;
    config.ARR = ARR;
};

const onLocal = () => {
    // Change to game view.
    startGameView();
    slideMenuOut(document.getElementById("home-menu"));

    // Create game object.
    game = new LocalDriver(document.getElementById("main-view"), config);

    // Start global-level control (key) listeners.
    document.getElementById("main-view").addEventListener("keyup", (e) => {
        // Key 'r' => Restart game.
        if (e.key == "r") {
            game.destruct();
            setTimeout(() => {
                game = new LocalDriver(
                    document.getElementById("main-view"),
                    config
                );
                game.start();
            }, 200);
        }
    });

    // Start game.
    game.start();
};

const onBot = () => {
    activatePrompt(document.getElementById("bot-prompt"), onBotPromptSubmit);
}
const onBotPromptSubmit = () => {
	// Change to game view
	startGameView();
	slideMenuOut(document.getElementById("home-menu"));

	const config = {
		DAS: 10,
		SDF: -1,
		ARR: 0,
	};
    const depth = Math.min(3, 	Math.max(1, 	parseInt(document.getElementById("depth-input").value)));
    const pps 	= Math.min(10, 	Math.max(0.5, 	parseFloat(document.getElementById("PPS-input").value)));
	const botConfigs = new BotConfigs(depth, pps);

	// Create game object
	game = new BotDriver(document.getElementById("main-view"), document.getElementById("remote-view"), config, botConfigs);

	// Start
	game.start();
}

// ===== ONLINE HANDLERS ======

const onOnlineJoin = () => {
    if (game !== undefined) return;

    // Activate user & room ID prompt.
    activatePrompt(document.getElementById("online-prompt"), onlinePromptSubmit);
};

function onlinePromptSubmit() {
    // Send 'online-join' event to signal join
    const roomIdIn = document.getElementById("roomid-input").value;
    const nameIn = document.getElementById("name-input").value.trim();

    // Check if valid name
    if (nameIn.length < 3) {
        setError("Name too short, at least 3 characters.");
        return;
    }
    socket.emit("online-join", { roomId: roomIdIn, name: nameIn });

    // Await 'online-join-ack' to find error or confirm join
    socket.on("online-join-ack", (data) => {
        if (!data.error) {
            onJoinRoom(data);
        } else {
            // else, display error
            setError(data.message);
        }
        socket.off("online-join-ack");
    });
}

const onJoinRoom = (data) => {
    // On sucess
    // switch menus (trigger transitions)
    slideMenuOut(document.getElementById("home-menu"));
    startGameView(true);

    // Start game & chat
    game = new OnlineDriver(
        document.getElementById("main-view"),
        document.getElementById("remote-view"),
        socket,
        config
    );
    chat = new Chat(socket, document.getElementById("chat-box"));

    // Store name, roomId, & admin state
    roomId = data.roomId;
    username = data.name;
    if (data.admin == username) admin = true;
    document.getElementById("roomId").innerText = `Room ID: ${roomId}`;
    document.getElementById("username").innerText = `Username: ${name}`;

    // Creates a member-element given the name.
    const addMember = (name) => {
        const entry = document.createElement("div");
        entry.className = "member-element";
        entry.id = `member-element-${name}`;

        const nameElem = document.createElement("div");
        nameElem.className = "member-name";
        nameElem.innerText = name;
        entry.appendChild(nameElem);

        const activateBtn = document.createElement("button");
        activateBtn.className = "member-button";
        activateBtn.innerText = "A";
        activateBtn.style.display = admin ? "inline" : "none";
        activateBtn.onclick = () =>
            socket.emit("online-admin-set-active", { name: name });
        entry.appendChild(activateBtn);

        document.getElementById("member-list").appendChild(entry);
    };
    // Sets member-list given the active players;
    const setActive = (name, active) => {
        // Change the member element to have a green border
        const elem = document.getElementById(`member-element-${name}`);
        elem.style.border = active ? "2px #6f6 solid" : "none";

        // If you are set as active, Activate Ready Button.
        if (username == name) {
            document.getElementById("online-ready-button").disabled = !active;
            document.getElementById("online-ready-button").innerText = "ready";
            document.getElementById("online-ready-button").onclick =
                onOnlineReady;
        }
    };
    // Sets the element of a given member to the ready state given
    const setReady = (name, ready) => {
        // Change the list element of the relevent user to the respective color.
        const elem = document.getElementById(`member-element-${name}`);
        elem.style.background = ready ? "#6f6" : "#fff";
    };

    // Edits element to show admin tag. Activates Admin UI if is self.
    const setAdmin = (name) => {
        // Change background color (temp)
        const elem = document.getElementById(`member-element-${name}`);
        //elem.style.background = '#22d';

        if (name == username) {
            admin = true;
            activateAdminControls();
        }
    };
    // Activates buttons on member for admin.
    const activateAdminControls = () => {
        // Activate Admin controls.
        const elems = Array.from(
            document.getElementsByClassName("member-button")
        );
        elems.forEach((elem) => (elem.style.display = "inline"));
    };

    // Add peers to member list
    data.peerNames.forEach((name) => addMember(name));
    // Set active & ready members
    data.readyMembers.forEach((name) => setActive(name, true));
    data.readyMembers.forEach((name) => setReady(name, true));

    // 'online-join' => indicating new peer in room
    socket.on("online-join", (data) => {
        addMember(data.name);
    });

    // 'online-disconnect' => indicating a peer leaving the room
    socket.on("online-disconnect", (data) => {
        const entry = document.getElementById(
            "member-element-" + data.peerName
        );
        document.getElementById("member-list").removeChild(entry);
    });

    // 'online-member-active' => indicating an update on the list of players playing.
    socket.on("online-member-active", (data) => {
        setActive(data.name, data.active);
    });

    // 'online-member-admin' => indicating a player is now admin.
    socket.on("online-member-admin", (data) => {
        setAdmin(data.name);
    });

    // 'online-member-ready' => indicating a player had changed their ready state.
    socket.on("online-member-ready", (data) => {
        setReady(data.name, data.ready);
    });
};

function onOnlineReady() {
    if (game == undefined) return;
    if (game.running) return;

    socket.emit("online-ready", { ready: true });

    // On receiving 'online-start', sets to start game at the given start time
    socket.on("online-start", (data) =>
        setTimeout(() => {
            game.startOnline(data);
        }, data.offset)
    );

    // switch callback function to online-unready
    document.getElementById("online-ready-button").innerText = "unready";
    document.getElementById("online-ready-button").onclick = onOnlineUnready;
}

function onOnlineUnready() {
    if (game == undefined) return;
    if (game.running) return;

    socket.emit("online-ready", { ready: false });
    socket.off("online-start");

    // switch callback function to online-unready
    document.getElementById("online-ready-button").innerText = "ready";
    document.getElementById("online-ready-button").onclick = onOnlineReady;
}

// ======== SETTING CALLBACKS ======= 
// Home menu
document.getElementById("title-box").onclick = onHome; 
document.getElementById("config-button").onclick = onConfig;
document.getElementById("local-button").onclick = onLocal;
document.getElementById("online-join-button").onclick = onOnlineJoin;
document.getElementById("bot-button").onclick = onBot;
