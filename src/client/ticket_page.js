"use strict";

let ticket;
let client_info;

let socket = new WebSocket("wss" + window.location.href.slice(5));//remove the https of the url to get socket address.

socket.onmessage = (message) =>{
    let options = JSON.parse(message.data.toString());
    switch(options.cmd){
        case "TICKET" :
            set_ticket(options.ticket);
            break;
        default :
            console.log(`Invalid command received ${options.cmd}`);
            return;
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
    let name_el = get("name");
    let email_el = get("email");
    let button = get("buy");
    button.disabled = name_el.disabled = email_el.disabled = true;

    console.log("ticket bought");

    if(!name_el.value || !email_el.value){
        set_html("error","Please enter both your name and email.");
        button.disabled = name_el.disabled = email_el.disabled = false;
        return;
    }

    client_info = {
        name :  name_el.value,
        email : email_el.value,
    };

    send({
        cmd : "COMPLETE_TICKET",
        info : client_info,
    });



}

function send(data){
    if(!socket){
        console.log("No socket exists cannot send data");
    }
    socket.send(JSON.stringify(data));
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
setup the buttons below
 */

document.getElementById("buy").onclick = buy_ticket;
