import LocalDriver from './localDriver.mjs';
import OnlineDriver from './onlineDriver.mjs';
import Chat from './chat.mjs';
import { io } from "https://cdn.socket.io/4.4.1/socket.io.esm.min.js";

let socket = io('localhost:8000');
let roomId;
let game;
let chat = new Chat(socket, document.getElementById('chat-box'));

chat.startListeners();

document.getElementById('local-button').onclick = () => {
    if (game !== undefined) game.destruct();

    game = new LocalDriver(document.getElementById('main-view'));
    setTimeout(game.start, 3000);
}

document.getElementById('online-join-button').onclick = onOnlineJoin;

function onOnlineJoin () {
    if (game !== undefined) return;

    // Send 'online-join' event to signal join
    const roomIdIn = document.getElementById('roomid-input').value;
    const nameIn = document.getElementById('name-input').value;
    socket.emit('online-join', {roomId: roomIdIn, name: nameIn});

    // Await 'online-join-ack' to find error or confirm join
    socket.on('online-join-ack', data => {
        if (!data.error) {
            // On sucess
            // Dispaly roomId
            const roomId = data.roomId
            document.getElementById('roomId').innerText = roomId;

            // Add peers to member list
            data.peerNames.forEach( name => {
                const entry = document.createElement('li');
                entry.innerText = name;
                entry.id = 'member-list-' + name;
                document.getElementById('member-list').appendChild(entry);
            });

            // Start listener for 'online-join', indicating new peer in room
            socket.on('online-join', data => {
                const entry = document.createElement('li');
                entry.innerText = data.peerName;
                entry.id = 'member-list-' + data.peerName;
                document.getElementById('member-list').appendChild(entry);
            });
            // Start listener for 'online-disconnect', indicating a peer leaving the room
            socket.on('online-disconnect', data => {
                const entry = document.getElementById('member-list-'+data.peerName);
                document.getElementById('member-list').removeChild(entry);
            });
            if (game !== undefined) game.destruct();
        } else {
            // else, display error
            document.getElementById('error').innerText = data.message;
        }
        socket.off('online-join-ack');
    });

    // activate ready button
    document.getElementById('online-ready-button').style.display = 'inline';
    document.getElementById('online-ready-button').onclick = onOnlineReady;

    // switch callback function to online-leave
    document.getElementById('online-join-button').innerText = 'online-leave';
    document.getElementById('online-join-button').onclick = onOnlineLeave;
}

function onOnlineLeave () {
    socket.emit('online-leave');

    // de-activate ready button
    document.getElementById('online-ready-button').style.display = 'inline';
    document.getElementById('online-ready-button').onclick = onOnlineReady;

    // switch callback function to online-join
    document.getElementById('online-join-button').innerText = 'online-join';
    document.getElementById('online-join-button').onclick = onOnlineJoin;
}



function onOnlineReady () {
    if (game !== undefined) return;

    socket.emit('online-ready');

    game = new OnlineDriver(document.getElementById('main-view'), document.getElementById('remote-view'), socket);
    game.startOnline();
}
