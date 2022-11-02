export default class Chat {
    #socket;
    
    constructor (socket) {
        this.#socket = socket;
        this.input = document.getElementById('chat-input');
        this.list = document.getElementById('chat-stream');
    }
    
    startListeners () {
        this.#socket.on('chat message', (data) => {
            let item = document.createElement('div');
            item.textContent = data.msg;
            item.className = 'message-box';
            this.list.appendChild(item);
        });
        this.input.addEventListener("keypress", e => {
            if (e.key != 'Enter')  return;
            if (this.input.value.length == 0) return;
            this.#socket.emit('chat message', {msg: this.input.value});
            this.input.value = '';
        });
    }
}