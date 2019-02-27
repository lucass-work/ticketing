"use strict";
let fs = require('fs');
let csprng = require('csprng');
/*
Generates the hash info for our server.
 */

const id_length = 100;

/**
 * Generate a random ID without repetition.
 * @param ids a list of currently used ids
 */
/*
yes I know it's not truly random but we can't have repeated ID's.
 */
function gen_id(ids){
    let id = csprng(id_length,16);
    if(ids.includes(id)){
        return gen_id(ids);
    }
    return id;
}

//TODO add redirect authorisation for web clients.

module.exports = {
    gen_id : gen_id,
};
