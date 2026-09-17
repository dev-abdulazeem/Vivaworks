const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const hashPassword = async (password) => {
  const salt = await bcrypt.genSalt(12);
  return bcrypt.hash(password, salt);
};

const comparePassword = async (password, hashedPassword) => {
  return bcrypt.compare(password, hashedPassword);
};

const generateSecureToken = () => {
  return crypto.randomBytes(32).toString('hex');
};

const hashToken = (token) => {
  return crypto.createHash('sha256').update(token).digest('hex');
};

const sanitizeInput = (input) => {
  if (typeof input !== 'string') return input;
  return input
    .replace(/[<>]/g, '')
    .trim()
    .slice(0, 5000);
};

const validatePasswordStrength = (password) => {
  const minLength = 8;
  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumbers = /\d/.test(password);
  const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);

  const errors = [];
  if (password.length < minLength) errors.push('Password must be at least 8 characters');
  if (!hasUpperCase) errors.push('Password must contain an uppercase letter');
  if (!hasLowerCase) errors.push('Password must contain a lowercase letter');
  if (!hasNumbers) errors.push('Password must contain a number');
  if (!hasSpecialChar) errors.push('Password must contain a special character');

  return {
    isValid: errors.length === 0,
    errors,
  };
};

const generateWithdrawalReference = () => {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = crypto.randomBytes(4).toString('hex').toUpperCase();
  return `VWD-${timestamp}-${random}`;
};

const maskEmail = (email) => {
  const [localPart, domain] = email.split('@');
  const maskedLocal = localPart.charAt(0) + '***' + localPart.charAt(localPart.length - 1);
  return `${maskedLocal}@${domain}`;
};

const maskAccountNumber = (accountNumber) => {
  if (accountNumber.length < 4) return '****';
  return '****' + accountNumber.slice(-4);
};

const generateCsrfToken = () => {
  return crypto.randomBytes(32).toString('hex');
};

const encryptSensitiveData = (data, secretKey) => {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', Buffer.from(secretKey.padEnd(32).slice(0, 32)), iv);
  let encrypted = cipher.update(data, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag();
  return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted;
};

const decryptSensitiveData = (encryptedData, secretKey) => {
  const parts = encryptedData.split(':');
  const iv = Buffer.from(parts[0], 'hex');
  const authTag = Buffer.from(parts[1], 'hex');
  const encrypted = parts[2];
  const decipher = crypto.createDecipheriv('aes-256-gcm', Buffer.from(secretKey.padEnd(32).slice(0, 32)), iv);
  decipher.setAuthTag(authTag);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
};

module.exports = {
  hashPassword,
  comparePassword,
  generateSecureToken,
  hashToken,
  sanitizeInput,
  validatePasswordStrength,
  generateWithdrawalReference,
  maskEmail,
  maskAccountNumber,
  generateCsrfToken,
  encryptSensitiveData,
  decryptSensitiveData,
};