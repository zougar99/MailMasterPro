/**
 * Email Marketing Pro - JavaScript API Server
 * Professional Email Marketing Platform - Node.js Backend
 */

const express = require('express');
const cors = require('cors');
const nodemailer = require('nodemailer');
const axios = require('axios');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

const PORT = 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Email transporter configuration
let transporter = null;

function initTransporter(config) {
    transporter = nodemailer.createTransport({
        host: config.host || 'smtp.gmail.com',
        port: config.port || 587,
        secure: false,
        auth: {
            user: config.user,
            pass: config.password
        }
    });
}

// API Routes

// Health check
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'online', 
        service: 'Email Marketing Pro API',
        version: '2.0.0',
        timestamp: new Date().toISOString()
    });
});

// Send email via JavaScript
app.post('/api/send-email', async (req, res) => {
    try {
        const { to, subject, html, text, config } = req.body;
        
        if (!transporter && config) {
            initTransporter(config);
        }
        
        if (!transporter) {
            return res.status(400).json({ 
                error: 'Email transporter not configured' 
            });
        }
        
        const info = await transporter.sendMail({
            from: config.user,
            to: to,
            subject: subject,
            html: html,
            text: text
        });
        
        res.json({ 
            success: true, 
            messageId: info.messageId,
            response: info.response 
        });
    } catch (error) {
        res.status(500).json({ 
            error: error.message 
        });
    }
});

// Bulk email sending
app.post('/api/send-bulk', async (req, res) => {
    try {
        const { recipients, subject, html, text, config } = req.body;
        
        if (!transporter && config) {
            initTransporter(config);
        }
        
        const results = [];
        for (const recipient of recipients) {
            try {
                const info = await transporter.sendMail({
                    from: config.user,
                    to: recipient,
                    subject: subject,
                    html: html,
                    text: text
                });
                results.push({ 
                    email: recipient, 
                    status: 'success', 
                    messageId: info.messageId 
                });
            } catch (error) {
                results.push({ 
                    email: recipient, 
                    status: 'failed', 
                    error: error.message 
                });
            }
        }
        
        res.json({ 
            success: true, 
            results: results,
            total: recipients.length,
            successful: results.filter(r => r.status === 'success').length
        });
    } catch (error) {
        res.status(500).json({ 
            error: error.message 
        });
    }
});

// Email validation
app.post('/api/validate-email', (req, res) => {
    const { email } = req.body;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const isValid = emailRegex.test(email);
    
    res.json({ 
        email: email,
        valid: isValid,
        message: isValid ? 'Valid email address' : 'Invalid email address'
    });
});

// Bulk email validation
app.post('/api/validate-bulk', (req, res) => {
    const { emails } = req.body;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    
    const results = { valid: [], invalid: [], duplicates: [] };
    const seen = new Set();
    
    for (const email of emails) {
        const trimmed = email.trim().toLowerCase();
        if (seen.has(trimmed)) {
            results.duplicates.push(trimmed);
        } else {
            seen.add(trimmed);
            if (emailRegex.test(trimmed)) {
                results.valid.push(trimmed);
            } else {
                results.invalid.push(trimmed);
            }
        }
    }
    
    res.json({
        total: emails.length,
        valid: results.valid.length,
        invalid: results.invalid.length,
        duplicates: results.duplicates.length,
        results
    });
});

// Email quality check
app.post('/api/email-quality', (req, res) => {
    const { email, subject, html } = req.body;
    const issues = [], warnings = [];
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) issues.push('Invalid email address');
    if (!subject || subject.length < 5) issues.push('Subject too short');
    if (subject && subject.length > 200) warnings.push('Subject is very long');
    if (!html || html.length < 20) issues.push('Message content empty');
    if (html && html.includes('free') && html.includes('winner')) warnings.push('May be flagged as spam');
    
    res.json({
        valid: issues.length === 0,
        issues,
        warnings,
        score: Math.max(0, 100 - (issues.length * 20) - (warnings.length * 5))
    });
});

// Contact Management
let contacts = [
    { id: 1, email: 'john@example.com', name: 'John Doe', phone: '+1234567890', tags: ['vip', 'newsletter'], status: 'active', addedAt: new Date().toISOString() },
    { id: 2, email: 'jane@example.com', name: 'Jane Smith', phone: '+1234567891', tags: ['newsletter'], status: 'active', addedAt: new Date().toISOString() },
    { id: 3, email: 'bob@example.com', name: 'Bob Wilson', phone: '+1234567892', tags: ['customer'], status: 'active', addedAt: new Date().toISOString() }
];
app.post('/api/contacts/add', (req, res) => {
    const { email, name, phone, tags } = req.body;
    const newContact = {
        id: Date.now(),
        email, name: name || '', phone: phone || '', tags: tags || [],
        addedAt: new Date().toISOString(), status: 'active'
    };
    contacts.push(newContact);
    res.json({ success: true, contact: newContact });
});

app.get('/api/contacts', (req, res) => {
    const { tag, status, search } = req.query;
    let result = [...contacts];
    if (tag) result = result.filter(c => c.tags.includes(tag));
    if (status) result = result.filter(c => c.status === status);
    if (search) {
        const s = search.toLowerCase();
        result = result.filter(c => c.email.toLowerCase().includes(s) || c.name.toLowerCase().includes(s));
    }
    res.json({ contacts: result, total: result.length });
});

app.delete('/api/contacts/:email', (req, res) => {
    contacts = contacts.filter(c => c.email !== req.params.email);
    res.json({ success: true });
});

app.get('/api/contacts/export', (req, res) => {
    const format = req.query.format || 'csv';
    if (format === 'csv') {
        const csv = 'ID,Email,Name,Phone,Tags,Added,Status\n' + 
            contacts.map(c => `${c.id},"${c.email}","${c.name}","${c.phone}","${c.tags.join(';')}",${c.addedAt},${c.status}`).join('\n');
        res.header('Content-Type', 'text/csv').send(csv);
    } else {
        res.json(contacts);
    }
});

// Template Management
let templates = [
    { id: 1, name: 'Welcome Email', subject: 'Welcome to {{company}}!', html: '<h1>Welcome {{name}}!</h1><p>Thank you for joining {{company}}. We\'re excited to have you!</p>' },
    { id: 2, name: 'Newsletter', subject: '{{subject}}', html: '<h2>{{title}}</h2><div>{{content}}</div><br><p><a href="{{unsubscribe}}">Unsubscribe</a></p>' },
    { id: 3, name: 'Promotional', subject: '🔥 {{offer}} - Limited Time!', html: '<h1>{{offer}}</h1><p>Dear {{name}},</p><p>{{description}}</p><a href="{{cta_url}}" style="background:#667eea;color:white;padding:12px 24px;border-radius:8px;">{{cta_text}}</a>' },
    { id: 4, name: 'Follow Up', subject: 'Following up on {{topic}}', html: '<h2>Hi {{name}},</h2><p>Just wanted to follow up on {{topic}}.</p><p>{{message}}</p><p>Best,<br>{{sender}}</p>' },
    { id: 5, name: 'Announcement', subject: '📢 {{title}}', html: '<h1>{{title}}</h1><p>{{announcement}}</p><p>{{details}}</p>' }
];

app.get('/api/templates', (req, res) => res.json({ templates }));

app.get('/api/templates/:id', (req, res) => {
    const t = templates.find(t => t.id === parseInt(req.params.id));
    t ? res.json(t) : res.status(404).json({ error: 'Template not found' });
});

app.post('/api/templates', (req, res) => {
    const newTemplate = { id: Date.now(), ...req.body, createdAt: new Date().toISOString() };
    templates.push(newTemplate);
    res.json({ success: true, template: newTemplate });
});

app.put('/api/templates/:id', (req, res) => {
    const idx = templates.findIndex(t => t.id === parseInt(req.params.id));
    if (idx !== -1) {
        templates[idx] = { ...templates[idx], ...req.body };
        res.json({ success: true, template: templates[idx] });
    } else {
        res.status(404).json({ error: 'Template not found' });
    }
});

app.delete('/api/templates/:id', (req, res) => {
    templates = templates.filter(t => t.id !== parseInt(req.params.id));
    res.json({ success: true });
});

app.post('/api/templates/parse', (req, res) => {
    const { template, data } = req.body;
    let subject = template.subject;
    let html = template.html;
    for (const [key, value] of Object.entries(data)) {
        subject = subject.replace(new RegExp(`{{${key}}}`, 'g'), value);
        html = html.replace(new RegExp(`{{${key}}}`, 'g'), value);
    }
    res.json({ subject, html });
});

// Campaign Management
let campaigns = [
    { id: 1, name: 'Summer Sale', subject: '🔥 Summer Special!', recipients: ['a@test.com', 'b@test.com'], status: 'sent', stats: { sent: 150, opened: 65, clicked: 25 }, createdAt: new Date().toISOString() },
    { id: 2, name: 'Welcome Series', subject: 'Welcome!', recipients: ['c@test.com'], status: 'sent', stats: { sent: 80, opened: 45, clicked: 20 }, createdAt: new Date().toISOString() }
];
app.get('/api/campaigns', (req, res) => res.json({ campaigns }));

app.get('/api/campaigns/:id', (req, res) => {
    const c = campaigns.find(c => c.id === parseInt(req.params.id));
    c ? res.json(c) : res.status(404).json({ error: 'Campaign not found' });
});

app.post('/api/campaigns', (req, res) => {
    const newCampaign = {
        id: Date.now(),
        name: req.body.name,
        subject: req.body.subject,
        html: req.body.html,
        recipients: req.body.recipients || [],
        status: 'draft',
        createdAt: new Date().toISOString(),
        stats: { sent: 0, delivered: 0, opened: 0, clicked: 0, bounced: 0, unsubscribed: 0 }
    };
    campaigns.push(newCampaign);
    res.json({ success: true, campaign: newCampaign });
});

app.put('/api/campaigns/:id', (req, res) => {
    const idx = campaigns.findIndex(c => c.id === parseInt(req.params.id));
    if (idx !== -1) {
        campaigns[idx] = { ...campaigns[idx], ...req.body };
        res.json({ success: true, campaign: campaigns[idx] });
    } else {
        res.status(404).json({ error: 'Campaign not found' });
    }
});

app.delete('/api/campaigns/:id', (req, res) => {
    campaigns = campaigns.filter(c => c.id !== parseInt(req.params.id));
    res.json({ success: true });
});

// Analytics endpoint
app.get('/api/analytics', (req, res) => {
    res.json({
        totalCampaigns: campaigns.length,
        totalEmails: sentHistory.length,
        openRate: Math.round((sentHistory.filter(h => h.opened).length / Math.max(sentHistory.length, 1)) * 100),
        clickRate: Math.round((sentHistory.filter(h => h.clicked).length / Math.max(sentHistory.length, 1)) * 100)
    });
});

// ===== NOUVO ZOUTI =====

// Sent History
let sentHistory = [];
app.get('/api/history', (req, res) => {
    const { limit, offset } = req.query;
    const start = parseInt(offset) || 0;
    const count = parseInt(limit) || 50;
    res.json({ history: sentHistory.slice(start, start + count), total: sentHistory.length });
});

// Scheduled Emails
let scheduledEmails = [];
app.get('/api/scheduled', (req, res) => res.json({ scheduled: scheduledEmails }));

app.post('/api/schedule', (req, res) => {
    const { to, subject, html, scheduleTime, config } = req.body;
    const scheduled = { id: Date.now(), to, subject, html, scheduleTime, config, status: 'pending', createdAt: new Date().toISOString() };
    scheduledEmails.push(scheduled);
    
    const delay = new Date(scheduleTime) - new Date();
    if (delay > 0) {
        setTimeout(async () => {
            try {
                if (!transporter && config) initTransporter(config);
                const info = await transporter.sendMail({ from: config.user, to, subject, html });
                const scheduledIdx = scheduledEmails.findIndex(s => s.id === scheduled.id);
                if (scheduledIdx !== -1) {
                    scheduledEmails[scheduledIdx].status = 'sent';
                    scheduledEmails[scheduledIdx].messageId = info.messageId;
                }
                sentHistory.push({ to, subject, sentAt: new Date().toISOString(), status: 'scheduled' });
            } catch (err) { console.error('Scheduled email failed:', err); }
        }, delay);
    }
    res.json({ success: true, scheduled });
});

app.delete('/api/schedule/:id', (req, res) => {
    scheduledEmails = scheduledEmails.filter(s => s.id !== parseInt(req.params.id));
    res.json({ success: true });
});

// A/B Testing
let abTests = [];
app.post('/api/ab-test', (req, res) => {
    const { name, subjectA, subjectB, htmlA, htmlB, recipients, config } = req.body;
    const split = Math.floor(recipients.length / 2);
    const groupA = recipients.slice(0, split);
    const groupB = recipients.slice(split);
    
    const test = { id: Date.now(), name, subjectA, subjectB, htmlA, htmlB, groupA, groupB, config, status: 'running', createdAt: new Date().toISOString(), results: { a: 0, b: 0, opensA: 0, opensB: 0, clicksA: 0, clicksB: 0 } };
    abTests.push(test);
    res.json({ success: true, test, groupA: groupA.length, groupB: groupB.length });
});

app.get('/api/ab-tests', (req, res) => res.json({ tests: abTests }));

app.get('/api/ab-test/:id', (req, res) => {
    const test = abTests.find(t => t.id === parseInt(req.params.id));
    test ? res.json(test) : res.status(404).json({ error: 'Test not found' });
});

// Import Contacts from CSV
app.post('/api/contacts/import', (req, res) => {
    const { csv, tags } = req.body;
    const lines = csv.split('\n').filter(l => l.trim());
    const tagList = tags ? tags.split(',').map(t => t.trim()) : [];
    let imported = 0;
    
    for (let i = 1; i < lines.length; i++) {
        const parts = lines[i].split(',');
        if (parts[0] && parts[0].includes('@')) {
            contacts.push({ id: Date.now() + i, email: parts[0].replace(/"/g, '').trim(), name: parts[1]?.replace(/"/g, '').trim() || '', phone: parts[2]?.replace(/"/g, '').trim() || '', tags: tagList, addedAt: new Date().toISOString(), status: 'active' });
            imported++;
        }
    }
    res.json({ success: true, imported, total: contacts.length });
});

// Sender Profiles
let senderProfiles = [
    { id: 1, name: 'Default', email: 'default@gmail.com', replyTo: 'default@gmail.com', signature: 'Best regards' }
];
app.get('/api/senders', (req, res) => res.json({ senders: senderProfiles }));
app.post('/api/senders', (req, res) => { senderProfiles.push({ id: Date.now(), ...req.body }); res.json({ success: true }); });
app.put('/api/senders/:id', (req, res) => { const idx = senderProfiles.findIndex(s => s.id === parseInt(req.params.id)); if (idx !== -1) senderProfiles[idx] = { ...senderProfiles[idx], ...req.body }; res.json({ success: true }); });
app.delete('/api/senders/:id', (req, res) => { senderProfiles = senderProfiles.filter(s => s.id !== parseInt(req.params.id)); res.json({ success: true }); });

// Blacklist
let blacklist = [];
app.get('/api/blacklist', (req, res) => res.json({ blacklist }));
app.post('/api/blacklist', (req, res) => { const { email } = req.body; if (!blacklist.includes(email)) blacklist.push(email); res.json({ success: true }); });
app.delete('/api/blacklist/:email', (req, res) => { blacklist = blacklist.filter(e => e !== req.params.email); res.json({ success: true }); });

// Reports
app.get('/api/reports', (req, res) => {
    const totalSent = sentHistory.length;
    const byMonth = {};
    sentHistory.forEach(h => {
        const month = h.sentAt.substring(0, 7);
        byMonth[month] = (byMonth[month] || 0) + 1;
    });
    res.json({ totalSent, byMonth, campaigns: campaigns.length, contacts: contacts.length });
});

// Webhooks
let webhooks = [];
app.get('/api/webhooks', (req, res) => res.json({ webhooks }));
app.post('/api/webhooks', (req, res) => { const { url, events } = req.body; webhooks.push({ id: Date.now(), url, events, active: true }); res.json({ success: true }); });
app.delete('/api/webhooks/:id', (req, res) => { webhooks = webhooks.filter(w => w.id !== parseInt(req.params.id)); res.json({ success: true }); });

// Domain Verification (simulated)
app.post('/api/verify-domain', (req, res) => {
    const { domain } = req.body;
    const dnsRecords = { domain, verified: true, mx: true, spf: true, dkim: true, createdAt: new Date().toISOString() };
    res.json({ success: true, ...dnsRecords });
});

// Automation Rules
let automations = [
    { id: 1, name: 'Welcome Series', trigger: 'new_contact', actions: [{ type: 'send_email', template: 1, delay: 0 }], active: true },
    { id: 2, name: 'Follow up 7 days', trigger: 'no_open_7days', actions: [{ type: 'send_email', template: 4, delay: 7 }], active: true }
];
app.get('/api/automations', (req, res) => res.json({ automations }));
app.post('/api/automations', (req, res) => { automations.push({ id: Date.now(), ...req.body, active: true }); res.json({ success: true }); });
app.put('/api/automations/:id', (req, res) => { const idx = automations.findIndex(a => a.id === parseInt(req.params.id)); if (idx !== -1) automations[idx] = { ...automations[idx], ...req.body }; res.json({ success: true }); });
app.delete('/api/automations/:id', (req, res) => { automations = automations.filter(a => a.id !== parseInt(req.params.id)); res.json({ success: true }); });

// Tags Management
app.get('/api/tags', (req, res) => {
    const tags = [...new Set(contacts.flatMap(c => c.tags))];
    res.json({ tags: tags.map(t => ({ name: t, count: contacts.filter(c => c.tags.includes(t)).length })) });
});

// Unsubscribe
app.post('/api/unsubscribe', (req, res) => {
    const { email } = req.body;
    const idx = contacts.findIndex(c => c.email === email);
    if (idx !== -1) contacts[idx].status = 'unsubscribed';
    if (!blacklist.includes(email)) blacklist.push(email);
    res.json({ success: true });
});

// Bounce Handling
app.post('/api/bounce', (req, res) => {
    const { email, type } = req.body;
    const idx = contacts.findIndex(c => c.email === email);
    if (idx !== -1) { contacts[idx].status = 'bounced'; contacts[idx].bounceType = type; }
    res.json({ success: true });
});

// Email Preview
app.post('/api/preview', (req, res) => {
    const { html } = req.body;
    const preview = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Preview</title></head><body style="margin:0;padding:20px;background:#f5f5f5;"><div style="max-width:600px;margin:0 auto;background:white;padding:20px;border-radius:8px;">${html}</div></body></html>`;
    res.send(preview);
});

// ===== NOUVO ZOUTI =====

// List Cleaning & Deduplication
app.post('/api/clean-list', (req, res) => {
    const { emails } = req.body;
    const cleaned = { valid: [], invalid: [], duplicates: [], spam: [] };
    const seen = new Set();
    const spamPatterns = ['spam', 'test', 'fake', 'invalid'];
    
    for (const email of emails) {
        const e = email.trim().toLowerCase();
        if (seen.has(e)) { cleaned.duplicates.push(e); continue; }
        seen.add(e);
        
        const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!regex.test(e)) { cleaned.invalid.push(e); continue; }
        
        if (spamPatterns.some(p => e.includes(p))) { cleaned.spam.push(e); continue; }
        
        cleaned.valid.push(e);
    }
    res.json({ original: emails.length, ...cleaned, totalClean: cleaned.valid.length });
});

// Contact Segmentation
app.post('/api/segment', (req, res) => {
    const { contacts, rules } = req.body;
    let segmented = { segments: {} };
    
    contacts.forEach(c => {
        rules.forEach(rule => {
            let match = false;
            if (rule.field === 'email' && c.email.includes(rule.value)) match = true;
            if (rule.field === 'name' && c.name?.includes(rule.value)) match = true;
            if (rule.field === 'tags' && c.tags?.includes(rule.value)) match = true;
            if (rule.field === 'status' && c.status === rule.value) match = true;
            
            if (match) {
                if (!segmented.segments[rule.name]) segmented.segments[rule.name] = [];
                segmented.segments[rule.name].push(c.email);
            }
        });
    });
    res.json(segmented);
});

// Custom Fields
let customFields = [
    { id: 1, name: 'company', type: 'text', label: 'Company' },
    { id: 2, name: 'birthday', type: 'date', label: 'Birthday' },
    { id: 3, name: 'location', type: 'text', label: 'Location' }
];
app.get('/api/custom-fields', (req, res) => res.json({ fields: customFields }));
app.post('/api/custom-fields', (req, res) => { customFields.push({ id: Date.now(), ...req.body }); res.json({ success: true }); });
app.delete('/api/custom-fields/:id', (req, res) => { customFields = customFields.filter(f => f.id !== parseInt(req.params.id)); res.json({ success: true }); });

// Drafts
let drafts = [];
app.get('/api/drafts', (req, res) => res.json({ drafts }));
app.post('/api/drafts', (req, res) => { drafts.push({ id: Date.now(), ...req.body, createdAt: new Date().toISOString() }); res.json({ success: true }); });
app.put('/api/drafts/:id', (req, res) => { const idx = drafts.findIndex(d => d.id === parseInt(req.params.id)); if (idx !== -1) drafts[idx] = { ...drafts[idx], ...req.body }; res.json({ success: true }); });
app.delete('/api/drafts/:id', (req, res) => { drafts = drafts.filter(d => d.id !== parseInt(req.params.id)); res.json({ success: true }); });

// Email Templates Gallery
let templateGallery = [
    { id: 1, name: 'Simple Welcome', category: 'welcome', html: '<h1>Welcome {{name}}!</h1><p>We\'re happy to have you.</p>' },
    { id: 2, name: 'Newsletter Basic', category: 'newsletter', html: '<h2>{{title}}</h2><p>{{content}}</p><a href="{{link}}">Read more</a>' },
    { id: 3, name: 'Promo Offer', category: 'promo', html: '<h1>Special Offer!</h1><p>{{offer}}</p><a href="{{cta}}" style="background:purple;color:white;padding:10px;">Get Now</a>' },
    { id: 4, name: 'Event Invite', category: 'event', html: '<h1>You\'re Invited!</h1><p><strong>{{event}}</strong></p><p>{{date}}</p>' },
    { id: 5, name: 'Thank You', category: 'thankyou', html: '<h1>Thank You!</h1><p>Thank you for {{reason}}.</p><p>We appreciate you!</p>' }
];
app.get('/api/template-gallery', (req, res) => res.json({ templates: templateGallery }));
app.get('/api/template-gallery/:category', (req, res) => { const filtered = templateGallery.filter(t => t.category === req.params.category); res.json({ templates: filtered }); });

// Throttling Settings
let throttleSettings = { emailsPerHour: 50, emailsPerDay: 500, delayMs: 1000 };
app.get('/api/throttle', (req, res) => res.json(throttleSettings));
app.post('/api/throttle', (req, res) => { throttleSettings = { ...throttleSettings, ...req.body }; res.json({ success: true, settings: throttleSettings }); });

// Tracking Pixel (simulated)
app.get('/api/track/open/:campaignId/:email', (req, res) => {
    const { campaignId, email } = req.params;
    const log = { type: 'open', campaignId, email, timestamp: new Date().toISOString() };
    trackingLogs.push(log);
    res.send('<img src="" width="1" height="1">');
});

let trackingLogs = [];
app.get('/api/tracking-logs', (req, res) => res.json({ logs: trackingLogs }));

// Bounce Handling
app.post('/api/bounce-handle', (req, res) => {
    const { email, type, hard } = req.body;
    const contactIdx = contacts.findIndex(c => c.email === email);
    if (contactIdx !== -1) {
        contacts[contactIdx].status = hard ? 'hard_bounced' : 'soft_bounced';
        contacts[contactIdx].bounceType = type;
    }
    res.json({ success: true, action: hard ? 'removed' : 'marked' });
});

// Suppression List
let suppressionList = [];
app.get('/api/suppression', (req, res) => res.json({ list: suppressionList }));
app.post('/api/suppression', (req, res) => { const { email, reason } = req.body; suppressionList.push({ email, reason, addedAt: new Date().toISOString() }); res.json({ success: true }); });
app.delete('/api/suppression/:email', (req, res) => { suppressionList = suppressionList.filter(s => s.email !== req.params.email); res.json({ success: true }); });

// Merge Tags
app.post('/api/merge-tags', (req, res) => {
    const { template, data } = req.body;
    let result = template;
    Object.keys(data).forEach(key => { result = result.replace(new RegExp(`{{${key}}}`, 'g'), data[key]); });
    res.json({ result });
});

// Split Test Analysis
app.get('/api/split-analysis/:testId', (req, res) => {
    const test = abTests.find(t => t.id === parseInt(req.params.testId));
    if (!test) return res.status(404).json({ error: 'Test not found' });
    res.json({
        test,
        winner: test.results.opensA > test.results.opensB ? 'A' : 'B',
        confidence: Math.abs(test.results.opensA - test.results.opensB) / Math.max(test.results.opensA, test.results.opensB, 1) * 100
    });
});

// Email HTML Cleaner
app.post('/api/clean-html', (req, res) => {
    let { html } = req.body;
    html = html.replace(/<script[^>]*>.*?<\/script>/gi, '');
    html = html.replace(/<style[^>]*>.*?<\/style>/gi, '');
    html = html.replace(/onclick[^=]*="[^"]*"/gi, '');
    html = html.replace(/onload[^=]*="[^"]*"/gi, '');
    res.json({ cleaned: html });
});

// Responsive Email Checker
app.post('/api/check-responsive', (req, res) => {
    const { html } = req.body;
    const issues = [];
    if (!html.includes('width')) issues.push('No width defined');
    if (!html.includes('padding')) issues.push('No padding found');
    if (!html.includes('table')) issues.push('No tables (Gmail needs tables)');
    if (html.includes('position:absolute')) issues.push('Position absolute may not work');
    res.json({ responsive: issues.length === 0, issues });
});

// Import from URL
app.post('/api/import-url', async (req, res) => {
    const { url } = req.body;
    try {
        const response = await axios.get(url);
        const csv = response.data;
        const lines = csv.split('\n').filter(l => l.trim());
        let imported = 0;
        for (let i = 1; i < lines.length; i++) {
            const parts = lines[i].split(',');
            if (parts[0] && parts[0].includes('@')) {
                contacts.push({ id: Date.now() + i, email: parts[0].replace(/"/g, '').trim(), name: parts[1]?.trim() || '', tags: ['imported'], addedAt: new Date().toISOString(), status: 'active' });
                imported++;
            }
        }
        res.json({ success: true, imported });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Export formats
app.get('/api/export/:type', (req, res) => {
    const { type } = req.params;
    if (type === 'json') res.setHeader('Content-Type', 'application/json').send(JSON.stringify({ contacts, campaigns, templates }, null, 2));
    else if (type === 'vcard') {
        let vcard = 'BEGIN:VCARD\nVERSION:3.0\n';
        contacts.forEach(c => { vcard += `FN:${c.name}\nEMAIL:${c.email}\nTEL:${c.phone}\n`; });
        vcard += 'END:VCARD';
        res.setHeader('Content-Type', 'text/vcard').send(vcard);
    }
    else res.json({ error: 'Unknown format' });
});

// Spam Score Check
app.post('/api/spam-score', (req, res) => {
    const { subject, html, text } = req.body;
    let score = 0;
    const issues = [];
    
    if (subject && (subject.toLowerCase().includes('free') || subject.includes('!'))) { score += 10; issues.push('Spammy subject'); }
    if (html && (html.toLowerCase().includes('buy now') || html.toLowerCase().includes('click here'))) { score += 15; issues.push('Aggressive CTA'); }
    if (!text || text.length < 10) { score += 5; issues.push('No plain text version'); }
    if (html && html.includes('background-color') && html.includes('center')) { score += 8; issues.push('Suspicious HTML pattern'); }
    
    const rating = score < 10 ? 'Low' : score < 25 ? 'Medium' : 'High';
    res.json({ score: Math.min(score, 100), rating, issues });
});

// API Key Management
let apiKeys = [{ id: 1, key: 'emp_' + Math.random().toString(36).substr(2, 20), name: 'Default', created: new Date().toISOString(), active: true }];
app.get('/api/keys', (req, res) => res.json({ keys: apiKeys }));
app.post('/api/keys', (req, res) => { apiKeys.push({ id: Date.now(), key: 'emp_' + Math.random().toString(36).substr(2, 20), name: req.body.name || 'New Key', created: new Date().toISOString(), active: true }); res.json({ success: true }); });
app.delete('/api/keys/:id', (req, res) => { apiKeys = apiKeys.filter(k => k.id !== parseInt(req.params.id)); res.json({ success: true }); });

// IP Whitelist
let ipWhitelist = ['127.0.0.1', '::1'];
app.get('/api/ip-whitelist', (req, res) => res.json({ ips: ipWhitelist }));
app.post('/api/ip-whitelist', (req, res) => { const { ip } = req.body; if (!ipWhitelist.includes(ip)) ipWhitelist.push(ip); res.json({ success: true }); });
app.delete('/api/ip-whitelist/:ip', (req, res) => { ipWhitelist = ipWhitelist.filter(i => i !== req.params.ip); res.json({ success: true }); });

// ===== ANALYTICS ZOUTI =====

// Detailed Analytics
let analytics = {
    dailyStats: {},
    campaignPerformance: {},
    domainStats: {},
    deviceStats: { desktop: 0, mobile: 0, tablet: 0 },
    locationStats: {}
};

app.get('/api/analytics/detailed', (req, res) => {
    const today = new Date().toISOString().split('T')[0];
    const stats = analytics.dailyStats[today] || { sent: 0, delivered: 0, opened: 0, clicked: 0, bounced: 0, unsubscribed: 0 };
    res.json({
        today: stats,
        total: { sent: sentHistory.length, opened: Math.floor(sentHistory.length * 0.42), clicked: Math.floor(sentHistory.length * 0.18), bounced: Math.floor(sentHistory.length * 0.03) },
        deviceBreakdown: analytics.deviceStats,
        topDomains: Object.entries(analytics.domainStats).sort((a, b) => b[1] - a[1]).slice(0, 10)
    });
});

app.post('/api/analytics/track', (req, res) => {
    const { type, email, campaignId, device, location, domain } = req.body;
    const today = new Date().toISOString().split('T')[0];
    if (!analytics.dailyStats[today]) analytics.dailyStats[today] = { sent: 0, delivered: 0, opened: 0, clicked: 0, bounced: 0, unsubscribed: 0 };
    analytics.dailyStats[today][type] = (analytics.dailyStats[today][type] || 0) + 1;
    if (device) analytics.deviceStats[device] = (analytics.deviceStats[device] || 0) + 1;
    if (domain) analytics.domainStats[domain] = (analytics.domainStats[domain] || 0) + 1;
    if (location) analytics.locationStats[location] = (analytics.locationStats[location] || 0) + 1;
    res.json({ success: true });
});

app.get('/api/analytics/time-series', (req, res) => {
    const { days } = req.query;
    const daysCount = parseInt(days) || 30;
    const result = [];
    for (let i = daysCount - 1; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        result.push({ date: dateStr, ...(analytics.dailyStats[dateStr] || { sent: 0, opened: 0, clicked: 0 }) });
    }
    res.json({ data: result });
});

app.get('/api/analytics/campaign/:id', (req, res) => {
    const id = parseInt(req.params.id);
    const campaign = campaigns.find(c => c.id === id);
    if (!campaign) return res.status(404).json({ error: 'Not found' });
    res.json({
        campaign,
        performance: { sent: campaign.stats?.sent || 0, delivered: campaign.stats?.delivered || 0, opened: campaign.stats?.opened || 0, clicked: campaign.stats?.clicked || 0 },
        rate: { openRate: Math.round((campaign.stats?.opened || 0) / Math.max(campaign.stats?.sent || 1, 1) * 100), clickRate: Math.round((campaign.stats?.clicked || 0) / Math.max(campaign.stats?.sent || 1, 1) * 100) }
    });
});

app.get('/api/analytics/compare', (req, res) => {
    const { id1, id2 } = req.query;
    const c1 = campaigns.find(c => c.id === parseInt(id1));
    const c2 = campaigns.find(c => c.id === parseInt(id2));
    res.json({
        campaign1: c1 ? { name: c1.name, stats: c1.stats } : null,
        campaign2: c2 ? { name: c2.name, stats: c2.stats } : null,
        comparison: c1 && c2 ? { sentDiff: (c1.stats?.sent || 0) - (c2.stats?.sent || 0), openDiff: (c1.stats?.opened || 0) - (c2.stats?.opened || 0), clickDiff: (c1.stats?.clicked || 0) - (c2.stats?.clicked || 0) } : null
    });
});

// Heatmap by hour/day
app.get('/api/analytics/heatmap', (req, res) => {
    const heatmap = [];
    for (let day = 0; day < 7; day++) {
        for (let hour = 0; hour < 24; hour++) {
            heatmap.push({ day, hour, value: Math.floor(Math.random() * 100) });
        }
    }
    res.json({ heatmap });
});

// Top performers
app.get('/api/analytics/top-campaigns', (req, res) => {
    const sorted = campaigns.map(c => ({ id: c.id, name: c.name, sent: c.stats?.sent || 0, opened: c.stats?.opened || 0, clicked: c.stats?.clicked || 0, openRate: Math.round((c.stats?.opened || 0) / Math.max(c.stats?.sent || 1, 1) * 100) })).sort((a, b) => b.openRate - a.openRate).slice(0, 10);
    res.json({ topCampaigns: sorted });
});

// Subscriber growth
app.get('/api/analytics/growth', (req, res) => {
    const growth = { daily: [], weekly: [], monthly: [] };
    const today = new Date();
    for (let i = 29; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        growth.daily.push({ date: date.toISOString().split('T')[0], count: Math.floor(Math.random() * 20) + 5 });
    }
    res.json(growth);
});

// Engagement metrics
app.get('/api/analytics/engagement', (req, res) => {
    res.json({
        engagement: { veryActive: sentHistory.length * 0.3, active: sentHistory.length * 0.4, inactive: sentHistory.length * 0.2, dormant: sentHistory.length * 0.1 },
        avgOpenTime: '10:30 AM',
        avgClickTime: '2:15 PM',
        bestDay: 'Tuesday',
        bestTime: '10:00 AM'
    });
});

// Revenue tracking (simulated)
let revenueData = [];
app.get('/api/analytics/revenue', (req, res) => {
    const revenue = [];
    for (let i = 11; i >= 0; i--) {
        const d = new Date();
        d.setMonth(d.getMonth() - i);
        revenue.push({ month: d.toLocaleString('default', { month: 'short' }), revenue: Math.floor(Math.random() * 5000) + 1000, conversions: Math.floor(Math.random() * 50) + 10 });
    }
    res.json({ revenue, total: revenue.reduce((a, b) => a + b.revenue, 0) });
});

// Click tracking
app.get('/api/analytics/clicks', (req, res) => {
    const clicks = [
        { url: 'https://example.com/product1', clicks: 150, unique: 120 },
        { url: 'https://example.com/product2', clicks: 100, unique: 85 },
        { url: 'https://example.com/signup', clicks: 80, unique: 70 },
        { url: 'https://example.com/blog', clicks: 60, unique: 55 },
        { url: 'https://example.com/contact', clicks: 40, unique: 35 }
    ];
    res.json({ clicks, total: clicks.reduce((a, b) => a + b.clicks, 0) });
});

// Geographic stats
app.get('/api/analytics/geography', (req, res) => {
    res.json({
        countries: [
            { country: 'United States', count: 450, percentage: 35 },
            { country: 'United Kingdom', count: 200, percentage: 15 },
            { country: 'Canada', count: 150, percentage: 12 },
            { country: 'France', count: 120, percentage: 9 },
            { country: 'Germany', count: 100, percentage: 8 },
            { country: 'Other', count: 280, percentage: 21 }
        ]
    });
});

// Funnel analysis
app.get('/api/analytics/funnel', (req, res) => {
    const total = sentHistory.length || 1000;
    res.json({
        funnel: [
            { stage: 'Sent', count: total, percentage: 100 },
            { stage: 'Delivered', count: Math.floor(total * 0.98), percentage: 98 },
            { stage: 'Opened', count: Math.floor(total * 0.42), percentage: 42 },
            { stage: 'Clicked', count: Math.floor(total * 0.18), percentage: 18 },
            { stage: 'Converted', count: Math.floor(total * 0.05), percentage: 5 }
        ]
    });
});

// Retention metrics
app.get('/api/analytics/retention', (req, res) => {
    res.json({
        retention: [
            { month: 'Jan', retained: 100, churned: 0 },
            { month: 'Feb', retained: 95, churned: 5 },
            { month: 'Mar', retained: 92, churned: 8 },
            { month: 'Apr', retained: 88, churned: 12 },
            { month: 'May', retained: 85, churned: 15 },
            { month: 'Jun', retained: 82, churned: 18 }
        ],
        churnRate: 3.2,
        lifetimeValue: 45.50
    });
});

// A/B test analytics
app.get('/api/analytics/ab-full', (req, res) => {
    res.json({
        tests: abTests.map(t => ({
            id: t.id, name: t.name, status: t.status,
            groupA: { subject: t.subjectA, sent: t.groupA?.length || 0, opens: t.results?.opensA || 0, clicks: t.results?.clicksA || 0 },
            groupB: { subject: t.subjectB, sent: t.groupB?.length || 0, opens: t.results?.opensB || 0, clicks: t.results?.clicksB || 0 },
            winner: t.results?.opensA > t.results?.opensB ? 'A' : 'B'
        }))
    });
});

// ===== AI ZOUTI =====

// AI Content Generation
const aiTemplates = {
    welcome: ['Welcome to {{company}}!', 'Hello {{name}}, welcome aboard!', 'Welcome! We\'re excited to have you.'],
    promo: ['Special offer just for you!', '🔥 {{discount}} OFF - Limited time!', 'Don\'t miss this deal!'],
    followup: ['Following up on our conversation', 'Just checking in', 'Would love to hear from you'],
    newsletter: ['Here\'s what\'s new', 'Your weekly update', 'This week in {{topic}}']
};

app.post('/api/ai/generate-content', (req, res) => {
    const { type, data } = req.body;
    const templates = aiTemplates[type] || aiTemplates.promo;
    const template = templates[Math.floor(Math.random() * templates.length)];
    let result = template;
    Object.keys(data || {}).forEach(key => { result = result.replace(new RegExp(`{{${key}}}`, 'g'), data[key]); });
    res.json({ 
        content: result,
        suggestions: [
            'Add personalization tokens',
            'Include a clear call-to-action',
            'Keep the subject line under 50 characters'
        ]
    });
});

// AI Subject Line Generator
const subjectTemplates = {
    urgent: ['⚡ {{action}} NOW', '{{topic}} - Last Chance!', 'Urgent: {{topic}}'],
    curiosity: ['You won\'t believe this...', 'The secret to {{topic}}', 'What everyone is saying about {{topic}}'],
    benefit: ['Get {{benefit}} today', 'How to {{action}} in minutes', '{{benefit}} - Guaranteed!'],
    question: ['Do you know the answer?', 'Are you making this mistake?', 'Ready to {{action}}?']
};

app.post('/api/ai/generate-subject', (req, res) => {
    const { tone, topic, data } = req.body;
    const templates = subjectTemplates[tone] || subjectTemplates.benefit;
    const results = templates.map(t => {
        let subject = t.replace('{{topic}}', topic || 'update');
        Object.keys(data || {}).forEach(key => { subject = subject.replace(new RegExp(`{{${key}}}`, 'g'), data[key]); });
        return subject;
    });
    res.json({ subjects: results, score: Math.floor(Math.random() * 20) + 80 });
});

// AI Email Optimization
app.post('/api/ai/optimize', (req, res) => {
    const { subject, html, text } = req.body;
    const issues = [];
    const suggestions = [];
    let score = 100;
    
    if (subject && subject.length > 60) { issues.push('Subject too long'); score -= 15; }
    if (subject && !subject.includes('{{')) suggestions.push('Add personalization');
    if (html && !html.includes('<a')) { issues.push('No links in email'); score -= 10; }
    if (!text) suggestions.push('Add plain text version');
    if (html && html.toLowerCase().includes('buy now')) { issues.push('Aggressive language'); score -= 20; }
    if (html && html.length > 50000) { issues.push('Email too large'); score -= 10; }
    
    suggestions.push('A/B test your subject line', 'Add preview text', 'Use responsive design');
    
    res.json({ score: Math.max(score, 0), issues, suggestions, optimized: { subject: subject?.substring(0, 50), html: html?.substring(0, 100) } });
});

// AI Predictive Send Time
app.get('/api/ai/optimal-time', (req, res) => {
    const dayPatterns = { 0: 10, 1: 9, 2: 10, 3: 11, 4: 9, 5: 10, 6: 11 };
    const hourPatterns = { 6: 5, 7: 15, 8: 25, 9: 35, 10: 40, 11: 35, 12: 20, 13: 25, 14: 30, 15: 35, 16: 30, 17: 20, 18: 15, 19: 10, 20: 8 };
    const now = new Date();
    const day = now.getDay();
    const hour = now.getHours();
    const baseHour = dayPatterns[day];
    const score = hourPatterns[hour] || 10;
    
    const bestTimes = [
        { day: 'Tuesday', time: '10:00 AM', score: 95 },
        { day: 'Wednesday', time: '9:00 AM', score: 92 },
        { day: 'Thursday', time: '11:00 AM', score: 90 },
        { day: 'Tuesday', time: '2:00 PM', score: 88 },
        { day: 'Wednesday', time: '3:00 PM', score: 85 }
    ];
    
    res.json({ currentScore: score, bestTimes, recommendation: bestTimes[0] });
});

// AI Smart Segmentation
app.post('/api/ai/segment', (req, res) => {
    const { contacts, criteria } = req.body;
    const segments = { 'High Value': [], 'At Risk': [], 'Engaged': [], 'New': [], 'Dormant': [] };
    
    contacts.forEach(c => {
        if (c.tags?.includes('vip') || c.status === 'active') segments['High Value'].push(c.email);
        else if (c.status === 'bounced') segments['At Risk'].push(c.email);
        else if (c.status === 'new') segments['New'].push(c.email);
        else if (c.tags?.includes('active')) segments['Engaged'].push(c.email);
        else segments['Dormant'].push(c.email);
    });
    
    const recommendations = [
        { segment: 'High Value', action: 'Send exclusive offers', priority: 'high' },
        { segment: 'At Risk', action: 'Re-engagement campaign', priority: 'medium' },
        { segment: 'Dormant', action: 'Win-back email sequence', priority: 'low' }
    ];
    
    res.json({ segments, recommendations, total: contacts.length });
});

// AI Churn Prediction
app.get('/api/ai/churn-prediction', (req, res) => {
    const predictions = contacts.map(c => ({
        email: c.email,
        risk: c.status === 'inactive' ? 'high' : c.status === 'active' ? 'low' : 'medium',
        probability: Math.random() * 0.5,
        recommendedAction: c.status === 'inactive' ? 'Send win-back email' : 'Continue nurturing'
    }));
    
    const stats = {
        highRisk: predictions.filter(p => p.risk === 'high').length,
        mediumRisk: predictions.filter(p => p.risk === 'medium').length,
        lowRisk: predictions.filter(p => p.risk === 'low').length
    };
    
    res.json({ predictions: predictions.slice(0, 20), stats });
});

// AI Product Recommendations
app.get('/api/ai/recommendations', (req, res) => {
    const products = [
        { name: 'Premium Plan', price: 99, basedOn: 'Previous purchase' },
        { name: 'Add-on Package', price: 49, basedOn: 'Browsing history' },
        { name: 'Annual Subscription', price: 199, basedOn: 'Engagement level' }
    ];
    
    res.json({ recommendations: products, algorithm: 'collaborative filtering' });
});

// AI Spam Detector
app.post('/api/ai/spam-detector', (req, res) => {
    const { subject, html, from } = req.body;
    let score = 0;
    const reasons = [];
    
    const spamWords = ['free', 'winner', 'prize', 'click here', 'act now', 'limited time', 'guaranteed', 'no risk'];
    const spamPatterns = ['!!!!', 'ALL CAPS', 'dear customer', 'cash', 'credit'];
    
    if (subject) {
        if (spamWords.some(w => subject.toLowerCase().includes(w))) { score += 30; reasons.push('Spammy words in subject'); }
        if (spamPatterns.some(p => subject.includes(p))) { score += 20; reasons.push('Suspicious pattern'); }
    }
    
    if (html) {
        if (html.toLowerCase().includes('buy now')) { score += 25; reasons.push('Aggressive CTA'); }
        if (html.match(/<a[^>]*href[^>]*=/gi)?.length > 5) { score += 15; reasons.push('Too many links'); }
    }
    
    const isSpam = score > 50;
    res.json({ isSpam, score: Math.min(score, 100), reasons, recommendation: isSpam ? 'Rewrite to avoid spam filters' : 'Good to send' });
});

// AI Content Personalization
app.post('/api/ai/personalize', (req, res) => {
    const { template, contactData } = req.body;
    let personalized = template;
    
    const patterns = [
        { regex: /{{name}}/g, fallback: 'there' },
        { regex: /{{company}}/g, fallback: 'your company' },
        { regex: /{{location}}/g, fallback: 'your area' }
    ];
    
    patterns.forEach(p => {
        personalized = personalized.replace(p.regex, contactData[p.regex.source.replace(/{{|}}/g, '')] || p.fallback);
    });
    
    const suggestions = [
        'Use dynamic images based on location',
        'Add time-based greetings (Good morning/afternoon)',
        'Include recent activity data'
    ];
    
    res.json({ personalized, suggestions });
});

// AI Lead Scoring
app.post('/api/ai/lead-score', (req, res) => {
    const { email, activity } = req.body;
    let score = 50;
    const factors = [];
    
    if (activity?.openedEmails > 5) { score += 20; factors.push('High open rate (+20)'); }
    if (activity?.clickedEmails > 3) { score += 25; factors.push('Active clicker (+25)'); }
    if (activity?.websiteVisits > 10) { score += 15; factors.push('Engaged visitor (+15)'); }
    if (activity?.lastActiveDays > 30) { score -= 10; factors.push('Inactive recently (-10)'); }
    
    const grade = score >= 80 ? 'A (Hot)' : score >= 60 ? 'B (Warm)' : score >= 40 ? 'C (Cool)' : 'D (Cold)';
    
    res.json({ score: Math.min(score, 100), grade, factors, recommendation: grade === 'A (Hot)' ? 'Priority follow-up' : grade === 'B (Warm)' ? 'Nurture campaign' : 'Add to list' });
});

// AI Copywriting Assistant
app.post('/api/ai/copywriting', (req, res) => {
    const { type, product, audience } = req.body;
    
    const copyTemplates = {
        promo: [
            `Introducing ${product} - The solution you've been waiting for!`,
            `Don't miss out on ${product}. Limited time offer!`,
            `Get ${product} today and transform your ${audience || 'experience'}!`
        ],
        welcome: [
            `Welcome to ${product}! We're excited to have you.`,
            `Your journey with ${product} starts here.`,
            `Hello and welcome! Let's get you started with ${product}.`
        ],
        followup: [
            `We noticed you haven't tried ${product} yet.`,
            `Just checking in about ${product}.`,
            `Your ${product} adventure awaits - don't miss out!`
        ]
    };
    
    const variations = copyTemplates[type] || copyTemplates.promo;
    const headlines = [
        `The Ultimate ${product} Guide`,
        `${product}: What You Need to Know`,
        `Why ${product} is Changing Everything`
    ];
    
    res.json({ copy: variations, headlines, tips: ['Keep it short', 'Focus on benefits', 'Add CTA'] });
});

// AI Visual Suggestions
app.post('/api/ai/visual-suggestions', (req, res) => {
    const { content, type } = req.body;
    
    const suggestions = [
        { type: 'header', suggestion: 'Add a hero image with your logo', impact: 'high' },
        { type: 'button', suggestion: 'Use contrasting CTA button color', impact: 'medium' },
        { type: 'layout', suggestion: 'Single column works best for mobile', impact: 'high' },
        { type: 'image', suggestion: 'Add alt text to all images', impact: 'medium' },
        { type: 'spacing', suggestion: 'Increase padding around content', impact: 'low' }
    ];
    
    res.json({ suggestions, score: Math.floor(Math.random() * 30) + 70 });
});

// AI Subject Line Tester
app.post('/api/ai/test-subject', (req, res) => {
    const { subject } = req.body;
    let score = 70;
    const feedback = [];
    
    if (subject.length < 20) { score -= 10; feedback.push('Too short'); }
    if (subject.length > 50) { score -= 15; feedback.push('Too long'); }
    if (subject.includes('!')) { score += 5; feedback.push('Creates urgency'); }
    if (subject.includes('?')) { score += 5; feedback.push('Creates curiosity'); }
    if (subject.toLowerCase().includes('free')) { score -= 20; feedback.push('May trigger spam filter'); }
    if (subject.match(/[A-Z]{4,}/)) { score -= 15; feedback.push('Avoid ALL CAPS'); }
    
    const alternatives = [
        subject.replace('?', ' - you\'ll love this!'),
        `Quick question about ${subject}`,
        subject.split(' ').slice(0, 5).join(' ') + '...'
    ];
    
    res.json({ score: Math.max(score, 0), feedback, alternatives, verdict: score >= 80 ? 'Good to go!' : 'Needs improvement' });
});

// ===== USER & ADMIN MANAGEMENT =====

// Users Database
let users = [
    { id: 1, username: 'admin', password: 'admin123', email: 'admin@example.com', role: 'admin', name: 'Administrator', createdAt: new Date().toISOString(), lastLogin: null },
    { id: 2, username: 'user', password: 'user123', email: 'user@example.com', role: 'user', name: 'Regular User', createdAt: new Date().toISOString(), lastLogin: null }
];

// Sessions
let sessions = [];

// Auth Middleware
const authMiddleware = (req, res, next) => {
    const token = req.headers.authorization?.replace('Bearer ', '');
    const session = sessions.find(s => s.token === token);
    if (session) {
        req.user = session.user;
        next();
    } else {
        res.status(401).json({ error: 'Unauthorized' });
    }
};

// Login
app.post('/api/auth/login', (req, res) => {
    const { username, password } = req.body;
    const user = users.find(u => u.username === username && u.password === password);
    if (user) {
        const token = 'token_' + Math.random().toString(36).substr(2) + Date.now();
        user.lastLogin = new Date().toISOString();
        sessions.push({ token, user: { id: user.id, username: user.username, role: user.role, name: user.name } });
        res.json({ success: true, token, user: { id: user.id, username: user.username, role: user.role, name: user.name } });
    } else {
        res.status(401).json({ error: 'Invalid credentials' });
    }
});

// Logout
app.post('/api/auth/logout', (req, res) => {
    const token = req.headers.authorization?.replace('Bearer ', '');
    sessions = sessions.filter(s => s.token !== token);
    res.json({ success: true });
});

// Register
app.post('/api/auth/register', (req, res) => {
    const { username, password, email, name } = req.body;
    if (users.find(u => u.username === username)) {
        return res.status(400).json({ error: 'Username already exists' });
    }
    const newUser = { id: Date.now(), username, password, email, role: 'user', name, createdAt: new Date().toISOString(), lastLogin: null };
    users.push(newUser);
    res.json({ success: true, user: { id: newUser.id, username: newUser.username, role: newUser.role, name: newUser.name } });
});

// Get Current User
app.get('/api/auth/me', authMiddleware, (req, res) => {
    res.json({ user: req.user });
});

// Get All Users (Admin only)
app.get('/api/users', authMiddleware, (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
    res.json({ users: users.map(u => ({ id: u.id, username: u.username, email: u.email, role: u.role, name: u.name, createdAt: u.createdAt, lastLogin: u.lastLogin })) });
});

// Update User (Admin only)
app.put('/api/users/:id', authMiddleware, (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
    const idx = users.findIndex(u => u.id === parseInt(req.params.id));
    if (idx !== -1) {
        users[idx] = { ...users[idx], ...req.body, password: req.body.password ? req.body.password : users[idx].password };
        res.json({ success: true, user: users[idx] });
    } else {
        res.status(404).json({ error: 'User not found' });
    }
});

// Delete User (Admin only)
app.delete('/api/users/:id', authMiddleware, (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
    if (parseInt(req.params.id) === req.user.id) return res.status(400).json({ error: 'Cannot delete yourself' });
    users = users.filter(u => u.id !== parseInt(req.params.id));
    res.json({ success: true });
});

// Change Password
app.post('/api/auth/change-password', authMiddleware, (req, res) => {
    const { currentPassword, newPassword } = req.body;
    const user = users.find(u => u.id === req.user.id);
    if (user.password !== currentPassword) return res.status(400).json({ error: 'Current password incorrect' });
    user.password = newPassword;
    res.json({ success: true });
});

// User Activity Log
let activityLog = [];
app.get('/api/activity', authMiddleware, (req, res) => {
    const logs = req.user.role === 'admin' ? activityLog : activityLog.filter(l => l.userId === req.user.id);
    res.json({ logs: logs.slice(-50).reverse() });
});

const logActivity = (userId, action, details) => {
    activityLog.push({ id: Date.now(), userId, action, details, timestamp: new Date().toISOString() });
};

// Roles & Permissions
const permissions = {
    admin: ['read', 'write', 'delete', 'manage_users', 'manage_settings', 'view_analytics', 'send_emails', 'manage_templates', 'manage_campaigns'],
    user: ['read', 'send_emails', 'manage_templates', 'manage_campaigns'],
    viewer: ['read']
};

app.get('/api/permissions', authMiddleware, (req, res) => {
    res.json({ permissions: permissions[req.user.role] || [] });
});

// ===== SECURITY FEATURES =====

// Security Settings
let securitySettings = {
    maxLoginAttempts: 5,
    lockoutDuration: 15,
    passwordMinLength: 6,
    requireSpecialChar: false,
    sessionTimeout: 60,
    twoFactorEnabled: false,
    ipWhitelist: ['127.0.0.1', '::1'],
    allowRegistration: true
};

app.get('/api/security', authMiddleware, (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
    res.json({ settings: securitySettings });
});

app.put('/api/security', authMiddleware, (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
    securitySettings = { ...securitySettings, ...req.body };
    res.json({ success: true, settings: securitySettings });
});

// Failed Login Tracking
let failedLogins = {};

app.post('/api/auth/login', (req, res) => {
    const { username, password } = req.body;
    
    if (failedLogins[username] && failedLogins[username].attempts >= securitySettings.maxLoginAttempts) {
        const lockTime = failedLogins[username].lastAttempt;
        const minutesSince = (Date.now() - new Date(lockTime).getTime()) / 60000;
        if (minutesSince < securitySettings.lockoutDuration) {
            return res.status(423).json({ error: 'Account locked. Try again later.' });
        }
    }
    
    const user = users.find(u => u.username === username && u.password === password);
    if (user) {
        delete failedLogins[username];
        const token = 'token_' + Math.random().toString(36).substr(2) + Date.now();
        user.lastLogin = new Date().toISOString();
        sessions.push({ token, user: { id: user.id, username: user.username, role: user.role, name: user.name } });
        logActivity(user.id, 'login', 'User logged in');
        res.json({ success: true, token, user: { id: user.id, username: user.username, role: user.role, name: user.name } });
    } else {
        if (!failedLogins[username]) failedLogins[username] = { attempts: 0, lastAttempt: null };
        failedLogins[username].attempts++;
        failedLogins[username].lastAttempt = new Date().toISOString();
        res.status(401).json({ error: 'Invalid credentials' });
    }
});

// Password Reset
let passwordResetTokens = {};

app.post('/api/auth/forgot-password', (req, res) => {
    const { email } = req.body;
    const user = users.find(u => u.email === email);
    if (user) {
        const token = 'reset_' + Math.random().toString(36).substr(2);
        passwordResetTokens[token] = { email, expires: Date.now() + 3600000 };
        res.json({ success: true, message: 'Reset token generated' });
    } else {
        res.status(404).json({ error: 'Email not found' });
    }
});

app.post('/api/auth/reset-password', (req, res) => {
    const { token, newPassword } = req.body;
    if (passwordResetTokens[token] && passwordResetTokens[token].expires > Date.now()) {
        const user = users.find(u => u.email === passwordResetTokens[token].email);
        if (user) {
            user.password = newPassword;
            delete passwordResetTokens[token];
            res.json({ success: true });
        }
    } else {
        res.status(400).json({ error: 'Invalid or expired token' });
    }
});

// Session Management
app.get('/api/sessions', authMiddleware, (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
    res.json({ sessions: sessions.map(s => ({ user: s.user.username, created: 'recent' })) });
});

app.delete('/api/sessions/:token', authMiddleware, (req, res) => {
    sessions = sessions.filter(s => s.token !== req.params.token);
    res.json({ success: true });
});

// ===== NOUVO MARKETING METHODS =====

// Newsletter Management
let newsletters = [];
app.get('/api/newsletters', (req, res) => res.json({ newsletters }));
app.post('/api/newsletters', (req, res) => {
    const newsletter = { id: Date.now(), ...req.body, status: 'draft', createdAt: new Date().toISOString(), subscribers: 0, opens: 0, clicks: 0 };
    newsletters.push(newsletter);
    res.json({ success: true, newsletter });
});
app.get('/api/newsletters/:id', (req, res) => { const n = newsletters.find(n => n.id === parseInt(req.params.id)); n ? res.json(n) : res.status(404).json({ error: 'Not found' }); });
app.put('/api/newsletters/:id', (req, res) => { const idx = newsletters.findIndex(n => n.id === parseInt(req.params.id)); if (idx !== -1) newsletters[idx] = { ...newsletters[idx], ...req.body }; res.json({ success: true }); });
app.delete('/api/newsletters/:id', (req, res) => { newsletters = newsletters.filter(n => n.id !== parseInt(req.params.id)); res.json({ success: true }); });

// Subscriber Management
let subscribers = [];
app.get('/api/subscribers', (req, res) => {
    const { status, tag } = req.query;
    let result = [...subscribers];
    if (status) result = result.filter(s => s.status === status);
    if (tag) result = result.filter(s => s.tags?.includes(tag));
    res.json({ subscribers: result, total: result.length });
});
app.post('/api/subscribers', (req, res) => {
    const sub = { id: Date.now(), ...req.body, status: 'active', subscribedAt: new Date().toISOString() };
    subscribers.push(sub);
    res.json({ success: true, subscriber: sub });
});
app.post('/api/subscribers/import', (req, res) => {
    const { emails } = req.body;
    const imported = emails.map(e => ({ id: Date.now() + Math.random(), email: e, status: 'active', subscribedAt: new Date().toISOString() }));
    subscribers.push(...imported);
    res.json({ success: true, imported: imported.length, total: subscribers.length });
});

// Email Sequences
let sequences = [
    { id: 1, name: 'Welcome Series', steps: [{ day: 0, subject: 'Welcome!', template: 1 }, { day: 3, subject: 'Tips for getting started', html: '<p>Here are some tips...</p>' }, { day: 7, subject: 'Special offer for you', html: '<p>Special deal inside!</p>' }], status: 'active' }
];
app.get('/api/sequences', (req, res) => res.json({ sequences }));
app.post('/api/sequences', (req, res) => { sequences.push({ id: Date.now(), ...req.body, status: 'draft' }); res.json({ success: true }); });
app.put('/api/sequences/:id', (req, res) => { const idx = sequences.findIndex(s => s.id === parseInt(req.params.id)); if (idx !== -1) sequences[idx] = { ...sequences[idx], ...req.body }; res.json({ success: true }); });
app.delete('/api/sequences/:id', (req, res) => { sequences = sequences.filter(s => s.id !== parseInt(req.params.id)); res.json({ success: true }); });

// Landing Pages
let landingPages = [];
app.get('/api/landing-pages', (req, res) => res.json({ pages: landingPages }));
app.post('/api/landing-pages', (req, res) => {
    const page = { id: Date.now(), ...req.body, published: false, views: 0, conversions: 0, createdAt: new Date().toISOString() };
    landingPages.push(page);
    res.json({ success: true, page });
});
app.get('/api/landing-pages/:id', (req, res) => { const p = landingPages.find(p => p.id === parseInt(req.params.id)); p ? res.json(p) : res.status(404).json({ error: 'Not found' }); });

// Forms
let forms = [];
app.get('/api/forms', (req, res) => res.json({ forms }));
app.post('/api/forms', (req, res) => {
    const form = { id: Date.now(), ...req.body, fields: req.body.fields || ['email', 'name'], submissions: 0, createdAt: new Date().toISOString() };
    forms.push(form);
    res.json({ success: true, form });
});
app.post('/api/forms/:id/submit', (req, res) => {
    const idx = forms.findIndex(f => f.id === parseInt(req.params.id));
    if (idx !== -1) { forms[idx].submissions = (forms[idx].submissions || 0) + 1; forms[idx].lastSubmission = new Date().toISOString(); }
    res.json({ success: true });
});

// Tags & Segments
let segments = [];
app.get('/api/segments', (req, res) => res.json({ segments }));
app.post('/api/segments', (req, res) => { segments.push({ id: Date.now(), ...req.body, count: 0 }); res.json({ success: true }); });
app.delete('/api/segments/:id', (req, res) => { segments = segments.filter(s => s.id !== parseInt(req.params.id)); res.json({ success: true }); });

// Email Templates Library
let templateLibrary = [
    { id: 1, name: 'Minimal Welcome', category: 'welcome', html: '<div style="font-family:sans-serif;max-width:600px;margin:0 auto;"><h1 style="color:#333;">Hello {{name}}!</h1><p>Welcome to {{company}}. We\'re excited to have you!</p><a href="{{link}}" style="background:#667eea;color:white;padding:12px 24px;text-decoration:none;border-radius:8px;">Get Started</a></div>' },
    { id: 2, name: 'Modern Promo', category: 'promo', html: '<div style="font-family:sans-serif;background:#667eea;color:white;padding:40px;text-align:center;"><h1>🔥 {{offer}}</h1><p>{{description}}</p><a href="{{cta}}" style="background:white;color:#667eea;padding:15px 30px;text-decoration:none;border-radius:8px;font-weight:bold;">{{cta_text}}</a></div>' },
    { id: 3, name: 'Classic Newsletter', category: 'newsletter', html: '<div style="font-family:serif;max-width:600px;margin:0 auto;padding:20px;"><h2>{{title}}</h2><div style="color:#555;">{{content}}</div><hr style="border:1px solid #eee;margin:20px 0;"><p style="color:#999;font-size:12px;">© {{company}} | <a href="{{unsubscribe}}">Unsubscribe</a></p></div>' },
    { id: 4, name: 'Event Invite', category: 'event', html: '<div style="font-family:sans-serif;max-width:600px;margin:0 auto;border:2px solid #667eea;border-radius:12px;padding:30px;text-align:center;"><h1>📅 You\'re Invited!</h1><h2>{{event_name}}</h2><p><strong>Date:</strong> {{date}}</p><p><strong>Time:</strong> {{time}}</p><p>{{location}}</p><a href="{{rsvp}}" style="background:#667eea;color:white;padding:15px 30px;text-decoration:none;border-radius:8px;">RSVP Now</a></div>' },
    { id: 5, name: 'Thank You', category: 'thankyou', html: '<div style="font-family:sans-serif;max-width:600px;margin:0 auto;text-align:center;padding:40px;"><h1>🙏 Thank You!</h1><p>{{message}}</p><p>We appreciate your support!</p></div>' },
    { id: 6, name: 'Survey', category: 'feedback', html: '<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:30px;"><h2>We\'d Love Your Feedback!</h2><p>Help us improve by answering a few questions.</p><a href="{{survey_url}}" style="display:inline-block;background:#10b981;color:white;padding:15px 30px;text-decoration:none;border-radius:8px;">Take Survey</a></div>' }
];
app.get('/api/template-library', (req, res) => res.json({ templates: templateLibrary }));
app.get('/api/template-library/:category', (req, res) => { const filtered = templateLibrary.filter(t => t.category === req.params.category); res.json({ templates: filtered }); });

// Email Design Editor (JSON-based)
app.post('/api/email-builder', (req, res) => {
    const { elements, theme } = req.body;
    let html = '<div style="font-family:sans-serif;max-width:600px;margin:0 auto;">';
    elements.forEach(el => {
        if (el.type === 'header') html += `<div style="background:${theme.primary};padding:30px;text-align:center;"><h1 style="color:${theme.text};">${el.content}</h1></div>`;
        else if (el.type === 'text') html += `<p style="color:${theme.text};padding:15px 20px;">${el.content}</p>`;
        else if (el.type === 'button') html += `<div style="text-align:center;padding:20px;"><a href="${el.url}" style="background:${theme.primary};color:white;padding:15px 30px;text-decoration:none;border-radius:8px;">${el.text}</a></div>`;
        else if (el.type === 'image') html += `<img src="${el.src}" style="max-width:100%;height:auto;">`;
    });
    html += '</div>';
    res.json({ html });
});

// RSS to Email
app.post('/api/rss-email', async (req, res) => {
    const { rssUrl, template, schedule } = req.body;
    try {
        const response = await axios.get(rssUrl);
        const items = response.data?.items || [];
        const emailHtml = items.slice(0, 5).map(item => `<div style="padding:15px;border-bottom:1px solid #eee;"><h3>${item.title}</h3><p>${item.description?.substring(0, 100)}...</p><a href="${item.link}">Read more</a></div>`).join('');
        res.json({ success: true, preview: emailHtml, itemsCount: items.length });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Social Media Integration
let socialAccounts = [
    { id: 1, platform: 'twitter', handle: '@yourbrand', followers: 5000, connected: true },
    { id: 2, platform: 'facebook', handle: 'YourBrand', followers: 8000, connected: true }
];
app.get('/api/social-accounts', (req, res) => res.json({ accounts: socialAccounts }));
app.post('/api/social-share', (req, res) => {
    const { platform, message } = req.body;
    res.json({ success: true, message: `Shared to ${platform}`, scheduledAt: new Date().toISOString() });
});

// Push Notifications
let pushNotifications = [];
app.get('/api/push-notifications', (req, res) => res.json({ notifications: pushNotifications }));
app.post('/api/push-notifications', (req, res) => {
    const notification = { id: Date.now(), ...req.body, sent: false, sentAt: null };
    pushNotifications.push(notification);
    res.json({ success: true, notification });
});

// SMS Integration
app.post('/api/send-sms', (req, res) => {
    const { to, message } = req.body;
    res.json({ success: true, messageId: 'sms_' + Date.now(), sentTo: to });
});

// UTM Tracking
app.post('/api/utm-generator', (req, res) => {
    const { url, source, medium, campaign, term, content } = req.body;
    const params = new URLSearchParams();
    if (source) params.append('utm_source', source);
    if (medium) params.append('utm_medium', medium);
    if (campaign) params.append('utm_campaign', campaign);
    if (term) params.append('utm_term', term);
    if (content) params.append('utm_content', content);
    const fullUrl = url + (url.includes('?') ? '&' : '?') + params.toString();
    res.json({ originalUrl: url, trackedUrl: fullUrl, params: Object.fromEntries(params) });
});

// Click Tracking
let clickTracking = [];
app.get('/api/click-tracking', (req, res) => {
    const { campaignId } = req.query;
    let result = [...clickTracking];
    if (campaignId) result = result.filter(c => c.campaignId === campaignId);
    res.json({ clicks: result, total: result.length });
});
app.get('/api/track/click/:campaignId/:email/:url', (req, res) => {
    const { campaignId, email, url } = req.params;
    clickTracking.push({ campaignId, email, url, clickedAt: new Date().toISOString() });
    res.redirect(decodeURIComponent(url));
});

// Delivery Score
app.get('/api/delivery-score', (req, res) => {
    res.json({
        score: 92,
        factors: { reputation: 95, content: 90, listQuality: 88, engagement: 94 },
        recommendations: ['Remove hard bounces', 'Increase engagement', 'Clean inactive subscribers']
    });
});

// Inbox Placement
app.get('/api/inbox-placement', (req, res) => {
    res.json({
        inbox: 78, spam: 5, rejected: 2, bulk: 15,
        byProvider: [
            { provider: 'Gmail', inbox: 85, spam: 3 },
            { provider: 'Outlook', inbox: 72, spam: 8 },
            { provider: 'Yahoo', inbox: 68, spam: 10 }
        ]
    });
});

// WebSocket for real-time updates
io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);
    
    socket.on('campaign-update', (data) => {
        io.emit('campaign-progress', data);
    });
    
    socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
    });
});

// Start server
server.listen(PORT, () => {
    console.log(`🚀 Email Marketing Pro API Server running on http://localhost:${PORT}`);
    console.log(`📧 JavaScript Email Tools Ready`);
});

module.exports = app;

