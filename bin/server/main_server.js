"use strict";

let tls = require('tls');
let fs = require('fs');
let path = require('path');
let auth = require('./auth');
let tickets = require('../tickets/tickets');

const key_path = path.join(__dirname,"../","/keys");
/*
Client handling
 */

const base_socket = 8081; //client server socket is server_id + base_socket.
const host = "localhost";
let clients = [];
let client_ids = [];

//setup the auth secret
auth.load_secrets(path.join(key_path,"/client_secret.txt"),path.join(key_path,"/server_secret.txt"));
//setup main server auth codes
let server_id = auth.gen_id([]);
client_ids.push(server_id);//so that we dont get conflicts with client ids.
let server_auth = auth.get_auth(server_id,true);

/**
 * create a client server and add it to the clients.
 * @returns client id.
 */
function connect_client(host,port,https_port){

    let client_id = auth.gen_id(client_ids);

    client_ids.push(client_id);

    let client = new client_server(client_id,host,port,https_port);
    clients.push(client);
}

/**
 * Removes a client without disconnecting them.
 * @param id the client id
 */
function disconnect_client(id){
    //remove the client and client id from the lists.
    let index = clients.findIndex((el) => {return el.options.id === id});

    if(index === -1){
        return;
    }

    let client = clients[index];
    clients.splice(index,1);

    for(let i = 0;i < client_ids.length;i++){
        if(client_ids[i] === id){ client_ids.splice(i,1) };
    }
    //get the client to disconnect.
    client.disconnect();
}

/**
 * returns all current client servers
 * @returns {*[]}
 */
function get_clients(){
    return clients.slice();
}

/**
 * Sends tickets to all the current client servers.
 * All clients you wish to send these tickets to must be connected before this is called.
 */
function distribute_tickets(){
    if(clients.length === 0){
        console.log("No client servers connected");
    }
    let tickets = tickets.get_tickets();
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
     * @param https_port the https_port of the client
     */
    constructor(id,host,port,https_port){
        this.options = {
            ca : [fs.readFileSync(path.join(__dirname,"../keys/client_cert.pem"))],//we are using a self signed cert
            host : host,
            port : port,
            https_port : https_port,
        };

        this.ids = {
            client_id : id,
            server_id : server_id,
        };

        this.auth = {
            auth_code : auth.get_auth(id),
            authorised : false
        };

        this.client_data = {
            queue_length : 0,
            tickets_remaining : 0,
        };

        this.connect();
    }

    /**
     * Connect to the client.
     */
    connect(){
        let socket = this.socket = tls.connect(this.options,()=>{});

        let request = this.ids;

        //once successfully connected send over the INIT request to start authorisation check.
        socket.on("secureConnect",()=>{
           this.send({
               cmd : "INIT",
               ...request,
           });
        });

        socket.on("data",(data)=>{
            this.update(data);
        });

        socket.on("error",(error)=>{console.log(error)});
    }

    /**
     * destroy this client
     */
    destroy(){
        if(this.socket){
            this.socket.destroy();
            this.socket = null;
        }
    }

    /**
     * handle a client_server update
     * @param data the data sent by the client_server
     */
    update(data){
        let message = JSON.parse(data.toString());
        switch(message.cmd){
            default:
                console.log(`Invalid command ${message.cmd} received from client ${this.ids.client_id}`);
                return;

            case "AUTH":
                this.authorise(message.auth_code);
                return;

            case "SYNC":
                this.sync(message);
                return;

            case "CONNECTION":
                this.ticket_connection(message);
                return;
        }
    }

    /*code for handling the ticket events

     */

    /**
     * sync stored info with serverside info.
     * @param data data to be synced.
     */
    sync(data){
        this.client_data = data;
    }

    /**
     * add one or more connections to the list of currently connected.
     * @param data a list of mac address'
     */
    ticket_connection(data){
        connected_macs.push(data.mac);
        queued_macs.remove_item(data.mac);
    }

    /**
     * remove one or more connections from the list of currently connected
     * @param data a list of mac address'
     */
    ticket_disconnection(data){
        connected_macs.remove_item(data.mac);
    }

    ticket_completed(data){
        completed_macs.push(data.mac);
        connected_macs.remove_item(data.mac);
    }

    send_tickets(tickets){
        this.send({
            cmd : "TICKETS",
            tickets : tickets,
        });
    }

    /*
    End of code for tickets
     */

    /**
     * Check if the given code matches the auth code for this client.
     * @param code
     */
    authorise(code){
        let {auth_code,authorised} = this.auth;
        if(code === auth_code){
            authorised = true;
            this.send({
                cmd : "AUTH",
                auth_code : server_auth,
            })
        }

        else{
            console.log(`Unauthorised client ${this.ids.client_id} attempted to connect`);
            this.send({ cmd : "DISCONNECT" });
            this.socket.destroy();
        }
    }


    send(data){
        if(!this.socket){
            console.log("Cannot send to client, no socket exists");
            return;
        }
        this.socket.write(JSON.stringify(data));
    }
}

/*
Each client is it's own server and this main_server distributes incoming ticket requests to each one of the servers based
on the number of tickets still free on that server.
 */

/*
Connection handling, this handles redirects and ensures people currently viewing a ticket page can't reconnect and
get another ticket at the same or get more than 1 ticket.
 */

let connected_macs = [];//list of currently connected across all servers
let queued_macs = [];//list of currently redirecting connections
let completed_macs = [];//list of connections that have complete the form

/**
 *
 * @param connection
 * @returns {*}
 */
function request_redirect(connection){

    if(connected_macs.includes(connection) || queued_macs.includes(connection) || completed_macs.includes(connection)){
        return null;//if they've already completed the form , already connected or are connecting then dont allowing them
        //to connect again.
    }

    let chosen_client;
    let shortest_queue = -1;

    for(let client of clients){
        if(client.client_data.queue_length < shortest_queue || shortest_queue < 0){
            chosen_client = client;
            shortest_queue = client.client_data.queue_length;
        }
    }

    if(!chosen_client){
        console.log("Error, no client chosen for redirect");
        return null;
    }

    //queued_macs.push(connection);//prevent the user from connecting multiple times before fully redirected putting
    //them in multiple queues.

    return "https://" + chosen_client.options.host + ":" + chosen_client.options.https_port;
}

module.exports = {
    connect_client : connect_client,
    disconnect_client: disconnect_client,
    distribute_tickets : distribute_tickets,
    request_redirect : request_redirect,
    get_clients : get_clients,

};

