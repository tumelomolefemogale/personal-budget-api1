const express = require('express');
const app = express();
const swaggerUi = require('swagger-ui-express');
const setupSwagger = require('./swagger');
const fs = require('fs');
const yaml = require('yaml');
const pool = require('./database-connect');
const PORT = 3000;

app.use(express.json());
setupSwagger(app);

const file = fs.readFileSync('./swagger.yaml', 'utf8');
const swaggerDocument = yaml.parse(file);

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// ENVELOPES
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

// TRANSACTIONS
// CREATE a new transaction
app.post('/transactions', async (req, res) => {
    const { envelope_id, amount, recipient } = req.body;
    if (!envelope_id || !amount || !recipient) return res.status(400).send("Missing required fields");

    try {
        const envelopeResult = await pool.query('SELECT * FROM envelopes WHERE id=$1', [envelope_id]);
        const envelope = envelopeResult.rows[0];
        if (!envelope) return res.status(404).send("Envelope not found");
        if (envelope.budget < amount) return res.status(400).send("Insufficient funds in envelope");

        const updatedBudget = envelope.budget - amount;
        await pool.query('UPDATE envelopes SET budget=$1 WHERE id=$2', [updatedBudget, envelope_id]);

        const transactionResult = await pool.query(
            'INSERT INTO transactions (envelope_id, amount, recipient) VALUES ($1, $2, $3) RETURNING *',
            [envelope_id, amount, recipient]
        );

        res.status(201).json({
            transaction: transactionResult.rows[0],
            envelope: { ...envelope, budget: updatedBudget }
        });
    } catch (err) { res.status(500).send("Server error"); }
});

// GET all transactions
app.get('/transactions', async (req, res) => {
    try {
        const allTransactionsResult = await pool.query(
            `SELECT t.id, t.envelope_id, e.title AS envelope_title, t.amount, t.recipient, t.date
             FROM transactions t JOIN envelopes e ON t.envelope_id = e.id ORDER BY t.date DESC`
        );
        res.json(allTransactionsResult.rows);
    } catch (err) { res.status(500).send("Server error"); }
});

// GET a specific transaction
app.get('/transactions/:id', async (req, res) => {
    const transactionId = Number(req.params.id);
    try {
        const transactionResult = await pool.query(
            `SELECT t.id, t.envelope_id, e.title AS envelope_title, t.amount, t.recipient, t.date
             FROM transactions t JOIN envelopes e ON t.envelope_id = e.id WHERE t.id=$1`,
            [transactionId]
        );
        if (!transactionResult.rows[0]) return res.status(404).send("Transaction not found");
        res.json(transactionResult.rows[0]);
    } catch (err) { res.status(500).send("Server error"); }
});

// UPDATE a transaction
app.put('/transactions/:id', async (req, res) => {
    const transactionId = Number(req.params.id);
    const { amount: newAmount, recipient: newRecipient } = req.body;

    try {
        const transactionResult = await pool.query('SELECT * FROM transactions WHERE id=$1', [transactionId]);
        const transaction = transactionResult.rows[0];
        if (!transaction) return res.status(404).send("Transaction not found");

        const envelopeResult = await pool.query('SELECT * FROM envelopes WHERE id=$1', [transaction.envelope_id]);
        const envelope = envelopeResult.rows[0];

        let adjustedBudget = envelope.budget + transaction.amount; // refund old amount
        if (newAmount && newAmount > adjustedBudget) return res.status(400).send("Insufficient funds in envelope");
        if (newAmount) adjustedBudget -= newAmount;

        await pool.query('UPDATE envelopes SET budget=$1 WHERE id=$2', [adjustedBudget, envelope.id]);

        const updatedTransactionResult = await pool.query(
            'UPDATE transactions SET amount=$1, recipient=$2 WHERE id=$3 RETURNING *',
            [newAmount || transaction.amount, newRecipient || transaction.recipient, transactionId]
        );

        res.json({ transaction: updatedTransactionResult.rows[0], envelope: { ...envelope, budget: adjustedBudget } });
    } catch (err) { res.status(500).send("Server error"); }
});

// DELETE a transaction
app.delete('/transactions/:id', async (req, res) => {
    const transactionId = Number(req.params.id);

    try {
        const transactionResult = await pool.query('SELECT * FROM transactions WHERE id=$1', [transactionId]);
        const transaction = transactionResult.rows[0];
        if (!transaction) return res.status(404).send("Transaction not found");

        const envelopeResult = await pool.query('SELECT * FROM envelopes WHERE id=$1', [transaction.envelope_id]);
        const envelope = envelopeResult.rows[0];

        const newBudget = envelope.budget + transaction.amount; // refund amount
        await pool.query('UPDATE envelopes SET budget=$1 WHERE id=$2', [newBudget, envelope.id]);
        await pool.query('DELETE FROM transactions WHERE id=$1', [transactionId]);

        res.send(`Transaction ${transactionId} deleted. Envelope budget updated to ${newBudget}.`);
    } catch (err) { res.status(500).send("Server error"); }
});

// Start server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

