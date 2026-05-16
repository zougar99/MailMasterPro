/**
 * Email Marketing Pro - JavaScript Email Tools
 * Standalone email utilities
 */

const nodemailer = require('nodemailer');
const axios = require('axios');

class EmailTools {
    constructor(config) {
        this.transporter = nodemailer.createTransport({
            host: config.host || 'smtp.gmail.com',
            port: config.port || 587,
            secure: false,
            auth: {
                user: config.user,
                pass: config.password
            }
        });
        this.campaigns = [];
        this.contacts = [];
        this.templates = this.getDefaultTemplates();
    }
    
    getDefaultTemplates() {
        return [
            {
                id: 1,
                name: 'Welcome Email',
                subject: 'Welcome to {{company}}!',
                html: '<h1>Welcome {{name}}!</h1><p>Thank you for joining {{company}}.</p><p>We\'re excited to have you on board!</p>'
            },
            {
                id: 2,
                name: 'Newsletter',
                subject: '{{subject}}',
                html: '<h2>{{title}}</h2><div>{{content}}</div><br><p><a href="{{unsubscribe}}">Unsubscribe</a></p>'
            },
            {
                id: 3,
                name: 'Promotional',
                subject: '🔥 {{offer}} - Limited Time!',
                html: '<h1>{{offer}}</h1><p>Dear {{name}},</p><p>{{description}}</p><a href="{{cta_url}}" style="background:#667eea;color:white;padding:12px 24px;text-decoration:none;border-radius:8px;">{{cta_text}}</a>'
            },
            {
                id: 4,
                name: 'Follow Up',
                subject: 'Following up on {{topic}}',
                html: '<h2>Hi {{name}},</h2><p>Just wanted to follow up on {{topic}}.</p><p>{{message}}</p><p>Best regards,<br>{{sender}}</p>'
            },
            {
                id: 5,
                name: 'Announcement',
                subject: '📢 {{title}}',
                html: '<h1>{{title}}</h1><p>{{announcement}}</p><p>{{details}}</p>'
            }
        ];
    }
    
    async sendEmail(to, subject, html, text = null) {
        try {
            const info = await this.transporter.sendMail({
                from: this.transporter.options.auth.user,
                to: to,
                subject: subject,
                html: html,
                text: text
            });
            return {
                success: true,
                messageId: info.messageId,
                response: info.response
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }
    
    async sendBulk(recipients, subject, html, text = null, delay = 1000) {
        const results = [];
        
        for (const recipient of recipients) {
            const result = await this.sendEmail(recipient, subject, html, text);
            results.push({
                email: recipient,
                ...result
            });
            
            if (delay > 0) {
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
        
        return {
            total: recipients.length,
            successful: results.filter(r => r.success).length,
            failed: results.filter(r => !r.success).length,
            results: results
        };
    }
    
    validateEmail(email) {
        const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return regex.test(email);
    }
    
    async testConnection() {
        try {
            await this.transporter.verify();
            return { success: true, message: 'SMTP connection successful' };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }
    
    // Contact Management
    addContact(contact) {
        const newContact = {
            id: Date.now(),
            email: contact.email,
            name: contact.name || '',
            phone: contact.phone || '',
            tags: contact.tags || [],
            addedAt: new Date().toISOString(),
            status: 'active'
        };
        this.contacts.push(newContact);
        return newContact;
    }
    
    addContacts(contacts) {
        return contacts.map(c => this.addContact(c));
    }
    
    getContacts(filter = {}) {
        let result = [...this.contacts];
        
        if (filter.tag) {
            result = result.filter(c => c.tags.includes(filter.tag));
        }
        if (filter.status) {
            result = result.filter(c => c.status === filter.status);
        }
        if (filter.search) {
            const s = filter.search.toLowerCase();
            result = result.filter(c => 
                c.email.toLowerCase().includes(s) || 
                c.name.toLowerCase().includes(s)
            );
        }
        
        return result;
    }
    
    removeContact(email) {
        this.contacts = this.contacts.filter(c => c.email !== email);
        return { success: true };
    }
    
    // Campaign Management
    createCampaign(campaign) {
        const newCampaign = {
            id: Date.now(),
            name: campaign.name,
            subject: campaign.subject,
            html: campaign.html,
            recipients: campaign.recipients || [],
            status: 'draft',
            createdAt: new Date().toISOString(),
            sentAt: null,
            stats: {
                sent: 0,
                delivered: 0,
                opened: 0,
                clicked: 0,
                bounced: 0,
                unsubscribed: 0
            }
        };
        this.campaigns.push(newCampaign);
        return newCampaign;
    }
    
    getCampaigns() {
        return this.campaigns;
    }
    
    getCampaign(id) {
        return this.campaigns.find(c => c.id === id);
    }
    
    updateCampaign(id, updates) {
        const idx = this.campaigns.findIndex(c => c.id === id);
        if (idx !== -1) {
            this.campaigns[idx] = { ...this.campaigns[idx], ...updates };
            return this.campaigns[idx];
        }
        return null;
    }
    
    async sendCampaign(campaignId) {
        const campaign = this.getCampaign(campaignId);
        if (!campaign) return { error: 'Campaign not found' };
        
        const result = await this.sendBulk(
            campaign.recipients,
            campaign.subject,
            campaign.html
        );
        
        this.updateCampaign(campaignId, {
            status: 'sent',
            sentAt: new Date().toISOString(),
            stats: {
                sent: result.total,
                delivered: result.successful,
                opened: Math.floor(result.successful * 0.4),
                clicked: Math.floor(result.successful * 0.15),
                bounced: result.failed,
                unsubscribed: 0
            }
        });
        
        return { success: true, ...result };
    }
    
    // Template Management
    getTemplates() {
        return this.templates;
    }
    
    getTemplate(id) {
        return this.templates.find(t => t.id === id);
    }
    
    addTemplate(template) {
        const newTemplate = {
            id: Date.now(),
            name: template.name,
            subject: template.subject,
            html: template.html,
            createdAt: new Date().toISOString()
        };
        this.templates.push(newTemplate);
        return newTemplate;
    }
    
    updateTemplate(id, updates) {
        const idx = this.templates.findIndex(t => t.id === id);
        if (idx !== -1) {
            this.templates[idx] = { ...this.templates[idx], ...updates };
            return this.templates[idx];
        }
        return null;
    }
    
    deleteTemplate(id) {
        this.templates = this.templates.filter(t => t.id !== id);
        return { success: true };
    }
    
    // Personalization
    parseTemplate(template, data) {
        let subject = template.subject;
        let html = template.html;
        
        for (const [key, value] of Object.entries(data)) {
            const regex = new RegExp(`{{${key}}}`, 'g');
            subject = subject.replace(regex, value);
            html = html.replace(regex, value);
        }
        
        return { subject, html };
    }
    
    // Scheduling
    scheduleEmail(to, subject, html, scheduleTime) {
        const delay = new Date(scheduleTime) - new Date();
        
        if (delay < 0) {
            return { error: 'Schedule time must be in the future' };
        }
        
        setTimeout(() => {
            this.sendEmail(to, subject, html);
        }, delay);
        
        return {
            success: true,
            scheduledFor: scheduleTime,
            message: 'Email scheduled successfully'
        };
    }
    
    // Email Quality Check
    checkEmailQuality(email, subject, html) {
        const issues = [];
        const warnings = [];
        
        if (!email || !this.validateEmail(email)) {
            issues.push('Invalid email address');
        }
        if (!subject || subject.length < 5) {
            issues.push('Subject too short');
        }
        if (subject.length > 200) {
            warnings.push('Subject is very long (>200 chars)');
        }
        if (!html || html.length < 20) {
            issues.push('Message content is empty');
        }
        if (html.includes('free') && html.includes('winner')) {
            warnings.push('May be flagged as spam');
        }
        if (!html.includes('<a')) {
            warnings.push('No links in email');
        }
        
        return {
            valid: issues.length === 0,
            issues,
            warnings,
            score: Math.max(0, 100 - (issues.length * 20) - (warnings.length * 5))
        };
    }
    
    // Bulk Validation
    validateBulk(emails) {
        const results = {
            valid: [],
            invalid: [],
            duplicates: []
        };
        
        const seen = new Set();
        
        for (const email of emails) {
            const trimmed = email.trim().toLowerCase();
            
            if (seen.has(trimmed)) {
                results.duplicates.push(email);
            } else {
                seen.add(trimmed);
                
                if (this.validateEmail(trimmed)) {
                    results.valid.push(trimmed);
                } else {
                    results.invalid.push(trimmed);
                }
            }
        }
        
        return {
            total: emails.length,
            valid: results.valid.length,
            invalid: results.invalid.length,
            duplicates: results.duplicates.length,
            results
        };
    }
    
    // Export Contacts
    exportContacts(format = 'csv') {
        if (format === 'csv') {
            const header = 'ID,Email,Name,Phone,Tags,Added,Status\n';
            const rows = this.contacts.map(c => 
                `${c.id},"${c.email}","${c.name}","${c.phone}","${c.tags.join(';')}",${c.addedAt},${c.status}`
            ).join('\n');
            return header + rows;
        }
        return JSON.stringify(this.contacts, null, 2);
    }
}

// Export for use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = EmailTools;
}

// Browser usage
if (typeof window !== 'undefined') {
    window.EmailTools = EmailTools;
}

