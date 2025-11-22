'use client';

import { useState } from 'react';
import { Mail, Send, Paperclip, X, Eye, Download, Users } from 'lucide-react';
import { useToast } from '@/components/ToastContainer';
import { PurchaseOrder } from '@/lib/firestore';

interface EmailIntegrationProps {
  po: PurchaseOrder;
  isOpen: boolean;
  onClose: () => void;
}

interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  type: 'po_send' | 'po_approval' | 'po_reminder' | 'custom';
}

export default function EmailIntegration({ po, isOpen, onClose }: EmailIntegrationProps) {
  const { showSuccess, showError } = useToast();
  const [emailData, setEmailData] = useState({
    to: '',
    cc: '',
    bcc: '',
    subject: `Purchase Order ${po.poNumber} - ${po.vendorName}`,
    body: '',
    template: 'po_send'
  });
  const [attachments, setAttachments] = useState<File[]>([]);
  const [sending, setSending] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);

  const emailTemplates: EmailTemplate[] = [
    {
      id: 'po_send',
      name: 'Send PO to Vendor',
      subject: 'Purchase Order {{poNumber}} - {{vendorName}}',
      body: `Dear {{vendorName}},

Please find attached Purchase Order {{poNumber}} for your review and processing.

Order Details:
- PO Number: {{poNumber}}
- Order Date: {{orderDate}}
- Expected Delivery: {{deliveryDate}}
- Total Amount: ₹{{totalAmount}}

Please confirm receipt and provide an estimated delivery timeline.

Best regards,
{{senderName}}
{{companyName}}`,
      type: 'po_send'
    },
    {
      id: 'po_approval',
      name: 'PO Approval Request',
      subject: 'Approval Required: Purchase Order {{poNumber}}',
      body: `Dear {{approverName}},

A new Purchase Order requires your approval:

PO Details:
- PO Number: {{poNumber}}
- Vendor: {{vendorName}}
- Amount: ₹{{totalAmount}}
- Requested by: {{requesterName}}
- Expected Delivery: {{deliveryDate}}

Please review and approve at your earliest convenience.

View PO: {{poLink}}

Best regards,
System Administrator`,
      type: 'po_approval'
    },
    {
      id: 'po_reminder',
      name: 'Delivery Reminder',
      subject: 'Delivery Reminder: PO {{poNumber}}',
      body: `Dear {{vendorName}},

This is a friendly reminder regarding Purchase Order {{poNumber}}.

Expected Delivery Date: {{deliveryDate}}
Current Status: {{status}}

Please provide an update on the delivery status.

Best regards,
{{senderName}}`,
      type: 'po_reminder'
    }
  ];

  const handleTemplateChange = (templateId: string) => {
    const template = emailTemplates.find(t => t.id === templateId);
    if (template) {
      setEmailData(prev => ({
        ...prev,
        template: templateId,
        subject: processTemplate(template.subject),
        body: processTemplate(template.body)
      }));
    }
  };

  const processTemplate = (template: string) => {
    return template
      .replace(/{{poNumber}}/g, po.poNumber)
      .replace(/{{vendorName}}/g, po.vendorName)
      .replace(/{{orderDate}}/g, po.orderDate.toDate().toLocaleDateString())
      .replace(/{{deliveryDate}}/g, po.expectedDeliveryDate.toDate().toLocaleDateString())
      .replace(/{{totalAmount}}/g, po.totalAmount.toLocaleString())
      .replace(/{{status}}/g, po.status)
      .replace(/{{senderName}}/g, 'Purchase Team')
      .replace(/{{companyName}}/g, 'Your Company')
      .replace(/{{approverName}}/g, 'Manager')
      .replace(/{{requesterName}}/g, po.createdBy_name)
      .replace(/{{poLink}}/g, `${window.location.origin}/pos/${po.id}`);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setAttachments(prev => [...prev, ...files]);
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const handleSendEmail = async () => {
    if (!emailData.to.trim()) {
      showError('Email Required', 'Please enter recipient email address');
      return;
    }

    setSending(true);
    try {
      // Simulate email sending - in real app, call your email service
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // In real implementation, you would:
      // 1. Generate PDF of the PO
      // 2. Call email service (SendGrid, AWS SES, etc.)
      // 3. Log the email in audit trail
      
      showSuccess('Email Sent', `PO ${po.poNumber} has been sent successfully`);
      onClose();
    } catch (error) {
      showError('Email Failed', 'Failed to send email. Please try again.');
    } finally {
      setSending(false);
    }
  };

  const generatePOPDF = () => {
    // PDF generation - implement with jsPDF or similar
    showSuccess('PDF Generated', 'PO PDF has been generated and attached');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black bg-opacity-50" onClick={onClose} />
      
      {/* Modal */}
      <div className="relative min-h-screen flex items-center justify-center p-4">
        <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200">
            <div className="flex items-center space-x-3">
              <Mail className="size-6 text-blue-600" />
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Send Email</h2>
                <p className="text-sm text-gray-600">PO {po.poNumber} - {po.vendorName}</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setPreviewMode(!previewMode)}
                className="flex items-center space-x-2 px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                <Eye className="size-4" />
                <span>{previewMode ? 'Edit' : 'Preview'}</span>
              </button>
              
              <button
                onClick={onClose}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
              >
                <X className="size-5" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
            {previewMode ? (
              /* Preview Mode */
              <div className="space-y-6">
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="font-medium text-gray-900 mb-3">Email Preview</h3>
                  <div className="space-y-2 text-sm">
                    <div><span className="font-medium">To:</span> {emailData.to}</div>
                    {emailData.cc && <div><span className="font-medium">CC:</span> {emailData.cc}</div>}
                    {emailData.bcc && <div><span className="font-medium">BCC:</span> {emailData.bcc}</div>}
                    <div><span className="font-medium">Subject:</span> {emailData.subject}</div>
                  </div>
                </div>
                
                <div className="border border-gray-200 rounded-lg p-4">
                  <div className="whitespace-pre-wrap text-sm text-gray-800">
                    {emailData.body}
                  </div>
                </div>
                
                {attachments.length > 0 && (
                  <div className="bg-blue-50 rounded-lg p-4">
                    <h4 className="font-medium text-blue-900 mb-2">Attachments ({attachments.length})</h4>
                    <div className="space-y-1">
                      {attachments.map((file, index) => (
                        <div key={index} className="text-sm text-blue-700">
                          📎 {file.name} ({(file.size / 1024).toFixed(1)} KB)
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* Edit Mode */
              <div className="space-y-6">
                {/* Template Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email Template
                  </label>
                  <select
                    value={emailData.template}
                    onChange={(e) => handleTemplateChange(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    {emailTemplates.map(template => (
                      <option key={template.id} value={template.id}>
                        {template.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Recipients */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      To *
                    </label>
                    <input
                      type="email"
                      value={emailData.to}
                      onChange={(e) => setEmailData(prev => ({ ...prev, to: e.target.value }))}
                      placeholder="vendor@company.com"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      CC
                    </label>
                    <input
                      type="email"
                      value={emailData.cc}
                      onChange={(e) => setEmailData(prev => ({ ...prev, cc: e.target.value }))}
                      placeholder="manager@company.com"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      BCC
                    </label>
                    <input
                      type="email"
                      value={emailData.bcc}
                      onChange={(e) => setEmailData(prev => ({ ...prev, bcc: e.target.value }))}
                      placeholder="admin@company.com"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>

                {/* Subject */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Subject
                  </label>
                  <input
                    type="text"
                    value={emailData.subject}
                    onChange={(e) => setEmailData(prev => ({ ...prev, subject: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                {/* Body */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Message
                  </label>
                  <textarea
                    value={emailData.body}
                    onChange={(e) => setEmailData(prev => ({ ...prev, body: e.target.value }))}
                    rows={12}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                {/* Attachments */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Attachments
                  </label>
                  
                  <div className="space-y-3">
                    {/* Auto-attach PO PDF */}
                    <div className="flex items-center justify-between p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <div className="flex items-center space-x-2">
                        <Download className="wsize-4 text-blue-600 />
                        <span className="text-sm text-blue-800">PO_{po.poNumber}.pdf</span>
                        <span className="text-xs text-blue-600">(Auto-generated)</span>
                      </div>
                      <button
                        onClick={generatePOPDF}
                        className="text-xs text-blue-600 hover:text-blue-800"
                      >
                        Regenerate
                      </button>
                    </div>

                    {/* Additional attachments */}
                    {attachments.map((file, index) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-gray-50 border border-gray-200 rounded-lg">
                        <div className="flex items-center space-x-2">
                          <Paperclip className="wsize-4 text-gray-600 />
                          <span className="text-sm text-gray-800">{file.name}</span>
                          <span className="text-xs text-gray-500">({(file.size / 1024).toFixed(1)} KB)</span>
                        </div>
                        <button
                          onClick={() => removeAttachment(index)}
                          className="text-red-600 hover:text-red-800"
                        >
                          <X className="wsize-4 />
                        </button>
                      </div>
                    ))}

                    {/* Upload button */}
                    <div>
                      <input
                        type="file"
                        id="attachments"
                        multiple
                        onChange={handleFileUpload}
                        className="hidden"
                        accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"
                      />
                      <label
                        htmlFor="attachments"
                        className="flex items-center justify-center space-x-2 p-3 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-400 hover:bg-blue-50 cursor-pointer transition-colors"
                      >
                        <Paperclip className="wsize-4 text-gray-600 />
                        <span className="text-sm text-gray-600">Add attachments</span>
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between p-6 border-t border-gray-200 bg-gray-50">
            <div className="flex items-center space-x-4 text-sm text-gray-600">
              <div className="flex items-center space-x-1">
                <Users className="wsize-4 />
                <span>Recipients: {emailData.to ? 1 : 0}</span>
              </div>
              <div className="flex items-center space-x-1">
                <Paperclip className="wsize-4 />
                <span>Attachments: {attachments.length + 1}</span>
              </div>
            </div>
            
            <div className="flex space-x-3">
              <button
                onClick={onClose}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSendEmail}
                disabled={!emailData.to.trim() || sending}
                className="flex items-center space-x-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Send className="wsize-4 />
                <span>{sending ? 'Sending...' : 'Send Email'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}