"use strict";

let auth = require('../server/auth');
let util = require('../util/util');
let sql = require('mysql');
/*
Ticket handling code
 */

let tickets = [];//each ticket is an id associated with an entry in the SQL database //todo SQL stuff.
let ticket_ids = [];
let ticket_info = {};
/**
 * Generate the list of tickets.
 * @param ticket_info an object that has all information that will be put into each ticket.
 * @param amount the number of tickets to produce.
 */

function generate_tickets(amount){
    tickets = [];

    for(let i = 0;i < amount;i++){
        let ticket = new_ticket();
        tickets.push(ticket);
        ticket_ids.push(ticket.ticket_id);
    }
}

/**
 * Generates a new empty ticket, does not add it to tickets or ticket_ids
 */
function new_ticket(){
    return {
        ...ticket_info,
        ticket_id : auth.gen_id(ticket_ids),
        token : undefined,
        completed : false,
        client_name : "",
        client_gender : 'N',
    }
}

/**
 * Should be called before sending a ticket to ensure that as little backend info as possible is sent
 */
function sanitize_ticket(ticket){
    return {
        ...ticket_info,
        ticket_id : ticket.ticket_id,
        completed: false,
    };
}

/**
 * returns an uncompleted ticket
 * @returns {*}
 */
function get_fresh_ticket(){
    for(let ticket of tickets){
        if(!ticket.completed){
            return ticket;
        }
    }
}

/**
 * Refresh a ticket to prevent it from being spoofed by a client
 */
function refresh_ticket(ticket){
    util.remove_item(ticket_ids,ticket.ticket_id);
    let old_id = ticket.ticket_id;
    ticket.ticket_id = auth.gen_id(ticket_ids);
    ticket.token = undefined;
    //now update the SQL database
    set_ticket(ticket,old_id);

    return ticket;
}

/**
 * Set the global ticket info, must be set before generating a batch of tickets
 * @param name
 * @param desc
 * @param cost
 */
function set_ticket_info(name,desc, cost){
    ticket_info = {
        name : name,
        desc : desc,
        price : cost,
    }
}

/**
 * set the current ticket data, does not set ticket info
 * @param ticket
 */
function set_tickets(ticket){
    tickets = ticket;
    ticket_ids = [];
    for(let t of ticket){
        ticket_ids.push(t.ticket_id);
    }
}

/**
 * Get a copy of tickets.
 */
function get_tickets() {
    return tickets.slice();
}

/*
SQL handling, client_servers don't use this so the below code is mainly used for setting the tickets array and
keeping the SQL database, if it exists , up to date.
 */
/*
For testing im using
{
    host: "localhost",
    user: "root",
    password: "password",
    database: "ticketdb",
}
 */

let database;
let table;

/**
 * Set the SQL database for the tickets
 * @param options
 * @param callback called once the connection is established
 * @param tab the table we will be accessing, defaults to tickets
 */
function set_sql_database(options,callback = () => {},tab = "tickets"){
    database = sql.createConnection(options);
    database.connect((err) => {
        console.log(err ? err : "connected to SQL database");
        table = tab;
        callback();
    });
}

/**
 * Load the ticket info from the SQL database
 * @param callback called once the tickets are successfully loaded.
 */
function load_tickets(callback = () => {}){
    if(!database){
        console.log("Cannot load tickets no database setup");
        return;
    }

    let tickets = [];
    database.query(`SELECT * FROM ${table}`,(err,results,values)=>{
        if(!results){
            console.log(`could not load tickets from ${table}`);
            return;
        }
        for(let result of results){
            let ticket = new_ticket();
            ticket.completed = result.completed;
            ticket.ticket_id = result.ticket_id;
            ticket.client_name = result.client_name;
            ticket.client_gender = result.client_gender;
            tickets.push(ticket);
        }
    });

    set_tickets(tickets);

}

function set_ticket(ticket,ticket_id) {
    if (!database) {
        console.log("Cannot set tickets no database setup");
        return;
    }

    database.query(`
    UPDATE ${table} 
    client_name = ${ticket.client_name} 
    client_gender = ${ticket.client_gender} 
    ticket_id = ${ticket.ticket_id} 
    completed = ${ticket.completed}
    WHERE ticket_id = ${ticket_id}`
        , (err, results, values) => {});


}

module.exports = {
    generate_tickets : generate_tickets,
    get_tickets : get_tickets,
    set_ticket_info : set_ticket_info,
    sanitize_ticket : sanitize_ticket,
    get_fresh_ticket : get_fresh_ticket,
    refresh_ticket : refresh_ticket,
    set_tickets : set_tickets,
    set_sql_database : set_sql_database,
    load_tickets : load_tickets,

};
