"use strict";

let ticket;
let client_info;

let socket = new WebSocket("wss" + window.location.href.slice(5));//remove the https of the url to get socket address.

socket.onmessage = (message) =>{
    let data;

    //Check for correctly formatted JSON.
    try{
        data = JSON.parse(message.data.toString());
    }catch(error){
        console.log(error.toString());
    }

    //Execute the requested commands.
    switch(data.cmd){
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

//Set the ticket displayed on the webpage.
function set_ticket(t){
    if(!t){
        console.log("Cannot set null ticket");
        return;
    }
    ticket = t;

    //Setup webpage ticket information.
    set_html("ticket_name",t.name);
    set_html("ticket_desc",t.desc);
    set_html("ticket_price",t.price);

}

//Purchase the ticket and update client_server.
function buy_ticket(){
    //Get personal information from webpage.
    let name_el = get("name");
    let email_el = get("email");
    let button = get("buy");
    button.disabled = name_el.disabled = email_el.disabled = true;

    //Check that both a name and email were entered.
    if(!name_el.value || !email_el.value){
        set_html("error","Please enter both your name and email.");
        button.disabled = name_el.disabled = email_el.disabled = false;
        return;
    }

    //Alert the client_server to the purchase.
    client_info = {
        name :  name_el.value,
        email : email_el.value,
    };

    send({
        cmd : "COMPLETE_TICKET",
        info : client_info,
    });
}

//Send an object to the client server.
function send(data){
    if(!socket){
        console.log("No socket exists cannot send data");
    }
    socket.send(JSON.stringify(data));
}

//Set the HTML of a webpage element with matching id.
function set_html(id,HTML){
    let el = get(id);
    if(el){
        el.innerHTML = HTML;
    }
}

//Return the HTML_Element with matchin gid.
function get(id){
    return document.getElementById(id);
}

/*
setup the buttons below
 */

document.getElementById("buy").onclick = buy_ticket;
