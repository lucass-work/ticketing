let list = [];

function set_list(){
    list = [1];
}

function get_list(){
    return list;
}

module.exports = {
    set_list : set_list,
    get_list : get_list,
}