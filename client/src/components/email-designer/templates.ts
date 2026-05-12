import type { CanvasTab } from './types';

export const DEFAULT_SETTINGS = {
  bodyBg: '#f6f9fc',
  containerBg: '#ffffff',
  maxWidth: '600px',
  fontFamily: 'sans-serif',
  padding: '40px',
  borderRadius: '8px',
};

export const DEFAULT_BLOCKS = [
  {
    id: '1',
    type: 'Image',
    src: 'https://fra.cloud.appwrite.io/v1/storage/buckets/697b974d001a7a80496e/files/697b9764002453409e98/view?project=69735edc00127d2033d8&mode=admin',
    alt: 'FairArena Logo',
    style: { width: '80px', height: 'auto', margin: '0 auto', display: 'block' }
  },
  {
    id: '2',
    type: 'Heading',
    content: 'Welcome to FairArena',
    style: { color: '#111827', textAlign: 'center', fontSize: '28px', fontWeight: 'bold', margin: '30px 0 10px 0', fontFamily: 'sans-serif' }
  },
  {
    id: '3',
    type: 'Text',
    content: 'We are thrilled to have you on board. Start building amazing hackathons and tools with our new platform features.',
    style: { color: '#4b5563', fontSize: '16px', lineHeight: '26px', textAlign: 'center', margin: '0 0 20px 0', fontFamily: 'sans-serif' }
  },
  {
    id: '4',
    type: 'Button',
    content: 'Get Started Today',
    href: 'https://fairarena.app',
    style: { backgroundColor: '#000000', color: '#ffffff', padding: '14px 24px', borderRadius: '8px', textDecoration: 'none', display: 'inline-block', textAlign: 'center', marginTop: '10px', fontWeight: 'bold', fontFamily: 'sans-serif' }
  }
];

export const EMAIL_TEMPLATES: Omit<CanvasTab, 'id' | 'createdAt' | 'updatedAt'>[] = [
  {
    name: 'Welcome Email',
    settings: { ...DEFAULT_SETTINGS },
    blocks: [
      { id: 'w1', type: 'Image', src: 'https://fra.cloud.appwrite.io/v1/storage/buckets/697b974d001a7a80496e/files/697b9764002453409e98/view?project=69735edc00127d2033d8&mode=admin', alt: 'Logo', style: { width: '80px', display: 'block', margin: '0 auto' } },
      { id: 'w2', type: 'Spacer', style: { height: '24px' } },
      { id: 'w3', type: 'Heading', content: '👋 Welcome to FairArena!', style: { color: '#111827', fontSize: '26px', fontWeight: 'bold', textAlign: 'center', margin: '0' } },
      { id: 'w4', type: 'Spacer', style: { height: '16px' } },
      { id: 'w5', type: 'Text', content: "We're excited to have you on board. FairArena is the place for builders, hackers, and creators. Let's build something great together.", style: { color: '#4b5563', fontSize: '15px', lineHeight: '26px', textAlign: 'center', margin: '0' } },
      { id: 'w6', type: 'Spacer', style: { height: '28px' } },
      { id: 'w7', type: 'Button', content: 'Get Started →', href: 'https://fairarena.app', style: { backgroundColor: '#000000', color: '#ffffff', padding: '14px 28px', borderRadius: '8px', display: 'inline-block', fontWeight: 'bold', textDecoration: 'none', textAlign: 'center' } },
      { id: 'w8', type: 'Spacer', style: { height: '40px' } },
      { id: 'w9', type: 'Divider', style: { borderColor: '#e5e7eb', borderTopWidth: '1px', borderTopStyle: 'solid', margin: '0' } },
      { id: 'w10', type: 'Spacer', style: { height: '20px' } },
      { id: 'w11', type: 'Text', content: '© 2026 FairArena · All rights reserved · Unsubscribe', style: { color: '#9ca3af', fontSize: '12px', textAlign: 'center', margin: '0' } },
    ],
  },
  {
    name: 'Product Launch',
    settings: { ...DEFAULT_SETTINGS, bodyBg: '#000000', containerBg: '#111111' },
    blocks: [
      { id: 'pl1', type: 'Image', src: 'https://fra.cloud.appwrite.io/v1/storage/buckets/697b974d001a7a80496e/files/697b9764002453409e98/view?project=69735edc00127d2033d8&mode=admin', alt: 'Logo', style: { width: '60px', display: 'block', margin: '0 auto' } },
      { id: 'pl2', type: 'Spacer', style: { height: '30px' } },
      { id: 'pl3', type: 'Heading', content: '🚀 Something new is here', style: { color: '#ffffff', fontSize: '32px', fontWeight: 'bold', textAlign: 'center', lineHeight: '42px', margin: '0' } },
      { id: 'pl4', type: 'Spacer', style: { height: '16px' } },
      { id: 'pl5', type: 'Text', content: 'Introducing FairArena Tools — a suite of powerful developer tools designed to supercharge your workflow. Available now.', style: { color: '#a1a1aa', fontSize: '16px', lineHeight: '28px', textAlign: 'center', margin: '0' } },
      { id: 'pl6', type: 'Spacer', style: { height: '32px' } },
      { id: 'pl7', type: 'Button', content: 'Explore Now', href: 'https://tools.fairarena.app', style: { backgroundColor: '#ffffff', color: '#000000', padding: '14px 32px', borderRadius: '100px', display: 'inline-block', fontWeight: 'bold', textDecoration: 'none', textAlign: 'center' } },
      { id: 'pl8', type: 'Spacer', style: { height: '40px' } },
      { id: 'pl9', type: 'Text', content: '© 2026 FairArena · Unsubscribe', style: { color: '#52525b', fontSize: '12px', textAlign: 'center', margin: '0' } },
    ],
  },
  {
    name: 'Newsletter',
    settings: { ...DEFAULT_SETTINGS },
    blocks: [
      { id: 'nl1', type: 'Image', src: 'https://fra.cloud.appwrite.io/v1/storage/buckets/697b974d001a7a80496e/files/697b9764002453409e98/view?project=69735edc00127d2033d8&mode=admin', alt: 'Logo', style: { width: '70px', display: 'block', margin: '0 auto' } },
      { id: 'nl2', type: 'Spacer', style: { height: '20px' } },
      { id: 'nl3', type: 'Text', content: 'THE MONTHLY DIGEST', style: { color: '#6b7280', fontSize: '11px', fontWeight: 'bold', textAlign: 'center', letterSpacing: '3px', margin: '0' } },
      { id: 'nl4', type: 'Heading', content: "What's new this month", style: { color: '#111827', fontSize: '28px', fontWeight: 'bold', textAlign: 'center', margin: '8px 0 0 0' } },
      { id: 'nl5', type: 'Divider', style: { borderColor: '#e5e7eb', borderTopWidth: '1px', borderTopStyle: 'solid', margin: '24px 0' } },
      { id: 'nl6', type: 'Heading', content: '🛠 New Tools Launched', style: { color: '#111827', fontSize: '18px', fontWeight: 'bold', margin: '0 0 8px 0' } },
      { id: 'nl7', type: 'Text', content: 'We shipped 3 new tools this month including an AI-powered SQL editor, a Git story visualizer, and a drag-and-drop email builder. Check them out!', style: { color: '#4b5563', fontSize: '14px', lineHeight: '24px', margin: '0 0 16px 0' } },
      { id: 'nl8', type: 'Link', content: 'Read more →', href: 'https://tools.fairarena.app', style: { color: '#2563eb', fontSize: '14px', fontWeight: '600' } },
      { id: 'nl9', type: 'Divider', style: { borderColor: '#e5e7eb', borderTopWidth: '1px', borderTopStyle: 'solid', margin: '24px 0' } },
      { id: 'nl10', type: 'Heading', content: '🏆 Hackathon Season', style: { color: '#111827', fontSize: '18px', fontWeight: 'bold', margin: '0 0 8px 0' } },
      { id: 'nl11', type: 'Text', content: 'The summer hackathon season is heating up. Register your team, pick your challenge, and start building. Prize pool is $50,000.', style: { color: '#4b5563', fontSize: '14px', lineHeight: '24px', margin: '0 0 16px 0' } },
      { id: 'nl12', type: 'Link', content: 'Register now →', href: 'https://fairarena.app', style: { color: '#2563eb', fontSize: '14px', fontWeight: '600' } },
      { id: 'nl13', type: 'Divider', style: { borderColor: '#e5e7eb', borderTopWidth: '1px', borderTopStyle: 'solid', margin: '24px 0' } },
      { id: 'nl14', type: 'Text', content: '© 2026 FairArena · Unsubscribe · Privacy Policy', style: { color: '#9ca3af', fontSize: '12px', textAlign: 'center', margin: '0' } },
    ],
  },
  {
    name: 'Transactional',
    settings: { ...DEFAULT_SETTINGS },
    blocks: [
      { id: 'tr1', type: 'Image', src: 'https://fra.cloud.appwrite.io/v1/storage/buckets/697b974d001a7a80496e/files/697b9764002453409e98/view?project=69735edc00127d2033d8&mode=admin', alt: 'Logo', style: { width: '70px', display: 'block', margin: '0 auto' } },
      { id: 'tr2', type: 'Spacer', style: { height: '20px' } },
      { id: 'tr3', type: 'Heading', content: 'Your order is confirmed ✅', style: { color: '#111827', fontSize: '22px', fontWeight: 'bold', textAlign: 'center', margin: '0' } },
      { id: 'tr4', type: 'Spacer', style: { height: '12px' } },
      { id: 'tr5', type: 'Text', content: 'Hi there! Your purchase has been confirmed. Here are your order details below:', style: { color: '#4b5563', fontSize: '14px', lineHeight: '24px', textAlign: 'center', margin: '0' } },
      { id: 'tr6', type: 'Spacer', style: { height: '24px' } },
      { id: 'tr7', type: 'Text', content: 'Order #FA-2026-00482', style: { color: '#111827', fontSize: '13px', fontWeight: 'bold', backgroundColor: '#f3f4f6', padding: '14px 20px', borderRadius: '6px', margin: '0', textAlign: 'center' } },
      { id: 'tr8', type: 'Spacer', style: { height: '24px' } },
      { id: 'tr9', type: 'Button', content: 'View Order Details', href: '#', style: { backgroundColor: '#111827', color: '#ffffff', padding: '12px 24px', borderRadius: '6px', display: 'inline-block', fontWeight: 'bold', textDecoration: 'none', textAlign: 'center' } },
      { id: 'tr10', type: 'Spacer', style: { height: '32px' } },
      { id: 'tr11', type: 'Divider', style: { borderColor: '#e5e7eb', borderTopWidth: '1px', borderTopStyle: 'solid', margin: '0' } },
      { id: 'tr12', type: 'Spacer', style: { height: '16px' } },
      { id: 'tr13', type: 'Text', content: 'Questions? Reply to this email or contact support@fairarena.app', style: { color: '#9ca3af', fontSize: '12px', textAlign: 'center', margin: '0' } },
    ],
  },
  {
    name: 'Reset Password',
    settings: { ...DEFAULT_SETTINGS },
    blocks: [
      { id: 'rp1', type: 'Image', src: 'https://fra.cloud.appwrite.io/v1/storage/buckets/697b974d001a7a80496e/files/697b9764002453409e98/view?project=69735edc00127d2033d8&mode=admin', alt: 'Logo', style: { width: '70px', display: 'block', margin: '0 auto' } },
      { id: 'rp2', type: 'Spacer', style: { height: '24px' } },
      { id: 'rp3', type: 'Heading', content: 'Reset your password 🔐', style: { color: '#111827', fontSize: '24px', fontWeight: 'bold', textAlign: 'center', margin: '0' } },
      { id: 'rp4', type: 'Spacer', style: { height: '12px' } },
      { id: 'rp5', type: 'Text', content: 'We received a request to reset the password for your account. Click the button below to reset it. This link will expire in 1 hour.', style: { color: '#4b5563', fontSize: '15px', lineHeight: '26px', textAlign: 'center', margin: '0' } },
      { id: 'rp6', type: 'Spacer', style: { height: '28px' } },
      { id: 'rp7', type: 'Button', content: 'Reset Password', href: '#', style: { backgroundColor: '#dc2626', color: '#ffffff', padding: '14px 28px', borderRadius: '8px', display: 'inline-block', fontWeight: 'bold', textDecoration: 'none', textAlign: 'center' } },
      { id: 'rp8', type: 'Spacer', style: { height: '24px' } },
      { id: 'rp9', type: 'Text', content: "If you didn't request this, please ignore this email. Your password will not be changed.", style: { color: '#9ca3af', fontSize: '13px', textAlign: 'center', margin: '0' } },
      { id: 'rp10', type: 'Spacer', style: { height: '32px' } },
      { id: 'rp11', type: 'Divider', style: { borderColor: '#e5e7eb', borderTopWidth: '1px', borderTopStyle: 'solid', margin: '0' } },
      { id: 'rp12', type: 'Spacer', style: { height: '16px' } },
      { id: 'rp13', type: 'Text', content: '© 2026 FairArena · All rights reserved', style: { color: '#9ca3af', fontSize: '12px', textAlign: 'center', margin: '0' } },
    ],
  },
  {
    name: 'Two Column Feature',
    settings: { ...DEFAULT_SETTINGS },
    blocks: [
      { id: 'tc1', type: 'Image', src: 'https://fra.cloud.appwrite.io/v1/storage/buckets/697b974d001a7a80496e/files/697b9764002453409e98/view?project=69735edc00127d2033d8&mode=admin', alt: 'Logo', style: { width: '70px', display: 'block', margin: '0 auto' } },
      { id: 'tc2', type: 'Spacer', style: { height: '20px' } },
      { id: 'tc3', type: 'Heading', content: 'Platform Highlights', style: { color: '#111827', fontSize: '26px', fontWeight: 'bold', textAlign: 'center', margin: '0' } },
      { id: 'tc4', type: 'Spacer', style: { height: '8px' } },
      { id: 'tc5', type: 'Text', content: 'Everything you need to build, test and ship faster.', style: { color: '#6b7280', fontSize: '14px', textAlign: 'center', margin: '0' } },
      { id: 'tc6', type: 'Spacer', style: { height: '24px' } },
      {
        id: 'tc7',
        type: 'Row',
        style: { gap: '20px' },
        columns: [
          {
            id: 'tc7-col1',
            width: 50,
            blocks: [
              { id: 'tc7-b1', type: 'Heading', content: '⚡ Blazing Fast', style: { color: '#111827', fontSize: '16px', fontWeight: 'bold', margin: '0 0 8px 0' } },
              { id: 'tc7-b2', type: 'Text', content: 'Sub-100ms response times. Globally distributed infrastructure with 99.9% uptime.', style: { color: '#4b5563', fontSize: '13px', lineHeight: '22px', margin: '0' } },
            ]
          },
          {
            id: 'tc7-col2',
            width: 50,
            blocks: [
              { id: 'tc7-b3', type: 'Heading', content: '🔒 Secure by Default', style: { color: '#111827', fontSize: '16px', fontWeight: 'bold', margin: '0 0 8px 0' } },
              { id: 'tc7-b4', type: 'Text', content: 'End-to-end encryption, SOC2 compliant, with granular access controls.', style: { color: '#4b5563', fontSize: '13px', lineHeight: '22px', margin: '0' } },
            ]
          }
        ]
      },
      { id: 'tc8', type: 'Spacer', style: { height: '24px' } },
      { id: 'tc9', type: 'Button', content: 'Explore Features', href: 'https://fairarena.app', style: { backgroundColor: '#000000', color: '#ffffff', padding: '12px 28px', borderRadius: '8px', display: 'inline-block', fontWeight: 'bold', textDecoration: 'none', textAlign: 'center' } },
      { id: 'tc10', type: 'Spacer', style: { height: '32px' } },
      { id: 'tc11', type: 'Divider', style: { borderColor: '#e5e7eb', borderTopWidth: '1px', borderTopStyle: 'solid', margin: '0' } },
      { id: 'tc12', type: 'Spacer', style: { height: '16px' } },
      { id: 'tc13', type: 'Text', content: '© 2026 FairArena · Unsubscribe', style: { color: '#9ca3af', fontSize: '12px', textAlign: 'center', margin: '0' } },
    ],
  },
  {
    name: 'Event Invitation',
    settings: { ...DEFAULT_SETTINGS, bodyBg: '#eef2ff' },
    blocks: [
      { id: 'ei1', type: 'Image', src: 'https://fra.cloud.appwrite.io/v1/storage/buckets/697b974d001a7a80496e/files/697b9764002453409e98/view?project=69735edc00127d2033d8&mode=admin', alt: 'Logo', style: { width: '60px', display: 'block', margin: '0 auto' } },
      { id: 'ei2', type: 'Spacer', style: { height: '30px' } },
      { id: 'ei3', type: 'Heading', content: 'You are invited! 🎟️', style: { color: '#4f46e5', fontSize: '32px', fontWeight: 'bold', textAlign: 'center', margin: '0' } },
      { id: 'ei4', type: 'Spacer', style: { height: '16px' } },
      { id: 'ei5', type: 'Text', content: 'Join us for our annual FairArena Developer Conference. Two days of deep technical talks, workshops, and networking.', style: { color: '#374151', fontSize: '16px', lineHeight: '26px', textAlign: 'center', margin: '0' } },
      { id: 'ei6', type: 'Spacer', style: { height: '24px' } },
      { id: 'ei7', type: 'Row', style: { gap: '10px' }, columns: [
        { id: 'ei7-c1', width: 50, blocks: [
          { id: 'ei7-c1-t1', type: 'Text', content: '📅 Oct 24-25, 2026', style: { color: '#111827', fontSize: '14px', fontWeight: 'bold', textAlign: 'center' } }
        ] },
        { id: 'ei7-c2', width: 50, blocks: [
          { id: 'ei7-c2-t1', type: 'Text', content: '📍 San Francisco, CA', style: { color: '#111827', fontSize: '14px', fontWeight: 'bold', textAlign: 'center' } }
        ] }
      ] },
      { id: 'ei8', type: 'Spacer', style: { height: '32px' } },
      { id: 'ei9', type: 'Button', content: 'Claim Your Ticket', href: '#', style: { backgroundColor: '#4f46e5', color: '#ffffff', padding: '16px 32px', borderRadius: '100px', display: 'inline-block', fontWeight: 'bold', textDecoration: 'none', textAlign: 'center' } },
      { id: 'ei10', type: 'Spacer', style: { height: '40px' } },
      { id: 'ei11', type: 'Text', content: '© 2026 FairArena · Unsubscribe', style: { color: '#9ca3af', fontSize: '12px', textAlign: 'center', margin: '0' } },
    ]
  },
  {
    name: 'Abandoned Cart',
    settings: { ...DEFAULT_SETTINGS },
    blocks: [
      { id: 'ac1', type: 'Heading', content: 'Did you forget something? 👀', style: { color: '#111827', fontSize: '24px', fontWeight: 'bold', textAlign: 'center', margin: '0' } },
      { id: 'ac2', type: 'Spacer', style: { height: '16px' } },
      { id: 'ac3', type: 'Text', content: 'We noticed you left some items in your cart. Good news—we saved them for you!', style: { color: '#4b5563', fontSize: '15px', lineHeight: '24px', textAlign: 'center', margin: '0' } },
      { id: 'ac4', type: 'Spacer', style: { height: '32px' } },
      { id: 'ac5', type: 'Row', style: { gap: '20px' }, columns: [
        { id: 'ac5-c1', width: 30, blocks: [
          { id: 'ac5-img', type: 'Image', src: 'https://placehold.co/150x150/f3f4f6/a1a1aa?text=Product', alt: 'Product', style: { width: '100%', borderRadius: '8px' } }
        ] },
        { id: 'ac5-c2', width: 70, blocks: [
          { id: 'ac5-title', type: 'Heading', content: 'FairArena Pro Annual', style: { color: '#111827', fontSize: '16px', fontWeight: 'bold', margin: '0 0 8px 0' } },
          { id: 'ac5-desc', type: 'Text', content: 'Access all premium tools, API endpoints, and prioritized support.', style: { color: '#6b7280', fontSize: '14px', lineHeight: '20px', margin: '0 0 12px 0' } },
          { id: 'ac5-price', type: 'Text', content: '$199.00', style: { color: '#111827', fontSize: '16px', fontWeight: 'bold', margin: '0' } }
        ] }
      ] },
      { id: 'ac6', type: 'Spacer', style: { height: '32px' } },
      { id: 'ac7', type: 'Button', content: 'Complete Checkout', href: '#', style: { backgroundColor: '#111827', color: '#ffffff', padding: '14px 28px', borderRadius: '8px', display: 'inline-block', fontWeight: 'bold', textDecoration: 'none', textAlign: 'center' } },
    ]
  },
  {
    name: 'App Upgrade',
    settings: { ...DEFAULT_SETTINGS, containerBg: '#0f172a', bodyBg: '#020617' },
    blocks: [
      { id: 'up1', type: 'Heading', content: 'Upgrade to Pro ⚡', style: { color: '#f8fafc', fontSize: '28px', fontWeight: 'bold', textAlign: 'center', margin: '0' } },
      { id: 'up2', type: 'Spacer', style: { height: '16px' } },
      { id: 'up3', type: 'Text', content: 'You are currently on the free plan. Upgrade to Pro to unlock unlimited projects, team collaboration, and advanced analytics.', style: { color: '#94a3b8', fontSize: '16px', lineHeight: '26px', textAlign: 'center', margin: '0' } },
      { id: 'up4', type: 'Spacer', style: { height: '32px' } },
      { id: 'up5', type: 'Button', content: 'Upgrade Now - $15/mo', href: '#', style: { backgroundColor: '#3b82f6', color: '#ffffff', padding: '16px 32px', borderRadius: '8px', display: 'inline-block', fontWeight: 'bold', textDecoration: 'none', textAlign: 'center', width: '100%' } },
      { id: 'up6', type: 'Spacer', style: { height: '24px' } },
      { id: 'up7', type: 'Text', content: 'Need a custom plan? Contact our sales team.', style: { color: '#64748b', fontSize: '13px', textAlign: 'center', margin: '0' } },
    ]
  },
  {
    name: 'Developer Update',
    settings: { ...DEFAULT_SETTINGS, bodyBg: '#0f172a', containerBg: '#1e293b' },
    blocks: [
      { id: 'du1', type: 'Text', content: 'SYSTEM UPDATE // v2.4.0', style: { color: '#38bdf8', fontSize: '11px', fontWeight: 'bold', letterSpacing: '2px', margin: '0' } },
      { id: 'du2', type: 'Heading', content: 'The AI Engine is here', style: { color: '#f8fafc', fontSize: '28px', fontWeight: 'bold', margin: '12px 0' } },
      { id: 'du3', type: 'Text', content: 'We just rolled out our most requested feature: Native AI integrations for all workspace automations.', style: { color: '#94a3b8', fontSize: '15px', lineHeight: '24px' } },
      { id: 'du4', type: 'Spacer', style: { height: '20px' } },
      { id: 'du5', type: 'Text', content: 'git commit -m "feat: add ai logic engine"', style: { color: '#38bdf8', fontSize: '13px', backgroundColor: '#0f172a', padding: '12px', borderRadius: '4px', fontFamily: 'monospace' } },
      { id: 'du6', type: 'Spacer', style: { height: '24px' } },
      { id: 'du7', type: 'Button', content: 'Read Documentation', href: '#', style: { backgroundColor: '#38bdf8', color: '#0f172a', padding: '12px 24px', borderRadius: '6px', fontWeight: 'bold' } }
    ]
  },
  {
    name: 'SaaS Report',
    settings: { ...DEFAULT_SETTINGS },
    blocks: [
      { id: 'sr1', type: 'Heading', content: 'Weekly Performance Report', style: { color: '#111827', fontSize: '24px', fontWeight: 'bold', textAlign: 'center' } },
      { id: 'sr2', type: 'Spacer', style: { height: '20px' } },
      { id: 'sr3', type: 'Row', style: { gap: '10px' }, columns: [
        { id: 'sr3c1', width: 50, blocks: [{ id: 'sr3b1', type: 'Text', content: 'Active Users', style: { color: '#6b7280', fontSize: '12px', textAlign: 'center' } }, { id: 'sr3b2', type: 'Heading', content: '1,248', style: { color: '#10b981', fontSize: '24px', fontWeight: 'bold', textAlign: 'center', margin: '4px 0' } }] },
        { id: 'sr3c2', width: 50, blocks: [{ id: 'sr3b3', type: 'Text', content: 'Revenue', style: { color: '#6b7280', fontSize: '12px', textAlign: 'center' } }, { id: 'sr3b4', type: 'Heading', content: '$42,500', style: { color: '#2563eb', fontSize: '24px', fontWeight: 'bold', textAlign: 'center', margin: '4px 0' } }] }
      ] },
      { id: 'sr4', type: 'Spacer', style: { height: '20px' } },
      { id: 'sr5', type: 'Button', content: 'Open Dashboard', href: '#', style: { backgroundColor: '#111827', color: '#ffffff', padding: '12px 24px', borderRadius: '6px', width: '100%', textAlign: 'center' } }
    ]
  },
  {
    name: 'Cyberpunk Promo',
    settings: { ...DEFAULT_SETTINGS, bodyBg: '#050505', containerBg: '#0a0a0a' },
    blocks: [
      { id: 'cp1', type: 'Heading', content: 'NEON NIGHTS 2026', style: { color: '#f0f', fontSize: '36px', fontWeight: '900', textAlign: 'center', fontStyle: 'italic', textShadow: '0 0 10px #f0f' } },
      { id: 'cp2', type: 'Spacer', style: { height: '20px' } },
      { id: 'cp3', type: 'Text', content: 'The future is now. Get 50% off all cybernetic upgrades this weekend only.', style: { color: '#0ff', fontSize: '16px', textAlign: 'center', textShadow: '0 0 5px #0ff' } },
      { id: 'cp4', type: 'Spacer', style: { height: '30px' } },
      { id: 'cp5', type: 'Button', content: 'ACCESS TERMINAL', href: '#', style: { backgroundColor: '#f0f', color: '#fff', padding: '16px 32px', border: '2px solid #0ff', fontWeight: 'bold' } }
    ]
  },
  {
    name: 'Minimal Blog',
    settings: { ...DEFAULT_SETTINGS, bodyBg: '#ffffff', containerBg: '#ffffff', fontFamily: 'serif' },
    blocks: [
      { id: 'mb1', type: 'Text', content: 'ISSUE NO. 12', style: { color: '#888', fontSize: '11px', textAlign: 'center', letterSpacing: '4px' } },
      { id: 'mb2', type: 'Heading', content: 'The Art of Slow Living', style: { color: '#111', fontSize: '32px', textAlign: 'center', margin: '20px 0' } },
      { id: 'mb3', type: 'Divider', style: { borderColor: '#eee', margin: '30px 0' } },
      { id: 'mb4', type: 'Text', content: 'Finding peace in a world that never stops moving. This week we explore the benefits of intentional simplicity and digital minimalism.', style: { color: '#444', fontSize: '18px', lineHeight: '1.6', textAlign: 'justify' } },
      { id: 'mb5', type: 'Spacer', style: { height: '40px' } },
      { id: 'mb6', type: 'Link', content: 'Read the full essay →', href: '#', style: { color: '#111', fontWeight: 'bold', textDecoration: 'underline' } }
    ]
  },
  {
    name: 'Webinar Invite',
    settings: { ...DEFAULT_SETTINGS, bodyBg: '#f0f9ff' },
    blocks: [
      { id: 'wi1', type: 'Image', src: 'https://placehold.co/600x300/2563eb/white?text=LIVE+WEBINAR', alt: 'Hero', style: { width: '100%', borderRadius: '12px' } },
      { id: 'wi2', type: 'Spacer', style: { height: '24px' } },
      { id: 'wi3', type: 'Heading', content: 'Scaling to 10M Users', style: { color: '#1e3a8a', fontSize: '26px', fontWeight: '800' } },
      { id: 'wi4', type: 'Text', content: 'Join our lead architects as they share the secrets behind our infrastructure migration.', style: { color: '#1e40af', fontSize: '16px', lineHeight: '26px' } },
      { id: 'wi5', type: 'Spacer', style: { height: '24px' } },
      { id: 'wi6', type: 'Button', content: 'Save My Seat', href: '#', style: { backgroundColor: '#2563eb', color: '#fff', padding: '14px 28px', borderRadius: '100px' } }
    ]
  },
  {
    name: 'Community Shoutout',
    settings: { ...DEFAULT_SETTINGS },
    blocks: [
      { id: 'cs1', type: 'Heading', content: 'Makers of the Month 🏆', style: { color: '#111827', fontSize: '22px', fontWeight: 'bold' } },
      { id: 'cs2', type: 'Spacer', style: { height: '16px' } },
      { id: 'cs3', type: 'Text', content: "Here's what our incredible community has been building lately. Give them some love!", style: { color: '#4b5563', fontSize: '14px' } },
      { id: 'cs4', type: 'Spacer', style: { height: '24px' } },
      { id: 'cs5', type: 'Row', style: { gap: '15px' }, columns: [
        { id: 'cs5c1', width: 33, blocks: [{ id: 'cs5img1', type: 'Image', src: 'https://placehold.co/100x100/f3f4f6/333?text=A', alt: 'Avatar', style: { width: '50px', borderRadius: '50%' } }, { id: 'cs5t1', type: 'Text', content: 'Sarah J.', style: { fontSize: '12px', fontWeight: 'bold' } }] },
        { id: 'cs5c2', width: 33, blocks: [{ id: 'cs5img2', type: 'Image', src: 'https://placehold.co/100x100/f3f4f6/333?text=B', alt: 'Avatar', style: { width: '50px', borderRadius: '50%' } }, { id: 'cs5t2', type: 'Text', content: 'Mike R.', style: { fontSize: '12px', fontWeight: 'bold' } }] },
        { id: 'cs5c3', width: 33, blocks: [{ id: 'cs5img3', type: 'Image', src: 'https://placehold.co/100x100/f3f4f6/333?text=C', alt: 'Avatar', style: { width: '50px', borderRadius: '50%' } }, { id: 'cs5t3', type: 'Text', content: 'Leila K.', style: { fontSize: '12px', fontWeight: 'bold' } }] }
      ] }
    ]
  }
];
