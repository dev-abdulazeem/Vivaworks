const axios = require('axios');

// ─── CONTENT MODERATION CONFIG ─────────────────────────────────────────
const MODERATION_CONFIG = {
  // Phone number patterns (Nigerian + international)
  phonePatterns: [
    /(?:\+?234|0)[7-9][0-1][0-9]{8}/g,                    // Nigerian mobile
    /\+?[1-9]\d{1,14}/g,                                   // International E.164
    /\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/g,                 // Generic phone
    /\b\d{4}[-.\s]?\d{4}[-.\s]?\d{4}[-.\s]?\d{4}\b/g,     // Credit card-like
  ],

  // Scam / fraud keywords
  scamKeywords: [
    'send money', 'wire transfer', 'western union', 'moneygram',
    'gift card', 'itunes card', 'amazon card', 'google play',
    'crypto', 'bitcoin', 'ethereum', 'wallet phrase', 'seed phrase',
    'private key', 'verify account', 'account suspended', 'locked',
    'urgent', 'act now', 'limited time', 'click here', 'congratulations you won',
    'lottery winner', 'inheritance', 'next of kin', 'prince', 'million dollars',
    'double your money', 'guaranteed returns', 'no risk investment',
    'pay before delivery', 'pay to unlock', 'activation fee',
  ],

  // Nudity / NSFW keywords (basic text check)
  nsfwKeywords: [
    'nude', 'naked', 'sex', 'porn', 'xxx', 'onlyfans', 'explicit',
    'nsfw', 'adult content', 'bare', 'undress', 'strip',
  ],

  // Suspicious URL patterns
  suspiciousDomains: [
    'bit.ly', 'tinyurl', 't.co', 'short.link', 'goo.gl',
    'ow.ly', 'buff.ly', 'rebrand.ly', 'short.io',
  ],
};

// ─── SCAN TEXT CONTENT ─────────────────────────────────────────────────
const scanText = (text) => {
  const violations = [];
  const lowerText = text.toLowerCase();

  // Check phone numbers
  for (const pattern of MODERATION_CONFIG.phonePatterns) {
    const matches = text.match(pattern);
    if (matches && matches.length > 0) {
      violations.push({
        type: 'phone',
        confidence: 0.95,
        matches: matches.slice(0, 3), // Limit matches
      });
      break;
    }
  }

  // Check scam keywords
  const foundScam = MODERATION_CONFIG.scamKeywords.filter(kw => lowerText.includes(kw));
  if (foundScam.length > 0) {
    violations.push({
      type: 'scam',
      confidence: Math.min(0.85 + (foundScam.length * 0.05), 0.99),
      matches: foundScam,
    });
  }

  // Check NSFW keywords
  const foundNsfw = MODERATION_CONFIG.nsfwKeywords.filter(kw => lowerText.includes(kw));
  if (foundNsfw.length > 0) {
    violations.push({
      type: 'nudity',
      confidence: Math.min(0.8 + (foundNsfw.length * 0.1), 0.99),
      matches: foundNsfw,
    });
  }

  // Check suspicious links
  const urlRegex = /https?:\/\/[^\s]+/g;
  const urls = text.match(urlRegex) || [];
  const suspiciousUrls = urls.filter(url => 
    MODERATION_CONFIG.suspiciousDomains.some(domain => url.includes(domain))
  );
  if (suspiciousUrls.length > 0) {
    violations.push({
      type: 'suspicious_links',
      confidence: 0.75,
      matches: suspiciousUrls,
    });
  }

  // Too many external links in first few messages
  if (urls.length > 3) {
    violations.push({
      type: 'excessive_links',
      confidence: 0.6,
      matches: urls.slice(0, 3),
    });
  }

  return violations;
};

// ─── SCAN FILE (Cloudinary/URL) ────────────────────────────────────────
const scanFile = async (fileUrl, mimeType) => {
  // Check file type
  if (mimeType) {
    // Block executable files
    const blockedTypes = [
      'application/x-msdownload', // .exe
      'application/x-executable',
      'application/x-sh',
      'application/x-bat',
    ];
    if (blockedTypes.includes(mimeType)) {
      return {
        violation: true,
        type: 'malware',
        confidence: 0.99,
      };
    }
  }

  // Check image for NSFW using Cloudinary moderation (if configured)
  if (mimeType?.startsWith('image/')) {
    // If using Cloudinary, you can add ?moderation=aws_rek to upload
    // For now, basic filename check
    const lowerUrl = fileUrl.toLowerCase();
    const nsfwFileNames = ['nude', 'naked', 'sex', 'porn', 'xxx', 'nsfw'];
    if (nsfwFileNames.some(n => lowerUrl.includes(n))) {
      return {
        violation: true,
        type: 'nudity',
        confidence: 0.9,
      };
    }
  }

  // Check PDF for suspicious content (basic)
  if (mimeType === 'application/pdf') {
    // Could integrate with PDF text extraction here
    // For now, allow but flag if needed
  }

  return { violation: false };
};

// ─── MAIN MODERATION FUNCTION ──────────────────────────────────────────
const moderateContent = async (content, fileUrl, mimeType) => {
  const textViolations = scanText(content || '');
  const fileResult = fileUrl ? await scanFile(fileUrl, mimeType) : { violation: false };

  const allViolations = [...textViolations];

  if (fileResult.violation) {
    allViolations.push({
      type: fileResult.type,
      confidence: fileResult.confidence,
    });
  }

  // Determine if auto-ban is warranted


  const autoBanTriggers = ['nudity', 'phone'];
  const autoBan = allViolations.some(v => 
    autoBanTriggers.includes(v.type) || v.confidence > 0.92
  );

  const suspensionWorthy = allViolations.some(v => 
    v.type === 'scam' || v.type === 'malware' || v.confidence > 0.85
  );

  return {
    violated: allViolations.length > 0,
    violations: allViolations,
    autoBan,
    suspensionWorthy,
    severity: autoBan ? 'critical' : suspensionWorthy ? 'high' : 'medium',
  };
};


module.exports = {
  moderateContent,
  scanText,
  scanFile,
  MODERATION_CONFIG,
};