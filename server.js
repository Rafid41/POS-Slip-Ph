// server.js
const express = require('express');
const fs = require('fs');
const { generatePOSSlip } = require('./POS_Slip_generation.js');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => res.json({ status: 'ok' }));

app.get('/download-POS/:orderId', (req, res) => {
    fs.readFile('data/orderformat.json', 'utf8', (err, data) => {
        if (err) {
            return res.status(500).json({ error: 'Failed to read orders data' });
        }
        try {
            const order = JSON.parse(data);
            if (order.id === req.params.orderId) {
                generatePOSSlip(order, res);
            } else {
                res.status(404).json({ error: 'Order not found' });
            }
        } catch (parseErr) {
            res.status(500).json({ error: 'Failed to parse orders data' });
        }
    });
});


app.listen(PORT, () => console.log(`Server started on http://localhost:${PORT}`));