const express = require('express');
const router = express.Router();
const cheerio = require('cheerio');

router.get('/link-preview', async (req, res) => {
  try {
    const { url } = req.query;
    if (!url) return res.status(400).json({ message: 'URL required' });

    const response = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; VivaWork/1.0)' }
    });
    const html = await response.text();
    const $ = cheerio.load(html);

    const getMeta = (name) => {
      return $(`meta[property="og:${name}"]`).attr('content') ||
             $(`meta[name="${name}"]`).attr('content') ||
             $(`meta[name="twitter:${name}"]`).attr('content');
    };

    res.json({
      url,
      title: getMeta('title') || $('title').text() || url,
      description: getMeta('description') || '',
      image: getMeta('image') || '',
    });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch preview' });
  }
});

module.exports = router;