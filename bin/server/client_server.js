"use strict";

/*
The client server which handles tickets and interacts with requests sent by the main server.
 */

let tls = require('tls');
let https = require('https');
let fs = require('fs');
let path = require('path');
let auth = require('./auth');

let server_socket,
    server;

let client_id,
    client_auth,
    server_id,
    server_auth;

let key_path = path.join(__dirname,"../keys");

const server_port = 8081;

let authorised = false;

/*
Setup our auth info
 */
//auth.load_secret(path.join(key_path,"/client_secret.txt")); As we are testing on the same machine we don't need to load again.

const server_options = {
    key : fs.readFileSync(path.join(key_path,"/client_key.pem")),
    cert : fs.readFileSync(path.join(key_path, "/client_cert.pem")),
    rejectUnauthorized : false,//we are using a self signed certificate but use a real one if actually used.
};

/**
 * Create the client server
 */
function create_server(port = server_port,options = server_options){
    server = tls.createServer(options,(socket)=>{
        if(server_socket){//We only connect to a single main server.
            console.log("New connection attempted, rejecting.");
            socket.destroy();
            return;
        }

        server_socket = socket;
        server_socket.on("error",(err)=>{console.log(err.toString())});
        server_socket.on("data",(data)=>{server_update(data)});
    });

    server.listen(port);
}


/**
 * alert the main server that this client server is being closed.
 */
function destroy_server(){
    if(!server){
        return;
    }

    let request = {
        cmd : "DISCONNECT",
        id : client_id
    };

    send(request);
    server.close();
    server = null;
    server_socket = null;
    clear_clients();
    destroy_https_server();
}

/**
 * Sends a data object on the current server_socket if it exists
 * @param data the data to be sent.
 */
function send(data){
    if(!server_socket){
        console.log("Unable to send data as no server exists");
        return;
    }

    server_socket.write(JSON.stringify(data));
}

function server_update(data){
    let options = JSON.parse(data.toString());
    switch(options.cmd){

        case "INIT":
            init(options);
            return;

        case "AUTH":
            authorise(options);
            return;
    }
    /*
    commands that can only be called if we have correctly authorised with the server.
     */
    if(authorised){
        switch(options.cmd){
            case "TICKETS":
                handle_tickets(options);
                return;
        }

    }
}

/*
server command functions
 */

function init(options){
    client_id = options.client_id;
    server_id = options.server_id;
    server_auth = auth.get_auth(server_id,true);
    //now authorise
    send({
        cmd : "AUTH",
        auth_code : auth.get_auth(client_id),
    });
}

//TODO switch to RSA
function authorise(options){
    if(options.auth_code = server_auth){
        authorised = true;
        console.log(`Connection successfully authorised with client:${client_id}, server:${server_id}`);
        send({
            cmd : "AUTH_COMPLETE",
        })
    }
    else{
        console.log(`server ${server_id} connected with an invalid auth_code, disconnecting`);
        server_socket.destroy();
    }
}

/**
 * removes the given client from the connection queue on the main server
 * @param client
 */
function remove_from_queue(client){
    send({
        cmd : "CONNECTED",
        ip : client.connection.ip,
    });
}

/*
Ticket handling
 */

let ticket = require('../tickets/tickets');
let tickets = [];
//init the tickets

/**
 * setup the ticket module and our tickets array
 * @param options the message object containing the tickets.
 */
function handle_tickets(options){
    ticket.set_tickets(options.tickets);
    tickets = ticket.get_tickets();
    send_free();
}

/**
 * returns a free ticket, if none are available returns null.
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

function complete_ticket(ticket){
    ticket.completed = true;

    send({
        cmd : "COMPLETE_TICKET",
        ticket : ticket
    });
}

function send_free(){
    send({
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
function create_https_server(port = https_port, options = https_options){
    https_server = https.createServer(options,(request,response)=>{
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
        add_client(ws,req.connection.remoteAddress);
    });

}

function destroy_https_server(){
    if(https_server){
        https_server.close();
    }
    if(ws_server){
        ws_server.close();
    }

}

function add_client(socket,ip){
    if(!server_socket){
        console.log("No TLS server exists");
        return;
    }

    let client = get_client(ip);

    if(client) {
        console.log("socket already connected");
        client.set_socket(socket);
        return;
    }

    client = new web_client(socket,ip);
    web_clients.push(client);
    console.log("new client added");

}

/**
 * remove the client and disconnect them
 * @param client the client to be removed.
 */
function remove_client(client){
    //free up the ticket if not complete
    if(client.ticket){
        if(!client.ticket.completed){
            ticket.refresh_ticket(client.ticket);
        }
    }

    if(!client.connection.closed){
        client.disconnect();
    }

    let index = web_clients.indexOf(client);

    if(index !== -1) web_clients.splice(index,1);

    //tell the main server this client has disconnected and is allowed to reconnect later.
    send({
        cmd : "DISCONNECTED",
        ip : client.connection.ip,
    })
}

function clear_clients(){
    for(let client of web_clients){
        remove_client(client);
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

        console.log(ip);

        client_tokens.push(token);

        this.set_socket(socket);
        //complete our connection with the main server.
        send({
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

        send_free();

        this.send_ticket();

    }

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
            remove_client(this);
        });

        this.connection.socket = socket;

        remove_from_queue(this);
    }

    disconnect(){
        this.connection.socket.close();
        this.connection.closed = true;
    }

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
                this.ticket.client_info = options.client_info;
                complete_ticket(this.ticket);
                return;

        }
    }

    send_ticket(){
        this.send({
            cmd : "TICKET",
            ticket : ticket.sanitize_ticket(this.ticket),
        });
    }

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
function get_client(ip){
    for(let client of web_clients){
        if(client.connection.ip === ip){
            return client;
        }
    }
}



module.exports = {
    create_server : create_server,
    destroy_server : destroy_server,
    create_https_server : create_https_server,
};

/*
Authorisation works by first establishing connection and sharing the client and server ids.
It allows us to check if a server is attempting to spoof being a client or the main server in order to gain control
over tickets, it does not prevent a compromised server from connecting. It is effectively a password handshake
where the client_id and server_id's are salt.

Would be better to use RSA instead that way the server key isn't compromised if a client is and vice versa.
 */

//TODO add a redirect check , make sure the client can't just directly connect to this page.
/*
Idea is to send a connection token to the client when the main server redirects, this token is unqiue each time it is generated,
this is stored in cookies and then when the connection is made to this server the token is verified with the main server.
If a direct connection is made and no token check is received for 5 seconds then the connection is refused. Just need to implemented it
 */