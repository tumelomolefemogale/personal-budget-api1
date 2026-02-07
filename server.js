/*const express = require('express');
const app = express();
const pool = require('./database-connect');
const PORT = 3000;

app.use(express.json());

// Store envelopes
let envelopes = [];
let nextId = 0;

// Create envelopes
app.post('/envelopes', (req, res) => {
    const { title, budget } = req.body;

    if (!title || !budget) {
        return res.status(400).send("Title and budget are required.");
    }

    const newEnvelope = {id: nextId++, title, budget};
    envelopes.push(newEnvelope);

    res.status(201).json(newEnvelope);
});

// Retrieve all envelopes
app.get('/envelopes', (req, res) => {
    res.json(envelopes);
});

// Transfer money between envelopes
app.post('/envelopes/transfer/:from/:to', (req, res) => {
    const fromId = Number(req.params.from);
    const toId = Number(req.params.to);
    const { amount } = req.body;

    if (!amount || amount <= 0) {
        return res.status(400).send("Transfer amount must be greater than 0.");
    }

    const fromEnvelope = envelopes.find(env => env.id === fromId);
    const toEnvelope = envelopes.find(env => env.id === toId);

    if (!fromEnvelope || !toEnvelope) {
        return res.status(404).send("One or both envelopes not found.");
    }

    if (fromEnvelope.budget < amount) {
        return res.status(400).send("Not enough budget to transfer.");
    }

    fromEnvelope.budget -= amount;
    toEnvelope.budget += amount;

    res.json({
        message: "Transfer successful",
        from: fromEnvelope,
        to: toEnvelope
    })
});

// Retrieve specific envelopes
app.get('/envelopes/:id', (req, res) => {
    const id = Number(req.params.id);
    const envelope = envelopes.find(env => env.id === id);

    if (!envelope) {
        res.status(404).send("Envelope not found.");
    }

    res.json(envelope);
});

// Update specific envelopes
app.put('/envelopes/:id', (req, res) => {
    const id = Number(req.params.id);
    const envelope = envelopes.find(env => env.id === id);

    if (!envelope) {
        res.status(404).send("Envelope not found.");
    }

    const { title, withdrawal } = req.body;

    if (title) {
        envelope.title = title;
    }

    if (withdrawal) {
        if (withdrawal > envelope.budget) {
            res.status(400).send("You have insufficient funds.");
        }

        envelope.budget -= withdrawal
    }

    res.json(envelope)
});

// Delete specific envelopes
app.delete('/envelopes/:id', (req, res) => {
    const id = Number(req.params.id);
    const envelope = envelopes.find(env => env.id === id);

    if (!envelope) {
        return res.status(404).send("Envelope not found.");
    }

    envelopes = envelopes.filter(env => env.id !== id);

    res.send(`Envelope with ID ${id} deleted successfully.`);
});

app.listen(PORT, () => {
    console.log(`Listening on port ${PORT}.`);
});*/

const express = require('express');
const app = express();
const pool = require('./database-connect'); // database connection
const PORT = 3000;

app.use(express.json());

// Create a new envelope
app.post('/envelopes', async (req, res) => {
    const { title, budget } = req.body;

    if (!title || !budget) {
        return res.status(400).send("Title and budget are required.");
    }

    try {
        const result = await pool.query(
            'INSERT INTO envelopes (title, budget) VALUES ($1, $2) RETURNING *',
            [title, budget]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).send("Server error");
    }
});

// Get all envelopes
app.get('/envelopes', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM envelopes');
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).send("Server error");
    }
});

// Transfer money between envelopes
app.post('/envelopes/transfer/:from/:to', async (req, res) => {
    const fromId = Number(req.params.from);
    const toId = Number(req.params.to);
    const { amount } = req.body;

    if (!amount || amount <= 0) {
        return res.status(400).send("Transfer amount must be greater than 0.");
    }

    try {
        const fromRes = await pool.query('SELECT * FROM envelopes WHERE id=$1', [fromId]);
        const toRes = await pool.query('SELECT * FROM envelopes WHERE id=$1', [toId]);

        const fromEnvelope = fromRes.rows[0];
        const toEnvelope = toRes.rows[0];

        if (!fromEnvelope || !toEnvelope) {
            return res.status(404).send("One or both envelopes not found.");
        }

        if (fromEnvelope.budget < amount) {
            return res.status(400).send("Not enough budget to transfer.");
        }

        await pool.query('UPDATE envelopes SET budget=$1 WHERE id=$2', [fromEnvelope.budget - amount, fromId]);
        await pool.query('UPDATE envelopes SET budget=$1 WHERE id=$2', [toEnvelope.budget + amount, toId]);

        res.json({
            message: "Transfer successful",
            from: { ...fromEnvelope, budget: fromEnvelope.budget - amount },
            to: { ...toEnvelope, budget: toEnvelope.budget + amount }
        });
    } catch (err) {
        console.error(err);
        res.status(500).send("Server error");
    }
});

// Get a specific envelope
app.get('/envelopes/:id', async (req, res) => {
    const id = Number(req.params.id);

    try {
        const result = await pool.query('SELECT * FROM envelopes WHERE id=$1', [id]);
        const envelope = result.rows[0];

        if (!envelope) {
            return res.status(404).send("Envelope not found.");
        }

        res.json(envelope);
    } catch (err) {
        console.error(err);
        res.status(500).send("Server error");
    }
});

// Update a specific envelope
app.put('/envelopes/:id', async (req, res) => {
    const id = Number(req.params.id);
    const { title, withdrawal } = req.body;

    try {
        const result = await pool.query('SELECT * FROM envelopes WHERE id=$1', [id]);
        const envelope = result.rows[0];

        if (!envelope) {
            return res.status(404).send("Envelope not found.");
        }

        let newBudget = envelope.budget;
        if (withdrawal) {
            if (withdrawal > newBudget) {
                return res.status(400).send("Insufficient funds.");
            }
            newBudget -= withdrawal;
        }

        const newTitle = title || envelope.title;

        const updated = await pool.query(
            'UPDATE envelopes SET title=$1, budget=$2 WHERE id=$3 RETURNING *',
            [newTitle, newBudget, id]
        );

        res.json(updated.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).send("Server error");
    }
});

// Delete a specific envelope
app.delete('/envelopes/:id', async (req, res) => {
    const id = Number(req.params.id);

    try {
        const result = await pool.query('SELECT * FROM envelopes WHERE id=$1', [id]);
        const envelope = result.rows[0];

        if (!envelope) {
            return res.status(404).send("Envelope not found.");
        }

        await pool.query('DELETE FROM envelopes WHERE id=$1', [id]);
        res.send(`Envelope with ID ${id} deleted successfully.`);
    } catch (err) {
        console.error(err);
        res.status(500).send("Server error");
    }
});

// Start server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

