"use strict";

let ticket;
let client_info;

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
            set_ticket(options.ticket);
    }
};

/*
ticket handling
 */
function set_ticket(t){
    if(!t){
        console.log("Cannot set null ticket");
        return;
    }
    ticket = t;
    set_html("ticket_name",t.name);
    set_html("ticket_desc",t.desc);
    set_html("ticket_price",t.price);

}

function buy_ticket(){
    console.log("ticket bought");
    client_info = {
        name :  get("name"),
    };

    console.log(client_info.name);

    send({
        cmd : "COMPLETE_TICKET",
        ticket : client_info,
    });

}

function send(data){
    if(!socket){
        console.log("No socket exists cannot send data");
    }
    socket.send(JSON.parse(data));
}

function set_html(id,HTML){
    let el = get(id);
    if(el){
        el.innerHTML = HTML;
    }
}

function get(id){
    return document.getElementById(id);
}

/*
Ticket has format :
Name,
Price,
Desc,

ticket_id.
 */