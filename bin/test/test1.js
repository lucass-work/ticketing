let list = require("./test2");

function check(){
    list.set_list();
    console.log(list.get_list());
}

module.exports = {
    check : check,
}