/**
 * Flaneur OSM Recorder — GPS Module
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

export class GpsManager {
  constructor({ onPosition, onError, onStatusChange }) {
    this.onPosition = onPosition;
    this.onError = onError;
    this.onStatusChange = onStatusChange;

    this.watchId = null;
    this.lastPosition = null;
    this.active = false;

    console.log('📍 GpsManager initialized');
  }

  get isActive() {
    return this.active;
  }

  async checkPermission() {
    console.log('🔐 Checking geolocation permission...');

    // Check if Permissions API is available
    if (!navigator.permissions) {
      console.warn('⚠️  Permissions API not available, assuming prompt needed');
      return 'prompt'; // Assume we need to prompt
    }

    try {
      const result = await navigator.permissions.query({ name: 'geolocation' });
      console.log(`✅ Permission state: ${result.state}`);
      return result.state; // 'granted', 'denied', or 'prompt'
    } catch (err) {
      console.warn('⚠️  Permission check failed:', err);
      return 'prompt';
    }
  }

  async start() {
    console.log('📍 GPS start() called');

    if (!navigator.geolocation) {
      console.error('❌ Geolocation API not available in this browser');
      this.onError({ code: 'UNAVAILABLE' });
      return;
    }

    console.log('✅ Geolocation API is available');

    // Check permission status first
    const permissionState = await this.checkPermission();
    if (permissionState === 'denied') {
      console.error('❌ Geolocation permission denied');
      this.onError({
        code: 1, // PERMISSION_DENIED
        message: 'Location permission was denied. Please enable it in your browser settings.',
      });
      return;
    }

    console.log('📍 Starting geolocation watch...');

    this.watchId = navigator.geolocation.watchPosition(
      (pos) => {
        console.log('✅ GPS position received:', {
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          timestamp: new Date(pos.timestamp).toISOString(),
        });

        this.lastPosition = {
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          altitude: pos.coords.altitude,
          heading: pos.coords.heading,
          speed: pos.coords.speed,
          timestamp: pos.timestamp,
        };
        this.onPosition(this.lastPosition);
      },
      (err) => {
        console.error('❌ GPS position error:', {
          code: err.code,
          message: err.message,
        });
        this.onError(err);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 5000, // Increased from 3000
        timeout: 30000, // Increased from 15000 - desktop/wifi location takes longer
      }
    );

    this.active = true;
    this.onStatusChange(true);
    console.log(`✅ GPS watch started (watchId: ${this.watchId})`);
  }

  stop() {
    console.log('📍 GPS stop() called');

    if (this.watchId != null) {
      navigator.geolocation.clearWatch(this.watchId);
      console.log(`✅ GPS watch cleared (watchId: ${this.watchId})`);
      this.watchId = null;
    }
    this.active = false;
    this.onStatusChange(false);
  }

  toggle() {
    console.log(`📍 GPS toggle() called (currently ${this.active ? 'active' : 'inactive'})`);
    if (this.active) this.stop();
    else this.start();
  }

  getCurrentPosition() {
    return this.lastPosition;
  }
}
