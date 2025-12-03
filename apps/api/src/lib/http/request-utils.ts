import { Request } from "express";
import { UAParser } from "ua-parser-js";
import { createHash } from "crypto";

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
 * Get simplified device type for display purposes
 * Returns simplified names like "Windows Desktop", "iPhone", "Mac Desktop"
 */
export function getSimplifiedDeviceType(req: Request): string {
  const userAgent = req.headers["user-agent"] || "";
  const parser = new UAParser(userAgent);
  const result = parser.getResult();
  
  const osName = result.os.name?.toLowerCase() || "";
  const deviceType = result.device.type?.toLowerCase() || "";
  const deviceVendor = result.device.vendor?.toLowerCase() || "";
  
  // Mobile devices
  if (deviceType === "mobile" || deviceType === "tablet") {
    if (osName.includes("ios")) {
      if (deviceType === "tablet" || deviceVendor.includes("ipad")) {
        return "iPad";
      }
      return "iPhone";
    }
    if (osName.includes("android")) {
      if (deviceType === "tablet") {
        return "Android Tablet";
      }
      return "Android Phone";
    }
  }
  
  // Desktop OS
  if (osName.includes("windows")) {
    return "Windows Desktop";
  }
  if (osName.includes("mac") || osName.includes("darwin")) {
    return "Mac Desktop";
  }
  if (osName.includes("linux")) {
    return "Linux Desktop";
  }
  
  // Fallback to device type or "Unknown"
  if (deviceType) {
    return deviceType.charAt(0).toUpperCase() + deviceType.slice(1);
  }
  
  return "Unknown Device";
}

/**
 * Extract comprehensive request metadata including IP and device info
 */
export function extractRequestMetadata(req: Request): {
  ipAddress: string | undefined;
  userAgent: string | undefined;
  deviceInfo: string;
  deviceType: string;
  browser: string;
  os: string;
  device: string;
} {
  const ipAddress = getClientIp(req);
  const userAgent = req.headers["user-agent"];
  const deviceInfo = getDeviceInfo(req);
  const deviceType = getSimplifiedDeviceType(req);
  const { browser, os, device } = parseUserAgent(req);
  
  return {
    ipAddress,
    userAgent,
    deviceInfo,
    deviceType,
    browser,
    os,
    device,
  };
}

/**
 * Generate a device fingerprint from request metadata
 * Used to detect when a token is used from a different device
 * Returns a SHA256 hash of combined device characteristics
 */
export function getDeviceFingerprint(req: Request): string {
  const metadata = extractRequestMetadata(req);
  
  // Combine characteristics that should remain stable for the same device
  const fingerprintData = [
    metadata.userAgent || "",
    metadata.os,
    metadata.browser,
    // Include first 3 octets of IP for some location stability while allowing minor IP changes
    metadata.ipAddress?.split(".").slice(0, 3).join(".") || "",
  ].join("|");
  
  return createHash("sha256")
    .update(fingerprintData)
    .digest("hex");
}

