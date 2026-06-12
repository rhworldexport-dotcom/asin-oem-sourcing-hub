const express = require('express');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Route explicite pour la page d'accueil
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Export pour Vercel
module.exports = app;

// Démarrage si lancé localement
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Serveur ASIN HUB démarré sur http://localhost:${PORT}`);
  });
}
