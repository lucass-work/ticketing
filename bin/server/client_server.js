"use strict";

/*
client server that handles tickets.

Client server connects to the main server by tls and has a set number of tickets shared with it, this server
then handles all info with the tickets until the info is complete then access' the main server with
 */

let tls = require('tls');
let https = require('https');
let fs = require('fs');


    constructor(id,port,host){
        this.options = {
            ca : [fs.readFileSync(path.join(__dirname,"../keys/main_cert.pem"))],//we are using a self signed cert
            host : host,
            port : port,
            id : id
        };

        this.connect();
    }

    /**
     * Connect to the main server
     */
    connect(){
        let socket = this.socket = tls.connect(this.options,()=>{
            console.log(`client ${this.options.id} connected`);
        });

        socket.on("data",(data)=>{
            this.server_update(data);
        });

        socket
    }

    /**
     * handle a server update
     * @param data the data sent by the server
     */
    server_update(data){

    }


}

module.exports = {
    client_server : client_server,
}