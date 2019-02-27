"use strict";

/*
The client server which handles tickets and interacts with requests sent by the main server.
 */

let tls = require('tls');
let https = require('https');
let fs = require('fs');
let path = require('path');
let auth = require('./auth');

let main_server_socket,//connection to the main_server
    main_server;

let client_id,
    client_auth,
    server_id,
    server_auth;

let key_path = path.join(__dirname,"../keys");//SSL keys file path

const server_port = 8081;

//HTTPS and websocket SSL information.
const server_options = {
    key : fs.readFileSync(path.join(key_path,"/client_key.pem")),
    cert : fs.readFileSync(path.join(key_path, "/client_cert.pem")),
    rejectUnauthorized : false,//we are using a self signed certificate but use a real one if actually used.
};

/**
 * Create the client server
 */
function connect_main_server(port = server_port,options = server_options){
    main_server = tls.createServer(options,(socket)=>{
        if(main_server_socket){//We only connect to a single main server.
            console.log("New connection attempted, rejecting.");
            socket.destroy();
            return;
        }

        main_server_socket = socket;
        main_server_socket.on("error",(err)=>{console.log(err.toString())});
        main_server_socket.on("data",(data)=>{server_update(data)});
    });

    main_server.listen(port);
}

/**
 * Sends an object to the main server if a connection exists.
 * @param data the data to be sent.
 */
function send_main(data){
    if(!main_server_socket){
        console.log("Unable to send data as no server exists");
        return;
    }

    main_server_socket.write(JSON.stringify(data));
}

//handle incoming data from the main_server
function server_update(data){
    let options = JSON.parse(data.toString());
    switch(options.cmd){

        case "INIT":
            init(options);
            return;

        case "TICKETS":
            setup_tickets(options);
            return;
    }
}

/*
server command functions
 */
function init(options){
    client_id = options.client_id;
    server_id = options.server_id;
}

/**
 * removes the given web_client from the connection queue on the main server
 * @param client
 */
function remove_from_queue(web_client){
    send_main({
        cmd : "CONNECTED",
        ip : web_client.connection.ip,
    });
}

/*
Ticket handling
 */

let ticket = require('../tickets/tickets');
let tickets = [];

//initialise tickets

/**
 * setup the ticket module and our tickets array
 * @param options the message object containing the tickets.
 */
function setup_tickets(options){
    ticket.set_tickets(options.tickets);
    tickets = ticket.get_tickets();
    send_free();
}

/**
 * returns a ticket that isn't in use, if none are available returns null.
 * returned ticket is queued
 */
function get_fresh_ticket(){
    for(let ticket of tickets){
        if(!ticket.completed && !ticket.queued){
            ticket.queued = true;
            return ticket;
        }
    }
}

/**
 *Set web_clients status that their ticket is completed.
 */
function complete_ticket(web_client){
    web_client.ticket.completed = true;
    send_main({
        cmd : "COMPLETE_TICKET",
        web_client : web_client
    });
}

/**
 * Send the number of unassigned tickets to the main_server.
 */
function send_free(){
    send_main({
        cmd : "FREE_TICKETS",
        length : ticket.get_free_length(),
    });

}

/*
web_client interaction happens below
 */

let ws = require('ws');

let https_server;
const https_port = 8081;
let web_clients = [];
let client_tokens = [];
let ws_server;
const https_options = {
    key : fs.readFileSync(path.join(key_path,"/https_key.pem")),
    cert : fs.readFileSync(path.join(key_path, "/https_cert.pem")),
};

/*
preloaded HTML form
 */
const __root = path.join(__dirname,"../client");
let ticket_page = fs.readFileSync(path.join(__dirname,"../client/ticket_page.html"));

/**
 * Initialises the HTTPS server and WSS server on the same port.
 * @param port the port for the HTTPs and WSS server
 * @param options arguements for the HTTPS server
 */
function create_server(port = https_port, options = https_options){
    https_server = https.createServer(options,(request,response)=>{Con
        let file_path = request.url;
        if(file_path === "/"){//First connection.
            response.setHeader("content-type","text/html");
            response.end(ticket_page.toString());
        }
        else{
            let file_type = path.extname(file_path);
            switch(file_type){
                case ".js": response.setHeader("content-type","text/javascript"); break;
                case ".css": response.setHeader("content-type","text/CSS"); break;
            }
            fs.readFile(path.join(__root,file_path),(err,data)=>{
                if(err) throw(err);
                response.end(data.toString());
            });

        }
    });

    https_server.listen(https_port);

    /*
    websocket is on the same port as the https and is using secure websockets.
     */

    ws_server = new ws.Server({
        server : https_server,
    });

    ws_server.on('connection',(ws,req)=>{
        add_web_client(ws,req.connection.remoteAddress);
    });

}


function add_web_client(socket,ip){
    if(!main_server_socket){
        console.log("No TLS server exists");
        return;
    }

    let w_client = get_web_client(ip);

    if(w_client) {
        console.log("socket already connected");
        w_client.set_socket(socket);
        return;
    }

    w_client = new web_client(socket,ip);
    web_clients.push(w_client);
    console.log("new client added");

}

/**
 * remove the client and disconnect them
 * @param client the client to be removed.
 */
function remove_web_client(web_client){
    //free up the ticket if not complete
    if(web_client.ticket){
        if(!web_client.ticket.completed){
            ticket.refresh_ticket(web_client.ticket);
        }
    }

    if(!web_client.connection.closed){
        web_client.disconnect();
    }

    let index = web_clients.indexOf(web_client);

    if(index !== -1) web_clients.splice(index,1);

    //tell the main server this client has disconnected and is allowed to reconnect later.
    send_main({
        cmd : "DISCONNECTED",
        ip : web_client.connection.ip,
    })
}

function clear_web_clients(){
    for(let client of web_clients){
        remove_web_client(client);
    }
}

/*
web_client code to ensure one client is connected at once.
Each client is assigned a token unique to their ip, if we get multiple connections from the same IP eg multiple
browser tabs then they will all share the same token and thus will only be able to modify one ticket.
 */


class web_client{
    constructor(socket,ip){

        let {token} = this.connection = {
            token : auth.gen_id(client_tokens),//prevent the client from getting other clients tickets *cough* moonpig *cough*
            ip: ip,
            closed : false,
        };

        client_tokens.push(token);
        this.set_socket(socket);

        send_main({//Alert the main_server that redirection was successful.
            cmd: "CONNECTED",
            ip: ip,
        });

        /*
        Setup our ticket
         */

        let ticket = this.ticket = get_fresh_ticket();
        if(!ticket){
            this.send({
                cmd : "NO_TICKET", // :(
            });
            //redirect to home page
            return;
        }

        send_free();//update main_server on number of free tickets.
        this.send_ticket();
    }

    /**
     * Set the web_socket to send data through.
     */
    set_socket(socket){

        if(this.connection.socket) {
            this.connection.socket.close();
        }

        socket.on("message",(data)=>{
            this.on_data(data.toString());
        });

        socket.on("error",(err)=>{
            console.log(err);
        });

        socket.on("close",()=>{
            this.connection.closed = true;
            remove_web_client(this);
        });

        this.connection.socket = socket;

        remove_from_queue(this);
    }

    /**
     * Disconnect the web_client
     */
    disconnect(){
        this.connection.socket.close();
        this.connection.closed = true;
    }

    /**
     * Handle incoming data from the web_client
     */
    on_data(data){
        let options;

        try {//Check if we actually received correct JSON.
            options = JSON.parse(data);
        }
        catch(error){
            console.log(`Invalid message recieved ${data}`);
            return;
        }

        switch(options.cmd) {
            default :
                console.log("Invalid command received from web client");
                return;

            case "COMPLETE_TICKET":
                this.ticket.info = options.info;
                complete_ticket({
                    ticket : this.ticket,
                    ip : this.connection.ip,
                });
                this.disconnect();//TODO redirect to a seperate webpage
                return;

        }
    }

    /**
     * Send the ticket assigned to this web_client to them.
     */
    send_ticket(){
        this.send({
            cmd : "TICKET",
            ticket : ticket.sanitize_ticket(this.ticket),
        });
    }

    /**
     * Send data to the web_client web socket.
     * @param data
     */
    send(data){
        let socket = this.connection.socket;
        if(!socket){
            console.log("Error no socket exists");
            return;
        }
        socket.send(JSON.stringify(data));
    }
}

/**
 * returns a web_client with matching ip
 * @param ip the ip of the desired web_client.
 */
function get_web_client(ip){
    for(let client of web_clients){
        if(client.connection.ip === ip){
            return client;
        }
    }
}



module.exports = {
    create_server : create_server,
    connect_main_server : connect_main_server,
};

