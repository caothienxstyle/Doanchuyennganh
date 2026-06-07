const bcrypt = require("bcrypt");

const run = async () => {

    console.log(
        await bcrypt.hash("123456", 10)
    );

    console.log(
        await bcrypt.hash("1234567", 10)
    );

};

run();