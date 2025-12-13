const express = require('express');
const app = express();
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

// Transfer from envelopes
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
});
