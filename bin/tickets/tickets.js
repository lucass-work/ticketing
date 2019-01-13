"use strict";

let auth = require('../server/auth');
let util = require('../util/util');
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
        let ticket = {
            ticket_id : auth.gen_id(ticket_ids),
            token : undefined,
            completed : false,
            SQL_id : i,//MUST be removed before the ticket is sent.
        };
        tickets.push(ticket);
        ticket_ids.push(ticket.ticket_id);
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
 * Refresh a ticket to prevent it from being spoofed by a client
 */
function refresh_ticket(ticket){
    util.remove_item(ticket_ids,ticket.ticket_id);
    ticket.ticket_id = auth.gen_id(ticket_ids);
    ticket.token = undefined;
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
        cost : cost,
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

module.exports = {
    generate_tickets : generate_tickets,
    get_tickets : get_tickets,
    set_ticket_info : set_ticket_info,
    sanitize_ticket : sanitize_ticket,
    refresh_ticket : refresh_ticket,
    set_tickets : set_tickets,
}
