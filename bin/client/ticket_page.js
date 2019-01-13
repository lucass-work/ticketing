"use strict";

let ticket;

let socket = new WebSocket("wss" + window.location.href.slice(5));
socket.addEventListener('open', function (event) {
    //
});

socket.onmessage = (message) =>{
    let options = JSON.parse(message.data.toString());
    switch(options.cmd){
        default :
            console.log(`Invalid command received ${options.cmd}`);
            return;
        case "TICKET" :
            ticket = options.ticket;
            console.log(`Ticket received ${ticket}`);
    }
};

function send(data){
    if(!socket){
        console.log("No socket exists cannot send data");
    }
    socket.send(JSON.parse(data));
}

/*
Ticket has format :
Name,
Price,
Desc,

ticket_id.
 */