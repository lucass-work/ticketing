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

let client_id,server_id

let key_path = path.join(__dirname,"../keys");//SSL keys file path

//HTTPS and websocket SSL information.
let server_options;

function set_certificate_path(cert_path){
    //Set the Certificate path and update the server_options.
    key_path = cert_path;
    server_options = {
        key : fs.readFileSync(path.join(key_path,"/client_key.pem")),
        cert : fs.readFileSync(path.join(key_path, "/client_cert.pem")),
    };
}

/**
 * Set the client_server and https_server server options. should not include port information.
 * Requires SSL Key and Certificate.
 * @param options
 */
function set_options(options){
    server_options = options;
}

/**
 * Create the client server
 * @param port, the TLS port
 * @param options , the server options.
 */
function create_client_server(port,options = server_options){
    //Load default options if none are specified.
    if(!options){
        options = {
            key : fs.readFileSync(path.join(key_path,"/client_key.pem")),
            cert : fs.readFileSync(path.join(key_path, "/client_cert.pem")),
        };
    }

    let on_connection = (socket) =>{
        //Reject a main_server connection if one already exists.
        if(main_server_socket){
            console.log("New connection attempted, rejecting.");
            socket.destroy();
            return;
        }

        //Setup connection event functions
        main_server_socket = socket;
        main_server_socket.on("error",(err)=>{console.log(err.toString())});
        main_server_socket.on("data",(data)=>{server_update(data)});
    };

    //Create the main_server
    main_server = tls.createServer(options,on_connection);
    main_server.listen(port);
}

/**
 * Sends an object to the main server if a connection exists.
 * @param data the data to be sent.
 */
function send_main(data){
    //Check that a a connection to the server exists.
    if(!main_server_socket){
        console.log("Unable to send data as no server exists");
        return;
    }

    main_server_socket.write(JSON.stringify(data));
}

//Handle incoming data from the main_server
function server_update(data){
    let options = JSON.parse(data.toString());

    //Execute the requested command.
    switch(options.cmd){
        case "INIT":
            init(options);
            return;

        case "TICKETS":
            setup_tickets(options);
            return;

        default:
            console.log(`Invalid command ${options.cmd} send to client server ${client_id}.`);
    }
}

/*
server command functions
 */
//Set the client and main server id's.
function init(options){
    client_id = options.client_id;
    server_id = options.server_id;
}

/**
 * Removes the given web_client from the connection queue on the main server
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

/**
 * Setup the ticket module and our tickets array
 * @param options the message object containing the tickets.
 */
function setup_tickets(options){
    ticket.set_tickets(options.tickets);
    tickets = ticket.get_tickets();
    send_free();
}

/**
 * Returns a ticket that isn't in use, if none are available returns null.
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
web_client interaction
 */

let ws = require('ws');

let https_server;
let web_clients = [];
let client_tokens = [];
let ws_server;

//Create the default HTTPS_server options
const https_options = {
    key : fs.readFileSync(path.join(key_path,"/https_key.pem")),
    cert : fs.readFileSync(path.join(key_path, "/https_cert.pem")),
};

//Load the ticket_page.
const __root = path.join(__dirname,"../client");
let ticket_page = fs.readFileSync(path.join(__dirname,"../client/ticket_page.html"));

/*
web_client https/wss server
 */

/**
 * Initialises the HTTPS server and WSS server on the same port.
 * @param port the port for the HTTPs and WSS server
 * @param options arguements for the HTTPS server
 */
function create_https_server(port = 8081, options = https_options){
    let on_request = (request,response) => {
        let file_path = request.url;

        //show page for "/" path
        if (file_path === "/") {
            response.setHeader("content-type", "text/html");
            response.end(ticket_page.toString());
            return;
        }

        //Handle content headers for Js and CSS
        let file_type = path.extname(file_path);
        switch (file_type) {
            case ".js":
                response.setHeader("content-type", "text/javascript");
                break;

            case ".css":
                response.setHeader("content-type", "text/CSS");
                break;
        }

        //Read the requested file and send it as a response.
        fs.readFile(path.join(__root, file_path), (err, data) => {
            if (err) throw(err);
            response.end(data.toString());
        });
    };

    //Create the https server.
    https_server = https.createServer(options,on_request);
    https_server.listen(https_port);

    //Create a secure websocket server on the same port as the https server.
    ws_server = new ws.Server({
        server : https_server,
    });

    ws_server.on('connection',(ws,req)=>{
        add_web_client(ws,req.connection.remoteAddress);
    });
}

/**
 * Add a web_client to the list of connections.
 * @param socket
 * @param ip
 */
function add_web_client(socket,ip){
    //Check if a main_server connection exists
    if(!main_server_socket){
        console.log("No TLS server exists");
        return;
    }

    let w_client = get_web_client(ip);

    //Check if the client already connected.
    if(w_client) {
        console.log("socket already connected");
        w_client.set_socket(socket);
        return;
    }

    //Create the client
    w_client = new web_client(socket,ip);
    web_clients.push(w_client);
}

/**
 * remove the client and disconnect them
 * @param web_client the client to be removed.
 */
function remove_web_client(web_client){
    //Refresh the clients ticket if not completed.
    if(web_client.ticket){
        if(!web_client.ticket.completed){
            ticket.refresh_ticket(web_client.ticket);
        }
    }

    if(!web_client.connection.closed){
        web_client.disconnect();
    }

    //Remove the client from the list of connected clients.
    let index = web_clients.indexOf(web_client);

    if(index !== -1){
        web_clients.splice(index,1);
    }

    //Alert the main server that the client has disconnected.
    send_main({
        cmd : "DISCONNECTED",
        ip : web_client.connection.ip,
    })
}

/**
 * Disconnect all web_clients.
 */
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
            token : auth.gen_id(client_tokens),
            ip: ip,
            closed : false,
        };

        //Setup the websocket connection
        this.set_socket(socket);

        //Alert the main server that redirection was successful.
        send_main({
            cmd: "CONNECTED",
            ip: ip,
        });

        //Get an unassigned ticket and send it to the web_client
        let ticket = this.ticket = get_fresh_ticket();

        if(!ticket){
            this.send({
                cmd : "NO_TICKET",
            });
            return;
        }

        this.send_ticket();

        //Alert the main server that a ticket was assigned.
        send_free();

        //TODO implement token authorisation.
        client_tokens.push(token);
    }

    /**
     * Set the web_socket to send data through.
     */
    set_socket(socket){

        //If this socket already exists close it.
        if(this.connection.socket) {
            this.connection.socket.close();
        }

        //Initialize socket events
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

        //Remove this web_client from the main_server connection_queue.
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

        //Check for correctly formatted JSON
        try {
            options = JSON.parse(data);
        }catch(error){
            console.log(`Invalid message recieved ${data}`);
            return;
        }

        //Execute the command request by the web_client.
        switch(options.cmd) {
            default:
                console.log("Invalid command received from web client");
                return;

            case "COMPLETE_TICKET":
                this.complete_ticket();
                return;

        }
    }

    /**
     * Handle a completed ticket from a web_client.
     */
    complete_ticket(){
        //Store the completed tickets information.
        this.ticket.info = options.info;
        complete_ticket({
            ticket : this.ticket,
            ip : this.connection.ip,
        });

        //TODO redirect to home page.
        this.disconnect();
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
    create_client_server : create_client_server,
    create_https_server : create_https_server,
    set_options : set_options,
    set_certificate_path : set_certificate_path,
};

