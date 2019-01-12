"use strict";

let auth = require('../server/auth');
/*
Ticket handling code
 */

let tickets;//each ticket is an id associated with an entry in the SQL database //todo SQL stuff.
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
            ...ticket_info,
            ticket_id : auth.gen_id(tickets),
            token : null,
            completed : false,
    };
        tickets.push(ticket);
    }
}

function set_ticket_info(name, cost){
    ticket_info = {
        name : name,
        cost : cost,
    }
}

function get_tickets() {
    return tickets.slice();
}

module.exports = {
    generate_tickets : generate_tickets,
    get_tickets : get_tickets,
    set_ticket_info : set_ticket_info,
}
