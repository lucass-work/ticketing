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
        default:
            console.log(`invalid command on client ${client_id} server_update`);
            return;

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

function authorise(options){
    if(options.auth_code = server_auth){
        authorised = true;
        console.log(`Connection successfully authorised with client:${client_id}, server:${server_id}`);
    }
    else{
        console.log(`server ${server_id} connected with an invalid auth_code, disconnecting`);
        server_socket.destroy();
    }
}

let tickets = [];

function handle_tickets(options){
    tickets = options.tickets;
}

/*
All the https stuff is below
 */







module.exports = {
    create_server : create_server,
    destroy_server : destroy_server,
};

/*
Authorisation works by first establishing connection and sharing the client and server ids.
It allows us to check if a server is attempting to spoof being a client or the main server in order to gain control
over tickets, it does not prevent a compromised server from connecting. It is effectively a password handshake
where the client_id and server_id's are salt.
 */