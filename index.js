const express = require("express");
const http = require('http');
const { Server } = require("socket.io");


const app = express();
const server = http.createServer(app);
const io = new Server(server);
const port = 8000;

const FRAME_RATE = 30;

app.use(express.json());
app.set('view engine', 'ejs');
app.use(express.static('public'));

app.get('/', (req, res) => {
    res.render('index.ejs');
});

class Environment {
    constructor () {
        this.bag = [];
        this.queue = [];
    }
}
class Client {
    constructor (socket) {
        this.ready = false;
        this.socket = socket;
    }
}
let clients = {};

onTick = () => {
    //processInputs
    for (let i=0; i<game.length; i++) {
        const game = games[i];
        const queue = queues[i];

        game.processInputs(queue);
    };
    //sendStates
    const states = games.map( game => {
        return game.dumpState();
    });
    io.emit('server state', {states: states});

    setTimeout(onTick, 1000 / FRAME_RATE)
}

startListeners = (socket) => {
    // On 'chat message', Broadcast incomming chat messages
    socket.on('chat message', (data) => {
        console.log('message: ', data.msg);
        io.emit('chat message', data);
    });
    // On 'online-join', Push new user into active sockets list. 
    socket.on('online-join', (data) => {
        console.log('joined game: ', socket.id);
        clients[socket.id] = new Client(socket);
    });
    // On 'online-ready', Set user as ready.
    // If all clients are ready, begin game.
    socket.on('online-ready', (data) => {
        console.log('ready for game: ', socket.id);
        const client = clients[socket.id];
        if (client === undefined) return;
        client.ready = true;

        // Check start
        let shouldStart = true;
        for (let id in clients) {
            if (!clients[id].ready) 
                shouldStart = false;
        }
        
        if (shouldStart) 
            startGame();
    })
    // On 'online-event' (user publishing an input event), broadcast
    socket.on('online-event', (data) => {
        console.log(`new event from ${socket.id}: `, data.event);
        io.emit('online-event', data);
    });
}

// Initializes games, signals start at set unix time. 
startGame = () => {
    const startTime = new Date();
    startTime.setSeconds(startTime.getSeconds() + 3);

    console.log("starting game at: ", startTime);
    io.emit('online-start', {startTime: startTime.getTime()});
}


io.on('connection', (socket) => {
    console.log('a user connected: ', socket.id);
    startListeners(socket);
});
  
server.listen(port, '192.168.4.120', () => {
    console.log('listening on localhost: ', port);
});
