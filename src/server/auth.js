"use strict";
let csprng = require('csprng');

const id_length = 100;

/**
 * Generate a 'random' ID without repetition of previous ids.
 * @param ids a list of currently used ids
 */
function gen_id(ids){
    let id = csprng(id_length,16);
    if(ids.includes(id)){
        return gen_id(ids);
    }
    return id;
}

/*
Web_client redirect authorisation here
 */



module.exports = {
    gen_id : gen_id,
};
