import { Request } from "express";
import { UAParser } from "ua-parser-js";

/**
 * Extract client IP address from request
 * Checks X-Forwarded-For header first (for proxied requests), then X-Real-IP, then falls back to req.ip
 */
export function getClientIp(req: Request): string | undefined {
  const forwarded = req.headers["x-forwarded-for"];
  
  if (forwarded) {
    // X-Forwarded-For can contain multiple IPs (client, proxy1, proxy2, ...)
    // The first one is the original client IP
    const ips = typeof forwarded === "string" ? forwarded.split(",") : forwarded;
    return ips[0].trim();
  }
  
  const realIp = req.headers["x-real-ip"];
  if (realIp && typeof realIp === "string") {
    return realIp.trim();
  }
  
  return req.ip;
}

/**
 * Parse user agent string to extract browser, OS, and device information
 */
export function parseUserAgent(req: Request): {
  browser: string;
  os: string;
  device: string;
} {
  const userAgent = req.headers["user-agent"] || "";
  const parser = new UAParser(userAgent);
  const result = parser.getResult();
  
  const browser = result.browser.name && result.browser.version
    ? `${result.browser.name} ${result.browser.version}`
    : result.browser.name || "Unknown Browser";
    
  const os = result.os.name && result.os.version
    ? `${result.os.name} ${result.os.version}`
    : result.os.name || "Unknown OS";
    
  const device = result.device.type
    ? `${result.device.type}${result.device.vendor ? ` (${result.device.vendor})` : ""}`
    : "desktop";
  
  return { browser, os, device };
}

/**
 * Get formatted device info string from user agent
 * Format: "Browser on OS"
 * Example: "Chrome 120 on macOS 14.0"
 */
export function getDeviceInfo(req: Request): string {
  const { browser, os } = parseUserAgent(req);
  return `${browser} on ${os}`;
}

/**
 * Extract comprehensive request metadata including IP and device info
 */
export function extractRequestMetadata(req: Request): {
  ipAddress: string | undefined;
  userAgent: string | undefined;
  deviceInfo: string;
  browser: string;
  os: string;
  device: string;
} {
  const ipAddress = getClientIp(req);
  const userAgent = req.headers["user-agent"];
  const deviceInfo = getDeviceInfo(req);
  const { browser, os, device } = parseUserAgent(req);
  
  return {
    ipAddress,
    userAgent,
    deviceInfo,
    browser,
    os,
    device,
  };
}

