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
let client_id = -1;
let key_path = path.join(__dirname,"../keys");
const port = 8081;

const server_options = {
    key : fs.readFileSync(path.join(key_path,"/client_key.pem")),
    cert : fs.readFileSync(path.join(key_path, "/client_cert.pem")),
};

/**
 * Create the client server
 */
function create_server(){
    server = tls.createServer(server_options,(socket)=>{
        server_socket = socket;
    });

    server_socket.on("error",(err)=>{console.log(err.toString())});

    server_socket.on("data",(data)=>{server_update(data)});

    server_socket.listen(port);
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

    server_socket.send(JSON.stringify(data));
}

function server_update(data){
    let options = JSON.parse(data);

    switch(options.cmd){
        default:
            console.log(`invalid command on client ${client_id} server_update`);
            return;
        case "INIT":
            client_id = options.id;
            //now authorise

            return;
        case "TICKET":
            return;
    }
}


module.exports = {

};