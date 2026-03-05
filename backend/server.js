const express = require('express');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

// Static assets (frontend build, PDFs, etc.)
app.use(express.static(path.join(__dirname, '../frontend')));

// In-memory example database (we'll serve the same items you used in the original front-end)
const database = [
    { id: "cpeum-1-ejemplo", sourceName: "CPEUM (Federal)", stateCode: "federal", title: "ARTÍCULO 1", content: "En los Estados Unidos Mexicanos todas las personas gozarán de los derechos humanos reconocidos en esta Constitución...", tags: ["discriminacion", "humanos", "garantias", "genero"] },
    { id: "cdmx-a-ejemplo", sourceName: "Ciudad de México", stateCode: "cdmx", title: "Carta de Derechos", content: "La Ciudad de México garantiza el pleno ejercicio de los derechos humanos y libertades fundamentales...", tags: ["derechos", "libertad", "capital"] }
];

// API endpoints
app.get('/api/ping', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

app.get('/api/articles', (req, res) => {
  // return the initial set of articles; PDF parsing remains in the client for now
  res.json(database);
});


const server = app.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`);
});

server.on('error', err => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${port} already in use. Is another instance running?`);
    process.exit(1);
  } else {
    console.error('Server error:', err);
    process.exit(1);
  }
});
