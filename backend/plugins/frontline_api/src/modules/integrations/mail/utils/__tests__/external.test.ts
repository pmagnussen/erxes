import { simpleParser } from 'mailparser';
import { IMailIntegrationDocument } from '@/integrations/mail/@types/integration';
import { toInboundPayload } from '@/integrations/mail/utils/external/imap';
import {
  decryptSecret,
  encryptSecret,
} from '@/integrations/mail/utils/external/secrets';
import { normalizeExternalSettings } from '@/integrations/mail/utils/external/settings';

jest.mock('@/integrations/mail/controller/receiveMessage', () => ({
  ingestInboundMail: jest.fn(),
}));

const SUBDOMAIN = 'test';

const RAW = [
  'From: Jane Doe <jane@example.com>',
  'To: support+abc123@vera.fo',
  'Cc: other@example.com',
  'Subject: Re: Help',
  'Message-ID: <m1@example.com>',
  'In-Reply-To: <m0@vera.fo>',
  'References: <a@vera.fo> <m0@vera.fo>',
  'Return-Path: <bounce@example.com>',
  'Date: Sat, 03 Oct 2026 10:00:00 +0000',
  'MIME-Version: 1.0',
  'Content-Type: multipart/mixed; boundary="b"',
  '',
  '--b',
  'Content-Type: text/html; charset=utf-8',
  '',
  '<p>Hello</p>',
  '--b',
  'Content-Type: text/plain; name="a.txt"',
  'Content-Disposition: attachment; filename="a.txt"',
  '',
  'file body',
  '--b--',
  '',
].join('\r\n');

const integration = {
  _id: 'int1',
  address: 'support@vera.fo',
} as IMailIntegrationDocument;

describe('external mail', () => {
  beforeAll(() => {
    process.env.MAIL_CREDENTIALS_KEY = 'unit-test-key';
  });

  it('round-trips an encrypted password', () => {
    const stored = encryptSecret(SUBDOMAIN, 's3cret');

    expect(stored).not.toContain('s3cret');
    expect(decryptSecret(SUBDOMAIN, stored)).toBe('s3cret');
  });

  it('maps a fetched message to the inbound payload', async () => {
    const parsed = await simpleParser(Buffer.from(RAW));
    const payload = toInboundPayload(integration, parsed, 7);

    expect(payload.to).toBe('support+abc123@vera.fo');
    expect(payload.messageId).toBe('<m1@example.com>');
    expect(payload.inReplyTo).toBe('<m0@vera.fo>');
    expect(payload.references).toEqual(['<a@vera.fo>', '<m0@vera.fo>']);
    expect(payload.from).toEqual({
      name: 'Jane Doe',
      address: 'jane@example.com',
    });
    expect(payload.envelopeFrom).toBe('bounce@example.com');
    expect(payload.cc).toEqual([{ address: 'other@example.com' }]);
    expect(payload.html).toContain('<p>Hello</p>');
    expect(payload.attachments).toHaveLength(1);
    expect(payload.attachments?.[0].filename).toBe('a.txt');
    expect(
      Buffer.from(payload.attachments?.[0].content ?? '', 'base64').toString(),
    ).toBe('file body');
  });

  it('keeps the stored password and cursor when only the port changes', () => {
    const first = normalizeExternalSettings(SUBDOMAIN, {
      imap: { host: 'mail.vera.fo', user: 'u', password: 'p' },
      smtp: { host: 'mail.vera.fo', user: 'u', password: 'p' },
    });

    const previous = {
      imap: { ...first.imap, uidValidity: '1', lastUid: 42 },
      smtp: first.smtp,
    };

    const next = normalizeExternalSettings(
      SUBDOMAIN,
      { imap: { port: 143, secure: false }, smtp: {} },
      previous,
    );

    expect(next.imap.port).toBe(143);
    expect(next.imap.password).toBe(first.imap.password);
    expect(next.imap.lastUid).toBe(42);
    expect(decryptSecret(SUBDOMAIN, next.smtp.password)).toBe('p');
  });

  it('resets the cursor when the mailbox changes', () => {
    const first = normalizeExternalSettings(SUBDOMAIN, {
      imap: { host: 'h', user: 'u', password: 'p' },
      smtp: { host: 'h', user: 'u', password: 'p' },
    });

    const next = normalizeExternalSettings(
      SUBDOMAIN,
      { imap: { mailbox: 'Support' }, smtp: {} },
      {
        imap: { ...first.imap, uidValidity: '1', lastUid: 42 },
        smtp: first.smtp,
      },
    );

    expect(next.imap.lastUid).toBeUndefined();
  });

  it('requires a password for a new server', () => {
    expect(() =>
      normalizeExternalSettings(SUBDOMAIN, {
        imap: { host: 'h', user: 'u' },
        smtp: { host: 'h', user: 'u', password: 'p' },
      }),
    ).toThrow('IMAP password is required');
  });
});
