import LocalDriver from './localDriver.mjs';
import OnlineDriver from './onlineDriver.mjs';
import Chat from './chat.mjs';
import { io } from "https://cdn.socket.io/4.4.1/socket.io.esm.min.js";

// Trigger load animations
slideMenuIn(document.getElementById('home-menu'));

let socket = io('localhost:8000');
let game;
let chat;
let username;
let roomId;
let admin = false;

// Animations
function titleToConerTransition() {
    document.getElementById('title-box').style.top = '30px';
    document.getElementById('title-box').style.left = '70px';
}


function slideMenuIn (elem) {
    elem.style.top = '40%';
    elem.style.opacity = 1;
}


function slideMenuOut (elem) {
    elem.style.top = '100%';
    elem.style.opacity = 0;
}


function  activatePrompt (elem) {
    elem.style.display = 'inline';
    elem.style.opacity = 1;
    document.getElementById('filter').style.opacity = 0.5;
}


function startGameView () {
    titleToConerTransition();
    document.getElementById('main-box').style.display = 'flex';
    document.getElementById('main-box').style.top = '10%';
}


function decativatePrompt (elem) {
    setTimeout(() => elem.style.display = 'none', 1000);
    elem.style.opacity = 0;
    document.getElementById('filter').style.opacity = 0;
}



// Callbacks on UI events
const onOnlineJoin = () => {
    if (game !== undefined) return;

    // Activate user & room ID prompt.
    activatePrompt(document.getElementById('online-prompt'));
}
const onLocal = () => {
    startGameView();
    slideMenuOut(document.getElementById('home-menu'));

    if (game !== undefined) game.destruct();

    game = new LocalDriver(document.getElementById('main-view'));
    game.start();
}

function onlinePromptSubmit () {
    // Send 'online-join' event to signal join
    const roomIdIn = document.getElementById('roomid-input').value;
    const nameIn = document.getElementById('name-input').value.trim();

    // Check if valid name 
    if (nameIn.length < 3) {
        document.getElementById('error').innerText = "Name too short, at least 3 characters.";
        return;
    }
    socket.emit('online-join', {roomId: roomIdIn, name: nameIn});

    // Await 'online-join-ack' to find error or confirm join
    socket.on('online-join-ack', data => {
        if (!data.error) {
            onJoinRoom(data);
        } else {
            // else, display error
            document.getElementById('error').innerText = data.message;
        }
        socket.off('online-join-ack');
    });
}

const onJoinRoom = (data) => {
    // On sucess

    // switch menus (trigger transitions)
    slideMenuOut(document.getElementById('home-menu'));
    startGameView();

    // deactivate prompt
    decativatePrompt(document.getElementById('online-prompt'));

    // Start game & chat
    game = new OnlineDriver(document.getElementById('main-view'), document.getElementById('remote-view'), socket);
    chat = new Chat(socket, document.getElementById('chat-box'));

    // Store name, roomId, & admin state
    roomId = data.roomId;
    username = data.name;
    if (data.admin == username) 
        admin = true;
    document.getElementById('roomId').innerText = `Room ID: ${roomId}`;
    document.getElementById('username').innerText = `Username: ${name}`;

    
    // Creates a member-element given the name.
    const addMember = (name) => {
        const entry = document.createElement('div');
        entry.className = 'member-element';
        entry.id = `member-element-${name}`;

        const nameElem = document.createElement('div');
        nameElem.className = 'member-name';
        nameElem.innerText = name;
        entry.appendChild(nameElem);

        const activateBtn = document.createElement('button');
        activateBtn.className = 'member-button';
        activateBtn.innerText = 'A';
        activateBtn.style.display = admin ? 'inline' : 'none';
        activateBtn.onclick = () => socket.emit('online-admin-set-active', {name: name});
        entry.appendChild(activateBtn);

        document.getElementById('member-list').appendChild(entry);
    }
    // Sets member-list given the active players; 
    const setActive = (name, active) => {
        // Change the member element to have a green border
        const elem = document.getElementById(`member-element-${name}`);
        elem.style.border = active ? '2px #6f6 solid' : 'none';
    
        // If you are set as active, Activate Ready Button.
        if (username == name) {
            document.getElementById('online-ready-button').disabled = !active;
            document.getElementById('online-ready-button').innerText = 'ready';
            document.getElementById('online-ready-button').onclick = onOnlineReady;
        }
    }
    // Sets the element of a given member to the ready state given
    const setReady = (name, ready) => {
        // Change the list element of the relevent user to the respective color.
        const elem = document.getElementById(`member-element-${name}`);
        elem.style.background = ready ? '#6f6' : '#fff';
    }

    // Edits element to show admin tag. Activates Admin UI if is self.
    const setAdmin = (name) => {
        // Change background color (temp)
        const elem = document.getElementById(`member-element-${name}`);
        //elem.style.background = '#22d';

        if (name == username) {
            admin = true;
            activateAdminControls();
        }
    }
    // Activates buttons on member for admin.
    const activateAdminControls = () => {
        // Activate Admin controls. 
        const elems = Array.from( document.getElementsByClassName("member-button") );
        elems.forEach(elem => elem.style.display = 'inline');
    }

    // Add peers to member list
    data.peerNames.forEach( name => addMember(name) );
    // Set active & ready members 
    data.readyMembers.forEach( name => setActive(name, true) );
    data.readyMembers.forEach( name => setReady (name, true) );

    // 'online-join' => indicating new peer in room
    socket.on('online-join', data => {
        addMember(data.name);
    });

    // 'online-disconnect' => indicating a peer leaving the room
    socket.on('online-disconnect', data => {
        const entry = document.getElementById('member-element-'+data.peerName);
        document.getElementById('member-list').removeChild(entry);
    });

    // 'online-member-active' => indicating an update on the list of players playing.
    socket.on('online-member-active', data => {
        setActive(data.name, data.active);
    });

    // 'online-member-admin' => indicating a player is now admin. 
    socket.on('online-member-admin', data => {
        setAdmin(data.name);
    });

    // 'online-member-ready' => indicating a player had changed their ready state.
    socket.on('online-member-ready', data => {
        setReady(data.name, data.ready);
    });
}

function onOnlineReady () {
    if (game == undefined) return;
    if (game.running) return;

    socket.emit('online-ready', {ready: true});

    // On receiving 'online-start', sets to start game at the given start time
    socket.on('online-start', data => setTimeout( () => {game.startOnline(data.randSeeds)} , data.offset ));

    // switch callback function to online-unready
    document.getElementById('online-ready-button').innerText = 'unready';
    document.getElementById('online-ready-button').onclick = onOnlineUnready;
}

function onOnlineUnready () {
    if (game == undefined) return;
    if (game.running) return;

    socket.emit('online-ready', {ready: false});
    socket.off('online-start');
    
    // switch callback function to online-unready
    document.getElementById('online-ready-button').innerText = 'ready';
    document.getElementById('online-ready-button').onclick = onOnlineReady;
}



// Set callbacks
document.getElementById('local-button').onclick = onLocal;

document.getElementById('online-join-button').onclick = onOnlineJoin;
document.getElementById('online-prompt-cancel').onclick = () => decativatePrompt(document.getElementById('online-prompt'));
document.getElementById('online-prompt-submit').onclick = onlinePromptSubmit;
