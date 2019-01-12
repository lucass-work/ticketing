"use strict";

let token;

let socket = new WebSocket("wss" + window.location.href.slice(5));
socket.addEventListener('open', function (event) {
    socket.send('Hello Server!');
});

socket.onmessage = (message) =>{
    let options = JSON.parse(message.toString());
    switch(options.cmd){
        default :
            console.log("Invalid command received");
            return;
        case "SET_TOKEN":
            token = options.token;
            return;
        case "GET_TOKEN":
            send({
                cmd : "CHECK_TOKEN",
                token : token,
            });
    }
};

socket.onopen = ()=>{
    console.log("connection opened");
};

function send(data){
    if(!socket){
        console.log("No socket exists cannot send data");
    }
    socket.send(JSON.parse(data));
}

