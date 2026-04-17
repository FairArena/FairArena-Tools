import {
  BookOpen,
  Terminal,
  Zap,
  Webhook,
  Globe,
  ChevronRight,
  Code,
  Shield,
  Clock,
  Users,
  Link2,
} from 'lucide-react';

export function Guide() {
  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-4xl mx-auto space-y-8 p-6">
        {/* Header */}
        <div className="text-center space-y-4">
          <div className="flex items-center justify-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-brand-500 shadow-lg shadow-brand-500/20 flex items-center justify-center">
              <BookOpen className="w-6 h-6 text-neutral-900" />
            </div>
            <h1 className="text-3xl font-bold text-white">FairArena Learning Guide</h1>
          </div>
          <p className="text-lg text-neutral-300 max-w-2xl mx-auto">
            Master API testing, terminal commands, and webhook debugging in a safe, sandboxed
            environment. No setup required — start learning immediately!
          </p>
        </div>

        {/* Quick Start */}
        <section className="bg-neutral-800/50 rounded-xl p-6 border border-neutral-700/50">
          <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
            <Zap className="w-5 h-5 text-brand-400" />
            Quick Start (2 minutes)
          </h2>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-brand-500/20 text-brand-400 flex items-center justify-center text-sm font-medium">
                  1
                </div>
                <div>
                  <h3 className="font-medium text-white">Choose Your Tool</h3>
                  <p className="text-sm text-neutral-400">
                    Click Terminal, API Tester, Webhooks, or DNS tabs above
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-brand-500/20 text-brand-400 flex items-center justify-center text-sm font-medium">
                  2
                </div>
                <div>
                  <h3 className="font-medium text-white">Start Experimenting</h3>
                  <p className="text-sm text-neutral-400">
                    No login needed — everything works instantly
                  </p>
                </div>
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-brand-500/20 text-brand-400 flex items-center justify-center text-sm font-medium">
                  3
                </div>
                <div>
                  <h3 className="font-medium text-white">Learn by Doing</h3>
                  <p className="text-sm text-neutral-400">
                    Try commands, test APIs, inspect webhooks
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-brand-500/20 text-brand-400 flex items-center justify-center text-sm font-medium">
                  4
                </div>
                <div>
                  <h3 className="font-medium text-white">Explore Features</h3>
                  <p className="text-sm text-neutral-400">
                    Each tool has advanced features — dive deep!
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Terminal Section */}
        <section className="bg-neutral-800/50 rounded-xl p-6 border border-neutral-700/50">
          <h2 className="text-xl font-semibold text-white mb-6 flex items-center gap-2">
            <Terminal className="w-5 h-5 text-brand-500" />
            Terminal Sandbox
          </h2>

          <div className="space-y-6">
            <div>
              <h3 className="font-medium text-white mb-2">What It Is</h3>
              <p className="text-neutral-300">
                A secure, isolated Linux terminal running in Docker containers. Perfect for learning
                OS commands without risking your system. Each session gets a fresh container that
                disappears when you're done.
              </p>
            </div>

            <div>
              <h3 className="font-medium text-white mb-3">Available Operating Systems</h3>
              <div className="grid md:grid-cols-2 gap-3">
                <div className="flex items-center gap-3 p-3 bg-neutral-800/40 border border-neutral-700/30 rounded-lg shadow-sm">
                  <div className="w-8 h-8 rounded bg-brand-500/10 border border-brand-500/20 flex items-center justify-center">
                    <span className="text-brand-500 font-bold text-sm">U</span>
                  </div>
                  <div>
                    <div className="font-medium text-white">Ubuntu 22.04 LTS</div>
                    <div className="text-sm text-neutral-400">Most popular Linux distro</div>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 bg-neutral-800/40 border border-neutral-700/30 rounded-lg shadow-sm">
                  <div className="w-8 h-8 rounded bg-neutral-800 border border-neutral-700 flex items-center justify-center">
                    <span className="text-neutral-500 font-bold text-sm">D</span>
                  </div>
                  <div>
                    <div className="font-medium text-white">Debian 12</div>
                    <div className="text-sm text-neutral-400">Stable and minimal</div>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 bg-neutral-800/40 border border-neutral-700/30 rounded-lg shadow-sm">
                  <div className="w-8 h-8 rounded bg-brand-500/10 border border-brand-500/20 flex items-center justify-center">
                    <span className="text-brand-400 font-bold text-sm">A</span>
                  </div>
                  <div>
                    <div className="font-medium text-white">Alpine Linux</div>
                    <div className="text-sm text-neutral-400">Ultra-lightweight (5MB)</div>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 bg-neutral-800/40 border border-neutral-700/30 rounded-lg shadow-sm">
                  <div className="w-8 h-8 rounded bg-brand-500/5 border border-brand-500/10 flex items-center justify-center">
                    <span className="text-brand-300 font-bold text-sm">F</span>
                  </div>
                  <div>
                    <div className="font-medium text-white">Fedora 40</div>
                    <div className="text-sm text-neutral-400">Cutting-edge features</div>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <h3 className="font-medium text-white mb-3">Essential Commands to Try</h3>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-neutral-300">File Operations</h4>
                  <div className="space-y-1 text-sm">
                    <code className="block bg-neutral-900 px-2 py-1 rounded text-brand-500">
                      ls -la
                    </code>
                    <code className="block bg-neutral-900 px-2 py-1 rounded text-brand-500">
                      pwd
                    </code>
                    <code className="block bg-neutral-900 px-2 py-1 rounded text-brand-500">
                      mkdir test && cd test
                    </code>
                    <code className="block bg-neutral-900 px-2 py-1 rounded text-brand-500">
                      echo "Hello World" &gt; file.txt
                    </code>
                  </div>
                </div>
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-neutral-300">System Info</h4>
                  <div className="space-y-1 text-sm">
                    <code className="block bg-neutral-900 px-2 py-1 rounded text-brand-500">
                      uname -a
                    </code>
                    <code className="block bg-neutral-900 px-2 py-1 rounded text-brand-500">
                      whoami
                    </code>
                    <code className="block bg-neutral-900 px-2 py-1 rounded text-brand-500">
                      df -h
                    </code>
                    <code className="block bg-neutral-900 px-2 py-1 rounded text-brand-500">
                      free -h
                    </code>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <h3 className="font-medium text-white mb-3">Networking Commands</h3>
              <div className="space-y-2 text-sm">
                <code className="block bg-neutral-900 px-2 py-1 rounded text-brand-500">
                  curl https://httpbin.org/get
                </code>
                <code className="block bg-neutral-900 px-2 py-1 rounded text-brand-500">
                  ping -c 3 google.com
                </code>
                <code className="block bg-neutral-900 px-2 py-1 rounded text-brand-500">
                  nslookup google.com
                </code>
                <code className="block bg-neutral-900 px-2 py-1 rounded text-brand-500">
                  ifconfig
                </code>
              </div>
            </div>

            <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-4">
              <h4 className="font-medium text-amber-400 mb-2 flex items-center gap-2">
                <Shield className="w-4 h-4" />
                Security Features
              </h4>
              <ul className="text-sm text-neutral-300 space-y-1">
                <li>• No root access — runs as unprivileged user</li>
                <li>• Resource limits: 256MB RAM, 0.5 CPU cores</li>
                <li>• Session timeout: 15 minutes with 2-minute warning</li>
                <li>• Read-only root filesystem with selective writable areas</li>
                <li>• No access to host system or other containers</li>
              </ul>
            </div>
          </div>
        </section>

        {/* API Tester Section */}
        <section className="bg-neutral-800/50 rounded-xl p-6 border border-neutral-700/50">
          <h2 className="text-xl font-semibold text-white mb-6 flex items-center gap-2">
            <Code className="w-5 h-5 text-brand-500" />
            API Tester (Postman Alternative)
          </h2>

          <div className="space-y-6">
            <div>
              <h3 className="font-medium text-white mb-2">What It Is</h3>
              <p className="text-neutral-300">
                A powerful HTTP client for testing REST APIs, GraphQL endpoints, and web services.
                Supports all HTTP methods, authentication, and advanced features like request
                history and collections.
              </p>
            </div>

            <div>
              <h3 className="font-medium text-white mb-3">Key Features</h3>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <ChevronRight className="w-4 h-4 text-brand-400 mt-0.5" />
                    <div>
                      <div className="font-medium text-white">All HTTP Methods</div>
                      <div className="text-sm text-neutral-500">
                        GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS
                      </div>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <ChevronRight className="w-4 h-4 text-brand-400 mt-0.5" />
                    <div>
                      <div className="font-medium text-white">Request Builder</div>
                      <div className="text-sm text-neutral-500">
                        Query params, headers, body (JSON/text/XML)
                      </div>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <ChevronRight className="w-4 h-4 text-brand-400 mt-0.5" />
                    <div>
                      <div className="font-medium text-white">Authentication</div>
                      <div className="text-sm text-neutral-500">
                        Bearer tokens, Basic auth, API keys
                      </div>
                    </div>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <ChevronRight className="w-4 h-4 text-brand-400 mt-0.5" />
                    <div>
                      <div className="font-medium text-white">cURL Import/Export</div>
                      <div className="text-sm text-neutral-500">
                        Paste any curl command or copy as curl
                      </div>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <ChevronRight className="w-4 h-4 text-brand-400 mt-0.5" />
                    <div>
                      <div className="font-medium text-white">Collections</div>
                      <div className="text-sm text-neutral-500">
                        Save and organize requests (Postman compatible)
                      </div>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <ChevronRight className="w-4 h-4 text-brand-400 mt-0.5" />
                    <div>
                      <div className="font-medium text-white">Response Inspector</div>
                      <div className="text-sm text-neutral-500">
                        JSON highlighting, headers, timing, size
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <h3 className="font-medium text-white mb-3">Learning Examples</h3>
              <div className="space-y-3">
                <div className="bg-neutral-900/50 rounded-lg p-4">
                  <div className="font-medium text-white mb-2">Test a REST API</div>
                  <div className="text-sm text-neutral-400 mb-2">
                    Try: GET https://jsonplaceholder.typicode.com/posts/1
                  </div>
                  <div className="text-xs text-neutral-500">
                    Returns sample blog post data in JSON format
                  </div>
                </div>
                <div className="bg-neutral-900/50 rounded-lg p-4">
                  <div className="font-medium text-white mb-2">Send JSON Data</div>
                  <div className="text-sm text-neutral-400 mb-2">
                    POST https://httpbin.tools.fairarena.app/post with body: {'{ "name": "test" }'}
                  </div>
                  <div className="text-xs text-neutral-500">Echoes back your request data</div>
                </div>
                <div className="bg-neutral-900/50 rounded-lg p-4">
                  <div className="font-medium text-white mb-2">Test Authentication</div>
                  <div className="text-sm text-neutral-400 mb-2">
                    GET https://httpbin.org/basic-auth/user/pass
                  </div>
                  <div className="text-xs text-neutral-500">Requires Basic auth with user:pass</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Webhook Inspector Section */}
        <section className="bg-neutral-800/50 rounded-xl p-6 border border-neutral-700/50">
          <h2 className="text-xl font-semibold text-white mb-6 flex items-center gap-2">
            <Webhook className="w-5 h-5 text-brand-400" />
            Webhook Inspector
          </h2>

          <div className="space-y-6">
            <div>
              <h3 className="font-medium text-white mb-2">What It Is</h3>
              <p className="text-neutral-300">
                Create instant webhook endpoints to inspect HTTP requests from external services.
                Perfect for debugging webhooks from payment processors, GitHub, Slack, and more.
              </p>
            </div>

            <div>
              <h3 className="font-medium text-white mb-3">How It Works</h3>
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-brand-500/20 text-brand-400 flex items-center justify-center text-sm font-medium">
                    1
                  </div>
                  <div>
                    <div className="font-medium text-white">Create Channel</div>
                    <div className="text-sm text-neutral-400">
                      Get a unique webhook URL instantly
                    </div>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-brand-500/20 text-brand-400 flex items-center justify-center text-sm font-medium">
                    2
                  </div>
                  <div>
                    <div className="font-medium text-white">Send Requests</div>
                    <div className="text-sm text-neutral-400">
                      Point your service to the webhook URL
                    </div>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-brand-500/20 text-brand-400 flex items-center justify-center text-sm font-medium">
                    3
                  </div>
                  <div>
                    <div className="font-medium text-white">Inspect Data</div>
                    <div className="text-sm text-neutral-400">
                      See headers, body, query params in real-time
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <h3 className="font-medium text-white mb-3">Features</h3>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <ChevronRight className="w-4 h-4 text-brand-400" />
                    <span className="text-sm text-neutral-300">Real-time event streaming</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <ChevronRight className="w-4 h-4 text-brand-400" />
                    <span className="text-sm text-neutral-300">JSON body highlighting</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <ChevronRight className="w-4 h-4 text-brand-400" />
                    <span className="text-sm text-neutral-300">QR code generation</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <ChevronRight className="w-4 h-4 text-brand-400" />
                    <span className="text-sm text-neutral-300">Up to 10 concurrent channels</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <ChevronRight className="w-4 h-4 text-brand-400" />
                    <span className="text-sm text-neutral-300">1-hour channel lifetime</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <ChevronRight className="w-4 h-4 text-brand-400" />
                    <span className="text-sm text-neutral-300">Method filtering</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-neutral-900/50 rounded-lg p-4">
              <h4 className="font-medium text-white mb-2">Testing Example</h4>
              <div className="text-sm text-neutral-400 mb-2">
                Create a webhook channel, then test it:
              </div>
              <code className="block bg-neutral-900 px-2 py-1 rounded text-brand-400 text-sm">
                {`curl -X POST https://your-webhook-url -H "Content-Type: application/json" -d '{"test": "data"}'`}
              </code>
            </div>
          </div>
        </section>

        {/* DNS Inspector Section */}
        <section className="bg-neutral-800/50 rounded-xl p-6 border border-neutral-700/50">
          <h2 className="text-xl font-semibold text-white mb-6 flex items-center gap-2">
            <Globe className="w-5 h-5 text-brand-400" />
            DNS Inspector
          </h2>

          <div className="space-y-6">
            <div>
              <h3 className="font-medium text-white mb-2">What It Is</h3>
              <p className="text-neutral-300">
                Query DNS records and troubleshoot domain resolution issues. Supports all major
                record types with caching and rate limiting for responsible usage.
              </p>
            </div>

            <div>
              <h3 className="font-medium text-white mb-3">Supported Record Types</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {['A', 'AAAA', 'CNAME', 'MX', 'TXT', 'NS', 'SOA', 'SRV'].map((type) => (
                  <div key={type} className="bg-neutral-700/30 rounded px-3 py-2 text-center">
                    <code className="text-brand-400 text-sm">{type}</code>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-neutral-900/50 rounded-lg p-4">
              <h4 className="font-medium text-white mb-2">Example Queries</h4>
              <div className="space-y-2 text-sm">
                <div>
                  <code className="text-brand-400">google.com</code> - Basic A/AAAA records
                </div>
                <div>
                  <code className="text-brand-400">github.com MX</code> - Mail exchange records
                </div>
                <div>
                  <code className="text-brand-400">example.com TXT</code> - Text records
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Limits & Best Practices */}
        <section className="bg-neutral-800/50 rounded-xl p-6 border border-neutral-700/50">
          <h2 className="text-xl font-semibold text-white mb-6 flex items-center gap-2">
            <Shield className="w-5 h-5 text-brand-500 shadow-[0_0_8px_rgba(217,255,0,0.3)]" />
            Limits & Best Practices
          </h2>

          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h3 className="font-medium text-white mb-3 flex items-center gap-2">
                <Clock className="w-4 h-4 text-brand-500" />
                Session Limits
              </h3>
              <ul className="space-y-2 text-sm text-neutral-300">
                <li>• Terminal sessions: 15 minutes max</li>
                <li>• 1 active session per IP address</li>
                <li>• 1 hour daily quota per IP</li>
                <li>• 2-minute expiry warning</li>
                <li>• Automatic cleanup on disconnect</li>
              </ul>
            </div>

            <div>
              <h3 className="font-medium text-white mb-3 flex items-center gap-2">
                <Users className="w-4 h-4 text-brand-400" />
                Resource Limits
              </h3>
              <ul className="space-y-2 text-sm text-neutral-300">
                <li>• CPU: 0.5 cores per container</li>
                <li>• Memory: 256MB per container</li>
                <li>• Disk: Limited writable space</li>
                <li>• Network: External access only</li>
                <li>• Processes: 64 max per container</li>
              </ul>
            </div>
          </div>

          <div className="mt-6 p-4 bg-brand-500/10 border border-brand-500/20 rounded-lg">
            <h4 className="font-medium text-brand-500 mb-2">Learning Tips</h4>
            <ul className="text-sm text-neutral-300 space-y-1">
              <li>• Start with basic commands in Terminal to understand Linux</li>
              <li>• Use API Tester to experiment with different HTTP methods and headers</li>
              <li>• Create webhook channels to see how external services send data</li>
              <li>• Check DNS records to understand domain resolution</li>
              <li>• Everything is ephemeral — experiment freely without worry</li>
            </ul>
          </div>
        </section>

        {/* Developer Tools Section */}
        <section className="bg-neutral-800/50 rounded-xl p-6 border border-neutral-700/50">
          <h2 className="text-xl font-semibold text-white mb-6 flex items-center gap-2">
            <Code className="w-5 h-5 text-brand-400" />
            Developer Tools
          </h2>

          <div className="space-y-6">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="bg-neutral-900/50 rounded-lg p-4 border border-neutral-800/50">
                <h3 className="font-medium text-white mb-2">JWT Decoder</h3>
                <p className="text-sm text-neutral-400 mb-3">Decode and analyze JSON Web Tokens instantly</p>
                <ul className="text-xs text-neutral-500 space-y-1">
                  <li>• Decode JWT structure</li>
                  <li>• View claims and payload</li>
                  <li>• Verify signatures</li>
                </ul>
              </div>

              <div className="bg-neutral-900/50 rounded-lg p-4 border border-neutral-800/50">
                <h3 className="font-medium text-white mb-2">JSON Formatter</h3>
                <p className="text-sm text-neutral-400 mb-3">Format, validate, and beautify JSON code</p>
                <ul className="text-xs text-neutral-500 space-y-1">
                  <li>• Auto-format JSON</li>
                  <li>• Syntax highlighting</li>
                  <li>• Error detection</li>
                </ul>
              </div>

              <div className="bg-neutral-900/50 rounded-lg p-4 border border-neutral-800/50">
                <h3 className="font-medium text-white mb-2">Hash Generator</h3>
                <p className="text-sm text-neutral-400 mb-3">Generate cryptographic hashes (MD5, SHA, etc.)</p>
                <ul className="text-xs text-neutral-500 space-y-1">
                  <li>• Multiple hash algorithms</li>
                  <li>• One-way encryption</li>
                  <li>• String verification</li>
                </ul>
              </div>

              <div className="bg-neutral-900/50 rounded-lg p-4 border border-neutral-800/50">
                <h3 className="font-medium text-white mb-2">UUID Generator</h3>
                <p className="text-sm text-neutral-400 mb-3">Generate unique identifiers</p>
                <ul className="text-xs text-neutral-500 space-y-1">
                  <li>• UUID v4 generation</li>
                  <li>• Batch generation</li>
                  <li>• Copy to clipboard</li>
                </ul>
              </div>

              <div className="bg-neutral-900/50 rounded-lg p-4 border border-neutral-800/50">
                <h3 className="font-medium text-white mb-2">Password Generator</h3>
                <p className="text-sm text-neutral-400 mb-3">Create strong, random passwords</p>
                <ul className="text-xs text-neutral-500 space-y-1">
                  <li>• Customizable length</li>
                  <li>• Character options</li>
                  <li>• Strength indicator</li>
                </ul>
              </div>

              <div className="bg-neutral-900/50 rounded-lg p-4 border border-neutral-800/50">
                <h3 className="font-medium text-white mb-2">Encoder/Decoder</h3>
                <p className="text-sm text-neutral-400 mb-3">Convert between encoding formats</p>
                <ul className="text-xs text-neutral-500 space-y-1">
                  <li>• Base64 encoding</li>
                  <li>• URL encoding</li>
                  <li>• HTML encoding</li>
                </ul>
              </div>

              <div className="bg-neutral-900/50 rounded-lg p-4 border border-neutral-800/50">
                <h3 className="font-medium text-white mb-2">Number Base Converter</h3>
                <p className="text-sm text-neutral-400 mb-3">Convert between number systems</p>
                <ul className="text-xs text-neutral-500 space-y-1">
                  <li>• Binary, Octal, Decimal</li>
                  <li>• Hexadecimal conversion</li>
                  <li>• Real-time conversion</li>
                </ul>
              </div>

              <div className="bg-neutral-900/50 rounded-lg p-4 border border-neutral-800/50">
                <h3 className="font-medium text-white mb-2">Email Security Checker</h3>
                <p className="text-sm text-neutral-400 mb-3">Verify email configurations and security</p>
                <ul className="text-xs text-neutral-500 space-y-1">
                  <li>• SPF/DKIM/DMARC checks</li>
                  <li>• DNS validation</li>
                  <li>• Security report</li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* ClipSync Section */}
        <section className="bg-neutral-800/50 rounded-xl p-6 border border-neutral-700/50">
          <h2 className="text-xl font-semibold text-white mb-6 flex items-center gap-2">
            <Link2 className="w-5 h-5 text-amber-400" />
            ClipSync - Secure Device Sharing
          </h2>

          <div className="space-y-4">
            <div>
              <h3 className="font-medium text-white mb-2">What It Is</h3>
              <p className="text-neutral-300">
                Share text, files, images, audio, video, and location between your devices with end-to-end encryption. 
                Perfect for syncing clipboard content, sharing large files, or coordinating between multiple screens.
              </p>
            </div>

            <div>
              <h3 className="font-medium text-white mb-3">Key Features</h3>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <ChevronRight className="w-4 h-4 text-brand-400" />
                    <span className="text-sm text-neutral-300">AES-256-GCM encryption</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <ChevronRight className="w-4 h-4 text-brand-400" />
                    <span className="text-sm text-neutral-300">File sharing (up to 50MB)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <ChevronRight className="w-4 h-4 text-brand-400" />
                    <span className="text-sm text-neutral-300">Audio recording & sharing</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <ChevronRight className="w-4 h-4 text-brand-400" />
                    <span className="text-sm text-neutral-300">Camera capture</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <ChevronRight className="w-4 h-4 text-brand-400" />
                    <span className="text-sm text-neutral-300">Location sharing</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <ChevronRight className="w-4 h-4 text-brand-400" />
                    <span className="text-sm text-neutral-300">View-once & expiring messages</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-neutral-900/50 rounded-lg p-4">
              <h4 className="font-medium text-white mb-2">How to Use</h4>
              <ol className="text-sm text-neutral-400 space-y-2">
                <li>1. Create a room to get a 6-character code</li>
                <li>2. Share the code with your other devices</li>
                <li>3. Enter the code to join the encrypted room</li>
                <li>4. Start sharing files, text, and media instantly</li>
              </ol>
            </div>
          </div>
        </section>

        {/* SSE Listener & Rate Limit Tester */}
        <section className="bg-neutral-800/50 rounded-xl p-6 border border-neutral-700/50">
          <h2 className="text-xl font-semibold text-white mb-6 flex items-center gap-2">
            <Zap className="w-5 h-5 text-brand-400" />
            Advanced Testing Tools
          </h2>

          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-lg font-medium text-white mb-3">SSE Listener</h3>
              <p className="text-sm text-neutral-400 mb-3">
                Listen to Server-Sent Events in real-time. Perfect for testing streaming APIs, WebSocket alternatives, 
                and live data feeds.
              </p>
              <ul className="text-sm text-neutral-500 space-y-1">
                <li>• Connect to SSE endpoints</li>
                <li>• Real-time event streaming</li>
                <li>• Event filtering</li>
                <li>• Connection status monitoring</li>
              </ul>
            </div>

            <div>
              <h3 className="text-lg font-medium text-white mb-3">Rate Limit Tester</h3>
              <p className="text-sm text-neutral-400 mb-3">
                Test API rate limiting and throttling behavior. Learn how services respond to traffic spikes 
                and concurrent requests.
              </p>
              <ul className="text-sm text-neutral-500 space-y-1">
                <li>• Concurrent request testing</li>
                <li>• Rate limit detection</li>
                <li>• Response time analysis</li>
                <li>• Throttling behavior testing</li>
              </ul>
            </div>
          </div>
        </section>

        {/* Footer */}
        <div className="text-center py-8">
          <p className="text-neutral-400">
            Happy learning! 🚀 Questions? Check the terminal with{' '}
            <code className="bg-neutral-800 px-1 rounded text-brand-400">help</code>
          </p>
        </div>
      </div>
    </div>
  );
}
