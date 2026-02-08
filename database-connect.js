require('dotenv').config();
const { Pool } = require('pg');

// configure the database connection
const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

// test the connection
pool.query('SELECT NOW()', (err, res) => {
    if (err) {
        console.error(err);
    } else {
        console.log('Database connected successfully:', res.rows[0]);
    }
})

// export the pool
module.exports = pool;