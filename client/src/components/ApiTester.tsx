// Full Postman-like API tester
// Features: params, headers, auth (bearer/basic/apikey), body (json/text/form/xml),
// cURL import, request history (localStorage), webhook listener (SSE), server status.

import { useState, useCallback, useEffect, useRef, useId, useMemo } from 'react';
import {
  Plus,
  Trash2,
  Send,
  Copy,
  CheckCircle2,
  XCircle,
  Clock,
  FileText,
  History,
  Webhook,
  Download,
  Upload,
  RefreshCw,
  Globe,
  Eye,
  EyeOff,
  Pencil,
} from 'lucide-react';
import { useToast } from './ToastProvider';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type {
  ApiRequest,
  ApiResponse,
  HttpMethod,
  KeyValue,
  AuthConfig,
  BodyType,
  HistoryEntry,
  WebhookEvent,
} from '../types/index.js';

// ---- Constants ---------------------------------------------------------------

const METHOD_COLORS: Record<HttpMethod, string> = {
  GET: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  POST: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  PUT: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  PATCH: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
  DELETE: 'bg-red-500/15 text-red-400 border-red-500/30',
  HEAD: 'bg-slate-500/15 text-slate-400 border-slate-500/30',
  OPTIONS: 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30',
};
const HTTP_METHODS: HttpMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];
const BODY_TYPES: BodyType[] = ['none', 'json', 'text', 'form', 'xml'];
const HISTORY_KEY = 'fa_request_history';
const MAX_HISTORY = 100;

// Re-exported from useTerminalSession so both sides stay in sync.
const API_BASE = ((import.meta.env.VITE_API_URL as string | undefined) ?? '').replace(/\/$/, '');

// ── Header name suggestions (Postman-style) ──────────────────────────────────
const COMMON_HEADERS = [
  'Accept',
  'Accept-Encoding',
  'Accept-Language',
  'Authorization',
  'Cache-Control',
  'Connection',
  'Content-Encoding',
  'Content-Length',
  'Content-Type',
  'Cookie',
  'DNT',
  'Host',
  'If-Modified-Since',
  'If-None-Match',
  'Origin',
  'Pragma',
  'Referer',
  'TE',
  'Upgrade-Insecure-Requests',
  'User-Agent',
  'X-Api-Key',
  'X-Auth-Token',
  'X-Forwarded-For',
  'X-Forwarded-Host',
  'X-Request-ID',
  'X-Requested-With',
  'X-Trace-Id',
];

const COMMON_CONTENT_TYPES = [
  'application/json',
  'application/x-www-form-urlencoded',
  'application/xml',
  'application/octet-stream',
  'application/pdf',
  'multipart/form-data',
  'text/html',
  'text/plain',
  'text/xml',
];

// ── Postman Collection v2.1 converters ───────────────────────────────────────

type PostmanCollection = {
  info?: { name?: string; schema?: string };
  item?: unknown[];
};

function fromPostmanCollection(json: unknown): HistoryEntry[] {
  try {
    const col = json as PostmanCollection;
    if (!Array.isArray(col.item)) return [];

    const mapItem = (item: unknown): HistoryEntry | null => {
      const it = item as {
        name?: string;
        request?: unknown;
        item?: unknown[];
      };
      if (!it?.request) return null; // folder without request

      const req = it.request as {
        method?: string;
        url?:
          | { raw?: string; query?: { key: string; value: string; disabled?: boolean }[] }
          | string;
        header?: { key: string; value: string; disabled?: boolean }[];
        body?: {
          mode?: string;
          raw?: string;
          urlencoded?: { key: string; value: string; disabled?: boolean }[];
        };
        auth?: {
          type?: string;
          bearer?: { key: string; value: string }[];
          basic?: { key: string; value: string }[];
          apikey?: { key: string; value: string }[];
        };
      };

      const rawUrl = typeof req.url === 'string' ? req.url : (req.url?.raw ?? '');
      const method = (req.method ?? 'GET').toUpperCase() as HttpMethod;
      const headers: KeyValue[] = (req.header ?? []).map((h) => ({
        ...newKv(h.key, h.value),
        enabled: h.disabled !== true,
      }));
      const urlQueryParams: KeyValue[] =
        typeof req.url === 'object'
          ? (req.url?.query ?? []).map((q) => ({
              ...newKv(q.key, q.value),
              enabled: q.disabled !== true,
            }))
          : [];

      let bodyType: BodyType = 'none';
      let body = '';
      let formData: KeyValue[] = [];

      if (req.body?.mode === 'raw') {
        body = req.body.raw ?? '';
        const lang =
          (req.body as Record<string, unknown> & { options?: { raw?: { language?: string } } })
            ?.options?.raw?.language ?? '';
        if (lang === 'json') bodyType = 'json';
        else if (lang === 'xml') bodyType = 'xml';
        else bodyType = 'text';
        // Auto-detect if language hint absent
        if (!lang) {
          try {
            JSON.parse(body);
            bodyType = 'json';
          } catch {
            bodyType = 'text';
          }
        }
      } else if (req.body?.mode === 'urlencoded') {
        bodyType = 'form';
        formData = (req.body.urlencoded ?? []).map((d) => ({
          ...newKv(d.key, d.value),
          enabled: d.disabled !== true,
        }));
      }

      let auth: AuthConfig = { type: 'none' };
      if (req.auth?.type === 'bearer') {
        auth = {
          type: 'bearer',
          token: req.auth.bearer?.find((b) => b.key === 'token')?.value ?? '',
        };
      } else if (req.auth?.type === 'basic') {
        auth = {
          type: 'basic',
          username: req.auth.basic?.find((b) => b.key === 'username')?.value ?? '',
          password: req.auth.basic?.find((b) => b.key === 'password')?.value ?? '',
        };
      } else if (req.auth?.type === 'apikey') {
        auth = {
          type: 'apikey',
          apiKeyIn: (req.auth.apikey?.find((b) => b.key === 'in')?.value ?? 'header') as
            | 'header'
            | 'query',
          apiKeyName: req.auth.apikey?.find((b) => b.key === 'key')?.value ?? '',
          apiKeyValue: req.auth.apikey?.find((b) => b.key === 'value')?.value ?? '',
        };
      }

      return {
        id: crypto.randomUUID(),
        name: it.name ?? rawUrl,
        timestamp: Date.now(),
        request: {
          id: crypto.randomUUID(),
          name: it.name ?? rawUrl,
          url: rawUrl,
          method,
          params: urlQueryParams,
          headers,
          auth,
          bodyType,
          body,
          formData,
        },
        response: null,
      };
    };

    const flatten = (items: unknown[]): HistoryEntry[] =>
      items.flatMap((i) => {
        const it = i as { item?: unknown[] };
        if (Array.isArray(it.item)) return flatten(it.item); // recurse folders
        const entry = mapItem(i);
        return entry ? [entry] : [];
      });

    return flatten(col.item);
  } catch {
    return [];
  }
}

function toPostmanCollection(name: string, entries: HistoryEntry[]) {
  return {
    info: {
      name,
      schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
    },
    item: entries.map((e) => {
      const req = e.request;

      let urlObj: unknown = req.url;
      try {
        const u = new URL(req.url.includes('://') ? req.url : `https://${req.url}`);
        urlObj = {
          raw: req.url,
          protocol: u.protocol.replace(':', ''),
          host: u.hostname.split('.'),
          path: u.pathname.split('/').filter(Boolean),
          query: [
            ...u.searchParams.entries(),
            ...req.params
              .filter((p) => p.enabled && p.key)
              .map((p) => [p.key, p.value] as [string, string]),
          ].map(([k, v]) => ({ key: k, value: v })),
        };
      } catch {
        /* keep raw string */
      }

      const pmBody: unknown = (() => {
        if (req.bodyType === 'none') return undefined;
        if (req.bodyType === 'form')
          return {
            mode: 'urlencoded',
            urlencoded: req.formData.map((d) => ({
              key: d.key,
              value: d.value,
              type: 'text',
              disabled: !d.enabled,
            })),
          };
        return {
          mode: 'raw',
          raw: req.body,
          options: {
            raw: {
              language: req.bodyType === 'json' ? 'json' : req.bodyType === 'xml' ? 'xml' : 'text',
            },
          },
        };
      })();

      const pmAuth: unknown = (() => {
        if (req.auth.type === 'none') return undefined;
        if (req.auth.type === 'bearer')
          return {
            type: 'bearer',
            bearer: [{ key: 'token', value: req.auth.token ?? '', type: 'string' }],
          };
        if (req.auth.type === 'basic')
          return {
            type: 'basic',
            basic: [
              { key: 'username', value: req.auth.username ?? '', type: 'string' },
              { key: 'password', value: req.auth.password ?? '', type: 'string' },
            ],
          };
        if (req.auth.type === 'apikey')
          return {
            type: 'apikey',
            apikey: [
              { key: 'key', value: req.auth.apiKeyName ?? '', type: 'string' },
              { key: 'value', value: req.auth.apiKeyValue ?? '', type: 'string' },
              { key: 'in', value: req.auth.apiKeyIn ?? 'header', type: 'string' },
            ],
          };
      })();

      return {
        name: e.name,
        request: {
          method: req.method,
          header: req.headers
            .filter((h) => h.enabled && h.key)
            .map((h) => ({ key: h.key, value: h.value })),
          url: urlObj,
          ...(pmAuth ? { auth: pmAuth } : {}),
          ...(pmBody ? { body: pmBody } : {}),
        },
        response: [],
      };
    }),
  };
}

function newKv(key = '', value = ''): KeyValue {
  return { id: crypto.randomUUID(), key, value, enabled: true };
}

function freshRequest(): ApiRequest {
  return {
    id: crypto.randomUUID(),
    name: 'Untitled Request',
    url: 'https://jsonplaceholder.typicode.com/posts/1',
    method: 'GET',
    params: [],
    headers: [newKv('Accept', 'application/json')],
    auth: { type: 'none' },
    bodyType: 'none',
    body: '',
    formData: [],
  };
}

// ---- Syntax highlight --------------------------------------------------------

function highlightJson(json: string): string {
  return json
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(
      /("(\\u[a-fA-F0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+-]?\d+)?)/g,
      (m) => {
        let cls = 'json-num';
        if (/^"/.test(m)) cls = /:$/.test(m) ? 'json-key' : 'json-str';
        else if (/true|false/.test(m)) cls = 'json-bool';
        else if (/null/.test(m)) cls = 'json-null';
        return `<span class="${cls}">${m}</span>`;
      },
    );
}

function statusColor(s: number) {
  if (s < 200) return 'text-slate-400';
  if (s < 300) return 'text-emerald-400';
  if (s < 400) return 'text-blue-400';
  if (s < 500) return 'text-amber-400';
  return 'text-red-400';
}

function fmtBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1048576) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1048576).toFixed(2)} MB`;
}

function fmtDate(ts: number) {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// ---- Build curl from request -------------------------------------------------

function buildCurl(req: ApiRequest): string {
  const parts = ['curl'];
  if (req.method !== 'GET') parts.push(`-X ${req.method}`);

  const allHeaders: Record<string, string> = {};
  req.headers
    .filter((h) => h.enabled && h.key)
    .forEach((h) => {
      allHeaders[h.key] = h.value;
    });

  // Auth headers
  if (req.auth.type === 'bearer' && req.auth.token)
    allHeaders['Authorization'] = `Bearer ${req.auth.token}`;
  if (req.auth.type === 'basic' && (req.auth.username || req.auth.password))
    allHeaders['Authorization'] =
      'Basic ' + btoa(`${req.auth.username ?? ''}:${req.auth.password ?? ''}`);
  if (req.auth.type === 'apikey' && req.auth.apiKeyIn === 'header' && req.auth.apiKeyName)
    allHeaders[req.auth.apiKeyName] = req.auth.apiKeyValue ?? '';

  Object.entries(allHeaders).forEach(([k, v]) => parts.push(`-H "${k}: ${v}"`));

  if (req.bodyType !== 'none' && req.body && !['GET', 'HEAD'].includes(req.method))
    parts.push(`-d '${req.body.replace(/'/g, "\\'")}' `);

  // Build URL with params
  const url = buildUrl(req);
  parts.push(`"${url}"`);
  return parts.join(' \\\n  ');
}

function buildUrl(req: ApiRequest): string {
  const activeParams = req.params.filter((p) => p.enabled && p.key);
  if (activeParams.length === 0) return req.url;

  // Merge with params already in URL
  try {
    const u = new URL(req.url.includes('://') ? req.url : `https://${req.url}`);
    activeParams.forEach((p) => u.searchParams.append(p.key, p.value));
    // Preserve original scheme if present
    return req.url.startsWith('http') ? u.toString() : u.toString().replace('https://', '');
  } catch {
    const qs = activeParams
      .map((p) => `${encodeURIComponent(p.key)}=${encodeURIComponent(p.value)}`)
      .join('&');
    return `${req.url}${req.url.includes('?') ? '&' : '?'}${qs}`;
  }
}

function buildPayload(req: ApiRequest) {
  const headers: Record<string, string> = {};
  req.headers
    .filter((h) => h.enabled && h.key)
    .forEach((h) => {
      headers[h.key] = h.value;
    });

  if (req.auth.type === 'bearer' && req.auth.token)
    headers['Authorization'] = `Bearer ${req.auth.token}`;
  if (req.auth.type === 'basic')
    headers['Authorization'] =
      'Basic ' + btoa(`${req.auth.username ?? ''}:${req.auth.password ?? ''}`);
  if (req.auth.type === 'apikey' && req.auth.apiKeyIn === 'header' && req.auth.apiKeyName)
    headers[req.auth.apiKeyName] = req.auth.apiKeyValue ?? '';

  const params: Record<string, string> = {};
  if (req.auth.type === 'apikey' && req.auth.apiKeyIn === 'query' && req.auth.apiKeyName)
    params[req.auth.apiKeyName] = req.auth.apiKeyValue ?? '';

  if (req.bodyType === 'json')
    headers['Content-Type'] = headers['Content-Type'] ?? 'application/json';
  if (req.bodyType === 'xml')
    headers['Content-Type'] = headers['Content-Type'] ?? 'application/xml';
  if (req.bodyType === 'text') headers['Content-Type'] = headers['Content-Type'] ?? 'text/plain';
  if (req.bodyType === 'form')
    headers['Content-Type'] = headers['Content-Type'] ?? 'application/x-www-form-urlencoded';

  let body: string | undefined;
  if (req.bodyType === 'form' && req.formData.length > 0) {
    body = req.formData
      .filter((r) => r.enabled && r.key)
      .map((r) => `${encodeURIComponent(r.key)}=${encodeURIComponent(r.value)}`)
      .join('&');
  } else if (req.bodyType !== 'none' && req.body) {
    body = req.body;
  }

  return { headers, body, params };
}

// ---- Code Generation Functions -----------------------------------------------

function generateJavaScript(url: string, method: HttpMethod, headers: Record<string, string>, body?: string): string {
  const hasHeaders = Object.keys(headers).length > 0;
  const hasBody = body && body.trim();

  let code = `fetch('${url}', {\n`;
  code += `  method: '${method}'`;

  if (hasHeaders) {
    code += `,\n  headers: {\n`;
    Object.entries(headers).forEach(([key, value]) => {
      code += `    '${key}': '${value}',\n`;
    });
    code = code.slice(0, -2); // Remove last comma and newline
    code += `\n  }`;
  }

  if (hasBody) {
    code += `,\n  body: ${JSON.stringify(body)}`;
  }

  code += `\n})\n  .then(response => response.json())\n  .then(data => console.log(data))\n  .catch(error => console.error('Error:', error));`;

  return code;
}

function generatePython(url: string, method: HttpMethod, headers: Record<string, string>, body?: string): string {
  const hasHeaders = Object.keys(headers).length > 0;
  const hasBody = body && body.trim();

  let code = `import requests\n\n`;
  code += `url = '${url}'\n`;

  if (hasHeaders) {
    code += `headers = {\n`;
    Object.entries(headers).forEach(([key, value]) => {
      code += `    '${key}': '${value}',\n`;
    });
    code = code.slice(0, -2); // Remove last comma and newline
    code += `\n}\n\n`;
  } else {
    code += `\n`;
  }

  if (hasBody) {
    code += `data = ${JSON.stringify(body)}\n\n`;
  }

  code += `response = requests.${method.toLowerCase()}(url`;

  if (hasHeaders) {
    code += `, headers=headers`;
  }

  if (hasBody) {
    code += `, data=data`;
  }

  code += `)\n\nprint(response.json())`;

  return code;
}

function generatePHP(url: string, method: HttpMethod, headers: Record<string, string>, body?: string): string {
  const hasHeaders = Object.keys(headers).length > 0;
  const hasBody = body && body.trim();

  let code = `<?php\n\n`;
  code += `$url = '${url}';\n`;
  code += `$method = '${method}';\n\n`;

  if (hasHeaders) {
    code += `$headers = array(\n`;
    Object.entries(headers).forEach(([key, value]) => {
      code += `    '${key}: ${value}',\n`;
    });
    code = code.slice(0, -2); // Remove last comma and newline
    code += `\n);\n\n`;
  }

  if (hasBody) {
    code += `$data = ${JSON.stringify(body)};\n\n`;
  }

  code += `$ch = curl_init($url);\n`;
  code += `curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);\n`;
  code += `curl_setopt($ch, CURLOPT_CUSTOMREQUEST, $method);\n`;

  if (hasHeaders) {
    code += `curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);\n`;
  }

  if (hasBody) {
    code += `curl_setopt($ch, CURLOPT_POSTFIELDS, $data);\n`;
  }

  code += `\n$response = curl_exec($ch);\n`;
  code += `curl_close($ch);\n\n`;
  code += `echo $response;\n`;

  return code;
}

function generateRuby(url: string, method: HttpMethod, headers: Record<string, string>, body?: string): string {
  const hasHeaders = Object.keys(headers).length > 0;
  const hasBody = body && body.trim();

  let code = `require 'net/http'\nrequire 'json'\n\n`;
  code += `uri = URI('${url}')\n`;
  code += `http = Net::HTTP.new(uri.host, uri.port)\n`;
  code += `http.use_ssl = true if uri.scheme == 'https'\n\n`;

  code += `request = Net::HTTP::${method.charAt(0).toUpperCase() + method.slice(1).toLowerCase()}.new(uri)\n`;

  if (hasHeaders) {
    Object.entries(headers).forEach(([key, value]) => {
      code += `request['${key}'] = '${value}'\n`;
    });
    code += `\n`;
  }

  if (hasBody) {
    code += `request.body = ${JSON.stringify(body)}\n\n`;
  }

  code += `response = http.request(request)\n`;
  code += `puts response.body\n`;

  return code;
}

function generateGo(url: string, method: HttpMethod, headers: Record<string, string>, body?: string): string {
  const hasHeaders = Object.keys(headers).length > 0;
  const hasBody = body && body.trim();

  let code = `package main\n\n`;
  code += `import (\n`;
  code += `    "bytes"\n`;
  code += `    "fmt"\n`;
  code += `    "io/ioutil"\n`;
  code += `    "net/http"\n`;
  code += `)\n\n`;
  code += `func main() {\n`;
  code += `    url := "${url}"\n`;

  if (hasBody) {
    code += `    payload := []byte(\`${body}\`)\n`;
  }

  code += `    req, err := http.NewRequest("${method}", url, `;

  if (hasBody) {
    code += `bytes.NewBuffer(payload)`;
  } else {
    code += `nil`;
  }

  code += `)\n`;
  code += `    if err != nil {\n`;
  code += `        fmt.Println(err)\n`;
  code += `        return\n`;
  code += `    }\n\n`;

  if (hasHeaders) {
    Object.entries(headers).forEach(([key, value]) => {
      code += `    req.Header.Set("${key}", "${value}")\n`;
    });
    code += `\n`;
  }

  code += `    client := &http.Client{}\n`;
  code += `    resp, err := client.Do(req)\n`;
  code += `    if err != nil {\n`;
  code += `        fmt.Println(err)\n`;
  code += `        return\n`;
  code += `    }\n`;
  code += `    defer resp.Body.Close()\n\n`;
  code += `    body, err := ioutil.ReadAll(resp.Body)\n`;
  code += `    if err != nil {\n`;
  code += `        fmt.Println(err)\n`;
  code += `        return\n`;
  code += `    }\n\n`;
  code += `    fmt.Println(string(body))\n`;
  code += `}\n`;

  return code;
}

function generateJava(url: string, method: HttpMethod, headers: Record<string, string>, body?: string): string {
  const hasHeaders = Object.keys(headers).length > 0;
  const hasBody = body && body.trim();

  let code = `import java.io.IOException;\n`;
  code += `import java.net.URI;\n`;
  code += `import java.net.http.HttpClient;\n`;
  code += `import java.net.http.HttpRequest;\n`;
  code += `import java.net.http.HttpResponse;\n\n`;
  code += `public class ApiRequest {\n`;
  code += `    public static void main(String[] args) throws IOException, InterruptedException {\n`;
  code += `        HttpClient client = HttpClient.newHttpClient();\n`;
  code += `        HttpRequest.Builder requestBuilder = HttpRequest.newBuilder()\n`;
  code += `            .uri(URI.create("${url}"));\n\n`;

  if (hasHeaders) {
    Object.entries(headers).forEach(([key, value]) => {
      code += `        requestBuilder.header("${key}", "${value}");\n`;
    });
    code += `\n`;
  }

  if (hasBody) {
    code += `        HttpRequest request = requestBuilder\n`;
    code += `            .method("${method}", HttpRequest.BodyPublishers.ofString(${JSON.stringify(body)}))\n`;
    code += `            .build();\n`;
  } else {
    code += `        HttpRequest request = requestBuilder\n`;
    code += `            .method("${method}", HttpRequest.BodyPublishers.noBody())\n`;
    code += `            .build();\n`;
  }

  code += `\n`;
  code += `        HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());\n`;
  code += `        System.out.println(response.body());\n`;
  code += `    }\n`;
  code += `}\n`;

  return code;
}

function generateCSharp(url: string, method: HttpMethod, headers: Record<string, string>, body?: string): string {
  const hasHeaders = Object.keys(headers).length > 0;
  const hasBody = body && body.trim();

  let code = `using System;\n`;
  code += `using System.Net.Http;\n`;
  code += `using System.Threading.Tasks;\n\n`;
  code += `class Program\n`;
  code += `{\n`;
  code += `    static async Task Main(string[] args)\n`;
  code += `    {\n`;
  code += `        using (HttpClient client = new HttpClient())\n`;
  code += `        {\n`;

  if (hasHeaders) {
    Object.entries(headers).forEach(([key, value]) => {
      code += `            client.DefaultRequestHeaders.Add("${key}", "${value}");\n`;
    });
    code += `\n`;
  }

  if (hasBody) {
    code += `            var content = new StringContent(${JSON.stringify(body)}, System.Text.Encoding.UTF8, "application/json");\n`;
    code += `            var response = await client.${method}Async("${url}", content);\n`;
  } else {
    code += `            var response = await client.${method}Async("${url}");\n`;
  }

  code += `            var responseString = await response.Content.ReadAsStringAsync();\n`;
  code += `            Console.WriteLine(responseString);\n`;
  code += `        }\n`;
  code += `    }\n`;
  code += `}\n`;

  return code;
}

// ---- localStorage history ----------------------------------------------------

function loadHistory(): HistoryEntry[] {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) ?? '[]');
  } catch {
    return [];
  }
}
function saveHistory(h: HistoryEntry[]) {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(h.slice(-MAX_HISTORY)));
  } catch {
    console.warn('Failed to save history');
  }
}

// ---- Shared components -------------------------------------------------------

function KVEditor({
  rows,
  label,
  onChange,
  placeholderKey = 'Key',
  placeholderVal = 'Value',
  keySuggestions,
  valueSuggestions,
}: {
  rows: KeyValue[];
  label: string;
  onChange: (r: KeyValue[]) => void;
  placeholderKey?: string;
  placeholderVal?: string;
  keySuggestions?: string[];
  valueSuggestions?: string[];
}) {
  const uid = useId();
  const keyListId = keySuggestions ? `${uid}-ksugg` : undefined;
  const valListId = valueSuggestions ? `${uid}-vsugg` : undefined;

  const update = (id: string, f: keyof KeyValue, v: string | boolean) =>
    onChange(rows.map((r) => (r.id === id ? { ...r, [f]: v } : r)));
  const remove = (id: string) => onChange(rows.filter((r) => r.id !== id));
  const add = () => onChange([...rows, newKv()]);

  // Dynamic value suggestions: if current key is Content-Type / Accept, offer MIME types
  const getValSuggestions = (key: string) => {
    const k = key.toLowerCase();
    if (k === 'content-type' || k === 'accept') return COMMON_CONTENT_TYPES;
    if (k === 'authorization') return ['Bearer ', 'Basic ', 'Digest ', 'AWS4-HMAC-SHA256 '];
    if (k === 'cache-control') return ['no-cache', 'no-store', 'max-age=0', 'public', 'private'];
    return valueSuggestions;
  };

  return (
    <div>
      {keySuggestions && keyListId && (
        <datalist id={keyListId}>
          {keySuggestions.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
      )}
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">{label}</span>
        <button
          onClick={add}
          className="flex items-center gap-1 text-xs text-brand-400 hover:text-brand-300"
        >
          <Plus className="w-3 h-3" />
          Add
        </button>
      </div>
      <div className="space-y-1.5">
        {rows.map((row, i) => {
          const dynValSugg = getValSuggestions(row.key);
          const dynValListId = dynValSugg ? `${uid}-vd-${row.id}` : valListId;
          return (
            <div key={row.id} className="flex items-center gap-1.5 group">
              <input
                type="checkbox"
                checked={row.enabled}
                onChange={(e) => update(row.id, 'enabled', e.target.checked)}
                className="w-3.5 h-3.5 rounded accent-brand-500 shrink-0"
                aria-label={`Enable ${label} row ${i + 1}`}
              />
              <input
                value={row.key}
                onChange={(e) => update(row.id, 'key', e.target.value)}
                list={keyListId}
                placeholder={placeholderKey}
                aria-label={`${label} key ${i + 1}`}
                className="flex-1 bg-slate-800/60 border border-slate-700/50 rounded-lg px-2.5 py-1.5 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-brand-500/60 font-mono"
              />
              {dynValSugg && (
                <datalist id={dynValListId}>
                  {dynValSugg.map((s) => (
                    <option key={s} value={s} />
                  ))}
                </datalist>
              )}
              <input
                value={row.value}
                onChange={(e) => update(row.id, 'value', e.target.value)}
                list={dynValListId}
                placeholder={placeholderVal}
                aria-label={`${label} value ${i + 1}`}
                className="flex-1 bg-slate-800/60 border border-slate-700/50 rounded-lg px-2.5 py-1.5 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-brand-500/60 font-mono"
              />
              <button
                onClick={() => remove(row.id)}
                className="p-1.5 text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                aria-label="Remove row"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}
        {rows.length === 0 && (
          <p className="text-xs text-slate-600 py-2 text-center">
            No {label.toLowerCase()} — click Add
          </p>
        )}
      </div>
    </div>
  );
}

function RespTabBtn({
  label,
  active,
  onClick,
  badge,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  badge?: number;
}) {
  return (
    <button
      onClick={onClick}
      className={[
        'relative flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors border-b-2 -mb-px whitespace-nowrap',
        active
          ? 'border-indigo-500 text-indigo-400'
          : 'border-transparent text-slate-500 hover:text-slate-300',
      ].join(' ')}
    >
      {label}
      {badge !== undefined && badge > 0 && (
        <span className={`px-1.5 py-0.5 text-[10px] rounded-full leading-none ${active ? 'bg-indigo-500/25 text-indigo-300' : 'bg-slate-700 text-slate-400'}`}>
          {badge}
        </span>
      )}
    </button>
  );
}

// ---- Auth panel --------------------------------------------------------------

function AuthPanel({ auth, onChange }: { auth: AuthConfig; onChange: (a: AuthConfig) => void }) {
  const [showPw, setShowPw] = useState(false);
  const set = <K extends keyof AuthConfig>(k: K, v: AuthConfig[K]) => onChange({ ...auth, [k]: v });

  return (
    <div className="space-y-4">
      <div>
        <label className="text-xs font-medium text-slate-400 uppercase tracking-wider block mb-2">
          Auth Type
        </label>
        <div className="flex flex-wrap gap-2">
          {(['none', 'bearer', 'basic', 'apikey'] as const).map((t) => (
            <button
              key={t}
              onClick={() => set('type', t)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-all ${
                auth.type === t
                  ? 'bg-brand-500/15 border-brand-500/50 text-brand-300'
                  : 'border-slate-700/50 text-slate-500 hover:text-slate-300'
              }`}
            >
              {t === 'none'
                ? 'No Auth'
                : t === 'bearer'
                  ? 'Bearer Token'
                  : t === 'basic'
                    ? 'Basic Auth'
                    : 'API Key'}
            </button>
          ))}
        </div>
      </div>

      {auth.type === 'bearer' && (
        <div>
          <label className="text-xs text-slate-400 mb-1 block">Token</label>
          <div className="relative">
            <input
              type={showPw ? 'text' : 'password'}
              value={auth.token ?? ''}
              onChange={(e) => set('token', e.target.value)}
              placeholder="eyJhbGci..."
              className="w-full bg-slate-800/60 border border-slate-700/50 rounded-lg px-3 py-2 pr-10 text-sm text-slate-200 font-mono placeholder-slate-600 focus:outline-none focus:border-brand-500/60"
            />
            <button
              onClick={() => setShowPw(!showPw)}
              className="absolute right-2.5 top-2.5 text-slate-500 hover:text-slate-300"
            >
              {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>
      )}

      {auth.type === 'basic' && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Username</label>
            <input
              value={auth.username ?? ''}
              onChange={(e) => set('username', e.target.value)}
              className="w-full bg-slate-800/60 border border-slate-700/50 rounded-lg px-3 py-2 text-sm text-slate-200 font-mono focus:outline-none focus:border-brand-500/60"
            />
          </div>
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Password</label>
            <div className="relative">
              <input
                type={showPw ? 'text' : 'password'}
                value={auth.password ?? ''}
                onChange={(e) => set('password', e.target.value)}
                className="w-full bg-slate-800/60 border border-slate-700/50 rounded-lg px-3 py-2 pr-10 text-sm text-slate-200 font-mono focus:outline-none focus:border-brand-500/60"
              />
              <button
                onClick={() => setShowPw(!showPw)}
                className="absolute right-2.5 top-2.5 text-slate-500 hover:text-slate-300"
              >
                {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>
      )}

      {auth.type === 'apikey' && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Key name</label>
              <input
                value={auth.apiKeyName ?? ''}
                onChange={(e) => set('apiKeyName', e.target.value)}
                placeholder="X-API-Key"
                className="w-full bg-slate-800/60 border border-slate-700/50 rounded-lg px-3 py-2 text-sm text-slate-200 font-mono focus:outline-none focus:border-brand-500/60"
              />
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Value</label>
              <input
                type={showPw ? 'text' : 'password'}
                value={auth.apiKeyValue ?? ''}
                onChange={(e) => set('apiKeyValue', e.target.value)}
                className="w-full bg-slate-800/60 border border-slate-700/50 rounded-lg px-3 py-2 text-sm text-slate-200 font-mono focus:outline-none focus:border-brand-500/60"
              />
            </div>
          </div>
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Add to</label>
            <div className="flex gap-2">
              {(['header', 'query'] as const).map((loc) => (
                <button
                  key={loc}
                  onClick={() => set('apiKeyIn', loc)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-all ${
                    auth.apiKeyIn === loc
                      ? 'bg-brand-500/15 border-brand-500/50 text-brand-300'
                      : 'border-slate-700/50 text-slate-500 hover:text-slate-300'
                  }`}
                >
                  {loc === 'header' ? 'Header' : 'Query Param'}
                </button>
              ))}
            </div>
          </div>
          <button
            onClick={() => setShowPw(!showPw)}
            className="text-xs text-slate-500 hover:text-slate-300 flex items-center gap-1"
          >
            {showPw ? (
              <>
                <EyeOff className="w-3 h-3" />
                Hide value
              </>
            ) : (
              <>
                <Eye className="w-3 h-3" />
                Show value
              </>
            )}
          </button>
        </div>
      )}

      {auth.type === 'none' && (
        <p className="text-xs text-slate-600 py-2">
          No authentication will be added to this request.
        </p>
      )}
    </div>
  );
}

// ---- Body panel --------------------------------------------------------------

function BodyPanel({
  bodyType,
  body,
  formData,
  onChange,
}: {
  bodyType: BodyType;
  body: string;
  formData: KeyValue[];
  onChange: (b: Partial<{ bodyType: BodyType; body: string; formData: KeyValue[] }>) => void;
}) {
  const placeholder: Record<BodyType, string> = {
    none: '',
    json: '{\n  "key": "value"\n}',
    text: 'Request body...',
    form: '',
    xml: '<?xml version="1.0"?>\n<root>\n  <key>value</key>\n</root>',
    binary: '',
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {BODY_TYPES.map((bt) => (
          <button
            key={bt}
            onClick={() => onChange({ bodyType: bt })}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-all ${
              bodyType === bt
                ? 'bg-brand-500/15 border-brand-500/50 text-brand-300'
                : 'border-slate-700/50 text-slate-500 hover:text-slate-300'
            }`}
          >
            {bt === 'none' ? 'None' : bt.toUpperCase()}
          </button>
        ))}
      </div>

      {bodyType === 'form' && (
        <KVEditor
          rows={formData}
          label="Form Fields"
          onChange={(rows) => onChange({ formData: rows })}
          placeholderKey="field"
          placeholderVal="value"
        />
      )}

      {bodyType !== 'none' && bodyType !== 'form' && (
        <textarea
          value={body}
          onChange={(e) => onChange({ body: e.target.value })}
          placeholder={placeholder[bodyType]}
          rows={10}
          spellCheck={false}
          className="w-full bg-slate-800/60 border border-slate-700/50 rounded-xl px-3 py-2.5 text-sm text-slate-200 font-mono placeholder-slate-600 focus:outline-none focus:border-brand-500/60 resize-none"
        />
      )}

      {bodyType === 'none' && (
        <p className="text-xs text-slate-600 py-2 text-center">
          No body will be sent with this request.
        </p>
      )}
    </div>
  );
}

// ---- cURL Import panel -------------------------------------------------------

function CurlImportPanel({ onImport }: { onImport: (parsed: Partial<ApiRequest>) => void }) {
  const [cmd, setCmd] = useState('');
  const [err, setErr] = useState<string | null>(null);

  const parse = async () => {
    setErr(null);
    try {
      const res = await fetch(API_BASE + '/api/curl/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cmd }),
      });
      const data = (await res.json()) as {
        error?: string;
        url?: string;
        method?: string;
        headers?: Record<string, string>;
        body?: string;
      };
      if (!res.ok || data.error) {
        setErr(data.error ?? 'Parse failed');
        return;
      }

      const headers: KeyValue[] = Object.entries(data.headers ?? {}).map(([k, v]) => newKv(k, v));
      onImport({
        url: data.url ?? '',
        method: (data.method ?? 'GET') as HttpMethod,
        headers,
        bodyType: data.body ? 'json' : 'none',
        body: data.body ?? '',
      });
      setCmd('');
    } catch (e) {
      setErr((e as Error).message);
    }
  };

  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-500">
        Paste a cURL command and import it into the request builder.
      </p>
      <textarea
        value={cmd}
        onChange={(e) => setCmd(e.target.value)}
        placeholder={
          'curl -X POST https://api.example.com/endpoint \\\n  -H "Content-Type: application/json" \\\n  -d \'{"key": "value"}\''
        }
        rows={8}
        spellCheck={false}
        className="w-full bg-slate-800/60 border border-slate-700/50 rounded-xl px-3 py-2.5 text-sm text-slate-200 font-mono placeholder-slate-600 focus:outline-none focus:border-brand-500/60 resize-none"
      />
      {err && <p className="text-xs text-red-400">{err}</p>}
      <button
        onClick={parse}
        disabled={!cmd.trim()}
        className="flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-500 disabled:opacity-40 text-white text-sm font-semibold rounded-xl transition-all"
      >
        <Download className="w-4 h-4" />
        Import cURL
      </button>
    </div>
  );
}

// ---- Webhook panel -----------------------------------------------------------

function WebhookPanel() {
  const toast = useToast();
  const [webhookId, setWebhookId] = useState<string | null>(null);
  const [events, setEvents] = useState<WebhookEvent[]>([]);
  const [copied, setCopied] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<WebhookEvent | null>(null);
  const [loading, setLoading] = useState(false);
  const esRef = useRef<EventSource | null>(null);

  const webhookUrl = webhookId
    ? `${API_BASE || window.location.origin}/api/webhook/${webhookId}/incoming`
    : null;

  const create = async () => {
    setLoading(true);
    try {
      const res = await fetch(API_BASE + '/api/webhook/create', { method: 'POST' });
      const data = (await res.json()) as { id: string };
      setWebhookId(data.id);
      setEvents([]);
      setSelectedEvent(null);
    } catch {
      console.warn('Failed to create webhook');
    } finally {
      setLoading(false);
    }
  };

  const destroy = async () => {
    if (!webhookId) return;
    esRef.current?.close();
    esRef.current = null;
    await fetch(`${API_BASE}/api/webhook/${webhookId}`, { method: 'DELETE' }).catch(() => {});
    setWebhookId(null);
    setEvents([]);
    setSelectedEvent(null);
  };

  useEffect(() => {
    if (!webhookId) {
      esRef.current?.close();
      esRef.current = null;
      return;
    }
    const es = new EventSource(API_BASE + `/api/webhook/${webhookId}/listen`);
    esRef.current = es;
    es.onmessage = (e) => {
      try {
        const { event } = JSON.parse(e.data) as { event: WebhookEvent };
        setEvents((prev) => [...prev, event]);
      } catch {
        console.warn('Invalid event data, skipping');
      }
    };
    return () => {
      es.close();
      esRef.current = null;
    };
  }, [webhookId]);

  const copy = async () => {
    if (!webhookUrl) return;
    await navigator.clipboard.writeText(webhookUrl);
    setCopied(true);
    try { toast.show('Webhook URL copied'); } catch {}
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="space-y-4 h-full">
      {!webhookId ? (
        <div className="flex flex-col items-center justify-center gap-4 py-8">
          <Webhook className="w-12 h-12 text-slate-700" />
          <div className="text-center">
            <p className="text-sm text-slate-400 font-medium mb-1">Webhook Tester</p>
            <p className="text-xs text-slate-600 max-w-xs">
              Generate a unique URL and start receiving HTTP requests in real-time. Perfect for
              testing webhooks.
            </p>
          </div>
          <button
            onClick={create}
            disabled={loading}
            className="flex items-center gap-2 px-5 py-2.5 bg-brand-600 hover:bg-brand-500 disabled:opacity-40 text-white text-sm font-semibold rounded-xl transition-all"
          >
            {loading ? (
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <Plus className="w-4 h-4" />
            )}
            Generate Webhook URL
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {/* URL bar */}
          <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-3">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-medium text-slate-400">Your webhook URL</span>
              <span className="text-xs px-1.5 py-0.5 bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 rounded font-mono">
                LIVE
              </span>
            </div>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-xs font-mono text-brand-300 bg-slate-900/60 rounded-lg px-3 py-2 break-all">
                {webhookUrl}
              </code>
              <button
                onClick={copy}
                className={`shrink-0 p-2 rounded-lg transition-colors ${copied ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-700 hover:bg-slate-600 text-slate-300'}`}
                title="Copy URL"
              >
                <Copy className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-slate-600 mt-2">
              Send any HTTP request to this URL. It expires in 1 hour.
            </p>
          </div>

          {/* Event list */}
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">
              Incoming requests ({events.length})
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setEvents([])}
                className="text-xs text-slate-500 hover:text-slate-300 flex items-center gap-1"
              >
                <Trash2 className="w-3 h-3" />
                Clear
              </button>
              <button
                onClick={destroy}
                className="text-xs text-red-500 hover:text-red-400 flex items-center gap-1"
              >
                <XCircle className="w-3 h-3" />
                Delete
              </button>
            </div>
          </div>

          {events.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-slate-600 gap-2">
              <Globe className="w-8 h-8 opacity-30" />
              <p className="text-xs">Waiting for requests...</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 max-h-80 overflow-hidden">
              <div className="overflow-y-auto space-y-1.5">
                {[...events].reverse().map((ev) => (
                  <button
                    key={ev.id}
                    onClick={() => setSelectedEvent(ev)}
                    className={`w-full text-left p-2.5 rounded-xl border transition-all ${
                      selectedEvent?.id === ev.id
                        ? 'bg-brand-500/10 border-brand-500/40'
                        : 'bg-slate-800/40 border-slate-700/40 hover:border-slate-600'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-0.5">
                      <span
                        className={`text-xs font-bold font-mono ${
                          ev.method === 'GET'
                            ? 'text-emerald-400'
                            : ev.method === 'POST'
                              ? 'text-blue-400'
                              : 'text-amber-400'
                        }`}
                      >
                        {ev.method}
                      </span>
                      <span className="text-xs text-slate-500">{fmtDate(ev.receivedAt)}</span>
                    </div>
                    <p className="text-xs text-slate-400 truncate">
                      {ev.headers['content-type'] ?? 'No content-type'}
                    </p>
                  </button>
                ))}
              </div>
              {selectedEvent && (
                <div className="overflow-y-auto bg-slate-900/60 border border-slate-700/40 rounded-xl p-3">
                  <p className="text-xs font-medium text-slate-400 mb-2">
                    {selectedEvent.method} —{' '}
                    {new Date(selectedEvent.receivedAt).toLocaleTimeString()}
                  </p>
                  {Object.keys(selectedEvent.query).length > 0 && (
                    <div className="mb-2">
                      <p className="text-[10px] uppercase text-slate-600 mb-1">Query</p>
                      {Object.entries(selectedEvent.query).map(([k, v]) => (
                        <div key={k} className="text-xs font-mono">
                          <span className="text-brand-300">{k}</span>: {v}
                        </div>
                      ))}
                    </div>
                  )}
                  <p className="text-[10px] uppercase text-slate-600 mb-1">Body</p>
                  <pre className="text-xs font-mono text-slate-300 whitespace-pre-wrap break-all">
                    {typeof selectedEvent.body === 'object'
                      ? JSON.stringify(selectedEvent.body, null, 2)
                      : String(selectedEvent.bodyRaw || '(empty)')}
                  </pre>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---- Response viewer ---------------------------------------------------------

type RespTab = 'body' | 'headers' | 'cookies' | 'tests' | 'raw' | 'preview' | 'curl'

interface Cookie {
  name: string;
  value: string;
  domain?: string;
  path?: string;
  expires?: string;
  httponly?: string;
  secure?: string;
  samesite?: string;
};

function ResponseViewer({ response, curlCmd }: { response: ApiResponse; curlCmd: string }) {
  const [tab, setTab] = useState<RespTab>('body');
  const [copied, setCopied] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const toast = useToast();
  const [bodyFormat, setBodyFormat] = useState<'pretty' | 'raw'>('pretty');
  const [bodySearch, setBodySearch] = useState('');
  const [showLineNumbers, setShowLineNumbers] = useState(false);

  const copy = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    try { toast.show('Copied to clipboard'); } catch {}
    setTimeout(() => setCopied(false), 1500);
  };

  const prettyBody =
    typeof response.body === 'object' && response.body !== null
      ? JSON.stringify(response.body, null, 2)
      : String(response.bodyRaw ?? response.body ?? '');

  const isJson = response.contentType.includes('json');
  const isXml = response.contentType.includes('xml');
  const isHtml = response.contentType.includes('html');

  const formatXml = (xml: string): string => {
    try {
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xml, 'text/xml');
      const serializer = new XMLSerializer();
      return serializer.serializeToString(xmlDoc);
    } catch {
      return xml;
    }
  };

  const highlightXml = (xml: string): string => {
    return xml
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/(&lt;[^&]*&gt;)/g, '<span class="xml-tag">$1</span>')
      .replace(/(&lt;\/[^&]*&gt;)/g, '<span class="xml-tag">$1</span>')
      .replace(/([a-zA-Z_][a-zA-Z0-9_-]*)=/g, '<span class="xml-attr">$1</span>=')
      .replace(/"([^"]*)"/g, '"<span class="xml-value">$1</span>"');
  };

  const highlightHtml = (html: string): string => {
    return html
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/(&lt;[^&]*&gt;)/g, '<span class="html-tag">$1</span>')
      .replace(/(&lt;\/[^&]*&gt;)/g, '<span class="html-tag">$1</span>')
      .replace(/([a-zA-Z_][a-zA-Z0-9_-]*)=/g, '<span class="html-attr">$1</span>=')
      .replace(/"([^"]*)"/g, '"<span class="html-value">$1</span>"');
  };

  const getFormattedBody = () => {
    if (bodyFormat === 'raw') return response.bodyRaw;

    if (isJson) return prettyBody;
    if (isXml) return formatXml(response.bodyRaw);
    if (isHtml) return highlightHtml(response.bodyRaw);
    return response.bodyRaw;
  };

  const renderBodyContent = () => {
    let content = getFormattedBody();

    // Apply syntax highlighting
    if (isJson) content = highlightJson(content);
    else if (isXml) content = highlightXml(content);
    else if (isHtml) content = highlightHtml(content);

    // Apply search highlighting
    if (bodySearch) {
      const regex = new RegExp(`(${bodySearch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
      content = content.replace(regex, '<mark class="bg-yellow-500/30 text-yellow-200">$1</mark>');
    }

    const lines = content.split('\n');

    if (showLineNumbers) {
      return (
        <div className="flex font-mono text-xs leading-relaxed p-4">
          <div className="pr-4 text-slate-500 select-none border-r border-slate-700/50 mr-4">
            {lines.map((_, i) => (
              <div key={i} className="text-right pr-2 py-0.5">
                {i + 1}
              </div>
            ))}
          </div>
          <div className="flex-1 overflow-auto">
            {lines.map((line, i) => (
              <div key={i} className="py-0.5 whitespace-pre-wrap break-all">
                <span dangerouslySetInnerHTML={{ __html: line || ' ' }} />
              </div>
            ))}
          </div>
        </div>
      );
    }

    return (
      <pre
        className="p-4 text-xs font-mono leading-relaxed overflow-auto whitespace-pre-wrap break-all"
        dangerouslySetInnerHTML={{ __html: content }}
      />
    );
  };

  const downloadBody = () => {
    const blob = new Blob([response.bodyRaw], { type: response.contentType || 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'response';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const filteredHeaders = Object.entries(response.headers).filter(
    ([k, v]) =>
      !searchTerm ||
      k.toLowerCase().includes(searchTerm.toLowerCase()) ||
      v.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  // Parse cookies from Set-Cookie headers
  const cookies: Cookie[] = Object.entries(response.headers)
    .filter(([k]) => k.toLowerCase() === 'set-cookie')
    .map(([_, v]) => {
      const parts = v.split(';').map((p) => p.trim());
      const [nameValue, ...attrs] = parts;
      const [name, value] = nameValue.split('=');
      const cookieAttrs: Record<string, string> = {};
      attrs.forEach((attr) => {
        const [k, v] = attr.split('=');
        cookieAttrs[k.toLowerCase()] = v || 'true';
      });
      return {
        name: name || '',
        value: value || '',
        domain: cookieAttrs.domain,
        path: cookieAttrs.path,
        expires: cookieAttrs.expires,
        httponly: cookieAttrs.httponly,
        secure: cookieAttrs.secure,
        samesite: cookieAttrs.samesite,
      };
    });

  const isLargeResponse = response.size > 1024 * 1024; // 1MB

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex flex-wrap items-center gap-3 mb-3">
        <span
          className={`flex items-center gap-1.5 font-bold text-lg font-mono ${statusColor(response.status)}`}
        >
          {response.ok ? <CheckCircle2 className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
          {response.status}
          <span className="text-sm font-normal text-slate-400">{response.statusText}</span>
        </span>
        <span className="flex items-center gap-1.5 text-xs text-slate-400">
          <Clock className="w-3 h-3" />
          {response.elapsed} ms
        </span>
        <span className="flex items-center gap-1.5 text-xs text-slate-400">
          <FileText className="w-3 h-3" />
          {fmtBytes(response.size)}
          {isLargeResponse && <span className="text-amber-400 ml-1">(Large)</span>}
        </span>
        {response.redirected && response.finalUrl && (
          <span className="text-xs text-amber-400 flex items-center gap-1">
            <RefreshCw className="w-3 h-3" />
            Redirected
          </span>
        )}
        <div className="ml-auto flex gap-2">
          <button
            onClick={downloadBody}
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            Save
          </button>
          <button
            onClick={() => copy(response.bodyRaw)}
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors"
          >
            <Copy className={`w-3.5 h-3.5 ${copied ? 'text-green-400' : ''}`} />
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
      </div>

      {isLargeResponse && (
        <div className="mb-3 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
          <div className="flex items-center gap-2 text-amber-400 text-xs">
            <FileText className="w-4 h-4" />
            <span>Large response ({fmtBytes(response.size)}) - only first 1MB shown</span>
          </div>
        </div>
      )}

      <div className="flex gap-0 mb-3 border-b border-slate-700/40 overflow-x-auto no-scrollbar">
        {(['body', 'headers', 'cookies', 'tests', 'raw', 'preview', 'curl'] as RespTab[]).map(
          (t) => (
            <RespTabBtn
              key={t}
              label={t === 'curl' ? 'cURL' : t.charAt(0).toUpperCase() + t.slice(1)}
              active={tab === t}
              onClick={() => setTab(t)}
              badge={
                t === 'headers'
                  ? Object.keys(response.headers).length
                  : t === 'cookies'
                    ? cookies.length
                    : undefined
              }
            />
          ),
        )}
      </div>

      {/* Search bar for headers */}
      {tab === 'headers' && (
        <div className="mb-3">
          <input
            type="text"
            placeholder="Search headers..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-800/60 border border-slate-700/50 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-brand-500/60"
          />
        </div>
      )}

      {/* Format toggle for body */}
      {tab === 'body' && (isJson || isXml || isHtml) && (
        <div className="mb-3 flex gap-2">
          <button
            onClick={() => setBodyFormat('pretty')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-all ${
              bodyFormat === 'pretty'
                ? 'bg-brand-500/15 border-brand-500/50 text-brand-300'
                : 'border-slate-700/50 text-slate-500 hover:text-slate-300'
            }`}
          >
            Pretty
          </button>
          <button
            onClick={() => setBodyFormat('raw')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-all ${
              bodyFormat === 'raw'
                ? 'bg-brand-500/15 border-brand-500/50 text-brand-300'
                : 'border-slate-700/50 text-slate-500 hover:text-slate-300'
            }`}
          >
            Raw
          </button>
        </div>
      )}

      {/* Body search and options */}
      {tab === 'body' && (
        <div className="mb-3 flex items-center gap-3">
          <input
            type="text"
            placeholder="Search in response..."
            value={bodySearch}
            onChange={(e) => setBodySearch(e.target.value)}
            className="flex-1 bg-slate-800/60 border border-slate-700/50 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-brand-500/60"
          />
          <label className="flex items-center gap-2 text-xs text-slate-400">
            <input
              type="checkbox"
              checked={showLineNumbers}
              onChange={(e) => setShowLineNumbers(e.target.checked)}
              className="w-3.5 h-3.5 rounded accent-brand-500"
            />
            Line numbers
          </label>
        </div>
      )}

      <div className="flex-1 overflow-auto min-h-0 rounded-xl bg-slate-900/70 border border-slate-700/40">
        {tab === 'body' && renderBodyContent()}
        {tab === 'headers' && (
          <div className="divide-y divide-slate-800">
            {filteredHeaders.map(([k, v]) => (
              <div key={k} className="flex gap-4 px-4 py-2 hover:bg-slate-800/40 transition-colors">
                <span className="text-xs font-mono text-brand-300 w-48 shrink-0 truncate">{k}</span>
                <span className="text-xs font-mono text-slate-300 break-all">{v}</span>
              </div>
            ))}
            {filteredHeaders.length === 0 && searchTerm && (
              <div className="px-4 py-8 text-center text-slate-500">
                No headers match "{searchTerm}"
              </div>
            )}
          </div>
        )}
        {tab === 'cookies' && (
          <div className="divide-y divide-slate-800">
            {cookies.map((cookie, i) => (
              <div key={i} className="px-4 py-3 hover:bg-slate-800/40 transition-colors">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-sm font-mono text-brand-300">{cookie.name}</span>
                  <span className="text-xs text-slate-500">=</span>
                  <span className="text-sm font-mono text-slate-300 break-all">{cookie.value}</span>
                </div>
                <div className="flex flex-wrap gap-4 text-xs text-slate-500">
                  {cookie.domain && <span>Domain: {cookie.domain}</span>}
                  {cookie.path && <span>Path: {cookie.path}</span>}
                  {cookie.expires && <span>Expires: {cookie.expires}</span>}
                  {cookie.httponly && <span>HttpOnly</span>}
                  {cookie.secure && <span>Secure</span>}
                  {cookie.samesite && <span>SameSite: {cookie.samesite}</span>}
                </div>
              </div>
            ))}
            {cookies.length === 0 && (
              <div className="px-4 py-8 text-center text-slate-500">
                No cookies set in this response
              </div>
            )}
          </div>
        )}
        {tab === 'tests' && (
          <div className="p-4 text-center text-slate-500">
            <div className="mb-4">
              <CheckCircle2 className="w-12 h-12 mx-auto opacity-50" />
            </div>
            <p className="text-sm mb-2">Tests</p>
            <p className="text-xs">Test scripts are not yet implemented in this version.</p>
            <p className="text-xs mt-2">Coming soon: Pre-request scripts and test validation</p>
          </div>
        )}
        {tab === 'raw' && (
          <pre className="p-4 text-xs font-mono text-slate-300 whitespace-pre-wrap break-all">
            {response.bodyRaw}
          </pre>
        )}
        {tab === 'preview' && (
          <div className="p-4">
            {isHtml ? (
              <iframe
                srcDoc={response.bodyRaw}
                className="w-full h-full min-h-[400px] border border-slate-700 rounded-lg"
                sandbox="allow-scripts allow-same-origin"
                title="Response Preview"
              />
            ) : (
              <div className="flex items-center justify-center h-full text-slate-500">
                <div className="text-center">
                  <Eye className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>Preview only available for HTML responses</p>
                  <p className="text-xs mt-2">Content-Type: {response.contentType || 'unknown'}</p>
                </div>
              </div>
            )}
          </div>
        )}
        {tab === 'curl' && (
          <pre className="p-4 text-xs font-mono text-slate-300 whitespace-pre-wrap break-all">
            {curlCmd}
          </pre>
        )}
      </div>
    </div>
  );
}

// ---- History sidebar ---------------------------------------------------------

function HistorySidebar({
  history,
  onSelect,
  onClear,
  onClose,
  onDelete,
  onRename,
}: {
  history: HistoryEntry[];
  onSelect: (e: HistoryEntry) => void;
  onClear: () => void;
  onClose: () => void;
  onDelete: (id: string) => void;
  onRename: (id: string, name: string) => void;
}) {
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

  const filtered = history
    .filter(
      (e) =>
        e.name.toLowerCase().includes(search.toLowerCase()) ||
        e.request.url.toLowerCase().includes(search.toLowerCase()),
    )
    .slice()
    .reverse();

  const commitRename = () => {
    if (editingId && editingName.trim()) onRename(editingId, editingName.trim());
    setEditingId(null);
    setEditingName('');
  };

  return (
    <div className="flex flex-col h-full bg-slate-900/90 border-r border-slate-700/50 w-72 shrink-0">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700/40">
        <span className="text-sm font-semibold text-slate-200">History</span>
        <div className="flex gap-2">
          <button
            onClick={onClear}
            className="text-xs text-slate-500 hover:text-red-400"
            title="Clear all"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
          <button onClick={onClose} className="text-xs text-slate-500 hover:text-slate-300">
            <XCircle className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      <div className="px-3 py-2 border-b border-slate-700/40">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search history..."
          className="w-full bg-slate-800/60 border border-slate-700/50 rounded-lg px-3 py-1.5 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-brand-500/60"
        />
      </div>
      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <p className="text-xs text-slate-600 text-center py-8">No history yet</p>
        ) : (
          filtered.map((e) => (
            <div key={e.id} className="border-b border-slate-700/20 group">
              {editingId === e.id ? (
                /* ── Inline rename input ── */
                <div className="px-4 py-2 flex items-center gap-2">
                  <input
                    autoFocus
                    value={editingName}
                    onChange={(ev) => setEditingName(ev.target.value)}
                    onBlur={commitRename}
                    onKeyDown={(ev) => {
                      if (ev.key === 'Enter') commitRename();
                      if (ev.key === 'Escape') {
                        setEditingId(null);
                        setEditingName('');
                      }
                    }}
                    className="flex-1 bg-slate-800 border border-brand-500/60 rounded-lg px-2 py-1 text-xs text-slate-200 focus:outline-none"
                  />
                </div>
              ) : (
                /* ── Normal item ── */
                <div className="flex items-stretch">
                  <button
                    onClick={() => onSelect(e)}
                    className="flex-1 text-left px-4 py-3 hover:bg-slate-800/50 transition-colors"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className={`text-[11px] font-bold font-mono px-1.5 py-0.5 rounded border ${METHOD_COLORS[e.request.method]}`}
                      >
                        {e.request.method}
                      </span>
                      <span className="text-xs text-slate-500">{fmtDate(e.timestamp)}</span>
                      {e.response && (
                        <span
                          className={`text-xs font-mono ml-auto ${statusColor(e.response.status)}`}
                        >
                          {e.response.status}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 truncate">{e.request.url}</p>
                    <p className="text-[10px] text-slate-600 truncate mt-0.5">{e.name}</p>
                  </button>
                  {/* Per-item actions (visible on hover) */}
                  <div className="flex flex-col justify-center gap-1 pr-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => {
                        setEditingId(e.id);
                        setEditingName(e.name);
                      }}
                      className="p-1 rounded text-slate-600 hover:text-slate-300 transition-colors"
                      title="Rename"
                    >
                      <Pencil className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => onDelete(e.id)}
                      className="p-1 rounded text-slate-600 hover:text-red-400 transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ---- Code Generation Panel ---------------------------------------------------

function CodeGenerationPanel({ request }: { request: ApiRequest }) {
  const [selectedLanguage, setSelectedLanguage] = useState('javascript');
  const [generatedCode, setGeneratedCode] = useState('');

  const languages = [
    { id: 'javascript', name: 'JavaScript', icon: '🟨' },
    { id: 'python', name: 'Python', icon: '🐍' },
    { id: 'curl', name: 'cURL', icon: '📡' },
    { id: 'php', name: 'PHP', icon: '🐘' },
    { id: 'ruby', name: 'Ruby', icon: '💎' },
    { id: 'go', name: 'Go', icon: '🐹' },
    { id: 'java', name: 'Java', icon: '☕' },
    { id: 'csharp', name: 'C#', icon: '🔷' },
  ];

  useEffect(() => {
    setGeneratedCode(generateCode(request, selectedLanguage));
  }, [request, selectedLanguage]);

  const generateCode = (req: ApiRequest, lang: string): string => {
    const url = buildUrl(req);
    const { headers, body } = buildPayload(req);

    switch (lang) {
      case 'javascript':
        return generateJavaScript(url, req.method, headers, body);
      case 'python':
        return generatePython(url, req.method, headers, body);
      case 'curl':
        return buildCurl(req);
      case 'php':
        return generatePHP(url, req.method, headers, body);
      case 'ruby':
        return generateRuby(url, req.method, headers, body);
      case 'go':
        return generateGo(url, req.method, headers, body);
      case 'java':
        return generateJava(url, req.method, headers, body);
      case 'csharp':
        return generateCSharp(url, req.method, headers, body);
      default:
        return '';
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(generatedCode);
  };

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-3">
          Generate Code
        </p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
          {languages.map((lang) => (
            <button
              key={lang.id}
              onClick={() => setSelectedLanguage(lang.id)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-300 transform hover:scale-105 ${
                selectedLanguage === lang.id
                  ? 'bg-gradient-to-r from-brand-600 to-indigo-600 text-white shadow-lg shadow-brand-500/25 ring-2 ring-brand-400/50'
                  : 'bg-slate-800/50 text-slate-400 hover:text-slate-200 hover:bg-slate-700/50 border border-slate-700 hover:border-slate-600 hover:shadow-md'
              }`}
            >
              <span className="text-base">{lang.icon}</span>
              {lang.name}
            </button>
          ))}
        </div>
      </div>

      <div className="relative">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">
            Generated Code
          </p>
          <button
            onClick={copyToClipboard}
            className="flex items-center gap-2 px-3 py-1 bg-slate-800/50 hover:bg-slate-700/50 text-slate-400 hover:text-slate-200 rounded text-xs font-medium transition-all duration-200 border border-slate-700 hover:border-slate-600 hover:shadow-md"
          >
            <Copy className="w-3 h-3 transition-transform duration-200 group-hover:scale-110" />
            Copy
          </button>
        </div>
        <div className="relative group">
          <pre className="p-4 bg-gradient-to-br from-slate-800/60 to-slate-900/60 rounded-xl text-sm font-mono text-slate-300 whitespace-pre-wrap break-all overflow-x-auto max-h-96 overflow-y-auto border border-slate-700/50 shadow-inner transition-all duration-300 group-hover:border-slate-600/50 group-hover:shadow-lg">
            {generatedCode}
          </pre>
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-transparent to-slate-900/10 rounded-xl pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        </div>
      </div>
    </div>
  );
}

// ---- Main Component ----------------------------------------------------------

type ReqTab = 'params' | 'headers' | 'auth' | 'body' | 'curl' | 'code' | 'webhook';

export function ApiTester() {
  const [request, setRequest] = useState<ApiRequest>(freshRequest);
  const [activeTab, setActiveTab] = useState<ReqTab>('params');
  const [response, setResponse] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>(loadHistory);
  const [requestName, setRequestName] = useState('Untitled Request');

  const setField = useCallback(
    <K extends keyof ApiRequest>(k: K, v: ApiRequest[K]) =>
      setRequest((prev) => ({ ...prev, [k]: v })),
    [],
  );

  const curlPreview = useMemo(() => buildCurl(request), [request]);

  const handleSend = async () => {
    if (!request.url.trim()) return;
    setLoading(true);
    setError(null);

    try {
      const { headers, body, params } = buildPayload(request);

      // Merge auth query params into URL
      let url = buildUrl(request);
      if (Object.keys(params).length > 0) {
        try {
          const u = new URL(url.includes('://') ? url : `https://${url}`);
          Object.entries(params).forEach(([k, v]) => u.searchParams.append(k, v));
          url = u.toString();
        } catch {
          console.warn('Invalid URL, skipping param merging');
        }
      }

      const res = await fetch(API_BASE + '/api/request/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, method: request.method, headers, body }),
      });
      const data = (await res.json()) as ApiResponse & { error?: string };

      if (!res.ok && data.error) {
        setError(data.error);
      } else {
        setResponse(data);
        // Save to history
        const entry: HistoryEntry = {
          id: crypto.randomUUID(),
          name: requestName,
          timestamp: Date.now(),
          request: { ...request, id: crypto.randomUUID() },
          response: data,
        };
        const newHistory = [...history, entry];
        setHistory(newHistory);
        saveHistory(newHistory);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleImportCurl = (parsed: Partial<ApiRequest>) => {
    setRequest((prev) => ({ ...prev, ...parsed }));
    setActiveTab('headers');
  };

  const handleSelectHistory = (e: HistoryEntry) => {
    setRequest(e.request);
    setResponse(e.response);
    setRequestName(e.name);
    setShowHistory(false);
  };

  const handleClearHistory = () => {
    setHistory([]);
    saveHistory([]);
  };

  const handleDeleteHistory = (id: string) => {
    const next = history.filter((e) => e.id !== id);
    setHistory(next);
    saveHistory(next);
  };

  const handleRenameHistory = (id: string, name: string) => {
    const next = history.map((e) => (e.id === id ? { ...e, name } : e));
    setHistory(next);
    saveHistory(next);
  };

  // ── Collection import / export ──────────────────────────────────────────────
  const importFileRef = useRef<HTMLInputElement>(null);

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const json = JSON.parse(ev.target?.result as string) as unknown;
        let imported: HistoryEntry[];
        // Postman collection v2.1
        if (
          json &&
          typeof json === 'object' &&
          'info' in (json as object) &&
          ((json as { info?: { schema?: string } }).info?.schema ?? '').includes('getpostman.com')
        ) {
          imported = fromPostmanCollection(json);
        } else if (Array.isArray(json)) {
          // Native history backup
          imported = (json as HistoryEntry[]).filter((x) => !!x?.id && !!x?.request);
        } else {
          return;
        }
        if (imported.length === 0) return;
        // Stamp fresh IDs so imported entries never collide with existing history
        const stamped = imported.map((x) => ({
          ...x,
          id: crypto.randomUUID(),
          timestamp: x.timestamp || Date.now(),
        }));
        const merged = [...history, ...stamped].slice(-MAX_HISTORY);
        setHistory(merged);
        saveHistory(merged);
      } catch {
        /* malformed file — silently ignore */
      }
    };
    reader.readAsText(file);
    e.target.value = ''; // allow re-importing same file
  };

  const handleExportCollection = () => {
    const dateStr = new Date().toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
    const colName = `FairArena Collection — ${dateStr}`;
    const col = toPostmanCollection(colName, history);
    const blob = new Blob([JSON.stringify(col, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `faircollection-${Date.now()}.postman_collection.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const urlSuggestions = useMemo(
    () => [...new Set(history.map((e) => e.request.url))].slice(-30).reverse(),
    [history],
  );

  const activeParamsCount = request.params.filter((p) => p.enabled && p.key).length;
  const activeHeadersCount = request.headers.filter((h) => h.enabled && h.key).length;

  return (
    <div className="flex h-full min-h-0 gap-0 animate-fade-in">
      {/* History sidebar */}
      {showHistory && (
        <HistorySidebar
          history={history}
          onSelect={handleSelectHistory}
          onClear={handleClearHistory}
          onClose={() => setShowHistory(false)}
          onDelete={handleDeleteHistory}
          onRename={handleRenameHistory}
        />
      )}

      {/* Main area */}
      <div className="flex flex-col flex-1 min-w-0 gap-3 h-full">
        {/* Top bar: history + name + URL */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              {/* Hidden file input for collection import */}
              <input
                ref={importFileRef}
                type="file"
                accept=".json,.postman_collection.json"
                className="hidden"
                onChange={handleImportFile}
              />

              <Button
                variant={showHistory ? "default" : "outline"}
                size="sm"
                onClick={() => setShowHistory(!showHistory)}
                title="Request history"
                aria-label="Toggle history"
              >
                <History className="w-4 h-4" />
              </Button>

              {/* Import Postman collection */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => importFileRef.current?.click()}
                title="Import Postman collection (.json)"
              >
                <Upload className="w-4 h-4" />
              </Button>

              {/* Export collection */}
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportCollection}
                disabled={history.length === 0}
                title={
                  history.length === 0
                    ? 'No history to export'
                    : `Export ${history.length} request${history.length !== 1 ? 's' : ''} as Postman collection`
                }
              >
                <Download className="w-4 h-4" />
              </Button>

              <div className="flex-1 space-y-2">
                {/* Request name */}
                <Input
                  value={requestName}
                  onChange={(e) => setRequestName(e.target.value)}
                  placeholder="Request name..."
                  className="text-sm"
                />

                {/* URL bar */}
                <div className="flex items-center gap-2">
                  {/* Method selector */}
                  <Select value={request.method} onValueChange={(value) => setField('method', value as HttpMethod)}>
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {HTTP_METHODS.map((m) => (
                        <SelectItem key={m} value={m}>
                          {m}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {/* URL input + autocomplete suggestions from history */}
                  <datalist id="fa-url-suggestions">
                    {urlSuggestions.map((url) => (
                      <option key={url} value={url} />
                    ))}
                  </datalist>
                  <Input
                    type="text"
                    list="fa-url-suggestions"
                    value={request.url}
                    onChange={(e) => setField('url', e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                    placeholder="https://api.example.com/v1/endpoint"
                    className="flex-1 font-mono"
                  />

                  {/* Send button */}
                  <Button
                    onClick={handleSend}
                    disabled={loading || !request.url.trim()}
                    className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500"
                  >
                    {loading ? (
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                    ) : (
                      <Send className="w-4 h-4 mr-2" />
                    )}
                    {loading ? 'Sending...' : 'Send'}
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Request + Response panels */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 flex-1 min-h-0">
          {/* LEFT: Request builder */}
          <Card className="flex flex-col min-h-0">
            <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as ReqTab)}>
              <TabsList className="grid w-full grid-cols-7">
                <TabsTrigger value="params" className="relative">
                  Params
                  {activeParamsCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-blue-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                      {activeParamsCount}
                    </span>
                  )}
                </TabsTrigger>
                <TabsTrigger value="headers" className="relative">
                  Headers
                  {activeHeadersCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-blue-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                      {activeHeadersCount}
                    </span>
                  )}
                </TabsTrigger>
                <TabsTrigger value="auth" className="relative">
                  Auth
                  {request.auth.type !== 'none' && (
                    <span className="absolute -top-1 -right-1 bg-blue-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                      1
                    </span>
                  )}
                </TabsTrigger>
                <TabsTrigger value="body" className="relative">
                  Body
                  {request.bodyType !== 'none' && (
                    <span className="absolute -top-1 -right-1 bg-blue-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                      1
                    </span>
                  )}
                </TabsTrigger>
                <TabsTrigger value="curl">cURL</TabsTrigger>
                <TabsTrigger value="code">Code</TabsTrigger>
                <TabsTrigger value="webhook">Webhook</TabsTrigger>
              </TabsList>

              <CardContent className="flex-1 overflow-auto min-h-0 p-4">
                <TabsContent value="params">
                  <KVEditor
                    label="Query Parameters"
                    rows={request.params}
                    onChange={(rows) => setField('params', rows)}
                    placeholderKey="param"
                    placeholderVal="value"
                  />
                </TabsContent>
                <TabsContent value="headers">
                  <KVEditor
                    label="Request Headers"
                    rows={request.headers}
                    onChange={(rows) => setField('headers', rows)}
                    keySuggestions={COMMON_HEADERS}
                    placeholderKey="Header name"
                    placeholderVal="Value"
                  />
                </TabsContent>
                <TabsContent value="auth">
                  <AuthPanel auth={request.auth} onChange={(a) => setField('auth', a)} />
                </TabsContent>
                <TabsContent value="body">
                  <BodyPanel
                    bodyType={request.bodyType}
                    body={request.body}
                    formData={request.formData}
                    onChange={(b) => setRequest((prev) => ({ ...prev, ...b }))}
                  />
                </TabsContent>
                <TabsContent value="curl">
                  <div className="space-y-4">
                    <div className="relative">
                      <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">
                        cURL Preview
                      </p>
                      <pre className="p-3 bg-slate-800/60 rounded-xl text-xs font-mono text-slate-300 whitespace-pre-wrap break-all">
                        {curlPreview}
                      </pre>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigator.clipboard.writeText(curlPreview)}
                        className="absolute top-8 right-2"
                        title="Copy"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                    <div className="border-t border-slate-700/40 pt-4">
                      <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-3">
                        Import from cURL
                      </p>
                      <CurlImportPanel onImport={handleImportCurl} />
                    </div>
                  </div>
                </TabsContent>
                <TabsContent value="code">
                  <CodeGenerationPanel request={request} />
                </TabsContent>
                <TabsContent value="webhook">
                  <WebhookPanel />
                </TabsContent>
              </CardContent>
            </Tabs>
          </Card>

          {/* RIGHT: Response */}
          <Card className="flex flex-col min-h-0">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <CardTitle className="text-sm">Response</CardTitle>
                {response && (
                  <div className="flex items-center gap-1.5">
                    <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${response.status >= 200 && response.status < 300 ? 'bg-green-500/20 text-green-400' : response.status >= 400 ? 'bg-red-500/20 text-red-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
                      {response.status}
                    </span>
                    <span className="text-xs text-slate-500">
                      {response.headers['content-length'] ? `${(parseInt(response.headers['content-length']) / 1024).toFixed(1)} KB` : ''}
                    </span>
                  </div>
                )}
              </div>
            </CardHeader>

            <CardContent className="flex-1 overflow-auto min-h-0 p-4 pt-0">
              {error && (
                <div className="mb-3 flex items-start gap-2.5 p-4 bg-gradient-to-r from-red-500/10 to-red-600/5 border border-red-500/30 rounded-xl shrink-0 animate-in slide-in-from-top-2 duration-300">
                  <div className="p-1 rounded-full bg-red-500/20">
                    <XCircle className="w-4 h-4 text-red-400" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-red-300 mb-1">Request Failed</p>
                    <p className="text-sm text-red-400/80">{error}</p>
                  </div>
                </div>
              )}

              {!response && !loading && !error && (
                <div className="flex-1 flex flex-col items-center justify-center text-slate-600 gap-3 animate-fade-in">
                  <div className="p-4 rounded-full bg-slate-800/30 animate-pulse">
                    <Send className="w-8 h-8 opacity-40" />
                  </div>
                  <p className="text-sm font-medium">Ready to send your request</p>
                  <p className="text-xs text-slate-500">Enter a URL and click Send</p>
                </div>
              )}

              {loading && (
                <div className="flex-1 flex items-center justify-center gap-3 text-slate-500 animate-fade-in">
                  <div className="relative">
                    <span className="w-6 h-6 border-2 border-brand-500/20 border-t-brand-500 rounded-full animate-spin" />
                    <div className="absolute inset-0 rounded-full bg-brand-500/10 animate-ping" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">Sending request...</span>
                    <span className="text-xs text-slate-600">Please wait</span>
                  </div>
                </div>
              )}

              {response && !loading && (
                <div className="flex-1 min-h-0">
                  <ResponseViewer response={response} curlCmd={curlPreview} />
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
