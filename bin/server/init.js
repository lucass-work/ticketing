"use strict";
/*
File that creates the keys, starts the main_server and client servers etc.
 */


let main_server = require("./main_server");
let client_server = require('./client_server');
let redirect_server = require('./redirect_server');
let tickets = require('../tickets/tickets');

let client = client_server.create_server(8080);

main_server.connect_client("localhost",8080);

redirect_server.create_server();




/*
util functions
 */
/**
 * removes an item equal to item from the array, reduces the index of all following items by 1
 * @param item the item to be removed
 * @return returns the removed item
 */
Array.prototype.remove_item = (item) => {
    let index = this.findIndex(item);
    return index === -1 ? null : this.splice(index,1);
};

/**
 * Attempts to remove every item in the list of items from the array
 * @param items items to be removed
 * @returns {Array} an array containing all items successfully removed.
 */
Array.prototype.remove_items = (items) =>{
    let removed = [];
    for(let item of items){
        let deleted = this.remove_item(item);
        if(deleted){
            removed.push(deleted);
        }
    }
    return removed;
};
