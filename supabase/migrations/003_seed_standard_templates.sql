-- Seed standard templates for basic document creation
-- These templates don't have AI extraction but provide structured formats

INSERT INTO templates (
  name, 
  description, 
  content, 
  category, 
  tags, 
  is_public, 
  fields
) VALUES 
(
  'Meeting Notes Template',
  'Simple template for capturing meeting notes and action items',
  '# Meeting Notes\n\n**Date:** {{date}}\n**Attendees:** {{attendees}}\n**Meeting Subject:** {{subject}}\n\n## Agenda\n{{agenda}}\n\n## Discussion Points\n{{discussion}}\n\n## Action Items\n{{action_items}}\n\n## Next Meeting\n{{next_meeting}}',
  'business',
  ARRAY['meeting', 'notes', 'agenda', 'business'],
  true,
  '[
    {"id": "date", "name": "Meeting Date", "type": "date", "required": true},
    {"id": "attendees", "name": "Attendees", "type": "text", "required": true},
    {"id": "subject", "name": "Meeting Subject", "type": "text", "required": true},
    {"id": "agenda", "name": "Agenda Items", "type": "textarea", "required": false},
    {"id": "discussion", "name": "Discussion Points", "type": "textarea", "required": false},
    {"id": "action_items", "name": "Action Items", "type": "textarea", "required": false},
    {"id": "next_meeting", "name": "Next Meeting", "type": "text", "required": false}
  ]'::jsonb
),
(
  'Project Status Report',
  'Weekly or monthly project status reporting template',
  '# Project Status Report\n\n**Project:** {{project_name}}\n**Report Date:** {{report_date}}\n**Project Manager:** {{pm_name}}\n**Status:** {{status}}\n\n## Summary\n{{summary}}\n\n## Completed This Period\n{{completed}}\n\n## Planned for Next Period\n{{planned}}\n\n## Issues and Risks\n{{issues}}\n\n## Budget Status\n{{budget}}',
  'business',
  ARRAY['project', 'status', 'report', 'management'],
  true,
  '[
    {"id": "project_name", "name": "Project Name", "type": "text", "required": true},
    {"id": "report_date", "name": "Report Date", "type": "date", "required": true},
    {"id": "pm_name", "name": "Project Manager", "type": "text", "required": true},
    {"id": "status", "name": "Overall Status", "type": "select", "options": ["On Track", "At Risk", "Delayed", "Completed"], "required": true},
    {"id": "summary", "name": "Executive Summary", "type": "textarea", "required": true},
    {"id": "completed", "name": "Completed Items", "type": "textarea", "required": false},
    {"id": "planned", "name": "Planned Items", "type": "textarea", "required": false},
    {"id": "issues", "name": "Issues and Risks", "type": "textarea", "required": false},
    {"id": "budget", "name": "Budget Status", "type": "textarea", "required": false}
  ]'::jsonb
),
(
  'Employee Onboarding Checklist',
  'Comprehensive checklist for new employee onboarding process',
  '# Employee Onboarding Checklist\n\n**Employee:** {{employee_name}}\n**Position:** {{position}}\n**Start Date:** {{start_date}}\n**Department:** {{department}}\n**Manager:** {{manager}}\n\n## Pre-First Day\n{{pre_first_day}}\n\n## First Day Tasks\n{{first_day}}\n\n## First Week Goals\n{{first_week}}\n\n## Training Schedule\n{{training}}\n\n## Equipment and Access\n{{equipment}}',
  'hr',
  ARRAY['onboarding', 'hr', 'employee', 'checklist'],
  true,
  '[
    {"id": "employee_name", "name": "Employee Name", "type": "text", "required": true},
    {"id": "position", "name": "Position/Title", "type": "text", "required": true},
    {"id": "start_date", "name": "Start Date", "type": "date", "required": true},
    {"id": "department", "name": "Department", "type": "text", "required": true},
    {"id": "manager", "name": "Direct Manager", "type": "text", "required": true},
    {"id": "pre_first_day", "name": "Pre-First Day Tasks", "type": "textarea", "required": false},
    {"id": "first_day", "name": "First Day Tasks", "type": "textarea", "required": false},
    {"id": "first_week", "name": "First Week Goals", "type": "textarea", "required": false},
    {"id": "training", "name": "Training Schedule", "type": "textarea", "required": false},
    {"id": "equipment", "name": "Equipment and Access", "type": "textarea", "required": false}
  ]'::jsonb
),
(
  'Incident Report Form',
  'Standard incident reporting template for workplace safety',
  '# Incident Report\n\n**Report #:** {{report_number}}\n**Date of Incident:** {{incident_date}}\n**Time:** {{incident_time}}\n**Location:** {{location}}\n**Reporter:** {{reporter_name}}\n\n## People Involved\n{{people_involved}}\n\n## Description of Incident\n{{description}}\n\n## Injuries or Damages\n{{injuries}}\n\n## Witnesses\n{{witnesses}}\n\n## Immediate Actions Taken\n{{actions_taken}}\n\n## Follow-up Required\n{{followup}}',
  'hr',
  ARRAY['incident', 'safety', 'report', 'workplace'],
  true,
  '[
    {"id": "report_number", "name": "Report Number", "type": "text", "required": true},
    {"id": "incident_date", "name": "Date of Incident", "type": "date", "required": true},
    {"id": "incident_time", "name": "Time of Incident", "type": "time", "required": true},
    {"id": "location", "name": "Location", "type": "text", "required": true},
    {"id": "reporter_name", "name": "Reporter Name", "type": "text", "required": true},
    {"id": "people_involved", "name": "People Involved", "type": "textarea", "required": true},
    {"id": "description", "name": "Incident Description", "type": "textarea", "required": true},
    {"id": "injuries", "name": "Injuries or Damages", "type": "textarea", "required": false},
    {"id": "witnesses", "name": "Witnesses", "type": "textarea", "required": false},
    {"id": "actions_taken", "name": "Immediate Actions", "type": "textarea", "required": false},
    {"id": "followup", "name": "Follow-up Required", "type": "textarea", "required": false}
  ]'::jsonb
),
(
  'Purchase Order',
  'Standard purchase order template for procurement',
  '# Purchase Order\n\n**PO Number:** {{po_number}}\n**Date:** {{po_date}}\n**Vendor:** {{vendor_name}}\n**Delivery Date:** {{delivery_date}}\n**Billing Address:** {{billing_address}}\n**Shipping Address:** {{shipping_address}}\n\n## Items\n{{items}}\n\n**Subtotal:** {{subtotal}}\n**Tax:** {{tax}}\n**Shipping:** {{shipping}}\n**Total:** {{total}}',
  'procurement',
  ARRAY['purchase-order', 'procurement', 'buying', 'vendor'],
  true,
  '[
    {"id": "po_number", "name": "PO Number", "type": "text", "required": true},
    {"id": "po_date", "name": "PO Date", "type": "date", "required": true},
    {"id": "vendor_name", "name": "Vendor Name", "type": "text", "required": true},
    {"id": "delivery_date", "name": "Requested Delivery Date", "type": "date", "required": false},
    {"id": "billing_address", "name": "Billing Address", "type": "textarea", "required": true},
    {"id": "shipping_address", "name": "Shipping Address", "type": "textarea", "required": true},
    {"id": "items", "name": "Items/Services", "type": "textarea", "required": true},
    {"id": "subtotal", "name": "Subtotal", "type": "currency", "required": true},
    {"id": "tax", "name": "Tax", "type": "currency", "required": false},
    {"id": "shipping", "name": "Shipping", "type": "currency", "required": false},
    {"id": "total", "name": "Total", "type": "currency", "required": true}
  ]'::jsonb
),
(
  'Customer Feedback Form',
  'Template for collecting customer feedback and satisfaction surveys',
  '# Customer Feedback\n\n**Customer:** {{customer_name}}\n**Date:** {{feedback_date}}\n**Product/Service:** {{product_service}}\n**Overall Rating:** {{rating}}\n\n## What did you like most?\n{{liked_most}}\n\n## What could be improved?\n{{improvements}}\n\n## Additional Comments\n{{comments}}\n\n## Would you recommend us?\n{{recommend}}',
  'other',
  ARRAY['feedback', 'customer', 'survey', 'satisfaction'],
  true,
  '[
    {"id": "customer_name", "name": "Customer Name", "type": "text", "required": true},
    {"id": "feedback_date", "name": "Date", "type": "date", "required": true},
    {"id": "product_service", "name": "Product/Service", "type": "text", "required": true},
    {"id": "rating", "name": "Overall Rating", "type": "select", "options": ["1 - Poor", "2 - Fair", "3 - Good", "4 - Very Good", "5 - Excellent"], "required": true},
    {"id": "liked_most", "name": "What did you like most?", "type": "textarea", "required": false},
    {"id": "improvements", "name": "What could be improved?", "type": "textarea", "required": false},
    {"id": "comments", "name": "Additional Comments", "type": "textarea", "required": false},
    {"id": "recommend", "name": "Would you recommend us?", "type": "select", "options": ["Yes", "No", "Maybe"], "required": false}
  ]'::jsonb
);

-- Update usage stats for visibility
UPDATE templates SET usage_count = floor(random() * 30) + 5 WHERE usage_count = 0;
UPDATE templates SET rating = round((random() * 1.5 + 3.5)::numeric, 1) WHERE rating = 0.0;