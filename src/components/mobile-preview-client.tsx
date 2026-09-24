'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import {
  Smartphone,
  Monitor,
  RotateCw,
  ZoomIn,
  ZoomOut,
  RefreshCw,
  Maximize2,
  AlertTriangle,
  CheckCircle,
  Grid,
  Ruler,
  Eye,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Device presets
// ---------------------------------------------------------------------------

interface DevicePreset {
  name: string;
  width: number;
  height: number;
  userAgent?: string;
}

const DEVICES: DevicePreset[] = [
  { name: 'iPhone SE', width: 375, height: 667 },
  { name: 'iPhone 14/15/16', width: 390, height: 844 },
  { name: 'iPhone Pro Max', width: 430, height: 932 },
  { name: 'Android Small', width: 360, height: 800 },
  { name: 'Android Large', width: 412, height: 915 },
  { name: 'Custom', width: 390, height: 844 },
];

const ZOOM_LEVELS = [50, 75, 100, 125, 150];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function MobilePreviewClient() {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [selectedDevice, setSelectedDevice] = useState(1); // iPhone 14/15/16
  const [customWidth, setCustomWidth] = useState(390);
  const [customHeight, setCustomHeight] = useState(844);
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('portrait');
  const [zoom, setZoom] = useState(75);
  const [showGrid, setShowGrid] = useState(false);
  const [showRuler, setShowRuler] = useState(false);
  const [showOverflow, setShowOverflow] = useState(false);
  const [status, setStatus] = useState<'loading' | 'ok' | 'error'>('loading');
  const [iframeKey, setIframeKey] = useState(0);
  const [urlPath, setUrlPath] = useState('/');

  const device = DEVICES[selectedDevice];
  const isCustom = device.name === 'Custom';
  const vpWidth = isCustom ? customWidth : device.width;
  const vpHeight = isCustom ? customHeight : device.height;

  const displayWidth = orientation === 'portrait' ? vpWidth : vpHeight;
  const displayHeight = orientation === 'portrait' ? vpHeight : vpWidth;

  const scaledWidth = Math.round(displayWidth * (zoom / 100));
  const scaledHeight = Math.round(displayHeight * (zoom / 100));

  const handleRefresh = useCallback(() => {
    setIframeKey((k) => k + 1);
    setStatus('loading');
  }, []);

  const handleDeviceChange = useCallback((index: number) => {
    setSelectedDevice(index);
    setIframeKey((k) => k + 1);
    setStatus('loading');
  }, []);

  const handleUrlNavigate = useCallback((path: string) => {
    setUrlPath(path);
    setIframeKey((k) => k + 1);
    setStatus('loading');
  }, []);

  // Build iframe src
  const iframeBase = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
  const iframeSrc = `${iframeBase}${urlPath}`;

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Top toolbar */}
      <div className="sticky top-0 z-50 bg-gray-800 border-b border-gray-700 px-4 py-3">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center gap-4">
          {/* Title */}
          <div className="flex items-center gap-2 mr-4">
            <Smartphone className="w-5 h-5 text-primary-400" />
            <span className="font-semibold text-sm hidden sm:inline">Mobile Preview</span>
          </div>

          {/* Device selector */}
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-400">Device</label>
            <select
              value={selectedDevice}
              onChange={(e) => handleDeviceChange(Number(e.target.value))}
              className="bg-gray-700 border border-gray-600 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary-400"
            >
              {DEVICES.map((d, i) => (
                <option key={i} value={i}>
                  {d.name} ({d.width}×{d.height})
                </option>
              ))}
            </select>
          </div>

          {/* Custom dimensions */}
          {isCustom && (
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={customWidth}
                onChange={(e) => { setCustomWidth(Number(e.target.value)); setIframeKey((k) => k + 1); }}
                className="w-20 bg-gray-700 border border-gray-600 rounded-lg px-2 py-1.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary-400"
                placeholder="W"
              />
              <span className="text-gray-500">×</span>
              <input
                type="number"
                value={customHeight}
                onChange={(e) => { setCustomHeight(Number(e.target.value)); setIframeKey((k) => k + 1); }}
                className="w-20 bg-gray-700 border border-gray-600 rounded-lg px-2 py-1.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary-400"
                placeholder="H"
              />
            </div>
          )}

          {/* Orientation */}
          <button
            onClick={() => setOrientation((o) => o === 'portrait' ? 'landscape' : 'portrait')}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm transition-colors"
            title="Toggle orientation"
          >
            <RotateCw className="w-4 h-4" />
            <span className="hidden sm:inline">{orientation === 'portrait' ? 'Portrait' : 'Landscape'}</span>
          </button>

          {/* Zoom */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => setZoom((z) => Math.max(50, z - 25))}
              className="p-1.5 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
              title="Zoom out"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <select
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="bg-gray-700 border border-gray-600 rounded-lg px-2 py-1.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary-400"
            >
              {ZOOM_LEVELS.map((z) => (
                <option key={z} value={z}>{z}%</option>
              ))}
            </select>
            <button
              onClick={() => setZoom((z) => Math.min(150, z + 25))}
              className="p-1.5 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
              title="Zoom in"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
          </div>

          {/* Refresh */}
          <button
            onClick={handleRefresh}
            className="p-1.5 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          {/* Debug toggles */}
          <div className="flex items-center gap-1 ml-auto">
            <button
              onClick={() => setShowGrid((g) => !g)}
              className={`p-1.5 rounded-lg transition-colors ${showGrid ? 'bg-primary-600' : 'bg-gray-700 hover:bg-gray-600'}`}
              title="Show grid"
            >
              <Grid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setShowRuler((r) => !r)}
              className={`p-1.5 rounded-lg transition-colors ${showRuler ? 'bg-primary-600' : 'bg-gray-700 hover:bg-gray-600'}`}
              title="Show ruler"
            >
              <Ruler className="w-4 h-4" />
            </button>
            <button
              onClick={() => setShowOverflow((o) => !o)}
              className={`p-1.5 rounded-lg transition-colors ${showOverflow ? 'bg-primary-600' : 'bg-gray-700 hover:bg-gray-600'}`}
              title="Show overflow"
            >
              <Eye className="w-4 h-4" />
            </button>
          </div>

          {/* Status */}
          <div className="flex items-center gap-1.5">
            {status === 'loading' && (
              <RefreshCw className="w-4 h-4 text-yellow-400 animate-spin" />
            )}
            {status === 'ok' && (
              <CheckCircle className="w-4 h-4 text-green-400" />
            )}
            {status === 'error' && (
              <AlertTriangle className="w-4 h-4 text-red-400" />
            )}
            <span className="text-xs text-gray-400">
              {displayWidth} × {displayHeight}
            </span>
          </div>
        </div>

        {/* URL bar */}
        <div className="max-w-7xl mx-auto mt-2 flex items-center gap-2">
          <span className="text-xs text-gray-500 shrink-0">Navigate:</span>
          {['/', '/products', '/comment-ca-marche', '/login', '/cart'].map((path) => (
            <button
              key={path}
              onClick={() => handleUrlNavigate(path)}
              className={`px-2 py-1 rounded text-xs transition-colors ${
                urlPath === path
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-700 text-gray-400 hover:bg-gray-600 hover:text-white'
              }`}
            >
              {path === '/' ? 'Home' : path.replace('/', '').replace('-', ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Preview area */}
      <div className="flex items-start justify-center p-8 min-h-[calc(100vh-120px)]">
        <div className="relative">
          {/* Device frame */}
          <div
            className={`relative bg-gray-950 rounded-[2rem] border-4 border-gray-700 shadow-2xl overflow-hidden transition-all duration-300 ${
              showOverflow ? 'border-red-500' : ''
            }`}
            style={{
              width: `${scaledWidth + 32}px`,
              height: `${scaledHeight + 32}px`,
            }}
          >
            {/* Notch / Dynamic Island */}
            <div className="absolute top-2 left-1/2 -translate-x-1/2 w-24 h-5 bg-black rounded-full z-10" />

            {/* Iframe container with overflow detection */}
            <div
              className="relative overflow-hidden"
              style={{
                width: `${scaledWidth}px`,
                height: `${scaledHeight}px`,
                margin: '16px',
              }}
            >
              <iframe
                key={iframeKey}
                ref={iframeRef}
                src={iframeSrc}
                title="Mobile Preview"
                className="border-0"
                style={{
                  width: `${displayWidth}px`,
                  height: `${displayHeight}px`,
                  transform: `scale(${zoom / 100})`,
                  transformOrigin: 'top left',
                }}
                onLoad={() => setStatus('ok')}
                onError={() => setStatus('error')}
                sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox"
              />

              {/* Grid overlay */}
              {showGrid && (
                <div
                  className="absolute inset-0 pointer-events-none z-20"
                  style={{
                    backgroundImage: `
                      linear-gradient(to right, rgba(169,135,106,0.15) 1px, transparent 1px),
                      linear-gradient(to bottom, rgba(169,135,106,0.15) 1px, transparent 1px)
                    `,
                    backgroundSize: '20px 20px',
                  }}
                />
              )}

              {/* Ruler overlay */}
              {showRuler && (
                <>
                  {/* Horizontal ruler */}
                  <div className="absolute top-0 left-0 right-0 h-5 bg-black/80 z-20 flex items-end">
                    {Array.from({ length: Math.ceil(displayWidth / 50) + 1 }).map((_, i) => (
                      <div
                        key={i}
                        className="absolute bottom-0 flex flex-col items-center"
                        style={{ left: `${i * 50}px` }}
                      >
                        <span className="text-[8px] text-gray-400 leading-none">{i * 50}</span>
                        <div className="w-px h-2 bg-gray-500" />
                      </div>
                    ))}
                  </div>
                  {/* Vertical ruler */}
                  <div className="absolute top-0 left-0 bottom-0 w-5 bg-black/80 z-20 flex flex-col items-end">
                    {Array.from({ length: Math.ceil(displayHeight / 50) + 1 }).map((_, i) => (
                      <div
                        key={i}
                        className="absolute right-0 flex items-center"
                        style={{ top: `${i * 50}px` }}
                      >
                        <div className="h-px w-2 bg-gray-500" />
                        <span className="text-[8px] text-gray-400 leading-none ml-0.5" style={{ writingMode: 'vertical-lr' }}>
                          {i * 50}
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {/* Overflow detection */}
              {showOverflow && (
                <div className="absolute top-6 right-0 bottom-0 w-0.5 bg-red-500 z-20 animate-pulse" />
              )}
            </div>

            {/* Home indicator */}
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-28 h-1 bg-gray-600 rounded-full" />
          </div>

          {/* Device info below frame */}
          <div className="mt-4 text-center text-xs text-gray-500">
            {device.name !== 'Custom' ? device.name : 'Custom'} · {displayWidth}×{displayHeight} · Zoom {zoom}%
          </div>
        </div>
      </div>
    </div>
  );
}
