const express = require("express");
const http = require('http');
const { Server } = require("socket.io");
const _ = require('lodash');

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

const characters ='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
function generateString(length) {
    let result = ' ';
    const charactersLength = characters.length;
    for ( let i = 0; i < length; i++ ) {
        result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }

    return result;
}

class Room {
    clients = [];
    inGame = false;
    constructor (id) {
        this.id = id;
    }

    startGame = () => {
        const startTime = new Date();
        const randSeeds = [generateString(10), generateString(10)];
        startTime.setSeconds(startTime.getSeconds() + 3);

        // Sends 'online-start' signal to all clients. Distributes configurations of the game
        // in room at set unix time. 
        console.log("room %s starting game: ", this.id);
        this.clients.forEach(client => client.socket.emit('online-start',
            {
                startTime: startTime.getTime(),
                randSeeds: randSeeds,
            }
        ));

        // Starts game-necessary listeners on client sockets.
        this.startGameListeners();
    }
    
    // Starts game-necessary listeners on client sockets. Includes: 'online-event'
    startGameListeners = () => {
        this.clients.forEach(client => {
            // On 'online-event' (user publishing an input event), broadcast to others in room
            client.socket.on('online-event', data => {
                console.log(`new event from ${client.socket.id}: %s @ f=%d `, data.event, data.frame);

                // Broadcast to all peers
                this.clients.forEach( client => client.socket.emit('online-event', data) );
            });
        });
    }
}
class Client {
    constructor (name, socket) {
        this.name = name;
        this.ready = false;
        this.socket = socket;
    }
}
let clients = {};
let rooms = {};

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

    // On 'disconnect', remove records.
    socket.on('disconnect', function() {
        console.log('Client disconnected: ', socket.id);
        if (clients[socket.id] === undefined) return;

        const client = clients[socket.id];
        const room = rooms[client.roomId];

        // Remove from room
        room.clients.forEach( peer => peer.socket.emit('online-disconnect', {peerName: peer.name}) );
        const index = rooms[client.roomId].clients.indexOf(client);
        room.clients.splice(index, 1);

        // If empty, destroy room
        console.log(room.clients);
        if (room.clients.length == 0) {
            delete rooms[room.id];
            console.log('destroyed room');
        }
            
        // Destroy client
        delete clients[socket.id];
    });

    // On 'chat message', Broadcast incomming chat messages
    socket.on('chat message', (data) => {
        console.log('message: ', data.msg);
        io.emit('chat message', data);
    });

    // On 'online-join', Push new user into active sockets list. 
    socket.on('online-join', (data) => {
        console.log('requested join from: %s; to room: %s', socket.id, data.roomId);
        if (data.name === undefined || data.roomId == undefined) return;

        // Check if name exists 
        for (const id in clients) {
            const client = clients[id];
            if (client.name != data.name) continue;
            socket.emit('online-join-ack', {
                error: true, 
                message: `name '${data.name}' already exists, rejected.`
            });
            return;
        } 
        // If room Id empty (new room)
        if (data.roomId == '') {
            const id = _.uniqueId();
            rooms[id] = new Room(id);
            data.roomId = id;

            console.log("created room: ", id);
        }
        // Check if room exists
        if (!(data.roomId in rooms)) {
            socket.emit('online-join-ack', {
                error: true, 
                message: `room '${data.roomId}' does not exist, rejected.`
            });
            return;
        }
        // Create client instance and add to room.
        const client = new Client( data.name, socket );
        client.roomId = data.roomId;
        const room = rooms[client.roomId];
        clients[socket.id] = client;
        room.clients.push( client );

        // Return sucessful acknowledge event 
        socket.emit('online-join-ack', {roomId: client.roomId, peerNames: room.clients.map(client => client.name)});

        // Broadcast new peer event 'online-join'
        room.clients.forEach( peer => {
            if (peer == client) return;
            peer.socket.emit('online-join', {peerName: client.name});
        }) 
        console.log('accepted join request to room: ', room.id);
    });
    
    // On 'online-ready', Set user as ready.
    // If all clients are ready, begin game.
    socket.on('online-ready', data => {
        console.log("client '%s' ready for game. ", socket.id);
        
        const client = clients[socket.id];
        const room = rooms[client.roomId];

        if (client === undefined || room === undefined) return;
        
        client.ready = true;

        // Check peers in room for start
        let shouldStart = true;
        room.clients.forEach( peer => {
            if (!peer.ready) shouldStart = false;
        });
        
        // Start game
        if (shouldStart) 
            room.startGame();
    })
}

io.on('connection', (socket) => {
    console.log('a user connected: ', socket.id);
    startListeners(socket);
});
  
server.listen(port, () => {
    console.log('listening on localhost: ', port);
});
