import {
  useState,
  useEffect,
  useRef,
  type DragEvent,
  type ChangeEvent,
  type KeyboardEvent,
} from 'react';
import {
  Link2,
  Copy,
  Download,
  QrCode,
  Users,
  Send,
  Shield,
  LogOut,
  Paperclip,
  Check,
  Loader2,
  Plus,
  ArrowRight,
  FileIcon,
  Image as ImageIcon,
  X,
  ClipboardCopy,
  Lock,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';

// ─── Types ────────────────────────────────────────────────────────────────────

type Phase = 'idle' | 'connecting' | 'connected' | 'key_exchange' | 'error';
type ItemType = 'text' | 'file' | 'image';

interface ClipItem {
  id: string;
  type: ItemType;
  /** Plain text content, or raw base64 bytes (no data-url prefix) for file/image */
  content: string;
  filename?: string;
  fileSize?: number;
  mimeType?: string;
  senderId: string;
  senderName: string;
  ts: number;
  isOwn: boolean;
}

interface Peer {
  deviceId: string;
  deviceName: string;
}

// What gets JSON-serialised, encrypted, then transmitted
interface ClipPayload {
  type: ItemType;
  content: string;
  filename?: string;
  fileSize?: number;
  mimeType?: string;
}

// ─── WebCrypto helpers (AES-256-GCM) ─────────────────────────────────────────

async function generateKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
}

async function exportKey(key: CryptoKey): Promise<string> {
  const raw = await crypto.subtle.exportKey('raw', key);
  return btoa(String.fromCharCode(...new Uint8Array(raw)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

async function importKey(b64url: string): Promise<CryptoKey> {
  const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/');
  const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
  const bytes = Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
  return crypto.subtle.importKey('raw', bytes, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

// ─── ECDH helpers for 6-char code key exchange ───────────────────────────────
// When a peer joins with just a room code (no AES key), we perform an
// ECDH P-256 key exchange over the relay.  The server is a blind router
// and never sees the AES key.

async function generateECDHKeyPair(): Promise<CryptoKeyPair> {
  return crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveKey']);
}

async function exportECDHPublicKey(key: CryptoKey): Promise<string> {
  const raw = await crypto.subtle.exportKey('spki', key);
  return btoa(String.fromCharCode(...new Uint8Array(raw)));
}

async function importECDHPublicKey(b64: string): Promise<CryptoKey> {
  const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  return crypto.subtle.importKey(
    'spki',
    bytes.buffer as ArrayBuffer,
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    [],
  );
}

/**
 * Key-holder side: wraps the room's AES key using an ephemeral ECDH keypair.
 * Returns the wrapped key + ephemeral public key (both base64).
 * Forward-secure: each call uses a fresh ephemeral pair.
 */
async function wrapAESKey(
  aesKey: CryptoKey,
  peerPubKey: CryptoKey,
): Promise<{ wrappedKey: string; ephemeralPub: string }> {
  const ephemeral = await generateECDHKeyPair();
  const wrappingKey = await crypto.subtle.deriveKey(
    { name: 'ECDH', public: peerPubKey },
    ephemeral.privateKey,
    { name: 'AES-KW', length: 256 },
    false,
    ['wrapKey'],
  );
  const wrapped = await crypto.subtle.wrapKey('raw', aesKey, wrappingKey, 'AES-KW');
  return {
    wrappedKey: btoa(String.fromCharCode(...new Uint8Array(wrapped))),
    ephemeralPub: await exportECDHPublicKey(ephemeral.publicKey),
  };
}

/**
 * Joiner side: unwraps the room's AES key using the ephemeral public key
 * sent by the key-holder and our own ECDH private key.
 */
async function unwrapAESKey(
  wrappedKeyB64: string,
  ephemeralPubB64: string,
  myPrivateKey: CryptoKey,
): Promise<CryptoKey> {
  const ephemeralPub = await importECDHPublicKey(ephemeralPubB64);
  const unwrappingKey = await crypto.subtle.deriveKey(
    { name: 'ECDH', public: ephemeralPub },
    myPrivateKey,
    { name: 'AES-KW', length: 256 },
    false,
    ['unwrapKey'],
  );
  const wrapped = Uint8Array.from(atob(wrappedKeyB64), (c) => c.charCodeAt(0));
  return crypto.subtle.unwrapKey(
    'raw',
    wrapped.buffer as ArrayBuffer,
    unwrappingKey,
    'AES-KW',
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt'],
  );
}

async function encryptPayload(key: CryptoKey, obj: ClipPayload): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(JSON.stringify(obj));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded);
  const out = new Uint8Array(12 + ct.byteLength);
  out.set(iv);
  out.set(new Uint8Array(ct), 12);
  return btoa(String.fromCharCode(...out));
}

async function decryptPayload(key: CryptoKey, b64: string): Promise<ClipPayload> {
  const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  const iv = bytes.slice(0, 12);
  const ct = bytes.slice(12);
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct);
  return JSON.parse(new TextDecoder().decode(pt)) as ClipPayload;
}

// ─── WebSocket base URL (respects VITE_API_URL for split-host deployments) ───
const _CLIP_API_BASE = ((import.meta.env.VITE_API_URL as string | undefined) ?? '').replace(
  /\/$/,
  '',
);
const CLIP_WS_BASE = _CLIP_API_BASE
  ? _CLIP_API_BASE.replace(/^https?/, (m) => (m === 'https' ? 'wss' : 'ws'))
  : `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}`;

// ─── Utilities ────────────────────────────────────────────────────────────────

function genRoomId(): string {
  // 6-char uppercase code, ambiguous chars (0/O, 1/I/L) excluded
  // Charset has 31 chars → 31^6 ≈ 887 M combinations (low collision risk)
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  const arr = crypto.getRandomValues(new Uint8Array(6));
  return Array.from(arr, (b) => chars[b % chars.length]).join('');
}

function getDeviceName(): string {
  const ua = navigator.userAgent;
  let os = 'Device';
  if (/iPhone/.test(ua)) os = 'iPhone';
  else if (/iPad/.test(ua)) os = 'iPad';
  else if (/Android/.test(ua)) os = 'Android';
  else if (/Windows/.test(ua)) os = 'Windows';
  else if (/Mac OS X/.test(ua)) os = 'Mac';
  else if (/Linux/.test(ua)) os = 'Linux';
  let br = 'Browser';
  if (/Firefox\//.test(ua)) br = 'Firefox';
  else if (/Edg\//.test(ua)) br = 'Edge';
  else if (/Chrome\//.test(ua)) br = 'Chrome';
  else if (/Safari\//.test(ua) && !/Chrome\//.test(ua)) br = 'Safari';
  return `${br} on ${os}`;
}

function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

async function fileToBase64(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let binary = '';
  const chunk = 8192;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, Math.min(i + chunk, bytes.length)));
  }
  return btoa(binary);
}

function downloadBase64File(content: string, filename: string, mimeType: string) {
  const bytes = Uint8Array.from(atob(content), (c) => c.charCodeAt(0));
  const url = URL.createObjectURL(
    new Blob([bytes], { type: mimeType || 'application/octet-stream' }),
  );
  const a = Object.assign(document.createElement('a'), { href: url, download: filename });
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

function getRoomUrl(roomId: string, keyB64: string): string {
  const base = window.location.origin + window.location.pathname;
  return `${base}#clipsync/${roomId}/${keyB64}`;
}

/**
 * Compact shareable invite code: `roomId.keyB64`
 * (~51 chars — contains both the room ID and the 256-bit encryption key).
 */
function makeInviteCode(roomId: string, keyB64: string): string {
  return `${roomId}.${keyB64}`;
}

function parseRoomHash(hash: string): { roomId: string; keyB64: string } | null {
  const m = hash.match(/^#clipsync\/([a-zA-Z0-9]{4,12})\/([A-Za-z0-9_-]{20,})$/);
  if (!m) return null;
  return { roomId: m[1].toLowerCase(), keyB64: m[2] };
}

/**
 * Accept a full URL, an invite code (`roomId.keyB64`), or a bare room code.
 * Returns null when the input is unrecognisable.
 */
function parseJoinInput(
  raw: string,
): { roomId: string; keyB64: string } | { roomId: string; keyB64: null } | null {
  const s = raw.trim();
  if (!s) return null;
  // Full URL with hash fragment
  try {
    const u = new URL(s);
    const parsed = parseRoomHash(u.hash);
    if (parsed) return parsed;
  } catch {
    /* not a URL */
  }
  // Invite code format: roomId.keyB64 (dot separator; base64url never contains '.')
  const dotIdx = s.indexOf('.');
  if (dotIdx > 0) {
    const rid = s
      .slice(0, dotIdx)
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '');
    const kb64 = s
      .slice(dotIdx + 1)
      .trim()
      .replace(/\s/g, '');
    if (rid.length >= 4 && rid.length <= 12 && kb64.length >= 20) {
      return { roomId: rid, keyB64: kb64 };
    }
  }
  // Bare room code (4–12 alphanumeric chars) — ECDH exchange will fetch the key
  const code = s.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (code.length >= 4 && code.length <= 12) return { roomId: code, keyB64: null };
  return null;
}

const FILE_LIMIT = 4 * 1024 * 1024; // 4 MB

// ─── Main component ───────────────────────────────────────────────────────────

export function ClipSync() {
  const [phase, setPhase] = useState<Phase>('idle');
  const [roomId, setRoomId] = useState('');
  const [keyB64, setKeyB64] = useState('');
  const [myDeviceId, setMyDeviceId] = useState('');
  const [peers, setPeers] = useState<Peer[]>([]);
  const [items, setItems] = useState<ClipItem[]>([]);
  const [textInput, setTextInput] = useState('');
  const [joinInput, setJoinInput] = useState('');
  const [showQR, setShowQR] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [dragging, setDragging] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [linkCopied, setLinkCopied] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);
  const [showDevices, setShowDevices] = useState(false);
  const [sendError, setSendError] = useState('');

  const wsRef = useRef<WebSocket | null>(null);
  const cryptoKeyRef = useRef<CryptoKey | null>(null);
  const ecdhPairRef = useRef<CryptoKeyPair | null>(null);
  const myDeviceIdRef = useRef('');
  const feedRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const keyB64Ref = useRef('');
  const roomIdRef = useRef('');

  // Scroll feed to bottom on new items
  useEffect(() => {
    if (feedRef.current) feedRef.current.scrollTop = feedRef.current.scrollHeight;
  }, [items]);

  // QR code (dynamic import so qrcode is code-split)
  useEffect(() => {
    if (!showQR || !roomId || !keyB64) return;
    let cancelled = false;
    const url = getRoomUrl(roomId, keyB64);
    import('qrcode')
      .then((mod) => {
        if (cancelled) return;
        const QRCode = mod.default ?? mod;
        return (QRCode as typeof import('qrcode')).toDataURL(url, {
          width: 220,
          margin: 2,
          color: { dark: '#a5b4fc', light: '#0f172a' },
          errorCorrectionLevel: 'M',
        });
      })
      .then((dataUrl) => {
        if (dataUrl && !cancelled) setQrDataUrl(dataUrl);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [showQR, roomId, keyB64]);

  // Auto-join from URL hash on mount
  useEffect(() => {
    const parsed = parseRoomHash(window.location.hash);
    if (parsed) {
      setJoinInput(getRoomUrl(parsed.roomId, parsed.keyB64));
      importKey(parsed.keyB64)
        .then((key) => {
          cryptoKeyRef.current = key;
          connectToRoom(parsed.roomId, parsed.keyB64, key);
        })
        .catch(() => setErrorMsg('Invalid key in URL — the link may be corrupted.'));
    }
    // connectToRoom is defined inside render scope — safe to pass [] since it only runs on mount
  }, []);

  // ── WebSocket connection ────────────────────────────────────────────────────

  // kb64 / key may be null when joining with just the 6-char room code.
  // In that case, ECDH key exchange is initiated automatically after joining.
  function connectToRoom(rid: string, kb64: string | null, key: CryptoKey | null) {
    setPhase('connecting');
    setErrorMsg('');
    setRoomId(rid);
    setKeyB64(kb64 ?? '');
    roomIdRef.current = rid;
    keyB64Ref.current = kb64 ?? '';

    const ws = new WebSocket(`${CLIP_WS_BASE}/clipsync`);
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: 'join', roomId: rid, deviceName: getDeviceName() }));
    };

    ws.onmessage = async (evt) => {
      let msg: Record<string, unknown>;
      try {
        msg = JSON.parse(evt.data as string) as Record<string, unknown>;
      } catch {
        return;
      }

      if (msg.type === 'joined') {
        myDeviceIdRef.current = msg.deviceId as string;
        setMyDeviceId(msg.deviceId as string);
        setPeers((msg.peers as Peer[]) ?? []);
        if (key) {
          // Already have the AES key (joined via invite code / URL)
          setPhase('connected');
          if (kb64) history.replaceState(null, '', `#clipsync/${rid}/${kb64}`);
        } else {
          // No key — initiate ECDH key request
          setPhase('key_exchange');
          try {
            const pair = await generateECDHKeyPair();
            ecdhPairRef.current = pair;
            const pubKey = await exportECDHPublicKey(pair.publicKey);
            ws.send(JSON.stringify({ type: 'signal', data: { meta: 'key_req', pubKey } }));
          } catch {
            setErrorMsg('Failed to initiate key exchange. Try refreshing.');
            setPhase('error');
            ws.close();
          }
        }
        return;
      }

      if (msg.type === 'peer_joined' || msg.type === 'peer_left' || msg.type === 'peer_update') {
        setPeers((msg.peers as Peer[]) ?? []);
        return;
      }

      // ─ signal: unencrypted control message (ECDH key_req from joiner) ─
      if (msg.type === 'signal') {
        const data = msg.data as Record<string, unknown>;
        if (!data) return;
        if (data.meta === 'key_req' && cryptoKeyRef.current) {
          // A peer needs the room key — wrap it with their ECDH public key
          const fromId = msg.from as string;
          try {
            const peerPub = await importECDHPublicKey(data.pubKey as string);
            const { wrappedKey, ephemeralPub } = await wrapAESKey(cryptoKeyRef.current, peerPub);
            ws.send(
              JSON.stringify({
                type: 'dm',
                to: fromId,
                data: { meta: 'key_resp', wrappedKey, ephemeralPub },
              }),
            );
          } catch {
            /* ignore — peer may have disconnected */
          }
        }
        return;
      }

      // ─ dm: direct message routed by server (ECDH key_resp) ─
      if (msg.type === 'dm') {
        const data = msg.data as Record<string, unknown>;
        if (!data) return;
        if (data.meta === 'key_resp' && ecdhPairRef.current && !cryptoKeyRef.current) {
          try {
            const aesKey = await unwrapAESKey(
              data.wrappedKey as string,
              data.ephemeralPub as string,
              ecdhPairRef.current.privateKey,
            );
            const kb64New = await exportKey(aesKey);
            cryptoKeyRef.current = aesKey;
            keyB64Ref.current = kb64New;
            setKeyB64(kb64New);
            ecdhPairRef.current = null; // ECDH pair no longer needed
            setPhase('connected');
            history.replaceState(null, '', `#clipsync/${rid}/${kb64New}`);
          } catch {
            setErrorMsg('Key exchange failed — the room host may have gone offline. Try again.');
            setPhase('error');
            ws.close();
          }
        }
        return;
      }

      if (msg.type === 'error') {
        setErrorMsg((msg.message as string) ?? 'Room error.');
        setPhase('error');
        ws.close();
        return;
      }

      if (msg.type === 'pong') return;

      if (msg.type === 'message' && msg.payload && cryptoKeyRef.current) {
        const currentKey = cryptoKeyRef.current;
        try {
          const p = await decryptPayload(currentKey, msg.payload as string);
          setItems((prev) => [
            ...prev,
            {
              id: `${msg.sender as string}-${msg.ts as number}`,
              type: p.type,
              content: p.content,
              filename: p.filename,
              fileSize: p.fileSize,
              mimeType: p.mimeType,
              senderId: msg.sender as string,
              senderName: msg.senderName as string,
              ts: msg.ts as number,
              isOwn: (msg.sender as string) === myDeviceIdRef.current,
            },
          ]);
        } catch {
          /* tampered or wrong key — silently drop */
        }
      }
    };

    ws.onerror = () => {
      setErrorMsg('Connection failed. Check your network and try again.');
      setPhase('error');
    };
    ws.onclose = () => {
      setPhase((prev) => (prev === 'connected' || prev === 'key_exchange' ? 'error' : prev));
      setErrorMsg((prev) => prev || 'Disconnected from room.');
    };
  }

  // ── Actions ─────────────────────────────────────────────────────────────────

  const createRoom = async () => {
    try {
      const rid = genRoomId();
      const key = await generateKey();
      const kb64 = await exportKey(key);
      cryptoKeyRef.current = key;
      connectToRoom(rid, kb64, key);
    } catch {
      setErrorMsg('Failed to generate room. Your browser may not support WebCrypto.');
    }
  };

  const joinRoom = async () => {
    setErrorMsg('');
    const parsed = parseJoinInput(joinInput);
    if (!parsed) {
      setErrorMsg('Enter a 6-character room code, an invite code, or paste the full room link.');
      return;
    }
    const { roomId: rid, keyB64: kb64 } = parsed;

    // Joining with just the room code — ECDH key exchange runs automatically
    if (!kb64) {
      connectToRoom(rid, null, null);
      return;
    }

    try {
      const key = await importKey(kb64);
      cryptoKeyRef.current = key;
      connectToRoom(rid, kb64, key);
    } catch {
      setErrorMsg('Invalid encryption key in the link.');
    }
  };

  const leaveRoom = () => {
    wsRef.current?.close();
    wsRef.current = null;
    cryptoKeyRef.current = null;
    ecdhPairRef.current = null;
    setPhase('idle');
    setRoomId('');
    setKeyB64('');
    setMyDeviceId('');
    setPeers([]);
    setItems([]);
    setShowQR(false);
    setQrDataUrl('');
    setErrorMsg('');
    history.replaceState(null, '', window.location.pathname + window.location.search);
  };

  const sendText = async () => {
    const text = textInput.trim();
    if (!text || !cryptoKeyRef.current || wsRef.current?.readyState !== WebSocket.OPEN) return;
    setSendError('');
    try {
      const encrypted = await encryptPayload(cryptoKeyRef.current, { type: 'text', content: text });
      wsRef.current.send(JSON.stringify({ type: 'relay', payload: encrypted }));
      setItems((prev) => [
        ...prev,
        {
          id: `own-${Date.now()}-${Math.random()}`,
          type: 'text',
          content: text,
          senderId: myDeviceId,
          senderName: 'You',
          ts: Date.now(),
          isOwn: true,
        },
      ]);
      setTextInput('');
    } catch {
      setSendError('Failed to encrypt. Try again.');
    }
  };

  const sendFile = async (file: File) => {
    setSendError('');
    if (!cryptoKeyRef.current || wsRef.current?.readyState !== WebSocket.OPEN) return;
    if (file.size > FILE_LIMIT) {
      setSendError(`File too large. Max ${fmtSize(FILE_LIMIT)}.`);
      return;
    }
    try {
      const isImage = file.type.startsWith('image/');
      const content = await fileToBase64(file);
      const payload: ClipPayload = {
        type: isImage ? 'image' : 'file',
        content,
        filename: file.name,
        fileSize: file.size,
        mimeType: file.type,
      };
      const encrypted = await encryptPayload(cryptoKeyRef.current, payload);
      wsRef.current.send(JSON.stringify({ type: 'relay', payload: encrypted }));
      setItems((prev) => [
        ...prev,
        {
          id: `own-${Date.now()}-${Math.random()}`,
          ...payload,
          senderId: myDeviceId,
          senderName: 'You',
          ts: Date.now(),
          isOwn: true,
        },
      ]);
    } catch {
      setSendError('Failed to process file. It may be too large or unsupported.');
    }
  };

  const pasteClipboard = async () => {
    setSendError('');
    try {
      const text = await navigator.clipboard.readText();
      if (text) setTextInput(text);
    } catch {
      setSendError('Clipboard access denied. Grant permission in browser settings.');
    }
  };

  const copyLink = async () => {
    await navigator.clipboard.writeText(getRoomUrl(roomId, keyB64));
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2500);
  };

  const copyInviteCode = async () => {
    await navigator.clipboard.writeText(makeInviteCode(roomId, keyB64));
    setCodeCopied(true);
    setTimeout(() => setCodeCopied(false), 2500);
  };

  const copyItemContent = async (item: ClipItem) => {
    try {
      if (item.type === 'text') {
        await navigator.clipboard.writeText(item.content);
      } else if (item.type === 'image') {
        const bytes = Uint8Array.from(atob(item.content), (c) => c.charCodeAt(0));
        const blob = new Blob([bytes], { type: item.mimeType || 'image/png' });
        await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
      }
      setCopiedId(item.id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      /* permission denied */
    }
  };

  // ── Drag-and-drop ───────────────────────────────────────────────────────────

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    setDragging(true);
  };
  const handleDragLeave = (e: DragEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragging(false);
  };
  const handleDrop = async (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) await sendFile(file);
  };
  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) await sendFile(file);
    e.target.value = '';
  };

  const handleTextKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendText();
    }
  };

  // ── Idle / Error screen ─────────────────────────────────────────────────────

  if (phase === 'idle' || phase === 'error') {
    return (
      <div className="h-full flex flex-col items-center justify-start sm:justify-center px-4 py-8 overflow-y-auto">
        <div className="w-full max-w-xl">
          {/* Hero */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-lg shadow-indigo-500/30 mb-4">
              <Link2 className="w-7 h-7 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">ClipSync</h1>
            <p className="text-slate-400 text-sm max-w-sm mx-auto leading-relaxed">
              Share text, files and images between all your devices — instantly, with{' '}
              <span className="text-indigo-400 font-medium">end-to-end encryption</span>.
            </p>
            <div className="mt-3 inline-flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-3 py-1">
              <Lock className="w-3 h-3" />
              <span>AES-256-GCM · Server only relays encrypted blobs</span>
            </div>
          </div>

          {/* Error banner */}
          {phase === 'error' && errorMsg && (
            <div className="mb-5 flex items-start gap-2.5 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-sm text-red-400">
              <X className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Create / Join cards */}
          <div className="grid sm:grid-cols-2 gap-4 mb-6">
            {/* Create */}
            <div className="bg-slate-900/60 border border-slate-700/50 rounded-2xl p-5 flex flex-col gap-4">
              <div>
                <h2 className="text-sm font-semibold text-white mb-1.5">New room</h2>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Create an encrypted room. Share the link or QR code with your other devices to
                  connect.
                </p>
              </div>
              <Button
                onClick={createRoom}
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-medium"
              >
                <Plus className="w-4 h-4 mr-2" />
                Create Room
              </Button>
            </div>

            {/* Join */}
            <div className="bg-slate-900/60 border border-slate-700/50 rounded-2xl p-5 flex flex-col gap-3">
              <div>
                <h2 className="text-sm font-semibold text-white mb-1.5">Join existing room</h2>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Enter the{' '}
                  <span className="text-white font-mono font-bold tracking-wider text-[11px]">
                    6-char code
                  </span>{' '}
                  shown on the host device, or paste the full link for instant join.
                </p>
              </div>
              <Input
                placeholder="A4K7R2 · or paste full link…"
                value={joinInput}
                onChange={(e) => setJoinInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && joinRoom()}
                className="bg-slate-800/70 border-slate-700 text-sm h-9 text-white placeholder:text-slate-500 font-mono tracking-wide uppercase"
              />
              <Button
                variant="outline"
                onClick={joinRoom}
                className="w-full border-slate-700 hover:border-indigo-500 hover:text-white text-slate-300"
              >
                <ArrowRight className="w-4 h-4 mr-2" />
                Join Room
              </Button>
            </div>
          </div>

          {/* How it works */}
          <div className="bg-slate-900/40 border border-slate-800/50 rounded-xl p-4">
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-3">
              How it works
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              {[
                {
                  n: '1',
                  t: 'Create a room',
                  d: 'A 256-bit key is generated in your browser only. You get a 6-char code to share.',
                },
                {
                  n: '2',
                  t: 'Share the code',
                  d: 'Say the 6-char code aloud, type it, or scan the QR. Key exchange happens automatically via ECDH.',
                },
                {
                  n: '3',
                  t: 'Zero server knowledge',
                  d: 'AES-256-GCM encrypts everything before it leaves your device. Server only routes ciphertext.',
                },
              ].map(({ n, t, d }) => (
                <div key={n} className="flex gap-3 flex-1">
                  <span className="w-5 h-5 rounded-full bg-indigo-500/20 text-indigo-400 text-xs flex items-center justify-center shrink-0 mt-0.5 font-bold">
                    {n}
                  </span>
                  <div>
                    <p className="text-xs font-medium text-slate-300">{t}</p>
                    <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{d}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Connecting spinner ──────────────────────────────────────────────────────

  if (phase === 'connecting') {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-3 text-slate-400">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
        <p className="text-sm">Connecting to room…</p>
      </div>
    );
  }

  // ── Connected room screen ───────────────────────────────────────────────────

  const roomUrl = getRoomUrl(roomId, keyB64);

  return (
    <div className="h-full flex flex-col min-h-0 gap-3 overflow-hidden">
      {/* ── Top bar ── */}
      <div className="flex items-center gap-2 flex-wrap shrink-0">
        {/* Room code pill — the prominent 6-char code users share verbally */}
        <div className="flex items-center gap-2 bg-slate-900/60 border border-slate-700/40 rounded-xl px-3 py-2 min-w-0 flex-1">
          <Lock className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <span className="text-[11px] text-slate-500 shrink-0 hidden sm:inline">Code</span>
          {/* Large readable code — letter-spaced for easy reading aloud */}
          <code
            className="text-sm font-mono font-bold tracking-[0.25em] text-white px-2 py-0.5 rounded bg-slate-800/70 cursor-pointer select-all"
            title="Room code — type this on another device to join"
            onClick={copyInviteCode}
          >
            {roomId.toUpperCase()}
          </code>
          <div className="flex items-center gap-1 ml-auto shrink-0">
            <button
              onClick={copyInviteCode}
              title="Copy 6-char room code (fastest way to join)"
              className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors px-2 py-1 rounded-md hover:bg-slate-800/60"
            >
              {codeCopied ? (
                <Check className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <ClipboardCopy className="w-3.5 h-3.5" />
              )}
              <span className="hidden md:inline">{codeCopied ? 'Copied!' : 'Copy code'}</span>
            </button>
            <button
              onClick={copyLink}
              title="Copy full room link (includes key — instant join for the recipient)"
              className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors px-2 py-1 rounded-md hover:bg-slate-800/60"
            >
              {linkCopied ? (
                <Check className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
              <span className="hidden md:inline">{linkCopied ? 'Copied!' : 'Copy link'}</span>
            </button>
            <button
              onClick={() => {
                setShowQR((v) => !v);
              }}
              title="Show QR code"
              className={[
                'flex items-center gap-1.5 text-xs transition-colors px-2 py-1 rounded-md',
                showQR
                  ? 'text-indigo-400 bg-indigo-500/10'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60',
              ].join(' ')}
            >
              <QrCode className="w-3.5 h-3.5" />
              <span className="hidden md:inline">QR</span>
            </button>
          </div>
        </div>

        {/* Peer count */}
        <button
          onClick={() => setShowDevices((v) => !v)}
          className="flex items-center gap-1.5 bg-slate-900/60 border border-slate-700/40 rounded-xl px-3 py-2 text-xs text-slate-400 hover:text-white transition-colors shrink-0"
        >
          <Users className="w-3.5 h-3.5 text-emerald-400" />
          <span>
            {peers.length} device{peers.length !== 1 ? 's' : ''}
          </span>
          {showDevices ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </button>

        {/* Leave */}
        <button
          onClick={leaveRoom}
          className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors px-3 py-2 rounded-xl border border-slate-700/40 bg-slate-900/60 shrink-0"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Leave</span>
        </button>
      </div>

      {/* ── Collapsed devices panel ── */}
      {showDevices && (
        <div className="shrink-0 flex flex-wrap gap-2 bg-slate-900/40 border border-slate-800/50 rounded-xl p-3">
          {peers.map((p) => (
            <div
              key={p.deviceId}
              className="flex items-center gap-1.5 bg-slate-800/50 rounded-lg px-2.5 py-1.5 text-xs"
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${p.deviceId === myDeviceId ? 'bg-indigo-400' : 'bg-emerald-400'}`}
              />
              <span className="text-slate-300">
                {p.deviceId === myDeviceId ? `You (${p.deviceName})` : p.deviceName}
              </span>
            </div>
          ))}
          <div className="flex items-center gap-1 text-[10px] text-slate-600 ml-auto self-center">
            <Shield className="w-3 h-3" /> E2E encrypted
          </div>
        </div>
      )}

      {/* ── QR panel ── */}
      {showQR && (
        <div className="shrink-0 flex items-start gap-4 bg-slate-900/60 border border-slate-700/40 rounded-xl p-4">
          {qrDataUrl ? (
            <img
              src={qrDataUrl}
              alt="QR code to join room"
              className="w-[120px] h-[120px] rounded-xl shrink-0"
            />
          ) : (
            <div className="w-[120px] h-[120px] rounded-xl bg-slate-800 animate-pulse shrink-0" />
          )}
          <div className="flex-1 min-w-0 flex flex-col gap-3">
            <div>
              <p className="text-sm font-semibold text-white mb-1">
                Scan to join on another device
              </p>
              <p className="text-xs text-slate-400 leading-relaxed">
                The 256-bit encryption key is embedded in both the QR code and the invite code —
                your server never receives it.
              </p>
            </div>
            {/* Invite code — primary share mechanism */}
            <div>
              <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                Invite code
              </p>
              <div className="relative group">
                <code className="block text-[11px] font-mono text-indigo-300 bg-slate-800/70 rounded-lg p-2.5 break-all leading-relaxed pr-8 select-all">
                  {makeInviteCode(roomId, keyB64)}
                </code>
                <button
                  onClick={copyInviteCode}
                  className="absolute top-1.5 right-1.5 p-1 rounded-md bg-slate-700/70 hover:bg-slate-600/70 text-slate-400 hover:text-white transition-colors"
                  title="Copy invite code"
                >
                  {codeCopied ? (
                    <Check className="w-3 h-3 text-emerald-400" />
                  ) : (
                    <ClipboardCopy className="w-3 h-3" />
                  )}
                </button>
              </div>
              <p className="text-[10px] text-slate-600 mt-1">
                Paste this in the “Join existing room” box on any device.
              </p>
            </div>
            {/* Full URL (for opening in browser) */}
            <div>
              <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                Full link
              </p>
              <div className="relative group">
                <code className="block text-[10px] font-mono text-slate-500 bg-slate-800/70 rounded-lg p-2.5 break-all leading-relaxed pr-8 select-all">
                  {roomUrl}
                </code>
                <button
                  onClick={copyLink}
                  className="absolute top-1.5 right-1.5 p-1 rounded-md bg-slate-700/70 hover:bg-slate-600/70 text-slate-400 hover:text-white transition-colors"
                  title="Copy full link"
                >
                  {linkCopied ? (
                    <Check className="w-3 h-3 text-emerald-400" />
                  ) : (
                    <Copy className="w-3 h-3" />
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Main: feed + compose ── */}
      <div className="flex-1 min-h-0 flex flex-col gap-3 overflow-hidden">
        {/* Message feed */}
        <div
          ref={feedRef}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={[
            'flex-1 min-h-0 overflow-y-auto rounded-xl border transition-all duration-200',
            dragging
              ? 'border-indigo-500/60 bg-indigo-500/5 ring-2 ring-indigo-500/20'
              : 'border-slate-800/50 bg-slate-900/30',
          ].join(' ')}
        >
          {items.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-8">
              <div className="w-12 h-12 rounded-2xl bg-slate-800/70 flex items-center justify-center mb-3">
                {dragging ? (
                  <Download className="w-5 h-5 text-indigo-400" />
                ) : (
                  <Link2 className="w-5 h-5 text-slate-600" />
                )}
              </div>
              <p className="text-sm text-slate-500">
                {dragging ? 'Drop to share' : 'No shared items yet'}
              </p>
              <p className="text-xs text-slate-600 mt-1">
                {dragging ? '' : 'Type a message or drop a file from another device to get started'}
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-2 p-3">
              {items.map((item) => (
                <ClipItemCard
                  key={item.id}
                  item={item}
                  copiedId={copiedId}
                  onCopy={copyItemContent}
                  onDownload={downloadBase64File}
                />
              ))}
            </div>
          )}
        </div>

        {/* Compose */}
        <div className="shrink-0 bg-slate-900/50 border border-slate-800/50 rounded-xl p-3 flex flex-col gap-2">
          <Textarea
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            onKeyDown={handleTextKeyDown}
            placeholder="Type or paste text… (Enter to send · Shift+Enter for new line)"
            rows={3}
            className="resize-none bg-slate-800/50 border-slate-700/50 text-sm text-white placeholder:text-slate-500 focus-visible:ring-indigo-500/40 focus-visible:border-indigo-500/40"
          />
          <div className="flex items-center gap-2 flex-wrap">
            <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileChange} />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors px-2.5 py-1.5 rounded-lg border border-slate-700/50 hover:border-slate-600 bg-slate-800/40"
            >
              <Paperclip className="w-3.5 h-3.5" />
              <span>Attach</span>
            </button>
            <button
              onClick={pasteClipboard}
              className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors px-2.5 py-1.5 rounded-lg border border-slate-700/50 hover:border-slate-600 bg-slate-800/40"
            >
              <ClipboardCopy className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Paste clipboard</span>
              <span className="sm:hidden">Paste</span>
            </button>
            <div className="flex-1" />
            {sendError && (
              <span className="text-xs text-red-400 flex items-center gap-1">
                <X className="w-3 h-3" />
                {sendError}
              </span>
            )}
            <Button
              onClick={sendText}
              disabled={!textInput.trim() || wsRef.current?.readyState !== WebSocket.OPEN}
              size="sm"
              className="bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-40"
            >
              <Send className="w-3.5 h-3.5 mr-1.5" />
              Send
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── ClipItemCard ─────────────────────────────────────────────────────────────

interface CardProps {
  item: ClipItem;
  copiedId: string | null;
  onCopy: (item: ClipItem) => void;
  onDownload: (content: string, filename: string, mimeType: string) => void;
}

function ClipItemCard({ item, copiedId, onCopy, onDownload }: CardProps) {
  const time = new Date(item.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const [expanded, setExpanded] = useState(false);
  const isCopied = copiedId === item.id;
  const isLongText = item.type === 'text' && item.content.length > 300;

  return (
    <div
      className={[
        'group relative rounded-xl border text-sm transition-all',
        item.isOwn
          ? 'bg-indigo-500/10 border-indigo-500/20 sm:ml-10'
          : 'bg-slate-800/50 border-slate-700/30 sm:mr-10',
      ].join(' ')}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 pt-2.5 pb-1 gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {item.type === 'text' && (
            <Badge className="hidden sm:flex bg-slate-700/60 text-slate-300 text-[10px] px-1.5 py-0 h-4 border-0 gap-1">
              <span>text</span>
            </Badge>
          )}
          {item.type === 'image' && (
            <Badge className="hidden sm:flex bg-violet-500/20 text-violet-300 text-[10px] px-1.5 py-0 h-4 border-0 gap-1">
              <ImageIcon className="w-2.5 h-2.5" />
              <span>image</span>
            </Badge>
          )}
          {item.type === 'file' && (
            <Badge className="hidden sm:flex bg-slate-700/60 text-slate-300 text-[10px] px-1.5 py-0 h-4 border-0 gap-1">
              <FileIcon className="w-2.5 h-2.5" />
              <span>file</span>
            </Badge>
          )}
          <span
            className={`text-[11px] font-medium truncate ${item.isOwn ? 'text-indigo-400' : 'text-slate-300'}`}
          >
            {item.isOwn ? 'You' : item.senderName}
          </span>
          <span className="text-[10px] text-slate-600 shrink-0">{time}</span>
        </div>
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          {(item.type === 'text' || item.type === 'image') && (
            <button
              onClick={() => onCopy(item)}
              className="p-1.5 rounded-md hover:bg-slate-700/60 text-slate-400 hover:text-white transition-colors"
              title="Copy"
            >
              {isCopied ? (
                <Check className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
            </button>
          )}
          {(item.type === 'file' || item.type === 'image') && item.filename && (
            <button
              onClick={() => onDownload(item.content, item.filename!, item.mimeType ?? '')}
              className="p-1.5 rounded-md hover:bg-slate-700/60 text-slate-400 hover:text-white transition-colors"
              title="Download"
            >
              <Download className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="px-3 pb-3">
        {item.type === 'text' && (
          <>
            <p
              className={`text-slate-200 whitespace-pre-wrap break-words leading-relaxed ${!expanded && isLongText ? 'line-clamp-5' : ''}`}
            >
              {item.content}
            </p>
            {isLongText && (
              <button
                onClick={() => setExpanded((v) => !v)}
                className="mt-1 text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
              >
                {expanded ? 'Show less' : `Show all (${item.content.length} chars)`}
              </button>
            )}
          </>
        )}

        {item.type === 'image' && (
          <div>
            <img
              src={`data:${item.mimeType ?? 'image/png'};base64,${item.content}`}
              alt={item.filename ?? 'image'}
              className="max-h-56 rounded-lg object-contain border border-slate-700/40 cursor-zoom-in"
              onClick={() => {
                const w = window.open('', '_blank');
                if (w)
                  w.document.write(
                    `<html><body style="margin:0;background:#000;display:flex;align-items:center;justify-content:center;min-height:100vh"><img src="data:${item.mimeType ?? 'image/png'};base64,${item.content}" style="max-width:100%;max-height:100vh;object-fit:contain"></body></html>`,
                  );
              }}
            />
            {item.filename && (
              <p className="text-[11px] text-slate-500 mt-1.5">
                {item.filename} · {fmtSize(item.fileSize ?? 0)}
              </p>
            )}
          </div>
        )}

        {item.type === 'file' && (
          <div className="flex items-center gap-3 py-0.5">
            <div className="w-9 h-9 rounded-lg bg-slate-700/50 flex items-center justify-center shrink-0">
              <FileIcon className="w-4 h-4 text-indigo-400" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-slate-200 truncate font-medium">{item.filename ?? 'file'}</p>
              <p className="text-xs text-slate-500">
                {fmtSize(item.fileSize ?? 0)} · {item.mimeType || 'binary'}
              </p>
            </div>
            <button
              onClick={() => onDownload(item.content, item.filename!, item.mimeType ?? '')}
              className="flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 transition-colors shrink-0 border border-indigo-500/30 hover:border-indigo-400/50 rounded-lg px-2.5 py-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              Download
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
