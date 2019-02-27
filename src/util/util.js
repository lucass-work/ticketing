"use strict";

/*
Util methods
 */

/**
 * Remove an item from an array
 * @param array
 * @param item
 * @returns {number} the index;
 */
function remove_item(array,item){
    let index = -1;
    for(let i = 0 ; i < array.length;i++){
        if(array[i] === item){
            index = i;
            break;
        }
    }
    if(index !== -1) array.splice(index,1);
    return index;
}

/**
 * Remove multiple items from an array
 * @param array
 * @param items
 * @returns {array} the list of successfully removed items.
 */
function remove_items(array,items){
    let removed_items = [];
    for(let item of items){
        let index = remove_item(array,item);
        if(index !== -1){
            removed_items.push(item);
        }
    }
    return removed_items;
}



module.exports = {
    remove_item : remove_item,
    remove_items : remove_items,
}