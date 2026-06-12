const sql = require("mssql");

const config = {
    // server: "host.docker.internal",
    server: "localhost",
    port: 1435,
    user: "sa",
    password: "Nhatthang@0901",
    database: "DbQLK",
    options: {
        encrypt: false,
        trustServerCertificate: true
    }
};

// Tạo pool một lần, dùng lại toàn app
const poolPromise = new sql.ConnectionPool(config)
    .connect()
    .then(pool => {
        console.log("Connected SQL Server");
        return pool;
    })
    .catch(err => {
        console.log("Lỗi kết nối:", err);
        process.exit(1);
    });

module.exports = { sql, poolPromise };