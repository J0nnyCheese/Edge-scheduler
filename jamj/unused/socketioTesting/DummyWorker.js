const io = require("socket.io-client");
const socket = io.connect("http://localhost:8000");

// socket.on("seq-num", (msg) => console.info(msg));

// socket.emit('bid_request', [123,456,'bid_request',4]);

const worker_id = randomInt(2000);
const controller_id = 4;
const cycle_num = 4;

socket.on('connect', () => {
    console.log('Connected to controller');
    socket.emit('bid_request', [worker_id,controller_id,'bid_request',cycle_num]);
});

socket.on('bid_response', (response) => {
    console.log(response);
});

socket.on('disconnect', () => {
    console.log('Disconnects from controller');
    return;
});

function randomInt(max) {
    return Math.floor(Math.random() * max);
};