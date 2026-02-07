const { Pool } = require('pg');

// configure the database connection
const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'personal_budget',
    password: 'Tmolefe.m@20010831',
    port: 5432
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