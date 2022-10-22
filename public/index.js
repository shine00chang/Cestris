import LocalDriver from './localDriver.mjs';
import OnlineDriver from './onlineDriver.mjs';
import Chat from './chat.mjs';
import { io } from "https://cdn.socket.io/4.4.1/socket.io.esm.min.js";

let socket = io('localhost:8000');
let game;
let peer; 
let chat = new Chat(socket, document.getElementById('chat-box'));
chat.startListeners();

document.getElementById('local-button').onclick = () => {
    if (game !== undefined) game.destruct();

    game = new LocalDriver(document.getElementById('main-view'));
    setTimeout(game.start, 3000);
}

document.getElementById('online-join-button').onclick = () => {
    socket.emit('online-join');

    if (game !== undefined) game.destruct();
}

document.getElementById('online-ready-button').onclick = () => {
    socket.emit('online-ready');

    game = new OnlineDriver(document.getElementById('main-view'), document.getElementById('remote-view'), socket);
    game.startOnline();
}
