import DOMPurify from 'dompurify';

// Input sanitization and validation
export const sanitizeInput = (input: string): string => {
  return DOMPurify.sanitize(input.trim());
};

export const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

export const validateName = (name: string): { isValid: boolean; error?: string } => {
  const sanitized = sanitizeInput(name);
  const words = sanitized.split(/\s+/);
  const hasOnlyLettersAndSpaces = /^[a-zA-ZÀ-ÿ\s'-]+$/.test(sanitized);
  
  if (!sanitized || sanitized.length < 2) {
    return { isValid: false, error: "Name must be at least 2 characters long" };
  }
  
  if (sanitized.length > 100) {
    return { isValid: false, error: "Name must be less than 100 characters" };
  }
  
  if (words.length < 2) {
    return { isValid: false, error: "Please provide your full name (first and last name)" };
  }
  
  if (!hasOnlyLettersAndSpaces) {
    return { isValid: false, error: "Name can only contain letters, spaces, hyphens and apostrophes" };
  }
  
  return { isValid: true };
};

// Rate limiting
class RateLimiter {
  private attempts: Map<string, { count: number; resetTime: number }> = new Map();
  private maxAttempts: number;
  private windowMs: number;

  constructor(maxAttempts: number = 3, windowMs: number = 300000) { // 5 minutes
    this.maxAttempts = maxAttempts;
    this.windowMs = windowMs;
  }

  isAllowed(identifier: string): { allowed: boolean; timeLeft?: number } {
    const now = Date.now();
    const userAttempts = this.attempts.get(identifier);

    if (!userAttempts) {
      this.attempts.set(identifier, { count: 1, resetTime: now + this.windowMs });
      return { allowed: true };
    }

    if (now > userAttempts.resetTime) {
      this.attempts.set(identifier, { count: 1, resetTime: now + this.windowMs });
      return { allowed: true };
    }

    if (userAttempts.count >= this.maxAttempts) {
      const timeLeft = Math.ceil((userAttempts.resetTime - now) / 1000);
      return { allowed: false, timeLeft };
    }

    userAttempts.count++;
    return { allowed: true };
  }

  reset(identifier: string): void {
    this.attempts.delete(identifier);
  }
}

export const bookingRateLimiter = new RateLimiter(3, 300000); // 3 attempts per 5 minutes
export const adminLoginRateLimiter = new RateLimiter(5, 900000); // 5 attempts per 15 minutes

// Simple CAPTCHA implementation
export const generateSimpleCaptcha = (): { question: string; answer: number } => {
  const num1 = Math.floor(Math.random() * 10) + 1;
  const num2 = Math.floor(Math.random() * 10) + 1;
  const operations = ['+', '-'];
  const operation = operations[Math.floor(Math.random() * operations.length)];
  
  let answer: number;
  let question: string;
  
  if (operation === '+') {
    answer = num1 + num2;
    question = `What is ${num1} + ${num2}?`;
  } else {
    if (num1 < num2) {
      answer = num2 - num1;
      question = `What is ${num2} - ${num1}?`;
    } else {
      answer = num1 - num2;
      question = `What is ${num1} - ${num2}?`;
    }
  }
  
  return { question, answer };
};

// Session security
export const generateSecureToken = (): string => {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
};

// Content Security Policy helpers
export const createCSPHeader = (): string => {
  return [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.supabase.co",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: https:",
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
    "frame-ancestors 'none'",
  ].join('; ');
};