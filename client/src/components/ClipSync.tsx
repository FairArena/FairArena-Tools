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
  RotateCw,
  Slash,
  ToggleLeft,
  ToggleRight,
  Mic,
  Square,
  Camera,
  MapPin,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useToast } from './ToastProvider';
import { PendingApprovalScreen } from './PendingApprovalScreen';

// ─── Types ────────────────────────────────────────────────────────────────────

type Phase = 'idle' | 'connecting' | 'connected' | 'key_exchange' | 'pending' | 'error';
type ItemType = 'text' | 'file' | 'image' | 'audio' | 'video' | 'binary' | 'location';

interface ClipItem {
  id: string;
  type: ItemType;
  /** Plain text content, or raw base64 bytes (no data-url prefix) for file/image */
  content: string;
  filename?: string;
  fileSize?: number;
  mimeType?: string;
  viewOnce?: boolean;
  expiresAt?: number;
  sensitivity?: 'normal' | 'password';
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
  viewOnce?: boolean;
  expiresAt?: number;
  sensitivity?: 'normal' | 'password';
  // Chunked upload fields (for files > 1MB)
  isChunk?: boolean;
  chunkIndex?: number;
  totalChunks?: number;
  fileId?: string;
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

async function fileToBase64(file: File | Blob): Promise<string> {
  const buf = await file.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let binary = '';
  const chunk = 8192;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, Math.min(i + chunk, bytes.length)));
  }
  return btoa(binary);
}

// Reassemble base64 chunks into a single base64 string
function reassembleBase64Chunks(chunks: ClipPayload[]): string {
  // Merge all base64 content (remove padding from all but last)
  let result = '';
  for (const chunk of chunks) {
    const b64 = chunk.content;
    // Remove padding from all but the last chunk for safe concatenation
    const padless = b64.replace(/=/g, '');
    result += padless;
  }
  // Re-add padding to the combined string (multiple of 4)
  const padding = result.length % 4 === 0 ? '' : '='.repeat(4 - (result.length % 4));
  return result + padding;
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

function getRoomUrl(roomId: string): string {
  const base = window.location.origin + window.location.pathname;
  // SECURITY: Never include encryption key in URL - only PIN code
  return `${base}#clipsync/${roomId}`;
}

/**
 * Shareable PIN code only (no encryption key).
 * SECURITY: Keys are never included in shareable links.
 */
function makeInviteCode(roomId: string): string {
  return roomId.toUpperCase();
}

function normalizeRoomCode(raw: unknown): string {
  return String(raw ?? '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 6);
}

function parseRoomHash(hash: string): { roomId: string } | null {
  const m = hash.match(/^#clipsync\/([a-zA-Z0-9]{6})$/);
  if (!m) return null;
  return { roomId: m[1].toLowerCase() };
}

/**
 * Accept only PIN-only room codes.
 * SECURITY: Reject any invite codes containing encryption keys.
 * Returns null when the input is unrecognisable.
 */
function parseJoinInput(
  raw: string,
): { roomId: string } | null {
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

  // SECURITY: Reject any input with dots (would indicate key was embedded)
  if (s.includes('.')) {
    console.warn('Rejecting invite code: key-based invites are not allowed');
    return null;
  }

  // Bare room code — strict 6-char PIN
  const code = s.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (code.length === 6) return { roomId: code };
  return null;
}

const FILE_LIMIT = 50 * 1024 * 1024; // 50 MB for Phase 3
const CHUNK_SIZE = 1 * 1024 * 1024; // 1 MB chunks for large file upload

// ─── Main component ───────────────────────────────────────────────────────────

export function ClipSync() {
  const [phase, setPhase] = useState<Phase>('idle');
  const [roomId, setRoomId] = useState('');
  const [keyB64, setKeyB64] = useState('');
  const [myDeviceId, setMyDeviceId] = useState('');
  const [ownerDeviceId, setOwnerDeviceId] = useState('');
  const [peers, setPeers] = useState<Peer[]>([]);
  const [joinRequests, setJoinRequests] = useState<Array<{ deviceId: string; deviceName: string; ecdhPub?: string }>>([]);
  const peerEcdhKeysRef = useRef<Map<string, string>>(new Map()); // Store peer ECDH public keys for key rotation
  const [items, setItems] = useState<ClipItem[]>([]);
  const [textInput, setTextInput] = useState('');
  const [viewOnceMode, setViewOnceMode] = useState(false);
  const [passwordMode, setPasswordMode] = useState(false);
  const [expiryMode, setExpiryMode] = useState<'none' | '60' | '300' | '3600'>('none');
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
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [acceptingNewJoins, setAcceptingNewJoins] = useState(true);
  const [, setDisplayCode] = useState<string>('');
  const [, setUploadProgress] = useState<Record<string, number>>({});

  const wsRef = useRef<WebSocket | null>(null);
  const cryptoKeyRef = useRef<CryptoKey | null>(null);
  const ecdhPairRef = useRef<CryptoKeyPair | null>(null);
  const myDeviceIdRef = useRef('');
  const feedRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const cameraVideoRef = useRef<HTMLVideoElement>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const keyB64Ref = useRef('');
  const roomIdRef = useRef('');
  const chunksRef = useRef<Map<string, Map<number, ClipPayload>>>(new Map()); // fileId -> chunkIndex -> payload

  // Toast notifications
  const toast = useToast();

  // Derived value: is current device the room owner?
  const isOwner = myDeviceId && ownerDeviceId && myDeviceId === ownerDeviceId;

  // Scroll feed to bottom on new items
  useEffect(() => {
    if (feedRef.current) feedRef.current.scrollTop = feedRef.current.scrollHeight;
  }, [items]);

  // QR code (dynamic import so qrcode is code-split) - PIN-only mode
  useEffect(() => {
    if (!showQR || !roomId) return;
    let cancelled = false;
    // SECURITY: QR always encodes PIN-only URL; no keys embedded
    const url = getRoomUrl(roomId);
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

  // Auto-join from URL hash on mount (PIN-only mode)
  useEffect(() => {
    const parsed = parseRoomHash(window.location.hash);
    if (parsed) {
      // SECURITY: All URLs are PIN-only; no embedded keys
      setJoinInput(parsed.roomId.toUpperCase());
      connectToRoom(parsed.roomId, null, null);
    }
    // connectToRoom is defined inside render scope — safe to pass [] since it only runs on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── WebSocket connection ────────────────────────────────────────────────────

  // kb64 / key may be null when joining with just the 6-char room code.
  // In that case, ECDH key exchange is initiated automatically after joining.
  function connectToRoom(rid: string, kb64: string | null, key: CryptoKey | null) {
    setPhase('connecting');
    setErrorMsg('');
    const normalizedRid = normalizeRoomCode(rid);
    setRoomId(normalizedRid);
    setKeyB64(kb64 ?? '');
    roomIdRef.current = normalizedRid;
    keyB64Ref.current = kb64 ?? '';

    const ws = new WebSocket(`${CLIP_WS_BASE}/clipsync`);
    wsRef.current = ws;

    ws.onopen = async () => {
      // If we don't already have the AES key, prepare an ECDH public key so the owner
      // can perform an authenticated key wrap after approving.
      let ecdhPub: string | null = null;
      if (!key) {
        try {
          if (!ecdhPairRef.current) {
            const pair = await generateECDHKeyPair();
            ecdhPairRef.current = pair;
          }
          ecdhPub = await exportECDHPublicKey(ecdhPairRef.current!.publicKey);
        } catch {
          /* ignore */
        }
      }
      ws.send(JSON.stringify({ type: 'join', roomId: normalizedRid, deviceName: getDeviceName(), hasKey: false, ecdhPub }));
    };

    ws.onmessage = async (evt) => {
      let msg: Record<string, unknown>;
      try {
        msg = JSON.parse(evt.data as string) as Record<string, unknown>;
      } catch {
        return;
      }

      if (msg.type === 'joined') {
        const roomCode = normalizeRoomCode((msg.roomCode as string) ?? normalizedRid);
        myDeviceIdRef.current = msg.deviceId as string;
        setMyDeviceId(msg.deviceId as string);
        setRoomId(roomCode);
        roomIdRef.current = roomCode;
        setOwnerDeviceId((msg.ownerDeviceId as string) ?? '');
        setPeers((msg.peers as Peer[]) ?? []);
        setDisplayCode((msg.displayCode as string) ?? '');
        setAcceptingNewJoins((msg.acceptingNewJoins as boolean) ?? true);
        if (key) {
          // Already have the AES key (joined via invite code / URL)
          setPhase('connected');
          history.replaceState(null, '', `#clipsync/${roomCode}`);
        } else {
          // No key — initiate ECDH key request
          setPhase('key_exchange');
          try {
            const pair = ecdhPairRef.current ?? (await generateECDHKeyPair());
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

      // Owner: incoming join request to approve/reject
      if (msg.type === 'join_request') {
        const from = msg.from as string;
        const name = (msg.deviceName as string) ?? 'Device';
        const ecdhPub = (msg.ecdhPub as string) ?? null;
        setJoinRequests((s) =>
          s.some((r) => r.deviceId === from) ? s : [...s, { deviceId: from, deviceName: name, ecdhPub }],
        );
        return;
      }

      if (msg.type === 'pending_request_removed') {
        const removedId = String(msg.deviceId ?? '');
        if (removedId) {
          setJoinRequests((s) => s.filter((r) => r.deviceId !== removedId));
        }
        return;
      }

      // Joiner: pending approval message
      if (msg.type === 'pending') {
        setPhase('pending');
        setErrorMsg((msg.message as string) ?? 'Awaiting owner approval...');
        return;
      }

      // When peer is approved and moved to peers, we get a second 'joined' message
      // If we already have crypto key (from DM deliver), just move to connected
      if (msg.type === 'joined' && phase === 'pending' && cryptoKeyRef.current) {
        myDeviceIdRef.current = msg.deviceId as string;
        setMyDeviceId(msg.deviceId as string);
        setOwnerDeviceId((msg.ownerDeviceId as string) ?? '');
        setPeers((msg.peers as Peer[]) ?? []);
        setPhase('connected');
        return;
      }

      if (msg.type === 'rejected') {
        setErrorMsg((msg.message as string) ?? 'Join request rejected by owner.');
        setPhase('idle');
        ws.close();
        return;
      }

      if (msg.type === 'peer_joined' || msg.type === 'peer_left' || msg.type === 'peer_update') {
        setPeers((msg.peers as Peer[]) ?? []);
        const peerIds = new Set(((msg.peers as Peer[]) ?? []).map((p) => p.deviceId));
        setJoinRequests((s) => s.filter((r) => !peerIds.has(r.deviceId)));
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

      // ─ dm: direct message routed by server (ECDH key_resp or key_rotation) ─
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
            // KEEP ecdhPairRef for future key rotations — don't set to null
            setPhase('connected');
            history.replaceState(null, '', `#clipsync/${roomIdRef.current}`);
          } catch {
            setErrorMsg('Key exchange failed — the room host may have gone offline. Try again.');
            setPhase('error');
            ws.close();
          }
        }
        // Handle key rotation: unwrap new key from owner
        if (data.meta === 'key_rotation' && ecdhPairRef.current) {
          try {
            const newKey = await unwrapAESKey(
              data.wrappedKey as string,
              data.ephemeralPub as string,
              ecdhPairRef.current.privateKey,
            );
            cryptoKeyRef.current = newKey;
            const kb64New = await exportKey(newKey);
            keyB64Ref.current = kb64New;
            setKeyB64(kb64New);
            toast.show('Encryption key rotated by owner');
          } catch (err) {
            console.warn('Key rotation unwrap failed:', err);
          }
        }
        return;
      }

      if (msg.type === 'error') {
        const message = (msg.message as string) ?? 'Room error.';
        // Non-fatal backend errors while connected should not tear down the room UI.
        if (phase === 'connected' || phase === 'pending') {
          setSendError(message);
          toast.show(message);
        } else {
          setErrorMsg(message);
          setPhase('error');
          ws.close();
        }
        return;
      }

      if (msg.type === 'pong') return;

      // Handle kicked from room
      if (msg.type === 'kicked') {
        setErrorMsg((msg.message as string) ?? 'You were removed from the room.');
        setPhase('error');
        ws.close();
        return;
      }

      // Handle room setting changes
      if (msg.type === 'room_setting_changed') {
        const setting = msg.setting as string;
        const value = msg.value as boolean;
        if (setting === 'acceptingNewJoins') {
          setAcceptingNewJoins(value);
          toast.show(`Room now ${value ? 'accepting' : 'not accepting'} new join requests`);
        }
        return;
      }

      // Handle room code rotation
      if (msg.type === 'room_code_rotated') {
        const newCode = normalizeRoomCode((msg.roomCode as string) ?? (msg.newCode as string) ?? '');
        if (newCode) {
          setRoomId(newCode);
          roomIdRef.current = newCode;
          history.replaceState(null, '', `#clipsync/${newCode}`);
          setJoinInput(newCode);
        }
        setDisplayCode(newCode);
        toast.show(`Invite code rotated to: ${newCode}`);
        return;
      }

      if (msg.type === 'message' && msg.payload && cryptoKeyRef.current) {
        const currentKey = cryptoKeyRef.current;
        try {
          const p = await decryptPayload(currentKey, msg.payload as string);
          
          // Handle chunked files
          if (p.isChunk && p.fileId && p.totalChunks !== undefined) {
            // Initialize chunk store for this fileId if needed
            if (!chunksRef.current.has(p.fileId)) {
              chunksRef.current.set(p.fileId, new Map());
            }
            const fileChunks = chunksRef.current.get(p.fileId)!;
            fileChunks.set(p.chunkIndex ?? 0, p);
            
            // Check if all chunks received
            if (fileChunks.size === p.totalChunks) {
              // Reassemble chunks in order
              const orderedChunks: ClipPayload[] = [];
              for (let i = 0; i < p.totalChunks; i++) {
                const chunk = fileChunks.get(i);
                if (!chunk) return; // Missing a chunk, wait
                orderedChunks.push(chunk);
              }
              
              // Merge base64 content
              const reassembledBase64 = reassembleBase64Chunks(orderedChunks);
              
              // Add reassembled item (use metadata from first chunk)
              const first = orderedChunks[0];
              setItems((prev) => [
                ...prev,
                {
                  id: `${msg.sender as string}-${msg.ts as number}`,
                  type: first.type,
                  content: reassembledBase64,
                  filename: first.filename,
                  fileSize: first.fileSize,
                  mimeType: first.mimeType,
                  viewOnce: first.viewOnce,
                  expiresAt: first.expiresAt,
                  sensitivity: first.sensitivity,
                  senderId: msg.sender as string,
                  senderName: msg.senderName as string,
                  ts: msg.ts as number,
                  isOwn: (msg.sender as string) === myDeviceIdRef.current,
                },
              ]);
              
              // Clean up chunk store
              chunksRef.current.delete(p.fileId);
            }
            return;
          }
          
          // Non-chunked message
          setItems((prev) => [
            ...prev,
            {
              id: `${msg.sender as string}-${msg.ts as number}`,
              type: p.type,
              content: p.content,
              filename: p.filename,
              fileSize: p.fileSize,
              mimeType: p.mimeType,
              viewOnce: p.viewOnce,
              expiresAt: p.expiresAt,
              sensitivity: p.sensitivity,
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
      keyB64Ref.current = kb64;
      // PIN-only mode: join without sharing key in URL
      // Key is kept locally and wrapped+sent to peers via ECDH after they request it
      connectToRoom(rid, null, key);
    } catch {
      setErrorMsg('Failed to generate room. Your browser may not support WebCrypto.');
    }
  };

  const joinRoom = async () => {
    setErrorMsg('');
    const parsed = parseJoinInput(joinInput);
    if (!parsed) {
      setErrorMsg('Enter a 6-character room code or paste a room link.');
      return;
    }
    const rid = normalizeRoomCode(parsed.roomId);

    // PIN-only mode: join with just the room code and await owner approval to receive key
    connectToRoom(rid, null, null);
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
      const expiresIn = expiryMode === 'none' ? 0 : Number(expiryMode);
      const expiresAt = expiresIn > 0 ? Date.now() + expiresIn * 1000 : undefined;
      const payload: ClipPayload = {
        type: 'text',
        content: text,
        viewOnce: viewOnceMode,
        expiresAt,
        sensitivity: passwordMode ? 'password' : 'normal',
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
      setTextInput('');
      setViewOnceMode(false);
      setPasswordMode(false);
      setExpiryMode('none');
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
      const itemType = isImage ? 'image' : (file.type.startsWith('audio/') ? 'audio' : (file.type.startsWith('video/') ? 'video' : 'binary'));
      const expiresIn = expiryMode === 'none' ? 0 : Number(expiryMode);
      const expiresAt = expiresIn > 0 ? Date.now() + expiresIn * 1000 : undefined;
      const sensitivity: ClipPayload['sensitivity'] = passwordMode ? 'password' : 'normal';
      
        // For files > CHUNK_SIZE (1MB), use chunked upload
        if (file.size > CHUNK_SIZE) {
        const fileId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
        const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
        
        for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
          const start = chunkIndex * CHUNK_SIZE;
          const end = Math.min((chunkIndex + 1) * CHUNK_SIZE, file.size);
          const chunk = file.slice(start, end);
          const chunkBase64 = await fileToBase64(chunk);
          
          const payload: ClipPayload = {
            type: itemType,
            content: chunkBase64,
            filename: file.name,
            fileSize: file.size,
            mimeType: file.type,
            viewOnce: viewOnceMode,
            expiresAt,
            sensitivity,
            isChunk: true,
            chunkIndex,
            totalChunks,
            fileId,
          };
          
          const encrypted = await encryptPayload(cryptoKeyRef.current, payload);
          wsRef.current?.send(JSON.stringify({ type: 'relay', payload: encrypted }));
          
          // Update progress
          const percent = Math.round(((chunkIndex + 1) / totalChunks) * 100);
          setUploadProgress(prev => ({ ...prev, [fileId]: percent }));
        }
        
        // Add item once all chunks sent
        setItems((prev) => [
          ...prev,
          {
            id: `own-${Date.now()}-${Math.random()}`,
            type: itemType,
            content: '', // Empty until reassembled
            filename: file.name,
            fileSize: file.size,
            mimeType: file.type,
            viewOnce: viewOnceMode,
            expiresAt,
            sensitivity,
            senderId: myDeviceId,
            senderName: 'You',
            ts: Date.now(),
            isOwn: true,
          },
        ]);
      } else {
        // For small files, send in one message
        const content = await fileToBase64(file);
        const payload: ClipPayload = {
          type: itemType,
          content,
          filename: file.name,
          fileSize: file.size,
          mimeType: file.type,
          viewOnce: viewOnceMode,
          expiresAt,
          sensitivity,
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
      }
      setViewOnceMode(false);
      setPasswordMode(false);
      setExpiryMode('none');
    } catch {
      setSendError('Failed to process file. It may be too large or unsupported.');
    }
  };

  // Audio recording for Phase 3: Media Sharing
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const startAudioRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      audioChunksRef.current = [];
      recorder.ondataavailable = (e) => audioChunksRef.current.push(e.data);
      recorder.onstop = async () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        if (blob.size > FILE_LIMIT) {
          setSendError(`Recording too large. Max ${fmtSize(FILE_LIMIT)}.`);
          return;
        }
        const reader = new FileReader();
        reader.onload = async (e) => {
          const base64 = (e.target?.result as string).split(',')[1];
          if (!cryptoKeyRef.current || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
          try {
            const payload: ClipPayload = {
              type: 'audio',
              content: base64,
              filename: `recording-${Date.now()}.webm`,
              mimeType: 'audio/webm',
              fileSize: blob.size,
            };
            const encrypted = await encryptPayload(cryptoKeyRef.current, payload);
            wsRef.current.send(JSON.stringify({ type: 'relay', payload: encrypted }));
            setItems((prev) => [...prev, { id: `own-${Date.now()}`, ...payload, senderId: myDeviceId, senderName: 'You', ts: Date.now(), isOwn: true }]);
            toast.show('Audio sent');
          } catch {
            setSendError('Failed to send audio');
          }
        };
        reader.readAsDataURL(blob);
        stream.getTracks().forEach((t) => t.stop());
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
      toast.show('Recording started...');
    } catch {
      setSendError('Microphone access denied. Grant permission in browser settings.');
    }
  };

  const stopAudioRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };


  // Owner approval handlers
  const approveRequest = async (deviceIdToApprove: string, ecdhPub?: string) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    // Store peer's ECDH public key for future key rotations
    if (ecdhPub) {
      peerEcdhKeysRef.current.set(deviceIdToApprove, ecdhPub);
    }
    // Wrap AES key and deliver via dm if we have the room key and the joiner provided an ECDH pub
    if (ecdhPub && cryptoKeyRef.current) {
      try {
        const peerPub = await importECDHPublicKey(ecdhPub);
        const { wrappedKey, ephemeralPub } = await wrapAESKey(cryptoKeyRef.current, peerPub);
        wsRef.current.send(JSON.stringify({ type: 'dm', to: deviceIdToApprove, data: { meta: 'key_resp', wrappedKey, ephemeralPub } }));
      } catch {
        /* ignore */
      }
    }
    // Tell server to approve (server will add peer to peers and notify everyone)
    wsRef.current.send(JSON.stringify({ type: 'approve', to: deviceIdToApprove }));
    setJoinRequests((s) => s.filter((r) => r.deviceId !== deviceIdToApprove));
  };

  const rejectRequest = (deviceIdToReject: string) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(JSON.stringify({ type: 'reject', to: deviceIdToReject }));
    setJoinRequests((s) => s.filter((r) => r.deviceId !== deviceIdToReject));
  };

  // Rotate encryption key (owner-only) — generates new AES key and wraps for each peer
  const rotateKey = async () => {
    if (!isOwner || !cryptoKeyRef.current || peers.length === 0) return;
    try {
      // Generate new AES-256-GCM key
      const newKey = await generateKey();
      cryptoKeyRef.current = newKey;
      
      // Wrap new key for each connected peer and send via dm
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        for (const peerId of peerEcdhKeysRef.current.keys()) {
          try {
            const ecdhPubB64 = peerEcdhKeysRef.current.get(peerId);
            if (ecdhPubB64) {
              const peerPub = await importECDHPublicKey(ecdhPubB64);
              const { wrappedKey, ephemeralPub } = await wrapAESKey(newKey, peerPub);
              wsRef.current.send(JSON.stringify({
                type: 'dm',
                to: peerId,
                data: { meta: 'key_rotation', wrappedKey, ephemeralPub }
              }));
            }
          } catch (err) {
            console.warn(`Failed to wrap key for peer ${peerId}:`, err);
          }
        }
        // Notify server to broadcast rotate_key to all peers
        wsRef.current.send(JSON.stringify({ type: 'rotate_key' }));
        toast.show('Encryption key rotated and delivered to all peers');
      }
    } catch (err) {
      toast.show(`Key rotation failed: ${String(err)}`);
    }
  };

  const kickPeer = (deviceId: string) => {
    if (!isOwner || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(JSON.stringify({ type: 'kick', to: deviceId }));
    toast.show('Peer removed from room');
  };

  const toggleAcceptingJoins = () => {
    if (!isOwner || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(JSON.stringify({ type: 'toggle_accepts_joins' }));
  };

  const rotateRoomCode = () => {
    if (!isOwner || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(JSON.stringify({ type: 'rotate_room_code' }));
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
    // PIN-only mode: all shareable links now use PIN, never keys
    await navigator.clipboard.writeText(getRoomUrl(roomId));
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2500);
  };

  const copyInviteCode = async () => {
    // SECURITY: Only copy the PIN, never the key
    await navigator.clipboard.writeText(makeInviteCode(roomId));
    setCodeCopied(true);
    setTimeout(() => setCodeCopied(false), 2500);
    toast.show('PIN copied to clipboard');
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

  const handleCameraFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) await sendFile(file);
    e.target.value = '';
  };

  const openCamera = async () => {
    setSendError('');
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        cameraInputRef.current?.click();
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      cameraStreamRef.current = stream;
      setIsCameraOpen(true);
      setTimeout(() => {
        if (cameraVideoRef.current) {
          cameraVideoRef.current.srcObject = stream;
          void cameraVideoRef.current.play();
        }
      }, 0);
    } catch {
      cameraInputRef.current?.click();
    }
  };

  const closeCamera = () => {
    const stream = cameraStreamRef.current;
    if (stream) stream.getTracks().forEach((t) => t.stop());
    cameraStreamRef.current = null;
    setIsCameraOpen(false);
  };

  const capturePhoto = async () => {
    const video = cameraVideoRef.current;
    if (!video) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const blob: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.92));
    if (!blob) return;
    const file = new File([blob], `camera-${Date.now()}.jpg`, { type: 'image/jpeg' });
    await sendFile(file);
    closeCamera();
  };

  const sendLocation = async () => {
    setSendError('');
    if (!cryptoKeyRef.current || wsRef.current?.readyState !== WebSocket.OPEN) return;
    if (!navigator.geolocation) {
      setSendError('Geolocation is not supported on this browser.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { latitude, longitude, accuracy } = pos.coords;
          const content = JSON.stringify({ latitude, longitude, accuracy, ts: Date.now() });
          const payload: ClipPayload = { type: 'location', content };
          const encrypted = await encryptPayload(cryptoKeyRef.current!, payload);
          wsRef.current?.send(JSON.stringify({ type: 'relay', payload: encrypted }));
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
          toast.show('Current location shared (end-to-end encrypted).');
        } catch {
          setSendError('Failed to share location.');
        }
      },
      () => setSendError('Location permission denied.'),
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 30_000 },
    );
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
                  shown on the host device, or paste the PIN for owner approval.
                </p>
              </div>
              <Input
                placeholder="A4K7R2"
                value={joinInput}
                onChange={(e) => setJoinInput(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === 'Enter' && joinRoom()}
                maxLength={6}
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

  const roomUrl = getRoomUrl(roomId);
  const inviteCode = makeInviteCode(roomId);

  // Show dedicated pending approval screen instead of normal room UI
  if (phase === 'pending') {
    return <PendingApprovalScreen roomId={roomId} errorMsg={errorMsg} onLeave={leaveRoom} />;
  }

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
              title="Copy full room link"
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

      {/* Owner controls */}
      {isOwner && peers.length > 0 && phase === 'connected' && (
        <div className="flex gap-2 mx-2 flex-wrap">
          <button
            onClick={rotateKey}
            className="flex items-center gap-1.5 text-xs text-slate-300 hover:text-emerald-300 hover:bg-emerald-500/10 transition-colors px-3 py-2 rounded-lg border border-slate-700/40 bg-slate-900/60"
            title="Rotate encryption key for all peers"
          >
            <RotateCw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Rotate Key</span>
          </button>
          <button
            onClick={toggleAcceptingJoins}
            className={`flex items-center gap-1.5 text-xs transition-colors px-3 py-2 rounded-lg border ${
              acceptingNewJoins
                ? 'text-slate-300 hover:text-blue-300 hover:bg-blue-500/10 border-slate-700/40 bg-slate-900/60'
                : 'text-red-400 hover:text-red-300 hover:bg-red-500/10 border-red-700/40 bg-red-950/20'
            }`}
            title={`${acceptingNewJoins ? 'Disable' : 'Enable'} new join requests`}
          >
            {acceptingNewJoins ? <ToggleRight className="w-3.5 h-3.5" /> : <ToggleLeft className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">{acceptingNewJoins ? 'Accepting' : 'Closed'}</span>
          </button>
          <button
            onClick={rotateRoomCode}
            className="flex items-center gap-1.5 text-xs text-slate-300 hover:text-purple-300 hover:bg-purple-500/10 transition-colors px-3 py-2 rounded-lg border border-slate-700/40 bg-slate-900/60"
            title="Regenerate invite code"
          >
            <Slash className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">New Code</span>
          </button>
        </div>
      )}

      {/* Pending join requests (owner only) */}
      {joinRequests.length > 0 && (
        <div className="bg-amber-900/10 border border-amber-700/20 rounded-lg px-3 py-2 mx-2">
          <div className="text-xs text-amber-200 font-semibold mb-2">Pending join requests</div>
          <div className="flex gap-2 flex-wrap">
            {joinRequests.map((r) => (
              <div key={r.deviceId} className="bg-slate-800/40 border border-slate-700/30 rounded-md px-3 py-2 flex items-center gap-3 min-w-[250px]">
                <div className="text-xs text-slate-300 flex-1 min-w-0">
                  <div className="font-medium truncate">{r.deviceName}</div>
                  <div className="text-[10px] text-slate-500 truncate">{r.deviceId}</div>
                </div>
                <div className="ml-2 flex gap-1">
                  <Button size="sm" onClick={() => approveRequest(r.deviceId, r.ecdhPub)} className="bg-emerald-600 hover:bg-emerald-500 text-white">Approve</Button>
                  <Button size="sm" variant="outline" onClick={() => rejectRequest(r.deviceId)} className="ml-1 border-slate-600 text-slate-300 hover:text-white">Reject</Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Collapsed devices panel ── */}
      {showDevices && (
        <div className="shrink-0 flex flex-col gap-2 bg-slate-900/40 border border-slate-800/50 rounded-xl p-3">
          <div className="flex flex-wrap gap-2">
            {peers.map((p) => (
              <div
                key={p.deviceId}
                className="flex items-center gap-1.5 bg-slate-800/50 rounded-lg px-2.5 py-1.5 text-xs group"
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${p.deviceId === myDeviceId ? 'bg-indigo-400' : 'bg-emerald-400'}`}
                />
                <span className="text-slate-300">
                  {p.deviceId === myDeviceId ? `You (${p.deviceName})` : p.deviceName}
                </span>
                {isOwner && p.deviceId !== myDeviceId && (
                  <button
                    onClick={() => kickPeer(p.deviceId)}
                    className="ml-1 p-0.5 rounded hover:bg-red-500/20 text-slate-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                    title="Remove this peer from the room"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            ))}
          </div>
          <div className="flex items-center gap-1 text-[10px] text-slate-600">
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
                The 256-bit encryption key is generated per-room and delivered to approved peers via ECDH key wrapping.
                Your server never sees unencrypted keys.
              </p>
            </div>
            {/* Invite code — primary share mechanism (PIN-only) */}
            <div>
              <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                Invite PIN (no key)
              </p>
              <div className="relative group">
                <code className="block text-[11px] font-mono text-indigo-300 bg-slate-800/70 rounded-lg p-2.5 break-all leading-relaxed pr-8 select-all">
                  {inviteCode}
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
            {/* Room URL (PIN-only, no keys) */}
            <div>
              <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                Room URL (PIN only)
              </p>
              <div className="relative group">
                <code className="block text-[10px] font-mono text-slate-500 bg-slate-800/70 rounded-lg p-2.5 break-all leading-relaxed pr-8 select-all">
                  {roomUrl}
                </code>
                <button
                  onClick={copyLink}
                  className="absolute top-1.5 right-1.5 p-1 rounded-md bg-slate-700/70 hover:bg-slate-600/70 text-slate-400 hover:text-white transition-colors"
                  title="Copy room URL"
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
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={handleCameraFileChange}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors px-2.5 py-1.5 rounded-lg border border-slate-700/50 hover:border-slate-600 bg-slate-800/40"
            >
              <Paperclip className="w-3.5 h-3.5" />
              <span>Attach</span>
            </button>
            <button
              onClick={openCamera}
              className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors px-2.5 py-1.5 rounded-lg border border-slate-700/50 hover:border-slate-600 bg-slate-800/40"
              title="Open camera"
            >
              <Camera className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Camera</span>
            </button>
            <button
              onClick={sendLocation}
              className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors px-2.5 py-1.5 rounded-lg border border-slate-700/50 hover:border-slate-600 bg-slate-800/40"
              title="Share current location"
            >
              <MapPin className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Location</span>
            </button>
            <button
              onClick={isRecording ? stopAudioRecording : startAudioRecording}
              className={`flex items-center gap-1.5 text-xs transition-colors px-2.5 py-1.5 rounded-lg border ${
                isRecording
                  ? 'text-red-400 border-red-700/50 bg-red-950/40 hover:bg-red-950/60'
                  : 'text-slate-400 hover:text-white border-slate-700/50 hover:border-slate-600 bg-slate-800/40'
              }`}
              title={isRecording ? 'Stop recording' : 'Start audio recording'}
            >
              {isRecording ? (
                <>
                  <Square className="w-2.5 h-2.5 fill-red-400" />
                  <span>Recording...</span>
                </>
              ) : (
                <>
                  <Mic className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Record</span>
                </>
              )}
            </button>
            <button
              onClick={pasteClipboard}
              className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors px-2.5 py-1.5 rounded-lg border border-slate-700/50 hover:border-slate-600 bg-slate-800/40"
            >
              <ClipboardCopy className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Paste clipboard</span>
              <span className="sm:hidden">Paste</span>
            </button>
            <button
              onClick={() => setViewOnceMode((v) => !v)}
              className={`flex items-center gap-1.5 text-xs transition-colors px-2.5 py-1.5 rounded-lg border ${
                viewOnceMode
                  ? 'text-amber-300 border-amber-600/60 bg-amber-950/30'
                  : 'text-slate-400 hover:text-white border-slate-700/50 hover:border-slate-600 bg-slate-800/40'
              }`}
              title="View once"
            >
              <span>View Once</span>
            </button>
            <button
              onClick={() => setPasswordMode((v) => !v)}
              className={`flex items-center gap-1.5 text-xs transition-colors px-2.5 py-1.5 rounded-lg border ${
                passwordMode
                  ? 'text-rose-300 border-rose-600/60 bg-rose-950/30'
                  : 'text-slate-400 hover:text-white border-slate-700/50 hover:border-slate-600 bg-slate-800/40'
              }`}
              title="Password-style masked message"
            >
              <Lock className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Password</span>
            </button>
            <select
              value={expiryMode}
              onChange={(e) => setExpiryMode(e.target.value as 'none' | '60' | '300' | '3600')}
              className="h-8 px-2 rounded-lg border border-slate-700/50 bg-slate-800/40 text-xs text-slate-300"
              title="Auto-expire timer"
            >
              <option value="none">No expiry</option>
              <option value="60">Expire 1m</option>
              <option value="300">Expire 5m</option>
              <option value="3600">Expire 1h</option>
            </select>
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

      {isCameraOpen && (
        <div className="absolute inset-0 z-30 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-xl bg-slate-900 border border-slate-700 rounded-xl p-3">
            <video ref={cameraVideoRef} autoPlay playsInline muted className="w-full rounded-lg bg-black max-h-[60vh] object-contain" />
            <div className="mt-3 flex items-center justify-end gap-2">
              <Button variant="outline" onClick={closeCamera}>Cancel</Button>
              <Button className="bg-indigo-600 hover:bg-indigo-500 text-white" onClick={capturePhoto}>
                <Camera className="w-4 h-4 mr-1" /> Capture & Send
              </Button>
            </div>
          </div>
        </div>
      )}
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
  const [revealedPassword, setRevealedPassword] = useState(item.isOwn);
  const [viewOnceOpened, setViewOnceOpened] = useState(item.isOwn);
  const [viewOnceConsumed, setViewOnceConsumed] = useState(false);
  const [nowTs, setNowTs] = useState(() => Date.now());
  const isCopied = copiedId === item.id;
  const isLongText = item.type === 'text' && item.content.length > 300;
  const isExpired = Boolean(item.expiresAt && nowTs > item.expiresAt);

  useEffect(() => {
    const t = setInterval(() => setNowTs(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!item.viewOnce || !viewOnceOpened || viewOnceConsumed || item.isOwn) return;
    const t = setTimeout(() => setViewOnceConsumed(true), 8000);
    return () => clearTimeout(t);
  }, [item.viewOnce, viewOnceOpened, viewOnceConsumed, item.isOwn]);

  const canViewContent = !isExpired && (!item.viewOnce || item.isOwn || (viewOnceOpened && !viewOnceConsumed));
  const textToShow =
    item.sensitivity === 'password' && !revealedPassword ? '••••••••••••••••' : item.content;

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
          {item.type === 'audio' && (
            <Badge className="hidden sm:flex bg-amber-500/20 text-amber-300 text-[10px] px-1.5 py-0 h-4 border-0 gap-1">
              <Mic className="w-2.5 h-2.5" />
              <span>audio</span>
            </Badge>
          )}
          {item.type === 'video' && (
            <Badge className="hidden sm:flex bg-rose-500/20 text-rose-300 text-[10px] px-1.5 py-0 h-4 border-0 gap-1">
              <span>▶ video</span>
            </Badge>
          )}
          {item.type === 'file' && (
            <Badge className="hidden sm:flex bg-slate-700/60 text-slate-300 text-[10px] px-1.5 py-0 h-4 border-0 gap-1">
              <FileIcon className="w-2.5 h-2.5" />
              <span>file</span>
            </Badge>
          )}
          {item.type === 'binary' && (
            <Badge className="hidden sm:flex bg-slate-700/60 text-slate-300 text-[10px] px-1.5 py-0 h-4 border-0 gap-1">
              <FileIcon className="w-2.5 h-2.5" />
              <span>binary</span>
            </Badge>
          )}
          {item.type === 'location' && (
            <Badge className="hidden sm:flex bg-emerald-500/20 text-emerald-300 text-[10px] px-1.5 py-0 h-4 border-0 gap-1">
              <MapPin className="w-2.5 h-2.5" />
              <span>location</span>
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
          {(item.type === 'text' || item.type === 'image') && !(item.type === 'text' && (item.sensitivity === 'password' || item.viewOnce)) && (
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
          {(item.type === 'file' || item.type === 'image' || item.type === 'audio' || item.type === 'video' || item.type === 'binary') && item.filename && (
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
        {isExpired && (
          <div className="text-xs text-amber-300 bg-amber-950/30 border border-amber-700/40 rounded-md px-2 py-1.5">
            This message expired and is no longer visible.
          </div>
        )}

        {!isExpired && item.viewOnce && !item.isOwn && !viewOnceOpened && (
          <button
            onClick={() => setViewOnceOpened(true)}
            className="text-xs text-amber-300 bg-amber-950/30 border border-amber-700/40 rounded-md px-2 py-1.5 hover:bg-amber-900/30 transition-colors"
          >
            Tap to view once (will disappear after viewing)
          </button>
        )}

        {!isExpired && item.viewOnce && !item.isOwn && viewOnceConsumed && (
          <div className="text-xs text-slate-400 bg-slate-900/40 border border-slate-700/40 rounded-md px-2 py-1.5">
            View-once message consumed.
          </div>
        )}

        {item.type === 'text' && canViewContent && (
          <>
            <p
              className={`text-slate-200 whitespace-pre-wrap break-words leading-relaxed ${!expanded && isLongText ? 'line-clamp-5' : ''}`}
            >
              {textToShow}
            </p>
            {item.sensitivity === 'password' && (
              <button
                onClick={() => setRevealedPassword((v) => !v)}
                className="mt-1 text-xs text-rose-300 hover:text-rose-200 transition-colors"
              >
                {revealedPassword ? 'Hide password' : 'Reveal password'}
              </button>
            )}
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

        {item.type === 'image' && canViewContent && (
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

        {item.type === 'audio' && canViewContent && (
          <div className="flex flex-col gap-2">
            <audio
              controls
              src={`data:${item.mimeType ?? 'audio/webm'};base64,${item.content}`}
              className="w-full rounded-lg bg-slate-800 focus-visible:ring-indigo-500/40"
            />
            {item.filename && (
              <p className="text-[11px] text-slate-500">
                {item.filename} · {fmtSize(item.fileSize ?? 0)}
              </p>
            )}
          </div>
        )}

        {item.type === 'video' && canViewContent && (
          <div className="flex flex-col gap-2">
            <video
              controls
              src={`data:${item.mimeType ?? 'video/webm'};base64,${item.content}`}
              className="max-h-64 rounded-lg bg-slate-900 border border-slate-700/40"
            />
            {item.filename && (
              <p className="text-[11px] text-slate-500">
                {item.filename} · {fmtSize(item.fileSize ?? 0)}
              </p>
            )}
          </div>
        )}

        {item.type === 'file' && canViewContent && (
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

        {item.type === 'binary' && canViewContent && (
          <div className="flex items-center gap-3 py-0.5">
            <div className="w-9 h-9 rounded-lg bg-slate-700/50 flex items-center justify-center shrink-0">
              <FileIcon className="w-4 h-4 text-slate-400" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-slate-200 truncate font-medium">{item.filename ?? 'binary'}</p>
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

        {item.type === 'location' && canViewContent && (() => {
          let parsed: { latitude: number; longitude: number; accuracy?: number } | null = null;
          try {
            parsed = JSON.parse(item.content) as { latitude: number; longitude: number; accuracy?: number };
          } catch {
            parsed = null;
          }
          if (!parsed) {
            return <p className="text-xs text-slate-400">Location payload unavailable.</p>;
          }
          const mapUrl = `https://maps.google.com/?q=${parsed.latitude},${parsed.longitude}`;
          return (
            <div className="flex items-center gap-3 py-0.5">
              <div className="w-9 h-9 rounded-lg bg-slate-700/50 flex items-center justify-center shrink-0">
                <MapPin className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-slate-200 truncate font-medium">Live location</p>
                <p className="text-xs text-slate-500">
                  {parsed.latitude.toFixed(6)}, {parsed.longitude.toFixed(6)}
                  {parsed.accuracy ? ` (${Math.round(parsed.accuracy)}m)` : ''}
                </p>
              </div>
              <a
                href={mapUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 transition-colors shrink-0 border border-indigo-500/30 hover:border-indigo-400/50 rounded-lg px-2.5 py-1.5"
              >
                Open
              </a>
            </div>
          );
        })()}
      </div>
    </div>
  );
}
