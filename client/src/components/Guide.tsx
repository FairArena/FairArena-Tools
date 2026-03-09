import { BookOpen, Terminal, Zap, Webhook, Globe, ChevronRight, Code, Shield, Clock, Users } from 'lucide-react';

export function Guide() {
  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-4xl mx-auto space-y-8 p-6">
        {/* Header */}
        <div className="text-center space-y-4">
          <div className="flex items-center justify-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-brand-500 to-indigo-500 flex items-center justify-center">
              <BookOpen className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-white">FairArena Learning Guide</h1>
          </div>
          <p className="text-lg text-slate-300 max-w-2xl mx-auto">
            Master API testing, terminal commands, and webhook debugging in a safe, sandboxed environment.
            No setup required — start learning immediately!
          </p>
        </div>

        {/* Quick Start */}
        <section className="bg-slate-800/50 rounded-xl p-6 border border-slate-700/50">
          <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
            <Zap className="w-5 h-5 text-brand-400" />
            Quick Start (2 minutes)
          </h2>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-brand-500/20 text-brand-400 flex items-center justify-center text-sm font-medium">1</div>
                <div>
                  <h3 className="font-medium text-white">Choose Your Tool</h3>
                  <p className="text-sm text-slate-400">Click Terminal, API Tester, Webhooks, or DNS tabs above</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-brand-500/20 text-brand-400 flex items-center justify-center text-sm font-medium">2</div>
                <div>
                  <h3 className="font-medium text-white">Start Experimenting</h3>
                  <p className="text-sm text-slate-400">No login needed — everything works instantly</p>
                </div>
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-brand-500/20 text-brand-400 flex items-center justify-center text-sm font-medium">3</div>
                <div>
                  <h3 className="font-medium text-white">Learn by Doing</h3>
                  <p className="text-sm text-slate-400">Try commands, test APIs, inspect webhooks</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-brand-500/20 text-brand-400 flex items-center justify-center text-sm font-medium">4</div>
                <div>
                  <h3 className="font-medium text-white">Explore Features</h3>
                  <p className="text-sm text-slate-400">Each tool has advanced features — dive deep!</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Terminal Section */}
        <section className="bg-slate-800/50 rounded-xl p-6 border border-slate-700/50">
          <h2 className="text-xl font-semibold text-white mb-6 flex items-center gap-2">
            <Terminal className="w-5 h-5 text-green-400" />
            Terminal Sandbox
          </h2>

          <div className="space-y-6">
            <div>
              <h3 className="font-medium text-white mb-2">What It Is</h3>
              <p className="text-slate-300">
                A secure, isolated Linux terminal running in Docker containers. Perfect for learning OS commands
                without risking your system. Each session gets a fresh container that disappears when you're done.
              </p>
            </div>

            <div>
              <h3 className="font-medium text-white mb-3">Available Operating Systems</h3>
              <div className="grid md:grid-cols-2 gap-3">
                <div className="flex items-center gap-3 p-3 bg-slate-700/30 rounded-lg">
                  <div className="w-8 h-8 rounded bg-orange-500/20 flex items-center justify-center">
                    <span className="text-orange-400 font-bold text-sm">U</span>
                  </div>
                  <div>
                    <div className="font-medium text-white">Ubuntu 22.04 LTS</div>
                    <div className="text-sm text-slate-400">Most popular Linux distro</div>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 bg-slate-700/30 rounded-lg">
                  <div className="w-8 h-8 rounded bg-red-500/20 flex items-center justify-center">
                    <span className="text-red-400 font-bold text-sm">D</span>
                  </div>
                  <div>
                    <div className="font-medium text-white">Debian 12</div>
                    <div className="text-sm text-slate-400">Stable and minimal</div>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 bg-slate-700/30 rounded-lg">
                  <div className="w-8 h-8 rounded bg-blue-500/20 flex items-center justify-center">
                    <span className="text-blue-400 font-bold text-sm">A</span>
                  </div>
                  <div>
                    <div className="font-medium text-white">Alpine Linux</div>
                    <div className="text-sm text-slate-400">Ultra-lightweight (5MB)</div>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 bg-slate-700/30 rounded-lg">
                  <div className="w-8 h-8 rounded bg-blue-600/20 flex items-center justify-center">
                    <span className="text-blue-500 font-bold text-sm">F</span>
                  </div>
                  <div>
                    <div className="font-medium text-white">Fedora 40</div>
                    <div className="text-sm text-slate-400">Cutting-edge features</div>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <h3 className="font-medium text-white mb-3">Essential Commands to Try</h3>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-slate-200">File Operations</h4>
                  <div className="space-y-1 text-sm">
                    <code className="block bg-slate-900 px-2 py-1 rounded text-green-400">ls -la</code>
                    <code className="block bg-slate-900 px-2 py-1 rounded text-green-400">pwd</code>
                    <code className="block bg-slate-900 px-2 py-1 rounded text-green-400">mkdir test && cd test</code>
                    <code className="block bg-slate-900 px-2 py-1 rounded text-green-400">echo "Hello World" &gt; file.txt</code>
                  </div>
                </div>
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-slate-200">System Info</h4>
                  <div className="space-y-1 text-sm">
                    <code className="block bg-slate-900 px-2 py-1 rounded text-green-400">uname -a</code>
                    <code className="block bg-slate-900 px-2 py-1 rounded text-green-400">whoami</code>
                    <code className="block bg-slate-900 px-2 py-1 rounded text-green-400">df -h</code>
                    <code className="block bg-slate-900 px-2 py-1 rounded text-green-400">free -h</code>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <h3 className="font-medium text-white mb-3">Networking Commands</h3>
              <div className="space-y-2 text-sm">
                <code className="block bg-slate-900 px-2 py-1 rounded text-green-400">curl https://httpbin.org/get</code>
                <code className="block bg-slate-900 px-2 py-1 rounded text-green-400">ping -c 3 google.com</code>
                <code className="block bg-slate-900 px-2 py-1 rounded text-green-400">nslookup google.com</code>
                <code className="block bg-slate-900 px-2 py-1 rounded text-green-400">ifconfig</code>
              </div>
            </div>

            <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-4">
              <h4 className="font-medium text-amber-400 mb-2 flex items-center gap-2">
                <Shield className="w-4 h-4" />
                Security Features
              </h4>
              <ul className="text-sm text-slate-300 space-y-1">
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
        <section className="bg-slate-800/50 rounded-xl p-6 border border-slate-700/50">
          <h2 className="text-xl font-semibold text-white mb-6 flex items-center gap-2">
            <Code className="w-5 h-5 text-blue-400" />
            API Tester (Postman Alternative)
          </h2>

          <div className="space-y-6">
            <div>
              <h3 className="font-medium text-white mb-2">What It Is</h3>
              <p className="text-slate-300">
                A powerful HTTP client for testing REST APIs, GraphQL endpoints, and web services.
                Supports all HTTP methods, authentication, and advanced features like request history and collections.
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
                      <div className="text-sm text-slate-400">GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS</div>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <ChevronRight className="w-4 h-4 text-brand-400 mt-0.5" />
                    <div>
                      <div className="font-medium text-white">Request Builder</div>
                      <div className="text-sm text-slate-400">Query params, headers, body (JSON/text/XML)</div>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <ChevronRight className="w-4 h-4 text-brand-400 mt-0.5" />
                    <div>
                      <div className="font-medium text-white">Authentication</div>
                      <div className="text-sm text-slate-400">Bearer tokens, Basic auth, API keys</div>
                    </div>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <ChevronRight className="w-4 h-4 text-brand-400 mt-0.5" />
                    <div>
                      <div className="font-medium text-white">cURL Import/Export</div>
                      <div className="text-sm text-slate-400">Paste any curl command or copy as curl</div>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <ChevronRight className="w-4 h-4 text-brand-400 mt-0.5" />
                    <div>
                      <div className="font-medium text-white">Collections</div>
                      <div className="text-sm text-slate-400">Save and organize requests (Postman compatible)</div>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <ChevronRight className="w-4 h-4 text-brand-400 mt-0.5" />
                    <div>
                      <div className="font-medium text-white">Response Inspector</div>
                      <div className="text-sm text-slate-400">JSON highlighting, headers, timing, size</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <h3 className="font-medium text-white mb-3">Learning Examples</h3>
              <div className="space-y-3">
                <div className="bg-slate-900/50 rounded-lg p-4">
                  <div className="font-medium text-white mb-2">Test a REST API</div>
                  <div className="text-sm text-slate-400 mb-2">Try: GET https://jsonplaceholder.typicode.com/posts/1</div>
                  <div className="text-xs text-slate-500">Returns sample blog post data in JSON format</div>
                </div>
                <div className="bg-slate-900/50 rounded-lg p-4">
                  <div className="font-medium text-white mb-2">Send JSON Data</div>
                  <div className="text-sm text-slate-400 mb-2">POST https://httpbin.org/post with body: {"{ \"name\": \"test\" }"}</div>
                  <div className="text-xs text-slate-500">Echoes back your request data</div>
                </div>
                <div className="bg-slate-900/50 rounded-lg p-4">
                  <div className="font-medium text-white mb-2">Test Authentication</div>
                  <div className="text-sm text-slate-400 mb-2">GET https://httpbin.org/basic-auth/user/pass</div>
                  <div className="text-xs text-slate-500">Requires Basic auth with user:pass</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Webhook Inspector Section */}
        <section className="bg-slate-800/50 rounded-xl p-6 border border-slate-700/50">
          <h2 className="text-xl font-semibold text-white mb-6 flex items-center gap-2">
            <Webhook className="w-5 h-5 text-purple-400" />
            Webhook Inspector
          </h2>

          <div className="space-y-6">
            <div>
              <h3 className="font-medium text-white mb-2">What It Is</h3>
              <p className="text-slate-300">
                Create instant webhook endpoints to inspect HTTP requests from external services.
                Perfect for debugging webhooks from payment processors, GitHub, Slack, and more.
              </p>
            </div>

            <div>
              <h3 className="font-medium text-white mb-3">How It Works</h3>
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-purple-500/20 text-purple-400 flex items-center justify-center text-sm font-medium">1</div>
                  <div>
                    <div className="font-medium text-white">Create Channel</div>
                    <div className="text-sm text-slate-400">Get a unique webhook URL instantly</div>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-purple-500/20 text-purple-400 flex items-center justify-center text-sm font-medium">2</div>
                  <div>
                    <div className="font-medium text-white">Send Requests</div>
                    <div className="text-sm text-slate-400">Point your service to the webhook URL</div>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-purple-500/20 text-purple-400 flex items-center justify-center text-sm font-medium">3</div>
                  <div>
                    <div className="font-medium text-white">Inspect Data</div>
                    <div className="text-sm text-slate-400">See headers, body, query params in real-time</div>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <h3 className="font-medium text-white mb-3">Features</h3>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <ChevronRight className="w-4 h-4 text-purple-400" />
                    <span className="text-sm text-slate-300">Real-time event streaming</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <ChevronRight className="w-4 h-4 text-purple-400" />
                    <span className="text-sm text-slate-300">JSON body highlighting</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <ChevronRight className="w-4 h-4 text-purple-400" />
                    <span className="text-sm text-slate-300">QR code generation</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <ChevronRight className="w-4 h-4 text-purple-400" />
                    <span className="text-sm text-slate-300">Up to 10 concurrent channels</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <ChevronRight className="w-4 h-4 text-purple-400" />
                    <span className="text-sm text-slate-300">1-hour channel lifetime</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <ChevronRight className="w-4 h-4 text-purple-400" />
                    <span className="text-sm text-slate-300">Method filtering</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-slate-900/50 rounded-lg p-4">
              <h4 className="font-medium text-white mb-2">Testing Example</h4>
              <div className="text-sm text-slate-400 mb-2">Create a webhook channel, then test it:</div>
              <code className="block bg-slate-900 px-2 py-1 rounded text-green-400 text-sm">
                {`curl -X POST https://your-webhook-url -H "Content-Type: application/json" -d '{"test": "data"}'`}
              </code>
            </div>
          </div>
        </section>

        {/* DNS Inspector Section */}
        <section className="bg-slate-800/50 rounded-xl p-6 border border-slate-700/50">
          <h2 className="text-xl font-semibold text-white mb-6 flex items-center gap-2">
            <Globe className="w-5 h-5 text-cyan-400" />
            DNS Inspector
          </h2>

          <div className="space-y-6">
            <div>
              <h3 className="font-medium text-white mb-2">What It Is</h3>
              <p className="text-slate-300">
                Query DNS records and troubleshoot domain resolution issues. Supports all major record types
                with caching and rate limiting for responsible usage.
              </p>
            </div>

            <div>
              <h3 className="font-medium text-white mb-3">Supported Record Types</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {['A', 'AAAA', 'CNAME', 'MX', 'TXT', 'NS', 'SOA', 'SRV'].map(type => (
                  <div key={type} className="bg-slate-700/30 rounded px-3 py-2 text-center">
                    <code className="text-cyan-400 text-sm">{type}</code>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-slate-900/50 rounded-lg p-4">
              <h4 className="font-medium text-white mb-2">Example Queries</h4>
              <div className="space-y-2 text-sm">
                <div><code className="text-cyan-400">google.com</code> - Basic A/AAAA records</div>
                <div><code className="text-cyan-400">github.com MX</code> - Mail exchange records</div>
                <div><code className="text-cyan-400">example.com TXT</code> - Text records</div>
              </div>
            </div>
          </div>
        </section>

        {/* Limits & Best Practices */}
        <section className="bg-slate-800/50 rounded-xl p-6 border border-slate-700/50">
          <h2 className="text-xl font-semibold text-white mb-6 flex items-center gap-2">
            <Shield className="w-5 h-5 text-red-400" />
            Limits & Best Practices
          </h2>

          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h3 className="font-medium text-white mb-3 flex items-center gap-2">
                <Clock className="w-4 h-4 text-orange-400" />
                Session Limits
              </h3>
              <ul className="space-y-2 text-sm text-slate-300">
                <li>• Terminal sessions: 15 minutes max</li>
                <li>• 1 active session per IP address</li>
                <li>• 1 hour daily quota per IP</li>
                <li>• 2-minute expiry warning</li>
                <li>• Automatic cleanup on disconnect</li>
              </ul>
            </div>

            <div>
              <h3 className="font-medium text-white mb-3 flex items-center gap-2">
                <Users className="w-4 h-4 text-blue-400" />
                Resource Limits
              </h3>
              <ul className="space-y-2 text-sm text-slate-300">
                <li>• CPU: 0.5 cores per container</li>
                <li>• Memory: 256MB per container</li>
                <li>• Disk: Limited writable space</li>
                <li>• Network: External access only</li>
                <li>• Processes: 64 max per container</li>
              </ul>
            </div>
          </div>

          <div className="mt-6 p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
            <h4 className="font-medium text-blue-400 mb-2">Learning Tips</h4>
            <ul className="text-sm text-slate-300 space-y-1">
              <li>• Start with basic commands in Terminal to understand Linux</li>
              <li>• Use API Tester to experiment with different HTTP methods and headers</li>
              <li>• Create webhook channels to see how external services send data</li>
              <li>• Check DNS records to understand domain resolution</li>
              <li>• Everything is ephemeral — experiment freely without worry</li>
            </ul>
          </div>
        </section>

        {/* Footer */}
        <div className="text-center py-8">
          <p className="text-slate-400">
            Happy learning! 🚀 Questions? Check the terminal with <code className="bg-slate-800 px-1 rounded text-green-400">help</code>
          </p>
        </div>
      </div>
    </div>
  );
}