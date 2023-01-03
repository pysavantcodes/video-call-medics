import { io } from 'socket.io-client';

const options = {
    "force new connection": true,
    reconnectionAttempts: "Infinity",
    timeout: 10000,
    transports: ["websocket"]
}

const socket = io("https://wirehaired-zesty-growth.glitch.me", options);

export default socket;