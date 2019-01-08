"use strict";

let tls = require('tls');
let fs = require('fs');
let path = require('path');
let auth = require('./auth');

const key_path = path.join(__dirname,"../","/keys");

/*
Server handling
 */

const options = {
    key : fs.readFileSync(path.join(key_path,"/main_key.pem")),
    cert : fs.readFileSync(path.join(key_path, "/main_cert.pem")),
};

let server;

function create_server(){
    server = tls.createServer(options,(socket)=>{

    });

    server.on("error",(err) =>{
       console.log(err);
    });

    server.on("data",(data) => client_update(data));


    server.listen(8080);
}

function client_update(data){

}



/*
Client handling
 */

const base_socket = 8081; //client server socket is server_id + base_socket.
const host = "localhost";
let clients = [];
let client_ids = [];
let tickets = [];//each ticket is an id associated with an entry in the SQL database //todo SQL stuff.

//setup the auth secret
auth.load_secret(path.join(key_path,"/secret.txt"));

/**
 * create a client server and add it to the clients.
 * @returns client id.
 */
function connect_client(host,port){
    /*
    in order to ensure we are connecting to a genuine client server and that the client server knows that we are the
    genuine main server we need to share some common info, this will be a hash of the client_id and a piece of shared data,
    this ensures that even if this client server is not genuine it will not be able to "pretend" to be us an connect to
    other client servers using our secret data without direct access to this server.
     */
    let client_id = auth.gen_id(client_ids);

    client_ids.push(client_id);

    let client = new client_server(client_id,host,port);
    clients.push(client);
}

/**
 * Removes a client without disconnecting them.
 * @param id the client id
 */
function remove_client(id){

}

/**
 * disconnects and removes a client.
 * @param id the client id
 */
function disconnect_client(id){

}

/**
 * Sends tickets to all the current client servers.
 * All clients you wish to send these tickets to must be connected before this is called.
 */
function distribute_tickets(){
    if(clients.length === 0){
        console.log("No client servers connected");
    }

    let tickets_per = Math.floor(tickets.length / clients.length);//all excess tickets are given to the first server.
    let current_ticket = 0;

    for(let client of clients){
        client.send_tickets(tickets.slice(current_ticket,current_ticket + tickets_per));
        current_ticket += tickets_per;
    }

    if(current_ticket !== tickets.length){
        clients[0].send_tickets(tickets.slice(current_ticket,tickets.length));
    }
}

/*
Client server class that allows simpler interaction with the client_server
 */
class client_server{
    /**
     * create a new client
     * @param id the id of the client
     * @param port the port the client connection is on
     * @param host the client host
     */
    constructor(id,host,port){
        this.options = {
            ca : [fs.readFileSync(path.join(__dirname,"../keys/client_cert.pem"))],//we are using a self signed cert
            host : host,
            port : port,
            id : id,
        };

        this.auth = {
            auth_code : auth.get_auth(id),
            authorised : false
        };

        this.connect();
    }

    /**
     * Connect to the client.
     */
    connect(){
        let socket = this.socket = tls.connect(this.options,()=>{
            console.log(`connected to client ${this.options.id}`);
        });

        socket.on("data",(data)=>{
            this.update(data);
        });

        socket.on("error",(error)=>{console.log(error)});
    }

    /**
     * Disconnect from the client.
     */
    disconnect(){

    }

    /**
     * handle a client_server update
     * @param data the data sent by the client_server
     */
    update(data){
        let message = JSON.parse(data);
        switch(message.cmd){
            default:
                console.log(`Invalid command received from client ${this.options.id}`);
                return;
            case "AUTH":
                this.authorise(message.data);
                return;
        }
    }

    authorise(code){
        let {auth_code,authorised} = this.auth;

        if(code === auth_code){
            authorised = true;
        }
    }

    send_tickets(){

    }

    send(data){
        if(!this.socket){
            console.log("Cannot send to client, no socket exists");
            return;
        }

        this.socket.send(JSON.stringify(data));
    }


}

/*
Each client is its own server on it's own host, currently that is just this machine so local host, they all
send a connection request to the server via port 8080 and then they are connected to via a separate connection
on a different port.
 */


module.exports = {
    create_server: create_server,
    add_client_server : add_client_server,
    remove_client_server : remove_client_server,
}

