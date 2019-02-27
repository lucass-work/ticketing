"use strict";

let tls = require('tls');
let fs = require('fs');
let path = require('path');
let auth = require('./auth');
let tickets = require('../tickets/tickets');
let util = require('../util/util');


/*
Client handling
 */

let client_connections = [];//list of client_server_connections
let client_ids = [];//list of used client_server id's.

//setup main server auth codes
let server_id = auth.gen_id([]);
client_ids.push(server_id);//so that we dont get conflicts with client ids.

//location of SSL certificates.
let key_path = path.join(__dirname,"../","/keys");

/**
 * Sets the path to locate SSL Certificates.
 * @param path
 */
function set_certificate_path(cert_path){
    key_path = cert_path;
}

/**
 * Connects a client server and adds it to the connection list
 * @host the host of the client
 * @port the port of the client
 * @https_port the https_server port
 * @callback a callback function called when the server is successfully authorised.
 * @returns client id.
 */
function connect_client_server(host,port,https_port,callback){

    let client_id = auth.gen_id(client_ids);

    client_ids.push(client_id);

    let client_connection = new client_server_connection(client_id,host,port,https_port,callback);
    client_connections.push(client_connection);
}

/**
 * Removes a client without disconnecting them.
 * @param id the client id
 */
function disconnect_client(id){
    //remove the client and client id from the lists.
    let index = client_connections.findIndex((el) => {return el.options.id === id});

    if(index === -1){
        return;
    }

    let client = client_connections[index];
    client_connections.splice(index,1);

    for(let i = 0;i < client_ids.length;i++){
        if(client_ids[i] === id){ client_ids.splice(i,1) };
    }
    //get the client to disconnect.
    client.disconnect();
}

/*
Ticket code
 */

/**
 * Sends tickets to all the current client servers.
 * All clients you wish to send these tickets to must be connected before this is called.
 */
function distribute_tickets(){
    if(client_connections.length === 0){
        console.log("No client servers connected");
        return;
    }

    let ticket = tickets.get_tickets();
    let tickets_per = Math.floor(ticket.length / client_connections.length);//all excess tickets are given to the first server.
    let current_ticket = 0;

    for(let client of client_connections){
        client.send_tickets(ticket.slice(current_ticket,current_ticket + tickets_per));
        current_ticket += tickets_per;
    }

    if(current_ticket !== ticket.length){
        client_connections[0].send_tickets(ticket.slice(current_ticket,ticket.length));
    }
}

/**
 * Initializes the main_server ticket information with the given information
 * @param name Name of the ticket
 * @param desc description of the ticket
 * @param cost
 * @param amount amount of tickets to be created.
 */
function init_tickets(name,desc,cost,amount){
    tickets.set_ticket_info(name,desc,cost);
    tickets.generate_tickets(amount);
    /**/
}

/**
 * Initializes tickets from an SQL_database.
 * @param SQL_options
 */
function init_tickets_SQL(SQL_options){
    tickets.set_sql_database(SQL_options,()=>{
        tickets.load_tickets();
    });
}

function complete_ticket(client) {
    if (!client.ticket) {
        console.log("No ticket sent");
        return;
    }
    tickets.set_ticket(client.ticket);
    web_client_completed(client.ip);
}



/*
Handles interaction with an individual client server
 */

class client_server_connection{
    /**
     * create a new client
     * @param id the id of the client
     * @param port the port the client connection is on
     * @param host the client host
     * @param https_port the https_port of the client
     * @param client_pem , client certificate authority. Defaults to "client.pem"
     * @param callback, called when successfully authorised
     */
    constructor(id,host,port,https_port,callback,client_pem="client.pem"){
        this.options = {
            ca : [fs.readFileSync(path.join(key_path,client_pem))],//we are using a self signed cert
            host : host,
            port : port,
            https_port : https_port,
        };

        this.ids = {
            client_id : id,
            server_id : server_id,
        };

        this.free_tickets = 0;

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
     * handle a client_server update
     * @param data the data sent by the client_server
     */
    update(data){
        let message = JSON.parse(data.toString());
        switch(message.cmd){
            default:
                console.log(`Invalid command ${message.cmd} received from client ${this.ids.client_id}`);
                return;

            //web client interactions
            case "CONNECTED":
                web_client_connected(message.ip);
                return;

            case "DISCONNECTED":
                web_client_disconnected(message.ip);
                return;

            case "COMPLETE_TICKET":
                complete_ticket(message.client);
                return;

            case "FREE_TICKETS":
                this.free_tickets = message.length;
                return;

        }
    }

    /*
    ticket code
     */
    send_tickets(tickets){
        this.send({
            cmd : "TICKETS",
            tickets : tickets,
        });
    }

    /*
    End of code for tickets
     */

    send(data){
        if(!this.socket){
            console.log("Cannot send to client, no socket exists");
            return;
        }
        this.socket.write(JSON.stringify(data));
    }
}

/*
Each client_server is it's own server and this main_server distributes incoming ticket requests to each one of the servers based
on the number of tickets still free on that server.
 */

/*
web client handling, handles redirects and interaction from redirect_server.js
 */

let connected = [];//list of currently connected across all servers
let queue = [];//list of currently redirecting connections
let completed = [];//list of connections that have complete the form

/**
 *
 * @param connection
 * @returns {*}
 */
function request_redirect(connection){

    if(completed.includes(connection)){
        //send them back to the homepage
        //TODO add homepage.
        return null;
    }

    if(connected.includes(connection) || queue.includes(connection)){
        return null;//if they've already completed the form , already connected or are connecting then dont allowing them
        //to connect again.
    }

    let chosen_server;
    let most_tickets = 0;

    for(let client_server of client_connections){

        if(client_server.free_tickets > most_tickets || most_tickets < 0){//select the client_server with the most free tickets
            chosen_server = client_server;
            most_tickets = client_server.free_tickets;
        }
    }

    if(!chosen_server){
        console.log("Error, no client chosen for redirect");
        return null;
    }

    queue.push(connection);//prevent the user from connecting multiple times before fully redirected putting
    //them in multiple queues.

    return "https://" + chosen_server.options.host + ":" + chosen_server.options.https_port;
}

/**
 * Move a client from the connection queue to connected.
 * @param ip
 */
function web_client_connected(ip){
    util.remove_item(queue,ip);
    if(!connected.includes(ip)) {
        connected.push(ip);
    }
}


/**
 * moved the client from the connected to the completed.
 * @param ip
 */
function web_client_completed(ip){
    util.remove_item(connected,ip);
    if(!completed.includes(ip)) {
        completed.push(ip);
    }
}

/**
 * remove a web_client from the queue and connected lists.
 * @param ip
 */
function web_client_disconnected(ip){
    util.remove_item(queue,ip);
    util.remove_item(connected,ip);
}

module.exports = {
    connect_client_server : connect_client_server,
    distribute_tickets : distribute_tickets,
    request_redirect : request_redirect,
    init_tickets : init_tickets,
    set_certificate_path : set_certificate_path,
};

