export default class Chat {
    #socket;
    
    constructor (socket) {
        this.#socket = socket;
        this.form = document.getElementById('chat-form');
        this.input = document.getElementById('chat-form-input');
        this.list = document.getElementById('chat-stream');
    }
    
    startListeners () {
        this.#socket.on('chat message', (data) => {
            let item = document.createElement('li');
            item.textContent = data.msg;
            this.list.appendChild(item);
        });
        this.form.addEventListener('submit', (e) => {
            e.preventDefault();
            this.#socket.emit('chat message', {msg: this.input.value});
        });
    }
}