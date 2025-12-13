const express = require('express');
const app = express();
const PORT = 3000;

app.use(express.json());

let envelopes = [];
let nextId = 0;

app.post('/envelopes', (req, res) => {
    const { title, budget } = req.body;

    if (!title || !budget) {
        return res.status(400).send("Title and budget are required.")
    }

    const newEnvelope = {id: nextId++, title, budget}
    envelopes.push(newEnvelope)

    res.status(201).json(newEnvelope);
})

app.get('/envelopes', (req, res) => {
    res.json(envelopes);
})

app.listen(PORT, () => {
    console.log(`Listening on port ${PORT}.`);
})
