const express = require('express');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Route principale
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Endpoint API pour la recherche (Simulation pour l'instant)
app.post('/api/analyze', (req, res) => {
  const { asin, minSales, minROI, minSellers } = req.body;
  
  // Ici nous intégrerons plus tard les appels réels JungleScout / Alibaba
  console.log(`Recherche demandée pour ASIN: ${asin} avec filtres Sales > ${minSales}, ROI > ${minROI}% et Vendeurs > ${minSellers}`);
  
  // Simulation de réponse
  res.json({
    success: true,
    data: {
      productName: "Produit Premium OEM",
      asin: asin,
      estSales: 120,
      estROI: 65,
      supplier: {
        name: "Shenzhen Global Wholesale Ltd.",
        link: "https://alibaba.com/sample-factory"
      }
    }
  });
});

app.listen(PORT, () => {
  console.log(`Serveur ASIN HUB démarré sur http://localhost:${PORT}`);
});
